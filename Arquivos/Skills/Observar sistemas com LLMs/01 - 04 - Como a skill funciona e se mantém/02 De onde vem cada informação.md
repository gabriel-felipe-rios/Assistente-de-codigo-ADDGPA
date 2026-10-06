# 02 De onde vem cada informação

*Abra este arquivo para saber de onde o painel tira cada dado, qual é o formato do rastro e como o desenho é montado.*

## As três origens

| Origem | O que é | O que fornece |
|---|---|---|
| **código** | o painel lê o código-fonte Python (só leitura) | pontos, ligações, tipo provável, arquivo e linha, o que espera e o que envia |
| **rastro** | o que rodou de verdade, gravado pelo programa | prompt, resposta, tokens, tempos, erros, contagens |
| **assistente** | a frase curta que só quem leu o código escreve | descrição do fluxo e de cada ponto, e as correções |

## Campo do painel → origem

| Campo | Origem |
|---|---|
| nome do ponto | código (o nome da função; o assistente pode corrigir em `correcoes`) |
| tipo do ponto | código (regras do arquivo 03); assistente, se corrigir |
| ligações / setas | código |
| arquivo:linha | código |
| espera | código (assistente, se corrigir) |
| envia | código |
| descrição | assistente |
| tokens de entrada, saída e total | rastro |
| contagens | rastro |
| prompt / resposta | rastro (só com `OBSERVAR_TEXTO=1`) |
| duração | rastro |
| erro | rastro |
| voltas | rastro |
| estado da execução | rastro |
| «rodando agora» | rastro |

## O rastro

Fica em `Program/Internal/logs/rastro.jsonl` (recomendado; o caminho vive no bloco `AJUSTES DO PROJETO` do `emissor.py` e do `Observar.pyw`, e o `emissor.py` também aceita a variável de ambiente `OBSERVAR_RASTRO`). É um arquivo de texto UTF-8, **uma linha JSON por evento**. Chaves ausentes significam «não se aplica».

| Chave | Tipo | Quando | Significado |
|---|---|---|---|
| `v` | inteiro | sempre | versão do formato: `1` |
| `ts` | número | sempre | segundos desde 1970 |
| `evento` | texto | sempre | `"ponto_inicio"` ou `"ponto_fim"` |
| `execucao` | texto | sempre | id da execução, ex. `"20260930-154720-3"` |
| `fluxo` | texto | sempre | id do fluxo (o `fluxo` do JSON de descrição) |
| `ponto` | texto | sempre | id do ponto = nome da função (ou o `ponto=` da marca) |
| `visita` | inteiro | sempre | 1ª, 2ª… vez que este ponto roda **nesta execução** (laço/voltas) |
| `tipo` | texto | se a marca informou | um dos nove ids de tipo de ponto (arquivo 03) |
| `duracao` | número | `ponto_fim` | segundos |
| `estado` | texto | `ponto_fim` | `"ok"`, `"erro"` ou `"barrou"` |
| `erro` | texto | `ponto_fim` com `estado:"erro"` | `"TipoDoErro: mensagem"`, até 500 caracteres |
| `encerra` | texto | `ponto_fim`, se a marca pediu | `"teto"`: a execução termina por ter batido o teto de voltas |
| `detalhe` | texto | opcional | frase curta do que o ponto fez; no **gatilho** é o «Disparada por» (ex. `"evento: arquivo novo — contrato-091.pdf"`) |
| `contagens` | objeto | opcional | `{"documentos enviados ao modelo": 1, "palavras lidas": 600}` |
| `gen_ai.operation.name` | texto | pontos de modelo/ferramenta | `"chat"` (LLM), `"embeddings"` (modelo complementar), `"execute_tool"` (ferramenta) |
| `gen_ai.request.model` | texto | se conhecido | nome do modelo |
| `gen_ai.usage.input_tokens` | inteiro | pontos de modelo | tokens de entrada |
| `gen_ai.usage.output_tokens` | inteiro | pontos de modelo | tokens de saída |
| `tokens_fonte` | texto | com tokens | `"servidor"` (uso real devolvido pelo modelo) ou `"local"` (contado localmente — marcado no painel) |
| `enviado` | texto | só com o interruptor ligado | o texto **inteiro** enviado ao modelo |
| `resposta` | texto | só com o interruptor ligado | a resposta **inteira** |

Os nomes com `gen_ai.` espelham os do padrão OpenTelemetry para IA generativa, só para o formato ser familiar; **nada do OpenTelemetry é usado ou exigido**.

- **Uma execução** é uma passagem por um fluxo. Ela **começa** quando roda um ponto de `tipo:"gatilho"` (ou o primeiro ponto do fluxo, ou quando passam 300 s — `OCIOSO_S` — sem evento nenhum daquele fluxo) e **termina** por si: o painel deduz o estado — `erro` se algum `ponto_fim` tem `estado:"erro"`; `teto` se algum tem `encerra:"teto"`; senão `ok`.
- **«Rodando agora»** (Ao vivo): existe um `ponto_inicio` sem o `ponto_fim` correspondente (mesma `execucao`, `ponto` e `visita`).
- **Rotação:** ao abrir uma execução nova, se o arquivo passa de `TETO_BYTES` (20 MB), ele é renomeado para `rastro.anterior.jsonl` (sobrescrevendo o anterior) e um novo começa. `enviado` e `resposta` são cortados em `TETO_TEXTO` (200 000) caracteres.
- **`OBSERVAR_TEXTO=1`:** sem ele, o rastro guarda tokens, tempos, contagens e erros — **não** o texto.
- **`tokens_fonte`:** `servidor` quando a resposta do modelo traz o uso (`usage` ou equivalente); `local` quando o emissor precisou contar sozinho (com o contador que o projeto plugou por `definir_contador`, ou `tiktoken` se estiver instalado, ou uma estimativa de caracteres).

## Como o desenho é montado

O `analisador.py` faz isto, em ordem:

1. Lê todos os `.py` do projeto (menos as pastas de `IGNORAR`) e descobre quem chama quem.
2. Para cada descrição em `Workshop/observar/descricoes/`, acha a **função de entrada** pelo campo `entrada`.
3. Caminha pelo corpo da entrada **na ordem em que as chamadas aparecem**; cada chamada a função do projeto vira um passo. Uma função que só organiza outras (duas ou mais chamadas, nenhuma chamada a modelo, fila etc.) é aberta e os passos dela entram no lugar.
4. Um `if` bifurca; depois dele os ramos se reencontram. `return` e `raise` terminam o ramo.
5. Um laço que contém um passo de LLM vira **ciclo**: ganha a seta de volta e o teto de voltas quando ele está escrito no código (`range(5)` ou uma constante inteira).
6. Um laço em que o modelo escolhe uma função num dicionário de ferramentas vira **agente**: cada ferramenta liga-se ao modelo por seta de ida e volta.
7. Se um passo de um fluxo chama a função de entrada de **outro** fluxo, o painel desenha a seta «dispara» entre eles.
8. Define o tipo de cada ponto e do fluxo (arquivo 03) e calcula a posição (coluna = maior caminho desde a entrada).

O que ele **não** sabe: quando um evento acorda o programa por texto solto, uma pessoa respondendo, e — principalmente — **qual função é a entrada de um fluxo**. Por isso o assistente escreve a descrição e aponta a `entrada`.

## O que o painel nunca faz

Escrever no projeto, chamar a internet, reexecutar o programa.
