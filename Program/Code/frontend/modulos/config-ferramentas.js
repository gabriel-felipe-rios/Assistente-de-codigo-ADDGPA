// ═══════════════════ ABA: CONFIGURAÇÕES — Ferramentas dos subagentes ══
// Lê e grava os campos que `config-ferramentas-template.js` desenha. O markup
// mora lá, o comportamento mora aqui — o mesmo par dos outros `config-*`.
//
// Os valores vivem em `settings.json`, e NÃO em `limites.json`: `save_limites`
// faz `max(1, int(valor))`, que serve para os sete campos de token da categoria
// "Modelo e contexto" e destruiria qualquer string ou booleano. Guardar aqui
// também é o certo por natureza — estes são ajustes do PROGRAMA, não da conta
// de orçamento por arquivo.
//
// A gravação passa por `save_settings_parcial`, e não por `save_settings`: ver
// o comentário lá no Python para o defeito que isso conserta.

// O padrão de fábrica vem do backend, nunca digitado aqui — duas listas de
// padrão divergem no primeiro dia em que alguém mexe numa delas.
let _cferrPadroes = null;

// Quantos caracteres cabem, no pior caso, num token. Usado só para mostrar o
// pior caso em tokens ao lado do corte de linha do grep, que é o único campo
// em caractere desta tela. Pior caso = 1 token por caractere, que é o que
// acontece com código denso e identificador comprido.
const _CFERR_PIOR_CASO_CHARS_POR_TOKEN = 1;

function _cferrCampos() {
  return CONFIG_FERRAMENTAS_GRUPOS.flatMap(g => g.campos);
}

function _cferrGrampear(campo, valor) {
  const v = parseInt(valor, 10);
  if (isNaN(v)) return _cferrPadroes[campo.chave];
  return Math.max(campo.min, Math.min(v, campo.max));
}

async function initFerramentasConfig() {
  if (!_cferrPadroes) {
    const p = await window.pywebview.api.padroes_das_ferramentas();
    if (!p || !p.success) return;
    _cferrPadroes = p.padroes;
  }

  const r = await window.pywebview.api.load_settings();
  const s = (r && r.settings) || {};

  _cferrCampos().forEach(campo => {
    const el = document.getElementById(`cferr-${campo.chave}`);
    if (!el) return;
    el.value = _cferrGrampear(campo, s[campo.chave] ?? _cferrPadroes[campo.chave]);
    if (campo.piorCasoTokens && !el._wiredPior) {
      el._wiredPior = true;
      el.addEventListener('input', () => _cferrAtualizarPiorCaso(campo));
    }
    _cferrAtualizarPiorCaso(campo);
  });

  const btn = document.getElementById('btn-save-ferramentas');
  if (btn && !btn._wired) {
    btn._wired = true;
    btn.addEventListener('click', salvarFerramentasConfig);
  }
}

// O pior caso em tokens ao lado do número em caractere. Sem isto o campo
// parece mais barato do que é: 120 caracteres de código denso podem custar
// 120 tokens, e não os ~30 que a média sugeriria.
function _cferrAtualizarPiorCaso(campo) {
  if (!campo.piorCasoTokens) return;
  const nota = document.getElementById(`cferr-${campo.chave}-pior`);
  const el = document.getElementById(`cferr-${campo.chave}`);
  if (!nota || !el) return;
  const chars = _cferrGrampear(campo, el.value);
  const tokens = Math.ceil(chars / _CFERR_PIOR_CASO_CHARS_POR_TOKEN);
  nota.innerHTML =
    `No pior caso — código denso, identificador comprido — cada linha custa até ` +
    `<strong>${tokens} tokens</strong>. Multiplique pelas ocorrências da amostra ` +
    `para saber o custo de uma chamada de <code>grep</code>.`;
}

async function salvarFerramentasConfig() {
  const patch = {};
  for (const campo of _cferrCampos()) {
    const el = document.getElementById(`cferr-${campo.chave}`);
    if (!el) continue;
    const v = _cferrGrampear(campo, el.value);
    el.value = v;                   // devolve o valor grampeado para a tela
    patch[campo.chave] = v;
  }
  const r = await window.pywebview.api.save_settings_parcial(patch);
  if (r && r.success) {
    // O `appSettings` em memória é atualizado JUNTO. Era isto que faltava em
    // `subagentes-config-tab.js` e fazia a mudança ser revertida em silêncio
    // pela próxima tela que gravasse.
    appSettings = Object.assign({}, appSettings, patch);
    // A tabela de Chat/Fila › Ferramentas reabre com os tetos novos.
    if (typeof esquecerCatalogoDeFerramentas === 'function') esquecerCatalogoDeFerramentas();
    // O cartão «Limites» da página de uma extensão com subagente MOSTRA estes
    // números (D53): relê a lista para ele não ficar com o valor velho.
    if (typeof xtSincronizarTelas === 'function') xtSincronizarTelas();
    showToast('Ferramentas salvas!');
  } else {
    showToast('Erro ao salvar as ferramentas.', true);
  }
}
