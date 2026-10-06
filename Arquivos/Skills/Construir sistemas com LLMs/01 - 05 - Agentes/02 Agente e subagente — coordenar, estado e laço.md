# 02 Agente e subagente — coordenar, estado e laço

## O que é e quando usar

Duas palavras aparecem em quase todo arquivo desta skill: **agente** e **subagente**. Aqui está o que elas querem dizer, e a anatomia que toda forma com mais de uma ida ao modelo compartilha: quem coordena, quem é coordenado, quem guarda estado, o que se mantém entre uma volta e outra do laço e o que se descarta no fim — e o laço, passo a passo.

Use quando for desenhar qualquer peça com mais de uma chamada ao modelo. O `01` diz **qual forma** usar; este arquivo diz **como as partes de dentro se relacionam**. As ferramentas estão no `04`; o catálogo de papéis e como nomeá-los, no `05`; o laço visto por dentro do agente principal — rastro de leitura, entrega parcial, parada —, no `03`.

## Como se constrói

### Coordenar × ser coordenado

- **Agente é quem coordena; subagente é quem é coordenado — e um subagente sempre tem quem o coordene.** O coordenador pode ser um agente principal (o modelo decide chamá-lo) ou o próprio programa (a ordem está no código). Um "subagente" sem coordenador não é subagente: é um tiro único, ou um agente sozinho.
- **As combinações:**

| | sem ferramentas | com ferramentas |
|---|---|---|
| **sozinho** (ninguém abaixo dele) | tiro único, ou chat puro: o modelo responde do que recebeu | agente com laço de ferramentas: lê e responde — é a forma 4 do `01` quando alguém o chama, e um assistente de uma pergunta quando é o usuário que chama |
| **com subagentes** | agente principal que só delega: pede, lê o que voltou, escreve | agente principal com ferramentas próprias: faz o pequeno ele mesmo, delega o grande, divide o trabalho antes de mandar |

  Decida a célula por programa — não há regra geral. Mas cada passo para a direita ou para baixo acrescenta teto, rastro e parada; por isso não se sobe de célula "por via das dúvidas".
- **Coordenado pelo modelo × coordenado pelo programa.** Pelo modelo: o agente principal escolhe quem chamar, quando e com que pergunta (o chat com subagentes, a fila). Pelo programa: a ordem está no código, e o modelo, em cada passo, só responde (o ciclo de papéis fixos, a rotina, o Verificador). A pergunta que decide é a do `01`: a ordem já é conhecida?
- **Quem confere nunca é escolhido pelo modelo.** O conferente é disparado pelo programa quando há o que conferir. Se o modelo escolhesse, ele deixaria de chamá-lo justamente quando mais precisa.
- **Profundidade um.** Subagente não chama subagente. Porquê: com dois níveis, o teto de rodadas de um multiplica o do outro, e a parada precisa descer por dois conjuntos de chamadas em voo.

### Quem tem estado

| Forma | O que recebe a cada chamada | O que se mantém durante o laço | O que sobra no fim |
|---|---|---|---|
| **tiro único** | system + o material | — | a resposta |
| **subagente** | system + a pergunta | o histórico do laço (pedido de ferramenta → resultado → pedido), dentro desta chamada | só a resposta sobe; o laço é descartado |
| **papel de ciclo** | system + o recorte do material que ele pode ver | o mesmo do subagente, se tiver ferramentas | a saída do papel, gravada pelo programa |
| **gerador iterativo (refino)** | system + o artefato atual + o pedido de mudança | — | o artefato novo — **o artefato é a memória** (→ `01`) |
| **chat** | system + o histórico do disco + a mensagem nova | o histórico inteiro, recarregado do disco a cada envio | o histórico cresce; nada se reescreve (→ `11`) |
| **tarefa de fila** | system + o histórico da tarefa | o histórico da tarefa e os contadores — rodadas, voltas, orçamento —, que sobrevivem a fechar e reabrir | o relatório; o histórico fica com a tarefa |

- **"Sem estado" quer dizer "sem estado entre chamadas".** Dentro da chamada, o laço acumula — e esse acumulado mantém o prefixo que o servidor reaproveita (→ `11`). No fim do laço ele é descartado; o que sobe é só a resposta.
- **Quem lembra pelo agente sem estado é o programa.** Um subagente chamado de novo, na mesma tarefa, não sabe o que leu na chamada anterior. Quem lembra é o programa, com **um bloco-resumo por tarefa**: as partes já lidas e os erros, com a conta feita ("lidas 84 de 120; faltam 36"), **substituído a cada rodada — nunca acumulado**. Porquê: um programa tinha um subagente que relia as mesmas partes a cada devolução, porque ninguém lembrava por ele, e o laço não fechava; e um bloco acumulado cresce a cada rodada até ocupar a janela que devia ir ao conteúdo — substituído, ele tem o mesmo tamanho na rodada 3 e na 30. O formato do bloco está no `03`, "Rastro de leitura".
- **O histórico vai cru**, com o raciocínio dentro (→ `06`); **o que é estável vem primeiro e o que varia no fim** (→ `11`); e **metadado do programa** — id da chamada, hora, marca de parcial — **mora num campo que nunca vai ao modelo**.

### O laço, passo a passo

1. **Antes de chamar:** o porteiro confere se foi pedida parada; a vez na janela é pedida ao portão (→ `08`); os tetos de rodadas e de voltas são conferidos.
2. **Chamar o modelo** com o histórico do laço e, na cauda, o bloco-resumo do programa.
3. **Terminou?** O motivo de término é lido antes de qualquer parse; cortada é tamanho, não formato (→ `10`).
4. **Ler a resposta:** o parse roda numa cópia limpa do raciocínio (→ `06`). É resposta final ou pedido de ferramenta?
5. **Resposta final:** o conteúdo é validado contra o conjunto real, e sobe. Fim.
6. **Pedido de ferramenta:** o porteiro confere a parada de novo; o dispatcher valida nome, permissão e argumentos; as ferramentas rodam em paralelo, até o teto por rodada (→ `04`); cada resultado entra no histórico como mensagem nova, no fim.
7. **Contar:** rodada que avançou consome orçamento; rodada em que todas as ferramentas falharam não consome, mas conta no teto próprio de rodadas só-erro; correção e devolução contam como volta (→ `03`).
8. **Atualizar o bloco-resumo** — substituir, não acrescentar — e voltar ao passo 1.
9. **Saídas sem resposta** — teto, parada, portão, cortada duas vezes —: todas devolvem a **entrega parcial** (→ `03`), nunca nada.

- **Toda saída do laço grava o que houver, e as variáveis que a gravação lê nascem antes do laço.** Porquê: um programa tinha dezessete saídas num laço, e a mais provável delas — o servidor caindo no meio de trinta rodadas — era a única que não gravava nada.

### Laço entre agentes

- **Quando um agente aciona outro, e o outro pode acionar de volta, o laço tem teto de rodadas.** Uma mensagem do usuário zera a conta — é gente de volta ao comando. No teto, **os dois lados recebem o motivo**, escrito; senão cada um acha que o outro parou de responder. Porquê: dois agentes que se passam trabalho sem teto não terminam, e quem para sem motivo parece defeito.
- **O conferente não recebe as ferramentas de quem pesquisa.** Com as de descobrir, ele vira um segundo pesquisador — e voltam dois agentes discutindo entre si. Ao conferente, só ler e buscar o que foi citado (→ `04`).

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| a cada devolução, o subagente relê as mesmas partes | ninguém lembra pelo subagente | bloco-resumo por tarefa, feito pelo programa |
| o bloco-resumo cresce até encher a janela | acrescentado a cada rodada | substituído a cada rodada, tamanho constante |
| o conferente vira pesquisador e o laço não fecha | ferramentas de descobrir no conferente | conferente só lê e busca o citado |
| o conferente não roda quando mais precisava | o modelo escolhe quando conferir | o programa dispara o conferente |
| a tarefa caiu e não gravou nada | uma das saídas do laço sem gravação | toda saída grava; variáveis nascem antes do laço |
| dois agentes se acionam sem fim | laço entre agentes sem teto | teto; a mensagem do usuário zera; os dois lados recebem o motivo |
| subagente chamando subagente | profundidade dois | profundidade um |

### Checklist ao construir

- [ ] Cada peça tem a sua célula decidida — sozinho ou com subagentes, sem ou com ferramentas?
- [ ] Para cada subagente está escrito quem o coordena — o modelo ou o programa —, e o conferente é disparado pelo programa?
- [ ] A tabela "quem tem estado" tem a linha de cada forma do programa?
- [ ] Quem lembra pelo agente sem estado é o programa, com um bloco-resumo substituído a cada rodada?
- [ ] O laço segue os passos, e toda saída dele grava o que houver?
- [ ] Todo laço entre agentes tem teto, zera com a mensagem do usuário e avisa os dois lados?

## O que a tela mostra

- **Quem coordena quem**, no painel de subagentes (→ `20`): o coordenador em cima, os coordenados embaixo, e ao lado de cada um "chamado pelo modelo" ou "disparado pelo programa".
- **Durante o laço:** a rodada atual, o subagente em execução, e quanto sobra do orçamento.
- **No teto de um laço entre agentes:** o motivo, nos dois lados.

## O que fica salvo e configurável

- **Salvo (→ `18`):** o histórico de cada forma que tem estado (a última coluna da tabela); o rastro de leitura por tarefa, de onde o bloco-resumo é recalculado (→ `03`).
- **Configurável (→ `21`):** tetos de rodadas e de voltas por agente, com o de quem confere separado; o teto do laço entre agentes.
