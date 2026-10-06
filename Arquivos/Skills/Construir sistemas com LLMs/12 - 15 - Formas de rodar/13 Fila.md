# 13 Fila

## O que é e quando usar

Tarefas de **horizonte longo**: horas, dezenas de idas ao modelo, que não podem depender de a tela estar aberta nem de o usuário estar olhando. O usuário enfileira, a fila executa **uma tarefa por vez**, e cada tarefa termina num relatório conferido. É a forma certa para "pesquise isto no projeto inteiro e me diga", e a forma errada para uma pergunta de uma resposta (isso é chat).

A fila tem um agente principal por dentro (→ `03`) — quem escolhe o próximo passo é o modelo, com os mesmos subagentes do chat. O que a fila acrescenta é o **estado em disco**, a **execução sequencial**, o **Verificador**, o **relatório** — e um vocabulário de estados que a tela e o motor leem do mesmo jeito.

## Como se constrói

### Estado

- **Estado persistido em disco, sempre**: a tarefa, o estado dela, a contagem de rodadas e voltas, o log, o que já foi lido, o parcial. Fechar o programa e abrir de novo **retoma** — a tarefa que estava rodando volta para "aguardando a vez", nunca some.
- **Transações com trava de thread**: quem lê e grava o estado passa por um lugar só, com trava — a tela, a execução e o usuário mexem no mesmo arquivo.
- **Vocabulário fechado de estados e sub-tags**, com **mapa de migração**, igual no backend e no frontend. Um estado que a tela não conhece aparece sem cor e sem rótulo, e o cartão fica mudo sobre o que aconteceu: acrescentar um valor no backend é acrescentar a cor e o rótulo do lado da tela, **sempre**. Quando um estado é renomeado, o mapa converte o antigo na leitura — senão uma tarefa gravada na versão anterior amanhece num estado que ninguém reconhece.
- **Poucos estados, e o usuário lê menos ainda.** Um programa tinha sete estados de tarefa e reduziu para seis: "pronto com ressalva" virou "pronto" com sub-tags — dois estados para "terminou" faziam a lista ter duas linhas verdes com significados vizinhos. E "na fila" (o que você escreveu e ainda não mandou rodar) e "aguardando a vez" (o que já está em jogo) continuam dois no motor, mas o usuário lê "Na fila" nos dois; a diferença aparece pela **forma** do selo (vazado × cheio), não por rótulo novo.
- **"Concluída" fala do processo, não do veredito.** Uma tarefa que roda até o fim e conclui "não dá, falta X" está concluída. Quem usa "concluída" como sinônimo de sucesso faz a tela mentir.
- **As sub-tags são de três famílias que não se misturam:** *precisa de você* (o agente parou para perguntar), *ressalva* (o relatório saiu, com defeito conhecido), *falha* (não saiu relatório). Só as de **ressalva** são herdadas de uma passada para a seguinte — as outras explicam por que a passada anterior parou, e herdá-las faria o próximo relatório abrir com uma ressalva que já não vale.
- **Das ressalvas, só algumas o modelo tem direito de emitir.** As que são **fato conferido pelo programa** (arquivo inexistente, pesquisa incompleta, subagente indisponível) entram por conta do programa; o modelo nunca é fonte de fato verificável.
- **"Vai continuar" é um campo da tarefa, não um estado novo.** Um programa comparava estados por texto literal em vários lugares; um oitavo estado custaria uma varredura inteira. A tarefa continua no desfecho em que está e só ganha a marca — e a marca é **consumida** ao ser promovida, senão a tarefa voltaria a ser promovida sozinha em toda leva, para sempre.
- **Recuperação de órfãos e limpeza de logs** na abertura: tarefa cujo processo morreu volta para a fila; log de tarefa apagada vai embora.

### Execução

- **Sequencial e determinística.** Uma tarefa de cada vez; a próxima só começa quando a anterior terminou, falhou ou foi cancelada. Porquê: duas tarefas em paralelo disputam a mesma janela e leem a mesma documentação enquanto outra a reescreve.
- **A fila de execução respeita o Revezamento** (→ `08`): se outra ponta está com o modelo, a tarefa fica em "aguardando a vez" e começa sozinha quando a vez chegar. Ao iniciar, a fila **recusa** se outra ponta está rodando — é o caso em que recusar é honesto, porque há gente na frente da tela — mas as tarefas já enfileiradas **esperam**.
- **"Aguardando a vez" é intocável enquanto o ciclo roda, e a fonte de "está rodando" é uma só** — a mesma que acende o selo na aba e apaga os botões. Duas fontes divergem, e a tela mostra "rodando" com o botão de iniciar aceso.
- **Quem escolhe o próximo passo é o modelo.** A fila já foi um pipeline de etapas fixas (contexto → análise → verificação → relatório) e deixou de ser: o agente principal escolhe do mesmo jeito que o do chat, com os mesmos subagentes — mas responde **em JSON inteiro com esquema**, com a fala num campo, e não em prosa com envelope (→ `10`): na fila ninguém lê a prosa enquanto ela chega, e o envelope misto quebrava a correção numa aspa. A ordem fixa só faz sentido quando ela é conhecida de antemão — e aí é um ciclo de papéis fixos (→ `15`), não uma fila.
- **A máquina de estados tem as rotas escritas** — de qual estado para qual, por qual motivo — e uma rota fora da lista é erro. Um programa tem 17 rotas; não é muito, é o que existe.
- **Sem timeout por tarefa.** Uma tarefa que demora três horas e faz quarenta voltas passa. O cinto é a **contagem de voltas** (toda ida ao modelo, inclusive correção e devolução), folgada de propósito — existe porque eram as idas sem rodada que faziam o laço girar sem o contador avançar. Nenhum dos dois tetos é tempo.
- **Orçamento ≠ freio.** O orçamento de rodadas é o que a tarefa pode gastar; o freio (as voltas) é o cinto. No complemento do usuário, as devoluções zeram, as rodadas não — senão complementar vira um jeito de ganhar orçamento infinito. **A configuração fica congelada na tarefa**: mudar o teto no painel vale para as próximas.
- **A falha passageira da geração é tratada ali mesmo, dentro do orçamento de correções** — subir ao tratamento genérico de erro jogaria fora as rodadas já pagas da tarefa. E a tentativa de correção é **gravada antes** do teste de desistência: gravada depois, cada clique em "continuar" queimava uma das tentativas sem ela aparecer.
- **Contexto adicional do usuário no meio** ("complementar a tarefa") entra como mensagem de `user` na cauda, fundida com as vizinhas (→ `06`). A tarefa parada em "precisa de você" só continua quando ele responde — continuar sem responder é justamente o que não faz sentido, e por isso os botões de continuar não aparecem nesse estado.
- **Continuar aparece só onde há de onde seguir:** formato inválido e teto de rodadas (ambos "falhou") e relatório entregue. São três desfechos, e os botões só existem neles.

### O Verificador

- **Acionado pelo programa, não pelo modelo**, quando o relatório fica pronto. O modelo não pede para ser verificado; o programa vê o relatório e chama.
- **Duas camadas, nesta ordem:** (1) **sem modelo** — cada arquivo, símbolo ou caminho citado no relatório existe no índice? Pega a maioria dos erros de graça; (2) **com modelo**, com poucas ferramentas de conferir, lendo o que foi citado. O Verificador tem o **próprio teto de rodadas**, **maior** que o de quem responde — conferir custa mais chamadas que responder (→ `03`).
- **Devolução:** relatório reprovado volta ao agente principal com o motivo, para reescrever — com **teto de devoluções**, senão dois modelos discutem para sempre. Cada devolução é uma volta.
- **O lastro é do termo.** "Trecho não encontrado" só vale como reprovação se houve uma busca por **aquele** identificador; o programa tira da lista de reprovados o item que ninguém buscou. Sem isso, o Verificador reprova o que só não procurou.
- **Confere se o relatório responde à tarefa** (deriva), além de conferir o que ele cita. **Reprovar por gosto faz refazer trabalho bom**: o motivo da devolução é escrito **para o agente** que vai refazer, dizendo o que falta, não o que o Verificador preferia. Ferramenta que falhou não é prova de nada; critério que não tem ferramenta para ser conferido é pulado, não reprovado.
- **A falha do juiz não pune o julgado.** Veredito que veio em prosa em vez do formato, Verificador indisponível, arquivo citado fora do índice: nenhum desses reprova o relatório — e nenhum **aprova em silêncio**: o relatório sai com a ressalva "não conferido". **O juiz só reprova o que o julgado consegue consertar**; o que está fora do alcance dele não se confere.
- **O Verificador roda fora do pool e sem o sinal de parada do chat** — um Parar dado em outra aba não derruba a verificação de uma tarefa da fila (→ `03`, o padrão "ninguém me aborta").
- **Só o que passou pelo Verificador chega ao usuário como "concluído".** O que não passou fica visível como "falhou", com o motivo — nunca some.
- **O Verificador não é o antigo "julgar coerência entre etapas"** — aquele não relia arquivo nenhum. Verificar é ir ao disco.

### Encerramento

- **Relatório final em Markdown**, gravado na pasta da tarefa, com as citações conferidas e as ressalvas honestas no topo, item por item ("um subagente ficou indisponível").
- **Fallback em cada passo, e todo erro aparece na tela.** Falha do servidor ≠ falha do item; o parcial se grava; o cortado não; a tarefa que falhou diz **por quê** na própria linha da lista. Nada falha mudo. "Inconclusivo" saiu do vocabulário de um programa porque mentia: dizia que nada saiu quando o relatório existia e era aproveitável em parte.
- **Cancelar despromove**: a tarefa cancelada sai de "rodando" para "cancelada" com o progresso parcial guardado, e pode ser devolvida à fila.
- **Soma de consumo**: tokens reais de entrada e saída por chamada, somados por tarefa, gravados no estado (→ `22`).
- **Métricas por chamada** — quantas rodadas, quantas voltas, quantas devoluções, quanto tempo — ficam na tarefa, para a aba de chamadas mostrar.
- **Sinal ao vivo**: enquanto roda, a tarefa emite progresso (a rodada atual, o subagente em execução) para a tela — sem isso, "rodando" e "travada" são iguais por horas.

### Os prompts da fila

- **O agente principal da fila tem o seu system**, com o mapa de subagentes igual ao do chat e as regras de relatório.
- **Prompts fixos da fila são outros** que os do chat: os do chat são para conversa curta; os da fila ("segurança", "melhorias") são tarefas de pesquisa. A pasta no disco pode ser a mesma; as listas são duas.
- **O prompt do Verificador é arquivo próprio**, com o esquema irmão.
- **Os envelopes de resposta** (o de chamadas, o de relatório pronto, o de "preciso de você") são constantes, num lugar só, e o parse valida contra elas.

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| a tarefa "sumiu" depois de fechar o programa | estado só em memória | estado em disco; órfão volta à fila |
| um cartão sem cor e sem rótulo | estado novo no backend sem a tela saber | vocabulário fechado; acrescentar dos dois lados |
| tarefa antiga num estado que ninguém reconhece | estado renomeado sem migração | mapa de migração na leitura |
| a tarefa é promovida sozinha em toda leva | marca "vai continuar" não consumida | consumir ao promover |
| "rodando" com o botão de iniciar aceso | duas fontes de "está rodando" | uma fonte só |
| o relatório abre com uma ressalva que já não vale | sub-tag de falha herdada | só ressalvas herdam |
| "concluído" lido como "deu certo" | estado do processo confundido com veredito | o veredito está no relatório |
| dois modelos discutem para sempre | devolução sem teto | teto de devoluções |
| o relatório cita arquivo que não existe | Verificador só com modelo | camada sem modelo primeiro |
| o Verificador reprova o que ninguém buscou | "não encontrado" sem busca daquele termo | o lastro é do termo |
| o relatório aprovado sem ninguém conferir | a falha do juiz virou aprovação | ressalva "não conferido" |
| o Verificador devolve por falta de rodadas | teto menor para quem confere | teto maior para quem confere |
| a tarefa "travou" há três horas | nenhum sinal ao vivo | progresso para a tela; e sem timeout, porque três horas é válido |

### Checklist ao construir

- [ ] O estado da fila está em disco, com trava de thread, migração de versão e recuperação de órfãos?
- [ ] O vocabulário de estados e sub-tags é fechado, igual no backend e na tela, com mapa de migração?
- [ ] As sub-tags têm as três famílias, e só as de ressalva herdam?
- [ ] Execução sequencial, respeitando o Revezamento, com uma fonte só de "está rodando"?
- [ ] Sem timeout por tarefa; teto de voltas folgado; teto de devoluções?
- [ ] O Verificador é acionado pelo programa, em duas camadas, com teto próprio e maior, fora do pool e sem o sinal do chat — e a falha dele não reprova nem aprova em silêncio?
- [ ] Todo erro aparece na linha da tarefa, com o porquê, e o cancelado guarda o parcial?
- [ ] Os prompts fixos da fila são uma lista separada da do chat?
- [ ] A tarefa emite sinal ao vivo enquanto roda?

## O que a tela mostra

Sub-abas por tarefa, e a lista lateral de tarefas com o estado de cada uma:

- **Chat da tarefa:** o que o agente principal escreveu, rodada a rodada, com o envelope escondido.
- **Contexto enviado:** o histórico exato que foi ao modelo, para o usuário conferir o que o modelo viu.
- **Subagentes:** quais estão ligados para esta tarefa (trava ao iniciar).
- **Log incremental:** cada chamada, cada devolução, cada erro — conforme acontece.
- **Chamadas:** as métricas por chamada (rodadas, voltas, tokens, tempo).
- **A lista lateral:** estado com cor e rótulo (nunca só cor), "na fila" e "aguardando a vez" pela forma do selo, "falhou" com o porquê, "concluído" só depois do Verificador, e as ressalvas como selos ao lado.
- **Iniciar / Cancelar / Continuar / Devolver à fila / Complementar**, apagados com o motivo quando não podem (→ `20`); "precisa de você" abre um campo de resposta em vez de botões de continuar.

## O que fica salvo e configurável

- **Salvo (→ `18`):** o estado da fila (uma tarefa por entrada: estado, sub-tags, rodadas, voltas, devoluções, subagentes ligados, consumo, a marca "vai continuar"); o log por tarefa; o relatório; o rastro de leitura.
- **Configurável (→ `21`):** teto de rodadas; teto de voltas; teto de rodadas do Verificador; teto de devoluções; os prompts fixos da fila; quais subagentes existem.
