// ── LSP ──────────────────────────────────────────────────────────────────────
function loadLsp() {
  const folders     = workspaceConfig.working_folders || [];
  const placeholder = document.getElementById('lsp-placeholder');
  const content     = document.getElementById('lsp-content');
  if (folders.length === 0) {
    placeholder.classList.remove('hidden');
    content.classList.add('hidden');
  } else {
    placeholder.classList.add('hidden');
    content.classList.remove('hidden');
  }
}

async function runLsp() {
  const btn = document.getElementById('btn-run-lsp');
  btn.disabled = true; btn.textContent = '⏳ Analisando...';

  const summary = document.getElementById('lsp-summary');
  const list    = document.getElementById('lsp-diag-list');
  summary.classList.add('hidden');
  list.innerHTML = '<div class="tree-loading" style="padding:16px 14px">Analisando arquivos...</div>';
  lspResetDetail();

  const r = await window.pywebview.api.run_diagnostics(currentProject);
  btn.disabled = false; btn.textContent = '▶ Analisar';
  list.innerHTML = '';

  if (!r.success) {
    list.innerHTML = `<div class="tree-error" style="padding:12px 14px">${escapeHtml(r.error)}</div>`;
    return;
  }

  const diags    = r.diagnostics || [];
  const errors   = diags.filter(d => d.severity === 'error').length;
  const warnings = diags.filter(d => d.severity === 'warning').length;

  summary.classList.remove('hidden');
  summary.innerHTML =
    `<span class="lsp-count lsp-count-err">● ${errors} erros</span>` +
    `<span class="lsp-count lsp-count-warn">● ${warnings} avisos</span>` +
    `<span class="lsp-tool">${escapeHtml(r.tool || '?')}</span>`;

  if (diags.length === 0) {
    list.innerHTML = '<div class="tree-loading" style="padding:16px 14px">✅ Nenhum problema encontrado.</div>';
    return;
  }

  diags.forEach(diag => {
    const item = document.createElement('div');
    item.className = 'lsp-diag-item';
    const fname = diag.file.split(/[/\\]/).pop();
    item.innerHTML =
      `<span class="lsp-diag-badge lsp-diag-badge-${diag.severity}">${diag.severity === 'error' ? 'ERRO' : 'AVISO'}</span>` +
      `<div class="lsp-diag-body">` +
        `<div class="lsp-diag-msg">${escapeHtml(diag.message)}</div>` +
        `<div class="lsp-diag-loc">${escapeHtml(fname)} :${diag.line}</div>` +
      `</div>`;
    item.addEventListener('click', () => lspSelectDiag(diag, item));
    list.appendChild(item);
  });
}

function lspResetDetail() {
  document.getElementById('lsp-detail-empty').classList.remove('hidden');
  document.getElementById('lsp-detail-content').classList.add('hidden');
}

async function lspSelectDiag(diag, el) {
  document.querySelectorAll('.lsp-diag-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');

  document.getElementById('lsp-detail-empty').classList.add('hidden');
  const content = document.getElementById('lsp-detail-content');
  content.classList.remove('hidden');

  const badge = document.getElementById('lsp-det-badge');
  badge.textContent = diag.severity === 'error' ? 'ERRO' : 'AVISO';
  badge.className   = `lsp-det-badge lsp-det-badge-${diag.severity}`;

  document.getElementById('lsp-det-msg').textContent  = diag.message;
  document.getElementById('lsp-det-file').textContent = diag.file.split(/[/\\]/).pop() + ' ';
  document.getElementById('lsp-det-line').textContent = `:${diag.line}`;

  const codeEl = document.getElementById('lsp-det-code');
  codeEl.innerHTML = '<div class="tree-loading">Carregando...</div>';

  const r = await window.pywebview.api.get_file_lines(diag.file, diag.line, 4);
  codeEl.innerHTML = '';

  if (!r.success) { codeEl.innerHTML = `<div class="tree-error">${escapeHtml(r.error)}</div>`; return; }

  for (const line of r.lines) {
    const row = document.createElement('div');
    row.className = 'ts-code-line' + (line.highlight ? ' highlight lsp-highlight' : '');
    const num  = document.createElement('span'); num.className  = 'ts-code-linenum'; num.textContent  = line.n;
    const text = document.createElement('span'); text.className = 'ts-code-text';    text.textContent = line.text;
    row.appendChild(num); row.appendChild(text);
    codeEl.appendChild(row);
  }
}
