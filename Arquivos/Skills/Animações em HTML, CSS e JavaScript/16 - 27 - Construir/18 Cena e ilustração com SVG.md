# 18 Cena e ilustração com SVG

Animação vetorial e de personagem. Abra ao animar ilustração, ícone complexo, traçado ou cena em camadas.

## SMIL × CSS × JS

| Quando | Use |
|---|---|
| animar **atributos** SVG (`cx`, `r`, `d`) ou mover ao longo de um path de forma declarativa | **SMIL** (`<animate>`, `<animateTransform>`, `<animateMotion>`): Baseline "widely available" desde jan/2020; único que faz isso declarativamente |
| animar `transform`/`opacity` de partes da cena | **CSS** (`@keyframes`): compositor |
| sequência longa, sincronia entre muitas partes, interação | **WAAPI**/JS (ou GSAP para timeline longa, → `06`) |

## Técnicas

- **Traçado que se desenha** (*line drawing*): `stroke-dasharray` = comprimento do path (`getTotalLength()`) e anime `stroke-dashoffset` do comprimento até 0.
- **Morph:** interpole o atributo `d` (SMIL ou biblioteca; o GSAP tem plugin de morph SVG, → `06`). Os dois paths precisam ter o mesmo número e tipo de segmentos *(regra de ofício)*.
- **Movimento em caminho:** `<animateMotion>` (SMIL) ou `offset-path` em CSS. O suporte de `offset-path` **não foi pesquisado** → *testar na sua versão*.

```css
.traco { stroke-dasharray: 300; stroke-dashoffset: 300; animation: desenha 1.2s cubic-bezier(0.23,1,0.32,1) forwards; }
@keyframes desenha { to { stroke-dashoffset: 0; } }
```

## Filtros SVG

`feTurbulence` (ruído/grão, → `20`) e `feGaussianBlur` com `stdDeviation="10 0"` (blur direcional, → `23`) re-rasterizam ao animar: use em elementos pequenos e movimento curto (→ `38`).

## Camadas e profundidade

Separe fundo/meio/frente em `<g>` e dê velocidades diferentes (→ `24`). Use `transform-box: fill-box` + `transform-origin` para girar cada parte no próprio centro *(técnica padrão de CSS em SVG — testar na sua versão)*.

## Vetorial pronto

Lottie, dotLottie e Rive são vetoriais, sem codec, com transparência por natureza: servem a ícones, UI e ilustração, **não** a vídeo (→ `06`, `36`).

## Princípios de personagem

Antecipação, *follow-through*, *staging*, *slow in/out*, exagero, peso (→ `11`).

- **Não faça:** milhares de nós SVG animados. Cada um é nó do DOM: dezenas a poucas centenas *(número não verificado)*; acima disso, Canvas (→ `21`).

*Porquê:* cena e ilustração são um dos tipos de animação cobertos pela skill.

→ Relacionados: `01`, `06`, `11`, `24`
