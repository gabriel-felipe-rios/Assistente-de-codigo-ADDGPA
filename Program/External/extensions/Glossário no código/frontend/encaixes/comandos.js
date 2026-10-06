// ══════ GLOSSÁRIO NO CÓDIGO — o comando no Acesso rápido ══
// "Vocabulário neste arquivo…", para o arquivo na frente do Editor.

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
    if (typeof window.gloAbrirModal !== 'function') return [];   // casca já desmontada
    const temVocabulario = () => {
      const fonte = window.gloRegex;
      return !!(fonte && (fonte.termos || fonte.proibidos));
    };
    return [{
      id: 'vocabulario',
      icone: '◈',
      rotulo: 'Vocabulário neste arquivo…',
      ativo: () => !!arquivo() && temVocabulario(),
      motivo: 'precisa de um arquivo aberto no Editor e do Vocabulário.md do projeto (Saída das skills › Terminologia e nomenclatura)',
      fazer: () => window.gloAbrirModal(arquivo()),
    }];
  });
})();
