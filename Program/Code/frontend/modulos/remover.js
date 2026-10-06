// ══════════════════════════════════════════════════════════════ REMOVER ══
// Projeto › Remover: o que some do programa inteiro, neste projeto — menos do
// Editor. O desenho e o comportamento são os do componente único
// `projeto-caminhos.js` (D46); aqui fica só o que é desta lista: ela mora em
// `workspaceConfig.ignore_list`, cada item é
// `{ path, type: 'file'|'folder', recursive, quem_pode_ler }`, e a pasta tem
// escopo (✏ alterna entre com subpastas e só a pasta).
//
// Pasta entra COM as subpastas (`recursive: true`), sem perguntar: o tipo se
// escolhe no item. O modal de escopo que perguntava na entrada saiu com a
// reformulação da fase 06 da obra «Qualidade da documentação».

registrarListaDeCaminhos({
  chave: 'remover',
  titulo: 'Remover',
  itens: () => (workspaceConfig.ignore_list = workspaceConfig.ignore_list || []),
  novoItem: (path, ehPasta) => ehPasta
    ? { path, type: 'folder', recursive: true }
    : { path, type: 'file', recursive: false },
  comEscopo: true,
  comDescricao: false,
  sempreComSubpastas: false,
  vazio: 'Nada removido neste projeto.',
  // Remover muda os números do Resumo indexado.
  depoisDeMudar: () => loadSummary(),
});

// Chamada por workspace.js (ao abrir o projeto) e por editor-assistente.js.
function renderIgnoreList() {
  pintarListaDeCaminhos('remover');
}

// «＋ Adicionar ▾» — ligados em navegacao.js.
async function browseAndAddIgnoreFolder() {
  const r = await window.pywebview.api.browse_path('folder');
  if (r.success && r.path) await acrescentarCaminhos('remover', [{ path: r.path, isDirectory: true }]);
}
async function browseAndAddIgnoreFile() {
  const r = await window.pywebview.api.browse_path('file');
  if (r.success && r.path) await acrescentarCaminhos('remover', [{ path: r.path, isDirectory: false }]);
}
