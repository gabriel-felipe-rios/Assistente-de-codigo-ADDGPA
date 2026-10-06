# 26 Momentos autorais — entrada, herói, celebração

A receita do momento **rico**: várias camadas orquestradas. Abra para entrada de página, herói ou celebração.

## O que é

O papel "autoral" de `02`: poucas vezes, pode e deve ser detalhado. O guia oficial de estética da Anthropic diz que **uma entrada de página bem orquestrada, com revelações escalonadas, vale mais que micro-interações espalhadas**. Material chama esses de *hero moments* (esquema Expressive); Atlassian: expressivo só em momentos raros.

## A receita em camadas *(convenção de ofício — síntese da skill; ordem, não lei)*

1. **Ambiente** já vivo ao fundo (→ `20`).
2. **Herói** entra primeiro, com curva forte (→ `08`), *anticipation* curta e *overshoot* pequeno (→ `09`, `11`).
3. **Apoio** entra com *follow-through* de 50–150 ms (→ `11`).
4. **Luz e partículas** curtas no clímax (→ `21`, `22`).
5. **Assentamento** (*settle* 50–100 ms) e volta ao repouso.

Cada camada com **papel** (→ `13`).

## Script de tempo obrigatório

Tabela com elemento, papel, curva, duração e atraso, **antes** do código (→ `07`).

## Orquestração

```js
const ordem = [...document.querySelectorAll('[data-entra]')];
ordem.forEach((el, i) => el.animate(
  [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }],
  { duration: 500, delay: i * 60 + (i ? 80 : 0), easing: 'cubic-bezier(0.23,1,0.32,1)', fill: 'backwards' }));
```

`fill: 'backwards'` segura o estado inicial durante o atraso. Use `animation.finished` para encadear a próxima camada.

## Celebração

Confete ou marco: curta, no clímax, com partículas de teto fixo (→ `21`); som opcional (→ `27`).

## Teto de duração

Stagger total < 500 ms (→ `11`). Em momento autoral a sequência inteira pode passar dos 500 ms de UI *(convenção)*, mas deve poder ser pulada e não bloquear a ação.

- **Não faça:** fade-up em todos os elementos ao mesmo tempo (→ `15` #1); dois heróis; momento autoral em ação repetida (→ `10`); esquecer de reduzir movimento (→ `41`).

*Porquê:* o "detalhado" precisa de receita concreta, senão vira "seco" ou "bagunçado".

→ Relacionados: `02`, `07`, `13`, `21`, `27`
