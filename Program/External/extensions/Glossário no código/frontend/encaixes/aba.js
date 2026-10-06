// ══════ GLOSSÁRIO NO CÓDIGO — o item no menu da aba ══
// "Vocabulário neste arquivo…": a lista do que está riscado (e o que deveria
// ser) e dos termos encontrados, com "ir para a linha".

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  xtRegistrarEncaixe(EU.slug, EU.ponto, (contexto) => {
    const caminho = contexto && contexto.caminho;
    if (!caminho || typeof window.gloAbrirModal !== 'function') return [];
    const fonte = window.gloRegex;
    const temVocabulario = !!(fonte && (fonte.termos || fonte.proibidos));
    return [{
      icone: '◈',
      rotulo: 'Vocabulário neste arquivo…',
      // Cinza, e não ausente: quem não tem Vocabulário no projeto precisa
      // descobrir que a extensão existe e o que ela espera.
      ativo: temVocabulario,
      motivo: temVocabulario ? undefined
        : 'Este projeto não tem Saída das skills/Terminologia e nomenclatura/Vocabulário.md.',
      fazer: () => window.gloAbrirModal(caminho),
    }];
  });
})();
