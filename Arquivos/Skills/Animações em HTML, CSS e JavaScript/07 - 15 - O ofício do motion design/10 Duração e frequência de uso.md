# 10 Duração e frequência de uso

Quanto dura a animação, e quando não animar. Abra ao preencher a coluna "Duração" do script de tempo (→ `07`).

## Duração por tipo

| Tipo | Duração | Fonte |
|---|---|---|
| resposta a input | 100 ms | web.dev RAIL |
| feedback simples (checkbox, toggle) | ~100 ms | NN/g |
| interações de UI | 50–150 ms | Atlassian |
| botão | 100–160 ms | Kowalski |
| dropdown | 150–250 ms | Kowalski |
| modal e mudança de tela | 200–300 ms (Kowalski: 200–500) | NN/g; Kowalski |
| transições | 150–400 ms | Atlassian |
| popup entrando / saindo | ~300 ms / 200–250 ms | NN/g |
| elementos pequenos / movimentos grandes | 200–300 / 400–500 ms | Val Head |
| *state layer* (M3) | 50–150 ms | Material 3 |
| componentes (M3) | 100–300 ms | Material 3 |
| transições com *emphasized* (M3) | 300–700 ms | Material 3 |

- A maioria fica entre 100 e 500 ms; a faixa mais segura é 100–400; perto de 500 "arrasta".
- **Entrar pode levar um pouco mais que sair** (NN/g).
- O *feeling* vale mais que o número (Val Head).
- Objetos maiores ou com percurso maior pedem duração maior (Material 1).

## Por hospedeiro (Material 1)

| Hospedeiro | Duração |
|---|---|
| mobile | ~300 ms (entrada 225, saída 195, tela cheia 375) |
| tablet | ~30% mais longo |
| wearable | ~30% mais curto |
| desktop | 150–200 ms |

Acima de 400 ms parece lento. Ver também `28`.

## A frequência de uso decide se anima

- Ação de 100+ vezes ao dia ou feita por teclado **não ganha animação** (Kowalski).
- Ação que ocorre dezenas de vezes por dia: < 150 ms (Atlassian).
- Motion expressivo só em momentos raros (Atlassian).

## Escala

- **Não escale a partir de zero:** entre com `scale(0.9–0.97)` + opacidade 0, nunca `scale(0)`.
- Feedback de clique: `scale(0.97)` em ~160 ms (Kowalski).

## Autoral pode ter mais

Página de marketing ou herói pode e deve durar mais e ter mais camadas que UI de produto. Os números acima são calibrados para produto (→ `02`, `26`).

- **Não faça:** passar de 400–500 ms em UI funcional (→ `43`).

*Porquê:* toda IA usa "300 ms ease" em tudo (→ `15`).

→ Relacionados: `02`, `08`, `11`, `28`
