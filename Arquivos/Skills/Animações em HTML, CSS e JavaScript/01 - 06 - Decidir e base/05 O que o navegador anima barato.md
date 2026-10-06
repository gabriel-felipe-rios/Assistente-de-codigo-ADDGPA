# 05 O que o navegador anima barato

O custo de cada propriedade. Abra antes de escolher o que animar.

## O pipeline

JS → Style → Layout → Paint → Composite. Propriedade de **layout** percorre tudo; só de **paint** pula layout; só de **compositor** pula layout e paint (web.dev). **Só `transform` e `opacity` são citadas como compositor-only.**

- **Faça:** anime só `transform` e `opacity`.
- **Não faça:** anime `width`, `height`, `top`, `left`, `margin`, `padding`. Para altura de painel, transicione `grid-template-rows` (→ `16`).
- `filter` ser barato: *testar na sua versão* — não confirmado.

*Porquê:* cada propriedade de layout refaz a página inteira a cada quadro.

## `will-change`

- Último recurso: uso excessivo piora.
- Ligue e desligue por JS em volta da mudança.
- **Não coloque em `@keyframes`.** `translateZ(0)` em massa idem.
- Cada camada promovida custa memória de GPU e banda (MDN, web.dev).

## `contain` e `content-visibility`

- `contain`: Baseline desde mar/2022.
- `content-visibility: auto`: Baseline desde set/2024 segundo o MDN; alguns relatos dizem set/2025 → *testar na sua versão*. Use com `contain-intrinsic-size`.
- Pula o render fora da tela, mas **não substitui pausar o rAF** (→ `33`).

## Tabela de custo *(regra de bolso — ordem de grandeza, medir no aparelho alvo)*

| Técnica | Custo | Quando |
|---|---|---|
| `transform`/`opacity`, `linear()`, `sibling-index()` | mínimo | sempre |
| glow por gradiente radial; PNG de grão | baixo | preferir |
| partículas Canvas 2D com sprite | médio, cresce com N | até ~1–3 mil |
| `@property` em gradiente, `drop-shadow`, blur estático | médio, repinta | área pequena; sem animar o raio |
| `feTurbulence` vivo, blur animado, blend em tela cheia | alto | evitar; pré-renderizar |

## Blur e sombra

- Blur e `box-shadow` são *paint* caro (web.dev).
- `backdrop-filter` pode prejudicar o desempenho: teste antes (MDN).
- Animar o raio do blur ou a sombra re-rasteriza a cada quadro: anime `opacity`/`transform` e mantenha o blur fixo *(convenção de ofício)*.

Detalhes → `22`, `38`.

→ Relacionados: `03`, `22`, `38`
