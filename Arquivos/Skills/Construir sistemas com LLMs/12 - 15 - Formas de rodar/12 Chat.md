# 12 Chat

## O que é e quando usar

A conversa em que **o usuário decide o próximo passo**. É a forma certa quando o pedido é aberto e a saída é lida por gente — e a forma errada para trabalho de horas (→ `13`) ou para passos já conhecidos (→ `15`). Um chat pode ter subagentes por dentro; aí o modelo vira agente principal entre uma mensagem e outra, e as regras do `03` valem junto com estas.

O chat é a peça em que mais coisas acontecem ao mesmo tempo — streaming, subagentes em paralelo, a tela pintando, o usuário trocando de sessão — e por isso é onde mais aparece o erro de "o que está na tela não é o que está no disco".

## Como se constrói

### Sessões

- **Sessões em disco, uma pasta por sessão, lista lateral para abrir e criar.** O histórico de cada sessão é gravado **cru** (→ `11`).
- **Título automático a partir da primeira pergunta**, com a **mesma regra de corte** na tela e no backend (um título que muda sozinho ao recarregar parece defeito) — e o título é **decidido e gravado juntos**, no mesmo passo. Um programa decidia o título na memória e gravava no fim do turno: qualquer remontagem da lista durante a resposta (clicar noutra sessão, sair e voltar da aba) relia o disco e trazia "Novo chat" de volta.
- **Trocar de sessão no meio de uma resposta é permitido** — e o log da outra sessão não recebe o que está acontecendo nesta: a tela só pinta se a sessão aberta for a dona do envio. O identificador da sessão precisa ser **único entre projetos**: um programa usava a hora de criação como id, dois projetos tinham sessões com o mesmo id, e os pedaços da resposta de um apareciam na conversa do outro.
- **Todo evento do chat para a tela leva o projeto junto**, por um funil único. Um programa tinha 28 lugares mandando o projeto no payload e o chat era a única ponta que não mandava — protegido só por acidente pela trava global. Regra: um funil, e o projeto é argumento obrigatório.
- **Apagar uma sessão que está respondendo é recusado** — e a recusa precisa saber **qual** sessão está respondendo, não só "o chat está ocupado".

### O que vai em cada envio

- **A ordem fixa** do `11`: system → prompts fixos e contexto inicial → histórico → regras → prompt fixo → mensagem nova.
- **Contexto inicial escolhido antes da primeira mensagem** (arquivos, pastas, bases), com uma **barra de tokens** que já inclui o system — um chat novo que mostra zero token está mentindo, porque o system vai sempre.
- **Um bloco de contexto que falha ao montar não é engolido.** Um programa tinha `except: pass` na montagem: o usuário marcava a caixa, via os tokens entrarem na conta, e o bloco não ia — e o modelo respondia como se aquele arquivo não existisse. O erro vai para o log e para a tela, **e o modelo também precisa saber** (uma linha "o arquivo X não pôde ser lido").
- **Payload visível e copiável antes de enviar**, calculado pela **mesma função** que o backend usa para montar o envio. É a aba "Contexto": o usuário vê exatamente o que o modelo vai receber, e pode copiar para usar fora. E ela é atualizada **no meio** da resposta, a cada rodada — era a única das três abas que só se montava no fim, e quem estava com ela aberta via um envio congelado e concluía que a montagem tinha falhado. Sem gravar em disco a cada rodada: isso é tela; a gravação continua uma vez, no fim.
- **Prompts fixos** (uma persona, uma tarefa recorrente, uma regra de estilo) escolhidos por checkbox — e **travados depois da primeira mensagem**, junto com o contexto inicial. Quem quer outros abre outra sessão.

### Quando há subagentes

- **Três systems em jogo:** o system do agente principal (com o mapa "para X, chame Y") + **um bloco por subagente ligado** ("este agente está disponível e faz X"), montados no envio; e o **system próprio de cada subagente**, usado só na chamada dele. O agente principal nunca vê o system do subagente, e vice-versa.
- **Ligar e desligar subagentes trava depois da primeira mensagem** — mudar a lista muda o prefixo inteiro. A lista fica **salva por sessão**, e é filtrada contra a lista canônica ao carregar.
- **Com nenhum subagente ligado, o system é outro arquivo** — o "sem subagentes" (→ `10`).
- **O agente principal responde em prosa com um envelope** só para as chamadas; a tela mostra a prosa e esconde o envelope (→ `10`). Os resultados voltam como mensagens `[RESULTADO — nome]`, uma por chamada, e o laço continua até o modelo responder sem pedir mais — ou até o teto de rodadas.
- **Uma conta corrente de leitura por tarefa** — a mensagem do usuário sendo respondida, com todas as rodadas dela. Sem ela, o subagente relê as mesmas partes a cada devolução e o laço não fecha (→ `03`, rastro de leitura).
- **Uma chamada que o teto barrou pode ser executada depois, por clique** ("retomar"): a chamada fica visível, e o usuário decide se vale mais uma rodada.
- **A lista lateral mostra qual subagente está sendo chamado agora**, e o log da sessão mostra cada chamada com o seu consumo de tokens. O usuário precisa ver o trabalho acontecendo, não só a resposta final.

### Streaming e parada

- **Resposta em streaming**, pedaço a pedaço na tela; o envelope JSON é separado da prosa **na renderização**, não no histórico.
- **O pedaço que está chegando vive fora do histórico** até terminar: o histórico só recebe a fala do modelo quando ela termina — e é justamente o caso em que ela não terminou que a gravação de emergência precisa cobrir.
- **Parar em dois estágios:** "pare no fim da rodada em voo" (o que já foi pedido termina; o laço não pede mais) e "corte agora" (fecha o stream — sem fechar, o servidor continua gerando). O sinal de parada desce até os subagentes em voo (→ `06`). A bandeira zera na largada e limpa em qualquer saída.
- **Gravação de emergência.** A gravação normal é a última coisa do envio; qualquer falha antes dela — servidor caindo, modelo descarregado, programa fechado — apagaria a pergunta que o usuário acabou de escrever, porque o campo já foi esvaziado no clique. A gravação de emergência salva o que existe: a pergunta e as rodadas que chegaram a fechar.
  - **O pedaço de resposta pela metade não entra como resposta** — gravá-lo o apresentaria como inteira; com a marca de parcial, pode.
  - **Roda dentro de um `except` e nunca levanta** — senão substituiria o erro real por um erro de disco.
  - *Detalhe que já quebrou:* as variáveis que ela lê precisam existir **antes** do `try` — senão o próprio `except` levanta, e a gravação não acontece justamente no caso em que é necessária.
- **Grava antes de avisar a tela.** A ordem "avisa a tela, depois grava" perde a gravação se o aviso estourar (a janela pode ter fechado).
- **Retomar rodadas** depois de uma queda usa **o mesmo código** do envio normal. Um programa tinha os três blocos (cliente, log, stream) escritos duas vezes, "funcionalmente idênticos e textualmente diferentes" — consertar um lado deixava o outro com o defeito, mais de uma vez.
- **Retomar não é reenviar.** Retomar executa as chamadas que o teto barrou e ficaram gravadas, **sem remontar o system** — o prefixo continua o mesmo —, com o contador de rodadas continuando de onde estava; o teto novo vem num aviso na cauda. Reenviar a pergunta pagaria de novo as rodadas que já foram feitas. E um carimbo "em andamento" vai ao disco **antes** da operação longa, para quem sai da tela e volta não ver a mesma oferta de "retomar" de novo.
- **A trava global é tomada no envio inteiro, e aqui ela recusa em vez de esperar** — recusar é honesto quando há gente na frente da tela: uma mensagem pendurada meia hora esperando a fila seria pior que "não dá agora, é por isto" (→ `08`). E ela solta em qualquer saída, inclusive quando a thread do envio nem chegou a nascer.
- **Atualizações de tela falham em silêncio, de propósito.** A janela pode ter fechado no meio; derrubar a thread de uma resposta paga por causa de uma atualização de painel seria trocar um defeito visual por um erro de verdade.

### O envio visto da tela

- **O dono do envio é guardado antes do primeiro `await`.** Ler "qual sessão está aberta" depois de sete idas ao backend mandava a mensagem para a sessão que o usuário tinha acabado de abrir. E quando duas pinturas disputam o mesmo lugar — a estimativa de tokens e o uso real —, um **número de geração** decide: a última a começar ganha; senão a estimativa lenta sobrescreve o número real.
- **Tudo o que o início do envio liga é desligado em todas as saídas** — sucesso, erro, recusa —, e, no erro, só se o erro for daquele dono. Esquecer uma saída deixou "Respondendo" aceso para sempre, o botão preso em "Parando…" e o contexto inicial nunca mais enviado; desligar o que era de outro dono reenviou contexto duplicado.
- **Leia a resposta de quem inicia a geração.** Se o início foi recusado — a vez é de outro, a sessão está ocupada —, nenhum evento de fim vai chegar, e a tela esperando por ele fica "pensando" até reiniciar o programa. Recusado: a tela volta ao estado de antes, e **o texto digitado volta ao campo**.
- O resto da tela de uma geração — o funil de eventos, a ponte com a tela, o "pensando", a barra de tokens, a rolagem — está no `20`.

### O que o chat não é

- Não é fila: uma pergunta que precisa de quarenta idas ao modelo vai para a fila, com estado em disco e relatório.
- Não é lugar de esquema forçado na resposta ao usuário — a prosa é livre; o esquema é só do envelope e dos subagentes.
- Os prompts fixos do chat são para conversa curta; os da fila são outros (→ `13`). "Revisar a janela inteira" significa uma coisa no chat e outra na fila.

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| a resposta de um projeto aparece no chat de outro | evento sem projeto; id de sessão não único | funil único com projeto; id único entre projetos |
| o título volta a "Novo chat" ao trocar de aba | título decidido sem gravar | decidir e gravar juntos |
| a pergunta some depois de uma queda do servidor | gravação só no fim | gravação de emergência, antes de avisar a tela |
| a resposta pela metade aparece inteira ao reabrir | parcial sem marca | marca de parcial |
| o modelo ignora um arquivo marcado | bloco falhou em silêncio | erro na tela, no log e no prompt |
| a aba Contexto mostra um envio congelado | só montada no fim | atualizada a cada rodada, sem gravar |
| um chat novo mostra zero token | system fora da conta | o system vai sempre; conta desde o início |
| o mesmo defeito voltou depois de consertado | envio e retomada em código duplicado | uma função |
| o Parar do chat derrubou a verificação da fila | sinal de parada sem dono | o padrão é "ninguém me aborta"; o sinal desce só para quem é da sessão |

### Checklist ao construir

- [ ] Sessões em disco, id único entre projetos, título decidido e gravado juntos?
- [ ] Todo evento para a tela passa por um funil e leva o projeto?
- [ ] A ordem do envio é a do `11`, e a aba Contexto usa a mesma função do envio, atualizada a cada rodada?
- [ ] Contexto inicial, prompts fixos e subagentes travam depois da primeira mensagem?
- [ ] Bloco de contexto que falha vai para a tela, o log e o prompt?
- [ ] Parar em dois estágios, sinal descendo aos subagentes, bandeira zerada na largada e limpa na saída?
- [ ] Gravação de emergência dentro do `except`, com variáveis criadas antes do `try`, e grava antes de avisar a tela?
- [ ] Envio e retomada usam o mesmo código?
- [ ] A trava global é tomada no envio inteiro, recusa com motivo, e solta em qualquer saída?
- [ ] O dono é guardado antes do primeiro `await`, e tudo o que o envio liga é desligado em todas as saídas?
- [ ] Retomar executa o que ficou gravado, sem remontar o system nem reenviar a pergunta?

## O que a tela mostra

- **Lista lateral de sessões**, com a ativa marcada e o subagente em execução ao lado.
- **Aba Contexto:** o payload do próximo envio, com o system, a contagem por parte e o botão de copiar — viva durante a resposta.
- **Barra de tokens** e **indicador do modelo** (→ `06`).
- **Checkboxes de contexto inicial, prompts fixos e subagentes** — desabilitados depois da primeira mensagem, com a frase "travado depois da primeira mensagem; abra outra sessão para mudar".
- **Log da sessão:** cada chamada a subagente, com pergunta, tempo e tokens; a mensagem do usuário aparece primeiro.
- **Parar**, com os dois estágios; **retomar** para a chamada que o teto barrou.
- **Botão de enviar apagado com o motivo** quando outra ponta está com o modelo (→ `08`).

## O que fica salvo e configurável

- **Salvo (→ `18`):** as sessões (histórico cru, título, subagentes ligados, prompts fixos, contexto inicial); o log de cada sessão; o uso por chamada; o contexto enviado, uma vez por envio.
- **Configurável (→ `21`):** os prompts fixos disponíveis; quais subagentes existem e com que ferramentas; o teto de rodadas por envio; a política de saída (os dois interruptores); a regra de corte do título.
