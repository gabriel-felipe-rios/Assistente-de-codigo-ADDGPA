---
description: Explica qualquer coisa de forma visual — um conceito, uma tecnologia, o funcionamento do projeto em que você está, um erro que apareceu — e salva a explicação como uma página HTML cheia de tabelas, diagramas e gráficos.
argument-hint: [o que você quer entender]
---

# /explicar-conceito-visualmente — explicação visual de qualquer coisa

Você vai explicar **o que o usuário pediu**, e a explicação vai sair como uma **página HTML visual** — não como parágrafos.

Ele é genérico de propósito. Serve para um conceito que o usuário está estudando, para uma tecnologia que ele pensa em adotar, para o funcionamento do projeto em que ele está, para um erro que apareceu, para qualquer coisa que ele não esteja entendendo. **O assunto vem sempre do argumento — nunca escolha o assunto por ele.**

> ## A regra que vale mais que todas: a forma segue a pergunta
>
> Nunca despeje texto corrido. Antes de escrever uma linha, decida **que desenho responde essa pergunta** — o CATÁLOGO DE FORMAS, mais abaixo, é para isso.
>
> E nunca use tudo o que o catálogo tem. **Duas a quatro formas bem escolhidas explicam melhor que dez espalhadas.** Página cheia de gráfico que ninguém pediu não é página visual, é poluição — e esconde o desenho que importava.

## O que tem neste arquivo

| Parte | O que é | Quando ler |
|---|---|---|
| **Os 5 passos** | como conduzir a tarefa, do argumento até a página pronta | sempre, na ordem |
| **CATÁLOGO DE FORMAS** | 18 verbetes: para que serve, quando usar, quando NÃO usar, e o desenho pronto | no Passo 2, para escolher; no Passo 4, para desenhar |
| **O esqueleto da página** | o HTML inteiro, pronto para preencher — não monte do zero | no Passo 4, antes de escrever a página |
| **Um caso do começo ao fim** | um pedido real percorrido inteiro: investigação, escolha das formas, página resultante | quando estiver em dúvida sobre como conduzir |
| **Os erros que estragam** | o que faz uma página visual ficar ruim, e o que o leitor sente quando acontece | antes de começar a escrever a página |
| **Conferência antes de entregar** | a lista que você roda na sua própria página, no fim | sempre, antes de responder no chat |
| **🎨 PADRÃO VISUAL** | as cores, o vidro, a barra de abas — copiar daqui | quando estiver montando o HTML |

> ⚠️ **Este arquivo não tem modos nem perfis, e isso é de propósito.** Não existe "modo
> tecnologia", "modo erro", "modo conceito". Perfil é gaveta, e gaveta obriga o assunto a caber
> nela — mas quem chama este comando está travado em algo que não vem em sabores prontos. O que
> substitui o roteiro fixo é a escolha de forma do Passo 2, guiada pelo catálogo. **Se você se
> pegar querendo criar um roteiro por tipo de assunto, pare: é exatamente o que este comando
> decidiu não ter.**

---

# Os 5 passos

## Passo 1 — Descobrir de onde vem a resposta

O assunto pode ter três origens, e você decide pelo que ele escreveu.

### Origem A — do projeto em que você está

Vale quando o argumento cita um arquivo, uma pasta, uma tela, um comportamento do programa, ou usa "este projeto", "aqui", "meu programa". Investigue **nesta ordem**, parando assim que tiver o suficiente:

1. **Arquivo de instruções na raiz** (`CLAUDE.md`, `AGENTS.md`, `README.md`) — dá o vocabulário do projeto e o mapa mental de quem o escreveu.
2. **Servidor MCP do projeto, se houver** — costuma responder sobre estrutura e relações sem exigir leitura arquivo por arquivo. Se não houver, siga.
3. **Busca por nome** — o termo que o usuário usou, e as variações óbvias dele. Em projeto escrito em português, lembre que acento não dobra: `funcao` não acha `função`.
4. **Leitura direta** dos arquivos que a busca apontou.

Cite o que encontrou como `arquivo:linha`. Explicação sobre código sem endereço é palpite bem escrito.

### Origem B — do mundo

Vale quando o assunto é uma tecnologia, biblioteca, protocolo, serviço ou padrão que existe fora do projeto. **Pesquise** quando a resposta depende de versão, preço, limite, estado atual do ecossistema ou de qualquer coisa que mude com o tempo. **Não pesquise** quando o assunto é estável — um conceito de ciência da computação de trinta anos não precisa de confirmação na internet.

### Origem C — do conhecimento geral

Vale quando o assunto não tem nada a ver com código nem com o projeto: biologia, história, finanças, o que for. Responda direto, com o mesmo rigor.

### As três podem se misturar — mas não force

Uma pergunta sobre o sistema imunológico não pede leitura de código; "como este projeto salva os dados" não pede pesquisa na internet. Use só as origens que a pergunta realmente tem.

### Quando não souber, diga na página

Se depois de investigar sobrar um pedaço que você não conseguiu confirmar, **escreva isso na página**, numa seção curta de "o que eu não consegui confirmar", dizendo o que falta e onde ele encontraria. Um parágrafo confiante e errado custa muito mais caro que um buraco declarado: o usuário vai construir em cima dele.

⚠️ **Este comando roda em qualquer pasta.** Nunca assuma que existe mapa do projeto, pipeline, glossário, base de conhecimento, servidor MCP ou qualquer estrutura específica. Se existir, aproveite; se não existir, siga sem — e nunca reclame da ausência.

## Passo 2 — Escolher a forma ANTES de escrever

Olhe a pergunta e responda três coisas. Cada "sim" aponta um pedaço do catálogo:

| Pergunte-se | Se sim, olhe |
|---|---|
| **A pergunta compara coisas?** | tabela comparativa · matriz 2×2 · mapa de calor · antes/depois · código lado a lado |
| **A pergunta tem ordem, caminho ou dependência?** | diagrama de fluxo · linha do tempo · árvore de decisão · grafo de nós · árvore |
| **A pergunta tem quantidade?** | barras · radar · dispersão · proporção do todo · cartões de número |

Se nenhuma das três der "sim", o assunto é conceitual puro — e aí a forma costuma ser **camadas empilhadas** (para mostrar o que se apoia em quê), **cartões de glossário** (se o assunto tem termo novo demais) ou um **diagrama de fluxo** do mecanismo.

Escolha de 2 a 4 formas. **Escrever primeiro e "ilustrar depois" produz decoração, não explicação** — o desenho feito no fim só repete o que o texto já disse, em vez de carregar a informação.

### O método aplicado a pedidos reais

Estes são **exemplos da escolha**, não modelos a seguir. O mesmo assunto, perguntado de outro jeito, pede outras formas.

| O que ele digitou | As formas | Por quê |
|---|---|---|
| *"o que fazem os arquivos de prompt da pasta `prompts/`"* | tabela comparativa · cartões de número | seis itens com os mesmos aspectos; os números resumem o tamanho da pasta |
| *"como este programa salva os dados"* | diagrama de fluxo · árvore · código lado a lado | é caminho de um dado (fluxo), passa por arquivos (árvore), e o trecho que grava merece ser visto |
| *"por que o build quebrou"* | sintoma → causa → conserto · código lado a lado | assunto é erro; e a linha que causou aparece melhor marcada que descrita |
| *"o que é um mutex"* | diagrama de fluxo · antes/depois · cartões de glossário | o mecanismo tem ordem no tempo; o problema aparece comparando dois estados; e o assunto traz termo novo |
| *"vale a pena trocar o banco de dados?"* | radar · prós e contras em tabela · barras | duas opções em vários critérios; e o peso de cada custo |
| *"como funciona o sistema imunológico"* | camadas empilhadas · linha do tempo · cartões de glossário | as barreiras se apoiam umas nas outras; a resposta tem ordem no tempo; e há muito termo novo |

Repare que **nenhuma linha usa as 18 formas**, e que a mesma forma aparece em contextos completamente diferentes. É isso que o catálogo é: um repertório, não um roteiro.

### Quando o assunto é grande demais para uma página

Acontece com pedidos como *"me explica este projeto"*. Não tente caber tudo — uma página de vinte seções não é lida.

1. **Escolha o recorte que responde a pergunta**, que quase sempre é o caminho principal, não o inventário completo.
2. **Diga o que ficou de fora**, no fim, em três ou quatro linhas — não como desculpa, como mapa: *"ficou de fora o sistema de plugins, que é assunto próprio."*
3. **Nunca resolva isso encolhendo tudo.** Sete seções rasas ensinam menos que três fundas.

## Passo 3 — Montar a explicação

Só três coisas são obrigatórias, e nesta ordem:

1. **O que é, em uma frase** — sem jargão. Se não couber numa frase, você ainda não entendeu.
2. **Como funciona** — o mecanismo, a peça central. É aqui que mora o desenho principal.
3. **Onde isso aparece na prática** — o exemplo concreto. Se o assunto for do projeto dele, é aqui que entra `arquivo:linha`.

Depois dessas três, acrescente **só o que o assunto pedir**, e nada por obrigação:

| Acrescente… | Quando |
|---|---|
| analogia do dia a dia | o mecanismo é abstrato e a frase inicial não bastou |
| prós e contras | há uma escolha real a fazer |
| alternativas | existem outras opções que ele pode confundir com esta |
| o que costuma dar errado | é algo que ele vai **usar**, não só entender |
| o que confundem com isso | o nome é parecido com o de outra coisa |
| onde isso entra no projeto dele | o assunto tem relação com o código em volta |
| o que eu não consegui confirmar | sobrou buraco depois de investigar |
| próximo passo | ele vai decidir alguma coisa depois de ler |

**Nunca escreva uma seção só para preencher roteiro.** Seção sem conteúdo real é pior que seção ausente: ela ocupa o lugar de uma que teria valor e ensina o leitor a pular seções.

### Profundidade e tom

- **Jargão**: todo termo técnico é explicado na primeira vez que aparece, em cinco palavras, ali mesmo. Nunca deixe o leitor sair da página para entender a página. Se o assunto tem mais de seis termos novos, use os **cartões de glossário** (forma 18).
- **Tamanho**: de **3 a 7 seções**. Menos que três não justifica a navegação por abas; mais que sete e ele não termina. Se o assunto não couber em sete, ele é grande demais para uma página — escolha o recorte que responde a pergunta e diga, no fim, o que ficou de fora.
- **Exemplo**: quando o assunto é do projeto, o exemplo é um trecho real com `arquivo:linha`. Quando é do mundo ou geral, o exemplo é do mundo — nunca invente um projeto fictício para ilustrar um conceito que já tem exemplo real.
- **Não explique o que não foi perguntado.** Cada seção a mais é uma seção que ele precisa pular para achar o que queria. Ser completo não é a mesma coisa que ser útil.

### Como escrever a prosa que acompanha o desenho

O desenho não se explica sozinho, e o texto não pode repeti-lo. Cada um faz metade do trabalho:

- **Uma frase ANTES do desenho, dizendo o que olhar.** *"Repare que os três primeiros passos acontecem antes de qualquer arquivo ser lido."* Sem ela, o leitor encara o diagrama sem saber o que procurar.
- **Uma frase DEPOIS, dizendo o que concluir.** *"É por isso que mudar a ordem aqui quebra o resto."* Sem ela, ele viu e não levou nada.
- **Nunca descreva o desenho em palavras.** "O gráfico mostra que A é maior que B" é texto desperdiçado: o gráfico já mostrou. Diga o que **significa** A ser maior que B.

E sobre a prosa em si:

- **Frase curta e voz ativa.** "O programa lê o arquivo" — não "o arquivo é lido pelo programa".
- **Corte os advérbios de conforto**: *basicamente, simplesmente, essencialmente, na verdade*. Eles prometem simplificar e não simplificam nada; some com eles e a frase melhora.
- **Não anuncie o que vai dizer.** "Vamos entender como isso funciona" é uma linha inteira que não informa nada. Comece dizendo.
- **Número redondo escreve-se por extenso quando é pequeno** (três arquivos), e em algarismo quando é medida (2,3 KB, 18 formas).

## Passo 4 — Gerar a página

- **Caminho**: `Saída dos comandos/Explicações/{Assunto}.html`, na raiz do projeto. Crie as pastas se não existirem.
- **`{Assunto}`** em português, linguagem natural, como um título de verdade: `O que é um mutex.html`, `Como este projeto salva os dados.html`, `Por que o build quebrou.html`. Sem slug, sem data, sem número, sem prefixo.
- **Se o arquivo já existir**: é o mesmo assunto de antes — **sobrescreva** e diga isso no chat. Nunca crie `(2)`, `v2`, nem acrescente data ao nome. Se o assunto for de fato outro, o nome já seria outro.
- **Um arquivo só**, autocontido. Sem CDN, sem biblioteca, sem Mermaid. Todo desenho é HTML, CSS e SVG escritos à mão.
- **Navegação**: abas fixas no topo, **uma aba por seção, exatamente** — aba sem seção e seção sem aba são erro. Nunca botão "próximo/anterior".
- **A primeira seção tem que responder a pergunta sozinha.** Quem ler só ela já sai sabendo o essencial; o resto aprofunda. Ninguém rola uma página inteira para descobrir se ela responde o que ele perguntou.
- **Piso obrigatório**: nenhuma seção pode ser só texto, e a página inteira precisa de **pelo menos um diagrama desenhado em SVG** — tabela sozinha não cumpre o piso.
- **Não monte o HTML do zero**: parta do ESQUELETO DA PÁGINA, mais abaixo neste arquivo, e preencha.
- **Padrão visual**: siga exatamente a seção 🎨 PADRÃO VISUAL no fim deste arquivo.

### Nome de aba

Duas ou três palavras, e que digam o **conteúdo**, não a posição. `O mecanismo` é aba; `Seção 3` não é. Numere só quando a ordem importar de verdade (`1 · O que é`, `2 · Como funciona`), e aí numere todas.

### Como a página se comporta em tela estreita

O usuário lê no navegador embutido, que muitas vezes é estreito. A página tem que continuar legível sem nenhum ajuste da parte dele:

- **Grades caem para uma coluna** — use sempre `repeat(auto-fit, minmax(Xpx, 1fr))`, nunca larguras fixas em coluna.
- **O corpo nunca rola de lado.** O que é largo — tabela grande, árvore, bloco de código — rola **dentro do próprio bloco**, com `overflow-x:auto`.
- **SVG encolhe junto**, porque tem `viewBox` e `max-width:100%`. É por isso que a regra do `viewBox` não é detalhe.
- **A barra de abas rola horizontalmente sozinha** (já vem assim no esqueleto). Não tente quebrá-la em duas linhas.
- **Nada de largura fixa em `px`** no conteúdo. A única largura fixa aceitável é a coluna de rótulo de um gráfico de barras — e mesmo essa cabe em 200px.

## Passo 5 — No chat

Responda **curto**. Três coisas, e só:

1. a resposta em uma ou duas frases — a mesma frase que abre a página;
2. que formas você escolheu e por quê, em uma linha (*"virou tabela porque são seis arquivos com os mesmos aspectos"*);
3. o caminho do arquivo gerado.

A explicação longa mora na página — repeti-la no chat dobra o custo sem dobrar a utilidade.

## Uma pergunta, no máximo

Gere de primeira, sem entrevistar o usuário. Ele chamou este comando porque está travado em alguma coisa; um questionário atrasa exatamente o momento em que ele precisa de resposta.

A única exceção: se o argumento couber em dois assuntos genuinamente diferentes, faça **uma** pergunta antes de gastar a geração inteira — e só uma.

---

**Assunto a explicar:** $ARGUMENTS

---

# CATÁLOGO DE FORMAS — que desenho usar para que pergunta

## As quatro regras do catálogo

1. **Escolha pela pergunta, não pela variedade.** Duas formas certas valem mais que seis.
2. **Nenhum item aqui é obrigatório.** Uma explicação pode ter só uma tabela e um diagrama de fluxo — e estar completa.
3. **Nunca desenhe um gráfico para dois ou três números.** Uma frase resolve melhor. Gráfico existe para revelar uma relação que a lista de números esconde.
4. **Nada de biblioteca.** Barra é `div` com `width` em porcentagem; linha, área, radar, dispersão e fluxo são SVG escrito à mão.

## A tabela de escolha rápida

| Quando a pergunta é… | A forma | Nº |
|---|---|---|
| vários itens que têm os mesmos aspectos | tabela comparativa | 1 |
| onde as coisas ficam, ou como se reorganizam | árvore | 2 |
| como uma coisa liga na outra, ordem de execução | diagrama de fluxo | 3 |
| o que está em cima do quê | camadas empilhadas | 4 |
| quanto uma coisa pesa em relação à outra | gráfico de barras | 5 |
| uma mesma coisa avaliada em vários eixos | gráfico de radar | 6 |
| se duas grandezas andam juntas | gráfico de dispersão | 7 |
| o que acontece antes e depois | linha do tempo | 8 |
| dois estados do mesmo objeto | antes / depois lado a lado | 9 |
| um caminho com condições | árvore de decisão | 10 |
| quem depende de quem | grafo de nós | 11 |
| números soltos que precisam saltar | cartões de número | 12 |
| onde cada coisa cai em dois eixos de julgamento | matriz 2×2 | 13 |
| muitos itens × muitos aspectos, e só a intensidade importa | mapa de calor | 14 |
| que fatia cada parte ocupa do todo | proporção do todo | 15 |
| o que muda num trecho de código | código lado a lado | 16 |
| um erro: o que apareceu, por quê, e como consertar | sintoma → causa → conserto | 17 |
| um assunto com termo novo demais | cartões de glossário | 18 |

---

## 1 · Tabela comparativa

**Para que serve** — dar a mesma pergunta a vários itens de uma vez. É a forma mais subestimada e a que mais resolve: sempre que o leitor teria de comparar coisas mentalmente, a tabela já comparou por ele.

**Use quando** — três ou mais itens compartilham os mesmos aspectos. O caso clássico: vários arquivos de configuração, e o usuário quer saber o que cada um faz e quando é usado. Uma tabela com *arquivo · o que faz · quando é usado* responde de um golpe o que em prosa vira cinco parágrafos que ele precisa ler inteiros para comparar.

**NÃO use quando** — os itens não compartilham aspectos (aí é lista, não tabela), ou há um só item.

**Como desenhar** — uma linha por item, uma coluna por aspecto, o nome do item sempre na primeira coluna. **Nunca passe de seis colunas**: a partir daí o leitor rola horizontalmente e perde a comparação, que era o único motivo de existir a tabela. Cabeçalho em caixa alta pequena e cinza; separador só embaixo da linha, nunca grade fechada. Se a tabela for larga, envolva num `div` com `overflow-x:auto` para o corpo da página não rolar de lado.

```html
<style>
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--border);vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)}
tr:last-child td{border-bottom:0}
</style>
<div style="overflow-x:auto"><table class="glass">
  <tr><th>Arquivo</th><th>O que faz</th><th>Quando é usado</th></tr>
  <tr><td><code>base.md</code></td><td>o tom e as regras que valem sempre</td><td>toda chamada</td></tr>
  <tr><td><code>revisao.md</code></td><td>acrescenta os critérios de revisão</td><td>só no modo revisar</td></tr>
</table></div>
```

## 2 · Árvore

**Para que serve** — mostrar onde as coisas ficam e como se aninham.

**Use quando** — o assunto é a organização de pastas e arquivos, ou uma reorganização proposta. Quando o usuário vai mexer na posição de vários arquivos, a árvore mostra o antes e o depois de um jeito que nenhuma tabela consegue, porque a hierarquia é a informação.

**NÃO use quando** — a relação não é de aninhamento, e sim de dependência ou de ordem. Aí é grafo de nós ou diagrama de fluxo.

**Como desenhar** — bloco monoespaçado com `white-space:pre`, usando `├─`, `└─` e `│`. Destaque em negrito só o que interessa à pergunta, e ponha comentários curtos à direita, em cinza, alinhados com uma seta `←`. Nunca desenhe a árvore inteira do projeto: **só os galhos que a pergunta toca**.

```html
<style>
.tree{font-family:ui-monospace,Consolas,monospace;font-size:13px;line-height:1.8;color:var(--body);
      padding:16px 18px;overflow-x:auto;white-space:pre;border-radius:12px;
      background:rgba(0,0,0,.28);border:1px solid var(--border)}
.tree b{color:var(--brand-ink)}
</style>
<div class="tree">Saída dos comandos/
├─ Discussões/
└─ <b>Explicações/</b>            ← nasce quando o comando rodar
   └─ <b>O que é um mutex.html</b></div>
```

## 3 · Diagrama de fluxo

**Para que serve** — mostrar como uma coisa liga na outra, e em que ordem as coisas acontecem.

**Use quando** — a pergunta é sobre funcionamento: um pipeline, o caminho de um dado do início ao fim, a sequência de etapas de um processo. É a forma que mais falta nas explicações escritas, porque em prosa a ordem some.

**NÃO use quando** — não há ordem nem direção; se as peças só se relacionam, é grafo de nós.

**Como desenhar** — SVG com `viewBox`, caixas `<rect rx="11">` de mais ou menos 150×46, o rótulo em `<text>` dentro, e `<line>` com `marker-end` entre elas. A ponta da seta é um `<marker>` declarado uma vez em `<defs>`. **Máximo de cinco caixas por fileira**; passando disso, quebre em duas fileiras e ligue com uma seta que desce. Destaque a caixa central com o fundo `--brand-soft`, e a caixa final com o verde `--pos`.

```html
<svg viewBox="0 0 840 90" role="img" aria-label="Do argumento até a página gerada">
  <defs><marker id="seta" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
    <path d="M0,0 L9,4.5 L0,9 z" fill="#8b7bff"/></marker></defs>
  <g font-family="-apple-system,Segoe UI,sans-serif" font-size="12.5">
    <rect x="4" y="22" width="150" height="46" rx="11" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.14)"/>
    <text x="26" y="50" fill="#eef1ff">você digita</text>
    <line x1="158" y1="45" x2="196" y2="45" stroke="#8b7bff" stroke-width="1.6" marker-end="url(#seta)"/>

    <rect x="202" y="22" width="150" height="46" rx="11" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.14)"/>
    <text x="224" y="50" fill="#eef1ff">lê o terreno</text>
    <line x1="356" y1="45" x2="394" y2="45" stroke="#8b7bff" stroke-width="1.6" marker-end="url(#seta)"/>

    <rect x="400" y="22" width="180" height="46" rx="11" fill="rgba(139,123,255,.16)" stroke="rgba(139,123,255,.4)"/>
    <text x="422" y="50" fill="#eef1ff">escolhe a forma</text>
    <line x1="584" y1="45" x2="622" y2="45" stroke="#8b7bff" stroke-width="1.6" marker-end="url(#seta)"/>

    <rect x="628" y="22" width="206" height="46" rx="11" fill="rgba(62,224,166,.10)" stroke="rgba(62,224,166,.32)"/>
    <text x="650" y="50" fill="#eef1ff">a página pronta</text>
  </g>
</svg>
```

## 4 · Camadas empilhadas

**Para que serve** — mostrar o que está em cima do quê, e o que cada nível esconde do nível de cima.

**Use quando** — o assunto tem níveis de abstração: interface sobre lógica sobre dados, aplicação sobre biblioteca sobre sistema operacional.

**NÃO use quando** — os blocos são irmãos, não camadas. Empilhar coisas que não se apoiam mente sobre a arquitetura.

**Como desenhar** — `div`s empilhadas com 6px de espaço entre elas, largura igual, cada camada com o fundo um pouco mais claro que a de baixo — **a mais clara em cima**, que é onde o usuário toca. Rótulo à esquerda, e uma frase curta à direita dizendo o que aquela camada resolve. Máximo de cinco camadas.

```html
<style>
.camada{display:flex;justify-content:space-between;align-items:center;gap:16px;
        padding:14px 18px;border-radius:12px;border:1px solid var(--border);margin-bottom:6px}
.camada b{color:var(--ink)}
.camada span{color:var(--muted);font-size:13px;text-align:right}
</style>
<div class="camada" style="background:rgba(255,255,255,.10)"><b>Interface</b><span>o que ele vê e clica</span></div>
<div class="camada" style="background:rgba(255,255,255,.07)"><b>Lógica</b><span>decide o que acontece</span></div>
<div class="camada" style="background:rgba(255,255,255,.04)"><b>Dados</b><span>guarda e devolve</span></div>
```

## 5 · Gráfico de barras

**Para que serve** — mostrar quanto uma coisa pesa em relação às outras. O olho compara comprimento muito melhor do que compara números escritos.

**Use quando** — a pergunta envolve peso, tamanho, custo, tempo, quantidade — e há pelo menos quatro valores para comparar.

**NÃO use quando** — há dois ou três valores (uma frase basta), ou quando os valores medem coisas diferentes e não são comparáveis.

**Como desenhar** — um grid de duas colunas: rótulo à esquerda com largura fixa, barra à direita. A barra é um `div` com `width` em porcentagem, **normalizada pelo maior valor = 100%**, altura de 24 a 26px, cantos de 7px, e o valor escrito dentro dela em branco e negrito. Use o gradiente `--brand → --brand-ink` e reserve o rosa `--neg` para a barra que representa um problema. Ordene do maior para o menor, a não ser que a ordem tenha significado próprio (meses, etapas).

```html
<style>
.barras{display:grid;grid-template-columns:200px 1fr;gap:10px;align-items:center;font-size:13.5px}
.barra{height:25px;border-radius:7px;display:flex;align-items:center;padding-left:10px;
       color:#fff;font-size:12px;font-weight:700}
</style>
<div class="barras">
  <div>padrão visual</div>
  <div class="barra" style="width:100%;background:linear-gradient(90deg,#8b7bff,#b6acff)">5,0 KB</div>
  <div>instrução</div>
  <div class="barra" style="width:46%;background:linear-gradient(90deg,#8b7bff,#b6acff)">2,3 KB</div>
</div>
```

## 6 · Gráfico de radar

**Para que serve** — mostrar uma mesma coisa avaliada em vários critérios ao mesmo tempo, e como ela se sai em cada um. Serve especialmente para **comparar duas opções**: as duas manchas sobrepostas mostram na hora onde uma ganha e onde perde.

**Use quando** — há de 4 a 7 critérios e no máximo 2 opções.

**NÃO use quando** — há menos de 3 critérios (vira triângulo sem informação), mais de 7 (vira borrão), ou mais de 2 séries sobrepostas. E nunca use quando os critérios têm unidades diferentes que você não normalizou.

**Como desenhar** — normalize todo critério para 0–1. Para `N` eixos, o ponto do eixo `i` fica em ângulo `-90° + i × 360/N`, então `x = R × valor × cos(ângulo)` e `y = R × valor × sen(ângulo)`, com `R` de uns 80. Desenhe **nesta ordem**: os `<polygon>` de grade (100%, 66% e 33% de `R`), as `<line>` dos eixos saindo do centro, o `<polygon>` preenchido da série, e por último os `<text>` dos rótulos, a uns 12px além de `R`. Translade tudo para o centro com `<g transform="translate(cx,cy)">`.

**Os pontos da grade já calculados para 5 eixos, com `R = 80`** — copie e multiplique pelo valor de cada eixo:

| Eixo | 100% (`R`) | 66% | 33% |
|---|---|---|---|
| 1 (topo) | `0,-80` | `0,-53` | `0,-27` |
| 2 | `76,-25` | `51,-16` | `25,-8` |
| 3 | `47,65` | `31,43` | `16,22` |
| 4 | `-47,65` | `-31,43` | `-16,22` |
| 5 | `-76,-25` | `-51,-16` | `-25,-8` |

```html
<svg viewBox="0 0 300 220" role="img" aria-label="Comparação em cinco critérios">
  <g transform="translate(150,110)" font-family="-apple-system,Segoe UI,sans-serif" font-size="10.5">
    <polygon points="0,-80 76,-25 47,65 -47,65 -76,-25" fill="none" stroke="rgba(255,255,255,.12)"/>
    <polygon points="0,-53 51,-16 31,43 -31,43 -51,-16" fill="none" stroke="rgba(255,255,255,.09)"/>
    <polygon points="0,-27 25,-8 16,22 -16,22 -25,-8" fill="none" stroke="rgba(255,255,255,.07)"/>
    <line x1="0" y1="0" x2="0" y2="-80" stroke="rgba(255,255,255,.10)"/>
    <line x1="0" y1="0" x2="76" y2="-25" stroke="rgba(255,255,255,.10)"/>
    <line x1="0" y1="0" x2="47" y2="65" stroke="rgba(255,255,255,.10)"/>
    <line x1="0" y1="0" x2="-47" y2="65" stroke="rgba(255,255,255,.10)"/>
    <line x1="0" y1="0" x2="-76" y2="-25" stroke="rgba(255,255,255,.10)"/>
    <polygon points="0,-72 61,-20 24,33 -31,43 -41,-13"
             fill="rgba(139,123,255,.28)" stroke="#b6acff" stroke-width="1.6"/>
    <text x="0" y="-90" fill="#b3bad6" text-anchor="middle">didático</text>
    <text x="90" y="-28" fill="#b3bad6" text-anchor="middle">visual</text>
    <text x="60" y="84" fill="#b3bad6" text-anchor="middle">genérico</text>
    <text x="-60" y="84" fill="#b3bad6" text-anchor="middle">portátil</text>
    <text x="-92" y="-28" fill="#b3bad6" text-anchor="middle">curto</text>
  </g>
</svg>
```

## 7 · Gráfico de dispersão

**Para que serve** — mostrar se duas grandezas andam juntas.

**Use quando** — há oito pontos ou mais e a pergunta é sobre relação, não sobre valor individual.

**NÃO use quando** — há poucos pontos. Com cinco pontos, dispersão não revela relação nenhuma — revela cinco pontos.

**Como desenhar** — SVG com dois `<line>` fazendo os eixos, um `<circle r="4">` por ponto, e rótulo só nos extremos dos eixos (nunca em todos os pontos). Deixe uma margem de uns 40px à esquerda e embaixo para os rótulos caberem. Se houver uma tendência clara, uma `<line>` tracejada indicando-a ajuda; **se não houver, não invente uma** — reta de tendência num monte de pontos aleatórios é gráfico mentiroso.

```html
<svg viewBox="0 0 420 260" role="img" aria-label="Tamanho do arquivo contra tempo de carregamento">
  <g font-family="-apple-system,Segoe UI,sans-serif" font-size="11">
    <line x1="46" y1="215" x2="405" y2="215" stroke="rgba(255,255,255,.18)"/>
    <line x1="46" y1="20" x2="46" y2="215" stroke="rgba(255,255,255,.18)"/>
    <circle cx="80"  cy="190" r="4" fill="#b6acff"/><circle cx="122" cy="176" r="4" fill="#b6acff"/>
    <circle cx="165" cy="150" r="4" fill="#b6acff"/><circle cx="205" cy="158" r="4" fill="#b6acff"/>
    <circle cx="248" cy="120" r="4" fill="#b6acff"/><circle cx="290" cy="104" r="4" fill="#b6acff"/>
    <circle cx="330" cy="86"  r="4" fill="#b6acff"/><circle cx="372" cy="62"  r="4" fill="#b6acff"/>
    <line x1="70" y1="196" x2="382" y2="60" stroke="#ff6b9d" stroke-width="1.4" stroke-dasharray="5 4"/>
    <text x="46" y="236" fill="#7d84a8">0 KB</text>
    <text x="405" y="236" fill="#7d84a8" text-anchor="end">500 KB</text>
    <text x="40" y="24" fill="#7d84a8" text-anchor="end">2 s</text>
  </g>
</svg>
```

## 8 · Linha do tempo

**Para que serve** — mostrar o que acontece antes e o que acontece depois.

**Use quando** — o assunto tem etapas em sequência, ou uma história com marcos.

**NÃO use quando** — a sequência é na verdade um fluxo com entradas e saídas; aí é diagrama de fluxo.

**Como desenhar** — **vertical quando cada marco precisa de mais de cinco palavras** (é quase sempre o caso): uma borda esquerda de 2px, e cada marco como um ponto sobre ela. Horizontal só quando são poucos marcos e rótulos curtíssimos.

```html
<style>
.tl{border-left:2px solid rgba(139,123,255,.4);margin-left:8px;padding-left:22px}
.tl .m{position:relative;padding-bottom:20px}
.tl .m::before{content:"";position:absolute;left:-29px;top:5px;width:11px;height:11px;
               border-radius:50%;background:#8b7bff;box-shadow:0 0 0 4px rgba(139,123,255,.18)}
.tl .m b{color:var(--ink);display:block}
.tl .m span{color:var(--muted);font-size:13.5px}
</style>
<div class="tl">
  <div class="m"><b>1 · Lê o terreno</b><span>descobre de onde vem a resposta</span></div>
  <div class="m"><b>2 · Escolhe a forma</b><span>antes de escrever uma linha</span></div>
  <div class="m"><b>3 · Gera a página</b><span>e responde curto no chat</span></div>
</div>
```

## 9 · Antes / depois lado a lado

**Para que serve** — mostrar dois estados do mesmo objeto e deixar a diferença saltar.

**Use quando** — o assunto é uma mudança: uma refatoração, uma reorganização de pastas, uma configuração que mudou.

**NÃO use quando** — os dois lados não são a mesma coisa em dois momentos. Comparar duas coisas diferentes é tabela. Para código, use a forma 16, que marca a linha alterada.

**Como desenhar** — grid de duas colunas de largura igual, o **mesmo tipo de bloco dos dois lados** (duas árvores, ou dois trechos, nunca uma árvore contra um parágrafo). Título "Antes" e "Depois" em cima. Marque o que mudou: o que saiu em `--neg`, o que entrou em `--pos`. Em tela estreita, deixe cair para uma coluna só, com o "Antes" em cima.

```html
<style>
.ad{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
.ad h4{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.saiu{color:#ff6b9d}.entrou{color:#3ee0a6}
</style>
<div class="ad">
  <div class="glass" style="padding:16px"><h4>Antes</h4>
    <div class="tree">Comandos/
└─ <span class="saiu">Explicar conceito/</span></div></div>
  <div class="glass" style="padding:16px"><h4>Depois</h4>
    <div class="tree">Comandos/
└─ <span class="entrou">Explicar conceito visualmente/</span></div></div>
</div>
```

## 10 · Árvore de decisão

**Para que serve** — mostrar um caminho que depende de condições.

**Use quando** — a resposta certa é "depende", e o que ela depende pode ser escrito como perguntas de sim ou não.

**NÃO use quando** — há mais de três níveis de decisão. A partir daí ela fica ilegível e uma tabela de "se… então…" explica melhor.

**Como desenhar** — o mesmo SVG do diagrama de fluxo, mas com bifurcações, e **a condição escrita em cima da seta**, não dentro da caixa. Caixas de pergunta com a borda em `--brand`; caixas de resultado com o fundo em `--pos`.

```html
<svg viewBox="0 0 700 200" role="img" aria-label="Que forma usar conforme a pergunta">
  <defs><marker id="s2" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
    <path d="M0,0 L9,4.5 L0,9 z" fill="#8b7bff"/></marker></defs>
  <g font-family="-apple-system,Segoe UI,sans-serif" font-size="12.5">
    <rect x="4" y="72" width="190" height="46" rx="11" fill="rgba(255,255,255,.05)" stroke="#8b7bff"/>
    <text x="24" y="100" fill="#eef1ff">tem quantidade?</text>
    <line x1="198" y1="86" x2="286" y2="46" stroke="#8b7bff" stroke-width="1.6" marker-end="url(#s2)"/>
    <text x="216" y="52" fill="#3ee0a6" font-size="11.5">sim</text>
    <line x1="198" y1="104" x2="286" y2="146" stroke="#8b7bff" stroke-width="1.6" marker-end="url(#s2)"/>
    <text x="216" y="150" fill="#ff6b9d" font-size="11.5">não</text>
    <rect x="292" y="16" width="180" height="46" rx="11" fill="rgba(62,224,166,.10)" stroke="rgba(62,224,166,.32)"/>
    <text x="312" y="44" fill="#eef1ff">barras ou radar</text>
    <rect x="292" y="124" width="180" height="46" rx="11" fill="rgba(62,224,166,.10)" stroke="rgba(62,224,166,.32)"/>
    <text x="312" y="152" fill="#eef1ff">fluxo ou camadas</text>
  </g>
</svg>
```

## 11 · Grafo de nós

**Para que serve** — mostrar quem depende de quem, quando não há uma ordem única.

**Use quando** — a pergunta é sobre impacto: o que quebra se isto mudar, o que puxa o quê.

**NÃO use quando** — há mais de dez nós; vira teia de aranha e não se lê. Nesse caso, mostre só a vizinhança do nó que interessa.

**Como desenhar** — SVG com os nós posicionados **à mão** (em colunas por nível, ou em círculo), retângulos rotulados, e as `<line>` desenhadas **antes** dos `<rect>` no código — SVG não tem `z-index`, quem vem depois fica por cima, então linha desenhada por último atravessa as caixas. Setas só quando a dependência tem direção.

```html
<svg viewBox="0 0 560 200" role="img" aria-label="Quem depende de quem">
  <g stroke="rgba(139,123,255,.5)" stroke-width="1.5">
    <line x1="120" y1="100" x2="300" y2="45"/>
    <line x1="120" y1="100" x2="300" y2="155"/>
    <line x1="380" y1="45"  x2="470" y2="100"/>
    <line x1="380" y1="155" x2="470" y2="100"/>
  </g>
  <g font-family="-apple-system,Segoe UI,sans-serif" font-size="12.5">
    <rect x="10" y="78" width="110" height="44" rx="10" fill="rgba(139,123,255,.16)" stroke="rgba(139,123,255,.4)"/>
    <text x="30" y="105" fill="#eef1ff">núcleo</text>
    <rect x="220" y="23" width="160" height="44" rx="10" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.14)"/>
    <text x="240" y="50" fill="#eef1ff">leitor de arquivo</text>
    <rect x="220" y="133" width="160" height="44" rx="10" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.14)"/>
    <text x="240" y="160" fill="#eef1ff">gerador de HTML</text>
    <rect x="440" y="78" width="110" height="44" rx="10" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.14)"/>
    <text x="462" y="105" fill="#eef1ff">a página</text>
  </g>
</svg>
```

## 12 · Cartões de número

**Para que serve** — fazer três ou quatro números importantes saltarem da página.

**Use quando** — a explicação tem números que resumem o assunto e o leitor precisa vê-los antes de ler qualquer coisa. Ótimos no topo da primeira seção.

**NÃO use quando** — os números precisam ser comparados entre si; aí é barra. Cartão é para número que vale sozinho.

**Como desenhar** — grid `repeat(auto-fit, minmax(150px, 1fr))`, número em 30px e peso 800, rótulo embaixo em 12px, maiúsculas e cinza. **Máximo de quatro por fileira.** Colora o número só quando a cor significar algo (verde para o que está resolvido, rosa para o que está pendente).

```html
<style>
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.kpi{padding:16px 18px;text-align:center}
.kpi .n{font-size:30px;font-weight:800;color:var(--ink);line-height:1}
.kpi .l{font-size:12px;color:var(--muted);margin-top:6px;text-transform:uppercase;letter-spacing:.07em}
</style>
<div class="kpis">
  <div class="glass kpi"><div class="n">18</div><div class="l">formas</div></div>
  <div class="glass kpi"><div class="n" style="color:#3ee0a6">3</div><div class="l">obrigatórias</div></div>
  <div class="glass kpi"><div class="n">2 a 4</div><div class="l">por página</div></div>
</div>
```

## 13 · Matriz 2×2

**Para que serve** — mostrar onde cada coisa cai quando julgada por **dois** critérios ao mesmo tempo. É a forma que transforma uma discussão em decisão: o quadrante "muito impacto, pouco esforço" se lê sozinho.

**Use quando** — há de 4 a 12 itens e exatamente dois eixos de julgamento (esforço × impacto, custo × benefício, urgente × importante).

**NÃO use quando** — há três ou mais critérios (aí é radar ou tabela), ou quando a posição de cada item é chute. Matriz com posição inventada parece rigor e não é.

**Como desenhar** — um quadrado dividido em quatro, com o eixo nomeado nas bordas e **cada quadrante rotulado com o que ele significa**, não com "alto/alto". Os itens são pastilhas posicionadas por `left`/`top` em porcentagem dentro de um container `position:relative`.

```html
<style>
.m22{position:relative;aspect-ratio:1;max-width:420px;border:1px solid var(--border);border-radius:14px;
     background:var(--glass);overflow:hidden}
.m22 .cruz{position:absolute;inset:0;background:
  linear-gradient(to right,transparent calc(50% - 1px),var(--border) 50%,transparent calc(50% + 1px)),
  linear-gradient(to bottom,transparent calc(50% - 1px),var(--border) 50%,transparent calc(50% + 1px))}
.m22 .q{position:absolute;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)}
.m22 .it{position:absolute;transform:translate(-50%,-50%);background:rgba(139,123,255,.22);
         border:1px solid rgba(139,123,255,.45);color:var(--ink);font-size:12px;
         padding:4px 10px;border-radius:99px;white-space:nowrap}
</style>
<div class="m22">
  <div class="cruz"></div>
  <div class="q" style="left:12px;top:10px">faça agora</div>
  <div class="q" style="right:12px;top:10px">planeje</div>
  <div class="q" style="left:12px;bottom:10px">se sobrar tempo</div>
  <div class="q" style="right:12px;bottom:10px">não faça</div>
  <div class="it" style="left:26%;top:24%">catálogo com receita</div>
  <div class="it" style="left:70%;top:62%">exemplo de ponta a ponta</div>
</div>
```

## 14 · Mapa de calor

**Para que serve** — mostrar muitos itens contra muitos aspectos quando **só a intensidade importa**, não o número exato. O olho acha o padrão numa grade colorida que não acharia numa tabela de 60 números.

**Use quando** — a grade tem pelo menos 4×4 e a pergunta é "onde está concentrado?".

**NÃO use quando** — o leitor precisa do valor exato de cada célula (aí é tabela), ou a grade é pequena.

**Como desenhar** — `display:grid` com uma célula por cruzamento, a cor saindo da mesma matiz com opacidade variando de `.08` a `.9` conforme a intensidade. **Escreva o valor dentro da célula quando ele couber** — cor sozinha não carrega significado. Cabeçalho de linha e de coluna sempre presentes.

```html
<style>
.hm{display:grid;grid-template-columns:120px repeat(4,1fr);gap:4px;font-size:12px}
.hm .h{color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-size:11px;padding:4px}
.hm .c{padding:10px;border-radius:8px;text-align:center;color:var(--ink);border:1px solid var(--border)}
</style>
<div class="hm">
  <div class="h"></div><div class="h">seg</div><div class="h">ter</div><div class="h">qua</div><div class="h">qui</div>
  <div class="h">leitura</div>
  <div class="c" style="background:rgba(139,123,255,.10)">1</div>
  <div class="c" style="background:rgba(139,123,255,.45)">6</div>
  <div class="c" style="background:rgba(139,123,255,.80)">11</div>
  <div class="c" style="background:rgba(139,123,255,.25)">3</div>
</div>
```

## 15 · Proporção do todo

**Para que serve** — mostrar que fatia cada parte ocupa de um total.

**Use quando** — as partes somam 100% de alguma coisa e são **no máximo cinco**.

**NÃO use quando** — as partes não somam um todo, ou são muitas. E **nunca use pizza**: fatia é ângulo, e o olho compara ângulo mal. Uma barra empilhada de 100% responde a mesma pergunta e se lê de relance.

**Como desenhar** — uma barra horizontal única, dividida em segmentos com `flex` e `width` em porcentagem, cada segmento com o rótulo dentro se couber, e uma legenda embaixo em pastilhas com o mesmo tom — **rótulo e cor sempre juntos**.

```html
<style>
.prop{display:flex;height:34px;border-radius:9px;overflow:hidden;border:1px solid var(--border)}
.prop div{display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#0a0c18}
</style>
<div class="prop">
  <div style="width:56%;background:#8b7bff">catálogo 56%</div>
  <div style="width:26%;background:#b6acff">passos 26%</div>
  <div style="width:18%;background:#3ee0a6">regras 18%</div>
</div>
```

## 16 · Código lado a lado

**Para que serve** — mostrar exatamente o que muda num trecho, sem o leitor precisar caçar a diferença.

**Use quando** — a explicação envolve uma edição real de código ou de configuração, e o trecho cabe em até umas 15 linhas de cada lado.

**NÃO use quando** — a mudança é grande demais. Cole **só o trecho que muda**, com duas linhas de contexto em volta — arquivo inteiro colado na página é o erro mais comum das explicações sobre código.

**Como desenhar** — duas colunas de largura igual com blocos monoespaçados, e **a linha que mudou marcada com fundo próprio**: rosa translúcido no que saiu, verde translúcido no que entrou. Nunca dependa só da cor: ponha `-` e `+` no começo da linha.

```html
<style>
.diff{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
.diff pre{margin:0;padding:14px 16px;border-radius:12px;background:rgba(0,0,0,.3);
          border:1px solid var(--border);font-size:12.5px;line-height:1.7;overflow-x:auto}
.diff .out{background:rgba(255,107,157,.16);display:block}
.diff .in{background:rgba(62,224,166,.15);display:block}
</style>
<div class="diff">
  <div><h4>Antes</h4><pre>  ler(caminho)
<span class="out">- salvar(caminho, dados)</span>
  fechar()</pre></div>
  <div><h4>Depois</h4><pre>  ler(caminho)
<span class="in">+ salvar(caminho, dados, backup=True)</span>
  fechar()</pre></div>
</div>
```

## 17 · Sintoma → causa → conserto

**Para que serve** — explicar um erro. É a forma certa quando o usuário chega com uma mensagem de falha na mão.

**Use quando** — o assunto é algo que quebrou, e há mais de uma causa possível para o mesmo sintoma.

**NÃO use quando** — há uma causa só e ela é óbvia; aí é um parágrafo.

**Como desenhar** — tabela de três colunas na ordem em que o usuário vive o problema: primeiro o que ele **viu**, depois por que aconteceu, depois o que fazer. Ordene as linhas **da causa mais provável para a menos provável** — ele vai tentar de cima para baixo. O conserto é uma ação concreta, nunca "verifique a configuração".

```html
<table class="glass">
  <tr><th>O que você viu</th><th>Por que acontece</th><th>O conserto</th></tr>
  <tr><td><code>arquivo não encontrado</code></td><td>a pasta de saída ainda não existe</td>
      <td>criar <code>Saída dos comandos/Explicações/</code> antes de escrever</td></tr>
  <tr><td>página abre em branco</td><td>o SVG ficou sem <code>viewBox</code> e colapsou</td>
      <td>acrescentar <code>viewBox</code> a todo SVG</td></tr>
</table>
```

## 18 · Cartões de glossário

**Para que serve** — dar conta de um assunto que traz muito termo novo de uma vez, sem transformar a explicação numa sequência de definições.

**Use quando** — o assunto tem **mais de seis termos** que o leitor provavelmente não conhece. Abaixo disso, explique cada um na frase em que ele aparece.

**NÃO use quando** — os termos precisam ser comparados entre si; aí é tabela.

**Como desenhar** — grade de cartões, cada um com o termo em destaque e **uma frase** de definição, sem jargão. Ordem alfabética só se forem muitos; senão, na ordem em que aparecem na explicação. Se um termo é usado no lugar de outro que ele já conhece, diga isso: *"é o que outros programas chamam de X"*.

```html
<style>
.gloss{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.gloss div{padding:14px 16px}
.gloss b{color:var(--brand-ink);display:block;margin-bottom:4px;font-size:14.5px}
.gloss span{font-size:13.5px;color:var(--body)}
</style>
<div class="gloss">
  <div class="glass"><b>viewBox</b><span>o sistema de coordenadas do desenho — sem ele o SVG não sabe se redimensionar.</span></div>
  <div class="glass"><b>marker</b><span>a ponta de seta, declarada uma vez e reusada em todas as linhas.</span></div>
</div>
```

---

# Escolheu errado? A troca certa

Quando o desenho não está funcionando, quase sempre é uma destas trocas:

| Você ia usar… | Mas o caso é… | Use |
|---|---|---|
| pizza | qualquer coisa | **proporção do todo** (15) — o olho compara comprimento, não ângulo |
| tabela de 9 colunas | muitos itens × muitos aspectos, e só a intensidade importa | **mapa de calor** (14) |
| tabela | os itens têm dois eixos de julgamento e você quer decidir | **matriz 2×2** (13) |
| grafo de nós | há ordem e direção claras | **diagrama de fluxo** (3) |
| diagrama de fluxo | não há ordem, só relação | **grafo de nós** (11) |
| árvore | a relação é dependência, não aninhamento | **grafo de nós** (11) |
| barras | há dois ou três valores | **uma frase** |
| barras | a mesma coisa medida em vários critérios | **radar** (6) |
| radar | há mais de duas opções para comparar | **tabela comparativa** (1) |
| dispersão | há menos de oito pontos | **tabela** (1) ou uma frase |
| antes/depois genérico | os dois lados são trechos de código | **código lado a lado** (16) |
| parágrafo explicando um erro | há mais de uma causa possível | **sintoma → causa → conserto** (17) |
| definir cada termo no meio do texto | são mais de seis termos novos | **cartões de glossário** (18) |
| linha do tempo | há entradas e saídas, não só marcos | **diagrama de fluxo** (3) |

---

# O ESQUELETO DA PÁGINA

**Não monte o HTML do zero.** Parta daqui e preencha — este esqueleto já traz o padrão visual, a barra de abas funcionando, a rolagem e o comportamento em tela estreita. Montar à mão toda vez é onde nascem os erros de `id`, de aba que não bate com seção e de página que rola de lado.

Substitua o que está entre `{chaves}`, acrescente uma `<section>` e uma `<button class="tab">` por seção da explicação, e ponha no `<style>` só as classes das formas que você realmente usou (elas estão nos verbetes do catálogo).

```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{Assunto}</title>
<style>
:root{
  --ink:#eef1ff; --body:#b3bad6; --muted:#7d84a8;
  --glass:rgba(255,255,255,.05); --border:rgba(255,255,255,.10);
  --brand:#8b7bff; --brand-soft:rgba(139,123,255,.16); --brand-ink:#b6acff;
  --pos:#3ee0a6; --neg:#ff6b9d;
  --radius:18px;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0;color:var(--body);
  font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  background:#080a14;
  background-image:
    radial-gradient(620px 420px at 8% 0%,rgba(139,123,255,.28),transparent 60%),
    radial-gradient(620px 420px at 92% 6%,rgba(255,107,157,.22),transparent 60%),
    radial-gradient(760px 520px at 55% 105%,rgba(62,224,166,.20),transparent 60%);
  background-attachment:fixed;
}
h1,h2,h3,h4{color:var(--ink);letter-spacing:-.02em;margin:0}
h1{font-size:31px;line-height:1.2} h2{font-size:22px;margin-bottom:6px} h3{font-size:16px;margin-bottom:6px}
p{margin:10px 0}
code{font-family:ui-monospace,Consolas,monospace;font-size:12.8px;background:rgba(255,255,255,.07);
     border:1px solid var(--border);border-radius:6px;padding:1px 5px;color:var(--brand-ink)}
.glass{background:var(--glass);backdrop-filter:blur(14px);border:1px solid var(--border);
       border-radius:var(--radius);box-shadow:0 8px 30px rgba(0,0,0,.35)}
.card{padding:22px 24px;margin:14px 0}
.topbar{position:sticky;top:0;z-index:50;background:rgba(8,10,20,.55);backdrop-filter:blur(18px);
        border-bottom:1px solid var(--border)}
.topbar .inner{max-width:1000px;margin:0 auto;display:flex;align-items:center;gap:18px;
               padding:12px 24px;position:relative}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;color:var(--ink);font-size:15px;white-space:nowrap}
.brand .mark{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#8b7bff,#ff6b9d);
             color:#fff;display:grid;place-items:center;font-size:14px}
.tabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none}.tabs::-webkit-scrollbar{display:none}
.tab{border:0;background:transparent;color:var(--muted);font:inherit;font-size:13.5px;font-weight:600;
     padding:7px 13px;border-radius:99px;cursor:pointer;white-space:nowrap;transition:.18s}
.tab:hover{color:var(--ink);background:rgba(255,255,255,.06)}
.tab.on{color:var(--brand-ink);background:rgba(255,255,255,.10);box-shadow:inset 0 0 0 1px var(--border)}
.progress{position:absolute;left:0;bottom:-1px;height:2px;
          background:linear-gradient(90deg,#8b7bff,#ff6b9d);width:0;transition:width .1s linear}
main{max-width:1000px;margin:0 auto;padding:0 24px}
section{padding:56px 0}
.eyebrow{font-size:12px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;
         color:var(--brand-ink);margin-bottom:12px}
.muted{color:var(--muted);font-size:13.5px}
svg{max-width:100%;height:auto}
ul{margin:10px 0;padding-left:20px} li{margin:5px 0}
/* + só as classes das formas que você usou: .tree .barras .kpis .tl .diff .hm … */
</style>
</head>
<body>

<div class="topbar"><div class="inner">
  <div class="brand"><span class="mark">◆</span> {Assunto}</div>
  <nav class="tabs" id="tabs">
    <button class="tab on" data-to="s1">{aba 1}</button>
    <button class="tab" data-to="s2">{aba 2}</button>
    <!-- uma por seção, na mesma ordem -->
  </nav>
  <div class="progress" id="bar"></div>
</div></div>

<main>

  <section id="s1" data-sec>
    <div class="eyebrow">{rótulo curto}</div>
    <h1>{a resposta em uma frase}</h1>
    <!-- esta seção responde a pergunta sozinha -->
  </section>

  <section id="s2" data-sec>
    <div class="eyebrow">{rótulo curto}</div>
    <h2>{título da seção}</h2>
    <p>{a frase que diz o que olhar no desenho abaixo}</p>
    <div class="glass card">{o desenho}</div>
    <p>{a frase que diz o que concluir}</p>
  </section>

</main>

<script>
const sections=[...document.querySelectorAll('[data-sec]')];
const tabs=[...document.querySelectorAll('.tab')];
const bar=document.getElementById('bar');
const io=new IntersectionObserver(es=>es.forEach(e=>{
  if(e.isIntersecting) tabs.forEach(t=>t.classList.toggle('on',t.dataset.to===e.target.id));
}),{rootMargin:'-45% 0px -50% 0px'});
sections.forEach(s=>io.observe(s));
tabs.forEach(t=>t.onclick=()=>document.getElementById(t.dataset.to).scrollIntoView({behavior:'smooth'}));
addEventListener('scroll',()=>{const h=document.documentElement;
  bar.style.width=(h.scrollTop/(h.scrollHeight-h.clientHeight)*100)+'%';},{passive:true});
</script>
</body>
</html>
```

**Três coisas que o esqueleto não decide por você**, e que são as que mais quebram:

1. **`data-to` tem que casar com o `id` da seção.** Aba apontando para `s4` numa página sem `s4` não faz nada — e o usuário clica achando que travou.
2. **`id` de `marker` e de gradiente é global.** Dois diagramas com `id="seta"` fazem o segundo perder a ponta. Numere: `seta1`, `seta2`.
3. **Só copie para o `<style>` as classes que você usou.** CSS de forma que não está na página é peso morto que confunde quem for editar depois.

---

# UM CASO DO COMEÇO AO FIM

Um pedido real, percorrido inteiro. Não é modelo a copiar — é o método do Passo 2 em movimento.

### O que ele digitou

> `/explicar-conceito-visualmente como este programa decide qual prompt usar`

### O que eu fiz antes de escrever

Assunto do **projeto** (Origem A). Segui a ordem: li o arquivo de instruções da raiz, que deu o vocabulário — aqui se chama "prompt base" e "prompt de modo". Não havia servidor MCP. Busquei pelo termo, achei quatro arquivos em `prompts/` e a função que escolhe entre eles. Li a função. **Total: cinco arquivos, nenhum inteiro.**

### As três perguntas do Passo 2

| Pergunta | Resposta | O que apontou |
|---|---|---|
| compara coisas? | sim — quatro prompts com os mesmos aspectos | tabela comparativa |
| tem ordem ou caminho? | sim — a escolha tem etapas e uma condição | diagrama de fluxo |
| tem quantidade? | não de forma relevante | — |

**Três formas escolhidas:** diagrama de fluxo (o mecanismo), tabela comparativa (os quatro prompts), e código lado a lado (a condição que decide). O radar, as barras e o mapa de calor **não entraram** — não havia pergunta que eles respondessem.

### A página que saiu

| Seção | Aba | O que carrega |
|---|---|---|
| 1 | `O que decide` | a resposta em uma frase + o nome da função com `arquivo:linha` |
| 2 | `O caminho da escolha` | **diagrama de fluxo**: pedido → lê o modo → casa com a tabela → monta o prompt |
| 3 | `Os quatro prompts` | **tabela comparativa**: arquivo · o que acrescenta · quando entra |
| 4 | `A condição, no código` | **código lado a lado**: o trecho que decide, com a linha da condição marcada |
| 5 | `O que muda se você mexer` | consequência de trocar a ordem — texto curto + uma lista |

Cinco seções, cinco abas, três formas. A seção 1 responde sozinha; as outras aprofundam.

### O que foi para o chat

> O programa escolhe pelo campo `modo` do pedido: ele casa com a tabela de `prompts/` e concatena o base com o do modo — `nucleo/prompt.py:212`.
> Virou fluxo (a escolha tem etapas), tabela (são quatro prompts com os mesmos aspectos) e código lado a lado (a condição merece ser vista).
> `Saída dos comandos/Explicações/Como este programa decide qual prompt usar.html`

### O que eu NÃO fiz

- Não expliquei o que é um prompt — ele não perguntou isso.
- Não colei nenhum dos quatro arquivos inteiros; só o trecho da condição.
- Não inventei número nenhum: não havia o que medir, então não houve gráfico.
- Não criei um "modo projeto" para me guiar. Não existem modos aqui.

---

# Os erros que estragam uma explicação visual

Não basta desenhar. Estes são os erros que fazem a página parecer bonita e ensinar pouco — cada um com o que o leitor sente quando acontece.

| O erro | O que o leitor sente |
|---|---|
| **Gráfico decorativo** — o desenho só repete o que o parágrafo ao lado já disse | passa os olhos e pula. Aprende a ignorar todos os outros desenhos da página |
| **Dado inventado sem aviso** — números ilustrativos apresentados como se tivessem sido medidos | confia, age em cima, e descobre tarde. É o pior erro desta lista |
| **Legenda em vez de rótulo** — cinco cores embaixo do gráfico e o leitor indo e voltando | cansa e desiste de entender qual linha é qual |
| **Tabela larga demais** — nove colunas, rolagem horizontal | perde a comparação, que era o único motivo de a tabela existir |
| **Muro de texto com um desenho no fim** | rola tudo e não acha a resposta; conclui que a página não responde |
| **Cor sozinha carregando significado** — verde e vermelho sem rótulo | quem não distingue as cores não lê nada; e ninguém adivinha o que verde quer dizer aqui |
| **Pizza com muitas fatias, ou qualquer coisa em 3D** | compara ângulos errado e sai com a conclusão trocada |
| **Arquivo inteiro colado** em vez do trecho que importa | caça a linha relevante no meio de duzentas |
| **Explicar o que não foi perguntado** | pula seções procurando a dele, e passa direto pela resposta |
| **Abas que não batem com as seções** — aba sem seção, ou seção sem aba | clica e não vai a lugar nenhum; para de confiar na navegação |
| **Desenho que precisa de legenda para ser entendido** | lê a legenda, volta ao desenho, e ainda não entendeu |

## A regra do dado ilustrativo

Se você **não mediu**, o número é ilustrativo — e a página tem que dizer isso, na própria página, ao lado do desenho. Uma linha basta:

> *Números ilustrativos, para mostrar a forma do gráfico — não foram medidos neste projeto.*

Prefira sempre medir. Se o assunto é do projeto e dá para contar arquivos, linhas ou tamanhos, conte de verdade: um gráfico com dado real vale dez com dado plausível.

---

# Conferência antes de entregar

Rode esta lista **na página que você acabou de gerar**, antes de responder no chat. Cada item é verificável olhando o arquivo — não é lembrete, é conferência.

**O conteúdo**

- [ ] A **primeira seção responde a pergunta sozinha**.
- [ ] A página tem de **3 a 7 seções**, e nenhuma delas foi escrita só para preencher roteiro.
- [ ] Todo termo técnico é explicado na primeira vez que aparece.
- [ ] Se sobrou algo não confirmado, existe a seção dizendo isso.
- [ ] **Cada desenho tem uma frase antes** (o que olhar) **e uma depois** (o que concluir) — e nenhuma delas descreve o desenho em palavras.
- [ ] Nenhum advérbio de conforto sobrou: *basicamente, simplesmente, essencialmente, na verdade*.
- [ ] Se o assunto era grande demais, existem as linhas dizendo o que ficou de fora.

**As formas**

- [ ] Entre **2 e 4 formas** do catálogo, e cada uma responde a algo que o texto sozinho não responderia.
- [ ] **Nenhuma seção é só texto.**
- [ ] Existe **pelo menos um diagrama em SVG** — tabela não cumpre o piso.
- [ ] Todo dado ilustrativo está rotulado como tal.

**O desenho**

- [ ] Todo `<svg>` tem `viewBox`, `role="img"` e `aria-label`.
- [ ] Nenhum texto dentro de SVG abaixo de **10,5px**.
- [ ] Todo `marker-end="url(#x)"` tem o `<marker id="x">` correspondente **no mesmo SVG**.
- [ ] Nenhum `id` repetido na página — dois SVGs com `id="seta"` fazem o segundo perder a ponta.
- [ ] Nenhuma cor fora dos tokens do padrão visual.
- [ ] Nenhuma informação depende só de cor: sempre há rótulo em texto junto.

**A página**

- [ ] Uma aba por seção, **exatamente** — nenhuma sobrando, nenhuma faltando.
- [ ] O `data-to` de cada aba bate com um `id` que existe.
- [ ] Nome de aba diz o conteúdo, não a posição — nada de `Seção 3`.
- [ ] Nada de CDN, `<script src>`, Mermaid, ou biblioteca de gráfico.
- [ ] O corpo da página **não rola horizontalmente**; o que é largo rola dentro do próprio bloco.
- [ ] Nenhuma largura fixa em `px` no conteúdo; toda grade usa `repeat(auto-fit, minmax(...))`.
- [ ] No `<style>` só ficaram as classes das formas que a página realmente usa.
- [ ] O arquivo está em `Saída dos comandos/Explicações/` com o nome do assunto em português.

**Se algum item falhar, conserte antes de responder.** Entregar a página e listar os defeitos no chat é pior que não ter feito a conferência — o usuário abre o arquivo esperando que esteja pronto.

---

# Regras que valem para TODO desenho

- **Todo SVG leva `viewBox`** e `max-width:100%; height:auto` no CSS. Sem isso ele estoura a página no celular.
- **Largura de referência do `viewBox`: 840.** É o que cabe na coluna do padrão visual sem encolher. Desenho mais largo que isso vai chegar ao leitor reduzido, e o texto dentro dele fica ilegível.
- **Quando o desenho não couber, divida-o. Nunca encolha a fonte.** Dois diagramas legíveis explicam; um diagrama apertado não explica nada.
- **Todo SVG leva `role="img"` e `aria-label`** dizendo o que ele mostra.
- **Nenhum texto dentro de SVG abaixo de 10,5px.**
- **Cores só dos tokens** do padrão visual. Nunca invente cor nova no meio da página.
- **Cor nunca carrega significado sozinha.** Sempre acompanhe de rótulo em texto.
- **Texto sobre barra ou fundo colorido** vai em branco puro ou no quase-preto `#0a0c18`, conforme o fundo — nunca em cinza médio, que some nos dois.
- **Normalize antes de desenhar.** Barra é porcentagem do maior; radar é 0 a 1. Desenhar valor cru produz gráfico mentiroso.
- **`id` de `marker`, `gradient` e afins tem que ser único na página inteira.** Se houver dois diagramas, use `seta1` e `seta2`.
- **Se o desenho precisa de legenda para ser entendido**, ele está errado. Rotule direto no desenho.

---

# 🎨 PADRÃO VISUAL — "Glass Dark Aurora"

> **Edite esta seção se quiser mudar o visual.** Ela é a fonte de verdade do estilo deste comando.

Escuro, roxo/violeta, com painéis de vidro fosco (`.glass`) sobre fundo quase-preto com aurora. Tudo inline/autocontido, sem libs/CDN, responsivo, pouco emoji.

## Tokens (copiar para `:root`)

```css
:root{
  --ink:#eef1ff; --body:#b3bad6; --muted:#7d84a8;
  --glass:rgba(255,255,255,.05); --border:rgba(255,255,255,.10);
  --brand:#8b7bff; --brand-soft:rgba(139,123,255,.16); --brand-ink:#b6acff;
  --pos:#3ee0a6; --neg:#ff6b9d;
  --radius:18px;
}
```

## Fundo do `body` (aurora sobre quase-preto)

```css
body{
  background:#080a14;
  background-image:
    radial-gradient(620px 420px at 8% 0%,rgba(139,123,255,.28),transparent 60%),
    radial-gradient(620px 420px at 92% 6%,rgba(255,107,157,.22),transparent 60%),
    radial-gradient(760px 520px at 55% 105%,rgba(62,224,166,.20),transparent 60%);
}
```

## Painel de vidro (cards, tabelas, gráficos, grafos)

```css
.glass{
  background:var(--glass); backdrop-filter:blur(14px);
  border:1px solid var(--border); border-radius:var(--radius);
  box-shadow:0 8px 30px rgba(0,0,0,.35);
}
```

## Recursos visuais OBRIGATÓRIOS (o usuário aprende visualmente)

Nunca só texto. Os recursos, e a regra de quando usar cada um, estão no **CATÁLOGO DE FORMAS** acima. Cada seção: **título claro + explicação curta + exemplo concreto**.

## Navegação: abas fixas no topo + rolagem (NUNCA "Próximo/Anterior")

Barra de abas fixa no topo, uma por seção da explicação. Conteúdo em seções altas roladas verticalmente. Aba ativa via `IntersectionObserver`. Barra de progresso fina no topo. Clique na aba dá scroll suave.

```html
<div class="topbar"><div class="inner">
  <div class="brand"><span class="mark">◆</span> NomeApp</div>
  <nav class="tabs" id="tabs">
    <button class="tab on" data-to="s1">1 · O que é</button>
    <!-- uma <button class="tab" data-to="ID"> por seção -->
  </nav>
  <div class="progress" id="bar"></div>
</div></div>
<!-- cada seção: <section id="s1" data-sec> ... </section> -->
```

```js
const sections=[...document.querySelectorAll('[data-sec]')];
const tabs=[...document.querySelectorAll('.tab')];
const bar=document.getElementById('bar');
const io=new IntersectionObserver(es=>es.forEach(e=>{
  if(e.isIntersecting) tabs.forEach(t=>t.classList.toggle('on',t.dataset.to===e.target.id));
}),{rootMargin:'-45% 0px -50% 0px'});
sections.forEach(s=>io.observe(s));
tabs.forEach(t=>t.onclick=()=>document.getElementById(t.dataset.to).scrollIntoView({behavior:'smooth'}));
addEventListener('scroll',()=>{const h=document.documentElement;bar.style.width=(h.scrollTop/(h.scrollHeight-h.clientHeight)*100)+'%';},{passive:true});
```

```css
html{scroll-behavior:smooth}
h1,h2,h3{color:var(--ink);letter-spacing:-.02em;margin:0}
.topbar{position:sticky;top:0;z-index:50;background:rgba(8,10,20,.55);backdrop-filter:blur(18px);border-bottom:1px solid var(--border)}
.topbar .inner{max-width:1000px;margin:0 auto;display:flex;align-items:center;gap:18px;padding:12px 24px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;color:var(--ink);font-size:15px}
.brand .mark{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#8b7bff,#ff6b9d);color:#fff;display:grid;place-items:center;font-size:14px}
.tabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none}.tabs::-webkit-scrollbar{display:none}
.tab{border:0;background:transparent;color:var(--muted);font:inherit;font-size:13.5px;font-weight:600;padding:7px 13px;border-radius:99px;cursor:pointer;white-space:nowrap;transition:.18s}
.tab:hover{color:var(--ink);background:rgba(255,255,255,.06)}
.tab.on{color:var(--brand-ink);background:rgba(255,255,255,.10);box-shadow:inset 0 0 0 1px var(--border)}
.progress{position:absolute;left:0;bottom:-1px;height:2px;background:linear-gradient(90deg,#8b7bff,#ff6b9d);width:0;transition:width .1s linear}
main{max-width:1000px;margin:0 auto;padding:0 24px}
section{min-height:78vh;padding:56px 0;display:flex;flex-direction:column;justify-content:center}
.eyebrow{font-size:12px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--brand-ink);margin-bottom:12px}
```
