// ══════════════════ ABA: CONFIGURAÇÕES — MODELO E GERAÇÃO ══
// O comportamento do cartão "Modelo e geração" (Modelo e contexto). O markup
// está em `config-template.js`; quem decide o que vai na chamada é o backend,
// `backend/modulos/llm_geracao.py`.
//
// ⚠️ Caixa-mestra "Usar as configurações deste programa" desmarcada = nada deste
// cartão vai na chamada, e vale o LM Studio. Por isso o resto fica apagado e
// sem mexer (`config-apagado` + `disabled`) — visível, para o usuário saber o
// que ligaria.
//
// Cada mudança grava na hora, só a chave mexida, por `_salvarSettingsDaAba`
// (`limites.js`). Número vazio grava `null`: "vale o do LM Studio".

const MODELO_E_GERACAO_PENSAMENTO = [
  ['input-pensamento-rotinas',    'pensamento_rotinas'],
  ['input-pensamento-chat',       'pensamento_chat'],
  ['input-pensamento-fila',       'pensamento_fila'],
  ['input-pensamento-subagentes', 'pensamento_subagentes'],
  ['input-pensamento-designer',   'pensamento_designer'],
];

const MODELO_E_GERACAO_AJUSTES = [
  ['input-geracao-temperatura',    'geracao_temperatura'],
  ['input-geracao-top-p',          'geracao_top_p'],
  ['input-geracao-top-k',          'geracao_top_k'],
  ['input-geracao-min-p',          'geracao_min_p'],
  ['input-geracao-repeat-penalty', 'geracao_repeat_penalty'],
];

function _aplicarApagadoDoModelo() {
  const mestra = document.getElementById('input-usar-config-programa');
  const dependente = document.getElementById('cfg-modelo-dependente');
  if (!mestra || !dependente) return;
  const ligada = mestra.checked;
  dependente.classList.toggle('config-apagado', !ligada);
  dependente.querySelectorAll('input, select, button').forEach(el => { el.disabled = !ligada; });
}

async function _detectarModelos() {
  const select = document.getElementById('select-modelo-escolhido');
  const nota = document.getElementById('modelos-detectados');
  if (!select) return;
  let r = null;
  try { r = await window.pywebview.api.detectar_modelos(); } catch (e) { r = { success: false, error: String(e) }; }
  if (!r || !r.success) {
    if (nota) {
      nota.textContent = `O LM Studio não respondeu — ${(r && r.error) || 'sem resposta'}`;
      nota.classList.add('config-nota-alerta');
    }
    return;
  }
  const escolhido = appSettings.modelo_escolhido || '';
  select.innerHTML = '';
  const vazia = document.createElement('option');
  vazia.value = '';
  vazia.textContent = '(qualquer um carregado no LM Studio)';
  select.appendChild(vazia);
  r.modelos.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.carregado ? `${m.nome} · carregado` : m.nome;
    select.appendChild(opt);
  });
  // O escolhido que o LM Studio não listou (apagado, servidor trocado) continua
  // aparecendo: sumir com ele faria o <select> mentir sobre o que está gravado.
  if (escolhido && !r.modelos.some(m => m.id === escolhido)) {
    const opt = document.createElement('option');
    opt.value = escolhido;
    opt.textContent = `${escolhido} · não encontrado`;
    select.appendChild(opt);
  }
  select.value = escolhido;
  if (nota) {
    const carregados = r.modelos.filter(m => m.carregado).length;
    nota.textContent = `${r.modelos.length} modelos encontrados · ${carregados} carregado · agora`;
    nota.classList.remove('config-nota-alerta');
  }
}

async function _initModeloEGeracao() {
  const mestra = document.getElementById('input-usar-config-programa');
  const select = document.getElementById('select-modelo-escolhido');
  if (!mestra || !select) return;

  mestra.checked = !!appSettings.usar_config_do_programa;
  const escolhido = appSettings.modelo_escolhido || '';
  if (escolhido && ![...select.options].some(o => o.value === escolhido)) {
    const opt = document.createElement('option');
    opt.value = escolhido;
    opt.textContent = escolhido;
    select.appendChild(opt);
  }
  select.value = escolhido;
  MODELO_E_GERACAO_PENSAMENTO.forEach(([id, chave]) => {
    const caixa = document.getElementById(id);
    if (caixa) caixa.checked = !!appSettings[chave];
  });
  MODELO_E_GERACAO_AJUSTES.forEach(([id, chave]) => {
    const input = document.getElementById(id);
    if (input) input.value = appSettings[chave] == null ? '' : appSettings[chave];
  });
  _aplicarApagadoDoModelo();

  // Fiação UMA vez: `initLimitesConfig` roda de novo a cada "Restaurar padrão".
  if (!mestra._wired) {
    mestra._wired = true;
    mestra.addEventListener('change', async () => {
      _aplicarApagadoDoModelo();
      await _salvarSettingsDaAba({ usar_config_do_programa: mestra.checked });
      if (mestra.checked) _detectarModelos();
    });
    select.addEventListener('change', () => _salvarSettingsDaAba({ modelo_escolhido: select.value }));
    const btn = document.getElementById('btn-detectar-modelos');
    if (btn) btn.addEventListener('click', _detectarModelos);
    MODELO_E_GERACAO_PENSAMENTO.forEach(([id, chave]) => {
      const caixa = document.getElementById(id);
      if (caixa) caixa.addEventListener('change', () => _salvarSettingsDaAba({ [chave]: caixa.checked }));
    });
    MODELO_E_GERACAO_AJUSTES.forEach(([id, chave]) => {
      const input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('change', () => {
        const bruto = input.value.trim();
        _salvarSettingsDaAba({ [chave]: bruto === '' ? null : Number(bruto) });
      });
    });
  }

  // Caixa marcada: o <select> não pode ficar só com a opção vazia.
  if (mestra.checked) _detectarModelos();
}
