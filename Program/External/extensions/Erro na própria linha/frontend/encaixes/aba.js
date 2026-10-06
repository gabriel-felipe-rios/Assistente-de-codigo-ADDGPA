// ══════ ERRO NA PRÓPRIA LINHA — o item no menu da aba ══
// "Erros de sintaxe (N)…" abre a lista com a mensagem de cada um e um botão
// para ir até a linha. É o que a marca no código não consegue mostrar.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  xtRegistrarEncaixe(EU.slug, EU.ponto, (contexto) => {
    const caminho = contexto && contexto.caminho;
    if (!caminho || typeof window.erlAbrirModal !== 'function') return [];

    // O cache é do arquivo que está NA FRENTE — um arquivo em aba de trás
    // ainda não foi conferido, e o item diz isso em vez de sumir.
    const cache = window.erlCache || {};
    const conferido = cache.caminho === caminho;
    const n = conferido ? (cache.erros || []).length : 0;
    return [{
      icone: '⚠',
      rotulo: n ? `Erros de sintaxe (${n})…` : 'Erros de sintaxe…',
      ativo: n > 0,
      motivo: !conferido ? 'Este arquivo ainda não foi conferido — traga-o para a frente.'
                         : 'Nenhum erro de sintaxe neste arquivo.',
      fazer: () => window.erlAbrirModal(caminho),
    }];
  });
})();
