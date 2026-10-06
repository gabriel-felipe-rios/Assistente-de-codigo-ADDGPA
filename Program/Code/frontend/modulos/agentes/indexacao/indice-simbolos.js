// ═══════════════════════════════════════════════ ROTINA: ÍNDICE DE SÍMBOLOS ══
// O card da rotina que mantém `Análise/Índice de Símbolos.json` em dia. O ▶
// faz a varredura completa; o ciclo (T1) refaz só os arquivos que mudaram.
// Backend: `agentes/indexacao/indice_simbolos.py`.

let _indiceSimbolosRunning = false;

async function initIndiceSimbolosCard() {
  _initSimpleAgentCard('indice-simbolos', _indiceSimbolosRunning);

  const btn = document.getElementById('btn-run-indice-simbolos');
  if (btn && !btn._wired) {
    btn._wired = true;
    btn.addEventListener('click', runIndiceSimbolosAgent);
  }

  const r = await window.pywebview.api.get_indice_simbolos_status(currentProject);
  if (r.success && r.existe && !r.error) {
    _setSimpleAgentBadge('indice-simbolos', 'done');
    document.getElementById('indice-simbolos-result-area').classList.remove('hidden');
    document.getElementById('indice-simbolos-result-summary').innerHTML = _indiceSimbolosResumoHtml(r);
  } else if (r.success && r.error) {
    _setSimpleAgentBadge('indice-simbolos', 'error');
    document.getElementById('indice-simbolos-result-area').classList.remove('hidden');
    document.getElementById('indice-simbolos-result-summary').textContent = 'Erro: ' + r.error;
  } else {
    _setSimpleAgentBadge('indice-simbolos', 'idle');
    document.getElementById('indice-simbolos-result-area').classList.add('hidden');
  }
}

function _indiceSimbolosResumoHtml(d) {
  const total = d.total_simbolos || 0;
  const modo = d.modo === 'incremental'
    ? ` · ${d.refeitos || 0} arquivo${d.refeitos === 1 ? '' : 's'} refeito${d.refeitos === 1 ? '' : 's'}`
    : '';
  return `<span class="agente-stat agente-stat-ok">✓ ${total.toLocaleString('pt-BR')} símbolo${total !== 1 ? 's' : ''}${modo}</span>`;
}

async function runIndiceSimbolosAgent() {
  if (_indiceSimbolosRunning) return;
  // A trava de cinco pontas ANTES de ligar a flag: uma recusa não deixa a
  // tela em "rodando" que ninguém desfaz (mesmo molde de Comentários).
  if (!await rotinaCliqueLiberado('indice-simbolos')) return;
  _indiceSimbolosRunning = true;
  _setSimpleAgentBadge('indice-simbolos', 'running');
  document.getElementById('btn-run-indice-simbolos').disabled = true;
  document.getElementById('indice-simbolos-result-area').classList.add('hidden');
  document.getElementById('indice-simbolos-progress-area').classList.remove('hidden');
  const _r = await window.pywebview.api.rodar_indice_simbolos_pelo_card(currentProject);
  if (rotinaCardRecusado('indice-simbolos', _r)) return;
}

// Chamado pelo backend (`_is_notify`). Pode chegar com a sub-aba Rotinas
// fechada — a rotina também roda pelo ciclo —, daí as guardas de existência.
function indiceSimbolosAgentProgress(data) {
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (!data || (data.project && data.project !== currentProject)) return;
  if (data.status === 'running') return;
  _indiceSimbolosRunning = false;

  const btn = document.getElementById('btn-run-indice-simbolos');
  if (!btn) return;
  btn.disabled = false;
  document.getElementById('indice-simbolos-progress-area').classList.add('hidden');

  if (data.status === 'done') {
    _setSimpleAgentBadge('indice-simbolos', 'done');
    document.getElementById('indice-simbolos-result-area').classList.remove('hidden');
    document.getElementById('indice-simbolos-result-summary').innerHTML = _indiceSimbolosResumoHtml(data);
  } else if (data.status === 'error') {
    _setSimpleAgentBadge('indice-simbolos', 'error');
    document.getElementById('indice-simbolos-result-area').classList.remove('hidden');
    document.getElementById('indice-simbolos-result-summary').textContent = 'Erro: ' + (data.error || 'desconhecido');
  }
}
