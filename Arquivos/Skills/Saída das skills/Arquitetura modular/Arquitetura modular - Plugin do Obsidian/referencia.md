# AMF — Referência completa · Arquitetura modular - Plugin do Obsidian

Apoio da skill Arquitetura modular. Abra a seção que a tabela rápida do arquivo principal indicar ("ver N.N"), ou a seção da pasta cuja dúvida é o porquê. Cada seção é autossuficiente.

---

## 4. Não existe arquivo de entrada — existe o manifesto e o ponto de partida

Na versão Desktop, o arquivo de entrada é o que o usuário clica. **Num plugin ele não existe:** o Obsidian carrega você quando abre, e desliga quando o usuário desativa o plugin.

O que ocupa esse lugar são três coisas:

1. **O `manifest.json`** — identificador, nome, versão, **versão mínima do Obsidian**, e se o plugin funciona só no computador ou também no celular.
2. **O `versions.json`** — o histórico de compatibilidade (4.2).
3. **O ponto de partida do seu código**, em `Program/Code/`, que o empacotador (esbuild) transforma em `main.js`. É ele que registra os comandos, os painéis e a aba de opções quando o plugin liga, e desfaz tudo isso quando ele desliga.

### 4.1 Os dois endereços do manifesto

| | Onde | Quem escreve | Para quê |
|---|---|---|---|
| **A fonte** | `manifest.json`, na raiz do projeto | **você** | é o plugin se descrevendo, é onde você edita a versão a cada publicação, e é o que o diretório de plugins da comunidade lê no GitHub |
| **A cópia** | `Distribution/manifest.json` | **o empacotador**, que a copia da raiz | é a que o Obsidian instalado lê, ao lado do `main.js` |

Nunca edite a cópia: ela é substituída na próxima montagem.

#### Exceção de plataforma: o manifesto e o versions.json na raiz

**O que o Obsidian exige:** o diretório de plugins da comunidade (repositório `obsidianmd/obsidian-releases`) lê o `manifest.json` **na raiz do repositório**, no branch padrão, para listar o plugin e para saber qual é a versão mais nova; e o Obsidian procura o `versions.json` **na raiz do repositório** para achar uma versão compatível com quem tem um Obsidian antigo (docs.obsidian.md: "Submit your plugin" e "Reference › Versions").

```
[Nome do projeto]/
├── manifest.json        a FONTE do manifesto — o diretório da comunidade lê daqui
├── versions.json        versão do plugin × versão mínima do Obsidian — o Obsidian lê daqui
├── Program/             a fonte do código — sem manifesto dentro
│   └── Code/
├── Workshop/            o empacotador, configurado para copiar o manifest.json da raiz
└── Distribution/
    └── manifest.json    a cópia, ao lado do main.js e do styles.css
```

**Por quê:** fora da raiz, a loja não acha o plugin e quem já instalou não recebe atualização.

Registre em `Exceções.md` do projeto que os dois moram na raiz por imposição do Obsidian — para ninguém "arrumá-los" de volta para `Program/`.

### 4.2 versions.json

**O que é:** o mapa **versão do plugin × versão mínima do Obsidian** — uma linha por versão publicada, dizendo de que Obsidian ela precisa. O repositório da comunidade o lê para oferecer, a quem tem um Obsidian antigo, a última versão do plugin que ainda funciona nele.

**Onde mora:** na raiz do projeto, ao lado do `manifest.json` — é lá que o Obsidian o procura (4.1). Não vai para `Distribution/`: não é um dos três arquivos. Os dois andam juntos: toda vez que a versão muda no manifesto, uma linha nova entra aqui.

```json
{
  "1.0.0": "1.4.0",
  "1.1.0": "1.5.0"
}
```

**Regra:** só cresce. Linha de versão já publicada nunca se apaga nem se altera.

### 4.3 A regra que o ponto de partida impõe

**Tudo que você registra, você precisa desfazer.** Comando, painel, ouvinte de evento, temporizador, elemento na interface — o Obsidian desativa e reativa plugins sem reiniciar, e o que ficou registrado de uma vez anterior continua lá, duplicado, apontando para código morto.

---

## 5. Program/

**O que é:** tudo que pertence ao plugin, na forma em que você escreve — é a **fonte** de que os três arquivos de `Distribution/` são montados. Quando o usuário atualiza o plugin, é daqui que a versão nova saiu.

**Regras:**
- Todos os nomes aqui dentro são em inglês
- **Tudo aqui acaba dentro do `main.js` publicado, que é legível:** nada sensível entra (seção 13 do arquivo principal)
- Sempre existe, junto com `Code/` — o `manifest.json` e o `versions.json` não moram aqui, e sim na raiz (4.1)
- O Obsidian nunca carrega esta pasta: ele carrega `Distribution/`

---

## 6. Program/Code/

**O que é:** o código que **você** escreveu e que **roda quando o plugin roda** — depois de o empacotador juntá-lo no `main.js`. É o coração do projeto.

### 6.1 A regra que decide onde uma coisa fica

> **Usado por UM módulo** → fica **dentro** desse módulo.
> **Usado por DOIS OU MAIS** módulos → sobe para o nível de `Code/`.
> **Editado em bloco**, independente do código → sobe também.

O princípio: **organize por módulo/funcionalidade, nunca por tipo de arquivo**.

**Nesta plataforma há três pastas de topo que parecem contrariar isso e não contrariam** — `commands/`, `views/` e `settings/`. Elas não agrupam por tipo de arquivo: agrupam por **ponto de entrada do hospedeiro**. Cada uma é um lugar onde o Obsidian oferece a sua funcionalidade ao usuário, e o registro delas é feito na ligação do plugin, junto. Dentro de cada uma, a regra de módulo volta a valer.

### 6.2 commands/ — o que aparece na paleta

**O que é:** os comandos que o usuário encontra na paleta de comandos, e que ele pode associar a um atalho de teclado.

**É a principal porta de entrada de um plugin do Obsidian.** Muita coisa que em outro programa seria um botão, aqui é um comando.

**Organizado por módulo**, um por funcionalidade:

```
commands/
├── indice/
│   ├── indice-comando.ts     registra o comando e trata o clique
│   └── indice-opcoes.ts
└── exportar/
```

**As três regras:**

1. **O comando não tem lógica.** Ele recebe o disparo, chama `backend/` e mostra o resultado. Lógica dentro do comando não se testa e não se reusa por um painel.
2. **O nome do comando é o que o usuário lê** — descritivo, dizendo o que acontece.
3. **Comando que só faz sentido em certa situação diz isso** — o Obsidian permite que ele apareça só quando cabe, e um comando que falha porque "não era hora" é ruído na paleta.

### 6.3 views/ — os painéis

**O que é:** os painéis que abrem na lateral (ou como aba), com o conteúdo que o plugin mostra continuamente.

**Organizado por módulo**, um por painel.

**As três regras:**

1. **O painel é reconstruído.** O usuário fecha, reabre, arrasta para o outro lado, reinicia o Obsidian e o painel volta. Estado que precisa sobreviver não vive nele: vai para o `data.json` (seção 10).
2. **Tudo que o painel registra, ele desfaz ao fechar** — ouvinte de evento, temporizador, observador. Painel que não limpa vaza a cada abertura.
3. **O painel mostra; quem calcula é `backend/`.**

### 6.4 settings/ — a aba de opções

**O que é:** a aba do plugin dentro das opções do Obsidian, onde o usuário escolhe o que quer.

**As duas regras:**

1. **O que o usuário escolheu vai para o `data.json`** (seção 10); **os padrões de fábrica ficam em `constants/`**.
2. **Toda opção precisa de valor padrão, e o código precisa aguentar o `data.json` estar vazio ou vir de uma versão antiga.** Na primeira instalação ele não existe; depois de uma atualização, ele pode ter o formato anterior.

### 6.5 host-bridge/ — a ponte com o hospedeiro

**O que é:** a **única** camada do projeto que conhece a API do Obsidian. Ler nota, escrever nota, listar arquivos, abrir painel, mostrar aviso, saber qual nota está aberta — tudo isso passa por aqui.

**`host-bridge/` não é `clients/` — escreva a diferença:**

| | **`clients/`** | **`host-bridge/`** |
|---|---|---|
| **A frase** | "Eu ligo para um serviço lá fora" | "Eu falo com o programa que me hospeda, de dentro do processo dele" |
| **Onde está o outro** | Noutra máquina, atrás da rede | No mesmo processo, na mesma memória |
| **O que pode dar errado** | Rede, tempo esgotado, serviço fora do ar | **A API mudar na próxima versão do Obsidian** |
| **Exemplo** | Chamar um modelo de linguagem | Ler o conteúdo de uma nota |

**Por que a ponte precisa existir, e por que ela é a regra de ouro desta versão:**

1. **A API do hospedeiro muda entre versões.** Se as chamadas estiverem espalhadas por trinta arquivos, uma atualização do Obsidian quebra o plugin em trinta lugares. Concentradas aqui, quebram em um.
2. **O mesmo plugin roda no Obsidian de computador e no de celular, com APIs de arquivo diferentes.** Só a ponte sabe disso. O resto do código pede "leia essa nota" e não fica sabendo em qual dos dois está rodando.
3. **Sem a ponte, `backend/` não se testa** — porque testar exigiria ter o Obsidian rodando em volta.

**A regra que resume:**

> **Nenhum arquivo fora de `host-bridge/` importa a API do Obsidian.** Se você precisar de uma chamada nova, ela ganha uma função aqui, com nome do seu domínio — não do domínio dele.

### 6.6 frontend/ — pequeno

**O que é:** modais, caixas de confirmação, elementos de interface que não são painel nem aba de opções.

**Por que é pequeno:** porque a interface de um plugin bem-comportado é, em ordem: um comando na paleta, um painel na lateral, uma aba nas opções. Modal se usa para perguntar algo curto — e o Obsidian já oferece as formas prontas.

**Um plugin não constrói uma interface própria por cima do Obsidian.** Ele se encaixa na dele. Um `frontend/` grande é sinal de que o projeto está brigando com o hospedeiro em vez de usá-lo.

**Nota sobre estilo:** o que é publicado é um `styles.css` só, que o empacotador junta a partir dos estilos dos módulos. Use as variáveis de tema do Obsidian: o usuário pode ter qualquer tema instalado, e cor fixa fica ilegível na metade deles.

### 6.7 backend/ — a lógica de verdade

**O que é:** onde mora o que o plugin realmente faz — analisar as notas, gerar o índice, transformar o texto, calcular o que vai no painel.

**A regra que o mantém saudável: `backend/` não conhece o Obsidian.** Ele recebe conteúdo e devolve conteúdo; quem busca e quem grava é a ponte. Assim ele se testa sem o hospedeiro em volta, e sobrevive à próxima mudança de API.

**Organizado pelos mesmos módulos de `commands/` e `views/`**, quando fizer sentido. Pode ter módulo só de backend, sem comando nem painel — isso é normal.

### 6.8 clients/ e a ausência de server/

**`clients/`** — o código que **liga para fora**: modelo de linguagem, API de dados, serviço de sincronização de terceiro. Um arquivo por serviço externo.

**Aqui vale um aviso próprio:** o usuário do Obsidian escolheu um programa que funciona sem internet e guarda tudo na máquina dele. **Toda chamada para fora precisa ser opcional, visível e desligável** — e nada sai do vault sem ele saber (seção 13 do arquivo principal).

**`server/` não existe.** Ninguém liga para um plugin: ele não tem endereço e só existe enquanto o Obsidian está aberto.

### 6.9 utils/ · constants/ · types/

- **`utils/`** — funções pequenas e reutilizáveis sem dependência de módulo. Se uma função aparece em 2 lugares, ela vem para cá.
- **`constants/`** — valores fixos que aparecem em vários lugares, **e os padrões de fábrica** de tudo que está em `settings/`.
- **`types/`** — a forma dos dados. Um arquivo por entidade principal; tipo usado por um módulo só fica dentro dele.

### 6.10 prompts/

**O que é:** os prompts que o plugin manda para um modelo de linguagem, e os esquemas de saída estruturada de cada um.

**Por que fica no topo de `Code/`:** porque prompt tem **modo de trabalho próprio** — você senta para "mexer nos prompts", revisa vários, compara o tom. É a exceção deliberada de sempre à regra 6.1.

**Regras:**

1. **Uma subpasta por módulo** que conversa com IA. Nunca uma lista solta.
2. **O nome da subpasta é o nome real do módulo.**
3. **O prompt é sempre `.txt`.**
4. **O esquema é sempre `.json`, com nome idêntico ao do prompt.**
5. **Prompt sem saída estruturada simplesmente não tem `.json`.**

**Duas perguntas que vêm junto:**
- **De quem é a chave?** Não pode ser sua — o `main.js` é legível. Ela é do usuário, digitada em `settings/`, e **o `data.json` viaja com o vault** (seção 10.1).
- **O conteúdo das notas vai para o modelo?** Então isso precisa estar dito, ser opcional e ser desligável. É o dado mais privado que existe no Obsidian.

### 6.11 A lista de dependências

O `package.json` — o arquivo que **lista** as bibliotecas que o npm instala — **não fica em `Code/`**: ele é configuração do gerenciador de pacotes, e mora em `Workshop/`, junto com o `node_modules/` que o npm cria ao lado dele (seção 9.3).

**E toda biblioteca entra no `main.js`**, aumentando o que o usuário baixa e o que ele carrega a cada abertura do Obsidian. Cada uma precisa se justificar.

---

## 7. Program/Assets/

**O que é:** o que o plugin **mostra ou toca** e que você fez ou escolheu — imagem (inclusive SVG e ícone), fonte, áudio, vídeo. É substituído no update, como `Code/`.

**O critério é a FUNÇÃO do arquivo, não a extensão.** `Code/` guarda o que se **escreve** como parte do programa: código em qualquer linguagem, HTML, CSS, prompt (mesmo em `.txt` — um `.txt` que é prompt é estrutura do programa e fica em `Code/prompts/`), JSON, esquema, texto traduzido. `Assets/` guarda o que se **vê ou ouve**. Teste: *"a forma normal de mexer nisso é editar linha a linha num editor de código?"* Sim → `Code/`. Não (foi feito noutro programa, ou se olha/escuta) → `Assets/`.

**Subpastas:** `icons/`, `images/`, `fonts/`, `audio/`, `video/`. Quando o recurso é de **um módulo só**, subpasta com o nome do módulo dentro do tipo: `Assets/images/indice/`.

**Regra:** nada binário ou de mídia em `Code/`; nada que se escreve em `Assets/`.

**Nesta plataforma:** um plugin do Obsidian quase não tem mídia — o Obsidian traz um conjunto de ícones pronto, e ícone próprio é SVG escrito dentro do código (fica em `Code/`, é código). O que for imagem, som ou fonte de verdade vai para `Assets/`, e o empacotador o embute no `main.js` ou no `styles.css` — `Distribution/` continua tendo só três arquivos.

---

## 8. Workshop/

**O que é:** o que existe **para você desenvolver**, e que o plugin nunca executa. É uma pasta de nível 1, irmã de `Program/` — não fica dentro dele.

> **Tudo que existe só no desenvolvimento mora aqui, e nada daqui vai publicado.**

Apagar `Workshop/` inteiro não afeta o plugin já instalado. Você é que deixa de conseguir testá-lo, montá-lo de novo e reinstalar as bibliotecas.

**A pergunta que separa de `Program/Code/`:** *isso vai para dentro do `main.js`?* Se sim → `Program/`. Se só você executa, no desenvolvimento → `Workshop/`.

| O que mora aqui | Exemplo |
|---|---|
| `tests/` | os testes automáticos — 8.1 |
| `scripts/` | chamar o empacotador, ligar o atalho no vault de teste, publicar — 8.2 |
| `package.json` · `node_modules/` | a lista e a pasta do npm — seção 9.3 |
| a configuração do empacotador | a do esbuild — 8.3 |
| a configuração do compilador | o `tsconfig.json` do TypeScript — 8.3 |
| a configuração das outras ferramentas | a do executor de testes, a do verificador de estilo |
| o cache das ferramentas | o que o empacotador e o compilador guardam sozinhos — seção 10.3 |
| `.env.example` · `.env` | as variáveis do seu ambiente de desenvolvimento. O `.env.example` se versiona; o `.env` nunca — seção 13 do arquivo principal |

### 8.1 tests/

**O que é:** arquivos de código que chamam o seu código e verificam se a resposta bateu. Você roda no terminal quando quer conferir.

**Regra: espelha o caminho de `Program/Code/`, não o conteúdo.** Só existe pasta onde existe teste.

```
Program/Code/backend/indice/gerador.ts   →   Workshop/tests/backend/indice/gerador_test.ts
```

**É a ponte que torna o teste possível.** Como `backend/` não conhece o Obsidian (6.7), ele se testa sozinho: entra texto, sai texto. Tudo que precisa do hospedeiro fica atrás de `host-bridge/`, e no teste a ponte é substituída por uma versão falsa.

**Os testes que mais pagam nesta plataforma:**
1. **Nota com formatação estranha** — o vault real é bagunçado: nota vazia, título repetido, caractere esquisito, arquivo enorme.
2. **`data.json` ausente ou de versão antiga** — a primeira instalação e a atualização.
3. **Desativar e reativar o plugin** — confere se tudo que foi registrado foi desfeito (seção 4.3).

### 8.2 scripts/

**O que é:** automações de desenvolvimento e publicação. **Aqui elas são obrigatórias**, porque sem empacotador não há plugin:

- **montar** — chamar o empacotador, que escreve os três arquivos em `Distribution/`; no desenvolvimento, em modo de observação
- **ligar o atalho** — criar, no vault de teste, o atalho de pasta para `Distribution/` (seção 2.3 do arquivo principal)
- **publicar** — conferir que a versão do `manifest.json` ganhou linha no `versions.json`, e anexar os três arquivos de `Distribution/` à versão

**Regra:** nomear pelo que fazem — `montar.sh`, `ligar-vault-de-teste.sh`, `publicar.sh` — nunca apenas `run.sh`.

### 8.3 A configuração do empacotador e a do compilador

As duas moram em `Workshop/`, e nenhuma nasce "onde der":

| Ferramenta | O que faz | A configuração |
|---|---|---|
| **o empacotador** — esbuild | junta o código de `Program/Code/` e as bibliotecas num `main.js`, os estilos num `styles.css`, e copia o `manifest.json` | o arquivo de configuração do esbuild, em `Workshop/` |
| **o compilador** — TypeScript | confere os tipos do código | o `tsconfig.json`, em `Workshop/` |

Na configuração do empacotador se declara:
- **a entrada** — o ponto de partida em `Program/Code/`;
- **o destino** — `Distribution/`, e nenhum outro;
- **a cópia** — o `manifest.json` da raiz para `Distribution/manifest.json`;
- **o que fica de fora do `main.js`** — a própria API do Obsidian, que o hospedeiro fornece quando carrega o plugin;
- **onde procurar as bibliotecas** — `Workshop/node_modules/` (seção 9.3).

---

## 9. Program/External/ e as dependências

As duas guardam o que **outro** escreveu e você não edita. O que as separa é **quem pôs lá**.

### 9.1 A diferença, numa tabela

| | `External/` | a pasta do gerenciador de pacotes |
|---|---|---|
| **quem põe lá** | **você**, à mão | um comando do npm |
| **versiona?** | sim | **nunca** |
| **apagou, volta sozinha?** | não — você baixa de novo à mão | sim, um comando recria |
| **onde mora, nesta plataforma** | `Program/External/` | `Workshop/node_modules/` — seção 9.3 |

**Regra das duas:** se você editar um arquivo daqui, ele está no lugar errado. Código que você mantém pertence a `Code/`.

### 9.2 Program/External/ — só libraries/

Tudo acaba dentro do `main.js`. Por isso, das quatro pastas de `External/`, só uma cabe num plugin do Obsidian:

| Pasta | O que acontece aqui |
|---|---|
| `tools/` | **Não existe.** Um plugin não executa programa de fora — e no celular nem haveria onde |
| `libraries/` | A biblioteca que você baixou e colou à mão; o empacotador a junta ao `main.js`, como o seu código. Se ela vem pelo npm, não passa por aqui (9.3) |
| `runtimes/` | **Não existe.** O Obsidian é quem roda o seu código |
| `ai-models/` | **Não existe.** Modelo grande não cabe num `main.js`; se houver modelo, ele é chamado por `clients/` ou roda num programa local |

### 9.3 A pasta de dependências mora em Workshop/

**O teste — apague a pasta de dependências e rode o plugin já montado. Funcionou?**

| Resposta | Por quê | Então ela é |
|---|---|---|
| **Sim** | o empacotador já copiou para dentro do `main.js` o pedaço de biblioteca que o código usa; a pasta cumpriu o papel e virou entulho | **do desenvolvimento** → `Workshop/` |
| **Não** | o programa procura a biblioteca na hora de rodar; sem ela, nem liga | **do programa** → `Program/Dependencies/` |

**Num plugin do Obsidian, a resposta é sempre "sim".** O Obsidian só carrega os três arquivos, e o empacotador leva para o `main.js` o que o código usa. Por isso `Program/Dependencies/` não existe nesta plataforma, e o `package.json` e o `node_modules/` moram juntos em `Workshop/` — o npm cria o `node_modules/` ao lado do `package.json`.

**Diga ao empacotador onde procurar.** A busca do Node sobe a partir do arquivo que importa — olha na pasta, não achou, sobe um nível — e **nunca entra em pasta irmã**: de `Program/Code/`, ela não chega sozinha a `Workshop/node_modules/`. Aponte o caminho na configuração do esbuild (`nodePaths`) e no `tsconfig.json` (`paths`).

**Regras:**
- **Nunca versionar** o `node_modules/`. O que se versiona é a **lista** (`package.json`, com o arquivo de trava de versões ao lado).
- Nunca editar à mão. Se precisa mudar, muda a lista e reinstala.

---

## 10. Program/Internal/ — o data.json

Na versão Desktop, `Internal/` é uma pasta com sete subpastas em disco. **Aqui, ela não é pasta do projeto: quase tudo vira um único `data.json`, que a API do Obsidian guarda por você** — você entrega um objeto, ele grava; você pede, ele devolve. O arquivo fica na pasta do plugin, **dentro do vault do usuário**.

| Conceito | Para onde foi |
|---|---|
| `config/` | `data.json` — o que o usuário escolheu em `settings/` |
| `state/` | `data.json` — o que o plugin lembra sozinho |
| `cache/` | `data.json`, se valer a pena guardar; ou reconstruído ao abrir — ver 10.2 |
| `queue/` | `data.json`, se precisar sobreviver a fechar o Obsidian |
| `logs/` | **Console do Obsidian** — o que o usuário precisa ver aparece como aviso na tela |
| `temp/` | Memória da sessão — morre ao desativar o plugin |
| `credentials/` | **Sem lugar seguro** — ver 10.1 |

### 10.1 Nada de segredo no data.json — ele viaja com o vault

> **O `data.json` fica dentro da pasta do plugin, dentro do vault.** E o vault do usuário costuma estar sincronizado para a nuvem dele, versionado num repositório, ou copiado entre computadores.

**A consequência:** chave de API guardada ali vai junto para todos esses lugares. Não há como impedir.

**O que fazer:**
- **Diga na aba de opções onde a chave será guardada** e o que isso significa. É a honestidade mínima.
- **Ofereça o botão de apagar.**
- **Não guarde nada além do necessário** — e jamais conteúdo de nota junto da configuração.

### 10.2 As regras que sobrevivem

1. **Nada disso se versiona** no seu repositório — é do usuário.
2. **`state` × `config`:** se o `state` sumir, o usuário nem nota; se o `config` sumir, ele reclama. Mesmo morando no mesmo arquivo, são coisas diferentes.
3. **`constants/` × `config`:** `constants/` é o padrão de fábrica, que vem com o plugin e é substituído na atualização; o que o usuário escolheu **não pode** ser substituído.
4. **Cuidado com o tamanho.** O `data.json` é lido inteiro toda vez que o plugin liga. Cache grande ali deixa o Obsidian lento na abertura — e cache que se reconstrói talvez não precise ser guardado.
5. **Escreva pouco.** Gravar a cada tecla mexe num arquivo dentro do vault sincronizado, e isso gera conflito de sincronização para o usuário.

### 10.3 O cache das ferramentas mora em Workshop/

O que a ferramenta gera sozinha — `*.tsbuildinfo`, o cache do empacotador, `.eslintcache` — **nunca fica em `Code/`** nem em `Distribution/`. Na versão Desktop ele vai para `Internal/cache/`; aqui `Internal/` não é pasta do projeto, e cache de ferramenta é do desenvolvimento, então ele mora em `Workshop/` (a regra da pasta que ninguém previu, seção 14.1 do arquivo principal). Aponte-o na configuração da ferramenta (TypeScript: `tsBuildInfoFile`). Se a ferramenta não permitir apontar, registre em `Exceções.md`.

---

## 11. Onde o trabalho do usuário mora — é o vault

> **Onde o trabalho do usuário mora nesta plataforma:** no **vault** — as notas dele, anos de escrita, num programa que ele escolheu justamente por os arquivos serem dele. O vault **está fora do projeto**: nenhuma pasta de `[Nome do projeto]/` o representa.
> **O que você tem permissão de escrever lá:** tudo, dentro do vault, e só dentro dele — e **você escreve nele**. É o único lugar da AMF em que o programa tem a caneta na mão sobre o trabalho do usuário.

### 11.1 As cinco regras

1. ⚠ **Nunca apagar ou reescrever nota sem confirmação.** As notas são o trabalho dele. Uma substituição errada em cima de uma nota de dez anos não tem desfazer que resolva depois que o Obsidian fechou.
2. **Nunca escrever fora do vault.** O plugin não tem nada a fazer no resto do disco do usuário, e no celular isso nem seria possível. Todo acesso passa pela ponte, que pergunta ao Obsidian onde o vault está.
3. **Alteração em massa avisa antes e diz quantas notas serão tocadas.** "Renomear todos os títulos" é uma operação de trezentas notas, e o usuário precisa ver o número antes do sim.
4. **Prefira acrescentar a substituir.** Criar uma nota nova, acrescentar uma seção, escrever num lugar previsível — tudo isso é reversível de cabeça. Reescrever o corpo inteiro, não.
5. **Respeite o que é dele:** o formato do texto, os nomes das notas, a estrutura de pastas, as etiquetas. Um plugin não reorganiza o vault a seu gosto.

### 11.2 Os três formatos

Mesmo dentro do vault, o trabalho que o **seu plugin** gera pode se organizar de três jeitos — e a escolha é uma opção que o usuário deve poder mudar:

**Formato 1 — unidades nomeadas:** uma nota (ou pasta) por unidade de trabalho que o plugin cria. É o mais comum: um índice, um resumo, um mapa.

**Formato 2 — fluxo:** notas passam por etapas, marcadas por propriedade ou por pasta. Se a marcação for por pasta, você está movendo arquivos do usuário: confirme.

**Formato 3 — nada:** o plugin só lê e mostra, sem gerar arquivo. **É o formato mais seguro**, e mais projetos caberiam nele do que se imagina.

### 11.3 Onde o plugin escreve

**Escolha um lugar e deixe o usuário mudá-lo** em `settings/`:

- **Uma pasta dedicada do plugin** — arrumado, fácil de apagar, fácil de ignorar na busca
- **Ao lado da nota de origem** — bom quando o resultado pertence àquela nota
- **Onde o usuário mandar** — a opção mais respeitosa, e a que vale como padrão

**Nunca espalhe arquivos pelo vault sem um padrão** — o usuário precisa conseguir achar e apagar tudo que o plugin criou, se desinstalar.

### 11.4 O plugin roda em dois lugares

**O mesmo plugin roda no Obsidian de computador e no de celular, com APIs de arquivo diferentes.** No celular não há sistema de arquivos como você conhece, não há processo externo, e a memória é menor.

**Isso se isola na ponte** (6.5). E o `manifest.json` declara se o plugin funciona só no computador — declarar isso honestamente é melhor do que quebrar no celular de quem instalou.

**O teste que separa trabalho de `Internal/`:** apagou e **o usuário perde trabalho** → é nota, no vault. Apagou e **o plugin só refaz** → é o `data.json`, no lugar de `Internal/`.

---

## 12. Banco de dados

Não há banco. O que o plugin guarda vai para o `data.json` (seção 10), e o que ele produz vai para o vault (seção 11).

### 12.1 Índice ou fonte

| | **Índice** | **Fonte** |
|---|---|---|
| **O que guarda** | Um resumo das notas, para achar rápido | O dado em si — não há nota por trás |
| **Se apagar** | O plugin relê o vault e reconstrói | **Perdeu** |
| **Pode apagar sozinho?** | Sim | **Nunca** |

> *Se eu apagar isso agora, o plugin reconstrói lendo o vault?* **Sim** → índice, e pode viver no `data.json`. **Não** → é fonte, e **fonte não deve morar no `data.json`: ela deve ser uma nota**, no vault, visível e do usuário.

**É a regra que mais protege o usuário nesta plataforma:** o que é trabalho dele fica em nota, no formato dele, que ele consegue ler mesmo depois de desinstalar o plugin. Enterrar trabalho num `data.json` é prendê-lo ao seu plugin.
