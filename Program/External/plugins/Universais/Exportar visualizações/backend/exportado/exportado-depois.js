// Deixar só o que foi marcado (Projeto, Documentação e Mapas) e ligar.

// Ícones de arquivo/pasta: no programa o SVG vem de uma pasta no disco; aqui ele vai
// embutido (data URI). A regra de escolha é a MESMA de icones.js::iconePara — só a
// última linha muda, de "caminho do arquivo" para "o SVG embutido".
function iconePara(nome, ehPasta) {
  const ic = EXM.icones;
  if (!ic || !ic.mapa || !ic.mapa.padrao) return null;
  const mapa = ic.mapa;
  const limpo = String(nome || '').trim();
  let tabela, padrao, subpasta, chave;
  if (ehPasta) {
    tabela = mapa.pastas || {};
    padrao = mapa.padrao.pasta;
    subpasta = 'pastas';
    chave = limpo.toLowerCase();
  } else {
    tabela = mapa.extensoes || {};
    padrao = mapa.padrao.arquivo;
    subpasta = 'arquivos';
    const ponto = limpo.lastIndexOf('.');
    chave = ponto > 0 ? limpo.slice(ponto + 1).toLowerCase() : '';
  }
  const alvo = tabela[chave] || padrao;
  if (!alvo) return null;
  return ic.uris[subpasta + '/' + alvo] || null;
}

try {
  const marcados = EXM.mapas;
  const temMapas = marcados.length > 0;

  // ── Mapas: deixa só as sub-abas marcadas ──
  if (temMapas) {
    document.querySelectorAll('.mapas-tab-btn[data-mapa]').forEach(btn => {
      if (!marcados.includes(btn.dataset.mapa)) {
        btn.remove();
        const painel = document.getElementById(btn.dataset.mapa);
        if (painel) painel.remove();
      }
    });

    const botoesRestantes = document.querySelectorAll('.mapas-tab-btn[data-mapa]');
    document.querySelectorAll('.mapas-tab-content').forEach(p => {
      p.classList.remove('active');
      p.classList.add('hidden');
    });
    botoesRestantes.forEach(b => b.classList.remove('active'));
    if (botoesRestantes.length > 0) {
      botoesRestantes[0].classList.add('active');
      const primeiro = document.getElementById(botoesRestantes[0].dataset.mapa);
      if (primeiro) {
        primeiro.classList.add('active');
        primeiro.classList.remove('hidden');
      }
    }
  }

  if (EXM.semBarra) {
    document.body.classList.add('exm-sem-barra');
  }

  // ── Projeto › Resumo completo: o painel é o do programa (projeto-template.js) ──
  const tabProjeto = document.getElementById('tab-projeto');
  if (EXM.temResumo && tabProjeto) {
    tabProjeto.innerHTML =
      '<div class="subtabs-bar">' +
      '<button class="subtab-btn active" data-exm-sub="subtab-resumo-completo">Resumo completo</button>' +
      '</div>' +
      _resumoPainel('indexado', 'Estrutura indexada') +
      _resumoPainel('completo', 'Estrutura completa');
    const painel = document.getElementById('subtab-resumo-completo');
    painel.classList.remove('hidden');
    painel.classList.add('active');
    loadSummary();
  }

  // ── Documentação: a aba é a do programa (documentacao-*.js); aqui ficam só as fontes marcadas ──
  const temDoc = !!document.getElementById('tab-documentacao') && EXM.fontesDoc.length > 0;
  if (temDoc) {
    document.querySelectorAll('.doc-subtab-btn').forEach(btn => {
      if (!EXM.fontesDoc.includes(btn.dataset.fonte)) btn.remove();
    });
    const restantes = document.querySelectorAll('.doc-subtab-btn');
    restantes.forEach(b => b.classList.remove('active'));
    if (restantes.length > 0) {
      restantes[0].classList.add('active');
      // `_docFonte` é a fonte aberta; o programa começa na Documentação técnica.
      _docFonte = restantes[0].dataset.fonte;
    }
  }

  // ── Abas principais (Projeto / Documentação / Mapas) ──
  // Os botões NÃO levam a classe mapas-tab-btn: initMapasTab() liga essa classe
  // inteira e quebraria com um botão sem data-mapa.
  const abas = document.querySelectorAll('#exm-abas .tab-btn');
  const NOMES = ['projeto', 'documentacao', 'mapas'];
  let docIniciada = false;
  function abrirAba(nome) {
    abas.forEach(b => b.classList.toggle('active', b.dataset.exmAba === nome));
    NOMES.forEach(n => {
      const el = document.getElementById('tab-' + n);
      if (el) el.classList.toggle('active', n === nome);
    });
    // Como no programa: o mapa só desenha com a aba à vista (d3 mede o tamanho).
    if (nome === 'mapas' && temMapas) initMapasTab();
    // A Documentação carrega a árvore da fonte na primeira abertura, como no programa.
    if (nome === 'documentacao' && temDoc && !docIniciada) {
      docIniciada = true;
      initDocumentacao();
    }
  }
  abas.forEach(b => b.addEventListener('click', () => abrirAba(b.dataset.exmAba)));

  abrirAba(EXM.temResumo ? 'projeto' : temDoc ? 'documentacao' : 'mapas');
} catch (e) {
  const alvo = document.getElementById('tab-mapas') || document.body;
  alvo.innerHTML = '<div class="mapa-placeholder">Não consegui montar este mapa: ' +
                   (e.message || String(e)).replace(/</g, '&lt;') + '</div>';
  console.error(e);
}
