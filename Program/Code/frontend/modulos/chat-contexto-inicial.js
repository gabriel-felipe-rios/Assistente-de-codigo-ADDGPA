// ── Barra de uso da janela de contexto (aba Contexto) ────────────────────────
let _contextWindowLimit = null;

// Tokens contados pelo tiktoken no backend, nunca por `caracteres / 4`.
// Esta barra decide visualmente se o contexto cabe na janela do modelo, e uma
// divisão por 4 errava para menos justamente em código.
async function updateContextUsage(items, geracao) {
  const fill = document.getElementById('context-usage-fill');
  const text = document.getElementById('context-usage-text');
  if (!fill || !text) return;
  // ⚠️ Guarda de corrida, a MESMA de `updateContextPreview` — e as duas
  // precisam dela: consertar só uma deixa metade do defeito de pé, porque as
  // duas terminam escrevendo nesta mesma barra. A contagem é uma ida ao
  // backend, e trocar de chat no meio dela fazia o número do chat anterior
  // chegar atrasado e sobrescrever o do chat aberto.
  //
  // ⚠️ E a GERAÇÃO, que vem de quem chamou. Duas pinturas do MESMO chat também
  // se atropelam — é o que acontece a cada `openChat`, e a guarda de chat não
  // vê. Quem passa o número é `updatePayloadView`, e o bloco que explica o
  // mecanismo está no topo de `chat-payload.js`. Sem `geracao` (chamada antiga,
  // de fora daquele caminho) só a guarda de chat vale, como antes.
  const chatDaContagem = currentChatId;
  const textos = (items || []).map(it => it.content || '');
  const r = await window.pywebview.api.contar_tokens_textos(textos);
  if (currentChatId !== chatDaContagem) return;
  if (geracao !== undefined && geracao !== chatCtxGeracaoAtual()) return;
  const tokens = (r && r.success) ? r.tokens : 0;
  const fmt = n => n.toLocaleString('pt-BR');
  if (_contextWindowLimit) {
    const pct = Math.min(100, (tokens / _contextWindowLimit) * 100);
    fill.style.width = pct + '%';
    fill.className = 'context-usage-fill ' + (pct < 60 ? 'ok' : pct < 85 ? 'warn' : 'full');
    text.textContent = `${fmt(tokens)} / ${fmt(_contextWindowLimit)} tokens`;
  } else {
    fill.style.width = '0%';
    fill.className = 'context-usage-fill';
    text.textContent = `${fmt(tokens)} tokens`;
  }
}

// ── Estatísticas do painel "Contexto inicial" ────────────────────────────────
async function updateContextTokenBadges() {
  if (!currentProject) return;
  const agents = [
    { id: 'pipeline',              checkEl: 'ctx-pipeline' },
    { id: 'indice-navegacao',      checkEl: 'ctx-indice-navegacao' },
    { id: 'resumo-pastas',         checkEl: 'ctx-resumo-pastas' },
    { id: 'documentacao-tecnica',  checkEl: 'ctx-documentacao-tecnica' },
    { id: 'grafo-imports',         checkEl: 'ctx-grafo-imports' },
    { id: 'regras',                checkEl: 'ctx-regras' },
  ];
  const counts = {};
  await Promise.all(agents.map(async a => {
    let stats = { tokens: 0, lines: 0, files: 0 };
    const r = a.id === 'regras'
      ? await window.pywebview.api.get_regras_stats(currentProject)
      : await window.pywebview.api.get_agent_stats(currentProject, a.id);
    if (r && r.success) stats = r;
    counts[a.id] = stats.tokens || 0;
    const fmt = n => (n || 0) > 0 ? n.toLocaleString('pt-BR') : '—';
    const set = (suffix, value) => {
      const el = document.getElementById(`${a.checkEl}-${suffix}`);
      if (el) el.textContent = value;
    };
    set('tokens',   fmt(stats.tokens));
    set('linhas',   fmt(stats.lines));
    set('arquivos', fmt(stats.files));
  }));
  _updateContextTokenTotal(agents, counts);
  agents.forEach(a => {
    const cb = document.getElementById(a.checkEl);
    if (cb && !cb._totalWired) {
      cb._totalWired = true;
      cb.addEventListener('change', () => _updateContextTokenTotal(agents, counts), { passive: true });
    }
  });
}

function _updateContextTokenTotal(agents, counts) {
  const total = agents.reduce((sum, a) => {
    const cb = document.getElementById(a.checkEl);
    return sum + (cb && cb.checked ? (counts[a.id] || 0) : 0);
  }, 0);
  const el = document.getElementById('ctx-tokens-total');
  if (!el) return;
  el.textContent = total > 0 ? `Contexto inicial: ${total.toLocaleString('pt-BR')} tokens` : '—';
}

// ── Painel dropdown "Contexto inicial" ───────────────────────────────────────
function _initCtxInicialPanel() {
  const btn = document.getElementById('btn-ctx-inicial');
  const panel = document.getElementById('ctx-inicial-panel');
  if (!btn || !panel || btn._wired) return;
  btn._wired = true;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!panel.classList.contains('hidden') && !panel.contains(e.target) && e.target !== btn) {
      panel.classList.add('hidden');
    }
  });
}
