// ══════════════════════════════════ COMPONENTE: MENU DE CONTEXTO ══
// O menu que abre no botão direito, posicionado no cursor. Nasceu na aba Editor
// e já nasce compartilhado — era o primeiro do programa, e a próxima tela que
// precisar não deve escrever o segundo.
//
// ⚠️ CLASSE PRÓPRIA (`.menu-ctx`), E NÃO `.dropdown-menu`. Há um ouvinte global
// em `app.js:81` que esconde TODO `.dropdown-menu` a cada clique no documento.
// Reusar aquela classe daria o "fechar ao clicar fora" de graça e cobraria caro:
// o menu fecharia antes de o clique no próprio item ser processado. Com classe
// própria, o ouvinte global não o alcança — e este componente instala os
// fechadores dele, que é o que permite tratar o clique de dentro.
//
// ⚠️ TODO OUVINTE QUE ELE INSTALA, ELE REMOVE. Um `document.addEventListener`
// esquecido a cada abertura é o defeito clássico deste componente: depois de
// cinquenta menus a página fica com cinquenta ouvintes de rolagem e engasga.
// `_mctxFechar` é o único caminho de saída, e ele desfaz tudo.

let _mctxAberto = null;      // { elemento, desligar, aoFechar }

function _mctxFechar() {
  if (!_mctxAberto) return;
  const { elemento, desligar, aoFechar } = _mctxAberto;
  _mctxAberto = null;        // antes de tudo: `aoFechar` pode reabrir o menu
  desligar();
  elemento.remove();
  if (aoFechar) aoFechar();
}

function _mctxLinha(item) {
  if (item.separador) {
    const hr = document.createElement('div');
    hr.className = 'menu-ctx-sep';
    return hr;
  }
  if (item.grupo) {
    const g = document.createElement('div');
    g.className = 'menu-ctx-grupo';
    g.textContent = item.grupo;
    return g;
  }
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'menu-ctx-item'
    + (item.perigo ? ' menu-ctx-perigo' : '')
    + (item.ativo === false ? ' menu-ctx-inerte' : '');
  b.disabled = item.ativo === false;
  // ⚠️ ITEM DE EXTENSÃO LEVA A MARCA DE ORIGEM, e quem a põe é o PROGRAMA —
  // `xtEncaixeItens` carimbou `_xtDe` com o slug de quem mandou o item.
  //
  // Sem isto o "Destacar extensões" não acendia NADA de uma extensão que só
  // acrescenta item de menu, que é o caso da maioria delas: no ponto 'painel'
  // o destaque pega no `<div>` que o programa cria, mas em 'itens' não há
  // `<div>` — quem desenha é este componente, e é aqui que a marca cabe.
  if (item._xtDe) {
    b.dataset.origem = 'extensao';
    b.dataset.xt = item._xtDe;
  }
  // `title` no item desabilitado é obrigatório: um item cinza sem explicação
  // não ensina nada. Quem não se aplica ao alvo não entra na lista — cinza é
  // só para "se aplica, mas não agora".
  if (item.motivo) b.title = item.motivo;
  b.innerHTML = `<span class="menu-ctx-icone">${item.icone ? escapeHtml(item.icone) : ''}</span>`
    + `<span class="menu-ctx-rotulo">${escapeHtml(item.rotulo)}</span>`
    + `<span class="menu-ctx-atalho">${item.atalho ? escapeHtml(item.atalho) : ''}</span>`;
  if (item.ativo !== false) {
    b.addEventListener('click', () => {
      _mctxFechar();
      // Depois de fechar: a ação pode abrir um modal, e o menu por cima dele
      // ficaria preso.
      if (!item.fazer) return;
      // ⚠️ Um item de EXTENSÃO roda protegido, com o nome dela no erro — era
      // a única ponta em que código de terceiro executava sem `try`, e um
      // `fazer` que lançasse virava um erro sem dono no console.
      if (!item._xtDe) { item.fazer(); return; }
      try {
        const r = item.fazer();
        if (r && typeof r.catch === 'function') {
          r.catch((e) => console.error(`[extensoes] o item "${item.rotulo}" de ${item._xtDe} falhou:`, e));
        }
      } catch (e) {
        console.error(`[extensoes] o item "${item.rotulo}" de ${item._xtDe} falhou:`, e);
      }
    });
  }
  return b;
}

// ⚠️ AS EXTENSÕES ENTRAM AQUI, no componente, e não em cada chamador. Há
// quatro lugares que abrem menu de contexto hoje e haverá mais; espalhar a
// consulta por eles seria garantir que o quinto esqueça. Quem chama só diz
// em que `ponto` está, e ganha os itens de extensão de graça.
//
// Os itens da extensão vão para o FIM, depois de um separador, e nunca no
// meio: o menu nativo tem uma ordem pensada, e uma extensão que se
// intercalasse nela mudaria a posição de itens que o usuário já sabe de cor.
//
// ⚠️ E CADA EXTENSÃO GANHA UM TÍTULO com o nome dela acima dos itens dela —
// como o VS Code escreve o dono na frente do comando —, quando o interruptor
// "No menu de contexto, um título com o nome da extensão…" (Configurações ›
// Acesso rápido) está ligado. É o título de grupo que o componente já
// desenha (`.menu-ctx-grupo`); o nome vem do manifesto, pelo `_xtDe` que
// `xtEncaixeItens` carimbou. Quem põe é o PROGRAMA: a extensão não escreve
// o próprio nome nos itens.
function _mctxComExtensoes(itens, ponto, contexto) {
  const proprios = (itens || []).filter(Boolean);
  if (!ponto || typeof xtEncaixeItens !== 'function') return proprios;
  const deExtensao = _mctxComTitulos(xtEncaixeItens(ponto, contexto));
  if (!deExtensao.length) return proprios;
  return proprios.length ? [...proprios, { separador: true }, ...deExtensao] : deExtensao;
}

function _mctxComTitulos(deExtensao) {
  const ligado = (typeof appSettings !== 'undefined' && appSettings
    && appSettings.menu_contexto_titulo_extensao)
    ?? (typeof MENU_CONTEXTO_TITULO_EXTENSAO_PADRAO !== 'undefined'
        ? MENU_CONTEXTO_TITULO_EXTENSAO_PADRAO : true);
  if (!ligado || !deExtensao.length) return deExtensao;
  const ligadas = (typeof xtLigadas === 'function') ? xtLigadas() : [];
  const saida = [];
  let ultimo = null;
  deExtensao.forEach((item) => {
    const slug = item._xtDe || '';
    if (slug && slug !== ultimo) {
      const folha = ligadas.find((f) => f.slug === slug);
      saida.push({ grupo: (folha && folha.nome) || slug });
      ultimo = slug;
    }
    saida.push(item);
  });
  return saida;
}

// eslint-disable-next-line no-unused-vars
function abrirMenuDeContexto({ x, y, itens, aoFechar, ponto, contexto }) {
  _mctxFechar();
  // ⚠️ A LISTA VAZIA NÃO ABRE MENU. Antes da Obra 2 essa guarda vivia em cada
  // chamador (`if (itens && itens.length)`), e ela não podia continuar lá: só
  // aqui dentro se sabe se alguma EXTENSÃO tem item para este alvo, e um alvo
  // sem item nativo pode ter item de extensão. A guarda subiu para cá, e o
  // chamador passou a poder chamar sempre.
  const linhas = _mctxComExtensoes(itens, ponto, contexto);
  if (!linhas.length) return null;

  const el = document.createElement('div');
  el.className = 'menu-ctx';
  linhas.forEach((i) => { if (i) el.appendChild(_mctxLinha(i)); });

  // ⚠️ Medir ANTES de mostrar. Anexar visível e corrigir a posição depois faz o
  // menu piscar no canto errado — dá para ver, e parece defeito.
  el.style.visibility = 'hidden';
  document.body.appendChild(el);
  const { width, height } = el.getBoundingClientRect();
  const margem = 8;
  let esq = x;
  let topo = y;
  // Perto da borda, o menu VIRA para o outro lado do cursor em vez de só
  // encostar: encostado, ele cobriria justamente o item clicado.
  if (esq + width > window.innerWidth - margem) esq = Math.max(margem, x - width);
  if (topo + height > window.innerHeight - margem) topo = Math.max(margem, y - height);
  el.style.left = `${esq}px`;
  el.style.top = `${topo}px`;
  el.style.visibility = 'visible';

  // Os fechadores. `capture: true` no pointerdown e no scroll para chegarem
  // antes de quem estiver ouvindo dentro da tela.
  const foraDoMenu = (e) => { if (!el.contains(e.target)) _mctxFechar(); };
  const naTecla = (e) => { if (e.key === 'Escape') { e.preventDefault(); _mctxFechar(); } };
  const noScroll = () => _mctxFechar();
  // Segundo botão direito reposiciona em vez de empilhar dois menus.
  const noContexto = (e) => { if (!el.contains(e.target)) _mctxFechar(); };

  document.addEventListener('pointerdown', foraDoMenu, true);
  document.addEventListener('keydown', naTecla);
  document.addEventListener('scroll', noScroll, true);
  document.addEventListener('contextmenu', noContexto, true);
  window.addEventListener('resize', noScroll);
  window.addEventListener('blur', noScroll);

  _mctxAberto = {
    elemento: el,
    aoFechar,
    desligar() {
      document.removeEventListener('pointerdown', foraDoMenu, true);
      document.removeEventListener('keydown', naTecla);
      document.removeEventListener('scroll', noScroll, true);
      document.removeEventListener('contextmenu', noContexto, true);
      window.removeEventListener('resize', noScroll);
      window.removeEventListener('blur', noScroll);
    },
  };
  return { fechar: _mctxFechar };
}

// Para quem precisa saber se há menu aberto (o Editor usa para não abrir dois).
// eslint-disable-next-line no-unused-vars
function menuDeContextoAberto() { return !!_mctxAberto; }
