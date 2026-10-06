// ══════ PRÉVIA DE IMAGEM — o comando no Acesso rápido ══
// "Imagens deste arquivo…", para o arquivo na frente do Editor — o mesmo item
// do menu da aba, sem o clique direito.

(function () {
  // ⚠️ NUNCA escreva o slug nem o ponto à mão — os dois vêm do dataset da tag
  // <script> que o programa injetou, a partir do manifesto.
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  // O arquivo na frente do painel ativo do Editor, NA HORA do clique ou da
  // tecla — e não o `contexto.arquivo` de quando a lista foi pedida: o usuário
  // abre a barra, e o arquivo é o que está aberto agora. Pela porta que o
  // Editor empresta (`edArquivosAbertos`), nunca cutucando `_edPaineis`.
  const arquivo = () => ((typeof edArquivosAbertos === 'function') ? edArquivosAbertos() : [])[0] || '';

  const abertoDeTexto = () => {
    const c = arquivo();
    const aberto = (c && typeof edArquivoAberto === 'function') ? edArquivoAberto(c) : null;
    return (aberto && !aberto.binario) ? aberto : null;
  };

  xtRegistrarEncaixe(EU.slug, EU.ponto, () => {
    if (typeof window.imgAchar !== 'function' || typeof window.imgAbrirModal !== 'function') return [];
    return [{
      id: 'imagens',
      icone: '▤',
      rotulo: 'Imagens deste arquivo…',
      ativo: () => !!abertoDeTexto(),
      motivo: 'nenhum arquivo de texto aberto no Editor',
      fazer: () => {
        const aberto = abertoDeTexto();
        if (!aberto) return;
        const texto = aberto.texto;
        // A modal já avisa quando não há imagem nenhuma.
        window.imgAbrirModal(aberto.caminho, window.imgAchar(texto, texto.split('\n')));
      },
    }];
  });
})();
