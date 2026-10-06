# AMF — Referência completa · Arquitetura modular - Extensão de navegador (Chrome, manifesto versão 3)

Apoio da skill Arquitetura modular. Abra a seção que a tabela rápida do arquivo principal indicar ("ver N.N"), ou a seção da pasta cuja dúvida é o porquê. Cada seção é autossuficiente.

---

## 4. Não existe arquivo de entrada — existe o manifesto

Na versão Desktop, o arquivo de entrada é o que o usuário clica. **Numa extensão ele não existe:** o Chrome é quem carrega você, e ele decide **quando** e **qual parte**.

O que ocupa esse lugar é o **`manifest.json`**, no formato da versão 3. Ele declara:

- o nome, a descrição, a versão e os **ícones** (seção 7);
- **qual arquivo é o service worker**;
- **quais content scripts são injetados, e em quais sites**;
- **qual página é o popup e qual é a de opções**;
- **as permissões** — e é essa a lista que a revisão da loja examina.

### 4.1 Os dois endereços do manifesto

| | Onde | Quem escreve | Para quê |
|---|---|---|---|
| **A fonte** | `Program/manifest.json` | **você** | é o produto se descrevendo, e é onde você edita a versão a cada publicação |
| **A cópia** | `Distribution/manifest.json` | **o empacotador** (esbuild, Vite ou webpack), que a copia | é a que o Chrome lê — ele a exige na raiz do pacote |

A fonte fica em `Program/`, ao lado do código que ela descreve, e não em `Program/Code/`: não é código, é a ficha do pacote. Nunca edite a cópia: ela é substituída na próxima montagem.

### 4.2 Três consequências práticas

1. **A extensão não tem "um" ponto de partida — tem vários**, um por contexto de execução (seção 6.1). O Chrome liga cada um por conta própria.
2. **Os caminhos que o manifesto declara são caminhos dentro do pacote** — onde o empacotador escreveu o arquivo em `Distribution/`, não onde ele está em `Program/Code/`. Mover arquivo é mexer no manifesto **e** na configuração do empacotador; se o caminho declarado não bate, a parte correspondente não carrega, muitas vezes sem erro visível.
3. **Permissão declarada é permissão auditada.** Ver seção 13 do arquivo principal.

---

## 5. Program/

**O que é:** tudo que pertence à extensão, na forma em que você escreve — é a **fonte** de que o pacote é montado. Quando você publica uma versão nova, é daqui que ela sai.

**Regras:**
- Todos os nomes aqui dentro são em inglês
- **Tudo aqui acaba dentro do pacote publicado, e o pacote é aberto** (seção 13 do arquivo principal). Nada sensível entra
- Sempre existe, junto com `manifest.json` e `Code/`
- O Chrome nunca carrega esta pasta: ele carrega `Distribution/`

---

## 6. Program/Code/

**O que é:** o código que **você** escreveu e que **roda quando a extensão roda** — depois de o empacotador juntá-lo em `Distribution/`. É o coração do projeto.

### 6.1 A exceção declarada: aqui o primeiro corte é por contexto de execução

> **Nesta variação, o primeiro corte de `Code/` não é por módulo, e sim por contexto de execução. O navegador obriga. É o único ponto em que a regra "organize por funcionalidade" cede.**

Sem essa declaração explícita, a skill se contradiz sozinha — então ela vem antes de tudo.

**Por que o navegador obriga:** os quatro contextos abaixo **não são pastas de organização, são ambientes diferentes**. Eles rodam separados, com permissões diferentes, ligados e desligados pelo navegador em momentos diferentes, e **não compartilham memória entre si**. Código que roda em um não roda no outro. Um arquivo que "fosse do módulo" e servisse aos dois seria uma mentira: ele precisa existir dos dois lados, ou passar por mensagem.

| Contexto | Onde roda | Quando existe |
|---|---|---|
| **`service-worker/`** | Em segundo plano, sem tela | Só quando há evento — morre entre eles |
| **`content-scripts/`** | Dentro da página visitada | Enquanto a página estiver aberta |
| **`popup/`** | Na janelinha do ícone | Enquanto ela estiver aberta — fecha e morre |
| **`options/`** | Na página de opções | Enquanto ela estiver aberta |

**A regra de módulo continua valendo — um nível abaixo.** Dentro de cada contexto, organize por funcionalidade:

```
content-scripts/
├── destacar/
│   ├── destacar-marcador.ts
│   └── destacar-estilo.css
└── extrair/
    └── extrair-tabela.ts
```

**E a regra 6.2 continua valendo para o que é comum:** o que dois contextos usam sobe para `utils/`, `constants/` ou `types/`, no nível de `Code/`.

### 6.2 A regra que decide onde uma coisa fica (dentro do contexto)

> **Usado por UM módulo** → fica **dentro** desse módulo.
> **Usado por DOIS OU MAIS** módulos → sobe para o nível de `Code/`.
> **Editado em bloco**, independente do código → sobe também.

O princípio: **organize por funcionalidade, nunca por tipo de arquivo** — respeitada a exceção de 6.1, que é o corte de cima. Isso vale para **qualquer** conteúdo que a extensão lê para decidir como agir: modelo, regra em arquivo, tema, preset, esquema de validação. Nenhum deles é pasta fixa da AMF — eles nascem dentro do módulo que os usa.

### 6.3 service-worker/ — o que morre e volta

**O que é:** o código que roda em segundo plano, sem tela: reage a eventos, coordena os outros contextos, chama serviços externos.

**A característica que define esta pasta: ele morre e reinicia sozinho entre eventos.** O navegador o desliga quando não há nada acontecendo e o liga de novo no próximo evento. Isso não é falha — é o desenho da versão 3 do manifesto.

**A consequência é uma regra dura:**

> ⚠ **Nada de estado guardado em memória.** Toda variável que você deixar viva morre no próximo desligamento, e o código volta como se tivesse acabado de nascer — o trabalho que estava pela metade se perde.

**O que fazer em vez disso:**
- Estado que precisa sobreviver vai para o armazenamento do Chrome (seção 10)
- Trabalho longo se divide em pedaços que sobrevivem sozinhos, com o progresso registrado a cada passo
- Nada de temporizador longo em memória: o agendamento é do navegador, não seu

**O que mora aqui:** os ouvintes de evento, a coordenação entre contextos, e as chamadas de `clients/` — porque é o único contexto com permissão para falar com fora sem estar dentro de uma página.

### 6.4 content-scripts/ — o ambiente hostil

**O que é:** o código **injetado na página que a pessoa visita**. É ele que lê o conteúdo do site, destaca, extrai, acrescenta botão.

**A característica que define esta pasta: o ambiente é hostil.** Você está dentro da casa dos outros:

1. **A página mexe no que você lê.** Ela pode alterar o que está na tela a qualquer momento, inclusive depois de você ter lido. Nada do que você extraiu é estável.
2. **A página pode redefinir as funções básicas** que o seu código usa. O que parece uma chamada comum pode estar sendo observado ou trocado.
3. **O estilo dela vaza para o seu, e o seu para o dela.** Todo elemento que você acrescenta precisa de isolamento visual — senão a página estraga a sua interface, ou você estraga a dela.
4. **Você não tem as permissões da extensão aqui.** O content script é limitado: quando precisa de algo mais, ele **manda mensagem para o service worker** e espera a resposta.

**Por isso:**
> **Trate tudo que vem da página como entrada de estranho.** Valide antes de usar, nunca insira conteúdo dela na sua interface sem tratar, e nunca confie que a estrutura vai continuar a mesma no segundo seguinte.

**Organizado por módulo**, um por funcionalidade injetada. Cada site diferente que precise de tratamento próprio também é um módulo.

### 6.5 popup/ e options/

**`popup/`** — a janelinha que abre ao clicar no ícone da barra.
**Ela morre ao fechar**, e fecha sozinha quando o usuário clica em qualquer outro lugar. Nada em andamento pode viver aqui: quem toca trabalho longo é o service worker. O popup pede, mostra o progresso e some.

**`options/`** — a página de opções da extensão, onde o usuário escolhe o que quer.
Aqui o que ele escolhe vai para o armazenamento do Chrome (seção 10), e os padrões de fábrica ficam em `constants/`.

**Nos dois, organize por módulo internamente**, se houver mais de uma seção.

### 6.6 frontend/ — não existe

**A interface de uma extensão está sempre dentro de um contexto**: é o `popup/`, é o `options/`, ou é o que o `content-scripts/` desenha dentro da página visitada.

Criar um `frontend/` separado obrigaria a decidir a qual contexto cada tela pertence — que é exatamente a informação que o nome da pasta já dá.

### 6.7 backend/ — encolhe

**O que é:** a lógica de processamento — o que não é tela e não é evento.

**Por que encolhe:** o ambiente é restrito. Não há disco, não há processo separado, não há biblioteca de sistema, e o service worker pode ser desligado no meio. O que sobra de "backend" numa extensão costuma ser pequeno: transformar o que foi extraído, montar o que vai ser mostrado, decidir o que fazer com um evento.

**Quando ele existe, vale a regra de sempre:** organizado por módulo, sem espelho vazio, e **sem estado próprio em memória** — pela regra de 6.3.

Se a lógica for grande de verdade, ela provavelmente pertence a outro projeto: a extensão vira a interface, e o trabalho vai para um serviço (que aí é SaaS) ou para um programa local.

### 6.8 clients/ e a ausência de server/

**`clients/`** — o código que **liga para fora**. Um arquivo por serviço externo.

**A restrição desta plataforma: só os domínios declarados no manifesto.** A política de segurança da extensão bloqueia qualquer chamada para endereço que não foi declarado — e a declaração é auditada na loja. Acrescentar um serviço novo é mexer em `Program/manifest.json` e passar de novo pela revisão.

**E quem chama é o service worker**, não o content script: dentro da página visitada, as restrições são as da página.

**`server/` não existe.** Ninguém liga para uma extensão: ela não tem endereço e não fica ligada. A pergunta da AMF — *quem inicia a conversa?* — tem sempre a mesma resposta aqui: você.

### 6.9 locales/ — a fonte, e o `_locales/` que o empacotador escreve

**O que é:** os textos da interface separados por idioma. Em vez de "Salvar" estar escrito dentro do código, ele fica numa lista, e o Chrome escolhe a lista do idioma de quem usa.

**São duas pastas, não uma:**

| | Onde | Quem escreve |
|---|---|---|
| **A fonte** | `Program/Code/locales/` | **você** |
| **O resultado** | `Distribution/_locales/` | **o empacotador**, que a escreve a partir da fonte |

**O Chrome impõe o nome E o lugar de `_locales/`: a raiz do PACOTE.** Numa subpasta do código ele nunca a encontra — e uma extensão traduzida sem ela é recusada na hora de carregar. Por isso a pasta com sublinhado só existe em `Distribution/`; a sua fonte segue a regra de nomes da AMF, sem sublinhado.

**Dentro da fonte, use desde já a forma que o Chrome lê** — uma subpasta por código de idioma, cada uma com o seu `messages.json`:

```
Program/Code/locales/              →    Distribution/_locales/
├── pt_BR/messages.json                 ├── pt_BR/messages.json
└── en/messages.json                    └── en/messages.json
```

Assim o empacotador só copia, sem transformar nada.

**Regra:** só crie se a extensão **for** ter mais de um idioma. O nome e a descrição que aparecem na loja também saem daqui, quando ela é traduzida.

### 6.10 prompts/

**O que é:** os prompts que a extensão manda para um modelo de linguagem, e os esquemas de saída estruturada de cada um.

**Por que fica no topo de `Code/` e não dentro de cada contexto:** porque prompt tem **modo de trabalho próprio** — você senta para "mexer nos prompts", revisa vários, compara o tom. É a mesma exceção deliberada de sempre.

**Regras:**

1. **Uma subpasta por módulo** que conversa com IA. Nunca uma lista solta.
2. **O nome da subpasta é o nome real do módulo.**
3. **O prompt é sempre `.txt`.**
4. **O esquema é sempre `.json`, com nome idêntico ao do prompt.**
5. **Prompt sem saída estruturada simplesmente não tem `.json`.**

**A pergunta que vem junto:** de quem é a chave? **Não pode ser sua** — o pacote é aberto, e quem instala lê (seção 13 do arquivo principal). As saídas honestas são: **a chave é do usuário**, digitada por ele nas opções e guardada no armazenamento local; ou **o modelo roda localmente** na máquina dele.

E: **quem chama é o service worker**, com o domínio declarado no manifesto.

### 6.11 A lista de dependências

O `package.json` — o arquivo que **lista** as bibliotecas que o npm instala — **não fica em `Code/`**: ele é configuração do gerenciador de pacotes, e mora em `Workshop/`, junto com o `node_modules/` que o npm cria ao lado dele (seção 9.3).

---

## 7. Program/Assets/

**O que é:** o que a extensão **mostra ou toca** e que você fez ou escolheu — imagem (inclusive SVG e ícone), fonte, áudio, vídeo. É substituído no update, como `Code/`.

**O critério é a FUNÇÃO do arquivo, não a extensão.** `Code/` guarda o que se **escreve** como parte do programa: código em qualquer linguagem, HTML, CSS, prompt (mesmo em `.txt` — um `.txt` que é prompt é estrutura do programa e fica em `Code/prompts/`), JSON, esquema, texto traduzido. `Assets/` guarda o que se **vê ou ouve**. Teste: *"a forma normal de mexer nisso é editar linha a linha num editor de código?"* Sim → `Code/`. Não (foi feito noutro programa, ou se olha/escuta) → `Assets/`. Um ícone SVG é texto, mas se mexe num editor de desenho: `Assets/`.

**Subpastas:** `icons/`, `images/`, `fonts/`, `audio/`, `video/`. Quando o recurso é de **um módulo só**, subpasta com o nome do módulo dentro do tipo: `Assets/images/destacar/`. Modelo de IA baixado **não** é asset: fica em `External/ai-models/`.

**Regra:** nada binário ou de mídia em `Code/`; nada que se escreve em `Assets/`.

**Nesta plataforma, duas exigências do Chrome:**
- **Os ícones da extensão existem em quatro tamanhos — 16, 32, 48 e 128 — e são listados no manifesto.** Sem eles a extensão não carrega. `Program/Assets/icons/` é a fonte; o empacotador os copia para `Distribution/icons/`, e é esse caminho, o do pacote, que o manifesto declara.
- **Todo recurso que o content script usa dentro da página precisa estar declarado como acessível pela web** no manifesto — senão a página não consegue carregá-lo.

---

## 8. Workshop/

**O que é:** o que existe **para você desenvolver**, e que a extensão nunca executa. É uma pasta de nível 1, irmã de `Program/` — não fica dentro dele.

> **Tudo que existe só no desenvolvimento mora aqui, e nada daqui vai no pacote.**

Apagar `Workshop/` inteiro não afeta a extensão já carregada nem a publicada. Você é que deixa de conseguir testá-la, montá-la de novo e reinstalar as bibliotecas.

**A pergunta que separa de `Program/Code/`:** *isso vai para dentro do pacote?* Se sim → `Program/`. Se só você executa, no desenvolvimento → `Workshop/`.

| O que mora aqui | Exemplo |
|---|---|
| `tests/` | os testes automáticos — 8.1 |
| `scripts/` | chamar o empacotador, gerar o `.zip`, publicar na loja — 8.2 |
| `package.json` · `node_modules/` | a lista e a pasta do npm — seção 9.3 |
| a configuração do empacotador | a do esbuild, do Vite ou do webpack — 8.3 |
| a configuração do compilador | o `tsconfig.json` do TypeScript, quando o código é TypeScript |
| a configuração das outras ferramentas | a do executor de testes, a do verificador de estilo |
| o cache das ferramentas | o que o empacotador e o compilador guardam sozinhos — seção 10.3 |
| `.env.example` · `.env` | as variáveis do seu ambiente de desenvolvimento. O `.env.example` se versiona; o `.env` nunca — seção 13 do arquivo principal |

### 8.1 tests/

**O que é:** arquivos de código que chamam o seu código e verificam se a resposta bateu. Você roda no terminal quando quer conferir; a extensão nunca roda sozinha.

**Regra: espelha o caminho de `Program/Code/`, não o conteúdo.** Só existe pasta onde existe teste.

```
Program/Code/backend/extrair/tabela.ts   →   Workshop/tests/backend/extrair/tabela_test.ts
```

**O que esta plataforma acrescenta — dois testes que quase ninguém escreve e que pagam:**

1. **O service worker sobrevive a morrer no meio?** Simule o desligamento entre dois passos de um trabalho longo e veja se ele continua de onde parou. É a falha número um desta plataforma, e ela não aparece no uso rápido do desenvolvimento.
2. **O content script aguenta a página mudar?** Teste com uma página que altera o conteúdo depois de carregada e com estrutura diferente da esperada.

### 8.2 scripts/

**O que é:** automações de desenvolvimento e publicação.

**Nesta plataforma, entram três específicas:**
- **montar o pacote** — chamar o empacotador, que escreve `Distribution/`
- **gerar o `.zip`** — só com o conteúdo de `Distribution/`, na hora de publicar
- **publicar na Web Store** — subir o `.zip` e as notas da versão

**Regra:** nomear pelo que fazem — `montar.sh`, `publicar.sh` — nunca apenas `run.sh`.

### 8.3 A configuração do empacotador

O empacotador (esbuild, Vite ou webpack) é a ferramenta que lê `Program/` e escreve `Distribution/`. A configuração dele mora aqui, e é nela que se declara:

- **as entradas** — um arquivo por contexto: o service worker, cada content script, o popup, as opções;
- **o destino** — `Distribution/`, e nenhum outro;
- **as cópias** — `Program/manifest.json` para a raiz do pacote, `Program/Code/locales/` para `Distribution/_locales/`, `Program/Assets/icons/` para `Distribution/icons/`;
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

### 9.2 Program/External/ — só o que vai dentro do pacote

**Nada de código remoto:** não se carrega script de fora em tempo de execução, e tudo vai dentro do pacote. Por isso, das quatro pastas de `External/`, só duas cabem numa extensão:

| Pasta | O que acontece aqui |
|---|---|
| `tools/` | **Não existe.** Uma extensão não executa programa de fora do navegador |
| `libraries/` | A biblioteca que você baixou e colou à mão — um `.min.js` — vai **dentro** do pacote, como o seu código. Se ela vem pelo npm, não passa por aqui (9.3) |
| `runtimes/` | **Não existe.** O navegador é quem roda o seu código |
| `ai-models/` | Só se o modelo rodar dentro do navegador — pesa no tamanho do pacote e no tempo da primeira resposta |

**A regra que fecha a seção:** ⚠ **carregar código de um endereço externo reprova na revisão da loja** — o Chrome obriga que tudo vá no pacote, e não é questão de estilo: é motivo de recusa.

### 9.3 A pasta de dependências mora em Workshop/

**O teste — apague a pasta de dependências e rode a extensão já montada. Funcionou?**

| Resposta | Por quê | Então ela é |
|---|---|---|
| **Sim** | o empacotador já copiou para dentro do pacote o pedaço de biblioteca que o código usa; a pasta cumpriu o papel e virou entulho | **do desenvolvimento** → `Workshop/` |
| **Não** | o programa procura a biblioteca na hora de rodar; sem ela, nem liga | **do programa** → `Program/Dependencies/` |

**Numa extensão, a resposta é sempre "sim".** O Chrome só enxerga o que está em `Distribution/`, e o empacotador leva para lá o que o código usa. Por isso `Program/Dependencies/` não existe nesta plataforma, e o `package.json` e o `node_modules/` moram juntos em `Workshop/` — o npm cria o `node_modules/` ao lado do `package.json`.

**Diga ao empacotador onde procurar.** A busca do Node sobe a partir do arquivo que importa — olha na pasta, não achou, sobe um nível — e **nunca entra em pasta irmã**: de `Program/Code/`, ela não chega sozinha a `Workshop/node_modules/`. Aponte o caminho na configuração do empacotador (no esbuild, `nodePaths`; no webpack, `resolve.modules`) e, com TypeScript, no `tsconfig.json` (`paths`).

**Regras:**
- **Nunca versionar** o `node_modules/`. O que se versiona é a **lista** (`package.json`, com o arquivo de trava de versões ao lado).
- Nunca editar à mão. Se precisa mudar, muda a lista e reinstala.

---

## 10. Program/Internal/ — o armazenamento do Chrome

Na versão Desktop, `Internal/` é uma pasta em disco. **Aqui, ela não é pasta nenhuma: vira o armazenamento do Chrome** — que tem **duas áreas**, com comportamentos bem diferentes:

| | **Local** | **Sincronizado** |
|---|---|---|
| **Onde fica** | Só naquele computador | Viaja para a conta Google do usuário |
| **Espaço** | Confortável | **Apertado** — e limitado por item e por frequência de escrita |
| **Para que serve** | Cache, dado de trabalho, chave do usuário | Preferências pequenas que ele espera achar no outro computador |

| Conceito | Para onde foi |
|---|---|
| `state/` | Armazenamento do Chrome — o que a extensão lembra sozinha |
| `config/` | Armazenamento do Chrome — o que o usuário escolheu em `options/`. Escolha local ou sincronizado conscientemente |
| `cache/` | Armazenamento **local** — nunca o sincronizado, que é pequeno |
| `logs/` | **Console** — e são vários: cada contexto tem o seu, em lugares diferentes do navegador |
| `temp/` | Memória do contexto — que morre a qualquer momento no service worker |
| `queue/` | **Continua existindo** — no armazenamento, nunca em memória (regra de 6.3) |
| `credentials/` | **Não existe lugar seguro** — ver 10.1 |

### 10.1 credentials/ não existe

O pacote publicado é aberto, e o armazenamento do Chrome é legível por quem senta na máquina.

**A única coisa aceitável de guardar é uma chave que é do próprio usuário** — digitada por ele em `options/`, guardada no armazenamento **local** (nunca no sincronizado, que viaja para a conta Google dele), com aviso e com botão de apagar.

### 10.2 As regras que sobrevivem

1. **Nada disso se versiona.**
2. **`state` × `config`:** se o `state` sumir, o usuário nem nota; se o `config` sumir, ele reclama.
3. **`constants/` × `config`:** `constants/` é o padrão de fábrica, que vem com a extensão e é substituído na atualização; o que o usuário escolheu **não pode** ser substituído.
4. **Escrever no armazenamento custa tempo**, e o sincronizado tem limite de frequência. Nada de gravar a cada tecla.

### 10.3 O cache das ferramentas mora em Workshop/

O que a ferramenta gera sozinha — `*.tsbuildinfo`, o cache do empacotador, `.eslintcache` — **nunca fica em `Code/`**. Na versão Desktop ele vai para `Internal/cache/`; aqui `Internal/` não é pasta em disco, e cache de ferramenta é do desenvolvimento, então ele mora em `Workshop/` (a regra da pasta que ninguém previu, seção 14.1 do arquivo principal). Aponte-o na configuração da ferramenta (TypeScript: `tsBuildInfoFile`). Se a ferramenta não permitir apontar, registre em `Exceções.md`.

---

## 11. Onde o trabalho do usuário mora — `Files/` não existe

> **Onde o trabalho do usuário mora nesta plataforma:** no site que a pessoa visita — não é seu. A extensão age sobre a página dos outros: lê, destaca, extrai, acrescenta. O que ela gera para a pessoa guardar vai para o armazenamento do Chrome, que é pequeno, ou para a pasta de downloads.
> **O que você tem permissão de escrever lá:** na página, o mínimo, de forma reversível; no disco, nada direto — uma extensão não tem acesso ao disco, só pode **oferecer o download** e deixar o Chrome gravá-lo na pasta de downloads.

**As duas consequências:**

1. **O que a extensão altera na página não é dela.** Alterar o conteúdo de um site é agir na casa dos outros: faça o mínimo, deixe reversível, e nunca mande o conteúdo lido para lugar nenhum sem o usuário saber (seção 13 do arquivo principal).
2. **Se a extensão gera algo para o usuário guardar** — uma exportação, uma lista, uma anotação — o caminho é **oferecer o download**, não só guardar.

> ⚠ **Desinstalar a extensão apaga o armazenamento inteiro, sem aviso.** Se ela acumula trabalho que o usuário lamentaria perder, ela precisa de exportar.

**O teste que separa trabalho de `Internal/`:** apagou e **o usuário perde trabalho** → precisa de exportação. Apagou e **a extensão só refaz** → é o armazenamento comum, no lugar de `Internal/`.

---

## 12. Banco de dados

Não há banco no sentido da versão Desktop — não há arquivo `.db` para guardar. Quando a extensão precisa guardar mais do que algumas opções — uma lista grande, um histórico, um índice — usa o **armazenamento estruturado do navegador**, no contexto que precisa dele.

### 12.1 Índice ou fonte

| | **Índice** | **Fonte** |
|---|---|---|
| **O que guarda** | Um resumo do que se pode refazer | O dado em si — não há nada por trás |
| **Se apagar** | A extensão reconstrói | **Perdeu** |
| **Pode apagar sozinha?** | Sim | **Nunca** |

> *Se isso for apagado agora, a extensão reconstrói sozinha?* **Sim** → índice. **Não** → fonte, e **fonte precisa de exportação** (seção 11) — a desinstalação a leva junto.
