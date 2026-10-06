// ═══════════════════════════════════ CANVAS DAS TELAS — FECHOU O PROJETO ══
// Observador de `projeto.fechou`: sair do projeto também é sair da aba — o
// servidor das telas cai (D44), e o que o site guardou some se "Não guardar"
// estiver ligado (D45).

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, evento, guardia }
  xtAssinar(EU.slug, EU.evento, () => {
    if (typeof window.ctAoSair === 'function') window.ctAoSair();
    return null;
  }, EU.guardia === '1');
})();
