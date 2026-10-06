# 11 Cache de prefixo e ordem das mensagens

## O que é e quando usar

Não é configuração. O servidor local guarda o resultado de processar o começo da conversa — o cache de prefixo (*prefix caching*, o cache KV) — e, se a próxima chamada começa **exatamente** com os mesmos tokens, ele pula essa parte. Qualquer byte diferente no começo joga o cache fora e o servidor reprocessa tudo. Numa conversa longa, é a diferença entre uma resposta em dois segundos e em quarenta; num laço de ferramentas de dez rodadas, é a diferença entre reprocessar dez vezes um contexto de 20 mil tokens e processá-lo uma vez.

A única coisa que quem constrói faz é **mandar igual**. Esta peça diz o que "igual" exige, onde ela vale, e o que costuma quebrá-la sem ninguém perceber.

## Como se constrói

### A ordem

- **A ordem fixa.** Do mais estável para o mais volátil: `system` → prompts fixos e contexto inicial → histórico → mensagem nova. Só a última parte muda a cada envio. Instrução vem primeiro porque é o que menos muda; a mensagem do usuário vem por último porque é a única coisa nova. Inverter — pôr o contexto depois da pergunta, por exemplo — faz cada envio começar diferente, e o cache nunca casa.
- **O que varia fica no fim, de propósito — e faz sentido também semanticamente.** Um programa manda as **regras do usuário** e o **prompt fixo** na cauda, junto da mensagem de agora, e a documentação de agente no começo: a documentação é prefixo estável; a regra "acompanha a mensagem de agora, não abre a conversa". Ordem de um envio de chat com subagentes: system + blocos dos subagentes (prefixo sempre igual) → histórico → regras → prompt fixo → mensagem do usuário.
- **A ordem é a mesma no chat e na fila**, montada por uma função só (→ `06`, normalização). Dois montadores divergem num espaço em branco, e o cache morre num deles sem ninguém saber por quê.

### Acrescentar, nunca reescrever

- **O histórico é guardado cru.** A resposta do modelo entra como veio, com o raciocínio dentro; a limpeza vale só na entrega (→ `06`). Um programa registrou isso como decisão, contra o instinto: "o pensamento da rodada anterior ajuda a rodada seguinte, e reescrever a mensagem quebra o reaproveitamento do cache do servidor, que casa prefixo por prefixo". Resumir o histórico, apagar uma mensagem do meio, corrigir um typo numa mensagem antiga, "compactar" — tudo isso é reescrever.
- **O contexto inicial e os prompts fixos travam depois da primeira mensagem.** Na tela, os checkboxes ficam desabilitados assim que a conversa começa. Porquê: ligar um prompt fixo na terceira mensagem muda o prefixo inteiro. Quem quer outro contexto abre outra sessão.
- **Os resultados de ferramenta entram como mensagens novas no fim**, uma por chamada, nunca editados depois. O aviso de "última rodada, responda com o que tem" também entra como mensagem nova — colado ao bloco de resultados —, não como edição do system.
- **A versão anterior do system sai por marca, e sai antes de montar** — não fica um system velho no meio do histórico (→ `10`).
- **O histórico nunca termina numa fala do próprio modelo quando o trabalho continua.** Um histórico cuja última mensagem é do modelo o faz continuar a própria frase, ou repetir. Quem continua o trabalho acrescenta uma mensagem real no fim — o resultado da ferramenta, o aviso do contador; no Parar, a mensagem que diz que parou.
- **Metadado do programa mora num campo que nunca vai ao servidor** — id, hora, marca de parcial, tokens. Posto no texto, muda o prefixo a cada envio; posto num campo extra enviado, o servidor recusa ou o template o ignora.
- **Com um assistente em sessão (um terminal que mantém a conversa), o system vai uma vez por sessão**, no começo. Reenviado a cada mensagem, ele entra no meio do histórico e o prefixo morre (→ `23`).

### O system determinístico

- **Montado a cada envio (→ `10`), mas mesma configuração dá o mesmo texto, byte a byte** — mesma ordem dos blocos, mesmo espaçamento, mesma quebra de linha no fim. Mudou a configuração no meio da conversa (ligou um subagente)? O prefixo muda, e isso é aceito: foi uma escolha. O que não se aceita é o prefixo mudar sem ninguém ter mudado nada.
- **O que costuma quebrar o determinismo sem ninguém perceber:** data e hora dentro do system; um número aleatório; uma lista montada de um dicionário sem ordem garantida; o nome do projeto que muda com a aba; um contador ("rodada 3 de 10") **no começo** em vez de na cauda; um caminho absoluto que muda de máquina; espaços no fim de linha que um editor tira. Teste: monte o system duas vezes seguidas e compare byte a byte.
- **O teto de rodadas entra no system** (o modelo precisa saber quantas tem), e por isso mudar o teto entre envios muda o prefixo — é aceito, é uma escolha; só não mude por acidente.

### Onde vale

- **Vale sempre que há mais de uma ida ao modelo na mesma conversa** — inclusive o laço de ferramentas de um subagente sem memória: a rodada 2 acrescenta o resultado da ferramenta ao histórico da rodada 1, e o servidor reaproveita o prefixo. **Só o tiro único fica de fora**: um prompt, uma resposta, acabou — não há próxima chamada para casar.
- **Onde cada forma cai:**

| Forma | Prefixo reaproveitável? | O que se otimiza |
|---|---|---|
| chat, agente principal, fila | sim — o histórico inteiro | manter a ordem e não reescrever |
| subagente (dentro do laço) | sim — as rodadas do laço | idem; o system do subagente é fixo por papel |
| ciclo de papéis fixos | por papel: um papel que recebe o mesmo material duas vezes (as duas leituras do Corretor) reaproveita | prompt do papel fixo, material na mesma ordem |
| rotina por lote, tiro único | não — cada item é uma conversa nova desde o começo; só o system se repete | o orçamento (→ `08`), não o cache |
| gerador em lote com slots | o system e o modelo de prompt são iguais em todos os slots; o item varia | pôr o modelo de prompt antes e o item depois |

- **Mesmo na rotina por lote, o system igual em todos os itens reaproveita** — se ele vier primeiro e o material do item depois. É de graça; não desperdice pondo o nome do arquivo no começo do system.

### O que o cache não é

- **O cache é dividido entre as requisições em voo.** É a mesma janela: quatro requisições paralelas dividem o mesmo cache e o mesmo espaço. É o motivo do portão de admissão por tokens (→ `08`) — e a razão de o paralelo real ser menor que o configurado.
- **Não tente "aquecer" o cache com chamadas extras.** Uma chamada só para deixar o prefixo pronto é uma chamada a mais — contraria a regra que vale sempre. O prefixo fica pronto na primeira chamada de verdade.
- **O cache não substitui o orçamento.** Reaproveitar o prefixo economiza tempo, não espaço: o histórico inteiro continua contando na janela. Uma conversa que cresce sem parar estoura a janela com cache ou sem.
- **No modelo externo**, o provedor pode exigir marcar o que é cacheável e cobrar diferente (→ `07`); a ordem fixa continua sendo o que faz a marca valer.

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| a resposta demora cada vez mais numa conversa longa | o prefixo muda a cada envio | ordem fixa; system determinístico |
| a demora piora só depois de ligar um prompt fixo | o prefixo mudou no meio | travar depois da primeira mensagem |
| a demora aparece sem ninguém ter mudado nada | data, aleatório ou ordem de dicionário no system | teste byte a byte; nada volátil no prefixo |
| a fila reaproveita e o chat não, com o mesmo modelo | dois montadores de mensagens | uma função de montar |
| o laço de ferramentas fica lento a partir da rodada 3 | histórico "limpo" a cada rodada | histórico cru; acrescentar, nunca reescrever |
| o servidor recusa por "contexto excedido" mesmo com cache | cache lido como espaço | o orçamento continua contando o histórico inteiro |

### Checklist ao construir

- [ ] A ordem é system → fixos e contexto inicial → histórico → mensagem nova, e é a mesma em todas as formas?
- [ ] O histórico é cru, e nada o reescreve (nem resumo, nem limpeza, nem edição)?
- [ ] Os checkboxes de contexto e prompts fixos travam depois da primeira mensagem?
- [ ] O system montado duas vezes seguidas é igual byte a byte?
- [ ] Nada volátil (data, aleatório, contador, caminho de máquina) está no prefixo?
- [ ] No lote, o system igual vem antes e o material do item depois?
- [ ] Não há chamada de "aquecimento"?
- [ ] O histórico nunca termina numa fala do modelo quando o trabalho continua, e o metadado fica fora do que vai ao servidor?

## O que a tela mostra

Nada próprio. O efeito aparece no tempo de resposta e, indiretamente, na barra de tokens: uma conversa em que a contagem de entrada cresce a cada mensagem está certa — é o histórico inteiro que vai, e o servidor reaproveita a parte que já viu. Se o programa quiser um indicador, o `usage` de alguns servidores separa tokens reaproveitados de novos; mostrar os dois é o único painel que esta peça tem.

## O que fica salvo e configurável

- **Salvo:** o histórico cru da conversa (→ `18`); os checkboxes de contexto travados por sessão.
- **Configurável:** nenhuma opção — e a skill diz isso explicitamente, para ninguém procurar um campo "cache" que não existe.
