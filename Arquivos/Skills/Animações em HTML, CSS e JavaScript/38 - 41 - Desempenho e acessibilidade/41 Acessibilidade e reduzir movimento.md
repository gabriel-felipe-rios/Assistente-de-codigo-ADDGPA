# 41 Acessibilidade e reduzir movimento

Movimento acessível: **obrigatório em toda entrega**. Abra em qualquer animação, antes de entregar.

## `prefers-reduced-motion: reduce`

Deve **remover ou trocar** movimento não essencial (gradiente animado, parallax, autoplay, revelação) e **manter o feedback funcional**. Suporte: Chrome 74, Edge 79, Firefox 63, Safari 10.1 (web.dev). Mapeia para iOS (Ajustes › Acessibilidade › Movimento), Android 9+ (Remover animações), macOS, Windows e Linux (→ `28`).

## Gatilhos vestibulares

Escalar ou deslocar objetos grandes, parallax, zoom, giro. **Troque `pulse` por `dissolve` (opacidade)** (MDN). **Fade e cor são seguros.** Padrão: comece **sem animação** e ligue só em `no-preference` (Comeau). A estatística "5–35% dos adultos" **não foi verificada: não cite**.

## Trecho

```css
@media (prefers-reduced-motion: no-preference) {
  .hero { animation: entra 500ms var(--ease-entra) both; }
}
```

```js
const mq = matchMedia('(prefers-reduced-motion: reduce)');
let reduzir = mq.matches;
mq.addEventListener('change', (e) => { reduzir = e.matches; });
```

## WCAG 2.2 (w3.org)

| Critério | Nível | O que exige |
|---|---|---|
| **2.2.2 Pause, Stop, Hide** | A | movimento que começa sozinho, dura mais de 5 s e está junto de outro conteúdo precisa de como pausar, parar ou ocultar |
| **2.3.1 Three Flashes** | A | no máximo 3 flashes por segundo, ou abaixo do limiar (variação de luminância de 10%, área de 25% de um campo visual de 10°) |
| **2.3.3 Animation from Interactions** | AAA | movimento disparado por interação deve poder ser desligado |

## Casos ligados

- **Áudio e pulso:** não pisque mais de 3×/s (→ `27`); parallax exige alternativa estática (→ `24`).
- **Hover em toque:** não deixe função só no hover (→ `28`, `35`).
- **Ambiente e loop:** pause fora da tela (→ `33`); loop infinito de ambiente precisa poder parar (2.2.2).
- **Não faça:** ignorar `prefers-reduced-motion`; desligar **tudo** (perde o feedback); tratar só como liga/desliga (→ `39`).

*Porquê:* obrigatório, e ausente é o sinal 16 de slop (→ `15`).

→ Relacionados: `15`, `24`, `28`, `39`
