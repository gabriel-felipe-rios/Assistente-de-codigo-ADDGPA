// ══════════════════════════════════════════════════════ AGENTE: PIPELINE ══

let _pipelineRunning = false;

async function initPipelineCard() {
  _initSimpleAgentCard('pipeline', _pipelineRunning);
  if (!document.getElementById('btn-run-pipeline')._wired) {
    document.getElementById('btn-run-pipeline')._wired = true;
    document.getElementById('btn-run-pipeline').addEventListener('click', runPipelineAgent);
    ligarBotaoDePrompt('pipeline');
  }
  const r = await window.pywebview.api.get_pipeline_status(currentProject);
  _selarPeloStatus('pipeline', r);
  _loadSimpleAgentViewer('pipeline');
  document.getElementById('pipeline-result-area').classList.add('hidden');
}

async function runPipelineAgent() {
  if (_pipelineRunning) return;
  // ⚠️ A trava de cinco pontas, ANTES de ligar a flag e apagar o botão: assim
  // uma recusa não deixa a tela em estado de "rodando" que ninguém desfaz.
  // Variante "qualquer dono": este botão é da ponta `rotinas`, a MESMA que o
  // ciclo automático toma — pela regra normal ele ficaria aceso durante ele.
  if (!await rotinaCliqueLiberado('pipeline')) return;
  _pipelineRunning = true;
  _setSimpleAgentBadge('pipeline', 'running');
  document.getElementById('pipeline-progress-area').classList.remove('hidden');
  document.getElementById('pipeline-result-area').classList.add('hidden');
  document.getElementById('btn-run-pipeline').disabled = true;
  // Sem modelo: o backend usa o que esta carregado no LM Studio.
  const _r = await window.pywebview.api.rodar_pipeline_pelo_card(currentProject);
  // ⚠️ O RETORNO É LIDO. Entre a pergunta lá em cima e esta chamada, outra
  // ponta pode ter tomado a janela — e a recusa precisa desfazer o que o
  // clique já tinha ligado, senão o ▶ fica apagado até sair e voltar da aba.
  if (rotinaCardRecusado('pipeline', _r)) return;
}

function pipelineAgentProgress(data) {
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (data.project && data.project !== currentProject) return;
  // O mapa Pipeline (Mapas) NAO dispara este agente: so ESCUTA, para reler
  // as Leituras e o Mapa em niveis quando o arquivo fica pronto.
  if (typeof vpOnPipelineProgress === 'function') vpOnPipelineProgress(data);

  // O grafo de chamadas leva alguns segundos (e o indice de simbolos pode
  // levar minutos, se precisar ser construido). Sem anunciar a etapa, a tela
  // fica identica o tempo todo e parece travada.
  if (data.status === 'running' && data.etapa) {
    const el = document.getElementById('pipeline-progress-label');
    if (el) el.textContent = data.etapa;
    return;
  }

  if (data.status === 'done') {
    _pipelineRunning = false;
    _setSimpleAgentBadge('pipeline', 'done');
    document.getElementById('pipeline-progress-area').classList.add('hidden');
    document.getElementById('pipeline-result-area').classList.remove('hidden');
    // O aviso de Formato garantido indisponível entra AQUI, junto do
    // resultado. O Pipeline não tem aba Erros — o resumo é a superfície dele —,
    // e sem isso a rotina voltaria a aceitar texto solto sem ninguém saber.
    // ⚠️ "0 caracteres gerados" seria mentira quando ele PULOU. O Pipeline
    // ganhou portão próprio: se o grafo de chamadas está igual ao da última
    // geração, ele não fala com o modelo — e a tela precisa dizer isso, senão
    // parece que a rotina rodou e não produziu nada.
    document.getElementById('pipeline-result-summary').innerHTML =
      (data.inalterado
        ? '<span class="agente-stat agente-stat-ok">Nada a fazer — o grafo de chamadas está igual ao da última geração.</span>'
        : `<span class="agente-stat agente-stat-ok">Concluído — ${data.chars} caracteres gerados.</span>`) +
      (data.aviso
        ? `<span class="agente-stat agente-stat-err">⚠ Formato garantido indisponível — ${data.aviso}</span>`
        : '');
    document.getElementById('btn-run-pipeline').disabled = false;
  } else if (data.status === 'error') {
    _pipelineRunning = false;
    _setSimpleAgentBadge('pipeline', 'error');
    document.getElementById('pipeline-progress-area').classList.add('hidden');
    document.getElementById('pipeline-result-area').classList.remove('hidden');
    document.getElementById('pipeline-result-summary').textContent = 'Erro: ' + data.error;
    document.getElementById('btn-run-pipeline').disabled = false;
  }
}
