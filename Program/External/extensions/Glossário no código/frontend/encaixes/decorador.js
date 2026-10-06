// ══════ GLOSSÁRIO NO CÓDIGO — o encaixe `editor.decorador` ══
// Duas passadas de expressão regular sobre o texto inteiro, sem ponte nenhuma.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  // Teto de marcas por lista, se a tela de configuração não disser outro. Um
  // arquivo enorme cheio de termos do Vocabulário estouraria os 150 ms do
  // ponto, e a partir de umas centenas de sublinhados ninguém lê mais nada.
  const GLO_TETO = 400;

  /**
   * Onde cada linha começa, no texto inteiro. Uma passada só: converter cada
   * posição fatiando o texto seria quadrático. Calculado UMA vez por pintura
   * e usado pelas duas passadas — antes era refeito em cada uma, dentro do
   * orçamento de 150 ms.
   */
  function _iniciosDasLinhas(linhas) {
    const inicios = [0];
    for (let i = 0; i < linhas.length - 1; i++) {
      inicios.push(inicios[i] + linhas[i].length + 1);
    }
    return inicios;
  }

  /** Acha as ocorrências de uma regex e converte posição → linha e coluna. */
  function _marcar(texto, inicios, regex, classe, titulo, marcas, teto) {
    if (!regex) return;
    regex.lastIndex = 0;

    let achado;
    let quantas = 0;
    let linha = 0;
    while ((achado = regex.exec(texto)) !== null) {
      if (quantas >= teto) break;
      const pos = achado.index;
      // O caminhante avança e nunca volta, e as ocorrências vêm em ordem: dá
      // para continuar a busca da linha de onde parou.
      while (linha + 1 < inicios.length && inicios[linha + 1] <= pos) linha++;
      marcas.push({
        linha: linha + 1,
        coluna: pos - inicios[linha],
        tamanho: achado[0].length,
        classe,
        // ⚠️ Este título nunca aparece no mouse (o `<pre>` tem
        // `pointer-events: none`). Fica para o DevTools.
        titulo: `${titulo}: ${achado[0]}`,
      });
      quantas++;
      // Casamento de tamanho zero travaria o laço.
      if (achado[0].length === 0) regex.lastIndex++;
    }
  }

  xtRegistrarEncaixe(EU.slug, EU.ponto, (contexto) => {
    const fonte = window.gloRegex;
    // Projeto sem Vocabulário, ou ainda carregando: `[]`, sem avisar nada. É o
    // estado normal da maioria dos projetos.
    if (!fonte || (!fonte.termos && !fonte.proibidos)) return [];

    // ⚠️ Vale em `.txt` e em `.md` também, e não só em código: comentário e
    // documentação usam o vocabulário do projeto tanto quanto o código. Por
    // isso não há filtro por `contexto.linguagem`.
    // As opções, do que está em memória — nunca da ponte, dentro do gancho.
    const prefs = (typeof window.gloPrefs === 'function') ? window.gloPrefs() : {};
    const lido = Number(prefs.teto);
    const teto = Math.max(1, Number.isFinite(lido) && lido > 0 ? lido : GLO_TETO);

    const marcas = [];
    const inicios = _iniciosDasLinhas(contexto.linhas);
    if (prefs.riscar_proibidos !== false) {
      _marcar(contexto.texto, inicios, fonte.proibidos,
              'glo-proibido', 'Sinônimo proibido pelo Vocabulário', marcas, teto);
    }
    if (prefs.marcar_termos !== false) {
      _marcar(contexto.texto, inicios, fonte.termos,
              'glo-termo', 'Termo do Vocabulário', marcas, teto);
    }
    return marcas;
  });
})();
