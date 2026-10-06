"""O recurso AGENTE (D39) — os agentes que as extensões ligadas acrescentam.
E, desde a fase 07 (D51, D52), as FERRAMENTAS e os TRECHOS DE PROMPT que elas
dão aos subagentes.

Pergunta que este arquivo responde: "que agentes, subagentes, ferramentas e
trechos de prompt as extensões ligadas trazem agora, e onde estão os arquivos
de cada um?". Quem pergunta é
`arquivos_agentes.py` (o popover de "＋ Terminal" e a cópia para o projeto),
e, para os subagentes, `caminhos.py` (os prompts) e
`agentes/execucao/subagentes_constantes.py` (as listas do Chat e da Fila).

  - **`oficina`** — um `.md` com frontmatter (`name`, `description`, `tools`,
    `model`), o mesmo formato dos agentes da biblioteca (Arquivos › Agentes).
    Ele ACRESCENTA à lista do popover; nunca substitui nem edita um agente da
    biblioteca (P9). O arquivo mora na pasta da extensão (P6).
  - **`subagente`** (Chat e Fila, desde 23/09/2026) — uma `pasta` com o trio
    `system-prompt.txt`, `prompt-correcao.txt` e `bloco.txt`, o mesmo que o
    programa tem por subagente. O agente principal o chama pelo `id` do item
    (`rev.conferente`), como chama o `leitor`. É LLM, roda no MESMO LM Studio
    do Chat (programa 100% local) e recebe as ferramentas de leitura do
    Analista — nenhuma que escreva.

⚠️ É LIDO NA HORA, a cada pergunta, e não guardado: a extensão liga e desliga
com o programa aberto, e desligar tem de tirar o agente da lista na próxima
abertura do popover. (O `.md` que já foi copiado para o projeto FICA — é a
regra "isto copia e nada nunca remove" do popover.)
"""

import os

from .constantes import caminho_absoluto, XT_SUBAGENTE_ARQUIVOS
from .descoberta import montar_arvore, folhas_na_ordem_da_lista


def agentes_da_oficina_de_extensoes():
    """`[{id, extensao, caminho_extensao, caminho}]` — um por item
    `{"recurso": "agente", "forma": "oficina"}` das extensões LIGADAS, na
    ordem de Programa › Extensões. `caminho` é o absoluto do `.md`.

    Nunca lança: uma falha ao listar as extensões devolve lista vazia, e o
    popover continua com os agentes da biblioteca."""
    try:
        folhas = folhas_na_ordem_da_lista(montar_arvore())
    except Exception as e:
        print('[extensoes] falha ao listar os agentes de extensão:', e)
        return []
    saida = []
    for folha in folhas:
        if not folha.get('ligado'):
            continue
        for item in folha.get('acrescenta') or []:
            if item.get('recurso') != 'agente' or item.get('forma') != 'oficina':
                continue
            caminho = os.path.join(caminho_absoluto(folha['caminho']),
                                   item['arquivo'].replace('/', os.sep))
            if not os.path.isfile(caminho):
                continue
            saida.append({'id': item['id'], 'extensao': folha['nome'],
                          'caminho_extensao': folha['caminho'], 'caminho': caminho})
    return saida


def agente_de_extensao(caminho_extensao, id_):
    """O agente `id_` da extensão `caminho_extensao`, se ela está ligada e o
    declara — ou `None`. A cópia só aceita o que a lista ofereceria agora."""
    for a in agentes_da_oficina_de_extensoes():
        if a['caminho_extensao'] == caminho_extensao and a['id'] == id_:
            return a
    return None


def subagentes_de_extensoes():
    """`[{id, nome, icone, descricao, fontes, extensao, caminho_extensao,
    pasta}]` — um por item `{"recurso": "agente", "forma": "subagente"}` das
    extensões LIGADAS, na ordem de Programa › Extensões. `pasta` é a absoluta.

    ⚠️ Lido NA HORA, e nunca guardado numa constante: a extensão liga e
    desliga com o programa aberto, e as listas do Chat e da Fila têm de
    acompanhar (Armadilha da fase 12: somar no import não funciona).

    Nunca lança: falhar ao listar devolve lista vazia, e o Chat e a Fila
    seguem com os subagentes do programa."""
    try:
        folhas = folhas_na_ordem_da_lista(montar_arvore())
    except Exception as e:
        print('[extensoes] falha ao listar os subagentes de extensão:', e)
        return []
    saida = []
    for folha in folhas:
        if not folha.get('ligado'):
            continue
        for item in folha.get('acrescenta') or []:
            if item.get('recurso') != 'agente' or item.get('forma') != 'subagente':
                continue
            pasta = os.path.join(caminho_absoluto(folha['caminho']),
                                 item['pasta'].replace('/', os.sep))
            if not os.path.isdir(pasta):
                continue
            saida.append({'id': item['id'], 'nome': item['nome'], 'icone': item['icone'],
                          'descricao': item['descricao'], 'fontes': list(item['fontes']),
                          'extensao': folha['nome'], 'caminho_extensao': folha['caminho'],
                          'pasta': pasta,
                          # Fase 07 (D51, D52): o que ele chama, se recebe
                          # envelope, e os ids antigos que ele substitui.
                          'ferramentas': list(item.get('ferramentas') or []),
                          'envelope': bool(item.get('envelope')),
                          'antes': list(item.get('antes') or [])})
    return saida


def arquivo_do_subagente_de_extensao(id_, nome_do_arquivo):
    """O caminho absoluto de `system-prompt.txt`, `prompt-correcao.txt` ou
    `bloco.txt` do subagente `id_` — ou `None` se nenhuma extensão ligada o
    declara (ou se o nome não é um dos três). É a reserva de
    `caminhos.obter_prompt_do_subagente`/`obter_bloco_de_subagente` para id
    fora do mapa do programa."""
    if nome_do_arquivo not in XT_SUBAGENTE_ARQUIVOS:
        return None
    for s in subagentes_de_extensoes():
        if s['id'] == id_:
            return os.path.join(s['pasta'], nome_do_arquivo)
    return None


# ── Fase 07 (D51, D52): ferramentas e trechos de prompt ──────────────────

def _itens_das_ligadas(recurso):
    """`[(folha, item)]` dos itens `recurso` das extensões LIGADAS, na ordem
    de Programa › Extensões. Lido NA HORA, como os subagentes. Nunca lança."""
    try:
        folhas = folhas_na_ordem_da_lista(montar_arvore())
    except Exception as e:
        print('[extensoes] falha ao listar os itens "%s" das extensões:' % recurso, e)
        return []
    return [(folha, item) for folha in folhas if folha.get('ligado')
            for item in (folha.get('acrescenta') or []) if item.get('recurso') == recurso]


def ferramentas_de_extensoes():
    """`[{nome, id, devolve, se_errar, fonte, subagentes_do_programa,
    extensao, caminho_extensao}]` — uma por item `ferramenta` das extensões
    LIGADAS. Duas ligadas com o mesmo `nome`: vale a que vem antes na lista,
    e a outra fica de fora com o aviso no console (o modelo chama pelo nome,
    e um nome não pode ter dois donos)."""
    saida, vistos = [], set()
    for folha, item in _itens_das_ligadas('ferramenta'):
        if item['nome'] in vistos:
            print('[extensoes] a ferramenta "%s" da extensão "%s" ficou de fora: outra '
                  'extensão ligada já a declara.' % (item['nome'], folha['nome']))
            continue
        vistos.add(item['nome'])
        saida.append({'nome': item['nome'], 'id': item['id'], 'devolve': item['devolve'],
                      'se_errar': item['se_errar'], 'fonte': item.get('fonte', ''),
                      'subagentes_do_programa': list(item.get('subagentes_do_programa') or []),
                      'extensao': folha['nome'], 'caminho_extensao': folha['caminho']})
    return saida


def ferramenta_de_extensao(nome):
    """O item de `ferramentas_de_extensoes()` que se chama `nome`, ou `None`."""
    for f in ferramentas_de_extensoes():
        if f['nome'] == nome:
            return f
    return None


def trechos_de_prompt(alvo):
    """`[{id, extensao, caminho_extensao, arquivo}]` — os trechos das
    extensões LIGADAS para o prompt `alvo`, na ordem de Programa › Extensões.
    `arquivo` é o caminho absoluto, ou `None` quando o texto vem do backend
    (ação `xt.prompt`)."""
    saida = []
    for folha, item in _itens_das_ligadas('prompt'):
        if item.get('alvo') != alvo:
            continue
        arquivo = item.get('arquivo') or ''
        saida.append({'id': item['id'], 'extensao': folha['nome'],
                      'caminho_extensao': folha['caminho'],
                      'arquivo': (os.path.join(caminho_absoluto(folha['caminho']),
                                               arquivo.replace('/', os.sep))
                                  if arquivo else None)})
    return saida
