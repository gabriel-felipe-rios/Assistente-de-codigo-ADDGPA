from ..constantes import *

# Catálogo de extensões da Documentação Técnica, agrupado por linguagem.
#
# ⚠️ DESDE A FASE 06 DA OBRA «Qualidade da documentação» (2026-09) ISTO NÃO É
# MAIS O QUE A DOCUMENTAÇÃO TÉCNICA LÊ. Ela parte da lista de código (O que é
# código) e guarda só as Exceções dela (Configurações › Arquivos que o
# programa lê › Exceções) — ver `lista_das_rotinas`, abaixo. O seletor «Igual
# à lista de código / Lista própria» e a tela que mostrava estes grupos saíram
# (D48). O catálogo ficou por dois motivos: `EXTENSOES_NAO_CODIGO` (o
# Detector) deriva dele, e ele é a reserva de `lista_das_rotinas` quando a
# leitura falha. As exceções DE FÁBRICA da Documentação Técnica (`.psm1`,
# `.env` — o que ele tinha a mais que a lista de código) ficaram gravadas
# como constante em `configuracoes_extensoes_excecoes.padrao_excecoes`.
#
# ⚠️ Este catálogo NÃO é o mesmo de `modulos/linguagens.py` (contagem dos
# Mapas), e a separação é deliberada: poder ligar um formato num agente e não
# no outro é o comportamento desejado.
#
# ⚠️ Catálogo ≠ seleção. O que a Documentação Técnica lê é UMA lista só,
# global: a lista de código com a parte `documentacao_tecnica` das Exceções
# aplicada (`lista_das_rotinas`).
# Até 23/09/2026 era gravado POR PROJETO e POR AGENTE em
# `Automação/Rotinas/Configuração.json` — esse arquivo, se existir, fica no
# disco e não é mais lido. ⛔ Não separe de novo as duas listas: «a mesma
# configuração que eu fizer em um, eu vou fazer em outro».
GRUPOS_DE_EXTENSOES = [
    {'rotulo': 'Python',            'extensoes': ['.py', '.pyw', '.pyi']},
    {'rotulo': 'JavaScript',        'extensoes': ['.js', '.jsx', '.mjs', '.cjs']},
    {'rotulo': 'TypeScript',        'extensoes': ['.ts', '.tsx', '.mts', '.cts']},
    {'rotulo': 'HTML',              'extensoes': ['.html', '.htm']},
    {'rotulo': 'CSS',               'extensoes': ['.css', '.scss', '.sass', '.less']},
    {'rotulo': 'Vue / Svelte',      'extensoes': ['.vue', '.svelte']},
    {'rotulo': 'C#',                'extensoes': ['.cs']},
    {'rotulo': 'Java',              'extensoes': ['.java']},
    {'rotulo': 'Kotlin',            'extensoes': ['.kt', '.kts']},
    {'rotulo': 'Go',                'extensoes': ['.go']},
    {'rotulo': 'Rust',              'extensoes': ['.rs']},
    {'rotulo': 'C/C++',             'extensoes': ['.c', '.cc', '.cpp', '.cxx', '.h', '.hpp']},
    {'rotulo': 'Ruby',              'extensoes': ['.rb']},
    {'rotulo': 'PHP',               'extensoes': ['.php']},
    {'rotulo': 'Swift',             'extensoes': ['.swift']},
    {'rotulo': 'SQL',               'extensoes': ['.sql']},
    {'rotulo': 'Shell',             'extensoes': ['.sh', '.bash']},
    {'rotulo': 'PowerShell',        'extensoes': ['.ps1', '.psm1']},
    {'rotulo': 'Batch',             'extensoes': ['.bat', '.cmd']},
    {'rotulo': 'XML',               'extensoes': ['.xml']},
    {'rotulo': 'Formatos especiais','extensoes': ['.json', '.md', '.txt', '.yml',
                                                  '.yaml', '.toml', '.ini', '.env']},
]

# A lista plana, derivada — era escrita à mão ao lado dos grupos, nas mesmas 48
# extensões em outra ordem de linhas. Quem precisa só do conjunto usa esta.
EXTENSOES_DA_DOCUMENTACAO = [ext for grupo in GRUPOS_DE_EXTENSOES for ext in grupo['extensoes']]

# ── "Isto é código, isto não é" ───────────────────────────────────
# ⚠️ ESTA PERGUNTA NÃO EXISTIA NO PROJETO, e é a QUARTA lista de extensões dele.
# As outras três respondem outras coisas, e nenhuma serve aqui:
#   · `extensoes.json`           → o que a varredura ignora por completo
#   · Exceções › Documentação Técnica → o que a Doc Técnica aceita
#   · `ignore_list` do workspace → o que o usuário mandou remover deste projeto
#
# Quem pergunta é o Detector: código decide o reprocessamento pela TABELA (o QUÊ
# mudou); o que não é código decide por similaridade (o QUANTO). Derivada do
# catálogo, e não escrita à mão, para não nascer já divergindo dele.
GRUPO_NAO_CODIGO = 'Formatos especiais'
EXTENSOES_NAO_CODIGO = frozenset(
    ext for grupo in GRUPOS_DE_EXTENSOES if grupo['rotulo'] == GRUPO_NAO_CODIGO
    for ext in grupo['extensoes'])

# Padrão de fábrica: TUDO marcado. O padrão antigo eram 8 extensões, e quem
# escreve .ps1/.bat/.sh (é o caso da aba Terminal) nunca ganhava
# documentação técnica sem saber que precisava ir ligar na mão.
#
# ⚠️ `load_rotinas_config` devolve AINDA ESTA FORMA — `{'doc-tecnica':
# {'extensions': [...]}}`. É o contrato de
# quem lê (o disparo do ciclo, Arquivos muito grandes, Resumo de Pastas e as
# duas telas); a forma ficou, o conteúdo virou a lista geral.
# ⚠️ NÃO DERIVAR de `IDS_DAS_ROTINAS`: é 1 das 15, e só ela porque só ela
# recebe extensões — acrescentar as outras criaria configuração que nada lê.
#
# ⚠️ `parallel` saiu daqui em 21/08/2026 e virou `paralelas_rotinas`, um número
# só em `limites.json`. Ele nunca foi uma escolha por projeto: é sobre quantas
# requisições a máquina e o LM Studio aguentam ao mesmo tempo.
def lista_das_rotinas():
    """As extensões que a Documentação Técnica lê: a lista de código (O que é
    código) com a parte `documentacao_tecnica` das Exceções aplicada — o que o
    usuário acrescentou entra, o que retirou sai (D48). Se a leitura falhar,
    o catálogo de fábrica.

    Import preguiçoso: a leitura das vistas passa por `configuracoes`, que
    importa meio backend; no topo daqui fecharia um ciclo.
    """
    try:
        from modulos.configuracoes_extensoes_excecoes import lista_da_parte
        return sorted(lista_da_parte('documentacao_tecnica'))
    except Exception:
        return list(EXTENSOES_DA_DOCUMENTACAO)


class RotinasConfigMixin:

    # ── Config compartilhada de Rotinas (extensões) ────────────────────────────
    # Lida tanto pela aba Rotinas (ao carregar/rodar os cards) quanto pelo
    # Acionamentos, para que os dois caminhos de execução usem os mesmos valores.
    # A lista se edita em Configurações › Arquivos que o programa lê ›
    # Exceções › Documentação Técnica; daqui não sai gravação nenhuma.
    #
    # ⚠️ `obter_catalogo_de_extensoes` SAIU na fase 06 da obra «Qualidade da
    # documentação»: o único chamador era a tela de Quem lê o quê
    # (`config-extensoes.js`), que não mostra mais os grupos.

    def load_rotinas_config(self, project_name=None):
        """A lista das duas rotinas, na forma de sempre.

        `project_name` continua aceito (quem chama passa o nome) e é ignorado:
        a lista é global. O `Configuração.json` do projeto não é lido.
        """
        exts = lista_das_rotinas()
        return {'success': True, 'config': {
            'doc-tecnica': {'extensions': list(exts)},
        }}
