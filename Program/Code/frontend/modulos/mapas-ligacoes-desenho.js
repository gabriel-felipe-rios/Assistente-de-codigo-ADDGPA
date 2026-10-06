// ══════════════════════════════ MAPAS: Ligações — o desenho ══
// Como o grafo vira SVG, e como se navega dentro dele (zoom, pan, enquadramento,
// qualidade durante o gesto). Saiu de `mapas-ligacoes.js` quando aquele arquivo
// passou das 500 linhas da AMF; a fronteira é limpa — de um lado de onde vem o
// dado e o que a tela controla, do outro como aquilo é pintado.
//
// ── O desenho segue a janela, não o contrário ──
// A primeira versão desenhava o grafo INTEIRO num SVG do tamanho do grafo, e
// escalava esse SVG com CSS. O custo de rasterizar é proporcional à área da
// superfície — largura × altura × k² —, então ampliar 8× num desenho de
// 4800×3500 pedia uma superfície de mais de um bilhão de pixels. Era por isso
// que afastado ficava rápido e aproximado travava: o contrário do que a
// intuição diz, porque aproximado mostra MENOS coisa.
//
// Hoje o SVG tem o tamanho da TELA (mais uma margem de folga) e o `viewBox`
// mostra só a janela visível. O custo é constante em qualquer zoom.
//
// ── O quanto degradar é do usuário, não meu ──
// Quanto o desenho perde de qualidade durante o gesto depende do tamanho do
// projeto e da máquina. Em vez de um número chutado aqui, isso vem da aba
// Configurações (`renderMapas`, ver config-render.js) — o usuário arrasta o
// slider e acha o ponto dele.
//
// Usa o estado declarado em mapas-ligacoes.js (`_ligFoco`, `_ligTransform`,
// `_ligZoomFn`, `_ligCaixaAtual`, `_ligReenquadrar`, `_ligWrap`, `_ligVista`,
// `_ligJanelaAtual`, `_ligLayoutAtual`, `_ligAjustando`, `_ligRepintarTimer`,
// `_ligRepintarRaf`), as constantes de geometria de mapas-ligacoes-modos.js
// (`LIG_NO_H`, `_ligLarguraRotulo`) e `_langColor`, de mapas.js.

// O que cada opção da configuração esconde. Vale tanto para o movimento quanto
// para o zoom baixo — é o mesmo vocabulário, ligado por motivos diferentes.
const LIG_SIMPLIFICACOES = [
  ['mov_sem_rotulos',  'lig-sem-rotulos'],
  ['mov_sem_setas',    'lig-sem-setas'],
  ['mov_sem_contorno', 'lig-sem-contorno'],
  ['mov_sem_ligacoes', 'lig-sem-ligacoes'],
  ['mov_sem_cor',      'lig-sem-cor'],
];

// Padrões de fábrica, caso a configuração ainda não tenha carregado.
const LIG_RENDER_PADRAO = {
  mov_resolucao: 0.5, mov_sem_rotulos: true, mov_sem_setas: true,
  mov_sem_contorno: true, mov_sem_ligacoes: false, mov_sem_cor: false,
  lod_limite: 0.65, margem: 0.5,
};

function _ligCfg() {
  return (typeof renderMapas === 'object' && renderMapas) || LIG_RENDER_PADRAO;
}

// A caixa REAL do desenho, contando a largura de cada rotulo. Nenhum dos 7
// layouts sabia disso: o viewBox era `0 0 w h`, e como a caixa do no e centrada
// em `n.x`, todo rotulo com 16 caracteres ou mais comecava em x negativo e era
// recortado. Pior caso medido: 60px de nome sumindo na borda esquerda.
function _ligCaixa(layout) {
  const esq = !!layout.alinhaEsquerda;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;

  layout.nos.forEach(n => {
    const w = _ligLarguraRotulo(n.rotulo);
    const a = esq ? n.x : n.x - w / 2;
    x0 = Math.min(x0, a);
    x1 = Math.max(x1, a + w);
    y0 = Math.min(y0, n.y - LIG_NO_H / 2);
    y1 = Math.max(y1, n.y + LIG_NO_H / 2);
  });
  (layout.bandas || []).forEach(b => {
    y0 = Math.min(y0, b.y);
    y1 = Math.max(y1, b.y + b.h);
  });

  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: layout.w || 800, h: layout.h || 500 };
  const M = 24;   // respiro em volta, para a caixa nao encostar na borda
  return { x: x0 - M, y: y0 - M, w: (x1 - x0) + M * 2, h: (y1 - y0) + M * 2 };
}

// A janela visível em coordenadas do desenho, já com a margem de folga.
function _ligJanela(cw, ch, T) {
  const m = _ligCfg().margem;
  const vw = cw / T.k, vh = ch / T.k;
  return {
    x: -T.x / T.k - vw * m,
    y: -T.y / T.k - vh * m,
    w: vw * (1 + m * 2),
    h: vh * (1 + m * 2),
  };
}

function _ligDentro(j, ax, ay, bx, by) {
  return bx >= j.x && ax <= j.x + j.w && by >= j.y && ay <= j.y + j.h;
}

// Liga as classes de simplificação. `gesto` = está arrastando/ampliando agora;
// abaixo de `lod_limite` o texto e as setas somem mesmo parado, porque naquele
// tamanho eles já são ilegíveis e só custam raster.
function _ligSimplificar(container, k, gesto) {
  const cfg = _ligCfg();
  const afastado = k < cfg.lod_limite;
  const alvo = new Set();
  if (gesto) LIG_SIMPLIFICACOES.forEach(([chave, cls]) => { if (cfg[chave]) alvo.add(cls); });
  if (afastado) { alvo.add('lig-sem-rotulos'); alvo.add('lig-sem-setas'); }

  const assinatura = [...alvo].sort().join(' ');
  if (container._ligSimp === assinatura) return;   // so mexe no CSSOM quando muda
  container._ligSimp = assinatura;
  LIG_SIMPLIFICACOES.forEach(([, cls]) => container.classList.toggle(cls, alvo.has(cls)));
}

// Põe o desenho já pintado no lugar certo para a transform corrente. Enquanto o
// gesto acontece, o que se vê é o raster antigo escalado — barato. Se ele foi
// pintado em resolução reduzida, essa escala é justamente o borrão pedido.
function _ligPosicionar(T) {
  if (!_ligWrap || !_ligVista || !_ligJanelaAtual) return;
  const s = T.k / _ligVista.kPintura;
  _ligWrap.style.transform =
    `translate(${_ligJanelaAtual.x * T.k + T.x}px,${_ligJanelaAtual.y * T.k + T.y}px) scale(${s})`;
}

// Pinta a janela visível. `fator` < 1 pinta em resolução reduzida: a superfície
// cai com o quadrado dele (0,5 → 4× mais barato) e a imagem sobe ampliada,
// visivelmente borrada. É o multiplicador de qualidade da configuração.
function _ligPintar(container, layout, T, fator) {
  const cw = container.clientWidth || 800;
  const ch = container.clientHeight || 500;
  const j = _ligJanela(cw, ch, T);
  const kPintura = T.k * (fator || 1);

  if (_ligWrap && _ligWrap.parentNode === container) container.removeChild(_ligWrap);
  const wrap = document.createElement('div');
  wrap.className = 'ligacoes-pan-wrap';
  container.appendChild(wrap);
  _ligWrap = wrap;
  _ligVista = { x: T.x, y: T.y, k: T.k, kPintura };
  _ligJanelaAtual = j;

  // O tamanho em pixels é o da tela mais a margem — nunca o do desenho inteiro.
  const svgEl = d3.select(wrap).append('svg')
    .attr('class', 'ligacoes-svg')
    .attr('width', j.w * kPintura).attr('height', j.h * kPintura)
    .attr('viewBox', `${j.x} ${j.y} ${j.w} ${j.h}`);

  svgEl.append('defs').append('marker')
    .attr('id', 'lig-seta').attr('viewBox', '0 0 10 10')
    .attr('refX', 10).attr('refY', 5).attr('markerWidth', 6).attr('markerHeight', 6)
    .attr('orient', 'auto-start-reverse')
    .append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z').attr('class', 'lig-seta-ponta');

  const bandas = (layout.bandas || []).filter(b => _ligDentro(j, j.x, b.y, j.x + j.w, b.y + b.h));
  bandas.forEach(b => {
    svgEl.append('rect').attr('class', 'lig-banda')
      .attr('x', _ligCaixaAtual.x + 12).attr('y', b.y)
      .attr('width', _ligCaixaAtual.w - 24).attr('height', b.h).attr('rx', 8);
  });

  const chaveDe = n => (layout.porChave ? n.chave : n.id);
  const pos = new Map();
  layout.nos.forEach(n => pos.set(chaveDe(n), n));

  // A curva usa pontos de controle na mesma altura das pontas, entao ela nunca
  // sai da caixa formada pelas duas: dá para cortar pela caixa das pontas.
  const arestas = layout.arestas.filter(a => {
    const p = pos.get(a.a), q = pos.get(a.b);
    return p && q && _ligDentro(j, Math.min(p.x, q.x), Math.min(p.y, q.y),
                                Math.max(p.x, q.x), Math.max(p.y, q.y));
  });

  svgEl.append('g').selectAll('path').data(arestas).join('path')
    .attr('class', a => `lig-aresta lig-aresta--${a.tipo}`)
    .attr('marker-end', 'url(#lig-seta)')
    .attr('d', a => {
      const p = pos.get(a.a), q = pos.get(a.b);
      const meio = (p.x + q.x) / 2;
      return `M${p.x},${p.y} C${meio},${p.y} ${meio},${q.y} ${q.x},${q.y}`;
    });

  // O titulo da faixa vem DEPOIS das arestas: desenhado antes, as linhas
  // passavam por cima do nome ("Backend Python" riscado ao meio).
  bandas.forEach(b => {
    svgEl.append('text').attr('class', 'lig-banda-titulo')
      .attr('x', _ligCaixaAtual.x + 26).attr('y', b.y + 20).text(b.titulo);
  });

  // Alguns layouts (Pastas) alinham a esquerda: com caixas de larguras
  // diferentes centradas, a lista sai serrilhada e fica dificil de ler.
  const esq = !!layout.alinhaEsquerda;
  const nos = layout.nos.filter(n => {
    const w = _ligLarguraRotulo(n.rotulo);
    const a = esq ? n.x : n.x - w / 2;
    return _ligDentro(j, a, n.y - LIG_NO_H / 2, a + w, n.y + LIG_NO_H / 2);
  });

  const grupos = svgEl.append('g').selectAll('g').data(nos).join('g')
    .attr('class', n => 'lig-no' + (n.pasta ? ' lig-no--pasta' : '')
                      + (n.id === _ligFoco ? ' lig-no--foco' : ''))
    .attr('transform', n => `translate(${n.x},${n.y})`)
    .on('click', (ev, n) => _ligClicar(n));

  grupos.append('rect')
    .attr('x', n => (esq ? 0 : -_ligLarguraRotulo(n.rotulo) / 2)).attr('y', -LIG_NO_H / 2)
    .attr('width', n => _ligLarguraRotulo(n.rotulo)).attr('height', LIG_NO_H).attr('rx', 5)
    .attr('fill', n => (n.pasta ? null : _langColor(_ligLinguagem(n.id))));

  grupos.append('text')
    .attr('text-anchor', esq ? 'start' : 'middle')
    .attr('x', esq ? 8 : 0).attr('dy', 4)
    .text(n => n.rotulo);

  // O balao e o `<title>` nativo do SVG: etiqueta flutuante em HTML e ancorada
  // na tela e o desenho anda com o zoom/pan — bastava ampliar para o texto cair
  // em cima dos nos (foi o que aconteceu no Sunburst).
  grupos.append('title').text(n => n.pasta
    ? `${n.id.slice(6)}\n(clique para abrir/fechar)`
    : `${n.id}\n(clique para recentrar aqui)`);

  _ligPosicionar(T);
}

// Cancela qualquer repintar pendente — o adiado do fim do gesto e o do meio.
function _ligCancelarRepintar() {
  if (_ligRepintarTimer) { clearTimeout(_ligRepintarTimer); _ligRepintarTimer = null; }
  if (_ligRepintarRaf) { cancelAnimationFrame(_ligRepintarRaf); _ligRepintarRaf = null; }
}

// Durante o gesto, repinta quando o raster já não serve: se a escala se afastou
// demais da que foi pintada, a superfície composta cresce com o quadrado dela;
// se a janela saiu da área pintada, aparece vazio. Em resolução reduzida.
function _ligTalvezRepintarNoGesto(container) {
  if (!_ligVista || !_ligJanelaAtual || _ligRepintarRaf) return;
  const T = _ligTransform;
  const drift = T.k / _ligVista.k;
  const j = _ligJanelaAtual;
  const cw = container.clientWidth || 800, ch = container.clientHeight || 500;
  const vx = -T.x / T.k, vy = -T.y / T.k;
  const fora = vx < j.x || vy < j.y || vx + cw / T.k > j.x + j.w || vy + ch / T.k > j.y + j.h;
  if (drift > 0.7 && drift < 1.45 && !fora) return;

  _ligRepintarRaf = requestAnimationFrame(() => {
    _ligRepintarRaf = null;
    _ligPintar(container, _ligLayoutAtual, _ligTransform, _ligCfg().mov_resolucao);
  });
}

function _ligDesenhar(container, layout) {
  _ligCancelarRepintar();
  _ligLayoutAtual = layout;
  _ligCaixaAtual = _ligCaixa(layout);

  // Expandir uma pasta ou arrastar um slider recria o desenho — mas nao e um
  // pedido para voltar ao inicio. Trocar de MODO ou de FOCO e: ali o desenho
  // inteiro muda de tamanho, e carregar o enquadramento antigo jogava o novo
  // para fora da tela.
  if (_ligReenquadrar || !_ligTransform) {
    _ligReenquadrar = false;
    _ligTransform = _ligTransformDeAjuste(container, _ligCaixaAtual);
  }

  _ligPintar(container, layout, _ligTransform, 1);
  _ligSimplificar(container, _ligTransform.k, false);

  _ligZoomFn = d3.zoom().scaleExtent([0.1, 8])
    .on('start', () => {
      if (_ligAjustando) return;
      container.classList.add('arrastando');
      _ligSimplificar(container, _ligTransform.k, true);
      // `will-change` DURANTE o gesto: promove a camada, e o compositor escala o
      // raster que ja existe em vez de repintar tudo a cada quadro.
      if (_ligWrap) _ligWrap.style.willChange = 'transform';
    })
    .on('zoom', ev => {
      _ligTransform = ev.transform;
      if (_ligAjustando) return;
      _ligPosicionar(ev.transform);
      _ligTalvezRepintarNoGesto(container);
    })
    .on('end', () => {
      if (_ligAjustando) return;
      container.classList.remove('arrastando');
      if (_ligWrap) _ligWrap.style.willChange = 'auto';

      // ⚠️ O repintar do fim do gesto É ADIADO POR UMA MACROTAREFA, e isso não é
      // detalhe: um clique parado dispara `start`→`end` no d3, e repintar aqui
      // destruiria o `<g class="lig-no">` que recebeu o mousedown ANTES de o
      // browser despachar o `click` — que então nunca chegaria no nó. Foi
      // exatamente assim que clicar num arquivo parou de funcionar.
      // `setTimeout(0)` entra na fila depois do `click`, que é despachado na
      // mesma volta do laço de eventos que o `mouseup`.
      //
      // Não basta comparar a transform: um arrasto de 1–2px muda a transform e
      // MESMO ASSIM deixa o clique passar (o d3 só instala o supressor de
      // clique acima do `clickDistance` dele).
      _ligCancelarRepintar();
      _ligRepintarTimer = setTimeout(() => {
        _ligRepintarTimer = null;
        _ligSimplificar(container, _ligTransform.k, false);
        _ligPintar(container, _ligLayoutAtual, _ligTransform, 1);
      }, 0);
    });

  const alvo = d3.select(container);
  alvo.call(_ligZoomFn).on('dblclick.zoom', null);
  alvo.on('mousedown.reenquadrar', ev => {
    if (ev.button !== 1) return;
    ev.preventDefault();
    _ligCentralizar();
  });
  alvo.on('auxclick.reenquadrar', ev => { if (ev.button === 1) ev.preventDefault(); });

  // Sincroniza o estado interno do d3 com a transform que acabamos de pintar,
  // sem disparar um repintar redundante.
  _ligAjustando = true;
  alvo.call(_ligZoomFn.transform, _ligTransform);
  _ligAjustando = false;
}

// A transform que faz o desenho INTEIRO caber no container, centralizado.
// `d3.zoomIdentity` nao servia: o desenho e quase sempre maior que a tela, e
// "voltar ao inicio" mostrava o canto superior esquerdo, nao o desenho.
function _ligTransformDeAjuste(container, caixa) {
  const cw = container.clientWidth || 800;
  const ch = container.clientHeight || 500;
  const k = Math.min(1, Math.min(cw / caixa.w, ch / caixa.h));
  return d3.zoomIdentity
    .translate((cw - caixa.w * k) / 2 - caixa.x * k, (ch - caixa.h * k) / 2 - caixa.y * k)
    .scale(k);
}

function _ligLinguagem(id) {
  const n = _ligDados && _ligDados.nos.get(id);
  const lang = n && n.linguagem;
  if (lang && lang.length > 3) return lang;   // 'Python', 'JavaScript'…
  return { py: 'Python', pyw: 'Python', js: 'JavaScript', ts: 'TypeScript',
           html: 'HTML', css: 'CSS', json: 'JSON', md: 'Markdown' }[lang || (id.split('.').pop() || '').toLowerCase()] || 'Other';
}

// "Centralizar" ENQUADRA: mostra o desenho inteiro, centralizado. Voltar a 100%
// nao servia — o desenho e quase sempre maior que a tela, e o usuario caia no
// canto superior esquerdo em vez de ver o que pediu.
function _ligCentralizar() {
  if (!_ligWrap || !_ligZoomFn || !_ligCaixaAtual) return;
  const container = _ligWrap.parentNode;
  const alvo = _ligTransformDeAjuste(container, _ligCaixaAtual);
  d3.select(container).transition().duration(250).call(_ligZoomFn.transform, alvo);
}
