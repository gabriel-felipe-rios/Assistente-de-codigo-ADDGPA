// ══════════════════════════════════════════════════ AGENTE: EMBEDDING SEMÂNTICO ══

function initEmbeddingCard() {
  const toggle  = document.getElementById('embedding-toggle');
  const body    = document.getElementById('embedding-body');
  const chevron = document.getElementById('embedding-chevron');
  if (!toggle) return;

  // ⚠️ Fora da guarda `_embWired`, e de propósito. Esta era a única rotina cujo
  // selo só saía do "Pronto" do HTML quando o usuário EXPANDIA o card: o init
  // ligava os listeners e ia embora sem nunca perguntar o estado. Com o
  // Embedding em dia e o card fechado, ele mentia "Pronto" indefinidamente —
  // e ao abrir, "atualizava sozinho", o que dava a impressão de que o clique
  // é que tinha feito alguma coisa. Chamar sempre é o que faz o selo valer
  // também no `_syncRotinasCards` e a cada volta do poll.
  _embLoadPreview();

  if (toggle._embWired) return;
  toggle._embWired = true;

  toggle.addEventListener('click', async () => {
    const open = !body.classList.contains('hidden');
    body.classList.toggle('hidden', open);
    chevron.classList.toggle('open', !open);
    if (!open) await _embLoadPreview();
  });

  document.getElementById('btn-run-embedding').addEventListener('click', runEmbeddingAgent);
}

const _EMB_TIPOS = [
  { id: 'documentacao-tecnica', nome: 'Doc Técnica' },
  { id: 'resumo-pastas',        nome: 'Resumo de Pastas' },
];

async function _embLoadPreview() {
  const label = document.getElementById('embedding-preview-label');
  if (!label) return;
  label.textContent = 'Verificando...';

  const linhas = [];
  let algumFonte = false;
  let pendentes = 0;
  for (const t of _EMB_TIPOS) {
    const r = await window.pywebview.api.preview_embedding_agent(currentProject, t.id);
    if (!r.success) continue;
    if (r.total === 0) {
      linhas.push(`${t.nome}: fonte ausente`);
      continue;
    }
    algumFonte = true;
    pendentes += r.to_process;
    linhas.push(r.to_process === 0
      ? `${t.nome}: ${r.total} — atualizado`
      : `${t.nome}: ${r.to_process}/${r.total} para processar`);
  }

  label.innerHTML = linhas.join('<br>') || 'Nenhuma fonte encontrada.';
  // Pelo helper, e não por `className` na mão: os selos deste card eram os
  // únicos escritos à parte, e por isso ficaram de fora quando os estados
  // 'parcial' e 'esperando' entraram. Um estado, um lugar.
  _setSimpleAgentBadge('embedding', (algumFonte && pendentes === 0) ? 'done' : 'idle');
}

// ── O progresso, ao vivo ────────────────────────────────────────────────────
//
// ⚠️ Até 2026-08-26 esta função NÃO EXISTIA, e o card era o único do programa
// sem barra: `run_embedding_agent` era uma chamada bloqueante que só falava no
// fim, e os números do preview só mudavam entrando e saindo do card. Com o
// índice fatiado da Etapa 3 a passada ficou bem mais longa, e uma tela parada
// por minutos é indistinguível de uma tela travada.
function embeddingAgentProgress(data) {
  if (!data) return;
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (data.project && data.project !== currentProject) return;
  const label = document.getElementById('embedding-progress-label');
  if (label && data.etapa) label.textContent = data.etapa;

  const aProcessar = _pintarProgressoDuplo('embedding', data);
  // O mesmo `N / M` que aparece na linha da rotina em Acionamentos.
  if (typeof _acUpdateAgentCount === 'function') {
    _acUpdateAgentCount('embedding', data.processed, aProcessar);
  }
  const atual = document.getElementById('embedding-current-file');
  if (atual) atual.textContent = data.current || '';
}

async function runEmbeddingAgent() {
  // ⚠️ A trava de cinco pontas, ANTES de ligar a flag e apagar o botão: assim
  // uma recusa não deixa a tela em estado de "rodando" que ninguém desfaz.
  // Variante "qualquer dono": este botão é da ponta `rotinas`, a MESMA que o
  // ciclo automático toma — pela regra normal ele ficaria aceso durante ele.
  if (!await rotinaCliqueLiberado('embedding')) return;
  const summary       = document.getElementById('embedding-summary');
  const progress      = document.getElementById('embedding-progress-area');
  const label         = document.getElementById('embedding-progress-label');
  const result        = document.getElementById('embedding-result-area');
  const resultSummary = document.getElementById('embedding-result-summary');

  // 'Rodando' era o único rótulo fora do vocabulário: as outras rotinas
  // dizem 'Executando...', e a legenda da sub-aba também.
  _setSimpleAgentBadge('embedding', 'running');
  summary.textContent = '';
  progress.classList.remove('hidden');
  label.textContent = 'Iniciando...';
  // Zera a barra da passada anterior: sem isto, a segunda execução começaria
  // com a barra cheia da primeira enquanto o rótulo diz "Iniciando...".
  embeddingAgentProgress({ a_processar: null });
  result.classList.add('hidden');

  const r = await window.pywebview.api.rodar_embedding_pelo_card(currentProject);
  // ⚠️ Este card já lia o retorno — foi o único dos quinze que lia. O que falta
  // é distinguir a RECUSA DA TRAVA do erro da rotina: entre a pergunta lá em
  // cima e esta chamada, outra ponta pode ter tomado a janela, e aí o card não
  // falhou, ele nem chegou a rodar.
  if (rotinaCardRecusado('embedding', r)) return;

  progress.classList.add('hidden');
  if (typeof _acUpdateAgentCount === 'function') {
    _acUpdateAgentCount('embedding', null, null);
  }

  if (!r.success) {
    _setSimpleAgentBadge('embedding', 'error');
    resultSummary.textContent = r.error || 'Erro desconhecido';
    result.classList.remove('hidden');
    return;
  }

  // Com a contagem de erros: terminar com 3 arquivos falhados é âmbar
  // ("Concluído com 3 erros"), não verde. Era o mesmo defeito que o Espelho
  // (retirado em 2026-09) teve, e este card estava fora da correção por escrever o selo à mão.
  _setSimpleAgentBadge('embedding', 'done', r.errors || 0);

  const parts = [];
  if (r.processed) parts.push(`${r.processed} gerado${r.processed !== 1 ? 's' : ''}`);
  if (r.skipped)   parts.push(`${r.skipped} sem mudança`);
  if (r.errors)    parts.push(`${r.errors} erro${r.errors !== 1 ? 's' : ''}`);

  const text = parts.join(' · ') || 'Nenhum arquivo para processar';
  summary.textContent = text;
  result.classList.remove('hidden');

  let detail = text;
  if (r.error_detail) detail += `\n\nDetalhe: ${r.error_detail}`;
  resultSummary.textContent = detail;

  await _embLoadPreview();
  showToast('Embedding concluído: ' + text);
}
