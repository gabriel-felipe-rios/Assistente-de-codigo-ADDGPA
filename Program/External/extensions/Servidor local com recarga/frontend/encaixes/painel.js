// ══════ SERVIDOR LOCAL COM RECARGA — a linha do servidor na aba Terminal ══
// Uma linha só: o endereço, a Janela, "Abrir no navegador" e "📋 Copiar
// endereço". ⛔ Sem prévia dentro do programa (D15): a página abre no
// navegador, no tamanho escolhido. Nenhum `<iframe>`, `ResizeObserver` ou
// `scale()` aqui.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  const JANELAS = [
    ['celular', 'Celular · 375 × 812'],
    ['tablet', 'Tablet · 768 × 1024'],
    ['computador', 'Computador · 1280 × 800'],
    ['livre', 'Livre'],
  ];

  xtRegistrarEncaixe(EU.slug, EU.ponto, (caixa, contexto) => {
    if (typeof window.svlLerEstado !== 'function') return;   // casca desmontada
    const projeto = (contexto && contexto.projeto) || '';
    caixa.dataset.svlProjeto = projeto;
    _desenhar(caixa);
    // Relê o estado a cada pintura; repinta SÓ a linha (e só se mudou) —
    // repintar o Terminal inteiro daqui voltaria a pedir o estado, em laço.
    window.svlLerEstado().then((mudou) => {
      if (mudou && typeof window.svlLerEstado === 'function' && caixa.isConnected) _desenhar(caixa);
    });

    // ⚠️ Delegado na CAIXA, e não em cada botão: o `innerHTML` é refeito a
    // cada pintura, e um listener preso a um botão morreria com ele — sem
    // erro nenhum, e o botão só pararia de responder. Atribuição, e não
    // `addEventListener`, para a repintura não empilhar um listener por vez.
    caixa.onclick = (e) => {
      const b = e.target.closest('[data-svl]');
      if (!b || b.disabled || typeof window.svlAbrir !== 'function') return;
      const url = _endereco();
      if (!url) return;
      if (b.dataset.svl === 'abrir') window.svlAbrir(url);
      else if (b.dataset.svl === 'copiar') copiarContexto(url, 'Endereço copiado.');
    };
    caixa.onchange = (e) => {
      if (!e.target.matches('[data-svl="janela"]') || typeof window.svlAbrir !== 'function') return;
      window.svlJanela = e.target.value;   // vale no próximo "Abrir"
    };
  });

  function _endereco() {
    const estado = window.svlEstado || {};
    return window.svlUltimaUrl || estado.url_base || '';
  }

  function _desenhar(caixa) {
    const estado = window.svlEstado || {};
    const projeto = caixa.dataset.svlProjeto || '';
    const como = (window.svlRodarComo || {})[projeto] || 'terminal';
    const rodando = !!estado.rodando;

    if (como === 'terminal' && !rodando && !estado.erro) {
      caixa.hidden = true;
      caixa.innerHTML = '';
      return;
    }
    caixa.hidden = false;

    const deste = rodando && (!estado.projeto || estado.projeto === projeto);
    let meio;
    if (deste) {
      meio = `<code>${escapeHtml(_endereco())}</code>`;
    } else if (rodando) {
      meio = `<span class="svl-nota">servindo o projeto «${escapeHtml(String(estado.projeto))}» em <code>${escapeHtml(estado.url_base || '')}</code></span>`;
    } else {
      meio = '<span class="svl-nota">aperte ▶ Executar para subir o servidor</span>';
    }

    const escolhida = window.svlJanela || (window.svlPrefs || {}).tamanho || 'computador';
    const opcoes = JANELAS.map(([valor, rotulo]) =>
      `<option value="${valor}"${valor === escolhida ? ' selected' : ''}>${escapeHtml(rotulo)}</option>`).join('');
    // Apagados enquanto não há servidor DESTE projeto no ar.
    const apagado = deste ? '' : ' disabled';

    caixa.innerHTML = `
      <div class="svl-linha">
        <span class="svl-rot">Servidor local</span>
        ${meio}
        <span class="svl-esp"></span>
        <label class="svl-tam">Janela
          <select class="xt-campo-select" data-svl="janela">${opcoes}</select>
        </label>
        <button class="btn btn-muted btn-sm" data-svl="abrir"${apagado}>Abrir no navegador</button>
        <button class="btn btn-muted btn-sm" data-svl="copiar"${apagado}>📋 Copiar endereço</button>
      </div>
      ${estado.erro ? `<div class="config-erro">${escapeHtml(estado.erro)}</div>` : ''}`;
  }
})();
