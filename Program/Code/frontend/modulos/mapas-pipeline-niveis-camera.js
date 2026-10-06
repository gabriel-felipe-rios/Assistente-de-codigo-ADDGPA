// ══════════════════════════════════ Mapa em níveis · câmera e troca de nível
// A câmera é um translate + scale no #mn-mundo. Passou do limite de zoom, o
// mapa é redesenhado no nível de baixo (ou de cima) e uma transição mostra de
// onde cada bloco saiu. A transição existe para mostrar o que abriu, não para
// enfeitar, e gira sempre em torno do CENTRO do bloco que abriu.
//
// Havia um quinto tipo, o "Progressivo" (a transição andava com a rodinha em
// vez do relógio), e as "Posições fixas" em ⚙ Ajustes. Os dois saíram em
// 26/09/2026, a pedido: «tá ruim, pode remover».

const MN_ANIMACOES = {
  surgir:   { nome: 'Surgir do cartão', dica: 'os filhos crescem do centro do cartão que abriu' },
  mergulho: { nome: 'Mergulho',        dica: 'a cena velha passa por você e a nova chega, pelo centro do cartão' },
  esmaecer: { nome: 'Esmaecer',        dica: 'só troca, com um fade' },
  nenhuma:  { nome: 'Nenhuma',         dica: 'troca seca' },
};

// ── visão ────────────────────────────────────────────────────────────────────

// Cada mudança de câmera passa por aqui. Com muitos cartões na tela (e no
// gesto, ou afastado) vale o esboço, e o #mn-mundo nem é mexido — mexer nele
// é o que obrigava o navegador a repintar milhares de cartões por quadro. Com
// o DOM valendo, o transform vai já, e a janela de elementos acompanha: na
// hora com o mapa parado (a transição de nível precisa dos elementos no mesmo
// instante), uma vez por quadro durante o gesto.
function mnAplicarVisao() {
  const v = _mn.visao;
  mnFundoAcompanha();
  mnAtualizarRegua(); mnPedirMinimapa();
  const esboco = mnUsarEsboco();
  mnLigarEsboco(esboco);
  if (esboco) { mnPedirEsboco(); return; }
  _mn.el.mundo.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.k})`;
  if (_mnMov.ativo) mnPedirSincronizarDom(); else mnSincronizarDom();
}

// O fundo de pontos anda e cresce com o mapa. O passo da grade dobra ou cai
// pela metade para ficar sempre entre 11 e 44 px na tela: longe, os pontos não
// viram uma mancha; perto, não somem.
function mnFundoAcompanha() {
  const v = _mn.visao;
  let passo = 22 * v.k;
  while (passo < 11) passo *= 2;
  while (passo > 44) passo /= 2;
  const vp = _mn.el.viewport.style;
  vp.backgroundSize = `${passo}px ${passo}px`;
  vp.backgroundPosition = `${v.x}px ${v.y}px`;
}

function mnEnquadrar() {
  const vp = _mn.el.viewport.getBoundingClientRect(), n = _mn.raizAtual;
  // o minimapa e a régua ocupam a coluna da esquerda: o enquadramento desconta a largura dela
  const esq = (document.getElementById('mn-coluna')?.offsetWidth || 0) + 24, dir = 30;
  const k = mnClamp(Math.min((vp.width - esq - dir) / n.w, (vp.height - 70) / n.h), .004, 1.3);
  _mn.visao = { k, x: esq + (vp.width - esq - dir - n.w * k) / 2, y: Math.max(30, (vp.height - n.h * k) / 2) };
  _mn.kBase = k;
  mnAplicarVisao();
}

function mnTela(r) { const v = _mn.visao; return { x: v.x + r.x * v.k, y: v.y + r.y * v.k, w: r.w * v.k, h: r.h * v.k }; }

function mnCentralizar(n) {
  const vp = _mn.el.viewport.getBoundingClientRect(), v = _mn.visao;
  if (n.w * v.k > vp.width * .9 || n.h * v.k > vp.height * .85) {
    v.k = mnClamp(Math.min(vp.width * .85 / n.w, vp.height * .8 / n.h), .004, 1.3); _mn.kBase = v.k;
  }
  v.x = vp.width / 2 - (n.x + n.w / 2) * v.k; v.y = vp.height / 2 - (n.y + n.h / 2) * v.k; mnAplicarVisao();
}

// Zoom com o ponto `tela` parado. Os limites acompanham o kBase: sem isso, um
// nível aberto já perto do zoom máximo nunca chegava ao limite de descer, e a
// rodinha "parava" até alguém religar o botão de zoom.
function mnZoomEm(tela, fator) {
  const v = _mn.visao, passo = _mn.cfg.passo;
  const kMin = Math.min(.04, _mn.kBase / passo * .9), kMax = Math.max(3, _mn.kBase * passo * 1.1);
  const k2 = mnClamp(v.k * fator, kMin, kMax);
  if (_mn.zoomTrocaNivel) {
    if (k2 > _mn.kBase * passo && _mn.nivel < MN_NIVEIS.length) return mnTrocarNivel(_mn.nivel + 1, tela);
    if (k2 < _mn.kBase / passo && _mn.nivel > 1) return mnTrocarNivel(_mn.nivel - 1, tela);
  }
  v.x = tela.x - (tela.x - v.x) * (k2 / v.k); v.y = tela.y - (tela.y - v.y) * (k2 / v.k); v.k = k2;
  mnAplicarVisao();
}

// ── troca de nível ───────────────────────────────────────────────────────────

// Tira a foto do antes (onde cada bloco estava na TELA e o elemento dele),
// aplica a mudança, reposiciona a câmera com o CENTRO do bloco-âncora parado
// no mesmo ponto da tela e anima conforme o tipo escolhido em ⚙ Ajustes.
function mnTransicao(ancora, fazer, escala, sentido) {
  const antes = new Map();
  (_mn.lista || []).forEach(n => antes.set(n.id, { ...mnTela(n), el: n.el }));
  const camAntes = { ..._mn.visao };
  // Com o esboço na tela o #mn-mundo está parado numa câmera velha: a cópia
  // dele não serve de "cena de antes".
  const cenaVelha = _mn.cfg.animacao === 'mergulho' && !_mn.esbocoLigado ? _mn.el.mundo.cloneNode(true) : null;
  const ancestrais = []; for (let p = ancora; p; p = p.pai) ancestrais.push(p);
  const mundoAntes = new Map(ancestrais.map(p => [p, { x: p.x, y: p.y, w: p.w, h: p.h }]));
  fazer();
  mnDesenhar();
  // quem da cadeia da âncora continua na tela é quem fica parado
  const alvo = ancestrais.find(p => p === _mn.raizAtual || p.vis) || _mn.raizAtual;
  const rAntes = mundoAntes.get(alvo) || alvo;
  const centroTela = { x: camAntes.x + (rAntes.x + rAntes.w / 2) * camAntes.k, y: camAntes.y + (rAntes.y + rAntes.h / 2) * camAntes.k };
  const v = _mn.visao;
  if (escala) v.k = mnClamp(escala(rAntes.w * camAntes.k, alvo), .004, 2.2);
  v.x = centroTela.x - (alvo.x + alvo.w / 2) * v.k; v.y = centroTela.y - (alvo.y + alvo.h / 2) * v.k;
  mnAplicarVisao();
  mnAnimar(antes, camAntes, cenaVelha, centroTela, sentido);
  return alvo;
}

function mnAnimar(antes, camAntes, cenaVelha, centro, sentido) {
  const cfg = _mn.cfg, el = _mn.el;
  let tipo = cfg.animacao;
  // O esboço não anima: ele se repinta inteiro a cada quadro de qualquer jeito.
  if (_mn.esbocoLigado) tipo = 'nenhuma';
  else if (tipo === 'mergulho' && !cenaVelha) tipo = 'esmaecer';
  const dur = cfg.duracao, ease = 'cubic-bezier(.2,.7,.2,1)';
  el.fantasmas.innerHTML = ''; clearTimeout(mnAnimar.limpeza);
  _mn.travadoAte = performance.now() + (tipo === 'nenhuma' ? 120 : dur);
  // os fantasmas saem por relógio também: aba escondida não termina animação, e o onfinish nunca viria
  mnAnimar.limpeza = setTimeout(() => { el.fantasmas.innerHTML = ''; el.fantasmaCena.innerHTML = ''; }, dur + 80);
  if (tipo === 'nenhuma') return;
  if (tipo === 'esmaecer') { el.camera.animate([{ opacity: .15 }, { opacity: 1 }], { duration: dur, easing: 'ease-out' }); return; }
  if (tipo === 'mergulho') {
    // a cena velha (cópia) cresce/encolhe a partir do CENTRO do bloco e some; a nova vem do lado oposto
    const f = el.fantasmaCena; f.innerHTML = ''; f.appendChild(cenaVelha);
    const origem = `${centro.x}px ${centro.y}px`, fora = sentido >= 0 ? 2.4 : .42, dentro = sentido >= 0 ? .42 : 2.4;
    f.style.transformOrigin = origem; el.camera.style.transformOrigin = origem;
    f.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: `scale(${fora})`, opacity: 0 }], { duration: dur, easing: ease }).onfinish = () => f.innerHTML = '';
    el.camera.animate([{ transform: `scale(${dentro})`, opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: dur, easing: ease });
    return;
  }
  // SURGIR: tudo gira em torno do CENTRO. O bloco que já existia vai do
  // centro antigo para o novo; o que é novo nasce pequeno no centro do
  // ancestral que já estava na tela e cresce até o lugar dele; o que sumiu
  // encolhe para o centro do bloco que ficou. Só anima quem tem elemento —
  // quem está fora da janela do DOM não aparece mesmo.
  const k = _mn.visao.k, v = _mn.visao;
  const paraMundo = r => ({ x: (r.x - v.x) / k, y: (r.y - v.y) / k, w: r.w / k, h: r.h / k });
  const agora = _mn.lista.filter(n => n.el);
  const idsAgora = new Set(_mn.lista.map(n => n.id));
  const opcoes = { duration: dur, easing: ease };
  agora.forEach(n => {
    let anc = n; while (anc && !antes.has(anc.id)) anc = anc.pai;
    if (!anc) return;
    const o = paraMundo(antes.get(anc.id));
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;                // centro do ancestral, antes
    const s = anc === n ? Math.min(o.w / n.w, o.h / n.h) : Math.min(.3, o.w / n.w * .5);
    const inicio = `translate(${cx - (n.x + n.w / 2)}px,${cy - (n.y + n.h / 2)}px) scale(${s})`;
    n.el.style.transformOrigin = '50% 50%';
    n.el.animate([{ transform: inicio, opacity: anc === n ? 1 : 0 }, { transform: 'none', opacity: 1 }], opcoes);
  });
  antes.forEach((r, id) => {
    if (idsAgora.has(id) || !r.el) return;
    const n = _mn.arv.porId.get(id); let alvo = n.pai; while (alvo && !idsAgora.has(alvo.id)) alvo = alvo.pai;
    if (!alvo) return;
    const o = paraMundo(r);
    const fantasma = r.el; fantasma.classList.remove('selecionado');
    const s0 = camAntes.k / k;                                  // o conteúdo foi desenhado na escala antiga
    const w = r.w / camAntes.k, h = r.h / camAntes.k;
    // o fantasma é desenhado no tamanho antigo e escalado por s0: o canto
    // dele tem de cair no canto antigo, e o centro no centro antigo
    fantasma.style.left = (o.x + o.w / 2 - w / 2) + 'px'; fantasma.style.top = (o.y + o.h / 2 - h / 2) + 'px';
    fantasma.style.width = w + 'px'; fantasma.style.height = h + 'px';
    fantasma.style.transformOrigin = '50% 50%';
    el.fantasmas.appendChild(fantasma);
    const dx = (alvo.x + alvo.w / 2) - (o.x + o.w / 2), dy = (alvo.y + alvo.h / 2) - (o.y + o.h / 2);
    const a = fantasma.animate([{ transform: `scale(${s0})`, opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(${s0 * .15})`, opacity: 0 }], { duration: dur, easing: ease, fill: 'both' });
    a.onfinish = () => fantasma.remove();
  });
  document.getElementById('mn-setas').animate([{ opacity: 0 }, { opacity: 0, offset: .55 }, { opacity: 1 }], opcoes);
}

function mnBlocoEm(mx, my) {
  const r = _mn.el.viewport.getBoundingClientRect();
  const alvo = document.elementFromPoint(r.left + mx, r.top + my)?.closest('#mn-camada-caixas [data-id], #mn-camada-cartoes [data-id]');
  if (alvo) return _mn.arv.porId.get(alvo.dataset.id);
  const v = _mn.visao, wx = (mx - v.x) / v.k, wy = (my - v.y) / v.k;
  let melhor = null, dist = Infinity;
  _mn.lista.forEach(n => {
    if (n.aberto && n.tipo !== 'arquivo') return;
    const dx = Math.max(n.x - wx, 0, wx - n.x - n.w), dy = Math.max(n.y - wy, 0, wy - n.y - n.h), d = Math.hypot(dx, dy);
    if (d < dist) { dist = d; melhor = n; }
  });
  return melhor;
}

function mnTrocarNivel(novo, mouse) {
  novo = mnClamp(novo, 1, MN_NIVEIS.length); if (novo === _mn.nivel) return;
  const vp = _mn.el.viewport.getBoundingClientRect();
  mouse = mouse || { x: vp.width / 2, y: vp.height / 2 };
  let ancora = mnBlocoEm(mouse.x, mouse.y) || _mn.raizAtual.filhos[0] || _mn.raizAtual;
  if (novo > _mn.nivel) while (ancora.pai && ancora.prof > _mn.nivel) ancora = ancora.pai;
  const subindo = novo < _mn.nivel;
  const escala = (larguraTelaAntes, alvo) => subindo
    ? Math.min(larguraTelaAntes / 1.8, vp.width * .5) / alvo.w
    : Math.min(larguraTelaAntes * 1.4, vp.width * .9, alvo.w * 1.5) / alvo.w;
  mnTransicao(ancora, () => { _mn.nivel = novo; _mn.override.clear(); }, escala, subindo ? -1 : 1);
  _mn.kBase = _mn.visao.k;
}

function mnAlternar(n) {
  if (n === _mn.raizAtual) return;
  const vaiAbrir = !n.aberto;
  mnTransicao(n, () => {
    _mn.override.set(n.id, vaiAbrir);
    if (!vaiAbrir) n.filhos.forEach(function limpar(c) { _mn.override.delete(c.id); c.filhos.forEach(limpar); });
  }, null, vaiAbrir ? 1 : -1);
}
