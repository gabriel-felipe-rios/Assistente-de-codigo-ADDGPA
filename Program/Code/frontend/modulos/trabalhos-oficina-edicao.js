// ═══ TRABALHOS → Oficina: EDITAR O QUE ESTÁ DENTRO DE UM NÓ ═══════════════
//
// Renomear no lugar com dois cliques, editar o texto da nota, puxar uma ligação
// arrastando de uma alça, e a pega que redimensiona a caixa ou o corpo da letra.
//
// A divisa com `trabalhos-oficina-acoes.js`: **lá se mexe no conjunto, aqui se
// mexe no conteúdo de UM.**
//
// ⚠️ NADA DE `prompt()`, EM LUGAR NENHUM DESTE ARQUIVO. O diálogo nativo do
// WebView2 aparece como "Esta página diz…", trava a janela inteira e não tem
// como mostrar mais de um campo. Toda edição aqui é no lugar (contenteditable)
// ou por modal do próprio programa.
//
// ⚠️ SAIR SEM CONFIRMAR DESCARTA. A edição no lugar grava no Enter e no blur
// intencional; abandonar o gesto é o mesmo que Esc. Gravar em silêncio o que
// ficou meio digitado seria pior que perder o gesto — e essa escolha é a mesma
// em todos os campos daqui.
//
// ⚠️ A PEGA TEM DOIS SIGNIFICADOS no mesmo canto, e é de propósito: ela estica a
// caixa, e com o modificador ela muda o corpo da letra. Ver `ofiFonteDe` e os
// tetos `OFI_FONTE_MIN`/`OFI_FONTE_MAX`, que moram na casca.

// ── Renomear no lugar, com dois cliques ─────────────────────────────────────
//
// ⚠️ NADA DE `prompt()`. O diálogo nativo do WebView2 aparece como "Esta página
// diz", com a tipografia e os botões do navegador — quebra o desenho do
// programa inteiro, e ainda escurece a tela para pedir uma palavra. Editar no
// lugar é o gesto que o usuário já espera de um canvas.

// ⚠️ O PONTO DE COR DO NÓ PRECISA DA PRÓPRIA FIAÇÃO. O do GRUPO já tinha a
// dele (em `ofiLigarGrupos`), e a semelhança esconde a diferença: são duas
// camadas de DOM distintas, refeitas em momentos distintos. O `data-cor-de` do
// nó chegou a ser emitido por `ofiDesenharNo` sem ninguém escutar — e uma
// bolinha que existe, tem cursor de mãozinha e não faz nada é pior que bolinha
// nenhuma.
function ofiLigarPontosDeCor() {
  document.querySelectorAll('#ofi-nos [data-cor-de]').forEach(ponto => {
    ponto.addEventListener('click', e => {
      // Sem isto o clique sobe para o cartão e vira seleção/arraste, e a paleta
      // abre e fecha no mesmo gesto.
      e.stopPropagation();
      ofiAbrirPaleta(ponto, [ponto.dataset.corDe]);
    });
    ponto.addEventListener('mousedown', e => e.stopPropagation());
  });
}

function ofiLigarEdicao() {
  document.querySelectorAll('#ofi-nos .ofi-editavel').forEach(el => {
    // Sem isto, os dois cliques em cima do nome começam a arrastar o cartão.
    el.addEventListener('mousedown', e => { if (e.detail > 1) e.stopPropagation(); });
    el.addEventListener('dblclick', e => {
      e.stopPropagation();
      ofiEditarNoLugar(el, el.dataset.no, el.dataset.editar);
    });
  });

  // O cartão INTEIRO da nota abre o texto dela. Os dois cliques em cima do
  // título já foram capturados acima (com `stopPropagation`), então este só
  // recebe o que sobrou — a margem, o espaço vazio e o texto ainda inexistente
  // de uma nota recém-criada.
  //
  // ⚠️ NOTA NÃO USA `ofiEditarNoLugar`, e a diferença é do desenho dela: o que
  // se vê é markdown RENDERIZADO, e deixar o usuário digitar por cima de HTML já
  // renderizado devolveria as tags dentro do texto. `ofiEditarNota` troca o
  // corpo por um `<textarea>` com o texto CRU — é o mesmo papel, virado do
  // avesso.
  document.querySelectorAll('#ofi-nos [data-nota]').forEach(cartao => {
    cartao.addEventListener('dblclick', e => {
      if (e.target.closest('.ofi-alca, .ofi-pega, .ofi-editavel, .ofi-ponto-cor')) return;
      ofiEditarNota(cartao.dataset.nota);
    });
  });
}

function ofiEditarNoLugar(el, idNo, campo) {
  if (el.isContentEditable) return;
  const original = el.textContent.trim();
  el.contentEditable = 'plaintext-only';
  el.classList.add('ofi-editando');
  el.focus();
  // ⚠️ SELECIONAR TUDO SÓ EM CAMPO DE UMA LINHA. Renomear um terminal quase
  // sempre troca o nome inteiro, e ali "tudo selecionado" ajuda. Num NÓ DE
  // TEXTO não: quem abre um parágrafo escrito quer mexer num ponto dele, e a
  // primeira tecla apagava o parágrafo todo. O duplo clique já deixou a PALAVRA
  // selecionada, que é o que qualquer editor faz.
  const ehTexto = (ofiNos.find(n => n.id === idNo) || {}).tipo === 'texto';
  if (!ehTexto) document.getSelection().selectAllChildren(el);

  // ⚠️ ENQUANTO EDITA, O CLIQUE É DO CURSOR, NÃO DO ARRASTE. Sem isto o
  // `mousedown` sobe para o cartão e começa a arrastar o nó — e o cursor nunca
  // chega ao caractere clicado. Era o "clico no meio do texto e ele não para
  // ali; tenho que usar a setinha".
  const segurarClique = ev => { if (el.isContentEditable) ev.stopPropagation(); };
  el.addEventListener('mousedown', segurarClique);

  const fechar = async (gravar) => {
    el.contentEditable = 'false';
    el.classList.remove('ofi-editando');
    const valor = el.textContent.trim();
    if (!gravar || valor === original) { el.textContent = original; ofiDesenhar(); return; }
    const r = await window.pywebview.api.editar_no(currentProject, idNo, { [campo]: valor });
    if (!r.success) { showToast(r.error, true); }
    ofiCarregar();
  };
  el.addEventListener('keydown', ev => {
    ev.stopPropagation();
    // ⚠️ NO NÓ DE TEXTO, ENTER QUEBRA A LINHA — e é Ctrl+Enter que grava. Ele
    // é um bloco de texto de várias linhas (o CSS dele já é `pre-wrap`), e um
    // Enter que confirma torna a quebra de linha impossível de digitar. Em
    // campo de UMA linha (o nome de um terminal, o título de uma nota) Enter
    // grava, que é o que se espera de um campo de nome.
    if (ev.key === 'Enter') {
      if (ehTexto && !(ev.ctrlKey || ev.metaKey)) return;   // deixa quebrar
      ev.preventDefault(); el.blur();
      return;
    }
    if (ev.key === 'Escape') { ev.preventDefault(); fechar(false); }
  });
  el.addEventListener('blur', () => fechar(true), { once: true });
}

// ── Redimensionar ───────────────────────────────────────────────────────────

// ⚠️ O PASSO É PROPORCIONAL, e não fixo. Somar 1 px de letra por pixel de
// arraste dá um salto brutal numa letra de 12 e um passo imperceptível numa de
// 90 — a mesma razão pela qual o zoom do palco é multiplicativo. Dividir por 6
// dá um gesto que rende em toda a faixa.
function ofiFonteDe(base, delta) {
  return Math.min(OFI_FONTE_MAX, Math.max(OFI_FONTE_MIN, Math.round(base + delta / 6)));
}

function ofiLigarAlcas() {
  document.querySelectorAll('#ofi-nos [data-alca]').forEach(alca => {
    alca.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      // Sem `stopPropagation` o mesmo mousedown começaria a arrastar o cartão.
      e.preventDefault();
      e.stopPropagation();
      ofiIniciarLigacaoPorArraste(e, alca.dataset.alca, alca.dataset.lado);
    });
  });
}

function ofiIniciarLigacaoPorArraste(e, idOrigem, lado) {
  const svg = document.getElementById('ofi-fios');
  const caixas = ofiCaixasDosNos();
  const origem = caixas[idOrigem];
  if (!origem || !svg) return;
  // ⚠️ O FIO NASCE NA BOLINHA QUE FOI PUXADA, e não sempre na direita. São
  // quatro alças (cima, direita, baixo, esquerda) e o `data-lado` de cada uma
  // dizia qual era — mas quem começava o arraste ignorava o dado e ancorava
  // fixo em `x + w`. Puxando pela alça da esquerda, o tracejado brotava do
  // outro lado do cartão e atravessava por dentro dele: parecia que a bolinha
  // não tinha "pegado" o gesto.
  const partida = {
    cima:  { x: origem.x + origem.w / 2, y: origem.y },
    baixo: { x: origem.x + origem.w / 2, y: origem.y + origem.h },
    esq:   { x: origem.x,                y: origem.y + origem.h / 2 },
    dir:   { x: origem.x + origem.w,     y: origem.y + origem.h / 2 },
  }[lado] || { x: origem.x + origem.w, y: origem.y + origem.h / 2 };
  const provisorio = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  provisorio.setAttribute('class', 'ofi-fio ofi-fio-provisorio');
  provisorio.setAttribute('x1', partida.x);
  provisorio.setAttribute('y1', partida.y);
  svg.appendChild(provisorio);

  // Destaca quem está debaixo do cursor: sem isso, largar num ponto entre dois
  // cartões parece que funcionou e não liga nada.
  let alvoAtual = null;
  const marcar = el => {
    if (alvoAtual === el) return;
    if (alvoAtual) alvoAtual.classList.remove('ofi-alvo');
    alvoAtual = el;
    if (alvoAtual) alvoAtual.classList.add('ofi-alvo');
  };

  function noSob(e2) {
    // `elementFromPoint` e não `e.target`: durante um arraste o alvo do evento
    // continua sendo quem recebeu o mousedown, não quem está sob o cursor.
    const el = document.elementFromPoint(e2.clientX, e2.clientY);
    const no = el && el.closest('.ofi-no');
    return no && no.dataset.id !== idOrigem ? no : null;
  }

  function mover(e2) {
    const ponta = ofiParaMundo(e2.clientX, e2.clientY);
    provisorio.setAttribute('x2', ponta.x);
    provisorio.setAttribute('y2', ponta.y);
    marcar(noSob(e2));
  }
  function soltar(e2) {
    document.removeEventListener('mousemove', mover);
    document.removeEventListener('mouseup', soltar);
    provisorio.remove();
    const alvo = noSob(e2);
    marcar(null);
    // Ancorado NO NÓ EM QUE SE SOLTOU: é onde a mão do usuário parou, e é o
    // ponto que ele está olhando quando o seletor aparece.
    if (alvo) ofiPopoverDeLigacao(idOrigem, alvo.dataset.id, false, alvo);
  }
  mover(e);
  document.addEventListener('mousemove', mover);
  document.addEventListener('mouseup', soltar);
}

// ── Editar a nota ───────────────────────────────────────────────────────────

function ofiEditarNota(idNo) {
  const cartao = document.querySelector(`#ofi-nos [data-nota="${idNo}"]`);
  const corpo = cartao && cartao.querySelector('[data-nota-corpo]');
  const no = ofiNos.find(n => n.id === idNo);
  if (!corpo || !no || corpo.querySelector('textarea')) return;

  const original = no.texto || '';
  corpo.innerHTML = '';
  const campo = document.createElement('textarea');
  campo.className = 'ofi-nota-editor';
  campo.value = original;
  campo.spellcheck = false;
  corpo.appendChild(campo);

  // ⚠️ A ALTURA É DADA AQUI, e o CSS sozinho não resolve. Numa nota SEM
  // tamanho escolhido, o corpo tem altura de conteúdo, e um `height: 100%`
  // dentro de um pai de altura automática vira `auto` — o campo encolhia para o
  // `min-height` e escondia tudo menos as últimas linhas. `scrollHeight` é a
  // altura que o texto REALMENTE ocupa; o `max` com o corpo cobre o caso
  // contrário, a nota grande com texto curto, em que o campo tem de ocupar a
  // nota inteira para o clique cair nele.
  const folga = Math.max(corpo.clientHeight, 60);
  campo.style.height = 'auto';
  campo.style.height = Math.max(folga, campo.scrollHeight) + 'px';

  campo.focus();
  // O cursor no FIM, e não com tudo selecionado: quem abre uma nota escrita
  // quase sempre quer acrescentar, e "tudo selecionado" apaga o que ela tem na
  // primeira tecla.
  campo.setSelectionRange(campo.value.length, campo.value.length);
  // Rolar para o TOPO depois de pôr o cursor no fim: numa nota que não cabe, o
  // navegador rola até o cursor, e quem acabou de abrir quer ver o começo.
  campo.scrollTop = 0;
  campo.addEventListener('input', () => {
    campo.style.height = 'auto';
    campo.style.height = Math.max(folga, campo.scrollHeight) + 'px';
  });

  let fechado = false;
  const fechar = async gravar => {
    if (fechado) return;
    fechado = true;
    const valor = campo.value;
    if (!gravar || valor === original) { ofiDesenhar(); return; }
    const r = await window.pywebview.api.editar_no(currentProject, idNo, { texto: valor });
    if (!r.success) showToast(r.error, true);
    ofiCarregar();
  };
  campo.addEventListener('keydown', ev => {
    ev.stopPropagation();
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault(); fechar(true);
    }
    if (ev.key === 'Escape') { ev.preventDefault(); fechar(false); }
  });
  campo.addEventListener('blur', () => fechar(true), { once: true });
  // Sem isto, arrastar para selecionar texto dentro do campo arrasta o cartão.
  campo.addEventListener('mousedown', ev => ev.stopPropagation());
}

// ── A pega: redimensionar a caixa, ou o corpo da letra ──────────────────────

function ofiLigarPegas() {
  document.querySelectorAll('#ofi-nos [data-pega]').forEach(pega => {
    pega.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();   // senão arrasta o nó junto
      const el = pega.closest('.ofi-no');
      const eTexto = pega.dataset.pegaTipo === 'texto';
      const partiu = {
        x: e.clientX, y: e.clientY, w: el.offsetWidth, h: el.offsetHeight,
        f: parseFloat(getComputedStyle(el).fontSize) || 14,
      };
      const mover = e2 => {
        // Dividido pelo zoom: em 50%, 10px de tela são 20px de mundo — sem
        // dividir, a borda foge do ponteiro.
        const dx = (e2.clientX - partiu.x) / ofiZoom;
        const dy = (e2.clientY - partiu.y) / ofiZoom;
        if (eTexto) {
          // As duas direções somam porque a pega é de CANTO: arrastar na
          // diagonal para fora é o gesto de "aumenta", e olhar só um eixo faria
          // metade do movimento não fazer nada.
          el.style.fontSize = ofiFonteDe(partiu.f, dx + dy) + 'px';
        } else {
          el.style.width = Math.max(120, partiu.w + dx) + 'px';
          el.style.height = Math.max(48, partiu.h + dy) + 'px';
          // O terminal precisa saber que a caixa mudou, e o backend precisa
          // reformatar o que roda lá dentro. `trShDimensionar` já sai fora
          // quando o número de células não mudou, então chamar por quadro de
          // arraste é barato.
          if (typeof trShDimensionar === 'function') trShDimensionar(el.dataset.id);
        }
        ofiPedirCamadas();
      };
      const soltar = async () => {
        document.removeEventListener('mousemove', mover);
        document.removeEventListener('mouseup', soltar);
        const campos = eTexto
          ? { fonte: Math.round(parseFloat(el.style.fontSize) || partiu.f) }
          : { largura: Math.round(el.offsetWidth), altura: Math.round(el.offsetHeight) };
        const r = await window.pywebview.api.editar_no(currentProject, pega.dataset.pega, campos);
        if (!r.success) showToast(r.error, true);
        ofiCarregar();
      };
      document.addEventListener('mousemove', mover);
      document.addEventListener('mouseup', soltar);
    });
  });
}

// ── O que faltou, reescrito na recuperação ──────────────────────────────────
//
// ⚠️ TUDO DAQUI PARA BAIXO FOI REESCRITO, e não recuperado. O contrato de cada
// uma saiu de quem as chama; o corpo é novo. É aqui que vale desconfiar
// primeiro se algum comportamento da Oficina parecer diferente do que era.

// Redesenha as camadas que dependem da POSIÇÃO dos nós (fios e caixas de
// grupo), sem refazer os nós. Agrupado num quadro de animação porque um arraste
// dispara isto a cada movimento do mouse.
function ofiPedirCamadas() {
  if (ofiFiosPedidos) return;
  ofiFiosPedidos = requestAnimationFrame(() => {
    ofiFiosPedidos = null;
    const caixas = ofiCaixasDosNos();
    ofiDesenharFios(caixas);
    ofiDesenharGrupos(caixas);
  });
}

// Os grupos que a seleção atual toca — é o que habilita "Desagrupar".
function ofiGruposDaSelecao() {
  const ids = new Set();
  ofiNos.forEach(n => { if (ofiSelecao.has(n.id) && n.grupo) ids.add(n.grupo); });
  return ofiGrupos.filter(g => ids.has(g.id));
}

// O popover que pergunta QUAL tipo de ligação, quando se solta um fio num nó.
//
// ⚠️ A ASSINATURA É `(de, para, inverso, ancora)`, NESTA ORDEM. Quem chama é
// `ofiIniciarLigacaoPorArraste`, e ele passa os dois ids primeiro e o ELEMENTO
// por último. Uma versão com `(ancora, callback)` recebia um id de texto onde
// esperava um elemento, estourava no `getBoundingClientRect`, e o sintoma era
// "arrasto de um nó ao outro e nada liga" — sem erro na tela.
// ⚠️ CADA OPÇÃO MOSTRA O TRAÇO QUE ELA VAI DESENHAR. Antes vinha uma bolinha
// com a inicial do tipo (`D`, `M`, `I`), pintada com `t.cor` — e `cor` NÃO
// EXISTE no catálogo (`catalogo_trabalhos.py::TIPOS_DE_LIGACAO` tem `traco`,
// não `cor`). As opções saíam todas cinza-iguais, e a pessoa escolhia entre
// setas diferentes sem ver nenhuma delas.
//
// As classes `.ofi-lig-op-traco` e as três variantes já existiam em
// `trabalhos.css` e não eram emitidas por ninguém — o comentário delas diz,
// desde sempre, que a amostra é o mesmo desenho do fio no canvas.
function ofiPopoverDeLigacao(de, para, inverso, ancora) {
  const a = inverso ? para : de;
  const b = inverso ? de : para;
  const pop = ofiAbrirPopover(ancora, `
    <div class="ofi-popover-t">Que tipo de ligação</div>
    <div class="ofi-lig-ops">
      ${ofiTiposDeLigacao.map(t => `
        <button type="button" class="ofi-lig-op" data-tipo="${escapeHtml(t.id)}">
          <span class="ofi-lig-op-traco ofi-lig-op-${escapeHtml(t.id)}"></span>
          <span class="ofi-lig-op-txt">
            <b>${escapeHtml(t.rotulo || t.id)}</b>
            <small>${escapeHtml(t.descricao || t.dica || '')}</small>
          </span>
        </button>`).join('')}
    </div>
    <div class="ofi-popover-nota">De <b>${escapeHtml(ofiNomeDoNo(a))}</b> para
      <b>${escapeHtml(ofiNomeDoNo(b))}</b>.</div>`);

  pop.querySelectorAll('[data-tipo]').forEach(botao =>
    botao.addEventListener('click', async () => {
      ofiFecharPopover();
      const r = await window.pywebview.api.conectar_nos(currentProject, botao.dataset.tipo, a, b);
      if (!r.success) { showToast(r.error, true); return; }
      ofiSelecao.clear();
      ofiCarregar();
    }));
}

// ⚠️ SOBRA DA VERSÃO ANTIGA. O nó de terminal já não tem log próprio — quem
// pinta a tela dele é o xterm.js, em `trabalhos-shell.js`. Esta função existe
// só porque um ponto do código ainda a chama; ela redireciona para o dono atual
// em vez de fingir que ainda há um log para recarregar.
function ofiRecarregarLog() {
  if (typeof ofiLigarShells === 'function') ofiLigarShells();
}

// Faz tudo caber na tela. Mede a extensão ocupada pelos nós e escolhe o zoom e
// o deslocamento que põem esse retângulo inteiro dentro do canvas.
function ofiEnquadrar() {
  const canvas = document.getElementById('ofi-canvas');
  if (!canvas || !ofiNos.length) return;
  const caixas = ofiCaixasDosNos();
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  Object.values(caixas).forEach(c => {
    x1 = Math.min(x1, c.x); y1 = Math.min(y1, c.y);
    x2 = Math.max(x2, c.x + c.w); y2 = Math.max(y2, c.y + c.h);
  });
  if (!isFinite(x1)) return;
  const folga = 40;
  const k = Math.min(
    (canvas.clientWidth - folga * 2) / Math.max(1, x2 - x1),
    (canvas.clientHeight - folga * 2) / Math.max(1, y2 - y1));
  ofiZoom = Math.max(OFI_ZOOM_MIN, Math.min(OFI_ZOOM_MAX, k));
  ofiPan.x = folga - x1 * ofiZoom;
  ofiPan.y = folga - y1 * ofiZoom;
  // Fator 1: o zoom já foi escolhido acima, aqui só se pede o redesenho. Ele
  // não pode ancorar em ponto nenhum, senão desfaz o `ofiPan` recém-calculado.
  ofiAplicarZoom(1);
}
