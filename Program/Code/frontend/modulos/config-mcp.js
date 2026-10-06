// ═════════════════════════════ ABA: CONFIGURAÇÕES — Servidor MCP ══
// Lê e grava os campos que `config-mcp-template.js` desenha. O markup mora lá,
// o comportamento mora aqui — o mesmo par dos outros `config-*`.
//
// Gêmeo de `config-ferramentas.js`, e de propósito: os valores vivem em
// `settings.json` (não em `limites.json`, cujo `save_limites` faz
// `max(1, int(valor))` e destruiria qualquer coisa que não fosse número), e a
// gravação passa por `save_settings_parcial`.
//
// ⚠️ O processo do servidor MCP instancia a `Api` inteira
// (`servidor.py::_bootstrap_api`) e lê o `settings.json` sozinho. Estes limites
// NÃO precisam viajar por argumento de linha de comando como o `--enabled` dos
// toggles — e o processo relê o `settings.json` a cada chamada (`_mcp_limite` →
// `load_settings`), então um limite salvo aqui vale na próxima ferramenta
// chamada, na mesma sessão. O que só muda na sessão seguinte é a lista de
// ferramentas ligadas (o `--enabled`), que mora em Arquivos → MCPs.

// O padrão de fábrica vem do backend, nunca digitado aqui.
let _cmcpPadroes = null;

function _cmcpCampos() {
  return CONFIG_MCP_GRUPOS.flatMap(g => g.campos);
}

function _cmcpGrampear(campo, valor) {
  const v = parseInt(valor, 10);
  if (isNaN(v)) return _cmcpPadroes[campo.chave];
  return Math.max(campo.min, Math.min(v, campo.max));
}

async function initMcpConfig() {
  if (!_cmcpPadroes) {
    const p = await window.pywebview.api.padroes_do_mcp();
    if (!p || !p.success) return;
    _cmcpPadroes = p.padroes;
  }

  const r = await window.pywebview.api.load_settings();
  const s = (r && r.settings) || {};

  _cmcpCampos().forEach(campo => {
    const el = document.getElementById(`cmcp-${campo.chave}`);
    if (!el) return;
    el.value = _cmcpGrampear(campo, s[campo.chave] ?? _cmcpPadroes[campo.chave]);
  });

  const btn = document.getElementById('btn-save-mcp');
  if (btn && !btn._wired) {
    btn._wired = true;
    btn.addEventListener('click', salvarMcpConfig);
  }
}

async function salvarMcpConfig() {
  const patch = {};
  for (const campo of _cmcpCampos()) {
    const el = document.getElementById(`cmcp-${campo.chave}`);
    if (!el) continue;
    const v = _cmcpGrampear(campo, el.value);
    el.value = v;                   // devolve o valor grampeado para a tela
    patch[campo.chave] = v;
  }
  const r = await window.pywebview.api.save_settings_parcial(patch);
  if (r && r.success) {
    // O `appSettings` em memória é atualizado JUNTO — sem isto a próxima tela
    // que gravasse reverteria a mudança em silêncio.
    appSettings = Object.assign({}, appSettings, patch);
    showToast('Servidores MCP salvos! Os limites valem na hora.');
  } else {
    showToast('Erro ao salvar os servidores MCP.', true);
  }
}
