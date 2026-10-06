// ══════════════════════════════════════════════════════════════════ CHAT ══
// Ciclo de vida do chat: inicialização, lista de chats, abrir/criar chat.
async function initChat() {
  await Promise.all([loadModels(), loadChatList()]);
  document.getElementById('chat-empty').classList.remove('hidden');
  document.getElementById('chat-messages').classList.add('hidden');
  document.getElementById('chat-input-area').classList.add('hidden');
}

async function loadModels() {
  const r = await window.pywebview.api.list_models();
  const indicator = document.getElementById('model-name');
  const refreshBtn = document.getElementById('btn-refresh-model');
  if (r.success && r.models.length > 0) {
    activeModel = r.models[0];
    indicator.textContent = activeModel;
    indicator.classList.remove('model-offline');
    if (refreshBtn) refreshBtn.title = 'Atualizar modelo';
    // Janela de contexto do modelo carregado (para a barra de tokens)
    try {
      const cw = await window.pywebview.api.get_context_window();
      _contextWindowLimit = (cw && cw.success) ? cw.context_length : null;
    } catch (e) { _contextWindowLimit = null; }
  } else {
    activeModel = '';
    indicator.textContent = 'LM Studio offline';
    indicator.classList.add('model-offline');
    _contextWindowLimit = null;
  }
  // Há UM modelo para o programa inteiro, e quem o busca é esta função. As
  // outras telas espelham o valor em vez de repetir a requisição — sem isto a
  // Fila abriria mostrando "LM Studio offline" até alguém clicar no ⟳ dela.
  if (typeof _filaMostrarModelo === 'function') _filaMostrarModelo();
}

// O título do chat sai da PRIMEIRA pergunta, cortado em 60 caracteres. O corte
// é o mesmo do backend (`_chat_titular_se_novo`, chat_mensagem.py) de propósito:
// se os dois divergissem, o título mudaria sozinho ao recarregar a lista, e isso
// pareceria defeito.
function _chatTituloDaPergunta(texto) {
  return (texto || '').slice(0, 60).replace(/\n/g, ' ');
}

// Troca o título de UM item da lista, sem remontar tudo. Serve para o título
// aparecer no CLIQUE do Enviar: antes ele só mudava quando a resposta inteira
// terminava, e uma pergunta longa deixava "Novo chat" na tela por minutos.
function _chatTitularNaLista(chatId, titulo) {
  if (!chatId || !titulo) return;
  const item = document.querySelector(`.chat-list-item[data-chat-id="${chatId}"]`);
  const alvo = item && item.querySelector('.chat-item-title');
  if (!alvo) return;
  // Só um chat ainda sem nome. Renomear por cima de um título de verdade
  // apagaria o nome do chat a cada mensagem nova.
  if (alvo.textContent.trim() !== 'Novo chat') return;
  alvo.textContent = titulo;
}

async function loadChatList() {
  const r = await window.pywebview.api.list_chats(currentProject);
  renderChatList(r.chats || []);
  // Toda troca de chat passa por aqui (`openChat`, `newChat`, remover) — e a
  // abertura da sub-aba também: é o lugar único para repintar o ponto.
  xtPintarEncaixeDoChat();
}

// Ponto de encaixe `chat.painel` (fase 11). Seguro sem extensão nenhuma.
function xtPintarEncaixeDoChat() {
  const alvo = document.getElementById('chat-encaixe');
  if (!alvo || typeof xtEncaixe !== 'function') return;
  xtEncaixe('chat.painel', alvo, {
    projeto: (typeof currentProject !== 'undefined' && currentProject) || null,
    chat: (typeof currentChatId !== 'undefined' && currentChatId) || null,
  });
}

// O motivo escrito no "×" apagado do chat que está respondendo. Frase única: ela
// aparece no `title` do botão e no aviso de quem clicar assim mesmo.
const CHAT_MOTIVO_RESPONDENDO =
  'Não dá para remover um chat que está respondendo. Espere a resposta terminar.';

// O ponto de estado do card, no mesmo desenho da Fila (`.fila-card-dot` +
// `.fila-card-status-label`, em `agentes-execucao.css`): é o mesmo objeto
// visual — "esta conversa está trabalhando" —, e dois desenhos para a mesma
// coisa seriam ruído. A cor é `st-azul`, a mesma do "Pesquisando" da Fila.
//
// ⛔ NÃO pulsa. A aba Assistente já tem uma bolinha azul pulsante dizendo outra
// coisa (`marcarAssistenteGerando`), e um segundo pulso a poucos centímetros
// dela deixaria de informar para virar barulho. Sólido basta: quem olha a lista
// quer saber QUAL chat está respondendo, e o ponto já responde isso.
const CHAT_ESTADO_RESPONDENDO =
  '<div class="fila-item-estado" data-chat-respondendo>'
  + '<span class="fila-card-dot st-azul"></span>'
  + '<span class="fila-card-status-label st-azul">Respondendo</span></div>';

/**
 * Acende ou apaga o "Respondendo" de UM item da lista, sem remontar tudo.
 *
 * ⚠️ Existe porque a lista do Chat NÃO tem assinatura de redesenho e NÃO tem
 * poll — diferente da Fila, que repinta sozinha a cada 4 s. Aqui nada muda se
 * ninguém mandar: o ponto nunca acenderia por conta própria. Quem manda são
 * três lugares, e os três são obrigatórios — o clique do Enviar
 * (`sendChatMessage`), o `finishMessage` e o `chatError`. Faltando o do erro,
 * um chat que falha fica "Respondendo" para sempre.
 *
 * É a mesma mecânica cirúrgica de `_chatTitularNaLista`, logo acima.
 */
function _chatRespondendoNaLista(chatId, respondendo) {
  if (!chatId) return;
  const item = document.querySelector(`.chat-list-item[data-chat-id="${chatId}"]`);
  if (!item) return;
  const info = item.querySelector('.chat-item-info');
  const marca = item.querySelector('[data-chat-respondendo]');
  const botao = item.querySelector('.btn-delete-chat');
  if (respondendo && !marca && info) info.insertAdjacentHTML('beforeend', CHAT_ESTADO_RESPONDENDO);
  else if (!respondendo && marca) marca.remove();
  // O "×" acompanha: enquanto o chat responde, o motor recusa apagá-lo. Antes,
  // a tela deixava clicar e o clique voltava como erro vermelho — a Fila já
  // fazia o certo, e o Chat era o que destoava.
  if (botao) {
    botao.disabled = !!respondendo;
    botao.title = respondendo ? CHAT_MOTIVO_RESPONDENDO : 'Remover chat';
  }
}

/**
 * A confirmação antes de remover um chat. Devolve `true` para seguir.
 *
 * ⚠️ Ela DIZ O QUE SE PERDE, item por item, em vez de perguntar "tem certeza?":
 * o que some não é só a conversa — vão junto o Log, o Contexto e os toggles de
 * subagente daquele chat, e nada disso é óbvio de fora.
 *
 * Respeita "Perguntar antes de remover" (Configurações › Encerrar e excluir).
 * Desligada, o clique volta a apagar direto.
 */
function _chatConfirmarRemocao(titulo) {
  if (appSettings.confirmar_ao_deletar === false) return Promise.resolve(true);
  return new Promise(resolve => {
    let confirmou = false;
    const overlay = abrirModalPadrao({
      title: 'Remover este chat?',
      confirmLabel: 'Remover',
      bodyHtml: `<div class="modal-body-text">Isto apaga <strong>${escapeHtml(titulo || 'este chat')}</strong>:
        a conversa, o Log, o Contexto e os toggles de subagente deste chat.<br><br>
        <strong>Não dá pra desfazer.</strong></div>`,
      onConfirm: () => { confirmou = true; },
    });
    // O modal sai do DOM por três caminhos — Confirmar, Cancelar e clique fora —
    // e a promessa precisa ser resolvida nos três, senão um Cancelar deixaria o
    // clique no "×" pendurado para sempre, sem fazer nada e sem deixar rastro.
    new MutationObserver((_m, obs) => {
      if (!overlay.isConnected) { obs.disconnect(); resolve(confirmou); }
    }).observe(document.body, { childList: true });
  });
}

function renderChatList(chats) {
  const list = document.getElementById('chat-list');
  list.innerHTML = '';
  if (!chats.length) { list.innerHTML = '<div class="chat-list-empty">Nenhum chat ainda.</div>'; return; }
  chats.forEach(chat => {
    const div = document.createElement('div');
    div.className = 'chat-list-item' + (chat.id === currentChatId ? ' active' : '');
    // O id no elemento é o que permite trocar o título de UM item sem
    // remontar a lista inteira — ver `_chatTitularNaLista`.
    div.dataset.chatId = chat.id;
    const date = chat.created_at ? new Date(chat.created_at).toLocaleDateString('pt-BR') : '';
    // ⚠️ O estado nasce JUNTO do card, e não só por `_chatRespondendoNaLista`:
    // `loadChatList` remonta a lista inteira em várias situações (criar chat,
    // abrir chat, terminar uma resposta) e apagaria o ponto de um envio ainda em
    // curso NOUTRO chat. O dado é `_streamChatId`, do próprio frontend — não
    // precisa de API nova.
    const respondendo = (typeof _streamChatId !== 'undefined') && _streamChatId === chat.id;
    div.innerHTML = `
      <div class="chat-item-info">
        <div class="chat-item-title">${escapeHtml(chat.title)}</div>
        <div class="chat-item-date">${date}</div>
        ${respondendo ? CHAT_ESTADO_RESPONDENDO : ''}
      </div>
      <button class="btn-delete-chat" ${respondendo ? 'disabled' : ''} title="${
        respondendo ? escapeHtml(CHAT_MOTIVO_RESPONDENDO) : 'Remover chat'}">×</button>`;
    div.querySelector('.btn-delete-chat').addEventListener('click', async (e) => {
      e.stopPropagation();
      // Guarda de tela. O motor também recusa — e continua recusando, porque ele
      // é o guarda final: entre pintar a lista e clicar, a resposta pode começar.
      if (_streamChatId === chat.id) { showToast(CHAT_MOTIVO_RESPONDENDO, true); return; }
      if (!await _chatConfirmarRemocao(chat.title)) return;
      const r = await window.pywebview.api.deletar_chat(currentProject, chat.id);
      // O backend recusa apagar um chat que está respondendo. Sem ler a
      // resposta, o clique parecia não fazer nada — e o motivo, que existe,
      // ficava no vazio.
      if (r && !r.success) { showToast(r.error || 'Falha ao remover o chat', true); return; }
      if (currentChatId === chat.id) {
        currentChatId = null;
        document.getElementById('chat-empty').classList.remove('hidden');
        document.getElementById('chat-messages').classList.add('hidden');
        document.getElementById('chat-input-area').classList.add('hidden');
      }
      await loadChatList();
    });
    div.addEventListener('click', () => openChat(chat.id));
    list.appendChild(div);
  });
}

async function newChat() {
  const r = await window.pywebview.api.new_chat(currentProject);
  if (r.success) {
    currentChatId = r.chat_id;
    chatCtxInvalidar();  // mesmo motivo do `openChat`
    _unlockContextCheckboxes();
    _lastPayloadItems = [];
    const payloadEl = document.getElementById('chat-payload-content');
    if (payloadEl) payloadEl.innerHTML = '<p class="payload-empty">Nenhum envio ainda. Envie uma mensagem para ver o contexto completo.</p>';
    clearAgentLog();
    setChatSubagentesOverride(null); // chat novo começa com o estado global dos toggles
    // ⚠️ `newChat()` não passava pela previsão, e é o caso em que ela mais
    // importa: um chat novo era exatamente o que mostrava "0 tokens" na
    // barrinha do rodapé. Vem DEPOIS do `setChatSubagentesOverride`, senão a
    // previsão usaria os subagentes do chat anterior.
    // Sem `await`: é uma barra informativa, e nada depende dela.
    if (typeof updateContextPreview === 'function') updateContextPreview();
    showChatArea();
    document.getElementById('chat-messages').innerHTML = '';
    await loadChatList();
    document.getElementById('chat-input').focus();
  }
}

async function openChat(chatId) {
  currentChatId = chatId;
  // ⚠️ Mata qualquer previsão de contexto ainda no ar — inclusive a deste
  // mesmo chat, se você reabriu. Ver o bloco "A geração da aba Contexto" em
  // `chat-payload.js`: sem isto, a previsão lenta chega depois do contexto real
  // e a barrinha do rodapé fica com o número errado.
  chatCtxInvalidar();
  const r = await window.pywebview.api.load_chat(currentProject, chatId);
  // ⚠️ Guarda de corrida: `currentChatId` é trocado de forma SÍNCRONA no
  // clique, e este `await` demora. Dois cliques rápidos na lista e a conversa
  // do primeiro chegava depois, sobrescrevendo a do segundo — a lista mostrava
  // um chat selecionado e a tela mostrava o outro. O padrão é o mesmo de
  // `_filaAtualizarUsoJanelaDaTarefa`, em fila-contexto-tab.js.
  if (currentChatId !== chatId) return;
  if (r.success) {
    showChatArea();
    renderMessages(r.messages);
    // O que está gravado em disco é tudo menos o envio de AGORA: o backend só
    // grava o chat quando a resposta termina. Se você saiu no meio e voltou, é
    // esta linha que devolve à tela o que já tinha chegado.
    replayStreamDoChat();
    await loadChatList();

    // Restaura contexto, log e estado dos subagentes salvos do chat
    _lastPayloadItems = [];
    const payloadEl = document.getElementById('chat-payload-content');
    if (payloadEl) payloadEl.innerHTML = '<p class="payload-empty">Envie uma mensagem para atualizar o contexto.</p>';
    clearAgentLog();
    // Um chat recém-aberto ainda não passou pela previsão, e a barrinha ficaria
    // com o número do chat anterior. Sem `await`: é uma barra informativa.
    if (typeof updateContextPreview === 'function') updateContextPreview();
    try {
      const ex = await window.pywebview.api.load_chat_extras(currentProject, chatId);
      if (currentChatId !== chatId) return;  // mesma corrida, segundo await
      if (ex && ex.success) {
        (ex.log || []).forEach(e => addAgentLog(e));
        if (ex.contexto && ex.contexto.length) updatePayloadView(ex.contexto);
        setChatSubagentesOverride(ex.subagentes);
      }
    } catch (e) { /* chats antigos não têm extras */ }

    const temMensagens = r.messages.some(m => m.role === 'user');
    if (temMensagens) _lockContextCheckboxes(); else _unlockContextCheckboxes();
  }
}

function showChatArea() {
  document.getElementById('chat-empty').classList.add('hidden');
  document.getElementById('chat-messages').classList.remove('hidden');
  document.getElementById('chat-input-area').classList.remove('hidden');
  _initCopyPayloadBtn();
  _initCtxInicialPanel();
  _initPromptFixoPanel();
}
