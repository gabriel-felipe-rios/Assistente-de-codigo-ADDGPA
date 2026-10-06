// ═══════════════════════════════════════ PICKER DE GRUPO/SUBGRUPO/TAGS ══
// Widget compartilhado pelos três modais que atribuem organização a um
// projeto — Novo Projeto, Importar pasta, Editar Projeto. Um só lugar para
// montar/ler os campos, em vez de três cópias que divergiriam em silêncio.

// Popula os dois <select> de Grupo/Subgrupo. O de Subgrupo é refeito toda vez
// que o de Grupo muda — subgrupo pertence a UM grupo, não faz sentido listar
// os de outro.
function montarGrupoSubgrupoSelects(selectGrupo, selectSubgrupo, grupoAtual, subgrupoAtual) {
  const grupos = taxGrupos();
  selectGrupo.innerHTML = '<option value="">Sem grupo</option>' +
    grupos.map(g => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.nome)}</option>`).join('');
  selectGrupo.value = grupoAtual || '';

  const repovoarSubgrupos = () => {
    const g = taxGrupo(selectGrupo.value);
    const subgrupos = g ? (g.subgrupos || []) : [];
    selectSubgrupo.innerHTML = '<option value="">—</option>' +
      subgrupos.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.nome)}</option>`).join('');
    selectSubgrupo.disabled = !subgrupos.length;
  };
  repovoarSubgrupos();
  if (selectGrupo.value === (grupoAtual || '')) selectSubgrupo.value = subgrupoAtual || '';

  // Reamarrar a cada chamada duplicaria listener — a troca de `onchange` (não
  // `addEventListener`) é segura porque este elemento não tem outro dono.
  selectGrupo.onchange = () => { repovoarSubgrupos(); };
}

// Renderiza a lista de tags como checkboxes marcados pelas já atribuídas.
// `tagsSelecionadas` é um array de IDs.
function montarTagPicker(container, tagsSelecionadas) {
  const marcadas = new Set(tagsSelecionadas || []);
  const tags = taxTags();
  if (!tags.length) {
    container.innerHTML = '<div class="tag-picker-vazio">Nenhuma tag criada ainda — use "Gerenciar projetos".</div>';
    return;
  }
  container.innerHTML = `<div class="tag-picker-lista">${tags.map(t => `
    <label class="tag-picker-item">
      <input type="checkbox" value="${escapeHtml(t.id)}" ${marcadas.has(t.id) ? 'checked' : ''} />
      <span class="tag-pill" style="${tagPillStyle(t.cor)}">${escapeHtml(t.nome)}</span>
    </label>`).join('')}</div>`;
}

function lerTagPicker(container) {
  return [...container.querySelectorAll('input[type="checkbox"]:checked')].map(el => el.value);
}
