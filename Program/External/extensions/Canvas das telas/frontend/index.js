// ═══════════════════════════════════ CANVAS DAS TELAS — A CASCA ══
// Liga e desliga a extensão: injeta a folha e os irmãos, e desfaz tudo ao
// desligar. A tela em si é `frontend/telas/ct-aba.js`, que o programa injeta
// a partir do manifesto.
//
// ⚠️ O prefixo é `ct`, em TUDO: o frontend do programa não tem escopo de
// módulo, e um nome solto sobrescreveria o de outro arquivo em silêncio.

(function () {
  // ⚠️ NUNCA escreva o caminho nem o slug à mão: vêm no dataset da tag.
  const EU = document.currentScript.dataset;   // { caminho, slug }
  const SLUG = EU.slug;
  const CAMINHO = EU.caminho;
  const PASTA = xtBaseUrl(CAMINHO);

  // Os irmãos, na ordem em que cada um usa o anterior.
  const CT_IRMAOS = ['ct-estado', 'ct-api', 'ct-tela', 'ct-ponte', 'ct-canvas', 'ct-topo', 'ct-ligacoes-desenho', 'ct-ligacoes', 'ct-eventos'];
  // Toda global que esta extensão cria — o `xtDesmontar` apaga cada uma.
  const CT_GLOBAIS = ['ctCaminho', 'ctSlug', 'ctMontada', 'ctPendente', 'ctIniciar', 'ctEncerrar', 'ctEstado', 'ctChamar', 'ctLer', 'ctHtmlLista', 'ctHtmlAba', 'ctPonteRegistrar', 'ctAcender', 'ctLimparArmazenamento', 'ctAplicar', 'ctArrumar', 'ctMontarQuadros', 'ctVerTudo', 'ctIrPara', 'ctZoomCentro', 'ctEntrar', 'ctSair', 'ctNavegar', 'ctSelecionar', 'ctRecolher', 'ctAoMudarDeAba', 'ctAoVoltar', 'ctAoSair', 'ctAoMudarPosicoes', 'ctAlternarPop', 'ctAoAcender', 'ctRotear', 'ctDesenharLigacoes', 'ctAplicarOpacidades', 'ctAoSalvar'];

  // ⚠️ A FLAG DE MONTADA: toda continuação depois de um `await` confere.
  let montada = false;

  // ⚠️ SÍNCRONA: o programa a chama logo depois de o script carregar.
  window['xtMontar_' + SLUG] = function () {
    montada = true;
    ctInjetarEstilo();
    _montar();            // sem await: montar não segura quem chamou
  };

  window['xtDesmontar_' + SLUG] = function () {
    montada = false;
    if (typeof window.ctEncerrar === 'function') {
      try { window.ctEncerrar(); } catch (e) { console.error('[ct] ao encerrar:', e); }
    }
    CT_IRMAOS.forEach(n => {
      const el = document.getElementById('ct-js-' + n);
      if (el) el.remove();
    });
    CT_GLOBAIS.forEach(g => { delete window[g]; });
    // O <link> o programa remove sozinho, pelo `data-xt`.
  };

  function ctInjetarEstilo() {
    if (document.getElementById('ct-estilo')) return;   // religar não duplica
    const folha = document.createElement('link');
    folha.rel = 'stylesheet';
    folha.id = 'ct-estilo';
    folha.dataset.xt = SLUG;         // ⚠️ é por aqui que o programa o remove
    folha.href = `${PASTA}/frontend/ct-estilo.css?t=${Date.now()}`;
    document.head.appendChild(folha);
  }

  function irmao(nome) {
    return new Promise((resolve, reject) => {
      if (document.getElementById('ct-js-' + nome)) { resolve(); return; }
      const el = document.createElement('script');
      el.id = 'ct-js-' + nome;
      el.src = `${PASTA}/frontend/${nome}.js?t=${Date.now()}`;
      el.onload = resolve;
      el.onerror = () => reject(new Error(`não carregou ${nome}.js`));
      document.head.appendChild(el);
    });
  }

  async function _montar() {
    // Antes do primeiro irmão: eles usam estes três.
    window.ctCaminho = CAMINHO;
    window.ctSlug = SLUG;
    window.ctMontada = () => montada;
    try {
      for (const n of CT_IRMAOS) {
        await irmao(n);
        if (!montada) return;     // desligada enquanto o arquivo chegava
      }
    } catch (e) {
      console.error('[ct]', e);
      if (montada) showToast('Canvas das telas: ' + e.message, true);
      return;
    }
    // A tela pediu para desenhar antes de os irmãos chegarem.
    const pendente = window.ctPendente;
    if (pendente && typeof window.ctIniciar === 'function') {
      delete window.ctPendente;
      window.ctIniciar(pendente.container, pendente.ctx);
    }
  }
})();
