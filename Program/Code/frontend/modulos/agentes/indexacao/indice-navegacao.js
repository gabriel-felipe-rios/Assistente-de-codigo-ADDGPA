// ═════════════════════════════════════ AGENTE: ÍNDICE DE NAVEGAÇÃO ══
// Determinístico e sem modelo: recolhe as frases que a Documentação Técnica
// já escreveu e monta a árvore. Substitui a metade do antigo Índice que
// afirmava fatos que não estavam na entrada dele — e por isso alucinava.

let _indiceNavegacaoRunning = false;

async function initIndiceNavegacaoCard() {
  _initSimpleAgentCard('indice-navegacao', _indiceNavegacaoRunning);
  const btn = document.getElementById('btn-run-indice-navegacao');
  if (btn && !btn._wired) {
    btn._wired = true;
    btn.addEventListener('click', runIndiceNavegacaoAgent);
  }
  const r = await window.pywebview.api.get_indice_navegacao_status(currentProject);
  _setSimpleAgentBadge('indice-navegacao', r.exists ? 'done' : 'idle');
  _loadSimpleAgentViewer('indice-navegacao');
  document.getElementById('indice-navegacao-result-area').classList.add('hidden');
}

async function runIndiceNavegacaoAgent() {
  if (_indiceNavegacaoRunning) return;
  // ⚠️ A trava de cinco pontas, ANTES de ligar a flag e apagar o botão: assim
  // uma recusa não deixa a tela em estado de "rodando" que ninguém desfaz.
  // Variante "qualquer dono": este botão é da ponta `rotinas`, a MESMA que o
  // ciclo automático toma — pela regra normal ele ficaria aceso durante ele.
  if (!await rotinaCliqueLiberado('indice-navegacao')) return;
  _indiceNavegacaoRunning = true;
  _setSimpleAgentBadge('indice-navegacao', 'running');
  document.getElementById('indice-navegacao-progress-area').classList.remove('hidden');
  document.getElementById('indice-navegacao-result-area').classList.add('hidden');
  document.getElementById('btn-run-indice-navegacao').disabled = true;
  const _r = await window.pywebview.api.rodar_indice_navegacao_pelo_card(currentProject);
  // ⚠️ O RETORNO É LIDO. Entre a pergunta lá em cima e esta chamada, outra
  // ponta pode ter tomado a janela — e a recusa precisa desfazer o que o
  // clique já tinha ligado, senão o ▶ fica apagado até sair e voltar da aba.
  if (rotinaCardRecusado('indice-navegacao', _r)) return;
}

function indiceNavegacaoAgentProgress(data) {
  if (data.status !== 'done' && data.status !== 'error') return;
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (data.project && data.project !== currentProject) return;
  _indiceNavegacaoRunning = false;
  document.getElementById('indice-navegacao-progress-area').classList.add('hidden');
  document.getElementById('indice-navegacao-result-area').classList.remove('hidden');
  document.getElementById('btn-run-indice-navegacao').disabled = false;

  if (data.status === 'done') {
    _setSimpleAgentBadge('indice-navegacao', 'done');
    document.getElementById('indice-navegacao-result-summary').textContent =
      `${data.arquivos} arquivos indexados — sem nenhuma chamada ao LM Studio.`;
    _loadSimpleAgentViewer('indice-navegacao');
  } else {
    _setSimpleAgentBadge('indice-navegacao', 'error');
    document.getElementById('indice-navegacao-result-summary').textContent = 'Erro: ' + data.error;
  }
}
