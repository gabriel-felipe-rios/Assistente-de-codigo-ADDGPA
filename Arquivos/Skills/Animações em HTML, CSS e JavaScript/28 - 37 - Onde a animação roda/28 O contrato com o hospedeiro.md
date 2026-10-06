# 28 O contrato com o hospedeiro

O arquivo central desta faixa. Esta skill é **genérica quanto ao hospedeiro**: serve onde HTML+CSS+JS rodarem (janela própria, janela integrada a um programa, site, app mobile). Abra antes de qualquer arquivo `29`–`37`.

## A regra

A animação **lê** do hospedeiro e **nunca assume** `window` inteira, fundo opaco nem `:hover`.

| Lê | Nunca assume |
|---|---|
| tamanho (`visualViewport`, `ResizeObserver`, container queries) | que a janela é a tela toda |
| `devicePixelRatio` | dpr = 1 ou fixo |
| visibilidade (`visibilitychange`, `IntersectionObserver`) | que está sempre visível |
| preferências (`prefers-reduced-motion`, `hover`, `pointer`) | mouse, `:hover`, movimento liberado |
| fundo transparente pedido ao host | fundo opaco |

## Tamanho

- `visualViewport` dá a área realmente visível (zoom de pinça, teclado); em `<iframe>` coincide com a viewport de layout.
- `svh/lvh/dvh` (Chrome 108, Firefox 101, Safari 15.4): `dvh` acompanha a barra de endereço com *throttling*; o teclado virtual **não** as altera.
- **Container queries** (`container-type: inline-size`, `@container`, `cqi`) deixam o componente responder ao contêiner, não à janela: servem a widgets e iframes.
- `ResizeObserver` (Baseline 2020) para dimensionar canvas. Cuidado com o erro "ResizeObserver loop completed with undelivered notifications".

## Densidade de pixels

`devicePixelRatio` muda com o **zoom de página**, não com o zoom de pinça. Reobserve com `matchMedia('(resolution: Xdppx)')`; canvas = tamanho CSS × dpr + `ctx.scale`.

**Limite de canvas no iOS Safari:** ~16.777.216 px por canvas e ~384 MB de memória total (v15; varia), segundo WebKit bug 195325. Limite o dpr e o tamanho:

```js
const dpr = Math.min(devicePixelRatio, 2);
canvas.width = cssW * dpr; canvas.height = cssH * dpr; ctx.scale(dpr, dpr);
```

## Fundo transparente

É configuração do **hospedeiro**, não do CSS. O CSS só precisa de `html, body { background: transparent }`; o resto é do host (→ `29`).

## Visibilidade

`visibilitychange` / `document.hidden`. Esconder um iframe com `display: none` **não** dispara `visibilitychange`: combine com `IntersectionObserver` (Baseline 2019; em iframe cross-origin o retângulo é recortado ao frame). Em aba oculta o Chrome checa timers 1×/s e 1×/min após 5 min: **não use `setTimeout` como plano B** (→ `03`).

## Preferências

- `prefers-reduced-motion` (Baseline 2020) mapeia para iOS (Ajustes › Acessibilidade › Movimento), Android 9+ (Remover animações), macOS, Windows e Linux (→ `41`).
- `prefers-reduced-transparency` é experimental e **não** é Baseline: refinamento, nunca requisito.
- **`hover: none`** (Baseline 2018): o input primário não pode pairar. Não confie em `:hover` como única interação. Vale também `any-hover` e `pointer: coarse`.
- **Pointer Events:** o navegador dispara `pointercancel` ao assumir um gesto de pan/zoom; declare `touch-action` (`none`, `pan-y`, `manipulation`) no elemento interativo. `none` prejudica quem precisa de zoom.
- `prefers-color-scheme` e `prefers-contrast`: *testar* (não confirmados).

## Ponte com o host

O que o CSS/JS não sabe (foco da janela, monitor, modo de economia de energia) o host repassa por mensagem (→ `32`, `34`).

## Hospedeiro → arquivos

| Hospedeiro | Arquivos |
|---|---|
| janela própria | `29`–`31` |
| programa com webview embutida | `32` |
| site ou iframe | `33` |
| mobile | `34`, `35` |
| overlay de transmissão | `37` |
| ativos com alfa | `36` |

*Porquê:* um só contrato serve a qualquer hospedeiro; os runtimes dos próximos arquivos são apenas exemplos.

→ Relacionados: `03`, `29`, `32`, `41`
