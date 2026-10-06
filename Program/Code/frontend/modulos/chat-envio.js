// Envio de mensagem: resolve o contexto inicial e chama send_message.
// Usa _chatHasHistory e _promptFixoSelecionado, definidas em chat-prompt-fixo.js.
// Havia dois caminhos de envio aqui — escolher um "modo" desviava para run_mode,
// que era um fluxo paralelo sem subagentes e sem correção de JSON. Agora o
// prompt fixo é só mais um texto no fluxo normal.
async function sendChatMessage() {
  // Com uma resposta em curso, este MESMO botão é o "Parar" — ver
  // `_chatBotaoParar` no fim do arquivo. O desvio fica aqui, e não num botão
  // novo, porque o Enter no campo também cai nesta função (navegacao.js): dois
  // botões deixariam o Enter mandando outra mensagem no meio da resposta.
  if (isStreaming) { await _chatPararEnvio(); return; }
  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text) return;
  // ⚠️ Notificação, e não modal: não há o que confirmar aqui, só o que informar
  // — e um modal cobraria um clique para fechar o que só precisava ser lido.
  if (!activeModel) { showToast('Nenhum modelo disponível. Verifique se o LM Studio está rodando.', true); return; }

  // ⚠️ A trava de cinco pontas é conferida AQUI, e não só no botão Enviar: o
  // Enter no campo chama esta função direto (navegacao.js), sem passar pelo
  // botão apagado. Era por aqui que dava para mandar mensagem com a Fila, o
  // Designer ou as Rotinas rodando — o backend recusava, mas ninguém olhava a
  // resposta e a tela ficava "pensando" para sempre.
  if (typeof travaIALiberado === 'function' && !await travaIALiberado('chat')) return;

  if (!currentChatId) await newChat();

  // ⚠️ O chat DESTE envio, capturado numa constante, aqui no começo. Daqui para
  // baixo há até sete idas ao backend, cada uma um `await` — e `openChat` troca
  // `currentChatId` de forma SÍNCRONA. Ler a variável global depois dos awaits
  // mandava a mensagem para o chat que você acabou de abrir, não para o que
  // você escreveu.
  const chatDoEnvio = currentChatId;

  // Contexto só é resolvido na primeira mensagem do chat
  let resolvedContextPaths = [];
  if (!_chatHasHistory) {
    const agentCheckIds = ['pipeline', 'indice-navegacao', 'resumo-pastas', 'documentacao-tecnica', 'grafo-imports'];
    for (const ctx of agentCheckIds) {
      const cb = document.getElementById(`ctx-${ctx}`);
      if (cb && cb.checked) {
        const r = await window.pywebview.api.get_agent_abs_paths(currentProject, ctx);
        if (r.success && r.paths.length > 0) resolvedContextPaths.push(...r.paths);
      }
    }
    const cbRegras = document.getElementById('ctx-regras');
    if (cbRegras && cbRegras.checked) {
      const r = await window.pywebview.api.get_regras_abs_paths(currentProject);
      if (r.success && r.paths.length > 0) resolvedContextPaths.push(...r.paths);
    }
  }

  input.value = '';
  // A resposta que vem a seguir é DESTE chat, mesmo que você saia dele antes de
  // ela terminar. Quem carimba o dono é esta linha; daqui para a frente tudo
  // passa pelo despachante de `chat-mensagens.js`, inclusive o seu balão.
  iniciarStreamDoChat(chatDoEnvio);
  // O título troca AGORA, no clique. O servidor grava o mesmo texto logo depois
  // (`_chat_titular_se_novo`), então isto não é um "otimismo" que possa ficar
  // errado — é a mesma regra, aplicada primeiro no lugar onde você olha.
  _chatTitularNaLista(chatDoEnvio, _chatTituloDaPergunta(text));
  // E o ponto "Respondendo" acende no MESMO clique, pelo mesmo motivo e no
  // mesmo lugar: a lista do Chat não tem poll nem assinatura de redesenho, e
  // sem um empurrão daqui ela não muda sozinha. Apaga em `finishMessage` e em
  // `chatError` — os dois, senão um erro deixa o ponto aceso para sempre.
  _chatRespondendoNaLista(chatDoEnvio, true);
  registrarEnvioDoUsuario(text);
  isStreaming = true;
  marcarAssistenteGerando(true);   // bolinha na aba Assistente (abas-processando.js)
  setChatInputEnabled(false);
  // ⚠️ DEPOIS do `setChatInputEnabled(false)`, que apaga o botão: aqui ele
  // volta a acender, agora como "Parar". A caixa de texto e os dois seletores
  // continuam travados — o que mudou é que o botão passou a ter o que fazer.
  _chatBotaoParar(0);
  _lockContextCheckboxes();

  const allContextPaths = resolvedContextPaths.length ? resolvedContextPaths : null;
  const subAtivos = getSubagentesAtivos();
  // Sem `max_tokens`: o teto da resposta do subagente vale para o programa
  // inteiro e mora em Configurações › Ferramentas dos subagentes. O backend o
  // lê de lá quando não vem nada aqui.
  const subCfg = subAtivos.length
    ? { ativos: subAtivos, max_rodadas: getMaxRodadasSubagentes(),
        contador: isAgenteAtivo('contador') }
    : null;
  const r = await window.pywebview.api.send_message(currentProject, chatDoEnvio, text, activeModel,
                                          null, allContextPaths, subCfg,
                                          _promptFixoSelecionado || null);
  // ⚠️ A resposta PRECISA ser lida. `send_message` devolve `success: false`
  // quando a trava recusa (outra ponta pegou a janela entre a conferência acima
  // e esta chamada), e aí nenhum worker sobe — nada vai chamar `finishMessage`.
  // Sem isto a tela ficava travada em "pensando" até reiniciar o app.
  // Reação (D46): "a mensagem saiu" — sai antes da resposta, que vem depois por
  // streaming. Observador, sem `await`.
  if (!(r && r.success === false) && typeof xtEmitir === 'function') {
    xtEmitir('chat.mensagem_enviada', { projeto: currentProject, chat: chatDoEnvio, texto: text });
  }
  if (r && r.success === false) {
    // O texto volta para o campo: perder o que a pessoa escreveu por causa de
    // uma recusa que não é culpa dela seria o pior dos dois erros.
    const campo = document.getElementById('chat-input');
    if (campo && !campo.value.trim()) campo.value = text;
    chatError(r.error || 'não foi possível enviar.');
    if (r.trava) aplicarTravaIA(r.trava);
  }
}

// ── Retomar a chamada que o teto de rodadas barrou ────────────────────
// ⚠️ Isto NÃO reenvia a pergunta e não refaz o que já rodou: o backend executa
// a chamada que ficou gravada e segue o laço de onde parou. Concede o MESMO
// número de rodadas que está configurado (teto 2 → mais 2) e vale SÓ nesta
// conversa — a configuração global não é tocada. Estourando de novo, a faixa
// volta e dá para clicar outra vez.
async function retomarRodadasDoChat(nota, botao) {
  const _soltarBotao = () => { if (botao) botao.disabled = false; };
  if (isStreaming) { _soltarBotao(); return; }
  if (!currentChatId) { _soltarBotao(); return; }
  if (!activeModel) {
    showToast('Nenhum modelo disponível. Verifique se o LM Studio está rodando.', true);
    _soltarBotao();
    return;
  }
  const subAtivos = getSubagentesAtivos();
  if (!subAtivos.length) {
    showToast('Nenhum subagente ativo — não há chamada a retomar.', true);
    _soltarBotao();
    return;
  }
  // ⚠️ A trava é conferida AQUI, como no `sendChatMessage`. Sem isto, com a Fila
  // ou as Rotinas segurando a janela do LM Studio o clique ia até o backend, era
  // recusado, e a tela só descobria pelo balão vermelho.
  if (typeof travaIALiberado === 'function' && !await travaIALiberado('chat')) {
    _soltarBotao();
    return;
  }
  // ⚠️ A faixa só muda DEPOIS de a retomada ser aceita — ver o fim desta
  // função. Ela saía antes do `await`, e uma recusa deixava a conversa sem faixa
  // e sem botão: a chamada barrada continuava lá, sem como retomá-la.
  const chatDoEnvio = currentChatId;
  // Quantas rodadas esta retomada concede. É o mesmo número que o backend usa
  // (`max_rodadas` do `subCfg` logo abaixo) — o selo tem de dizer o que de fato
  // foi concedido, não um número aproximado.
  const rodadasConcedidas = Math.max(getMaxRodadasSubagentes() || 1, 1);

  iniciarStreamDoChat(chatDoEnvio);
  isStreaming = true;
  marcarAssistenteGerando(true);
  setChatInputEnabled(false);

  const subCfg = { ativos: subAtivos, max_rodadas: getMaxRodadasSubagentes(),
                   contador: isAgenteAtivo('contador') };
  const r = await window.pywebview.api.retomar_rodadas_chat(
    currentProject, chatDoEnvio, activeModel, subCfg);
  if (r && r.success === false) {
    // Recusada: a faixa e o botão continuam onde estavam, e ele volta a poder
    // ser clicado. `r.trava` diz QUEM está com a janela — a tela pinta o motivo
    // ao lado dos botões em vez de deixar o usuário adivinhar.
    if (botao) botao.disabled = false;
    if (r.trava && typeof aplicarTravaIA === 'function') aplicarTravaIA(r.trava);
    chatError(r.error || 'não foi possível retomar.');
    return;
  }
  // Aceita: o BOTÃO sai e o selo entra no lugar. ⛔ A faixa inteira NÃO sai —
  // ela tirava da tela a explicação de por que a resposta tinha parado ali, e
  // reaparecia sozinha na primeira vez que o chat fosse redesenhado, porque o
  // que está gravado continua sendo uma chamada barrada. Duas telas diferentes
  // para o mesmo histórico, e a que mentia era a de agora.
  //
  // O backend carimba a mesma marca em disco antes de subir o worker, então
  // sair do chat e voltar no meio da retomada encontra exatamente este desenho.
  if (typeof _chatSeloConcedidas === 'function') _chatSeloConcedidas(nota, rodadasConcedidas);
}

// Ponto único por onde passam o envio, o fim e o erro.
//
// O botão NÃO é mais o indicador. Ele escrevia "Pensando" com pontinhos
// animados, e o texto mais largo que "Enviar" mudava a largura do botão a cada
// envio — a linha inteira se remontava e ele saltava de lugar. Agora o botão só
// apaga (cinza, `.chat-send-group .btn:disabled` em `chat.css`), que é o que ele
// tem a dizer: enquanto a resposta vem, não se manda outra. Quem avisa que há
// trabalho em curso é a tira "pensando" DENTRO da conversa
// (`_pensandoPor`, chat-mensagens.js) — é o programa falando, no lugar onde
// você está olhando.
//
// `ocupadoLocal` existe porque este botão tem DUAS fontes de "desabilitado": o
// envio em curso e a trava de cinco pontas, que pulsa de 4 em 4 segundos
// (`atualizarTravaIA`). Quando o dono da trava é o próprio Chat, ela calcula
// "não está bloqueado" e reabilitaria o botão no meio da resposta. A marca diz
// a ela para não mexer.
function setChatInputEnabled(enabled) {
  const btn = document.getElementById('btn-send-chat');
  const input = document.getElementById('chat-input');
  if (input) input.disabled = !enabled;
  // ⚠️ Os dois seletores da barra travam JUNTO com a caixa de texto. Eles
  // continuavam clicáveis durante a resposta, e o que se escolhia ali não valia
  // para o envio em curso — já mandado — nem sobrava para o seguinte, porque
  // `finishMessage` devolve o prompt fixo para "Nenhum" no fim. Ou seja: o
  // clique era aceito e não fazia nada, em silêncio.
  // `travaIAOcupadoLocal` e não `disabled` direto, pelo mesmo motivo do botão
  // Enviar logo abaixo: o poll de 4 s não pode reabri-los no meio da resposta.
  ['btn-prompt-fixo', 'btn-ctx-inicial'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (typeof travaIAOcupadoLocal === 'function') travaIAOcupadoLocal(el, !enabled);
    else el.disabled = !enabled;
  });
  if (!btn) return;
  // `travaIAOcupadoLocal` e não `disabled` direto: reabrir o botão ao fim de uma
  // resposta não pode passar por cima da trava, se outra ponta pegou a janela
  // enquanto esta terminava. Quem decide se ele fica aceso é a trava.
  if (typeof travaIAOcupadoLocal === 'function') {
    travaIAOcupadoLocal(btn, !enabled);
  } else {
    btn.disabled = !enabled;
    btn.dataset.ocupadoLocal = enabled ? '' : '1';
  }
  if (enabled && typeof atualizarTravaIA === 'function') atualizarTravaIA();
}


// ── O botão que também é o "Parar" ──────────────────────────────────────────
// Três estados, e cada rótulo diz o que o PRÓXIMO clique faz — nunca o que já
// aconteceu, que é o que o desenho do botão já mostra.
//
//   "Parar"       → para no fim da rodada em voo. É o 1º clique.
//   "Parar agora" → corta no meio e aborta os subagentes. É o 2º.
//   "Parando…"    → já foi mandado cortar; não há terceiro clique.
//
// ⚠️ `min-width` FIXO no botão (`.chat-send-group .btn`, em `chat.css`), e não
// é detalhe de acabamento: este botão já escreveu texto variável uma vez — o
// "Pensando" com pontinhos —, e o texto mais largo que "Enviar" mudava a
// largura a cada envio, remontando a linha inteira e fazendo o botão saltar de
// lugar. O texto volta agora porque agora ele tem uma AÇÃO diferente a
// oferecer, e não só um estado a anunciar; a largura travada é o que impede o
// defeito antigo de voltar junto.
const CHAT_BOTAO_PARAR = [
  ['Parar',       'Para no fim da rodada em voo. Clique de novo para cortar na hora.'],
  ['Parar agora', 'Corta no meio da resposta e aborta os subagentes que estiverem rodando.'],
  ['Parando…',    'Já foi mandado cortar — aguarde os subagentes devolverem o que leram.'],
];

function _chatBotaoParar(estagio) {
  const btn = document.getElementById('btn-send-chat');
  if (!btn) return;
  const [rotulo, dica] = CHAT_BOTAO_PARAR[Math.min(estagio, 2)];
  btn.textContent = rotulo;
  btn.title = dica;
  // No estágio 2 não há mais o que clicar. Nos outros o botão precisa ficar
  // ACESO — `setChatInputEnabled(false)` acabou de apagá-lo, e é a marca
  // `ocupadoLocal` que o poll de 4 s consulta para não reabri-lo sozinho.
  if (typeof travaIAOcupadoLocal === 'function') travaIAOcupadoLocal(btn, estagio >= 2);
  else btn.disabled = estagio >= 2;
}

function _chatBotaoEnviar() {
  const btn = document.getElementById('btn-send-chat');
  if (!btn) return;
  btn.textContent = 'Enviar';
  btn.removeAttribute('title');
}

// O clique no "Parar". Sobe um estágio no backend e repinta o botão com o que
// o próximo clique fará.
//
// ⛔ Não mexe em `isStreaming` nem em `_streamChatId`: quem encerra o envio
// continua sendo o `finishMessage` ou o `chatError`, como em qualquer outro
// desfecho. Parar não é um quarto caminho de saída — é um pedido para os dois
// que já existem chegarem mais cedo.
async function _chatPararEnvio() {
  const chatDoEnvio = (typeof _streamChatId !== 'undefined') && _streamChatId;
  if (!chatDoEnvio) return;
  let r;
  try {
    r = await window.pywebview.api.parar_chat(currentProject, chatDoEnvio);
  } catch (e) {
    showToast('Não deu para mandar parar.', true);
    return;
  }
  if (!r || !r.success) { showToast((r && r.error) || 'Não deu para mandar parar.', true); return; }
  _chatBotaoParar(r.estagio);
}
