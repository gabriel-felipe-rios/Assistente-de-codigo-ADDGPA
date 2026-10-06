# 08 Contexto, tokens e limites

## O que é e quando usar

A conta que decide o que cabe. Todo programa com modelo local tem **uma** janela de contexto, e tudo o que se manda — prompt fixo, contexto, histórico, mensagem, e a resposta que ainda vai vir — divide o mesmo espaço. Esta peça é a que impede o servidor de responder "contexto excedido" no meio de uma tarefa de duas horas, e a que faz a tela dizer a verdade sobre quanto cabe.

Vale para toda forma de agente. Quem constrói um chat, uma fila, uma rotina ou um lote passa por aqui antes de mandar a primeira mensagem. E é aqui que mora a trava que faz o programa inteiro funcionar com um modelo só: o **Revezamento**.

## Como se constrói

### Contar

- **Tokens contados por tokenizador — nunca palavras × fator nem caracteres ÷ 4 — e o valor real é o do servidor.** Duas fontes, cada uma com o seu uso: um **tokenizador local** (uma dependência pequena) para o que precisa do número **antes** de enviar — orçamento, portão de admissão, barra da tela —, sabendo que ele **é uma aproximação**: quase nunca é o tokenizador do modelo em uso (±10 % é o normal), e sem ele a queda é caracteres ÷ 3,5, marcada como estimativa; e o **uso real** que a resposta traz — **esse é o valor verdadeiro** — para o que pode saber **depois**: métricas, custo, cobertura, a barra depois do envio. Porquê: a razão palavras × 1,3 acabou num programa no dia em que a tela mostrou uma conta que não batia com a do servidor, e ninguém sabia qual estava certa. Rodapé: se não houver nem tokenizador nem servidor, o número vai para a tela marcado como estimado — e a tela diz quantas chamadas cada fonte cobriu.
- **Cortar por token, com o mesmo tokenizador que conta.** O corte fatia a lista de tokens e volta a texto pelo mesmo codificador; o que sobra cabe exatamente no teto. Contar por um método e cortar por outro faz os dois discordarem sobre o que cabe.
- **Quem monta o prompt e quem o confere usam a mesma conta** — a mesma função. Duas contas divergem, e a conferência passa a barrar o que a montagem deixou passar (ou o contrário).
- **Código é mais denso que prosa.** Parênteses, pontos, indentação e sublinhados viram tokens próprios. Se alguma conta aproximada existir, ela é diferente para código e para texto corrido.
- **Precisão de ±10 % basta para "não estourar"**; não basta para auditoria de custo — aí é o `usage` real.

### Orçar

- **Orçamento por requisição, calculado de trás para a frente:** janela − prompt fixo − esqueleto da resposta − teto de saída − margem = o que sobra para o conteúdo. O prompt e o esqueleto são **medidos na hora**, não chutados; o teto de saída é imposto na chamada, então é garantido, não esperança. Devolva o detalhamento, para a tela mostrar a conta.
- **Os tetos da janela em %, derivados, nunca gravados.** Teto de entrada, teto de saída e margem são porcentagens da janela (referência de um programa: 45 % entrada, 17 % saída, 20 % margem), e o número em tokens é **calculado na hora** sobre a janela lida do servidor — gravar o número em tokens faz o teto valer para o modelo de ontem. A janela é campo só de leitura na tela. **A margem existe porque encostar no limite exato é o mesmo que estourar.**
- **Cada etapa mede o limite na própria entrada e tem o próprio % da janela.** Um número global não serve: a documentação de um arquivo, o resumo de uma pasta e uma resposta de chat têm fontes de tamanho diferente, e um teto único é largo demais para uma e apertado demais para outra. Um programa corrigiu isso três vezes antes de separar.
- **Piso:** abaixo de um mínimo de conteúdo não vale a pena tentar — o item é grande demais para a janela configurada e deve ser reportado como pulado, não enviado pela metade.
- **Teto de saída: existe, é conhecido, e é dimensionado pela tarefa.** Ele pode ser imposto na chamada ou ser o do servidor — mas alguém tem que saber qual é, porque uma resposta que passa dele chega cortada. A regra: um teto por tipo de tarefa, imposto onde for imposto, e **resposta cortada detectada pelo motivo de término, nunca lida como erro de formato** (→ `10`).
  - *Caso real, em duas direções opostas:* um programa calculava o teto, reservava no orçamento e **não o passava ao servidor** — uma resposta de 12 mil tokens era gerada inteira, paga inteira, e jogada fora até 2 mil. Outro pôs um teto único de 2 mil em tudo, e ele cortou uma lista legítima de dezenas de itens, lida depois como "JSON inválido". Nem teto ausente, nem teto único.
- **Teto de saída proporcional à entrada**, quando a saída descreve a entrada: `mínimo(teto, base + fator × tokens da entrada)`. Um arquivo de 82 linhas não pode gastar 12 000 tokens de descrição; com um teto único, o modelo que entra em repetição vai até o fim dele.
- **Quando a resposta é JSON, o teto é mais importante ainda** — JSON não sobrevive a corte. Se a lista pode ser longa, peça-a em partes; e **o teto de itens vai nos dois lugares, com papéis diferentes**: no esquema, um teto **alto**, como rede de segurança — nunca um limite baixo que molde a resposta —; no código, o teto de verdade. **Quando o programa sabe quantos itens precisa, o esquema diz exatamente esse número** (mínimo = máximo): um programa pedia "um item por cadeia" só no texto do pedido e recebia lista vazia em 69 de 165 cadeias, cerca de 40 %. Confira no servidor em uso: alguns travam com limite de itens na gramática — aí o esquema fica sem ele, e o código segura sozinho. Sem teto nenhum, um item chegou a 25 mil tokens enchendo um campo de lista — nada quebrou, só demorou minutos e encheu a ficha de ruído.
- **Estouro de entrada é conferido antes de enviar, e a chamada não sai.** Quem monta o prompt com vizinhos corta até caber, com a mesma conta que quem confere. O log diz "estourou a entrada", que é diferente de "o servidor recusou".
- **Repetição não se resolve aumentando o teto.** Um modelo que entra em laço repete o mesmo trecho até bater no teto de saída. Detecte comprimindo o fim da resposta: texto que se repete comprime muito (uma razão de compressão abaixo de 0,12 foi o limiar medido num programa). E separe as duas mensagens — "entrou em repetição; aumentar o teto não resolve" × "faltou teto de saída": com a mesma frase, quem investiga aumenta o teto e paga mais pela mesma repetição.
- **Teto de atenção, além do de tokens.** Um lote de itens que cabe em tokens pode não caber na atenção do modelo: com cerca de 105 fichas numa parte, ele perdia a conta e repetia até o teto. Um número máximo de itens por parte (40, num programa) é outro teto, independente do de tokens.

### Admitir

- **A janela é uma só, e as requisições em voo dividem o mesmo cache.** Quatro prompts de 30 mil numa janela de 50 mil não entram — e o servidor recusa **inclusive o pequeno** que só teve o azar de estar em voo junto com os grandes. Por isso o **portão de admissão conta tokens, não requisições**: um lote grande atravessa sozinho; vários pequenos passam juntos. É o paralelismo que o hardware realmente aguenta, em vez do número fixo que o usuário escolheu.
- **Tratar pedidos simultâneos como dividindo a janela é o lado seguro.** Se eles dividem de fato depende do servidor — do número de **slots paralelos** que ele abre e de como reparte o cache entre eles. Confira no servidor em uso; sem conferir, trate como dividido: errar para esse lado custa espera, errar para o outro custa recusa no meio da tarefa. E o paralelo que o programa manda não passa do número de slots do servidor.
- **A reserva no portão é por tentativa.** Quem falhou e vai esperar para tentar de novo **devolve o espaço** durante a espera, e pede de novo ao tentar. Segurar a reserva durante a espera tranca a janela para os outros sem ninguém a usar.
- **O teto de saída entra na reserva e vai ao servidor.** O portão reserva a entrada mais o teto de saída; se o teto não for mandado ao servidor, a resposta pode passar dele e ocupar o espaço que o portão deu a outro.
- **O portão é compartilhado pelo lote.** Uma instância por lote de chamadas paralelas, passada a cada uma; sem portão (uma chamada sozinha, fora do pool), a chamada segue direto.
- **Esperar no portão é admissão, não abandono.** O subagente que espera na entrada ainda não começou e nada se perde. A regra "nunca espera — encerra com o que tem" vale para o **meio** do laço de ferramentas, quando já há resultado na mão.
- **Uma requisição maior que a janela inteira não espera na fila.** Ela esperaria para sempre por um espaço que nunca existe — então o portão a deixa passar **sozinha**, sem ninguém em voo junto, e o servidor a recusa. A mensagem diz exatamente isso: "o pedido é maior que a janela inteira (N de M tokens); o servidor recusou" — e não "contexto excedido", que faz pensar em concorrência. Como a conta local é aproximação, um pedido pode passar na conferência antes do envio e ainda assim ser maior que a janela; o melhor é que a conferência (acima) pegue quase todos.
- **Paralelismo real = mínimo entre o configurado, o que cabe na janela e a trava.** O campo "máximo em paralelo" existe porque depende da máquina — e a tela diz ao lado dele que **é teto, não promessa**. Dois campos "máximo em paralelo: 4" em duas pontas somam oito na mesma janela se não houver a trava.
- **Um item de cada vez quando o contexto é a regra.** Um ciclo que precisa reunir o histórico de um tópico roda tópico a tópico, nunca todos juntos "para caber". Caber cortando é responder sobre metade.

### Revezar

- **Uma aba (ou tarefa) com o modelo por vez.** A trava global responde "há tarefa de IA rodando?" — não "há tarefa **desta** aba rodando?". Ela é do programa, não do projeto: a janela é uma só, e não faz diferença que dois projetos sejam diferentes. No vocabulário desta skill é o **Revezamento**; o mecanismo por baixo é uma trava, mas o nome na tela é a vez. Quem descreve a mesma coisa como **proteção contra estrangulamento** está falando dela, vista do lado de quem espera: o chat não conversa enquanto uma automação roda, porque a janela é uma só.
- **Dois motivos, e o segundo é o pior.** (1) Janela: dois campos "máximo em paralelo: 4" somam oito requisições na mesma janela, e o portão de cada ponta não enxerga a outra. (2) **Documentação a meio caminho**: conversar enquanto uma rotina reescreve o índice é conversar em cima de um índice meio velho e meio novo, e o subagente não tem como saber qual metade leu. O primeiro dá erro visível; o segundo dá **resposta errada com cara de certa**.
- **Entra na trava quem lê enquanto outro escreve, mesmo sem chamar o modelo.** Um backup que copia arquivos enquanto a rotina os regenera guarda metade velha e metade nova. Copiar é ler. Um programa tem cinco pontas na trava — chat, fila, rotinas, gerador de interface e backup — e o backup é a que não chama o modelo.
- **Enfileirar, nunca descartar.** Quem dispara por evento espera a vez; se a trava recusasse, a atualização se perderia em silêncio — pelo motivo exato que a trava existe para evitar. Só as pontas com gente na frente da tela (o envio do chat, o início da fila) recusam — e recusar aí é honesto: uma mensagem pendurada meia hora esperando a fila terminar seria pior que "não dá agora, é por isto". O botão fica apagado **com o motivo escrito ao lado**, curto — duas palavras respondem "o que está rodando" — para o usuário poder ir até lá.
- **A exceção do "recusar é honesto" não cobre outra aba.** Um programa recusava a partida do ciclo de um segundo projeto com "já existe um ciclo rodando" e não fazia mais nada: as chaves ficavam ligadas, mas o ciclo daquele projeto nunca acontecia, e como o Detector só vê a **próxima** mudança, o projeto ficava parado para sempre. A pessoa estava na frente da tela do projeto B; o que barrava era o A, que ela nem olhava. Agora a thread nasce sempre e **espera a vez**; o retorno deixou de ser "não começou" e virou "não começou **agora**" — e o texto diz atrás de quem.
- **A trava vale pelo envio inteiro, não por rodada.** Tomá-la dentro do laço de rodadas faria cada rodada disputar de novo o que a anterior já tinha ganhado.
- **Soltar a trava em qualquer saída — inclusive erro, inclusive quando a thread nem chegou a nascer.** Uma trava presa por uma exceção deixa o programa inteiro mudo: chat, fila e rotinas de uma vez, até reiniciar.
- **Quem espera calado é indistinguível de "não aconteceu nada".** Um ciclo bloqueado em silêncio pela trava fazia o usuário salvar um arquivo, esperar, e nada acontecer — sem nenhuma frase em lugar nenhum do programa dizendo por quê. O motivo de estar esperando fica **num campo próprio**, não só empurrado para a tela: a aba pode estar fechada na hora, e quem abrir depois precisa lê-lo.
- **O dono da trava carrega projeto e detalhe.** Com várias abas abertas, o motivo diz "ocupado pelo projeto X" e, quando houver, "Ciclo 2 · tópico Y" — um motivo sem endereço não ajuda ninguém. "Esperando as rotinas" e "esperando as rotinas **de outro projeto**" são leituras bem diferentes: não é este projeto que está lento, é a janela que é uma só — e a tela pinta esse caso com estado e cor próprios.
- **Uma thread que espera a vez pode descobrir, ao acordar, que a aba dela fechou** — e desiste ali, em vez de começar do zero um ciclo que ninguém vai ver, segurando a janela contra o projeto seguinte. E as configurações são lidas **ao chegar a vez**, não ao entrar na fila: entre uma coisa e outra o usuário pode ter desligado rotinas.

### Fatiar

- **Fatiar por fronteira natural** — cabeçalho, função, bloco em branco — e **a chave do pedaço é o nome da fronteira, nunca o número de ordem**. Porquê: a numeração muda a cada edição; o nome da função não. Um pedaço identificado por número reprocessa tudo quando alguém insere uma linha no topo.
- **Arquivo que não cabe é dividido e costurado** (→ `09`), não recusado — com um interruptor que devolve o comportamento antigo. Só o que **nem dividindo** cabe (passa do teto "o máximo, mesmo dividindo") vira aviso na tela, numa lista própria ("grande demais — nem dividindo cabe"), nunca erro silencioso nem corte mudo. A lista é lida na abertura do projeto, não descoberta no meio de uma rotina.
- **"Grande demais" e "pulado por outro motivo" são contas diferentes.** Um programa gravava os dois com nomes parecidos, e o histórico dizia "0 reaproveitados" para uma passada que reaproveitou tudo — zero falso é pior que campo ausente.

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| "contexto excedido" numa requisição pequena | ela estava em voo junto com grandes | portão por tokens, compartilhado pelo lote |
| o paralelo configurado é 4 e só rodam 2 | a janela não aguenta 4 daquele tamanho | o número da tela é teto; a tela diz isso |
| o chat não deixa enviar e não diz por quê | trava sem motivo na tela | botão apagado com o motivo, curto, com o projeto |
| o segundo projeto ligado nunca gera nada | partida recusada em vez de enfileirada | enfileirar; "não começou agora", com atrás de quem |
| o programa inteiro ficou mudo depois de um erro | trava presa por exceção | soltar em qualquer saída |
| o usuário salvou e nada aconteceu, sem mensagem | o ciclo esperava a vez em silêncio | o motivo de esperar num campo próprio, lido por quem abrir |
| um item de 25 mil tokens | lista sem teto | teto alto no esquema, o de verdade no código |
| a ficha anterior sumiu e a nova acabou no meio de uma frase | teto de saída desconhecido, corte lido como fim | teto por tarefa; cortada é erro, não gravação |
| tudo reprocessa depois de inserir uma linha no topo | pedaço identificado por número | chave pelo nome da fronteira |
| lista vazia em 40 % das respostas, com o esquema certo | o número de itens só no texto do pedido | mínimo = máximo no esquema quando o programa sabe |
| o modelo repete o mesmo trecho até o teto, e aumentar o teto não resolve | repetição lida como falta de teto | detectar por compressão; mensagem própria |
| "grande demais" num arquivo que só precisava ser dividido | recusar o que não cabe | dividir e costurar (→ `09`) |

### Checklist ao construir

- [ ] Há um tokenizador local para antes, e o `usage` para depois — e a tela diz quantas chamadas cada fonte cobriu?
- [ ] O orçamento é calculado de trás para a frente, com prompt e esqueleto medidos, e devolve o detalhamento?
- [ ] O teto de saída de cada tipo de tarefa é conhecido, imposto, e a resposta cortada é detectada pelo motivo de término?
- [ ] O portão de admissão conta tokens, é compartilhado pelo lote, e deixa passar sozinho, para o servidor recusar com a mensagem certa, o pedido maior que a janela inteira?
- [ ] A trava global existe, com todas as pontas — inclusive as que só leem enquanto outras escrevem?
- [ ] Quem dispara por evento enfileira; quem tem gente na tela recusa com motivo?
- [ ] O motivo de esperar carrega projeto e detalhe, e fica num campo que a tela lê depois?
- [ ] A trava solta em qualquer saída?
- [ ] O fatiador usa a fronteira como chave, e a lista de "grande demais" é lida na abertura?
- [ ] Os tetos da janela estão em %, derivados da janela lida, com o próprio % por etapa?
- [ ] Há detecção de repetição, com mensagem própria, e teto de atenção por parte?
- [ ] Pedidos simultâneos são tratados como dividindo a janela, a reserva é por tentativa, e o teto de saída vai ao servidor?

## O que a tela mostra

- **Barra de tokens** do contexto, com o system incluído — um chat novo que mostra zero está mentindo, porque o system vai sempre.
- **A conta antes de enviar**, detalhada: o que cada parte ocupa e o que sobra.
- **O dono do Revezamento e o motivo** ao lado de cada botão apagado; a aba que está com o modelo em destaque; o estado "bloqueado por outro projeto" com cor própria (→ `20`).
- **A lista de arquivos grandes demais**, com tamanho e o quanto passa.
- **Ao lado do campo "máximo em paralelo":** "teto — o real depende da janela e da trava".

## O que fica salvo e configurável

- **Salvo:** a lista de arquivos grandes (recalculada por rotina); a contagem por chamada, para as métricas (→ `22`); o motivo de espera do ciclo, por projeto.
- **Configurável (→ `21`):** janela de reserva; tetos de entrada, saída e margem em % da janela, por etapa; teto de saída proporcional (base e fator); teto de itens de lista; teto de atenção (itens por parte); máximo em paralelo; o piso abaixo do qual não se envia; o tempo de "desistir de esperar" que só vale quando não há sinal de vida a quem perguntar.
