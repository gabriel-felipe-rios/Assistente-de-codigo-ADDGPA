// ══════════════════════════════════════════════════════ DESIGNER DE INTERFACE ══
// O carregamento de estilos/cores fica em designer-styles.js, o chat/variações
// em designer-chat.js e o modal de preview em designer-preview-modal.js. Aqui
// fica a inicialização da aba, os modelos e as sessões de chat.

let currentDesignChatId     = null;
let estaGerandoDesign       = false;
let selectedDesignVariation = null; // {html, index}
// ⚠️ A carga única é guardada como PROMESSA, não como bandeira booleana. Com
// bandeira, ela subia ANTES do `await` das cinco dimensões: uma segunda entrada
// na aba enquanto a primeira ainda buscava passava direto pelo `if`, seguia com
// `_designDimensoes` nulo, e daí toda escolha lida do disco era descartada por
// "não existe no catálogo" — em silêncio, e o clique seguinte gravava o vazio.
let _designTabPronta        = null;
// `selectedDesignStyle` e `selectedDesignColor` saíram em 2026-08-25: eram duas
// dimensões, e viraram cinco. Quem guarda a escolha agora é `escolhasDoDesigner`
// (designer-styles.js), um objeto só, com os comentários por item junto.

async function initDesignerTab() {
  // Quem chega no meio da carga espera a MESMA promessa, em vez de seguir com a
  // aba pela metade.
  if (!_designTabPronta) {
    // Falha na carga LIMPA a guarda: uma promessa rejeitada guardada aqui deixaria
    // a aba morta até reiniciar o programa, e a próxima entrada tem de tentar de novo.
    _designTabPronta = _prepararDesignerUmaVez()
      .catch(e => { _designTabPronta = null; console.error('initDesignerTab:', e); });
  }
  await _designTabPronta;

  // Daqui para baixo roda a cada entrada na aba, não apenas na primeira vez.
  // A aba nunca é desmontada (o template é injetado uma única vez no boot), então
  // é aqui que o estado de uma geração interrompida precisa ser desfeito.
  resetarEstadoGeracaoDesign();
  // Variação que chegou com a aba escondida não pôde ser medida (clientWidth 0):
  // agora que a aba está visível, reescala.
  _aplicarEscalasMiniaturas(document.getElementById('design-messages'));
  // As escolhas vêm com a SESSÃO, não com o projeto — quem as carrega é
  // `openDesignChat`. Sem sessão aberta, a aba mostra as cinco dimensões vazias.
  renderTodasAsDimensoes();
  updateDesignChips();
  renderSelecaoDesign();
  marcarContextoDesatualizado();
  try { await loadDesignSessions(); } catch(e) { console.error('loadDesignSessions:', e); }
}

// A parte que roda UMA vez: fiar os controles e buscar a biblioteca.
async function _prepararDesignerUmaVez() {
  // ⚠️ As queries são ESCOPADAS ao container do Designer, e as classes são
  // próprias. `navegacao.js` fia as sub-abas do Chat com um
  // `document.querySelectorAll('.chat-subtab-content')` global: se esta fileira
  // usasse aquelas classes, clicar aqui apagaria os painéis do Chat. É o mesmo
  // motivo pelo qual a Fila tem `.fila-tab-*`.
  const escopo = document.getElementById('asubtab-designer');
  escopo.querySelectorAll('.designer-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => abrirAbaDoDesigner(btn.dataset.dtab));
  });

  document.getElementById('btn-new-design-chat').addEventListener('click', createDesignChat);
  document.getElementById('btn-close-style-preview').addEventListener('click', closeStylePreviewModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeStylePreviewModal(); });

  document.getElementById('dchip-base-clear').addEventListener('click', () => {
    selectedDesignVariation = null;
    document.querySelectorAll('.design-variation-card').forEach(c => c.classList.remove('selected-var'));
    updateDesignChips();
  });

  const sendBtn  = document.getElementById('btn-send-design');
  const inputEl  = document.getElementById('design-input');
  const refreshBtn = document.getElementById('btn-refresh-design-model');
  sendBtn.addEventListener('click', sendDesignMessage);
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDesignMessage(); }
  });
  refreshBtn.addEventListener('click', refreshDesignModels);

  try { await loadDesignModels(); } catch(e) { console.error('loadDesignModels:', e); }
  // UMA chamada por dimensão, com nome + conteúdo + tags de todos os itens
  // juntos. Buscar o conteúdo item a item era o que fazia a aba congelar.
  // ⚠️ Este `await` é o motivo de a guarda ser promessa. Ele lê a biblioteca
  // inteira — as cinco dimensões com o conteúdo de cada item — e demora.
  await carregarDimensoesDoDesigner();
}

// Trocar de aba num lugar só: o clique do botão, o "abrir aba" da Seleção e o
// "Enviar ao Designer" chamam esta. A aba Contexto recalcula ao ser aberta, e
// não a cada mudança de escolha — a contagem atravessa a ponte e custa.
function abrirAbaDoDesigner(id) {
  const escopo = document.getElementById('asubtab-designer');
  if (!escopo) return;
  escopo.querySelectorAll('.designer-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.dtab === id));
  escopo.querySelectorAll('.designer-tab-content').forEach(p => {
    const on = p.id === id;
    p.classList.toggle('active', on);
    p.classList.toggle('hidden', !on);
  });
  if (id === 'dtab-contexto') renderContextoDesign();
  else if (id === 'dtab-selecao') renderSelecaoDesign();
  else if (id.startsWith('dtab-')) renderDimensaoAtiva();
}

async function loadDesignModels() {
  const r = await window.pywebview.api.list_models();
  const display = document.getElementById('design-model-name');
  const models = r.models || [];
  if (models.length === 0) {
    display.textContent = 'Nenhum modelo';
    display.style.color = 'var(--red)';
  } else {
    display.textContent = models[0];
    display.style.color = 'var(--text)';
  }
}

function refreshDesignModels() {
  loadDesignModels();
}

// De qual projeto são as escolhas das cinco dimensões na tela. As preferências
// do Designer são gravadas POR PROJETO (`Assistente/Designer/Preferências.json`),
// mas os globais que as seguram na tela não sabiam disso: com abas, trocar de
// projeto deixava as escolhas do outro marcadas, e a próxima geração de design
// sairia com elas.
let _designProjeto = null;

function designerLimparEstadoDeProjeto() {
  if (_designProjeto === currentProject) return;
  _designProjeto = currentProject;
  // ⚠️ Volta ao MOLDE, e não a `{}`: o resto do Designer conta com `texturas` e
  // `animacoes` serem arrays e `comentarios` um objeto (ver designer-styles.js).
  // Esvaziar o objeto trocaria um estado errado por um `undefined.length`.
  if (typeof escolhasDoDesigner !== 'undefined') {
    escolhasDoDesigner = {
      estilo: null, cor: null, tipografia: null,
      texturas: [], animacoes: [], comentarios: {},
    };
  }
  // `_designDimensoes` NÃO entra: é a BIBLIOTECA de estilos e cores
  // (`Arquivos/`), global ao programa — `carregar_dimensoes_de_estilos_e_cores`
  // nem recebe projeto. Zerá-la aqui só forçaria 70 idas e voltas pela ponte a
  // cada troca de aba, pelo mesmo motivo que ela é cacheada.
  // As cinco dimensões precisam ser repintadas: as escolhas marcadas nelas são
  // de outro projeto. `marcarDimensoesSujas()` sem argumento suja todas.
  if (typeof marcarDimensoesSujas === 'function') marcarDimensoesSujas();
  if (typeof _ddTagAtiva !== 'undefined') {
    Object.keys(_ddTagAtiva).forEach(k => { delete _ddTagAtiva[k]; });
  }
}

// Cada chamada de `loadDesignSessions` tira uma senha. Só a mais nova escreve
// na tela — as que estiverem em voo quando outra começar são descartadas na
// volta.
let _designSessoesSenha = 0;

async function loadDesignSessions() {
  if (!currentProject) return; // Aguarda que o projeto seja definido
  designerLimparEstadoDeProjeto();
  const list = document.getElementById('design-chat-list');
  if (!list) return; // Element não existe ainda

  // ⚠️ A LISTA DUPLICAVA, e a causa era esta função ser chamada DUAS VEZES ao
  // trocar de aba de projeto — uma por `enterProject` (navegacao.js, sem
  // await) e outra pelo dispatch da sub-aba Designer (`initDesignerTab`).
  //
  // O molde antigo era: limpar a lista, `await`, e só então preencher. Com duas
  // chamadas em voo, as duas limpam ANTES de qualquer uma preencher, e depois
  // as duas preenchem — cada sessão aparecia duas vezes. Era o "só de clicar
  // ele já aparece duas ali".
  //
  // Duas travas, e as duas precisam existir:
  //   1. a senha — só a chamada mais nova escreve;
  //   2. montar num fragmento e trocar de uma vez — a lista nunca fica vazia
  //      no meio, então nem pisca.
  const senha = ++_designSessoesSenha;
  const proj  = currentProject;
  const r = await window.pywebview.api.list_design_chats(proj);
  if (senha !== _designSessoesSenha || proj !== currentProject) return;

  const fragmento = document.createDocumentFragment();
  (r.chats || []).forEach(chat => {
    const item = document.createElement('div');
    item.className = 'chat-list-item' + (chat.id === currentDesignChatId ? ' active' : '');
    item.dataset.id = chat.id;
    const date = chat.created_at ? new Date(chat.created_at).toLocaleDateString('pt-BR') : '';
    item.innerHTML = `
      <div class="chat-item-info">
        <div class="chat-item-title">${escapeHtml(chat.title)}</div>
        <div class="chat-item-date">${date}</div>
      </div>
      <button class="btn-delete-chat" title="Deletar sessão">✕</button>`;
    item.querySelector('.btn-delete-chat').addEventListener('click', async e => {
      e.stopPropagation();
      await window.pywebview.api.deletar_design_chat(currentProject, chat.id);
      if (currentDesignChatId === chat.id) {
        currentDesignChatId = null;
        document.getElementById('design-messages').classList.add('hidden');
        document.getElementById('design-input-area').classList.add('hidden');
        document.getElementById('design-empty').classList.remove('hidden');
      }
      loadDesignSessions();
    });
    item.addEventListener('click', () => openDesignChat(chat.id));
    fragmento.appendChild(item);
  });
  list.replaceChildren(fragmento);
}

async function createDesignChat() {
  if (!currentProject) { showToast('Nenhum projeto selecionado.', true); return; }
  try {
    const r = await window.pywebview.api.create_design_chat(currentProject);
    if (r && r.success) {
      await loadDesignSessions();
      openDesignChat(r.chat_id);
    } else {
      showToast('Erro ao criar sessão: ' + (r && r.error ? r.error : 'resposta inválida'), true);
    }
  } catch(e) {
    showToast('Erro ao criar sessão: ' + e, true);
  }
}

async function openDesignChat(chatId) {
  // ⚠️ ANTES de trocar de sessão: um comentário ainda sendo digitado grava no
  // `blur`, e a aba Seleção é remontada logo abaixo — o `<textarea>` sai do DOM e o
  // `blur` nunca chega a disparar. Sem este empurrão, escrever um comentário e
  // clicar direto noutra sessão perdia o texto em silêncio.
  if (typeof _dselGravarOQueEstaSendoDigitado === 'function') {
    await _dselGravarOQueEstaSendoDigitado();
  }

  // A conversa inteira é redesenhada abaixo: qualquer referência a cards da
  // sessão anterior (inclusive a variação selecionada) morre junto.
  // `forcar`: trocar de sessão abandona o escopo da geração de verdade — a
  // conversa inteira é redesenhada logo abaixo. É o oposto de reentrar na aba.
  resetarEstadoGeracaoDesign(true);
  selectedDesignVariation = null;

  currentDesignChatId = chatId;
  document.querySelectorAll('#design-chat-list .chat-list-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === chatId);
  });
  const r = await window.pywebview.api.load_design_chat(currentProject, chatId);
  if (!r.success) return;

  document.getElementById('design-empty').classList.add('hidden');
  const msgEl = document.getElementById('design-messages');
  const inputEl = document.getElementById('design-input-area');
  msgEl.classList.remove('hidden');
  inputEl.classList.remove('hidden');

  // Percorre as mensagens aos PARES: uma rodada é (usuário, assistente), e é o
  // par que carrega de qual variação aquela rodada nasceu.
  renderRodadasDesign(r.messages || []);

  // As escolhas são DA SESSÃO: trocar de sessão troca a combinação inteira, e
  // uma sessão nova abre com as cinco dimensões vazias.
  await carregarEscolhasDaSessao();
  renderTodasAsDimensoes();
  updateDesignChips();
  renderSelecaoDesign();
  marcarContextoDesatualizado();
}
