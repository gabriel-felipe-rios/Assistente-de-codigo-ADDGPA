# 30 Sempre no topo, jogo e foco

Janela sempre no topo e convivência com jogo. Abra ao fazer overlay que fica acima de outros programas.

*Exemplos — o hospedeiro do seu projeto pode ser outro; o contrato é o do `28`.*

## Como pedir

| Hospedeiro | Opções |
|---|---|
| **Electron** | `alwaysOnTop` / `setAlwaysOnTop(flag, level)`: de `floating` a `status` fica **abaixo** da barra de tarefas, de `pop-up-menu` para cima fica **acima**; `focusable: false` no Windows implica `skipTaskbar: true`; `showInactive()` mostra sem tirar o foco |
| **Tauri** | `alwaysOnTop`, `focusable`, `focus`, `skipTaskbar`; `setAlwaysOnTop` exige a permissão `core:window:allow-set-always-on-top` |
| **pywebview** | `on_top`, `focus` |

## Jogos

- Em **tela cheia exclusiva** o "topmost" de janela comum **não aparece** (o jogo controla a saída de vídeo). Em **janela sem borda (borderless)** funciona.
- Para tela cheia exclusiva, a saída é mudar o jogo para borderless ou usar overlay de GPU/injeção (Game Bar, Steam, OSD). É conclusão de terceiros: **testar no hospedeiro real**, não verificada oficialmente.

## Foco

Clicar no overlay pode **roubar o foco do jogo**. Para overlay que não deve tirar o foco, use janela não focável e `showInactive()`; combine com click-through (→ `31`).

## Animação e foco

O rAF é limitado quando o app **não tem foco** em alguns hospedeiros (→ `32`). Overlay sempre no topo que fica sem foco pode perder taxa: **medir** (→ `40`).

## Topo ≠ preencher o monitor

Janela do tamanho da tela + `alwaysOnTop` **não** muda o modo de vídeo e nunca é tela cheia exclusiva (→ `31`).

## Boas maneiras

- Dê um jeito de o usuário fechar ou esconder o overlay.
- Não cubra a barra de tarefas sem necessidade.
- **Não faça:** overlay focável sobre um jogo sem testar o roubo de foco.

*Porquê:* "sempre no topo" é um dos modos de exibição pedidos, e jogo é o caso em que ele mais falha.

→ Relacionados: `28`, `29`, `31`, `32`
