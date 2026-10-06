// Treemap e Sunburst — visualizações hierárquicas de linhas de código por pasta.
// Usa _metricsData, _buscarMetricas e _langColor, definidos em mapas.js.

let _treemapCor = 'linguagem';   // 'linguagem' | 'complexidade'
let _complexidadeMap = null;     // { caminho_absoluto: complexidade }
let _complexidadeMax = 1;

// Busca (com cache) a complexidade ciclomática por arquivo. Só é chamada quando
// o toggle "por complexidade" está ligado, para não parsear tudo à toa.
async function _carregarComplexidade() {
  if (_complexidadeMap) return;
  try {
    const r = await window.pywebview.api.get_complexidade(currentProject);
    _complexidadeMap = (r && r.success) ? (r.por_arquivo || {}) : {};
    _complexidadeMax = (r && r.success) ? (r.max || 1) : 1;
  } catch (e) {
    _complexidadeMap = {};
    _complexidadeMax = 1;
  }
}

// Escala verde (simples) → vermelho (muitos caminhos).
function _corComplexidade(val) {
  const t = Math.max(0, Math.min(1, (val - 1) / Math.max(1, _complexidadeMax - 1)));
  return `hsl(${(130 * (1 - t)).toFixed(0)}, 62%, 46%)`;
}

// Cor de cada retângulo do Treemap conforme o toggle.
function _corTreemap(d) {
  if (_treemapCor === 'complexidade' && _complexidadeMap) {
    const val = _complexidadeMap[d.data.path];
    if (typeof val === 'number') return _corComplexidade(val);
    return lerTokenDeCor('--mapa-sem-fluxo');  // arquivo sem fluxo de controle (não-código)
  }
  return _langColor(d.data.language);
}

// ── Treemap ───────────────────────────────────────────────────────────────────
async function renderTreemap() {
  _treemapRendered = false;
  const container = document.getElementById('treemap-container');
  container.innerHTML = '<div class="mapa-loading">Analisando…</div>';

  let data;
  try {
    data = await _buscarMetricas();
  } catch (err) {
    container.innerHTML = `<div class="mapa-placeholder">${err.message}</div>`;
    return;
  }

  container.innerHTML = '';
  if (_treemapCor === 'complexidade') await _carregarComplexidade();

  const w = container.clientWidth || 800;
  const h = container.clientHeight || 500;

  const root = d3.hierarchy(data)
    .sum(d => d.type === 'file' ? (d.lines || 1) : 0)
    .sort((a, b) => b.value - a.value);

  d3.treemap()
    .size([w, h])
    .paddingOuter(4)
    .paddingInner(1)
    .tile(d3.treemapResquarify)
    (root);

  const svg = d3.select(container)
    .append('svg')
    .attr('class', 'treemap-svg')
    .attr('width', w)
    .attr('height', h);
  // Duas camadas de propósito, como no Sunburst: o <svg> capta os gestos e a
  // `camada` recebe o transform do zoom (D61).
  const camada = svg.append('g');

  const leaves = root.leaves().filter(d => d.value > 0);

  const cell = camada.selectAll('g')
    .data(leaves)
    .join('g')
    .attr('transform', d => `translate(${d.x0},${d.y0})`);

  cell.append('rect')
    .attr('class', 'treemap-rect')
    .attr('width',  d => Math.max(0, d.x1 - d.x0))
    .attr('height', d => Math.max(0, d.y1 - d.y0))
    .attr('fill', d => _corTreemap(d))
    .append('title')
    .text(d => {
      // Caminho relativo completo, montado subindo até a raiz da árvore.
      const caminho = d.ancestors().reverse().map(n => n.data.name).join('/');
      let linha = `${d.data.name}\n${caminho}\n${d.data.language} · ${d.data.lines} linhas`;
      if (_treemapCor === 'complexidade' && _complexidadeMap) {
        const c = _complexidadeMap[d.data.path];
        if (typeof c === 'number') linha += ` · complexidade ${c}`;
      }
      return linha;
    });

  // Todo retângulo ganha o <text>; quem decide se ele aparece, e com quanto do
  // nome, é `_treemapRotulos` — em k = 1 exatamente a regra de antes, e
  // refeito no fim de cada gesto de zoom.
  cell.append('text')
    .attr('class', 'treemap-label');
  _treemapRotulos(cell, 1);
  _treemapLigarZoom(svg, camada, cell);

  const total = data.lines || root.value;
  document.getElementById('treemap-stat').textContent =
    `${leaves.length} arquivos · ${total.toLocaleString()} linhas` +
    ' · rodinha = zoom · arrastar = mover · botão do meio = enquadrar';
  _treemapRendered = true;
}

// ── Treemap: zoom, pan e enquadrar (D61) ─────────────────────────────────────
// Rodinha = zoom no ponto do mouse · clique da rodinha = enquadrar · arrastar
// com o botão esquerdo = mover — os gestos do Sunburst e do Palco. O clique
// simples num retângulo continua sendo o que era: nada além do balão (<title>)
// ao passar o mouse. O arrasto só começa depois de 4 px (`clickDistance`), para
// um clique com a mão tremendo não virar pan.
let _treemapZoom = null;   // {svg, zoom} do desenho atual — o ⤢ Enquadrar usa

function _treemapLigarZoom(svg, camada, cell) {
  const zoom = d3.zoom()
    .scaleExtent([0.5, 20])
    .clickDistance(4)
    .on('start', () => svg.classed('arrastando', true))
    .on('zoom', ev => camada.attr('transform', ev.transform))
    // Os nomes são refeitos uma vez, no FIM do gesto — por quadro travaria o
    // arrasto (convenção «"Cabe?" em desenho ampliável se responde por conta»).
    .on('end', ev => {
      svg.classed('arrastando', false);
      _treemapRotulos(cell, ev.transform.k);
    });

  svg.call(zoom)
    // O duplo clique do d3 dá zoom, e aqui atrapalha: o alvo é um retângulo que
    // o usuário quer inspecionar, não um salto de enquadramento.
    .on('dblclick.zoom', null);

  svg.on('mousedown.enquadrar', ev => {
    if (ev.button !== 1) return;
    // Sem isto o Windows abre o autoscroll e engole o resto da interação.
    ev.preventDefault();
    _treemapEnquadrar();
  });
  svg.on('auxclick.enquadrar', ev => { if (ev.button === 1) ev.preventDefault(); });

  _treemapZoom = { svg, zoom };
  const botao = document.getElementById('btn-treemap-enquadrar');
  if (botao) botao.onclick = _treemapEnquadrar;
}

// "Enquadrar" = o desenho inteiro de novo. O treemap nasce do tamanho do
// painel, então é a identidade, sem conta de caixa.
function _treemapEnquadrar() {
  if (!_treemapZoom) return;
  _treemapZoom.svg.transition().duration(250)
    .call(_treemapZoom.zoom.transform, d3.zoomIdentity);
}

// O nome de cada retângulo para a escala `k`. O texto é CONTRA-ESCALADO (fica
// com 11 px na tela em qualquer zoom), e o "cabe?" é medido em pixels de TELA:
// ampliar revela o nome de quem era pequeno demais. Em k = 1 é a regra de
// antes (largura > 30, altura > 14, ~6,5 px por caractere).
function _treemapRotulos(cell, k) {
  cell.select('text.treemap-label').each(function (d) {
    const el = d3.select(this);
    const w = (d.x1 - d.x0) * k;
    const h = (d.y1 - d.y0) * k;
    if (w <= 30 || h <= 14) { el.style('display', 'none'); return; }
    const nome = d.data.name;
    el.style('display', null)
      .style('font-size', `${(11 / k).toFixed(3)}px`)
      .attr('x', (4 / k).toFixed(3))
      .attr('y', (12 / k).toFixed(3))
      .text(nome.length * 6.5 < w - 8 ? nome : nome.slice(0, Math.floor((w - 8) / 6.5)));
  });
}

// ── Sunburst ──────────────────────────────────────────────────────────────────
async function renderSunburst() {
  _sunburstRendered = false;
  const container = document.getElementById('sunburst-container');
  container.innerHTML = '<div class="mapa-loading">Analisando…</div>';

  let data;
  try {
    data = await _buscarMetricas();
  } catch (err) {
    container.innerHTML = `<div class="mapa-placeholder">${err.message}</div>`;
    return;
  }

  container.innerHTML = '';
  // O SVG ocupa o painel INTEIRO, e só a rosca é quadrada. Antes o SVG também
  // era quadrado (`min(largura, altura)`), o que deixava a rosca encostada num
  // canto do painel largo — e como o SVG recorta o que passa das bordas, o
  // primeiro zoom já picotava o desenho contra um limite que nem era visível.
  const largura = container.clientWidth || 600;
  const altura = container.clientHeight || 600;
  const radius = Math.min(largura, altura) / 2;

  const root = d3.hierarchy(data)
    .sum(d => d.type === 'file' ? (d.lines || 1) : 0)
    .sort((a, b) => b.value - a.value);

  d3.partition().size([2 * Math.PI, radius])(root);

  const arc = d3.arc()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
    .padRadius(radius / 2)
    .innerRadius(d => d.y0)
    .outerRadius(d => Math.max(d.y0, d.y1 - 1));

  // Uma cor por nível de profundidade do sunburst. As seis já existiam no
  // `:root` com outro nome — a lista era uma sétima cópia dos mesmos hex. Lidas
  // do CSS aqui dentro, e não no topo do arquivo, porque `renderSunburst` só
  // roda depois que a folha de estilo carregou; no topo viriam vazias.
  const depthColors = [
    lerTokenDeCor('--designer-thumb-bg'),
    lerTokenDeCor('--blue-hover'),
    lerTokenDeCor('--green-hover'),
    lerTokenDeCor('--purple-hover'),
    lerTokenDeCor('--agente-analise'),
    lerTokenDeCor('--red'),
  ];

  // Três camadas de propósito: o <svg> capta os eventos, `camadaZoom` recebe a
  // transformação, e `svg` mantém a origem no centro para os arcos serem
  // desenhados em coordenadas polares a partir do (0,0).
  const svgEl = d3.select(container)
    .append('svg')
    .attr('class', 'sunburst-svg')
    .attr('width', largura)
    .attr('height', altura);

  const camadaZoom = svgEl.append('g');
  const svg = camadaZoom.append('g')
    .attr('transform', `translate(${largura / 2},${altura / 2})`);

  // O arco sob o cursor é escrito no cabeçalho, junto do título — ver o
  // comentário em mapas-template.js sobre por que ele saiu do miolo da rosca.
  const hoverEl = document.getElementById('sunburst-hover');
  const _hoverPadrao = () => {
    if (hoverEl) hoverEl.textContent = '';
  };
  _hoverPadrao();

  svg.append('g')
    .selectAll('path')
    .data(root.descendants().filter(d => d.depth && (d.x1 - d.x0) > 0.001))
    .join('path')
    .attr('class', 'sunburst-arc')
    .attr('d', arc)
    .attr('fill', d => {
      if (d.data.type === 'file') return _langColor(d.data.language);
      return depthColors[d.depth % depthColors.length];
    })
    .on('mouseover', function(event, d) {
      if (!hoverEl) return;
      // O caminho inteiro, não só o nome: sete pastas se chamam `agentes`, e o
      // nome sozinho não diz qual anel está sob o cursor.
      const caminho = d.ancestors().reverse().slice(1).map(n => n.data.name).join('/');
      hoverEl.textContent = `${caminho} — ${(d.value || 0).toLocaleString()} linhas`;
    })
    .on('mouseout', _hoverPadrao)
    .append('title')
    .text(d => `${d.data.name}\n${(d.value || 0).toLocaleString()} linhas`);

  _sunburstLigarZoom(svgEl, camadaZoom);

  document.getElementById('sunburst-stat').textContent =
    `${root.leaves().length} arquivos · ${(data.lines || 0).toLocaleString()} linhas` +
    ' · scroll = zoom · arrastar = mover · botão do meio = reenquadrar';
  _sunburstRendered = true;
}

// Zoom no scroll, pan arrastando com o botão esquerdo, e o clique do botão do
// meio volta ao enquadramento inicial.
//
// O anel de fora é onde ficam os arquivos, e é justamente onde as fatias são
// mais finas — sem zoom, a ponta que interessa é ilegível num projeto grande.
function _sunburstLigarZoom(svgEl, camada) {
  const zoom = d3.zoom()
    .scaleExtent([0.6, 20])
    .on('zoom', ev => camada.attr('transform', ev.transform))
    .on('start', () => svgEl.classed('arrastando', true))
    .on('end',   () => svgEl.classed('arrastando', false));

  svgEl.call(zoom)
    // O duplo clique do d3 dá zoom, e aqui atrapalha: o alvo do duplo clique é
    // uma fatia, e o usuário espera inspecioná-la, não saltar o enquadramento.
    .on('dblclick.zoom', null);

  svgEl.on('mousedown.reenquadrar', ev => {
    if (ev.button !== 1) return;
    // Sem isto o Windows abre o autoscroll (aquele ícone de setas) e engole o
    // resto da interação.
    ev.preventDefault();
    svgEl.transition().duration(250).call(zoom.transform, d3.zoomIdentity);
  });
  svgEl.on('auxclick.reenquadrar', ev => { if (ev.button === 1) ev.preventDefault(); });
}
