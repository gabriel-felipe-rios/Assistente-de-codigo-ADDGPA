// ═══ TRABALHOS → sub-aba Fluxo ═════════════════════════════════════════════
//
// A ordem e a dependência entre as ATIVIDADES do Quadro, em diagrama.
//
// ⚠️ ESTA TELA PLANEJA, NÃO OBSERVA. Ela não desenha telemetria ao vivo — não
// mostra qual terminal chamou qual, nem quem está falando com quem agora. O que
// ela desenha é o que foi combinado: quais atividades existem, qual espera qual,
// e em que estado cada uma está. "Quanto tempo cada terminal passou
// trabalhando" é a Linha do tempo, que é outra pergunta e outra tela.
//
// ⚠️ NÃO CONFUNDIR COM AS LIGAÇÕES DA OFICINA. Lá o grafo é entre NÓS do canvas
// e diz o que trava e o que passa dado; aqui é entre ATIVIDADES e diz o que
// precisa acontecer antes do quê. São dois desenhos diferentes de propósito.
//
// ⚠️ LAYOUT DETERMINÍSTICO, NUNCA `d3.forceSimulation`. O projeto já teve força
// na tela Mapas → Ligações e a removeu de propósito: simulação é
// não-determinística, e quebra a garantia de que o mesmo projeto desenha igual
// duas vezes seguidas. A posição de cada cartão sai de uma regra — profundidade
// de dependência na horizontal, ordem fixa na vertical — e as duas vêm
// calculadas do backend, que é onde a semântica do grafo mora. Trocar isto por
// força é mudança de arquitetura, não de gosto: pergunte antes.
//
// ⚠️ AQUI O ZOOM É TRANSFORM DE SVG, e por isso `vector-effect:
// non-scaling-stroke` FUNCIONA — ao contrário da Oficina, onde quem amplia é
// uma CSS transform num ancestral HTML e o traço precisa ser dividido à mão.
// Duas telas, duas soluções, e a diferença não é descuido.

let flxDados = null;
let flxNumero = null;      // null = "Agora" (o Quadro vivo)
let flxTransform = null;
let flxZoomFn = null;
let flxAjustando = false;

// Medidas do desenho, em unidades do MUNDO. Ficam aqui e não no CSS porque a
// posição de cada cartão é calculada em JS — o CSS não teria como saber onde
// pôr um `<rect>`.
const FLX_CARTAO_W = 196;
const FLX_CARTAO_H = 64;
const FLX_VAO_COLUNA = 98;
const FLX_VAO_LINHA = 26;
const FLX_MARGEM = 28;

// Quantos caracteres cabem numa linha do título, na largura do cartão. É
// aproximação por contagem, e é de propósito: medir texto em SVG exige
// `getComputedTextLength` por cartão a cada desenho, e o resultado seria o
// mesmo — a fonte é fixa e a caixa também.
const FLX_CHARS_POR_LINHA = 26;
const FLX_LINHAS_DO_TITULO = 2;

// ── Montagem ────────────────────────────────────────────────────────────────

async function initTrabalhosFluxo() {
  const painel = document.getElementById('trsub-fluxo');
  if (!painel || !currentProject) return;
  await flxCarregar();
}

async function flxCarregar() {
  const painel = document.getElementById('trsub-fluxo');
  const r = await window.pywebview.api.carregar_fluxo(currentProject, flxNumero);
  if (!r || !r.success) {
    painel.innerHTML = `<div class="screen-body"><div class="tr-erro">${escapeHtml((r && r.error) || 'erro')}</div></div>`;
    return;
  }
  flxDados = r;
  painel.innerHTML = flxMarcacao(r);
  flxLigarEventos();
  flxDesenhar();
}

function flxMarcacao(r) {
  const legenda = (r.colunas || []).map(c =>
    `<span class="tr-legenda-i"><i class="ofi-bolinha tr-st-${escapeHtml(c.cor)}"></i>${escapeHtml(c.rotulo)}</span>`
  ).join('');

  return `
    <div class="screen-body flx-corpo">
      <div class="tr-cabecalho">
        <div>
          <h2>Fluxo</h2>
          <div class="tr-sub">A ordem entre as atividades — o que precisa acontecer antes do quê</div>
        </div>
        <div class="tr-cab-botoes">
          <button class="btn btn-muted btn-sm" id="flx-enquadrar"
                  title="Faz o desenho inteiro caber na tela (ou clique com o botão do meio)">⤢ Enquadrar</button>
        </div>
      </div>
      <div class="tr-legenda">${legenda}</div>
      ${flxAvisoDeCiclo(r.grafo)}
      <div class="flx-palco">
        <div class="flx-lateral">
          <div class="flx-lateral-t">Execuções</div>
          ${flxLateral(r)}
          <p class="tr-nota flx-lateral-nota">
            Uma entrada por sessão do <b>Orquestrador</b>. Ela abre quando ele começa a
            trabalhar e fecha no <b>Parar tudo</b>, que é quando o programa sabe que a
            sessão acabou — e é aí que a foto do Quadro daquele fluxo é guardada.
          </p>
        </div>
        <div class="flx-tela" id="flx-tela">
          ${r.grafo.atividades.length ? '<svg class="flx-svg" id="flx-svg"><g id="flx-mundo"></g></svg>' : flxVazio()}
        </div>
      </div>
    </div>`;
}

function flxVazio() {
  return `
    <div class="ph-why"><span class="ph-why-tag">Nada ainda</span><br>
      Nenhuma atividade neste Quadro. Crie uma na sub-aba <b>Quadro</b> — quando o
      Orquestrador registrar que uma espera pela outra, a corrente aparece aqui.</div>`;
}

// O ciclo é avisado em texto, e não só no desenho: duas setas que se apontam
// no meio de um diagrama grande passam despercebidas, e o efeito prático (as
// duas atividades esperando uma pela outra para sempre) não tem sintoma nenhum.
function flxAvisoDeCiclo(grafo) {
  if (!grafo.ciclo || !grafo.ciclo.length) return '';
  return `
    <div class="flx-ciclo">
      <span class="flx-ciclo-i" aria-hidden="true">⚠</span>
      <span class="flx-ciclo-t">
        <b>Estas atividades esperam umas pelas outras em círculo:</b>
        ${escapeHtml(grafo.ciclo.join(' · '))}.
        Nenhuma delas pode começar enquanto o círculo existir — desfaça uma das
        dependências no Quadro.
      </span>
    </div>`;
}

function flxLateral(r) {
  const agora = `
    <button class="flx-exec${r.numero === null ? ' ativa' : ''}" data-exec="">
      <b>Agora</b>
      <span>o Quadro como está neste momento</span>
    </button>`;

  const itens = (r.execucoes || []).map(e => `
    <button class="flx-exec${r.numero === e.numero ? ' ativa' : ''}" data-exec="${e.numero}">
      <b>${escapeHtml(e.rotulo)}${e.aberta ? ' <i class="flx-aberta">em curso</i>' : ''}</b>
      <span>${escapeHtml(flxData(e.aberto_em))}${e.terminal ? ' · ' + escapeHtml(e.terminal) : ''}</span>
    </button>`).join('');

  return `<div class="flx-execs">${agora}${itens}</div>`;
}

function flxData(iso) {
  if (!iso) return '';
  // Sem `toLocaleString`: ele muda com a máquina, e a mesma tela passaria a
  // mostrar formatos diferentes conforme a configuração regional do usuário.
  const [d, h] = String(iso).split('T');
  const [a, m, dia] = (d || '').split('-');
  return `${dia}/${m}/${a}${h ? ' ' + h.slice(0, 5) : ''}`;
}

// ── Eventos ─────────────────────────────────────────────────────────────────

function flxLigarEventos() {
  document.querySelectorAll('#trsub-fluxo [data-exec]').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.exec;
      flxNumero = v === '' ? null : Number(v);
      // Trocar de execução muda o desenho inteiro de tamanho — guardar o
      // enquadramento antigo jogaria o novo para fora da tela. É a mesma razão
      // pela qual Mapas → Ligações reenquadra ao trocar de modo.
      flxTransform = null;
      flxCarregar();
    });
  });
  const btn = document.getElementById('flx-enquadrar');
  if (btn) btn.addEventListener('click', () => { flxTransform = null; flxDesenhar(); });
}

// ── O desenho ───────────────────────────────────────────────────────────────

function flxPosicoes(atividades) {
  // Profundidade e ordem vêm do backend — aqui elas só viram pixel. A conta é
  // uma multiplicação, e é isso que garante o desenho igual duas vezes.
  const pos = {};
  atividades.forEach(a => {
    pos[a.id] = {
      x: FLX_MARGEM + a.profundidade * (FLX_CARTAO_W + FLX_VAO_COLUNA),
      y: FLX_MARGEM + a.ordem * (FLX_CARTAO_H + FLX_VAO_LINHA),
    };
  });
  return pos;
}

function flxCaixa(atividades, pos) {
  const xs = atividades.map(a => pos[a.id].x);
  const ys = atividades.map(a => pos[a.id].y);
  return {
    x: 0, y: 0,
    w: Math.max(...xs) + FLX_CARTAO_W + FLX_MARGEM,
    h: Math.max(...ys) + FLX_CARTAO_H + FLX_MARGEM,
  };
}

function flxDesenhar() {
  const svg = document.getElementById('flx-svg');
  const mundo = document.getElementById('flx-mundo');
  const tela = document.getElementById('flx-tela');
  if (!svg || !mundo || !flxDados || !flxDados.grafo.atividades.length) return;

  const atividades = flxDados.grafo.atividades;
  const pos = flxPosicoes(atividades);
  mundo.innerHTML = flxPecas(atividades, pos);

  if (!flxTransform) flxTransform = flxEnquadrar(tela, flxCaixa(atividades, pos));
  flxPosicionar(flxTransform);

  flxZoomFn = d3.zoom().scaleExtent([0.15, 4])
    .on('zoom', ev => {
      flxTransform = ev.transform;
      if (flxAjustando) return;
      flxPosicionar(ev.transform);
    });

  const alvo = d3.select(svg);
  alvo.call(flxZoomFn).on('dblclick.zoom', null);
  // Botão do meio reenquadra — o mesmo gesto de Mapas → Ligações, para quem já
  // conhece um não ter de aprender outro.
  alvo.on('mousedown.reenquadrar', ev => {
    if (ev.button !== 1) return;
    ev.preventDefault();
    flxTransform = flxEnquadrar(tela, flxCaixa(atividades, pos));
    flxPosicionar(flxTransform);
    flxSincronizar(alvo);
  });
  alvo.on('auxclick.reenquadrar', ev => { if (ev.button === 1) ev.preventDefault(); });
  flxSincronizar(alvo);
}

function flxPosicionar(t) {
  const mundo = document.getElementById('flx-mundo');
  if (mundo) mundo.setAttribute('transform', `translate(${t.x},${t.y}) scale(${t.k})`);
}

// Diz ao d3 qual é a transform atual sem disparar um repintar redundante.
function flxSincronizar(alvo) {
  flxAjustando = true;
  alvo.call(flxZoomFn.transform, flxTransform);
  flxAjustando = false;
}

// "Centralizar" num desenho maior que a tela significa ENQUADRAR: voltar a
// `zoomIdentity` mostraria o canto superior esquerdo, não o desenho. E nunca
// amplia além de 100% — um Quadro de dois cartões não deve nascer gigante.
function flxEnquadrar(tela, caixa) {
  const cw = (tela && tela.clientWidth) || 800;
  const ch = (tela && tela.clientHeight) || 500;
  const k = Math.min(1, Math.min(cw / caixa.w, ch / caixa.h));
  return d3.zoomIdentity
    .translate((cw - caixa.w * k) / 2, (ch - caixa.h * k) / 2)
    .scale(k);
}

function flxPecas(atividades, pos) {
  const por_id = {};
  atividades.forEach(a => { por_id[a.id] = a; });

  // As setas vêm primeiro no DOM: na mesma pilha, quem vem depois pinta por
  // cima, e a linha tem de passar por baixo do cartão, não sobre o texto dele.
  const setas = [];
  atividades.forEach(a => {
    (a.depende_de || []).forEach(d => {
      if (!por_id[d]) return;
      setas.push(flxSeta(pos[d], pos[a.id], a.espera.includes(d)));
    });
  });

  const cartoes = atividades.map(a => flxCartao(a, pos[a.id]));
  return setas.join('') + cartoes.join('');
}

// De quem é esperado para quem espera. A curva sai pela direita da origem e
// entra pela esquerda do destino, que é o que faz a leitura ser "da esquerda
// para a direita, na ordem em que as coisas acontecem".
function flxSeta(de, para, pendente) {
  const x1 = de.x + FLX_CARTAO_W, y1 = de.y + FLX_CARTAO_H / 2;
  const x2 = para.x, y2 = para.y + FLX_CARTAO_H / 2;
  const curva = Math.max(24, Math.min(70, Math.abs(x2 - x1) / 2));
  const classe = pendente ? 'flx-seta flx-seta-pendente' : 'flx-seta flx-seta-cumprida';
  // A ponta é geometria e escala junto com o desenho, como as caixas; o TRAÇO
  // é que fica preso a 1 px de tela, pelo `non-scaling-stroke` do CSS.
  const t = 9, ab = 0.42, ang = 0;
  const p = g => `${x2 - t * Math.cos(ang + g)},${y2 - t * Math.sin(ang + g)}`;
  return `
    <path class="${classe}" d="M${x1},${y1} C${x1 + curva},${y1} ${x2 - curva},${y2} ${x2},${y2}"/>
    <polygon class="${classe.replace('flx-seta', 'flx-ponta')}"
             points="${x2},${y2} ${p(ab)} ${p(-ab)}"/>`;
}

function flxCartao(a, p) {
  const linhas = flxQuebrar(a.titulo).map((linha, i) =>
    `<tspan x="${p.x + 12}" dy="${i === 0 ? 0 : 14}">${escapeHtml(linha)}</tspan>`).join('');

  const tarefas = a.tarefas
    ? `<text class="flx-meta" x="${p.x + FLX_CARTAO_W - 12}" y="${p.y + FLX_CARTAO_H - 10}"
             text-anchor="end">${a.tarefas_feitas}/${a.tarefas} tarefas</text>`
    : '';
  // Uma atividade que ainda espera alguém ganha contorno tracejado — é a
  // informação que esta tela existe para dar, e ela não caberia numa sétima
  // cor de bolinha sem brigar com a legenda única das colunas.
  const espera = a.espera.length ? ' esperando' : '';
  const ciclo = a.em_ciclo ? ' em-ciclo' : '';
  const dica = a.espera.length
    ? `${a.id} — ${a.titulo}. Espera: ${a.espera.join(', ')}.`
    : `${a.id} — ${a.titulo}. ${a.rotulo_da_coluna}.`;

  return `
    <g class="flx-cartao${espera}${ciclo}" transform="translate(0,0)">
      <title>${escapeHtml(dica)}</title>
      <rect class="flx-caixa flx-cor-${escapeHtml(a.cor)}"
            x="${p.x}" y="${p.y}" width="${FLX_CARTAO_W}" height="${FLX_CARTAO_H}" rx="6"/>
      <circle class="flx-bolinha flx-bg-${escapeHtml(a.cor)}"
              cx="${p.x + 14}" cy="${p.y + 15}" r="4"/>
      <text class="flx-id" x="${p.x + 26}" y="${p.y + 19}">${escapeHtml(a.id)}</text>
      <text class="flx-titulo" x="${p.x + 12}" y="${p.y + 38}">${linhas}</text>
      ${tarefas}
    </g>`;
}

// Quebra em palavras, no máximo duas linhas. O que não couber é CORTADO SECO —
// nunca com reticências: nome pela metade com "…" ocupa espaço, chama atenção e
// não informa mais que o corte. O nome inteiro fica na dica do cartão.
function flxQuebrar(texto) {
  const palavras = String(texto || '').split(/\s+/).filter(Boolean);
  const linhas = [''];
  palavras.forEach(w => {
    const atual = linhas[linhas.length - 1];
    const junto = atual ? atual + ' ' + w : w;
    if (junto.length <= FLX_CHARS_POR_LINHA) { linhas[linhas.length - 1] = junto; return; }
    if (linhas.length < FLX_LINHAS_DO_TITULO) { linhas.push(w.slice(0, FLX_CHARS_POR_LINHA)); return; }
    // Já está na última linha: completa o que couber e para.
    const sobra = FLX_CHARS_POR_LINHA - atual.length - 1;
    if (sobra > 1) linhas[linhas.length - 1] = atual + ' ' + w.slice(0, sobra);
  });
  return linhas.filter(l => l.length);
}
