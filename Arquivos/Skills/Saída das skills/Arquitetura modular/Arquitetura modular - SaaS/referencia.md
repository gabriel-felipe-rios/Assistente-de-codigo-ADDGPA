# AMF — Referência completa · Arquitetura modular - SaaS

Apoio da skill Arquitetura modular. Abra a seção que a tabela rápida do arquivo principal indicar ("ver N.N"), ou a seção da pasta cuja dúvida é o porquê. Cada seção é autossuficiente.

> Auditada em 22/09/2026 contra: documentação oficial do Docker (contexto de build, `.dockerignore` por Dockerfile, segredos de build, Compose), Vercel (vercel.json, Root Directory, `--local-config`, funções), Netlify (netlify.toml, base e package directory), Fly.io (fly.toml, `--config`, `release_command`), Render (Blueprint Path, Dockerfile Path), Railway (config as code, `RAILWAY_DOCKERFILE_PATH`), Next.js 16 (estrutura, `src/`, variáveis de ambiente, segurança de dados, CLI `[directory]`, `distDir`), Vite (variáveis), SvelteKit e Nuxt (configuração), Cloudflare Workers (`node:fs`), e as ferramentas de migração: Django (`MIGRATION_MODULES`), Alembic, Prisma (`migrations.path`, `migrate deploy`), Rails (`migrations_paths`), Laravel 12, Drizzle Kit (`out`), Supabase CLI (`--workdir`).

---

## 4. Os dois arquivos de entrada

**Não há arquivo para clicar.** Quem sobe o servidor é a hospedagem; quem abre a interface é o navegador. No lugar do arquivo de entrada existem **dois**, eles não se parecem, e os dois moram em `Program/Code/`:

| | **Entrada do servidor** | **Entrada do cliente** |
|---|---|---|
| **O que é** | O processo que sobe e fica escutando | O arquivo que o navegador carrega (o `index.html` e o código que ele chama) |
| **Quem executa** | A hospedagem, pelo comando do contêiner | O navegador do usuário |
| **O que faz** | Registra as rotas de `server/` e liga | Monta a interface de `frontend/` |
| **Quantos** | Um só | Um só |

### 4.1 Um arquivo só, em cada lado

**A regra de "um arquivo só" continua valendo dentro de cada lado.** Nada de `-dev`, `-prod`, `-debug`. Ambiente é **variável de ambiente**, nunca um segundo arquivo de entrada. É essa diferença que faz o mesmo código rodar em desenvolvimento, homologação e produção sem nenhuma linha condicional espalhada.

### 4.2 O que não fica junto delas

As duas entradas são código, e moram em `Code/`. O que antes costumava ficar na raiz ao lado delas é ambiente e ferramenta, e mora em `Workshop/` (seção 8):

- **o `.env.example` e o `.env`** — a lista das variáveis de ambiente e os valores do seu ambiente;
- **o `Dockerfile`** — a receita que o Docker lê para empacotar a aplicação num contêiner;
- **a configuração de publicação** — o que a hospedagem lê para publicar, em `Workshop/deploy/`. A única hospedagem comum que a exige na raiz é a Vercel (seção 8.2).

**Com framework full-stack ou função serverless, as duas entradas mudam de forma.** O framework (Next.js, Nuxt, SvelteKit) gera a entrada do servidor e a do cliente a partir da pasta de rotas dele; e na função serverless não há processo que sobe e fica escutando — cada rota vira uma função que a hospedagem liga a cada chamada (seção 6.11). A regra de 4.1 continua: um só código, e o ambiente vem de variável.

### 4.3 `Distribution/` — o frontend montado

O empacotador do frontend (Vite, webpack) lê a entrada do cliente, junta o código que roda no navegador e os recursos de `Assets/`, renomeia cada arquivo com um hash e escreve o resultado em `Distribution/`, uma pasta de nível 1, irmã de `Program/`.

| O que | Onde vai |
|---|---|
| o frontend montado | `Distribution/` |
| o servidor compilado, quando a linguagem se compila (TypeScript, Go) | `Distribution/`, numa subpasta própria |
| a imagem do contêiner | o registro do Docker, de onde a hospedagem a puxa — **não** é pasta do projeto |

**Regras:**
- `Distribution/` é **resultado**: o empacotador refaz idêntico. Nunca se edita à mão e nunca se versiona.
- O `Dockerfile` copia `Program/` e `Distribution/` para dentro do contêiner. Nada de `Workshop/` entra: nem o `.env`, nem os testes, nem a pasta de dependências do navegador.

---

## 5. Program/

**O que é:** tudo que pertence à aplicação — o que vai para o servidor, dentro do contêiner ou nas funções da hospedagem. Quando você publica uma versão nova, é isso que é substituído — inteiro, de uma vez.

**O que mora nele:** `Code/`, `Assets/`, `Dependencies/` (as bibliotecas do servidor), `migrations/` (as migrações do banco — seção 12.2) e, só quando você serve um modelo próprio, `External/`. Em Node, a lista de dependências do servidor (`package.json`) também mora direto em `Program/`, ao lado do `node_modules/` — seção 9.4. `Internal/` **não existe como pasta** — seção 10.

**Regras:**
- Todos os nomes aqui dentro são em inglês
- **Nada do usuário entra aqui.** No SaaS isso vale em dobro: dado de cliente vive no banco e no bucket, nunca no repositório e nunca no disco do contêiner
- Sempre existe, junto com `Code/`

---

## 6. Program/Code/

**O que é:** o código que **você** escreveu e que **roda quando a aplicação roda** — no navegador e no servidor. É o coração do projeto.

### 6.1 A regra que decide onde uma coisa fica

Esta é a regra mais importante do documento, porque ela substitui uma lista fixa de pastas:

> **Usado por UM módulo** → fica **dentro** desse módulo.
> **Usado por DOIS OU MAIS** módulos → sobe para o nível de `Code/`.
> **Editado em bloco**, independente do código → sobe também.

O princípio por trás: **organize por módulo/funcionalidade, nunca por tipo de arquivo**. Uma pasta que junta "todos os modelos de e-mail" ou "todos os componentes" agrupa por tipo — e separa o arquivo do código que o usa.

**Exemplo correto:**
```
Code/backend/billing/
├── billing-cobranca.ts
└── templates/
    └── fatura.html        ← o modelo fica junto do código que preenche ele
```

Isso vale para **qualquer** conteúdo que o programa lê para decidir como agir: modelo de e-mail, tema visual, preset, esquema de validação, regra de plano. Nenhum deles é pasta fixa da AMF — eles nascem dentro do módulo que os usa.

### 6.2 frontend/ — o que roda no navegador

**O que é:** toda a interface visual — telas, componentes, formulários, tabelas, gráficos. **Roda na máquina da pessoa**, dentro do navegador.

**Organizado por módulo**, um por funcionalidade: `auth/`, `billing/`, `admin/`, `relatorios/`. Dentro de cada um fica tudo daquele módulo: componente, estilo, estado de tela.

**Evitar:** `components/`, `hooks/`, `pages/` todos no mesmo nível — isso é agrupamento por tipo.

```
frontend/
├── auth/
│   ├── auth-login.tsx
│   ├── auth-cadastro.tsx
│   └── auth-estilo.css
├── billing/
└── admin/
```

**A regra que define esta pasta:** tudo aqui **está na mão do usuário**. Ele pode ler o código, mudar o valor de qualquer campo e chamar qualquer rota na mão. Portanto:

> **Validação no navegador é conveniência. Validação no servidor é segurança.** As duas existem, e a do servidor nunca é opcional. Esconder um botão não protege a rota que ele chamava.

### 6.3 backend/ — o que roda no servidor

**O que é:** toda a lógica de processamento que roda **no servidor** — regras de negócio, cálculos, acesso ao banco, orquestração.

**Organizado pelos mesmos módulos do frontend**: `auth/`, `billing/`, `admin/`. Mais os módulos que só existem aqui — tipicamente `jobs/`, o trabalho que roda sozinho no tempo (cobrança recorrente, envio de resumo, limpeza).

**Regra:** só crie a pasta de um módulo aqui se ela tiver lógica real. Nunca crie espelho vazio do frontend, e nunca "conserte" a assimetria de `jobs/`.

**A fronteira que muda tudo:** entre `frontend/` e `backend/` **passa a rede**. Uma chamada de um para o outro:
- **demora** — e a interface precisa mostrar isso;
- **pode falhar** — por conexão, por tempo esgotado, por o servidor estar reiniciando numa publicação;
- **pode chegar duas vezes** — o usuário clicou de novo, o navegador repetiu. Operação que cobra, cria ou envia precisa ser segura contra repetição;
- **não compartilha memória.** Nada que o navegador guardou está disponível aqui, e vice-versa.

Nenhuma dessas quatro coisas existe quando `frontend/` e `backend/` rodam no mesmo processo, como num programa local. É por isso que a mesma árvore se comporta de outro jeito aqui.

### 6.4 server/ — a porta de entrada

**O que é:** o código que **fica esperando ligarem para você** — as rotas que a aplicação publica.

**Num programa local, `server/` é situacional e raro. Aqui ele é o coração**: é por ele que o navegador fala com o servidor, e é ele que qualquer integração externa enxerga.

**A estrutura:**

```
server/
└── v1/
    ├── auth.ts
    ├── billing.ts
    └── admin.ts
```

**Por que versionado (`v1/`):** porque **rota publicada é contrato**. Assim que alguém — o seu próprio navegador de ontem, um cliente que integrou, um aplicativo mobile seu — passa a depender de uma rota, mudá-la quebra quem já depende. A versão dá um lugar para a mudança incompatível morar sem quebrar o que existe.

**As quatro regras de `server/`:**

1. **Um arquivo por módulo**, com o mesmo nome do módulo em `backend/`.
2. **A rota não tem lógica.** Ela recebe, valida a entrada, chama o módulo de `backend/` e devolve. Se há regra de negócio escrita dentro da rota, ela está no lugar errado.
3. **Toda rota diz quem pode chamá-la.** Autenticação (quem é você) e autorização (você pode isso?) são explícitas por rota, nunca presumidas.
4. **Toda entrada é validada aqui**, na porta. Quem chama pode ser qualquer um.

### 6.5 clients/

**O que é:** o código que **liga para fora**. A aplicação precisa de algo, chama um serviço externo e espera a resposta. **Quem inicia a conversa é você.**

**Exemplos:** processador de pagamento, envio de e-mail, modelo de linguagem, serviço de arquivos, autenticação de terceiro.

**Regra:** um arquivo por serviço externo — `pagamento.ts`, `email.ts`, `llm.ts`.

**A regra que só existe no SaaS: quem usa `clients/` é o backend, nunca o frontend.** O motivo é a chave: serviço externo exige credencial, e credencial no navegador é credencial pública (seção 13 do arquivo principal). Se o navegador precisa de algo de fora, ele chama uma rota sua em `server/`, e é o `backend/` que chama o serviço externo.

**A pergunta que separa de `server/`:** *quem inicia a conversa?* Se é o seu código → `clients/`. Se é outro → `server/`.

### 6.6 types/ — o contrato

**O que é:** a forma dos dados que a aplicação usa — o que é um Cliente, uma Assinatura, um Relatório.

**No SaaS ele ganha um segundo papel, e é o mais importante:** `types/` é **o contrato entre o navegador e o servidor**. É a única coisa que os dois lados leem igual — o que a rota espera receber e o que ela promete devolver.

**As regras:**
1. **Um arquivo por entidade principal.** Tipo usado por um módulo só fica dentro dele.
2. **O que atravessa a rede vive aqui**, sempre. Se o formato só existe do lado de dentro, ele não é contrato — fica no módulo.
3. **Mudar um tipo que atravessa a rede é mudar contrato.** Vale a mesma regra de `server/`: quem já depende não pode quebrar.

### 6.7 utils/ e constants/

- **`utils/`** — funções pequenas e reutilizáveis, sem dependência de módulo: formatações, conversões, validações genéricas. Se uma função aparece em 2 lugares, ela vem para cá.
  **Um utilitário pode rodar nos dois lados.** Se ele depende de algo que só existe no servidor (arquivo, variável de ambiente, banco), ele não é utilitário genérico — pertence a `backend/`.
- **`constants/`** — valores fixos que aparecem em vários lugares, **e os padrões de fábrica**: plano inicial, limites, tempo de expiração.
  **Constante não é configuração de ambiente.** O que muda entre desenvolvimento e produção (endereço do banco, chave, domínio) é **variável de ambiente**, nunca constante — ver seção 10.

### 6.8 locales/

**O que é:** os textos da interface separados em um arquivo por idioma.

**Regra:** só crie se a aplicação **for** ter mais de um idioma.

**No SaaS, o idioma é preferência de conta**, não do aparelho — a pessoa espera achar a mesma língua ao entrar de outro computador. Isso o coloca no banco, junto do resto da conta (seção 10).

### 6.9 prompts/

**O que é:** os prompts que a aplicação manda para um modelo de linguagem, e os esquemas de saída estruturada de cada um.

**Por que fica no topo de `Code/` e não dentro de cada módulo:** porque prompt tem **modo de trabalho próprio**. Você senta para "mexer nos prompts" — revisa vários, compara o tom, ajusta o conjunto. É a única exceção deliberada à regra 6.1.

**Regras:**

1. **Uma subpasta por módulo** que conversa com IA. Nunca uma lista solta.
2. **O nome da subpasta é o nome real do módulo.**
3. **O prompt é sempre `.txt`.**
4. **O esquema é sempre `.json`, com nome idêntico ao do prompt.**
5. **Prompt sem saída estruturada simplesmente não tem `.json`.** Ausência não é pendência.

```
prompts/
├── relatorios/
│   ├── resumo.txt
│   └── resumo.json
└── suporte/
    └── sistema.txt
```

**O prompt roda no backend.** Ele é chamado por `clients/`, com a chave que só o servidor tem. Mandar o prompt para o navegador entrega a chave junto.

### 6.10 As listas de dependências — não ficam em `Code/`

O arquivo que **lista** as dependências é configuração do gerenciador de pacotes, e **nunca fica em `Code/`**. No SaaS existem duas listas, uma para cada lado, e cada uma mora junto da pasta que ela gera (seção 9.4):

| Lista | Mora em |
|---|---|
| a do **navegador** (`package.json`) | `Workshop/`, ao lado do `node_modules/` do navegador |
| a do **servidor**, em Python, PHP, Ruby (`requirements.txt`, `composer.json`, `Gemfile`) | `Workshop/` |
| a do **servidor**, em Node (`package.json`) | `Program/`, ao lado do `node_modules/` do servidor — o npm instala ao lado dela |

**As duas travam a versão de cada dependência.** É a lista, e só ela, que reproduz o ambiente quando o Docker monta a imagem — sem a versão travada, duas publicações do mesmo código instalam coisas diferentes.

### 6.11 Quando o framework roda os dois lados

`frontend/` = navegador e `backend/` = servidor foi escrito para a aplicação em que cada lado é um programa. Hoje há três formas em que a fronteira deixa de coincidir com a pasta — e a regra continua valendo em todas, com os cuidados abaixo.

**1. Renderização no servidor (SSR) e componentes de servidor** — Next.js, Nuxt, SvelteKit. A mesma tela roda primeiro no servidor e depois no navegador; o que separa os lados é a diretiva no arquivo (`'use client'`, `'use server'`), não a pasta.

| Peça | Roda onde | O que pode tocar |
|---|---|---|
| componente de servidor | só no servidor | segredo, banco, `backend/` |
| componente do navegador | no servidor na primeira vez, depois no navegador | **só o que o navegador pode ver** — segue as regras do navegador mesmo quando roda no servidor |
| ação de servidor (`'use server'`) | no servidor, chamada por POST | o que uma rota de `server/` pode — e com as mesmas quatro regras (6.4) |

- **O que toca segredo, banco ou `clients/` fica em `backend/`, com `import 'server-only'` no topo** (Next.js): se um arquivo do navegador o importar, o empacotador para com erro. A página só chama o `backend/`, que devolve só os campos que a tela usa.
- **A ação de servidor responde a POST direto**, mesmo que nenhuma tela a chame, e a checagem de login da página **não** a protege: ela valida, autentica e autoriza dentro de si, e devolve só o que a tela precisa. Tratá-la como rota de `server/` resolve as três coisas.
- **As pastas que o framework impõe vencem.** Onde ele deixa apontar, aponte para a AMF: o Nuxt tem `srcDir`, `serverDir` e `dir.public`; o SvelteKit tem `kit.files` (as rotas, a pasta pública) e `env.dir`. O Next.js não deixa: `app/` fica na raiz do projeto dele ou em `src/`, e `public/`, `next.config.*`, `package.json` e os `.env` ficam na raiz do projeto dele. O desenho que a AMF adota nesse caso está em 6.12.

**2. Função serverless** — Vercel, Netlify. Não existe processo que sobe e fica escutando: cada rota vira uma função que a hospedagem liga a cada chamada.

- **Disco:** só leitura, com um `/tmp` provisório (na Vercel, até 500 MB). Nada que precise durar vai para lá — seção 10.
- **Memória:** não passa de uma chamada para a outra. Sessão, contador, fila em memória — tudo vira serviço (seção 10).
- **Tempo:** cada chamada tem duração máxima. Trabalho longo de `backend/jobs/` é disparado pelo agendador da hospedagem (na Vercel, o Cron Jobs chama uma função) ou vai para uma fila.
- **Sem framework, na Vercel, as funções moram em `api/`, na raiz do projeto** — é **exceção de plataforma**: código fora de `Code/`, porque a Vercel manda. Entra na tabela de raiz e em `Exceções.md`, e cada arquivo de `api/` segue as regras de `server/` (6.4): recebe, valida, chama o `backend/` e devolve.

**3. Edge** — Vercel Edge, Cloudflare Workers. Roda em isolado de V8, perto do usuário, sem o Node inteiro: biblioteca que depende de módulo do Node pode não funcionar, e o disco, quando existe, é virtual e fica na memória. Código de `backend/` que vai para o edge precisa caber nessas regras; o resto fica na função comum.

**Nas três, as variáveis de ambiente se dividem em duas** — e o prefixo é o que decide:

| Ferramenta | Vai para o navegador | Fica no servidor |
|---|---|---|
| Next.js | `NEXT_PUBLIC_…` — escrita dentro do frontend montado em `next build`, e congelada ali | o resto |
| Vite | `VITE_…` | o resto |
| SvelteKit | `PUBLIC_…` | o resto |

Segredo nunca leva o prefixo público (seção 13 do arquivo principal).

### 6.12 Exceção de plataforma — o projeto Next.js

**O que o framework exige:** `app/` (ou `src/app/`), `public/`, `next.config.*`, `package.json`, `tsconfig.json` e os `.env*` na raiz do projeto **dele**; a pasta que ele monta (`.next/`, ou o `distDir`) não pode sair dessa raiz. Ele não exige que essa raiz seja a do repositório: `next dev`, `next build` e `next start` recebem a pasta como argumento.

**A árvore desse caso** — a raiz do projeto Next.js é `Program/`:

```
[Nome do projeto]/
├── Program/                       A RAIZ DO PROJETO NEXT.JS · next build Program
│   ├── app/                       faz o papel de Code/ · o nome é do Next.js
│   │   ├── layout.tsx  page.tsx   as telas: page.tsx na pasta da URL (o papel de frontend/)
│   │   ├── api/v1/…/route.ts      as rotas publicadas (o papel de server/v1/) · sem lógica
│   │   └── backend/ clients/      o resto de Code/, com os mesmos nomes · não vira rota,
│   │       types/ utils/ …        porque só arquivo page ou route vira — nunca use esses nomes aqui
│   ├── public/                    faz o papel de Assets/ · servido pelo nome, sem hash
│   ├── next.config.ts             a configuração do Next.js · só é lida aqui
│   ├── tsconfig.json              a do TypeScript · o Next.js a procura aqui
│   ├── package.json               uma lista só, para os dois lados · o servidor do Next.js
│   ├── node_modules/              procura as bibliotecas ao rodar — é a regra de Node (9.4)
│   ├── .next/                     o que o Next.js monta · faz o papel de Distribution/ e
│   │                              não pode sair daqui · nunca se versiona
│   └── migrations/                como sempre (12.2)
├── Workshop/
│   ├── .env.example  .env         continuam aqui · o script os carrega no processo antes
│   │                              de chamar o Next.js
│   └── Dockerfile  deploy/  tests/  scripts/   como sempre
└── Distribution/                  não existe neste caso: o resultado é Program/.next/
```

**Por quê:** é a única forma que obedece o framework sem abrir mão de `Program/` inteiro, copiável e com só o que é da aplicação.

- **O `.env` não entra em `Program/`.** O Next.js procura primeiro no ambiente do processo e só depois nos arquivos, então basta o script carregá-lo antes — `node --env-file=Workshop/.env Program/node_modules/next/dist/bin/next dev Program`. Um `.env` em `Program/` iria junto em toda cópia da pasta e para dentro do contêiner.
- **Na Vercel**, o Root Directory do projeto aponta `Program`; o `vercel.json`, quando existe, fica em `Program/`, ao lado do `next.config.ts`, e não há `api/` na raiz — as rotas são `app/api/…/route.ts`.
- `proxy.ts` e `instrumentation.ts`, quando existem, ficam em `Program/`, ao lado de `app/` — também é o Next.js que manda.

Registre em `Exceções.md` do projeto.

---

## 7. Program/Assets/

**O que é:** o que a interface **mostra ou toca** e que você fez ou escolheu — imagem (inclusive SVG e ícone), fonte, áudio, vídeo. É substituído a cada publicação, como `Code/`.

**O critério é a FUNÇÃO do arquivo, não a extensão.** `Code/` guarda o que se **escreve** como parte do programa: código em qualquer linguagem, HTML, CSS, prompt (mesmo em `.txt` — um `.txt` que é prompt é estrutura do programa e fica em `Code/prompts/`), JSON, esquema, texto traduzido. `Assets/` guarda o que se **vê ou ouve**. Teste: *"a forma normal de mexer nisso é editar linha a linha num editor de código?"* Sim → `Code/`. Não (foi feito noutro programa, ou se olha/escuta) → `Assets/`. Um ícone SVG é texto, mas se mexe num editor de desenho: `Assets/`.

**Subpastas:** `icons/`, `images/`, `fonts/`, `audio/`, `video/`. Quando o recurso é de **um módulo só**, subpasta com o nome do módulo dentro do tipo: `Assets/images/chat/`. Modelo de IA baixado **não** é asset: fica em `External/ai-models/`.

**Regra:** nada binário ou de mídia em `Code/`; nada que se escreve em `Assets/`.

**Nesta plataforma:**

- **`Assets/` é a pasta pública do empacotador do frontend** (a que ele chama de `public/`) — a configuração do empacotador aponta para ela.
- **O empacotador renomeia.** Ao montar o frontend, ele copia cada recurso para `Distribution/`, renomeado com um hash. Recurso se importa no código, nunca por caminho escrito à mão.
- **Mídia enviada por usuário não é asset:** foto de perfil, anexo, documento enviado — isso é do usuário, vai para o bucket (seção 11), nunca aqui.

---

## 8. Workshop/

**O que é:** o que existe **para você desenvolver e operar**, e que a aplicação nunca executa em resposta a um usuário. É uma pasta de nível 1, irmã de `Program/` — não fica dentro dele.

> **Tudo que existe só no desenvolvimento e na operação mora aqui, e nada daqui entra no contêiner.**

Apagar `Workshop/` não derruba a aplicação no ar. Você é que deixa de conseguir empacotá-la e publicá-la.

**As migrações do banco não vêm para cá.** Elas rodam contra o banco de produção a cada publicação — são do programa, e moram em `Program/migrations/` (seção 12.2).

**A pergunta que separa de `Program/Code/`:** *isso roda quando a aplicação roda?* Se sim → `Program/Code/`. Se só você executa → `Workshop/`.

**`jobs/` não vem para cá.** Trabalho agendado roda sozinho, em produção, sem você — é `Program/Code/backend/jobs/`.

| O que mora aqui | Exemplo |
|---|---|
| `.env.example` · `.env` | as variáveis de ambiente — 8.1 |
| `Dockerfile` e `deploy/` | como a aplicação vira contêiner e como se publica — 8.2 |
| `tests/` | os testes automáticos — 8.3 |
| `seeds/` | os dados de teste — 8.4 |
| `scripts/` | publicar, backup, tarefas de operação — 8.5 |
| a configuração do empacotador | a do frontend (Vite, webpack): aponta para `Program/Code/` e escreve em `Distribution/` |
| as listas de dependências | a do navegador e, fora do Node, a do servidor — seção 6.10 |
| `node_modules/` do navegador | a pasta de dependências do frontend — seção 9.4 |

### 8.1 .env e .env.example

**Os dois são ambiente, não produto** — e por isso moram aqui, e não na raiz nem em `Program/`.

| | `.env.example` | `.env` |
|---|---|---|
| **O que guarda** | os **nomes** das variáveis que a aplicação espera | os **valores** do seu ambiente de desenvolvimento |
| **Versiona?** | sim | ⚠ **nunca** |

⚠ **O `.env` de verdade nunca é versionado.** Chave que entrou no histórico do repositório está vazada mesmo depois de removida — precisa ser trocada, não apagada. Em produção não existe `.env`: os valores moram no cofre de segredos da hospedagem e chegam como variável de ambiente (seção 10).

**Quem lê o `.env` precisa ser apontado para `Workshop/`.** O Vite tem `envDir`, o SvelteKit tem `env.dir`. O Next.js só lê os `.env` na raiz do projeto dele — mas olha o ambiente do processo antes do arquivo, então o `.env` continua em `Workshop/` e o script o carrega antes de chamar o Next.js (seção 6.12).

### 8.2 Dockerfile e deploy/

**O `Dockerfile`** é a receita que o Docker lê para empacotar a aplicação: a imagem base, as ferramentas de sistema, a instalação das bibliotecas do servidor em `Program/Dependencies/`, a cópia de `Program/` e de `Distribution/`, e o comando que sobe a entrada do servidor. Só existe quando a hospedagem publica contêiner.

O Docker aceita o `Dockerfile` em qualquer caminho: o script de publicação roda, da raiz do projeto, `docker build -f Workshop/Dockerfile .` — o contexto é a raiz, para o `Dockerfile` enxergar `Program/` e `Distribution/`. **O `.dockerignore` fica ao lado do `Dockerfile`, com o nome dele na frente:** `Workshop/Dockerfile.dockerignore`. O Docker o procura ali antes do `.dockerignore` da raiz, e ele vence se os dois existirem. É ele que impede o contexto de levar `Workshop/.env` para dentro do build.

**`deploy/`** é a configuração dos ambientes — desenvolvimento, homologação, produção: para onde publica, com que recursos, com quais variáveis, e a configuração que a hospedagem lê.

**Onde cada hospedagem aceita a configuração dela** (conferido na documentação de cada uma em 22/09/2026):

| Hospedagem | Arquivo | Aceita fora da raiz? | Como apontar |
|---|---|---|---|
| Docker Compose | `compose.yaml` | sim | `docker compose -f Workshop/deploy/compose.yaml`; o `context:` se resolve a partir da pasta do arquivo, então é `../..` |
| Fly.io | `fly.toml` | sim | `fly deploy --config Workshop/deploy/fly.toml --dockerfile Workshop/Dockerfile`, rodado da raiz; o contexto do Docker continua na raiz do projeto |
| Render | `render.yaml` | sim | o campo **Blueprint Path**; o **Dockerfile Path** aponta `Workshop/Dockerfile` |
| Railway | `railway.json` / `railway.toml` | sim | o caminho do arquivo de configuração nas opções do serviço; a variável `RAILWAY_DOCKERFILE_PATH` aponta o `Dockerfile` |
| Netlify | `netlify.toml` | sim | o **package directory** no painel aponta `Workshop/deploy/` — a Netlify procura ali, depois na base, depois na raiz; diga o diretório de publicação por extenso |
| Vercel | `vercel.json` (ou `.toml`, `.ts`) | **não**, na publicação pelo Git | ela lê o arquivo na pasta-raiz do projeto, e a aplicação não enxerga nada fora dessa pasta — então ele fica na raiz. O `--local-config` da linha de comando só vale para a publicação feita por ela |

**Regras:**
- **Aqui ficam os nomes das variáveis, nunca os valores.** Os valores moram no cofre de segredos (seção 10).
- Descreva os ambientes existentes e o que muda entre eles; como se publica; e **como se volta atrás** — a pergunta que ninguém faz antes de precisar.
- **A hospedagem que só aceita a configuração na raiz** — hoje, entre as comuns, só a Vercel — fica na raiz, e isso vira registro em `Exceções.md`.

### 8.3 tests/

**Regra: espelha o caminho de `Program/Code/`, não o conteúdo.** Só existe pasta onde existe teste.

```
Program/Code/backend/billing/cobranca.ts   →   Workshop/tests/backend/billing/cobranca_test.ts
```

**O que o SaaS acrescenta — três alturas de teste:**

| | O que testa | Velocidade |
|---|---|---|
| **Unidade** | Lógica pura de `backend/` e `utils/` | Rápido |
| **Rota** | `server/` respondendo: entrada, permissão, saída | Médio |
| **Ponta a ponta** | O navegador de verdade clicando na interface | Lento |

**O teste que esta versão exige: o teste de isolamento entre contas.** Um teste que entra como cliente A e tenta ler o dado do cliente B — e espera receber "não encontrado". É o teste mais importante do projeto (seção 11.1).

### 8.4 seeds/

**O que é:** dados de teste — as contas, planos e registros que fazem a aplicação ter algo dentro em desenvolvimento e homologação.

⚠ **Seed nunca roda em produção.** É a pasta mais fácil de rodar no lugar errado, e o estrago no dado dos clientes é irreversível. É isso que a separa das migrações, que rodam em produção a cada publicação e por isso moram em `Program/migrations/` (seção 12.2).

### 8.5 scripts/

**O que é:** automações de desenvolvimento e operação — chamar o empacotador e o Docker, publicar, backup, importação, correção pontual de dado.

**Regra:** nomear pelo que fazem — `backup.sh`, `importar-planilha.sh` — nunca apenas `run.sh`.

⚠ **Script que toca o banco de produção é o mais perigoso do projeto.** Ele roda fora do fluxo normal, sem interface e sem confirmação. Todo script assim precisa de um modo "só mostrar o que faria" antes do modo que faz.

---

## 9. Program/External/ e Program/Dependencies/

As duas guardam o que **outro** escreveu e você não edita. O que as separa é **quem pôs lá**.

### 9.1 A diferença, numa tabela

| | `External/` | `Dependencies/` |
|---|---|---|
| **quem põe lá** | **você**, à mão | um comando do gerenciador de pacotes |
| **versiona?** | sim | **nunca** |
| **apagou, volta sozinha?** | não — você baixa de novo à mão | sim, um comando recria |

**Regra das duas:** se você editar um arquivo daqui, ele está no lugar errado. Código que você mantém pertence a `Code/`.

### 9.2 External/ no SaaS

| Subpasta | O que acontece no SaaS |
|---|---|
| `tools/` | **Não existe.** Ferramenta de sistema que a aplicação precisa é instalada na **imagem do contêiner**, declarada no `Dockerfile` — não guardada no repositório |
| `libraries/` | **Não existe.** Nada colado à mão: tudo passa pelo gerenciador de pacotes |
| `runtimes/` | **Não existe.** A imagem base do contêiner **é** o runtime |
| `ai-models/` | **Existe só** se você serve um modelo próprio junto da aplicação — 9.3 |

### 9.3 External/ai-models/

Se a aplicação chama um modelo por API (o caso comum), isso é `clients/` e esta pasta não existe.

Ela só aparece quando você **serve o modelo você mesmo**. Nesse caso: uma subpasta por tipo (`llm/`, `embeddings/`, `rerankers/`, `vision/`, `speech/`), sempre no `.gitignore`, e o arquivo baixado quando o Docker monta a imagem ou montado como volume — nunca versionado.

### 9.4 Dependencies/ — os dois casos ao mesmo tempo

**O teste — apague a pasta de dependências e rode a aplicação já montada. Funcionou?**

| Resposta | Por quê | Então ela é |
|---|---|---|
| **Sim** | o empacotador já copiou para dentro do resultado o pedaço de biblioteca que o código usa; a pasta cumpriu o papel e virou entulho | **do desenvolvimento** → `Workshop/` |
| **Não** | o programa procura a biblioteca na hora de rodar; sem ela, nem liga | **do programa** → `Program/Dependencies/` |

**O SaaS é a única variação com as duas respostas no mesmo projeto:**

| Lado | Resposta | Mora em |
|---|---|---|
| **O navegador** | **sim** — o empacotador do frontend já levou para dentro de `Distribution/` o que o código usa | **`Workshop/`** — em Node, `Workshop/node_modules/`, ao lado do `package.json` do navegador |
| **O servidor** | **não** — ele importa as bibliotecas toda vez que sobe | **`Program/Dependencies/`** — em Node, `Program/node_modules/`, ao lado do `package.json` do servidor |

Sem essa distinção escrita, uma das duas nasce no lugar errado: a do servidor em `Workshop/` (e ele não sobe no contêiner, porque `Workshop/` não entra), ou a do navegador em `Program/` (e ela vai inteira para dentro do contêiner, à toa).

**Onde a linguagem impõe nome e lugar, vale o dela.** Em Node, Deno e Bun a pasta se chama `node_modules` e fica **direto na pasta que a usa**: a busca sobe a partir do arquivo que importa — olha na pasta, não achou, sobe um nível — e **nunca entra em pasta irmã**. De `Program/Code/backend/`, ela sobe até `Program/` e acha `Program/node_modules/`. Como o npm cria o `node_modules` ao lado do `package.json`, a lista acompanha a pasta. Nas linguagens em que o caminho é configurável (Python, PHP, Ruby), vale o nome `Dependencies/` — no Python, `pip install --target Program/Dependencies -r Workshop/requirements.txt`, e a entrada do servidor põe essa pasta no caminho de busca.

**A do navegador precisa ser apontada.** Pela mesma regra da busca, o código de `Program/Code/frontend/` não acha `Workshop/node_modules/` sozinho: diga ao empacotador do frontend onde procurar (no webpack, `resolve.modules`; no esbuild, `nodePaths`) e registre em `Convenções.md` como ficou.

**Regras:**
- **Nunca versionar.** Sempre no `.gitignore` — o que se versiona é a **lista**.
- Nunca editar à mão. Se precisa mudar, muda a lista e reinstala.
- A do servidor é reinstalada **dentro do contêiner**, pelo `Dockerfile`, a partir da lista — nunca copiada da sua máquina.

---

## 10. Internal/ — ele inteiro vira serviço

Num programa local, `Internal/` é uma pasta com sete subpastas em disco. **No SaaS, nada disso pode ser disco** — e o motivo é um só:

> ⚠ **Nada escrito no disco do contêiner sobrevive à próxima publicação.** O contêiner é substituído inteiro, e o disco vai junto. Ele também não é compartilhado: se a aplicação roda em duas cópias, cada uma tem o seu, e uma não vê o que a outra escreveu. Na função serverless é ainda mais curto: o disco é só leitura, com um `/tmp` provisório (seção 6.11).

**O conceito continua inteiro:** é o que o **programa** escreveu enquanto rodava. Só o lugar muda.

| Conceito | Para onde foi no SaaS |
|---|---|
| `logs/` | **Observabilidade** — saída padrão do processo, recolhida por um painel externo. Não se escreve arquivo de log: ele some na publicação e ninguém consegue ler o de outra cópia |
| `cache/` | **Serviço de cache em memória**, compartilhado entre as cópias da aplicação |
| `queue/` | **Fila de verdade**, como serviço. É ela que segura o trabalho de `backend/jobs/` |
| `temp/` | **Disco efêmero** — pode usar durante uma operação, mas some a cada publicação e não é visto pelas outras cópias |
| `state/` | **Tabelas no banco.** O que era "o app lembra sozinho" agora é por conta |
| `config/` | **Variáveis de ambiente** (o que é do ambiente: endereços, chaves, limites) **+ tabelas no banco** (o que o usuário escolheu na conta dele) |
| `credentials/` | **Cofre de segredos** da hospedagem, injetado como variável de ambiente na publicação. Nunca no repositório |

**As quatro regras que sobrevivem à mudança:**

1. **Nada disso se versiona.**
2. **`state` × `config`:** se o `state` sumir, o usuário nem nota; se o `config` sumir, ele reclama. Continuam sendo coisas diferentes.
3. **`constants/` × configuração:** `constants/` é o padrão de fábrica, que vem com o código e é substituído na publicação; o que o usuário escolheu está no banco e **não pode** ser substituído.
4. **Configuração de ambiente × configuração de conta:** endereço do banco é do **ambiente** e mora em variável de ambiente; tema escolhido é da **conta** e mora no banco. Misturar os dois é o que faz "funcionar na minha máquina".

**Cache de ferramenta não vai para `Code/`.** O que a ferramenta gera sozinha na sua máquina — `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`, `*.tsbuildinfo`, o cache do empacotador — **nunca fica em `Program/Code/`**: aponte-o, na configuração da ferramenta, para `Workshop/` (Python: a variável `PYTHONPYCACHEPREFIX`; pytest e mypy: `cache_dir`; ruff: `cache-dir`). Se a ferramenta não permitir apontar, registre em `Exceções.md`.

---

## 11. Onde o trabalho do usuário mora

**Onde o trabalho do usuário mora nesta plataforma:** no servidor, em dois lugares — o **banco** (o dado estruturado: registros, configuração de conta, histórico) e o **bucket**, o armazenamento de objetos (os arquivos: anexo, foto, documento, exportação gerada) —, **isolados por conta**.
**O que você tem permissão de escrever lá:** tudo o que a aplicação precisa, **sempre em nome de uma conta e só na dela**. Nunca no disco do contêiner, que some a cada publicação; nunca sem o filtro por dono.

**Por que não pode ser disco:** pelo mesmo motivo da seção 10 — o disco do contêiner some na publicação e não é compartilhado. Salvar o anexo de um cliente em disco é perder o anexo dele.

**O teste que separa trabalho do usuário de `Internal/`:** apagou e **o cliente perde trabalho** → é trabalho do usuário, banco ou bucket. Apagou e **a aplicação só refaz** → é `Internal/`, seção 10.

### 11.1 O isolamento por conta — a regra mais importante desta versão

> ⚠ **Toda consulta ao banco filtra por dono.** Sempre. Sem exceção.

É **sem esse filtro** que o dado de um cliente aparece para outro — o pior defeito possível num SaaS, e um dos mais fáceis de cometer: basta uma consulta escrita às pressas que busca por identificador sem perguntar de quem ele é.

**As quatro defesas, em ordem de confiabilidade:**

1. **O filtro por dono não é opcional em nenhuma consulta** — nem nas de leitura, nem nas de contagem, nem nas de exportação.
2. **Melhor do que lembrar é não poder esquecer:** a camada de acesso ao banco recebe o dono junto e aplica o filtro sozinha, ou o banco impõe a regra por conta própria.
3. **O identificador que vem do navegador nunca diz de quem é o dado.** Quem diz é a sessão autenticada. "Me dê o relatório 42" precisa virar "me dê o relatório 42 **se ele for da conta que está pedindo**".
4. **O teste de isolamento (8.3) roda sempre**, para todo módulo que lê dado de conta.

**No bucket vale o mesmo:** o caminho do arquivo começa pela conta, e o acesso é sempre por endereço temporário emitido depois de checar o dono — nunca por endereço público que qualquer um adivinha.

### 11.2 Os três formatos — escolha um

O que muda entre eles é **como o trabalho se organiza** dentro da conta:

**Formato 1 — unidades nomeadas:** o usuário cria, nomeia, abre e fecha unidades distintas de trabalho. No banco, é uma tabela de projetos; no bucket, um prefixo por projeto.

**Formato 2 — etapas: o trabalho passa por um fluxo.** Arquivos entram, são processados em sequência e saem prontos.

**Formato 3 — solto:** registros e arquivos avulsos da conta, sem outra estrutura.

### 11.3 A regra recursiva

> **As mesmas divisões de trabalho valem em dois níveis — nunca nos dois ao mesmo tempo.**

Se a aplicação **não tem** projetos, as divisões ficam direto na conta. Se **tem**, as mesmas divisões ficam dentro de cada projeto. E: se existem projetos, **todo fluxo pertence a algum deles** — fluxo solto ao lado dos projetos é órfão.

### 11.4 O padrão de etapas

**No SaaS a etapa é um campo de estado**, no banco — não uma pasta. As regras:

1. **Ordem explícita**, com o número na frente do nome da etapa.
2. **O nome descreve o que a etapa produziu**, não o que ela faz.
3. **A primeira etapa é onde o material entra**; o original nunca é modificado.
4. **Dois estados finais:** concluído e com erro.
5. **O estado "com erro" existe para não travar a fila.**
6. **O estado registrado É o estado.** Se a aplicação for reiniciada no meio — e ela vai, toda publicação faz isso — ela olha o estado e continua de onde parou. Nada de trabalho em andamento vivendo só na memória do processo.

**A diferença de `queue/`:** o estado no banco é **onde cada item está**; a fila é **o que roda em seguida**. São coisas diferentes, e no SaaS elas ficam em serviços diferentes.

---

## 12. Banco de dados

O banco é serviço, não arquivo — e o dado de todos os clientes está dentro dele.

### 12.1 Índice ou fonte — a diferença que importa

Não muda **onde** o dado fica. Muda **o que a aplicação pode fazer com ele**.

| | **Índice** | **Fonte** |
|---|---|---|
| **O que guarda** | Um resumo do que existe em outro lugar, para achar rápido | O dado em si — não há nada por trás |
| **Se apagar** | A aplicação relê a origem e reconstrói | **Perdeu** — não há de onde reconstruir |
| **Pode apagar sozinha?** | Sim, quando desconfia que desatualizou | **Nunca**, nem para "limpar" ou "corrigir" |

> *Se eu apagar isso agora, a aplicação reconstrói sozinha?* **Sim** → índice. **Não** → fonte, e ela jamais pode tocar sem confirmação.

**As três regras que só existem no SaaS:**

1. ⚠ **Backup e restauração testados.** Backup que nunca foi restaurado não é backup — é esperança. E aqui o dado não é seu: é dos seus clientes.
2. **Apagar é marcar como apagado**, não remover a linha. Cliente pede de volta, e removido de verdade não volta.
3. **Estrutura só muda por migração** (12.2), nunca na mão.

### 12.2 Program/migrations/ — as migrações do banco

**O que é:** a sequência de mudanças da estrutura do banco, uma por arquivo, em ordem. A ferramenta do banco cria a pasta e lhe dá o nome.

**Por que mora em `Program/` e não em `Workshop/`:** porque as migrações rodam **contra o banco de produção, a cada publicação** — no Fly.io, o `release_command` as aplica de dentro da imagem nova, antes de a aplicação subir; no Laravel, `php artisan migrate --force` roda no servidor; no Prisma, `prisma migrate deploy` roda no fluxo de publicação e lê a pasta. Apague a pasta e publique: o banco de produção fica sem a estrutura que o código novo espera, e ele quebra na primeira consulta. Pela regra da pasta que ninguém previu (seção 14.1 do arquivo principal), é **parte do produto** → `Program/`. E não fica em `Code/`: é pasta que a ferramenta exige, não código que a aplicação chama.

**O nome é o da ferramenta** — e quase todas deixam apontar a pasta:

| Ferramenta | Nome e lugar que ela usa | Como pôr em `Program/migrations/` |
|---|---|---|
| Django | `migrations/`, dentro de cada app | `MIGRATION_MODULES = {"billing": "migrations.billing"}`, com `Program/` no caminho de busca |
| Alembic | o ambiente que `alembic init` cria, com `versions/` dentro | `alembic init Program/migrations`; o `alembic.ini` é passado com `--config` ou `ALEMBIC_CONFIG` |
| Prisma | `migrations/`, ao lado do `schema.prisma` | `migrations.path` no `prisma.config.ts` |
| Rails | `db/migrate/` | `migrations_paths` no `config/database.yml` |
| Laravel | `database/migrations/` | `--path` nos comandos de migração, ou `loadMigrationsFrom` num provedor de serviço |
| Drizzle Kit | `drizzle/` (o padrão do `out`) | `out` no `drizzle.config.ts` |
| Supabase CLI | `supabase/migrations/`, fixo dentro de `supabase/` | `--workdir Program` → `Program/supabase/migrations/` — o nome inteiro é da ferramenta |

**O que a publicação lê para aplicar as migrações vai junto** — a configuração da ferramenta que o comando de aplicar abre precisa estar onde ele roda: dentro da imagem, se é o `release_command` que aplica. Registre em `Convenções.md` como ficou.

**As regras:**

1. **Uma migração por arquivo, numerada ou datada, em ordem** — a ferramenta costuma fazer isso sozinha.
2. **Migração aplicada nunca é editada.** Se estava errada, a correção é uma migração nova.
3. **Toda migração diz como desfazer** — ou declara explicitamente que não dá.
4. **Migração e código andam juntos.** A publicação aplica a migração antes de o novo código subir. Código novo com banco velho quebra na primeira chamada.
5. ⚠ **Cuidado com migração destrutiva.** Apagar coluna apaga o dado do cliente que estava nela, e não há de onde recuperar.
