# 15 Ciclos de papéis fixos e revisão humana

## O que é e quando usar

Quando **a ordem dos passos já é conhecida**, não se põe um agente principal para decidir o que já está decidido. É uma **sequência fixa de papéis**: ler, planejar, escrever, conferir, verificar, corrigir. O mesmo modelo em toda chamada; só o prompt muda; cada papel vê **só o que precisa** — e é isso, mais do que o modelo, que faz o resultado ser confiável.

Serve para uma prova, uma revisão editorial, uma auditoria, uma triagem, uma migração de dados, um pipeline de tradução, uma classificação em massa com conferência — qualquer coisa em que "o que vem depois" não depende do modelo. Um programa que mede o que o usuário sabe gera perguntas em seis ciclos assim; a mesma ideia serve para um programa que nunca fará uma prova.

Antes de desenhar, a tabela do `01` ("quem dá o resultado") para **cada passo**: neste ciclo, quase todo passo é o caso (b) — o modelo propõe, o programa conta. E é a forma em que **o humano entra no laço** de propósito: onde a precisão importa, o ciclo para e pergunta.

## Como se constrói

### A forma

- **Sequência fixa de papéis, chamada pelo programa.** Nenhum papel chama outro; nenhum papel decide o próximo. O programa chama o papel 1, guarda a saída, chama o papel 2 com o que o 2 precisa, e assim por diante. É "o mesmo motor da fila, papéis fixos": a diferença para a fila é só quem escolhe — lá o modelo, aqui o programa.
- **Mesmo motor, prompts diferentes.** Cada papel é uma chamada a um subagente sem memória (→ `03`), com system próprio e esquema próprio (raso, → `10`). O que muda de um papel para outro é o prompt e o recorte do material.
- **Cada papel vê só o que precisa.** Esta é a regra que sustenta as sete abaixo. Quem confere não vê o gabarito; quem verifica não vê a pergunta; quem interpreta não vê a resposta esperada. Contexto a mais não é "mais informação" — é viés. E o prompt do papel **diz** o que ele não vê ("não há pergunta nem contexto; julgue só a afirmação"), porque o modelo tende a procurar o que falta.
- **Um item de cada vez.** O ciclo que reúne o histórico de um tópico roda tópico a tópico, nunca todos juntos "para caber" (→ `08`). E **nunca em paralelo de verdade** dentro do ciclo: os papéis disputam a mesma trava, e o paralelo real é o da janela.
- **Ciclo que agrega de baixo para cima** — resumir os itens, depois os grupos, depois o todo — segue a regra do agregado: um nível só roda com o de baixo completo, e filho que falhou trava o pai com o motivo (→ `14`).
- **O programa guarda o produto de cada papel** — o plano, as perguntas, os vereditos, as leituras — antes de chamar o próximo. Um ciclo interrompido retoma do papel em que parou, com o item e a tentativa.
- **Todo ciclo tem um objetivo escrito e um critério de parada do programa.** O objetivo — o que conta como pronto — vai no prompt de cada papel e na tela; o critério de parada é conferido pelo **programa** (N itens aprovados, lista vazia, todos os pontos corrigidos), nunca pelo modelo dizendo "terminei". Porquê: sem objetivo escrito o modelo otimiza o que ele acha que é o objetivo; sem critério do programa, o ciclo termina quando o modelo cansa.
- **O ciclo escreve com clareza o que ele escreve.** Cada função do ciclo diz "escreve" ou "leitura" na descrição, porque a tela que chama uma delas ao abrir não pode disparar uma gravação (→ `20`).

### As sete regras

1. **Conferir às cegas.** Quem confere uma pergunta, um pedido ou uma instrução **não vê a resposta esperada**; diz só se é respondível, executável, clara. Reprovado volta ao começo. Porquê: com o gabarito à vista, todo conferente aprova — ele "entende" a pergunta porque já sabe a resposta. Um programa deu ao Conferente só a pergunta, sem os pontos-chave, e ele passou a reprovar perguntas que só faziam sentido para quem já sabia.

2. **Verificar em contexto isolado.** Quem verifica uma afirmação recebe **só a afirmação nua** — nunca a pergunta que a originou, nunca o motivo, nunca o material de onde veio. Reprovada, a afirmação volta para reescrever. Porquê: o contexto contamina o julgamento; uma afirmação errada lida junto com a pergunta parece plausível. Uma pergunta vira várias afirmações, e cada uma é verificada sozinha.

3. **Dupla leitura independente.** O mesmo papel roda **duas vezes**, sem ver a outra leitura; quando concordam, vale; quando divergem, o item vira **"em dúvida"**. Porquê: uma leitura só não tem como saber que errou; duas, quando discordam, mostram onde olhar. E o papel **cita o trecho** que sustenta cada marcação — sem citação, a divergência não tem como ser arbitrada.

4. **Arbitragem humana.** O "em dúvida" **fica visível até o usuário decidir**, com as duas leituras lado a lado; a decisão é dele, e só então o item vira número ou gravação. "Nada vira número sozinho." Porquê: a divergência é justamente o caso em que o modelo não é confiável; resolver por uma terceira chamada é fingir que é. E "não sei" ou vazio na resposta do usuário é **ausente em tudo** — não há piso de chute numa resposta discursiva.

5. **Nenhum papel atribui nota.** O modelo **classifica** — presente/ausente/contradito, sabe/não sabe, aprova/reprova — e o programa transforma isso em número por **regra fixa** (uma fórmula, uma tabela, uma contagem). "Impacto, dificuldade e nota nunca vêm do modelo nem de contagem crua." Porquê: um número que sai do modelo varia com a geração; um número que sai de uma fórmula sobre classificações é reproduzível, e dá para explicar ao usuário como foi calculado — e a fórmula não muda quando a forma da pergunta muda (a mesma fórmula serviu quando a unidade passou de "pergunta" a "ponto-chave").

6. **Só se aceita o que existe.** O modelo pode **alucinar um nome** — um vizinho, um arquivo, uma categoria que soa certa. Toda referência que ele devolve é **validada contra o conjunto real** antes de entrar; a que não existe é descartada com registro, nunca criada por causa disso. Um programa deixa um papel apontar "vizinhos" de um tópico, e só aceita vizinho que está no grafo. E o **nome que o modelo devolve raramente é igual ao pedido** ("parafuso" → "parafuso sextavado"): o programa liga o resultado pelo nome pedido, não procura de novo.

7. **Tentativas com teto.** Reprovado volta ao começo **até N vezes**; na última, o programa **aceita sem conferir e marca** ("aceito na 3ª tentativa, sem verificação") — em vez de girar para sempre. Porquê: um laço "reprova → reescreve → reprova" sem teto é a forma mais cara de não terminar nunca; e a marca honesta vale mais que a recusa muda. Uma resposta sem JSON válido cai na mesma regra: `None` é o chamador decidir — repetir, ou aceitar sem verificar na última.

### Mais três

- **Um ciclo fora da sequência, que só roda por ação explícita.** Um "revisar tudo" / "recalibrar" que relê o que já foi decidido e reajusta. **Nunca ao abrir a aba** — abrir uma tela nunca recalcula nem grava (→ `20`). O que ele pode fazer sem modelo (recalcular por fórmula), faz sem modelo; o que precisa do modelo roda **tópico a tópico**, e só nos tópicos cuja releitura mudou algo. A tela do ciclo manual tem o próprio indicador de "rodando" — não faz sentido a trilha inteira pulsar quando só ele roda.
- **Revisão humana antes de gravar.** Texto livre do usuário → o modelo propõe itens estruturados → **tabela editável** na tela (conferir, editar, apagar, reescrever com o modelo por linha) → só então grava. O que não existe ainda vai para uma fila de geração, e o desfecho volta para a linha **pelo nome pedido**, sem esperar a fila inteira acabar. Porquê: o modelo reconhece "duas furadeiras e um martelo velho" muito bem, e erra o suficiente para que gravar direto seja gravar lixo com cara de dado.
- **Desvio da ordem de serviço registrado no código, com o motivo.** Quando a obra não pôde seguir o que foi decidido, o código diz onde e por quê — e a decisão de "resolver com um clique explícito do usuário" vale mais que inventar um identificador para fechar o fluxo sozinho. Um programa tinha um ciclo que devia disparar o seguinte automaticamente; o seguinte exigia um identificador que só existe com uma prova aberta; em vez de inventar um, o programa grava a pendência e deixa o usuário disparar — e escreveu isso no topo do arquivo.

### O que fica gravado, e o que aparece

- **Cada papel grava a sua saída** (o plano, as perguntas, os vereditos, as leituras), para o ciclo poder ser retomado e para a tela mostrar. Só chega à etapa seguinte o que passou pelas anteriores, e o programa grava a marca "verificado" — não o modelo.
- **"Silêncio é proibido":** o que teve certeza baixa fica **gravado**, só não aparece por padrão — a menos que seja pedido. Apagar seria perder a informação de que o modelo hesitou. E o "?" do em-dúvida fica visível até o usuário arbitrar.
- **"Nada é apagado":** o resolvido continua visível numa seção própria ("já resolvidos").
- **O ciclo interrompido diz onde parou** — o item, o papel, a tentativa — e retoma dali.
- **A trava diz qual ciclo e qual item** ("Ciclo 2 · tópico X"), e é isso que a tela mostra — não o passo, porque o passo acontece dentro de uma chamada só do backend, sem evento intermediário (→ `20`).

### Exemplo anonimizado

Um programa que mede o que o usuário sabe gera perguntas em seis ciclos:

1. **Gerar** — ler o material (a ficha, os vizinhos no grafo, o histórico e os achados anteriores), planejar o que perguntar e o que não repetir, escrever perguntas com dois a quatro pontos-chave cada.
2. **Conferir às cegas** — cada pergunta é respondível? Sem o gabarito.
3. **Verificar** — cada ponto-chave como afirmação isolada. *(Só então o usuário responde.)*
4. **Corrigir e avaliar** — dupla leitura, ponto a ponto, citando o trecho; e um papel à parte interpreta a resposta sem ver os pontos-chave (o que ela revela além do pedido).
5. **Descobrir** — cruzar o que apareceu com os vizinhos que ainda não têm resposta e sugerir — só vizinhos que existem.
6. **Revisar** — manual, fora da sequência.

Nenhum papel dá nota — a nota é uma fórmula do programa sobre o que os papéis classificaram, e "em dúvida" espera o usuário. A ordem normal é 1 → 2 → 3 → 4 → 5 → 1; nada trava um ciclo de rodar fora dela se o motivo pedir. O **objetivo** de cada ciclo está escrito (uma leva de N perguntas aprovadas; todos os pontos-chave corrigidos), e o **critério de parada** é do programa: a leva está completa quando o contador diz, não quando o modelo diz.

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| o conferente aprova tudo | ele vê o gabarito | conferir às cegas |
| o verificador aceita afirmação errada que "faz sentido" | ele vê a pergunta e o motivo | contexto isolado |
| a nota varia a cada rodada | o modelo dá o número | o modelo classifica; a fórmula conta |
| o ciclo cria um tópico que não existe | referência do modelo aceita sem validar | só se aceita o que existe |
| o item nunca fecha | reprova → reescreve sem teto | N tentativas; na última aceita e marca |
| o item gerado não liga ao pedido | nome devolvido diferente do pedido, e busca por semelhança | ligar pelo nome pedido |
| abrir a aba disparou uma recalibração | função que escreve chamada na abertura | tela lê; ação explícita escreve |
| a tela mostra passo 2 de 3 e o backend está no 3 | progresso inventado | mostrar o que a trava diz; passos como referência |
| a divergência não tem como ser arbitrada | leituras sem citação | citar o trecho |
| itens gravados errados em massa | reconhecimento gravado direto | tabela de revisão antes de gravar |

### Checklist ao construir

- [ ] A ordem dos papéis está escrita no programa, e nenhum papel chama ou escolhe outro?
- [ ] Cada papel tem system e esquema próprios, e o prompt diz o que ele não vê?
- [ ] Para cada passo está decidido quem dá o resultado — e quase tudo é (b)?
- [ ] Quem confere não vê a resposta; quem verifica recebe só a afirmação nua?
- [ ] Há dupla leitura com citação, "em dúvida" visível, e arbitragem do usuário?
- [ ] Nenhum papel atribui nota; a fórmula é do programa e está explicada na tela?
- [ ] Toda referência devolvida é validada contra o conjunto real, e o resultado liga pelo nome pedido?
- [ ] Cada papel tem N tentativas e a última aceita com marca?
- [ ] O produto de cada papel é gravado; o ciclo retoma de onde parou; certeza baixa fica gravada?
- [ ] O ciclo manual só roda por clique, e a revisão humana vem antes de gravar?

## O que a tela mostra

- **A trilha de ciclos:** cards em sequência, na ordem, com o que cada um faz em uma linha; o que está rodando **pulsa**; o selecionado abre o detalhe com os passos **como referência** (o que aquele ciclo sempre faz, nesta ordem) — e só o passo que o backend de fato informa ganha o indicador de andamento. Não invente progresso que a tela não pode observar (→ `20`). A legenda diz: "é o mesmo modelo em toda chamada; só o prompt muda; cada papel só vê o que ele mandou".
- **O "em dúvida"** com as duas leituras lado a lado, os trechos citados, e o botão de arbitrar.
- **A tabela de revisão** antes de gravar, com editar, apagar e "reescrever com o modelo" por linha, e o desfecho da fila de geração chegando por linha.
- **A lista do que foi aceito sem conferir** (a marca da regra 7), separada.
- **O botão do ciclo manual**, apagado com o motivo enquanto outro ciclo roda, com o próprio indicador de "rodando".
- **Os achados** em três colunas (sabe / não sabe / confundiu), com o de certeza baixa recolhido por padrão.

## O que fica salvo e configurável

- **Salvo (→ `18`):** a saída de cada papel; os "em dúvida" pendentes; o resolvido (visível); as suspeitas com certeza baixa (gravadas, ocultas por padrão); o histórico do ciclo manual; as pendências de "sem ficha" que um clique resolve.
- **Configurável (→ `21`):** N de tentativas por papel; quantas leituras independentes; quantos itens por leva; o limiar de certeza a partir do qual algo aparece por padrão; o teto de itens por pergunta.
