// ══════════════════════════════════════════════════════ ROTINA: DETECTOR ══
// Determinístico. Vê o que mudou e decide quais rotinas isso merece — é o
// gatilho do ciclo, não uma etapa dele.
//
// A aba Processar deste card responde a uma pergunta só: **ele está decidindo
// certo?** Por isso o que ela mostra não é a lista de arquivos (cem linhas de
// caminho não respondem nada), e sim a contagem por CLASSE de mudança, com o
// que cada classe acordou.

let _detectorRodando = false;

// Nome de exibição de cada classe. Fica aqui, e não no backend, pelo mesmo
// motivo que `AC_NOMES_AGENTES`: o backend manda o id, a tela sabe o rótulo.
const DET_NOMES_CLASSES = {
  'vazio':            'Arquivo vazio criado',
  'so-imports':       'Criado só com imports',
  'movido':           'Renomeado ou movido',
  'apagado':          'Apagado',
  'cosmetico':        'Só comentário / docstring',
  'espaco-em-branco': 'Só espaço / indentação',
  'codigo':           'Código alterado',
  'estrutura':        'Estrutura alterada (assinatura)',
  'import':           'Estrutura alterada (import)',
  'constante':        'Só constante / cor / texto de UI',
  'nao-codigo':       'Não-código alterado',
  'gemeo':            'Gêmeo',
};

// ⚠️ O gêmeo não acorda "ninguém" no sentido de "nada acontece": a
// Documentação Técnica entra, mas COPIA a saída do gêmeo em vez de gerar.
// Mostrar só "Doc. Técnica" faria a tabela parecer contradizer a
// economia que ela existe para provar.
const DET_TEXTO_GEMEO = 'copia a saída do gêmeo — sem LLM';

async function initDetectorCard() {
  _initSimpleAgentCard('detector', _detectorRodando);
  const btn = document.getElementById('btn-run-detector');
  if (btn && !btn._wired) {
    btn._wired = true;
    btn.addEventListener('click', runDetectorAgent);
  }
  const r = await window.pywebview.api.get_detector_mudancas(currentProject);
  _detectorPintar(r);
  _loadSimpleAgentViewer('detector');
}

async function runDetectorAgent() {
  if (_detectorRodando) return;
  // ⚠️ A trava de cinco pontas, ANTES de ligar a flag e apagar o botão: assim
  // uma recusa não deixa a tela em estado de "rodando" que ninguém desfaz.
  // Variante "qualquer dono": este botão é da ponta `rotinas`, a MESMA que o
  // ciclo automático toma — pela regra normal ele ficaria aceso durante ele.
  if (!await rotinaCliqueLiberado()) return;
  _detectorRodando = true;
  _setSimpleAgentBadge('detector', 'running');
  document.getElementById('detector-progress-area').classList.remove('hidden');
  document.getElementById('detector-result-area').classList.add('hidden');
  document.getElementById('btn-run-detector').disabled = true;
  const _r = await window.pywebview.api.rodar_detector_pelo_card(currentProject);
  // ⚠️ O RETORNO É LIDO. Entre a pergunta lá em cima e esta chamada, outra
  // ponta pode ter tomado a janela — e a recusa precisa desfazer o que o
  // clique já tinha ligado, senão o ▶ fica apagado até sair e voltar da aba.
  if (rotinaCardRecusado('detector', _r)) return;
}

function detectorAgentProgress(data) {
  if (!data || data.status === 'running') return;
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (data.project && data.project !== currentProject) return;
  _detectorRodando = false;
  const btn = document.getElementById('btn-run-detector');
  if (!btn) return;   // a sub-aba pode estar fechada — ele roda pelo ciclo também
  btn.disabled = false;
  document.getElementById('detector-progress-area').classList.add('hidden');

  if (data.status === 'error') {
    _setSimpleAgentBadge('detector', 'error');
    document.getElementById('detector-result-area').classList.remove('hidden');
    document.getElementById('detector-result-summary').textContent =
      'Erro: ' + (data.error || 'desconhecido');
    return;
  }
  // Relê do disco em vez de usar o payload: o resumo do evento traz só as
  // contagens, e a tabela precisa das classes.
  window.pywebview.api.get_detector_mudancas(currentProject).then(_detectorPintar);
}

function _detectorPintar(r) {
  if (!r || !r.success) return;
  const area = document.getElementById('detector-result-area');
  if (!area) return;

  _setSimpleAgentBadge('detector', r.existe ? 'done' : 'idle');

  const sum = document.getElementById('detector-summary');
  if (sum) {
    sum.textContent = r.existe
      ? `${r.total} mudança${r.total !== 1 ? 's' : ''} na última passada`
      : '';
  }
  const ultima = document.getElementById('detector-ultima');
  if (ultima) {
    ultima.textContent = r.gerado_em
      ? 'última passada: ' + new Date(r.gerado_em).toLocaleString('pt-BR')
      : '';
  }

  if (!r.existe) { area.classList.add('hidden'); return; }
  area.classList.remove('hidden');

  const resumo = document.getElementById('detector-result-summary');
  if (resumo) {
    // Duas contas diferentes, e a segunda é a que prova a economia: quantas
    // mudanças NÃO acordaram rotina cara nenhuma. Sem ela a tabela mostra o
    // trabalho e esconde o trabalho evitado, que é o ponto da Etapa 2.
    const mudas = (r.classes || [])
      .filter(l => !(l.acorda || []).length)
      .reduce((n, l) => n + l.arquivos, 0);
    if (!r.total) {
      resumo.textContent = 'Nada mudou desde a última passada.';
    } else {
      resumo.textContent =
        `${r.total} mudança${r.total !== 1 ? 's' : ''} classificada${r.total !== 1 ? 's' : ''}`
        + (mudas ? ` — ${mudas} não acordou rotina nenhuma.` : '.');
    }
  }
  _detectorTabela(r.classes || []);
}

// Uma tabela montada no DOM, e não com innerHTML: `acorda` e o nome da classe
// vêm do backend, e concatenar HTML com dado de fora é como se escreve o
// próximo bug de escape.
function _detectorTabela(classes) {
  const alvo = document.getElementById('detector-classes');
  if (!alvo) return;
  alvo.innerHTML = '';
  if (!classes.length) return;

  const tabela = document.createElement('table');
  tabela.className = 'agente-viewer-table';
  const thead = document.createElement('thead');
  const cab = document.createElement('tr');
  ['Classe da mudança', 'Arquivos', 'O que acordou'].forEach(texto => {
    const th = document.createElement('th');
    th.textContent = texto;
    cab.appendChild(th);
  });
  thead.appendChild(cab);
  tabela.appendChild(thead);

  const tbody = document.createElement('tbody');
  classes.forEach(linha => {
    const tr = document.createElement('tr');
    const nome = document.createElement('td');
    nome.textContent = DET_NOMES_CLASSES[linha.classe] || linha.classe;
    const n = document.createElement('td');
    n.textContent = linha.arquivos;
    const acorda = document.createElement('td');
    acorda.textContent = linha.classe === 'gemeo'
      ? DET_TEXTO_GEMEO
      : ((linha.acorda || [])
          .map(id => (typeof AC_NOMES_AGENTES !== 'undefined' && AC_NOMES_AGENTES[id]) || id)
          .join(' · ') || 'ninguém');
    tr.appendChild(nome);
    tr.appendChild(n);
    tr.appendChild(acorda);
    tbody.appendChild(tr);
  });
  tabela.appendChild(tbody);
  alvo.appendChild(tabela);
}
