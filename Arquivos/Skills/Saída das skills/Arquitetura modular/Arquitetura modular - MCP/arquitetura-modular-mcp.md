---
name: arquitetura-modular-mcp
description: Referência completa da AMF (Arquitetura Modular por Features) na versão servidor MCP — diz em que pasta cada arquivo mora, como nomear pasta e arquivo, e o que cada área guarda. É a versão certa para um programa sem tela que fica ligado esperando e expõe ferramentas para um modelo de linguagem chamar — a porta de entrada para outro programa, e não um botão dentro dele. Cobre também por que nada pode ir para a saída padrão, e como cada ferramenta exposta se defende. Use SEMPRE antes de criar, mover, renomear ou deletar qualquer arquivo ou pasta deste projeto, mesmo que o usuário não peça para "seguir a arquitetura". Antes dela, leia os desvios registrados em "Saída das skills/Arquitetura modular/Exceções.md" e "Convenções.md" — um desvio do projeto sempre vence a regra genérica.
---

# AMF — Arquitetura Modular por Features — Servidor MCP

Esta é a versão da AMF para **servidor MCP**: um programa que fica ligado esperando, e que **expõe ferramentas para um modelo de linguagem chamar**. É a referência genérica, igual para todos os projetos de MCP e para qualquer linguagem. Leia-a antes de criar, mover, renomear ou deletar qualquer arquivo ou pasta — mas primeiro confira os desvios deste projeto em `Saída das skills/Arquitetura modular/` (seção 17): um desvio registrado sempre vence a regra genérica. Se a pasta não existir, a seção 17 diz como criá-la.

**A régua que separa esta skill da versão Plugin de programa:**

> **O plugin executa uma função dentro do programa. O MCP expõe o programa para outra coisa conversar com ele.**
>
> Um **MCP** do Premiere que fala com um modelo de linguagem para gerar infográficos a partir da legenda é uma **ponte** — ele abre o programa para fora.
> Um **plugin** do Premiere que gera legenda com um transcritor é **fechado**: faz o serviço ali e acabou.

Se a dúvida persistir: *o que o seu projeto entrega — um botão que faz algo, ou uma porta para outro programa mandar?* Botão → a versão Plugin de programa. Porta → **esta**.

---

## 0. A regra da raiz — o que a plataforma manda

**Onde a plataforma manda, ela vence.** A AMF se aplica no espaço livre que sobra.

Num MCP, quem manda são o **protocolo** e o **cliente que executa o servidor**. Esta referência descreve o servidor **local**, que fala pelo transporte **stdio** — o cliente o executa como processo e conversa pela entrada e pela saída padrão dele. Nesse transporte, eles mandam em três coisas:

1. ⛔ **A saída padrão é do protocolo.** Não é sua, e nada seu pode ser escrito nela: um único texto impresso ali corrompe o protocolo e derruba a conexão. É a imposição mais dura desta plataforma, e a que mais derruba projeto — seção 10.1 da `referencia.md`.
2. **O formato do que você expõe é do protocolo** — como uma ferramenta, um recurso ou um prompt se declara, como o esquema é descrito, como a resposta volta. Você escolhe o conteúdo; a forma é ditada.
3. **Quem executa o processo é o cliente**, com o comando, os argumentos e as variáveis de ambiente que o usuário colou no registro dele (seção 4 da `referencia.md`). O diretório de trabalho é do cliente, não seu — por isso nada de caminho absoluto (3.5).

O outro transporte do protocolo, o **Streamable HTTP**, muda as três: o servidor vira um processo independente que atende por um endereço de rede, a saída padrão deixa de ser o canal, e a credencial chega pela autorização do protocolo, não pelo ambiente. A árvore continua a mesma; o que muda está na seção 4.3 da `referencia.md`.

**Nenhuma dessas imposições cai na raiz do projeto.** Ninguém clica num MCP: o cliente executa um comando que aponta para dentro de `Program/`. Por isso a raiz fica com as quatro pastas de nível 1 e o pouco que a tabela 2.2 lista. **Todo o resto mora dentro de uma das quatro pastas.**

---

## 1. Os baldes

Toda pasta deste projeto pertence a um destes baldes. Antes de criar qualquer coisa, descubra em qual ela cai — isso resolve a maioria das dúvidas sozinho.

| Balde | Critério | Se apagar |
|---|---|---|
| **`Program/`** | Eu escrevi · é o servidor · Ctrl+C aqui e ele roda em outro lugar | O servidor para |
| ↳ `Code/` | Só código, e nada mais · roda quando o servidor roda | O servidor para |
| ↳ `Assets/` | **Não existe aqui** — um servidor MCP não mostra nem toca nada | — |
| ↳ `External/` | **Eu colei à mão** · outro escreveu · eu não edito | O servidor para (e eu baixo de novo à mão) |
| ↳ `Dependencies/` | **O gerenciador de pacotes instalou** · o servidor precisa para rodar | O servidor para (e um comando recria) |
| ↳ `Internal/` | O servidor escreveu · pode apagar que ele recria | Nada se perde — a credencial nem mora aqui: vem do ambiente |
| **`Workshop/`** | Eu escrevi ou instalei · **só eu uso, no desenvolvimento** | O servidor continua rodando; eu é que não consigo mais testá-lo nem publicá-lo |
| **`Distribution/`** | O empacotador montou · **só existe se o servidor for publicado como pacote** | O empacotador refaz idêntico |
| **`Files/`** | É o trabalho de quem usa · **só existe se o servidor guardar algo de verdade**, e com o caminho configurável | **Perde tudo que foi feito** |

**A pergunta que separa os baldes:** *o que acontece com isso quando eu atualizo o servidor?*
`Program/` é substituído, e o `Internal/` dentro dele pode ser descartado · `Workshop/` não vai junto · `Distribution/` é o resultado · `Files/` é intocável.

---

## 2. A árvore completa

Tudo abaixo é **situacional** exceto a entrada, `Program/Code/`, `Code/server/` e `Code/server/tools/`. Só crie o que o projeto realmente precisa.

São **quatro pastas de nível 1, irmãs**: `Program/`, `Workshop/`, `Distribution/` e `Files/`. Nenhuma fica dentro da outra.

Legenda, comparando com a versão Desktop da AMF: `=` igual · `~` existe, mas muda · `→` vira outra coisa · `✖` não existe · `+` é novo aqui. **O símbolo nunca é a explicação inteira** — cada linha diz o que a pasta guarda.

```
[Nome do projeto]/                     A RAIZ
│
✖ arquivo clicável                     ninguém clica: o CLIENTE executa o servidor
├── CLAUDE.md                          as regras que a IA lê ao abrir o projeto
├── .claude/   .mcp.json               ⊘ do assistente — não são da AMF
├── ⊘ Saída das skills/                não é da AMF…
│   └── Arquitetura modular/           …EXCETO esta: Convenções.md + Exceções.md
├── ⊘ Saída dos comandos/              não é da AMF
│
├── Program/                           O QUE O SERVIDOR É · nomes SEMPRE em inglês
│   │                                  Ctrl+C aqui e ele roda em qualquer lugar
│   │
│   ├── + a entrada                    o arquivo que o cliente executa e mantém ligado ·
│   │                                  põe Code/ e Dependencies/ no caminho de busca ·
│   │                                  não imprime NADA na saída padrão (seção 0)
│   ├── + o exemplo de registro        o trecho que quem instala cola no cliente: comando,
│   │                                  argumentos e variáveis de ambiente
│   ├── + o manifesto do pacote        situacional · package.json, pyproject.toml ou o
│   │                                  manifest.json do .mcpb — na raiz do que o
│   │                                  empacotador empacota (2.1)
│   │
│   ├── ~ Code/                        SÓ código · roda quando o servidor roda
│   │   ├── ~ server/                  O CORAÇÃO: fala o protocolo e publica o que você expõe
│   │   │   ├── + tools/               uma pasta por ferramenta exposta — é o "módulo"
│   │   │   │                          desta plataforma (2.3)
│   │   │   └── + resources/           os recursos expostos: dado que o cliente lê por
│   │   │                              endereço (URI) · só se o servidor os publicar
│   │   ├── ~ types/                   o ESQUEMA de entrada e saída de cada ferramenta:
│   │   │                              o contrato que o modelo lê para decidir se chama
│   │   ├── ~ prompts/                 os prompts · os que o servidor EXPÕE viram
│   │   │                              interface pública
│   │   ├── ~ clients/                 você liga para fora: o programa ou serviço que o
│   │   │                              MCP controla
│   │   ├── ~ backend/                 a lógica de cada ferramenta · não conhece o protocolo
│   │   ├── ✖ frontend/                não existe: não há tela nenhuma
│   │   ├── ✖ locales/                 não existe: quem lê a resposta é um modelo
│   │   ├── = utils/                   funções reusadas em 2+ lugares
│   │   └── = constants/               valores fixos + padrões de fábrica
│   │
│   ├── ✖ Assets/                      não existe: não há o que exibir nem tocar
│   │
│   ├── ~ External/                    SÓ o que você colou à mão · você não edita
│   │   ├── ~ tools/                   executável de terceiro que o MCP aciona —
│   │   │                              nunca confundir com server/tools/
│   │   ├── ~ libraries/               o SDK do programa controlado, baixado do fabricante
│   │   ├── ~ runtimes/                raro: a linguagem embutida, para rodar sem instalar
│   │   └── ~ ai-models/               raro: quem chama o servidor já é um modelo
│   │
│   ├── = Dependencies/                o que o GERENCIADOR DE PACOTES instalou · o servidor
│   │                                  procura ao rodar · em Node: node_modules/ e o
│   │                                  package.json, direto em Program/
│   │
│   └── ~ Internal/                    o servidor escreveu · pode apagar
│       ├── → logs/                    vão para a SAÍDA DE ERRO, nunca para a padrão
│       ├── = cache/  state/  temp/    resultado guardado · o que ele lembra · arquivo de
│       │                              uma operação — e o cache de ferramenta (pycache…)
│       ├── ~ config/                  o que o servidor guarda · o que vem do cliente
│       │                              chega pelo ambiente
│       ├── ~ queue/                   trabalho longo: "comece" + "consulte o andamento"
│       └── → credentials/             não é pasta: variáveis de ambiente passadas pelo
│                                      cliente
│
├── Workshop/                          SÓ NO DESENVOLVIMENTO · não vai no Ctrl+C de Program/
│   ├── ~ tests/                       espelha o caminho de Program/Code/ · + testar
│   │                                  chamando pelo protocolo
│   ├── ~ scripts/                     rodar contra um cliente de teste · publicar
│   ├── = requirements.txt             a lista de dependências — em Node, o package.json
│   │                                  fica em Program/, ao lado do node_modules/
│   ├── = config das ferramentas       do empacotador, do executor de testes, do
│   │                                  verificador de estilo · e o server.json do
│   │                                  registro oficial de MCP (2.1)
│   └── = .env.example  ·  .env        as variáveis do seu ambiente de desenvolvimento
│
├── ~ Distribution/                    SITUACIONAL · só se o servidor for PUBLICADO COMO
│                                      PACOTE: o que o empacotador escreve — o pacote
│                                      do npm ou do PyPI, ou o .mcpb para instalar
│                                      com um clique num cliente de desktop (2.1)
│
└── ~ Files/                           SITUACIONAL · o que é do usuário — só se o servidor
                                       guardar algo de verdade · o caminho é CONFIGURÁVEL:
                                       quem instala escolhe onde
```

`⊘` marca o que está na raiz mas **não é da AMF**: é do assistente de código, e esta referência não organiza, não cria e não cobra nada ali — com a única exceção de `Saída das skills/Arquitetura modular/` (seção 17).

### 2.1 `Distribution/` — só se ele for publicado como pacote

Um servidor MCP roda direto da pasta: o cliente executa a entrada em `Program/`, e pronto. **`Distribution/` só existe quando você o empacota para outro instalar** sem copiar a pasta. Há dois formatos, e o empacotador de cada um escreve aqui:

| Formato | Empacotador | O que ele escreve em `Distribution/` | Como quem instala o roda |
|---|---|---|---|
| **pacote da linguagem**, num registro de pacotes | `python -m build` (PyPI) · `npm pack` (npm) | a roda do Python, o `.tgz` do npm | o cliente chama o pacote pelo nome, com `uvx` ou `npx` |
| **`.mcpb`** — o pacote de um clique dos clientes de desktop (antes `.dxt`) | `mcpb pack Program Distribution/<nome>.mcpb` | um zip com `Program/` inteiro, dependências incluídas | o usuário abre o arquivo e o cliente instala |

- **O manifesto vai onde o empacotador exige: na raiz do que ele empacota, em `Program/`.** Em Node é o `package.json`, que já mora ali; em Python é o `pyproject.toml`, e publicado, ele passa a ser também a lista de dependências; no `.mcpb` é o `manifest.json`, que precisa estar na raiz do zip.
- **O registro oficial de MCP guarda só a ficha, não o código.** Ele aponta para o pacote que já está no npm, no PyPI ou numa página de lançamentos. A ficha é o `server.json`, que o `mcp-publisher` envia: é configuração da ferramenta de publicação, e mora em `Workshop/`. O registro confere o dono pelo pacote — detalhes na seção 4.2 da `referencia.md`.
- **É resultado:** o empacotador refaz idêntico. Nunca se edita à mão e nunca se versiona.
- **Sem publicação, a pasta não existe:** quem recebe o servidor recebe `Program/` e aponta o cliente para a entrada.

### 2.2 O que fica na raiz, e por imposição de quem

| O arquivo ou a pasta | Quem obriga | O que quebra se ele sair dali |
|---|---|---|
| `CLAUDE.md` | a ferramenta — o Claude Code procura na raiz | a IA abre o projeto sem ler as regras |
| `.claude/` · `.mcp.json` | a ferramenta — o Claude Code, *do assistente, não do programa* | as permissões e os servidores MCP do assistente deixam de carregar |
| `Saída das skills/` · `Saída dos comandos/` | as skills e os comandos — *do assistente, não do programa* | as bases de decisão deixam de ser achadas |
| `Program/` | nós | o registro no cliente aponta para uma entrada que não existe mais |
| `Workshop/` | nós | nada no servidor; os scripts e os testes perdem o caminho de `Program/` |
| `Distribution/` (situacional) | nós | o script de publicação procura o pacote noutro lugar |
| `Files/` (situacional) | nós — como padrão; quem instala pode apontar outro lugar | o servidor deixa de achar o trabalho do usuário no caminho padrão |
| `.git/` · `.gitignore` · `LICENSE` | o Git e o site onde o repositório mora — *do repositório, não do programa* | o repositório deixa de ser reconhecido, o `.gitignore` deixa de valer para o projeto inteiro, a licença não é exibida |

**O que não está nesta tabela não vai para a raiz.** A entrada e o exemplo de registro moram em `Program/`: nenhum dos dois é clicado, e o registro no cliente aponta para onde eles estiverem.

### 2.3 `server/tools/`, nunca um `tools/` solto

**As ferramentas expostas ficam em `server/tools/`** — dentro de `server/`, porque são o que o servidor publica.

**Nunca crie uma pasta solta chamada `tools/` no nível de `Code/`**: ela colidiria com `External/tools/`, que é **executável de terceiro**. São duas coisas completamente diferentes com o mesmo nome, e a confusão é garantida.

| | `Code/server/tools/` | `External/tools/` |
|---|---|---|
| **O que é** | As ferramentas que **você expõe** para o modelo chamar | Executáveis de terceiro que **você aciona** |
| **Quem escreveu** | Você | Outro |
| **Quem chama** | O modelo, de fora | O seu código |

> **Quando abrir `referencia.md`** (na mesma pasta desta skill): a tabela rápida da seção 15 responde onde cada coisa fica; quando ela remeter a uma seção ("ver 6.4"), ou quando a dúvida for o **porquê** de uma pasta, o que ela guarda em detalhe ou como se organiza por dentro, abra `referencia.md` na seção indicada. Para "onde fica X?" a tabela basta — não leia a referência inteira por precaução.

---

## 3. Convenção de nomenclatura

### 3.1 A regra de idioma

**Dentro de `Program/`, tudo em inglês.**

**E aqui a regra vai além das pastas: os nomes das ferramentas expostas e dos campos dos esquemas também são em inglês.** O motivo não é estética — é que **o modelo lê esses nomes para decidir se chama a ferramenta** (seção 6.3 da `referencia.md`). Um nome misturado ou traduzido pela metade atrapalha essa decisão.

**O protocolo também põe forma no nome da ferramenta:** de 1 a 128 caracteres, só letras sem acento, dígitos, `_`, `-` e `.`, sem espaço — e maiúscula conta (`getUser` e `getuser` são duas). O nome é único dentro do servidor.

**As descrições, essas sim, são texto** — e devem ser claras acima de tudo.

**Em `Files/`, o inglês vai até o segundo nível; a liberdade começa um nível abaixo.** O que o usuário nomeia é dele.

### 3.2 Maiúsculas

- **Nível 1 e 2** (`Program/`, `Workshop/`, `Distribution/`, `Files/`; `Code/`, `External/`, `Dependencies/`, `Internal/`) — primeira letra maiúscula, e **sempre o nome completo, nunca abreviado**. São nomes **conceituais**: dizem que tipo de coisa é aquilo.
- **Nível 3 em diante** (`server/`, `tools/`, `backend/`) — minúsculas, sem acento, sem espaço, hífen como separador. São nomes **técnicos**: dizem que parte do sistema é aquilo.

A troca de estilo **é** a fronteira entre conceito e implementação.

### 3.3 Arquivos

Tudo minúsculo, sem acento, sem espaço. Sempre começa pelo contexto (a ferramenta, tipicamente).

- **Hífen (`-`)** separa blocos de conceito principais: `legenda-extrair.ts`, `legenda-esquema.ts`
- **Underscore (`_`)** mantém juntas palavras de um único conceito composto: `linha_do_tempo-ler.ts`
- Quando o caminho já informa o contexto, não repita: `server/tools/legenda/extrair.ts`
- **Arquivo dividido: cada parte leva o nome do original + o que a parte faz.** `arquivos.py` → `arquivos.py` (a casca) + `arquivos_copia.py` + `arquivos_ativacao.py`; `trabalhos.js` → `trabalhos-fluxo.js` + `trabalhos-metricas.js`. **Nunca número** (`-2`, `-parte2`, `-cont`): número diz que o arquivo continua, não diz o quê — e é o que faz alguém abrir três arquivos para achar uma função. Se a parte não tem nome próprio ("é só a continuação da lista"), o corte está no lugar errado: corte por tema (o que as funções têm em comum) ou por quem as usa. **Depois de dividir**, confira que todo nome usado de fora continua acessível — import, export, nome global: a divisão não muda a interface.

### 3.4 Tamanho dos arquivos

**Alvo: até 300 linhas.** Entre **300 e 500** o arquivo está na faixa de folga: divida na próxima vez que mexer nele, **se houver um corte natural** — nunca só para caber. **Acima de 500**, divida agora. Em qualquer caso o corte é por conceito, nunca por número: um arquivo de 520 linhas sem corte natural vira exceção registrada em `Exceções.md`, não um arquivo de 500 mais um de 20. O nome das partes segue a regra da seção 3.3.

### 3.5 Caminhos relativos, sempre

Nada de caminho absoluto no código. **O MCP é executado pelo cliente**, de um diretório de trabalho que você não escolhe e que muda de máquina para máquina. Todo caminho se resolve a partir da localização do próprio arquivo, ou vem de variável de ambiente — é assim que o caminho de `Files/` se torna configurável.

---

## 13. Segurança — a seção mais importante desta versão

**Quem chama as ferramentas é um modelo, e o modelo pode ser induzido pelo conteúdo que acabou de ler.** Ele leu uma página, um arquivo, um e-mail — e esse conteúdo pode conter instruções escritas para fazê-lo chamar a sua ferramenta de um jeito que ninguém pediu. O modelo não tem como distinguir com segurança o que é pedido do usuário do que é texto que ele leu.

> **Portanto: cada ferramenta exposta é superfície de ataque.**

### 13.1 As cinco regras

1. ⚠ **Valide toda entrada.** Sempre, em `server/tools/`, antes de qualquer coisa. Tipo, faixa, formato, tamanho. Nada passa direto para `backend/` ou `clients/`.
2. ⚠ **Limite o escopo — nada de aceitar caminho livre e ler o disco inteiro.** Declare a pasta permitida — `Files/`, ou o caminho que quem instala configurou — e recuse o que sair dela, inclusive por caminhos que sobem de nível. O mesmo vale para endereço de rede, identificador de projeto, nome de tabela: lista fechada, não campo livre.
3. ⚠ **O que é destrutivo pede confirmação humana.** Apagar, sobrescrever, enviar, publicar, gastar dinheiro. Marque essas ferramentas como destrutivas (a anotação `destructiveHint` do protocolo) e faça a confirmação chegar à pessoa — nunca deixe o modelo confirmar sozinho. A anotação é só um aviso, que o cliente não é obrigado a levar a sério: se a confirmação importa, a própria ferramenta a pede, perguntando ao usuário pelo protocolo (a elicitação) antes de agir.
4. ⚠ **Credencial nunca em argumento de linha de comando — ela aparece na lista de processos da máquina.** Variável de ambiente, passada pelo cliente (seção 10.2 da `referencia.md`).
5. ⚠ **O log na saída de erro não pode vazar segredo.** Nem credencial, nem conteúdo sensível do usuário. Ele é lido por gente e costuma ficar guardado.

### 13.2 O que completa

6. **A descrição da ferramenta também é superfície.** Descrição vaga faz o modelo chamar quando não devia; descrição que promete demais faz ele confiar demais no resultado.
7. **O que a ferramenta devolve vai direto para dentro do modelo.** Se ela repassa conteúdo de fora — uma página, um arquivo, uma resposta de API —, esse conteúdo pode conter instruções. Devolva-o marcado como dado, não como orientação, e nunca o repita como se fosse conclusão sua.
8. **O `.env` do desenvolvimento mora em `Workshop/` e nunca se versiona.** O que se versiona é o `.env.example`, com os nomes das variáveis e sem os valores. Credencial nunca no código, nunca no exemplo de registro, nunca de volta na resposta de uma ferramenta.
9. **Cada dependência roda com o acesso do MCP** — e o MCP costuma ter acesso ao programa controlado e aos arquivos do usuário. Poucas, conhecidas, com as versões fixas na lista.
10. **Limite a frequência das chamadas.** O protocolo exige do servidor, além de validar a entrada e limpar a saída, que controle o acesso e limite quantas vezes uma ferramenta pode ser chamada — um modelo em laço chama a mesma ferramenta centenas de vezes.

---

## 14. Princípios globais

1. **MCP × plugin:** expõe o programa para outra coisa conversar × executa uma função dentro dele.

2. **Nada na saída padrão.** No transporte stdio ela é o canal do protocolo (seção 0); log na saída de erro, sempre.

3. **`server/` é o coração**, e as ferramentas ficam em **`server/tools/`** — nunca num `tools/` solto, que colidiria com `External/tools/`.

4. **A ferramenta valida e despacha; a lógica é `backend/`; quem fala com o programa controlado é `clients/`.**

5. **O esquema é o contrato que o modelo lê** — descrições claras, restrições no esquema.

6. **Cada ferramenta exposta é superfície de ataque:** valida tudo, limita o escopo, o destrutivo confirma.

7. **Credencial por variável de ambiente**, nunca em argumento de linha de comando.

8. **Ferramenta exposta é interface pública** — mudar nome ou formato quebra quem depende.

9. **Poucas ferramentas bem descritas** valem mais do que muitas parecidas.

10. **Não há tela** — se você sentir falta de uma, o projeto quer ser dois.

11. **O caminho de `Files/` é configurável.** Quem instala escolhe onde; o servidor lê o caminho do ambiente e nunca o fixa no código.

12. **Nunca criar pastas vazias para manter simetria.** A ausência é informativa.

13. **A pasta do esqueleto combinado nasce vazia de propósito; a IA não cria pasta por simetria.** As pastas que o Preparar projeto cria de uma vez existem antes do primeiro arquivo, e isso é intencional. O que continua proibido é a IA, no meio de uma tarefa, criar pasta que a tarefa não usa só porque a referência a descreve.

14. **`Code/` guarda só código.** Mídia, variável de ambiente, configuração de ferramenta e pasta de dependências nunca entram em `Code/` — vão para `Workshop/` ou `Dependencies/`.

15. **Princípio DRY** — função, constante ou esquema que aparece em 2+ lugares sobe para `utils/`, `constants/` ou `types/`.

16. **Mover ou renomear pasta quebra caminho.** Import, leitura de arquivo, o exemplo de registro, o registro que o usuário já colou no cliente — depois de mover, procure pelas referências ao caminho antigo e corrija, antes de dar por terminado.

17. **Nomeie a ferramenta antes de falar dela.** Diga **empacotador**, **compilador** ou **gerenciador de pacotes** — e, quando souber, o nome dela (pip, npm, `python -m build`). Nunca uma perífrase solta como "a etapa de montagem", que não diz qual ferramenta é nem onde fica a configuração dela.

18. **Cada linha de árvore se explica sozinha.** Ao desenhar uma árvore de pastas — aqui, em `Convenções.md` ou em qualquer registro —, cada linha diz o que a pasta guarda. Um símbolo ou uma palavra solta nunca é a explicação inteira.

### 14.1 A pasta que ninguém previu

Quando o protocolo, o cliente ou uma ferramenta exigir uma pasta que esta referência não previu:

| Se ela é… | Vai para |
|---|---|
| da ferramenta ou do ambiente | `Workshop/` |
| parte do produto que você escreve | `Program/` |
| parte do pacote entregue | `Distribution/` |
| **em nenhuma hipótese** | **dentro de `Code/`** |

E registre a decisão em `Convenções.md`, em cinco linhas, para não ser rediscutida na próxima vez.

---

## 15. Tabela de referência rápida

### Na raiz

| Item | Existe quando |
|---|---|
| arquivo clicável | **Nunca** — o cliente executa o servidor |
| `CLAUDE.md` | **Sempre** — as regras que a IA lê |
| `Program/` | **Sempre** |
| `Workshop/` | Há teste, script, lista de dependências ou configuração de ferramenta |
| `Distribution/` | O servidor é publicado como pacote num registro, ou empacotado como `.mcpb` — ver 2.1, acima |
| `Files/` | O servidor guarda algo de verdade — com o caminho configurável — ver 11 |

O resto do que pode ficar na raiz, e por quê, está na tabela 2.2.

### Em Program/

| Item | Existe quando |
|---|---|
| a entrada | **Sempre** — uma só, e que não imprime na saída padrão — ver 4 |
| o exemplo de registro | **Sempre** — é a instalação inteira, com as variáveis de ambiente — ver 4.2 |
| o manifesto do pacote (`package.json` · `pyproject.toml` · `manifest.json`) | O servidor é publicado ou empacotado — o empacotador o exige na raiz do que empacota — ver 2.1, acima |
| `Code/` | **Sempre** |
| `Assets/` | **Nunca** — não há o que exibir — ver 7 |
| `External/` | Há algo de terceiro que você colou à mão — ver 9.2 |
| `Dependencies/` | Há gerenciador de pacotes — o servidor procura as bibliotecas ao rodar — ver 9.3 |
| `Internal/` | O servidor guarda log em arquivo, cache, estado ou fila — ver 10 |

### Em Code/

| Pasta | Existe quando |
|---|---|
| `server/` | **Sempre** — é o coração |
| `server/tools/` | **Sempre** — uma pasta por ferramenta exposta |
| `server/resources/` | O servidor publica recursos — dado que o cliente lê por endereço — ver 6.2 |
| `types/` | **Sempre** — os esquemas que o modelo lê — ver 6.3 |
| `backend/` | Há lógica de verdade — e ela não conhece o protocolo |
| `clients/` | O MCP controla um programa ou consulta um serviço — quase sempre |
| `prompts/` | O MCP expõe prompts, ou chama um modelo por dentro — ver 6.4 |
| `utils/` | Há função usada em 2+ lugares |
| `constants/` | Há valor fixo em 2+ arquivos, ou padrão de fábrica |
| `frontend/` · `locales/` | **Nunca** — não há tela |

### Em External/ e Internal/

| Item | Existe quando |
|---|---|
| `External/tools/` | O MCP aciona executável de terceiro — não confundir com `server/tools/` |
| `External/libraries/` | Há SDK do programa controlado, baixado à mão |
| `External/runtimes/` | Raro — o MCP precisa rodar sem o usuário instalar a linguagem |
| `External/ai-models/` | Raro — quem chama já é um modelo |
| log na saída de erro | **Sempre** — nunca na saída padrão — ver 10.1 |
| `Internal/cache/` · `state/` · `temp/` | O servidor precisa guardar algo entre chamadas — ver 10 |
| `Internal/queue/` | Há trabalho longo, com "comece" + "consulte o andamento" |
| variáveis de ambiente | **Sempre** — é por onde vêm credencial e configuração — ver 10.2 |

### Em Workshop/

| Item | Existe quando |
|---|---|
| `tests/` | Há teste escrito — incluindo o teste pelo protocolo — ver 8.1 |
| `scripts/` | Há execução local contra cliente de teste, ou publicação — ver 8.2 |
| `requirements.txt` (ou a lista da sua linguagem) | Há gerenciador de pacotes — a exceção do Node e a do pacote publicado estão em 9.3 |
| configuração das ferramentas | Há empacotador, executor de testes ou verificador de estilo configurado |
| `server.json` | O servidor é listado no registro oficial de MCP — é a ficha que o `mcp-publisher` envia — ver 2.1, acima |
| `.env.example` · `.env` | O desenvolvimento usa variáveis de ambiente |

### Em Files/

| Item | Existe quando |
|---|---|
| `Files/` no caminho padrão | O servidor roda da pasta do projeto e ninguém apontou outro lugar — ver 11 |
| o caminho configurado | Quem instala apontou outro lugar, pela variável de ambiente do registro |
| confirmação humana | **Sempre** que uma ferramenta apaga ou sobrescreve algo ali — ver 13.1, acima |

---

## 16. Pares que se confundem

| | |
|---|---|
| **MCP × plugin** | Expõe o programa para outra coisa conversar × executa uma função dentro dele |
| **`server/tools/` × `External/tools/`** | As ferramentas que você expõe × executáveis de terceiro que você aciona |
| **`server/tools/` × `server/resources/`** | O modelo decide chamar, e pode agir × o cliente lê um dado por endereço, e nada muda |
| **`server/` × `clients/`** | O outro inicia a conversa × você inicia |
| **`server/` × `backend/`** | A porta que valida e despacha × a lógica, que não conhece o protocolo |
| **`clients/` × `External/libraries/`** | O seu código que fala com o programa controlado × o SDK dele, que você substitui inteiro |
| **`External/` × `Dependencies/`** | Você colou à mão × o gerenciador de pacotes instalou |
| **`Program/Code/` × `Workshop/`** | Roda quando o servidor roda × só existe no desenvolvimento |
| **`Workshop/` × `Distribution/`** | Onde fica o empacotador e a configuração dele × onde fica o pacote que ele produz |
| **`Files/` × `Internal/`** | Apagou e o usuário perde trabalho × apagou e o servidor só refaz |
| **esquema × validação** | O que o modelo lê para decidir × o que recusa a entrada errada — precisa dos dois |
| **prompt interno × prompt exposto** | Você usa por dentro × é interface pública |
| **`constants/` × variável de ambiente** | Padrão de fábrica, igual em toda instalação × o que o usuário passou no registro |
| **saída padrão × saída de erro** | É o protocolo — nada pode ser escrito nela × é onde o log vai |
| **argumento de linha de comando × variável de ambiente** | Visível na lista de processos × o lugar da credencial |
| **acrescentar × substituir** | Reversível de cabeça × pede confirmação |
| **índice × fonte** | O MCP refaz × nunca se apaga sozinho |

---

## 17. A base deste projeto — `Saída das skills/Arquitetura modular/`

Esta referência é genérica. O que é específico deste projeto mora em `Saída das skills/Arquitetura modular/` — `Convenções.md` (o que vale para o projeto inteiro) e `Exceções.md` (um caso que foge do padrão) — e **um desvio registrado ali sempre vence a regra genérica**. O nome da pasta é fixo: `Arquitetura modular`.

**A AMF cria e mantém esta pasta, e só ela.** As pastas-mãe — `Saída das skills/` e `Saída dos comandos/` — **não são da AMF**: quem as usa são as outras skills e os comandos. A AMF não as organiza, não cobra que existam e não as desenha nas árvores, a não ser marcadas com `⊘`.

### Se a pasta não existir, crie-a agora

`Convenções.md`:

```markdown
# Convenções — Arquitetura modular

Regras específicas deste projeto que complementam a referência genérica da AMF. Aqui entram os desvios ou detalhes que a referência não previa, mas que valem para o projeto inteiro.

<!-- Uma convenção por vez; antes de adicionar, verifique se algo parecido já existe.
Formato (cinco linhas): ## título · Regra: … · Vale em: … · Por quê: uma linha · Origem: data · discussão -->
```

`Exceções.md`:

```markdown
# Exceções — Arquitetura modular

Regras que substituem uma convenção geral (da referência ou de `Convenções.md`) num módulo, arquivo ou situação específica. Se existe uma exceção aqui, ela sempre vence.

<!-- Formato (cinco linhas): ## [módulo/arquivo/situação] · Exceção: o que é diferente · Vale em: … · Por quê: uma linha · Origem: data · discussão -->
```

Avise o usuário que a base foi criada.

### Registrar um desvio dito em linguagem natural

Quando o usuário disser algo como "neste projeto o `prompts/` fica dentro de cada ferramenta" ou "a ferramenta X é uma exceção porque…": (1) leia os dois arquivos; (2) decida se é convenção (vale para o projeto inteiro) ou exceção (um caso); (3) veja se já existe algo parecido — refine em vez de duplicar; (4) grave no formato de cinco linhas e mostre o resultado.

### Depois de criar, mover ou dividir

Se a tarefa produziu um desvio novo, registre-o — só o que é **relevante para continuar o desenvolvimento**, nunca o relato do que foi feito.

### O que entra, em que tamanho, e quando cresce

**Filtro:** entra só o que muda uma decisão futura de lugar ou de nome de pasta. Não entra: nota de implementação, trecho de código, o que um comando deve devolver, a história da decisão (mora na discussão, citada). **Teto:** cinco linhas por registro — título · regra ou exceção · onde vale · por quê em uma linha · origem. **Transbordo:** `Convenções.md` ou `Exceções.md` acima de **~20 KB** vira pasta com `Índice - Convenções.md` (ou `- Exceções.md`) mais um arquivo por tema — por pasta do projeto: `Files.md`, `Internal.md`, `Code.md`, … — e a consulta passa a ler o índice e abrir só o tema da tarefa. Ao encontrar um arquivo acima do limite, proponha ao usuário reparti-lo — e não faça sem ele.
