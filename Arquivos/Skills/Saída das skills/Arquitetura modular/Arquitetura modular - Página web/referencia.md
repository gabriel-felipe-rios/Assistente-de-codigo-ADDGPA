# AMF — Referência completa · Arquitetura modular - Página web

Apoio da skill Arquitetura modular. Abra a seção que a tabela rápida do arquivo principal indicar ("ver N.N"), ou a seção da pasta cuja dúvida é o porquê. Cada seção é autossuficiente.

> Auditada em 22/09/2026 contra: MDN e os dados de compatibilidade dela (`mdn/browser-compat-data`), a posição da Mozilla e a do WebKit sobre o File System Access, o blog do Chrome 132, a regra 2.5.6 da App Store; a documentação do Vite (e um teste com o Vite 8.3), do webpack (`resolve.modules`) e do esbuild (`nodePaths`); a do GitHub Pages, do GitHub Actions, da Netlify e da Cloudflare Pages.

---

## 4. O arquivo de entrada — o `index.html`, dentro de `Program/Code/`

**Não há arquivo para clicar.** Quem abre o site é o navegador, pelo endereço. O que ocupa o lugar do arquivo de entrada são **dois arquivos que trabalham juntos**, e os dois moram em `Program/Code/`:

| | **`index.html`** | **A entrada do código** |
|---|---|---|
| **O que é** | O arquivo que o navegador carrega primeiro | O ponto de partida do seu código |
| **Quem chama** | O usuário, pelo endereço | O `index.html` |
| **O que tem dentro** | O mínimo: o esqueleto e a referência ao código | O que monta a interface de `frontend/` |

### 4.1 Por que o `index.html` mora em `Code/`

**O `index.html` é a primeira tela do produto, não ferramenta.** É HTML que você escreve e que o navegador mostra — pelo critério da AMF, é código, e código mora em `Program/Code/`.

**O empacotador aceita qualquer caminho para ele**, porque para o empacotador o `index.html` é só o ponto de entrada: é por ele que começa a ler, seguindo os imports. A configuração do empacotador, em `Workshop/`, diz onde ele está (`Program/Code/index.html`) e para onde escrever o resultado (`Distribution/`). No site montado, ele volta a ser o `index.html` da raiz publicada — mas isso é trabalho do empacotador, não lugar seu.

**Não escreva interface dentro do `index.html`.** Ele é o esqueleto; a interface é `frontend/`. Um `index.html` que cresce vira o lugar onde tudo acaba parando — e nada dentro dele segue a regra de módulos.

### 4.2 Um arquivo só

**A regra de "um arquivo só" continua valendo.** Nada de `-dev`, `-prod`, `-debug`: modo é configuração do empacotador, nunca um segundo arquivo de entrada.

### 4.3 `Distribution/` — o site montado, que sobe para a hospedagem

O empacotador (Vite, webpack, esbuild) lê o `index.html`, segue os imports, junta o código e os recursos, renomeia cada arquivo com um hash e escreve o resultado em `Distribution/`, uma pasta de nível 1, irmã de `Program/`.

**É essa pasta que sobe para a hospedagem.** A hospedagem estática só entrega arquivos: na configuração dela, a pasta publicada é `Distribution/`, e o script de publicação em `Workshop/scripts/` envia só ela.

| | O que é | Sobe para a hospedagem? |
|---|---|---|
| `Program/` | o que você escreveu | não — é o que o empacotador lê |
| `Workshop/` | o empacotador, a configuração dele, as bibliotecas | não |
| `Distribution/` | o site montado | **sim, e só ela** |

**Regras:**
- `Distribution/` é **resultado**: o empacotador refaz idêntico. Nunca se edita à mão e nunca se versiona.
- A configuração do empacotador e o script que o chama moram em `Workshop/` — seção 8.
- Antes de publicar, abra o site montado: o empacotador deixa de fora, sem avisar, o que ninguém importou (8.2).

---

## 5. Program/

**O que é:** tudo que pertence ao site — o que o empacotador lê para montar o que sobe para a hospedagem. Quando você publica uma versão nova, é isso que muda.

**O que mora nele:** `Code/`, `Assets/` e, só quando um modelo de IA roda dentro do navegador, `External/`. `Dependencies/` e `Internal/` **não existem como pasta** aqui — seções 9.4 e 10.

**Regras:**
- Todos os nomes aqui dentro são em inglês
- Nada do usuário entra aqui — e nesta versão isso é quase automático, já que o arquivo dele nunca sai do navegador dele
- Sempre existe, junto com `Code/`

---

## 6. Program/Code/

**O que é:** o código que **você** escreveu e que **roda quando a página roda**. É o coração do projeto.

⚠ **A característica que define esta plataforma: *tudo* aqui roda na máquina da pessoa, e segredo no navegador é segredo público.** Não existe "lado de dentro": o código, a configuração e qualquer chave que estiver aqui são legíveis por quem abre a página. Se o projeto precisa de uma chave que não pode ser lida por qualquer um, ele é SaaS — seção 0.1 do arquivo principal.

### 6.1 A regra que decide onde uma coisa fica

Esta é a regra mais importante do documento, porque ela substitui uma lista fixa de pastas:

> **Usado por UM módulo** → fica **dentro** desse módulo.
> **Usado por DOIS OU MAIS** módulos → sobe para o nível de `Code/`.
> **Editado em bloco**, independente do código → sobe também.

O princípio por trás: **organize por módulo/funcionalidade, nunca por tipo de arquivo**. Uma pasta que junta "todos os componentes" ou "todos os temas" agrupa por tipo — e separa o arquivo do código que o usa.

**Exemplo correto:**
```
Code/backend/conversor/
├── conversor-motor.ts
└── templates/
    └── saida.md          ← o modelo fica junto do código que preenche ele
```

Isso vale para **qualquer** conteúdo que o programa lê para decidir como agir: modelo, tema visual, preset, esquema de validação. Nenhum deles é pasta fixa da AMF — eles nascem dentro do módulo que os usa.

**No modo exibição, o conteúdo segue a mesma lógica:** o texto de um artigo é conteúdo, não código — e ele fica junto do módulo que o exibe, nunca numa pasta "todos os textos" no topo.

### 6.2 frontend/

**O que é:** toda a interface visual — telas, componentes, botões, formulários, tabelas, gráficos. É o que o usuário vê.

**Organizado por módulo, não por tipo de arquivo.** Cada tela ou funcionalidade é uma pasta, e dentro dela fica tudo daquela tela: código, estilo, o que for.

- Se a página tem seções ou rotas: cada uma vira uma pasta
- Se tem uma tela só — o caso comum da ferramenta de uma função: ela é o módulo raiz, com subpastas para os componentes

**Evitar:** `components/`, `hooks/`, `pages/` todos no mesmo nível — isso é agrupamento por tipo.

```
frontend/
├── conversor/
│   ├── conversor-tela.ts
│   ├── conversor-arrastar.ts
│   └── conversor-estilo.css
└── sobre/
```

**No modo exibição, esta é a pasta que domina o projeto.** No modo ferramenta, ela costuma ser fina: quem trabalha é `backend/`.

### 6.3 backend/ — que aqui roda no navegador

**O que é:** toda a lógica de processamento — a conversão, o cálculo, a validação, a análise. O que o usuário não vê, mas faz a página funcionar.

**A diferença que define esta versão: ele continua existindo, mas roda dentro do navegador**, na máquina da pessoa. Não há servidor. É aqui que mora a conversão do arquivo que ela arrastou.

**Por que continua sendo `backend/` e não vira "mais um componente":** porque a distinção da AMF nunca foi *onde roda*, e sim **o que faz** — `frontend/` mostra, `backend/` processa. Misturar a conversão dentro da tela é exatamente o que a AMF evita: aí a lógica não se testa, não se reusa e não se troca sem mexer na interface.

**Organizado pelos mesmos módulos do frontend**, quando ambos existem. E pode ter módulos só de backend, sem tela — isso é normal.

**As três regras que só existem aqui:**

1. **Processamento pesado trava a tela.** Como tudo roda no mesmo lugar, uma conversão longa congela a interface inteira. Trabalho pesado vai para uma linha de execução separada — e o módulo que a usa fica com essa fronteira explícita.
2. **A máquina é a do usuário**, e você não sabe qual é. O que roda em um segundo no seu computador pode levar trinta no celular dele. Arquivo grande precisa de progresso visível e de um limite honesto.
3. **Nada sai da máquina dele** — e isso é a maior vantagem desta plataforma. O arquivo não sobe para lugar nenhum, e vale dizer isso na interface: é a diferença entre "converta seu contrato aqui" e "mande seu contrato para um site desconhecido".

### 6.4 clients/

**O que é:** o código que **liga para fora**. A página precisa de algo, chama um serviço externo e espera a resposta. **Quem inicia a conversa é você.**

**Exemplos:** uma API pública de dados, um formulário que envia para um serviço de terceiro, um mapa.

**Regra:** um arquivo por serviço externo.

**As duas restrições desta plataforma:**

1. **Só serviço que aceita chamada sem chave secreta**, ou com chave pública mesmo (as que existem para isso, restritas por domínio). Chave secreta aqui é chave publicada.
2. **O navegador não chama qualquer endereço.** O serviço do outro lado precisa autorizar chamadas vindas de outro site. Se ele não autoriza, não há gambiarra do lado de cá: ou usa outro serviço, ou o projeto vira SaaS.

### 6.5 server/ — não existe

**Não há servidor nenhum.** O que hospeda uma página web estática apenas entrega arquivos — não roda código seu, não recebe chamada sua, não guarda nada.

Se aparecer a necessidade de alguém chamar você, o projeto deixou de ser Página web.

### 6.6 utils/ · constants/ · types/

- **`utils/`** — funções pequenas e reutilizáveis sem dependência de módulo: formatações, conversões, validações genéricas. Se uma função aparece em 2 lugares, ela vem para cá.
- **`constants/`** — valores fixos que aparecem em vários lugares, **e os padrões de fábrica**: tema inicial, limites, tempo de expiração. Valor de fábrica **é** valor fixo — deixando ele aqui, o que o usuário escolheu tem um lugar só (seção 10).
- **`types/`** — a forma dos dados que o programa usa. Um arquivo por entidade principal; tipo usado por um módulo só fica dentro dele.

### 6.7 locales/

**O que é:** os textos da interface separados em um arquivo por idioma.

**Regra:** só crie se a página **for** ter mais de um idioma.

**Nesta plataforma, o idioma escolhido vai para o armazenamento do navegador** (seção 10) — com a ressalva de sempre: se o usuário limpar, volta ao padrão.

### 6.8 prompts/

**O que é:** os prompts que a página manda para um modelo de linguagem, e os esquemas de saída estruturada de cada um.

**Por que fica no topo de `Code/` e não dentro de cada módulo:** porque prompt tem **modo de trabalho próprio**. Você senta para "mexer nos prompts" — revisa vários, compara o tom, ajusta o conjunto. É a única exceção deliberada à regra 6.1.

**Regras:**

1. **Uma subpasta por módulo** que conversa com IA. Nunca uma lista solta.
2. **O nome da subpasta é o nome real do módulo.**
3. **O prompt é sempre `.txt`.**
4. **O esquema é sempre `.json`, com nome idêntico ao do prompt.**
5. **Prompt sem saída estruturada simplesmente não tem `.json`.** Ausência não é pendência.

**A pergunta que vem junto: de onde sai a chave do modelo?** Se o projeto embute uma chave sua, ela está publicada — e o projeto virou SaaS. As duas saídas honestas são: **o usuário informa a chave dele** (que fica só no navegador dele), ou **o modelo roda localmente na máquina dele** (9.3).

### 6.9 A lista de dependências mora em `Workshop/`

O `package.json` — o arquivo que **lista** as dependências — **não fica em `Code/`**: ele é configuração do gerenciador de pacotes, e mora em `Workshop/`, ao lado da pasta que o npm cria a partir dele (seção 9.4). Ele só informa quais bibliotecas o projeto usa; é seu, e é versionado.

---

## 7. Program/Assets/

**O que é:** o que a página **mostra ou toca** e que você fez ou escolheu — imagem (inclusive SVG e ícone), fonte, áudio, vídeo. É substituído a cada publicação, como `Code/`.

**O critério é a FUNÇÃO do arquivo, não a extensão.** `Code/` guarda o que se **escreve** como parte do programa: código em qualquer linguagem, HTML, CSS, prompt (mesmo em `.txt` — um `.txt` que é prompt é estrutura do programa e fica em `Code/prompts/`), JSON, esquema, texto traduzido. `Assets/` guarda o que se **vê ou ouve**. Teste: *"a forma normal de mexer nisso é editar linha a linha num editor de código?"* Sim → `Code/`. Não (foi feito noutro programa, ou se olha/escuta) → `Assets/`. Um ícone SVG é texto, mas se mexe num editor de desenho: `Assets/`.

**Subpastas:** `icons/`, `images/`, `fonts/`, `audio/`, `video/`. Quando o recurso é de **um módulo só**, subpasta com o nome do módulo dentro do tipo: `Assets/images/chat/`. Modelo de IA baixado **não** é asset: fica em `External/ai-models/`.

**Regra:** nada binário ou de mídia em `Code/`; nada que se escreve em `Assets/`.

**Nesta plataforma:**

- **A pasta pública é uma subpasta: `Assets/public/`.** Alguns empacotadores esperam uma pasta de arquivos servidos como estão (`public/`, `static/`). No Vite ela é o `publicDir`: tudo o que está nela vai para o site montado **sem hash e sem passar pelo import**, e se referencia por caminho absoluto (`/robots.txt`). Por isso ela guarda só o que precisa manter o nome exato — `robots.txt`, `favicon.ico`, o `_headers` e o `_redirects` que a Netlify e a Cloudflare Pages leem na pasta publicada — e **nunca é `Assets/` inteira**: apontada para `Assets/`, o empacotador copia a pasta inteira sem hash, inclusive o que o código já importa — que sai de novo, com hash. O resto de `Assets/` se importa. Registre em `Convenções.md` como ficou.
- **O empacotador renomeia.** Ao montar o site, ele copia cada recurso para `Distribution/`, renomeado com um hash. Por isso **recurso se importa no código, nunca se referencia por caminho escrito à mão** — quem sabe o nome final é o empacotador.
- **Cada recurso é um download antes de a página aparecer.** Imagem grande e fonte pesada custam o tempo de espera de quem abre.

---

## 8. Workshop/

**O que é:** o que existe **para você desenvolver**, e que a página nunca executa. É uma pasta de nível 1, irmã de `Program/` — não fica dentro dele.

> **Tudo que existe só no desenvolvimento mora aqui, e nada daqui sobe para a hospedagem.**

Apagar `Workshop/` não tira o site do ar: o que está publicado continua. Você é que deixa de conseguir montá-lo, testá-lo e publicá-lo.

**A pergunta que separa de `Program/Code/`:** *isso roda quando a página roda?* Se sim → `Program/Code/`. Se só você executa, no desenvolvimento → `Workshop/`.

| O que mora aqui | Exemplo |
|---|---|
| a configuração do empacotador | `vite.config.ts`, `webpack.config.js` — 8.1 |
| a lista de dependências | `package.json` — seção 6.9 |
| a pasta de dependências | `node_modules/` — seção 9.4 |
| `tests/` | os testes automáticos — 8.2 |
| `scripts/` | publicar, verificar os links — 8.3 |
| a configuração das outras ferramentas | a do executor de testes, a do verificador de estilo, a do TypeScript |
| `.env.example` · `.env` | as variáveis do seu ambiente de desenvolvimento. O `.env.example` se versiona; o `.env` nunca — e o que o empacotador embute no site é público |

### 8.1 A configuração do empacotador

**O que é:** o arquivo em que o empacotador — Vite, webpack, esbuild — lê como montar o site. É ferramenta, não produto: mora em `Workshop/`, nunca na raiz e nunca em `Code/`.

**O que ela diz:**
- **de onde partir** — `Program/Code/index.html` (4.1);
- **onde estão os recursos** — `Program/Assets/`, e a pasta pública `Program/Assets/public/` (7);
- **onde estão as bibliotecas** — `Workshop/node_modules/` (9.4);
- **para onde escrever** — `Distribution/` (4.3);
- **onde fica o cache dela e o `.env`** — em `Workshop/`, nunca em `Code/` (10);
- **em que endereço o site vai morar**, quando for numa subpasta do domínio — o GitHub Pages de um repositório publica em `/nome-do-repositorio/`.

Rode o empacotador a partir de `Workshop/`, pelos scripts de `Workshop/scripts/` — assim ele acha a configuração e o `package.json` sem nenhum caminho escrito na raiz.

**No Vite, o que cada item vira** (a configuração é o `vite.config.js` ou `.ts`, em `Workshop/`). O Vite chama de `root` a pasta do `index.html`, e resolve a partir dela quase todo caminho relativo — por isso o jeito seguro é escrever os caminhos a partir da própria configuração:

| O que | Opção do Vite | Por que é preciso dizer |
|---|---|---|
| de onde partir | `root` → `Program/Code/` | o padrão é a pasta de onde o Vite foi chamado, que aqui é `Workshop/` |
| para onde escrever | `build.outDir` → `Distribution/` e **`build.emptyOutDir: true`** | fora do `root`, o Vite **não esvazia** a pasta de saída, só avisa — e os arquivos de hash antigo se acumulam e sobem junto |
| a pasta pública | `publicDir` → `Program/Assets/public/`, ou `false` se não houver | o padrão é `public/` dentro do `root` — dentro de `Code/` |
| o cache | `cacheDir` → `Workshop/node_modules/.vite` | o padrão é o `node_modules/.vite` do `package.json` mais próximo **do `root` para cima** — que não é o de `Workshop/`, pasta irmã; sem nenhum, uma pasta `.vite/` dentro de `Code/` |
| o `.env` | `envDir` → `Workshop/` | o padrão é o `root`: sem isto, o Vite nunca lê o `.env` de `Workshop/` |
| as bibliotecas | não há opção — 9.4 | a busca do Vite não entra em pasta irmã |
| o endereço | `base` → `/nome-do-repositorio/` | só quando o site mora numa subpasta do domínio |

O servidor de desenvolvimento do Vite recusa servir arquivo fora do `root` que ninguém importou. O que o código importa de `Workshop/node_modules/` passa; se aparecer um erro 403 dizendo *outside of Vite serving allow list*, acrescente `Workshop/` em `server.fs.allow`.

### 8.2 tests/

**Regra: espelha o caminho de `Program/Code/`, não o conteúdo.** Só existe pasta onde existe teste.

```
Program/Code/backend/conversor/motor.ts   →   Workshop/tests/backend/conversor/motor_test.ts
```

**O que esta plataforma acrescenta: o teste com arquivo de verdade.** Numa ferramenta de conversão, o que quebra não é a lógica limpa — é o PDF estranho, o arquivo enorme, o formato quase certo. Guarde um punhado de arquivos difíceis junto dos testes e rode a conversão neles. É o teste que mais paga.

E, para o modo exibição, vale testar **que o site montado abre** — o empacotador silenciosamente deixa de fora o que ninguém importou.

### 8.3 scripts/

**O que é:** automações de desenvolvimento e publicação — chamar o empacotador, verificar os links, e **publicar na hospedagem estática**.

**Regra:** nomear pelo que fazem — `publicar.sh`, `verificar-links.sh` — nunca apenas `run.sh`.

**O que é específico daqui:** publicar é enviar `Distribution/` para a hospedagem, e só isso. Não há banco para atualizar, não há processo para reiniciar, não há estado. É a operação mais simples de todas as plataformas — e por isso vale automatizá-la logo no início.

**O que cada hospedagem impõe:**
- **GitHub Pages** — publicando direto de um ramo, só aceita a raiz ou `/docs`; para publicar `Distribution/`, a publicação é um fluxo do GitHub Actions, que o GitHub só lê em `.github/workflows/`, na raiz (tabela 2.2 do arquivo principal). O site mora em `/nome-do-repositorio/`: diga isso ao empacotador (8.1).
- **Netlify** — a pasta publicada é qualquer uma; o `netlify.toml` fica na raiz por padrão, mas pode ir para outra pasta se o painel apontar para ela.
- **Netlify e Cloudflare Pages** — o `_headers` e o `_redirects` precisam estar **dentro da pasta publicada**: moram em `Program/Assets/public/`, e o empacotador os copia para `Distribution/` (7).

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

### 9.2 External/ numa página web

| Subpasta | O que acontece aqui |
|---|---|
| `tools/` | **Não existe.** O navegador não executa programa de terceiro |
| `libraries/` | **Não existe.** Nada colado à mão: toda biblioteca vem do gerenciador de pacotes, e o empacotador junta |
| `runtimes/` | **Não existe.** **O navegador é o runtime** |
| `ai-models/` | Só se o modelo rodar dentro do navegador — 9.3 |

### 9.3 External/ai-models/ — o modelo que roda no navegador

**Existe, mas o modelo inteiro é um download antes de a primeira resposta sair.** Isso muda de "arquivo grande" para "o usuário espera olhando a tela": trate como decisão de produto, com progresso visível, e nunca comece o download sem ele pedir.

Uma subpasta por tipo (`llm/`, `embeddings/`, `vision/`, `speech/`), sempre no `.gitignore` — são arquivos grandes e não são seus.

### 9.4 Dependencies/ — aqui, a pasta mora em `Workshop/`

**O teste — apague a pasta de dependências e rode o site já montado. Funcionou?**

| Resposta | Por quê | Então ela é |
|---|---|---|
| **Sim** | o empacotador já copiou para dentro do site montado o pedaço de biblioteca que o código usa; a pasta cumpriu o papel e virou entulho | **do desenvolvimento** → `Workshop/` |
| **Não** | o programa procura a biblioteca na hora de rodar; sem ela, nem liga | **do programa** → `Program/Dependencies/` |

**Numa página web a resposta é sempre "sim".** O site que o navegador recebe é o que está em `Distribution/`, e ali o empacotador já pôs tudo o que o código usa. Por isso `Program/Dependencies/` **não existe**, e a pasta de dependências mora em `Workshop/`.

**Onde a linguagem impõe nome e lugar, vale o dela.** No ecossistema do Node (npm, pnpm, yarn), a pasta se chama `node_modules/` e o gerenciador a cria **ao lado do `package.json`** — por isso os dois ficam juntos, em `Workshop/`.

**A configuração do empacotador aponta para ela.** A busca padrão por biblioteca sobe a partir do arquivo que importa — olha na pasta, não achou, sobe um nível — e **nunca entra em pasta irmã**: de `Program/Code/` ela sobe para `Program/` e para a raiz, e não acha `Workshop/node_modules/` sozinha. Diga ao empacotador onde procurar, e registre em `Convenções.md` como ficou:

| Empacotador | Como apontar para `Workshop/node_modules/` |
|---|---|
| **webpack** | `resolve.modules` com o caminho **absoluto** de `Workshop/node_modules` — absoluto, ele procura só ali; relativo, ele volta a subir a partir do arquivo |
| **esbuild** | `nodePaths` com o caminho de `Workshop/node_modules` (na linha de comando, a variável `NODE_PATH`) |
| **Vite** | **não há opção para isso**, e o Vite ignora o `NODE_PATH`. O caminho é um plugin de poucas linhas na configuração, que refaz a busca de cada biblioteca como se o import viesse de `Workshop/` |

O plugin do Vite, conferido com o Vite 8.3 no `vite build` e no servidor de desenvolvimento:

```js
// Workshop/vite.config.js — refaz em Workshop/ a busca das bibliotecas
import { fileURLToPath } from 'node:url';
const deWorkshop = fileURLToPath(new URL('./package.json', import.meta.url));
const bibliotecasDoWorkshop = {
  name: 'bibliotecas-do-workshop',
  enforce: 'pre',
  resolveId(fonte, quemImporta, opcoes) {
    const ehBiblioteca = !/^[./\0]|^[A-Za-z]:/.test(fonte);
    if (!quemImporta || !ehBiblioteca || quemImporta === deWorkshop) return null;
    return this.resolve(fonte, deWorkshop, { ...opcoes, skipSelf: true });
  },
};
// e em defineConfig: plugins: [bibliotecasDoWorkshop]
```

**O mesmo vale para o que lê `Code/` fora do empacotador.** O editor, o TypeScript e o executor de testes também buscam biblioteca subindo a partir do arquivo — e também não acham `Workshop/node_modules/` sozinhos. Confira cada um no primeiro uso — se o editor sublinha um import que o empacotador aceita, é isto — e registre em `Convenções.md` como ficou.

**Regras:**
- **Nunca versionar.** Sempre no `.gitignore` — o que se versiona é o `package.json` e o arquivo de travamento de versões.
- Nunca editar à mão. Se precisa mudar, muda a lista e reinstala.

---

## 10. Internal/ — o armazenamento do navegador

No computador de mesa, `Internal/` é uma pasta com sete subpastas em disco. **Aqui ela não existe como pasta: quase tudo vira armazenamento do navegador** — e ele tem uma característica que muda o desenho inteiro:

> ⚠ **O usuário pode limpar a qualquer hora, sem aviso** — pelo botão de limpar dados, pela navegação anônima, por uma política do navegador que apaga o que não é usado há tempo. **E some junto com o trabalho dele**, se o trabalho estiver ali.

**O conceito continua inteiro:** é o que a **página** escreveu enquanto rodava. Só o lugar muda.

| Conceito | Para onde foi |
|---|---|
| `logs/` | **Console do navegador.** Não há arquivo de log, e ninguém lê o console do usuário — o que precisa aparecer, aparece na interface |
| `cache/` | **Armazenamento do navegador** — resultado guardado para não refazer |
| `state/` | **Armazenamento do navegador** — o que a página lembra sozinha: aba aberta, rolagem, último filtro |
| `config/` | **Armazenamento do navegador** — o que o usuário escolheu: tema, idioma, opções |
| `queue/` | **Armazenamento do navegador** — o controle da fila, quando há mais de um arquivo em processamento |
| `temp/` | **Memória da aba.** Morre ao fechar, e é o certo: é o arquivo de uma operação |
| `credentials/` | **Não existe lugar seguro** — 10.1 |

### 10.1 credentials/ não existe

Não há onde guardar segredo. O armazenamento do navegador é legível por quem senta na máquina e por qualquer código que rode na página.

**A única coisa aceitável de guardar ali é uma chave que é do próprio usuário** — a chave dele, do serviço dele, digitada por ele, que fica no navegador dele e não vai para lugar nenhum. E mesmo aí: diga isso na interface, e ofereça o botão de apagar.

**Se a chave é sua, ela não pode existir aqui.** O projeto virou SaaS.

### 10.2 As regras que sobrevivem

1. **Nada disso se versiona.**
2. **`state` × `config`:** se o `state` sumir, o usuário nem nota; se o `config` sumir, ele reclama.
3. **`constants/` × `config`:** `constants/` é o padrão de fábrica, que vem com o código e é substituído na publicação; o que o usuário escolheu **não pode** ser substituído.
4. **Há um limite de espaço, e ele é pequeno.** Trabalho grande não cabe: ver seção 11.

**Cache de ferramenta não vai para `Code/`.** O que a ferramenta gera sozinha na sua máquina — o cache do empacotador, `*.tsbuildinfo`, o cache do executor de testes — **nunca fica em `Program/Code/`**: aponte-o, na configuração da ferramenta, para `Workshop/`. Se a ferramenta não permitir apontar, registre em `Exceções.md`.

---

## 11. Onde o trabalho do usuário mora

**Onde o trabalho do usuário mora nesta plataforma:** na máquina dele, e em um de dois lugares — no arquivo que **ele escolhe num seletor** (para abrir, e para receber de volta o resultado), ou num **armazenamento privado do navegador**, que ele não vê.
**O que você tem permissão de escrever lá:** no arquivo que ele escolheu, só o que ele autorizou naquele seletor; no armazenamento privado, o que quiser — mas o navegador e o usuário podem apagá-lo a qualquer hora, sem avisar.

**Firefox e Safari só têm o armazenamento invisível.** Abrir por seletor e devolver o resultado como download funciona em todo navegador; **gravar de volta num arquivo que o usuário escolheu** — o seletor de gravar — é coisa do Chrome e do Edge. Quem precisa funcionar em todos desenha para o download.

| Navegador | Abrir por seletor · devolver como download | Seletor de gravar (`showSaveFilePicker`) | Armazenamento privado (OPFS · IndexedDB) |
|---|---|---|---|
| **Chrome · Edge**, no computador | sim | sim, desde a versão 86 | sim |
| **Chrome no Android** | sim | sim, desde a versão 132 | sim |
| **Firefox** | sim | **não** — a posição oficial da Mozilla sobre a API é negativa | sim — OPFS desde a versão 111 |
| **Safari** — Mac, iPhone, iPad | sim | **não** — o WebKit se opõe à API | sim — OPFS desde a versão 15.2 |

- **No iPhone e no iPad, a coluna do Safari vale para todo navegador.** A Apple obriga todo navegador a usar o motor do Safari; só libera outro motor na União Europeia e no Japão, sob autorização.
- **O seletor de gravar só abre em HTTPS e depois de um clique** do usuário. Chamado ao carregar a página, ele falha.
- **O armazenamento privado some por inteiro.** Quando o navegador limpa um site, apaga tudo dele de uma vez: OPFS, IndexedDB e `localStorage` juntos.
- **O Safari apaga sozinho depois de 7 dias** sem o usuário clicar ou tocar no site — tudo o que o código gravou. A exceção é o site adicionado à tela de início, que o Safari trata como aplicativo.

Na prática, o trabalho tem dois momentos:

- **O que entra** — o arquivo que a pessoa arrasta para dentro, escolhe ou cola
- **O que sai** — o que ela baixa de volta

**Não há disco seu, não há servidor seu.** O arquivo dela nunca sai da máquina dela — e essa é a maior qualidade desta plataforma, não uma limitação. Diga isso na interface.

**O teste que separa trabalho do usuário de `Internal/`:** apagou e **o usuário perde trabalho** → é trabalho do usuário. Apagou e **a página só refaz** → é `Internal/`, seção 10.

**As regras:**
- O arquivo que entra **nunca é modificado**: o que sai é um arquivo novo
- A página jamais apaga nada do usuário sem confirmação explícita
- Nome de arquivo baixado é livre — é o trabalho dele

### 11.1 Exportar e importar deixam de ser luxo

Se a página guarda qualquer coisa entre visitas — um rascunho, uma lista, uma configuração longa — ela guarda no armazenamento do navegador, e **o usuário pode limpar a qualquer hora**. Ele nem imagina que "limpar dados de navegação" apaga o trabalho dele.

> ⚠ **Toda página que guarda trabalho precisa de exportar e importar.** Sem isso, a primeira limpeza apaga tudo, e não há de onde recuperar.

- **Exportar** — um arquivo que ele baixa e guarda onde quiser
- **Importar** — o caminho de volta, do arquivo para a página
- **E avise**, na interface, que o trabalho está no navegador e pode ser perdido. Uma frase resolve.

**`navigator.storage.persist()` ajuda, mas não substitui a exportação.** Ele pede ao navegador que não apague o site sozinho quando faltar espaço — não há garantia documentada de que livre da regra dos 7 dias do Safari. E o usuário continua podendo limpar pelas configurações, e aí some tudo do mesmo jeito.

### 11.2 Os três formatos — escolha um

Mesmo sem servidor, o trabalho pode se organizar de três jeitos:

**Formato 1 — unidades nomeadas:** o usuário cria, nomeia e alterna entre unidades de trabalho, guardadas no armazenamento do navegador. É o caso do editor ou do rascunho.

**Formato 2 — fluxo:** arquivos entram, passam por etapas e saem prontos. Vários arquivos de uma vez, cada um num estado.

**Formato 3 — passagem direta:** entra, converte, sai. **É o formato natural da ferramenta de uma função**, e o mais honesto: nada guardado, nada a perder.

### 11.3 O padrão de etapas

Quando há fluxo (formato 2), a etapa é **um campo de estado** de cada item na fila, não uma pasta. As regras:

1. **Ordem explícita**, com o número na frente do nome da etapa.
2. **O nome descreve o que a etapa produziu**, não o que ela faz.
3. **O que entrou nunca é modificado.**
4. **Dois estados finais:** concluído e com erro.
5. **O estado "com erro" existe para não travar a fila** — um arquivo problemático não pode parar os outros.
6. **O estado registrado É o estado**, e ele vive no armazenamento do navegador. Fechar a aba no meio interrompe o processamento: ao voltar, a página mostra o que ficou e continua do ponto, em vez de fingir que nada aconteceu.

---

## 12. Banco de dados

Não há banco no sentido de um arquivo `.db` nem de um servidor. O que existe é o **armazenamento estruturado do navegador**, para quando a página precisa guardar mais do que algumas opções.

**Quando usar:** lista com muitos itens, rascunhos, histórico, índice de busca. Para tema e idioma, o armazenamento simples basta.

### 12.1 Índice ou fonte — a diferença que importa

| | **Índice** | **Fonte** |
|---|---|---|
| **O que guarda** | Um resumo do que se pode refazer | O dado em si — não há nada por trás |
| **Se apagar** | A página reconstrói | **Perdeu** |
| **A página pode apagar sozinha?** | Sim | **Nunca** |

> *Se isso for apagado agora, a página reconstrói sozinha?* **Sim** → índice. **Não** → fonte.

⚠ **Aqui essa distinção é mais grave do que em qualquer outra plataforma**, porque quem apaga não é a página: **é o navegador, sem avisar**. Todo dado que for **fonte** precisa de um caminho de exportação (11.1). Se não tem, o projeto está prometendo uma permanência que não pode cumprir.
