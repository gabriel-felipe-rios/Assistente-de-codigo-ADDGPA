// ── MAPA DE I/O ──────────────────────────────────────────────────────────────

const MIO_ICONS = {
  read_file:   '📄',
  write_file:  '💾',
  read_dir:    '📂',
  create_dir:  '🗂️',
  delete_file: '🗑️',
  delete_dir:  '🗑️',
  delete:      '🗑️',
  check_file:  '🔍',
  check_dir:   '🔍',
  check_path:  '🔍',
};

const MIO_LABELS = {
  read_file:   'Lê arquivo',
  write_file:  'Escreve arquivo',
  read_dir:    'Lê pasta',
  create_dir:  'Cria pasta',
  delete_file: 'Deleta arquivo',
  delete_dir:  'Deleta pasta',
  delete:      'Deleta',
  check_file:  'Verifica arquivo',
  check_dir:   'Verifica pasta',
  check_path:  'Verifica caminho',
};

let _mioFiles          = [];
let _mioSelectedIndex  = -1;
// Instância da árvore (arvore-pastas.js) e o mapa chave → índice em _mioFiles.
let _mioArvore         = null;
let _mioPorChave       = {};
let _mioActiveFilter   = '';
let _mioAbort          = 0;
// A operacao aberta no painel de codigo agora, com as linhas ja lidas do disco.
// Guardado aqui, e nao lido do DOM: o botao de copiar precisa do numero da linha
// e do tipo da operacao, que a tela mostra formatados e nao daria para desfazer.
let _mioTrecho         = null;   // { entry, linhas: [{n, text}] }

function loadMapaIO() {
  const folders     = workspaceConfig.working_folders || [];
  const placeholder = document.getElementById('mio-placeholder');
  const content     = document.getElementById('mio-content');
  if (folders.length === 0) {
    placeholder.classList.remove('hidden');
    content.classList.add('hidden');
  } else {
    placeholder.classList.add('hidden');
    content.classList.remove('hidden');
    runMapaIO();
  }
}

async function runMapaIO() {
  const myToken = ++_mioAbort;

  const fileList = document.getElementById('mio-file-list');
  fileList.innerHTML = '<div class="tree-loading" style="padding:16px 14px">Escaneando arquivos...</div>';
  mioResetDetail();

  const r = await window.pywebview.api.scan_file_io(currentProject);
  if (myToken !== _mioAbort) return;

  fileList.innerHTML = '';

  if (!r.success) {
    fileList.innerHTML = `<div class="tree-error" style="padding:12px 14px">${escapeHtml(r.error)}</div>`;
    return;
  }

  _mioFiles         = r.files || [];
  _mioSelectedIndex = -1;

  if (_mioFiles.length === 0) {
    fileList.innerHTML = '<div class="tree-loading" style="padding:16px 14px">Nenhum acesso a disco detectado.</div>';
    return;
  }

  // Árvore aninhada de verdade: a chave é `pasta-de-trabalho/caminho/relativo`.
  // Antes esta lista tinha UM nível só — o backend já mandava `relative`, e o
  // frontend jogava fora com `.split().pop()`, deixando todos os arquivos
  // corridos embaixo do nome da pasta de trabalho.
  _mioPorChave = {};
  for (let i = 0; i < _mioFiles.length; i++) {
    _mioPorChave[_mioChave(_mioFiles[i])] = i;
  }

  _mioArvore = criarArvorePastas({
    container: fileList,
    caminhos: Object.keys(_mioPorChave),
    seloArquivo: chave => {
      const f = _mioFiles[_mioPorChave[chave]];
      return f ? f.io_count : null;
    },
    aoSelecionar: chave => mioSelectFile(_mioPorChave[chave]),
    vazio: 'Nenhum acesso a disco detectado.',
  });
  ligarBotoesArvore(() => _mioArvore, {
    expandir: 'btn-mio-expand-all',
    retrair: 'btn-mio-collapse-all',
    atualizar: 'btn-mio-refresh',
    aoAtualizar: () => loadMapaIO(),
  });
  // Depois do desenho: a busca filtra as LINHAS já no DOM, então precisa
  // existir alguma. `ligarBuscaArvore` é idempotente (marca o input), então
  // chamar de novo a cada recarga da árvore não empilha listeners.
  ligarBuscaArvore({
    input: 'mio-busca-input', botao: 'btn-mio-busca',
    modos: 'mio-busca-modos', aviso: 'mio-busca-aviso',
    container: 'mio-file-list',
  });
  _mioLigarBotoesCopiar();
}

// `folder` é o caminho ABSOLUTO da pasta de trabalho configurada — não um nome
// fixo. A árvore aninha DENTRO de cada pasta de trabalho, usando só o último
// segmento dela como raiz.
function _mioChave(file) {
  const raiz = (file.folder || '').split(/[/\\]/).filter(Boolean).pop() || '';
  const rel = (file.relative || '').replace(/\\/g, '/');
  return raiz ? `${raiz}/${rel}` : rel;
}

function mioSelectFile(idx) {
  _mioSelectedIndex = idx;
  const file = _mioFiles[idx];
  if (!file) return;

  document.getElementById('mio-detail-empty').classList.add('hidden');
  document.getElementById('mio-detail-content').classList.remove('hidden');

  document.getElementById('mio-detail-filename').textContent = _mioChave(file);
  document.getElementById('mio-detail-filename').title = file.path;

  _mioActiveFilter = '';
  document.querySelectorAll('.mio-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.miofilter === ''));

  mioRenderEntries(file.entries);
}

function mioRenderEntries(entries) {
  const list = document.getElementById('mio-entry-list');
  list.innerHTML = '';

  const filtered = _mioActiveFilter ? entries.filter(e => e.type === _mioActiveFilter) : entries;

  if (filtered.length === 0) {
    const msg = entries.length === 0
      ? 'Nenhuma operação de I/O encontrada.'
      : 'Nenhuma operação deste tipo neste arquivo.';
    list.innerHTML = `<div class="tree-loading">${msg}</div>`;
    return;
  }

  for (const entry of filtered) {
    const row = document.createElement('div');
    row.className = 'mio-entry-row';

    const badge = document.createElement('span');
    badge.className = `mio-type-badge mio-type-${entry.type}`;
    badge.textContent = `${MIO_ICONS[entry.type] || '•'} ${MIO_LABELS[entry.type] || entry.type}`;

    const body = document.createElement('div');
    body.className = 'mio-entry-body';

    const call = document.createElement('div');
    call.className = 'mio-entry-call';
    call.textContent = entry.call;

    const meta = document.createElement('div');
    meta.className = 'mio-entry-meta';
    // `alvo` é a EXPRESSÃO do argumento, como está escrita no código —
    // `os.path.join(base, 'x.json')`, não o caminho final no disco. O caminho
    // final não existe no código: é montado em execução a partir das pastas que
    // o usuário configura. Por isso o campo NÃO vem entre aspas: aspas
    // prometiam um literal, e o conteúdo quase nunca é um.
    // (O nome antigo era `path_arg`, e ele guardava a primeira coisa entre
    // aspas da linha — o que fazia `open(f, 'r')` exibir `"r"` como caminho.)
    if (entry.alvo) {
      const pathSpan = document.createElement('span');
      pathSpan.className = 'mio-path-arg';
      pathSpan.textContent = entry.alvo;
      meta.appendChild(pathSpan);
    }
    const lineSpan = document.createElement('span');
    lineSpan.className = 'ts-line-num';
    lineSpan.textContent = `:${entry.line}`;
    meta.appendChild(lineSpan);

    body.appendChild(call); body.appendChild(meta);
    row.appendChild(badge); row.appendChild(body);
    row.addEventListener('click', () => mioShowCode(entry, row));
    list.appendChild(row);
  }
}

function mioSetFilter(type) {
  _mioActiveFilter = type;
  document.querySelectorAll('.mio-filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.miofilter === type);
  });
  const file = _mioFiles[_mioSelectedIndex];
  if (file) mioRenderEntries(file.entries);
  mioResetCode();
}

function mioResetDetail() {
  _mioSelectedIndex = -1;
  document.getElementById('mio-detail-empty').classList.remove('hidden');
  document.getElementById('mio-detail-content').classList.add('hidden');
  mioResetCode();
}

function mioResetCode() {
  document.getElementById('mio-code-empty').classList.remove('hidden');
  document.getElementById('mio-code-content').classList.add('hidden');
  _mioTrecho = null;
  document.getElementById('btn-mio-copiar-trecho')?.classList.add('hidden');
}

async function mioShowCode(entry, el) {
  document.querySelectorAll('.mio-entry-row').forEach(r => r.classList.remove('active'));
  el.classList.add('active');

  const file = _mioFiles[_mioSelectedIndex];
  if (!file) return;

  document.getElementById('mio-code-empty').classList.add('hidden');
  const codeContent = document.getElementById('mio-code-content');
  codeContent.classList.remove('hidden');

  document.getElementById('mio-code-sym-name').textContent =
    `${MIO_ICONS[entry.type] || ''} ${MIO_LABELS[entry.type] || entry.type}`;
  document.getElementById('mio-code-location').textContent = `:${entry.line}`;

  const linesEl = document.getElementById('mio-code-lines');
  linesEl.innerHTML = '<div class="tree-loading">Carregando...</div>';

  const r = await window.pywebview.api.get_file_lines(file.path, entry.line, 4);
  linesEl.innerHTML = '';

  if (!r.success) {
    linesEl.innerHTML = `<div class="tree-error">${escapeHtml(r.error)}</div>`;
    return;
  }

  for (const line of r.lines) {
    const row = document.createElement('div');
    row.className = 'ts-code-line' + (line.highlight ? ' highlight' : '');
    const num  = document.createElement('span'); num.className  = 'ts-code-linenum'; num.textContent  = line.n;
    const text = document.createElement('span'); text.className = 'ts-code-text';    text.textContent = line.text;
    row.appendChild(num); row.appendChild(text);
    linesEl.appendChild(row);
  }

  // So agora "Caminho + trecho" faz sentido — antes disto nao ha trecho nenhum.
  _mioTrecho = { entry, linhas: r.lines };
  document.getElementById('btn-mio-copiar-trecho')?.classList.remove('hidden');
}

// ── Copiar para o chat ────────────────────────────────────────────────────
// O formato (envelope) é o compartilhado: copiar-contexto.js. O que muda aqui é
// só a FRASE de cabeçalho — ela existe para o modelo saber o que está lendo, e
// "trecho em volta de uma chamada de disco" não é a mesma coisa que "o arquivo
// inteiro".

// O caminho na forma `PastaDeTrabalho/caminho/relativo` — a mesma chave da
// árvore, e também a que `ler_arquivo_de_codigo` aceita no backend.
function _mioCaminhoAberto() {
  const file = _mioFiles[_mioSelectedIndex];
  return file ? _mioChave(file) : null;
}

function _mioCopiarCaminho() {
  const caminho = _mioCaminhoAberto();
  if (!caminho) return;
  copiarContexto(`Caminho do arquivo no projeto: ${caminho}`, 'Caminho copiado.');
}

function _mioCopiarTrecho() {
  const caminho = _mioCaminhoAberto();
  if (!caminho || !_mioTrecho) return;
  const { entry, linhas } = _mioTrecho;
  const rotulo = MIO_LABELS[entry.type] || entry.type;
  // O número da linha entra em CADA linha do bloco, não só no cabeçalho: o
  // trecho traz as vizinhas em volta da chamada, e sem a numeração o modelo não
  // tem como saber qual delas é a operação.
  const corpo = linhas.map(l => `${String(l.n).padStart(5)} | ${l.text}`).join('\n');
  const cabecalho =
    'Trecho de código de um arquivo do projeto, em volta de uma operação de disco '
    + `detectada pelo Mapa de I/O: ${rotulo}, na linha ${entry.line}`
    + (entry.alvo ? ` (alvo, como escrito no código: ${entry.alvo})` : '')
    + '. São apenas as linhas vizinhas, não o arquivo inteiro.';
  copiarContexto(envelopeDeContexto(cabecalho, caminho, corpo),
                 'Caminho e trecho copiados.');
}

async function _mioCopiarCodigo() {
  const caminho = _mioCaminhoAberto();
  if (!caminho) return;
  const r = await window.pywebview.api.ler_arquivo_de_codigo(currentProject, caminho);
  if (!r.success) { showToast(r.error || 'Erro ao ler o arquivo de código.', true); return; }
  copiarContexto(
    envelopeDeContexto('Conteúdo do arquivo de código abaixo, como está no projeto agora.',
                       caminho, r.content),
    'Caminho e código copiados.');
}

function _mioLigarBotoesCopiar() {
  const wire = (id, fn) => {
    const btn = document.getElementById(id);
    if (!btn || btn._mioWired) return;
    btn._mioWired = true;
    btn.addEventListener('click', fn);
  };
  wire('btn-mio-copiar-caminho', _mioCopiarCaminho);
  wire('btn-mio-copiar-trecho',  _mioCopiarTrecho);
  wire('btn-mio-copiar-codigo',  _mioCopiarCodigo);
}
