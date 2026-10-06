# AMF — Referência completa · Arquitetura modular - Linha de comando

Apoio da skill Arquitetura modular, na versão linha de comando. Abra a seção que a tabela rápida do arquivo principal indicar ("ver N.N"), ou a seção da pasta cuja dúvida é o porquê. Cada seção é autossuficiente.

---

## 4. A entrada: o comando

**O que é:** nesta plataforma não existe arquivo que o usuário clica. A entrada é um **comando** — um nome que a pessoa digita no terminal, ou que outro script chama. Por isso a raiz do projeto não tem arquivo de entrada: o comando ganha nome na configuração do empacotador, e aponta para o ponto de entrada dentro de `Program/Code/`.

### 4.1 O nome do comando

**O nome do comando é o nome do projeto**, em minúsculas, com hífen: `relatorio-vendas`. Não `main`, não `cli`, não uma sigla — o nome do projeto, para que a pessoa saiba o que está chamando.

**Quem declara esse nome é a configuração do empacotador** — ela liga o nome digitado à função que roda:

| Linguagem | Onde o nome se declara | Exemplo |
|---|---|---|
| Python | a tabela `[project.scripts]` do `pyproject.toml`, em `Program/` (ver 5.1) | `relatorio-vendas = "main:executar"` |
| Node | o campo `bin` do `package.json`, em `Program/` (ver 5.1 e 9.6) | `"bin": { "relatorio-vendas": "Code/main.js" }` |
| Go · Rust | o nome do executável que o compilador gera | `go build -o Distribution/relatorio-vendas` |

**A configuração do empacotador mora em `Program/`, acima de `Code/`** — é exceção de plataforma, e a seção 5.1 diz por quê e como configurar cada empacotador.

### 4.2 Um comando só, com subcomandos

**Não crie um comando por tarefa.** `relatorio-vendas-exportar` e `relatorio-vendas-importar` viram `relatorio-vendas exportar` e `relatorio-vendas importar`: um nome na lista de comandos da máquina, e a ajuda (`--help`) mostra tudo o que a ferramenta faz.

**Modo é opção, não comando.** Nada de `-debug` ou `-dev` no nome: o modo detalhado é `--verbose`; o ensaio sem efeito é `--dry-run`.

### 4.3 O ponto de entrada — `Program/Code/main.[ext]`

**O que é:** o arquivo para onde o comando aponta. Ele faz três coisas, e só elas:

1. **Lê os argumentos** — com a biblioteca de argumentos da linguagem: `argparse`, Click ou Typer no Python; commander ou yargs no Node; cobra em Go; clap em Rust.
2. **Escolhe o subcomando** e chama o arquivo dele em `commands/`.
3. **Transforma o que voltou num código de saída** e encerra — seção 6.6. É o **único** lugar do programa que encerra.

**Exemplo em Python:**
```python
import sys
from commands import exportar, importar
from constants.codigos_de_saida import ERRO_DE_USO

def executar() -> int:
    subcomandos = {"exportar": exportar.executar, "importar": importar.executar}
    if len(sys.argv) < 2 or sys.argv[1] not in subcomandos:
        print("uso: relatorio-vendas {exportar|importar} …", file=sys.stderr)
        return ERRO_DE_USO
    return subcomandos[sys.argv[1]](sys.argv[2:])

if __name__ == "__main__":
    sys.exit(executar())
```

Repare: a mensagem de uso vai para a **saída de erro** (`file=sys.stderr`), e o que volta é um **número**.

### 4.4 Sem empacotador — a ferramenta roda direto da pasta

Sem empacotador, não há nome de comando declarado: a pessoa chama o ponto de entrada pela linguagem — `python Program/Code/main.py exportar relatorio.csv`. As bibliotecas moram em `Program/Dependencies/` (seção 9.6), e o ponto de entrada as põe no caminho de busca **a partir do próprio arquivo**, nunca da pasta atual:

```python
import os, sys
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, "..", "Dependencies"))
```

Para chamar pelo nome, de qualquer pasta, um script em `Workshop/scripts/` instala um lançador de uma linha na pasta de comandos do usuário, apontando para o `main`. O lançador é da máquina de quem instalou — não fica no projeto.

### 4.5 Com empacotador ou compilador — `Distribution/`

| | Sem empacotador | Pacote publicável | Executável |
|---|---|---|---|
| Quem monta | ninguém | o **empacotador**: `python -m build`, `npm pack` | o **compilador**: PyInstaller, Nuitka, `go build`, `cargo build` |
| O que a pessoa recebe | a pasta do projeto | o pacote, pelo registro de pacotes da linguagem | um executável por sistema operacional |
| Como ela chama | `python Program/Code/main.py …` | pelo nome do comando, depois de instalar com pip, pipx ou npm | pelo nome do executável |
| `Distribution/` existe? | não | sim | sim |

**Regras:**
- `Distribution/` é **resultado**: o empacotador refaz idêntico. Nunca se edita à mão e nunca se versiona.
- **Aponte a saída para `Distribution/`**: `python -m build Program --outdir Distribution`, `npm pack --pack-destination ../Distribution` (rodado dentro de `Program/`), `pyinstaller --distpath Distribution`, `go build -o Distribution/…`. Deixada no padrão, cada ferramenta escreve numa pasta própria, ao lado da configuração.
- A configuração do empacotador mora em `Program/` — seção 5.1; o script que o chama, em `Workshop/scripts/` — seção 8.2.

---

## 5. Program/

**O que é:** tudo que pertence ao software. Se você atualizar a ferramenta, é isso que é substituído.

**Regras:**
- Os nomes de pasta aqui dentro são em inglês
- Nada de quem usa entra aqui — nem arquivo que ele passou por argumento, nem configuração que ele escolheu
- **Não há `Internal/` dentro dele.** A ferramenta instalada pode morar numa pasta só de leitura, compartilhada por todos os usuários da máquina e trocada inteira a cada atualização: o que ela escreve vai para a pasta do usuário — seção 10
- Sempre existe, junto com `Code/`

### 5.1 Exceção de plataforma — a configuração do empacotador mora em `Program/`

**O que o empacotador exige:** a configuração dele fica **acima de todo o código que ele empacota**. O pacote-fonte (`.tar.gz`) leva só o que está abaixo da pasta da configuração, e o pacote instalável é montado a partir dele. Testado em 22/09/2026, com `pyproject.toml` em `Workshop/` apontando para `../Program/Code`:

| Empacotador | `pip install .` | `python -m build` |
|---|---|---|
| setuptools (`package-dir`) | instala, mas escreve `.egg-info` dentro de `Code/` | falha: o pacote-fonte sai sem o código |
| hatchling (`force-include`) | instala | falha: o pacote-fonte sai sem o código |
| uv_build (`module-root`) | recusa: "Module root must be inside the project" | recusa |

No Node é regra escrita: os caminhos do `bin` e do `files` são relativos à pasta do `package.json`, e o que está fora dela nunca entra no pacote ([docs.npmjs.com — package.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json)).

**A árvore deste caso:**

```
Program/
├── pyproject.toml             a configuração do empacotador: declara o nome do comando, a lista
│                              de dependências, e aponta para Code/ (no Node, o package.json)
└── Code/
    ├── main.py                o ponto de entrada, para onde o comando aponta
    └── commands/              um arquivo por subcomando
Workshop/
├── scripts/empacotar.sh       roda python -m build ../Program --outdir ../Distribution
└── .venv/                     o ambiente virtual em que você desenvolve e testa
```

**A configuração que funciona, por empacotador** — o resto do `pyproject.toml` (`[project]`, `[project.scripts]`) é igual nos três:

- **hatchling** — o mais limpo; `only-include` deixa `Dependencies/` e `External/` fora do pacote:
  ```toml
  [tool.hatch.build.targets.wheel]
  only-include = ["Code"]
  sources = ["Code"]

  [tool.hatch.build.targets.sdist]
  only-include = ["Code"]
  ```
- **setuptools** — funciona, mas deixa `Program/build/` e `Code/<nome>.egg-info/` para trás: ponha os dois no `.gitignore`.
  ```toml
  [tool.setuptools]
  package-dir = {"" = "Code"}
  py-modules = ["main"]
  packages = ["commands"]
  ```
- **uv_build** — `module-root = "Code"` só empacota **pacote** (pasta com `__init__.py`); com o `main.py` solto em `Code/`, falha. Use hatchling ou setuptools.
- **npm** — `package.json` em `Program/`, `"bin": { "relatorio-vendas": "Code/main.js" }`, e o `main.js` começa com `#!/usr/bin/env node`, senão o comando não roda com o Node.

**Por quê:** o empacotador nunca leva para o pacote o que está fora da pasta da configuração dele; com ela em `Workshop/`, o pacote publicado sai sem o código.

Registre em `Exceções.md` do projeto qual empacotador ele usa, e com qual configuração.

---

## 6. Program/Code/

**O que é:** o código que **você** escreveu e que **roda quando o comando roda**.

### 6.1 A regra que decide onde uma coisa fica

> **Usado por UM módulo** → fica **dentro** desse módulo.
> **Usado por DOIS OU MAIS** módulos → sobe para o nível de `Code/`.
> **Editado em bloco**, independente do código → sobe também.

O princípio por trás: **organize por módulo, nunca por tipo de arquivo**. Nesta plataforma, o módulo é o **subcomando**.

**Exemplo correto:**
```
Code/
├── commands/exportar.py
└── backend/exportar/
    ├── exportar-pdf.py
    └── templates/
        └── relatorio.html      ← o modelo fica junto do código que o preenche
```

**Exemplo errado:**
```
Code/
├── backend/exportar/exportar-pdf.py
└── templates/relatorio.html    ← longe do código; se apagar o módulo, fica órfão
```

Isso vale para **qualquer** conteúdo que a ferramenta lê para decidir como agir: modelo de documento, regra em arquivo, esquema de validação, preset de parâmetros. Nenhum deles é pasta fixa da AMF — eles nascem dentro do módulo que os usa.

### 6.2 commands/

**O que é:** **um arquivo por subcomando.** É a casca que conversa com o terminal — e só ela conversa com o terminal.

Cada arquivo faz, na ordem:
1. declara e lê os argumentos **daquele** subcomando;
2. chama o `backend/` com dados já prontos — caminhos, números, escolhas;
3. escreve o **resultado** na saída padrão, e os avisos e o progresso na saída de erro;
4. devolve um código de saída para o `main`.

**Regra:** o arquivo tem o nome do subcomando — `relatorio-vendas exportar` → `commands/exportar.py`. Subcomando de subcomando (`relatorio-vendas config mostrar`) vira pasta: `commands/config/mostrar.py`.

**Quando a lógica é curta** — ler um arquivo, trocar uma coisa, escrever —, ela pode ficar no próprio arquivo do subcomando. Quando cresce, ou quando outro subcomando precisa dela, desce para `backend/`.

### 6.3 backend/

**O que é:** a lógica — cálculo, validação, conversão, orquestração. Organizada pelos mesmos módulos de `commands/`, quando a lógica existe, e pode ter módulos que nenhum subcomando chama direto.

**A regra desta plataforma: `backend/` não sabe que está numa linha de comando.**

| `backend/` nunca… | Porque… |
|---|---|
| lê `sys.argv` ou `process.argv` | quem lê argumento é `commands/` |
| escreve na saída padrão | só `commands/` decide o que é resultado |
| pergunta alguma coisa | pode não haver terminal — seção 13.3 do arquivo principal |
| encerra o programa | quem encerra é o `main` — seção 4.3 |

Ele recebe dados, devolve dados ou levanta erro. **Por quê:** assim a lógica se testa sem terminal nenhum, e serve amanhã a outra casca — uma tela, um servidor — sem ser reescrita.

**Regra:** só crie a pasta de um módulo aqui se ela tiver lógica real. Nunca um espelho vazio de `commands/`.

### 6.4 clients/

**O que é:** o código que **liga para fora** — a API de um modelo de linguagem, um serviço de armazenamento, um banco remoto. **Quem inicia a conversa é você.**

**Regra:** um arquivo por serviço externo — `lmstudio.py`, `armazenamento.py`. A credencial chega pela seção 10.3, nunca escrita aqui.

### 6.5 utils/

**O que é:** funções pequenas e reutilizáveis, sem dependência de módulo nenhum — formatação, conversão, validação genérica.

**Nesta plataforma, entram aqui as funções de conversa com o terminal**, que todo subcomando usa: escrever o resultado, escrever o aviso na saída de erro, saber se a saída é um terminal, perguntar só quando há terminal. Uma função só para cada coisa — senão cada subcomando decide do seu jeito para onde vai o aviso.

**Regra:** se uma função aparece em 2 lugares, ela vem para cá. Cada arquivo agrupa funções de um tema: `saida.py`, `formatar-data.py`.

### 6.6 constants/

**O que é:** valores fixos que aparecem em vários lugares — limites, URLs base, textos padronizados — **e os padrões de fábrica** da ferramenta: formato padrão, timeout padrão.

**Nesta plataforma, entra aqui a tabela dos códigos de saída.** Um arquivo só, com um nome para cada número:

| Código | Quer dizer |
|---|---|
| `0` | deu certo |
| `1` | deu errado, de um jeito geral |
| `2` | foi chamada errado — argumento faltando ou inválido |
| outros | os erros que quem chama precisa distinguir, cada um com o seu número |

**Regra:** o código de saída nunca se escreve como número solto no meio do código. Quem chama a ferramenta dentro de um script decide o que fazer **por ele** — se ele muda sem aviso, o script do outro quebra calado. Número publicado é interface pública, como o nome de um subcomando.

**A diferença da configuração do usuário:** `constants/` guarda o padrão de fábrica, que vem com a ferramenta e é substituído no update. O que o usuário escolheu mora na pasta dele — seção 10.2.

### 6.7 types/

**O que é:** a forma dos dados que a ferramenta usa — o que é um Relatório, um Registro: quais campos existem e de que tipo são. Entra aqui também a forma da saída estruturada (`--json`), quando a ferramenta oferece uma — ela é contrato com quem lê.

**Regra:** um arquivo por entidade principal. Tipos usados por um módulo só ficam dentro dele.

### 6.8 prompts/ e locales/

**`prompts/`** — os prompts que a ferramenta manda para um modelo de linguagem, **uma subpasta por módulo**, o prompt em `.txt` e o esquema de saída estruturada em `.json` com o mesmo nome. Fica no topo de `Code/`, e não dentro de cada módulo, porque prompt se revisa em conjunto. Prompt sem saída estruturada não tem `.json`.

**`locales/`** — as mensagens da ferramenta, um arquivo por idioma. **Só as mensagens para gente**: o texto que outro programa lê na saída padrão — nomes de campo, valores, o formato `--json` — nunca se traduz, senão o script de quem chama quebra ao trocar de idioma. Só crie se houver 2+ idiomas.

### 6.9 frontend/ e server/ — não existem

- **`frontend/`** — a tela é o terminal. O que a ferramenta mostra é texto, escrito por `commands/` com as funções de `utils/`.
- **`server/`** — a ferramenta roda, responde e termina: ninguém fica ligando para ela.

### 6.10 O arquivo de lista de dependências

A lista das bibliotecas que o projeto usa **não fica em `Code/`**: ela é configuração do gerenciador de pacotes. No Python, é a seção `dependencies` do próprio `pyproject.toml`; no Node, a do `package.json` — os dois em `Program/`, acima de `Code/` (seção 5.1). Ela **só informa** quais bibliotecas o projeto usa; é sua, e é versionada.

---

## 7. Program/Assets/ — raro

**O que é:** a mídia que a ferramenta **embute no que produz** e que você fez ou escolheu — a fonte de um PDF que ela gera, o logotipo carimbado num relatório, o som de um aviso. Substituído no update, como `Code/`.

**É raro** porque a ferramenta não tem tela: não há ícone de janela, nem imagem de interface. Se não há mídia no que ela produz, a pasta não existe.

**O critério é a FUNÇÃO do arquivo, não a extensão.** `Code/` guarda o que se **escreve** como parte do programa — código, HTML de modelo, prompt, esquema. `Assets/` guarda o que se **vê ou ouve**, feito noutro programa. Subpastas por tipo: `fonts/`, `images/`, `audio/`; quando o recurso é de um módulo só, subpasta com o nome dele: `Assets/fonts/exportar/`.

**O caminho até ele se resolve a partir do arquivo de código**, nunca da pasta atual: a pessoa roda a ferramenta de qualquer pasta.

---

## 8. Workshop/

**O que é:** o que existe **para você desenvolver**, e que o comando nunca executa. Pasta de nível 1, irmã de `Program/`.

> **Tudo que existe só no desenvolvimento mora aqui, e nada daqui vai junto no Ctrl+C de `Program/`.** A configuração do empacotador é a exceção: mora em `Program/` — seção 5.1.

Apagar `Workshop/` inteiro não quebra a ferramenta já instalada: ela continua rodando. Você é que deixa de conseguir testá-la, empacotá-la e publicá-la.

| O que mora aqui | Exemplo |
|---|---|
| `tests/` | os testes automáticos — 8.1 |
| `scripts/` | empacotar, publicar, instalar para teste — 8.2 |
| a configuração das outras ferramentas | a do compilador (no PyInstaller, o `.spec`), a do executor de testes, a do verificador de estilo |
| o cache das ferramentas de desenvolvimento | `.pytest_cache`, `.ruff_cache`, `.mypy_cache` — nunca em `Code/`; aponte-os para dentro de `Workshop/` na configuração de cada uma |
| `.env.example` · `.env` | as variáveis do seu ambiente de desenvolvimento. O `.env.example` se versiona; o `.env` nunca — seção 13 do arquivo principal |
| o ambiente virtual | no Python — seção 9.6 |

### 8.1 tests/

**O que é:** código que chama o seu código e verifica se a resposta bateu. Você roda no terminal quando quer conferir.

**Regra: espelha o caminho de `Program/Code/`, não o conteúdo.** Só existe pasta onde existe teste.

```
Program/Code/commands/exportar.py   →   Workshop/tests/commands/exportar_test.py
Program/Code/backend/exportar/…     →   Workshop/tests/backend/exportar/…
```

**Dois tipos de teste, e esta plataforma pede os dois:**
- **o de `backend/`** chama a função direto e confere o dado que voltou — sem terminal nenhum;
- **o de `commands/`** roda o subcomando como a pessoa rodaria e confere **as três respostas separadas**: o que saiu na saída padrão, o que saiu na de erro, e o código de saída. Um aviso que vazou para a saída padrão só aparece neste teste.

### 8.2 scripts/

**O que é:** automações de desenvolvimento — chamar o empacotador ou o compilador, publicar no registro de pacotes, instalar a ferramenta na sua máquina para testar (no Python, `pip install -e ../Program`; no Node, `npm link` dentro de `Program/`), instalar o lançador da seção 4.4.

**Regra:** nomear pelo que fazem — `empacotar.sh`, `publicar.sh` —, nunca só `run.sh`.

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

### 9.2 External/tools/

**O que é:** executáveis de terceiro que **fazem um trabalho sozinhos** e que o comando aciona como processo separado — `ffmpeg` converte vídeo, `tesseract` lê texto de imagem.

**Regras:** cada ferramenta na sua subpasta; se já está instalada no sistema e no PATH, não precisa ficar aqui. **Passe os argumentos como lista**, nunca montando uma linha de comando em texto — seção 13.4 do arquivo principal. E o que o executável escreve na saída padrão dele é dado **para o seu código**: nunca o repasse direto para a saída padrão da sua ferramenta sem passar por `commands/`.

### 9.3 External/libraries/

**O que é:** bibliotecas de terceiro que você **baixou e colou à mão**, sem gerenciador de pacotes. Raro numa ferramenta de linha de comando, em que o gerenciador de pacotes costuma resolver tudo.

### 9.4 External/runtimes/

**O que é:** a linguagem embutida no projeto — uma cópia completa do Python ou do Node, com a biblioteca padrão junto, para a ferramenta rodar numa máquina que não tem a linguagem instalada.

**A diferença de `Dependencies/`:** ali ficam as **bibliotecas**; aqui fica a **linguagem** que roda tudo. **A diferença de `tools/`:** `tools/` faz um trabalho sozinho; `runtimes/` executa o **seu** código.

Um ambiente virtual **não** torna a ferramenta portátil: ele isola as bibliotecas, mas continua dependendo do Python instalado no sistema. Com a linguagem embutida, aponte o gerenciador de pacotes para `Program/Dependencies/`, nunca para dentro de `External/runtimes/`.

### 9.5 External/ai-models/

**O que é:** modelos de inteligência artificial baixados e guardados no projeto — uma subpasta por tipo (`llm/`, `embeddings/`, `speech/`, `vision/`…). Não são seus e se substituem inteiros.

**Regra:** sempre no `.gitignore` — são grandes e não são seus. Se o modelo é grande demais para ir no pacote, a ferramenta o baixa na primeira vez para o **cache da pasta do usuário** (seção 10.4), e ele deixa de morar aqui.

### 9.6 Program/Dependencies/ — o teste, e a resposta desta plataforma

**O que é:** o que o **gerenciador de pacotes** (pip no Python, npm no Node) instalou a partir da lista de dependências, e que **o programa precisa para rodar**.

**O teste — apague a pasta de dependências e rode o programa já montado. Funcionou?**

| Resposta | Por quê | Então ela é |
|---|---|---|
| **Sim** | o empacotador ou o compilador já cuidou das bibliotecas: levou-as para dentro do executável, ou deixou para o gerenciador de pacotes de quem instala; a pasta do projeto cumpriu o papel | **do desenvolvimento** → `Workshop/` |
| **Não** | o programa procura a biblioteca na pasta do projeto na hora de rodar; sem ela, nem liga | **do programa** → `Program/Dependencies/` |

**Na linha de comando, isso se resolve assim:**

| Caso | A pasta de dependências | Por quê |
|---|---|---|
| **Node** | `Program/node_modules/`, com o `package.json` ao lado | o comando instalado com `npm link` ou `npm install -g .` roda a partir da pasta do projeto, e procura as bibliotecas na hora de rodar |
| **Python, empacotado** | o ambiente virtual, em `Workshop/` | quem instala a ferramenta com pip ou pipx recebe um ambiente próprio, com as bibliotecas dela; o ambiente virtual do projeto só serve para você desenvolver e testar |
| **Python, rodando direto da pasta** (seção 4.4) | `Program/Dependencies/` | o `main` importa as bibliotecas dali toda vez que roda — `pip install --target Program/Dependencies …` |
| **Executável** (PyInstaller, Nuitka, Go, Rust) | em `Workshop/`, quando existe | o compilador já levou as bibliotecas para dentro do executável |

**A diferença de `External/`** está na tabela 9.1: aqui um comando pôs e um comando recria; lá foi você, à mão.

**Regras:**
- **Nunca versionar.** Sempre no `.gitignore` — o que se versiona é a **lista**.
- Nunca editar à mão. Se precisa mudar, muda a lista e reinstala.

**Onde a linguagem impõe nome e lugar, vale o dela.** Em Node, Deno e Bun a pasta se chama `node_modules` e fica **direto em `Program/`**: a busca sobe a partir do arquivo que importa — olha na pasta, não achou, sobe um nível, olha de novo — e **nunca entra em pasta irmã**. De `Program/Code/`, ela sobe para `Program/` e acha. Como o npm cria o `node_modules` ao lado do `package.json`, nessas linguagens a lista acompanha a pasta, em `Program/` — e é esse `package.json` que declara, no campo `bin`, o nome do comando (seção 5.1). Nas linguagens em que o caminho é configurável (Python, PHP, Ruby, Rust), vale o nome `Dependencies/`.

---

## 10. O lugar do Internal/ — a pasta do usuário

**O que é:** o que a **ferramenta** escreve enquanto roda — configuração, cache, estado, registro, credencial. Nas outras plataformas isso mora em `Program/Internal/`. **Aqui, `Internal/` não existe como pasta.**

### 10.1 Por que não dentro do projeto

A ferramenta instalada mora onde o gerenciador de pacotes ou o instalador a pôs — uma pasta que pode ser **só de leitura**, **compartilhada por todos os usuários da máquina**, e **trocada inteira a cada atualização**. E ela roda a partir de qualquer pasta, então a pasta atual também não serve: cada pasta teria a sua configuração. O que ela escreve vai para a **pasta do usuário** — o lugar que o sistema operacional reserva para isso.

⚠ **O caminho é o que o sistema operacional manda, não um que você inventa.** Nada de `~/.relatorio-vendas/` criado à mão:

| O quê | Windows | macOS | Linux |
|---|---|---|---|
| configuração | `%APPDATA%\relatorio-vendas\` | `~/Library/Application Support/relatorio-vendas/` | `$XDG_CONFIG_HOME/relatorio-vendas/` (padrão `~/.config/…`) |
| cache | `%LOCALAPPDATA%\relatorio-vendas\Cache\` | `~/Library/Caches/relatorio-vendas/` | `$XDG_CACHE_HOME/relatorio-vendas/` (padrão `~/.cache/…`) |
| estado · registro | `%LOCALAPPDATA%\relatorio-vendas\` | `~/Library/Logs/relatorio-vendas/` (registro) | `$XDG_STATE_HOME/relatorio-vendas/` (padrão `~/.local/state/…`) |
| temporário | a pasta temporária do sistema | idem | idem |

**Não monte esses caminhos à mão.** Toda linguagem tem quem os resolva: `platformdirs` no Python, `env-paths` no Node, `os.UserConfigDir()` e `os.UserCacheDir()` em Go, `directories` em Rust. O nome da pasta é o nome do comando, que mora em `constants/`.

**As divisões de `Internal/` continuam valendo** — só mudam de endereço:

| Nas outras plataformas | Aqui |
|---|---|
| `Internal/config/` | a pasta de configuração — 10.2 |
| `Internal/credentials/` | variável de ambiente, cofre do sistema, ou um arquivo na pasta de configuração — 10.3 |
| `Internal/cache/` · `state/` · `logs/` | a pasta de cache e a de estado — 10.4 |
| `Internal/temp/` | a pasta temporária do sistema — 10.5 |
| `Internal/queue/` | quase nunca existe: a ferramenta roda e termina |

**Regras:**
- Crie a pasta só quando for escrever nela pela primeira vez — a ferramenta que nunca guardou nada não deixa rastro na máquina.
- Nunca versionar nada daqui: não está no projeto.
- **Nos testes, aponte a pasta do usuário para uma pasta temporária** — senão rodar os testes mexe na sua configuração de verdade.

### 10.2 Configuração

O que o usuário **escolheu de propósito** e vale para as próximas execuções — o formato preferido, o endereço do servidor, a pasta de saída padrão. Mora na pasta de configuração, num arquivo que ele pode abrir e editar (`config.toml`, `config.json`), e que a ferramenta pode oferecer para mexer com um subcomando (`relatorio-vendas config definir formato pdf`).

**A ordem de quem vence** — sempre esta:

```
opção na linha de comando       vale para esta execução
  → variável de ambiente         vale para esta sessão do terminal
    → arquivo de configuração    vale até o usuário mudar
      → padrão de fábrica        em constants/, vem com a ferramenta
```

**A diferença de `constants/`:** `constants/` é substituído no update. Esta pasta **não pode** ser — senão o usuário perde tudo que configurou a cada atualização.

### 10.3 Credenciais

Chave de API, token, senha. **Três lugares aceitáveis, nesta ordem de preferência:**

1. **o cofre de senhas do sistema operacional** — no Python, a biblioteca `keyring`; em outras linguagens, a equivalente;
2. **uma variável de ambiente**, que o usuário define ou que o script dele passa;
3. **um arquivo na pasta de configuração**, que só o dono pode ler (no Linux e no macOS, permissão `600`).

**Nunca como argumento** (`--token …`): fica no histórico do terminal e aparece na lista de processos. Se a ferramenta precisa perguntar a senha, pergunta **sem mostrar o que se digita** — e só se houver terminal.

⚠ **É a única parte do que a ferramenta escreve que não se recria.** Todo o resto — cache, estado, registro — ela refaz; a chave, não. Apagar não quebra a ferramenta, mas obriga a pessoa a buscar todas as chaves de novo. E **nunca se escreve na saída, no erro nem no registro**.

### 10.4 Cache, estado e registro

- **Cache** — resultado guardado para não recalcular ou baixar de novo; sobrevive entre execuções. Pode ser apagado a qualquer momento.
- **Estado** — o que a ferramenta lembra sozinha: a última pasta usada, quando conferiu por atualização. Se sumir, ninguém nota.
- **Registro** — por padrão, **vai para a saída de erro**, e só com `--verbose` ou `--log-file`. Guardar registro em arquivo, na pasta de estado, é escolha — e aí com rotação automática, senão cresce sem limite.

### 10.5 Temporário

Arquivo de **uma** execução — o PDF sendo montado antes de ir para o destino. Mora na **pasta temporária do sistema**, criada com a função da linguagem (`tempfile` no Python, `os.tmpdir()` no Node), e **morre quando a execução acaba** — inclusive quando ela é interrompida com Ctrl+C.

É também daqui que sai a escrita segura: grave o resultado num temporário **na mesma pasta do destino** e renomeie por cima só quando terminou — seção 11.

---

## 11. Onde o trabalho do usuário mora

**Onde o trabalho do usuário mora nesta plataforma:** em lugar nenhum guardado pela ferramenta. Ela lê o que o argumento apontar e escreve onde o argumento mandar — ou, quando o argumento não diz, na pasta atual.
**O que você tem permissão de escrever lá:** só o que a pessoa pediu, no lugar que ela indicou. Nada de pasta própria criada ao lado, nada de arquivo extra "para controle".

**Por isso `Files/` não existe.** Nas plataformas em que o programa tem uma pasta de trabalho, ela mora no projeto. Aqui, o trabalho é o arquivo que a pessoa aponta — está na pasta dela, no disco dela, no projeto dela. A ferramenta passa, faz e vai embora.

**Regras:**
- **O caminho do argumento se resolve a partir da pasta atual** — é onde a pessoa está quando digita.
- **O traço (`-`) quer dizer a entrada ou a saída padrão**, por convenção: `relatorio-vendas exportar - < dados.csv` lê o que chegou pelo encadeamento. Ofereça onde fizer sentido: é o que deixa a ferramenta entrar no meio de outras.
- **Sem destino no argumento, o resultado vai para a saída padrão ou para a pasta atual** — nunca para a pasta de instalação nem para a pasta do usuário.
- ⚠ **Destino que já existe não se sobrescreve sem pedido** — pergunte (havendo terminal) ou falhe com código diferente de zero; sobrescreva só com `--force`. E escreva num temporário ao lado, renomeando só no fim: uma execução interrompida nunca deixa o arquivo da pessoa pela metade.
- **O original nunca se modifica sem pedido.** A ferramenta que transforma um arquivo escreve o resultado em outro, a não ser que a pessoa peça a troca no lugar (`--in-place`).

**O teste que separa o trabalho do usuário do que é da ferramenta:** apagou e **a pessoa perde trabalho** → é dela, e mora onde ela apontou. Apagou e **a ferramenta só refaz** → é da ferramenta, e mora na pasta do usuário (seção 10).

---

## 12. Banco de dados

Nesta plataforma o banco (`.db`, `.sqlite`) segue a mesma regra de todo o resto: **o que é da pessoa mora onde ela aponta; o que é da ferramenta mora na pasta do usuário.** Nunca em `Program/`.

- **Banco que é fonte** — o dado da pessoa, que não existe em outro lugar — é trabalho dela: mora onde o argumento aponta (`--banco caminho`), ou num arquivo com nome fixo na pasta atual, como o Git faz com o repositório. A ferramenta pode lembrar o último caminho usado, na configuração.
- **Banco que é índice** — um resumo que a ferramenta monta para achar rápido — mora na **pasta de cache** (seção 10.4).

### 12.1 Índice ou fonte — a diferença que importa

Não muda só **onde** o arquivo fica. Muda **o que a ferramenta pode fazer com ele**.

| | **Índice** | **Fonte** |
|---|---|---|
| **O que guarda** | Um resumo dos arquivos, para achar rápido | O dado em si — não existe arquivo por trás |
| **Onde mora** | na pasta de cache do usuário | onde o argumento aponta, ou na pasta atual |
| **Se apagar** | A ferramenta relê os arquivos e reconstrói | **Perdeu** — não há de onde reconstruir |
| **A ferramenta pode apagar sozinha?** | Sim, quando desconfia que desatualizou | **Nunca**, nem para "limpar" ou "corrigir" |

**O teste de uma pergunta:**

> *Se eu apagar esse `.db` agora, a ferramenta consegue reconstruir tudo sozinha?*
> **Sim** → é índice. ⚠ **Não** → é fonte, e a ferramenta jamais pode tocar nele sem confirmação.
