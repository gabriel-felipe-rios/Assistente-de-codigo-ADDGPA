// ══════ RODAR O QUE ESTÁ SELECIONADO — os comandos no Acesso rápido ══
// Os dois itens do menu da aba, também no Ctrl+P — e com tecla, que o menu
// não dá. O contrato do ponto está na parte 15 de `Como criar extensões.md`.
//
// ⚠️ `emCampo: true` nos dois: o gesto é do CÓDIGO — a seleção está no
// `<textarea>` do Editor, e é de lá que a tecla tem de disparar. E `onde:
// 'tab-editor'`: a tecla só vale com a aba Editor na tela, senão um Ctrl+Enter
// no campo do Chat rodaria código.

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
    // A casca pode já ter sido desmontada (o programa tira os encaixes do
    // registro antes, mas um pedido em voo ainda chega aqui).
    if (typeof window.rodRodarTrecho !== 'function') return [];

    const temTrechoOuLinha = () => {
      const c = arquivo();
      if (!c) return false;
      return !!window.rodTextoSelecionado(c) || !!window.rodLinhaDoCursor(c);
    };

    return [
      {
        id: 'rodar-trecho',
        icone: '▶',   // glifo, nunca emoji: a linha da barra muda de cor ao ser selecionada
        rotulo: 'Rodar o trecho, ou a linha do cursor',
        atalho: 'Ctrl+Enter',
        emCampo: true,
        onde: 'tab-editor',
        ativo: temTrechoOuLinha,
        motivo: 'selecione um trecho, ou ponha o cursor numa linha com código, no Editor',
        fazer: () => {
          const c = arquivo();
          window.rodRodarTrecho(c, !window.rodTextoSelecionado(c));
        },
      },
      {
        id: 'rodar-arquivo',
        icone: '▶',
        rotulo: 'Rodar o arquivo aberto',
        atalho: 'Ctrl+Alt+Enter',
        emCampo: true,
        onde: 'tab-editor',
        ativo: () => !!arquivo(),
        motivo: 'nenhum arquivo aberto no Editor',
        fazer: () => window.rodRodarArquivo(arquivo()),
      },
    ];
  });
})();
