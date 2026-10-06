# 17 Modelos complementares — embedding, reconhecimento e classificação

## O que é e quando usar

Outros modelos ao lado do modelo de linguagem, cada um para **uma** função que o modelo grande faz mal, caro ou devagar: transformar texto em vetor para busca e RAG (**embedding**), achar entidades num texto livre (**reconhecimento**), pôr um texto numa categoria de uma lista (**classificação**), descobrir a estrutura de um acervo (**descoberta de tópicos**). São pequenos, locais, e rodam em milissegundos onde o modelo grande levaria segundos — e são determinísticos onde o modelo grande varia.

São **exemplos de função, não obrigação** — um programa pode precisar só do embedding, ou de nenhum. "Depende do que se vai fazer." Mas quando a função existe, a regra é a mesma para todos: o modelo complementar propõe, o programa decide, e sem o modelo o programa continua funcionando.

## Como se constrói

### As regras comuns

- **Locais, embutidos na pasta do programa ou servidos** — nunca uma chamada de rede por texto (→ `06`, "modelo embutido"). Carregados uma vez, quando pedidos, e mantidos em memória; o cache de processo zera se o arquivo do modelo mudar.
- **Sempre com fallback sem o modelo.** "Quando não está instalado, faz do jeito simples e avisa." Um programa reconhece itens num texto livre com um modelo de entidades; sem ele, cai para "uma linha, um item" — pior, mas funciona, e a tela diz qual dos dois está em uso. Porquê: um modelo complementar é dependência opcional; o programa que não abre porque um modelo auxiliar falhou ao carregar está errado. E a tela **diz** que está no fallback — sem isso o usuário acha que está protegido e não está.
- **O modelo complementar também é caso (b) do `01`**: ele propõe (um vetor, uma entidade, uma categoria, uma árvore); o programa decide — valida contra o conjunto real, aplica limiar, pede confirmação ao usuário.
- **Chave pelo hash do conteúdo, nunca pelo caminho.** Copiar ou mover um arquivo não reprocessa; mudar uma vírgula reprocessa só aquele pedaço. A sincronia (→ `14`) move o registro junto quando o arquivo é movido, preservando o prefixo de caminho que já estava gravado.
- **Configurável:** qual modelo, tamanho do pedaço, limiares — na configuração geral (→ `21`), com o valor de fábrica num lugar só.
- **O tempo de carregar e de processar aparece na tela**, porque é o custo que o usuário não vê de outro jeito.
- **O modelo escreve sobre dado atômico, não sobre prosa que ele mesmo gerou antes.** Um índice de termos gerado a partir de resumos escritos pelo modelo — prosa sobre prosa — alucinava; gerado a partir dos símbolos e trechos originais, não. **Item que falha mantém o valor anterior sem atualizar o hash**, para ser tentado de novo; e **relevância em vez de teto**: entra o termo que aparece em N arquivos, não os K primeiros.

### Embedding — busca e RAG

- **Escolher o modelo conforme o material:** código × prosa × multilíngue; tamanho × custo. Um modelo de embedding treinado em prosa acha mal código, e vice-versa. O campo "modelo de embedding" existe na configuração, com o nome do que está em uso — e trocar de modelo invalida todos os vetores (vetores de modelos diferentes não se comparam), então o programa avisa e reprocessa.
- **O custo cresce com o quadrado do tamanho do pedaço.** Num programa: 512 tokens em cerca de 0,2 s; 8 192 em cerca de 17 s. **Fatiar antes de vetorizar**, por fronteira nomeada (→ `16`), e guardar o tamanho do pedaço como configuração. Um pedaço grande demais não é "mais contexto" — é um vetor que representa tudo e nada.
- **Vetores guardados em banco local** (uma tabela por tipo de material), com a matriz carregada em memória com cache invalidado pela data do banco — a busca não relê o disco a cada pergunta. Um cache por tipo, não um cache global que mistura.
- **Incremental por pedaço.** Só o pedaço cujo hash mudou é vetorizado de novo; o vetor é reaproveitado pelo hash **em qualquer lugar do projeto** (o mesmo trecho copiado para outro arquivo não paga de novo); o hash dos pedaços que não mudaram é recarimbado com a posição nova; pedaço órfão sai. **A busca deduplica por arquivo depois de pontuar** — deduplicar antes descarta o melhor pedaço do arquivo.
- **A busca semântica é achador, nunca resposta final.** Devolve candidatos com pontuação; quem confirma é o modelo de linguagem (lendo o candidato) ou o usuário. Apresentar o primeiro resultado como "a resposta" é o erro mais comum de RAG. A ferramenta que expõe a busca diz isso na descrição: "achador — confirme o candidato antes de agir".
- **Busca por nome e busca semântica são duas ferramentas**, não uma: quem sabe o nome quer o exato; quem só sabe descrever quer o parecido. Juntar as duas faz a exata devolver ruído.
- **Régua de similaridade para decidir se regenera.** Um documento de texto mudou: mudou "o bastante" para regenerar a saída derivada dele? Compare o vetor de agora com o **vetor de quando a saída foi gerada** — a base da régua **só anda quando o consumidor regenera**. Comparar com a versão anterior faria vinte mudanças de 1 % nunca somarem 20 %. **Arquivo = a menor similaridade entre os pedaços** — a média é proibida: um pedaço reescrito some na média dos inalterados; **pasta = média ponderada** pelo tamanho dos filhos; pedaço novo ou sumido vale 0; e **"sem vetor" não é 0** — um é "não sei", o outro é "mudou tudo". A régua pende para o lado de regenerar porque errar para mais custa uma chamada, e errar para menos deixa a saída velha para sempre.
- **Mapa 2D** dos vetores (uma projeção) para o usuário ver sobreposição e vizinhança — é visualização, não decisão. Com zoom e rótulos que somem quando afastado.

### Reconhecimento de entidades

- **Texto livre → itens estruturados.** "Tenho duas furadeiras e um martelo velho" → três candidatos, com quantidade, unidade, estado e nome limpo.
- **O modelo propõe; a tela revisa antes de gravar** (→ `15`, "revisão humana antes de gravar"). Nunca gravar direto o que o reconhecedor devolveu.
- **Normalizar antes de comparar:** tirar número, unidade e descrição de estado do nome; só então buscar no acervo por similaridade. As heurísticas de normalização são do programa, não do modelo — e são as mesmas que quem grava aplica.
- **O que o texto diz e o que o modelo reconheceu são campos separados**: quantidade e "tenho / não tenho" vêm do texto original por regra fixa; o modelo só recorta os nomes.

### Classificação

- **Um texto, uma categoria de uma lista fechada.** O modelo devolve a categoria e uma confiança; o programa aplica o limiar e manda para "em dúvida" o que ficou abaixo (→ `15`).
- **A lista de categorias é do programa**, não do modelo: categoria fora da lista é descartada com registro. E a lista vive num lugar só, com a cor e o rótulo que a tela usa.
- **Classificação com votação**: quando o custo é baixo, três leituras e maioria — e o empate vira "em dúvida", nunca desempate por uma quarta.

### Descoberta de tópicos

- **A estrutura nasce de um algoritmo sobre os vetores** (agrupamento hierárquico); **o modelo só vota nomes** para os grupos. Um programa constrói a árvore do acervo assim: o algoritmo decide a divisão; o modelo de linguagem propõe o nome de cada nó a partir das fichas do centro e da borda do grupo; o programa registra os votos e aplica com regras de coerência (profundidade máxima, tamanho mínimo, não dividir o que já está pequeno).
- **Separe "decidir a divisão" de "atribuir os itens"**: são dois passos, e o segundo pode ser refeito sem o primeiro ("só o que falta" × "tudo de novo").
- **Descrever um nó é outra tarefa** que nomear: o material que vai ao modelo são as fichas do centro (o que o nó é) e da borda (o que ele não é), ordenadas por similaridade — e tópico só existe depois que a montagem o criou, por isso descrever vem depois de montar.

### Duplicata semântica

- **Similaridade + histórico de análises + fusão decidida pelo modelo, aplicada pelo programa.** Dois itens acima do limiar viram um par candidato; o modelo diz qual é o canônico e se são de fato o mesmo; o programa funde os arquivos (ou registra "distintos" numa **lista branca**, para nunca perguntar de novo).
- **O histórico de análises é o que impede reanalisar o mesmo par a cada rodada** — e é o que a tela mostra quando o usuário pergunta "por que estes dois foram fundidos?".
- **Colisão na geração** (→ `01`, gerador em lote): o item novo parecido demais com um existente não é descartado — vai para um prompt de reescrita, com o existente à vista, e o programa registra a decisão.
- **Renomear em lote** (nomes em conflito → nomes únicos) é outra tarefa com o mesmo padrão: o modelo sugere, o programa aplica, a tela mostra antes.

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| o programa não abre porque um modelo auxiliar falhou | dependência opcional tratada como obrigatória | fallback sem o modelo, com aviso |
| o usuário acha que está usando o modelo e está no fallback | fallback silencioso | a tela diz qual está em uso |
| a busca "não acha nada" depois de trocar o modelo de embedding | vetores de modelos diferentes comparados | trocar invalida e reprocessa |
| o embedding demora minutos | pedaços de 8 mil tokens | fatiar; custo quadrático |
| copiar um arquivo reprocessa tudo | chave pelo caminho | chave pelo hash |
| o primeiro resultado da busca é tratado como resposta | achador lido como oráculo | confirmar o candidato |
| a busca exata devolve ruído | nome e semântica na mesma ferramenta | duas ferramentas |
| itens gravados errados em massa | reconhecimento gravado direto | revisão humana antes |
| categoria que não existe na lista | o modelo inventou | lista fechada; fora dela descarta com registro |
| o mesmo par de duplicatas perguntado toda rodada | sem histórico nem lista branca | registrar a decisão |

### Checklist ao construir

- [ ] Cada modelo complementar tem uma função só, é local, carregado uma vez, e tem fallback com aviso na tela?
- [ ] O que o modelo propõe é validado, limiarizado ou revisado antes de virar dado?
- [ ] Vetores e resultados são indexados pelo hash do conteúdo, e a sincronia move junto?
- [ ] O modelo de embedding é configurável, escolhido pelo material, e trocá-lo reprocessa?
- [ ] O pedaço é fatiado por fronteira, com tamanho configurável, antes de vetorizar?
- [ ] A busca semântica é apresentada como achador, separada da busca por nome?
- [ ] A régua compara com o vetor de quando a saída foi gerada, usa a menor similaridade por arquivo e a média ponderada por pasta, e distingue "sem vetor" de 0?
- [ ] O reconhecimento passa pela tabela de revisão; a classificação tem lista fechada e "em dúvida"?
- [ ] A descoberta de tópicos separa dividir de atribuir, e o modelo só vota nomes?
- [ ] Duplicatas têm histórico e lista branca?

## O que a tela mostra

- **Qual modelo complementar está em uso, e se é o fallback** — sempre visível onde a função é usada; e o tempo de carregar.
- **A busca semântica com pontuação** e o candidato marcado como "candidato", não como resposta; a busca por nome ao lado, separada.
- **A tabela de revisão** do reconhecimento antes de gravar.
- **O "em dúvida"** da classificação, com o botão de arbitrar.
- **O mapa 2D**, com zoom, como visualização.
- **Progresso do embedding** por lote (é a rotina mais lenta), com o custo por pedaço.
- **O par de duplicatas** com o histórico da análise e os botões fundir / distintos.

## O que fica salvo e configurável

- **Salvo (→ `18`):** os vetores por hash de conteúdo, em banco local, por tipo; o nome do modelo que os gerou; a lista branca de duplicatas e o histórico de análises; os votos de nome; a árvore e as atribuições.
- **Configurável (→ `21`):** qual modelo de embedding; tamanho do pedaço; limiares (similaridade para busca, para duplicata, para regenerar; confiança mínima para classificar); qual modelo de reconhecimento e de classificação, e se o fallback está permitido; profundidade e tamanho mínimo da árvore.
