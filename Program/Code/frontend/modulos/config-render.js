// ═════════════════════════ Configurações → Desempenho dos mapas ══
// Lê e grava a seção que regula a qualidade do desenho durante o gesto.
// Segue o molde do `limites.js`: tabela id↔chave, leitura no init, botão Salvar
// explícito (sem debounce), `showToast` no fim.
//
// O valor é consultado a CADA gesto de mapa, então não pode atravessar a ponte
// Python↔WebView na hora do uso: fica no global `renderMapas`, no mesmo padrão
// do `appSettings` (app.js).

// Os três sliders guardam fração (0,5) e mostram porcentagem (50%) — o usuário
// pensa em "metade da resolução", não em 0,5.
const RENDER_SLIDERS = [
  ['cfg-mov-resolucao', 'mov_resolucao'],
  ['cfg-lod-limite',    'lod_limite'],
  ['cfg-margem',        'margem'],
];

// Os que guardam NÚMERO inteiro, sem virar porcentagem.
const RENDER_NUMEROS = [
  ['cfg-impacto-hub',     'impacto_hub_max_ligacoes'],
  ['cfg-niveis-cartoes',  'niveis_cartoes'],
];

const RENDER_CHECKS = [
  ['cfg-mov-sem-rotulos',  'mov_sem_rotulos'],
  ['cfg-mov-sem-setas',    'mov_sem_setas'],
  ['cfg-mov-sem-contorno', 'mov_sem_contorno'],
  ['cfg-mov-sem-ligacoes', 'mov_sem_ligacoes'],
  ['cfg-mov-sem-cor',      'mov_sem_cor'],
  ['cfg-mov-sem-destaque', 'mov_sem_destaque'],
];

async function initConfigRender() {
  const r = await window.pywebview.api.load_render_mapas();
  if (r.success) renderMapas = r.render;
  _renderPreencher(renderMapas);

  RENDER_SLIDERS.forEach(([id]) => {
    const el = document.getElementById(id);
    if (!el || el._wired) return;
    el._wired = true;
    // `input` só atualiza o rótulo (barato); salvar é no botão, como no limites.
    el.addEventListener('input', () => _renderMostrarValor(id));
  });

  const btn = document.getElementById('btn-save-render');
  if (btn && !btn._wired) {
    btn._wired = true;
    btn.addEventListener('click', salvarConfigRender);
  }
}

function _renderMostrarValor(id) {
  const el = document.getElementById(id);
  const val = document.getElementById(id + '-val');
  if (el && val) val.textContent = el.value + '%';
}

function _renderPreencher(cfg) {
  RENDER_SLIDERS.forEach(([id, chave]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = Math.round((cfg[chave] ?? 0.5) * 100);
    _renderMostrarValor(id);
  });
  RENDER_CHECKS.forEach(([id, chave]) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!cfg[chave];
  });
  RENDER_NUMEROS.forEach(([id, chave]) => {
    const el = document.getElementById(id);
    if (el && cfg[chave] != null) el.value = Math.round(cfg[chave]);
  });
}

function _renderColetar() {
  const patch = {};
  RENDER_SLIDERS.forEach(([id, chave]) => {
    const el = document.getElementById(id);
    if (el) patch[chave] = (+el.value) / 100;
  });
  RENDER_CHECKS.forEach(([id, chave]) => {
    const el = document.getElementById(id);
    if (el) patch[chave] = el.checked;
  });
  RENDER_NUMEROS.forEach(([id, chave]) => {
    const el = document.getElementById(id);
    if (el && el.value !== '') patch[chave] = Math.round(+el.value);
  });
  return patch;
}

async function salvarConfigRender() {
  const r = await window.pywebview.api.save_render_mapas(_renderColetar());
  if (!r.success) {
    showToast('Erro ao salvar o desempenho dos mapas.', true);
    return;
  }
  // O backend devolve o estado final já grampeado na faixa válida — usar ele, e
  // não o que foi enviado, para a tela nunca mostrar um valor que não foi salvo.
  renderMapas = r.render;
  _renderPreencher(renderMapas);
  showToast('Desempenho dos mapas salvo!');
}

