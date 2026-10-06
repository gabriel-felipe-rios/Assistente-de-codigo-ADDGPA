// ═══════════════════════════════════ CANVAS DAS TELAS — TROCOU DE ABA ══
// Observador de `aba.abriu`. A função da tela só roda na primeira vez e
// quando o projeto muda; para o servidor subir TODA vez que a aba Telas abre
// e cair toda vez que se sai dela (D44), a extensão precisa saber da troca.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, evento, guardia }
  xtAssinar(EU.slug, EU.evento, (dado) => {
    // ⚠️ `typeof`: um aviso em voo pode chegar depois do `xtDesmontar`.
    if (typeof window.ctAoMudarDeAba === 'function') window.ctAoMudarDeAba(dado && dado.aba);
    return null;
  }, EU.guardia === '1');
})();
