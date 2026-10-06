---
name: arquitetura-modular-pagina-web
description: Referência completa da AMF (Arquitetura Modular por Features) na versão página web — diz em que pasta cada arquivo mora, como nomear pasta e arquivo, e o que cada área guarda. É a versão certa para site ou ferramenta que roda inteira no navegador de quem abre — blog, portfólio, documentação, conversor de arquivo — sem conta de usuário, sem login e sem nada guardado num servidor seu. Use SEMPRE antes de criar, mover, renomear ou deletar qualquer arquivo ou pasta deste projeto, mesmo que o usuário não peça para "seguir a arquitetura". Antes dela, leia os desvios registrados em "Saída das skills/Arquitetura modular/Exceções.md" e "Convenções.md" — um desvio do projeto sempre vence a regra genérica.
---

# AMF — Arquitetura Modular por Features — Referência Completa — versão **Página web**

Esta é a versão da AMF para **web sem conta de usuário**: nada de login, nada guardado num servidor seu. É a referência genérica, igual para todos os projetos de página web e para qualquer linguagem. Leia-a antes de criar, mover, renomear ou deletar qualquer arquivo ou pasta — mas primeiro confira os desvios deste projeto em `Saída das skills/Arquitetura modular/` (seção 17): um desvio registrado sempre vence a regra genérica. Se a pasta não existir, a seção 17 diz como criá-la.

---

## 0. A regra da raiz — o que a plataforma manda

**Onde a plataforma manda, ela vence.** A AMF se aplica no espaço livre que sobra.

Numa página web, três ferramentas entram em jogo, e vale nomeá-las antes de falar delas:

- **o gerenciador de pacotes** (npm, pnpm, yarn) — baixa as bibliotecas que a lista de dependências pede;
- **o empacotador** (Vite, webpack, esbuild) — lê o seu código a partir do `index.html`, junta tudo e escreve o site montado;
- **a hospedagem estática** (GitHub Pages, Netlify, Cloudflare Pages…) — só entrega arquivos: recebe a pasta montada e a serve.

Nenhuma delas impõe nada na raiz, com uma exceção. O empacotador aceita qualquer caminho para o `index.html` e para a pasta de saída; a hospedagem aceita qualquer pasta como a publicada — menos o GitHub Pages, que para isso exige um fluxo do GitHub Actions em `.github/workflows/` (tabela 2.2). Por isso a raiz fica livre: nela ficam o `CLAUDE.md`, as quatro pastas de nível 1 e o que a tabela 2.2 lista. **Todo o resto mora dentro de uma das quatro pastas.** Não há arquivo para clicar: quem abre o site é o navegador, pelo endereço.

### 0.1 A regra de fronteira

> ⚠ **Segredo no navegador é segredo público.**
> **Se a ferramenta precisa de chave secreta, ela não é Página web — virou SaaS.**

Tudo que chega ao navegador está na mão do usuário: o código, a configuração, a chave. Não existe "esconder" — só existe "ainda não procuraram". No momento em que o projeto precisar de uma credencial que não pode ser lida por qualquer um, ele precisa de um servidor seu, e a skill é a de SaaS.

### 0.2 Os dois modos que esta versão cobre

A mesma skill serve para dois tipos de projeto, porque **a arquitetura é a mesma**:

| | **Exibição** | **Ferramenta de uma função** |
|---|---|---|
| **O que é** | Blog, portfólio, documentação, página de apresentação | Arrasta o PDF, sai o Markdown, acabou |
| **O que domina** | O conteúdo | A conversão |
| **Onde está o peso** | `frontend/` | `backend/` — que aqui roda **dentro do navegador** |

O que os une: **não há conta, não há servidor seu, e nada fica guardado do lado de lá.**

---

## 1. Os baldes

Toda pasta deste projeto pertence a um destes baldes. Antes de criar qualquer coisa, descubra em qual ela cai — isso resolve a maioria das dúvidas sozinho.

| Balde | Critério | Se apagar |
|---|---|---|
| **`Program/`** | Eu escrevi · é o site · é o que o empacotador lê para montar o site | O site não se monta mais |
| ↳ `Code/` | Só código, e nada mais · roda quando a página roda — inclusive o `index.html` | A página para |
| ↳ `Assets/` | Eu fiz ou escolhi · não é código · a página mostra ou toca | A página fica sem imagem, som ou fonte |
| ↳ `External/` | **Eu colei à mão** · outro escreveu · eu não edito — aqui, só modelo de IA que roda no navegador | A página perde o que dependia dele (e eu baixo de novo à mão) |
| ↳ `Dependencies/` | **O gerenciador de pacotes instalou** · o programa precisa para rodar — **aqui não existe**: o empacotador leva as bibliotecas para dentro do site (seção 9 da `referencia.md`) | — |
| ↳ `Internal/` | A página escreveu · pode apagar que ela recria — aqui não é pasta: é o armazenamento do navegador | Nada se perde — desde que o trabalho do usuário não esteja só ali |
| **`Workshop/`** | Eu escrevi ou instalei · **só eu uso, no desenvolvimento** · inclui a configuração do empacotador e a pasta de dependências | O site publicado continua no ar; eu é que não consigo mais montá-lo |
| **`Distribution/`** | O empacotador montou · **é a pasta que sobe para a hospedagem** | O empacotador refaz idêntico |
| **`Files/`** | É o trabalho de quem usa · ninguém encosta — aqui não é pasta: entra por um seletor e sai como download (seção 2.3) | **Perde tudo que foi feito** |

**A pergunta que separa os baldes:** *o que acontece com isso quando eu atualizo o site?*
`Program/` é substituído · `Workshop/` não vai junto · `Distribution/` é o resultado, e é ele que a hospedagem recebe · o trabalho do usuário, na máquina dele, é intocável.

---

## 2. A árvore completa

Tudo abaixo é **situacional** exceto `Program/`, `Program/Code/` com o `index.html`, `Workshop/` com a configuração do empacotador, e `Distribution/`. Só crie o que o projeto realmente precisa.

São **quatro pastas de nível 1, irmãs**: `Program/`, `Workshop/`, `Distribution/` e `Files/` — e numa página web a quarta **não é pasta**: está desenhada para dizer onde o trabalho do usuário foi parar.

Legenda: `=` igual à versão Desktop · `~` existe, mas muda de conteúdo ou de regra · `→` deixa de ser pasta e vira outra coisa · `✖` não existe · `+` é novo aqui. **Cada linha se explica sozinha** — o símbolo nunca é a explicação inteira.

```
[Nome do projeto]/                     A RAIZ
│
✖ arquivo para clicar                  quem abre o site é o NAVEGADOR, pelo endereço
├── CLAUDE.md                          as regras que a IA lê ao abrir o projeto
├── .claude/   .mcp.json               ⊘ do assistente — não são da AMF
├── ⊘ Saída das skills/                não é da AMF…
│   └── Arquitetura modular/           …EXCETO esta: Convenções.md + Exceções.md
├── ⊘ Saída dos comandos/              não é da AMF
│
├── Program/                           O QUE O SITE É · nomes SEMPRE em inglês
│   │                                  é o que o empacotador lê para montar o site
│   │
│   ├── Code/                          SÓ código · roda quando a página roda
│   │   ├── + index.html               a primeira tela do produto · o empacotador começa
│   │   │                              por ele, e aceita qualquer caminho para ele
│   │   ├── + a entrada do código      o ponto de partida do código, chamado pelo index.html
│   │   ├── = frontend/                as telas, organizadas por MÓDULO
│   │   ├── ~ backend/                 o processamento — roda DENTRO do navegador, na
│   │   │                              máquina da pessoa · é aqui que mora a conversão
│   │   ├── ~ clients/                 você liga pra fora, direto do navegador · só serviço
│   │   │                              que aceita chamada sem chave secreta
│   │   ├── ✖ server/                  não existe: não há servidor seu
│   │   ├── = utils/                   funções reusadas em 2+ lugares
│   │   ├── = constants/               valores fixos + padrões de fábrica
│   │   ├── = types/                   a forma dos dados, compartilhada
│   │   ├── = locales/                 textos traduzidos
│   │   └── ~ prompts/                 os prompts, uma subpasta por módulo · a chave do
│   │                                  modelo é do usuário, nunca sua
│   │
│   ├── ~ Assets/                      o que se vê ou ouve · o empacotador copia para o
│   │   ├── icons/ images/ fonts/ …    site montado, renomeado com hash · {tipo}/{módulo}/
│   │   └── + public/                  só o que precisa manter o nome exato (robots.txt,
│   │                                  favicon.ico) · o empacotador copia sem hash
│   │
│   ├── ~ External/                    SÓ o que você colou à mão · você não edita
│   │   ├── ✖ tools/                   não existe: o navegador não executa programa de terceiro
│   │   ├── ✖ libraries/               não existe: toda biblioteca vem do gerenciador de pacotes
│   │   ├── ✖ runtimes/                não existe: o navegador é o runtime
│   │   └── ~ ai-models/               só quando o modelo roda dentro do navegador
│   │
│   ├── ✖ Dependencies/                não existe: o empacotador leva para dentro do site o
│   │                                  que o código usa — a pasta mora em Workshop/
│   │
│   └── → Internal/                    a página escreveu · não é pasta: é o armazenamento
│       │                              do navegador, que o usuário pode limpar a qualquer hora
│       ├── → logs/                    console do navegador
│       ├── → cache/  state/           armazenamento do navegador · resultado guardado e o
│       │                              que a página lembra sozinha
│       ├── → config/  queue/          armazenamento do navegador · o que o usuário escolheu
│       │                              e o controle da fila
│       ├── → temp/                    memória da aba · morre ao fechar
│       └── ✖ credentials/             não existe lugar seguro — ver 0.1
│
├── Workshop/                          SÓ NO DESENVOLVIMENTO · nada daqui vai para a hospedagem
│   ├── + configuração do empacotador  a do Vite, do webpack ou do esbuild · aponta para
│   │                                  Program/Code/index.html e escreve em Distribution/
│   ├── package.json                   a lista de dependências, que o npm lê
│   ├── node_modules/                  a pasta de dependências · o npm a cria ao lado do
│   │                                  package.json, e o empacotador já levou para dentro
│   │                                  do site o que o código usa
│   ├── ~ tests/                       espelha o caminho de Program/Code/ · + arquivos
│   │                                  difíceis de verdade para a conversão
│   ├── ~ scripts/                     + publicar Distribution/ na hospedagem
│   └── .env.example  ·  .env          as variáveis do desenvolvimento · o que o empacotador
│                                      embute no site fica público
│
├── Distribution/                      O QUE ELE PRODUZ · o site montado pelo empacotador
│                                      — é ESTA pasta que sobe para a hospedagem
│
└── → Files/                           O QUE É DO USUÁRIO · não é pasta: o arquivo entra por
                                       um seletor e sai como download — ver 2.3
```

`⊘` marca o que está na raiz mas **não é da AMF**: é do assistente de código, e esta referência não organiza, não cria e não cobra nada ali — com a única exceção de `Saída das skills/Arquitetura modular/` (seção 17).

### 2.1 `Distribution/` — o site montado, e o que sobe para a hospedagem

O empacotador lê o `index.html` em `Program/Code/`, segue os imports, junta o código e os recursos, renomeia cada arquivo com um hash e escreve o resultado em `Distribution/`. **É essa pasta, e só ela, que sobe para a hospedagem**: na configuração da hospedagem, a pasta publicada é `Distribution/`, e o script de publicação em `Workshop/scripts/` envia só ela.

- O que está nela é **resultado**: o empacotador refaz idêntico, então ela nunca se edita à mão e nunca se versiona.
- A configuração do empacotador e o script que o chama moram em `Workshop/`. Em `Distribution/` fica só o que sai dele.
- Nada de `Workshop/` sobe junto: nem a pasta de dependências, nem o `.env`, nem os testes.

### 2.2 O que fica na raiz, e por imposição de quem

| O arquivo ou a pasta | Quem obriga | O que quebra se ele sair dali |
|---|---|---|
| `CLAUDE.md` | a ferramenta — o Claude Code procura na raiz | a IA abre o projeto sem ler as regras |
| `.claude/` · `.mcp.json` | a ferramenta — o Claude Code, *do assistente, não do programa* | as permissões e os servidores MCP do assistente deixam de carregar |
| `Saída das skills/` · `Saída dos comandos/` | as skills e os comandos — *do assistente, não do programa* | as bases de decisão deixam de ser achadas |
| `Program/` | nós | a configuração do empacotador deixa de achar o `index.html` |
| `Workshop/` | nós | nada no site publicado; o empacotador e os scripts perdem o caminho de `Program/` |
| `Distribution/` | nós | o script de publicação e a hospedagem procuram o site montado noutro lugar, e sobe a pasta errada ou nenhuma |
| `.git/` · `.gitignore` · `LICENSE` | o Git e o site onde o repositório mora — *do repositório, não do programa* | o repositório deixa de ser reconhecido, o `.gitignore` deixa de valer para o projeto inteiro, a licença não é exibida |
| `.github/workflows/` — só se a hospedagem for o GitHub Pages | o GitHub — *do repositório, não do programa*. Publicando direto de um ramo, o GitHub Pages só aceita a raiz ou `/docs`; para publicar `Distribution/` é preciso um fluxo do GitHub Actions, e o GitHub só lê fluxo nesta pasta | o fluxo não roda, e o site não é publicado |

**O que não está nesta tabela não vai para a raiz.** O `index.html` não está: mora em `Program/Code/`. A configuração do empacotador também não: mora em `Workshop/`.

### 2.3 Onde o trabalho do usuário mora — `Files/` não é pasta aqui

**Onde o trabalho do usuário mora nesta plataforma:** na máquina dele, e em um de dois lugares — no arquivo que **ele escolhe num seletor** (para abrir, e para receber de volta o resultado), ou num **armazenamento privado do navegador**, que ele não vê.
**O que você tem permissão de escrever lá:** no arquivo que ele escolheu, só o que ele autorizou naquele seletor; no armazenamento privado, o que quiser — mas o navegador e o usuário podem apagá-lo a qualquer hora, sem avisar.

⚠ **Firefox e Safari só têm o armazenamento invisível.** Abrir um arquivo por seletor e devolver o resultado como download funciona em todo navegador; mas **gravar de volta num arquivo que o usuário escolheu** — o seletor de gravar, `showSaveFilePicker` — é coisa do Chrome e do Edge: no computador, e no Chrome do Android desde a versão 132. No iPhone e no iPad não existe em navegador nenhum, porque lá todos usam o motor do Safari. Quem precisa funcionar em todos desenha para o download. A tabela por navegador e o desenho completo — exportar, importar, formatos, etapas — estão na seção 11 da `referencia.md`.

> **Quando abrir `referencia.md`** (na mesma pasta desta skill): a tabela rápida da seção 15 responde onde cada coisa fica; quando ela remeter a uma seção ("ver 9.4"), ou quando a dúvida for o **porquê** de uma pasta, o que ela guarda em detalhe ou como se organiza por dentro, abra `referencia.md` na seção indicada. Para "onde fica X?" a tabela basta — não leia a referência inteira por precaução.

---

## 3. Convenção de nomenclatura

### 3.1 A regra de idioma

**Dentro de `Program/`, tudo em inglês.** É código: precisa ser previsível para ferramenta, editor e IA. `frontend`, `backend`, `utils` e `assets` são termos que o mundo inteiro reconhece — traduzir só cria atrito.

**O endereço visível ao usuário é conteúdo, não código.** O caminho de uma página (`/sobre`, `/artigos/como-fazer-x`) pode e costuma ser em português, com hífen no lugar do espaço e sem acento. Ele é lido por gente e por buscador.

**O nome do arquivo que o usuário baixa também é livre** — é o trabalho dele, não o seu código.

### 3.2 Maiúsculas

- **Nível 1 e 2** (`Program/`, `Workshop/`, `Distribution/`; `Code/`, `Assets/`, `External/`, `Internal/`) — primeira letra maiúscula, e **sempre o nome completo, nunca abreviado**. São nomes **conceituais**: dizem que tipo de coisa é aquilo.
- **Nível 3 em diante** (`frontend/`, `backend/`, `utils/`) — minúsculas, sem acento, sem espaço, hífen como separador. São nomes **técnicos**: dizem que parte do sistema é aquilo.

A troca de estilo **é** a fronteira entre conceito e implementação.

### 3.3 Arquivos

Tudo minúsculo, sem acento, sem espaço. Sempre começa pelo contexto (módulo ou feature).

- **Hífen (`-`)** separa blocos de conceito principais: `conversor-tela.ts`, `conversor-motor.ts`
- **Underscore (`_`)** mantém juntas palavras de um único conceito composto: `codigo_qr-gerador.ts`
- Sempre começa pelo contexto: `conversor-tela.ts`, nunca `tela-conversor.ts`
- Quando o caminho já informa o contexto, não repita: `frontend/conversor/tela.ts`
- **Arquivo dividido: cada parte leva o nome do original + o que a parte faz.** `arquivos.py` → `arquivos.py` (a casca) + `arquivos_copia.py` + `arquivos_ativacao.py`; `trabalhos.js` → `trabalhos-fluxo.js` + `trabalhos-metricas.js`. **Nunca número** (`-2`, `-parte2`, `-cont`): número diz que o arquivo continua, não diz o quê — e é o que faz alguém abrir três arquivos para achar uma função. Se a parte não tem nome próprio ("é só a continuação da lista"), o corte está no lugar errado: corte por tema (o que as funções têm em comum) ou por quem as usa. **Depois de dividir**, confira que todo nome usado de fora continua acessível — import, export, nome global: a divisão não muda a interface.

**Exceção:** `index.html`, `package.json` e os arquivos cujo nome o empacotador ou a hospedagem impõem ficam como eles exigem.

### 3.4 Tamanho dos arquivos

**Alvo: até 300 linhas.** Entre **300 e 500** o arquivo está na faixa de folga: divida na próxima vez que mexer nele, **se houver um corte natural** — nunca só para caber. **Acima de 500**, divida agora. Em qualquer caso o corte é por conceito, nunca por número: um arquivo de 520 linhas sem corte natural vira exceção registrada em `Exceções.md`, não um arquivo de 500 mais um de 20. O nome das partes segue a regra da seção 3.3.

### 3.5 Caminhos relativos, sempre

Nada de caminho absoluto. Numa página web isso tem uma consequência específica: **o site pode ser publicado na raiz de um domínio ou numa subpasta**, e caminho absoluto quebra no segundo caso. Recurso se referencia por import, deixando o empacotador resolver (seção 7 da `referencia.md`).

---

## 13. Segurança

Numa página web, tudo está exposto por natureza, e o trabalho do usuário mora num lugar que você não controla. As regras são poucas e duras.

### 13.1 Segredo

1. ⚠ **Nenhum segredo, em lugar nenhum.** Código, configuração, variável que o empacotador embute, armazenamento do navegador — tudo é legível por quem abre a página. **Se precisa de segredo, é SaaS** (0.1).
2. **Chave do próprio usuário é a única aceitável** — dele, digitada por ele, guardada só no navegador dele, com aviso e com botão de apagar.
3. **O `.env` do desenvolvimento mora em `Workshop/` e nunca se versiona.** O que se versiona é o `.env.example`, com os nomes das variáveis e sem os valores. E lembre: o que o empacotador embute no site é público, venha de onde vier.

### 13.2 O que é intocável

4. ⚠ **O armazenamento do navegador é volátil.** O usuário pode limpar a qualquer hora, e o navegador também apaga sozinho. **Toda página que guarda trabalho precisa de exportar e importar**, e de uma frase na interface avisando onde o trabalho está.
5. **O arquivo que entra nunca é modificado:** o que sai é um arquivo novo.
6. **O arquivo do usuário não sai da máquina dele.** Se o projeto processa arquivo pessoal — contrato, documento, foto —, isso é a garantia principal. **Não estrague isso** mandando "só uma estatística" para algum lugar.

### 13.3 Entrada e dependência de terceiro

7. **Toda entrada é suspeita** — arquivo arrastado, texto colado, parâmetro no endereço, resposta de API. Um arquivo malformado pode travar a aba; um conteúdo de terceiro inserido sem tratamento executa código na sua página.
8. **Nada sensível no endereço.** O que vai na URL fica no histórico e é mandado para outros sites no cabeçalho de origem.
9. **Dependência de terceiro é código que roda na página do seu usuário.** Poucas, conhecidas, com a versão fixada no `package.json` em `Workshop/`.

---

## 14. Princípios globais

1. **Onde a plataforma manda, ela vence.** A AMF organiza o espaço livre que sobra.

2. **Se precisa de chave secreta, não é Página web — é SaaS.** Segredo no navegador é segredo público.

3. **Organize por módulo, nunca por tipo de arquivo.** Tudo do módulo "conversor" fica junto — código, estilo, modelo. Uma pasta que junta "todos os componentes" ou "todos os temas" separa o arquivo do código que o usa.

4. **Onde uma coisa fica:** usada por **um** módulo → dentro dele; por **2+**, ou **editada em bloco** → sobe para o nível de `Code/`. Esta regra substitui qualquer lista fixa de pastas.

5. **Nunca criar pastas vazias para manter simetria.** A ausência é informativa.

6. **A pasta do esqueleto combinado nasce vazia de propósito; a IA não cria pasta por simetria.** As pastas que o Preparar projeto cria de uma vez — o esqueleto combinado para este tipo de projeto — existem antes do primeiro arquivo, e isso é intencional. O que continua proibido é a IA, no meio de uma tarefa, criar pasta que a tarefa não usa só porque a referência a descreve. A referência diz **onde** cada coisa vai quando existir.

7. **Nunca misturar código com dados gerados.** Publicar uma versão nova não pode custar nada ao usuário.

8. **`Code/` guarda só código** — e o `index.html` é código: é a primeira tela do produto. Mídia, variável de ambiente, configuração de ferramenta e pasta de dependências nunca entram em `Code/` — vão para `Assets/` ou `Workshop/`.

9. **`backend/` continua existindo** — o que muda é onde ele roda, não o que ele é.

10. **Processamento pesado não trava a tela.**

11. **Quem guarda trabalho no navegador oferece exportar e importar** — seção 13.2.

12. **O arquivo do usuário não sai da máquina dele** — e vale dizer isso na interface.

13. **Recurso se importa, não se referencia por caminho escrito à mão.**

14. **Princípio DRY** — função, constante ou tipo que aparece em 2+ lugares sobe para `utils/`, `constants/` ou `types/`. Nunca duplicar.

15. **Antes de criar pasta ou arquivo novo**, verificar se já existe local apropriado. A estrutura cresce por extensão, não por duplicação.

16. **Mover ou renomear pasta quebra caminho.** Import, leitura de arquivo, o caminho que a configuração do empacotador usa para achar o `index.html` e as bibliotecas — depois de mover, procure por referências ao caminho antigo e corrija, antes de dar por terminado.

17. **Nomeie a ferramenta antes de falar dela.** Diga **empacotador**, **gerenciador de pacotes** ou **hospedagem** — e, quando souber, o nome dela (Vite, npm, Netlify). Nunca uma perífrase solta como "a etapa de montagem", que não diz qual ferramenta é nem onde fica a configuração dela.

18. **Cada linha de árvore se explica sozinha.** Ao desenhar uma árvore de pastas — aqui, em `Convenções.md` ou em qualquer registro —, cada linha diz o que a pasta guarda. Um símbolo ou uma palavra solta nunca é a explicação inteira: quem lê tem só aquela linha na frente.

### 14.1 A pasta que ninguém previu

Quando uma ferramenta exigir uma pasta que esta referência não previu:

| Se ela é… | Vai para |
|---|---|
| da ferramenta ou do ambiente | `Workshop/` |
| parte do produto que você escreve | `Program/` |
| parte do pacote entregue | `Distribution/` |
| **em nenhuma hipótese** | **dentro de `Code/`** |

A pasta pública que alguns empacotadores esperam (`public/`, `static/`) é o exemplo: ela guarda recurso do produto, e por isso mora em `Program/Assets/` — mas como a subpasta `Assets/public/`, só com o que precisa manter o nome exato (`robots.txt`, `favicon.ico`), **nunca `Assets/` inteira**: o empacotador copia a pasta pública sem hash e sem passar pelo import — seção 7 da `referencia.md`. E registre a decisão em `Convenções.md`, em cinco linhas, para não ser rediscutida na próxima vez.

---

## 15. Tabela de referência rápida

### Na raiz

| Item | Existe quando |
|---|---|
| `CLAUDE.md` | **Sempre** — as regras que a IA lê |
| `Program/` | **Sempre** |
| `Workshop/` | **Sempre** — é onde ficam a configuração do empacotador e a pasta de dependências |
| `Distribution/` | **Sempre que o site é publicado** — é a pasta que sobe para a hospedagem — ver 2.1, acima |
| arquivo para clicar | **Nunca** — quem abre o site é o navegador |

O resto do que pode ficar na raiz, e por quê, está na tabela 2.2.

### Em Program/

| Pasta | Existe quando |
|---|---|
| `Code/` | **Sempre** — com o `index.html` dentro — ver 4 |
| `Assets/` | Há ícone, imagem, fonte ou som que a página serve — ver 7 |
| `External/` | Há modelo de IA que roda dentro do navegador — ver 9.3 |
| `Dependencies/` | **Nunca** — a pasta de dependências mora em `Workshop/` — ver 9.4 |
| `Internal/` | **Não existe como pasta** — é o armazenamento do navegador — ver 10 |

### Em Code/

| Item | Existe quando |
|---|---|
| `index.html` | **Sempre** — é o que o navegador carrega primeiro |
| a entrada do código | **Sempre** — uma só, sem variante por modo |
| `frontend/` | **Sempre** — página web tem tela |
| `backend/` | Há processamento de verdade — roda no navegador — ver 6.3 |
| `clients/` | A página chama serviço externo, sem chave secreta — ver 6.4 |
| `server/` | **Nunca** |
| `utils/` | Há função utilitária usada em 2+ lugares |
| `constants/` | Há valor fixo em 2+ arquivos, ou padrão de fábrica |
| `types/` | Há definição de dado compartilhada entre módulos |
| `locales/` | A página tem 2+ idiomas |
| `prompts/` | A página conversa com modelo de linguagem, com a chave do usuário — ver 6.8 |

### Em Workshop/

| Item | Existe quando |
|---|---|
| configuração do empacotador | **Sempre** — ver 8.1 |
| `package.json` | Há gerenciador de pacotes — o que é quase sempre |
| `node_modules/` | Idem — o npm a cria ao lado do `package.json` — ver 9.4 |
| `tests/` | Há teste escrito — inclua arquivos difíceis de verdade |
| `scripts/` | Há publicação ou verificação automatizada |
| `.env.example` · `.env` | O desenvolvimento usa variáveis de ambiente — e nada secreto |

### No lugar de Internal/ e de Files/

| Item | Existe quando |
|---|---|
| armazenamento do navegador | A página lembra qualquer coisa entre visitas — ver 10 |
| armazenamento estruturado | Há lista grande, rascunho ou histórico — ver 12 |
| exportar / importar | **Sempre que a página guardar trabalho** — ver 11.1 |
| aviso de volatilidade na interface | Idem |
| entrada de arquivo | O usuário arrasta, escolhe ou cola algo |
| saída de arquivo | A página devolve um arquivo pronto |
| lugar para segredo | **Nunca** — ver 0.1 |

---

## 16. Pares que se confundem

| | |
|---|---|
| **Página web × SaaS** | Sem conta e sem segredo × tem conta, ou precisa de chave |
| **Exibição × ferramenta de uma função** | O peso está em `frontend/` × o peso está em `backend/` |
| **`Program/Code/` × `Workshop/`** | Roda quando a página roda × só existe no desenvolvimento |
| **`Code/` × `Assets/`** | O que se escreve × o que se vê ou ouve |
| **`Workshop/` × `Distribution/`** | Onde ficam o empacotador e a configuração dele × onde fica o site montado, que sobe para a hospedagem |
| **`index.html` × configuração do empacotador** | A primeira tela do produto, em `Code/` × a ferramenta que parte dele, em `Workshop/` |
| **`index.html` × entrada do código** | O esqueleto que o navegador carrega × o que monta a interface |
| **`External/` × `node_modules/`** | Você colou à mão × o gerenciador de pacotes instalou, e mora em `Workshop/` |
| **`frontend/` × `backend/`** | Mostra × processa — os dois no navegador |
| **`clients/` × `server/`** | Você inicia a conversa × **não existe aqui** |
| **`Assets/` × arquivo do usuário** | Recurso do programa, vai para o site montado × entra e sai, nunca fica |
| **`constants/` × opção do usuário** | Padrão de fábrica, substituído na publicação × o que ele escolheu |
| **`state` × `config`** | A página guarda sozinha × o usuário escolheu de propósito |
| **armazenamento do navegador × memória da aba** | Sobrevive entre visitas (até alguém limpar) × morre ao fechar |
| **chave do usuário × chave sua** | Pode ficar no navegador dele × não pode existir aqui |
| **Índice × fonte** | A página refaz × precisa de exportação, ou some com a limpeza |

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
