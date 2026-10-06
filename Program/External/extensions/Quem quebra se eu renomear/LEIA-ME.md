# Quem quebra se eu renomear

O nome de cada função definida **neste** arquivo que **outros** arquivos usam
aparece com fundo âmbar. Renomeou um deles e salvou: um aviso diz quais
arquivos você acabou de quebrar.

## Por que isso importa aqui

A fonte é o **índice de identificadores** do programa — o mesmo que o "Quem usa
este arquivo" e o Ctrl+clique usam. Ele casa **menção de identificador** entre
arquivos, e não `import`:

- função global chamada de outro arquivo do frontend;
- a ponte `window.pywebview.api.X` ligada ao `def X` do Python;
- um id declarado no HTML e lido no JS.

**Renomear qualquer um desses não gera erro nenhum.** A tela só fica vazia, ou
o botão para de responder, e o defeito aparece semanas depois. É exatamente
isso que a marca âmbar antecipa.

⚠️ O índice só guarda nome usado em **mais de um arquivo** — que é justamente o
que interessa aqui.

## As duas peças

| Peça | Quando | O que faz |
|---|---|---|
| a marca | ao abrir o arquivo | fundo âmbar no nome de cada definição que outros usam |
| o aviso | ao salvar | `showToast` dizendo qual nome sumiu e quem o usava |

⚠️ **O aviso é um observador, não uma guardiã.** Ela **nunca barra o Ctrl+S** —
o arquivo grava normalmente. Renomear é legítimo; o que faltava era saber a
consequência na hora.

## O recorte da versão 1

| Faz | Não faz |
|---|---|
| definição no formato comum de Python e JavaScript (regex) | análise de AST |
| avisa quais arquivos usavam | lista clicável |
| | "renomear em todos os lugares" |

⚠️ **Regex, não AST.** `def X(`, `class X`, `function X(`, `const X = (…) =>`.
Uma definição aninhada em três níveis passa batido. Uma AST por linguagem seria
outro projeto — e o custo apareceria dentro do gancho, que tem 150 ms.

⚠️ **Sem índice, nada acontece.** Projeto que nunca teve a indexação rodada:
`get_relacoes` devolve vazio, e a extensão fica quieta. É o estado normal, não
um erro.

## Como ela é barata

As relações são pedidas ao Python **quando o arquivo aberto muda** — e não a
cada tecla. Faz sentido: o índice é do que está no disco, e digitar não o muda.
O gancho do decorador só roda uma varredura de regex sobre as linhas.

## Opções

Em **Configurações › Extensões › Quem quebra se eu renomear**: as duas peças
podem ser desligadas separadamente (a marca no Editor, o aviso ao salvar), e a
marca tem cor e intensidade. Valem na hora, ao salvar.

## A lista de quem usa cada definição

Clique direito na aba do arquivo → **Quem usa as definições deste arquivo…**.
Para cada função ou classe definida aqui que outro arquivo usa, a lista dos
arquivos — cada um abre no Editor com um clique — e "ir para a linha" da
definição. É o que a marca âmbar resume.

## No Acesso rápido

**Quem usa as definições deste arquivo…** — o mesmo item do menu da aba, para
o arquivo na frente do Editor.

## O que ela mexe

**Nada.** Sem `files/`, sem `config/`, sem backend. `escreve_fora` está vazio.

## O prefixo

`ren`: `.ren-usada`, `ren-estilo`, `renCache`, `renDefinicoes`,
`renTalvezPedir`, `renDefinicoesDoTexto`.
