// ═════════════════════════════════════════════════════════ ROTINA: COMENTÁRIOS ══
//
// ⚠️ O callback que o backend chama (`comentariosAgentProgress`) NÃO mora aqui:
// mora em `documentacao.js`, que carrega depois deste arquivo e sobrescreveria
// qualquer função de mesmo nome declarada aqui. Este módulo registra
// `comentariosCardProgress`, e é de lá que ele é chamado — assim a mesma rodada
// atualiza o card e a árvore da aba Documentação, sem que uma apague a outra.

let _comentariosRunning = false;

async function initComentariosCard() {
  _initSimpleAgentCard('comentarios', _comentariosRunning);

  if (!document.getElementById('btn-run-comentarios')._wired) {
    document.getElementById('btn-run-comentarios')._wired = true;
    document.getElementById('btn-run-comentarios').addEventListener('click', runComentariosAgent);
  }

  const r = await window.pywebview.api.get_comentarios_status(currentProject);
  if (r.success && r.existe) {
    _setSimpleAgentBadge('comentarios', 'done');
    document.getElementById('comentarios-result-area').classList.remove('hidden');
    document.getElementById('comentarios-result-summary').innerHTML = _comentariosResumoHtml(r);
  } else {
    _setSimpleAgentBadge('comentarios', 'idle');
    document.getElementById('comentarios-result-area').classList.add('hidden');
  }
}

function _comentariosResumoHtml(d) {
  const arquivos = d.arquivos || 0;
  const comentarios = d.comentarios || 0;
  const docstrings = d.docstrings || 0;
  return `<span class="agente-stat agente-stat-ok">✓ ${arquivos} arquivo${arquivos !== 1 ? 's' : ''} · ${comentarios} comentário${comentarios !== 1 ? 's' : ''} · ${docstrings} docstring${docstrings !== 1 ? 's' : ''}</span>`;
}

async function runComentariosAgent() {
  if (_comentariosRunning) return;
  // ⚠️ A trava de cinco pontas, ANTES de ligar a flag e apagar o botão: assim
  // uma recusa não deixa a tela em estado de "rodando" que ninguém desfaz.
  // Variante "qualquer dono": este botão é da ponta `rotinas`, a MESMA que o
  // ciclo automático toma — pela regra normal ele ficaria aceso durante ele.
  if (!await rotinaCliqueLiberado('comentarios')) return;
  _comentariosRunning = true;
  _setSimpleAgentBadge('comentarios', 'running');
  document.getElementById('btn-run-comentarios').disabled = true;
  document.getElementById('comentarios-result-area').classList.add('hidden');
  document.getElementById('comentarios-progress-area').classList.remove('hidden');
  document.getElementById('comentarios-progress-label').textContent = 'Lendo os comentários...';
  const _r = await window.pywebview.api.rodar_comentarios_pelo_card(currentProject);
  // ⚠️ O RETORNO É LIDO. Entre a pergunta lá em cima e esta chamada, outra
  // ponta pode ter tomado a janela — e a recusa precisa desfazer o que o
  // clique já tinha ligado, senão o ▶ fica apagado até sair e voltar da aba.
  if (rotinaCardRecusado('comentarios', _r)) return;
}

// Chamado por `comentariosAgentProgress` (documentacao.js). Pode chegar com a
// sub-aba Rotinas fechada — a rotina também roda pelos Acionamentos e pela
// própria aba Documentação —, daí as guardas de existência.
function comentariosCardProgress(data) {
  if (!data || data.status === 'running') return;
  _comentariosRunning = false;

  const btn = document.getElementById('btn-run-comentarios');
  if (!btn) return;
  btn.disabled = false;
  document.getElementById('comentarios-progress-area').classList.add('hidden');

  if (data.status === 'done') {
    _setSimpleAgentBadge('comentarios', 'done');
    document.getElementById('comentarios-result-area').classList.remove('hidden');
    document.getElementById('comentarios-result-summary').innerHTML = _comentariosResumoHtml(data);
  } else if (data.status === 'error') {
    _setSimpleAgentBadge('comentarios', 'error');
    document.getElementById('comentarios-result-area').classList.remove('hidden');
    document.getElementById('comentarios-result-summary').textContent = 'Erro: ' + (data.error || 'desconhecido');
  }
}
