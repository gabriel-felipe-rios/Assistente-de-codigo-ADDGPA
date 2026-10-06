"""Divisão de artefato grande em PARTES COM NOME.

O que isto substitui: o parâmetro `inicio`, um deslocamento em caracteres. Ele
cortava cego — no meio de uma linha, no meio de uma pasta — e obrigava o modelo
a fazer aritmética de offset para pedir a continuação. Pior: o subagente é
stateless entre chamadas, então ele relia a mesma página a cada devolução.

A parte tem nome porque a fronteira já existe no conteúdo: o índice tem um
cabeçalho `##` por pasta e o grafo agrupa por pasta. (O pipeline é lido por
nível, em `pipeline_niveis_leitura.py`, e o resumo de pastas por seção, em
`ferramentas_subagentes_secoes.py` — nenhum dos dois passa mais por aqui.)
Pedir "a parte
`Program/Code/backend/modulos`" é uma coisa que o modelo consegue querer;
pedir "o caractere 20000" não é.

⚠️ A divisão é AUTOMÁTICA POR TAMANHO. Ninguém configura artefato por artefato:

    tem fronteira natural?
       não  -> serve inteiro
       sim  -> cabe no teto?
                 sim -> serve inteiro, SEM linha de rastro
                 não -> serve em partes com nome, COM linha de rastro

O casamento do nome é TOLERANTE de propósito. O nome é um caminho longo e o
modelo vai errar de digitação; devolver "não existe" para `modulos/agentes`
quando a parte é `Program/Code/backend/modulos/agentes` só gasta uma rodada.
"""

import json
import unicodedata

from modulos.tokens import contar_tokens

# Erro devolve no máximo isto de sugestões — nunca o catálogo inteiro. Medido:
# um erro de caminho que despejava 100 nomes custava 1.562 tokens contra 304 de
# um acerto. Errar saía 5x mais caro que acertar.
MAX_SUGESTOES = 5

# O texto que vem antes do primeiro cabeçalho: título, data, avisos. Não é lixo
# — no pipeline são os avisos de hub e de ilha descartada —, então vira parte
# como qualquer outra, em vez de ser colado na primeira ou jogado fora.
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


# ── Divisões ─────────────────────────────────────────────────────────────────
def dividir_por_cabecalho(texto, prefixo='## '):
    """Um markdown em partes, uma por cabeçalho. Devolve [(nome, corpo)].

    Serve o índice de navegação (um `##` por pasta) e o Detector
    (`automacao/detector_pedacos.py`). O pipeline deixou de passar por aqui:
    é lido por nível, em `pipeline_niveis_leitura.py`.
    """
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
    """O grafo de imports em partes, uma por pasta. Devolve [(nome, corpo)].

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


# ── Seleção ──────────────────────────────────────────────────────────────────
def filtrar_partes(partes, filtro):
    """As partes cujo NOME casa o filtro. Erro com sugestões se não casar nada.

    É o corte #2: o modelo poder pedir só o pedaço que interessa, em vez de
    receber o catálogo e descartar 39/40 dele.
    """
    alvo = normalizar(filtro)
    if not alvo:
        return partes
    casadas = [p for p in partes if alvo in normalizar(p[0])]
    if not casadas:
        raise ValueError(f'nenhuma parte casa o filtro "{filtro}". '
                         + sugestoes([n for n, _ in partes], alvo))
    return casadas


def casar_parte(partes, pedido):
    """Índice da parte pedida. Tolerante: caixa, acento, e o fim do caminho.

    A ordem das tentativas vai do mais específico ao menos: igual, termina em,
    contém. Só uma candidata resolve; várias devolvem a lista para o modelo
    escolher, que é mais barato que ele adivinhar e errar de novo.
    """
    alvo = normalizar(pedido)
    if not alvo:
        raise ValueError('parâmetro "parte" vazio. '
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
        lista = '\n'.join(f'- {partes[i][0]}' for i in contem[:MAX_SUGESTOES])
        raise ValueError(f'"{pedido}" casa mais de uma parte. Qual delas?\n{lista}')

    raise ValueError(f'a parte "{pedido}" não existe. '
                     + sugestoes([n for n, _ in partes], alvo))


def sugestoes(nomes, alvo, rotulo='Partes', como_ver_todas='chame sem o parâmetro'):
    """Até MAX_SUGESTOES nomes, os mais parecidos primeiro.

    É o corte #1 em pessoa: um erro de nome devolve o caminho de volta, não o
    catálogo. Serve tanto para as partes de um artefato quanto para a lista da
    documentação técnica — o defeito era o mesmo nos dois.
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
    lista = '\n'.join(f'- {n}' for n in escolhidas)
    resto = len(nomes) - len(escolhidas)
    rodape = (f'\n(e mais {resto} — {como_ver_todas} para ver todas)'
              if resto > 0 else '')
    return f'{rotulo} mais parecidas:\n{lista}{rodape}'


# ── Índice das partes ────────────────────────────────────────────────────────
def indice_das_partes(artefato, partes, parametro='parte'):
    """A lista das partes, com nome e tamanho — a resposta de quem não pediu parte.

    Custa ~600 tokens para 40 nomes, contra 9.836 de despejar o artefato
    inteiro. É o mesmo molde que uma ferramenta de extensão que lê arquivo
    também usa quando o caminho vem vazio.
    """
    if not partes:
        return f'{artefato}: não há nada para ler.'
    linhas = []
    total = 0
    for nome, corpo in partes:
        tk = contar_tokens(corpo)
        total += tk
        linhas.append(f'- {nome} ({tk} tk)')
    return (f'{artefato} — {len(partes)} partes, {total} tokens no total. '
            f'Grande demais para uma leitura só.\n'
            f'Peça UMA por vez, pelo nome, no parâmetro "{parametro}".\n\n'
            + '\n'.join(linhas))
