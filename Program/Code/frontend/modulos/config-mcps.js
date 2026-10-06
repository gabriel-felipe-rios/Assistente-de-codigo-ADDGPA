// ═════════════════════════════ ABA: CONFIGURAÇÕES — Servidores MCP ══
// Lê e grava o campo que `config-mcps-template.js` desenha. O markup mora lá,
// o comportamento mora aqui — o mesmo par dos outros `config-*`.
//
// ⚠️ NÃO CONFUNDIR COM `config-mcp.js` (sem o "s"), que é a categoria dos
// LIMITES dos dois servidores do programa. Esta é o destino da pasta dos MCPs
// de terceiro. As duas gravam em `settings.json` e passam por
// `save_settings_parcial`, mas são categorias separadas de propósito.

// O padrão de fábrica vem do backend, nunca digitado aqui: duas listas de
// padrão divergem no primeiro dia em que alguém mexe numa delas.
let _cmcpsPadroes = null;

// ⚠️ A LIMPEZA É A MESMA DO BACKEND, e precisa ser: `_mcp3_destino_da_pasta`
// tira barras das pontas e troca `\` por `/`. Se a tela guardasse `MCPs/` e o
// backend lesse `MCPs`, o campo mostraria um texto e o programa usaria outro —
// e o usuário não teria como saber qual dos dois vale.
function _cmcpsLimpar(valor) {
  const bruto = String(valor || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  return bruto || (_cmcpsPadroes && _cmcpsPadroes.mcps_destino_da_pasta) || 'MCPs';
}

async function initConfigMcps() {
  if (!_cmcpsPadroes) {
    const p = await window.pywebview.api.padroes_dos_mcps();
    if (!p || !p.success) return;
    _cmcpsPadroes = p.padroes;
  }

  const r = await window.pywebview.api.load_settings();
  const s = (r && r.settings) || {};
  const el = document.getElementById('cmcps-mcps_destino_da_pasta');
  if (el) {
    el.value = _cmcpsLimpar(s.mcps_destino_da_pasta
                            ?? _cmcpsPadroes.mcps_destino_da_pasta);
  }

  const btn = document.getElementById('btn-save-mcps');
  if (btn && !btn._wired) {
    btn._wired = true;
    btn.addEventListener('click', salvarConfigMcps);
  }
}

async function salvarConfigMcps() {
  const el = document.getElementById('cmcps-mcps_destino_da_pasta');
  if (!el) return;
  const valor = _cmcpsLimpar(el.value);
  el.value = valor;                   // devolve o valor limpo para a tela
  const patch = { mcps_destino_da_pasta: valor };
  const r = await window.pywebview.api.save_settings_parcial(patch);
  if (r && r.success) {
    // O `appSettings` em memória é atualizado JUNTO — sem isto a próxima tela
    // que gravasse reverteria a mudança em silêncio.
    appSettings = Object.assign({}, appSettings, patch);
    showToast('Destino salvo. Vale nos MCPs que você ligar a partir de agora.');
  } else {
    showToast('Erro ao salvar o destino dos MCPs.', true);
  }
}
