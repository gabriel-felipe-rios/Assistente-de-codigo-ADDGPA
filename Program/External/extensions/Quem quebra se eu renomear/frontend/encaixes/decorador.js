// ══════ QUEM QUEBRA SE EU RENOMEAR — o encaixe `editor.decorador` ══
// Marca o nome de cada definição deste arquivo que outros arquivos usam.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  xtRegistrarEncaixe(EU.slug, EU.ponto, (contexto) => {
    // A casca pode já ter sido desmontada (o programa tira o encaixe do
    // registro antes, mas uma pintura em voo ainda chega aqui).
    if (typeof window.renTalvezPedir !== 'function'
        || typeof window.renDefinicoesDoTexto !== 'function') return [];

    // ⛔ Nenhuma ida a `window.pywebview.api` aqui dentro — ver o cabeçalho de
    // `frontend/index.js`. Isto só AGENDA, e volta na hora.
    window.renTalvezPedir(contexto);

    const definicoes = window.renDefinicoesDoTexto(contexto.linhas);
    // O observador de `editor.vai_salvar` compara contra isto para descobrir
    // que um nome sumiu. Guardado aqui porque é aqui que ele é calculado —
    // recalcular no salvamento seria a mesma conta duas vezes.
    window.renGuardarDefinicoes(contexto.caminho, definicoes);

    // O usuário pode querer só o aviso ao salvar, sem a marca no código.
    const prefs = (typeof window.renPrefs === 'function') ? window.renPrefs() : {};
    if (prefs.marcar_no_codigo === false) return [];

    const cache = window.renCache || {};
    // Cache de outro arquivo, ou índice inexistente: `[]`, em silêncio.
    if (cache.caminho !== contexto.caminho || !cache.usados || !cache.usados.size) return [];

    const marcas = [];
    for (const def of definicoes) {
      if (!cache.usados.has(def.nome)) continue;
      const arquivos = cache.porNome[def.nome] || [];
      marcas.push({
        linha: def.linha,
        coluna: def.coluna,
        tamanho: def.nome.length,
        classe: 'ren-usada',
        // ⚠️ Não aparece no mouse (o `<pre>` tem `pointer-events: none`) —
        // fica para o DevTools. Quem avisa o usuário é o toast ao salvar.
        titulo: `usada por ${arquivos.length} arquivo(s): ${arquivos.slice(0, 5).join(', ')}`,
      });
    }
    return marcas;
  });
})();
