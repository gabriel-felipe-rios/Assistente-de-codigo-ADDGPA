"""Linha do tempo — lê o histórico que o Plugin base publica e agrega por pasta.

Este plugin não coleta nada. Quem varre os projetos é o **Plugin base**, que
grava, por projeto, `files/{projeto}/dias/{AAAA-MM-DD}.json` com o que mudou
naquele dia. O formato é contrato público, documentado em
`Como usar o Plugin base.md`, e a leitura direta do disco é a exceção
autorizada em `Como criar plugins.md` › "Consultar dados que outro plugin já
capturou".

⛔ **Nunca** `chamar_plugin('Plugin base', ...)`, nunca importar o
`plugin_boot.py` dele, nunca escrever nada dentro da pasta dele. Só ler.

## Por que TUDO mora neste arquivo

`chamar_plugin` faz `exec_module` sobre este arquivo a **cada** chamada (ver
`Program/Code/backend/modulos/plugins.py::_importar_modulo_do_plugin`), e a
pasta do plugin não está no `sys.path`. Consequências, as duas duras:

1. Um segundo `.py` aqui em `backend/` não pode ser importado com `import`
   normal — estouraria. Por isso um arquivo só.
2. **Cache em memória é impossível**: variável de módulo e `lru_cache` morrem
   no fim de cada chamada. Não adianta tentar.

## Por que a agregação é aqui, e não no JS

Uma janela de 365 dias de um projeto ativo tem 3–8 mil eventos, 1–3 MB de
JSON. Ler isso em Python custa 150–400 ms — irrelevante. O que **não** cabe é
despejar esses megabytes pela ponte do pywebview, que serializa tudo em
string. Agregando aqui, a ponte carrega ~10 KB: as trilhas e o eixo por dia.
Os eventos de um bloco só viajam quando o usuário clica nele.
"""

import os
import json
from datetime import date, timedelta


VERSAO = 1

# A faixa de trilhas em que a tela fica legível. Medido no projeto real
# (462 arquivos): profundidade 1 dá UMA trilha (tudo é "Program/"),
# 3 dá 5, 4 dá 11, e a pasta completa dá 43 — ilegível. Por isso a
# profundidade é escolhida automaticamente em vez de ter um valor fixo:
# um número fixo que serve aqui quebra num projeto de outro formato.
ALVO_MIN, ALVO_MAX = 6, 15
TETO_TRILHAS = 15
PROFUNDIDADE_MAX = 8

TIPOS_DE_ARQUIVO = ('criado', 'editado', 'apagado', 'movido')


# ── Ponto de entrada ─────────────────────────────────────────────────────────

def executar(payload):
    acao = payload.get('acao')
    try:
        if acao == 'carregar_janela':
            return _carregar_janela(payload)
        if acao == 'carregar_bloco':
            return _carregar_bloco(payload)
        if acao == 'carregar_dia':
            return _carregar_dia(payload)
    except Exception as e:
        return {'success': False, 'error': str(e)}
    return {'success': False, 'error': 'Ação desconhecida: %s' % acao}


# ── Onde o dado do Plugin base mora ─────────────────────────────────────────

def _pasta_plugins():
    """Acha `Program/External/plugins/` no próprio caminho absoluto. Nunca
    contar `..` fixos: o usuário pode mover este plugin para dentro de uma
    categoria a qualquer momento, e o número de níveis mudaria."""
    aqui = os.path.abspath(__file__)
    marcador = os.path.join('Program', 'External', 'plugins') + os.sep
    idx = aqui.find(marcador)
    if idx == -1:
        raise RuntimeError('plugin fora de Program/External/plugins/')
    return aqui[:idx + len(marcador)]


def _pasta_do_projeto(alvo):
    # `os.path.basename` é a mesma defesa que o Plugin base usa em
    # `_nome_seguro` — o nome vem do frontend e nunca entra cru num caminho.
    nome = os.path.basename(str(alvo or '').strip())
    if not nome:
        return None
    return os.path.join(_pasta_plugins(), 'Plugin base', 'files', nome)


def _carregar_json(caminho, padrao=None):
    # `FileNotFoundError` acontece de verdade: um dia pode nascer entre o
    # `listdir` e o `open`, porque o Plugin base grava em segundo plano.
    try:
        with open(caminho, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return padrao


# ── Os dias, e os três estados de um dia ────────────────────────────────────

def _dias_do_intervalo(primeiro, ultimo):
    dias, atual = [], primeiro
    while atual <= ultimo:
        dias.append(atual.isoformat())
        atual += timedelta(days=1)
    return dias


def _estado_do_dia(arquivo):
    """⚠️ São TRÊS estados, não dois — e o discriminante é `capturas`, nunca
    `fechamento == null` (que na prática o Plugin base nunca grava).

    Quando um evento é datado retroativamente num dia que nunca teve captura,
    o Plugin base CRIA o arquivo daquele dia, mas só preenche os contadores:
    `arquivos`, `linhas` e `capturas` ficam de fora, porque não há como
    recontar as linhas de um dia que já passou (ver `_arquivar`, onde o
    retrato é gateado por `if dia == hoje`). Tratar isso como um dia normal
    faz `arquivos` chegar `undefined` na tela.
    """
    if arquivo is None:
        return 'sem_captura'
    fechamento = arquivo.get('fechamento') or {}
    if not fechamento.get('capturas'):
        return 'parcial'
    return 'ok' if (arquivo.get('eventos') or []) else 'zero'


# ── Eventos: caminho, filtro e saldo de linhas ──────────────────────────────

def _caminho_do_evento(evento):
    """Onde o evento "aconteceu", para efeito de trilha.

    `movido` conta **só em `para`** — é onde o arquivo está agora, e é a pasta
    que recebeu trabalho. Contar nos dois lados infla o total da trilha e faz
    a soma das trilhas não bater com o total do dia, o que é impossível de
    explicar numa tela.

    `projeto_renomeado` não tem caminho nenhum: é metadado do projeto, não
    trabalho numa pasta. Devolve None e sai da agregação — vira marca na
    régua. (Cair num `(raiz)` por acidente seria uma trilha mentirosa.)
    """
    tipo = evento.get('tipo')
    if tipo == 'movido':
        return evento.get('para')
    if tipo == 'projeto_renomeado':
        return None
    return evento.get('caminho')


def _passa_no_filtro(evento, filtro, tipos):
    if tipos and evento.get('tipo') not in tipos:
        return False
    if filtro:
        alvo = (evento.get('caminho') or '') + ' ' + \
               (evento.get('de') or '') + ' ' + (evento.get('para') or '')
        if filtro not in alvo.lower():
            return False
    return True


def _saldo(evento):
    """(ganhas, perdidas, desconhecido) — a mesma regra do Plugin base.

    `linhas: null` NUNCA vira zero (geraria um "−1.200 fantasma" quando um
    arquivo fica ilegível por um instante); vira `desconhecido`. Binário não
    entra em conta nenhuma: o número de "linhas" de um .png não quer dizer
    nada, e isso não é ignorância nossa, então também não é desconhecido."""
    if evento.get('binario'):
        return 0, 0, False
    tipo = evento.get('tipo')
    if tipo in ('movido', 'projeto_renomeado'):
        return 0, 0, False          # mesmo arquivo noutro lugar: saldo zero
    if tipo == 'criado':
        linhas = evento.get('linhas')
        return (linhas, 0, False) if isinstance(linhas, int) else (0, 0, True)
    if tipo == 'apagado':
        antes = evento.get('linhas_antes')
        return (0, antes, False) if isinstance(antes, int) else (0, 0, True)
    if tipo == 'editado':
        antes, depois = evento.get('linhas_antes'), evento.get('linhas')
        if not isinstance(antes, int) or not isinstance(depois, int):
            return 0, 0, True
        delta = depois - antes
        return (delta, 0, False) if delta >= 0 else (0, -delta, False)
    return 0, 0, False


# ── A pasta de um caminho, na profundidade escolhida ────────────────────────

def _prefixos_conhecidos(atual):
    """O Plugin base prefixa TODO caminho com o nome da pasta de trabalho,
    mesmo quando só existe uma — e, quando duas colidem de nome, o prefixo
    vira `mãe/nome`. Descontar isso faz "profundidade 2" querer dizer a mesma
    coisa em qualquer projeto.

    Os prefixos saem das `working_folders` que o próprio `atual.json` guarda —
    não se reimplementa `_prefixos_das_bases`, que é lógica privada do outro
    plugin e pode mudar sem aviso."""
    nomes = set()
    for caminho in (atual.get('working_folders') or []):
        limpo = str(caminho).rstrip('\\/')
        base = os.path.basename(limpo)
        if not base:
            continue
        nomes.add(base)
        mae = os.path.basename(os.path.dirname(limpo))
        if mae:
            nomes.add(mae + '/' + base)
    return nomes


def _sem_prefixo(caminho, prefixos):
    partes = caminho.split('/')
    if len(partes) >= 3 and '/'.join(partes[:2]) in prefixos:
        return '/'.join(partes[2:])
    if len(partes) >= 2 and partes[0] in prefixos:
        return '/'.join(partes[1:])
    return caminho


def _pasta_em(caminho, profundidade):
    partes = caminho.split('/')[:-1]        # tira o nome do arquivo
    if not partes:
        return '(raiz)'
    if profundidade is None:
        return '/'.join(partes)
    return '/'.join(partes[:profundidade]) or '(raiz)'


def _escolher_profundidade(caminhos):
    """A menor profundidade que produza entre 6 e 15 trilhas.

    Sem isso, um valor fixo quebra: no projeto real, profundidade 1 mostra uma
    trilha só e o usuário conclui que o plugin está com defeito."""
    if not caminhos:
        return 2
    anterior = 1
    for profundidade in range(1, PROFUNDIDADE_MAX + 1):
        quantas = len({_pasta_em(c, profundidade) for c in caminhos})
        if quantas >= ALVO_MIN:
            return profundidade if quantas <= ALVO_MAX else anterior
        anterior = profundidade
    return anterior


# ── A janela: uma leitura, dois produtos (eixo + trilhas) ───────────────────

def _carregar_janela(payload):
    # ⛔ A chave é `alvo`, nunca `projeto`: `chamar_plugin` reage a `projeto`
    # abrindo o grafo.json inteiro e parseando o pipeline.md, em TODA chamada,
    # e nada disso é usado aqui.
    pasta = _pasta_do_projeto(payload.get('alvo'))
    if not pasta:
        return {'success': False, 'error': 'Projeto vazio.'}
    atual = _carregar_json(os.path.join(pasta, 'atual.json'))
    if not isinstance(atual, dict):
        return {'success': False, 'error': 'sem_dado'}

    try:
        quantos = max(1, min(int(payload.get('dias') or 30), 3650))
    except (TypeError, ValueError):
        quantos = 30
    hoje = date.today()
    dias = _dias_do_intervalo(hoje - timedelta(days=quantos - 1), hoje)
    primeiro, ultimo = dias[0], dias[-1]

    filtro = str(payload.get('filtro') or '').strip().lower()
    tipos = [t for t in (payload.get('tipos') or []) if t in TIPOS_DE_ARQUIVO]

    pasta_dias = os.path.join(pasta, 'dias')
    try:
        existentes = {n[:-5] for n in os.listdir(pasta_dias) if n.endswith('.json')}
    except OSError:
        existentes = set()

    prefixos = _prefixos_conhecidos(atual)
    eixo, renomeios = [], []
    por_dia = {}          # dia -> [(caminho_sem_prefixo, evento)]

    for dia in dias:
        if dia not in existentes:
            eixo.append({'dia': dia, 'estado': 'sem_captura', 'ganhas': 0,
                         'perdidas': 0, 'desconhecidas': 0, 'eventos': 0})
            continue
        arquivo = _carregar_json(os.path.join(pasta_dias, dia + '.json'))
        estado = _estado_do_dia(arquivo)
        if arquivo is None:
            eixo.append({'dia': dia, 'estado': 'sem_captura', 'ganhas': 0,
                         'perdidas': 0, 'desconhecidas': 0, 'eventos': 0})
            continue

        ganhas = perdidas = desconhecidas = 0
        guardados = []
        for evento in (arquivo.get('eventos') or []):
            if evento.get('tipo') == 'projeto_renomeado':
                renomeios.append({'dia': dia, 'de': evento.get('de'),
                                  'para': evento.get('para')})
                continue
            if not _passa_no_filtro(evento, filtro, tipos):
                continue
            g, p, desconhecido = _saldo(evento)
            ganhas += g
            perdidas += p
            desconhecidas += 1 if desconhecido else 0
            caminho = _caminho_do_evento(evento)
            if caminho:
                guardados.append((_sem_prefixo(caminho, prefixos), evento))
        if guardados:
            por_dia[dia] = guardados

        # Os contadores são recalculados dos eventos, e não lidos do
        # `fechamento`: com filtro ativo o fechamento contaria o que a tela
        # não está mostrando. Sem filtro, os dois dão o mesmo número.
        fechamento = arquivo.get('fechamento') or {}
        eixo.append({
            'dia': dia, 'estado': estado,
            'ganhas': ganhas, 'perdidas': perdidas, 'desconhecidas': desconhecidas,
            'eventos': len(guardados),
            # Só existem em dia com captura de verdade — no dia "parcial" o
            # Plugin base não tem como saber o retrato, e omitir é honesto.
            'arquivos': fechamento.get('arquivos'),
            'linhas': fechamento.get('linhas'),
        })

    caminhos = [c for lista in por_dia.values() for c, _ in lista]
    bruto = payload.get('profundidade')
    if bruto in (None, '', 'auto'):
        profundidade = _escolher_profundidade(caminhos)
    elif bruto == 'completa':
        profundidade = None
    else:
        try:
            profundidade = max(1, min(int(bruto), PROFUNDIDADE_MAX))
        except (TypeError, ValueError):
            profundidade = _escolher_profundidade(caminhos)

    trilhas, outras = _montar_trilhas(por_dia, dias, profundidade)

    return {'success': True, 'versao': VERSAO,
            'atualizado_em': atual.get('atualizado_em'),
            'historico_desde': atual.get('historico_desde'),
            'hoje': ultimo, 'primeiro': primeiro,
            'profundidade': 'completa' if profundidade is None else profundidade,
            'eixo': eixo, 'trilhas': trilhas, 'outras': outras,
            'renomeios': renomeios}


def _montar_trilhas(por_dia, dias, profundidade):
    """Agrupa por pasta e funde dias SEGUIDOS num bloco só.

    A fusão é o que faz o desenho parecer clipe de editor de vídeo em vez de
    tracejado de quadradinhos — que era justamente o defeito da matriz que o
    usuário vetou."""
    indice_do_dia = {dia: i for i, dia in enumerate(dias)}
    contagem = {}
    for dia, lista in por_dia.items():
        for caminho, _evento in lista:
            pasta = _pasta_em(caminho, profundidade)
            contagem.setdefault(pasta, {}).setdefault(dia, 0)
            contagem[pasta][dia] += 1

    def blocos_de(por_dia_da_pasta):
        indices = sorted(indice_do_dia[d] for d in por_dia_da_pasta)
        blocos, atual = [], None
        for i in indices:
            quantidade = por_dia_da_pasta[dias[i]]
            if atual and i == atual['_fim'] + 1:
                atual['_fim'] = i
                atual['qtd'] += quantidade
            else:
                if atual:
                    blocos.append(atual)
                atual = {'_ini': i, '_fim': i, 'qtd': quantidade}
        if atual:
            blocos.append(atual)
        # ⚠️ `ini`/`fim` são DATAS, nunca índices: índice muda quando a janela
        # ou a profundidade mudam, e o painel da direita passaria a mostrar
        # outro bloco em silêncio.
        return [{'ini': dias[b['_ini']], 'fim': dias[b['_fim']], 'qtd': b['qtd']}
                for b in blocos]

    ordenadas = sorted(contagem,
                       key=lambda p: (-sum(contagem[p].values()), p))
    visiveis, restantes = ordenadas[:TETO_TRILHAS], ordenadas[TETO_TRILHAS:]

    trilhas = [{'pasta': pasta, 'total': sum(contagem[pasta].values()),
                'blocos': blocos_de(contagem[pasta])} for pasta in visiveis]

    # "outras" também vem com blocos: uma trilha rotulada e vazia parece
    # defeito na tela, e o usuário perderia a informação de QUANDO houve
    # trabalho nas pastas que não couberam no teto.
    juntas = {}
    for pasta in restantes:
        for dia, quantidade in contagem[pasta].items():
            juntas[dia] = juntas.get(dia, 0) + quantidade
    outras = {'pastas': len(restantes),
              'total': sum(juntas.values()),
              'blocos': blocos_de(juntas) if juntas else [],
              'nomes': restantes}
    return trilhas, outras


# ── Os eventos de um bloco, e os de um dia ──────────────────────────────────

def _eventos_do_intervalo(payload, primeiro, ultimo, pasta_alvo=None):
    pasta = _pasta_do_projeto(payload.get('alvo'))
    if not pasta:
        return None, {'success': False, 'error': 'Projeto vazio.'}
    atual = _carregar_json(os.path.join(pasta, 'atual.json'))
    if not isinstance(atual, dict):
        return None, {'success': False, 'error': 'sem_dado'}

    filtro = str(payload.get('filtro') or '').strip().lower()
    tipos = [t for t in (payload.get('tipos') or []) if t in TIPOS_DE_ARQUIVO]
    prefixos = _prefixos_conhecidos(atual)
    profundidade = payload.get('profundidade_efetiva')
    if profundidade == 'completa':
        profundidade = None

    achados = []
    for dia in _dias_do_intervalo(date.fromisoformat(primeiro),
                                  date.fromisoformat(ultimo)):
        arquivo = _carregar_json(os.path.join(pasta, 'dias', dia + '.json'))
        if not isinstance(arquivo, dict):
            continue
        for evento in (arquivo.get('eventos') or []):
            if evento.get('tipo') == 'projeto_renomeado':
                continue
            if not _passa_no_filtro(evento, filtro, tipos):
                continue
            caminho = _caminho_do_evento(evento)
            if not caminho:
                continue
            if pasta_alvo is not None:
                curto = _sem_prefixo(caminho, prefixos)
                if _pasta_em(curto, profundidade) != pasta_alvo:
                    continue
            copia = dict(evento)
            copia['dia'] = dia
            achados.append(copia)
    return achados, None


def _carregar_bloco(payload):
    ini, fim = payload.get('ini'), payload.get('fim')
    if not ini or not fim:
        return {'success': False, 'error': 'Bloco sem intervalo.'}
    eventos, erro = _eventos_do_intervalo(payload, ini, fim, payload.get('pasta'))
    if erro:
        return erro
    return {'success': True, 'eventos': eventos}


def _carregar_dia(payload):
    dia = payload.get('dia')
    if not dia:
        return {'success': False, 'error': 'Dia vazio.'}
    eventos, erro = _eventos_do_intervalo(payload, dia, dia)
    if erro:
        return erro
    return {'success': True, 'eventos': eventos}
