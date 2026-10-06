// ══ DOCUMENTAÇÃO → as três buscas, e a ligação da tela ════════════════════
//
// ⚠️ SÃO TRÊS BUSCAS DIFERENTES, e não três modos da mesma. Por NOME filtra o
// que já está na árvore, sem ir ao disco e preservando o estado de expansão;
// por CONTEÚDO pergunta ao backend; SEMÂNTICA consulta os embeddings. A
// primeira precisa ser instantânea, a terceira precisa de um banco gerado — e
// unificá-las faria a rápida ficar lenta ou a semântica ficar muda quando o
// banco não existe.
//
// ⚠️ A BUSCA SEMÂNTICA SEM BANCO DIZ QUAL AGENTE O GERA, em vez de "nada
// encontrado" — que o usuário leria como "não existe".

// ── Busca por nome (in-place, preserva expanded state) ───────────────────

// Casca fina sobre `filtrarArvorePorCaminho` (arvore-pastas.js). O corpo desta
// função era a única implementação do filtro; virou compartilhada quando a aba
// Análise passou a filtrar as árvores dela do mesmo jeito.
// Pipeline, Glossário e Índice de navegação têm a árvore de níveis
// (documentacao-arvores.js), que filtra do mesmo jeito — por `display`, sem
// redesenhar — e mostra também os pais de quem casa.
function docFilterByName(query) {
  if (_docFonteAtual().render === 'niveis') { _docArvFiltrar(query); return; }
  const tree = document.getElementById('doc-tree');
  const q = query.trim().toLowerCase();
  filtrarArvorePorCaminho(tree, q ? caminho => caminho.toLowerCase().includes(q) : null);
}

// ── Busca por conteúdo ────────────────────────────────────────────────────

async function docSearchContent(query) {
  if (!query.trim()) return;
  const resultsEl = document.getElementById('doc-search-results');
  resultsEl.innerHTML = '<div class="doc-empty">Buscando...</div>';
  _docShowPanel('results');

  const r = await window.pywebview.api.search_doc_content(currentProject, query, _docFonte);
  if (!r.success) {
    resultsEl.innerHTML = `<div class="doc-empty">Erro: ${r.error}</div>`;
    return;
  }
  _docRenderResults(resultsEl, r.results, query);
}

// ── Busca semântica ───────────────────────────────────────────────────────

async function docSearchSemantic(query, tipo = _docFonte) {
  if (!query.trim()) return;
  const resultsEl = document.getElementById('doc-search-results');
  resultsEl.innerHTML = '<div class="doc-empty">Buscando...</div>';
  _docShowPanel('results');

  const r = await window.pywebview.api.search_embeddings(currentProject, query, tipo);
  if (!r.success) {
    resultsEl.innerHTML = `<div class="doc-empty">Erro: ${r.error}</div>`;
    return;
  }
  if (r.message) {
    resultsEl.innerHTML = `<div class="doc-empty">${r.message}</div>`;
    return;
  }
  _docRenderResults(resultsEl, r.results.map(res => ({
    doc_path: res.doc_path,
    tipo: res.tipo || tipo,
    excerpt: res.excerpt,
    score: Math.round(res.score * 100),
  })));
}

function _docRenderResults(container, results, highlightQuery) {
  if (!results || !results.length) {
    container.innerHTML = '<div class="doc-empty">Nenhum resultado encontrado.</div>';
    return;
  }
  container.innerHTML = results.map(res => {
    const path  = res.doc_path || '';
    const tipo  = res.tipo || _docFonte;
    const name  = path.split(/[\\/]/).pop().replace('.md', '');
    const score = res.score != null ? `<span class="doc-result-score">${res.score}%</span>` : '';
    // Tudo escapado: `path`, `name` e `excerpt` vêm de nomes de arquivo e do
    // conteúdo dos .md, que o LLM escreveu — um `<` no texto quebraria o card.
    return `
      <div class="doc-search-result" data-path="${escapeHtml(path)}" data-name="${escapeHtml(name)}" data-tipo="${escapeHtml(tipo)}">
        <div class="doc-result-header">
          <span class="doc-result-name">${escapeHtml(name)}</span>${score}
        </div>
        <div class="doc-result-excerpt">${escapeHtml(res.excerpt || '')}</div>
      </div>`;
  }).join('');

  container.querySelectorAll('.doc-search-result').forEach(el => {
    // `tipo` do resultado é o nome da pasta do agente — a mesma chave que
    // abrirDocArtefato espera. O if/else por fonte deixou de ser necessário.
    el.addEventListener('click', () => abrirDocArtefato(el.dataset.tipo, el.dataset.path, el.dataset.name));
  });
}

// ── Binding ───────────────────────────────────────────────────────────────

function bindDocumentacao() {
  // Arrow em vez de passar loadDocTree direto: o handler receberia o Event como
  // primeiro argumento, e um Event é truthy — cairia como `jaGerou = true` e
  // desligaria a geração automática da Bibliotecas.
  document.getElementById('btn-doc-refresh').addEventListener('click', () => loadDocTree());
  document.getElementById('btn-doc-regerar').addEventListener('click', () => _docRegerar());
  document.getElementById('btn-doc-expand-all').addEventListener('click', docExpandAll);
  document.getElementById('btn-doc-collapse-all').addEventListener('click', docCollapseAll);

  document.getElementById('btn-doc-viewer-close').addEventListener('click', () => {
    _docShowPanel('default');
    _docArvDesmarcar();
  });

  // O id citado no texto do Pipeline (`a.doc-link-id`, criado por
  // `_docPipeLigarIds`) abre aquele item. Ouvinte ÚNICO no visualizador: o
  // conteúdo é trocado a cada documento, e um ouvinte por link se perderia.
  document.getElementById('doc-viewer-content').addEventListener('click', e => {
    const link = e.target.closest('a.doc-link-id');
    if (!link) return;
    e.preventDefault();
    _docArvAbrirId(link.dataset.id);
  });

  document.getElementById('btn-doc-copiar-caminho').addEventListener('click', _docCopiarCaminho);
  document.getElementById('btn-doc-copiar-caminho-documento').addEventListener('click', _docCopiarCaminhoDocumento);
  document.getElementById('btn-doc-copiar-caminho-codigo').addEventListener('click', _docCopiarCodigo);
  document.getElementById('btn-doc-copiar-documento').addEventListener('click', _docCopiarDocumento);

  const searchInput = document.getElementById('doc-search-input');
  const searchBtn   = document.getElementById('btn-doc-search');

  let _nameTimer = null;
  searchInput.addEventListener('input', e => {
    if (_docSearchType !== 'nome') return;
    clearTimeout(_nameTimer);
    _nameTimer = setTimeout(() => docFilterByName(e.target.value), 250);
  });

  const _docDispatchSearch = () => {
    if (_docSearchType === 'semantica') docSearchSemantic(searchInput.value, _docFonte);
    else if (_docSearchType === 'conteudo') docSearchContent(searchInput.value);
    else docFilterByName(searchInput.value);
  };

  searchInput.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    _docDispatchSearch();
  });

  searchBtn.addEventListener('click', _docDispatchSearch);

  document.querySelectorAll('#doc-busca-modos .bsa-modo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const prevType = _docSearchType;
      document.querySelectorAll('#doc-busca-modos .bsa-modo-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _docSearchType = btn.dataset.mode;
      searchInput.value = '';
      searchInput.placeholder = _DOC_PLACEHOLDERS[_docSearchType] || 'Buscar...';

      // Limpar filtro de nome sem re-renderizar a árvore
      if (prevType === 'nome') docFilterByName('');

      const resultsEl = document.getElementById('doc-search-results');
      if (_docSearchType === 'nome' && !resultsEl.classList.contains('hidden')) {
        const viewerOpen = !document.getElementById('doc-viewer').classList.contains('hidden');
        _docShowPanel(viewerOpen ? 'viewer' : 'default');
      }
    });
  });

  // Sub-abas de fonte. Substituíram o combobox Arquivo/Pasta: os 3 tipos de
  // busca continuam ortogonais e operam sobre a fonte selecionada aqui.
  document.querySelectorAll('.doc-subtab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.dataset.fonte === _docFonte) return;
      document.querySelectorAll('.doc-subtab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _docFonte = btn.dataset.fonte;

      searchInput.value = '';
      docFilterByName('');          // limpa o filtro da árvore anterior
      _docShowPanel('default');
      _docSyncModos();
      await loadDocTree();
    });
  });

  _docSyncModos();
}

// Nem toda fonte tem índice de embeddings — só Documentação técnica e
// Resumo de pastas têm (backend/modulos/agentes/embedding.py). Nas outras o
// botão fica desabilitado, em vez de aceitar o clique e devolver erro depois.
function _docSyncModos() {
  const fonte = _docFonteAtual();

  // Só as fontes que a própria aba gera — ver _DOC_FONTES_AUTOGERA.
  document.getElementById('btn-doc-regerar')
    ?.classList.toggle('hidden', !_DOC_FONTES_AUTOGERA.has(_docFonte));

  document.querySelectorAll('#doc-busca-modos .bsa-modo-btn').forEach(b => {
    const ok = b.dataset.mode !== 'semantica' || fonte.semantica;
    b.disabled = !ok;
    b.title = ok ? '' : `${fonte.titulo} não tem índice de busca semântica.`;
  });

  // Se o modo ativo virou inválido com a troca de fonte, cai para "Por nome".
  const ativo = document.querySelector(`#doc-busca-modos .bsa-modo-btn[data-mode="${_docSearchType}"]`);
  if (ativo && ativo.disabled) {
    document.querySelectorAll('#doc-busca-modos .bsa-modo-btn').forEach(b => b.classList.remove('active'));
    const porNome = document.querySelector('#doc-busca-modos .bsa-modo-btn[data-mode="nome"]');
    if (porNome) porNome.classList.add('active');
    _docSearchType = 'nome';
    const input = document.getElementById('doc-search-input');
    if (input) input.placeholder = _DOC_PLACEHOLDERS.nome;
  }
}
