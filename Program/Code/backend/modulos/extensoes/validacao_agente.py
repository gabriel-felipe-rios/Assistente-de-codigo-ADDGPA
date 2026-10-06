"""O item `{"recurso": "agente"}` de um manifesto — ele vale, e em que forma?

Pergunta que este arquivo responde: "este agente que a extensão declara
existe de verdade na pasta dela, com o que o programa precisa para usá-lo?".
Saiu de `validacao.py` (23/09/2026), que já passava do teto de 500 linhas e
ganharia a segunda forma aqui — `validacao.validar_item` continua sendo quem
chama, e o resto do item (recurso, id, prefixo) continua conferido lá.

  - **`oficina`**: um `.md` com frontmatter `name` e `description` — o mesmo
    formato dos agentes da biblioteca (Arquivos › Agentes). Ao ser escolhido
    no popover de "＋ Terminal", o programa o COPIA para a pasta de agentes do
    projeto com `name` = o `id` do item (`arquivos_agentes.py`).
  - **`subagente`**: uma `pasta` com o trio que o programa tem por subagente
    (`system-prompt.txt`, `prompt-correcao.txt`, `bloco.txt`), mais `nome` e
    `descricao` para o card das sub-abas Subagentes do Chat e da Fila.
    Opcionais desde a fase 07 (D51, D52, D55): `ferramentas` (sem ela, as
    de leitura do Analista, como antes), `envelope` (o backend manda, junto
    da pergunta, o que o subagente pode ler), `le` (o que ele lê, para a
    página da extensão), `selo_fonte` (o texto do selo de fonte no card),
    `cor` (um dos `XT_SUBAGENTE_CORES`) e `antes` (ids antigos que ele
    substitui — o liga/desliga salvo com eles passa para o id novo).

⚠️ Import: nunca importe `descoberta` aqui — fecharia o ciclo
`descoberta → manifesto → validacao → validacao_agente` (ver `encaixes.py`).
"""

import os

from .constantes import (XT_AGENTE_FORMAS, XT_AGENTE_FORMAS_PRONTAS,
                         XT_SUBAGENTE_ARQUIVOS, XT_SUBAGENTE_FONTES,
                         XT_SUBAGENTE_CORES, XT_BACKEND_ENTRY, XT_ACAO_ENVELOPE,
                         caminho_absoluto, erro_do_arquivo_declarado)
from ..arquivos_copia import ArquivosCopiaMixin

# O ícone do card quando a extensão não declara um.
XT_SUBAGENTE_ICONE_PADRAO = '🧩'


def _texto(item, campo):
    v = item.get(campo)
    return v.strip() if isinstance(v, str) else ''


def validar_item_agente(caminho_relativo, item, rotulo, ferramentas_da_extensao=frozenset()):
    """`(erro, dados, avisos)` do recurso Agente (D39). `dados` é `None`
    quando o item não carrega; `avisos` não impedem o item.

    `ferramentas_da_extensao` são os `nome` dos itens `ferramenta` desta
    mesma extensão (fase 07) — os únicos, além das do programa, que o
    subagente pode listar em `ferramentas`."""
    forma = _texto(item, 'forma')
    if forma not in XT_AGENTE_FORMAS:
        return ('%s: a `forma` do agente é "oficina" ou "subagente", e veio "%s".'
                % (rotulo, forma)), None, []
    if forma not in XT_AGENTE_FORMAS_PRONTAS:
        return ('%s: o programa ainda não recebe o %s — este item não carregou.'
                % (rotulo, XT_AGENTE_FORMAS[forma])), None, []
    if forma == 'subagente':
        return _validar_subagente(caminho_relativo, item, rotulo, ferramentas_da_extensao)
    erro, dados = _validar_oficina(caminho_relativo, item, rotulo)
    return erro, dados, []


def _validar_oficina(caminho_relativo, item, rotulo):
    arquivo = _texto(item, 'arquivo')
    erro = erro_do_arquivo_declarado(caminho_relativo, arquivo, rotulo)
    if erro:
        return erro, None
    if not arquivo.lower().endswith('.md'):
        return '%s: o agente da Oficina é um arquivo `.md`, e veio "%s".' % (rotulo, arquivo), None
    try:
        with open(os.path.join(caminho_absoluto(caminho_relativo), arquivo.replace('/', os.sep)),
                  'r', encoding='utf-8', errors='replace') as f:
            campos, _corpo = ArquivosCopiaMixin._frontmatter_partes(f.read())
    except OSError as e:
        return '%s: não deu para ler "%s": %s' % (rotulo, arquivo, e), None
    faltam = [c for c in ('name', 'description') if not campos.get(c)]
    if faltam:
        return ('%s: o cabeçalho (`---` no topo) de "%s" precisa de %s.'
                % (rotulo, arquivo, ' e '.join('`%s`' % c for c in faltam))), None
    return None, {'forma': 'oficina', 'arquivo': arquivo}


def _ferramentas_do_item(item, rotulo, da_extensao):
    """`(lista, erro)` — as ferramentas que o subagente de extensão pode chamar.

    Sem `ferramentas`, as do Analista (o contrato de antes da fase 07). Com
    ela, cada nome é uma ferramenta do programa ou uma que ESTA extensão
    declara no recurso `ferramenta`. Nome desconhecido recusa o item: o
    subagente chamaria uma ferramenta que nunca responde."""
    # Import tardio: o núcleo dos subagentes lê a camada de extensões, e um
    # import no topo fecharia o ciclo.
    from ..agentes.ferramentas_subagentes_constantes import (
        FERRAMENTAS_DESCRICAO, FERRAMENTAS_POR_SUBAGENTE, SUBAGENTE_MODELO_DE_EXTENSAO)
    bruto = item.get('ferramentas')
    if bruto is None:
        return list(FERRAMENTAS_POR_SUBAGENTE[SUBAGENTE_MODELO_DE_EXTENSAO]), None
    if (not isinstance(bruto, list) or not bruto
            or not all(isinstance(f, str) and f.strip() for f in bruto)):
        return None, '%s: `ferramentas` precisa ser uma lista de nomes de ferramenta.' % rotulo
    # `listar_pasta` é do Navegador, que não passa pelo despachante.
    do_programa = [n for n in FERRAMENTAS_DESCRICAO if n != 'listar_pasta']
    nomes = list(dict.fromkeys(f.strip() for f in bruto))
    desconhecidas = [f for f in nomes if f not in do_programa and f not in da_extensao]
    if desconhecidas:
        return None, ('%s: ferramenta desconhecida %s — as do programa são: %s; as desta '
                      'extensão são as que ela declara no recurso `ferramenta`.'
                      % (rotulo, ', '.join('"%s"' % f for f in desconhecidas),
                         ', '.join(do_programa)))
    return nomes, None


def _validar_subagente(caminho_relativo, item, rotulo, ferramentas_da_extensao=frozenset()):
    """O subagente do Chat e da Fila: a `pasta` com o trio, `nome` e
    `descricao`. `icone`, `fontes` e — desde a fase 07 — `ferramentas`,
    `envelope`, `le`, `selo_fonte`, `cor` e `antes` são opcionais."""
    pasta = _texto(item, 'pasta')
    if not pasta:
        return '%s: o subagente precisa da `pasta` com %s.' % (
            rotulo, ', '.join('`%s`' % a for a in XT_SUBAGENTE_ARQUIVOS)), None, []
    if pasta.startswith('/') or '..' in pasta.replace('\\', '/').split('/'):
        return ('%s: `pasta` precisa ficar dentro da pasta da extensão '
                '(sem `..` e sem barra inicial).' % rotulo), None, []
    base = os.path.join(caminho_absoluto(caminho_relativo), pasta.replace('/', os.sep))
    if not os.path.isdir(base):
        return '%s: a pasta "%s" não existe na pasta da extensão.' % (rotulo, pasta), None, []
    faltam = [a for a in XT_SUBAGENTE_ARQUIVOS if not os.path.isfile(os.path.join(base, a))]
    if faltam:
        return ('%s: falta em "%s": %s.' % (rotulo, pasta, ', '.join('`%s`' % a for a in faltam))
                ), None, []
    nome, descricao = _texto(item, 'nome'), _texto(item, 'descricao')
    if not nome or not descricao:
        return ('%s: o subagente precisa de `nome` e `descricao` (o card das sub-abas '
                'Subagentes do Chat e da Fila).' % rotulo), None, []

    avisos = []
    fontes = item.get('fontes')
    if fontes is None:
        # As do Analista: é dele o conjunto de ferramentas que o subagente recebe.
        fontes = ['doc-gerada', 'codigo']
    elif not isinstance(fontes, list) or not all(isinstance(f, str) for f in fontes):
        return '%s: `fontes` precisa ser uma lista de textos.' % rotulo, None, []
    desconhecidas = [f for f in fontes if f not in XT_SUBAGENTE_FONTES]
    if desconhecidas:
        avisos.append('%s: fonte desconhecida %s — as que existem são: %s. Ficou de fora.'
                      % (rotulo, ', '.join('"%s"' % f for f in desconhecidas),
                         ', '.join(XT_SUBAGENTE_FONTES)))
        fontes = [f for f in fontes if f in XT_SUBAGENTE_FONTES]

    # ── O contrato ampliado (fase 07, D51, D52, D55) ──
    ferramentas, erro = _ferramentas_do_item(item, rotulo, ferramentas_da_extensao)
    if erro:
        return erro, None, []
    envelope = item.get('envelope', False)
    if not isinstance(envelope, bool):
        return '%s: `envelope` é `true` ou `false`.' % rotulo, None, []
    if envelope and not os.path.isfile(os.path.join(caminho_absoluto(caminho_relativo),
                                                    XT_BACKEND_ENTRY)):
        return ('%s: `envelope: true` pede o `backend/extensao.py` — é ele que responde '
                'a ação "%s".' % (rotulo, XT_ACAO_ENVELOPE)), None, []
    cor = _texto(item, 'cor')
    if cor and cor not in XT_SUBAGENTE_CORES:
        avisos.append('%s: a cor "%s" não existe — as que existem são: %s. Ficou a cor '
                      'padrão.' % (rotulo, cor, ', '.join(XT_SUBAGENTE_CORES)))
        cor = ''
    antes = item.get('antes', [])
    if not isinstance(antes, list) or not all(isinstance(a, str) and a.strip() for a in antes):
        return ('%s: `antes` precisa ser uma lista de ids — os antigos que este subagente '
                'substitui.' % rotulo), None, []
    antes = [a.strip() for a in antes]

    # O agente principal chama pelo `id` (`{"subagente": "rev.conferente"}`),
    # e é o `bloco.txt` que o ensina. Um bloco que não cita o id faz o modelo
    # chamar um nome que não existe — o item vale, mas o aviso sai.
    try:
        with open(os.path.join(base, 'bloco.txt'), 'r', encoding='utf-8', errors='replace') as f:
            if item.get('id', '') not in f.read():
                avisos.append('%s: o `bloco.txt` não cita o id "%s" — é por ele que o '
                              'Chat e a Fila chamam o subagente.' % (rotulo, item.get('id', '')))
    except OSError:
        pass

    return None, {'forma': 'subagente', 'pasta': pasta, 'nome': nome, 'descricao': descricao,
                  'icone': _texto(item, 'icone') or XT_SUBAGENTE_ICONE_PADRAO,
                  'fontes': fontes, 'ferramentas': ferramentas, 'envelope': envelope,
                  'le': _texto(item, 'le'), 'selo_fonte': _texto(item, 'selo_fonte'),
                  'cor': cor, 'antes': antes}, avisos
