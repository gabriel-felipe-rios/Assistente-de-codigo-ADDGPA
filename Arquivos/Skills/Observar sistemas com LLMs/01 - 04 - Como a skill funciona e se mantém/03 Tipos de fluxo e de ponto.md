# 03 Tipos de fluxo e de ponto

*Abra este arquivo quando o painel mostrar um tipo estranho (ou «outro»), quando precisar corrigir um tipo, ou para saber como o analisador decide.*

## Os quatro tipos de fluxo

| Tipo (id) | O que é |
|---|---|
| **tiro único** (`tiro`) | um prompt mandado para a IA, mais alguma coisa; o resultado é salvo e o fluxo morre |
| **cadeia** (`cadeia`) | etapas fixas, uma atrás da outra; o código decide a ordem |
| **ciclo** (`ciclo`) | papéis que se repetem (faz, confere, volta) até aprovar ou bater o teto de voltas; o código decide se volta |
| **agente** (`agente`) | o próprio modelo escolhe o próximo passo (chama uma ferramenta, lê o resultado, decide de novo); a ordem não está escrita no código |

Uma ferramenta do agente pode **disparar outro fluxo** (por exemplo, uma ferramenta «Chamar Revisor» que acorda o fluxo do revisor): é a seta rosa. Isso vale para qualquer tipo de fluxo e **não** é o que define o agente.

**Como o fluxo ganha o tipo**, nesta ordem: 1) `correcoes["_fluxo"].tipo`, se existir; 2) `agente`, se há laço com um passo de LLM seguido de despacho por dicionário de ferramentas; 3) `ciclo`, se há seta de laço; 4) `tiro`, se há exatamente um ponto `llm`, nenhum modelo complementar e nenhum laço; 5) `cadeia`, o resto.

## Os nove tipos de ponto

| Ponto (id) | O que é | Num sistema com API de LLM | Num sistema próprio ou local | Como aparece nos Logs |
|---|---|---|---|---|
| **gatilho** (`gatilho`) | o que acorda o fluxo: um evento, uma agenda, uma mensagem, um clique | mensagem que chega por webhook; requisição HTTP recebida | arquivo novo na pasta; agenda das 18:00; botão clicado | «Começou — {o que acordou}» |
| **LLM** (`llm`) | uma chamada ao modelo que gera texto | chamada a uma API de LLM (chat, mensagens) | chamada a um modelo local, num servidor no localhost | «Chamou o modelo — enviou X tokens, recebeu Y» |
| **ferramenta** (`ferramenta`) | função que o modelo pode pedir para rodar; às vezes ele chama alguma | função declarada no tool use da API | buscar, ler arquivo, chamar outro fluxo | «Rodou a ferramenta» |
| **código** (`codigo`) | passo comum do programa, sem modelo | formatar a resposta; gravar no banco | extrair texto; gravar arquivo | «Executou… (tempo)» |
| **humano** (`humano`) | espera a resposta de uma pessoa | pedido de aprovação; formulário | chamar o usuário no teto de voltas | «Pediu ao usuário» |
| **modelo complementar** (`embedding`) | outro modelo que não gera texto | API de embeddings ou de reranking | modelo local de vetores | «Chamou o modelo…» (só entrada) |
| **barreira** (`barreira`) | bloqueia, limita ou corta: guardrail, restrição, timeout, limite | filtro de conteúdo; limite de taxa; limite de tokens; timeout da chamada | confiança mínima; validação de formato; limite de voltas | «Passou» ou «Barrou» — barrar vira aviso ou erro |
| **fila** (`fila`) | espera a vez antes de seguir: fila de pedidos ao modelo | fila local diante do limite de requisições do provedor | um pedido por vez no servidor local; semáforo | «Ficou na fila por X s» |
| **outro** (`outro`) | qualquer coisa que não cabe nos outros | cache; banco; webhook de saída | tudo o que for próprio do sistema | nome e duração |

## A regra do «outro»

O painel **nunca esconde** um ponto cujo tipo não reconhece: mostra como «outro». A regra serve para qualquer sistema — API, modelo local ou código próprio. **Não invente tipo novo.**

## Como o analisador decide o tipo do ponto

Ordem: 1) `correcoes[id].tipo`; 2) `gatilho`, se é a entrada do fluxo; 3) o `tipo=` da marca da própria função (arquivo 07), se houver; 4) as **assinaturas** abaixo, olhando o corpo da função do passo e, em seguida, o corpo das funções do projeto que ela chama (até 4 níveis; sem entrar na função de entrada de outro fluxo), com esta prioridade: LLM > modelo complementar > fila > barreira > humano > ferramenta; 5) senão, `codigo`.

| Tipo | O que casa (texto da chamada, sem diferenciar maiúsculas, ou nome da função) |
|---|---|
| `llm` | chamada terminando em `chat.completions.create`, `completions.create`, `messages.create`, `responses.create`, `generate_content`, `ollama.chat`; `.generate(` com argumento `prompt`; `.post(` cujo primeiro argumento contém `/chat/completions`, `/v1/messages`, `/api/generate`, `/api/chat` ou `/completion`; função com o decorador `modelo` |
| `embedding` | terminando em `embeddings.create`; `.embed(`, `embed_documents`, `embed_query`, `.rerank(` |
| `fila` | `Semaphore(`, `BoundedSemaphore(`, `.acquire(`, `Queue(`, `PriorityQueue(` |
| `barreira` | `moderations.create`, `RateLimiter`, `ratelimit`, `wait_for(`; nome da função contendo `guardrail`, `limite`, `limit`, `valida`, `confian` ou `timeout` |
| `humano` | `input(`, `askyesno`, `messagebox.`, `wait_for_user`, `aguardar_usuario`; nome da função `pedir_ao_usuario`, `perguntar_ao_usuario`, `aguardar_resposta` |
| `ferramenta` | decorador `tool`, `function_tool` ou `ferramenta`; função-valor de um dicionário de ferramentas usado como despacho dentro de um laço com LLM |

**Chamada solta** (a assinatura aparece, mas a chamada não é a uma função do projeto): vira um passo com o nome do tipo («Modelo», «Fila», «Barreira»…).

**Como corrigir quando o analisador errar:** use o campo `correcoes` da descrição (arquivo 06). Exemplo: `"correcoes": {"confianca_minima": {"tipo": "barreira"}}`.

## Regras de nome

- Ids de fluxo: `tiro`, `cadeia`, `ciclo`, `agente`.
- Ids de ponto: `gatilho`, `llm`, `ferramenta`, `codigo`, `humano`, `embedding`, `barreira`, `fila`, `outro`.
- Na tela aparecem os rótulos («tiro único», «modelo complementar»…). Nos arquivos JSON e nas marcas vão sempre os **ids**.
