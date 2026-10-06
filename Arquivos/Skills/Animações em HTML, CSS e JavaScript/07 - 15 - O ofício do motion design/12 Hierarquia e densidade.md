# 12 Hierarquia e densidade

Quem manda na tela e quanta coisa cabe se movendo. Abra ao compor uma cena com mais de um elemento animado.

## Um foco por vez

Um evento lidera, os outros apoiam. Quando tudo se move junto, o espectador agrupa os elementos e não percebe funções individuais; *offset* e *delay* criam relações (Toptal). *Staging* é o princípio Disney de dirigir o olhar. Em transições, compartilhe só os elementos mais importantes (Material, Atlassian).

## A densidade certa

Não existe fonte forte para "número máximo de elementos animando ao mesmo tempo". A regra é **um ponto focal com apoio**.

| Regra | Status |
|---|---|
| no máximo ~1/3 dos elementos em movimento ao mesmo tempo ("regra do 1/3") | convenção pessoal de ofício — parâmetro, não lei |
| 3 a 5 grupos de movimento | idem |

## Ambiente

10–20% de amplitude e mais lento que o herói; pausa de 100–200 ms entre batidas *(convenção de ofício)*.

## O espaço estático dá estabilidade

Nem todo elemento precisa de animação; elementos estáticos dão estabilidade visual. Deixe o olho descansar.

## De onde vem a hierarquia

*Offset/delay*, *parallax*, *parenting* e *overlay* (Willenskomer). Parallax cria hierarquia temporal: o interativo mais rápido e à frente, o não interativo mais lento e ao fundo (→ `24`).

- **Faça:** um herói por momento; secundário sempre mais discreto.
- **Não faça:** todo elemento fazendo fade-up junto; ambiente que compete com o herói; mais de um herói por momento.

## Teste rápido *(recomendação da skill)*

Pause no meio da animação. Dá para dizer, em um segundo, o que é o herói? Se não, falta hierarquia.

*Porquê:* "coisa demais na tela" e "coisa de menos" são as queixas diretas do usuário; a hierarquia é o que separa as duas.

→ Relacionados: `02`, `11`, `13`, `24`
