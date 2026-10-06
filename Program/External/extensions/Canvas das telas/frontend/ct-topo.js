// ═══════════════════════════════════ CANVAS DAS TELAS — O TOPO E O ⚙ ══
// Os controles do topo, o flutuante do ⚙ e os itens da lista — tudo delegado
// no container da aba, que sobrevive a cada remontagem por `innerHTML`.

(function () {
  const TAM_MIN = 200;
  const TAM_MAX = 4000;
  const E = () => window.ctEstado;
  const montada = () => typeof window.ctMontada === 'function' && window.ctMontada();
  const prefs = () => (typeof xtPreferenciasDe === 'function' && xtPreferenciasDe(window.ctSlug)) || {};
  const lembrar = () => prefs().lembrar_posicoes !== false;

  const gravarEstado = () => window.ctChamar('estado_gravar', { estado: E().gravavel() });

  // As posições guardadas do tamanho atual, se houver; senão, arrumadas.
  function posicionar() {
    const e = E(), guardadas = lembrar() && e.posicoesGravadas[e.tamanho];
    e.posicoes = {};
    window.ctArrumar();
    if (guardadas) Object.keys(guardadas).forEach(id => { if (e.posicoes[id]) e.posicoes[id] = guardadas[id]; });
  }

  function refazer() {
    posicionar();
    window.ctMontarQuadros();
    window.ctVerTudo();
  }

  // Vale para TODO `.ct-pop` da aba: abre o pedido e fecha os outros; o
  // mesmo de novo fecha. A fase 03 acrescenta o da cor.
  window.ctAlternarPop = function (id) {
    const c = E().container;
    if (!c) return;
    c.querySelectorAll('.ct-pop').forEach(p => {
      p.classList.toggle('hidden', p.id !== id || !p.classList.contains('hidden'));
    });
  };

  function pintarTamanhos(c) {
    c.querySelectorAll('#ct-pop-tam input[data-tam]').forEach(i => {
      i.value = E().tamanhos[i.dataset.tam][+i.dataset.eixo];
    });
  }

  function pintarToggle(pill, on) {
    pill.querySelector('.toggle-track').classList.toggle('on', on);
    pill.querySelector('.toggle-label').classList.toggle('on', on);
  }

  async function lerDeNovo(c) {
    const e = E(), projeto = e.projeto;
    // Parada num aviso ou num erro, a aba não tem canvas onde remontar:
    // desenha tudo de novo.
    if (!e.desenhada) { if (projeto) window.ctIniciar(c, { projeto }); return; }
    const stat = c.querySelector('#ct-stat');
    if (stat) stat.textContent = `lendo ${(e.leitura && e.leitura.comeca) || 'o site'} e as pastas de trabalho…`;
    const r = await window.ctLer(projeto);
    if (!montada() || E() !== e || e.projeto !== projeto) return;
    if (!r) return;
    // Virou aviso (o arquivo principal sumiu, deixou de ser .html…): o
    // desenho completo é quem sabe mostrar o aviso no lugar do canvas.
    if (r.aviso || !(r.telas || []).length) { e.desenhada = false; window.ctIniciar(c, { projeto }); return; }
    e.leitura = r;
    const lista = c.querySelector('#ct-lista');
    if (lista) lista.innerHTML = window.ctHtmlLista(r);
    // Mantém onde cada tela estava; só as novas são arrumadas. E o zoom fica.
    const antes = e.posicoes;
    e.posicoes = {};
    window.ctArrumar();
    Object.keys(antes).forEach(id => { if (e.posicoes[id]) e.posicoes[id] = antes[id]; });
    window.ctMontarQuadros();          // recarrega cada iframe no endereço dele
    window.ctAplicar();
    window.ctSelecionar(e.escolhida);
  }

  function aoClicar(ev) {
    const c = E().container, alvo = ev.target;
    if (!c || !alvo.closest) return;
    const b = alvo.closest('button, [data-foco], .toggle-pill');
    if (!b) return;

    if (b.matches('#ct-tamanho [data-tam]')) {
      E().tamanho = b.dataset.tam;
      c.querySelectorAll('#ct-tamanho [data-tam]').forEach(x => x.classList.toggle('active', x === b));
      refazer();
    } else if (b.id === 'ct-tam-config') {
      pintarTamanhos(c);
      window.ctAlternarPop('ct-pop-tam');
    } else if (b.id === 'ct-tam-padrao') {
      const e = E();
      Object.keys(e.TAMANHOS_PADRAO).forEach(k => { e.tamanhos[k] = [...e.TAMANHOS_PADRAO[k]]; });
      pintarTamanhos(c);
      gravarEstado();
      refazer();
    } else if (b.matches('.toggle-pill[data-liga="temporario"]')) {
      ev.preventDefault();
      E().naoGuardar = !E().naoGuardar;
      pintarToggle(b, E().naoGuardar);
      gravarEstado();
    } else if (b.id === 'ct-menos') {
      window.ctZoomCentro(1 / 1.2);
    } else if (b.id === 'ct-mais') {
      window.ctZoomCentro(1.2);
    } else if (b.id === 'ct-enquadrar') {
      window.ctVerTudo();
    } else if (b.id === 'ct-arrumar') {
      E().posicoes = {};
      window.ctArrumar();
      window.ctMontarQuadros();
      window.ctVerTudo();
      if (lembrar()) E().gravarPosicoes();      // o "esquecer posições" da página de opções
    } else if (b.id === 'ct-ler') {
      lerDeNovo(c);
    } else if (b.id === 'ct-recolher-topo') {
      window.ctRecolher('topo', true);
    } else if (b.id === 'ct-abrir-topo') {
      window.ctRecolher('topo', false);
    } else if (b.id === 'ct-recolher-lista') {
      window.ctRecolher('lista', true);
    } else if (b.id === 'ct-abrir-lista') {
      window.ctRecolher('lista', false);
    } else if (b.dataset.foco) {
      window.ctIrPara(b.dataset.foco);          // leva até a tela, sem entrar (D16)
    }
  }

  // Os campos de tamanho: de 200 a 4000; fora disso volta ao valor anterior.
  function aoMudar(ev) {
    const i = ev.target;
    if (!i.matches || !i.matches('#ct-pop-tam input[data-tam]')) return;
    const c = E().container, v = parseInt(i.value, 10);
    if (v >= TAM_MIN && v <= TAM_MAX) {
      E().tamanhos[i.dataset.tam][+i.dataset.eixo] = v;
      gravarEstado();
      if (i.dataset.tam === E().tamanho) refazer();
    }
    pintarTamanhos(c);
  }

  function ligarTopo(container) {
    container.addEventListener('click', aoClicar);
    container.addEventListener('change', aoMudar);
  }
  window.ctEstado.ligadores.push(ligarTopo);
  // O ⟳ Ler de novo, também para o Ctrl+S (`ct-eventos.js`).
  window.ctEstado.lerDeNovo = () => (E().container ? lerDeNovo(E().container) : Promise.resolve());

  // Fechar o flutuante ao clicar fora — pelo `composedPath`, nunca por
  // `contains`/`closest` (regra "Clique-fora confere composedPath, não
  // contains"): o botão de dentro pode ter redesenhado o flutuante.
  const aoClicarFora = ev => {
    const c = E().container;
    if (!c) return;
    const caminho = ev.composedPath();
    c.querySelectorAll('.ct-pop:not(.hidden)').forEach(p => {
      const abre = p.parentElement && p.parentElement.querySelector(':scope > button');
      if (caminho.includes(p) || (abre && caminho.includes(abre))) return;
      p.classList.add('hidden');
    });
  };
  document.addEventListener('click', aoClicarFora);
  window.ctEstado.ouvintes.push([document, 'click', aoClicarFora]);
})();
