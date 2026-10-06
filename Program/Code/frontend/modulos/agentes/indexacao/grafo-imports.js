// ══════════════════════════════════════════════════════ AGENTE: GRAFO DE IMPORTS ══

let _grafoImportsRunning = false;

async function initGrafoImportsCard() {
  _initSimpleAgentCard('grafo-imports', _grafoImportsRunning);

  if (!document.getElementById('btn-run-grafo-imports')._wired) {
    document.getElementById('btn-run-grafo-imports')._wired = true;
    document.getElementById('btn-run-grafo-imports').addEventListener('click', runGrafoImportsAgent);
  }

  const r = await window.pywebview.api.get_grafo_imports_status(currentProject);
  if (r.success && r.exists) {
    _setSimpleAgentBadge('grafo-imports', 'done');
    document.getElementById('grafo-imports-result-area').classList.remove('hidden');
    document.getElementById('grafo-imports-result-summary').innerHTML =
      `<span class="agente-stat agente-stat-ok">✓ ${r.total_files} arquivo${r.total_files !== 1 ? 's' : ''} · ${r.total_edges} conexõe${r.total_edges !== 1 ? 's' : 'ão'}</span>`;
  } else {
    _setSimpleAgentBadge('grafo-imports', 'idle');
    document.getElementById('grafo-imports-result-area').classList.add('hidden');
  }
}

async function runGrafoImportsAgent() {
  if (_grafoImportsRunning) return;
  // ⚠️ A trava de cinco pontas, ANTES de ligar a flag e apagar o botão: assim
  // uma recusa não deixa a tela em estado de "rodando" que ninguém desfaz.
  // Variante "qualquer dono": este botão é da ponta `rotinas`, a MESMA que o
  // ciclo automático toma — pela regra normal ele ficaria aceso durante ele.
  if (!await rotinaCliqueLiberado('grafo-imports')) return;
  _grafoImportsRunning = true;
  _setSimpleAgentBadge('grafo-imports', 'running');
  document.getElementById('btn-run-grafo-imports').disabled = true;
  document.getElementById('grafo-imports-result-area').classList.add('hidden');
  document.getElementById('grafo-imports-progress-area').classList.remove('hidden');
  document.getElementById('grafo-imports-progress-label').textContent = 'Analisando imports...';
  const _r = await window.pywebview.api.rodar_grafo_imports_pelo_card(currentProject);
  // ⚠️ O RETORNO É LIDO. Entre a pergunta lá em cima e esta chamada, outra
  // ponta pode ter tomado a janela — e a recusa precisa desfazer o que o
  // clique já tinha ligado, senão o ▶ fica apagado até sair e voltar da aba.
  if (rotinaCardRecusado('grafo-imports', _r)) return;
}

function grafoImportsAgentProgress(data) {
  // Com mais de um projeto aberto ao mesmo tempo, este evento pode ser de um
  // projeto que não é o exibido agora — ver o mesmo tratamento em
  // acionamentos.js (acionamentosAgentDone).
  if (data.project && data.project !== currentProject) return;
  _grafoImportsRunning = false;
  document.getElementById('btn-run-grafo-imports').disabled = false;
  document.getElementById('grafo-imports-progress-area').classList.add('hidden');

  if (data.status === 'done') {
    _setSimpleAgentBadge('grafo-imports', 'done');
    document.getElementById('grafo-imports-result-area').classList.remove('hidden');
    document.getElementById('grafo-imports-result-summary').innerHTML =
      `<span class="agente-stat agente-stat-ok">✓ ${data.total_files} arquivo${data.total_files !== 1 ? 's' : ''} · ${data.total_edges} conexõe${data.total_edges !== 1 ? 's' : 'ão'}</span>`;
    showToast('Grafo de Imports gerado!');
  } else if (data.status === 'error') {
    _setSimpleAgentBadge('grafo-imports', 'error');
    document.getElementById('grafo-imports-result-area').classList.remove('hidden');
    document.getElementById('grafo-imports-result-summary').textContent = 'Erro: ' + (data.error || 'desconhecido');
    showToast('Erro no Grafo de Imports: ' + (data.error || ''), true);
  }
}
