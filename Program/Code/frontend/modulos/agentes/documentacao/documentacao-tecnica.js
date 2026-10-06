// ══════════════════════════════════════════════════════ AGENTE: DOCUMENTAÇÃO TÉCNICA ══

let _documentacaoTecnicaRunning = false;
// Sem extensões até o backend responder. A lista é uma só, global: a lista
// de código com as Exceções da Documentação Técnica, em Configurações ›
// Arquivos que o programa lê › Exceções (ver `_rotinaLePintar`, em rotinas-comum.js).
let _docTecnicaConfig = { extensions: [] };
let _docTecnicaPreviewData = null;

async function _loadDocTecnicaConfig() {
  const r = await window.pywebview.api.load_rotinas_config(currentProject);
  if (r.success && r.config['doc-tecnica']) _docTecnicaConfig = r.config['doc-tecnica'];
  _rotinaLePintar('documentacao-tecnica', (_docTecnicaConfig.extensions || []).length);
}

async function loadDocTecnicaPreview() {
  if (!currentProject) return;
  const label = document.getElementById('documentacao-tecnica-preview-label');
  if (!label) return;
  label.textContent = 'Verificando...';

  const extensions = _docTecnicaConfig.extensions || [];

  const result = await window.pywebview.api.preview_documentacao_tecnica_agent(currentProject, extensions.length ? extensions : null);
  if (!result.success) { label.textContent = 'Erro ao verificar arquivos'; return; }

  _docTecnicaPreviewData = result;
  renderDocTecnicaTree(result);
}

function renderDocTecnicaTree(data) {
  const { files, ignored } = data;
  const showIgnored = document.getElementById('documentacao-tecnica-show-ignored').checked;

  const label = document.getElementById('documentacao-tecnica-preview-label');
  let txt = `${files.length} arquivo${files.length !== 1 ? 's' : ''} para processar`;
  if (ignored.length > 0) txt += ` · ${ignored.length} ignorado${ignored.length !== 1 ? 's' : ''}`;
  label.textContent = txt;

  const tree = document.getElementById('documentacao-tecnica-tree');
  tree.innerHTML = '';

  const hdr = document.createElement('div');
  hdr.className = 'preview-file-row preview-file-header';
  hdr.innerHTML = '<span class="pf-tokens">Tokens</span><span class="pf-lines">Linhas</span><span class="pf-name">Arquivo</span>';
  tree.appendChild(hdr);

  const byFolder = {};
  for (const f of files) {
    (byFolder[f.folder] = byFolder[f.folder] || []).push({ ...f, _show: 'process' });
  }
  if (showIgnored) {
    for (const f of ignored) {
      (byFolder[f.folder] = byFolder[f.folder] || []).push({ ...f, _show: 'ignored' });
    }
  }

  for (const [folder, items] of Object.entries(byFolder)) {
    const folderEl = document.createElement('div');
    folderEl.className = 'preview-folder';
    const fhdr = document.createElement('div');
    fhdr.className = 'preview-folder-name';
    fhdr.textContent = '📁 ' + folder;
    folderEl.appendChild(fhdr);

    const nested = {};
    for (const item of items) {
      const parts = item.path.replace(/\\/g, '/').split('/');
      let node = nested;
      for (let i = 0; i < parts.length - 1; i++) {
        node[parts[i]] = node[parts[i]] || { _files: [] };
        node = node[parts[i]];
      }
      (node._files = node._files || []).push({ ...item, _name: parts[parts.length - 1] });
    }

    folderEl.appendChild(renderPreviewNode(nested, folder, 0));
    tree.appendChild(folderEl);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('documentacao-tecnica-viewer-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.getElementById('documentacao-tecnica-viewer-content').classList.add('hidden');
      document.querySelectorAll('#agente-documentacao-tecnica .agente-viewer-table tbody tr').forEach(r => r.classList.remove('active'));
    });
  }
});

async function initDocumentacaoTecnicaCard() {
  _initSimpleAgentCard('documentacao-tecnica', _documentacaoTecnicaRunning);

  if (!document.getElementById('btn-run-documentacao-tecnica')._wired) {
    document.getElementById('btn-run-documentacao-tecnica')._wired = true;
    document.getElementById('btn-run-documentacao-tecnica').addEventListener('click', runDocumentacaoTecnicaAgent);
    ligarBotaoDePrompt('documentacao-tecnica');
  }

  const r = await window.pywebview.api.get_documentacao_tecnica_status(currentProject);
  _setSimpleAgentBadge('documentacao-tecnica', (r.success && r.exists) ? 'done' : 'idle',
                       ((r.resumo || {}).errors || []).length);
  _loadSimpleAgentViewer('documentacao-tecnica');
  
  await _loadDocTecnicaConfig();
  loadDocTecnicaPreview();
}

async function runDocumentacaoTecnicaAgent() {
  if (_documentacaoTecnicaRunning) return;
  // ⚠️ A trava de cinco pontas, ANTES de ligar a flag e apagar o botão: assim
  // uma recusa não deixa a tela em estado de "rodando" que ninguém desfaz.
  // Variante "qualquer dono": este botão é da ponta `rotinas`, a MESMA que o
  // ciclo automático toma — pela regra normal ele ficaria aceso durante ele.
  if (!await rotinaCliqueLiberado('doc-tecnica')) return;
  const extensions = _docTecnicaConfig.extensions || [];
  if (!extensions.length) { showToast('Nenhuma extensão na lista das rotinas — ajuste em Configurações › Arquivos que o programa lê › Exceções.', true); return; }

  _documentacaoTecnicaRunning = true;
  _setSimpleAgentBadge('documentacao-tecnica', 'running');
  document.getElementById('btn-run-documentacao-tecnica').disabled = true;

  const progressArea = document.getElementById('documentacao-tecnica-progress-area');
  progressArea.classList.remove('hidden');
  document.getElementById('documentacao-tecnica-progress-label').textContent = 'Iniciando...';
  document.getElementById('documentacao-tecnica-progress-count').textContent = '';
  document.getElementById('documentacao-tecnica-progress-bar').style.width = '0%';
  document.getElementById('documentacao-tecnica-current-file').textContent = '';

  // Sem modelo e sem paralelismo: o backend usa o modelo carregado no LM Studio
  // e o paralelismo de Configurações — os mesmos do ciclo.
  const _r = await window.pywebview.api.rodar_documentacao_tecnica_pelo_card(currentProject, null, extensions);
  // ⚠️ O RETORNO É LIDO. Entre a pergunta lá em cima e esta chamada, outra
  // ponta pode ter tomado a janela — e a recusa precisa desfazer o que o
  // clique já tinha ligado, senão o ▶ fica apagado até sair e voltar da aba.
  if (rotinaCardRecusado('documentacao-tecnica', _r)) return;
}

function documentacaoTecnicaAgentProgress(data) {
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (data.project && data.project !== currentProject) return;
  const { status, total, processed, current, in_progress, skipped, errors, error } = data;

  if (status === 'running') {
    // O card precisa acender sozinho quando quem disparou foi
    // o ciclo, e não o botão daqui.
    _documentacaoTecnicaRunning = true;
    _setSimpleAgentBadge('documentacao-tecnica', 'running');
    document.getElementById('documentacao-tecnica-progress-area').classList.remove('hidden');
    // As duas barras: o trabalho real em cima, o que veio do cache embaixo.
    // Ver `_pintarProgressoDuplo`, em rotinas-comum.js, onde o motivo está por extenso.
    const aProcessar = _pintarProgressoDuplo('documentacao-tecnica', data);
    document.getElementById('documentacao-tecnica-progress-label').textContent =
      (aProcessar == null) ? 'Iniciando...' : 'Documentando arquivos...';
    const inProgressList = (in_progress && in_progress.length) ? in_progress : (current ? [current] : []);
    // D7: uma linha por arquivo, com a fase dele («parte 2 de 3», «costurando»).
    document.getElementById('documentacao-tecnica-current-file').innerHTML =
      _linhasEmAndamento(inProgressList, data.fases);
    _acUpdateAgentCount('doc-tecnica', processed, aProcessar);
    // D7, D12: a mesma fase no card da rotina no Visualizar.
    if (typeof visualizarAgenteFase === 'function') {
      visualizarAgenteFase('doc-tecnica',
        _linhasDaFaseNoVisualizar(processed, aProcessar, inProgressList, data.fases));
    }
    _rotulaAndamento('documentacao-tecnica-preview-label', processed, aProcessar);
    return;
  }

  _documentacaoTecnicaRunning = false;
  document.getElementById('btn-run-documentacao-tecnica').disabled = false;
  _acUpdateAgentCount('doc-tecnica', null, null);
  if (typeof visualizarAgenteFase === 'function') visualizarAgenteFase('doc-tecnica', []);

  if (status === 'done') {
    // ⚠️ Ver `_pintarProgressoDuplo`, em rotinas-comum.js: o número caía aqui porque `processed` trocava de
    // significado no fim e o denominador era o universo varrido.
    _pintarProgressoDuplo('documentacao-tecnica', data);
    document.getElementById('documentacao-tecnica-progress-bar').style.width = '100%';
    document.getElementById('documentacao-tecnica-progress-label').textContent = 'Concluído';
    document.getElementById('documentacao-tecnica-current-file').textContent = '';
    loadDocTecnicaPreview();   // volta a previsão, agora do que sobrou
    _setSimpleAgentBadge('documentacao-tecnica', 'done', (errors || []).length);
    // A tela de resultado quer "quantos .md saíram" — que agora tem nome
    // próprio (`gerados`) em vez de dividir a etiqueta `processed`.
    renderDocumentacaoTecnicaResult({ total, processed: (data.gerados != null ? data.gerados : processed), skipped: skipped || [], errors: errors || [], finished_at: new Date().toISOString() });
    showToast('Documentação Técnica concluída!');
    _loadSimpleAgentViewer('documentacao-tecnica');
  } else if (status === 'error') {
    document.getElementById('documentacao-tecnica-progress-label').textContent = 'Erro: ' + (error || 'desconhecido');
    _setSimpleAgentBadge('documentacao-tecnica', 'error');
    showToast('Erro na Documentação Técnica: ' + (error || ''), true);
  }
}

function renderDocumentacaoTecnicaResult(status) {
  // `skipped` carrega só os grandes de verdade; os inalterados vêm à parte.
  const grandes     = status.skipped     || [];
  const inalterados = status.inalterados || [];
  const errors      = status.errors      || [];

  renderAgenteIssueList('documentacao-tecnica-grandes-list', grandes,
                        'Nenhum arquivo muito grande.');
  renderAgenteIssueList('documentacao-tecnica-inalterados-list', inalterados,
                        'Nenhum arquivo pulado por estar inalterado.');
  renderAgenteIssueList('documentacao-tecnica-error-list', errors, 'Nenhum erro.');

  document.getElementById('documentacao-tecnica-tab-grandes').textContent =
    grandes.length ? `Arquivos muito grandes (${grandes.length})` : 'Arquivos muito grandes';
  document.getElementById('documentacao-tecnica-tab-inalterados').textContent =
    inalterados.length ? `Inalterados (${inalterados.length})` : 'Inalterados';
  document.getElementById('documentacao-tecnica-tab-erros').textContent =
    errors.length ? `Erros (${errors.length})` : 'Erros';
}
