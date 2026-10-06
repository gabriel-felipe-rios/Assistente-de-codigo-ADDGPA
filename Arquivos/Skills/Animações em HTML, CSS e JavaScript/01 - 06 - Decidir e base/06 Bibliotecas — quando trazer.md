# 06 Bibliotecas — quando trazer

Qual biblioteca de animação usar, e quando não usar nenhuma. Abra antes de propor dependência.

## Postura

O padrão é **CSS / WAAPI / rAF**. A biblioteca entra só quando o nativo não resolve, e sempre como **cópia local** (o arquivo minificado ou ESM na pasta do projeto, não CDN). Pergunta de defesa: → `01`.

**CSS/WAAPI bastam para:** hover, fade, slide, expansão de painel, skeleton, spinner, transição de estado, *scroll reveal* (com scroll-driven) e transição entre telas (View Transitions) *(síntese — convenção de ofício)*.

## Tabela (estado em 29/09/2026)

| Biblioteca | Licença | Manutenção | Peso | Para quê |
|---|---|---|---|---|
| **GSAP** 3.15 (+ScrollTrigger, SplitText, Flip…) | "Standard License", **gratuita** (inclusive comercial e plugins antes pagos) desde 30/04/2025, após a Webflow; **não é MIT**; veta uso em ferramenta visual que concorra com a Webflow; código gerado por IA permitido | ativa (13/04/2026) | núcleo ~22–25 kB gz; ScrollTrigger ~18 kB gz | timelines longas, ScrollTrigger complexo, SplitText, morph SVG |
| **Motion** (ex-Framer Motion) 13.x | MIT | ativa (29/09/2026) | `animate()` mini 2,3 kB; híbrido ~17 kB | React (`motion/react`), layout, saída, gestos, molas, `scroll()`; há pacote JS puro e Vue |
| **anime.js** v4 | MIT | ativa (4.5.0, 22/06/2026) | não verificado | API simples, timelines, stagger, SVG, `draggable`; opção leve sem React |
| **Popmotion** | — | **parada** (último commit 15/08/2022) | ~4,5 kB | baixo nível (molas, decay) — evitar |
| **AutoAnimate** 0.10 | MIT | ativa (10/07/2026) | ~2 kB | uma linha para lista que entra/sai/reordena |
| **Lenis** 1.3 | MIT | ativa (05/08/2026) | poucos kB | rolagem suave; não funciona em iframe; 60 fps no Safari; é decisão de UX, não necessidade |
| **Theatre.js** 0.7 | Apache-2.0 | **baixa** (último commit 11/04/2024) | — | editor de timeline visual |
| **lottie-web** 5.13 | MIT | **lenta** (último release nov/2024) | pacote npm 25 MB (não é o bundle) | tocar animação do After Effects |
| **dotLottie** 0.80 | MIT | ativa (28/08/2026) | traz `.wasm` | `.lottie` compacto, temas, máquinas de estado; Canvas2D/WebGL2 |
| **Rive** runtime 2.43 | MIT (runtime); o editor é serviço da Rive — licença/preço não verificado | ativa (23/09/2026) | traz `.wasm` | animação interativa com máquina de estado |
| **Three.js** r186 | MIT | ativa (24/09/2026) | pesado | 3D |
| **PixiJS** 8.21 | MIT | ativa (17/09/2026) | não verificado | 2D acelerado (sprites, muitos objetos) |
| **tsParticles** 4.4 | não verificado | ativa (31/08/2026) | não verificado | partículas configuráveis |
| **Spline** runtime | não verificado (npm sem licença declarada; `viewer` ~7,2 MB) | — | — | cenas 3D exportadas do editor |

"Não verificado" é instrução: **verifique licença e peso antes de adotar**.

## Regras de decisão

- **Motion**: só se o projeto for React e precisar de layout, saída, gestos ou molas.
- **GSAP**: timeline longa e ScrollTrigger complexo.
- **anime.js**: opção leve sem React.
- **dotLottie**: quando um designer entrega animação do After Effects.
- **Rive**: quando a animação reage a estado.
- **Three / Pixi / tsParticles / Spline**: só para 3D, jogo ou partículas (→ `21`).

## Critérios (uma linha cada)

- **Peso:** kB gz contra o tamanho da página.
- **Manutenção:** data do último release.
- **Licença:** leia a real, não a lembrada.
- **Local:** biblioteca com WASM precisa do `.wasm` junto; o comportamento de cada uma → *testar no hospedeiro real*. O GSAP oferece zip oficial.
- **Custo de remoção:** esconda a biblioteca atrás de uma função própria.

## O que o projeto já tem vence acrescentar

Antes de propor uma biblioteca, liste as dependências que o projeto já usa.

*Porquê:* o usuário trabalha 100% local, e cada dependência nova é peso, licença e manutenção que ele carrega.

→ Relacionados: `01`, `21`, `36`
