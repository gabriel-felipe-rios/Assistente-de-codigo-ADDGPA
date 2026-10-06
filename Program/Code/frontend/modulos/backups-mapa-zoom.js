// ═══ BACKUPS → Mapa da mudança — zoom, pan e a poda de rótulos ═════════════
//
// Saiu de `backups-mapa.js` pela AMF: os dois juntos passavam de 500 linhas. A
// divisão também é conceitual — o que mora aqui é o GESTO (ampliar, mover,
// reenquadrar, decidir se o rótulo cabe), e não o desenho.
//
// São TRÊS motores, porque os desenhos são de três naturezas:
//
//   · `bmLigarZoom`     — d3 sobre SVG (Treemap, Sunburst, Ligações lado a lado)
//   · `bmLigarZoomHtml` — `transform: scale` sobre HTML que ROLA (Fases, Tabela,
//                         Fita, Por arquivo). Mesmo modelo do Visualizar pipeline
//   · `bmLigarZoomPan`  — `translate + scale` sobre HTML que NÃO rola: a Matriz.
//                         É o modelo da Matriz de Dependências da aba Mapas
//
// Nos dois primeiros o movimento é ESPELHADO entre os painéis — a Matriz é um
// painel só, e nela não há o que espelhar. Os três se registram em
// `bmZoomAtivo`, e é com ele que o controle `− 100% +` do painel do canto fala:
// sem esse controle o zoom só existia escrito numa dica da legenda.

// O motor da leitura em cena. Trocar de formato troca o motor; o controle do
// canto fala com este objeto e não precisa saber qual dos três está ligado.
let bmZoomAtivo = null;

function bmZoomRegistrar(escala, passo, reenquadrar) {
  bmZoomAtivo = { escala, passo, reenquadrar };
  bmZoomMostrar(escala);
}

function bmZoomMostrar(escala) {
  if (bmZoomAtivo) bmZoomAtivo.escala = escala;
  const el = document.getElementById('bm-zoom-val');
  if (el) el.textContent = Math.round(escala * 100) + '%';
}

function bmZoomPasso(direcao) {
  if (bmZoomAtivo) bmZoomAtivo.passo(direcao);
}

function bmZoomReenquadrar() {
  if (bmZoomAtivo) bmZoomAtivo.reenquadrar();
}

// ── 1 · d3 sobre SVG, espelhado ─────────────────────────────────────────────

// `inicial` é o enquadramento de partida (as Ligações calculam o seu com
// `_ligTransformDeAjuste`). Ele também é o alvo do "reenquadrar": voltar à
// identidade jogaria o usuário no canto superior esquerdo de um desenho que
// quase nunca cabe inteiro — o mesmo motivo que `_ligCentralizar` documenta.
// `aoAjustar(k)` é chamado no FIM do gesto, e só nele: é a hora de reacertar os
// rótulos. Quem não passa nada cai na poda por medição (`bmRepodar`).
function bmLigarZoom(pares, inicial, aoAjustar) {
  // `pares` = [{svg, camada}, …]. O transform vai DENTRO de cada painel, num
  // viewport com `overflow:hidden` — nunca no conjunto. Aplicado no conjunto,
  // arrastar um painel joga o vizinho para fora da tela.
  //
  // O movimento é ESPELHADO: mexer num lado mexe no outro, senão comparar
  // exige repetir o mesmo gesto duas vezes e acertar.
  if (typeof d3 === 'undefined') return;
  let ecoando = false;
  let rasterTimer = null;
  let kAtual = 1;

  // A "versão borrada" durante o gesto. Sem ela o motor redesenha o SVG inteiro
  // a cada quadro — com centenas de fatias, o Sunburst engasga. Com ela, a
  // camada vira textura e o gesto escala o raster: fica momentaneamente borrado
  // e volta nítido ao parar.
  //
  // ⚠️ `will-change` NUNCA permanente: deixado ligado, o motor guarda o raster
  // da escala antiga e o desenho fica borrado para sempre. Não há evento de fim
  // de gesto confiável na roda — o fim é um silêncio de 200 ms. É a mesma
  // armadilha, e a mesma saída, de `_applyDsmTransform` (`mapas.js`).
  const acelerar = () => {
    pares.forEach(({ camada }) => { camada.style.willChange = 'transform'; });
    clearTimeout(rasterTimer);
    rasterTimer = setTimeout(() => {
      pares.forEach(({ camada }) => { camada.style.willChange = 'auto'; });
    }, 200);
  };

  const zooms = pares.map(({ svg, camada }) => {
    const sel = d3.select(svg);
    const zoom = d3.zoom()
      .scaleExtent([0.2, 20])
      .on('zoom', ev => {
        camada.setAttribute('transform', ev.transform);
        // A escala publicada em CSS é o que faz o rótulo CONTRA-ESCALAR: sem
        // isto o texto cresce junto com o bloco, a proporção entre os dois
        // nunca muda, e ampliar não revela nome nenhum — que foi a queixa.
        //
        // ⚠️ PISO EM 1: reduzindo, o rótulo volta a encolher junto com o
        // desenho. Contra-escalar para baixo faria o texto crescer em unidades
        // do desenho e estourar caixas que hoje o comportam — o enquadramento
        // inicial das Ligações é quase sempre k < 1, e o desenho nasceria mudo.
        //
        // ⚠️ TETO EM 4: acima disso a fonte cai para frações de pixel em
        // unidades do desenho, e a medição da poda — que é INTEIRA
        // (`scrollWidth`) — deixa de distinguir a caixa do texto: ela libera um
        // rótulo que não cabe, e o nome aparece por cima do quadrado do vizinho.
        // Em 4× o texto já está grande na tela; continuar encolhendo não
        // revela mais nada e só quebra a conta.
        //
        // ⚠️ ESCRITO SÓ QUANDO MUDA, com uma casa decimal. Mudar uma variável
        // CSS na camada invalida o estilo de TODO descendente; fazer isso
        // sessenta vezes por segundo, com centenas de blocos, é metade do
        // travamento.
        const k = Math.round(Math.min(4, Math.max(1, ev.transform.k)) * 10) / 10;
        if (k !== kAtual) {
          kAtual = k;
          camada.style.setProperty('--bm-k', k);
        }
        acelerar();
        // ⚠️ O ACERTO DOS RÓTULOS NÃO ACONTECE AQUI. Ele mede (ou reescreve)
        // centenas de elementos, e chamá-lo por quadro é o que trava o gesto —
        // cada medição força o navegador a recalcular o layout inteiro no meio
        // da animação. Ele roda no `end`, quando o gesto para.
        if (ecoando) return;
        ecoando = true;
        bmZoomMostrar(ev.transform.k);
        zooms.forEach(outro => {
          if (outro && outro.svg !== svg) {
            outro.sel.call(outro.zoom.transform, ev.transform);
          }
        });
        ecoando = false;
      })
      .on('start', () => sel.classed('arrastando', true))
      .on('end', ev => {
        sel.classed('arrastando', false);
        // O fim do gesto — inclusive o da roda, que o d3 fecha depois de um
        // silêncio curto. É aqui que os rótulos são reacertados, uma vez só.
        if (aoAjustar) aoAjustar(kAtual);
        else bmRepodar();
        bmZoomMostrar(ev.transform.k);
      });
    sel.call(zoom)
      // O duplo clique do d3 dá zoom, e aqui atrapalha: o alvo é um bloco que
      // o usuário quer inspecionar, não um salto de enquadramento.
      .on('dblclick.zoom', null);

    sel.on('mousedown.reenquadrar', ev => {
      if (ev.button !== 1) return;
      // Sem isto o Windows abre o autoscroll (o ícone de setas) e engole o
      // resto da interação.
      ev.preventDefault();
      bmReenquadrarTudo(zooms, inicial);
    });
    sel.on('auxclick.reenquadrar', ev => { if (ev.button === 1) ev.preventDefault(); });

    return { svg, sel, zoom };
  });

  // O enquadramento de partida é aplicado num lado só: o eco leva para o outro,
  // e é ele que garante que os dois nasçam exatamente iguais.
  if (inicial && zooms[0]) zooms[0].sel.call(zooms[0].zoom.transform, inicial);

  bmZoomRegistrar(inicial ? inicial.k : 1,
    direcao => {
      const primeiro = zooms[0];
      if (!primeiro) return;
      primeiro.sel.transition().duration(120)
        .call(primeiro.zoom.scaleBy, direcao > 0 ? 1.25 : 1 / 1.25);
    },
    () => bmReenquadrarTudo(zooms, inicial));
  return zooms;
}

function bmReenquadrarTudo(zooms, inicial) {
  zooms.forEach(o => o && o.sel.transition().duration(250)
    .call(o.zoom.transform, inicial || d3.zoomIdentity));
}

// ── 2 · `transform: scale` sobre HTML que rola ──────────────────────────────

// As leituras em HTML que são LISTA (Fases, Tabela, Fita, Por arquivo) rolam, e
// por isso a roda sozinha continua rolando: quem lê lista, rola. Com Ctrl,
// amplia — a mesma convenção do Visualizar pipeline. Junto vai a correção de
// largura que `vpAplicarZoom` documenta: sem ela o conteúdo escalado ultrapassa
// a caixa e o viewport não sabe que precisa rolar mais, porque a caixa do
// elemento NÃO cresce com o transform.
function bmLigarZoomHtml(area) {
  const alvos = [...area.querySelectorAll('.bm-zoomavel')];
  if (!alvos.length) return;
  let escala = 1;

  const aplicar = () => {
    alvos.forEach(el => {
      el.style.transform = escala === 1 ? '' : `scale(${escala})`;
      el.style.width = escala === 1 ? '' : `${100 / escala}%`;
    });
    bmZoomMostrar(escala);
  };
  const passo = direcao => {
    escala = Math.min(2, Math.max(0.4, +(escala + direcao * 0.1).toFixed(2)));
    aplicar();
  };

  // `.bm-fitas` também rola e amplia, mas não é um `.bm-viewport`: a Fita é
  // um bloco de rolagem único para os dois lados, de propósito.
  area.querySelectorAll('.bm-viewport, .bm-fitas').forEach(vp => {
    vp.addEventListener('wheel', ev => {
      if (!ev.ctrlKey) return;
      ev.preventDefault();
      passo(ev.deltaY < 0 ? 1 : -1);
    }, { passive: false });
    vp.addEventListener('mousedown', ev => {
      if (ev.button !== 1) return;
      ev.preventDefault();
      escala = 1;
      aplicar();
    });
  });

  bmZoomRegistrar(1, passo, () => { escala = 1; aplicar(); });
}

// ── 3 · `translate + scale` sobre HTML que NÃO rola: a Matriz ───────────────

// O par de listeners de janela do pan em vigor. Ver o porquê no fim da função.
let bmPanDaJanela = null;

function bmSoltarPanAnterior() {
  if (!bmPanDaJanela) return;
  window.removeEventListener('mousemove', bmPanDaJanela.mover);
  window.removeEventListener('mouseup', bmPanDaJanela.soltar);
  bmPanDaJanela = null;
}

// Este é o modelo da Matriz de Dependências (`_dsmAplicarZoom` e `_initDsmPan`,
// em `mapas.js`), e ele é diferente do de cima de propósito: uma matriz não é
// lista. Não há o que rolar e não há ordem de leitura — o que se faz nela é
// caçar um cruzamento, e para isso o gesto certo é arrastar e ampliar, não
// rolar. Por isso aqui a roda amplia SOZINHA, sem Ctrl.
//
// ⚠️ O viewport passa a `overflow:hidden`, e com isso o cabeçalho de linha
// perde o `position:sticky` — igual ao original, que também não tem. Com pan
// livre, grudar deixa de fazer sentido: o conteúdo inteiro anda junto.
function bmLigarZoomPan(viewport) {
  const alvo = viewport && viewport.querySelector('.bm-zoomavel');
  if (!alvo) return;
  let escala = 1, panX = 0, panY = 0;
  let rasterTimer = null;

  const aplicar = () => {
    alvo.style.transformOrigin = '0 0';
    alvo.style.transform = `translate(${panX}px, ${panY}px) scale(${escala})`;
    // `will-change` só DURANTE o gesto. Deixado permanente, o motor mantém a
    // camada com o raster da escala antiga e a matriz fica borrada depois do
    // zoom. Não há evento de fim de gesto: o fim é um silêncio de 200 ms.
    alvo.style.willChange = 'transform';
    clearTimeout(rasterTimer);
    rasterTimer = setTimeout(() => { alvo.style.willChange = 'auto'; }, 200);
    bmZoomMostrar(escala);
  };

  // Zoom ancorado num ponto da tela: o pixel sob o cursor continua sob o
  // cursor. Sem isto o zoom parte sempre do canto, e ampliar o meio da matriz
  // joga para fora justamente o que se queria ver.
  const ampliar = (nova, ancoraX, ancoraY) => {
    const k = Math.min(4, Math.max(0.3, +nova.toFixed(2)));
    const conteudoX = (ancoraX - panX) / escala;
    const conteudoY = (ancoraY - panY) / escala;
    escala = k;
    panX = ancoraX - conteudoX * k;
    panY = ancoraY - conteudoY * k;
    aplicar();
  };
  const centro = () => ({ x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 });

  viewport.addEventListener('wheel', ev => {
    ev.preventDefault();
    // Passo multiplicativo, não aditivo: somar 0,1 é um salto de 33% quando a
    // escala está em 0,3 e de 3% quando está em 3. Multiplicar dá o mesmo passo
    // percebido em qualquer nível.
    const fator = ev.deltaY > 0 ? 1 / 1.12 : 1.12;
    const caixa = viewport.getBoundingClientRect();
    ampliar(escala * fator, ev.clientX - caixa.left, ev.clientY - caixa.top);
  }, { passive: false });

  let arrastando = false, x0 = 0, y0 = 0, px0 = 0, py0 = 0;
  viewport.addEventListener('mousedown', ev => {
    if (ev.button === 1) {           // botão do meio reenquadra
      ev.preventDefault();
      escala = 1; panX = 0; panY = 0; aplicar();
      return;
    }
    if (ev.button !== 0) return;
    // O arrasto não pode comer o clique da cruz: célula e cabeçalho ficam de
    // fora, exatamente como no original.
    if (ev.target.closest('.bm-mx-linha, .bm-mx-col, .bm-mx-cheia')) return;
    arrastando = true;
    x0 = ev.clientX; y0 = ev.clientY; px0 = panX; py0 = panY;
    viewport.classList.add('arrastando');
    ev.preventDefault();
  });
  const mover = ev => {
    if (!arrastando) return;
    // O `translate` vem ANTES do `scale`, então ele age no espaço da tela: o
    // delta do mouse entra em pixels, sem dividir pela escala.
    panX = px0 + (ev.clientX - x0);
    panY = py0 + (ev.clientY - y0);
    aplicar();
  };
  const soltar = () => {
    if (!arrastando) return;
    arrastando = false;
    viewport.classList.remove('arrastando');
  };
  // ⚠️ O arrasto precisa da JANELA para continuar valendo quando o cursor sai
  // do viewport — mas a Matriz é redesenhada a cada troca de granularidade, e
  // um par de listeners novo por desenho vazaria. Por isso o par anterior é
  // solto antes: só existe um vivo por vez.
  bmSoltarPanAnterior();
  bmPanDaJanela = { mover, soltar };
  window.addEventListener('mousemove', mover);
  window.addEventListener('mouseup', soltar);
  viewport.addEventListener('auxclick', ev => { if (ev.button === 1) ev.preventDefault(); });

  bmZoomRegistrar(1,
    direcao => { const c = centro(); ampliar(escala * (direcao > 0 ? 1.12 : 1 / 1.12), c.x, c.y); },
    () => { escala = 1; panX = 0; panY = 0; aplicar(); });
}

// ── Rótulo que não cabe ─────────────────────────────────────────────────────

// Os blocos vivos da poda. A lista é trocada a cada desenho, e o `resize` é
// UM só, ligado uma vez — um listener por bloco redesenhado vazaria a cada
// troca de formato, e são cinco formatos com oito leituras.
let bmBlocosPodados = [];
let bmResizeLigado = false;
let bmRedesenharNoResize = null;
let bmRepodaAgendada = false;

function bmPodarRotulos(bloco) {
  // O texto entra SEMPRE. Quem decide se fica é esta poda, DEPOIS de o
  // navegador medir.
  //
  // ⚠️ Se a largura vier 0 — aba escondida, layout ainda não calculado —, a
  // medição não decide nada e a poda DESISTE, remedindo no quadro seguinte.
  // Sem essa desistência, uma medição prematura apaga todos os rótulos de uma
  // vez e o desenho nasce mudo.
  //
  // ⚠️ A poda é REFEITA a cada gesto de zoom (`bmRepodar`). Ela media uma vez
  // só, e o `display:none` era definitivo: ampliar nunca trazia um nome de
  // volta. Com a contra-escala do rótulo, cada nível de zoom faz caber mais um
  // punhado deles — mas só se alguém remedir.
  //
  // A rede em CSS (`container-type: inline-size` + `@container`) cobre o que
  // esta função não vê. Nunca há reticências: some o rótulo inteiro.
  if (!bloco) return;
  if (!bmBlocosPodados.includes(bloco)) bmBlocosPodados.push(bloco);
  const medir = () => {
    const largura = bloco.clientWidth;
    if (!largura) { requestAnimationFrame(medir); return; }
    const rotulos = [...bloco.querySelectorAll('.bm-rot')];
    // ⚠️ TRÊS PASSADAS SEPARADAS, e a ordem é o que importa: escrever, ler,
    // escrever. Alternar `classList.remove` com a leitura de `scrollWidth`
    // obriga o navegador a recalcular o layout a cada elemento — com centenas
    // de rótulos isso é o "layout thrashing" clássico, e era metade do
    // travamento do Treemap.
    rotulos.forEach(rot => rot.classList.remove('bm-rot-oculto'));
    // ⚠️ COMPARAÇÃO EXATA, NUNCA COM MARGEM PARA MENOS. `scrollWidth` **nunca
    // é menor que `clientWidth`** — é a definição dele: o maior entre o
    // conteúdo e a própria caixa. Exigir `<= clientWidth - 1` é uma condição
    // que não pode ser satisfeita, e o resultado foi todo rótulo do mapa sumir
    // de uma vez. Quem resolve o rótulo que escapava é o teto do `--bm-k`.
    const naoCabe = rotulos.filter(rot =>
      rot.scrollWidth > rot.clientWidth || rot.scrollHeight > rot.clientHeight);
    naoCabe.forEach(rot => rot.classList.add('bm-rot-oculto'));
  };
  bloco._bmMedir = medir;
  requestAnimationFrame(medir);
  bmLigarResize();
}

// Uma remedição por quadro, no máximo. O zoom do d3 dispara dezenas de eventos
// por segundo, e remedir centenas de rótulos em cada um trava o gesto.
function bmRepodar() {
  if (bmRepodaAgendada) return;
  bmRepodaAgendada = true;
  requestAnimationFrame(() => {
    bmRepodaAgendada = false;
    bmBlocosPodados = bmBlocosPodados.filter(b => b.isConnected);
    bmBlocosPodados.forEach(b => b._bmMedir && b._bmMedir());
  });
}

// Treemap e Sunburst congelam largura e altura no momento do desenho — é parte
// do "o Sunburst está pequeno". Redesenhar no `resize` é o conserto, com
// debounce para não refazer o desenho a cada pixel de arrasto da janela.
function bmLigarResize() {
  if (bmResizeLigado) return;
  bmResizeLigado = true;
  let timer = null;
  window.addEventListener('resize', () => {
    // Blocos que saíram do documento são descartados: redesenhar troca o
    // `innerHTML` inteiro, e medir um nó órfão dá largura 0 para sempre.
    bmBlocosPodados = bmBlocosPodados.filter(b => b.isConnected);
    bmBlocosPodados.forEach(b => requestAnimationFrame(b._bmMedir));
    if (!bmRedesenharNoResize) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (document.getElementById('bm-area')) bmRedesenharNoResize();
    }, 220);
  });
}
