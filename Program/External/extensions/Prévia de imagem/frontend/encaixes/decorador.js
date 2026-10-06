// ══════ PRÉVIA DE IMAGEM — o encaixe `editor.decorador` ══
// Sublinha todo caminho que PARECE de imagem. Sem ponte nenhuma.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  xtRegistrarEncaixe(EU.slug, EU.ponto, (contexto) => {
    // ⚠️ NÃO confere se o arquivo existe. Isso seria uma ida ao disco por
    // caminho, dentro de um gancho que tem 150 ms e roda a cada 120 ms de
    // digitação. A marca diz "isto parece um caminho de imagem"; quem confere
    // é a modal, que roda uma vez, quando o usuário pede.
    if (typeof window.imgAchar !== 'function') return [];   // casca já desmontada
    // O usuário pode querer só a modal, sem o sublinhado no código.
    if (typeof window.imgPrefs === 'function' && window.imgPrefs().marcar_no_codigo === false) return [];
    return window.imgAchar(contexto.texto, contexto.linhas).map(a => ({
      linha: a.linha,
      coluna: a.coluna,
      tamanho: a.tamanho,
      classe: 'img-marca',
      // ⚠️ Não aparece no mouse — o `<pre>` tem `pointer-events: none`.
      titulo: a.caminho,
    }));
  });
})();
