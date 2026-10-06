# Erro na própria linha

A linha com erro de sintaxe fica com o fundo rosado. O sublinhado ondulado do
programa marca o **trecho**; isto marca a **linha**, que é o que se enxerga sem
procurar.

Inspirada no *Error Lens* do VS Code. É uma versão própria, não um porte.

## ⚠️ Ela é pouco, e é bom saber por quê

A fonte é a **mesma** do sublinhado que o programa já faz: o Tree-sitter, por
`editor_erros_de_sintaxe`. Na forma atual do ponto `editor.decorador`, a única
coisa que uma extensão pode mudar é a **aparência do trecho**.

O que faz o Error Lens valer a pena é a **mensagem escrita ao lado da linha** —
e isso é outra forma do ponto (`editor.margem`), que ainda não existe. O
`title` da marca é gravado, mas **nunca aparece no mouse**: o `<pre>` do Editor
tem `pointer-events: none`, e todo clique e todo `hover` vão para o
`<textarea>` por cima.

E o Tree-sitter não tem mensagem — só "erro de sintaxe" e o trecho.

## Como ela busca os erros

O gancho do decorador roda depois de **cada** pintura, a cada 120 ms de
digitação, e tem 150 ms de teto. Um reparse do arquivo inteiro não cabe nisso.
Então:

1. dentro do gancho, ela devolve o que tem em **cache** — `[]` na primeira vez;
2. fora do gancho, com um debounce de 400 ms (o mesmo do lint do programa), vai
   ao Python;
3. quando a resposta volta, chama `xtPedirDecoracao()` e a marca aparece.

⚠️ **Só as 13 extensões que o Tree-sitter do programa cobre.** Fora delas, a
resposta é lista vazia — e isso é o normal, não um erro.

## Opções

Em **Configurações › Extensões › Erro na própria linha**: a **cor** do fundo (um
token do tema, certo nos cinco temas) e a **intensidade** (4 a 40 %). Valem na
hora, ao salvar.

## A lista de erros, com "ir para a linha"

Clique direito na aba do arquivo → **Erros de sintaxe (N)…**. Abre a lista com
a mensagem de cada erro e um botão que leva até a linha. É AQUI que a mensagem
aparece: na marca ela nunca aparece, porque o `<pre>` do Editor tem
`pointer-events: none` e o `title` não sobe ao mouse.

## No Acesso rápido

**Erros de sintaxe deste arquivo…** — a mesma lista do menu da aba, para o
arquivo na frente do Editor.

## O que ela mexe

**Nada.** Sem backend, sem `files/`, sem `config/`. Um `<style>` no `<head>` e
as marcas no código, que o programa desembrulha ao desligar.

## O prefixo

`erl`: `.erl-linha`, `erl-estilo`, `erlCache`, `erlTalvezPedir`.

(O prefixo óbvio seria `err`, e ele já aparece no programa — `errBox`, em
`modal-padrao.js`.)
