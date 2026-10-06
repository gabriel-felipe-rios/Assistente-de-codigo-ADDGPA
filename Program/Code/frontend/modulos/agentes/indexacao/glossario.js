// ═══════════════════════════════════════════════════ AGENTE: GLOSSÁRIO ══
// A metade do antigo Índice que fazia sentido: os termos próprios do projeto.
// A lista de funções e classes saiu daqui e virou o Índice de Navegação,
// determinístico.

let _glossarioRunning = false;

async function initGlossarioCard() {
  _initSimpleAgentCard('glossario', _glossarioRunning);
  const btn = document.getElementById('btn-run-glossario');
  if (btn && !btn._wired) {
    btn._wired = true;
    btn.addEventListener('click', runGlossarioAgent);
    ligarBotaoDePrompt('glossario');
  }
  const r = await window.pywebview.api.get_glossario_status(currentProject);
  _selarPeloStatus('glossario', r);
  _loadSimpleAgentViewer('glossario');
  document.getElementById('glossario-result-area').classList.add('hidden');
}

async function runGlossarioAgent() {
  if (_glossarioRunning) return;
  // ⚠️ A trava de cinco pontas, ANTES de ligar a flag e apagar o botão: assim
  // uma recusa não deixa a tela em estado de "rodando" que ninguém desfaz.
  // Variante "qualquer dono": este botão é da ponta `rotinas`, a MESMA que o
  // ciclo automático toma — pela regra normal ele ficaria aceso durante ele.
  if (!await rotinaCliqueLiberado('glossario')) return;
  _glossarioRunning = true;
  _setSimpleAgentBadge('glossario', 'running');
  document.getElementById('glossario-progress-area').classList.remove('hidden');
  document.getElementById('glossario-result-area').classList.add('hidden');
  document.getElementById('btn-run-glossario').disabled = true;
  // Sem modelo: o backend usa o que esta carregado no LM Studio.
  const _r = await window.pywebview.api.rodar_glossario_pelo_card(currentProject);
  // ⚠️ O RETORNO É LIDO. Entre a pergunta lá em cima e esta chamada, outra
  // ponta pode ter tomado a janela — e a recusa precisa desfazer o que o
  // clique já tinha ligado, senão o ▶ fica apagado até sair e voltar da aba.
  if (rotinaCardRecusado('glossario', _r)) return;
}

function glossarioAgentProgress(data) {
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (data.project && data.project !== currentProject) return;
  if (data.status === 'running') {
    const total = data.total || 0;
    // ⚠️ A BARRA CONTA O TRABALHO REAL, não os termos visitados.
    //
    // `total` é quantos termos EXISTEM, e `processed` conta todos os que
    // passaram — inclusive os reaproveitados do cache, que voltam
    // instantaneamente. Numa passada em que 19 de 20 vinham do cache, a barra
    // ia de 0 a 100% em segundos e prometia um trabalho que não existia.
    //
    // `a_processar` é quantos vão mesmo ao modelo, e o numerador é
    // `gerados + falhas`: o termo que falhou não gera nada, mas já gastou a
    // ida ao modelo — sem contá-lo, a barra travaria antes do fim.
    //
    // `|| total` é o degrau para o instante em que o denominador ainda não
    // foi calculado (a descoberta dos termos vem antes dele).
    const alvo = data.a_processar != null ? data.a_processar : total;
    const feitos = (data.gerados || 0) + (data.falhas || 0);
    const pct = alvo > 0 ? Math.round((feitos / alvo) * 100) : 0;
    const bar = document.getElementById('glossario-progress-bar');
    if (bar) bar.style.width = pct + '%';
    const count = document.getElementById('glossario-progress-count');
    if (count) count.textContent = alvo ? `${feitos} / ${alvo}` : '';
    // O rótulo diz o que está acontecendo, e não só que algo acontece. Uma
    // passada em que quase tudo vem do cache voa de 0 a 20 e parecia, de fora,
    // que o Glossário tinha jogado o trabalho anterior fora e refeito tudo.
    // Ele não refaz: o termo cujo dossiê não mudou é reaproveitado, e só o que
    // mudou (ou o que falhou na vez passada) volta para o modelo.
    const partes = [];
    if (data.gerados)        partes.push(`${data.gerados} gerado${data.gerados !== 1 ? 's' : ''}`);
    if (data.reaproveitados) partes.push(`${data.reaproveitados} reaproveitado${data.reaproveitados !== 1 ? 's' : ''}`);
    if (data.falhas)         partes.push(`${data.falhas} com erro`);
    document.getElementById('glossario-progress-label').textContent =
      !total ? 'Descobrindo termos...'
             : (partes.length ? `Definindo termos — ${partes.join(' · ')}` : 'Definindo termos...');
    const cur = document.getElementById('glossario-current-term');
    if (cur) cur.textContent = data.current || '';
    return;
  }

  _glossarioRunning = false;
  document.getElementById('glossario-progress-area').classList.add('hidden');
  document.getElementById('glossario-result-area').classList.remove('hidden');
  document.getElementById('btn-run-glossario').disabled = false;

  if (data.status === 'done') {
    _setSimpleAgentBadge('glossario', 'done');
    const termos = data.termos || 0;
    const gerados = data.gerados || 0;
    const reap = data.reaproveitados || 0;
    // Os termos que falharam entram AQUI, junto do resultado. O Glossário não
    // tem aba Erros — o resumo é a superfície dele. Um termo que falha não
    // derruba mais o glossário inteiro: a definição anterior dele fica, e o
    // hash não é atualizado, então a próxima passada tenta de novo.
    const erros = data.erros || [];
    document.getElementById('glossario-result-summary').innerHTML =
      `<span class="agente-stat agente-stat-ok">✓ ${termos} termo${termos !== 1 ? 's' : ''}</span>` +
      `<span class="agente-stat">${gerados} definido${gerados !== 1 ? 's' : ''} · ${reap} reaproveitado${reap !== 1 ? 's' : ''}</span>` +
      (erros.length
        ? `<span class="agente-stat agente-stat-err" title="${erros.map(e => `${e.termo}: ${e.reason}`).join(' | ').replace(/"/g, '&quot;')}">✗ ${erros.length} sem definir</span>`
        : '');
    _loadSimpleAgentViewer('glossario');
  } else {
    _setSimpleAgentBadge('glossario', 'error');
    document.getElementById('glossario-result-summary').textContent = 'Erro: ' + data.error;
  }
}
