// ══════════════════════════════════════════════════════ ABA: MAPAS ══
// Arquivo base: declara todo o estado compartilhado da aba Mapas e a
// inicialização/wiring dos controles. As demais variáveis let/const deste
// domínio NÃO podem ser redeclaradas em mapas-matriz.js/mapas-hierarquia.js/
// mapas-hotspots.js/mapas-dispersao.js/mapas-proporcao.js/mapas-painel.js/
// mapas-ligacoes.js —
// eles só leem/reatribuem as daqui (redeclarar a mesma let/const global em
// outro <script> lança erro).

let _depsData    = null;   // cache de analyze_imports (Matriz, Dispersão, Painel)
let _ioData      = null;   // cache de scan_file_io (Matriz de I/O)
let _metricsData = null;   // cache de get_file_tree_metrics (Treemap, Sunburst, Proporção, Hotspots, Painel)
// ⚠️ SÓ O WIRING, e não "a aba já abriu uma vez".
//
// Até aqui esta flag guardava `initMapasTab()` INTEIRA, inclusive o render
// inicial — ou seja, a aba Mapas se desenhava uma vez por abertura do programa
// e nunca mais. Com abas de projeto isso virou um defeito visível: abrir Mapas
// no projeto A, trocar para B e abrir Mapas mostrava o desenho de A. Agora ela
// guarda só o que de fato pode ser feito uma vez — pendurar os listeners.
let _mapasWired = false;
// De qual projeto são os três caches abaixo. `null` = ninguém ainda.
let _mapasProjeto = null;
let _matrizRendered = false;
let _treemapRendered = false;
let _sunburstRendered = false;

// Zoom/pan da Matriz de Dependências (mecanismo herdado do antigo DSM)
let _dsmZoom = 1;
let _dsmPanX = 0;
let _dsmPanY = 0;

const LANG_COLORS = {
  Python: '#3572A5', JavaScript: '#f1e05a', TypeScript: '#3178c6',
  'C#': '#178600', Java: '#b07219', Go: '#00ADD8',
  Rust: '#dea584', C: '#555555', 'C++': '#f34b7d',
  HTML: '#e34c26', CSS: '#563d7c',
  JSON: '#f0a742', Markdown: '#8a5cf5', Ruby: '#701516', PHP: '#4F5D95',
  Swift: '#F05138', Kotlin: '#A97BFF', XML: '#0060ac', YAML: '#cb171e',
  Shell: '#89e051', Batch: '#C1F12E', PowerShell: '#3f6fb5', SQL: '#e38c00',
  TOML: '#9c4221', INI: '#6d8086', Texto: '#8a94a6',
  Other: '#aaaaaa',
};

function _langColor(lang) {
  return LANG_COLORS[lang] || LANG_COLORS.Other;
}

// ── Helpers compartilhados de dados ────────────────────────────────────────────
// Achata a árvore de get_file_tree_metrics numa lista de arquivos, cada um com
// caminho relativo (sem o nome da raiz/projeto), linhas e linguagem.
function _achatarArvore(raiz) {
  const arquivos = [];
  function percorrer(no, prefixo) {
    if (no.type === 'file') {
      arquivos.push({
        nome: no.name,
        caminho: prefixo ? `${prefixo}/${no.name}` : no.name,
        linhas: no.lines || 0,
        linguagem: no.language || 'Other',
      });
      return;
    }
    const novo = prefixo ? `${prefixo}/${no.name}` : no.name;
    (no.children || []).forEach(filho => percorrer(filho, novo));
  }
  (raiz.children || []).forEach(filho => percorrer(filho, ''));
  return arquivos;
}

// Calcula acoplamento por arquivo a partir do grafo de imports:
// dependencias = fan-out (quantos arquivos este importa);
// dependentes  = fan-in  (quantos arquivos importam este).
function _calcularAcoplamento(dados) {
  const mapa = {};
  dados.nodes.forEach(no => { mapa[no.id] = { dependencias: 0, dependentes: 0 }; });
  dados.edges.forEach(aresta => {
    if (mapa[aresta.source]) mapa[aresta.source].dependencias++;
    if (mapa[aresta.target]) mapa[aresta.target].dependentes++;
  });
  return mapa;
}

// Busca (com cache) o grafo de imports. Usado por Matriz, Dispersão e Painel.
async function _buscarDeps() {
  if (_depsData) return _depsData;
  const r = await window.pywebview.api.analyze_imports(currentProject);
  if (!r.success) throw new Error(r.error || 'Falha ao analisar imports.');
  _depsData = r;
  return r;
}

// Busca (com cache) as operações de disco por arquivo. Usado pela Matriz de I/O.
// A varredura lê o código-fonte na hora — não depende de nada que a Automação
// gere, então não há ordem de execução a respeitar.
async function _buscarIO() {
  if (_ioData) return _ioData;
  const r = await window.pywebview.api.scan_file_io(currentProject);
  if (!r.success) throw new Error(r.error || 'Falha ao varrer as operações de disco.');
  _ioData = r;
  return r;
}

// Busca (com cache) as métricas por arquivo/pasta. Usado por Treemap, Sunburst,
// Proporção, Hotspots e Painel.
async function _buscarMetricas() {
  if (_metricsData) return _metricsData;
  const r = await window.pywebview.api.get_file_tree_metrics(currentProject);
  if (!r.success || !r.root) throw new Error(r.error || 'Nenhum arquivo encontrado.');
  _metricsData = r.root;
  return _metricsData;
}

// Os três caches acima guardam dados DE UM PROJETO. Sem esta invalidação eles
// atravessavam a troca de aba, e `_buscarDeps`/`_buscarIO`/`_buscarMetricas`
// devolviam o grafo do projeto anterior sem ir ao backend — era o "fui no outro
// projeto em Mapas e não atualizou". Chamada por `initMapasTab`, que agora roda
// a cada abertura da aba.
function _mapasConferirProjeto() {
  if (_mapasProjeto === currentProject) return;
  _mapasProjeto = currentProject;
  _depsData    = null;
  _ioData      = null;
  _metricsData = null;
  // As Ligações guardam o dado delas no próprio módulo: sem isto, voltar a
  // elas noutro projeto mostrava o grafo do anterior.
  _ligDados     = null;
  _ligTransform = null;
  // Os três "já desenhei" são pares dos caches: mantê-los ligados faria o
  // desenho novo ser pulado, e a tela ficaria com o do projeto anterior mesmo
  // com o cache já limpo.
  _matrizRendered   = false;
  _treemapRendered  = false;
  _sunburstRendered = false;
}

// ── Inicialização ─────────────────────────────────────────────────────────────
//
// ⚠️ Roda a CADA abertura da aba, e não uma vez por abertura do programa. O que
// só pode acontecer uma vez é o wiring (`_mapasWired`); o resto — conferir o
// projeto e desenhar a sub-aba ativa — é justamente o que precisa repetir
// quando se troca de aba de projeto.
function initMapasTab() {
  _mapasConferirProjeto();
  if (_mapasWired) {
    // Já está tudo pendurado: só redesenha a sub-aba que estiver na frente.
    const ativoJa = document.querySelector('.mapas-tab-btn.active');
    if (ativoJa) _abrirMapa(ativoJa.dataset.mapa);
    return;
  }
  _mapasWired = true;

  // Sub-abas de Mapas
  document.querySelectorAll('.mapas-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mapas-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.mapas-tab-content').forEach(c => {
        c.classList.remove('active'); c.classList.add('hidden');
      });
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.mapa);
      target.classList.remove('hidden');
      target.classList.add('active');

      _abrirMapa(btn.dataset.mapa);
    });
  });

  // Botões "Analisar" — só nas abas que têm re-análise manual
  document.getElementById('btn-analyze-matriz')?.addEventListener('click', () => {
    _depsData = null; renderMatriz();
  });
  document.getElementById('btn-analyze-matriz-io')?.addEventListener('click', () => {
    _ioData = null; renderMatrizIO();
  });
  document.getElementById('btn-analyze-treemap')?.addEventListener('click', () => {
    _metricsData = null; _complexidadeMap = null; renderTreemap();
  });
  document.getElementById('btn-analyze-sunburst')?.addEventListener('click', () => {
    _metricsData = null; renderSunburst();
  });

  // Toggle Resumida / Detalhada (Matriz de I/O) — troca o quanto o eixo das
  // COLUNAS abre: as 5 famílias, ou os 10 tipos.
  _wireToggle('mio-matriz-modo-toggle', 'modo', valor => _miomTrocarModo(valor));
  document.getElementById('btn-mio-matriz-expandir')?.addEventListener('click', () => _miomExpandirTudo(true));
  document.getElementById('btn-mio-matriz-retrair')?.addEventListener('click', () => _miomExpandirTudo(false));

  // Toggle Por arquivo / Por pasta (Matriz)
  _wireToggle('matriz-modo-toggle', 'modo', valor => {
    _matrizModo = valor;
    // O Interruptor só existe na visão por arquivo: na visão por pasta não há
    // pasta nenhuma sem dependência para esconder, e um controle que não muda
    // nada na tela parece quebrado.
    const pill = document.getElementById('matriz-semdeps');
    if (pill) pill.classList.toggle('hidden', valor === 'pasta');
    renderMatriz();
  });
  // Interruptor "Mostrar sem dependências" (Matriz). Não usa o `_wireToggle`:
  // aquele é do Toggle segmentado, e este é o componente Interruptor —
  // `<label>` com a classe `.on` no trilho E no rótulo, as duas juntas.
  const pillSemDeps = document.getElementById('matriz-semdeps');
  if (pillSemDeps) {
    pillSemDeps.addEventListener('click', () => {
      _matrizSemDeps = !_matrizSemDeps;
      pillSemDeps.querySelector('.toggle-track')?.classList.toggle('on', _matrizSemDeps);
      pillSemDeps.querySelector('.toggle-label')?.classList.toggle('on', _matrizSemDeps);
      renderMatriz();
    });
  }
  // Toggle de recorte (Hotspots): linhas de código ou fan-in
  _wireToggle('hotspots-modo-toggle', 'modo', valor => { _hotspotsModo = valor; renderHotspots(); });
  // Toggle de quantidade (Hotspots): quantos entram no ranking
  _wireToggle('hotspots-topo-toggle', 'topo', valor => { _hotspotsTopo = +valor; renderHotspots(); });
  // Toggle de par de métricas (Dispersão)
  _wireToggle('dispersao-modo-toggle', 'modo', valor => { _dispersaoModo = valor; renderDispersao(); });
  // Toggle de cor (Treemap) — "complexidade" desabilitado nesta fase
  _wireToggle('treemap-cor-toggle', 'cor', valor => { _treemapCor = valor; renderTreemap(); });

  // ── Controle de zoom da Matriz ───────────────────────────────────────────────
  const sliderDsmZoom = document.getElementById('ctrl-dsm-zoom');
  if (sliderDsmZoom) {
    sliderDsmZoom.addEventListener('input', () => {
      // O slider não tem cursor sobre a matriz — ancora no centro do visível,
      // que é o ponto que o usuário está olhando quando mexe nele.
      const c = _dsmCentro();
      _dsmAplicarZoom(+sliderDsmZoom.value, c.x, c.y);
    });
  }

  // Pan via drag no wrapper da Matriz
  _initDsmPan();

  // Sub-aba Ligacoes (modulo proprio)
  initLigacoes();

  // Render inicial da sub-aba ativa (Matriz por padrão)
  const ativo = document.querySelector('.mapas-tab-btn.active');
  if (ativo) _abrirMapa(ativo.dataset.mapa);
}

// Mostra a sub-aba indicada e dispara seu render (usado no clique e no 1º acesso).
function _abrirMapa(mapa) {
  const dsmControls = document.getElementById('dsm-controls');
  if (dsmControls) dsmControls.style.display = mapa === 'mapa-matriz' ? '' : 'none';
  // Ligacoes so mostra os controles depois que o dado chega: antes disso nao
  // ha o que filtrar, e um painel cheio de slider morto so confunde.
  const ligControls = document.getElementById('ligacoes-controls');
  if (ligControls && mapa !== 'mapa-ligacoes') ligControls.style.display = 'none';

  if (mapa === 'mapa-pipeline')       renderPipeline();
  else if (mapa === 'mapa-matriz')    renderMatriz();
  else if (mapa === 'mapa-matriz-io') renderMatrizIO();
  else if (mapa === 'mapa-hotspots')  renderHotspots();
  else if (mapa === 'mapa-dispersao') renderDispersao();
  else if (mapa === 'mapa-proporcao') renderProporcao();
  else if (mapa === 'mapa-painel')    renderPainel();
  else if (mapa === 'mapa-treemap')   renderTreemap();
  else if (mapa === 'mapa-sunburst')  renderSunburst();
  else if (mapa === 'mapa-ligacoes')  _ligAbrir();
}

// Liga um grupo de botões-toggle: marca o clicado como ativo e chama onSelect
// com o valor do data-attribute indicado. Ignora botões desabilitados.
function _wireToggle(groupId, attr, onSelect) {
  const grupo = document.getElementById(groupId);
  if (!grupo) return;
  grupo.querySelectorAll('.mapa-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      grupo.querySelectorAll('.mapa-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onSelect(btn.dataset[attr]);
    });
  });
}

// Uma transformação só, no wrapper: `translate` em pixels de tela e `scale`
// uniforme, com origem no canto (0 0) para a conta de ancoragem fechar.
//
// ⚠️ Isto já usou `container.style.zoom`, e era a causa do "vai esticando": o
// `zoom` do CSS **refaz o layout** em vez de escalar a imagem pronta. Numa
// tabela de células de 20px, cada célula rearredonda para o pixel inteiro mais
// próximo em cada passo do zoom, e a matriz deixa de ser quadrada. `scale` não
// tem esse problema — escala o resultado já desenhado.
let _dsmRasterTimer = null;

function _applyDsmTransform() {
  const panWrap = document.getElementById('dsm-pan-wrap');
  if (!panWrap) return;
  panWrap.style.transformOrigin = '0 0';
  panWrap.style.transform =
    `translate(${_dsmPanX}px, ${_dsmPanY}px) scale(${_dsmZoom})`;

  // `will-change` so DURANTE o gesto. Deixado permanente, o motor mantem a
  // camada com o raster da escala antiga e a matriz fica borrada depois do
  // zoom. A Matriz nao tem evento de fim de gesto, entao o fim e um silencio
  // de 200ms.
  panWrap.style.willChange = 'transform';
  clearTimeout(_dsmRasterTimer);
  _dsmRasterTimer = setTimeout(() => { panWrap.style.willChange = 'auto'; }, 200);
}

// Zoom ancorado num ponto da tela: o pixel sob o cursor continua sob o cursor.
//
// Sem isto o zoom sempre partia do canto superior esquerdo, e ampliar o meio da
// matriz jogava o que interessava para fora da tela — era preciso ampliar e
// depois caçar o ponto arrastando.
function _dsmAplicarZoom(novoZoom, ancoraX, ancoraY) {
  const zoom = Math.min(3, Math.max(0.3, +novoZoom.toFixed(2)));
  // Onde o ponto da âncora cai no espaço do conteúdo, ANTES de mudar a escala.
  const conteudoX = (ancoraX - _dsmPanX) / _dsmZoom;
  const conteudoY = (ancoraY - _dsmPanY) / _dsmZoom;
  _dsmZoom = zoom;
  // Reposiciona o pan para que esse mesmo ponto volte a cair sob a âncora.
  _dsmPanX = ancoraX - conteudoX * zoom;
  _dsmPanY = ancoraY - conteudoY * zoom;

  const slider = document.getElementById('ctrl-dsm-zoom');
  if (slider) {
    slider.value = _dsmZoom;
    document.getElementById('ctrl-dsm-zoom-val').textContent = _dsmZoom.toFixed(2) + '×';
  }
  _applyDsmTransform();
}

// Centro da área visível — a âncora de quem não tem cursor (o slider).
function _dsmCentro() {
  const outer = document.getElementById('dsm-outer');
  if (!outer) return { x: 0, y: 0 };
  return { x: outer.clientWidth / 2, y: outer.clientHeight / 2 };
}

function _initDsmPan() {
  const outer = document.getElementById('dsm-outer');
  if (!outer) return;
  let dragging = false, startX = 0, startY = 0, startPanX = 0, startPanY = 0;

  outer.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (e.target.classList.contains('dsm-cell--dep')) return;
    if (e.target.closest('.dsm-row-header') || e.target.closest('.dsm-col-header')) return;
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    startPanX = _dsmPanX; startPanY = _dsmPanY;
    outer.style.cursor = 'grabbing';
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    // O `translate` vem ANTES do `scale` na transformação, então ele age no
    // espaço da tela: o delta do mouse entra em pixels, sem dividir pelo zoom.
    _dsmPanX = startPanX + (e.clientX - startX);
    _dsmPanY = startPanY + (e.clientY - startY);
    _applyDsmTransform();
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    outer.style.cursor = 'grab';
  });

  outer.addEventListener('wheel', e => {
    e.preventDefault();
    // Passo multiplicativo, não aditivo: somar 0,1 é um salto de 33% quando o
    // zoom está em 0,3 e de 3% quando está em 3. Multiplicar dá o mesmo passo
    // percebido em qualquer nível.
    const fator = e.deltaY > 0 ? 1 / 1.12 : 1.12;
    // A âncora é o cursor, em coordenadas do container.
    const caixa = outer.getBoundingClientRect();
    _dsmAplicarZoom(_dsmZoom * fator, e.clientX - caixa.left, e.clientY - caixa.top);
  }, { passive: false });

  outer.style.cursor = 'grab';
  outer.style.overflow = 'hidden';
}
