# 33 Dentro de um site ou iframe

Animação numa página web ou embutida em iframe. Abra ao publicar em site ou embutir em outra página.

## Transparência em iframe

Regra da spec (CSS Color Adjust): se o `color-scheme` do elemento iframe e o do documento raiz embutido **diferirem**, o navegador **usa um canvas opaco** em vez de transparente.

Correção prática (blogs e issue; a spec confirma só a regra): no documento embutido declare `:root { color-scheme: light dark }` para casar com o pai. Como não dá para saber o esquema do pai, o mais seguro é o iframe embutido **não declarar `color-scheme` nenhum**, ou o pai declarar `color-scheme: normal` no iframe. *Testar em cada hospedeiro.*

## Pausar fora da tela

Navegadores param os callbacks do rAF em aba ou iframe oculto. Use `visibilitychange` para pausar timers, animações e rede na mão; `IntersectionObserver` condiciona a animação à visibilidade, sem `getBoundingClientRect()` em polling. `display: none` num iframe **não** dispara `visibilitychange`: combine (→ `28`).

```js
let rodando = false;
new IntersectionObserver(([e]) => { e.isIntersecting ? iniciar() : parar(); }).observe(canvas);
document.addEventListener('visibilitychange', () => document.hidden ? parar() : iniciar());
```

## Chrome e iframe cross-origin

Iframe cross-origin fora da viewport é *throttled* no Chrome (rAF, ResizeObserver) **sem margem: 1 px fora já conta**. Há também *render-throttle* de iframe cross-origin `display: none`. Ao entrar na tela, reative com `IntersectionObserver` (blink-dev).

## Outros pontos

- **`content-visibility: auto`** pula render fora da tela, mas **não substitui pausar o rAF** (→ `05`).
- **Orçamento** *(regra de bolso)*: **uma animação ativa por vez**, com `IntersectionObserver` e **um único rAF compartilhado**. Isolamento de CSS (Shadow DOM, Web Components), `loading="lazy"` em iframe e orçamento de várias animações por página: *testar* (não verificados).
- **Container queries** para o widget responder ao contêiner (→ `28`). Lenis não funciona em iframe (→ `06`).
- **Safari iOS:** o rAF cai para ~30 fps em **iframes cross-origin até haver toque do usuário dentro deles**. Ao embutir em iOS, gere um toque ou use o mesmo origin (Motion) (→ `34`).
- **Aba oculta:** timers a 1×/s e depois 1×/min; não use `setTimeout` como plano B (→ `03`).
- **Autoplay:** animação que começa sozinha e dura mais de 5 s precisa de pausar/parar (→ `41`).

*Porquê:* num site você não controla o hospedeiro: a animação precisa se pausar sozinha e sobreviver ao iframe.

→ Relacionados: `03`, `28`, `34`, `41`
