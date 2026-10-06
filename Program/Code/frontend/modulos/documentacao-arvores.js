// ══ DOCUMENTAÇÃO → as árvores de Pipeline, Glossário e Índice de navegação ══
//
// As três fontes que eram «um arquivo só» (uma lista plana de um item)
// viraram ÁRVORE, como na prévia aprovada
// (`preview-documentacao-pipeline-em-niveis.html`):
//
//   pipeline          Visão geral → área → bloco → cadeia; o bloco «Sem ponto
//                     de entrada» (B0) no fim. Lê o `_niveis.json` da rotina
//                     Pipeline e abre o `.md` do item clicado.
//   glossario         «Todos os termos» + um item por tópico (as seções `### `
//                     do glossario.md). NUNCA por pasta: um termo aparece em
//                     várias pastas e não teria onde morar.
//   indice-navegacao  «Todas as pastas» + as pastas em árvore (as seções `## `
//                     do indice-navegacao.md). O conteúdo do Índice não muda.
//
// ⚠️ NÃO É A ÁRVORE DE PASTAS (`arvore-pastas.js`). Lá a linha de pasta só abre
// e fecha, e quem se lê é o ARQUIVO; aqui toda linha É um pedaço do documento:
// clicar abre o texto dela à direita e, se ela tiver filhos, abre ou fecha os
// filhos. As classes visuais são as mesmas (`.arvp-*`), para as duas parecerem
// uma. Ver Padrões de interface → Componentes → Árvore de níveis.
//
// ⚠️ O «Tokens: N» CONTA SÓ O QUE O ITEM MOSTRA: o tópico, não o glossário
// inteiro; a pasta, não o índice inteiro. Por isso `conteudo()` devolve o
// texto já recortado, e é ele que vai para `_docMostrarConteudo`
// (documentacao-viewer.js) — o mesmo texto que «📋 Documento» copia.
//
// ⚠️ AS LINHAS SÃO CRIADAS UMA VEZ POR CARGA. Abrir, fechar, marcar e buscar
// por nome só mudam `display`, a seta e `.arvp-ativo` (`_docArvAplicar`) — a
// mesma regra da árvore de pastas: redesenhar a cada clique perdia o que
// estava aberto.
//
// Cada fonte de `_DOC_ARVORES` responde a quatro perguntas:
//   carregar()         lê o arquivo e guarda em `_docArvDados[fonte]`;
//                      devolve null, ou a mensagem de «nada aqui ainda»
//   itens()            TODAS as linhas, na ordem da tela:
//                      { chave, nivel, icone, nome, titulo?, contagem, temFilhos, pais }
//                      `pais` = as chaves que precisam estar abertas para ela aparecer
//   conteudo(chave)    { rotulo, docPath, texto } do item — ou null
//   chaveDoArquivo(p)  o item de um arquivo da pasta (vindo da busca por conteúdo)

let _docArvDados = {};          // fonte → o que carregar() leu
const _docArvAbertos = {};      // fonte → Set das chaves abertas (sobrevive a ↻ e à troca de sub-aba)
const _docArvAtivas = {};       // fonte → a chave do item aberto no visualizador
let _docArvFiltro = '';         // a busca por nome, em minúsculas
let _docArvDesenhada = null;    // de qual fonte são as linhas que estão no #doc-tree
let _docArvLinhas = new Map();  // chave → elemento da linha
let _docArvItens = new Map();   // chave → o item (o descritor de itens())

function _docArvAbertosDe(fonte) {
  if (!_docArvAbertos[fonte]) _docArvAbertos[fonte] = new Set();
  return _docArvAbertos[fonte];
}

// ── Leitura ───────────────────────────────────────────────────────────────

async function _docArvLer(fonte, arquivo) {
  const r = await window.pywebview.api.read_agent_file(currentProject, fonte, arquivo);
  return r && r.success ? r.content : null;
}

// Um markdown em seções por cabeçalho (`## ` ou `### `). O `texto` de cada
// seção já leva a linha do cabeçalho, para ela se ler sozinha no visualizador.
// O que vem antes do primeiro cabeçalho (título, data) fica de fora — ele só
// aparece no item do documento inteiro.
function _docArvSecoes(texto, prefixo) {
  const secoes = [];
  for (const linha of texto.split('\n')) {
    if (linha.startsWith(prefixo)) {
      secoes.push({ titulo: linha.slice(prefixo.length).trim(), linhas: [linha] });
    } else if (secoes.length) {
      secoes[secoes.length - 1].linhas.push(linha);
    }
  }
  secoes.forEach(s => { s.texto = s.linhas.join('\n').trim(); });
  return secoes;
}

// ── As três fontes ────────────────────────────────────────────────────────

const _DOC_PIPE_PASTAS = { A: 'areas', B: 'blocos', C: 'cadeias' };

const _DOC_ARVORES = {
  'pipeline': {
    inicial: 'visao',
    async carregar() {
      const bruto = await _docArvLer('pipeline', '_niveis.json');
      if (bruto === null) {
        // pipeline.md sem _niveis.json = gerado antes do Pipeline em níveis.
        return (await _docArvLer('pipeline', 'pipeline.md')) !== null
          ? 'O Pipeline deste projeto está no formato antigo.<br>Rode a rotina Pipeline de novo na aba Automação.'
          : 'Nada aqui ainda.<br>Execute o agente Pipeline primeiro.';
      }
      let dados;
      try { dados = JSON.parse(bruto); } catch (e) {
        return 'O _niveis.json do Pipeline está ilegível.<br>Rode a rotina Pipeline de novo na aba Automação.';
      }
      const porId = new Map();
      for (const lista of ['areas', 'blocos', 'cadeias']) {
        dados[lista] = (dados[lista] || []).filter(x => x && x.id);
        dados[lista].forEach(x => porId.set(x.id, x));
      }
      _docArvDados.pipeline = { ...dados, porId };
      return null;
    },
    itens() {
      const d = _docArvDados.pipeline;
      const lista = [{ chave: 'visao', nivel: 0, icone: '📄', nome: 'Visão geral',
                       contagem: `${d.areas.length} áreas`, temFilhos: false, pais: [] }];
      const bloco = (b, nivel, pais) => {
        const cadeias = (b.cadeias || []).map(id => d.porId.get(id)).filter(Boolean);
        lista.push({ chave: b.id, nivel, icone: b.sem_entrada ? '⋯' : '📁',
                     nome: `${b.id} · ${b.nome || '(sem nome)'}`, contagem: cadeias.length,
                     temFilhos: cadeias.length > 0, pais });
        for (const c of cadeias) {
          lista.push({ chave: c.id, nivel: nivel + 1, icone: '📄',
                       nome: `${c.id} · ${c.nome || '(sem nome)'}`,
                       contagem: `${(c.passos || []).length} passos`,
                       temFilhos: false, pais: [...pais, b.id] });
        }
      };
      for (const a of d.areas) {
        const blocos = (a.blocos || []).map(id => d.porId.get(id)).filter(Boolean);
        lista.push({ chave: a.id, nivel: 0, icone: '🗂', nome: `${a.id} · ${a.nome || '(sem nome)'}`,
                     contagem: blocos.length, temFilhos: blocos.length > 0, pais: [] });
        blocos.forEach(b => bloco(b, 1, [a.id]));
      }
      // Bloco fora de área — o B0, «Sem ponto de entrada» — no fim, no nível de cima.
      d.blocos.filter(b => !b.area).forEach(b => bloco(b, 0, []));
      return lista;
    },
    async conteudo(chave) {
      if (chave === 'visao') {
        const texto = await _docArvLer('pipeline', 'pipeline.md');
        return texto === null ? null : { rotulo: 'Visão geral', docPath: 'pipeline.md', texto };
      }
      const item = _docArvDados.pipeline.porId.get(chave);
      if (!item) return null;
      const docPath = `${_DOC_PIPE_PASTAS[chave[0]]}/${chave}.md`;
      const texto = await _docArvLer('pipeline', docPath);
      return texto === null ? null
        : { rotulo: `${chave} · ${item.nome || '(sem nome)'}`, docPath, texto };
    },
    chaveDoArquivo(docPath) {
      if (docPath === 'pipeline.md') return 'visao';
      const m = /^(?:areas|blocos|cadeias)\/([ABC]\d+)\.md$/.exec(docPath);
      return m ? m[1] : null;
    },
  },

  'glossario': {
    inicial: 'todos',
    async carregar() {
      const texto = await _docArvLer('glossario', 'glossario.md');
      if (texto === null) return 'Nada aqui ainda.<br>Execute o agente Glossário primeiro.';
      // Um tópico por seção `### ` — a ordem e os nomes vêm do arquivo
      // (`_gl_montar_md` já escreve os oito tópicos na ordem fixa e pula os
      // vazios). Uma lista de tópicos aqui seria a segunda a divergir.
      const secoes = _docArvSecoes(texto, '### ');
      secoes.forEach(s => {
        s.termos = s.linhas.filter(l => l.startsWith('|')
          && !/^\|\s*Termo\s*\|/.test(l) && !/^\|\s*:?-{3}/.test(l)).length;
      });
      _docArvDados.glossario = { texto, secoes };
      return null;
    },
    itens() {
      const d = _docArvDados.glossario;
      const total = d.secoes.reduce((n, s) => n + s.termos, 0);
      return [
        { chave: 'todos', nivel: 0, icone: '📄', nome: 'Todos os termos', contagem: total,
          temFilhos: false, pais: [] },
        ...d.secoes.map(s => ({ chave: 'topico:' + s.titulo, nivel: 0, icone: '📄',
                                nome: s.titulo, contagem: s.termos, temFilhos: false, pais: [] })),
      ];
    },
    async conteudo(chave) {
      const d = _docArvDados.glossario;
      if (chave === 'todos') return { rotulo: 'Todos os termos', docPath: 'glossario.md', texto: d.texto };
      const s = d.secoes.find(x => 'topico:' + x.titulo === chave);
      return s ? { rotulo: s.titulo, docPath: 'glossario.md', texto: s.texto } : null;
    },
    chaveDoArquivo: () => 'todos',
  },

  'indice-navegacao': {
    inicial: 'todas',
    async carregar() {
      const texto = await _docArvLer('indice-navegacao', 'indice-navegacao.md');
      if (texto === null) return 'Nada aqui ainda.<br>Execute o agente Índice de Navegação primeiro.';
      const secoes = _docArvSecoes(texto, '## ');
      const nomes = new Set(secoes.map(s => s.titulo));
      // O pai é a pasta de cima MAIS PRÓXIMA que tem seção — `Program/Code`
      // costuma não ter arquivo solto, e não pode deixar `backend` órfão.
      const paiDe = p => {
        let q = p.split('/').slice(0, -1).join('/');
        while (q && !nomes.has(q)) q = q.split('/').slice(0, -1).join('/');
        return q;
      };
      secoes.forEach(s => {
        s.arquivos = s.linhas.filter(l => l.startsWith('- ')).length;
        s.pai = paiDe(s.titulo);
      });
      secoes.forEach(s => { s.filhos = secoes.filter(x => x.pai === s.titulo); });
      _docArvDados['indice-navegacao'] = { texto, secoes };
      return null;
    },
    itens() {
      const d = _docArvDados['indice-navegacao'];
      const lista = [{ chave: 'todas', nivel: 0, icone: '📄', nome: 'Todas as pastas',
                       contagem: d.secoes.length, temFilhos: false, pais: [] }];
      const pasta = (s, nivel, pais) => {
        const chave = 'pasta:' + s.titulo;
        // Raiz mostra o caminho inteiro; filho, só o que vem depois do pai.
        const nome = s.pai ? s.titulo.slice(s.pai.length + 1) : s.titulo;
        lista.push({ chave, nivel, icone: '📁', nome, titulo: s.titulo, contagem: s.arquivos,
                     temFilhos: s.filhos.length > 0, pais });
        s.filhos.forEach(f => pasta(f, nivel + 1, [...pais, chave]));
      };
      d.secoes.filter(s => !s.pai).forEach(s => pasta(s, 0, []));
      return lista;
    },
    async conteudo(chave) {
      const d = _docArvDados['indice-navegacao'];
      if (chave === 'todas') return { rotulo: 'Todas as pastas', docPath: 'indice-navegacao.md', texto: d.texto };
      const alvo = chave.slice('pasta:'.length);
      // A pasta e as subpastas dela, como na prévia.
      const secoes = d.secoes.filter(s => s.titulo === alvo || s.titulo.startsWith(alvo + '/'));
      return secoes.length
        ? { rotulo: alvo, docPath: 'indice-navegacao.md', texto: secoes.map(s => s.texto).join('\n\n') }
        : null;
    },
    chaveDoArquivo: () => 'todas',
  },
};

// ── A árvore ──────────────────────────────────────────────────────────────

// Chamada por loadDocTree (documentacao.js) quando a fonte é 'niveis'.
async function _docArvCarregar() {
  const fonte = _docFonte;
  const arv = _DOC_ARVORES[fonte];
  const container = document.getElementById('doc-tree');
  // A árvore de pastas não está mais na tela: zera a instância para o ⊞/⊟ e
  // o `expandirAte` do visualizador não mexerem nela.
  _docArvore = null;
  _docVirtualDe = new Map();
  const vazio = await arv.carregar();
  if (fonte !== _docFonte) return;          // trocou de sub-aba durante a leitura
  if (vazio) {
    _docArvDesenhada = null;
    container.innerHTML = `<div class="doc-empty">${vazio}</div>`;
    _docShowPanel('default');
    return;
  }
  _docArvFiltro = '';
  _docArvDesenhar();
  // Volta ao item que estava aberto (↻, ou a volta à sub-aba); senão, o primeiro.
  const anterior = _docArvAtivas[fonte];
  await _docArvAbrir(anterior && _docArvItens.has(anterior) ? anterior : arv.inicial);
}

function _docArvDesenhar() {
  const container = document.getElementById('doc-tree');
  _docArvDesenhada = _docFonte;
  _docArvLinhas = new Map();
  _docArvItens = new Map();
  container.innerHTML = '';
  for (const it of _DOC_ARVORES[_docFonte].itens()) {
    const el = document.createElement('div');
    el.className = 'arvp-linha doc-arv-linha';
    // Indentação numa regra só, na própria linha (a da árvore de pastas).
    el.style.paddingLeft = `${6 + it.nivel * 14}px`;
    el.title = it.titulo || it.nome;
    el.innerHTML = `<span class="arvp-seta"></span><span class="arvp-icone">${it.icone}</span>`
      + `<span class="arvp-nome">${escapeHtml(it.nome)}</span>`
      + (it.contagem === '' || it.contagem == null ? ''
         : `<span class="arvp-contagem">${escapeHtml(String(it.contagem))}</span>`);
    el.addEventListener('click', () => _docArvClicar(it));
    container.appendChild(el);
    _docArvLinhas.set(it.chave, el);
    _docArvItens.set(it.chave, it);
  }
  _docArvAplicar();
}

// Visibilidade, seta e marca — sem redesenhar.
function _docArvAplicar() {
  if (_docArvDesenhada !== _docFonte) return;
  const abertos = _docArvAbertosDe(_docFonte);
  const ativa = _docArvAtivas[_docFonte];
  let pelaBusca = null;
  if (_docArvFiltro) {
    // A busca mostra quem casa E os pais de quem casa — senão a cadeia
    // achada apareceria solta, sem a área e o bloco dela.
    pelaBusca = new Set();
    for (const it of _docArvItens.values()) {
      if ((it.titulo || it.nome).toLowerCase().includes(_docArvFiltro)) {
        pelaBusca.add(it.chave);
        it.pais.forEach(p => pelaBusca.add(p));
      }
    }
  }
  for (const [chave, el] of _docArvLinhas) {
    const it = _docArvItens.get(chave);
    const visivel = pelaBusca ? pelaBusca.has(chave) : it.pais.every(p => abertos.has(p));
    el.style.display = visivel ? '' : 'none';
    el.querySelector('.arvp-seta').textContent =
      it.temFilhos ? ((pelaBusca || abertos.has(chave)) ? '▾' : '▸') : '';
    el.classList.toggle('arvp-ativo', chave === ativa);
  }
}

function _docArvClicar(it) {
  // Com a busca ativa a árvore mostra o que casa: o clique só abre o item.
  if (it.temFilhos && !_docArvFiltro) {
    const abertos = _docArvAbertosDe(_docFonte);
    if (abertos.has(it.chave)) abertos.delete(it.chave);
    else abertos.add(it.chave);
  }
  _docArvAbrir(it.chave);
}

async function _docArvAbrir(chave) {
  const fonte = _docFonte;
  if (_docArvDesenhada !== fonte || !_docArvItens.has(chave)) return;
  _docArvAtivas[fonte] = chave;
  _docArvAplicar();
  const doc = await _DOC_ARVORES[fonte].conteudo(chave);
  // Guarda de corrida: outro clique, ou outra sub-aba, chegou antes da leitura.
  if (_docFonte !== fonte || _docArvAtivas[fonte] !== chave) return;
  if (!doc) { showToast('Erro ao abrir o documento.', true); return; }
  _docMostrarConteudo(fonte, doc.docPath, doc.rotulo, doc.texto);
}

// Abre os pais de um item e o marca, sem abrir documento.
function _docArvRevelar(chave) {
  if (_docArvDesenhada !== _docFonte || !_docArvItens.has(chave)) return;
  const abertos = _docArvAbertosDe(_docFonte);
  _docArvItens.get(chave).pais.forEach(p => abertos.add(p));
  _docArvAtivas[_docFonte] = chave;
  _docArvAplicar();
  _docArvLinhas.get(chave).scrollIntoView({ block: 'nearest' });
}

// Chamada por abrirDocArtefato (documentacao-viewer.js) quando um arquivo
// desta fonte foi aberto por fora da árvore — a busca por conteúdo.
function _docArvMarcarPorArquivo(docPath) {
  const arv = _DOC_ARVORES[_docFonte];
  const chave = arv && _docArvDesenhada === _docFonte ? arv.chaveDoArquivo(docPath) : null;
  if (chave) _docArvRevelar(chave);
}

// O link de id no texto do Pipeline: abre os pais, marca e abre o documento.
async function _docArvAbrirId(id) {
  if (_docFonte !== 'pipeline' || !_docArvItens.has(id)) return;
  _docArvRevelar(id);
  await _docArvAbrir(id);
}

function _docArvExpandirTudo() {
  if (_docArvDesenhada !== _docFonte) return;
  const abertos = _docArvAbertosDe(_docFonte);
  for (const it of _docArvItens.values()) if (it.temFilhos) abertos.add(it.chave);
  _docArvAplicar();
}

function _docArvRetrairTudo() {
  if (_docArvDesenhada !== _docFonte) return;
  _docArvAbertosDe(_docFonte).clear();
  _docArvAplicar();
}

function _docArvFiltrar(query) {
  _docArvFiltro = (query || '').trim().toLowerCase();
  _docArvAplicar();
}

// Fechar o documento desmarca a linha: marcada sem nada aberto enganaria.
function _docArvDesmarcar() {
  if (_docArvDesenhada !== _docFonte) return;
  _docArvAtivas[_docFonte] = null;
  _docArvAplicar();
}

// ── O id citado no texto do Pipeline vira link ────────────────────────────
// A3, B12, C40 no texto de um item do Pipeline viram `<a class="doc-link-id">`
// que abre aquele item (o clique é ouvido uma vez só, no visualizador — ver
// bindDocumentacao). Só os ids que EXISTEM no _niveis.json: um «A4» qualquer
// não vira link. Dentro de `code`/`pre` nada muda — ali mora caminho de arquivo.
function _docPipeLigarIds(raiz) {
  const d = _docArvDados.pipeline;
  if (!d) return;
  const andar = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.parentElement && n.parentElement.closest('code, pre, a'))
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const textos = [];
  while (andar.nextNode()) textos.push(andar.currentNode);
  for (const t of textos) {
    const s = t.nodeValue;
    const achados = [...s.matchAll(/\b([ABC]\d+)\b/g)].filter(m => d.porId.has(m[1]));
    if (!achados.length) continue;
    const frag = document.createDocumentFragment();
    let ultimo = 0;
    for (const m of achados) {
      frag.appendChild(document.createTextNode(s.slice(ultimo, m.index)));
      const a = document.createElement('a');
      a.className = 'doc-link-id';
      a.href = '#';
      a.dataset.id = m[1];
      a.textContent = m[1];
      frag.appendChild(a);
      ultimo = m.index + m[0].length;
    }
    frag.appendChild(document.createTextNode(s.slice(ultimo)));
    t.parentNode.replaceChild(frag, t);
  }
}
