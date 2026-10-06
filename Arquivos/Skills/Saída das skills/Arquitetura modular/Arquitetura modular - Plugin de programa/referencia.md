# AMF — Referência completa · Arquitetura modular - Plugin de programa (o molde)

Apoio da skill Arquitetura modular. Abra a seção que a tabela rápida do arquivo principal indicar ("ver N.N"), ou a seção da pasta cuja dúvida é o porquê. Cada seção é autossuficiente. Onde uma seção depende do hospedeiro, ela diz qual das cinco perguntas do arquivo principal responde — e a resposta está em `Convenções.md`.

> Auditada em 22/09/2026 contra a documentação oficial de: VS Code (extension host, armazenamento, Workspace Trust) · IntelliJ Platform SDK (`plugin.xml`, `PersistentStateComponent`) · Figma Plugin API (manifesto, caixa de areia, `setPluginData`) · Blender 5.2 LTS (extensões: `blender_manifest.toml`, permissões, `extension_path_user`) · Photoshop UXP (manifesto v5, `requiredPermissions`, `getDataFolder`, `secureStorage`) · Office Add-ins (componentes, persistência de estado) · WordPress Plugin Handbook (cabeçalho) · Godot (plugins de editor) · Unity (layout de pacote) · GIMP 3 (plug-in em Python) · Home Assistant (manifesto de integração). Resultado: as quatro perguntas originais valem em todos; faltava a quinta — o que o plugin pode tocar.

---

## 4. Não existe arquivo de entrada — existe o manifesto

Na versão Desktop, o arquivo de entrada é o que o usuário clica. **Num plugin ele não existe:** o hospedeiro carrega você, quando ele decide.

O que ocupa esse lugar é o **manifesto**, no formato dele. É ele que declara o nome do plugin, a versão, **quais versões do hospedeiro são suportadas**, e o que o plugin acrescenta ao programa — um item de menu, um painel, um efeito, um comando.

### 4.1 Os dois endereços do manifesto — pergunta 1

| | Onde | Quem escreve |
|---|---|---|
| **A fonte** | `Program/`, com o nome exato que o hospedeiro exige | **você** — é onde se edita a versão |
| **A cópia** | dentro do pacote, em `Distribution/`, no lugar que o hospedeiro exige | **o empacotador**, que a copia |

A pergunta 1 diz o nome e o lugar dentro do pacote. A fonte fica em `Program/`, ao lado do código que ela descreve, e não em `Program/Code/`: não é código, é a ficha do plugin. Nunca edite a cópia: ela é substituída na próxima montagem.

**Quando não há arquivo de manifesto.** Alguns hospedeiros não têm ficha separada: no WordPress, ela é um comentário de cabeçalho no arquivo PHP principal (o único campo obrigatório é o nome do plugin); no GIMP 3, não há manifesto — o plug-in se registra no próprio código, e a pasta tem de ter o nome do arquivo principal. Aí a resposta da pergunta 1 é essa: o arquivo principal é código e fica em `Code/`, e o empacotador o põe — e dá à pasta o nome — onde o hospedeiro exige, em `Distribution/`.

### 4.2 Três consequências práticas

1. **O plugin liga e desliga dentro de uma sessão do hospedeiro.** Tudo que ele registra ao ligar — painel, item de menu, ouvinte de evento, temporizador — precisa ser desfeito ao desligar. Registro que não é desfeito duplica na próxima ativação e aponta para código morto.
2. **Declare as versões suportadas honestamente.** É melhor recusar carregar numa versão nova não testada do que quebrar dentro dela — porque quando o plugin quebra, o usuário culpa o programa, e depois você.
3. **O formato do manifesto é a única parte que a AMF não organiza.** Ela diz só onde a fonte mora; o conteúdo é do hospedeiro.

---

## 5. Program/

**O que é:** tudo que pertence ao plugin, na forma em que você escreve — é a **fonte** de que o pacote é montado. Quando o usuário atualiza o plugin, é daqui que a versão nova saiu.

**Regras:**
- Todos os nomes aqui dentro são em inglês, exceto os que o hospedeiro impõe
- **Tudo aqui roda com os privilégios do hospedeiro** — ou, numa caixa de areia, com o que o manifesto pediu (pergunta 5, seção 13 do arquivo principal). Nada entra sem você saber o que é
- Sempre existe, junto com o manifesto, `Code/` e `External/libraries/`
- O hospedeiro nunca carrega esta pasta: ele instala o pacote de `Distribution/`

---

## 6. Program/Code/

**O que é:** o código que **você** escreveu e que **roda quando o plugin roda**. É o coração do projeto.

### 6.1 A regra que decide onde uma coisa fica

> **Usado por UM módulo** → fica **dentro** desse módulo.
> **Usado por DOIS OU MAIS** módulos → sobe para o nível de `Code/`.
> **Editado em bloco**, independente do código → sobe também.

O princípio: **organize por módulo/funcionalidade, nunca por tipo de arquivo**. Uma pasta que junta "todos os painéis" ou "todos os efeitos" agrupa por tipo — e separa o arquivo do código que o usa.

**`host-bridge/` é a exceção deliberada**, e ela vem a seguir.

### 6.2 host-bridge/ — a regra de ouro desta versão

**O que é:** a **única** camada do projeto que conhece a API do hospedeiro. Ler o documento aberto, alterar a linha do tempo, criar uma camada, mostrar um aviso, abrir um painel, saber o que o usuário selecionou — tudo isso passa por aqui.

> **A REGRA DE OURO: só esta camada conhece a API do hospedeiro. Ela quebra a cada versão do programa — se estiver espalhada, o plugin inteiro quebra junto.**

**Por que essa é a regra mais importante de toda esta versão:**

O hospedeiro não é seu. Ele é atualizado quando o fabricante quiser, sem avisar você, e a cada atualização a API muda: uma função sai, um parâmetro vira outro, um objeto passa a se chamar diferente. **Isso não é acidente — é o normal desta plataforma.**

- **Com a ponte:** a atualização quebra **um** arquivo. Você conserta ali, testa, publica.
- **Sem a ponte:** ela quebra em trinta lugares, e cada versão nova do programa vira uma refatoração.

**E há um segundo ganho:** o hospedeiro roda em versões diferentes na máquina de cada usuário. A ponte é onde a diferença entre elas se resolve — o resto do código pede "me dê a seleção atual" e não fica sabendo qual versão respondeu.

**`host-bridge/` não é `clients/` — escreva a diferença:**

| | **`clients/`** | **`host-bridge/`** |
|---|---|---|
| **A frase** | "Eu ligo para um serviço lá fora" | "Eu falo com o programa que me hospeda, de dentro dele" |
| **Onde está o outro** | Noutra máquina, atrás da rede | Na mesma máquina, do outro lado da API — no processo dele, ou num que ele abriu para você (o VS Code roda as extensões num processo à parte; o Figma, numa caixa de areia) |
| **O que pode dar errado** | Rede, tempo esgotado, serviço fora do ar | **A API mudar na próxima versão do programa** |
| **Exemplo** | Chamar um modelo de linguagem | Ler a linha do tempo do projeto aberto |

**A regra que resume:**

> **Nenhum arquivo fora de `host-bridge/` importa o SDK do hospedeiro.** Se você precisar de uma chamada nova, ela ganha uma função aqui, com nome do **seu** domínio — não do domínio dele.

Esse último detalhe é o que faz a ponte funcionar: se as funções dela repetirem os nomes da API do hospedeiro, ela vira um repasse inútil e quebra junto. A ponte traduz: `pegarTrechosSelecionados()`, não `getActiveSequenceSelection()`.

### 6.3 frontend/ — o painel embutido

**O que é:** a interface do plugin dentro do programa — o painel encaixado, a caixa de diálogo, os campos e botões.

**No formato que ele aceita.** Cada hospedeiro tem o seu: alguns embutem uma página web, outros têm um conjunto próprio de componentes, outros permitem só uma lista de campos declarados. **Você não escolhe** — e é por isso que esta pasta muda tanto de programa para programa.

**Organizado por módulo**, um por funcionalidade, quando há mais de um painel ou seção.

**As três regras:**

1. **O plugin se encaixa na interface do hospedeiro, não constrói outra por cima.** Um painel que ignora o visual do programa parece invasor — e o usuário está ali para usar o programa, não o seu plugin.
2. **O painel é reconstruído** — o usuário fecha, reabre, arrasta para outra área, reinicia o programa. Estado que precisa sobreviver não vive nele (seção 10).
3. **O painel mostra; quem calcula é `backend/`.**

### 6.4 backend/ — a lógica que não sabe quem é o hospedeiro

**O que é:** a lógica de verdade do plugin — o cálculo, a transformação, a análise, a regra.

> **`backend/` não deve saber quem é o hospedeiro.** Ele recebe dados e devolve dados; quem busca e quem aplica é a ponte.

**Por que isso importa tanto aqui:** porque é o que **sobrevive** à próxima versão do programa. Quando a API mudar, `backend/` continua igual — só a ponte muda. E, de quebra, ele se testa sem o hospedeiro em volta (seção 8.1), o que nesta plataforma é a diferença entre ter teste e não ter.

**Organizado por módulo**, os mesmos de `frontend/` quando ambos existem. Pode ter módulo só de backend — isso é normal.

### 6.5 clients/ e a ausência de server/

**`clients/`** — o código que **liga para fora**: modelo de linguagem, API de dados, serviço de arquivos. Um arquivo por serviço externo.

**Três avisos próprios desta plataforma:**
1. **A chamada não pode travar o hospedeiro.** Se o plugin roda na mesma linha de execução da interface do programa, uma espera de rede congela o programa inteiro — e o usuário culpa o programa.
2. **O usuário não espera que um plugin mande conteúdo para fora.** Se o plugin envia parte do trabalho dele, isso precisa estar dito e ser desligável (seção 13 do arquivo principal).
3. **A rede pode estar fechada, ou aberta só para os endereços que o manifesto pediu** — é a pergunta 5. No Figma, o plugin só alcança os domínios listados no manifesto; no Photoshop pelo UXP, o que não foi declarado não é concedido; no Blender, o manifesto declara o acesso à rede com o motivo, e o código confere se o usuário liberou o acesso online antes de sair. Confirme antes de desenhar em cima disso.

**`server/` não existe.** Ninguém liga para um plugin: ele não tem endereço e só existe enquanto o hospedeiro está aberto. Se a necessidade for essa — alguém de fora chamar o programa —, o projeto é um **MCP**, não um plugin (a régua no topo do arquivo principal).

### 6.6 utils/ · constants/ · types/

- **`utils/`** — funções pequenas e reutilizáveis sem dependência de módulo. Se uma função aparece em 2 lugares, ela vem para cá. Utilitário que precisa do hospedeiro não é utilitário: pertence à ponte.
- **`constants/`** — valores fixos que aparecem em vários lugares, **e os padrões de fábrica** das opções do plugin.
- **`types/`** — a forma dos dados. **Aqui eles ganham um papel extra:** é em `types/` que vive o formato **do seu domínio** — o que o seu código chama de "trecho", "camada", "seleção". A ponte traduz o formato do hospedeiro para esse, e é isso que permite `backend/` não conhecê-lo.

### 6.7 locales/

**O que é:** os textos da interface separados por idioma.

**Se o hospedeiro tiver mecanismo de tradução, use o dele** — assim o plugin acompanha o idioma que o usuário escolheu no programa. Se o mecanismo dele exigir nome e lugar fixos dentro do pacote, a fonte continua em `Code/locales/` e o empacotador a escreve onde ele exige, em `Distribution/`. Se não houver mecanismo, uma lista por idioma, aqui.

**Regra:** só crie se o plugin **for** ter mais de um idioma.

### 6.8 prompts/

**O que é:** os prompts que o plugin manda para um modelo de linguagem, e os esquemas de saída estruturada de cada um.

**Por que fica no topo de `Code/`:** porque prompt tem **modo de trabalho próprio** — você senta para "mexer nos prompts", revisa vários, compara o tom. É a exceção deliberada de sempre à regra 6.1.

**Regras:**

1. **Uma subpasta por módulo** que conversa com IA. Nunca uma lista solta.
2. **O nome da subpasta é o nome real do módulo.**
3. **O prompt é sempre `.txt`.**
4. **O esquema é sempre `.json`, com nome idêntico ao do prompt.**
5. **Prompt sem saída estruturada simplesmente não tem `.json`.**

**A pergunta que vem junto:** de quem é a chave? O pacote instalado está na máquina do usuário e pode ser aberto — **chave sua não fica segura ali**. Ou ela é do usuário, informada por ele e guardada no cofre do sistema (seção 10), ou o modelo roda localmente.

### 6.9 A lista de dependências

`requirements.txt`, `package.json` — o arquivo que **lista** as bibliotecas que o gerenciador de pacotes instala — **não fica em `Code/`**: ele é configuração do gerenciador de pacotes, e mora em `Workshop/` (seção 8). A exceção do Node que roda direto, sem empacotador, está na seção 9.3.

---

## 7. Program/Assets/

**O que é:** o que o plugin **mostra ou toca** e que você fez ou escolheu — imagem (inclusive SVG e ícone), fonte, áudio, vídeo. É substituído no update, como `Code/`.

**O critério é a FUNÇÃO do arquivo, não a extensão.** `Code/` guarda o que se **escreve** como parte do programa: código em qualquer linguagem, HTML, CSS, prompt (mesmo em `.txt` — um `.txt` que é prompt é estrutura do programa e fica em `Code/prompts/`), JSON, esquema, texto traduzido. `Assets/` guarda o que se **vê ou ouve**. Teste: *"a forma normal de mexer nisso é editar linha a linha num editor de código?"* Sim → `Code/`. Não (foi feito noutro programa, ou se olha/escuta) → `Assets/`. Um ícone SVG é texto, mas se mexe num editor de desenho: `Assets/`.

**Subpastas:** `icons/`, `images/`, `fonts/`, `audio/`, `video/`. Quando o recurso é de **um módulo só**, subpasta com o nome do módulo dentro do tipo: `Assets/images/legenda/`. Modelo de IA baixado **não** é asset: fica em `External/ai-models/`.

**Regra:** nada binário ou de mídia em `Code/`; nada que se escreve em `Assets/`.

**Nesta plataforma:** **no formato do hospedeiro, e no lugar dele quando ele exigir.** Alguns pedem os ícones em tamanhos e locais fixos dentro do pacote; onde isso acontecer, a fonte continua em `Program/Assets/`, o empacotador copia para o lugar exigido em `Distribution/`, e o manifesto aponta para lá.

---

## 8. Workshop/

**O que é:** o que existe **para você desenvolver**, e que o plugin nunca executa. É uma pasta de nível 1, irmã de `Program/` — não fica dentro dele.

> **Tudo que existe só no desenvolvimento mora aqui, e nada daqui vai no pacote instalado.**

Apagar `Workshop/` inteiro não afeta o plugin já instalado. Você é que deixa de conseguir testá-lo, empacotá-lo e reinstalar as bibliotecas.

**A pergunta que separa de `Program/Code/`:** *isso roda quando o hospedeiro liga o plugin?* Se sim → `Program/`. Se só você executa, no desenvolvimento → `Workshop/`.

| O que mora aqui | Exemplo |
|---|---|
| `tests/` | os testes automáticos — 8.1 |
| `scripts/` | empacotar, instalar no hospedeiro de teste, publicar — 8.2 |
| a lista de dependências | `requirements.txt`, `package.json` — a exceção do Node está em 9.3 |
| a configuração das ferramentas | a do empacotador ou da ferramenta de pacote do hospedeiro, a do compilador, a do executor de testes |
| o cache das ferramentas | o que o empacotador e o compilador guardam sozinhos — seção 10.3 |
| `.env.example` · `.env` | as variáveis do seu ambiente de desenvolvimento. O `.env.example` se versiona; o `.env` nunca — seção 13 do arquivo principal |
| a pasta de dependências | só quando o empacotador já leva as bibliotecas para dentro do pacote — seção 9.3 |

### 8.1 tests/

**O que é:** arquivos de código que chamam o seu código e verificam se a resposta bateu. Você roda no terminal quando quer conferir.

**Regra: espelha o caminho de `Program/Code/`, não o conteúdo.** Só existe pasta onde existe teste.

```
Program/Code/backend/legenda/gerador.ts   →   Workshop/tests/backend/legenda/gerador_test.ts
```

**É a ponte que torna o teste possível.** Como `backend/` não conhece o hospedeiro (6.4), ele se testa sozinho: entram dados, saem dados. Tudo que precisa do programa fica atrás de `host-bridge/`, e no teste a ponte é substituída por uma versão falsa. **Sem essa separação, testar um plugin exigiria abrir o programa a cada vez — e na prática significa não testar.**

**O teste que só existe nesta plataforma: testar em VÁRIAS versões do programa hospedeiro.** A API muda entre versões, e os seus usuários não estão todos na mesma. Mantenha uma lista das versões que o plugin declara suportar e **exercite a ponte em cada uma delas** antes de publicar — é a ponte que quebra, e é nela que o teste precisa bater.

Os outros dois testes que pagam:
1. **Documento estranho** — vazio, enorme, com estrutura inesperada, com nome esquisito.
2. **Ligar e desligar o plugin** na mesma sessão do hospedeiro, conferindo que nada duplicou.

### 8.2 scripts/

**O que é:** automações de desenvolvimento e publicação. **Aqui uma delas é obrigatória:**

- **empacotar no formato do hospedeiro** — chamar o empacotador, que escreve `Distribution/`; o formato, a estrutura interna e a assinatura, quando houver, são ditados pelo hospedeiro (pergunta 2)
- **instalar no hospedeiro de teste** — copiar ou ligar por atalho o pacote de `Distribution/` na pasta de plugins dele, para desenvolver com o plugin rodando de verdade
- **publicar**, se o hospedeiro tiver uma loja ou repositório

**Regra:** nomear pelo que fazem — `empacotar.sh`, `instalar-local.sh` — nunca apenas `run.sh`.

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

### 9.2 Program/External/ — aqui ele é importante

**`libraries/` — o SDK do hospedeiro.** O kit de desenvolvimento que o fabricante do programa distribui — os arquivos que permitem ao seu código falar com ele. Fica aqui, e não em `Code/`, porque **não é seu**: você o baixa do fabricante, não edita, e quando o hospedeiro lança uma versão nova, **substitui inteiro**. É a definição de `External/`.

1. **Anote a versão do SDK** — é ela que amarra o plugin às versões do hospedeiro que ele suporta, e é o primeiro lugar a olhar quando algo quebra depois de uma atualização.
2. **Só a ponte importa o SDK.** É a regra 6.2, vista do outro lado.
3. **É código de terceiro que você não auditou**, e ele roda com os seus privilégios — que são os do hospedeiro (seção 13 do arquivo principal).

Se o fabricante distribui o SDK pelo gerenciador de pacotes, e não para baixar à mão, ele deixa de ser `External/` e segue a regra da seção 9.3.

**As outras três:**
- **`tools/`** — executáveis de terceiro, **se o hospedeiro permitir** chamar outro programa (pergunta 5). Muitos não permitem, ou permitem com restrições — no Photoshop pelo UXP, abrir outro programa ou arquivo precisa estar pedido no manifesto; numa caixa de areia como a do Figma, não há como. Confirme antes de desenhar em cima disso.
- **`runtimes/`** — **não existe.** O hospedeiro é quem roda o seu código: ele oferece o ambiente, e não há como embutir outro.
- **`ai-models/`** — raro. O modelo pesaria no pacote e, pior, **na memória do hospedeiro** — que já está segurando o projeto do usuário. Prefira chamar por `clients/` ou por um programa local.

### 9.3 A pasta de dependências — o teste decide

**Apague a pasta de dependências e rode o plugin já empacotado. Funcionou?**

| Resposta | Por quê | Então ela é |
|---|---|---|
| **Sim** | o empacotador já copiou para dentro do pacote o pedaço de biblioteca que o código usa; a pasta cumpriu o papel e virou entulho | **do desenvolvimento** → `Workshop/` |
| **Não** | o hospedeiro carrega o plugin e o plugin procura a biblioteca na hora de rodar; sem ela, nem liga | **do programa** → `Program/Dependencies/` |

**No plugin de programa, a resposta depende do hospedeiro** — e por isso ela entra junto das cinco respostas em `Convenções.md`:
- **Com empacotador que junta tudo** (um plugin em JavaScript montado pelo esbuild ou pelo webpack, por exemplo) → `Workshop/`. Diga ao empacotador onde procurar, porque a busca do Node não entra em pasta irmã (no esbuild, `nodePaths`; no webpack, `resolve.modules`).
- **Sem empacotador, com o hospedeiro carregando as bibliotecas ao rodar** (um complemento em Python que leva as bibliotecas junto, por exemplo) → `Program/Dependencies/`, e o ponto de partida põe essa pasta no caminho de busca. O empacotador a copia para dentro do pacote.
- **O hospedeiro instala as bibliotecas que o manifesto lista** (o Home Assistant instala os `requirements` do `manifest.json` da integração ao iniciar, e não a carrega se a instalação falhar) → não há pasta de dependências no projeto: a lista é o próprio manifesto, e mora com ele em `Program/`. Para rodar os testes, a instalação local vai para `Workshop/`.
- **O manifesto é também a lista** (o `package.json` de uma extensão do VS Code; o de um pacote do Unity) → a lista fica com o manifesto, em `Program/` — ela não pode ir para `Workshop/` sem levar a ficha do plugin junto. O teste acima continua decidindo o resto: se o empacotador junta tudo, as bibliotecas não entram no pacote.

**Onde a linguagem impõe nome e lugar, vale o dela.** Em Node, Deno e Bun, quando o plugin roda direto, sem empacotador, a pasta se chama `node_modules` e fica **direto em `Program/`**: a busca sobe a partir do arquivo que importa — olha na pasta, não achou, sobe um nível — e **nunca entra em pasta irmã**. De `Program/Code/`, ela sobe para `Program/` e acha. Como o npm cria o `node_modules` ao lado do `package.json`, nesse caso a lista acompanha a pasta, em `Program/`. Nas linguagens em que o caminho é configurável (Python, PHP, Ruby, Rust), vale o nome `Dependencies/`.

**Regras:**
- **Nunca versionar** a pasta instalada. O que se versiona é a **lista**.
- Nunca editar à mão. Se precisa mudar, muda a lista e reinstala.

---

## 10. Program/Internal/ — onde o hospedeiro permitir (pergunta 3)

Na versão Desktop, `Internal/` é uma pasta em disco que você escolhe. **Aqui, o lugar é o que o hospedeiro der** — e isso varia muito: alguns oferecem uma área de dados por plugin, outros um mecanismo de preferências, outros nada além de uma pasta no perfil do usuário. A pergunta 3 diz qual é, e se ele viaja com o usuário para outro computador.

**O conceito continua inteiro:** é o que o **programa** escreveu enquanto rodava. Só o lugar muda.

| Conceito | Para onde foi |
|---|---|
| `config/` | O lugar da pergunta 3 — o que o usuário escolheu nas opções do plugin |
| `state/` | O lugar da pergunta 3 — o que o plugin lembra sozinho |
| `cache/` | Idem, e sempre descartável: o lugar pode sumir numa atualização do programa |
| `logs/` | **Console ou painel de log do hospedeiro** — ele costuma ter um, e é lá que o usuário vai olhar |
| `temp/` | Memória da sessão do plugin — morre ao desligar |
| `queue/` | Onde houver estado persistente, se o trabalho precisar sobreviver a fechar o programa |
| `credentials/` | **Cofre do sistema**, se o ambiente do plugin der acesso a ele. Se não der, ver abaixo |

### 10.1 As regras

1. **Descubra qual é o lugar antes de desenhar.** É a pergunta 3, e a resposta muda o que é possível guardar. Se o lugar viaja com o usuário — sincronizado para a conta dele —, nada de segredo ali.
2. ⚠ **Nunca escreva na pasta de instalação do plugin.** Ela é substituída na atualização — o que estava lá se perde —, e em muitos sistemas nem tem permissão de escrita.
3. **Nunca escreva junto do documento do usuário** sem ele pedir. O documento é dele (seção 11). **A exceção é o compartimento que o hospedeiro reserva ao plugin dentro do documento** — no Figma, os dados de plugin gravados num nó (privados ao plugin por estabilidade, não por segurança: o usuário consegue ler); nos suplementos do Office, as configurações salvas no documento. É o lugar certo para o que precisa viajar **com aquele documento**, nunca para segredo nem para preferência do usuário.
4. **`state` × `config` × `constants/`:** o `state` o usuário nem nota se sumir; o `config` ele reclama; e `constants/` é o padrão de fábrica, que vem com o plugin e **é substituído na atualização** — enquanto o que o usuário escolheu não pode ser.
5. **A área de dados costuma morrer com o plugin.** No Blender e no Photoshop pelo UXP, ela sobrevive à atualização, mas é apagada na desinstalação — o que o usuário não pode perder não mora ali (seção 11).

### 10.2 O cofre, e se não houver

**Cofre de plugin nem sempre guarda para sempre.** O do Photoshop pelo UXP deve ser tratado como cache — pode perder o valor sem aviso —, então o plugin precisa saber pedir a credencial de novo. O do VS Code é cifrado e não sincroniza entre máquinas; o dos IDEs da JetBrains é o `PasswordSafe`, nunca o estado persistente comum.

**Se não houver cofre**, o plugin não é lugar para segredo. Peça a credencial ao usuário a cada sessão, ou deixe a parte que precisa dela num programa separado.

### 10.3 O cache das ferramentas mora em Workshop/

O que a ferramenta gera sozinha — `__pycache__`, `.pytest_cache`, `*.tsbuildinfo`, o cache do empacotador — **nunca fica em `Code/`** nem dentro do pacote. Na versão Desktop ele vai para `Internal/cache/`; aqui `Internal/` não é pasta sua, e cache de ferramenta é do desenvolvimento, então ele mora em `Workshop/` (a regra da pasta que ninguém previu, seção 14.1 do arquivo principal). Aponte-o na configuração da ferramenta (Python: a variável `PYTHONPYCACHEPREFIX`; pytest: `cache_dir`; TypeScript: `tsBuildInfoFile`). Se a ferramenta não permitir apontar, registre em `Exceções.md`.

---

## 11. Onde o trabalho do usuário mora — o documento é do hospedeiro (pergunta 4)

> **Onde o trabalho do usuário mora nesta plataforma:** no **documento aberto no hospedeiro** — o projeto de vídeo, o arquivo de imagem, a cena, a composição. Ele pertence ao programa e ao usuário; o plugin **age sobre** esse material, não o possui e não o guarda. Nenhuma pasta do projeto o representa.
> **O que você tem permissão de escrever lá:** o que a pergunta 4 respondeu — e, quando pode, só pela ponte, pelos mecanismos do hospedeiro.

**As cinco regras que substituem a pasta:**

1. ⚠ **Toda alteração no documento passa pela ponte** e usa os mecanismos do hospedeiro — inclusive o **desfazer** dele. Alteração que o usuário não consegue desfazer com o atalho de sempre é a pior coisa que um plugin faz.
2. ⚠ **Nunca salve por conta própria.** Salvar é decisão do usuário. Um plugin que salva sozinho pode gravar por cima de um estado que ele ainda ia descartar.
3. **Alteração em massa avisa antes e diz quanto vai tocar.** "Aplicar em todos os trechos" é uma operação de trezentos itens.
4. **Prefira acrescentar a substituir.** Criar uma camada nova, acrescentar um item, gerar um arquivo ao lado — tudo isso é reversível de cabeça.
5. **Se o plugin produz um arquivo para o usuário** — uma exportação, um relatório —, ele **pergunta onde salvar** ou usa o mecanismo de exportação do hospedeiro. Não escolhe uma pasta sozinho.

**A consequência para o desenho:** um plugin não tem "trabalho acumulado". Se o seu projeto precisa guardar o histórico do que fez, isso é o lugar da pergunta 3 (seção 10) — e, se for grande, é sinal de que o projeto talvez queira ser um programa próprio com um plugin fino por cima.

**O teste que separa trabalho de `Internal/`:** apagou e **o usuário perde trabalho** → pertence ao documento. Apagou e **o plugin só refaz** → é o lugar da pergunta 3.

---

## 12. Banco de dados

Não há banco no sentido da versão Desktop. O que o plugin guarda vai para o lugar que o hospedeiro permite (seção 10), e o que ele produz vai para o documento ou para onde o usuário mandar (seção 11).

### 12.1 Índice ou fonte

| | **Índice** | **Fonte** |
|---|---|---|
| **O que guarda** | Um resumo do que se pode refazer lendo o documento | O dado em si — não há nada por trás |
| **Se apagar** | O plugin relê e reconstrói | **Perdeu** |
| **Pode apagar sozinho?** | Sim | **Nunca** |

> *Se isso for apagado agora, o plugin reconstrói lendo o documento?* **Sim** → índice, e pode viver onde o hospedeiro permitir. **Não** → é fonte, e **fonte não deveria morar num plugin**: ela pertence ao documento do usuário, ou a um arquivo que ele escolheu salvar.

É a regra que mais protege o usuário aqui: o que é trabalho dele fica no documento dele, que ele abre mesmo depois de desinstalar o plugin.
