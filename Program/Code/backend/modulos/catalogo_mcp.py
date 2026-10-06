"""O catálogo das ferramentas do servidor MCP — a fonte ÚNICA da lista.

A mesma lista era escrita à mão em QUATRO lugares: o `TOOLS` do servidor, o
`_MCP_FN_INFO` da aba Arquivos, o `_MCP_TOOLS` de `arquivos.py` (que monta o
`--enabled` do `.mcp.json`) e a tabela do README. As cópias divergiram — a tela
listava uma ferramenta com a descrição errada, e ninguém tinha como notar.

Agora existe só esta. Acrescentar uma ferramenta aqui a faz aparecer sozinha na
tabela da aba Arquivos → MCPs, na lista de ligar/desligar e no servidor, sem
editar mais nada. O que este módulo NÃO tem é o handler: a função que responde
mora em `Program/Code/server/assistente/ferramentas.py` ou
`Program/Code/server/trabalhos/ferramentas.py`, conforme o campo `servidor`
abaixo, que casa uma coisa na outra pelo `fn_name`.

⚠️ Este módulo mora no `backend/` de propósito, e não em `server/`. O servidor
já importa o backend (`servidor.py::_bootstrap_api`); o backend não teria como
importar o `server/` sem mexer no `sys.path`. A dependência anda num sentido só.

⚠️ Nada aqui pode importar módulo do programa: o servidor MCP carrega este
arquivo antes de a `Api` existir.

Os campos de cada entrada:

    name          o id, gravado no `.mcp.json` e no `Workspace.json` — não muda
    servidor      'assistente' ou 'trabalhos' — qual dos dois servidores expõe
                  esta ferramenta (ver `Program/Code/server/`)
    fn_name       o nome do handler em `ferramentas.py` do servidor correspondente
    description   o que o assistente externo lê para decidir se chama
    schema        o JSON Schema dos parâmetros
    layer         a família, para a cor da bolinha da tabela (ver `FAMILIAS_DAS_FERRAMENTAS_MCP`)
    retorna       o que ela devolve — coluna da tabela da tela
    usar          quando o assistente deve chamar — coluna da tabela
    base          de onde o dado sai — coluna da tabela
    nao           quando NÃO usar, com a alternativa — coluna da tabela
    fonte         'artefato' ou 'vivo' — ver abaixo

⚠️ `fonte` é o campo que decide o CARIMBO DE FRESCOR, e é a TERCEIRA coisa
chamada "fonte" no projeto (ver `Vocabulário.md`). Aqui ela responde a uma
pergunta só: **o dado que a ferramenta devolve pode estar velho?**

    'artefato'  lê um arquivo que uma rotina gerou antes → pode estar velho,
                então a resposta carrega o carimbo quando não estiver em dia
    'vivo'      varre o disco na hora → nunca está velho, NUNCA carimba

⚠️ A classificação não é intuição, foi conferida ferramenta por ferramenta.
`onde_esta` é 'artefato' embora pareça viva: `get_symbol_index` só ABRE o
`indice_de_simbolos.json`, não varre nada. `io` e `arquivos_grandes` são 'vivo'
embora pareçam artefato: `scan_file_io` e `get_arquivos_grandes` varrem o disco
a cada chamada.
"""

# As famílias, na ordem em que aparecem na legenda da tela.
FAMILIAS_DAS_FERRAMENTAS_MCP = {
    'det': 'Determinística',
    'hib': 'Documentação',
    'ctx': 'Contexto',
    'ana': 'Análise',
    'nat': 'Nativa com escopo',
}

# ⚠️ A ordem desta lista É a ordem da tabela na tela e da lista de toggles.
# Está agrupada por família, não alfabética.
CATALOGO_MCP = [
    # ── Determinísticas: saem de índice, sem LLM no meio ─────────────────────
    {'name': 'onde_esta', 'servidor': 'assistente', 'fn_name': 'tool_onde_esta', 'layer': 'det', 'fonte': 'artefato',
     'description': 'Onde um símbolo (função/classe/método/seletor) é definido: arquivo + linha.',
     'schema': {'type': 'object', 'properties': {
         'nome': {'type': 'string', 'description': 'nome do símbolo'}}, 'required': ['nome']},
     'retorna': 'Arquivo + linha da definição do símbolo.',
     'usar': 'Sabe o nome e quer o local.',
     'base': 'Índice de símbolos.',
     'nao': 'Não sabe o nome → busca_semantica.'},

    {'name': 'eu_uso', 'servidor': 'assistente', 'fn_name': 'tool_eu_uso', 'layer': 'det', 'fonte': 'artefato',
     'description': 'Quem este arquivo usa (dependências diretas, inclusive pontes que não são import).',
     'schema': {'type': 'object', 'properties': {'arquivo': {'type': 'string'}}, 'required': ['arquivo']},
     'retorna': 'Quem este arquivo usa (deps diretas, inclusive pontes não-import).',
     'usar': 'Entender do que ele depende.',
     'base': 'Índice de identificadores.',
     'nao': 'Quer a cascata → relacoes_uso.'},

    {'name': 'me_usam', 'servidor': 'assistente', 'fn_name': 'tool_me_usam', 'layer': 'det', 'fonte': 'artefato',
     'description': 'Quem usa este arquivo (quem quebra se você mudar a interface dele).',
     'schema': {'type': 'object', 'properties': {'arquivo': {'type': 'string'}}, 'required': ['arquivo']},
     'retorna': 'Quem usa este arquivo.',
     'usar': 'Antes de mudar a interface dele.',
     'base': 'Índice de identificadores.',
     'nao': 'Só localizar → onde_esta.'},

    {'name': 'relacoes_uso', 'servidor': 'assistente', 'fn_name': 'tool_relacoes_uso', 'layer': 'det', 'fonte': 'artefato',
     'description': 'Cascata de impacto transitiva: só o que quebra ao mudar este arquivo. '
                    'O nível da cascata é configurável em Configurações → Servidor MCP.',
     'schema': {'type': 'object', 'properties': {'arquivo': {'type': 'string'}}, 'required': ['arquivo']},
     'retorna': 'Cascata de impacto: só o que quebra.',
     'usar': 'Antes de deletar/mudar assinatura.',
     'base': 'Índice de identificadores.',
     'nao': 'Só vizinho direto → me_usam.'},

    {'name': 'indice_navegacao', 'servidor': 'assistente', 'fn_name': 'tool_indice_navegacao', 'layer': 'det', 'fonte': 'artefato',
     'description': 'Mapa do projeto: a árvore de pastas e arquivos, com UMA LINHA POR ARQUIVO '
                    '(o nome e uma frase sobre ele), em partes — uma parte por pasta. Por onde '
                    'começar: chame SEM o parâmetro "parte" — a resposta é só a lista das '
                    'pastas do projeto, cada uma com o tamanho em tokens (poucas centenas de '
                    'tokens no total); depois peça em "parte" a pasta que interessa. Se o '
                    'índice inteiro couber no teto, ele vem inteiro já na primeira chamada.',
     'schema': {'type': 'object', 'properties': {
         'parte': {'type': 'string', 'description': 'a pasta a abrir; sem ela vem a lista das pastas'}}},
     'retorna': 'Sem parte: a lista das pastas. Com parte: uma linha por arquivo da pasta.',
     'usar': 'No começo da tarefa: primeiro a lista das pastas, depois a pasta.',
     'base': 'Rotina Índice de Navegação.',
     'nao': 'Já sabe o arquivo → doc_tecnica.'},

    {'name': 'grafo_imports', 'servidor': 'assistente', 'fn_name': 'tool_grafo_imports', 'layer': 'det', 'fonte': 'artefato',
     'description': 'Quem importa quem, em partes por pasta. Sem o parâmetro "parte" devolve o '
                    'índice das partes disponíveis, para você escolher uma.',
     'schema': {'type': 'object', 'properties': {
         'parte': {'type': 'string', 'description': 'a parte a abrir; sem ela vem o índice das partes'}}},
     'retorna': 'Quem importa quem, uma parte por pasta.',
     'usar': 'Entender o desenho de dependências.',
     'base': 'Rotina Grafo de Imports.',
     'nao': 'Um arquivo só → eu_uso / me_usam.'},

    {'name': 'comentarios', 'servidor': 'assistente', 'fn_name': 'tool_comentarios', 'layer': 'det', 'fonte': 'artefato',
     'description': 'Os comentários e docstrings que O AUTOR escreveu dentro de um arquivo, '
                    'extraídos por gramática (tree-sitter). É a prosa humana do código — nunca '
                    'texto gerado por IA. Para a descrição que o modelo escreveu sobre o código, '
                    'a ferramenta é doc_tecnica.',
     'schema': {'type': 'object', 'properties': {
         'arquivo': {'type': 'string'}}, 'required': ['arquivo']},
     'retorna': 'Comentários e docstrings do arquivo, na ordem.',
     'usar': 'Saber o que o autor explicou ali.',
     'base': 'Rotina Comentários.',
     'nao': 'Quer a frase da IA → doc_tecnica.'},

    {'name': 'bibliotecas', 'servidor': 'assistente', 'fn_name': 'tool_bibliotecas', 'layer': 'det', 'fonte': 'artefato',
     'description': 'As bibliotecas que o projeto usa. Sem parâmetro, lista as de terceiros; '
                    'com "nome", abre a ficha daquela.',
     'schema': {'type': 'object', 'properties': {
         'nome': {'type': 'string', 'description': 'a biblioteca a abrir; sem ela vem a lista'}}},
     'retorna': 'Lista das bibliotecas, ou a ficha de uma.',
     'usar': 'Saber o que já está disponível.',
     'base': 'Rotina Bibliotecas.',
     'nao': 'Quer o import de um arquivo → eu_uso.'},

    # ── Documentação: o artefato passou por um modelo ─────────────────────────
    {'name': 'doc_tecnica', 'servidor': 'assistente', 'fn_name': 'tool_doc_tecnica', 'layer': 'hib', 'fonte': 'artefato',
     'description': 'Documentação técnica de arquivos, lida POR SEÇÃO, de vários arquivos numa '
                    'chamada. O parâmetro "ler" liga cada arquivo — ou pasta, que vale por todos '
                    'os arquivos dela — às seções que você quer, separadas por vírgula: sintese '
                    '(o que o arquivo é e por quê — a mais curta), atribuicoes, metadados, termos '
                    '(os termos do projeto que aparecem nele), simbolos (cada símbolo com '
                    'assinatura, linha e frase), conexoes (quem ele usa e quem o usa); "tudo" = '
                    'o arquivo inteiro. A seção é obrigatória. Por onde começar: a "sintese" dos '
                    'arquivos que interessam (ou da pasta inteira); "simbolos" e "tudo" só dos '
                    'poucos que você vai editar. Exemplo com 15 arquivos — 10 só com a síntese, 1 '
                    'inteiro e 4 com síntese e conexões: {"ler": {"a1.py": "sintese", "a2.py": '
                    '"sintese", "a3.py": "sintese", "a4.py": "sintese", "a5.py": "sintese", '
                    '"a6.py": "sintese", "a7.py": "sintese", "a8.py": "sintese", "a9.py": '
                    '"sintese", "a10.py": "sintese", "b.py": "tudo", "c1.js": "sintese,conexoes", '
                    '"c2.js": "sintese,conexoes", "c3.js": "sintese,conexoes", "c4.js": '
                    '"sintese,conexoes"}}. Seção que um arquivo não tem vem marcada como '
                    'inexistente. Se a resposta passar do teto, vem o que coube, na ordem '
                    'pedida, e no fim o "ler" exato do resto — copie como está.',
     'schema': {'type': 'object', 'properties': {
         'ler': {'type': 'object', 'additionalProperties': {'type': 'string'},
                 'description': 'caminho do arquivo ou da pasta (ex.: Program/Code/backend/modulos/chat.py) '
                                '→ as seções, separadas por vírgula: sintese, atribuicoes, '
                                'metadados, termos, simbolos, conexoes, ou tudo'}},
         'required': ['ler']},
     'retorna': 'As seções pedidas de cada arquivo, na ordem pedida; o que passar do teto volta como o "ler" do resto.',
     'usar': 'Antes de editar: a síntese primeiro, os símbolos só do que vai mexer.',
     'base': 'Rotina Documentação Técnica.',
     'nao': 'Quer o código literal → ler_arquivo.'},

    {'name': 'resumo_pastas', 'servidor': 'assistente', 'fn_name': 'tool_resumo_pastas', 'layer': 'hib', 'fonte': 'artefato',
     'description': 'O que cada pasta faz, lido POR SEÇÃO, de várias pastas numa chamada. O '
                    'parâmetro "ler" liga cada pasta às seções que você quer, separadas por '
                    'vírgula: papel (o papel da pasta, numa frase — a mais curta), arquivos (uma '
                    'linha por arquivo, com a responsabilidade dele), simbolos (os principais '
                    'que ela exporta), internas (como os arquivos dela se ligam), externas (como '
                    'ela se liga ao resto); "tudo" = o resumo inteiro. A seção é obrigatória. Por '
                    'onde começar: {"ler": {".": "papel"}} traz o papel de TODAS as pastas numa '
                    'chamada — daí desça com "arquivos" ou "tudo" só nas pastas que importam. Uma '
                    'pasta é o resumo DELA (as de dentro têm o seu); "." é o projeto inteiro. '
                    'Pasta que não tem uma seção vem com ela marcada como inexistente. Se a '
                    'resposta passar do teto, vem o que coube e no fim o "ler" exato do resto — '
                    'copie como está.',
     'schema': {'type': 'object', 'properties': {
         'ler': {'type': 'object', 'additionalProperties': {'type': 'string'},
                 'description': 'caminho da pasta, ou "." para todas (ex.: Program/Code/backend/modulos) '
                                '→ as seções, separadas por vírgula: papel, arquivos, simbolos, '
                                'internas, externas, ou tudo'}},
         'required': ['ler']},
     'retorna': 'As seções pedidas de cada pasta; o que passar do teto volta como o "ler" do resto.',
     'usar': 'Descobrir onde uma coisa moraria: o papel de todas primeiro.',
     'base': 'Rotina Resumo de Pastas.',
     'nao': 'Quer o conteúdo → listar_pasta.'},

    {'name': 'pipeline', 'servidor': 'assistente', 'fn_name': 'tool_pipeline', 'layer': 'hib', 'fonte': 'artefato',
     'description': 'A ordem em que o projeto roda, em quatro níveis: Visão geral → área → bloco → '
                    'cadeia. Leia de cima para baixo: sem "parte" vem a Visão geral (as áreas, cada '
                    'uma com a sua frase, e os blocos de cada área); peça uma área ("A1") ou vá '
                    'direto a um bloco ("B3"), e então a cadeia ("C12"), que traz os passos '
                    'origem → destino via função. Cada nível cita os ids do nível de baixo. Já sabe '
                    'o arquivo? Use "filtro" com o caminho dele e receba as cadeias que passam por ali.',
     'schema': {'type': 'object', 'properties': {
         'parte': {'type': 'string', 'description': 'o id de um nível: "A1" (área), "B1" (bloco; '
                                                    '"B0" = sem ponto de entrada) ou "C1" (cadeia). '
                                                    'Sem ele vem a Visão geral. Nível grande vem em '
                                                    'páginas: "C1:2" é a página 2'},
         'filtro': {'type': 'string', 'description': 'opcional — um caminho de arquivo, inteiro ou '
                                                     'um pedaço (ex.: "chat.py"): devolve as cadeias '
                                                     'que passam por ele, com o bloco e a área. Com '
                                                     '"parte", procura só dentro daquele nível'}}},
     'retorna': 'A Visão geral, uma área, um bloco ou uma cadeia (os passos na ordem) — ou as cadeias que passam por um arquivo.',
     'usar': 'Entender o fluxo de ponta a ponta: Visão geral → área → bloco → cadeia.',
     'base': 'Rotina Pipeline.',
     'nao': 'Quer só quem chama quem → grafo_imports.'},

    {'name': 'busca_semantica', 'servidor': 'assistente', 'fn_name': 'tool_busca_semantica', 'layer': 'hib', 'fonte': 'artefato',
     'description': 'Acha candidatos por descrição (quando não se sabe o nome). É um achador, não '
                    'a resposta final. O parâmetro "tipo" escolhe onde procurar.',
     'schema': {'type': 'object', 'properties': {
         'descricao': {'type': 'string'},
         'tipo': {'type': 'string', 'description': 'onde procurar: documentacao-tecnica (padrão, por arquivo) '
                                                   'ou resumo-pastas (por pasta)'}},
         'required': ['descricao']},
     'retorna': 'Candidatos por descrição (achador, não resposta final).',
     'usar': 'Não sabe o nome, só descreve.',
     'base': 'Embedding da documentação.',
     'nao': 'Sabe o nome → onde_esta.'},

    # ── Contexto: o que o projeto decidiu, em palavras ────────────────────────
    {'name': 'glossario', 'servidor': 'assistente', 'fn_name': 'tool_glossario', 'layer': 'ctx', 'fonte': 'artefato',
     'description': 'Os termos próprios deste projeto e o que cada um quer dizer aqui. Por onde '
                    'começar: sem parâmetro vem a lista dos tópicos, com quantos termos cada um '
                    'tem; depois peça um "topico" inteiro, ou vá direto a um "termo" — maiúscula '
                    'e acento não importam.',
     'schema': {'type': 'object', 'properties': {'termo': {'type': 'string', 'description': 'o termo a definir'}, 'topico': {'type': 'string', 'enum': ['Tela', 'Processo', 'Peça do código', 'Dado', 'Estado', 'Configuração', 'Integração', 'Conceito'], 'description': 'um tópico inteiro'}}},
     'retorna': 'A linha do termo, os termos de um tópico, ou o índice dos tópicos.',
     'usar': 'Termo do domínio que não entende.',
     'base': 'Rotina Glossário.',
     'nao': 'Nome de símbolo → onde_esta.'},

    # ── Análise: o que está torto no código ───────────────────────────────────
    {'name': 'duplicados', 'servidor': 'assistente', 'fn_name': 'tool_duplicados', 'layer': 'ana', 'fonte': 'artefato',
     'description': 'Pares de funções duplicadas ou quase iguais — inclusive código copiado e '
                    'depois editado. Comparação determinística, sem IA.',
     'schema': {'type': 'object', 'properties': {
         'limiar': {'type': 'number', 'description': 'similaridade mínima, de 0 a 1 (padrão 0.85)'}}},
     'retorna': 'Pares de funções parecidas, com o score.',
     'usar': 'Antes de escrever algo que já pode existir.',
     'base': 'Rotina Duplicados.',
     'nao': 'Quer achar por nome → onde_esta.'},

    {'name': 'arquivos_grandes', 'servidor': 'assistente', 'fn_name': 'tool_arquivos_grandes', 'layer': 'ana', 'fonte': 'vivo',
     'description': 'Os arquivos que NÃO CABEM numa chamada de agente do programa — passam '
                    'do teto em token calculado contra a janela de contexto. Varre o disco na '
                    'hora, então o dado nunca está velho.',
     'schema': {'type': 'object', 'properties': {}},
     'retorna': 'Os arquivos acima do teto, com linhas e tokens.',
     'usar': 'Achar o que precisa ser dividido.',
     'base': 'Varredura do disco, na hora.',
     'nao': 'Quer complexidade → aba Mapas do app.'},

    {'name': 'io', 'servidor': 'assistente', 'fn_name': 'tool_io', 'layer': 'ana', 'fonte': 'vivo',
     'description': 'O que um arquivo lê e escreve em disco (arquivos e pastas), por linha.',
     'schema': {'type': 'object', 'properties': {'arquivo': {'type': 'string'}}, 'required': ['arquivo']},
     # ⚠️ O `usar` dizia "quem lê/escreve tal arquivo ou pasta", e prometia uma
     # busca POR ALVO que esta ferramenta não faz — nem pode fazer. O caminho de
     # destino não existe no código: é montado em execução. O que sai é a
     # expressão do argumento (`os.path.join(base, 'x.json')`), não o caminho.
     'retorna': 'As operações de disco de um arquivo, com a linha, o tipo e a expressão do alvo.',
     'usar': 'O que um arquivo faz em disco: se lê, escreve, cria ou deleta.',
     'base': 'Varredura do código, na hora.',
     'nao': 'Quer relação de código → eu_uso.'},

    # ── Nativas com escopo: o que o Read/Grep/Glob faria, mas filtrado ────────
    # ⚠️ A descrição de cada uma PRECISA dizer que a nativa do assistente é mais
    # rápida. Sem isso ele escolhe a lenta só por ela estar listada aqui.
    {'name': 'grep', 'servidor': 'assistente', 'fn_name': 'tool_grep', 'layer': 'nat', 'fonte': 'vivo',
     'description': 'Busca um termo no código. A SUA ferramenta Grep é mais rápida — use esta só '
                    'quando quiser respeitar o recorte do projeto: ela busca apenas nas pastas de '
                    'trabalho marcadas pelo usuário e pula o que ele removeu ou marcou como fora '
                    'do seu alcance. Os dois interruptores existem porque o código deste projeto '
                    'é escrito em português, e "todo/toda/todos/todas" colide com o marcador '
                    'TODO: medido sobre Program/Code (.py e .js), 409 linhas casam com "todo" e '
                    'há 0 marcadores reais. A limitação que fica: a busca NÃO dobra acento — '
                    '"funcao" não acha "função"; quem precisar das duas grafias busca as duas.',
     'schema': {'type': 'object', 'properties': {
         'termo': {'type': 'string'},
         'pasta': {'type': 'string', 'description': 'opcional — restringe a busca a esta pasta'},
         'palavra_inteira': {'type': 'boolean',
                             'description': 'opcional, padrão falso. Casa só a palavra sozinha: '
                                            '"todo" deixa de achar "todos" e "metodo"'},
         'diferenciar_maiusculas': {'type': 'boolean',
                                    'description': 'opcional, padrão falso. Respeita '
                                                   'maiúscula/minúscula: "TODO" deixa de achar '
                                                   '"todo"'}},
         'required': ['termo']},
     'retorna': 'Ocorrências do termo, já dentro do escopo.',
     'usar': 'Buscar respeitando o recorte do projeto.',
     'base': 'Varredura do disco, na hora.',
     'nao': 'Quer velocidade → o Grep do seu assistente.'},

    {'name': 'ler_arquivo', 'servidor': 'assistente', 'fn_name': 'tool_ler_arquivo', 'layer': 'nat', 'fonte': 'vivo',
     'description': 'Lê um arquivo, numerado por linha. A SUA ferramenta Read é mais rápida — use '
                    'esta só quando quiser respeitar o recorte do projeto: ela recusa o que o '
                    'usuário removeu ou marcou como fora do seu alcance.',
     'schema': {'type': 'object', 'properties': {
         'caminho': {'type': 'string'},
         'linhas': {'type': 'string', 'description': 'opcional — faixa de linhas, ex.: "40-120"'}},
         'required': ['caminho']},
     'retorna': 'O arquivo, numerado por linha.',
     'usar': 'Ler respeitando o recorte do projeto.',
     'base': 'Leitura do disco, na hora.',
     'nao': 'Quer velocidade → o Read do seu assistente.'},

    {'name': 'listar_pasta', 'servidor': 'assistente', 'fn_name': 'tool_listar_pasta', 'layer': 'nat', 'fonte': 'vivo',
     'description': 'Lista o que existe numa pasta, sem recursão. A SUA ferramenta Glob é mais '
                    'rápida — use esta só quando quiser respeitar o recorte do projeto: ela omite '
                    'o que o usuário removeu ou marcou como fora do seu alcance.',
     'schema': {'type': 'object', 'properties': {
         'caminho': {'type': 'string'}}, 'required': ['caminho']},
     'retorna': 'Os nomes do que existe na pasta.',
     'usar': 'Listar respeitando o recorte do projeto.',
     'base': 'Leitura do disco, na hora.',
     'nao': 'Quer velocidade → o Glob do seu assistente.'},

    # ── Trabalhos: as OITO ações do Quadro ───────────────────────────────────
    #
    # ⚠️ AS PRIMEIRAS FERRAMENTAS DE ESCRITA DESTE CATÁLOGO. Todas as outras só
    # leem um artefato ou varrem o disco; estas mexem no `Estado.json` da aba
    # Trabalhos, a partir de um processo do sistema operacional que não é o do
    # app. Duas consequências valem para as oito:
    #
    #   o handler grava sob LOCK ENTRE PROCESSOS (`trabalhos_estado.py`) — um
    #     `threading.Lock` não enxergaria o app nem os outros terminais;
    #   nenhuma delas aceita CAMINHO vindo do `args`. Tudo que escrevem fica
    #     dentro de `Trabalhos/`, derivado do nome de projeto com que o servidor
    #     subiu. Escrever código-fonte do usuário não é possível por aqui, e
    #     isso é invariante do programa, não configuração.
    #
    # ⚠️ Só o ORQUESTRADOR as recebe. Um Subagente não tem nenhuma delas: ele
    # não escreve no Quadro, quem escreve por ele é quem o coordena.
    #
    # `fonte: 'vivo'` nas oito — leem e gravam o `Estado.json` na hora, então
    # nunca há artefato velho a carimbar.
    {'name': 'quadro', 'servidor': 'trabalhos', 'fn_name': 'tool_trabalhos_quadro', 'layer': 'ana', 'fonte': 'vivo',
     'description': 'O Quadro de atividades inteiro: cada atividade, em que coluna está, '
                    'de quem depende e quais tarefas já tem. Chame ANTES de mexer em '
                    'qualquer coisa — as outras sete ferramentas pedem o id da atividade.',
     'schema': {'type': 'object', 'properties': {
         'coluna': {'type': 'string',
                    'description': 'opcional: só as de uma coluna (na-fila, fazendo, '
                                   'precisa-de-voce, revisar, falhou, desistido)'}}},
     'retorna': 'A lista das atividades, agrupada por coluna.',
     'usar': 'Antes de qualquer outra ação do Quadro — é onde os ids aparecem.',
     'base': 'O `Estado.json` da aba Trabalhos, lido na hora.',
     'nao': 'Não serve para ler código → as ferramentas de leitura.'},

    {'name': 'criar', 'servidor': 'trabalhos', 'fn_name': 'tool_trabalhos_criar', 'layer': 'ana', 'fonte': 'vivo',
     'description': 'Cria uma atividade nova no Quadro. Nasce sempre em "Na fila" e marcada '
                    'como escrita por você — não há como criar direto em outra coluna.',
     'schema': {'type': 'object', 'properties': {
         'titulo': {'type': 'string', 'description': 'o nome da atividade, uma linha'},
         'pasta': {'type': 'string', 'description': 'opcional: a pasta a que ela pertence'},
         'resumo': {'type': 'string', 'description': 'opcional: uma ou duas frases'},
         'briefing': {'type': 'string', 'description': 'opcional: o detalhamento completo'}},
         'required': ['titulo']},
     'retorna': 'O id da atividade criada.',
     'usar': 'Achou trabalho que não estava no Quadro e precisa ficar registrado.',
     'base': 'Escreve no `Estado.json` da aba Trabalhos.',
     'nao': 'Anotar um passo de atividade que já existe → tarefas.'},

    {'name': 'mover', 'servidor': 'trabalhos', 'fn_name': 'tool_trabalhos_mover', 'layer': 'ana', 'fonte': 'vivo',
     'description': 'Move uma atividade de coluna: na-fila, fazendo, revisar, falhou ou '
                    'desistido. Para "precisa-de-voce" use chamar, que exige o motivo.',
     'schema': {'type': 'object', 'properties': {
         'atividade': {'type': 'string', 'description': 'o id, ex. A-101'},
         'coluna': {'type': 'string',
                    'description': 'na-fila, fazendo, revisar, falhou ou desistido'}},
         'required': ['atividade', 'coluna']},
     'retorna': 'A atividade e a coluna em que ela ficou.',
     'usar': 'Começou a trabalhar nela, terminou, ou desistiu.',
     'base': 'Escreve no `Estado.json` da aba Trabalhos.',
     'nao': 'Vai parar para perguntar algo ao usuário → chamar.'},

    {'name': 'tarefas', 'servidor': 'trabalhos', 'fn_name': 'tool_trabalhos_tarefas', 'layer': 'ana', 'fonte': 'vivo',
     'description': 'Escreve a lista de passos de uma atividade — as tarefas do cartão. '
                    'Substitui a lista inteira: mande todos os passos, não só o novo.',
     'schema': {'type': 'object', 'properties': {
         'atividade': {'type': 'string', 'description': 'o id, ex. A-101'},
         'tarefas': {'type': 'array', 'items': {'type': 'string'},
                     'description': 'os passos, na ordem de execução'}},
         'required': ['atividade', 'tarefas']},
     'retorna': 'A lista de tarefas como ficou.',
     'usar': 'Ao pegar uma atividade, para dividi-la em passos visíveis ao usuário.',
     'base': 'Escreve no `Estado.json` da aba Trabalhos.',
     'nao': 'Marcar um passo como feito → marcar.'},

    {'name': 'marcar', 'servidor': 'trabalhos', 'fn_name': 'tool_trabalhos_marcar', 'layer': 'ana', 'fonte': 'vivo',
     'description': 'Marca uma tarefa do cartão como pendente, fazendo ou feita. '
                    'O número é a posição na lista, começando em 0.',
     'schema': {'type': 'object', 'properties': {
         'atividade': {'type': 'string', 'description': 'o id, ex. A-101'},
         'tarefa': {'type': 'integer', 'description': 'a posição na lista, começando em 0'},
         'estado': {'type': 'string', 'description': 'pendente, fazendo ou feita'}},
         'required': ['atividade', 'tarefa', 'estado']},
     'retorna': 'A lista de tarefas como ficou.',
     'usar': 'A cada passo que você começa e termina — é o que o usuário vê andando.',
     'base': 'Escreve no `Estado.json` da aba Trabalhos.',
     'nao': 'Criar ou reescrever a lista inteira → tarefas.'},

    {'name': 'anotar', 'servidor': 'trabalhos', 'fn_name': 'tool_trabalhos_anotar', 'layer': 'ana', 'fonte': 'vivo',
     'description': 'Atualiza o resumo curto de uma atividade, os arquivos que ela tocou, '
                    'ou de quais outras atividades ela depende. Mande só o que mudou.',
     'schema': {'type': 'object', 'properties': {
         'atividade': {'type': 'string', 'description': 'o id, ex. A-101'},
         'resumo': {'type': 'string', 'description': 'opcional: uma ou duas frases'},
         'arquivos': {'type': 'array', 'items': {'type': 'string'},
                      'description': 'opcional: os caminhos tocados'},
         'depende_de': {'type': 'array', 'items': {'type': 'string'},
                        'description': 'opcional: ids de outras atividades'}},
         'required': ['atividade']},
     'retorna': 'A atividade como ficou.',
     'usar': 'Terminou um pedaço e quer deixar registrado o que mexeu.',
     'base': 'Escreve no `Estado.json` da aba Trabalhos.',
     'nao': 'Não invente id em `depende_de`: id fora do Quadro é recusado.'},

    {'name': 'tag', 'servidor': 'trabalhos', 'fn_name': 'tool_trabalhos_tag', 'layer': 'ana', 'fonte': 'vivo',
     'description': 'Marca ou desmarca uma tag de uma atividade. O vocabulário é FECHADO: '
                    'obra, pesquisar, teste, conferencia. Tag fora dessa lista é recusada.',
     'schema': {'type': 'object', 'properties': {
         'atividade': {'type': 'string', 'description': 'o id, ex. A-101'},
         'tag': {'type': 'string', 'description': 'obra, pesquisar, teste ou conferencia'},
         'ligar': {'type': 'boolean', 'description': 'true marca, false desmarca; padrão true'}},
         'required': ['atividade', 'tag']},
     'retorna': 'As tags da atividade como ficaram.',
     'usar': 'Classificar a natureza do trabalho para o usuário filtrar no Quadro.',
     'base': 'Escreve no `Estado.json` da aba Trabalhos.',
     'nao': 'Não tente criar tag nova: as automáticas o programa marca sozinho.'},

    {'name': 'chamar', 'servidor': 'trabalhos', 'fn_name': 'tool_trabalhos_chamar', 'layer': 'ana', 'fonte': 'vivo',
     'description': 'Para o trabalho e chama o usuário: move a atividade para '
                    '"Precisa de você" com o motivo escrito. É a saída certa para tudo que '
                    'estava fora do combinado — nunca decida sozinho o que não foi acordado.',
     'schema': {'type': 'object', 'properties': {
         'atividade': {'type': 'string', 'description': 'o id, ex. A-101'},
         'gatilho': {'type': 'string',
                     'description': 'comando-bloqueado, contraria-decisao, mexe-em-arquivo, '
                                    'muda-assinatura, reprovou-n-vezes, vaga-demais, passou-de-2h'},
         'motivo': {'type': 'string', 'description': 'o que houve, em uma ou duas frases'}},
         'required': ['atividade', 'gatilho', 'motivo']},
     'retorna': 'A confirmação de que a atividade parou esperando o usuário.',
     'usar': 'Bateu num bloqueio, numa decisão já registrada, ou a atividade estava vaga.',
     'base': 'Escreve no `Estado.json` da aba Trabalhos.',
     'nao': 'Terminou e quer entregar → mover para revisar.'},
]


# Os ids canônicos, na mesma ordem. Quem precisa só da lista de nomes — o
# `--enabled` do `.mcp.json`, os toggles por projeto — itera por aqui.
IDS_DAS_FERRAMENTAS_MCP = tuple(f['name'] for f in CATALOGO_MCP)

# Os que carimbam frescor. Derivado, nunca escrito à mão: uma ferramenta nova
# entra ou não entra pelo `fonte` que ela declara, e não por alguém lembrar.
IDS_QUE_CARIMBAM = tuple(f['name'] for f in CATALOGO_MCP if f['fonte'] == 'artefato')


def catalogo_para_tela():
    """O catálogo sem o `schema` nem o `fn_name` — o que a aba Arquivos precisa.

    O `schema` é JSON Schema e não tem nada que dizer ao usuário; o `fn_name` é
    detalhe de ligação interna. Mandar os dois para a tela só engordaria a
    resposta que atravessa a ponte do pywebview.
    """
    return [{chave: valor for chave, valor in ferramenta.items()
             if chave not in ('schema', 'fn_name')}
            for ferramenta in CATALOGO_MCP]
