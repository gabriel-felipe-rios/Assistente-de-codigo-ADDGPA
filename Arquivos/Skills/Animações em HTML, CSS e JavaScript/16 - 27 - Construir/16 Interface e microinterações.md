# 16 Interface e microinterações

Receitas da animação de **UI funcional**: o papel básico e contido (→ `02`). Abra ao animar botão, menu, formulário, painel.

Base desta faixa: só `transform` e `opacity` animam no compositor; blur, sombra e gradiente custam pintura (web.dev). Números de desempenho são ordem de grandeza: medir no aparelho alvo. Tudo respeita `prefers-reduced-motion` (→ `41`).

## Checklist de UI (Kowalski, calibrado para produto)

Página de marketing ou herói pode e deve ter mais (→ `26`).

- Duração de UI até 300 ms: botão 100–160, dropdown 150–250, modal 200–500 (→ `10`).
- Só `transform`/`opacity`.
- Easing vindo de tabela autorizada (→ `08`): `cubic-bezier(0.23,1,0.32,1)` para entrada, `(0.77,0,0.175,1)` para movimento na tela.
- **Nunca** `transition: all`: nomeie as propriedades.
- **Nunca** `scale(0)`: use `scale(0.9–0.97)` + opacidade.
- Stagger 30–80 ms (→ `11`).

## Por elemento

- **Botão:** feedback de pressionar `scale(0.97)` em ~160 ms; hover **com significado** (elevação com sombra, sublinhado), não `scale(1.05)` em tudo.
- **Menu / dropdown:** 150–250 ms, entrada ease-out, saída mais curta que a entrada.
- **Formulário / checkbox / toggle:** feedback simples ≈ 100 ms (NN/g).
- **Lista:** entrada, saída e reordenação → `17`; AutoAnimate resolve em uma linha (→ `06`).
- **Painel que expande:** anime `grid-template-rows` (`0fr` → `1fr`) em vez de `height`.
- **Skeleton, spinner, barra de progresso:** movimento mecânico pode ser linear (→ `08`).

## Hover e toque

Em toque o `:hover` gruda. Use *gate* e nunca deixe `:hover` como única interação (→ `35`):

```css
@media (hover: hover) and (pointer: fine) { .btn:hover { box-shadow: 0 4px 12px rgb(0 0 0 / .2); } }
```

## Frequência manda

Ação repetida dezenas ou centenas de vezes por dia, ou por teclado, não ganha animação ou ganha ≤ 100 ms (→ `10`).

## Trechos

```css
.btn { transition: transform 160ms var(--ease-entra), box-shadow 160ms var(--ease-entra); }
.btn:active { transform: scale(0.97); }

.painel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 250ms var(--ease-move); }
.painel.aberto { grid-template-rows: 1fr; }
.painel > div { overflow: hidden; }

@media (prefers-reduced-motion: reduce) {
  .btn, .painel { transition-property: opacity, background-color; transition-duration: 100ms; }
}
```

*Porquê:* UI funcional é onde a contenção vence. Sinais de slop em UI: → `15` (#2, #11, #12, #14, #16).

→ Relacionados: `02`, `10`, `15`, `17`
