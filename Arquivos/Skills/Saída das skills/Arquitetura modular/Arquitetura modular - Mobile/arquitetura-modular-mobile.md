---
name: arquitetura-modular-mobile
description: Referência completa da AMF (Arquitetura Modular por Features) na versão mobile — diz em que pasta cada arquivo mora, como nomear pasta e arquivo, e o que cada área guarda. É a versão certa para aplicativo que a pessoa instala no celular ou no tablet a partir de uma loja — Google Play, App Store —, em qualquer linguagem ou framework. Use SEMPRE antes de criar, mover, renomear ou deletar qualquer arquivo ou pasta deste projeto, mesmo que o usuário não peça para "seguir a arquitetura". Antes dela, leia os desvios registrados em "Saída das skills/Arquitetura modular/Exceções.md" e "Convenções.md" — um desvio do projeto sempre vence a regra genérica.
---

# AMF — Arquitetura Modular por Features — Referência Completa — versão **Mobile**

Esta é a versão da AMF para **aplicativo instalado no aparelho e publicado numa loja** (Android e iOS). É a referência genérica, igual para todos os projetos mobile e para qualquer linguagem ou framework. Leia-a antes de criar, mover, renomear ou deletar qualquer arquivo ou pasta — mas primeiro confira os desvios deste projeto em `Saída das skills/Arquitetura modular/` (seção 17): um desvio registrado sempre vence a regra genérica. Se a pasta não existir, a seção 17 diz como criá-la.

---

## 0. A regra da raiz — o que a plataforma manda

**Onde a plataforma manda, ela vence.** A AMF se aplica no espaço livre que sobra.

No mobile, três ferramentas mandam, e vale nomeá-las antes de falar delas:

- **o framework** — React Native, Flutter, Capacitor… — e a configuração dele;
- **o empacotador**, quando o framework tem um (no React Native, o Metro): junta o seu código num arquivo só;
- **o compilador de cada plataforma** — Gradle no Android, Xcode no iOS: monta e assina o pacote que vai para a loja.

O framework cria as pastas `android/` e `ios/` e as procura **junto da configuração dele**: é dali que ele as acha. No React Native e no Capacitor esse lugar é o padrão, que a configuração até aceita trocar — não troque —, e o código pode morar longe dele: por isso ali elas moram em `Workshop/`, ao lado dessa configuração, e se ela se mover, elas se movem junto. Esses nomes **não se traduzem e não se renomeiam**.

**No Expo e no Flutter esse arranjo não funciona**: o framework exige manifesto, lista de dependências, `android/`, `ios/` e (no Flutter) o código, todos juntos na mesma pasta. Aí vale a **exceção de plataforma** — a raiz do framework é o próprio `Program/` —, desenhada na seção 8.4 da `referencia.md`.

A raiz fica quase livre: nela ficam o `CLAUDE.md`, as quatro pastas de nível 1 e o que a tabela 2.2 lista. **Todo o resto mora dentro de uma das quatro pastas.** Não há arquivo para clicar: quem abre o app é o sistema operacional, pelo ícone que o manifesto declarou (seção 4 da `referencia.md`).

---

## 1. Os baldes

Toda pasta deste projeto pertence a um destes baldes. Antes de criar qualquer coisa, descubra em qual ela cai — isso resolve a maioria das dúvidas sozinho.

| Balde | Critério | Se apagar |
|---|---|---|
| **`Program/`** | Eu escrevi · é o app · é o que o compilador põe dentro do pacote | O app não se monta mais |
| ↳ `Code/` | Só código, e nada mais · roda quando o app roda | O app para |
| ↳ `Assets/` | Eu fiz ou escolhi · não é código · o app mostra ou toca | O app fica sem ícone, imagem, som ou fonte — e sem ícone a loja nem aceita |
| ↳ `External/` | **Eu colei à mão** · outro escreveu · eu não edito — no mobile, quase só modelo de IA | O app perde o que dependia dele (e eu baixo de novo à mão) |
| ↳ `Dependencies/` | **O gerenciador de pacotes instalou** · o app precisa para rodar — **no mobile não existe**: o compilador leva as bibliotecas para dentro do pacote (seção 9 da `referencia.md`) | — |
| ↳ `Internal/` | O app escreveu · pode apagar que ele recria — no mobile não é pasta: é o armazenamento que o sistema dá ao app | Nada se perde, exceto o que está no cofre do sistema |
| **`Workshop/`** | Eu escrevi ou instalei · **só eu uso, no desenvolvimento** · inclui `android/` e `ios/` — menos no Expo e no Flutter (8.4 da `referencia.md`) | O app instalado continua rodando; eu é que não consigo mais compilá-lo nem publicá-lo |
| **`Distribution/`** | O compilador montou e assinou · é o que a loja recebe | O compilador refaz idêntico |
| **`Files/`** | É o trabalho de quem usa · ninguém encosta — no mobile não é pasta do projeto: mora no aparelho (seção 2.3) | **Perde tudo que foi feito** |

**A pergunta que separa os baldes:** *o que acontece com isso quando eu atualizo o app?*
`Program/` é substituído pelo pacote novo · `Workshop/` não vai junto · `Distribution/` é o resultado · o trabalho do usuário, no aparelho, é intocável.

---

## 2. A árvore completa

Tudo abaixo é **situacional** exceto `Program/`, `Program/Code/`, `Program/Assets/` e a configuração do framework (em `Workshop/`; no Expo e no Flutter, em `Program/` — 8.4 da `referencia.md`). Só crie o que o projeto realmente precisa.

São **quatro pastas de nível 1, irmãs**: `Program/`, `Workshop/`, `Distribution/` e `Files/` — e no mobile a quarta **não é pasta**: está desenhada para dizer onde o trabalho do usuário foi parar.

Legenda: `=` igual à versão Desktop · `~` existe, mas muda de conteúdo ou de regra · `→` deixa de ser pasta e vira outra coisa · `✖` não existe · `+` é novo aqui. **Cada linha se explica sozinha** — o símbolo nunca é a explicação inteira.

```
[Nome do projeto]/                     A RAIZ
│
✖ arquivo de entrada                   quem abre o app é o SISTEMA OPERACIONAL, pelo
│                                      ícone que o manifesto declarou
├── CLAUDE.md                          as regras que a IA lê ao abrir o projeto
├── .claude/   .mcp.json               ⊘ do assistente — não são da AMF
├── ⊘ Saída das skills/                não é da AMF…
│   └── Arquitetura modular/           …EXCETO esta: Convenções.md + Exceções.md
├── ⊘ Saída dos comandos/              não é da AMF
│
├── Program/                           O QUE O APP É · nomes SEMPRE em inglês
│   │                                  é o que o compilador põe dentro do pacote
│   │
│   ├── + manifesto do app             o app se descrevendo: nome, ícone, versão e
│   │                                  as permissões que ele pode pedir
│   │
│   ├── Code/                          SÓ código · roda quando o app roda
│   │   ├── ~ frontend/                as telas, por MÓDULO · cada tela tem ciclo de vida
│   │   ├── + navigation/              as rotas entre telas e os deep links
│   │   ├── + permissions/             pedir e checar permissão do aparelho
│   │   ├── ~ backend/                 só lógica local: banco no aparelho, sincronização
│   │   ├── = clients/                 você liga pra fora — e ficar sem rede é normal
│   │   ├── ✖ server/                  não existe: ninguém liga para um app de celular
│   │   ├── = utils/                   funções reusadas em 2+ lugares
│   │   ├── = constants/               valores fixos + padrões de fábrica
│   │   ├── = types/                   a forma dos dados, compartilhada
│   │   ├── ~ locales/                 textos traduzidos, no formato que a plataforma lê
│   │   └── = prompts/                 os prompts, uma subpasta por módulo
│   │
│   ├── ~ Assets/                      OBRIGATÓRIO · o que se vê ou ouve · o ícone vem
│   │   └── icons/ images/ fonts/ …    em várias densidades · {tipo}/{módulo}/
│   │
│   ├── ~ External/                    SÓ o que você colou à mão · você não edita
│   │   ├── ✖ tools/                   não existe: app de loja não leva executável avulso
│   │   ├── ✖ libraries/               não existe: toda biblioteca vem do gerenciador
│   │   ├── ✖ runtimes/                não existe: a plataforma é o runtime
│   │   └── ~ ai-models/               modelos de IA empacotados · a loja limita o tamanho
│   │
│   ├── ✖ Dependencies/                não existe: o compilador leva as bibliotecas para
│   │                                  dentro do pacote — a pasta mora em Workshop/
│   │
│   └── → Internal/                    o app escreveu · não é pasta: cada coisa vai para
│       │                              o lugar que o sistema dá ao app
│       ├── → logs/                    console do aparelho + serviço de relato de falhas
│       ├── → cache/                   diretório de cache do sistema · ele apaga sozinho
│       ├── → temp/                    diretório temporário do sistema
│       ├── → state/                   preferências do sistema · o que o app lembra sozinho
│       ├── → config/                  preferências do sistema · o que o usuário escolheu
│       ├── ~ queue/                   existe — como TABELA no banco local
│       └── → credentials/             cofre do sistema (Keychain no iOS, Keystore no Android)
│
├── Workshop/                          SÓ NO DESENVOLVIMENTO · nada daqui entra no pacote
│   ├── + configuração do framework    a do framework, a do empacotador e a do compilador
│   │                                  — ela aponta para Program/Code/
│   ├── + android/  ios/               os projetos nativos · nomes impostos · ficam AO LADO
│   │                                  da configuração do framework, que é de onde ele os acha
│   ├── a lista de dependências        package.json (React Native, Capacitor) — do gerenciador
│   │                                  de pacotes
│   ├── a pasta de dependências        node_modules e afins · o compilador já levou para
│   │                                  dentro do pacote o que o código usa
│   ├── ~ tests/                       espelha o caminho de Program/Code/ · + teste que
│   │                                  roda no aparelho ou no emulador
│   ├── ~ scripts/                     + assinar o pacote, gerar as variantes, publicar na loja
│   └── .env.example  ·  .env          as variáveis do seu ambiente de desenvolvimento
│
├── Distribution/                      O QUE ELE PRODUZ · o pacote assinado de cada loja
│                                      (.aab para a Google Play, .ipa para a App Store)
│
└── → Files/                           O QUE É DO USUÁRIO · não é pasta do projeto: mora
                                       no aparelho, onde o sistema deixa — ver 2.3
```

`⊘` marca o que está na raiz mas **não é da AMF**: é do assistente de código, e esta referência não organiza, não cria e não cobra nada ali — com a única exceção de `Saída das skills/Arquitetura modular/` (seção 17).

**Esta árvore é a do React Native e do Capacitor.** No Expo e no Flutter a configuração do framework, a lista de dependências, `android/` e `ios/` saem de `Workshop/` e vão para `Program/`, que vira a raiz do framework — e no Flutter o código mora em `lib/`, no lugar de `Code/`. As duas árvores estão na seção 8.4 da `referencia.md`.

### 2.1 `Distribution/` — o pacote de cada loja

O compilador de cada plataforma monta o app e o assina: o Gradle gera o `.aab` que sobe para a Google Play (e o `.apk`, quando você instala direto num aparelho para testar); o Xcode gera o `.ipa` que sobe para a App Store. **É isso, e só isso, que entra em `Distribution/`**: uma subpasta por loja, com o pacote assinado de cada versão.

- O que está nela é **resultado**: o compilador refaz idêntico, então ela nunca se edita à mão e nunca se versiona.
- A configuração do compilador, a do framework e os scripts de assinatura e publicação moram em `Workshop/`. Em `Distribution/` fica só o que sai deles.

### 2.2 O que fica na raiz, e por imposição de quem

| O arquivo ou a pasta | Quem obriga | O que quebra se ele sair dali |
|---|---|---|
| `CLAUDE.md` | a ferramenta — o Claude Code procura na raiz | a IA abre o projeto sem ler as regras |
| `.claude/` · `.mcp.json` | a ferramenta — o Claude Code, *do assistente, não do programa* | as permissões e os servidores MCP do assistente deixam de carregar |
| `Saída das skills/` · `Saída dos comandos/` | as skills e os comandos — *do assistente, não do programa* | as bases de decisão deixam de ser achadas |
| `Program/` | nós | a configuração do framework, em `Workshop/`, deixa de achar o código e o manifesto |
| `Workshop/` | nós | nada no app já instalado; o framework perde `android/` e `ios/` e não compila mais |
| `Distribution/` | nós | os scripts de publicação não acham o pacote assinado |
| `.git/` · `.gitignore` · `LICENSE` | o Git e o site onde o repositório mora — *do repositório, não do programa* | o repositório deixa de ser reconhecido, o `.gitignore` deixa de valer para o projeto inteiro, a licença não é exibida |

**O que não está nesta tabela não vai para a raiz.** `android/`, `ios/` e a configuração do framework não estão: moram juntos — em `Workshop/` no React Native e no Capacitor, em `Program/` no Expo e no Flutter (exceção de plataforma, seção 8.4 da `referencia.md`). Em nenhum dos casos vão para a raiz.

### 2.3 Onde o trabalho do usuário mora — `Files/` não é pasta aqui

**Onde o trabalho do usuário mora nesta plataforma:** no aparelho, e em um de dois lugares — o **armazenamento privado do app** (a caixa que o sistema entrega na instalação), ou o **acervo de mídia e o seletor de arquivos do sistema**, fora dessa caixa.
**O que você tem permissão de escrever lá:** na caixa privada, o que quiser, sem pedir nada — mas ela some quando o app é desinstalado. Fora dela, só pelo acervo de mídia ou pelo seletor, e aí **quem escolhe o lugar é o usuário**, não o app.

⚠ **Desde o Android 10 não existe mais "salvar onde eu quiser"** — e desde o Android 11 nenhum app escapa, porque a Google Play obriga todos a mirar versão bem mais nova. Ou é a caixa privada do app, que some na desinstalação, ou é pelo acervo de mídia ou pelo seletor do sistema — e aí quem escolhe o lugar é o usuário. **No iOS**, é a caixa do app, que só aparece no app Arquivos se o app declarar que quer aparecer; fora dela, só pelo seletor de documentos, onde também quem escolhe é o usuário. O desenho completo — formatos, etapas, exportação, sincronização — está na seção 11 da `referencia.md`.

> **Quando abrir `referencia.md`** (na mesma pasta desta skill): a tabela rápida da seção 15 responde onde cada coisa fica; quando ela remeter a uma seção ("ver 9.4"), ou quando a dúvida for o **porquê** de uma pasta, o que ela guarda em detalhe ou como se organiza por dentro, abra `referencia.md` na seção indicada. Para "onde fica X?" a tabela basta — não leia a referência inteira por precaução.

---

## 3. Convenção de nomenclatura

### 3.1 A regra de idioma

**Dentro de `Program/`, tudo em inglês.** É código: precisa ser previsível para ferramenta, editor e IA. `frontend`, `backend`, `utils` e `assets` são termos que o mundo inteiro reconhece — traduzir só cria atrito.

**Nas pastas ditadas pela ferramenta, o nome é o que ela exige** — `android/`, `ios/`, `res/`, `drawable-xxhdpi/`, `Assets.xcassets`. Não é escolha sua, e por isso não é violação.

**No armazenamento do app no aparelho, o inglês vai até o segundo nível** — as pastas cujo caminho o app referencia no código (`projects/`, `intake/`, `unsorted/`). A partir daí o nome é livre, em português, com acento e espaço se quiser: é o trabalho do usuário, o código não depende dele.

### 3.2 Maiúsculas

- **Nível 1 e 2** (`Program/`, `Workshop/`, `Distribution/`; `Code/`, `Assets/`, `External/`, `Internal/`) — primeira letra maiúscula, e **sempre o nome completo, nunca abreviado**. São nomes **conceituais**: dizem que tipo de coisa é aquilo.
- **Nível 3 em diante** (`frontend/`, `navigation/`, `permissions/`) — minúsculas, sem acento, sem espaço, hífen como separador. São nomes **técnicos**: dizem que parte do sistema é aquilo.

A troca de estilo **é** a fronteira entre conceito e implementação.

### 3.3 Arquivos

Tudo minúsculo, sem acento, sem espaço. Sempre começa pelo contexto (módulo ou feature).

- **Hífen (`-`)** separa blocos de conceito principais: `perfil-tela.kt`, `perfil-editar.kt`
- **Underscore (`_`)** mantém juntas palavras que formam um único conceito composto: `codigo_qr-leitor.kt`
- Sempre começa pelo contexto: `perfil-tela.kt`, nunca `tela-perfil.kt`
- Quando o caminho já informa o contexto, não repita no nome: `frontend/perfil/tela.kt`
- **Arquivo dividido: cada parte leva o nome do original + o que a parte faz.** `arquivos.py` → `arquivos.py` (a casca) + `arquivos_copia.py` + `arquivos_ativacao.py`; `trabalhos.js` → `trabalhos-fluxo.js` + `trabalhos-metricas.js`. **Nunca número** (`-2`, `-parte2`, `-cont`): número diz que o arquivo continua, não diz o quê — e é o que faz alguém abrir três arquivos para achar uma função. Se a parte não tem nome próprio ("é só a continuação da lista"), o corte está no lugar errado: corte por tema (o que as funções têm em comum) ou por quem as usa. **Depois de dividir**, confira que todo nome usado de fora continua acessível — import, export, nome global: a divisão não muda a interface.

**Exceção:** arquivos cujo nome a plataforma impõe (`AndroidManifest.xml`, `Info.plist`, a classe de entrada da atividade) ficam exatamente como ela exige.

### 3.4 Tamanho dos arquivos

**Alvo: até 300 linhas.** Entre **300 e 500** o arquivo está na faixa de folga: divida na próxima vez que mexer nele, **se houver um corte natural** — nunca só para caber. **Acima de 500**, divida agora. Em qualquer caso o corte é por conceito, nunca por número: um arquivo de 520 linhas sem corte natural vira exceção registrada em `Exceções.md`, não um arquivo de 500 mais um de 20. O nome das partes segue a regra da seção 3.3.

### 3.5 Caminhos pela API do sistema, sempre

Nada de caminho absoluto no código. No mobile isso é ainda mais crítico: **o caminho do armazenamento do app muda a cada instalação** e é diferente entre um aparelho e outro. Caminho de arquivo se obtém pela API do sistema, na hora — nunca se guarda gravado.

---

## 13. Segurança

O mobile tem um problema que o computador de mesa não tem: **o pacote instalado está na mão de outra pessoa**, e ela pode abri-lo. E o aparelho, sozinho, copia dados para a nuvem e apaga outros.

### 13.1 Credenciais

1. ⚠ **O pacote publicado pode ser aberto e lido.** Qualquer um baixa o app e extrai o conteúdo. **Nada de chave, senha ou token em `Code/`, `Assets/`, `constants/` ou numa variável que o empacotador embute no pacote.** Se o app precisa falar com um serviço que exige segredo, quem guarda o segredo é um servidor — o app pede autorização e recebe um token temporário.
2. **O segredo do usuário mora só no cofre do sistema** — Keychain no iOS, Keystore no Android. Nunca em preferência, nunca em arquivo, nunca em constante — seção 10 da `referencia.md`.
3. ⚠ **A caixa privada sai no backup do aparelho** — preferências, estado, banco local e arquivos; só o cache e o temporário ficam de fora. Tudo vai para a nuvem do usuário, e volta num aparelho novo. Marque explicitamente o que deve ficar de fora do backup (seção 10 da `referencia.md`), e nunca guarde ali nada sensível.
4. **O `.env` do desenvolvimento mora em `Workshop/` e nunca se versiona.** O que se versiona é o `.env.example`, com os nomes das variáveis e sem os valores.
5. **A chave de assinatura do app nunca entra no repositório.** Perdê-la significa não conseguir mais publicar atualização daquele app; vazá-la significa outra pessoa publicar em seu nome.

### 13.2 O que é intocável

6. ⚠ **O app nunca apaga nada do trabalho do usuário sem confirmação explícita** — nem para "limpar", nem para "corrigir". Atualizar o app pela loja nunca toca nesse armazenamento.
7. ⚠ **Desinstalar apaga o armazenamento privado do app inteiro**, e o usuário faz isso sem imaginar a consequência. Se o app guarda trabalho de verdade, ele precisa de exportar — seção 11 da `referencia.md`.
8. **Banco que é fonte nunca se apaga sozinho** — seção 12 da `referencia.md`. Só o banco que é índice o app pode reconstruir.

### 13.3 Permissão, entrada e dependência de terceiro

9. **Permissão declarada é permissão auditada.** Pedir mais do que usa reprova na revisão da loja e assusta o usuário no diálogo.
10. **Toda entrada vinda de fora é suspeita** — deep link, notificação, arquivo compartilhado por outro app. Qualquer um pode mandar; valide antes de agir.
11. **O que o gerenciador de pacotes instala sai da lista de dependências.** Fixe as versões na lista, para que reinstalar traga exatamente o que já foi testado — tudo o que ela traz vai para dentro do pacote que o usuário instala.

---

## 14. Princípios globais

1. **Onde a plataforma manda, ela vence.** A AMF organiza o espaço livre que sobra.

2. **Organize por módulo, nunca por tipo de arquivo.** Tudo do módulo "perfil" fica junto — código, estilo, componente. Uma pasta que junta "todas as telas" ou "todos os modelos de dado" separa o arquivo do código que o usa.

3. **Onde uma coisa fica:** usada por **um** módulo → dentro dele; por **2+**, ou **editada em bloco** → sobe para o nível de `Code/`. Esta regra substitui qualquer lista fixa de pastas. A pasta de recurso que a plataforma impõe (seção 7 da `referencia.md`) é a única que foge dela.

4. **Nunca criar pastas vazias para manter simetria.** Se `backend/perfil/` existe mas não há tela para perfil, não crie `frontend/perfil/` vazia. A ausência é informativa.

5. **A pasta do esqueleto combinado nasce vazia de propósito; a IA não cria pasta por simetria.** As pastas que o Preparar projeto cria de uma vez — o esqueleto combinado para este tipo de projeto — existem antes do primeiro arquivo, e isso é intencional. O que continua proibido é a IA, no meio de uma tarefa, criar pasta que a tarefa não usa só porque a referência a descreve. A referência diz **onde** cada coisa vai quando existir.

6. **Nunca misturar código com dados gerados.** Atualizar o app pela loja não pode custar nada ao usuário.

7. **`Code/` guarda só código.** Mídia, variável de ambiente, configuração de ferramenta e pasta de dependências nunca entram em `Code/` — vão para `Assets/` ou `Workshop/`.

8. **A tela pode ser destruída a qualquer momento.** Estado que importa não vive só na memória.

9. **Permissão se pede em tempo de execução**, com caminho alternativo escrito para a negativa.

10. **Rede é opcional, não garantida.** Todo `clients/` precisa de comportamento sem conexão.

11. **Caminhos obtidos pela API do sistema**, nunca escritos à mão.

12. **Princípio DRY** — função, constante ou tipo que aparece em 2+ lugares sobe para `utils/`, `constants/` ou `types/`. Nunca duplicar.

13. **Antes de criar pasta ou arquivo novo**, verificar se já existe local apropriado. A estrutura cresce por extensão, não por duplicação.

14. **Mover ou renomear pasta quebra caminho.** Import, leitura de arquivo, o caminho que a configuração do framework usa para achar `Program/Code/` — depois de mover, procure por referências ao caminho antigo e corrija, antes de dar por terminado.

15. **Nomeie a ferramenta antes de falar dela.** Diga **framework**, **empacotador**, **compilador** ou **gerenciador de pacotes** — e, quando souber, o nome dela (React Native, Metro, Gradle, Xcode, npm). Nunca uma perífrase solta como "a etapa de montagem", que não diz qual ferramenta é nem onde fica a configuração dela.

16. **Cada linha de árvore se explica sozinha.** Ao desenhar uma árvore de pastas — aqui, em `Convenções.md` ou em qualquer registro —, cada linha diz o que a pasta guarda. Um símbolo ou uma palavra solta nunca é a explicação inteira: quem lê tem só aquela linha na frente.

### 14.1 A pasta que ninguém previu

Quando a plataforma exigir uma pasta que esta referência não previu:

| Se ela é… | Vai para |
|---|---|
| da ferramenta ou do ambiente | `Workshop/` |
| parte do produto que você escreve | `Program/` |
| parte do pacote entregue | `Distribution/` |
| **em nenhuma hipótese** | **dentro de `Code/`** |

`android/` e `ios/` são o exemplo: são da ferramenta, e por isso moram em `Workshop/` — a não ser que o framework os prenda ao lado do código, como no Expo e no Flutter (8.4 da `referencia.md`). E registre a decisão em `Convenções.md`, em cinco linhas, para não ser rediscutida na próxima vez.

---

## 15. Tabela de referência rápida

### Na raiz

| Item | Existe quando |
|---|---|
| `CLAUDE.md` | **Sempre** — as regras que a IA lê |
| `Program/` | **Sempre** |
| `Workshop/` | **Sempre** — é onde ficam a configuração do framework, `android/` e `ios/` (no Expo e no Flutter, só testes, scripts e `.env` — ver 8.4) |
| `Distribution/` | Você já gerou um pacote assinado para alguma loja — ver 2.1, acima |
| arquivo de entrada | **Nunca** — quem abre o app é o sistema |

O resto do que pode ficar na raiz, e por quê, está na tabela 2.2.

### Em Program/

| Item | Existe quando |
|---|---|
| manifesto do app | **Sempre** — nome, ícone, versão, permissões — ver 4.1 |
| `Code/` | **Sempre** |
| `Assets/` | **Sempre** — o app não instala sem ícone — ver 7 |
| `External/` | Há modelo de IA empacotado no app — ver 9.3 |
| `Dependencies/` | **Nunca** — a pasta de dependências mora em `Workshop/` — ver 9.4 |
| `Internal/` | **Não existe como pasta** — ver 10 |

### Em Code/

| Pasta | Existe quando |
|---|---|
| `frontend/` | **Sempre** — app de celular tem tela |
| `navigation/` | Há mais de uma tela, ou deep link |
| `permissions/` | O app usa câmera, localização, contatos, notificação ou arquivos |
| `backend/` | Há lógica de processamento local |
| `clients/` | O app chama serviço externo |
| `server/` | **Nunca** |
| `utils/` | Há função utilitária usada em 2+ lugares |
| `constants/` | Há valor fixo em 2+ arquivos, ou padrão de fábrica |
| `types/` | Há definição de dado compartilhada entre módulos |
| `locales/` | O app tem 2+ idiomas |
| `prompts/` | O app conversa com modelo de linguagem — ver 6.10 |

### Em Assets/, External/ e no lugar de Internal/

| Item | Existe quando |
|---|---|
| `Assets/icons/ images/ fonts/ audio/ video/` | Há esse tipo de mídia no app |
| `External/ai-models/` | Há modelo empacotado no app — ver o limite da loja em 9.3 |
| preferências do sistema | O app lembra estado ou o usuário escolhe opções |
| tabela de fila no banco local | Há fila de execução com controle próprio |
| cofre do sistema | O app usa chave, token ou senha — ver 13.1, acima |
| serviço de relato de falhas | **Sempre** em produção |

### Em Workshop/

| Item | Existe quando |
|---|---|
| configuração do framework | **Sempre** — é ela que acha `android/`, `ios/` e `Program/Code/` |
| `android/` · `ios/` | **Sempre**, uma para cada plataforma que você publica — ver 8.1 |
| a lista de dependências | Há gerenciador de pacotes |
| a pasta de dependências | Há gerenciador de pacotes que baixa para dentro do projeto — ver 9.4 |
| `tests/` | Há teste escrito — separando os da máquina dos do aparelho |
| `scripts/` | Há assinatura, variante ou publicação automatizada |
| `.env.example` · `.env` | O desenvolvimento usa variáveis de ambiente |

No Expo e no Flutter, a configuração do framework, `android/`, `ios/`, a lista e a pasta de dependências moram em `Program/`, a raiz do framework — ver 8.4.

### Onde o trabalho do usuário mora

| Item | Existe quando |
|---|---|
| armazenamento privado do app | O app guarda trabalho do usuário — ver 11 |
| `projects/` | O trabalho se divide em unidades nomeadas |
| `1-etapa/`, `2-etapa/`… | O trabalho passa por fases sequenciais |
| `intake/` | Chega material que ainda não pertence a projeto nenhum |
| `unsorted/` | Há arquivos avulsos convivendo com projetos ou etapas |
| banco local | O app guarda dado estruturado — ver 12 |
| exportar / importar | O app guarda trabalho que o usuário lamentaria perder — ver 11.4 |

---

## 16. Pares que se confundem

| | |
|---|---|
| **`Program/Code/` × `Workshop/`** | Roda quando o app roda × só existe no desenvolvimento |
| **`Code/` × `Assets/`** | O que se escreve × o que se vê ou ouve |
| **manifesto do app × configuração do framework** | O app se descrevendo, em `Program/` × como a ferramenta o monta, em `Workshop/` (no Expo e no Flutter, também em `Program/` — 8.4) |
| **`android/` `ios/` × `Program/`** | O projeto nativo que o framework exige, ferramenta × o app que você escreve |
| **`Workshop/` × `Distribution/`** | Onde ficam o compilador e a configuração dele × onde fica o pacote assinado que ele produz |
| **`External/` × pasta de dependências** | Você colou à mão × o gerenciador de pacotes instalou, e mora em `Workshop/` |
| **`clients/` × `server/`** | Você inicia a conversa × **não existe no mobile** |
| **`frontend/` × `navigation/`** | A tela em si × a rota que leva até ela |
| **`backend/` local × servidor de verdade** | Roda no aparelho × é outro projeto, chamado por `clients/` |
| **`constants/` × preferência do usuário** | Padrão de fábrica, substituído no update × o que ele escolheu, intocável |
| **`state` × `config`** | O app guarda sozinho × o usuário escolheu de propósito |
| **cache do sistema × temporário do sistema** | Sobrevive entre aberturas (mas o sistema pode apagar) × morre com a operação |
| **preferência × cofre do sistema** | Texto puro, vai no backup × segredo, fica no aparelho (no iOS, só se marcado "só neste aparelho") |
| **teste na máquina × teste no aparelho** | Lógica pura, rápido × tela e sistema de verdade, lento |
| **armazenamento privado × acervo de mídia e seletor** | Some ao desinstalar, só o app vê × sobrevive, e quem escolhe o lugar é o usuário |
| **etapas no armazenamento × tabela de fila** | Os arquivos (do usuário) × o controle (do app) |
| **Banco índice × banco fonte** | O app pode refazer × o app nunca pode apagar |

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
