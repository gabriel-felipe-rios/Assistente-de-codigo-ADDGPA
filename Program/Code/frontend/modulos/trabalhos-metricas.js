// ═══ TRABALHOS → Linha do tempo e Métricas ═════════════════════════════════
//
// As duas leem a MESMA fonte (o estado por terminal que o backend guarda) e
// respondem perguntas diferentes: a Linha do tempo é "o que cada um fez, e
// quando"; as Métricas são "quanto custou".
//
// ⚠️ UMA RAIA POR TERMINAL na Linha do tempo — não por atividade, não por
// pedaço. A raia usa o PAPEL quando o nó tem um (Orquestrador, Subagente N) e
// o nome livre quando não tem, que é a mesma regra da barra das Métricas.
//
// ⚠️ A LEGENDA DE STATUS É ÚNICA e vem do backend, de `catalogo_trabalhos.py`:
// as mesmas seis cores valem aqui, na Oficina e (quando existir) no Fluxo.
// Redeclarar as cores neste arquivo é como duas telas passam a discordar sobre
// o que é "aguardando".
//
// ⚠️ AS DUAS BARRAS DE COTA NÃO SÃO CALCULADAS AQUI. Quantos tokens o produto
// cobrou é informação DELE, lida do próprio CLI. Enquanto o programa não
// souber ler isso do produto configurado, a seção diz que não sabe — em vez de
// mostrar um número inventado, que é o pior resultado possível numa tela cuja
// única razão de existir é dizer quanto custou.

let tmpMontada = false;
let mtrMontada = false;

// ── Linha do tempo ──────────────────────────────────────────────────────────

async function initTrabalhosTempo() {
  const painel = document.getElementById('trsub-tempo');
  if (!painel || !currentProject) return;
  const r = await window.pywebview.api.carregar_metricas(currentProject);
  if (!r || !r.success) {
    painel.innerHTML = `<div class="screen-body"><div class="tr-erro">${escapeHtml((r && r.error) || 'erro')}</div></div>`;
    return;
  }
  tmpMontada = true;
  painel.innerHTML = `<div class="screen-body">${tmpMarcacao(r)}</div>`;
}

function tmpMarcacao(r) {
  const legenda = r.legenda.map(e =>
    `<span class="tr-legenda-i"><i class="ofi-bolinha tr-st-${escapeHtml(e.id)}"></i>${escapeHtml(e.rotulo)}</span>`
  ).join('');

  if (!r.terminais.length) {
    return `
      <div class="tr-cabecalho"><div><h2>Linha do tempo</h2>
        <div class="tr-sub">Uma raia por terminal</div></div></div>
      <div class="tr-legenda">${legenda}</div>
      <div class="ph-why"><span class="ph-why-tag">Nada ainda</span><br>
        Nenhum terminal trabalhou neste projeto. Abra um na <b>Oficina</b> e mande a
        primeira mensagem — a raia dele aparece aqui.</div>`;
  }

  // A escala é do terminal que rodou mais tempo. Escala fixa faria a raia de
  // uma sessão curta virar um risco invisível.
  const maior = Math.max(1, ...r.terminais.map(t => t.segundos));
  const raias = r.terminais.map(t => {
    const largura = Math.max(2, (t.segundos / maior) * 100);
    return `
      <div class="tmp-raia">
        <div class="tmp-rotulo">
          <span class="ofi-bolinha tr-st-${escapeHtml(t.estado)}"></span>
          ${escapeHtml(t.rotulo)}
        </div>
        <div class="tmp-trilho">
          <div class="tmp-barra tmp-barra-${escapeHtml(t.estado)}" style="width:${largura}%"></div>
        </div>
        <div class="tmp-numero">${tmpDuracao(t.segundos)} · ${t.chamadas} chamada(s)</div>
      </div>`;
  }).join('');

  return `
    <div class="tr-cabecalho"><div><h2>Linha do tempo</h2>
      <div class="tr-sub">Uma raia por terminal — quanto tempo cada um passou trabalhando</div></div></div>
    <div class="tr-legenda">${legenda}</div>
    <div class="tmp-raias">${raias}</div>`;
}

function tmpDuracao(segundos) {
  if (segundos < 60) return `${Math.round(segundos)}s`;
  const m = Math.floor(segundos / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

// ── Métricas ────────────────────────────────────────────────────────────────

async function initTrabalhosMetricas() {
  const painel = document.getElementById('trsub-metricas');
  if (!painel || !currentProject) return;
  const r = await window.pywebview.api.carregar_metricas(currentProject);
  if (!r || !r.success) {
    painel.innerHTML = `<div class="screen-body"><div class="tr-erro">${escapeHtml((r && r.error) || 'erro')}</div></div>`;
    return;
  }
  mtrMontada = true;
  painel.innerHTML = `<div class="screen-body">${mtrMarcacao(r)}</div>`;
}

function mtrMarcacao(r) {
  const t = r.totais;
  const tiles = `
    <div class="mtr-tiles">
      <div class="mtr-tile"><b>${t.chamadas}</b><span>chamadas ao todo</span></div>
      <div class="mtr-tile"><b>${tmpDuracao(t.segundos)}</b><span>rodando neste projeto</span></div>
      <div class="mtr-tile"><b>${mtrCurto(t.tokens_entrada)} <span class="mtr-sec">/ ${mtrCurto(t.tokens_saida)}</span></b><span>tokens entrada / saída (estimado)</span></div>
      <div class="mtr-tile"><b>${t.arquivos}</b><span>arquivos tocados</span></div>
    </div>`;

  const cota = `
    <div class="mtr-caixa">
      <h3>Cota do assistente externo</h3>
      ${r.cota && r.cota.disponivel ? `
        ${mtrCota('Diária', r.cota.diaria)}
        ${mtrCota('Semanal', r.cota.semanal)}`
      : `<p class="tr-nota">
          ${escapeHtml((r.cota && r.cota.motivo) || 'Sem dado de cota.')}
          Este número vem de <b>fora do programa</b> — é o CLI do produto que sabe
          quanto da sua cota já foi. Enquanto ele não souber responder, aqui fica
          vazio de propósito: um número estimado numa tela de custo seria pior que
          nenhum.
        </p>`}
    </div>`;

  const barras = r.terminais.length ? mtrBarras(r.terminais) : `
    <div class="ph-why"><span class="ph-why-tag">Nada ainda</span><br>
      Nenhum terminal gastou nada neste projeto.</div>`;

  return `
    <div class="tr-cabecalho"><div><h2>Métricas</h2>
      <div class="tr-sub">Quanto este projeto custou até agora</div></div></div>
    ${tiles}
    ${cota}
    <div class="mtr-caixa">
      <h3>Tokens por terminal</h3>
      ${barras}
      <p class="tr-nota">
        Barra = tokens de entrada + saída daquele terminal. ⚠️ É uma
        <b>estimativa do programa</b>, feita pelo tamanho do texto que passou pelo
        cano — serve para comparar terminais entre si, que é a pergunta desta
        tela. O número que o produto cobrou de fato é o da cota, acima.
      </p>
    </div>`;
}

// Uma cota que o CLI não informou some da tela em vez de virar "0% usada".
// Barra vazia com rótulo de zero é uma afirmação falsa sobre gasto — e esta é
// justamente a tela em que uma afirmação falsa sobre gasto custa mais caro.
function mtrCota(rotulo, valor) {
  if (valor === null || valor === undefined) {
    return `<div class="mtr-cota mtr-cota-vazia">${escapeHtml(rotulo)} —
              <span class="tr-dim">o CLI não informou</span></div>`;
  }
  return `
    <div class="mtr-cota">
      <div class="mtr-cota-rot">${escapeHtml(rotulo)} <b>${valor}% usada</b></div>
      <div class="mtr-trilho"><span style="width:${valor}%"></span></div>
    </div>`;
}

function mtrBarras(terminais) {
  const maior = Math.max(1, ...terminais.map(t => t.tokens_entrada + t.tokens_saida));
  const linhas = terminais.map(t => {
    const total = t.tokens_entrada + t.tokens_saida;
    const largura = Math.max(2, (total / maior) * 100);
    const cor = t.cor ? `var(${t.cor})` : 'var(--gray)';
    return `
      <div class="mtr-barra-l">
        <div class="mtr-barra-rot">${escapeHtml(t.rotulo)}</div>
        <div class="mtr-trilho"><span style="width:${largura}%; background:${cor}"></span></div>
        <div class="mtr-barra-n">${mtrCurto(total)}</div>
      </div>`;
  }).join('');
  return `<div class="mtr-barras">${linhas}</div>`;
}

function mtrCurto(n) {
  n = n || 0;
  if (n < 1000) return String(n);
  if (n < 1000000) return (n / 1000).toFixed(n < 10000 ? 1 : 0) + 'k';
  return (n / 1000000).toFixed(1) + 'M';
}
