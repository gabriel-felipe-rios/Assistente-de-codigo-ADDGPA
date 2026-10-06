// ═══════════ Linha do tempo — modo "Faixa" (barras divergentes) ══
// Módulo irmão de index.js. Registra em `window.__ltempo.faixa`.
//
// O mais barato dos três modos: consome só o `eixo` da janela, sem tocar nas
// trilhas. Responde "em que dias houve muito movimento".

(function () {
  window.__ltempo = window.__ltempo || {};
  const D = () => window.__ltempo.dados;

  function html(estado) {
    const j = estado.janela;
    const eixo = (j && j.eixo) || [];
    if (!eixo.length) return '<p class="ltempo-msg">Sem dias na janela.</p>';

    const comDado = eixo.filter(d => d.estado !== 'sem_captura');
    if (!comDado.length) {
      return '<p class="ltempo-msg">Nenhum dia com captura nesta janela. '
        + 'O histórico começa em ' + D().escapar(j.historico_desde || '—') + '.</p>';
    }

    const passo = estado.dias <= 30 ? 18 : (estado.dias <= 90 ? 8 : 3);
    const meia = 54, altura = meia * 2 + 6;
    const largura = eixo.length * passo;
    const maior = Math.max(1, ...comDado.map(d => Math.max(d.ganhas || 0, d.perdidas || 0)));
    const alt = v => (v > 0 ? Math.max(2, Math.round((v / maior) * (meia - 8))) : 0);

    const barras = eixo.map((d, i) => {
      const cx = i * passo + passo / 2;
      const w = Math.max(2, passo - 5);
      // ⚠️ Dia sem captura NÃO é coluna zerada: é "não sei". Vira um traço
      // apagado na linha-base, visualmente distinto de um zero de verdade.
      if (d.estado === 'sem_captura') {
        return '<rect class="ltempo-col" data-dia="' + d.dia + '" x="' + (cx - w / 2) + '" y="'
          + (meia - 1) + '" width="' + w + '" height="2" fill="rgba(var(--white-rgb),.16)">'
          + '<title>' + d.dia + ': sem captura</title></rect>';
      }
      const hg = alt(d.ganhas || 0), hp = alt(d.perdidas || 0);
      const dica = d.dia + ': +' + D().numero(d.ganhas || 0) + ' / −' + D().numero(d.perdidas || 0)
        + ' linhas · ' + D().numero(d.eventos || 0) + ' mudanças'
        + (d.desconhecidas ? ' (' + d.desconhecidas + ' não contabilizadas)' : '')
        + (d.estado === 'parcial' ? ' · retrato do dia desconhecido' : '');
      return ''
        + '<rect class="ltempo-col" data-dia="' + d.dia + '" x="' + (cx - w / 2) + '" y="' + (meia - hg)
        +   '" width="' + w + '" height="' + hg + '" rx="1" fill="var(--green)">'
        +   '<title>' + D().escapar(dica) + '</title></rect>'
        + '<rect class="ltempo-col" data-dia="' + d.dia + '" x="' + (cx - w / 2) + '" y="' + meia
        +   '" width="' + w + '" height="' + hp + '" rx="1" fill="var(--red)">'
        +   '<title>' + D().escapar(dica) + '</title></rect>';
    }).join('');

    // ⚠️ Ganhas e perdidas somadas SEPARADAS, nunca um líquido: o dia em que
    // se reescreve 3.000 linhas tem saldo zero e pareceria um dia parado.
    const ganhas = comDado.reduce((s, d) => s + (d.ganhas || 0), 0);
    const perdidas = comDado.reduce((s, d) => s + (d.perdidas || 0), 0);
    const semCaptura = eixo.length - comDado.length;

    const painel = window.__ltempo.painel.html(estado,
      estado.selecao ? estado.selecao.dia : '—',
      estado.selecao ? D().diaDaSemana(estado.selecao.dia) : 'clique numa coluna');

    return '<div class="ltempo-editor">'
      + '<div>'
      +   '<div class="ltempo-faixa"><div class="ltempo-rolagem">'
      +     '<svg class="ltempo-svg" width="' + largura + '" height="' + altura + '" '
      +       'viewBox="0 0 ' + largura + ' ' + altura + '">'
      +       '<line x1="0" y1="' + meia + '" x2="' + largura + '" y2="' + meia
      +         '" stroke="rgba(var(--white-rgb),.18)"/>' + barras
      +     '</svg></div>'
      +     '<div class="ltempo-eixo"><span>' + D().escapar(eixo[0].dia) + '</span>'
      +       '<span><b class="ltempo-ganhas">+' + D().numero(ganhas) + '</b> / '
      +       '<b class="ltempo-perdidas">−' + D().numero(perdidas) + '</b> linhas em '
      +       D().numero(comDado.length) + ' dias com captura</span>'
      +       '<span>' + D().escapar(eixo[eixo.length - 1].dia) + '</span></div>'
      +   '</div>'
      +   (semCaptura ? '<p class="ltempo-legenda">' + D().numero(semCaptura) + ' dos '
          + D().numero(eixo.length) + ' dias não tiveram captura — traço apagado na base, '
          + 'que é diferente de um dia com zero mudanças.</p>' : '')
      + '</div>' + painel + '</div>';
  }

  function ligar(raiz, estado, acoes) {
    raiz.querySelectorAll('.ltempo-col').forEach(el => {
      el.addEventListener('click', () => {
        acoes.selecionar({ tipo: 'dia', dia: el.dataset.dia });
      });
    });
  }

  window.__ltempo.faixa = { html, ligar };
})();
