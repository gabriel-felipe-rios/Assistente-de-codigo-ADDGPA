# 40 Como medir

Como medir de verdade. Abra antes de otimizar e para checar taxa e fluidez no aparelho alvo.

## DevTools

- **Rendering:** *Frame Rendering Stats*, *Paint flashing*, *Layer borders* (developer.chrome.com).
- **Performance:** o quadro e o insight "Forced Reflow".

## Long Animation Frames

Quadros > 50 ms. Chrome/Edge 123+, **sem Firefox/Safari**. Detecte antes:

```js
if (PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) {
  new PerformanceObserver(l => console.log(l.getEntries()))
    .observe({ type: 'long-animation-frame', buffered: true });
}
```

## FPS observado

Funciona em qualquer navegador e é o **único** sinal de Low Power Mode do iOS (→ `34`). Conte quadros por segundo com o `timestamp` do rAF e mostre a **proporção de quadros perdidos** (`dt > 1,5 × esperado`), não só o FPS médio (web.dev `smoothness`).

```js
let ultimo = 0, total = 0, perdidos = 0;
const esperado = 1000 / 60;
function medir(agora) {
  if (ultimo) { total++; if (agora - ultimo > 1.5 * esperado) perdidos++; }
  ultimo = agora;
  requestAnimationFrame(medir);
}
requestAnimationFrame(medir);
// proporção = perdidos / total
```

## Regras

- **Meça no aparelho alvo:** números de blog são ordem de grandeza (→ `05`, `21`).
- **Em webview embutida:** medir no navegador de desenvolvimento pode não valer no hospedeiro (o rAF é limitado sem foco → `32`). Meça dentro dele, com o foco como estará em uso.
- **Antes de otimizar, ache o gargalo** (JS, layout, paint ou composição): corrigir o que não é o gargalo não muda nada.

*Porquê:* sem medir, a otimização é palpite.

→ Relacionados: `04`, `32`, `34`, `38`
