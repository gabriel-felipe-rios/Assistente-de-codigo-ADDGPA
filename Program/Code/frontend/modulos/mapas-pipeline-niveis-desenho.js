// ══════════════════════════════════ Mapa em níveis · medir e desenhar
// Quem está aberto, o tamanho de cada bloco, o HTML dos cartões e das caixas,
// as setas e o realce da seleção. Lê e escreve o estado em `_mn`.

const _mnCacheAltura = new Map();
function mnAlturaTexto(texto, largura, classe) {
  const chave = classe + '|' + largura + '|' + texto;
  if (!_mnCacheAltura.has(chave)) {
    const m = _mn.el.medidor;
    m.className = classe; m.style.width = largura + 'px'; m.textContent = texto || '';
    _mnCacheAltura.set(chave, m.offsetHeight);
  }
  return _mnCacheAltura.get(chave);
}

// ── layout ───────────────────────────────────────────────────────────────────

function mnAberto(n) {
  if (n === _mn.raizAtual) return true;
  if (n.tipo === 'arquivo' && !n.dados.funcoes.length) return false;
  if (n.tipo !== 'arquivo' && !n.filhos.length) return false;
  if (_mn.override.has(n.id)) return _mn.override.get(n.id);
  return n.prof < _mn.nivel;
}

function mnMedir(n) {
  n.aberto = mnAberto(n);
  if (n.tipo === 'arquivo') {
    if (n.aberto) {
      const nf = n.dados.funcoes.length, linhas = Math.min(nf, MN_FN_MAX) + (nf > MN_FN_MAX ? 1 : 0);
      n.w = MN_LARGURA.arquivoAberto; n.h = 30 + 14 + 4 + linhas * MN_FN_H + 10;
    } else { n.w = MN_LARGURA.arquivo; n.h = 30 + 14 + 3 + mnAlturaTexto(mnTextoDesc(n), n.w - 24, 'txt-arquivo') + 10; }
    return;
  }
  if (!n.aberto) {
    n.w = MN_LARGURA[n.tipo];
    n.h = 30 + 5 + mnAlturaTexto(mnTextoDesc(n), n.w - 24, 'txt-' + n.tipo) + 8 + 22;
    return;
  }
  n.filhos.forEach(mnMedir);
  let conteudo;
  if (n.tipo === 'programa' || n.tipo === 'area') {
    // programa → áreas e área → blocos: grade em que quem conversa fica
    // vizinho, com espaço para a frase da seta entre os dois
    const tipoSeta = n.tipo === 'programa' ? 'area' : 'bloco';
    if (!_mn.planos.has(n.id)) _mn.planos.set(n.id, mnPlanejarGrade(n.filhos, _mn.arv.setas, tipoSeta));
    conteudo = mnLayoutGrade(n, _mn.planos.get(n.id), _mn.arv.setas, tipoSeta, _mn.cfg.folga);
  } else if (n.tipo === 'cadeia') conteudo = mnLayoutFases(n, _mn.cfg.folga);
  else conteudo = mnLayoutPrateleiras(n.filhos, _mn.cfg.folga);   // bloco → cadeias
  if (n.tipo === 'programa') { n.cab = 0; n.w = conteudo.w; n.h = conteudo.h; return; }
  n.w = Math.max(conteudo.w + MN_PAD * 2, 320);
  n.cab = 30 + 6 + mnAlturaTexto(mnTextoDesc(n), n.w - 24, 'txt-caixa') + 8;
  const dx = (n.w - MN_PAD * 2 - conteudo.w) / 2;
  n.filhos.forEach(c => { c.rx += MN_PAD + dx; c.ry += n.cab + MN_PAD; });
  (n.rotulos || []).forEach(r => { r.x += MN_PAD + dx; r.y += n.cab + MN_PAD; });
  n.h = n.cab + MN_PAD * 2 + conteudo.h;
}

function mnPosicionar(n, x, y) {
  n.x = x; n.y = y;
  if (n.aberto && n.tipo !== 'arquivo') n.filhos.forEach(c => mnPosicionar(c, x + c.rx, y + c.ry));
}

function mnVisiveis() {
  const out = [];
  const ir = n => { out.push(n); if (n.aberto && n.tipo !== 'arquivo') n.filhos.forEach(ir); };
  ir(_mn.raizAtual); return out;
}

// O bloco que representa n na tela agora: o ancestral fechado mais alto.
function mnRep(n) {
  if (!mnDentroDe(n, _mn.raizAtual)) return null;
  const cadeia = []; for (let p = n; p && p !== _mn.raizAtual; p = p.pai) cadeia.unshift(p);
  for (const p of cadeia) if (!p.aberto || p.tipo === 'arquivo') return p;
  return n;
}

// ── HTML dos blocos ──────────────────────────────────────────────────────────

// Sem descrição quer dizer que a rotina Pipeline ainda não escreveu este
// texto: o cartão diz isso, em vez de ficar com um buraco que parece erro.
function mnTextoDesc(n) { return n.descricao || 'Sem descrição: a rotina Pipeline ainda não escreveu este texto.'; }
function mnDescHtml(n, classe) {
  return n.descricao ? `<div class="${classe}">${escapeHtml(n.descricao)}</div>`
                     : `<div class="${classe}"><i>${escapeHtml(mnTextoDesc(n))}</i></div>`;
}

function mnRodape(n) {
  const conta = (q, um, varios) => `${q} ${q === 1 ? um : varios}`;
  if (n.tipo === 'area') return `${conta(n.nBlocos, 'bloco', 'blocos')} · ${conta(n.nCad, 'cadeia', 'cadeias')} · ${conta(n.nPassos, 'passo', 'passos')}`;
  if (n.tipo === 'bloco') return `${conta(n.nCad, 'cadeia', 'cadeias')} · ${conta(n.nArq, 'arquivo', 'arquivos')} · ${conta(n.nPassos, 'passo', 'passos')}`;
  if (n.tipo === 'cadeia') return `${n.dados.passos.length} passos · ${n.filhos.length} arquivos${n.dados.gatilho ? ' · ' + escapeHtml(n.dados.gatilho) : ''}`;
  return '';
}

function mnBotaoAbrir(n) {
  if (n === _mn.raizAtual || (n.tipo === 'arquivo' && !n.dados.funcoes.length) || (n.tipo !== 'arquivo' && !n.filhos.length)) return '';
  return `<button class="c-abrir" title="${n.aberto ? 'Fechar' : 'Abrir só este'}">${n.aberto ? '−' : '+'}</button>`;
}

function mnTituloBloco(n) {
  const id = n.tipo === 'cadeia' || n.tipo === 'bloco' ? `<span class="c-id">${n.id}</span>` : '';
  const icone = n.tipo === 'cadeia' && n.dados.icone ? n.dados.icone + ' ' : '';
  return `<span class="c-tipo">${MN_TIPO_NOME[n.tipo]}</span>${id}<span class="c-nome">${icone}${escapeHtml(n.nome)}</span>`;
}

function mnHtmlCartao(n) {
  if (n.tipo === 'arquivo') {
    const cab = `<div class="c-topo"><span class="ext">${mnExt(n.dados.arquivo).toUpperCase()}</span><span class="c-nome" title="${escapeHtml(n.dados.arquivo)}">${escapeHtml(n.nome)}</span>${mnBotaoAbrir(n)}</div><div class="c-pasta">${escapeHtml(mnPastaCurta(n.dados.arquivo))}</div>`;
    if (!n.aberto) return cab + `<div class="c-desc">${mnDescHtml(n, 'txt-arquivo')}</div>`;
    const fns = n.dados.funcoes.slice(0, MN_FN_MAX).map(f => `<div class="fn ${f.dir}" title="${escapeHtml(f.descricao)}"><span class="seta-fn">${f.dir === 'recebe' ? '⇠' : '⇢'}</span><code>${escapeHtml(f.nome)}</code> <span class="fn-outro">${f.dir === 'recebe' ? 'de' : '→'} ${escapeHtml(mnBase(f.outro))}</span></div>`).join('');
    const mais = n.dados.funcoes.length > MN_FN_MAX ? `<div class="fn mais">+${n.dados.funcoes.length - MN_FN_MAX} funções</div>` : '';
    return cab + `<div class="funcoes">${fns}${mais}</div>`;
  }
  return `<div class="faixa"></div><div class="c-topo">${mnTituloBloco(n)}${mnBotaoAbrir(n)}</div><div class="c-desc">${mnDescHtml(n, 'txt-' + n.tipo)}</div><div class="c-rodape">${mnRodape(n)}</div>`;
}

function mnHtmlCaixa(n) {
  const rot = (n.rotulos || []).map(r => `<span class="rot-fase" style="left:${r.x}px;top:${r.y}px">${escapeHtml(r.texto)}</span>`).join('');
  return `<div class="cx-cab">${mnTituloBloco(n)}<span class="c-id">${mnRodape(n)}</span>${mnBotaoAbrir(n)}</div><div class="cx-desc">${mnDescHtml(n, 'txt-caixa')}</div>${rot}`;
}

// ⚠️ AQUI NÃO SE CRIA ELEMENTO NENHUM. mnDesenhar só mede, posiciona e monta
// `_mn.lista` (o que está aberto na árvore, em pré-ordem); quem põe no DOM é
// `mnSincronizarDom` (mapas-pipeline-niveis-esboco.js), e só o que cabe na
// janela da tela. Criar todos era 18 mil elementos no nível Arquivos, meio
// segundo a cada troca de nível e ~310 ms a cada quadro de arrasto.
function mnDesenhar() {
  const el = _mn.el;
  mnMedir(_mn.raizAtual); mnPosicionar(_mn.raizAtual, 0, 0);
  el.caixas.innerHTML = ''; el.cartoes.innerHTML = '';
  _mn.arv.porId.forEach(n => { n.el = null; n.vis = false; });
  const visiveis = mnVisiveis();
  visiveis.forEach(n => n.vis = true);
  _mn.lista = visiveis.filter(n => n.tipo !== 'programa');
  mnDesenharSetas(); mnAplicarDestaques(); mnAtualizarBarra(); mnDesenharMinimapa();
}

function mnCriarElemento(n) {
  const caixa = n.aberto && n.tipo !== 'arquivo';
  const div = document.createElement('div');
  div.className = (caixa ? 'caixa' : 'cartao') + ' t-' + n.tipo;
  div.dataset.id = n.id;
  div.style.cssText = `left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;--cor:${n.cor}`;
  div.innerHTML = caixa ? mnHtmlCaixa(n) : mnHtmlCartao(n);
  n.el = div; (caixa ? _mn.el.caixas : _mn.el.cartoes).appendChild(div);
}

// ── setas ────────────────────────────────────────────────────────────────────

const MN_NS = 'http://www.w3.org/2000/svg';

// ⚠️ A seta de hub que só aparece em foco NÃO é preparada aqui: no nível
// Cadeias eram 3 541 setas (≈ 14 mil elementos) para 114 à vista, e passar o
// mouse numa caixa acendia centenas de uma vez. Ela nasce em
// `mnHubsSobDemanda`, só para a cadeia em foco.
//
// Preparar ≠ pôr no DOM: aqui se calcula a curva, o lugar da frase e a caixa
// que a seta ocupa, e `s.desenhavel` diz que ela existe neste desenho. Quem
// cria o <path> é `mnSincronizarDom`, e só para a seta que passa pela tela; o
// esboço pinta a partir dos mesmos números.
function mnDesenharSetas() {
  ['mn-g-area', 'mn-g-bloco', 'mn-g-hub', 'mn-g-chamada', 'mn-g-rotulos'].forEach(id => document.getElementById(id).innerHTML = '');
  const setas = _mn.arv.setas;
  setas.forEach(s => { s.el = null; s.elRot = null; s.desenhavel = false; s.sobDemanda = false; s.semLugar = false; s.path2d = null; });
  _mn.hubsAcesos = []; _mn.hubsDe = null;
  const ocupado = mnObstaculos();
  setas.forEach(s => {
    const a = mnRep(s.de), b = mnRep(s.para);
    if (!a || !b || a === b || a !== s.de || b !== s.para) return;   // cada tipo só com as duas pontas à vista
    // hub em comum: só no foco, salvo entre cadeias do mesmo bloco no nível 3 (Cadeias)
    s.soNoFoco = s.tipo === 'hub' && !_mn.mostrarHubs && !(s.mesmoBloco && _mn.nivel === 3);
    if (s.soNoFoco) { s.sobDemanda = true; return; }
    mnPrepararSeta(s, ocupado);
  });
}

// Onde a frase de uma seta não pode ficar: os cartões fechados e o cabeçalho
// das caixas abertas.
function mnObstaculos() {
  const out = [];
  _mn.lista.forEach(n => {
    if (n.aberto && n.tipo !== 'arquivo') out.push({ x: n.x, y: n.y, w: n.w, h: n.cab || 30 });
    else out.push({ x: n.x, y: n.y, w: n.w, h: n.h });
  });
  return out;
}

function mnHubsSobDemanda(foco) {
  const cadeia = foco && foco.tipo === 'cadeia' ? foco : null;
  if (cadeia === _mn.hubsDe) return;
  _mn.hubsAcesos.forEach(s => { mnRemoverSetaDom(s); s.desenhavel = false; });
  _mn.hubsAcesos = []; _mn.hubsDe = cadeia;
  if (!cadeia) return;
  _mn.arv.setas.forEach(s => {
    if (s.sobDemanda && (s.de === cadeia || s.para === cadeia)) { mnPrepararSeta(s, null); _mn.hubsAcesos.push(s); }
  });
}

function mnPrepararSeta(s, ocupado) {
  const a = s.de, b = s.para;
  const curva = mnCurva(a, b, s.reverso ? 10 : 0), meio = curva.meio;
  const algumAberto = a.aberto || b.aberto;
  s.comFrase = s.tipo === 'area' || s.tipo === 'bloco';   // as duas que levam a frase da rotina
  s.fraca = s.comFrase && algumAberto;
  s.curva = curva; s.path2d = null; s.rot = null; s.desenhavel = true;
  if (s.comFrase) {
    if (!algumAberto) {
      const w = mnLarguraRotulo(s.rotulo);
      const lugar = mnLugarDoRotulo(curva, w, 20, ocupado || []);
      s.semLugar = !lugar.livre;
      s.rot = { x: lugar.x, y: lugar.y, w };
    }
  } else if (s.tipo === 'chamada') {
    const ns = s.passos.map(p => p.n).sort((x, y) => x - y), t = ns.length > 3 ? ns[0] + '…' + ns[ns.length - 1] : ns.join(',');
    s.rot = { x: meio[0], y: meio[1], t, r: Math.max(8, 4 + t.length * 2.6) };
  } else s.rot = { x: meio[0], y: meio[1], t: String(s.comuns.length) };
  // a caixa que a seta ocupa: a curva inteira (os pontos de controle a
  // contêm) e a frase, com folga para a ponta e a espessura
  const xs = curva.pts.map(p => p[0]), ys = curva.pts.map(p => p[1]);
  if (s.rot) { const m = (s.rot.w || 24) / 2; xs.push(s.rot.x - m, s.rot.x + m); ys.push(s.rot.y - 12, s.rot.y + 12); }
  const x0 = Math.min(...xs) - 12, y0 = Math.min(...ys) - 12;
  s.caixa = { x: x0, y: y0, w: Math.max(...xs) + 12 - x0, h: Math.max(...ys) + 12 - y0 };
}

function mnCriarSetaDom(s) {
  const p = document.createElementNS(MN_NS, 'path');
  p.setAttribute('d', s.curva.d);
  p.setAttribute('class', 's-' + s.tipo + (s.ponte ? ' ponte' : '') + (s.fraca ? ' fraca' : ''));
  if (s.tipo === 'chamada') p.setAttribute('marker-end', s.ponte ? 'url(#mn-m-ponte)' : 'url(#mn-m-chamada)');
  if (s.comFrase) p.setAttribute('marker-end', `url(#mn-m-${s.tipo})`);
  document.getElementById('mn-g-' + s.tipo).appendChild(p); s.el = p;
  if (!s.rot) return;
  const g = document.createElementNS(MN_NS, 'g'), r = s.rot;
  if (s.comFrase) {
    g.setAttribute('class', 'rot-' + s.tipo);
    g.innerHTML = `<rect x="${r.x - r.w / 2}" y="${r.y - 10}" width="${r.w}" height="20" rx="10"/><text x="${r.x}" y="${r.y}">${escapeHtml(s.rotulo)}</text>`;
  } else if (s.tipo === 'chamada') {
    g.setAttribute('class', 'rot-n' + (s.ponte ? ' ponte' : ''));
    g.innerHTML = `<circle cx="${r.x}" cy="${r.y}" r="${r.r}"/><text x="${r.x}" y="${r.y}">${r.t}</text>`;
  } else {
    g.setAttribute('class', 'rot-hub');
    g.innerHTML = `<rect x="${r.x - 11}" y="${r.y - 9}" width="22" height="18" rx="9"/><text x="${r.x}" y="${r.y}">${r.t}</text>`;
  }
  document.getElementById('mn-g-rotulos').appendChild(g); s.elRot = g;
}

function mnRemoverSetaDom(s) {
  s.el?.remove(); s.elRot?.remove(); s.el = null; s.elRot = null;
}

// Clicar MARCA: as ligações do bloco ficam acesas e o resto apaga até outro
// clique. Passar o mouse só pré-visualiza, e só quando nada está marcado.
// O estado fica no nó e na seta (`dSel`, `realce`…): o elemento pode nem
// existir ainda, e o esboço lê os mesmos campos.
function mnAplicarDestaques() {
  if (!_mn.lista) return;
  const sel = _mn.selecionado, foco = sel || _mn.hover;
  mnHubsSobDemanda(foco);
  const ligadas = new Set(), pontas = new Set();
  if (foco) _mn.arv.setas.forEach(s => {
    if (!s.desenhavel) return;
    if (mnDentroDe(s.de, foco) || mnDentroDe(s.para, foco)) { ligadas.add(s); pontas.add(mnRep(s.de)); pontas.add(mnRep(s.para)); }
  });
  _mn.arv.setas.forEach(s => {
    if (!s.desenhavel) return;
    s.mostrar = !s.soNoFoco || ligadas.has(s);
    s.mostrarRot = s.mostrar && (!s.semLugar || ligadas.has(s));
    s.realce = !!foco && ligadas.has(s);
    s.apagada = !!sel && !ligadas.has(s);
    mnPintarDestaqueSeta(s);
  });
  const listaPontas = [...pontas];
  _mn.lista.forEach(n => {
    const relacionado = !sel || mnDentroDe(n, sel) || mnDentroDe(sel, n) || pontas.has(n) || listaPontas.some(p => p && mnDentroDe(p, n));
    n.dSel = n === sel;
    n.dLig = !!sel && pontas.has(n) && n !== sel;
    n.dApag = !relacionado;
    mnPintarDestaqueNo(n);
  });
  mnMovimentoMudou();
  mnSincronizar();
}

function mnPintarDestaqueNo(n) {
  if (!n.el) return;
  n.el.classList.toggle('selecionado', !!n.dSel);
  n.el.classList.toggle('ligado', !!n.dLig);
  n.el.classList.toggle('apagado', !!n.dApag);
}

function mnPintarDestaqueSeta(s) {
  if (!s.el) return;
  s.el.style.display = s.mostrar ? '' : 'none';
  s.el.classList.toggle('realce', !!s.realce);
  s.el.classList.toggle('apagada', !!s.apagada);
  if (s.elRot) {
    s.elRot.style.display = s.mostrarRot ? '' : 'none';
    s.elRot.style.opacity = s.apagada ? .12 : '';
  }
}
