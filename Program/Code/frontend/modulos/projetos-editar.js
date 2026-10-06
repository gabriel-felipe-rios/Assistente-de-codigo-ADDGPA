// ═══════════════════════════════════════════════════ EDITAR PROJETO ══
// O modal que era só "Renomear Projeto" (`#modal-rename`) ganhou Grupo/
// Subgrupo/Tags — por isso passa a se chamar "Editar Projeto" no título,
// embora o markup/id continuem os mesmos (menos risco que criar um modal
// novo do zero para uma extensão do que já existia). `openRenameModal`/
// `confirmRename`, em `modais.js`, delegam a parte de organização pra cá.

async function popularOrganizacaoNoModalEditar(nomeProjeto) {
  await taxCarregar();
  const atrib = taxAtribuicaoDe(nomeProjeto);
  montarGrupoSubgrupoSelects(
    document.getElementById('rename-project-grupo'),
    document.getElementById('rename-project-subgrupo'),
    atrib.grupo_id, atrib.subgrupo_id);
  montarTagPicker(document.getElementById('rename-project-tags'), atrib.tags);
}

// Chamado por `confirmRename` DEPOIS que o rename em si deu certo — o nome
// já pode ter mudado, então usa `nomeAtual` (pós-rename) para gravar.
async function persistirOrganizacaoDoProjeto(nomeAtual) {
  const grupoId = document.getElementById('rename-project-grupo').value || null;
  const subgrupoId = document.getElementById('rename-project-subgrupo').value || null;
  const tagIds = lerTagPicker(document.getElementById('rename-project-tags'));

  const r1 = await window.pywebview.api.definir_grupo_do_projeto(nomeAtual, grupoId, subgrupoId);
  taxAtualizarCache(r1);
  const r2 = await window.pywebview.api.definir_tags_do_projeto(nomeAtual, tagIds);
  taxAtualizarCache(r2);

  if (!(r1 && r1.success) || !(r2 && r2.success)) {
    showToast('Nome atualizado, mas não deu para salvar grupo/tags.', true);
  }
}
