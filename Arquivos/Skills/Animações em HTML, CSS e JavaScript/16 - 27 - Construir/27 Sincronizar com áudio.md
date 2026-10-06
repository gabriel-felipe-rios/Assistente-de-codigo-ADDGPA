# 27 Sincronizar com áudio

Animação ligada ao som: o "tempo para bater" ao vivo. Abra ao reagir a música ou efeito sonoro.

## Pipeline

`AudioContext.createAnalyser()`, `fftSize = 2048`, `smoothingTimeConstant = .8`, e `analyser.getByteFrequencyData(arr)` a cada `requestAnimationFrame` (MDN).

## Detectar batida

Média dos primeiros *bins* (graves) contra a média histórica:

```js
if (bass > 1.3 * mediaHist && agora - ultima > 200) pulso();
```

Limiares 1,1–1,4× e histórico de ~20 amostras vêm de blog (Beatport Engineering): **parâmetros ajustáveis**.

## Autoplay

O `AudioContext` só começa após um gesto do usuário (política de autoplay): chame `ctx.resume()` num clique.

## Custo e aplicação

Baixo (um FFT por quadro). Aplique o pulso **só em `transform`/`opacity`** (→ `05`).

## "Tempo para bater" com áudio

Se o BPM é conhecido, agende por tempo (`60000/BPM` ms) em vez de detectar (→ `11`). Detectar serve a áudio desconhecido.

## Suavize

Use *lerp* ou mola para a resposta ao pulso (→ `09`). Pulso seco parece robótico.

## Reduzir movimento

Com a preferência ligada, troque pulso de movimento por mudança de cor ou opacidade (→ `41`). Cuidado com piscar mais de 3×/s (→ `41`).

- **Não faça:** iniciar o `AudioContext` no carregamento; animar propriedades de layout no pulso.

*Porquê:* o ritmo vem do áudio; sem detecção ou agenda por BPM, a animação não "bate".

→ Relacionados: `05`, `09`, `11`, `41`
