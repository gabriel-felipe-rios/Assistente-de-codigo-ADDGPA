# AMF — Referência completa · Arquitetura modular - MCP

Apoio da skill Arquitetura modular. Abra a seção que a tabela rápida do arquivo principal indicar ("ver N.N"), ou a seção da pasta cuja dúvida é o porquê. Cada seção é autossuficiente.

> Auditada em 22/09/2026 contra: a especificação do MCP na revisão 2026-07-28 (a atual — transportes stdio e Streamable HTTP, autorização, ferramentas, recursos, prompts e a lista de recursos obsoletos), em modelcontextprotocol.io; o guia "Build an MCP server" e a página de SDKs oficiais do mesmo site; a documentação do registro oficial de MCP (em pré-lançamento: `server.json`, `mcp-publisher`, tipos de pacote); e o repositório `modelcontextprotocol/mcpb` (formato `.mcpb`, manifesto 0.3).

---

## 4. A entrada e o registro no cliente

Na versão Desktop, o arquivo de entrada é o que o usuário clica. **Aqui ninguém clica: a entrada é o processo que fica ligado esperando** — o que o cliente executa e mantém vivo enquanto conversa com ele.

### 4.1 A entrada

**Mora em `Program/`, e não na raiz.** Ela não é clicada por ninguém: o cliente a executa pelo caminho que o registro declara. Ficando em `Program/`, ela vai junto no Ctrl+C, e alcança `Code/` e `Dependencies/` por caminho relativo.

**As cinco regras:**

1. **Um arquivo de entrada só.** Nada de `-dev`, `-prod`, `-debug`: variação vem por variável de ambiente, passada pelo cliente.
2. **A entrada não imprime nada na saída padrão.** É a regra mais importante desta plataforma inteira — ver 10.1.
3. **Ela põe `Code/` e `Dependencies/` no caminho de busca, sobe, registra as ferramentas de `server/tools/` e fica esperando.** Não faz trabalho pesado ao subir: o cliente espera uma resposta rápida na abertura.
4. **Caminhos relativos a ela mesma**, nunca ao diretório de trabalho — que é do cliente.
5. **Quando o cliente fecha a entrada padrão, ela encerra.** É o sinal de desligar que o protocolo define no stdio; um servidor que o ignora é morto à força.

**Exemplo em Python:**
```python
import os, sys
PROGRAMA = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(PROGRAMA, "Code"))
sys.path.insert(0, os.path.join(PROGRAMA, "Dependencies"))
from server.principal import iniciar
iniciar()
```

Quando o servidor é publicado como pacote (seção 2.1 do arquivo principal), o manifesto do pacote declara a entrada, e o gerenciador de pacotes de quem instala cria o comando que a chama.

### 4.2 O exemplo de registro

**O que é:** o trecho de configuração que o usuário cola no programa que vai chamar o MCP. **Esse trecho é a instalação inteira**, e sem ele o projeto não tem como ser usado. Ele declara:

- **o comando** — o que o cliente executa;
- **os argumentos** — o caminho da entrada, ou o nome do pacote publicado;
- **as variáveis de ambiente** — a credencial (seção 10.2), o caminho de `Files/` (seção 11) e o resto da configuração que muda de instalação para instalação.

**Mora em `Program/`, ao lado da entrada**, num arquivo de exemplo pronto para copiar: é o produto dizendo como se liga, e vai junto de quem recebe o servidor. **Nunca com valor de credencial dentro** — só o nome da variável e um marcador no lugar do valor.

**No registro, o caminho da entrada vai absoluto.** O código nunca usa caminho absoluto (seção 3.5 do arquivo principal), mas o cliente executa o comando de um diretório que não é o do projeto: o caminho que ele recebe precisa ser completo. No exemplo, fica um marcador no lugar da pasta.

**Quando o servidor é distribuído empacotado, o registro muda de forma** (seção 2.1 do arquivo principal):

| Formato | Quem declara o comando | O que quem instala escreve |
|---|---|---|
| pacote do npm ou do PyPI | o registro no cliente: `npx <pacote>` ou `uvx <pacote>` | o registro, com as variáveis de ambiente |
| `.mcpb` | o `manifest.json`, no campo `mcp_config`, com `${__dirname}` no lugar da pasta onde o cliente o instalou | nada: o cliente pergunta os campos que o manifesto declara em `user_config` — inclusive uma pasta, pelo tipo `directory`, que chega ao servidor numa variável de ambiente |

Ao empacotar um `.mcpb`, ponha um `.mcpbignore` em `Program/` que deixe `Internal/` de fora: o `mcpb pack` leva a pasta inteira, e o que o servidor escreveu na sua máquina não vai para a de ninguém.

**Listado no registro oficial de MCP**, o registro confere que o pacote é seu antes de aceitar a ficha (`server.json`, em `Workshop/`). No npm, pelo campo `mcpName` do `package.json`; no PyPI, por uma linha `mcp-name: <nome do servidor>` no texto longo do pacote — o arquivo que o campo `readme` do `pyproject.toml` aponta —, que pode ir num comentário; no `.mcpb`, pelo resumo SHA-256 do arquivo, escrito na ficha. O nome do servidor segue o dono: `io.github.<usuário>/<servidor>`.

### 4.3 O outro transporte — Streamable HTTP

Tudo acima supõe o transporte **stdio**: o cliente executa o servidor como processo. No **Streamable HTTP**, o servidor é um processo independente, que atende por um único endereço de rede e pode servir a vários clientes. A árvore de pastas é a mesma; mudam cinco coisas:

| | stdio | Streamable HTTP |
|---|---|---|
| **quem liga o processo** | o cliente, pelo registro | você, ou o serviço onde ele está hospedado |
| **a saída padrão** | é o canal do protocolo — nada seu nela (10.1) | é livre: a conversa vai pela rede |
| **a credencial** | variável de ambiente, passada pelo cliente (10.2) | a autorização do protocolo — OAuth 2.1, com o servidor no papel de quem recebe o token e confere que ele foi emitido para ele |
| **o registro no cliente** | comando, argumentos e ambiente | só o endereço |
| **a defesa de rede** | não há rede | conferir o cabeçalho `Origin` de toda conexão e, rodando na máquina do usuário, escutar só em `127.0.0.1` — sem isso, uma página aberta no navegador consegue falar com o servidor |

O protocolo não tem mais sessão, em nenhum dos dois transportes (desde a revisão 2026-07-28): cada pedido chega completo, e o que precisa atravessar chamadas se guarda como a seção 10 descreve.

---

## 5. Program/

**O que é:** tudo que pertence ao servidor. Quando o usuário atualiza o MCP, é isso que é substituído. Ctrl+C aqui e ele roda em qualquer lugar — o cliente só precisa apontar para a nova entrada.

**Regras:**
- Todos os nomes aqui dentro são em inglês
- **Nada do usuário entra aqui** — o que é trabalho dele mora em `Files/` (seção 11)
- Sempre existe, junto com a entrada e `Code/`

---

## 6. Program/Code/

**O que é:** o código que **você** escreveu e que **roda quando o servidor roda**. É o coração do projeto.

### 6.1 A regra que decide onde uma coisa fica

> **Usado por UMA ferramenta** → fica **dentro** dela.
> **Usado por DUAS OU MAIS** → sobe para o nível de `Code/`.
> **Editado em bloco**, independente do código → sobe também.

O princípio: **organize por funcionalidade, nunca por tipo de arquivo**.

**Nesta plataforma, "módulo" quer dizer "ferramenta exposta".** É a unidade em torno da qual tudo se organiza: a pasta em `server/tools/`, o esquema em `types/`, a lógica em `backend/`, o teste em `Workshop/tests/`.

### 6.2 server/ — o coração

**O que é:** o código que **fica esperando ligarem para você**. Na versão Desktop, `server/` é situacional e raro. **Aqui ele é o projeto inteiro:** é ele que fala o protocolo e publica o que você expõe.

```
server/
├── (o que fala o protocolo: conexão, registro, despacho)
└── tools/
    ├── legenda/
    │   ├── legenda-extrair.ts       a ferramenta: recebe, valida, chama, responde
    │   └── legenda-esquema.ts       ou o esquema em types/, se for compartilhado
    └── linha_do_tempo/
```

**As cinco regras de `server/tools/`:**

1. **Uma pasta por ferramenta exposta.** É o "módulo" desta plataforma.
2. **A ferramenta não tem lógica.** Ela **valida a entrada**, chama `backend/` e devolve a resposta no formato do esquema. Regra de negócio dentro da ferramenta não se testa e não se reusa.
3. **Toda ferramenta valida toda entrada** — seção 13 do arquivo principal. Quem chama é um modelo, e ele pode ter sido induzido pelo que acabou de ler.
4. **Ferramenta exposta é interface pública.** Mudar o nome ou o formato quebra quem já configurou o MCP e quem escreveu instruções contando com ela. Trate como contrato.
5. **Poucas ferramentas, bem descritas, valem mais do que muitas.** O modelo escolhe lendo nome, descrição e esquema; vinte ferramentas parecidas fazem ele escolher errado.

**Entrada recusada volta como erro da ferramenta, não do protocolo.** O protocolo separa os dois: o erro de protocolo (ferramenta que não existe, pedido malformado) o cliente pode nem mostrar ao modelo; o erro da ferramenta — resposta normal marcada com `isError: true` e uma mensagem clara — é o que o modelo lê para corrigir o argumento e tentar de novo.

**`server/resources/` — o que se lê, e não se chama.** O protocolo expõe três coisas: ferramentas, recursos e prompts. **Recurso é dado que o cliente lê por endereço** (uma URI, como `file:///…` ou um esquema seu) — o conteúdo de um arquivo, o estado do programa controlado. Não age sobre nada: quem decide lê-lo é o cliente ou o usuário, não o modelo por conta própria. Mora em `server/resources/`, uma pasta por recurso ou família de recursos, com as mesmas regras de `server/tools/`: não tem lógica (pede a `backend/`), é interface pública, e só enxerga a pasta permitida (seção 13 do arquivo principal). **Só existe se o servidor publicar recursos** — a maioria publica só ferramentas.

### 6.3 types/ — o esquema é o contrato que o modelo lê

**O que é:** na versão Desktop, `types/` é a forma dos dados do programa. **Aqui ele vira o esquema de entrada e saída de cada ferramenta** — e ganha um papel que não tem em nenhuma outra plataforma:

> **É o contrato que o modelo lê para decidir sozinho se chama a ferramenta.**

Ninguém programa a chamada. O modelo recebe o nome, a descrição e o esquema, e decide. Isso muda o que é um "tipo bem escrito":

1. **A descrição de cada campo é para o modelo ler.** Diga o que o campo é, em que unidade, com que formato, e o que acontece se vier errado. Uma descrição vaga produz chamada errada.
2. **Campo obrigatório é obrigatório mesmo.** Tudo que for opcional precisa de um comportamento padrão descrito.
3. **Restrinja no esquema, não só no código.** Lista fechada de valores, faixa numérica, formato de texto — o que o esquema restringe, o modelo tenta acertar antes de chamar.
4. **O esquema de saída também importa** — é o que o modelo vai ler para continuar o trabalho. No protocolo ele é opcional (`outputSchema`); declarado, a resposta estruturada (`structuredContent`) tem de obedecê-lo, e vale devolver o mesmo conteúdo também como texto, para o cliente que não lê a parte estruturada.
5. **Esquema usado por uma ferramenta só fica dentro dela**; o compartilhado sobe para `types/`.

O esquema é JSON Schema, e o protocolo supõe a versão 2020-12 quando o esquema não declara outra. Ferramenta sem parâmetro declara um objeto que não aceita campo nenhum (`{"type": "object", "additionalProperties": false}`).

### 6.4 prompts/ — que aqui podem ser públicos

**O que é:** na versão Desktop, `prompts/` guarda o que o programa manda para um modelo — coisa interna.

**Aqui ele deixa de ser necessariamente interno: o MCP pode EXPOR prompts**, e aí eles viram **interface pública** — modelos de conversa prontos que o usuário do cliente escolhe pelo nome.

**Isso divide a pasta em dois papéis, e vale separá-los:**

| | **Prompt interno** | **Prompt exposto** |
|---|---|---|
| **Quem usa** | O seu código, ao chamar um modelo por `clients/` | O usuário, pelo cliente |
| **Mudar o texto** | Livre | É mudar interface pública |

**O prompt interno chama o modelo por `clients/`, direto no provedor.** O protocolo tinha um jeito de o servidor pedir ao modelo do próprio cliente (a amostragem, *sampling*), mas ele está obsoleto desde a revisão 2026-07-28, e a saída indicada é justamente falar com o provedor.

**As regras de sempre continuam:**

1. **Uma subpasta por módulo** (aqui: por ferramenta). Nunca uma lista solta.
2. **O nome da subpasta é o nome real do módulo.**
3. **O prompt é sempre `.txt`.**
4. **O esquema é sempre `.json`, com nome idêntico ao do prompt.**
5. **Prompt sem saída estruturada simplesmente não tem `.json`.**

**Por que a pasta fica no topo de `Code/`:** porque prompt tem **modo de trabalho próprio** — você senta para "mexer nos prompts", revisa vários, compara o tom. É a exceção deliberada de sempre à regra 6.1.

### 6.5 clients/ — o programa ou serviço que ele controla

**O que é:** o código que **liga para fora**. **Nesta plataforma, é aqui que mora o que o MCP de fato controla:** o programa que ele pilota, a API que ele consulta, o banco que ele lê.

**Regra:** um arquivo por serviço ou programa externo.

**A forma de falar com o programa controlado varia** — API local, linha de comando, arquivo de projeto, automação do sistema. Seja qual for, ela fica **aqui e só aqui**: o resto do código pede "me dê os trechos" e não fica sabendo como.

**Três avisos:**
1. **O programa controlado pode não estar aberto.** Toda chamada precisa de um caminho para "ele não está rodando", com uma mensagem que o modelo consiga entender e repassar.
2. **Uma operação lenta trava a ferramenta**, e o cliente do outro lado tem limite de espera. Trabalho longo se divide, ou vira "comece" + "consulte o andamento" — o protocolo tem uma extensão oficial para esse par (as *tasks*), e o que ela guarda entre as consultas mora em `Internal/queue/`.
3. **A resposta do programa controlado é entrada** — pode vir grande, vazia ou malformada.

### 6.6 backend/ — a lógica de cada ferramenta

**O que é:** onde mora o que cada ferramenta realmente faz.

**Organizado pelos mesmos nomes de `server/tools/`.** A ferramenta é a porta; a lógica é aqui.

**A regra que mantém tudo saudável: `backend/` não conhece o protocolo.** Ele recebe dados já validados e devolve dados; quem fala o protocolo é `server/`, e quem fala com o programa controlado é `clients/`. É isso que permite testar sem subir o servidor.

### 6.7 utils/ e constants/

- **`utils/`** — funções pequenas e reutilizáveis sem dependência de ferramenta nenhuma. Se uma função aparece em 2 lugares, ela vem para cá.
- **`constants/`** — valores fixos que aparecem em vários lugares, **e os padrões de fábrica**: limites, tempos de espera, tamanhos máximos de resposta.
  **Constante não é configuração de ambiente.** O que o usuário passa no registro do cliente — caminho, endereço, credencial — é **variável de ambiente** (seção 10.2).

### 6.8 frontend/ · locales/ — não existem

**Não há tela nenhuma.** O MCP é um processo sem interface: quem tem tela é o cliente que fala com ele.

- **`frontend/`** não existe — nada é desenhado
- **`locales/`** não existe — o que o MCP devolve é texto para um modelo ler, e as descrições das ferramentas são em inglês (seção 3.1 do arquivo principal)

**Se você sentir falta de uma tela, provavelmente o projeto quer ser outra coisa** — um programa com interface, que por acaso também expõe um MCP. Nesse caso são dois projetos, e este é o menor dos dois.

### 6.9 A lista de dependências

`requirements.txt` — o arquivo que **lista** as bibliotecas que o gerenciador de pacotes instala — **não fica em `Code/`**: ele é configuração do gerenciador, e mora em `Workshop/` (seção 8). As duas exceções — o Node, e o servidor publicado como pacote — estão na seção 9.3.

---

## 7. Program/Assets/ — não existe

**Não existe.** Um servidor MCP não mostra nem toca nada. O critério genérico do balde — o que se **vê ou ouve**, feito ou escolhido por você — continua valendo para saber que uma coisa dessas *não* é `Code/`: se um dia o servidor precisar distribuir um arquivo de mídia, ele é trabalho do usuário (`Files/`) ou de terceiro (`External/`).

---

## 8. Workshop/

**O que é:** o que existe **para você desenvolver**, e que o servidor nunca executa. É uma pasta de nível 1, irmã de `Program/` — não fica dentro dele.

> **Tudo que existe só no desenvolvimento mora aqui, e nada daqui vai junto no Ctrl+C de `Program/`.**

Apagar `Workshop/` inteiro não quebra o servidor: ele continua rodando. Você é que deixa de conseguir testá-lo, publicá-lo e reinstalar as dependências.

**A pergunta que separa de `Program/Code/`:** *isso roda quando o servidor roda?* Se sim → `Program/`. Se só você executa, no desenvolvimento → `Workshop/`.

| O que mora aqui | Exemplo |
|---|---|
| `tests/` | os testes automáticos — 8.1 |
| `scripts/` | rodar contra um cliente de teste, publicar — 8.2 |
| a lista de dependências | `requirements.txt` — as exceções estão em 9.3 |
| a configuração das ferramentas | a do empacotador, a do executor de testes (`pytest.ini`), a do verificador de estilo (`ruff.toml`) |
| `.env.example` · `.env` | as variáveis do seu ambiente de desenvolvimento. O `.env.example` se versiona; o `.env` nunca — seção 13 do arquivo principal |

### 8.1 tests/

**O que é:** arquivos de código que chamam o seu código e verificam se a resposta bateu. Você roda no terminal quando quer conferir.

**Regra: espelha o caminho de `Program/Code/`, não o conteúdo.** Só existe pasta onde existe teste.

```
Program/Code/backend/legenda/extrair.ts   →   Workshop/tests/backend/legenda/extrair_test.ts
```

**O teste desta plataforma: testar chamando pelo protocolo.** Além dos testes de lógica, suba o servidor e chame as ferramentas do jeito que o cliente chama. É o único jeito de conferir o que mais quebra aqui:

1. **Nada foi impresso na saída padrão** — o teste pelo protocolo é o que pega isso (10.1)
2. **O esquema publicado é o que você esperava** — nome, campos, obrigatórios, descrições
3. **Entrada inválida é recusada com mensagem clara**, e não derruba o servidor
4. **A ferramenta responde dentro do tempo** que o cliente espera

E os dois testes de conteúdo que pagam:
- **Entrada hostil** — caminho tentando sair da pasta permitida, texto gigante, valor fora da faixa (seção 13 do arquivo principal)
- **Programa controlado fechado** — o caminho de erro que mais acontece na vida real

### 8.2 scripts/

**O que é:** automações de desenvolvimento e publicação.

**Nesta plataforma, entram duas específicas:**
- **rodar o servidor localmente** contra um cliente de teste
- **publicar**, quando houver — chamar o empacotador (`python -m build`, `npm pack` ou `mcpb pack`), que escreve `Distribution/`, enviar o pacote ao registro de pacotes e, se o servidor é listado no registro oficial de MCP, enviar a ficha com `mcp-publisher publish`, a partir de `Workshop/`, onde mora o `server.json`

**Regra:** nomear pelo que fazem — `publicar.sh`, `rodar-local.sh` — nunca apenas `run.sh`.

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

### 9.2 Program/External/

| Pasta | O que é aqui |
|---|---|
| `tools/` | **Executáveis de terceiro que o MCP aciona** — um conversor, um extrator. **Não confundir com `server/tools/`** (seção 2.3 do arquivo principal) |
| `libraries/` | O SDK do programa que ele controla, quando existe um e você o baixou à mão do fabricante |
| `runtimes/` | Raro — só quando o MCP precisa ser autocontido, para rodar sem o usuário instalar a linguagem. Com a linguagem embutida, aponte o gerenciador de pacotes para `Program/Dependencies/`, nunca para dentro de `runtimes/` |
| `ai-models/` | Raro — **quem chama o MCP já é um modelo**: embutir outro costuma ser sinal de que a divisão do projeto está errada |

### 9.3 Program/Dependencies/ — o servidor procura ao rodar

**O teste — apague a pasta de dependências e rode o servidor. Funcionou?**

| Resposta | Por quê | Então ela é |
|---|---|---|
| **Sim** | um empacotador já copiou para dentro do resultado o pedaço de biblioteca que o código usa; a pasta cumpriu o papel e virou entulho | **do desenvolvimento** → `Workshop/` |
| **Não** | o programa procura a biblioteca na hora de rodar; sem ela, nem liga | **do programa** → `Program/Dependencies/` |

**Num servidor MCP, a resposta é "não".** O servidor roda direto — o cliente executa a entrada, e ela importa as bibliotecas toda vez que sobe. Elas moram em `Program/Dependencies/` (no Python: `pip install --target Program/Dependencies -r Workshop/requirements.txt`), e a entrada põe essa pasta no caminho de busca — seção 4.1.

**Onde a linguagem impõe nome e lugar, vale o dela.** Em Node, Deno e Bun a pasta se chama `node_modules` e fica **direto em `Program/`**: a busca sobe a partir do arquivo que importa — olha na pasta, não achou, sobe um nível, olha de novo — e **nunca entra em pasta irmã**. De `Program/Code/`, ela sobe para `Program/` e acha. Como o npm cria o `node_modules` ao lado do `package.json`, nessas linguagens a lista acompanha a pasta, em `Program/`. Nas linguagens em que o caminho é configurável (Python, PHP, Ruby, Rust), vale o nome `Dependencies/`.

**Publicado como pacote**, o manifesto do pacote vai onde o empacotador o exige — na raiz do que ele empacota, `Program/` (seção 2.1 do arquivo principal). Em Python, o `pyproject.toml` passa então a ser também a lista de dependências, no lugar do `requirements.txt`. **Empacotado como `.mcpb`**, a resposta do teste continua "não": o pacote leva `Program/` inteiro, e `Dependencies/` (ou o `node_modules/`) vai dentro dele — o formato exige as bibliotecas embutidas, a não ser no tipo de servidor `uv`, em que o cliente as instala a partir do `pyproject.toml`.

**Regras:**
- **Nunca versionar** a pasta instalada. Sempre no `.gitignore` — o que se versiona é a **lista**.
- Nunca editar à mão. Se precisa mudar, muda a lista e reinstala.

---

## 10. Program/Internal/

**O que é:** o que o **servidor** escreveu enquanto rodava. Não é código, não é do usuário.

| Conceito | Como fica no MCP |
|---|---|
| `logs/` | **Saída de erro** — ver 10.1. Nunca a saída padrão. Se também gravar em arquivo, é aqui |
| `cache/` · `state/` · `temp/` | Em disco, aqui — o servidor pode apagar e recriar |
| `config/` | Em disco, aqui, o que o servidor guarda · **e o que vem do cliente, no ambiente** (10.2) |
| `queue/` | Se houver trabalho longo, com "comece" + "consulte o andamento" |
| `credentials/` | **Não é pasta: variáveis de ambiente passadas pelo cliente** — ver 10.2 |

**Regras:**
- Nunca versionar no Git
- O servidor pode apagar e recriar a pasta inteira sem perda real
- **Quando o servidor é instalado como pacote**, o código mora onde o gerenciador de pacotes de quem instala o pôs — e nunca se escreve junto dele. Aí `Internal/` vai para a pasta de dados do usuário, no lugar que o sistema reserva para dados de programa.

**`state/` e a falta de sessão.** Desde a revisão 2026-07-28 o protocolo não tem sessão: nenhuma chamada sabe da anterior. O que precisa atravessar chamadas — um trabalho aberto, uma seleção, um carrinho — se guarda em `state/` sob um identificador que a ferramenta que o cria **devolve**, e que as seguintes **recebem como argumento**. O identificador é opaco (nada de estrutura que dê para adivinhar), tem prazo de validade dito na descrição da ferramenta, e o identificador vencido volta como erro da ferramenta, para o modelo criar outro.

### 10.1 logs/ vai para a saída de erro — e isso é vital

> ⛔ **Um texto impresso na SAÍDA PADRÃO corrompe o protocolo e derruba a conexão.**

Quando o MCP conversa com o cliente pela entrada e saída do processo, **a saída padrão é o canal do protocolo**. Qualquer coisa escrita ali entra no meio da conversa e a quebra.

**O que isso significa na prática:**

1. **Todo log vai para a saída de erro**, sempre. Sem exceção.
2. **Um print esquecido de depuração derruba o servidor** — e o sintoma não é uma mensagem de erro: é a conexão caindo sem explicação. **É a falha número um desta plataforma.**
3. **Toda biblioteca de terceiro que você usa também pode imprimir.** Uma que escreva um aviso na saída padrão derruba o seu MCP sem você ter escrito uma linha. Ao adotar uma dependência nova, teste pelo protocolo (8.1).
4. **O log na saída de erro não pode vazar segredo** (seção 13 do arquivo principal) — ele é lido por gente e costuma ficar guardado.

**A regra continua a central na revisão 2026-07-28.** O texto da especificação para o stdio é direto: o servidor não pode escrever na saída padrão nada que não seja mensagem válida do protocolo, e pode escrever na saída de erro qualquer log. O cliente pode guardar, repassar ou ignorar a saída de erro, e não deve tratá-la como sinal de erro — por isso aviso comum também vai para lá. E o recurso de log que passava pelo próprio protocolo (a notificação de log) ficou obsoleto nessa revisão: a saída indicada é a saída de erro, ou OpenTelemetry para observabilidade.

### 10.2 credentials/ — variáveis de ambiente passadas pelo cliente

**O jeito certo de o MCP receber credencial é por variável de ambiente**, declarada no trecho de registro que o usuário cola no cliente (seção 4.2). É o que a própria especificação manda para o stdio: a autorização do protocolo (OAuth) é para o transporte HTTP (seção 4.3); no stdio, a credencial vem do ambiente. No `.mcpb`, é um campo do `user_config` marcado `sensitive`, que o cliente guarda em lugar seguro.

**Nunca em argumento de linha de comando** — argumento aparece na lista de processos da máquina, visível para qualquer programa que a consulte (seção 13 do arquivo principal).

**E:** nunca no código, nunca em arquivo versionado, nunca no exemplo de registro, e nunca de volta na resposta de uma ferramenta.

### 10.3 O cache das ferramentas

O que a ferramenta gera sozinha — `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`, `*.tsbuildinfo` — **nunca fica em `Code/`**: aponte-o para `Internal/cache/<ferramenta>/` na entrada ou na configuração da ferramenta (Python: `sys.pycache_prefix = …` antes de qualquer import, ou a variável `PYTHONPYCACHEPREFIX`; pytest e mypy: `cache_dir`; ruff: `cache-dir`). Vale para qualquer linguagem. Se a ferramenta não permitir apontar, registre em `Exceções.md`.

---

## 11. Files/ — pasta de verdade, com o caminho configurável

**O que é:** o trabalho do **usuário** que o servidor guarda. Esta é uma das variações em que `Files/` é pasta literal — **mas só se o servidor guardar algo de verdade**: uma coleção que ele monta, um histórico que o usuário consulta, um banco que é fonte. Se o MCP só age sobre o material de outro programa, ou sobre arquivos que o usuário apontou, `Files/` não existe.

### 11.1 O caminho é configurável

**Quem instala escolhe onde o trabalho fica** — o servidor roda como processo local, então pode ter pasta própria; mas o lugar não é decisão dele.

- **O caminho vem de uma variável de ambiente**, declarada no exemplo de registro (seção 4.2). O código nunca o fixa. No `.mcpb`, é um campo do tipo `directory` no `user_config` do manifesto, que o cliente pergunta ao instalar e entrega na mesma variável.
- **Não peça a pasta ao cliente pelo protocolo.** O pedido de pastas ao cliente (*roots*) está obsoleto desde a revisão 2026-07-28; a saída indicada é a configuração do servidor — a variável de ambiente acima — ou o caminho como parâmetro de ferramenta, sempre dentro da pasta permitida.
- **O padrão é `Files/`, irmã de `Program/`**, quando o servidor roda da pasta do projeto e ninguém apontou outro lugar.
- **Instalado como pacote**, não há pasta do projeto do lado: sem a variável, o servidor usa a pasta de dados do usuário, ou recusa gravar e diz por quê.
- **É a pasta permitida** da regra de escopo (seção 13 do arquivo principal): as ferramentas que leem e escrevem arquivo só enxergam o que está dentro dela.

### 11.2 As regras

1. ⚠ **Nada aqui se apaga ou se sobrescreve sem confirmação humana.** Quem chama a ferramenta é um modelo, que pode ter sido induzido; a pessoa precisa poder dizer não antes de perder o que fez.
2. **Atualizar ou reinstalar o servidor nunca toca nesta pasta.**
3. **Prefira acrescentar a substituir.** Criar arquivo novo é reversível de cabeça; reescrever, não.
4. **Alteração em massa avisa quanto vai tocar** antes de tocar.

### 11.3 Por dentro

Os formatos da AMF valem aqui como em qualquer `Files/`, e o inglês vai até o segundo nível:

- **`projects/`** — quando o trabalho se divide em unidades nomeadas; dentro de cada projeto, o nome é livre.
- **etapas numeradas** (`1-recebido/`, `2-processado/`, `concluido/`, `com-erro/`) — quando o material passa por um fluxo, e a pasta onde o arquivo está é o estado dele.
- **solto** — arquivos avulsos direto em `Files/`.

**O teste que separa `Files/` de `Internal/`:** apagou e **o usuário perde trabalho** → `Files/`. Apagou e **o servidor só refaz** → `Internal/`.

---

## 12. Banco de dados

Um MCP normalmente não tem banco próprio. Quando tem, o arquivo (`.db`, `.sqlite`) **fica em `Files/`** — no caminho configurado, nunca em `Program/`, que é substituído a cada atualização.

### 12.1 Índice ou fonte

| | **Índice** | **Fonte** |
|---|---|---|
| **O que guarda** | Um resumo do que se pode refazer | O dado em si — não há nada por trás |
| **Se apagar** | O MCP relê e reconstrói | **Perdeu** |
| **Pode apagar sozinho?** | Sim | **Nunca** |

> *Se isso for apagado agora, o MCP reconstrói sozinho?* **Sim** → índice. ⚠ **Não** → é fonte, e o servidor jamais pode apagá-lo ou reescrevê-lo sem confirmação — nem para "limpar", nem para "corrigir".
