"""O catálogo da aba Trabalhos — a fonte ÚNICA das listas fechadas dela.

Colunas do Quadro, tags, lista de bloqueio, gatilhos do Portão e limites moram
todos aqui, e em lugar nenhum mais. O motivo é o mesmo que criou o
`catalogo_mcp.py`, e ele já custou um defeito real neste projeto: o comentário
de `arquivos.py::_mcp_registrar` conta que a lista de ferramentas era literal
em dois lugares, e "ferramenta que existisse no `TOOLS` do servidor e não aqui
SUMIA do MCP no instante em que o usuário desligasse qualquer outra".

Aqui a mesma lista é lida por quatro consumidores muito distantes entre si:

    a tela de Configuração (Trabalhos › Configuração)
    o system prompt de cada terminal (`prompts/Trabalhos/`)
    o hook `PostToolUse` gravado no `.claude/settings.json` do projeto
    a verificação sem IA, que recusa o comando antes de ele rodar

Uma cópia à mão em qualquer um deles vira o mesmo defeito: a tela mostra uma
regra que o hook não aplica, e ninguém tem como notar.

⚠️ Nada aqui pode importar módulo do programa. Este arquivo é lido pelo
processo do servidor MCP, que é OUTRO processo do sistema operacional e carrega
o backend antes de a `Api` existir — a mesma restrição que vale para o
`catalogo_mcp.py`, e pelo mesmo motivo.
"""

# ── O Quadro: as seis colunas, nesta ordem ──────────────────────────────────
# O `id` viaja para o disco (`Estado.json`) e entre processos (o servidor MCP
# escreve nele), então NÃO muda nunca. O `rotulo` é texto de tela e pode mudar.
# É a mesma separação de `PASTAS_DAS_ROTINAS`: id sem acento, rótulo com.
#
# ⚠️ A ordem desta lista É a ordem das colunas na tela.
COLUNAS_DO_QUADRO = [
    {'id': 'na-fila',        'rotulo': 'Na fila',         'cor': 'neutro'},
    {'id': 'fazendo',        'rotulo': 'Fazendo',         'cor': 'azul'},
    {'id': 'precisa-de-voce', 'rotulo': 'Precisa de você', 'cor': 'alerta'},
    {'id': 'revisar',        'rotulo': 'Revisar',         'cor': 'verde'},
    {'id': 'falhou',         'rotulo': 'Falhou',          'cor': 'vermelho'},
    {'id': 'desistido',      'rotulo': 'Desistido',       'cor': 'cinza'},
]

IDS_DAS_COLUNAS = tuple(c['id'] for c in COLUNAS_DO_QUADRO)

# Toda atividade nasce aqui, sem exceção — inclusive a criada pelo assistente.
COLUNA_INICIAL = 'na-fila'

# A coluna do Portão. Quando um gatilho dispara, é para cá que o cartão vai.
COLUNA_DO_PORTAO = 'precisa-de-voce'


# ── As tags: vocabulário FECHADO ────────────────────────────────────────────
# ⚠️ O agente NÃO pode inventar tag. Uma tag fora desta lista é recusada na
# ferramenta de MCP, não silenciosamente ignorada: ignorar em silêncio deixaria
# o agente achando que marcou o cartão, e o cartão sem marca nenhuma.
#
# `automatica: True` = quem põe é o programa, a partir de um fato que ele
# conhece (existe briefing? quantos arquivos?). O agente não as marca à mão.
TAGS_DAS_ATIVIDADES = [
    {'id': 'briefing',   'rotulo': 'Briefing',   'automatica': True},
    {'id': 'arquivos',   'rotulo': 'arquivos',   'automatica': True},
    {'id': 'dependencia', 'rotulo': 'depende de', 'automatica': True},
    {'id': 'obra',       'rotulo': 'obra',        'automatica': False},
    {'id': 'pesquisar',  'rotulo': 'pesquisar',   'automatica': False},
    {'id': 'teste',      'rotulo': 'teste',       'automatica': False},
    {'id': 'conferencia', 'rotulo': 'conferência', 'automatica': False},
]

IDS_DAS_TAGS = tuple(t['id'] for t in TAGS_DAS_ATIVIDADES)

# As que o agente pode marcar sozinho — o resto o programa deriva de um fato.
IDS_DAS_TAGS_MANUAIS = tuple(t['id'] for t in TAGS_DAS_ATIVIDADES if not t['automatica'])


# ── Autoria: quem escreveu o cartão ─────────────────────────────────────────
# São DOIS, e a lista é fechada de propósito. Nenhuma fonte automática cria
# cartão — nem relatório da Fila, nem `Briefing.md` de discussão, nem as skills
# de sugestão, nem `Pendências.json`. Quem cria é o usuário, à mão, ou o
# Orquestrador, pela ferramenta de MCP.
AUTORIA_USUARIO      = 'voce'
AUTORIA_ORQUESTRADOR = 'orquestrador'

AUTORIAS = [
    {'id': AUTORIA_USUARIO,      'rotulo': 'alterada por você'},
    {'id': AUTORIA_ORQUESTRADOR, 'rotulo': 'escrita pelo assistente'},
]

IDS_DAS_AUTORIAS = (AUTORIA_USUARIO, AUTORIA_ORQUESTRADOR)


# ── A lista de bloqueio ─────────────────────────────────────────────────────
# Dois painéis, e a diferença entre eles não é de gravidade — é de se dá para
# recusar SEM JULGAR INTENÇÃO.
#
# ⚠️ "Apagar em massa" e "rodar script fora do briefing" NÃO estão aqui, e a
# ausência é deliberada: não dá para distinguir deterministicamente um refactor
# legítimo de um desastre. Ficam com o julgamento do agente, cercadas pela
# pasta restrita e pelo backup manual. "Mexer no próprio programa" também não
# está: já está coberto pela pasta liberada ser só a do projeto ativo.

# Painel 1 — SEM interruptor. Não existe configuração que ligue nenhum destes.
BLOQUEIOS_DUROS = [
    {'id': 'sair-da-pasta',
     'rotulo': 'Sair da pasta do projeto ativo',
     'comandos': [],
     'porque': 'A única trava 100% dura. Não há exceção configurável.'},
    {'id': 'enviar-para-fora',
     'rotulo': 'Publicar ou enviar para fora',
     'comandos': ['git push', 'scp', 'ftp', 'sftp', 'rsync'],
     'porque': 'Sai da máquina, e o que saiu não volta.'},
]

# Painel 2 — COM interruptor, todos DESLIGADOS de fábrica.
# ⚠️ Desligado = recusado, exatamente como o painel de cima. O interruptor não
# é "avisar": é "deixar acontecer".
BLOQUEIOS_COM_INTERRUPTOR = [
    {'id': 'instalar-dependencia',
     'rotulo': 'Instalar pacote ou dependência',
     'comandos': ['pip install', 'npm install', 'npm i', 'yarn add', 'winget install'],
     'padrao': False},
    {'id': 'acessar-rede',
     'rotulo': 'Acessar rede',
     'comandos': ['curl', 'wget', 'Invoke-WebRequest', 'Invoke-RestMethod'],
     'padrao': False},
    {'id': 'rodar-o-programa',
     'rotulo': 'Rodar o próprio programa',
     'comandos': [],
     'padrao': False},
    {'id': 'git-commit',
     'rotulo': 'git commit',
     'comandos': ['git commit'],
     'padrao': False},
    {'id': 'rodar-teste',
     'rotulo': 'Rodar teste automatizado',
     'comandos': ['pytest', 'npm test', 'npm run test'],
     'padrao': False},
]

IDS_DOS_BLOQUEIOS_DUROS         = tuple(b['id'] for b in BLOQUEIOS_DUROS)
IDS_DOS_BLOQUEIOS_COM_INTERRUPTOR = tuple(b['id'] for b in BLOQUEIOS_COM_INTERRUPTOR)


# ── O Portão: quando o fluxo para e chama o usuário ─────────────────────────
# ⚠️ A PRIMEIRA LINHA NÃO DESLIGA, e isso é a trava, não uma preferência: um
# comando da lista de bloqueio sempre para o fluxo. As outras são preferência.
GATILHOS_DO_PORTAO = [
    {'id': 'comando-bloqueado',
     'rotulo': 'Tentou um comando da lista de bloqueio',
     'padrao': True, 'fixo': True},
    {'id': 'contraria-decisao',
     'rotulo': 'Contraria uma decisão já registrada nas bases',
     'padrao': True, 'fixo': False},
    {'id': 'mexe-em-arquivo',
     'rotulo': 'Cria, move, renomeia ou apaga arquivo',
     'padrao': True, 'fixo': False},
    {'id': 'muda-assinatura',
     'rotulo': 'Muda assinatura usada por outros arquivos',
     'padrao': True, 'fixo': False},
    {'id': 'reprovou-n-vezes',
     'rotulo': 'Reprovou N vezes seguidas no mesmo pedaço',
     'padrao': True, 'fixo': False},
    {'id': 'vaga-demais',
     'rotulo': 'A atividade estava vaga demais para começar',
     'padrao': True, 'fixo': False},
    {'id': 'passou-de-2h',
     'rotulo': 'Passou de 2 horas na mesma atividade',
     'padrao': False, 'fixo': False},
]

IDS_DOS_GATILHOS = tuple(g['id'] for g in GATILHOS_DO_PORTAO)

# O gatilho que não desliga. Existe como constante para a tela poder desenhar o
# cadeado e o backend poder recusar um patch que tente apagá-lo — sem que
# nenhum dos dois precise saber qual é o índice dele na lista.
GATILHO_FIXO = 'comando-bloqueado'


# ── Os limites ──────────────────────────────────────────────────────────────
# Só `tentativas_por_pedaco` é editável. Os outros são INVARIANTES do desenho,
# e aparecem na tela como leitura — mostrar um campo que não muda nada seria
# pior que não mostrar.
#
# ⚠️ "Serial ou paralelo" não tem campo de propósito: o Orquestrador decide
# sozinho, e um interruptor de "sempre serial" desfaria essa decisão.
LIMITES_EDITAVEIS = [
    {'id': 'tentativas_por_pedaco', 'rotulo': 'Tentativas por pedaço',
     'padrao': 3, 'minimo': 1, 'maximo': 10},
    # ⚠️ O FREIO DA IDA E VOLTA (Fase 3). Uma ligação de ida e volta dispara o
    # outro lado toda vez que um lado termina — e sem teto isso é um pingue-
    # pongue que não para sozinho, gastando cota paga a cada volta. O teto não
    # é preferência de gosto: é o que garante que a conversa acaba. Ao bater
    # nele, os dois terminais param e o motivo aparece no log de ambos.
    {'id': 'rodadas_ida_e_volta', 'rotulo': 'Rodadas de uma ida e volta',
     'padrao': 4, 'minimo': 1, 'maximo': 20},
]

LIMITES_FIXOS = [
    {'id': 'subagentes',        'rotulo': 'Subagentes (além do Orquestrador)', 'valor': '3'},
    {'id': 'serial-paralelo',   'rotulo': 'Serial ou paralelo',                'valor': 'o Orquestrador decide'},
    {'id': 'conferencia-antes', 'rotulo': 'Conferência do programa antes da do agente', 'valor': 'sempre'},
    {'id': 'quem-confere',      'rotulo': 'Quem confere é sempre outro subagente', 'valor': 'sim'},
    {'id': 'mesmo-arquivo',     'rotulo': 'Dois subagentes no mesmo arquivo',   'valor': 'recusado', 'grave': True},
    {'id': 'backup',            'rotulo': 'Backup (manual, pela aba Backups)',  'valor': 'antes de rodar'},
    {'id': 'atividades',        'rotulo': 'Atividades ao mesmo tempo',          'valor': '1'},
    {'id': 'quem-move',         'rotulo': 'Quem move os cartões',               'valor': 'você e ele'},
    {'id': 'contexto',          'rotulo': 'Perto do limite de contexto',        'valor': 'abre sessão nova'},
]


# ── Os papéis de terminal (Fase 2) ──────────────────────────────────────────
# São DOIS papéis, e a lista é fechada: um Orquestrador e Subagentes idênticos
# entre si. Os sete papéis antigos (Explorador/Planejador/Executor/Verificador/
# Corretor/Redator) foram descartados e não voltam.
#
# ⚠️ O PAPEL SÓ EXISTE QUANDO O NÓ NASCE DE UM CARTÃO DO QUADRO. Um nó que o
# usuário cria pela barra de ferramentas da Oficina não tem papel nenhum — nome
# e cor são livres, e não há nada para travar. Os dois tipos convivem no mesmo
# canvas sem conflito.
#
# `cor` é o NOME de uma variável CSS que o tema já define — nunca um literal.
# Trocar de tema tem que trocar a cor do nó junto, e um `#A78BFA` cravado aqui
# ficaria certo só no tema Ardósia.
PAPEIS_DE_TERMINAL = [
    {'id': 'orquestrador', 'rotulo': 'Orquestrador', 'inicial': 'O',
     'cor': '--agente-orquestrador',
     'prompt': 'orquestrador.md',
     'descricao': 'Coordena UMA atividade por vez. É o único que escreve no Quadro.'},
    {'id': 'subagente', 'rotulo': 'Subagente', 'inicial': 'S',
     'cor': '--sky',
     'prompt': 'subagente.md',
     'descricao': 'Executa UM pedaço. Não escreve no Quadro, não abre terminal.'},
]

IDS_DOS_PAPEIS = tuple(p['id'] for p in PAPEIS_DE_TERMINAL)

# As cores que distinguem um Subagente do outro quando há vários abertos. Roxo
# fica de fora de propósito: é a cor do Orquestrador, e repeti-la num Subagente
# desfaria a única leitura que a cor precisa dar de longe.
CORES_DOS_SUBAGENTES = ('--sky', '--teal', '--rosa-light')


# ── Os tipos de nó da Oficina (Fase 2) ──────────────────────────────────────
# ⚠️ NÃO EXISTE NÓ DE NAVEGADOR, e a ausência é decisão registrada: não foi
# pedido com convicção, e fica fora até fazer falta de verdade.
#
# ⚠️ `terminal` E `shell` SÃO NÓS DIFERENTES, e conviver é a decisão. O primeiro
# é um AGENTE: cada mensagem é uma execução completa do produto de assistente
# (o "tiro só"), e é ele que ganha papel, dependência e métrica. O segundo é o
# TERMINAL DO SISTEMA: um `cmd.exe` vivo em que se digita comando, sem IA
# nenhuma no meio. Foi pedido do usuário depois de usar a primeira versão — e a
# escolha explícita foi ter os dois, não trocar um pelo outro.
TIPOS_DE_NO = [
    {'id': 'terminal', 'rotulo': 'Terminal',
     'descricao': 'O terminal do sistema, aberto na pasta raiz do projeto. '
                  'Clique nele e digite; se você escolher um modo na criação, '
                  'o comando do produto já entra digitado.'},
    {'id': 'nota', 'rotulo': 'Nota',
     'descricao': 'Cartão editável, escrito em Markdown.'},
    {'id': 'texto', 'rotulo': 'Texto',
     'descricao': 'Rótulo solto, sem moldura — comentário do usuário sobre uma região.'},
]

# ⚠️ `shell` FOI UM TIPO, E DEIXOU DE SER. Ele nasceu para separar "terminal do
# sistema" de "agente", e o usuário recusou a separação: *"agente e terminal é
# uma coisa só, não sei por que você separou"*. Hoje `terminal` É o terminal do
# sistema, e o agente é um MODO dele — uma string que o programa digita lá
# dentro. Nós gravados como `shell` na primeira versão são lidos como
# `terminal`; ver `_trab_normalizar_tipo` em `trabalhos_layout.py`.
TIPO_APOSENTADO = {'shell': 'terminal'}

IDS_DOS_TIPOS_DE_NO = tuple(t['id'] for t in TIPOS_DE_NO)


# ── Os tipos de ligação da Oficina (Fase 3) ─────────────────────────────────
# ⚠️ LIGAÇÃO NÃO É DESENHO. Contra a recomendação original da discussão, o
# usuário decidiu que as quatro travam e fluem de verdade — uma linha na tela
# muda o que acontece com os processos. Quem implementar uma quinta que só
# desenha estará desfazendo essa decisão.
#
# O mecanismo estende o canal de ARQUIVO que o programa já usa para falar com
# o assistente externo (o programa escreve, o assistente lê). Nenhum transporte
# novo foi inventado: não há socket, porta nem protocolo entre os processos.
#
#   `canal`  = a ligação cria arquivo de canal. Quem tem canal passa DADO.
#   `duplo`  = são dois arquivos, um por sentido (só a ida e volta).
#   `dispara` = terminar de um lado ACIONA o outro sozinho.
#
# ⚠️ SÃO TRÊS, E TODA LIGAÇÃO LIGA DOIS NÓS. Existiu uma quarta, a
# "triangulação", que ligava um nó a uma LIGAÇÃO: um terceiro terminal ganhava
# no prompt os caminhos dos arquivos de canal de uma ligação alheia. Ela saiu
# porque era exceção em tudo — modelo de dados só dela (`para` vazio,
# `observado` no lugar), campo de catálogo só dela (`observa`), validação,
# desenho e caminho de criação só dela — e porque o mesmo efeito se obtém
# ligando esse terceiro à mesma origem, com uma mão única.
#
# ⚠️ `dependencia` e `mao-unica` são ORTOGONAIS de propósito, e é comum querer
# as duas juntas: dependência é ORDEM (B não começa antes de A acabar), mão
# única é DADO (B lê o que A produziu). Uma sem a outra é legítima — B pode
# ler o canal de A na próxima vez que o usuário falar com ele, sem que A tenha
# de acionar ninguém.
TIPOS_DE_LIGACAO = [
    {'id': 'dependencia', 'rotulo': 'Dependência', 'seta': 'A espera B',
     'traco': 'tracejada', 'canal': False, 'duplo': False, 'dispara': True,
     'descricao': 'Ordem: o destino só começa depois que a origem entregar. '
                  'Hoje isto é só desenho — o programa não segura disparo '
                  'nenhum por causa dela.'},
    {'id': 'mao-unica', 'rotulo': 'Mão única', 'seta': 'A → B',
     'traco': 'solida-fina', 'canal': True, 'duplo': False, 'dispara': False,
     'descricao': 'Dado: o que a origem produz, o destino lê. Entre dois '
                  'terminais isto hoje é só desenho; puxada a partir de uma '
                  'NOTA, ela vale de verdade — o agente recebe a nota no '
                  'prompt dele.'},
    {'id': 'ida-e-volta', 'rotulo': 'Ida e volta', 'seta': 'A ↔ B',
     'traco': 'solida-grossa', 'canal': True, 'duplo': True, 'dispara': True,
     'descricao': 'Conversa: cada lado responde ao outro por rodada, com teto '
                  'de rodadas. Hoje isto é só desenho — o programa não '
                  'conduz rodada nenhuma.'},
]

IDS_DOS_TIPOS_DE_LIGACAO = tuple(l['id'] for l in TIPOS_DE_LIGACAO)

# Os que criam arquivo de canal — a lista que decide se apagar a ligação
# também apaga arquivo, e se o destino ganha caminho no contexto.
IDS_DAS_LIGACOES_COM_CANAL = tuple(l['id'] for l in TIPOS_DE_LIGACAO if l['canal'])


# ── A legenda de status (Fase 2) ────────────────────────────────────────────
# ⚠️ UMA LEGENDA SÓ, reaproveitada pela Linha do tempo, pela Oficina e (na Fase
# 4) pelo Fluxo. Duas legendas para os mesmos estados é o caminho mais curto
# para o usuário achar que são coisas diferentes.
#
# `aguardando` já existe aqui, embora só a Fase 3 vá produzi-lo (é o estado de
# um nó travado por dependência): declarar agora evita que a Fase 3 invente uma
# sétima cor por não achar esta.
ESTADOS_DE_TERMINAL = [
    {'id': 'parado',     'rotulo': 'parado',                 'cor': '--cinza-escuro'},
    {'id': 'fazendo',    'rotulo': 'fazendo',                'cor': '--blue'},
    {'id': 'entregue',   'rotulo': 'entregue/aprovado',      'cor': '--green'},
    {'id': 'aguardando', 'rotulo': 'aguardando dependência', 'cor': '--cinza'},
    {'id': 'perguntou',  'rotulo': 'parou pra perguntar',    'cor': '--amber'},
    {'id': 'falhou',     'rotulo': 'falhou',                 'cor': '--red'},
]

IDS_DOS_ESTADOS = tuple(e['id'] for e in ESTADOS_DE_TERMINAL)


# ── Os padrões de fábrica, GLOBAIS ──────────────────────────────────────────
# Vão para o `settings.json` do programa — o mesmo arquivo que já guarda os
# presets de Preparar Projeto. Cada projeto guarda só o DESVIO, no
# `Trabalhos/Configuração.json` dele.
#
# Derivado das listas acima, nunca escrito à mão: um bloqueio ou gatilho novo
# entra sozinho, com o padrão que ele mesmo declara.
def padroes_dos_trabalhos():
    padroes = {
        'trabalhos_bloqueio_' + b['id']: b['padrao'] for b in BLOQUEIOS_COM_INTERRUPTOR
    }
    padroes.update({
        'trabalhos_portao_' + g['id']: g['padrao'] for g in GATILHOS_DO_PORTAO
    })
    padroes.update({
        'trabalhos_limite_' + l['id']: l['padrao'] for l in LIMITES_EDITAVEIS
    })
    return padroes


PADROES_DOS_TRABALHOS = padroes_dos_trabalhos()
