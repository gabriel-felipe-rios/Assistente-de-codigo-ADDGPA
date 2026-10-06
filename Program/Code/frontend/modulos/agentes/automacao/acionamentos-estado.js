// ══ AUTOMAÇÃO → o estado de cada rotina na tela ═══════════════════════════
//
// Os interruptores repintados a partir das settings, e a faixa de retomada —
// o aviso de que ficou trabalho pendente do ciclo anterior.
//
// ⚠️ A FAIXA DISPENSADA SÓ SOME NESTA SESSÃO. O registro continua no disco, e
// ela volta na próxima abertura enquanto houver o que retomar. Dispensar é
// "não me mostre agora", nunca "resolvido" — apagar o registro no clique faria
// o trabalho pendente sumir com o aviso dele.
//
// ⚠️ `_AC_NAO_AGENTES` LISTA O QUE NÃO É ROTINA (espera, detector, hashes,
// sincronia). Os quatro aparecem na mesma tela e têm interruptor, mas nenhum
// deles produz artefato — tratá-los como rotina faria a contagem e a fila de
// pendências mentirem.
function _acRenderToggles() {
  document.querySelectorAll('.ac-toggle[data-agent]').forEach(btn => {
    const active = (_acSettings[btn.dataset.agent] || 'off') !== 'off';
    btn.classList.toggle('active', active);
    btn.textContent = active ? 'Ativado' : 'Desativado';
  });
  _acPintarBase();
}

// A base não tem interruptor, mas TEM estado: ela acende quando qualquer
// rotina abaixo está ligada. Mostrar isso acontecendo é o que impede o clique
// num toggle qualquer de parecer ter feito mais do que o pedido — três linhas
// mudam de cara e nenhuma delas foi clicada.
function _acPintarBase() {
  const acesa = _acAlgumaLigada();
  document.querySelectorAll('.ac-toggle.fixo[data-agent-fixo]').forEach(selo => {
    selo.classList.toggle('active', acesa);
    selo.title = acesa
      ? 'roda em todo ciclo — não se liga nem se desliga'
      : 'vai rodar assim que qualquer rotina abaixo for ligada';
  });
}

function _acAlgumaLigada() {
  return Object.entries(_acSettings)
    .some(([k, v]) => !_AC_NAO_AGENTES.includes(k) && v !== 'off');
}

// As chaves que NÃO contam como "tem agente ligado" — o mesmo recorte que o
// backend faz em `_AC_NAO_AGENTES`. A Espera é o freio, não um agente; a base
// (Detector, Hashes e Sincronia) não se escolhe, então nenhuma das três pode
// sozinha responder "há trabalho a fazer".
const _AC_NAO_AGENTES = ['espera', 'detector', 'hashes', 'sincronia'];

// ── Faixa de retomada ───────────────────────────────────────────────────
//
// `Pendências.json` guardava o que ficou devendo desde sempre, e nada no
// programa lia esse arquivo. Era um registro perfeito de um problema que o
// usuário só descobria contando pastas na mão.

let _acPendenciasDispensadas = false;

async function _acCarregarPendencias() {
  const faixa = document.getElementById('ac-retomar');
  if (!faixa) return;
  if (_acPendenciasDispensadas) { faixa.classList.add('hidden'); return; }
  try {
    const r = await window.pywebview.api.get_rotinas_pendencias(currentProject);
    if (!r || !r.success || !r.tem_pendencia) { faixa.classList.add('hidden'); return; }

    const n = r.quantos || 0;
    const onde = r.parou_em ? (AC_NOMES_AGENTES[r.parou_em] || r.parou_em) : null;
    const texto = document.getElementById('ac-retomar-texto');
    texto.innerHTML = onde
      ? `O último ciclo parou em <strong>${escapeHtml(onde)}</strong> — ${escapeHtml(r.motivo || 'não chegou ao fim')}. `
        + `Ficaram <strong>${n}</strong> rotina${n !== 1 ? 's' : ''} sem rodar.`
      : `O último ciclo não chegou ao fim. Ficaram <strong>${n}</strong> rotina${n !== 1 ? 's' : ''} sem rodar.`;
    faixa.classList.remove('hidden');
    _acWirePendencias();
  } catch (e) { faixa.classList.add('hidden'); }
}

function _acWirePendencias() {
  const retomar = document.getElementById('btn-ac-retomar');
  if (retomar && !retomar._acWired) {
    retomar._acWired = true;
    retomar.addEventListener('click', async () => {
      // Retomar é recomeçar rotinas: mesma trava dos botões do topo.
      if (typeof travaIALiberado === 'function' && !await travaIALiberado('rotinas')) return;
      if (typeof travaIAOcupadoLocal === 'function') travaIAOcupadoLocal(retomar, true);
      else retomar.disabled = true;
      try {
        const r = await window.pywebview.api.retomar_rotinas_pendencias(currentProject);
        if (!r || !r.success) {
          showToast('Não deu para retomar: ' + ((r && r.error) || 'erro desconhecido'), true);
        } else if (r.retomado) {
          // ⚠️ `retomado` vem ANTES de `aviso`, e a ordem inverteu de
          // propósito. Desde que o ciclo passou a ser ENFILEIRADO em vez de
          // recusado, os dois chegam juntos: a retomada FOI aceita e só não
          // começou ainda. Com o `aviso` na frente, a faixa "há pendências"
          // continuava na tela e o toast dizia em vermelho que nada tinha
          // sido feito — para um ciclo que ia rodar minutos depois.
          showToast(r.aviso || ('Retomando ' + r.agentes.length + ' rotina(s).'));
          document.getElementById('ac-retomar').classList.add('hidden');
        } else if (r.aviso) {
          // A única recusa que sobrou: este projeto já tem um ciclo na fila.
          showToast(r.aviso, true);
        } else {
          showToast('Não havia nada pendente.');
          document.getElementById('ac-retomar').classList.add('hidden');
        }
      } finally {
        if (typeof travaIAOcupadoLocal === 'function') travaIAOcupadoLocal(retomar, false);
        else retomar.disabled = false;
        if (typeof atualizarTravaIA === 'function') atualizarTravaIA();
      }
    });
  }
  const dispensar = document.getElementById('btn-ac-retomar-dispensar');
  if (dispensar && !dispensar._acWired) {
    dispensar._acWired = true;
    dispensar.addEventListener('click', () => {
      // Só para esta sessão: o registro continua no disco, e a faixa volta
      // na próxima abertura enquanto houver o que retomar.
      _acPendenciasDispensadas = true;
      document.getElementById('ac-retomar').classList.add('hidden');
    });
  }
}
