// ══════════════════════════════════ Mapa em níveis · o que fica em volta do mapa
// Botões de nível, régua, trilha de migalhas, minimapa, linha de status,
// ⚙ Ajustes e o painel da direita com o que o bloco clicado é.

// A dica de cada nível mora no `title` do botão dele, e não num quadro fixo
// no canto do palco.
const MN_EXPLICA = {
  1: 'O programa inteiro em poucas partes, com a frase do que passa de uma para a outra. Role a rodinha sobre um cartão para descer nele; clique para ler e marcar as ligações; + abre só aquele.',
  2: 'Cada área mostra seus blocos: os grupos de arquivos que se chamam muito entre si, onde as cadeias começam. As setas entre blocos levam a frase do que passa de um para o outro.',
  3: 'Cada bloco mostra suas cadeias: um fluxo que começa num gatilho (clique, vigia, ponte tela→backend). Passe o mouse ou clique numa cadeia para ver com quem ela divide arquivos de apoio.',
  4: 'Dentro de cada cadeia, os arquivos em colunas por fase; as setas são as chamadas (azul = cruza tela ↔ backend). O número na seta é o passo.',
  5: 'Cada arquivo lista as funções que ele ⇠ atende e as que ⇢ chama. Clique para ler a frase de cada passo.',
};

// ── barra, régua, migalhas ───────────────────────────────────────────────────

function mnAtualizarBarra() {
  document.getElementById('mn-niveis').innerHTML = MN_NIVEIS.map((v, i) =>
    `<button class="mapa-toggle-btn${i + 1 === _mn.nivel ? ' active' : ''}" data-nivel="${i + 1}" title="${escapeHtml(MN_EXPLICA[i + 1])}"><b>${i + 1}</b>${v.nome}</button>`).join('');
  mnAtualizarMigalhas(); mnAtualizarRegua();
}

function mnAtualizarRegua() {
  const cfg = _mn.cfg, nivel = _mn.nivel;
  const r = _mn.visao.k / _mn.kBase;
  const pos = r >= 1 ? mnClamp(Math.log(r) / Math.log(cfg.passo), 0, 1) : -mnClamp(Math.log(1 / r) / Math.log(cfg.passo), 0, 1);
  const barra = pos >= 0 ? `left:50%;width:${pos * 50}%` : `left:${50 + pos * 50}%;width:${-pos * 50}%`;
  document.getElementById('mn-regua').innerHTML = `<div class="r-tit">Nível de detalhe</div>` +
    MN_NIVEIS.map((v, i) => `<div class="r-nivel${i + 1 === nivel ? ' ativo' : ''}" data-nivel="${i + 1}"><span class="bola">${i + 1}</span><div>${v.nome}<small>${v.sub}</small></div></div>`).join('') +
    `<div class="r-medidor">${_mn.zoomTrocaNivel ? `rodinha: ×${cfg.passo.toFixed(1)} desce · ÷${cfg.passo.toFixed(1)} sobe` : 'rodinha só aproxima'}<div class="r-barra"><i style="${barra}"></i><span class="meio"></span></div><div class="r-legenda"><span>${nivel > 1 ? '↑ nível ' + (nivel - 1) : ''}</span><span>${Math.round(_mn.visao.k * 100)}%</span><span>${nivel < MN_NIVEIS.length ? 'nível ' + (nivel + 1) + ' ↓' : ''}</span></div></div>`;
}

function mnAtualizarMigalhas() {
  const el = document.getElementById('mn-migalhas');
  if (_mn.raizAtual === _mn.arv.raiz) { el.style.display = 'none'; return; }
  const trilha = []; for (let p = _mn.raizAtual; p; p = p.pai) trilha.unshift(p);
  const nome = p => escapeHtml(p.id === 'P' ? 'Programa' : p.nome);
  el.style.display = 'flex';
  el.innerHTML = '⤒ ' + trilha.map((p, i) => i === trilha.length - 1 ? `<span class="atual">${nome(p)}</span>` : `<a data-ir="${escapeHtml(p.id)}">${nome(p)}</a>`).join('<span class="sep-m">›</span>');
  el.querySelectorAll('[data-ir]').forEach(a => a.onclick = () => mnEntrar(_mn.arv.porId.get(a.dataset.ir)));
}

// ── minimapa ─────────────────────────────────────────────────────────────────

const _mnMm = { escala: 1, ox: 0, oy: 0, pedido: false };

// Redesenhar o minimapa a cada evento da rodinha pesava: agora ele se
// redesenha no máximo uma vez por quadro.
function mnPedirMinimapa() {
  if (_mnMm.pedido) return;
  _mnMm.pedido = true;
  requestAnimationFrame(() => { _mnMm.pedido = false; mnDesenharMinimapa(); });
}

function mnDesenharMinimapa() {
  const caixa = document.getElementById('mn-minimapa');
  caixa.style.display = _mn.cfg.minimapa ? '' : 'none';
  if (!_mn.cfg.minimapa) return;
  const mm = _mn.el.mm, ctx = mm.getContext('2d'), W = mm.width, H = mm.height, n = _mn.raizAtual;
  _mnMm.escala = Math.min((W - 10) / n.w, (H - 10) / n.h); _mnMm.ox = (W - n.w * _mnMm.escala) / 2; _mnMm.oy = (H - n.h * _mnMm.escala) / 2;
  ctx.clearRect(0, 0, W, H);
  const r = b => [_mnMm.ox + b.x * _mnMm.escala, _mnMm.oy + b.y * _mnMm.escala, Math.max(1, b.w * _mnMm.escala), Math.max(1, b.h * _mnMm.escala)];
  (_mn.lista || []).forEach(b => {
    const eCaixa = b.aberto && b.tipo !== 'arquivo';
    ctx.globalAlpha = eCaixa ? .9 : .75;
    if (eCaixa) { ctx.strokeStyle = b.cor; ctx.lineWidth = 1; ctx.strokeRect(...r(b)); }
    else { ctx.fillStyle = b.tipo === 'arquivo' ? b.pai.cor : b.cor; ctx.fillRect(...r(b)); }
    if (b === _mn.selecionado) { ctx.globalAlpha = 1; ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2; ctx.strokeRect(...r(b)); }
  });
  const vp = _mn.el.viewport.getBoundingClientRect(), v = _mn.visao;
  const vis = { x: -v.x / v.k, y: -v.y / v.k, w: vp.width / v.k, h: vp.height / v.k };
  ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(...r(vis));
  ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(...r(vis));
  if (_mn.cfg.nomesMinimapa) mnNomesNoMinimapa(ctx, r);
  document.getElementById('mn-mm-zoom').textContent = `nível ${_mn.nivel}`;
}

// O nome dos cartões de primeiro plano (os filhos de quem está na raiz: as
// áreas, no Programa) em cima do minimapa. Pode poluir — por isso é um
// interruptor em ⚙ Ajustes. Nome que não cabe nem cortado não aparece.
function mnNomesNoMinimapa(ctx, r) {
  ctx.save();
  ctx.font = '600 9px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.fillStyle = '#f2f5f7';
  _mn.raizAtual.filhos.forEach(b => {
    if (!b.vis) return;
    const [x, y, w, h] = r(b);
    if (w < 18 || h < 8) return;
    let t = b.nome;
    while (t.length > 2 && ctx.measureText(t).width > w - 4) t = t.slice(0, -2) + '…';
    if (ctx.measureText(t).width > w - 2) return;
    const aberto = b.aberto && b.tipo !== 'arquivo';
    const ty = aberto ? y + Math.min(7, h / 2) : y + h / 2;
    ctx.strokeText(t, x + w / 2, ty); ctx.fillText(t, x + w / 2, ty);
  });
  ctx.restore();
}

function mnIrMinimapa(e) {
  const b = _mn.el.mm.getBoundingClientRect(), vp = _mn.el.viewport.getBoundingClientRect(), v = _mn.visao;
  const wx = (e.clientX - b.left - _mnMm.ox) / _mnMm.escala, wy = (e.clientY - b.top - _mnMm.oy) / _mnMm.escala;
  v.x = vp.width / 2 - wx * v.k; v.y = vp.height / 2 - wy * v.k; mnAplicarVisao();
}

// ── status ───────────────────────────────────────────────────────────────────

function mnAtualizarStatus() {
  const D = _mn.D, a = _mn.arv;
  document.getElementById('mn-titulo-sub').textContent =
    `${D.projeto} · ${D.resumo.passos} passos · ${D.resumo.cadeias} cadeias · gerado em ${D.resumo.gerado_em}`;
  document.getElementById('mn-metricas').innerHTML = [[a.areas.length, 'áreas'], [a.blocos.length, 'blocos'], [a.cadeias.length, 'cadeias'], [a.arquivos.length, 'arquivos'], [D.resumo.passos, 'passos']]
    .map(([v, r]) => `<div class="vp-metrica"><b>${v}</b>${r}</div>`).join('');
  // Sem «velho» e sem «Gerar níveis»: a rotina grava o pipeline.md e o
  // _niveis.json juntos, e quem gera é ela, em Automação (D58).
  const el = document.getElementById('mn-status');
  el.className = 'mn-status';
  el.innerHTML = `Níveis gerados pela rotina Pipeline, em Automação — em <b>${escapeHtml(D.resumo.gerado_em)}</b>.`;
}

// ── ⚙ ajustes ────────────────────────────────────────────────────────────────

// `fixas` e `forca` eram das Posições fixas e do Progressivo, que saíram em
// 26/09/2026; quem tinha os dois gravados perde a chave na primeira leitura.
const MN_CFG_PADRAO = { passo: 2.4, animacao: 'surgir', duracao: 550, folga: 24, minimapa: true, nomesMinimapa: true };

function mnLerCfg() {
  const cfg = { ...MN_CFG_PADRAO };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem('mapa-niveis-cfg') || '{}')); } catch (e) { /* sem storage: fica o padrão */ }
  // antes eram dois controles (descer e subir); o de descer vira o único
  if (cfg.desce) { cfg.passo = cfg.desce; delete cfg.desce; delete cfg.sobe; }
  delete cfg.fixas; delete cfg.forca;
  if (!MN_ANIMACOES[cfg.animacao]) cfg.animacao = MN_CFG_PADRAO.animacao;
  return cfg;
}
function mnSalvarCfg() { try { localStorage.setItem('mapa-niveis-cfg', JSON.stringify(_mn.cfg)); } catch (e) { /* idem */ } }

// O que é de gosto do mapa mora aqui; o que é de DESEMPENHO (o esboço, o que
// some durante o gesto, a janela do DOM) mora em Configurações › Desempenho
// dos mapas — regra «Valor ajustável mora em Configurações».
function mnDesenharAjustes() {
  const cfg = _mn.cfg, aj = document.getElementById('mn-ajustes');
  const pill = (id, ligado, texto, dica) => `<label class="toggle-pill" id="${id}"${dica ? ` title="${dica}"` : ''}><div class="toggle-track${ligado ? ' on' : ''}"><div class="toggle-knob"></div></div><span class="toggle-label${ligado ? ' on' : ''}">${texto}</span></label>`;
  aj.innerHTML = `<h4>⚙ Ajustes do mapa</h4>
    <div class="campo"><label>Zoom para trocar de nível <b>×${cfg.passo.toFixed(1)}</b></label><input type="range" id="mn-aj-passo" min="1.3" max="5" step="0.1" value="${cfg.passo}"><small>Quanto aproximar para descer um nível — e o mesmo tanto afastado para subir. Maior = troca mais tarde.</small></div>
    <div class="campo"><label>Animação ao trocar de nível</label><div class="opcoes">${Object.entries(MN_ANIMACOES).map(([k, a]) => `<button class="btn btn-xs btn-muted${cfg.animacao === k ? ' ligado' : ''}" data-anim="${k}">${a.nome}<small>${a.dica}</small></button>`).join('')}</div></div>
    <div class="campo"><label>Duração da animação <b>${cfg.duracao} ms</b></label><input type="range" id="mn-aj-duracao" min="150" max="1500" step="50" value="${cfg.duracao}"><small>Devagar ajuda a ver de onde cada bloco saiu.</small></div>
    <div class="campo"><label>Folga entre cartões <b>${cfg.folga}px</b></label><input type="range" id="mn-aj-folga" min="8" max="60" step="2" value="${cfg.folga}"><small>O espaço mínimo. Entre áreas ligadas, e entre blocos ligados, soma-se a largura da frase da seta, para ela nunca ficar por baixo de um cartão.</small></div>
    <div class="mn-aj-pills">
      ${pill('mn-aj-minimapa', cfg.minimapa, 'Minimapa')}
      ${pill('mn-aj-nomes-mm', cfg.nomesMinimapa, 'Nomes no minimapa', 'Escreve no minimapa o nome dos cartões principais (as áreas, no Programa)')}
    </div>
    <small class="mn-aj-nota">Travando? O desenho leve durante o movimento se regula em <b>Configurações › Desempenho dos mapas</b>.</small>
    <div class="rodape-aj"><button class="btn btn-xs btn-muted" id="mn-aj-padrao">Voltar ao padrão</button><button class="btn btn-xs btn-muted" id="mn-aj-fechar">Fechar</button></div>`;
  const rotulo = (id, texto) => { const b = aj.querySelector('#' + id)?.closest('.campo').querySelector('label b'); if (b) b.textContent = texto; };
  aj.querySelector('#mn-aj-passo').oninput = e => { cfg.passo = +e.target.value; rotulo('mn-aj-passo', `×${cfg.passo.toFixed(1)}`); mnMudouCfg(false); };
  aj.querySelector('#mn-aj-duracao').oninput = e => { cfg.duracao = +e.target.value; rotulo('mn-aj-duracao', `${cfg.duracao} ms`); mnMudouCfg(false); };
  aj.querySelector('#mn-aj-folga').oninput = e => { cfg.folga = +e.target.value; rotulo('mn-aj-folga', `${cfg.folga}px`); mnMudouCfg(true); };
  aj.querySelectorAll('[data-anim]').forEach(b => b.onclick = () => {
    cfg.animacao = b.dataset.anim;
    mnMudouCfg(false);
    mnDesenharAjustes();
  });
  aj.querySelector('#mn-aj-minimapa').onclick = e => { e.preventDefault(); cfg.minimapa = !cfg.minimapa; mnMudouCfg(false); mnDesenharAjustes(); };
  aj.querySelector('#mn-aj-nomes-mm').onclick = e => { e.preventDefault(); cfg.nomesMinimapa = !cfg.nomesMinimapa; mnMudouCfg(false); mnDesenharAjustes(); };
  aj.querySelector('#mn-aj-padrao').onclick = () => { _mn.cfg = { ...MN_CFG_PADRAO }; mnMudouCfg(true, true); mnDesenharAjustes(); };
  aj.querySelector('#mn-aj-fechar').onclick = () => aj.classList.remove('visivel');
}

// relayout: o layout mudou (a folga); reenquadrar: mudou tanto que o zoom de
// antes não quer dizer mais a mesma coisa.
function mnMudouCfg(relayout, reenquadrar = false) {
  mnSalvarCfg();
  if (reenquadrar && relayout) {
    _mn.nivel = 1; _mn.override.clear(); _mn.raizAtual = _mn.arv.raiz;
    mnDesenhar(); mnEnquadrar();
  } else if (relayout) { mnDesenhar(); mnAplicarVisao(); }
  else { mnAtualizarRegua(); mnDesenharMinimapa(); }
}

// ── painel da direita ────────────────────────────────────────────────────────

function mnCaminhoDe(n) { const t = []; for (let p = n.pai; p && p.id !== 'P'; p = p.pai) t.unshift(p.nome); return t.join(' › '); }

function mnItem(n, extra = '') {
  const icone = n.tipo === 'cadeia' && n.dados.icone ? n.dados.icone + ' ' : '';
  return `<div class="item" data-ir="${escapeHtml(n.id)}"><b>${icone}${escapeHtml(n.nome)}</b>${extra}${n.descricao ? `<div class="d">${escapeHtml(n.descricao)}</div>` : ''}</div>`;
}

// De onde vem o texto do cartão (F71). Nada aqui é escrito pela tela.
function mnOrigemDoTexto(n) {
  if (n.tipo === 'arquivo') return n.dados.descricao_da_documentacao ? 'Síntese da Documentação Técnica' : 'frase por molde · o arquivo ainda não tem Síntese na Documentação Técnica';
  if (n.semEntrada) return 'texto fixo do programa';
  return { area: 'resumo da área', bloco: 'resumo do bloco', cadeia: 'resumo da cadeia' }[n.tipo] + ' · rotina Pipeline';
}

function mnSelecionar(n) {
  if (!n || n.tipo === 'programa') return mnFecharPainel();
  _mn.selecionado = n;
  _mn.el.raiz.classList.add('com-painel');
  const setas = _mn.arv.setas;
  const icone = n.tipo === 'cadeia' && n.dados.icone ? n.dados.icone + ' ' : '';
  // no painel, o arquivo mostra a Síntese inteira; no cartão, só a primeira frase
  const texto = n.tipo === 'arquivo' && n.dados.sintese ? n.dados.sintese : mnTextoDesc(n);
  let h = `<span class="p-tipo" style="--cor:${n.cor}">${MN_TIPO_NOME[n.tipo]} · nível ${n.prof}</span><h2>${icone}${escapeHtml(n.nome)}</h2><div class="p-caminho">${escapeHtml(mnCaminhoDe(n) || _mn.D.projeto)}</div>`;
  h += `<div class="p-gerado"><div class="t">✦ ${mnOrigemDoTexto(n)}</div>${escapeHtml(texto)}</div>`;
  const podeAbrir = n !== _mn.raizAtual && (n.tipo !== 'arquivo' || n.dados.funcoes.length);
  h += `<div class="p-botoes">${podeAbrir ? `<button class="btn btn-xs btn-muted" id="mn-p-alternar">${n.aberto ? '− Fechar' : '+ Abrir só este'}</button>` : ''}${n.tipo !== 'arquivo' ? `<button class="btn btn-xs btn-muted" id="mn-p-entrar" title="Mostra só este cartão, com uma trilha para voltar">⤓ Entrar</button>` : ''}<button class="btn btn-xs btn-muted" id="mn-p-centralizar">◎ Centralizar</button></div>`;
  mnHubsSobDemanda(n);
  const ligadas = setas.filter(s => s.desenhavel && (mnDentroDe(s.de, n) || mnDentroDe(s.para, n)));
  h += `<div class="nota">${ligadas.length ? `${ligadas.length} ligaç${ligadas.length > 1 ? 'ões marcadas' : 'ão marcada'} no mapa · clique no vazio para desmarcar` : 'nenhuma ligação à vista neste nível'}</div>`;
  // as ligações com frase (entre áreas ou entre blocos) que saem ou chegam em n
  const conversa = (tipo, titulo) => {
    const fl = setas.filter(s => s.tipo === tipo && (s.de === n || s.para === n));
    if (fl.length) h += `<h3>${titulo}</h3>` + fl.map(s => { const o = s.de === n ? s.para : s.de; return `<div class="fluxo-a" data-ir="${o.id}">${s.de === n ? '→' : '←'} <b>${escapeHtml(o.nome)}</b> <i>${escapeHtml(s.rotulo)}</i></div>`; }).join('');
  };
  if (n.tipo === 'area') {
    h += `<div class="kv" style="margin-top:8px"><span>blocos</span><span>${n.nBlocos}</span><span>cadeias</span><span>${n.nCad}</span><span>arquivos</span><span>${n.nArq}</span><span>passos</span><span>${n.nPassos}</span></div>`;
    h += `<h3>Blocos desta área (nível 2)</h3>` + n.filhos.map(b => mnItem(b, ` <span class="d">${b.id} · ${b.nCad} cadeia${b.nCad === 1 ? '' : 's'}</span>`)).join('');
    conversa('area', 'Como conversa com as outras áreas');
  }
  if (n.tipo === 'bloco') {
    h += `<div class="kv" style="margin-top:8px"><span>cadeias</span><span>${n.nCad}</span><span>arquivos do bloco</span><span>${n.dados.arquivos.length}</span><span>passos</span><span>${n.nPassos}</span></div>`;
    h += `<h3>Cadeias deste bloco (nível 3)</h3>` + n.filhos.map(c => mnItem(c, ` <span class="d">${c.id} · ${c.dados.passos.length} passos</span>`)).join('');
    conversa('bloco', 'Como conversa com os outros blocos');
    if (n.dados.arquivos.length) h += `<h3>Arquivos do bloco</h3>` + n.dados.arquivos.map(a => `<div class="passo">${escapeHtml(mnBase(a))} <span class="d">${escapeHtml(mnPastaCurta(a))}</span></div>`).join('');
  }
  if (n.tipo === 'cadeia') {
    const c = n.dados;
    h += `<div class="kv" style="margin-top:8px"><span>gatilho</span><span>${c.icone || ''} ${escapeHtml(c.gatilho || '—')}</span><span>começa em</span><span>${escapeHtml(mnBase(c.comeca_em || '—'))}</span></div>`;
    const hubs = setas.filter(s => s.tipo === 'hub' && (s.de === n || s.para === n));
    if (hubs.length) h += `<h3>Divide arquivos de apoio com</h3>` + hubs.map(s => { const o = s.de === n ? s.para : s.de; return `<div class="fluxo-a" data-ir="${o.id}"><b>${escapeHtml(o.nome)}</b> <i>${s.comuns.map(mnBase).join(', ')}</i></div>`; }).join('');
    h += `<h3>Arquivos (nível 4)</h3>` + n.filhos.map(f => mnItem(f, ` <span class="d">fase ${f.fase}</span>`)).join('');
    h += `<h3>Passos, na ordem</h3>`;
    let fase = null;
    c.passos.forEach(p => {
      if (p.fase !== fase) { fase = p.fase; h += `<div class="fase-t">fase ${fase}</div>`; }
      h += `<div class="passo"><span class="n">${p.n}</span>${escapeHtml(mnBase(p.de))} → ${escapeHtml(mnBase(p.para))} · <code>${escapeHtml(p.via)}</code>${p.descricao ? `<div class="d">${escapeHtml(p.descricao)}</div>` : ''}</div>`;
    });
  }
  if (n.tipo === 'arquivo') {
    h += `<div class="kv" style="margin-top:8px"><span>caminho</span><span>${escapeHtml(n.dados.arquivo.replace(/^Program\/Code\//, ''))}</span><span>fase</span><span>${n.fase}</span><span>cadeia</span><span>${escapeHtml(n.pai.id)} · ${escapeHtml(n.pai.nome)}</span></div>`;
    h += `<h3>Funções (nível 5)</h3>` + n.dados.funcoes.map(f => `<div class="passo"><span class="n">${f.n}</span>${f.dir === 'recebe' ? '<span style="color:var(--mint)">⇠ atende</span>' : '<span style="color:var(--amber)">⇢ chama</span>'} <code>${escapeHtml(f.nome)}</code> ${f.dir === 'recebe' ? 'de' : 'em'} ${escapeHtml(mnBase(f.outro))}${f.descricao ? `<div class="d">${escapeHtml(f.descricao)}</div>` : ''}</div>`).join('');
    h += `<div class="nota">A frase de cada função é a frase do passo, escrita pela rotina Pipeline; a frase do arquivo é a Síntese da Documentação Técnica.</div>`;
  }
  const painel = document.getElementById('mn-painel-conteudo');
  painel.innerHTML = h;
  painel.querySelectorAll('[data-ir]').forEach(el => el.onclick = () => mnIrPara(_mn.arv.porId.get(el.dataset.ir)));
  document.getElementById('mn-p-alternar')?.addEventListener('click', () => { mnAlternar(n); mnSelecionar(n); });
  document.getElementById('mn-p-entrar')?.addEventListener('click', () => mnEntrar(n));
  document.getElementById('mn-p-centralizar').onclick = () => mnCentralizar(n);
  mnAplicarDestaques(); mnAtualizarRegua(); mnDesenharMinimapa();
}

function mnFecharPainel() {
  _mn.selecionado = null;
  _mn.el.raiz.classList.remove('com-painel');
  document.getElementById('mn-painel-conteudo').innerHTML = '';
  mnAplicarDestaques(); mnDesenharMinimapa();
}

function mnIrPara(n) {
  for (let p = n.pai; p && p !== _mn.arv.raiz; p = p.pai) if (!p.aberto) _mn.override.set(p.id, true);
  if (!mnDentroDe(n, _mn.raizAtual)) _mn.raizAtual = _mn.arv.raiz;
  mnDesenhar(); mnCentralizar(n); mnSelecionar(n);
}

function mnEntrar(n) {
  _mn.raizAtual = n || _mn.arv.raiz; _mn.override.clear();
  _mn.nivel = Math.max(_mn.nivel, Math.min(MN_NIVEIS.length, (_mn.raizAtual.prof || 0) + 1));
  mnDesenhar(); mnEnquadrar();
  _mn.el.camera.animate([{ opacity: .2 }, { opacity: 1 }], { duration: 250 });
  if (_mn.selecionado && !mnDentroDe(_mn.selecionado, _mn.raizAtual)) mnFecharPainel();
}
