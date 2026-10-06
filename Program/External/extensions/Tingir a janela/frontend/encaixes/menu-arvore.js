// ══════ TINGIR A JANELA — o item nas árvores compartilhadas ══
// `arvore.menu` é o menu de contexto de TODA árvore de pastas compartilhada
// (Acervo, Relações, Documentação, Mapa de I/O, Resumo, Tree-sitter, Backups).
//
// ⚠️ O contexto dela é `{ caminho }`, e vem VAZIO quando o clique foi no vazio
// da raiz — que é exatamente o gesto que interessa aqui. Sobre um arquivo ou
// uma pasta, o item não aparece: tingir é do projeto, não do que está sob o
// cursor.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  xtRegistrarEncaixe(EU.slug, EU.ponto, (contexto) => {
    if (contexto && contexto.caminho) return [];
    return [{
      icone: '◧',
      rotulo: 'Tingir a janela…',
      fazer: () => window.tinAbrirModal(),
    }];
  });
})();
