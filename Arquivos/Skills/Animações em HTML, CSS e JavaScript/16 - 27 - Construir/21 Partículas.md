# 21 Partículas

Partículas em Canvas 2D e seus papéis. Abra ao criar confete, faíscas, poeira, fogo ou ambiente com partículas.

## Emissor *(convenção, sem fonte primária)*

- `rate`: acumule `dt*rate`, emita a parte inteira, guarde o resto.
- `life` (± *jitter*) e velocidade inicial (ângulo e módulo num cone).
- Física por passo: `vy += g*dt; v *= (1 - drag*dt); x += vx*dt`.
- Campos sorteados em `[min, max]`.

## Curvas ao longo da vida

Com `t = age/life`:

```js
size  = lerp(s0, s1, easeOutCubic(t));
alpha = t < .1 ? t / .1 : 1 - (t - .1) / .9;   // entra rápido, sai devagar
color = lerp(c0, c1, t);                         // ex.: branco → laranja → vermelho
```

## Mistura aditiva

`ctx.globalCompositeOperation = 'lighter'` soma RGB onde há sobreposição (fogo, faíscas, neon); suporte total desde 2015 (MDN). Desenhe um **sprite pré-renderizado** de gradiente radial com `drawImage`, **não** um gradiente novo por partícula.

## Pool de objetos

Pré-aloque N, troque com a última viva ao morrer (*swap-remove*) e reinicialize. Melhor ainda: `Float32Array` em estrutura de arrays.

## Limites *(ordem de grandeza — medir no aparelho alvo)*

- ~1.000–3.000 desenhos simples por quadro a 60 fps em Canvas 2D num notebook médio; WebGL acima de 50.000.
- Gradiente, `shadowBlur` e texto derrubam o orçamento.
- **CSS/SVG:** cada partícula é um nó do DOM; dezenas a poucas centenas *(sem número verificado)*; acima disso, Canvas.

## Otimização (MDN)

Pré-renderizar, coordenadas inteiras, camadas estáticas e dinâmicas em canvases separados, `alpha: false`, ajustar ao `devicePixelRatio`, evitar `shadowBlur`; **OffscreenCanvas** em Worker (Baseline mar/2023).

## Papéis

| Papel | Como |
|---|---|
| **celebração** | confete curto em marco |
| **ambiente** | sutis, derivando, lentas |
| **ênfase** | rajada junto ao herói |

**Evite ambiente persistente ilimitado**: dê teto de N e adapte a qualidade (→ `39`). "Partículas como transição": *não verificado — não afirme*.

## Bibliotecas e regra de riqueza

tsParticles (partículas configuráveis; licença *não verificada*), PixiJS, Three: só quando vale (→ `06`). Partículas precisam de papel (ritmo, marca, foco); sem papel, corte (→ `13`).

*Porquê:* partícula é metade da riqueza que o usuário sente falta.

→ Relacionados: `06`, `13`, `19`, `39`
