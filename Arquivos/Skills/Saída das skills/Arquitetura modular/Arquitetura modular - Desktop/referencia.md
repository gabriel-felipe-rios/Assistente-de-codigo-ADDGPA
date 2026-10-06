# AMF — Referência completa · Arquitetura modular - Desktop

Apoio da skill Arquitetura modular. Abra a seção que a tabela rápida do arquivo principal indicar ("ver N.N"), ou a seção da pasta cuja dúvida é o porquê. Cada seção é autossuficiente.

---

## 4. Arquivo de entrada

**O que é:** o arquivo que o usuário clica para abrir o programa. Fica na raiz, visível, e é a primeira coisa que aparece ao abrir a pasta.

### 4.1 As duas regras

**O nome é o nome do projeto.** Não `iniciar.bat`, não `main.py`, não `run.sh` — o nome do projeto. Assim o arquivo diz que programa é aquele, e não fica igual em todo projeto.

**A extensão é a que abre direto, sem terminal.** Clicou, abriu. Uma janela preta de console aparecendo antes do programa é ruído.

| Linguagem / plataforma | Extensão | Por quê |
|---|---|---|
| Python com interface | `.pyw` | Abre sem console |
| Página web local | `.html` | Abre no navegador |
| Compilado | `.exe` | Abre direto |
| Python sem interface | `.py` | O console **é** a interface |
| Windows, sem alternativa | `.bat` | Último recurso — abre console |

### 4.2 Um arquivo só

**Não crie um arquivo de entrada por modo.** Nada de `-dev`, `-prod`, `-debug`. Se você precisa rodar em modo de depuração para ver mensagens de erro, chame pelo terminal na hora — é você que faz isso, não o usuário.

Se o programa realmente precisa de modos alternativos para funcionar, eles são **parâmetro** (linha de comando) ou **opção** em `Internal/config/`, nunca um segundo arquivo na raiz.

### 4.3 Caminhos relativos, sempre

O arquivo de entrada nunca usa caminho absoluto. O projeto precisa funcionar de qualquer pasta do sistema, sem depender de `C:\Users\fulano\...`.

**Exemplo em Python (`.pyw`):**
```python
import os, sys
RAIZ = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(RAIZ, "Program", "Code"))
sys.path.insert(0, os.path.join(RAIZ, "Program", "Dependencies"))
from backend.principal import iniciar
iniciar()
```

**Exemplo em `.bat`:**
```bat
@echo off
cd /d "%~dp0Program\Code"
python main.py
```
O `%~dp0` resolve o diretório relativo ao próprio arquivo — funciona mesmo que o projeto seja movido.

### 4.4 Quando há compilador: o executável e `Distribution/`

A Desktop **não tem empacotador**, mas **pode ter compilador** — a ferramenta que transforma o programa num executável que roda sem instalar a linguagem: PyInstaller ou Nuitka no Python, `go build` em Go, `cargo build` em Rust.

Quando você gera esse executável para entregar a alguém, **ele é escrito em `Distribution/`**, uma pasta de nível 1, irmã de `Program/`. É o mesmo destino de qualquer plataforma que produz um pacote; o que muda é só a ferramenta.

| | Sem compilador | Com compilador |
|---|---|---|
| O que a pessoa recebe | a pasta do projeto inteira | o que está em `Distribution/` |
| O que ela clica | `[Nome do projeto].pyw` | o executável |
| `Distribution/` existe? | não | sim — nasce na primeira compilação |

**Regras:**
- `Distribution/` é **resultado**: o compilador refaz idêntico. Nunca se edita à mão e nunca se versiona.
- A configuração do compilador (no PyInstaller, o `.spec`) e o script que o chama moram em `Workshop/` — seção 8.
- O `[Nome do projeto].pyw` continua na raiz: é por ele que você roda o programa enquanto desenvolve.

---

## 5. Program/

**O que é:** tudo que pertence ao software. Se você atualizar o programa, é isso que é substituído. Se apagar, o programa para de funcionar — mas o trabalho do usuário continua intacto em `Files/`.

**Regras:**
- Todos os nomes aqui dentro são em inglês
- Nada do usuário entra aqui — nem arquivo que ele criou, nem banco de dados do trabalho dele
- Sempre existe, junto com `Code/`

---

## 6. Program/Code/

**O que é:** o código que **você** escreveu e que **roda quando o app roda**. É o coração do projeto.

### 6.1 A regra que decide onde uma coisa fica

Esta é a regra mais importante do documento, porque ela substitui uma lista fixa de pastas:

> **Usado por UM módulo** → fica **dentro** desse módulo.
> **Usado por DOIS OU MAIS** módulos → sobe para o nível de `Code/`.
> **Editado em bloco**, independente do código → sobe também.

O princípio por trás: **organize por módulo/funcionalidade, nunca por tipo de arquivo**. Uma pasta que junta "todos os modelos de documento" ou "todos os temas" agrupa por tipo — e separa o arquivo do código que o usa.

**Exemplo correto:**
```
Code/backend/relatorios/
├── relatorios-gerador.py
└── templates/
    └── relatorio.html        ← o modelo fica junto do código que preenche ele
```

**Exemplo errado:**
```
Code/
├── backend/relatorios/relatorios-gerador.py
└── templates/relatorio.html  ← longe do código; se apagar o módulo, fica órfão
```

Isso vale para **qualquer** conteúdo que o programa lê para decidir como agir: modelo de documento, regra em arquivo, tema visual, preset de parâmetros, receita de fluxo, esquema de validação, plugin. Nenhum deles é pasta fixa da AMF — eles nascem dentro do módulo que os usa.

### 6.2 frontend/

**O que é:** toda a interface visual — telas, componentes, botões, tabelas, modais, gráficos. É o que o usuário vê.

**Organizado por módulo, não por tipo de arquivo.** Cada tela ou funcionalidade é uma pasta, e dentro dela fica tudo daquela tela: código, estilo, tema, o que for.

- Se o programa tem abas: cada aba vira uma pasta
- Se tem uma tela só: ela é o módulo raiz, com subpastas para os componentes
- Se o programa não tem interface (script, automação, API): a pasta não existe

**Evitar:** `components/`, `hooks/`, `pages/` todos no mesmo nível — isso é agrupamento por tipo.

**Exemplo:**
```
frontend/
├── chat/
│   ├── chat-tela.js
│   ├── chat-mensagem.js
│   └── chat-estilo.css
└── configuracoes/
```

### 6.3 backend/

**O que é:** toda a lógica de processamento — cálculos, validações, regras de negócio, orquestração. O que o usuário não vê, mas faz o programa funcionar.

Organizado pelos mesmos módulos do frontend, quando ambos existem. Pode ter módulos exclusivos de backend (sincronização, indexação, tarefas em segundo plano) que não têm tela correspondente — isso é normal.

**Regra:** só crie a pasta de um módulo aqui se ela tiver lógica real. Nunca crie espelho vazio do frontend.

### 6.4 clients/

**O que é:** o código que **liga para fora**. Seu programa precisa de algo, chama um serviço externo e espera a resposta. **Quem inicia a conversa é você.**

**Exemplos:** chamar a API de um modelo de linguagem, mandar e-mail, consultar uma API de clima, gerar PDF numa biblioteca externa, consultar um banco remoto.

**Regra:** um arquivo por serviço externo — `lmstudio.py`, `email.py`, `clima.py`.

### 6.5 server/

**O que é:** o código que **fica esperando ligarem para você**. Seu programa publica endereços e outro programa chama. **Quem inicia a conversa é o outro.**

**Exemplos:** um servidor MCP, um webhook, um servidor local que uma extensão de navegador consulta.

**A pergunta que separa das duas:** *quem inicia a conversa?* Se é o seu código → `clients/`. Se é outro programa → `server/`.

Na maioria dos projetos só uma das duas existe.

### 6.6 utils/

**O que é:** funções pequenas e reutilizáveis sem dependência de módulo nenhum — formatações, conversões, validações genéricas.

**Regra:** se uma função aparece em 2 lugares diferentes, ela vem para cá. Cada arquivo agrupa funções de um tema.

**Exemplos:** `validar-cpf.ts`, `formatar-data.ts`, `formatar-moeda.ts`

### 6.7 constants/

**O que é:** valores fixos que não mudam durante a execução e aparecem em vários lugares — cores, limites numéricos, URLs base, textos padronizados. **E também os padrões de fábrica do programa**: tema inicial, timeout padrão, endereço padrão da API.

**Por que o padrão de fábrica vem para cá:** porque valor de fábrica **é** valor fixo. Deixando ele aqui, existe apenas **um** `config/` no projeto inteiro — o de `Internal/`, que guarda o que o usuário escolheu. Sem ambiguidade.

**Regra:** qualquer valor que aparece em 2+ arquivos diferentes vira constante aqui. Nunca escrever o mesmo número ou texto fixo em dois arquivos separados.

### 6.8 types/

**O que é:** define a forma dos dados que o programa usa — o que é um Cliente, um Relatório, um Pedido: quais campos existem e de que tipo são.

**Regra:** um arquivo por entidade principal. Tipos usados por apenas um módulo ficam dentro desse módulo, não aqui.

### 6.9 locales/

**O que é:** os textos da interface separados em um arquivo por idioma. Em vez de "Salvar" estar escrito dentro do código, ele fica numa lista, e o programa troca a lista inteira ao mudar de idioma.

**Regra:** só crie se o programa **for** ter mais de um idioma. Se é só português, não crie — é trabalho a mais sem ganho.

**Exemplos:** `pt-br.json`, `en.json`

### 6.10 prompts/

**O que é:** os prompts que o programa manda para um modelo de linguagem, e os esquemas de saída estruturada de cada um.

**Por que fica no topo de `Code/` e não dentro de cada módulo:** porque prompt tem **modo de trabalho próprio**. Você senta para "mexer nos prompts" — revisa vários, compara o tom, ajusta o conjunto. Isso é uma atividade em si, e ela exige eles juntos. É a única exceção à regra 6.1.

**Regras:**

1. **Uma subpasta por módulo** que conversa com IA. Nunca uma lista solta — com 40 prompts vira caos.
2. **O nome da subpasta é o nome real do módulo** no seu programa. `chat/`, `agentes/`, `terminal/` são exemplo — o espelho é com o seu código, não com uma lista fixa.
3. **O prompt é sempre `.txt`.**
4. **O esquema é sempre `.json`, com nome idêntico ao do prompt.**
5. **Prompt sem saída estruturada simplesmente não tem `.json`.** Ausência não é pendência.

```
prompts/
├── chat/
│   ├── sistema.txt            prompt sem esquema — resposta é texto livre
│   ├── resumo.txt             o prompt
│   └── resumo.json            o esquema dele — mesmo nome, outra extensão
└── agentes/
    ├── interceptor.txt
    └── interceptor.json
```

### 6.11 O arquivo de lista de dependências

`requirements.txt`, `Gemfile`, `composer.json` — o arquivo que **lista** as dependências **não fica em `Code/`**: ele é configuração do gerenciador de pacotes, e mora em `Workshop/` (seção 8).

Ele **só informa** quais bibliotecas o projeto usa; não instala nada e não é a biblioteca em si. É seu, e é versionado.

**Exceção:** em Node, o `package.json` acompanha o `node_modules`, direto em `Program/` — seção 9.6.

---

## 7. Program/Assets/

**O que é:** o que o programa **mostra ou toca** e que você fez ou escolheu — imagem (inclusive SVG e ícone), fonte, áudio, vídeo. É substituído no update, como `Code/`.

**O critério é a FUNÇÃO do arquivo, não a extensão.** `Code/` guarda o que se **escreve** como parte do programa: código em qualquer linguagem, HTML, CSS, prompt (mesmo em `.txt` — um `.txt` que é prompt é estrutura do programa e fica em `Code/prompts/`), JSON, esquema, texto traduzido. `Assets/` guarda o que se **vê ou ouve**. Teste: *"a forma normal de mexer nisso é editar linha a linha num editor de código?"* Sim → `Code/`. Não (foi feito noutro programa, ou se olha/escuta) → `Assets/`. Um ícone SVG é texto, mas se mexe num editor de desenho: `Assets/`.

**Subpastas:** `icons/`, `images/`, `fonts/`, `audio/`, `video/`. Quando o recurso é de **um módulo só**, subpasta com o nome do módulo dentro do tipo: `Assets/images/chat/`. Modelo de IA baixado **não** é asset: fica em `External/ai-models/`.

**Regra:** nada binário ou de mídia em `Code/`; nada que se escreve em `Assets/`.

---

## 8. Workshop/

**O que é:** o que existe **para você desenvolver**, e que o programa nunca executa. É uma pasta de nível 1, irmã de `Program/` — não fica dentro dele.

> **Tudo que existe só no desenvolvimento mora aqui, e nada daqui vai junto no Ctrl+C de `Program/`.**

Apagar `Workshop/` inteiro não quebra o programa: ele continua rodando. Você é que deixa de conseguir testá-lo, compilá-lo e reinstalar as dependências.

**A pergunta que separa de `Program/Code/`:** *isso roda quando o app roda?* Se sim → `Program/Code/`. Se só você executa, no desenvolvimento → `Workshop/`.

| O que mora aqui | Exemplo |
|---|---|
| `tests/` | os testes automáticos — 8.1 |
| `scripts/` | compilar, publicar, instalar para teste, backup — 8.2 |
| a lista de dependências | `requirements.txt` — a exceção do Node está em 9.6 |
| a configuração das ferramentas | a do compilador (no PyInstaller, o `.spec`), a do executor de testes (`pytest.ini`), a do verificador de estilo (`ruff.toml`) |
| `.env.example` · `.env` | as variáveis do seu ambiente de desenvolvimento. O `.env.example` se versiona; o `.env` nunca — seção 13 do arquivo principal |
| o ambiente virtual | só quando o compilador já levou as bibliotecas para dentro do executável. Sem compilador, o programa precisa delas para rodar, e elas moram em `Program/Dependencies/` — seção 9.6 |

### 8.1 tests/

**O que é:** arquivos de código que chamam o seu código e verificam se a resposta bateu. Você roda no terminal quando quer conferir; o app nunca roda sozinho.

**Regra: espelha o caminho de `Program/Code/`, não o conteúdo.** Espelhar aqui significa **usar o mesmo caminho**, não copiar arquivo. Só existe pasta onde existe teste.

```
Program/Code/utils/formatar.py   →   Workshop/tests/utils/formatar_test.py
```

Achar o teste de qualquer arquivo fica mecânico: troca a raiz e acrescenta o sufixo. Se você testou dois arquivos, existem dois arquivos aqui — não a estrutura inteira.

### 8.2 scripts/

**O que é:** automações de desenvolvimento e manutenção — chamar o compilador, publicar, instalar para teste, backup, atualizar o esquema do banco, instalar as dependências.

**Regra:** nomear de forma descritiva pelo que fazem — `backup.sh`, `compilar.sh` — nunca apenas `run.sh`.

---

## 9. Program/External/ e Program/Dependencies/

As duas guardam o que **outro** escreveu e você não edita. O que as separa é **quem pôs lá**.

### 9.1 A diferença, numa tabela

| | `External/` | `Dependencies/` |
|---|---|---|
| **quem põe lá** | **você**, à mão | um comando do gerenciador de pacotes |
| **versiona?** | sim | **nunca** |
| **apagou, volta sozinha?** | não — você baixa de novo à mão | sim, um comando recria |

**`External/` é só o que você colou à mão:** `tools/`, `libraries/`, `runtimes/`, `ai-models/`. **O que o gerenciador de pacotes instalou mora em `Program/Dependencies/`** — seção 9.6.

**Regra das duas:** se você editar um arquivo daqui, ele está no lugar errado. Código que você mantém pertence a `Code/`.

### 9.2 External/tools/

**O que é:** executáveis de terceiro que **fazem um trabalho sozinhos**. Você chama como processo separado e recebe o resultado.

**Exemplos:** `ffmpeg` converte vídeo, `tesseract` lê texto de imagem, `wkhtmltopdf` gera PDF.

**Regra:** se a ferramenta já está instalada globalmente e no PATH, não precisa ficar aqui. Cada ferramenta em sua própria subpasta.

### 9.3 External/libraries/

**O que é:** bibliotecas de terceiro que você **baixou e colou à mão** dentro do projeto, sem gerenciador de pacotes. Tipicamente arquivos `.min.js`.

**Exemplos:** `marked/`, `cytoscape/`, `d3/`

**A diferença de `Dependencies/`:** aqui foi você que colou; lá foi o gerenciador de pacotes que instalou.

### 9.4 External/runtimes/

**O que é:** a linguagem de programação embutida dentro do projeto — uma cópia completa do Python ou do Node, com a biblioteca padrão junto, que roda sem instalação nenhuma.

O programa passa a chamar `External/runtimes/python/python.exe` em vez do interpretador do sistema. Quem receber a pasta clica e usa, sem instalar nada.

**A diferença de `Dependencies/`:** ali ficam as **bibliotecas**; aqui fica a **linguagem** que roda tudo.

**A diferença de `tools/`:** `tools/` faz um trabalho sozinho; `runtimes/` executa o **seu** código — sem ele, nada seu roda.

**Nota importante sobre ambiente virtual:** um `venv` **não** torna o projeto portátil. Ele copia o executável, mas continua dependendo do Python instalado no sistema — a biblioteca padrão vem de lá. Ele isola as **bibliotecas**, e só. Por isso a linguagem embutida e as bibliotecas moram em pastas separadas.

**Com a linguagem embutida, aponte o gerenciador de pacotes para `Program/Dependencies/`** — nunca para dentro de `External/runtimes/`: `External/` guarda só o que você colou à mão.

### 9.5 External/ai-models/

**O que é:** modelos de inteligência artificial baixados e guardados no projeto. Não são seus, você não edita, e substitui inteiro quando troca de versão — por isso ficam aqui e não em `Code/`.

**Uma subpasta por tipo**, porque são coisas diferentes:

| Subpasta | O que guarda |
|---|---|
| `llm/` | Modelo de linguagem: `.gguf`, `.safetensors` |
| `embeddings/` | Transforma texto em vetor, para busca por sentido |
| `rerankers/` | Reordena resultados de busca por relevância |
| `vision/` | Imagem: OCR, detecção, classificação |
| `speech/` | Áudio: transcrição (STT) e voz (TTS) |
| `image-gen/` | Geração de imagem |

**Regra:** sempre adicionar ao `.gitignore` — são arquivos grandes e não são seus.

### 9.6 Program/Dependencies/

**O que é:** o que o **gerenciador de pacotes** (pip no Python, npm no Node, Bundler no Ruby, Composer no PHP) instalou a partir da lista de dependências, e que **o programa precisa para rodar**.

**O teste — apague a pasta de dependências e rode o programa já montado. Funcionou?**

| Resposta | Por quê | Então ela é |
|---|---|---|
| **Sim** | o compilador já copiou para dentro do executável o pedaço de biblioteca que o código usa; a pasta cumpriu o papel e virou entulho | **do desenvolvimento** → `Workshop/` |
| **Não** | o programa procura a biblioteca na hora de rodar; sem ela, nem liga | **do programa** → `Program/Dependencies/` |

**Na Desktop, isso se resolve assim:**
- **Sem compilador** — o `[Nome do projeto].pyw` importa as bibliotecas toda vez que abre. Elas moram em `Program/Dependencies/` (no Python: `pip install --target Program/Dependencies -r Workshop/requirements.txt`), e o arquivo de entrada põe essa pasta no caminho de busca — seção 4.3.
- **Com compilador** — o executável em `Distribution/` já leva as bibliotecas dentro. O ambiente virtual em que você compila é do desenvolvimento, e mora em `Workshop/`.

**A diferença de `External/`** está na tabela 9.1: aqui um comando pôs e um comando recria; lá foi você, à mão.

**Regras:**
- **Nunca versionar.** Sempre no `.gitignore` — o que se versiona é a **lista** (`requirements.txt`), que mora em `Workshop/`.
- Nunca editar à mão. Se precisa mudar, muda a lista e reinstala.

**Onde a linguagem impõe nome e lugar, vale o dela.** Em Node, Deno e Bun a pasta se chama `node_modules` e fica **direto em `Program/`**: a busca sobe a partir do arquivo que importa — olha na pasta, não achou, sobe um nível, olha de novo — e **nunca entra em pasta irmã**. De `Program/Code/`, ela sobe para `Program/` e acha. Como o npm cria o `node_modules` ao lado do `package.json`, nessas linguagens a lista acompanha a pasta, em `Program/`. Nas linguagens em que o caminho é configurável (Python, PHP, Ruby, Rust), vale o nome `Dependencies/`.

---

## 10. Program/Internal/

**O que é:** o que o **programa** escreveu enquanto rodava. Não é código, não é do usuário. São dados operacionais que o programa cria e gerencia sozinho.

**Regras:**
- Nunca versionar no Git
- O programa pode apagar e recriar a pasta inteira sem perda real
- Fica dentro de `Program/`, porque é do programa — não do trabalho do usuário

### 10.1 logs/

Registros de atividade — erros, ações, chamadas a serviços. Essencial para diagnosticar o que aconteceu quando algo dá errado.

**Regra:** configurar rotação automática, senão cresce sem limite.

### 10.2 cache/

Resultado guardado para não recalcular ou rebuscar a mesma coisa. **Sobrevive a fechar o programa** e é reusado na próxima abertura.

**Regra:** pode ser apagado a qualquer momento — o programa recria.

**Cache de ferramenta também mora aqui.** O que a ferramenta gera sozinha — `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`, `*.tsbuildinfo`, o cache do empacotador (bundler), quando houver — **nunca fica em `Code/`**: aponte-o para `Internal/cache/<ferramenta>/` no arquivo de entrada ou na configuração da ferramenta (Python: `sys.pycache_prefix = …` antes de qualquer import, ou a variável `PYTHONPYCACHEPREFIX`; pytest e mypy: `cache_dir`; ruff: `cache-dir`). Vale para qualquer linguagem. Se a ferramenta não permitir apontar, registre em `Exceções.md`.

### 10.3 temp/

Arquivo de **uma** operação específica — um PDF sendo montado antes de ser entregue. **Morre quando a operação acaba.**

**A diferença de `cache/`:** cache sobrevive e é reusado; temp existe durante uma operação e some com ela.

**Regra:** limpar ao iniciar o programa.

### 10.4 state/

O que o programa lembra **sozinho, sem você pedir** — qual aba estava aberta, tamanho da janela, último caminho usado, posição da rolagem.

### 10.5 config/

O que o usuário **escolheu de propósito** numa tela de configuração — tema, modelo selecionado, pasta padrão, opções que ele marcou.

**A diferença de `state/`:** se o `state/` sumir, o usuário nem nota. Se o `config/` sumir, ele reclama.

**A diferença de `constants/`:** `constants/` guarda o padrão de fábrica, que vem com o programa e é substituído no update. Aqui fica o que o usuário mudou, que **não pode** ser substituído — senão ele perde tudo que configurou a cada atualização.

### 10.6 queue/

O controle da fila de execução: em que ordem as tarefas rodam, quantas tentativas já teve, qual está rodando agora.

**A diferença das etapas em `Files/`:** as pastas numeradas guardam **os arquivos** (são do usuário, ele vê e mexe). Aqui fica o **controle** (é do programa). Em programa simples, `queue/` nem precisa existir — a pasta onde o arquivo está já diz tudo.

### 10.7 credentials/

Chave de API, token, senha de banco.

**Fica aqui, e nunca em `Code/`** — senão vai junto quando você compartilha a pasta, manda para alguém ou publica em repositório.

**⚠ Esta é a única exceção do balde.** Todo o resto de `Internal/` é descartável porque o programa recria — **chave não se recria**. Apagar essa pasta não quebra o programa, mas te obriga a buscar todas as chaves de novo. Trate como o único conteúdo de `Internal/` que merece cuidado.

---

## 11. Files/

**O que é:** o trabalho do **usuário**. O programa cria, lê e modifica arquivos aqui, mas eles pertencem a ele. É o que você copiaria para um pen drive se quisesse salvar o trabalho.

**Regras:**
- Atualizar ou reinstalar o programa **nunca** toca nesta pasta
- ⚠ O programa jamais apaga nada aqui sem confirmação explícita
- Nomes livres a partir do terceiro nível — ver 3.1

### 11.1 Os três formatos — escolha um

O que muda entre eles é **como o trabalho se organiza**, e isso depende do programa.

**Formato 1 — `projects/`: o trabalho se divide em unidades nomeadas**

Use quando o usuário cria, nomeia, abre e fecha unidades distintas de trabalho, cada uma com seus próprios arquivos e histórico.

*Exemplos:* app de pesquisa (uma pasta por tema pesquisado), editor de vídeo (uma por produção), sistema de gestão (uma por cliente).

**Formato 2 — etapas numeradas: o trabalho passa por um fluxo**

Use quando arquivos entram, são processados em sequência e saem prontos. Não faz sentido nomear cada um.

*Exemplo:* um app que analisa 40 arquivos HTML e aponta o que está ruim em cada. Criar um projeto por arquivo seria absurdo.

**Formato 3 — solto: nem um nem outro**

Arquivos avulsos direto em `Files/`, ou em `unsorted/` se convivem com projetos.

*Exemplo:* editor simples — você abre, edita, salva.

### 11.2 A regra recursiva

> **As mesmas pastas de trabalho valem em dois níveis — nunca nos dois ao mesmo tempo.**

Se o programa **não tem** projetos, as pastas de trabalho ficam direto em `Files/`.
Se o programa **tem** projetos, as mesmas pastas ficam dentro de cada projeto.

```
SEM projetos                        COM projetos
Files/                              Files/projects/Relatórios de vendas/
├── 1-baixar-pdf/                   ├── 1-baixar-pdf/
├── 2-extrair-imagens/              ├── 2-extrair-imagens/
├── concluido/                      ├── concluido/
├── conversas/                      ├── conversas/
└── dados.db                        └── dados.db
```

É a mesma lógica repetida um nível abaixo. Não há nome novo para aprender — muda só o escopo.

### 11.3 Dentro do projeto, a estrutura é livre

**A AMF fixa uma coisa só** dentro de `Files/projects/{nome}/`: se o projeto tem etapas, elas seguem o padrão de 11.4.

Todo o resto é livre — nome, idioma, quantidade. O que um projeto guarda depende inteiramente do que o programa faz, e a referência genérica não tem como adivinhar. Um projeto de pesquisa guarda fontes; um de vídeo guarda cortes; um de código guarda contexto.

```
Pesquisa/          Com etapas/                Código/
├── fontes/        ├── 1-baixar-pdf/          ├── contexto/
├── resumos/       ├── 2-extrair-imagens/     ├── conversas/
└── conversas/     ├── concluido/             └── gerado/
                   └── com-erro/
```

**Nem todo projeto tem fluxo.** A pasta de etapas é situacional dentro do projeto também — nasce só se aquele projeto precisar.

### 11.4 O padrão de etapas numeradas

Quando o trabalho passa por várias fases, cada fase é uma pasta. O arquivo vai andando de uma para a outra.

```
1-baixar-pdf/          você larga aqui — o programa nunca modifica o original
2-extrair-imagens/     saiu da primeira etapa
3-comentar-imagens/    saiu da segunda etapa
concluido/             passou por tudo — é o que você vem buscar
com-erro/              travou em alguma etapa, junto do log do erro
```

**As regras:**

1. **Número na frente, hífen, nome da etapa.** O número garante a ordem certa no explorador de arquivos — sem ele, `analisado` apareceria antes de `extraido`, em ordem alfabética.
2. **O nome descreve o que a etapa produziu, não o que ela faz.** `2-extrair-imagens/` guarda as imagens extraídas.
3. **A primeira etapa é onde o usuário larga o material.** O programa lê, mas nunca modifica o original.
4. **Duas pastas sem número no fim** — uma para o que terminou, outra para o que deu erro. Sem número porque não são etapa, são destino.
5. **`com-erro/` existe para não travar a fila** — o que falhou sai do caminho e os outros continuam.
6. **A pasta onde o arquivo está É o estado dele.** Não precisa de banco para saber em que fase cada um parou: é só olhar. Se o programa fechar no meio, ao reabrir ele vê o que tem em cada pasta e continua de onde parou.
7. **Os nomes das etapas são livres e podem ser em português** — estão dentro de `Files/`.

### 11.5 projects/ e etapas nunca no mesmo nível

Se existem projetos, **todo fluxo pertence a algum deles**. Um fluxo solto ao lado dos projetos é órfão — não dá para saber de qual projeto ele é.

### 11.6 intake/ — a única exceção

**O que é:** o fluxo de triagem. Recebe o que chegou mas **ainda não pertence a nenhum projeto**, e decide para onde vai.

```
Files/
├── intake/
│   ├── 1-recebido/
│   └── 2-classificado/      daqui o programa move para o projeto certo
└── projects/
    └── Relatórios de vendas/
```

**O que mantém a regra honesta:** `intake/` **não produz entregável**. Ele só decide o destino. Se produzisse resultado final, seria um projeto disfarçado — e aí quebraria 11.5.

### 11.7 unsorted/

Arquivos soltos, sem projeto e sem fluxo, que convivem com uma estrutura organizada.

**Só crie se o programa tiver projetos ou etapas E também arquivos avulsos.** No formato 3 puro, os arquivos ficam direto em `Files/` e essa pasta não existe.

---

## 12. Banco de dados

Um arquivo de banco (`.db`, `.sqlite`) **sempre fica em `Files/`** — nunca em `Program/`. Banco não é arquivo de código.

- Se o programa tem projetos → o banco de cada projeto fica **dentro** dele. Apagou o projeto, o banco vai junto; copiou a pasta, o banco vai junto.
- Se não tem projetos → um banco só, na raiz de `Files/`.

### 12.1 Índice ou fonte — a diferença que importa

Não muda **onde** o arquivo fica. Muda **o que o programa pode fazer com ele**.

| | **Índice** | **Fonte** |
|---|---|---|
| **O que guarda** | Um resumo dos arquivos, para achar rápido | O dado em si — não existe arquivo por trás |
| **Exemplo** | "vendas-01.pdf, já processado, tema Q1" | "Tarefa: ligar pro cliente, prazo 20/08" |
| **Se apagar** | O programa relê os arquivos e reconstrói | **Perdeu** — não há de onde reconstruir |
| **O programa pode apagar sozinho?** | Sim, quando desconfia que desatualizou | **Nunca**, nem para "limpar" ou "corrigir" |

**O teste de uma pergunta:**

> *Se eu apagar esse `.db` agora, o programa consegue reconstruir tudo sozinho?*
> **Sim** → é índice. ⚠ **Não** → é fonte, e o programa jamais pode tocar nele sem confirmação.
