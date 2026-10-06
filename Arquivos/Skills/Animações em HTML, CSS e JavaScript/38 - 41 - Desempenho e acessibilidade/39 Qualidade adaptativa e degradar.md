# 39 Qualidade adaptativa e degradar

Detectar, medir e degradar. Abra quando a animação vai rodar em aparelhos ou motores que você não controla.

## Detecte recurso, não versão

`CSS.supports(prop, valor)`, `CSS.supports("selector(:has(a))")` e `@supports` são a detecção declarativa (Baseline 2015). `'animate' in Element.prototype` e `CSS.supports('animation-timeline: scroll()')` são padrão comum, **não verificado → testar na sua versão**. Use `PerformanceObserver.supportedEntryTypes` para observadores. O WebView2 acompanha o Chromium do Edge e um administrador pode travar a versão (→ `32`).

## Qualidade adaptativa

Meça `dt` numa média móvel (ex.: **mediana de 30 quadros**) e escalone: **alto** (partículas, blur, `dpr` cheio) → **médio → baixo → estático**. O sinal vem da medição (Popmotion); os limiares são opinião de ofício: parâmetros ajustáveis.

## Histerese obrigatória

**Sem histerese o nível oscila.** Desça rápido (poucos quadros ruins), suba devagar (vários segundos bons).

```js
let nivel = 3, ruins = 0, bons = 0;   // 3 alto · 2 médio · 1 baixo · 0 estático
function avaliar(dtMediana) {
  if (dtMediana > 1000 / 45) { ruins++; bons = 0; } else { bons++; ruins = 0; }
  if (ruins >= 20 && nivel > 0) { nivel--; ruins = 0; }   // desce rápido
  if (bons >= 300 && nivel < 3) { nivel++; bons = 0; }    // sobe devagar (~5 s a 60 Hz)
}
```

## Outras regras

- Ao ver ~33 ms constantes, assuma 30 fps como teto em vez de tentar "recuperar" 60 (→ `04`). Não há API para escolher a taxa do rAF (→ `03`): limite por delta.
- **O que cortar primeiro** *(convenção de ofício)*: partículas (N menor) → blur/glow → `dpr` (máx. 2, depois 1) → ambiente animado → tudo estático. Herói e feedback de UI **nunca** são cortados.
- **`prefers-reduced-motion` é estado, não binário:** respeite o valor, escute `change` em `matchMedia`, e **substitua por dissolver ou estático** em vez de só desligar (→ `41`).
- **Reserva por recurso novo:** scroll-driven, `sibling-index()`, View Transitions, `linear()` (→ `01`).
- **Aparelho fraco:** `navigator.deviceMemory` não é confiável (→ `34`); use FPS medido.

*Porquê:* a mesma animação roda em aparelhos muito diferentes.

→ Relacionados: `01`, `04`, `34`, `41`
