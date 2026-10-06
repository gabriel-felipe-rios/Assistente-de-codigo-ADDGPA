"""Formato garantido — a resposta do modelo em JSON Schema, e a conferência de
que ela terminou.

O LM Studio (via llama.cpp) aceita `response_format` com um JSON Schema e
*obriga* o modelo a produzir JSON válido — some a categoria de bug "campo
obrigatório ausente" e a rodada de correção deixa de ser necessária.

A adoção é **defensiva**: se o LM Studio ou o modelo carregado não suportarem
`response_format`, `chat_json` cai para a chamada normal e o fluxo antigo
(parse tolerante + Resgate da resposta) continua valendo como rede. Nada quebra
em ambiente sem suporte — mas a tela FICA SABENDO, por
`formato_garantido_indisponivel()`, e cada rotina mostra o aviso na aba Erros.

Os schemas ficam em `.json` irmãos de cada prompt — em `prompts/Rotinas/` para
as seis rotinas de documentação (`carregar_schema`) e em `prompts/Assistente/`
para a Fila (`carregar_schema_do_assistente`). A regra da AMF §6.11 é a mesma
nos dois: o esquema é sempre `.json`, com nome idêntico ao do prompt.

⚠️ **Nunca uma chamada a mais.** Restrição do projeto desde a primeira rodada
da discussão: nada aqui retenta, e nada aqui abre rodada de correção nova. Uma
resposta cortada vira erro na tela — não uma segunda chamada.
"""

import os
import json

from ..caminhos import obter_prompt_de_rotina, obter_prompt_do_assistente

try:
    from openai import BadRequestError as _BadRequestError
except Exception:  # SDK antigo / ausente
    _BadRequestError = Exception

# Erros que PODEM indicar "parâmetro não suportado".
# Timeouts / erros de conexão NÃO entram aqui: devem propagar como antes.
_RF_ERRORS = (_BadRequestError, TypeError, ValueError)

# 🔴 Um 400 do LM Studio quer dizer duas coisas MUITO diferentes, e tratá-las
# como uma só custou caro: numa passada de 332 arquivos, o modelo escorregou
# da gramática em UM deles e o programa desligou a garantia de formato para
# os outros 331, com um aviso só no fim.
#
#   · o servidor não aceita o PARÂMETRO `response_format` — é propriedade
#     dele, não muda no meio da sessão, e aí desligar de vez está certo;
#   · o modelo NÃO CONSEGUIU obedecer à gramática naquela geração — é o caso
#     documentado de o pensamento atrapalhar a restrição. É por arquivo, e o
#     próximo pode sair perfeito.
#
# O segundo caso vira erro DAQUELE arquivo, na aba Erros, sem segunda chamada
# (a regra do projeto é clara: nunca uma chamada a mais ao modelo).
_MARCAS_DE_GRAMATICA = (
    'does not match the expected',   # "...the expected peg-native format"
    'peg-native',
    'grammar',
    'predict stream returned an error',
)


def _falha_de_gramatica(erro):
    """O modelo escorregou nesta geração, ou o servidor não sabe o parâmetro?"""
    texto = str(erro).lower()
    return any(marca in texto for marca in _MARCAS_DE_GRAMATICA)


# Uma vez que o servidor rejeite o PARÂMETRO, paramos de tentar nesta sessão
# (evita pagar duas chamadas por requisição num backend sem suporte).
_RF_SUPPORTED = [True]
_RF_MOTIVO = ['']

_SCHEMA_CACHE = {}


# ── Os dois modos de a resposta não servir ───────────────────────────────────

class RespostaCortada(RuntimeError):
    """A resposta bateu no teto de saída e veio pela metade.

    É a causa apurada dos arquivos estragados: nenhuma das seis rotinas
    perguntava se a resposta tinha terminado — todas passavam `max_tokens` e
    gravavam o que voltasse. Um `.md` que acaba no meio de uma frase é isso.

    Levantada, e nunca engolida: quem chama transforma em entrada da aba
    **Erros** da rotina, e o `.md` anterior fica intacto. Não gravar é o ponto.
    """


class RespostaInvalida(RuntimeError):
    """Veio texto onde devia vir JSON.

    Só acontece com o Formato garantido desligado — com o esquema ligado o
    servidor não deixa o modelo sair do formato.
    """


class FormatoNaoObedecido(RuntimeError):
    """O modelo não conseguiu obedecer à gramática NESTA geração.

    É falha de um arquivo, não do servidor: o próximo pode sair perfeito. Vai
    para a aba Erros da rotina como qualquer outro arquivo que falhou, e o
    `.md` anterior fica intacto — sem segunda chamada ao modelo.
    """


MOTIVO_CORTADA = ('resposta cortada por falta de orçamento — aumente o teto de '
                  'saída em Configurações › Modelo e contexto')
MOTIVO_REPETICAO = ('o modelo entrou em repetição — escreveu {teto} tokens para um '
                    'arquivo de ~{arquivo} tokens e não fechou a resposta. Aumentar '
                    'o teto não resolve; se acontecer em vários arquivos, veja '
                    'Configurações › Rotinas da Automação › Tamanho das respostas')
# O mesmo diagnóstico sem o tamanho do arquivo: o Resumo de Pastas manda várias
# fichas numa chamada, e "arquivo de ~N tokens" não se aplica.
MOTIVO_REPETICAO_TEXTO = ('o modelo entrou em repetição — ficou repetindo o mesmo '
                          'trecho até o teto de saída. Aumentar o teto não resolve')

# Abaixo disto o fim da resposta é quase só o mesmo trecho repetido: zlib
# comprime o final de uma resposta normal para ~1/3, e as duas repetições
# vistas em 24/09/2026 (Resumo de Pastas) ficaram em 0,015 e 0,10.
_REPETICAO_RAZAO = 0.12


def _parece_repeticao(texto):
    """O fim da resposta é o mesmo trecho repetido? (compressão do final)"""
    import zlib
    fim = (texto or '')[-4000:].encode('utf-8', 'replace')
    if len(fim) < 1500:
        return False
    return len(zlib.compress(fim)) / len(fim) < _REPETICAO_RAZAO


# ── Os esquemas ──────────────────────────────────────────────────────────────

def carregar_schema(nome_do_arquivo):
    """Carrega um JSON Schema de `prompts/Rotinas/` (com cache). None se faltar.

    Faltar não é erro: sem esquema, `chat_json` faz a chamada normal e a rotina
    segue no modo antigo. O que muda é só a garantia.
    """
    if nome_do_arquivo in _SCHEMA_CACHE:
        return _SCHEMA_CACHE[nome_do_arquivo]
    schema = None
    try:
        with open(obter_prompt_de_rotina(nome_do_arquivo), 'r', encoding='utf-8') as f:
            schema = json.load(f)
    except Exception:
        schema = None
    _SCHEMA_CACHE[nome_do_arquivo] = schema
    return schema


def carregar_schema_do_assistente(*partes):
    """O irmão de `carregar_schema`, para os esquemas de `prompts/Assistente/`.

    Existe porque `obter_prompt_de_rotina` só alcança `prompts/Rotinas/`, e o
    esquema da Fila é irmão do prompt DELA — a AMF §6.11 manda que o `.json`
    fique ao lado do `.txt` de mesmo nome, e pôr o da Fila em `Rotinas/` seria
    escondê-lo do lugar onde alguém vai procurá-lo.

    ⚠️ Reusa o MESMO `_SCHEMA_CACHE` de propósito: duas caches para a mesma
    coisa divergem, e a chave aqui é o caminho relativo inteiro
    ("Fila/system-prompt.json"), que não colide com os nomes soltos das rotinas.

    Faltar não é erro, igual à função irmã: sem esquema, `chat_json` faz a
    chamada normal e o fluxo antigo continua valendo como rede.
    """
    chave = '/'.join(partes)
    if chave in _SCHEMA_CACHE:
        return _SCHEMA_CACHE[chave]
    schema = None
    try:
        with open(obter_prompt_do_assistente(*partes), 'r', encoding='utf-8') as f:
            schema = json.load(f)
    except Exception:
        schema = None
    _SCHEMA_CACHE[chave] = schema
    return schema


def _response_format(schema, name):
    return {
        'type': 'json_schema',
        'json_schema': {'name': name, 'schema': schema, 'strict': True},
    }


def formato_garantido_indisponivel():
    """O motivo de o Formato garantido estar desligado, ou `''` se está ligado.

    Existe porque há caso documentado em que, **com o pensamento ligado, a
    gramática não é aplicada** e o modelo gera solto. Quando isso acontece o
    usuário precisa saber — senão a rotina volta a produzir lixo silenciosamente,
    que é exatamente o estado de onde esta obra partiu.

    ⚠️ Só responde pelo caso do SERVIDOR sem suporte ao parâmetro. Escorregão
    de gramática num arquivo é `FormatoNaoObedecido`, e aparece na aba Erros
    ao lado do nome do arquivo — não como um aviso geral que apagaria a
    diferença entre 'um arquivo falhou' e 'a garantia caiu para todos'.
    """
    if _RF_SUPPORTED[0]:
        return ''
    return _RF_MOTIVO[0] or 'o servidor recusou o esquema de saída'


def chat_json(client, model, messages, schema=None, timeout=None, name='resposta', **extra):
    """Como `client.chat.completions.create(stream=False)`, mas força JSON válido
    quando `schema` é dado e o servidor suporta. Sem suporte, cai no modo normal.

    Retorna o objeto de resposta do SDK — use `json_da_resposta` para extrair.
    """
    kwargs = {'model': model, 'messages': messages, 'stream': False}
    kwargs.update(extra)
    if timeout is not None:
        kwargs['timeout'] = timeout

    if schema and _RF_SUPPORTED[0]:
        try:
            return client.chat.completions.create(
                response_format=_response_format(schema, name), **kwargs)
        except _RF_ERRORS as e:
            if _falha_de_gramatica(e):
                # Escorregão do modelo NESTE arquivo. Não desliga nada para os
                # outros, e não tenta de novo: vira erro deste arquivo.
                raise FormatoNaoObedecido(
                    'o modelo não conseguiu obedecer ao formato exigido nesta '
                    'resposta — o arquivo ficou sem gerar, e os outros seguem '
                    'com a garantia ligada')
            # Servidor sem suporte a `response_format` → desliga e segue no modo
            # normal. O motivo fica guardado para a aba Erros mostrar.
            _RF_SUPPORTED[0] = False
            _RF_MOTIVO[0] = str(e)[:300] or 'o servidor recusou o esquema de saída'

    return client.chat.completions.create(**kwargs)


# ── A conferência: a resposta terminou? ──────────────────────────────────────

def conferir_terminou(resp, teto_usado=None, teto_configurado=None, tokens_do_arquivo=None):
    """Levanta `RespostaCortada` se o modelo parou por falta de orçamento.

    O `finish_reason` é lido em UM lugar do programa hoje — o Designer, que já
    faz o certo. Esta função é esse mesmo cuidado, agora disponível para as seis
    rotinas.

    `'length'` é o único valor que significa "não terminou". `'stop'` é fim
    normal; `None` é servidor que não informa, e aí não dá para afirmar nada —
    seguir é melhor que recusar uma resposta boa.

    Dois cortes, duas mensagens (D7): bater no teto PROPORCIONAL quer dizer que o
    modelo escreveu muito mais do que o arquivo pede — repetição; bater no teto
    de Configurações é falta de teto — a não ser que o próprio texto mostre a
    repetição (`_parece_repeticao`). Sem essa conferência, o Resumo de Pastas
    dizia "aumente o teto" para um modelo que repetia a mesma linha até o fim.
    """
    try:
        escolha = resp.choices[0]
    except (AttributeError, IndexError, TypeError):
        return
    if getattr(escolha, 'finish_reason', None) == 'length':
        if teto_usado and teto_configurado and teto_usado < teto_configurado:
            raise RespostaCortada(MOTIVO_REPETICAO.format(
                teto=teto_usado, arquivo=tokens_do_arquivo))
        texto = getattr(getattr(escolha, 'message', None), 'content', None)
        if _parece_repeticao(texto):
            raise RespostaCortada(MOTIVO_REPETICAO_TEXTO)
        raise RespostaCortada(MOTIVO_CORTADA)


def json_da_resposta(resp, resgate=True, teto_usado=None, teto_configurado=None,
                     tokens_do_arquivo=None):
    """O dicionário que o modelo devolveu, conferindo antes se ele terminou.

    A ordem importa: `conferir_terminou` PRIMEIRO. JSON cortado ao meio também
    falharia no `json.loads`, mas com a mensagem errada — "esperava `}`" em vez
    de "faltou orçamento", que é o que o usuário precisa ler para saber o que
    fazer.

    `resgate=False` (o interruptor "Resgate da resposta" desligado) aceita só o
    que já vem limpo: texto com raciocínio em volta vira `RespostaInvalida` e
    aparece na aba Erros, em vez de o programa tentar adivinhar onde a resposta
    começa.
    """
    conferir_terminou(resp, teto_usado, teto_configurado, tokens_do_arquivo)
    try:
        bruto = resp.choices[0].message.content or ''
    except (AttributeError, IndexError, TypeError):
        raise RespostaInvalida('o servidor não devolveu conteúdo')

    # Com o esquema ligado o texto já é JSON puro — este é o caminho normal.
    try:
        return json.loads(bruto.strip())
    except Exception:
        pass

    if not resgate:
        raise RespostaInvalida(
            'a resposta não é um JSON válido, e o Resgate da resposta está '
            'desligado em Configurações › Modelo e contexto')

    return _resgatar_json(bruto)


def _resgatar_json(bruto):
    """O Resgate da resposta aplicado a JSON: fica com o ÚLTIMO objeto válido.

    ⚠️ O ÚLTIMO, e não o primeiro — é a mesma regra do `resgate_da_resposta` em
    `texto_llm.py`, e pelo mesmo motivo: o modelo rascunha o formato dentro do
    próprio raciocínio e entrega as duas versões grudadas. Pegar o primeiro `{`
    entrega o rascunho, que foi exatamente o defeito que esta obra existe para
    consertar.
    """
    from .texto_llm import strip_thinking

    texto = strip_thinking(bruto).strip()
    try:
        return json.loads(texto)
    except Exception:
        pass

    fim = texto.rfind('}')
    if fim != -1:
        # Varre os `{` do mais TARDIO para o mais cedo: o primeiro que fecha um
        # objeto válido é a entrega final do modelo.
        pos = texto.rfind('{', 0, fim)
        while pos != -1:
            try:
                return json.loads(texto[pos:fim + 1])
            except Exception:
                pos = texto.rfind('{', 0, pos)
    raise RespostaInvalida('a resposta não é um JSON válido')


# ── As duas mensagens e as travas de tamanho ─────────────────────────────────

def mensagens_da_rotina(prompt, blocos):
    """O envelope da D2: o prompt sozinho no `system`, o conteúdo uma vez só no
    `user`, cada pedaço com o rótulo da casa `[TIPO — nome]`. O prompt é quem
    diz ao modelo que tudo ali é dado.

    `blocos` é uma lista de `(tipo, nome, texto)`.
    """
    corpo = '\n\n'.join('[%s — %s]\n%s' % (tipo, nome, texto)
                        for tipo, nome, texto in blocos)
    return [{'role': 'system', 'content': prompt},
            {'role': 'user', 'content': corpo}]


def teto_de_saida_da_chamada(limites, tokens_do_arquivo=None):
    """O `max_tokens` de uma chamada: o teto de Configurações, ou — quando se
    sabe o tamanho do arquivo — o menor entre ele e `base + fator × arquivo`.

    Um arquivo de 82 linhas não pode gastar 12 000 tokens de resposta: quem
    chega lá entrou em repetição, e cortar cedo é o que dá a mensagem certa
    (`MOTIVO_REPETICAO`).
    """
    teto = int(limites['teto_saida'])
    if tokens_do_arquivo is None:
        return teto
    proporcional = int(limites['teto_proporcional_base']
                       + limites['teto_proporcional_fator'] * tokens_do_arquivo)
    return max(1, min(teto, proporcional))


def schema_com_limites(schema, limites):
    """Cópia do esquema com os tetos de "Tamanho das respostas" aplicados.

    `sintese`/`explicacao` → `limite_sintese_chars`; as listas `atribuicoes`,
    `tags` e `termos` → o teto de itens de cada uma; toda outra string sem
    `enum` → `limite_texto_chars`. A lista `frases` NÃO ganha `maxItems`: é uma
    entrada por símbolo, e o arquivo pode ter cem.

    ⚠️ Os tetos de itens são a rede de segurança ALTA (30, 15, 30), nunca um
    limite baixo que molde a resposta (P2). Esquema `None` devolve `None`.
    """
    if schema is None:
        return None
    import copy
    schema = copy.deepcopy(schema)
    itens_por_lista = {
        'atribuicoes': int(limites['limite_atribuicoes']),
        'tags': int(limites['limite_tags']),
        'termos': int(limites['limite_termos_por_arquivo']),
    }
    sintese = int(limites['limite_sintese_chars'])
    texto = int(limites['limite_texto_chars'])

    def aplicar(no, nome=None):
        if not isinstance(no, dict):
            return
        tipo = no.get('type')
        tipos = tipo if isinstance(tipo, list) else [tipo]
        if 'string' in tipos and 'enum' not in no:
            no['maxLength'] = sintese if nome in ('sintese', 'explicacao') else texto
        if 'array' in tipos:
            if nome in itens_por_lista:
                no['maxItems'] = itens_por_lista[nome]
            aplicar(no.get('items'), None)
        for filho, sub in (no.get('properties') or {}).items():
            aplicar(sub, filho)

    aplicar(schema)
    return schema


# ── Arquivo vazio: o caso que não precisa de modelo ──────────────────────────

def arquivo_esta_vazio(conteudo):
    """Vazio de verdade — nada além de espaço em branco.

    ⚠️ Arquivo **só com comentários NÃO é vazio**, e a distinção é do projeto:
    aqui um prompt É um arquivo só de texto, e um bloco de comentário pode ser
    conteúdo usado na interface. Esses arquivos precisam de
    documentação técnica como qualquer outro. O que se economiza aqui é só a
    chamada para um arquivo de zero byte, que não tem o que descrever.
    """
    return not (conteudo or '').strip()


# ── Retentativa da falha passageira (D4) ─────────────────────────────────────

try:
    from openai import APIConnectionError as _FalhaPassageira
except Exception:  # SDK antigo / ausente
    _FalhaPassageira = ConnectionError

# As esperas antes de cada tentativa extra, em segundos — crescem. Duas
# esperas = duas tentativas extras (D4).
ESPERAS_DA_RETENTATIVA = (8, 16)


def com_retentativa(chamada, avisar=None, parado=None, esperas=ESPERAS_DA_RETENTATIVA):
    """Chama `chamada()` e, se ela cair por falha PASSAGEIRA — tempo esgotado
    ou conexão (`APIConnectionError`, que inclui o `APITimeoutError`) —, tenta
    de novo no mesmo ciclo, esperando cada vez mais. Esgotou, levanta o último
    erro, e quem chamou o põe na aba Erros como antes.

    `avisar(tentativa, total, espera)` diz à tela em que tentativa está:
    `espera` em segundos enquanto aguarda, `None` quando a tentativa começa.
    `parado()` é a parada do projeto: fechar a aba fecha o cliente do LM
    Studio, a requisição em voo cai por CONEXÃO — e tentar de novo seria
    teimar contra o usuário. Parado, levanta na hora.

    ⚠️ Resposta cortada, formato não obedecido e JSON inválido NÃO passam por
    aqui: não são passageiros, e repetir daria o mesmo.
    ⚠️ Quem usa isto abre o cliente com `max_retries=0`: o SDK já repete
    sozinho, em silêncio, e cada «tentativa» da tela esconderia três.
    """
    import time
    total = len(esperas) + 1
    for n in range(1, total + 1):
        try:
            return chamada()
        except _FalhaPassageira:
            if n == total or (parado and parado()):
                raise
            espera = esperas[n - 1]
            if avisar:
                avisar(n + 1, total, espera)
            for _ in range(espera):
                if parado and parado():
                    raise
                time.sleep(1)
            if avisar:
                avisar(n + 1, total, None)
