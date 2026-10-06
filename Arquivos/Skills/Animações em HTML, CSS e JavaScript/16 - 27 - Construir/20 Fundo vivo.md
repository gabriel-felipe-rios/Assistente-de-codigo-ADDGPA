# 20 Fundo vivo

Fundos que se mexem: **o que mais faz diferença** na riqueza. Abra ao dar atmosfera a uma cena ou tirar o aspecto "seco".

Papel: o fundo é **ambiente**: lento, discreto, 10–20% de amplitude (→ `02`, `12`). Fundo sólido ou halo radial genérico é sinal de slop (→ `15` #9); blobs animados como decoração também (#12): o fundo precisa combinar com o tema.

## Gradientes em camadas

Vários `radial-gradient`/`linear-gradient` no mesmo `background`: estático e barato, base de tudo.

## Gradiente animado

Registre a propriedade, senão o navegador não interpola variável dentro de gradiente:

```css
@property --a { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
.fundo { background: conic-gradient(from var(--a), #1b2a49, #3a1c71, #1b2a49); animation: gira 30s linear infinite; }
@keyframes gira { to { --a: 360deg; } }
```

Baseline 2024 (Chrome 85, Safari 16.4, Firefox 128 — versões de busca; *testar na sua versão*). **Repinta a cada quadro, sem compositor**: velocidade lenta e área pequena (MDN).

## Mesh / aurora

3 a 6 `div`s com `radial-gradient` ou cor sólida e `filter: blur(60px)`, animando **só `transform`** (deriva lenta em translate/rotate). 4 blobs com 42 px de blur é ok; 12 com 120 px derruba quadros em GPU integrada *(ordem de grandeza)*. **Alternativa barata:** `radial-gradient(circle, cor, transparent 70%)` no lugar do blur.

## Não anime o valor do blur

~90 ms por quadro no caso ingênuo. A saída proposta: pré-calcule versões com blur crescente e faça *cross-fade* de opacidade (developer.chrome.com, "animated blur").

## Ruído e grão

- SVG `feTurbulence` (`type="fractalNoise" baseFrequency=".65" numOctaves="3" stitchTiles="stitch"`), Baseline 2015. **Custo por pixel na CPU**, pesado em tela de alta densidade; `numOctaves` ≤ 3–4 (CSS-Tricks).
- **Alternativa recomendada:** PNG/WebP de ruído de 256–512 px com `background-repeat`: uma requisição e quase nenhum custo de execução.
- Para fixar sobre a tela:

```css
.grao { position: fixed; inset: 0; pointer-events: none; z-index: 9999;
  background: url(ruido.png); mix-blend-mode: overlay; opacity: .08; }
```

`opacity` na faixa .05–.15. **Não anime o filtro**; grão "vivo" = `transform: translate` do PNG em passos (`steps()`).

## Ruído Perlin/simplex

`noise(x*f, y*f, t*s)` dá ângulo ou deslocamento suave (campo de fluxo de partículas, deriva de blobs). Simplex tem menos artefatos direcionais. Para milhares de pontos, use tabela pré-calculada (*testar*).

## Pausar

Quando a aba ou o iframe está oculto ou fora da tela (→ `33`).

*Porquê:* "fundo e partícula fazem muita diferença" — palavras do usuário.

→ Relacionados: `02`, `05`, `13`, `21`, `33`
