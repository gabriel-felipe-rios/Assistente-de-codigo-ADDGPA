// ═══════════════════════════════ Configurações → Editor ══
// Lê e grava as chaves `editor_*` do `settings.json`.
//
// Global, e não por projeto: a escolha é sobre como o usuário quer ver e usar o
// programa. As cinco chaves do Histórico local nasceram por projeto, num
// `Editor/Configuração.json`, e vieram para cá em 30/08/2026 por decisão do
// usuário — um "Salvar" gravando em dois lugares, e um "Restaurar padrão" que
// só enxergava metade, confundiam mais do que a flexibilidade valia.
//
// ⚠️ Usa `save_settings_parcial`, e não `save_settings`. O segundo grava o
// dicionário inteiro e obriga a mandar o `appSettings` atual junto — se outra
// aba tiver gravado nesse intervalo, a gravação daqui a desfaz em silêncio. O
// motivo completo está em `limites.js:232`.

// campo do formulário → chave do settings. Uma tabela em vez de catorze pares
// escritos à mão nas duas funções: acrescentar uma opção vira uma linha.
const _CFGED_CAIXAS = {
  'cfg-editor-botao-salvar':     'editor_botao_salvar',
  'cfg-editor-botao-desfazer':   'editor_botao_desfazer',
  'cfg-editor-botao-buscar':     'editor_botao_buscar',
  'cfg-editor-botao-historico':  'editor_botao_historico',
  'cfg-editor-hist-ligado':      'editor_hist_ligado',
  'cfg-editor-hist-so-se-mudou': 'editor_hist_so_se_mudou',
  'cfg-editor-hist-diff':        'editor_hist_diff',
  'cfg-editor-minimapa':         'editor_minimapa',
  'cfg-editor-breadcrumb':       'editor_breadcrumb',
  'cfg-editor-caminho-barra':    'editor_caminho_barra',
  'cfg-editor-lint':             'editor_lint_sintaxe',
};
const _CFGED_NUMEROS = {
  'cfg-editor-fonte':          { chave: 'editor_fonte_px',        min: 9,   max: 24,    decimal: true },
  'cfg-editor-entrelinha':     { chave: 'editor_entrelinha',      min: 1.2, max: 2.2,   decimal: true },
  'cfg-editor-tabulacao':      { chave: 'editor_tabulacao',       min: 1,   max: 8 },
  'cfg-editor-teto-cor':       { chave: 'editor_teto_linhas_cor', min: 200, max: 50000 },
  'cfg-editor-hist-entradas':  { chave: 'editor_hist_entradas',   min: 1,   max: 200 },
  'cfg-editor-hist-dias':      { chave: 'editor_hist_dias',       min: 0,   max: 3650 },
  'cfg-editor-hist-mb':        { chave: 'editor_hist_mb',         min: 0,   max: 10000 },
};

// eslint-disable-next-line no-unused-vars
async function initConfigEditor() {
  Object.entries(_CFGED_CAIXAS).forEach(([id, chave]) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!appSettings[chave];
  });
  Object.entries(_CFGED_NUMEROS).forEach(([id, def]) => {
    const el = document.getElementById(id);
    if (el) el.value = appSettings[def.chave];
  });

  const btn = document.getElementById('btn-save-editor');
  if (btn && !btn._wired) {
    btn._wired = true;
    btn.addEventListener('click', salvarConfigEditor);
  }
}

async function salvarConfigEditor() {
  const patch = {};
  Object.entries(_CFGED_CAIXAS).forEach(([id, chave]) => {
    const el = document.getElementById(id);
    if (el) patch[chave] = el.checked;
  });
  // O grampo é aqui e é obrigatório: o `min`/`max` do <input type=number> não
  // impede digitar fora da faixa, e um `0` em `editor_fonte_px` deixaria o
  // editor irrecuperável sem editar o JSON à mão. `editor-metricas.js` grampeia
  // de novo na leitura — as duas pontas, de propósito.
  for (const [id, def] of Object.entries(_CFGED_NUMEROS)) {
    const el = document.getElementById(id);
    if (!el) continue;
    const n = def.decimal ? parseFloat(el.value) : parseInt(el.value, 10);
    if (!Number.isFinite(n)) {
      showToast('Há um número vazio ou inválido na configuração do Editor.', true);
      el.focus();
      return;
    }
    patch[def.chave] = Math.min(def.max, Math.max(def.min, n));
    el.value = patch[def.chave];
  }

  const r = await window.pywebview.api.save_settings_parcial(patch);
  if (!r.success) { showToast('Erro ao salvar a configuração do Editor.', true); return; }
  // ⚠️ Sem esta linha a tela grava certo e o programa continua lendo o valor
  // velho até reiniciar: todo mundo lê de `appSettings`, não do disco.
  appSettings = { ...appSettings, ...patch };

  aplicarConfiguracaoDoEditor();
  showToast('Configuração do Editor salva.');
}

// Empurra a configuração para a aba Editor, se ela já estiver montada. Chamada
// no salvar e no "Restaurar padrão" (via `_CONFIG_REPINTORES`).
//
// A aba pode nem existir ainda — `initEditorTab()` só roda no primeiro clique
// nela. Por isso o `typeof`: sem ele, mexer nesta configuração antes de abrir o
// Editor uma vez estouraria.
// eslint-disable-next-line no-unused-vars
function aplicarConfiguracaoDoEditor() {
  if (typeof aplicarMetricasDoEditorAgora === 'function') aplicarMetricasDoEditorAgora();
  // O teto de cor é decidido na pintura; sem repintar, o arquivo já aberto
  // só mudaria de estado na próxima tecla.
  if (typeof edRepintarPaineis === 'function') edRepintarPaineis();
}
