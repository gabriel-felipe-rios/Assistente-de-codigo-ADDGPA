// ══════════════════════════════════════════════ ANÁLISE: RELAÇÕES ══
// Sub-aba Análise → Relações. Mostra o acoplamento que o Grafo de Imports não
// vê, a partir do Índice de Identificadores (backend/modulos/agentes/indexacao/identificadores.py).
// Um arquivo, dois lados da mesma pergunta: "eu uso" / "me usam", mais a
// cascata de indiretos.

let _relArquivos = [];
let _relSelecionado = null;
let _relArvore = null;   // instância de arvore-pastas.js
// As relações do arquivo aberto, como vieram do backend. Guardadas aqui, e não
// lidas de volta do DOM: o relatório copiado precisa dos identificadores em
// comum e do "através de" da cascata, que a tela mostra abreviados.
let _relDados = null;    // { usa, usado_por, cascata }

async function initRelacoesTab() {
  const placeholder = document.getElementById('relacoes-placeholder');
  const content = document.getElementById('relacoes-content');

  const r = await window.pywebview.api.list_arquivos_indexados(currentProject);
  _relArquivos = (r.success && r.arquivos) || [];

  if (_relArquivos.length === 0) {
    placeholder.classList.remove('hidden');
    content.classList.add('hidden');
    return;
  }
  placeholder.classList.add('hidden');
  content.classList.remove('hidden');

  _renderRelacoesFileList();
}

// A árvore é o componente compartilhado (arvore-pastas.js). Este arquivo já
// admitia por escrito ser a terceira cópia do mesmo código, e a cópia tinha
// três defeitos próprios: `_relBuildArquivo` era chamada com dois argumentos e
// declarada com um; os paddings do container e da linha se somavam, deixando
// arquivo de raiz com 14px e arquivo de pasta com 28px; e cada clique
// redesenhava a árvore inteira, **perdendo o que estava expandido**.
function _renderRelacoesFileList() {
  _relArvore = criarArvorePastas({
    container: document.getElementById('relacoes-file-list'),
    caminhos: _relArquivos,
    aoSelecionar: caminho => _relacoesSelecionarArquivo(caminho),
    vazio: 'Nenhum arquivo indexado.',
  });
  _relLigarBotoesCopiar();
  ligarBuscaArvore({
    input: 'rel-busca-input', botao: 'btn-rel-busca',
    modos: 'rel-busca-modos', aviso: 'rel-busca-aviso',
    container: 'relacoes-file-list',
  });
  ligarBotoesArvore(() => _relArvore, {
    expandir: 'btn-rel-expand-all',
    retrair: 'btn-rel-collapse-all',
    atualizar: 'btn-rel-refresh',
    aoAtualizar: () => initRelacoesTab(),
  });
}

async function _relacoesSelecionarArquivo(caminho) {
  _relSelecionado = caminho;
  // Só marca a linha; NÃO redesenha a árvore — era isso que apagava o estado
  // de expandido a cada clique.
  if (_relArvore) _relArvore.selecionar(caminho);

  document.getElementById('relacoes-detail-empty').classList.add('hidden');
  const content = document.getElementById('relacoes-detail-content');
  content.classList.remove('hidden');
  document.getElementById('relacoes-detail-filename').textContent = caminho;
  // Zera ANTES do await: sem isto, clicar em copiar durante o carregamento
  // levaria o relatório do arquivo anterior com o nome do novo no envelope.
  _relDados = null;

  const [rel, cascata] = await Promise.all([
    window.pywebview.api.get_relacoes(currentProject, caminho),
    window.pywebview.api.get_cascata(currentProject, caminho),
  ]);

  _relDados = {
    usa:       rel.success ? (rel.usa || []) : [],
    usado_por: rel.success ? (rel.usado_por || []) : [],
    cascata:   cascata.success ? cascata : { niveis: [], restantes: 0 },
  };

  _renderRelacoesLista('relacoes-uso-list', _relDados.usa);
  _renderRelacoesLista('relacoes-usado-por-list', _relDados.usado_por);
  _renderCascata(_relDados.cascata);
}

// ── Copiar para o chat ────────────────────────────────────────────────────
// O formato (envelope) é o compartilhado: copiar-contexto.js.
//
// ⚠️ Esta tela NÃO tem "Caminho + código", e não é esquecimento: não existe
// painel de código aqui. É a mesma razão pela qual o Resumo de pastas não tem
// esse botão na aba Documentação — não há código para copiar.
//
// O que se copia é um RELATÓRIO de acoplamento, montado a partir de `_relDados`.
// Sai como texto corrido com títulos, não como tabela: o destino é o corpo de
// uma mensagem para um modelo, não uma planilha.

function _relCopiarCaminho() {
  if (!_relSelecionado) return;
  copiarContexto(`Caminho do arquivo no projeto: ${_relSelecionado}`, 'Caminho copiado.');
}

function _relLinhasDe(itens, vazio) {
  if (!itens || !itens.length) return [`  (${vazio})`];
  return itens.map(i => `  - ${i.arquivo}` + ((i.via || []).length ? `   [${i.via.join(', ')}]` : ''));
}

function _relMontarRelatorio() {
  const d = _relDados || { usa: [], usado_por: [], cascata: { niveis: [], restantes: 0 } };
  const L = [];

  L.push('EU USO (este arquivo depende destes):');
  L.push(..._relLinhasDe(d.usa, 'nenhum'));
  L.push('');
  L.push('ME USAM (estes dependem deste arquivo):');
  L.push(..._relLinhasDe(d.usado_por, 'nenhum'));
  L.push('');
  L.push('CASCATA — INDIRETOS (os diretos acima não se repetem aqui):');
  if (!d.cascata.niveis || !d.cascata.niveis.length) {
    L.push('  (nenhum indireto encontrado)');
  } else {
    d.cascata.niveis.forEach(nivel => {
      nivel.itens.forEach(i => {
        L.push(`  - nível ${nivel.nivel}: ${i.arquivo}`
          + ((i.via || []).length ? `   [${i.via.join(', ')}]` : '')
          + (i.atraves_de ? `   (via ${i.atraves_de})` : ''));
      });
    });
    // O corte da tela vai junto. Sem isto o modelo lê a lista como completa e
    // conclui coisas sobre um grafo que ele só viu pela metade.
    if (d.cascata.restantes > 0) {
      L.push(`  ... e mais ${d.cascata.restantes} arquivo(s) em nível mais profundo, não listados.`);
    }
  }

  return L.join('\n');
}

function _relCopiarRelatorio() {
  if (!_relSelecionado) return;
  const cabecalho =
    'Relatório de acoplamento do arquivo abaixo, gerado pela aba Análise deste projeto '
    + 'a partir do Índice de Identificadores. Diz quem este arquivo usa, quem usa ele, e '
    + 'os indiretos em cascata. Entre colchetes vão os identificadores em comum. '
    + 'NÃO é o código do arquivo.';
  copiarContexto(envelopeDeContexto(cabecalho, _relSelecionado, _relMontarRelatorio()),
                 'Caminho e relatório copiados.');
}

function _relLigarBotoesCopiar() {
  const wire = (id, fn) => {
    const btn = document.getElementById(id);
    if (!btn || btn._relWired) return;
    btn._relWired = true;
    btn.addEventListener('click', fn);
  };
  wire('btn-rel-copiar-caminho',   _relCopiarCaminho);
  wire('btn-rel-copiar-relatorio', _relCopiarRelatorio);
}

function _renderRelacoesLista(listId, itens) {
  const ul = document.getElementById(listId);
  ul.innerHTML = '';
  if (!itens || itens.length === 0) {
    const li = document.createElement('li');
    li.className = 'rel-vazio';
    li.textContent = '(nenhuma relação encontrada)';
    ul.appendChild(li);
    return;
  }
  itens.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `${escapeHtml(item.arquivo)} <span class="via">· ${escapeHtml((item.via || []).join(', '))}</span>`;
    ul.appendChild(li);
  });
}

// Cascata: quem já apareceu em nível anterior não repete. O que passa do teto
// vira contagem, não lista — evita a "bola de espaguete" numa cadeia grande.
function _renderCascata(c) {
  const el = document.getElementById('relacoes-cascata');
  el.innerHTML = '';

  if (!c.niveis || c.niveis.length === 0) {
    el.innerHTML = '<p class="muted-line">Nenhum indireto encontrado.</p>';
    return;
  }

  const lvlClasse = { 2: 'l1', 3: 'l2' };
  c.niveis.forEach(n => {
    const ul = document.createElement('ul');
    n.itens.forEach(item => {
      const li = document.createElement('li');
      const tagClasse = lvlClasse[n.nivel] || '';
      li.innerHTML =
        `<span class="lvl ${tagClasse}">nível ${n.nivel}</span>${escapeHtml(item.arquivo)} ` +
        `<span class="via">· ${escapeHtml((item.via || []).join(', '))} (via ${escapeHtml(item.atraves_de.split('/').pop())})</span>`;
      ul.appendChild(li);
    });
    el.appendChild(ul);
  });

  if (c.restantes > 0) {
    const p = document.createElement('p');
    p.className = 'muted-line';
    p.textContent = `e mais ${c.restantes} arquivo${c.restantes !== 1 ? 's' : ''} em nível mais profundo — recolhidos.`;
    el.appendChild(p);
  }
}
