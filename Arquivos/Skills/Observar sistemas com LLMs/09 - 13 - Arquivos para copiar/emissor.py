"""Emissor do rastro — grava, em um arquivo, o que o programa fez enquanto rodou.

O que é: três marcas (`ponto`, `modelo`, `marcar`) que o programa observado
coloca acima das funções que importam. Cada vez que uma função marcada roda,
uma linha JSON é acrescentada ao rastro (`rastro.jsonl`). O painel lê esse
arquivo e mostra o que aconteceu.

O que NÃO faz: não muda o que a função recebe nem o que ela devolve, não
guarda nada além do rastro, não chama nenhum serviço de fora e não derruba o
programa — qualquer erro ao registrar é engolido.

Como remover: apague as linhas de marca e o `import` deste arquivo no código do
programa. Ele volta a ser exatamente o que era.
"""

import functools
import inspect
import itertools
import json
import os
import threading
import time
from pathlib import Path

# --- AJUSTES DO PROJETO ---
VERSAO = "1.0"
RAIZ_DO_PROJETO = Path(__file__).resolve().parents[3]   # utils → Code → Program → raiz
CAMINHO_RASTRO = Path(os.environ.get("OBSERVAR_RASTRO") or RAIZ_DO_PROJETO / "Program" / "Internal" / "logs" / "rastro.jsonl")
GRAVAR_TEXTO = os.environ.get("OBSERVAR_TEXTO") == "1"   # prompt e resposta inteiros: só com o interruptor ligado
TETO_BYTES = 20 * 1024 * 1024                              # rotação do rastro
TETO_TEXTO = 200_000                                       # caracteres de enviado/resposta por evento
OCIOSO_S = 300                                             # sem evento do fluxo por tanto tempo → nova execução
# --- FIM DOS AJUSTES ---

__all__ = ["ponto", "modelo", "marcar", "definir_contador"]

_trava_arquivo = threading.Lock()
_trava_estado = threading.Lock()
_seq = itertools.count(1)
_correntes = {}      # fluxo -> (id da execução, instante do último evento)
_visitas = {}        # (execução, ponto) -> quantas vezes já rodou
_contador = None     # função texto -> int, plugada pelo projeto
_tiktoken = False    # False = ainda não tentou; None = não há; senão, o codificador

_OPERACAO = {"llm": "chat", "embedding": "embeddings", "ferramenta": "execute_tool"}
_NOMES_DO_ENVIADO = ("messages", "mensagens", "prompt", "input", "texto", "contents")


# ---------------------------------------------------------------- gravação

def _gravar(evento):
    """Acrescenta uma linha ao rastro. Nunca levanta."""
    try:
        linha = {"v": 1, "ts": time.time()}
        for chave, valor in evento.items():
            if valor is None:
                continue
            if chave in ("enviado", "resposta"):
                if not GRAVAR_TEXTO:
                    continue
                valor = str(valor)[:TETO_TEXTO]
            linha[chave] = valor
        texto = json.dumps(linha, ensure_ascii=False, default=str) + "\n"
        with _trava_arquivo:
            CAMINHO_RASTRO.parent.mkdir(parents=True, exist_ok=True)
            with open(CAMINHO_RASTRO, "a", encoding="utf-8") as arquivo:
                arquivo.write(texto)
    except Exception:
        pass


def _girar_o_rastro():
    """Se o rastro passou do teto, guarda-o como rastro.anterior.jsonl e recomeça."""
    try:
        if CAMINHO_RASTRO.exists() and CAMINHO_RASTRO.stat().st_size > TETO_BYTES:
            with _trava_arquivo:
                os.replace(str(CAMINHO_RASTRO), str(CAMINHO_RASTRO.with_name("rastro.anterior.jsonl")))
    except Exception:
        pass


def _abrir_execucao(fluxo, tipo, agora):
    """Decide se este ponto começa uma execução nova. Chamar com _trava_estado."""
    atual = _correntes.get(fluxo)
    if tipo == "gatilho" or atual is None or agora - atual[1] > OCIOSO_S:
        execucao = time.strftime("%Y%m%d-%H%M%S") + "-" + str(next(_seq))
        vivas = {e for e, _ in _correntes.values()}
        for chave in [c for c in _visitas if c[0] not in vivas]:
            del _visitas[chave]
        _girar_o_rastro()
        return execucao
    return atual[0]


def _iniciar(fluxo, ponto_id, tipo):
    agora = time.time()
    with _trava_estado:
        execucao = _abrir_execucao(fluxo, tipo, agora)
        chave = (execucao, ponto_id)
        _visitas[chave] = _visitas.get(chave, 0) + 1
        visita = _visitas[chave]
        _correntes[fluxo] = (execucao, agora)
    _gravar({"evento": "ponto_inicio", "execucao": execucao, "fluxo": fluxo, "ponto": ponto_id,
             "visita": visita, "tipo": tipo, "gen_ai.operation.name": _OPERACAO.get(tipo)})
    return {"execucao": execucao, "visita": visita, "t0": time.perf_counter()}


def _texto_do_erro(erro):
    return (type(erro).__name__ + ": " + str(erro))[:500]


def _valor(item, args, kwargs, resultado):
    """Texto/dict fixo, ou callable(args, kwargs, resultado). Nunca levanta."""
    try:
        return item(args, kwargs, resultado) if callable(item) else item
    except Exception:
        return None


def _finalizar(est, fluxo, ponto_id, tipo, args, kwargs, resultado, erro,
               detalhe=None, contagens=None, encerra=None, barrou=None, extra=None):
    duracao = time.perf_counter() - est["t0"]
    estado = "ok"
    if erro is not None:
        estado = "erro"
    else:
        if barrou is None and tipo == "barreira":
            barrou = lambda r: r is False
        if barrou is not None:
            try:
                if barrou(resultado):
                    estado = "barrou"
            except Exception:
                pass
    evento = {"evento": "ponto_fim", "execucao": est["execucao"], "fluxo": fluxo, "ponto": ponto_id,
              "visita": est["visita"], "tipo": tipo, "duracao": round(duracao, 4), "estado": estado,
              "erro": _texto_do_erro(erro) if erro is not None else None,
              "encerra": encerra,
              "detalhe": _valor(detalhe, args, kwargs, resultado),
              "contagens": _valor(contagens, args, kwargs, resultado),
              "gen_ai.operation.name": _OPERACAO.get(tipo)}
    if extra:
        evento.update(extra)
    with _trava_estado:
        _correntes[fluxo] = (est["execucao"], time.time())
    _gravar(evento)


def _seguro(funcao, *argumentos, **nomeados):
    try:
        return funcao(*argumentos, **nomeados)
    except Exception:
        return None


# ---------------------------------------------------------------- extração do @modelo

def _pegar(objeto, nome):
    """Atributo ou chave, o que existir; senão None."""
    if objeto is None:
        return None
    if isinstance(objeto, dict):
        return objeto.get(nome)
    return getattr(objeto, nome, None)


def _como_texto(valor):
    if isinstance(valor, str):
        return valor
    if isinstance(valor, (list, tuple)) and valor and all(isinstance(m, dict) and "role" in m and "content" in m for m in valor):
        return "\n".join("{}: {}".format(m["role"], m["content"]) for m in valor)
    return json.dumps(valor, ensure_ascii=False, default=str)


def _argumentos(fn, args, kwargs):
    try:
        return inspect.signature(fn).bind(*args, **kwargs).arguments
    except Exception:
        return {}


def _extrair_enviado(fn, args, kwargs, nome_do_argumento):
    dados = _argumentos(fn, args, kwargs)
    if isinstance(nome_do_argumento, str) and nome_do_argumento in dados:
        return _como_texto(dados[nome_do_argumento])
    for nome in _NOMES_DO_ENVIADO:
        if nome in dados:
            return _como_texto(dados[nome])
    return None


def _extrair_resposta(retorno):
    if isinstance(retorno, str):
        return retorno
    caminhos = (
        lambda r: r.choices[0].message.content,
        lambda r: r.content[0].text,
        lambda r: r["choices"][0]["message"]["content"],
        lambda r: r["message"]["content"],
        lambda r: r["response"],
        lambda r: r["content"],
    )
    for caminho in caminhos:
        try:
            achado = caminho(retorno)
            if isinstance(achado, str):
                return achado
        except Exception:
            pass
    return json.dumps(retorno, ensure_ascii=False, default=str)


def _numero(objeto, *nomes):
    for nome in nomes:
        valor = _pegar(objeto, nome)
        if isinstance(valor, (int, float)) and not isinstance(valor, bool):
            return int(valor)
    return None


def _tokens_do_servidor(retorno):
    """(entrada, saída) devolvidos pelo servidor, ou (None, None)."""
    for onde in (_pegar(retorno, "usage"), _pegar(retorno, "usage_metadata"), retorno):
        if onde is None:
            continue
        entrada = _numero(onde, "prompt_tokens", "input_tokens", "prompt_eval_count", "prompt_token_count")
        saida = _numero(onde, "completion_tokens", "output_tokens", "eval_count", "candidates_token_count")
        if entrada is not None or saida is not None:
            return entrada, saida
    return None, None


def _contar_local(texto):
    global _tiktoken
    if _contador is not None:
        try:
            return int(_contador(texto))
        except Exception:
            pass
    if _tiktoken is False:
        try:
            import tiktoken
            _tiktoken = tiktoken.get_encoding("cl100k_base")
        except Exception:
            _tiktoken = None
    if _tiktoken is not None:
        try:
            return len(_tiktoken.encode(texto))
        except Exception:
            pass
    return max(1, round(len(texto) / 3.6))


def _modelo_usado(retorno, fn, args, kwargs):
    achado = _pegar(retorno, "model")
    if isinstance(achado, str):
        return achado
    achado = _argumentos(fn, args, kwargs).get("model")
    return achado if isinstance(achado, str) else None


def _extra_do_modelo(fn, args, kwargs, retorno, nome_do_enviado):
    enviado = _seguro(_extrair_enviado, fn, args, kwargs, nome_do_enviado)
    resposta = _seguro(_extrair_resposta, retorno)
    entrada, saida = _seguro(_tokens_do_servidor, retorno) or (None, None)
    fonte = None
    if entrada is not None or saida is not None:
        fonte = "servidor"
    else:
        if enviado is not None:
            entrada = _seguro(_contar_local, enviado)
        if resposta is not None:
            saida = _seguro(_contar_local, resposta)
        if entrada is not None or saida is not None:
            fonte = "local"
    return {"gen_ai.request.model": _seguro(_modelo_usado, retorno, fn, args, kwargs),
            "gen_ai.usage.input_tokens": entrada, "gen_ai.usage.output_tokens": saida,
            "tokens_fonte": fonte, "enviado": enviado, "resposta": resposta}


# ---------------------------------------------------------------- a API

def _envolver(fn, fluxo, ponto_id, tipo, opcoes, extra_do_retorno=None):
    nome = ponto_id or fn.__name__

    def antes():
        return _seguro(_iniciar, fluxo, nome, tipo)

    def depois(est, args, kwargs, resultado, erro):
        if est is None:
            return
        extra = None
        if extra_do_retorno is not None and erro is None:
            extra = _seguro(extra_do_retorno, args, kwargs, resultado)
        _seguro(_finalizar, est, fluxo, nome, tipo, args, kwargs, resultado, erro, extra=extra, **opcoes)

    if inspect.iscoroutinefunction(fn):
        @functools.wraps(fn)
        async def embrulho_async(*args, **kwargs):
            est = antes()
            try:
                resultado = await fn(*args, **kwargs)
            except BaseException as erro:
                depois(est, args, kwargs, None, erro)
                raise
            depois(est, args, kwargs, resultado, None)
            return resultado
        return embrulho_async

    @functools.wraps(fn)
    def embrulho(*args, **kwargs):
        est = antes()
        try:
            resultado = fn(*args, **kwargs)
        except BaseException as erro:
            depois(est, args, kwargs, None, erro)
            raise
        depois(est, args, kwargs, resultado, None)
        return resultado
    return embrulho


def ponto(fluxo, ponto=None, tipo=None, detalhe=None, contagens=None, encerra=None, barrou=None):
    """Marca uma função como um ponto do fluxo (sem chamada a modelo)."""
    opcoes = {"detalhe": detalhe, "contagens": contagens, "encerra": encerra, "barrou": barrou}

    def decorador(fn):
        return _envolver(fn, fluxo, ponto, tipo, opcoes)
    return decorador


def modelo(fluxo, ponto=None, tipo="llm", enviado=None, detalhe=None, contagens=None):
    """Marca a função que chama o modelo: grava também tokens, modelo e (se ligado) o texto."""
    opcoes = {"detalhe": detalhe, "contagens": contagens}

    def decorador(fn):
        def extra(args, kwargs, retorno):
            return _extra_do_modelo(fn, args, kwargs, retorno, enviado)
        return _envolver(fn, fluxo, ponto, tipo, opcoes, extra_do_retorno=extra)
    return decorador


def marcar(fluxo, ponto, tipo=None, detalhe=None, contagens=None, encerra=None):
    """Para quando o ponto não é uma função inteira: grava início e fim de uma vez."""
    try:
        est = _iniciar(fluxo, ponto, tipo)
        est["t0"] = time.perf_counter()
        _finalizar(est, fluxo, ponto, tipo, (), {}, None, None,
                   detalhe=detalhe, contagens=contagens, encerra=encerra)
    except Exception:
        pass


def definir_contador(funcao):
    """O projeto pluga o tokenizador dele: funcao(texto) -> int."""
    global _contador
    _contador = funcao
