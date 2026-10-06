# 05 Catálogo de subagentes e como nomear

## O que é e quando usar

Um catálogo de papéis — para escolher quais o seu programa precisa, descrever cada um para o modelo que vai chamá-lo, e dar nome. Os papéis abaixo são **exemplos de vários domínios**, não uma lista para copiar: um programa pode precisar de três, e dois deles podem nem estar aqui. A regra de tudo é a do `01`: **o nome diz a função, e uma função tem um nome**.

Use antes de escrever o primeiro prompt de subagente. A anatomia (quem coordena, quem tem estado) está no `02`; as ferramentas de cada um, no `04`.

## Como se constrói

### Antes do catálogo: esta etapa precisa de modelo?

- **Etapa sem juízo não chama modelo.** Se um algoritmo determinístico responde a pergunta **real**, o papel não existe — é função. Porquê: um programa achava funções duplicadas com embedding; levava minutos e achava "parecido em sentido", quando a pergunta real era "igual ou quase igual no texto" — um algoritmo de comparação respondeu em segundos, e certo.
- **Montar um prompt não é chamar o modelo.** "Explicar este erro" pode ser só juntar o erro e os trechos do código num prompt pronto, que o usuário manda quando quiser (→ `23`).
- **Nunca é papel:** listar pasta, contar, conferir se existe, calcular hash, comparar texto, validar contra uma lista.

### O catálogo, por domínio

| Domínio | Papel | Faz (em uma frase) | Ferramentas típicas | Não faz — e quem faz |
|---|---|---|---|---|
| código | **Buscador** | acha onde um nome aparece | busca textual, índice por nome | não lê para explicar — é o Leitor |
| código | **Navegador** | diz o que há em cada pasta | listar pasta (sem modelo) | não abre arquivo — é o Leitor |
| código | **Leitor** | lê um arquivo para responder uma pergunta sobre ele | leitura por seção, leitura de trecho | não procura onde uma coisa está — é o Buscador |
| código | **Arquiteto** | explica como as partes se ligam | índice de pastas, grafo de imports, documentação | não mede o impacto de uma mudança — é o Analista |
| código | **Analista** | diz o que quebra se X mudar | quem usa X, cascata de uso, grafo | não propõe a mudança |
| código | **Semântico** | acha pelo significado quando não se sabe o nome | busca semântica | não confirma: devolve candidato (→ `17`) |
| qualquer | **Verificador** | confere se a saída responde ao pedido e se o que ela cita existe | ler e buscar, só | não pesquisa, não reescreve, não dá nota |
| conhecimento | **Leitor de fonte** | extrai o que um documento diz sobre X, com o trecho | ler documento, buscar trecho | não conclui além do texto |
| conhecimento | **Planejador** | decide o que cobrir e o que não repetir | — (recebe o material) | não escreve o texto final — é o Redator |
| conhecimento | **Redator** | escreve a partir do plano | — | não inventa fonte |
| conhecimento | **Conferente** | diz se uma pergunta ou pedido é respondível, sem ver a resposta | — | não verifica fato — é o Verificador |
| conhecimento | **Corretor** | marca presente, ausente ou contradito, citando o trecho | — | não dá nota — a fórmula do programa dá (→ `15`) |
| atendimento | **Triador** | põe um pedido numa categoria de uma lista fechada | — | não responde o pedido |
| documentos | **Extrator** | tira campos de um documento: data, valor, partes | leitura, conversor | não decide se o documento vale |
| documentos | **Resumidor** | resume para uma finalidade dita no pedido | — | não opina |
| atendimento | **Redator de resposta** | escreve a resposta a partir do que o Extrator tirou | busca na base de respostas | não promete o que a base não diz |
| dados | **Consultor de dados** | responde "quanto" e "quantos" montando a consulta | consulta só de leitura, leitura do esquema | não altera dados |
| dados | **Explicador de série** | descreve o que uma série de números mostra | leitura do recorte | não calcula — o programa calcula |
| criação | **Variador** | gera N variações de um pedido | — | não escolhe — o usuário escolhe (→ `01`, forma 9) |
| criação | **Refinador** | muda a variação escolhida conforme o comentário | — (recebe o artefato) | não relê o histórico das rodadas |

### Como descrever um subagente para o modelo

Cada subagente ligado entra no system do agente principal como um bloco, sempre nesta ordem:

1. **`nome — o que faz, em uma frase.`**
2. **`Use para:`** duas ou três perguntas reais, escritas como o usuário as faria.
3. **`Exemplo:`** a chamada literal, no formato do envelope.
4. **`Não faz:`** o que parece dele e não é — e quem faz. "Ele lista PASTA; para ver o conteúdo, é o Leitor." "Se você já sabe o nome exato, use o Buscador — é mais barato." É o **roteamento negativo**, e é o que mais reduz chamada errada.

- **Números do prompt entram por marcador, nunca escritos à mão.** O prompt diz `{teto_rodadas}` e o programa preenche. Escrito à mão, a configuração muda e o prompt continua dizendo o número velho.
- **Campo que não é pergunta é avisado.** Uma chamada em que o campo "pergunta" traz uma ordem ou um nome solto volta com aviso, em vez de ser executada.
- **Para escolher por busca, quando o catálogo é grande:** cada item tem os campos "o que faz" **e** "o que não faz", os dois indexados. A escolha vai em dois passos — acha os candidatos → lê um trecho de cada → só então recomenda —, e o modelo **recomenda; nunca decide e dispara sozinho**.

### Como nomear

- **Pela função, com um substantivo de quem faz:** Buscador, Leitor, Verificador — o que ele **faz**. O método no nome ("Semântico") só quando é o método que distingue um papel do outro.
- **Um nome, uma função; uma função, um nome** (→ `01`).
- **O id é a forma técnica do nome:** minúsculas, sem acento, sem espaço, validado por regra fixa (`leitor`, `analista`). Id desconhecido é erro, não chamada.
- **Nomes vizinhos não podem se confundir.** Conferente e Verificador são dois papéis, e a descrição de cada um diz a diferença: o Conferente pergunta "é respondível?"; o Verificador, "é verdade?".
- **Nome que muda deixa o antigo proibido**, com o motivo, no vocabulário do programa (→ `01`).
- **O nome na tela é o mesmo do prompt.** Quem lê "Leitor" no log tem de achar "Leitor" no painel de subagentes.

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| um papel leva minutos e acha "parecido" onde a pergunta era "igual" | modelo onde um algoritmo respondia | etapa sem juízo não chama modelo |
| o modelo chama o Leitor para achar onde uma coisa está | descrição sem o que ele não faz | roteamento negativo |
| o prompt diz um teto e o programa usa outro | número escrito à mão no prompt | marcador preenchido pelo programa |
| o modelo escolhe e dispara um item errado do catálogo | escolha por busca em um passo | dois passos; o modelo recomenda, não dispara |
| "Conferente" e "Verificador" usados como sinônimos | nomes vizinhos sem a diferença escrita | a descrição diz a diferença |
| o nome antigo volta depois de renomeado | antigo não proibido | proibido no vocabulário, com o motivo |

### Checklist ao construir

- [ ] Cada papel passou pela pergunta "um algoritmo responde isto?"
- [ ] Cada papel tem função em uma frase, ferramentas e o que não faz — e quem faz?
- [ ] O bloco de cada subagente tem as quatro partes, nesta ordem?
- [ ] Os números do prompt entram por marcador?
- [ ] Os nomes dizem a função, os ids seguem a regra fixa, e nenhum par de nomes se confunde?
- [ ] O nome na tela é o do prompt?

## O que a tela mostra

- **O painel de subagentes** (→ `20`): cada papel com o nome, a frase do que faz, as ferramentas e o que não faz — o mesmo texto que vai ao prompt.

## O que fica salvo e configurável

- **Salvo:** os blocos de descrição, em arquivos de prompt ao lado dos esquemas (→ `10`).
- **Configurável (→ `21`):** quais papéis existem e estão ligados; as ferramentas de cada um (→ `04`).
