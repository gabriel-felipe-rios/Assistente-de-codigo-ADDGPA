// ══════ SERVIDOR LOCAL COM RECARGA — observador de `projeto.fechou` ══
// Fechou o projeto (ou trocou de aba de projeto): o servidor DELE cai.
//
// Sem isto, a pasta do projeto fechado continuaria exposta em
// `http://127.0.0.1:<porta>/` — o servidor responderia por algo que não está
// mais aberto no programa. O backend só para se o servidor no ar for o deste
// projeto.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, evento, guardia }

  xtAssinar(EU.slug, EU.evento, (dado) => {
    if (typeof window.svlChamar !== 'function') return;   // casca já desmontada
    window.svlChamar('parar', { projeto: dado && dado.projeto }).then(() => {
      if (typeof window.svlLerEstado === 'function') window.svlLerEstado();
    });
  }, EU.guardia === '1');
})();
