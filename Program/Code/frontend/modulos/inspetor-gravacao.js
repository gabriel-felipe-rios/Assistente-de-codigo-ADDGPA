// ═══════════════════════════════════════ ABA: INSPETOR — sub-aba GRAVAÇÃO ══
// Grava um fluxo de ações no app-alvo (sem suprimir o clique) e, quando você
// pedir, monta pra cada passo a "teia" de código: o que o botão dispara
// (1 nível) e quem o aciona. Estático, do índice do projeto — erro/runtime é a
// aba Terminal. Também liga o "▶ Executar programa", que é da aba inteira.
// Backend: inspetor_gravacao.py.
//
// "Parar" só para. Resolver a teia é uma ação SEPARADA, com progresso e com
// desistência — antes o Parar disparava as duas coisas em série, sem aviso e
// sem volta, e uma gravação longa travava a tela.

let _gravInited = false;
let _gravEstado = 'ocioso';  // 'ocioso' | 'gravando' | 'resolvendo' | 'revisando'
let _gravRaw = [];           // passos crus recebidos ao vivo do backend
let _gravPassos = [];        // passos resolvidos (com âncora + teia)
let _gravProgresso = null;   // {feito, total} durante a resolução

const GRAV_MAXIMO_PASSOS_NO_RELATORIO = 20;  // espelha INSPETOR_MAXIMO_PASSOS

function initInspetorGravacao() {
  if (_gravInited) return;
  _gravInited = true;

  // Um botão só, da aba inteira: o programa-alvo serve às duas esteiras.
  document.getElementById('insp-executar').addEventListener('click', inspExecutarPrograma);

  document.getElementById('insp-grav-iniciar').addEventListener('click', gravIniciar);
  document.getElementById('insp-grav-parar').addEventListener('click', gravParar);
  document.getElementById('insp-grav-resolver').addEventListener('click', gravResolverTeia);
  document.getElementById('insp-grav-copiar').addEventListener('click', gravCopiar);
  _gravSincronizarBotoes();
}

// Habilita/desabilita os três botões pelo estado. Cada um tem variante de cor
// própria (positive/negative/special), como manda a regra de grupo com 3+.
function _gravSincronizarBotoes() {
  const iniciar = document.getElementById('insp-grav-iniciar');
  const parar = document.getElementById('insp-grav-parar');
  const resolver = document.getElementById('insp-grav-resolver');

  iniciar.disabled = _gravEstado !== 'ocioso' && _gravEstado !== 'revisando';
  parar.disabled = _gravEstado !== 'gravando';
  resolver.disabled = !(_gravEstado === 'resolvendo'
    || (_gravEstado !== 'gravando' && _gravRaw.length > 0));
  resolver.textContent = _gravEstado === 'resolvendo' ? 'Desistir' : 'Resolver a teia';
}

// ── Executar programa (abrir e soltar) ──────────────────────────────────────
async function inspExecutarPrograma() {
  if (!currentProject) { showToast('Abra um projeto primeiro.', true); return; }
  const btn = document.getElementById('insp-executar');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Abrindo...';
  const r = await window.pywebview.api.inspetor_abrir_programa(currentProject);
  btn.disabled = false;
  btn.textContent = original;
  if (!r || !r.success) {
    showToast((r && r.error) || 'Não foi possível abrir o programa.', true);
    return;
  }
  showToast('Programa aberto. Interaja com ele e volte pra capturar/gravar.');
}

// ── Gravar ──────────────────────────────────────────────────────────────────
async function gravIniciar() {
  if (!currentProject) { showToast('Abra um projeto primeiro.', true); return; }
  const r = await window.pywebview.api.inspetor_iniciar_gravacao(
    document.getElementById('insp-grav-mouse-completo').checked,
    document.getElementById('insp-grav-teclado').checked);
  if (!r || !r.success) {
    showToast((r && r.error) || 'Não foi possível iniciar a gravação.', true);
    return;
  }
  _gravEstado = 'gravando';
  _gravRaw = [];
  _gravPassos = [];
  _gravProgresso = null;
  _gravSincronizarBotoes();
  document.getElementById('insp-alvo').textContent = '';
  document.getElementById('insp-grav-dica').classList.remove('hidden');
  document.getElementById('insp-grav-envio').classList.add('hidden');
  document.getElementById('insp-grav-empty').classList.add('hidden');
  document.getElementById('insp-grav-lista').innerHTML = '';
  _gravAtualizarStatus();
}

// "Parar" só para: não resolve nada. A teia é a ação seguinte, e é opcional.
async function gravParar() {
  document.getElementById('insp-grav-parar').disabled = true;
  await window.pywebview.api.inspetor_parar_gravacao();
  document.getElementById('insp-grav-dica').classList.add('hidden');
  _gravEstado = 'revisando';

  if (!_gravRaw.length) {
    _gravEstado = 'ocioso';
    const vazio = document.getElementById('insp-grav-empty');
    vazio.classList.remove('hidden');
    vazio.textContent = 'Nenhum passo gravado. Clique em “Iniciar gravação” e use seu app.';
  } else {
    // A esteira já pode terminar aqui: copiar não espera pela teia.
    _gravRenderTimeline();
  }
  _gravSincronizarBotoes();
  _gravAtualizarStatus();
}

async function gravResolverTeia() {
  if (_gravEstado === 'resolvendo') {
    await window.pywebview.api.inspetor_gravacao_cancelar_resolucao();
    return;  // o resultado parcial chega em 'resolucao_cancelada'
  }
  if (!_gravRaw.length) { showToast('Nenhum passo pra resolver.', true); return; }

  const r = await window.pywebview.api.inspetor_gravacao_resolver(currentProject, _gravRaw);
  if (!r || !r.success) {
    showToast((r && r.error) || 'Não foi possível resolver os passos.', true);
    return;
  }
  _gravEstado = 'resolvendo';
  _gravProgresso = { feito: 0, total: r.total };
  _gravSincronizarBotoes();
  _gravAtualizarStatus();
}

// Recebe passos ao vivo, progresso da resolução e erros (evaluate_js pelo backend).
function inspetorGravacaoEvento(payload) {
  if (!payload) return;

  if (payload.tipo === 'erro') {
    showToast(payload.erro || 'Erro na gravação.', true);
    return;
  }
  if (payload.tipo === 'alvo') {
    document.getElementById('insp-alvo').textContent = `gravando «${payload.processo}»`;
    return;
  }
  if (payload.tipo === 'passo' && _gravEstado === 'gravando') {
    if (payload.substitui) {
      // Duplo clique: substitui o passo do clique simples que veio antes.
      _gravRaw = _gravRaw.filter(p => p.n !== payload.passo.n);
    }
    _gravRaw.push(payload.passo);
    _gravRedesenharAoVivo();
    _gravAtualizarStatus();
    return;
  }
  if (payload.tipo === 'resolvendo') {
    _gravProgresso = { feito: payload.feito, total: payload.total };
    _gravAtualizarStatus();
    return;
  }
  if (payload.tipo === 'resolvido' || payload.tipo === 'resolucao_cancelada') {
    _gravPassos = payload.passos || [];
    _gravEstado = 'revisando';
    _gravProgresso = null;
    _gravSincronizarBotoes();
    _gravRenderTimeline();
    _gravAtualizarStatus();
    if (payload.tipo === 'resolucao_cancelada') {
      showToast(`Resolução abandonada — ${_gravPassos.length} passo(s) já resolvido(s) foram mantidos.`);
    }
  }
}

function _gravRedesenharAoVivo() {
  const lista = document.getElementById('insp-grav-lista');
  lista.innerHTML = _gravRaw.map(p => `
    <div class="grav-live-row${p.sem_nome ? ' grav-sem-nome' : ''}">
      <span class="grav-step-num">${p.n}</span>
      <span>${p.sem_nome ? '⚠ ' : ''}${escapeHtml(p.rotulo || '')}</span>
    </div>`).join('');
}

function _gravAtualizarStatus() {
  const s = document.getElementById('insp-grav-status');
  if (_gravEstado === 'gravando') {
    s.innerHTML = `<span class="grav-rec-dot"></span> Gravando — ${_gravRaw.length} passo(s)`;
  } else if (_gravEstado === 'resolvendo' && _gravProgresso) {
    s.textContent = `Resolvendo a teia — ${_gravProgresso.feito} de ${_gravProgresso.total}…`;
  } else if (_gravEstado === 'revisando') {
    const resolvidos = _gravPassos.length
      ? ` — ${_gravPassos.length} resolvido(s)` : ' — resolva a teia ou copie assim mesmo';
    s.textContent = `${_gravRaw.length} passo(s)${resolvidos}`;
  } else {
    s.textContent = '';
  }
}
