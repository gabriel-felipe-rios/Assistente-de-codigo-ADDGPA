---
name: arquitetura-modular-desktop
description: Referência completa da AMF (Arquitetura Modular por Features) na versão programa de desktop — diz em que pasta cada arquivo mora, como nomear pasta e arquivo, e o que cada área guarda. É a versão certa para programa que a pessoa instala e abre no computador dela, sem empacotador, em qualquer linguagem. Use SEMPRE antes de criar, mover, renomear ou deletar qualquer arquivo ou pasta deste projeto, mesmo que o usuário não peça para "seguir a arquitetura". Antes dela, leia os desvios registrados em "Saída das skills/Arquitetura modular/Exceções.md" e "Convenções.md" — um desvio do projeto sempre vence a regra genérica.
---

# AMF — Arquitetura Modular por Features — Referência Completa

Este arquivo é a referência genérica da AMF, igual para todos os projetos e para qualquer linguagem de programação. Leia-o antes de criar, mover, renomear ou deletar qualquer arquivo ou pasta — mas primeiro confira os desvios deste projeto em `Saída das skills/Arquitetura modular/` (seção 17): um desvio registrado sempre vence a regra genérica. Se a pasta não existir, a seção 17 diz como criá-la.

---

## 0. A regra da raiz — o que a plataforma manda

**Onde a plataforma manda, ela vence.** A AMF se aplica no espaço livre que sobra.

No desktop, quase nada é imposto: não há loja, não há manifesto, não há hospedeiro que exija pasta com nome fixo. Por isso esta é a variação em que a AMF organiza a raiz quase inteira. O pouco que outra ferramenta exige — o `CLAUDE.md` do assistente, a `.git/` do repositório — está listado, com o porquê, na tabela da seção 2.2.

A raiz é o único nível que o usuário vê ao abrir a pasta. Nela ficam o arquivo que ele clica, as quatro pastas de nível 1 e o que a tabela 2.2 lista. **Todo o resto mora dentro de uma das quatro pastas.**

---

## 1. Os baldes

Toda pasta deste projeto pertence a um destes baldes. Antes de criar qualquer coisa, descubra em qual ela cai — isso resolve a maioria das dúvidas sozinho.

| Balde | Critério | Se apagar |
|---|---|---|
| **`Program/`** | Eu escrevi · é o programa · Ctrl+C aqui e ele funciona em outro lugar | O programa para |
| ↳ `Code/` | Só código, e nada mais · roda quando o app roda | O programa para |
| ↳ `Assets/` | Eu fiz ou escolhi · não é código · o programa mostra ou toca | O programa fica sem imagem, som ou fonte |
| ↳ `External/` | **Eu colei à mão** · outro escreveu · eu não edito | O programa para (e eu baixo de novo à mão) |
| ↳ `Dependencies/` | **O gerenciador de pacotes instalou** · o programa precisa para rodar | O programa para (e um comando recria) |
| ↳ `Internal/` | O programa escreveu · pode apagar que ele recria | Nada se perde, exceto `credentials/` |
| **`Workshop/`** | Eu escrevi ou instalei · **só eu uso, no desenvolvimento** | O programa continua rodando; eu é que não consigo mais construí-lo |
| **`Distribution/`** | O compilador montou · é o que o outro recebe · só existe quando há compilador | O compilador refaz idêntico |
| **`Files/`** | É o trabalho de quem usa · ninguém encosta | **Perde tudo que foi feito** |

**A pergunta que separa os baldes:** *o que acontece com isso quando eu atualizo o programa?*
`Program/` é substituído, e o `Internal/` dentro dele pode ser descartado · `Workshop/` não vai junto · `Distribution/` é o resultado · `Files/` é intocável.

---

## 2. A árvore completa

Tudo abaixo é **situacional** exceto o arquivo de entrada, `Program/` e `Program/Code/`. Só crie o que o projeto realmente precisa.

São **quatro pastas de nível 1, irmãs**: `Program/`, `Workshop/`, `Distribution/` e `Files/`. Nenhuma fica dentro da outra.

```
[Nome do projeto]/                     A RAIZ
│
├── [Nome do projeto].pyw              o arquivo que você clica para abrir
├── CLAUDE.md                          as regras que a IA lê ao abrir o projeto
├── .claude/   .mcp.json               ⊘ do assistente — não são da AMF
├── ⊘ Saída das skills/                não é da AMF…
│   └── Arquitetura modular/           …EXCETO esta: Convenções.md + Exceções.md
├── ⊘ Saída dos comandos/              não é da AMF
│
├── Program/                           O QUE O PROGRAMA É · nomes SEMPRE em inglês
│   │                                  Ctrl+C aqui e ele funciona em qualquer lugar
│   │
│   ├── Code/                          SÓ código · roda quando o app roda
│   │   ├── frontend/                  as telas, organizadas por MÓDULO
│   │   ├── backend/                   a lógica, organizada por MÓDULO
│   │   ├── clients/                   você liga pra fora
│   │   ├── server/                    ligam pra você
│   │   ├── utils/                     funções reusadas em 2+ lugares
│   │   ├── constants/                 valores fixos + padrões de fábrica
│   │   ├── types/                     a forma dos dados, compartilhada
│   │   ├── locales/                   textos traduzidos
│   │   └── prompts/                   os prompts, uma subpasta por módulo
│   │
│   ├── Assets/                        o que se vê ou ouve · substituído no update
│   │   ├── icons/                     ícones (PNG, SVG)
│   │   ├── images/                    imagens de interface
│   │   ├── fonts/                     fontes
│   │   ├── audio/                     sons
│   │   ├── video/                     vídeos
│   │   └── {tipo}/{módulo}/           quando o recurso é de um módulo só
│   │
│   ├── External/                      SÓ o que você colou à mão · você não edita
│   │   ├── tools/                     executáveis de terceiro
│   │   ├── libraries/                 bibliotecas coladas à mão, sem gerenciador
│   │   ├── runtimes/                  a linguagem embutida
│   │   └── ai-models/                 modelos de IA baixados
│   │
│   ├── Dependencies/                  o que o GERENCIADOR DE PACOTES instalou e que
│   │                                  o programa precisa para RODAR
│   │
│   └── Internal/                      o programa escreveu · pode apagar
│       ├── logs/                      registro do que aconteceu
│       ├── cache/                     resultado guardado · e o cache de ferramenta (pycache…)
│       ├── temp/                      arquivo de uma operação
│       ├── state/                     o que o app lembra sozinho
│       ├── config/                    o que o usuário escolheu
│       ├── queue/                     controle da fila
│       └── credentials/               token e senha
│
├── Workshop/                          SÓ NO DESENVOLVIMENTO · não vai no Ctrl+C de Program/
│   ├── tests/                         testes automáticos · espelha o caminho de Program/Code/
│   ├── scripts/                       compilar · publicar · instalar para teste · backup
│   ├── requirements.txt               a lista de dependências
│   ├── config das ferramentas         do compilador, do executor de testes, do verificador de estilo
│   ├── .env.example  ·  .env          as variáveis do seu ambiente de desenvolvimento
│   └── o ambiente virtual             quando o compilador já levou as bibliotecas para
│                                      dentro do executável — senão, Program/Dependencies/
│
├── Distribution/                      SITUACIONAL · existe quando há COMPILADOR
│                                      o executável que você entrega a outra pessoa
│
└── Files/                             O QUE É DO USUÁRIO · vai pro backup
    ├── projects/                      trabalho em unidades nomeadas
    ├── intake/                        chegou mas ainda não tem dono
    ├── unsorted/                      arquivos soltos
    └── dados.db                       o banco, quando não há projetos
```

`⊘` marca o que está na raiz mas **não é da AMF**: é do assistente de código, e esta referência não organiza, não cria e não cobra nada ali — com a única exceção de `Saída das skills/Arquitetura modular/` (seção 17).

### 2.1 `Distribution/` — quando há compilador

A Desktop **não tem empacotador**, mas **pode ter compilador**: a ferramenta que transforma o programa num executável que roda sem instalar a linguagem — no Python, PyInstaller ou Nuitka; em Go, `go build`; em Rust, `cargo build`. Quando você gera esse executável para entregar a alguém, ele é escrito em `Distribution/`, como em qualquer outra plataforma. O que muda de uma plataforma para outra é só a ferramenta — o destino é o mesmo.

- **Sem compilador**, `Distribution/` não existe: quem recebe o programa recebe a pasta inteira e clica no `[Nome do projeto].pyw`.
- **Com compilador**, a pasta nasce na primeira compilação. O que está nela é **resultado**: o compilador refaz idêntico, então ela nunca se edita à mão e nunca se versiona.
- A configuração do compilador (no PyInstaller, o arquivo `.spec`) e o script que o chama moram em `Workshop/`. Em `Distribution/` fica só o que sai dele.

### 2.2 O que fica na raiz, e por imposição de quem

| O arquivo ou a pasta | Quem obriga | O que quebra se ele sair dali |
|---|---|---|
| `[Nome do projeto].pyw` | nós | o usuário não acha o que clicar, e os caminhos relativos para `Program/` deixam de resolver |
| `CLAUDE.md` | a ferramenta — o Claude Code procura na raiz | a IA abre o projeto sem ler as regras |
| `.claude/` · `.mcp.json` | a ferramenta — o Claude Code, *do assistente, não do programa* | as permissões e os servidores MCP do assistente deixam de carregar |
| `Saída das skills/` · `Saída dos comandos/` | as skills e os comandos — *do assistente, não do programa* | as bases de decisão deixam de ser achadas |
| `Program/` | nós | o arquivo de entrada não acha o código |
| `Workshop/` | nós | nada no programa; os scripts e os testes perdem o caminho de `Program/` |
| `Distribution/` (situacional) | nós | os scripts de compilação escrevem noutro lugar e o executável se perde |
| `Files/` | nós | o programa deixa de achar o trabalho do usuário |
| `.git/` · `.gitignore` · `LICENSE` | o Git e o site onde o repositório mora — *do repositório, não do programa* | o repositório deixa de ser reconhecido, o `.gitignore` deixa de valer para o projeto inteiro, a licença não é exibida |

**O que não está nesta tabela não vai para a raiz.**

> **Quando abrir `referencia.md`** (na mesma pasta desta skill): a tabela rápida da seção 15 responde onde cada coisa fica; quando ela remeter a uma seção ("ver 9.6"), ou quando a dúvida for o **porquê** de uma pasta, o que ela guarda em detalhe ou como se organiza por dentro, abra `referencia.md` na seção indicada. Para "onde fica X?" a tabela basta — não leia a referência inteira por precaução.

---

## 3. Convenção de nomenclatura

### 3.1 A regra de idioma

**Dentro de `Program/`, tudo em inglês.** É código: precisa ser previsível para ferramenta, editor e IA. `frontend`, `backend`, `utils` e `assets` são termos que o mundo inteiro reconhece — traduzir só cria atrito.

**Em `Files/`, o inglês vai até o segundo nível.** As pastas que a skill cria (`Files/`, `projects/`, `intake/`, `unsorted/`) ficam em inglês, porque **o programa referencia esses caminhos no código**.

**A liberdade começa um nível abaixo.** Nome de projeto, nome de etapa, subpasta que o usuário cria — tudo livre, em português, com acento e espaço se quiser. É o trabalho dele, o código não depende disso.

```
Files/projects/Relatórios de vendas/1-baixar-pdf/
└──── inglês ────┘└──────── livre, português ────────┘
```

### 3.2 Maiúsculas

- **Nível 1 e 2** (`Program/`, `Workshop/`, `Distribution/`, `Files/`; `Code/`, `Assets/`, `External/`, `Dependencies/`, `Internal/`) — primeira letra maiúscula, e **sempre o nome completo, nunca abreviado**. São nomes **conceituais**: dizem que tipo de coisa é aquilo.
- **Nível 3 em diante** (`frontend/`, `logs/`, `tools/`, `icons/`) — minúsculas, sem acento, sem espaço, hífen como separador. São nomes **técnicos**: dizem que parte do sistema é aquilo.

A troca de estilo **é** a fronteira entre conceito e implementação.

### 3.3 Arquivos

Tudo minúsculo, sem acento, sem espaço. Sempre começa pelo contexto (módulo ou feature).

- **Hífen (`-`)** separa blocos de conceito principais:
  `clientes-consulta.ts`, `clientes-cadastro.ts`, `clientes-api.ts`
- **Underscore (`_`)** mantém juntas palavras que formam um único conceito composto:
  `conta_a_pagar-consulta.ts`, `codigo_qr-gerador.ts`, `linha_do_tempo-renderizador.ts`
- Sempre começa pelo contexto: `clientes-consulta.ts`, nunca `consulta-clientes.ts`
- Quando o caminho já informa o contexto, não repita no nome: `backend/clientes/consulta.ts` (não `clientes-consulta.ts` dentro da pasta `clientes/`)
- **Arquivo dividido: cada parte leva o nome do original + o que a parte faz.** `arquivos.py` → `arquivos.py` (a casca) + `arquivos_copia.py` + `arquivos_ativacao.py`; `trabalhos.js` → `trabalhos-fluxo.js` + `trabalhos-metricas.js`. **Nunca número** (`-2`, `-parte2`, `-cont`): número diz que o arquivo continua, não diz o quê — e é o que faz alguém abrir três arquivos para achar uma função. Se a parte não tem nome próprio ("é só a continuação da lista"), o corte está no lugar errado: corte por tema (o que as funções têm em comum) ou por quem as usa. **Depois de dividir**, confira que todo nome usado de fora continua acessível — import, export, nome global: a divisão não muda a interface.

### 3.4 Tamanho dos arquivos

**Alvo: até 300 linhas.** Entre **300 e 500** o arquivo está na faixa de folga: divida na próxima vez que mexer nele, **se houver um corte natural** — nunca só para caber. **Acima de 500**, divida agora. Em qualquer caso o corte é por conceito, nunca por número: um arquivo de 520 linhas sem corte natural vira exceção registrada em `Exceções.md`, não um arquivo de 500 mais um de 20. O nome das partes segue a regra da seção 3.3.

---

## 13. Segurança

No desktop o programa roda no computador de quem usa, e a pasta dele pode ser copiada, compartilhada ou publicada inteira. A segurança aqui é saber **o que não pode sair junto** e **o que ninguém pode apagar**.

### 13.1 Credenciais

1. ⚠ **Chave, token e senha moram em `Program/Internal/credentials/`, e nunca em `Code/`, `Assets/` ou `constants/`.** O que está em `Code/` vai junto quando você compartilha a pasta, manda para alguém ou publica num repositório.
2. **O `.env` do desenvolvimento mora em `Workshop/` e nunca se versiona.** O que se versiona é o `.env.example`, com os nomes das variáveis e sem os valores.
3. **`credentials/` é a única parte de `Internal/` que não se recria.** Apagar não quebra o programa, mas obriga a buscar todas as chaves de novo.
4. **Nada de credencial dentro do executável.** O que o compilador põe em `Distribution/` pode ser aberto e lido por quem recebe.

### 13.2 O que é intocável

5. ⚠ **O programa nunca apaga nada em `Files/` sem confirmação explícita** — nem para "limpar", nem para "corrigir". Atualizar ou reinstalar o programa nunca toca nessa pasta.
6. **Banco que é fonte nunca se apaga sozinho** — seção 12 da `referencia.md`. Só o banco que é índice o programa pode reconstruir.

### 13.3 Dependência de terceiro

7. **O que está em `External/` você colou à mão: saiba de onde veio.** Baixe do site oficial do projeto e guarde a versão — é você quem o substitui depois.
8. **O que está em `Dependencies/` sai da lista em `Workshop/`.** Fixe as versões na lista, para que reinstalar traga exatamente o que já foi testado.
9. **Executável de terceiro em `External/tools/` roda com as mesmas permissões do seu programa.** Não cole ali o que você não usaria no seu próprio computador.

---

## 14. Princípios globais

1. **Organize por módulo, nunca por tipo de arquivo.** Tudo do módulo "chat" fica junto — código, estilo, modelo de documento, regra. Uma pasta que junta "todos os temas" ou "todos os modelos" separa o arquivo do código que o usa.

2. **Onde uma coisa fica:** usada por **um** módulo → dentro dele; por **2+**, ou **editada em bloco** → sobe para o nível de `Code/`. Esta regra substitui qualquer lista fixa de pastas.

3. **Nunca criar pastas vazias para manter simetria.** Se `backend/clientes/` existe mas não há tela para clientes, não crie `frontend/clientes/` vazia. A ausência é informativa.

4. **A pasta do esqueleto combinado nasce vazia de propósito; a IA não cria pasta por simetria.** As pastas que o Preparar projeto cria de uma vez — o esqueleto combinado para este tipo de projeto — existem antes do primeiro arquivo, e isso é intencional. O que continua proibido é a IA, no meio de uma tarefa, criar pasta que a tarefa não usa só porque a referência a descreve. A referência diz **onde** cada coisa vai quando existir.

5. **Nunca misturar código com dados gerados.** Substituir `Program/` = atualizar o software sem perder nada do usuário.

6. **`Code/` guarda só código.** Mídia, variável de ambiente, configuração de ferramenta e pasta de dependências nunca entram em `Code/` — vão para `Assets/`, `Workshop/` ou `Dependencies/`.

7. **Caminhos sempre relativos** no arquivo de entrada — o projeto funciona de qualquer pasta do sistema.

8. **Princípio DRY** — se uma função, constante ou tipo aparece em 2+ lugares, ela sobe para `utils/`, `constants/` ou `types/`. Nunca duplicar.

9. **Antes de criar pasta ou arquivo novo**, verificar se já existe local apropriado. A estrutura cresce por extensão, não por duplicação.

10. **Mover ou renomear pasta quebra caminho.** Import, leitura de arquivo, caminho de configuração — depois de mover, procure no código por referências ao caminho antigo e corrija, antes de dar por terminado.

11. **Nomeie a ferramenta antes de falar dela.** Diga **compilador**, **empacotador** ou **gerenciador de pacotes** — e, quando souber, o nome dela (PyInstaller, pip, npm). Nunca uma perífrase solta como "a etapa de montagem", que não diz qual ferramenta é nem onde fica a configuração dela.

12. **Cada linha de árvore se explica sozinha.** Ao desenhar uma árvore de pastas — aqui, em `Convenções.md` ou em qualquer registro —, cada linha diz o que a pasta guarda. Um símbolo ou uma palavra solta nunca é a explicação inteira: quem lê tem só aquela linha na frente.

### 14.1 A pasta que ninguém previu

Quando uma ferramenta exigir uma pasta que esta referência não previu:

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
| `[Nome do projeto].[ext]` | **Sempre** — um só, com o nome do projeto |
| `CLAUDE.md` | **Sempre** — as regras que a IA lê |
| `Program/` | **Sempre** |
| `Workshop/` | Há teste, script, lista de dependências ou configuração de ferramenta |
| `Distribution/` | Há compilador gerando executável para entregar — ver 2.1, acima |
| `Files/` | O programa cria ou consome arquivos do usuário |

O resto do que pode ficar na raiz, e por quê, está na tabela 2.2.

### Em Program/

| Pasta | Existe quando |
|---|---|
| `Code/` | **Sempre** |
| `Assets/` | Há ícone, imagem, fonte, áudio ou vídeo que o programa distribui — ver 7 |
| `External/` | Há algo de terceiro que você colou à mão |
| `Dependencies/` | Há gerenciador de pacotes e o programa precisa das bibliotecas para rodar — ver 9.6 |
| `Internal/` | O programa gera log, cache, estado ou guarda chave |

### Em Code/

| Pasta | Existe quando |
|---|---|
| `frontend/` | Há interface visual |
| `backend/` | Há lógica de processamento |
| `clients/` | Seu código chama serviço externo |
| `server/` | Outro programa chama o seu |
| `utils/` | Há função utilitária usada em 2+ lugares |
| `constants/` | Há valor fixo usado em 2+ arquivos, ou padrão de fábrica |
| `types/` | Há definição de dado compartilhada entre módulos |
| `locales/` | O programa tem 2+ idiomas |
| `prompts/` | O programa conversa com modelo de linguagem — ver 6.10 |

### Em Assets/, External/ e Internal/

| Pasta | Existe quando |
|---|---|
| `Assets/icons/ images/ fonts/ audio/ video/` | Há esse tipo de mídia distribuída com o programa |
| `External/tools/` | O programa chama executável de terceiro |
| `External/libraries/` | Há biblioteca de terceiro colada à mão |
| `External/runtimes/` | A linguagem vai embutida, para rodar sem instalação |
| `External/ai-models/` | Há modelo de IA baixado no projeto |
| `Internal/logs/` | O programa registra o que acontece |
| `Internal/cache/` | Há resultado que vale guardar entre sessões — e o cache de ferramenta (ver 10.2) |
| `Internal/temp/` | Há arquivo intermediário de operação |
| `Internal/state/` | O programa lembra aba, janela ou último caminho |
| `Internal/config/` | Há tela de configuração que o usuário mexe |
| `Internal/queue/` | Há fila de execução com controle próprio |
| `Internal/credentials/` | O programa usa chave, token ou senha — ver 13.1, acima |

### Em Workshop/

| Item | Existe quando |
|---|---|
| `tests/` | Há teste automático escrito |
| `scripts/` | Há automação de compilação, publicação ou manutenção |
| `requirements.txt` (ou a lista da sua linguagem) | Há gerenciador de pacotes — a exceção do Node está em 9.6 |
| configuração das ferramentas | Há compilador, executor de testes ou verificador de estilo configurado |
| `.env.example` · `.env` | O desenvolvimento usa variáveis de ambiente |
| o ambiente virtual | Há compilador que leva as bibliotecas para dentro do executável — ver 9.6 |

### Em Files/

| Pasta | Existe quando |
|---|---|
| `projects/` | O trabalho se divide em unidades nomeadas |
| `1-etapa/`, `2-etapa/`… | O trabalho passa por fases sequenciais |
| `intake/` | Chega material que ainda não pertence a projeto nenhum |
| `unsorted/` | Há arquivos avulsos convivendo com projetos ou etapas |
| `dados.db` | O programa usa banco — ver seção 12 |

---

## 16. Pares que se confundem

| | |
|---|---|
| **`Program/Code/` × `Workshop/`** | Roda quando o app roda × só existe no desenvolvimento |
| **`Code/` × `Assets/`** | O que se escreve × o que se vê ou ouve |
| **`External/` × `Dependencies/`** | Você colou à mão × o gerenciador de pacotes instalou |
| **`Workshop/` × `Distribution/`** | Onde fica o compilador e a configuração dele × onde fica o que ele produz |
| **`Distribution/` × `Files/`** | O que o compilador produz para entregar × o que o usuário produz usando o programa |
| **`Files/` × `Internal/`** | Apagou e o usuário perde trabalho × apagou e o programa só refaz |
| **`clients/` × `server/`** | Você inicia a conversa × o outro inicia |
| **`constants/` × `Internal/config/`** | Padrão de fábrica, vem com o programa × o que o usuário escolheu |
| **`Internal/state/` × `Internal/config/`** | O app guarda sozinho × o usuário escolheu de propósito |
| **`Internal/cache/` × `Internal/temp/`** | Sobrevive a fechar o app × morre com a operação |
| **`tools/` × `runtimes/`** | Faz um trabalho sozinho × executa o seu código |
| **`Files/` etapas × `Internal/queue/`** | Os arquivos (do usuário) × o controle (do programa) |
| **Banco índice × banco fonte** | O programa pode refazer × o programa nunca pode apagar |

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
