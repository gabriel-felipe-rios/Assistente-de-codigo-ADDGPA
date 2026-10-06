// ═══════════ Linha do tempo — modo "Feed" (um cartão por dia) ══
// Módulo irmão de index.js. Registra em `window.__ltempo.feed`.
//
// É o modo que continua legível com UM dia de histórico — por isso ele existe
// mesmo não sendo o padrão. Lê o dia inteiro sob demanda (clicar no cartão).

(function () {
  window.__ltempo = window.__ltempo || {};
  const D = () => window.__ltempo.dados;

  function _miniCalendarios(eixo) {
    // Agrupa a janela por mês e desenha um quadradinho por dia, sempre
    // contíguo. ⚠️ A grade começa no dia da semana certo, senão o desenho
    // sugere que o dia 1 caiu num domingo.
    const meses = [];
    eixo.forEach(d => {
      const chave = d.dia.slice(0, 7);
      let mes = meses[meses.length - 1];
      if (!mes || mes.chave !== chave) {
        mes = { chave, nome: D().rotuloDeMes(d.dia), dias: [] };
        meses.push(mes);
      }
      mes.dias.push(d);
    });

    const maior = Math.max(1, ...eixo.map(d => d.eventos || 0));
    return meses.slice().reverse().map(mes => {
      const vazios = D().paraData(mes.dias[0].dia).getDay();
      const antes = Array.from({ length: vazios }, () => '<div></div>').join('');
      const quads = mes.dias.map(d => {
        if (d.estado === 'sem_captura') {
          return '<div class="ltempo-quad vazio" title="' + d.dia + ': sem captura"></div>';
        }
        if (!d.eventos) {
          return '<div class="ltempo-quad zero" title="' + d.dia
            + ': capturado, nenhuma mudança"></div>';
        }
        const forca = Math.max(0.25, (d.eventos || 0) / maior).toFixed(2);
        return '<div class="ltempo-quad" style="opacity:' + forca + '" title="' + d.dia
          + ': ' + D().numero(d.eventos) + ' mudanças"></div>';
      }).join('');
      return '<div class="ltempo-mes"><div class="ltempo-mes-nome">'
        + D().escapar(mes.nome) + '</div><div class="ltempo-grade">'
        + antes + quads + '</div></div>';
    }).join('');
  }

  function _cartao(estado, d, renomeiosDoDia) {
    const aberto = estado.selecao && estado.selecao.tipo === 'dia' && estado.selecao.dia === d.dia;
    const marco = renomeiosDoDia.map(r =>
      '<div class="ltempo-marco">O projeto se chamava <b>' + D().escapar(r.de)
      + '</b> até aqui.</div>').join('');

    if (d.estado === 'sem_captura') {
      return marco + '<div class="ltempo-dia vazia"><div class="ltempo-dia-cab">'
        + '<span class="ltempo-dia-data">' + d.dia + '</span>'
        + '<span class="ltempo-dia-dow">' + D().diaDaSemana(d.dia) + '</span>'
        + '<span class="ltempo-dia-stats"><span class="ltempo-fraco">sem captura</span></span>'
        + '</div></div>';
    }

    const total = Math.max(1, (d.ganhas || 0) + (d.perdidas || 0));
    const barra = '<span class="ltempo-barrinha">'
      + '<i style="width:' + ((d.ganhas || 0) / total * 100) + '%;background:var(--green)"></i>'
      + '<i style="width:' + ((d.perdidas || 0) / total * 100) + '%;background:var(--red)"></i></span>';

    let lista = '';
    if (aberto) {
      lista = estado.carregandoEventos
        ? '<ul class="ltempo-eventos"><li class="ltempo-fraco">Carregando…</li></ul>'
        : '<ul class="ltempo-eventos">' + (estado.eventos || []).map(ev =>
            '<li><span class="ltempo-tag ltempo-tag-' + D().escapar(ev.tipo) + '">'
            + D().escapar(ev.tipo) + '</span>'
            + '<span class="ltempo-mono">' + D().rotuloDoEvento(ev) + '</span> '
            + D().medidaDoEvento(ev) + ' ' + D().marcaDeOrigem(ev) + '</li>').join('')
          + '</ul>';
    }

    // ⚠️ `arquivos` e `linhas` só existem em dia com captura de verdade. No dia
    // "parcial" (evento datado retroativamente num dia que nunca teve captura)
    // o Plugin base não tem como saber o retrato — mostrar 0 seria inventar.
    const retrato = (typeof d.linhas === 'number')
      ? '<span class="ltempo-fraco">' + D().numero(d.linhas) + ' linhas</span>'
      : (d.estado === 'parcial'
          ? '<span class="ltempo-fraco" title="Este dia recebeu eventos depois, e o retrato '
            + 'dele nunca foi capturado">retrato desconhecido</span>' : '');

    return marco
      + '<div class="ltempo-dia" data-dia="' + d.dia + '">'
      +   '<div class="ltempo-dia-cab' + (aberto ? ' tem-lista' : '') + '" style="cursor:'
      +     (d.eventos ? 'pointer' : 'default') + '">'
      +     '<span class="ltempo-dia-data">' + d.dia + '</span>'
      +     '<span class="ltempo-dia-dow">' + D().diaDaSemana(d.dia) + '</span>'
      +     '<span class="ltempo-dia-stats">' + retrato
      +       (d.eventos ? barra
            + '<span class="ltempo-ganhas">+' + D().numero(d.ganhas || 0) + '</span>'
            + '<span class="ltempo-perdidas">−' + D().numero(d.perdidas || 0) + '</span>'
            + '<span class="ltempo-fraco">' + D().numero(d.eventos) + ' mudanças</span>'
            : '<span class="ltempo-fraco">nenhuma mudança</span>')
      +     '</span>'
      +   '</div>' + lista
      + '</div>';
  }

  function html(estado) {
    const j = estado.janela;
    const eixo = (j && j.eixo) || [];
    if (!eixo.length) return '<p class="ltempo-msg">Sem dias na janela.</p>';

    const porDia = {};
    (j.renomeios || []).forEach(r => { (porDia[r.dia] = porDia[r.dia] || []).push(r); });

    // O marco de início do histórico vai LOGO ABAIXO do cartão do próprio dia
    // em que o histórico começa — e não no rodapé da lista. Como a ordem é do
    // mais recente para o mais antigo, "abaixo" é justamente "antes", que é
    // onde a frase faz sentido. No rodapé ele ficaria embaixo de dias mais
    // antigos que ele, dizendo que não há informação logo acima de cartões
    // cheios de informação.
    const marcoInicio = '<div class="ltempo-marco">O histórico deste projeto começa em <b>'
      + D().escapar(j.historico_desde || '') + '</b>. Antes disso não há informação — '
      + 'não é que nada tenha acontecido.</div>';
    const dentroDaJanela = j.historico_desde && j.historico_desde >= eixo[0].dia
      && j.historico_desde <= eixo[eixo.length - 1].dia;

    // Do mais recente para o mais antigo — é a ordem em que se lê um diário.
    const cartoes = eixo.slice().reverse().map(d =>
      _cartao(estado, d, porDia[d.dia] || [])
      + (dentroDaJanela && d.dia === j.historico_desde ? marcoInicio : '')).join('');

    return '<div class="ltempo-feed-grade">'
      + '<div class="ltempo-rail">' + _miniCalendarios(eixo) + '</div>'
      + '<div class="ltempo-feed">' + cartoes + '</div>'
      + '</div>';
  }

  function ligar(raiz, estado, acoes) {
    raiz.querySelectorAll('.ltempo-dia[data-dia]').forEach(el => {
      const cab = el.querySelector('.ltempo-dia-cab');
      if (!cab) return;
      cab.addEventListener('click', () => {
        const dia = el.dataset.dia;
        // Dia capturado com zero mudanças não abre: abriria uma lista vazia, e
        // o cartão já diz "nenhuma mudança".
        if (!el.querySelector('.ltempo-dia-stats .ltempo-ganhas')) return;
        if (estado.selecao && estado.selecao.tipo === 'dia' && estado.selecao.dia === dia) {
          estado.selecao = null;
          estado.eventos = null;
          acoes.repintar();
          return;
        }
        acoes.selecionar({ tipo: 'dia', dia });
      });
    });
  }

  window.__ltempo.feed = { html, ligar };
})();
