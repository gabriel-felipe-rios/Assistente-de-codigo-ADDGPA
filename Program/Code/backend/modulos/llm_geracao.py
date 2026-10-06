"""O que vai numa chamada ao LM Studio além das mensagens: o modelo escolhido,
o pensamento de cada área e os ajustes de geração. Com a caixa-mestra
desmarcada, nada — e vale o LM Studio.

Irmão de `llm_cliente.py`: aquele decide COMO se conecta, este decide O QUE vai
na chamada. Tudo sai do cartão "Modelo e geração" de Configurações › Modelo e
contexto (`PADROES_DO_MODELO_E_GERACAO`, em `padroes_de_fabrica.py`).

⚠️ Com `usar_config_do_programa` desligado, `ajustes_da_chamada` devolve `{}` e
`modelo_escolhido` devolve `None`: nem temperatura, nem pensamento, nem modelo.
O usuário afinou o LM Studio lá dentro, e o programa não passa por cima disso.
Com a caixa ligada, também só vai o campo PREENCHIDO — vazio é "vale o do LM
Studio".

⚠️ `reasoning_effort` só vai para modelo que pensa. O LM Studio aceita
`"none"` (desliga) e `"medium"` (liga); `"on"`/`"off"` dão erro 400. As opções
de cada modelo vêm de `/api/v1/models` (`capabilities.reasoning`), e só quem
pensa tem essa chave — mandar o argumento a um modelo que não pensa pode dar
erro, então ele não vai.

Os imports de `urllib` e `json` são locais, como os do `openai` em
`llm_cliente.py`: este módulo é alcançado por caminhos que nunca falam com o
LM Studio.
"""

from .llm_cliente import obter_endereco_do_lm_studio

# As cinco áreas que ligam ou desligam o pensamento em separado. O Verificador
# da Fila roda pelo mesmo `executar_subagente`, então conta como Subagentes.
AREAS = ('rotinas', 'chat', 'fila', 'subagentes', 'designer')

# Cache de sessão: {id do modelo: [opções de raciocínio permitidas]}. Lista
# vazia = o modelo não pensa. Preenchido por `listar_modelos_do_lm_studio`.
_RACIOCINIO_POR_MODELO = {}


def _ler_json_do_lm_studio(url):
    import json
    import urllib.request
    with urllib.request.urlopen(url, timeout=3) as resp:
        return json.loads(resp.read().decode('utf-8'))


def listar_modelos_do_lm_studio(settings):
    """Os modelos de conversa do LM Studio: o que existe, o que está carregado e
    o que pensa.

    Devolve `{'success': True, 'modelos': [{'id', 'nome', 'carregado', 'pensa'}]}`.
    Tenta primeiro `/api/v1/models`, a única que diz quem pensa; sem ela, cai em
    `/api/v0/models` (a que `get_context_window` já usa), e aí `pensa` fica
    vazio para todos.
    """
    raiz = obter_endereco_do_lm_studio(settings)
    try:
        dados = _ler_json_do_lm_studio(raiz + '/api/v1/models')
        modelos = []
        for m in dados.get('models', []):
            if m.get('type') != 'llm':
                continue
            pensa = list(((m.get('capabilities') or {}).get('reasoning') or {})
                         .get('allowed_options') or [])
            instancias = m.get('loaded_instances') or []
            modelos.append({
                'id': m.get('key'),
                'nome': m.get('display_name') or m.get('key'),
                'carregado': bool(instancias),
                'pensa': pensa,
            })
            _RACIOCINIO_POR_MODELO[m.get('key')] = pensa
            # O Chat manda o id da INSTÂNCIA carregada, que pode não ser a key.
            for inst in instancias:
                if inst.get('id'):
                    _RACIOCINIO_POR_MODELO[inst['id']] = pensa
        return {'success': True, 'modelos': modelos}
    except Exception as e_v1:
        try:
            dados = _ler_json_do_lm_studio(raiz + '/api/v0/models')
            modelos = [{
                'id': m.get('id'),
                'nome': m.get('id'),
                'carregado': m.get('state') == 'loaded',
                'pensa': [],
            } for m in dados.get('data', []) if m.get('type') != 'embeddings']
            return {'success': True, 'modelos': modelos}
        except Exception as e_v0:
            return {'success': False, 'error': str(e_v0) or str(e_v1), 'modelos': []}


def modelo_escolhido(settings):
    """O modelo do cartão, ou `None` — e aí vale o carregado no LM Studio."""
    settings = settings or {}
    if not settings.get('usar_config_do_programa'):
        return None
    return (settings.get('modelo_escolhido') or '').strip() or None


def _numero(valor, tipo):
    """O valor do campo convertido, ou `None` se o campo está vazio."""
    if valor is None or valor == '':
        return None
    try:
        return tipo(valor)
    except (TypeError, ValueError):
        return None


def ajustes_da_chamada(settings, area, modelo):
    """O dicionário para espalhar em `create(...)`/`chat_json(...)`.

    Caixa-mestra desligada → `{}`. Ligada: `temperature` e `top_p` como
    argumentos nomeados, `top_k`, `min_p` e `repeat_penalty` dentro de
    `extra_body` (o SDK `openai` não os conhece), cada um só se o campo tiver
    valor; e o pensamento da `area`, só para modelo que pensa.
    """
    settings = settings or {}
    if not settings.get('usar_config_do_programa'):
        return {}

    ajustes = {}
    for chave, arg, tipo in (('geracao_temperatura', 'temperature', float),
                             ('geracao_top_p', 'top_p', float)):
        valor = _numero(settings.get(chave), tipo)
        if valor is not None:
            ajustes[arg] = valor

    extra = {}
    for chave, arg, tipo in (('geracao_top_k', 'top_k', int),
                             ('geracao_min_p', 'min_p', float),
                             ('geracao_repeat_penalty', 'repeat_penalty', float)):
        valor = _numero(settings.get(chave), tipo)
        if valor is not None:
            extra[arg] = valor
    if extra:
        ajustes['extra_body'] = extra

    if modelo and modelo not in _RACIOCINIO_POR_MODELO:
        if listar_modelos_do_lm_studio(settings).get('success'):
            # A lista veio e o modelo não estava nela: não pergunta de novo a
            # cada chamada. Se o LM Studio não respondeu, pergunta na próxima.
            _RACIOCINIO_POR_MODELO.setdefault(modelo, [])
    opcoes = _RACIOCINIO_POR_MODELO.get(modelo) or []
    if settings.get('pensamento_' + area):
        if 'on' in opcoes:
            ajustes['reasoning_effort'] = 'medium'
    elif 'off' in opcoes:
        ajustes['reasoning_effort'] = 'none'
    return ajustes
