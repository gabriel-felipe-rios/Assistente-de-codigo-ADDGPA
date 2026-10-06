# 01 Que animação e que técnica

Árvore de decisão: qual técnica usar para esta animação. Abra antes de escrever qualquer código de animação.

## Pergunta → técnica

| Pergunta | Técnica | Porquê |
|---|---|---|
| Estado A → estado B, hover, entrada/saída, loop simples | **CSS** (`transition`, `@keyframes`) | Mais simples e mais otimizável pelo navegador; `transform` pode rodar fora da thread principal (MDN) |
| Preciso controlar por JS (pausar, inverter, mudar velocidade, esperar terminar) | **Web Animations API** (`element.animate()`) | Mesmo modelo do CSS, com `pause()`, `reverse()`, `updatePlaybackRate()`, a promessa `finished`, `document.getAnimations()`. Para fixar o estado final use `commitStyles()`, melhor que `fill: forwards` |
| Física, lógica por quadro, algo que CSS/WAAPI não expressam, canvas | **`requestAnimationFrame`** com delta time (→ `03`) | É *one-shot* (reagende a cada quadro) e pausa em aba oculta |
| Ilustração vetorial, traçado que se desenha, morph, movimento em caminho | **SVG** (→ `18`) | SMIL (`<animate>`, `<animateTransform>`, `<animateMotion>`) é Baseline "widely available" desde jan/2020 e é o único que anima atributos SVG (`cx`, `d`) e movimento ao longo de path de forma declarativa |
| Centenas ou milhares de objetos, partículas, sprites | **Canvas 2D** (→ `19`, `21`) | OffscreenCanvas + Worker (`transferControlToOffscreen`) tira o desenho da thread da UI; Baseline desde mar/2023 |
| 3D, shader, dezenas de milhares de partículas | **WebGL/WebGPU/3D** | Só citado, esta skill não ensina. WebGPU é "limited availability", fora do Baseline; dentro de uma webview embutida → *testar na sua versão* |
| Animação com fundo transparente vinda de vídeo/imagem | ativos com alfa (→ `36`) | |
| Mola | → `09` | |
| Efeito ligado à rolagem | → `24` | |
| Transição entre telas | → `25` | |
| Lista que entra, sai ou reordena | → `17` | |

O critério "DOM/CSS para poucos elementos, Canvas para centenas ou milhares" é heurística *(convenção de ofício)*: meça no aparelho alvo (→ `40`).

## A pergunta de defesa

Antes de trazer biblioteca ou abrir um `requestAnimationFrame`, pergunte: **isto resolve com `transition`, `@keyframes` ou `element.animate`?**
*Porquê:* a IA puxa biblioteca por reflexo. A própria página de licença do GSAP cita código gerado por ChatGPT/Cursor. Bibliotecas → `06`.

## Recursos novos — suporte e reserva

| Recurso | Suporte | Reserva |
|---|---|---|
| `linear()` (molas/bounce em CSS) | Baseline desde dez/2023: Chrome/Edge 113, Firefox 112, Safari 17.2; duração fixa | `@supports` + `cubic-bezier` |
| `@starting-style` | Baseline desde ago/2024; só afeta *transitions* | estado inicial via classe |
| `animation-composition` | Baseline desde jul/2023 | — |
| scroll-driven (`animation-timeline: scroll()/view()`) | Chrome/Edge 115+, Safari 26+; Firefox só com flag; **fora do Baseline** | `IntersectionObserver` / `scroll` passivo |
| View Transitions (mesmo documento) | Baseline "newly available" em 14/10/2025 | trocar o DOM sem transição |
| View Transitions entre documentos | Chrome/Edge 126+, Safari 18.2+; Firefox não | navegação normal |
| `sibling-index()` / `sibling-count()` | Chrome/Edge 138, Safari 26.2, Firefox 154; "newly available" desde 18/08/2026; "widely available" só em 2029 | variável `--i` ou `nth-child` |

Fontes antigas divergem do quadro: um resumo dizia "sibling-index: Chrome 132, Firefox não" (desatualizado) e outro "scroll-driven: Firefox 132+, 84% global" (contradiz as fontes primárias). **Vale o quadro acima.**

## Regra

**Detecte recurso, não versão**: `CSS.supports(...)`, `@supports` (→ `39`).
*Porquê:* versão de navegador não diz o que a webview do hospedeiro realmente tem.

→ Relacionados: `02`, `03`, `06`
