# Cor do código

As **gramáticas do Prism** — 297 linguagens. É o que faz o código da aba Editor
aparecer colorido em vez de monocromático.

Extensão de **dado puro**: não tem `frontend/`, não tem `backend/`, não roda
código nenhum. Só o manifesto e a pasta `components/`.

## Sai a gramática, nunca o motor

⚠️ **O `prism-core.js` NÃO está aqui, e não pode estar.** Ele é o motor — 37 KB
— e ficou no programa, em `Program/External/libraries/prism-master/`, junto do
autoloader. Duas razões:

- desligar esta extensão tem de deixar o Editor **monocromático**, não **cego**:
  a fatia por blocos que segura o desempenho da aba (`_edPinFatiar`, em
  `frontend/modulos/editor-pintura.js`) usa `Prism.util.encode`,
  `Prism.tokenize` e `Prism.Token.stringify`, e isso é a máquina de desempenho
  do Editor, não coloração;
- dois motores carregados brigariam pelo `window.Prism`.

É o que o VS Code faz: uma extensão de linguagem entrega a gramática e nunca o
tokenizador.

## Como o programa a consome

O autoloader do Prism guarda a pasta das gramáticas numa variável trocável em
tempo de execução, `Prism.plugins.autoloader.languages_path`. Ligar esta
extensão aponta essa variável para a `components/` daqui; desligar a esvazia e
esquece o que já tinha sido carregado. Quem faz isso é
`xtAplicarGramaticasEscolhidas`, em `frontend/modulos/editor-pintura.js`.

⚠️ **Versão 1: a primeira extensão de tipo 11 ligada vale.** Duas ao mesmo
tempo exigiriam um autoloader próprio.

## O que NÃO veio junto, e por quê

| Ficou de fora | Motivo |
|---|---|
| `components/prism-core.js` | é o motor — ver acima |
| `plugins/` | nenhum é usado. `line-numbers` cria um `<span>` por linha e quebra o alinhamento com o `textarea`; `match-braces` depende de mouse sobre o `<pre>`, que tem `pointer-events: none` |
| `themes/` | as cores dos tokens saem do tema do programa, em `frontend/estilos/editor-cores.css` — nenhum tema do Prism era lido |
| `components.json`, `dependencies.js`, `tokens.html`, `.jsdoc.json` | são do build do Prism; nada os lê em tempo de execução. O mapa de dependência entre gramáticas (`jsx` puxa `javascript`) o autoloader já traz dentro de si |
| os `.min.js` | a distribuição baixada não os tem, e por isso o programa força `use_minified = false` |

## De onde veio

[Prism](https://github.com/PrismJS/prism), de Lea Verou — licença MIT, no
arquivo `LICENSE`.

## O que ela mexe

**Nada.** `escreve_fora` está vazio e é verdade — ela não grava arquivo nenhum
e não tem código para rodar.

## Se a cor sumir

| Sintoma | Causa |
|---|---|
| tudo monocromático | a extensão está desligada. Configurações › Programa › Extensões |
| uma linguagem só sem cor | o `prism-{nome}.js` daquela linguagem não está em `components/`, ou o Editor não mapeia aquela extensão de arquivo para um nome de gramática (`_ED_LINGUAGENS`, em `backend/modulos/editor.py`) |
| arquivo grande sem cor, com um botão "Colorir mesmo assim" | é o teto de tamanho do Editor, e não tem relação com esta extensão |
