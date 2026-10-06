/* ══════════════════════════════════════════════════ DESIGNER — RODADAS ══ */
// Uma RODADA é um par (mensagem do usuário, mensagem do assistente com as N
// variações). O índice da rodada é a posição do par em `messages` — não existe
// id próprio, e descartar rodadas é sempre truncar um sufixo.
//
// O vínculo com a variação de origem mora na mensagem do USUÁRIO, gravado pelo
// backend como `rodada_base` / `variacao_base`. Sessões antigas não têm esses
// campos: ler sempre com `??`, nunca supor que existem.
//
// O vínculo é lido PARA TRÁS: quem sabe que a variação 2 da rodada 1 foi usada é
// a rodada 2. Por isso o marcador só pode ser aplicado ao processar a rodada
// seguinte — e nesse momento o bloco de origem já está no DOM.

// ── Blocos de rodada ────────────────────────────────────────────────────────

function criarBlocoRodada(indice, rodadaBase, variacaoBase) {
  const bloco = document.createElement('div');
  bloco.className = 'design-rodada';
  bloco.dataset.rodada = indice;

  const sep = document.createElement('div');
  sep.className = 'design-rodada-sep';

  const titulo = document.createElement('span');
  titulo.className = 'design-rodada-titulo';
  titulo.textContent = `Rodada ${indice + 1}`;
  sep.appendChild(titulo);

  if (rodadaBase !== null && rodadaBase !== undefined) {
    const origem = document.createElement('span');
    origem.className = 'design-rodada-origem';
    origem.textContent = `a partir da Variação ${(variacaoBase ?? 0) + 1} da rodada ${rodadaBase + 1}`;
    sep.appendChild(origem);
  }

  bloco.appendChild(sep);
  return bloco;
}

function contarRodadasDesign() {
  return document.querySelectorAll('#design-messages .design-rodada').length;
}

function obterRodadaDoCard(card) {
  const bloco = card.closest('.design-rodada');
  return bloco ? parseInt(bloco.dataset.rodada, 10) : null;
}

function _blocoDaRodada(indice) {
  return document.querySelector(`#design-messages .design-rodada[data-rodada="${indice}"]`);
}

// ── Marcador da variação que originou a rodada seguinte ─────────────────────
// Classe própria, separada de `.selected-var`: aquela é a seleção transitória
// (some no próximo clique), esta é registro histórico. As duas convivem no
// mesmo card, então a limpeza de uma não pode tocar na outra.

function marcarVariacaoBase(indiceRodada, indiceVariacao) {
  const bloco = _blocoDaRodada(indiceRodada);
  if (!bloco) return;
  const card = bloco.querySelector(`.design-variation-card[data-var-index="${indiceVariacao ?? 0}"]`);
  if (!card || card.querySelector('.design-var-selo-base')) return;

  card.classList.add('variacao-base');
  const selo = document.createElement('span');
  selo.className = 'design-var-selo-base';
  selo.textContent = 'Base';
  const label = card.querySelector('.design-variation-label');
  if (label) label.insertAdjacentElement('afterend', selo);
}

function limparMarcadoresBase() {
  document.querySelectorAll('#design-messages .design-variation-card.variacao-base')
    .forEach(card => {
      card.classList.remove('variacao-base');
      const selo = card.querySelector('.design-var-selo-base');
      if (selo) selo.remove();
    });
}

// ── Descarte ────────────────────────────────────────────────────────────────

// Remove as rodadas posteriores a `indiceRodada` e devolve quantas saíram.
// `null` = a rodada nova vai no fim, sem descartar nada.
function descartarRodadasApos(indiceRodada) {
  if (indiceRodada === null || indiceRodada === undefined) return 0;
  const posteriores = [...document.querySelectorAll('#design-messages .design-rodada')]
    .filter(b => parseInt(b.dataset.rodada, 10) > indiceRodada);
  posteriores.forEach(b => b.remove());
  return posteriores.length;
}

// ── Render de uma sessão inteira ────────────────────────────────────────────

function renderRodadasDesign(messages) {
  const msgEl = document.getElementById('design-messages');
  if (!msgEl) return;
  msgEl.innerHTML = '';
  limparBarraRodadas();

  const lista = messages || [];
  const marcadores = [];

  for (let i = 0, rodada = 0; i < lista.length; i += 2, rodada++) {
    const msgUsuario   = lista[i];
    const msgAssistente = lista[i + 1]; // pode faltar se a geração morreu no meio

    const rodadaBase   = msgUsuario?.rodada_base   ?? null;
    const variacaoBase = msgUsuario?.variacao_base ?? null;

    const bloco = criarBlocoRodada(rodada, rodadaBase, variacaoBase);
    msgEl.appendChild(bloco);

    if (msgUsuario) renderDesignMessage('user', msgUsuario.content, bloco);
    if (msgAssistente) renderDesignMessage('assistant', msgAssistente.content, bloco);

    // Aplicado depois do laço: o bloco de origem já existe (é anterior), mas os
    // cards dele só terminam de ser montados na iteração que os criou.
    if (rodadaBase !== null) marcadores.push([rodadaBase, variacaoBase]);
  }

  marcadores.forEach(([r, v]) => marcarVariacaoBase(r, v));
  atualizarBarraRodadas();
  msgEl.scrollTop = msgEl.scrollHeight;
}

// ── Barra de rodadas ────────────────────────────────────────────────────────
// Fica FORA de #design-messages: dentro, rolaria junto com a conversa e deixaria
// de servir como barra.

let _observadorRodadas = null;

function limparBarraRodadas() {
  if (_observadorRodadas) { _observadorRodadas.disconnect(); _observadorRodadas = null; }
  const barra = document.getElementById('design-rodadas-bar');
  if (barra) { barra.innerHTML = ''; barra.classList.add('hidden'); }
}

function atualizarBarraRodadas() {
  const barra = document.getElementById('design-rodadas-bar');
  const msgEl = document.getElementById('design-messages');
  if (!barra || !msgEl) return;

  // A aba nunca é desmontada: sem desconectar, os observadores das sessões
  // anteriores continuariam vivos e se acumulariam a cada troca de sessão.
  if (_observadorRodadas) { _observadorRodadas.disconnect(); _observadorRodadas = null; }

  const blocos = [...msgEl.querySelectorAll('.design-rodada')];
  barra.innerHTML = '';
  // Com uma rodada só a barra é ruído puro.
  barra.classList.toggle('hidden', blocos.length < 2);
  if (blocos.length < 2) return;

  blocos.forEach(bloco => {
    const indice = parseInt(bloco.dataset.rodada, 10);
    const chip = document.createElement('button');
    chip.className = 'design-rodada-chip';
    chip.dataset.rodada = indice;
    chip.textContent = `R${indice + 1}`;
    const pedido = bloco.querySelector('.message-user .message-content');
    chip.title = pedido ? pedido.textContent.slice(0, 80) : `Rodada ${indice + 1}`;
    chip.addEventListener('click', () => rolarAteRodada(indice));
    barra.appendChild(chip);
  });

  // Só a faixa de cima do container conta: a rodada "atual" é a que está no topo
  // da vista, não a que ocupa mais área.
  _observadorRodadas = new IntersectionObserver(entradas => {
    entradas.forEach(e => {
      if (!e.isIntersecting) return;
      const indice = e.target.dataset.rodada;
      barra.querySelectorAll('.design-rodada-chip').forEach(c =>
        c.classList.toggle('ativa', c.dataset.rodada === indice));
      const ativa = barra.querySelector('.design-rodada-chip.ativa');
      if (ativa) ativa.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }, { root: msgEl, rootMargin: '0px 0px -75% 0px' });

  blocos.forEach(b => _observadorRodadas.observe(b));
}

// Rolagem por aritmética, não por scrollIntoView: o container de rolagem é
// #design-messages, e o scrollIntoView mexeria em todos os ancestrais roláveis,
// empurrando o layout da aba. Instantânea de propósito — com 4 iframes por
// rodada, animar o percurso fica caro e faz o destaque piscar.
function rolarAteRodada(indice) {
  const msgEl = document.getElementById('design-messages');
  const bloco = _blocoDaRodada(indice);
  if (!msgEl || !bloco) return;
  msgEl.scrollTop += bloco.getBoundingClientRect().top - msgEl.getBoundingClientRect().top;
}
