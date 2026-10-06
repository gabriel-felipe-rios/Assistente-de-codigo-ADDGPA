// ══ CHAT → as chamadas que o Python faz na tela ═══════════════════════════
//
// ⚠️ TODAS PASSAM PELO DESPACHANTE, e NENHUMA toca no DOM direto — era
// exatamente isso que fazia a resposta de um chat aparecer dentro de outro.
// Uma função nova aqui que escreva em `#chat-messages` reabre esse defeito.
//
// ⚠️ TODA FUNÇÃO DAQUI RECEBE `projeto`, e confere se o evento é deste. Com
// vários projetos abertos, um callback sem essa checagem pinta na aba errada.
//
// ⚠️ `chatError` NÃO DESCARTA O QUE JÁ CHEGOU. A metade da resposta que veio
// antes da queda é trabalho pago; o aviso de erro vai ABAIXO dela.
// ── Chamadas vindas do Python (streaming) ────────────────────────────────────
// Todas passam pelo despachante. Nenhuma toca no DOM direto — era exatamente
// isso que fazia a resposta de um chat aparecer dentro de outro.
//
// ⚠️ TODAS RECEBEM `projeto` COMO ÚLTIMO ARGUMENTO, e ele vem do backend
// (`_chat_js`, em chat_mensagem.py). O Chat era a única ponta do programa que
// empurrava evento sem endereço de projeto: as outras 28 já mandavam
// `'project'` no payload e já descartavam o que não é do projeto exibido.
//
// Aqui o filtro sempre foi o `_streamChatId` — de que CHAT é este envio —, e
// isso é uma pergunta diferente: o id de um chat é a hora em que ele foi
// criado, então dois projetos podem ter chats com o mesmo id, e os pedaços da
// resposta de um apareceriam na conversa do outro. Na prática a `TRAVA_IA`
// (um chat responde por vez no programa) escondia o caso, mas isso é proteção
// acidental, não projeto.
//
// `undefined` passa: é o que faz um chamador antigo, ou um teste do console,
// continuar funcionando.
function _streamDesteProjeto(projeto) {
  return !projeto || projeto === currentProject;
}

function appendChunk(chunk, projeto) {
  if (!_streamDesteProjeto(projeto)) return;
  _streamDespachar({ t: 'chunk', texto: chunk });
}

function startSubagentCalls(chamadas, projeto) {
  if (!_streamDesteProjeto(projeto)) return;
  _streamDespachar({ t: 'sub-inicio', chamadas });
}

function finishSubagentCalls(resultados, projeto) {
  if (!_streamDesteProjeto(projeto)) return;
  _streamDespachar({ t: 'sub-fim', resultados });
}

// Descarta a bolha de streaming atual (chamada malformada em correção)
function discardStreaming(projeto) {
  if (!_streamDesteProjeto(projeto)) return;
  _streamDespachar({ t: 'descartar' });
}

// Aviso no meio de um envio que CONTINUA — só põe o balão de erro na conversa.
// Diferente do `chatError`, que encerra o envio: aqui o `finishMessage` ainda
// vem depois, e é ele quem reabilita a entrada.
function chatAviso(texto, projeto) {
  if (!_streamDesteProjeto(projeto)) return;
  _streamDespachar({ t: 'aviso', texto });
}

// O Log e a aba Contexto sofriam do mesmo mal da conversa: o Python os escreve
// no elemento visível, sem saber de quem é. Estes dois envelopes existem só para
// conferir o dono — quem os chama é o backend. As funções de dentro continuam
// abertas para o `openChat`, que restaura o chat que VOCÊ abriu e não pode ser
// barrado por um envio de outro.
function chatLogDoStream(entry, projeto) {
  if (!_streamDesteProjeto(projeto)) return;
  if (_streamNaTela()) addAgentLog(entry);
}

function chatContextoDoStream(items, projeto) {
  if (!_streamDesteProjeto(projeto)) return;
  if (_streamNaTela()) updatePayloadView(items);
}

function finishMessage(newTitle, projeto) {
  if (!_streamDesteProjeto(projeto)) return;
  // ⚠️ ANTES do `encerrarStreamDoChat()`, que zera o dono. É dele que sai qual
  // item da lista renomear — e não `currentChatId`, porque você pode ter saído
  // para outro chat enquanto a resposta vinha.
  const donoDoEnvio = _streamChatId;
  _streamDespachar({ t: 'fim' });
  encerrarStreamDoChat();
  isStreaming = false;
  marcarAssistenteGerando(false);
  setChatInputEnabled(true);
  // ⚠️ O argumento era IGNORADO. O backend sempre mandou o título aqui, e a
  // tela o jogava fora e recarregava a lista inteira do disco — o que funciona,
  // mas é assíncrono: o título piscava depois. Usar o argumento primeiro deixa
  // a troca instantânea; o `loadChatList` continua, para pegar o resto.
  _chatTitularNaLista(donoDoEnvio, newTitle);
  _chatRespondendoNaLista(donoDoEnvio, false);
  _chatBotaoEnviar();
  loadChatList();
  // O prompt fixo volta para "Nenhum" após cada envio, para não ser aplicado
  // sem querer na mensagem seguinte (_setPromptFixo: chat-prompt-fixo.js)
  _setPromptFixo('');
}

function chatError(error, projeto) {
  if (!_streamDesteProjeto(projeto)) return;
  // ⚠️ Quem era o dono do envio, capturado ANTES de `encerrarStreamDoChat()`
  // zerar a marca. Ver `finishMessage`, logo acima, pelo mesmo motivo.
  const donoDoEnvio = _streamChatId;
  _streamDespachar({ t: 'erro', texto: error });
  encerrarStreamDoChat();
  // ⚠️ O ponto "Respondendo" apaga AQUI TAMBÉM, e não só no `finishMessage`:
  // sem esta linha um chat que falha — o LM Studio caindo, o modelo sendo
  // descarregado — fica marcado como respondendo para sempre, e o "×" dele
  // fica apagado até você sair e voltar da aba.
  _chatRespondendoNaLista(donoDoEnvio, false);
  // O botão volta a ser "Enviar" também no erro. Sem isto ele ficaria escrito
  // "Parando…" e apagado, sem nada para parar — e só sairia disso ao recarregar.
  _chatBotaoEnviar();
  // ⚠️ O caminho de ERRO apaga a marca junto. Sem esta linha, uma resposta que
  // falha deixaria a aba acesa para sempre, prometendo um trabalho que morreu.
  isStreaming = false;
  marcarAssistenteGerando(false);
  setChatInputEnabled(true);
  // ⚠️ E solta o que o envio travou. `_lockContextCheckboxes` não desabilita só
  // as caixinhas: ele também escreve `_chatHasHistory = true`. Sem soltar aqui,
  // um envio que falha deixava as caixas mortas E o contexto inicial daquele
  // chat nunca mais era enviado — para sempre, e sem nenhum sinal na tela.
  // O `finishMessage` não solta porque no sucesso o travamento está certo:
  // houve histórico de verdade. Aqui não houve.
  //
  // ⚠️ Só se o erro for DESTE chat. Soltar sem conferir tinha o defeito
  // simétrico: numa retomada recusada — que só existe em conversa com
  // histórico —, e em qualquer erro que chegasse depois de você trocar de
  // chat, a trava caía num chat que TEM histórico, e o contexto inicial dele
  // era mandado de novo na mensagem seguinte, duplicado e sem aviso.
  if (!donoDoEnvio || donoDoEnvio === currentChatId) _unlockContextCheckboxes();
  // Mesma assimetria do prompt fixo: `finishMessage` o devolve para "Nenhum" e
  // o erro não devolvia, deixando-o aplicado na mensagem seguinte sem aviso.
  _setPromptFixo('');
}

function _appendAvisoErro(texto) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'message message-error';
  div.innerHTML = `<div class="message-content">${escapeHtml(texto)}</div>`;
  container.appendChild(div);
  rolarAoFimAgora(container);
}
