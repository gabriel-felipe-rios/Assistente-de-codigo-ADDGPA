# 22 Luz, brilho, sombra e blur

Luz e profundidade em CSS. Abra ao dar glow, sombra que responde à altura, blur de profundidade ou brilho que passa.

## Glow real

`filter: drop-shadow(0 0 8px cor)` segue a forma alfa (`box-shadow` é retangular); Baseline 2016. É convolução gaussiana por pixel: empilhar (bloom em camadas) multiplica o custo. **Não anime o raio** (MDN).

## Glow falso barato

Pseudo-elemento com gradiente por trás, animando só `opacity` e `transform: scale` *(convenção)*:

```css
.glow::before { content: ""; position: absolute; inset: -30%; z-index: -1;
  background: radial-gradient(closest-side, rgb(255 200 100 / .6), transparent); }
```

## Blend modes

`mix-blend-mode: screen | plus-lighter | overlay`, Baseline 2020. Cria contexto de empilhamento: use `isolation: isolate` no contêiner. Exige composição extra: **evite em áreas grandes** (MDN).

## Sombras que respondem à altura

Ao subir, *offset* e blur aumentam e a opacidade cai; `offset-y` ≈ 2× `offset-x`; cor da sombra no matiz do fundo; 3 a 6 camadas. **Não anime a sombra**: anime a **opacidade** de um pseudo-elemento com a sombra maior sobre a menor (prática comum, sem fonte primária).

## Blur de profundidade

`filter: blur()` **estático** em camadas de fundo é barato se não animar. Desfoque progressivo com centenas de `div`s já derrubou navegadores móveis (CSSWG issue 11134). Alternativa: `backdrop-filter` + `mask-image` (Comeau).

## Custo

Blur e `box-shadow` são *paint* caro; `backdrop-filter` pode prejudicar, teste antes (MDN). Animar raio de blur ou sombra re-rasteriza a cada quadro (→ `05`, `38`).

## Light sweep

Gradiente linear estreito transladando sobre o elemento com `transform` (só compositor) *(convenção de ofício)*.

## Papel

A luz dirige o foco (→ `13`). Glow em tudo, roxo e neon como decoração e *glassmorphism* em tudo são slop (→ `15` #9, #15). Glow ou bloom exagerado prejudica a legibilidade *(opinião de ofício — não verificado)*.

*Porquê:* luz e sombra são o que tira a animação do "plano".

→ Relacionados: `05`, `13`, `15`, `38`
