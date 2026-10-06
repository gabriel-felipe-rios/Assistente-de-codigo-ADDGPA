// ══════════════════════════════════════════ MAPAS: MATRIZ DE I/O ══
// Irmã da Matriz de Dependências, com um eixo diferente — e o motivo importa.
//
// Lá as duas pontas são a mesma lista de arquivos: "linha importa coluna".
// Aqui a coluna NÃO pode ser o alvo no disco, porque esse alvo não existe no
// código-fonte: ele é montado em execução, a partir das pastas que o usuário
// configura. Foi medido por quatro métodos (regex, AST, AST com resolução de
// variáveis, tree-sitter): zero de 716 chamadas resolvem para um caminho
// literal. Por isso a coluna é a OPERAÇÃO.
// Quadro completo em `Saída dos comandos/Discussões/Base de dados do Mapa de IO/`.
//
// Estado e helpers compartilhados (`_ioData`, `_buscarIO`, `_wireToggle`) moram
// em `mapas.js` — este arquivo só lê e reatribui, nunca redeclara.

// Os 10 tipos que o backend devolve, agrupados nas 5 famílias. O agrupamento é
// só do EIXO: o tipo exato continua em cada operação e aparece no painel.
const MIOM_FAMILIAS = [
  { chave: 'le',       ico: '📄', rotulo: 'Lê',       tipos: ['read_file', 'read_dir'] },
  { chave: 'escreve',  ico: '💾', rotulo: 'Escreve',  tipos: ['write_file'] },
  { chave: 'cria',     ico: '🗂️', rotulo: 'Cria',     tipos: ['create_dir'] },
  { chave: 'deleta',   ico: '🗑️', rotulo: 'Deleta',   tipos: ['delete_file', 'delete_dir', 'delete'] },
  { chave: 'verifica', ico: '🔍', rotulo: 'Verifica', tipos: ['check_file', 'check_dir', 'check_path'] },
];

// tipo → família, derivado da tabela acima. Uma lista só, sem gêmeo para
// divergir: era esse o defeito que a obra do scanner acabou de tirar do backend.
const MIOM_FAMILIA_DE = {};
MIOM_FAMILIAS.forEach(f => f.tipos.forEach(t => { MIOM_FAMILIA_DE[t] = f.chave; }));

// As colunas do modo Detalhada, na ordem em que a aba Análise › Mapa de I/O já
// mostra os filtros — quem aprendeu a ordem lá reconhece aqui.
const MIOM_COLUNAS_DETALHE = [
  'read_file', 'write_file', 'read_dir', 'create_dir', 'delete_file',
  'delete_dir', 'delete', 'check_file', 'check_dir', 'check_path',
];

let _miomModo = 'resumida';     // 'resumida' (5 famílias) | 'detalhada' (10 tipos)
let _miomArvore = null;         // { nós da árvore de pastas, já com os totais }
let _miomAbertas = new Set();   // caminhos de pasta expandidos
let _miomSel = null;            // { chave, coluna } da célula selecionada

// ── Montagem da árvore ────────────────────────────────────────────────────────
// Agrupa os arquivos por pasta e soma as operações de baixo para cima. A soma é
// de OPERAÇÕES, não de arquivos: uma pasta fechada mostra tudo que os arquivos
// dela fazem, que é a pergunta "o que acontece aqui dentro".
function _miomMontarArvore(files) {
  const raiz = { nome: '', caminho: '', pastas: new Map(), arquivos: [], contagem: {} };

  function somar(no, tipo) {
    no.contagem[tipo] = (no.contagem[tipo] || 0) + 1;
  }

  files.forEach(f => {
    const rel = (f.relative || '').replace(/\\/g, '/');
    const partes = rel.split('/').filter(Boolean);
    const nomeArquivo = partes.pop();
    let no = raiz;
    const trilha = [];
    partes.forEach(p => {
      trilha.push(p);
      const caminho = trilha.join('/');
      if (!no.pastas.has(p)) {
        no.pastas.set(p, { nome: p, caminho, pastas: new Map(), arquivos: [], contagem: {} });
      }
      no = no.pastas.get(p);
    });
    const arquivo = { nome: nomeArquivo, caminho: rel, contagem: {}, entries: f.entries || [] };
    (f.entries || []).forEach(e => somar(arquivo, e.type));
    no.arquivos.push(arquivo);

    // Sobe a contagem por toda a trilha, inclusive a raiz.
    let sobe = raiz;
    somarTodos(sobe, arquivo);
    trilha.reduce((atual, p) => {
      const filho = atual.pastas.get(p);
      somarTodos(filho, arquivo);
      return filho;
    }, raiz);
  });

  function somarTodos(no, arquivo) {
    Object.keys(arquivo.contagem).forEach(t => {
      no.contagem[t] = (no.contagem[t] || 0) + arquivo.contagem[t];
    });
  }

  return raiz;
}

// Quantas operações deste nó caem nesta coluna (família ou tipo exato).
function _miomValor(contagem, coluna) {
  if (_miomModo === 'detalhada') return contagem[coluna] || 0;
  const familia = MIOM_FAMILIAS.find(f => f.chave === coluna);
  if (!familia) return 0;
  return familia.tipos.reduce((soma, t) => soma + (contagem[t] || 0), 0);
}

function _miomColunas() {
  return _miomModo === 'detalhada'
    ? MIOM_COLUNAS_DETALHE.map(t => ({
        chave: t,
        ico: MIO_ICONS[t] || '•',
        rotulo: MIO_LABELS[t] || t,
        familia: MIOM_FAMILIA_DE[t] || 'le',
      }))
    : MIOM_FAMILIAS.map(f => ({ chave: f.chave, ico: f.ico, rotulo: f.rotulo, familia: f.chave }));
}

// As linhas visíveis, na ordem do desenho: pasta, e — se aberta — os filhos.
function _miomLinhasVisiveis(no, nivel, saida) {
  [...no.pastas.values()]
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .forEach(pasta => {
      const aberta = _miomAbertas.has(pasta.caminho);
      const temFilhos = pasta.pastas.size > 0 || pasta.arquivos.length > 0;
      saida.push({ tipo: 'pasta', nivel, no: pasta, aberta, temFilhos });
      if (aberta) _miomLinhasVisiveis(pasta, nivel + 1, saida);
    });
  // Os arquivos vêm depois das subpastas, sempre — inclusive na raiz. A raiz
  // não tem linha própria para abrir/fechar, então esconder os arquivos dela
  // faria sumir da tela quem mora direto na pasta de trabalho (um `main.py` na
  // raiz do projeto, por exemplo), sem nenhuma seta para revelá-lo.
  no.arquivos
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .forEach(arq => saida.push({ tipo: 'arquivo', nivel, no: arq }));
  return saida;
}

// ── Render ────────────────────────────────────────────────────────────────────
async function renderMatrizIO() {
  const grade = document.getElementById('mio-matriz-grade');
  if (!grade) return;
  grade.innerHTML = '<div class="mapa-placeholder">Escaneando arquivos…</div>';
  _miomSel = null;
  _miomResetPainel();

  let dados;
  try {
    dados = await _buscarIO();
  } catch (err) {
    grade.innerHTML = `<div class="mapa-placeholder"><strong>Erro:</strong> ${escapeHtml(err.message)}</div>`;
    return;
  }

  const files = dados.files || [];
  if (!files.length) {
    grade.innerHTML = '<div class="mapa-placeholder">Nenhuma operação de disco encontrada.<br>'
      + '<small>Configure as pastas de trabalho na aba <strong>Projeto</strong>.</small></div>';
    _miomLegenda();
    return;
  }

  _miomArvore = _miomMontarArvore(files);
  if (!_miomAbertas.size) _miomAberturaInicial();
  _miomDesenhar();
}

function _miomDesenhar() {
  const grade = document.getElementById('mio-matriz-grade');
  if (!grade || !_miomArvore) return;

  const colunas = _miomColunas();
  const linhas = _miomLinhasVisiveis(_miomArvore, 0, []);

  const tabela = document.createElement('table');
  tabela.className = 'miom-table';

  const thead = tabela.createTHead();
  const trCab = thead.insertRow();
  const thCanto = document.createElement('th');
  thCanto.className = 'miom-canto';
  thCanto.textContent = 'Pasta / arquivo';
  trCab.appendChild(thCanto);
  colunas.forEach(c => {
    const th = document.createElement('th');
    th.className = `miom-col-header miom-fam-${c.familia}`;
    th.title = c.rotulo;
    th.innerHTML = `<span class="miom-col-ico">${c.ico}</span><span class="miom-col-rot">${escapeHtml(c.rotulo)}</span>`;
    trCab.appendChild(th);
  });
  const thTotal = document.createElement('th');
  thTotal.className = 'miom-col-header miom-col-total';
  thTotal.textContent = 'Total';
  trCab.appendChild(thTotal);

  const tbody = tabela.createTBody();
  linhas.forEach(linha => {
    const tr = tbody.insertRow();
    tr.className = linha.tipo === 'pasta' ? 'miom-linha-pasta' : 'miom-linha-arquivo';

    const th = document.createElement('th');
    th.className = 'miom-row-header';
    th.style.paddingLeft = `${10 + linha.nivel * 16}px`;
    if (linha.tipo === 'pasta') {
      const seta = linha.temFilhos ? (linha.aberta ? '▾' : '▸') : '·';
      th.innerHTML = `<span class="miom-seta">${seta}</span>${escapeHtml(linha.no.nome)}/`;
      th.title = linha.no.caminho;
      if (linha.temFilhos) {
        th.classList.add('miom-clicavel');
        th.addEventListener('click', () => {
          if (_miomAbertas.has(linha.no.caminho)) _miomAbertas.delete(linha.no.caminho);
          else _miomAbertas.add(linha.no.caminho);
          _miomDesenhar();
        });
      }
    } else {
      th.innerHTML = `<span class="miom-seta"></span>${escapeHtml(linha.no.nome)}`;
      th.title = linha.no.caminho;
    }
    tr.appendChild(th);

    let total = 0;
    colunas.forEach(c => {
      const n = _miomValor(linha.no.contagem, c.chave);
      total += n;
      const td = document.createElement('td');
      td.className = 'miom-cel';
      if (n) {
        td.classList.add('miom-tem', `miom-fam-${c.familia}`);
        td.textContent = n;
        const chave = linha.no.caminho + '|' + c.chave;
        if (_miomSel === chave) td.classList.add('miom-sel');
        td.addEventListener('click', () => _miomAbrirCelula(linha, c, n, chave));
      } else {
        td.textContent = '·';
      }
      tr.appendChild(td);
    });

    const tdTotal = document.createElement('td');
    tdTotal.className = 'miom-cel miom-cel-total';
    tdTotal.textContent = total || '·';
    tr.appendChild(tdTotal);
  });

  grade.innerHTML = '';
  grade.appendChild(tabela);

  const totalOps = Object.values(_miomArvore.contagem).reduce((a, b) => a + b, 0);
  const nArquivos = _miomContarArquivos(_miomArvore);
  document.getElementById('mio-matriz-stat').textContent =
    `${nArquivos} arquivos · ${totalOps} operações · ${linhas.length} linhas`;
  _miomLegenda();
}

// Abertura inicial: desce sozinha enquanto a pasta só tem UMA subpasta e nenhum
// arquivo, e para no primeiro ponto onde a árvore se ramifica — abrindo esse.
//
// Sem isto, um projeto cujo caminho começa em `Code/backend/modulos/...` abria
// com DUAS linhas na tela, as duas com o total do projeto inteiro: uma corrente
// de pasta única não carrega informação nenhuma, só indentação. É o mesmo
// comportamento de qualquer explorador de arquivos.
function _miomAberturaInicial() {
  let no = _miomArvore;
  while (no.pastas.size === 1 && no.arquivos.length === 0) {
    const unica = [...no.pastas.values()][0];
    _miomAbertas.add(unica.caminho);
    no = unica;
  }
  // Abre também o nó onde ela se ramificou, para as opções aparecerem.
  if (no !== _miomArvore) _miomAbertas.add(no.caminho);
  no.pastas.forEach(p => _miomAbertas.add(p.caminho));
}

function _miomContarArquivos(no) {
  let n = no.arquivos.length;
  no.pastas.forEach(p => { n += _miomContarArquivos(p); });
  return n;
}

// ── Painel: as operações por trás do número ───────────────────────────────────
// Sem ele a célula é um número sem recurso: "19 deleções" não diz quais. É o
// mesmo papel do painel de detalhe da aba Análise › Mapa de I/O.
function _miomAbrirCelula(linha, coluna, quantidade, chave) {
  _miomSel = chave;
  _miomDesenhar();

  const alvo = _miomModo === 'detalhada'
    ? [coluna.chave]
    : (MIOM_FAMILIAS.find(f => f.chave === coluna.chave) || { tipos: [] }).tipos;

  const ops = [];
  (function juntar(no) {
    if (no.entries) {
      no.entries.forEach(e => {
        if (alvo.includes(e.type)) ops.push({ arquivo: no.caminho, ...e });
      });
      return;
    }
    no.arquivos.forEach(juntar);
    no.pastas.forEach(juntar);
  })(linha.no);

  const painel = document.getElementById('mio-matriz-painel');
  const onde = linha.tipo === 'pasta' ? `${linha.no.caminho}/` : linha.no.caminho;
  document.getElementById('mio-matriz-caminho').textContent =
    `${onde} — ${coluna.rotulo.toLowerCase()} ${quantidade}×`;

  const cabecalho = `<div class="miom-painel-cab">
      <span class="miom-painel-onde">${escapeHtml(onde)}</span>
      <span class="miom-painel-op miom-fam-${coluna.familia}">${coluna.ico} ${escapeHtml(coluna.rotulo)}</span>
    </div>`;

  // Teto de 120 para não travar a tela numa pasta grande — e o corte nunca é
  // mudo: quem vê 120 achando que são todas conclui errado.
  const TETO = 120;
  const mostradas = ops.slice(0, TETO);
  const corpo = mostradas.map(o => `
    <div class="miom-op">
      <div class="miom-op-arq">${escapeHtml(o.arquivo)}<span class="ts-line-num">:${o.line}</span></div>
      ${o.alvo ? `<div class="miom-op-alvo">${escapeHtml(o.alvo)}</div>` : ''}
      <div class="miom-op-call">${escapeHtml(o.call || '')}</div>
    </div>`).join('');
  const resto = ops.length > TETO
    ? `<div class="miom-op-corte">… +${ops.length - TETO} operações não listadas.</div>` : '';

  painel.innerHTML = cabecalho + corpo + resto;
}

function _miomResetPainel() {
  const painel = document.getElementById('mio-matriz-painel');
  if (painel) painel.innerHTML = '<div class="mio-matriz-painel-vazio">Clique numa célula para ver as operações.</div>';
  const caminho = document.getElementById('mio-matriz-caminho');
  if (caminho) caminho.textContent = '';
}

function _miomLegenda() {
  const el = document.getElementById('mio-matriz-legenda');
  if (!el) return;
  const itens = MIOM_FAMILIAS.map(f =>
    `<span class="miom-leg-item"><i class="miom-leg-cor miom-fam-${f.chave}"></i>${f.ico} ${f.rotulo}</span>`).join('');
  const nota = _miomModo === 'detalhada'
    ? 'Uma coluna por tipo — os mesmos 10 de Análise › Mapa de I/O'
    : 'Os 10 tipos agrupados em 5 famílias — troque para Detalhada para separá-los';
  el.innerHTML = itens + `<span class="miom-leg-nota">${nota}</span>`;
}

// Chamado por `mapas.js` quando o toggle muda.
function _miomTrocarModo(modo) {
  _miomModo = modo;
  _miomSel = null;
  _miomResetPainel();
  _miomDesenhar();
}

function _miomExpandirTudo(abrir) {
  _miomAbertas = new Set();
  if (abrir && _miomArvore) {
    (function anda(no) {
      no.pastas.forEach(p => { _miomAbertas.add(p.caminho); anda(p); });
    })(_miomArvore);
  }
  _miomDesenhar();
}
