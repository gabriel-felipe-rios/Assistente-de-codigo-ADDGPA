// ═══ TRABALHOS → Oficina: ARRASTAR E ESTICAR ══════════════════════════════
//
// O que acontece quando o gesto do mouse começa EM CIMA de alguma coisa: mover
// um nó, mover a caixa de um grupo, esticar a caixa por um dos lados.
//
// Um arquivo só para nó e grupo, e não dois, porque a mecânica é literalmente a
// mesma — capturar o `mousedown`, esperar passar do limiar, seguir o
// `mousemove` em coordenadas de mundo, gravar no `mouseup`. Dois arquivos
// repetiriam essa dança inteira, e é aí que um dos dois esquece de recalcular a
// filiação no fim.
//
// ⚠️ O LIMIAR (`OFI_LIMIAR_ARRASTE`) É O QUE SEPARA CLIQUE DE ARRASTE. Sem ele,
// um clique com dois pixels de tremida vira um arraste que grava posição nova —
// e o usuário vê o nó "andar sozinho" ao selecioná-lo.
//
// ⚠️ TODO GESTO QUE MEXE EM POSIÇÃO TERMINA RECALCULANDO A FILIAÇÃO
// (`ofiFiliacaoNova`, em `trabalhos-oficina-grupos.js`). Não é detalhe de
// arrumação: é o que faz um nó arrastado para dentro de uma caixa passar a ser
// membro dela. Um caminho de arraste que esqueça essa chamada deixa o nó
// visualmente dentro e logicamente fora.

// ── Eventos de cada nó ──────────────────────────────────────────────────────

function ofiLigarNos() {
  document.querySelectorAll('#ofi-mundo .ofi-no').forEach(el => {
    el.addEventListener('mousedown', e => {
      // Campo de entrada e botões não arrastam o nó.
      if (e.target.closest('input, button, textarea')) return;
      // ⚠️ SOBRE A TELA PRETA, O ARRASTO É DO TERMINAL — e é aqui que morava o
      // *"eu não consigo selecionar, eu tô movendo"*. O CSS já estava certo
      // (`.ofi-sh-xterm * { user-select: text }`) e `.ofi-sh-tela` já promete
      // com `cursor: text`; quem quebrava a promessa era esta linha, três
      // abaixo: o `preventDefault` do arrasto do nó matava a seleção antes de
      // o xterm ver o gesto.
      //
      // A barra de cima (`.ofi-term-cab`, com `cursor: grab`) continua
      // arrastando, e ela é o único jeito de mover um terminal — por isso a
      // pista visual dela não é enfeite.
      //
      // Mesmo desenho que a roda já usava: ver `ofiRodaEhDeOutro`.
      if (e.target.closest('[data-sh-tela]')) return;
      if (e.button !== 0) return;
      e.preventDefault();
      ofiIniciarArrasteDeNo(e, el);
    });
  });

  document.querySelectorAll('#ofi-mundo [data-entrada]').forEach(campo => {
    campo.addEventListener('keydown', async e => {
      if (e.key !== 'Enter') return;
      const texto = campo.value.trim();
      if (!texto) return;
      campo.value = '';
      await ofiFalarCom(campo.dataset.entrada, texto);
    });
  });

  document.querySelectorAll('#ofi-mundo [data-parar]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const r = await window.pywebview.api.parar_terminal(currentProject, btn.dataset.parar);
      if (!r.success) { showToast(r.error, true); return; }
      showToast(r.rodando ? 'Terminal parado.' : 'Não havia nada rodando.');
      ofiCarregar();
    });
  });

  // O log guardado volta ao reabrir a aba — um terminal que já trabalhou não
  // pode aparecer vazio só porque o usuário mudou de sub-aba e voltou.
  document.querySelectorAll('#ofi-mundo [data-log]').forEach(el => ofiRecarregarLog(el.dataset.log));
}

function ofiIniciarArrasteDeNo(e, el) {
  const id = el.dataset.id;

  // ⚠️ CTRL SOMA E TIRA DA SELEÇÃO, E É CTRL — NÃO SHIFT. O Shift já é o
  // modificador da roda (`if (!e.shiftKey && ofiRodaEhDeOutro(...))`, no
  // `wheel`), e empilhar um terceiro sentido nele faria o mesmo dedo pedir
  // coisas diferentes conforme onde o ponteiro estivesse. O próprio usuário se
  // corrigiu para Ctrl ao pedir isto.
  //
  // ⚠️ E CTRL+CLIQUE NÃO ARRASTA. Somar à seleção é um gesto de clique; sair
  // arrastando junto faria o nó recém-marcado se mexer pelo tremor da mão, e o
  // usuário não tem como saber que marcar e mover eram o mesmo gesto.
  ofiGrupoSel = null;          // pegar um nó tira a caixa da seleção
  if (e.ctrlKey || e.metaKey) {
    if (ofiSelecao.has(id)) ofiSelecao.delete(id);
    else ofiSelecao.add(id);
    ofiLigacaoSel = null;      // fio e nó não ficam selecionados ao mesmo tempo
    ofiDesenhar();             // já atualiza a barra contextual por dentro
    return;
  }

  // Arrastar um nó fora da seleção passa a seleção para ele — senão o usuário
  // move um nó e vê outros três se mexendo junto sem entender por quê.
  if (!ofiSelecao.has(id)) { ofiSelecao.clear(); ofiSelecao.add(id); ofiDesenhar(); }

  const alvos = [...ofiSelecao].map(i => ({
    id: i, el: document.querySelector(`#ofi-mundo .ofi-no[data-id="${i}"]`),
    no: ofiNos.find(n => n.id === i),
    // O nó de anotações é OUTRO elemento, e por isso não anda sozinho: ele pende
    // do agente, e só volta ao lugar no próximo redesenho. Sem esta linha, ele
    // fica parado enquanto o terminal se afasta — e o usuário vê a anotação
    // pendurada em outro nó qualquer até soltar o botão.
    anot: document.querySelector(`#ofi-nos .ofi-anotno[data-anot-de="${i}"]`),
  })).filter(a => a.el && a.no);
  const partiu = { x: e.clientX, y: e.clientY };
  let arrastou = false;

  function mover(e2) {
    const dx = (e2.clientX - partiu.x) / ofiZoom;
    const dy = (e2.clientY - partiu.y) / ofiZoom;
    if (!arrastou) {
      if (Math.abs(dx) + Math.abs(dy) < OFI_LIMIAR_ARRASTE / ofiZoom) return;
      arrastou = true;
      // ⚠️ SÓ O VIGIA DAS ANOTAÇÕES LÊ ISTO, e é o que o impede de chamar
      // `ofiCarregar` no meio do gesto: o redesenho refaz o `innerHTML` e o nó
      // pularia da mão do usuário. Ver `ofiVerificarAnotacoes`.
      ofiArraste = true;
    }
    alvos.forEach(a => {
      a.el.style.left = Math.round(a.no.x + dx) + 'px';
      a.el.style.top = Math.round(a.no.y + dy) + 'px';
      if (a.anot) {
        a.anot.style.left = Math.round(a.no.x + dx) + 'px';
        a.anot.style.top = Math.round(ofiTopoDaAnotacao(a.no) + dy) + 'px';
      }
    });
    ofiPedirFios();
  }
  async function soltar(e2) {
    document.removeEventListener('mousemove', mover);
    document.removeEventListener('mouseup', soltar);
    // Liberado ANTES do `return` de baixo: um clique que não virou arraste
    // também passa por aqui, e deixar a marca presa calaria o vigia para sempre.
    ofiArraste = null;
    if (!arrastou) return;
    const dx = (e2.clientX - partiu.x) / ofiZoom;
    const dy = (e2.clientY - partiu.y) / ofiZoom;
    // Uma gravação só para a seleção inteira: uma por nó tomaria o lock N
    // vezes para uma única ação, e deixaria o arquivo em estado intermediário.
    const movimentos = alvos.map(a => ({
      id: a.id, x: Math.round(a.no.x + dx), y: Math.round(a.no.y + dy) }));
    // ⚠️ ANTES DE ESCREVER A POSIÇÃO NOVA NO MODELO. `ofiFiliacaoNova` soma o
    // deslocamento por conta própria; se o modelo já tiver andado, ela somaria
    // duas vezes e o nó seria adotado por um grupo que está no dobro da
    // distância que ele percorreu.
    const filiacao = ofiFiliacaoNova(alvos.map(a => a.id), {dx, dy});
    movimentos.forEach(m => {
      const no = ofiNos.find(n => n.id === m.id);
      if (no) { no.x = m.x; no.y = m.y; }
    });
    const r = await window.pywebview.api.mover_nos(currentProject, movimentos,
                                                   null, true, filiacao);
    if (!r.success) { showToast(r.error, true); ofiCarregar(); return; }
    // Só recarrega quando a filiação mudou: aí a caixa de algum grupo passou a
    // abraçar outra coisa, e quem sabe desenhar isso é o backend, que acabou de
    // reescrever os dois lados. Sem mudança, redesenhar seria piscar à toa.
    if (filiacao) ofiCarregar();
  }
  document.addEventListener('mousemove', mover);
  document.addEventListener('mouseup', soltar);
}

// ── Arrastar a caixa, e esticá-la ───────────────────────────────────────────
//
// ⚠️ OS DOIS GESTOS TÊM SENTIDOS OPOSTOS, DE PROPÓSITO. Arrastar a moldura
// LEVA JUNTO o que ela abraça — é o "mexi no grupo, mexeu tudo dentro".
// Esticá-la NÃO MEXE em nó nenhum: ela passa a abraçar mais, ou menos, e é
// assim que se adota um cartão vizinho sem precisar arrastá-lo. Trocar isso
// faria redimensionar espalhar os nós pelo canvas, que é o oposto do pedido.

// A caixa de um grupo para efeito de GESTO. Enquanto a migração não gravou, o
// grupo antigo não tem `largura` nenhuma — e mandar `undefined` ao backend faz
// o piso de 80 valer, ou seja: pegar a moldura para arrastar a encolhia para um
// quadradinho. Aqui a medida sai do que está desenhado, que é a mesma caixa que
// o usuário está vendo e agarrou.
function ofiCaixaEmUso(grupo, el) {
  if (Number.isFinite(grupo.largura) && Number.isFinite(grupo.altura)) {
    return {x: grupo.x || 0, y: grupo.y || 0, w: grupo.largura, h: grupo.altura};
  }
  return {x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight};
}

function ofiIniciarArrasteDeGrupo(e, grupo) {
  const el = document.querySelector(`#ofi-grupos [data-grupo-caixa="${grupo.id}"]`);
  if (!el) return;
  // Os membros vêm da filiação GRAVADA, e não de quem está por baixo agora: no
  // instante do gesto as duas coincidem, e a gravada é a que o backend também
  // enxerga quando for a vez dele.
  const membros = ofiMembrosDoGrupo(grupo.id).map(id => ({
    id,
    no: ofiNos.find(n => n.id === id),
    el: document.querySelector(`#ofi-nos .ofi-no[data-id="${id}"]`),
    anot: document.querySelector(`#ofi-nos .ofi-anotno[data-anot-de="${id}"]`),
  })).filter(m => m.no && m.el);
  const partiu = {x: e.clientX, y: e.clientY};
  const berco = ofiCaixaEmUso(grupo, el);
  let arrastou = false;

  function mover(e2) {
    const dx = (e2.clientX - partiu.x) / ofiZoom;
    const dy = (e2.clientY - partiu.y) / ofiZoom;
    if (!arrastou) {
      if (Math.abs(dx) + Math.abs(dy) < OFI_LIMIAR_ARRASTE / ofiZoom) return;
      arrastou = true;
      ofiArraste = true;
    }
    // ⚠️ A POSIÇÃO PROVISÓRIA VAI PARA O MODELO, e não para o `style` do
    // elemento. Foi o que fez a caixa parecer travada durante todo o arraste e
    // só assentar no instante de soltar: `ofiPedirFios`, três linhas abaixo,
    // REFAZ o `innerHTML` da camada de grupos a cada quadro, a partir de
    // `ofiGrupos` — então um `style.left` escrito aqui era apagado antes de ser
    // pintado, e o `el` que guardamos virava um elemento órfão. Os nós não
    // sofriam disso porque a camada deles não é refeita, e por isso eles
    // andavam ao vivo enquanto a moldura ficava para trás.
    grupo.x = Math.round(berco.x + dx);
    grupo.y = Math.round(berco.y + dy);
    grupo.largura = berco.w;
    grupo.altura = berco.h;
    membros.forEach(m => {
      m.el.style.left = Math.round(m.no.x + dx) + 'px';
      m.el.style.top = Math.round(m.no.y + dy) + 'px';
      if (m.anot) {
        m.anot.style.left = Math.round(m.no.x + dx) + 'px';
        m.anot.style.top = Math.round(ofiTopoDaAnotacao(m.no) + dy) + 'px';
      }
    });
    ofiPedirFios();
  }

  async function soltar(e2) {
    document.removeEventListener('mousemove', mover);
    document.removeEventListener('mouseup', soltar);
    ofiArraste = null;
    if (!arrastou) return;
    const dx = (e2.clientX - partiu.x) / ofiZoom;
    const dy = (e2.clientY - partiu.y) / ofiZoom;
    // O modelo já foi andando junto com o ponteiro, em `mover`.
    const caixa = {x: grupo.x, y: grupo.y, largura: grupo.largura, altura: grupo.altura};
    const movimentos = membros.map(m => ({
      id: m.id, x: Math.round(m.no.x + dx), y: Math.round(m.no.y + dy)}));
    // A caixa andou junto com os membros, então nenhum deles trocou de dono
    // por causa DESTE gesto — mas a moldura pode ter parado por cima de um nó
    // solto, e esse passa a ser dela. Por isso a filiação vai junto.
    const soltos = ofiNos.filter(n => !membros.some(m => m.id === n.id)).map(n => n.id);
    movimentos.forEach(m => {
      const no = ofiNos.find(n => n.id === m.id);
      if (no) { no.x = m.x; no.y = m.y; }
    });
    const filiacao = ofiFiliacaoNova(soltos, null);
    const r = await window.pywebview.api.mover_grupo(currentProject, grupo.id,
                                                     caixa, movimentos, null, filiacao);
    if (!r.success) { showToast(r.error, true); }
    ofiCarregar();
  }

  document.addEventListener('mousemove', mover);
  document.addEventListener('mouseup', soltar);
}

function ofiIniciarRedimensionarGrupo(e, grupo, lado) {
  const el = document.querySelector(`#ofi-grupos [data-grupo-caixa="${grupo.id}"]`);
  if (!el) return;
  const partiu = {x: e.clientX, y: e.clientY};
  const berco = ofiCaixaEmUso(grupo, el);
  let mexeu = false;

  // Qual borda cada letra move. `n` e `o` mexem no canto de origem, e por isso
  // mudam `x`/`y` junto com o tamanho — esticar para cima é andar para cima e
  // crescer na mesma medida.
  const pegaNorte = lado.includes('n');
  const pegaSul   = lado.includes('s');
  const pegaOeste = lado.includes('o');
  const pegaLeste = lado.includes('l') || lado === 'ne' || lado === 'se';

  function mover(e2) {
    const dx = (e2.clientX - partiu.x) / ofiZoom;
    const dy = (e2.clientY - partiu.y) / ofiZoom;
    if (!mexeu) {
      if (Math.abs(dx) + Math.abs(dy) < OFI_LIMIAR_ARRASTE / ofiZoom) return;
      mexeu = true;
      ofiArraste = true;
    }
    let {x, y, w, h} = berco;
    // ⚠️ O PISO É APLICADO ANTES DE MOVER O CANTO DE ORIGEM. Deixando a largura
    // ficar negativa e só depois corrigindo, a caixa dá um salto no instante em
    // que o ponteiro passa do outro lado.
    if (pegaLeste) w = Math.max(OFI_LADO_MINIMO_DO_GRUPO, berco.w + dx);
    if (pegaOeste) {
      w = Math.max(OFI_LADO_MINIMO_DO_GRUPO, berco.w - dx);
      x = berco.x + (berco.w - w);
    }
    if (pegaSul) h = Math.max(OFI_LADO_MINIMO_DO_GRUPO, berco.h + dy);
    if (pegaNorte) {
      h = Math.max(OFI_LADO_MINIMO_DO_GRUPO, berco.h - dy);
      y = berco.y + (berco.h - h);
    }
    // Mesma razão do arraste: quem pinta é o redesenho, a partir do modelo.
    // Aqui o `style` até sobrevivia — este gesto não chama `ofiPedirFios` —,
    // mas qualquer redesenho vindo de outro lugar no meio do arraste desfaria
    // o que o usuário está fazendo, e a causa não apareceria em lugar nenhum.
    grupo.x = Math.round(x); grupo.y = Math.round(y);
    grupo.largura = Math.round(w); grupo.altura = Math.round(h);
    ofiPedirFios();
  }

  async function soltar() {
    document.removeEventListener('mousemove', mover);
    document.removeEventListener('mouseup', soltar);
    ofiArraste = null;
    if (!mexeu) return;
    const caixa = {x: grupo.x, y: grupo.y,
                   largura: grupo.largura, altura: grupo.altura};
    // Esticar por cima de um nó é o gesto que o adota, e tirar de cima é o que
    // o solta: a filiação é recalculada para TODO nó, porque a moldura pode ter
    // largado um membro e pego outro no mesmo arraste.
    const filiacao = ofiFiliacaoNova(ofiNos.map(n => n.id), null);
    const r = await window.pywebview.api.editar_grupo(currentProject, grupo.id,
                                                      caixa, null, filiacao);
    if (!r.success) { showToast(r.error, true); }
    ofiCarregar();
  }

  document.addEventListener('mousemove', mover);
  document.addEventListener('mouseup', soltar);
}
