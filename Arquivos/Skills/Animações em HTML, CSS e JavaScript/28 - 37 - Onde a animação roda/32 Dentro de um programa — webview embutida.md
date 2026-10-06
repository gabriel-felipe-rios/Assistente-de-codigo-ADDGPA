# 32 Dentro de um programa — webview embutida

A animação como parte de um programa. Abra quando o HTML roda dentro de uma webview de um app.

*Exemplos — o hospedeiro do seu projeto pode ser outro; o contrato é o do `28`.*

## GPU

O WebView2 usa GPU por padrão. A Microsoft manda **não** desligar (`disable-gpu`) salvo para depurar, e recomenda **CSS em vez de JS** para animar (docs `webview2/concepts/performance`).

## Ocultar e pausar

- WebView2: `CoreWebView2Controller.IsVisible = false` para a renderização (marque explicitamente; o `SW_HIDE` do hospedeiro sozinho pode não suspender). `TrySuspendAsync()` pausa timers e animações e exige `IsVisible = false`. `MemoryUsageTargetLevel = Low` reduz memória.
- Electron: `backgroundThrottling: false` mantém `visibilityState` "visible" mesmo minimizada, oculta ou encoberta.

## Foco

**O rAF é limitado quando o app não tem foco** no WebView2, e a degradação pode aparecer minutos depois; há pedido aberto de opção para desligar (WebView2Feedback 1172). **Medir** (→ `40`).

## Ponte JS ↔ programa

- WebView2: `postMessage`/`WebMessageReceived` são preferíveis a *host objects* (marshalling COM, lentos para chamada frequente, retêm memória). Mensagens em lote reduzem o custo de IPC. Vários WebView2 → reutilize um único `CoreWebView2Environment`.
- pywebview: `js_api` expõe Python em `window.pywebview.api.<método>()` (promises); `evaluate_js()`/`run_js()` no sentido oposto.

## Versão

O Runtime *Evergreen* do WebView2 se atualiza sozinho, mas um administrador pode travar a versão: **detecte recurso** e degrade (→ `39`).

```js
const temAnimate = 'animate' in Element.prototype;
const temLinear = CSS.supports('animation-timing-function', 'linear(0, 1)');
const entradas = PerformanceObserver.supportedEntryTypes;
```

"Chrome 115+ = WebView2 atual" é inferência; a versão instalada na máquina do usuário → *testar no hospedeiro real*.

## Outros pontos

- **Electron offscreen:** até 240 fps sem textura compartilhada, quadros só quando há atividade, sempre frameless.
- **Taxa:** WebView2/Electron/Qt chegarem a 120/144 Hz em monitor de taxa alta → *testar no hospedeiro real*. Use delta time (→ `03`).
- **WebGPU dentro do WebView2:** *testar na sua versão*.

- **Não faça:** desligar a GPU para "resolver" um bug; animar por JS o que o CSS faz; chamar host objects a cada quadro.

*Porquê:* a animação fica dentro de um programa que controla foco, visibilidade e versão do motor.

→ Relacionados: `03`, `28`, `39`, `40`
