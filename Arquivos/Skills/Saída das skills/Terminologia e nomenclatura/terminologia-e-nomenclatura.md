---
name: terminologia-e-nomenclatura
description: Mantém um vocabulário único e consistente no projeto — nomes de variáveis, funções, arquivos, componentes, entidades, tipos e textos de interface — consultando e atualizando a base de conhecimento em "Saída das skills/Terminologia e nomenclatura/" (vocabulário, convenções e exceções). Use SEMPRE antes de nomear qualquer variável, função, arquivo, componente, classe, tipo, constante ou texto de interface novo — mesmo que o usuário não peça explicitamente para "seguir o padrão". Use também sempre que o usuário disser algo do tipo "sempre chame isso de X", "nunca use Y pra esse conceito", "isso aqui já tem nome, é Z", ou quando pedir para registrar um termo, uma convenção de nomenclatura ou uma exceção. Aqui o assunto é sempre o NOME das coisas — não o lugar onde ficam nem a aparência que têm.
---

# Terminologia e nomenclatura

Essa skill existe para resolver um problema específico: o mesmo conceito ganhando nomes diferentes ao longo do projeto — `cliente`/`customer`/`client`, `fetchUsuarios`/`loadUsuarios`/`getUsuarios`, "Salvar"/"Gravar"/"Confirmar" pro mesmo botão, capitalização inconsistente em títulos. Isso acontece mesmo quando a IA está escrevendo código genuinamente novo, sem duplicar nada — ela simplesmente não lembra que aquele conceito já tinha um nome decidido em outra parte do projeto. Esta skill dá a ela essa memória. A memória é de **nomes**, não de significados: o Vocabulário diz como uma coisa se chama e como não se chama — nunca descreve o que ela é nem conta como a decisão foi tomada. Descrever é papel da documentação do projeto; a história fica na discussão de origem, que o verbete cita.

`Saída das skills/` é uma pasta comum, compartilhada com outras bases — se ela já existir, não recrie; apenas crie `Terminologia e nomenclatura/` dentro dela.

## Estrutura da base de conhecimento

```
Saída das skills/Terminologia e nomenclatura/
├── Vocabulário.md    ← nomes canônicos já decididos para conceitos deste projeto
├── Convenções.md      ← regras gerais de como nomear algo novo, dividida em duas seções internas:
│                          "Convenções para código" e "Convenções para interface"
└── Exceções.md        ← nomes que fogem do padrão em um caso específico, também dividida em duas seções:
                           "Exceções para código" e "Exceções para interface"
```

`Convenções.md` e `Exceções.md` são divididos internamente porque regras de código (identificador, variável, função) e regras de interface (texto que o usuário vê) seguem normas diferentes — por exemplo, código nunca usa acento, interface sempre usa. Se a tarefa mexe só em código, consulte só a seção de código; se mexe só em interface, só a de interface; se mexe nos dois, leia as duas.

Essa base tem três arquivos únicos. Se algum crescer demais, ele vira pasta com índice — ver "O que entra na base, em que tamanho, e o que fazer quando ela cresce".

Se `Saída das skills/Terminologia e nomenclatura/` não existir ainda no projeto, crie a estrutura inteira agora mesmo, com o conteúdo exato descrito em **Configuração inicial** mais abaixo, e avise o usuário que a estrutura foi criada.

### Por que essa organização
- `Vocabulário.md` é a "lista de nomes já decididos" — a primeira coisa a consultar quando um conceito já existe no projeto e só precisa ser reutilizado com o nome certo.
- `Convenções.md` só entra quando o conceito é realmente novo e ainda não tem nome — aí a regra geral (padrão de verbo, capitalização, idioma) decide como batizá-lo.
- `Exceções.md` vence os dois de cima, sempre que um caso específico precisar fugir do padrão por um motivo concreto.

## Fase 1 — Consulta (antes de nomear qualquer coisa nova)

Sempre que for criar ou renomear uma variável, função, arquivo, componente, classe, tipo, constante, entidade ou qualquer texto visível na interface (botão, título, mensagem, rótulo):

1. Identifique o contexto: é um identificador de código, um texto de interface, ou os dois (ex: criar um componente novo geralmente mexe nos dois — o nome do arquivo/função é código, o texto que aparece na tela é interface).
2. Leia a(s) seção(ões) correspondente(s) de `Exceções.md` (`Exceções para código` e/ou `Exceções para interface`) — se houver uma exceção específica pro caso, ela vence tudo abaixo.
3. Leia `Vocabulário.md` — verifique se o conceito envolvido **já tem um nome definido** no projeto. Se tiver, reutilize exatamente esse nome; nunca crie um sinônimo (`cliente` existe → não escreva `customer`). Se o Vocabulário já virou pasta, leia `Vocabulário/Índice - Vocabulário.md` e abra só os temas ligados à tarefa.
4. Se o conceito for genuinamente novo (não existe ainda no Vocabulário), aplique a(s) seção(ões) correspondente(s) de `Convenções.md` (`Convenções para código` e/ou `Convenções para interface`) pra decidir o nome.
5. Se a solicitação do usuário conflitar com um nome já registrado, avise sobre o conflito antes de implementar, em vez de silenciosamente criar um nome alternativo.

## Fase 2 — Atualização (depois de nomear algo novo)

Depois de criar ou renomear algo, registre o que é **relevante para continuar o desenvolvimento**: um nome que outra sessão precisaria reutilizar, ou um que ela precisaria evitar. Nada além disso — nem o que a coisa é, nem como se chegou ao nome.

Árvore de decisão de onde registrar:

| O que surgiu | Onde registrar |
|---|---|
| Nome canônico de uma entidade, ação, verbo de operação ou texto de interface que ainda não existia | `Vocabulário.md` |
| Regra geral de como nomear algo em código (válida pro projeto inteiro) | `Convenções.md` → seção "Convenções para código" |
| Regra geral de como nomear/escrever algo na interface (válida pro projeto inteiro) | `Convenções.md` → seção "Convenções para interface" |
| Nome de código que foge do padrão geral só nesse caso específico | `Exceções.md` → seção "Exceções para código" |
| Nome de interface que foge do padrão geral só nesse caso específico | `Exceções.md` → seção "Exceções para interface" |

Regras ao atualizar:
- **Nunca duplique conhecimento.** Se `cliente` já está documentado em `Vocabulário.md`, não repita a definição em `Convenções.md`.
- Antes de adicionar um termo, uma convenção ou uma exceção, verifique se algo equivalente já existe (mesmo com outras palavras) para não duplicar. Se existir algo parecido, refine o item existente em vez de criar um novo.
- Reorganize e remova duplicatas quando perceber inconsistência, mantendo os arquivos sempre organizados.

## Modo: configurar

A Fase 2 acima é automática — dispara sozinha depois que algo novo é nomeado. Mas o usuário também pode pedir diretamente, em linguagem natural, pra registrar um termo, uma convenção ou uma exceção, sem que isso venha de uma implementação recém-feita (ex: "sempre chame isso de X", "nunca use Y pra esse conceito", "esse caso aqui é uma exceção porque..."). Quando isso acontecer, execute apenas este modo.

**O que faz:** atualiza `Vocabulário.md`, `Convenções.md` ou `Exceções.md` em `Saída das skills/Terminologia e nomenclatura/` com o que o usuário descrever.

**Passos:**

1. Leia o conteúdo atual dos três arquivos e mostre um resumo ao usuário.
2. Identifique duas coisas no pedido do usuário:
   - **Tipo:** é um nome específico de conceito (`Vocabulário.md`), uma regra geral de nomenclatura (`Convenções.md`) ou um desvio pontual (`Exceções.md`)?
   - **Contexto** (só se for Convenções ou Exceções): a regra é sobre código (identificador), sobre interface (texto visível), ou os dois? Se não estiver claro, pergunte.
3. Antes de adicionar, verifique se já existe algo parecido (mesmo com outras palavras); se existir, refine o item existente em vez de duplicar.
4. Aplique a alteração na seção correta, no formato de cinco linhas, e mostre o resultado.
5. Pergunte se quer mais alguma alteração. Repita até o usuário confirmar que terminou.

## O que entra na base, em que tamanho, e o que fazer quando ela cresce

**O filtro — o que NÃO entra.** Entra só o que muda um nome futuro: o canônico, o que nunca usar, a regra geral de nomear, a exceção. Não entra: o que a coisa é, a história da decisão, nota de implementação, código, a lista de lugares onde o nome aparece.

**O teto — cinco linhas por verbete.** O excedente vai para a discussão de origem, citada na última linha:

```
### Cartão de configuração                                    ← o que é (só o título)
Canônico: `.config-cartao` (+ -cabecalho, -titulo, -dica)    ← como se chama
Nunca: "card" em identificador novo deste conjunto            ← como não se chama
Por quê: `.project-card` e `.agente-card` são anteriores à convenção   ← UMA linha
Origem: 2026-08-20 · discussão "Aparência das configurações"           ← onde está o resto
```

Convenção e exceção seguem o mesmo teto: título · a regra ou a exceção · onde vale · por quê em uma linha · origem.

**O transbordo — quando mesmo assim cresce.** `Vocabulário.md` (ou `Convenções.md`, `Exceções.md`) que passar de **~20 KB** vira pasta com o mesmo nome: `Vocabulário/Índice - Vocabulário.md` (uma linha por tema: o que cobre · quando abrir) mais um arquivo por tema, nascendo pelas seções `##` que o arquivo já tinha — `Entidades.md`, `Ações e textos de interface.md`, `Funções e operações.md`, e os temas próprios do projeto (`Abas do programa.md`, `Fila e tarefas.md`, …). Na Fase 1 lê-se **o índice** e abre-se **só os temas da tarefa**: "vou nomear um botão da Fila" → `Fila e tarefas.md` + `Ações e textos de interface.md`, e nada mais. Projeto pequeno nunca chega ao transbordo. Ao encontrar um arquivo acima do limite numa base que cresceu antes desta versão da skill, proponha ao usuário reparti-lo — e não faça sem ele.

## Convenção de nomenclatura (da própria base)

- Pasta principal: `Terminologia e nomenclatura` (só o "T" maiúsculo).
- Os três arquivos: primeira letra maiúscula, acentuação normal (`Vocabulário.md`, `Convenções.md`, `Exceções.md`).

## Configuração inicial — criando "Terminologia e nomenclatura/" do zero

Quando a pasta `Saída das skills/Terminologia e nomenclatura/` não existir, crie os 3 arquivos abaixo, exatamente com este conteúdo:

### `Vocabulário.md`

```markdown
# Vocabulário

Nomes canônicos já decididos para conceitos deste projeto. Antes de nomear qualquer variável, função, arquivo, entidade ou texto de interface, verifique aqui se o conceito já tem um nome definido — se tiver, reutilize; nunca invente um sinônimo. Este arquivo diz como as coisas se chamam, não o que elas são.

<!-- Formato de um verbete (cinco linhas, nunca mais):
### Conceito
Canônico: o nome usado em todo o projeto
Nunca: os sinônimos que já apareceram e devem ser evitados
Por quê: uma linha
Origem: data · discussão
-->

## Entidades

## Ações e textos de interface

## Funções e operações
```

### `Convenções.md`

```markdown
# Convenções — Terminologia e nomenclatura

Regras gerais de como nomear algo NOVO, quando o conceito ainda não está registrado em `Vocabulário.md`. Dividida em dois contextos — consulte o que for relevante para a tarefa (só código, só interface, ou os dois).

Antes de nomear algo, sempre verificar se o conceito já existe em `Vocabulário.md` — nunca inventar um sinônimo pra algo que já tem nome.

## Convenções para código (identificadores)

- Identificador de código (variável, função, arquivo, tipo, classe, constante) sempre em português — sem exceção.
- Nunca usar acento ou caractere especial em identificador de código, mesmo quando o nome é em português (ex: `situacao`, não `situação`).
- Nunca abreviar — sempre o termo completo (ex: `quantidade`, nunca `qtd`).
- Sigla sempre em maiúsculo, mesmo dentro de um identificador (ex: `clienteCPF`, `respostaAPI`).
- Função e variável: `camelCase`. Componente e classe: `PascalCase`. Constante fixa (valor que nunca muda durante a execução): `UPPER_SNAKE_CASE` (ex: `LIMITE_MAXIMO`).
- Coleção/lista sempre no plural (`clientes`), item único sempre no singular (`cliente`).
- Verbo para operação de busca/carregamento: sempre `buscar` (ex: `buscarClientes`) — nunca alternar com obter/pegar/carregar.
- Variável booleana sempre com prefixo fixo conforme o tipo de pergunta que ela responde — nunca escolher livremente entre os quatro, cada tipo tem exatamente um prefixo certo:

  | Tipo de boleano | Prefixo fixo | Exemplo |
  |---|---|---|
  | Estado/condição atual | `esta` | `estaAtivo`, `estaCarregando` |
  | Posse/existência de algo | `tem` | `temPermissao`, `temErro` |
  | Capacidade/permissão de fazer algo | `pode` | `podeEditar`, `podeExcluir` |
  | Obrigação/necessidade | `deve` | `deveValidar`, `deveExibirAviso` |

## Convenções para interface (texto visível ao usuário)

- Texto em português correto, com acentuação e pontuação normais — diferente do código, aqui não se remove acento.
- Sigla sempre em maiúsculo (ex: "Enviar PDF", "Consultar CPF").
- Título, rótulo de botão e frase: Sentence case — só a primeira letra maiúscula, exceto nomes próprios (ex: "Criar novo cliente", nunca "Criar Novo Cliente").
- **Mini-guia de nomes de interface** — cada elemento tem uma forma, e a forma não muda de tela para tela:

  | Elemento | Regra | Exemplo |
  |---|---|---|
  | Aba de topo | um substantivo; é um **lugar**. Uma palavra é a preferência, não a regra — duas ou três se precisar | "Projeto", "Acervo", "Mapas" |
  | Singular × plural | plural quando o conteúdo é uma coleção de itens iguais; singular quando é um lugar ou uma ferramenta | "Rotinas", "Erros" · "Quadro", "Editor" |
  | Sub-aba principal | repete o nome da aba (é "o principal") | Assistente › Chat › Chat |
  | Sub-abas irmãs | mesma forma gramatical entre si | "Quadro" · "Linha do tempo" · "Fluxo" |
  | Verbo em nome de aba | nunca — nomeie o que se vê, não o ato | "Pipeline", não "Visualizar pipeline" |
  | Botão, ação, item de menu | verbo no infinitivo, um por conceito | "Salvar", "Remover", "Renomear" |
  | Estado | adjetivo ou particípio | "Ativo", "Concluída" |
  | Campo | substantivo do que se preenche | "Nome", "Pasta de saída" |
  | Título de janela ou modal | substantivo do que ela faz ou mostra; sem verbo | "Configurações", "Novo projeto" |
  | Mensagem de erro ou aviso | frase completa: o que aconteceu **e** o que fazer | "Não achei a pasta X. Escolha outra em Configurações." |
  | Placeholder | exemplo do que se digita, não instrução | "nome-do-projeto", não "Digite o nome" |
  | Tooltip | uma frase, sem ponto final, diz o que o controle faz | "Copia o caminho para a área de transferência" |
  | Contador | sempre com a unidade e o plural certo | "1 arquivo", "3 arquivos", "nenhum arquivo" |
  | Abreviação | nunca em texto de interface, salvo sigla consagrada em maiúsculo | "configurações", não "config" |
  | Caixa | nunca caixa alta: só a primeira letra maiúscula | "Linha do tempo", não "LINHA DO TEMPO" |
  | Uma palavra, um conceito | a mesma palavra nunca nomeia duas coisas no programa | — |
  | Batizar algo novo | 1) já existe no Vocabulário? 2) é lugar, ação ou estado? 3) cabe na forma dos irmãos? 4) registre | — |

<!-- Adicione novas convenções abaixo, uma por vez, na seção correta (código ou interface), no formato de cinco linhas. Antes de adicionar, verifique se algo parecido já existe. -->
```

### `Exceções.md`

```markdown
# Exceções — Terminologia e nomenclatura

Casos em que um nome foge da convenção geral ou do vocabulário padrão. Se existe uma exceção aqui, ela sempre vence. Dividida em dois contextos, igual `Convenções.md`.

## Exceções para código

<!-- Formato (cinco linhas):
### [Identificador/situação]
Exceção: o nome usado aqui
Vale em: onde vale
Por quê: uma linha
Origem: data · discussão
-->

## Exceções para interface

<!-- Formato (cinco linhas):
### [Texto/situação]
Exceção: o nome usado aqui
Vale em: onde vale
Por quê: uma linha
Origem: data · discussão
-->
```
