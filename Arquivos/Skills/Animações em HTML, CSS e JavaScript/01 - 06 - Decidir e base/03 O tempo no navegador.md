# 03 O tempo no navegador

Como o tempo funciona quando você anima por código. Abra antes de escrever qualquer laço de animação.

## `requestAnimationFrame` e delta time

O `requestAnimationFrame` (rAF) acompanha a taxa do monitor (60/75/120/144 Hz). **Use o timestamp que ele passa como 1.º argumento** para calcular o **delta time**; senão a animação roda mais rápido em tela de taxa alta (MDN).

```js
let ultimo = 0, id;
function quadro(agora) {
  const dt = Math.min((agora - ultimo) / 1000, 0.05); // segundos; teto ~50 ms (convenção de ofício)
  ultimo = agora;
  atualizar(dt);   // x += velocidade * dt   — nunca x += 5
  desenhar();
  id = requestAnimationFrame(quadro);
}
id = requestAnimationFrame((t) => { ultimo = t; quadro(t); });
// parar: cancelAnimationFrame(id)
```

## Regras

- **Movimento por tempo, não por contagem de quadros.** "Passo fixo por quadro" roda mais rápido em 120/144 Hz.
- **rAF é one-shot:** reagende a cada quadro; guarde o id e cancele com `cancelAnimationFrame` ao sair da animação (→ `43`).
- **Um só rAF compartilhado** para várias animações da mesma página é melhor que um por animação *(regra de bolso)*.
- **Não há API** para descobrir a taxa real nem escolher a taxa do rAF (whatwg/html#8031). Meça (→ `04`, `40`).

## Aba oculta

rAF e animações CSS **pausam**; timers vão a no máximo 1×/s e, depois de 5 min oculta, 1×/min ("intensive throttling", Chrome 88).

- **Não use `setTimeout`/`setInterval` como plano B** para animar.
  *Porquê:* na aba oculta eles rodam a 1 quadro por segundo.
- Ao voltar, o `dt` é enorme: por isso o teto de ~50 ms no trecho acima *(convenção de ofício)*.
- Para pausar na mão, use `visibilitychange` / `document.hidden` (→ `33`).

## Orçamento por quadro

| Taxa | Quadro | Parte que é sua |
|---|---|---|
| 60 Hz | ~16,66 ms | ~10 ms |
| 120 Hz | ~8,3 ms | proporcionalmente menos |

Conta simples (surma.dev). Estourou o orçamento, o quadro é perdido (→ `38`).

- **Faça:** `dt` em segundos e velocidade em unidades por segundo.
- **Não faça:** `x += 5` por quadro; `setInterval(…, 16)` para animar; esquecer de cancelar o rAF.

*Porquê:* sem delta time a animação muda de velocidade conforme o monitor, e o mesmo código fica lento num aparelho e frenético em outro.

→ Relacionados: `04`, `05`, `33`, `43`
