# AMF — Referência completa · Arquitetura modular - Mobile

Apoio da skill Arquitetura modular. Abra a seção que a tabela rápida do arquivo principal indicar ("ver N.N"), ou a seção da pasta cuja dúvida é o porquê. Cada seção é autossuficiente.

> Auditada em 22/09/2026 contra: requisitos de API-alvo e de Android App Bundle da Google Play (prazo de 31/08/2026), política de acesso a todos os arquivos e de fotos e vídeos da Google Play, verificação de desenvolvedor Android (2026), armazenamento e Auto Backup do Android (developer.android.com), requisito de SDK da App Store (28/04/2026), limites de tamanho de build e manifesto de privacidade da Apple (developer.apple.com), configuração do Expo (app config e prebuild), layout de pacote do Dart e `flutter_tools`, configuração do Capacitor, do React Native CLI e do Metro.

---

## 4. Não existe arquivo de entrada — o manifesto ocupa o lugar

**No mobile não há arquivo que o usuário clica.** Quem abre o app é o sistema operacional, a partir do que o manifesto declarou: o usuário toca no ícone, e o sistema sabe o que abrir.

### 4.1 O manifesto do app mora em `Program/`

O manifesto é **o app se descrevendo**. É ele que declara:

- o nome do app e o ícone que aparece na tela inicial;
- o número de versão — o que a loja usa para saber que há atualização;
- **as permissões que o app pode pedir** — ver 6.4.

**Por que em `Program/` e não em `Workshop/`:** porque ele não é ferramenta — é o produto dizendo o que é. Muda quando o app muda, e vai para dentro do pacote junto com o código. Fica **direto em `Program/`**, ao lado de `Code/`, nunca dentro dele.

**Quando o framework gera os manifestos nativos a partir de um arquivo seu** (no Expo, o `app.json` ou `app.config.*`), esse arquivo é o manifesto do app e mora em `Program/` — no Expo, porque `Program/` é a raiz do framework (8.4). **No Flutter, o manifesto do app é o `pubspec.yaml`** (nome do pacote, versão, assets), que é também a lista de dependências: um arquivo só, na raiz do framework, em `Program/` (8.4). Os manifestos nativos que o compilador de cada plataforma lê — `AndroidManifest.xml` no Android, `Info.plist` no iOS — têm nome e lugar impostos, dentro de `android/` e `ios/`, e ficam onde a ferramenta manda.

**No iOS há um terceiro, o manifesto de privacidade** — `PrivacyInfo.xcprivacy`, nome imposto pela Apple. Ele declara que dados o app coleta e por que usa certas APIs do sistema (as preferências do sistema estão entre elas), e é obrigatório quando o app usa essas APIs ou coleta dado. Mora dentro do projeto nativo, em `Workshop/ios/` (no Expo e no Flutter, `Program/ios/` — 8.4), ou é gerado a partir do manifesto do app quando o framework oferece isso (o Expo oferece).

### 4.2 Um app só, variantes por configuração

Não existe "modo de execução" na raiz, nem um segundo manifesto por ambiente. Variante do app (desenvolvimento, homologação, produção, apontando para endereços diferentes) é **configuração do framework e do compilador**, declarada em `Workshop/` e automatizada em `Workshop/scripts/` — seção 8.3.

### 4.3 `Distribution/` — o pacote assinado de cada loja

O compilador de cada plataforma monta o app e o assina. **É isso, e só isso, que entra em `Distribution/`**, uma pasta de nível 1, irmã de `Program/`:

| Loja | Quem monta | O que entra em `Distribution/` |
|---|---|---|
| Google Play | o Gradle | o `.aab` assinado, que é o que a loja aceita |
| App Store | o Xcode | o `.ipa` assinado, que sobe para a loja |
| instalação direta, para teste | o Gradle | o `.apk` assinado, que você instala num aparelho sem passar pela loja |

```
Distribution/
├── google-play/        um .aab por versão publicada
└── app-store/          um .ipa por versão publicada
```

**O que cada loja exige hoje (setembro de 2026)** — as duas exigem com que versão do sistema o app é **montado**, não em que aparelho ele roda: a versão mínima do aparelho continua escolha sua.

| Loja | O formato | A versão exigida | Onde se declara |
|---|---|---|---|
| Google Play | `.aab` — obrigatório para app novo desde agosto de 2021 | desde 31/08/2026, app novo e atualização miram o **Android 16 (API 36)**; prorrogável até 01/11/2026 | na configuração do Gradle, em `Workshop/android/`, ou na do framework que a gera |
| App Store | `.ipa` | desde 28/04/2026, montado com o **Xcode 26** e o SDK do **iOS 26** | a versão do Xcode instalada na máquina; o alvo mínimo, no projeto em `Workshop/ios/` |

**O `.apk` de teste fora da loja:** instalar pelo cabo, com o `adb` (é o que o Android Studio faz), continua livre. Mandar o `.apk` para **outra pessoa** instalar passa a pedir que você esteja registrado como desenvolvedor no Google — no Brasil a partir de 30/09/2026, no mundo todo a partir de 2027; sem o registro, quem instala precisa do fluxo avançado do sistema.

**Regras:**
- `Distribution/` é **resultado**: o compilador refaz idêntico. Nunca se edita à mão e nunca se versiona.
- A configuração do compilador, a do framework e o script que assina e publica moram em `Workshop/` — seção 8.
- **A chave de assinatura não entra aqui nem no repositório.** Ela assina o pacote que sai para `Distribution/`, mas mora fora do projeto versionado — seção 13 do arquivo principal.

---

## 5. Program/

**O que é:** tudo que pertence ao app — o que o compilador põe dentro do pacote. Se você atualizar o app pela loja, é isso que é substituído. O trabalho do usuário continua intacto no aparelho.

**O que mora direto nele:** o manifesto do app (4.1) e as pastas `Code/`, `Assets/` e, quando houver modelo de IA empacotado, `External/`. `Dependencies/` e `Internal/` **não existem como pasta** no mobile — seções 9.4 e 10. No Expo e no Flutter, `Program/` é também a raiz do framework e recebe o que ele prende ao manifesto — seção 8.4.

**Regras:**
- Todos os nomes aqui dentro são em inglês
- Nada do usuário entra aqui — nem arquivo que ele criou, nem banco com o trabalho dele
- Sempre existe, junto com `Code/`

---

## 6. Program/Code/

**O que é:** o código que **você** escreveu e que **roda quando o app roda**. É o coração do projeto.

### 6.1 A regra que decide onde uma coisa fica

Esta é a regra mais importante do documento, porque ela substitui uma lista fixa de pastas:

> **Usado por UM módulo** → fica **dentro** desse módulo.
> **Usado por DOIS OU MAIS** módulos → sobe para o nível de `Code/`.
> **Editado em bloco**, independente do código → sobe também.

O princípio por trás: **organize por módulo/funcionalidade, nunca por tipo de arquivo**. Uma pasta que junta "todas as telas" ou "todos os modelos de dado" agrupa por tipo — e separa o arquivo do código que o usa.

**Exemplo correto:**
```
Code/backend/relatorios/
├── relatorios-gerador.kt
└── templates/
    └── relatorio.html        ← o modelo fica junto do código que preenche ele
```

Isso vale para **qualquer** conteúdo que o programa lê para decidir como agir: modelo de documento, tema visual, preset de parâmetros, esquema de validação. Nenhum deles é pasta fixa da AMF — eles nascem dentro do módulo que os usa.

**No mobile, a pasta de recurso foge dessa regra** — e por imposição da plataforma, não por escolha. Ver 7.

### 6.2 frontend/

**O que é:** toda a interface visual — telas, componentes, listas, modais. É o que o usuário vê.

**Organizado por módulo, não por tipo de arquivo.** Cada tela ou funcionalidade é uma pasta, e dentro dela fica tudo daquela tela: código, estilo, componente próprio.

**A diferença que mais importa no mobile — a tela tem ciclo de vida.** Ela pode ser **destruída no meio do uso** e reconstruída depois: o usuário troca de app, o sistema precisa de memória, o aparelho gira, o idioma muda. Quando isso acontece, tudo que estava só na memória some.

> **Estado não vive só na memória da tela.** O que precisa sobreviver vai para o banco local, para as preferências do sistema, ou para o mecanismo de estado salvo da plataforma — ver seção 10.

**Evitar:** `screens/`, `components/`, `viewmodels/` todos no mesmo nível — isso é agrupamento por tipo.

```
frontend/
├── perfil/
│   ├── perfil-tela.kt
│   ├── perfil-editar.kt
│   └── perfil-avatar.kt
└── configuracoes/
```

Se o app tem abas, cada aba vira uma pasta. Se tem uma tela só, ela é o módulo raiz, com subpastas para os componentes.

### 6.3 navigation/

**O que é:** as rotas entre telas — o mapa de quem leva a quem, os parâmetros que passam de uma para a outra, e o que acontece ao voltar.

**Por que é pasta própria e não fica dentro de `frontend/`:** porque a navegação é **de dois ou mais módulos por natureza** — ela liga módulos que não se conhecem entre si. Pela regra 6.1, sobe.

**O que também mora aqui:** os *deep links* — os endereços externos que abrem uma tela específica direto de fora do app.

**Regra:** nenhuma tela conhece o caminho até outra tela. Ela pede a rota; quem sabe o caminho é esta pasta.

### 6.4 permissions/

**O que é:** o código que **pede e verifica** as permissões do aparelho: câmera, microfone, localização, contatos, notificação, arquivos.

**Por que é pasta própria:** porque permissão se pede **em tempo de execução**, não na instalação. O sistema mostra o diálogo na hora, o usuário pode negar, pode negar "para sempre", e pode revogar depois nas configurações do aparelho. Isso é um fluxo com estados — não é uma linha solta dentro da tela que precisa da câmera.

**As três regras:**

1. **Peça na hora do uso, não na abertura do app.** Pedir tudo de uma vez logo no início faz o usuário negar por reflexo.
2. **Todo caminho que depende de permissão tem que ter o caminho alternativo escrito** — o que o app faz quando ela é negada. Travar a tela não é resposta.
3. **A permissão declarada no manifesto é uma promessa auditada.** Declarar o que não usa reprova na revisão da loja.

### 6.5 backend/

**O que é:** toda a lógica de processamento que roda **no aparelho** — cálculos, validações, regras de negócio, o banco local, a sincronização.

Organizado pelos mesmos módulos do frontend, quando ambos existem. Pode ter módulos exclusivos de backend (sincronização, indexação, tarefas em segundo plano) sem tela correspondente — isso é normal.

**Aqui o backend é só local.** Se existe um servidor de verdade por trás, ele não é este projeto — é um projeto SaaS separado, e este app fala com ele por `clients/`.

**Regra:** só crie a pasta de um módulo aqui se ela tiver lógica real. Nunca crie espelho vazio do frontend.

### 6.6 clients/

**O que é:** o código que **liga para fora**. O app precisa de algo, chama um serviço externo e espera a resposta. **Quem inicia a conversa é você.**

**Exemplos:** a API do seu próprio servidor, notificação push, pagamento pela loja, mapa, autenticação de terceiro, modelo de linguagem na nuvem.

**Regra:** um arquivo por serviço externo — `api.kt`, `mapas.kt`, `pagamento.kt`.

**No mobile, uma regra a mais:** **toda chamada pode falhar por falta de rede**, e falta de rede é estado normal, não exceção. Todo `clients/` precisa de um comportamento definido para quando não há conexão.

### 6.7 server/ — não existe

**O que seria:** o código que fica esperando ligarem para você.

**Ninguém liga para um app de celular.** Não há endereço público, o app não fica ligado, e o sistema o suspende assim que sai da frente.

O que parece exceção não é: notificação push **chega** por um serviço da plataforma, e quem inicia a conversa com esse serviço é o seu servidor, não o app. A pergunta da AMF continua valendo — *quem inicia a conversa?* — e no mobile a resposta é sempre "você", ou seja, `clients/`.

### 6.8 utils/ · constants/ · types/

- **`utils/`** — funções pequenas e reutilizáveis, sem dependência de módulo nenhum: formatações, conversões, validações genéricas. Se uma função aparece em 2 lugares, ela vem para cá. Cada arquivo agrupa funções de um tema.
- **`constants/`** — valores fixos que não mudam durante a execução e aparecem em vários lugares, **e os padrões de fábrica** do app: tema inicial, endereço padrão da API, tempo limite. Valor de fábrica **é** valor fixo — deixando ele aqui, o que o usuário escolheu tem um lugar só (seção 10), sem ambiguidade.
- **`types/`** — a forma dos dados: o que é um Cliente, um Pedido, quais campos existem e de que tipo são. Um arquivo por entidade principal; tipo usado por um módulo só fica dentro dele.

### 6.9 locales/

**O que é:** os textos da interface separados em um arquivo por idioma. Em vez de "Salvar" estar escrito dentro do código, ele fica numa lista, e o programa troca a lista inteira ao mudar de idioma.

**No mobile, o formato é o da plataforma** — o sistema escolhe o idioma sozinho, a partir da configuração do aparelho. Não invente um formato próprio: quem lê o arquivo é o sistema, não o seu código.

**Regra:** só crie se o app **for** ter mais de um idioma. Se é só português, não crie.

**Uma consequência que pega desprevenido:** trocar o idioma nas configurações do aparelho **destrói e reconstrói a tela** — é um dos casos de ciclo de vida da seção 6.2.

### 6.10 prompts/

**O que é:** os prompts que o app manda para um modelo de linguagem, e os esquemas de saída estruturada de cada um.

**Por que fica no topo de `Code/` e não dentro de cada módulo:** porque prompt tem **modo de trabalho próprio**. Você senta para "mexer nos prompts" — revisa vários, compara o tom, ajusta o conjunto. Isso é uma atividade em si, e ela exige eles juntos. É a única exceção deliberada à regra 6.1.

**Regras:**

1. **Uma subpasta por módulo** que conversa com IA. Nunca uma lista solta — com 40 prompts vira caos.
2. **O nome da subpasta é o nome real do módulo** no seu app.
3. **O prompt é sempre `.txt`.**
4. **O esquema é sempre `.json`, com nome idêntico ao do prompt.**
5. **Prompt sem saída estruturada simplesmente não tem `.json`.** Ausência não é pendência.

```
prompts/
├── chat/
│   ├── sistema.txt            prompt sem esquema — resposta é texto livre
│   ├── resumo.txt             o prompt
│   └── resumo.json            o esquema dele — mesmo nome, outra extensão
└── camera/
    ├── descrever.txt
    └── descrever.json
```

**Se o modelo é chamado na nuvem com uma chave sua**, a chave não pode estar no app — o pacote se abre e se lê. Quem chama o modelo é um servidor seu, e o app fala com ele por `clients/`.

### 6.11 A lista de dependências mora junto da configuração do framework

O arquivo que **lista** as dependências — `package.json` no React Native, no Capacitor e no Expo, `pubspec.yaml` no Flutter — **não fica em `Code/`**: ele é configuração do gerenciador de pacotes e do framework, e mora junto da configuração do framework. No React Native e no Capacitor, isso é `Workshop/` (seção 8). No Expo e no Flutter, é a raiz do framework, em `Program/` — e no Flutter o `pubspec.yaml` é lista e manifesto ao mesmo tempo (4.1, 8.4).

Ele **só informa** quais bibliotecas o app usa; não instala nada e não é a biblioteca em si. É seu, e é versionado. **O que se versiona é a lista, nunca os arquivos baixados.**

---

## 7. Program/Assets/

**O que é:** o que o app **mostra ou toca** e que você fez ou escolheu — imagem (inclusive SVG e ícone), fonte, áudio, vídeo. É substituído no update, como `Code/`.

**O critério é a FUNÇÃO do arquivo, não a extensão.** `Code/` guarda o que se **escreve** como parte do programa: código em qualquer linguagem, HTML, CSS, prompt (mesmo em `.txt` — um `.txt` que é prompt é estrutura do programa e fica em `Code/prompts/`), JSON, esquema, texto traduzido. `Assets/` guarda o que se **vê ou ouve**. Teste: *"a forma normal de mexer nisso é editar linha a linha num editor de código?"* Sim → `Code/`. Não (foi feito noutro programa, ou se olha/escuta) → `Assets/`. Um ícone SVG é texto, mas se mexe num editor de desenho: `Assets/`.

**Subpastas:** `icons/`, `images/`, `fonts/`, `audio/`, `video/`. Quando o recurso é de **um módulo só**, subpasta com o nome do módulo dentro do tipo: `Assets/images/chat/`. Modelo de IA baixado **não** é asset: fica em `External/ai-models/`.

**Regra:** nada binário ou de mídia em `Code/`; nada que se escreve em `Assets/`.

**Nesta plataforma, `Assets/` é obrigatório**, não situacional — o app não instala sem ícone —, e a plataforma impõe duas coisas a mais:

- **O mesmo ícone existe em várias densidades de tela.** O aparelho escolhe qual usar na hora; não é duplicação, é o formato exigido.
- **As pastas de recurso têm nome fixo** — o Android exige `res/`, o iOS exige `Assets.xcassets`, as duas dentro do projeto nativo em `Workshop/android/` e `Workshop/ios/` (no Expo e no Flutter, em `Program/` — 8.4). `Assets/` é a origem, e a configuração do framework copia para o lugar imposto. Se o framework não permitir, a pasta imposta é que vale — e isso fica registrado em `Exceções.md`.

O ícone do app e a tela de abertura ficam onde o framework manda. O resto da regra vale igual.

---

## 8. Workshop/

**O que é:** o que existe **para você desenvolver**, e que o app nunca executa. É uma pasta de nível 1, irmã de `Program/` — não fica dentro dele.

> **Tudo que existe só no desenvolvimento mora aqui, e nada daqui entra no pacote que a loja recebe.**

Apagar `Workshop/` não quebra o app já instalado nos aparelhos. Você é que deixa de conseguir compilá-lo, testá-lo e publicá-lo.

**A pergunta que separa de `Program/Code/`:** *isso roda quando o app roda?* Se sim → `Program/Code/`. Se só você executa, no desenvolvimento → `Workshop/`.

| O que mora aqui | Exemplo |
|---|---|
| a configuração do framework | a do framework, a do empacotador (no React Native, o `metro.config.js`) e a do compilador — ela aponta para `Program/Code/` e para o manifesto em `Program/` |
| `android/` · `ios/` | os projetos nativos que o framework exige — 8.1 |
| a lista de dependências | `package.json` — seção 6.11 |
| a pasta de dependências | `node_modules` e afins — o compilador já levou para dentro do pacote o que o código usa — seção 9.4 |
| `tests/` | os testes automáticos — 8.2 |
| `scripts/` | assinar, gerar as variantes, publicar na loja — 8.3 |
| `.env.example` · `.env` | as variáveis do seu ambiente de desenvolvimento. O `.env.example` se versiona; o `.env` nunca |

Esta tabela é a do React Native e do Capacitor. **No Expo e no Flutter**, as quatro primeiras linhas moram em `Program/`, a raiz do framework, e aqui ficam só `scripts/`, `.env` e — no Expo — `tests/`: seção 8.4.

### 8.1 android/ e ios/ — ao lado da configuração do framework

**O que são:** os projetos nativos de cada plataforma. O framework os gera e os usa para chamar o compilador de cada uma — Gradle no Android, Xcode no iOS.

**Por que moram em `Workshop/`:** porque são ferramenta, não produto. O que você escreve está em `Program/Code/`; estas pastas são o que a plataforma exige para transformar isso num pacote.

**Por que ao lado da configuração do framework:** o framework os procura **junto da configuração dele**. Não dá para separar os dois.

| Framework | `android/` e `ios/` |
|---|---|
| Expo | fixos: o `npx expo prebuild` os gera na raiz do projeto do Expo, ao lado do `package.json`, sem opção de outro nome ou lugar. No fluxo padrão do Expo eles nem se versionam — o `prebuild` os refaz |
| Flutter | fixos: a ferramenta `flutter` os procura ao lado do `pubspec.yaml`, com esses nomes, sem opção de trocar |
| React Native | padrão ao lado do `package.json`; o `react-native.config.js` aceita outro caminho (`project.android.sourceDir`, `project.ios.sourceDir`) |
| Capacitor | padrão ao lado do `capacitor.config`; ele aceita outro caminho (`android.path`, `ios.path`) |

Onde o caminho é configurável, não use isso: o padrão é o que a documentação do framework assume. **Se a configuração se mover, elas se movem junto** — e o caminho que a configuração usa para achar `Program/Code/` é o único que precisa ser corrigido.

**Morar em `Workshop/` só funciona no React Native e no Capacitor**, onde o código pode ficar longe da configuração (no React Native, com o Metro avisado — 9.4). No Expo e no Flutter, não: seção 8.4.

**Regra:** não renomeie, não traduza, não reorganize por dentro. O que você edita ali (uma permissão nativa, um ajuste do compilador) segue o que a ferramenta espera.

### 8.2 tests/

**Regra: espelha o caminho de `Program/Code/`, não o conteúdo.** Espelhar aqui significa **usar o mesmo caminho**, não copiar arquivo. Só existe pasta onde existe teste.

```
Program/Code/utils/formatar.kt   →   Workshop/tests/utils/formatar_test.kt
```

**O que o mobile acrescenta:** existem **dois lugares onde o teste roda**, e eles são bem diferentes.

| | Roda na sua máquina | Roda no aparelho ou emulador |
|---|---|---|
| **O que testa** | Lógica pura de `backend/` e `utils/` | Tela, navegação, permissão, banco local |
| **Velocidade** | Rápido | Lento |
| **Quando usar** | Sempre que puder | Quando precisa do sistema de verdade |

Separe os dois — misturar faz a suíte inteira ficar lenta e frágil.

### 8.3 scripts/

**O que é:** automações de desenvolvimento e publicação.

**No mobile, entram três que o computador de mesa não tem:**
- **assinar o pacote** — sem assinatura a loja não aceita. A chave de assinatura **nunca** entra no repositório: seção 13 do arquivo principal.
- **gerar as variantes** — desenvolvimento, homologação, produção, apontando para endereços diferentes.
- **publicar na loja** — subir o pacote de `Distribution/`, as notas de versão e a faixa de lançamento.

**Regra:** nomear de forma descritiva pelo que fazem — `assinar.sh`, `publicar-loja.sh` — nunca apenas `run.sh`.

### 8.4 Exceção de plataforma — Expo e Flutter: a raiz do framework é `Program/`

**O que o framework exige:**
- **Expo** — o `app.json` ou `app.config.*` fica ao lado do `package.json`, e o `npx expo prebuild` gera `android/` e `ios/` ao lado deles. O `metro.config.js`, o `babel.config.js` e o `eas.json` também são lidos dali. Com Expo Router, as rotas moram em `app/` ou `src/app/` nessa raiz; a opção `root`, que muda isso, a própria Expo desaconselha.
- **Flutter** — o `pubspec.yaml` é manifesto e lista ao mesmo tempo; o código tem de estar em `lib/` ao lado dele, e `android/`, `ios/`, `test/` e `integration_test/` também, com esses nomes.

**A escolha:** a raiz do framework é o próprio `Program/`. O código fica no lugar que o framework manda — no Flutter, `lib/` faz o papel de `Code/`; no Expo, `Code/` continua, e só as rotas do Expo Router ficam em `app/`.

**Por que:** o que o framework prende ao manifesto é o que monta o app — dentro de `Program/`, a cópia com Ctrl+C (sem o que o `.gitignore` já exclui) leva um projeto que compila, e `Workshop/` fica só com o que o framework deixa sair.

**Expo:**

```
Program/                        A RAIZ DO FRAMEWORK · é daqui que o `npx expo` roda
├── app.json                    o manifesto do app (ou app.config.js/ts) · ao lado do package.json, imposto
├── package.json                a lista de dependências · o Expo acha o projeto por ele
├── metro.config.js  eas.json   a configuração do empacotador e a do serviço de build · lidas da raiz
├── babel.config.js             a configuração do transpilador · lida da raiz
├── app/                        só com Expo Router: as rotas, onde ele manda · cada arquivo só importa
│                               a tela de Code/frontend/
├── Code/                       o resto do código, como na árvore padrão · o "main" do package.json
│                               aponta a entrada para cá quando não há Expo Router
├── Assets/                     igual · o app.json aponta o ícone e a tela de abertura para cá
├── External/ai-models/         igual
├── android/  ios/              gerados pelo prebuild · fora do Git no fluxo padrão — o prebuild refaz
├── node_modules/               a pasta de dependências · fora do Git
└── .expo/                      cache da ferramenta · fora do Git
Workshop/                       SÓ NO DESENVOLVIMENTO
├── tests/                      espelha Program/Code/ · a configuração do Jest, em Program/, põe esta pasta
│                               em `roots` e o node_modules de Program/ em `modulePaths`
├── scripts/                    assinar, gerar as variantes, publicar · rodam o `npx expo` dentro de Program/
└── .env.example  ·  .env       as variáveis dos scripts · as `EXPO_PUBLIC_*` o Expo só lê do .env
                                da raiz dele: esse fica em Program/, fora do Git
```

**Flutter:**

```
Program/                        A RAIZ DO FRAMEWORK · é daqui que o `flutter` roda
├── pubspec.yaml                manifesto E lista: nome do pacote, versão, dependências, assets declarados
├── pubspec.lock                as versões resolvidas · versiona-se, porque é app
├── analysis_options.yaml       a configuração do analisador · lida da raiz
├── lib/                        o código · faz o papel de Code/ · nome imposto · main.dart é a entrada
│   └── frontend/  navigation/  as mesmas pastas de Code/, por dentro
│       permissions/  backend/ …
├── Assets/                     igual · declarado em `flutter: assets:` no pubspec.yaml
├── External/ai-models/         igual · também declarado no pubspec.yaml
├── android/  ios/              os projetos nativos · nomes e lugar impostos · versionados: o nome na tela
│                               inicial, as permissões e a assinatura se editam aqui
├── test/  integration_test/    os testes · o `flutter test` procura aqui · nomes impostos · espelham lib/
└── .dart_tool/  build/         gerados pela ferramenta · fora do Git · o .aab e o .ipa saem em build/
Workshop/                       SÓ NO DESENVOLVIMENTO
├── scripts/                    assinar, gerar as variantes, copiar de build/ para Distribution/, publicar
└── .env.example  ·  .env       as variáveis dos scripts
```

`Distribution/` não muda: o script copia para lá o pacote assinado que o compilador deixou dentro da raiz do framework. A pasta de dependências e o cache da ferramenta continuam não sendo `Dependencies/` nem `Internal/` — estão em `Program/` só porque o framework os põe ali, e vão para o `.gitignore`.

Registre em `Exceções.md` do projeto qual framework ele usa e que a raiz do framework é `Program/`.

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

### 9.2 External/ no mobile

| Subpasta | O que acontece no mobile |
|---|---|
| `tools/` | **Não existe.** App de loja não leva executável de terceiro avulso |
| `libraries/` | **Não existe.** Nada de biblioteca colada à mão: tudo passa pelo gerenciador de pacotes |
| `runtimes/` | **Não existe.** A plataforma **é** o runtime |
| `ai-models/` | **Existe** — mas com um limite duro, 9.3 |

### 9.3 External/ai-models/

**O que é:** modelos de inteligência artificial baixados e guardados no projeto. Não são seus, você não edita, e substitui inteiro quando troca de versão.

**Uma subpasta por tipo**, porque são coisas diferentes: `llm/`, `embeddings/`, `rerankers/`, `vision/`, `speech/`, `image-gen/`.

⚠ **A loja limita o tamanho do pacote**, e modelo de IA é grande. Antes de empacotar um, escolha entre as três saídas:

1. **Empacotar junto** — funciona sem rede desde a instalação, mas engorda o download e pode estourar o limite da loja
2. **Baixar na primeira abertura** — o pacote fica pequeno, mas o app precisa de rede para começar a servir
3. **Não ter modelo local** — chamar o modelo por `clients/`, o que exige rede sempre

**Os limites de hoje:** na Google Play, o pacote principal vai até 200 MB comprimidos; acima disso, a loja entrega em partes, até 4 GB no total; modelo maior sai do pacote principal e vai num **pacote de IA** do Play for On-device AI (até 1,5 GB cada, entregue na instalação ou depois). Na App Store, o app instalado vai até 4 GB descomprimido; o que passar disso vai em **pacote de recursos em segundo plano** (Background Assets), que a Apple pode hospedar — o antigo On-Demand Resources foi descontinuado. Nos dois casos o modelo continua saindo de `External/ai-models/`: muda só o jeito de a loja entregá-lo.

**Regra:** o que for baixado ou empacotado sempre vai para o `.gitignore` — são arquivos grandes e não são seus.

### 9.4 Dependencies/ — no mobile, a pasta mora em `Workshop/`

**O teste — apague a pasta de dependências e rode o app já montado. Funcionou?**

| Resposta | Por quê | Então ela é |
|---|---|---|
| **Sim** | o compilador já copiou para dentro do pacote o pedaço de biblioteca que o código usa; a pasta cumpriu o papel e virou entulho | **do desenvolvimento** → `Workshop/` |
| **Não** | o programa procura a biblioteca na hora de rodar; sem ela, nem liga | **do programa** → `Program/Dependencies/` |

**No mobile a resposta é sempre "sim".** O app instalado no aparelho não tem acesso a pasta nenhuma do seu projeto: tudo o que ele usa foi para dentro do pacote quando o compilador o montou. Por isso `Program/Dependencies/` **não existe**, e a pasta de dependências — o `node_modules` do React Native, por exemplo — mora em `Workshop/`, ao lado da lista e da configuração do framework. No Expo ela fica na raiz do framework, em `Program/`, pelo mesmo motivo — é ao lado da lista que o gerenciador a cria (8.4); o teste continua dizendo "do desenvolvimento", e ela vai para o `.gitignore`. Quando o gerenciador de pacotes guarda tudo num lugar global da máquina (o Flutter e o Gradle fazem isso), não há pasta nenhuma no projeto.

**No React Native, o empacotador precisa ser avisado.** O Metro procura o `node_modules` subindo a partir do arquivo que importa — e de `Program/Code/` ele nunca chega a `Workshop/node_modules`. Na configuração do Metro, em `Workshop/`, diga as duas coisas: `watchFolders` inclui `Program/` (código fora da raiz dele), e `resolver.nodeModulesPaths` aponta para `Workshop/node_modules`. O mesmo vale para o verificador de tipos e para o executor de testes, que também sobem a partir do arquivo.

**Regras:**
- **Nunca versionar.** Sempre no `.gitignore` — o que se versiona é a **lista**.
- Nunca editar à mão. Se precisa mudar, muda a lista e reinstala.
- **Não confunda com `External/`:** lá está o que você colou à mão (9.1); aqui, o que um comando pôs e um comando recria.

---

## 10. Internal/ — onde ele foi parar

No computador de mesa, `Internal/` é uma pasta com sete subpastas. **No mobile ela não existe como pasta** — o sistema operacional dá um lugar para cada coisa, e é nesse lugar que ela vai.

**O conceito continua inteiro:** é o que o **app** escreveu enquanto rodava; não é código e não é do usuário.

| Conceito | Para onde foi no mobile |
|---|---|
| `logs/` | **Console do aparelho** durante o desenvolvimento + **serviço de relato de falhas** em produção. Não se escreve arquivo de log dentro do aparelho: ninguém vai lê-lo |
| `cache/` | **Diretório de cache do sistema.** ⚠ Ele apaga sozinho quando falta espaço, sem avisar. Nada que você precise de volta pode morar aqui |
| `temp/` | **Diretório temporário do sistema.** Some junto com a operação |
| `state/` | **Preferências do sistema** — o que o app lembra sozinho: última aba, posição, filtro |
| `config/` | **Preferências do sistema** — o que o usuário escolheu de propósito |
| `queue/` | **Continua existindo** — como **tabela no banco local**, não como pasta. É o controle da fila: ordem, tentativas, o que está rodando agora |
| `credentials/` | **Cofre do sistema** (Keychain no iOS, Keystore no Android). Nunca em preferência, nunca em arquivo |

**As regras que sobrevivem à mudança:**

1. **Nada disso se versiona.**
2. **`state` × `config`:** se o `state` sumir, o usuário nem nota; se o `config` sumir, ele reclama. Continuam sendo coisas diferentes mesmo morando no mesmo mecanismo.
3. **`constants/` × `config`:** `constants/` é o padrão de fábrica que **vem com o app e é substituído no update**; a preferência é o que o usuário mudou e **não pode** ser substituída — senão cada atualização apaga o que ele configurou.
4. **O cofre é a única parte que não se recria.** Apagar o resto não custa nada; perder o que está no cofre obriga o usuário a entrar de novo em tudo.

⚠ **A caixa privada inteira sai no backup do aparelho** — preferências, o que você grava como `state`, o banco local e os arquivos; só o cache e o temporário ficam de fora. Vai para a nuvem do usuário e volta num aparelho novo. Não guarde nada sensível ali. Segredo só no cofre do sistema.

| | Android | iOS |
|---|---|---|
| **O que vai** | tudo da caixa privada, até 25 MB por app (acima disso, nada vai) | a caixa, exceto `Library/Caches/` e `tmp/` |
| **Como tirar do backup** | as regras de backup no manifesto nativo (`dataExtractionRules` do Android 12 em diante, `fullBackupContent` antes), ou gravar na pasta "sem backup" do sistema | marcar o arquivo como excluído do backup, ou gravá-lo no cache |
| **O cofre** | a chave do Keystore não sai do aparelho | o item do Keychain só fica fora se marcado "só neste aparelho" (`ThisDeviceOnly`) |

**Cache de ferramenta não vai para `Code/`.** O que a ferramenta gera sozinha na sua máquina — o cache do empacotador, do compilador, do executor de testes, `*.tsbuildinfo` — **nunca fica em `Program/Code/`**: aponte-o, na configuração da ferramenta, para `Workshop/` ou para fora do projeto. Se a ferramenta não permitir apontar, registre em `Exceções.md`.

---

## 11. Onde o trabalho do usuário mora

**Onde o trabalho do usuário mora nesta plataforma:** no aparelho, e em um de dois lugares — o **armazenamento privado do app** (a caixa que o sistema entrega na instalação), ou o **acervo de mídia e o seletor de arquivos do sistema**, fora dessa caixa.
**O que você tem permissão de escrever lá:** na caixa privada, o que quiser, sem pedir nada — mas ela some quando o app é desinstalado. Fora dela, só pelo acervo de mídia ou pelo seletor, e aí **quem escolhe o lugar é o usuário**, não o app.

**Desde o Android 10 não existe mais "salvar onde eu quiser".** Ou é a caixa privada do app, que some na desinstalação, ou é pelo acervo de mídia (fotos, vídeos, áudio, downloads) ou pelo seletor do sistema — e aí quem escolhe o lugar é o usuário. **No iOS**, é a caixa do app, que só aparece no app Arquivos se o app declarar que quer aparecer; fora dela, só pelo seletor de documentos do sistema, para abrir ou exportar onde o usuário escolher.

| | Android | iOS |
|---|---|---|
| **A caixa privada** | a pasta interna do app e a externa dele — as duas somem na desinstalação | a caixa do app; `Documents/` é o trabalho do usuário, `Library/Caches/` e `tmp/` o sistema pode esvaziar |
| **Aparecer para o usuário** | não conte com isso: desde o Android 11, nem outro app nem o seletor do sistema entram nas pastas do app (`Android/data/`) | só com `UIFileSharingEnabled` e `LSSupportsOpeningDocumentsInPlace` no `Info.plist` — aí `Documents/` aparece em "No iPhone" |
| **Gravar fora da caixa** | pelo acervo de mídia (o que o próprio app cria, sem permissão) ou pelo seletor do sistema (sem permissão) | pelo seletor de documentos, abrindo ou exportando |
| **Ler o que outro app gravou** | fotos e vídeos: pelo seletor de fotos do sistema — a permissão ampla, a Google Play só libera se ele não bastar | pelo seletor de documentos ou de fotos |
| **"Acesso a todos os arquivos"** | existe desde o Android 11, mas a Google Play só libera para gerenciador de arquivos, backup, antivírus e afins, com formulário | não existe |

O Android 10 introduziu a regra, e desde o Android 11 nenhum app escapa dela. Como a Google Play obriga todo app a mirar o Android 16, ela vale para todo app publicado.

**O teste que separa trabalho do usuário de `Internal/`:** apagou e **o usuário perde trabalho** → é trabalho do usuário, e mora aqui. Apagou e **o app só refaz** → é `Internal/`, seção 10.

**Regras:**
- Atualizar o app pela loja **nunca** apaga a caixa privada
- ⚠ **Desinstalar o app apaga tudo que está na caixa privada** — é o motivo de exportar existir (11.4)
- O caminho se obtém pela API do sistema, **na hora** — nunca se guarda gravado
- O app jamais apaga nada do usuário sem confirmação explícita
- Nomes livres a partir do terceiro nível — ver 3.1 do arquivo principal

### 11.1 Os três formatos — escolha um

O que muda entre eles é **como o trabalho se organiza**, e isso depende do app.

**Formato 1 — `projects/`: o trabalho se divide em unidades nomeadas.** Use quando o usuário cria, nomeia, abre e fecha unidades distintas de trabalho, cada uma com seus arquivos e histórico.

**Formato 2 — etapas numeradas: o trabalho passa por um fluxo.** Use quando arquivos entram, são processados em sequência e saem prontos. Não faz sentido nomear cada um.

**Formato 3 — solto: nem um nem outro.** Arquivos avulsos direto na raiz da caixa, ou em `unsorted/` se convivem com projetos.

### 11.2 A regra recursiva

> **As mesmas pastas de trabalho valem em dois níveis — nunca nos dois ao mesmo tempo.**

Se o app **não tem** projetos, as pastas de trabalho ficam direto na raiz da caixa.
Se o app **tem** projetos, as mesmas pastas ficam dentro de cada projeto.

É a mesma lógica repetida um nível abaixo. Não há nome novo para aprender — muda só o escopo. E: se existem projetos, **todo fluxo pertence a algum deles**; fluxo solto ao lado dos projetos é órfão.

### 11.3 O padrão de etapas numeradas

Quando o trabalho passa por várias fases, cada fase é uma pasta. O arquivo vai andando de uma para a outra.

```
1-recebido/            o material como chegou — o app nunca modifica o original
2-processado/          saiu da primeira etapa
3-revisado/            saiu da segunda etapa
concluido/             passou por tudo — é o que o usuário vem buscar
com-erro/              travou em alguma etapa, junto do log do erro
```

**As regras:**

1. **Número na frente, hífen, nome da etapa.** O número garante a ordem certa na listagem.
2. **O nome descreve o que a etapa produziu, não o que ela faz.**
3. **A primeira etapa é onde o material entra.** O app lê, mas nunca modifica o original.
4. **Duas pastas sem número no fim** — uma para o que terminou, outra para o que deu erro. Sem número porque não são etapa, são destino.
5. **`com-erro/` existe para não travar a fila.**
6. **A pasta onde o arquivo está É o estado dele.** Isso vale ouro no mobile: o sistema pode matar o app a qualquer momento, e ao reabrir ele olha as pastas e continua de onde parou, sem depender de nada que estava na memória.
7. **Os nomes das etapas são livres e podem ser em português** — são do usuário, não de `Program/`.

### 11.4 Sincronização, exportação e a pasta de triagem

Parte da caixa pode ser sincronizada para a nuvem do usuário (iCloud, Drive). **Decida conscientemente o que sincroniza:**

| Vai para a nuvem | Fica só no aparelho |
|---|---|
| O trabalho do usuário | Cache e temporário |
| O que ele esperaria achar no outro aparelho | Banco de índice, que se reconstrói |
| | ⚠ **Nada sensível** — a nuvem é dele, mas não é cofre |

**Exportar deixa de ser luxo.** Desinstalar apaga a caixa inteira, e o usuário faz isso sem imaginar a consequência. Se o app guarda trabalho de verdade, ele precisa de um jeito de tirar esse trabalho de dentro — pelo seletor do sistema, para onde o usuário escolher.

**`intake/` — a triagem:** se chega material que ainda não pertence a nenhum projeto (compartilhado de outro app, baixado, fotografado), ele cai num fluxo de triagem que **só decide o destino**. Se `intake/` produzisse entregável, seria um projeto disfarçado.

---

## 12. Banco de dados

O banco local do app (`.db`, `.sqlite`) **fica na caixa privada do app**, nunca junto do código.

- Se o app tem projetos → o banco de cada projeto fica **dentro** dele. Apagou o projeto, o banco vai junto
- Se não tem projetos → um banco só, na raiz da caixa

### 12.1 Índice ou fonte — a diferença que importa

Não muda **onde** o arquivo fica. Muda **o que o app pode fazer com ele**.

| | **Índice** | **Fonte** |
|---|---|---|
| **O que guarda** | Um resumo dos arquivos, para achar rápido | O dado em si — não existe arquivo por trás |
| **Se apagar** | O app relê os arquivos e reconstrói | **Perdeu** — não há de onde reconstruir |
| **O app pode apagar sozinho?** | Sim, quando desconfia que desatualizou | **Nunca**, nem para "limpar" ou "corrigir" |

**O teste de uma pergunta:**

> *Se eu apagar esse banco agora, o app reconstrói tudo sozinho?*
> **Sim** → é índice. ⚠ **Não** → é fonte, e o app jamais pode tocar nele sem confirmação.

**No mobile isso decide o que sincroniza:** índice não precisa ir para a nuvem — ele se refaz. Fonte precisa, senão trocar de aparelho perde o trabalho.
