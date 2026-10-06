# 20 Painéis, sinalização e visualização

## O que é e quando usar

O que a tela precisa mostrar para o usuário **saber o que o modelo está fazendo, com o quê, e por que um botão está apagado**. Um programa com LLM sem esses painéis parece travado, quebrado ou mágico — e os três são a mesma coisa: o usuário não vê o trabalho. Esta peça vale para toda forma de agente; cada arquivo desta skill aponta para cá na seção "O que a tela mostra".

Duas regras vêm antes de qualquer painel: **abrir uma tela nunca recalcula nem grava**, e **a tela mostra só o que pode observar de verdade**. E uma terceira que resume a atitude: a tela **pergunta** ao backend e **mostra** a resposta — não decide, não inventa, não esconde.

## Como se constrói

### As regras da tela

- **Abrir uma tela nunca recalcula nem grava.** Tela lê o que já está calculado; só ação explícita — um botão — roda alguma coisa. Porquê: um usuário que abre uma aba para olhar não pode disparar um ciclo de vinte minutos; e uma tela que grava ao abrir grava quando ninguém pediu. Toda função do backend que a tela chama diz na descrição se **escreve** ou se é **leitura** — e a tela, ao abrir, só chama as de leitura.
- **A tela mostra só o que pode observar.** Se o backend não emite evento por passo, os passos aparecem **como referência** (o que aquele ciclo sempre faz, nesta ordem), e só o que o backend de fato informa ganha o indicador de andamento. Um programa escreveu isso no cabeçalho da tela: "inventar um progresso que a tela não pode observar seria pior do que mostrar menos". Barra de progresso animada sem fonte é mentira animada.
- **A fonte de "está rodando" é uma só.** A mesma variável que acende o selo na aba apaga os botões e marca "aguardando a vez" como intocável. Duas fontes divergem, e a tela mostra "rodando" com o botão de iniciar aceso. "Tem alguma coisa rodando?" e "o que está na tela está rodando?" são perguntas diferentes — o cronômetro quer a primeira, o botão quer a segunda — e as duas vêm do mesmo registro.
- **Cor sempre com rótulo.** Verde é "concluído" escrito ao lado; roxo é "aguardando a vez" escrito ao lado. Nunca só a cor. E cor tem significado fixo no programa inteiro: âmbar é "esperando o usuário", roxo é "na fila do ciclo, vai rodar sozinho" — misturar os dois faz o usuário achar que precisa fazer algo quando não precisa.
- **A tela pergunta ao backend, não o contrário, num intervalo curto** (dois segundos é o número de um programa) para o estado global — e recebe eventos para o que é incremental (log, streaming). O intervalo é configurável. E o estado muda **já no clique**, antes da próxima volta do poll — sem isso o projeto fica com cara de "não tem nada ligado" por dois segundos.
- **Todo evento do backend para a tela passa por um funil único, que carimba o endereço completo** — projeto e dono (a sessão, a tarefa). Com várias abas abertas, um evento sem endereço pinta na aba errada (→ `12`); e **ids não são únicos entre projetos** (o id de uma sessão pode ser a hora em que ela foi criada). **Trocar de projeto zera o estado em memória e os timers** da tela. **Evento sem dono não pinta**; os eventos ficam guardados por dono e são repintados quando o usuário volta àquela aba.
- **Atualização de tela falha em silêncio, de propósito**: a janela pode ter fechado; derrubar um trabalho pago por causa de um painel seria trocar um defeito visual por um erro de verdade.
- **O que a tela mostra vem do disco** quando o dado é persistente: título, estado, lista. Memória da thread que roda não é fonte (→ `18`).

### A sinalização — uma aba com o modelo por vez

- **A aba (ou tarefa) que está com o modelo tem destaque**: uma bolinha, um pulso, um selo — visível de qualquer outra aba. Porquê: o usuário troca de aba e precisa saber, sem voltar, que o trabalho continua ("rodando ao fundo — pode trocar de aba; o andamento aparece na aba"). Com abas de projeto, a bolinha diz **de qual projeto** — senão acende a errada.
- **Os botões em conflito ficam apagados, com o motivo ao lado.** Botão apagado sem explicação parece defeito; com o motivo, o usuário sabe inclusive **para onde ir** — é a fila, é a documentação atualizando, é o próprio chat. O motivo é **curto de propósito** (duas palavras respondem "o que está rodando"), porque mora numa linha ao lado de um botão, e com abas de projeto ainda ganha o nome do projeto no fim. Um rótulo longo "empurrava o resto do controle".
- **O motivo carrega o detalhe** quando há: "Ciclo 2 · tópico X", "Fila · tarefa 3" — o mesmo texto ao lado do botão e na aba. Quem toma a trava passa o detalhe; a tela só lê.
- **"Esperando o modelo ocupado por outro" tem estado e cor próprios**, diferentes de "esperando a fila deste projeto": não é este projeto que está lento, é a janela que é uma só (→ `08`). O estado diz **quem está segurando**, usa uma cor vizinha da de espera, e **nunca** a de "processando".
- **Quem pergunta e quem responde:** a tela pergunta "há tarefa de IA rodando?" ao backend; o backend responde com o **dono** e o **motivo**. A tela não decide por conta própria que pode habilitar. E o motivo de estar esperando fica num campo que a tela lê **ao abrir** — a aba podia estar fechada quando aconteceu.
- **Os botões manuais que disparam a mesma ponta que o ciclo automático também apagam** durante o ciclo — senão o usuário dispara por cima do que já roda. Uma marca no botão diz a que ponta ele pertence, e qualquer dono daquela ponta o apaga.
- **Parada pedida não acende vermelho.** O slot ou a tarefa que o usuário parou fica quieto — parar não é erro.
- **O botão pergunta à trava antes de mudar a tela**, lê o retorno e **desfaz a mudança na recusa**. Recusa da trava não é erro da rotina, e tem frase própria. E o resultado antigo fica escondido quando nada está rodando — senão parece o resultado de agora.

### Os painéis, um por item

| Painel | O que mostra | Onde é detalhado |
|---|---|---|
| **Indicador do modelo** | qual está carregado, a janela, "servidor fora"; no externo, provedor e "chave configurada" | `06`, `07` |
| **Barra de tokens** | o contexto do próximo envio, com o system dentro; depois do envio, o uso real | `08` |
| **A conta antes de enviar** | cada parte e o que sobra; no externo, o custo | `08` |
| **Contexto enviado** | o payload exato que foi (ou vai) ao modelo, copiável, vivo durante a resposta | `12` |
| **Log incremental** | cada chamada, devolução, erro — conforme acontece; o raciocínio inteiro no log | `22` |
| **Chamadas e métricas** | por tarefa: rodadas, voltas, tokens, tempo | `13`, `22` |
| **Painel de subagentes** | qual existe, ordem, ferramentas, tetos — **e qual está rodando agora**; ligado à configuração | `03`, `21` |
| **Diagrama de fluxo** | cards ligados por setas (o grafo de dependências entre rotinas), o resultado da última execução em cada card, filtros; o que roda pulsa | `14` |
| **Trilha de ciclos** | cards em sequência; o que roda pulsa; o selecionado abre o detalhe com os passos como referência | `15` |
| **Grade de slots** | um slot por chamada em voo na geração em lote, com status e tokens; a grade é do paralelo escolhido, não do tamanho do lote; "por que não pode iniciar", com nome | `01` |
| **Cards da Espera e do Revezamento** | "segurando — o código ainda está mudando", com os tempos; "aguardando a vez — o chat está com o modelo"; "bloqueado pelo projeto X" | `14` |
| **Cards de agente com status** | por rotina: ligado/sempre, última execução, resultado, botão apagado com motivo | `14` |
| **Pendências** | o que falta por rotina, com progresso, separando por arquivo de por lote; toda rotina registrada, inclusive as que não contam arquivo | `14` |
| **Arquivos grandes demais** | nome, tamanho, quanto passa | `16` |
| **Erros por item** | nome, tipo (cortada, formato, gramática, parcial, caminho), a frase certa, o começo da resposta | `10`, `22` |
| **Histórico em rodadas** | no gerador criativo: cada rodada com a escolha, navegável | `01` |
| **O "em dúvida"** | as duas leituras lado a lado, os trechos, botão de arbitrar | `15` |
| **Tabela de revisão** | o que o modelo propôs, editável linha a linha, antes de gravar; o desfecho da fila chegando por linha | `15` |
| **Faixa de retomada** | "parou em X, faltam N (com 4 erros) — retomar?" na abertura | `18` |
| **Qual modelo complementar está em uso** | e se é o fallback | `17` |

### Quando um fluxo merece painel

- **Painel em grafo quando há fluxo; só o fundo quando não há o que o usuário decida.** Um fluxo com etapas que dependem umas das outras — rotinas encadeadas, papéis em sequência, agentes que se acionam — ganha um painel com **cards ligados por setas**: o usuário entende como funciona sem ler código, vê onde parou e por quê. Um trabalho sem etapas nem decisão — calcular hashes, limpar temporários — roda só no fundo, com uma linha no log; um painel para ele é ruído.
- **O critério, em três perguntas:** tem mais de uma etapa, com dependência entre elas? O usuário precisa saber em qual parou? Tem algo para ele ligar, desligar ou retomar? Um sim → painel. Nenhum → fundo.
- **Mesmo no fundo, o registro de vida existe:** o mesmo registro que alimentaria o painel serve ao vigia de travamento (→ `14`). Um registro, dois leitores.

### As visualizações de fluxo

- **Cards e setas** para dependência e ordem: o usuário lê "o que roda depois do quê" sem ler código. Cada card com nome, estado e o resultado da última execução; setas na direção da dependência; filtros por estado; um selo "+nome" para o que é hub e não seta, senão o desenho vira teia.
- **Raias / sequência / trilha** para um pipeline longo: raias por profundidade ou camada; sequência para ver a ordem; trilha para seguir uma cadeia só. **Com ajuda de como ler** cada vista — uma visualização sem legenda é um desenho.
- **Zoom e arrastar** onde o desenho não cabe; poda de rótulos quando afastado; qualidade de renderização menor em movimento e maior em repouso, configurável.
- **Sunburst, treemap, grafo de força** para hierarquia e peso — mesma regra: rótulo junto da cor; e o mesmo componente de zoom para todas.
- **Dois quadros lado a lado** (antes × agora) para comparação de versões, com zoom espelhado.
- **A seta quer dizer uma coisa só: "só começa quando o de trás termina".** Nada de seta para "manda dados para" ou "é parecido com".
- **Chave e estado em eixos separados.** "Vai rodar?" (ligado · desligado · sempre) é um desenho; "o que houve?" (ok · erro · pulado · dispensado · bloqueado · esperando · rodando) é outro. Juntos no mesmo lugar, um nó desligado com um erro antigo parece quebrado.
- **"Bloqueado" (falta insumo) ≠ "esperando" (é a ordem ou a vez)** — cores e rótulos diferentes.
- **Nó desconhecido aparece com ícone genérico**, em vez de sumir: um nó novo, sem desenho previsto, sumindo do grafo esconde justamente o que mudou.
- **O desenho lê a cadeia declarada** (→ `14`), nunca uma cópia à mão.
- **Ao abrir, pinta primeiro o que está vivo, depois os desfechos do disco.** O desenho não é a verdade — é a foto mais recente dela, e o que está vivo é mais recente que o disco.

### Progresso honesto

- **Duas barras quando há cache:** o trabalho real, e o que veio do cache, em cor apagada. Uma barra só dizia "faltam 255" com 34 faltando de verdade.
- **Denominador desconhecido deixa a barra quieta** — sem animação —, com o número já feito.
- **Uma unidade só:** arquivos, e não pedaços num lugar e arquivos no outro.
- **A fase de cada item:** "parte 2 de 3", "costurando · rodada 2", "tentativa 2 de 3 · de novo em 8 s".
- **O item que falhou conta no progresso**; sem contá-lo, a barra trava antes do fim.
- **Muitos itens: um poll único, compartilhado**, e não um empurrão por item. E o poll **religa ao voltar à tela** — um cronômetro congelado ao voltar é um poll que não religou.

### A tela de uma geração

- **A ponte do backend para a tela é recurso escasso.** Serializada com trava — a chamada à tela não é reentrante, e duas ao mesmo tempo perdem uma —; **agrupada por tempo** (50 a 120 ms), com teto de buffer; levando **só os campos que a tela desenha**. Falha ao empurrar nunca derruba o trabalho. E **nunca se chama a ponte de dentro do tratamento de fechamento da janela** — congela a janela.
- **Polling com assinatura:** só redesenha se a assinatura mudou, e ela inclui **todo campo que a tela mostra**. Redesenhar a cada 4 s fechava todo painel que o usuário tinha aberto; um campo que ficou fora da assinatura "ficava certo no disco e a tela nunca mudava". Log cresce por acréscimo, não por redesenho. Depois de cada `await`, recalcule a partir das marcas atuais — senão o evento duplica.
- **O envelope de chamada nunca aparece cru.** A frase que o modelo escreveu antes da chamada vira o balão; o envelope só é reconhecido no fim da mensagem; ao reabrir uma conversa, um JSON quebrado não reaparece cru.
- **Tipo de mensagem desconhecido cai num padrão neutro ou escondido** — nunca em "você escreveu" nem em "resposta do modelo". Um prompt fixo de 30 linhas aparecia como balão do usuário.
- **O "pensando" mora na conversa, não no botão.** No botão, mudava a largura e a linha saltava. Ele vem de uma tabela por tipo de evento, e some quando aparecem os indicadores dos subagentes.
- **O primeiro estágio do Parar mostra uma faixa explicando a parada.** Sem ela, a conversa termina numa fileira de cartões sem resposta, e parece defeito.
- **A barra de tokens:** conta por tokenizador, nunca caracteres ÷ 4; inclui sempre o system; recalcula mesmo com a aba escondida; mostra **dois números** (usado de total), não porcentagem; depois do envio, o uso real (→ `08`).
- **Rolagem automática só se a pessoa já estava no fim.** Quando ela mesma age (envia, para), volta a acompanhar.
- **"Fechar o programa" ≠ "sair da tela".** Um mata o trabalho; o outro deixa continuar — e o aviso diz qual. Todo modal resolve nas três saídas (confirmar, cancelar, fechar no X). Sem motivo real, o aviso não inventa frase: "há trabalho de IA em curso" com tudo parado é mentira.
- **Erro não é descartar:** o texto que chegou antes do erro fica na tela, com o aviso embaixo (→ `06`).
- O envio visto do lado do chat — o dono antes do `await`, desligar em todas as saídas, ler a resposta de quem inicia — está no `12`.

### A fala do programa × a do modelo

- **O programa nunca fala pela boca do modelo.** Aviso do programa não vira balão do modelo: tem forma própria. O "está acontecendo" (aguardando, lendo) some quando acaba; a ressalva sobre o que aconteceu ("resposta cortada", "sem verificação") fica.
- **Tudo o que viaja no prompt tem dono visível e morre com ele.** Um comentário do usuário voltava sozinho e invisível semanas depois, e ia no pedido ao modelo. Se vai no prompt, aparece na tela; se sai da tela, sai do prompt.
- **Marcar não dispara chamada.** Marcar itens numa lista é escolher; o botão é que roda. E a marca de "rodar de novo" se apaga **em todos os caminhos** — eram três, e só um era óbvio —, senão o item é pego de novo para sempre.

### O que a tela não faz

- Não decide se pode rodar; pergunta.
- Não inventa passo; mostra referência.
- Não esconde erro; mostra por item, com a frase.
- Não some com o resolvido; recolhe.
- Não pinta na aba errada; lê o dono do evento.
- Não grava ao abrir; grava ao clicar.

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| abrir uma aba disparou um ciclo | função que escreve chamada na abertura | tela só chama leitura ao abrir |
| a barra de progresso anda e o backend está parado | progresso inventado | mostrar só o que se observa |
| "rodando" com o botão de iniciar aceso | duas fontes | uma fonte de "está rodando" |
| o usuário não sabe por que o botão está apagado | sem motivo | motivo curto ao lado, com o projeto |
| o motivo empurra o controle para fora da tela | rótulo longo | duas palavras |
| a bolinha acende no projeto errado | evento sem dono | todo evento leva o projeto |
| o projeto parece "sem nada ligado" por dois segundos | estado só no próximo poll | mudar já no clique |
| "nenhum agente processando" com um rodando | só quem conta arquivo se registra | registrar toda rotina |
| o slot fica vermelho quando o usuário para | parada tratada como erro | parada fica quieta |
| a grade de slots "muda sozinha" no fim | grade do tamanho do lote | grade do paralelo escolhido |
| o desenho de dependências virou teia | hubs como setas | hub vira selo |
| um painel para um trabalho sem etapas nem decisão | todo fluxo ganhou painel | painel só quando há fluxo |
| um nó novo sumiu do grafo | nó desconhecido sem desenho | ícone genérico |
| "faltam 255" com 34 faltando | cache contado como trabalho | duas barras |
| a janela congela ao fechar | ponte chamada no fechamento | nunca chamar a ponte ali |
| todo painel aberto fecha a cada 4 s | redesenho sem assinatura | só redesenhar se a assinatura mudou |
| o prompt fixo aparece como balão do usuário | tipo desconhecido caiu em "você escreveu" | padrão neutro |

### Checklist ao construir

- [ ] Toda função do backend diz se escreve ou lê, e a tela só chama leitura ao abrir?
- [ ] Os passos sem evento aparecem como referência, e só o observado pulsa?
- [ ] "Está rodando" tem uma fonte só, que acende o selo, apaga os botões e marca "aguardando a vez"?
- [ ] Toda cor tem rótulo, e cada cor tem um significado só no programa inteiro?
- [ ] O poll é curto e configurável, o estado muda no clique, e os eventos levam o dono?
- [ ] A aba com o modelo tem destaque de qualquer outra aba, com o projeto?
- [ ] Todo botão em conflito apaga com motivo curto, com detalhe e projeto, lido de um campo que sobrevive à aba fechada?
- [ ] Os painéis mínimos existem: modelo, tokens, log, erros por item, contexto enviado?
- [ ] Toda visualização tem legenda e o mesmo zoom?
- [ ] Cada fluxo passou pelo critério "painel ou fundo"?
- [ ] No grafo, a seta quer dizer "só começa quando o de trás termina", chave e estado estão separados, e o desenho lê a cadeia declarada?
- [ ] O progresso separa cache de trabalho, tem uma unidade só, e conta a falha?
- [ ] A ponte com a tela é serializada e agrupada, o poll tem assinatura, e o programa nunca fala pela boca do modelo?

## O que a tela mostra

Esta peça **é** a tela. O mínimo de qualquer programa com LLM: indicador do modelo · barra de tokens · a aba em destaque quando está com o modelo · botão apagado com motivo · log incremental · erros por item. O resto entra conforme a forma de agente.

## O que fica salvo e configurável

- **Salvo:** preferências de vista (qual visualização, zoom, filtros, estado de expansão de árvores) — no navegador do usuário, não no estado do projeto.
- **Configurável (→ `21`):** o intervalo de consulta do estado global; quantas linhas de log mostrar; qualidade de renderização dos mapas (em movimento × em repouso); ícones e tema; a ordem das abas.
