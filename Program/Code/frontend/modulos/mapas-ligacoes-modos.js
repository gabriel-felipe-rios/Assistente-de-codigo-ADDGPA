// ═══════════════════════════════════ MAPAS: Ligações — os layouts ══
// Geometria pura: cada função recebe o grafo já filtrado e devolve posições.
// Nenhuma delas negocia posição — não há simulação, não há força, não há
// `d3.forceSimulation`. Em todos a posição sai de uma REGRA (anel, coluna,
// faixa, linha), e por isso o mesmo projeto desenha igual duas vezes seguidas.
// O grafo força-dirigido já morou nesta aba e saiu justamente por não ter
// essa propriedade.
//
// ⚠️ QUEM USA CADA UM (2026-09, D62/D63). A tela Mapas › Ligações mostra só
// Pastas e Impacto. Foco local, Camadas e Arquitetura saíram DA TELA, mas os
// motores ficam: o Mapa da mudança (aba Backups, `backups-mapa-ligacoes.js`)
// desenha com eles. Ciclos e Caminho não tinham outro usuário e saíram.
// Não apague um layout daqui sem conferir `me_usam` deste arquivo.
//
// Contrato de retorno, igual em todos:
//   { nos: [{id, x, y, rotulo}], arestas: [{a, b, tipo}], w, h, msg }
//   tipo: 'normal' | 'ciclo' | 'travessia' | 'entrada'
//   msg preenchido = não há o que desenhar, e o texto explica por quê.
// Usa _ligBasename, _ligNatureza e _ligVizinhos, definidos em mapas-ligacoes.js.

const LIG_NO_H = 24;          // altura da caixa de um arquivo
const LIG_GAP_Y = 34;         // respiro vertical entre caixas
const LIG_COL_W = 230;        // largura de uma coluna/nível

// O teto antigo era 200px, que satura em 28 caracteres: a caixa parava de
// crescer e o <text> continuava do tamanho real, vazando pelos dois lados
// (com `text-anchor: middle`, simetricamente). Agora a caixa acompanha o texto
// ate um limite generoso, e quem passa disso e TRUNCADO na origem — nunca
// deixado vazar.
const LIG_ROTULO_MAX = 34;      // caracteres antes das reticencias
const LIG_PASTA_MAX = 42;       // a pasta pode ser mais longa: precisa desambiguar
const _ligLarguraCache = new Map();

function _ligLarguraRotulo(texto) {
  let w = _ligLarguraCache.get(texto);
  if (w === undefined) {
    w = Math.max(70, 16 + texto.length * 6.6);
    _ligLarguraCache.set(texto, w);
  }
  return w;
}

function _ligTruncar(texto, max = LIG_ROTULO_MAX) {
  return texto.length <= max ? texto : texto.slice(0, max - 1) + '\u2026';
}

// Corta pela ESQUERDA: num caminho de pasta, quem distingue e o fim
// (`backend/modulos` de `frontend/modulos`), nao o comeco.
function _ligTruncarInicio(texto, max = LIG_PASTA_MAX) {
  return texto.length <= max ? texto : '\u2026' + texto.slice(-(max - 1));
}

// O maior prefixo de pasta que TODAS compartilham. Num projeto todo dentro de
// `Program/Code/`, repetir isso em cada linha gasta 13 caracteres por rotulo e
// nao diz nada — o que informa e o que vem depois.
function _ligPrefixoComum(caminhos) {
  if (caminhos.length < 2) return '';
  const partes = caminhos.map(c => c.split('/'));
  let i = 0;
  while (partes[0][i] !== undefined &&
         partes.every(p => p[i] === partes[0][i]) &&
         partes.every(p => p.length > i + 1)) i++;
  return i ? partes[0].slice(0, i).join('/') + '/' : '';
}

// ── 1. Foco local ────────────────────────────────────────────────────────────
// Anéis por profundidade em volta do foco. Saídas no arco direito, entradas no
// esquerdo — assim o lado da tela já responde "isso é quem eu uso ou quem me
// usa?" sem precisar seguir a ponta da seta.
function _ligLayoutFoco(g, foco, prof) {
  if (!foco || !g.nos.has(foco)) {
    return { nos: [], arestas: [], w: 0, h: 0,
             msg: 'Escolha um arquivo em <strong>Foco</strong> no painel de controles.' };
  }
  const cx = 480, cy = 330, raio = 150;
  const nos = [{ id: foco, x: cx, y: cy, rotulo: _ligTruncar(_ligBasename(foco)) }];
  const postos = new Set([foco]);
  const arestas = [];

  [['saida', 1], ['entrada', -1]].forEach(([lado, sinal]) => {
    let fronteira = [foco];
    for (let nivel = 1; nivel <= prof; nivel++) {
      const proxima = [];
      fronteira.forEach(atual => {
        const vizinhos = lado === 'saida' ? _ligVizinhos(g, atual).usa
                                          : _ligVizinhos(g, atual).usadoPor;
        vizinhos.forEach(v => { if (!postos.has(v)) { postos.add(v); proxima.push(v); } });
      });
      if (!proxima.length) break;
      // Arco de 150°, centrado na horizontal do seu lado.
      const passo = Math.PI * 0.83 / Math.max(proxima.length, 1);
      const base = -Math.PI * 0.415 + passo / 2;
      proxima.forEach((id, i) => {
        const ang = base + i * passo;
        nos.push({ id, rotulo: _ligTruncar(_ligBasename(id)),
                   x: cx + sinal * Math.cos(ang) * raio * nivel,
                   y: cy + Math.sin(ang) * raio * nivel * 0.72 });
      });
      fronteira = proxima;
    }
  });

  const dentro = new Set(nos.map(n => n.id));
  g.arestas.forEach(a => {
    if (dentro.has(a.origem) && dentro.has(a.destino)) {
      arestas.push({ a: a.origem, b: a.destino, tipo: a.destino === foco ? 'entrada' : 'normal' });
    }
  });
  return { nos, arestas, w: cx * 2, h: cy * 2 };
}

// ── 2. Camadas ───────────────────────────────────────────────────────────────
// Colunas por distância, por relaxamento iterativo (não por física). Aresta que
// aponta para trás não cabe na sequência: é ciclo, e sai vermelha tracejada em
// vez de ser escondida.
function _ligLayoutCamadas(g) {
  const ids = [...g.nos.keys()].sort();
  if (!ids.length) return { nos: [], arestas: [], w: 0, h: 0, msg: 'Nada a mostrar.' };

  // Aresta de volta primeiro, por DFS. Sem isso o relaxamento gira dentro do
  // ciclo e empurra a camada até o teto de passadas: 7 arquivos chegavam a
  // desenhar 9000px de largura, um por passada, todos em fila.
  const volta = new Set();
  const estado = {};   // 1 = na pilha do DFS, 2 = fechado
  function classifica(v) {
    estado[v] = 1;
    _ligVizinhos(g, v).usa.forEach(w => {
      // Aponta para dentro da propria pilha: e aresta de volta, ou seja, ciclo.
      if (estado[w] === 1) volta.add(v + '|' + w);
      else if (!estado[w]) classifica(w);
    });
    estado[v] = 2;
  }
  ids.forEach(v => { if (!estado[v]) classifica(v); });

  const camada = {};
  ids.forEach(id => { camada[id] = 0; });
  const paraFrente = g.arestas.filter(a => !volta.has(a.origem + '|' + a.destino));
  // Sem aresta de volta o grafo é acíclico: o relaxamento converge em no
  // máximo uma passada por nó, e a largura fica limitada pela cadeia real.
  for (let passada = 0; passada < ids.length; passada++) {
    let mudou = false;
    paraFrente.forEach(a => {
      if (camada[a.destino] < camada[a.origem] + 1) {
        camada[a.destino] = camada[a.origem] + 1;
        mudou = true;
      }
    });
    if (!mudou) break;
  }

  const colunas = {};
  ids.forEach(id => (colunas[camada[id]] = colunas[camada[id]] || []).push(id));
  const nos = [];
  Object.keys(colunas).map(Number).sort((x, y) => x - y).forEach(c => {
    colunas[c].sort().forEach((id, i) => {
      nos.push({ id, rotulo: _ligTruncar(_ligBasename(id)),
                 x: 60 + c * LIG_COL_W, y: 50 + i * LIG_GAP_Y });
    });
  });

  const arestas = g.arestas.map(a => ({
    a: a.origem, b: a.destino,
    tipo: volta.has(a.origem + '|' + a.destino) ? 'ciclo' : 'normal',
  }));
  const maxCol = Math.max(...Object.keys(colunas).map(Number));
  const maxLin = Math.max(...Object.values(colunas).map(v => v.length));
  return { nos, arestas, w: 120 + (maxCol + 1) * LIG_COL_W, h: 100 + maxLin * LIG_GAP_Y };
}

// ── 3. Pastas ────────────────────────────────────────────────────────────────
// Caixa por pasta, com a contagem. A pasta aberta mostra os arquivos dentro —
// o resto continua fechado, senão volta a ser a mesma parede de nós.
// `todasAbertas` (opcional) abre TODAS as pastas — é o que a busca da vista
// Pastas usa, depois de deixar no grafo só os arquivos achados. O Mapa da
// mudança (Backups) chama com dois argumentos e não muda nada para ele.
function _ligLayoutPastas(g, aberta, todasAbertas = false) {
  const porPasta = {};
  [...g.nos.keys()].forEach(id => {
    const pasta = id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : '(raiz)';
    (porPasta[pasta] = porPasta[pasta] || []).push(id);
  });
  const pastas = Object.keys(porPasta).sort();
  if (!pastas.length) return { nos: [], arestas: [], w: 0, h: 0, msg: 'Nada a mostrar.' };
  const prefixo = _ligPrefixoComum(pastas.filter(p => p !== '(raiz)'));

  const nos = [];
  let y = 50;
  pastas.forEach(pasta => {
    const filhos = porPasta[pasta].sort();
    // O caminho inteiro nao cabe (`Program/Code/frontend/modulos/agentes/
    // colaboracao (11)` tem 55 caracteres), mas so o nome final tambem nao
    // serve: `modulos (23)` e `modulos (51)` seriam backend e frontend, e a
    // tela nao diria qual e qual. Tira o prefixo que TODAS compartilham e
    // mantem o resto. O caminho completo continua no balao do <title>.
    const curto = pasta === '(raiz)' ? pasta : pasta.slice(prefixo.length);
    // Indenta por profundidade: a lista vira arvore em vez de bloco.
    const nivel = (curto.match(/\//g) || []).length;
    nos.push({ id: 'pasta:' + pasta, x: 30 + nivel * 14, y, pasta: true,
               rotulo: _ligTruncarInicio(`${curto} (${filhos.length})`) });
    y += LIG_GAP_Y;
    if (todasAbertas || pasta === aberta) {
      filhos.forEach(id => {
        nos.push({ id, x: 46 + nivel * 14, y, rotulo: _ligTruncar(_ligBasename(id)) });
        y += LIG_GAP_Y;
      });
      y += 8;
    }
  });

  const visiveis = new Set(nos.filter(n => !n.pasta).map(n => n.id));
  const arestas = g.arestas
    .filter(a => visiveis.has(a.origem) && visiveis.has(a.destino))
    .map(a => ({ a: a.origem, b: a.destino, tipo: 'normal' }));
  // A largura sai da maior caixa de verdade, em vez de um 700 fixo que nao
  // conhecia o tamanho de rotulo nenhum.
  const larg = Math.max(...nos.map(n => n.x + _ligLarguraRotulo(n.rotulo)));
  return { nos, arestas, alinhaEsquerda: true, w: larg + 60, h: y + 40 };
}

// ── 5. Impacto ───────────────────────────────────────────────────────────────
// Árvore por nível seguindo "quem me usa" — a pergunta "se eu mexer aqui, o que
// quebra?". Cada arquivo aparece UMA vez, no nível mais próximo: repetir o
// mesmo arquivo em três níveis dá a impressão de três impactos diferentes.
function _ligLayoutImpacto(g, foco, prof) {
  if (!foco || !g.nos.has(foco)) {
    return { nos: [], arestas: [], w: 0, h: 0,
             msg: 'Escolha um arquivo em <strong>Foco</strong> no painel de controles.' };
  }
  const niveis = [[foco]];
  const vistos = new Set([foco]);
  for (let n = 1; n <= prof; n++) {
    const proxima = [];
    niveis[n - 1].forEach(atual => {
      _ligVizinhos(g, atual).usadoPor.forEach(v => {
        if (!vistos.has(v)) { vistos.add(v); proxima.push(v); }
      });
    });
    if (!proxima.length) break;
    niveis.push(proxima.sort());
  }

  const nos = [];
  niveis.forEach((nivel, i) => nivel.forEach((id, j) => {
    nos.push({ id, rotulo: _ligTruncar(_ligBasename(id)), x: 60 + i * LIG_COL_W, y: 60 + j * LIG_GAP_Y });
  }));
  const arestas = g.arestas
    .filter(a => vistos.has(a.origem) && vistos.has(a.destino))
    .map(a => ({ a: a.origem, b: a.destino, tipo: 'normal' }));

  const alt = Math.max(...niveis.map(n => n.length));
  return { nos, arestas, w: 120 + niveis.length * LIG_COL_W, h: 120 + alt * LIG_GAP_Y,
           rodape: `${vistos.size - 1} arquivo(s) afetado(s) em ${niveis.length - 1} nível(is)` };
}

// ── 6. Arquitetura ───────────────────────────────────────────────────────────
// Três faixas fixas por natureza do arquivo. A linha forte é a que atravessa
// faixa — é ela que responde "onde a tela encosta no backend?".
const LIG_FAIXAS = [
  { chave: 'markup',  titulo: 'HTML / CSS' },
  { chave: 'frontend', titulo: 'Frontend JS' },
  { chave: 'backend',  titulo: 'Backend Python' },
];

function _ligLayoutArquitetura(g) {
  const porFaixa = { markup: [], frontend: [], backend: [], outro: [] };
  [...g.nos.keys()].forEach(id => porFaixa[_ligNatureza(id)].push(id));
  const faixas = LIG_FAIXAS.filter(f => porFaixa[f.chave].length);
  if (porFaixa.outro.length) faixas.push({ chave: 'outro', titulo: 'Outros' });
  if (!faixas.length) return { nos: [], arestas: [], w: 0, h: 0, msg: 'Nada a mostrar.' };

  const nos = [], bandas = [];
  const porLinha = 6;
  let y = 60;
  faixas.forEach(f => {
    const ids = porFaixa[f.chave].sort();
    const linhas = Math.ceil(ids.length / porLinha);
    // 34 reservava a distancia ate o CENTRO da primeira linha, mas 12 vao
    // para a meia-altura da caixa e 20 para o baseline do titulo: sobravam
    // 2px e o titulo encostava nos nos. 46 da 14px de respiro em cima.
    bandas.push({ titulo: f.titulo, y: y - 46, h: linhas * LIG_GAP_Y + 42 });
    ids.forEach((id, i) => {
      nos.push({ id, rotulo: _ligTruncar(_ligBasename(id)), faixa: f.chave,
                 x: 60 + (i % porLinha) * (LIG_COL_W - 20),
                 y: y + Math.floor(i / porLinha) * LIG_GAP_Y });
    });
    y += linhas * LIG_GAP_Y + 70;
  });

  const faixaDe = {};
  nos.forEach(n => { faixaDe[n.id] = n.faixa; });
  const arestas = g.arestas.map(a => ({
    a: a.origem, b: a.destino,
    tipo: faixaDe[a.origem] !== faixaDe[a.destino] ? 'travessia' : 'normal',
  }));
  const travessias = arestas.filter(a => a.tipo === 'travessia').length;
  return { nos, arestas, bandas, w: 120 + porLinha * (LIG_COL_W - 20), h: y,
           rodape: `${travessias} travessia(s) de camada` };
}
