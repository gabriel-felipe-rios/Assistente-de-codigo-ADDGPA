// ══════ ERRO NA PRÓPRIA LINHA — o encaixe `editor.decorador` ══
// Devolve o que está no cache, e só isso. Quem enche o cache é o laço de
// `frontend/index.js`, fora do gancho.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  xtRegistrarEncaixe(EU.slug, EU.ponto, (contexto) => {
    // ⛔ NENHUMA ida a `window.pywebview.api` aqui dentro. Ver o cabeçalho de
    // `frontend/index.js`. Sob `typeof`: a casca pode já ter sido desmontada
    // (o programa tira o encaixe do registro antes, mas uma pintura em voo
    // ainda chega aqui).
    if (typeof window.erlTalvezPedir !== 'function') return [];
    window.erlTalvezPedir(contexto);

    const cache = window.erlCache || {};
    // Cache de outro arquivo, ou de uma versão anterior do texto: melhor não
    // marcar nada que marcar a linha errada. Na primeira vez isto devolve `[]`,
    // que é o normal — a resposta chega em ~400 ms e chama `xtPedirDecoracao`.
    if (cache.caminho !== contexto.caminho || cache.texto !== contexto.texto) return [];
    if (!cache.erros || !cache.erros.length) return [];

    const marcas = [];
    const vistas = new Set();
    for (const erro of cache.erros) {
      const n = Number(erro.linha);
      if (!Number.isInteger(n) || n < 1 || n > contexto.linhas.length) continue;
      // Dois erros na mesma linha pintariam o fundo duas vezes, aninhado — e o
      // vermelho ficaria mais forte só ali, sem querer dizer nada.
      if (vistas.has(n)) continue;
      vistas.add(n);

      const linha = contexto.linhas[n - 1];
      if (!linha || !linha.length) continue;

      marcas.push({
        linha: n,
        coluna: 0,
        // A linha inteira. Marca que passa do fim é cortada pelo programa.
        tamanho: linha.length,
        classe: 'erl-linha',
        // ⚠️ Este título NUNCA aparece no mouse — o `<pre>` tem
        // `pointer-events: none`. Fica para o DevTools — e por isso é curto:
        // um trecho de 4.000 caracteres viraria um atributo gigante por erro.
        titulo: erro.trecho
          ? `Erro de sintaxe — "${String(erro.trecho).split('\n')[0].trim().slice(0, 120)}"`
          : 'Erro de sintaxe',
      });
    }
    return marcas;
  });
})();
