# 23 Rastros e motion blur

Rastro e borrão de movimento. Abra ao dar sensação de velocidade ou peso a um objeto em movimento.

**Não existe *motion blur* nativo em CSS.** Tudo abaixo é simulação.

## Rastro em canvas

Em vez de limpar o quadro, pinte um fade por cima: uma chamada por quadro, barato.

```js
ctx.fillStyle = 'rgba(0,0,0,.08)';
ctx.fillRect(0, 0, w, h);
```

- **Limitação:** o alfa é de 8 bits. Com *fade* pequeno o valor arredonda e deixa **resíduo que nunca some** (pior em taxa alta). Acumule o *fade* e aplique só quando somar um passo visível.
- Só funciona em **fundo sólido**. Para fundo transparente, guarde o **histórico de posições** e redesenhe.

## Ghost trails (DOM)

Cópias do elemento com atraso crescente e opacidade decrescente (WAAPI: `delay: i*40`). Custo linear: poucos objetos.

## Blur direcional em SVG

`<feGaussianBlur stdDeviation="10 0"/>` borra só um eixo, Baseline 2020. **Animar `stdDeviation` re-rasteriza**: elementos pequenos e movimento curto (MDN).

## Alternativa por conteúdo (Apple)

Deformação elástica (*squash & stretch* leve) e blur reduzem o *strobing*: a fluidez vem do que há em cada quadro (→ `04`).

## Rastro por partículas

Emita partículas curtas atrás do objeto (→ `21`).

## Desempenho

Conte o custo por objeto; pare o rastro quando o objeto para (→ `39`).

- **Não faça:** fade de canvas com alfa muito baixo sem tratar o resíduo; rastro em muitos objetos ao mesmo tempo.

*Porquê:* rastro é o "motion blur" barato que dá peso ao movimento.

→ Relacionados: `04`, `21`, `22`, `39`
