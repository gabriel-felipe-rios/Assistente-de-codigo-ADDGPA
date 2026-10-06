// ══════ RODAR O QUE ESTÁ SELECIONADO — clique direito na ABA do arquivo ══
// É aqui que mora o item principal: o trecho está no arquivo ABERTO, e é o
// menu da aba que fala dele.
//
// ⚠️ Não é `editor.menu`: aquele é o clique direito na ÁRVORE, e o contexto
// dele traz arquivos selecionados na árvore, nunca texto.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  xtRegistrarEncaixe(EU.slug, EU.ponto, (contexto) => {
    const caminho = contexto && contexto.caminho;
    if (!caminho) return [];
    // A casca pode já ter sido desmontada (o programa tira os encaixes do
    // registro antes, mas um menu aberto no instante do desligar ainda chega
    // aqui). Sem a casca, não há item.
    if (typeof window.rodTextoSelecionado !== 'function') return [];

    const temSelecao = !!window.rodTextoSelecionado(caminho);
    const temLinha = !temSelecao && typeof window.rodLinhaDoCursor === 'function'
      && !!window.rodLinhaDoCursor(caminho);

    return [
      {
        icone: '▶',
        // Sem seleção, o gesto vira "a linha do cursor" — o mais comum de
        // quem testa uma expressão. Cinza só quando não há nem uma nem outra:
        // sumir com o item esconderia que ele existe.
        rotulo: temSelecao ? 'Rodar o trecho' : 'Rodar a linha do cursor',
        ativo: temSelecao || temLinha,
        motivo: (temSelecao || temLinha) ? undefined
          : 'Selecione um trecho, ou ponha o cursor numa linha com código.',
        fazer: () => window.rodRodarTrecho(caminho, !temSelecao),
      },
      {
        icone: '▶',
        rotulo: 'Rodar este arquivo',
        fazer: () => window.rodRodarArquivo(caminho),
      },
    ];
  });
})();
