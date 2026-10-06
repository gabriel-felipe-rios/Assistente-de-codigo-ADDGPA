# 04 Ferramentas que o modelo chama

## O que é e quando usar

As coisas que um modelo pode chamar — ler um arquivo, buscar, listar uma pasta, gravar um cartão —, esteja o modelo dentro do programa (um subagente) ou fora dele (um assistente de fora chamando o servidor de ferramentas do programa, → `23`). As regras são as mesmas para os dois: o modelo lê a **descrição** para decidir se chama, lê a **resposta** para decidir o próximo passo, e cada token que a ferramenta devolve é um token que não vai para o conteúdo.

A base está no `03` e vale aqui sem repetir: catálogo único com permissão por agente, dispatcher único, contrato de cada ferramenta, teto de itens e de tokens em toda resposta, escrita só na pasta da IA. Este arquivo acrescenta o que decide se uma ferramenta ajuda ou atrapalha: **quem recebe qual**, **quanto ela devolve**, **como ela responde** e **como ela se protege**.

## Como se constrói

### Cada papel com as suas

- **Cada papel recebe as ferramentas da função dele, não todas.** Grupos típicos: quem descobre **onde** (busca textual, índice por nome, documentação, glossário); quem **lê** um item para responder uma pergunta; quem **explica a estrutura**; quem **mede o impacto** de uma mudança (o conjunto mais largo); quem **acha por significado**; quem **lista** uma pasta (e nem chama modelo); quem **confere** (só ler e buscar o que foi citado). Exemplos por domínio: → `05`.
- **Quem confere não recebe as de descobrir** — senão vira um segundo pesquisador (→ `02`).
- **Permissão pela ferramenta ausente, não pelo texto.** "Não use a ferramenta de gravar", escrito no prompt, não protege nada: a ferramenta que o papel não deve usar simplesmente não está na lista dele. Cuidado com o padrão de alguns formatos de agente: **omitir a lista de ferramentas herda todas** — a lista curta tem de ser escrita.
- **Quatro listas que parecem uma e não são:** o catálogo (o que existe); o que chama modelo; o que só funciona numa certa tela; o que a validação aceita. Igualar qualquer par faz um papel aparecer numa tela onde ele não funciona, ou a validação recusar um que existe. Cada lista num lugar, e a relação entre elas escrita.

### Limites de referência

Os números de um programa, medidos. São ponto de partida, não regra — cada programa mede os seus.

| Limite | Referência | Observação |
|---|---|---|
| rodadas por chamada | 3; **quem confere: 5** | conferir custa mais chamadas que responder (→ `03`) |
| ferramentas por rodada | 4 | |
| subagentes em paralelo | 4 | é teto; o real depende da janela (→ `08`) |
| correções de formato | 2 | |
| rodadas seguidas só com erro | 3 | depois disso o caminho está errado, não a sorte |
| resposta de um subagente | 2 000 tokens, **mandado ao servidor como teto de saída** | sem ir ao servidor, uma resposta de 12 mil tokens era gerada inteira, paga inteira e jogada fora até 2 mil |
| leitura de um item | 15 000 tokens; em partes, 6 000 por parte | 97 % dos arquivos de um projeto cabiam em 10 000 — o teto existe para o monstro esquecido cortar e avisar |
| busca | 50 ocorrências, 20 arquivos | |

- **Rodada em que todas as ferramentas falharam não gasta orçamento, mas tem teto próprio** (→ `03`).
- **Teto de ferramenta é número exato; teto da janela é %.** O de ferramenta foi medido sobre o conteúdo e não muda com o modelo; o da janela muda (→ `08`, `21`).
- **A unidade segue o que o limite protege:** token protege a janela; byte protege a máquina (e decide antes de abrir o arquivo); caractere é só corte de apresentação.
- **Teto de leitura por consumidor, cercado por medição.** O modelo local e um assistente de fora aguentam tamanhos diferentes: cada um tem o seu teto, e o número vem de medir onde passa e onde é recusado (num programa, 15 832 tokens passaram e 19 369 foram recusados).

### Respostas econômicas

- **Leitura por seção, obrigatória, em vez do item inteiro.** Quando o que se lê tem seções (síntese, símbolos, conexões), a ferramenta exige dizer qual: 50 arquivos lidos inteiros davam cerca de 53 000 tokens; só a síntese dos mesmos 50, cerca de 3 400. **Vários alvos numa chamada** (`{"a.py": "sintese", "b.js": "simbolos"}`), para uma rodada valer por várias. E quando o teto corta, a resposta **termina com o pedido exato do que sobrou, pronto para colar** — o modelo não precisa montá-lo.
- **Três formas de fatiar um artefato grande:** partes **nomeadas** pela fronteira (a pasta, a cadeia); **níveis** com ids (a visão geral cita os ids do nível de baixo); e **filtro** (só o que passa por X). Sem o parâmetro de parte, vem o índice das partes com o tamanho de cada uma. **Nunca deslocamento numérico** (offset): o modelo não sabe onde uma coisa começa, e o número muda a cada edição. **O que cabe vai inteiro**, sem índice nem rastro.
- **Nome errado devolve até cinco sugestões, não a lista inteira**, com casamento tolerante (maiúscula, acento, separador). Porquê: devolver os cem nomes custava 1 562 tokens, contra 304 de um acerto.
- **A saída de uma ferramenta cola na entrada da outra** — o caminho que a busca devolve é o caminho que a leitura aceita, no mesmo formato.
- **A descrição ensina a escolher:** diz quando a ferramenta nativa do assistente é mais rápida, traz um exemplo trabalhado, e justifica com número medido ("409 linhas casam com 'todo' e há 0 marcadores" — é por isso que a busca tem o interruptor de palavra inteira).

### Respostas honestas

- **"Não está no índice" ≠ "ninguém usa".** A ferramenta diz qual dos dois; afirmar o segundo quando é o primeiro leva o modelo a apagar o que é usado.
- **Corte nunca mudo:** diz quanto ficou de fora e onde se muda o teto.
- **Aviso de velho só quando está velho.** Silêncio significa em dia. Dois avisos distintos: "atualizando" (a rotina que gera está rodando agora) e "desatualizado" (mudou e nada está regenerando). **Linha de base ausente não cala o aviso** — sem base, avisar é o certo. Um cache curto (segundos) evita medir a cada chamada.
- **Artefato ausente diz qual rotina o gera** — "gerado pela rotina X; rode-a", e não "não encontrado".
- **Validar o argumento antes do fallback.** Senão um erro de uso vira "nada encontrado". **O fallback se declara** ("busca literal — a busca por significado está indisponível"), e **a frase do erro passa inteira**, não um rótulo.

### Ferramentas que escrevem

- **Devolve o estado que ficou**, não "ok": o modelo decide o próximo passo sobre o que está no disco.
- **Vocabulário fechado, com a lista na recusa:** valor fora da lista volta com a lista dos aceitos; e **a recusa aponta a ferramenta certa** quando o pedido era de outra.
- **O que é fixo do processo não é argumento.** O projeto em que a ferramenta mexe é fixado quando o servidor sobe, não passado a cada chamada: um argumento que o modelo pode errar é um argumento que ele vai errar.
- **Trava entre processos** quando mais de um processo grava o mesmo estado (→ `18`).
- **Bloqueio determinístico só onde não é preciso julgar intenção.** Um movimento que o fluxo proíbe é recusado pelo código; o que depende de entender o pedido fica com o modelo e o usuário.
- **Um catálogo só descreve a ferramenta para a tela, para o prompt, para o gancho e para a verificação** — quatro cópias divergem.
- **A descrição diz "escreve"** (→ `23`).

### Confinamento

- **O canal do protocolo é só do protocolo.** Num servidor que fala pela entrada e saída padrão, a saída padrão pertence ao protocolo: nenhuma impressão de outra parte do programa pode cair nela — desligue, no processo do servidor, o que imprime —, e a codificação é fixada em UTF-8.
- **Tipos que o protocolo confunde:** um booleano pode chegar onde se espera um inteiro (em algumas linguagens, verdadeiro é 1). Valide o tipo, não só o valor.
- **Recorte por leitor:** o que o usuário tirou do escopo tem destinatário — ninguém · só o modelo local · só o assistente de fora · os dois —, e cada ferramenta respeita o recorte de quem está lendo.
- **Link circular e recursão têm fundo de poço** (→ `23`).

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| o modelo usa uma ferramenta que o prompt proibia | permissão pelo texto | a ferramenta ausente da lista |
| o papel recebeu todas as ferramentas | lista omitida herdou todas | escrever a lista curta |
| um papel aparece numa tela onde não funciona | duas listas diferentes igualadas | quatro listas, cada uma num lugar |
| a leitura de 50 arquivos encheu a janela | leitura do item inteiro | por seção, vários alvos numa chamada |
| o modelo não sabe continuar depois do corte | corte sem o pedido do resto | terminar com o pedido pronto para colar |
| um nome errado custou mil tokens | erro com a lista inteira | até cinco sugestões |
| o modelo apagou o que era usado | "não está no índice" lido como "ninguém usa" | dizer qual dos dois |
| "nada encontrado" para um argumento errado | fallback antes de validar | validar primeiro; fallback se declara |
| o modelo grava no projeto errado | projeto como argumento | fixo no processo |
| o servidor de ferramentas quebra o protocolo | impressão na saída padrão | canal só do protocolo |

### Checklist ao construir

- [ ] Cada papel tem só as ferramentas da função, e quem confere não tem as de descobrir?
- [ ] Permissão pela lista, escrita mesmo quando curta?
- [ ] Catálogo, "chama modelo", "só de uma tela" e "aceitos pela validação" estão separados, com a relação escrita?
- [ ] Os tetos por ferramenta são exatos e medidos, os da janela em %, e a unidade segue o que o limite protege?
- [ ] Leitura por seção, vários alvos, e o corte termina com o pedido do resto?
- [ ] Artefato grande em partes nomeadas, níveis ou filtro — nunca offset — e o que cabe vai inteiro?
- [ ] Erro com até cinco sugestões; saída de uma cola na entrada da outra?
- [ ] "Não está no índice" ≠ "ninguém usa"; aviso de velho só quando está velho; artefato ausente diz quem o gera?
- [ ] Argumento validado antes do fallback, e o fallback se declara?
- [ ] Ferramenta que escreve devolve o estado, recusa com a lista, e não recebe como argumento o que é fixo?
- [ ] Canal do protocolo limpo, tipos validados, recorte por leitor?

## O que a tela mostra

- **O painel de subagentes** (→ `20`) com as ferramentas de cada papel e os tetos, lidos da mesma tabela que o dispatcher usa.
- **No log de cada chamada:** a ferramenta, o alvo, quanto devolveu em tokens, e se cortou — com o quanto ficou de fora.

## O que fica salvo e configurável

- **Salvo (→ `18`):** nada próprio — o catálogo é código; os resultados de cada chamada ficam no log da tarefa ou da sessão.
- **Configurável (→ `21`):** ferramentas por papel; rodadas, ferramentas por rodada e paralelo; tetos de leitura por consumidor; tetos de busca; o teto de resposta do subagente, que vai ao servidor.
