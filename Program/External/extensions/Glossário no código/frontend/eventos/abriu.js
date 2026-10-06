// ══════ GLOSSÁRIO NO CÓDIGO — observador de `projeto.abriu` ══
// Abriu um projeto: lê o Vocabulário dele, uma vez.
//
// ⚠️ Uma vez POR PROJETO, e nunca por tecla. É este evento que existe para o
// gancho do decorador poder ser uma expressão regular em memória.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, evento, guardia }

  xtAssinar(EU.slug, EU.evento, (dado) => {
    // A casca pode já ter sido desmontada — um aviso em voo ainda chega.
    if (typeof window.gloCarregar !== 'function') return;
    window.gloCarregar(dado && dado.projeto);
  }, EU.guardia === '1');
})();
