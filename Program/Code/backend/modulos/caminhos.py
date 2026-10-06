"""Onde cada coisa do usuário é salva — o ponto ÚNICO que decide isso.

A regra que organiza esta pasta inteira: **cada arquivo mora sob a aba que o
escreve**, com o nome que essa aba tem na tela. Abrir
`Files/projects/{Projeto}/Assistente/Fila/Log/` e saber que aquilo é a aba
Assistente › sub-aba Fila › o log não exige traduzir nada.

Antes daqui existir, 75 montagens de caminho espalhadas por 30 arquivos
repetiam as strings na mão (`os.path.join(PROJECTS_DIR, project_name,
'agentes', 'espelho')` e parentes). Trocar um nome era trocar em 40 lugares e
esquecer um. Agora é trocar uma linha.

⚠️ NOME DE PASTA ≠ ID DE AGENTE. O id (`resumo-pastas`, `doc-tecnica`,
`grafo-imports`…) viaja como parâmetro entre a tela, o backend e o servidor
MCP, e não muda nunca. Quem muda é só o nome da pasta, e a tradução acontece
aqui — em `PASTAS_DAS_ROTINAS` — e em lugar nenhum mais.

⚠️ INVARIANTE: nenhum arquivo de controle mora DENTRO de uma pasta de rotina
sem o prefixo `_`, e ele mora sempre na RAIZ dela. É por isso que
`Configuração.json` e `Pendências.json` ficam na raiz de `Rotinas/`, e
`Estado.json` na raiz de `Fila/`, em vez de dentro das pastas das rotinas.
`arquivos_rotinas.py::_is_agent_content_file` lista todo `.json`/`.md` da
pasta de uma rotina como conteúdo do agente, menos o que começa com `_` na
raiz — um arquivo de controle solto lá dentro apareceria na tela como se
fosse artefato gerado. Mais fundo, o `_` não esconde nada (D33):
`__init__.py.md` é a Documentação Técnica de um `__init__.py`.

⚠️ CAMINHO LONGO NO WINDOWS. A Documentação Técnica espelha a
árvore de código inteira do usuário dentro da pasta dela, então é o pior
caso de comprimento. Na medição feita em 2026-08-20, o pior caminho tinha 242
caracteres com os nomes antigos e passa a ter ~252 com estes, contra o
MAX_PATH de 260. A margem é de 8 caracteres, e quem segura acima disso é o
`LongPathsEnabled` do registro do Windows mais o manifesto `longPathAware` do
Python 3.6+. Se um dia entrar no workspace um código com pastas bem mais
fundas, é aqui que se resolve — encurtando um nome de pasta, não espalhando
gambiarra pelos consumidores.
"""

import os

# A raiz de todos os dados de projeto. Mora aqui, e não em `constantes.py`,
# porque tudo neste módulo é derivado dela — e `constantes.py` reexporta o
# módulo inteiro, então quem faz `from .constantes import *` continua
# recebendo `PROJECTS_DIR` exatamente como antes.
PROJECTS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'Files', 'projects')
)

# A raiz das cópias. É IRMÃ de `PROJECTS_DIR`, não filha — decisão registrada em
# `Saída das skills/Arquitetura modular/Convenções.md`. Mora aqui pelo mesmo
# motivo que `PROJECTS_DIR`: este módulo é quem decide onde as coisas ficam, e
# `constantes.py` reexporta o módulo inteiro, então quem faz
# `from .constantes import *` continua recebendo `BACKUPS_DIR` como antes.
BACKUPS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'Files', 'backups')
)

# ── Nomes de pasta: identificador sem acento, VALOR igual ao rótulo da tela ──
# A convenção de nomenclatura do projeto proíbe acento em identificador de
# código, mas o valor é texto de interface — e aí acento é obrigatório.
PASTA_PROJETO    = 'Projeto'
PASTA_ASSISTENTE = 'Assistente'
PASTA_AUTOMACAO  = 'Automação'
PASTA_ANALISE    = 'Análise'
PASTA_EDITOR     = 'Editor'

PASTA_CHAT     = 'Chat'
PASTA_FILA     = 'Fila'
PASTA_DESIGNER = 'Designer'
PASTA_ROTINAS  = 'Rotinas'

ARQUIVO_WORKSPACE          = 'Workspace.json'
ARQUIVO_INDICE_DE_SIMBOLOS = 'Índice de Símbolos.json'
ARQUIVO_ACIONAMENTOS       = 'Acionamentos.json'
ARQUIVO_CONFIGURACAO_DAS_ROTINAS = 'Configuração.json'
ARQUIVO_PENDENCIAS_DAS_ROTINAS   = 'Pendências.json'
ARQUIVO_HISTORICO_DAS_ROTINAS    = 'Histórico.jsonl'
ARQUIVO_COBERTURA_DAS_ROTINAS    = 'Cobertura.json'

ARQUIVO_ESTADO_DA_FILA    = 'Estado.json'
PASTA_HISTORICO_DA_FILA   = 'Histórico'
PASTA_LOG_DA_FILA         = 'Log'
PASTA_RELATORIOS_DA_FILA  = 'Relatórios'

# ── Aba Trabalhos ────────────────────────────────────────────────────────────
# Primeiro nível, ao lado de `Análise`/`Automação`/`Projeto`, e NÃO dentro de
# `Assistente/`: a regra do topo deste módulo é que cada pasta mora sob a aba
# que a escreve, com o nome que essa aba tem na tela — e Trabalhos é aba de
# primeiro nível, não sub-área do Assistente.
PASTA_TRABALHOS = 'Trabalhos'

ARQUIVO_ESTADO_DOS_TRABALHOS       = 'Estado.json'
ARQUIVO_CONFIGURACAO_DOS_TRABALHOS = 'Configuração.json'

# ── A pasta gêmea, na RAIZ DO PROJETO DO USUÁRIO ─────────────────────────────
# ⚠️ MESMO NOME, OUTRO LUGAR, E ISSO É O DESENHO. `PASTA_TRABALHOS` acima fica
# em `Files/projects/{Projeto}/` — a pasta do PROGRAMA, que é estado interno e
# não é para ninguém abrir. Esta fica dentro da raiz de código do usuário, que
# é onde o terminal do assistente abre.
#
# O defeito que ela conserta: pedia-se ao orquestrador para achar uma nota, e
# ele respondia pedindo permissão para ler FORA do diretório de trabalho. Não
# era teimosia — tudo que a Oficina escreve morava do outro lado, e entre os
# dois não havia ponte. Esta pasta é a ponte, e ela nasce AO LADO do estado
# interno, nunca no lugar dele: `Layout.json`, `Estado.json` e `Canais/`
# continuam exatamente onde estavam.
#
# ⚠️ CADA ARQUIVO DAQUI TEM EXATAMENTE UM ESCRITOR. O programa escreve o
# `LEIA-ME.md`, o `Quadro.md`, o `Equipe.md` e as `Notas/`; o agente escreve
# em `Anotações/<nó>/`, e em lugar nenhum mais. Dois donos no mesmo arquivo é
# como se perde uma escrita sem ninguém notar.
PASTA_TRABALHOS_NO_PROJETO = 'Trabalhos'

ARQUIVO_LEIA_ME_DOS_TRABALHOS = 'LEIA-ME.md'
ARQUIVO_QUADRO_DOS_TRABALHOS  = 'Quadro.md'
ARQUIVO_EQUIPE_DOS_TRABALHOS  = 'Equipe.md'
PASTA_NOTAS_DOS_TRABALHOS     = 'Notas'
PASTA_ANOTACOES_DOS_TRABALHOS = 'Anotações'
PASTA_ANEXOS_DOS_TRABALHOS    = 'Anexos'

PASTA_CONVERSAS_DO_DESIGNER    = 'Conversas'
ARQUIVO_PREFERENCIAS_DO_DESIGNER = 'Preferências.json'

# ── Aba Editor ───────────────────────────────────────────────────────────────
# O Histórico local é PLANO, e não espelha a árvore de código do usuário: cada
# arquivo vira uma subpasta com os 12 primeiros dígitos do md5 do caminho
# relativo. O motivo está no aviso de CAMINHO LONGO no topo deste módulo — a
# Documentação Técnica, que espelha, já é o pior caso com ~252 de 260
# caracteres. Um segundo espelho nasceria com prefixo ainda mais longo
# e estouraria o MAX_PATH em projeto fundo.
PASTA_HISTORICO_LOCAL             = 'Histórico local'
ARQUIVO_INDICE_DO_HISTORICO_LOCAL = 'índice.json'
# ⚠️ Não existe `Configuração.json` do Editor. Existiu por dois dias e saiu em
# 30/08/2026: a configuração do Editor passou a ser GLOBAL, no `settings.json`
# (`padroes_de_fabrica.py::PADROES_DO_EDITOR`), para a categoria Configurações →
# Editor ter um "Salvar" só. Só o histórico em si continua por projeto.

# ── Aba Backups ──────────────────────────────────────────────────────────────
# Nomes em minúsculo, ao contrário do resto: `arquivos/` e `versoes.json` não
# são rótulo de aba nenhuma — são a máquina do armazenamento por conteúdo, que
# o usuário não navega à mão. O que ele vê na tela são as Versões.
PASTA_ARQUIVOS_DAS_VERSOES = 'arquivos'
ARQUIVO_DAS_VERSOES        = 'versoes.json'
ARQUIVO_DE_CONFIGURACAO_DO_BACKUP = 'configuracao.json'

# ── O ÚNICO ponto de tradução id da rotina → nome da pasta ───────────────────
# São 16 chaves para 15 pastas: a Documentação Técnica tem DOIS ids em uso no
# código — `doc-tecnica` (nos acionamentos e na configuração de rotinas) e
# `documentacao-tecnica` (na aba Documentação, no embedding, na sincronia e no
# servidor MCP). Nenhum dos dois pode ser renomeado, porque o id é gravado em
# disco e trafega entre processos. Os dois apontam para a mesma pasta.
#
# `set(PASTAS_DAS_ROTINAS.values())` dá 15 — é o que o
# "Limpar dados gerados" usa para saber o que apagar. É por isso que o
# `mudanças.json` do Detector mora DENTRO da pasta dele: o botão o leva junto,
# sem regra especial.
PASTAS_DAS_ROTINAS = {
    'detector':             'Detector',
    'doc-tecnica':          'Documentação Técnica',
    'documentacao-tecnica': 'Documentação Técnica',
    'resumo-pastas':        'Resumo de Pastas',
    'glossario':            'Glossário',
    'indice-navegacao':     'Índice de Navegação',
    'identificadores':      'Índice de Identificadores',
    'grafo-imports':        'Grafo de Imports',
    'bibliotecas':          'Bibliotecas',
    'comentarios':          'Comentários',
    'pipeline':             'Pipeline',
    'hashes':               'Hashes',
    'embedding':            'Embedding Semântico',
    'sincronia':            'Sincronia',
    'duplicados':           'Duplicados',
    'indice-simbolos':      'Índice de Símbolos',
}

# Os quinze ids canônicos, um por pasta — o mapa acima tem dezesseis chaves
# porque carrega o apelido `documentacao-tecnica`. Quem precisa percorrer "as
# rotinas", e não "os ids aceitos", itera por aqui: a aba Automação escreve um
# estado por id no `Acionamentos.json`, e percorrer o mapa gravaria a
# Documentação Técnica duas vezes, com dois nomes.
#
# A ordem é a de dependência do ciclo, e não é decorativa: o **Detector**
# primeiro, porque é ele que vê o que mudou e decide quem isso merece; o Hashes
# logo atrás, porque a Documentação Técnica o consulta para pular
# arquivo que não mudou.
#
# ⚠️ Detector, Hashes e Sincronia são **a base**: as três rodam sempre que
# qualquer outra estiver ligada e NUNCA ganham chave ligada em
# `Acionamentos.json` (ver `_AC_LIGAR_FORA`, em `acionamentos_config.py`).
# Estarem aqui é o que lhes dá pasta de saída e `_resumo.json` — não um
# interruptor.
IDS_DAS_ROTINAS = (
    'detector', 'hashes', 'indice-simbolos', 'identificadores', 'grafo-imports',
    'doc-tecnica', 'resumo-pastas', 'indice-navegacao', 'glossario', 'pipeline',
    'embedding', 'bibliotecas', 'comentarios', 'sincronia', 'duplicados',
)

# ── Os arquivos do Detector ──────────────────────────────────────────────────
# O `mudanças.json` é o único arquivo de rotina que SOBREVIVE ao programa
# fechar sendo lido por outra rotina depois — é o que conserta o "ele nasce
# cego". Mora dentro da pasta da rotina, e não solto ao lado do
# `Pendências.json`, para o botão "Limpar dados gerados" o levar junto.
#
# ⚠️ Ele NÃO viola a invariante do topo deste arquivo (nada sem `_` dentro da
# pasta de uma rotina): `arquivos.py::_is_agent_content_file` lista `.json`/`.md`
# sem `_` como conteúdo do agente, e é exatamente isso que o `mudanças.json` é —
# a saída da rotina Detector, que a aba mostra.
ARQUIVO_DE_MUDANCAS_DO_DETECTOR = 'mudanças.json'


# ── Os PROMPTS: onde o texto que vai ao modelo mora ──────────────────────────
# Mora aqui, e não em `constantes.py`, pelo mesmo motivo de `PROJECTS_DIR`:
# este módulo é quem decide ONDE as coisas ficam. A mudança não quebra import
# nenhum — `constantes.py` reexporta o módulo inteiro, e todo consumidor chega
# por `from ...constantes import *`.
#
# ⚠️ EXCEÇÃO DE ARQUITETURA REGISTRADA. A árvore lá dentro usa nome de pasta em
# PORTUGUÊS, com maiúscula inicial e espaço — contra a §3.1 ("dentro de
# `Program/`, tudo em inglês") e a §3.2 (nível 3+ minúsculo, sem espaço) da
# Arquitetura Modular. O motivo está em `Saída das skills/Arquitetura
# modular/Exceções.md`: esta pasta existe porque alguém senta para mexer nos
# prompts, e achar rápido vale mais que a uniformidade.
#
# Os nomes repetem os das pastas de dados acima, e isso é de propósito:
# `Assistente/Fila/` é a MESMA aba nos dois lugares. A árvore:
#
#     prompts/
#       Rotinas/                  ← as seis rotinas automáticas (.txt + .json)
#       Assistente/
#         Chat/       system-prompt.txt, prompt-correcao.txt, Prompts fixos/
#         Fila/       system-prompt.txt, prompt-correcao.txt, Prompts fixos/,
#                     Verificador/
#         Designer/   system-prompt.txt, refino.txt
#         Subagentes/ Blocos/ + uma pasta por subagente
#       Como adicionar/           ← uma pasta por categoria da sub-aba Como adicionar
PROMPTS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..', 'prompts')
)

PASTA_DOS_SUBAGENTES    = 'Subagentes'
PASTA_DOS_BLOCOS        = 'Blocos'
PASTA_DOS_PROMPTS_FIXOS = 'Prompts fixos'
PASTA_DO_VERIFICADOR    = 'Verificador'
PASTA_COMO_ADICIONAR    = 'Como adicionar'

# As telas que têm prompt fixo. O nome do ARQUIVO continua sendo a chave
# pública da interface (`data-prompt-fixo`, os rótulos, os cards): o que a
# subpasta separa é a TELA, não o prompt.
TELAS_COM_PROMPT_FIXO = (PASTA_CHAT, PASTA_FILA)

# ── O ÚNICO ponto de tradução id do subagente → nome da pasta ────────────────
# Mesmo papel de `PASTAS_DAS_ROTINAS`, e pelo mesmo motivo: o id viaja como
# parâmetro entre a tela e o backend e não muda nunca; quem muda é o nome da
# pasta. Morava em `agentes/execucao/subagentes.py`, que é quem EXECUTA — não
# quem sabe onde as coisas ficam.
#
# A pasta é capitalizada e SEM acento — 'Semantico', não 'Semântico'. O acento
# só existe no campo `nome` do frontend.
#
# O `navegador` não está aqui de propósito: ele não usa LLM, então não tem
# prompt — só o bloco de descrição em `Subagentes/Blocos/`.
PASTAS_DOS_SUBAGENTES_POR_ID = {
    'buscador':        'Buscador',
    'leitor':          'Leitor',
    'arquiteto':       'Arquiteto',
    'analista':        'Analista',
    'semantico':       'Semantico',
    # O Verificador é subagente da Fila, não do Chat: a pasta dele mora sob
    # `Assistente/Fila/`, e é `obter_prompt_do_subagente` que sabe disso.
    'fila-verificador': PASTA_DO_VERIFICADOR,
}


class RotinaDesconhecida(ValueError):
    """Id de rotina que não existe em `PASTAS_DAS_ROTINAS`.

    Levantada de propósito, e nunca engolida aqui. Um id inventado tem duas
    origens possíveis: erro de digitação numa chamada interna — e aí tem que
    estourar no console na hora — ou string arbitrária vinda da tela, e aí
    quem recebe (as fronteiras pywebview em `arquivos.py` e `documentacao.py`)
    converte em `{'success': False, 'error': ...}` para não derrubar a ponte.

    O que NÃO se faz é cair de volta num nome padrão: era assim que uma busca
    numa fonte não reconhecida devolvia o resultado do Espelho (retirado em
    2026-09) sem avisar.
    """


class SubagenteDesconhecido(ValueError):
    """Id de subagente que não existe em `PASTAS_DOS_SUBAGENTES_POR_ID`.

    Irmã de `RotinaDesconhecida`, e pelo mesmo motivo: melhor estourar do que
    servir o prompt de outro subagente sem avisar.
    """


# ── Raiz do projeto ──────────────────────────────────────────────────────────

def obter_pasta_de_dados(project_name, *partes):
    """`Files/projects/{Projeto}/...` — a base de todo o resto."""
    return os.path.join(PROJECTS_DIR, project_name, *partes)


# ── Aba Projeto ──────────────────────────────────────────────────────────────

def obter_arquivo_de_workspace(project_name):
    return obter_pasta_de_dados(project_name, PASTA_PROJETO, ARQUIVO_WORKSPACE)


# ── Aba Análise ──────────────────────────────────────────────────────────────

def obter_arquivo_de_indice_de_simbolos(project_name):
    return obter_pasta_de_dados(project_name, PASTA_ANALISE, ARQUIVO_INDICE_DE_SIMBOLOS)


# ── Aba Editor ───────────────────────────────────────────────────────────────

def obter_pasta_do_editor(project_name, *partes):
    return obter_pasta_de_dados(project_name, PASTA_EDITOR, *partes)


def obter_pasta_de_historico_local(project_name, *partes):
    return obter_pasta_do_editor(project_name, PASTA_HISTORICO_LOCAL, *partes)


def obter_arquivo_de_indice_do_historico_local(project_name):
    return obter_pasta_de_historico_local(project_name, ARQUIVO_INDICE_DO_HISTORICO_LOCAL)


# ── Aba Assistente ───────────────────────────────────────────────────────────

def obter_pasta_de_chats(project_name):
    return obter_pasta_de_dados(project_name, PASTA_ASSISTENTE, PASTA_CHAT)


def obter_pasta_da_fila(project_name):
    """A pasta da Fila inteira.

    Antes desta reorganização a Fila morava em DOIS lugares distantes:
    `agentes/fila/` (estado, histórico e log) e `Fila/`, na raiz do projeto
    (os relatórios). Agora os relatórios são apenas mais uma subpasta daqui.
    """
    return obter_pasta_de_dados(project_name, PASTA_ASSISTENTE, PASTA_FILA)


def obter_arquivo_de_estado_da_fila(project_name):
    return os.path.join(obter_pasta_da_fila(project_name), ARQUIVO_ESTADO_DA_FILA)


def obter_pasta_de_historico_da_fila(project_name):
    return os.path.join(obter_pasta_da_fila(project_name), PASTA_HISTORICO_DA_FILA)


def obter_pasta_de_log_da_fila(project_name):
    return os.path.join(obter_pasta_da_fila(project_name), PASTA_LOG_DA_FILA)


def obter_pasta_de_relatorios_da_fila(project_name):
    return os.path.join(obter_pasta_da_fila(project_name), PASTA_RELATORIOS_DA_FILA)


def obter_pasta_do_designer(project_name):
    return obter_pasta_de_dados(project_name, PASTA_ASSISTENTE, PASTA_DESIGNER)


def obter_pasta_de_conversas_do_designer(project_name):
    return os.path.join(obter_pasta_do_designer(project_name), PASTA_CONVERSAS_DO_DESIGNER)


def obter_arquivo_de_preferencias_do_designer(project_name):
    return os.path.join(obter_pasta_do_designer(project_name), ARQUIVO_PREFERENCIAS_DO_DESIGNER)


# O mapa Pipeline (Mapas) NÃO tem pasta, e isso é de propósito: ele só LÊ o
# `pipeline.md` e o `_niveis.json` que a rotina Pipeline grava em Automação ›
# Rotinas («aqui se gera, lá desenha»). Se alguém for criar uma pasta para
# ele, o que está faltando é entender que ele não gera artefato nenhum.


# ── Aba Automação ────────────────────────────────────────────────────────────

def obter_pasta_de_automacao(project_name):
    return obter_pasta_de_dados(project_name, PASTA_AUTOMACAO)


def obter_arquivo_de_acionamentos(project_name):
    return os.path.join(obter_pasta_de_automacao(project_name), ARQUIVO_ACIONAMENTOS)


def obter_pasta_das_rotinas(project_name):
    """A pasta-mãe das rotinas. Não é a saída de nenhuma delas."""
    return os.path.join(obter_pasta_de_automacao(project_name), PASTA_ROTINAS)


def obter_arquivo_de_configuracao_das_rotinas(project_name):
    return os.path.join(obter_pasta_das_rotinas(project_name),
                        ARQUIVO_CONFIGURACAO_DAS_ROTINAS)


def obter_arquivo_de_pendencias_das_rotinas(project_name):
    return os.path.join(obter_pasta_das_rotinas(project_name),
                        ARQUIVO_PENDENCIAS_DAS_ROTINAS)


def obter_arquivo_de_historico_das_rotinas(project_name):
    """`Automação/Rotinas/Histórico.jsonl` — o que aconteceu, na ordem.

    ⚠️ **FORA das dezesseis pastas de rotina, de propósito.** "Limpar dados
    gerados" apaga `set(PASTAS_DAS_ROTINAS.values())`, e o histórico é
    justamente o que se quer ter em mãos DEPOIS de limpar e regerar: ele é o
    registro de que a limpeza aconteceu, não uma saída de rotina. Fica ao lado
    do `Pendências.json`, que é irmão dele em prazo — aquele guarda o que ficou
    faltando do último ciclo, este guarda o que aconteceu nos últimos.

    `.jsonl` e não `.json`: o arquivo é escrito por acréscimo, de várias threads,
    enquanto as rotinas rodam. Reler e reescrever um array inteiro a cada arquivo
    processado perderia linha na primeira corrida entre duas threads da
    Doc. Técnica.
    """
    return os.path.join(obter_pasta_das_rotinas(project_name),
                        ARQUIVO_HISTORICO_DAS_ROTINAS)


def obter_arquivo_de_cobertura_das_rotinas(project_name):
    """`Automação/Rotinas/Cobertura.json` — os seis medidores do Painel de Mapas.

    ⚠️ FORA das pastas de rotina, como o `Histórico.jsonl`: é de TODAS elas, e
    não saída de uma. "Limpar dados gerados" não o apaga — REGRAVA, no fim da
    limpeza, para o Painel mostrar o que sobrou. Quem grava é
    `CoberturaMixin.gravar_cobertura_agentes`; quem lê, o Painel, por
    `ler_cobertura_agentes`.
    """
    return os.path.join(obter_pasta_das_rotinas(project_name),
                        ARQUIVO_COBERTURA_DAS_ROTINAS)


def obter_arquivo_de_mudancas(project_name):
    """`Automação/Rotinas/Detector/mudanças.json` — a saída do Detector."""
    return obter_pasta_da_rotina(project_name, 'detector',
                                 ARQUIVO_DE_MUDANCAS_DO_DETECTOR)


def obter_pasta_da_rotina(project_name, id_rotina, *partes):
    """A pasta de saída de UMA rotina, pelo id dela.

    Levanta `RotinaDesconhecida` para id que não está no mapa — ver a
    docstring da exceção para saber quem trata e quem deixa estourar.

    Efeito colateral bem-vindo: como o id passa pelo mapa em vez de ser
    concatenado cru no caminho, uma string arbitrária vinda da tela não
    produz caminho nenhum. A contenção contra `..` deixa de depender de cada
    consumidor lembrar de fazê-la.
    """
    pasta = PASTAS_DAS_ROTINAS.get(id_rotina)
    if pasta is None:
        raise RotinaDesconhecida(f'Rotina desconhecida: {id_rotina}')
    return os.path.join(obter_pasta_das_rotinas(project_name), pasta, *partes)


# ── Aba Trabalhos ────────────────────────────────────────────────────────────
# ⚠️ `Estado.json` e `Configuração.json` ficam na RAIZ de `Trabalhos/`, e não
# dentro de uma subpasta de conteúdo — é a mesma invariante do topo deste
# módulo, a que já põe o `Estado.json` da Fila na raiz de `Fila/`.

def obter_pasta_de_trabalhos(project_name, *partes):
    """`Files/projects/{Projeto}/Trabalhos/...` — tudo que a aba Trabalhos escreve."""
    return obter_pasta_de_dados(project_name, PASTA_TRABALHOS, *partes)


def obter_arquivo_de_estado_dos_trabalhos(project_name):
    """Os cartões do Quadro. Só eles — o que cresce a cada evento mora fora."""
    return obter_pasta_de_trabalhos(project_name, ARQUIVO_ESTADO_DOS_TRABALHOS)


def obter_arquivo_de_configuracao_dos_trabalhos(project_name):
    """O que ESTE projeto ligou/desligou. O padrão de fábrica é global, e mora
    no `settings.json` — aqui fica só o desvio do projeto."""
    return obter_pasta_de_trabalhos(project_name, ARQUIVO_CONFIGURACAO_DOS_TRABALHOS)


def obter_pasta_de_trabalhos_no_projeto(pasta_raiz, *partes):
    """`{raiz do projeto}/Trabalhos/...` — o que o AGENTE alcança sem permissão.

    ⚠️ A RAIZ VEM DE FORA, E ISSO NÃO É DESLEIXO. Este módulo decide onde as
    coisas ficam DENTRO da área do programa, e a raiz de código do usuário não
    é dele: quem a resolve é `ferramentas_subagentes.py::_sub_root_folder`, a
    partir do `root_folder` do workspace, e é a MESMA origem que o terminal
    usa para escolher o `cwd`. Descobrir a raiz uma segunda vez aqui é como se
    abre uma exceção sem querer — o terminal abriria num lugar e o agente
    procuraria noutro, sem erro nenhum na tela.

    Gêmea de `obter_pasta_de_trabalhos`, que continua sendo o estado interno e
    NÃO muda. As duas coexistem de propósito.
    """
    return os.path.join(pasta_raiz, PASTA_TRABALHOS_NO_PROJETO, *partes)


# ── Aba Backups ──────────────────────────────────────────────────────────────
# `Files/backups/{Projeto}/` é irmã de `Files/projects/{Projeto}/`, não filha.
# A árvore inteira:
#
#     Files/backups/{Projeto}/
#       arquivos/{aa}/{hash}   ← o conteúdo de cada arquivo, guardado UMA vez
#       versoes.json           ← a lista de Versões (caminho → hash)
#       configuracao.json      ← a lista de exclusões e os interruptores da aba

def obter_pasta_de_backups(project_name, *partes):
    """`Files/backups/{Projeto}/...` — a base de tudo que o backup escreve."""
    return os.path.join(BACKUPS_DIR, project_name, *partes)


def obter_pasta_de_arquivos_das_versoes(project_name, *partes):
    """Onde o conteúdo mora, endereçado pelo hash."""
    return obter_pasta_de_backups(project_name, PASTA_ARQUIVOS_DAS_VERSOES, *partes)


def obter_arquivo_das_versoes(project_name):
    return obter_pasta_de_backups(project_name, ARQUIVO_DAS_VERSOES)


def obter_arquivo_de_configuracao_do_backup(project_name):
    """A configuração da ABA BACKUPS — que não é, e nunca foi, o Workspace.

    Mora aqui de propósito, longe do `Workspace.json`: a lista de exclusões do
    backup não tem nada a ver com a lista "Remover" da aba Projeto, e guardar
    as duas no mesmo arquivo é o convite para uma voltar a ler a outra.
    """
    return obter_pasta_de_backups(project_name, ARQUIVO_DE_CONFIGURACAO_DO_BACKUP)


# ── Os prompts ───────────────────────────────────────────────────────────────
# Um caminho de prompt nunca se monta na mão fora daqui — é a mesma regra que
# vale para as pastas de dados. Quem lê o arquivo é o consumidor; quem sabe
# ONDE ele está é este módulo.

def obter_prompt_de_rotina(nome_do_arquivo):
    """`prompts/Rotinas/{nome}` — o `.txt` do prompt ou o `.json` do esquema."""
    return os.path.join(PROMPTS_DIR, PASTA_ROTINAS, nome_do_arquivo)


def obter_prompt_do_assistente(*partes):
    """`prompts/Assistente/...` — Chat, Fila, Designer e Subagentes."""
    return os.path.join(PROMPTS_DIR, PASTA_ASSISTENTE, *partes)


def obter_prompt_dos_trabalhos(nome_do_arquivo):
    """`prompts/Trabalhos/{nome}` — o prompt fixo de cada papel de terminal.

    Fora de `Assistente/` pelo mesmo motivo que a pasta de dados: a árvore de
    prompts espelha a das abas, e Trabalhos é aba de primeiro nível.
    """
    return os.path.join(PROMPTS_DIR, PASTA_TRABALHOS, nome_do_arquivo)


def obter_prompt_do_como_adicionar(*partes):
    """`prompts/Como adicionar/...` — o texto da sub-aba Como adicionar de Arquivos."""
    return os.path.join(PROMPTS_DIR, PASTA_COMO_ADICIONAR, *partes)


def obter_prompt_do_subagente(id_do_subagente, nome_do_arquivo):
    """O `system-prompt.txt` ou o `prompt-correcao.txt` de um subagente.

    Levanta `SubagenteDesconhecido` para id fora do mapa, pelo mesmo motivo
    que `obter_pasta_da_rotina` levanta `RotinaDesconhecida`: id inventado é
    erro de digitação ou string arbitraria vinda da tela, e nos dois casos
    cair num prompt padrao seria pior que estourar.
    """
    pasta = PASTAS_DOS_SUBAGENTES_POR_ID.get(id_do_subagente)
    if pasta is None:
        # Antes de estourar: um subagente de extensão LIGADA (fase 12). O
        # programa nunca chega aqui com os ids dele, então nada muda para eles.
        do_extensao = _arquivo_de_subagente_de_extensao(id_do_subagente, nome_do_arquivo)
        if do_extensao:
            return do_extensao
        raise SubagenteDesconhecido(f'Subagente desconhecido: {id_do_subagente}')
    # O Verificador é o único que não mora sob `Subagentes/`: ele é subagente
    # da Fila, e a pasta dele acompanha a tela que o aciona.
    if id_do_subagente == 'fila-verificador':
        return obter_prompt_do_assistente(PASTA_FILA, pasta, nome_do_arquivo)
    return obter_prompt_do_assistente(PASTA_DOS_SUBAGENTES, pasta, nome_do_arquivo)


def obter_bloco_de_subagente(id_do_subagente):
    """A descrição que entra no system prompt de quem chama o subagente.

    Aqui o id vira nome de arquivo em minúscula, e não pasta — os blocos são
    dez (o `navegador` tem bloco e não tem prompt).
    """
    if id_do_subagente not in PASTAS_DOS_SUBAGENTES_POR_ID and id_do_subagente != 'navegador':
        do_extensao = _arquivo_de_subagente_de_extensao(id_do_subagente, 'bloco.txt')
        if do_extensao:
            return do_extensao
    return obter_prompt_do_assistente(
        PASTA_DOS_SUBAGENTES, PASTA_DOS_BLOCOS, f'{id_do_subagente}.txt')


def _arquivo_de_subagente_de_extensao(id_do_subagente, nome_do_arquivo):
    """O arquivo do trio na `pasta` do subagente de extensão, ou `None`.
    Import tardio: `extensoes` importa a descoberta, que lê caminhos daqui."""
    from .extensoes.agentes import arquivo_do_subagente_de_extensao
    return arquivo_do_subagente_de_extensao(id_do_subagente, nome_do_arquivo)


def obter_bloco_do_designer(nome_do_bloco):
    """O bloco condicional que entra no system prompt do Designer.

    Mesmo mecanismo dos subagentes, e de propósito: uma pasta `Blocos/` com um
    `.txt` por item, e a montagem junta só os escolhidos, na ordem canônica. Aqui
    o "item" é uma DIMENSÃO (estilo, cor, tipografia, textura, animacao) mais o
    `regras-invioláveis`, que é o único que entra sempre.

    ⚠️ As PASTAS das cinco dimensões não moram aqui. Elas têm uma declaração só,
    em `modulos/estilos_e_cores.py`, e é de lá que o Designer as lê — duas cópias
    divergiriam na primeira vez que uma dimensão mudasse de pasta.
    """
    return obter_prompt_do_assistente(
        PASTA_DESIGNER, PASTA_DOS_BLOCOS, f'{nome_do_bloco}.txt')


def obter_prompt_fixo(tela, chave):
    """`prompts/Assistente/{Tela}/Prompts fixos/{chave}.txt`.

    `tela` tem que estar em `TELAS_COM_PROMPT_FIXO` e `chave` não pode
    carregar separador nenhum: as duas vêm da interface, e é aqui que a
    contenção acontece — não em cada consumidor. Devolve `None` para entrada
    fora do combinado, e quem chama trata como "prompt não encontrado".
    """
    if tela not in TELAS_COM_PROMPT_FIXO:
        return None
    if not chave or '/' in chave or '\\' in chave or '.' in chave:
        return None
    return obter_prompt_do_assistente(tela, PASTA_DOS_PROMPTS_FIXOS, f'{chave}.txt')
