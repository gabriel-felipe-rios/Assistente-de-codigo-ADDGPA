// ═══════════ Linha do tempo — modo "Linha do tempo" (o padrão) ══
// Módulo irmão de index.js. Registra em `window.__ltempo.editor`.
//
// O desenho é o de um editor de vídeo: régua de datas no topo, uma trilha por
// PASTA, blocos como clipes, e uma agulha marcando agora.
//
// ⚠️ **A trilha é uma pasta, nunca um arquivo.** Um projeto de 462 arquivos
// daria 462 trilhas e nada seria legível — e "por arquivo" foi justamente o
// desenho que o usuário vetou. A pasta sai do caminho que o Plugin base já
// grava em cada evento; quem quer o arquivo clica no bloco e lê à direita.
//
// ⚠️ **A agulha arrasta.** `Padrões de interface › Componentes › Barra de
// tempo` tem um ⛔ explícito — "trilho de tempo que não aceita clique nem
// arraste não pode existir" — nascido de uma queixa do próprio usuário sobre
// uma barra decorativa. Num desenho que imita editor de vídeo, uma agulha
// parada é exatamente a armadilha que gerou a regra.

(function () {
  window.__ltempo = window.__ltempo || {};
  const D = () => window.__ltempo.dados;

  const ALTURA_TRILHA = 38;
  // As seis cores de ação do tema, em -rgb para poder variar a opacidade.
  const CORES = ['var(--teal-rgb)', 'var(--blue-rgb)', 'var(--purple-rgb)',
                 'var(--green-rgb)', 'var(--amber-rgb)', 'var(--red-rgb)'];

  function _passo(dias) {
    // O px/dia encolhe com a janela, senão um ano viraria 9.500 px de rolagem.
    if (dias <= 30) return 26;
    if (dias <= 90) return 9;
    return 3;
  }

  function _ticks(eixo, passo) {
    const cada = passo >= 20 ? 5 : (passo >= 8 ? 15 : 30);
    return eixo.map((d, i) => {
      const primeiro = D().ehPrimeiroDoMes(d.dia) || i === 0;
      if (!primeiro && i % cada !== 0) return '';
      const rot = primeiro ? D().rotuloDeMes(d.dia) : D().paraData(d.dia).getDate();
      return '<div class="ltempo-tick' + (primeiro ? ' mes' : '') + '" style="left:'
        + (i * passo) + 'px">' + rot + '</div>';
    }).join('');
  }

  function _vaos(eixo, passo) {
    // Dia sem captura ganha fundo hachurado: sem isso o vão parece "não
    // trabalhei" quando na verdade é "não sei".
    const faixas = [];
    let ini = null;
    eixo.forEach((d, i) => {
      const vazio = d.estado === 'sem_captura';
      if (vazio && ini === null) ini = i;
      if (!vazio && ini !== null) { faixas.push([ini, i - 1]); ini = null; }
    });
    if (ini !== null) faixas.push([ini, eixo.length - 1]);
    return faixas.map(([a, b]) => '<div class="ltempo-vao" style="left:' + (a * passo)
      + 'px;width:' + ((b - a + 1) * passo) + 'px"></div>').join('');
  }

  function html(estado) {
    const j = estado.janela;
    const eixo = (j && j.eixo) || [];
    const trilhas = (j && j.trilhas) || [];
    if (!eixo.length) return '<p class="ltempo-msg">Sem dias na janela.</p>';

    if (!trilhas.length) {
      const desde = j.historico_desde
        ? ' O histórico começa em ' + D().escapar(j.historico_desde) + '.' : '';
      return '<div class="ltempo-vazio"><h4>Nenhuma mudança nesta janela</h4>'
        + '<p>Não há nada registrado nos últimos ' + D().numero(estado.dias) + ' dias'
        + (estado.filtro || estado.tipos.length ? ' com o filtro atual' : '') + '.' + desde
        + '</p></div>';
    }

    const passo = _passo(estado.dias);
    const largura = eixo.length * passo;
    const indice = {};
    eixo.forEach((d, i) => { indice[d.dia] = i; });

    // "outras" entra como uma trilha de verdade, com blocos. Uma faixa
    // rotulada e vazia parece defeito, e esconderia QUANDO houve trabalho nas
    // pastas que não couberam no teto. Ela só não é clicável: não há uma pasta
    // única para pedir ao backend.
    const linhas = trilhas.slice();
    if (j.outras && j.outras.pastas) {
      linhas.push({ pasta: 'outras ' + D().numero(j.outras.pastas) + ' pastas',
                    total: j.outras.total, blocos: j.outras.blocos || [], semClique: true });
    }

    const corDa = (t, i) => (t.semClique ? '128,138,152' : CORES[i % CORES.length]);

    const cabecas = linhas.map((t, ti) =>
      '<div class="ltempo-cabeca">'
      + '<span class="cor" style="background:rgb(' + corDa(t, ti) + ')"></span>'
      + '<span class="nm" title="' + D().escapar(t.pasta) + '">&#8206;'
      + D().escapar(t.pasta) + '</span>'
      + '<span class="qt">' + D().numero(t.total) + '</span></div>').join('');

    const sel = estado.selecao && estado.selecao.tipo === 'bloco' ? estado.selecao : null;
    const corpo = linhas.map((t, ti) => {
      const blocos = (t.blocos || []).map(b => {
        const a = indice[b.ini], z = indice[b.fim];
        if (a === undefined || z === undefined) return '';
        const x = a * passo + 1;
        // Largura mínima: num ano, um bloco de um dia teria 3 px e sumiria.
        const w = Math.max(3, (z - a + 1) * passo - 2);
        const marcado = !t.semClique && sel && sel.pasta === t.pasta
          && sel.ini === b.ini && sel.fim === b.fim;
        return '<div class="ltempo-bloco' + (marcado ? ' sel' : '') + '"'
          + (t.semClique ? ' style="cursor:default;' : ' data-pasta="' + D().escapar(t.pasta)
              + '" data-ini="' + b.ini + '" data-fim="' + b.fim + '" style="')
          + 'left:' + x + 'px;width:' + w + 'px;background:rgba('
          + corDa(t, ti) + ',.82)" title="' + D().escapar(t.pasta) + ' · '
          + D().numero(b.qtd) + ' mudanças · ' + b.ini + (b.ini === b.fim ? '' : ' → ' + b.fim)
          + '"><span>' + (w > 52 ? D().escapar(D().nomeCurto(t.pasta)) : '') + '</span></div>';
      }).join('');
      return '<div class="ltempo-trilha">' + _vaos(eixo, passo) + blocos + '</div>';
    }).join('');

    const iCursor = indice[estado.cursor] !== undefined
      ? indice[estado.cursor] : eixo.length - 1;
    const xAgulha = (iCursor + 0.5) * passo;

    const painel = _painelDaSelecao(estado);

    return '<div class="ltempo-editor"><div>'
      + '<div class="ltempo-pista">'
      +   '<div class="ltempo-cabecas"><div class="ltempo-cabeca-regua">Pastas</div>'
      +     cabecas + '</div>'
      +   '<div class="ltempo-rolo"><div style="width:' + largura + 'px;position:relative">'
      +     '<div class="ltempo-regua">' + _ticks(eixo, passo) + '</div>'
      +     corpo
      +     '<div class="ltempo-agulha" style="left:' + xAgulha + 'px"></div>'
      +   '</div></div>'
      + '</div>'
      + '<div class="ltempo-legenda">'
      +   '<span>cada trilha é uma <b style="color:var(--text)">pasta</b></span>'
      +   '<span>bloco = dias seguidos com mudança ali</span>'
      +   '<span style="margin-left:auto;display:flex;align-items:center;gap:8px">'
      +     '<span style="display:inline-block;width:2px;height:11px;background:var(--red)"></span>'
      +     D().escapar(eixo[iCursor] ? eixo[iCursor].dia : '')
      +     '<button type="button" class="ltempo-btn-agora">voltar para agora</button></span>'
      + '</div></div>' + painel + '</div>';
  }

  function _painelDaSelecao(estado) {
    const s = estado.selecao;
    if (s && s.tipo === 'bloco') {
      return window.__ltempo.painel.html(estado, s.pasta,
        s.ini + (s.ini === s.fim ? '' : ' → ' + s.fim)
        + ' · ' + D().numero((estado.eventos || []).length) + ' mudanças');
    }
    if (s && s.tipo === 'dia') {
      return window.__ltempo.painel.html(estado, s.dia, D().diaDaSemana(s.dia)
        + ' · o dia sob a agulha');
    }
    return window.__ltempo.painel.html(estado, '—', 'clique num bloco ou arraste a agulha');
  }

  function ligar(raiz, estado, acoes, desligar) {
    const rolo = raiz.querySelector('.ltempo-rolo');
    const cabecas = raiz.querySelector('.ltempo-cabecas');
    if (!rolo) return;

    // Abre já rolado no presente, como um editor de vídeo abre no cursor.
    rolo.scrollLeft = rolo.scrollWidth;

    // As cabeças de trilha não rolam na horizontal, mas precisam acompanhar a
    // altura — aqui só o alinhamento vertical importa, e ele é natural pelo
    // grid. O que precisa de sincronia é o inverso: rolar a roda do mouse
    // sobre as cabeças rola as trilhas.
    if (cabecas) {
      const aoRolar = e => { rolo.scrollLeft += e.deltaY; e.preventDefault(); };
      cabecas.addEventListener('wheel', aoRolar, { passive: false });
      desligar.push(() => cabecas.removeEventListener('wheel', aoRolar));
    }

    raiz.querySelectorAll('.ltempo-bloco[data-pasta]').forEach(el => {
      el.addEventListener('click', ev => {
        ev.stopPropagation();
        acoes.selecionar({ tipo: 'bloco', pasta: el.dataset.pasta,
                           ini: el.dataset.ini, fim: el.dataset.fim });
      });
    });

    const btnAgora = raiz.querySelector('.ltempo-btn-agora');
    if (btnAgora) btnAgora.addEventListener('click', () => {
      estado.cursor = estado.janela.hoje;
      estado.selecao = null;
      estado.eventos = null;
      acoes.repintar();
    });

    // ── A agulha: clique na régua e arraste ────────────────────────────────
    const eixo = estado.janela.eixo;
    const passo = _passo(estado.dias);
    const trilho = rolo.firstElementChild;
    const regua = raiz.querySelector('.ltempo-regua');
    const agulha = raiz.querySelector('.ltempo-agulha');

    function diaEmX(clienteX) {
      const caixa = trilho.getBoundingClientRect();
      const i = Math.floor((clienteX - caixa.left) / passo);
      return eixo[Math.max(0, Math.min(eixo.length - 1, i))].dia;
    }

    let arrastando = false;
    function mover(e) {
      if (!arrastando) return;
      const dia = diaEmX(e.clientX);
      if (dia === estado.cursor) return;
      estado.cursor = dia;
      // Durante o arraste só a agulha se move — repintar a tela inteira a cada
      // pixel faria o arraste engasgar. O dia é carregado ao soltar.
      const i = eixo.findIndex(d => d.dia === dia);
      if (agulha) agulha.style.left = ((i + 0.5) * passo) + 'px';
    }
    function soltar() {
      if (!arrastando) return;
      arrastando = false;
      document.body.style.userSelect = '';
      acoes.selecionar({ tipo: 'dia', dia: estado.cursor });
    }
    function pegar(e) {
      arrastando = true;
      document.body.style.userSelect = 'none';
      mover(e);
    }

    if (regua) regua.addEventListener('mousedown', pegar);
    if (agulha) agulha.addEventListener('mousedown', pegar);
    document.addEventListener('mousemove', mover);
    document.addEventListener('mouseup', soltar);
    // Sem isto, um arraste órfão continua respondendo ao mouse depois de
    // trocar de modo ou de projeto.
    desligar.push(() => {
      document.removeEventListener('mousemove', mover);
      document.removeEventListener('mouseup', soltar);
      document.body.style.userSelect = '';
    });
  }

  window.__ltempo.editor = { html, ligar };
})();
