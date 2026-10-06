// ═══════════════════════════════════ CANVAS DAS TELAS — A ABA TELAS ══
// O recurso Tela (`"lugar": "aba.nova"`): o programa cria o botão e o painel,
// e esta função desenha dentro.
//
// ⚠️ A tela pode ser desenhada antes de os irmãos da casca terminarem de
// carregar. Aí ela deixa o pedido em `ctPendente`, e a casca o atende quando
// o último irmão chegar.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, tela, lugar }

  xtRegistrarTela(EU.slug, EU.tela, (container, ctx) => {
    if (typeof window.ctIniciar === 'function') {
      window.ctIniciar(container, ctx);
      return;
    }
    window.ctPendente = { container, ctx };
    container.innerHTML = '<div class="ct-corpo"><nav class="ct-lista">carregando…</nav></div>';
  });
})();
