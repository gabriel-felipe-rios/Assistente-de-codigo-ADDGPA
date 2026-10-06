# 09 Molas e overshoot

Molas em CSS e em JS. Abra quando o movimento precisa de vida, peso ou *overshoot*.

## Amortecimento (Apple, WWDC 2018, sessão 803)

- 100% = sem *overshoot*; ~80% = "quicar" agradável; o parâmetro *response* substitui a duração.
- **Overshoot só quando o gesto tem *momentum***: toque simples usa 100%; deslizar para dispensar ~80%.
- Molas devem ser **interrompíveis e redirecionáveis**.
- Latência estraga a sensação: **comece o movimento imediatamente**.

## Física (Heckel/Juckett)

`a = (-k*x - c*v)/m` · `ω = √(k/m)` · `ζ = c/(2√(mk))`.

| ζ | Nome | Efeito |
|---|---|---|
| < 1 | subamortecida | *overshoot*, oscila |
| = 1 | criticamente amortecida | chega o mais rápido sem oscilar |
| > 1 | superamortecida | lenta, sem overshoot |

## Mola em JS — integração semi-implícita

Velocidade primeiro, posição depois. O Euler explícito ganha energia e pode explodir. Para `dt` grande, subdivida em passos fixos (1/120 s). Existe a solução analítica de Juckett, exata e independente do `dt` (Gaffer on Games).

```js
// k = rigidez, c = amortecimento, m = massa
v += ((-k * (x - alvo) - c * v) / m) * dt;
x += v * dt;
```

Valores típicos *(ordem de grandeza, de blogs)*: snappy 400/30, bouncy 200/10, pesado 80/20 (rigidez/amortecimento); Framer 100/10/1; Kowalski: *bounce* sutil de 0,1–0,3 em UI.

## Mola em CSS com `linear()`

Simule a mola, amostre `x(t)/alvo` em ~40–100 pontos e escreva `linear(0, .012, …, 1)`. **Não faça à mão**: use o gerador de Jake Archibald e Adam Argyle (`linear-easing-generator.netlify.app`). Custo ≈ zero (~1,3 kB para 3 molas grandes). Baseline desde dez/2023 (Chrome/Edge 113, Firefox 112, Safari 17.2). Molas realistas pedem ~40 pontos ou mais.

- **Limitações:** duração fixa; se interrompida no meio "bate na parede", sem inércia. Para gesto e interrupção, use mola em JS.
- **Reserva:**

```css
.card { transition: transform .4s cubic-bezier(0.05, 0.7, 0.1, 1); }
@media (prefers-reduced-motion: no-preference) {
  @supports (animation-timing-function: linear(0, 1)) {
    .card { transition-timing-function: linear(0, /* pontos do gerador */ 1); }
  }
}
```

## Fórmulas com overshoot

Com `c1 = 1.70158`, `c3 = c1 + 1`, `c4 = 2π/3`:

- `easeOutBack = 1 + c3*(t-1)³ + c1*(t-1)²`
- `easeOutExpo = t === 1 ? 1 : 1 - 2^(-10t)`
- `easeOutElastic = 2^(-10t)*sin((10t-.75)*c4) + 1`

*Confira contra easings.net — o texto literal das fórmulas não foi confirmado.* Aumentar `c1` amplia o estouro. *Overshoot* em `opacity` é cortado em 1: não faz efeito.

## Em UI

- Overshoot pequeno, que resolve rápido (faixa em `11`).
- Bounce/elastic exagerado é sinal de slop (→ `15`).
- Material 3 Expressive separa tokens *spatial* (posição, tamanho, forma; podem ter overshoot) de *effects* (cor, opacidade; sem overshoot).

*Porquê:* mola é o que dá vida ao movimento e o que a IA mais exagera.

→ Relacionados: `08`, `11`, `15`
