// ═══ BACKUPS → Mapa da mudança — o painel do canto e a legenda ═════════════
//
// Saiu de `backups-mapa.js` pela AMF: com os seletores de Ligações o arquivo
// passaria de 500 linhas. A divisão também é conceitual — aqui mora o que se
// ESCOLHE e o que se EXPLICA; lá, o que se desenha.
//
// ⚠️ A LEGENDA É POR LEITURA. Ela era uma só para os oito desenhos, e por isso
// anunciava coisas que a leitura em cena não tem: na Matriz ela prometia o
// tracejado de "só existe do outro lado", que não existe ali. Legenda que
// descreve o que não está na tela é pior que legenda nenhuma — ela faz procurar.

// A escolha das leituras que dependem de um arquivo. Uma só, valendo nos DOIS
// painéis: um seletor por lado transformaria a comparação em duas telas
// diferentes, que é o oposto do que esta sub-aba faz.
let bmFocoDeLigacoes = '';
let bmProfDeLigacoes = 2;
let bmPastaAberta = '';
let bmNosDeLigacoes = [];      // a união dos nós das duas Versões

// ── Legenda ─────────────────────────────────────────────────────────────────

// O que cada leitura de fato desenha. Chave → itens da legenda.
//
// ⚠️ São CINCO coisas que podem ter acontecido com um arquivo, e não três: ele
// pode ter nascido, mudado por dentro, sumido, mudado de pasta ou mudado de
// nome. As duas últimas faltavam, e sem elas um arquivo que só mudou de lugar
// aparecia como um vermelho ("deletado") mais um verde ("criado") — dois
// arquivos, para o olho, onde havia um.
const BM_CORES = {
  criado:    ['bm-criado', 'criado'],
  alterado:  ['bm-alterado', 'alterado'],
  removido:  ['bm-removido', 'deletado'],
  movido:    ['bm-movido', 'movido'],
  renomeado: ['bm-renomeado', 'renomeado'],
  igual:     ['bm-igual', 'sem alteração'],
  pasta:     ['bm-pasta', 'pasta'],
};

// As cinco situações de MUDANÇA, na ordem em que a legenda as lista. `igual`
// não está aqui de propósito: ele é a ausência de mudança, e só entra nas
// leituras que desenham o projeto inteiro.
const BM_MUDANCAS = ['criado', 'alterado', 'removido', 'movido', 'renomeado'];

function bmItensDaLegenda() {
  const v = bmVariante[bmFormato];
  if (bmFormato === 'arvore') {
    // A Árvore lista SÓ o que mudou — ela é o diff, não a estrutura do
    // projeto. Por isso "sem alteração" não aparece nela.
    //
    // ⚠️ O "binário: comparado pelo hash" saiu daqui por decisão do usuário. O
    // selo continua na linha do arquivo e no tooltip, que é onde ele importa —
    // na legenda ele anunciava uma categoria que não é uma situação, no meio
    // das que são, e fazia procurar uma cor que não existe.
    return { cores: BM_MUDANCAS, extras: [] };
  }
  if (bmFormato === 'treemap') {
    // O Treemap e o Sunburst desenham o projeto INTEIRO, e por isso têm o
    // cinza: aqui o "sem alteração" é a maior parte da tela e precisa de nome.
    return { cores: BM_MUDANCAS.concat('igual'),
             extras: ['ausente', 'limitado', 'agregado'] };
  }
  if (bmFormato === 'sunburst') {
    return { cores: BM_MUDANCAS.concat('igual', 'pasta'),
             extras: ['ausente', 'limitado'] };
  }
  if (bmFormato === 'ligacoes') {
    // ⚠️ Ligações e Pipeline NÃO ganham movido/renomeado, e não é esquecimento:
    // eles não desenham arquivos, desenham ligações e passos. Um passo do
    // pipeline não tem caminho para mudar.
    if (v === 'matriz') {
      // ⚠️ AS QUATRO CORES ESTAVAM CERTAS — o que faltava era tudo que a Matriz
      // desenha e NÃO é uma cor de situação: a célula vazia, que é a maior parte
      // da grade, e a cruz azul do nome clicado, que é a marca mais chamativa da
      // tela e a única que não fala de mudança nenhuma. Uma legenda que explica
      // só o sistema de cor menos visível dos dois faz procurar no lugar errado.
      return { cores: ['criado', 'alterado', 'removido', 'igual'],
               extras: ['vazio', 'cruz'] };
    }
    if (v === 'por-arquivo') return { cores: [], extras: ['mudou'] };
    // ⚠️ `ciclo` E `travessia` SÃO CONDICIONAIS AO LAYOUT. Ciclo só nasce em
    // Camadas e travessia só em Arquitetura (`mapas-ligacoes-modos.js`). A
    // legenda anunciava os dois nos quatro layouts, e em dois deles cada um
    // mandava procurar um traço que o desenho não tem.
    const extras = ['seta-exclusiva', 'seta-mantida'];
    if (bmLayoutDeLigacoes === 'camadas') extras.push('ciclo');
    if (bmLayoutDeLigacoes === 'arquitetura') extras.push('travessia');
    if (bmLayoutDeLigacoes === 'pastas') extras.push('pasta-no');
    if (bmLayoutDeLigacoes === 'foco') extras.push('seta-entrada');
    extras.push('ausente');
    return { cores: [], extras };
  }

  // ── Pipeline ──
  // As três cores valem para as cinco variantes. O que muda é o resto: a Tabela
  // tem o âmbar de "mudou de ordem", e as quatro leituras desenhadas trazem a
  // cor da cadeia e a travessia de camada — nenhum dos três tinha item.
  const extras = [];
  if (v === 'tabela') extras.push('ordem');
  else extras.push('cadeia', 'travessia');
  if (bmTemTrilha()) extras.push('ausente');
  return { cores: ['criado', 'removido', 'igual'], extras };
}

// O teto de área do arquivo grande, em %, como o back-end o aplicou. Vive aqui
// porque quem o escreve é a legenda.
//
// ⚠️ O 12 é só o valor de partida: o número de verdade sai da sub-aba
// Configuração e chega junto com o desenho. `bmLegenda` roda ANTES da chamada
// ao back-end (o painel é montado primeiro), então quem recebe o número
// redesenha a legenda — ver `bmGuardarTeto`.
let bmTetoPorCento = 12;

function bmGuardarTeto(porCento) {
  const n = Number(porCento);
  if (!n || n === bmTetoPorCento) return;
  bmTetoPorCento = n;
  bmLegenda();
}

// ⚠️ UM TOKEN POR CLASSE. `'seta exclusiva'` viraria DUAS classes no
// `class=`, e nenhuma das duas existiria no CSS.
//
// O rótulo pode ser uma função quando ele depende do estado — foi o caso do
// `limitado`, que dizia "tamanho limitado no desenho" sem dizer limitado a quê.
const BM_EXTRAS = {
  ausente: ['lg-tracejada', 'só existe do outro lado'],
  limitado: ['lg-hachurada',
             () => `arquivo grande demais — desenhado no teto de ${bmTetoPorCento}% da área`],
  agregado: ['lg-agregada', 'os pequenos demais para ter nome — clique para abrir'],
  binario: ['lg-selo', 'binário: comparado pelo hash, não linha a linha'],
  mudou: ['lg-selo', 'mudou de vizinhança — o cartão inteiro ganha a moldura'],
  'seta-exclusiva': ['lg-seta-exclusiva', 'ligação que só existe deste lado'],
  'seta-mantida': ['lg-seta-mantida', 'ligação que os dois lados têm'],
  ciclo: ['lg-seta-ciclo', 'ciclo'],
  travessia: ['lg-seta-travessia', 'travessia de camada'],
  'seta-entrada': ['lg-seta-entrada', 'ligação que entra no arquivo em foco'],
  // ── Matriz ──
  vazio: ['lg-vazia', 'sem ligação nas duas Versões'],
  cruz: ['lg-cruz', 'a linha e a coluna do nome que você clicou'],
  // ── Pipeline ──
  ordem: ['lg-ordem', 'mudou de ordem'],
  cadeia: ['lg-cadeia', 'a cor forte é a da cadeia — a mesma da trilha'],
  // ── Ligações · layout Pastas ──
  'pasta-no': ['lg-pasta-no', 'pasta — clique para abrir o que tem dentro'],
};

function bmLegenda() {
  const { cores, extras } = bmItensDaLegenda();
  const temZoom = bmFormato !== 'arvore';
  document.getElementById('bm-legenda').innerHTML =
    cores.map(c => {
      const [classe, rotulo] = BM_CORES[c];
      return `<span class="bm-legenda-item ${classe}"><i class="bm-legenda-cor"></i>${rotulo}</span>`;
    }).join('') +
    extras.map(e => {
      const [classe, rotulo] = BM_EXTRAS[e];
      const texto = typeof rotulo === 'function' ? rotulo() : rotulo;
      return `<span class="bm-legenda-item"><i class="bm-legenda-cor ${classe}"></i>${texto}</span>`;
    }).join('') +
    bmFraseDaUnidade() +
    bmFraseDaLeitura() +
    (temZoom ? `<span class="bm-legenda-dica">${bmDicaDoGesto()}</span>` : '');
}

// O que não cabe numa amostra de cor porque não É uma cor: uma regra do desenho
// que muda o que está na tela sem deixar marca. Sem isto o usuário procura o
// arquivo que ele sabe que existe e não acha, e não há nada explicando por quê.
function bmFraseDaLeitura() {
  const frase = (texto) =>
    `<span class="bm-legenda-item bm-legenda-frase">${texto}</span>`;
  const v = bmVariante[bmFormato];

  if (bmFormato === 'ligacoes' && v === 'matriz') {
    // ⚠️ O EIXO É FILTRADO no back-end: só entra quem participa de alguma
    // ligação. Um arquivo que não importa nem é importado por ninguém
    // simplesmente não está na grade, e nada na tela dizia isso.
    let texto = 'o eixo só lista quem participa de <b>alguma</b> ligação';
    if (bmModoDaMatriz === 'pasta') {
      // A diagonal some por decisão de código (o par pasta→ela mesma é
      // descartado), e sem esta frase ela é indistinguível de "sem ligação".
      texto += ' · o número é <b>quantas ligações antes → agora</b>'
             + ' · a diagonal não entra na conta';
    }
    return frase(texto);
  }

  if (bmFormato === 'ligacoes' && v === 'por-arquivo') {
    // Numa tela cujo vocabulário é "cor = situação", pintar TODO vizinho de azul
    // convida a ler o azul como categoria. Ele é só estilo de código — e dizer
    // isso é mais honesto do que despintar uma tela que já está boa.
    return frase('o azul dos vizinhos é só estilo de código, não é situação');
  }
  return '';
}

// O que a ÁREA de cada bloco quer dizer. Sem esta frase o alternador
// "Linhas / Em disco" muda o desenho inteiro sem dizer o que mudou.
function bmFraseDaUnidade() {
  if (!BM_COM_UNIDADE.includes(bmFormato)) return '';
  return `<span class="bm-legenda-item bm-legenda-frase">${
    bmUnidade === 'bytes'
      ? 'a área de cada bloco é proporcional aos <b>bytes em disco</b>'
      : 'a área de cada bloco é proporcional às <b>linhas do arquivo</b> — binário não tem linhas e entra com um tamanho médio, hachurado'
  }</span>`;
}

// O gesto muda com a leitura, então a dica também.
function bmDicaDoGesto() {
  if (bmFormato === 'ligacoes' && bmVariante.ligacoes === 'matriz') {
    return 'roda = zoom · arrastar = mover · clicar num nome acende a cruz';
  }
  const vetorial = ['treemap', 'sunburst'].includes(bmFormato) ||
                   (bmFormato === 'ligacoes' && bmVariante.ligacoes === 'lado-a-lado');
  return vetorial
    ? 'roda = zoom · arrastar = mover · botão do meio = reenquadrar'
    : 'Ctrl + roda = zoom · roda = rolar · botão do meio = reenquadrar';
}

// ── O painel do canto ───────────────────────────────────────────────────────

function bmPainel() {
  // Horizontal, e não em coluna: são poucos botões curtos, e uma coluna alta
  // no canto tapa justamente a parte de baixo do desenho.
  const soCodigo = BM_SO_CODIGO.includes(bmFormato);
  const linhas = [];

  const toggle = (id, chave, opcoes, atual) => `
    <div class="mapa-toggle" id="${id}">
      ${opcoes.map(o => `<button class="mapa-toggle-btn${atual === o.id ? ' active' : ''}"
        data-${chave}="${o.id}"${o.dica ? ` title="${escapeHtml(o.dica)}"` : ''}>${o.rotulo}</button>`).join('')}
    </div>`;

  if (!soCodigo) {
    linhas.push(`
      <div class="mapas-ctrl-row">
        <span class="mapas-ctrl-label">Assunto</span>
        ${toggle('bm-metades', 'metade', [
          { id: 'codigo', rotulo: 'Código' },
          { id: 'documentacao', rotulo: 'Documentação' },
          { id: 'ambos', rotulo: 'Os dois' }], bmMetade)}
      </div>`);
  } else {
    linhas.push(`
      <div class="mapas-ctrl-stat">
        Sempre sobre o código — o grafo e o fluxo não têm metade de documentação.
      </div>`);
  }

  if (BM_COM_UNIDADE.includes(bmFormato)) {
    // O rótulo diz o que a escolha CONTROLA — a área de cada bloco —, e não só
    // "tamanho". Era essa palavra sozinha que não explicava nada.
    linhas.push(`
      <div class="mapas-ctrl-row">
        <span class="mapas-ctrl-label">Área de cada bloco</span>
        ${toggle('bm-unidades', 'unidade', [
          { id: 'linhas', rotulo: 'Linhas de código',
            dica: 'A área de cada bloco é proporcional ao número de linhas do arquivo. '
                + 'Binário não tem linhas: entra com um tamanho médio, hachurado.' },
          { id: 'bytes', rotulo: 'Bytes em disco',
            dica: 'A área de cada bloco é proporcional ao tamanho do arquivo em disco. '
                + 'Um .db de 9 MB fica enorme perto de um .py de 8 KB — que é o fato.' }],
          bmUnidade)}
      </div>`);
  }

  const variantes = BM_VARIANTES[bmFormato];
  if (variantes) {
    linhas.push(`
      <div class="mapas-ctrl-row">
        <span class="mapas-ctrl-label">Leitura</span>
        ${toggle('bm-variantes', 'variante', variantes, bmVariante[bmFormato])}
      </div>`);
  }

  if (bmFormato === 'ligacoes' && bmVariante.ligacoes === 'lado-a-lado') {
    linhas.push(`
      <div class="mapas-ctrl-row">
        <span class="mapas-ctrl-label">Layout</span>
        ${toggle('bm-layouts', 'layout', BM_LAYOUTS, bmLayoutDeLigacoes)}
      </div>`);
    linhas.push(bmSeletoresDeLigacoes());
  }

  // A Matriz ganha a segunda linha, com os MESMOS rótulos da Matriz de
  // Dependências da aba Mapas — dois nomes para a mesma escolha seria pedir
  // para o usuário aprender duas vezes.
  if (bmFormato === 'ligacoes' && bmVariante.ligacoes === 'matriz') {
    linhas.push(`
      <div class="mapas-ctrl-row">
        <span class="mapas-ctrl-label">Granularidade</span>
        ${toggle('bm-modo-matriz', 'modo', [
          { id: 'arquivo', rotulo: 'Por arquivo' },
          { id: 'pasta', rotulo: 'Por pasta' }], bmModoDaMatriz)}
      </div>`);
  }

  // O controle de escala, em toda leitura que amplia. Ele fala com o motor da
  // leitura em cena (`bmZoomAtivo`), que pode ser o d3, o `transform` do HTML
  // ou o da Matriz — e por isso o mesmo botão serve para as oito.
  if (bmFormato !== 'arvore') {
    linhas.push(`
      <div class="mapas-ctrl-row">
        <span class="mapas-ctrl-label">Escala</span>
        <div class="bm-zoom">
          <button id="bm-zoom-menos" title="Reduzir">−</button>
          <span class="bm-zoom-val" id="bm-zoom-val">100%</span>
          <button id="bm-zoom-mais" title="Ampliar">+</button>
          <button id="bm-zoom-cabe" title="Reenquadrar — o mesmo que o clique do botão do meio">⤢</button>
        </div>
      </div>`);
  }

  const painel = document.getElementById('bm-painel');
  painel.className = 'mapas-controls-panel bm-painel';
  painel.innerHTML = linhas.join('');

  const aoClicar = (id, acao) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', acao);
  };
  aoClicar('bm-zoom-menos', () => bmZoomPasso(-1));
  aoClicar('bm-zoom-mais', () => bmZoomPasso(1));
  aoClicar('bm-zoom-cabe', () => bmZoomReenquadrar());

  const ligar = (id, chave, aplicar) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', ev => {
      const btn = ev.target.closest('.mapa-toggle-btn');
      if (!btn) return;
      aplicar(btn.dataset[chave]);
      // Trocar de assunto, de unidade ou de leitura fecha o bloco agregado do
      // Treemap: ele é um recorte da cena, e a cena inteira acabou de mudar.
      bmTreemapAberto = false;
      bmDesenhar();
    });
  };
  ligar('bm-metades', 'metade', v => { bmMetade = v; });
  ligar('bm-unidades', 'unidade', v => { bmUnidade = v; });
  ligar('bm-variantes', 'variante', v => { bmVariante[bmFormato] = v; });
  ligar('bm-layouts', 'layout', v => { bmLayoutDeLigacoes = v; bmPastaAberta = ''; });
  ligar('bm-modo-matriz', 'modo', v => { bmModoDaMatriz = v; });
  bmLigarSeletoresDeLigacoes();
  bmPreencherSeletoresDeLigacoes();
}

// ── Os seletores das leituras que dependem de um arquivo ────────────────────

// Foco local, Impacto e Caminho existiam na aba Mapas e faltavam aqui (desde
// 2026-09 a aba Mapas só tem Pastas e Impacto; o Foco local mora aqui). Os
// layouts são funções puras — o que faltava era o seletor. E ele é UM SÓ para
// os dois painéis: escolher um arquivo diferente de cada lado seria comparar
// duas perguntas em vez de duas Versões.
const BM_LAYOUT_COM_FOCO = ['foco'];

function bmSeletoresDeLigacoes() {
  if (BM_LAYOUT_COM_FOCO.includes(bmLayoutDeLigacoes)) {
    return `
      <div class="mapas-ctrl-row">
        <span class="mapas-ctrl-label">Arquivo</span>
        <select class="bm-select" id="bm-lig-foco"></select>
      </div>
      <div class="mapas-ctrl-row">
        <span class="mapas-ctrl-label">Profundidade</span>
        <input type="range" id="bm-lig-prof" min="1" max="4" value="${bmProfDeLigacoes}">
        <span class="bm-zoom-val">${bmProfDeLigacoes}</span>
      </div>`;
  }
  // ⚠️ A "Fonte" do original (identificadores · imports · chamadas) NÃO cabe
  // aqui, e dizer isso é melhor do que oferecer um botão morto: a Versão
  // guarda UM grafo, o de imports. Os outros dois não existem no passado, e
  // recalculá-los exigiria o modelo — que nenhum mapa desta sub-aba chama.
  return `
    <div class="mapas-ctrl-stat">
      Sempre sobre o <b>grafo de imports</b> — é o único que a Versão guarda.
    </div>`;
}

function bmPreencherSeletoresDeLigacoes() {
  const opcoes = (atual) => bmNosDeLigacoes.map(id =>
    `<option value="${escapeHtml(id)}"${id === atual ? ' selected' : ''}>${
      escapeHtml(id)}</option>`).join('');
  const por = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opcoes(valor);
  };
  por('bm-lig-foco', bmFocoDeLigacoes);
}

function bmLigarSeletoresDeLigacoes() {
  const mudou = (id, aplicar) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', ev => { aplicar(ev.target.value); bmDesenhar(); });
  };
  mudou('bm-lig-foco', v => { bmFocoDeLigacoes = v; });
  const prof = document.getElementById('bm-lig-prof');
  if (prof) prof.addEventListener('change', ev => {
    bmProfDeLigacoes = Number(ev.target.value) || 2;
    bmDesenhar();
  });
}

// Chamado pelo desenho de Ligações, que é quem conhece a lista de nós. O painel
// é montado ANTES da chamada ao back-end, então os seletores nascem vazios e
// são preenchidos aqui.
function bmGuardarNosDeLigacoes(ordem) {
  bmNosDeLigacoes = ordem || [];
  if (!bmNosDeLigacoes.includes(bmFocoDeLigacoes)) bmFocoDeLigacoes = bmNosDeLigacoes[0] || '';
  bmPreencherSeletoresDeLigacoes();
}
