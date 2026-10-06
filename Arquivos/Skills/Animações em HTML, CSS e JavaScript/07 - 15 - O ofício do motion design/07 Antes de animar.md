# 07 Antes de animar

O que fazer **antes** de escrever código de animação. Abra no começo de qualquer pedido de animação.

## Deve animar? Qual o propósito?

Movimento com propósito faz uma de três coisas: **comunica mudança de estado**, **dirige a atenção** ou **carrega o caráter do produto**. Se não faz nenhuma, não anime (Kowalski; Apple: "purposeful", sem movimento "for the sake of adding motion").

## As três perguntas

Responda **sozinha**, sem perguntar ao usuário:

1. O que a animação comunica?
2. Qual é a ordem de leitura e quem é o herói?
3. Qual é a ação secundária ou o ambiente?

## O script de tempo

Uma tabela escrita **antes do código**: curva, duração e atraso por elemento.

| Elemento | Papel | Propriedade | Curva | Duração | Atraso | Por quê |
|---|---|---|---|---|---|---|
| título | herói | `transform` + `opacity` | expo-out | 500 ms | 0 | dirige o olhar |
| subtítulo | apoio | `transform` + `opacity` | quart-out | 400 ms | 80 ms | *follow-through* do título |
| fundo | ambiente | `transform` | linear/lenta | 20 s, loop | — | profundidade |

Os valores são **exemplo ilustrativo**: derive-os do papel (→ `02`, `08`, `10`).

*Porquê:* falta pensar **como** a animação acontece. O script força decidir ordem, curva e ritmo antes do código. É uma prática proposta por esta skill; nenhuma fonte a valida como técnica, então não diga que "a pesquisa prova".

## Ordem de trabalho

1. Papel (→ `02`)
2. Herói e hierarquia (→ `12`)
3. Script de tempo
4. Técnica (→ `01`)
5. Código
6. Conferir (→ `44`)

## A conduta

Decida sozinha o que o pedido não disse, construa e feche com a linha "**Assumi:** …" listando o que assumiu. Não pergunte nem peça aprovação de plano.

- **Faça:** script de tempo, mesmo curto, em toda animação com mais de um elemento.
- **Não faça:** abrir o editor e sair animando `opacity` de tudo.

→ Relacionados: `02`, `08`, `12`, `44`
