# A biblioteca desta extensão

Falta um arquivo aqui: **`beautify.js`**.

## Por que ele não veio junto

O programa é 100% local e não baixa nada sozinho. O `js-beautify` é software de
terceiro (MIT) e precisa ser posto aqui à mão, uma vez.

## O que fazer

1. Baixe a build de navegador do [js-beautify](https://github.com/beautifier/js-beautify)
   — o arquivo único que expõe `js_beautify`, `css_beautify` e `html_beautify`
   no `window` (nas distribuições ele costuma se chamar `beautify.js` ou
   `beautify-all.js`).
2. Salve-o **nesta pasta**, com o nome exato `beautify.js`.
3. Desligue e religue a extensão em Configurações › Programa › Extensões.

⚠️ **Cópia própria, aqui dentro** — nunca em `Program/External/libraries/`.
Aquela pasta é do programa, o que tem lá muda, e uma extensão que depende dela
deixa de ser uma pasta que se pode mover, copiar ou apagar inteira
(Arquitetura modular › Exceções).

## Enquanto ele não estiver aqui

A extensão **continua funcionando**, só que apenas para `.json` — o único
formatador que não precisa de biblioteca nenhuma (`JSON.parse` +
`JSON.stringify`). `.js`, `.css` e `.html` passam intocados, e o console avisa
uma vez, ao ligar.
