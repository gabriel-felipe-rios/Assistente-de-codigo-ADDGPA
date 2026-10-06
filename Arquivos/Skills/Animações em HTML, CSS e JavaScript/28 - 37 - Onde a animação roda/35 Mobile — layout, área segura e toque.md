# 35 Mobile — layout, área segura e toque

Layout, versão e transparência em webview mobile. Abra ao adaptar a animação para celular ou tablet.

## Área segura

`viewport-fit=cover` faz o layout ocupar a tela toda; então use `env(safe-area-inset-*)` com `max()` nos paddings (WebKit, artigo sobre Safari; não fala do WKWebView):

```css
.topo { padding-top: max(16px, env(safe-area-inset-top)); }
```

**Android WebView** repassa `displayCutout()`/`systemBars()` como `safe-area-inset-*`: do M136 só em WebView em tela cheia, do M144 em todos; antes disso o valor é 0 e plugins (Capacitor) aplicam padding nativo. Redimensionamento da viewport visual pelo teclado (IME) a partir do M139.

## Barra de endereço e teclado

Use `dvh` (acompanha a barra de endereço). O teclado virtual não altera `dvh`: use `visualViewport` (→ `28`).

## Toque

- `@media (hover: none)`: nada essencial só no hover.
- `touch-action` (`none`, `pan-y`, `manipulation`) no elemento interativo; `none` prejudica zoom (→ `28`).
- O `:hover` gruda em toque (→ `16`).
- Alvo mínimo 44×44 px *(convenção)*; feedback ≤ 100 ms; reaja ao `pointerdown`, não ao `click`.

## Versão

O WKWebView é parte do iOS e só atualiza com o sistema. No Android o WebView é *evergreen*, mas a versão varia por aparelho: **detecte recurso, não versão**. "Capacitor exige Chrome 60+" pode estar desatualizado → *testar*.

## Transparência em webview mobile

iOS combina `isOpaque = false` e `backgroundColor = .clear` (e o do scrollView). No React Native, `backgroundColor: 'transparent'` costuma falhar no Android e `androidLayerType="hardware"` é problemático. *Testar no hospedeiro real.*

## Recursos e suporte

`linear()` Baseline desde dez/2023; scroll-driven no Safari 26.0 (set/2025), versão em *thread* na 26.4, Firefox atrás de flag; View Transitions mesmo documento no Safari 18.0, entre documentos no 18.2; `content-visibility: auto` Baseline (Safari 18+). No Android WebView depende do Chromium. **Sempre com reserva** (→ `01`, `39`).

*Porquê:* mobile tem entalhe, teclado e toque, e a versão do motor não depende de você.

→ Relacionados: `01`, `16`, `28`, `34`, `39`
