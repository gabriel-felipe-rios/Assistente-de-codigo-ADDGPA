---
name: arquitetura-modular-linha-de-comando
description: Referência completa da AMF (Arquitetura Modular por Features) na versão linha de comando — diz em que pasta cada arquivo mora, como nomear pasta e arquivo, e o que cada área guarda. É a versão certa para ferramenta que se roda digitando um comando no terminal, em qualquer linguagem — com subcomandos, argumentos, saída padrão e código de saída, e com a configuração morando na pasta do usuário. Use SEMPRE antes de criar, mover, renomear ou deletar qualquer arquivo ou pasta deste projeto, mesmo que o usuário não peça para "seguir a arquitetura". Antes dela, leia os desvios registrados em "Saída das skills/Arquitetura modular/Exceções.md" e "Convenções.md" — um desvio do projeto sempre vence a regra genérica.
---

# AMF — Arquitetura Modular por Features — Referência Completa — versão **Linha de comando**

Esta é a versão da AMF para **ferramenta de linha de comando**: um programa que a pessoa roda digitando um comando no terminal — `ferramenta exportar relatorio.csv --formato pdf` —, que faz o trabalho e termina. É a referência genérica, igual para todos os projetos desse tipo e para qualquer linguagem. Leia-a antes de criar, mover, renomear ou deletar qualquer arquivo ou pasta — mas primeiro confira os desvios deste projeto em `Saída das skills/Arquitetura modular/` (seção 17): um desvio registrado sempre vence a regra genérica. Se a pasta não existir, a seção 17 diz como criá-la.

**Três coisas fazem desta plataforma uma plataforma própria:**

1. **A entrada é um comando, não um arquivo clicável.** Quem chama é o terminal — ou outro script. Por isso a raiz não tem arquivo de entrada.
2. **A configuração mora na pasta do usuário, não na do projeto.** A ferramenta é instalada num lugar que pode ser só de leitura e roda a partir de qualquer pasta; o que ela lembra vai para o lugar que o sistema operacional reserva para isso.
3. **A saída padrão é o resultado, e o código de saída vale tanto quanto o texto.** A ferramenta é lida por gente e por outros programas ao mesmo tempo.

---

## 0. A regra da raiz — o que a plataforma manda

**Onde a plataforma manda, ela vence.** A AMF se aplica no espaço livre que sobra.

Na linha de comando, quem manda são três:

1. **O terminal e quem chama a ferramenta.** Ele entrega os argumentos, a pasta atual e as variáveis de ambiente, e lê três respostas: a saída padrão, a saída de erro e o código de saída. A forma dessas três respostas é convenção de todo sistema — seção 13.3.
2. ⚠ **O sistema operacional, que diz onde a configuração mora.** Cada sistema reserva uma pasta do usuário para configuração, cache e registros (seção 10 da `referencia.md`). A ferramenta escreve lá, e nunca na pasta em que foi instalada.
3. **O empacotador, que declara o nome do comando.** No Python, a tabela `[project.scripts]` do `pyproject.toml`; no Node, o campo `bin` do `package.json`; nos compilados (Go, Rust), o nome do executável que o compilador gera. É ali — e não num arquivo na raiz — que o comando ganha nome. **Exceção de plataforma:** o empacotador só enxerga o código que está abaixo da pasta da configuração dele, então o `pyproject.toml` e o `package.json` moram em `Program/`, acima de `Code/` — nunca em `Workshop/` (seção 5.1 da `referencia.md`).

O que a AMF organiza é o resto: todo o `Program/` e todo o `Workshop/`. Esta é a variação com **a raiz mais limpa de todas** — só o `CLAUDE.md` e as pastas de nível 1.

---

## 1. Os baldes

Toda pasta deste projeto pertence a um destes baldes. Antes de criar qualquer coisa, descubra em qual ela cai — isso resolve a maioria das dúvidas sozinho.

| Balde | Critério | Se apagar |
|---|---|---|
| **`Program/`** | Eu escrevi · é o programa · Ctrl+C aqui e ele funciona em outro lugar | O comando para de funcionar |
| ↳ `Code/` | Só código, e nada mais · roda quando o comando roda | O comando para de funcionar |
| ↳ `Assets/` | Eu fiz ou escolhi · não é código · o programa usa no que produz — raro aqui | A ferramenta fica sem a fonte, a imagem ou o som que embute no resultado |
| ↳ `External/` | **Eu colei à mão** · outro escreveu · eu não edito | O comando para (e eu baixo de novo à mão) |
| ↳ `Dependencies/` | **O gerenciador de pacotes instalou** · o programa precisa para rodar direto da pasta | O comando para (e um comando recria) |
| ↳ ✖ `Internal/` | **Não é pasta aqui** — o que o programa escreve vai para a pasta do usuário (seção 10 da `referencia.md`) | — |
| **`Workshop/`** | Eu escrevi ou instalei · **só eu uso, no desenvolvimento** | O comando continua rodando; eu é que não consigo mais testá-lo, empacotá-lo nem publicá-lo |
| **`Distribution/`** | O empacotador ou o compilador montou · é o que o outro instala | O empacotador refaz idêntico |
| ✖ **`Files/`** | **Não existe** — o trabalho de quem usa são os arquivos que passam por argumento (seção 11 da `referencia.md`) | — |

**A pergunta que separa os baldes:** *o que acontece com isso quando eu atualizo a ferramenta?*
`Program/` é substituído · `Workshop/` não vai junto · `Distribution/` é o resultado · a pasta do usuário e os arquivos dele não são tocados.

---

## 2. A árvore completa

Tudo abaixo é **situacional** exceto `Program/`, `Program/Code/`, o ponto de entrada e `Code/commands/`. Só crie o que o projeto realmente precisa.

São **três pastas de nível 1, irmãs**: `Program/`, `Workshop/` e `Distribution/`. Nenhuma fica dentro da outra. A quarta das outras plataformas, `Files/`, não existe aqui.

Legenda — cada linha se compara à árvore genérica da AMF: `=` igual · `~` existe mas muda · `→` vira outra coisa · `✖` não existe · `+` é novo aqui. **O símbolo nunca é a explicação inteira:** cada linha diz, sozinha, o que a pasta guarda.

```
[Nome do projeto]/                         A RAIZ
│
├── ✖ arquivo clicável                     não existe: quem chama é o terminal, pelo nome do
│                                          comando que o empacotador declara
├── CLAUDE.md                              as regras que a IA lê ao abrir o projeto
├── .claude/   .mcp.json                   ⊘ do assistente — não são da AMF
├── ⊘ Saída das skills/                    não é da AMF…
│   └── Arquitetura modular/               …EXCETO esta: Convenções.md + Exceções.md
├── ⊘ Saída dos comandos/                  não é da AMF
│
├── Program/                               O QUE O PROGRAMA É · nomes SEMPRE em inglês
│   │                                      Ctrl+C aqui e ele funciona em qualquer lugar
│   │
│   ├── Code/                              SÓ código · roda quando o comando roda
│   │   ├── + main.[ext]                   o ponto de entrada: lê os argumentos, escolhe o
│   │   │                                  subcomando e devolve o código de saída
│   │   ├── + commands/                    UM ARQUIVO POR SUBCOMANDO — é o "módulo" desta
│   │   │                                  plataforma: lê os argumentos dele, chama o
│   │   │                                  backend e escreve o resultado
│   │   ├── ~ backend/                     a lógica, organizada por MÓDULO — e que não sabe
│   │   │                                  que está numa linha de comando
│   │   ├── = clients/                     você liga pra fora: API, serviço, banco remoto
│   │   ├── = utils/                       funções reusadas em 2+ lugares — inclusive as de
│   │   │                                  escrever na saída padrão e na de erro
│   │   ├── ~ constants/                   valores fixos + padrões de fábrica + a tabela dos
│   │   │                                  códigos de saída
│   │   ├── = types/                       a forma dos dados, compartilhada entre módulos
│   │   ├── = prompts/                     os prompts, uma subpasta por módulo — só se a
│   │   │                                  ferramenta conversa com modelo de linguagem
│   │   ├── = locales/                     as mensagens traduzidas — só com 2+ idiomas
│   │   ├── ✖ frontend/                    não existe: a tela é o terminal
│   │   └── ✖ server/                      não existe: a ferramenta roda, responde e termina;
│   │                                      ninguém fica ligando para ela
│   │
│   ├── + config do empacotador            EXCEÇÃO DE PLATAFORMA · declara o nome do comando e
│   │                                      aponta para Code/ — no Python, o pyproject.toml; no
│   │                                      Node, o package.json. Fica aqui, acima de Code/, porque
│   │                                      o empacotador não empacota o que está fora da pasta
│   │                                      dele (ver 5.1)
│   │
│   ├── ~ Assets/                          RARO · a mídia que a ferramenta embute no que
│   │                                      produz: a fonte de um PDF, o logotipo de um relatório
│   │
│   ├── = External/                        SÓ o que você colou à mão · você não edita
│   │   ├── tools/                         executáveis de terceiro que o comando aciona
│   │   ├── libraries/                     bibliotecas coladas à mão, sem gerenciador
│   │   ├── runtimes/                      a linguagem embutida, para rodar sem instalação
│   │   └── ai-models/                     modelos de IA baixados
│   │
│   ├── ~ Dependencies/                    o que o GERENCIADOR DE PACOTES instalou, quando o
│   │                                      comando roda direto desta pasta — em Node, é o
│   │                                      node_modules/, direto em Program/ (ver 9.6)
│   │
│   └── ✖ Internal/                        não existe como pasta: configuração, cache, estado,
│                                          registros e credenciais vão para a PASTA DO USUÁRIO
│                                          que o sistema operacional reserva (ver 10)
│
├── Workshop/                              SÓ NO DESENVOLVIMENTO · não vai no Ctrl+C de Program/
│   ├── tests/                             testes automáticos · espelha o caminho de Program/Code/
│   ├── scripts/                           empacotar · publicar · instalar para teste — chamam o
│   │                                      empacotador apontando para ../Program
│   ├── config das outras ferramentas      do compilador, do executor de testes, do verificador
│   │                                      de estilo
│   ├── .env.example  ·  .env              as variáveis do seu ambiente de desenvolvimento
│   └── o ambiente virtual                 no Python: as bibliotecas com que você desenvolve e
│                                          testa — quem instala a ferramenta recebe as dela
│
├── ~ Distribution/                        SITUACIONAL · existe quando há EMPACOTADOR ou
│                                          COMPILADOR: o pacote publicável, ou o executável
│
└── ✖ Files/                               não existe: a ferramenta lê o que o argumento aponta
                                           e escreve onde o argumento manda, ou na pasta atual
```

`⊘` marca o que está na raiz mas **não é da AMF**: é do assistente de código, e esta referência não organiza, não cria e não cobra nada ali — com a única exceção de `Saída das skills/Arquitetura modular/` (seção 17).

### 2.1 `Distribution/` — quando há empacotador ou compilador

A ferramenta chega a quem usa de um de dois jeitos, e cada um tem a sua ferramenta:

| Como chega | Quem monta | O que vai para `Distribution/` |
|---|---|---|
| **Pacote publicável** — a pessoa instala com o gerenciador de pacotes da linguagem | o **empacotador**, rodando sobre `Program/`: no Python, `python -m build Program --outdir Distribution`; no Node, dentro de `Program/`, `npm pack --pack-destination ../Distribution` | o pacote (`.whl`, `.tar.gz`, `.tgz`) que se publica no registro |
| **Executável** — a pessoa baixa e roda, sem instalar a linguagem | o **compilador**: PyInstaller ou Nuitka no Python, `go build -o Distribution/…` em Go, `cargo build` em Rust (o script copia o resultado) | o executável, um por sistema operacional |

- **Sem empacotador e sem compilador**, `Distribution/` não existe: a ferramenta roda direto de `Program/Code/` (seção 4.4 da `referencia.md`).
- O que está em `Distribution/` é **resultado**: o empacotador refaz idêntico, então nunca se edita à mão e nunca se versiona.
- A configuração do empacotador mora em `Program/` (seção 5.1 da `referencia.md`); o script que o chama, em `Workshop/scripts/`. **Aponte a saída da ferramenta para `Distribution/`** — quase todas escrevem, se ninguém disser nada, numa pasta própria ao lado da configuração.

### 2.2 O que fica na raiz, e por imposição de quem

| O arquivo ou a pasta | Quem obriga | O que quebra se ele sair dali |
|---|---|---|
| `CLAUDE.md` | a ferramenta — o Claude Code procura na raiz | a IA abre o projeto sem ler as regras |
| `.claude/` · `.mcp.json` | a ferramenta — o Claude Code, *do assistente, não do programa* | as permissões e os servidores MCP do assistente deixam de carregar |
| `Saída das skills/` · `Saída dos comandos/` | as skills e os comandos — *do assistente, não do programa* | as bases de decisão deixam de ser achadas |
| `Program/` | nós — e, dentro dele, o empacotador, que exige a configuração dele acima de `Code/` (seção 5.1 da `referencia.md`) | o comando não tem o que rodar, e o empacotador perde a configuração junto com o código |
| `Workshop/` | nós | nada no comando; os scripts e os testes perdem o caminho de `Program/` |
| `Distribution/` (situacional) | nós | o empacotador escreve noutro lugar e o pacote se perde |
| `.git/` · `.gitignore` · `LICENSE` | o Git e o site onde o repositório mora — *do repositório, não do programa* | o repositório deixa de ser reconhecido, o `.gitignore` deixa de valer para o projeto inteiro, a licença não é exibida |

**Não há arquivo clicável na raiz**, porque quem chama a ferramenta é o terminal, pelo nome do comando. **O que não está nesta tabela não vai para a raiz.**

> **Quando abrir `referencia.md`** (na mesma pasta desta skill): a tabela rápida da seção 15 responde onde cada coisa fica; quando ela remeter a uma seção ("ver 9.6"), ou quando a dúvida for o **porquê** de uma pasta, o que ela guarda em detalhe ou como se organiza por dentro, abra `referencia.md` na seção indicada. Para "onde fica X?" a tabela basta — não leia a referência inteira por precaução.

---

## 3. Convenção de nomenclatura

### 3.1 A regra de idioma

**Dentro de `Program/`, os nomes de pasta são em inglês.** É código: precisa ser previsível para ferramenta, editor e IA. `commands`, `backend`, `utils` e `constants` são termos que o mundo inteiro reconhece — traduzir só cria atrito.

**O nome do comando, dos subcomandos e das opções é texto de interface:** é o que a pessoa digita. Escolha-os pensando em quem digita, e mantenha-os estáveis — seção 3.5.

### 3.2 Maiúsculas

- **Nível 1 e 2** (`Program/`, `Workshop/`, `Distribution/`; `Code/`, `Assets/`, `External/`, `Dependencies/`) — primeira letra maiúscula, e **sempre o nome completo, nunca abreviado**. São nomes **conceituais**: dizem que tipo de coisa é aquilo.
- **Nível 3 em diante** (`commands/`, `backend/`, `tools/`, `tests/`) — minúsculas, sem acento, sem espaço, hífen como separador. São nomes **técnicos**: dizem que parte do sistema é aquilo.

A troca de estilo **é** a fronteira entre conceito e implementação.

### 3.3 Arquivos

Tudo minúsculo, sem acento, sem espaço. Sempre começa pelo contexto (módulo ou feature).

- **Hífen (`-`)** separa blocos de conceito principais:
  `clientes-consulta.py`, `clientes-cadastro.py`, `clientes-api.py`
- **Underscore (`_`)** mantém juntas palavras que formam um único conceito composto:
  `conta_a_pagar-consulta.py`, `codigo_qr-gerador.py`, `linha_do_tempo-renderizador.py`
- Sempre começa pelo contexto: `clientes-consulta.py`, nunca `consulta-clientes.py`
- Quando o caminho já informa o contexto, não repita no nome: `backend/clientes/consulta.py` (não `clientes-consulta.py` dentro da pasta `clientes/`)
- **O arquivo em `commands/` tem o nome do subcomando que ele atende.** `ferramenta exportar` → `commands/exportar.py`. Achar o código de um subcomando fica mecânico.
- **Arquivo dividido: cada parte leva o nome do original + o que a parte faz.** `arquivos.py` → `arquivos.py` (a casca) + `arquivos_copia.py` + `arquivos_ativacao.py`. **Nunca número** (`-2`, `-parte2`, `-cont`): número diz que o arquivo continua, não diz o quê. Se a parte não tem nome próprio, o corte está no lugar errado: corte por tema ou por quem as usa. **Depois de dividir**, confira que todo nome usado de fora continua acessível — import, export, nome global: a divisão não muda a interface.

### 3.4 Tamanho dos arquivos

**Alvo: até 300 linhas.** Entre **300 e 500** o arquivo está na faixa de folga: divida na próxima vez que mexer nele, **se houver um corte natural** — nunca só para caber. **Acima de 500**, divida agora. Em qualquer caso o corte é por conceito, nunca por número: um arquivo de 520 linhas sem corte natural vira exceção registrada em `Exceções.md`. O nome das partes segue a regra da seção 3.3.

### 3.5 O comando, os subcomandos e as opções

- **O nome do comando é o nome do projeto**, em minúsculas, com hífen — `relatorio-vendas`, não `RelatorioVendas` nem `rv`. É declarado na configuração do empacotador (seção 0) e em nenhum outro lugar.
- **Um comando só, com subcomandos**: `relatorio-vendas exportar`, `relatorio-vendas importar`. Não um comando por tarefa.
- **Opção longa com dois hífens e hífen entre as palavras** (`--dry-run`, `--formato`); a curta, de uma letra, só para as mais usadas (`-f`).
- **O nome publicado é interface pública.** Renomear um subcomando ou uma opção quebra o script de quem já usa — igual a renomear uma função. Se precisar mudar, mantenha o nome antigo funcionando e avisando, na saída de erro, que mudou.

---

## 13. Segurança

A ferramenta roda com as permissões de quem a chama, na pasta de quem a chama, e muitas vezes dentro do script de outra pessoa. A segurança aqui é saber **o que não pode vazar**, **o que não pode ser sobrescrito** e **o que não pode travar quem chama**.

### 13.1 Credenciais

1. ⚠ **Chave, token e senha nunca moram em `Code/`, `Assets/` ou `constants/`, e nunca entram como argumento.** O que está em `Code/` vai junto quando o pacote é publicado; o que entra como argumento (`--token abc123`) fica gravado no histórico do terminal e aparece na lista de processos para qualquer usuário da máquina. A credencial chega por **variável de ambiente**, pelo **cofre de senhas do sistema operacional**, ou por um arquivo na pasta de configuração do usuário que só ele pode ler — seção 10.3 da `referencia.md`.
2. **Credencial nunca se escreve na saída padrão, na de erro nem no registro** — nem no modo detalhado, nem na mensagem de erro que mostra a requisição inteira.
3. **O `.env` do desenvolvimento mora em `Workshop/` e nunca se versiona.** O que se versiona é o `.env.example`, com os nomes das variáveis e sem os valores.
4. **Nada de credencial dentro do pacote ou do executável.** O que vai para `Distribution/` pode ser aberto e lido por quem o baixa.

### 13.2 O que é intocável

5. ⚠ **A ferramenta nunca sobrescreve nem apaga um arquivo de quem usa sem que ele peça.** Se o destino que o argumento aponta já existe, ela pergunta (havendo terminal) ou falha com código de saída diferente de zero — e só sobrescreve com uma opção explícita, como `--force`. Isso vale também para "limpar" e "corrigir".
6. **Escreva num arquivo temporário e troque no fim.** Uma ferramenta interrompida no meio (Ctrl+C, falta de energia) nunca pode deixar o arquivo de quem usa pela metade: grave ao lado, com outro nome, e renomeie por cima só quando terminou.
7. **Banco que é fonte nunca se apaga sozinho** — seção 12 da `referencia.md`.

### 13.3 A conversa com quem chama

8. ⚠ **A saída padrão é o resultado. O aviso vai para a saída de erro. O código de saída é uma resposta.** Quem imprime aviso, barra de progresso ou "Pronto!" junto com o dado quebra quem usa a ferramenta dentro de outro script: `ferramenta listar | outra-coisa` recebe o aviso como se fosse dado. Na prática:
   - **saída padrão** — só o que a pessoa pediu: o dado, o arquivo, a lista. Nada mais.
   - **saída de erro** — tudo que é para gente ler: aviso, progresso, pergunta, mensagem de erro.
   - **código de saída** — `0` deu certo; diferente de zero, deu errado. Quem chama decide o que fazer **por ele**, não pelo texto. Os códigos moram numa tabela só, em `constants/` — seção 6.6 da `referencia.md`.
9. ⚠ **Nunca pergunte quando não há terminal.** A ferramenta pode estar rodando dentro de outra — um script, um agendador, um editor. Ali ninguém vai responder, e a pergunta trava tudo para sempre. Antes de perguntar, confira se a entrada é um terminal; se não for, use o padrão, a opção que veio no argumento (`--yes`, `--no-input`) ou falhe com uma mensagem clara na saída de erro.
10. **Cor e animação, só quando a saída é um terminal.** Redirecionada para arquivo ou para outro programa, a saída vai limpa. E respeite a variável `NO_COLOR` quando ela existir.

### 13.4 Dependência de terceiro

11. **O que está em `External/` você colou à mão: saiba de onde veio.** Baixe do site oficial do projeto e guarde a versão.
12. **Fixe as versões na lista de dependências**, para que reinstalar traga exatamente o que já foi testado.
13. **Executável de terceiro em `External/tools/` roda com as permissões de quem chamou a sua ferramenta.** E ao acioná-lo, passe os argumentos como lista, nunca montando uma linha de comando em texto: um nome de arquivo com `;` ou `&` vira outro comando.

---

## 14. Princípios globais

1. **Organize por módulo, nunca por tipo de arquivo.** Nesta plataforma o módulo é o subcomando: tudo do `exportar` fica junto — o arquivo em `commands/`, a lógica em `backend/exportar/`, o modelo de documento que ele preenche.

2. **Onde uma coisa fica:** usada por **um** módulo → dentro dele; por **2+**, ou **editada em bloco** → sobe para o nível de `Code/`. Esta regra substitui qualquer lista fixa de pastas.

3. **Nunca criar pastas vazias para manter simetria.** Se `commands/importar.py` existe mas a lógica cabe nele, não crie `backend/importar/` vazia. A ausência é informativa.

4. **A pasta do esqueleto combinado nasce vazia de propósito; a IA não cria pasta por simetria.** As pastas que o Preparar projeto cria de uma vez existem antes do primeiro arquivo, e isso é intencional. O que continua proibido é a IA, no meio de uma tarefa, criar pasta que a tarefa não usa só porque a referência a descreve.

5. **`backend/` não sabe que está numa linha de comando.** Ele não lê argumento, não escreve na saída, não pergunta nada e não encerra o programa: recebe dados, devolve dados ou levanta erro. Quem conversa com o terminal é `commands/`. Assim a lógica se testa sem terminal e serve, amanhã, a outra casca.

6. **Só o ponto de entrada encerra o programa.** O código de saída sai de um lugar só — o `main` —, a partir do que o subcomando devolveu. Um `exit()` no meio do `backend/` impede o teste e esconde a causa.

7. **Saída padrão, saída de erro e código de saída são três respostas diferentes** — seção 13.3. Na dúvida sobre onde vai um texto: *se outro programa lesse isso como dado, quebraria?* Se sim, vai para a saída de erro.

8. **Nunca pergunte quando não há terminal** — seção 13.3. Toda pergunta tem uma opção que a responde de antemão.

9. **A configuração mora na pasta do usuário, e o caminho dela respeita o que o sistema operacional manda** — seção 10 da `referencia.md`. Nunca na pasta de instalação, nunca na pasta atual.

10. **O argumento vence a configuração, que vence o padrão de fábrica.** A ordem é sempre: opção na linha de comando → variável de ambiente → arquivo de configuração do usuário → padrão de fábrica em `constants/`.

11. **Dois tipos de caminho, duas origens.** O caminho que chega por argumento se resolve **a partir da pasta atual** — é onde a pessoa está. O caminho de um recurso da própria ferramenta (um modelo em `Assets/`, um executável em `External/tools/`) se resolve **a partir do arquivo de código**, nunca da pasta atual, e nunca absoluto.

12. **`Code/` guarda só código.** Mídia, variável de ambiente, configuração de ferramenta e pasta de dependências nunca entram em `Code/` — vão para `Assets/`, `Workshop/` ou `Dependencies/`.

13. **Princípio DRY** — se uma função, constante ou tipo aparece em 2+ lugares, ela sobe para `utils/`, `constants/` ou `types/`. Nunca duplicar.

14. **Antes de criar pasta ou arquivo novo**, verificar se já existe local apropriado. A estrutura cresce por extensão, não por duplicação.

15. **Mover ou renomear pasta quebra caminho.** Import, leitura de arquivo, o caminho que a configuração do empacotador aponta — depois de mover, procure pelas referências ao caminho antigo e corrija, antes de dar por terminado.

16. **Nomeie a ferramenta antes de falar dela.** Diga **empacotador**, **compilador** ou **gerenciador de pacotes** — e, quando souber, o nome dela (pip, npm, PyInstaller, `go build`). Nunca uma perífrase solta como "a etapa de montagem", que não diz qual ferramenta é nem onde fica a configuração dela.

17. **Cada linha de árvore se explica sozinha.** Ao desenhar uma árvore de pastas — aqui, em `Convenções.md` ou em qualquer registro —, cada linha diz o que a pasta guarda. Um símbolo ou uma palavra solta nunca é a explicação inteira: quem lê tem só aquela linha na frente.

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
| `CLAUDE.md` | **Sempre** — as regras que a IA lê |
| `Program/` | **Sempre** |
| `Workshop/` | Há teste, script, configuração de ferramenta de desenvolvimento ou ambiente virtual |
| `Distribution/` | Há empacotador ou compilador gerando pacote ou executável — ver 2.1, acima |
| arquivo clicável | **Nunca** — quem chama é o terminal |
| `Files/` | **Nunca** — ver 11 |

O resto do que pode ficar na raiz, e por quê, está na tabela 2.2.

### Em Program/

| Pasta | Existe quando |
|---|---|
| `Code/` | **Sempre** |
| `Assets/` | A ferramenta embute mídia no que produz — raro, ver 7 |
| `External/` | Há algo de terceiro que você colou à mão |
| `Dependencies/` | A ferramenta roda direto desta pasta e precisa das bibliotecas para isso — ver 9.6 |
| `pyproject.toml` · `package.json` | Há empacotador — é a configuração dele, que declara o nome do comando e contém a lista de dependências; direto em `Program/`, ver 5.1 |
| `node_modules/` | Em Node — direto em `Program/`, ao lado do `package.json`, ver 9.6 |
| `Internal/` | **Nunca** — o que o programa escreve vai para a pasta do usuário, ver 10 |

### Em Code/

| Pasta ou arquivo | Existe quando |
|---|---|
| `main.[ext]` | **Sempre** — o ponto de entrada, ver 4.3 |
| `commands/` | **Sempre** — um arquivo por subcomando, ver 6.2 |
| `backend/` | A lógica de um subcomando não cabe no arquivo dele, ou é usada por 2+ — ver 6.3 |
| `clients/` | Seu código chama serviço externo |
| `utils/` | Há função utilitária usada em 2+ lugares |
| `constants/` | Há valor fixo, padrão de fábrica ou código de saída — ver 6.6 |
| `types/` | Há definição de dado compartilhada entre módulos |
| `prompts/` | A ferramenta conversa com modelo de linguagem — ver 6.8 |
| `locales/` | As mensagens existem em 2+ idiomas |
| `frontend/` · `server/` | **Nunca** — ver 6.9 |

### Em Assets/ e External/

| Pasta | Existe quando |
|---|---|
| `Assets/fonts/ images/ audio/` | A ferramenta embute esse tipo de mídia no que produz |
| `External/tools/` | O comando aciona executável de terceiro |
| `External/libraries/` | Há biblioteca de terceiro colada à mão |
| `External/runtimes/` | A linguagem vai embutida, para rodar sem instalação |
| `External/ai-models/` | Há modelo de IA baixado no projeto |

### Na pasta do usuário — o lugar do `Internal/`

| O que | Existe quando |
|---|---|
| configuração | O usuário escolhe algo que vale para as próximas vezes — ver 10.2 |
| cache | Há resultado que vale guardar entre execuções |
| estado · registro | A ferramenta lembra algo sozinha, ou guarda registro em arquivo |
| credenciais | A ferramenta usa chave, token ou senha — ver 13.1, acima |
| temporário | Há arquivo intermediário de uma execução — vai para a pasta temporária do sistema |

### Em Workshop/

| Item | Existe quando |
|---|---|
| `tests/` | Há teste automático escrito |
| `scripts/` | Há automação de empacotamento, publicação ou instalação para teste |
| configuração das outras ferramentas | Há compilador, executor de testes ou verificador de estilo configurado |
| `.env.example` · `.env` | O desenvolvimento usa variáveis de ambiente |
| o ambiente virtual | Python — ver 9.6 |

### No lugar de Files/

| O que | Onde |
|---|---|
| o arquivo que a ferramenta lê | onde o argumento aponta |
| o arquivo que ela produz | onde o argumento manda, ou na pasta atual |
| o banco | onde o argumento aponta — ver 12 |

---

## 16. Pares que se confundem

| | |
|---|---|
| **`commands/` × `backend/`** | Conversa com o terminal: argumento, saída, código × a lógica, que não sabe que existe terminal |
| **Saída padrão × saída de erro** | O resultado, que outro programa lê × o que é para gente ler: aviso, progresso, pergunta |
| **Código de saída × mensagem de erro** | O que o script de quem chama usa para decidir × o que a pessoa lê para entender |
| **Pasta do usuário × pasta atual** | Onde a ferramenta guarda o que é dela: configuração, cache × onde a pessoa está, e onde o trabalho dela acontece |
| **Argumento × configuração** | Vale para esta execução, e vence × vale para todas, até ser mudada |
| **`constants/` × configuração do usuário** | Padrão de fábrica, vem com a ferramenta × o que o usuário escolheu, na pasta dele |
| **`Program/Code/` × `Workshop/`** | Roda quando o comando roda × só existe no desenvolvimento |
| **`External/` × `Dependencies/`** | Você colou à mão × o gerenciador de pacotes instalou |
| **`Workshop/` × `Distribution/`** | Onde fica o script que chama o empacotador — a configuração dele fica em `Program/` × onde fica o que ele produz |
| **Pacote × executável** | A pessoa instala com o gerenciador de pacotes, que traz as bibliotecas × a pessoa baixa e roda, com tudo dentro |
| **Cache × temporário** | Sobrevive entre execuções, na pasta do usuário × morre com a execução, na pasta temporária do sistema |
| **`tools/` × `runtimes/`** | Faz um trabalho sozinho × executa o seu código |
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

**Filtro:** entra só o que muda uma decisão futura de lugar ou de nome de pasta. Não entra: nota de implementação, trecho de código, o que um comando deve devolver, a história da decisão (mora na discussão, citada). **Teto:** cinco linhas por registro — título · regra ou exceção · onde vale · por quê em uma linha · origem. **Transbordo:** `Convenções.md` ou `Exceções.md` acima de **~20 KB** vira pasta com `Índice - Convenções.md` (ou `- Exceções.md`) mais um arquivo por tema — por pasta do projeto: `Code.md`, `Workshop.md`, … — e a consulta passa a ler o índice e abrir só o tema da tarefa. Ao encontrar um arquivo acima do limite, proponha ao usuário reparti-lo — e não faça sem ele.
