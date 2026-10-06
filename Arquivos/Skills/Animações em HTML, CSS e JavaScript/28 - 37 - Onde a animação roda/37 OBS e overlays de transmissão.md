# 37 OBS e overlays de transmissão

Animação como *Browser Source* do OBS. Abra ao fazer overlay para stream ou gravação.

*Exemplo — o hospedeiro do seu projeto pode ser outro; o contrato é o do `28`.*

## O que é

O OBS Browser Source roda no CEF; tamanho padrão 800×600 (obsproject.com/kb/browser-source).

## Fundo transparente

O CSS padrão do OBS já dá fundo transparente:

```css
body { background-color: rgba(0,0,0,0); margin: 0 auto; overflow: hidden; }
```

**O HTML não pode definir fundo opaco.**

## FPS

"Use custom frame rate" vem **desligado**; ligado, o padrão é **30 fps** (pode subir para 60). Use delta time (→ `03`, `04`).

## Descarregar fora de cena

"Shutdown source when not visible" vem desligado: ligue para **descarregar fora de cena** e não gastar CPU/GPU.

## Flags do CEF

Flags como `--enable-gpu` passam pelo atalho do OBS. O efeito da aceleração de hardware na fonte de navegador no Windows → *testar no hospedeiro real*.

## Resolução

Dimensione o canvas ao tamanho da fonte (`ResizeObserver`, → `28`) e ao `dpr`.

## Boas práticas *(convenção)*

- Sem interação: o overlay só exibe.
- Sem áudio-autoplay dependente de gesto.
- Sem `:hover`.
- Animação de entrada e saída controlada por evento externo (WebSocket, URL); esta skill não especifica o canal.

- **Não faça:** fundo opaco "só para ver"; depender de clique.

*Porquê:* overlay de transmissão é um hospedeiro real de animação transparente.

→ Relacionados: `03`, `04`, `28`, `29`
