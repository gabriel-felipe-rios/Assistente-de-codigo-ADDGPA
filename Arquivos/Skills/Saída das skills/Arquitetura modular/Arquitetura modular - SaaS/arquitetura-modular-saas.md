---
name: arquitetura-modular-saas
description: Referência completa da AMF (Arquitetura Modular por Features) na versão SaaS — diz em que pasta cada arquivo mora, como nomear pasta e arquivo, e o que cada área guarda. É a versão certa para aplicação web com conta de usuário — login, servidor seu e dado separado por cliente —, e para toda aplicação web que precise de chave secreta, porque segredo no navegador é segredo público. Use SEMPRE antes de criar, mover, renomear ou deletar qualquer arquivo ou pasta deste projeto, mesmo que o usuário não peça para "seguir a arquitetura". Antes dela, leia os desvios registrados em "Saída das skills/Arquitetura modular/Exceções.md" e "Convenções.md" — um desvio do projeto sempre vence a regra genérica.
---

# AMF — Arquitetura Modular por Features — Referência Completa — versão **SaaS**

Esta é a versão da AMF para **aplicação web com conta de usuário**: login, servidor, e dado separado por cliente. É a referência genérica, igual para todos os projetos SaaS e para qualquer linguagem. Leia-a antes de criar, mover, renomear ou deletar qualquer arquivo ou pasta — mas primeiro confira os desvios deste projeto em `Saída das skills/Arquitetura modular/` (seção 17): um desvio registrado sempre vence a regra genérica. Se a pasta não existir, a seção 17 diz como criá-la.

---

## 0. A regra da raiz — o que a plataforma manda

**Onde a plataforma manda, ela vence.** A AMF se aplica no espaço livre que sobra.

Num SaaS entram em jogo até cinco ferramentas, e vale nomeá-las antes de falar delas:

- **o gerenciador de pacotes** (npm, pip) — baixa as bibliotecas que cada lista de dependências pede;
- **o empacotador do frontend** (Vite, webpack) — junta o código que roda no navegador num site montado;
- **o framework full-stack** (Next.js, Nuxt, SvelteKit), quando existe — roda a mesma tela no servidor e no navegador, e impõe as pastas dele (2.6);
- **o Docker** — empacota a aplicação num contêiner, a partir da receita do `Dockerfile`. Só existe quando a hospedagem publica contêiner;
- **a hospedagem** — recebe o contêiner (Fly.io, Render, Railway) ou o código, que ela mesma monta em funções (Vercel, Netlify); injeta as variáveis de ambiente e sobe a aplicação.

Quase nenhuma delas exige a raiz. O Docker aceita o `Dockerfile` em qualquer caminho (`docker build -f Workshop/Dockerfile .`), o empacotador aceita qualquer pasta de entrada e de saída, e Fly.io, Render, Railway e Netlify deixam apontar onde está a configuração de publicação. **A exceção é a Vercel:** ela lê o `vercel.json` na pasta-raiz do projeto dela, e a aplicação não enxerga nada fora dessa pasta — então, quando a hospedagem é a Vercel, ele fica na raiz (2.2). Fora isso, a raiz fica livre: nela ficam o `CLAUDE.md`, as quatro pastas de nível 1 e o que a tabela 2.2 lista. **Todo o resto mora dentro de uma das quatro pastas** — inclusive o `.env`, o `.env.example` e o `Dockerfile`, que moram em `Workshop/`.

### 0.1 A régua que separa esta versão da Página web

| Pergunta | Se a resposta é sim… |
|---|---|
| Existe **conta de usuário** — login, dado que é de um cliente e não de outro? | é SaaS |
| Algo fica **guardado do lado de lá**, num servidor seu? | é SaaS |
| A aplicação precisa de **chave secreta**? | é SaaS — segredo no navegador é segredo público |
| Nenhuma das três? | é **Página web**, e esta não é a versão certa |

---

## 1. Os baldes

Toda pasta deste projeto pertence a um destes baldes. Antes de criar qualquer coisa, descubra em qual ela cai — isso resolve a maioria das dúvidas sozinho.

| Balde | Critério | Se apagar |
|---|---|---|
| **`Program/`** | Eu escrevi · é a aplicação · é o que vai para o servidor — dentro do contêiner, ou nas funções da hospedagem | A aplicação não sobe mais |
| ↳ `Code/` | Só código, e nada mais · roda quando a aplicação roda — no navegador e no servidor | A aplicação para |
| ↳ `Assets/` | Eu fiz ou escolhi · não é código · a interface mostra ou toca | A interface fica sem imagem, som ou fonte |
| ↳ `External/` | **Eu colei à mão** · outro escreveu · eu não edito — aqui, só modelo de IA servido junto | O que dependia dele para (e eu baixo de novo à mão) |
| ↳ `Dependencies/` | **O gerenciador de pacotes instalou** · **o servidor** precisa para rodar — as do navegador não moram aqui (2.3) | O servidor para (e um comando recria) |
| ↳ `Internal/` | O programa escreveu · pode apagar que ele recria — aqui não é pasta: vira serviço | Nada se perde, exceto o que está no cofre de segredos |
| **`Workshop/`** | Eu escrevi ou instalei · **só eu uso, no desenvolvimento e na operação** · `.env`, `Dockerfile`, ambientes, dados de teste | A aplicação no ar continua; eu é que não consigo mais empacotá-la nem publicá-la |
| **`Distribution/`** | O empacotador montou · é o frontend pronto para o navegador | O empacotador refaz idêntico |
| **`Files/`** | É o trabalho de quem usa · ninguém encosta — aqui não é pasta: é banco e bucket, isolados por conta (2.4) | **Perde tudo que foi feito — de todos os clientes** |

**A pergunta que separa os baldes:** *o que acontece com isso quando eu publico uma versão nova?*
`Program/` é substituído inteiro, de uma vez · `Workshop/` não vai junto · `Distribution/` é o resultado · o banco e o bucket, com o trabalho dos clientes, são intocáveis.

---

## 2. A árvore completa

Tudo abaixo é **situacional** exceto `Program/`, `Program/Code/` com `server/` e `backend/`, e `Workshop/` com o `.env.example`. Só crie o que o projeto realmente precisa.

São **quatro pastas de nível 1, irmãs**: `Program/`, `Workshop/`, `Distribution/` e `Files/` — e num SaaS a quarta **não é pasta**: está desenhada para dizer onde o trabalho do usuário foi parar.

Legenda: `=` igual à versão Desktop · `~` existe, mas muda de conteúdo ou de regra · `→` deixa de ser pasta e vira outra coisa · `✖` não existe · `+` é novo aqui. **Cada linha se explica sozinha** — o símbolo nunca é a explicação inteira.

```
[Nome do projeto]/                     A RAIZ
│
✖ arquivo para clicar                  quem sobe o servidor é a HOSPEDAGEM; quem abre a
│                                      interface é o NAVEGADOR, pelo endereço
├── CLAUDE.md                          as regras que a IA lê ao abrir o projeto
├── + vercel.json   api/               só quando a hospedagem é a Vercel, que os lê na raiz
│                                      (api/, só com função sem framework: código fora de
│                                      Code/ porque a Vercel manda) — ver 2.2
├── .claude/   .mcp.json               ⊘ do assistente — não são da AMF
├── ⊘ Saída das skills/                não é da AMF…
│   └── Arquitetura modular/           …EXCETO esta: Convenções.md + Exceções.md
├── ⊘ Saída dos comandos/              não é da AMF
│
├── Program/                           O QUE A APLICAÇÃO É · nomes SEMPRE em inglês
│   │                                  é o que vai para o servidor: contêiner ou função
│   │
│   ├── Code/                          SÓ código · roda quando a aplicação roda
│   │   ├── ~ as duas entradas         a do servidor (o processo que a hospedagem sobe) e a
│   │   │                              do cliente (o index.html que o navegador carrega)
│   │   ├── ~ frontend/                o que roda no NAVEGADOR, por módulo:
│   │   │   └── auth/ billing/ admin/ …    conta, cobrança, área administrativa…
│   │   ├── ~ backend/                 o que roda no SERVIDOR, pelos MESMOS módulos:
│   │   │   └── auth/ billing/ admin/ jobs/    …e jobs/, o trabalho agendado
│   │   ├── ~ server/                  DEIXA DE SER SITUACIONAL: é a porta de entrada
│   │   │   └── v1/                    as rotas expostas · a API pública versionada
│   │   ├── ~ clients/                 você liga pra fora — mas só o backend usa
│   │   ├── ~ types/                   vira o CONTRATO entre navegador e servidor
│   │   ├── = utils/                   funções reusadas em 2+ lugares
│   │   ├── = constants/               valores fixos + padrões de fábrica
│   │   ├── = locales/                 textos traduzidos
│   │   └── ~ prompts/                 os prompts, uma subpasta por módulo · rodam no backend
│   │
│   ├── ~ Assets/                      o que se vê ou ouve · o empacotador copia para o
│   │   └── icons/ images/ fonts/ …    frontend montado, renomeado com hash · {tipo}/{módulo}/
│   │
│   ├── ~ External/                    SÓ o que você colou à mão · você não edita
│   │   ├── ✖ tools/                   não existe: ferramenta de sistema vai na imagem do contêiner
│   │   ├── ✖ libraries/               não existe: toda biblioteca vem do gerenciador de pacotes
│   │   ├── ✖ runtimes/                não existe: a imagem base do contêiner é o runtime
│   │   └── ~ ai-models/               só quando você serve um modelo próprio junto
│   │
│   ├── ~ Dependencies/                as bibliotecas do SERVIDOR · o gerenciador de pacotes
│   │                                  instalou, e o servidor as procura ao rodar — em Node,
│   │                                  node_modules/ direto em Program/, com o package.json
│   │
│   ├── + migrations/                  as migrações do banco, uma por arquivo · minúsculo porque
│   │                                  é o nome que a ferramenta do banco impõe (o precedente do
│   │                                  node_modules/) · rodam contra o banco de produção a cada
│   │                                  publicação, por isso são do programa
│   │
│   └── → Internal/                    o programa escreveu · ELE INTEIRO VIRA SERVIÇO
│       ├── → logs/                    observabilidade, num painel externo
│       ├── → cache/                   cache em memória, serviço próprio
│       ├── → queue/                   fila de verdade, serviço próprio
│       ├── → temp/                    disco efêmero do contêiner · some a cada publicação
│       ├── → state/                   tabelas no banco
│       ├── → config/                  variáveis de ambiente + tabelas no banco
│       └── → credentials/             cofre de segredos da hospedagem
│
├── Workshop/                          SÓ NO DESENVOLVIMENTO E NA OPERAÇÃO · nada daqui
│   │                                  responde a um usuário
│   ├── + .env.example  ·  .env        a LISTA das variáveis, versionada · os valores do seu
│   │                                  ambiente, NUNCA versionados
│   ├── + Dockerfile                   a receita que o Docker lê para empacotar a aplicação ·
│   │                                  só quando a hospedagem publica contêiner
│   ├── + deploy/                      os ambientes — desenvolvimento, homologação, produção —
│   │                                  e a configuração que a hospedagem lê para publicar
│   │                                  (a da Vercel fica na raiz — 2.2)
│   ├── + seeds/                       dados de teste · nunca rodam em produção
│   ├── configuração do empacotador    a do frontend (Vite, webpack) · aponta para
│   │                                  Program/Code/ e escreve em Distribution/
│   ├── as listas de dependências      a do NAVEGADOR (package.json) e a do SERVIDOR
│   │                                  (requirements.txt… — em Node, ela fica em Program/)
│   ├── node_modules/                  a pasta de dependências do NAVEGADOR · o empacotador já
│   │                                  levou para dentro do frontend montado o que o código usa
│   ├── ~ tests/                       espelha o caminho de Program/Code/ · + rota, ponta a
│   │                                  ponta e isolamento entre contas
│   └── = scripts/                     empacotar, publicar, backup, tarefas de operação
│
├── Distribution/                      O QUE ELE PRODUZ · o frontend montado pelo empacotador,
│                                      que o Docker põe dentro do contêiner
│
└── → Files/                           O QUE É DO USUÁRIO · não é pasta: banco + bucket no
                                       servidor, ISOLADOS POR CONTA — ver 2.4
```

`⊘` marca o que está na raiz mas **não é da AMF**: é do assistente de código, e esta referência não organiza, não cria e não cobra nada ali — com a única exceção de `Saída das skills/Arquitetura modular/` (seção 17).

### 2.1 `Distribution/` — o frontend montado

O empacotador do frontend lê a entrada do cliente em `Program/Code/`, junta o código que roda no navegador e os recursos de `Assets/`, renomeia cada arquivo com um hash e escreve o resultado em `Distribution/`. É isso que o navegador recebe.

- O `Dockerfile`, em `Workshop/`, copia `Program/` **e** `Distribution/` para dentro do contêiner; o servidor entrega o frontend montado (ou uma CDN o entrega, se a hospedagem tiver uma). Na hospedagem que monta a partir do código (Vercel, Netlify) não há contêiner: ela roda o empacotador e serve `Distribution/` ela mesma.
- Se a linguagem do servidor se compila (TypeScript, Go), o resultado dessa compilação também vai para `Distribution/`, numa subpasta própria.
- A imagem do contêiner **não** vai para `Distribution/`: o Docker a guarda no registro dele, e é de lá que a hospedagem a puxa.
- O que está em `Distribution/` é **resultado**: nunca se edita à mão e nunca se versiona.

### 2.2 O que fica na raiz, e por imposição de quem

| O arquivo ou a pasta | Quem obriga | O que quebra se ele sair dali |
|---|---|---|
| `CLAUDE.md` | a ferramenta — o Claude Code procura na raiz | a IA abre o projeto sem ler as regras |
| `.claude/` · `.mcp.json` | a ferramenta — o Claude Code, *do assistente, não do programa* | as permissões e os servidores MCP do assistente deixam de carregar |
| `Saída das skills/` · `Saída dos comandos/` | as skills e os comandos — *do assistente, não do programa* | as bases de decisão deixam de ser achadas |
| `Program/` | nós | o `Dockerfile` e o empacotador deixam de achar o código |
| `Workshop/` | nós | nada na aplicação no ar; você deixa de conseguir empacotar e publicar |
| `Distribution/` | nós | o `Dockerfile` não acha o frontend montado, e a aplicação sobe sem interface |
| `vercel.json` (ou `vercel.toml`, `vercel.ts`) | a hospedagem — a Vercel, **quando é ela**: lê o arquivo na pasta-raiz do projeto, e a aplicação não enxerga nada fora dessa pasta | a publicação sai sem as rotas, os cabeçalhos e os agendamentos que ele declara |
| `api/` | a hospedagem — a Vercel, **quando** há função sem framework: é a pasta, na raiz do projeto, que ela transforma em função. **Exceção de plataforma:** é código fora de `Code/`, porque a Vercel manda — a rota continua sem lógica e chama o `backend/` | as rotas não viram função e a publicação sai sem servidor — registre em `Exceções.md` |
| `.git/` · `.gitignore` · `LICENSE` | o Git e o site onde o repositório mora — *do repositório, não do programa* | o repositório deixa de ser reconhecido, o `.gitignore` deixa de valer para o projeto inteiro, a licença não é exibida |

**O que não está nesta tabela não vai para a raiz.** O `.env` e o `.env.example` não estão: são ambiente, não produto, e moram em `Workshop/` — ⚠ **e o `.env` de verdade nunca é versionado.** O `Dockerfile` e a configuração de publicação também moram em `Workshop/`, porque as outras hospedagens comuns deixam apontar o caminho: o Docker lê `-f Workshop/Dockerfile` e procura `Workshop/Dockerfile.dockerignore` antes do `.dockerignore` da raiz; o Fly.io aceita `--config`; o Render, o campo Blueprint Path; o Railway, o caminho do arquivo de configuração nas opções do serviço; a Netlify, o diretório de pacote (package directory). O detalhe, por hospedagem, está na seção 8.2 da `referencia.md`.

### 2.3 As dependências — os dois casos ao mesmo tempo

O SaaS é a única variação com **as duas respostas** do teste das dependências no mesmo projeto: *apague a pasta de dependências e rode a aplicação já montada. Funcionou?*

| Lado | Funcionou? | Por quê | Mora em |
|---|---|---|---|
| **Navegador** | **sim** | o empacotador já levou para dentro do frontend montado o que o código usa | **`Workshop/`**, com a lista dela |
| **Servidor** | **não** | o servidor procura a biblioteca na hora de rodar; sem ela, nem sobe | **`Program/Dependencies/`** — em Node, `Program/node_modules/`, com o `package.json` ao lado |

Sem essa distinção escrita, uma das duas nasce no lugar errado. O detalhe está na seção 9.4 da `referencia.md`.

### 2.4 Onde o trabalho do usuário mora — `Files/` não é pasta aqui

**Onde o trabalho do usuário mora nesta plataforma:** no servidor, em dois lugares — o **banco** (o dado estruturado: registros, configuração de conta, histórico) e o **bucket** (os arquivos: anexo, foto, documento, exportação gerada) —, **isolados por conta**.
**O que você tem permissão de escrever lá:** tudo o que a aplicação precisa, **sempre em nome de uma conta e só na dela**. Nunca no disco do contêiner, que some a cada publicação; nunca sem o filtro por dono.

O desenho completo — o isolamento, os formatos, as etapas — está na seção 11 da `referencia.md`.

### 2.5 Três erros de estrutura que esta versão proíbe

Estes três aparecem sempre que alguém tenta "adaptar" a AMF para web, e todos os três estão errados:

1. **Não crie `cliente/` nem `servidor/` no topo.** `frontend/` **já é** o navegador e `backend/` **já é** o servidor. Criar essas pastas duplica a fronteira que já existe. E `server/` fica no nível de `Code/` — ele não é "o lado servidor", é **a porta de entrada** por onde chamam você.
2. **Não crie `compartilhado/` (nem `shared/`, `common/`).** `types/` e `constants/`, no nível de `Code/`, **já são** o compartilhado. Uma terceira pasta com esse papel só cria dúvida sobre em qual das três a coisa vai.
3. **`auth/`, `billing/`, `admin/` e `jobs/` são módulos**, não pastas de topo. Eles vivem **dentro** de `frontend/` e `backend/`, como qualquer outro módulo. `jobs/` costuma existir só no backend — e isso é normal, não é assimetria a corrigir.

### 2.6 Quando o framework roda os dois lados — SSR, componentes de servidor, funções

Com framework full-stack (Next.js, Nuxt, SvelteKit), a mesma tela é renderizada primeiro no servidor e depois no navegador, e a fronteira deixa de ser a pasta: passa a ser o **arquivo**, marcado por diretiva (`'use client'`, `'use server'`). `frontend/` = navegador e `backend/` = servidor continua valendo — três regras seguram a separação:

1. **O que toca segredo, banco ou `clients/` mora em `backend/` e declara que é do servidor** — no Next.js, `import 'server-only'` na primeira linha: se algo do navegador o importar, o empacotador para com erro. A página e o componente só chamam o `backend/`.
2. **Ação de servidor é rota.** A função marcada `'use server'` responde a um POST direto, sem passar pela tela: vale para ela tudo o que vale para `server/` — validar, autenticar e autorizar dentro dela (13.3).
3. **Componente do navegador renderizado no servidor continua sendo navegador.** Tudo o que ele recebe chega ao navegador: passe só o que a tela mostra, nunca o registro inteiro do banco.

**Onde o framework manda, ele vence.** Nuxt e SvelteKit deixam apontar as pastas deles para `Program/Code/` e `Program/Assets/` — aponte. O Next.js não deixa: `app/` fica na raiz do projeto dele ou em `src/`, e `public/`, `next.config.*` e os `.env` ficam na raiz do projeto dele. Aí o framework vence, como **exceção de plataforma**: a raiz do projeto Next.js é `Program/` (os comandos recebem a pasta — `next build Program`), `Program/app/` faz o papel de `Code/` e `Program/public/` o de `Assets/`, e `Program/` continua copiável inteiro e fiel aos baldes. O `.env` continua em `Workshop/`: o script o carrega no processo antes de chamar o Next.js, que olha o ambiente do processo antes de procurar arquivo. A árvore desenhada está na seção 6.12 da `referencia.md`; registre em `Exceções.md`.

**Função serverless e edge não é processo que fica de pé:** não há disco que dure (na Vercel, só `/tmp`, e ele some), não há memória entre uma chamada e outra, e há tempo máximo por chamada — `jobs/` passa a ser disparado pelo agendador da hospedagem. O detalhe está na seção 6.11 da `referencia.md`.

> **Quando abrir `referencia.md`** (na mesma pasta desta skill): a tabela rápida da seção 15 responde onde cada coisa fica; quando ela remeter a uma seção ("ver 9.4"), ou quando a dúvida for o **porquê** de uma pasta, o que ela guarda em detalhe ou como se organiza por dentro, abra `referencia.md` na seção indicada. Para "onde fica X?" a tabela basta — não leia a referência inteira por precaução.

---

## 3. Convenção de nomenclatura

### 3.1 A regra de idioma

**Dentro de `Program/`, tudo em inglês.** É código: precisa ser previsível para ferramenta, editor e IA. `frontend`, `backend`, `server`, `utils` são termos que o mundo inteiro reconhece — traduzir só cria atrito.

**Nas rotas expostas, o inglês também vale** — a rota é interface pública, lida por gente que não fala português, e uma vez publicada ela é contrato (seção 6.4 da `referencia.md`).

**No trabalho do usuário, a liberdade começa um nível abaixo.** Nome de projeto, de pasta, de arquivo que ele criou — livre, em português, com acento e espaço se quiser. O código não depende disso.

### 3.2 Maiúsculas

- **Nível 1 e 2** (`Program/`, `Workshop/`, `Distribution/`; `Code/`, `Assets/`, `External/`, `Dependencies/`, `Internal/`) — primeira letra maiúscula, e **sempre o nome completo, nunca abreviado**. São nomes **conceituais**: dizem que tipo de coisa é aquilo.
- **Nível 3 em diante** (`frontend/`, `server/`, `seeds/`) — minúsculas, sem acento, sem espaço, hífen como separador. São nomes **técnicos**: dizem que parte do sistema é aquilo.

A troca de estilo **é** a fronteira entre conceito e implementação. **Exceção:** o nome que a ferramenta impõe fica como ela manda, em qualquer nível — `node_modules/` e `migrations/`, direto em `Program/`, são minúsculos porque o npm e a ferramenta do banco os chamam assim.

### 3.3 Arquivos

Tudo minúsculo, sem acento, sem espaço. Sempre começa pelo contexto (módulo ou feature).

- **Hífen (`-`)** separa blocos de conceito principais: `clientes-consulta.ts`, `clientes-cadastro.ts`
- **Underscore (`_`)** mantém juntas palavras de um único conceito composto: `conta_a_pagar-consulta.ts`
- Sempre começa pelo contexto: `clientes-consulta.ts`, nunca `consulta-clientes.ts`
- Quando o caminho já informa o contexto, não repita: `backend/clientes/consulta.ts`
- **Arquivo dividido: cada parte leva o nome do original + o que a parte faz.** `arquivos.py` → `arquivos.py` (a casca) + `arquivos_copia.py` + `arquivos_ativacao.py`; `trabalhos.js` → `trabalhos-fluxo.js` + `trabalhos-metricas.js`. **Nunca número** (`-2`, `-parte2`, `-cont`): número diz que o arquivo continua, não diz o quê — e é o que faz alguém abrir três arquivos para achar uma função. Se a parte não tem nome próprio ("é só a continuação da lista"), o corte está no lugar errado: corte por tema (o que as funções têm em comum) ou por quem as usa. **Depois de dividir**, confira que todo nome usado de fora continua acessível — import, export, nome global: a divisão não muda a interface.

**Exceção:** arquivos cujo nome o framework ou a ferramenta impõe (`Dockerfile`, `package.json`, arquivo de rota, arquivo de página em roteamento por pasta) ficam como ele exige.

### 3.4 Tamanho dos arquivos

**Alvo: até 300 linhas.** Entre **300 e 500** o arquivo está na faixa de folga: divida na próxima vez que mexer nele, **se houver um corte natural** — nunca só para caber. **Acima de 500**, divida agora. Em qualquer caso o corte é por conceito, nunca por número: um arquivo de 520 linhas sem corte natural vira exceção registrada em `Exceções.md`, não um arquivo de 500 mais um de 20. O nome das partes segue a regra da seção 3.3.

### 3.5 Caminhos relativos, sempre

Nada de caminho absoluto no código. No SaaS isso é crítico por um motivo extra: **o caminho dentro do contêiner não é o caminho da sua máquina**, e um caminho absoluto que funciona no desenvolvimento quebra silenciosamente na publicação.

---

## 13. Segurança

O SaaS tem três problemas que um programa local não tem: **o navegador está na mão do usuário**, **a rota está aberta na internet**, e **o dado de vários clientes está no mesmo lugar**.

### 13.1 Segredo

1. ⚠ **O frontend não guarda segredo.** Tudo que chega ao navegador é público: código, configuração, chave. Se o navegador precisa de algo de fora, quem chama é o backend. **E variável com prefixo público é do navegador:** `NEXT_PUBLIC_` (Next.js), `VITE_` (Vite), `PUBLIC_` (SvelteKit) — o empacotador escreve o valor dentro do frontend montado, na hora de montar. Segredo nunca leva esse prefixo.
2. **Segredo mora no cofre da hospedagem**, injetado como variável de ambiente na publicação. Nunca em constante, nunca em arquivo versionado, nunca no frontend.
3. **Só o `backend/` lê o segredo** — o arquivo de `clients/` que usa a chave, e nenhum outro. Segredo lido em página ou componente está a um passo de ir para o navegador.
4. **Segredo não entra na imagem do contêiner.** `ARG` e `ENV` do `Dockerfile` ficam gravados na imagem; o que o Docker precisa durante a montagem (um token de registro privado) entra por montagem de segredo (`RUN --mount=type=secret`), e o que a aplicação precisa chega ao rodar, pelo cofre.
5. **Cada ambiente tem a sua chave.** Desenvolvimento, homologação e produção nunca dividem segredo: vazou a de desenvolvimento, a produção continua fechada.
6. **O `.env` mora em `Workshop/` e nunca é versionado.** No repositório vai apenas o `.env.example`, com os **nomes** das variáveis e nenhum valor. Chave que entrou no histórico do repositório está vazada mesmo depois de removida — precisa ser trocada, não apagada.

### 13.2 O dado dos clientes

7. ⚠ **Toda consulta ao banco filtra por dono.** É a regra da seção 11.1 da `referencia.md`, repetida aqui porque é a falha mais grave e mais comum desta plataforma. É **sem esse filtro** que o dado de um cliente vaza para outro.
8. ⚠ **Nada escrito no disco do contêiner — ou da função serverless — sobrevive à próxima publicação.** Trabalho de cliente salvo em disco é trabalho perdido: vai para o banco ou para o bucket.
9. ⚠ **Dado pessoal nunca em log.** O log vai para um painel externo, é lido por gente e fica guardado por muito tempo. E-mail, documento, endereço, conteúdo do cliente — nada disso pode aparecer ali.
10. **Banco que é fonte nunca se apaga sozinho** — seção 12 da `referencia.md`. E o backup só vale se já foi restaurado uma vez.

### 13.3 A porta de entrada

11. **Validação no servidor nunca é opcional.** A do navegador é conveniência; qualquer um chama a rota direto, sem passar pela sua tela.
12. **Toda rota declara quem pode chamá-la.** Autenticado não é o mesmo que autorizado: estar logado não dá direito de ler o dado dos outros nem de acessar a área administrativa.
13. **Ação de servidor é rota.** A função `'use server'` responde a POST direto, mesmo que nenhuma tela a chame: valida, autentica e autoriza dentro dela, e devolve só o que a tela precisa (2.6).
14. **Nada sensível em endereço.** O que vai na URL fica no histórico do navegador, no log do servidor e no cabeçalho de origem que o navegador manda para outros sites.
15. **Toda entrada é suspeita** — de formulário, de rota, de integração, de webhook. Valide na porta, em `server/`.
16. **Dependência de terceiro roda com o dado dos seus clientes.** Fixe as versões nas duas listas, para que reinstalar traga exatamente o que já foi testado.

---

## 14. Princípios globais

1. **Onde a plataforma manda, ela vence.** A AMF organiza o espaço livre que sobra.

2. **Organize por módulo, nunca por tipo de arquivo.** Tudo do módulo "billing" fica junto, dos dois lados. Uma pasta que junta "todos os modelos de e-mail" ou "todos os componentes" separa o arquivo do código que o usa.

3. **Onde uma coisa fica:** usada por **um** módulo → dentro dele; por **2+**, ou **editada em bloco** → sobe para o nível de `Code/`. Esta regra substitui qualquer lista fixa de pastas.

4. **`frontend/` é o navegador; `backend/` é o servidor.** Não crie `cliente/`, `servidor/` nem `compartilhado/` — ver 2.5.

5. **Entre os dois passa a rede:** demora, falha, repete e não compartilha memória.

6. **Rota publicada é contrato.** Versionada em `server/v1/`; quem já depende não pode quebrar.

7. **Toda consulta filtra por dono** — seção 13.2.

8. **Nada escrito em disco sobrevive à próxima publicação.** O que precisa durar vai para o banco, o bucket ou um serviço.

9. **Estrutura do banco só muda por migração** em `Program/migrations/`, nunca na mão.

10. **Nunca criar pastas vazias para manter simetria.** `jobs/` só no backend é normal.

11. **A pasta do esqueleto combinado nasce vazia de propósito; a IA não cria pasta por simetria.** As pastas que o Preparar projeto cria de uma vez — o esqueleto combinado para este tipo de projeto — existem antes do primeiro arquivo, e isso é intencional. O que continua proibido é a IA, no meio de uma tarefa, criar pasta que a tarefa não usa só porque a referência a descreve. A referência diz **onde** cada coisa vai quando existir.

12. **Nunca misturar código com dado de cliente.** Publicar uma versão nova substitui `Program/` inteiro, e não pode custar nada a ninguém.

13. **`Code/` guarda só código.** Mídia, variável de ambiente, configuração de ferramenta e pasta de dependências nunca entram em `Code/` — vão para `Assets/`, `Workshop/` ou `Dependencies/`.

14. **Configuração de ambiente é variável de ambiente**; configuração de conta é banco; padrão de fábrica é `constants/`.

15. **Princípio DRY** — função, constante ou tipo que aparece em 2+ lugares sobe para `utils/`, `constants/` ou `types/`. Nunca duplicar.

16. **Antes de criar pasta ou arquivo novo**, verificar se já existe local apropriado. A estrutura cresce por extensão, não por duplicação.

17. **Mover ou renomear pasta quebra caminho.** Import, leitura de arquivo, o que o `Dockerfile` copia, o que a configuração do empacotador lê — depois de mover, procure por referências ao caminho antigo e corrija, antes de dar por terminado.

18. **Nomeie a ferramenta antes de falar dela.** Diga **empacotador**, **gerenciador de pacotes**, **Docker** ou **hospedagem** — e, quando souber, o nome dela (Vite, npm, pip). Nunca uma perífrase solta como "a etapa de montagem", que não diz qual ferramenta é nem onde fica a configuração dela.

19. **Cada linha de árvore se explica sozinha.** Ao desenhar uma árvore de pastas — aqui, em `Convenções.md` ou em qualquer registro —, cada linha diz o que a pasta guarda. Um símbolo ou uma palavra solta nunca é a explicação inteira: quem lê tem só aquela linha na frente.

### 14.1 A pasta que ninguém previu

Quando uma ferramenta exigir uma pasta que esta referência não previu:

| Se ela é… | Vai para |
|---|---|
| da ferramenta ou do ambiente | `Workshop/` |
| parte do produto que você escreve | `Program/` |
| parte do pacote entregue | `Distribution/` |
| **em nenhuma hipótese** | **dentro de `Code/`** |

Os dois exemplos desta versão caem em lados opostos. A pasta de migrações que a ferramenta do banco cria (`migrations/` no Django, no Prisma e no Laravel) **roda contra o banco de produção a cada publicação** — no Fly.io, o `release_command` a aplica de dentro da imagem nova —, então é parte do produto: mora em `Program/migrations/`, com o nome que a ferramenta impõe. A de dados de teste nunca roda em produção: é do ambiente, e mora em `Workshop/seeds/`. E registre a decisão em `Convenções.md`, em cinco linhas, para não ser rediscutida na próxima vez.

---

## 15. Tabela de referência rápida

### Na raiz

| Item | Existe quando |
|---|---|
| `CLAUDE.md` | **Sempre** — as regras que a IA lê |
| `Program/` | **Sempre** |
| `Workshop/` | **Sempre** — é onde ficam o `.env.example`, o `Dockerfile` e os ambientes |
| `Distribution/` | Há interface no navegador montada por empacotador — ver 2.1, acima |
| `vercel.json` · `api/` | A hospedagem é a Vercel — ver 2.2, acima |
| arquivo para clicar | **Nunca** |

O resto do que pode ficar na raiz, e por quê, está na tabela 2.2.

### Em Program/

| Pasta | Existe quando |
|---|---|
| `Code/` | **Sempre** — com as duas entradas dentro — ver 4 |
| `Assets/` | Há ícone, imagem, fonte ou som que o frontend serve — ver 7 |
| `External/` | Você serve um modelo de IA próprio junto da aplicação — ver 9.3 |
| `Dependencies/` | **Sempre que o servidor usa biblioteca** — em Node, `node_modules/` — ver 9.4 |
| `migrations/` | **Sempre que há banco** — minúsculo porque é o nome que a ferramenta do banco impõe, o mesmo precedente do `node_modules/` — ver 12.2 |
| `Internal/` | **Não existe como pasta** — vira serviço — ver 10 |

### Em Code/

| Pasta | Existe quando |
|---|---|
| a entrada do servidor | **Sempre** |
| a entrada do cliente | Há interface no navegador |
| `frontend/` | Há interface no navegador |
| `backend/` | **Sempre** — SaaS tem lógica no servidor |
| `server/` | **Sempre** — é por onde chamam você |
| `server/v1/` | **Sempre** — rota publicada é contrato versionado |
| `clients/` | O backend chama serviço externo |
| `utils/` | Há função utilitária usada em 2+ lugares |
| `constants/` | Há valor fixo em 2+ arquivos, ou padrão de fábrica |
| `types/` | **Sempre** — é o contrato entre navegador e servidor |
| `locales/` | A aplicação tem 2+ idiomas |
| `prompts/` | A aplicação conversa com modelo de linguagem — ver 6.9 |

### Módulos (dentro de frontend/ e backend/)

| Módulo | Existe quando |
|---|---|
| `auth/` | **Sempre** — SaaS tem conta |
| `billing/` | A aplicação cobra |
| `admin/` | Há área administrativa |
| `jobs/` | Há trabalho agendado — só no backend |
| outros | Um por funcionalidade real do produto |

### Em Workshop/

| Item | Existe quando |
|---|---|
| `.env.example` · `.env` | **Sempre** — o `.env` de verdade nunca se versiona — ver 8.1 |
| `Dockerfile` | A hospedagem publica contêiner (Fly.io, Render, Railway) — ver 8.2 |
| `deploy/` | **Sempre** — os ambientes e como publicar; a configuração da Vercel fica na raiz — ver 8.2 |
| `seeds/` | Há dado de teste — nunca roda em produção — ver 8.4 |
| configuração do empacotador | Há interface no navegador |
| as listas de dependências | Há gerenciador de pacotes — a do servidor em Node fica em `Program/` |
| `node_modules/` do navegador | Há biblioteca que o empacotador leva para o frontend — ver 9.4 |
| `tests/` | Há teste escrito — incluindo o de isolamento entre contas |
| `scripts/` | Há automação de publicação ou de manutenção |

### No lugar de Internal/ e de Files/

| Item | Existe quando |
|---|---|
| painel de observabilidade | **Sempre** em produção |
| serviço de cache | Há resultado que vale guardar entre chamadas |
| serviço de fila | Há trabalho assíncrono ou agendado |
| tabelas de estado e de configuração de conta | **Sempre** |
| variáveis de ambiente | **Sempre** |
| cofre de segredos | **Sempre** |
| banco | **Sempre** — isolado por conta — ver 11 |
| bucket | A aplicação guarda arquivo do usuário — isolado por conta |

---

## 16. Pares que se confundem

| | |
|---|---|
| **SaaS × Página web** | Tem conta, servidor ou segredo × nenhum dos três |
| **`Program/Code/` × `Workshop/`** | Roda quando a aplicação roda × só você executa — e `jobs/` é `Code/` |
| **`Code/` × `Assets/`** | O que se escreve × o que se vê ou ouve |
| **`Workshop/` × `Distribution/`** | Onde ficam o empacotador, o `Dockerfile` e a configuração deles × onde fica o frontend montado |
| **`Program/Dependencies/` × `node_modules/` do navegador** | O servidor procura ao rodar × o empacotador já levou para o frontend montado, e mora em `Workshop/` |
| **`External/` × `Dependencies/`** | Você colou à mão × o gerenciador de pacotes instalou |
| **`Program/migrations/` × `Workshop/seeds/`** | Roda contra o banco de produção a cada publicação × nunca roda em produção |
| **`'use server'` × `server-only`** | A função vira rota, que qualquer um chama por POST × o módulo só pode ser importado no servidor, e o empacotador barra o navegador |
| **componente de servidor × componente do navegador renderizado no servidor** | Pode ler segredo e banco × roda no servidor só na primeira vez, e tudo o que recebe chega ao navegador |
| **`frontend/` × `backend/`** | Roda no navegador do usuário × roda no seu servidor |
| **`server/` × `clients/`** | O outro inicia a conversa × você inicia |
| **`server/` × `backend/`** | A porta de entrada, sem lógica × a lógica, que a porta chama |
| **`types/` interno × contrato** | Formato que só existe dentro × formato que atravessa a rede |
| **`.env.example` × `.env`** | Os nomes das variáveis, versionado × os valores, nunca versionado |
| **`constants/` × variável de ambiente** | Padrão de fábrica, igual em todo lugar × muda entre ambientes |
| **variável de ambiente × configuração de conta** | Do ambiente, no cofre × do usuário, no banco |
| **`Assets/` × bucket** | Recurso do programa, vai para o frontend montado × arquivo do usuário |
| **cache × disco efêmero** | Serviço compartilhado entre as cópias × some na publicação e é só daquela cópia |
| **fila × estado no banco** | O que roda em seguida × onde cada item está |
| **`Workshop/seeds/` × dado real** | Só desenvolvimento e homologação × produção, e não se semeia |
| **autenticado × autorizado** | Sei quem você é × você pode fazer isso |
| **Banco índice × banco fonte** | A aplicação pode refazer × a aplicação nunca pode apagar |

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

Quando o usuário disser algo como "neste projeto o `prompts/` fica dentro de cada módulo" ou "o módulo X é uma exceção porque…": (1) leia os dois arquivos; (2) decida se é convenção (vale para o projeto inteiro) ou exceção (um caso); (3) veja se já existe algo parecido — refine em vez de duplicar; (4) grave no formato de cinco linhas e mostre o resultado.

### Depois de criar, mover ou dividir

Se a tarefa produziu um desvio novo, registre-o — só o que é **relevante para continuar o desenvolvimento**, nunca o relato do que foi feito.

### O que entra, em que tamanho, e quando cresce

**Filtro:** entra só o que muda uma decisão futura de lugar ou de nome de pasta. Não entra: nota de implementação, trecho de código, o que um comando deve devolver, a história da decisão (mora na discussão, citada). **Teto:** cinco linhas por registro — título · regra ou exceção · onde vale · por quê em uma linha · origem. **Transbordo:** `Convenções.md` ou `Exceções.md` acima de **~20 KB** vira pasta com `Índice - Convenções.md` (ou `- Exceções.md`) mais um arquivo por tema — por pasta do projeto: `Files.md`, `Internal.md`, `Code.md`, … — e a consulta passa a ler o índice e abrir só o tema da tarefa. Ao encontrar um arquivo acima do limite, proponha ao usuário reparti-lo — e não faça sem ele.
