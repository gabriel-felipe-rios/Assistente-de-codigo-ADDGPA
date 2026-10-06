// ══════════════════════════════════════════════════════ TELA: PROJETOS ══
function bindProjectsScreen() {
  // ⚠️ NÃO passar `openNewProjectModal` direto pro listener: `addEventListener`
  // chama o handler com o PointerEvent do clique, e `openNewProjectModal`
  // aceita um argumento (`nomeInicial`, usado pelo fluxo de nome-colidiu-na-
  // importação) — sem o wrapper, o evento inteiro virava o valor do campo
  // "Nome do projeto", aparecendo como o texto literal "[object PointerEvent]".
  // Este era o bug relatado pelo usuário.
  document.getElementById('btn-new-project').addEventListener('click', () => openNewProjectModal());
  document.getElementById('btn-manage-projects').addEventListener('click', abrirModalGerenciarProjetos);
  ligarBuscaDeProjetos();

  // Abas principais da tela de Projetos (Projetos / Arquivos)
  document.querySelectorAll('.main-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.projects-tab-content').forEach(c => {
        c.classList.remove('active'); c.classList.add('hidden');
      });
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.ptab);
      target.classList.remove('hidden');
      target.classList.add('active');
      // Reação (D46): na tela de Projetos não há projeto aberto para a aba.
      if (typeof xtEmitir === 'function') {
        xtEmitir('aba.abriu', { projeto: null, aba: btn.dataset.ptab, barra: 'project_screen_tabs' });
      }
      if (btn.dataset.ptab === 'ptab-arquivos') initGlobalArquivosTab();
      if (btn.dataset.ptab === 'ptab-plugins' && typeof initGlobalPluginsTab === 'function') initGlobalPluginsTab();
    });
  });

  // Sub-abas do painel global de Arquivos
  document.querySelectorAll('.garq-subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.garq-subtab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.garq-subtab-content').forEach(c => {
        c.classList.remove('active'); c.classList.add('hidden');
      });
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.garqsubtab);
      target.classList.remove('hidden');
      target.classList.add('active');
    });
  });

  _ligarSoltaDeProjeto();
}

// ── Arrastar uma pasta na grade de Projetos ─────────────────────────────────
// ⚠️ `setupDropZone`, o de item Único, e NÃO `setupDropZoneMulti`. Não é
// limitação técnica — o mecanismo múltiplo existe e foi RECUSADO: soltar duas
// pastas criaria dois projetos de uma vez, sem querer. Solta dupla importa a
// primeira e só (D35).
function _ligarSoltaDeProjeto() {
  const zona = document.getElementById('projects-drop');
  if (!zona || zona._wired) return;
  zona._wired = true;
  setupDropZone(zona, (path, isDirectory) => {
    if (!isDirectory) {
      showToast('Solte uma PASTA — um arquivo solto não vira projeto.', true);
      return;
    }
    abrirModalImportar(path);
  });
}

let _importarPasta = null;

async function abrirModalImportar(path) {
  _importarPasta = path;
  setError('modal-import-error', '');

  // Na caixa vai só o nome da pasta — o caminho completo fica no title, para quem
  // quiser conferir de onde veio sem poluir a decisão com uma linha de caminho.
  const nome = path.replace(/[\/]+$/, '').split(/[\/]/).pop();
  const elNome = document.getElementById('import-project-nome');
  elNome.textContent = nome;
  elNome.title = path;

  // Só preset válido vira opção — igual à sub-aba Preparar.
  const sel = document.getElementById('import-project-preset');
  const cfg = await window.pywebview.api.load_inicio_rapido_config();
  const validos = (cfg && cfg.success)
    ? (cfg.presets || []).filter(p => !(cfg.erros[p.nome] || []).length) : [];
  sel.innerHTML = validos.map(p =>
    `<option value="${escapeHtml(p.nome)}">${escapeHtml(p.nome)}</option>`).join('');
  if (validos.some(p => p.nome === cfg.escolhido)) sel.value = cfg.escolhido;
  document.getElementById('btn-import-preparar').disabled = !validos.length;

  await taxCarregar();
  montarGrupoSubgrupoSelects(
    document.getElementById('import-project-grupo'),
    document.getElementById('import-project-subgrupo'), null, null);
  montarTagPicker(document.getElementById('import-project-tags'), []);
  montarDescricaoRetratil(
    document.getElementById('import-project-desc-toggle'),
    document.getElementById('import-project-desc-painel'),
    document.getElementById('import-project-desc-texto'), '');

  document.getElementById('modal-import-project').classList.remove('hidden');
}

function fecharModalImportar() {
  document.getElementById('modal-import-project').classList.add('hidden');
  _importarPasta = null;
}

// Grava grupo/subgrupo/tags/descrição depois que o projeto já existe de
// verdade — melhor esforço: o projeto foi criado independente do resultado
// disto, então uma falha aqui vira aviso, nunca desfaz a criação.
async function _persistirOrganizacaoInicial(nomeProjeto, { grupoId, subgrupoId, tagIds, descricao }) {
  const avisos = [];
  if (grupoId || subgrupoId) {
    const r = await window.pywebview.api.definir_grupo_do_projeto(nomeProjeto, grupoId || null, subgrupoId || null);
    if (!taxAtualizarCache(r).success) avisos.push('grupo/subgrupo');
  }
  if (tagIds && tagIds.length) {
    const r = await window.pywebview.api.definir_tags_do_projeto(nomeProjeto, tagIds);
    if (!taxAtualizarCache(r).success) avisos.push('tags');
  }
  if (descricao && descricao.trim()) {
    const r = await window.pywebview.api.salvar_descricao_do_projeto(nomeProjeto, descricao);
    if (r && r.success) taxDescricaoCache(nomeProjeto, descricao.trim());
    else avisos.push('descrição');
  }
  if (avisos.length) {
    showToast(`Projeto criado, mas não deu para salvar: ${avisos.join(', ')}.`, true);
  }
}

async function confirmarImportar(preparar) {
  if (!_importarPasta) return;
  const sel = document.getElementById('import-project-preset');
  const preset = sel && sel.value ? sel.value : null;
  const r = await window.pywebview.api.importar_pasta_como_projeto(_importarPasta, preset, preparar);

  if (!r || !r.success) {
    // Nome que colide ou com caractere inválido não é recusado e pronto: abre o
    // modal de Novo Projeto já preenchido, para o usuário corrigir ali (D8).
    if (r && r.corrigir) {
      fecharModalImportar();
      openNewProjectModal(r.nome_sugerido);
      setError('modal-new-error', r.error);
      return;
    }
    setError('modal-import-error', (r && r.error) || 'Erro ao importar.');
    return;
  }

  await _persistirOrganizacaoInicial(r.name, {
    grupoId: document.getElementById('import-project-grupo').value,
    subgrupoId: document.getElementById('import-project-subgrupo').value,
    tagIds: lerTagPicker(document.getElementById('import-project-tags')),
    descricao: document.getElementById('import-project-desc-texto').value,
  });

  fecharModalImportar();
  await loadProjects();
  const erros = (r.preparar && r.preparar.erros) || [];
  if (r.preparar && !r.preparar.success) {
    showToast('Projeto criado, mas o Preparar falhou: ' + r.preparar.error, true);
  } else if (erros.length) {
    showToast('Projeto criado e preparado, com avisos: ' + erros.join('; '), true);
  } else {
    showToast(preparar ? 'Projeto importado e preparado.' : 'Projeto importado.');
  }
}

async function loadProjects() {
  const projects = await window.pywebview.api.list_projects();
  // O desenho do quadro (colunas por grupo/subgrupo, pills de tag) mora em
  // `projetos-kanban.js` — `renderProjects` virou um alias fino por
  // compatibilidade de nome com quem ainda chama a função antiga.
  await renderKanban(projects);
  reaplicarFiltroDeBusca();
}

function renderProjects(projects) { return renderKanban(projects); }
