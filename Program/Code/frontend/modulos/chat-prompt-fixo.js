// ── Trava de contexto: checkboxes ficam desabilitadas após a 1ª mensagem ──────
let _chatHasHistory = false;
const _CTX_CHECKBOX_IDS = ['ctx-pipeline', 'ctx-indice-navegacao', 'ctx-resumo-pastas', 'ctx-documentacao-tecnica', 'ctx-grafo-imports', 'ctx-regras'];

function _lockContextCheckboxes() {
  _chatHasHistory = true;
  _CTX_CHECKBOX_IDS.forEach(id => {
    const cb = document.getElementById(id);
    if (cb) cb.disabled = true;
  });
}

function _unlockContextCheckboxes() {
  _chatHasHistory = false;
  _CTX_CHECKBOX_IDS.forEach(id => {
    const cb = document.getElementById(id);
    if (cb) cb.disabled = false;
  });
}

// ── Botão/painel de prompt fixo ──────────────────────────────────────────────
// Um prompt fixo é um texto pronto que acompanha a mensagem — o equivalente a
// colar o mesmo trecho toda vez. Não é um "modo": não troca o fluxo de envio,
// não desliga subagente, não muda nada além do texto que vai junto.
let _promptFixoSelecionado = '';
const PROMPT_FIXO_ROTULOS = {
  '': 'Nenhum',
  'estruturar': 'Estruturar',
  'estruturar-e-quebrar-tarefa': 'Estruturar e quebrar tarefa',
  'revisar': 'Revisar',
};

function _setPromptFixo(nome) {
  _promptFixoSelecionado = nome || '';
  const btn = document.getElementById('btn-prompt-fixo');
  if (btn) btn.textContent = `${PROMPT_FIXO_ROTULOS[_promptFixoSelecionado] || _promptFixoSelecionado} ▾`;
  document.querySelectorAll('#prompt-fixo-panel .prompt-fixo-option').forEach(opt => {
    opt.classList.toggle('ativo', (opt.dataset.promptFixo || '') === _promptFixoSelecionado);
  });
  if (typeof updateContextPreview === 'function') updateContextPreview();
}

function _initPromptFixoPanel() {
  const btn = document.getElementById('btn-prompt-fixo');
  const panel = document.getElementById('prompt-fixo-panel');
  if (!btn || !panel || btn._wired) return;
  btn._wired = true;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('hidden');
  });
  panel.querySelectorAll('.prompt-fixo-option').forEach(opt => {
    opt.addEventListener('click', () => {
      _setPromptFixo(opt.dataset.promptFixo || '');
      panel.classList.add('hidden');
    });
  });
  document.addEventListener('click', (e) => {
    if (!panel.classList.contains('hidden') && !panel.contains(e.target) && e.target !== btn) {
      panel.classList.add('hidden');
    }
  });
}
