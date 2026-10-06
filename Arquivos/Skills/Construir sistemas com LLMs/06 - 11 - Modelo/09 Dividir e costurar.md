# 09 Dividir e costurar

## O que é e quando usar

Quando uma entrada não cabe na janela — um arquivo grande, uma pasta com centenas de filhos, uma conversa longa para resumir —, o programa não recusa: **divide** em partes do tamanho do teto de entrada, manda cada parte numa chamada, e **costura** os resultados numa chamada final. É a etapa 2 de quem não coube, **não uma retentativa**: nada falhou; a entrada era grande.

Use sempre que um item puder passar do teto de entrada (→ `08`). O que já está no `08` e vale aqui sem repetir: fatiar por fronteira natural, com o nome da fronteira como chave do pedaço.

## Como se constrói

### Antes de dividir: do filtro mais barato ao mais caro

Cada item passa por estas conferências, nesta ordem, e cada uma só roda se a anterior passou:

1. foi pedida parada?
2. tamanho em bytes, **sem abrir** o arquivo;
3. vazio — só espaço em branco (arquivo só com comentários **não** é vazio);
4. binário;
5. linhas — e linha longa demais;
6. tokens;
7. cabe? — janela − prompt − esqueleto da resposta − teto de saída − margem (→ `08`).

Porquê: abrir e tokenizar um arquivo de 200 MB para descobrir que era binário é o erro mais caro e mais evitável. E cada desfecho tem nome próprio: **ok · não cabe · parado · falhou** — uma parada pedida não é erro do item.

**A tela é um fluxo de três passos**, nesta ordem:

1. **Quanto cabe** — o teto de entrada, em % da janela (→ `08`).
2. **O que não cabe: dividir ou deixar de fora** — a escolha, com um interruptor.
3. **O máximo, mesmo dividindo** — acima disso, nem dividindo: vai para a lista de "grande demais", com o tamanho e o quanto passa. Porquê: um arquivo dividido em trinta partes custa trinta e uma chamadas; o usuário decide até onde vale.

### Dividir

- **Partes do tamanho do teto de entrada, cortadas no começo de uma fronteira** — um símbolo, um cabeçalho, um bloco —, nunca no meio de uma função.
- **Linha maior que o limite vira uma parte só**, mesmo passando dele: melhor uma parte grande que um laço que nunca termina tentando cortá-la.
- **Partes iguais, não gulosas:** 206 itens em duas partes são 103 + 103, e não 165 + 41 — a última parte pequena custa uma chamada inteira quase vazia, e a primeira grande fica encostada no limite.
- **Teto de atenção por parte** (→ `08`): além dos tokens, um máximo de itens por parte.

### A saída também divide

- **Uma entrada que cabe pode gerar uma resposta que não cabe** no teto de saída — e ela chega cortada. Porquê: num programa, a entrada cabia e a resposta voltava cortada, sem ninguém entender por quê. **Estime a saída antes** — tokens por item × número de itens × uma folga (60 tokens × 1,2 por item foi a conta medida num programa) — e divida a entrada pelo que a **saída** aguenta, não só pelo que a entrada aguenta.

### Costurar

- **Uma chamada final junta os resultados das partes**, com um prompt próprio de costura — não o mesmo da parte.
- **Em rodadas, se nem os resultados couberem:** agrupa os resultados em grupos que cabem, costura cada grupo, e repete com o que saiu.
- **Teto por convergência:** se uma rodada não reduziu o número de grupos, força grupos de dois — senão a mesma rodada se repete para sempre com o mesmo tamanho.
- **A tela diz a fase de cada item:** "parte 2 de 3", "costurando · rodada 2".

### Gravar cada parte e retomar

- **Cada parte se grava no disco ao terminar**, numa pasta de trabalho do item, com o hash da parte de entrada. Porquê: com as partes só em memória, uma queda no meio de um arquivo de trinta partes recomeça da parte 1 — e as vinte e nove prontas eram trabalho pago. É a regra "gravar o parcial" aplicada à costura.
- **Retomar começa da primeira parte que falta.** Ao reabrir, o programa lê a pasta de trabalho: parte gravada com o mesmo hash não se refaz; parte cujo hash mudou (o arquivo foi editado) se refaz — só ela.
- **A gravação de cada parte é atômica** — temporário e troca de nome (→ `18`): uma parte cortada ao meio pela queda não pode passar por pronta.
- **A costura só roda com todas as partes prontas.** Parte que falhou deixa o item em erro, com o nome da parte; as outras continuam gravadas para a próxima vez.
- **A pasta de trabalho se apaga quando a costura grava o resultado**, e as pastas de trabalho órfãs (de um item que não existe mais) somem na limpeza da abertura (→ `18`).

### Interruptor

- **Toda estratégia nova de lidar com entrada grande tem um interruptor que devolve o comportamento anterior**, e ele vale **igual para todos os consumidores** — senão uma rotina divide e outra recusa o mesmo arquivo. O item deixado de fora leva o motivo ("não coube; dividir está desligado").

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| "grande demais — refatore" num arquivo que só precisava ser dividido | recusar em vez de dividir | dividir e costurar; a lista fica para o que nem assim cabe |
| o arquivo grande recomeça da parte 1 depois de uma queda | partes só em memória | gravar cada parte ao terminar; retomar da que falta |
| uma parte cortada ao meio passou por pronta | gravação direta | parte gravada com temporário e troca |
| a entrada cabia e a resposta veio cortada | só a entrada foi dividida | estimar a saída e dividir por ela |
| a costura repete a mesma rodada para sempre | agrupar não reduziu | teto por convergência: grupos de dois |
| a função foi cortada ao meio | corte por tamanho cego | cortar no começo de uma fronteira |
| o laço de corte não termina | linha maior que o limite | linha grande vira uma parte só |
| uma rotina divide e outra recusa o mesmo arquivo | interruptor por consumidor | um interruptor, igual para todos |
| abrir o arquivo para descobrir que era binário | conferência cara antes da barata | do mais barato ao mais caro |

### Checklist ao construir

- [ ] As conferências vão do mais barato ao mais caro, e cada desfecho tem nome (ok · não cabe · parado · falhou)?
- [ ] A tela tem os três passos: quanto cabe · dividir ou deixar de fora · o máximo, mesmo dividindo?
- [ ] As partes são cortadas na fronteira, iguais, com teto de atenção, e a linha gigante vira uma parte?
- [ ] A saída estimada entra na divisão?
- [ ] A costura tem prompt próprio, roda em rodadas, e tem teto por convergência?
- [ ] Cada parte é gravada ao terminar, com hash e temporário + troca; retomar começa da que falta?
- [ ] A pasta de trabalho se apaga depois da costura, e as órfãs somem na abertura?
- [ ] Há um interruptor que devolve o comportamento anterior, igual para todos os consumidores?

## O que a tela mostra

- **Os três passos** na configuração, com o equivalente em tokens ao lado de cada % (→ `21`).
- **A fase de cada item** enquanto roda: "parte 2 de 3", "costurando · rodada 2".
- **A lista de "grande demais"** só com o que nem dividindo cabe, com o tamanho e o quanto passa.
- **"Retomado da parte N"** quando a costura continua de uma queda.

## O que fica salvo e configurável

- **Salvo (→ `18`):** a pasta de trabalho de cada item em costura, com uma parte por arquivo e o hash de cada uma — até a costura gravar o resultado.
- **Configurável (→ `21`):** dividir ligado ou desligado; o teto de entrada (% da janela); o máximo, mesmo dividindo; o máximo de itens por parte.
