# 13 Riqueza — camadas, ação secundária e profundidade

O que somar a uma animação seca, e quando parar. Abra quando o resultado estiver "seco" ou "sem detalhe".

## Riqueza é camada com papel

Ação secundária complementa a principal e dá profundidade. Ingredientes, "não receita" (Derek Lieu): gradientes, sombras e vinheta para profundidade; textura em texto e fundo; sequências escalonadas; curvas no graph editor; *glow*, *light sweeps* e raios de luz; **partículas**; *depth of field*; *camera shake*; e "falhas", porque o computador produz coisas limpas demais. *Motion blur* simula o borrão de câmera; *grain* é ruído que simula película (School of Motion).

## Camada → papel → receita

| Camada | Papel | Receita |
|---|---|---|
| fundo em camadas / vivo | profundidade, atmosfera | `20` |
| partículas | ritmo, marca (celebração, ambiente, ênfase) | `21` |
| glow, light sweep, sombra que responde à altura | foco, profundidade | `22` |
| rastro / motion blur | sensação de velocidade | `23` |
| parallax | profundidade, hierarquia temporal | `24` |
| grão | textura, marca | `20` |
| ação secundária (ícone, sombra reagindo) | ritmo | `11` |

## A fluidez vem do que há em cada quadro

Segundo a Apple, deformação elástica e blur reduzem o *strobing* (→ `04`).

## O guia oficial de estética da Anthropic

Foque em **momentos de alto impacto**: uma entrada de página bem orquestrada, com revelações escalonadas, vale mais que micro-interações espalhadas. Crie **atmosfera e profundidade** em vez de fundo sólido (camadas de gradiente CSS, padrões geométricos, efeitos contextuais).

## Quando a riqueza vira ruído

- Cada camada precisa de um papel (profundidade, foco, ritmo ou marca). **Sem papel, corte.**
- Apple: não adicione movimento "por adicionar"; animação gratuita distrai e desconecta.
- *Glow*/bloom exagerados ou grão pesado prejudicam a legibilidade *(opinião de ofício — não verificado)*.
- Mais movimento não é a solução; o problema é movimento sem ideia (→ `15`).

## Detalhes

- Blur de máscara em crossfade: mantenha < 20 px (Kowalski).
- Sombra que sobe ganha mais *offset*, mais blur e menos opacidade; várias camadas (Comeau) → `22`.
- A riqueza mora nos papéis **autoral** e **ambiente**; em UI funcional é mínima (→ `02`).

*Porquê:* "falta riqueza de detalhes; fundo e partícula fazem muita diferença" — palavras do usuário.

→ Relacionados: `02`, `12`, `20`, `21`, `22`
