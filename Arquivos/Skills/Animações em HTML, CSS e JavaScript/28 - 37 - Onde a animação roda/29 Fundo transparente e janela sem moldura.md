# 29 Fundo transparente e janela sem moldura

Como pedir transparência. Abra ao fazer overlay, widget ou personagem sobre a área de trabalho.

*Exemplos — o hospedeiro do seu projeto pode ser outro; o contrato é o do `28`.*

## Regra geral

**`<html>` e `<body>` com fundo opaco anulam a transparência.**

```css
html, body { background: transparent; margin: 0; }
```

A transparência é pedida **ao hospedeiro**, e a janela precisa ser sem moldura (*frameless*). Sempre **testar no hospedeiro real**.

## Exemplos por hospedeiro

| Hospedeiro | Como pedir | Limites / avisos |
|---|---|---|
| **Electron** | `transparent: true` + `frame: false` (no Windows só funciona sem moldura); `backgroundColor` aceita alfa `#AARRGGBB` | por padrão não se clica **através** do transparente; janela **não redimensionável** (`resizable: true` pode quebrar); `blur()` do CSS não afeta o que está atrás da janela; com o DevTools aberto deixa de ser transparente; não maximiza pelo menu do sistema nem por duplo clique (docs `custom-window-styles`). Relatos de fundo **preto** com aceleração de hardware ligada (contorno `app.disableHardwareAcceleration()` vale para o app todo; issue 27253); "transparente + click-through + GPU desligada" **parou de funcionar entre Chromium 138 e 139** (issue 48064). Windows 11: sombra e borda indesejadas em frameless transparente a partir do Electron 35.1.3, sem contorno documentado (issue 46468); `roundedCorners` só do build 22000 em diante |
| **Tauri v2** | `transparent: true` + `decorations: false` | `shadow: true` em janela sem moldura adiciona borda de 1 px e cantos arredondados no Windows 11; `WindowBuilder::transparent()` recomenda `no_redirection_bitmap` para evitar flash branco; em `setBackgroundColor` o alfa é **ignorado** no Windows; há issue aberta: o mesmo config do v1 não fica transparente no v2 (issue 8308) → *testar* |
| **WebView2 puro** | `DefaultBackgroundColor` com alfa 0 mostra o app hospedeiro por baixo | **só existem alfa 0 e 255** (outro valor dá `E_INVALIDARG`); página com fundo opaco encobre; pode piscar branco antes de valer: a variável de ambiente `WEBVIEW2_DEFAULT_BACKGROUND_COLOR` (`AARRGGBB`) resolve; no WinUI 3, transparente pinta o pincel do tema (issue 6527); transparência sobre a **área de trabalho** exige a **janela hospedeira** também transparente (WS_EX_LAYERED/DWM), sem doc oficial dessa combinação → *testar no hospedeiro real* |
| **pywebview** | `transparent`, `frameless=True`, `background_color` | ⚠️ **doc, código e issues se contradizem**: a doc da API diz que `transparent` "não é suportado no Windows" e o `background_color` é opaco por padrão; o backend Edge/WebView2 trata `transparent` com `DefaultBackgroundColor = Transparent`; o changelog da 6.0 diz "Fix window transparency" (issue 1653); em mar/2025 relataram no Windows 11 o fundo na cor do tema (issue 1611). **Não afirme: teste na versão em uso** |
| **Qt WebEngine** | QML: `backgroundColor: "transparent"`; Widgets: `FramelessWindowHint`, `WA_TranslucentBackground` na janela e no view, `page().setBackgroundColor(Qt.transparent)` | no Windows o `WA_TranslucentBackground` só funciona com frameless ou `QOpenGLWidget` (fórum Qt) |

## Outros contextos

- **Mobile:** em webview de iOS/Android a transparência é outra receita (→ `35`).
- **Iframe em site:** depende do `color-scheme` (→ `33`).
- **Ativos com alfa** (vídeo/imagem): → `36`. **OBS:** a transparência já vem do CSS padrão (→ `37`).

## Sem moldura ≠ sem cuidados

Janela sem moldura precisa de área de arrastar própria e botão de fechar. A sombra e a borda do Windows 11 podem aparecer (ver Electron e Tauri acima).

- **Não faça:** fundo `#000` "só para ver" e esquecer; blur no `body` esperando ver através da janela; `resizable: true` sem testar (Electron).

*Porquê:* "fundo transparente" é um dos modos de exibição pedidos, e falha em silêncio: a janela só fica preta.

→ Relacionados: `28`, `30`, `31`, `36`
