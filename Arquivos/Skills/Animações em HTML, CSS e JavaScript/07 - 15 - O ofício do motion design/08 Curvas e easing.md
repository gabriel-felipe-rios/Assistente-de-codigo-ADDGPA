# 08 Curvas e easing

Como escolher a curva de cada movimento. Abra ao escrever qualquer `transition`, `@keyframes` ou `animate()`.

## A base

Nada no mundo físico começa ou para instantaneamente. **Linear é robótico**: serve só para movimento mecânico (spinner, barra de progresso, *marquee*, "segurar para apagar", rotação contínua). O `ease` padrão do CSS é fraco; uma curva custom "forte" é preferível (Figma; Toptal; animations.dev).

## Regra de direção (Material/Figma)

| Movimento | Curva |
|---|---|
| **entrar** | ease-out (desacelera) |
| **sair** | ease-in (acelera) |
| **dentro da tela** | ease-in-out |

Usar a mesma curva nos dois sentidos viola a diretriz. Ressalva de Kowalski: em UI de resposta imediata (hover, abrir) **não use ease-in**, porque começa devagar e parece atrasado *(inferência)*.
**Ease assimétrico** (aceleração rápida, desaceleração longa) é a regra do Material; simetria total é exceção.

## Timing × spacing

- *Timing* é **quando** (quadros, pausas). *Spacing* é **como** o movimento se distribui entre os quadros.
- *Slow in/slow out* (Thomas & Johnston, *The Illusion of Life*, 1981) é questão de spacing.
- No graph editor do After Effects: curva plana = lento, íngreme = rápido; o comprimento do *handle* Bézier é a **influência** (longo = easing mais pronunciado) (School of Motion).

## Curvas prontas

| Origem | Curva | Uso |
|---|---|---|
| Material 1 — standard | `cubic-bezier(0.4, 0, 0.2, 1)` | movimento dentro da tela |
| Material 1 — decelerate | `cubic-bezier(0, 0, 0.2, 1)` | entrar |
| Material 1 — accelerate | `cubic-bezier(0.4, 0, 1, 1)` | sair |
| Material 1 — sharp | `cubic-bezier(0.4, 0, 0.6, 1)` | elemento que pode voltar |
| Material 3 — emphasized | `cubic-bezier(0.2, 0, 0, 1)` | transição expressiva |
| Material 3 — decelerate | `cubic-bezier(0.05, 0.7, 0.1, 1)` | entrar |
| Material 3 — accelerate | `cubic-bezier(0.3, 0, 0.8, 0.15)` | sair |
| Atlassian — ease-out bold | `cubic-bezier(0, 0.4, 0, 1)` | entrada marcada |
| Atlassian — ease-in-out bold | `cubic-bezier(0.4, 0, 0, 1)` | movimento na tela |
| Atlassian — ease-in | `cubic-bezier(0.6, 0, 0.8, 0.6)` | saída |
| Kowalski — entrada | `cubic-bezier(0.23, 1, 0.32, 1)` | entrada forte |
| Kowalski — movimento na tela | `cubic-bezier(0.77, 0, 0.175, 1)` | movimento na tela |
| Kowalski — drawer estilo iOS | `cubic-bezier(0.32, 0.72, 0, 1)` | gaveta |

Material 1, Material 3 e Atlassian são documentação oficial; Kowalski é autor conhecido.

## Famílias (easings.net)

sine, quad, cubic, quart, quint, expo, circ, back, elastic, bounce, cada uma em in/out/inOut. Uso sugerido — *convenção de ofício, sem fonte única*:

- quad/cubic: UI comum.
- quart/quint/expo: entradas "cinematográficas".
- back: *overshoot* pequeno.
- elastic/bounce: só como marca, em momentos raros. Durações maiores compensam curvas com bounce ou elastic (Val Head).

## Caráter

A curva reflete o caráter do produto (Figma): produto sério → curvas contidas; brincalhão → mais overshoot.

- **Não faça:** mesma curva em tudo; `ease` padrão em tudo; ease-in em resposta imediata; `transition: all` (→ `43`).

*Porquê:* "a curva não está suavizada" é o primeiro sintoma de animação seca (→ `15`).

→ Relacionados: `09`, `10`, `14`, `15`
