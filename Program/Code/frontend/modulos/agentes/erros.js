// ── Automação → Erros ────────────────────────────────────────────────────────
// Duas listas, dois backends:
//   · get_erros_das_rotinas — o que falhou na última geração de cada rotina,
//     lido dos `_resumo.json`. Era o que faltava: o nome da sub-aba prometia
//     isto e ela mostrava só a lista de baixo.
//   · get_arquivos_grandes — o que não cabe no orçamento de contexto.

let _errosBound = false;

function initErrosTab() {
  if (!_errosBound) {
    _errosBound = true;
    const btn = document.getElementById('btn-run-erros');
    if (btn) btn.addEventListener('click', runErros);
  }
  runErros();
}

async function runErros() {
  const btn = document.getElementById('btn-run-erros');
  if (!document.getElementById('erros-list')) return;

  if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
  try {
    // Em paralelo: a varredura de tamanho lê todos os arquivos do projeto e é a
    // parte lenta; não faz sentido a lista de falhas, que lê treze JSONs
    // pequenos, esperar por ela.
    await Promise.all([_errosRotinasCarregar(), _errosGrandesCarregar()]);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '↻ Verificar'; }
  }
}

// ── 1. O que falhou ─────────────────────────────────────────────────────────

async function _errosRotinasCarregar() {
  const alvo = document.getElementById('erros-rotinas');
  if (!alvo) return;
  try {
    const r = await window.pywebview.api.get_erros_das_rotinas(currentProject);
    if (!r || !r.success) {
      alvo.innerHTML = `<div class="tree-error" style="padding:12px 14px">${escapeHtml((r && r.error) || 'Falha ao ler os erros.')}</div>`;
      return;
    }
    _errosRotinasRender(r);
  } catch (e) {
    alvo.innerHTML = `<div class="tree-error" style="padding:12px 14px">${escapeHtml(String(e))}</div>`;
  }
}

function _errosRotinasRender(r) {
  const alvo = document.getElementById('erros-rotinas');
  const erros = r.erros || [];

  if (!erros.length) {
    alvo.innerHTML = '<p class="agente-viewer-empty">✓ Nenhuma rotina reportou erro na última geração.</p>';
    return;
  }

  // Um bloco por rotina, para "quem falhou" ser a primeira coisa que se lê. A
  // lista em si usa o mesmo renderizador dos cards (`renderAgenteIssueList`),
  // que já sabe abrir o arquivo no editor.
  const porRotina = r.por_rotina || [];
  alvo.innerHTML = porRotina.map(g => `
    <div class="erros-grupo">
      <div class="erros-grupo-cabecalho">
        <span class="erros-grupo-nome">${escapeHtml(g.rotina)}</span>
        <span class="erros-grupo-conta">${g.quantos} erro${g.quantos !== 1 ? 's' : ''}</span>
      </div>
      <div class="agente-issue-list" id="erros-grupo-${escapeHtml(g.rotina_id)}"></div>
    </div>`).join('');

  porRotina.forEach(g => {
    renderAgenteIssueList(
      `erros-grupo-${g.rotina_id}`,
      erros.filter(e => e.rotina_id === g.rotina_id),
      'sem erros');
  });
}

// ── 2. O que não cabe ───────────────────────────────────────────────────────

async function _errosGrandesCarregar() {
  const status = document.getElementById('erros-status');
  const list = document.getElementById('erros-list');
  if (!list) return;

  list.innerHTML = '<p class="agente-viewer-empty">Medindo os arquivos...</p>';
  status.textContent = '';
  try {
    const r = await window.pywebview.api.get_arquivos_grandes(currentProject);
    if (!r.success) {
      list.innerHTML = `<div class="tree-error" style="padding:12px 14px">${escapeHtml(r.error || 'Falha ao verificar.')}</div>`;
      return;
    }
    errosRender(r);
  } catch (e) {
    list.innerHTML = `<div class="tree-error" style="padding:12px 14px">${escapeHtml(String(e))}</div>`;
  }
}

function errosRender(r) {
  const status = document.getElementById('erros-status');
  const list   = document.getElementById('erros-list');
  const arquivos = r.arquivos || [];

  const limite = (r.limite || 0).toLocaleString('pt-BR');
  status.textContent = `Limite por chamada: ~${limite} tokens${r.exata ? '' : ' (estimado)'} · ${arquivos.length} arquivo(s) acima`;

  if (arquivos.length === 0) {
    list.innerHTML = '<p class="agente-viewer-empty">✓ Nenhum arquivo grande demais. Tudo cabe no orçamento.</p>';
    return;
  }

  list.innerHTML = arquivos.map(a => {
    const tokens = (a.tokens || 0).toLocaleString('pt-BR');
    return `
      <div class="erros-item">
        <span class="erros-ic">⚠</span>
        <div class="erros-body">
          <div class="erros-nome"><code>${escapeHtml(a.file || a.nome)}</code></div>
          <div class="erros-meta">${(a.linhas || 0).toLocaleString('pt-BR')} linhas · ${tokens} tokens — excede o orçamento. Considere refatorar.</div>
        </div>
      </div>`;
  }).join('');
}
