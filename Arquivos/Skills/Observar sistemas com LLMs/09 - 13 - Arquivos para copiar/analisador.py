"""Analisador — lê o código Python do projeto e monta o desenho do fluxo.

O que faz: percorre os arquivos `.py`, acha quem chama quem e, a partir das
descrições em `descricoes/*.json` (uma por fluxo, escritas pelo assistente),
devolve os fluxos prontos para o painel: pontos, ligações, tipos e posições.

O que NÃO faz: não escreve, não corrige e não apaga nada no projeto. Só lê.

Uso pela linha de comando (a partir da raiz do projeto):
    python analisador.py --json        o desenho completo, em JSON
    python analisador.py --candidatos  onde um fluxo provavelmente começa
    python analisador.py --conferir    o que as marcas e as descrições deixaram torto
"""

import argparse
import ast
import json
import os
import sys
from pathlib import Path

# --- AJUSTES DO PROJETO ---
VERSAO = "1.0"
RAIZ_DO_PROJETO = Path(__file__).resolve().parents[2]      # observar → Workshop → raiz
PASTA_DAS_DESCRICOES = Path(__file__).resolve().parent / "descricoes"
IGNORAR = {".git", ".venv", "venv", "env", "node_modules", "__pycache__", "Distribution", "Files", "observar"}
PROFUNDIDADE_MAXIMA = 3
# --- FIM DOS AJUSTES ---

# ------------------------------------------------------------------ assinaturas
# Listas fáceis de estender. Casam pelo texto da chamada (sem diferenciar
# maiúsculas) ou pelo nome da função.

TIPOS_DE_PONTO = {"gatilho", "llm", "ferramenta", "codigo", "humano", "embedding", "barreira", "fila", "outro"}
ORDEM_DE_TIPO = ("llm", "embedding", "fila", "barreira", "humano", "ferramenta")

LLM_TERMINA_EM = ("chat.completions.create", "completions.create", "messages.create",
                  "responses.create", "generate_content", "ollama.chat")
LLM_URLS = ("/chat/completions", "/v1/messages", "/api/generate", "/api/chat", "/completion")
EMBEDDING_ULTIMO = {"embed", "embed_documents", "embed_query", "rerank"}
FILA_ULTIMO = {"semaphore", "boundedsemaphore", "acquire", "queue", "priorityqueue"}
BARREIRA_ULTIMO = {"ratelimiter", "ratelimit", "wait_for"}
BARREIRA_NO_NOME = ("guardrail", "limite", "limit", "valida", "confian", "timeout")
HUMANO_ULTIMO = {"askyesno", "wait_for_user", "aguardar_usuario"}
HUMANO_NOME = {"pedir_ao_usuario", "perguntar_ao_usuario", "aguardar_resposta"}
DECORADORES_DE_FERRAMENTA = {"tool", "function_tool", "ferramenta"}
DECORADORES_DE_ROTA = {"route", "get", "post", "put", "websocket", "api"}
METODOS_DE_EVENTO = {"on_created", "on_modified", "on_moved"}
REGISTROS_DE_FUNCAO = {"do", "add_handler", "on"}

NOMES_LEGIVEIS = {"llm": "Modelo", "embedding": "Modelo complementar", "fila": "Fila",
                  "barreira": "Barreira", "humano": "Humano"}


# ------------------------------------------------------------------ utilidades

def _texto(no):
    try:
        return ast.unparse(no)
    except Exception:
        return ""


def _literal(no):
    return no.value if isinstance(no, ast.Constant) else None


def _humanizar(nome):
    texto = nome.strip("_").replace("_", " ")
    return texto[:1].upper() + texto[1:]


def _chamadas(no):
    """Chamadas de uma expressão/instrução, na ordem em que são avaliadas."""
    if isinstance(no, (ast.Lambda, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
        return
    if isinstance(no, ast.Call):
        yield from _chamadas(no.func)
        for argumento in no.args:
            yield from _chamadas(argumento)
        for palavra in no.keywords:
            yield from _chamadas(palavra.value)
        yield no
        return
    for filho in ast.iter_child_nodes(no):
        yield from _chamadas(filho)


def _tipo_da_chamada(chamada):
    """Tipo de ponto que o TEXTO da chamada denuncia, ou None."""
    baixo = _texto(chamada.func).lower()
    ultimo = baixo.rsplit(".", 1)[-1]
    if any(baixo.endswith(s) for s in LLM_TERMINA_EM):
        return "llm"
    if ultimo == "generate" and any(p.arg == "prompt" for p in chamada.keywords):
        return "llm"
    if ultimo == "post" and chamada.args:
        primeiro = _texto(chamada.args[0]).lower()
        if any(u in primeiro for u in LLM_URLS):
            return "llm"
    if baixo.endswith("embeddings.create") or ultimo in EMBEDDING_ULTIMO:
        return "embedding"
    if ultimo in FILA_ULTIMO:
        return "fila"
    if baixo.endswith("moderations.create") or ultimo in BARREIRA_ULTIMO:
        return "barreira"
    if baixo == "input" or ultimo in HUMANO_ULTIMO or ultimo in HUMANO_NOME or "messagebox." in baixo:
        return "humano"
    return None


def _tipos_do_nome(nome):
    baixo = nome.lower()
    achados = set()
    if any(s in baixo for s in BARREIRA_NO_NOME):
        achados.add("barreira")
    if baixo in HUMANO_NOME:
        achados.add("humano")
    return achados


def _decoradores(no):
    """[(nome final, chamada ou None)] dos decoradores de uma função."""
    saida = []
    for d in getattr(no, "decorator_list", []):
        alvo = d.func if isinstance(d, ast.Call) else d
        if isinstance(alvo, ast.Name):
            nome = alvo.id
        elif isinstance(alvo, ast.Attribute):
            nome = alvo.attr
        else:
            continue
        saida.append((nome, d if isinstance(d, ast.Call) else None))
    return saida


class _Func:
    """Uma função ou método do projeto."""
    __slots__ = ("nome", "caminho", "linha", "no", "classe", "bases", "decs")

    def __init__(self, nome, caminho, no, classe=None, bases=()):
        self.nome = nome
        self.caminho = caminho
        self.linha = no.lineno
        self.no = no
        self.classe = classe
        self.bases = list(bases)
        self.decs = _decoradores(no)

    @property
    def arq(self):
        return "%s:%d" % (self.caminho, self.linha)


# ------------------------------------------------------------------ o projeto lido

class _Projeto:
    def __init__(self, raiz):
        self.raiz = Path(raiz)
        self.avisos = []
        self.funcs = []
        self.por_nome = {}
        self.por_arquivo = {}
        self.imports = {}
        self.marcas = []
        self.constantes = {}
        self.tabelas = {}
        self.pontos_dotted = {}
        self.registros = {}
        self.chamados_no_main = set()
        self._cache_resolucao = {}
        self._cache_chamadas = {}
        self._cache_modulos = {}
        self._chamadores = None
        self._ler()

    # ---------------------------------------------------------- indexação

    def _arquivos(self):
        achados = []
        for pasta, subpastas, nomes in os.walk(str(self.raiz)):
            subpastas[:] = sorted(d for d in subpastas if d not in IGNORAR and not d.startswith("."))
            for nome in sorted(nomes):
                if nome.endswith(".py") and nome != "emissor.py":
                    achados.append(Path(pasta) / nome)
        return achados

    def _ler(self):
        arvores = {}
        for arquivo in self._arquivos():
            caminho = arquivo.relative_to(self.raiz).as_posix()
            try:
                if arquivo.stat().st_size > 2_000_000:
                    continue
                arvores[caminho] = ast.parse(arquivo.read_text(encoding="utf-8-sig", errors="replace"))
            except Exception:
                self.avisos.append("não consegui ler " + caminho)
        self._arvores = arvores
        for caminho, arvore in arvores.items():
            partes = caminho[:-3].split("/")
            if partes[-1] == "__init__" and len(partes) > 1:
                partes = partes[:-1]
            self.pontos_dotted[caminho] = ".".join(partes)
            self.por_arquivo[caminho] = []
            self._indexar_funcoes(caminho, arvore.body, None, ())
            self._indexar_imports(caminho, arvore)
            self._indexar_modulo(caminho, arvore)
        for caminho, arvore in arvores.items():
            self._indexar_marcas(caminho, arvore)
            self._indexar_registros(caminho, arvore)

    def _indexar_funcoes(self, caminho, corpo, classe, bases):
        for no in corpo:
            if isinstance(no, (ast.FunctionDef, ast.AsyncFunctionDef)):
                func = _Func(no.name, caminho, no, classe, bases)
                self.funcs.append(func)
                self.por_arquivo[caminho].append(func)
                self.por_nome.setdefault(no.name, []).append(func)
            elif isinstance(no, ast.ClassDef):
                self._indexar_funcoes(caminho, no.body, no.name, [_texto(b) for b in no.bases])
            elif isinstance(no, (ast.If, ast.Try, ast.With)):
                blocos = [no.body, getattr(no, "orelse", []), getattr(no, "finalbody", [])]
                blocos += [h.body for h in getattr(no, "handlers", [])]
                for bloco in blocos:
                    self._indexar_funcoes(caminho, bloco, classe, bases)

    def _indexar_imports(self, caminho, arvore):
        de, mod = {}, {}
        pacote = list(Path(caminho).parent.parts)
        for no in ast.walk(arvore):
            if isinstance(no, ast.Import):
                for alias in no.names:
                    mod[alias.asname or alias.name] = alias.name
                    mod.setdefault(alias.name, alias.name)
            elif isinstance(no, ast.ImportFrom):
                base = no.module or ""
                if no.level:
                    corte = len(pacote) - (no.level - 1)
                    base = ".".join(pacote[:max(corte, 0)] + ([no.module] if no.module else []))
                for alias in no.names:
                    if alias.name != "*":
                        de[alias.asname or alias.name] = (base, alias.name)
        self.imports[caminho] = {"de": de, "mod": mod}

    def _indexar_modulo(self, caminho, arvore):
        constantes, tabelas = {}, {}
        for no in arvore.body:
            alvo, valor = None, None
            if isinstance(no, ast.Assign) and len(no.targets) == 1 and isinstance(no.targets[0], ast.Name):
                alvo, valor = no.targets[0].id, no.value
            elif isinstance(no, ast.AnnAssign) and isinstance(no.target, ast.Name) and no.value is not None:
                alvo, valor = no.target.id, no.value
            if alvo is None:
                continue
            if isinstance(valor, ast.Constant) and isinstance(valor.value, int) and not isinstance(valor.value, bool):
                constantes[alvo] = valor.value
            elif isinstance(valor, ast.Dict):
                itens = [v for v in valor.values if isinstance(v, (ast.Name, ast.Attribute))]
                if itens:
                    tabelas[alvo] = itens
        self.constantes[caminho] = constantes
        self.tabelas[caminho] = tabelas

    def _indexar_marcas(self, caminho, arvore):
        for func in self.por_arquivo.get(caminho, []):
            for nome, chamada in func.decs:
                if chamada is not None and nome in ("ponto", "modelo"):
                    marca = self._marca(nome, chamada, caminho, chamada.lineno, func)
                    if marca:
                        self.marcas.append(marca)
        for no in ast.walk(arvore):
            if isinstance(no, ast.Call):
                alvo = no.func
                nome = alvo.id if isinstance(alvo, ast.Name) else alvo.attr if isinstance(alvo, ast.Attribute) else None
                if nome == "marcar":
                    marca = self._marca("marcar", no, caminho, no.lineno, None)
                    if marca:
                        self.marcas.append(marca)

    @staticmethod
    def _marca(nome, chamada, caminho, linha, func):
        argumentos = chamada.args
        palavras = {p.arg: p.value for p in chamada.keywords if p.arg}
        fluxo = _literal(argumentos[0]) if argumentos else _literal(palavras.get("fluxo"))
        ponto = _literal(palavras.get("ponto"))
        if ponto is None and len(argumentos) > 1:
            ponto = _literal(argumentos[1])
        tipo = _literal(palavras.get("tipo"))
        if nome == "modelo" and tipo is None and "tipo" not in palavras:
            tipo = "llm"
        if not isinstance(fluxo, str):
            return None
        if ponto is None and func is not None:
            ponto = func.nome
        if not isinstance(ponto, str):
            return None
        return {"fluxo": fluxo, "ponto": ponto, "tipo": tipo if isinstance(tipo, str) else None,
                "caminho": caminho, "linha": linha, "func": func}

    def _indexar_registros(self, caminho, arvore):
        for no in ast.walk(arvore):
            if isinstance(no, ast.If) and _texto(no.test).replace("'", '"') in ('__name__ == "__main__"', '"__main__" == __name__'):
                for chamada in (c for s in no.body for c in _chamadas(s)):
                    func = self.resolver(chamada.func, caminho)
                    if func:
                        self.chamados_no_main.add(func)
            if not isinstance(no, ast.Call):
                continue
            alvo = no.func
            nome = alvo.id if isinstance(alvo, ast.Name) else alvo.attr if isinstance(alvo, ast.Attribute) else ""
            candidatos, marca = [], None
            if nome == "do" and isinstance(alvo, ast.Attribute):
                candidatos, marca = no.args[:1], ("agenda", "agenda: " + _texto(alvo.value))
            elif nome == "Timer":
                candidatos = [no.args[1]] if len(no.args) > 1 else [p.value for p in no.keywords if p.arg == "function"]
                marca = ("agenda", "agenda: " + _texto(no))
            elif nome == "Thread":
                candidatos, marca = [p.value for p in no.keywords if p.arg == "target"], ("thread", None)
            elif nome in REGISTROS_DE_FUNCAO:
                candidatos, marca = no.args[:1], ("evento", "evento: registrada em " + _texto(no.func))
            for candidato in candidatos:
                if isinstance(candidato, (ast.Name, ast.Attribute)):
                    func = self.resolver(candidato, caminho)
                    if func and func not in self.registros:
                        self.registros[func] = marca

    # ---------------------------------------------------------- resolução

    def _arquivos_do_modulo(self, modulo):
        if modulo not in self._cache_modulos:
            self._cache_modulos[modulo] = [c for c, d in self.pontos_dotted.items()
                                           if modulo and (d == modulo or d.endswith("." + modulo))]
        return self._cache_modulos[modulo]

    def _funcs_do_modulo(self, modulo, nome):
        achados = []
        for caminho in self._arquivos_do_modulo(modulo):
            achados += [f for f in self.por_arquivo.get(caminho, []) if f.nome == nome and f.classe is None]
        return achados

    def resolver(self, no, caminho, classe=None):
        """A função do projeto a que `no` (o `func` de uma chamada) se refere, ou None."""
        chave = (id(no), caminho)
        if chave not in self._cache_resolucao:
            try:
                self._cache_resolucao[chave] = self._resolver(no, caminho, classe)
            except Exception:
                self._cache_resolucao[chave] = None
        return self._cache_resolucao[chave]

    def _resolver(self, no, caminho, classe):
        imp = self.imports.get(caminho, {"de": {}, "mod": {}})
        if isinstance(no, ast.Name):
            locais = [f for f in self.por_arquivo.get(caminho, []) if f.nome == no.id and f.classe is None]
            if locais:
                return locais[0] if len(locais) == 1 else None
            if no.id in imp["de"]:
                modulo, original = imp["de"][no.id]
                achados = self._funcs_do_modulo(modulo, original)
                return achados[0] if len(achados) == 1 else None
            return None
        if isinstance(no, ast.Attribute):
            base = _texto(no.value)
            modulos = []
            if base in imp["mod"]:
                modulos.append(imp["mod"][base])
            elif isinstance(no.value, ast.Name) and base in imp["de"]:
                modulo, original = imp["de"][base]
                modulos.append(modulo + "." + original if modulo else original)
            if modulos:
                achados = []
                for modulo in modulos:
                    achados += self._funcs_do_modulo(modulo, no.attr)
                return achados[0] if len(achados) == 1 else None
            raiz_da_base = base.split(".")[0]
            if raiz_da_base in imp["mod"] or raiz_da_base in imp["de"]:
                return None
            if base == "self" and classe:
                mesma = [f for f in self.por_nome.get(no.attr, []) if f.classe == classe and f.caminho == caminho]
                if len(mesma) == 1:
                    return mesma[0]
            todos = self.por_nome.get(no.attr, [])
            if len(todos) == 1 and todos[0].classe and not no.attr.startswith("__"):
                return todos[0]
        return None

    def chamadas_de(self, func):
        if func not in self._cache_chamadas:
            self._cache_chamadas[func] = [c for s in func.no.body for c in _chamadas(s)]
        return self._cache_chamadas[func]

    def resolver_chamada(self, chamada, func):
        return self.resolver(chamada.func, func.caminho, func.classe)

    def valor_inteiro(self, no, caminho):
        if isinstance(no, ast.Constant) and isinstance(no.value, int) and not isinstance(no.value, bool):
            return no.value
        if isinstance(no, ast.Name):
            if no.id in self.constantes.get(caminho, {}):
                return self.constantes[caminho][no.id]
            achados = {c[no.id] for c in self.constantes.values() if no.id in c}
            if len(achados) == 1:
                return achados.pop()
        return None

    def tabela_de_funcoes(self, nome, caminho):
        """Funções-valor de um dicionário de despacho de módulo."""
        origem = caminho
        if nome not in self.tabelas.get(caminho, {}):
            imp = self.imports.get(caminho, {"de": {}}).get("de", {}).get(nome)
            origem = None
            if imp:
                for c in self._arquivos_do_modulo(imp[0]):
                    if imp[1] in self.tabelas.get(c, {}):
                        origem, nome = c, imp[1]
                        break
            if origem is None:
                donos = [c for c, t in self.tabelas.items() if nome in t]
                if len(donos) != 1:
                    return []
                origem = donos[0]
        achados = []
        for valor in self.tabelas[origem][nome]:
            func = self.resolver(valor, origem)
            if func and func not in achados:
                achados.append(func)
        return achados[:12]

    # ---------------------------------------------------------- tipos e gatilhos

    def marca_do_fluxo(self, func, fluxo):
        for marca in self.marcas:
            if marca["func"] is func and marca["fluxo"] == fluxo:
                return marca
        return None

    def _assinaturas_diretas(self, func):
        tipos = set(_tipos_do_nome(func.nome))
        for nome, chamada in func.decs:
            if nome == "modelo":
                tipo = None
                if chamada is not None:
                    tipo = _literal(next((p.value for p in chamada.keywords if p.arg == "tipo"), None))
                tipos.add(tipo if tipo in TIPOS_DE_PONTO else "llm")
            elif nome in DECORADORES_DE_FERRAMENTA:
                tipos.add("ferramenta")
        for chamada in self.chamadas_de(func):
            if self.resolver_chamada(chamada, func) is None:
                tipo = _tipo_da_chamada(chamada)
                if tipo:
                    tipos.add(tipo)
        return tipos

    def tipo_da_funcao(self, func, fluxo, entradas):
        marca = self.marca_do_fluxo(func, fluxo)
        if marca and marca["tipo"] in TIPOS_DE_PONTO and marca["tipo"] != "gatilho":
            return marca["tipo"]
        achados, vistos = set(), set()

        def visitar(atual, nivel):
            if atual in vistos or nivel > 4:
                return
            vistos.add(atual)
            achados.update(self._assinaturas_diretas(atual))
            for chamada in self.chamadas_de(atual):
                alvo = self.resolver_chamada(chamada, atual)
                if alvo is not None and alvo not in entradas:
                    visitar(alvo, nivel + 1)

        visitar(func, 0)
        for tipo in ORDEM_DE_TIPO:
            if tipo in achados:
                return tipo
        return "codigo"

    def tem_assinatura_direta(self, func):
        return bool(self._assinaturas_diretas(func))

    def chamadores(self, func):
        if self._chamadores is None:
            self._chamadores = {}
            for f in self.funcs:
                for chamada in self.chamadas_de(f):
                    alvo = self.resolver_chamada(chamada, f)
                    if alvo is not None and alvo is not f:
                        lista = self._chamadores.setdefault(alvo, [])
                        if f.nome not in lista:
                            lista.append(f.nome)
        return self._chamadores.get(func, [])

    def espera_da_entrada(self, func):
        for nome, chamada in func.decs:
            if nome in DECORADORES_DE_ROTA:
                rota = _literal(chamada.args[0]) if chamada is not None and chamada.args else None
                return "mensagem do usuário: rota " + rota if isinstance(rota, str) else "mensagem do usuário: rota"
        if func.classe and func.nome in METODOS_DE_EVENTO and any("Handler" in b for b in func.bases):
            return "evento: arquivo novo/alterado na pasta vigiada"
        registro = self.registros.get(func)
        if registro and registro[0] in ("agenda", "evento"):
            return registro[1]
        intervalo = self._intervalo_do_vigia(func)
        if (registro and registro[0] == "thread") or intervalo is not None:
            return "evento: vigia repetindo a cada %s s" % intervalo if intervalo else "evento: vigia repetindo"
        if func in self.chamados_no_main:
            return "evento: abertura do programa"
        por = self.chamadores(func)[:2]
        return "evento: chamada direta (por %s)" % ", ".join(por) if por else "evento: chamada direta"

    def _intervalo_do_vigia(self, func):
        """None = não é laço de vigia; "" = é, mas sem intervalo literal; senão o número."""
        for no in ast.walk(func.no):
            if isinstance(no, ast.While) and isinstance(no.test, ast.Constant) and no.test.value is True:
                for chamada in (c for s in no.body for c in _chamadas(s)):
                    if _texto(chamada.func).endswith("sleep"):
                        valor = _literal(chamada.args[0]) if chamada.args else None
                        return "" if not isinstance(valor, (int, float)) else ("%g" % valor)
        return None

    def parece_gatilho(self, func):
        if any(m["func"] is func and m["tipo"] == "gatilho" for m in self.marcas):
            return "marcada como gatilho"
        for nome, chamada in func.decs:
            if nome in DECORADORES_DE_ROTA:
                return "rota do servidor"
        if func.classe and func.nome in METODOS_DE_EVENTO and any("Handler" in b for b in func.bases):
            return "vigia de arquivos"
        registro = self.registros.get(func)
        if registro:
            return {"agenda": "agendada", "thread": "roda em uma thread"}.get(registro[0], "registrada como resposta a evento")
        if self._intervalo_do_vigia(func) is not None:
            return "vigia repetindo em laço"
        if func in self.chamados_no_main:
            return "chamada na abertura do programa"
        return None

    def chama_modelo(self, func):
        for nome, _ in func.decs:
            if nome == "modelo":
                return True
        for chamada in self.chamadas_de(func):
            if self.resolver_chamada(chamada, func) is None and _tipo_da_chamada(chamada) in ("llm", "embedding"):
                return True
        return False

    # ---------------------------------------------------------- descrições e entradas

    def ler_descricoes(self):
        descricoes = []
        if not PASTA_DAS_DESCRICOES.is_dir():
            self.avisos.append("Nenhuma descrição encontrada em %s. Rode com --candidatos e escreva uma por fluxo." % PASTA_DAS_DESCRICOES.as_posix())
            return descricoes
        for arquivo in sorted(PASTA_DAS_DESCRICOES.glob("*.json")):
            try:
                dados = json.loads(arquivo.read_text(encoding="utf-8-sig"))
                if not isinstance(dados, dict) or not isinstance(dados.get("fluxo"), str) or not dados.get("entrada"):
                    raise ValueError("faltam as chaves «fluxo» e «entrada»")
                descricoes.append(dados)
            except Exception as erro:
                self.avisos.append("descrição inválida: %s (%s)" % (arquivo.name, erro))
        if not descricoes and not any(a.startswith("descrição inválida") for a in self.avisos):
            self.avisos.append("Nenhuma descrição encontrada em %s. Rode com --candidatos e escreva uma por fluxo." % PASTA_DAS_DESCRICOES.as_posix())
        return descricoes

    def achar_entrada(self, entrada):
        """A função que a referência `caminho.py:LINHA` ou `caminho.py::nome` aponta."""
        entrada = str(entrada).strip().replace("\\", "/")
        if "::" in entrada:
            caminho, _, nome = entrada.partition("::")
            linha = None
        else:
            caminho, _, resto = entrada.rpartition(":")
            if not resto.isdigit():
                return None
            nome, linha = None, int(resto)
        arquivo = self._achar_arquivo(caminho)
        if arquivo is None:
            return None
        candidatas = self.por_arquivo.get(arquivo, [])
        if nome is not None:
            achadas = [f for f in candidatas if f.nome == nome.split(".")[-1]]
            return achadas[0] if achadas else None
        dentro = []
        for f in candidatas:
            inicio = min([f.linha] + [d.lineno for d in f.no.decorator_list])
            if inicio <= linha <= (f.no.end_lineno or f.linha):
                dentro.append(f)
        return min(dentro, key=lambda f: (f.no.end_lineno or f.linha) - f.linha) if dentro else None

    def _achar_arquivo(self, caminho):
        if caminho in self.por_arquivo:
            return caminho
        achados = [c for c in self.por_arquivo if c.endswith("/" + caminho) or caminho.endswith("/" + c)]
        return achados[0] if len(achados) == 1 else None


# ------------------------------------------------------------------ montagem de um fluxo

class _Fluxo:
    def __init__(self, projeto, descricao, entrada, entradas):
        self.p = projeto
        self.desc = descricao
        self.id = descricao["fluxo"]
        self.entrada = entrada
        self.entradas = entradas
        correcoes = descricao.get("correcoes") if isinstance(descricao.get("correcoes"), dict) else {}
        self.correcoes = {k: v for k, v in correcoes.items() if isinstance(v, dict)}
        self.pontos = descricao.get("pontos") if isinstance(descricao.get("pontos"), dict) else {}
        self.nos = {}
        self.arestas = []
        self.usados = {}
        self.por_func = {}
        self.laco_pilha = []
        self.pilha = []
        self.agente = False
        self.teto = None
        self.cruzar = []
        self.entrada_id = None

    # ---------------------------------------------------------- nós e arestas

    def _id_novo(self, base):
        n = self.usados.get(base, 0) + 1
        self.usados[base] = n
        return base if n == 1 else "%s_%d" % (base, n)

    def _ligar(self, fronteira, destino):
        for origem, atributos in fronteira:
            self._aresta(origem, destino, atributos)

    def _aresta(self, origem, destino, atributos=None):
        if any(a[0] == origem and a[1] == destino for a in self.arestas):
            return
        self.arestas.append([origem, destino, dict(atributos)] if atributos else [origem, destino])

    @staticmethod
    def _uniao(a, b):
        saida = list(a)
        ja = {i for i, _ in saida}
        for item in b:
            if item[0] not in ja:
                saida.append(item)
                ja.add(item[0])
        return saida

    def _criar_no(self, base, nome_padrao, tipo, arq, func):
        corr = self.correcoes.get(base, {})
        no_id = self._id_novo(base)
        corr = self.correcoes.get(no_id, corr)
        if corr.get("ignorar") is True:
            return None
        marcado = any(m["fluxo"] == self.id and m["ponto"] == base for m in self.p.marcas)
        no = {"id": no_id, "nome": corr.get("nome") or nome_padrao,
              "tipo": corr.get("tipo") if corr.get("tipo") in TIPOS_DE_PONTO else tipo,
              "c": 0, "r": 0, "arq": arq, "espera": corr.get("espera") or None, "envia": [],
              "desc": self.pontos.get(no_id) or self.pontos.get(base) or None, "marcado": marcado}
        no["_func"] = func
        self.nos[no_id] = no
        if func is not None:
            self.por_func[func] = no_id
        return no

    def _id_do_ponto(self, func):
        marca = self.p.marca_do_fluxo(func, self.id)
        return marca["ponto"] if marca else func.nome

    # ---------------------------------------------------------- percurso

    def montar(self):
        base = self._id_do_ponto(self.entrada)
        corr = self.correcoes.get(base, {})
        no = self._criar_no(base, corr.get("nome") or _humanizar(base), "gatilho", self.entrada.arq, self.entrada)
        if no is None:
            no = self.nos.setdefault(base, {"id": base, "nome": _humanizar(base), "tipo": "gatilho", "c": 0, "r": 0,
                                            "arq": self.entrada.arq, "espera": None, "envia": [], "desc": None,
                                            "marcado": False, "_func": self.entrada})
        if not no["espera"]:
            no["espera"] = self.p.espera_da_entrada(self.entrada)
        self.entrada_id = no["id"]
        self.pilha.append(self.entrada)
        self._caminhar(self.entrada.no.body, [(no["id"], None)], self.entrada, 0)
        self.pilha.pop()
        if self.agente:
            self.arestas = [a for a in self.arestas if not (len(a) > 2 and a[2].get("laco"))]

    def _caminhar(self, corpo, fr, ctx, prof):
        for s in corpo:
            fr = self._instrucao(s, fr, ctx, prof)
        return fr

    def _expressoes(self, nos, fr, ctx, prof):
        for no in nos:
            if no is None:
                continue
            for chamada in _chamadas(no):
                fr = self._chamada(chamada, fr, ctx, prof)
        return fr

    def _instrucao(self, s, fr, ctx, prof):
        if isinstance(s, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            return fr
        if isinstance(s, ast.If):
            fr = self._expressoes([s.test], fr, ctx, prof)
            a = self._caminhar(s.body, fr, ctx, prof)
            b = self._caminhar(s.orelse, fr, ctx, prof) if s.orelse else fr
            return self._uniao(a, b)
        if isinstance(s, (ast.For, ast.AsyncFor, ast.While)):
            return self._laco(s, fr, ctx, prof)
        if isinstance(s, ast.Try) or s.__class__.__name__ == "TryStar":
            corpo = self._caminhar(s.body, fr, ctx, prof)
            corpo = self._caminhar(s.orelse, corpo, ctx, prof)
            saida = corpo
            for h in s.handlers:
                saida = self._uniao(saida, self._caminhar(h.body, fr, ctx, prof))
            return self._caminhar(s.finalbody, saida, ctx, prof)
        if isinstance(s, (ast.With, ast.AsyncWith)):
            fr = self._expressoes([i.context_expr for i in s.items], fr, ctx, prof)
            return self._caminhar(s.body, fr, ctx, prof)
        if s.__class__.__name__ == "Match":
            fr = self._expressoes([s.subject], fr, ctx, prof)
            saida = []
            for caso in s.cases:
                saida = self._uniao(saida, self._caminhar(caso.body, fr, ctx, prof))
            return saida
        if isinstance(s, ast.Return):
            self._expressoes([s.value], fr, ctx, prof)
            return []
        if isinstance(s, ast.Raise):
            self._expressoes([s.exc, s.cause], fr, ctx, prof)
            return []
        if isinstance(s, ast.Break):
            if self.laco_pilha:
                self.laco_pilha[-1]["saidas"] = self._uniao(self.laco_pilha[-1]["saidas"], fr)
            return []
        if isinstance(s, ast.Continue):
            if self.laco_pilha:
                self.laco_pilha[-1]["voltas"] = self._uniao(self.laco_pilha[-1]["voltas"], fr)
            return []
        return self._expressoes(list(ast.iter_child_nodes(s)), fr, ctx, prof)

    def _teto_do_laco(self, s, ctx):
        if isinstance(s, (ast.For, ast.AsyncFor)):
            it = s.iter
            if isinstance(it, ast.Call) and isinstance(it.func, ast.Name) and it.func.id == "range" and it.args:
                return self.p.valor_inteiro(it.args[-1] if len(it.args) < 3 else it.args[1], ctx.caminho)
        elif isinstance(s.test, ast.Compare) and s.test.comparators and isinstance(s.test.ops[0], (ast.Lt, ast.LtE)):
            return self.p.valor_inteiro(s.test.comparators[0], ctx.caminho)
        return None

    def _laco(self, s, fr, ctx, prof):
        fr = self._expressoes([s.iter if not isinstance(s, ast.While) else s.test], fr, ctx, prof)
        teto = self._teto_do_laco(s, ctx)
        laco = {"passos": [], "saidas": [], "voltas": []}
        self.laco_pilha.append(laco)
        fim = self._caminhar(s.body, fr, ctx, prof)
        self.laco_pilha.pop()
        passos = laco["passos"]
        if passos and any(self.nos[i]["tipo"] == "llm" for i in passos):
            rotulo = "volta · até %d voltas" % teto if teto else "volta"
            for origem, _ in self._uniao(fim, laco["voltas"]):
                self._aresta(origem, passos[0], {"laco": 1, "rot": rotulo})
            if teto:
                fim = [(i, {"rot": "teto"}) for i, _ in fim]
                if self.teto is None:
                    self.teto = teto
        return self._uniao(fim, laco["saidas"])

    # ---------------------------------------------------------- chamadas

    def _chamada(self, chamada, fr, ctx, prof):
        alvo = chamada.func
        nome = alvo.id if isinstance(alvo, ast.Name) else alvo.attr if isinstance(alvo, ast.Attribute) else ""
        if nome == "marcar":
            return fr
        tabela = self._despacho(chamada, ctx)
        if tabela is not None:
            self._registrar_despacho(tabela)
            return fr
        func = self.p.resolver_chamada(chamada, ctx)
        if func is not None:
            return self._usar_funcao(func, fr, ctx, prof)
        if nome in REGISTROS_DE_FUNCAO or nome in ("Thread", "Timer"):
            candidatos = list(chamada.args) + [p.value for p in chamada.keywords if p.arg in ("target", "function")]
            for candidato in candidatos:
                if isinstance(candidato, (ast.Name, ast.Attribute)):
                    referida = self.p.resolver(candidato, ctx.caminho, ctx.classe)
                    if referida is not None:
                        fr = self._usar_funcao(referida, fr, ctx, prof)
        tipo = _tipo_da_chamada(chamada)
        if tipo in NOMES_LEGIVEIS:
            no = self._criar_no(tipo, NOMES_LEGIVEIS[tipo], tipo, "%s:%d" % (ctx.caminho, chamada.lineno), None)
            if no is not None:
                fr = self._novo_passo(no, fr)
        return fr

    def _novo_passo(self, no, fr):
        self._ligar(fr, no["id"])
        for laco in self.laco_pilha:
            laco["passos"].append(no["id"])
        return [(no["id"], None)]

    def _usar_funcao(self, func, fr, ctx, prof):
        if func is self.entrada or func in self.pilha:
            return fr
        if func in self.entradas:
            origem = fr[0][0] if fr else self.entrada_id
            self.cruzar.append((origem, func))
            return fr
        if self._deve_expandir(func, prof):
            self.pilha.append(func)
            fr = self._caminhar(func.no.body, fr, func, prof + 1)
            self.pilha.pop()
            return fr
        base = self._id_do_ponto(func)
        tipo = self.p.tipo_da_funcao(func, self.id, self.entradas)
        no = self._criar_no(base, _humanizar(base), tipo, func.arq, func)
        return fr if no is None else self._novo_passo(no, fr)

    def _deve_expandir(self, func, prof):
        if prof >= PROFUNDIDADE_MAXIMA or func in self.pilha or func in self.entradas:
            return False
        if self.p.marca_do_fluxo(func, self.id) or self.p.tem_assinatura_direta(func):
            return False
        if self.correcoes.get(func.nome):
            return False
        de_projeto = sum(1 for c in self.p.chamadas_de(func)
                         if self.p.resolver_chamada(c, func) is not None
                         and (c.func.attr if isinstance(c.func, ast.Attribute) else getattr(c.func, "id", "")) != "marcar")
        return de_projeto >= 2

    # ---------------------------------------------------------- despacho (agente)

    def _despacho(self, chamada, ctx):
        f = chamada.func
        nome = None
        if isinstance(f, ast.Subscript) and isinstance(f.value, ast.Name):
            nome = f.value.id
        elif isinstance(f, ast.Call) and isinstance(f.func, ast.Attribute) and f.func.attr == "get" \
                and isinstance(f.func.value, ast.Name):
            nome = f.func.value.id
        elif isinstance(f, ast.Call) and isinstance(f.func, ast.Name) and f.func.id == "getattr" and f.args:
            base = _texto(f.args[0])
            imp = self.p.imports.get(ctx.caminho, {"mod": {}})["mod"]
            if base in imp:
                achadas = []
                for caminho in self.p._arquivos_do_modulo(imp[base]):
                    achadas += [x for x in self.p.por_arquivo.get(caminho, [])
                                if x.classe is None and not x.nome.startswith("_")]
                return achadas[:12] or None
            return None
        if nome is None:
            return None
        funcs = self.p.tabela_de_funcoes(nome, ctx.caminho)
        return funcs or None

    def _registrar_despacho(self, funcs):
        if not self.laco_pilha:
            return
        llm = next((i for i in reversed(self.laco_pilha[-1]["passos"]) if self.nos[i]["tipo"] == "llm"), None)
        if llm is None:
            return
        self.agente = True
        for func in funcs:
            existente = self.por_func.get(func)
            if existente is None:
                base = self._id_do_ponto(func)
                no = self._criar_no(base, _humanizar(base), "ferramenta", func.arq, func)
                if no is None:
                    continue
                existente = no["id"]
            self._aresta(llm, existente, {"bi": 1})

    # ---------------------------------------------------------- fechamento

    def _literais_escritos(self, func):
        achados = []
        for chamada in self.p.chamadas_de(func):
            alvo = chamada.func
            nome = alvo.attr if isinstance(alvo, ast.Attribute) else getattr(alvo, "id", "")
            texto = _texto(alvo)
            literal = None
            if nome == "open" and chamada.args:
                modo = _literal(chamada.args[1]) if len(chamada.args) > 1 else _literal(
                    next((p.value for p in chamada.keywords if p.arg == "mode"), None))
                if isinstance(modo, str) and any(c in modo for c in "wax+"):
                    literal = _literal(chamada.args[0])
            elif nome in ("write_text", "write_bytes") and isinstance(alvo, ast.Attribute):
                dono = alvo.value
                if isinstance(dono, ast.Constant):
                    literal = dono.value
                elif isinstance(dono, ast.Call) and _texto(dono.func).split(".")[-1] == "Path" and dono.args:
                    literal = _literal(dono.args[0])
            elif texto in ("os.replace", "os.rename") and len(chamada.args) > 1:
                literal = _literal(chamada.args[1])
            if isinstance(literal, str) and literal not in achados:
                achados.append(literal)
        return achados

    def _alcance(self, func, limite=3):
        """A função e as de projeto que ela chama, até `limite` níveis (sem entrar em entradas de fluxo)."""
        vistos, fila = {func}, [(func, 0)]
        for atual, nivel in fila:
            if nivel >= limite:
                continue
            for chamada in self.p.chamadas_de(atual):
                alvo = self.p.resolver_chamada(chamada, atual)
                if alvo is not None and alvo not in vistos and alvo not in self.entradas:
                    vistos.add(alvo)
                    fila.append((alvo, nivel + 1))
        return [f for f, _ in fila]

    def _cruzamentos_dos_passos(self):
        for no in list(self.nos.values()):
            func = no["_func"]
            if func is None or func is self.entrada:
                continue
            vistos, fila = {func}, [(func, 0)]
            for atual, nivel in fila:
                for chamada in self.p.chamadas_de(atual):
                    alvo = self.p.resolver_chamada(chamada, atual)
                    if alvo is None:
                        continue
                    if alvo in self.entradas and alvo is not self.entrada:
                        self.cruzar.append((no["id"], alvo))
                    elif alvo not in vistos and nivel < 3 and alvo not in self.entradas:
                        vistos.add(alvo)
                        fila.append((alvo, nivel + 1))

    def fechar(self):
        self._cruzamentos_dos_passos()
        # layout: coluna = maior caminho desde a entrada, sem contar arestas de laço
        entrantes = {}
        for a in self.arestas:
            if not (len(a) > 2 and a[2].get("laco")):
                entrantes.setdefault(a[1], []).append(a[0])
        colunas = {}
        contagem = {}
        for id_, no in self.nos.items():
            preds = [p for p in entrantes.get(id_, []) if p in colunas]
            colunas[id_] = (max(colunas[p] for p in preds) + 1) if preds else (0 if id_ == self.entrada_id else 1)
            no["c"] = colunas[id_]
            no["r"] = contagem.get(no["c"], 0)
            contagem[no["c"]] = no["r"] + 1
        # espera dos pontos que esperam
        for no in self.nos.values():
            func = no["_func"]
            if no["espera"] or no["id"] == self.entrada_id:
                continue
            if no["tipo"] == "humano":
                no["espera"] = "resposta do usuário"
            elif no["tipo"] == "fila":
                no["espera"] = "vaga na fila"
            elif no["tipo"] == "barreira" and func is not None and "timeout" in _texto(func.no).lower():
                no["espera"] = "limite de tempo (timeout)"
        # o que cada ponto envia: arquivos escritos
        for no in self.nos.values():
            func = no["_func"]
            if func is None:
                continue
            fontes = [func] if no["id"] == self.entrada_id else self._alcance(func)
            for f in fontes:
                for literal in self._literais_escritos(f):
                    if literal not in no["envia"]:
                        no["envia"].append(literal)

    def tipo_do_fluxo(self):
        corr = self.correcoes.get("_fluxo", {})
        if corr.get("tipo") in ("tiro", "cadeia", "ciclo", "agente"):
            return corr["tipo"]
        if self.agente:
            return "agente"
        if any(len(a) > 2 and a[2].get("laco") for a in self.arestas):
            return "ciclo"
        tipos = [n["tipo"] for n in self.nos.values()]
        if tipos.count("llm") == 1 and "embedding" not in tipos:
            return "tiro"
        return "cadeia"


def _gat_do_fluxo(fluxo, espera):
    corr = fluxo.correcoes.get("_fluxo", {})
    if corr.get("gat") in ("evento", "agenda", "usuário"):
        return corr["gat"]
    espera = espera or ""
    if espera.startswith("agenda"):
        return "agenda"
    if espera.startswith("mensagem"):
        return "usuário"
    return "evento"


# ------------------------------------------------------------------ interface pública

def _montar_tudo(raiz):
    projeto = _Projeto(raiz)
    descricoes = projeto.ler_descricoes()
    achados = []
    for descricao in descricoes:
        entrada = projeto.achar_entrada(descricao["entrada"])
        if entrada is None:
            projeto.avisos.append("Fluxo %s: entrada não encontrada (%s)" % (descricao["fluxo"], descricao["entrada"]))
            continue
        achados.append((descricao, entrada))
    entradas = {e for _, e in achados}
    fluxos = [_Fluxo(projeto, d, e, entradas) for d, e in achados]
    for fluxo in fluxos:
        fluxo.montar()
    return projeto, fluxos


def analisar(raiz=RAIZ_DO_PROJETO):
    """O objeto do contrato C5 (sem `rastro` e `janela`, que quem serve preenche)."""
    projeto, fluxos = _montar_tudo(raiz)
    for fluxo in fluxos:
        fluxo.fechar()
    por_entrada = {f.entrada: f for f in fluxos}
    nomes = {f.id: f.correcoes.get("_fluxo", {}).get("nome") or _humanizar(f.id) for f in fluxos}
    saida_fluxos, cruzamentos, vistos = [], [], set()
    for fluxo in fluxos:
        tipo = fluxo.tipo_do_fluxo()
        for origem, alvo in fluxo.cruzar:
            destino = por_entrada.get(alvo)
            if destino is None or destino is fluxo or (fluxo.id, origem, destino.id) in vistos:
                continue
            vistos.add((fluxo.id, origem, destino.id))
            cruzamentos.append({"de": [fluxo.id, origem], "para": [destino.id, destino.entrada_id],
                                "rot": "chama" if tipo == "agente" else "dispara"})
            texto = "fluxo «%s»" % nomes[destino.id]
            if texto not in fluxo.nos[origem]["envia"]:
                fluxo.nos[origem]["envia"].append(texto)
        corr = fluxo.correcoes.get("_fluxo", {})
        entrada_no = fluxo.nos[fluxo.entrada_id]
        nos = []
        for no in fluxo.nos.values():
            limpo = {k: v for k, v in no.items() if not k.startswith("_")}
            nos.append(limpo)
        saida_fluxos.append({
            "id": fluxo.id, "nome": nomes[fluxo.id], "tipo": tipo,
            "gat": _gat_do_fluxo(fluxo, entrada_no["espera"]),
            "teto": corr.get("teto") if isinstance(corr.get("teto"), int) else fluxo.teto,
            "resumo": fluxo.desc.get("descricao") or "", "arq": fluxo.entrada.arq,
            "nos": nos, "arestas": fluxo.arestas})
    return {"projeto": Path(raiz).resolve().name, "rastro": "", "janela": None,
            "avisos": projeto.avisos, "fluxos": saida_fluxos, "cruzamentos": cruzamentos}


def candidatos(raiz=RAIZ_DO_PROJETO):
    projeto = _Projeto(raiz)
    linhas = []
    for func in projeto.funcs:
        motivos = []
        gatilho = projeto.parece_gatilho(func)
        if gatilho:
            motivos.append(gatilho)
        if projeto.chama_modelo(func):
            motivos.append("chama um modelo")
        if motivos:
            linhas.append((func.caminho, func.linha, "%s:%d  %s  (%s)" % (func.caminho, func.linha, func.nome, "; ".join(motivos))))
    return [t for _, _, t in sorted(linhas)]


def conferir(raiz=RAIZ_DO_PROJETO):
    projeto, fluxos = _montar_tudo(raiz)
    for fluxo in fluxos:
        fluxo.fechar()
    desenhados = {f.id: f for f in fluxos}
    saida = {"marcas_sem_ponto": [], "pontos_sem_marca": [], "modelo_fora_de_fluxo": [], "fluxos_sem_descricao": []}
    sem_desenho = set()
    for marca in projeto.marcas:
        fluxo = desenhados.get(marca["fluxo"])
        local = "%s:%d" % (marca["caminho"], marca["linha"])
        if fluxo is None:
            if marca["fluxo"] not in sem_desenho:
                sem_desenho.add(marca["fluxo"])
                saida["fluxos_sem_descricao"].append(
                    "%s fluxo %s — tem marcas no código, mas nenhuma descrição com esse id (ou a entrada não foi achada)" % (local, marca["fluxo"]))
        elif not any(n["id"] == marca["ponto"] or n["id"].startswith(marca["ponto"] + "_") for n in fluxo.nos.values()):
            saida["marcas_sem_ponto"].append(
                "%s %s — a marca aponta o ponto «%s» do fluxo %s, que não existe no desenho" % (local, marca["ponto"], marca["ponto"], marca["fluxo"]))
    for fluxo in fluxos:
        for no in fluxo.nos.values():
            if not no["marcado"]:
                saida["pontos_sem_marca"].append(
                    "%s %s — ponto do fluxo %s sem marca: os Logs não mostram quando ele roda" % (no["arq"], no["id"], fluxo.id))
    alcancadas = set()
    for fluxo in fluxos:
        for no in fluxo.nos.values():
            if no["_func"] is not None:
                fila = [no["_func"]]
                for atual in fila:
                    if atual in alcancadas:
                        continue
                    alcancadas.add(atual)
                    for chamada in projeto.chamadas_de(atual):
                        alvo = projeto.resolver_chamada(chamada, atual)
                        if alvo is not None and alvo not in alcancadas:
                            fila.append(alvo)
    for func in projeto.funcs:
        if func not in alcancadas and projeto.chama_modelo(func):
            saida["modelo_fora_de_fluxo"].append(
                "%s %s — chama um modelo e nenhum fluxo descrito chega até aqui" % (func.arq, func.nome))
    entradas = {f.entrada for f in fluxos}
    for func in projeto.funcs:
        if func not in entradas and projeto.parece_gatilho(func) and func not in alcancadas:
            saida["fluxos_sem_descricao"].append(
                "%s %s — parece começar um fluxo (%s) e nenhuma descrição aponta para ele" % (func.arq, func.nome, projeto.parece_gatilho(func)))
    return saida


def _principal():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Lê o código do projeto e monta o desenho dos fluxos (só lê).")
    grupo = parser.add_mutually_exclusive_group()
    grupo.add_argument("--json", action="store_true", help="imprime o desenho completo")
    grupo.add_argument("--candidatos", action="store_true", help="lista onde um fluxo provavelmente começa")
    grupo.add_argument("--conferir", action="store_true", help="lista o que as marcas e as descrições deixaram torto")
    parser.add_argument("--raiz", default=str(RAIZ_DO_PROJETO), help="raiz do projeto (padrão: a do arquivo)")
    argumentos = parser.parse_args()
    if argumentos.candidatos:
        print("\n".join(candidatos(argumentos.raiz)))
    elif argumentos.conferir:
        print(json.dumps(conferir(argumentos.raiz), ensure_ascii=False, indent=2))
    else:
        print(json.dumps(analisar(argumentos.raiz), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    _principal()
