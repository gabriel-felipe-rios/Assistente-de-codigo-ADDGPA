// ══════ ERRO NA PRÓPRIA LINHA — o comando no Acesso rápido ══
// "Erros de sintaxe deste arquivo…", para o arquivo na frente do Editor — a
// lista com "ir para a linha", que a marca na linha não tem como dar.

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
    if (typeof window.erlAbrirModal !== 'function') return [];   // casca já desmontada
    return [{
      id: 'erros',
      icone: '△',
      rotulo: 'Erros de sintaxe deste arquivo…',
      ativo: () => !!arquivo(),
      motivo: 'nenhum arquivo aberto no Editor',
      fazer: () => window.erlAbrirModal(arquivo()),
    }];
  });
})();
