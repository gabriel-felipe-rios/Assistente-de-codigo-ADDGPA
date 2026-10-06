// ═══════════ Linha do tempo — o painel da direita (os arquivos) ══
// Módulo irmão de index.js. Registra em `window.__ltempo.painel`.
//
// É onde o detalhe mora, para a trilha ficar limpa: a trilha responde "em que
// pasta, e quando"; o painel responde "quais arquivos".

(function () {
  window.__ltempo = window.__ltempo || {};
  const D = () => window.__ltempo.dados;

  function _itens(eventos) {
    return eventos.map(ev => ''
      + '<li>'
      +   '<span class="linha1">'
      +     '<span class="ltempo-tag ltempo-tag-' + D().escapar(ev.tipo) + '">'
      +       D().escapar(ev.tipo) + '</span>'
      +     D().medidaDoEvento(ev)
      +     (ev.dia ? '<span class="ltempo-fraco">' + D().escapar(ev.dia) + '</span>' : '')
      +     D().marcaDeOrigem(ev)
      +   '</span>'
      +   '<span class="ltempo-mono ltempo-fraco" title="' + D().escapar(D().caminhoDoEvento(ev)) + '">'
      +     (ev.tipo === 'movido'
              ? D().escapar(D().nomeCurto(ev.de)) + ' → ' + D().escapar(D().nomeCurto(ev.para))
              : D().escapar(D().nomeCurto(ev.caminho)))
      +   '</span>'
      + '</li>').join('');
  }

  // `titulo`/`sub` mudam conforme a seleção seja um bloco (uma pasta ao longo
  // de vários dias) ou um dia inteiro (o que a agulha aponta).
  function html(estado, titulo, sub) {
    let corpo;
    if (!estado.selecao) {
      corpo = '<p class="ltempo-msg" style="padding:12px 14px">Clique num bloco, ou arraste a '
        + 'agulha, para ver os arquivos.</p>';
    } else if (estado.carregandoEventos) {
      corpo = '<p class="ltempo-msg" style="padding:12px 14px">Carregando…</p>';
    } else if (!estado.eventos || !estado.eventos.length) {
      corpo = '<p class="ltempo-msg" style="padding:12px 14px">Nenhuma mudança aqui.</p>';
    } else {
      corpo = '<ul>' + _itens(estado.eventos) + '</ul>';
    }
    return '<div class="ltempo-painel">'
      + '<div class="ltempo-painel-cab">'
      +   '<b class="ltempo-mono">' + D().escapar(titulo || '—') + '</b>'
      +   '<div class="ltempo-painel-sub">' + (sub || '') + '</div>'
      + '</div>' + corpo + '</div>';
  }

  window.__ltempo.painel = { html };
})();
