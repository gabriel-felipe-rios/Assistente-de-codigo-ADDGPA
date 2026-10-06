// ══ CHAT → o streaming: quem é o dono, e como cada evento é pintado ═══════
//
// ⚠️ A RESPOSTA PERTENCE AO CHAT DE ONDE SAIU O ENVIO, e não ao que está
// aberto: dá para criar outro chat e sair de perto enquanto o modelo responde.
// Antes, cada callback do Python escrevia direto em `#chat-messages` — que é
// sempre o chat VISÍVEL —, e com dois chats abertos um pedaço da resposta caía
// num e o pedaço seguinte no outro.
//
// ⚠️ TUDO QUE CHEGA DO PYTHON VIRA EVENTO, guardado numa lista e pintado só
// quando o chat dono é o que está na tela. A lista não é luxo: o backend só
// grava o chat em disco quando a resposta TERMINA, então, se você voltar no
// meio, não há de onde recarregar o que já chegou. É ela que remonta.
//
// ⚠️ A TIRA "PENSANDO" APARECE POR TEMPO, e não a cada evento
// (`_STREAM_PENSANDO_APOS`): mostrá-la sempre faria ela piscar entre dois
// chunks que chegam juntos.
/* ══════════════════════════════════════════════════════════
   O DONO DO STREAMING

   A resposta pertence ao chat DE ONDE SAIU O ENVIO, e não ao que está aberto:
   dá para criar outro chat e sair de perto enquanto o modelo responde. Antes,
   cada callback do Python escrevia direto em `#chat-messages` — que é sempre o
   chat VISÍVEL. Com dois chats abertos, um pedaço da resposta caía num e o
   pedaço seguinte no outro.

   Agora tudo o que chega do Python vira EVENTO: guardado numa lista e pintado
   só quando o chat dono é o que está na tela. A lista não é luxo — o backend só
   grava o chat em disco quando a resposta TERMINA, então, se você voltar no
   meio, não há de onde recarregar o que já chegou. É ela que remonta.
══════════════════════════════════════════════════════════ */

let _streamChatId = null;
let _streamEventos = [];
let _streamPensando = false;

function iniciarStreamDoChat(chatId) {
  _streamChatId = chatId;
  _streamEventos = [];
  _streamPensando = false;
}

function encerrarStreamDoChat() {
  _streamChatId = null;
  _streamEventos = [];
  _streamPensando = false;
}

// O chat que está na tela é o dono do que está chegando?
function _streamNaTela() {
  return !!_streamChatId && _streamChatId === currentChatId;
}

// Guarda o evento e pinta, se for o caso. Chunks seguidos viram um só: uma
// resposta longa são centenas deles, e a lista existe para remontar a conversa,
// não para guardar a granularidade da rede.
function _streamDespachar(ev) {
  // ⛔ SEM DONO, NÃO PINTA. Aqui havia um "pinta no que está na tela" para o
  // caso de o dono não estar carimbado — e ele era a segunda metade do defeito
  // da resposta que aparecia dentro do chat errado. Qualquer envio de verdade
  // passa por `iniciarStreamDoChat` ANTES de falar com o Python, e os dois
  // desfechos (`finishMessage`, `chatError`) despacham o evento final ANTES de
  // apagar a marca: um evento sem dono é órfão de um envio abandonado, e
  // desenhá-lo em quem estiver aberto é escrever a conversa de um chat dentro
  // de outro. Descartar é o certo, e é silencioso de propósito.
  if (!_streamChatId) return;
  const ultimo = _streamEventos[_streamEventos.length - 1];
  if (ev.t === 'chunk' && ultimo && ultimo.t === 'chunk') ultimo.texto += ev.texto;
  else _streamEventos.push(ev);
  if (_streamNaTela()) _streamAplicar(ev);
}

// O balão da SUA mensagem entra pelo mesmo caminho do resto, e não direto por
// `appendMessage`: ele também precisa voltar à tela quando você sai do chat e
// volta antes de a resposta terminar.
function registrarEnvioDoUsuario(texto) {
  _streamDespachar({ t: 'usuario', texto });
}

// Remonta o envio em curso. Chamada por `openChat` logo depois do
// `renderMessages`, que traz só o que está gravado — ou seja, tudo menos agora.
function replayStreamDoChat() {
  if (!_streamNaTela()) return;
  _streamPensando = false;
  _streamEventos.forEach(ev => _streamAplicar(ev));
}

// Se o programa continua "pensando" DEPOIS deste evento. Ausente = não mexe no
// que já estava (é o caso do aviso, que não muda quem está trabalhando).
const _STREAM_PENSANDO_APOS = {
  usuario: true,        // mandou: daqui até o primeiro pedaço de texto, é espera
  chunk: false,         // já está escrevendo na sua frente
  'sub-inicio': false,  // as rodinhas dos subagentes já dizem o que falta
  'sub-fim': true,      // resultados na mão, o Chat volta a pensar
  descartar: true,      // chamada malformada: vai tentar de novo
  fim: false,
  erro: false,
};

function _streamAplicar(ev) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  // A tira sai do fim ANTES de a conversa crescer, e volta depois: ela é sempre
  // o último elemento, senão ficaria pendurada no meio do histórico.
  _pensandoRemover(container);

  if (ev.t === 'usuario')          appendMessage('user', ev.texto);
  else if (ev.t === 'chunk')       _streamPintarChunk(container, ev.texto);
  else if (ev.t === 'sub-inicio')  _streamPintarChamadas(container, ev.chamadas);
  else if (ev.t === 'sub-fim')     _streamPintarResultados(container, ev.resultados);
  else if (ev.t === 'descartar')   _streamRemoverBolha(container);
  else if (ev.t === 'aviso')       _appendAvisoErro(ev.texto);
  // ⚠️ ERRO não é DESCARTAR. `descartar` é chamada malformada, e o modelo vai
  // tentar de novo — a bolha some porque vai ser reescrita. `erro` é o turno
  // morrendo: apagar a bolha jogava fora o texto que JÁ tinha chegado e já
  // tinha sido pago, e o campo de escrita já tinha sido esvaziado no clique.
  // Congela o que veio (sem o envelope JSON) e põe o aviso embaixo.
  else if (ev.t === 'erro')      { _streamCongelarProsa(container); _appendAvisoErro('Erro: ' + ev.texto); }
  else if (ev.t === 'fim')         _streamFecharBolha(container);

  const apos = _STREAM_PENSANDO_APOS[ev.t];
  if (apos !== undefined) _streamPensando = apos;
  if (_streamPensando) _pensandoPor(container);
}

// ── A tira "pensando" ────────────────────────────────────────────────────────
// NÃO é fala do modelo: é o programa dizendo que ainda tem alguém trabalhando.
// Por isso não é balão — é a mesma etiqueta com rodinha das notificações de
// subagente, e fica na conversa, que é onde você está olhando. Antes essa
// informação morava no botão Enviar, que trocava de texto e mudava de largura
// no meio da linha.
function _pensandoRemover(container) {
  const tira = container.querySelector('.chat-pensando');
  if (tira) tira.remove();
}

function _pensandoPor(container) {
  const tira = document.createElement('div');
  tira.className = 'chat-pensando';
  tira.innerHTML = '<span class="subagent-spinner"></span>'
    + `<span><strong>${escapeHtml(agenteRotulo('chat'))}</strong> está pensando…</span>`;
  container.appendChild(tira);
  _chatScrollToBottom();
}

// ── O desenho de cada evento ─────────────────────────────────────────────────

function _streamPintarChunk(container, chunk) {
  let streaming = container.querySelector('.message-assistant.streaming');
  if (!streaming) {
    streaming = document.createElement('div');
    streaming.className = 'message message-assistant streaming';
    const inner = document.createElement('div');
    inner.className = 'message-content';
    streaming.appendChild(inner);
    container.appendChild(streaming);
  }
  streaming.dataset.raw = (streaming.dataset.raw || '') + chunk;
  const raw = streaming.dataset.raw;
  // O JSON cru nunca aparece. Enquanto ele chega, o que já dá para ler é a fala
  // que veio antes — o aviso entra logo abaixo dela, no lugar do envelope.
  // Aqui a busca não exige o fecho do JSON: ele ainda está sendo digitado.
  const inicio = raw.trimStart();
  const corte = _indiceDaChamada(raw, false);
  const html = streaming.querySelector('.message-content');
  if (corte >= 0 || inicio.startsWith('{') || inicio.startsWith('```')) {
    const prosa = corte > 0 ? raw.slice(0, corte).trim() : '';
    html.innerHTML = (prosa ? renderMarkdown(prosa) : '')
      + '<em class="subagent-thinking">⏳ Preparando chamada de subagentes…</em>';
  } else {
    html.innerHTML = renderMarkdown(raw);
  }
  _chatScrollToBottom();
}

function _streamPintarChamadas(container, chamadas) {
  // A bolha em streaming NÃO é jogada fora: o que o modelo escreveu antes do
  // envelope vira o balão da resposta dele. Só some se ele não tiver dito nada.
  _streamCongelarProsa(container);
  const round = document.createElement('div');
  round.className = 'subagent-round subagent-round-running';
  round.dataset.rodada = String(container.querySelectorAll('.subagent-round').length + 1);
  (chamadas || []).forEach(c => {
    const notice = document.createElement('div');
    notice.className = 'subagent-notice running';
    notice.innerHTML = '<span class="subagent-spinner"></span> '
      + `<strong>${escapeHtml(agenteRotulo(c.subagente))}</strong>: `
      + escapeHtml((c.pergunta || '').slice(0, 90));
    round.appendChild(notice);
  });
  container.appendChild(round);
  _chatScrollToBottom();
}

function _streamPintarResultados(container, resultados) {
  const running = container.querySelector('.subagent-round-running');
  // O número da rodada é o mesmo que as rodinhas já mostravam: ele foi
  // carimbado quando elas apareceram, para a fileira não trocar de nome ao
  // virar resultado.
  const n = (running && running.dataset.rodada)
    ? parseInt(running.dataset.rodada, 10)
    : container.querySelectorAll('.subagent-round').length + 1;
  const lista = resultados || [];
  const round = _makeSubagentRound(
    lista, rotuloDaRodada(n, lista.length, _chatMaxRodadas()));
  round.dataset.rodada = String(n);
  if (running) running.replaceWith(round);
  else container.appendChild(round);
  _chatScrollToBottom();
}

// A bolha em streaming para de ser bolha em streaming e vira a resposta dele,
// sem o envelope. Sem texto nenhum antes do JSON, ela sai — era o que acontecia
// sempre, e é o caso do modelo que chama subagente já na primeira palavra.
function _streamCongelarProsa(container) {
  const streaming = container.querySelector('.message-assistant.streaming');
  if (!streaming) return;
  const { texto } = separarChamadaDoTexto(streaming.dataset.raw || '');
  if (!texto) { streaming.remove(); return; }
  streaming.classList.remove('streaming');
  delete streaming.dataset.raw;
  streaming.querySelector('.message-content').innerHTML = renderMarkdown(texto);
  // Só agora ela é uma mensagem inteira, e só agora ganha o botão de copiar —
  // durante o streaming não há o que copiar, e o texto ainda tem envelope.
  _chatAcoesDaMensagem(streaming, texto);
}

function _streamRemoverBolha(container) {
  const streaming = container.querySelector('.message-assistant.streaming');
  if (streaming) streaming.remove();
}

function _streamFecharBolha(container) {
  const streaming = container.querySelector('.message-assistant.streaming');
  if (!streaming) return;
  // Garante o render final do markdown (a bolha pode estar com o placeholder de
  // chamada). Se a última resposta terminou em envelope, é porque o teto de
  // rodadas acabou e a chamada não foi executada: fica a fala, sai o JSON, e a
  // nota explica o corte — senão o balão pareceria uma frase interrompida.
  if (streaming.dataset.raw) {
    const { texto, chamada } = separarChamadaDoTexto(streaming.dataset.raw);
    streaming.querySelector('.message-content').innerHTML = renderMarkdown(texto);
    if (chamada) {
      if (!texto) streaming.remove();
      // Ao vivo, a chamada que acabou de ser barrada é sempre a última coisa da
      // conversa — então aqui o botão sempre cabe.
      _notaDoPrograma(container, NOTA_TETO_ESTOUROU, true);
    }
    // ⚠️ `isConnected` porque o ramo acima pode ter tirado a bolha da tela
    // (chamada sem fala nenhuma antes dela): pendurar o botão num nó solto não
    // daria erro, e o botão simplesmente não existiria para ninguém.
    if (streaming.isConnected) _chatAcoesDaMensagem(streaming, texto);
  }
  streaming.classList.remove('streaming');
  delete streaming.dataset.raw;
}

