// ══════════════════════════════════════════════════════ AGENTE: HASHES ══
// Determinístico. Guarda o md5 do conteúdo de cada arquivo para que a
// Documentação Técnica saiba o que mudou e pule o resto.

let _hashesRunning = false;

async function initHashesCard() {
  _initSimpleAgentCard('hashes', _hashesRunning);
  // Dois verbos separados — ver o comentário no template.
  //   · Verificar             → olha e relata, sem escrever nada;
  //   · Verificar e processar → olha, relata e chama o ciclo com o que achou.
  _hashesLigarBotao('btn-verificar-hashes', false);
  _hashesLigarBotao('btn-run-hashes', true);
  const r = await window.pywebview.api.get_hashes_status(currentProject);
  _setSimpleAgentBadge('hashes', r.existe ? 'done' : 'idle');
  _updateAgentSummary('hashes', 0, 0, r.total || 0);
  const sum = document.getElementById('hashes-summary');
  if (sum) sum.textContent = r.existe ? `${r.total} arquivos` : '';
  document.getElementById('hashes-result-area').classList.add('hidden');
  _loadHashesTree();
}

function _hashesLigarBotao(botaoId, processar) {
  const btn = document.getElementById(botaoId);
  if (!btn || btn._wired) return;
  btn._wired = true;
  btn.addEventListener('click', () => runHashesAgent(processar));
}

async function runHashesAgent(processar) {
  if (_hashesRunning) return;
  // "Verificar e processar" manda rodar o ciclo, e o ciclo chama o LM Studio:
  // a mesma trava de cinco pontas dos outros botões que geram. "Verificar" só
  // lê o disco, e não precisa dela.
  // ⚠️ Variante "qualquer dono", como nos outros catorze: este botão é da ponta
  // `rotinas`, a MESMA que o ciclo automático toma. Pela regra normal ele
  // responderia "pode" durante o próprio ciclo.
  if (processar && !await rotinaCliqueLiberado()) return;
  _hashesRunning = true;
  _setSimpleAgentBadge('hashes', 'running');
  document.getElementById('hashes-progress-area').classList.remove('hidden');
  document.getElementById('hashes-result-area').classList.add('hidden');
  _hashesBotoes(true);
  await window.pywebview.api.verificar_hashes(currentProject, !!processar);
}

function _hashesBotoes(ocupado) {
  ['btn-verificar-hashes', 'btn-run-hashes'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.disabled = ocupado;
  });
}

// Três desfechos, e eles não são a mesma coisa:
//   · `verificado` — os botões do card. NÃO regravou a linha de base;
//   · `done`       — a rotina de verdade, rodada pelo ciclo. Regravou;
//   · `error`      — nem uma coisa nem outra.
function hashesAgentProgress(data) {
  if (!['done', 'error', 'verificado'].includes(data.status)) return;
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (data.project && data.project !== currentProject) return;
  _hashesRunning = false;
  const area = document.getElementById('hashes-result-area');
  if (!area) return;   // a sub-aba pode estar fechada — o ciclo também roda isto
  document.getElementById('hashes-progress-area').classList.add('hidden');
  area.classList.remove('hidden');
  _hashesBotoes(false);

  const resumo = document.getElementById('hashes-result-summary');
  if (data.status === 'error') {
    _setSimpleAgentBadge('hashes', 'error');
    resumo.textContent = 'Erro: ' + data.error;
    return;
  }

  _setSimpleAgentBadge('hashes', 'done');
  const sum = document.getElementById('hashes-summary');
  if (sum) sum.textContent = `${data.total} arquivos`;

  if (data.status === 'done') {
    resumo.textContent =
      `${data.total} arquivos · ${data.mudados} mudaram desde a última passada.`;
  } else if (data.aviso) {
    resumo.textContent = `${data.mudados} arquivo(s) diferente(s) da última passada. `
      + `O ciclo não começou: ${data.aviso}`;
  } else if (data.processar) {
    resumo.textContent = `${data.mudados} arquivo(s) diferente(s) da última passada — `
      + 'o ciclo está tratando esses arquivos agora.';
  } else {
    // A frase precisa DIZER que a base não foi regravada: é a diferença entre
    // este botão e o outro, e sem ela clicar duas vezes e ver o mesmo número
    // pareceria defeito.
    resumo.textContent = `${data.mudados} arquivo(s) diferente(s) da última passada. `
      + 'A linha de base não foi regravada — clique em "Verificar e processar" '
      + 'para o ciclo tratá-los.';
  }
  _loadHashesTree();
}

// A árvore não é persistida — é montada aqui a partir do JSON único. Um dado,
// um lugar: duas cópias do mesmo dado dessincronizam e não dá para saber qual
// está certa.
async function _loadHashesTree() {
  const el = document.getElementById('hashes-tree');
  if (!el) return;
  const r = await window.pywebview.api.get_hashes_tree(currentProject);
  if (!r.success || !r.arvore) {
    el.innerHTML = '<p class="agente-viewer-empty">Nenhum hash gerado ainda.</p>';
    return;
  }
  el.innerHTML = '';
  const legenda = document.createElement('p');
  legenda.className = 'hash-legenda';
  legenda.textContent = r.gerado_em
    ? 'Gerado em ' + new Date(r.gerado_em).toLocaleString('pt-BR')
    : 'Ainda não gerado';
  el.appendChild(legenda);
  el.appendChild(_hashNo(r.arvore, true));
}

function _hashNo(no, raiz) {
  const box = document.createElement('div');
  box.className = raiz ? 'hash-raiz' : 'hash-pasta';

  if (!raiz && no.nome) {
    const titulo = document.createElement('div');
    titulo.className = 'hash-pasta-nome';
    titulo.textContent = '📁 ' + no.nome;
    box.appendChild(titulo);
  }

  (no.arquivos || []).forEach(a => {
    const linha = document.createElement('div');
    linha.className = 'hash-arquivo hash-' + a.estado;
    const nome = document.createElement('span');
    nome.className = 'hash-nome';
    nome.textContent = a.nome;
    const h = document.createElement('span');
    h.className = 'hash-valor';
    h.textContent = a.hash;
    const est = document.createElement('span');
    est.className = 'hash-estado';
    est.textContent = { igual: '✓ igual', mudou: '⟳ mudou',
                        novo: '+ novo', removido: '− removido' }[a.estado] || a.estado;
    linha.appendChild(nome);
    linha.appendChild(h);
    linha.appendChild(est);
    box.appendChild(linha);
  });

  (no.pastas || []).forEach(p => box.appendChild(_hashNo(p, false)));
  return box;
}
