// Matriz de Dependências (ex-DSM). Matriz NxN onde a linha importa a coluna.
// Reaproveita o zoom/pan e os estilos .dsm-* de mapas.js/mapas.css.
// Usa _buscarDeps, _calcularAcoplamento, _dsmZoom/_dsmPanX/_dsmPanY,
// _applyDsmTransform (mapas.js).

let _matrizModo = 'arquivo';   // 'arquivo' | 'pasta'
let _matrizDestaque = null;    // chave da linha/coluna destacada, ex: 'r3' | 'c1'
let _matrizSemDeps = false;    // Interruptor "Mostrar sem dependências" (nasce desligado)

// Índice montado UMA VEZ na renderização.
//
//   cabLinha[ri] / cabColuna[ci] → o <th> daquele eixo
//   depLinha[ri]                 → índices de coluna onde ri TEM dependência
//   depColuna[ci]                → índices de linha  que dependem de ci
//   x[ci] / y[ri]                → geometria da coluna/linha, para as faixas
//
// ⚠️ NENHUMA célula entra aqui, e é isso que faz o clique não travar.
//
// Esta função já foi de dois jeitos errados. Primeiro achava as células com
// `querySelectorAll('[data-c="i"]')` dentro de um laço — cada chamada varria a
// matriz inteira. Depois passou a marcar as células por um índice, o que
// resolveu o JavaScript (75 ms) mas não o que o usuário sente: marcar 240 mil
// células obriga o motor a recalcular estilo e repintar cada uma, e o clique
// continuava levando SEGUNDOS. Medido em Chrome, projeto de 700 arquivos:
//
//   marcando célula por célula ....... 6.722 ms de média, 16.909 ms no pior
//   faixas sobrepostas em layer .........  105 ms de média,   414 ms no pior
//   (controle: um quadro sem mexer em nada) 31 ms)
//
// Agora o destaque não toca em célula nenhuma: desenha uma faixa por eixo, numa
// camada própria ATRÁS da tabela. As células continuam transparentes, então a
// faixa aparece através delas, e a bolinha de dependência — que tem fundo
// próprio — continua vindo por cima, com a cor cheia de sempre.
let _matrizIndice = null;
// Os cabeçalhos que a última chamada acendeu. São poucos (um por dependência),
// e continuam sendo classe CSS de verdade porque ali o custo não existe.
let _matrizMarcados = [];

async function renderMatriz() {
  _matrizRendered = false;
  const container = document.getElementById('dsm-container');
  container.innerHTML = '<div class="mapa-loading">Analisando…</div>';

  // Reset de zoom/pan ao re-renderizar
  _dsmZoom = 1; _dsmPanX = 0; _dsmPanY = 0; _matrizDestaque = null;
  _matrizIndice = null; _matrizMarcados = [];
  _applyDsmTransform();
  const slider = document.getElementById('ctrl-dsm-zoom');
  if (slider) { slider.value = 1; document.getElementById('ctrl-dsm-zoom-val').textContent = '1.00×'; }

  let dados;
  try {
    dados = await _buscarDeps();
  } catch (err) {
    container.innerHTML = `<div class="mapa-placeholder"><strong>Erro:</strong> ${err.message}</div>`;
    return;
  }

  if (!dados.nodes.length) {
    container.innerHTML = '<div class="mapa-placeholder">Nenhuma dependência interna encontrada.</div>';
    return;
  }

  if (_matrizModo === 'pasta') _renderMatrizPasta(container, dados);
  else                         _renderMatrizArquivo(container, dados);

  _matrizRendered = true;
}

// ── Visão por arquivo ───────────────────────────────────────────────────────────
//
// Os dois eixos NÃO usam a mesma lista quando o Interruptor está desligado, e é
// de propósito. Um arquivo que só é importado entra na matriz (ele é alvo de
// aresta) mas a linha dele fica inteiramente em branco; um que só importa deixa a
// coluna em branco. Essas faixas vazias são o grosso do que ocupava a tela.
//
// Desligado (padrão): linha = quem importa alguém, coluna = quem é importado.
// A matriz fica retangular e não perde UMA dependência sequer — tirar o arquivo
// dos dois eixos apagaria arestas reais (o mais importado do projeto sumiria por
// não importar nada). Ligado: os dois eixos voltam a ser a lista inteira de quem
// participa de alguma aresta, que é a matriz quadrada de sempre.
function _renderMatrizArquivo(container, dados) {
  const origens = new Set();
  const destinos = new Set();
  dados.edges.forEach(e => { origens.add(e.source); destinos.add(e.target); });

  const naLinha  = id => _matrizSemDeps ? (origens.has(id) || destinos.has(id)) : origens.has(id);
  const naColuna = id => _matrizSemDeps ? (origens.has(id) || destinos.has(id)) : destinos.has(id);

  const idsLinha  = dados.nodes.filter(n => naLinha(n.id)).map(n => n.id);
  const idsColuna = dados.nodes.filter(n => naColuna(n.id)).map(n => n.id);

  if (!idsLinha.length || !idsColuna.length) {
    container.innerHTML = '<div class="mapa-placeholder">Nenhuma dependência interna encontrada.</div>';
    return;
  }

  const conjuntoDep = new Set(dados.edges.map(e => `${e.source}|||${e.target}`));

  // Índice montado junto com as células — não custa uma varredura a mais.
  const cabLinha  = new Array(idsLinha.length);
  const cabColuna = new Array(idsColuna.length);
  const depLinha  = idsLinha.map(() => []);
  const depColuna = idsColuna.map(() => []);

  const table = document.createElement('table');
  table.className = 'dsm-table';

  // Cabeçalho de colunas (nomes completos, na vertical)
  const thead = table.createTHead();
  const headerRow = thead.insertRow();
  headerRow.appendChild(document.createElement('th'));
  idsColuna.forEach((colId, ci) => {
    const th = document.createElement('th');
    th.className = 'dsm-col-header';
    th.title = colId;
    th.textContent = colId.split('/').pop();   // só o nome; caminho completo no clique
    th.addEventListener('click', () => _matrizDestacar('c', ci, colId));
    headerRow.appendChild(th);
    cabColuna[ci] = th;
  });

  // Linhas
  const tbody = table.createTBody();
  idsLinha.forEach((srcId, ri) => {
    const row = tbody.insertRow();
    const th = document.createElement('th');
    th.className = 'dsm-row-header';
    th.title = srcId;
    th.textContent = srcId.split('/').pop();   // só o nome; caminho completo no clique
    th.addEventListener('click', () => _matrizDestacar('r', ri, srcId));
    row.appendChild(th);
    cabLinha[ri] = th;

    idsColuna.forEach((tgtId, ci) => {
      const td = row.insertCell();
      td.className = 'dsm-cell';
      if (srcId === tgtId) {
        td.classList.add('dsm-cell--self');
        td.textContent = '·';
      } else if (conjuntoDep.has(`${srcId}|||${tgtId}`)) {
        td.classList.add('dsm-cell--dep');
        td.title = `${srcId} → ${tgtId}`;
        td.textContent = '●';
        depLinha[ri].push(ci);
        depColuna[ci].push(ri);
      }
    });
  });

  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'dsm-wrap';
  wrap.appendChild(table);
  // A camada das faixas nasce junto com a tabela e fica ATRÁS dela (o z-index
  // está no CSS). Ela é promovida a layer próprio: sem isso, pintar uma faixa
  // obriga a repintar a tabela inteira embaixo, e volta a demorar meio segundo.
  const camada = document.createElement('div');
  camada.className = 'dsm-camada-destaque';
  wrap.appendChild(camada);
  container.appendChild(wrap);

  // Uma leitura de layout só, aqui, com a tabela já no lugar. As posições não
  // mudam depois: o zoom é `transform` no wrapper, e transform não mexe nas
  // coordenadas internas.
  _matrizIndice = {
    cabLinha, cabColuna, depLinha, depColuna, camada,
    x: cabColuna.map(th => ({ e: th.offsetLeft, l: th.offsetWidth })),
    y: cabLinha.map(th => ({ t: th.offsetTop, a: th.offsetHeight })),
    largura: table.offsetWidth,
    altura: table.offsetHeight,
  };
  _matrizMarcados = [];

  // Com o Interruptor ligado os dois eixos são a mesma lista, e dizer
  // "180 linhas × 180 colunas" só faria o leitor conferir duas vezes o mesmo número.
  const tamanho = idsLinha.length === idsColuna.length
    ? `${idsLinha.length} arquivos`
    : `${idsLinha.length} linhas × ${idsColuna.length} colunas`;
  document.getElementById('matriz-stat').textContent =
    `${tamanho} · ${dados.edges.length} dependências`;
}

// Destaca a linha (ou coluna) clicada E as perpendiculares que a CRUZAM onde
// existe dependência. Clicar de novo desmarca.
//
// Antes destacava só a própria linha, e era metade da informação: a linha diz
// "este arquivo importa alguma coisa", mas para ler QUEM era preciso seguir a
// bolinha com o dedo até o cabeçalho lá em cima. Destacando também a coluna de
// cada bolinha, o cruzamento aparece sozinho — que é como se lê uma matriz.
//
// Duas intensidades de propósito: `hl` é a linha que você clicou, `hl-cruz` é o
// que ela alcança. Sem essa distinção não dá para saber de onde a leitura parte.
//
// ⚠️ Nenhuma consulta ao DOM e nenhuma célula tocada. Ver o comentário da
// declaração de `_matrizIndice`: é essa troca que tirou o travamento do clique.
function _matrizDestacar(tipo, idx, caminho) {
  _matrizMarcados.forEach(el => el.classList.remove('hl', 'hl-cruz'));
  _matrizMarcados = [];
  if (_matrizIndice) _matrizIndice.camada.textContent = '';

  const legenda = document.getElementById('matriz-caminho');
  const chave = tipo + idx;
  if (_matrizDestaque === chave) {
    _matrizDestaque = null;
    if (legenda) legenda.textContent = '';
    return;
  }
  _matrizDestaque = chave;
  if (!_matrizIndice) return;

  const ix = _matrizIndice;
  const porLinha = tipo === 'r';
  // Só as perpendiculares com dependência de verdade cruzam. Acender todas
  // pintaria a matriz inteira e não diria nada.
  const cruzados = (porLinha ? ix.depLinha : ix.depColuna)[idx] || [];

  // Os cabeçalhos continuam com classe: são poucos, e é o nome que o olho
  // procura primeiro.
  const acender = (el, classe) => { if (el) { el.classList.add(classe); _matrizMarcados.push(el); } };
  acender(porLinha ? ix.cabLinha[idx] : ix.cabColuna[idx], 'hl');
  cruzados.forEach(i => acender(porLinha ? ix.cabColuna[i] : ix.cabLinha[i], 'hl-cruz'));

  // As faixas, de uma vez só numa string: um `innerHTML` custa menos que N
  // `appendChild`, e aqui N pode passar de trezentos.
  const faixas = [];
  const barra = (classe, esq, topo, larg, alt) => faixas.push(
    `<div class="dsm-faixa ${classe}" style="left:${esq}px;top:${topo}px;width:${larg}px;height:${alt}px"></div>`);
  if (porLinha) {
    const y = ix.y[idx];
    barra('dsm-faixa--eixo', 0, y.t, ix.largura, y.a);
    cruzados.forEach(ci => barra('dsm-faixa--cruz', ix.x[ci].e, 0, ix.x[ci].l, ix.altura));
  } else {
    const x = ix.x[idx];
    barra('dsm-faixa--eixo', x.e, 0, x.l, ix.altura);
    cruzados.forEach(ri => barra('dsm-faixa--cruz', 0, ix.y[ri].t, ix.largura, ix.y[ri].a));
  }
  ix.camada.innerHTML = faixas.join('');

  if (legenda) {
    const n = cruzados.length;
    const rel = porLinha ? 'importa' : 'é importado por';
    legenda.textContent = caminho
      ? `${caminho} — ${rel} ${n} arquivo${n === 1 ? '' : 's'}`
      : '';
  }
}

// ── Visão por pasta ─────────────────────────────────────────────────────────────
// Agrega os imports que cruzam de uma pasta de topo para outra (contagem), com
// intensidade de cor proporcional — mini mapa de calor de acoplamento.
//
// Não precisa do índice de células nem do Interruptor: aqui não há destaque por
// clique, e a lista de pastas é curta o bastante para nenhuma das duas coisas
// fazer diferença.
function _renderMatrizPasta(container, dados) {
  // Pasta = diretório imediato do arquivo (não o 1º segmento). Assim o
  // acoplamento entre subpastas aparece (ex.: backend/modulos → backend/agentes),
  // em vez de tudo colapsar numa única pasta de topo.
  const pastaDe = id => id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : '(raiz)';

  const contagem = {};   // "src|||tgt" -> nº de imports (src != tgt)
  const pastas = new Set();
  let maximo = 0;
  dados.edges.forEach(e => {
    const ps = pastaDe(e.source), pt = pastaDe(e.target);
    pastas.add(ps); pastas.add(pt);
    if (ps === pt) return;
    const chave = `${ps}|||${pt}`;
    contagem[chave] = (contagem[chave] || 0) + 1;
    if (contagem[chave] > maximo) maximo = contagem[chave];
  });

  const lista = [...pastas].sort();
  if (!lista.length) {
    container.innerHTML = '<div class="mapa-placeholder">Nenhuma dependência entre pastas encontrada.</div>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'dsm-table dsm-table--pasta';

  const thead = table.createTHead();
  const headerRow = thead.insertRow();
  headerRow.appendChild(document.createElement('th'));
  lista.forEach(p => {
    const th = document.createElement('th');
    th.className = 'dsm-col-header';
    th.textContent = p;
    headerRow.appendChild(th);
  });

  const tbody = table.createTBody();
  lista.forEach(ps => {
    const row = tbody.insertRow();
    const th = document.createElement('th');
    th.className = 'dsm-row-header';
    th.textContent = ps;
    row.appendChild(th);
    lista.forEach(pt => {
      const td = row.insertCell();
      td.className = 'dsm-cell dsm-cell--pasta';
      if (ps === pt) { td.classList.add('dsm-cell--self'); return; }
      const valor = contagem[`${ps}|||${pt}`];
      if (valor) {
        // alfa entre 0.18 e 0.85 proporcional ao valor
        const alfa = 0.18 + 0.67 * (valor / maximo);
        td.style.background = `rgba(var(--ciano-mapa-rgb), ${alfa.toFixed(2)})`;
        td.innerHTML = `<b>${valor}</b>`;
        td.title = `${ps}/ → ${pt}/ : ${valor} imports`;
      }
    });
  });

  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'dsm-wrap';
  wrap.appendChild(table);
  container.appendChild(wrap);
  document.getElementById('matriz-stat').textContent =
    `${lista.length} pastas · ${dados.edges.length} imports agregados`;
}
