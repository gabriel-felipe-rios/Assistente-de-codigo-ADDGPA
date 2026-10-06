"""Em que arquivo de `Internal/config/` mora cada chave de configuração.

Até 23/09/2026 quase tudo morava em dois arquivos — `settings.json` (88 chaves
de 18 categorias) e `limites.json` (14 de 3). Agora cada categoria de
Configurações › Programa grava o PRÓPRIO JSON, com o nome da categoria em
minúsculas, hífen e sem acento (`editor-de-codigo.json`, `temas.json`…).

Para quem lê, nada mudou: `load_settings()` e `load_limites()` continuam
devolvendo um dicionário só. A divisão existe no disco, e este módulo é o
único lugar que sabe dela.

⚠️ O MAPA CHAVE → ARQUIVO É DERIVADO, NUNCA ESCRITO À MÃO. Ele sai de
`ConfigsMixin._PADROES_POR_CATEGORIA` (a mesma tabela do "Restaurar padrão"):
uma chave nova num `PADROES_DO_*` cai no arquivo certo sozinha. Uma lista de
102 chaves aqui seria a segunda cópia para divergir da primeira.

⚠️ UM ARQUIVO PODE TER DOIS GRAVADORES. `modelo-e-contexto.json` e
`tempos-e-ciclos.json` recebem chaves de `save_settings` E de `save_limites`.
Por isso toda gravação é ler-mudar-gravar sob uma trava, e cada gravador só
toca nas chaves dele — senão salvar o LM Studio apagaria o teto de saída.

⚠️ A MIGRAÇÃO FICA ATRÁS DO LEITOR. `settings.json` e `limites.json` viram
reserva de leitura: o valor antigo vale até o arquivo novo existir, e sai do
arquivo velho só depois de gravado no novo. Uma queda no meio deixa o valor
dos dois lados, nunca de nenhum.
"""

import json
import os
import threading

from .constantes import (CONFIGS_DIR, INICIOS_RAPIDOS_FILE,
                         INICIOS_RAPIDOS_FILE_ANTIGO, RENDER_MAPAS_FILE,
                         RENDER_MAPAS_FILE_ANTIGO, TAB_ORDER_FILE,
                         TAB_ORDER_FILE_ANTIGO)
from .arvore_externa import gravar_json_de_config


# O arquivo de cada categoria. A chave é o `data-categoria` do trilho — a
# mesma de `_PADROES_POR_CATEGORIA` —, o valor é o rótulo da categoria em
# minúsculas, hífen e sem acento.
#
# Ficam de fora as categorias com arquivo próprio e inteiro, que não passam
# por aqui: `ordem` (`ordem-das-abas.json`), `render`
# (`desempenho-dos-mapas.json`), `plugins`, `atalhos-externos` (`launchers`),
# `xtprog`, `extensoes` e `aparencia`.
ARQUIVOS_DAS_CATEGORIAS = {
    'modelo': 'modelo-e-contexto.json',
    'tempos': 'tempos-e-ciclos.json',
    'rotinas': 'rotinas-da-automacao.json',
    'ferramentas': 'ferramentas-dos-subagentes.json',
    'mcp': 'servidores-mcp-do-programa.json',
    'mcps': 'servidores-mcp.json',
    'icones': 'icones-de-arquivos-e-pastas.json',
    'tema': 'temas.json',
    'preparar': os.path.basename(INICIOS_RAPIDOS_FILE),
    'acervo': 'acervo.json',
    'arquivos': 'assistentes-externos.json',
    'notificacoes': 'notificacoes.json',
    'biblioteca': 'arquivos.json',
    'confirmacoes': 'encerrar-e-excluir.json',
    'editor': 'editor-de-codigo.json',
    'acesso-rapido': 'acesso-rapido.json',
    'teclado': 'teclado.json',
}

# Chaves sem categoria em Configurações. O histórico do Acesso rápido é uso,
# não preferência — e é por isso que o "Restaurar padrão" da categoria não
# pode alcançá-lo. As de Trabalhos são gravadas pela aba Trabalhos.
ARQUIVO_DOS_RECENTES = 'acesso-rapido-recentes.json'
CHAVES_DOS_RECENTES = ('acesso_rapido_recentes',)
ARQUIVO_DOS_TRABALHOS = 'trabalhos.json'
PREFIXOS_DOS_TRABALHOS = ('trabalhos_bloqueio_', 'trabalhos_portao_', 'trabalhos_limite_')
CHAVES_DOS_TRABALHOS = ('fluxos_salvos_oficina', 'combinacoes_lancamento_rapido')

# `janela_contexto` é da categoria Modelo e contexto, mas não está na tabela
# do "Restaurar padrão" — de propósito: é leitura da máquina, não preferência.
_CHAVES_FORA_DA_TABELA_DE_LIMITES = {'janela_contexto': 'modelo'}

# Arquivos inteiros que só mudaram de nome. Renomear é a migração inteira.
# ⚠️ Não entram: `extensoes.json`, `extensoes-do-programa*.json` e
# `aparencia.json` — esses têm migração própria e ORDENADA, logo abaixo
# (`_migrar_arquivos_que_o_programa_le`) —, nem `plugins*.json` (nome mantido
# — o `plugin_boot.py` de cada plugin lê pelo caminho fixo).
_RENOMES = (
    (TAB_ORDER_FILE_ANTIGO, TAB_ORDER_FILE),
    (RENDER_MAPAS_FILE_ANTIGO, RENDER_MAPAS_FILE),
    (INICIOS_RAPIDOS_FILE_ANTIGO, INICIOS_RAPIDOS_FILE),
    (os.path.join(CONFIGS_DIR, 'atalhos-externos.json'),
     os.path.join(CONFIGS_DIR, 'launchers.json')),
    (os.path.join(CONFIGS_DIR, 'atalhos-externos-ordem.json'),
     os.path.join(CONFIGS_DIR, 'launchers-ordem.json')),
)

# A tela pode gravar limites e settings quase juntos, e os dois caem no mesmo
# arquivo. Reentrante porque `save_settings` segura a trava enquanto chama
# `gravar_chaves_no_arquivo`, que também a pega.
TRAVA_DA_CONFIG = threading.RLock()

_mapa = None
_limites = None


def _montar_mapa():
    """Preenche `_mapa` (chave → arquivo) e `_limites` (chaves de limites).

    Preguiçoso porque `configuracoes.py` importa este módulo: ler a tabela no
    import criaria o ciclo.
    """
    global _mapa, _limites
    from .configuracoes import ConfigsMixin
    mapa, limites = {}, set()
    for categoria, alvo in ConfigsMixin._PADROES_POR_CATEGORIA.items():
        nome = ARQUIVOS_DAS_CATEGORIAS.get(categoria)
        if not nome:
            continue
        for chave in alvo.get('settings') or ():
            mapa[chave] = nome
        for chave in alvo.get('limites') or ():
            mapa[chave] = nome
            limites.add(chave)
    for chave, categoria in _CHAVES_FORA_DA_TABELA_DE_LIMITES.items():
        mapa[chave] = ARQUIVOS_DAS_CATEGORIAS[categoria]
        limites.add(chave)
    for chave in CHAVES_DOS_RECENTES:
        mapa[chave] = ARQUIVO_DOS_RECENTES
    for chave in CHAVES_DOS_TRABALHOS:
        mapa[chave] = ARQUIVO_DOS_TRABALHOS
    _limites = frozenset(limites)
    _mapa = mapa


def arquivo_da_chave(chave):
    """O nome do arquivo onde `chave` mora, ou `None` (fica em `settings.json`)."""
    if _mapa is None:
        _montar_mapa()
    nome = _mapa.get(chave)
    if nome:
        return nome
    if chave.startswith(PREFIXOS_DOS_TRABALHOS):
        return ARQUIVO_DOS_TRABALHOS
    return None


def chaves_de_limites():
    """As chaves que `load_limites`/`save_limites` cuidam — nunca `save_settings`."""
    if _limites is None:
        _montar_mapa()
    return _limites


def arquivos_de_settings():
    """Todo arquivo que guarda pelo menos uma chave de settings."""
    if _mapa is None:
        _montar_mapa()
    return sorted({n for k, n in _mapa.items() if k not in _limites}
                  | {ARQUIVO_DOS_TRABALHOS})


def arquivos_de_limites():
    """Todo arquivo que guarda pelo menos uma chave de limites."""
    if _mapa is None:
        _montar_mapa()
    return sorted({_mapa[k] for k in _limites})


# nome → (mtime_ns, tamanho, texto). Guarda o TEXTO, e não o dicionário: cada
# leitura faz o próprio `json.loads` e devolve objetos novos — quem muda uma
# lista do resultado não contamina a leitura seguinte.
_cache_de_texto = {}


def ler_arquivo_de_config(nome):
    """O dicionário de `Internal/config/{nome}`, `{}` se faltar ou corromper.

    ⚠️ COM CACHE POR `mtime` E TAMANHO, e o motivo é medido: os servidores MCP
    leem as configurações a cada ferramenta, e ~20 arquivos abertos um a um
    custavam 5,6 ms por leitura no Windows, contra 0,5 ms dos dois arquivos de
    antes. O `stat` continua a cada chamada, então uma edição à mão vale na
    leitura seguinte.
    """
    caminho = os.path.join(CONFIGS_DIR, nome)
    try:
        st = os.stat(caminho)
        marca = (st.st_mtime_ns, st.st_size)
        guardado = _cache_de_texto.get(nome)
        if guardado and guardado[0] == marca:
            texto = guardado[1]
        else:
            with open(caminho, 'r', encoding='utf-8') as f:
                texto = f.read()
            _cache_de_texto[nome] = (marca, texto)
        dado = json.loads(texto)
    except (OSError, ValueError):
        return {}
    return dado if isinstance(dado, dict) else {}


def ler_chaves_dos_arquivos(nomes, so_limites):
    """As chaves gravadas em `nomes`, cada uma lida SÓ do arquivo dela.

    Um JSON editado à mão com uma chave de outra categoria não contamina o
    resto: ela é ignorada ali e continua valendo de onde mora de verdade.
    """
    limites = chaves_de_limites()
    saida = {}
    for nome in nomes:
        for chave, valor in ler_arquivo_de_config(nome).items():
            if arquivo_da_chave(chave) != nome:
                continue
            if (chave in limites) != so_limites:
                continue
            saida[chave] = valor
    return saida


def gravar_chaves_no_arquivo(nome, chaves_dict, remover=()):
    """Ler-mudar-gravar: acrescenta `chaves_dict` e tira `remover`, atômico.

    Nunca substitui o arquivo inteiro — o outro gravador pode ter chaves ali.
    """
    with TRAVA_DA_CONFIG:
        atual = ler_arquivo_de_config(nome)
        atual.update(chaves_dict)
        for chave in remover:
            atual.pop(chave, None)
        gravar_json_de_config(nome, atual)


def avisar_configuracao_mudou(antes, depois):
    """Emite `configuracao.mudou` — UM aviso por categoria que mudou de fato.

    Quem chama são os dois gravadores (`save_settings` e `save_limites`),
    DEPOIS de gravar e fora da trava: `emitir` espera as extensões até 2 s, e
    segurar `TRAVA_DA_CONFIG` esse tempo travaria o outro gravador.

    `antes` e `depois` são os valores EFETIVOS (padrão + disco) das chaves que
    aquele gravador cuida. Só entra chave cujo valor mudou e que mora no
    arquivo de uma categoria de Configurações: o histórico do Acesso rápido e
    as chaves da aba Trabalhos não são configuração, e avisar a cada uso seria
    ruído. Categoria com arquivo próprio e inteiro (ordem das abas, Launchers,
    Extensões…) não passa por aqui — e não avisa (decidido em 23/09/2026).
    """
    por_nome = {n: c for c, n in ARQUIVOS_DAS_CATEGORIAS.items()}
    por_categoria = {}
    for chave in sorted(set(antes) | set(depois)):
        if antes.get(chave) == depois.get(chave):
            continue
        categoria = por_nome.get(arquivo_da_chave(chave) or '')
        if categoria:
            por_categoria.setdefault(categoria, []).append(chave)
    if not por_categoria:
        return
    # Import tardio: `extensoes` puxa a descoberta e a carga, e este módulo é
    # lido no boot de três processos (o programa e os dois MCPs).
    from .extensoes import eventos as xt_eventos
    for categoria, chaves in por_categoria.items():
        xt_eventos.emitir('configuracao.mudou',
                          {'origem': 'programa', 'categoria': categoria, 'chaves': chaves})


def migrar_nomes_de_config():
    """Renomeia os arquivos inteiros que só mudaram de nome. Roda no boot.

    Se o antigo existe e o novo não, `os.replace` (atômico, não duplica). Se os
    dois existem, o novo manda e o antigo fica como está — nunca se apaga.

    ⚠️ Roda em até três processos (o programa e os dois servidores MCP), e o
    stdout do MCP é o canal do protocolo: nada de `print` aqui. Um outro
    processo pode ter renomeado primeiro, ou o arquivo pode estar aberto no
    Windows — os dois casos são engolidos, porque o leitor tem a reserva.
    """
    renomeados = []
    for antigo, novo in _RENOMES:
        try:
            if os.path.exists(antigo) and not os.path.exists(novo):
                os.replace(antigo, novo)
                renomeados.append(os.path.basename(novo))
        except (FileNotFoundError, PermissionError):
            continue
    renomeados.extend(_migrar_arquivos_que_o_programa_le())
    return {'success': True, 'renomeados': renomeados}


# Os três da categoria Extensões, que herdam o nome `extensoes.json`.
_RENOMES_DAS_EXTENSOES = (
    ('extensoes-do-programa.json', 'extensoes.json'),
    ('extensoes-do-programa-ordem.json', 'extensoes-ordem.json'),
    ('extensoes-do-programa-destaque.json', 'extensoes-destaque.json'),
)


def _guardar(caminho, guardado):
    """Renomeia o arquivo antigo para o nome de guarda, sem sobrescrever outro
    guardado (`-2`, `-3`…). Nunca apaga (D20)."""
    base, ext = os.path.splitext(guardado)
    destino, n = guardado, 2
    while os.path.exists(destino):
        destino, n = '%s-%d%s' % (base, n, ext), n + 1
    os.replace(caminho, destino)
    return os.path.basename(destino)


def _migrar_arquivos_que_o_programa_le():
    """Fase 03 da obra: `extensoes.json` (ignorados) e `aparencia.json` viram as
    três vistas de "Arquivos que o programa lê", e o nome `extensoes.json`
    passa para a categoria Extensões.

    ⚠️ A ORDEM É TUDO. Renomear `extensoes-do-programa.json` antes de migrar os
    ignorados sobrescreveria a lista do usuário. Por isso: grava as vistas que
    faltam → relê e confere → guarda o antigo com outro nome → só então libera
    o nome. Se o primeiro passo falhar, o terceiro não roda.
    """
    from .configuracoes_extensoes import _invalidar_cache_extensoes
    from .configuracoes_extensoes_migracao import (migrar_da_forma_antiga,
                                                   tem_forma_de_ignorados)
    from .constantes import (NUNCA_LER_FILE, O_QUE_E_CODIGO_FILE, EXCECOES_FILE,
                             QUEM_LE_O_QUE_FILE, QUEM_LE_O_QUE_GUARDADO_FILE,
                             EXTENSOES_IGNORADOS_ANTIGO_FILE,
                             EXTENSOES_IGNORADOS_GUARDADO_FILE,
                             APARENCIA_ANTIGO_FILE, APARENCIA_GUARDADO_FILE)
    feitos = []
    vistas_por_arquivo = (('nunca_ler', NUNCA_LER_FILE),
                          ('o_que_e_codigo', O_QUE_E_CODIGO_FILE),
                          ('excecoes', EXCECOES_FILE))

    def gravar_as_que_faltam(vistas, quais):
        for vista, caminho in vistas_por_arquivo:
            if vista in quais and not os.path.exists(caminho):
                gravar_json_de_config(os.path.basename(caminho), vistas[vista])
                if ler_arquivo_de_config(os.path.basename(caminho)) != vistas[vista]:
                    raise OSError('conferência falhou: ' + os.path.basename(caminho))
                feitos.append(os.path.basename(caminho))

    ignorados_liberado = True
    try:
        ignorados = _ler_json_solto(EXTENSOES_IGNORADOS_ANTIGO_FILE)
        aparencia = _ler_json_solto(APARENCIA_ANTIGO_FILE)
        # 1. a lista de ignorados antiga (e, junto, a da Aparência)
        if tem_forma_de_ignorados(ignorados):
            ignorados_liberado = False
            vistas = migrar_da_forma_antiga(ignorados, aparencia)
            gravar_as_que_faltam(vistas, ('nunca_ler', 'o_que_e_codigo', 'excecoes'))
            feitos.append(_guardar(EXTENSOES_IGNORADOS_ANTIGO_FILE,
                                   EXTENSOES_IGNORADOS_GUARDADO_FILE))
            ignorados_liberado = True
        # 2. a da Aparência sozinha (quando não havia ignorados para migrar)
        if aparencia is not None and os.path.exists(APARENCIA_ANTIGO_FILE):
            gravar_as_que_faltam(migrar_da_forma_antiga(None, aparencia), ('excecoes',))
            feitos.append(_guardar(APARENCIA_ANTIGO_FILE, APARENCIA_GUARDADO_FILE))
        # 2b. Quem lê o quê (até a fase 06 da obra «Qualidade da documentação»)
        #     vira Exceções. A leitura já entende a forma antiga (a lista
        #     própria vira acrescentar/retirar), então basta gravar o que ela
        #     devolve, conferir e guardar o antigo com outro nome (D20: nunca apaga).
        if os.path.exists(QUEM_LE_O_QUE_FILE) and not os.path.exists(EXCECOES_FILE):
            from .configuracoes_extensoes import ler_excecoes
            _invalidar_cache_extensoes()
            gravar_as_que_faltam({'excecoes': ler_excecoes()}, ('excecoes',))
            feitos.append(_guardar(QUEM_LE_O_QUE_FILE, QUEM_LE_O_QUE_GUARDADO_FILE))
    except (FileNotFoundError, PermissionError):
        pass        # outro processo (um dos MCPs) fez primeiro — o leitor tem a reserva
    except OSError:
        ignorados_liberado = False
    finally:
        _invalidar_cache_extensoes()

    # 3. só agora o nome `extensoes.json` passa para a categoria Extensões
    if ignorados_liberado and not os.path.exists(EXTENSOES_IGNORADOS_ANTIGO_FILE):
        for antigo, novo in _RENOMES_DAS_EXTENSOES:
            try:
                origem = os.path.join(CONFIGS_DIR, antigo)
                destino = os.path.join(CONFIGS_DIR, novo)
                if os.path.exists(origem) and not os.path.exists(destino):
                    os.replace(origem, destino)
                    feitos.append(novo)
            except (FileNotFoundError, PermissionError):
                continue
    return feitos


def _ler_json_solto(caminho):
    """O dicionário de um caminho absoluto, ou `None`."""
    try:
        with open(caminho, 'r', encoding='utf-8') as f:
            dado = json.load(f)
        return dado if isinstance(dado, dict) else None
    except (OSError, ValueError):
        return None
