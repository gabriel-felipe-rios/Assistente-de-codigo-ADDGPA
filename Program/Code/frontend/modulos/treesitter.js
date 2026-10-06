// ══════════════════════════════════════════════════════════════ TREE-SITTER ══

const TS_ICONS = {
  class: '🟦', function: '⚡', method: '🔧',
  interface: '📋', struct: '🧱', impl: '⚙️', enum: '🔢', type: '🏷️',
};

let _tsFiles = [];
let _tsSelectedIndex = -1;
let _tsActiveFilter  = '';
let _tsSelectedSym   = null;
let _estruturaAbort  = 0;
// Instância da árvore (arvore-pastas.js) e o mapa chave → índice em _tsFiles.
let _tsArvore        = null;
let _tsPorChave      = {};

async function loadEstrutura() {
  const myToken = ++_estruturaAbort;
  const placeholder = document.getElementById('estrutura-placeholder');
  const content     = document.getElementById('estrutura-content');
  const fileList    = document.getElementById('ts-file-list');

  _tsFiles = [];
  _tsSelectedIndex = -1;

  const folders = workspaceConfig.working_folders || [];
  if (folders.length === 0) {
    placeholder.classList.remove('hidden');
    content.classList.add('hidden');
    return;
  }

  placeholder.classList.add('hidden');
  content.classList.remove('hidden');
  fileList.innerHTML = '<div class="tree-loading">Analisando com Tree-sitter...</div>';
  tsShowEmpty();

  const r = await window.pywebview.api.parse_treesitter(currentProject);
  if (myToken !== _estruturaAbort) return;

  fileList.innerHTML = '';

  if (!r.success) {
    fileList.innerHTML = `<div class="tree-error">Erro: ${escapeHtml(r.error || 'desconhecido')}</div>`;
    return;
  }
  if (r.files.length === 0) {
    fileList.innerHTML = '<div class="tree-loading">Nenhum arquivo de código encontrado.</div>';
    return;
  }

  _tsFiles = r.files;

  // Árvore aninhada de verdade: a chave é `pasta-de-trabalho/caminho/relativo`.
  // Antes esta lista tinha UM nível só — o backend já mandava `relative`, e o
  // frontend jogava fora com `.split().pop()`.
  _tsPorChave = {};
  for (let i = 0; i < _tsFiles.length; i++) {
    _tsPorChave[_tsChave(_tsFiles[i])] = i;
  }

  _tsArvore = criarArvorePastas({
    container: fileList,
    caminhos: Object.keys(_tsPorChave),
    seloArquivo: chave => {
      const f = _tsFiles[_tsPorChave[chave]];
      return f ? f.language : null;
    },
    aoSelecionar: chave => tsSelectFile(_tsPorChave[chave]),
    vazio: 'Nenhum arquivo de código encontrado.',
  });
  ligarBuscaArvore({
    input: 'ts-busca-input', botao: 'btn-ts-busca',
    modos: 'ts-busca-modos', aviso: 'ts-busca-aviso',
    container: 'ts-file-list',
  });
  ligarBotoesArvore(() => _tsArvore, {
    expandir: 'btn-ts-expand-all',
    retrair: 'btn-ts-collapse-all',
    atualizar: 'btn-ts-refresh',
    aoAtualizar: () => loadEstrutura(),
  });
}

// `folder` é o caminho ABSOLUTO da pasta de trabalho configurada — não um nome
// fixo. A árvore aninha DENTRO de cada pasta de trabalho.
function _tsChave(file) {
  const raiz = (file.folder || '').split(/[/\\]/).filter(Boolean).pop() || '';
  const rel = (file.relative || '').replace(/\\/g, '/');
  return raiz ? `${raiz}/${rel}` : rel;
}

function tsSelectFile(idx) {
  _tsSelectedIndex = idx;
  const file = _tsFiles[idx];
  if (!file) return;

  document.getElementById('ts-detail-empty').classList.add('hidden');
  document.getElementById('ts-detail-content').classList.remove('hidden');

  document.getElementById('ts-detail-filename').textContent = _tsChave(file);
  document.getElementById('ts-detail-filename').title = file.path;
  document.getElementById('ts-detail-lang').textContent = file.language;

  tsRenderSymbols(file.symbols);
}

function tsRenderSymbols(symbols) {
  const symbolList = document.getElementById('ts-symbol-list');
  symbolList.innerHTML = '';

  const filtered = _tsActiveFilter ? symbols.filter(s => s.type === _tsActiveFilter) : symbols;

  if (filtered.length === 0) {
    const msg = symbols.length === 0 ? 'Nenhum símbolo encontrado.' : 'Nenhum símbolo deste tipo neste arquivo.';
    symbolList.innerHTML = `<div class="tree-loading">${msg}</div>`;
    return;
  }

  for (const sym of filtered) {
    const row = document.createElement('div');
    row.className = `ts-sym-row ts-sym-${sym.type}`;

    const symIcon = document.createElement('span');
    symIcon.className = 'ts-sym-icon';
    symIcon.textContent = TS_ICONS[sym.type] || '•';

    const symName = document.createElement('span');
    symName.className = 'ts-sym-name';
    symName.textContent = sym.name;

    const symLine = document.createElement('span');
    symLine.className = 'ts-line-num';
    symLine.textContent = `:${sym.line}`;

    row.appendChild(symIcon); row.appendChild(symName); row.appendChild(symLine);
    row.addEventListener('click', () => tsSelectSymbol(sym, row));
    symbolList.appendChild(row);
  }
}

function tsSetFilter(type) {
  _tsActiveFilter = type;
  _tsSelectedSym  = null;
  document.querySelectorAll('.ts-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === type);
  });
  if (_tsSelectedIndex >= 0 && _tsFiles[_tsSelectedIndex]) {
    tsRenderSymbols(_tsFiles[_tsSelectedIndex].symbols);
  }
  tsResetCodePanel();
}

function tsShowEmpty() {
  document.getElementById('ts-detail-empty').classList.remove('hidden');
  document.getElementById('ts-detail-content').classList.add('hidden');
  tsResetCodePanel();
}

function tsResetCodePanel() {
  _tsSelectedSym = null;
  document.getElementById('ts-code-empty').classList.remove('hidden');
  document.getElementById('ts-code-content').classList.add('hidden');
}

function tsSelectSymbol(sym, el) {
  _tsSelectedSym = sym;
  document.querySelectorAll('.ts-sym-row').forEach(r => r.classList.remove('active'));
  el.classList.add('active');
  const file = _tsFiles[_tsSelectedIndex];
  if (file) showTsCode(file.path, sym);
}

async function showTsCode(path, sym) {
  document.getElementById('ts-code-empty').classList.add('hidden');
  const content = document.getElementById('ts-code-content');
  content.classList.remove('hidden');

  document.getElementById('ts-code-sym-name').textContent = `${TS_ICONS[sym.type] || ''} ${sym.name}`;
  document.getElementById('ts-code-location').textContent = `:${sym.line}`;

  const linesEl = document.getElementById('ts-code-lines');
  linesEl.innerHTML = '<div class="tree-loading">Carregando...</div>';

  const r = await window.pywebview.api.get_file_lines(path, sym.line, 6);
  linesEl.innerHTML = '';

  if (!r.success) {
    linesEl.innerHTML = `<div class="tree-error">${escapeHtml(r.error)}</div>`;
    return;
  }

  for (const line of r.lines) {
    const row = document.createElement('div');
    row.className = 'ts-code-line' + (line.highlight ? ' highlight' : '');
    const num = document.createElement('span');
    num.className = 'ts-code-linenum'; num.textContent = line.n;
    const text = document.createElement('span');
    text.className = 'ts-code-text'; text.textContent = line.text;
    row.appendChild(num); row.appendChild(text);
    linesEl.appendChild(row);
  }
}
