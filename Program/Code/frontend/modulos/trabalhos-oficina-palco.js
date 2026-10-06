// ═══ TRABALHOS → Oficina: O PALCO ═════════════════════════════════════════
//
// Os eventos que são do canvas inteiro, e não de um nó: a barra de ferramentas,
// o zoom, o pan, o retângulo de seleção e o teclado do espaço.
//
// A divisa com `trabalhos-oficina-arraste.js` é limpa e vale a pena guardar:
// **aqui o gesto começa no fundo; lá ele começa em cima de alguma coisa.**
// Clicar no vazio e arrastar seleciona; clicar num nó e arrastar move.
//
// ⚠️ UM BOTÃO QUE NÃO EXISTE NÃO PODE DERRUBAR OS OUTROS — é por isso que
// `ofiAo` existe em vez de um `addEventListener` direto por id. Uma sub-aba que
// ainda não pintou deixa o elemento nulo, e um `null.addEventListener` no meio
// da lista mata todos os botões que viriam depois, sem nada na tela.
//
// ⚠️ A TRANSFORMAÇÃO É UMA SÓ (`ofiAplicarTransformacao`), e o zoom vira
// variável CSS no mesmo lugar. Quem escrever um segundo `transform` em outro
// arquivo vai brigar com este a cada quadro.

// ── Eventos do palco ────────────────────────────────────────────────────────

// ⚠️ UM BOTÃO QUE NÃO EXISTE NÃO PODE DERRUBAR OS OUTROS. Antes esta função
// era uma fila de `getElementById(...).addEventListener(...)`, e bastou um id
// mudar de nome no HTML para `null.addEventListener` estourar no meio: TUDO que
// vinha depois — os botões da barra contextual, o zoom pela roda e o arraste de
// seleção no vazio — nunca chegava a ser ligado. O sintoma não apontava para o
// botão culpado: parecia que metade da Oficina tinha parado sozinha.
//
// `ofiAo` isola cada ligação. Elemento ausente vira aviso no console e a fila
// continua.
function ofiAo(id, evento, fn) {
  const el = document.getElementById(id);
  if (!el) { console.warn('[oficina] elemento ausente, não ligado:', id); return; }
  el.addEventListener(evento, fn);
}

function ofiLigarEventos() {
  const canvas = document.getElementById('ofi-canvas');

  // ⚠️ O TERMINAL ABRE UM POPOVER, e não cria o nó direto: é ali que se escolhe
  // o agente da biblioteca, e escolher um COPIA o `.md` para `.claude/agents/`
  // do projeto antes de o nó existir. Nota e texto não têm o que escolher.
  ofiAo('ofi-novo-terminal', 'click', e => ofiPopoverDeTerminal(e.currentTarget));
  ofiAo('ofi-nova-nota', 'click', () => ofiCriar('nota'));
  ofiAo('ofi-novo-texto', 'click', () => ofiCriar('texto'));

  ofiAo('ofi-zoom-menos', 'click', () => ofiAplicarZoom(1 / OFI_ZOOM_PASSO));
  ofiAo('ofi-zoom-mais', 'click', () => ofiAplicarZoom(OFI_ZOOM_PASSO));
  ofiAo('ofi-enquadrar', 'click', ofiEnquadrar);
  ofiAo('ofi-fluxos', 'click', ofiModalDeFluxosSalvos);
  ofiAo('ofi-bloqueios', 'click', () => {
    // Não duplica a lista aqui: leva para a tela que já a desenha, a partir do
    // catálogo único. Duas telas mostrando a mesma lista é como elas divergem.
    const btn = document.querySelector('#tab-trabalhos [data-asubtab="trsub-config"]');
    if (btn) btn.click();
  });

  ofiAo('ofi-parar-tudo', 'click', async () => {
    const r = await window.pywebview.api.parar_tudo(currentProject);
    if (!r.success) { showToast(r.error, true); return; }
    showToast(r.parados.length
      ? `${r.parados.length} terminal(is) parado(s). Os papéis foram reabertos.`
      : 'Nada rodando. Os papéis foram reabertos.');
    ofiCarregar();
  });

  ofiAo('ofi-ctx-editar', 'click', ofiEditarSelecionado);
  ofiAo('ofi-ctx-colorir', 'click', e => ofiColorirSelecionados(e.currentTarget));
  ofiAo('ofi-ctx-agrupar', 'click', ofiAgrupar);
  ofiAo('ofi-ctx-desagrupar', 'click', ofiDesagrupar);
  ofiAo('ofi-ctx-conectar', 'click', ofiConectar);
  ofiAo('ofi-ctx-desconectar', 'click', ofiDesconectar);
  ofiAo('ofi-ctx-duplicar', 'click', ofiDuplicarSelecionados);
  // ⚠️ UM BOTÃO SÓ, DOIS ALVOS. A barra é a mesma para nó e para fio, e
  // duplicar o "Excluir" daria dois botões vermelhos lado a lado, um deles
  // sempre desligado. Quem escolhe é o que está selecionado — e as duas
  // seleções nunca coexistem, porque escolher uma limpa a outra.
  ofiAo('ofi-ctx-excluir', 'click', () => {
    // ⚠️ COM A CAIXA SELECIONADA, EXCLUIR DESFAZ A CAIXA — e não apaga nó
    // nenhum. É o que o rótulo da barra avisa, porque um botão vermelho num
    // canvas cheio de trabalho não pode deixar dúvida sobre o que leva junto.
    if (!ofiSelecao.size && ofiGrupoSel) return ofiDesfazerGrupoSelecionado();
    if (!ofiSelecao.size && ofiLigacaoSel) return ofiApagarLigacaoSelecionada();
    ofiExcluirSelecionados();
  });

  // ⚠️ O TECLADO É LIGADO AQUI, UMA VEZ. `ofiLigarTeclado` tem trava própria
  // (`ofiTecladoLigado`) porque o ouvinte é no `document`: ligar de novo a cada
  // redesenho deixaria N ouvintes, e um Delete apagaria o nó N vezes.
  ofiLigarTeclado();

  // ⚠️ `keydown`/`keyup` no DOCUMENTO, e o `blur` da janela junto. Sem o
  // `blur`, trocar de programa com o espaço apertado deixa a marca ligada para
  // sempre: o usuário volta, clica no vazio para selecionar, e o canvas arrasta
  // — um gesto que mudou de sentido sem nada na tela dizer que mudou.
  document.addEventListener('keydown', e => {
    if (e.code !== 'Space') return;
    const alvo = e.target;
    if (alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))) return;
    // Dentro de um terminal o espaço é uma tecla como outra qualquer.
    if (alvo && alvo.closest && alvo.closest('.ofi-sh-tela')) return;
    ofiEspacoApertado = true;
    canvas.classList.add('ofi-mao');
  });
  document.addEventListener('keyup', e => {
    if (e.code !== 'Space') return;
    ofiEspacoApertado = false;
    canvas.classList.remove('ofi-mao');
  });
  window.addEventListener('blur', () => {
    ofiEspacoApertado = false;
    canvas.classList.remove('ofi-mao');
  });

  // ⚠️ A RODA DÁ ZOOM — exceto DENTRO de um terminal, onde ela rola a tela
  // dele. Antes o zoom exigia Ctrl, e o motivo escrito era esse mesmo: "sem
  // Ctrl a roda rola o log de um terminal". Só que a regra estava ampla demais
  // — valia no canvas inteiro, inclusive no vazio, onde não há log nenhum para
  // rolar. O resultado era rodar a roda sobre o fundo e não acontecer nada.
  //
  // Agora a pergunta é pelo ALVO, e não pela tecla: sobre a tela preta de um
  // terminal, a roda é dele; em qualquer outro lugar, é zoom. Ctrl continua
  // forçando o zoom, para quem quiser dar zoom com o cursor em cima de um.
  // Sem isto o botão direito abre o menu do navegador no meio do arraste.
  canvas.addEventListener('contextmenu', e => {
    if (e.target.closest('.ofi-sh-tela')) return;   // no terminal, o menu é dele
    e.preventDefault();
  });

  // ⚠️ A RODA É DO CANVAS, MENOS ONDE ALGUÉM ESTÁ TRABALHANDO. Três versões
  // erraram nas duas pontas antes desta: exigindo Ctrl em todo lugar (e a roda
  // no vazio não fazia nada), isentando toda tela preta (e a roda sobre um
  // terminal não fazia nada), e por fim tomando a roda de todo mundo (e rolar
  // uma nota aberta dava zoom).
  //
  // A regra que sobrou não é sobre ONDE o ponteiro está, é sobre O QUE ESTÁ EM
  // USO: uma nota que você abriu para editar, e um terminal em que você clicou,
  // têm conteúdo próprio para rolar e a roda é deles. O resto do canvas — o
  // vazio, os cartões fechados, um terminal que você só está olhando — dá zoom.
  //
  // ⚠️ `capture: true` E `stopPropagation` SÃO O QUE FAZ O ZOOM FUNCIONAR SOBRE
  // UM TERMINAL SEM FOCO. O xterm ouve `wheel` no próprio elemento e rola o
  // histórico por conta própria; `preventDefault` não o impede de nada. Ouvindo
  // na CAPTURA, este ouvinte roda ANTES do dele — e é justamente por isso que
  // ele precisa devolver o evento de propósito quando o terminal é o dono.
  //
  // Shift força o zoom, para quem quiser aproximar sem sair do que está usando.
  canvas.addEventListener('wheel', e => {
    if (!e.shiftKey && ofiRodaEhDeOutro(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    ofiAplicarZoom(e.deltaY < 0 ? OFI_ZOOM_PASSO : 1 / OFI_ZOOM_PASSO, e.clientX, e.clientY);
  }, { passive: false, capture: true });

  // Arraste no vazio: retângulo de seleção. Com o botão do meio ou espaço, pan.
  canvas.addEventListener('mousedown', e => {
    // O nó de anotações entra nesta lista mesmo não sendo `.ofi-no`: sem ele
    // aqui, apontar a combo box começaria um retângulo de seleção por baixo.
    if (e.target.closest('.ofi-no') || e.target.closest('.ofi-anotno')
        || e.target.closest('.ofi-barra')
        || e.target.closest('.ofi-barra-ctx')) return;
    // ⚠️ O ESPAÇO ESTAVA PROMETIDO NO COMENTÁRIO ACIMA E NÃO EXISTIA NO CÓDIGO
    // — só o botão do meio era tratado. Quem lê o comentário e tenta o espaço
    // conclui que o pan quebrou; quem não tem botão do meio no mouse fica sem
    // pan nenhum.
    // ⚠️ TRÊS JEITOS DE ARRASTAR A TELA, e nenhum sobra. O botão do meio é o
    // de sempre; muito mouse não tem um clicável. O espaço é o de programa de
    // desenho, e exige as duas mãos. O botão DIREITO é o que se descobre sem
    // ler nada — e é por isso que ele entrou: o usuário relatou "não consigo
    // fazer o movimento de pan" já com os outros dois no lugar.
    if (e.button === 1 || e.button === 2
        || (e.button === 0 && ofiEspacoApertado)) { ofiIniciarPan(e); return; }
    if (e.button !== 0) return;
    ofiIniciarRetangulo(e);
  });
}

// ⚠️ O ÚNICO LUGAR QUE ESCREVE PAN E ZOOM NA TELA. Existe porque havia DOIS,
// e eles não faziam a mesma coisa: `ofiDesenhar` mexia no `.ofi-mundo` e nas
// variáveis do fundo, e o arraste (`ofiIniciarPan`) mexia só no `.ofi-mundo` —
// de propósito, para não redesenhar 60 vezes por segundo. O resultado era o
// sintoma relatado: com o zoom o quadriculado acompanhava, mas ao arrastar os
// nós andavam e a grade ficava parada, como se o fundo fosse de outra tela.
//
// ⚠️ O QUADRICULADO NÃO ESTÁ NO `.ofi-mundo` — ele é `background-image` do
// `.ofi-canvas`, que NÃO é escalado por transformação nenhuma. Por isso ele
// precisa das três variáveis: `--ofi-k` dá o tamanho do quadrado e as duas de
// deslocamento dão a origem. Quem faz a conta é o motor, no `calc` da folha.
//
// Barato o bastante para o arraste: são quatro escritas de estilo, e nenhuma
// remonta o DOM.
function ofiAplicarTransformacao() {
  const mundo = document.getElementById('ofi-mundo');
  if (mundo) {
    mundo.style.transform = `translate(${ofiPan.x}px, ${ofiPan.y}px) scale(${ofiZoom})`;
    // O zoom vira variável CSS para o traço dos fios se dividir por ele — ver o
    // aviso do cabeçalho sobre `non-scaling-stroke` não valer aqui.
    mundo.style.setProperty('--ofi-k', ofiZoom);
  }
  const canvas = document.getElementById('ofi-canvas');
  if (canvas) {
    canvas.style.setProperty('--ofi-k', ofiZoom);
    canvas.style.setProperty('--ofi-px', ofiPan.x + 'px');
    canvas.style.setProperty('--ofi-py', ofiPan.y + 'px');
  }
}

// O zoom acontece EM VOLTA DE UM PONTO, e o padrão é o centro da tela.
//
// ⚠️ QUEM CHAMA PELA RODA PASSA A POSIÇÃO DO PONTEIRO, e é disso que depende
// a sensação de "o zoom vai para onde eu estou olhando". Sem ponto âncora o
// zoom multiplica a partir do canto superior esquerdo do canvas: aproximar
// jogava para fora da tela justamente o nó que o usuário queria ver, e ele
// tinha de arrastar de volta a cada passo. O centro é o âncora certo para os
// botões −/+ da barra, onde não existe ponteiro sobre o canvas.
//
// A conta: o ponto do MUNDO que está sob a tela não pode mudar de lugar na
// tela. `w = (p - pan) / k` antes, `pan' = p - w * k'` depois.
// A roda pertence a este alvo, em vez de ao canvas?
//
// ⚠️ O TERMINAL SÓ FICA COM ELA SE TIVER O FOCO, e isso é o mesmo critério que
// já decide de quem é o teclado (`trShComFoco`, em `trabalhos-shell.js`).
// Manter as duas perguntas com uma resposta só é o que torna o gesto
// previsível: clicou no terminal, ele é seu — teclas e roda; clicou fora, o
// canvas volta a mandar nos dois.
function ofiRodaEhDeOutro(alvo) {
  if (!alvo || !alvo.closest) return false;
  // Uma nota ABERTA para editar tem um `<textarea>` com o texto cru; rolar ali
  // é rolar o texto. Fechada, ela é um cartão como outro qualquer.
  if (alvo.closest('.ofi-nota-editor')) return true;
  // Mesmo caso, e pela mesma razão: o corpo da anotação tem teto de altura e
  // rola por dentro. Rodar ali é ler o resto do arquivo, não dar zoom no canvas.
  if (alvo.closest('.ofi-anotno-c')) return true;
  const tela = alvo.closest('[data-sh-tela]');
  if (!tela) return false;
  return typeof trShComFoco !== 'undefined'
    && trShComFoco === tela.dataset.shTela;
}

function ofiAplicarZoom(fator, clientX, clientY) {
  const canvas = document.getElementById('ofi-canvas');
  const antes = ofiZoom;
  const depois = Math.min(OFI_ZOOM_MAX, Math.max(OFI_ZOOM_MIN, ofiZoom * fator));
  if (canvas && depois !== antes) {
    const r = canvas.getBoundingClientRect();
    const px = (clientX === undefined ? r.left + r.width / 2 : clientX) - r.left;
    const py = (clientY === undefined ? r.top + r.height / 2 : clientY) - r.top;
    const wx = (px - ofiPan.x) / antes;
    const wy = (py - ofiPan.y) / antes;
    ofiPan.x = px - wx * depois;
    ofiPan.y = py - wy * depois;
  }
  ofiZoom = depois;
  ofiDesenhar();
}

// Converte um ponto da TELA para a coordenada do MUNDO. Sem isto, um nó criado
// com o canvas deslocado ou com zoom nasce longe de onde o usuário clicou.
function ofiParaMundo(clientX, clientY) {
  const r = document.getElementById('ofi-canvas').getBoundingClientRect();
  return {
    x: Math.round((clientX - r.left - ofiPan.x) / ofiZoom),
    y: Math.round((clientY - r.top - ofiPan.y) / ofiZoom),
  };
}

function ofiIniciarPan(e) {
  const partiu = { x: e.clientX, y: e.clientY, px: ofiPan.x, py: ofiPan.y };
  const botao = e.button;
  let arrastou = false;
  function mover(e2) {
    if (Math.abs(e2.clientX - partiu.x) + Math.abs(e2.clientY - partiu.y) > OFI_LIMIAR_ARRASTE) {
      arrastou = true;
    }
    ofiPan.x = partiu.px + (e2.clientX - partiu.x);
    ofiPan.y = partiu.py + (e2.clientY - partiu.y);
    // ⚠️ `ofiAplicarTransformacao`, e NÃO um `style.transform` na mão: o
    // quadriculado do fundo mora fora do `.ofi-mundo` e só anda se as
    // variáveis CSS andarem junto. Foi exatamente isto que faltava aqui.
    ofiAplicarTransformacao();
  }
  function soltar() {
    document.removeEventListener('mousemove', mover);
    document.removeEventListener('mouseup', soltar);
    // ⚠️ CLIQUE SECO DO BOTÃO DO MEIO ENQUADRA. Estava prometido no `title` do
    // botão "⤤ Enquadrar" desde o começo e nunca funcionou: a versão antiga
    // testava `e.button === 1 && e.shiftKey` DEPOIS de um `if (e.button === 1)`
    // que já havia retornado, então aquela linha era inalcançável. O gesto
    // certo não é o Shift: é clicar sem arrastar, já que arrastar com o meio é
    // o próprio pan.
    if (botao === 1 && !arrastou) ofiEnquadrar();
  }
  document.addEventListener('mousemove', mover);
  document.addEventListener('mouseup', soltar);
}

function ofiIniciarRetangulo(e) {
  const canvas = document.getElementById('ofi-canvas');
  const caixa = document.getElementById('ofi-retangulo');
  const r = canvas.getBoundingClientRect();
  const inicio = { x: e.clientX - r.left, y: e.clientY - r.top };
  let arrastou = false;

  function mover(e2) {
    const atual = { x: e2.clientX - r.left, y: e2.clientY - r.top };
    if (!arrastou) {
      if (Math.abs(atual.x - inicio.x) + Math.abs(atual.y - inicio.y) < OFI_LIMIAR_ARRASTE) return;
      arrastou = true;
      caixa.classList.remove('hidden');
    }
    const x = Math.min(inicio.x, atual.x), y = Math.min(inicio.y, atual.y);
    const w = Math.abs(atual.x - inicio.x), h = Math.abs(atual.y - inicio.y);
    Object.assign(caixa.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    ofiSelecionarDentro({ x, y, w, h });
  }
  function soltar() {
    document.removeEventListener('mousemove', mover);
    document.removeEventListener('mouseup', soltar);
    caixa.classList.add('hidden');
    // Clique seco no vazio limpa a seleção; arraste mantém o que tocou.
    // ⚠️ O FIO SELECIONADO SAI JUNTO. Sem isto ele fica destacado depois de o
    // usuário clicar longe dele, e o próximo Delete apaga uma ligação que ele
    // já tinha deixado para trás.
    if (!arrastou) { ofiSelecao.clear(); ofiLigacaoSel = null; ofiGrupoSel = null; }
    ofiDesenhar();
  }
  document.addEventListener('mousemove', mover);
  document.addEventListener('mouseup', soltar);
}

function ofiSelecionarDentro(ret) {
  ofiSelecao.clear();
  document.querySelectorAll('#ofi-mundo .ofi-no').forEach(el => {
    const c = document.getElementById('ofi-canvas').getBoundingClientRect();
    const b = el.getBoundingClientRect();
    const toca = !(b.right - c.left < ret.x || b.left - c.left > ret.x + ret.w
                || b.bottom - c.top < ret.y || b.top - c.top > ret.y + ret.h);
    el.classList.toggle('selecionado', toca);
    if (toca) ofiSelecao.add(el.dataset.id);
  });
  ofiAtualizarBarraContextual();
}
