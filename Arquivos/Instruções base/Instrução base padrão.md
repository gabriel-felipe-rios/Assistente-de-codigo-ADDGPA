# Instruções base do projeto

Este arquivo diz duas coisas: **como entender este projeto sem reler tudo**, e
**onde está o que já foi decidido aqui** — para não se rediscutir o que já está
resolvido. Ele não guarda decisão nenhuma: as decisões moram nas bases de
`Saída das skills/`, e este arquivo só diz quando abrir cada uma.

## As ferramentas dos dois servidores MCP

Este projeto tem **dois** servidores MCP ativos, e eles não se confundem: o
`assistente` responde sobre o **código**, o `trabalhos` mexe no **Quadro**.

### `assistente` — as 19 de leitura do projeto

Ele não é um índice de arquivos: são 19 ferramentas que respondem por
localização, impacto de mudança, documentação, qualidade e leitura com o recorte
do projeto.

**Pergunte a elas antes de sair varrendo o projeto por conta própria.** Não é
questão de gosto: as respostas já estão calculadas, e várias enxergam ligação
que `grep` e `import` não pegam — função global chamada de outro arquivo, ponte
entre o back e o front, ID declarado no HTML e lido no JS. Reconstruir isso na
mão custa muitas leituras e ainda erra justamente onde essas ferramentas
acertam.

A lista abaixo é o que cada servidor expõe quando está inteiro. Ferramenta pode
estar desligada neste projeto — quem manda é o que o servidor listar, não esta
página.

**Começando a tarefa — o terreno**
- `indice_navegacao` — árvore do projeto, uma frase por arquivo, em partes por pasta.
  Comece chamando **sem** `parte`: vem só a lista das pastas, com o tamanho de
  cada uma; depois abra a pasta que interessa
- `resumo_pastas` — o que cada pasta faz, lido **por seção** no parâmetro `ler`
  (`papel`, `arquivos`, `simbolos`, `internas`, `externas` ou `tudo`). Comece por
  `{".": "papel"}` — o papel de todas as pastas — e desça só nas que importam; use
  para descobrir onde uma coisa moraria
- `pipeline` — a ordem em que as coisas rodam, em níveis: sem `parte` a Visão geral (as áreas e os blocos de cada uma); depois a área (`"A1"`), o bloco (`"B1"`) e a cadeia (`"C1"`); com `filtro` = um arquivo, as cadeias que passam por ele

**Achar**
- `onde_esta` — sabe o nome do símbolo e quer arquivo + linha
- `busca_semantica` — não sabe o nome, só sabe descrever. É um achador, não a
  resposta final: confirme o candidato antes de agir
- `glossario` — o que um termo próprio deste projeto quer dizer; sem parâmetro vem a lista dos tópicos, depois um `topico` ou direto o `termo` (maiúscula e acento não importam)

**Antes de editar um arquivo**
- `doc_tecnica` — a documentação dele, lida **por seção** no parâmetro `ler`, de
  vários arquivos numa chamada: `{"a.py": "sintese", "b.js": "simbolos,conexoes",
  "c.py": "tudo"}` (seções: `sintese`, `atribuicoes`, `metadados`, `termos`,
  `simbolos`, `conexoes`). Comece pela `sintese`; `simbolos` traz assinatura, linha
  e descrição — frase gerada sobre o símbolo, não texto tirado do arquivo
- `comentarios` — a prosa que está escrita NO arquivo: comentários e docstrings,
  extraídos por gramática, na ordem do arquivo e com a linha. É onde costuma
  morar o porquê que o código não mostra — o "isto é de propósito", o "não
  conserte isto", a justificativa de uma decisão — por uma fração do que custa
  ler o arquivo inteiro
- `io` — o que ele lê e escreve em disco, linha a linha

⚠️ Duas ressalvas do `comentarios`: ela dá a **linha**, não o símbolo — para
saber de que função é aquele comentário, é `doc_tecnica` ou `ler_arquivo`. E
arquivo sem prosa nenhuma não gera saída, então "sem comentários para X" pode
significar tanto "não tem comentário" quanto "não foi indexado".

**Antes de mudar assinatura, mover ou deletar**
- `me_usam` — quem quebra se você mudar a interface dele
- `relacoes_uso` — a cascata de impacto transitiva: só o que quebra de fato
- `eu_uso` — do que ele depende
- `grafo_imports` — o desenho de dependências, por pasta

⚠️ Os três primeiros e o `grafo_imports` leem bases **diferentes**, e não se
substituem. `me_usam`/`eu_uso`/`relacoes_uso` casam **menção de identificador**:
função global chamada de outro arquivo, ponte entre o back e o front, ID
declarado no HTML e lido no JS. É onde mora o perigo real — renomear qualquer um
desses não gera erro nenhum, e a tela só fica vazia. O `grafo_imports` lê
`import`, e só isso.

**Antes de escrever algo novo**
- `duplicados` — pares de funções iguais ou quase, inclusive copiadas-e-editadas.
  Rode antes de criar uma função que já pode existir
- `bibliotecas` — o que o projeto já tem de terceiros, antes de propor mais uma

**Qualidade**
- `arquivos_grandes` — o que não cabe numa chamada de agente e precisa ser dividido

**Leitura com o recorte do projeto** — `grep` · `ler_arquivo` · `listar_pasta`.
As suas ferramentas nativas são mais rápidas; use estas quando quiser respeitar
o que o usuário tirou do escopo, porque elas recusam o que está fora dele.

O `grep` daqui tem dois interruptores que a sua ferramenta nativa não tem, e em
código escrito em português eles não são detalhe: `todo`/`toda`/`todos` colide
com o marcador `TODO`, e a busca crua devolve centenas de linhas sem um marcador
sequer. `palavra_inteira` casa só a palavra sozinha; `diferenciar_maiusculas`
respeita a caixa. Os dois são falsos por padrão. ⚠️ Nenhum deles dobra acento:
`funcao` não acha `função` — quem precisa das duas grafias busca as duas.

Duas coisas que economizam chamada:

- `indice_navegacao` e `grafo_imports` vêm **em partes**. Chamadas sem o
  parâmetro `parte`, devolvem o índice das partes — escolha uma em vez de puxar
  tudo. O `resumo_pastas` e o `doc_tecnica` são lidos **por seção** (`ler`), e o
  `pipeline` **em níveis**: sem `parte`, a Visão geral; cada nível cita os ids
  do nível de baixo.
- A maioria lê um artefato que uma rotina gerou antes, então pode estar
  desatualizada; quando estiver, a própria resposta avisa numa última linha, e
  silêncio significa em dia. As que varrem o disco na hora (`io`,
  `arquivos_grandes`, `grep`, `ler_arquivo`, `listar_pasta`) nunca avisam porque
  nunca estão velhas.

### `trabalhos` — as 8 do Quadro, e sete delas ESCREVEM

O `trabalhos` mexe no Quadro de atividades. Só a primeira lê: as outras **sete
gravam** no estado do projeto, e é por elas que o usuário acompanha o andamento
na tela.

| Ferramenta | O que faz | Lê ou escreve |
|---|---|---|
| `quadro` | o Quadro inteiro: cada atividade, em que coluna está, tags e tarefas | lê |
| `criar` | cria uma atividade nova; nasce sempre em "Na fila" | **escreve** |
| `mover` | muda a atividade de coluna | **escreve** |
| `tarefas` | escreve a lista de passos do cartão | **escreve** |
| `marcar` | marca uma tarefa como pendente, fazendo ou feita | **escreve** |
| `anotar` | atualiza o resumo, os arquivos tocados e as dependências | **escreve** |
| `tag` | põe ou tira uma tag do vocabulário fechado | **escreve** |
| `chamar` | para e chama o usuário | **escreve** |

⚠️ Sete escritas quer dizer que uma chamada errada aqui muda o que o usuário vê
no Quadro. O endereço completo de cada uma é `mcp__trabalhos__<nome>`.

## O que já foi decidido neste projeto

Em `Saída das skills/` estão as decisões já tomadas aqui. Cada base tem o seu
gatilho, e **a leitura vem antes da ação**: consultar depois de escrever é
refazer trabalho. Base que não existir ainda não é erro — siga sem ela, e nunca
reclame da ausência.

| Antes de… | Leia |
|---|---|
| criar, mover, renomear ou deletar arquivo ou pasta | `Saída das skills/Arquitetura modular/Exceções.md` e `Convenções.md` — e, depois deles, a skill de arquitetura modular instalada neste projeto |
| mexer em tela, componente, cor, espaçamento, fonte ou comportamento de UI | `Saída das skills/Padrões de interface/Índice geral.md` |
| nomear variável, função, arquivo, componente, tipo, constante ou texto de tela | `Saída das skills/Terminologia e nomenclatura/Vocabulário.md` |
| escrever ou alterar qualquer código | `Saída das skills/Regras e instruções/Índice.md` |

Uma base que cresceu vira **pasta com índice**, e o arquivo de mesmo nome fica
no lugar como ponteiro de três linhas (`Vocabulário.md` → `Vocabulário/`). O
caminho da tabela continua valendo; siga o ponteiro. Arquivos `Histórico …` são
o texto integral de antes de a base ser condensada — existem para nada se
perder, não para ser lidos.

**Arquitetura de pastas (AMF).** A skill instalada aqui é a variante do tipo
deste projeto, e a referência dela é genérica — vale para qualquer projeto do
mesmo tipo. O que é específico daqui está em `Exceções.md` e `Convenções.md`. O
desvio do projeto sempre vence a regra genérica, e é por isso que ele se lê
primeiro.

**Padrões de interface.** O `Índice geral.md` diz qual arquivo abrir:
`Identidade visual.md`, `Componentes/`, `Estrutura das telas/`,
`Comportamentos/`, `Convenções.md`, `Exceções.md`. Abra só o que a tarefa pedir.

**Terminologia e nomenclatura.** O `Vocabulário.md` tem os nomes já decididos
para os conceitos deste projeto. Não invente sinônimo para o que já tem nome, e
não contrarie um nome decidido sem avisar o usuário.

**Regras e instruções.** Cada item é uma pasta com o nome dele, e o tipo é a
forma: pasta com **um arquivo só** é uma **regra** — curta, vale sempre, leia
todas; pasta com o principal mais `Como aplicar.md` é uma **instrução** — a
receita de algo que se repete, vale só na hora certa. O `Índice.md` diz quando
cada instrução se aplica: abra só a que a tarefa pedir, e construa a partir da
receita em vez de refazer do zero. O índice é gerado automaticamente — se
parecer desatualizado, avise o usuário em vez de editá-lo.

## Ao terminar, registre o que é relevante para continuar o desenvolvimento

Decisão que vale para as próximas tarefas não pode morrer na conversa. Se
durante a tarefa o usuário decidir algo que se repete, registre na base
correspondente antes de encerrar — o que muda uma decisão futura, não o relato
do que foi feito:

- onde um tipo de arquivo passa a morar → **Arquitetura modular**
- como um componente ou tela deve se comportar → **Padrões de interface**
- que um conceito passa a se chamar X → **Terminologia e nomenclatura**
- uma ordem que vale sempre, ou a receita de algo que vai se repetir → **Regras e instruções**

Cada registro cabe em cinco linhas; o porquê vai junto, em uma linha. Base que
só é lida e nunca escrita para de valer em duas semanas.
