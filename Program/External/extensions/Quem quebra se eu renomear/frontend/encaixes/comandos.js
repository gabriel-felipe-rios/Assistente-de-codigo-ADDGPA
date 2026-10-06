// ══════ QUEM QUEBRA SE EU RENOMEAR — o comando no Acesso rápido ══
// "Quem usa as definições deste arquivo…", para o arquivo na frente do
// Editor. A modal já explica quando o arquivo ainda não foi conferido.

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
    if (typeof window.renAbrirModal !== 'function') return [];   // casca já desmontada
    return [{
      id: 'quem-usa',
      icone: '⇄',
      rotulo: 'Quem usa as definições deste arquivo…',
      ativo: () => !!arquivo(),
      motivo: 'nenhum arquivo aberto no Editor',
      fazer: () => window.renAbrirModal(arquivo()),
    }];
  });
})();
