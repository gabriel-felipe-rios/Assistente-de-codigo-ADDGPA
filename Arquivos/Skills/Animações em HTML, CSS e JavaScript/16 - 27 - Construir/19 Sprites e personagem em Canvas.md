# 19 Sprites e personagem em Canvas

Animação quadro a quadro e personagens. Abra ao usar spritesheet, canvas 2D ou ciclo de personagem.

## Spritesheet em CSS

Uma imagem com todos os quadros, movendo `background-position`. `steps(N)` dá saltos discretos (a curva `linear` interpolaria entre quadros):

```css
.heroi { width: 64px; height: 64px; background: url(heroi.png) 0 0 / 512px 64px;
  animation: anda 0.8s steps(8) infinite; }
@keyframes anda { to { background-position-x: -512px; } }
```

## Spritesheet em Canvas 2D

`ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)`. O quadro vem do **tempo**, não da contagem de quadros do navegador (→ `03`):

```js
const i = Math.floor(t * fps) % N;
ctx.drawImage(sheet, i * 64, 0, 64, 64, x, y, 64, 64);
```

## Dicas de Canvas (MDN)

- **Pré-renderize** sprites e formas fixas em canvas fora da tela e copie com `drawImage`.
- **Coordenadas inteiras** (evita suavização).
- Camadas estáticas e dinâmicas em **canvases separados**.
- `getContext('2d', { alpha: false })` quando não precisa de transparência.
- Ajuste ao `devicePixelRatio`: canvas = tamanho CSS × dpr + `ctx.scale`; no iOS, limite o dpr (→ `28`).
- Evite `shadowBlur`.
- rAF, nunca `setInterval`.

## Escala e pool

Canvas 2D para centenas de sprites; para muitos milhares, PixiJS (2D acelerado, → `06`). **Reutilize objetos** em vez de criar e destruir (→ `21`).

## Personagem

Princípios: antecipação, *follow-through*, sobreposição, peso. Ciclo de caminhada com *hold* nos extremos (poses-chave) e spacing desigual (→ `11`).

## OffscreenCanvas + Worker

Tira o desenho da thread da UI (Baseline mar/2023). Custo: o estado vai por mensagens.

```js
const off = canvas.transferControlToOffscreen();
worker.postMessage({ canvas: off }, [off]);
```

*Porquê:* cena e personagem entram; jogo só no que for animação.

→ Relacionados: `03`, `06`, `21`, `28`
