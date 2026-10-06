---
name: construir-sistemas-com-llms
description: "Como construir um programa que usa um modelo de linguagem rodando localmente — chat, agente principal com subagentes e ferramentas, catálogo de subagentes, fila de tarefas longas, rotinas por evento e o grafo delas, ciclos de papéis fixos, ingestão de arquivos, dividir e costurar o que não cabe na janela, erros, retentativa e recuperação depois de uma queda, painéis, configuração, métricas e logs — com as regras aprendidas em programas reais em produção. Use SEMPRE que for criar, ampliar ou revisar qualquer parte de um programa que chame um LLM (local ou, com ressalvas, externo): antes de escrever a primeira linha, para saber que peça está construindo e que regras ela tem. Não é enciclopédia de IA: não explica o que é transformer, embedding ou RAG."
---

# Construir sistemas com LLMs

## 1 · O que esta skill é

É um **mapa de peças** para construir um programa que usa um modelo de linguagem local. Cada peça — o cliente do modelo, o chat, os subagentes, a fila, as rotinas, os painéis — tem um arquivo com as regras dela, e cada regra tem o porquê: a falha real, em produção, que ela evita. Nada aqui é sobre um programa específico; os exemplos vêm de programas reais e entram anonimizados como "um programa que…".

**Como usar:** leia este índice, decida **que peça está construindo**, e abra **só o arquivo dela**. Se ainda não sabe a forma — chat? fila? ciclo? — abra o `01` primeiro: ele é o mapa das formas, e a pergunta que escolhe é "quem decide o próximo passo?". Cada arquivo de peça termina com uma tabela de **erros comuns** (sintoma → causa → regra) e um **checklist** — use o checklist antes de dar a peça por pronta.

**Como os arquivos se citam:** por número — "→ `08`" é o arquivo 08, esteja na pasta que estiver. O prefixo das pastas diz a faixa de números que cada uma guarda. Na raiz fica só este índice; todo o resto mora em pastas, na ordem de quem constrói: agentes → modelo → formas de rodar → dados e recuperação → interface → o que fica fora do programa.

## 2 · As regras que valem sempre

1. **Só modelo local por padrão.** Se for externo, leia o `07` — ele diz o que muda, e só isso.
2. **Uma aba (ou tarefa) com o modelo por vez, e ela sinalizada.** A janela é uma só; o que espera, espera na fila, com o motivo escrito ao lado do botão apagado. É o Revezamento.
3. **Limite em token, nunca em caractere.** Caractere mente em código. Token protege a janela; byte protege a máquina e decide antes de abrir; caractere é só corte de apresentação (→ `04`).
4. **Tokens contados por tokenizador, e o valor real é o do servidor** — o tokenizador local é aproximação, para decidir antes de enviar; o uso que a resposta traz é a verdade, depois; nunca palavras × fator nem caracteres ÷ 4 (→ `08`).
5. **Nunca uma chamada a mais.** Retentar é para o que muda sozinho — conexão, tempo esgotado, servidor ocupado —, não para falha do item; uma resposta ruim de um item não desliga nada para os outros, e não gera segunda chamada silenciosa. De quem é a culpa, se retenta e para onde o erro vai: → `19`.
6. **O modelo nunca é fonte de fato, nem de nota.** Ele classifica, propõe, julga; quem confere no disco e quem conta é o programa. O arquivo existe? O programa olha. A nota? Uma fórmula sobre o que o modelo classificou.
7. **Enfileirar, nunca descartar.** Pedido que chega com o modelo ocupado espera a vez — descartar perde a atualização em silêncio. Recusar só é honesto quando há gente na frente da tela, e aí com o motivo.
8. **Botão travado sempre com o motivo ao lado** — curto, e o motivo carrega o detalhe ("Ciclo 2 · tópico X") e o projeto, para o usuário saber para onde ir.
9. **O número da tela é teto, não promessa.** O paralelo real é o mínimo entre o configurado, o que cabe na janela e a trava.
10. **Gravar o parcial, nunca o cortado.** O que já chegou se salva, marcado como parcial; resposta cortada por tamanho é erro com a mensagem certa, não gravação pela metade.
11. **Acrescentar ao histórico, nunca reescrever.** O servidor reaproveita o começo igual; reescrever uma mensagem joga o cache fora.
12. **Abrir uma tela nunca recalcula nem grava.** Tela lê o que está calculado; só ação explícita roda.
13. **A IA só escreve na pasta dela.** O resto do disco é do programa e do usuário.
14. **Decida quem dá o resultado antes de desenhar o ciclo:** determinístico (ferramenta ou conta), o modelo propõe e o programa conta, ou só inferência — a tabela está no `01`. E todo ciclo que roda sozinho tem **objetivo escrito, critério de parada conferido pelo programa e teto** — onde a precisão importa, verificação e validação cruzada.
15. **Nada falha mudo.** Todo erro tem nome de item, tipo e frase, na tela e no log — e a frase diz a causa real, não a mais genérica; `except: pass` em volta de trabalho com modelo é um bug esperando duas semanas para aparecer. Prevenir antes, gravar para recuperar, e as duas listas "o que falhou" × "o que não cabe": → `19`.
16. **Esta skill é genérica.** Os exemplos são de programas reais, anonimizados; nenhum deles é o seu. O que valeria só para uma prova, um acervo ou um agente que edita código é exemplo, não regra.

## 3 · O mapa: vai construir X → abra Y

| Vai construir… | Abra |
|---|---|
| ainda não sei a forma — chat, fila, ciclo? — e os eixos de um fluxo | `01 - 05 - Agentes\01 Tipos de agente e como se comportam.md` |
| coordenar × ser coordenado, quem tem estado entre as chamadas, o laço passo a passo, laço entre agentes | `01 - 05 - Agentes\02 Agente e subagente — coordenar, estado e laço.md` |
| subagentes com ferramentas, laço, rastro, entrega parcial, parada — e quem escolhe quem entra | `01 - 05 - Agentes\03 Agente principal, subagentes e ferramentas.md` |
| as ferramentas: quem recebe quais, limites de referência, respostas econômicas e honestas, as que escrevem, confinamento | `01 - 05 - Agentes\04 Ferramentas que o modelo chama.md` |
| um mini-catálogo de subagentes de vários domínios, como descrevê-los para o modelo e como nomeá-los | `01 - 05 - Agentes\05 Catálogo de subagentes e como nomear.md` |
| a ligação com o modelo (servidor ou embutido), os três modos de ter o modelo, parâmetros de geração, streaming, parar, limpar o raciocínio, retentar, os dois relógios | `06 - 11 - Modelo\06 Modelo local.md` |
| um programa que fala com um modelo externo (chave, sessão logada, nível de pensamento, qual assistente) | `06 - 11 - Modelo\07 Modelo externo — o que muda.md` |
| a conta do que cabe: tokens, orçamento, tetos em %, teto de saída, repetição, portão, paralelo, a trava (Revezamento — a proteção contra estrangulamento) | `06 - 11 - Modelo\08 Contexto, tokens e limites.md` |
| o que não cabe na janela: conferir do barato ao caro, dividir, costurar, gravar cada parte e retomar | `06 - 11 - Modelo\09 Dividir e costurar.md` |
| os prompts, o esquema, esquema × prosa × misto, formato garantido, resgate, correção por formato, conteúdo como dado | `06 - 11 - Modelo\10 Prompts e saída garantida.md` |
| a ordem das mensagens e o cache de prefixo | `06 - 11 - Modelo\11 Cache de prefixo e ordem das mensagens.md` |
| uma conversa com o usuário, com sessões, contexto inicial e subagentes | `12 - 15 - Formas de rodar\12 Chat.md` |
| tarefas longas com estado em disco, vocabulário de estados, Verificador e relatório | `12 - 15 - Formas de rodar\13 Fila.md` |
| algo que roda sozinho quando o disco muda: Detector, Espera, Revezamento, o grafo das rotinas, desfechos, pendências | `12 - 15 - Formas de rodar\14 Automação por evento e o grafo das rotinas.md` |
| passos já conhecidos: papéis em sequência, às cegas, dupla leitura, arbitragem, revisão humana | `12 - 15 - Formas de rodar\15 Ciclos de papéis fixos e revisão humana.md` |
| mandar arquivos ao modelo: filtro, tamanho, o que ele lê, preparo, RAG, se a resposta se salva | `16 - 19 - Dados e recuperação\16 Ingestão de arquivos.md` |
| embedding, busca semântica, régua de regenerar, reconhecimento, classificação, tópicos, duplicatas | `16 - 19 - Dados e recuperação\17 Modelos complementares — embedding, reconhecimento e classificação.md` |
| o que se salva, onde, com trava, migração, o jeito de gravar (atômico × acréscimo), backup; exportar | `16 - 19 - Dados e recuperação\18 Estado e persistência.md` |
| erros do começo ao fim: prevenir antes de chamar, de quem é a culpa → retentar? → para onde vai, gravar para recuperar, queda de energia, reabrir | `16 - 19 - Dados e recuperação\19 Erros, retentativa e recuperação.md` |
| a tela: quando um fluxo merece painel, o grafo, progresso, a tela de uma geração, botões apagados, logs, diagramas, grade de slots | `20 - 22 - Interface\20 Painéis, sinalização e visualização.md` |
| o painel de configuração, geral × do momento, exato × %, o que tem que ser configurável e o que fica fora | `20 - 22 - Interface\21 Configuração.md` |
| tokens, tempo, custo, log por tipo de evento, histórico com rotação por ciclos | `20 - 22 - Interface\22 Métricas, logs e histórico.md` |
| o programa como servidor de ferramentas; prompt montado para um assistente de fora; assistentes em terminais; onde cada assistente lê skills, comandos e MCP | `23 - Fora do programa\23 Agente externo — ferramentas, skills, comandos e MCP.md` |

**Entradas por sintoma** (o mesmo arquivo, outra porta):

| Estou vendo… | Abra |
|---|---|
| "contexto excedido" no meio de uma tarefa, ou o pequeno falhando junto com o grande | `08` (portão por tokens, janela única) |
| JSON cortado, "esperava `}`", resposta pela metade gravada | `10` (terminou? corte ≠ formato) e `08` (teto de saída) |
| resposta lenta em conversa longa, ou lenta a partir da rodada 3 | `11` (o prefixo mudou; histórico reescrito) |
| o modelo chama um subagente que não existe | `10` (system montado a cada envio, filtrado) |
| uma tarefa girou dezenas de rodadas sem sair do lugar | `03` (entrega parcial, rodada ≠ volta) |
| a rotina "travou" — ou era só lenta | `14` (sinal de vida, não timeout) |
| o usuário salva e nada acontece, sem nenhuma frase | `14` e `08` (esperando a vez em silêncio) |
| o segundo projeto ligado nunca gera nada | `14` (partida recusada em vez de enfileirada) |
| o botão está apagado e ninguém sabe por quê | `20` (o motivo ao lado) e `08` (Revezamento) |
| a resposta de um projeto aparece no chat de outro | `12` (evento sem dono; id não único) |
| a nota varia a cada geração | `15` (nenhum papel atribui nota) e `01` (quem dá o resultado) |
| o modelo inventou um nome de arquivo, de vizinho, de categoria | `15` (só se aceita o que existe) |
| o interruptor desligado religou sozinho | `21` (booleano com ramo próprio) |
| o projeto antigo abriu com o freio desligado | `18` e `21` (chave renomeada sem migração) |
| a tela mostra zero token num chat novo | `12` (o system vai sempre) |
| "0 reaproveitados" numa passada que reaproveitou tudo | `14` e `22` (dois nomes para a mesma conta) |
| a documentação está velha há semanas e nada diz por quê | `14` (erro engolido; base regravada cedo) |
| o programa não abre porque um modelo auxiliar falhou | `17` (fallback sem o modelo) |
| o assistente de fora repete a mesma chamada errada | `23` (erro escrito para o modelo) |
| "grande demais" num arquivo que só precisava ser dividido; ou o arquivo grande recomeça da parte 1 depois de uma queda | `09` |
| a mesma falha retentada dez vezes, ou retentada quando não devia | `19` (culpa → retentar? → destino) |
| depois de cair a energia, o estado abriu vazio, ou os interruptores amanheceram desligados | `18` (o jeito de gravar) e `19` |
| uma tarefa ficou "em execução" para sempre depois de reabrir | `19` (órfão) |
| o chat não deixa conversar enquanto uma automação roda | `08` (Revezamento — a proteção contra estrangulamento) |
| lista vazia em parte das respostas, com o esquema certo | `08` e `10` (mínimo = máximo quando se sabe o número) |
| o modelo repete o mesmo trecho até o teto | `08` (repetição ≠ falta de teto) |
| a correção falha sempre, no mesmo caractere | `10` (JSON inteiro com campo de fala) |
| o subagente relê o que já leu, a cada devolução | `02` e `03` (quem lembra por ele; rastro com a conta) |
| o conferente vira pesquisador e o laço não fecha | `02` e `04` |
| o modelo chama o subagente errado, ou a ferramenta certa com o argumento errado | `05` (roteamento negativo) e `04` (sugestões) |
| "Respondendo" aceso para sempre, ou a resposta foi parar noutra sessão | `12` e `20` (dono antes do `await`; desligar em todas as saídas) |
| trocar o tema desfez outra configuração | `21` (patch parcial) |
| o histórico diz que um ciclo rodou menos do que rodou | `22` (rotação por ciclos inteiros) |
| o grafo desenha uma ordem que o ciclo não executa | `14` e `20` (a cadeia é dado) |
| o assistente de fora continua vivo depois de fechar o programa | `23` (processo pago tem fim) |

## 4 · Vocabulário

Os arquivos usam estes nomes, sempre com este sentido. Se você abriu um arquivo só e um termo não está definido nele, está aqui.

| Termo | O que é |
|---|---|
| **agente principal** | quem recebe o pedido, escolhe os subagentes e escreve a saída; o modelo decide o próximo passo (chat com subagentes, fila) |
| **subagente** | agente chamado de dentro de um agente principal; sem memória entre chamadas; tem system, esquema e ferramentas próprios; nomeado pela função (Buscador, Leitor…) |
| **Verificador** | subagente acionado pelo programa quando a saída está pronta; confere em duas camadas (sem modelo, com modelo); aprova ou devolve |
| **papel** | um subagente dentro de um ciclo de papéis fixos; vê só o que precisa |
| **rotina** | unidade de trabalho da automação por evento; pode ou não chamar o modelo |
| **Detector** | o gatilho da automação: vê o que mudou no disco e decide quais rotinas isso merece |
| **Espera** | o freio: segura N segundos sem mudança nova antes de liberar um grupo de rotinas; tem chave |
| **Revezamento** | a vez na janela do modelo, uma só para o programa inteiro; sem chave; enfileira, nunca descarta |
| **a base** | as rotinas que rodam sempre e não se escolhem (detectar, hashes, sincronia) |
| **tarefa** | item da fila |
| **rodada** | uma ida ao modelo que consome orçamento (uma pergunta, uma rodada de ferramentas) |
| **volta** | qualquer ida ao modelo, inclusive correção e devolução; o teto de voltas é o cinto de segurança |
| **tiro único** | um prompt, uma resposta, acabou — sem histórico, sem cache a preservar |
| **tentativa** | uma repetição por reprovação (conferência, verificação, formato); tem teto, e na última aceita com marca |
| **envelope** | o JSON que o agente principal emite dentro da prosa, só para as chamadas de subagente |
| **formato garantido** | usar esquema no pedido para o servidor obrigar JSON válido; interruptor global |
| **resgate da resposta** | limpar rascunho e raciocínio na entrega, ficando com a **última** ocorrência; interruptor global |
| **entrega parcial** | o que o subagente já leu, devolvido quando ele não chegou a responder; não é resgate |
| **orçamento** | o que sobra da janela para o conteúdo, calculado de trás para a frente |
| **portão de admissão** | quem decide quantas requisições cabem na janela ao mesmo tempo, contando tokens |
| **prefixo** | o começo idêntico da conversa que o servidor reaproveita (cache KV); a ordem fixa o preserva |
| **sinal de vida** | a prova de que uma rotina ainda trabalha (bate o ponto, grava saída); substitui o timeout |
| **pendências** | o que ficou por processar em cada rotina, gravado para retomar |
| **em dúvida** | item em que duas leituras divergiram; espera a arbitragem do usuário |
| **configuração geral / do momento** | o painel (teto) × a escolha desta sessão ou envio (vence dentro do teto, e trava ao começar) |
| **preset** | um conjunto nomeado de escolhas aplicado de uma vez (assistente, rotinas, subagentes) |
| **ficha** | a descrição estruturada de um item (de um acervo, de uma imagem) que vai ao modelo no lugar do binário |
| **quem dá o resultado — (a) (b) (c)** | determinístico · o modelo propõe e o programa conta · só inferência (tabela do `01`) |
| **coordenador / coordenado** | agente é quem coordena; subagente é quem é coordenado — pelo modelo ou pelo programa — e sempre tem quem o coordene (→ `02`) |
| **bloco-resumo** | o que o programa manda ao subagente sem estado para ele saber o que já leu: as partes lidas e os erros, com a conta feita, substituído a cada rodada (→ `02`, `03`) |
| **roteamento negativo** | a parte da descrição de um subagente que diz o que ele não faz, e quem faz (→ `05`) |
| **proteção contra estrangulamento** | o mesmo que o Revezamento, visto de quem espera: a janela única compartilhada entre as áreas do programa — por ela, o chat não conversa enquanto uma automação roda (→ `08`) |
| **teto de atenção** | o máximo de itens por parte, independente de tokens (→ `08`) |
| **dividir e costurar** | mandar em partes o que não cabe e juntar os resultados numa chamada final, em rodadas se preciso; não é retentativa (→ `09`) |
| **costura** | a chamada — ou a rodada de chamadas — que junta os resultados das partes (→ `09`) |
| **teto por convergência** | o teto de um laço que encolhe o problema: para quando uma rodada não reduz mais (→ `01`, `09`) |
| **quem manda** | a chave que diz se os parâmetros de geração são do programa ou do servidor (→ `06`) |
| **dois relógios** | sem sinal de vida (renova a cada pedaço) × duração total (interrompe) (→ `06`) |
| **dívida** | rotina acordada por uma mudança e ainda não feita; riscada só no fim (→ `14`) |
| **dispensada · pulada · incompleta** | desfechos de rotina: nada a fazer · um pré-requisito não terminou · sem modelo carregado (→ `14`) |
| **gêmeo** | dois caminhos com o mesmo conteúdo; a saída de um é copiada para o outro sem modelo (→ `14`) |
| **órfão** | o que estava "em execução" quando o programa fechou; volta à fila com a conversa (→ `19`) |
| **patch parcial** | salvar só os campos que mudaram, sobre o que está no disco (→ `21`) |

## 5 · A ordem de leitura para quem começa do zero

`01` → `02` → `06` → `08` → `09` → `10` → `11` → a peça que for construir → `19` → `20` → `21` → `22` → `18`.

Cada arquivo de peça tem sempre as mesmas quatro seções, nesta ordem — **O que é e quando usar · Como se constrói · O que a tela mostra · O que fica salvo e configurável** —, e dentro de "Como se constrói" termina com **Erros comuns** e **Checklist ao construir**. É para você saber onde procurar sem ler o arquivo inteiro.
