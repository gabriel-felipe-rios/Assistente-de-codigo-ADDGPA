# Como criar extensões

> **Este arquivo é o contrato.** Não há sandbox, não há proxy de API, não há
> lista de permissões — uma extensão pode fazer tudo o que o programa pode. A
> contenção é esta página, e a razão é simples: quem escreve as extensões é o
> próprio dono do programa. Uma cerca técnica limitaria ele sem proteger
> ninguém.
>
> O preço disso é que **as regras daqui não são conselho**. Não há nada
> impedindo você de quebrá-las; o que acontece quando você quebra é que o
> programa fica estranho de um jeito difícil de diagnosticar meses depois.

## As duas promessas que sustentam tudo

Se você levar só duas coisas desta página, que sejam estas:

> ### 1 · Ligar e desligar, a hora que quiser, sem estrago
>
> Uma extensão liga e desliga **na hora**, sem reiniciar o programa, quantas
> vezes você quiser, em qualquer ordem, com o programa no meio de qualquer
> coisa. Desligar devolve o programa exatamente ao que ele era. **E não apaga
> nada.** Ver a [parte 2](#2--ligar-e-desligar-a-hora-que-quiser).

> ### 2 · Tudo o que a extensão cria fica dentro da pasta dela
>
> Configuração em `config/`, arquivos gerados em `files/`, os dois **dentro de
> `Program/External/extensions/{a sua extensão}/`**. Uma extensão é uma pasta
> inteira, removível com um delete só. Ver a [parte 3](#3--onde-a-extensão-escreve-dentro-da-própria-pasta).

---

## Sumário

| Parte | O que tem |
|---|---|
| [1 · O que é uma extensão](#1--o-que-é-uma-extensão-aqui) | e quando escrever plugin em vez disto |
| [2 · Ligar e desligar](#2--ligar-e-desligar-a-hora-que-quiser) | a promessa, o que o programa garante, o que você garante |
| [3 · Onde a extensão escreve](#3--onde-a-extensão-escreve-dentro-da-própria-pasta) | `config/`, `files/`, e a armadilha do caminho relativo |
| [4 · Pode, declara, não faz](#4--o-que-ela-pode-o-que-ela-declara-o-que-ela-não-faz) | as três listas do contrato |
| [5 · Os 4 tipos e os 12 recursos](#5--os-4-tipos-e-os-12-recursos) | a categoria da extensão, e as peças que ela usa |
| [6 · A estrutura em disco](#6--a-estrutura-em-disco) | pasta a pasta, arquivo a arquivo |
| [7 · O manifesto](#7--o-manifesto-extensaojson) | campo a campo, as regras contra conflito, e o manifesto antigo |
| [8 · A comunicação](#8--a-comunicação-quem-fala-com-quem) | o mapa: quatro conversas legítimas, três proibidas |
| [9 · O frontend](#9--o-frontend) | a casca, os dois pontos de entrada, CSS, vários arquivos |
| [10 · O backend](#10--o-backend) | a porta, os irmãos, o estado, os erros |
| [11 · A ponte](#11--a-ponte-chamar_extensao) | frontend ↔ backend da extensão |
| [12 · A extensão que roda sozinha](#12--extensao_bootpy--a-extensão-que-roda-sozinha) | `iniciar()` e `parar()` |
| [13 · A página da extensão](#13--a-página-da-extensão-em-configurações--extensões--e-o-configtelajson) | o que o programa desenha sozinho a partir do manifesto, e as opções do `tela.json` |
| [14 · As extensões que são só conteúdo](#14--as-extensões-que-são-só-conteúdo-recursos-do-editor--cor-e-visual--ícones) | gramáticas, ícones, agentes, subagentes — e a ferramenta e o trecho de prompt que um subagente usa |
| [15 · Os encaixes](#15--os-encaixes--painel-comando-e-marca-no-código) | entrar num lugar que já existe: painel, menu, botão |
| [16 · Os eventos](#16--os-eventos--a-reação) | o programa avisa; você reage — ou **barra** |
| [17 · As consultas](#17--as-consultas--recursos-do-editor--sugestões) | o programa pergunta; você responde — o autocomplete |
| [18 · O que o programa te empresta](#18--o-que-o-programa-te-empresta) | funções, classes de CSS, tokens de cor |
| [19 · Consultar outro plugin](#19--consultar-dados-de-outro-plugin-ou-de-outra-extensão) | pelo disco, nunca pelo backend dele |
| [20 · Exemplo completo](#20--exemplo-completo-de-ponta-a-ponta) | uma extensão de verdade, arquivo por arquivo |
| [21 · O ciclo de trabalho](#21--o-ciclo-de-trabalho-editar-e-ver) | como testar sem reiniciar |
| [22 · Sintomas e causas](#22--quando-não-funciona-sintoma--causa) | a tabela para quando não funciona |
| [23 · Antes de dar por pronta](#23--antes-de-dar-por-pronta) | a lista de conferência |

---

## 1 · O que é uma extensão, aqui

Uma extensão **muda o comportamento do programa**. É o que a distingue do
plugin, e é por isso que o contrato dela é outro.

| | Plugin | Extensão do programa | Extensão de arquivo |
|---|---|---|---|
| Onde mora | `Program/External/plugins/` | `Program/External/extensions/` | não é pasta — é `.py`, `.js` |
| O que faz | **lê** o programa e desenha numa aba própria | **muda** o programa: encaixa, reage, responde, entrega dado | é a terminação do nome de um arquivo |
| Onde se liga | Configurações › Plugins | Configurações › **Programa › Extensões** | Configurações › Extensões e pastas ignoradas |
| Reconhecida por | `frontend/index.js` ou `backend/plugin.py` | **`extensao.json` na raiz** | — |
| Backend entre chamadas | reimportado a cada chamada, globais zeradas | **importado uma vez** ao ligar, e fica de pé | — |
| Backend em vários arquivos | **impossível** — tudo num arquivo só | sim, com `from . import irmao` | — |
| Desligar | some da aba | **desfaz o que ela fez**, sem reiniciar | — |

⚠️ Os dois últimos nomes se repetem de propósito. "Extensões e pastas
ignoradas" é sobre `.py` e `.js`; "Extensões" é sobre isto aqui. O contexto
separa.

### Quando escrever plugin, e quando escrever extensão

O teste é uma pergunta só: **você precisa mudar alguma coisa que já existe no
programa?**

- **Não** — você quer uma tela própria que lê o projeto e mostra alguma coisa
  (um relatório, um gráfico, uma linha do tempo). → **Plugin.** É mais simples,
  tem menos contrato, não precisa de manifesto, e o guia dele é
  `../Plugins/Como criar plugins.md`.
- **Sim** — você quer um item no menu de contexto do Editor, uma categoria em
  Configurações, um tema, reagir a um salvamento, decorar uma linha de código.
  → **Extensão.**

---

## 2 · Ligar e desligar, a hora que quiser

> **Esta é a promessa central do recurso.** Uma extensão liga e desliga **na
> hora**, sem reiniciar o programa, quantas vezes você quiser, em qualquer
> ordem, com o programa no meio de qualquer coisa. Desligar devolve o programa
> exatamente ao que ele era.

Você pode, sem medo:

- ligar e desligar **no meio de uma rotina rodando** — a extensão não está no
  caminho de nada do programa;
- ligar e desligar **vinte vezes seguidas** — nada acumula: nem estilo, nem
  script, nem categoria, nem thread;
- **desligar uma extensão quebrada** — uma extensão que explodiu ao ligar
  desliga do mesmo jeito;
- **desligar e voltar amanhã** — nada foi apagado; ela volta com tudo o que
  tinha.

### O que acontece quando você LIGA

1. o programa grava `{ligado: true}` — **antes** de qualquer carga, para que um
   erro na extensão não desfaça o seu clique;
2. importa `backend/extensao.py` e **guarda o módulo**;
3. dispara `iniciar()` **numa thread**, se houver `extensao_boot.py`;
4. registra a **página** dela do lado Extensões de Configurações (parte 13)
   — toda extensão ligada tem uma — e põe as opções do `config/tela.json` em
   memória, para `xtPreferenciasDe` já responder no passo seguinte;
5. injeta `frontend/index.js` com `?t=`, espera `window.xtMontar_{slug}`
   existir, e a chama;
6. injeta os arquivos de encaixe, evento e consulta — e, se ela declara o
   ponto `acesso-rapido.comandos`, põe os comandos dela **no registro de
   teclas na hora**: a tecla sugerida já dispara, sem ninguém abrir a barra.

### O que acontece quando você DESLIGA

O inverso, na ordem inversa — a tela primeiro, o Python depois:

1. **tira os encaixes, as assinaturas de evento e as consultas dela dos
   registros** — e desembrulha as marcas do decorador. Primeiro, e não
   depois do `xtDesmontar`: a partir daqui o programa para de CHAMAR a
   extensão, e só então ela começa a se desfazer. Na ordem inversa, uma
   pintura do Editor ou um Ctrl+S no instante do desligar chamavam o arquivo
   de encaixe com as globais da casca já apagadas;
2. chama `window.xtDesmontar_{slug}`, se existir;
3. remove todo `<style>`, `<link>` e `<script>` com `data-xt="{slug}"`;
4. remove o `<script id="xt-script-{slug}">`;
5. apaga `window.xtMontar_{slug}` e `window.xtDesmontar_{slug}`;
6. tira a categoria dela do lado Extensões de Configurações;
7. chama `parar()` do boot e espera até 5 segundos;
8. larga o módulo do backend e esquece o pacote inteiro em `sys.modules`.

⚠️ **Fechar o programa também é desligar.** O `parar()` de toda extensão
ligada roda no fechamento da janela, com um orçamento único de 5 s para o
conjunto. Uma extensão que abre socket ou grava arquivo em segundo plano
recebe o aviso e tem esse tempo para fechar limpo.

⚠️ **E o programa reconcilia sozinho.** A cada listagem da categoria
Extensões, o que está carregado no Python e deixou de estar ligado — um
manifesto que você quebrou com o programa aberto, uma pasta que você moveu
para dentro de uma categoria — é descarregado, com o aviso na tela.

### ⚠️ E NÃO APAGA NADA

Nem a pasta, nem `files/`, nem `config/`, nem `preferencias.json`.

Isso é decisão de projeto, não descuido: **quem desliga para testar não pode
perder o que a extensão gerou.** Se desligar apagasse os dados, ninguém
desligaria nada — e a promessa de "liga e desliga à vontade" morreria na
primeira vez que alguém perdesse um mês de captura.

Apagar é você apagando a pasta à mão. **Não existe "desinstalar" no programa**,
e não existe no sistema de Plugins também.

O mesmo vale para **Restaurar padrão** da categoria Extensões: ele desliga
todas e apaga o destaque — o **estado**. O que as extensões produziram continua
onde está.

### A sua parte da promessa

O programa desfaz o que ele criou. O que **você** criou é seu para desfazer,
dentro de `window.xtDesmontar_{slug}`:

| O que você criou | Como desfazer |
|---|---|
| um global no `window` | `delete window.meuGlobal` |
| `addEventListener` no `document` ou no `window` | guarde a referência da função e chame `removeEventListener` com ela — uma função anônima é **impossível** de remover |
| `setInterval` / `setTimeout` que se reagenda | guarde o id e `clearInterval(id)` |
| `MutationObserver`, `ResizeObserver` | `.disconnect()` |
| categoria de Configurações que **você** registrou | `desregistrarCategoriaConfig(chave)` — as duas ficam no lado Extensões, mas a do `config/tela.json` é do programa e esta é sua |
| elemento que você pendurou numa tela do programa | guarde a referência e `.remove()` |
| **a continuação de um `await`** | uma flag `montada`, `true` no `xtMontar` e `false` no `xtDesmontar`, conferida logo depois de CADA `await`. O usuário pode desligar você enquanto a ponte responde; sem a flag, a linha seguinte recria a global que o `xtDesmontar` acabou de apagar, ou pendura no `<body>` um elemento depois de o programa já ter varrido a tela. Ver a regra *Depois de um `await`, confira se ainda está montada* |
| um arquivo de encaixe, evento ou consulta que chama uma global da casca | `if (typeof window.pfxFuncao !== 'function') return [];` na primeira linha. O programa tira você dos registros antes do `xtDesmontar`, mas um aviso ou uma pintura em voo ainda pode chegar |
| um `<script>` irmão que você injetou | `document.getElementById('meupfx-irmao').remove()` — o programa só remove o `index.js` |
| no backend, o que a sua `iniciar()` começou | pare no `parar()` |

⚠️ **O `<style>` só é removido se tiver `data-xt="{slug}"`.** É por esse
atributo, e só por ele, que o programa acha o que remover. Um `<style>` sem ele
fica no `<head>` até o programa fechar — e as regras dele continuam valendo com
a extensão desligada. O sintoma é o pior possível: *"eu desliguei aquela
extensão e a tela continua estranha"*.

### Uma extensão quebrada não derruba as outras

Cada passo de ligar e de desligar fica dentro do próprio `try/except`, com o
nome da extensão na mensagem. A sua explodir não impede a lista de pintar, não
impede a próxima de ligar, e não impede o programa de abrir. O erro vai para o
console — e é lá que você o encontra, nunca numa tela travada.

---

## 3 · Onde a extensão escreve: dentro da própria pasta

> **Tudo o que a extensão cria fica dentro da pasta dela**, em
> `Program/External/extensions/{Categoria opcional}/{A sua extensão}/`.

```
Program/External/extensions/Minha extensão/
├── config/        ← o que o USUÁRIO escolheu
└── files/         ← o que a EXTENSÃO gerou
```

### As duas pastas, e por que trocá-las é o erro clássico

| | `config/` | `files/` |
|---|---|---|
| Quem escreve | o **usuário**, pela tela de Configurações (na prática, o **programa**, por ele) | a **extensão** |
| O que é | o que ele **escolheu** | o que ela **produziu** |
| Quem lê | você, para saber como se comportar | você, e quem quiser (é dado público no disco) |
| Restaurar padrão | volta aos `padrao` do `tela.json` | **nunca é tocado** |
| Apagar à mão | a extensão volta ao padrão | a extensão perde o histórico |

Se você guardar o histórico de captura em `config/`, o "Restaurar padrão" do
usuário vai apagá-lo. Se você guardar a preferência dele em `files/`, ela não
aparece na tela de configuração e não volta ao padrão nunca.

### Como `files/` se organiza

Uma pasta por projeto, e dentro dela a separação **por custo de leitura** — é o
formato que o Plugin base já usa. Copie-o, não invente outro:

```
files/
└── {nome-do-projeto}/
    ├── atual.json            o retrato de AGORA. Leve, lido sempre
    ├── volume.json           o que é grande. Lido só ao abrir a tela
    └── dias/
        └── 2026-09-04.json   histórico: um por unidade, NUNCA reescrito
```

O `dias/` é acréscimo puro: um arquivo por dia, escrito uma vez. Nunca reescrever
o histórico é o que faz uma falha no meio da gravação custar um dia, e não tudo.

### ⚠️ A armadilha do caminho relativo

**O diretório de trabalho do processo NÃO é a pasta da sua extensão.** É
`Program/Code/backend`, de onde o programa foi lançado. Isto:

```python
open('files/atual.json', 'w')      # ⛔ ERRADO
```

…grava dentro da pasta do **programa**, não da sua. E não dá erro nenhum — o
arquivo aparece num lugar que ninguém procura, e some do backup da extensão.

O certo é sempre a partir de `__file__`:

```python
# backend/meupfx_caminhos.py — só monta caminho, NUNCA lê nem escreve.
import os

# `backend/` → a raiz da extensão. Este é o único caminho que você escreve
# à mão, e é relativo a ESTE arquivo, não ao processo.
MINHA_PASTA = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

PASTA_FILES = os.path.join(MINHA_PASTA, 'files')
PASTA_CONFIG = os.path.join(MINHA_PASTA, 'config')


def arquivo_do_projeto(projeto, *partes):
    """`files/{projeto}/...` — e cria a pasta se não existir."""
    pasta = os.path.join(PASTA_FILES, projeto)
    os.makedirs(pasta, exist_ok=True)
    return os.path.join(pasta, *partes)
```

⚠️ **`os.makedirs(..., exist_ok=True)` sempre.** A pasta `files/` não existe
numa extensão recém-copiada, e um `open(..., 'w')` numa pasta que não existe
estoura com `FileNotFoundError` — mensagem que não diz nada sobre a pasta
faltando.

### E se ela precisar escrever fora?

Pode. Mas **declara**, em `escreve_fora`, no manifesto:

```json
{ "nome": "Formatador", "prefixo": "fmt", "tipos": ["3"], "acrescenta": [ … ],
  "escreve_fora": ["a pasta de código do projeto aberto (arquivos .py, ao salvar)"] }
```

Configurações mostra essa lista, em âmbar, na linha da extensão. Não declarar
**não é bloqueado** — é mentir para o dono do programa, que é a única pessoa que
tem como saber o que a extensão faz.

### E se ela precisar LER fora da pasta de trabalho?

O programa base só lê a **pasta de trabalho** do projeto — as pastas que o
usuário marcou na aba Trabalho. A raiz do projeto, e o que mora nela fora
dessas pastas (a `Saída das skills/`, por exemplo), o programa não abre: só o
Editor. Uma extensão pode ler — ela chega à raiz por `payload['pasta_projeto']`
(parte 11) —, mas **declara**, em `le_fora`, no manifesto:

```json
{ "nome": "Notas do projeto", "prefixo": "nts", "tipos": ["4"], "acrescenta": [ … ],
  "le_fora": ["Notas/, na pasta raiz do projeto aberto — só leitura"] }
```

A página da extensão mostra essa lista na linha **«Lê fora da pasta de
trabalho»**, em âmbar, e a linha dela em Programa › Extensões também. Como no
`escreve_fora`: não declarar não é bloqueado — é esconder do dono do programa
o que só ele tem como saber. E é por ela que se desliga o que lê fora: o
programa base, sem extensão nenhuma, continua preso à pasta de trabalho.

### E o frontend, escreve?

**Não escreve arquivo.** O frontend da extensão não tem acesso ao disco; quem
grava é sempre o backend dela, pela ponte. Para guardar coisa pequena e de tela
(qual aba estava aberta, uma largura de painel), use `localStorage` com uma
chave prefixada:

```js
localStorage.setItem('meupfx:aba', 'resumo');    // ⚠️ sempre com o prefixo
```

---

## 4 · O que ela pode, o que ela declara, o que ela não faz

### ✅ Pode

| Pode | Detalhe |
|---|---|
| **Chamar `window.pywebview.api` inteiro** | não há lista de permissões. Os métodos estão em `../Plugins/A API do programa.md` — o documento é dos plugins, mas a ponte é a mesma |
| **Ler qualquer arquivo** que o programa consegue ler | inclusive o `files/` de outro plugin (parte 19) |
| **Escrever livremente dentro da própria pasta** | `files/` e `config/` |
| **Ter estado no backend** | o módulo fica importado enquanto ela está ligada |
| **Ter o backend em vários arquivos** | `from . import irmao` funciona (parte 10) |
| **Rodar sozinha, em segundo plano** | `extensao_boot.py` (parte 12) |
| **Criar categoria em Configurações** | tipo 2, com `registrarCategoriaConfig` |
| **Trazer tema, ícones, modelo ou preset** | tipos 23 a 26, sem código nenhum |
| **Levar biblioteca de terceiro** | cópia própria, em `{sua pasta}/frontend/lib/` |

### 📣 Declara

Todo caminho que a extensão grava **fora da própria pasta** vai em
`escreve_fora`; toda pasta que ela lê **fora da pasta de trabalho** do projeto
vai em `le_fora`. Ver a parte 3.

### ⛔ Não faz

| Não faça | O que acontece se fizer |
|---|---|
| **Importar o backend do programa** (`from modulos... import ...`) | `Program/Code/backend` **está** no `sys.path`, então funciona — e é justamente por isso que é perigoso. Os módulos internos mudam sem aviso, e a sua extensão quebra numa versão futura sem nada explicar. Use a ponte e a API |
| **Chamar outra extensão ou outro plugin por `import`** | os dois passam a ter de ser ligados juntos, e desligar um quebra o outro em silêncio |
| **Abrir arquivo por caminho relativo** | o diretório de trabalho é o do programa, não o seu (parte 3) |
| **Mexer no DOM fora do que o encaixe entregou** | a próxima mudança do programa naquela tela apaga o que você fez, sem erro nenhum |
| **Bloquear o boot** | `iniciar()` roda em thread justamente para isso; um `iniciar()` que demora não pode atrasar a abertura |
| **Usar `alert()`, `confirm()` ou `prompt()`** | travam a janela inteira. Use `showToast` e `abrirModalPadrao` (parte 18) |
| **Usar `scrollIntoView`** | mexe em TODOS os ancestrais roláveis. Role por aritmética, como `_configIrPara` em `config-busca.js` |
| **Injetar CSS sem prefixo** | não há isolamento de CSS: um seletor solto pinta o programa inteiro |
| **Escrever cor em hexadecimal** | o programa tem cinco temas, um deles claro. Use os tokens (`var(--blue)`) |
| **Carregar biblioteca de `External/libraries/`** | leve a própria cópia. Aquela pasta é do programa, e o que tem lá muda |
| **Declarar compatibilidade de versão do programa** | o programa não tem número de versão. `versao` no manifesto é só rótulo |
| **Escrever o `slug` ou o `caminho` à mão** | os dois vêm no `dataset` do `<script>`. O usuário move a pasta e o caminho muda |
| **Usar a API nativa de drag-and-drop do HTML5** | `dragstart`/`dragover` não disparam de forma confiável no WebView2. Copie o `mousedown`/`mousemove`/`mouseup` de `config-plugins.js` |
| **Pôr um interruptor de ligar/desligar na sua tela** | liga e desliga é só em Configurações › Programa › Extensões. Dois lugares para o mesmo estado é um lugar para ele ficar errado |

---

## 5 · Os 4 tipos e os 12 recursos

Duas perguntas diferentes, e o manifesto responde as duas:

- **O tipo** é a **categoria** da extensão — o que ela é capaz de fazer. É
  informação para a hora de construir, e vai em `tipos` como **número em
  texto**, de 1 a 4. Uma extensão pode ser mais de um tipo, ou de todos.
- **O recurso** é a **peça** que ela usa para isso. Cada peça que ela põe no
  programa é um item da lista `acrescenta` (parte 7), com o recurso, um `id` e
  o lugar.

### Os quatro tipos

| Nº | Tipo | O que faz | Recursos típicos |
|---|---|---|---|
| 1 | **Tela própria** | ganha uma tela só dela — aba nova, ou sub-aba numa aba que já existe | Tela · Opções |
| 2 | **Muda uma tela** | acrescenta função numa tela que já existe | Painel · Comando num menu, numa barra ou num cartão · Marca no código · Opções |
| 3 | **Muda um comportamento** | age sem tela: roda sozinha, ou reage ao que o programa faz | Em segundo plano · Reação · Comando no Acesso rápido · Opções |
| 4 | **Acrescenta conteúdo** | entrega um conteúdo que o programa usa mas não tem | Visual · Recursos do Editor · Agente · Opções |

⚠️ **O tipo continua NÚMERO no manifesto** (`"tipos": ["2", "3"]`). O nome só
aparece na tela.

### Os doze recursos

| Recurso | `recurso` no manifesto | O que é | Funciona hoje? |
|---|---|---|---|
| Tela | `tela` | aba nova, ou sub-aba numa aba que já tem sub-abas | ✅ (parte 15, "Tela") |
| Painel | `painel` | bloco ou texto curto numa tela que existe (Terminal, Editor, Chat, Fila, Quadro, Oficina) | ✅ (parte 15) |
| Comando | `comando` | ação no Acesso rápido (com tecla) e num menu, numa barra ou num cartão | ✅ (parte 15) |
| Marca no código | `marca` | marca trechos do código no Editor | ✅ `editor.decorador` (parte 15) |
| Em segundo plano | `segundo-plano` | roda sozinha enquanto ligada | ✅ `extensao_boot.py` (parte 12) |
| Reação | `reacao` | reage a um evento — antes, podendo barrar, ou depois | ✅ (parte 16) |
| Recursos do Editor | `editor` | cor do código, sugestões ao digitar, dica ao passar o mouse, formatação, trechos prontos | ✅ cor e trechos (parte 14); sugestões, dica e formatação (parte 17) |
| Visual | `visual` | ícones das listas de arquivo, e o que mais o programa passar a aceitar | ✅ ícones (parte 14) |
| Agente | `agente` | agente para a Oficina (aparece em "＋ Terminal"), ou subagente para Chat e Fila | ✅ Oficina (parte 14, "Agente da Oficina"); ✅ subagente (parte 14, "Subagente do Chat e da Fila") |
| Ferramenta | `ferramenta` | uma ferramenta que o subagente chama e o backend da extensão atende — dela, ou emprestada a um subagente do programa | ✅ (parte 14, "Ferramenta própria") |
| Trecho de prompt | `prompt` | um texto que entra num prompt do programa (o do Chat, o da Fila, um prompt fixo, o de um subagente do programa) enquanto ela está ligada | ✅ (parte 14, "Trecho de prompt") |
| Opções | `opcoes` | a página em Configurações › Extensões — toda extensão tem | ✅ (parte 13) |

"Em segundo plano" não se chama "rotina" nem "trabalho": esses nomes já são de
outras coisas do programa.

⛔ **Não existe tipo nem recurso para o que o programa já configura** — tema,
preset de modelo, preset de Acervo. A extensão serve para acrescentar o que o
programa **não** tem.

### O que dá para escrever HOJE

| Quero… | Tipo | Item de `acrescenta` |
|---|---|---|
| um conjunto de ícones de arquivo | `"4"` | `visual`, `parte: "icones"` + um `mapa.json` e os SVGs (parte 14) |
| as gramáticas de coloração do Editor | `"4"` | `editor`, `parte: "cor"` + uma pasta com os `prism-*.js` (parte 14) |
| completar nomes enquanto se digita | `"4"` | `editor`, `parte: "sugestoes"` (parte 17) |
| uma dica quando o mouse para sobre uma palavra | `"4"` | `editor`, `parte: "dica"` (parte 17) |
| formatar o arquivo quando o usuário pede | `"4"` | `editor`, `parte: "formatacao"` (parte 17) |
| trechos prontos no popup de sugestões | `"4"` | `editor`, `parte: "trechos"` + um `.json` (parte 14, "Trechos prontos") |
| um agente meu no "＋ Terminal" da Oficina | `"4"` | `agente`, `forma: "oficina"` + um `.md` (parte 14, "Agente da Oficina") |
| um subagente meu que o Chat e a Fila chamam | `"4"` | `agente`, `forma: "subagente"` + uma pasta com três `.txt` (parte 14, "Subagente do Chat e da Fila") |
| uma ferramenta minha, que o meu subagente chama | `"4"` | `ferramenta` + o `backend/extensao.py` respondendo `xt.ferramenta` (parte 14, "Ferramenta própria") |
| dar a minha ferramenta a um subagente do programa (o Verificador da Fila, por exemplo) | `"4"` | `ferramenta` com `subagentes_do_programa` (parte 14, "Ferramenta própria") |
| um texto meu no prompt do Chat, da Fila, de um prompt fixo ou de um subagente do programa | `"4"` | `prompt` com o `alvo` (parte 14, "Trecho de prompt") |
| ler uma pasta da raiz do projeto, fora da pasta de trabalho | — | `le_fora` no manifesto (parte 3) |
| algo em segundo plano, sem tela | `"3"` | `segundo-plano` + `extensao_boot.py` (parte 12) |
| uma aba só minha, ou uma sub-aba minha numa aba do programa | `"1"` | `tela`, `lugar: "aba.nova"` ou `"{aba}.subaba"` (parte 15, "Tela") |
| um painel meu na aba Terminal | `"2"` | `painel`, `lugar: "terminal.painel"` (parte 15) |
| um painel ou um texto no rodapé do Editor, no Chat, na Fila, no Quadro, na Oficina | `"2"` | `painel`, `lugar: "editor.painel"`, `"editor.rodape"`, `"chat.painel"`… (parte 15) |
| um item no menu de contexto | `"2"` | `comando`, `lugares: ["editor.menu"]` ou `["arvore.menu"]` (parte 15) |
| um botão no cartão do Quadro | `"2"` | `comando`, `lugares: ["trabalhos.quadro.cartao"]` (parte 15) |
| marcar um trecho do código no Editor | `"2"` | `marca` (parte 15) |
| um comando na barra do Acesso rápido | `"3"` | `comando`, `lugares: ["acesso-rapido.comandos"]` (parte 15) |
| reagir a um salvamento | `"3"` | `reacao`, `evento: "editor.salvou"` (parte 16) |
| reagir a um arquivo criado, renomeado ou apagado, a uma aba aberta, a uma mensagem do Chat, a uma tarefa da Fila que terminou | `"3"` | `reacao`, `evento: "arquivo.renomeado"`… (parte 16) |
| saber quando o script do ▶ Executar terminou, ou quando uma configuração mudou | `"3"` | `reacao`, `evento: "terminal.rodou"` ou `"configuracao.mudou"` — lado backend, recebidos no `ao_evento` (parte 16) |
| formatar o arquivo ao salvar | `"3"` | `reacao`, `evento: "editor.vai_salvar"`, `pode_barrar: true` (parte 16) |
| uma categoria minha em Configurações | `"1"` | `tela`, `lugar: "configuracoes.subaba"` (parte 15, "Tela") — `registrarCategoriaConfig` no `xtMontar` (parte 9) continua funcionando |

---

## 6 · A estrutura em disco

```
Program/External/extensions/{Categoria opcional}/{Nome da extensão}/
│
├── extensao.json          ← o manifesto. É ELE que faz a pasta ser extensão
│
├── frontend/
│   ├── index.js           ← a casca: define window.xtMontar_{slug} de forma
│   │                        SÍNCRONA, injeta os irmãos com ?t=, e o trabalho
│   │                        demorado vai num _montar() assíncrono
│   ├── {pfx}-estado.js    ← o objeto em memória. Sem DOM, sem fetch
│   ├── {pfx}-api.js       ← TODA conversa com o backend, num lugar só
│   ├── {pfx}-tela.js      ← emissão de HTML, e nada mais. NÃO liga evento
│   ├── {pfx}-eventos.js   ← liga os eventos, depois do innerHTML no lugar
│   ├── {pfx}-estilo.css   ← todo seletor prefixado
│   ├── lib/               ← biblioteca de terceiro, cópia própria
│   └── encaixes/          ← UM arquivo por lugar (Painel, Comando, Marca)
│
├── backend/
│   ├── extensao.py        ← a porta: lê payload['acao'] e roteia. Só isso
│   ├── {pfx}_acoes.py     ← o que cada ação faz
│   ├── {pfx}_dados.py     ← ler e gravar em files/. Só este abre arquivo
│   ├── {pfx}_caminhos.py  ← só monta caminho, nunca lê
│   └── {pfx}_config.py    ← lê config/, com os padrões de fábrica
│
├── extensao_boot.py       ← só quem roda sozinha. Na RAIZ, nunca em backend/.
│                            Expõe iniciar() E parar()
├── icone.svg              (opcional — aparece na lista de Configurações)
├── LEIA-ME.md             (opcional, mas faça)
│
├── files/                 ← o que ela GERA. Nunca configuração (parte 3)
└── config/
    ├── tela.json          ← QUAIS opções expor em Configurações › Extensões
    └── preferencias.json  ← os VALORES escolhidos (o PROGRAMA grava aqui)
```

**Nada disso é obrigatório além do `extensao.json`.** Uma extensão de tema tem
duas linhas de manifesto e um `.css`. Uma extensão de menu de contexto tem o
manifesto e um `index.js`. A árvore acima é o esqueleto de uma extensão grande —
copie só o que a sua precisa.

**Reconhecimento:** uma pasta é **extensão** se tiver `extensao.json` na raiz.
Sem isso ela é **categoria**, e o programa desce nela procurando mais.
Profundidade livre; pasta vazia aparece como categoria vazia. Para organizar,
crie uma subpasta e mova a extensão para dentro — a subpasta vira só um
agrupamento, sem configuração própria.

### Por que `files/` e `config/` ficam junto do código

Contraria o princípio "nunca misturar código com dado gerado", e é deliberado:
uma extensão é, por definição do recurso, **descartável**. A premissa é "uma
pasta = uma extensão inteira, removível com um delete só". Separar `files/` e
`config/` para `Internal/` quebraria isso — a extensão passaria a estar
espalhada em duas pastas, e apagá-la deixaria lixo para trás.

### O `{pfx}` — o prefixo da sua extensão

O prefixo **vai no manifesto** (`"prefixo": "tl"`, parte 7) e é **conferido**:
duas extensões ligadas não podem ter o mesmo, todo `id` de `acrescenta` começa
por ele, e seletor de CSS ou global do navegador que não começa por ele é
avisado na lista.

Escolha de duas a seis letras (três ou quatro é o comum) e use em **tudo**: nome de arquivo (`tl-tela.js`),
classe de CSS (`.tl-caixa`), id de elemento (`tl-lista`), função global
(`tlDesenhar`), chave de `localStorage` (`tl:aba`).

Não é organização, é sobrevivência: o frontend do programa **não tem escopo de
módulo**. Todo `let`, `const` e `function` de nível zero de qualquer arquivo cai
no mesmo espaço de nomes. Um `function desenhar()` seu sobrescreve o
`desenhar()` de outro arquivo **em silêncio**, e a tela dele para de funcionar
sem erro nenhum.

⚠️ **Não use `xt`, `ext`, `plugin` nem `pb`.** `xt` é a camada de extensões,
`_ext` é a tela de extensões de arquivo, `plugin` é o sistema de plugins e `pb`
é o Plugin base. (`xt`, `ext` e `pb` o programa recusa no manifesto; `plugin`
já não cabe nas seis letras.)

⚠️ **O prefixo não é o slug.** O slug (`xtMontar_{slug}`, `data-xt="{slug}"`)
continua sendo derivado do caminho da pasta, sozinho — o prefixo é o dono que
você escolhe.

---

## 7 · O manifesto `extensao.json`

```json
{
  "nome": "Erro na própria linha",
  "versao": "2",
  "descricao": "A linha com erro de sintaxe fica com o fundo rosado, inteira.",
  "prefixo": "erl",
  "tipos": ["2", "3"],
  "acrescenta": [
    { "recurso": "marca",   "id": "erl.linha-com-erro", "lugar": "editor.decorador",
      "arquivo": "frontend/encaixes/decorador.js" },
    { "recurso": "comando", "id": "erl.menu-da-aba", "lugares": ["editor.aba.menu"],
      "arquivo": "frontend/encaixes/aba.js" },
    { "recurso": "comando", "id": "erl.comandos", "lugares": ["acesso-rapido.comandos"],
      "arquivo": "frontend/encaixes/comandos.js" }
  ],
  "escreve_fora": []
}
```

| Campo | Obrigatório? | O que é | Se faltar ou vier errado |
|---|---|---|---|
| `nome` | não | O rótulo exibido | usa o nome da pasta |
| `versao` | não | **Só rótulo.** Nada é comparado | mostra vazio |
| `descricao` | não, mas faça | **O que ela faz, numa frase ou duas.** É o que a página dela mostra em cima de tudo (parte 13), e a linha abaixo do nome na lista de Configurações › Programa › Extensões | o programa usa o **primeiro parágrafo do `LEIA-ME.md`**; sem nenhum dos dois, a página diz que falta |
| `prefixo` | **sim** | O **dono**: 2 a 6 letras minúsculas, sem acento (`"erl"`). Proibidos: `xt`, `ext`, `pb` | a extensão aparece **com o aviso** e o interruptor desabilitado |
| `tipos` | **sim** | Lista de **textos**, um ou mais de `"1"` a `"4"` (parte 5) | número inválido sai com o aviso; sem nenhum válido, interruptor desabilitado |
| `acrescenta` | não (vazia = extensão que só tem página) | Cada peça que ela põe no programa: um objeto com `recurso`, `id` e o resto que o recurso pede (tabela abaixo) | o item com erro **não carrega**, e a lista diz qual e por quê — o resto da extensão liga |
| `escreve_fora` | não | Cada caminho que ela grava fora da pasta dela | vazio |
| `le_fora` | não | Cada pasta que ela lê fora da pasta de trabalho do projeto (parte 3) | vazio |

**O `id` de cada item** é `{prefixo}.{nome}`, com o nome em `[a-z0-9-]`
(`erl.comandos`). Único dentro da extensão e entre todas as ligadas.

| `recurso` | Campos do item | Lugar aceito hoje |
|---|---|---|
| `marca` | `lugar` (pode omitir), `arquivo` | `editor.decorador` |
| `tela` | `lugar`, `rotulo` (o texto do botão, até 40 caracteres), `icone` opcional (glifo, nunca emoji), `arquivo` | `aba.nova` e os `{aba}.subaba` da parte 15 ("Tela") |
| `painel` | `lugar`, `arquivo` | `terminal.painel`, `terminal.barra`, `editor.painel`, `editor.rodape`, `chat.painel`, `fila.painel`, `quadro.painel`, `oficina.painel` |
| `comando` | `lugares` (lista) **ou** `lugar`, `arquivo`, `teclas` opcional (`{"id-do-comando": "Ctrl+Alt+F"}`) | `acesso-rapido.comandos`, `editor.menu`, `editor.aba.menu`, `arvore.menu`, `trabalhos.quadro.cartao` |
| `reacao` | `evento`, `pode_barrar` (padrão `false`), `arquivo` (obrigatório em evento do lado da tela) | os eventos da parte 16 |
| `segundo-plano` | nenhum | — (exige `extensao_boot.py` na raiz) |
| `editor` | `parte` (`"cor"`, `"sugestoes"`, `"dica"`, `"formatacao"` ou `"trechos"`), `linguagens` (lista; `["*"]` = todas, o padrão — os nomes do Editor: `python`, `javascript`, `markup` para HTML…), `pasta` (cor), `arquivo` `.js` (sugestões, dica, formatação) ou `.json` (trechos) | — |
| `visual` | `parte` (`"icones"`), `arquivo` | — |
| `opcoes` | nenhum | — (a página existe sempre; declarado sem `config/tela.json`, aviso) |
| `agente` | `forma`: `"oficina"` com `arquivo` (um `.md` com `name` e `description` no cabeçalho), ou `"subagente"` com `pasta` (com `system-prompt.txt`, `prompt-correcao.txt` e `bloco.txt`), `nome`, `descricao` e, opcionais, `icone`, `fontes`, `ferramentas`, `envelope`, `le`, `selo_fonte`, `cor` e `antes` (parte 14) | — |
| `ferramenta` | `nome` (o que o modelo escreve: `ler_notas`), `devolve`, `se_errar` e, opcionais, `fonte` e `subagentes_do_programa` | — (exige `backend/extensao.py`) |
| `prompt` | `alvo` e, opcional, `arquivo` (`.txt` ou `.md`; sem ele, o texto vem do backend) | `chat`, `fila`, `chat.{prompt fixo}`, `fila.{prompt fixo}`, `subagente.{id de um subagente do programa}` |

⚠️ **Um lugar por extensão.** Dois itens no mesmo lugar (dois `comando` em
`editor.menu`), ou duas reações ao mesmo evento: o segundo é recusado. O
programa guarda UMA função por extensão em cada lugar, e a segunda apagaria a
primeira em silêncio. Junte os dois num arquivo só. **A exceção é `tela`**:
duas telas suas no mesmo lugar (duas sub-abas em Projeto) valem — o registro
dela é por `id`, não por lugar.

⚠️ **`pode_barrar` num evento que não tem "antes"** (`editor.salvou`,
`projeto.abriu`…) é rebaixado: a reação vale, depois do evento, e a lista
avisa.

⚠️ **`tipos` leva TEXTO, não número.** `["2"]`, e não `[2]` — o número também
é aceito, mas escreva texto.

⚠️ **JSON inválido não faz a pasta sumir.** Vírgula sobrando, aspas erradas: a
pasta **ainda é extensão** — tem o arquivo —, e aparece na lista com a mensagem
do parser em vermelho e o interruptor desabilitado. Silêncio aqui seria o pior
resultado possível: você criou a pasta, não vê nada, e não sabe por quê.

⚠️ **Erro num item não desabilita a extensão.** O que desabilita é o que impede
de CARREGAR: o arquivo ilegível, `tipos` ausente, vazio ou todo inválido, ou o
`prefixo` ausente ou inválido.

### As regras contra conflito

Uma extensão não pode entrar em conflito com outra. O programa confere ao
carregar:

| O que | Como o manifesto diz | O que o programa confere |
|---|---|---|
| O dono | `prefixo` | nenhuma outra extensão ligada usa o mesmo. Ligar a segunda é recusado; se as duas estiverem ligadas (editando o JSON à mão), a que vem **depois** na lista fica desligada, com o erro |
| O tipo | `tipos` | só números de 1 a 4 |
| Tudo que ela acrescenta | `acrescenta` | todo `id` começa pelo prefixo; nenhum `id` já existe em outra extensão; o lugar existe para aquele recurso. O item que falhar **não carrega**, e a lista mostra qual e por quê — o resto liga |
| Escolha única | Visual (pacote de ícones); Recursos do Editor por parte e linguagem | quando duas disputam, as duas mostram um **aviso**. O pacote de ícones se escolhe em Configurações › Ícones de arquivos e pastas; na cor do código, por enquanto vale a que vem antes na lista; nas sugestões, por enquanto as respostas das duas se somam |
| Ordem | — | telas, painéis, comandos e reações de várias extensões aparecem e rodam na ordem de Programa › Extensões; reações que podem barrar rodam em fila, e a primeira que barra encerra — o aviso diz o **nome** dela |
| Tecla | `teclas` no item `comando` | a sugestão só entra se a tecla estiver livre; o selo "mesma tecla" aparece em Configurações › Teclado, e o usuário decide |
| Estilo | — | todo seletor de CSS da extensão começa pelo prefixo (`.erl-…`, `#erl-…`, `[data-erl…`); o que não começar é **avisado** na lista, em âmbar. Só se vê o estilo que existe logo depois da carga — um `<style>` criado depois (num evento, depois de um `await`) escapa |
| Global no navegador | — | toda global que ela cria começa pelo prefixo: `window.erlCache`, `window.ERL_MAX`, `window.xtAlgo_erl` — e o contrato de montar, `window.xtMontar_{slug}` e irmãos. Outro nome é **avisado** na lista, em âmbar. Só se vê o que ela cria na carga síncrona: uma global criada depois de um `await` escapa, e `let`/`const` de nível zero não aparecem (mas continuam no espaço de nomes comum — parte 6) |
| Uma extensão quebra | — | não derruba as outras nem o programa (partes 2, 11 e 16); o erro sai com o nome dela |

### Manifesto antigo

O manifesto sem `acrescenta` — com `encaixes`, `eventos`, `consultas`, `dados`
e os números antigos em `tipos` — **continua ligando**. O programa o traduz na
leitura, e a lista mostra os tipos já traduzidos. Não há prefixo, e as regras de
prefixo e de estilo não se aplicam a ele.

⚠️ **É a chave `acrescenta` que diz qual formato é**, mesmo vazia. Os números se
sobrepõem ("2" antigo é *Categoria de Configurações*, "2" novo é *Muda uma
tela*), e o programa nunca adivinha pelo número.

| Número antigo | Vira |
|---|---|
| 2 | nada (a página é de toda extensão) — aceito e ignorado |
| 4, 9, 16, 17 | 3 · Muda um comportamento |
| 7, 8, 12 | 2 · Muda uma tela |
| 11, 24, 27 | 4 · Acrescenta conteúdo |
| 23, 25, 26 | **removido** (tema, preset de modelo, preset de Acervo): erro na lista |
| qualquer outro | erro: "tipo antigo sem equivalente" |

Se sobrar só o "2", os tipos saem das peças declaradas; sem peça nenhuma (a
antiga categoria de Configurações feita só por código), ela liga como `"2"`.

---

## 8 · A comunicação: quem fala com quem

Uma extensão tem duas metades — a que roda na tela e a que roda no Python — e
elas conversam por **uma porta só**. Fora isso, cada metade fala com o programa
por um caminho próprio.

```
            ┌─────────────────────────── A SUA EXTENSÃO ────────────────────────────┐
            │                                                                        │
            │   frontend/index.js  ──── ① chamar_extensao ────►  backend/extensao.py │
            │        │      ▲                (a ponte)                    │           │
            │        │      └────────────── a resposta ──────────────────┘           │
            │        │                                                    │           │
            └────────┼────────────────────────────────────────────────────┼───────────┘
                     │                                                    │
              ② window.pywebview.api                              ③ open() / os.walk
                     │                                                    │
                     ▼                                                    ▼
            ┌──────────────────┐                              ┌────────────────────────┐
            │   O PROGRAMA     │                              │  O DISCO               │
            │  (o backend      │                              │  a sua pasta,          │
            │   inteiro dele)  │                              │  o files/ de um plugin │
            └──────────────────┘                              └────────────────────────┘
```

### As quatro conversas legítimas

| # | Quem → quem | Como | Para quê |
|---|---|---|---|
| ① | seu frontend → **seu** backend | `window.pywebview.api.chamar_extensao(CAMINHO, {acao, …})` | tudo o que precisa de disco ou de Python |
| ② | seu frontend → **o programa** | `window.pywebview.api.<qualquer método>` | ler projeto, arquivo, configuração |
| ③ | seu backend → **o disco** | `open()`, `os.walk`, sempre por caminho absoluto | a sua pasta, e o `files/` de outros |
| ④ | o programa → **você** | `window.xtMontar_{slug}` / `xtDesmontar_{slug}`; `executar(payload)`; `iniciar()` / `parar()` | é o programa que chama, nas horas dele |

### As três conversas proibidas

| Proibido | Por quê |
|---|---|
| seu backend → **o backend do programa** (`from modulos... import`) | funciona (o `sys.path` inclui `Program/Code/backend`) e é armadilha: os módulos internos mudam sem aviso |
| sua extensão → **outra extensão ou plugin**, por `import` ou por `chamar_*` | os dois passam a ter de estar ligados juntos, e desligar um quebra o outro em silêncio |
| seu frontend → **o disco** | ele não tem acesso. Peça ao seu backend, pela ponte |

### O formato da conversa ①

Sempre um objeto com `acao`, sempre uma resposta com `success`:

```js
// frontend — TODA conversa com o backend num arquivo só ({pfx}-api.js)
async function meupfxChamar(acao, extras = {}) {
  try {
    const r = await window.pywebview.api.chamar_extensao(CAMINHO, { acao, ...extras });
    if (!r || !r.success) {
      showToast((r && r.error) || 'a extensão não respondeu', true);
      return null;
    }
    return r;
  } catch (e) {
    // ⚠️ `try` E NÃO SÓ `if (!r.success)`. Um erro do lado Python não volta
    // como {success:false} — a ponte do pywebview REJEITA a promessa, e o
    // `await` estoura aqui. Sem o catch, a sua função morre no meio, calada.
    showToast('a ponte falhou', true);
    console.error('[meupfx]', e);
    return null;
  }
}
```

⚠️ **Nome de método errado na API do programa nunca dá erro — trava para
sempre.** `window.pywebview.api.metodo_que_nao_existe(...)` devolve uma promessa
que nunca resolve nem rejeita. Se a sua tela ficou em "carregando…" para sempre,
confira o nome do método antes de qualquer outra coisa.

---

## 9 · O frontend

### O que o programa faz por você

Ao ligar, ele injeta **um** `<script>`: o seu `frontend/index.js`, com `?t=`
para furar o cache, e com dois dados no `dataset` da tag. Depois espera
`window.xtMontar_{slug}` existir e a chama.

Ao desligar, remove esse `<script>`, os `<style>`/`<link>` com `data-xt`, as
duas globais, e chama o seu `xtDesmontar` antes de tudo isso.

### A casca

```js
(function () {
  // ⚠️ NUNCA escreva o caminho nem o slug à mão. O programa os põe no dataset
  // da tag <script> que carregou este arquivo. O usuário pode mover a pasta
  // para dentro de uma categoria a qualquer momento, e o slug leva um resumo
  // do caminho inteiro, que você não tem como calcular aqui.
  const EU = document.currentScript.dataset;   // { caminho, slug }
  const SLUG = EU.slug;
  const CAMINHO = EU.caminho;
  // ⚠️ `xtBaseUrl` do programa, e NUNCA `'../../External/extensions/' +
  // encodeURI(CAMINHO)` escrito à mão: é o programa que sabe codificar o
  // nome da pasta (espaço, acento, `#`, `?`), e ele já codifica do lado do
  // backend do mesmo jeito.
  const PASTA = xtBaseUrl(CAMINHO);

  // ⚠️ A FLAG DE MONTADA. Toda continuação depois de um `await` confere:
  // o usuário pode desligar você enquanto a ponte responde.
  let montada = false;

  // ⚠️ SÍNCRONA. O programa chama window.xtMontar_{slug} logo depois de o
  // script carregar; uma definição dentro de um `await` não estaria lá ainda.
  // O trabalho demorado vai DENTRO dela, num _montar() assíncrono.
  window['xtMontar_' + SLUG] = function () {
    montada = true;
    injetarEstilo();
    _montar();            // sem await: montar não pode segurar quem chamou
  };

  window['xtDesmontar_' + SLUG] = function () {
    montada = false;
    // tudo o que o programa NÃO desfaz sozinho — ver a parte 2
  };

  function injetarEstilo() {
    if (document.getElementById('meupfx-estilo')) return;   // ⚠️ religar não duplica
    const estilo = document.createElement('style');
    estilo.id = 'meupfx-estilo';
    estilo.dataset.xt = SLUG;            // ⚠️ é por aqui que o programa o remove
    estilo.textContent = '.meupfx-caixa { color: var(--text-muted); }';
    document.head.appendChild(estilo);
  }

  async function _montar() {
    const r = await window.pywebview.api.chamar_extensao(CAMINHO, { acao: 'ola' });
    if (!montada) return;   // desligada enquanto a ponte respondia
    // …
  }
})();
```

⚠️ **Envolva tudo num IIFE** (`(function () { … })()`). Sem isso, cada `const`
e cada `function` do seu arquivo vira global do programa inteiro — e o
`SLUG` do arquivo A sobrescreve o do arquivo B.

### Os quatro papéis, quando a extensão cresce

Uma extensão de tela grande separa em quatro arquivos, com uma regra por
arquivo:

| Arquivo | Faz | **Não** faz |
|---|---|---|
| `{pfx}-estado.js` | guarda o objeto em memória | tocar no DOM, chamar o backend |
| `{pfx}-api.js` | **toda** conversa com o backend | montar HTML |
| `{pfx}-tela.js` | devolve texto HTML | ligar evento (o HTML ainda não está no DOM) |
| `{pfx}-eventos.js` | liga os eventos, **depois** do `innerHTML` | montar HTML |

A separação existe por um defeito que se repete: ligar um `addEventListener` no
mesmo lugar que monta o HTML parece funcionar até a lista ser remontada — e aí
o listener morre junto do elemento antigo, sem erro nenhum. **Delegue no
container**, que sobrevive à remontagem.

### Injetar os irmãos

O programa injeta **um só**: o `index.js`. Os irmãos são seus — e o `?t=` é
obrigatório, pelo mesmo motivo que o programa o usa: sem ele o WebView2 serve a
versão em cache, e você edita o arquivo, religa a extensão, e vê o código
antigo.

```js
function irmao(nome) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.id = `meupfx-${nome}`;                          // para você remover depois
    el.src = `${PASTA}/frontend/${nome}.js?t=${Date.now()}`;
    el.onload = resolve;
    el.onerror = () => reject(new Error(`não carregou ${nome}.js`));
    document.head.appendChild(el);
  });
}

async function _montar() {
  // Em ORDEM: estado → api → tela → eventos. Cada um usa o anterior.
  for (const n of ['estado', 'api', 'tela', 'eventos']) await irmao(n);
  meupfxIniciar();
}
```

⚠️ **`data-xt` só faz o programa remover `<style>` e `<link>`, não `<script>`.**
O único `<script>` que ele remove é o `index.js`, pelo id `xt-script-{slug}`.
Os irmãos são seus para remover, no `xtDesmontar`:

```js
window['xtDesmontar_' + SLUG] = function () {
  ['estado', 'api', 'tela', 'eventos'].forEach(n => {
    const el = document.getElementById(`meupfx-${n}`);
    if (el) el.remove();
  });
  // e as globais que esses arquivos criaram
  delete window.meupfxIniciar;
  delete window.meupfxDesenhar;
};
```

### CSS em arquivo, em vez de dentro do `index.js`

Para folha grande, um `<link>` é melhor que um `<style>` com o CSS embutido — o
DevTools mostra o arquivo, com números de linha:

```js
const folha = document.createElement('link');
folha.rel = 'stylesheet';
folha.dataset.xt = SLUG;                // ⚠️ o programa remove <link> também
folha.href = `${PASTA}/frontend/meupfx-estilo.css?t=${Date.now()}`;
document.head.appendChild(folha);
```

E dentro do `.css`, **todo seletor prefixado, e só tokens**:

```css
/* ⛔ .caixa { background: #34495E; }   pinta o programa inteiro, e some no tema claro */
/* ✔ */
.meupfx-caixa {
  background: var(--surface);
  border: 1px solid rgba(var(--white-rgb), 0.06);
  border-radius: var(--radius);
  color: var(--text);
}
```

---

## 10 · O backend

### O que o programa faz por você

Ao ligar, ele importa `backend/extensao.py` **como pacote** e guarda o módulo.
Ao desligar, chama `parar()` do boot, larga o módulo e esquece o pacote inteiro
em `sys.modules`.

### A porta, e só a porta

```python
# backend/extensao.py — o ÚNICO arquivo que o programa conhece pelo nome.
"""A porta. Lê payload['acao'] e roteia. Nada mais."""

from . import meupfx_acoes


def executar(payload):
    acao = (payload or {}).get('acao')

    if acao == 'listar':
        return meupfx_acoes.listar(payload)
    if acao == 'gravar':
        return meupfx_acoes.gravar(payload)

    return {'success': False, 'error': 'ação desconhecida: %r' % acao}
```

⚠️ **A função tem de se chamar `executar`, ser de módulo (não de classe) e
aceitar um argumento.** Se não for, o programa devolve
`backend/extensao.py não define executar().`

### Os cinco arquivos, e a regra de cada um

| Arquivo | Faz | **Não** faz |
|---|---|---|
| `extensao.py` | roteia por `acao` | abrir arquivo, calcular |
| `{pfx}_acoes.py` | o que cada ação faz | montar caminho, abrir arquivo |
| `{pfx}_dados.py` | **o único que abre arquivo** | montar caminho, decidir |
| `{pfx}_caminhos.py` | **só monta caminho** | abrir, ler, gravar |
| `{pfx}_config.py` | **só quem tem `extensao_boot.py`**: o boot não recebe payload e lê `config/preferencias.json` à mão | existir numa extensão sem boot — as opções já chegam em `payload['preferencias']` (parte 13) |

### O backend pode ter vários arquivos — e o do plugin não pode

⚠️ **Esta é a diferença mais prática entre os dois**, e a razão de o Plugin base
ter tudo num arquivo só. Lá, a pasta do plugin não está no `sys.path` e o módulo
não é pacote: um segundo `.py` em `backend/` **não pode ser importado**.

Aqui pode. O programa carrega o `backend/extensao.py` **como pacote**, com a
pasta `backend/` como lugar de busca:

```python
from . import meupfx_acoes          # ✔ acha backend/meupfx_acoes.py
```

Regras do import relativo aqui:

- **use `from . import irmao`**, e não `import irmao`. O segundo procura no
  `sys.path`, que não inclui a sua pasta;
- **não precisa de `__init__.py`.** A pasta vira pacote por construção;
- **só irmãos da MESMA pasta.** `backend/extensao.py` alcança
  `backend/qualquer.py`, mas não alcança `extensao_boot.py`, que está na raiz;
- **ao desligar, o programa esquece o pacote inteiro** — o `extensao.py` e todos
  os irmãos que ele importou. É o que faz editar um irmão e religar trazer o
  código novo, e não o de antes.

### Estado entre chamadas

⚠️ **O módulo é importado UMA vez, ao ligar, e fica até desligar.** É o
contrário do plugin, que reimporta a cada chamada — e é o que permite ter estado:

```python
_cache = {}          # sobrevive entre chamadas. Num plugin, zeraria a cada uma.
```

Duas consequências, e a segunda pega todo mundo uma vez:

- **você pode guardar coisas** (um cache, uma conexão, um contador);
- **editar o arquivo não tem efeito enquanto ela está ligada** — desligue e
  religue (parte 21).

Uma extensão **desligada** devolve `{'success': False, 'error': 'Extensão
desligada.'}`; ela nunca é importada por conta própria.

### Erros: nunca deixe escapar sem nome

O programa embrulha o que escapar (`Erro dentro da extensão: …`), mas a
mensagem dele não sabe o que você estava fazendo. Trate no seu lado:

```python
def listar(payload):
    projeto = payload.get('projeto')
    if not projeto:
        return {'success': False, 'error': 'nenhum projeto aberto.'}
    try:
        return {'success': True, 'itens': meupfx_dados.ler(projeto)}
    except FileNotFoundError:
        # O caso NORMAL de uma extensão que ainda não rodou. Não é erro.
        return {'success': True, 'itens': []}
    except OSError as e:
        return {'success': False, 'error': 'não deu para ler: %s' % e}
```

⚠️ **`print` é o log do backend.** Ele sai no terminal de onde o programa foi
lançado. Prefixe com o nome da extensão — `print('[meupfx]', …)` —, senão a
linha aparece no meio de dezenas de outras sem dono.

---

## 11 · A ponte: `chamar_extensao`

Uma porta só. O frontend manda `{acao, …}`; o `backend/extensao.py` recebe em
`executar(payload)` e devolve o que quiser.

```js
const r = await window.pywebview.api.chamar_extensao(CAMINHO, {
  acao: 'contar_arquivos',
  projeto: currentProject,      // opcional — ver abaixo
  pasta: 'src',
});
```

**A convenção de retorno é `{'success': bool, ...}`** — não é regra do
pywebview, é do programa. Siga-a: todo código que chama a ponte já espera isso.

### O que o programa acrescenta ao payload

Se `payload['projeto']` vier preenchido, o programa acrescenta antes de
entregar:

| Chave | O que é | Quando falta |
|---|---|---|
| `pasta_projeto` | a raiz do código daquele projeto | `None` se o projeto não tem pasta |
| `grafo_imports` | o `grafo.json` | ausente se o projeto nunca rodou o Grafo de Imports |
| `pipeline` | o resultado de "Visualizar pipeline" | ausente se nunca rodou o agente Pipeline |

E **sempre**, com ou sem `projeto`:

| Chave | O que é | Quando falta |
|---|---|---|
| `preferencias` | o que o usuário escolheu na sua tela de configuração, já por cima dos `padrao` do `config/tela.json` | `None` se a extensão não tem `config/tela.json` |
| `processos` | o **processo gerenciado** (`XtProcessos`): o que você pede para rodar e o programa derruba ao desligar ou fechar — ver abaixo | nunca falta |

É por `preferencias` que o seu backend lê as opções — e não abrindo
`config/preferencias.json` por conta própria. Ver a parte 13.

É assim que a sua extensão chega ao código do usuário sem conhecer a estrutura
interna do programa. **Não monte esse caminho à mão.**

```python
def contar(payload):
    raiz = payload.get('pasta_projeto')          # veio do PROGRAMA
    if not raiz or not os.path.isdir(raiz):
        return {'success': False, 'error': 'este projeto não tem pasta de código.'}
    ...
```

### A ponte tem teto

O programa espera o seu `executar` no máximo **`XT_TETO_PONTE_S` (30 s)**.
Passado isso, a tela recebe `{success: False, error: 'A extensão "Nome" não
respondeu em 30 s.'}` e deixa de esperar. ⚠️ A sua função **não é morta** —
thread em Python não se mata; ela só deixou de segurar a tela. Ação longa de
verdade: devolva logo e trabalhe num processo gerenciado.

Enquanto a extensão ainda está importando (ligar tem teto também, de 5 s), a
ponte devolve `'A extensão "Nome" ainda está carregando.'`.

### O processo gerenciado: `payload['processos']`

Uma thread aberta dentro do `executar` não é parada por ninguém quando o
usuário desliga a extensão. Peça ao programa para rodá-la, e ele a derruba ao
**desligar** a extensão e ao **fechar** o programa. Nada é gravado em disco.

| Método | O que faz |
|---|---|
| `ligar(nome, alvo)` | roda `alvo(parar)` numa thread; `parar` é um `threading.Event` que acende quando o programa quer que você saia. Nome já rodando → `{success: False}` |
| `ligar_comando(nome, comando, pasta=None)` | roda um comando do sistema (sem janela, saída descartada); parar é `taskkill /F /T` na árvore dele. Devolve `{success: True, pid}` |
| `parar(nome)` | para agora e espera até 5 s. `{success: False, error}` se não parou |
| `rodando(nome)` | `{success: True, rodando: bool}` |

```python
def executar(payload):
    if payload.get('acao') == 'ligar_relogio':
        def alvo(parar):
            while not parar.wait(5):      # ⚠️ parar.wait, nunca time.sleep
                print('[pfx] relogio vivo')
        return payload['processos'].ligar('relogio', alvo)
```

⚠️ O objeto `processos` fica no Python: não o devolva no retorno (só o retorno
atravessa para o JavaScript).

### O que NÃO atravessa a ponte

A ponte do pywebview serializa tudo em texto. Não mande megabytes por ela:
agregue no Python e mande o resultado. Um plugin do programa lê 3 MB de JSON em
Python (150–400 ms, irrelevante) e manda 10 KB pela ponte — o contrário
travaria a tela.

### Quando quem chama é o PROGRAMA — as três ações `xt.*`

A porta é a mesma (`executar(payload)`), mas três ações não vêm da sua tela:
vêm do programa, quando a extensão declara ferramenta, trecho de prompt sem
`arquivo` ou subagente com `envelope` (parte 14). O `xt.` na frente é
reservado: **nenhuma ação sua começa por ele**.

| `acao` | Quando chega | O payload traz | Você devolve |
|---|---|---|---|
| `xt.ferramenta` | um subagente chamou uma ferramenta sua | `ferramenta` (o nome), `subagente` (o id de quem chamou), `parametros` (o objeto que o modelo mandou), `projeto`, `pasta_projeto` | `{'success': True, 'texto': '…'}` — ou `{'success': False, 'error': '…'}`, que o modelo recebe como `ERRO: …` |
| `xt.prompt` | o programa está montando um prompt de um `alvo` seu que não tem `arquivo` | `alvo`, `projeto` (ou `None`), `pasta_projeto`, `subagentes_ativos` (os ids ligados nesta conversa; `None` num prompt fixo) | `{'success': True, 'texto': '…'}` — texto vazio = nada entra |
| `xt.envelope` | um subagente seu com `"envelope": true` vai começar | `subagente`, `projeto`, `pasta_projeto` | `{'success': True, 'blocos': [{'rotulo': 'ARQUIVOS DA BASE', 'nome': 'Notas', 'texto': '…'}]}` — cada bloco entra na mensagem como `[ROTULO — nome]` |

- **O payload é mais leve que o da tela:** só `pasta_projeto` (quando vem
  `projeto`), `preferencias` e `processos`. O grafo de imports e o pipeline
  ficam de fora — uma ferramenta roda dezenas de vezes numa tarefa.
- **O teto de leitura não é seu.** O programa corta o `texto` de
  `xt.ferramenta` no **teto de leitura** de Configurações › Programa ›
  Ferramentas dos subagentes — o mesmo de toda ferramenta que lê — e avisa
  quanto ficou de fora. Não conte token.
- **O mesmo teto de tempo** da ponte (`XT_TETO_PONTE_S`); passou, a chamada
  vira erro com o nome da extensão.
- **Não lance.** Um erro seu chega ao modelo como `ERRO: Erro dentro da
  extensão …`, que não o ajuda a se corrigir. Devolva `success: False` com o
  que ele precisa para acertar na próxima rodada (a lista do que existe,
  por exemplo).

---

## 12 · `extensao_boot.py` — a extensão que roda sozinha

Na **raiz** da extensão, nunca em `backend/`. A presença do arquivo é o único
sinal de que a extensão é automática.

```python
import threading

_parar = threading.Event()


def iniciar():
    # Roda numa THREAD própria, disparada quando a extensão liga (e no boot do
    # programa, para as que já estavam ligadas). Pode demorar à vontade: nada
    # aqui atrasa a abertura da janela.
    while not _parar.wait(60):        # o ciclo, a cada 60 s
        ...


def parar():
    # ⚠️ Tem de devolver em poucos segundos. O programa espera 5.
    _parar.set()
```

⚠️ **`threading.Event().wait(60)` e não `time.sleep(60)`.** O `wait` acorda na
hora quando o `parar()` chama `set()`; o `sleep` dorme os 60 segundos inteiros e
o programa desiste de esperar por você — e avisa no console.

⚠️ **`parar()` é obrigatório, e o Plugin base resolve isto de outro jeito.** O
laço de um plugin se reagenda para sempre e relê o próprio estado a cada ciclo,
pulando o trabalho quando está desligado — funciona, mas deixa uma thread viva
até o programa fechar. Aqui o programa chama `parar()` e a extensão para de
verdade.

⚠️ **O boot não é mais o único jeito de rodar algo que para sozinho.** Um
serviço que só nasce quando o usuário pede (um servidor que sobe num clique)
vai num **processo gerenciado** (`payload['processos']`, parte 11): o programa
o derruba ao desligar a extensão e ao fechar, como faz com o `parar()`.

⚠️ **O `extensao_boot.py` não alcança o `backend/` por import relativo** — ele
está na raiz, e o pacote dele é a raiz. Se precisar do mesmo código nos dois,
duplique a função pequena ou carregue por caminho, como o Plugin base faz.

---

## 13 · A página da extensão em Configurações › Extensões — e o `config/tela.json`

**Toda extensão ligada tem uma página**, do lado Extensões do trilho de
Configurações, e é o programa que a desenha — você não escreve HTML nenhum.
Ela tem quatro partes, de cima para baixo — e mais duas, entre a segunda e a
terceira, para quem traz subagente:

| Parte | O que mostra | De onde sai |
|---|---|---|
| **Sobre** | ícone, nome, versão, a `descricao`, a pasta, e um botão que leva a Programa › Extensões (é lá, e só lá, que se liga e desliga) | `extensao.json` (e `icone.svg`, `LEIA-ME.md`) |
| **O que ela acrescenta ao programa** | os tipos **por nome**, onde ela se encaixa, o que observa, o que pode barrar, o que responde, o dado que entrega, se roda sozinha, se escreve fora da pasta, e os avisos do manifesto | o manifesto, cruzado com os catálogos do programa |
| **Subagentes e o que cada um lê** | só para quem traz subagente: cada um com o que lê (`le`, ou as `fontes`), as ferramentas e o id pelo qual o Chat e a Fila o chamam | os itens `agente` com `forma: "subagente"` |
| **Limites** | só para quem traz subagente, **só leitura**: subagentes em paralelo, rodadas de ferramentas, ferramentas por rodada, teto de leitura e teto da resposta — os mesmos de todo subagente | Configurações › Programa › Ferramentas dos subagentes |
| **Comandos no Acesso rápido** | só para quem declara `acesso-rapido.comandos`: os comandos dela, com a tecla de cada um **editável ali mesmo** — é a mesma grade de Configurações › Programa › Teclado | o registro de teclas |
| **As opções** | os cartões abaixo, com "Salvar" e "Restaurar padrão" | `config/tela.json` |

⚠️ **As três primeiras partes você ganha de graça** — quanto melhor o
manifesto, melhor a página. Uma extensão de dado puro (ícones, gramáticas) tem
página do mesmo jeito, e é o único lugar do programa que diz o que ela é. Sem
`config/tela.json` a página **não tem a quarta parte, nem "Salvar", nem
"Restaurar padrão"**: um botão que não grava nada seria mentira.

⚠️ **A página não é pintada pelo "Destacar extensões".** O lado Extensões do
trilho já diz de onde ela veio; o destaque é para o que você põe NO MEIO de
uma tela do programa — um painel, um item de menu, um comando na barra.

*(Mudado em 06/09/2026: até então só quem tinha `config/tela.json` aparecia do
lado Extensões, e a categoria era só as opções. A regra antiga está riscada no
fim desta parte.)*

### As opções: o `config/tela.json`

Você **não escreve HTML** de configuração. Declara quais opções quer, e o
programa desenha com as mesmas classes das categorias dele. É isso que faz vinte
extensões terem a cara do programa em vez de vinte caras diferentes.

```json
{
  "cartoes": [
    { "titulo": "Captura", "dica": "De quanto em quanto tempo varrer",
      "campos": [
        { "chave": "intervalo_minutos", "rotulo": "Intervalo (minutos)",
          "tipo": "numero", "padrao": 15, "min": 1, "max": 120, "passo": 5,
          "nota": "Abaixo de 5 minutos o disco não descansa." },
        { "chave": "ativo", "rotulo": "Capturar em segundo plano",
          "tipo": "interruptor", "padrao": true },
        { "chave": "tom", "rotulo": "Tom", "tipo": "escolha", "padrao": "calmo",
          "opcoes": ["calmo", "animado"] },
        { "chave": "pasta", "rotulo": "Pasta a varrer", "tipo": "texto",
          "padrao": "src" }
      ] }
  ]
}
```

| `tipo` | Desenha | Grava | Extras |
|---|---|---|---|
| `texto` | campo de texto | texto | — |
| `numero` | campo numérico | número, ou `null` se vazio | `min`, `max`, `passo` |
| `interruptor` (ou `caixa`) | caixa de seleção | `true`/`false` | — |
| `escolha` | lista suspensa | o valor escolhido | `opcoes` |

`opcoes` aceita texto solto (`"calmo"`) ou par (`{"valor": "c", "rotulo": "Calmo"}`).
Todo campo aceita `nota`, que vira a linha de ajuda embaixo dele.

⚠️ **`interruptor` desenha uma CAIXA, e não o interruptor deslizante do
programa.** O deslizante promete efeito imediato, e este painel tem barra de
"Salvar" — usá-lo aqui seria mentir sobre o que o clique faz.

### Como ler o que o usuário escolheu

O "Salvar" grava em `config/preferencias.json`; o "Restaurar padrão" regrava os
`padrao` deste arquivo. As duas coisas são do **programa**: você nunca escreve
em `preferencias.json` — e, desde 05/09/2026, **nem lê**. O programa já
resolve o arquivo por cima dos `padrao` do `tela.json` e entrega pronto, dos
dois lados:

| Onde você está | Como pega |
|---|---|
| no **backend**, dentro de `executar(payload)` | `payload['preferencias']` — vem em toda chamada da ponte |
| no **frontend**, dentro de um gancho (decorador, guardiã, item de menu) | `xtPreferenciasDe(EU.slug)` — **síncrona**, do que está em memória; `null` se você não tem `tela.json` |
| no **frontend**, no `xtMontar` | `xtPreferenciasDe(EU.slug)` também serve: a lista é sincronizada antes de o seu `index.js` entrar |

```js
const PADRAO = { cor: 'red', intensidade: 10 };     // os mesmos do tela.json
const prefs = { ...PADRAO, ...(xtPreferenciasDe(EU.slug) || {}) };
```

**E o "Salvar" vale na hora.** Se a sua extensão precisa reagir — reescrever um
`<style>`, refazer uma moldura, remontar uma expressão —, defina o gancho
opcional, no molde de `xtMontar`:

```js
window['xtPreferenciasMudaram_' + SLUG] = function (preferencias) {
  if (!montada) return;
  _injetarEstilo();                 // relê xtPreferenciasDe(SLUG) por dentro
};
```

Quem só lê dentro do gancho (`xtPreferenciasDe` a cada pintura) não precisa
dele. Apague-o no `xtDesmontar`, como as outras globais.

```python
# backend/meupfx_acoes.py
def contar(payload):
    prefs = payload['preferencias']          # {'intervalo_minutos': 15, 'ativo': True, …}
    ...
```

⚠️ **Os padrões moram num lugar só: o `tela.json`.** Até 05/09/2026 cada
extensão tinha um `{pfx}_config.py` com a mesma leitura e os padrões copiados
— quatro cópias idênticas, e uma extensão inteira (Formatar ao salvar) que
tinha backend só para isso. Não recrie esse arquivo.

⚠️ **Só quem tem `extensao_boot.py` ainda lê o arquivo à mão.** O boot roda
sem payload e não alcança o programa; ele abre `config/preferencias.json`
direto (a partir de `__file__`, parte 3) e repete o padrão de que precisa. É o
caso de "Servidor local com recarga", que só repete a porta.

⚠️ **Uma extensão de frontend que só precisa das próprias opções não precisa
de `backend/` nenhum.** Peça a `preferencias_da_extensao` no `xtMontar`, uma
vez — nunca dentro de uma guardiã ou de um gancho de decorador, que têm teto
de tempo.

⚠️ ~~**Quem não tem `config/tela.json` não ganha a categoria de opções**~~ —
desde 06/09/2026 toda extensão ligada tem página; quem não tem `tela.json`
só não tem a parte das opções (ver o topo desta parte). Extensão
**desligada** continua não aparecendo: não faz sentido configurar o que não
está rodando.

---

## 14 · As extensões que são só conteúdo (Recursos do Editor › cor e Visual › ícones)

Estas podem não ter código nenhum — sem `frontend/`, sem `backend/`. Só o
manifesto (tipo `"4"`, Acrescenta conteúdo) e o arquivo do conteúdo, apontado
no item de `acrescenta`.

⛔ **Tema, preset de modelo e preset de Acervo NÃO vêm de extensão.** O
programa já os configura, e a extensão serve para acrescentar o que ele não
tem. Um manifesto antigo com os tipos 23, 25 ou 26 aparece na lista com o erro.

⚠️ **A extensão nunca substitui o embutido.** Ela acrescenta uma opção ao lado
do que já existe, e quem escolhe é o usuário. Desligar a extensão devolve o
embutido na hora.

⚠️ **Em dois casos o "embutido" deixou de existir**, e a regra continua valendo
porque não há mais nada a substituir: os **ícones** e as **gramáticas**
saíram do programa em 04/09/2026 e viraram extensões que vêm junto com
ele. Sem elas, o programa mostra emoji e código monocromático — que já eram os
dois estados possíveis de quem desligava aquilo.

### Recursos do Editor › cor — as gramáticas de linguagem

```json
{ "nome": "Cor do código", "prefixo": "gra", "tipos": ["4"],
  "acrescenta": [ { "recurso": "editor", "id": "gra.cor", "parte": "cor",
                    "linguagens": ["*"], "pasta": "components" } ] }
```

⚠️ **É o único conteúdo que aponta uma PASTA**, e não um arquivo. Dentro
dela, um `prism-{linguagem}.js` por linguagem, no formato de `components/` do
[Prism](https://github.com/PrismJS/prism). O programa não lê nada disso: ele
aponta `Prism.plugins.autoloader.languages_path` para a sua pasta, e o
autoloader pede um arquivo por linguagem, sob demanda, quando um arquivo
daquele tipo abre no Editor.

⛔ **Não ponha o `prism-core.js` aí dentro.** O motor fica no programa
(`External/libraries/prism-master/`), e dois motores carregados brigam pelo
`window.Prism`. **Sai a gramática, nunca o motor** — é o que garante que
desligar a extensão deixe o Editor monocromático em vez de cego: a fatia por
blocos que segura o desempenho da aba usa `Prism.tokenize` e
`Prism.Token.stringify`, e isso é desempenho, não cor.

⛔ **Não traga `themes/`.** As cores dos tokens saem das variáveis do tema do
programa (`frontend/estilos/editor-cores.css`), e um tema do Prism não seria
lido por ninguém.

⚠️ **Os arquivos têm de ser `.js` sem minificar.** O programa força
`use_minified = false` no autoloader, porque a distribuição do Prism não traz
`.min.js`.

⚠️ **Versão 1: a PRIMEIRA extensão ligada com a cor do código vale** (a que
vem antes em Programa › Extensões). Somar duas pastas exigiria um autoloader
próprio. Duas ligadas disputando a mesma linguagem mostram um aviso na lista.

Não aparece em Configurações como opção: o efeito é a cor do Editor, e ela se
vê abrindo um arquivo.

### Visual › ícones

```json
{ "nome": "Meus ícones", "prefixo": "mic", "tipos": ["4"],
  "acrescenta": [ { "recurso": "visual", "id": "mic.icones", "parte": "icones",
                    "arquivo": "mapa.json" } ] }
```

Ao lado do `mapa.json`, duas pastas: `arquivos/` e `pastas/`, com os SVGs.

```json
{
  "padrao":    { "arquivo": "generico", "pasta": "generica" },
  "extensoes": { "py": "python", "js": "javascript" },
  "pastas":    { "backend": "servidor", "estilos": "pincel" }
}
```

A chave de arquivo é **só o que vem depois do último ponto** — extensão composta
não existe, `algo.test.js` usa o ícone de `js`. A de pasta é o nome inteiro, em
minúsculas. O valor é o nome do SVG **sem a extensão**.

Aparece em Configurações › Ícones, no "Pacote de ícones" — ao lado de **Ícones
de arquivo**, que é o Material Icon Theme, e que desde 04/09/2026 é uma extensão
como a sua e não mais parte do programa. O primeiro item da lista é "Nenhum
(emoji)".

⚠️ Todo ícone tem volta ao emoji se o arquivo faltar. Uma linha errada no
`mapa.json` vira emoji, nunca imagem quebrada — e por isso ela **não dá erro**.
Se o seu ícone não aparece, o nome do SVG não bate.

### Trechos prontos (Recursos do Editor › trechos)

Um trecho pronto é um pedaço de código que entra inteiro quando o usuário
digita o começo do prefixo dele e aceita no popup de sugestões. É **dado**, sem
código: um `.json` na sua pasta.

```json
{ "recurso": "editor", "id": "pfx.trechos", "parte": "trechos",
  "linguagens": ["javascript"], "arquivo": "trechos.json" }
```

```json
[
  { "prefixo": "fori", "descricao": "laço for com índice",
    "corpo": "for (let i = 0; i < ${1:n}; i++) {\n  $0\n}" }
]
```

- É o subconjunto do formato de *snippets* do VS Code, em português:
  `prefixo`, `descricao`, `corpo` (texto, ou lista de linhas). No `corpo`,
  `$1` é onde o cursor para, `${1:texto}` para com `texto` selecionado, `$0` é
  a parada final; `\$` é um cifrão de verdade. Sem marcador aninhado, sem
  variável.
- Ao aceitar, o corpo entra **sem os marcadores**, com o recuo da linha em que
  entrou, e o cursor vai para o `$1` (senão o `$0`, senão o fim). Um Ctrl+Z tira
  o trecho inteiro.
- No popup ele aparece como `fori · trecho · laço for com índice`, junto das
  sugestões — os de várias extensões se **somam**.
- `linguagens` usa os nomes do Editor (os que aparecem no rodapé dele). Um nome
  errado não dá erro: o trecho simplesmente não aparece.
- Um trecho sem `prefixo` ou `corpo` é pulado, com o aviso no console; um JSON
  inválido vira erro da entrada, e a extensão continua ligada.

### Agente da Oficina (o recurso `agente`)

Um agente é um `.md` com cabeçalho (`name`, `description`, `tools`, `model`) —
o mesmo formato dos agentes de Arquivos › Agentes. O seu aparece no popover de
**"＋ Terminal"** da Oficina, marcado "de extensão", **ao lado** dos da
biblioteca: ele acrescenta, nunca substitui nem edita um agente do usuário.

```json
{ "recurso": "agente", "id": "pfx.revisor", "forma": "oficina", "arquivo": "agentes/revisor.md" }
```

```markdown
---
name: pfx.revisor
description: Revisa o diff do último commit e aponta o que quebrou.
tools: Read, Grep
---
Você revisa…
```

- `name` e `description` são obrigatórios no cabeçalho — sem eles o item é
  recusado.
- Escolher o agente no popover **copia** o `.md` para a pasta de agentes do
  projeto (a do assistente externo do projeto, `.claude/agents/` no Claude
  Code), como `{id}.md` e com `name: {id}` — seja qual for o nome do seu
  arquivo. É por esse nome que o terminal o aciona. O seu arquivo, na sua
  pasta, nunca é tocado.
- ⚠️ **Desligar a extensão tira o agente da lista; o `.md` que já foi copiado
  para o projeto FICA.** É a regra do programa para todo agente escolhido na
  Oficina — ele copia e nunca remove sozinho. Quem quer tirar, apaga da pasta
  de agentes do projeto.

### Subagente do Chat e da Fila (o recurso `agente`, `forma: "subagente"`)

Um subagente é alguém que o **agente do Chat e o da Fila chamam** no meio da
resposta — como chamam o Leitor ou o Buscador. O seu aparece nas sub-abas
**Subagentes** do Chat e da Fila, no grupo **"De extensões"**, com o mesmo
liga/desliga dos outros (ligado por padrão). Ele **acrescenta**: nunca
substitui nem edita um subagente do programa.

```json
{ "recurso": "agente", "id": "pfx.conferente", "forma": "subagente",
  "nome": "Conferente", "icone": "✓",
  "descricao": "Confere se a resposta cita o arquivo certo.",
  "fontes": ["codigo"], "pasta": "agentes/conferente",
  "ferramentas": ["grep", "ler_arquivo", "ler_notas"],
  "envelope": true, "le": "Notas/, na raiz do projeto",
  "selo_fonte": "Notas", "cor": "turquesa", "antes": [] }
```

A `pasta` tem os três arquivos que o programa tem para cada subagente dele:

| Arquivo | O que é | Marcadores que o programa troca |
|---|---|---|
| `system-prompt.txt` | quem ele é, e as ferramentas que pode chamar | `{max_rodadas_ferramentas}`, `{max_ferramentas_rodada}` — a pergunta NÃO entra no prompt: chega na mensagem, no bloco `[PERGUNTA DO ORQUESTRADOR — Chat]` ou `— Fila` |
| `prompt-correcao.txt` | o que ele ouve quando devolve um JSON de ferramenta errado | `{descricao_erro}`, `{max_ferramentas_rodada}`, `{max_rodadas_ferramentas}`, `{ferramentas_validas}` (a lista desta chamada) |
| `bloco.txt` | a descrição que entra no prompt do Chat e da Fila, para eles saberem quando chamar você | — |

- ⚠️ **O `bloco.txt` tem de citar o `id`** (`• pfx.conferente — …` e um
  exemplo `{"chamadas": [{"subagente": "pfx.conferente", "pergunta": "…"}]}`):
  é por ele que o Chat e a Fila chamam. Sem o `id` no bloco, o item vale, mas
  sai um aviso na lista.
- **`ferramentas`** (opcional) — a lista do que ele pode chamar: ferramentas
  do programa (`grep`, `ler_arquivo`, `ler_indice`, `ler_doc_tecnica`,
  `ler_pipeline`, `ler_resumo_pastas`, `ler_grafo_imports`, `ler_relacoes`,
  `ler_glossario`, `busca_semantica`) e as que **esta** extensão declara no
  recurso `ferramenta` (abaixo, "Ferramenta própria"). **Sem ela, são as do
  Analista** — `grep`, `ler_grafo_imports`, `ler_indice`, `ler_doc_tecnica`,
  `ler_arquivo` e `ler_relacoes`. Todas de **leitura**; nenhuma ferramenta de
  subagente escreve. Um nome que não existe recusa o item. O formato de
  chamar é o dos subagentes do programa
  (`{"ferramentas": [{"nome": …, "parametros": {…}}]}`) — copie a parte
  "FERRAMENTAS" do `system-prompt.txt` do Analista
  (`Program/Code/prompts/Assistente/Subagentes/Analista/`). Uma ferramenta fora
  da lista volta como erro de formato, e o `prompt-correcao.txt` entra.
- Ele roda no **mesmo LM Studio** do Chat, com o mesmo modelo — o programa é
  100% local — e com os **mesmos limites de todo subagente**: paralelo,
  rodadas, ferramentas por rodada, teto de leitura e teto da resposta, de
  Configurações › Programa › Ferramentas dos subagentes. A extensão não tem
  limite próprio; a página dela só os mostra (parte 13). E roda dentro do
  Chat e da Fila, com a **mesma trava da IA** dos outros subagentes.
- **O bloco é variável:** o `bloco.txt` entra no prompt do Chat e da Fila só
  com a extensão **e** aquele subagente ligados (o liga/desliga das sub-abas
  Subagentes).
- **`envelope: true`** (opcional) — antes de cada chamada, o programa pede ao
  seu backend (ação `xt.envelope`, parte 11) blocos que entram na mensagem,
  junto da pergunta, como `[ROTULO — nome]`: a lista do que ele pode ler, por
  exemplo. É conteúdo, e vai no envelope — nunca no `system-prompt.txt`.
- **`le`** (opcional) — o que ele lê, em texto (`"Notas/, na raiz do
  projeto"`): a página da extensão mostra no cartão «Subagentes e o que cada
  um lê». Sem `le`, a página mostra as `fontes`.
- **`selo_fonte`** (opcional) — o texto do primeiro selo de fonte do card, no
  lugar do rótulo genérico (`"Notas"` em vez de `SAÍDA DAS SKILLS`).
- **`cor`** (opcional) — `violeta`, `indigo`, `rosa` ou `turquesa`: o token
  `--sub-cor-{cor}` dos cinco temas, na legenda e no título do grupo no Log.
  Sem ela (ou com outra), `--purple`.
- **`antes`** (opcional) — ids ANTIGOS que este subagente substitui (um
  subagente que saiu do programa e virou este, por exemplo). O liga/desliga
  que o usuário salvou com o id antigo — no Chat, na Fila e em cada chat —
  passa para o id novo na primeira vez que a tela vê a extensão ligada.
- `nome` e `descricao` são obrigatórios (o card); `icone` é opcional (🧩 sem
  ele); `fontes` diz o que o card mostra que ele lê — `codigo`, `doc-gerada`,
  `saida-skills` — e, sem ela, vale a do Analista (`["doc-gerada", "codigo"]`).
- **Desligar a extensão tira o card das duas sub-abas e o subagente do
  próximo envio.** Uma chamada que já estava rodando termina; a próxima não
  começa. Religar volta com o liga/desliga que você tinha deixado.

### Ferramenta própria (o recurso `ferramenta`)

Uma ferramenta que o seu subagente chama como as do programa — e que quem
**atende** é o seu backend, na ação `xt.ferramenta` (parte 11).

```json
{ "recurso": "ferramenta", "id": "pfx.ler-notas", "nome": "ler_notas",
  "devolve": "Uma nota do projeto, pelo nome",
  "se_errar": "nome errado → lista as notas parecidas",
  "fonte": "saida-skills",
  "subagentes_do_programa": ["fila-verificador"] }
```

```python
# backend/extensao.py
from . import pfx_acoes

def executar(payload):
    acao = (payload or {}).get('acao')
    if acao == 'xt.ferramenta':
        return pfx_acoes.ferramenta(payload)   # {'success': True, 'texto': '…'}
    return {'success': False, 'error': 'ação desconhecida: %r' % acao}
```

- **`nome`** é o que o modelo escreve em `{"nome": …}`: minúsculas, dígitos e
  `_`, começando por letra, como as do programa. Não pode ser o nome de uma
  ferramenta do programa. Duas extensões **ligadas** com o mesmo `nome`: vale
  a que vem antes em Programa › Extensões, e a outra sai com o aviso no
  console.
- **`devolve`** e **`se_errar`** são o que a tabela da sub-aba Ferramentas do
  Chat e da Fila mostra (se errar escreve-se em seta: *o que deu errado* → *o
  que volta*).
- **O teto de leitura é o do programa.** O `texto` que você devolve é cortado
  no teto de leitura de Configurações › Programa › Ferramentas dos
  subagentes, com o aviso de quanto ficou de fora. Um só teto para toda
  ferramenta que lê.
- **`subagentes_do_programa`** (opcional) **empresta** a ferramenta a
  subagentes do programa enquanto a extensão está ligada — o Verificador da
  Fila (`fila-verificador`), por exemplo. Desligou, a ferramenta sai da lista
  dele no próximo subagente que começar. Para ensinar o subagente do programa
  a usá-la, acrescente um **trecho de prompt** com `alvo`
  `"subagente.fila-verificador"` (abaixo).
- **`fonte`** (opcional) — `codigo`, `doc-gerada` ou `saida-skills`: o selo
  que o card do subagente do programa ganha enquanto tem a ferramenta.
- Se ela lê fora da pasta de trabalho do projeto, declare em `le_fora`
  (parte 3). O programa não abre nada por você: ele só passa
  `payload['pasta_projeto']`.

### Trecho de prompt (o recurso `prompt`)

Um texto seu que entra num prompt do programa **só enquanto a extensão está
ligada**. É assim que o Chat e a Fila ficam sabendo quando chamar os seus
subagentes, sem o programa conhecer o nome deles.

```json
{ "recurso": "prompt", "id": "pfx.chat", "alvo": "chat" },
{ "recurso": "prompt", "id": "pfx.revisar", "alvo": "chat.revisar", "arquivo": "prompts/revisar.txt" }
```

| `alvo` | O prompt |
|---|---|
| `chat` | o do agente do Chat |
| `fila` | o do agente da Fila |
| `chat.{chave}` · `fila.{chave}` | um prompt fixo (`chat.revisar`, `fila.seguranca`, `fila.melhorias`…) |
| `subagente.{id}` | o de um subagente do **programa** (`subagente.fila-verificador`…) |

- **Onde entra:** no marcador `{acrescimos_das_extensoes}` do prompt; sem
  marcador, no fim. Sem extensão nenhuma, o marcador some — o prompt fica
  como era. A página mostra os alvos que existem hoje, por extenso.
- **Com `arquivo`** (`.txt` ou `.md`, na sua pasta), o texto é o do arquivo.
  **Sem `arquivo`**, o programa pede ao seu backend (ação `xt.prompt`,
  parte 11), com `subagentes_ativos` — é o jeito de falar só dos seus
  subagentes que estão ligados, ou de montar um índice que muda com o projeto.
- **Um trecho por alvo** em cada extensão (o segundo é recusado); trechos de
  várias extensões no mesmo alvo entram todos, na ordem de Programa ›
  Extensões.
- O trecho é **instrução**: vai no prompt. Conteúdo (a lista do que o
  subagente pode ler, um arquivo) vai no `envelope` do subagente — regra
  «Instrução no system, conteúdo no envelope».

---

## 15 · Os encaixes — Painel, Comando e Marca no código

As partes 9 a 14 são sobre a extensão ganhar um lugar **só dela** — uma
categoria, uma tela, um dado. Esta parte é o contrário: **entrar num lugar que
já existe**.

Um *ponto de encaixe* é um lugar do programa que aceita extensão. Você declara
no manifesto em quais quer entrar — um item de `acrescenta` com o recurso
**Painel**, **Comando** ou **Marca no código** e o lugar —, e o programa chama o
seu código no momento em que aquele lugar é desenhado.

```json
"acrescenta": [
  { "recurso": "comando", "id": "pfx.menu",   "lugares": ["editor.menu"],
    "arquivo": "frontend/encaixes/menu.js" },
  { "recurso": "painel",  "id": "pfx.painel", "lugar": "terminal.painel",
    "arquivo": "frontend/encaixes/painel.js" }
]
```

(No manifesto antigo, o mesmo se escrevia `"encaixes": [{ "ponto", "arquivo" }]`
— continua aceito.)

**Um arquivo por ponto**, sempre, em `frontend/encaixes/`. É o que permite ler
"o que esta extensão faz no menu do Editor" sem abrir o resto dela.

### As duas formas de ponto

| Forma | O programa te dá | Você devolve | Serve onde |
|---|---|---|---|
| **`painel`** | um `<div>` só seu | nada — você desenha dentro | há espaço em branco de verdade |
| **`itens`** | só o contexto | uma lista de itens | o desenho não é seu (menu de contexto) |

⚠️ **A forma não é escolha sua** — ela é do ponto. O menu de contexto é
`itens` porque o programa tem **um** componente de menu, e a extensão precisa
*estender* a lista dele, não desenhar um menu próprio com outra medida e outra
cor ao lado. Você não escolhe: consulte a tabela de pontos abaixo.

### Como se escreve um encaixe

```js
// frontend/encaixes/menu.js
(function () {
  // ⚠️ NUNCA escreva o slug nem o ponto à mão. Os dois vêm do dataset da tag
  // <script> que o programa injetou, a partir do seu manifesto — dois lugares
  // para o mesmo texto é um lugar para ele ficar diferente. E o slug você
  // nem teria como calcular: ele leva um resumo do caminho inteiro da pasta,
  // que muda quando você move a extensão para dentro de uma categoria.
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  xtRegistrarEncaixe(EU.slug, EU.ponto, (contexto) => {
    // Devolver [] é o NORMAL, não uma falha: item que não se aplica ao alvo
    // não entra na lista. Item cinza (`ativo: false`) é só para "se aplica,
    // mas não agora" — e nesse caso `motivo` é obrigatório.
    if (contexto.tipo !== 'arquivo') return [];
    return [{ icone: '◇', rotulo: 'Fazer alguma coisa',
              fazer: () => showToast('feito') }];
  });
})();
```

Num ponto `painel`, a função recebe `(container, contexto)` e não devolve nada:

```js
xtRegistrarEncaixe(EU.slug, EU.ponto, (container) => {
  // ⚠️ SEJA IDEMPOTENTE. O ponto é repintado quando a tela reabre e quando
  // outra extensão liga, e o MESMO container volta — de propósito, para o que
  // está meio preenchido aqui dentro não se perder. Desenhar sem checar
  // duplica o seu conteúdo a cada repintura.
  if (container.querySelector('.meupfx-painel')) return;
  const caixa = document.createElement('div');
  caixa.className = 'meupfx-painel';
  container.appendChild(caixa);
});
```

⚠️ **O `container` é um `<div>` seu**, que o programa criou dentro do ponto —
nunca o elemento do programa. Ele leva `data-xt` (é assim que desligar sabe o
que remover) e `data-origem="extensao"` (é assim que o "Destacar extensões" o
pinta). Desenhe **dentro** dele; não crie nada fora dele, não suba pelo
`parentNode`, não mexa em irmão.

### Os pontos que existem hoje

| Ponto | Forma | Onde | O `contexto` |
|---|---|---|---|
| `terminal.painel` | painel | Aba Terminal, abaixo da barra de ferramentas | `{ projeto, caminho, origem }` — o mesmo do `terminal.barra` |
| `terminal.barra` | painel | Aba Terminal, na barra de ferramentas, entre "Selecionar script" e "▶ Executar" | `{ projeto, caminho, origem }` — `caminho` é o script que o ▶ Executar vai rodar (`""` se nenhum); `origem` é `"principal"` (o arquivo principal do projeto) ou `"manual"` (Selecionar script). Repintado quando o caminho muda |
| `editor.menu` | itens | Editor › clique direito na árvore de arquivos | `{ tipo: "arquivo"\|"pasta"\|"raiz", caminho, selecionados }` |
| `editor.aba.menu` | itens | Editor › clique direito na aba de um arquivo aberto | `{ caminho, fixado }` |
| `arvore.menu` | itens | Toda árvore de pastas compartilhada (Acervo, Relações, Documentação, Mapa de I/O, Resumo, Tree-sitter, Backups) | `{ caminho }` — vazio quando o clique foi no vazio da raiz |
| `trabalhos.quadro.cartao` | painel | Trabalhos › Quadro, no rodapé de cada cartão | `{ id, titulo, coluna, tags, pasta }` |
| `editor.decorador` | itens | Editor › sobre o código pintado, depois de cada pintura e de cada troca da janela de cor | `{ projeto, caminho, linguagem, texto, linhas, visivel }` — ver a subseção abaixo |
| `acesso-rapido.comandos` | itens | A barra do Acesso rápido, no modo Comando | `{ projeto, aba, arquivo }` |
| `editor.painel` | painel | Editor, abaixo dos painéis de código e acima do rodapé | `{ projeto, arquivo, linguagem }` |
| `editor.rodape` | painel | Editor › rodapé, um texto curto antes dos atalhos | `{ projeto, arquivo, linguagem, linha, coluna }` |
| `chat.painel` | painel | Assistente › Chat › Chat, acima das mensagens | `{ projeto, chat }` |
| `fila.painel` | painel | Assistente › Fila › Fila, acima das mensagens | `{ projeto, tarefa }` |
| `quadro.painel` | painel | Trabalhos › Quadro, acima das colunas | `{ projeto }` |
| `oficina.painel` | painel | Trabalhos › Oficina, logo abaixo da barra da Oficina | `{ projeto }` |

O `terminal.painel` tem **altura máxima**: passando de 40% da aba, ele rola por
dentro — a saída do Terminal nunca cai abaixo de 120 px. O `terminal.barra` é
horizontal: desenhe um botão ou um seletor pequeno, não um painel.

Todo ponto `painel` **vazio não ocupa pixel**, e todo ponto em bloco tem a
mesma altura máxima do `terminal.painel`: passou de 40% da tela em que está,
rola por dentro. Nenhum painel seu empurra a tela do programa para fora.

**O mesmo `comando` em vários lugares é UM item só**, com `lugares` e um
arquivo: o programa injeta esse arquivo **uma vez por lugar**, e o
`document.currentScript.dataset.ponto` (o `EU.ponto` dos exemplos) diz em qual
ele está. ⚠️ A **forma do retorno muda por lugar**: num menu ou no Acesso
rápido você devolve uma lista de itens; no cartão do Quadro
(`trabalhos.quadro.cartao`, forma painel) você desenha o botão. O
`terminal.barra` é lugar de **Painel**, e não de Comando.

```js
// frontend/encaixes/menu.js — "lugares": ["editor.menu", "acesso-rapido.comandos"]
(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }
  xtRegistrarEncaixe(EU.slug, EU.ponto, () => [
    { id: 'oi', icone: '◇', rotulo: 'Dizer oi', fazer: () => showToast('oi') },
  ]);
})();
```

#### `editor.painel` — um bloco no Editor

Abaixo dos painéis de código, acima do rodapé. Repintado quando o **arquivo
em foco muda** (e quando uma extensão liga) — não a cada tecla. `arquivo` é o
caminho relativo (`""` sem arquivo aberto); `linguagem` é a do Editor
(`"binario"` num binário).

```js
xtRegistrarEncaixe(EU.slug, EU.ponto, (caixa, ctx) => {
  caixa.textContent = ctx.arquivo ? `Aberto: ${ctx.arquivo}` : '';
});
```

#### `editor.rodape` — um texto curto no rodapé do Editor

Em linha, antes dos atalhos; o que não couber é cortado. ⚠️ **Repintado a CADA
movimento do cursor**: a sua função tem de ser barata — nada de ida à ponte
aqui (calcule antes, fora do gancho). `arquivo` vem `""` sem arquivo de texto
em foco (nenhum, ou um binário) — e aí esvazie o seu texto. `linha` e
`coluna` são `null` nesse caso.

```js
xtRegistrarEncaixe(EU.slug, EU.ponto, (caixa, ctx) => {
  caixa.textContent = ctx.arquivo ? `${ctx.arquivo.split('/').pop()} · L${ctx.linha}` : '';
});
```

#### `chat.painel` — acima das mensagens do Chat

Com ou sem chat aberto (`chat` é `null` quando não há). Repintado a cada troca
de chat e ao abrir a sub-aba.

```js
xtRegistrarEncaixe(EU.slug, EU.ponto, (caixa, ctx) => {
  caixa.textContent = ctx.chat ? `Chat ${ctx.chat}` : '';
});
```

#### `fila.painel` — acima das mensagens da Fila

`tarefa` é o id da tarefa selecionada, ou `null`. Repintado ao abrir a Fila e
a cada troca de tarefa.

```js
xtRegistrarEncaixe(EU.slug, EU.ponto, (caixa, ctx) => {
  caixa.textContent = ctx.tarefa ? `Tarefa ${ctx.tarefa}` : '';
});
```

#### `quadro.painel` — acima das colunas do Quadro

Repintado junto do Quadro inteiro (cada mudança de cartão). Seja idempotente.

```js
xtRegistrarEncaixe(EU.slug, EU.ponto, (caixa, ctx) => {
  if (!caixa.firstChild) caixa.textContent = `Quadro de ${ctx.projeto}`;
});
```

#### `oficina.painel` — logo abaixo da barra da Oficina

Flutua sobre o palco, **fora** da camada que dá zoom e pan: o que você desenha
não aumenta nem anda com o canvas, e o arraste do palco não pega os seus
cliques. Repintado a cada entrada na Oficina.

```js
xtRegistrarEncaixe(EU.slug, EU.ponto, (caixa, ctx) => {
  caixa.textContent = `Oficina de ${ctx.projeto}`;
});
```

### Tela — aba nova e sub-aba (o recurso `tela`)

A extensão ganha uma tela **só dela**: uma aba nova na barra de dentro do
projeto, ou uma sub-aba numa aba que já tem sub-abas. O programa cria o botão
e um painel vazio; o que vai dentro do painel é seu.

```json
{ "recurso": "tela", "id": "pfx.aba", "lugar": "aba.nova", "rotulo": "Anotações",
  "icone": "✎", "arquivo": "frontend/telas/aba.js" }
```

| `lugar` | Onde | `contexto` |
|---|---|---|
| `aba.nova` | uma aba nova, depois das abas do projeto | `{ projeto }` |
| `projeto.subaba` | Projeto › uma sub-aba nova | `{ projeto }` |
| `assistente.subaba` | Assistente › uma sub-aba nova | `{ projeto }` |
| `arquivos.subaba` | Arquivos (dentro do projeto) › uma sub-aba nova | `{ projeto }` |
| `inicio-arquivos.subaba` | Arquivos (tela de Projetos) › uma sub-aba nova | `{ projeto: null }` |
| `automacao.subaba` | Automação › uma sub-aba nova | `{ projeto }` |
| `analise.subaba` | Análise › uma sub-aba nova | `{ projeto }` |
| `mapas.subaba` | Mapas › uma sub-aba nova | `{ projeto }` |
| `backups.subaba` | Backups › uma sub-aba nova | `{ projeto }` |
| `trabalhos.subaba` | Trabalhos › uma sub-aba nova | `{ projeto }` |
| `inspetor.subaba` | Inspetor › uma sub-aba nova | `{ projeto }` |
| `configuracoes.subaba` | Configurações › lado Extensões | `{ projeto: null }` |

Documentação e Acervo **não** aceitam sub-aba de extensão: as sub-abas delas
não têm painel próprio (trocam a fonte de um painel só).

**O arquivo da tela** registra uma função de desenho:

```js
// frontend/telas/aba.js
(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, tela, lugar }
  xtRegistrarTela(EU.slug, EU.tela, (container, ctx) => {
    // ctx = { projeto } — null na tela de Projetos
    container.innerHTML = `<div class="screen-body"><p class="pfx-oi">Projeto: ${escapeHtml(ctx.projeto || '—')}</p></div>`;
  });
})();
```

- A função é chamada na **primeira vez que a tela aparece**, e **de novo
  quando o projeto mudou** desde a última vez. Não é chamada a cada clique:
  o que você desenhou continua lá entre uma visita e outra.
- O `container` é um `<div>` do programa com `data-xt` e
  `data-origem="extensao"` (o "Destacar extensões" acende o botão e o painel).
  Desenhe **dentro** dele. Na sub-aba de Configurações ele não leva
  `data-origem`: ali o lado Extensões já diz de quem é.
- `tela` e `lugar` chegam no `dataset` — nunca os escreva à mão.
- Várias telas de várias extensões ficam na **ordem de Programa › Extensões**,
  sempre depois das abas do programa.
- Desligar tira o botão e o painel **na hora**; se a sua tela estava aberta,
  a barra cai na primeira aba dela. O `xtDesmontar` roda **antes** de o painel
  sair — dá tempo de desfazer o que você pendurou lá dentro.
- Estado que a sua tela precisa guardar vai em `files/` da sua pasta (parte 3),
  nunca em outro lugar.
- ⚠️ "Depois de um await, confira se ainda está montada": a tela pode ser
  desligada enquanto a ponte responde.

Configurações também é um encaixe, mas você não o declara: a sua categoria se
cria com `registrarCategoriaConfig` (parte 9), e a das suas opções o programa
cria sozinho a partir do seu `config/tela.json` (parte 13).

⚠️ **As duas caem no lado Extensões do trilho, e não no lado Programa** — mesmo
que você passe `lado: 'programa'`. `registrarCategoriaConfig` desvia toda
categoria com `deExtensao: true` para lá: quem abre Configurações › Programa
está procurando configuração DO PROGRAMA, e o lado Extensões existe justamente
para a sua. Dê à sua categoria um rótulo que a distinga da das opções, que sai
com o `nome` do seu `extensao.json` — duas entradas com o mesmo nome, uma do
lado da outra no trilho, não se distinguem.

**Um item de menu** tem a mesma forma dos itens nativos — é o que faz o seu
menu ter exatamente a cara do resto do programa:

| Campo | O que é |
|---|---|
| `rotulo` | **obrigatório**. Item sem ele é ignorado |
| `icone` | um glifo, nunca emoji |
| `fazer` | a função do clique |
| `atalho` | **dois significados, conforme o ponto** — ver o aviso abaixo da tabela |
| `ativo: false` | desenha cinza — e aí `motivo` é **obrigatório** |
| `motivo` | o `title` que explica o cinza |
| `perigo: true` | vermelho, para o que destrói |
| `separador: true` | uma linha, no lugar de um item |
| `grupo: 'Título'` | um título de grupo, no lugar de um item — para separar seis itens seus como o menu nativo separa os dele |

**Só no ponto `acesso-rapido.comandos`** o item tem mais quatro campos — o
comando vira uma entrada do registro de teclas, e o registro precisa deles:

| Campo | O que é |
|---|---|
| `id` | **estável entre versões** da sua extensão: é a chave da tecla que o usuário escolheu (o programa prefixa com o seu slug). Sem ele, o `rotulo` faz as vezes — e mudar o rótulo perde a tecla |
| `ativo` | de preferência uma **função**, conferida a cada tecla e a cada pintura (`() => !!arquivoAberto()`); `false` também vale. Cinza pede `motivo` |
| `emCampo: true` | a tecla dispara **mesmo com o foco num campo de texto** — o `<textarea>` do Editor, o campo do Chat. Só para o comando cujo gesto é do código ("rodar o trecho"): sem isto a tecla nunca dispararia de dentro do arquivo |
| `onde` | o id do painel em que a **tecla** vale (`'tab-editor'`), ou `'global'`. Na barra o comando aparece de qualquer jeito; é a tecla que obedece — um `Ctrl+Enter` de "rodar o trecho" não pode disparar no campo do Chat |

Na barra e na tela de Teclado o seu comando aparece sob o **`nome` do seu
manifesto**, como grupo — "Tingir a janela: Tingir a janela…", como o VS Code
escreve "Python: Run file". E o que a sua função **deixou de devolver** sai do
registro na hora: devolva sempre a mesma lista e use `ativo` para o "não
agora" — uma lista que muda de tamanho faz a tecla do usuário sumir e voltar.

⚠️ **O nome na frente é do PROGRAMA, e o usuário pode desligá-lo.** Não escreva
o nome da sua extensão dentro do `rotulo` do comando nem do item de menu: o
programa já põe o nome na frente do comando na barra, e um título com o nome
acima dos seus itens no menu de contexto — cada um com um interruptor em
Configurações › Acesso rápido ("De quem é cada item"). Quem escreve o nome no
rótulo aparece duas vezes com o interruptor ligado, e o usuário que o desligou
continua vendo o que pediu para não ver. A cor do "Destacar extensões" não
depende desses interruptores.

⚠️ **O CAMPO `atalho` QUER DIZER DUAS COISAS, e depende do ponto:**

| No ponto… | `atalho` é |
|---|---|
| `editor.menu`, `editor.aba.menu`, `arvore.menu`, `trabalhos.quadro.cartao` | **só o texto à direita.** Registrar a tecla é outro assunto — escrever `Ctrl+K` aqui não faz o `Ctrl+K` existir |
| `acesso-rapido.comandos` | **a tecla SUGERIDA.** O programa a registra de verdade, se ela estiver livre |

Um campo com dois significados precisa estar escrito. Sem isto, quem escreve uma
extensão de menu põe uma tecla que não funciona, ou quem escreve um comando não
descobre que podia sugerir uma.

Os seus itens vão para o **fim** do menu, depois de um separador. Nunca no
meio: o menu nativo tem uma ordem pensada, e uma extensão que se intercalasse
nela mudaria a posição de itens que o usuário já sabe de cor.

⚠️ **Você não marca o item como sendo seu — o programa marca.** Todo item que
sai de um ponto `itens` chega ao menu com `data-origem="extensao"` e
`data-xt="{slug}"` no `<button>` dele, e é assim que o "Destacar extensões"
acende os seus. Não ponha nada disso à mão, e não invente uma classe própria
para "marcar que é meu": ela não seria vista pelo destaque, e o usuário que
ligou o destaque para achar a sua extensão não a acharia.

### A tecla sugerida — as três regras

Valem para o ponto `acesso-rapido.comandos`, e só para ele.

**1 · Você sugere; quem grava é o programa.** É o mesmo princípio do popup de
autocomplete: *o popup é do programa; a sugestão é da extensão*. Você escreve
`atalho: 'Ctrl+Alt+T'` e o programa registra o comando com essa tecla — **se ela
estiver livre**.

**2 · A escolha do usuário vence sempre.** Se ele trocou a tecla do seu comando
na tela de Configurações › Teclado, a sua sugestão não a desfaz — nem quando a
sua extensão for atualizada. O que ele escolheu mora no `settings.json` dele, e o
que você sugere é só o padrão de fábrica do seu comando.

**3 · Duas extensões pedindo a mesma tecla não quebram nada.** A primeira fica
com ela; a segunda entra **sem tecla**, e o conflito aparece na tela de Teclado,
com o selo "mesma tecla". Nunca se rouba a tecla de ninguém, e nunca se recusa
uma extensão por causa da tecla.

⚠️ **Desligar a sua extensão tira o comando da barra e MANTÉM a tecla gravada.**
É a promessa que este documento faz em caixa alta lá no começo: desligar não
apaga nada. Religando, o comando volta com a tecla que o usuário tinha escolhido
— e é por isso que o `id` que você dá a cada comando precisa ser estável entre
uma versão e outra da sua extensão. É ele que vira a chave da tecla.

### O que acontece quando dá errado

| Situação | O que o programa faz |
|---|---|
| `ponto` que não existe no catálogo | erro na lista de Configurações, em vermelho, com os pontos que existem. A extensão **liga** e os outros encaixes dela funcionam |
| `arquivo` que não existe na pasta | idem — conferido no servidor, não deixado para o 404 |
| `arquivo` com `..` ou barra inicial | recusado: o encaixe fica dentro da pasta da extensão |
| a sua função lança | `console.error` com o nome da extensão. As outras extensões do mesmo ponto continuam, e a tela do programa termina de pintar |
| você devolve algo que não é lista, num ponto `itens` | `console.error`, e o seu pedaço é ignorado. O menu abre do mesmo jeito |
| você é desligada | o programa tira você do registro **e apaga o `<div>`** que você já tinha desenhado. Nada fica na tela |

⚠️ Nenhuma dessas situações desabilita o interruptor. Um encaixe quebrado é um
pedaço da extensão que não funciona — não a extensão inteira.

### `editor.decorador` — decorar o código pintado

O único ponto `itens` que não é menu. Você devolve uma lista de **marcas** —
trechos do arquivo aberto que devem receber uma classe de CSS sua — e o
programa desenha. Serve para sublinhar um termo, tingir uma coluna, pintar o
fundo de uma linha.

⚠️ **Você nunca recebe o DOM do Editor.** O `<pre>` colorido é o espelho
caractere a caractere do `<textarea>`; uma extensão que mexesse nele apagaria a
cor do Editor inteiro no primeiro `innerHTML` errado, e desligar não teria como
desfazer. Você diz **onde**, o programa faz **como**.

#### O contexto

| Campo | O que é |
|---|---|
| `projeto` | o nome do projeto aberto (o mesmo `currentProject`) |
| `caminho` | o caminho relativo do arquivo que está no `<pre>` agora |
| `linguagem` | o nome de gramática que o Editor usa (`python`, `javascript`, `markup`, `none`…) |
| `texto` | o conteúdo inteiro, como está na tela agora |
| `linhas` | `texto.split("\n")` — calculado **uma vez** pelo programa, não uma vez por extensão |
| `visivel` | `{ de, ate }`, 1-indexado e inclusivo: a faixa de linhas que está **colorida** agora |

⚠️ **`visivel` é a saída para quem tem muitas marcas.** O Editor só colore o
que está perto da vista (ver "A JANELA" em `editor-superficie.js`); um CSV de
3.000 linhas × 12 colunas seriam 36.000 marcas, e o teto de 150 ms não aguenta.
Devolva só as da faixa: quando a rolagem mudar a faixa, você é chamado de novo.

⚠️ **Não existe evento "abriu um arquivo no Editor".** Quem precisa saber que o
arquivo trocou compara o `caminho` do contexto com o da chamada anterior.

#### A forma da marca

```js
// frontend/encaixes/decorador.js
(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  xtRegistrarEncaixe(EU.slug, EU.ponto, (contexto) => {
    // Devolver [] é o NORMAL.
    return [{
      linha: 42,          // 1-indexado
      coluna: 8,          // 0-indexado, dentro da linha
      tamanho: 12,        // quantos caracteres a marca cobre
      classe: 'glo-termo',                     // ⚠️ começa pelo SEU prefixo
      titulo: 'Termo do Vocabulário: Acervo',  // opcional — ver a ressalva
    }];
  });
})();
```

| Regra | Por quê |
|---|---|
| **`classe` tem de começar pelo seu prefixo** (2 a 5 letras e um hífen), e o programa **confere** | é o que impede duas extensões de brigarem pelo mesmo seletor. Classe fora do padrão é descartada com `console.error`. Pode ser mais de uma, separadas por espaço (`"csv-col csv-par"`) — e aí **cada uma** tem de ter o prefixo |
| **O CSS da classe é seu**, num `<style data-xt="{slug}">` da sua extensão | o programa só põe a classe. Sem o `<style>`, a marca existe no DOM e não aparece |
| **A marca pode mudar cor, fundo, sublinhado e riscado. Não pode mudar largura nem altura** | `padding`, `margin`, `border-left/right`, `font-*` e `letter-spacing` empurram o texto e o `<pre>` sai do alinhamento com o `<textarea>` — o cursor deixa de cair sobre a letra que ele mostra. Seguros: `color`, `background`, `text-decoration`, `border-bottom` |
| **Marca fora do arquivo é descartada em silêncio** | linha que não existe é o estado normal de quem calculou sobre uma versão anterior do texto |
| **Marca que atravessa `\n` é cortada na quebra** | "coluna" só faz sentido dentro de uma linha |
| **Duas marcas no mesmo trecho entram aninhadas**, na ordem em que as extensões foram ligadas | é o que permite uma sublinhar dentro do que a outra tingiu |

⚠️ **O `titulo` NUNCA aparece no mouse.** O `<pre>` tem `pointer-events: none`
— todo clique e todo `hover` vão para o `<textarea>` por cima. O `title` é
gravado no `<span>` porque é barato e útil no DevTools, mas **nenhuma extensão
pode depender dele para dizer algo ao usuário**. O que o usuário vê é só o CSS
da classe.

#### O caminho quente, e o que fazer quando você precisa do Python

⚠️ **Nunca chame `window.pywebview.api` dentro do gancho.** Ele roda depois de
**cada** pintura, e a pintura roda a cada 120 ms de digitação. Você tem **150 ms**
para a sua lista; estourado o teto, ela é ignorada com o aviso no console e a
próxima pintura tenta de novo. O gancho é **síncrono** — devolver uma promessa
não funciona.

Quem precisa de uma fonte cara (o Tree-sitter, o índice de identificadores)
calcula **fora** do gancho, no molde do lint (`editor-lint.js`):

1. dentro do gancho, devolva o que você tem em **cache** para aquele `caminho` —
   `[]` na primeira vez;
2. fora do gancho, ao perceber que `caminho` ou `texto` mudou, agende (com um
   debounce seu) a ida à ponte;
3. quando a resposta voltar, guarde no cache e chame **`xtPedirDecoracao()`**.

`xtPedirDecoracao()` refaz a decoração agora, sem esperar a próxima tecla. Ela
é agrupada por quadro: duas extensões pedindo ao mesmo tempo custam uma passada.

#### Quando dá errado

| Situação | O que o programa faz |
|---|---|
| você devolve `[]` | nada. É o caso normal |
| a classe não começa por um prefixo de 2 a 5 letras | a marca é descartada, com `console.error` e o seu nome |
| `linha`, `coluna` ou `tamanho` não é inteiro | idem |
| a linha não existe, ou a coluna passa do fim da linha | a marca é descartada **em silêncio** |
| você passa de 150 ms | a sua lista inteira daquela pintura é ignorada, com o aviso no console |
| você lança | `console.error` com o seu nome; as outras decoradoras continuam e a tela termina de pintar |
| você é desligada | as suas marcas são **desembrulhadas** na hora, nos dois painéis, sem tocar no texto |

⚠️ **Desligar desembrulha, não remove.** O `<span>` da marca envolve texto do
código: removê-lo apagaria esse texto do `<pre>`. É por isso que a marca **não**
leva `data-xt-encaixe` — esse atributo é o que `xtDesregistrarEncaixes` apaga
com `.remove()`.

### O que você ainda precisa desfazer

O programa remove o seu `<div>` e o `<script>` do encaixe. **O que você
pendurou fora dele continua sendo seu** — um `document.addEventListener`, um
`setInterval`, um `MutationObserver`. Desfaça no `xtDesmontar_{slug}`, como
manda a regra de ouro da parte 2.

---

## 16 · Os eventos — a Reação

Nas partes 9 a 15 é sempre **você** que age quando o usuário age: ele abre a
tela, você desenha; ele clica com o botão direito, você oferece um item.

Aqui é o programa que toma a iniciativa. Ele **avisa** — "vou salvar", "abri
um projeto" — e você reage. Ou **barra**. O recurso é a **Reação**:

```json
"acrescenta": [
  { "recurso": "reacao", "id": "pfx.ao-salvar", "evento": "editor.vai_salvar",
    "pode_barrar": true, "arquivo": "frontend/eventos/salvar.js" },
  { "recurso": "reacao", "id": "pfx.ao-abrir",  "evento": "projeto.abriu",
    "arquivo": "frontend/eventos/abriu.js" }
]
```

(No manifesto antigo: `"eventos": [{ "nome", "arquivo", "guardia" }]` — continua
aceito; `guardia` é o `pode_barrar`.)

### Os dois papéis

| | **Observador** (Reação depois) | **Guardiã** (Reação antes, `pode_barrar: true`) |
|---|---|---|
| Quando roda | **depois** da ação | **antes** da ação |
| O programa espera? | **não** | **sim** |
| Pode impedir? | não | **sim** |
| Pode mudar o dado? | não | **sim** |
| Teto de tempo | nenhum (ninguém espera) | **1,5 s** |

⚠️ **Peça guardiã só quando precisar mesmo barrar ou reescrever.** O
observador serve 90% dos casos, não pode atrapalhar ninguém, e o manifesto
deixa a diferença à vista: quem abrir o seu `extensao.json` vai ver que você
pode impedir o Ctrl+S dele.

⚠️ **O papel vem do manifesto, não do seu código.** `"guardia": true` no
`extensao.json`; no arquivo você só repassa o que chegou no `dataset`.

### Como se escreve

```js
// frontend/eventos/salvar.js
(function () {
  const EU = document.currentScript.dataset;  // { caminho, slug, evento, guardia }

  xtAssinar(EU.slug, EU.evento, (dado) => {
    // ── barrar ──  o `motivo` vai para a notificação: escreva-o para quem
    // vai LER, não para depurar. É a única explicação que o usuário terá do
    // arquivo dele não ter gravado.
    if (dado.arquivo.endsWith('.travado')) {
      return { barrar: true, motivo: 'Este arquivo está travado pela minha extensão.' };
    }

    // ── reescrever ──  o que vai ao disco é o que VOCÊ devolveu, e não o que
    // está na tela. É assim que "formatar ao salvar" funciona.
    const limpo = formatar(dado.texto);
    if (limpo !== dado.texto) return { dado: { ...dado, texto: limpo } };

    // ── deixar passar ──  não devolver nada é o normal.
    return null;
  // ⚠️ `=== '1'`, e nunca o valor cru: `dataset` só guarda TEXTO, e a string
  // 'false' é verdadeira em JavaScript. Um observador virando guardiã por
  // engano é o defeito mais caro desta parte.
  }, EU.guardia === '1');
})();
```

### Os eventos que existem hoje

| Evento | Lado | Guardiã cabe? | Quando | O `dado` |
|---|---|---|---|---|
| `editor.vai_salvar` | frontend | **sim** | antes de o Editor gravar | `{ projeto, arquivo, texto }` |
| `editor.salvou` | frontend | não | depois de gravar com sucesso | `{ projeto, arquivo, texto }` |
| `terminal.vai_rodar` | frontend | **sim** | antes de a aba Terminal rodar o script do ▶ Executar | `{ projeto, caminho, origem }` — ver "Tomar a execução" abaixo |
| `projeto.abriu` | frontend | não | o usuário entrou num projeto — ou trocou para outro | `{ projeto }` |
| `projeto.fechou` | frontend | não | o usuário voltou para a lista, fechou a aba do projeto, **ou trocou para outro** | `{ projeto }` — o que ESTAVA aberto |
| `arquivo.criado` | frontend | não | um arquivo ou pasta nasceu no projeto, pelo Editor — criado, colado como cópia ou solto de fora na árvore | `{ projeto, caminho, pasta }` — `pasta` vem `false` ao colar uma cópia e `null` quando o programa não sabe |
| `arquivo.renomeado` | frontend | não | um arquivo ou pasta mudou de nome **ou de lugar** (recortar e colar, arrastar na árvore), pelo Editor | `{ projeto, de, para }` |
| `arquivo.apagado` | frontend | não | um arquivo ou pasta foi excluído pelo Editor — também quando foi para a Lixeira | `{ projeto, caminho }`, um por item |
| `aba.abriu` | frontend | não | uma aba principal ficou visível — dentro do projeto, ou na tela de Projetos. Sub-aba **não** dispara | `{ projeto, aba, barra }` — `projeto` é `null` na tela de Projetos |
| `chat.mensagem_enviada` | frontend | não | o usuário enviou uma mensagem no Chat — "a mensagem saiu", antes da resposta | `{ projeto, chat, texto }` |

⚠️ **`abriu` e `fechou` andam em par.** Trocar do projeto A para o B é um
`fechou` de A seguido de um `abriu` de B. Quem aloca por projeto no `abriu` e
libera no `fechou` (uma moldura, um servidor apontando uma pasta) pode contar
com isso. E reentrar no MESMO projeto não é abrir de novo: não há evento.
| `rotina.terminou` | backend | não | uma rotina da Automação terminou — pelo ciclo, pela base ou pelo ▶ avulso | `{ projeto, rotina, erro, terminou_em }` |
| `trabalhos.cartao_moveu` | backend | não | um cartão mudou de coluna | `{ projeto, id, de, para }` |
| `terminal.terminou` | backend | não | um terminal **da Oficina** terminou (o da aba Terminal é `terminal.rodou`) | `{ projeto, id, codigo_de_saida }` |
| `terminal.rodou` | backend | não | o script que o ▶ Executar da aba Terminal rodou terminou — sozinho ou parado pelo ⏹ | `{ projeto, caminho, codigo_de_saida, como }` — `como` é `"terminou"` ou `"parado"` |
| `fila.tarefa_terminou` | backend | não | uma tarefa da Fila terminou — pronta, pronta com ressalva ou falhou | `{ projeto, id, status, erro, relatorio }` — `relatorio` é o nome do `.md` |
| `configuracao.mudou` | backend | não | uma configuração foi gravada — uma categoria de Configurações › Programa, ou as opções da página de uma extensão | `{ origem: "programa", categoria, chaves }` ou `{ origem: "extensao", extensao, chaves }` |

⚠️ **Os `arquivo.*` saem do Editor, e só dele.** Quem mexe no disco por outro
caminho — a Fila, o Chat, uma rotina — não os dispara. E **`aba.abriu` sai
também quando o programa restaura a aba** ao entrar num projeto: a tela mudou
de verdade. Uma reação pesada a ele deixa a troca de projeto lenta.

⚠️ **"Guardiã cabe: não" não é limitação, é o formato do evento.** Uma rotina
que terminou já terminou; não existe um "antes" em que barrar signifique
alguma coisa. Se você declarar `"guardia": true` num deles, a assinatura é
**rebaixada a observador** — ela continua valendo, com o aviso na lista. Você
não perde o aviso, que é a parte que você com certeza queria.

### Tomar a execução (`terminal.vai_rodar`)

A guardiã do `terminal.vai_rodar` tem três respostas: `null` (o Terminal roda
normal), `{barrar: true, motivo}` (não roda, e o motivo vira aviso) ou **tomar
a execução** — devolver o `dado` com `assumido_por` e `selo`. Aí o Terminal não
roda, não acusa erro, e a saída diz «▶ Executar ficou com a extensão «Nome».»,
com o `selo` no lugar do código de saída. Quem assumiu faz o trabalho do jeito
dele (por exemplo, pela ponte).

```js
(function () {
  const EU = document.currentScript.dataset;          // { caminho, slug, evento, guardia }
  xtAssinar(EU.slug, EU.evento, (dado) => {
    if (/\.bat$/i.test(dado.caminho)) return { barrar: true, motivo: 'Minha extensão: .bat barrado.' };
    if (window.pfxAssumir) return { dado: { ...dado, assumido_por: 'Minha extensão', selo: 'assumido' } };
    return null;                                      // segue: o Terminal roda normal
  }, EU.guardia === '1');
})();
```

Assinar como guardiã é `"pode_barrar": true` no item da Reação. O teto é o de
toda guardiã: 1,5 s.

### O lado backend

Os eventos do lado **backend** da tabela (`rotina.terminou`,
`trabalhos.cartao_moveu`, `terminal.terminou`, `terminal.rodou`,
`fila.tarefa_terminou`, `configuracao.mudou`) nascem
no Python: a tela pode nem estar aberta quando eles acontecem. Você os recebe em `backend/extensao.py` — e a
assinatura deles no manifesto **não precisa de `arquivo`** (não há `.js` a
carregar; se você puser um, ele é conferido e nunca injetado):

```json
"acrescenta": [ { "recurso": "reacao", "id": "pfx.terminou", "evento": "terminal.terminou" } ]
```

```python
def ao_evento(nome, dado):
    """O programa avisa. O que você devolve é ignorado — todo assinante do
    lado Python é OBSERVADOR.

    Você só recebe o que DECLAROU em `eventos`. O `nome` chega como argumento
    porque uma extensão pode assinar vários — mas nunca chega um que ela não
    assinou."""
    if nome == 'terminal.terminou' and dado['codigo_de_saida'] != 0:
        registrar_falha(dado['projeto'], dado['id'])
```

⚠️ **`rotina.terminou` sai TAMBÉM quando a rotina falhou** — e aí `erro` vem
preenchido. Uma extensão que só quer o caso de sucesso testa `erro` antes de
agir; assinar esperando só o sucesso é a leitura errada mais fácil de fazer.

⚠️ **`terminal.rodou` só sai quando o Terminal rodou de verdade.** Se uma
guardiã do `terminal.vai_rodar` barrou ou **tomou** a execução, o Terminal não
rodou nada, e não há aviso — quem tomou sabe quando o trabalho dele acaba. Nem
sai quando o Windows não tem programa associado ao arquivo. O `como: "parado"`
é o ⏹: o código de saída sozinho não distingue um script morto de um que
terminou com erro.

⚠️ **`configuracao.mudou` é um aviso por categoria, só com as chaves que
mudaram de valor** — um Salvar sem mudança não avisa. `categoria` é a chave
interna da categoria (`"editor"`, `"tema"`, `"modelo"`…); `extensao` é o
caminho da extensão que salvou (a sua ou a de outra — confira antes de agir).
As categorias que gravam um arquivo inteiro próprio (ordem das abas,
Launchers, Extensões, Arquivos que o programa lê…) **não** avisam. O aviso diz
QUE mudou; reler o valor é seu (`payload['preferencias']` na ponte, ou o
arquivo). O frontend da sua extensão já sabia das próprias opções por
`xtPreferenciasMudaram_{slug}` (parte 13) — este é para o seu Python.

⚠️ **Você tem 2 segundos.** Cada assinante roda na própria thread, e o
programa desiste de esperar passado o teto — o aviso costuma sair do fim de
uma rotina ou do encerramento de um processo, lugares que não podem esperar
por código de terceiro. Sua thread **não é morta** (isso deixaria um arquivo
meio escrito): ela continua, e o que ela fizer depois simplesmente não segura
mais ninguém.

⚠️ **Os dois barramentos NÃO se espelham.** Um evento de frontend não chega ao
Python, e vice-versa. Se você quer os dois lados, assine os dois — e olhe a
coluna "Lado" antes, para não assinar do lado errado e ficar esperando um
aviso que nunca vem.

### O que acontece quando dá errado

| Situação | O que o programa faz |
|---|---|
| a sua guardiã **não responde** em 1,5 s | segue como se você tivesse dito "pode", e avisa no console com o seu nome |
| a sua guardiã **lança** | **não barra**. Barrar por engano é pior: o usuário perderia o que digitou por causa de um bug seu |
| o seu observador lança | `console.error` com o seu nome. A ação já aconteceu, e as outras extensões continuam |
| duas guardiãs no mesmo evento | rodam **em série**, na ordem em que foram ligadas, e o `dado` passa de uma para a outra. A primeira que barra encerra |
| você é desligada | sai do barramento na hora. Uma guardiã que continuasse barrando depois de desligada seria o pior defeito possível daqui |

---

## 17 · As consultas — Recursos do Editor › sugestões

O sexto e último mecanismo, e o inverso do anterior. Na parte 16 o programa
**avisa** e você reage. Aqui ele **pergunta** e espera a sua resposta.

```json
"acrescenta": [
  { "recurso": "editor", "id": "pfx.sugestoes", "parte": "sugestoes", "linguagens": ["*"],
    "arquivo": "frontend/consultas/completar.js" }
]
```

(No manifesto antigo: `"consultas": [{ "nome": "editor.autocomplete", "arquivo" }]`
— continua aceito.)

### O caminho quente

⚠️ **Esta é a única parte deste contrato em que MILISSEGUNDOS importam.** A
consulta `editor.autocomplete` roda enquanto a pessoa digita. Três regras saem
disso, e nenhuma é ajuste fino:

| Regra | Por quê |
|---|---|
| **Nunca chame `window.pywebview.api` aqui** | a ponte custa milissegundos que o teclado não tem. Os símbolos já chegam prontos em `pergunta.simbolos` |
| **Você tem 150 ms** | passado o teto, a sua resposta é ignorada e o aviso vai ao console com o seu nome. Não aparecer é infinitamente melhor que travar a tecla |
| **Corte cedo** | o programa mostra 12 sugestões. Devolver quinhentas custa a você e não serve a ninguém |

O programa já faz a parte dele: espera **80 ms de pausa** antes de perguntar
(quem digita uma palavra inteira dispara UMA consulta, no fim), e descarta a
resposta que chegar atrasada — a de duas teclas atrás nunca aparece na tela.

### Como se escreve

```js
// frontend/consultas/completar.js
(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, consulta }

  xtRegistrarConsulta(EU.slug, EU.consulta, (pergunta) => {
    const prefixo = pergunta.prefixo.toLowerCase();
    const achados = [];

    // `pergunta.simbolos` já está em memória — o programa o carregou UMA vez,
    // quando o projeto abriu, justamente para você não ir ao Python por tecla.
    for (const s of pergunta.simbolos) {
      if (!s.nome.toLowerCase().startsWith(prefixo)) continue;
      // Não sugira a palavra que já está escrita por inteiro: aceitar não
      // mudaria nada, e ela ocuparia a primeira linha da lista.
      if (s.nome.toLowerCase() === prefixo) continue;

      achados.push({
        texto: s.nome,                       // o que entra no arquivo
        detalhe: `${s.tipo} · ${s.arquivo}`, // a coluna cinza da direita
        prioridade: 1000 - s.nome.length,    // maior primeiro
      });
      if (achados.length >= 40) break;
    }
    return achados;
  });
})();
```

### O que existe hoje

| Consulta | Quando | A `pergunta` | A resposta |
|---|---|---|---|
| `editor.autocomplete` (`parte: "sugestoes"`) | Editor, a cada pausa de 80 ms na digitação | `{ projeto, arquivo, linha, coluna, prefixo, simbolos, texto }` | `[{ texto, detalhe, prioridade }]` |
| `editor.dica` (`parte: "dica"`) | Editor, o mouse parou 400 ms sobre uma palavra | `{ projeto, arquivo, linguagem, linha, coluna, palavra, texto }` | `[{ texto }]` — texto simples, uma ou poucas linhas |
| `editor.formatar` (`parte: "formatacao"`) | Editor, o usuário pediu **Formatar o arquivo** (Acesso rápido) | `{ projeto, arquivo, linguagem, texto }` | `{ texto }` — o arquivo inteiro formatado — ou `null` ("não sei formatar este") |

**Cada consulta tem o próprio teto:** 150 ms para as sugestões (a cada tecla),
300 ms para a dica, **1,5 s** para a formatação. E cada uma só pergunta a quem
declarou a **linguagem** do arquivo em `linguagens` (as sugestões, por
enquanto, perguntam a todos).

**Somar ou escolher uma:** as respostas de sugestões e de dica se **somam** (a
dica de duas extensões aparece no mesmo balão). A formatação **não soma**: o
programa pergunta às que formatam aquela linguagem, na ordem da lista de
Programa › Extensões, e vale a **primeira** que devolver algo diferente de
`null`. Duas extensões de formatação para a mesma linguagem aparecem com o
aviso de disputa.

```js
// frontend/consultas/formatar.js — a resposta ÚNICA
(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, consulta, linguagens }
  xtRegistrarConsulta(EU.slug, EU.consulta, ({ arquivo, texto }) => {
    const r = pfxFormatar(arquivo, texto);
    return (typeof r === 'string' && r !== texto) ? { texto: r } : null;
  });
})();
```

O comando **Formatar o arquivo** é do programa, no Acesso rápido, sem tecla
padrão (o usuário escolhe uma em Configurações › Teclado). O texto formatado
entra na tela como uma edição — o Ctrl+Z desfaz — e **não é gravado**. O balão
da dica também é do programa: você devolve o texto, ele desenha.

⚠️ **A dica chega com o mouse, não com o cursor.** `linha` e `coluna` são do
caractere sob o mouse (1-indexadas), e `palavra` é a palavra inteira em volta
dele. O `titulo` de uma marca do decorador continua sem aparecer no mouse — a
dica é outra coisa.

Cada símbolo em `pergunta.simbolos` é `{ nome, tipo, arquivo, linha }` — vem do
Índice de Símbolos do projeto, já sem repetição. E `pergunta.texto` é o
conteúdo do arquivo aberto, como está agora (uma referência, sem cópia): é o
que permite sugerir as palavras que já estão no próprio arquivo, em qualquer
linguagem, mesmo num projeto sem índice — é o que "Completar enquanto digita"
faz.

⚠️ **Se o projeto nunca teve o Índice de Símbolos construído, `simbolos` vem
vazio.** Não é falha: é o estado normal de quem nunca abriu a aba Análise.
Trate a lista vazia como lista vazia, sem avisar nada — quem avisaria seria o
programa, não você.

### As cinco partes do Recursos do Editor

A **cor** e os **trechos prontos** são dado (parte 14); as **sugestões ao
digitar**, a **dica ao passar o mouse** e a **formatação** respondem uma
consulta (esta parte). Um item com `parte` desconhecida é recusado com o aviso,
e o resto da extensão liga.

### O que o programa decide, e você não

| | Quem decide |
|---|---|
| quantas sugestões aparecem (12) | programa |
| a ordem (prioridade, depois alfabética) | programa |
| o prefixo mínimo (2 caracteres) | programa |
| a pausa antes de perguntar (80 ms) | programa |
| o desenho do popup | programa |
| **quais** sugestões, e o texto de cada uma | **você** |

O popup é peça do programa de propósito: se cada extensão desenhasse o próprio,
duas ligadas ao mesmo tempo abririam duas caixas sobrepostas, com medidas
diferentes, e o teclado não saberia qual delas navega.

### O que acontece quando dá errado

| Situação | O que o programa faz |
|---|---|
| você não responde em 150 ms | ignora a sua resposta, com o aviso no console |
| você lança | `console.error` com o seu nome; as outras extensões continuam |
| você devolve algo que não é lista | ignorado; a lista das outras aparece do mesmo jeito |
| você devolve item sem `texto` | esse item é descartado, os outros valem |
| duas extensões respondem a mesma consulta | rodam **em paralelo**, e as listas são somadas e reordenadas por `prioridade` |
| você é desligada | sai do registro na hora, e o popup aberto fecha |

---

## 18 · O que o programa te empresta

Tudo isto é global no frontend e já está carregado quando o seu `xtMontar`
roda. **Use, em vez de reescrever.**

### Funções

| Função | O que faz |
|---|---|
| `showToast(msg, ehErro)` | a notificação do canto. Substitui `alert()`, que trava a janela |
| `abrirModalPadrao({title, bodyHtml, confirmLabel, onConfirm})` | a caixa de confirmar. `onConfirm(overlay, showErr)`; devolver `false` mantém a caixa aberta |
| `escapeHtml(txt)` | **use sempre** antes de pôr texto do usuário em `innerHTML` |
| `registrarCategoriaConfig({...})` / `desregistrarCategoriaConfig(chave)` | a sua categoria em Configurações, por código — o recurso Tela (`configuracoes.subaba`, parte 15) faz o mesmo pelo manifesto |
| `xtRegistrarTela(slug, id, fn)` | a função de desenho de uma tela sua (recurso Tela, parte 15) |
| `xtPedirDecoracao()` | refaz a decoração do Editor agora — para quem calculou as marcas **fora** do gancho de `editor.decorador` (parte 15) |
| `edArquivoAberto(caminho)` | o que o Editor sabe de um arquivo aberto: `{ texto, selecao, linhaDoCursor, linhaAtual, linguagem, naFrente, irParaLinha(n) }`, ou `null`. **É a porta para o Editor** — nunca cutuque `_edPaineis`, `painel.atual` nem `superficie.ta`, que são internos e mudam |
| `edArquivosAbertos()` | os caminhos abertos nos dois painéis, o da frente primeiro |
| `_edAbrirArquivo(caminho)` | abre (ou traz para a frente) um arquivo no Editor — inclusive uma imagem, no visualizador dele |
| `xtBaseUrl(CAMINHO)` | a URL da sua pasta, já codificada — para injetar um `<link>`, um `<script>` irmão ou um SVG. **Nunca monte esse caminho à mão** |
| `xtPreferenciasDe(SLUG)` | as suas opções, resolvidas, do que está em memória — **síncrona**, para ler dentro de um gancho (parte 13) |
| `window.pywebview.api.preferencias_da_extensao(CAMINHO)` | as mesmas opções, pela ponte — para quando você precisa delas antes de a lista estar em memória (parte 13) |
| `window.xtPreferenciasMudaram_{slug}(prefs)` | o gancho OPCIONAL que **você** define e o programa chama a cada "Salvar" da sua tela (parte 13) |
| `window.pywebview.api.abrir_endereco_no_navegador(url, largura, altura)` | abre um endereço `http`/`https` no navegador. Sem tamanho, no navegador padrão; com `largura` e `altura`, numa janela `--app` desse tamanho (navegador Chromium: Chrome, Edge, Brave, Vivaldi), num perfil próprio do programa, **um por tamanho** (`Internal/cache/navegador/{largura}x{altura}/`: cada tamanho no seu processo, senão a 2ª janela sairia no tamanho da 1ª) — sem os logins do usuário. Devolve `{success, tamanho}` e, quando o tamanho não valeu, `aviso`. Outro esquema (`file:///`…), ou o navegador que fecha logo ao abrir sem abrir janela → `{success: false, error}` |
| `window.pywebview.api.*` | o backend do programa inteiro — ver `../Plugins/A API do programa.md` |

### Globais que valem a pena conhecer

| Global | O que é |
|---|---|
| `currentProject` | o nome do projeto aberto, ou `null` |
| `appSettings` | as configurações do programa (**leia**; para gravar use `save_settings_parcial`) |
| `workspaceConfig` | a configuração do projeto aberto |

### Classes de CSS

Prefira as do programa às suas: elas já estão certas em todos os cinco temas.

| Classe | O que é |
|---|---|
| `.config-cartao` + `.config-cartao-cabecalho` / `-titulo` / `-dica` | um cartão de configuração |
| `.config-grade` | grade que vira uma coluna na janela estreita |
| `.config-field-row` + `<label>` | um campo com rótulo |
| `.config-check` | caixa de seleção com rótulo |
| `.config-nota` | a linha de ajuda embaixo de um campo |
| `.config-erro` | a faixa vermelha de "não deu para ler" |
| `.btn` + `.btn-positive` / `.btn-muted` / `.btn-special` | os botões |
| `.toggle-pill` + `.toggle-track` / `.toggle-knob` / `.toggle-label` | o interruptor de efeito imediato |
| `.mapa-toggle` + `.mapa-toggle-btn` | o toggle segmentado (2 a 3 opções) |
| `.hidden` | esconde. **Use esta, e não `style.display`** |

### Tokens de cor

**Nunca escreva hexadecimal.** O programa tem cinco temas, um deles claro, e uma
cor fixa fica ilegível em pelo menos um.

| Token | Para |
|---|---|
| `var(--bg)` / `var(--surface)` / `var(--surface-dark)` / `var(--surface-hover)` | fundos |
| `var(--text)` / `var(--text-muted)` | texto |
| `var(--blue)` | acontecendo agora, item ativo |
| `var(--green)` | terminou bem |
| `var(--red)` | erro |
| `var(--amber)` | aviso, terminou faltando pedaço |
| `var(--purple)` | acréscimo, fora do fluxo normal |
| `var(--radius)` / `var(--t)` | raio de borda e duração de transição |

Para transparência, use a variante `-rgb`: `rgba(var(--blue-rgb), 0.12)`.

---

## 19 · Consultar dados de outro plugin ou de outra extensão

Lendo o `files/` dele **direto do disco**. Nunca chamando o backend dele.

O motivo é o mesmo de sempre: chamar o backend do outro faz os dois terem de
estar ligados juntos, e desligar um passa a quebrar o outro sem erro nenhum. Ler
o arquivo funciona mesmo com o outro desligado — e quando o arquivo não existe,
você sabe exatamente o que aconteceu.

```python
# backend/meupfx_caminhos.py — só monta caminho, nunca lê.
import os

# ⚠️ Subir um número fixo de níveis NÃO funciona: a sua extensão pode estar na
# raiz de extensions/ ou dentro de uma categoria, e a profundidade muda. Suba
# até achar a pasta External, que é a única constante.
def pasta_external():
    p = os.path.dirname(os.path.abspath(__file__))
    while os.path.basename(p) != 'External':
        pai = os.path.dirname(p)
        if pai == p:
            raise RuntimeError('não achei a pasta External acima de mim')
        p = pai
    return p


def arquivo_de_plugin(nome_do_plugin, *partes):
    return os.path.join(pasta_external(), 'plugins', nome_do_plugin, 'files', *partes)
```

```python
# backend/meupfx_dados.py — o único que abre arquivo.
import json
from . import meupfx_caminhos


def linha_do_tempo(projeto):
    caminho = meupfx_caminhos.arquivo_de_plugin('Linha do tempo', projeto, 'atual.json')
    try:
        with open(caminho, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        # O caso NORMAL: aquele plugin nunca rodou neste projeto. Não é erro.
        return None
    except (OSError, json.JSONDecodeError) as e:
        print('[meupfx] nao deu para ler a linha do tempo:', e)
        return None
```

⛔ **Só ler.** Nunca escrever dentro da pasta de outro plugin ou de outra
extensão, e nunca importar o `plugin_boot.py` ou o `extensao_boot.py` dele.

---

## 20 · Exemplo completo, de ponta a ponta

Uma extensão que acrescenta uma categoria em Configurações mostrando quantos
arquivos o projeto aberto tem, com a subpasta configurável. Quatro arquivos.

### `extensao.json`

```json
{
  "nome": "Contador de arquivos",
  "versao": "1.0",
  "prefixo": "cta",
  "tipos": ["1"],
  "acrescenta": [],
  "escreve_fora": []
}
```

### `frontend/index.js`

```js
(function () {
  const EU = document.currentScript.dataset;
  const SLUG = EU.slug;
  const CAMINHO = EU.caminho;
  const CHAVE = 'contador-' + SLUG;      // a chave da categoria, única por extensão

  window['xtMontar_' + SLUG] = function () {
    injetarEstilo();

    registrarCategoriaConfig({
      chave: CHAVE,
      rotulo: 'Contador de arquivos',
      icone: '◇',                        // glifo monocromático, nunca emoji
      resumo: 'quantos arquivos o projeto tem',
      // ⚠️ O programa desvia toda categoria com `deExtensao: true` para o lado
      // Extensões, mesmo se você escrever 'programa' aqui. Escreva o valor certo.
      lado: 'extensoes',
      deExtensao: true,                  // o programa marca a seção como de extensão
      padrao: false,                     // sem "Restaurar padrão": não há o que restaurar
      conteudo: `
        <div class="config-cartao">
          <div class="config-cartao-cabecalho">
            <div class="config-cartao-titulo">Arquivos do projeto</div>
            <p class="config-cartao-dica">Contado quando você abre esta categoria.</p>
          </div>
          <p class="cta-linha" id="cta-resultado">abra um projeto…</p>
        </div>`,
      acoes: '<button class="btn btn-muted" id="cta-recontar">Recontar</button>',
    });

    // Delegado na barra de ações, e não no botão: a barra é do programa e não
    // some; o botão some quando a extensão é desligada.
    const barra = document.getElementById('config-barra-acoes');
    if (barra && !barra._ctaWired) {
      barra._ctaWired = true;
      barra.addEventListener('click', e => {
        if (e.target.closest('#cta-recontar')) contar();
      });
    }

    contar();
  };

  window['xtDesmontar_' + SLUG] = function () {
    // A categoria que VOCÊ registrou é você que desfaz: o programa só tira
    // sozinho a das opções, que foi ele quem criou do `config/tela.json`.
    desregistrarCategoriaConfig(CHAVE);
    // O <style> o programa remove pelo data-xt. O listener da barra fica, mas
    // é inofensivo: o botão que ele procura já não existe. (Se ele fizesse algo
    // pesado, guardar a referência e removê-lo aqui seria obrigatório.)
  };

  function injetarEstilo() {
    if (document.getElementById('cta-estilo')) return;
    const estilo = document.createElement('style');
    estilo.id = 'cta-estilo';
    estilo.dataset.xt = SLUG;
    estilo.textContent = `
      .cta-linha { font-size: 13px; color: var(--text-muted); line-height: 1.6; }
      .cta-linha strong { color: var(--blue); }`;
    document.head.appendChild(estilo);
  }

  async function contar() {
    const alvo = document.getElementById('cta-resultado');
    if (!alvo) return;
    if (!currentProject) { alvo.textContent = 'abra um projeto…'; return; }

    alvo.textContent = 'contando…';
    try {
      const r = await window.pywebview.api.chamar_extensao(CAMINHO, {
        acao: 'contar', projeto: currentProject,
      });
      if (!r || !r.success) {
        alvo.textContent = (r && r.error) || 'não deu para contar';
        return;
      }
      alvo.innerHTML = `<strong>${r.total}</strong> arquivo(s) em `
                     + `<code>${escapeHtml(r.pasta)}</code>.`;
    } catch (e) {
      alvo.textContent = 'a ponte falhou: ' + e;
    }
  }
})();
```

### `backend/extensao.py` — a porta

```python
"""A porta do backend. Lê payload['acao'] e roteia. Só isso."""

from . import cta_acoes


def executar(payload):
    acao = (payload or {}).get('acao')
    if acao == 'contar':
        return cta_acoes.contar(payload)
    return {'success': False, 'error': 'ação desconhecida: %r' % acao}
```

### `backend/cta_acoes.py` — o que a ação faz

```python
import os


def contar(payload):
    # `pasta_projeto` foi acrescentado pelo PROGRAMA, porque o payload trouxe
    # `projeto`. Não monte este caminho à mão.
    raiz = payload.get('pasta_projeto')
    if not raiz or not os.path.isdir(raiz):
        return {'success': False, 'error': 'este projeto não tem pasta de código.'}

    # `preferencias` também é do programa: `config/preferencias.json` já
    # resolvido por cima dos `padrao` do `tela.json`. Sem `{pfx}_config.py`.
    prefs = payload['preferencias']
    alvo = os.path.join(raiz, prefs['subpasta']) if prefs['subpasta'] else raiz
    if not os.path.isdir(alvo):
        return {'success': False, 'error': 'a subpasta "%s" não existe.' % prefs['subpasta']}

    total = 0
    for _, _, arquivos in os.walk(alvo):
        total += len(arquivos)
    return {'success': True, 'total': total, 'pasta': prefs['subpasta'] or '(raiz)'}
```

### `config/tela.json`

```json
{
  "cartoes": [
    { "titulo": "Onde contar",
      "campos": [
        { "chave": "subpasta", "rotulo": "Subpasta (vazio = o projeto inteiro)",
          "tipo": "texto", "padrao": "" }
      ] }
  ]
}
```

O `padrao` de cada campo mora **só aqui**: é o programa que o aplica, e o
backend recebe o resultado em `payload['preferencias']`.

Pronto. Ligue em Configurações › Programa › Extensões e ela aparece no lado
Extensões do trilho, em duas entradas: a categoria que ela registrou, e as
opções que o programa desenhou do `config/tela.json`. Desligue e some tudo, sem
reiniciar e sem apagar nada.

---

## 21 · O ciclo de trabalho (editar e ver)

| O que você mudou | O que fazer |
|---|---|
| `frontend/*.js`, `frontend/*.css` | **desligar e religar** a extensão. O `?t=` traz o arquivo novo |
| `backend/*.py` | **desligar e religar**. O módulo fica carregado enquanto ligada |
| `extensao_boot.py` | idem — o `parar()` é chamado, e o `iniciar()` roda de novo |
| `extensao.json` | **clicar na categoria Extensões** no trilho: ela relê a pasta |
| `config/tela.json` | idem, ou desligar e religar |
| criou/apagou uma pasta de extensão | **clicar na categoria Extensões** |

Nada disso exige reiniciar o programa. **Se exigiu, é bug — no seu
`xtDesmontar`, quase sempre.**

### Onde os erros aparecem

- **Frontend:** o console do DevTools. Toda mensagem da camada começa com
  `[extensoes]` e **nomeia a extensão**.
- **Backend:** o terminal de onde o programa foi lançado (`print`). Mesmo
  prefixo.
- **Manifesto:** na própria linha da extensão, em vermelho, em Configurações.

### Como ver o console

O programa roda em WebView2. Lance-o com a porta de depuração aberta e abra o
endereço no Edge:

```
WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333
```

---

## 22 · Quando não funciona: sintoma → causa

| Sintoma | Causa quase certa |
|---|---|
| **A pasta não aparece na lista** | falta `extensao.json` na raiz — ela virou categoria. Ou você não clicou na categoria Extensões para reler |
| **Aparece, mas o interruptor está cinza** | o manifesto tem erro; a mensagem está na própria linha |
| **`tipo desconhecido: 24`** | você escreveu `[24]` em vez de `["24"]` |
| **Liga, e não acontece nada** | `frontend/index.js` não definiu `window['xtMontar_' + SLUG]`, ou definiu dentro de um `await`. O console diz qual |
| **`o frontend/index.js não definiu window.xtMontar_…`** | idem. Confira que você usou `EU.slug`, e não o nome da pasta |
| **Erro `naoSeiQuem is not defined`** | o irmão que define aquilo não foi injetado, ou foi injetado depois de quem o usa |
| **Editei o `.js` e nada mudou** | você não desligou e religou. O `?t=` só entra na hora da injeção |
| **Editei o `.py` e nada mudou** | idem — o módulo fica carregado enquanto a extensão está ligada |
| **`attempted relative import with no known parent package`** | você usou `import irmao` em vez de `from . import irmao` |
| **`No module named 'meupfx_acoes'`** | idem |
| **Desliguei e o estilo continuou valendo** | faltou `estilo.dataset.xt = SLUG` no `<style>` |
| **Desliguei e a categoria continuou lá** | faltou `desregistrarCategoriaConfig` no `xtDesmontar` |
| **Desliguei e o laço continuou rodando** | `parar()` ausente, ou `time.sleep` em vez de `Event().wait` |
| **Religuei e apareceu duas vezes** | você criou algo no `xtMontar` sem checar se já existia, e sem remover no `xtDesmontar` |
| **A tela do programa ficou toda com a minha cor** | seletor de CSS sem prefixo. Não há isolamento |
| **Uma tela do programa parou de funcionar depois que instalei a minha** | você reusou um nome global. Prefixe tudo (parte 6) |
| **`Extensão desligada.` vindo da ponte** | está desligada mesmo — ou você ligou e o `backend/extensao.py` explodiu ao importar (veja o terminal) |
| **`backend/extensao.py não define executar().`** | a função tem outro nome, ou está dentro de uma classe |
| **`ação desconhecida: None`** | você esqueceu de mandar `acao` no payload |
| **A tela fica em "carregando…" para sempre** | nome de método errado em `window.pywebview.api` — não dá erro, trava |
| **Meu arquivo foi parar na pasta do programa** | caminho relativo no `open()`. O cwd é `Program/Code/backend` (parte 3) |
| **`FileNotFoundError` ao gravar em `files/`** | a pasta não existe. `os.makedirs(..., exist_ok=True)` antes |
| **O programa demorou a abrir** | `iniciar()` com `time.sleep` em vez de `Event().wait` |
| **Meu ícone não aparece (Visual › ícones)** | o nome no `mapa.json` não bate com o do SVG. Ícone que falta vira emoji, e por isso não dá erro |
| **O Editor ficou monocromático** | a extensão da cor do código (Recursos do Editor › cor) está desligada. Sem ela o autoloader não tem para onde apontar, e toda linguagem dá 404 em silêncio — de propósito |
| **Minha marca não aparece no Editor (Marca no código)** | a classe não começa pelo seu prefixo (o console diz), ou você não injetou o `<style data-xt>` com o CSS dela — a marca existe no DOM e é invisível |
| **O `title` da minha marca não aparece no mouse** | não vai aparecer. O `<pre>` tem `pointer-events: none` (parte 15) |
| **Meu preset de Acervo não aparece** | o `nome` dentro do JSON colide com um preset do programa — o console avisa |
| **Declarei o tipo e nada acontece** | o mecanismo daquele tipo ainda não existe (parte 5) |
| **O meu subagente recebe "ferramenta … não disponível"** | o nome não está em `ferramentas` do item, ou o item `ferramenta` não carregou (o aviso está na página da extensão) |
| **O meu trecho de prompt não aparece** | o `alvo` está errado (a página avisa), ou a extensão está desligada; sem `arquivo`, o seu `executar` não respondeu `xt.prompt` com `success` e `texto` (o console diz qual) |

---

## 23 · Antes de dar por pronta

**A promessa de ligar e desligar:**

- [ ] Ligar → desligar → ligar **três vezes seguidas** não deixa `<style>`,
      `<script>`, categoria nem elemento duplicado. (DevTools: procure por
      `[data-xt]` e pelo prefixo dos seus ids.)
- [ ] Desligar devolve a tela ao que era. Nada seu continua funcionando.
- [ ] Se ela tem `extensao_boot.py`, o laço **para de verdade** em menos de
      5 segundos, e usa `Event().wait` em vez de `sleep`.
- [ ] Desligar não apagou nada da pasta dela.

**A promessa da pasta própria:**

- [ ] Todo `open()` usa caminho absoluto montado a partir de `__file__`.
- [ ] Toda gravação chama `os.makedirs(..., exist_ok=True)` antes.
- [ ] O que o usuário escolhe está em `config/`; o que ela gera está em `files/`.
- [ ] Se ela grava fora, os caminhos estão em `escreve_fora`.
- [ ] Se ela lê fora da pasta de trabalho do projeto, as pastas estão em `le_fora`.
- [ ] Se ela declara `ferramenta`, trecho de prompt sem `arquivo` ou subagente
      com `envelope`, o `backend/extensao.py` responde `xt.ferramenta`,
      `xt.prompt` e `xt.envelope` — e nenhuma ação sua começa por `xt.`.

**O resto:**

- [ ] Nenhum seletor de CSS seu casa com algo do programa.
- [ ] Nenhum nome global seu existia antes — confira com
      `grep -rn "meuNome" Program/Code/frontend`.
- [ ] Nenhuma cor em hexadecimal; tudo em `var(--…)`.
- [ ] Todo texto vindo do usuário passa por `escapeHtml` antes do `innerHTML`.
- [ ] Nenhum `alert`, `confirm`, `prompt` ou `scrollIntoView`.
- [ ] Nenhum `from modulos... import` do backend do programa.
- [ ] Se ela tem `config/tela.json`, os `padrao` de lá batem com os do
      `{pfx}_config.py`.
- [ ] O `LEIA-ME.md` diz o que ela faz e o que ela mexe.
- [ ] O `extensao.json` tem `descricao` — é o que a página dela mostra em
      Configurações › Extensões (parte 13). Abra a página e leia: o que
      está escrito ali é o que o programa sabe da sua extensão.
- [ ] Se ela declara `acesso-rapido.comandos`: cada item tem `id` estável,
      `ativo` é uma função, e a tecla sugerida **dispara logo depois de
      ligar**, sem abrir a barra (parte 15).
- [ ] Nenhum arquivo passa de 500 linhas.
- [ ] Toda continuação depois de um `await` confere a flag `montada`, e todo
      arquivo de encaixe/evento/consulta confere por `typeof` a global da
      casca antes de chamá-la (parte 2).
- [ ] Nenhum `{pfx}_config.py` numa extensão sem `extensao_boot.py` — as
      opções vêm em `payload['preferencias']` (parte 13).

---

## O gabarito

`Program/External/extensions/Extensão de teste/` é a extensão mais simples que
exercita a camada inteira: injeta um estilo, tem uma tela própria (a sub-aba
dela em Configurações, pelo recurso Tela), fala com o próprio backend pela ponte, tem estado que sobrevive
entre chamadas, tem `config/tela.json`, marca um trecho no Editor pelo ponto
`editor.decorador` — e desfaz tudo ao ser desligada. Copie a pasta e comece
dali; o `LEIA-ME.md` dela diz qual peça exercita qual parte deste contrato.

⚠️ Ela foi **recriada em 04/09/2026**: a pasta que este contrato descrevia tinha
sumido do disco em algum momento, e por um tempo esta seção apontou para nada.
Se ela sumir de novo, o que está escrito aqui continua sendo a especificação
dela.

### As outras treze que vêm com o programa

Não são exemplos didáticos — são as extensões de verdade, e servem de referência
justamente por isso. Duas delas são o que **antes** morava dentro do programa:

| Extensão | Tipos | O que ela mostra |
|---|---|---|
| `Ícones de arquivo` | 4 | conteúdo puro (Visual › ícones), sem uma linha de código |
| `Cor do código` | 4 | conteúdo puro (Recursos do Editor › cor) apontando uma **pasta** |
| `Completar enquanto digita` | 4 | as sugestões ao digitar, num arquivo de 50 linhas |
| `Formatar ao salvar` | 3 | guardiã que reescreve, tela de configuração, e um comando que formata **sem gravar** pela porta `edArquivoAberto(...).substituirTexto` |
| `Rodar o que está selecionado` | 2, 3 | dois encaixes de menu, backend com ações, e dois comandos com tecla que valem **dentro do código** (`emCampo`, `onde: 'tab-editor'`) |
| `Servidor local com recarga` | 2, 3 | `extensao_boot.py` com `parar()`, o disco como barramento, e dois comandos cinza enquanto o servidor não está no ar |
| `Tingir a janela` | 2, 3 | encaixe + evento + `files/` por projeto, e o comando que abre a modal |
| `Erro na própria linha` · `Quem quebra se eu renomear` | 2, 3 | decorador com **fonte cara**: cache dentro do gancho, ponte fora dele — e uma modal no menu da aba **e no Acesso rápido**, com `edArquivoAberto(...).irParaLinha` |
| `CSV colorido por coluna` · `Glossário no código` · `Prévia de imagem` | 2 (+3) | decorador **sem ponte**, que responde do que tem em memória; as duas últimas também põem uma modal no menu da aba e no Acesso rápido |
| `Subagentes normativos` | 4 | o contrato dos subagentes inteiro, sem frontend: quatro subagentes com `ferramentas`, `envelope`, `selo_fonte`, `cor` e `antes`; uma ferramenta própria **emprestada** a um subagente do programa; seis trechos de prompt; `le_fora` — o que antes morava no programa |

Todas as catorze têm `descricao` no manifesto — abra Configurações › Extensões e
compare a página de cada uma com o manifesto dela: é a leitura mais rápida do
que a parte 13 promete.

## Onde mais olhar

| Arquivo | O que tem |
|---|---|
| `../Plugins/A API do programa.md` | os métodos de `window.pywebview.api`, um a um |
| `../Plugins/Como criar plugins.md` | o irmão deste, para quando um plugin basta |
| `Program/Code/frontend/modulos/extensoes/` | a camada, do lado da tela |
| `Program/Code/backend/modulos/extensoes/` | a camada, do lado do Python |
| `Saída das skills/Padrões de interface/` | os componentes e as convenções visuais do programa |
