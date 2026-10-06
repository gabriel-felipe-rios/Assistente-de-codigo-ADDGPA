// ═══════════════════════════════════════════════════════════════ RESUMO ══
// As duas sub-abas de resumo da aba Projeto — painel puramente informativo.
//
//   Resumo indexado → o que sobra depois de descontar Remover (`ignore_list`)
//                     e Contexto sem leitura (`context_items`);
//   Resumo completo → tudo que está dentro das pastas de trabalho.
//
// As duas telas são LITERALMENTE iguais: mesmo markup (gerado pela mesma função
// em projeto-template.js), mesmo CSS, mesmos controles. A única diferença é a
// chave do conjunto que `scan_workspace` devolve — por isso tudo aqui é escrito
// uma vez e roda duas, e não há um "resumo completo" com código próprio.
//
// Morava em `treesitter.js`, que é o módulo da aba Análise → Tree-sitter e não
// tinha nada a ver com esta tela.

const RESUMO_VARIANTES = ['indexado', 'completo'];

// Profundidade inicial. Não é enfeite: sem teto, o Resumo completo de um projeto
// com `node_modules` tenta desenhar dezenas de milhares de linhas de uma vez.
// 4 níveis mostram a estrutura real de quase qualquer projeto; o slider sobe até
// a profundidade máxima que aquele conjunto realmente tem.
const RESUMO_PROFUNDIDADE_PADRAO = 4;

// Estado por variante: a instância da árvore, a lista completa de caminhos e a
// profundidade escolhida no slider.
const _resumoEstado = {
  indexado: { arvore: null, caminhos: [], pastas: [], extensoes: [],
              profundidade: RESUMO_PROFUNDIDADE_PADRAO },
  completo: { arvore: null, caminhos: [], pastas: [], extensoes: [],
              profundidade: RESUMO_PROFUNDIDADE_PADRAO },
};

let _resumoAbort = 0;

// ── Profundidade ────────────────────────────────────────────────────────────

// Profundidade = quantas pastas existem ABAIXO da pasta de trabalho. A própria
// pasta de trabalho é o nível 0, porque ela não é uma escolha: aparece sempre.
// Então, para `Program/Code/backend/api.py`:
//
//   Program (0, a pasta de trabalho) · Code (1) · backend (2) · api.py
//
// e profundidade 1 mostra o que está dentro da pasta de trabalho — que é o que
// a palavra promete. O primeiro corte contava a raiz junto e o nível 1 não
// mostrava pasta nenhuma; o máximo, pelo mesmo motivo, aparecia como 8 num
// projeto que tem 7 pastas aninhadas.
//
// Do caminho de um arquivo, os dois últimos "degraus" não são pasta escolhível:
// o nome do arquivo e a raiz. Daí o `- 2`.
function _resumoNivelArquivo(caminho) {
  return caminho.split('/').length - 2;
}

// Nível de uma PASTA: `Program` (a de trabalho) é 0, `Program/Code` é 1. Aqui
// não há nome de arquivo no fim, daí o `- 1` em vez do `- 2`.
function _resumoNivelPasta(caminho) {
  return caminho.split('/').length - 1;
}

// O máximo do slider sai das PASTAS, não dos arquivos: uma pasta vazia lá no
// fundo é profundidade real do projeto e tem que ser alcançável pelo slider.
function _resumoProfundidadeMaxima(st) {
  let max = 1;
  for (const c of st.pastas) {
    const n = _resumoNivelPasta(c);
    if (n > max) max = n;
  }
  for (const c of st.caminhos) {
    const n = _resumoNivelArquivo(c);
    if (n > max) max = n;
  }
  return max;
}

// Arquivos que sobrevivem ao corte: os que moram numa pasta dentro do limite.
function _resumoFiltrar(caminhos, profundidade) {
  return caminhos.filter(c => _resumoNivelArquivo(c) <= profundidade);
}

// As pastas dentro do limite. Vêm prontas do backend (`dirs`), que lista TODAS
// — inclusive as que não têm arquivo nenhum dentro. Derivar a lista dos caminhos
// dos arquivos, como era antes, fazia a pasta vazia sumir da árvore: ela não
// aparece em caminho de arquivo nenhum, por definição.
function _resumoPastasAte(pastas, profundidade) {
  return pastas.filter(p => _resumoNivelPasta(p) <= profundidade);
}

// ── Render de uma variante ──────────────────────────────────────────────────

function _resumoRedesenhar(chave) {
  const st = _resumoEstado[chave];
  if (!st.arvore) return;
  st.arvore.redesenhar(_resumoFiltrar(st.caminhos, st.profundidade),
                       _resumoPastasAte(st.pastas, st.profundidade));
}

function _resumoMontarArvore(chave) {
  const st = _resumoEstado[chave];
  const container = document.getElementById(`resumo-arvore-${chave}`);
  if (!container) return;

  st.arvore = criarArvorePastas({
    container,
    caminhos: _resumoFiltrar(st.caminhos, st.profundidade),
    pastas: _resumoPastasAte(st.pastas, st.profundidade),
    contarArquivos: false,
    expandido: true,
    vazio: 'Configure as pastas na aba Trabalho para ver a estrutura do projeto.',
  });

  ligarBotoesArvore(() => st.arvore, {
    expandir: `btn-resumo-${chave}-expand-all`,
    retrair:  `btn-resumo-${chave}-collapse-all`,
  });
}

// Marcado, a árvore preenche a largura da tela; desmarcado, volta a ser uma
// coluna só. É só a classe do container — o conteúdo desenhado é o mesmo.
function _resumoLigarColunas(chave) {
  const chk = document.getElementById(`resumo-colunas-${chave}`);
  const container = document.getElementById(`resumo-arvore-${chave}`);
  if (!chk || !container || chk._resumoWired) return;
  chk._resumoWired = true;
  chk.addEventListener('change', () => {
    container.classList.toggle('arvore-pastas--colunas', chk.checked);
  });
}

function _resumoLigarSlider(chave) {
  const slider = document.getElementById(`resumo-depth-${chave}`);
  if (!slider || slider._resumoWired) return;
  slider._resumoWired = true;
  slider.addEventListener('input', () => {
    const valor = parseInt(slider.value, 10);
    _resumoEstado[chave].profundidade = valor;
    document.getElementById(`resumo-depth-val-${chave}`).textContent = valor;
    _resumoRedesenhar(chave);
  });
}

function _resumoAtualizarSlider(chave) {
  const st = _resumoEstado[chave];
  const slider = document.getElementById(`resumo-depth-${chave}`);
  const valorEl = document.getElementById(`resumo-depth-val-${chave}`);
  if (!slider || !valorEl) return;

  const max = _resumoProfundidadeMaxima(st);
  // Projeto raso não deve ganhar um slider que vai até 4 sem nada acontecer nos
  // últimos passos: o máximo é a profundidade que o conjunto realmente tem.
  st.profundidade = Math.min(RESUMO_PROFUNDIDADE_PADRAO, max);
  slider.min = 1;
  slider.max = max;
  slider.value = st.profundidade;
  slider.disabled = (st.caminhos.length === 0 && st.pastas.length === 0) || max <= 1;
  valorEl.textContent = st.profundidade;
}

function _resumoPreencherStats(chave, dados) {
  document.getElementById(`stat-folders-${chave}`).textContent =
    dados.folders.toLocaleString('pt-BR');
  document.getElementById(`stat-files-${chave}`).textContent =
    dados.files.toLocaleString('pt-BR');
  document.getElementById(`stat-lines-${chave}`).textContent =
    dados.lines.toLocaleString('pt-BR');

  const langsEl = document.getElementById(`stat-langs-${chave}`);
  langsEl.innerHTML = '';
  if (!dados.languages.length) {
    langsEl.innerHTML = '<span class="stat-vazio">—</span>';
    return;
  }
  for (const [lang, n] of dados.languages) {
    const chip = document.createElement('span');
    chip.className = 'lang-chip';
    const nome = document.createElement('b');
    nome.textContent = lang;
    chip.appendChild(nome);
    chip.appendChild(document.createTextNode(` ${n.toLocaleString('pt-BR')}`));
    langsEl.appendChild(chip);
  }
}

function _resumoPlaceholder(texto) {
  for (const chave of RESUMO_VARIANTES) {
    for (const id of [`stat-folders-${chave}`, `stat-files-${chave}`,
                      `stat-lines-${chave}`]) {
      const el = document.getElementById(id);
      if (el) el.textContent = texto;
    }
    const langsEl = document.getElementById(`stat-langs-${chave}`);
    if (langsEl) langsEl.innerHTML = `<span class="stat-vazio">${texto}</span>`;
  }
}

// ── Carga ───────────────────────────────────────────────────────────────────

// Uma chamada só a `scan_workspace` alimenta as duas telas (e a Estrutura de Remover e Contexto sem leitura) — o backend faz uma
// varredura e devolve os dois conjuntos. Chamada por workspace.js (ao abrir o
// projeto), remover.js e modais.js (sempre que a lista de ignorados muda).
async function loadSummary() {
  const meuToken = ++_resumoAbort;

  const folders = workspaceConfig.working_folders || [];
  if (folders.length === 0) {
    _resumoPlaceholder('—');
    for (const chave of RESUMO_VARIANTES) {
      _resumoEstado[chave].caminhos  = [];
      _resumoEstado[chave].pastas     = [];
      _resumoEstado[chave].extensoes  = [];
      _resumoAtualizarSlider(chave);
      if (_resumoEstado[chave].arvore) _resumoRedesenhar(chave);
      else _resumoMontarArvore(chave);
      _resumoLigarSlider(chave);
      _resumoLigarColunas(chave);
      _resumoLigarExtensoes(chave);
    }
    if (typeof pcamRedesenharEstruturas === 'function') pcamRedesenharEstruturas();
    return;
  }

  _resumoPlaceholder('…');

  const r = await window.pywebview.api.scan_workspace(currentProject);
  if (meuToken !== _resumoAbort) return; // varredura mais recente começou

  if (!r.success) {
    _resumoPlaceholder('—');
    return;
  }

  for (const chave of RESUMO_VARIANTES) {
    const dados = r[chave] || { folders: 0, files: 0, lines: 0,
                                languages: [], extensions: [], paths: [], dirs: [] };
    _resumoPreencherStats(chave, dados);
    _resumoEstado[chave].caminhos  = dados.paths || [];
    _resumoEstado[chave].pastas    = dados.dirs || [];
    _resumoEstado[chave].extensoes = dados.extensions || [];
    _resumoAtualizarSlider(chave);
    if (_resumoEstado[chave].arvore) _resumoRedesenhar(chave);
    else _resumoMontarArvore(chave);
    _resumoLigarSlider(chave);
    _resumoLigarColunas(chave);
    _resumoLigarExtensoes(chave);
  }
  // A Estrutura de Remover e Contexto sem leitura é este mesmo conjunto
  // (o completo) — ver projeto-caminhos.js.
  if (typeof pcamRedesenharEstruturas === 'function') pcamRedesenharEstruturas();
}
