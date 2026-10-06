# 31 Preencher o monitor, DPI e click-through

Janela que cobre o monitor e deixa o mouse passar. Abra ao fazer overlay de tela inteira.

*Exemplos — o hospedeiro do seu projeto pode ser outro; o contrato é o do `28`.*

## Preencher o monitor

- Electron `setBounds` usa **DIP**, não pixel físico. Com escalas diferentes por monitor, chamar enquanto a janela ainda pertence a outro monitor a reinterpreta e pode fazê-la **pular ou crescer** (docs + issue 10659).
- `display.bounds` cobre a tela toda, inclusive a barra de tarefas; `workArea` fica acima dela.
- `fullscreen` e `kiosk` são opções à parte. **Janela frameless do tamanho de `display.bounds` com `alwaysOnTop` não muda o modo de vídeo e nunca é tela cheia exclusiva.**
- Tauri: `fullscreen`, `maximized`, `prevent_overflow`.

## Vários monitores e escala do Windows

Ache o monitor pelo cursor ou pela janela; mova **antes** de redimensionar; teste com escalas diferentes (100% + 150%). O canvas usa `devicePixelRatio` (→ `28`).

## Click-through (o mouse atravessa)

| Hospedeiro | Como |
|---|---|
| **Electron** | `win.setIgnoreMouseEvents(true, { forward: true })`. `forward` vale no macOS e Windows e repassa só os movimentos do mouse (o clique passa). Padrão "só o transparente deixa passar": ouvir `mousemove`, ver o elemento sob o cursor e alternar o `ignore` |
| **Tauri** | `setIgnoreCursorEvents` na janela **inteira**, sem região; o contorno é um laço em Rust a ~60 Hz. Bug aberto (issue 11461) e pedido de região (issue 6164). Exige a permissão `core:window:allow-set-ignore-cursor-events` |
| **pywebview / WebView2 puro / Qt** | sem fonte oficial pesquisada. `WS_EX_TRANSPARENT \| WS_EX_LAYERED` via API do Windows é a técnica esperada: **testar no hospedeiro real** com WebView2 |

```js
// Electron (renderer): alterna o click-through conforme o elemento sob o cursor
window.addEventListener('mousemove', (e) => {
  const sobre = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-clicavel]');
  ipc.send('ignorar-mouse', !sobre);   // no main: win.setIgnoreMouseEvents(ignorar, { forward: true })
});
```

## Cuidados

Click-through total impede usar a própria animação (botões). Planeje uma zona clicável ou um atalho para alternar.

- **Não faça:** achar que `fullscreen` do CSS/JS preenche todos os monitores; redimensionar em DIP e ler em pixel físico.

*Porquê:* "preencher o monitor" esbarra na escala do Windows, que muda de monitor para monitor.

→ Relacionados: `28`, `29`, `30`
