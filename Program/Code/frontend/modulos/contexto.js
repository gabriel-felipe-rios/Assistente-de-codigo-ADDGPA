// ══════════════════════════════════════════════════════════════ CONTEXTO ══
// Projeto › Contexto sem leitura: o que não é lido — quem pede o arquivo
// recebe a descrição escrita aqui. Mesmo componente do Remover
// (`projeto-caminhos.js`, D46); o que é só desta lista: ela mora em
// `workspaceConfig.context_items`, vale sempre com as subpastas (não tem
// ✏ escopo), e cada item tem a descrição (`description`), gravada ao sair do
// campo (D47).
//
// Item antigo não tem `type` — o componente adivinha pelo nome, como a tela
// antiga fazia. Item novo grava `type` ('file' | 'folder'); o backend
// (`ignorados.esta_em_contexto`) não lê o campo.

registrarListaDeCaminhos({
  chave: 'contexto',
  titulo: 'Contexto sem leitura',
  itens: () => (workspaceConfig.context_items = workspaceConfig.context_items || []),
  novoItem: (path, ehPasta) => ({ path, type: ehPasta ? 'folder' : 'file', description: '' }),
  comEscopo: false,
  comDescricao: true,
  sempreComSubpastas: true,
  vazio: 'Nada em contexto sem leitura neste projeto.',
  // O Resumo indexado desconta o Contexto sem leitura.
  depoisDeMudar: () => loadSummary(),
});

// Chamada por workspace.js (ao abrir o projeto) e por editor-assistente.js.
function renderContextList() {
  pintarListaDeCaminhos('contexto');
}

// «＋ Adicionar ▾» — ligados em navegacao.js.
async function browseAndAddContextFolder() {
  const r = await window.pywebview.api.browse_path('folder');
  if (r.success && r.path) await acrescentarCaminhos('contexto', [{ path: r.path, isDirectory: true }]);
}
async function browseAndAddContextFile() {
  const r = await window.pywebview.api.browse_path('file');
  if (r.success && r.path) await acrescentarCaminhos('contexto', [{ path: r.path, isDirectory: false }]);
}
