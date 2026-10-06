// ══════ PRÉVIA DE IMAGEM — o item no menu da aba ══
// "Imagens deste arquivo…" — a prévia que o clique na marca não pode dar.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  xtRegistrarEncaixe(EU.slug, EU.ponto, (contexto) => {
    const caminho = contexto && contexto.caminho;
    if (!caminho) return [];
    // A casca pode já ter sido desmontada (o programa tira o encaixe do
    // registro antes, mas um menu aberto no instante do desligar ainda chega).
    if (typeof window.imgAchar !== 'function' || typeof window.imgAbrirModal !== 'function') return [];

    // O texto vem do Editor, pela porta que ele empresta às extensões —
    // nunca cutucando `_edPaineis`, que é interno e muda.
    const aberto = (typeof edArquivoAberto === 'function') ? edArquivoAberto(caminho) : null;
    if (!aberto || aberto.binario) return [];
    const texto = aberto.texto;

    const achados = window.imgAchar(texto, texto.split('\n'));
    const quantas = new Set(achados.map(a => a.caminho)).size;

    return [{
      icone: '▤',
      rotulo: quantas ? `Imagens deste arquivo… (${quantas})` : 'Imagens deste arquivo…',
      // Item cinza é "se aplica, mas não agora" — e aí `motivo` é obrigatório.
      ativo: quantas > 0,
      motivo: quantas ? undefined : 'Nenhum caminho de imagem neste arquivo.',
      fazer: () => window.imgAbrirModal(caminho, achados),
    }];
  });
})();
