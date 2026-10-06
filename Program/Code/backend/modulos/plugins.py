import os
import json
import importlib.util

from .constantes import CODE_DIR
from .payload_de_projeto import enriquecer as enriquecer_payload
# A varredura da árvore, o estado em Internal/config/ e a ordem arrastada
# são os MESMOS de Launchers e de Extensões do programa — moram em
# `arvore_externa.py` desde 04/09/2026. Daqui só sai o que é de plugin.
from .arvore_externa import (ler_json_de_config, gravar_json_de_config,
                             listar_folhas_recursivo, montar_no)

# Pasta-raiz dos plugins — irmã de Code/, dentro de External/. Exceção
# registrada em Saída das skills/Arquitetura modular/Exceções.md: é código
# do próprio usuário, mas fica em External/ porque a natureza do recurso
# (descartável, isolado, plugável) pesa mais que o critério de autoria do
# balde.
PLUGINS_DIR = os.path.abspath(os.path.join(CODE_DIR, '..', 'External', 'plugins'))

# O que o usuário escolheu por plugin (ligado, e onde aparece) — não é
# padrão de fábrica nem dado que o plugin gera, então mora em Internal/config/
# como todo o resto que o usuário configurou.
PLUGINS_CONFIG_FILE = 'plugins.json'

# A ordem que o usuário arrastou em Configurações › Plugins — arquivo
# próprio, à parte de `plugins.json` (que é por-plugin, chave = caminho
# relativo), porque isto é uma lista por NÍVEL de pasta, sem dono. Mesmo
# padrão de `launchers-ordem.json`.
PLUGINS_ORDER_FILE = 'plugins-ordem.json'

# O manifesto na RAIZ da pasta do plugin, como o `extensao.json` da extensão
# (D26, D31 da discussão "Configurações, extensões lidas e Como adicionar").
# A presença dele é o que faz uma pasta ser plugin; o conteúdo diz o tipo e
# os caminhos de entrada. Ver `Program/Code/prompts/Como adicionar/Plugins/Contrato/Como criar plugins.md`.
_PLUGIN_MANIFESTO = 'plugin.json'
_PLUGIN_TIPOS = ('automático', 'manual', 'isolado')
# Só o automático roda o `boot` — no boot do programa e ao ligar (D31).
_PLUGIN_TIPO_AUTOMATICO = 'automático'
# Os caminhos de entrada que o manifesto pode declarar, e o padrão de cada um
# (os nomes fixos de antes do manifesto). Sempre com `/`, relativos à pasta.
_PLUGIN_CAMINHOS_PADRAO = {
    'frontend': 'frontend/index.js',
    'backend': 'backend/plugin.py',
    'boot': 'plugin_boot.py',
}
# O manifesto diz o ARQUIVO, nunca o nome da função: estas duas continuam fixas.
_PLUGIN_FUNC_EXECUTAR = 'executar'
_PLUGIN_FUNC_BOOT = 'iniciar'


def _eh_pasta_de_plugin(caminho_abs):
    """Uma pasta é ELA MESMA um plugin (folha) se tiver o `plugin.json` na
    própria raiz — mesmo com o manifesto quebrado: aí ela aparece na lista
    com o erro e desligada, nunca some calada. Uma pasta sem ele é pura
    organização (categoria) e o scanner recursa nela procurando mais
    plugins/categorias dentro."""
    return os.path.isfile(os.path.join(caminho_abs, _PLUGIN_MANIFESTO))


def _eh_folha_plugin(caminho_abs):
    """O critério de folha que `arvore_externa` recebe: só PASTA vira plugin
    (um arquivo solto em External/plugins/ é ignorado, como sempre foi)."""
    return os.path.isdir(caminho_abs) and _eh_pasta_de_plugin(caminho_abs)


def _caminho_plugin_absoluto(caminho_relativo):
    return os.path.join(PLUGINS_DIR, caminho_relativo.replace('/', os.sep))


def _caminho_de_entrada(bruto, campo, erros):
    """Valida UM caminho de entrada declarado no manifesto (`frontend`,
    `backend`, `boot`). Devolve o caminho normalizado com `/`, ou None — e
    aí a frase já entrou em `erros`. Nunca sai da pasta do plugin: nem
    absoluto, nem `..`."""
    frase = '`%s` precisa ser um caminho dentro da pasta do plugin' % campo
    if not isinstance(bruto, str) or not bruto.strip():
        erros.append(frase)
        return None
    caminho = bruto.strip().replace('\\', '/')
    partes = [p for p in caminho.split('/') if p not in ('', '.')]
    if (caminho.startswith('/') or os.path.isabs(caminho) or ':' in caminho
            or '..' in partes or not partes):
        erros.append(frase)
        return None
    return '/'.join(partes)


def ler_manifesto_plugin(caminho_relativo):
    """Lê e valida o `plugin.json` de UM plugin, no molde de
    `extensoes/manifesto.py::ler_manifesto` — nunca levanta.

    Devolve `{'ok': bool, 'manifesto': {...}, 'erros': [str]}`. `manifesto`
    vem sempre preenchido (com os padrões, se o arquivo não deu para ler),
    para quem consome nunca precisar checar se a chave existe.

    `ok` é False quando o plugin não pode LIGAR: arquivo ilegível, topo que não
    é objeto, `tipo` ausente ou fora dos três, caminho de entrada fora da
    pasta, ou nem o frontend nem o backend existem no disco. Erro em `nome`,
    `versao` ou `descricao` entra em `erros`, mas não desliga.

    Lido a cada listagem, sem cache: o usuário edita o manifesto com o
    programa aberto."""
    padrao = {
        'nome': os.path.basename(caminho_relativo.replace('\\', '/').rstrip('/')),
        'versao': '',
        'descricao': '',
        'tipo': '',
    }
    padrao.update(_PLUGIN_CAMINHOS_PADRAO)
    caminho = os.path.join(_caminho_plugin_absoluto(caminho_relativo), _PLUGIN_MANIFESTO)

    try:
        with open(caminho, 'r', encoding='utf-8') as f:
            bruto = json.load(f)
    except json.JSONDecodeError as e:
        # A mensagem do parser, inteira: é ela que diz onde está a vírgula.
        return {'ok': False, 'manifesto': padrao,
                'erros': ['%s não é um JSON válido — %s' % (_PLUGIN_MANIFESTO, e)]}
    except (OSError, UnicodeDecodeError) as e:
        return {'ok': False, 'manifesto': padrao,
                'erros': ['não deu para ler o %s: %s' % (_PLUGIN_MANIFESTO, e)]}

    if not isinstance(bruto, dict):
        return {'ok': False, 'manifesto': padrao,
                'erros': ['%s precisa ter um objeto no topo (as chaves entre '
                          '`{` e `}`), e tem %s.' % (_PLUGIN_MANIFESTO, type(bruto).__name__)]}

    manifesto = dict(padrao)
    erros = []          # todos os erros, para a tela
    impede = False      # algum deles impede de ligar?

    nome = bruto.get('nome')
    if isinstance(nome, str):
        if nome.strip():
            manifesto['nome'] = nome.strip()
    elif nome is not None:
        erros.append('`nome` precisa ser um texto, e veio %s.' % type(nome).__name__)

    versao = bruto.get('versao')
    if isinstance(versao, (str, int, float)) and not isinstance(versao, bool):
        # Só rótulo, como na extensão — nada é comparado.
        manifesto['versao'] = str(versao)
    elif versao is not None:
        erros.append('`versao` precisa ser um texto, e veio %s.' % type(versao).__name__)

    descricao = bruto.get('descricao')
    if isinstance(descricao, str):
        manifesto['descricao'] = ' '.join(descricao.split())
    elif descricao is not None:
        erros.append('`descricao` precisa ser um texto, e veio %s.' % type(descricao).__name__)

    # `tipo` é obrigatório, e comparado com o acento (`automático`).
    tipo = bruto.get('tipo')
    if isinstance(tipo, str) and tipo.strip() in _PLUGIN_TIPOS:
        manifesto['tipo'] = tipo.strip()
    else:
        erros.append('`tipo` precisa ser automático, manual ou isolado, e veio "%s".'
                     % ('' if tipo is None else tipo))
        impede = True

    caminhos_validos = True
    for campo in _PLUGIN_CAMINHOS_PADRAO:
        if campo not in bruto:
            continue
        valor = _caminho_de_entrada(bruto.get(campo), campo, erros)
        if valor is None:
            impede = True
            caminhos_validos = False
        else:
            manifesto[campo] = valor

    if caminhos_validos:
        raiz = _caminho_plugin_absoluto(caminho_relativo)
        existe = lambda campo: os.path.isfile(
            os.path.join(raiz, manifesto[campo].replace('/', os.sep)))
        if not existe('frontend') and not existe('backend'):
            erros.append('nem %s nem %s existem — o plugin não tem o que abrir'
                         % (manifesto['frontend'], manifesto['backend']))
            impede = True

    return {'ok': not impede, 'manifesto': manifesto, 'erros': erros}


def _frase_de_erro_do_manifesto(lido):
    return 'O %s deste plugin tem erro: %s' % (_PLUGIN_MANIFESTO, '; '.join(lido['erros']))


def _ler_config_plugins():
    return ler_json_de_config(PLUGINS_CONFIG_FILE)


def _gravar_config_plugins(config):
    gravar_json_de_config(PLUGINS_CONFIG_FILE, config)


def _listar_plugins_recursivo(caminho_rel=''):
    """Caminhos relativos (achatados) de TODO plugin, em qualquer
    profundidade — para quem precisa da lista inteira sem a árvore (boot,
    Restaurar padrão)."""
    return listar_folhas_recursivo(PLUGINS_DIR, _eh_folha_plugin, caminho_rel, str.casefold)


def _plugin_existe(caminho_relativo):
    return _eh_folha_plugin(_caminho_plugin_absoluto(caminho_relativo))


def _ler_ordem_plugins():
    """`{caminho_da_pasta_pai: [nomes, na ordem]}` — `''` é a raiz. Uma
    lista por nível, igual `launchers-ordem.json`: serve tanto para
    as categorias quanto para os plugins DAQUELE nível, porque
    `aplicar_ordem` já filtra pelos nomes que existem em cada conjunto."""
    return ler_json_de_config(PLUGINS_ORDER_FILE, exigir_dicionario=True)


def _gravar_ordem_plugins(ordem_por_pasta):
    gravar_json_de_config(PLUGINS_ORDER_FILE, dict(ordem_por_pasta or {}))


def _montar_no_plugins(caminho_rel, config, ordem_por_pasta):
    """Monta recursivamente UM nó da árvore (raiz ou categoria). A varredura,
    a recursão e a ordem são de `arvore_externa`; o que é DAQUI é só o que
    cada folha carrega — o estado gravado em `plugins.json` e o que o
    `plugin.json` declara."""
    def montar_folha(caminho_item, nome):
        estado = config.get(caminho_item, {})
        lido = ler_manifesto_plugin(caminho_item)
        manifesto = lido['manifesto']
        return {
            'caminho': caminho_item,
            # `nome` é o nome DA PASTA — é ele que a ordem arrastada grava
            # (`plugins-ordem.json`, `data-plugin-nome`). O `nome` do
            # manifesto vai em `titulo`.
            'nome': nome,
            'titulo': manifesto['nome'],
            'versao': manifesto['versao'],
            'descricao': manifesto['descricao'],
            'tipo': manifesto['tipo'],
            'frontend': manifesto['frontend'],
            'ok': lido['ok'],
            'erros': lido['erros'],
            # Manifesto com erro desliga na TELA, mas o `ligado` gravado não
            # se apaga: consertou o JSON, volta ligado sozinho (como a extensão).
            'ligado': bool(estado.get('ligado', False)) and lido['ok'],
            'tela_principal': bool(estado.get('tela_principal', False)),
            'dentro_do_projeto': bool(estado.get('dentro_do_projeto', False)),
        }

    return montar_no(PLUGINS_DIR, caminho_rel, _eh_folha_plugin, montar_folha,
                     ordem_por_pasta, chave_folhas='plugins',
                     ordenar_folhas=True, chave_ordenacao=str.casefold)


def _importar_modulo_do_plugin(caminho_relativo, nome_arquivo_relativo, sufixo):
    """Importa dinamicamente UM arquivo .py de dentro da pasta de UM plugin,
    pelo caminho relativo (inclui subpasta, se o plugin estiver dentro de
    uma categoria); `nome_arquivo_relativo` é o caminho que o `plugin.json`
    declarou (ou o padrão). Devolve None se o arquivo não existir."""
    caminho = os.path.join(_caminho_plugin_absoluto(caminho_relativo), nome_arquivo_relativo)
    if not os.path.isfile(caminho):
        return None
    spec = importlib.util.spec_from_file_location(
        'plugin_%s_%s' % (abs(hash(caminho_relativo)), sufixo), caminho)
    if not spec or not spec.loader:
        return None
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def _importar_backend_do_plugin(caminho_relativo, manifesto):
    """Importa dinamicamente o backend de UM plugin — o arquivo que o
    `plugin.json` declara em `backend` (padrão `backend/plugin.py`). Devolve
    None se ele não tiver backend."""
    return _importar_modulo_do_plugin(
        caminho_relativo, manifesto['backend'].replace('/', os.sep), 'backend')


def _importar_boot_do_plugin(caminho_relativo, manifesto):
    """Importa dinamicamente o boot de UM plugin — o arquivo que o
    `plugin.json` declara em `boot` (padrão `plugin_boot.py`, na raiz).
    Devolve None se ele não existir."""
    return _importar_modulo_do_plugin(
        caminho_relativo, manifesto['boot'].replace('/', os.sep), 'boot')


# `{caminho_relativo: modulo}` dos plugin_boot.py cujo iniciar() já rodou
# nesta sessão. Importar de novo cria um módulo NOVO (e um segundo laço):
# é por isto que o boot nunca roda duas vezes para o mesmo plugin.
_BOOTS_INICIADOS = {}
_PLUGIN_FUNC_PARAR = 'parar'


def _iniciar_boot_do_plugin(caminho):
    """Chama o `iniciar()` do plugin_boot.py de UM plugin, no máximo uma vez
    por sessão — no boot (`_iniciar_plugins_ativos`) ou ao ligar
    (`save_config_plugin`). Só o plugin de `tipo` automático com o
    `plugin.json` sem erro roda o boot (D31) — um `manual` com `boot`
    declarado é ignorado. Pode lançar: quem chama trata."""
    if caminho in _BOOTS_INICIADOS:
        return
    lido = ler_manifesto_plugin(caminho)
    if not lido['ok'] or lido['manifesto']['tipo'] != _PLUGIN_TIPO_AUTOMATICO:
        return
    modulo = _importar_boot_do_plugin(caminho, lido['manifesto'])
    if modulo is None:
        return
    boot = getattr(modulo, _PLUGIN_FUNC_BOOT, None)
    if callable(boot):
        _BOOTS_INICIADOS[caminho] = modulo
        boot()


def _parar_boot_do_plugin(caminho):
    """Ao desligar: chama o `parar()` do MÓDULO GUARDADO — nunca de um
    reimportado, que seria outro módulo, sem o laço vivo. Plugin sem
    `parar()` fica no registro: o laço dele continua (o Plugin base relê o
    próprio estado a cada ciclo e pula o trabalho), e religar não cria outro."""
    modulo = _BOOTS_INICIADOS.get(caminho)
    if modulo is None:
        return
    parar = getattr(modulo, _PLUGIN_FUNC_PARAR, None)
    if not callable(parar):
        return
    try:
        parar()
    except Exception as e:
        # Não saiu do registro: o laço pode seguir vivo, e religar não pode
        # criar um segundo.
        print('[plugins] "%s" falhou em %s(): %s' % (caminho, _PLUGIN_FUNC_PARAR, e))
        return
    _BOOTS_INICIADOS.pop(caminho, None)


class PluginsMixin:
    def list_plugins(self):
        """Varre External/plugins/ recursivamente e devolve uma ÁRVORE
        (mesmo formato de `list_atalhos_externos`): uma pasta é ela mesma um
        plugin (folha, `_eh_pasta_de_plugin`) ou uma categoria pura, que
        agrupa mais plugins/categorias dentro — nunca as duas. Cada plugin
        leva o estado gravado em Internal/config/plugins.json, chaveado pelo
        CAMINHO relativo (não só o nome — dois plugins de categorias
        diferentes podem ter o mesmo nome de pasta). A ordem, por nível, é a
        que o usuário arrastou em Configurações › Plugins
        (`plugins-ordem.json`). De dentro da pasta do plugin, lê só o
        `plugin.json` — a cada listagem, sem cache."""
        config = _ler_config_plugins()
        ordem_por_pasta = _ler_ordem_plugins()
        return {'success': True, 'arvore': _montar_no_plugins('', config, ordem_por_pasta)}

    def save_plugins_order(self, ordem_por_pasta):
        """Grava, de uma vez, a ordem arrastada em Configurações › Plugins —
        um `{caminho_da_pasta_pai: [nomes]}` para TODOS os níveis que
        estavam na tela (a categoria só tem um botão "Salvar" para a árvore
        inteira, ao contrário de Launchers, que grava a cada pasta solta).
        Devolve a árvore já reordenada, pra tela repintar a partir do que foi
        de fato gravado."""
        try:
            _gravar_ordem_plugins(ordem_por_pasta)
        except OSError as e:
            return {'success': False, 'error': str(e)}
        return self.list_plugins()

    def save_config_plugin(self, caminho, patch):
        """Grava o estado de UM plugin (ligado / tela_principal /
        dentro_do_projeto), pelo caminho relativo dele (inclui a subpasta,
        se tiver). Efeito imediato — mesma regra do Interruptor, sem barra
        de Salvar.

        Ligar um plugin AUTOMÁTICO chama o `iniciar()` dele na hora (antes só
        rodava no próximo boot); desligar chama o `parar()`, se ele tiver. A
        falha do plugin vira `print` e nunca falha a gravação: o interruptor
        tem de mudar mesmo que o plugin quebre."""
        if not _plugin_existe(caminho):
            return {'success': False, 'error': 'Plugin não encontrado.'}
        # Ligar exige o `plugin.json` sem erro — a tela não é a fonte da
        # verdade (espelha `extensoes/estado.py`). Os dois checkboxes de local
        # continuam graváveis com erro.
        if (patch or {}).get('ligado'):
            lido = ler_manifesto_plugin(caminho)
            if not lido['ok']:
                return {'success': False, 'error': _frase_de_erro_do_manifesto(lido)}
        config = _ler_config_plugins()
        estado = config.get(caminho, {})
        estado.update(patch or {})
        config[caminho] = estado
        _gravar_config_plugins(config)
        if 'ligado' in (patch or {}):
            if patch['ligado']:
                try:
                    _iniciar_boot_do_plugin(caminho)
                except Exception as e:
                    print('[plugins] "%s" falhou ao iniciar ao ligar: %s' % (caminho, e))
            else:
                _parar_boot_do_plugin(caminho)
        return self.list_plugins()

    def reset_plugins(self):
        """Padrão de fábrica: todo plugin volta a desligado, sem aparecer em
        lugar nenhum (os dois checkboxes desmarcados). Grava e devolve no
        mesmo formato de `list_plugins`, para a tela repintar a partir do que
        foi de fato gravado."""
        config = {caminho: {'ligado': False, 'tela_principal': False, 'dentro_do_projeto': False}
                   for caminho in _listar_plugins_recursivo()}
        _gravar_config_plugins(config)
        # Desligar todos = a mesma regra do desligar de um (`save_config_plugin`).
        for caminho in list(_BOOTS_INICIADOS):
            _parar_boot_do_plugin(caminho)
        return self.list_plugins()

    def chamar_plugin(self, caminho, payload=None):
        """Despacha para a função fixa `executar` do backend de um plugin — o
        arquivo que o `plugin.json` declara em `backend` (padrão
        `backend/plugin.py`); o nome da função não vem do manifesto.
        `caminho` é o caminho relativo do plugin dentro de External/plugins/
        (inclui a subpasta, se o plugin estiver dentro de uma categoria — ex.
        "Dev/Meu Plugin"; sem subpasta, é só o nome, igual sempre foi).

        Se `payload['projeto']` vier preenchido, resolve e acrescenta:
          - `pasta_projeto`  — a raiz do código daquele projeto
          - `grafo_imports`  — o grafo.json já pronto, se aquele projeto já
            rodou o Grafo de Imports (ausente se nunca rodou)
          - `pipeline`       — o resultado de "Visualizar pipeline" (cadeias,
            fases, travessias), se aquele projeto já rodou o agente Pipeline
            (ausente se nunca rodou)
        para o plugin não precisar conhecer a estrutura interna do programa.
        """
        # As três leituras saíram daqui em 04/09/2026: `chamar_extensao`
        # precisava exatamente delas. Ver `payload_de_projeto.py`.
        payload = enriquecer_payload(self, payload)

        lido = ler_manifesto_plugin(caminho)
        if not lido['ok']:
            return {'success': False, 'error': _frase_de_erro_do_manifesto(lido)}
        backend = lido['manifesto']['backend']
        try:
            modulo = _importar_backend_do_plugin(caminho, lido['manifesto'])
        except Exception as e:
            return {'success': False, 'error': 'Falha ao carregar o plugin: %s' % e}
        if modulo is None:
            return {'success': False, 'error': 'Plugin sem %s.' % backend}
        funcao = getattr(modulo, _PLUGIN_FUNC_EXECUTAR, None)
        if not callable(funcao):
            return {'success': False,
                    'error': '%s não define %s().' % (backend, _PLUGIN_FUNC_EXECUTAR)}
        try:
            return funcao(payload)
        except Exception as e:
            return {'success': False, 'error': 'Erro dentro do plugin: %s' % e}

    def _iniciar_plugins_ativos(self):
        """Chama, uma vez, `iniciar()` de cada plugin ligado (D5) cujo
        `plugin.json` está sem erro e diz `tipo` automático — o arquivo é o
        `boot` do manifesto (padrão `plugin_boot.py`). Nunca deixa a falha de
        um plugin impedir o boot do programa. Passa pelo mesmo
        `_iniciar_boot_do_plugin` do ligar, para o registro `_BOOTS_INICIADOS`
        impedir um segundo laço — e é ele que confere `ok` e o tipo, nos dois
        caminhos."""
        config = _ler_config_plugins()
        for caminho in _listar_plugins_recursivo():
            if not config.get(caminho, {}).get('ligado'):
                continue
            try:
                _iniciar_boot_do_plugin(caminho)
            except Exception as e:
                print('[plugins] "%s" falhou ao carregar ou em iniciar(): %s' % (caminho, e))
