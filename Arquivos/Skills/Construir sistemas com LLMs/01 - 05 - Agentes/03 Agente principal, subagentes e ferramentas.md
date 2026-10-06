# 03 Agente principal, subagentes e ferramentas

## O que é e quando usar

O modelo que **decide** (o agente principal), os modelos que **executam uma pergunta fechada lendo coisas** (os subagentes), e o que eles têm nas mãos (as ferramentas). Use quando o pedido é aberto demais para um tiro único e precisa de leitura do mundo — arquivos, índices, bases — antes de responder.

A relação tem profundidade um: o agente principal chama subagentes; subagentes chamam ferramentas; ninguém chama para baixo de novo. Quando a ordem dos passos já é conhecida, não use isto — use um ciclo de papéis fixos (→ `15`).

É a peça com mais cintos de segurança, porque é a que mais gira em falso quando falta um: teto de rodadas, teto de voltas, rodada só-erro, correção, entrega parcial, parada em dois estágios, portão de contexto. Cada um existe por uma tarefa que girou sem sair do lugar.

Antes daqui: quem coordena quem e quem tem estado estão no `02`; o que decide se uma ferramenta ajuda ou atrapalha — quem recebe qual, limites de referência, respostas econômicas e honestas —, no `04`; o catálogo de papéis e como nomeá-los, no `05`. Esta peça fica com o laço visto de dentro: o subagente, a parada, a base das ferramentas, o agente principal.

## Como se constrói

### O subagente

- **Sem memória entre chamadas.** Recebe a pergunta, o system próprio dele, o catálogo de ferramentas que **ele** pode usar e o teto de rodadas; devolve estruturado. Cada chamada é uma conversa nova.
- **Dentro da chamada, um laço:** o modelo pede uma ou mais ferramentas (num JSON de chamada), o programa executa, devolve os resultados como uma mensagem, o modelo pede de novo ou responde. O histórico do laço acumula e mantém prefixo (→ `11`).
- **Rodada ≠ volta.** *Rodada* é uma ida ao modelo que consome orçamento; *volta* é qualquer ida, inclusive correção de formato e devolução. O teto de rodadas é o orçamento; o teto de voltas é o **cinto de segurança**, folgado de propósito — existe porque eram as idas *sem* rodada que faziam um laço girar sem o contador avançar. Nenhum dos dois é tempo.
- **Rodada em que todas as ferramentas falharam não consome orçamento.** O subagente não recebeu nada de útil; três erros seguidos esgotavam o limite e ele devolvia nada aproveitável. Mas há um teto próprio de rodadas só-erro, senão o laço é infinito. Cuidado com a comparação: um `>` onde devia ser `>=` fez o corte disparar só na quarta — quatro rodadas de erro pagas, e a mensagem dizendo "3 seguidas".
- **Rodada de correção** quando o JSON de chamada vem inválido (→ `10`): N tentativas, depois entrega parcial. Conta como volta, não como rodada.
- **O parse roda sobre uma cópia limpa; o histórico guarda o cru.** O JSON de chamada pode vir depois do raciocínio; procurá-lo no texto cru acha primeiro o rascunho que o modelo escreveu dentro do próprio pensamento. E um raciocínio aberto e nunca fechado deixa a cópia limpa **vazia** — confira isso antes do ramo de "resposta final", senão o vazio vira sucesso.
- **O teto de saída vai na chamada.** Um programa calculava o teto, reservava no portão, e usava só para cortar o texto **já recebido**: uma resposta de 12 mil tokens era gerada inteira, paga inteira, e jogada fora até 2 mil. Com o teto valendo no servidor, a resposta pode chegar cortada — e aí "terminou?" é conferido antes do parse (→ `10`).
- **Resposta cortada no teto de saída: uma vez pede "mais curto"; na segunda, encerra com o que foi lido.** Pedir de novo é gastar rodada com o mesmo resultado.
- **Entrega parcial é entrega.** Cortado no meio — pela parada, pelo portão de contexto, por resposta cortada, pelo teto — o subagente devolve **o que já leu**, com `erro` preenchido e `erro_tipo='parcial'`.
  - *Porquê:* um leitor gasta três rodadas lendo, acha o trecho certo na terceira e não tem a quarta para responder; jogar isso fora e devolver só a palavra ERRO fazia o agente principal perguntar a mesma coisa de novo — foi assim que uma tarefa girou 23 rodadas.
  - **Recolhe por bloco** (um por resultado de ferramenta), do mais recente para o mais antigo, e **corta por bloco**, não pelo texto concatenado — cortar o texto devolvia o começo (o oposto do motivo de o recurso existir) e partia um bloco ao meio.
  - **Nunca inclui linha de erro nem o aviso interno da última rodada** — sob o cabeçalho "o que encontrei", os dois seriam lidos como leitura bem-sucedida.
- **Entrega parcial não é resgate.** Resgate limpa uma resposta que o modelo **deu**; entrega parcial devolve leituras quando não houve resposta nenhuma. Dois nomes, duas coisas.
- **Esquema forçado não resolve "não achei nada".** Esquema garante o formato, não o conteúdo; o subagente que não achou, obrigado a preencher campos, escreve invenção com cara de resposta. A entrega parcial devolve o que foi lido de verdade.
- **Erro de caminho não é falha.** O navegador respondendo "essa pasta não existe" é exploração dando certo — chutar caminho é o trabalho dele. Por isso `erro_tipo` separa `'caminho'` (o subagente funcionou) de `'execucao'` (não conseguiu rodar), e só o segundo carimba a tarefa com "subagente indisponível". Uma ressalva que aparece em quatro de cinco relatórios deixa de significar alguma coisa.
- **O portão de contexto corta antes de estourar, e avisa.** Um subagente que enche a janela e recebe recusa do servidor perde a rodada inteira; cortado antes, responde com o que tem (→ `08`). Esperar no portão **antes de começar** é admissão, e nada se perde.
- **Tokens reais por chamada**, do `usage`, somados — é o que alimenta a barra de tokens do log. Um subagente que não usa modelo (o navegador de pastas) fica em zero, e mesmo assim passa pelo corte de tokens da resposta: uma pasta com nomes muito longos estoura a janela do mesmo jeito.

### A parada

- **Dois estágios:** "pare no fim da rodada em voo" e "corte agora". Só o segundo aborta uma requisição já paga; o primeiro deixa o pedido em voo terminar e não faz o próximo. **O porteiro desiste antes de pedir a próxima coisa, nunca no meio de uma requisição já paga** — é o que deixa o cancelar rápido sem contrariar a regra de não abortar trabalho pago.
- **O porteiro da parada é conferido em dois pontos só** — antes de cada pergunta ao modelo e antes de cada ferramenta — que são exatamente os dois lugares onde faz sentido desistir. Conferir num lugar só, que os dois chamam, faz os dois obedecerem sem que nenhum seja tocado.
- **A parada pedida é uma exceção própria**, nunca confundida com tempo esgotado. Caindo no genérico, a tela mostraria o nome de uma classe; caindo no de tempo, diria "excedeu o tempo limite" — mentira plausível, porque de fábrica a espera não tem teto nenhum.
- **O sinal de parada desce de cima** (o subagente não sabe de qual sessão ele é), e **o padrão é "ninguém me aborta"**: quem não passa o sinal nunca é abortado. É o que protege o Verificador da fila — que roda sozinho, fora do pool — de um Parar dado no chat.
- **O que já foi lido não se perde ao parar** — os cinco pontos de esgotamento devolvem a entrega parcial. Dois deles jogavam fora; o que morria ali morria depois de ter sido lido e pago.

### As ferramentas

- **Catálogo único com permissão por agente:** uma tabela nome → ferramentas permitidas, **igual no backend e na tela**. A tela lista o que o backend permite; se divergem, a tela mente. A taxonomia de "fontes" (código, documentação, bases normativas) também é uma só, dos dois lados.
- **Dispatcher único:** toda chamada de ferramenta passa por um ponto que valida o nome, a permissão e os argumentos antes de executar — e **registra no rastro de leitura**, inclusive os erros. Um programa tinha uma ferramenta que não passava pelo dispatcher, e os erros dela nunca chegavam ao rastro: o agente principal repetia o mesmo caminho errado rodada após rodada sem nada lembrá-lo.
- **Rastro de leitura:** uma conta corrente por **tarefa** (a mensagem do usuário sendo respondida), compartilhada pelas rodadas dela, para não reler e para a entrega parcial saber o que devolver. O que volta ao modelo é **só o que serve à próxima decisão**: as partes já lidas e os erros, com a conta feita ("lidas 84 de 120; faltam 36"), **em no máximo oito linhas**. Os erros vão agrupados por ferramenta, alvo e motivo, os mais repetidos primeiro, com "(N×)", e o que passar de oito linhas vira "e mais K". Porquê: a lista crua de tudo o que foi lido e tentado crescia a cada rodada; o modelo não fazia a conta sozinho e voltava a pedir o que já tinha — com a conta pronta, ele pede o que falta. Sem o rastro, o subagente relê as mesmas partes a cada devolução e o laço não fecha. É esse o bloco-resumo que o programa substitui a cada rodada (→ `02`).
- **Permissão de escrita: a IA só grava na pasta dela.** Toda ferramenta que escreve aponta para uma pasta própria do modelo; o resto do disco é do programa e do usuário. Um programa deu ao modelo uma única função de gravar, e ela grava exclusivamente em `Da IA/`.
- **Toda ferramenta tem teto de itens e de tokens na resposta** — inclusive as que não usam modelo.
- **Ferramenta que lê artefato gerado sabe a idade dele** e avisa quando está velho (→ `23`).
- **Contrato de cada ferramenta:** nome; o que faz em uma frase; entrada (argumentos com tipo); saída; o que é erro e o que é "não achei" (não é erro). Formato de dado, o único código literal desta skill:

```json
{"ferramenta": "ler_arquivo", "argumentos": {"caminho": "src/utilitarios.txt", "linhas": "40-120"}}
```

```json
{"ferramenta": "ler_arquivo", "ok": true, "conteudo": "…", "tokens": 812}
{"ferramenta": "ler_arquivo", "ok": false, "erro_tipo": "caminho", "erro": "não existe: src/utilitario.txt"}
```

- **Lista fechada de papéis por contexto** (chat, fila, prova…), com o nome validado por regra fixa (minúsculas, dígitos, sublinhado): papel desconhecido é **erro**, não chamada. A lista canônica — e a ordem em que os blocos entram no system — mora num lugar só; a lista que vem da tela é sempre filtrada contra ela.
- **Ferramenta sem modelo é ferramenta.** Listar uma pasta, contar tokens, conferir se um arquivo existe — é o caso (a) do `01`: não gaste modelo onde há função.
- **Um teto de rodadas diferente para quem precisa — e o de quem confere é maior**, lido pela chave de **quem está rodando**. Conferir custa mais chamadas que responder: cada afirmação do relatório é uma leitura. Um programa tinha dado ao conferente o teto menor ("ele confere, não explora"), e ele devolvia, por falta de rodadas, o que não tinha conseguido ler. A referência: 3 rodadas para quem responde, 5 para quem confere (→ `04`).

### O agente principal

- **Quem decide quais subagentes entram e em que ordem** — e a decisão é dele, do modelo, a cada rodada. O programa impõe os cintos: teto de rodadas, teto de voltas, a lista do que está ligado.
- **Onde fica salvo:** a lista de subagentes ligados é por sessão e trava depois da primeira mensagem (→ `12`).
- **As ferramentas dele próprio, quando o caso pede.** Há pedidos em que delegar é desperdício (uma leitura pequena) e pedidos em que ele precisa **dividir o trabalho** antes de mandar (partir uma lista em lotes). Decida por programa: um agente principal com ferramentas próprias é um subagente com poder de chamar outros, e o teto de rodadas dele conta as duas coisas.
- **Chamadas em paralelo com admissão.** Várias chamadas do mesmo envelope rodam em paralelo, e **um portão de contexto compartilhado pelo lote** decide quantas cabem na janela ao mesmo tempo (→ `08`). O resultado volta na ordem das chamadas, uma mensagem `[RESULTADO — nome]` por chamada. O sinal de parada desce a cada thread do pool.
- **O aviso da última rodada é uma ordem endereçada ao subagente** ("responda agora com o que você tem"); ele viaja colado no bloco e não pode chegar ao agente principal apresentado como conteúdo lido.
- **O agente principal não vê o system dos subagentes**, e os subagentes não veem o histórico do chat — cada um recebe o recorte dele (→ `15`, "cada papel vê só o que precisa").
- **Quando o programa recusa um pedido do modelo, diz o que aconteceu — não repete a ordem.** "A chamada foi recusada: o subagente X não está ligado nesta sessão" ensina; repetir "use só os subagentes da lista" não. Se o modelo insiste, a próxima mensagem avisa que a próxima recusa encerra; na segunda insistência, encerra com o que tem. Porquê: a ordem repetida vira ruído que o modelo já ignorou uma vez; o fato novo ele usa.
- **A pergunta do agente principal chega ao subagente rotulada** — `[PERGUNTA DO AGENTE PRINCIPAL — nome]` —, e o system do subagente diz que essas mensagens **não foram escritas pelo usuário**. Porquê: sem o rótulo, o subagente trata a pergunta do principal como pedido do usuário, e responde a quem não perguntou.

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| uma tarefa girou 23 rodadas | leituras jogadas fora ao esgotar; o principal perguntava de novo | entrega parcial é entrega |
| o laço gira e o contador de rodadas não avança | idas sem rodada (correção, devolução) sem cinto | teto de voltas |
| três erros de ferramenta esgotam o orçamento | rodada só-erro consumindo | rodada só-erro não consome; teto próprio |
| o principal repete o mesmo caminho errado | ferramenta fora do dispatcher, erro fora do rastro | dispatcher único registra tudo |
| `[RESULTADO]` vazio apresentado como sucesso | raciocínio nunca fechado; vazio caiu no ramo de resposta | conferir vazio antes do ramo final |
| resposta de 12 mil tokens paga e jogada fora | teto de saída não passado ao servidor | teto na chamada |
| "excedeu o tempo limite" quando o usuário parou | parada caindo na exceção de tempo | exceção própria de parada |
| o Parar do chat derrubou o Verificador da fila | sinal sem dono | "ninguém me aborta" por padrão |
| "subagente indisponível" em quatro de cinco relatórios | erro de caminho contado como falha | `caminho` ≠ `execucao` |
| campos preenchidos com invenção quando não achou | esquema obrigatório | opcional + `erro`; entrega parcial |
| o modelo grava onde não devia | ferramenta de escrita sem pasta própria | a IA só grava na pasta dela |

### Checklist ao construir

- [ ] O subagente é sem memória, com system próprio, catálogo permitido e teto de rodadas?
- [ ] Rodada e volta são contadas separadas, com tetos separados, e nenhum é tempo?
- [ ] Rodada só-erro não consome, com teto próprio e comparação certa?
- [ ] O teto de saída vai na chamada, e "terminou?" é conferido antes do parse?
- [ ] A entrega parcial existe, recolhe por bloco, e exclui erros e o aviso interno?
- [ ] `erro_tipo` distingue parcial, caminho e execução, e só execução carimba a tarefa?
- [ ] O porteiro da parada é conferido em dois pontos, com exceção própria, sinal descendo de cima e "ninguém me aborta" por padrão?
- [ ] Catálogo de ferramentas igual no backend e na tela; dispatcher único; rastro por tarefa?
- [ ] Toda ferramenta tem contrato, teto de itens e tokens, e as de escrita só gravam na pasta da IA?
- [ ] A lista de papéis é fechada, validada, num lugar só, e a tela é filtrada contra ela?
- [ ] O rastro devolve só as partes lidas e os erros agrupados, com a conta feita, em até oito linhas?
- [ ] O teto de quem confere é maior que o de quem responde?
- [ ] A recusa diz ao modelo o que aconteceu, e a pergunta do principal chega rotulada?

## O que a tela mostra

- **Painel de subagentes:** qual existe, em que ordem, com que ferramentas e com que teto — agrupado, filtrável, **e ligado à configuração** (→ `20`, `21`). E **qual está rodando agora**.
- **Log por chamada:** subagente, pergunta, rodadas usadas, tokens reais, `erro_tipo`.
- **Parar**, com os dois estágios, alcançando todas as chamadas em voo.
- **Erros por item**, com a frase certa para cada tipo (parcial, caminho, execução, cortada, formato).
- **"Retomar"** para a chamada que o teto barrou.

## O que fica salvo e configurável

- **Salvo (→ `18`):** o rastro de leitura por tarefa; os resultados por chamada; a pasta própria da IA; os subagentes ligados por sessão.
- **Configurável (→ `21`):** ferramentas permitidas por subagente; teto de rodadas e de voltas (com o do Verificador separado); teto de rodadas só-erro; tetos de itens e tokens por ferramenta; N de correções; máximo de chamadas em paralelo por lote.
