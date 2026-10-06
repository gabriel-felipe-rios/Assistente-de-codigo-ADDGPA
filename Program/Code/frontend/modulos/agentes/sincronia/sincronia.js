// ══════════════════════════════════════════════════════ AGENTE: SINCRONIA ══
// Determinístico. É o único agente que não PRODUZ nada: ele mantém as saídas
// dos outros em dia com o código, movendo, renomeando e apagando.
//
// ⛔ Não descreva como "limpa órfãos" em lugar nenhum da interface: apagar é a
// menos frequente das três operações.

let _sincroniaRunning = false;

async function initSincroniaCard() {
  _initSimpleAgentCard('sincronia', _sincroniaRunning);
  const btn = document.getElementById('btn-run-sincronia');
  if (btn && !btn._wired) {
    btn._wired = true;
    btn.addEventListener('click', runSincroniaAgent);
  }
  const r = await window.pywebview.api.get_sincronia_status(currentProject);
  _setSimpleAgentBadge('sincronia', r.exists ? 'done' : 'idle');
  document.getElementById('sincronia-result-area').classList.add('hidden');
  _sincroniaResumoNoCabecalho(r.exists ? r.resumo : null);
  _loadSincroniaPendentes();
}

async function runSincroniaAgent() {
  if (_sincroniaRunning) return;
  // ⚠️ A trava de cinco pontas, ANTES de ligar a flag e apagar o botão: assim
  // uma recusa não deixa a tela em estado de "rodando" que ninguém desfaz.
  // Variante "qualquer dono": este botão é da ponta `rotinas`, a MESMA que o
  // ciclo automático toma — pela regra normal ele ficaria aceso durante ele.
  if (!await rotinaCliqueLiberado()) return;
  _sincroniaRunning = true;
  _setSimpleAgentBadge('sincronia', 'running');
  document.getElementById('sincronia-progress-area').classList.remove('hidden');
  document.getElementById('sincronia-result-area').classList.add('hidden');
  document.getElementById('btn-run-sincronia').disabled = true;
  const _r = await window.pywebview.api.rodar_sincronia_pelo_card(currentProject);
  // ⚠️ O RETORNO É LIDO. Entre a pergunta lá em cima e esta chamada, outra
  // ponta pode ter tomado a janela — e a recusa precisa desfazer o que o
  // clique já tinha ligado, senão o ▶ fica apagado até sair e voltar da aba.
  if (rotinaCardRecusado('sincronia', _r)) return;
}

function sincroniaAgentProgress(data) {
  if (data.status !== 'done' && data.status !== 'error') return;
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (data.project && data.project !== currentProject) return;
  _sincroniaRunning = false;
  document.getElementById('sincronia-progress-area').classList.add('hidden');
  document.getElementById('sincronia-result-area').classList.remove('hidden');
  document.getElementById('btn-run-sincronia').disabled = false;

  if (data.status === 'done') {
    _setSimpleAgentBadge('sincronia', 'done');
    document.getElementById('sincronia-result-summary').innerHTML =
      _sincroniaTextoResumo(data);
    _sincroniaResumoNoCabecalho(data);
    _loadSincroniaPendentes();
  } else {
    _setSimpleAgentBadge('sincronia', 'error');
    document.getElementById('sincronia-result-summary').textContent = 'Erro: ' + data.error;
  }
}

// As três operações aparecem sempre, mesmo em zero: é isso que ensina o que o
// agente faz. Um resumo que só mostrasse "apagados" o descreveria errado.
function _sincroniaTextoResumo(d) {
  const mov = d.movidos || 0;
  const apa = d.apagados || 0;
  const pas = d.pastas_marcadas || 0;
  if (!mov && !apa && !pas) {
    return '<span class="agente-stat agente-stat-ok">✓ Tudo em dia — nenhuma divergência</span>';
  }
  return `<span class="agente-stat agente-stat-ok">↔ ${mov} saída${mov !== 1 ? 's' : ''} movida${mov !== 1 ? 's' : ''}</span>`
    + `<span class="agente-stat">🗑 ${apa} apagada${apa !== 1 ? 's' : ''}</span>`
    + `<span class="agente-stat">📁 ${pas} pasta${pas !== 1 ? 's' : ''} marcada${pas !== 1 ? 's' : ''} para refazer o resumo</span>`;
}

function _sincroniaResumoNoCabecalho(d) {
  const sum = document.getElementById('sincronia-summary');
  if (!sum) return;
  if (!d) { sum.textContent = ''; return; }
  const total = (d.movidos || 0) + (d.apagados || 0);
  sum.textContent = total ? `${total} ajuste${total !== 1 ? 's' : ''}` : 'em dia';
}

// O que o agente FARIA agora, sem fazer — o preview roda a mesma detecção.
async function _loadSincroniaPendentes() {
  const el = document.getElementById('sincronia-pendentes-list');
  if (!el) return;
  const r = await window.pywebview.api.preview_sincronia(currentProject);
  const ops = (r && r.success) ? (r.operacoes || []) : [];
  const itens = ops.map(op => op.op === 'mover'
    ? { file: `${op.de}  →  ${op.para}`, reason: 'movido ou renomeado — as saídas vão junto, sem chamar o modelo' }
    : { file: op.de, reason: 'apagado — as saídas derivadas dele saem também' });
  renderAgenteIssueList('sincronia-pendentes-list', itens,
                        'Nenhuma divergência entre o código e as saídas.');

  const tab = document.getElementById('sincronia-tab-pendentes');
  if (tab) tab.textContent = itens.length ? `Divergências (${itens.length})` : 'Divergências';
}
