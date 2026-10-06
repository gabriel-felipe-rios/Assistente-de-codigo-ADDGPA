# 11 Ritmo, sobreposição e batida

Ritmo, escalonamento e o "tempo para bater" (o movimento cair no tempo certo). Abra ao coreografar mais de um elemento ou alinhar a uma batida.

## Quadros por batida

`quadros = fps × 60 ÷ BPM`. A 24 fps: 120 BPM = 12 quadros; 144 BPM = 10; 96 BPM = 15. Em ms: `60000 / BPM`.

**Pousar na batida:** alinhe o **pouso** do movimento (o fim do ease-out) à batida, não o início. *Convenção de ofício, não verificada em fonte única: trate como parâmetro.* Sincronia com áudio → `27`.

## Pausas e *holds*

Pausas "constroem peso emocional como o spacing constrói peso físico"; o erro típico de iniciante é velocidade uniforme e nenhuma pausa. Tempo de *hold* por palavra ~0,3 s + margem *(convenção de ofício)*.

## Sobreposição, *follow-through*, *drag*

Anime o corpo principal primeiro e dê *offset* de keyframes às partes secundárias: "nada para de uma vez só". Nomes: drag, wave, lead-and-follow. Em motion graphics: defasar texto e ícone, atrasar sombra/reflexo em alguns quadros, velocidades diferentes em elementos relacionados.

## Antecipação e assentamento *(convenção de ofício — parâmetros, nunca lei)*

| Elemento | Faixa |
|---|---|
| *anticipation* | 2–4 quadros |
| *overshoot* | **3–15%**: menor em UI, maior em momento autoral |
| *wind-up* | 100–200 ms em movimento grande |
| *settle* | 50–100 ms no fim |

## Stagger — as fontes divergem

| Fonte | Intervalo |
|---|---|
| Material 1 | no máximo **20 ms** entre itens |
| Kowalski | 30–80 ms |
| SVGator | 50–100 ms; acima de 150 ms de intervalo ou 2 s de sequência total fica lento |

**Regra da skill:** stagger 30–80 ms com **teto no total** (sequência inteira < 500 ms em UI *(convenção de ofício)*); só nos primeiros 5–8 itens, o resto entra junto *(convenção da web, não verificada)*.

```js
itens.forEach((el, i) => el.animate(
  [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }],
  { duration: 400, delay: Math.min(i, 7) * 60, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' }
));
```

**Stagger uniforme de 50 ms fixos é sinal de slop:** varie os atrasos, ordene pela leitura, pause entre batidas (→ `15`).

Em GSAP: `amount` (total dividido) × `each` (intervalo fixo); `ease` no stagger comprime ou expande os intervalos; `from: center/edges/random` e `grid`.

## Ordem

Listas e grids entram numa direção só, com caminho focal claro; reações perto do ponto de toque antes das distantes (Material).

## Coreografia (Val Head)

Pense as animações **em conjunto**; a boa animação é "quase invisível"; nem toda animação precisa ser movimento: opacidade, cor e blur dão estabilidade. Seis funções (Nabors): causalidade, feedback, relações, progressão, física, transição. Os 12 princípios de animação (antecipação, *follow-through*, *staging*, *slow in/out*, exagero, peso…) são o vocabulário.

*Porquê:* números de ofício entram rotulados e ajustáveis; o "tempo para bater" é a exigência do usuário.

→ Relacionados: `09`, `12`, `15`, `26`, `27`
