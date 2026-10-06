# 36 Ativos com transparência

Vídeo e imagem com fundo transparente. Abra ao usar animação pré-renderizada com alfa.

## Formatos

| Formato | Alfa | Onde toca | Observações |
|---|---|---|---|
| **WebM VP8/VP9 com alfa** | sim | Chromium (Electron, WebView2, Qt WebEngine, CEF/OBS) | codifique com `-pix_fmt yuva420p`; **a escolha segura para desktop em Chromium** *(inferência)* |
| **HEVC com alfa** | sim | só Safari (o Chrome não suporta o alfa; Jake Archibald) | cross-browser: duas fontes no mesmo `<video>`, HEVC primeiro e WebM depois (exemplo: 1,1 MB VP9 × 3,4 MB HEVC); HEVC dentro do WebView2 depende de codec/hardware → *testar no hospedeiro real* |
| **Vídeo "alfa empilhado"** | sim | qualquer | cor em cima, alfa em cinza embaixo, recombinado em canvas/WebGL; ex. 460 kB em AV1; exige código de renderização |
| **APNG, WebP animado** | alfa completo | — | pesados para animação longa (MDN) |
| **GIF** | só 1 bit | — | evitar |
| **AVIF animado** | sim | rende mal no Safari e não sustentou 60 fps no exemplo | evitar para animação |
| **Lottie / dotLottie / Rive** | vetorial, sem codec | — | transparência por natureza; para ícones, UI e ilustração, **não para vídeo** |

## Trechos

```bash
ffmpeg -i entrada.mov -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 30 saida.webm
```

Parâmetros de qualidade a ajustar.

```html
<video autoplay muted loop playsinline>
  <source src="a.mov" type="video/quicktime; codecs=hvc1">
  <source src="a.webm" type="video/webm">
</video>
```

## Halo de borda

Alfa **não premultiplicado** com filtragem bilinear/mipmap gera **halo escuro** ao redor de recortes. A saída é alimentar a GPU com cor **premultiplicada**: em WebGL, `UNPACK_PREMULTIPLY_ALPHA_WEBGL`; em vídeo, `premultiply=inplace=1` no ffmpeg.

## Autoplay e peso

- `muted playsinline` para autoplay (política dos navegadores); pause fora da tela (→ `33`).
- Vídeo, APNG e WebP pesam; para ícone e UI prefira vetorial (→ `06`, `18`).

## Fundo do hospedeiro

O ativo só vê transparência se a janela, o `<video>` e a página também forem transparentes (→ `29`).

*Porquê:* cada formato tem um navegador que falha; escolher errado vira retângulo preto ou halo.

→ Relacionados: `06`, `18`, `29`, `33`
