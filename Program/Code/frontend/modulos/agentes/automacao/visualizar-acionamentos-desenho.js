// ═══════════════════════ AGENTES: VISUALIZAR ACIONAMENTOS — DESENHO ══
// Onde cada coisa fica. O que está acontecendo com cada uma é assunto de
// `visualizar-acionamentos.js`; aqui só se sabe geometria.
//
// O desenho é o «freio com tronco» (variação C do preview aprovado, D11/D23):
//
//   ┌ A base ───────┐        ┌ T1 · rápido · sem IA ─────────────────────┐
//   │ Detector      │   ┌───→│ Índice de Símbolos → [Identificadores ]   │
//   │    ↓          │   │    │                      [Duplicados      ]   │
//   │ Hashes        │   │    │ Grafo de Imports  Bibliotecas  Comentários│
//   │    ↓          │   │    └───────────────────────────────────────────┘
//   │ Sincronia     │   │    ┌ T2 · com IA · para o assistente ──────────┐
//   └───────────────┘   ├───→│ Documentação Técnica → [Navegação]        │
//          ↓            │    │ Pipeline               [Glossário]        │
//   ┌ O freio e a vez ──┐    └───────────────────────────────────────────┘
//   │ Espera            │    ┌ T3 · com IA · lento · para você ler ──────┐
//   │    ↓              ├───→│ Resumo de Pastas → Embedding Semântico    │
//   │ Revezamento       │    └───────────────────────────────────────────┘
//   └───────────────────┘
//
// Caixas e cards são HTML em fluxo (flex), não posição absoluta; as setas vão
// num `<svg>` por cima, medidas do DOM DEPOIS de montar (`_visDesenharSetas`).
//
// ⚠️ A REGRA DA SETA (card × caixa) — «só começa quando o de trás termina»:
//   · saindo de um CARD, espera só aquele card;
//   · saindo de uma CAIXA, espera o grupo inteiro (base → freio, freio → T1/T2/T3);
//   · card sem seta chegando começa quando o grupo dele começa.
//
// ⚠️ A REGRA DA SUBCAIXA: quando duas ou mais rotinas do mesmo grupo têm
// exatamente o mesmo ÚNICO requisito dentro do grupo, elas ficam juntas numa
// subcaixa sem nome ao lado dele, e a seta vai do requisito para a subcaixa
// (uma seta só). Hoje: Identificadores e Duplicados ← Índice de Símbolos;
// Navegação e Glossário ← Documentação Técnica.
//
// ⚠️ As dependências NÃO são declaradas neste arquivo. Elas vêm do backend
// (`get_dependencias_acionamentos`), que as lê do mesmo `_AC_REQUISITOS` que o
// ciclo respeita de fato. Antes estavam reescritas à mão aqui, e as duas
// cópias divergiram. Os grupos, a ordem dos cards e o selo de etapas vêm de
// `explicacoes-dados.js` — o mesmo lugar da tabela de Explicações.
//
// Requisito de OUTRO grupo (Pipeline ← Índice de Símbolos; Resumo de Pastas e
// Embedding ← Documentação Técnica) é desenhado igual, contornando as caixas
// pela calha: uma seta só sai pela calha da esquerda; várias do mesmo card
// dividem um tronco pela calha da direita, e entram no card pelo lado (quando
// nada está à direita dele) ou por baixo.

// A BASE, na ordem em que roda. Sem chave em Acionamentos, sempre desenhada.
// ⚠️ Lida também por `visualizar-acionamentos.js` (a chave e a contagem da
// Situação) — é a lista canônica da base no frontend.
const VIS_BASE = ['detector', 'hashes', 'sincronia'];

// O freio e a vez: a Espera tem chave, o Revezamento não.
const VIS_FREIO = ['espera', 'revezamento'];

const VIS_PONTA    = 9;     // comprimento da ponta — ela encosta no card
// A tela INTEIRA (desenho + painel) escala junto, entre estes dois: encolhe
// numa janela estreita e cresce um pouco numa larga. Escalar só o desenho
// deixava o painel do mesmo tamanho, apertando o desenho até ele rolar.
const VIS_ZOOM_MIN = 0.5;
const VIS_ZOOM_MAX = 1.2;

// O rótulo de cada grupo no desenho. Os segundos de silêncio entram na hora.
// ⚠️ Sem os números ①–⑤: eram um carimbo pequeno demais para ler, colado na
// calha das setas, e a ordem já está no desenho.
const VIS_ROTULOS = {
  base:  () => 'A base',
  freio: () => 'O freio e a vez',
  t1: s => `<b>T1</b>rápido · sem IA${s}`,
  t2: s => `<b>T2</b>com IA · para o assistente${s}`,
  t3: s => `<b>T3</b>com IA · lento · para você ler${s}`,
};

// As setas do desenho atual: [de, para, jeito]. Guardadas para o foco do mouse
// e para redesenhar a cada `resize` sem remontar as caixas.
let _visSetas = [];
let _visResizeWired = false;

function _visMeta(id) {
  const e = (typeof EXPLICACOES_ROTINAS !== 'undefined') && EXPLICACOES_ROTINAS[id];
  if (e) return e;
  // Rotina que o backend conhece e `explicacoes-dados.js` não: aparece com
  // ícone genérico no T1, em vez de sumir. Sumir em silêncio é exatamente o
  // defeito que esta tela já teve — uma rotina esquecida precisa APARECER
  // errada, não desaparecer.
  const nome = (typeof AC_NOMES_AGENTES !== 'undefined' && AC_NOMES_AGENTES[id]) || id;
  return { grupo: 't1', icone: '⚙️', nome, oQueFaz: '', etapas: 1 };
}

// ── Montagem ─────────────────────────────────────────────────────────────────

// `dados` = { ordem, requisitos, settings, debounces, esperaLigada }.
// `soLigados` esconde as rotinas desligadas e as setas que levam a elas.
function _visMontarDesenho(dados, soLigados) {
  const alvo = document.getElementById('vis-desenho');
  if (!alvo) return;

  const req      = dados.requisitos || {};
  const ordem    = dados.ordem || Object.keys(req);
  const settings = dados.settings || {};
  const ligado   = id => !!settings[id] && settings[id] !== 'off';
  // A base e o Revezamento não obedecem ao filtro (não têm chave); a Espera sim.
  const mostra   = id => !soLigados || VIS_BASE.includes(id) || id === 'revezamento' || ligado(id);

  // Quem mora em cada grupo T: os de `explicacoes-dados.js`, na ordem de lá,
  // que o backend conhece; depois os que o backend conhece e lá não estão.
  const conhecidas = new Set(ordem);
  const doGrupo = g => {
    const ids = (typeof EXPLICACOES_ROTINAS !== 'undefined')
      ? Object.keys(EXPLICACOES_ROTINAS).filter(id => EXPLICACOES_ROTINAS[id].grupo === g && conhecidas.has(id))
      : [];
    if (g === 't1') {
      ordem.forEach(id => {
        if (VIS_BASE.includes(id) || VIS_FREIO.includes(id)) return;
        if (typeof EXPLICACOES_ROTINAS === 'undefined' || !EXPLICACOES_ROTINAS[id]) ids.push(id);
      });
    }
    return ids.filter(mostra);
  };

  const setas = [];
  const d = dados.debounces || {};
  const tempo = g => {
    if (dados.esperaLigada === false) return '<span class="tempo">sem freio</span>';
    return d[g] != null ? `<span class="tempo">${d[g]} s de silêncio</span>` : '';
  };

  // A base e o freio
  const base = VIS_BASE.filter(mostra);
  for (let i = 0; i < base.length - 1; i++) setas.push([base[i], base[i + 1], 'desce']);
  const freio = VIS_FREIO.filter(mostra);
  if (freio.length === 2) setas.push(['espera', 'revezamento', 'desce']);
  setas.push(['base', 'freio', 'desce']);

  const colBaseFreio =
    _visGrupoHtml('base', 'base', `<div class="vis-col">${base.map(_visNoHtml).join('')}</div>`) +
    _visGrupoHtml('freio', 'freio', `<div class="vis-col">${freio.map(_visNoHtml).join('')}</div>`);

  // T1, T2, T3
  const grupos = ['t1', 't2', 't3'];
  const grupoDe = {};
  const htmlGrupos = grupos.map(g => {
    const ids = doGrupo(g);
    ids.forEach(id => { grupoDe[id] = g; });
    if (!ids.length) return '';
    setas.push(['freio', g, 'lado']);
    return _visGrupoHtml(g, '', _visMiolo(ids, req, setas), tempo(g));
  }).join('');

  // Requisitos de OUTRO grupo: card → card, pela calha.
  const cruzadas = {};
  Object.keys(grupoDe).forEach(para => {
    (req[para] || []).forEach(de => {
      if (grupoDe[de] && grupoDe[de] !== grupoDe[para]) (cruzadas[de] = cruzadas[de] || []).push(para);
    });
  });
  Object.entries(cruzadas).forEach(([de, paras]) => {
    const jeito = paras.length > 1 ? 'tronco-direita' : 'calha-esquerda';
    paras.forEach(para => setas.push([de, para, jeito]));
  });

  alvo.innerHTML =
    `<div class="vis-lin vis-lin-topo" style="gap:70px">
       <div class="vis-col" style="gap:40px">${colBaseFreio}</div>
       <div class="vis-col" style="gap:30px">${htmlGrupos}</div>
     </div>`;

  // Um card que recebe seta por baixo precisa de respiro embaixo da caixa dele.
  setas.forEach(([de, para, jeito]) => {
    if (jeito !== 'tronco-direita') return;
    const b = _visEl(para);
    if (b && _visTemVizinhoADireita(b)) b.closest('.vis-grp')?.classList.add('recebe-baixo');
  });

  _visSetas = setas;
  _visWireFoco(alvo);
  _visWireResize();
  _visCaber();
  _visDesenharSetas();
}

// O miolo de um grupo T: as rotinas que não dependem de ninguém do grupo são
// cabeças; cada cabeça puxa, à direita, quem depende só dela (em subcaixa
// quando são duas ou mais). As cabeças sem ninguém atrás ficam numa linha
// embaixo — ou, se é uma só, embaixo da primeira cabeça.
function _visMiolo(ids, req, setas) {
  const dentro = id => (req[id] || []).filter(r => ids.includes(r));
  const seguidores = r => ids.filter(id => {
    const d = dentro(id);
    return d.length === 1 && d[0] === r;
  });
  const usados = new Set();

  const bloco = id => {
    usados.add(id);
    const seg = seguidores(id);
    if (!seg.length) return _visNoHtml(id);
    let depois;
    if (seg.length >= 2) {
      const sub = 's-' + id;
      seg.forEach(s => usados.add(s));
      setas.push([id, sub, 'lado']);
      depois = `<div class="vis-sub" data-no="${sub}" id="vis-x-${sub}">${seg.map(bloco).join('')}</div>`;
    } else {
      setas.push([id, seg[0], 'lado']);
      depois = bloco(seg[0]);
    }
    return `<div class="vis-lin">${_visNoHtml(id)}${depois}</div>`;
  };

  const cabecas = ids.filter(id => !dentro(id).length);
  const cadeias = cabecas.filter(id => seguidores(id).length);
  const soltas  = cabecas.filter(id => !seguidores(id).length);
  // Quem depende de dois ou mais do grupo: card solto, com uma seta de cada.
  const multiplos = ids.filter(id => dentro(id).length > 1);
  multiplos.forEach(id => dentro(id).forEach(r => setas.push([r, id, 'lado'])));

  const linhas = cadeias.map(bloco);
  const resto = soltas.concat(multiplos.filter(id => !usados.has(id)));
  resto.forEach(id => usados.add(id));
  if (resto.length === 1 && linhas.length === 1) {
    // Uma cabeça só embaixo da cadeia: vai na coluna da cabeça (o Pipeline
    // embaixo da Documentação Técnica), com a subcaixa ao lado das duas.
    const cab = cadeias[0];
    const html = linhas[0].replace(
      `<div class="vis-lin">${_visNoHtml(cab)}`,
      `<div class="vis-lin vis-lin-topo"><div class="vis-col">${_visNoHtml(cab)}${_visNoHtml(resto[0])}</div>`);
    return `<div class="vis-col">${html}</div>`;
  }
  if (resto.length) linhas.push(`<div class="vis-lin" style="gap:10px">${resto.map(_visNoHtml).join('')}</div>`);
  if (!linhas.length) return '';
  return `<div class="vis-col">${linhas.join('')}</div>`;
}

function _visGrupoHtml(id, cls, dentro, tempo) {
  const rot = VIS_ROTULOS[id] ? VIS_ROTULOS[id](tempo || '') : id;
  return `<div class="vis-grp ${cls}" data-no="${id}" id="vis-x-${id}">`
       + `<span class="vis-grp-rot">${rot}</span>${dentro}</div>`;
}

// Card = bolinha de estado, ícone, nome, o selo de estado (o texto de
// `_visSetEstado`) e, à direita, o selo de etapas.
function _visNoHtml(id) {
  const m = _visMeta(id);
  const etapas = m.etapas === 2
    ? '<span class="vis-etapas" title="2 etapas: em partes, e depois a costura (só quando não cabe numa chamada)">2</span>'
    : '<span class="vis-etapas" title="1 etapa: roda de uma vez">1</span>';
  const dica = m.oQueFaz ? ` title="${m.nome} — ${m.oQueFaz}"` : '';
  return `<div class="vis-no" data-agente="${id}" data-no="${id}" id="vis-x-${id}"${dica}>`
       + `<span class="vis-dot"></span><span class="vis-no-ico">${m.icone}</span>`
       + `<span class="vis-no-txt"><span class="vis-no-nome">${m.nome}</span></span>`
       + `<span class="vis-no-badge">Parado</span>${etapas}</div>`;
}

const _visEl = id => document.getElementById('vis-x-' + id);

function _visTemVizinhoADireita(el) {
  for (let p = el; p && !p.classList.contains('vis-grp'); p = p.parentElement) {
    const lin = p.parentElement;
    if (lin && lin.classList.contains('vis-lin') && p.nextElementSibling) return true;
  }
  return false;
}

// ── As setas ─────────────────────────────────────────────────────────────────
// Medidas do DOM, no espaço sem zoom: o `zoom` do palco (ver `_visCaber`)
// muda o que o `getBoundingClientRect` devolve, e o SVG mora dentro dele (muda
// junto), então tudo é dividido por ele.
function _visDesenharSetas() {
  const desenho = document.getElementById('vis-desenho');
  if (!desenho) return;
  desenho.querySelector(':scope > svg')?.remove();
  if (!desenho.offsetParent) return;   // sub-aba escondida: mede ao aparecer
  const palco = document.getElementById('vis-palco');
  const z = (palco && parseFloat(palco.style.zoom)) || 1;
  const base = desenho.getBoundingClientRect();
  const medir = el => {
    const q = el.getBoundingClientRect();
    const l = (q.left - base.left) / z, t = (q.top - base.top) / z;
    const w = q.width / z, h = q.height / z;
    return { l, t, r: l + w, b: t + h, cx: l + w / 2, cy: t + h / 2 };
  };
  const r = id => medir(_visEl(id));
  const P = VIS_PONTA;
  const partes = [_visDefs()];
  // Várias setas pela mesma calha da esquerda andam lado a lado, não por cima.
  let calhas = 0;

  _visSetas.forEach(([de, para, jeito]) => {
    const A = _visEl(de), B = _visEl(para);
    if (!A || !B || !A.offsetParent || !B.offsetParent) return;
    const a = medir(A), b = medir(B);
    let d;
    if (jeito === 'desce') {
      const l = Math.max(a.l, b.l), rr = Math.min(a.r, b.r);
      if (rr - l > 30) { const x = (l + rr) / 2; d = `M${x},${a.b} V${b.t - P}`; }
      else { const m = (a.b + b.t) / 2; d = `M${a.cx},${a.b} V${m} H${b.cx} V${b.t - P}`; }
    } else if (jeito === 'calha-esquerda') {
      const g = A.closest('.vis-grp');
      const x = (g ? medir(g).l : a.l - 17) + 12 + 6 * calhas++;
      d = `M${a.l},${a.cy} H${x} V${b.cy} H${b.l - P}`;
    } else if (jeito === 'tronco-direita') {
      const gA = A.closest('.vis-grp'), gB = B.closest('.vis-grp');
      const y = a.t - 11;
      const x = Math.max(gA ? medir(gA).r : a.r, gB ? medir(gB).r : b.r) + 16;
      if (_visTemVizinhoADireita(B)) {
        // Entra por baixo: desce pelo tronco até abaixo da linha do card e sobe
        // até ele. ⚠️ O último trecho tem de ter comprimento: com `yb` igual ao
        // fim da seta ele era de zero, e a ponta herdava a direção do trecho
        // horizontal — apontava para o lado, não para o card.
        const yb = Math.max(...[...B.parentElement.children].map(c => medir(c).b)) + P + 12;
        d = `M${a.cx},${a.t} V${y} H${x} V${yb} H${b.cx} V${b.b + P}`;
      } else {
        d = `M${a.cx},${a.t} V${y} H${x} V${b.cy} H${b.r + P}`;
      }
    } else {
      const m = (a.r + b.l) / 2;
      d = Math.abs(a.cy - b.cy) < 2 ? `M${a.r},${a.cy} H${b.l - P}`
        : `M${a.r},${a.cy} H${m} V${b.cy} H${b.l - P}`;
    }
    partes.push(_visSeta(de, para, d));
  });

  desenho.insertAdjacentHTML('afterbegin',
    `<svg width="${base.width / z}" height="${base.height / z}">${partes.join('')}</svg>`);

  // As setas nascem de novo a cada `resize`: o que já estava aceso, apagado
  // (chave desligada) ou no caminho do mouse volta por cima.
  if (typeof _visMarcarDesligados === 'function') _visMarcarDesligados();
  const balde = typeof _visBalde === 'function' ? _visBalde() : null;
  if (balde) balde.acionou.forEach(id => _visIluminar(id));
  const eu = desenho.querySelector('.vis-no.eu');
  if (eu) _visFocar(eu);
}

function _visDefs() {
  const ponta = cls => `<path d="M0,0 L10,5 L0,10 z" class="${cls}"/>`;
  const m = (id, cls) => `<marker id="${id}" viewBox="0 0 10 10" refX="0" refY="5"`
    + ` markerWidth="${VIS_PONTA}" markerHeight="${VIS_PONTA}" markerUnits="userSpaceOnUse"`
    + ` orient="auto">${ponta(cls)}</marker>`;
  return `<defs>${m('vis-pt', 'vis-pt')}${m('vis-pt-lit', 'vis-pt-lit')}`
       + `${m('vis-pt-off', 'vis-pt-off')}</defs>`;
}

// Uma seta e a bolinha que a percorre. A bolinha nasce invisível e só aparece
// quando `_visDispararBola` a inicia — é o que torna visível qual etapa acionou
// qual, sem ficar piscando sozinha.
function _visSeta(de, para, d) {
  const pid = `vis-rota-${de}-${para}`;
  const mid = `vis-mov-${de}-${para}`;
  return `<path id="${pid}" class="vis-liga vis-seta" data-de="${de}" data-para="${para}"
                d="${d}" marker-end="url(#vis-pt)"/>
          <circle class="vis-bola" r="4.5" data-de="${de}">
            <animateMotion id="${mid}" begin="indefinite" dur="0.9s" fill="remove">
              <mpath href="#${pid}"/></animateMotion>
            <animate attributeName="opacity" from="1" to="0"
                     begin="${mid}.begin" dur="0.9s" fill="remove"/>
          </circle>`;
}

// ── Caber ────────────────────────────────────────────────────────────────────
// A tela inteira — desenho e painel — escala junto (`zoom` no palco), para
// caber na largura da sub-aba: encolhe até `VIS_ZOOM_MIN` numa janela estreita
// e cresce até `VIS_ZOOM_MAX` numa larga. Só abaixo do mínimo ela rola.
function _visCaber() {
  const palco = document.getElementById('vis-palco');
  const layout = palco && palco.parentElement;
  const desenho = document.getElementById('vis-desenho');
  if (!palco || !layout) return;
  palco.style.zoom = '';
  if (desenho) desenho.querySelector(':scope > svg')?.remove();   // o SVG não entra na medida
  if (!palco.offsetParent) return;
  const cs = getComputedStyle(layout);
  const livre = layout.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const natural = palco.scrollWidth;
  if (!natural || livre <= 0) return;
  const z = Math.min(VIS_ZOOM_MAX, Math.max(VIS_ZOOM_MIN, livre / natural));
  palco.style.zoom = z.toFixed(3);
}

function _visWireResize() {
  if (_visResizeWired) return;
  _visResizeWired = true;
  window.addEventListener('resize', () => {
    if (typeof _visSubAbaVisivel === 'function' && !_visSubAbaVisivel()) return;
    _visCaber(); _visDesenharSetas();
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { _visCaber(); _visDesenharSetas(); });
  }
}

// ── Passar o mouse: um passo para trás (azul) e um para a frente (amarelo) ──
// Um card herda as setas das caixas em que está: quem está no T2 espera o que
// o T2 espera — o freio, pela seta que chega na caixa.
function _visCaixasDe(el, desenho) {
  const ids = [];
  for (let p = el; p && p !== desenho; p = p.parentElement) {
    if (p.dataset && p.dataset.no) ids.push(p.dataset.no);
  }
  return ids;
}

function _visFocar(card) {
  const desenho = document.getElementById('vis-desenho');
  if (!desenho) return;
  _visLimparFoco();
  const meus = _visCaixasDe(card, desenho);
  desenho.classList.add('foco');
  card.classList.add('eu');
  desenho.querySelectorAll('.vis-seta').forEach(seta => {
    const de = seta.dataset.de, para = seta.dataset.para;
    if (meus.includes(para)) { _visEl(de)?.classList.add('antes');  seta.classList.add('caminho'); }
    if (meus.includes(de))   { _visEl(para)?.classList.add('depois'); seta.classList.add('caminho'); }
  });
}

function _visLimparFoco() {
  const desenho = document.getElementById('vis-desenho');
  if (!desenho) return;
  desenho.classList.remove('foco');
  desenho.querySelectorAll('.eu, .antes, .depois, .caminho')
    .forEach(e => e.classList.remove('eu', 'antes', 'depois', 'caminho'));
}

function _visWireFoco(desenho) {
  if (desenho._visFocoWired) return;
  desenho._visFocoWired = true;
  desenho.addEventListener('mouseover', e => {
    const n = e.target.closest('.vis-no');
    if (n && !n.classList.contains('eu')) _visFocar(n);
  });
  desenho.addEventListener('mouseleave', _visLimparFoco);
  desenho.addEventListener('mouseout', e => {
    if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('.vis-no')) _visLimparFoco();
  });
}
