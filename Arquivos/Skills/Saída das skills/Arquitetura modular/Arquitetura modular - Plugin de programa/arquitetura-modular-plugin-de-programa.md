---
name: arquitetura-modular-plugin-de-programa
description: Referência completa da AMF (Arquitetura Modular por Features) na versão plugin de programa — o molde genérico para plugin que roda dentro de outro programa (Premiere, Photoshop, DaVinci, Blender, Figma, um editor de código, um programa de escritório). Como cada hospedeiro dita as próprias regras, ela começa por cinco perguntas sobre o hospedeiro, respondidas em Convenções.md antes do primeiro arquivo, e põe a AMF por cima das respostas — diz em que pasta cada arquivo mora, como nomear pasta e arquivo, e o que cada área guarda. Use SEMPRE antes de criar, mover, renomear ou deletar qualquer arquivo ou pasta deste projeto, mesmo que o usuário não peça para "seguir a arquitetura". Antes dela, leia os desvios registrados em "Saída das skills/Arquitetura modular/Exceções.md" e "Convenções.md" — um desvio do projeto sempre vence a regra genérica.
---

# AMF — Arquitetura Modular por Features — Plugin de programa: o molde

Esta é a versão da AMF para **plugin que roda dentro de outro programa** — Premiere, Photoshop, DaVinci, Blender, Figma, um editor de código, um programa de escritório. **Ela não finge conhecer todos eles.** Cada hospedeiro dita o nome do manifesto, o formato do pacote, onde se guarda configuração e o que o plugin pode tocar — e isso muda de um para outro. Por isso esta variação é um **molde**: cinco perguntas sobre o hospedeiro, respondidas antes de começar (seção 0), e a AMF por cima das respostas. Quando o hospedeiro é o Obsidian, a versão certa é a Plugin do Obsidian, que já traz as respostas.

Leia-a antes de criar, mover, renomear ou deletar qualquer arquivo ou pasta — mas primeiro confira os desvios deste projeto em `Saída das skills/Arquitetura modular/` (seção 17): um desvio registrado sempre vence a regra genérica, e é lá que moram as cinco respostas. Se a pasta não existir, a seção 17 diz como criá-la.

**A régua que separa esta skill da versão MCP:**

> **O plugin executa uma função dentro do programa. O MCP expõe o programa para outra coisa conversar com ele.**
>
> Um **plugin** do Premiere que gera legenda com um transcritor é **fechado**: faz o serviço ali e acabou. Um **MCP** do Premiere que fala com um modelo de linguagem para gerar infográficos a partir da legenda é uma **ponte** — ele abre o programa para fora.

Se a dúvida persistir: *o que o seu projeto entrega — um botão que faz algo, ou uma porta para outro programa mandar?* Botão → esta skill. Porta → a versão MCP.

---

## 0. A regra da raiz — o que a plataforma manda: as cinco perguntas

**Onde a plataforma manda, ela vence.** A AMF se aplica no espaço livre que sobra.

Aqui a plataforma é o hospedeiro — e esta referência não sabe qual é. **Antes do primeiro arquivo, responda as cinco perguntas abaixo, lendo a documentação do SDK do hospedeiro, e grave as respostas em `Convenções.md`** (seção 17). Sem elas, as seções seguintes não têm como dizer onde as coisas ficam.

| # | A pergunta | O que a resposta decide |
|---|---|---|
| **1** | **Onde o hospedeiro exige o manifesto, e com que nome exato?** | o nome do arquivo em `Program/`, e para onde o empacotador o copia dentro do pacote — seção 4 da `referencia.md` |
| **2** | **Qual o formato do pacote que ele instala?** | o conteúdo de `Distribution/` — seção 2.1 |
| **3** | **Onde ele deixa guardar configuração, e esse lugar viaja com o usuário?** | o que substitui `Internal/` — seção 10 da `referencia.md` |
| **4** | **O que é "o documento do usuário" aqui, e você pode escrever nele?** | o que substitui `Files/` — seção 11 da `referencia.md` |
| **5** | **O que ele deixa o plugin tocar — disco, rede, outro programa —, e onde isso se pede?** | se há caixa de areia (seção 13.1), se `clients/` e `External/tools/` podem existir, e o que o manifesto precisa pedir — seções 6.5 e 9.2 da `referencia.md` |

A quinta não cabe nas outras quatro: dois hospedeiros com o mesmo manifesto, o mesmo pacote e o mesmo lugar de guardar podem diferir só nela — um deixa tudo que ele próprio pode (os IDEs da JetBrains, WordPress), outro deixa mas exige que o manifesto declare o que se toca, com o motivo (Blender, desde as extensões da 4.2), outro roda o plugin numa caixa de areia e só entrega o que o manifesto pediu (Figma, Photoshop pelo UXP, os suplementos do Office).

**O registro das respostas**, no formato de cinco linhas de `Convenções.md`:

```markdown
## O hospedeiro: [nome do programa, versão mínima suportada]
Regra: manifesto `[nome exato]` na [lugar dentro do pacote] · pacote `[formato]` em Distribution/ · configuração em [lugar] ([viaja / não viaja] com o usuário) · documento: [o que é] — [pode escrever / só lê] · acesso: [disco · rede · outro programa] — [livre / pedido em [onde] / proibido]
Vale em: o projeto inteiro
Por quê: a AMF genérica não conhece este hospedeiro; estas cinco respostas a amarram a ele
Origem: [data] · as cinco perguntas da skill
```

**Depois das respostas, vale o que o hospedeiro manda, sempre:**

1. ⚠ **O pacote vai para a pasta de plugins DELE, no formato DELE** — num lugar que o programa define, não você: uma pasta do sistema ou do perfil, ou dentro do projeto que o usuário abriu (o Godot só carrega plugin de editor de `addons/<nome>/` no projeto). O que você organiza aqui é o projeto de desenvolvimento; o que é instalado é o que o empacotador escreve em `Distribution/`.
2. **A versão do SDK e o formato do pacote são dele** — e mudam quando ele quiser.

A raiz é o único nível que se vê ao abrir a pasta. Nela ficam as quatro pastas de nível 1 e o que a tabela 2.2 lista. **Todo o resto mora dentro de uma das quatro pastas.**

---

## 1. Os baldes

Toda pasta deste projeto pertence a um destes baldes. Antes de criar qualquer coisa, descubra em qual ela cai — isso resolve a maioria das dúvidas sozinho.

| Balde | Critério | Se apagar |
|---|---|---|
| **`Program/`** | Eu escrevi · é o plugin · é a fonte de que o pacote é montado | O empacotador não tem mais o que montar |
| ↳ `Code/` | Só código, e nada mais · roda quando o hospedeiro liga o plugin | O plugin para |
| ↳ `Assets/` | Eu fiz ou escolhi · não é código · o painel mostra ou toca | O plugin fica sem ícone, imagem, som ou fonte |
| ↳ `External/` | **Eu colei à mão** · outro escreveu · eu não edito · aqui mora o **SDK do hospedeiro** | O plugin para (e eu baixo de novo à mão) |
| ↳ `Dependencies/` | **O gerenciador de pacotes instalou** · o plugin precisa para rodar — só quando o hospedeiro carrega as bibliotecas ao rodar | O plugin para (e um comando recria) |
| ↳ `Internal/` | **Não é pasta sua** — vira o lugar que o hospedeiro der para guardar (pergunta 3) | Nada se perde, exceto a credencial, se houver |
| **`Workshop/`** | Eu escrevi ou instalei · **só eu uso, no desenvolvimento** · aqui mora o empacotador | O plugin instalado continua rodando; eu é que não consigo mais montá-lo |
| **`Distribution/`** | O empacotador montou · é o pacote, no formato que o hospedeiro instala (pergunta 2) | O empacotador refaz idêntico |
| **`Files/`** | **Não é pasta do projeto** — o documento aberto é do hospedeiro e do usuário (pergunta 4) | **O usuário perde o trabalho dele** |

**A pergunta que separa os baldes:** *o que acontece com isso quando eu atualizo o plugin?*
`Program/` é a fonte da versão nova · `Workshop/` não vai junto · `Distribution/` é o resultado, e é ele que o hospedeiro instala · o lugar de guardar do hospedeiro sobrevive à atualização · o documento do usuário é intocável.

---

## 2. A árvore completa

Tudo abaixo é **situacional** exceto o manifesto, `Program/Code/`, `Program/External/libraries/` (o SDK) e `Workshop/`. Só crie o que o projeto realmente precisa.

São **quatro pastas de nível 1, irmãs**: `Program/`, `Workshop/`, `Distribution/` e `Files/` — aqui, `Files/` não é pasta do projeto. Nenhuma fica dentro da outra.

Legenda, comparando com a versão Desktop da AMF: `=` igual · `~` existe, mas muda · `→` vira outra coisa · `✖` não existe · `+` é novo aqui. **O símbolo nunca é a explicação inteira** — cada linha diz o que a pasta guarda.

```
[Nome do projeto]/                     A RAIZ
│
✖ arquivo de entrada                   não há o que clicar: o HOSPEDEIRO carrega o plugin
├── CLAUDE.md                          as regras que a IA lê ao abrir o projeto
├── .claude/   .mcp.json               ⊘ do assistente — não são da AMF
├── ⊘ Saída das skills/                não é da AMF…
│   └── Arquitetura modular/           …EXCETO esta: Convenções.md + Exceções.md
│                                      — e é nela que moram as cinco respostas
├── ⊘ Saída dos comandos/              não é da AMF
│
├── Program/                           A FONTE DO PLUGIN · nomes SEMPRE em inglês
│   │                                  Ctrl+C aqui e o pacote se monta em qualquer lugar
│   │
│   ├── + o manifesto                  a FONTE, com o nome e o formato que o hospedeiro
│   │                                  dita (pergunta 1) · o empacotador o COPIA para
│   │                                  dentro do pacote
│   │
│   ├── ~ Code/                        SÓ código · roda quando o hospedeiro liga o plugin
│   │   ├── + host-bridge/             A REGRA DE OURO: a ÚNICA camada que conhece a API
│   │   │                              do hospedeiro — ela quebra a cada versão dele
│   │   ├── ~ frontend/                o painel embutido, no formato que o hospedeiro aceita
│   │   ├── ~ backend/                 a lógica de verdade · não sabe quem é o hospedeiro
│   │   ├── ~ clients/                 você liga para fora — se a pergunta 5 deixar,
│   │   │                              e sem travar o programa
│   │   ├── ✖ server/                  não existe: se alguém precisa chamar o programa,
│   │   │                              o projeto é um MCP
│   │   ├── = utils/                   funções reusadas em 2+ lugares
│   │   ├── = constants/               valores fixos + padrões de fábrica
│   │   ├── ~ types/                   a forma dos dados do SEU domínio, que a ponte traduz
│   │   ├── ~ locales/                 textos traduzidos — pelo mecanismo do hospedeiro,
│   │   │                              se ele tiver um
│   │   └── = prompts/                 os prompts, uma subpasta por módulo
│   │
│   ├── ~ Assets/                      o que o painel mostra ou toca · no formato e nos
│   │   └── icons/  images/  fonts/ …  tamanhos que o hospedeiro pede · {tipo}/{módulo}/
│   │
│   ├── ~ External/                    SÓ o que você colou à mão · você não edita
│   │   ├── + libraries/               o SDK do hospedeiro, baixado do fabricante ·
│   │   │                              com a versão anotada
│   │   ├── ~ tools/                   executável de terceiro — se o hospedeiro deixar
│   │   │                              chamar outro programa (pergunta 5)
│   │   ├── ✖ runtimes/                não existe: o hospedeiro é quem roda o seu código
│   │   └── ~ ai-models/               raro: pesa no pacote e na memória DO HOSPEDEIRO
│   │
│   ├── ~ Dependencies/                o que o GERENCIADOR DE PACOTES instalou — só se o
│   │                                  hospedeiro carrega as bibliotecas AO RODAR; se o
│   │                                  empacotador já as leva no pacote, vai para Workshop/
│   │
│   └── → Internal/                    não é pasta sua: é o lugar que o HOSPEDEIRO der
│                                      para guardar (pergunta 3) — referencia.md, seção 10
│
├── ~ Workshop/                        SÓ NO DESENVOLVIMENTO · nada daqui vai no pacote
│   ├── ~ tests/                       espelha o caminho de Program/Code/ · com a ponte
│   │                                  falsa, e em VÁRIAS versões do hospedeiro
│   ├── ~ scripts/                     empacotar no formato do hospedeiro · instalar no
│   │                                  hospedeiro de teste · publicar
│   ├── = a lista de dependências      requirements.txt, package.json… — a exceção do
│   │                                  Node que roda direto está na referencia.md, 9.3
│   ├── + config do empacotador        a do empacotador ou da ferramenta de pacote do
│   │                                  hospedeiro · e a do compilador, se houver
│   ├── + cache das ferramentas        o que o empacotador e o compilador guardam sozinhos
│   ├── = .env.example  ·  .env        as variáveis do seu ambiente de desenvolvimento
│   └── + a pasta de dependências      quando o empacotador já leva as bibliotecas para
│                                      dentro do pacote — senão, Program/Dependencies/
│
├── ~ Distribution/                    O PACOTE, no formato que o hospedeiro instala
│                                      (pergunta 2) · é ele que se instala no hospedeiro
│                                      de teste e que se publica
│
✖ Files/                               não é pasta do projeto: o documento aberto é do
                                       HOSPEDEIRO e do usuário (pergunta 4)
```

`⊘` marca o que está na raiz mas **não é da AMF**: é do assistente de código, e esta referência não organiza, não cria e não cobra nada ali — com a única exceção de `Saída das skills/Arquitetura modular/` (seção 17).

### 2.1 `Distribution/` — o pacote que o hospedeiro instala

**O conteúdo desta pasta é a resposta da pergunta 2.** Cada hospedeiro instala um formato: um arquivo compactado com extensão própria, uma pasta com estrutura fixa, um pacote assinado. O empacotador — a ferramenta de pacote do hospedeiro, quando ele distribui uma, ou o empacotador da linguagem (esbuild, webpack) seguido de um script de compactação — escreve aqui.

- **É o que se instala** na pasta de plugins do hospedeiro de teste, durante o desenvolvimento, e o que se publica na loja ou no repositório dele, quando houver.
- **O manifesto vai dentro**, no lugar que a pergunta 1 respondeu, copiado de `Program/`.
- **É resultado:** o empacotador refaz idêntico. Nunca se edita à mão e nunca se versiona.
- A configuração do empacotador e o script que o chama moram em `Workshop/`. Em `Distribution/` fica só o que sai dele.

**Três formas de pacote que fogem do "um arquivo que se instala":**
- **O hospedeiro não instala código nenhum, só o manifesto.** Nos suplementos do Office, o que se entrega é um pacote com o manifesto e os ícones; o código é uma aplicação web servida por HTTPS, de um servidor seu. `Distribution/` tem então duas saídas — o pacote do manifesto e os arquivos que sobem para o servidor —, e o endereço do servidor entra na resposta da pergunta 2.
- **Não há arquivo de pacote: o hospedeiro lê o manifesto e os arquivos que ele aponta.** No Figma, o manifesto diz, por caminho relativo, onde está o código montado; no desenvolvimento, importa-se o manifesto, e a publicação sobe tudo pelo próprio programa. `Distribution/` guarda o código montado e a cópia do manifesto, lado a lado, com os caminhos que ele declara.
- **O pacote é instalado dentro do projeto do usuário**, não numa pasta do programa: o plugin de editor do Godot em `addons/<nome>/`, o pacote do Unity com o `package.json` na raiz dele. O que se entrega é a pasta com essa estrutura, e ela passa a morar no trabalho do usuário — que continua sendo dele (seção 11 da `referencia.md`).

### 2.2 O que fica na raiz, e por imposição de quem

| O arquivo ou a pasta | Quem obriga | O que quebra se ele sair dali |
|---|---|---|
| `CLAUDE.md` | a ferramenta — o Claude Code procura na raiz | a IA abre o projeto sem ler as regras |
| `.claude/` · `.mcp.json` | a ferramenta — o Claude Code, *do assistente, não do programa* | as permissões e os servidores MCP do assistente deixam de carregar |
| `Saída das skills/` · `Saída dos comandos/` | as skills e os comandos — *do assistente, não do programa* | as bases de decisão — e as cinco respostas — deixam de ser achadas |
| `Program/` | nós | o empacotador não acha a fonte |
| `Workshop/` | nós | nada no plugin; os scripts, os testes e a configuração do empacotador perdem o caminho de `Program/` |
| `Distribution/` | nós | os scripts de instalação e de publicação procuram o pacote noutro lugar |
| `.git/` · `.gitignore` · `LICENSE` | o Git e o site onde o repositório mora — *do repositório, não do programa* | o repositório deixa de ser reconhecido, o `.gitignore` deixa de valer para o projeto inteiro, a licença não é exibida |

O manifesto não está nesta tabela: o hospedeiro o exige **dentro do pacote**, não na raiz do projeto. Se a resposta da pergunta 1 disser que um arquivo precisa mesmo ficar na raiz do projeto, ele entra nesta tabela pelo registro em `Exceções.md`, com o que quebra se sair dali.

**O que não está nesta tabela não vai para a raiz.**

> **Quando abrir `referencia.md`** (na mesma pasta desta skill): a tabela rápida da seção 15 responde onde cada coisa fica; quando ela remeter a uma seção ("ver 6.8"), ou quando a dúvida for o **porquê** de uma pasta, o que ela guarda em detalhe ou como se organiza por dentro, abra `referencia.md` na seção indicada. Para "onde fica X?" a tabela basta — não leia a referência inteira por precaução.

---

## 3. Convenção de nomenclatura

### 3.1 A regra de idioma

**Dentro de `Program/`, tudo em inglês.** É código: precisa ser previsível para ferramenta, editor e IA.

**Nos nomes impostos pelo hospedeiro, vale o que ele exige** — o manifesto, as pastas que o formato do pacote define, os nomes que o SDK espera encontrar. Não é escolha sua, e por isso não é violação.

**O que o usuário lê é conteúdo**, não código: nome do painel, rótulo do botão, texto de aviso. Podem estar em qualquer idioma.

### 3.2 Maiúsculas

- **Nível 1 e 2** (`Program/`, `Workshop/`, `Distribution/`; `Code/`, `Assets/`, `External/`, `Dependencies/`) — primeira letra maiúscula, e **sempre o nome completo, nunca abreviado**. São nomes **conceituais**: dizem que tipo de coisa é aquilo.
- **Nível 3 em diante** (`host-bridge/`, `frontend/`, `backend/`, `libraries/`) — minúsculas, sem acento, sem espaço, hífen como separador. São nomes **técnicos**: dizem que parte do sistema é aquilo.

A troca de estilo **é** a fronteira entre conceito e implementação.

### 3.3 Arquivos

Tudo minúsculo, sem acento, sem espaço. Sempre começa pelo contexto (módulo ou feature).

- **Hífen (`-`)** separa blocos de conceito principais: `legenda-gerador.ts`, `legenda-painel.ts`
- **Underscore (`_`)** mantém juntas palavras de um único conceito composto: `linha_do_tempo-leitor.ts`
- Sempre começa pelo contexto; quando o caminho já informa, não repita: `backend/legenda/gerador.ts`
- **Arquivo dividido: cada parte leva o nome do original + o que a parte faz.** `arquivos.py` → `arquivos.py` (a casca) + `arquivos_copia.py` + `arquivos_ativacao.py`; `trabalhos.js` → `trabalhos-fluxo.js` + `trabalhos-metricas.js`. **Nunca número** (`-2`, `-parte2`, `-cont`): número diz que o arquivo continua, não diz o quê — e é o que faz alguém abrir três arquivos para achar uma função. Se a parte não tem nome próprio ("é só a continuação da lista"), o corte está no lugar errado: corte por tema (o que as funções têm em comum) ou por quem as usa. **Depois de dividir**, confira que todo nome usado de fora continua acessível — import, export, nome global: a divisão não muda a interface.

**Exceção:** arquivos cujo nome o hospedeiro impõe ficam exatamente como ele exige.

### 3.4 Tamanho dos arquivos

**Alvo: até 300 linhas.** Entre **300 e 500** o arquivo está na faixa de folga: divida na próxima vez que mexer nele, **se houver um corte natural** — nunca só para caber. **Acima de 500**, divida agora. Em qualquer caso o corte é por conceito, nunca por número: um arquivo de 520 linhas sem corte natural vira exceção registrada em `Exceções.md`, não um arquivo de 500 mais um de 20. O nome das partes segue a regra da seção 3.3.

### 3.5 Caminhos relativos, sempre

Nada de caminho absoluto. Aqui isso é crítico por dois motivos: **o plugin é instalado numa pasta do sistema que você não escolhe**, e ela é diferente em cada máquina e em cada versão do hospedeiro. E o caminho do documento aberto é do usuário — se ele existir, vem do hospedeiro, pela ponte.

---

## 13. Segurança

Um plugin tem uma exposição que quase nenhuma outra plataforma tem: **ele roda dentro do programa em que o usuário está trabalhando** — e, na maioria dos hospedeiros, com os privilégios dele.

### 13.1 Privilégios — a pergunta 5

1. ⚠ **Sem caixa de areia, você roda com os privilégios do hospedeiro.** É o caso comum (Blender, os IDEs da JetBrains, o editor de código na máquina, WordPress): tudo que o programa pode fazer na máquina do usuário, o seu código pode — ler o disco, alterar arquivos, abrir rede —, e a responsabilidade é sua. **Com caixa de areia** (Figma, Photoshop pelo UXP, os suplementos do Office), o plugin só recebe o que o manifesto pediu: peça o mínimo, e só o que o plugin usa — cada pedido é uma porta a mais, e o usuário vê a lista.
2. **O SDK em `External/libraries/` é código de terceiro que você não auditou**, e ele roda com esses mesmos privilégios. Pegue-o só da fonte oficial, anote a versão e atualize com atenção.
3. **A mesma regra vale para toda dependência.** Poucas, conhecidas, com as versões fixas na lista — cada uma herda o acesso do hospedeiro.

### 13.2 Credenciais

4. ⚠ **O pacote instalado pode ser aberto e lido.** Nada de chave sua dentro de `Distribution/`. Se o plugin precisa de credencial, ela é do usuário, guardada no cofre do sistema (seção 10 da `referencia.md`).
5. **O `.env` do desenvolvimento mora em `Workshop/` e nunca se versiona** — e o empacotador nunca embute o valor dele no pacote. O que se versiona é o `.env.example`, com os nomes das variáveis e sem os valores.

### 13.3 O documento do usuário

6. ⚠ **O conteúdo do documento não sai da máquina sem o usuário saber.** É o trabalho dele, muitas vezes sob contrato ou sob sigilo. Se o plugin manda algo para fora, isso precisa estar dito, ser opcional e ser desligável.
7. **O conteúdo do documento é entrada.** Nome de arquivo, metadado, texto — tudo pode ter qualquer coisa dentro, inclusive conteúdo preparado para atrapalhar o seu processamento ou o modelo que você chama.
8. **Não trave o hospedeiro.** Um programa congelado leva o usuário a matar o processo, e aí ele perde o trabalho que não tinha salvo.

---

## 14. Princípios globais

1. **Onde a plataforma manda, ela vence.** Manifesto, formato do pacote, pasta de instalação e o que o plugin pode tocar são do hospedeiro — e as cinco respostas vêm antes do primeiro arquivo.

2. **A fonte mora em `Program/`, o pacote em `Distribution/`.** Edita-se só a fonte; o hospedeiro instala só o pacote.

3. **A REGRA DE OURO: só `host-bridge/` conhece a API do hospedeiro.** Ela quebra a cada versão do programa; concentrada, quebra em um lugar só.

4. **`host-bridge/` não é `clients/`:** falo com quem me hospeda, de dentro dele × ligo para um serviço lá fora.

5. **`backend/` não sabe quem é o hospedeiro** — é o que sobrevive à próxima versão, e o que se testa.

6. **A ponte traduz para o seu domínio**, não repete os nomes da API dele.

7. **Organize por módulo, nunca por tipo de arquivo.**

8. **Onde uma coisa fica:** usada por **um** módulo → dentro dele; por **2+**, ou **editada em bloco** → sobe para o nível de `Code/`.

9. **Tudo que o plugin registra, ele desfaz** ao desligar.

10. **O plugin se encaixa na interface do hospedeiro**, não constrói outra por cima.

11. **O documento é do usuário:** alteração passa pelo desfazer do programa, nunca salvar por conta própria, alteração em massa avisa antes.

12. **Teste em várias versões do programa hospedeiro.**

13. **Nunca criar pastas vazias para manter simetria.** A ausência é informativa.

14. **A pasta do esqueleto combinado nasce vazia de propósito; a IA não cria pasta por simetria.** As pastas que o Preparar projeto cria de uma vez existem antes do primeiro arquivo, e isso é intencional. O que continua proibido é a IA, no meio de uma tarefa, criar pasta que a tarefa não usa só porque a referência a descreve.

15. **`Code/` guarda só código.** Mídia, variável de ambiente, configuração de ferramenta e pasta de dependências nunca entram em `Code/` — vão para `Assets/`, `Workshop/` ou `Dependencies/`.

16. **Princípio DRY** — função, constante ou tipo que aparece em 2+ lugares sobe para `utils/`, `constants/` ou `types/`.

17. **Mover ou renomear pasta quebra caminho.** Import, a configuração do empacotador, o manifesto — depois de mover, procure pelas referências ao caminho antigo e corrija, antes de dar por terminado.

18. **Nomeie a ferramenta antes de falar dela.** Diga **empacotador**, **compilador** ou **gerenciador de pacotes** — e, quando souber, o nome dela (a ferramenta de pacote do hospedeiro, esbuild, npm, pip). Nunca uma perífrase solta como "a etapa de montagem", que não diz qual ferramenta é nem onde fica a configuração dela.

19. **Cada linha de árvore se explica sozinha.** Ao desenhar uma árvore de pastas — aqui, em `Convenções.md` ou em qualquer registro —, cada linha diz o que a pasta guarda. Um símbolo ou uma palavra solta nunca é a explicação inteira.

### 14.1 A pasta que ninguém previu

Quando o hospedeiro ou uma ferramenta exigir uma pasta que esta referência não previu — e, num molde, isso é o normal:

| Se ela é… | Vai para |
|---|---|
| da ferramenta ou do ambiente | `Workshop/` |
| parte do produto que você escreve | `Program/` |
| parte do pacote entregue | `Distribution/` |
| **em nenhuma hipótese** | **dentro de `Code/`** |

E registre a decisão em `Convenções.md`, em cinco linhas, para não ser rediscutida na próxima vez.

---

## 15. Tabela de referência rápida

### Antes de tudo

| Item | Existe quando |
|---|---|
| as cinco respostas em `Convenções.md` | **Sempre**, antes do primeiro arquivo — ver 0, acima |

### Na raiz

| Item | Existe quando |
|---|---|
| arquivo de entrada | **Nunca** — o hospedeiro carrega você |
| `CLAUDE.md` | **Sempre** — as regras que a IA lê |
| `Program/` | **Sempre** |
| `Workshop/` | **Sempre** — empacotar no formato do hospedeiro não é opcional |
| `Distribution/` | O hospedeiro instala um pacote — quase sempre — ver 2.1, acima |
| `Files/` | **Nunca** — o documento é do hospedeiro — ver 11 |

O resto do que pode ficar na raiz, e por quê, está na tabela 2.2.

### Em Program/

| Item | Existe quando |
|---|---|
| o manifesto | **Sempre** — com o nome da pergunta 1 — ver 4 |
| `Code/` | **Sempre** |
| `Assets/` | Há ícone, imagem, fonte ou som que o painel usa — ver 7 |
| `External/libraries/` | **Sempre** — é onde mora o SDK do hospedeiro, com a versão anotada — ver 9.2 |
| `External/tools/` | O hospedeiro deixa chamar outro programa — a pergunta 5 diz — ver 9.2 |
| `External/runtimes/` | **Nunca** — o hospedeiro é quem roda o seu código |
| `External/ai-models/` | Raro — pesa na memória do hospedeiro |
| `Dependencies/` | Há gerenciador de pacotes **e** o hospedeiro carrega as bibliotecas ao rodar — ver 9.3 |
| `Internal/` | **Nunca como pasta** — o lugar é o da pergunta 3 — ver 10 |

### Em Code/

| Pasta | Existe quando |
|---|---|
| `host-bridge/` | **Sempre** — nenhum outro arquivo fala com o hospedeiro |
| `frontend/` | O plugin tem painel ou diálogo — no formato dele |
| `backend/` | Há lógica de verdade — e ela não conhece o hospedeiro |
| `clients/` | O plugin chama serviço externo, e a pergunta 5 deixa sair para a rede — sem travar o programa — ver 6.5 |
| `server/` | **Nunca** — se alguém precisa chamar o programa, é um MCP |
| `utils/` | Há função usada em 2+ lugares |
| `constants/` | Há valor fixo em 2+ arquivos, ou padrão de fábrica |
| `types/` | **Quase sempre** — é o formato do seu domínio, que a ponte traduz |
| `locales/` | O plugin tem 2+ idiomas — pelo mecanismo do hospedeiro, se houver |
| `prompts/` | O plugin conversa com modelo de linguagem — com a chave de quem? — ver 6.8 |

### Em Workshop/

| Item | Existe quando |
|---|---|
| `tests/` | Há teste escrito — com a ponte falsa, e em várias versões do hospedeiro — ver 8.1 |
| `scripts/` | **Sempre** — empacotar, instalar para teste, publicar — ver 8.2 |
| a lista de dependências | Há gerenciador de pacotes — ver 9.3 |
| a pasta de dependências | O empacotador já leva as bibliotecas para dentro do pacote — ver 9.3 |
| configuração do empacotador e do compilador | Há empacotador ou compilador configurado |
| cache das ferramentas | O empacotador ou o compilador guarda cache — ver 10.3 |
| `.env.example` · `.env` | O desenvolvimento usa variáveis de ambiente |

### No lugar de Internal/ e de Files/

| Item | Existe quando |
|---|---|
| área de dados do plugin | O plugin lembra ou o usuário escolhe alguma coisa — a pergunta 3 diz onde |
| cofre do sistema | O plugin usa credencial, e o ambiente dá acesso a ele — ver 13.2, acima |
| painel de log do hospedeiro | **Sempre** — é onde o usuário vai olhar |
| o documento do usuário | É do hospedeiro — a pergunta 4 diz se você escreve nele — ver 11 |

---

## 16. Pares que se confundem

| | |
|---|---|
| **plugin × MCP** | Executa uma função dentro do programa × expõe o programa para outra coisa conversar |
| **esta variação × Plugin do Obsidian** | O molde, com as cinco perguntas em aberto × um hospedeiro com as respostas já dadas |
| **`Program/` × `Distribution/`** | A fonte, que você edita × o pacote, no formato que o hospedeiro instala |
| **`Workshop/` × `Distribution/`** | Onde fica o empacotador e a configuração dele × onde fica o que ele produz |
| **`Code/` × `Assets/`** | O que se escreve × o que se vê ou ouve |
| **`host-bridge/` × `clients/`** | Falo com quem me hospeda, de dentro dele × ligo para um serviço lá fora |
| **`host-bridge/` × `backend/`** | Conhece o hospedeiro e quebra com ele × não conhece, sobrevive e se testa |
| **`Code/` × `External/libraries/`** | Você escreveu e mantém × o SDK dele, que você substitui inteiro |
| **`External/` × `Dependencies/`** | Você colou à mão, do fabricante × o gerenciador de pacotes instalou |
| **`tools/` × `runtimes/`** | Faz um trabalho sozinho, se ele permitir × **não existe**: ele é quem roda o seu código |
| **`constants/` × opção do usuário** | Padrão de fábrica, substituído na atualização × o que ele escolheu |
| **`state` × `config`** | O plugin guarda sozinho × o usuário escolheu de propósito |
| **pasta de instalação × área de dados** | Substituída na atualização, não se escreve nela × é onde se guarda |
| **acrescentar × substituir** | Reversível de cabeça × pede confirmação |
| **alterar pelo hospedeiro × alterar direto** | Entra no desfazer dele × o usuário não consegue voltar atrás |
| **índice × fonte** | Pode viver na área do plugin × pertence ao documento do usuário |

---

## 17. A base deste projeto — `Saída das skills/Arquitetura modular/`

Esta referência é genérica. O que é específico deste projeto mora em `Saída das skills/Arquitetura modular/` — `Convenções.md` (o que vale para o projeto inteiro) e `Exceções.md` (um caso que foge do padrão) — e **um desvio registrado ali sempre vence a regra genérica**. O nome da pasta é fixo: `Arquitetura modular`.

**Nesta variação, `Convenções.md` guarda também as cinco respostas sobre o hospedeiro** (seção 0). Elas são o primeiro registro do projeto, e toda consulta começa por elas.

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

Avise o usuário que a base foi criada — e que as cinco perguntas da seção 0 ainda precisam de resposta.

### Registrar um desvio dito em linguagem natural

Quando o usuário disser algo como "neste projeto o `prompts/` fica dentro de cada módulo" ou "o módulo X é uma exceção porque…": (1) leia os dois arquivos; (2) decida se é convenção (vale para o projeto inteiro) ou exceção (um caso); (3) veja se já existe algo parecido — refine em vez de duplicar; (4) grave no formato de cinco linhas e mostre o resultado.

### Depois de criar, mover ou dividir

Se a tarefa produziu um desvio novo, registre-o — só o que é **relevante para continuar o desenvolvimento**, nunca o relato do que foi feito.

### O que entra, em que tamanho, e quando cresce

**Filtro:** entra só o que muda uma decisão futura de lugar ou de nome de pasta. Não entra: nota de implementação, trecho de código, o que um comando deve devolver, a história da decisão (mora na discussão, citada). **Teto:** cinco linhas por registro — título · regra ou exceção · onde vale · por quê em uma linha · origem. **Transbordo:** `Convenções.md` ou `Exceções.md` acima de **~20 KB** vira pasta com `Índice - Convenções.md` (ou `- Exceções.md`) mais um arquivo por tema — por pasta do projeto: `Code.md`, `External.md`, `Distribution.md`, … — e a consulta passa a ler o índice e abrir só o tema da tarefa. Ao encontrar um arquivo acima do limite, proponha ao usuário reparti-lo — e não faça sem ele.
