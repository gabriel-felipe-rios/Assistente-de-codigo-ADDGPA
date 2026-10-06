/* ══════════════════════════════════════════════════════ DESIGNER — CHAT E VARIAÇÕES ══ */
// O HTML gerado pelo modelo circula SEMPRE puro (sem cerca ```html): o backend
// normaliza antes de mandar para cá e antes de gravar no histórico. As funções
// de desembrulho abaixo existem para as sessões antigas, gravadas com cerca
// dupla, que ainda estão em disco.
//
// Nada do HTML do modelo entra no documento principal: tudo vai por srcdoc de
// iframe sandboxed, para não vazar CSS nem script para dentro do app.

// Viewport simulado dentro da miniatura. A proporção correspondente
// (1280 / 800) está em .design-var-preview, em agentes-colaboracao-designer.css.
const _DESIGN_LARGURA_BASE = 1280;

// ── Extração do HTML das variações ──────────────────────────────────────────

// O grupo de captura no número é obrigatório: o histórico só grava as variações
// que deram certo, então uma rodada onde a 2ª falhou fica com "Variação 1" e
// "Variação 3". Sem capturar o número, as duas seriam renumeradas para 1 e 2 ao
// reabrir, e o `variacao_base` gravado apontaria para o card errado.
// String.split com grupo de captura intercala os números capturados no array.
const _RE_CABECALHO_VARIACAO = /^###[ \t]+Varia\S*[ \t]+(\d+)[ \t]*$/mi;

// Tira as cercas de código. O conteúdo de uma variação é sempre um documento
// HTML inteiro, então não há bloco legítimo a preservar — e remover tudo é o
// único jeito de aguentar a cerca dupla das sessões antigas, onde o regex
// ingênuo casava da cerca externa até a interna e devolvia string vazia.
function _desembrulharHtmlDesign(bloco) {
  return (bloco || '').replace(/```[a-z]*[ \t]*\r?\n?/gi, '').trim();
}

// Devolve [{ indice, html }] — `indice` é 0-based e vem do número do cabeçalho,
// não da posição no array, para sobreviver a uma variação que falhou.
function extrairVariacoesDesign(content) {
  const texto = content || '';
  // Com grupo de captura o split devolve [prefixo, "1", corpo1, "3", corpo3, …]
  const partes = texto.split(_RE_CABECALHO_VARIACAO).slice(1);
  const variacoes = [];

  for (let i = 0; i + 1 < partes.length; i += 2) {
    const html = _desembrulharHtmlDesign(partes[i + 1]);
    if (html.includes('<')) variacoes.push({ indice: parseInt(partes[i], 10) - 1, html });
  }

  // Sessão sem cabeçalho "### Variação N": cai para os blocos de código, e aí a
  // posição no array é a única informação de ordem que existe.
  if (!variacoes.length) {
    (texto.match(/```html[\s\S]*?```/gi) || []).forEach(bloco => {
      const html = _desembrulharHtmlDesign(bloco);
      if (html.includes('<')) variacoes.push({ indice: variacoes.length, html });
    });
  }
  return variacoes;
}

// Texto que o assistente escreveu FORA dos blocos de variação. Sem esta poda,
// reabrir uma sessão despejava o HTML inteiro das 4 variações como texto cru.
function _textoSemVariacoesDesign(content) {
  const texto = content || '';
  const idx = texto.search(_RE_CABECALHO_VARIACAO);
  const prefixo = idx >= 0 ? texto.slice(0, idx) : texto.replace(/```[\s\S]*?```/g, '');
  return prefixo.trim();
}

// ── Miniatura ───────────────────────────────────────────────────────────────

// A escala precisa ser calculada em runtime: a largura do card muda com o
// tamanho da janela e com o número de variações. Uma escala fixa no CSS corta
// a miniatura ou deixa sobra em volta.
function ajustarEscalaMiniatura(preview, iframe) {
  const aplicar = () => {
    const largura = preview.clientWidth;
    if (!largura) return;
    iframe.style.transform = `scale(${largura / _DESIGN_LARGURA_BASE})`;
  };
  preview._aplicarEscalaDesign = aplicar;
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(aplicar).observe(preview);
  }
}

// Medir só é possível depois que o nó entra no documento — antes disso
// clientWidth é 0. Chamada logo após cada inserção, porque depender apenas do
// ResizeObserver deixava a miniatura presa na escala de fallback do CSS.
function _aplicarEscalasMiniaturas(raiz) {
  if (!raiz) return;
  raiz.querySelectorAll('.design-var-preview').forEach(p => {
    if (p._aplicarEscalaDesign) p._aplicarEscalaDesign();
  });
}

function _criarMiniaturaDesign(html) {
  const preview = document.createElement('div');
  preview.className = 'design-var-preview';

  const iframe = document.createElement('iframe');
  iframe.className = 'design-var-iframe';
  iframe.setAttribute('sandbox', ''); // renderiza HTML/CSS, sem script e sem acesso ao app
  iframe.setAttribute('scrolling', 'no');
  iframe.srcdoc = html;
  preview.appendChild(iframe);

  // Escudo transparente: clique e roda do mouse pertencem ao card e à conversa,
  // nunca ao documento renderizado dentro dele (igual a .dst-thumb-shield).
  const escudo = document.createElement('div');
  escudo.className = 'design-var-shield';
  preview.appendChild(escudo);

  ajustarEscalaMiniatura(preview, iframe);
  return preview;
}

// ── Cards e grid ────────────────────────────────────────────────────────────

function _criarGridVariacoes(quantidade) {
  const grid = document.createElement('div');
  grid.className = 'design-variations-grid';
  grid.dataset.count = quantidade;
  return grid;
}

// Usada tanto pelo histórico quanto pelo streaming: antes eram duas montagens
// diferentes, e o mesmo conteúdo saía com estruturas e larguras distintas.
function _criarCardVariacao(html, index) {
  const card = document.createElement('div');
  card.className = 'design-variation-card';
  card.dataset.varIndex = index;

  const header = document.createElement('div');
  header.className = 'design-var-header';

  const label = document.createElement('span');
  label.className = 'design-variation-label';
  label.textContent = `Variação ${index + 1}`;

  const acoes = document.createElement('div');
  acoes.className = 'design-var-actions';

  const btnSelecionar = document.createElement('button');
  btnSelecionar.className = 'btn btn-primary btn-sm';
  btnSelecionar.textContent = 'Selecionar';
  btnSelecionar.addEventListener('click', () => {
    // A rodada é lida no CLIQUE, não na criação: o card de carregamento nasce
    // antes de o bloco da rodada existir, então o construtor não teria como saber.
    selectedDesignVariation = { html, variacao: index, rodada: obterRodadaDoCard(card) };
    // Só a seleção transitória é limpa. `.variacao-base` é registro histórico e
    // convive com ela no mesmo card — não pode entrar nesta limpeza.
    document.querySelectorAll('.design-variation-card').forEach(c => c.classList.remove('selected-var'));
    card.classList.add('selected-var');
    updateDesignChips();
    showToast('Variação selecionada! Descreva os ajustes na mensagem.');
  });

  const btnExpandir = document.createElement('button');
  btnExpandir.className = 'btn btn-muted btn-sm';
  btnExpandir.textContent = '⛶ Expandir';
  btnExpandir.addEventListener('click', () => openDesignVariationModal(html, `Variação ${index + 1}`));

  acoes.appendChild(btnSelecionar);
  acoes.appendChild(btnExpandir);
  header.appendChild(label);
  header.appendChild(acoes);

  card.appendChild(header);
  card.appendChild(_criarMiniaturaDesign(html));
  return card;
}

function _criarCardCarregando(index) {
  const card = document.createElement('div');
  card.className = 'design-variation-card design-var-loading';
  card.dataset.varIndex = index;
  card.innerHTML = `
    <div class="design-var-header">
      <span class="design-variation-label">Variação ${index + 1}</span>
    </div>
    <div class="design-var-loading-body">
      <div class="design-loading-spinner">⏳</div>
    </div>`;
  return card;
}

function _marcarCardComErro(card, msg) {
  card.classList.remove('design-var-loading');
  const corpo = card.querySelector('.design-var-loading-body');
  if (corpo) corpo.remove();
  const erro = document.createElement('div');
  erro.className = 'design-error-msg';
  erro.textContent = '⚠ ' + msg;
  card.appendChild(erro);
}

// ── Mensagens ───────────────────────────────────────────────────────────────

// `destino` é o elemento que recebe a mensagem — o bloco da rodada, quando há um.
function renderDesignMessage(role, content, destino = null) {
  const alvo = destino || document.getElementById('design-messages');
  if (!alvo) return null;

  // Classes do chat de verdade (chat.css): as antigas .chat-message/.chat-bubble
  // não existiam em CSS nenhum, então o texto saía sem bolha e sem quebra.
  const wrap = document.createElement('div');
  wrap.className = 'message message-' + (role === 'user' ? 'user' : 'assistant');

  const variacoes = role === 'assistant' ? extrairVariacoesDesign(content) : [];
  const texto = variacoes.length ? _textoSemVariacoesDesign(content) : (content || '').trim();

  if (texto) {
    const bolha = document.createElement('div');
    bolha.className = 'message-content';
    bolha.innerHTML = renderMarkdown(texto);
    wrap.appendChild(bolha);
  }

  if (variacoes.length) {
    const grid = _criarGridVariacoes(variacoes.length);
    variacoes.forEach(v => grid.appendChild(_criarCardVariacao(v.html, v.indice)));
    wrap.appendChild(grid);
  }

  alvo.appendChild(wrap);
  _aplicarEscalasMiniaturas(wrap);
  return wrap;
}

async function sendDesignMessage() {
  if (estaGerandoDesign || !currentDesignChatId) return;
  const inputEl = document.getElementById('design-input');
  const msg = inputEl.value.trim();
  if (!msg) return;

  const modelDisplay = document.getElementById('design-model-name');
  const model = modelDisplay.textContent.trim();
  if (!model || model === 'Nenhum modelo') { showToast('Nenhum modelo disponível. Clique em "Atualizar".', true); return; }

  // Trava: da 2ª rodada em diante toda geração parte de uma variação. Sem isto
  // um pedido sem seleção geraria do zero no meio da sessão, ignorando tudo.
  if (contarRodadasDesign() > 0 && !selectedDesignVariation) {
    showToast('Selecione a variação de onde partir antes de pedir o ajuste.', true);
    return;
  }

  const variationCount = parseInt(document.getElementById('design-variation-count').value, 10);

  // ⚠️ A trava de cinco pontas conferida AQUI, e não só no botão: o Enter no
  // campo chama esta função direto (designer.js), sem passar pelo botão
  // apagado. Antes do `inputEl.value = ''`, senão a recusa come o texto.
  if (typeof travaIALiberado === 'function' && !await travaIALiberado('designer')) return;

  inputEl.value = '';
  estaGerandoDesign = true;
  // `travaIAOcupadoLocal` e não `disabled = true` direto: a marca é o que
  // impede a pulsação de 4 s de reabrir o botão no meio da geração, já que
  // dali a trava está com o próprio Designer e "não bloqueia" o Designer.
  travaIAOcupadoLocal(document.getElementById('btn-send-design'), true);

  const rodadaBase   = selectedDesignVariation ? selectedDesignVariation.rodada  : null;
  const variacaoBase = selectedDesignVariation ? selectedDesignVariation.variacao : null;

  // Descartar ANTES de criar o bloco novo e ANTES de fixar _designAiWrap. Se a
  // remoção viesse depois, o escopo da geração apontaria para um nó já
  // desconectado e todas as variações voltariam para o vazio.
  const descartadas = descartarRodadasApos(rodadaBase);
  if (descartadas > 0) {
    showToast(`${descartadas} rodada(s) descartada(s) a partir da rodada ${rodadaBase + 1}.`);
  }

  // Uma rodada tem no máximo uma variação-base marcada, porque só existe uma
  // rodada seguinte — o marcador antigo da rodada de origem tem que sair.
  limparMarcadoresBase();
  if (rodadaBase !== null) marcarVariacaoBase(rodadaBase, variacaoBase);

  const msgEl = document.getElementById('design-messages');
  const bloco = criarBlocoRodada(contarRodadasDesign(), rodadaBase, variacaoBase);
  msgEl.appendChild(bloco);

  renderDesignMessage('user', msg, bloco);

  const aiWrap = document.createElement('div');
  aiWrap.className = 'message message-assistant';

  const grid = _criarGridVariacoes(variationCount);
  for (let i = 0; i < variationCount; i++) grid.appendChild(_criarCardCarregando(i));
  aiWrap.appendChild(grid);
  bloco.appendChild(aiWrap);
  msgEl.scrollTop = msgEl.scrollHeight;

  // Escopo desta geração. As variações voltam do Python por callback e precisam
  // achar ESTE grid: buscar no documento inteiro fazia a 2ª geração sobrescrever
  // os cards da mensagem anterior. O id da sessão evita que uma variação
  // atrasada caia numa sessão que o usuário já trocou.
  window._designAiWrap    = aiWrap;
  window._designGenChatId = currentDesignChatId;

  atualizarBarraRodadas();

  const selectedVarHtml = selectedDesignVariation ? selectedDesignVariation.html : '';

  // Comentário que ainda está sendo digitado só entra no estado pelo `blur`. Sem
  // este empurrão, escrever um comentário e clicar direto em Gerar mandava o
  // pedido sem ele — e nada na tela dizia que tinha ficado de fora.
  if (typeof _dselGravarOQueEstaSendoDigitado === 'function') {
    await _dselGravarOQueEstaSendoDigitado();
  }
  // As escolhas não viajam na chamada: eram duas e viraram cinco dimensões mais
  // um comentário por item. Grava ANTES, na SESSÃO, e o backend relê do disco —
  // uma fonte só, e sem corrida entre o clique no card e o clique em Gerar.
  await salvarEscolhasDaSessao(currentDesignChatId);

  await window.pywebview.api.send_design_message(
    currentProject, currentDesignChatId, msg, model, variationCount,
    selectedVarHtml, rodadaBase, variacaoBase
  );

  selectedDesignVariation = null;
  document.querySelectorAll('.design-variation-card').forEach(c => c.classList.remove('selected-var'));
  updateDesignChips();
  marcarContextoDesatualizado();
}

function openDesignVariationModal(html, title) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'design-modal';
  modal.innerHTML = `
    <div class="design-modal-topbar">
      <span></span>
      <button class="btn-icon" title="Fechar">✕</button>
    </div>
    <iframe class="design-modal-iframe" sandbox=""></iframe>
  `;
  modal.querySelector('.design-modal-topbar span').textContent = title;
  modal.querySelector('.btn-icon').addEventListener('click', () => overlay.remove());
  overlay.appendChild(modal);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  modal.querySelector('iframe').srcdoc = html;
}

// ── Callbacks vindos do Python ──────────────────────────────────────────────

function _estaNaGeracaoAtual() {
  return !window._designGenChatId || window._designGenChatId === currentDesignChatId;
}

function _cardDaGeracao(index) {
  const escopo = window._designAiWrap;
  return escopo ? escopo.querySelector(`.design-variation-card[data-var-index="${index}"]`) : null;
}

function appendDesignVariation(project, index, content) {
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (project && project !== currentProject) return;
  if (!_estaNaGeracaoAtual()) return;
  const card = _cardDaGeracao(index);
  if (!card) return;

  const html = _desembrulharHtmlDesign(content);
  // Resposta sem nenhuma tag = o modelo não devolveu interface nenhuma. Sem esta
  // guarda o card virava uma miniatura em branco, sem explicação.
  if (!html.includes('<')) { _marcarCardComErro(card, 'O modelo não devolveu HTML.'); return; }

  const novo = _criarCardVariacao(html, index);
  card.replaceWith(novo);
  _aplicarEscalasMiniaturas(novo);

  const msgEl = document.getElementById('design-messages');
  if (msgEl) msgEl.scrollTop = msgEl.scrollHeight;
}

function designVariationError(project, index, msg) {
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (project && project !== currentProject) return;
  if (_estaNaGeracaoAtual()) {
    const card = _cardDaGeracao(index);
    if (card) _marcarCardComErro(card, msg);
  }
  showToast(`Erro na Variação ${index + 1}: ${msg}`, true);
}

// Fecha os cards que ficaram no spinner e devolve o botão "Gerar". Sem isso,
// uma variação que nunca voltou girava para sempre e o botão ficava travado.
function _encerrarGeracaoDesign(motivo) {
  const escopo = window._designAiWrap;
  if (escopo && _estaNaGeracaoAtual()) {
    escopo.querySelectorAll('.design-variation-card.design-var-loading')
      .forEach(card => _marcarCardComErro(card, motivo));
  }
  resetarEstadoGeracaoDesign(true);
}

// Rede de segurança para a entrada na aba e a troca de sessão: sair da aba não
// desmonta nada nem cancela a geração, então um worker que morre sem chamar
// finishDesignMessage deixaria "Gerar" desabilitado até reiniciar o app.
//
// ⚠️ Ela limpa geração MORTA, nunca uma viva — e por isso é no-op enquanto
// `estaGerandoDesign` está ligado. `initDesignerTab` a chama a cada entrada na
// aba: sair do Designer e voltar no meio de uma geração zerava o
// `_designAiWrap`, e as variações voltavam do Python para um alvo que não existia
// mais. A tela ficava parada com a requisição do LM Studio já concluída, sem erro
// nenhum. Quem abandona o escopo de verdade — trocar de sessão, encerrar — passa
// `forcar`.
function resetarEstadoGeracaoDesign(forcar = false) {
  if (!forcar && estaGerandoDesign) return;
  estaGerandoDesign = false;
  // ⚠️ Solta a marca local, mas NÃO force `disabled = false`: entrar na aba com
  // o Chat, a Fila ou as Rotinas rodando chamava isto e reabria o botão por
  // cima da trava. Quem decide se ele fica aceso é `atualizarTravaIA`.
  travaIAOcupadoLocal(document.getElementById('btn-send-design'), false);
  if (typeof atualizarTravaIA === 'function') atualizarTravaIA();
  window._designAiWrap    = null;
  window._designGenChatId = null;
}

function finishDesignMessage(project, title) {
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (project && project !== currentProject) return;
  // Card ainda no spinner quando a geração termina = o callback daquela variação
  // não chegou à tela (variação que falha vira card de erro pelo
  // `designVariationError`). O resultado JÁ ESTÁ gravado no disco, então relê a
  // sessão em vez de deixar o spinner girando — é o clique na sessão que o usuário
  // tinha de dar à mão.
  const sessao = currentDesignChatId;
  const perdidas = !!document.querySelector(
    '#design-messages .design-variation-card.design-var-loading');
  resetarEstadoGeracaoDesign(true);
  loadDesignSessions();
  if (perdidas && sessao) openDesignChat(sessao);
}

function designError(project, msg) {
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (project && project !== currentProject) return;
  _encerrarGeracaoDesign(msg);
  showToast('Erro no Designer: ' + msg, true);
}
