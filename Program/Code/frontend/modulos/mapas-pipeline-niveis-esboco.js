// ══════════════════════════════════ Mapa em níveis · esboço e janela do DOM
// Os dois remédios contra o travamento, e o que decide qual vale a cada quadro.
//
// ⚠️ O CUSTO NÃO É O JAVASCRIPT: É PINTAR MILHARES DE CARTÕES. Medido no
// Chrome em 26/09/2026, no projeto do próprio programa: o nível Arquivos
// enquadrado tinha 18 mil elementos no DOM, e cada quadro de arrasto levava
// ~310 ms (o nível Funções, 32 mil elementos, ~410 ms) — com o script em menos
// de 1 ms. O mesmo arrasto com o mundo escondido: ~60 ms. Por isso:
//
//   1. JANELA DO DOM: só ganha elemento o cartão que está na tela, mais a
//      folga de Configurações › Desempenho dos mapas («Área desenhada além da
//      tela»). O resto existe só em `_mn.lista`, com posição e tamanho.
//   2. ESBOÇO: com muitos cartões na tela, o gesto (arrastar, rodinha,
//      minimapa) é pintado num <canvas> simplificado — retângulos, nomes e
//      linhas —, em resolução menor, e tanto menor quanto mais afastado. O DOM
//      fica escondido e não custa nada. Afastado além de «Simplificar abaixo
//      de», o esboço fica mesmo com o mapa parado.
//
// O que some e o quanto borra é escolha do usuário, em Configurações ›
// Desempenho dos mapas (o mesmo `renderMapas` das Ligações).

const MN_RENDER_PADRAO = {
  mov_resolucao: 0.5, mov_sem_rotulos: true, mov_sem_setas: true,
  mov_sem_contorno: true, mov_sem_ligacoes: false, mov_sem_cor: false,
  mov_sem_destaque: true, lod_limite: 0.65, margem: 0.5, niveis_cartoes: 120,
};

function mnRender() {
  const r = (typeof renderMapas === 'object' && renderMapas) || {};
  return { ...MN_RENDER_PADRAO, ...r };
}

// ── o gesto ──────────────────────────────────────────────────────────────────
// A rodinha não tem "soltei": o gesto acaba 160 ms depois do último evento.
// O arrasto acaba no mouseup (`fimEm` = 0: sem relógio).

const _mnMov = { ativo: false, timer: 0 };

function mnMovendo(fimEm = 160) {
  clearTimeout(_mnMov.timer);
  if (!_mnMov.ativo) { _mnMov.ativo = true; mnMovimentoMudou(); }
  if (fimEm) _mnMov.timer = setTimeout(mnPararMovimento, fimEm);
}

function mnPararMovimento() {
  clearTimeout(_mnMov.timer);
  if (!_mnMov.ativo) return;
  _mnMov.ativo = false;
  mnMovimentoMudou();
  if (_mn.carregado) mnAplicarVisao();
}

// No DOM (poucos cartões na tela) o destaque da seleção também pode sumir
// durante o gesto: é o CSS de `.mn-sem-destaque` que tira o brilho e o
// escurecimento.
function mnMovimentoMudou() {
  const raiz = _mn.el && _mn.el.raiz;
  if (!raiz) return;
  raiz.classList.toggle('mn-movendo', _mnMov.ativo);
  raiz.classList.toggle('mn-sem-destaque', _mnMov.ativo && mnRender().mov_sem_destaque && !!_mn.selecionado);
}

// ── qual desenho vale agora ──────────────────────────────────────────────────

// O retângulo da tela em coordenadas do mapa, com `m` de folga de cada lado
// (m = 0,5 → meia tela a mais para cada lado).
function mnJanela(m) {
  const v = _mn.visao, vp = _mn.el.viewport;
  const w = vp.clientWidth / v.k, h = vp.clientHeight / v.k;
  return { x: -v.x / v.k - w * m, y: -v.y / v.k - h * m, w: w * (1 + 2 * m), h: h * (1 + 2 * m) };
}

const mnCruza = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// Pesado = muitos CARTÕES na tela (a caixa aberta não conta: quem pesa são os
// filhos dela). O teto é «Esboço a partir de» em Configurações; 0 = sempre.
function mnUsarEsboco() {
  if (!_mn.lista) return false;
  const cfg = mnRender(), teto = Math.round(cfg.niveis_cartoes);
  if (!_mnMov.ativo && _mn.visao.k >= cfg.lod_limite) return false;
  if (teto <= 0) return true;
  const tela = mnJanela(0);
  let n = 0;
  for (const x of _mn.lista) {
    if (x.aberto && x.tipo !== 'arquivo') continue;
    if (mnCruza(x, tela) && ++n >= teto) return true;
  }
  return false;
}

function mnLigarEsboco(ligar) {
  if (_mn.esbocoLigado === ligar) return;
  _mn.esbocoLigado = ligar;
  _mn.el.camera.style.visibility = ligar ? 'hidden' : '';
  _mn.el.esboco.style.display = ligar ? 'block' : 'none';
}

// Chamado por mnDesenhar, mnAplicarDestaques e mnAplicarVisao: põe na tela o
// que o estado diz, pelo desenho que estiver valendo.
function mnSincronizar() {
  if (!_mn.lista) return;
  if (_mn.esbocoLigado) mnPedirEsboco(); else mnSincronizarDom();
}

// ── janela do DOM ────────────────────────────────────────────────────────────

let _mnPedidoDom = false;
function mnPedirSincronizarDom() {
  if (_mnPedidoDom) return;
  _mnPedidoDom = true;
  requestAnimationFrame(() => { _mnPedidoDom = false; if (!_mn.esbocoLigado) mnSincronizarDom(); });
}

// Cria o elemento de quem entrou na janela e tira o de quem saiu. A lista vem
// em pré-ordem (pai antes do filho), então a caixa de dentro sempre é criada
// depois da de fora e fica por cima dela.
function mnSincronizarDom() {
  if (!_mn.lista) return;
  const janela = mnJanela(mnRender().margem);
  _mn.lista.forEach(n => {
    const quer = mnCruza(n, janela);
    if (quer && !n.el) { mnCriarElemento(n); mnPintarDestaqueNo(n); }
    else if (!quer && n.el) { n.el.remove(); n.el = null; }
  });
  _mn.arv.setas.forEach(s => {
    const quer = s.desenhavel && mnCruza(s.caixa, janela);
    if (quer && !s.el) { mnCriarSetaDom(s); mnPintarDestaqueSeta(s); }
    else if (!quer && s.el) mnRemoverSetaDom(s);
  });
}

// ── esboço ───────────────────────────────────────────────────────────────────

let _mnPedidoEsboco = false;
function mnPedirEsboco() {
  if (_mnPedidoEsboco) return;
  _mnPedidoEsboco = true;
  requestAnimationFrame(() => { _mnPedidoEsboco = false; if (_mn.esbocoLigado) mnDesenharEsboco(); });
}

const _mnCorA = new Map();
function mnCorA(hex, a) {
  const chave = hex + a;
  if (!_mnCorA.has(chave)) {
    const h = hex.replace('#', ''), v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const [r, g, b] = [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16));
    _mnCorA.set(chave, `rgba(${r},${g},${b},${a})`);
  }
  return _mnCorA.get(chave);
}

// O nome cortado com reticências para caber na largura. Medir texto a cada
// quadro pesaria: o corte fica guardado no nó até a largura mudar.
function mnNomeCabe(ctx, n, largura) {
  if (n._esb && n._esb.w === largura) return n._esb.t;
  let t = n.nome;
  if (ctx.measureText(t).width > largura) {
    while (t.length > 1 && ctx.measureText(t + '…').width > largura) t = t.slice(0, -1);
    t += '…';
  }
  n._esb = { w: largura, t };
  return t;
}

const MN_ESB_TRACO = { area: [10, 6], bloco: [7, 5], hub: [3, 5], chamada: [] };
const MN_ESB_LARGURA = { area: 3, bloco: 2.2, hub: 1.6, chamada: 1.6 };

function mnCorSeta(s) {
  if (s.tipo === 'chamada') return s.ponte ? '#38bdf8' : '#e74c3c';
  if (s.tipo === 'area') return 'rgb(155,89,182)';
  if (s.tipo === 'bloco') return '#1abc9c';
  return '#f39c12';
}

function mnDesenharEsboco() {
  const cv = _mn.el.esboco, vp = _mn.el.viewport, v = _mn.visao, cfg = mnRender(), mov = _mnMov.ativo;
  const larg = vp.clientWidth, alt = vp.clientHeight;
  // Resolução: cheia parada; no gesto, a de Configurações — e, afastado além
  // de «Simplificar abaixo de», menor ainda, até um terço dela.
  let res = window.devicePixelRatio || 1;
  if (mov) {
    res *= cfg.mov_resolucao;
    if (v.k < cfg.lod_limite) res *= Math.max(0.35, v.k / cfg.lod_limite);
  }
  const W = Math.max(1, Math.round(larg * res)), H = Math.max(1, Math.round(alt * res));
  if (cv.width !== W) cv.width = W;
  if (cv.height !== H) cv.height = H;
  cv.style.width = larg + 'px'; cv.style.height = alt + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.setTransform(res * v.k, 0, 0, res * v.k, res * v.x, res * v.y);

  const semRot = mov && cfg.mov_sem_rotulos, semCont = mov && cfg.mov_sem_contorno;
  const semCor = mov && cfg.mov_sem_cor, semLig = mov && cfg.mov_sem_ligacoes;
  const semSeta = mov && cfg.mov_sem_setas, semDest = mov && cfg.mov_sem_destaque;
  const px = 1 / v.k;                           // um pixel da tela, em unidades do mapa
  const tela = mnJanela(0.02);
  const estilo = getComputedStyle(_mn.el.raiz);
  const fundoCartao = estilo.getPropertyValue('--surface-dark').trim() || '#1a252f';
  const amarelo = estilo.getPropertyValue('--yellow').trim() || '#f1c40f';
  const cinza = MN_COR_SEM_ENTRADA;
  const aVista = _mn.lista.filter(n => mnCruza(n, tela));

  // 1. caixas e cartões, em pré-ordem: o filho pinta por cima do pai
  aVista.forEach(n => {
    const caixa = n.aberto && n.tipo !== 'arquivo';
    const cor = semCor ? cinza : n.cor;
    ctx.globalAlpha = !semDest && n.dApag ? (caixa ? 0.4 : 0.28) : 1;
    if (caixa) {
      ctx.fillStyle = mnCorA(cor, 0.07); ctx.fillRect(n.x, n.y, n.w, n.h);
      ctx.fillStyle = mnCorA(cor, 0.3);  ctx.fillRect(n.x, n.y, n.w, 30);
      if (!semCont) { ctx.strokeStyle = mnCorA(cor, 0.55); ctx.lineWidth = Math.max(1.5, px); ctx.strokeRect(n.x, n.y, n.w, n.h); }
    } else {
      ctx.fillStyle = fundoCartao; ctx.fillRect(n.x, n.y, n.w, n.h);
      ctx.fillStyle = cor;
      if (n.tipo === 'arquivo') ctx.fillRect(n.x, n.y, n.w, Math.min(4, n.h));
      else ctx.fillRect(n.x, n.y, 5, n.h);
      if (!semCont) { ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = px; ctx.strokeRect(n.x, n.y, n.w, n.h); }
    }
    if (!semDest && (n.dSel || n.dLig)) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = n.dSel ? amarelo : mnCorA('#f7dc6f', 0.9);
      ctx.lineWidth = Math.max(n.dSel ? 3 : 1.5, (n.dSel ? 2.5 : 1.5) * px);
      ctx.strokeRect(n.x, n.y, n.w, n.h);
    }
  });

  // 2. ligações
  if (!semLig) {
    ctx.lineCap = 'round';
    _mn.arv.setas.forEach(s => {
      if (!s.desenhavel || !s.mostrar || !mnCruza(s.caixa, tela)) return;
      if (!s.path2d) s.path2d = new Path2D(s.curva.d);
      const realce = !semDest && s.realce;
      ctx.globalAlpha = !semDest && s.apagada ? 0.07 : realce ? 1 : s.fraca ? 0.25 : s.tipo === 'hub' ? 0.75 : 0.85;
      ctx.strokeStyle = mnCorSeta(s);
      ctx.lineWidth = Math.max(MN_ESB_LARGURA[s.tipo] * (realce ? 1.6 : 1), px);
      ctx.setLineDash(MN_ESB_TRACO[s.tipo] || []);
      ctx.stroke(s.path2d);
      if (!semSeta && s.tipo !== 'hub') {
        // a ponta: um triângulo na direção do último trecho da curva
        const [, , c2, p3] = s.curva.pts, ang = Math.atan2(p3[1] - c2[1], p3[0] - c2[0]);
        const t = (s.tipo === 'chamada' ? 7 : 9) * Math.max(1, px * 0.8);
        ctx.setLineDash([]); ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.moveTo(p3[0], p3[1]);
        ctx.lineTo(p3[0] - t * Math.cos(ang - 0.45), p3[1] - t * Math.sin(ang - 0.45));
        ctx.lineTo(p3[0] - t * Math.cos(ang + 0.45), p3[1] - t * Math.sin(ang + 0.45));
        ctx.fill();
      }
    });
    ctx.setLineDash([]);
  }

  // 3. nomes — só onde o texto passa de 5 px na tela; menor que isso é borrão
  if (!semRot) {
    ctx.textBaseline = 'middle';
    aVista.forEach(n => {
      const caixa = n.aberto && n.tipo !== 'arquivo';
      const tam = n.tipo === 'area' ? 15 : n.tipo === 'arquivo' ? 12.5 : 14;
      if (tam * v.k < 5) return;
      ctx.globalAlpha = !semDest && n.dApag ? 0.35 : 1;
      ctx.font = `600 ${tam}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillStyle = '#e8eef2';
      const esq = n.tipo === 'arquivo' ? 10 : 14, livre = n.w - esq - (mnTemBotaoAbrir(n) ? 36 : 10);
      ctx.fillText(mnNomeCabe(ctx, n, Math.max(10, livre)), n.x + (caixa ? 10 : esq), n.y + (caixa ? 15 : 19));
      if (mnTemBotaoAbrir(n) && 20 * v.k >= 10) {
        const bx = n.x + n.w - 30, by = n.y + (caixa ? 5 : 8);
        ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = px; ctx.strokeRect(bx, by, 20, 20);
        ctx.font = '14px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(n.aberto ? '−' : '+', bx + 10, by + 10);
        ctx.textAlign = 'start';
      }
    });
    // a frase das ligações entre áreas e entre blocos
    if (11 * v.k >= 6) {
      ctx.font = '11px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center';
      _mn.arv.setas.forEach(s => {
        if (!s.desenhavel || !s.mostrarRot || !s.rot || !s.comFrase || !mnCruza(s.caixa, tela)) return;
        ctx.globalAlpha = !semDest && s.apagada ? 0.12 : 1;
        ctx.fillStyle = fundoCartao; ctx.fillRect(s.rot.x - s.rot.w / 2, s.rot.y - 10, s.rot.w, 20);
        ctx.fillStyle = s.tipo === 'area' ? '#e6d4f0' : '#e8eef2';
        ctx.fillText(s.rotulo, s.rot.x, s.rot.y, s.rot.w - 12);
      });
      ctx.textAlign = 'start';
    }
  }
  ctx.globalAlpha = 1;
}

// ── o que está sob o mouse, sem DOM ──────────────────────────────────────────
// Com o esboço na tela os cartões não existem como elemento: o clique acha o
// cartão pela geometria. Devolve o mesmo que o DOM responderia — o nó, se o
// alvo é o botão +/−, se é o cabeçalho de uma caixa e se é o miolo dela.

function mnTemBotaoAbrir(n) {
  return n !== _mn.raizAtual && (n.tipo === 'arquivo' ? n.dados.funcoes.length > 0 : n.filhos.length > 0);
}

function mnNoNoPonto(p) {
  if (!_mn.lista) return null;
  const v = _mn.visao, wx = (p.x - v.x) / v.k, wy = (p.y - v.y) / v.k;
  let achado = null;
  for (const n of _mn.lista) if (wx >= n.x && wx <= n.x + n.w && wy >= n.y && wy <= n.y + n.h) achado = n;
  if (!achado) return null;
  const caixa = achado.aberto && achado.tipo !== 'arquivo';
  const topo = achado.y + (caixa ? 5 : 8);
  const abrir = mnTemBotaoAbrir(achado) && wx >= achado.x + achado.w - 34 && wx <= achado.x + achado.w - 6 && wy >= topo - 3 && wy <= topo + 23;
  return {
    n: achado, abrir,
    cab: caixa && wy <= achado.y + 30,
    miolo: caixa && wy > achado.y + (achado.cab || 30),
  };
}
