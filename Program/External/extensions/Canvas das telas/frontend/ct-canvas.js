// ═══════════════════════════════════ CANVAS DAS TELAS — O CANVAS ══
// O mundo infinito, as telas vivas (cada uma num iframe), o zoom, o arrastar,
// o ir até, o entrar e o sair. Porte das funções do preview aprovado
// (`Briefing/Referência · preview.html`) — lá cada tela era HTML falso no
// próprio DOM; aqui é um iframe apontando para o servidor das telas, e o que
// acontece dentro dele chega por mensagem (`ct-ponte.js`).
//
// ⚠️ Em texto visível o retângulo é "tela", nunca "quadro" (D50). `ct-quadro`
// é só nome de classe.

(function () {
  // Os números do comportamento, decididos pelo usuário (D30, D39, D21).
  const ZOOM_POR_ENTALHE = 1.2;
  const MARGEM_ENQUADRAR = 16;
  const ESCALA_MIN = 0.05;
  const ESCALA_MAX = 1.6;
  const DESLIZE_MS = 560;
  const DESTAQUE_MS = 1800;
  const ARRASTO_PX = 4;

  const E = () => window.ctEstado;
  const montada = () => typeof window.ctMontada === 'function' && window.ctMontada();
  const achar = id => E().container && E().container.querySelector('#' + id);
  const canvas = () => achar('ct-canvas');
  const mundo = () => achar('ct-mundo');
  const telas = () => (E().leitura && E().leitura.telas) || [];
  const tam = () => E().tamanhos[E().tamanho];
  const quadro = id => { const m = mundo(); return m && [...m.querySelectorAll('.ct-quadro')].find(q => q.dataset.id === id); };
  // Uma tela mudou de lugar, foi escolhida, entrou/saiu: as ligações se
  // redesenham ('*'). O `aplicar()` avisa SEM tela — aí só a escala conta.
  const avisarPosicoes = () => { if (typeof window.ctAoMudarPosicoes === 'function') window.ctAoMudarPosicoes('*'); };
  const prefs = () => (typeof xtPreferenciasDe === 'function' && xtPreferenciasDe(window.ctSlug)) || {};
  let arrastou = false;

  function aplicar() {
    const e = E(), c = canvas(), m = mundo();
    if (!c || !m) return;
    m.style.transform = `translate(${e.px}px,${e.py}px) scale(${e.escala})`;
    // O fundo pontilhado acompanha o zoom e o arrasto (D10).
    let passo = 22 * e.escala;
    while (passo < 14) passo *= 4;
    c.style.backgroundSize = `${passo}px ${passo}px`;
    c.style.backgroundPosition = `${e.px}px ${e.py}px`;
    const z = achar('ct-zoom');
    if (z) z.textContent = Math.round(e.escala * 100) + '%';
    if (typeof window.ctAoMudarPosicoes === 'function') window.ctAoMudarPosicoes();
  }

  // Colunas da leitura; na coluna, a ordem da leitura. As não alcançadas
  // ficam à parte, duas colunas depois da última, uma embaixo da outra (D35).
  function arrumar() {
    const [w, h] = tam(), e = E();
    const dx = w + Math.max(260, w * 0.35), dy = h + Math.max(110, h * 0.15);
    const linhas = {};
    let maior = 0;
    telas().filter(t => t.alcancada).forEach(t => { maior = Math.max(maior, t.coluna || 0); });
    telas().forEach(t => {
      const col = t.alcancada ? (t.coluna || 0) : maior + 2;
      const lin = linhas[col] = (linhas[col] === undefined ? 0 : linhas[col] + 1);
      e.posicoes[t.id] = { x: col * dx, y: lin * dy };
    });
  }

  function endereco(t) {
    const s = E().servidor;
    if (!s) return 'about:blank';
    // Aba e modal abrem a página deles; a própria página faz o resto (D27).
    return s.url_base + String(t.arquivo).split('/').map(encodeURIComponent).join('/');
  }

  function rotuloHtml(t) {
    const nome = t.tipo === 'pagina' ? '' : ` › ${escapeHtml(String(t.nome || ''))}`;
    return `<b>${escapeHtml(String(t.arquivo))}</b>${nome}<span class="ct-dentro-tag">· interagindo</span>`;
  }

  function montarQuadros() {
    const m = mundo(), e = E();
    if (!m) return;
    m.querySelectorAll('.ct-quadro').forEach(q => q.remove());
    e.posicoesDe = {};
    e.dentro = null;
    const [w, h] = tam();
    telas().forEach(t => {
      const p = e.posicoes[t.id] || { x: 0, y: 0 };
      const q = document.createElement('div');
      q.className = 'ct-quadro' + (t.id === e.escolhida ? ' selecionado' : '');
      q.dataset.id = t.id;
      q.style.left = p.x + 'px';
      q.style.top = p.y + 'px';
      q.style.width = w + 'px';
      q.style.height = h + 'px';
      q.innerHTML = `<div class="ct-quadro-rotulo">${rotuloHtml(t)}</div><iframe class="ct-quadro-pagina"></iframe><div class="ct-capa"></div>`;
      m.appendChild(q);
      const f = q.querySelector('iframe');
      window.ctPonteRegistrar(t.id, f);
      f.src = endereco(t);
      ligarQuadro(q);
    });
    avisarPosicoes();
  }

  function verTudo() {
    const e = E(), c = canvas();
    const xs = Object.keys(e.posicoes).filter(id => quadro(id)).map(id => e.posicoes[id]);
    if (!c || !xs.length) return;
    const [w, h] = tam(), r = c.getBoundingClientRect();
    const maxX = Math.max(...xs.map(p => p.x)) + w, maxY = Math.max(...xs.map(p => p.y)) + h;
    e.escala = Math.max(ESCALA_MIN, Math.min(1.2, (Math.max(r.width, 400) - 80) / maxX, (Math.max(r.height, 300) - 90) / (maxY + 30)));
    e.px = 40;
    e.py = 50;
    deslizar();
  }

  function deslizar() {
    const c = canvas(), m = mundo();
    m.classList.add('deslizando');
    c.classList.add('deslizando');
    aplicar();
    setTimeout(() => {
      if (!montada()) return;
      m.classList.remove('deslizando');
      c.classList.remove('deslizando');
      avisarPosicoes();
    }, DESLIZE_MS);
  }

  function selecionar(id) {
    const e = E();
    e.escolhida = id;
    const m = mundo();
    if (m) m.querySelectorAll('.ct-quadro').forEach(q => q.classList.toggle('selecionado', q.dataset.id === id));
    if (e.container) e.container.querySelectorAll('.ct-item').forEach(b => b.classList.toggle('active', b.dataset.foco === id));
    avisarPosicoes();
  }

  // Desliza E ENQUADRA (D29), com margem pequena (D39).
  function irPara(id, acesa, entrarDepois) {
    const e = E(), c = canvas(), p = e.posicoes[id];
    if (!c || !p || !quadro(id)) return;
    const [w, h] = tam(), r = c.getBoundingClientRect();
    e.escala = Math.max(ESCALA_MIN, Math.min(ESCALA_MAX, (r.width - 2 * MARGEM_ENQUADRAR) / w,
                                                         (r.height - 40) / (h + 24)));
    e.px = r.width / 2 - (p.x + w / 2) * e.escala;
    e.py = r.height / 2 - (p.y + h / 2) * e.escala + 10;
    const m = mundo();
    m.classList.add('deslizando');
    c.classList.add('deslizando');
    aplicar();
    selecionar(id);
    if (acesa && acesa.ligacao) {
      // O elemento de origem acende por um instante (D16), na cor das setas.
      const cor = getComputedStyle(c).getPropertyValue('--ct-seta-cor').trim();
      window.ctAcender(acesa.ligacao.de, acesa.ligacao.origem.chave, cor);
      if (typeof window.ctAoAcender === 'function') window.ctAoAcender(acesa.ligacao);
    }
    setTimeout(() => {
      if (!montada()) return;
      m.classList.remove('deslizando');
      c.classList.remove('deslizando');
      const q = quadro(id);
      if (!q) return;
      if (entrarDepois) entrar(id);
      q.classList.add('chegou');
      setTimeout(() => { q.classList.remove('chegou'); avisarPosicoes(); }, DESTAQUE_MS);
      avisarPosicoes();
    }, DESLIZE_MS);
  }

  function zoomEm(mx, my, nova) {
    const e = E();
    nova = Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, nova));
    e.px = mx - (mx - e.px) * nova / e.escala;
    e.py = my - (my - e.py) * nova / e.escala;
    e.escala = nova;
    aplicar();
  }

  function zoomCentro(f) {
    const c = canvas();
    if (!c) return;
    const r = c.getBoundingClientRect();
    zoomEm(r.width / 2, r.height / 2, E().escala * f);
  }

  // Dentro, a capa some e a página é um mini navegador: rola, digita, clica (D32).
  function entrar(id) {
    const e = E();
    if (e.dentro === id) return;
    sair();
    const q = quadro(id);
    if (!q) return;
    e.dentro = id;
    q.classList.add('dentro');
    selecionar(id);
    const f = q.querySelector('iframe');
    try { f.focus(); } catch (err) { /* nada */ }
  }

  function sair() {
    const e = E();
    if (!e.dentro) return;
    const q = quadro(e.dentro);
    if (q) q.classList.remove('dentro');
    e.dentro = null;
    avisarPosicoes();
  }

  // Ao chegar, já está dentro da tela de destino (D40, D6).
  function navegar(ligacao) {
    if (!ligacao) return;
    sair();
    irPara(ligacao.para, { ligacao }, true);
  }

  function recolher(qual, sim) {
    const alvo = achar(qual === 'lista' ? 'ct-lista' : 'ct-cabecalho');
    const volta = achar(qual === 'lista' ? 'ct-abrir-lista' : 'ct-abrir-topo');
    if (!alvo || !volta) return;
    alvo.classList.toggle('hidden', sim);
    volta.classList.toggle('hidden', !sim);
    avisarPosicoes();
  }

  // A origem em que caiu um clique na capa, pelos retângulos que a página
  // mandou por último (F28). A menor que contém o ponto é a mais de dentro.
  function origemNoPonto(id, x, y) {
    const pos = E().posicoesDe[id];
    if (!pos) return null;
    let melhor = null;
    (pos.itens || []).forEach(it => {
      if (x < it.x || y < it.y || x > it.x + it.w || y > it.y + it.h) return;
      if (!melhor || it.w * it.h < melhor.w * melhor.h) melhor = it;
    });
    return melhor;
  }

  function ligarQuadro(q) {
    const id = q.dataset.id;
    const capa = q.querySelector('.ct-capa');
    const f = q.querySelector('iframe');
    capa.addEventListener('click', ev => {
      if (arrastou) return;
      const r = f.getBoundingClientRect(), esc = E().escala;
      const hit = origemNoPonto(id, (ev.clientX - r.left) / esc, (ev.clientY - r.top) / esc);
      const lig = hit && ((E().leitura && E().leitura.ligacoes) || [])
        .find(l => l.de === id && l.origem.chave === hit.chave);
      if (lig) { navegar(lig); return; }
      irPara(id, undefined, true);        // entrar também enquadra (D39)
    });
    const rot = q.querySelector('.ct-quadro-rotulo');
    rot.addEventListener('mousedown', ev => {
      if (ev.button !== 0) return;
      ev.stopPropagation();
      selecionar(id);
      const e = E();
      const ini = { x: ev.clientX, y: ev.clientY, px: e.posicoes[id].x, py: e.posicoes[id].y };
      let moveu = false;
      q.classList.add('movendo');
      const mover = mv => {
        moveu = true;
        e.posicoes[id] = { x: ini.px + (mv.clientX - ini.x) / e.escala, y: ini.py + (mv.clientY - ini.y) / e.escala };
        q.style.left = e.posicoes[id].x + 'px';
        q.style.top = e.posicoes[id].y + 'px';
        avisarPosicoes();
      };
      const soltar = () => {
        removeEventListener('mousemove', mover);
        removeEventListener('mouseup', soltar);
        q.classList.remove('movendo');
        if (moveu && prefs().lembrar_posicoes !== false) gravarPosicoes();
      };
      addEventListener('mousemove', mover);
      addEventListener('mouseup', soltar);
    });
  }

  function gravarPosicoes() {
    const e = E();
    e.posicoesGravadas[e.tamanho] = JSON.parse(JSON.stringify(e.posicoes));
    window.ctChamar('posicoes_gravar', { projeto: e.projeto, tamanho: e.tamanho, posicoes: e.posicoes });
  }

  // O canvas: arrastar, clique do meio, roda. Ligado a cada container novo.
  function ligarCanvas(container) {
    const c = container.querySelector('#ct-canvas');
    if (!c) return;
    c.addEventListener('mousedown', ev => {
      if (ev.target.closest && ev.target.closest('.ct-flutua')) return;
      if (ev.button === 1) { ev.preventDefault(); verTudo(); return; }     // D11
      if (ev.button !== 0) return;
      sair();
      arrastou = false;
      c.classList.add('arrastando');
      const e = E(), ini = { x: ev.clientX, y: ev.clientY, px: e.px, py: e.py };
      const mover = mv => {
        if (Math.hypot(mv.clientX - ini.x, mv.clientY - ini.y) > ARRASTO_PX) arrastou = true;
        e.px = ini.px + mv.clientX - ini.x;
        e.py = ini.py + mv.clientY - ini.y;
        aplicar();
      };
      const soltar = () => {
        c.classList.remove('arrastando');
        removeEventListener('mousemove', mover);
        removeEventListener('mouseup', soltar);
      };
      addEventListener('mousemove', mover);
      addEventListener('mouseup', soltar);
    });
    // 1,2× por entalhe, em volta do cursor (D30). Dentro de uma tela a roda
    // nem chega aqui: o evento é do documento do iframe (D32).
    c.addEventListener('wheel', ev => {
      ev.preventDefault();
      const r = c.getBoundingClientRect();
      const entalhes = Math.min(3, Math.abs(ev.deltaY) / 100 || 1);
      zoomEm(ev.clientX - r.left, ev.clientY - r.top, E().escala * Math.pow(ZOOM_POR_ENTALHE, -Math.sign(ev.deltaY) * entalhes));
    }, { passive: false });
  }
  window.ctEstado.ligadores.push(ligarCanvas);

  // Esc sai da tela (D40); de dentro da página, chega pela mensagem `esc`.
  const aoTeclar = ev => { if (ev.key === 'Escape' && E().dentro) sair(); };
  document.addEventListener('keydown', aoTeclar);
  window.ctEstado.ouvintes.push([document, 'keydown', aoTeclar]);

  window.ctAplicar = aplicar;
  window.ctArrumar = arrumar;
  window.ctMontarQuadros = montarQuadros;
  window.ctVerTudo = verTudo;
  window.ctIrPara = irPara;
  window.ctZoomCentro = zoomCentro;
  window.ctEntrar = entrar;
  window.ctSair = sair;
  window.ctNavegar = navegar;
  window.ctSelecionar = selecionar;
  window.ctRecolher = recolher;
  // O ↺ Arrumar e o tamanho também gravam: a mesma função.
  window.ctEstado.gravarPosicoes = gravarPosicoes;
})();
