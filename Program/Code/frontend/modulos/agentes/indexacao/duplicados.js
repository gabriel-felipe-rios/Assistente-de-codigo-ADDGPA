// ═══════════════════════════════════════════════════════ ROTINA: DUPLICADOS ══
//
// A lógica do card da sub-aba Rotinas. Modelo: `comentarios.js` — mesma
// natureza (determinística, independente, sem configuração própria).
//
// ⚠️ Existe um OUTRO `duplicados.js` no projeto, em `modulos/duplicados.js`:
// aquele é a TELA da aba Análise, que só lê o resultado. Este aqui é a rotina
// que produz o resultado. O basename repetido segue o padrão das outras treze
// rotinas (`comentarios.js`, `bibliotecas.js`…), que também têm um irmão de
// mesmo nome fora da pasta — o que distingue é a pasta, e ela é que informa.
//
// ⚠️ `duplicadosAgentProgress` é declarado AQUI, e não em outro arquivo como o
// dos Comentários. O motivo daquele é que `documentacao.js` carrega depois e
// sobrescreveria a função; o Duplicados não tem sub-aba na Documentação, então
// ninguém disputa o nome. Se um dia tiver, esta função precisa sair daqui.

let _duplicadosRunning = false;

async function initDuplicadosCard() {
  _initSimpleAgentCard('duplicados', _duplicadosRunning);

  const btn = document.getElementById('btn-run-duplicados-rotina');
  if (btn && !btn._wired) {
    btn._wired = true;
    btn.addEventListener('click', runDuplicadosAgent);
  }

  const r = await window.pywebview.api.get_duplicados_status(currentProject);
  if (r.success && r.existe) {
    _setSimpleAgentBadge('duplicados', 'done');
    document.getElementById('duplicados-result-area').classList.remove('hidden');
    document.getElementById('duplicados-result-summary').innerHTML = _duplicadosResumoHtml(r);
  } else {
    _setSimpleAgentBadge('duplicados', 'idle');
    document.getElementById('duplicados-result-area').classList.add('hidden');
  }
}

function _duplicadosResumoHtml(d) {
  const simbolos = d.simbolos || 0;
  const ignorados = d.ignorados || 0;
  const base = `<span class="agente-stat agente-stat-ok">✓ ${simbolos} função${simbolos !== 1 ? 'ões' : ''} indexada${simbolos !== 1 ? 's' : ''}</span>`;
  // Os ignorados são símbolos curtos demais para comparar (o corpo de uma
  // `class`, por exemplo) ou de arquivo que a gramática não leu. Não é falha da
  // rodada — mas escondê-los faria a cobertura parecer total.
  if (!ignorados) return base;
  return base + ` <span class="agente-stat agente-stat-warn">${ignorados} sem comparação</span>`;
}

async function runDuplicadosAgent() {
  if (_duplicadosRunning) return;
  // ⚠️ A trava de cinco pontas, ANTES de ligar a flag e apagar o botão: assim
  // uma recusa não deixa a tela em estado de "rodando" que ninguém desfaz.
  // Variante "qualquer dono": este botão é da ponta `rotinas`, a MESMA que o
  // ciclo automático toma — pela regra normal ele ficaria aceso durante ele.
  if (!await rotinaCliqueLiberado('duplicados')) return;
  _duplicadosRunning = true;
  _setSimpleAgentBadge('duplicados', 'running');
  document.getElementById('btn-run-duplicados-rotina').disabled = true;
  document.getElementById('duplicados-result-area').classList.add('hidden');
  document.getElementById('duplicados-progress-area').classList.remove('hidden');
  document.getElementById('duplicados-progress-label').textContent = 'Comparando as funções...';
  const _r = await window.pywebview.api.rodar_duplicados_pelo_card(currentProject);
  // ⚠️ O RETORNO É LIDO. Entre a pergunta lá em cima e esta chamada, outra
  // ponta pode ter tomado a janela — e a recusa precisa desfazer o que o
  // clique já tinha ligado, senão o ▶ fica apagado até sair e voltar da aba.
  if (rotinaCardRecusado('duplicados-rotina', _r)) return;
}

// Chamado pelo backend (`_dup_notify`). Pode chegar com a sub-aba Rotinas
// fechada — a rotina também roda pelos Acionamentos —, daí as guardas.
function duplicadosAgentProgress(data) {
  if (!data) return;
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (data.project && data.project !== currentProject) return;

  const label = document.getElementById('duplicados-progress-label');
  if (data.status === 'running') {
    if (label && data.total) {
      label.textContent = `Comparando as funções... (${data.arquivo} / ${data.total} arquivos)`;
    }
    return;
  }

  _duplicadosRunning = false;
  const btn = document.getElementById('btn-run-duplicados-rotina');
  if (!btn) return;
  btn.disabled = false;
  document.getElementById('duplicados-progress-area').classList.add('hidden');

  if (data.status === 'done') {
    _setSimpleAgentBadge('duplicados', 'done');
    document.getElementById('duplicados-result-area').classList.remove('hidden');
    document.getElementById('duplicados-result-summary').innerHTML = _duplicadosResumoHtml(data);
  } else if (data.status === 'error') {
    _setSimpleAgentBadge('duplicados', 'error');
    document.getElementById('duplicados-result-area').classList.remove('hidden');
    document.getElementById('duplicados-result-summary').textContent = 'Erro: ' + (data.error || 'desconhecido');
  }
}
