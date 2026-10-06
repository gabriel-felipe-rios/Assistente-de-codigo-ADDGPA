"""O Pipeline em níveis, do jeito que QUEM PERGUNTA o lê: o MCP `pipeline` e o
subagente `ler_pipeline` (Arquiteto).

A rotina Pipeline grava, na pasta dela (`obter_pasta_da_rotina(projeto, 'pipeline')`):

    _niveis.json     a estrutura: áreas, blocos, cadeias — ids, nomes, contagens
    pipeline.md      a Visão geral (as áreas, cada uma com a sua frase)
    areas/A1.md      uma área: os blocos dela e as ligações
    blocos/B1.md     um bloco (B0 = «Sem ponto de entrada»): arquivos e cadeias
    cadeias/C1.md    uma cadeia: os passos, na ordem

Este módulo só LÊ. `servir` é a leitura única dos dois leitores: quem chama
passa o teto dele (`_sub_teto_parte(quem)`), e é só isso que muda entre o
assistente externo e o subagente.

O roteiro é de cima para baixo: sem `parte`, a Visão geral; depois uma área,
um bloco, uma cadeia. Cada nível cita os ids do nível de baixo — quem lê nunca
recebe o pipeline inteiro de uma vez («ele primeiro vai ler o resumo ali para
depois ver o resto»), e sempre sabe qual é o próximo pedido.

⚠️ A VISÃO GERAL SERVIDA LEVA OS BLOCOS DE CADA ÁREA (`_blocos_por_area`). O
`pipeline.md` só lista as áreas; o subagente tem poucas rodadas de
ferramenta (3 de fábrica), e descer Visão geral → área → bloco → cadeia
gastaria quatro. Com os ids dos blocos à mão, ele vai da Visão geral direto
ao bloco. É só o id e o nome — o resumo continua no nível de baixo.

⚠️ NUNCA CORTA CALADO. Um nível maior que o teto vem em PÁGINAS
(`"C12:2"`), cortadas entre linhas, e o fim de cada página diz como pedir a
próxima. A lista de cadeias de um arquivo que não cabe diz quantas ficaram
de fora e como estreitar.

⚠️ ID ERRADO DEVOLVE OS IDS DO NÍVEL, não um «não existe» seco: o modelo erra
o número e precisa do caminho de volta sem gastar outra rodada.
"""

import json
import os
import re

from modulos.tokens import contar_tokens
from modulos.agentes import partes_artefato

ARQUIVO_NIVEIS = '_niveis.json'
ARQUIVO_VISAO_GERAL = 'pipeline.md'

# Letra do id → (pasta dos .md, lista no _niveis.json, nome, «os que existem»)
_NIVEIS = {
    'A': ('areas', 'areas', 'área', 'As áreas que existem'),
    'B': ('blocos', 'blocos', 'bloco', 'Os blocos que existem'),
    'C': ('cadeias', 'cadeias', 'cadeia', 'As cadeias que existem'),
}

# "A1", "b12", "C3 · 🖱️ Carregar" (o modelo costuma copiar o nome junto) e
# "C12:2" (a página 2). "C1a" e "Conversa" não são id.
_RX_ID = re.compile(r'^\s*([ABCabc])\s*(\d+)\s*(?::\s*(\d+))?(?=\s|·|$)')
# A Visão geral também pode ter página, quando não cabe: "visao:2".
_RX_VISAO = re.compile(r'^\s*vis[aã]o(?:\s+geral)?\s*(?::\s*(\d+))?\s*$', re.IGNORECASE)

_RODE_DE_NOVO = 'peça ao usuário para rodar a rotina Pipeline de novo na aba Automação'


# ── Ler ──────────────────────────────────────────────────────────────────────
def carregar_niveis(pasta):
    """O `_niveis.json`, com um índice `_por_id` (id → item). Erro legível se faltar."""
    caminho = os.path.join(pasta, ARQUIVO_NIVEIS)
    if not os.path.isfile(caminho):
        # pipeline.md sem _niveis.json = gerado antes do Pipeline em níveis.
        # Dizer isso poupa o modelo de concluir que o projeto não tem pipeline.
        if os.path.isfile(os.path.join(pasta, ARQUIVO_VISAO_GERAL)):
            raise ValueError('o Pipeline deste projeto está no formato antigo, sem níveis — '
                             + _RODE_DE_NOVO)
        raise ValueError('pipeline não gerado — peça ao usuário para rodar a rotina '
                         'Pipeline na aba Automação')
    try:
        with open(caminho, 'r', encoding='utf-8') as f:
            dados = json.load(f)
    except (OSError, ValueError):
        raise ValueError(f'o {ARQUIVO_NIVEIS} do Pipeline está ilegível — '
                         + _RODE_DE_NOVO) from None
    if not isinstance(dados, dict):
        raise ValueError(f'o {ARQUIVO_NIVEIS} do Pipeline está ilegível — ' + _RODE_DE_NOVO)
    por_id = {}
    for _pasta, lista, _nome, _existem in _NIVEIS.values():
        itens = [i for i in (dados.get(lista) or []) if isinstance(i, dict) and i.get('id')]
        dados[lista] = itens
        for item in itens:
            por_id[str(item['id'])] = item
    dados['_por_id'] = por_id
    return dados


def _ler(caminho):
    with open(caminho, 'r', encoding='utf-8', errors='replace') as f:
        return f.read().strip()


def _rotulo(item):
    """"B3 · Aparência e tema" — o id com o nome, como a árvore da Documentação mostra."""
    return f"{item.get('id')} · {item.get('nome') or '(sem nome)'}"


def _numero(item_id):
    try:
        return int(str(item_id)[1:])
    except ValueError:
        return 0


# ── O que se acrescenta ao texto do nível ────────────────────────────────────
def _trilha(dados, item_id):
    """"Onde fica: Visão geral → A2 · … → B4 · … → C12". Vazia para uma área."""
    por_id = dados['_por_id']
    item = por_id[item_id]
    if item_id[0] == 'A':
        return ''
    bloco = item if item_id[0] == 'B' else por_id.get(item.get('bloco') or '')
    acima = []
    if bloco:
        area = por_id.get(bloco.get('area') or '')
        if area:
            acima.append(_rotulo(area))
        if bloco is not item:
            acima.append(_rotulo(bloco))
    return 'Onde fica: ' + ' → '.join(['Visão geral'] + acima + [item_id])


def _blocos_por_area(dados):
    """Uma linha por área com os ids e nomes dos blocos dela — o atalho da
    Visão geral para o bloco (ver a docstring do módulo)."""
    por_id = dados['_por_id']
    linhas = []
    for area in dados['areas']:
        blocos = [por_id[b] for b in area.get('blocos') or [] if b in por_id]
        if blocos:
            linhas.append(f'- {_rotulo(area)} → ' + ', '.join(_rotulo(b) for b in blocos))
    soltos = [b for b in dados['blocos'] if not b.get('area')]
    if soltos:
        linhas.append('- fora de área → ' + ', '.join(_rotulo(b) for b in soltos))
    if not linhas:
        return ''
    return ('## Os blocos de cada área\n\n'
            'Para ir direto a um bloco, peça parte="B…".\n\n' + '\n'.join(linhas))


# ── Páginas ──────────────────────────────────────────────────────────────────
def paginar(texto, teto):
    """O texto em páginas de até `teto` tokens, cortadas ENTRE linhas.

    Prefere abrir página nova num cabeçalho `## ` quando a página corrente já
    passou da metade do teto — a página fica sobre um assunto só. Uma linha
    sozinha maior que o teto vai inteira na sua página: cortar no meio dela
    daria ao leitor um passo pela metade achando que é o passo todo.
    """
    if contar_tokens(texto) <= teto:
        return [texto]
    paginas, atual, usado = [], [], 0
    for linha in texto.split('\n'):
        custo = contar_tokens(linha) + 1
        cabecalho = linha.startswith('## ')
        if atual and (usado + custo > teto or (cabecalho and usado > teto // 2)):
            paginas.append('\n'.join(atual).strip())
            atual, usado = [], 0
        atual.append(linha)
        usado += custo
    if atual:
        paginas.append('\n'.join(atual).strip())
    return [p for p in paginas if p] or ['']


def _pagina(texto, chave, pagina, teto):
    """A página pedida (1 se nenhuma), com o aviso de como pedir a próxima."""
    paginas = paginar(texto, teto)
    total = len(paginas)
    n = pagina or 1
    if n < 1 or n > total:
        raise ValueError(f'{chave} tem {total} página(s) — peça de "{chave}:1" '
                         f'a "{chave}:{total}"')
    if total == 1:
        return paginas[0]
    corpo = f'--- {chave} · página {n} de {total} ---\n{paginas[n - 1]}'
    if n < total:
        corpo += (f'\n\n(continua — peça parte="{chave}:{n + 1}" para a página '
                  f'{n + 1} de {total})')
    return corpo


# ── Erros que devolvem o caminho de volta ────────────────────────────────────
def _erro_id(dados, item_id):
    """Id de formato certo que não existe: os ids daquele nível."""
    _pasta, lista, nome, existem = _NIVEIS[item_id[0]]
    itens = dados[lista]
    if not itens:
        return (f'{item_id} não existe: o Pipeline não tem nenhum(a) {nome}. '
                'Chame sem "parte" para a Visão geral.')
    if item_id[0] in ('A', 'B'):
        linhas = '\n'.join(f'- {_rotulo(i)}' for i in itens)
        return f'{item_id} não existe. {existem}:\n{linhas}'
    # Cadeias são centenas: a faixa, as de número mais próximo e o caminho.
    alvo = _numero(item_id)
    perto = sorted(itens, key=lambda i: (abs(_numero(i['id']) - alvo), _numero(i['id'])))
    perto = sorted(perto[:partes_artefato.MAX_SUGESTOES], key=lambda i: _numero(i['id']))
    numeros = [_numero(i['id']) for i in itens]
    linhas = '\n'.join(f'- {_rotulo(i)}' for i in perto)
    return (f'{item_id} não existe. As cadeias vão de C{min(numeros)} a C{max(numeros)}; '
            f'as de número mais próximo:\n{linhas}\n'
            'Para ver as cadeias de um bloco, peça parte="B…" — a Visão geral (sem '
            '"parte") lista as áreas e os blocos de cada uma.')


def _erro_pedido(dados, pedido):
    """`parte` que não tem forma de id: o formato certo e as áreas."""
    areas = '\n'.join(f'- {_rotulo(a)}' for a in dados['areas']) or '(nenhuma área)'
    return (f'"{pedido}" não é um id do Pipeline. Use o id de um nível: "A1" (área), '
            '"B1" (bloco; "B0" é o bloco «Sem ponto de entrada») ou "C1" (cadeia). Sem '
            f'"parte" vem a Visão geral. As áreas:\n{areas}')


# ── Filtro: as cadeias que passam por um arquivo ─────────────────────────────
def _cadeias_do_id(dados, item_id):
    """Os ids das cadeias dentro de uma área, de um bloco, ou a própria cadeia."""
    por_id = dados['_por_id']
    item = por_id[item_id]
    if item_id[0] == 'C':
        return {item_id}
    if item_id[0] == 'B':
        blocos = [item]
    else:
        blocos = [por_id[b] for b in item.get('blocos') or [] if b in por_id]
    return {c for b in blocos for c in (b.get('cadeias') or [])}


def cadeias_por_arquivo(dados, filtro, teto, dentro_de=None):
    """As cadeias que passam por um arquivo (ou pedaço de caminho): id, nome,
    bloco e área de cada uma — não o texto inteiro. `dentro_de` = um id que
    limita a busca àquela área, bloco ou cadeia.

    Casa a cabeça da cadeia, a origem e o destino de cada passo e, por último,
    os selos: um hub (ex.: `utils.js`) nunca é origem nem destino — virou selo —,
    e responder «nenhuma cadeia» para ele seria dizer que ele não roda.
    """
    alvo = partes_artefato.normalizar(filtro)
    if not alvo:
        raise ValueError('o parâmetro "filtro" está vazio — passe um caminho de arquivo, '
                         'inteiro ou um pedaço, ex. "chat.py"')
    por_id = dados['_por_id']
    escopo = _cadeias_do_id(dados, dentro_de) if dentro_de else None
    onde_busca = f' dentro de {_rotulo(por_id[dentro_de])}' if dentro_de else ''

    def casa(caminho):
        return bool(caminho) and alvo in partes_artefato.normalizar(caminho)

    achadas, todos = [], set()
    for c in dados['cadeias']:
        if escopo is not None and c['id'] not in escopo:
            continue
        passos = [p for p in c.get('passos') or [] if isinstance(p, dict)]
        arquivos = {c.get('cabeca') or ''}
        selos = set()
        for p in passos:
            arquivos.update((p.get('origem') or '', p.get('destino') or ''))
            selos.update(s for s in p.get('selos') or [] if isinstance(s, str))
        todos.update(a for a in arquivos if a)
        pelo_passo = any(casa(a) for a in arquivos)
        pelo_selo = not pelo_passo and any(casa(s) for s in selos)
        if not (pelo_passo or pelo_selo):
            continue
        bloco = por_id.get(c.get('bloco') or '')
        area = por_id.get(bloco.get('area') or '') if bloco else None
        onde = ' · '.join(x for x in (f'bloco {_rotulo(bloco)}' if bloco else '',
                                      f'área {_rotulo(area)}' if area else '') if x)
        emoji = f"{c['emoji']} " if c.get('emoji') else ''
        achadas.append((c['id'],
                        f"- {c['id']} · {emoji}{c.get('nome') or '(sem nome)'} "
                        f"({len(passos)} passos) — {onde or 'sem bloco'}"
                        + (' · só como selo (hub)' if pelo_selo else '')))

    if not achadas:
        raise ValueError(
            f'nenhuma cadeia{onde_busca} passa por arquivo com "{filtro}". Isso não quer '
            'dizer que o arquivo não rode: pode ser que nenhuma chamada entre arquivos o '
            'alcance. '
            + partes_artefato.sugestoes(sorted(todos), alvo, rotulo='Arquivos do Pipeline',
                                        como_ver_todas='peça a Visão geral, sem parâmetro'))

    topo = [f'Cadeias{onde_busca} que passam por arquivo com "{filtro}" — {len(achadas)}:']
    hubs = [h for h in dados.get('hubs') or [] if isinstance(h, str) and casa(h)]
    if hubs:
        topo.insert(0, f'⚠️ `{hubs[0]}` é hub: fica fora das setas e aparece como selo '
                       'nos passos — as cadeias marcadas «só como selo» apenas o citam.')
    rodape = f'Abra uma pelo id, ex. parte="{achadas[0][0]}".'

    saida = list(topo)
    usado = contar_tokens('\n'.join(topo + [rodape]))
    for i, (_id, linha) in enumerate(achadas):
        custo = contar_tokens(linha) + 1
        if usado + custo > teto:
            saida.append(f'(e mais {len(achadas) - i} cadeia(s) que não couberam no teto '
                         f'de {teto} tokens — estreite com um filtro mais longo, ou com '
                         'parte="A…"/"B…" junto do filtro)')
            break
        saida.append(linha)
        usado += custo
    saida.append(rodape)
    return '\n'.join(saida)


# ── A leitura única ──────────────────────────────────────────────────────────
def _posicao(dados, item_id):
    """(posição, total) do item na ordem áreas → blocos → cadeias — para o rastro."""
    ordem = [i['id'] for lista in ('areas', 'blocos', 'cadeias') for i in dados[lista]]
    return ordem.index(item_id) + 1, len(ordem)


def servir(pasta, parte=None, filtro=None, teto=6000):
    """A leitura do Pipeline para o MCP e o subagente. Devolve `(texto, lida)`.

    `lida` = `(posição, total)` do nível servido, para a linha de rastro do
    subagente; `None` na Visão geral e no filtro.

        sem parte, sem filtro   → a Visão geral (pipeline.md) + os blocos de cada área
        parte = "A1"/"B1"/"C1"  → o .md daquele nível, com a linha «Onde fica:»
        parte = "C1:2"          → a página 2 dele, quando não coube no teto
        filtro = caminho        → as cadeias que passam por ele (com parte: só dentro dela)

    Erros saem como `ValueError` com a mensagem para o modelo ler.
    """
    dados = carregar_niveis(pasta)
    pedido = '' if parte is None else str(parte).strip()
    item_id, pagina = None, None
    if pedido:
        visao = _RX_VISAO.match(pedido)
        m = None if visao else _RX_ID.match(pedido)
        if visao:
            pagina = int(visao.group(1)) if visao.group(1) else None
        elif m:
            item_id = m.group(1).upper() + str(int(m.group(2)))
            pagina = int(m.group(3)) if m.group(3) else None
        else:
            raise ValueError(_erro_pedido(dados, pedido))
        if item_id and item_id not in dados['_por_id']:
            raise ValueError(_erro_id(dados, item_id))

    if filtro is not None and str(filtro).strip():
        return cadeias_por_arquivo(dados, str(filtro), teto, item_id), None

    if not item_id:
        caminho = os.path.join(pasta, ARQUIVO_VISAO_GERAL)
        if not os.path.isfile(caminho):
            raise ValueError('a Visão geral (pipeline.md) não existe — ' + _RODE_DE_NOVO)
        texto = _ler(caminho)
        atalho = _blocos_por_area(dados)
        if atalho:
            texto = f'{texto}\n\n{atalho}'
        return _pagina(texto, 'visao', pagina, teto), None

    pasta_nivel = _NIVEIS[item_id[0]][0]
    caminho = os.path.join(pasta, pasta_nivel, item_id + '.md')
    if not os.path.isfile(caminho):
        raise ValueError(f'{item_id} está no {ARQUIVO_NIVEIS}, mas {pasta_nivel}/{item_id}.md '
                         'não existe — ' + _RODE_DE_NOVO)
    texto = _ler(caminho)
    trilha = _trilha(dados, item_id)
    if trilha:
        texto = f'{trilha}\n\n{texto}'
    return _pagina(texto, item_id, pagina, teto), _posicao(dados, item_id)
