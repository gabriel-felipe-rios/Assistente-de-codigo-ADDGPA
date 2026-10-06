# 01 Tipos de agente e como se comportam

## O que é e quando usar

Este é o mapa das formas de usar um modelo de linguagem dentro de um programa. Antes de escrever qualquer coisa, escolha a forma — e a pergunta que escolhe é **"quem decide o próximo passo?"**: o usuário (chat), o modelo (agente principal), o programa (ciclo de papéis fixos, fila, rotina), ou ninguém (tiro único). Quase todo erro de arquitetura em programa com LLM nasce de responder essa pergunta errado — um chat onde devia ser ciclo fixo, um agente principal onde a ordem já era conhecida, uma rotina automática onde o usuário queria decidir.

Antes da forma, uma pergunta ainda mais básica, que toda peça desta skill faz:

### Quem dá o resultado

| | Quem dá o resultado | Quando é a escolha certa | O que precisa |
|---|---|---|---|
| **(a) determinístico** | uma ferramenta ou uma conta do programa; o modelo nem entra | quando existe regra, fórmula ou fonte verificável (o arquivo existe? quantos tokens tem? a soma bate? o hash mudou?) | nada de modelo — e nada de fingir que precisa |
| **(b) o modelo propõe, o programa conta** | o modelo classifica, extrai, julga; o número, a decisão final e a gravação são do programa, por regra fixa | quando o modelo é bom para julgar mas não pode ser a autoridade (notas, prioridades, o que entra num índice, o nome de um grupo) | validar tudo o que o modelo devolve contra o conjunto real; uma regra fixa para transformar em número ou em decisão |
| **(c) só inferência** | o modelo | quando não há outra fonte (escrever, resumir, responder, propor) | verificação, validação cruzada, teto de tentativas — e mostrar na tela o que foi feito |

Regra: **decida entre (a), (b) e (c) antes de desenhar o ciclo**, para cada resultado que o ciclo produz. Um programa que mede o que o usuário sabe deixou o modelo classificar cada resposta como "presente, ausente ou contradito" — e a nota é uma fórmula do programa sobre essas classificações. Nenhum papel do modelo atribui nota. É o caso (b), e é o que impede a nota de variar com o humor da geração. Outro programa tem quinze rotinas de manutenção; dez são o caso (a) e nunca chamam modelo — hashes, grafo de imports, índice de símbolos — e ninguém sente falta.

Os três casos se misturam dentro de uma mesma cadeia: o programa filtra e conta **(a)**, o modelo escreve **(c)**, o programa confere o que foi citado contra o índice **(a)** e grava **(b)**. Desenhe a cadeia dizendo, passo a passo, quem dá cada resultado.

**O programa monta o documento; o modelo só escreve a prosa.** Quando a saída é um documento com partes que o programa já sabe — nome, tipo, linha, caminho, contagem —, essas partes vêm do programa e nunca passam pelo modelo. O modelo devolve só o que só ele sabe fazer, endereçado por um número que o programa deu (`{número: frase}`), e o programa encaixa. Porquê: um nome que passa pelo modelo pode voltar com uma letra trocada, uma linha pode voltar arredondada — e o que não passa pelo modelo não precisa ser conferido. Com o documento montado assim, refazer um item é refazer só a frase dele, e o que não mudou (pelo hash do trecho) nem chama o modelo.

**Coordenar × ser coordenado, quem tem estado e o laço passo a passo** estão no `02`; **as ferramentas**, no `04`; **o catálogo de papéis de vários domínios e como nomeá-los**, no `05`.

## Como se constrói

Uma seção por forma. Em cada uma: quando usar · o que entra e o que sai · onde mora o estado · como termina · quem pode chamar quem · o arquivo que detalha.

### Antes de qualquer forma: objetivo, critério de parada e teto

Toda forma que roda sozinha — agente principal, subagente, Verificador, fila, rotina, ciclo, lote — tem três coisas escritas antes da primeira linha:

- **Um objetivo** — o que conta como pronto, em uma frase. Vai no prompt e na tela. Sem ele, o modelo otimiza o que ele acha que é o objetivo.
- **Um critério de parada do programa** — relatório aprovado pelo Verificador; lista vazia; resumo gravado no disco; N itens aceitos. **Nunca o modelo dizendo "terminei"**: o modelo nunca é fonte de fato, nem do fato de ter terminado.
- **Um teto** — rodadas, voltas, tentativas, falhas seguidas — como cinto de segurança para quando o critério não chega. Teto não é objetivo: uma tarefa que bate no teto falhou, e a tela diz isso.
- **Teto por convergência, quando o laço encolhe o problema.** Um laço que agrupa e junta (a costura, → `09`) não tem número fixo de rodadas: ele para quando uma rodada não reduz mais nada. Se agrupar não reduziu, force grupos de dois — senão a mesma rodada se repete para sempre com o mesmo tamanho.

Quando o trabalho é uma **direção de longo prazo** sem entrega definida (uma meta), o objetivo vira um documento vivo: um programa guarda para cada meta um "entendimento" que o modelo acumula lendo os arquivos um a um, com o progresso persistido, e "passos" propostos com produtos, travas e riscos — o que a fila devolve e o que o usuário edita no chat gravam em arquivos separados, e a meta em si nunca "termina"; termina cada passo.

### Os eixos de um fluxo — independentes da forma

A forma diz quem decide o próximo passo. Um fluxo tem mais perguntas, e cada uma se responde separado — duas rotinas da mesma forma podem diferir em todas:

| Eixo | As respostas possíveis | Por que importa |
|---|---|---|
| **quem dispara** | evento do disco · botão (a partida de tudo × o ▶ de um item só) · cronômetro interno · abertura do projeto | a abertura só **mostra** o que ficou pendente; retomar é por botão — disparar ao abrir faz o programa trabalhar quando o usuário só quis olhar |
| **o disparo muda a política** | evento **enfileira**; clique **recusa com o motivo** quando o modelo está ocupado | quem não está olhando não pode perder a vez; quem está olhando merece a frase |
| **chama modelo ou não** | uma lista fechada dos que não chamam | um passo sem modelo não entra na vez do modelo, não conta tokens e não tem retentativa de modelo |
| **custo** | determinístico (milissegundos) · IA para outro agente ler · IA para gente ler | o custo decide o grupo e a espera — **não são níveis de prioridade, são custos**: o barato roda logo, o caro espera o usuário parar de mexer |
| **de que se alimenta** | disco · análise do código · saída de outra rotina · duas fontes | quem se alimenta de outra rotina espera por ela; fonte dupla espera as duas (→ `14`) |
| **hierarquia** | plano, item a item × de baixo para cima, por níveis | o de baixo para cima só roda um nível com o de baixo completo (→ `14`) |
| **laço** | nenhum · fila · laço de ferramentas (teto de rodadas) · costura (teto por convergência) · espera com piso | todo laço tem teto, e o tipo de teto depende do laço |
| **visível × fundo** | tem painel, ou só roda por trás (→ `20`) | o mesmo registro serve à tela e ao vigia de vida — um registro, dois leitores |

Regra: escreva a linha de cada eixo **antes** de construir o fluxo. A maioria dos defeitos de automação é um eixo decidido sem ninguém perceber — uma rotina que dispara ao abrir, um passo sem modelo esperando a vez do modelo.

### 1 · Tiro único

- **Quando:** um prompt, uma resposta, acabou. Classificar um texto, dar nome a uma coisa, resumir um trecho, extrair campos. A forma mais barata e a mais subestimada — muita "conversa" era tiro único disfarçado, pagando histórico por nada.
- **Entra / sai:** um system curto + o material; uma resposta, quase sempre com esquema (→ `10`).
- **Estado:** nenhum. Não há histórico, e por isso não há cache de prefixo a preservar (→ `11`).
- **Termina:** na primeira resposta. Se ela vier errada, há **um** prompt de correção, e depois erro do item — nunca um laço.
- **Chama:** ninguém.
- **Sinal de que devia ser outra forma:** você está guardando a resposta para mandar de novo na próxima chamada. Isso é chat ou laço.

### 2 · Chat conversacional

- **Quando:** o usuário decide o próximo passo, mensagem a mensagem. A saída é prosa lida por gente.
- **Entra / sai:** system → prompts fixos e contexto inicial → histórico → mensagem nova; sai texto em streaming.
- **Estado:** a sessão em disco, com o histórico **cru** (o raciocínio do modelo dentro), porque é o histórico que o servidor reaproveita.
- **Termina:** nunca sozinho; o usuário para, ou fecha.
- **Chama:** pode chamar subagentes — e aí vira a forma 3 por dentro, entre uma mensagem e outra.
- → `12`.

### 3 · Agente principal

- **Quando:** o modelo decide o próximo passo: recebe o pedido, escolhe quais subagentes chamar e em que ordem, lê o que voltou, escreve a saída. É a forma para pedidos abertos ("descubra onde isso é usado e me explique").
- **Entra / sai:** o pedido + o catálogo de subagentes disponíveis (um bloco por subagente ligado, no system); sai **prosa com um envelope** — texto livre para o usuário e um JSON só para as chamadas, que a tela separa.
- **Estado:** o histórico da conversa; a lista de quais subagentes estão ligados **fica salva por sessão** e trava depois da primeira mensagem.
- **Termina:** quando o modelo responde sem pedir mais chamadas, ou no teto de rodadas.
- **Chama:** subagentes (forma 4). **Pode ter ferramentas próprias** — quando o caso pede fazer em vez de delegar, ou dividir o trabalho em partes antes de mandar. Decida isso por programa; não há regra geral.
- **Não é a forma certa quando a ordem já é conhecida** — aí é a forma 8, e pôr o modelo para "decidir" o que já está decidido só acrescenta variação.
- → `03`.

### 4 · Subagente sem memória com laço de ferramentas

- **Quando:** uma pergunta fechada, respondida lendo coisas: "o que este arquivo faz?", "onde está X?", "isto contraria alguma regra?".
- **Entra / sai:** a pergunta, o system próprio dele, o catálogo de ferramentas que **ele** pode usar, o teto de rodadas; sai uma resposta estruturada (esquema) — ou uma **entrega parcial**: o que ele já leu, com erro marcado, se o teto ou a parada chegarem.
- **Estado:** nenhum entre chamadas. Dentro de uma chamada, o laço (pedir ferramenta → receber → pedir de novo) acumula histórico, e esse histórico mantém prefixo.
- **Termina:** resposta final, teto de rodadas, rodada de correção esgotada, ou parada.
- **Chama:** ferramentas, só as permitidas. Nunca outro subagente — profundidade um.
- → `03`.

### 5 · Verificador

- **Quando:** a saída de outro agente está pronta e precisa ser conferida antes de chegar ao usuário. **Acionado pelo programa, não pelo modelo** — o modelo não pede para ser verificado.
- **Entra / sai:** a saída pronta; sai "aprovado" ou "devolvido, com o motivo".
- **Duas camadas, nesta ordem:** primeiro **sem modelo** (a coisa citada existe? o arquivo está lá? o número bate?), depois **com modelo**, com poucas ferramentas de conferir. A camada sem modelo pega a maioria dos erros de graça.
- **Termina:** com veredito; a devolução tem teto (N vezes), senão dois modelos discutem para sempre.
- **O que o Verificador nunca faz:** dar nota, reescrever a saída, inventar uma ressalva. Ele aprova ou devolve com motivo; das ressalvas possíveis, só as que são **fato conferido pelo programa** (arquivo inexistente, pesquisa incompleta, subagente indisponível) entram por conta dele — as outras o modelo tem direito de emitir, mas não de afirmar como fato.
- → `13`, `15`.

### 6 · Fila sequencial de tarefas longas

- **Quando:** trabalho de horizonte longo — horas, dezenas de idas ao modelo — que não pode depender de a tela estar aberta.
- **Entra / sai:** tarefas enfileiradas pelo usuário; sai um relatório por tarefa, e o estado de cada uma na tela.
- **Estado:** **em disco**, sempre: estado da tarefa, contagem de voltas, log, o que já foi lido. Fechar o programa e abrir de novo tem que retomar.
- **Termina:** cada tarefa termina por relatório aprovado pelo Verificador, ou por teto de voltas, ou por cancelamento. **Sem timeout por tarefa** — três horas e quarenta voltas é um resultado válido; o cinto de segurança é a contagem, não o relógio.
- **Chama:** o agente principal da fila chama os mesmos subagentes do chat.
- **"Concluída" fala do processo, não do veredito.** Uma tarefa que roda até o fim e conclui "não dá para fazer, falta X" está concluída. Usar "concluída" como sinônimo de sucesso faz a tela mentir.
- → `13`.

### 7 · Rotina disparada por evento

- **Quando:** algo mudou no disco (ou numa fonte qualquer) e o programa precisa reagir sem ninguém clicar — regenerar documentação, reindexar, reclassificar.
- **Peças:** o **Detector** vê o que mudou e decide quais rotinas isso merece (às vezes a rotina é uma chamada ao modelo, às vezes é só uma conta); a **Espera** é o freio — segura N segundos sem mudança nova antes de liberar; o **Revezamento** é a vez na janela do modelo, uma só para o programa inteiro.
- **Estado:** a decisão do Detector gravada em disco (sobrevive ao programa fechar); pendências do ciclo, para retomar depois de falha.
- **Termina:** quando a fila de pendências zera. Cada rotina termina por **sinal de vida**, não por relógio: lento e morto são diferentes.
- **Chama:** rotinas em ordem de dependência.
- **Num projeto novo não há mudança para o Detector ver** — alguém tem que dar a partida. Por isso existe o botão "ativar tudo", e ele **enfileira**: com duas abas de projeto abertas, ligar a segunda não pode responder "já existe um ciclo rodando" e não fazer mais nada.
- → `14`.

### 8 · Ciclo de papéis fixos

- **Quando:** **a ordem dos passos já é conhecida.** Não se põe um agente principal para decidir o que já está decidido: é uma sequência fixa de papéis — ler, planejar, escrever, conferir, verificar, corrigir. O mesmo modelo em toda chamada; só o prompt muda; cada papel vê só o que precisa.
- **Entra / sai:** o material de entrada; sai o produto do último papel, com tudo o que passou por verificação marcado como verificado.
- **Estado:** o produto de cada papel, gravado — e o "em dúvida", que espera o usuário.
- **Termina:** no fim da sequência, ou por teto de tentativas em cada papel.
- **Chama:** o programa chama cada papel; nenhum papel chama outro.
- → `15`. É a forma que mais gente subestima, e a que dá o resultado mais previsível.

### 9 · Gerador criativo em rodadas

- **Quando:** o usuário quer **opções** e escolhe — variações de uma interface, de um texto, de um nome — e refina a escolhida.
- **Entra / sai:** o pedido e a escolha da rodada anterior; saem N variações, cada uma num quadro isolado.
- **Estado:** o histórico dividido em rodadas, navegável; a escolha de cada rodada.
- **Termina:** quando o usuário fica com uma.
- **No refino, o artefato é a memória.** Refinar a variação escolhida manda ao modelo **a variação atual** e o pedido de mudança — não o histórico das rodadas. O histórico é da tela, para o usuário navegar; não é do modelo: mandá-lo faz o modelo misturar versões descartadas com a escolhida, e paga tokens por texto que ninguém quer de volta. **O comentário do usuário vai por último**, depois do artefato (→ `10`).
- Exemplo: um programa que gera variações de tela a partir de estilos e paletas escolhidos antes do envio, mostra cada variação num quadro isolado (para o código gerado não vazar para a tela do programa), e guarda cada rodada com a sua escolha.

### 10 · Gerador em lote com slots paralelos

- **Quando:** N itens do mesmo tipo (fichas, descrições, nomes), muitos, com K em paralelo.
- **Entra / sai:** uma lista; sai um item por entrada, gravado conforme sai.
- **Estado:** **uma fila por categoria, com progresso em disco**; o que já foi gerado não se gera de novo; colisão com o que já existe → um prompt de reescrita, não descarte. Um programa tinha a fila numa variável só, e importar uma lista numa categoria fazia a mesma lista aparecer em outra — a tela dizia "50 prontos" onde não havia nenhum.
- **O cursor grava depois do lote, não antes:** o cursor gravado tem de significar "estes já passaram", ou retomar pula os que ficaram no meio.
- **"OK" vem depois de gravar, não depois de o modelo responder** — uma gravação que falha depois não teria como aparecer.
- **O desfecho de cada item fica guardado pelo nome pedido**, porque o modelo quase nunca devolve o nome igual ao pedido ("parafuso" vira "parafuso sextavado"), e procurar de novo por semelhança erra justamente nesses.
- **Tela:** uma grade de slots, um por chamada em voo, com status e tokens (→ `20`); a grade é sempre a do paralelo escolhido, nunca a do tamanho do lote (o último lote é menor, e remontar a grade por ele faz a tela "mudar sozinha"); "por que não pode iniciar" com nome.
- **Termina:** lista vazia — ou **pausa sozinha** depois de N falhas seguidas de conexão, porque uma fila que continua com o servidor caído queima a lista inteira em erro sem ninguém ver.
- Exemplo: um programa que gera fichas de um acervo em lote, com cinco filas independentes e uma grade de slots na tela.

### 11 · Ferramenta oferecida a um agente externo

- **Quando:** o programa é o **servidor**: um assistente de fora (um agente de código, por exemplo) chama ferramentas do programa para ler o que ele calculou.
- **Entra / sai:** chamadas de ferramenta com nome e argumentos; sai texto ou dados, em partes quando for grande.
- **Estado:** o artefato que a ferramenta serve, com a idade dele (a resposta avisa quando está velho).
- → `23`.

### Os nomes pela função

Um catálogo de agentes se lê pelo nome: **o nome diz o que o papel faz, e um papel tem uma função**. Dois exemplos reais, anonimizados:

| Um programa de código | Um programa de conhecimento (os papéis de um ciclo) |
|---|---|
| Buscador · Navegador · Leitor · Arquiteto · Analista · Semântico · Orientador · Organizador · Padronizador · Terminólogo — mais o Verificador, só da fila | Leitor · Planejador · Redator · Conferente · Verificador · Corretor · Intérprete · Descobridor |

Regras do catálogo: a lista canônica mora **num lugar só**, no backend, e a tela é sempre filtrada contra ela (uma configuração antiga gravada em disco não pode autorizar um nome que já não tem bloco no prompt nem implementação); nome de papel é validado por lista fechada (papel desconhecido é erro, não chamada); o mesmo nome nunca serve para duas funções, e uma função nunca tem dois nomes. Quando um nome muda, o antigo vira **proibido** no vocabulário do programa, com o motivo — senão ele volta. Papéis de outros domínios, com a função e as ferramentas de cada um, e a receita de como descrever e nomear: → `05`.

Tudo isto **depende do que se vai construir**. Um programa pode ter só as formas 1 e 2 e estar certo.

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| a resposta varia a cada geração num número que devia ser estável | o modelo está dando o resultado (c) onde devia ser (b) | o modelo classifica, o programa conta |
| o "agente" faz sempre os mesmos quatro passos, e às vezes pula um | agente principal onde a ordem já era conhecida | forma 8: sequência fixa de papéis |
| uma pergunta simples gasta dez idas ao modelo | chat ou laço onde bastava tiro único | forma 1 |
| a tarefa "concluiu" e o usuário acha que deu certo, mas o relatório diz que não dá | "concluída" lida como sucesso | o estado fala do processo; o veredito está no relatório |
| um projeto ligado nunca gera nada | a partida foi recusada em vez de enfileirada | enfileirar, nunca descartar (→ `14`) |
| a lista de uma categoria aparece em outra | uma fila só para várias categorias | uma fila por categoria, com o espelho da aberta |

### Checklist ao construir

- [ ] Para cada resultado do ciclo, está escrito quem dá: (a), (b) ou (c)?
- [ ] "Quem decide o próximo passo?" tem uma resposta só por forma?
- [ ] Toda forma que roda sozinha tem objetivo escrito, critério de parada do programa e teto?
- [ ] Toda forma com laço tem botão de parar?
- [ ] Toda forma com estado grava em disco e retoma?
- [ ] Os nomes dos papéis estão numa lista canônica, num lugar só, e a tela é filtrada contra ela?
- [ ] O que sai de cada papel é validado contra o conjunto real antes de entrar?

## O que a tela mostra

Cada forma tem os seus painéis (→ `20`), mas três coisas valem para todas: **qual forma está rodando agora**, com o nome do dono ("Fila · tarefa 3", "Ciclo 2 · tópico X"); **o botão de parar** onde houver laço; e **o que já foi lido ou gerado** enquanto roda, para o usuário não olhar para uma barra girando.

## O que fica salvo e configurável

Salvo: o estado de cada forma que tem estado (sessões, tarefas, pendências, rodadas, filas por categoria) — → `18`. Configurável: quais subagentes existem e com que ferramentas, tetos de rodadas e voltas, K em paralelo, N de tentativas e de leituras dos ciclos, N de falhas seguidas até pausar — → `21`.
