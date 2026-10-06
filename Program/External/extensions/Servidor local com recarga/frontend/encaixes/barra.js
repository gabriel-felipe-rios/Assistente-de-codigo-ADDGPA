// ══════ SERVIDOR LOCAL COM RECARGA — o seletor na barra do Terminal ══
// "Rodar como": Terminal (o ▶ Executar de sempre) | Servidor local (o
// ▶ Executar sobe o servidor e abre a página no navegador). A escolha é por
// projeto, em memória, e começa em Terminal.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  xtRegistrarEncaixe(EU.slug, EU.ponto, (caixa, contexto) => {
    if (typeof window.svlRodarComo !== 'object' || !window.svlRodarComo) return;   // casca desmontada
    const projeto = (contexto && contexto.projeto) || '';
    const como = window.svlRodarComo[projeto] || 'terminal';
    // SEJA IDEMPOTENTE: o ponto repinta a cada troca de caminho.
    caixa.innerHTML = `
      <div class="mapa-toggle svl-como">
        <button class="mapa-toggle-btn${como === 'terminal' ? ' active' : ''}" data-svl-como="terminal">Terminal</button>
        <button class="mapa-toggle-btn${como === 'servidor' ? ' active' : ''}" data-svl-como="servidor">Servidor local</button>
      </div>`;
    // ⚠️ `onclick` na CAIXA (que é da extensão e sobrevive às repinturas), e
    // não em cada botão: o `innerHTML` acima é refeito a cada pintura, e um
    // listener preso a um botão morreria com ele. Atribuição, e não
    // `addEventListener`, para a repintura não empilhar um listener por vez.
    caixa.onclick = (e) => {
      const b = e.target.closest('[data-svl-como]');
      if (!b || typeof window.svlRodarComo !== 'object' || !window.svlRodarComo) return;
      window.svlRodarComo[projeto] = b.dataset.svlComo;
      if (typeof xtPintarEncaixeDoTerminal === 'function') xtPintarEncaixeDoTerminal();   // repinta a barra e a linha
    };
  });
})();
