# Formatar ao salvar

Ctrl+S e o arquivo sai formatado. Sem diálogo, sem pergunta.

## O que ela faz

É uma **guardiã** de `editor.vai_salvar` (tipo 17): roda antes de o Editor
gravar e devolve o texto formatado. O programa grava o que ela devolveu e
atualiza a tela junto — a extensão não toca no Editor.

| Linguagem | Como |
|---|---|
| `.json` | `JSON.parse` + `JSON.stringify` — sem biblioteca nenhuma |
| `.js` `.jsx` `.ts` `.mjs` `.cjs` | `js-beautify` (ver abaixo) |
| `.css` `.scss` `.less` | `js-beautify` |
| `.html` `.htm` | `js-beautify` |
| `.py` e todo o resto | **passa intocado** |

⚠️ **Falta um arquivo para os três últimos funcionarem.** Veja
`frontend/lib/LEIA-ME.md` — é um `beautify.js` a pôr na pasta, uma vez. Sem
ele, a extensão formata só `.json` e avisa uma vez no console ao ligar.

## Limpeza em qualquer arquivo de texto

Duas coisas valem para **todo** arquivo, sem biblioteca: tirar os espaços no
fim das linhas (Markdown fica de fora — dois espaços antes da quebra são uma
quebra forçada) e garantir a quebra de linha no fim do arquivo. As duas são
opções, ligadas por padrão. É o que faz a extensão servir num `.py` ou num
`.txt`, e não só nas quatro famílias com formatador.

## Por que Python está de fora

Formatar Python exige `black` ou `autopep8` instalados no Python do programa, e
isso não está garantido. E a ida ao backend disputaria os **1,5 s** que a
guardiã tem antes de o programa desistir de esperar.

## Ela nunca barra o Ctrl+S

`barrar` existe no mecanismo e esta extensão não usa. Um formatador que
impedisse o salvamento seria a pior extensão possível: o usuário perderia o que
digitou por causa de um arquivo torto.

Consequências disso, todas de propósito:

- um `.json` **inválido** é gravado como está (o `JSON.parse` lança, e guardiã
  que lança não barra). O erro fica no console;
- um arquivo acima do teto de tamanho é gravado sem formatar;
- se a formatação passar de 1,5 s, o programa grava sem formatar e avisa no
  console — o usuário não vê nada.

## Onde se configura

Configurações › Extensões › **Formatar ao salvar**: quais linguagens, quantos
espaços de recuo, e o teto de tamanho.

⚠️ A extensão lê as preferências **uma vez, ao ligar** — nunca dentro da
guardiã, que não tem orçamento para a ponte. Depois de Salvar, **desligue e
religue** para o novo valor valer.

## No Acesso rápido

**Formatar o arquivo aberto agora** (`Ctrl+Alt+F`): o mesmo formatador da
guardiã, aplicado na tela e sem gravar — dá para ver o resultado antes do
Ctrl+S, e o Ctrl+Z desfaz. Vale com o cursor dentro do código, só com a aba
Editor na tela. A tecla se muda na página da extensão, em Configurações ›
Extensões.

## Formatar o arquivo — pelo programa

Desde 23/09/2026 ela também responde à **formatação do Editor** (Recursos do
Editor › formatação): o comando do programa **Formatar o arquivo**, no Acesso
rápido, pergunta às extensões e esta responde para JavaScript, JSX, TypeScript,
JSON, CSS, SCSS, LESS e HTML (`markup`, que é como o Editor chama o HTML). É o
mesmo `fmtFormatar` da guardiã, em `frontend/consultas/formatar.js`, e as
mesmas opções valem.

Diferenças para a guardiã: só responde onde há **formatador** — a limpeza de
"qualquer texto" (espaço no fim, quebra final) continua só no Ctrl+S — e
responde "não sei" com a biblioteca ainda carregando ou com a linguagem
desligada nas opções. A guardiã e o comando **Formatar o arquivo aberto
agora** continuam como estavam.

## O que ela mexe

**Nada fora da própria pasta** — `escreve_fora` está vazio.

Ela **reescreve o arquivo que você está salvando**, que é justamente o que ela
promete: o texto que vai ao disco é o que ela devolveu. O Editor adota o mesmo
texto na tela, então a aba não fica "limpa" mostrando conteúdo velho.

Na tela ela acrescenta, enquanto ligada: um `<script id="fmt-lib">` no `<head>`
(a biblioteca) e as opções dela no lado Extensões de Configurações. Desligar
tira os dois e a assinatura do evento, na hora.

## O prefixo

`fmt`: `fmt-lib`, `fmtPrefs`, `fmtPronta`, `fmtFormatar`, `fmtFamiliaDe`.

## Sem `backend/`

Desde 05/09/2026 esta extensão não tem `backend/` nenhum: o único trabalho
dele era reler `config/preferencias.json`, e o programa já faz isso — o
`frontend/index.js` pede as opções a `preferencias_da_extensao`, uma vez, ao
ligar. Os padrões moram só no `config/tela.json`.
