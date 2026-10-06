"""Como a resposta é CORTADA e SERVIDA: os tetos, os limites e as partes.

Uma pergunta só: **cabe na janela de quem perguntou?** Quem sabe onde os dados
moram e o que o usuário tirou do escopo é `leitura_dados.py`. Os dois são
reexportados por `leitura.py`, então todo handler continua chamando `L.cortar` e
`L.servir_partes` como se fosse um arquivo só.

⛔ **NÃO IMPORTA NADA DO PROGRAMA**, pela mesma razão do resto deste servidor —
e este arquivo não importa nem o irmão: ele é puro texto entrando e saindo.

⚠️ `contar_tokens` é uma ESTIMATIVA quando o `tiktoken` não está instalado. O
programa tem a mesma queda, com a mesma constante. Precisão de ±10% basta: o uso
é "não estourar a janela", não auditoria de custo.

⚠️ **ARTEFATO GRANDE NÃO É CORTADO: é servido em PARTES COM NOME.** Cortar um
índice de navegação ao meio daria ao modelo uma árvore que ele acha completa. E
o casamento do nome é TOLERANTE de propósito — o nome é um caminho longo, o
modelo vai errar de digitação, e devolver "não existe" para `modulos/agentes`
quando a parte é `Program/Code/backend/modulos/agentes` só gasta uma rodada.
"""

import json
import unicodedata


# ══════════════════════════════════════════════════════════ Os cortes ══

# Estimativa quando falta o `tiktoken`. Código é mais denso que prosa:
# ~3,5 chars/token. Mesma constante do programa.
CHARS_POR_TOKEN = 3.5

_ENCODER = None
_ENCODER_TENTADO = False


def contar_tokens(texto):
    global _ENCODER, _ENCODER_TENTADO
    if not texto:
        return 0
    if not _ENCODER_TENTADO:
        _ENCODER_TENTADO = True
        try:
            import tiktoken
            _ENCODER = tiktoken.get_encoding('cl100k_base')
        except Exception:
            _ENCODER = None
    if _ENCODER is not None:
        try:
            return len(_ENCODER.encode(texto, disallowed_special=()))
        except Exception:
            pass
    return int(len(texto) / CHARS_POR_TOKEN)


def cortar_em_tokens(texto, teto):
    if _ENCODER is not None:
        try:
            fichas = _ENCODER.encode(texto, disallowed_special=())
            return _ENCODER.decode(fichas[:teto])
        except Exception:
            pass
    return texto[:int(teto * CHARS_POR_TOKEN)]


def cortar(texto, teto):
    """Corta em TOKEN e diz quanto ficou de fora — nunca corta calado.

    ⚠️ O corte mudo é o pior dos dois mundos: quem recebe um pedaço achando que
    é o todo conclui com confiança sobre o que não leu.
    """
    if not texto:
        return texto
    tk = contar_tokens(texto)
    if tk <= teto:
        return texto
    return (cortar_em_tokens(texto, teto)
            + '\n\n(cortado no teto de %d tokens — ficaram de fora %d tokens.)'
              % (teto, tk - teto))


# ── Os limites, em um lugar só ───────────────────────────────────────────────
# ⚠️ SÃO CONSTANTES, e não configuração. Os limites dos dois servidores do
# programa moram em `settings.json` e são lidos pela `Api`; este servidor não
# importa a `Api`, então ler aquele arquivo seria adivinhar o formato dela. Os
# números abaixo são os mesmos padrões de fábrica de lá, copiados uma vez.
TETO_LER_ARQUIVO   = 15000
TETO_PARTE         = 12000
TETO_GLOSSARIO     = 2000
TETO_EXCERTO       = 150
CASCATA_NIVEL      = 3
MAX_CANDIDATOS     = 8
MAX_PARES          = 50
MAX_SIMBOLOS       = 40
MAX_ARQUIVOS_GRANDES = 40
MAX_IO_ARQUIVOS    = 20
MAX_IO_OPERACOES   = 30
MAX_GREP_OCORRENCIAS = 150
MAX_GREP_ARQUIVOS  = 40
MAX_LISTAR_ITENS   = 200
MAX_LISTAR_PRIMEIRO_NIVEL = 40
GREP_CORTE_LINHA   = 200
GREP_MAX_KB        = 500
GREP_BYTES_SNIFF   = 4096


# ══════════════════════════════════════════════ Artefato servido em PARTES ══
#
# ⚠️ ARTEFATO GRANDE NÃO É CORTADO: é servido em partes COM NOME. Cortar um
# índice de navegação ao meio daria ao modelo uma árvore que ele acha completa.

MAX_SUGESTOES = 5
NOME_CABECALHO = '(cabeçalho)'


def normalizar(texto):
    """Forma de comparação: sem acento, sem caixa, sem `\\`, sem `.md`."""
    if not isinstance(texto, str):
        return ''
    t = texto.strip().replace('\\', '/').strip('/')
    if t.lower().endswith('.md'):
        t = t[:-3]
    t = unicodedata.normalize('NFD', t)
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return t.lower()


def dividir_por_cabecalho(texto, prefixo='## '):
    """Um markdown em partes, uma por cabeçalho. Devolve [(nome, corpo)]."""
    partes = []
    nome = NOME_CABECALHO
    buffer = []
    for linha in (texto or '').split('\n'):
        if linha.startswith(prefixo):
            corpo = '\n'.join(buffer).strip()
            if corpo:
                partes.append((nome, corpo))
            nome = linha[len(prefixo):].strip() or '(sem nome)'
            buffer = []
        else:
            buffer.append(linha)
    corpo = '\n'.join(buffer).strip()
    if corpo:
        partes.append((nome, corpo))
    return partes


def dividir_grafo_por_pasta(dados):
    """O grafo de imports em partes, uma por pasta.

    Cada parte leva os nós daquela pasta e as arestas que os tocam — inclusive
    as que saem para outra pasta, que são justamente o que se quer ver ao
    perguntar "quem depende deste módulo".
    """
    nodes = (dados or {}).get('nodes') or []
    edges = (dados or {}).get('edges') or []
    if not isinstance(nodes, list):
        return []
    por_pasta = {}
    pasta_do_no = {}
    for no in nodes:
        ident = (no or {}).get('id') or ''
        pasta = ident.rsplit('/', 1)[0] if '/' in ident else '(raiz)'
        pasta_do_no[ident] = pasta
        por_pasta.setdefault(pasta, {'nodes': [], 'edges': []})['nodes'].append(no)
    for aresta in edges if isinstance(edges, list) else []:
        origem = (aresta or {}).get('source') or ''
        destino = (aresta or {}).get('target') or ''
        for pasta in {pasta_do_no.get(origem), pasta_do_no.get(destino)}:
            if pasta and pasta in por_pasta:
                por_pasta[pasta]['edges'].append(aresta)
    return [(pasta, json.dumps(por_pasta[pasta], ensure_ascii=False, indent=1))
            for pasta in sorted(por_pasta)]


def sugestoes(nomes, alvo, rotulo='Partes', como_ver_todas='chame sem o parâmetro'):
    """Até MAX_SUGESTOES nomes, os mais parecidos primeiro.

    ⚠️ Um erro de nome devolve o CAMINHO DE VOLTA, não o catálogo. Despejar cem
    nomes a cada erro de digitação faz errar sair mais caro que acertar, dentro
    da mesma janela que já está apertada.
    """
    nomes = list(nomes)
    if not nomes:
        return 'Não há nada para listar.'
    if alvo:
        pedacos = [p for p in alvo.split('/') if p]

        def _pontos(nome):
            n = normalizar(nome)
            return sum(1 for p in pedacos if p in n)
        nomes = sorted(nomes, key=lambda n: (-_pontos(n), len(n)))
    escolhidas = nomes[:MAX_SUGESTOES]
    lista = '\n'.join('- %s' % n for n in escolhidas)
    resto = len(nomes) - len(escolhidas)
    rodape = ('\n(e mais %d — %s para ver todas)' % (resto, como_ver_todas)
              if resto > 0 else '')
    return '%s mais parecidas:\n%s%s' % (rotulo, lista, rodape)


def casar_parte(partes, pedido):
    """Índice da parte pedida. Tolerante: caixa, acento e o fim do caminho.

    O nome é um caminho longo e o modelo vai errar de digitação; devolver "não
    existe" para `modulos/agentes` quando a parte é
    `Program/Code/backend/modulos/agentes` só gasta uma rodada.
    """
    alvo = normalizar(pedido)
    if not alvo:
        raise ErroDeUso('parâmetro "parte" vazio. '
                        + sugestoes([n for n, _ in partes], ''))
    nomes = [normalizar(n) for n, _ in partes]
    exatas = [i for i, n in enumerate(nomes) if n == alvo]
    if len(exatas) == 1:
        return exatas[0]
    finais = [i for i, n in enumerate(nomes) if n.endswith('/' + alvo) or n == alvo]
    if len(finais) == 1:
        return finais[0]
    contem = [i for i, n in enumerate(nomes) if alvo in n]
    if len(contem) == 1:
        return contem[0]
    if contem:
        lista = '\n'.join('- %s' % partes[i][0] for i in contem[:MAX_SUGESTOES])
        raise ErroDeUso('"%s" casa mais de uma parte. Qual delas?\n%s' % (pedido, lista))
    raise ErroDeUso('a parte "%s" não existe. ' % pedido
                    + sugestoes([n for n, _ in partes], alvo))


def indice_das_partes(rotulo, partes, parametro='parte'):
    """A lista das partes — a resposta de quem não pediu parte nenhuma."""
    if not partes:
        return '%s: não há nada para ler.' % rotulo
    linhas = []
    total = 0
    for nome, corpo in partes:
        tk = contar_tokens(corpo)
        total += tk
        linhas.append('- %s (%d tk)' % (nome, tk))
    return ('%s — %d partes, %d tokens no total. Grande demais para uma leitura só.\n'
            'Peça UMA por vez, pelo nome, no parâmetro "%s".\n\n'
            % (rotulo, len(partes), total, parametro) + '\n'.join(linhas))


def servir_partes(rotulo, partes, parte=None, filtro=None):
    """A regra automática por tamanho: cabe inteiro → inteiro; não cabe → partes."""
    if filtro:
        alvo = normalizar(filtro)
        casadas = [p for p in partes if alvo in normalizar(p[0])]
        if not casadas:
            raise ErroDeUso('nenhuma parte casa o filtro "%s". ' % filtro
                            + sugestoes([n for n, _ in partes], alvo))
        partes = casadas
    if not partes:
        raise ErroDeUso('%s: não há nada para ler.' % rotulo)
    if not (isinstance(parte, str) and parte.strip()):
        inteiro = '\n\n'.join('--- %s ---\n%s' % (n, c) for n, c in partes)
        if contar_tokens(inteiro) <= TETO_PARTE:
            return inteiro
        return indice_das_partes(rotulo, partes)
    i = casar_parte(partes, parte)
    nome, corpo = partes[i]
    return cortar('--- %s --- (parte %d de %d)\n%s'
                  % (nome, i + 1, len(partes), corpo), TETO_PARTE)
