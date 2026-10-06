# 18 Estado e persistência

## O que é e quando usar

O que o programa guarda no disco, onde, e com que cuidados — para que fechar e abrir de novo não perca nada, para que duas partes do programa não gravem uma em cima da outra, e para que uma versão nova leia o que a anterior gravou. Toda forma de agente que tem estado (chat, fila, rotina, ciclo, lote) passa por aqui.

A regra que resume as outras: **salvar antes de perder**. O que já foi pago — uma resposta pela metade, três rodadas de leitura — se salva como parcial; o que pode sumir numa queda — a pergunta que o usuário acabou de escrever — se salva antes de qualquer coisa que possa cair. E a segunda regra: **o que está na tela é o que está no disco** — quando os dois divergem, o usuário está olhando para uma mentira.

## Como se constrói

### O que se salva, e onde

- **Cada arquivo mora sob a peça que o escreve**, com o nome que a tela usa. A pasta de dados espelha as abas do programa: as sessões do chat sob "Chat", as tarefas sob "Fila", as rotinas sob "Automação", cada rotina na sua pasta com o nome da tela. Porquê: quem procura a saída de uma rotina abre a pasta com o nome dela; e uma pasta "agentes" genérica misturava a saída de duas abas até ninguém saber de quem era o quê — e foi extinta.
- **Um lugar só monta os caminhos.** Nenhum módulo concatena "pasta do projeto + nome" à mão — era assim em 75 pontos de um programa, e é o que a existência de um módulo de caminhos proíbe. O mapa id → nome de pasta é uma constante, num lugar; um id fora do mapa levanta erro, não vira nome de pasta (um programa respondia "nunca rodou" sobre uma pasta que nunca existiu).
- **Valores de fábrica num arquivo só** (→ `21`); a configuração do usuário sobrescreve, nunca substitui. Configuração do programa e do projeto (workspace) são dois arquivos.
- **Dados do usuário, estado interno e cache são três pastas diferentes**: o que o usuário escreveu (nunca se apaga sozinho), o que o programa mantém (estado, pendências, configuração), e o que pode ser regenerado (índices, vetores, miniaturas). Apagar o cache tem que ser seguro; apagar os dados do usuário nunca é automático.
- **O que se salva por peça:**

| Peça | O que | Formato |
|---|---|---|
| chat | sessões: histórico cru, título, contexto inicial, prompts fixos, subagentes ligados; log por sessão; o contexto enviado | uma pasta por sessão, um arquivo por coisa |
| fila | estado de cada tarefa (estado, sub-tags, rodadas, voltas, devoluções, consumo, a marca "vai continuar"); log; relatório; rastro de leitura | um arquivo de estado da fila; uma pasta por tarefa |
| automação | a decisão do Detector; pendências do ciclo com saldo; resumo por rotina; histórico de ciclos; linha de base de hashes; o motivo de espera | por projeto; o histórico em linhas |
| ciclos | a saída de cada papel; os "em dúvida"; o resolvido; o oculto por certeza baixa; as pendências que um clique resolve | banco local ou arquivos por item |
| lote | uma fila por categoria com lista, cursor, estado e desfecho por nome | um arquivo com todas as filas, um bloco por categoria |
| modelos complementares | vetores por hash e por modelo; lista branca; votos; árvore | banco local |
| configuração | geral (do programa) e do projeto (workspace) | dois arquivos, com versão e migração |
| biblioteca do usuário | skills, comandos, servidores, prompts que ele escreveu | pastas por categoria (→ `23`) |

### Os cuidados

- **Trava de thread nas transações.** A tela, a execução e o usuário mexem no mesmo arquivo de estado; quem lê e grava passa por um lugar só, com trava. Sem isso, a gravação da execução apaga a edição do usuário que aconteceu um segundo antes.
- **Migração de versão do estado.** Todo arquivo de estado tem um número de versão, e a leitura converte o antigo. **Chave renomeada tem migração** — sem ela, o projeto gravado na versão anterior amanhece com um campo que ninguém lê, e o sintoma é silencioso: um freio que "desligou sozinho", um estado que a tela não sabe pintar. Um formato antigo sem chave de categoria vai para "a que estiver aberta, que é o único palpite honesto" — e a tela diz que foi palpite. Em banco local, **mudar a chave primária exige recriar a tabela** — o "criar se não existe" não migra nada, e a tabela velha continua com a chave velha; coluna nova entra por alteração da tabela.
- **Vocabulário fechado de estados**, igual no backend e no frontend, com o mapa de migração ao lado (→ `13`). Valor fora da lista é erro na leitura, não um estado novo.
- **Limpeza de órfãos na abertura.** Tarefa cujo processo morreu volta à fila; log de tarefa apagada vai embora; saída derivada de arquivo que não existe mais é apagada (é o trabalho de uma rotina de sincronia — → `14`); cache de versão antiga é apagado pela lista de caminhos antigos. O programa abre limpo, não acumula lixo por sessões.
- **Gravar o parcial, nunca o cortado.** Uma resposta parada pelo usuário, por queda do servidor ou por fechar o programa é **trabalho já pago**: grava-se como parcial, **marcada** — sem a marca, o pedaço vira balão de resposta normal ao reabrir, e a conversa passa a afirmar que o modelo respondeu aquilo por inteiro. Uma resposta **cortada por falta de orçamento de saída** não se grava: o arquivo anterior fica intacto, e o erro vai para a tela (→ `10`). A diferença: o parcial é honesto sobre ser parcial; o cortado seria apresentado como inteiro.
- **Gravação de emergência dentro do `except`, e ela nunca levanta.** Uma exceção da gravação de emergência substituiria o erro real por um erro de disco (→ `12`). E as variáveis que ela lê nascem **antes** do `try`.
- **Grava antes de avisar a tela.** A ordem "avisa, depois grava" perde a gravação se o aviso estourar — a janela pode ter fechado.
- **"Salvar antes de perder":** a pergunta do usuário se salva antes de o campo de texto ser esvaziado; o que o subagente já leu se salva antes de pedir a próxima coisa; o resumo "esta rotina falhou" se grava antes de a rotina produzir qualquer saída (→ `14`); o título da sessão se grava junto com a decisão (→ `12`); o cursor do lote se grava depois do lote, para significar "estes já passaram" (→ `01`).
- **O que está na tela vem do disco, não da memória da thread que roda.** Um título decidido só em memória volta ao antigo quando a lista é remontada; um estado só em memória some com o fechamento. Se a tela mostra, o disco tem.
- **A linha de base só se regrava depois do ciclo completo** — regravar depois de um ciclo interrompido apaga a única prova de que ainda há trabalho (→ `14`).
- **Nada é apagado.** O resolvido, o cancelado, o reprovado continuam visíveis numa seção própria ("já resolvidos", "cancelados"). Apagar é perder o histórico de por que algo foi decidido; esconder por padrão basta. O que o usuário apaga de propósito, o programa apaga — e diz o que vai junto ("apagar a tarefa apaga o log e o relatório dela").
- **Silêncio é proibido.** O que teve certeza baixa fica gravado — só não aparece por padrão, a menos que seja pedido. Descartar seria perder a informação de que o modelo hesitou.
- **A IA só escreve na pasta dela** (→ `03`): tudo o que o modelo grava por ferramenta vai para uma pasta própria; o resto do disco é do programa e do usuário.
- **Cada arquivo tem um único escritor.** Arquivo gerado pelo programa não é editado por um agente — e o agente é avisado disso: editar um arquivo gerado "não dá erro — e some" na próxima geração.
- **Backup não copia enquanto uma rotina escreve** (→ `08`, Revezamento): copiar é ler, e ler documentação em movimento guarda metade velha e metade nova. E o backup tem **lista própria** — herdar a de "ignorar do contexto" perdeu configuração e modelos em silêncio, num programa. Ele separa o regenerável **barato** (o que um analisador refaz em segundos: índices, hashes) do **caro** (o que o modelo gerou: documentação, resumos): o barato fica de fora; **o caro vai no backup**, porque regenerá-lo custa horas de modelo.
- **Versões deduplicadas por hash**: guardar versões de arquivo pelo hash do conteúdo, em pastas divididas pelos primeiros dígitos, e remover as órfãs — uma versão idêntica não ocupa duas vezes.
- **Histórico em linhas com rotação** (→ `22`): um evento por linha; gira **por ciclos inteiros**, nunca cortando um ciclo ao meio; nunca um arquivo que cresce para sempre.
- **O jeito de gravar decide o cuidado — não o que se grava.**
  - **Arquivo reescrito por inteiro** (estado de fila, conversa, configuração, pendências, documento gerado, parte de costura): **temporário + troca de nome, sempre.** Gravado direto, uma queda no meio deixa o arquivo cortado — um programa lia o JSON cortado como `{}`, e no dia seguinte todos os interruptores amanheciam desligados.
  - **Arquivo que só cresce** (log, histórico em linhas): **acréscimo no fim, sem temporário.** O pior caso de uma queda é perder a última linha — e a leitura pula a linha incompleta em vez de recusar o arquivo.
  - **Em nenhum caso a gravação nova vai por cima do que estava bom antes de estar completa:** se a geração falhou, a saída anterior não é sobrescrita, e a marca de "feito" não é gravada.
- **A troca de nome pode falhar porque alguém está lendo o arquivo** (em alguns sistemas, um arquivo aberto por outro processo não se substitui): tentativas curtas — 12 de 40 ms, num programa — e, esgotadas, o erro **sobe**. Engolir deixaria a gravação perdida em silêncio.
- **Arquivo de estado ilegível é posto de lado, nunca vira estado vazio gravado por cima.** Renomeie-o para `.ilegivel-{carimbo}`, avise, e comece do vazio — o usuário ainda pode recuperar o antigo.
- **Trava e gravação atômica resolvem problemas diferentes** — dois processos mexendo × queda no meio —, e o estado que dois processos gravam precisa das duas.

### Saída exportável

- **O que o usuário vai querer levar sai como um arquivo autocontido** — um HTML que se abre sem o programa, com os dados e a explicação dentro, sem dependência externa. Um programa exporta o currículo do usuário assim: uma página só, que abre em qualquer navegador, com as vistas e as fórmulas.
- **O exportado é uma foto**, com data no topo; não é o estado vivo. A tela diz isso, e diz o tamanho do arquivo e onde ficou.
- **Copiar para a área de transferência** é a exportação pequena: um envelope com cabeçalho e separadores, sempre no mesmo formato (→ `23`).

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| a edição do usuário sumiu um segundo depois | gravação da execução por cima, sem trava | transação com trava |
| o projeto antigo abre com o freio desligado | chave renomeada sem migração | migração na leitura |
| um estado que a tela não sabe pintar | valor fora do vocabulário | vocabulário fechado dos dois lados |
| o JSON de estado está ilegível depois de uma queda | gravação direta interrompida | reescrito inteiro: temporário + troca; ilegível vai para o lado |
| o backup não tinha a documentação gerada | o caro tratado como cache | o regenerável caro vai no backup |
| a resposta pela metade aparece inteira | parcial sem marca | marca de parcial |
| a saída derivada de um arquivo apagado continua lá | sem sincronia | órfãos limpos na abertura / pela sincronia |
| "faltou um monte de coisa" virou permanente | linha de base regravada depois de ciclo interrompido | base só depois de ciclo completo |
| "nunca rodou" sobre uma pasta que não existe | id fora do mapa virando nome de pasta | id desconhecido levanta |
| o backup guardou documentação meio velha meio nova | copiou durante a regeneração | backup entra na trava |
| o usuário apagou uma coisa e outra sumiu junto sem aviso | apagar em cascata silencioso | dizer o que vai junto |

### Checklist ao construir

- [ ] Cada dado mora sob a peça que o escreve, com o nome da tela, e um módulo só monta caminhos?
- [ ] Dados do usuário, estado interno e cache são pastas separadas, e apagar o cache é seguro?
- [ ] Todo arquivo de estado tem versão e migração, e o cuidado segue o jeito de gravar — temporário + troca no reescrito inteiro, acréscimo no que só cresce?
- [ ] Transações com trava; limpeza de órfãos na abertura?
- [ ] O parcial se grava com marca; o cortado não se grava; a emergência não levanta?
- [ ] A ordem é "grava, depois avisa a tela", e o que a tela mostra vem do disco?
- [ ] Nada é apagado sozinho; o oculto por certeza baixa fica gravado; o que vai junto ao apagar é dito?
- [ ] A IA grava só na pasta dela, cada arquivo tem um escritor, e o backup entra na trava, com lista própria que leva o regenerável caro?
- [ ] O exportável é autocontido, com data, e a tela diz que é uma foto?

## O que a tela mostra

- **"Salvo" / "salvando" / "falhou ao salvar"** onde houver gravação que o usuário disparou — e a falha diz o motivo (disco cheio, arquivo em uso).
- **A seção "já resolvidos" / "cancelados"**, recolhida por padrão.
- **A faixa de retomada** na abertura do projeto: "o ciclo parou em X, faltam N (com 4 erros) — retomar?".
- **"Palpite"** onde a migração teve que escolher.
- **Exportar**, com o tamanho do arquivo gerado, onde ficou, e a data da foto.
- **O que vai junto** antes de apagar.

## O que fica salvo e configurável

- **Salvo:** tudo desta peça — é a peça do salvo.
- **Configurável (→ `21`):** a pasta raiz dos dados; quantos ciclos o histórico guarda; quantos resolvidos mostrar; a pasta de exportação; a pasta própria da IA; a lista de exclusão do backup.
