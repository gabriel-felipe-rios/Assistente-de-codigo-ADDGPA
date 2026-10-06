// ── Índice de Símbolos ────────────────────────────────────────────────────────
let _siAllSymbols   = [];
let _siFilter       = '';
let _siSearchQuery  = '';
let _siSelectedSym  = null;

const SI_ICONS = { class: '🟦', function: '⚡', method: '🔧', interface: '📋', struct: '🧱', impl: '⚙️', enum: '🔢', type: '🏷️' };

async function loadSymbolIndex() {
  const folders     = workspaceConfig.working_folders || [];
  const placeholder = document.getElementById('si-placeholder');
  const content     = document.getElementById('si-content');
  if (folders.length === 0) {
    placeholder.classList.remove('hidden');
    content.classList.add('hidden');
    return;
  }
  placeholder.classList.add('hidden');
  content.classList.remove('hidden');

  const r = await window.pywebview.api.get_symbol_index(currentProject);
  if (!r.success || !r.index) {
    siSetStatus('Índice não construído. Clique em ⚡ Indexar.');
    siRender([]);
    return;
  }
  const idx = r.index;
  _siAllSymbols = idx.symbols || [];
  const d = new Date(idx.built_at);
  const ts = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  siSetStatus(`${_siAllSymbols.length} símbolos · ${idx.total_files} arquivos · ${ts}`);
  siApplyFilters();
}

async function siBuildIndex() {
  const btn = document.getElementById('btn-build-index');
  btn.disabled = true; btn.textContent = '⏳ Indexando...';
  siSetStatus('Construindo índice...');
  siRender([]);
  siResetDetail();

  const r = await window.pywebview.api.build_symbol_index(currentProject);
  btn.disabled = false; btn.textContent = '⚡ Indexar';

  if (!r.success) {
    siSetStatus(`Erro: ${r.error || 'desconhecido'}`);
    return;
  }
  siSetStatus(`${r.total_symbols} símbolos · ${r.total_files} arquivos`);
  const r2 = await window.pywebview.api.get_symbol_index(currentProject);
  if (r2.success && r2.index) {
    _siAllSymbols = r2.index.symbols || [];
  }
  siApplyFilters();
}

function siSetStatus(msg) {
  document.getElementById('si-status').textContent = msg;
}

function siSetFilter(type) {
  _siFilter = type;
  document.querySelectorAll('.si-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sifilter === type);
  });
  siApplyFilters();
}

function siSearch(query) {
  _siSearchQuery = query.toLowerCase();
  siApplyFilters();
}

function siApplyFilters() {
  let syms = _siAllSymbols;
  if (_siFilter) syms = syms.filter(s => s.type === _siFilter);
  if (_siSearchQuery) syms = syms.filter(s => s.name.toLowerCase().includes(_siSearchQuery));
  siRender(syms);
}

function siRender(symbols) {
  const list = document.getElementById('si-symbol-list');
  list.innerHTML = '';
  if (symbols.length === 0) {
    list.innerHTML = '<div class="tree-loading">Nenhum símbolo encontrado.</div>';
    return;
  }
  for (const sym of symbols) {
    const row = document.createElement('div');
    row.className = 'si-sym-row';

    const icon = document.createElement('span');
    icon.className = 'ts-sym-icon';
    icon.textContent = SI_ICONS[sym.type] || '•';

    const name = document.createElement('span');
    name.className = 'ts-sym-name';
    name.textContent = sym.name;

    const file = document.createElement('span');
    file.className = 'si-sym-file';
    file.textContent = sym.relative.split(/[/\\]/).pop() + ':' + sym.line;
    file.title = sym.file;

    row.appendChild(icon); row.appendChild(name); row.appendChild(file);
    row.addEventListener('click', () => siSelectSymbol(sym, row));
    list.appendChild(row);
  }
}

async function siSelectSymbol(sym, el) {
  _siSelectedSym = sym;
  document.querySelectorAll('.si-sym-row').forEach(r => r.classList.remove('active'));
  el.classList.add('active');

  document.getElementById('si-detail-empty').classList.add('hidden');
  document.getElementById('si-detail-content').classList.remove('hidden');

  // Definição
  const info = document.getElementById('si-def-info');
  info.innerHTML =
    `<span class="ts-sym-icon">${SI_ICONS[sym.type] || '•'}</span>` +
    `<strong>${escapeHtml(sym.name)}</strong>` +
    `<span class="ts-lang-badge">${escapeHtml(sym.language)}</span>` +
    `<span class="si-def-path">${escapeHtml(sym.relative)} <span class="ts-line-num">:${sym.line}</span></span>`;

  const defCode = document.getElementById('si-def-code');
  defCode.innerHTML = '<div class="tree-loading">Carregando...</div>';

  const cr = await window.pywebview.api.get_file_lines(sym.file, sym.line, 4);
  defCode.innerHTML = '';
  if (cr.success) {
    for (const line of cr.lines) {
      const row = document.createElement('div');
      row.className = 'ts-code-line' + (line.highlight ? ' highlight' : '');
      const num = document.createElement('span'); num.className = 'ts-code-linenum'; num.textContent = line.n;
      const txt = document.createElement('span'); txt.className = 'ts-code-text';    txt.textContent = line.text;
      row.appendChild(num); row.appendChild(txt);
      defCode.appendChild(row);
    }
  }

  // Usos
  document.getElementById('si-usage-loading').classList.remove('hidden');
  document.getElementById('si-usage-list').innerHTML = '';
  document.getElementById('si-usage-count').textContent = '';

  const ur = await window.pywebview.api.find_symbol_usages(currentProject, sym.name);
  document.getElementById('si-usage-loading').classList.add('hidden');

  if (!ur.success) return;
  const usages = ur.usages || [];
  document.getElementById('si-usage-count').textContent = usages.length;

  const usageList = document.getElementById('si-usage-list');
  if (usages.length === 0) {
    usageList.innerHTML = '<div class="tree-loading">Nenhum uso encontrado.</div>';
    return;
  }
  for (const u of usages) {
    const row = document.createElement('div');
    row.className = 'si-usage-item';

    const loc = document.createElement('span');
    loc.className = 'si-usage-loc';
    loc.textContent = u.relative.split(/[/\\]/).pop() + ':' + u.line;
    loc.title = u.file;

    const snip = document.createElement('span');
    snip.className = 'si-usage-snip';
    snip.textContent = u.snippet;

    row.appendChild(loc); row.appendChild(snip);
    row.addEventListener('click', async () => {
      document.querySelectorAll('.si-usage-item').forEach(r => r.classList.remove('active'));
      row.classList.add('active');
      const defCode = document.getElementById('si-def-code');
      defCode.innerHTML = '<div class="tree-loading">Carregando...</div>';
      const lr = await window.pywebview.api.get_file_lines(u.file, u.line, 4);
      defCode.innerHTML = '';
      if (lr.success) {
        for (const line of lr.lines) {
          const r2 = document.createElement('div');
          r2.className = 'ts-code-line' + (line.highlight ? ' highlight' : '');
          const num = document.createElement('span'); num.className = 'ts-code-linenum'; num.textContent = line.n;
          const txt = document.createElement('span'); txt.className = 'ts-code-text';    txt.textContent = line.text;
          r2.appendChild(num); r2.appendChild(txt);
          defCode.appendChild(r2);
        }
      }
    });
    usageList.appendChild(row);
  }
}

function siResetDetail() {
  _siSelectedSym = null;
  document.getElementById('si-detail-empty').classList.remove('hidden');
  document.getElementById('si-detail-content').classList.add('hidden');
}
