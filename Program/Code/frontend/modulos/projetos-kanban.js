// ═══════════════════════════════════════════════ QUADRO DE PROJETOS ══
// Substitui a antiga grade plana de `#project-grid` (era `.project-grid`,
// agora `.kanban-board` — mesmo id, `index.html` só trocou a classe) por um
// quadro em colunas: uma por grupo, mais a coluna fixa "Sem grupo" (sempre
// presente, nunca deletável, nunca escondida pela busca). Re-render completo
// a cada chamada — mesmo padrão de `renderOpenProjectTabs`/a antiga
// `renderProjects` — nenhuma tela deste projeto faz patch incremental de DOM
// para dados desta escala.

async function renderKanban(projects) {
  const grid = document.getElementById('project-grid');
  const empty = document.getElementById('empty-state');
  grid.innerHTML = '';

  if (!projects || projects.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  await taxCarregar();

  // Separa os nomes por grupo/subgrupo. Projeto cujo `grupo_id` aponta pra um
  // grupo que não existe mais (apagado) cai em "Sem grupo" — mesma regra que
  // `deletar_grupo_de_projetos` já aplica no backend, checada de novo aqui
  // porque o cache do frontend pode estar um passo atrás.
  const porGrupo = new Map();
  const semGrupo = [];
  projects.forEach(nome => {
    const atrib = taxAtribuicaoDe(nome);
    const grupo = atrib.grupo_id ? taxGrupo(atrib.grupo_id) : null;
    if (!grupo) { semGrupo.push(nome); return; }
    if (!porGrupo.has(grupo.id)) porGrupo.set(grupo.id, { semSubgrupo: [], comSubgrupo: new Map() });
    const bucket = porGrupo.get(grupo.id);
    const subgrupo = atrib.subgrupo_id ? taxSubgrupo(grupo.id, atrib.subgrupo_id) : null;
    if (!subgrupo) { bucket.semSubgrupo.push(nome); return; }
    if (!bucket.comSubgrupo.has(subgrupo.id)) bucket.comSubgrupo.set(subgrupo.id, []);
    bucket.comSubgrupo.get(subgrupo.id).push(nome);
  });

  taxGrupos().forEach(g => grid.appendChild(_construirColunaDeGrupo(g, porGrupo.get(g.id))));
  grid.appendChild(_construirColunaSemGrupo(semGrupo));
}

function _construirColunaDeGrupo(grupo, bucket) {
  bucket = bucket || { semSubgrupo: [], comSubgrupo: new Map() };
  const total = bucket.semSubgrupo.length +
    [...bucket.comSubgrupo.values()].reduce((soma, arr) => soma + arr.length, 0);

  const col = document.createElement('div');
  col.className = 'kanban-coluna';
  col.dataset.grupoId = grupo.id;
  // A cor mora na COLUNA (cabeçalho), não no cartão — decisão do usuário: o
  // cartão do projeto fica na cor normal, é o grupo (e o subgrupo, cada um
  // com a própria cor) que aparecem coloridos.
  if (grupo.cor) col.style.setProperty('--col-tint', hexParaRgb(grupo.cor));
  col.innerHTML = `
    <div class="kanban-coluna-cabecalho">
      <div class="kanban-coluna-titulo">
        <span class="kanban-coluna-cor" style="background:${escapeHtml(grupo.cor || '')}"></span>
        ${escapeHtml(grupo.nome)}
      </div>
      <span class="kanban-coluna-contagem">${total}</span>
    </div>
    <div class="kanban-coluna-corpo"></div>`;
  const corpo = col.querySelector('.kanban-coluna-corpo');

  if (bucket.semSubgrupo.length) {
    const soltos = document.createElement('div');
    soltos.className = 'kanban-cards';
    bucket.semSubgrupo.forEach(nome => soltos.appendChild(_construirCard(nome)));
    corpo.appendChild(soltos);
  }
  (grupo.subgrupos || []).forEach(sg => {
    const nomes = bucket.comSubgrupo.get(sg.id) || [];
    const wrap = document.createElement('div');
    wrap.className = 'kanban-subgrupo';
    wrap.dataset.subgrupoId = sg.id;
    if (sg.cor) wrap.style.setProperty('--sub-tint', hexParaRgb(sg.cor));
    wrap.innerHTML = `<div class="kanban-subgrupo-titulo">
        <span class="kanban-subgrupo-cor"></span>${escapeHtml(sg.nome)}
      </div>
      <div class="kanban-cards"></div>`;
    const cards = wrap.querySelector('.kanban-cards');
    nomes.forEach(nome => cards.appendChild(_construirCard(nome)));
    corpo.appendChild(wrap);
  });
  return col;
}

function _construirColunaSemGrupo(nomes) {
  const col = document.createElement('div');
  col.className = 'kanban-coluna kanban-coluna-sem-grupo';
  col.dataset.semGrupo = '1';
  col.innerHTML = `
    <div class="kanban-coluna-cabecalho">
      <div class="kanban-coluna-titulo">
        <span class="kanban-coluna-cor kanban-coluna-cor-neutra"></span>
        Sem grupo
      </div>
      <span class="kanban-coluna-contagem">${nomes.length}</span>
    </div>
    <div class="kanban-coluna-corpo"><div class="kanban-cards"></div></div>`;
  const cards = col.querySelector('.kanban-cards');
  nomes.forEach(nome => cards.appendChild(_construirCard(nome)));
  return col;
}

// O cartão fica sempre na cor normal (`--surface`) — quem carrega a cor do
// grupo/subgrupo é a moldura em volta dele (coluna/seção), não o cartão.
function _construirCard(nome) {
  const atrib = taxAtribuicaoDe(nome);
  const card = document.createElement('div');
  card.className = 'project-card';
  card.dataset.nome = nome;

  const tagsHtml = (atrib.tags || [])
    .map(id => taxTag(id))
    .filter(Boolean)
    .map(t => `<span class="tag-pill" style="${tagPillStyle(t.cor)}">${escapeHtml(t.nome)}</span>`)
    .join('');

  card.innerHTML = `
    <div class="project-card-topo">
      <span class="project-icon">📁</span>
      <span class="project-name">${escapeHtml(nome)}</span>
    </div>
    ${tagsHtml ? `<div class="project-tags">${tagsHtml}</div>` : ''}
    <div class="card-actions">
      <button class="card-btn card-btn-desc" title="Descrição">📝</button>
      <button class="card-btn card-btn-rename" title="Editar projeto">✏</button>
      <button class="card-btn card-btn-delete" title="Deletar">🗑</button>
    </div>`;

  card.querySelector('.card-btn-desc').addEventListener('click', e => { e.stopPropagation(); abrirModalDescricaoProjeto(nome); });
  card.querySelector('.card-btn-rename').addEventListener('click', e => { e.stopPropagation(); openRenameModal(nome); });
  card.querySelector('.card-btn-delete').addEventListener('click', e => { e.stopPropagation(); abrirModalRemover(nome); });
  card.addEventListener('click', () => enterProject(nome));
  return card;
}

// ── Filtro da busca (projetos-busca.js) ─────────────────────────────────────
// Toggle de visibilidade, sem re-render — mesmo espírito de
// `filtrarArvorePorCaminho` em `arvore-pastas.js`. `predicate` recebe o NOME
// do projeto; `null`/ausente mostra tudo.
function filtrarKanban(predicate) {
  const grid = document.getElementById('project-grid');
  if (!grid) return;

  grid.querySelectorAll('.project-card').forEach(card => {
    const visivel = !predicate || predicate(card.dataset.nome);
    card.classList.toggle('hidden', !visivel);
  });

  // Sem predicado (busca vazia) é "sem filtro nenhum" — coluna/subgrupo vazio
  // de VERDADE (nenhum projeto atribuído ainda) continua visível, pra revelar
  // a estrutura que acabou de ser criada em "Gerenciar Projetos". Só um FILTRO
  // ativo pode esconder um subgrupo/coluna por ficar sem cartão visível.
  grid.querySelectorAll('.kanban-subgrupo, .kanban-coluna').forEach(el => el.classList.remove('hidden'));
  if (!predicate) return;

  grid.querySelectorAll('.kanban-subgrupo').forEach(sub => {
    const algumVisivel = [...sub.querySelectorAll('.project-card')].some(c => !c.classList.contains('hidden'));
    sub.classList.toggle('hidden', !algumVisivel);
  });
  grid.querySelectorAll('.kanban-coluna').forEach(col => {
    if (col.dataset.semGrupo === '1') return; // "Sem grupo" nunca some
    const algumVisivel = [...col.querySelectorAll('.project-card')].some(c => !c.classList.contains('hidden'));
    col.classList.toggle('hidden', !algumVisivel);
  });
}
