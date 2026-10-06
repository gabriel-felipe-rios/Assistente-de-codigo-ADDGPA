// ══════════════════════════════════ ABA ARQUIVOS — CRUD da biblioteca ══
// Remover e alternar origem dos itens, na tela global de Projetos.
// A tela por-projeto só ativa; aqui é a gestão da biblioteca.

// O construtor do modal saiu daqui: virou `abrirModalPadrao`, em
// `modal-padrao.js`. Ele já tinha cinco donos, e o prefixo `_arq` dizia que era
// da aba Arquivos quando não era mais.

// ⛔ `arqCreate` e `arqFormat` foram REMOVIDOS daqui, e não devem voltar. Desde
// que uma pasta com qualquer arquivo solto dentro já vale como item, criar pela
// tela virou o caminho longo para o que arrastar a pasta faz num segundo — e
// formatar era só preencher o Descrição.md que o próprio usuário escreve
// melhor. Quem precisa do formato certo pega o prompt pronto na sub-aba "Como
// adicionar" e manda uma IA gerar o item já formatado.

function arqDelete(kind, name, label) {
  abrirModalPadrao({
    title: `Remover ${label}?`,
    confirmLabel: 'Remover',
    bodyHtml: `<div class="modal-body-text">Isto apaga <strong>${escapeHtml(name)}</strong> da biblioteca (a pasta em <code>Arquivos/</code>). Não dá pra desfazer.</div>`,
    onConfirm: async (ov, showErr) => {
      const r = await window.pywebview.api.delete_arquivo_item(kind, name);
      if (!r.success) { showErr(r.error || 'Erro ao remover.'); return false; }
      showToast(`"${name}" removido.`);
      initGlobalArquivosTab();
      return true;
    },
  });
}

async function arqToggleOrigem(kind, name, current) {
  const next = current === 'programa' ? 'geral' : 'programa';
  const r = await window.pywebview.api.set_item_origem(kind, name, next);
  if (!r || !r.success) { showToast((r && r.error) || 'Erro ao alterar origem.', true); return; }
  initGlobalArquivosTab();
}
