// ═══════════════════════ ABA: INSPETOR — revisão do fluxo gravado ══
// A linha do tempo dos passos resolvidos (âncora + teia), a troca de âncora e
// a cópia do relatório do fluxo. Separado de `inspetor-gravacao.js` pelo teto
// de linhas da AMF. Backend: inspetor_gravacao_teia.py / _relatorio.py.

function _gravRenderTimeline() {
  const lista = document.getElementById('insp-grav-lista');
  const envio = document.getElementById('insp-grav-envio');

  if (!_gravPassos.length) {
    // Sem teia resolvida ainda: a lista crua continua valendo, e copiar
    // também — resolver é opcional.
    _gravRedesenharAoVivo();
    envio.classList.toggle('hidden', !_gravRaw.length);
    _gravAtualizarCorte();
    return;
  }
  document.getElementById('insp-grav-empty').classList.add('hidden');
  lista.innerHTML = _gravPassos.map(_gravStepHtml).join('');
  envio.classList.remove('hidden');
  _gravAtualizarCorte();
}

// O relatório leva no máximo GRAV_MAXIMO_PASSOS_NO_RELATORIO passos. Avisar
// aqui, antes de copiar, é o que dá ao usuário a chance de remover os passos
// que não interessam em vez de descobrir o corte depois de colar.
function _gravAtualizarCorte() {
  const total = _gravPassos.length || _gravRaw.length;
  const corte = document.getElementById('insp-grav-corte');
  corte.textContent = total > GRAV_MAXIMO_PASSOS_NO_RELATORIO
    ? `O relatório leva os ${GRAV_MAXIMO_PASSOS_NO_RELATORIO} primeiros de ${total} passos — remova os que não interessam.`
    : '';
}

function _gravStepHtml(p) {
  const a = p.anchor;
  const anchorHtml = a
    ? `<span class="mono grav-anchor-path">${escapeHtml(a.file)}:${escapeHtml(a.line)}</span> — ${escapeHtml(a.name || '')} <span class="grav-dim">(${escapeHtml(a.type || '')})</span>`
    : `<span class="grav-dim">não localizado — a IA localiza pelo nome</span>`;

  const teia = p.teia || {};
  const usa = (teia.relacoes && teia.relacoes.usa) || [];         // arquivos que ele usa
  const usado = (teia.relacoes && teia.relacoes.usado_por) || []; // arquivos que o usam

  // Uma direção = símbolos (nível fino) + arquivos (nível amplo) juntos.
  // → Quem eu uso: o que este código chama.  ← Quem me usa: quem chama este.
  const euUso = _gravColHtml(
    (teia.dispara || []).map(d => `<span class="mono">${escapeHtml(d.name)}</span> <span class="grav-dim">${escapeHtml(d.file)}:${escapeHtml(d.line)}</span>`),
    usa.map(r => r.arquivo));
  const meUsa = _gravColHtml(
    (teia.acionado_por || []).map(u => `<span class="mono grav-anchor-path">${escapeHtml(u.file)}:${escapeHtml(u.line)}</span> <span class="grav-dim">${escapeHtml(u.snippet || '')}</span>`),
    usado.map(r => r.arquivo));

  // Âncora automática: alternativas ficam recolhidas atrás de "não é aqui?".
  const cands = p.candidatos || [];
  let ancoraExtra = '';
  if (cands.length > 1) {
    const chips = cands.map((c, i) => {
      const ativo = a && c.file === a.file && c.line === a.line;
      return `<button class="grav-cand-chip${ativo ? ' ativo' : ''}" onclick="gravTrocarAncora(${p.n}, ${i})">${escapeHtml(c.file)}:${escapeHtml(c.line)}</button>`;
    }).join('');
    ancoraExtra = `<button class="grav-ancora-toggle" onclick="gravToggleAncora(${p.n})" title="Trocar a âncora, se o palpite estiver errado">✎ não é aqui?</button>
      <div class="grav-cands hidden" id="grav-cands-${p.n}">${chips}</div>`;
  }

  return `
    <div class="grav-step${p.sem_nome ? ' grav-sem-nome' : ''}" data-n="${p.n}">
      <div class="grav-step-head">
        <span class="grav-step-num">${p.n}</span>
        <span class="grav-step-rotulo">${p.sem_nome ? '⚠ ' : ''}${escapeHtml(p.rotulo || '')}</span>
        <button class="grav-step-del" onclick="gravRemoverPasso(${p.n})" title="Remover este passo">✕</button>
      </div>
      <div class="grav-step-anchor">Âncora: ${anchorHtml} ${ancoraExtra}</div>
      <div class="grav-teia">
        <div class="grav-teia-col"><div class="grav-teia-title">→ Quem eu uso</div>${euUso}</div>
        <div class="grav-teia-col"><div class="grav-teia-title">← Quem me usa</div>${meUsa}</div>
      </div>
    </div>`;
}

// Uma coluna da teia: linhas de símbolo + uma linha compacta com os arquivos
// (nível amplo). "—" só quando nada nas duas.
function _gravColHtml(simbolos, arquivos) {
  let html = simbolos.map(s => `<div class="grav-teia-item">${s}</div>`).join('');
  if (arquivos.length) {
    html += `<div class="grav-teia-files"><span class="grav-dim">arquivos:</span> ${arquivos.map(f => `<span class="mono">${escapeHtml(f)}</span>`).join(', ')}</div>`;
  }
  return html || '<div class="grav-teia-vazio">—</div>';
}

function gravToggleAncora(n) {
  const el = document.getElementById(`grav-cands-${n}`);
  if (el) el.classList.toggle('hidden');
}

function _gravAcharPasso(n) { return _gravPassos.find(p => p.n === n); }

function gravRemoverPasso(n) {
  // Sai das duas listas: o cru é o que alimenta uma nova resolução e a cópia
  // sem teia — deixá-lo lá faria o passo removido reaparecer.
  _gravPassos = _gravPassos.filter(p => p.n !== n);
  _gravRaw = _gravRaw.filter(p => p.n !== n);
  if (!_gravPassos.length && !_gravRaw.length) {
    const vazio = document.getElementById('insp-grav-empty');
    vazio.classList.remove('hidden');
    vazio.textContent = 'Todos os passos foram removidos.';
    document.getElementById('insp-grav-lista').innerHTML = '';
    document.getElementById('insp-grav-envio').classList.add('hidden');
  } else {
    _gravRenderTimeline();
  }
  _gravSincronizarBotoes();
  _gravAtualizarStatus();
}

async function gravTrocarAncora(n, idx) {
  const p = _gravAcharPasso(n);
  if (!p || !p.candidatos || !p.candidatos[idx]) return;
  p.anchor = p.candidatos[idx];
  const r = await window.pywebview.api.inspetor_gravacao_teia(currentProject, p.anchor);
  p.teia = (r && r.success) ? r.teia : { dispara: [], acionado_por: [], relacoes: {} };
  _gravRenderTimeline();
}

// ── Copiar o fluxo ──────────────────────────────────────────────────────────
// Nem instrução nem teia resolvida são pré-requisito: sem instrução o
// relatório sai só com o contexto, e sem teia sai com os passos e o elemento
// de cada um, que já é o essencial do fluxo.
async function gravCopiar() {
  const passos = _gravPassos.length ? _gravPassos : _gravPassosCrusParaRelatorio();
  if (!passos.length) { showToast('Nenhum passo pra copiar.', true); return; }
  const instrucao = document.getElementById('insp-grav-instrucao').value.trim();

  const btn = document.getElementById('insp-grav-copiar');
  btn.disabled = true;
  const r = await window.pywebview.api.inspetor_montar_relatorio_gravacao(
    currentProject, passos, instrucao);
  btn.disabled = false;
  if (!r || !r.success) {
    showToast((r && r.error) || 'Não foi possível montar o relatório.', true);
    return;
  }
  try {
    await navigator.clipboard.writeText(r.texto);
    const original = btn.textContent;
    btn.textContent = '✓ Copiado!';
    setTimeout(() => { btn.textContent = original; }, 1500);
  } catch (e) {
    showToast('Não foi possível copiar automaticamente — selecione o texto manualmente.', true);
  }
}

// Passo cru no formato que o relatório espera, para copiar sem ter resolvido
// a teia. Sem âncora e sem teia — o relatório já sabe lidar com a ausência das
// duas ("não localizado — a IA localiza pelo nome acima").
function _gravPassosCrusParaRelatorio() {
  return _gravRaw.map(p => ({
    n: p.n,
    acao: p.acao,
    sem_nome: p.sem_nome,
    rotulo: p.rotulo,
    elemento: (p.relatorio && p.relatorio.uia) || {},
    candidatos: [],
    anchor: null,
    teia: {},
  }));
}
