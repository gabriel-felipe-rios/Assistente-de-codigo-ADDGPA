// ══ ACERVO → o painel do editor ═══════════════════════════════════════════
//
// Abrir o painel da direita, montar o cabeçalho e fechá-lo. Só isso — quem
// PREENCHE o editor é `regras-lista.js` (`regrasAbrirLeitura`,
// `regrasAbrirArquivoNovo`), e quem grava é `regras-acervo.js`.
//
// ⚠️ A METADE ESTRUTURADA DESTE ARQUIVO FOI EMBORA EM 04/09/2026, e não por
// arrumação: `regrasSelectItem`, `_regrasRenderAbasDeArquivo`,
// `_regrasExtrairSecoes`, `_regrasTituloEditavel`, `salvarItemAberto`,
// `regrasNovoItem`, `novoArquivoDeInstrucao` e `removerItem` eram o editor de
// Regra/Instrução da sub-aba "Regras e instruções". Ela deixou de ser especial
// e virou pasta comum do Acervo, com árvore e editor de arquivo, como todas as
// outras — e nada mais chamava aquelas funções. Deixá-las aqui seria manter de
// pé um segundo caminho de ESCRITA que nenhum botão alcança.
//
// ⚠️ O BACKEND ESTRUTURADO CONTINUA INTOCADO: `save_regra`, `list_regras` e
// `deletar_regra` seguem em `regras_indice.py`, e quem os usa é o CHAT
// (`chat-payload.js`). O que caiu foi a TELA, não o formato no disco.

// ── Editor ─────────────────────────────────────────────────────────────────

function _regrasAbrirPainelEditor() {
  document.getElementById('regras-placeholder').classList.add('hidden');
  document.getElementById('regras-search-results').classList.add('hidden');
  document.getElementById('regras-editor').classList.remove('hidden');
}

// Mostra/esconde o par 💾/✕ do cabeçalho do editor — a ação de salvar de cada
// item aberto (estruturado, arquivo de instrução ou arquivo livre do Acervo)
// passa por aqui, e não mais pelo ícone fixo que existia no cabeçalho da
// árvore (removido — Obra 6, item 7 do plano).
function _regrasHeaderAcoes(mostrarSalvar, mostrarDeletar) {
  document.getElementById('regras-editor-header-acoes').classList.toggle('hidden', !mostrarSalvar && !mostrarDeletar);
  document.getElementById('btn-regras-salvar').classList.toggle('hidden', !mostrarSalvar);
  document.getElementById('btn-regras-deletar-item').classList.toggle('hidden', !mostrarDeletar);
}

// O título do editor é sempre FIXO agora. Ele já foi um `<input>` para nomear
// arquivo novo; o nome passou a ser pedido no modal do menu, junto do destino.
// A guarda de INPUT abaixo fica como rede: um título que tenha sobrado como
// campo volta a ser `<span>` em vez de ignorar o `textContent` em silêncio.
function _regrasTituloFixo(texto) {
  const atual = document.getElementById('regras-editor-title');
  if (atual.tagName === 'INPUT') {
    const span = document.createElement('span');
    span.className = 'regras-editor-title';
    span.id = 'regras-editor-title';
    atual.replaceWith(span);
  }
  document.getElementById('regras-editor-title').textContent = texto;
}


function regrasCloseEditor() {
  _regraAtiva = null;
  _regraArquivoAcervo = null;
  _regrasSaveHandler = null;
  _regrasDeleteHandler = null;
  if (_regrasArvore) _regrasArvore.selecionar(null);
  document.getElementById('regras-editor').classList.add('hidden');
  document.getElementById('regras-search-results').classList.add('hidden');
  document.getElementById('regras-placeholder').classList.remove('hidden');
}
