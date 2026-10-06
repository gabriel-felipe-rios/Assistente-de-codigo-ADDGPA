// ══════════════════════════════════════════════════════════ ROTINA: BIBLIOTECAS ══
//
// ⚠️ O callback que o backend chama (`bibliotecasAgentProgress`) NÃO mora aqui:
// mora em `documentacao.js`, que carrega depois deste arquivo e sobrescreveria
// qualquer função de mesmo nome declarada aqui. Este módulo registra
// `bibliotecasCardProgress`, e é de lá que ele é chamado — assim a mesma rodada
// atualiza o card e a árvore da aba Documentação, sem que uma apague a outra.

let _bibliotecasRunning = false;

async function initBibliotecasCard() {
  _initSimpleAgentCard('bibliotecas', _bibliotecasRunning);

  if (!document.getElementById('btn-run-bibliotecas')._wired) {
    document.getElementById('btn-run-bibliotecas')._wired = true;
    document.getElementById('btn-run-bibliotecas').addEventListener('click', runBibliotecasAgent);
  }

  const r = await window.pywebview.api.get_bibliotecas_status(currentProject);
  if (r.success && r.existe) {
    _setSimpleAgentBadge('bibliotecas', 'done');
    document.getElementById('bibliotecas-result-area').classList.remove('hidden');
    document.getElementById('bibliotecas-result-summary').innerHTML = _bibliotecasResumoHtml(r);
  } else {
    _setSimpleAgentBadge('bibliotecas', 'idle');
    document.getElementById('bibliotecas-result-area').classList.add('hidden');
  }
}

function _bibliotecasResumoHtml(d) {
  const terceiros = d.terceiros || 0;
  const padrao = d.padrao || 0;
  return `<span class="agente-stat agente-stat-ok">✓ ${terceiros} de terceiro${terceiros !== 1 ? 's' : ''} · ${padrao} da biblioteca padrão</span>`;
}

async function runBibliotecasAgent() {
  if (_bibliotecasRunning) return;
  // ⚠️ A trava de cinco pontas, ANTES de ligar a flag e apagar o botão: assim
  // uma recusa não deixa a tela em estado de "rodando" que ninguém desfaz.
  // Variante "qualquer dono": este botão é da ponta `rotinas`, a MESMA que o
  // ciclo automático toma — pela regra normal ele ficaria aceso durante ele.
  if (!await rotinaCliqueLiberado('bibliotecas')) return;
  _bibliotecasRunning = true;
  _setSimpleAgentBadge('bibliotecas', 'running');
  document.getElementById('btn-run-bibliotecas').disabled = true;
  document.getElementById('bibliotecas-result-area').classList.add('hidden');
  document.getElementById('bibliotecas-progress-area').classList.remove('hidden');
  document.getElementById('bibliotecas-progress-label').textContent = 'Lendo os imports...';
  const _r = await window.pywebview.api.rodar_bibliotecas_pelo_card(currentProject);
  // ⚠️ O RETORNO É LIDO. Entre a pergunta lá em cima e esta chamada, outra
  // ponta pode ter tomado a janela — e a recusa precisa desfazer o que o
  // clique já tinha ligado, senão o ▶ fica apagado até sair e voltar da aba.
  if (rotinaCardRecusado('bibliotecas', _r)) return;
}

// Chamado por `bibliotecasAgentProgress` (documentacao.js). Pode chegar com a
// sub-aba Rotinas fechada — a rotina também roda pelos Acionamentos e pela
// própria aba Documentação —, daí as guardas de existência.
function bibliotecasCardProgress(data) {
  if (!data || data.status === 'running') return;
  _bibliotecasRunning = false;

  const btn = document.getElementById('btn-run-bibliotecas');
  if (!btn) return;
  btn.disabled = false;
  document.getElementById('bibliotecas-progress-area').classList.add('hidden');

  if (data.status === 'done') {
    _setSimpleAgentBadge('bibliotecas', 'done');
    document.getElementById('bibliotecas-result-area').classList.remove('hidden');
    document.getElementById('bibliotecas-result-summary').innerHTML = _bibliotecasResumoHtml(data);
  } else if (data.status === 'error') {
    _setSimpleAgentBadge('bibliotecas', 'error');
    document.getElementById('bibliotecas-result-area').classList.remove('hidden');
    document.getElementById('bibliotecas-result-summary').textContent = 'Erro: ' + (data.error || 'desconhecido');
  }
}
