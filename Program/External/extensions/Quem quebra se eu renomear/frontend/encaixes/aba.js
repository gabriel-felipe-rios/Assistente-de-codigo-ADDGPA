// ══════ QUEM QUEBRA SE EU RENOMEAR — o item no menu da aba ══
// "Quem usa as definições deste arquivo…": a lista que a marca âmbar resume.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  xtRegistrarEncaixe(EU.slug, EU.ponto, (contexto) => {
    const caminho = contexto && contexto.caminho;
    if (!caminho || typeof window.renAbrirModal !== 'function') return [];
    const cache = window.renCache || {};
    const conferido = cache.caminho === caminho && cache.ok;
    const quantas = conferido && cache.usados ? cache.usados.size : 0;
    return [{
      icone: '⇄',
      rotulo: quantas ? `Quem usa as definições deste arquivo… (${quantas})`
                      : 'Quem usa as definições deste arquivo…',
      ativo: quantas > 0,
      motivo: !conferido ? 'Este arquivo ainda não foi conferido — traga-o para a frente.'
        : 'Nenhuma definição daqui é usada por outro arquivo, ou o índice ainda não existe (aba Análise).',
      fazer: () => window.renAbrirModal(caminho),
    }];
  });
})();
