// ═══════════════════════════════════ CANVAS DAS TELAS — SALVOU ══
// Observador de `editor.salvou`: "Redesenhar a cada Ctrl+S" (D2, F22). A
// lógica mora em `ct-eventos.js`.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, evento, guardia }
  xtAssinar(EU.slug, EU.evento, (dado) => {
    if (typeof window.ctAoSalvar === 'function') window.ctAoSalvar(dado);
    return null;
  }, EU.guardia === '1');
})();
