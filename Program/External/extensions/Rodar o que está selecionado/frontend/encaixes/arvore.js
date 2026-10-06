// ══════ RODAR O QUE ESTÁ SELECIONADO — clique direito na ÁRVORE ══
// Só "Rodar este arquivo": na árvore não há trecho nenhum marcado, e o arquivo
// nem precisa estar aberto.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  xtRegistrarEncaixe(EU.slug, EU.ponto, (contexto) => {
    if (!contexto || contexto.tipo !== 'arquivo' || !contexto.caminho) return [];
    if (typeof window.rodRodarArquivo !== 'function') return [];   // casca já desmontada
    return [{
      icone: '▶',
      rotulo: 'Rodar este arquivo',
      fazer: () => window.rodRodarArquivo(contexto.caminho),
    }];
  });
})();
