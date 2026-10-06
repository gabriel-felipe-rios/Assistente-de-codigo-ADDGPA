// ═══════════════════════════════════════ MAPAS: Ligações ══
// A sub-aba que responde "quem chama quem", navegável. Dois modos, Pastas (com
// barra de busca) e Impacto (que abre com os hubs escondidos) — os outros cinco
// saíram da tela em 2026-09 (D62). Os layouts estão em mapas-ligacoes-modos.js
// e o desenho em mapas-ligacoes-desenho.js; aqui ficam os dados, os filtros e
// os controles.
//
// Três regras que valem para os modos:
//  1. Nada de força-dirigido — posição sempre sai de regra (ver o topo do
//     arquivo de modos).
//  2. Nenhuma chamada ao modelo. Mapas é só o que o programa monta sozinho.
//  3. Todo corte aparece na tela: faixa de aviso dizendo o que sumiu, e o
//     `.mapa-stat` sempre em "X de Y" — nunca só o X.
//
// Usa currentProject e _langColor, de mapas.js.

let _ligDados      = null;     // {nos: Map(id → {…}), arestas: [{origem,destino,via,peso}]}
let _ligFonte      = 'identificadores';
let _ligModo       = 'pastas';   // 'pastas' | 'impacto' — os dois que ficaram (D62)
let _ligFoco       = '';
let _ligBusca      = '';         // o texto da barra de busca da vista Pastas
let _ligPastaAberta = '';
let _ligProf       = 2;
let _ligPesoMin    = 1;
let _ligHubTeto    = 0;        // 0 = desligado
let _ligZoomFn     = null;
let _ligTransform  = null;   // sobrevive ao re-render
let _ligCaixaAtual = null;   // a caixa real do desenho INTEIRO
let _ligReenquadrar = false; // pedido explicito de reenquadramento
let _ligWrap       = null;   // o <div> que recebe a CSS transform
let _ligVista      = null;   // a transform com que o SVG atual foi pintado
let _ligJanelaAtual = null;  // a janela (em coordenadas do desenho) que foi pintada
let _ligLayoutAtual = null;  // para repintar ao fim do gesto sem refazer o layout
let _ligAjustando  = false;  // set programatico do zoom: nao repintar
let _ligRepintarTimer = null; // repintar do fim do gesto, adiado (ver o desenho)
let _ligRepintarRaf = null;  // repintar do meio do gesto, coalescido por quadro
let _ligPedido     = null;   // rAF pendente, para coalescer os sliders

// Fonte padrão: o Índice de Identificadores. Trocar a fonte troca o SIGNIFICADO
// da aresta (nome usado × import declarado × chamada de função), e por isso o
// seletor fica visível no painel — não é configuração escondida.
const LIG_FONTES = {
  identificadores: { api: 'get_ligacoes',      rotulo: 'nome usado que o outro define' },
  imports:         { api: 'analyze_imports',   rotulo: 'import declarado' },
  chamadas:        { api: 'build_call_graph',  rotulo: 'chamada de função' },
};

// ── Dados ────────────────────────────────────────────────────────────────────

async function _ligBuscar() {
  if (_ligDados) return _ligDados;
  const fonte = LIG_FONTES[_ligFonte];
  const r = await window.pywebview.api[fonte.api](currentProject);
  if (!r || !r.success) throw new Error((r && r.error) || 'Falha ao carregar as ligações.');

  let nos = new Map(), arestas = [];
  if (_ligFonte === 'identificadores') {
    (r.nos || []).forEach(n => nos.set(n.arquivo, n));
    arestas = (r.arestas || []).map(a => ({
      origem: a.origem, destino: a.destino, via: a.via || [], peso: a.peso || 1,
    }));
  } else {
    (r.nodes || []).forEach(n => nos.set(n.id, { arquivo: n.id, linguagem: n.language || '' }));
    // Imports e call graph dão uma linha por motivo; o peso da tela é quantos
    // motivos distintos sustentam o par, então o par vira uma aresta só.
    const porPar = new Map();
    (r.edges || []).forEach(e => {
      const chave = e.source + '|' + e.target;
      if (!porPar.has(chave)) porPar.set(chave, { origem: e.source, destino: e.target, via: [] });
      const via = porPar.get(chave).via;
      if (e.label && !via.includes(e.label)) via.push(e.label);
    });
    arestas = [...porPar.values()].map(a => ({ ...a, peso: Math.max(1, a.via.length) }));
  }

  // Nó que só aparece como ponta de aresta ainda é nó.
  arestas.forEach(a => {
    [a.origem, a.destino].forEach(id => {
      if (!nos.has(id)) nos.set(id, { arquivo: id, linguagem: '' });
    });
  });

  _ligDados = { nos, arestas };
  return _ligDados;
}

function _ligBasename(id) {
  return id.includes('/') ? id.slice(id.lastIndexOf('/') + 1) : id;
}

// Faixa do layout Arquitetura. Vai pela extensão porque é o único sinal que
// existe nas três fontes — nem todas trazem `language`. A Arquitetura saiu da
// tela das Ligações, mas o Mapa da mudança (Backups) ainda a desenha: fica.
function _ligNatureza(id) {
  const ext = (id.split('.').pop() || '').toLowerCase();
  if (['html', 'htm', 'css', 'scss'].includes(ext)) return 'markup';
  if (['js', 'jsx', 'ts', 'tsx', 'mts', 'cts', 'mjs'].includes(ext)) return 'frontend';
  if (['py', 'pyw'].includes(ext)) return 'backend';
  return 'outro';
}

// Vizinhos do grafo JÁ FILTRADO — memoizados por render, porque os layouts
// perguntam isso em laço e recalcular por nó vira O(n²) a cada arrasto.
function _ligVizinhos(g, id) {
  if (!g._viz) {
    g._viz = new Map();
    const pega = k => {
      if (!g._viz.has(k)) g._viz.set(k, { usa: [], usadoPor: [] });
      return g._viz.get(k);
    };
    g.arestas.forEach(a => { pega(a.origem).usa.push(a.destino); pega(a.destino).usadoPor.push(a.origem); });
  }
  return g._viz.get(id) || { usa: [], usadoPor: [] };
}

// ── Filtros anti-macarrão ────────────────────────────────────────────────────
// Grau e hub são calculados AQUI, sobre o resultado já filtrado por peso, e não
// no backend: senão cada pixel de arrasto do slider viraria uma ida e volta.
function _ligFiltrar() {
  const todas = _ligDados.arestas;
  const porPeso = todas.filter(a => a.peso >= _ligPesoMin);

  const grau = new Map();
  porPeso.forEach(a => {
    grau.set(a.origem, (grau.get(a.origem) || 0) + 1);
    grau.set(a.destino, (grau.get(a.destino) || 0) + 1);
  });

  let hubs = [];
  if (_ligHubTeto > 0) {
    // O foco do Impacto nunca é escondido: ele é o assunto da tela. Com os hubs
    // escondidos ao abrir, um foco muito ligado sumia e a tela pedia "escolha
    // um arquivo".
    const protegido = _ligModo === 'impacto' ? _ligFoco : '';
    hubs = [...grau.entries()].filter(([k, v]) => v > _ligHubTeto && k !== protegido)
      .sort((x, y) => y[1] - x[1]).map(([k]) => k);
  }
  const hubSet = new Set(hubs);
  const arestas = porPeso.filter(a => !hubSet.has(a.origem) && !hubSet.has(a.destino));

  const nosVisiveis = new Set();
  arestas.forEach(a => { nosVisiveis.add(a.origem); nosVisiveis.add(a.destino); });
  const nos = new Map();
  nosVisiveis.forEach(id => nos.set(id, _ligDados.nos.get(id) || { arquivo: id }));

  return {
    nos, arestas, grau, hubs,
    cortePeso: todas.length - porPeso.length,
    totalArestas: todas.length,
    totalNos: _ligDados.nos.size,
  };
}

// ── Render ───────────────────────────────────────────────────────────────────

// Abrir a sub-aba JA ANALISA. Antes ela esperava o botão, para não cobrar a
// varredura de quem só estava passando — e o resultado era clicar em Analisar
// toda vez que se voltava aqui ("tá meio errado isso aí", 26/09/2026). O dado
// fica em `_ligDados` até trocar de projeto ou de fonte, então só a primeira
// abertura vai ao backend; o botão ↻ Reanalisar força uma leitura nova.
function _ligAbrir() {
  renderLigacoes();
}

async function renderLigacoes() {
  const container = document.getElementById('ligacoes-container');
  if (!container) return;
  container.innerHTML = '<div class="mapa-loading">Analisando…</div>';
  _ligAvisar([]);

  try {
    await _ligBuscar();
  } catch (err) {
    container.innerHTML = `<div class="mapa-placeholder">${err.message}</div>`;
    document.getElementById('ligacoes-controls').style.display = 'none';
    return;
  }

  _ligMontarSelects();
  document.getElementById('ligacoes-controls').style.display = '';
  _ligAtualizarLinhasDoModo();

  const g = _ligFiltrar();
  const termo = _ligBusca.trim();
  let layout;
  if (_ligModo === 'impacto') {
    layout = _ligLayoutImpacto(g, _ligFoco, _ligProf);
  } else if (termo) {
    // A busca deixa no grafo só os arquivos achados e abre todas as pastas
    // deles — a própria vista Pastas é o resultado, como na aba Análise.
    const achados = _ligCasaBusca(g, termo);
    const nos = new Map([...g.nos].filter(([id]) => achados.has(id)));
    const arestas = g.arestas.filter(a => achados.has(a.origem) && achados.has(a.destino));
    layout = nos.size
      ? _ligLayoutPastas({ ...g, nos, arestas, _viz: null }, '', true)
      : { nos: [], arestas: [], w: 0, h: 0,
          msg: `Nenhum arquivo com <strong>${escapeHtml(termo)}</strong> no caminho ` +
               'nem num nome que ele define.' };
    if (nos.size) layout.rodape = `busca: ${nos.size} arquivo(s)`;
  } else {
    layout = _ligLayoutPastas(g, _ligPastaAberta);
  }

  container.innerHTML = '';
  if (layout.msg) {
    container.innerHTML = `<div class="mapa-placeholder">${layout.msg}</div>`;
  } else {
    _ligDesenhar(container, layout);
  }
  _ligContar(layout, g);
  _ligAvisar(_ligMotivosDeCorte(g));
  document.getElementById('ligacoes-caminho').textContent = _ligFoco || '';
}

// "X de Y", sempre — mostrar só o X é a mesma mentira que esconder sem avisar.
function _ligContar(layout, g) {
  const nosDesenhados = new Set(layout.nos.map(n => n.id)).size;
  const partes = [
    `${nosDesenhados} de ${g.totalNos} arquivos`,
    `${layout.arestas.length} de ${g.totalArestas} ligações`,
  ];
  if (layout.rodape) partes.push(layout.rodape);
  document.getElementById('ligacoes-stat').textContent = partes.join(' · ');
}

function _ligMotivosDeCorte(g) {
  const motivos = [];
  if (g.hubs.length) {
    const lista = g.hubs.slice(0, 3).map(_ligBasename).join(', ');
    const resto = g.hubs.length > 3 ? ` e mais ${g.hubs.length - 3}` : '';
    motivos.push(`${g.hubs.length} hub(s) oculto(s): ${lista}${resto}`);
  }
  if (g.cortePeso) motivos.push(`${g.cortePeso} ligação(ões) abaixo do peso mínimo ${_ligPesoMin}`);
  if (_ligModo === 'pastas' && _ligBusca.trim()) {
    motivos.push(`busca «${_ligBusca.trim()}»: só as pastas com arquivo achado`);
  }
  return motivos;
}

function _ligAvisar(motivos) {
  const faixa = document.getElementById('ligacoes-aviso');
  if (!faixa) return;
  faixa.style.display = motivos.length ? '' : 'none';
  faixa.textContent = motivos.join(' · ');
}

// Um render por quadro, no maximo. `input` de slider dispara dezenas de vezes
// por segundo, e cada render reconstroi milhares de elementos: sem coalescer,
// arrastar o slider engasgava a interface inteira.
function _ligPedirRender() {
  if (_ligPedido) return;
  _ligPedido = requestAnimationFrame(() => { _ligPedido = null; renderLigacoes(); });
}

// Clicar num arquivo SEMPRE leva ao Impacto dele — não há seletor de "o que o
// clique faz", porque um clique que às vezes navega e às vezes abre arquivo é
// um clique que ninguém arrisca dar. (Levava ao Foco local, que saiu da tela
// em 2026-09, D62.)
function _ligClicar(no) {
  if (no.pasta) {
    const pasta = no.id.slice(6);
    _ligPastaAberta = _ligPastaAberta === pasta ? '' : pasta;
    renderLigacoes();
    return;
  }
  _ligFoco = no.id;
  if (_ligModo !== 'impacto') _ligTrocarModo('impacto');
  const sel = document.getElementById('ctrl-lig-foco');
  if (sel) sel.value = _ligFoco;
  // Foco novo, desenho novo: enquadra. Guardar o enquadramento antigo aqui era
  // o que fazia o Foco local (960x660) herdar o pan de Arquitetura e sumir.
  _ligReenquadrar = true;
  renderLigacoes();
}

function _ligTrocarModo(modo) {
  const mudou = modo !== _ligModo;
  _ligModo = modo;
  document.querySelectorAll('#ligacoes-modo-toggle .mapa-toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.modo === modo);
  });
  // A busca é da vista Pastas; no Impacto quem escolhe o arquivo é o Foco.
  const busca = document.getElementById('ligacoes-busca');
  if (busca) busca.style.display = modo === 'pastas' ? '' : 'none';
  if (mudou) _ligAplicarHubDoModo();
}

// Cada modo abre no seu "Ocultar hub": o Impacto com os hubs escondidos (D62:
// "tenho que ir diminuindo bastante ali no ocultar hub"), a vista Pastas com o
// controle desligado, como sempre foi. Depois de aberto, o controle é do usuário.
function _ligAplicarHubDoModo() {
  const teto = _ligModo === 'impacto' ? _ligHubPadraoImpacto() : 0;
  _ligHubTeto = teto;
  const el = document.getElementById('ctrl-lig-hub');
  if (el) el.value = teto || 120;
  const val = document.getElementById('ctrl-lig-hub-val');
  if (val) val.textContent = teto ? String(teto) : 'off';
}

// O valor de Configurações › Desempenho dos mapas, no passo do controle (5 em 5,
// de 5 a 115 — 120 é o "desligado").
function _ligHubPadraoImpacto() {
  const v = Number((typeof renderMapas === 'object' && renderMapas &&
                    renderMapas.impacto_hub_max_ligacoes) || 30);
  return Math.min(115, Math.max(5, Math.round(v / 5) * 5));
}

// Os arquivos que casam com a busca da vista Pastas: o caminho contém o texto,
// ou o arquivo DEFINE um nome que contém o texto — ele é o destino de uma
// ligação cujo `via` tem esse nome ("renderPainel" acha mapas-painel.js). Sobre
// o grafo já filtrado: o que um filtro escondeu não volta pela busca, e a faixa
// de aviso diz qual filtro está ligado.
function _ligCasaBusca(g, termo) {
  const t = termo.toLowerCase();
  const achados = new Set();
  g.nos.forEach((_n, id) => { if (id.toLowerCase().includes(t)) achados.add(id); });
  g.arestas.forEach(a => {
    if ((a.via || []).some(v => String(v).toLowerCase().includes(t))) achados.add(a.destino);
  });
  return achados;
}

// ── Controles ────────────────────────────────────────────────────────────────

// Linha de controle que só faz sentido em alguns modos não fica esmaecida: some.
function _ligAtualizarLinhasDoModo() {
  document.querySelectorAll('#ligacoes-controls [data-lig-so]').forEach(row => {
    row.style.display = row.dataset.ligSo.split(' ').includes(_ligModo) ? '' : 'none';
  });
}

function _ligMontarSelects() {
  const ids = [..._ligDados.nos.keys()].sort();
  [['ctrl-lig-foco', () => _ligFoco, v => { _ligFoco = v; }],
  ].forEach(([elId, get, set]) => {
    const sel = document.getElementById(elId);
    if (!sel) return;
    const atual = get();
    if (sel.dataset.preenchido === String(ids.length) && ids.includes(atual)) { sel.value = atual; return; }
    sel.innerHTML = '<option value="">—</option>' +
      ids.map(id => `<option value="${id}">${id}</option>`).join('');
    sel.dataset.preenchido = String(ids.length);
    // Trocar de fonte troca as chaves dos arquivos; casar pelo nome mantém o
    // foco onde estava em vez de jogar o usuário de volta para o começo.
    const remendo = ids.includes(atual) ? atual
      : ids.find(id => _ligBasename(id) === _ligBasename(atual || '')) || '';
    set(remendo);
    sel.value = remendo;
  });
}

function initLigacoes() {
  document.getElementById('btn-analyze-ligacoes')?.addEventListener('click', () => {
    _ligDados = null; _ligTransform = null; renderLigacoes();
  });

  // Trocar de modo muda o desenho inteiro de tamanho — enquadra.
  _wireToggle('ligacoes-modo-toggle', 'modo',
              valor => { _ligTrocarModo(valor); _ligReenquadrar = true; renderLigacoes(); });

  document.getElementById('ctrl-lig-fonte')?.addEventListener('change', ev => {
    _ligFonte = ev.target.value;
    _ligDados = null;                       // fonte nova, dado novo
    _ligReenquadrar = true;
    document.querySelectorAll('#ligacoes-controls select[data-preenchido]')
      .forEach(s => { delete s.dataset.preenchido; });
    renderLigacoes();
  });

  document.getElementById('ctrl-lig-foco')?.addEventListener('change', ev => {
    _ligFoco = ev.target.value; _ligReenquadrar = true; renderLigacoes();
  });

  // A busca da vista Pastas filtra a cada tecla, um desenho por quadro no
  // máximo (`_ligPedirRender`). Antes de o dado chegar ela só guarda o texto.
  const busca = document.getElementById('ligacoes-busca');
  busca?.addEventListener('input', () => {
    _ligBusca = busca.value;
    _ligReenquadrar = true;
    if (_ligDados) _ligPedirRender();
  });

  _ligSlider('ctrl-lig-prof', v => { _ligProf = v; }, v => String(v));
  _ligSlider('ctrl-lig-peso', v => { _ligPesoMin = v; }, v => String(v));
  // O topo do slider de hub é "desligado": o usuário precisa poder ver o grafo
  // inteiro, com macarrão e tudo, e decidir sozinho onde cortar.
  _ligSlider('ctrl-lig-hub', v => { _ligHubTeto = v >= 120 ? 0 : v; }, v => (v >= 120 ? 'off' : String(v)));

  document.getElementById('btn-lig-centralizar')?.addEventListener('click', _ligCentralizar);
}

function _ligSlider(id, set, formatar) {
  const el = document.getElementById(id);
  if (!el) return;
  const val = document.getElementById(id + '-val');
  el.addEventListener('input', () => {
    set(+el.value);
    if (val) val.textContent = formatar(+el.value);
    if (_ligDados) _ligPedirRender();
  });
}
