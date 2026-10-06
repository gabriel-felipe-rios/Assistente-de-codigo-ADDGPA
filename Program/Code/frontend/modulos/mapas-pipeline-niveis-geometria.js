// ══════════════════════════════════ Mapa em níveis · geometria
// Onde cada bloco fica dentro do pai, e por onde passa cada seta. Funções de
// conta: recebem os blocos (já medidos) e devolvem posições relativas.
//
// Não há física aqui, de propósito: o espaçamento é uma regra — perto o
// bastante para não navegar muito, longe o bastante para nada ser cortado.

// Prateleiras: testa de 1 até N colunas e fica com a que dá o formato mais
// perto de uma tela deitada (1,6 : 1) — é isso que evita o mapa crescer para baixo.
function mnLayoutPrateleiras(lista, gap) {
  let melhor = null;
  for (let cols = 1; cols <= lista.length; cols++) {
    let x = 0, y = 0, alturaLinha = 0, largura = 0, i = 0;
    const pos = [];
    lista.forEach(c => {
      if (i === cols) { x = 0; y += alturaLinha + gap; alturaLinha = 0; i = 0; }
      pos.push([x, y]); x += c.w + gap; alturaLinha = Math.max(alturaLinha, c.h); largura = Math.max(largura, x - gap); i++;
    });
    const h = y + alturaLinha, nota = Math.abs(Math.log((largura / h) / 1.6));
    if (!melhor || nota < melhor.nota) melhor = { nota, pos, w: largura, h };
  }
  lista.forEach((c, i) => { c.rx = melhor.pos[i][0]; c.ry = melhor.pos[i][1]; });
  return { w: melhor.w, h: melhor.h };
}

// Arquivos de uma cadeia: uma coluna por fase; fase com muitos arquivos
// quebra em mais colunas, e o número por coluna é o que der o formato deitado.
function mnLayoutFases(n, folga) {
  const fases = [...new Set(n.filhos.map(f => f.fase))].sort((a, b) => a - b);
  const gapCol = folga * 2 + 8, gapLin = Math.round(folga * .6);
  let melhor = null;
  for (let porColuna = 3; porColuna <= 8; porColuna++) {
    let x = 0, hMax = 0; const pos = new Map(), rotulos = [];
    fases.forEach(f => {
      const lista = n.filhos.filter(c => c.fase === f);
      for (let i = 0; i < lista.length; i += porColuna) {
        const bloco = lista.slice(i, i + porColuna), w = Math.max(...bloco.map(c => c.w));
        let y = 0;
        bloco.forEach(c => { pos.set(c, [x, MN_ROT_FASE + y]); y += c.h + gapLin; });
        hMax = Math.max(hMax, y - gapLin);
        if (i === 0) rotulos.push({ x, y: 0, texto: 'fase ' + f + (lista.length > porColuna ? ' ›' : '') });
        x += w + gapCol;
      }
    });
    const w = x - gapCol, h = MN_ROT_FASE + hMax, nota = Math.abs(Math.log((w / h) / 1.6));
    if (!melhor || nota < melhor.nota) melhor = { nota, pos, rotulos, w, h };
    if (n.filhos.length <= porColuna) break;
  }
  n.filhos.forEach(c => { [c.rx, c.ry] = melhor.pos.get(c); });
  n.rotulos = melhor.rotulos;
  return { w: melhor.w, h: melhor.h };
}

// Áreas (no programa) e blocos (numa área): a ORDEM vem de uma grade em que
// quem conversa fica vizinho. `tipo` diz quais setas contam — 'area' ou
// 'bloco' — e só contam as que têm as DUAS pontas em `itens`: um bloco pode
// ligar para um bloco de outra área, e essa seta não decide a grade desta.
function mnPlanejarGrade(itens, setas, tipo) {
  const dentro = new Set(itens);
  const minhas = setas.filter(s => s.tipo === tipo && dentro.has(s.de) && dentro.has(s.para));
  const n = itens.length, cols = Math.ceil(Math.sqrt(n)), lins = Math.ceil(n / cols);
  const viz = new Map(itens.map(a => [a, new Set()]));
  minhas.forEach(s => { viz.get(s.de).add(s.para); viz.get(s.para).add(s.de); });
  const livres = []; for (let l = 0; l < lins; l++) for (let c = 0; c < cols; c++) livres.push({ c, l });
  const centro = { c: (cols - 1) / 2, l: (lins - 1) / 2 }, pos = new Map();
  const d = (a, b) => Math.hypot(a.c - b.c, a.l - b.l);
  const ordem = itens.slice().sort((a, b) => viz.get(b).size - viz.get(a).size);
  while (pos.size < n) {
    const postos = x => [...viz.get(x)].filter(v => pos.has(v)).length;
    const a = ordem.filter(x => !pos.has(x)).sort((x, y) => postos(y) - postos(x))[0];
    const custo = cel => [...viz.get(a)].filter(v => pos.has(v)).reduce((s, v) => s + d(cel, pos.get(v)), 0) * 10 + d(cel, centro);
    livres.sort((x, y) => custo(x) - custo(y));
    pos.set(a, livres.shift());
  }
  const custoTotal = () => minhas.reduce((s, x) => s + d(pos.get(x.de), pos.get(x.para)) ** 2, 0) + d(pos.get(ordem[0]), centro);
  let melhorou = true;
  while (melhorou) {
    melhorou = false;
    for (const a of itens) for (const cel of [...pos.values(), ...livres]) {
      const b = itens.find(x => pos.get(x) === cel), pa = pos.get(a), antes = custoTotal();
      pos.set(a, cel); if (b) pos.set(b, pa); else livres.splice(livres.indexOf(cel), 1, pa);
      if (custoTotal() < antes - 1e-9) { melhorou = true; continue; }
      pos.set(a, pa); if (b) pos.set(b, cel); else livres.splice(livres.indexOf(pa), 1, cel);
    }
  }
  const linhas = [];
  for (let l = 0; l < lins; l++) linhas.push(itens.filter(a => pos.get(a).l === l).sort((a, b) => pos.get(a).c - pos.get(b).c));
  return { linhas: linhas.filter(l => l.length) };
}

const _mnCtxTexto = document.createElement('canvas').getContext('2d');
function mnLarguraRotulo(t) { _mnCtxTexto.font = '11px "Segoe UI", system-ui, sans-serif'; return _mnCtxTexto.measureText(t).width + 18; }

function mnRotuloEntre(setas, tipo, a, b) {
  const s = setas.filter(x => x.tipo === tipo && ((x.de === a && x.para === b) || (x.de === b && x.para === a)));
  return s.length ? Math.max(...s.map(x => mnLarguraRotulo(x.rotulo))) : 0;
}

// Programa (áreas) e área (blocos): o ESPAÇO entre dois vizinhos é a folga
// mais a largura da frase da seta entre eles — a frase nunca fica por baixo
// de um cartão. `tipo` é o das setas que levam frase: 'area' ou 'bloco'.
function mnLayoutGrade(n, plano, setas, tipo, folga) {
  const g = folga * 1.6;
  const linhas = plano.linhas.map(l => {
    let x = 0; const itens = [];
    l.forEach((a, i) => { if (i) x += g + mnRotuloEntre(setas, tipo, l[i - 1], a); itens.push([a, x]); x += a.w; });
    return { itens, w: x, h: Math.max(...l.map(a => a.h)) };
  });
  const largura = Math.max(...linhas.map(l => l.w));
  let y = 0;
  linhas.forEach((l, i) => {
    if (i) {
      // entre duas linhas: folga, mais espaço para a frase se alguma seta cruza de uma para a outra
      const tem = (linha, x) => linha.itens.some(([a]) => a === x);
      const cruza = setas.some(s => s.tipo === tipo && ((tem(l, s.de) && tem(linhas[i - 1], s.para)) || (tem(l, s.para) && tem(linhas[i - 1], s.de))));
      y += g + (cruza ? 34 : 0);
    }
    const x0 = (largura - l.w) / 2;
    l.itens.forEach(([a, x]) => { a.rx = x0 + x; a.ry = y + (l.h - a.h) / 2; });
    y += l.h;
  });
  n.rotulos = [];
  return { w: largura, h: y };
}

// ── setas ────────────────────────────────────────────────────────────────────

function mnPontoBorda(r, ax, ay, folga = 5) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, dx = ax - cx, dy = ay - cy;
  if (!dx && !dy) return [cx, cy];
  const t = Math.min((r.w / 2 + folga) / Math.abs(dx || 1e-9), (r.h / 2 + folga) / Math.abs(dy || 1e-9));
  return [cx + dx * t, cy + dy * t];
}

function mnCurva(a, b, desvio = 0) {
  let [x1, y1] = mnPontoBorda(a, b.x + b.w / 2, b.y + b.h / 2), [x2, y2] = mnPontoBorda(b, a.x + a.w / 2, a.y + a.h / 2);
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  let ox = 0, oy = 0;   // setas de ida e volta: cada rótulo vai para o seu lado
  if (desvio) { const nx = -dy / len * desvio, ny = dx / len * desvio; x1 += nx; y1 += ny; x2 += nx; y2 += ny; ox = nx * 1.5; oy = ny * 1.5; }
  let c1, c2;
  if (Math.abs(dy) > Math.abs(dx) * 1.3) {
    const f = Math.max(30, Math.abs(dy) * .4) * Math.sign(dy || 1);
    c1 = [x1, y1 + f]; c2 = [x2, y2 - f];
  } else {
    const f = Math.max(30, Math.abs(dx) * .4) * Math.sign(dx || 1);
    c1 = [x1 + f, y1]; c2 = [x2 - f, y2];
  }
  return { d: `M${x1},${y1} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${x2},${y2}`,
           meio: [(x1 + x2) / 2 + ox, (y1 + y2) / 2 + oy],
           pts: [[x1, y1], c1, c2, [x2, y2]], off: [ox, oy] };
}

function mnPontoNaCurva(curva, t) {
  const [p0, p1, p2, p3] = curva.pts, u = 1 - t;
  const f = i => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i];
  return [f(0) + curva.off[0], f(1) + curva.off[1]];
}

// A frase da seta procura, ao longo da curva, um lugar que não fique por cima
// de um cartão nem de outra frase. Sem lugar livre, ela só aparece em foco.
const MN_T_ROTULO = [.5, .4, .6, .3, .7, .22, .78];
const MN_DESVIO_ROTULO = [0, 24, -24, 48, -48];
function mnLugarDoRotulo(curva, w, h, ocupado) {
  const cruza = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const [p0, , , p3] = curva.pts, len = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]) || 1;
  const nx = -(p3[1] - p0[1]) / len, ny = (p3[0] - p0[0]) / len;
  for (const desvio of MN_DESVIO_ROTULO) for (const t of MN_T_ROTULO) {
    const [cx, cy] = mnPontoNaCurva(curva, t), x = cx + nx * desvio, y = cy + ny * desvio;
    const r = { x: x - w / 2 - 4, y: y - h / 2 - 3, w: w + 8, h: h + 6 };
    if (!ocupado.some(o => cruza(r, o))) { ocupado.push(r); return { x, y, livre: true }; }
  }
  const [x, y] = mnPontoNaCurva(curva, .5);
  return { x, y, livre: false };
}
