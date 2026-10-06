# 19 Erros, retentativa e recuperação

## O que é e quando usar

Erro do começo ao fim: **prevenir** antes de chamar, **decidir** o que fazer quando algo falha — de quem é a culpa, se vale retentar, para onde o erro vai — e **gravar para recuperar**: de uma queda do servidor, do programa fechado no meio, da energia caindo. Retentar é a menor parte, e a mais perigosa, porque é uma chamada a mais.

Toda peça passa por aqui. O que é de cada uma continua no arquivo dela — o parcial do chat (→ `12`), a entrega parcial do subagente (→ `03`), as pendências da automação (→ `14`), o cuidado de gravação (→ `18`); este arquivo é a visão única, que liga as pontas.

## Como se constrói

### Prevenir antes: as conferências de cada chamada

Antes de chamar o modelo, do mais barato ao mais caro — cada uma só roda se a anterior passou:

1. foi pedida parada?
2. tamanho em bytes, **sem abrir** o arquivo;
3. vazio — só espaço em branco (arquivo só com comentários **não** é vazio);
4. binário;
5. linhas, e linha longa demais;
6. tokens;
7. cabe? — janela − prompt − esqueleto − teto de saída − margem (→ `08`); não cabe → dividir (→ `09`);
8. servidor de pé **e** modelo carregado — duas perguntas, duas frases: "o servidor não responde" (nada escuta na porta) ≠ "servidor de pé, nenhum modelo carregado";
9. a vez na janela (→ `08`).

Porquê: o que falha cedo falha de graça e com a frase certa. Um programa dizia "nenhum modelo carregado" quando, na verdade, nada escutava na porta — e a mesma frase para os dois mandava o usuário procurar no lugar errado.

### De quem é a culpa → retentar? → para onde vai

| Culpa | Exemplos | Retentar? | Para onde vai |
|---|---|---|---|
| **servidor — conexão** | conexão recusada, tempo esgotado, servidor ocupado ou fora (502, 503, 504) | **sim**, com espera crescente e teto (→ `06`) | esgotou: erro do item, "sem resposta do servidor"; N falhas seguidas pausam a fila (→ `06`) |
| **servidor — erro interno** | 500 | não — o mesmo pedido volta com o mesmo erro | erro do item, com o corpo do erro inteiro no log |
| **servidor — sem suporte** | recusa o parâmetro de esquema | não; desliga a garantia na sessão | um aviso só, "garantia de formato desligada" (→ `10`) |
| **modelo — formato** | JSON inválido, chave errada, só raciocínio | não retenta: **corrige**, dentro do teto de correções (→ `10`) | esgotou: entrega parcial, ou erro "formato" com o começo da resposta |
| **modelo — gramática** | escorregou do esquema nesta geração | não | erro daquele item; a garantia continua para os outros (→ `10`) |
| **modelo — repetição** | repetiu o mesmo trecho até o teto | não — aumentar o teto não resolve | erro "repetição" (→ `08`) |
| **tamanho** | resposta cortada no teto de saída; entrada maior que a janela | não | cortada: erro "faltou orçamento de saída", e nada se grava; entrada: dividir (→ `09`) ou a lista de "não cabe" |
| **item** | ilegível, vazio, binário, fora do escopo | não | desfecho "não cabe" ou "pulado", com o motivo — **outra lista** que a de falhas (abaixo) |
| **usuário** | parada pedida; aba fechada | nunca | não é erro: desfecho "parado", quieto, sem vermelho |
| **juiz** | o Verificador quebrou; veredito fora do formato | não | não pune o julgado nem aprova em silêncio: sai com a ressalva "não conferido" (→ `13`) |
| **disco** | trava disputada; troca de nome recusada porque alguém está lendo; disco cheio | **sim, curto e com teto** — espera curta repetida (15 s de teto, num programa) | esgotou: erro explícito — **responder "feito" seria a pior saída** |

- **Retentar é para o que muda sozinho** — o servidor volta, a trava solta. O que depende do pedido não muda repetindo o pedido.
- **Nenhum interruptor de "retentar item".** Retentar um item é uma chamada a mais; a resposta ruim vira erro, e o arquivo anterior fica intacto. É um campo que não existe de propósito, e a configuração diz isso (→ `21`).
- **Uma retentativa só, a do programa:** a escondida da biblioteca cliente fica desligada (→ `06`), e a espera de disco escondida do sistema é trocada por uma controlada, com teto e erro.
- **A falha passageira é tratada onde aconteceu**, dentro do orçamento de correções daquela tarefa. Porquê: subir ao tratamento genérico de erro jogaria fora as rodadas já pagas.
- **Dois relógios para a chamada** — sem sinal de vida (renova) e duração total (interrompe) —, e tarefa longa sem limite de duração (→ `06`).

### Duas listas: o que falhou e o que não cabe

- **"O que falhou"** — tentar de novo resolve — e **"o que não cabe"** — só mudar o item ou o limite resolve — são duas listas, cada uma com a sua frase de ação. Porquê: numa lista só, o usuário retenta o que nunca vai caber; um programa mostrou uma lista só durante meses.
- **Desfechos por item, lista fechada:** ok · não cabe · parado · falhou. **Parada pedida não é erro do item.**
- **Formatos antigos de erro são normalizados na leitura**, sem migrar o disco.
- **O erro que derrubou a rotina antes do primeiro item vira um item** — "(a rotina não chegou a rodar)". Senão a lista de erros fica vazia justamente quando tudo falhou.
- **O item que falhou conta no progresso** — sem contá-lo, a barra trava antes do fim (→ `20`).

### A mensagem certa

- **A causa real, não a mais genérica.** A mesma interrupção com causas diferentes diz qual foi — "a aba foi fechada", "a automação foi desligada", "a rotina parou de dar sinal de vida" —, e quem vinha depois é avisado como "pulado", **com o nome de quem travou** (→ `14`).
- **Não prometer o que não vai acontecer.** Ao desistir, o texto cru não vira resposta, e a mensagem só aponta onde o dado existe de fato.
- **A frase do erro passa inteira**, não um rótulo; e o fallback se declara (→ `04`).
- **Recusa depois de anunciar desfaz o anúncio.** A tela que disse "aguardando a vez" e depois foi recusada volta ao estado de antes — senão fica "aguardando" sem ninguém rodando.
- **Modelo local fora do ar:** nada roda, e a tela diz isso com clareza — sem trocar de servidor nem de provedor sozinho (→ `06`).

### Gravar para recuperar

| O que | Quando se grava | Como (→ `18`) |
|---|---|---|
| estado da fila | a cada evento e mudança de estado | reescrito inteiro: temporário + troca de nome |
| histórico de cada tarefa | **antes** da 1ª chamada, e depois de cada rodada, correção, devolução, cancelamento e erro | reescrito inteiro: temporário + troca |
| conversa do chat | no começo do envio, no fim do turno, e em emergência (→ `12`) | reescrito inteiro: temporário + troca |
| pendências das rotinas | **ao entrar** no ciclo; riscadas a cada rotina (→ `14`) | reescrito inteiro: temporário + troca |
| "esta rotina terminou sem produzir nada" | quando a rotina morre sem gravar saída | reescrito inteiro |
| partes da costura | cada parte, ao terminar (→ `09`) | um arquivo por parte, temporário + troca |
| configuração; estado que dois processos gravam | a cada mudança | temporário + troca, **e** trava entre processos |
| log; histórico de ciclos | a cada evento; a cada ciclo | acréscimo no fim |

- **A lista do que falta se grava antes de começar**, e se risca item a item. Gravada depois, ela só registraria o que deu certo: um ciclo terminou com a lista de pendentes vazia e quatro rotinas que nunca saíram.
- **Todo caminho de saída grava o que houver**, e as variáveis que a gravação lê nascem antes do `try` (→ `02`).
- **Ao fechar o programa, cada trabalho em andamento sabe "como me gravar agora"** — registrado quando o trabalho começa —, e essa gravação nunca levanta exceção.
- **Um carimbo "em andamento" vai ao disco antes da operação longa**, para quem sai e volta não receber a mesma oferta de novo.
- **A saída boa anterior não é sobrescrita por uma geração que falhou**, e a marca de "feito" só se grava junto com a saída.

### Queda de energia e reabertura

- **O que uma queda no meio de uma gravação deixa:** o arquivo reescrito inteiro fica no antigo, porque a troca não aconteceu; o que só cresce perde a última linha; o temporário que sobrou é lixo — **os temporários órfãos da pasta de dados se apagam na abertura**, e as pastas de trabalho de costura de itens que não existem mais também (→ `09`).
- **Arquivo ilegível na abertura vai para o lado**, com aviso, e nunca vira estado vazio gravado por cima (→ `18`).
- **O que estava "em execução" ao reabrir é órfão:** nenhum processo o está rodando. Volta para a fila (ou para "pendente") **com a conversa guardada**, e a tela diz que foi interrompido. **Com o programa aberto**, destravar um item que parece preso é **botão** — e só se a trava de execução estiver livre; senão o botão soltaria um item que está rodando de verdade.
- **Retomar sem repetir chamada paga:** a costura recomeça da primeira parte que falta (→ `09`); a tarefa da fila, da rodada seguinte à última gravada, com os contadores gravados (→ `13`); o chat, das chamadas barradas que ficaram gravadas (→ `12`); a automação, das pendências — **por botão, nunca sozinha ao abrir** (→ `14`).

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| "nenhum modelo carregado" quando nada escutava na porta | uma frase para duas causas | duas conferências, duas frases |
| a mesma falha retentada dez vezes | retentar o que não muda sozinho | a tabela de culpa |
| cada "tentativa" da tela esconde três | a retentativa escondida da biblioteca | uma só, a do programa |
| o usuário retenta o que nunca vai caber | "falhou" e "não cabe" numa lista só | duas listas, cada uma com a sua ação |
| a lista de erros vazia quando tudo falhou | o erro antes do primeiro item não virou item | "(a rotina não chegou a rodar)" |
| "feito" com a gravação perdida | espera de disco sem teto, erro engolido | teto curto; esgotou, erro explícito |
| "aguardando a vez" sem ninguém rodando | recusa depois do anúncio | desfazer o anúncio |
| depois de cair a energia, o estado abriu vazio | reescrito direto, ilegível lido como vazio | temporário + troca; ilegível vai para o lado |
| a tarefa ficou "em execução" para sempre depois de reabrir | órfão não recuperado | órfão volta à fila com a conversa |
| o ciclo terminou com a lista vazia e rotinas que não rodaram | pendências gravadas depois | gravar antes de começar, riscar item a item |
| a tarefa caiu e não gravou nada | uma saída sem gravação | todo caminho de saída grava |

### Checklist ao construir

- [ ] As conferências antes da chamada vão do mais barato ao mais caro, com "servidor fora" ≠ "sem modelo"?
- [ ] Cada falha do programa tem a sua linha na tabela de culpa → retentar? → destino?
- [ ] Só se retenta o que muda sozinho, com teto, e a retentativa é uma só?
- [ ] "O que falhou" e "o que não cabe" são duas listas, e parada não é erro?
- [ ] A mensagem diz a causa real, não promete o que não vai acontecer, e desfaz o anúncio na recusa?
- [ ] A tabela "gravar para recuperar" tem a linha de cada estado do programa, com quando e como?
- [ ] Todo caminho de saída grava; o fechamento grava cada trabalho em andamento sem levantar?
- [ ] Na abertura: temporários órfãos apagados, ilegível posto de lado, "em execução" vira órfão com a conversa?
- [ ] Retomar nunca repete chamada paga, e a automação retoma por botão?

## O que a tela mostra

- **Duas listas:** "o que falhou" (com "tentar de novo") e "o que não cabe" (com "o que mudar").
- **A fase da retentativa**, quando houver: "tentativa 2 de 3 · de novo em 8 s".
- **"Interrompido ao fechar — retomar?"** no item órfão, e a faixa de retomada na abertura (→ `18`).
- **"O servidor não responde"** ≠ **"nenhum modelo carregado"** no indicador do modelo (→ `06`).
- **"Arquivo ilegível — o antigo foi guardado como …"** quando a abertura pôs um arquivo de lado.

## O que fica salvo e configurável

- **Salvo (→ `18`):** tudo o que a tabela "gravar para recuperar" lista; os erros por item, normalizados (→ `22`).
- **Configurável (→ `21`):** as esperas e o número de retentativas de conexão; o teto de espera de disco; N falhas seguidas até pausar; os dois relógios (→ `06`). **Não configurável, de propósito:** "retentar item".
