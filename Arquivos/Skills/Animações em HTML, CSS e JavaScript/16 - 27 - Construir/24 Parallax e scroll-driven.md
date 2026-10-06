# 24 Parallax e scroll-driven

Profundidade por rolagem. Abra ao ligar movimento à rolagem ou dar camadas de profundidade.

## Parallax por camadas (JS)

`translate3d` por camada num `rAF`, com o `scroll` **passivo** (`{ passive: true }`). Uma camada composta por camada de parallax.

## Truque de Keith Clark

`perspective: 1px` no contêiner que rola; `translateZ(-2px) scale(3)` no fundo; `scale = 1 + (-translateZ)/perspective`. Roda na composição 3D; alguns navegadores calculam mal o tamanho da página.

## Moderno: scroll-driven

`animation-timeline: scroll()` / `view()` roda no compositor. **Suporte:** Chrome/Edge 115+, Safari 26+, **Firefox só com flag; fora do Baseline**. **Mantenha reserva**: `@supports (animation-timeline: scroll())` e, fora dele, `IntersectionObserver` ou o parallax em JS.

```css
@keyframes sobe { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
@supports (animation-timeline: view()) {
  .item { animation: sobe linear both; animation-timeline: view(); animation-range: entry 0% cover 30%; }
}
```

No Safari, scroll-driven chegou na 26.0 (set/2025), com versão em *thread* na 26.4 *(dados de busca — testar)*.

## `perspective` e `preserve-3d`

`perspective: 800px` no pai dá ponto de fuga (`perspective-origin` o move). Perspectiva pequena exagera, grande achata. Cria contexto de empilhamento; Baseline 2015. Muitas camadas 3D aninhadas aumentam a memória de composição (MDN).

## Hierarquia

Parallax cria hierarquia temporal: o interativo mais rápido e à frente, o não interativo mais lento e ao fundo (→ `12`).

## Acessibilidade

Parallax é movimento decorativo: a web.dev manda removê-lo ou oferecer alternativa estática sob `prefers-reduced-motion` (→ `41`).

## Lenis

Rolagem suave é decisão de UX, não necessidade; não funciona em iframe (→ `06`, `33`).

- **Não faça:** *fade* de scroll em todo bloco (→ `15` #13); animar `top`/`background-position` no `scroll`; parallax em mobile sem medir (→ `34`).

*Porquê:* parallax é a profundidade barata mais pedida, e a mais abusada.

→ Relacionados: `12`, `15`, `33`, `41`
