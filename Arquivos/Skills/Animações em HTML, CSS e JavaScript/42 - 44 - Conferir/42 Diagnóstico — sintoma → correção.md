# 42 Diagnóstico — sintoma → correção

O diagnóstico rápido. Abra quando o resultado "não está bom" e você não sabe por quê.

## Os quatro sintomas

Números da skill de motion da LottieFiles: parâmetros, não lei *(convenção de ofício)*.

| Sintoma | Correção |
|---|---|
| **Robótico** | trocar linear por ease-out/in-out; arco de 10–20 px; *stagger* 50–100 ms; offset de início/fim 50–150 ms |
| **Barato ou plano** | só movimento primário → acrescentar secundário e ambiente; variar o easing entre primário e secundário; *follow-through* de 50–150 ms nos filhos; *overshoot* de 3–10%; `opacity` sozinha é pobre, combinar com posição ou escala |
| **Brusco** | estabilização de 50–100 ms no fim; *wind-up* de 100–200 ms em movimento grande |
| **Distrativo** | regra do 1/3 de elementos movendo; um herói por momento; ambiente com 10–20% de amplitude e mais lento; pausa de 100–200 ms entre batidas |

## Sintoma → causa → arquivo

| O que se vê | Abra |
|---|---|
| **seco** (sem camadas, sem fundo nem partícula) | `13`, `20`, `21` |
| **curva não suavizada** | `08`, `09` |
| **sem tempo para bater / sem ritmo** | `11` |
| **confuso** (tudo junto, sem herói) | `12` |
| **coisa demais** | `12`, `02` |
| **coisa de menos / sem riqueza** | `13`, `26` |
| **trava** | `38`, `40` |
| **some em aparelho fraco** | `39` |
| **incomoda quem tem sensibilidade a movimento** | `41` |

## Como usar

1. Identifique o sintoma.
2. Aplique a correção.
3. **Releia com a lista dos 16 sinais** (→ `15`).
4. Passe o checklist (→ `44`).

*Porquê:* sintoma → correção é o formato mais acionável para quem descreve o problema em palavras comuns.

→ Relacionados: `13`, `15`, `43`, `44`
