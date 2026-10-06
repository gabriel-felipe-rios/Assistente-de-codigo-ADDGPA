# Como criar plugins

> **Este arquivo é o contrato.** Não há sandbox, não há proxy de API, não há
> lista de permissões — um plugin roda no mesmo processo Python e no mesmo
> documento HTML que o programa, e pode chamar tudo o que o programa pode. A
> contenção é esta página, e a razão é simples: quem escreve os plugins é o
> próprio dono do programa. Uma cerca técnica limitaria ele sem proteger
> ninguém.
>
> O preço disso é que **as regras daqui não são conselho**. Não há nada
> impedindo você de quebrá-las; o que acontece quando você quebra é que o
> programa fica estranho de um jeito difícil de diagnosticar meses depois.

## As três promessas que sustentam tudo

Se você levar só três coisas desta página, que sejam estas:

> ### 1 · Uma pasta é um plugin inteiro
>
> Código, configuração e dado gerado, os três **dentro de
> `Program/External/plugins/{o seu plugin}/`**. Instalar é copiar a pasta;
> desinstalar é apagar a pasta. Nada seu mora fora dela, e nada fora dela
> depende de você existir. Ver a [parte 3](#3--a-estrutura-em-disco).

> ### 2 · Um plugin só lê
>
> Ele nunca edita nem apaga arquivo do programa, arquivo de projeto do usuário
> ou pasta de outro plugin. Lê o que o programa já gerou, lê o código do
> projeto, e grava só dentro da própria pasta. Ver a
> [parte 2](#2--ligar-desligar-apagar) e a [parte 10](#10--o-backend).

> ### 3 · Todo plugin ganha uma página própria
>
> Um plugin não se encaixa numa tela que já existe: ele **recebe uma sub-aba só
> dele**, dentro da aba Plugins, e desenha ali o que quiser. Essa é a diferença
> de forma em relação a uma extensão, e é o que decide se o que você quer é um
> plugin. Ver a [parte 6](#6--a-página-do-plugin).

---

## Sumário

| Parte | O que tem |
|---|---|
| [1 · O que é um plugin](#1--o-que-é-um-plugin-aqui) | e quando escrever extensão em vez disto |
| [2 · Ligar, desligar, apagar](#2--ligar-desligar-apagar) | o que o programa garante, o que ele **não** garante, e onde o estado mora |
| [3 · A estrutura em disco](#3--a-estrutura-em-disco) | pasta a pasta, o nome que vira rótulo, categorias, caminhos |
| [4 · Reconhecimento pelo `plugin.json`](#4--reconhecimento-pelo-pluginjson) | os campos do manifesto, e o que acontece com erro |
| [5 · Os três tipos](#5--os-três-tipos--o-campo-tipo) | `automático`, `manual`, `isolado` |
| [6 · A página do plugin](#6--a-página-do-plugin) | o trilho, as sub-abas, os dois locais, e a categoria em Configurações |
| [7 · O frontend](#7--o-frontend) | a casca, o contexto, vários arquivos, sub-unidades, corrida |
| [8 · Ciclo de vida](#8--ciclo-de-vida-nada-avisa-que-você-morreu) | **a parte que mais quebra plugin**: ninguém avisa que o painel morreu |
| [9 · O que o programa te empresta](#9--o-que-o-programa-te-empresta) | funções, globais, bibliotecas, classes de CSS, tokens de cor |
| [10 · O backend](#10--o-backend) | `executar`, o despacho por `acao`, e por que ele é reimportado toda vez |
| [11 · O plugin automático](#11--plugin_bootpy--o-plugin-automático) | `iniciar()`, a thread principal, e o `parar()` que não existe |
| [12 · Escopo de projeto](#12--escopo-de-projeto) | `pasta_projeto` **não** é o escopo, e o que é |
| [13 · Consultar outro plugin](#13--consultar-dados-que-outro-plugin-já-capturou) | pelo disco, nunca pelo backend dele |
| [14 · Exemplo completo](#14--exemplo-completo-de-ponta-a-ponta) | um plugin de verdade, arquivo por arquivo |
| [15 · O ciclo de trabalho](#15--o-ciclo-de-trabalho-editar-e-ver) | o que exige o quê para a mudança aparecer |
| [16 · Sintomas e causas](#16--quando-não-funciona-sintoma--causa) | a tabela para quando não funciona |
| [17 · Antes de dar por pronto](#17--antes-de-dar-por-pronto) | a lista de conferência |
| [O gabarito](#o-gabarito--os-oito-que-vêm-com-o-programa) | os oito plugins reais, e o que cada um exemplifica |

Os dois arquivos irmãos, nesta mesma pasta:

- **`A API do programa.md`** — leitura **obrigatória**. Como o seu frontend fala
  com o backend do programa: o mecanismo, os métodos de leitura que existem, e
  como reconhecer um que não é de leitura.
- **`Como usar o Plugin base.md`** — leitura **opcional, por demanda**. Só se o
  seu plugin precisar de contagem de arquivos/linhas, lista de arquivos, o que
  mudou em cada dia, ou tempo gasto em rotinas/fila/chat.

⚠️ Algumas mensagens de erro do próprio programa mandam ver
`External/plugins/Como criar plugins.md`. **Esse caminho não existe.** Os três
guias moram em `Arquivos/_Como adicionar/Plugins/`, e corrigir as mensagens é
obra à parte — está registrado em
`Saída das skills/Arquitetura modular/Exceções.md`.

---

## 1 · O que é um plugin, aqui

Um plugin **lê o programa e mostra alguma coisa numa tela própria**. É o que o
distingue de uma extensão, e é por isso que o contrato dele é bem menor.

| | Plugin | Extensão do programa | Launcher |
|---|---|---|---|
| Onde mora | `Program/External/plugins/` | `Program/External/extensions/` | `Program/External/launchers/` |
| O que faz | **lê** o programa e desenha numa **aba própria** | **muda** o programa: encaixa, reage, responde, entrega dado | abre um programa externo |
| Onde se liga | Configurações › **Plugins** | Configurações › Programa › **Extensões** | Configurações › **Launchers** |
| Reconhecido por | **`plugin.json` na raiz** | **`extensao.json` na raiz** | ser um arquivo |
| Tem tela própria | **sim, sempre** — uma sub-aba só dele | não; entra em telas que já existem | não |
| Backend entre chamadas | **reimportado a cada chamada**, globais zeradas | importado uma vez ao ligar, e fica de pé | — |
| Backend em vários arquivos | só por `importlib`, nunca `from . import` | sim, com `from . import irmao` | — |
| Desligar | some da aba | **desfaz o que ela fez**, sem reiniciar | some da lista |
| Trocar o código e ver | `frontend/index.js` exige **reiniciar** | desligar e religar | — |

### Quando escrever plugin, e quando escrever extensão

O teste é uma pergunta só: **você precisa mudar alguma coisa que já existe no
programa?**

- **Não** — você quer uma tela própria que lê o projeto e mostra alguma coisa
  (um relatório, um gráfico, uma linha do tempo, uma análise). → **Plugin.** É
  o assunto desta página.
- **Sim** — você quer um item no menu de contexto do Editor, uma categoria em
  Configurações, um tema, reagir a um salvamento, decorar uma linha de código,
  responder ao autocomplete. → **Extensão**, e o guia é
  `../Extensões/Como criar extensões.md`.

⚠️ Não existe meio-termo. Um plugin que tenta se encaixar numa tela do programa
está escrevendo numa página que não é dele, sem gancho de desfazer — e, quando
o usuário desligar o plugin, o encaixe **continua lá** até o programa fechar.

---

## 2 · Ligar, desligar, apagar

Um plugin liga e desliga em Configurações › Plugins, e some da aba na hora. Mas
a promessa aqui é mais fraca que a de uma extensão, e é honesto dizer onde ela
acaba.

### O que o programa garante

- **Desligar tira o plugin das duas abas na hora**, sem reiniciar.
- **Desligar não apaga nada.** `files/` e `config/` continuam intactos; religar
  reencontra tudo.
- **Um plugin quebrado não derruba os outros.** No boot, cada `iniciar()` roda
  dentro do próprio `try`, e uma falha vira `print` no terminal, não uma janela
  que não abre. No frontend, um `index.js` que não carrega vira a mensagem "Não
  foi possível carregar o plugin" no painel dele, e só.
- **Criar ou apagar uma pasta de plugin não exige reiniciar**: a categoria
  Plugins relê `External/plugins/` toda vez que é aberta.

### O que o programa NÃO garante

Estas quatro são responsabilidade sua, e cada uma tem a sua seção adiante:

| Não garantido | O que acontece | Onde se resolve |
|---|---|---|
| **Não existe `parar()`** | desligar pela tela não interrompe laço nenhum de um plugin automático | [parte 11](#11--plugin_bootpy--o-plugin-automático) |
| **Não existe `desmontarPlugin`** | ninguém avisa que o seu painel morreu; `setInterval` e observers continuam | [parte 8](#8--ciclo-de-vida-nada-avisa-que-você-morreu) |
| **O `<style>` que você injeta nunca sai** | o CSS do seu plugin continua valendo para o programa inteiro | [parte 8](#8--ciclo-de-vida-nada-avisa-que-você-morreu) |
| **`frontend/index.js` não tem cache-busting** | editar o arquivo de entrada só faz efeito depois de reiniciar | [parte 15](#15--o-ciclo-de-trabalho-editar-e-ver) |

### Onde o estado mora

Dois arquivos, os dois em `Program/Internal/config/` — **fora** da sua pasta, e
gravados só pelo programa. O seu plugin pode **ler** o primeiro (é como um
plugin automático descobre que foi desligado); nunca escrever em nenhum dos
dois.

**`plugins.json`** — o que está ligado e onde aparece:

```json
{
  "Plugin base": { "ligado": true, "tela_principal": true },
  "Universais/Linha do tempo": {
    "ligado": true, "tela_principal": true, "dentro_do_projeto": true
  }
}
```

**`plugins-ordem.json`** — a ordem que o usuário arrastou, uma lista por nível
(`""` é a raiz):

```json
{
  "": ["Específicos", "Universais", "Plugin base"],
  "Universais": ["Animação do código", "Cenas do código", "Linha do tempo"]
}
```

Três detalhes que importam:

- **A chave é o caminho relativo**, não o nome — `"Universais/Linha do tempo"`,
  não `"Linha do tempo"`. Sem categoria, os dois coincidem.
- **Chave que falta significa desligado.** Um plugin recém-copiado não tem
  entrada nenhuma, e nasce desligado e sem local marcado. É o usuário quem
  liga; o seu plugin **não** se registra sozinho, e não deve tentar.
- **JSON corrompido vira `{}` em silêncio** — todos os plugins amanheceriam
  desligados, sem mensagem. Não é bug: é a escolha de nunca deixar um arquivo
  ruim impedir o programa de abrir.

### ⚠️ Mover o plugin para dentro de uma categoria zera o estado dele

Como a chave é o caminho, mover `Meu Plugin/` para `Dev/Meu Plugin/` cria uma
chave nova — e o plugin reaparece **desligado**, com os dois locais
desmarcados. A entrada antiga fica no arquivo para sempre (o programa faz merge
parcial e nunca poda). Não é perda de dado: `files/` e `config/` foram junto
com a pasta. É só o interruptor que volta ao zero.

---

## 3 · A estrutura em disco

```
Program/External/plugins/{o seu plugin}/
├── plugin.json         ← o manifesto: é ele que faz a pasta ser plugin
├── frontend/
│   └── index.js        ← o único que o programa injeta
├── backend/
│   └── plugin.py       ← o único que o programa importa por chamada
├── plugin_boot.py      ← só se o plugin for automático
├── files/              ← o que o plugin GERA (nasce sozinha)
└── config/             ← o que o USUÁRIO escolheu (nasce sozinha)
```

- **O nome da pasta é livre** — pode ter espaço, acento, maiúscula, ser em
  português. Ele é o nome da sub-aba: `External/plugins/Contador de Palavras/`
  vira a sub-aba "Contador de Palavras". Em Configurações › Plugins, o título
  é o `nome` do `plugin.json` (sem ele, o nome da pasta).
- **`files/` e `config/` são convenção sua, não do programa.** O programa nunca
  abre nenhuma das duas; quem as cria é o seu próprio código, com
  `os.makedirs(..., exist_ok=True)`. Não crie pasta vazia — deixe nascer quando
  houver o que guardar.
- **A separação entre as duas não é arrumação.** `config/` é o que o usuário
  escolheu e não pode se perder; `files/` é o que dá para recalcular. Quem
  troca as duas descobre isso no dia em que apagar um cache e perder a
  preferência do usuário junto.
- **`__pycache__/` vai nascer** dentro de `backend/` e da raiz, porque o import
  é por caminho. É lixo do Python, não seu — pode apagar, volta sozinho.

### Organizando em subpastas (categorias)

O usuário pode criar subpastas dentro de `External/plugins/` para agrupar
plugins — `External/plugins/Dev/Meu Plugin/`, por exemplo. A profundidade é
livre: `External/plugins/Dev/Análise/Meu Plugin/` funciona igual.

Uma subpasta é reconhecida como **categoria** (pura organização, sem
liga/desliga próprio) quando ela **não** tem `plugin.json` na própria raiz. Se
tiver, ela é ela mesma um plugin.

⚠️ **Uma pasta que é plugin para de recursar.** Plugin dentro de plugin é
invisível para o programa. Se você quer sub-unidades, o caminho é outro — ver
[Sub-unidades plugáveis](#sub-unidades-plugáveis-dentro-do-seu-plugin), na
parte 7.

⚠️ **Categoria muda a sua identidade em `chamar_plugin`.** Sem subpasta,
`caminho` e o nome da pasta são a mesma string. Dentro de uma categoria,
`caminho` passa a ser `"Dev/Meu Plugin"` — **nunca escreva esse valor fixo** no
seu `frontend/index.js`. Derive de `document.currentScript.src`:

```js
const CAMINHO_PLUGIN = document.currentScript
  ? decodeURIComponent(document.currentScript.src
      .replace(/^.*\/External\/plugins\//, '')
      .replace(/\/frontend\/index\.js(?:\?.*)?$/, ''))
  : 'Meu Plugin';   // fallback só pra não estourar se currentScript faltar
```

Assim o plugin continua funcionando não importa em que categoria (ou
profundidade de categorias) o usuário decidir organizá-lo depois.

### ⚠️ A armadilha do caminho relativo

**Nunca um caminho absoluto escrito à mão, e nunca um caminho relativo solto.**
A pasta `Program/` inteira pode ser copiada para outro lugar do disco, outro
computador, outro usuário do Windows — e o plugin tem que continuar funcionando
sem editar nada.

E há uma armadilha a mais: **o diretório de trabalho do processo é
`Program/Code/backend`**, não a sua pasta. Um `open('files/cache.json', 'w')`
grava dentro do programa, não dentro do seu plugin — e você só descobre isso
quando alguém for procurar o arquivo.

O jeito certo, em Python: montar tudo a partir de `__file__`.

```python
import os
import json

def _pasta_do_plugin(*partes):
    # Este arquivo está em backend/plugin.py — sobe um nível para a raiz do
    # plugin e desce para onde for pedido. Funciona em qualquer pasta que o
    # Program/ esteja, porque nunca depende de um caminho fixo, só da posição
    # deste arquivo. Num plugin_boot.py (que fica na raiz), é um dirname a
    # menos.
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(raiz, *partes)

CAMINHO_CACHE = _pasta_do_plugin('files', 'cache.json')

def _gravar(dado):
    os.makedirs(os.path.dirname(CAMINHO_CACHE), exist_ok=True)   # sempre antes
    with open(CAMINHO_CACHE, 'w', encoding='utf-8') as f:
        json.dump(dado, f, ensure_ascii=False, indent=2)
```

Se o seu backend precisa da **raiz do app** (para chegar a `Internal/config/`,
por exemplo), **nunca conte um número fixo de `..`** — a quantidade de níveis
entre o seu plugin e `Program/` deixou de ser constante assim que categorias
passaram a existir. Ache o marcador no próprio `__file__` e corte ali:

```python
def _raiz_do_app():
    aqui = os.path.abspath(__file__)
    marcador = os.path.join('Program', 'External', 'plugins') + os.sep
    idx = aqui.find(marcador)
    if idx == -1:
        raise RuntimeError('plugin fora de Program/External/plugins/')
    return aqui[:idx]     # tudo até antes de "Program"
```

### E se o plugin precisar escrever fora?

A regra é **não**, com **uma** exceção estreita e já registrada: **o arquivo que
o usuário acabou de pedir e apontar onde**. O plugin `Universais/Relatório do
Projeto` chama `browse_path('folder')` e grava o relatório exportado na pasta
que voltou do diálogo. As quatro condições, todas verificadas no código dele:

1. o destino é **exatamente** a string que voltou do diálogo — nunca um caminho
   montado pelo plugin;
2. grava-se **um arquivo só**, e nunca uma pasta;
3. arquivo existente **não é sobrescrito** — vira `nome (2).html`;
4. diálogo cancelado não grava nada.

**Segundo precedente — `Universais/Exportar visualizações`.** A condição 2 vale ali em outra forma: grava-se **ou um arquivo só, ou uma pasta nova com os arquivos dentro** (nunca nada solto ao lado, nunca fora da pasta nova), e se a gravação falha no meio ele apaga o que acabou de criar. As condições 1, 3 e 4 valem iguais, e ele não guarda nada na própria pasta — nem `files/`, nem `config/`.

⛔ Não generalizar. Cache, log, preferência e dado gerado continuam morando em
`files/` e `config/`, dentro da sua pasta. O precedente está em
`Saída das skills/Arquitetura modular/Exceções.md`.

---

## 4 · Reconhecimento pelo `plugin.json`

Uma pasta é plugin quando tem um **`plugin.json` na raiz** — o manifesto,
como o `extensao.json` da extensão. Sem ele, a pasta é **categoria**, e o
programa desce nela procurando mais plugins. O manifesto diz o tipo e os
caminhos de entrada; **onde o plugin aparece** (Tela principal / Dentro do
projeto) não vai nele — continua escolha do usuário, em Configurações ›
Plugins.

| Campo | Obrigatório? | O que é | Padrão |
|---|---|---|---|
| `nome` | não | o título na lista de Configurações › Plugins | o nome da pasta |
| `versao` | não | só rótulo — nada é comparado | vazio |
| `descricao` | não | uma frase, mostrada na lista abaixo do título | vazio |
| `tipo` | **sim** | `automático` · `manual` · `isolado` (ver a [parte 5](#5--os-três-tipos--o-campo-tipo)) | — |
| `frontend` | não | o arquivo que o programa injeta como `<script>` | `frontend/index.js` |
| `backend` | não | o arquivo que o programa importa a cada `chamar_plugin` | `backend/plugin.py` |
| `boot` | não | o arquivo cujo `iniciar()` roda no boot — **só no automático** | `plugin_boot.py` |

Um manifesto completo (quem usa os caminhos padrão não precisa escrever
`frontend`, `backend` nem `boot` — aqui estão só para mostrar a forma):

```json
{
  "nome": "Contador de Extensões",
  "versao": "1",
  "descricao": "Conta quantos arquivos há por extensão, dentro do escopo do projeto.",
  "tipo": "manual",
  "frontend": "frontend/index.js",
  "backend": "backend/plugin.py"
}
```

UTF-8, e `automático` **com acento** — `automatico` é erro.

As duas **funções** continuam de nome fixo — o manifesto diz o arquivo, não a
função: **`executar(payload)`** no `backend`, e **`iniciar()`** no `boot`.

### Manifesto com erro: aparece, com o erro, desligado

O plugin **nunca some calado**. Com o `plugin.json` quebrado, a linha dele
continua em Configurações › Plugins, com o erro em vermelho e o interruptor
desabilitado; a aba Plugins deixa de mostrá-lo; o `ligado` gravado em
`plugins.json` não se apaga — corrigiu o manifesto, ele volta como estava.

| O que está errado | Liga? | O que aparece |
|---|---|---|
| JSON inválido | não | `plugin.json não é um JSON válido — ` + a mensagem inteira do parser (linha e coluna) |
| o topo não é um objeto `{…}` | não | `plugin.json precisa ter um objeto no topo…` |
| `tipo` ausente ou fora dos três | não | `` `tipo` precisa ser automático, manual ou isolado… `` |
| `frontend`/`backend`/`boot` absoluto ou com `..` | não | `` `<campo>` precisa ser um caminho dentro da pasta do plugin `` |
| nem o `frontend` nem o `backend` existem no disco | não | `nem … nem … existem — o plugin não tem o que abrir` |
| `nome`, `versao` ou `descricao` com tipo errado | **sim** | a frase do campo, e o plugin funciona |

⚠️ **Declarar outro `frontend` quebra o `CAMINHO_PLUGIN`.** O jeito de o seu
frontend descobrir o próprio caminho (ver a
[parte 3](#organizando-em-subpastas-categorias)) corta o endereço em
`/frontend/index.js`. Se o seu manifesto apontar outro arquivo, ajuste essa
expressão junto — os oito plugins que vêm com o programa usam o padrão, e por
isso não escrevem `frontend`.

⚠️ **O `boot` fica na RAIZ**, irmão de `frontend/` e `backend/` — nunca dentro
de `backend/`, a não ser que o manifesto diga isso. É o erro mais comum, e o
sintoma é silencioso: o plugin simplesmente nunca roda sozinho.

⚠️ **Nenhum outro arquivo é lido pelo programa.** Não existe CSS de convenção,
ícone, `README` que apareça na tela, `requirements.txt`, nem leitura de
`config/` ou `files/`. O que estiver na sua pasta além do manifesto e dos
arquivos que ele aponta é seu, e só o seu próprio código o conhece.

---

## 5 · Os três tipos — o campo `tipo`

O `tipo` do `plugin.json` aparece abaixo do título, em Configurações ›
Plugins, e decide uma coisa só: **se o `boot` roda**.

Escolha **um** dos três termos — são o vocabulário fechado do projeto:

| Termo | Quando usar |
|---|---|
| `automático` | tem `boot` (padrão `plugin_boot.py`) e fica coletando por conta própria, sem clique nenhum |
| `manual` | só age quando o usuário clica em algo dentro da sub-aba dele |
| `isolado` | não troca dado nenhum com o backend do programa — só exibe algo pronto |

Só o `automático` roda o `boot` — no boot do programa e ao ligar. Um `manual`
ou `isolado` com `plugin_boot.py` na pasta **não** o roda.

⛔ **Nunca use "ativo"/"passivo"** como termo exibido. O par continua válido só
como conceito interno; os termos canônicos na tela são os três acima.

⚠️ O tipo é um eixo **independente** de onde o plugin roda por projeto: um
plugin automático pode ser por-projeto, um manual pode ser global, e qualquer
outra combinação.

---

## 6 · A página do plugin

Esta é a promessa 3, e é a parte que o autor de plugin mais precisa ter na
cabeça antes de desenhar qualquer coisa.

### Onde ele aparece

Existem **duas** abas "Plugins" no programa, e são independentes:

| Aba | Quando aparece | O que o plugin recebe |
|---|---|---|
| **Tela principal** | na tela de Projetos, fora de qualquer projeto | `contexto.projeto` = `null` |
| **Dentro do projeto** | com um projeto aberto | `contexto.projeto` = o nome do projeto |

Quem escolhe é o **usuário**, em Configurações › Plugins: um Interruptor
(ligado/desligado) e **dois checkboxes independentes** — pode marcar os dois, um
só, ou nenhum. O seu plugin não precisa, e não deve, tentar se registrar em
lugar nenhum sozinho.

### Como a aba é montada

Cada aba Plugins é dividida em duas metades:

- **à esquerda, o Trilho de pastas** — a árvore de categorias de
  `External/plugins/`, com "Todos" no topo. Clicar numa categoria troca o que
  aparece do lado direito;
- **à direita, uma barra de sub-abas** — **uma sub-aba por plugin** da pasta
  escolhida, e o painel do plugin ativo embaixo. É esse painel que chega ao seu
  `montarPlugin` como `container`.

Duas consequências:

- **A aba inteira some** quando nenhum plugin está marcado para aquele local. Se
  ela estava aberta e ficou vazia, o programa devolve o foco para a primeira aba
  da barra.
- **Trocar a pasta no Trilho refaz o DOM da metade direita inteira** — todos os
  painéis de plugin daquela metade são destruídos e recriados. É o gatilho de
  morte silenciosa da [parte 8](#8--ciclo-de-vida-nada-avisa-que-você-morreu).

### A categoria Configurações › Plugins

O que o usuário tem ali, hoje:

| Controle | O que faz | Quando grava |
|---|---|---|
| Interruptor | liga/desliga o plugin | **no clique** |
| Checkbox "Tela principal" | mostra na aba da tela de Projetos | **no clique** |
| Checkbox "Dentro do projeto" | mostra na aba de dentro de um projeto | **no clique** |
| Alça `⠿` de arrastar | reordena plugins entre si, e categorias entre si, **sempre dentro do mesmo nível** | só no botão **Salvar plugins** |
| **Salvar plugins** | grava **só a ordem**, de todos os níveis de uma vez | ao clicar |
| **Restaurar padrão** | desliga **todos** os plugins e desmarca os dois locais | ao confirmar |

- Uma **categoria** nunca tem interruptor nem checkbox — ela é só organização.
- **Abrir a categoria relê a pasta**: um plugin criado com o programa aberto
  aparece sem reiniciar.
- **Restaurar padrão não apaga arquivo nenhum** — só zera `plugins.json`.
- Não existe campo de busca, atalho de teclado, botão de recarregar um plugin
  específico nem botão de abrir a pasta.

---

## 7 · O frontend

`frontend/index.js` é um **script clássico** — sem `import`, sem `export`, sem
`type="module"`. Ele é injetado no `<body>` do documento do programa quando a
sub-aba do plugin é aberta pela primeira vez, e **roda no mesmo escopo global**
que o programa inteiro.

### A casca

O programa cobra **`window.montarPlugin`** logo depois do `onload` do script. Se
não estiver definido nesse instante, ele desiste e mostra "não define
`montarPlugin`" no painel.

```js
window.montarPlugin = function (container, contexto) {
  // container: o <div> onde o plugin desenha a própria tela. Já vem vazio.
  // contexto.projeto: nome do projeto (string) quando o plugin está rodando
  //   "Dentro do projeto"; null quando está na "Tela principal".
  container.innerHTML = '<p class="plugins-vazio">Olá.</p>';
};
```

Três regras que não são opcionais:

1. **`montarPlugin` tem de existir de forma síncrona.** Pode ser uma função
   `async` — o que não pode é a *definição* dela esperar um `await`. Se você
   precisa carregar coisa antes de desenhar, a função existe na hora e é o
   **corpo** dela que espera.
2. **O retorno é ignorado.** Não há gancho de valor de retorno.
3. **Envolva tudo o que puder falhar.** Uma exceção não tratada dentro do
   `montarPlugin` deixa o painel no meio do caminho, sem mensagem.

### O `contexto`

Ele tem **exatamente uma chave**, hoje: `contexto.projeto`. Não presuma mais
nada, e trate o caso `null`:

```js
window.montarPlugin = async function (container, contexto) {
  const projeto = (contexto && contexto.projeto) || null;
  if (!projeto) {
    // "Tela principal": desenhe você mesmo um seletor.
    const projetos = await window.pywebview.api.list_projects();
    // ... monte um <select> com projetos ...
  }
};
```

Se você precisa do nome do projeto aberto fora do `montarPlugin`, o global
`currentProject` tem o mesmo valor — mas prefira o `contexto`, que é o contrato.

### Falar com o seu próprio backend

```js
const r = await window.pywebview.api.chamar_plugin(
  CAMINHO_PLUGIN,                                  // derivado, nunca fixo
  { acao: 'contar', projeto: contexto.projeto }    // o que o seu backend espera
);
if (!r.success) { /* r.error tem a mensagem */ }
```

O detalhe do canal, dos erros e de tudo o que a API do programa oferece está em
`A API do programa.md`.

### Se o seu frontend não couber em um arquivo

O programa injeta **só** `frontend/index.js`, e o teto de 500 linhas por arquivo
vale aqui como em todo o projeto. Um plugin grande divide assim:

- `index.js` define `montarPlugin` **na hora**, de forma síncrona, mas o corpo
  dele é `async`: primeiro injeta os arquivos irmãos, depois desenha;
- cada irmão registra a sua parte num único global seu (`window.__meuplugin`);
- a base das URLs sai de `document.currentScript.src` — **nunca** escrita à mão,
  porque o nome da sua pasta pode ter acento e espaço e é o programa que decide
  como codificá-lo;
- **reinjete os irmãos a cada carga**, com um `?t=` qualquer, e remova os
  `<script>` antigos. Sem isso, editar um irmão não tem efeito até reiniciar.

```js
// frontend/index.js
(function () {
  const BASE = document.currentScript
    ? new URL('.', document.currentScript.src).href : '';
  const MODULOS = ['mp-estilo', 'mp-dados', 'mp-painel'];
  let carregando = null;

  function _carregarModulos() {
    if (carregando) return carregando;
    document.querySelectorAll('script[data-mp-mod]').forEach(s => s.remove());
    const t = Date.now();
    carregando = Promise.all(MODULOS.map(nome => new Promise((ok, falhou) => {
      const s = document.createElement('script');
      s.dataset.mpMod = nome;
      s.src = BASE + nome + '.js?t=' + t;   // o "?t=" força recarregar
      s.onload = ok;
      s.onerror = () => falhou(new Error('não achou ' + nome + '.js'));
      document.head.appendChild(s);
    })));
    return carregando;
  }

  window.montarPlugin = function (container, contexto) {   // síncrono
    container.innerHTML = '<p class="plugins-vazio">Carregando…</p>';
    _carregarModulos().then(() => {
      window.__meuplugin.painel.montar(container, contexto);
    }).catch(e => {
      carregando = null;    // libera para tentar de novo
      container.innerHTML = '<p class="plugins-vazio">Não deu para carregar os '
        + 'módulos deste plugin (' + String(e && e.message || e) + ').</p>';
    });
  };
})();
```

Nada disso muda o reconhecimento do plugin: continua sendo só a presença de
`frontend/index.js`.

### Sub-unidades plugáveis dentro do seu plugin

Se o seu plugin hospeda várias peças independentes — várias animações, vários
relatórios, vários modos —, e você quer que acrescentar uma seja **só criar uma
pasta**, o padrão é:

```
{plugin}/frontend/{categoria}/{Nome da sub-unidade}/{arquivo-de-entrada}.js
```

- **o backend descobre por `os.listdir`**, na hora, dentro da própria pasta do
  plugin — nunca uma lista fixa em código. Uma subpasta só conta se tiver o
  arquivo de entrada esperado lá dentro (presença de arquivo, sem manifesto
  próprio da sub-unidade);
- **o nome da subpasta é o id e o título ao mesmo tempo** — aceita espaço e
  acento, porque é isso que aparece na tela;
- **o frontend injeta só o que o backend confirmou existir**, e cada arquivo
  injetado **se autorregistra** (`window.__meuplugin.registrar(id, {...})`),
  descobrindo o próprio id a partir de `document.currentScript.src`.

⚠️ Isso é um eixo **diferente** de categoria de plugin: a sub-unidade não tem
`frontend/index.js` nem `backend/plugin.py` próprios, e só existe dentro de um
plugin já reconhecido. O gabarito é `Universais/Cenas do código`.

### ⚠️ Depois de um `await`, confira se ainda está montada

Toda ida à ponte é assíncrona, e o painel pode ter morrido (ou o usuário pode
ter trocado de projeto) enquanto você esperava. Duas guardas, e as duas são
necessárias:

```js
let montada = false;
let pedido = 0;

async function carregar(container, projeto) {
  const meu = ++pedido;                              // 1. guarda de corrida
  const r = await window.pywebview.api.chamar_plugin(CAMINHO_PLUGIN,
                                                     { acao: 'ler', projeto });
  if (!montada) return;                              // 2. guarda de montagem
  if (meu !== pedido) return;   // chegou uma resposta mais nova antes desta
  pintar(container, r);
}
```

- **A guarda de corrida** existe porque duas chamadas em voo podem voltar fora
  de ordem: clicar depressa em dois projetos pinta o dado do primeiro por cima
  do segundo. Se o seu plugin tem dois carregamentos independentes, use **dois
  contadores** — com um só, iniciar um cancela o outro e a tela fica presa em
  "Carregando…" para sempre.
- **A guarda de montagem** é a da [parte 8](#8--ciclo-de-vida-nada-avisa-que-você-morreu).

---

## 8 · Ciclo de vida: nada avisa que você morreu

**Esta é a parte que mais quebra plugin, e a que nenhuma versão anterior deste
guia contava.** Leia inteira antes de escrever um `setInterval`.

### Os cinco momentos

| Momento | O que o programa faz | O que o seu plugin recebe |
|---|---|---|
| Abrir a sub-aba pela primeira vez | injeta `frontend/index.js` e chama `montarPlugin(painel, {projeto})` | a chamada |
| Sair para outra sub-aba | só troca classes: o painel fica **escondido, mas vivo** | **nada** |
| Voltar para a sub-aba | **não remonta** — o painel guarda que já carregou | **nada** |
| Trocar de projeto (aba "Dentro do projeto") | **remonta**: chama `montarPlugin` de novo, no mesmo `container` | a chamada, com o projeto novo |
| Trocar a pasta no Trilho, ou o usuário mexer em Configurações › Plugins | **refaz o DOM da metade direita**: o seu painel é destruído | **nada** |

E, ao abrir **outro** plugin, o programa remove o `<script>` do seu e zera
`window.montarPlugin` — mas **não desfaz nada** que o seu código já tenha
registrado: closures, timers, listeners de `window`, `<style>` no `<head>`,
módulos irmãos injetados. Tudo continua vivo até o programa fechar.

⛔ **`window.desmontarPlugin` não existe.** Não adianta defini-lo: ninguém
chama.

### O padrão de auto-limpeza

Como ninguém te avisa, **você se limpa na entrada**: guarde um `destroy` no
próprio `container` e chame-o no começo do `montarPlugin`. É o que os plugins
reais fazem.

```js
const ESTADO = Symbol('meuPluginEstado');   // não colide com nada da página

window.montarPlugin = function (container, contexto) {
  // 1. Se este container já teve uma montagem, desfaça-a antes de tudo.
  if (container[ESTADO] && typeof container[ESTADO].destroy === 'function') {
    container[ESTADO].destroy();
  }
  while (container.firstChild) container.removeChild(container.firstChild);

  // 2. Monte, guardando TUDO que precisa ser desfeito.
  const desligar = [];
  let montada = true;

  const timer = setInterval(atualizar, 30000);
  desligar.push(() => clearInterval(timer));

  const aoRedimensionar = () => reposicionar();
  window.addEventListener('resize', aoRedimensionar);
  desligar.push(() => window.removeEventListener('resize', aoRedimensionar));

  const obs = new ResizeObserver(reposicionar);
  obs.observe(container);
  desligar.push(() => obs.disconnect());

  container[ESTADO] = {
    destroy() {
      montada = false;
      desligar.forEach(fn => { try { fn(); } catch (e) {} });
      desligar.length = 0;
    },
  };
};
```

Isso resolve o caso da remontagem (mesmo `container`). O caso em que o painel é
**jogado fora inteiro** não tem como ser interceptado — por isso a segunda
metade da defesa: **nada do seu plugin pode continuar fazendo trabalho quando o
container já saiu do documento**.

```js
function atualizar() {
  if (!container.isConnected) {   // o painel foi removido do documento
    container[ESTADO].destroy();  // apaga a luz sozinho
    return;
  }
  // ... trabalho de verdade ...
}
```

Regra prática: **todo `setInterval` de plugin confere `container.isConnected`
antes de trabalhar**, e se desliga quando o container já não está na página.

### O `<style>` que nunca sai

O CSS do seu plugin é injetado em `document.head` e **vale para o programa
inteiro** — não há shadow DOM, não há isolamento, e ninguém remove o `<style>`
quando o plugin some.

Duas obrigações:

```js
function injetarEstilo() {
  if (document.getElementById('mp-estilo')) return;   // 1. guarda por id
  const s = document.createElement('style');
  s.id = 'mp-estilo';
  s.textContent = CSS;
  document.head.appendChild(s);
}
```

1. **Guarda por id**, para não empilhar uma cópia a cada remontagem.
2. **Todo seletor prefixado.** Um `.card { … }` solto repinta cartão do programa
   inteiro. Use um prefixo curto e só seu — os plugins existentes usam `pb-`,
   `rel-`, `ltempo-`, `cxcod-`, `anicod-`, `pnp-`, `cenascod-`, `ct-`.

O mesmo vale para **nome global**: `window.__meuplugin` e nada mais. Um nome
genérico no `window` pode sobrescrever uma função do programa, e o sintoma é uma
tela do programa que para de funcionar depois que você instalou o seu plugin.

---

## 9 · O que o programa te empresta

Tudo isto já está carregado quando o seu `montarPlugin` roda, porque o seu
script vive no mesmo documento. **Use, em vez de reescrever.**

### Funções

| Função | O que faz |
|---|---|
| `showToast(msg, ehErro, origem)` | a notificação do canto. Substitui `alert()`, que trava a janela |
| `abrirModalPadrao({title, bodyHtml, confirmLabel, onConfirm, classe, semCancelar})` | a caixa de confirmar. `onConfirm(overlay, showErr)`; devolver `false` mantém a caixa aberta |
| `escapeHtml(txt)` | **use sempre** antes de pôr texto do usuário (ou do disco) em `innerHTML` |
| `renderMarkdown(txt)` | markdown simples → HTML, com os blocos de código já escapados |
| `setError(elId, msg)` | escreve a mensagem de erro num elemento |
| `copiarPeloBotao(botao, texto, rotuloOriginal)` | copiar com o ✓ dentro do próprio botão (para botão só-ícone) |

⚠️ Trate-as como **opcionais**: `if (typeof showToast === 'function')`. É o que
os plugins existentes fazem, e é o que impede o seu plugin de quebrar se um dia
o programa renomear algo.

### Globais

| Global | O que é |
|---|---|
| `currentProject` | o nome do projeto aberto, ou `null` |
| `appSettings` | as configurações do programa — **leia**, nunca grave |
| `workspaceConfig` | a configuração do projeto aberto |
| `window.pywebview.api` | o backend do programa inteiro — ver `A API do programa.md` |

### Bibliotecas já carregadas na página

Estas cinco estão no documento **antes** de qualquer plugin existir. Use-as
direto, sem importar de novo:

| Global | Biblioteca | Para |
|---|---|---|
| `d3` | d3 v7 | gráficos, hierarquias, forças, zoom |
| `marked` | marked | markdown completo → HTML |
| `AnsiUp` | ansi_up | saída de terminal com cor ANSI → HTML |
| `Prism` | Prism (com autoloader) | pintar código-fonte |
| `Terminal` | xterm.js | um terminal dentro da tela |

### As bibliotecas que você traz

Se precisar de uma biblioteca que **não** está nessa lista, **traga a sua
própria cópia** em `{o seu plugin}/frontend/lib/` e carregue sob demanda.

⛔ **Nunca aponte para `External/libraries/`.** É o balde do programa: um plugin
que dependa de lá quebra quando alguém arrumar aquela pasta, e copiar a sua
pasta para outro computador deixa de bastar. O precedente é
`Universais/Relatório do Projeto/frontend/lib/`, com `html2canvas.min.js` e
`jspdf.umd.min.js` — duplicados de propósito.

A regra em uma linha: **biblioteca que o programa já injeta, usa-se a do
programa; biblioteca que só o plugin usa, ele traz a dele.**

### Classes de CSS

Prefira as do programa às suas: elas já estão certas nos cinco temas.

| Classe | O que é |
|---|---|
| `.plugins-vazio` | o parágrafo de estado vazio / carregando. É o que o próprio programa usa nos painéis de plugin |
| `.btn` + `.btn-primary` / `.btn-positive` / `.btn-negative` / `.btn-utility` / `.btn-sm` | os botões |
| `.config-cartao` + `-cabecalho` / `-titulo` / `-dica` | um cartão de configuração |
| `.config-grade` · `.config-field-row` · `.config-check` · `.config-nota` · `.config-erro` | grade, campo com rótulo, caixa de seleção, ajuda, faixa de erro |
| `.toggle-pill` + `.toggle-track` / `.toggle-knob` / `.toggle-label` | o interruptor de efeito imediato |
| `.mapa-toggle` + `.mapa-toggle-btn` | o toggle segmentado (2 a 3 opções) |
| `.hidden` | esconde. **Use esta, e não `style.display`** |

### Tokens de cor

**Nunca escreva hexadecimal.** O programa tem **cinco temas** — Ardósia
(padrão), Carvão, Drácula, Obsidiana e **Papel, que é claro** — e uma cor fixa
fica ilegível em pelo menos um deles.

| Token | Para |
|---|---|
| `var(--bg)` · `var(--surface)` · `var(--surface-hover)` · `var(--surface-dark)` | fundos |
| `var(--text)` · `var(--text-muted)` | texto |
| `var(--blue)` | acontecendo agora, item ativo |
| `var(--green)` | terminou bem |
| `var(--red)` | erro |
| `var(--amber)` | aviso, terminou faltando pedaço |
| `var(--purple)` | acréscimo, fora do fluxo normal |
| `var(--teal)` · `var(--yellow)` · `var(--gray)` | acentos |
| `var(--radius)` · `var(--t)` | raio de borda e duração de transição |

Para transparência, use a variante `-rgb`:
`rgba(var(--blue-rgb), 0.12)`. Existem também `--white-rgb` e `--black-rgb`,
para véus que acompanham o tema.

⚠️ **Confira o nome antes de usar.** Um token que não existe cai
silenciosamente no valor de reserva do `var()` — e a sua tela fica com a cor
errada em todos os temas menos naquele em que você testou. Os nomes acima são
os que existem; **`--text-primary` e `--font-family`, por exemplo, não
existem** (um plugin do programa usa o primeiro por engano, e por isso o texto
dele não acompanha o tema).

Os tokens de tema moram em `Program/Code/frontend/estilos/tema/tema-*.css`; os
que não mudam com o tema (`--radius`, `--t`), em
`estilos/tema/tokens-fixos.css`.

---

## 10 · O backend

`backend/plugin.py` é um módulo Python comum, com **uma** função de nome fixo:

```python
def executar(payload):
    """O único ponto de entrada. `payload` é o dicionário que o frontend
    mandou em chamar_plugin, mais o que o programa acrescentou."""
    return {'success': True, 'dado': ...}
```

Ele só é chamado quando o **frontend** pede (`chamar_plugin`) — nunca sozinho.

### O despacho por `acao`

Uma função só, e um plugin com várias operações. A convenção de todos os
plugins do programa é despachar por uma chave `acao` no payload:

```python
def executar(payload):
    acao = (payload or {}).get('acao')
    try:
        if acao == 'ler_cache':
            return {'success': True, **_ler_cache(payload)}
        if acao == 'gerar':
            return {'success': True, **_gerar(payload)}
        if acao == 'ler_prefs':
            return {'success': True, 'prefs': _ler_prefs()}
        return {'success': False, 'error': 'ação desconhecida: %s' % acao}
    except Exception as e:
        # Nunca deixe a exceção subir: o traceback se perde no caminho.
        return {'success': False, 'error': '%s: %s' % (type(e).__name__, e)}
```

### ⚠️ O módulo é reimportado a CADA chamada

Esta é a diferença de fundo em relação a uma extensão, e ela muda como você
escreve o backend:

- **Global de módulo não sobrevive** entre duas chamadas. Um `_CACHE = {}` no
  topo do arquivo está vazio de novo na chamada seguinte. Se você precisa de
  cache entre chamadas, ele é **arquivo em `files/`**, não memória.
- **Código de nível de módulo roda toda vez.** Um `json.load` no topo do
  arquivo é pago em cada clique do usuário. Ponha o trabalho dentro das
  funções.
- **O módulo não é um pacote.** `from . import irmao` estoura com "attempted
  relative import with no known parent package", e `import irmao` estoura com
  `No module named 'irmao'`.

### Vários arquivos no backend

O teto de 500 linhas vale aqui também, e o caminho não é `import` — é carregar
o irmão **por caminho**:

```python
import importlib.util
import os

def _irmao(nome):
    """Carrega um .py da mesma pasta e devolve o módulo."""
    caminho = os.path.join(os.path.dirname(os.path.abspath(__file__)), nome + '.py')
    spec = importlib.util.spec_from_file_location('mp_' + nome, caminho)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo

_MODS = None

def _mods():
    global _MODS
    if _MODS is None:                       # vale só DENTRO desta chamada
        _MODS = {n: _irmao(n) for n in ('mp_escopo', 'mp_metricas')}
    return _MODS
```

⚠️ O prefixo do nome sintético (`'mp_' + nome`) é o ponto que mais se esquece de
trocar ao copiar um plugin de outro. Dois plugins com o mesmo prefixo carregam
o módulo um do outro.

⚠️ Como o módulo principal é reexecutado por chamada, o `_MODS` acima economiza
só dentro de **uma** chamada — que já é o caso que importa, porque uma chamada
pode tocar vários irmãos.

⚠️ **`plugin_boot.py` é outro módulo.** Ele não enxerga o `backend/plugin.py`, e
o `backend/plugin.py` não enxerga ele. Se os dois precisam do mesmo código, ou
cada um carrega o mesmo irmão por caminho, ou o código é duplicado de propósito
— e o motivo fica escrito no topo dos dois arquivos.

### Erros

**Nunca deixe a exceção subir.** O programa embrulha o seu `executar()` num
`try` e devolve ao frontend `{'success': False, 'error': 'Erro dentro do
plugin: <a mensagem>'}` — e **o traceback se perde ali**. Você fica com uma
linha de texto e nenhuma pista de qual linha do seu `.py` estourou.

Duas providências:

```python
import traceback

def executar(payload):
    try:
        ...
    except Exception as e:
        traceback.print_exc()        # o traceback vai para o TERMINAL
        return {'success': False, 'error': '%s: %s' % (type(e).__name__, e)}
```

- `traceback.print_exc()` imprime no terminal de onde o programa foi lançado —
  é o único lugar em que o traceback de um plugin aparece inteiro.
- Devolva o **nome da classe** junto com a mensagem: um `KeyError: 'linhas'`
  sozinho não diz quase nada.

E o retorno precisa ser **serializável em JSON**: `dict`, `list`, `str`, número,
booleano, `None`. `set`, `datetime` e objetos Python não atravessam.

---

## 11 · `plugin_boot.py` — o plugin automático

Fica na **raiz** do plugin. A presença deste arquivo é o único sinal de que o
plugin é automático: se ele existir e o plugin estiver **ligado**, o programa
importa e chama `iniciar()` uma vez, no boot.

```python
def iniciar():
    """Chamada UMA VEZ, no boot, só se este plugin estiver ligado."""
    ...
```

### ⚠️ Roda na thread principal, antes de a janela existir

`iniciar()` não roda numa thread de fundo: roda **na thread do boot**, de forma
síncrona, **antes** de a janela do programa ser criada. Um `iniciar()` lento
atrasa a abertura do programa; um `iniciar()` travado trava tudo.

**Devolva na hora.** Se você tem trabalho a fazer, agende-o e saia:

```python
import threading

def iniciar():
    # Não faz trabalho aqui. Agenda e devolve — a janela precisa abrir.
    t = threading.Timer(5.0, _ciclo)
    t.daemon = True          # daemon: não segura o fechamento do programa
    t.start()
```

### ⚠️ Não existe `parar()`

O programa **não** chama nada do seu plugin ao fechar, e **desligar o plugin
pela tela não interrompe o seu laço**. Não adianta definir `parar()`,
`finalizar()` ou `desligar()`: ninguém procura por esses nomes.

O padrão obrigatório, então, é um laço que **se reagenda sempre** e **relê o
próprio estado a cada volta**:

```python
import json
import os
import threading

def _ligado():
    """Lê Internal/config/plugins.json e devolve se ESTE plugin está ligado.
    Releitura a cada ciclo: o usuário pode ter desligado desde o boot."""
    try:
        caminho = os.path.join(_raiz_do_app(), 'Program', 'Internal',
                               'config', 'plugins.json')
        with open(caminho, 'r', encoding='utf-8') as f:
            config = json.load(f)
    except (OSError, json.JSONDecodeError):
        return False
    return bool(config.get(_MEU_CAMINHO_RELATIVO, {}).get('ligado'))

def _ciclo():
    try:
        if _ligado():
            _fazer_o_trabalho()
    except Exception as e:
        print('[meu plugin] ciclo falhou:', e)
    finally:
        # SEMPRE reagenda, mesmo desligado: é assim que religar volta a
        # funcionar sem reiniciar o programa.
        t = threading.Timer(_intervalo_segundos(), _ciclo)
        t.daemon = True
        t.start()
```

Três coisas nesse molde não são opcionais:

1. **O `finally` reagenda sempre**, ligado ou desligado. Se o laço parasse ao
   ser desligado, religar exigiria reiniciar o programa.
2. **`daemon = True`**, senão o programa não fecha.
3. **O `try` por volta do trabalho**, senão um erro numa volta mata o laço para
   sempre.

⚠️ E o preço a pagar, que é honesto declarar: **uma thread do seu plugin fica
viva até o programa fechar**, mesmo com ele desligado. É a diferença em relação
a uma extensão, que tem `parar()` de verdade.

### O que mais é silencioso aqui

- **`plugin_boot.py` sem `iniciar()` é ignorado sem aviso.** Nada é impresso, e
  o plugin simplesmente nunca roda sozinho.
- **Falha ao importar** vira `[plugins] falha ao carregar plugin_boot.py de
  "…"` no terminal, e o boot segue.
- **`iniciar()` que estoura** vira `[plugins] "…" falhou em iniciar(): …` no
  terminal, e o boot segue.

Em nenhum dos três casos aparece algo na tela. Se o seu plugin automático não
está coletando, **o terminal é o primeiro lugar a olhar**.

### Não há canal de push

O programa fala com a própria tela por `window.evaluate_js(...)`, chamando
funções globais de JavaScript pelo nome. O seu `plugin_boot.py` **não recebe a
janela** e não tem esse canal — e sobrescrever uma função global do programa
para interceptar o push dele quebra a tela do programa.

Se o frontend do seu plugin precisa acompanhar algo que o backend faz, o padrão
é **perguntar de tempos em tempos**, com um método barato:

```js
// Pergunta a cada 5 s por um "carimbo" leve; só recarrega o pesado quando ele
// muda. É o que o próprio programa faz nas telas que vigiam disco.
let ultimoCarimbo = null;
const timer = setInterval(async () => {
  if (!container.isConnected) { container[ESTADO].destroy(); return; }
  const r = await window.pywebview.api.chamar_plugin(CAMINHO_PLUGIN,
                                                    { acao: 'carimbo' });
  if (r.success && r.carimbo !== ultimoCarimbo) {
    ultimoCarimbo = r.carimbo;
    await recarregar();
  }
}, 5000);
```

---

## 12 · Escopo de projeto

Alguns plugins fazem sentido sobre todos os projetos; outros, sobre um projeto
específico. Isso também não é um campo para marcar: é a forma como o seu
`frontend/index.js` usa (ou não) o `contexto.projeto` que recebe.

- Sub-aba **"Dentro do projeto"**: `contexto.projeto` já vem preenchido. Não
  precisa de seletor.
- Sub-aba **"Tela principal"**: `contexto.projeto` vem `null`. Se o seu plugin
  for por-projeto, desenhe você mesmo um seletor —
  `await window.pywebview.api.list_projects()` devolve a lista de nomes.

### O que o programa acrescenta ao payload

Quando você manda `payload['projeto']` preenchido em `chamar_plugin`, o
programa resolve três coisas para você antes de o seu `executar()` ser chamado:

| Chave | O que é | Quando falta |
|---|---|---|
| `pasta_projeto` | o `root_folder` do projeto | a chave **existe com valor `None`** se a leitura do workspace falhar |
| `grafo_imports` | o `grafo.json` inteiro do Grafo de Imports | **ausente** se aquele projeto nunca rodou o Grafo |
| `pipeline` | o resultado inteiro de "Visualizar pipeline" | **ausente** se nunca rodou o agente Pipeline |

⚠️ A assimetria é de propósito, e muda o seu `if`: para `pasta_projeto`, teste o
**valor** (`if not payload.get('pasta_projeto')`); para os outros dois, teste a
**presença** (`if 'grafo_imports' in payload`).

⚠️ Sem `payload['projeto']`, **nenhuma das três** é acrescentada. Na sub-aba
"Tela principal", mande o projeto que o usuário escolheu no seu seletor.

### ⚠️ `pasta_projeto` NÃO é o escopo do projeto

`pasta_projeto` é a **raiz inteira**. Quase nunca é isso que você quer. Quem
manda no que "conta" num projeto são três listas, e as três moram em
`Files/projects/{Projeto}/Projeto/Workspace.json`:

| Chave | O que é | Regra |
|---|---|---|
| `working_folders` | as **pastas de trabalho** | é daqui que a varredura parte, e só daqui |
| `ignore_list` | a aba **Remover** | itens `{path, type, recursive}`; `type: 'file'` casa o arquivo exato |
| `context_items` | **Contexto sem leitura** | `{path, description}`; é **sempre recursivo** |

O contrato está escrito no próprio programa, em `analise.py`: "a varredura parte
de `working_folders` e SÓ dela. Nada fora da pasta de trabalho entra — nem a
raiz do projeto, nem o arquivo principal."

Ler esse JSON é permitido: é artefato que o programa gerou. O que você **não**
pode é importar `ignorados.py` do programa — reescreva as duas comparações
dentro do seu plugin:

```python
import os

def _normalizar(caminho):
    return os.path.normcase(os.path.abspath(str(caminho)))

def _dentro_de(caminho, pasta):
    # Ou é a própria pasta, ou está abaixo dela. O separador no fim evita
    # que ".../Program" case com ".../Programas".
    c, p = _normalizar(caminho), _normalizar(pasta)
    return c == p or c.startswith(p + os.sep)

def esconder(caminho, ignore_list, context_items):
    for item in (ignore_list or []):                    # aba "Remover"
        alvo = item.get('path') if isinstance(item, dict) else item
        if not alvo:
            continue
        tipo = item.get('type', 'folder') if isinstance(item, dict) else 'folder'
        recursivo = item.get('recursive', True) if isinstance(item, dict) else True
        if tipo == 'file':
            if _normalizar(caminho) == _normalizar(alvo):
                return True
        elif recursivo:
            if _dentro_de(caminho, alvo):
                return True
        elif _normalizar(os.path.dirname(caminho)) == _normalizar(alvo):
            return True
    for item in (context_items or []):                  # "Contexto sem leitura"
        alvo = item.get('path') if isinstance(item, dict) else None
        if alvo and _dentro_de(caminho, alvo):           # sempre recursivo
            return True
    return False
```

Percorra a partir de `working_folders`, chamando `esconder(caminho,
workspace['ignore_list'], workspace['context_items'])` para cada arquivo e
descartando os que derem `True`. Descarte também as pastas puramente técnicas
(`.git`, `node_modules`, `__pycache__`, `.venv`, `venv`, `dist`, `build`, e
qualquer pasta que comece com `.`).

Se fizer sentido para o seu plugin, deixe o usuário escolher se quer incluir os
itens de "Remover" e de "Contexto sem leitura" no escopo (passando lista vazia
em vez da de verdade) — não é obrigatório, mas evita que o plugin trabalhe com
um escopo diferente do que o usuário vê no resto do programa sem avisar.

A diferença não é pequena. Num projeto real, esse filtro pode ser a diferença
entre algumas centenas de arquivos no escopo correto e alguns milhares lendo a
raiz inteira.

### Dados por projeto, dentro de `files/`

Se o seu plugin gera algo por projeto (um cache do cálculo, por exemplo),
separe por projeto dentro da própria `files/`:

- Dado pequeno → um arquivo: `files/{nome-do-projeto}.json`
- Dado grande, mais de um arquivo → uma subpasta: `files/{nome-do-projeto}/`

`{nome-do-projeto}` é sempre o nome **literal** da pasta do projeto, o mesmo que
aparece na tela de Projetos. Um plugin que não é por-projeto não segue essa
convenção — `files/` fica plano.

Quando o dado por projeto tem partes de tamanhos muito diferentes, o corte
dentro da pasta é **pelo custo de ler**, não por assunto: o retrato leve num
arquivo, o volume em outro, e o histórico numa unidade por dia. É o que o
Plugin base faz, e o motivo está em
`Saída das skills/Arquitetura modular/Convenções.md`.

E, sempre que gravar, grave **atômico**: escreva um `.tmp` ao lado e
`os.replace()` por cima. É o que permite outro plugin (ou outra parte do seu)
ler a qualquer momento sem pegar um JSON pela metade.

---

## 13 · Consultar dados que outro plugin já capturou

**Lendo o `files/` dele direto do disco. Nunca chamando o backend dele.**

O motivo é o de sempre: chamar o backend do outro faz os dois terem de estar
ligados juntos, e desligar um passa a quebrar o outro sem erro nenhum. Ler o
arquivo funciona mesmo com o outro desligado — e quando o arquivo não existe,
você sabe exatamente o que aconteceu.

⛔ `chamar_plugin('Plugin base', ...)` é proibido, mesmo que o método exista.
⛔ Importar o `plugin_boot.py` ou o `backend/plugin.py` do outro é proibido.
⛔ Escrever dentro da pasta do outro é proibido.

A leitura cruzada só é legítima quando o plugin autor **documenta o formato como
contrato público** — não é "abrir qualquer coisa que outro plugin salvou por
acaso".

```python
# backend/mp_caminhos.py — só monta caminho, nunca abre arquivo.
import os

# ⚠️ Subir um número fixo de níveis NÃO funciona: o seu plugin pode estar na
# raiz de plugins/ ou dentro de uma categoria, e a profundidade muda. Suba até
# achar a pasta "plugins", que é a única constante.
def pasta_de_plugins():
    p = os.path.dirname(os.path.abspath(__file__))
    while os.path.basename(p) != 'plugins':
        pai = os.path.dirname(p)
        if pai == p:
            raise RuntimeError('não achei a pasta plugins acima de mim')
        p = pai
    return p

def arquivo_de_outro_plugin(nome_do_plugin, *partes):
    return os.path.join(pasta_de_plugins(), nome_do_plugin, 'files', *partes)
```

```python
# backend/mp_dados.py — o único que abre arquivo.
import json

def retrato(projeto):
    caminho = mp_caminhos.arquivo_de_outro_plugin('Plugin base', projeto, 'atual.json')
    try:
        with open(caminho, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        # O caso NORMAL: aquele plugin nunca rodou neste projeto. Não é erro.
        return None
    except (OSError, json.JSONDecodeError) as e:
        print('[meu plugin] não deu para ler o retrato:', e)
        return None
```

O único contrato público que existe hoje é o do **Plugin base**, que publica,
por projeto, o retrato de agora e o histórico do que mudou em cada dia. O
detalhamento inteiro está em `Como usar o Plugin base.md`, nesta mesma pasta —
mande esse arquivo junto do pedido se o seu plugin precisar desse dado.

---

## 14 · Exemplo completo, de ponta a ponta

Um plugin por-projeto que conta quantos arquivos há por extensão, dentro do
escopo de verdade do projeto, e guarda o resultado em cache.

```
Program/External/plugins/Contador de Extensões/
├── plugin.json
├── frontend/index.js
├── backend/plugin.py
└── files/            (nasce sozinha)
```

### `plugin.json`

```json
{
  "nome": "Contador de Extensões",
  "versao": "1",
  "descricao": "Conta quantos arquivos há por extensão, dentro do escopo do projeto.",
  "tipo": "manual"
}
```

### `backend/plugin.py`

```python
"""Plugin "Contador de Extensões" — o backend.

Contrato único: executar(payload), com payload['acao'] escolhendo o quê.
Nunca roda sozinho (não há plugin_boot.py): só age quando o frontend pede.

    ler_cache → devolve a última contagem gravada deste projeto
    contar    → varre o escopo e grava o cache

Tudo que se lê é o Workspace.json que o programa gerou, ou o código do projeto.
Tudo que se grava fica em files/, dentro desta pasta.
"""

import json
import os
import traceback
from datetime import datetime

VERSAO = 1

TECNICAS = {'.git', 'node_modules', '__pycache__', '.venv', 'venv', 'dist', 'build'}


def _pasta_do_plugin(*partes):
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(raiz, *partes)


def _raiz_do_app():
    aqui = os.path.abspath(__file__)
    marcador = os.path.join('Program', 'External', 'plugins') + os.sep
    idx = aqui.find(marcador)
    if idx == -1:
        raise RuntimeError('plugin fora de Program/External/plugins/')
    return aqui[:idx]


def _workspace(projeto):
    caminho = os.path.join(_raiz_do_app(), 'Files', 'projects', projeto,
                           'Projeto', 'Workspace.json')
    with open(caminho, 'r', encoding='utf-8') as f:
        return json.load(f)


def _normalizar(c):
    return os.path.normcase(os.path.abspath(str(c)))


def _dentro_de(caminho, pasta):
    c, p = _normalizar(caminho), _normalizar(pasta)
    return c == p or c.startswith(p + os.sep)


def _esconder(caminho, ignore_list, context_items):
    for item in (ignore_list or []):
        alvo = item.get('path') if isinstance(item, dict) else item
        if not alvo:
            continue
        tipo = item.get('type', 'folder') if isinstance(item, dict) else 'folder'
        rec = item.get('recursive', True) if isinstance(item, dict) else True
        if tipo == 'file':
            if _normalizar(caminho) == _normalizar(alvo):
                return True
        elif rec:
            if _dentro_de(caminho, alvo):
                return True
        elif _normalizar(os.path.dirname(caminho)) == _normalizar(alvo):
            return True
    for item in (context_items or []):
        alvo = item.get('path') if isinstance(item, dict) else None
        if alvo and _dentro_de(caminho, alvo):
            return True
    return False


def _caminho_do_cache(projeto):
    return _pasta_do_plugin('files', os.path.basename(str(projeto)) + '.json')


def _ler_cache(projeto):
    try:
        with open(_caminho_do_cache(projeto), 'r', encoding='utf-8') as f:
            dado = json.load(f)
    except (OSError, json.JSONDecodeError):
        return None
    # Cache de outra versão do formato é o mesmo que cache nenhum.
    return dado if dado.get('versao') == VERSAO else None


def _gravar_cache(projeto, dado):
    destino = _caminho_do_cache(projeto)
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    temporario = destino + '.tmp'
    with open(temporario, 'w', encoding='utf-8') as f:
        json.dump(dado, f, ensure_ascii=False, indent=2)
    os.replace(temporario, destino)      # atômico: ninguém lê pela metade


def _contar(projeto):
    ws = _workspace(projeto)
    pastas = ws.get('working_folders') or []
    ignore = ws.get('ignore_list') or []
    contexto = ws.get('context_items') or []

    por_extensao = {}
    total = 0
    for base in pastas:
        for raiz, subpastas, arquivos in os.walk(base):
            subpastas[:] = [d for d in subpastas
                            if d not in TECNICAS and not d.startswith('.')]
            for nome in arquivos:
                caminho = os.path.join(raiz, nome)
                if _esconder(caminho, ignore, contexto):
                    continue
                ext = (os.path.splitext(nome)[1] or '(sem extensão)').lower()
                por_extensao[ext] = por_extensao.get(ext, 0) + 1
                total += 1

    return {
        'versao': VERSAO,
        'projeto': projeto,
        'atualizado_em': datetime.now().isoformat(timespec='seconds'),
        'total': total,
        'por_extensao': por_extensao,
    }


def executar(payload):
    payload = payload or {}
    acao = payload.get('acao')
    projeto = payload.get('projeto')
    try:
        if not projeto:
            return {'success': False, 'error': 'Nenhum projeto escolhido.'}
        if acao == 'ler_cache':
            return {'success': True, 'dado': _ler_cache(projeto)}
        if acao == 'contar':
            dado = _contar(projeto)
            _gravar_cache(projeto, dado)
            return {'success': True, 'dado': dado}
        return {'success': False, 'error': 'ação desconhecida: %s' % acao}
    except Exception as e:
        traceback.print_exc()     # o traceback inteiro só aparece no terminal
        return {'success': False, 'error': '%s: %s' % (type(e).__name__, e)}
```

### `frontend/index.js`

```js
// Plugin "Contador de Extensões" — script clássico, sem import/export.
// Ponto de entrada: window.montarPlugin.
(function () {
  'use strict';

  // O caminho deste plugin sai do PRÓPRIO script, nunca escrito à mão: o
  // usuário pode mover a pasta para dentro de uma categoria a qualquer hora.
  const CAMINHO_PLUGIN = document.currentScript
    ? decodeURIComponent(document.currentScript.src
        .replace(/^.*\/External\/plugins\//, '')
        .replace(/\/frontend\/index\.js(?:\?.*)?$/, ''))
    : 'Contador de Extensões';

  const ESTADO = Symbol('contadorDeExtensoesEstado');

  const CSS = `
    .cext-raiz { padding: 12px; color: var(--text); }
    .cext-topo { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
    .cext-nota { color: var(--text-muted); font-size: 12px; }
    .cext-tabela { width: 100%; border-collapse: collapse; }
    .cext-tabela th, .cext-tabela td {
      text-align: left; padding: 6px 8px;
      border-bottom: 1px solid rgba(var(--white-rgb), 0.08);
    }
    .cext-tabela tbody tr:hover { background: var(--surface-hover); }
    .cext-num { text-align: right; font-variant-numeric: tabular-nums; }
  `;

  function injetarEstilo() {
    if (document.getElementById('cext-estilo')) return;   // guarda por id
    const s = document.createElement('style');
    s.id = 'cext-estilo';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  async function pedir(acao, projeto) {
    try {
      return await window.pywebview.api.chamar_plugin(
        CAMINHO_PLUGIN, { acao: acao, projeto: projeto });
    } catch (e) {
      console.error('[contador de extensões] a ponte quebrou:',
                    e && e.message, '\n', e && e.stack);
      return { success: false, error: String((e && e.message) || e) };
    }
  }

  function pintar(raiz, dado) {
    if (!dado) {
      raiz.innerHTML = '<p class="plugins-vazio">Ainda não contei este '
        + 'projeto. Clique em "Contar agora".</p>';
      return;
    }
    const linhas = Object.entries(dado.por_extensao)
      .sort((a, b) => b[1] - a[1])
      .map(([ext, n]) => '<tr><td>' + escapeHtml(ext)
           + '</td><td class="cext-num">' + n + '</td></tr>')
      .join('');
    raiz.innerHTML =
      '<p class="cext-nota">' + dado.total + ' arquivos no escopo · contado em '
      + escapeHtml(dado.atualizado_em) + '</p>'
      + '<table class="cext-tabela"><thead><tr><th>Extensão</th>'
      + '<th class="cext-num">Arquivos</th></tr></thead><tbody>'
      + linhas + '</tbody></table>';
  }

  window.montarPlugin = function (container, contexto) {
    // 1. Desfaz uma montagem anterior neste mesmo container, se houver.
    if (container[ESTADO] && typeof container[ESTADO].destroy === 'function') {
      container[ESTADO].destroy();
    }
    while (container.firstChild) container.removeChild(container.firstChild);

    injetarEstilo();

    let montada = true;
    let pedidoAtual = 0;
    const desligar = [];
    container[ESTADO] = {
      destroy() {
        montada = false;
        desligar.forEach(fn => { try { fn(); } catch (e) {} });
        desligar.length = 0;
      },
    };

    const casca = document.createElement('div');
    casca.className = 'cext-raiz';
    casca.innerHTML =
      '<div class="cext-topo">'
      + '<select class="cext-projeto hidden"></select>'
      + '<button class="btn btn-primary cext-contar">Contar agora</button>'
      + '</div><div class="cext-corpo"></div>';
    container.appendChild(casca);

    const corpo = casca.querySelector('.cext-corpo');
    const combo = casca.querySelector('.cext-projeto');
    const botao = casca.querySelector('.cext-contar');

    let projeto = (contexto && contexto.projeto) || null;

    async function carregar(acao) {
      const meu = ++pedidoAtual;
      corpo.innerHTML = '<p class="plugins-vazio">Carregando…</p>';
      const r = await pedir(acao, projeto);
      if (!montada || meu !== pedidoAtual) return;   // painel morreu, ou
                                                     // chegou algo mais novo
      if (!r.success) {
        corpo.innerHTML = '<p class="plugins-vazio">'
          + escapeHtml(r.error || 'não deu certo') + '</p>';
        return;
      }
      pintar(corpo, r.dado);
    }

    const aoClicar = () => {
      carregar('contar');
      if (typeof showToast === 'function') showToast('Contando…');
    };
    botao.addEventListener('click', aoClicar);
    desligar.push(() => botao.removeEventListener('click', aoClicar));

    (async () => {
      if (!projeto) {
        // "Tela principal": o plugin desenha o próprio seletor.
        let projetos = [];
        try { projetos = await window.pywebview.api.list_projects(); }
        catch (e) { projetos = []; }
        if (!montada) return;
        if (!projetos.length) {
          corpo.innerHTML = '<p class="plugins-vazio">Nenhum projeto '
            + 'cadastrado ainda.</p>';
          return;
        }
        combo.classList.remove('hidden');
        combo.innerHTML = projetos.map(
          p => '<option>' + escapeHtml(p) + '</option>').join('');
        projeto = projetos[0];
        const aoTrocar = () => { projeto = combo.value; carregar('ler_cache'); };
        combo.addEventListener('change', aoTrocar);
        desligar.push(() => combo.removeEventListener('change', aoTrocar));
      }
      carregar('ler_cache');
    })();
  };
})();
```

O que este exemplo exercita, e por que cada peça está aí:

| Peça | Regra que ela cumpre |
|---|---|
| `CAMINHO_PLUGIN` derivado | sobrevive a ser movido para uma categoria |
| `Symbol` + `destroy` | a limpeza que ninguém pede ([parte 8](#8--ciclo-de-vida-nada-avisa-que-você-morreu)) |
| `montada` + `pedidoAtual` | as duas guardas depois do `await` |
| `injetarEstilo` com guarda por id, prefixo `cext-` | o `<style>` global que nunca sai |
| `var(--text)`, `rgba(var(--white-rgb), …)` | cinco temas, zero hexadecimal |
| `escapeHtml` antes de todo `innerHTML` | texto do disco nunca vira HTML |
| `.plugins-vazio`, `.btn`, `.hidden` | classes do programa em vez das suas |
| despacho por `acao`, `traceback.print_exc()` | o contrato do backend |
| `_pasta_do_plugin` e `_raiz_do_app` | nenhum caminho fixo, nenhum `..` contado |
| `.tmp` + `os.replace` | leitura segura durante a escrita |
| `versao` no cache | formato novo não lê cache velho |

---

## 15 · O ciclo de trabalho (editar e ver)

| O que você mudou | O que fazer |
|---|---|
| criou ou apagou uma **pasta** de plugin | **clicar na categoria Plugins** em Configurações: ela relê a pasta |
| `plugin.json` | idem |
| `backend/plugin.py` (ou um irmão dele) | **nada** — ele é reimportado na próxima chamada. Basta clicar de novo no seu plugin |
| `frontend/{prefixo}-*.js` (os irmãos que você injeta) | sair da sub-aba e voltar, ou trocar de pasta no Trilho — o `?t=` traz o arquivo novo |
| **`frontend/index.js`** | ⚠️ **reiniciar o programa.** Este é o único que o programa injeta **sem** cache-busting |
| `plugin_boot.py` | **reiniciar o programa** — `iniciar()` só roda no boot |
| ligar/desligar, marcar os locais | nada; vale na hora |
| a ordem arrastada | clicar em **Salvar plugins** |

⚠️ **A regra de ouro do `index.js`**: deixe-o pequeno e estável (a casca que
define `montarPlugin` e injeta os irmãos), e ponha tudo o que você vai editar
com frequência nos irmãos. Assim você quase nunca precisa reiniciar.

### Onde os erros aparecem

- **Frontend:** o console do DevTools. As mensagens da camada de plugins
  começam com `[plugins]`.
- **Backend:** o terminal de onde o programa foi lançado (`print`,
  `traceback.print_exc()`). É o **único** lugar onde o traceback de um plugin
  aparece inteiro.
- **Boot:** o mesmo terminal, com `[plugins] falha ao carregar plugin_boot.py`
  ou `[plugins] "…" falhou em iniciar()`.

### Como ver o console

O programa roda em WebView2. Lance-o com a porta de depuração aberta e abra o
endereço no Edge:

```
WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333
```

---

## 16 · Quando não funciona: sintoma → causa

| Sintoma | Causa quase certa |
|---|---|
| **A pasta não aparece na lista** | falta `frontend/index.js` **e** `backend/plugin.py` — ela virou categoria. Ou você não clicou na categoria Plugins para reler |
| **Aparece na lista, mas não tem aba** | o plugin está desligado, ou nenhum dos dois checkboxes de local está marcado |
| **A aba Plugins sumiu inteira** | nenhum plugin está marcado para aquele local |
| **"O plugin … não define `montarPlugin`"** | o `index.js` não definiu `window.montarPlugin`, ou definiu **depois** de um `await`. Tem de ser síncrono |
| **"Não foi possível carregar o plugin …"** | o `<script>` não carregou: erro de sintaxe no `index.js`, ou o arquivo não existe. O console diz qual |
| **A tela fica em "Carregando…" para sempre** | nome de método errado em `window.pywebview.api` — **não dá erro, trava** (ver `A API do programa.md`) |
| **Editei o `index.js` e nada mudou** | é o único arquivo sem cache-busting: **reinicie o programa** |
| **Editei um irmão do frontend e nada mudou** | faltou o `?t=` na injeção, ou você não removeu o `<script>` antigo |
| **Editei o `plugin_boot.py` e nada mudou** | `iniciar()` só roda no boot: reinicie |
| **`Erro dentro do plugin: …`** | a sua exceção subiu do `executar()`. O traceback está no **terminal**, não no console |
| **`backend/plugin.py não define executar().`** | a função tem outro nome, ou está dentro de uma classe |
| **`ação desconhecida: None`** | você esqueceu de mandar `acao` no payload |
| **`Plugin sem backend/plugin.py.`** | o arquivo não existe, ou está em outro lugar que não `backend/` |
| **`attempted relative import with no known parent package`** | você usou `from . import irmao` no backend. Plugin não é pacote — carregue por caminho |
| **`No module named 'meu_irmao'`** | idem |
| **O cache do meu backend some entre dois cliques** | o módulo é reimportado a cada chamada; global de módulo não sobrevive. Cache é arquivo |
| **Meu arquivo foi parar dentro da pasta do programa** | caminho relativo no `open()`. O diretório de trabalho é `Program/Code/backend` |
| **`FileNotFoundError` ao gravar em `files/`** | a pasta não existe. `os.makedirs(..., exist_ok=True)` antes |
| **Meu plugin automático não coleta nada** | está desligado, ou `iniciar()` estourou. **Olhe o terminal** — não há aviso na tela |
| **Desliguei o plugin e o laço continuou rodando** | é o esperado: não existe `parar()`. O laço precisa reler `plugins.json` a cada volta |
| **O programa demorou a abrir depois que instalei meu plugin** | `iniciar()` fez trabalho em vez de agendar e devolver |
| **O programa não fecha** | a sua `Thread`/`Timer` não é `daemon` |
| **Voltei para a sub-aba e o plugin não recarregou** | é o esperado: o painel guarda que já montou. Só remonta se o projeto mudar |
| **Troquei de pasta no Trilho e meu plugin perdeu o estado** | o DOM daquela metade é refeito. Guarde o que precisa sobreviver em `config/` |
| **Meu `setInterval` continua rodando depois que fechei o plugin** | faltou o `destroy` no `container` e a checagem de `container.isConnected` |
| **Religuei e apareceu duas vezes** | você criou algo no `montarPlugin` sem checar se já existia (o `<style>`, um listener em `window`) |
| **A tela do programa ficou toda com a minha cor** | seletor de CSS sem prefixo. Não há isolamento |
| **Uma tela do programa parou de funcionar** | você reusou um nome global. Prefixe tudo em `window.__seuplugin` |
| **Minha cor fica errada em alguns temas** | hexadecimal em vez de `var(--…)`, ou um token que não existe (o `var()` cai calado no fallback) |
| **O plugin voltou desligado do nada** | você o moveu para dentro de uma categoria: a chave em `plugins.json` mudou |
| **O `contexto.projeto` veio `null`** | o plugin está na sub-aba "Tela principal". Desenhe o seletor |
| **`payload['grafo_imports']` não chegou** | aquele projeto nunca rodou o Grafo de Imports — a chave fica **ausente**, não `None` |
| **Meu plugin lê a raiz inteira do projeto** | você usou `pasta_projeto` em vez de `working_folders` ([parte 12](#12--escopo-de-projeto)) |

---

## 17 · Antes de dar por pronto

**A promessa da pasta própria:**

- [ ] Todo `open()` usa caminho montado a partir de `__file__` — nenhum caminho
      absoluto, nenhum relativo solto.
- [ ] Nenhum `..` contado à mão para achar a raiz do app.
- [ ] Toda gravação chama `os.makedirs(..., exist_ok=True)` antes.
- [ ] O que o usuário escolhe está em `config/`; o que o plugin gera, em
      `files/`.
- [ ] Gravação de arquivo é `.tmp` + `os.replace()`.
- [ ] Apagar a pasta do plugin não deixa rastro em lugar nenhum.
- [ ] Copiar a pasta para outro computador leva tudo — nenhuma dependência em
      `External/libraries/`.

**A promessa de só ler:**

- [ ] Nenhuma chamada de `window.pywebview.api` fora dos prefixos de leitura
      (`list_`, `load_`, `get_`, `obter_`), com as exceções conferidas em
      `A API do programa.md`.
- [ ] Nenhum arquivo do programa ou do projeto é escrito, editado ou apagado.
- [ ] Nenhuma escrita dentro da pasta de outro plugin.
- [ ] Nenhum `chamar_plugin` para outro plugin; nenhum import do backend de
      outro plugin.
- [ ] Nenhum `from modulos... import` do backend do programa.

**O frontend:**

- [ ] `window.montarPlugin` é definido **sincronamente**, no `onload`.
- [ ] Montar duas vezes seguidas no mesmo container **não** duplica `<style>`,
      listener nem elemento.
- [ ] Todo `setInterval`/`ResizeObserver`/listener de `window` está na lista de
      `destroy`, e o intervalo confere `container.isConnected`.
- [ ] Toda continuação depois de um `await` confere a flag `montada` **e** o
      contador de pedido.
- [ ] O `contexto.projeto` `null` está tratado.
- [ ] Nenhum seletor de CSS seu casa com algo do programa (tudo prefixado).
- [ ] Nenhum nome global seu existia antes — confira com
      `grep -rn "seuNome" Program/Code/frontend`.
- [ ] Nenhuma cor em hexadecimal; tudo em `var(--…)`, e os nomes de token
      existem mesmo.
- [ ] Todo texto vindo do disco ou do usuário passa por `escapeHtml` antes do
      `innerHTML`.
- [ ] Nenhum `alert`, `confirm` ou `prompt` — use `showToast` e
      `abrirModalPadrao`.
- [ ] Nenhum arquivo passa de 500 linhas.

**O backend:**

- [ ] `executar(payload)` existe, é função de módulo, e despacha por `acao`.
- [ ] Nenhuma exceção sobe: tudo vira `{'success': False, 'error': …}`, com
      `traceback.print_exc()` antes.
- [ ] Nenhum estado importante mora em global de módulo (ele zera a cada
      chamada).
- [ ] Nenhum `from . import` nem `import irmao` — irmãos por
      `spec_from_file_location`, com prefixo próprio no nome sintético.
- [ ] Todo retorno é serializável em JSON.
- [ ] O escopo do projeto sai de `working_folders`, com `ignore_list` e
      `context_items` aplicados — **não** de `pasta_projeto`.

**Se for automático:**

- [ ] `plugin_boot.py` está na **raiz**, e define `iniciar()`.
- [ ] `iniciar()` **devolve na hora** — agenda e sai.
- [ ] Toda thread/timer é `daemon = True`.
- [ ] O laço se reagenda **sempre**, num `finally`, e relê `plugins.json` a cada
      volta para saber se ainda está ligado.
- [ ] O trabalho de cada volta está dentro de um `try`.

**O acabamento:**

- [ ] `plugin.json` existe, sem erro na lista, e o `tipo` é um dos três termos.
- [ ] O nome da pasta é o nome que deve aparecer na tela.
- [ ] Ligar → desligar → ligar três vezes seguidas não deixa nada duplicado nem
      nada rodando.
- [ ] Mover a pasta para dentro de uma categoria não quebra nada (só zera o
      interruptor, o que é esperado).

---

## O gabarito — os oito que vêm com o programa

Não são exemplos didáticos: são os plugins de verdade, e servem de referência
justamente por isso.

| Plugin | Tipo | O que ele mostra |
|---|---|---|
| `Plugin base` | `automático` | o **único** com `plugin_boot.py`: laço auto-reagendável que relê o próprio `ligado`, gravação atômica com retry, dado por projeto separado por custo de leitura, e um contrato público documentado |
| `Universais/Contraste de Tela` | `isolado` | backend de **três linhas**; toda a análise é frontend puro. É o gabarito do `Symbol` no container com `destroy` idempotente, e de CSS próprio grande sem vazar |
| `Universais/Complexidade do código` | `manual` | o fluxo **cache-first**: abrir só lê `files/{projeto}.json`; calcular é botão explícito. O padrão que os vizinhos copiaram |
| `Universais/Linha do tempo` | `manual` | **leitura cruzada** do `files/` do Plugin base, direto do disco; backend deliberadamente monolítico (porque ele é reimportado a cada chamada); e a guarda de corrida com **dois** contadores |
| `Universais/Animação do código` | `manual` | frontend dividido em irmãos com `?t=`; uso pesado do `d3` global (força, sunburst, treemap, zoom) |
| `Universais/Cenas do código` | `manual` | **sub-unidades plugáveis**: cada animação é uma pasta em `frontend/animacoes/`, descoberta por `os.listdir` e autorregistrada pelo `currentScript.src` |
| `Universais/Panorama de projetos` | `manual` | funde vários projetos numa varredura só, com cache chaveado pela seleção — e **duplica** de propósito o código do vizinho, com o motivo escrito, porque plugin não importa código de plugin |
| `Universais/Relatório do Projeto` | `manual` | backend fatiado em nove módulos com `_irmao()`; bibliotecas **vendorizadas** em `frontend/lib/`; e a exceção do arquivo exportado, com as quatro condições verificadas |

## Onde mais olhar

| Arquivo | O que tem |
|---|---|
| `A API do programa.md` | os métodos de `window.pywebview.api`, um a um — **leitura obrigatória** |
| `Como usar o Plugin base.md` | o dado que o Plugin base publica, campo a campo — só se você precisar dele |
| `../Extensões/Como criar extensões.md` | o irmão deste, para quando um plugin não basta |
| `Saída das skills/Arquitetura modular/Exceções.md` | por que `files/` e `config/` ficam junto do código, e as exceções já concedidas a plugin |
| `Saída das skills/Arquitetura modular/Convenções.md` | frontend em vários arquivos, sub-unidades plugáveis, dado por projeto |
| `Saída das skills/Padrões de interface/` | os componentes e as convenções visuais do programa |
| `Saída das skills/Terminologia e nomenclatura/Vocabulário.md` | os nomes já decididos — não invente sinônimo |
