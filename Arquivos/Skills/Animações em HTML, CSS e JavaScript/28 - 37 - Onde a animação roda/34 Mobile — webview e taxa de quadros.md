# 34 Mobile — webview e taxa de quadros

Taxa de quadros e energia em celular. Abra ao animar dentro de app mobile ou em navegador de celular.

## Low Power Mode do iOS

Limita `requestAnimationFrame` (e animações CSS) a **30 fps**. O WebKit confirma que é intencional (bug 215745 fechado como INVALID, "exceptional device state"). **Não existe API web para detectar** (a Battery Status API não existe no WebKit): só se mede o FPS observado; rAF em ~30 fps é sintoma (→ `39`, `40`). No app nativo há `ProcessInfo.isLowPowerModeEnabled` e o host pode repassar por ponte.

## 120 Hz

- O rAF chega a 120 no Safari iOS **desde o iOS 18** (set/2024) em aparelhos ProMotion, podendo exigir desligar a flag "Prefer Page Rendering Updates near 60fps" (comentários do bug 173434; sem doc da Apple).
- **No WKWebView o rAF continua em 60 Hz**, mesmo em iPad Pro; as flags do Safari 18.3 não se aplicam; vale para Capacitor, Cordova e React Native no iOS (fórum de desenvolvedores Apple, jan/2025). **iOS 26: testar.**
- Android: existe uma flag "Throttle frame rate to 60hz" no Chrome (relato num fork, Cromite). **Não prometa 90/120 Hz no Android; testar no Chrome estável e no WebView.**

## Sem API de taxa

Ainda não há API para descobrir a taxa real nem escolher a taxa alvo do rAF (whatwg/html#8031): **meça** (→ `40`).

## Safari iOS e iframe

O rAF cai para ~30 fps em **iframes cross-origin até haver toque do usuário dentro deles** (→ `33`).

## Aparelho fraco

`navigator.deviceMemory` não é Baseline e exige HTTPS (não funciona no Safari): **não dependa dele**. Use **FPS medido** (→ `39`).

## Segundo plano

Pausa no host (`WebView.onPause`/`pauseTimers` no Android; suspensão do WKWebView com o app) → *testar no hospedeiro real*. Combine `visibilitychange` com o ciclo de vida repassado pelo host.

## Reduzir movimento

O ajuste do sistema vira `prefers-reduced-motion: reduce` no iOS e no Android 9+. Que o Battery Saver do Android também ligue a flag → *testar* (não confirmado) (→ `41`).

## Dica

Mire 30 fps para ambiente (→ `04`) e adapte a qualidade (→ `39`); limite o `dpr` (→ `28`); menos partículas e sem blur animado (→ `21`, `22`).

*Porquê:* o celular limita a taxa por energia e por webview, e nenhuma API avisa: só a medição mostra.

→ Relacionados: `04`, `28`, `33`, `39`, `40`
