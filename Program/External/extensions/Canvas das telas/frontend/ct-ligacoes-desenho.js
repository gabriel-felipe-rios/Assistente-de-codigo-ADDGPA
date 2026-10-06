// ═══════════════════════════════════ CANVAS DAS TELAS — A GEOMETRIA DAS LIGAÇÕES ══
// Porte, sem mudar os números, do roteamento de `desenharSetas(` do preview
// aprovado (`Briefing/Referência · preview.html`): `ESPACO`, `_livre`,
// `_reservar`, `_caminho`, `_setinhas` e `_anel`.
//
// Cada ligação é um caminho em ângulo reto: sai do centro do elemento, anda
// na horizontal até uma "raia" no vão entre as colunas, sobe ou desce pela
// raia e entra na tela de destino pela lateral (mão única) ou vai até o outro
// elemento (mão dupla). Cada trecho reserva o seu lugar: dois trechos
// paralelos nunca ficam a menos de ESPACO px NA TELA um do outro — eles só se
// CRUZAM, em ângulo reto, nunca correm juntos (D18).
//
// Só geometria: recebe caixas no mundo e devolve texto de caminho SVG.

(function () {
  const ESPACO = 14;           // px na tela entre dois trechos paralelos (D18)
  const RAIO_CANTO = 10;       // px na tela
  const RAIO_BOLINHA = 7;      // px na tela — tamanho FIXO, grande ou pequeno o elemento (25/09/2026)
  const PASSO_SETINHA = 80;    // px na tela entre duas setinhas "›" (D25)
  // ⚠️ ABAIXO DESTE ZOOM, TUDO ENCOLHE JUNTO COM AS TELAS (25/09/2026). Antes,
  // linha, espaço e bolinha tinham tamanho fixo na tela em qualquer zoom: a
  // 6% o espaço de 14 px virava 230 px no mundo e as linhas eram empurradas
  // para longe das telas, em voltas enormes. Daqui para baixo o desenho é
  // uma foto afastada — `ct-estilo.css` faz o mesmo com a espessura.
  window.ctEstado.ESCALA_REFERENCIA = 0.4;
  const BRACO_SETINHA = 6;
  const MARGEM_SETINHA = 18;

  function _livre(ocup, eixo, v, de, ate, S) {
    const a = Math.min(de, ate) - S, b = Math.max(de, ate) + S;
    return !ocup.some(o => o.eixo === eixo && Math.abs(o.v - v) < S && o.b > a && o.a < b);
  }

  // Procura, em passos de 1/4 do espaço, o lugar livre mais perto do desejado.
  // Não achando dentro do limite, procura fora dele — encostar nunca é saída.
  function _reservar(ocup, eixo, desejado, de, ate, S, lim, extra) {
    const passo = S / 4;
    for (const usarLim of lim ? [true, false] : [false]) {
      for (let k = 0; k < 1600; k++) {
        const v = desejado + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * passo;
        if (usarLim && (v < lim[0] || v > lim[1])) continue;
        if (_livre(ocup, eixo, v, de, ate, S) && (!extra || extra(v))) {
          ocup.push({ eixo, v, a: Math.min(de, ate), b: Math.max(de, ate) });
          return v;
        }
      }
    }
    ocup.push({ eixo, v: desejado, a: Math.min(de, ate), b: Math.max(de, ate) });
    return desejado;
  }

  const _semRepetidos = pts => pts.filter((p, i) => i === 0 ||
    Math.abs(p.x - pts[i - 1].x) > 0.5 || Math.abs(p.y - pts[i - 1].y) > 0.5);

  // Cantos arredondados.
  function _caminho(pts, R) {
    pts = _semRepetidos(pts);
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
      const l1 = Math.hypot(p1.x - p0.x, p1.y - p0.y), l2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const r = Math.min(R, l1 / 2, l2 / 2);
      const ax = p1.x + (p0.x - p1.x) / l1 * r, ay = p1.y + (p0.y - p1.y) / l1 * r;
      const bx = p1.x + (p2.x - p1.x) / l2 * r, by = p1.y + (p2.y - p1.y) / l2 * r;
      d += ` L${ax},${ay} Q${p1.x},${p1.y} ${bx},${by}`;
    }
    const u = pts[pts.length - 1];
    return d + ` L${u.x},${u.y}`;
  }

  // Setinhas "›" ao longo dos trechos retos — só na ligação de mão única.
  function _setinhas(pts, escala) {
    let d = '';
    const passo = PASSO_SETINHA / escala, a = BRACO_SETINHA / escala, margem = MARGEM_SETINHA / escala;
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1], L = Math.hypot(q.x - p.x, q.y - p.y);
      if (L < 2 * margem + a) continue;
      const ux = (q.x - p.x) / L, uy = (q.y - p.y) / L;
      const n = Math.max(1, Math.floor((L - 2 * margem) / passo));
      for (let k = 0; k < n; k++) {
        const t = margem + (L - 2 * margem) * (k + 0.5) / n;
        const cx = p.x + ux * t, cy = p.y + uy * t;
        d += `M${cx - ux * a + uy * a},${cy - uy * a - ux * a} L${cx},${cy} L${cx - ux * a - uy * a},${cy - uy * a + ux * a} `;
      }
    }
    return d;
  }

  // A marca no centro do elemento, de tamanho fixo: vazada (contorno preto e
  // a cor, furo aberto — D14), cheia, ✕ ou nenhuma.
  function _anel(c, esc, tipo) {
    const r = RAIO_BOLINHA / esc, x = c.cx, y = c.meio;
    if (tipo === 'nenhuma') return '';
    if (tipo === 'cheia') return `<circle class="ct-anel-cheio" cx="${x}" cy="${y}" r="${r}"/>`;
    if (tipo === 'x') {
      const d = `M${x - r},${y - r} L${x + r},${y + r} M${x + r},${y - r} L${x - r},${y + r}`;
      return `<path class="ct-anel-borda ct-anel-x" d="${d}"/><path class="ct-anel ct-anel-x" d="${d}"/>`;
    }
    return `<circle class="ct-anel-borda" cx="${x}" cy="${y}" r="${r}"/>` +
           `<circle class="ct-anel" cx="${x}" cy="${y}" r="${r}"/>`;
  }

  // `visiveis`: [{cb, cq, ca, cv, …}] — cb o elemento de origem, cq a tela
  // dele, ca a tela de destino, cv o elemento da volta (mão dupla) ou null.
  // Devolve, na mesma ordem, [{item, d, setas, aneis}].
  // `opcoes`: {bolinha: 'vazada'|'cheia'|'x'|'nenhuma'} — 'nenhuma' também
  // quando a seta sai da tela inteira (modo "Por arquivo").
  window.ctRotear = function (visiveis, escala, largura, opcoes) {
    const esc = Math.max(escala, window.ctEstado.ESCALA_REFERENCIA);
    const S = ESPACO / esc, R = RAIO_CANTO / esc;
    const tipo = (opcoes && opcoes.bolinha) || 'vazada';
    const vao = Math.max(260, largura * 0.35);
    const ocup = [];
    return visiveis.map(l => {
      const { cb, cq, ca, cv } = l;
      let raiaDesejada, bordaX;
      if (ca.esq > cq.dir) { raiaDesejada = ca.esq - vao / 2; bordaX = ca.esq; }
      else if (ca.dir < cq.esq) { raiaDesejada = ca.dir + vao / 2; bordaX = ca.dir; }
      else { raiaDesejada = Math.max(cq.dir, ca.dir) + vao / 3; bordaX = ca.dir; }
      const fimX = cv ? cv.cx : bordaX;

      let raiaAlvo = raiaDesejada, raiaX, saidaY, entradaY;
      for (let tentativa = 0; ; tentativa++) {
        const b0 = ocup.length;
        const raia0 = _reservar(ocup, 'v', raiaAlvo, cb.meio, cv ? cv.meio : (ca.topo + ca.base) / 2, S, null);
        saidaY = _reservar(ocup, 'h', cb.meio, cb.cx, raia0, S, [cq.topo + S, cq.base - S],
          v => Math.abs(v - cb.meio) < 1 || _livre(ocup, 'v', cb.cx, cb.meio, v, S));
        const entradaDesejada = cv ? cv.meio : Math.min(Math.max(saidaY, ca.topo + 3 * S), ca.base - 3 * S);
        entradaY = _reservar(ocup, 'h', entradaDesejada, raia0, fimX, S, [ca.topo + S, ca.base - S],
          cv ? (v => Math.abs(v - cv.meio) < 1 || _livre(ocup, 'v', cv.cx, cv.meio, v, S)) : null);
        ocup.splice(b0, 1);
        raiaX = _reservar(ocup, 'v', raia0, saidaY, entradaY, S, null);
        if (Math.abs(raiaX - raia0) < 1 || tentativa >= 8) {
          ocup[b0].a = Math.min(cb.cx, raiaX); ocup[b0].b = Math.max(cb.cx, raiaX);
          ocup[b0 + 1].a = Math.min(raiaX, fimX); ocup[b0 + 1].b = Math.max(raiaX, fimX);
          break;
        }
        ocup.splice(b0);
        raiaAlvo = raiaX;
      }
      if (Math.abs(saidaY - cb.meio) >= 1) ocup.push({ eixo: 'v', v: cb.cx, a: Math.min(cb.meio, saidaY), b: Math.max(cb.meio, saidaY) });
      if (cv && Math.abs(entradaY - cv.meio) >= 1) ocup.push({ eixo: 'v', v: cv.cx, a: Math.min(cv.meio, entradaY), b: Math.max(cv.meio, entradaY) });

      const pts = [{ x: cb.cx, y: cb.meio }, { x: cb.cx, y: saidaY }, { x: raiaX, y: saidaY },
                   { x: raiaX, y: entradaY }, { x: fimX, y: entradaY }];
      if (cv) pts.push({ x: cv.cx, y: cv.meio });
      return {
        item: l,
        d: _caminho(pts, R),
        setas: cv ? '' : _setinhas(_semRepetidos(pts), esc),
        aneis: _anel(cb, esc, tipo) + (cv ? _anel(cv, esc, tipo) : ''),
      };
    });
  };
})();
