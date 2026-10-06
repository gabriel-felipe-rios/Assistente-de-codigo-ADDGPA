// ═══════════════════════════════════════════════ DESCRIÇÃO DE PROJETO ══
// Ícone 📝 no cartão (ver `projetos-kanban.js`) abre este modal rápido:
// textarea já preenchida com a descrição atual (ou vazia, com um placeholder),
// direto editável — Cancelar descarta, Salvar grava. Não existe um passo
// "só visualizar" separado: abrir já editável é mais simples e cobre o mesmo
// caso de uso (ver antes de mudar).

async function abrirModalDescricaoProjeto(nomeProjeto) {
  const descricoes = await taxCarregarDescricoes();
  const atual = descricoes[nomeProjeto] || '';

  abrirModalPadrao({
    title: `Descrição — ${escapeHtml(nomeProjeto)}`,
    bodyHtml: `
      <textarea class="modal-textarea" id="pd-texto" rows="5"
        placeholder="Sem descrição ainda — escreva uma.">${escapeHtml(atual)}</textarea>`,
    confirmLabel: 'Salvar',
    onConfirm: async (overlay, showErr) => {
      const texto = overlay.querySelector('#pd-texto').value;
      const r = await window.pywebview.api.salvar_descricao_do_projeto(nomeProjeto, texto);
      if (!r || !r.success) { showErr((r && r.error) || 'Não deu para salvar.'); return false; }
      taxDescricaoCache(nomeProjeto, texto.trim());
      showToast('Descrição salva.');
    },
  });
}

// ── Seção retrátil de descrição dentro dos modais de Novo Projeto/Importar ──
// Fechada por padrão (não empurra o resto do modal até o usuário pedir).
function montarDescricaoRetratil(botao, painel, textarea, valorInicial) {
  textarea.value = valorInicial || '';
  painel.classList.add('hidden');
  botao.onclick = () => {
    const abrindo = painel.classList.contains('hidden');
    painel.classList.toggle('hidden');
    if (abrindo) textarea.focus();
  };
}
