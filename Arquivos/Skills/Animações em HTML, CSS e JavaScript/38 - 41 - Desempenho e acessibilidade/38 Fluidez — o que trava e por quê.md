# 38 Fluidez — o que trava e por quê

O que faz uma animação travar. Abra quando a animação engasga ou antes de usar blur, sombra ou muitos elementos.

## Jank

Quadro que passa do orçamento (~16,66 ms a 60 Hz; ~10 ms seus, segundo surma.dev). A **sequência** de quadros perdidos é o que se percebe (→ `04`).

## O caminho do quadro

JS → Style → Layout → Paint → Composite. Anime só o que pula layout e paint (`transform`, `opacity`) (→ `05`; web.dev).

## Layout thrashing

**Leia tudo, depois escreva tudo.** Alternar leitura (`offsetWidth`, `getBoundingClientRect`) e escrita força *reflow* a cada ciclo; o DevTools tem o insight "Forced Reflow" (web.dev).

```js
// antes: lê e escreve em laço → reflow a cada item
itens.forEach(el => { el.style.width = (el.offsetWidth * 2) + 'px'; });

// depois: duas passadas
const larguras = itens.map(el => el.offsetWidth);
itens.forEach((el, i) => { el.style.width = (larguras[i] * 2) + 'px'; });
```

## Custos que se repetem

| Causa | Efeito | Saída |
|---|---|---|
| blur e `box-shadow` | *paint* caro; `backdrop-filter` pode prejudicar (teste); animar o raio re-rasteriza a cada quadro | blur fixo; anime `opacity`/`transform` (→ `22`) |
| `will-change` em massa | cada camada custa memória de GPU e banda | só onde medido (→ `05`) |
| gradiente com `@property` animado | repinta a cada quadro | lento e área pequena (→ `20`) |
| `feTurbulence` vivo | CPU por pixel | PNG de ruído (→ `20`) |
| blend em tela cheia | composição extra | evitar (→ `05`) |
| Canvas: muitos desenhos, `shadowBlur`, texto, gradiente novo por partícula | estoura o orçamento | pré-renderizar; camadas estáticas separadas (→ `21`) |
| trabalho longo de JS | segura o quadro | quebrar o trabalho ou Worker/OffscreenCanvas (→ `19`) |

## Não sabe o que trava?

**Meça** (→ `40`) antes de adivinhar.

*Porquê:* travar é o erro mais visível de animação, e a causa quase nunca é a que parece.

→ Relacionados: `05`, `22`, `39`, `40`
