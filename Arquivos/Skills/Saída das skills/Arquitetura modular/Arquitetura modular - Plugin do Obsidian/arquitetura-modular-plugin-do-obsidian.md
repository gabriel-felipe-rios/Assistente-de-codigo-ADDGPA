---
name: arquitetura-modular-plugin-do-obsidian
description: Referência completa da AMF (Arquitetura Modular por Features) na versão plugin do Obsidian — diz em que pasta cada arquivo mora, como nomear pasta e arquivo, e o que cada área guarda. É a versão certa para plugin do Obsidian, de computador e de celular: cobre o manifesto e o versions.json, o empacotador que monta os três arquivos publicados, o vault de teste, o data.json e as regras de escrever no vault do usuário. Use SEMPRE antes de criar, mover, renomear ou deletar qualquer arquivo ou pasta deste projeto, mesmo que o usuário não peça para "seguir a arquitetura". Antes dela, leia os desvios registrados em "Saída das skills/Arquitetura modular/Exceções.md" e "Convenções.md" — um desvio do projeto sempre vence a regra genérica.
---

# AMF — Arquitetura Modular por Features — Plugin do Obsidian

Esta é a versão da AMF para **plugin do Obsidian**. É a referência genérica, igual para todos os projetos de plugin do Obsidian. Leia-a antes de criar, mover, renomear ou deletar qualquer arquivo ou pasta — mas primeiro confira os desvios deste projeto em `Saída das skills/Arquitetura modular/` (seção 17): um desvio registrado sempre vence a regra genérica. Se a pasta não existir, a seção 17 diz como criá-la.

---

## 0. A regra da raiz — o que a plataforma manda

**Onde a plataforma manda, ela vence.** A AMF se aplica no espaço livre que sobra.

No Obsidian, quem manda é o hospedeiro — e ele manda **no plugin instalado**, não no seu projeto:

1. ⚠ **O que o Obsidian carrega são três arquivos, lado a lado, na pasta do plugin dentro do vault:** `manifest.json`, `main.js` e `styles.css`. Um único `main.js`, com todo o seu código juntado dentro; um único `styles.css`. Faltou o `manifest.json` ou o `main.js`, o plugin nem aparece na lista.
2. **O `manifest.json` declara** o identificador do plugin, o nome, a versão, a **versão mínima do Obsidian** que ele exige, e se ele funciona só no computador ou também no celular.
3. **Exceção de plataforma — o manifesto e o `versions.json` moram na raiz do projeto, não em `Program/`.** O diretório de plugins da comunidade (repositório `obsidianmd/obsidian-releases`) lê o `manifest.json` na raiz do repositório no GitHub, e o Obsidian procura ali o `versions.json` para achar uma versão compatível com quem tem um Obsidian antigo. A fonte fica na raiz; o empacotador copia o `manifest.json` para `Distribution/`. Detalhe na seção 4.1 da `referencia.md`.

**A consequência que muda o desenho:** a estrutura que você organiza aqui **não é a estrutura que o usuário recebe**. Ela existe para você trabalhar; o empacotador (esbuild) achata tudo nos três arquivos, e os escreve em `Distribution/` (seção 2.1). Isso libera a AMF para organizar do jeito certo — e obriga a ter empacotador.

A raiz é o único nível que se vê ao abrir a pasta. Nela ficam as quatro pastas de nível 1 e o que a tabela 2.2 lista. **Todo o resto mora dentro de uma das quatro pastas.**

---

## 1. Os baldes

Toda pasta deste projeto pertence a um destes baldes. Antes de criar qualquer coisa, descubra em qual ela cai — isso resolve a maioria das dúvidas sozinho.

| Balde | Critério | Se apagar |
|---|---|---|
| **`Program/`** | Eu escrevi · é o plugin · é a fonte de que os três arquivos são montados | O empacotador não tem mais o que montar |
| ↳ `Code/` | Só código, e nada mais · vira o `main.js` e o `styles.css` | O plugin deixa de existir |
| ↳ `Assets/` | Eu fiz ou escolhi · não é código · o plugin mostra ou toca | O plugin fica sem imagem, som ou fonte |
| ↳ `External/` | **Eu colei à mão** · outro escreveu · eu não edito · o empacotador junta ao `main.js` | O plugin para (e eu baixo de novo à mão) |
| ↳ `Dependencies/` | **Não existe aqui** — o empacotador junta as bibliotecas ao `main.js`; a pasta do gerenciador de pacotes é do desenvolvimento e mora em `Workshop/` | — |
| ↳ `Internal/` | **Não é pasta em disco** — vira o `data.json` que o Obsidian guarda por você, dentro do vault | O usuário perde o que escolheu nas opções |
| **`Workshop/`** | Eu escrevi ou instalei · **só eu uso, no desenvolvimento** · aqui mora o empacotador | O plugin instalado continua rodando; eu é que não consigo mais montá-lo |
| **`Distribution/`** | O empacotador montou · exatamente três arquivos · **é esta pasta que se liga por atalho dentro do vault de teste** | O empacotador refaz idêntica |
| **`Files/`** | **Não é pasta do projeto** — o trabalho do usuário é o vault, que está fora do projeto, e você escreve nele | **Perde tudo que foi feito** |

**A pergunta que separa os baldes:** *o que acontece com isso quando eu atualizo o plugin?*
`Program/` é a fonte da versão nova · `Workshop/` não vai junto · `Distribution/` é o resultado, e são os três arquivos dela que o usuário recebe · o `data.json` sobrevive à atualização · o vault é intocável.

---

## 2. A árvore completa

Tudo abaixo é **situacional** exceto o `manifest.json` da raiz, `Program/Code/`, `Workshop/` e `Distribution/`. Só crie o que o projeto realmente precisa.

São **quatro pastas de nível 1, irmãs**: `Program/`, `Workshop/`, `Distribution/` e `Files/` — aqui, `Files/` não é pasta do projeto. Nenhuma fica dentro da outra.

Legenda, comparando com a versão Desktop da AMF: `=` igual · `~` existe, mas muda · `→` vira outra coisa · `✖` não existe · `+` é novo aqui. **O símbolo nunca é a explicação inteira** — cada linha diz o que a pasta guarda.

```
[Nome do projeto]/                     A RAIZ · um repositório próprio, FORA de qualquer vault
│
✖ arquivo de entrada                   não há o que clicar: o OBSIDIAN carrega o plugin
├── CLAUDE.md                          as regras que a IA lê ao abrir o projeto
├── .claude/   .mcp.json               ⊘ do assistente — não são da AMF
├── ⊘ Saída das skills/                não é da AMF…
│   └── Arquitetura modular/           …EXCETO esta: Convenções.md + Exceções.md
├── ⊘ Saída dos comandos/              não é da AMF
├── + manifest.json                    a FONTE do manifesto: id, versão, versão mínima do
│                                      Obsidian · mora na raiz porque o diretório de plugins
│                                      da comunidade o lê daqui, no GitHub · o empacotador
│                                      COPIA para Distribution/
├── + versions.json                    o mapa versão do plugin × versão mínima do Obsidian ·
│                                      na raiz porque é daqui que o Obsidian o lê para
│                                      oferecer a versão compatível a quem tem Obsidian antigo
│
├── Program/                           A FONTE DO PLUGIN · nomes SEMPRE em inglês
│   │                                  Ctrl+C aqui e o plugin se monta em qualquer lugar
│   │
│   ├── ~ Code/                        SÓ código · vira o main.js e o styles.css
│   │   ├── + commands/                o que aparece na paleta de comandos
│   │   ├── + views/                   os painéis que abrem na lateral
│   │   ├── + settings/                a aba do plugin nas opções do Obsidian
│   │   ├── + host-bridge/             a ÚNICA camada que conhece a API do Obsidian
│   │   ├── ~ frontend/                modais e caixas de confirmação · pequeno
│   │   ├── ~ backend/                 a lógica de verdade do plugin · não conhece o Obsidian
│   │   ├── ~ clients/                 você liga para fora — opcional, visível, desligável
│   │   ├── ✖ server/                  não existe: ninguém liga para um plugin
│   │   ├── = utils/                   funções reusadas em 2+ lugares
│   │   ├── = constants/               valores fixos + padrões de fábrica de settings/
│   │   ├── = types/                   a forma dos dados, compartilhada
│   │   └── = prompts/                 os prompts, uma subpasta por módulo
│   │
│   ├── ~ Assets/                      quase nada: ícone é SVG inline no código · só
│   │                                  imagem, som ou fonte de verdade
│   │
│   ├── ~ External/                    SÓ o que você colou à mão: libraries/ — a biblioteca
│   │                                  colada, que o empacotador junta ao main.js
│   │
│   ├── ✖ Dependencies/                não existe: o empacotador junta as bibliotecas ao
│   │                                  main.js · a pasta do npm mora em Workshop/
│   │
│   └── → Internal/                    não é pasta em disco: vira o data.json que o
│                                      Obsidian guarda DENTRO DO VAULT — referencia.md, 10
│
├── ~ Workshop/                        SÓ NO DESENVOLVIMENTO · nada daqui vai publicado
│   ├── = tests/                       testes automáticos · espelha o caminho de Program/Code/
│   ├── ~ scripts/                     chamar o empacotador · ligar o atalho no vault de
│   │                                  teste · publicar a versão
│   ├── + package.json  node_modules/  a lista e a pasta do npm — o empacotador já junta
│   │                                  as bibliotecas ao main.js
│   ├── + config do empacotador        a do esbuild
│   ├── + tsconfig.json                a do compilador TypeScript
│   ├── + cache das ferramentas        o que o empacotador e o compilador guardam sozinhos
│   └── = .env.example  ·  .env        as variáveis do seu ambiente de desenvolvimento
│
├── ~ Distribution/                    O PLUGIN MONTADO · SEMPRE existe · exatamente três
│   │                                  arquivos · é esta pasta que se liga por atalho
│   │                                  dentro do vault de teste
│   ├── manifest.json                  copiado da raiz pelo empacotador
│   ├── main.js                        todo o seu código, juntado pelo empacotador
│   └── styles.css                     os estilos dos módulos, num arquivo só
│
→ Files/                               não é pasta do projeto: é o VAULT do usuário, fora
                                       do projeto — e você escreve nele
```

`⊘` marca o que está na raiz mas **não é da AMF**: é do assistente de código, e esta referência não organiza, não cria e não cobra nada ali — com a única exceção de `Saída das skills/Arquitetura modular/` (seção 17).

### 2.1 `Distribution/` — os três arquivos

**O empacotador (esbuild) escreve em `Distribution/`, e essa pasta contém exatamente três arquivos:**

| Arquivo | De onde vem |
|---|---|
| `manifest.json` | **copiado** do `manifest.json` da raiz |
| `main.js` | **juntado** pelo empacotador: todo o código de `Program/Code/`, as bibliotecas de `Workshop/node_modules/` e o que estiver em `Program/External/` |
| `styles.css` | **juntado** pelo empacotador a partir dos estilos dos módulos |

**É esta pasta que se liga por atalho dentro do vault de teste** (seção 2.3), e são estes três arquivos que vão anexados a cada versão publicada.

- **É resultado:** o empacotador refaz idêntico. Nunca se edita à mão — a mudança some na próxima montagem — e nunca se versiona.
- Nada além dos três entra aqui. Se o empacotador escreve outra coisa (um mapa de depuração, um cache), aponte-o para `Workshop/`.

### 2.2 O que fica na raiz, e por imposição de quem

| O arquivo ou a pasta | Quem obriga | O que quebra se ele sair dali |
|---|---|---|
| `CLAUDE.md` | a ferramenta — o Claude Code procura na raiz | a IA abre o projeto sem ler as regras |
| `.claude/` · `.mcp.json` | a ferramenta — o Claude Code, *do assistente, não do programa* | as permissões e os servidores MCP do assistente deixam de carregar |
| `Saída das skills/` · `Saída dos comandos/` | as skills e os comandos — *do assistente, não do programa* | as bases de decisão deixam de ser achadas |
| `Program/` | nós | o empacotador não acha a fonte |
| `Workshop/` | nós | nada no plugin; os scripts, os testes e a configuração do empacotador perdem o caminho de `Program/` |
| `Distribution/` | nós — e, dentro dela, o Obsidian | o atalho no vault de teste aponta para uma pasta que não existe mais |
| `manifest.json` · `versions.json` | o Obsidian (diretório de plugins da comunidade) | a loja não acha o plugin / quem instalou não recebe atualização |
| `.git/` · `.gitignore` · `LICENSE` | o Git e o site onde o repositório mora — *do repositório, não do programa* | o repositório deixa de ser reconhecido, o `.gitignore` deixa de valer para o projeto inteiro, a licença não é exibida |

O `manifest.json` da raiz é a fonte; o Obsidian instalado lê a cópia que o empacotador põe ao lado do `main.js`, em `Distribution/`.

**O que não está nesta tabela não vai para a raiz.**

### 2.3 O fluxo de desenvolvimento — repositório separado e vault de teste

O projeto é **um repositório próprio, fora de qualquer vault**. O Obsidian nunca lê a fonte: ele lê os três arquivos de `Distribution/`, por um atalho.

```
[Nome do projeto]/Program/          você edita aqui
        │  o empacotador (esbuild), chamado por Workshop/scripts/, em modo de observação
        ▼
[Nome do projeto]/Distribution/     manifest.json · main.js · styles.css
        ▲
        │  atalho de pasta
[vault de teste]/.obsidian/plugins/[id do plugin]/
```

1. **Crie um vault de teste**, só para desenvolver, com notas de exemplo — inclusive as estranhas (seção 8.1 da `referencia.md`).
2. **Ligue `Distribution/` por atalho dentro dele**, no lugar da pasta do plugin: `.obsidian/plugins/[id do plugin]/`. O atalho é um link de pasta do sistema (no Windows, uma junção: `mklink /J`); o atalho comum do Explorador de Arquivos não serve, porque o Obsidian não o segue.
3. **Deixe o empacotador observando `Program/`**: a cada arquivo salvo, ele reescreve `Distribution/`, e você desativa e reativa o plugin no vault de teste para carregar a versão nova.

⚠ **Use um vault de teste, nunca o seu vault de verdade.** Um plugin em desenvolvimento escreve em notas, e um erro apaga trabalho real.

**O caminho alternativo**, o do exemplo oficial do Obsidian, em uma linha: clonar o repositório direto dentro de `.obsidian/plugins/` do vault de teste — funciona, mas mistura o projeto com o vault.

> **Quando abrir `referencia.md`** (na mesma pasta desta skill): a tabela rápida da seção 15 responde onde cada coisa fica; quando ela remeter a uma seção ("ver 6.10"), ou quando a dúvida for o **porquê** de uma pasta, o que ela guarda em detalhe ou como se organiza por dentro, abra `referencia.md` na seção indicada. Para "onde fica X?" a tabela basta — não leia a referência inteira por precaução.

---

## 3. Convenção de nomenclatura

### 3.1 A regra de idioma

**Dentro de `Program/`, tudo em inglês.** É código: precisa ser previsível para ferramenta, editor e IA.

**Nos nomes impostos pelo hospedeiro, vale o que ele exige** — `manifest.json`, `versions.json`, `main.js`, `styles.css`, e o identificador do plugin. Não é escolha sua, e por isso não é violação.

**O que o usuário lê é conteúdo, não código:** nome de comando, título de painel, rótulo de opção. Podem estar em qualquer idioma.

**E dentro do vault, os nomes são dele.** Nota, pasta, etiqueta — tudo em português, com acento e espaço, do jeito que ele escreveu. Seu código nunca presume formato de nome de nota.

### 3.2 Maiúsculas

- **Nível 1 e 2** (`Program/`, `Workshop/`, `Distribution/`; `Code/`, `Assets/`, `External/`) — primeira letra maiúscula, e **sempre o nome completo, nunca abreviado**. São nomes **conceituais**: dizem que tipo de coisa é aquilo.
- **Nível 3 em diante** (`commands/`, `views/`, `host-bridge/`) — minúsculas, sem acento, sem espaço, hífen como separador. São nomes **técnicos**: dizem que parte do sistema é aquilo.

A troca de estilo **é** a fronteira entre conceito e implementação.

### 3.3 Arquivos

Tudo minúsculo, sem acento, sem espaço. Sempre começa pelo contexto (módulo ou feature).

- **Hífen (`-`)** separa blocos de conceito principais: `indice-gerador.ts`, `indice-comando.ts`
- **Underscore (`_`)** mantém juntas palavras de um único conceito composto: `linha_do_tempo-painel.ts`
- Sempre começa pelo contexto; quando o caminho já informa, não repita: `commands/indice/gerar.ts`
- **Arquivo dividido: cada parte leva o nome do original + o que a parte faz.** `arquivos.py` → `arquivos.py` (a casca) + `arquivos_copia.py` + `arquivos_ativacao.py`; `trabalhos.js` → `trabalhos-fluxo.js` + `trabalhos-metricas.js`. **Nunca número** (`-2`, `-parte2`, `-cont`): número diz que o arquivo continua, não diz o quê — e é o que faz alguém abrir três arquivos para achar uma função. Se a parte não tem nome próprio ("é só a continuação da lista"), o corte está no lugar errado: corte por tema (o que as funções têm em comum) ou por quem as usa. **Depois de dividir**, confira que todo nome usado de fora continua acessível — import, export, nome global: a divisão não muda a interface.

### 3.4 Tamanho dos arquivos

**Alvo: até 300 linhas.** Entre **300 e 500** o arquivo está na faixa de folga: divida na próxima vez que mexer nele, **se houver um corte natural** — nunca só para caber. **Acima de 500**, divida agora. Em qualquer caso o corte é por conceito, nunca por número: um arquivo de 520 linhas sem corte natural vira exceção registrada em `Exceções.md`, não um arquivo de 500 mais um de 20. O nome das partes segue a regra da seção 3.3.

**O `main.js` de `Distribution/` não conta:** ele é escrito pelo empacotador, e é grande por natureza. O limite vale para o que você escreve.

### 3.5 Caminhos relativos, sempre

Nada de caminho absoluto. Aqui isso é mais do que boa prática: **o caminho do vault muda a cada usuário e a cada máquina**, e no celular ele nem é um caminho de sistema de arquivos comum. Todo acesso a arquivo passa pela ponte (seção 6.5 da `referencia.md`), que pergunta ao Obsidian onde as coisas estão.

---

## 13. Segurança

Um plugin do Obsidian tem uma exposição que quase nenhuma outra plataforma tem: **ele lê tudo que a pessoa escreveu, e pode escrever por cima.**

### 13.1 Credenciais

1. ⚠ **Nada de segredo no `data.json`.** Ele fica dentro do vault, e viaja junto com ele para a nuvem do usuário, para o repositório dele, para os computadores dele. Se a pessoa precisa guardar a chave dela ali, diga isso na aba de opções, e ofereça o botão de apagar.
2. **Nada sensível no `main.js`.** O que o empacotador escreve em `Distribution/` é legível: qualquer um abre e lê. Chave sua não pode existir num plugin.
3. **O `.env` do desenvolvimento mora em `Workshop/` e nunca se versiona** — e o empacotador nunca embute o valor dele no `main.js`. O que se versiona é o `.env.example`, com os nomes das variáveis e sem os valores.

### 13.2 O vault é do usuário

4. ⚠ **Nunca apagar ou reescrever nota sem confirmação.** As notas são o trabalho dele — seção 11 da `referencia.md`.
5. **Nunca escrever fora do vault.** O plugin não tem nada a fazer no resto do disco do usuário, e no celular isso nem seria possível.
6. ⚠ **O conteúdo das notas não sai do vault sem o usuário saber.** É o dado mais privado do programa: diário, senha anotada, trabalho não publicado. Se o plugin manda texto para um modelo ou serviço, isso precisa estar dito com todas as letras, ser opcional e ser desligável.
7. **O conteúdo da nota é entrada.** Ela pode ter qualquer coisa dentro, inclusive texto preparado para atrapalhar o seu processamento ou o modelo que você chama.

### 13.3 Dependência de terceiro

8. **Toda biblioteca entra no `main.js`** e roda com o mesmo acesso ao vault que você. Poucas, conhecidas, com as versões fixas no `Workshop/package.json`.
9. **O que está em `External/` você colou à mão: saiba de onde veio.** Baixe do site oficial do projeto e guarde a versão — é você quem o substitui depois.

---

## 14. Princípios globais

1. **Onde a plataforma manda, ela vence.** O plugin instalado são três arquivos, lado a lado; o `manifest.json` declara a versão mínima do Obsidian.

2. **A fonte mora em `Program/` — menos o `manifest.json` e o `versions.json`, que moram na raiz —, os três arquivos em `Distribution/`.** Edita-se só a fonte; o Obsidian carrega só `Distribution/`, pelo atalho no vault de teste.

3. **Só `host-bridge/` conhece a API do Obsidian.** É a regra de ouro desta versão (seção 6.5 da `referencia.md`).

4. **`host-bridge/` não é `clients/`:** falo com quem me hospeda, de dentro do processo dele × ligo para um serviço lá fora.

5. **Organize por módulo, nunca por tipo de arquivo** — dentro de `commands/`, `views/` e `settings/`, que são pontos de entrada do hospedeiro, a regra de módulo volta a valer.

6. **Onde uma coisa fica:** usada por **um** módulo → dentro dele; por **2+**, ou **editada em bloco** → sobe para o nível de `Code/`.

7. **`backend/` não conhece o Obsidian** — é o que o torna testável.

8. **Tudo que o plugin registra, ele desfaz** ao desligar.

9. **O `data.json` viaja com o vault:** nada de segredo, nada de gigante, nada de trabalho do usuário enterrado nele.

10. **O plugin roda em dois lugares** — computador e celular. Isso se isola na ponte.

11. **Nunca criar pastas vazias para manter simetria.** A ausência é informativa.

12. **A pasta do esqueleto combinado nasce vazia de propósito; a IA não cria pasta por simetria.** As pastas que o Preparar projeto cria de uma vez existem antes do primeiro arquivo, e isso é intencional. O que continua proibido é a IA, no meio de uma tarefa, criar pasta que a tarefa não usa só porque a referência a descreve.

13. **`Code/` guarda só código.** Mídia, variável de ambiente, configuração de ferramenta e pasta de dependências nunca entram em `Code/` — vão para `Assets/` ou `Workshop/`.

14. **Princípio DRY** — função, constante ou tipo que aparece em 2+ lugares sobe para `utils/`, `constants/` ou `types/`.

15. **Mover ou renomear pasta quebra caminho.** Import, a configuração do empacotador, o atalho no vault de teste — depois de mover, procure pelas referências ao caminho antigo e corrija, antes de dar por terminado.

16. **Nomeie a ferramenta antes de falar dela.** Diga **empacotador**, **compilador** ou **gerenciador de pacotes** — e, quando souber, o nome dela (esbuild, TypeScript, npm). Nunca uma perífrase solta como "a etapa de montagem", que não diz qual ferramenta é nem onde fica a configuração dela.

17. **Cada linha de árvore se explica sozinha.** Ao desenhar uma árvore de pastas — aqui, em `Convenções.md` ou em qualquer registro —, cada linha diz o que a pasta guarda. Um símbolo ou uma palavra solta nunca é a explicação inteira.

### 14.1 A pasta que ninguém previu

Quando o Obsidian ou uma ferramenta exigir uma pasta que esta referência não previu:

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
| arquivo de entrada | **Nunca** — o Obsidian carrega você |
| `CLAUDE.md` | **Sempre** — as regras que a IA lê |
| `manifest.json` | **Sempre** — id, versão, versão mínima do Obsidian; na raiz porque o diretório da comunidade o lê daqui — ver 4 |
| `versions.json` | O plugin é publicado no diretório da comunidade — na raiz, ver 4.2 |
| `Program/` | **Sempre** |
| `Workshop/` | **Sempre** — sem empacotador não há `main.js` |
| `Distribution/` | **Sempre** — os três arquivos — ver 2.1, acima |
| `Files/` | **Nunca como pasta** — o trabalho do usuário é o vault — ver 11 |

O resto do que pode ficar na raiz, e por quê, está na tabela 2.2.

### Em Program/

| Item | Existe quando |
|---|---|
| `Code/` | **Sempre** |
| `Assets/` | Raro — só se houver imagem, som ou fonte de verdade — ver 7 |
| `External/` | Há biblioteca que você colou à mão — ver 9.2 |
| `Dependencies/` | **Nunca** — a pasta do npm mora em `Workshop/` — ver 9.3 |
| `Internal/` | **Nunca como pasta** — vira o `data.json` — ver 10 |

### Em Code/

| Pasta | Existe quando |
|---|---|
| `commands/` | Há algo a fazer pela paleta — quase sempre |
| `views/` | Há painel na lateral ou aba própria |
| `settings/` | O usuário escolhe alguma coisa |
| `host-bridge/` | **Sempre** — nenhum outro arquivo fala com o Obsidian |
| `frontend/` | Há modal ou elemento fora dos três acima — costuma ser pequeno |
| `backend/` | Há lógica de verdade — e ela não conhece o Obsidian |
| `clients/` | O plugin chama serviço externo — opcional, visível, desligável |
| `server/` | **Nunca** |
| `utils/` | Há função usada em 2+ lugares |
| `constants/` | Há valor fixo em 2+ arquivos, ou padrão de fábrica de `settings/` |
| `types/` | Há dado compartilhado entre módulos |
| `prompts/` | O plugin conversa com modelo de linguagem — com a chave de quem? — ver 6.10 |

### Em Workshop/

| Item | Existe quando |
|---|---|
| `tests/` | Há teste escrito — com a ponte substituída por uma falsa — ver 8.1 |
| `scripts/` | **Sempre** — chamar o empacotador, ligar o atalho, publicar — ver 8.2 |
| `package.json` · `node_modules/` | **Sempre** — o npm instala as definições da API do Obsidian e o empacotador — ver 9.3 |
| configuração do empacotador | **Sempre** — a do esbuild |
| `tsconfig.json` | O código é TypeScript — o caso comum |
| cache das ferramentas | O empacotador ou o compilador guarda cache — ver 10.3 |
| `.env.example` · `.env` | O desenvolvimento usa variáveis de ambiente |

### No lugar de Internal/ e de Files/

| Item | Existe quando |
|---|---|
| `data.json` | O plugin lembra ou o usuário escolhe alguma coisa — viaja com o vault, ver 10 |
| pasta do plugin no vault | O plugin gera notas — com o lugar configurável, ver 11.3 |
| aviso na aba de opções | O plugin guarda chave ou manda conteúdo para fora — ver 13, acima |

---

## 16. Pares que se confundem

| | |
|---|---|
| **`Program/` × `Distribution/`** | A fonte, que você edita × os três arquivos, que o Obsidian carrega |
| **`manifest.json` × `versions.json`** | A versão de agora e a versão mínima do Obsidian × o histórico: que versão do plugin serve para qual Obsidian |
| **`Workshop/` × `Distribution/`** | Onde fica o empacotador e a configuração dele × onde fica o que ele produz |
| **vault de teste × vault de verdade** | Onde o plugin em desenvolvimento roda × onde ele nunca roda antes de publicado |
| **`host-bridge/` × `clients/`** | Falo com quem me hospeda, no mesmo processo × ligo para um serviço lá fora |
| **`Code/` × `Assets/`** | O que se escreve × o que se vê ou ouve |
| **`host-bridge/` × `backend/`** | Conhece o Obsidian × não conhece, e por isso se testa |
| **`commands/` × `views/`** | Dispara e acaba × fica aberto mostrando |
| **`commands/` × `backend/`** | Recebe o disparo × faz o trabalho |
| **`settings/` × `constants/`** | O que o usuário escolheu, no `data.json` × o padrão de fábrica, no código |
| **`state` × `config`** | O plugin guarda sozinho × o usuário escolheu de propósito |
| **`data.json` × nota no vault** | Coisa do plugin, invisível × trabalho do usuário, que sobrevive à desinstalação |
| **índice × fonte** | Pode viver no `data.json` × deve ser nota, no vault |
| **computador × celular** | APIs de arquivo diferentes — isoladas na ponte |
| **acrescentar × substituir** | Reversível de cabeça × pede confirmação |

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

**Filtro:** entra só o que muda uma decisão futura de lugar ou de nome de pasta. Não entra: nota de implementação, trecho de código, o que um comando deve devolver, a história da decisão (mora na discussão, citada). **Teto:** cinco linhas por registro — título · regra ou exceção · onde vale · por quê em uma linha · origem. **Transbordo:** `Convenções.md` ou `Exceções.md` acima de **~20 KB** vira pasta com `Índice - Convenções.md` (ou `- Exceções.md`) mais um arquivo por tema — por pasta do projeto: `Code.md`, `Workshop.md`, `Distribution.md`, … — e a consulta passa a ler o índice e abrir só o tema da tarefa. Ao encontrar um arquivo acima do limite, proponha ao usuário reparti-lo — e não faça sem ele.
