# 14 Automação por evento e o grafo das rotinas

## O que é e quando usar

O programa reage a uma mudança **sem ninguém clicar**: algo mudou no disco (ou numa fonte qualquer), e há trabalho a fazer por causa disso — regenerar uma documentação, reindexar, reclassificar, recalcular. A unidade de trabalho é a **rotina**; quem decide o que rodar é o **Detector**; quem segura o gatilho é a **Espera**; quem cede a vez na janela do modelo é o **Revezamento**.

Use quando o trabalho é consequência de um evento e a resposta pode esperar segundos ou minutos. Não use para o que o usuário pediu agora (isso é chat ou fila). É a peça mais fácil de fazer funcionar no caminho feliz e a mais difícil de fazer funcionar no dia seguinte — porque o ciclo roda sem ninguém olhando, e um erro engolido vira "a documentação está velha há duas semanas e ninguém sabe por quê".

## Como se constrói

### O Detector — o gatilho

- **Vê o que mudou e decide quais rotinas isso merece.** É o gatilho do ciclo, não uma etapa dele. Enxerga as cinco operações — criar, alterar, renomear, mover, apagar — pelo aviso nativo do sistema, mais uma **varredura de segurança** periódica, porque aviso nativo perde evento.
- **Classifica cada mudança e grava a decisão em disco**, num arquivo que **sobrevive ao programa fechar**. Porquê: a mudança que aconteceu com o programa fechado ainda é mudança; e uma decisão só em memória some com a queda.
- **Impressões derivadas** para detectar rápido: hash dos imports, dos comentários, dos símbolos, do texto. Um arquivo que mudou de comentário não precisa de reindexação de imports. E **movido ≠ mudado**: pelo hash do conteúdo, mover ou renomear é só mover a saída derivada, sem chamar o modelo.
- **A linha de base dos hashes só se regrava depois de um ciclo completo.** Regravar depois de um ciclo interrompido apagava a única prova de que aqueles arquivos ainda deviam trabalho: a base passava a dizer "nada mudou" e a saída velha ficava para sempre. Era assim que "faltou um monte de coisa" virava permanente.
- **Às vezes o que a rotina faz é uma chamada ao modelo; às vezes é só uma conta.** As duas são rotinas. Um programa tem quinze; dez são determinísticas e nunca chamam modelo.
- **Réguas de regeneração**: um documento de texto (não código) mudou "o bastante" para regenerar do zero? Uma régua de similaridade semântica decide (→ `17`), em vez de regenerar a cada vírgula.
- **O Detector entrega; a Espera só segura.** Toda a varredura, o filtro de ignorados e o evento nativo ficam do lado do Detector. Um dado, um lugar.
- **Uma tabela "classe da mudança → rotinas"**: cada tipo de mudança acorda as rotinas que ele afeta, e **só as que custam modelo decidem** se vale chamar — as determinísticas rodam sempre, porque são baratas. **"Não sei" ≠ "nada a fazer"**: decisão ausente é "não sei" (roda); lista vazia é "nada a fazer" (dispensa).
- **Rotina acordada e ainda não feita é dívida**, riscada só no **fim** do trabalho dela, nunca no começo. E **rotina nunca é dispensada se nunca gerou, ou se terminou com erros**: num programa, 297 arquivos ficaram com "erro de conexão" para sempre, porque o Detector via "nada mudou" e dispensava.
- **O que a rotina de modelo não lê vem de uma lista explícita, nunca de convenção de nome.** Um filtro "começa com `_` = ignorar" escondia 20 arquivos e fazia 3 pastas sumirem do resultado sem ninguém ter pedido.

### A Espera — o freio

- **Segura N segundos sem nenhuma mudança nova antes de liberar.** O Detector avisa que algo mudou; a Espera espera o usuário parar de salvar. Desligada, libera na hora — e a detecção continua de pé. **O interruptor dela não desliga a detecção**: o que some é o silêncio exigido, não a vigilância; e como a trava garante um ciclo por vez, "desligada" não produz ciclos empilhados — produz o mais rápido que o programa consegue.
- **Três cronômetros, um por grupo de urgência.** Uma mudança rearma os três de uma vez; cada um dispara o seu grupo quando vence. O que precisa de resposta rápida (o índice de símbolos) tem uma espera curta; o que é caro (documentação gerada por modelo) tem uma longa. Cada grupo tem a sua chave de tempo na configuração — e **uma lista de caminhos por grupo**, porque os três disparam em momentos diferentes: com uma lista só, o primeiro a esvaziaria e o terceiro rodaria sem saber o que mudou.
- **A lista de caminhos só se limpa depois de o ciclo terminar bem.** A ordem antiga — desarmar o cronômetro, esvaziar a lista, **só então** rodar — fazia qualquer erro no meio cair num `except` mudo, e a mudança não voltava nunca mais. Falhou? Rearma em vez de desistir: os caminhos continuam na lista e o grupo tenta de novo mais tarde — com um **piso de espera** antes de tentar, senão um ciclo que falha com a Espera desligada volta a ser disparado no instante seguinte, para sempre.
- **Só o primeiro grupo roda a base** (Detector, hashes, sincronia); os outros vêm depois, na mesma leva de mudanças, e refazê-la não acrescenta nada.
- **Espera e "esperar a rotina terminar" são coisas diferentes**: uma é *quanto tempo de silêncio antes de disparar*; a outra é *quanto esperar depois de ter disparado*. Dois módulos, dois nomes.

### O Revezamento — a vez

- **A vez na janela do modelo, uma só para o programa inteiro.** Enquanto o chat, a fila ou outro projeto estiverem com o modelo, o ciclo espera a vez, e começa sozinho quando ela chegar. **Não tem chave para desligar**: desligar seria oferecer mandar duas gerações para a mesma janela.
- **Enfileirar, nunca descartar** (→ `08`): o Detector dispara por evento; se a trava recusasse em vez de esperar, a atualização se perderia em silêncio. Vale para a **partida manual** também: num projeto novo não há mudança para o Detector ver, alguém dá a partida — e com duas abas abertas, ligar a segunda não pode responder "já existe um ciclo rodando" e não fazer mais nada. A thread nasce sempre e espera a vez; o retorno é "não começou **agora**", com atrás de quem.
- **Uma vaga de partida por projeto, não uma por programa.** O que se impede é empilhar dois ciclos do **mesmo** projeto (clicar duas vezes, ou o botão somado à retomada de pendências) — o segundo reprocessaria o que o primeiro acabou de gerar. Dois projetos diferentes podem ter partida reservada ao mesmo tempo: é exatamente o que faz a fila existir.
- **Quem espera a vez pode acordar e descobrir que a aba fechou** — e desiste ali. Sem isso, o ciclo de um projeto que o usuário já fechou começaria do zero minutos depois, segurando a janela contra o projeto seguinte.
- **As configurações são lidas ao chegar a vez**, não ao entrar na fila: entre uma coisa e outra o usuário pode ter desligado rotinas, e vale o que está gravado agora.
- **A marca de "esperando" e a vaga reservada são limpas num `finally`**, não só no caminho feliz. Um erro dentro do ciclo deixaria a bolinha de "esperando outro projeto" acesa para sempre sem ninguém do outro lado — e a vaga presa, travando toda partida seguinte com "já tem um ciclo na fila".
- **Aparece na tela como card próprio**, separado da Espera: quando os dois eram um só, desligar o freio apagava a única frase que explicava "a outra aba está com o modelo", e o programa ficava parado sem nada dizendo por quê. O motivo de estar esperando fica num **campo próprio**, que a tela lê ao abrir — a aba pode estar fechada na hora.

### O pipeline — dependências e ordem

- **As rotinas têm dependências declaradas** (o índice depende do espelho; o pipeline depende do grafo), e o ciclo roda em ordem topológica. A ordem mora **num lugar só**.
- **A base**: as rotinas que não se escolhem — as que detectam, as que calculam hashes, as que sincronizam saídas com o código. Rodam sempre que qualquer outra estiver ligada, **por fora do laço**, nessa ordem, e nunca ganham chave ligada; na tela, o interruptor delas é substituído pelo selo "Sempre".
  - **Travar numa delas interrompe o ciclo inteiro**, e é a resposta certa: sem o Detector ninguém sabe o que mudou, sem os hashes ninguém pula o inalterado, sem a sincronia o espelho regenera com modelo o que era só para ser movido.
  - **O Revezamento aparece na seção "a base" da tela, mas não roda nada** — ele decide quando qualquer uma pode começar; pô-lo na lista de rotinas faria o ciclo tentar executá-lo.
- **Um único ponto de disparo** para o botão manual e para o ciclo automático. Um programa tinha dois caminhos, e eles divergiam: o botão fazia uma coisa e o ciclo outra. Com um ponto só, "rodar agora" e "rodou sozinho" são a mesma função com origens diferentes — e a retomada de pendências passa os grupos e os caminhos para refazer exatamente o ciclo que morreu no meio.
- **Os botões manuais das rotinas pertencem à mesma ponta que o ciclo automático toma** — durante o ciclo eles ficam apagados também, senão o usuário dispara por cima do que já está rodando.

### O grafo das rotinas

As rotinas não são uma lista: são um **grafo** — uma se alimenta do disco, outra da saída de uma terceira, outra de duas fontes. O ciclo roda esse grafo; o desenho dele na tela está no `20`.

- **A cadeia é dado, declarada num lugar só, e o desenho lê dali.** Uma cópia à mão da ordem, na tela, desenhava uma ordem que o ciclo nunca executou.
- **Declara-se "de quem dependo", não "a quem aciono".** Quem depende sabe do que precisa; quem aciona teria de conhecer todos os que vêm depois. Rotina sem requisitos declarados dá erro, em vez de rodar fora de ordem.
- **Três modos de exigir um requisito:** todos · só os ligados (exigir um que o usuário desligou travaria a rotina para sempre) · só os do mesmo lote.
- **Requisito dispensado conta como satisfeito; nó que falhou só derruba quem depende dele.**
- **A decisão de um filtro se lê depois de o produtor dela rodar** no mesmo ciclo. Lida antes, o "Iniciar" concluía sem gerar nada.
- **Pular por "nada mudou" renova o carimbo de fim e exige que as saídas existam.** Sem renovar, o vigia dá o nó como travado; sem conferir as saídas, um hash que bate pula um nó cuja saída foi apagada.
- **Fonte dupla:** o consumidor espera todas as fontes ligadas e roda no fim do lote mais lento, com um índice por fonte.
- **Grafo escrito por modelo ou por usuário pode ter ciclo.** Percorra com profundidade iterativa e lista de visitados, e avise quais nós formam o ciclo — não trave nem recurse até estourar. E **grafo que planeja ≠ grafo que observa**: o desenho do que vai rodar e o registro do que rodou são duas coisas.

### O ciclo — pendências e retomada

- **Pendências persistidas**: ao entrar no ciclo, o programa grava o que ficou por processar em cada rotina; risca conforme cada uma termina; lê na abertura do projeto. Falhou no meio, retoma de onde parou — e a faixa de retomada diz "a rotina X terminou com 4 erros", não só "terminou". **Terminar e ter feito tudo não são a mesma coisa.** **Retomar é por botão, nunca automático ao abrir**: a abertura mostra a faixa; quem religa é o usuário.
- **Sinal de vida em vez de timeout.** Uma rotina que demora dez minutos e uma travada são indistinguíveis pelo relógio; o que as separa é a rotina continuar dizendo que está viva — batendo o ponto a cada arquivo (o sinal mais barato e preciso), ou, para quem não empurra progresso, o arquivo mais recente da pasta de saída. O prazo se renova a cada sinal. Um tempo limite generoso não conserta nada quando falta o sinal, e um curto não quebra nada quando ele existe. Não misture as duas fontes numa espera: uma é relógio monotônico, a outra é hora de arquivo.
- **A ordem de prioridade para "terminou?"**: (1) o resumo da rotina no disco é mais novo que **o de antes** de ela começar → terminou; (2) a thread da rotina está viva → continua esperando, sem prazo (uma rotina de quatro horas sobre um projeto inteiro roda até o fim, que é o caso de uso); (3) thread morta sem resumo → caiu de verdade, desiste na hora — depois de uma última olhada, porque há uma fresta entre gravar o resumo e a thread acabar; (4) sem thread a quem perguntar (rotina síncrona, disparada por outro caminho) → a regra de inatividade, que virou o que o rótulo sempre prometeu: a rede para quando não há ninguém a quem perguntar.
- **Compare com o carimbo de antes, não com a hora do disparo.** O relógio do sistema anda em tiques; uma rotina rápida grava o resumo **dentro do mesmo tique** em que o ciclo anotaria "agora", e "mais novo que agora" dava falso para sempre — a rotina que terminou em três milissegundos era dada como travada.
- **O modelo nunca é fonte de um fato verificável.** Se o resumo não mudou no disco, a rotina não produziu nada — independentemente do que ela tenha respondido. O programa confere o arquivo, não a palavra.
- **Resumo "esta rotina falhou" gravado antes de produzir saída.** Sem ele, a rotina que caiu antes de gravar qualquer coisa parece nunca ter rodado, e o ciclo a dispara de novo — para sempre.
- **Interrupção honesta não é bug.** Aba fechada, projeto trocado, agente travado: uma exceção própria sinaliza "o ciclo parou por um motivo legítimo", e a tela diz o motivo em vez de mostrar um erro. E **nada mais é engolido**: o ciclo inteiro de um programa estava dentro de um `except: pass`, e qualquer erro que não fosse interrupção sumia sem log e sem aviso.
- **Desfechos com nomes diferentes, porque pedem ações diferentes:** **dispensada** (o Detector não viu nada para ela) ≠ **pulada** (um pré-requisito não terminou) ≠ **incompleta** (sem modelo carregado) ≠ **erro**. Dispensada satisfaz quem depende dela; pulada não. As pendências são gravadas **pessimistas** — tudo pendente até provar o contrário —, e uma thread morta sem ninguém dependendo dela não trava o ciclo.
- **Sem modelo carregado, o ciclo não termina com cara de sucesso.** As rotinas que precisavam do modelo ficam "incompletas", com os caminhos guardados, e o programa tenta de novo sozinho de tempos em tempos (a cada 30 s, num programa). Antes, eram puladas sem uma palavra.
- **A mesma interrupção com causas diferentes diz a causa real** — aba fechada, automação desligada, sem sinal de vida —, e quem vinha depois é avisado como "pulado", com o nome de quem travou (→ `19`).
- **Agregado só roda com os filhos prontos.** Um resumo de pasta só se gera com todos os filhos completos; pasta com filho faltando fica **adiada**, com o nome do filho culpado — sem erro próprio: o erro é o do filho. Filho que **nunca terá** saída (grande demais, fora do escopo) não trava o pai; filho que **falhou** trava, com o motivo. E o pai só se refaz quando uma parcela dos filhos mudou (uma porcentagem configurável); "mudou só espaço" não conta como mudança, e "mudou só comentário" conta quando o que se gera nasce dos comentários.
- **"Este projeto ainda existe na tela?" é uma pergunta diferente de "a vigilância caiu?"** A segunda só vale para ciclo disparado pela Espera; um ciclo de botão a ignorava por completo — que é o caso mais comum. Perguntar a certa em cada ponto.
- **Seleção automática do modelo carregado** no começo do ciclo (→ `06`), e o paralelismo real calculado pela janela dele (→ `08`).

### O que a rotina produz

- **Cada rotina escreve na sua pasta**, com um resumo (`_resumo`) que diz: quando terminou, quantos processou, quantos erros, quantos **reaproveitou** (o que não mudou não se regenera). O saldo — processados, total, erros, reaproveitados — vai para as pendências, para a faixa de retomada dizer o que falta.
- **Dois nomes para a mesma conta dão zero falso.** Um programa tinha uma rotina gravando a **lista** de reaproveitados e outra gravando o **número**; o histórico lia só um e dizia "0 de 802 reaproveitados" para uma passada que reaproveitou as 802. Zero falso é pior que campo ausente, porque parece resposta. E o nome do campo importa: "pulados" num lugar eram os grandes demais, noutro os reaproveitados — outra coisa inteiramente.
- **O registro de "processando" alimenta a aba de pendências** — inclusive para as rotinas que não contam arquivo. Um programa só mostrava três rotinas processando, porque só três batiam o ponto; a aba dizia "nenhum agente processando" com uma rotina rodando na frente do usuário.
- **Saída por item, erro por item**: um arquivo que falhou não derruba os outros; aparece na lista de erros com o nome.
- **A sincronia mantém as saídas em dia sem produzir nada novo**: arquivo apagado → apaga a saída derivada; movido → move a saída, sem modelo. A fila dela mora na decisão do Detector — havia duas listas da mesma coisa, e uma sobrou.
- **Hash com dois destinos vira "apagar", nunca "mover para o lugar errado".** Se o mesmo conteúdo apareceu em dois lugares ao mesmo tempo, a sincronia não adivinha qual é o movido. Sem a sincronia pelo hash, mover uma pasta reprocessava o projeto inteiro com modelo.
- **Gêmeo:** dois caminhos com o mesmo conteúdo — a saída de um é copiada para o outro sem chamar o modelo, com desfecho próprio ("copiado do gêmeo").

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| a documentação está velha há semanas e nada diz por quê | erro engolido; base regravada depois de ciclo interrompido | nunca `except: pass`; base só depois de ciclo completo |
| o usuário salva, espera, e nada acontece — sem frase | ciclo esperando a vez em silêncio | motivo num campo próprio; card do Revezamento |
| o segundo projeto nunca gera | partida recusada | enfileirar; "não começou agora" |
| a bolinha de "esperando outro projeto" fica acesa para sempre | marca não limpa no `finally` | limpar em qualquer saída |
| uma mudança "sumiu" da fila | lista limpa antes de rodar | limpar só depois de terminar bem; rearmar ao falhar |
| ciclo disparando sem parar depois de uma falha | sem piso de espera para tentar de novo | piso antes de retentar |
| rotina de 3 ms dada como travada | comparando com a hora do disparo | comparar com o carimbo de antes |
| rotina de quatro horas abortada | espera por relógio | sinal de vida; thread viva não tem prazo |
| rotina que caiu é disparada de novo para sempre | sem resumo de falha | gravar "falhou" antes de produzir |
| "0 reaproveitados" numa passada que reaproveitou tudo | dois nomes para a mesma conta | um nome, ou ler os dois |
| "nenhum agente processando" com um rodando | só quem conta arquivo se registra | registrar toda rotina ao começar |
| o botão faz uma coisa e o ciclo outra | dois pontos de disparo | um só |
| arquivos com erro "para sempre" | rotina com erro dispensada por "nada mudou" | nunca dispensar o que nunca gerou ou terminou com erro |
| o desenho mostra uma ordem que o ciclo não executa | ordem copiada à mão | a cadeia é dado; o desenho lê dali |
| "Iniciar" concluiu sem gerar nada | filtro lido antes de o produtor rodar | ler depois do produtor |
| o ciclo terminou "bem" sem modelo carregado | rotinas puladas em silêncio | "incompleta", e tentar de novo |

### Checklist ao construir

- [ ] O Detector grava a decisão em disco, usa impressões para detectar rápido, e distingue movido de mudado?
- [ ] A base de hashes só se regrava depois de um ciclo completo?
- [ ] A Espera tem um cronômetro e uma lista por grupo, limpa a lista só depois de terminar bem, e tem piso para retentar?
- [ ] O Revezamento enfileira (inclusive a partida manual de outro projeto), tem vaga por projeto, lê a configuração ao chegar a vez, e limpa marca e vaga no `finally`?
- [ ] O motivo de esperar fica num campo que a tela lê ao abrir, com o projeto dono?
- [ ] As dependências e a base estão num lugar só, e há um único ponto de disparo?
- [ ] A espera por rotina é por sinal de vida, com a ordem de prioridade, comparando com o carimbo de antes?
- [ ] O resumo "falhou" é gravado antes de produzir; interrupção honesta é exceção própria; nada é engolido?
- [ ] O resumo de cada rotina tem processados, total, erros e reaproveitados, com um nome só?
- [ ] Toda rotina se registra como "processando" ao começar, inclusive as que não contam arquivo?
- [ ] A cadeia é dado, declarada por "de quem dependo", com o modo de exigir requisito, e o desenho lê dali?
- [ ] Os desfechos dispensada · pulada · incompleta · erro são distintos, e rotina com erro nunca é dispensada?
- [ ] O agregado só roda com os filhos prontos, e o que a rotina não lê vem de uma lista explícita?

## O que a tela mostra

- **Acionamentos:** um card por rotina, com interruptor (ou o selo "Sempre", para a base), estado, última execução e o resultado dela; os botões "rodar agora" apagados durante o ciclo, com o motivo.
- **Os cards da Espera** (com os tempos por grupo e uma frase: "segurando — o código ainda está mudando") **e do Revezamento** ("aguardando a vez — o chat está com o modelo" / "bloqueado pelo projeto X", com cor própria).
- **A bolinha na aba** já no clique de partida — sem isso o projeto fica com cara de "não tem nada ligado" até a próxima volta do poll.
- **Visualizar:** o **diagrama de dependências** — cards ligados por setas, na ordem do ciclo, cada um com o resultado da última execução; o que roda pulsa (→ `20`).
- **Pendências:** o que falta processar por rotina, com progresso, separando rotina por arquivo de rotina por lote.
- **Histórico:** uma linha por ciclo, com o que rodou e quantos reaproveitou.
- **Erros:** de todas as rotinas, normalizados num lugar só (→ `22`).

## O que fica salvo e configurável

- **Salvo (→ `18`):** a decisão do Detector (por projeto, sobrevive ao fechar); as pendências do ciclo com o saldo; o resumo de cada rotina; o histórico em JSONL com rotação; as impressões derivadas; a linha de base dos hashes; o motivo de espera.
- **Configurável (→ `21`):** quais rotinas estão ligadas; os tempos da Espera por grupo; o piso para retentar; "desistir de esperar" (a rede de quando não há sinal); máximo em paralelo; as extensões que contam como código e as pastas ignoradas (→ `16`). **Chave renomeada tem migração** — sem ela, todo projeto existente amanhece com o freio desligado e sem aviso.
