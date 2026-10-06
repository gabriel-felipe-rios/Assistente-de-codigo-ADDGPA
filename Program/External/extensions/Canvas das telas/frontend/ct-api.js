// ═══════════════════════════════════ CANVAS DAS TELAS — A PONTE ══
// TODA conversa com o backend, num lugar só. Não monta HTML.

(function () {
  const montada = () => typeof window.ctMontada === 'function' && window.ctMontada();

  // `null` quando falha — e o aviso já foi dado.
  window.ctChamar = async function (acao, extras = {}) {
    try {
      const r = await window.pywebview.api.chamar_extensao(window.ctCaminho, { acao, ...extras });
      if (!montada()) return null;
      if (!r || !r.success) {
        if (window.ctEstado) window.ctEstado.erro = (r && r.error) || 'o Canvas das telas não respondeu';
        showToast((r && r.error) || 'o Canvas das telas não respondeu', true);
        return null;
      }
      return r;
    } catch (e) {
      // ⚠️ `try` E NÃO SÓ `if (!r.success)`: um erro do lado Python REJEITA a
      // promessa da ponte, e o `await` estoura aqui.
      console.error('[ct]', e);
      if (montada()) showToast('a ponte do Canvas das telas falhou', true);
      return null;
    }
  };

  // Lê o site do projeto. As pastas vêm do Workspace do projeto.
  window.ctLer = async function (projeto) {
    let ws = null;
    try {
      ws = await window.pywebview.api.load_workspace(projeto);
    } catch (e) {
      console.error('[ct]', e);
    }
    if (!montada()) return null;
    // ⚠️ `config` vem MESMO com `success: false` (o padrão, quando o arquivo
    // está quebrado) — é melhor ler com ele do que não ler.
    const c = (ws && ws.config) || {};
    return window.ctChamar('ler', {
      projeto,
      main_file: c.main_file || null,
      working_folders: c.working_folders || [],
      ignore_list: c.ignore_list || [],
    });
  };
})();
