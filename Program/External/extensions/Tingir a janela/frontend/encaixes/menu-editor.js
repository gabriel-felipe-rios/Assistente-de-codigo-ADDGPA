// ══════ TINGIR A JANELA — o item no menu da árvore do Editor ══
// Aparece só no clique direito na RAIZ da árvore: tingir é do projeto inteiro,
// e oferecer o item em cima de um arquivo sugeriria que a cor é daquele
// arquivo.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  xtRegistrarEncaixe(EU.slug, EU.ponto, (contexto) => {
    // Devolver [] é o NORMAL: item que não se aplica ao alvo não entra.
    if (!contexto || contexto.tipo !== 'raiz') return [];
    return [{
      icone: '◧',   // glifo, nunca emoji
      rotulo: 'Tingir a janela…',
      fazer: () => window.tinAbrirModal(),
    }];
  });
})();
