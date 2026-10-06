"""M2 e M3 — os PONTOS DE ENCAIXE, lado servidor.

M1 deu à extensão um lugar SÓ DELA (uma categoria, uma aba). M2 e M3 são o
contrário: ela entra num lugar que **já existe** — desenha dentro do painel do
Terminal, acrescenta um item ao menu de contexto do Editor, põe um botão no
cartão do Quadro.

Os dois mecanismos saem juntos porque compartilham a peça de baixo: um
registro de pontos. A diferença entre eles é só o que a extensão faz quando o
ponto a chama — M2 **desenha** dentro do container, M3 **comanda** devolvendo
itens de ação. O registro é o mesmo.

⚠️ **Este módulo não executa nada da extensão.** Quem chama o encaixe é o
frontend (`extensoes/encaixes.js`), porque os pontos da primeira versão são
todos de tela. O que mora aqui é o CATÁLOGO — quais pontos existem, o que cada
um entrega — e a validação do que o manifesto declarou contra ele.

⚠️ **O catálogo vive só aqui.** Ele não é copiado para o JavaScript: o
frontend recebe a lista pronta, do mesmo jeito que já recebe as cores do
destaque em `descoberta.py`. Duas listas do mesmo conjunto divergem no
primeiro dia em que alguém acrescenta um ponto num lado só — e o sintoma seria
uma extensão válida aparecendo como "ponto desconhecido".
"""

from .constantes import erro_do_arquivo_declarado

# Como a extensão entra no ponto. Duas formas, e cada tela escolhe a sua pela
# natureza do lugar — não é preferência de quem escreve.
#
#   'painel' — o programa entrega um ELEMENTO e a extensão desenha dentro
#              dele. Serve onde há espaço em branco de verdade: o painel do
#              Terminal, o rodapé de um cartão. A função dela recebe
#              `(container, contexto)` e não devolve nada.
#   'itens'  — o programa pede uma LISTA e desenha ele mesmo. Serve onde o
#              desenho não é da extensão: o menu de contexto, que tem forma
#              própria e um componente só (`menu-contexto.js`). A função dela
#              recebe `(contexto)` e devolve `[{rotulo, icone, fazer}]`.
#
# ⚠️ A segunda forma existe para a extensão ESTENDER, e não reescrever. Se o
# menu de contexto fosse um ponto 'painel', a primeira extensão que entrasse
# nele desenharia o menu dela inteiro, com outra medida e outra cor — e o
# componente compartilhado teria deixado de valer para alguma coisa.
XT_FORMA_PAINEL = 'painel'
XT_FORMA_ITENS = 'itens'

# Os pontos da primeira versão. Cada um é uma linha de código numa tela que já
# existe, e nenhum é tela nova: ponto de encaixe que exige construir a tela
# antes não é ponto de encaixe, é funcionalidade.
#
# `recursos` diz que RECURSO da lista `acrescenta` pode usar o ponto (D38): o
# lugar é um detalhe do recurso, não um tipo à parte. É o que a validação do
# manifesto novo confere — "o lugar existe PARA ESTE recurso".
#
# ⚠️ **Ponto sem contrato escrito não existe.** Cada entrada aqui tem de ter a
# seção correspondente em `prompts/Como adicionar/Extensões/Contrato/Como criar
# extensões.md`, dizendo o que `container` e `contexto` carregam. Sem isso, o
# autor da extensão descobre o formato por tentativa e erro, e o formato passa
# a ser o que o código faz hoje em vez do que foi prometido.
XT_PONTOS = (
    {
        'ponto': 'terminal.painel',
        'forma': XT_FORMA_PAINEL,
        'recursos': ['painel'],
        'onde': 'Aba Terminal, abaixo da barra de ferramentas',
        'contexto': '{ projeto, caminho, origem } — o mesmo do `terminal.barra`',
    },
    {
        'ponto': 'terminal.barra',
        'forma': XT_FORMA_PAINEL,
        'recursos': ['painel'],
        'onde': 'Aba Terminal, na barra de ferramentas, entre "Selecionar script" '
                'e "▶ Executar"',
        'contexto': '{ projeto, caminho, origem } — `caminho` é o script que o '
                    '▶ Executar vai rodar ("" se nenhum); `origem` é "principal" '
                    '(o arquivo principal do projeto) ou "manual" (Selecionar script). '
                    'O ponto é repintado quando o caminho muda',
    },
    {
        'ponto': 'editor.menu',
        'forma': XT_FORMA_ITENS,
        'recursos': ['comando'],
        'onde': 'Editor › clique direito na árvore de arquivos',
        'contexto': '{ tipo: "arquivo"|"pasta"|"raiz", caminho, selecionados }',
    },
    {
        'ponto': 'editor.aba.menu',
        'forma': XT_FORMA_ITENS,
        'recursos': ['comando'],
        'onde': 'Editor › clique direito na aba de um arquivo aberto',
        'contexto': '{ caminho, fixado }',
    },
    {
        'ponto': 'arvore.menu',
        'forma': XT_FORMA_ITENS,
        'recursos': ['comando'],
        'onde': 'Qualquer árvore de pastas compartilhada (Acervo, Relações, '
                'Documentação, Mapa de I/O, Resumo, Tree-sitter, Backups)',
        'contexto': '{ caminho } — vazio quando o clique foi no vazio da raiz',
    },
    {
        'ponto': 'trabalhos.quadro.cartao',
        'forma': XT_FORMA_PAINEL,
        'recursos': ['comando'],
        'onde': 'Trabalhos › Quadro, no rodapé de cada cartão, ao lado de '
                '"editar" e "excluir"',
        'contexto': '{ id, titulo, coluna, tags, pasta }',
    },
    {
        'ponto': 'editor.decorador',
        'forma': XT_FORMA_ITENS,
        'recursos': ['marca'],
        'onde': 'Editor › sobre o código pintado, depois de cada pintura e de '
                'cada troca da janela de cor',
        'contexto': '{ projeto, caminho, linguagem, texto, linhas, visivel } — '
                    '`linhas` é `texto.split("\\n")`; `visivel` é `{de, ate}`, '
                    'as linhas que estão coloridas agora (1-indexado, inclusivo)',
    },
    {
        'ponto': 'acesso-rapido.comandos',
        'forma': XT_FORMA_ITENS,
        'recursos': ['comando'],
        'onde': 'A barra do Acesso rápido, no modo Comando',
        'contexto': '{ projeto, aba, arquivo }',
    },
    # ── Os painéis da fase 11 (D38): o recurso Painel em mais lugares. Cada um
    # é um `.xt-ponto` vazio no template da tela + uma linha `xtEncaixe` onde
    # ela já pinta + uma linha em `xtRepintarPontosAbertos`.
    {
        'ponto': 'editor.painel',
        'forma': XT_FORMA_PAINEL,
        'recursos': ['painel'],
        'onde': 'Editor, abaixo dos painéis de código e acima do rodapé',
        'contexto': '{ projeto, arquivo, linguagem } — repintado quando o arquivo '
                    'em foco muda, e não a cada tecla',
    },
    {
        'ponto': 'editor.rodape',
        'forma': XT_FORMA_PAINEL,
        'recursos': ['painel'],
        'onde': 'Editor › rodapé, um texto curto antes dos atalhos',
        'contexto': '{ projeto, arquivo, linguagem, linha, coluna } — repintado a '
                    'CADA movimento do cursor: a função tem de ser barata. '
                    '`arquivo` é "" sem arquivo aberto; binário vem sem linha/coluna',
    },
    {
        'ponto': 'chat.painel',
        'forma': XT_FORMA_PAINEL,
        'recursos': ['painel'],
        'onde': 'Assistente › Chat › Chat, acima das mensagens',
        'contexto': '{ projeto, chat } — `chat` é null sem chat aberto',
    },
    {
        'ponto': 'fila.painel',
        'forma': XT_FORMA_PAINEL,
        'recursos': ['painel'],
        'onde': 'Assistente › Fila › Fila, acima das mensagens',
        'contexto': '{ projeto, tarefa } — `tarefa` é null sem tarefa selecionada',
    },
    {
        'ponto': 'quadro.painel',
        'forma': XT_FORMA_PAINEL,
        'recursos': ['painel'],
        'onde': 'Trabalhos › Quadro, acima das colunas',
        'contexto': '{ projeto }',
    },
    {
        'ponto': 'oficina.painel',
        'forma': XT_FORMA_PAINEL,
        'recursos': ['painel'],
        'onde': 'Trabalhos › Oficina, logo abaixo da barra da Oficina, fora da '
                'área que dá zoom',
        'contexto': '{ projeto }',
    },
)

XT_PONTOS_POR_NOME = {p['ponto']: p for p in XT_PONTOS}

# Os LUGARES do recurso Tela (D36, D38, D42): uma aba nova, ou uma sub-aba numa
# aba que já tem sub-abas. Não são pontos de encaixe — o programa não pinta nada
# ali; ele cria um botão e um painel VAZIO, e a extensão desenha o painel
# inteiro. Por isso a lista é outra, e o registro no frontend é por `id` do
# item, e não por lugar: uma extensão pode ter duas sub-abas na mesma aba.
#
# Cada linha leva o que o FRONTEND precisa para encaixar sem repetir a lista
# (`extensoes/telas.js` recebe isto pronto, como recebe as cores do destaque):
#   barra     o `data-taborder-group` da barra onde o botão entra (no fim);
#   botao     a classe da família de botões daquela barra;
#   atributo  o `data-*` de navegação da família (vira `data-{atributo}`);
#   painel    a classe da família de painéis;
#   dentro    onde os painéis moram (o botão novo ganha o painel ao lado deles);
#   ligacao   quem pendura o clique:
#             'propria'         o programa põe um ouvinte no botão novo, que faz
#                               o mesmo que o handler da família;
#             'wire:{dispatch}' família de `_wireSubtabBar(escopo, dispatch)`:
#                               o botão novo ganha o próprio ouvinte, ESCOPADO
#                               ao `dentro` (`.agentes-subtab-btn` serve a
#                               quatro barras), e o `dispatch` da aba nunca é
#                               chamado com o id da extensão;
#             'categoria'       Configurações: `registrarCategoriaConfig`.
#
# ⚠️ Documentação e Acervo ficam de fora de propósito: as sub-abas delas não
# têm painel próprio (trocam a "fonte" de um painel só), e a barra do Acervo é
# refeita por `innerHTML` a cada troca de preset — um botão de extensão ali
# sumiria sozinho.
# ⚠️ Os valores de classe e atributo foram conferidos contra cada template em
# 23/09/2026. Mudou o template, muda aqui — senão o botão nasce numa barra que
# não existe e a tela fica sem a aba, sem erro nenhum.
XT_LUGARES_DE_TELA = (
    {'lugar': 'aba.nova', 'onde': 'Uma aba nova, depois das abas do projeto',
     'barra': 'main_tabs', 'botao': 'tab-btn', 'atributo': 'tab',
     'painel': 'tab-content', 'dentro': '.project-body', 'ligacao': 'propria'},
    {'lugar': 'projeto.subaba', 'onde': 'Projeto › uma sub-aba nova',
     'barra': 'projeto_subtabs', 'botao': 'subtab-btn', 'atributo': 'subtab',
     'painel': 'subtab-content', 'dentro': '#tab-projeto', 'ligacao': 'propria'},
    {'lugar': 'assistente.subaba', 'onde': 'Assistente › uma sub-aba nova',
     'barra': 'assistente_subtabs', 'botao': 'agentes-subtab-btn', 'atributo': 'asubtab',
     'painel': 'agentes-subtab-content', 'dentro': '#tab-assistente',
     'ligacao': 'wire:_dispatchAssistente'},
    {'lugar': 'arquivos.subaba', 'onde': 'Arquivos (dentro do projeto) › uma sub-aba nova',
     'barra': 'arquivos_subtabs', 'botao': 'arq-subtab-btn', 'atributo': 'arqsubtab',
     'painel': 'arq-subtab-content', 'dentro': '#tab-arquivos', 'ligacao': 'propria'},
    {'lugar': 'inicio-arquivos.subaba', 'onde': 'Arquivos (tela de Projetos) › uma sub-aba nova',
     'barra': 'garq_subtabs', 'botao': 'garq-subtab-btn', 'atributo': 'garqsubtab',
     'painel': 'garq-subtab-content', 'dentro': '#ptab-arquivos', 'ligacao': 'propria'},
    {'lugar': 'automacao.subaba', 'onde': 'Automação › uma sub-aba nova',
     'barra': 'agentes_subtabs', 'botao': 'agentes-subtab-btn', 'atributo': 'asubtab',
     'painel': 'agentes-subtab-content', 'dentro': '#tab-agentes',
     'ligacao': 'wire:_dispatchAutomacao'},
    {'lugar': 'analise.subaba', 'onde': 'Análise › uma sub-aba nova',
     'barra': 'analise_subtabs', 'botao': 'analise-tab-btn', 'atributo': 'analise',
     'painel': 'analise-tab-content', 'dentro': '#tab-analise', 'ligacao': 'propria'},
    {'lugar': 'mapas.subaba', 'onde': 'Mapas › uma sub-aba nova',
     'barra': 'mapas_subtabs', 'botao': 'mapas-tab-btn', 'atributo': 'mapa',
     'painel': 'mapas-tab-content', 'dentro': '#tab-mapas', 'ligacao': 'propria'},
    {'lugar': 'backups.subaba', 'onde': 'Backups › uma sub-aba nova',
     'barra': 'backups_subtabs', 'botao': 'agentes-subtab-btn', 'atributo': 'asubtab',
     'painel': 'agentes-subtab-content', 'dentro': '#tab-git', 'ligacao': 'wire:bkDespachar'},
    {'lugar': 'trabalhos.subaba', 'onde': 'Trabalhos › uma sub-aba nova',
     'barra': 'trabalhos_subtabs', 'botao': 'agentes-subtab-btn', 'atributo': 'asubtab',
     'painel': 'agentes-subtab-content', 'dentro': '#tab-trabalhos',
     'ligacao': 'wire:trDespachar'},
    {'lugar': 'inspetor.subaba', 'onde': 'Inspetor › uma sub-aba nova',
     'barra': 'inspetor_subtabs', 'botao': 'insp-tab-btn', 'atributo': 'insp',
     'painel': 'insp-tab-content', 'dentro': '#tab-inspetor', 'ligacao': 'propria'},
    {'lugar': 'configuracoes.subaba', 'onde': 'Configurações › lado Extensões',
     'ligacao': 'categoria'},
)
XT_LUGARES_DE_TELA_POR_NOME = {l['lugar']: l for l in XT_LUGARES_DE_TELA}

# O texto do botão de uma tela. Curto: a barra de abas quebra linha sozinha,
# mas um rótulo de frase inteira empurraria as abas do programa para baixo.
XT_TELA_ROTULO_MAX = 40
XT_TELA_ICONE_MAX = 4


def validar_item_tela(caminho_relativo, item, rotulo):
    """Confere o lugar, o rótulo, o ícone e o arquivo de um item `tela`.

    Devolve `(erro, normalizado)` — `normalizado` sem `recurso` nem `id`, que
    quem chama já conferiu. Duas telas da mesma extensão no MESMO lugar são
    permitidas: o registro do frontend é por `id`, não por lugar.
    """
    def texto(campo):
        v = item.get(campo)
        return v.strip() if isinstance(v, str) else ''

    lugar = texto('lugar')
    if lugar not in XT_LUGARES_DE_TELA_POR_NOME:
        return ('%s: lugar desconhecido "%s" para o recurso "tela". Os que existem '
                'hoje são: %s.' % (rotulo, lugar, ', '.join(sorted(XT_LUGARES_DE_TELA_POR_NOME)))), None
    rotulo_tela = texto('rotulo')
    if not rotulo_tela:
        return '%s: falta o `rotulo` (o texto do botão da tela).' % rotulo, None
    if len(rotulo_tela) > XT_TELA_ROTULO_MAX:
        return ('%s: o `rotulo` passa de %d caracteres.' % (rotulo, XT_TELA_ROTULO_MAX)), None
    icone = item.get('icone')
    if icone is not None and (not isinstance(icone, str) or len(icone.strip()) > XT_TELA_ICONE_MAX):
        return ('%s: `icone` é um glifo curto (até %d caracteres), nunca emoji.'
                % (rotulo, XT_TELA_ICONE_MAX)), None
    arquivo = texto('arquivo')
    erro = erro_do_arquivo_declarado(caminho_relativo, arquivo, rotulo)
    if erro:
        return erro, None
    return None, {'lugar': lugar, 'rotulo': rotulo_tela,
                  'icone': (icone or '').strip(), 'arquivo': arquivo}


def validar_encaixes(caminho_relativo, declarados):
    """Confere o que o manifesto declarou em `encaixes` contra o catálogo.

    Devolve `(erros, normalizados)`. Um erro aqui **não impede a extensão de
    ligar**: ela pode declarar cinco encaixes e errar um, e os outros quatro
    continuam funcionando. O que o erro faz é aparecer na lista de
    Configurações, em vermelho, para o autor saber por que aquele pedaço não
    fez efeito.

    ⚠️ **O silêncio é o inimigo aqui, como no manifesto.** Um `ponto` escrito
    com um caractere trocado, sem esta validação, seria uma extensão que liga,
    não dá erro nenhum e simplesmente não faz nada — o defeito mais caro de
    diagnosticar que existe nesta camada.
    """
    erros, normalizados = [], []

    for i, bruto in enumerate(declarados or []):
        rotulo = 'encaixes[%d]' % i

        if not isinstance(bruto, dict):
            erros.append('%s precisa ser um objeto `{"ponto": …, "arquivo": …}`, '
                         'e veio %s.' % (rotulo, type(bruto).__name__))
            continue

        ponto = str(bruto.get('ponto', '')).strip()
        arquivo = str(bruto.get('arquivo', '')).strip()

        if not ponto:
            erros.append('%s não disse em que `ponto` se encaixa.' % rotulo)
            continue
        if ponto not in XT_PONTOS_POR_NOME:
            erros.append('%s: ponto desconhecido "%s". Os que existem hoje são: %s.'
                         % (rotulo, ponto, ', '.join(sorted(XT_PONTOS_POR_NOME))))
            continue

        # Dentro da pasta da extensão, e existindo no disco — a regra e o
        # porquê moram em `constantes.erro_do_arquivo_declarado`, que os três
        # validadores dividem.
        erro_arquivo = erro_do_arquivo_declarado(caminho_relativo, arquivo, rotulo)
        if erro_arquivo:
            erros.append(erro_arquivo)
            continue

        # ⚠️ O MESMO PONTO DUAS VEZES SOBRESCREVERIA O PRIMEIRO EM SILÊNCIO.
        # O registro da tela é `{ponto: {slug: função}}` — uma entrada por
        # extensão por ponto. Quem declarasse dois arquivos para
        # `editor.menu` veria só o segundo funcionar, sem erro nenhum, e
        # procuraria o defeito dentro do arquivo que na verdade nunca rodou.
        if any(n['ponto'] == ponto for n in normalizados):
            erros.append('%s: o ponto "%s" já foi declarado acima. Um ponto por '
                         'extensão — junte os dois num arquivo só.' % (rotulo, ponto))
            continue

        normalizados.append({'ponto': ponto, 'arquivo': arquivo})

    return erros, normalizados


def _todas_as_folhas(no):
    """Cópia local da função de mesmo nome em `descoberta.py` — três linhas,
    e é o preço de não fechar o ciclo de import descrito abaixo."""
    folhas = list(no.get('extensoes', []))
    for pasta in no.get('pastas', []):
        folhas.extend(_todas_as_folhas(pasta))
    return folhas


class XtEncaixesMixin:
    def list_encaixes_programa(self):
        """O catálogo de pontos, e quem está encaixado em cada um.

        A tela usa isto para duas coisas: mostrar, na lista de Configurações,
        onde cada extensão se pluga; e mostrar os pontos vazios, que é o que
        responde "onde eu poderia encaixar uma extensão minha" sem obrigar a
        abrir a documentação.

        Só extensão **ligada** entra em `encaixados`: um encaixe declarado por
        extensão desligada não roda, e listá-lo como ativo seria mentir.

        ⚠️ A árvore vem de `self.list_extensoes_programa()`, e não de um
        `import` de `descoberta`, de propósito: `manifesto.py` importa este
        módulo para validar, e `descoberta.py` importa `manifesto.py`. Importar
        `descoberta` aqui fecharia o ciclo, e o programa não subiria. Chamar o
        método pelo `self` é o que os Mixins existem para permitir.
        """
        try:
            resposta = self.list_extensoes_programa()
            if not resposta.get('success'):
                return {'success': False, 'error': resposta.get('error', ''), 'pontos': []}
            folhas = [f for f in _todas_as_folhas(resposta['arvore']) if f['ligado']]
        except Exception as e:
            print('[extensoes] falha ao listar os encaixes:', e)
            return {'success': False, 'error': str(e), 'pontos': []}

        pontos = []
        for p in XT_PONTOS:
            encaixados = [
                {'caminho': f['caminho'], 'slug': f['slug'], 'nome': f['nome'],
                 'arquivo': e['arquivo']}
                for f in folhas for e in f['encaixes'] if e['ponto'] == p['ponto']
            ]
            pontos.append(dict(p, encaixados=encaixados))

        return {'success': True, 'pontos': pontos}
