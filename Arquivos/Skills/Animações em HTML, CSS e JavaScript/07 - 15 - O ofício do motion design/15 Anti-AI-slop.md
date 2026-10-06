# 15 Anti-AI-slop

Os padrões preguiçosos de animação que a IA repete: seca, sem detalhe, curva sem suavizar, sem tempo para bater, confusa, coisa demais ou de menos, sem riqueza. Abra ao terminar de escrever, antes do checklist (→ `44`).

## Causa raiz: convergência

Sem direção, o modelo amostra o "centro de alta probabilidade" dos dados da web (Inter, gradiente roxo, animação mínima) (Anthropic, nov/2025). O guia oficial de estética manda evitar "gradiente roxo sobre branco" e "design de forma de bolo", e focar em **momentos de alto impacto** e **atmosfera/profundidade**. Ele trata movimento em **uma linha**: não dá easing, duração nem hierarquia. É isso que esta skill acrescenta.

## O sinal mais citado

Todo elemento faz *fade-up* junto, numa curva `ease` de 300 ms, às vezes com stagger de 50 ms: "movimento sem intenção". Ou nada se move, ou tudo faz fade com o mesmo tempo.

## Os 16 sinais

| # | Sinal | Antídoto | Confiança |
|---|---|---|---|
| 1 | *Fade-up* em todo elemento, no load | um só momento orquestrado; papéis diferentes se movem diferente | oficial + ofício |
| 2 | mesma duração e mesmo easing em tudo (300 ms `ease`) | tabela de duração por papel; curva custom (expo/quart-out) | autor/ofício |
| 3 | `ease` padrão do CSS e linear | ease-out entrada, ease-in saída, ease-in-out na tela; cúbicas custom | oficial (Figma) |
| 4 | *stagger* uniforme (50 ms fixos) ou tudo junto | atrasos irregulares, ordem pela leitura, total < 500 ms, pausa entre batidas | ofício |
| 5 | sem hierarquia: tudo compete | um herói por momento; regra do 1/3; secundário nunca compete | ofício |
| 6 | sem ação secundária, *follow-through* ou *overlap* | filhos com atraso de 50–150 ms; sombra, ícone e ambiente reagindo | ofício |
| 7 | sem *anticipation* nem *settle* | *wind-up* 100–200 ms; *settle* 50–100 ms; *overshoot* 3–10% | ofício |
| 8 | só `opacity`, sem arco nem profundidade | combinar com posição, escala, blur; arco 10–20 px; camadas em velocidades diferentes | ofício |
| 9 | fundo sólido ou halo radial genérico | camadas de gradiente, padrões geométricos, efeito contextual; ambiente lento; partículas e ruído só se combinarem com o tema | oficial + ofício |
| 10 | *bounce/elastic* exagerado em UI | mola amortecida, *overshoot* pequeno, resolve rápido | ofício |
| 11 | hover `scale(1.05)` em tudo, ou hover que não faz nada | hover com significado (elevação com sombra, sublinhado, *press* `scale(0.97)`) | ofício |
| 12 | decoração viva: ponto pulsante, cursor piscando, *marquee*, blobs animados | remover; movimento só onde sinaliza atividade ou estado real | ofício |
| 13 | *fade* de scroll em todo bloco | só onde ajuda a narrativa; dispare antes de entrar na viewport | opinião |
| 14 | animar layout; `transition: all` | só `transform`/`opacity`; `grid-template-rows` para altura; nomear as propriedades | autor/ofício |
| 15 | *glassmorphism*, roxo e neon como decoração | blur só para problema real de camada; cor e brilho com função | oficial (roxo) + ofício |
| 16 | sem `prefers-reduced-motion`; sem *gate* de hover em touch | obrigatório (→ `41`) | autor/ofício |

Outros sinais citados: imagem que se mexe no hover; halo radial atrás do conteúdo e *spotlight* suave; modo escuro com brilho neon; sombra suave e blobs de gradiente animados como decoração (Bakaus, Adpharm).

## O contrapeso (opinião — cite como aviso)

"Death to Scroll Fade" (Hacker News): fade de scroll em tudo enjoa e quase nunca é bem feito. **Mais movimento não é a solução; o problema é movimento sem ideia.** Um comentário sugere que o conselho "alto impacto/delicado" do guia da Anthropic amplifica o fade de scroll (opinião).

## Os dois campos

Contido em UI funcional × rico em momentos autorais. O diagnóstico típico ("seco, faltam fundo e partículas") é o segundo campo aplicado ao papel errado (→ `02`).

## Aviso de honestidade

**Não existe estudo quantitativo** de "animação de IA × humana". Tudo aqui é opinião de praticante ou guia de empresa.

## Como usar

Rode a tabela contra o que acabou de escrever, antes do checklist (→ `44`). Sintoma → correção: `42`.

*Porquê:* a IA repete os mesmos atalhos; nomeá-los é a forma de não repeti-los.

→ Relacionados: `02`, `42`, `44`
