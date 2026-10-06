// ══════════════════════════════════════════════════════ ABA: INSPETOR ══
// Captura real (hook global pynput + pywinauto/Win32) e busca de candidatos.
// Duas sub-abas, cada uma uma esteira que termina em "Copiar para a IA":
// Capturar (inspetor-candidatos.js + inspetor-envio.js) e Gravação
// (inspetor-gravacao.js + inspetor-gravacao-revisao.js).

let _inspInited = false;
let _inspModoCaptura = 'controle'; // 'controle' | 'janela'
let _inspUltimaCaptura = null;
let _inspCandidatos = [];
let _inspTotalCandidatos = 0;
let _inspCandidatoSelecionado = null;

function initInspetorTab() {
  if (_inspInited) return;
  _inspInited = true;

  // Sub-abas de Inspetor
  document.querySelectorAll('.insp-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.insp-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.insp-tab-content').forEach(c => {
        c.classList.remove('active'); c.classList.add('hidden');
      });
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.insp);
      target.classList.remove('hidden');
      target.classList.add('active');
    });
  });

  // Toggle "Controle específico" / "Janela inteira"
  document.querySelectorAll('.insp-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.insp-toggle').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _inspModoCaptura = btn.dataset.inspmodo;
    });
  });

  document.getElementById('insp-btn-ativar').addEventListener('click', inspAtivarModo);
  document.getElementById('insp-btn-copiar').addEventListener('click', inspCopiarParaIA);
  document.getElementById('insp-restringir-btn').addEventListener('click', inspToggleRestringir);

  initInspetorGravacao(); // sub-aba Gravação + botão "Executar programa" (inspetor-gravacao.js)
}

// ── Capturar ─────────────────────────────────────────────────────────────
function inspAtivarModo() {
  const btn = document.getElementById('insp-btn-ativar');
  btn.disabled = true;
  btn.textContent = 'Aguardando clique em outro programa... (Esc cancela)';
  // O modo era escolhido na tela e ignorado na chamada — o par de botões
  // existia sem fazer nada. Agora ele viaja junto.
  window.pywebview.api.inspetor_ativar_captura(_inspModoCaptura);
}

// Chamada pelo backend via evaluate_js quando a captura terminar/mudar de status.
function inspetorCapturaResultado(payload) {
  if (payload.status === 'aguardando') return; // já refletido no botão

  const btn = document.getElementById('insp-btn-ativar');
  btn.disabled = false;
  btn.textContent = 'Ativar modo inspetor';

  if (payload.status === 'cancelado') {
    showToast('Captura cancelada.');
    return;
  }
  if (payload.status === 'error') {
    showToast('Erro ao capturar: ' + payload.error, true);
    return;
  }

  _inspUltimaCaptura = payload.relatorio;
  _inspCandidatos = [];
  _inspTotalCandidatos = 0;
  _inspCandidatoSelecionado = null;
  _inspRenderRelatorio(_inspUltimaCaptura);
  _inspRenderEnvio();
  // Buscar os candidatos é automático: é o que faz capturar → copiar caber em
  // dois cliques. Copiar NÃO espera por isso — o botão fica ativo o tempo todo.
  inspBuscarCandidatos();
}

function _inspEsc(s) {
  if (s === undefined || s === null || s === '') return '<span style="opacity:.5">—</span>';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

function _inspRenderRelatorio(relatorio) {
  document.getElementById('insp-capturar-empty').classList.add('hidden');
  document.getElementById('insp-props-panel').classList.remove('hidden');

  const uia = relatorio.uia || {};
  const win32 = relatorio.win32 || {};

  document.getElementById('insp-props-uia').innerHTML = uia.success ? `
    <div class="insp-prop-row"><span class="k">Nome</span><span class="v">${_inspEsc(uia.name)}</span></div>
    <div class="insp-prop-row"><span class="k">AutomationId</span><span class="v">${_inspEsc(uia.automation_id)}</span></div>
    <div class="insp-prop-row"><span class="k">ControlType</span><span class="v">${_inspEsc(uia.control_type)}</span></div>
    <div class="insp-prop-row"><span class="k">Texto visível</span><span class="v">${_inspEsc(uia.texto)}</span></div>
    <div class="insp-prop-row"><span class="k">Caminho na árvore</span><span class="v">${_inspEsc(uia.caminho)}</span></div>
  ` : `<div class="insp-prop-row"><span class="k">Não capturado</span><span class="v">${_inspEsc(uia.error)}</span></div>`;

  document.getElementById('insp-props-win32').innerHTML = win32.success ? `
    <div class="insp-prop-row"><span class="k">Window handle</span><span class="v">${_inspEsc(win32.handle)}</span></div>
    <div class="insp-prop-row"><span class="k">Class name</span><span class="v">${_inspEsc(win32.class_name)}</span></div>
    <div class="insp-prop-row"><span class="k">Nome do processo</span><span class="v">${_inspEsc(win32.processo)}</span></div>
    <div class="insp-prop-row"><span class="k">Arquivo do processo</span><span class="v">${_inspEsc(win32.arquivo_processo)}</span></div>
    <div class="insp-prop-row"><span class="k">Retângulo</span><span class="v">X: ${win32.retangulo?.x}, Y: ${win32.retangulo?.y}, W: ${win32.retangulo?.w}, H: ${win32.retangulo?.h}</span></div>
  ` : `<div class="insp-prop-row"><span class="k">Não capturado</span><span class="v">${_inspEsc(win32.error)}</span></div>`;
}
