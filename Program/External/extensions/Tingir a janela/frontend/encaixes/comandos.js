// ══════ TINGIR A JANELA — o comando no Acesso rápido ══
// O mesmo "Tingir a janela…" dos dois menus, sem precisar achar a raiz da
// árvore para clicar com o botão direito.

(function () {
  // ⚠️ NUNCA escreva o slug nem o ponto à mão — os dois vêm do dataset da tag
  // <script> que o programa injetou, a partir do manifesto.
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  // O arquivo na frente do painel ativo do Editor, NA HORA do clique ou da
  // tecla — e não o `contexto.arquivo` de quando a lista foi pedida: o usuário
  // abre a barra, e o arquivo é o que está aberto agora. Pela porta que o
  // Editor empresta (`edArquivosAbertos`), nunca cutucando `_edPaineis`.
  const arquivo = () => ((typeof edArquivosAbertos === 'function') ? edArquivosAbertos() : [])[0] || '';

  xtRegistrarEncaixe(EU.slug, EU.ponto, () => {
    if (typeof window.tinAbrirModal !== 'function') return [];   // casca já desmontada
    return [{
      id: 'tingir',
      icone: '◧',
      rotulo: 'Tingir a janela…',
      ativo: () => !!(typeof currentProject !== 'undefined' && currentProject),
      motivo: 'nenhum projeto aberto — a cor é de um projeto',
      fazer: () => window.tinAbrirModal(),
    }];
  });
})();
