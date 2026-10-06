// ═══════════ Linha do tempo — a barra de controles e os estados vazios ══
// Módulo irmão de index.js. Registra em `window.__ltempo.barra`.

(function () {
  window.__ltempo = window.__ltempo || {};
  const D = () => window.__ltempo.dados;

  const MODOS = [['editor', 'Linha do tempo'], ['feed', 'Feed'], ['faixa', 'Faixa']];
  const JANELAS = [[30, '30 dias'], [90, '90 dias'], [365, '1 ano']];
  const TIPOS = [['criado', 'Criados'], ['editado', 'Editados'],
                 ['apagado', 'Apagados'], ['movido', 'Movidos']];
  const PROFUNDIDADES = [['auto', 'automática'], ['1', '1 nível'], ['2', '2 níveis'],
                         ['3', '3 níveis'], ['4', '4 níveis'], ['completa', 'pasta completa']];

  function _pill(classe, itens, ativo, atributo) {
    const botoes = itens.map(([valor, rotulo]) =>
      '<button type="button" data-' + atributo + '="' + valor + '"'
      + (String(valor) === String(ativo) ? ' class="ativo"' : '') + '>'
      + D().escapar(rotulo) + '</button>').join('');
    return '<span class="ltempo-pill ' + classe + '">' + botoes + '</span>';
  }

  function html(estado) {
    const j = estado.janela;
    const combo = (estado.projetos || []).length
      ? '<label class="ltempo-combo">Projeto <select class="ltempo-projeto">'
        + estado.projetos.map(p => '<option value="' + D().escapar(p) + '"'
          + (p === estado.projeto ? ' selected' : '') + '>' + D().escapar(p) + '</option>').join('')
        + '</select></label>'
      : '';

    // O selo de idade não é enfeite: a captura é periódica (padrão 15 min), e
    // apresentar o dado como se fosse ao vivo seria mentira.
    const selo = j && j.atualizado_em
      ? '<span class="ltempo-selo">dado de ' + D().escapar(D().idade(j.atualizado_em)) + '</span>'
      : '';

    return ''
      + '<div class="ltempo-topo">'
      +   '<p class="ltempo-titulo">Linha do tempo</p>'
      +   '<div class="ltempo-ctrl">' + selo
      +     _pill('ltempo-modos', MODOS, estado.modo, 'modo')
      +     '<button type="button" class="btn btn-utility btn-sm ltempo-btn-opcoes">⚙ Opções</button>'
      +   '</div>'
      + '</div>'
      + '<div class="ltempo-ctrl">' + combo
      +   _pill('ltempo-janelas', JANELAS, estado.dias, 'dias')
      +   _pill('ltempo-tipos', [['', 'Tudo']].concat(TIPOS),
              estado.tipos.length === 1 ? estado.tipos[0] : '', 'tipo')
      +   '<input type="text" class="ltempo-busca" placeholder="filtrar por caminho…" '
      +     'value="' + D().escapar(estado.filtro) + '">'
      + '</div>'
      + '<div class="ltempo-opcoes ltempo-escondido">'
      +   '<label class="ltempo-combo">Agrupar as trilhas por '
      +     '<select class="ltempo-prof">'
      +       PROFUNDIDADES.map(([v, r]) => '<option value="' + v + '"'
            + (String(v) === String(estado.profundidade) ? ' selected' : '') + '>'
            + r + '</option>').join('')
      +     '</select></label>'
      +   (j ? '<span class="ltempo-selo">usando: ' + D().escapar(String(j.profundidade))
            + (j.outras && j.outras.pastas
               ? ' · ' + D().numero(j.outras.pastas) + ' pastas fora do teto de 15 trilhas' : '')
            + '</span>' : '')
      + '</div>';
  }

  // Estado vazio: o projeto existe, mas o Plugin base nunca capturou nada dele.
  // Não é erro — e a tela precisa dizer o que fazer, não só que não tem nada.
  function htmlSemDado(estado) {
    return '<div class="ltempo-vazio">'
      + '<h4>Ainda não há histórico deste projeto</h4>'
      + '<p>Quem grava o histórico é o <b>Plugin base</b>, e ele ainda não capturou '
      + '<b>' + D().escapar(estado.projeto || '') + '</b>. Ligue o Plugin base em '
      + 'Configurações › Plugins e clique em “Capturar agora” na sub-aba dele — a partir '
      + 'daí esta tela passa a mostrar o que muda a cada dia.</p></div>';
  }

  function ligar(raiz, estado, acoes, desligar) {
    const q = s => raiz.querySelector(s);
    const qa = s => Array.from(raiz.querySelectorAll(s));

    qa('.ltempo-modos button').forEach(b => b.addEventListener('click', () => {
      estado.modo = b.dataset.modo;
      // Trocar de modo não recarrega: a janela já está em memória, e os três
      // modos consomem a MESMA agregação. É o que justifica um plugin com três
      // modos em vez de três plugins.
      acoes.repintar();
    }));

    qa('.ltempo-janelas button').forEach(b => b.addEventListener('click', () => {
      estado.dias = Number(b.dataset.dias);
      acoes.recarregar();
    }));

    qa('.ltempo-tipos button').forEach(b => b.addEventListener('click', () => {
      estado.tipos = b.dataset.tipo ? [b.dataset.tipo] : [];
      // ⚠️ O filtro tem que voltar ao backend: ele muda a FORMA dos blocos
      // (cinco dias seguidos podem virar dois blocos separados), e filtrar
      // aqui no JS depois desenharia um bloco que não existe.
      acoes.recarregar();
    }));

    const busca = q('.ltempo-busca');
    if (busca) {
      let timer = null;
      const aoDigitar = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          estado.filtro = busca.value.trim();
          acoes.recarregar();
        }, 350);
      };
      busca.addEventListener('input', aoDigitar);
      desligar.push(() => clearTimeout(timer));
    }

    const prof = q('.ltempo-prof');
    if (prof) prof.addEventListener('change', () => {
      estado.profundidade = prof.value;
      acoes.recarregar();
    });

    const combo = q('.ltempo-projeto');
    if (combo) combo.addEventListener('change', () => acoes.trocarProjeto(combo.value));

    const btn = q('.ltempo-btn-opcoes');
    const painel = q('.ltempo-opcoes');
    if (btn && painel) btn.addEventListener('click', () => {
      painel.classList.toggle('ltempo-escondido');
    });
  }

  window.__ltempo.barra = { html, htmlSemDado, ligar };
})();
