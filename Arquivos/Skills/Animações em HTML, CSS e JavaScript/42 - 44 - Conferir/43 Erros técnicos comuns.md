# 43 Erros técnicos comuns

Os erros de técnica que se repetem. Abra ao revisar código de animação.

| # | Erro | Porquê / correção |
|---|---|---|
| 1 | Duração acima de 400–500 ms em UI | arrasta (→ `10`) |
| 2 | Easing errado: linear em movimento orgânico, ou a **mesma curva nos dois sentidos** | entrar ease-out, sair ease-in (→ `08`) |
| 3 | Animar layout (`top/left/width/height`) | só `transform`/`opacity` (→ `05`) |
| 4 | `setInterval`/`setTimeout` em vez de rAF | pausam e estrangulam em aba oculta (→ `03`) |
| 5 | Passo fixo por quadro | roda mais rápido em 120/144 Hz; use delta time (→ `03`) |
| 6 | `will-change` / `translateZ(0)` em tudo | cada camada custa memória de GPU (→ `05`) |
| 7 | `fill: forwards` no lugar de `commitStyles()` | mantém a animação viva (→ `17`) |
| 8 | Ignorar `prefers-reduced-motion` | obrigatório (→ `41`) |
| 9 | Parallax decorativo sem alternativa | a web.dev o cita como movimento decorativo a remover (→ `24`) |
| 10 | Sem cancelar: rAF/animação continua depois de o elemento sair | guarde o id e cancele (→ `03`) |
| 11 | `transition: all` e `scale(0)` | nomeie as propriedades; escale a partir de 0,9–0,97 (→ `16`) |
| 12 | Sem *gate* de hover em toque | `@media (hover: hover)` (→ `16`, `35`) |
| 13 | Sem detectar recurso | `@supports`, `CSS.supports` e reserva (→ `39`) |

## Opinião *(sem fonte primária)*

- "Bounce exagerado" (→ `09`).
- "FOUC / reveal tardio": o elemento pisca antes da entrada começar; use `fill: 'backwards'` ou `@starting-style` (→ `17`).
- "Sem estado inicial/final coerente": a animação termina num estado que o CSS não mantém.

## Apple

Movimento deve ser "purposeful", sem "motion for the sake of adding motion", e evitado em interação frequente (via busca).

*Porquê:* são os erros que se repetem, em código de IA e de gente.

→ Relacionados: `03`, `05`, `15`, `44`
