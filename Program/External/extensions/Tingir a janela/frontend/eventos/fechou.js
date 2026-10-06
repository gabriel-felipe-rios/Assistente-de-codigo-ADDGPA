// ══════ TINGIR A JANELA — observador de `projeto.fechou` ══
// Voltou para a lista de projetos: a moldura sai. Sem isto, a cor do último
// projeto ficaria na tela da lista, sugerindo um projeto aberto que não há.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, evento, guardia }

  xtAssinar(EU.slug, EU.evento, () => {
    if (typeof window.tinTirar !== 'function') return;   // casca já desmontada
    window.tinTirar();
  }, EU.guardia === '1');
})();
