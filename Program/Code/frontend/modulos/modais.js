// ══════════════════════════════════════════════════════════════ MODAIS ══
function bindModals() {
  // Novo projeto
  document.getElementById('btn-cancel-project').addEventListener('click', closeNewProjectModal);
  document.getElementById('btn-confirm-project').addEventListener('click', confirmNewProject);
  document.getElementById('input-project-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmNewProject();
    if (e.key === 'Escape') closeNewProjectModal();
  });

  // Importar pasta como projeto (arrastada na grade)
  document.getElementById('btn-cancel-import').addEventListener('click', fecharModalImportar);
  document.getElementById('btn-import-only').addEventListener('click', () => confirmarImportar(false));
  document.getElementById('btn-import-preparar').addEventListener('click', () => confirmarImportar(true));

  // Renomear
  document.getElementById('btn-cancel-rename').addEventListener('click', closeRenameModal);
  document.getElementById('btn-confirm-rename').addEventListener('click', confirmRename);
  document.getElementById('input-rename').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmRename();
    if (e.key === 'Escape') closeRenameModal();
  });

  // Deletar
  document.getElementById('btn-cancel-delete').addEventListener('click', fecharModalRemover);
  document.getElementById('btn-confirm-delete').addEventListener('click', confirmarRemocao);
}

// ── Novo projeto ──
// `nomeInicial` existe para o arrastar: nome de pasta que colide com um projeto
// ou tem caractere inválido abre ESTE modal já preenchido, para o usuário
// corrigir — em vez de só receber uma recusa e ter de começar do zero (D8).
async function openNewProjectModal(nomeInicial) {
  const input = document.getElementById('input-project-name');
  input.value = nomeInicial || '';
  setError('modal-new-error', '');

  // Mesmo início rápido da tela de Importar (`load_inicio_rapido_config`) — as duas
  // criações passaram a compartilhar os mesmos campos de propósito.
  const sel = document.getElementById('new-project-preset');
  const cfg = await window.pywebview.api.load_inicio_rapido_config();
  const validos = (cfg && cfg.success)
    ? (cfg.presets || []).filter(p => !(cfg.erros[p.nome] || []).length) : [];
  sel.innerHTML = '<option value="">Nenhum (pasta vazia)</option>' +
    validos.map(p => `<option value="${escapeHtml(p.nome)}">${escapeHtml(p.nome)}</option>`).join('');
  if (validos.some(p => p.nome === cfg.escolhido)) sel.value = cfg.escolhido;

  await taxCarregar();
  montarGrupoSubgrupoSelects(
    document.getElementById('new-project-grupo'),
    document.getElementById('new-project-subgrupo'), null, null);
  montarTagPicker(document.getElementById('new-project-tags'), []);
  montarDescricaoRetratil(
    document.getElementById('new-project-desc-toggle'),
    document.getElementById('new-project-desc-painel'),
    document.getElementById('new-project-desc-texto'), '');

  document.getElementById('modal-new-project').classList.remove('hidden');
  input.focus();
  input.select();
}
function closeNewProjectModal() { document.getElementById('modal-new-project').classList.add('hidden'); }
async function confirmNewProject() {
  const name = document.getElementById('input-project-name').value.trim();
  if (!name) { setError('modal-new-error', 'Dê um nome ao projeto.'); return; }
  try {
    const r = await window.pywebview.api.create_project(name);
    if (!r) { setError('modal-new-error', 'Sem resposta do backend.'); return; }
    if (!r.success) { setError('modal-new-error', r.error || 'Erro desconhecido.'); return; }

    const preset = document.getElementById('new-project-preset').value;
    if (preset) {
      const prep = await window.pywebview.api.preparar_projeto(name, preset);
      if (!prep || !prep.success) showToast('Projeto criado, mas o Preparar falhou.', true);
    }
    await _persistirOrganizacaoInicial(name, {
      grupoId: document.getElementById('new-project-grupo').value,
      subgrupoId: document.getElementById('new-project-subgrupo').value,
      tagIds: lerTagPicker(document.getElementById('new-project-tags')),
      descricao: document.getElementById('new-project-desc-texto').value,
    });
    closeNewProjectModal();
    await loadProjects();
  } catch (e) {
    setError('modal-new-error', 'Erro ao criar projeto: ' + (e.message || e));
  }
}

// ── Editar Projeto (nome + grupo/subgrupo/tags — era só "Renomear") ──
async function openRenameModal(name) {
  pendingRenameName = name;
  const input = document.getElementById('input-rename');
  input.value = name;
  setError('modal-rename-error', '');
  await popularOrganizacaoNoModalEditar(name);
  document.getElementById('modal-rename').classList.remove('hidden');
  input.focus(); input.select();
}
function closeRenameModal() { document.getElementById('modal-rename').classList.add('hidden'); pendingRenameName = null; }
async function confirmRename() {
  const newName = document.getElementById('input-rename').value.trim();
  if (!newName) { setError('modal-rename-error', 'Digite um nome.'); return; }
  const nomeOriginal = pendingRenameName;
  if (newName !== nomeOriginal) {
    const r = await window.pywebview.api.rename_project(nomeOriginal, newName);
    if (!r.success) { setError('modal-rename-error', r.error); return; }
  }
  await persistirOrganizacaoDoProjeto(newName);
  closeRenameModal();
  await loadProjects();
}

// ── Deletar ──
function abrirModalRemover(name) {
  pendingDeleteName = name;
  document.getElementById('delete-project-name').textContent = `"${name}"`;
  document.getElementById('modal-delete').classList.remove('hidden');
}
function fecharModalRemover() { document.getElementById('modal-delete').classList.add('hidden'); pendingDeleteName = null; }
async function confirmarRemocao() {
  const r = await window.pywebview.api.deletar_projeto(pendingDeleteName);
  fecharModalRemover();
  if (r.success) await loadProjects();
  // ⚠️ Notificação, e não `alert()` nativo: a pergunta já foi feita e
  // respondida no `#modal-delete`; o que falta é só contar o que deu errado.
  else showToast(r.error || 'Não deu para remover o projeto.', true);
}

// ── Configurações ──
// O modal da engrenagem deixou de existir. As três configurações que moravam
// nele — URL do LM Studio, e o liga/desliga e o tempo do subagente — foram para
// a aba Configurações, onde já estava todo o resto: a URL em "Modelo e
// contexto", o tempo em "Tempos e ciclos". Com elas foi embora
// `modais-template.js` inteiro.

// ── Modal de prompt ──
// O prompt de cada rotina: a lista ÚNICA.
//
// Cinco arquivos JS repetiam o caminho do arquivo de prompt e o rótulo, cada um
// no seu `addEventListener`. Quando a pasta `prompts/` foi reorganizada, os
// cinco tinham que mudar juntos — e esquecer um faz o botão "ver prompt" parar
// de abrir SEM quebrar o agente: a falha mais difícil de notar que existe aqui.
// Agora o nome do arquivo mora num lugar só, e cada card diz apenas de qual
// rotina ele é.
//
// A chave é o id da rotina; o valor é [arquivo em prompts/Rotinas/, rótulo].
const PROMPT_DA_ROTINA = {
  'documentacao-tecnica': ['documentacao-tecnica', 'Documentação Técnica'],
  'resumo-pastas':        ['resumo-de-pastas',     'Resumo de Pastas'],
  'glossario':            ['glossario',            'Glossário'],
  'pipeline':             ['pipeline',             'Pipeline'],
};

// Liga o botão "ver prompt" de uma rotina. O id do botão é sempre
// `btn-prompt-{id da rotina}` — a convenção que os cinco cards já seguiam.
function ligarBotaoDePrompt(idRotina) {
  const btn = document.getElementById(`btn-prompt-${idRotina}`);
  const prompt = PROMPT_DA_ROTINA[idRotina];
  if (!btn || !prompt) return;
  btn.addEventListener('click', () => showPromptModal(prompt[0], prompt[1]));
}

async function showPromptModal(templateName, agentLabel) {
  const modal = document.getElementById('modal-prompt-view');
  const content = document.getElementById('modal-prompt-content');
  const title = document.getElementById('modal-prompt-title');
  title.textContent = 'Prompt — ' + agentLabel;
  content.textContent = 'Carregando...';
  modal.classList.remove('hidden');
  const r = await window.pywebview.api.get_prompt_template(templateName);
  content.textContent = r.success ? r.content : ('Erro: ' + r.error);
}

function closePromptModal() {
  document.getElementById('modal-prompt-view').classList.add('hidden');
}
