// ══════════════════════════════════ Mapas › Pipeline › Mapa em níveis
// A casca da sub-aba: o estado, o carregamento e os eventos. As outras
// partes: mapas-pipeline-niveis-arvore (a árvore), -geometria (posições),
// -desenho (cartões, caixas e setas), -camera (zoom e troca de nível),
// -paineis (o que fica em volta do mapa), -esboco (o desenho leve do gesto e
// a janela do DOM). Vem por ÚLTIMO entre os sete.
//
// Nenhum controle daqui chama o modelo: «aqui se gera, lá desenha» (D56).
// Quem gera áreas, blocos, cadeias e as frases é a rotina Pipeline, em
// Automação › Rotinas; esta tela só lê o `_niveis.json` que ela gravou.

let _mn = {
  iniciado: false, carregado: false,
  D: null, arv: null, planos: new Map(), el: null, projeto: null,
  nivel: 1, raizAtual: null, override: new Map(),
  visao: { x: 0, y: 0, k: 1 }, kBase: 1,
  selecionado: null, hover: null, hubsAcesos: [], hubsDe: null,
  zoomTrocaNivel: true, mostrarHubs: false,
  travadoAte: 0, cfg: null,
  lista: null,              // o que está aberto na árvore, em pré-ordem (mnDesenhar)
  esbocoLigado: false,      // o <canvas> do esboço está na frente do DOM
};

// Chamado pela sub-aba toda vez que ela abre (vpLigarSubabas) e por
// renderPipeline quando o mapa volta à vista com esta sub-aba na frente.
// Projeto trocado desde a última leitura: relê.
function mnAbrir() {
  if (!_mn.iniciado) { _mn.iniciado = true; mnIniciar(); }
  mnPosicionarPalco();
  if (!_mn.carregado || _mn.projeto !== currentProject) mnCarregar();
  else { mnAplicarVisao(); mnDesenharMinimapa(); }
}

function mnIniciar() {
  const $ = id => document.getElementById(id);
  _mn.el = {
    raiz: $('mn-raiz'), topo: $('mn-topo'), palco: $('mn-palco'), viewport: $('mn-viewport'),
    camera: $('mn-camera'), mundo: $('mn-mundo'), caixas: $('mn-camada-caixas'),
    cartoes: $('mn-camada-cartoes'), fantasmas: $('mn-camada-fantasmas'),
    fantasmaCena: $('mn-fantasma-cena'), medidor: $('mn-medidor'), mm: $('mn-mm'),
    esboco: $('mn-esboco'),
  };
  _mn.cfg = mnLerCfg();
  mnLigarEventos();
  // O topo muda de altura depois que o status chega (e quando a barra quebra
  // linha): sem isto o palco ficava por baixo dele e cortava o minimapa.
  new ResizeObserver(mnPosicionarPalco).observe(_mn.el.topo);
}

async function mnCarregar() {
  const vazio = document.getElementById('mn-vazio');
  const projeto = currentProject;
  _mn.projeto = projeto;
  const r = await window.pywebview.api.get_mapa_niveis_result(projeto);
  if (projeto !== currentProject) return;   // trocou de aba de projeto no meio da ida
  if (!r.success) {
    // Sem _niveis.json: o texto diz QUEM gera e ONDE (D58) — aqui não há botão para isso.
    _mn.carregado = false; _mn.D = null; _mn.selecionado = null; _mn.lista = null;
    _mn.el.raiz.classList.remove('com-painel');
    ['mn-titulo-sub', 'mn-metricas', 'mn-status'].forEach(id => document.getElementById(id).innerHTML = '');
    vazio.textContent = r.error || 'Não foi possível ler o Pipeline deste projeto.';
    vazio.classList.remove('hidden');
    return;
  }
  vazio.classList.add('hidden');
  _mn.D = r;
  _mn.arv = mnMontarArvore(r);
  _mn.planos = new Map();
  _mn.raizAtual = _mn.arv.raiz;
  _mn.override.clear();
  _mn.selecionado = null; _mn.hover = null;
  _mn.el.raiz.classList.remove('com-painel');
  _mn.carregado = true;
  mnAtualizarStatus(); mnDesenhar(); mnEnquadrar();
}

// A rotina Pipeline terminou (vpOnPipelineProgress, em mapas-pipeline.js):
// o que está desenhado ficou velho. À vista, relê já; escondido, relê na
// próxima vez que abrir.
function mnRecarregarSeAberto() {
  if (!_mn.iniciado) return;
  _mn.carregado = false;
  if (_mn.el.raiz.offsetParent !== null) mnCarregar();
}

// O palco começa logo abaixo do topo, e o topo muda de altura quando a barra
// quebra linha.
function mnPosicionarPalco() {
  if (!_mn.el) return;
  _mn.el.palco.style.top = _mn.el.topo.offsetHeight + 'px';
}

// ── eventos ──────────────────────────────────────────────────────────────────

function mnLigarEventos() {
  const vp = _mn.el.viewport;
  const ponto = e => { const r = vp.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  // O que está sob o mouse: pelo DOM quando ele está na tela, pela geometria
  // quando quem está é o esboço (aí os cartões não existem como elemento).
  const alvo = e => {
    if (_mn.esbocoLigado) return mnNoNoPonto(ponto(e)) || { n: null };
    const el = e.target.closest('#mn-camada-caixas [data-id], #mn-camada-cartoes [data-id]');
    const naCaixa = !!e.target.closest('.caixa');
    return {
      n: el ? _mn.arv.porId.get(el.dataset.id) : null,
      abrir: !!e.target.closest('.c-abrir'),
      cab: naCaixa && !!e.target.closest('.cx-cab'),
      miolo: naCaixa && !e.target.closest('.cx-cab, .cx-desc'),
    };
  };
  // No programa o mapa divide a janela com as outras abas: «escondido» é
  // qualquer ancestral fora da tela (outra aba, outro mapa, a sub-aba
  // Leituras), e não só a sub-aba — senão as teclas 1–5 e o Esc agiriam
  // no mapa com ele escondido.
  const escondida = () => _mn.el.raiz.offsetParent === null;

  // arrastar para mover
  let arrasto = null, moveu = false, mmArrastando = false;
  // clique da rodinha (botão do meio): enquadra
  vp.addEventListener('mousedown', e => {
    if (e.button !== 1 || !_mn.carregado) return;
    e.preventDefault(); mnEnquadrar();
  });
  // ⚠️ `moveu` ZERA EM TODO mousedown, inclusive no botão +/−. Antes o botão
  // saía cedo e não zerava: depois de qualquer arrasto, o `moveu` velho
  // (true) fazia o próximo clique no +/− ser ignorado — era o «às vezes
  // funciona, às vezes não» do botão de abrir/fechar.
  vp.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    moveu = false;
    arrasto = e.target.closest('.c-abrir') ? null : { x: e.clientX, y: e.clientY, vx: _mn.visao.x, vy: _mn.visao.y };
  });
  window.addEventListener('mousemove', e => {
    if (mmArrastando) { mnMovendo(0); return mnIrMinimapa(e); }
    if (!arrasto) return;
    const dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y;
    if (!moveu && Math.hypot(dx, dy) < 4) return;
    moveu = true; vp.classList.add('arrastando');
    mnMovendo(0);
    _mn.visao.x = arrasto.vx + dx; _mn.visao.y = arrasto.vy + dy; mnAplicarVisao();
  });
  window.addEventListener('mouseup', () => {
    const acabou = mmArrastando || (arrasto && moveu);
    arrasto = null; mmArrastando = false; vp.classList.remove('arrastando');
    if (acabou) mnPararMovimento();
  });
  _mn.el.mm.addEventListener('mousedown', e => { mmArrastando = true; mnIrMinimapa(e); e.stopPropagation(); });

  // clique marca; duplo clique abre ou fecha
  vp.addEventListener('click', e => {
    if (moveu || !_mn.carregado) return;
    const a = alvo(e), n = a.n;
    if (a.abrir && n) { mnAlternar(n); if (_mn.selecionado === n) mnSelecionar(n); return; }
    if (!n) return mnFecharPainel();
    // o miolo de uma caixa aberta é "vazio": só o cabeçalho e a descrição selecionam a caixa
    if (a.miolo) return mnFecharPainel();
    _mn.selecionado === n ? mnFecharPainel() : mnSelecionar(n);
  });
  vp.addEventListener('dblclick', e => {
    if (!_mn.carregado) return;
    const a = alvo(e), n = a.n;
    if (!n || a.abrir) return;
    if (n.aberto && n.tipo !== 'arquivo' && !a.cab) return;
    mnAlternar(n); mnSelecionar(n);
  });
  vp.addEventListener('mouseover', e => {
    if (_mn.selecionado || !_mn.carregado || _mn.esbocoLigado) return;
    const n = alvo(e).n;
    if (n !== _mn.hover) { _mn.hover = n; mnAplicarDestaques(); }
  });
  // com o esboço, a pré-visualização do passar o mouse vem da geometria
  vp.addEventListener('mousemove', e => {
    if (!_mn.esbocoLigado || arrasto || _mn.selecionado || !_mn.carregado) return;
    const n = alvo(e).n;
    if (n !== _mn.hover) { _mn.hover = n; mnAplicarDestaques(); }
  });
  vp.addEventListener('mouseleave', () => { if (!_mn.carregado) return; _mn.hover = null; mnAplicarDestaques(); });

  // rodinha: aproxima; passando do limite, troca de nível (mnZoomEm)
  const fatorRoda = e => Math.exp(-e.deltaY * .0015);
  vp.addEventListener('wheel', e => {
    e.preventDefault();
    if (!_mn.carregado || performance.now() < _mn.travadoAte) return;
    mnMovendo();
    mnZoomEm(ponto(e), fatorRoda(e));
  }, { passive: false });

  // rodinha no minimapa: o mesmo zoom, parado no ponto do mapa que está sob o
  // mouse no minimapa (que pode estar fora da tela agora)
  _mn.el.mm.addEventListener('wheel', e => {
    e.preventDefault();
    if (!_mn.carregado || performance.now() < _mn.travadoAte) return;
    mnMovendo();
    const b = _mn.el.mm.getBoundingClientRect(), v = _mn.visao;
    const wx = (e.clientX - b.left - _mnMm.ox) / _mnMm.escala, wy = (e.clientY - b.top - _mnMm.oy) / _mnMm.escala;
    mnZoomEm({ x: v.x + wx * v.k, y: v.y + wy * v.k }, fatorRoda(e));
  }, { passive: false });

  // barra
  const ligarPill = (id, ligado) => document.querySelectorAll(`#${id} .toggle-track, #${id} .toggle-label`).forEach(x => x.classList.toggle('on', ligado));
  document.getElementById('mn-niveis').addEventListener('click', e => { const b = e.target.closest('[data-nivel]'); if (b) mnTrocarNivel(+b.dataset.nivel); });
  document.getElementById('mn-regua').addEventListener('click', e => { const el = e.target.closest('[data-nivel]'); if (el) mnTrocarNivel(+el.dataset.nivel); });
  document.getElementById('mn-tg-zoom').onclick = e => { e.preventDefault(); _mn.zoomTrocaNivel = !_mn.zoomTrocaNivel; ligarPill('mn-tg-zoom', _mn.zoomTrocaNivel); _mn.kBase = _mn.visao.k; mnAtualizarRegua(); };
  document.getElementById('mn-tg-hubs').onclick = e => { e.preventDefault(); _mn.mostrarHubs = !_mn.mostrarHubs; ligarPill('mn-tg-hubs', _mn.mostrarHubs); mnDesenharSetas(); mnAplicarDestaques(); };
  document.getElementById('mn-btn-enquadrar').onclick = mnEnquadrar;
  document.getElementById('mn-btn-recolher').onclick = () => { _mn.override.clear(); _mn.nivel = 1; _mn.raizAtual = _mn.arv.raiz; mnDesenhar(); mnEnquadrar(); };
  document.getElementById('mn-btn-fechar').onclick = mnFecharPainel;
  document.getElementById('mn-btn-ajustes').onclick = e => {
    const aj = document.getElementById('mn-ajustes'), r = e.target.getBoundingClientRect();
    if (aj.classList.toggle('visivel')) { mnDesenharAjustes(); aj.style.top = (r.bottom + 6) + 'px'; aj.style.left = Math.min(r.left, innerWidth - 345) + 'px'; }
  };
  document.getElementById('mn-busca').addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !_mn.carregado) return;
    const q = e.target.value.trim().toLowerCase(); if (!q) return;
    const a = _mn.arv;
    const achado = [...a.areas, ...a.blocos, ...a.cadeias, ...a.arquivos].find(n => n.nome.toLowerCase().includes(q) || (n.dados?.arquivo || '').toLowerCase().includes(q));
    if (achado) mnIrPara(achado); else showToast('Nada com esse nome no mapa.');
  });

  // teclado: Esc volta um passo; 1–5 trocam de nível. Só com o mapa à vista.
  window.addEventListener('keydown', e => {
    if (escondida() || !_mn.carregado || ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'Escape') {
      const aj = document.getElementById('mn-ajustes');
      if (aj.classList.contains('visivel')) aj.classList.remove('visivel');
      else if (_mn.selecionado) mnFecharPainel();
      else if (_mn.raizAtual !== _mn.arv.raiz) mnEntrar(_mn.raizAtual.pai);
    }
    const k = +e.key; if (k >= 1 && k <= MN_NIVEIS.length) mnTrocarNivel(k);
  });
  window.addEventListener('resize', () => { if (escondida() || !_mn.carregado) return; mnPosicionarPalco(); mnAplicarVisao(); mnDesenharMinimapa(); });
}
