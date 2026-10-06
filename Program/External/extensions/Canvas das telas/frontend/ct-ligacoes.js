// ═══════════════════════════════════ CANVAS DAS TELAS — AS LIGAÇÕES ══
// Juntar, filtrar e desenhar as ligações por cima das telas, e os controles
// delas (a chave "Setas…", a opacidade, a cor, e as duas opções do ⚙).
//
// ⚠️ As ligações vêm SÓ da leitura (`ctEstado.leitura.ligacoes`) — nada é
// inferido do DOM da página (D7, P4). Do DOM da página chega só ONDE está
// cada elemento de origem (`ctEstado.posicoesDe`, pela ponte).

(function () {
  const REDESENHO_MS = 40;
  const ACESA_MS = 1800;
  const E = () => window.ctEstado;
  const montada = () => typeof window.ctMontada === 'function' && window.ctMontada();
  const achar = id => E().container && E().container.querySelector('#' + id);
  let escalaDoDesenho = null, agendado = null, apagarAcesa = null;

  // ── as caixas no mundo ────────────────────────────────────────────────────
  function caixaDaTela(id) {
    const p = E().posicoes[id];
    if (!p) return null;
    const [w, h] = E().tamanhos[E().tamanho];
    return { esq: p.x, dir: p.x + w, topo: p.y, base: p.y + h };
  }

  // A tela dele somada ao retângulo que a página mandou, mais 1 px da borda
  // do iframe. Sem retângulo, ou escondido (0 × 0): sem ligação.
  function caixaDoElemento(tela, chave) {
    const p = E().posicoes[tela], pos = E().posicoesDe[tela];
    if (!p || !pos) return null;
    const it = (pos.itens || []).find(i => i.chave === chave);
    if (!it || (it.w === 0 && it.h === 0)) return null;
    const x = p.x + 1 + it.x, y = p.y + 1 + it.y;
    return { esq: x, dir: x + it.w, cx: x + it.w / 2, meio: y + it.h / 2, topo: y, base: y + it.h };
  }

  // Rolado para fora da vista da página dele, o elemento perde a linha (D40).
  function naVista(tela, chave) {
    const pos = E().posicoesDe[tela];
    const it = pos && (pos.itens || []).find(i => i.chave === chave);
    if (!it) return false;
    const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
    return cx >= 0 && cx <= pos.largura && cy >= 0 && cy <= pos.altura;
  }

  const mesma = (a, b) => !!a && !!b && a.de === b.de && a.para === b.para && a.origem.chave === b.origem.chave;

  // ── juntar e filtrar ──────────────────────────────────────────────────────
  function juntar() {
    const e = E(), m = achar('ct-mundo');
    const existe = id => m && [...m.querySelectorAll('.ct-quadro')].some(q => q.dataset.id === id);
    const todas = ((e.leitura && e.leitura.ligacoes) || [])
      .filter(l => existe(l.de) && existe(l.para))
      .map(l => ({ ligacao: l, volta: null, usada: false }));
    // Mão dupla: A→B com um B→A ainda sem par viram UMA linha, de elemento a elemento (D28).
    todas.forEach(l => {
      if (l.usada || l.volta) return;
      const v = todas.find(o => o !== l && !o.usada && !o.volta &&
        o.ligacao.de === l.ligacao.para && o.ligacao.para === l.ligacao.de);
      if (v) { l.volta = v.ligacao; v.usada = true; }
    });
    return todas.filter(l => !l.usada);
  }

  function filtrar(ligacoes) {
    const e = E();
    const visiveis = [];
    ligacoes.forEach(l => {
      const { de, para, origem } = l.ligacao;
      if (e.modoSetas !== 'todas' && de !== e.escolhida && para !== e.escolhida) return;     // D12
      if (!naVista(de, origem.chave) || (l.volta && !naVista(l.volta.de, l.volta.origem.chave))) return;
      const cb = caixaDoElemento(de, origem.chave);
      const cv = l.volta ? caixaDoElemento(l.volta.de, l.volta.origem.chave) : null;
      if (!cb || (l.volta && !cv)) return;
      visiveis.push(Object.assign(l, { cb, cv, cq: caixaDaTela(de), ca: caixaDaTela(para) }));
    });
    visiveis.sort((x, y) => x.cb.meio - y.cb.meio);
    return visiveis;
  }

  // ── o modo "Por arquivo": uma seta por par de telas ──────────────────────
  // Todas as ligações de A para B viram UMA seta, da borda de A à de B; com
  // B→A também, é mão dupla (sem setinhas). A seta sai da tela inteira, então
  // não depende de o elemento estar na vista.
  function juntarPorTela() {
    const e = E(), m = achar('ct-mundo');
    const existe = id => m && [...m.querySelectorAll('.ct-quadro')].some(q => q.dataset.id === id);
    const pares = new Map();
    ((e.leitura && e.leitura.ligacoes) || []).forEach(l => {
      if (!existe(l.de) || !existe(l.para)) return;
      const k = l.de + '|' + l.para;
      if (!pares.has(k)) pares.set(k, { ligacao: l, volta: null, usada: false, porTela: true });
    });
    const todas = [...pares.values()];
    todas.forEach(p => {
      if (p.usada || p.volta) return;
      const v = pares.get(p.ligacao.para + '|' + p.ligacao.de);
      if (v && v !== p && !v.usada) { p.volta = v.ligacao; v.usada = true; }
    });
    return todas.filter(p => !p.usada);
  }

  // O lado da tela `c` que olha para a tela `outra`.
  const ladoPara = (c, outra) => (outra.dir < c.esq ? 'esq' : 'dir');
  const ponto = (x, y) => ({ esq: x, dir: x, cx: x, meio: y, topo: y, base: y });

  function filtrarPorTela(pares) {
    const e = E(), visiveis = [];
    pares.forEach(p => {
      const { de, para } = p.ligacao;
      if (e.modoSetas !== 'todas' && de !== e.escolhida && para !== e.escolhida) return;
      const cq = caixaDaTela(de), ca = caixaDaTela(para);
      if (cq && ca) visiveis.push(Object.assign(p, { cq, ca }));
    });
    // As pontas de cada lado de cada tela se espalham pela borda, centradas,
    // na ordem da altura da outra tela — para duas setas não saírem do mesmo
    // ponto nem se cruzarem à toa.
    const esc = Math.max(e.escala, e.ESCALA_REFERENCIA), passo = 28 / esc;
    const grupos = new Map();
    const ponta = (tela, c, outra, item, qual) => {
      const lado = ladoPara(c, outra), k = tela + '|' + lado;
      if (!grupos.has(k)) grupos.set(k, { c, lado, pontas: [] });
      grupos.get(k).pontas.push({ item, qual, alvoY: (outra.topo + outra.base) / 2 });
    };
    visiveis.forEach(p => {
      ponta(p.ligacao.de, p.cq, p.ca, p, 'cb');
      if (p.volta) ponta(p.ligacao.para, p.ca, p.cq, p, 'cv');
    });
    grupos.forEach(({ c, lado, pontas }) => {
      pontas.sort((a, b) => a.alvoY - b.alvoY);
      const meio = (c.topo + c.base) / 2, x = lado === 'esq' ? c.esq : c.dir;
      const max = (c.base - c.topo) / 2 - passo;
      pontas.forEach((pt, i) => {
        const y = meio + Math.max(-max, Math.min(max, (i - (pontas.length - 1) / 2) * passo));
        pt.item[pt.qual] = ponto(x, y);
      });
    });
    visiveis.forEach(p => { if (!p.volta) p.cv = null; });
    visiveis.sort((x, y) => x.cb.meio - y.cb.meio);
    return visiveis;
  }

  // ── desenhar ──────────────────────────────────────────────────────────────
  // A espessura das linhas se divide por estas duas (ver `ct-estilo.css`):
  // `--ct-ref` é o zoom, mas nunca abaixo da referência (abaixo dela a linha
  // encolhe com as telas); `--ct-z` é o zoom de verdade, para o mínimo de 1 px.
  function pintarEscala(svg) {
    const z = E().escala;
    svg.style.setProperty('--ct-ref', String(Math.max(z, E().ESCALA_REFERENCIA)));
    svg.style.setProperty('--ct-z', String(z));
  }
  function escalaNoSvg() {
    const m = achar('ct-mundo'), svg = m && m.querySelector('#ct-setas');
    if (svg) pintarEscala(svg);
  }

  function svgDoMundo(m) {
    let svg = m.querySelector('#ct-setas');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = 'ct-setas';
      svg.setAttribute('class', 'ct-setas');
    }
    // SEMPRE o último filho: o que vem depois pinta por cima — as ligações
    // ficam por cima das telas (D17, F23). `montarQuadros()` recria as telas
    // e o empurraria para trás.
    m.appendChild(svg);
    pintarEscala(svg);
    return svg;
  }

  function desenhar() {
    agendado = null;
    const e = E(), m = achar('ct-mundo');
    if (!montada() || !m || !e.leitura) return;
    escalaDoDesenho = e.escala;
    const porTela = e.origemSetas === 'tela';
    const ligacoes = porTela ? juntarPorTela() : juntar();
    const visiveis = porTela ? filtrarPorTela(ligacoes) : filtrar(ligacoes);
    // Saindo da tela inteira, não há elemento para marcar.
    const rotas = window.ctRotear(visiveis, e.escala, e.tamanhos[e.tamanho][0],
                                  { bolinha: porTela ? 'nenhuma' : e.bolinha });

    let base = '', acesas = '', bolinhas = '', bolinhasAcesas = '';
    rotas.forEach(({ item, d, setas, aneis }) => {
      const on = item.porTela
        ? !!e.acesa && ((e.acesa.de === item.ligacao.de && e.acesa.para === item.ligacao.para) ||
                        (!!item.volta && e.acesa.de === item.volta.de && e.acesa.para === item.volta.para))
        : mesma(e.acesa, item.ligacao) || mesma(e.acesa, item.volta);
      const cls = on ? ' acesa' : '';
      // Sem cabeça de seta na ponta (D14); borda preta em tudo (D19).
      const desenho = `<path class="ct-borda${cls}" d="${d}"/><path class="ct-seta${cls}" d="${d}"/>` +
        (setas ? `<path class="ct-borda${cls}" d="${setas}"/><path class="ct-seta${cls}" d="${setas}"/>` : '');
      if (on) { acesas += desenho; bolinhasAcesas += aneis; } else { base += desenho; bolinhas += aneis; }
    });

    // Os recortes: dentro e fora das telas — as mesmas linhas nos dois grupos.
    let dentro = '', fora = '';
    m.querySelectorAll('.ct-quadro').forEach(q => {
      const c = caixaDaTela(q.dataset.id);
      if (!c) return;
      const r = `x="${c.esq}" y="${c.topo}" width="${c.dir - c.esq}" height="${c.base - c.topo}"`;
      dentro += `<rect ${r} fill="white"/>`;
      fora += `<rect ${r} fill="black"/>`;
    });
    const tudo = 'x="-100000" y="-100000" width="200000" height="200000"';
    svgDoMundo(m).innerHTML = `<defs>
        <mask id="ct-m-dentro" maskUnits="userSpaceOnUse" ${tudo}><rect ${tudo} fill="black"/>${dentro}</mask>
        <mask id="ct-m-fora" maskUnits="userSpaceOnUse" ${tudo}><rect ${tudo} fill="white"/>${fora}</mask>
      </defs>
      <g id="ct-g-dentro" mask="url(#ct-m-dentro)">${base}</g>
      <g id="ct-g-fora" mask="url(#ct-m-fora)">${base}</g>
      <g id="ct-g-bolinhas">${bolinhas}</g>
      <g>${acesas}${bolinhasAcesas}</g>`;
    aplicarOpacidades();

    const stat = achar('ct-stat');
    if (stat) {
      const maos = visiveis.filter(l => l.volta).length;
      stat.textContent = `${(e.leitura.telas || []).length} telas · ${visiveis.length} de ${ligacoes.length} ligações ` +
        `(${maos} de mão dupla) · lido às ${e.leitura.lido_em || ''}`;
    }
  }

  // A opacidade mora nos GRUPOS, não em cada linha: o cruzamento de duas
  // linhas não escurece (F26).
  function aplicarOpacidades() {
    const e = E(), op = e.opacidade / 100;
    const fora = op > 0 && e.ganhoLigado ? Math.min(1, op + e.ganho / 100) : op;      // D22
    const bolinha = e.reducaoLigada ? Math.max(0, op - e.reducao / 100) : op;        // D23
    const ajustar = (id, v) => { const g = achar(id); if (g) g.setAttribute('opacity', v); };
    ajustar('ct-g-dentro', op);
    ajustar('ct-g-fora', fora);
    ajustar('ct-g-bolinhas', bolinha);
    const val = achar('ct-op-val');
    if (val) val.textContent = e.opacidade + '%';
  }

  // Sem `tela` (vindo de `aplicar()`), só a escala importa: o SVG está dentro
  // do mundo, e arrastar o canvas não muda nada nele.
  window.ctAoMudarPosicoes = function (tela) {
    if (tela === undefined && E().escala === escalaDoDesenho) return;
    escalaNoSvg();          // na hora: a espessura não espera o redesenho
    if (agendado !== null) return;
    agendado = setTimeout(() => { if (montada()) desenhar(); else agendado = null; }, REDESENHO_MS);
  };

  window.ctAoAcender = function (ligacao) {
    E().acesa = ligacao;
    desenhar();
    clearTimeout(apagarAcesa);
    apagarAcesa = setTimeout(() => {
      if (!montada()) return;
      E().acesa = null;
      desenhar();
    }, ACESA_MS);
  };

  window.ctDesenharLigacoes = desenhar;
  window.ctAplicarOpacidades = aplicarOpacidades;

  // ── os controles ──────────────────────────────────────────────────────────
  const gravar = () => window.ctChamar('estado_gravar', { estado: E().gravavel() });
  const pinta = (pill, on) => {
    pill.querySelector('.toggle-track').classList.toggle('on', on);
    pill.querySelector('.toggle-label').classList.toggle('on', on);
  };
  const numero = v => Math.min(100, Math.max(0, parseInt(v, 10) || 0));

  function ligarControles(container) {
    container.addEventListener('click', ev => {
      const alvo = ev.target;
      if (!alvo.closest) return;
      const modo = alvo.closest('#ct-setas-modo [data-modo]');
      const origem = alvo.closest('#ct-setas-origem [data-origem]');
      const pill = alvo.closest('.toggle-pill[data-opcao]');
      const cor = alvo.closest('#ct-cores .ct-cor');
      if (origem) {
        E().origemSetas = origem.dataset.origem;
        container.querySelectorAll('#ct-setas-origem [data-origem]').forEach(b => b.classList.toggle('active', b === origem));
        gravar();
        desenhar();
      } else if (modo) {
        E().modoSetas = modo.dataset.modo;
        container.querySelectorAll('#ct-setas-modo [data-modo]').forEach(b => b.classList.toggle('active', b === modo));
        gravar();
        desenhar();
      } else if (alvo.closest('#ct-cor-bolinha')) {
        window.ctAlternarPop('ct-pop-cor');
      } else if (cor) {
        const e = E();
        e.cor = cor.dataset.cor;
        container.querySelectorAll('#ct-cores .ct-cor').forEach(b => b.classList.toggle('ativa', b === cor));
        const c = achar('ct-canvas'), bola = achar('ct-cor-bolinha');
        if (c) c.style.setProperty('--ct-seta-cor', `rgb(var(${e.cor}))`);
        if (bola) bola.style.background = `rgb(var(${e.cor}))`;
        gravar();
      } else if (pill) {
        ev.preventDefault();
        const e = E(), k = pill.dataset.opcao === 'ganho' ? 'ganhoLigado' : 'reducaoLigada';
        e[k] = !e[k];
        pinta(pill, e[k]);
        aplicarOpacidades();
        gravar();
      }
    });
    // O range aplica ao arrastar; grava só no `change`.
    container.addEventListener('input', ev => {
      const t = ev.target;
      if (t.id === 'ct-opacidade') { E().opacidade = numero(t.value); aplicarOpacidades(); }
      else if (t.id === 'ct-ganho') { E().ganho = numero(t.value); aplicarOpacidades(); }
      else if (t.id === 'ct-reducao') { E().reducao = numero(t.value); aplicarOpacidades(); }
    });
    container.addEventListener('change', ev => {
      const t = ev.target;
      if (t.id === 'ct-bolinha') {
        E().bolinha = t.value;
        gravar();
        desenhar();
        return;
      }
      if (t.id === 'ct-opacidade' || t.id === 'ct-ganho' || t.id === 'ct-reducao') {
        if (t.id !== 'ct-opacidade') t.value = numero(t.value);
        gravar();
      }
    });
  }
  window.ctEstado.ligadores.push(ligarControles);
})();
