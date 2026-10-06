---
name: arquitetura-modular-extensao-de-navegador
description: Referência completa da AMF (Arquitetura Modular por Features) na versão extensão de navegador — Chrome, manifesto versão 3 — diz em que pasta cada arquivo mora, como nomear pasta e arquivo, e o que cada área guarda. É a versão certa para extensão do Google Chrome escrita no formato de manifesto versão 3, em que o navegador carrega o código e nada é instalado no disco de quem usa. Use SEMPRE antes de criar, mover, renomear ou deletar qualquer arquivo ou pasta deste projeto, mesmo que o usuário não peça para "seguir a arquitetura". Antes dela, leia os desvios registrados em "Saída das skills/Arquitetura modular/Exceções.md" e "Convenções.md" — um desvio do projeto sempre vence a regra genérica.
---

# AMF — Arquitetura Modular por Features — Extensão de navegador: Chrome, manifesto versão 3

Esta é a versão da AMF para extensão do **Chrome, manifesto versão 3** — a extensão específica do Google Chrome, no formato de manifesto que ele exige hoje. É a referência genérica, igual para todos os projetos de extensão e para qualquer linguagem que o navegador rode. Leia-a antes de criar, mover, renomear ou deletar qualquer arquivo ou pasta — mas primeiro confira os desvios deste projeto em `Saída das skills/Arquitetura modular/` (seção 17): um desvio registrado sempre vence a regra genérica. Se a pasta não existir, a seção 17 diz como criá-la.

---

## 0. A regra da raiz — o que a plataforma manda

**Onde a plataforma manda, ela vence.** A AMF se aplica no espaço livre que sobra.

Numa extensão, quem manda é o Chrome — e ele manda **no pacote**, não no seu projeto. O pacote é a pasta que o Chrome carrega: `Distribution/` (seção 2.1). Dentro dela, ele exige duas coisas:

1. ⚠ **`manifest.json` e `_locales/` ficam na raiz do pacote, com esses nomes exatos.** O Chrome impõe o nome **e** o lugar. Numa subpasta, ele não os encontra: sem o manifesto a extensão não carrega; sem `_locales/`, a extensão traduzida é recusada na hora de carregar.
2. **Todo caminho que o manifesto declara é um caminho dentro do pacote** — o arquivo que o empacotador escreveu em `Distribution/`, não o que você edita em `Program/Code/`. Caminho que não bate: a parte correspondente simplesmente não carrega, muitas vezes sem erro visível.

Por isso, nesta variação, o que o Chrome exige tem sempre **dois endereços**: a **fonte**, em `Program/`, onde você edita, e o **resultado**, em `Distribution/`, que o empacotador (esbuild, Vite ou webpack) escreve. A raiz do projeto, em si, quase não tem nada imposto — a tabela da seção 2.2 lista o pouco que tem, com o porquê.

A raiz é o único nível que se vê ao abrir a pasta. Nela ficam as quatro pastas de nível 1 e o que a tabela 2.2 lista. **Todo o resto mora dentro de uma das quatro pastas.**

---

## 1. Os baldes

Toda pasta deste projeto pertence a um destes baldes. Antes de criar qualquer coisa, descubra em qual ela cai — isso resolve a maioria das dúvidas sozinho.

| Balde | Critério | Se apagar |
|---|---|---|
| **`Program/`** | Eu escrevi · é a extensão · é a fonte de que o pacote é montado | O empacotador não tem mais o que montar |
| ↳ `Code/` | Só código, e nada mais · vira os scripts e as páginas do pacote | A extensão deixa de existir |
| ↳ `Assets/` | Eu fiz ou escolhi · não é código · a extensão mostra ou toca | O pacote fica sem os ícones que o manifesto lista, e o Chrome recusa carregá-lo |
| ↳ `External/` | **Eu colei à mão** · outro escreveu · eu não edito · vai **dentro** do pacote | A extensão para (e eu baixo de novo à mão) |
| ↳ `Dependencies/` | **Não existe aqui** — o empacotador leva as bibliotecas para dentro do pacote; a pasta do gerenciador de pacotes é do desenvolvimento e mora em `Workshop/` | — |
| ↳ `Internal/` | **Não é pasta em disco** — vira o armazenamento do Chrome, que a extensão escreve enquanto roda | O usuário perde preferência e cache; e, se houver, a chave que ele mesmo digitou |
| **`Workshop/`** | Eu escrevi ou instalei · **só eu uso, no desenvolvimento** · aqui mora o empacotador | A extensão já carregada continua rodando; eu é que não consigo mais montar o pacote |
| **`Distribution/`** | O empacotador montou · **é esta pasta que você carrega no navegador** | O empacotador refaz idêntica |
| **`Files/`** | **Não existe aqui** — o trabalho é do site que a pessoa visita | — |

**A pergunta que separa os baldes:** *o que acontece com isso quando eu atualizo a extensão?*
`Program/` é a fonte da versão nova · `Workshop/` não vai junto · `Distribution/` é o resultado, e é ele que a loja recebe · o armazenamento do Chrome, no lugar de `Internal/`, sobrevive à atualização e só some quando o usuário desinstala.

---

## 2. A árvore completa

Tudo abaixo é **situacional** exceto `Program/manifest.json`, `Program/Code/` e `Distribution/`. Só crie o que o projeto realmente precisa.

São **quatro pastas de nível 1, irmãs**: `Program/`, `Workshop/`, `Distribution/` e `Files/` — aqui, `Files/` não existe. Nenhuma fica dentro da outra.

Legenda, comparando com a versão Desktop da AMF: `=` igual · `~` existe, mas muda · `→` vira outra coisa · `✖` não existe · `+` é novo aqui. **O símbolo nunca é a explicação inteira** — cada linha diz o que a pasta guarda.

```
[Nome do projeto]/                     A RAIZ
│
✖ arquivo de entrada                   não há o que clicar: o CHROME carrega a extensão
├── CLAUDE.md                          as regras que a IA lê ao abrir o projeto
├── .claude/   .mcp.json               ⊘ do assistente — não são da AMF
├── ⊘ Saída das skills/                não é da AMF…
│   └── Arquitetura modular/           …EXCETO esta: Convenções.md + Exceções.md
├── ⊘ Saída dos comandos/              não é da AMF
│
├── Program/                           A FONTE DA EXTENSÃO · nomes SEMPRE em inglês
│   │                                  Ctrl+C aqui e o pacote se monta em qualquer lugar
│   │
│   ├── + manifest.json                a FONTE do manifesto, versão 3 · é aqui que se edita
│   │                                  a versão · o empacotador COPIA para Distribution/
│   │
│   ├── ~ Code/                        SÓ código · o primeiro corte é por CONTEXTO (6.1)
│   │   ├── + service-worker/          segundo plano, sem tela · MORRE e reinicia entre
│   │   │                              eventos: nada de estado guardado em memória
│   │   ├── + content-scripts/         injetado na PÁGINA VISITADA — ambiente hostil:
│   │   │                              a página mexe no que você lê
│   │   ├── + popup/                   a janelinha do ícone da barra · morre ao fechar
│   │   ├── + options/                 a página de opções, onde o usuário escolhe
│   │   ├── ✖ frontend/                não existe: a tela mora em popup/ e options/
│   │   ├── ~ backend/                 a lógica que não é tela nem evento · costuma ser pequena
│   │   ├── ~ clients/                 você liga para fora — só os domínios declarados
│   │   │                              no manifesto
│   │   ├── ✖ server/                  não existe: ninguém liga para uma extensão
│   │   ├── = utils/                   funções reusadas em 2+ lugares
│   │   ├── = constants/               valores fixos + padrões de fábrica
│   │   ├── ~ types/                   a forma dos dados · e o formato das mensagens
│   │   │                              que atravessam contextos
│   │   ├── ~ locales/                 a FONTE dos textos traduzidos, uma subpasta por
│   │   │                              idioma · o empacotador escreve Distribution/_locales/
│   │   └── = prompts/                 os prompts, uma subpasta por módulo
│   │
│   ├── ~ Assets/                      o que se vê · os ícones 16/32/48/128 que o
│   │   └── icons/  images/  fonts/    manifesto lista · {tipo}/{módulo}/ se o recurso
│   │                                  for de um módulo só
│   │
│   ├── ~ External/                    SÓ o que você colou à mão, e vai DENTRO do pacote:
│   │                                  libraries/ (a .min.js colada) · ai-models/ (modelo
│   │                                  que roda no navegador) · nada carregado de fora
│   │
│   ├── ✖ Dependencies/                não existe: o empacotador leva as bibliotecas para
│   │                                  dentro do pacote · a pasta do npm mora em Workshop/
│   │
│   └── → Internal/                    não é pasta em disco: vira o ARMAZENAMENTO DO CHROME,
│                                      local e sincronizado — referencia.md, seção 10
│
├── ~ Workshop/                        SÓ NO DESENVOLVIMENTO · nada daqui vai no pacote
│   ├── = tests/                       testes automáticos · espelha o caminho de Program/Code/
│   ├── ~ scripts/                     chamar o empacotador · gerar o .zip · publicar na loja
│   ├── + package.json  node_modules/  a lista e a pasta do npm — o empacotador já leva
│   │                                  as bibliotecas para dentro do pacote
│   ├── + config do empacotador        a do esbuild, do Vite ou do webpack
│   ├── + tsconfig.json                a do compilador TypeScript, quando houver
│   ├── + cache das ferramentas        o que o empacotador e o compilador guardam sozinhos
│   └── = .env.example  ·  .env        as variáveis do seu ambiente de desenvolvimento
│
├── ~ Distribution/                    O PACOTE · SEMPRE existe · é esta pasta que você
│   │                                  carrega no navegador
│   ├── manifest.json                  copiado de Program/ · o Chrome o exige aqui
│   ├── _locales/                      escrito a partir de Program/Code/locales/ · o Chrome
│   │                                  impõe o nome E o lugar: a raiz do pacote
│   ├── o código montado               o que o empacotador juntou de Program/Code/
│   └── icons/                         copiados de Program/Assets/icons/
│
✖ Files/                               não existe: o trabalho é do SITE que a pessoa visita
```

`⊘` marca o que está na raiz mas **não é da AMF**: é do assistente de código, e esta referência não organiza, não cria e não cobra nada ali — com a única exceção de `Saída das skills/Arquitetura modular/` (seção 17).

### 2.1 `Distribution/` — o pacote que o Chrome carrega

**É esta pasta que você carrega no navegador.** Durante o desenvolvimento, é ela que se escolhe em "Carregar sem compactação", na página de extensões do Chrome; na publicação, é o conteúdo dela, compactado num `.zip`, que vai para a Chrome Web Store.

- **Quem escreve aqui é o empacotador** (esbuild, Vite ou webpack), chamado por um script de `Workshop/scripts/`. Ele junta o código de `Program/Code/`, copia `Program/manifest.json` para a raiz do pacote, escreve `_locales/` a partir de `Program/Code/locales/` e copia os ícones de `Program/Assets/icons/`.
- **Sem empacotador, a pasta existe do mesmo jeito**: um script de cópia em `Workshop/scripts/` faz esse trabalho, porque a fonte e o pacote têm formas diferentes.
- **É resultado:** o empacotador refaz idêntico. Nunca se edita à mão — a mudança some na próxima montagem — e nunca se versiona.
- O `.zip` da loja se gera na hora de publicar, a partir do conteúdo desta pasta.

### 2.2 O que fica na raiz, e por imposição de quem

| O arquivo ou a pasta | Quem obriga | O que quebra se ele sair dali |
|---|---|---|
| `CLAUDE.md` | a ferramenta — o Claude Code procura na raiz | a IA abre o projeto sem ler as regras |
| `.claude/` · `.mcp.json` | a ferramenta — o Claude Code, *do assistente, não do programa* | as permissões e os servidores MCP do assistente deixam de carregar |
| `Saída das skills/` · `Saída dos comandos/` | as skills e os comandos — *do assistente, não do programa* | as bases de decisão deixam de ser achadas |
| `Program/` | nós | o empacotador não acha a fonte |
| `Workshop/` | nós | nada na extensão; os scripts, os testes e a configuração do empacotador perdem o caminho de `Program/` |
| `Distribution/` | nós — e, dentro dela, o Chrome | a extensão carregada no navegador aponta para uma pasta que não existe mais |
| `.git/` · `.gitignore` · `LICENSE` | o Git e o site onde o repositório mora — *do repositório, não do programa* | o repositório deixa de ser reconhecido, o `.gitignore` deixa de valer para o projeto inteiro, a licença não é exibida |

O `manifest.json` não está nesta tabela: o Chrome o exige na raiz do **pacote** (`Distribution/`), não na raiz do projeto — seção 0.

**O que não está nesta tabela não vai para a raiz.**

> **Quando abrir `referencia.md`** (na mesma pasta desta skill): a tabela rápida da seção 15 responde onde cada coisa fica; quando ela remeter a uma seção ("ver 6.10"), ou quando a dúvida for o **porquê** de uma pasta, o que ela guarda em detalhe ou como se organiza por dentro, abra `referencia.md` na seção indicada. Para "onde fica X?" a tabela basta — não leia a referência inteira por precaução.

---

## 3. Convenção de nomenclatura

### 3.1 A regra de idioma

**Dentro de `Program/`, tudo em inglês.** É código: precisa ser previsível para ferramenta, editor e IA.

**Nos nomes impostos pelo Chrome, vale o que ele exige** — `manifest.json`, `_locales/`, e os códigos de idioma dentro dela (`pt_BR/`, `en/`, cada uma com o seu `messages.json`). A fonte em `Program/Code/locales/` já usa os mesmos códigos e o mesmo formato, para que o empacotador só precise copiar. Não é escolha sua, e por isso não é violação.

**Os textos que o usuário lê são conteúdo**, não código: ficam nos arquivos de `locales/`, e podem estar em qualquer idioma.

### 3.2 Maiúsculas

- **Nível 1 e 2** (`Program/`, `Workshop/`, `Distribution/`; `Code/`, `Assets/`, `External/`) — primeira letra maiúscula, e **sempre o nome completo, nunca abreviado**. São nomes **conceituais**: dizem que tipo de coisa é aquilo.
- **Nível 3 em diante** (`service-worker/`, `content-scripts/`, `popup/`, `locales/`) — minúsculas, sem acento, sem espaço, hífen como separador. São nomes **técnicos**: dizem que parte do sistema é aquilo.

A troca de estilo **é** a fronteira entre conceito e implementação. `_locales/` é a exceção imposta pelo Chrome — e ela só existe dentro de `Distribution/`, onde quem escreve é o empacotador.

### 3.3 Arquivos

Tudo minúsculo, sem acento, sem espaço. Sempre começa pelo contexto (módulo ou feature).

- **Hífen (`-`)** separa blocos de conceito principais: `destacar-marcador.ts`, `destacar-menu.ts`
- **Underscore (`_`)** mantém juntas palavras de um único conceito composto: `codigo_qr-gerador.ts`
- Sempre começa pelo contexto; quando o caminho já informa, não repita: `content-scripts/destacar/marcador.ts`
- **Arquivo dividido: cada parte leva o nome do original + o que a parte faz.** `arquivos.py` → `arquivos.py` (a casca) + `arquivos_copia.py` + `arquivos_ativacao.py`; `trabalhos.js` → `trabalhos-fluxo.js` + `trabalhos-metricas.js`. **Nunca número** (`-2`, `-parte2`, `-cont`): número diz que o arquivo continua, não diz o quê — e é o que faz alguém abrir três arquivos para achar uma função. Se a parte não tem nome próprio ("é só a continuação da lista"), o corte está no lugar errado: corte por tema (o que as funções têm em comum) ou por quem as usa. **Depois de dividir**, confira que todo nome usado de fora continua acessível — import, export, nome global: a divisão não muda a interface.

### 3.4 Tamanho dos arquivos

**Alvo: até 300 linhas.** Entre **300 e 500** o arquivo está na faixa de folga: divida na próxima vez que mexer nele, **se houver um corte natural** — nunca só para caber. **Acima de 500**, divida agora. Em qualquer caso o corte é por conceito, nunca por número: um arquivo de 520 linhas sem corte natural vira exceção registrada em `Exceções.md`, não um arquivo de 500 mais um de 20. O nome das partes segue a regra da seção 3.3.

### 3.5 Caminhos relativos, sempre

Nada de caminho absoluto. Numa extensão, todo recurso é referenciado por um endereço interno que o navegador resolve na hora — **o identificador da extensão muda entre a versão carregada sem compactação e a publicada**, então caminho escrito à mão quebra na publicação.

---

## 13. Segurança

Uma extensão tem três exposições que a versão Desktop não tem: **o pacote é aberto**, **o código roda dentro do site dos outros**, e **a permissão pedida é vista pelo usuário e pela loja**.

### 13.1 O pacote é aberto

1. ⚠ **Nada sensível dentro do pacote.** Qualquer um instala, descompacta e lê tudo o que está em `Distribution/` — código, manifesto, valor embutido. Chave sua não pode existir numa extensão: se ela precisa de chave, a chave é do usuário (seção 10.1 da `referencia.md`), ou o projeto precisa de um servidor — e aí é outra plataforma.
2. ⚠ **Nada sensível no armazenamento sincronizado.** Ele viaja para a conta Google do usuário e é replicado em todos os computadores dele.
3. **O `.env` do desenvolvimento mora em `Workshop/` e nunca se versiona** — e o empacotador nunca embute o valor dele no código montado. O que se versiona é o `.env.example`, com os nomes das variáveis e sem os valores.

### 13.2 O site dos outros

4. **O conteúdo da página é entrada de estranho.** Valide antes de usar; nunca insira conteúdo da página na sua interface sem tratar; nunca execute nada que veio de lá.
5. ⚠ **Não mande para fora o que você leu da página** sem o usuário saber, e sem que isso esteja dito na descrição da loja. É vazamento do que a pessoa estava vendo — e é o comportamento que mais derruba extensão publicada.
6. **A mensagem entre contextos também é entrada.** Valide quem mandou e o que mandou — outras extensões e a própria página podem tentar falar com você.

### 13.3 Permissão

7. **Peça o mínimo.** Permissão para todos os sites sem precisar reprova na loja e assusta o usuário na instalação. Peça o menor conjunto de sites possível, e prefira a permissão concedida na hora do uso à concedida na instalação.
8. **Peça o mínimo de domínios em `clients/`.** Cada domínio declarado é uma porta a mais, e todas são auditadas.

### 13.4 Dependência de terceiro

9. **O que está em `External/` você colou à mão: saiba de onde veio.** Baixe do site oficial do projeto e guarde a versão — é você quem o substitui depois, e ele vai dentro do pacote que a loja revisa.
10. **O que o npm instala sai da lista em `Workshop/package.json`.** Fixe as versões, para que reinstalar traga exatamente o que já foi testado — tudo aquilo acaba dentro do pacote.

---

## 14. Princípios globais

1. **Onde a plataforma manda, ela vence.** `manifest.json` e `_locales/` na raiz do pacote, com esses nomes; os caminhos do manifesto batendo com o que o empacotador escreve em `Distribution/`.

2. **A fonte mora em `Program/`, o pacote em `Distribution/`.** Edita-se só a fonte; o Chrome carrega só o pacote. Nunca aponte o navegador para `Program/`, e nunca corrija nada direto em `Distribution/`.

3. **O primeiro corte de `Code/` é por contexto de execução** — exceção declarada, imposta pelo navegador (seção 6.1 da `referencia.md`). **Dentro do contexto, organize por módulo**, nunca por tipo de arquivo.

4. **Onde uma coisa fica:** usada por **um** módulo → dentro dele; por **2+**, ou **editada em bloco** → sobe para o nível de `Code/`. O que dois contextos usam sobe para `utils/`, `constants/` ou `types/`.

5. **Nunca criar pastas vazias para manter simetria.** Se `content-scripts/destacar/` existe mas não há opção para ele, não crie `options/destacar/` vazia. A ausência é informativa.

6. **A pasta do esqueleto combinado nasce vazia de propósito; a IA não cria pasta por simetria.** As pastas que o Preparar projeto cria de uma vez existem antes do primeiro arquivo, e isso é intencional. O que continua proibido é a IA, no meio de uma tarefa, criar pasta que a tarefa não usa só porque a referência a descreve.

7. **`Code/` guarda só código.** Mídia, variável de ambiente, configuração de ferramenta e pasta de dependências nunca entram em `Code/` — vão para `Assets/` ou `Workshop/`.

8. **O service worker morre entre eventos.** Nada de estado guardado em memória: o que precisa sobreviver vai para o armazenamento do Chrome.

9. **Nada de código remoto.** Tudo vai dentro do pacote — a política de segurança da extensão proíbe carregar script de fora, e a loja recusa.

10. **Princípio DRY** — se uma função, constante ou tipo aparece em 2+ lugares, ela sobe para `utils/`, `constants/` ou `types/`. Nunca duplicar.

11. **Antes de criar pasta ou arquivo novo**, verificar se já existe local apropriado. A estrutura cresce por extensão, não por duplicação.

12. **Mover ou renomear pasta quebra caminho.** Import, a configuração do empacotador, e aqui também o manifesto: depois de mover, procure pelas referências ao caminho antigo e corrija, antes de dar por terminado.

13. **Nomeie a ferramenta antes de falar dela.** Diga **empacotador**, **compilador** ou **gerenciador de pacotes** — e, quando souber, o nome dela (esbuild, TypeScript, npm). Nunca uma perífrase solta como "a etapa de montagem", que não diz qual ferramenta é nem onde fica a configuração dela.

14. **Cada linha de árvore se explica sozinha.** Ao desenhar uma árvore de pastas — aqui, em `Convenções.md` ou em qualquer registro —, cada linha diz o que a pasta guarda. Um símbolo ou uma palavra solta nunca é a explicação inteira.

### 14.1 A pasta que ninguém previu

Quando o Chrome ou uma ferramenta exigir uma pasta que esta referência não previu:

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
| arquivo de entrada | **Nunca** — o Chrome carrega cada contexto |
| `CLAUDE.md` | **Sempre** — as regras que a IA lê |
| `Program/` | **Sempre** |
| `Workshop/` | **Sempre** — é onde mora o empacotador, ou o script que monta o pacote |
| `Distribution/` | **Sempre** — é o pacote que o Chrome carrega — ver 2.1, acima |
| `Files/` | **Nunca** — o trabalho é do site visitado — ver 11 |

O resto do que pode ficar na raiz, e por quê, está na tabela 2.2.

### Em Program/

| Item | Existe quando |
|---|---|
| `manifest.json` | **Sempre** — a fonte do manifesto, versão 3 — ver 4 |
| `Code/` | **Sempre** |
| `Assets/` | **Sempre**, pelos ícones que o manifesto lista — ver 7 |
| `External/` | Há biblioteca ou modelo de IA que você colou à mão — ver 9.2 |
| `Dependencies/` | **Nunca** — a pasta do npm mora em `Workshop/` — ver 9.3 |
| `Internal/` | **Nunca como pasta** — vira o armazenamento do Chrome — ver 10 |

### Em Code/ — os contextos

| Pasta | Existe quando |
|---|---|
| `service-worker/` | Há evento a tratar, coordenação ou chamada externa — quase sempre |
| `content-scripts/` | A extensão age dentro da página visitada |
| `popup/` | Há janelinha no ícone da barra |
| `options/` | O usuário escolhe alguma coisa |

### Em Code/ — o resto

| Pasta | Existe quando |
|---|---|
| `frontend/` | **Nunca** — a tela mora em `popup/` e `options/` |
| `backend/` | Há lógica que não é tela nem evento — costuma ser pequena |
| `clients/` | A extensão chama serviço externo — só domínio declarado no manifesto — ver 6.8 |
| `server/` | **Nunca** |
| `utils/` | Há função usada em 2+ lugares |
| `constants/` | Há valor fixo em 2+ arquivos, ou padrão de fábrica |
| `types/` | Há dado que atravessa contextos — o formato das mensagens |
| `locales/` | A extensão tem 2+ idiomas — a fonte; o empacotador escreve `_locales/` — ver 6.9 |
| `prompts/` | A extensão conversa com modelo de linguagem — com a chave de quem? — ver 6.10 |

### Em Workshop/

| Item | Existe quando |
|---|---|
| `tests/` | Há teste escrito — incluindo o de morte do service worker — ver 8.1 |
| `scripts/` | Sempre que há empacotador, empacotamento ou publicação — ver 8.2 |
| `package.json` · `node_modules/` | Há npm — ver 9.3 |
| configuração do empacotador | Há empacotador (esbuild, Vite, webpack) |
| `tsconfig.json` | O código é TypeScript |
| cache das ferramentas | O empacotador ou o compilador guarda cache — ver 10.3 |
| `.env.example` · `.env` | O desenvolvimento usa variáveis de ambiente |

### Em Distribution/

| Item | Existe quando |
|---|---|
| `manifest.json` | **Sempre** — copiado de `Program/` |
| `_locales/` | A extensão tem 2+ idiomas — escrito a partir de `Program/Code/locales/` |
| o código montado | **Sempre** |
| `icons/` | **Sempre** — copiados de `Program/Assets/icons/` |

### No lugar de Internal/ e de Files/

| Item | Existe quando |
|---|---|
| armazenamento local | Há cache, dado de trabalho ou chave do usuário — ver 10 |
| armazenamento sincronizado | Há preferência pequena que deve seguir o usuário — nada sensível, ver 13.1, acima |
| exportar | A extensão acumula trabalho que o usuário lamentaria perder — ver 11 |

---

## 16. Pares que se confundem

| | |
|---|---|
| **`Program/` × `Distribution/`** | A fonte, que você edita × o pacote, que o Chrome carrega |
| **`Program/manifest.json` × `Distribution/manifest.json`** | Onde você edita a versão × a cópia que o empacotador põe na raiz do pacote |
| **`Code/locales/` × `_locales/`** | A fonte dos textos traduzidos × o que o empacotador escreve na raiz do pacote |
| **`Workshop/` × `Distribution/`** | Onde fica o empacotador e a configuração dele × onde fica o que ele produz |
| **`External/` × `Workshop/node_modules/`** | Você colou à mão × o npm instalou, e o empacotador levou para dentro do pacote |
| **contexto × módulo** | O ambiente que o navegador liga × a funcionalidade dentro dele |
| **`Code/` × `Assets/`** | O que se escreve × o que se vê ou ouve |
| **`service-worker/` × `popup/`** | Sobrevive ao popup fechar × morre junto com a janelinha |
| **`service-worker/` × `content-scripts/`** | Tem as permissões da extensão × tem as limitações da página |
| **`content-scripts/` × a página** | Seu código, injetado × código dos outros, que pode mexer no seu |
| **`clients/` × `server/`** | Você inicia a conversa × **não existe aqui** |
| **armazenamento local × sincronizado** | Confortável, fica na máquina × apertado, viaja para a conta Google |
| **`constants/` × `config`** | Padrão de fábrica, substituído na atualização × o que o usuário escolheu |
| **`state` × `config`** | A extensão guarda sozinha × o usuário escolheu de propósito |
| **memória × armazenamento** | Some quando o service worker morre × sobrevive |
| **chave do usuário × chave sua** | Pode ficar no armazenamento local × não pode existir: o pacote é aberto |
| **Índice × fonte** | A extensão refaz × precisa de exportação, ou some ao desinstalar |

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

Quando o usuário disser algo como "neste projeto o `prompts/` fica dentro de cada contexto" ou "o módulo X é uma exceção porque…": (1) leia os dois arquivos; (2) decida se é convenção (vale para o projeto inteiro) ou exceção (um caso); (3) veja se já existe algo parecido — refine em vez de duplicar; (4) grave no formato de cinco linhas e mostre o resultado.

### Depois de criar, mover ou dividir

Se a tarefa produziu um desvio novo, registre-o — só o que é **relevante para continuar o desenvolvimento**, nunca o relato do que foi feito.

### O que entra, em que tamanho, e quando cresce

**Filtro:** entra só o que muda uma decisão futura de lugar ou de nome de pasta. Não entra: nota de implementação, trecho de código, o que um comando deve devolver, a história da decisão (mora na discussão, citada). **Teto:** cinco linhas por registro — título · regra ou exceção · onde vale · por quê em uma linha · origem. **Transbordo:** `Convenções.md` ou `Exceções.md` acima de **~20 KB** vira pasta com `Índice - Convenções.md` (ou `- Exceções.md`) mais um arquivo por tema — por pasta do projeto: `Code.md`, `Workshop.md`, `Distribution.md`, … — e a consulta passa a ler o índice e abrir só o tema da tarefa. Ao encontrar um arquivo acima do limite, proponha ao usuário reparti-lo — e não faça sem ele.
