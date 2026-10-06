// ═══════════════════════════════════ AGENTE: ÍNDICE DE IDENTIFICADORES ══
// Determinístico. Tabela de todo nome que vive em dois ou mais arquivos —
// o acoplamento que o Grafo de Imports não enxerga.

let _identificadoresRunning = false;

async function initIdentificadoresCard() {
  _initSimpleAgentCard('identificadores', _identificadoresRunning);
  const btn = document.getElementById('btn-run-identificadores');
  if (btn && !btn._wired) {
    btn._wired = true;
    btn.addEventListener('click', runIdentificadoresAgent);
  }
  const r = await window.pywebview.api.get_identificadores_status(currentProject);
  _setSimpleAgentBadge('identificadores', r.existe ? 'done' : 'idle');
  const sum = document.getElementById('identificadores-summary');
  if (sum) sum.textContent = r.existe
    ? `${r.total_nomes} nomes · ${r.total_ocorrencias} ocorrências` : '';
  document.getElementById('identificadores-result-area').classList.add('hidden');
}

async function runIdentificadoresAgent() {
  if (_identificadoresRunning) return;
  // ⚠️ A trava de cinco pontas, ANTES de ligar a flag e apagar o botão: assim
  // uma recusa não deixa a tela em estado de "rodando" que ninguém desfaz.
  // Variante "qualquer dono": este botão é da ponta `rotinas`, a MESMA que o
  // ciclo automático toma — pela regra normal ele ficaria aceso durante ele.
  if (!await rotinaCliqueLiberado('identificadores')) return;
  _identificadoresRunning = true;
  _setSimpleAgentBadge('identificadores', 'running');
  document.getElementById('identificadores-progress-area').classList.remove('hidden');
  document.getElementById('identificadores-result-area').classList.add('hidden');
  document.getElementById('btn-run-identificadores').disabled = true;
  const _r = await window.pywebview.api.rodar_identificadores_pelo_card(currentProject);
  // ⚠️ O RETORNO É LIDO. Entre a pergunta lá em cima e esta chamada, outra
  // ponta pode ter tomado a janela — e a recusa precisa desfazer o que o
  // clique já tinha ligado, senão o ▶ fica apagado até sair e voltar da aba.
  if (rotinaCardRecusado('identificadores', _r)) return;
}

function identificadoresAgentProgress(data) {
  if (data.status !== 'done' && data.status !== 'error') return;
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (data.project && data.project !== currentProject) return;
  _identificadoresRunning = false;
  document.getElementById('identificadores-progress-area').classList.add('hidden');
  document.getElementById('identificadores-result-area').classList.remove('hidden');
  document.getElementById('btn-run-identificadores').disabled = false;

  if (data.status === 'done') {
    _setSimpleAgentBadge('identificadores', 'done');
    document.getElementById('identificadores-result-summary').textContent =
      `${data.nomes} nomes indexados · ${data.ocorrencias} ocorrências.`;
    const sum = document.getElementById('identificadores-summary');
    if (sum) sum.textContent = `${data.nomes} nomes · ${data.ocorrencias} ocorrências`;
  } else {
    _setSimpleAgentBadge('identificadores', 'error');
    document.getElementById('identificadores-result-summary').textContent = 'Erro: ' + data.error;
  }
}
