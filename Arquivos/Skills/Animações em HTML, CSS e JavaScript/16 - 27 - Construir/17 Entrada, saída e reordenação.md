# 17 Entrada, saída e reordenação

Como elementos aparecem, somem e trocam de lugar. Abra ao animar modal, toast, lista ou qualquer inserção/remoção no DOM.

## Entrada com `@starting-style`

Baseline desde ago/2024; **só afeta *transitions*** (MDN).

```css
.card { opacity: 1; transform: none; transition: opacity 250ms, transform 250ms;
  @starting-style { opacity: 0; transform: translateY(8px); } }
```

Versão do Chromium com `@starting-style` numa webview embutida → *testar na sua versão*. Reserva: aplicar uma classe no quadro seguinte.

## Saída

Espere a animação terminar antes de remover do DOM (a promessa `finished`, MDN):

```js
await el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'cubic-bezier(0.3,0,0.8,0.15)' }).finished;
el.remove();
```

Fixe o estado final com `commitStyles()`, **não** com `fill: forwards` eterno (mantém a animação viva).

## Duração

Entrada um pouco mais longa que saída; popup ~300 ms entrando e 200–250 saindo; modal 200–300 (→ `10`). Entre com `scale(0.9–0.97)` + opacidade 0, nunca de zero.

## Modal e toast *(convenção de ofício)*

- **Modal:** o overlay faz *fade* e o painel sobe ou escala pouco, com curva de entrada de `08`.
- **Toast:** entra pelo lado do qual será dispensado e sai mais rápido. Não bloqueia nem rouba foco.

## Reordenação de lista

1. **View Transitions** para troca de estado do DOM (→ `25`; Baseline "newly available" em 14/10/2025), com `view-transition-name` por item.
2. **FLIP** (*First, Last, Invert, Play*): meça a posição antes (`getBoundingClientRect`), mude o DOM, meça depois, aplique o `transform` inverso e anime até `none` com WAAPI (`composite: 'add'` ajuda a empilhar movimentos, Baseline set/2022). FLIP é técnica conhecida do ofício, **não pesquisada nesta rodada** → *testar na sua versão*.
3. **Biblioteca:** AutoAnimate (~2 kB, MIT) entra/sai/reordena com uma linha (→ `06`).

**Leia todas as posições antes de escrever** (→ `38`, *layout thrashing*).

## Stagger de lista

`el.animate(kf, { delay: i*60, fill: 'backwards' })` ou `animation-delay: calc(0.06s * sibling-index())` (Baseline "newly available" em 18/08/2026; reserva `--i`, → `01`). Só os primeiros itens; total < 500 ms (→ `11`).

- **Não faça:** `display: none` no meio da animação de saída; animar `height`; fade-up em todo elemento da página (→ `15` #1).

*Porquê:* entrada e saída são onde a IA mais repete o mesmo fade-up.

→ Relacionados: `10`, `11`, `25`, `38`
