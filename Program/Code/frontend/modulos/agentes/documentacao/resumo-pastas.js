// ══════════════════════════════════════════════════════ AGENTE: RESUMO DE PASTAS ══

let _resumoPastasRunning = false;

document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('resumo-pastas-viewer-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.getElementById('resumo-pastas-viewer-content').classList.add('hidden');
      document.querySelectorAll('#agente-resumo-pastas .agente-viewer-table tbody tr').forEach(r => r.classList.remove('active'));
    });
  }
});

async function initResumoPastasCard() {
  _initSimpleAgentCard('resumo-pastas', _resumoPastasRunning);

  if (!document.getElementById('btn-run-resumo-pastas')._wired) {
    document.getElementById('btn-run-resumo-pastas')._wired = true;
    document.getElementById('btn-run-resumo-pastas').addEventListener('click', runResumoPastasAgent);
    ligarBotaoDePrompt('resumo-pastas');
  }

  const r = await window.pywebview.api.get_resumo_pastas_status(currentProject);
  _selarPeloStatus('resumo-pastas', r);
  _loadSimpleAgentViewer('resumo-pastas');
}

async function runResumoPastasAgent() {
  if (_resumoPastasRunning) return;
  // ⚠️ A trava de cinco pontas, ANTES de ligar a flag e apagar o botão: assim
  // uma recusa não deixa a tela em estado de "rodando" que ninguém desfaz.
  // Variante "qualquer dono": este botão é da ponta `rotinas`, a MESMA que o
  // ciclo automático toma — pela regra normal ele ficaria aceso durante ele.
  if (!await rotinaCliqueLiberado('resumo-pastas')) return;
  _resumoPastasRunning = true;
  _setSimpleAgentBadge('resumo-pastas', 'running');
  document.getElementById('btn-run-resumo-pastas').disabled = true;
  document.getElementById('resumo-pastas-result-area').classList.add('hidden');

  const progressArea = document.getElementById('resumo-pastas-progress-area');
  progressArea.classList.remove('hidden');
  document.getElementById('resumo-pastas-progress-label').textContent = 'Iniciando...';
  document.getElementById('resumo-pastas-progress-count').textContent = '';
  document.getElementById('resumo-pastas-progress-bar').style.width = '0%';
  document.getElementById('resumo-pastas-current-folder').textContent = '';

  // Sem modelo e sem paralelismo: o backend usa o modelo carregado no LM Studio
  // e o paralelismo de Configurações — os mesmos do ciclo.
  const _r = await window.pywebview.api.rodar_resumo_pastas_pelo_card(currentProject);
  // ⚠️ O RETORNO É LIDO. Entre a pergunta lá em cima e esta chamada, outra
  // ponta pode ter tomado a janela — e a recusa precisa desfazer o que o
  // clique já tinha ligado, senão o ▶ fica apagado até sair e voltar da aba.
  if (rotinaCardRecusado('resumo-pastas', _r)) return;
}

function resumoPastasAgentProgress(data) {
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (data.project && data.project !== currentProject) return;
  const { status, total, processed, current, in_progress, error } = data;

  if (status === 'running') {
    // O card precisa acender sozinho quando quem disparou foi
    // o ciclo, e não o botão daqui.
    _resumoPastasRunning = true;
    _setSimpleAgentBadge('resumo-pastas', 'running');
    document.getElementById('resumo-pastas-progress-area').classList.remove('hidden');
    const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
    document.getElementById('resumo-pastas-progress-bar').style.width = pct + '%';
    document.getElementById('resumo-pastas-progress-count').textContent = `${processed} / ${total}`;
    document.getElementById('resumo-pastas-progress-label').textContent = 'Resumindo pastas...';
    const inProgressList = (in_progress && in_progress.length) ? in_progress : (current ? [current] : []);
    // D7: uma linha por pasta, com a fase dela («lote 2 de 4», «costurando»).
    document.getElementById('resumo-pastas-current-folder').innerHTML =
      _linhasEmAndamento(inProgressList, data.fases);
    _acUpdateAgentCount('resumo-pastas', processed, total);
    // D7, D12: a mesma fase no card da rotina no Visualizar.
    if (typeof visualizarAgenteFase === 'function') {
      visualizarAgenteFase('resumo-pastas',
        _linhasDaFaseNoVisualizar(processed, total, inProgressList, data.fases));
    }
    return;
  }

  _resumoPastasRunning = false;
  document.getElementById('btn-run-resumo-pastas').disabled = false;
  _acUpdateAgentCount('resumo-pastas', null, null);
  if (typeof visualizarAgenteFase === 'function') visualizarAgenteFase('resumo-pastas', []);

  if (status === 'done') {
    document.getElementById('resumo-pastas-progress-bar').style.width = '100%';
    document.getElementById('resumo-pastas-progress-label').textContent = 'Concluído';
    document.getElementById('resumo-pastas-progress-count').textContent = `${processed} / ${total}`;
    document.getElementById('resumo-pastas-current-folder').textContent = '';
    _setSimpleAgentBadge('resumo-pastas', 'done', (data.errors || []).length);
    document.getElementById('resumo-pastas-result-area').classList.remove('hidden');

    const gerados = data.generated || 0;
    const inalterados = data.unchanged || 0;
    const grandes = (data.skipped || []).length;
    const bloqueadas = (data.bloqueadas || []).length;
    const erros = (data.errors || []).length;
    document.getElementById('resumo-pastas-result-summary').innerHTML =
      `<span class="agente-stat agente-stat-ok">✓ ${processed} pasta${processed !== 1 ? 's' : ''}</span>` +
      `<span class="agente-stat">${gerados} gerado${gerados !== 1 ? 's' : ''} · ${inalterados} inalterado${inalterados !== 1 ? 's' : ''}</span>` +
      (bloqueadas ? `<span class="agente-stat agente-stat-warn">⏳ ${bloqueadas} aguardando documentação técnica</span>` : '') +
      (grandes ? `<span class="agente-stat agente-stat-err">${grandes} grande${grandes !== 1 ? 's' : ''}</span>` : '') +
      (erros ? `<span class="agente-stat agente-stat-err">✗ ${erros} erro${erros !== 1 ? 's' : ''}</span>` : '');

    _renderResumoPastasIssues(data.skipped || [], data.errors || [], data.bloqueadas || []);
    showToast('Resumo de Pastas concluído!');
    _loadSimpleAgentViewer('resumo-pastas');
  } else if (status === 'error') {
    document.getElementById('resumo-pastas-progress-label').textContent = 'Erro: ' + (error || 'desconhecido');
    _setSimpleAgentBadge('resumo-pastas', 'error');
    // Mesmo sem nada gerado, as pastas travadas precisam aparecer: é a única
    // informação que diz ao usuário o que fazer para destravar.
    _renderResumoPastasIssues(data.skipped || [], data.errors || [], data.bloqueadas || []);
    showToast('Erro no Resumo de Pastas: ' + (error || ''), true);
  }
}

// Popula as sub-abas "Arquivos muito grandes" (fichas que não coubem em 1 lote),
// "Aguardando documentação técnica" (pastas travadas por documentação faltando) e "Erros"
// (exceções por pasta), no mesmo molde da Documentação Técnica.
function _renderResumoPastasIssues(grandes, errors, bloqueadas) {
  bloqueadas = bloqueadas || [];
  renderAgenteIssueList('resumo-pastas-grandes-list', grandes,
                        'Nenhuma ficha grande demais.');
  renderAgenteIssueList('resumo-pastas-bloqueadas-list', bloqueadas,
                        'Nenhuma pasta esperando a documentação técnica.');
  renderAgenteIssueList('resumo-pastas-error-list', errors, 'Nenhum erro.');

  const tabG = document.getElementById('resumo-pastas-tab-grandes');
  if (tabG) tabG.textContent = grandes.length ? `Arquivos muito grandes (${grandes.length})` : 'Arquivos muito grandes';
  const tabB = document.getElementById('resumo-pastas-tab-bloqueadas');
  if (tabB) tabB.textContent = bloqueadas.length ? `Aguardando documentação técnica (${bloqueadas.length})` : 'Aguardando documentação técnica';
  const tabE = document.getElementById('resumo-pastas-tab-erros');
  if (tabE) tabE.textContent = errors.length ? `Erros (${errors.length})` : 'Erros';
}
