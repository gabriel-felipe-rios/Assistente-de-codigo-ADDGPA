/* ══════════════════════════════════════════════════════════
   FILA — sub-aba Contexto: o que foi mandado ao modelo.

   Coluna única de rolar, como a do Chat. A fileira de botões por turno saiu:
   ela obrigava a escolher um turno antes de ver qualquer coisa, e numa
   pesquisa de trinta rodadas isso vira uma fileira ilegível. Agora o turno é
   um cabeçalho no meio do fluxo, e a rolagem faz o resto.

   O conteúdo vem do arquivo de histórico da tarefa, não do estado.json: é lá
   que mora o fluxo completo do agente principal.
══════════════════════════════════════════════════════════ */

const FILA_PAYLOAD_META = {
  system:               { label: '⚙ Sistema — prompt fixo da Fila', cls: 'payload-block-mode' },
  prompt_fixo:          { label: '⚙ Prompt fixo',                   cls: 'payload-block-mode' },
  user:                 { label: '👤 Tarefa',                        cls: 'payload-block-user' },
  assistant:            { label: '🤖 Resposta',                      cls: 'payload-block-assistant' },
  resposta_json:        { label: '🤖 Resposta da Fila (JSON)',       cls: 'payload-block-assistant' },
  chamada_subagentes:   { label: '🤖 Chamada de subagentes',         cls: 'payload-block-assistant' },
  desconhecido:         { label: '⚙ Mensagem',                          cls: 'payload-block-context' },
  resultado_subagentes: { label: '🧩 Resultado de subagentes',        cls: 'payload-block-agent-injected' },
  complemento_usuario:  { label: '👤 Complemento seu',                cls: 'payload-block-user' },
  correcao:             { label: '⚠ Prompt de correção',             cls: 'payload-block-mode' },
  aviso_sistema:        { label: '⚠ Aviso do sistema',               cls: 'payload-block-aviso' },
  // Mesma família visual do aviso do sistema, e de propósito: é o programa
  // falando, não o subagente nem você. A bolinha `legend-sistema` da legenda
  // já cobre os dois — não há cor nova aqui.
  rastro_leitura:       { label: '📖 Leitura da tarefa',              cls: 'payload-block-aviso' },
  devolucao:            { label: '✅ Devolução do Verificador',       cls: 'payload-block-aviso' },
};

function _filaTipoDaMensagem(m) {
  const tipo = (m.meta && m.meta.tipo) || m.role;
  if (tipo === 'resposta_json' && m.meta && m.meta.envelope === 'chamadas') {
    return 'chamada_subagentes';
  }
  return tipo;
}

// O vazio é um parágrafo dentro do próprio container, como no Chat — e não
// um irmão que se esconde. Assim a coluna que rola é sempre a mesma.
function _filaContextoVazio(texto) {
  const el = document.getElementById('fila-contexto-content');
  if (el) el.innerHTML = `<p class="payload-empty">${escapeHtml(texto)}</p>`;
}

async function _filaRenderContextoTab() {
  const el = document.getElementById('fila-contexto-content');
  if (!el) return;
  const tarefa = _filaTarefas.find(t => t.id === _filaSelecionadaId);
  if (!tarefa) {
    _filaContextoVazio('Selecione uma tarefa para ver o contexto enviado ao modelo.');
    return;
  }

  const mensagens = await window.pywebview.api.carregar_fila_historico(
    currentProject, tarefa.id);
  // ⚠️ Mesma guarda de corrida da sub-aba Fila: a tarefa foi capturada antes do
  // `await`, e trocar de tarefa no meio pintava o contexto da anterior.
  if (_filaSelecionadaId !== tarefa.id) return;
  if (!mensagens || !mensagens.length) {
    _filaContextoVazio('Esta tarefa ainda não foi enviada ao modelo.');
    el.dataset.assinatura = '';
    return;
  }

  // O polling volta de 4 em 4 segundos, e na maioria das vezes não há mensagem
  // nova. Remontar a coluna inteira à toa piscava a tela e ainda descartava a
  // posição de leitura. A assinatura é barata: quantas mensagens, e o tamanho
  // da última — que é a única que ainda pode crescer.
  const ultima = mensagens[mensagens.length - 1] || {};
  const assinatura = `${tarefa.id}|${mensagens.length}|${(ultima.content || '').length}`;
  if (el.dataset.assinatura === assinatura) return;
  el.dataset.assinatura = assinatura;

  el.innerHTML = '';

  // Um "envio" é cada ida ao modelo: começa no que foi mandado e fecha na
  // resposta. O cabeçalho marca a virada, no meio do fluxo.
  let envio = 0;
  let abriuEnvio = false;

  mensagens.forEach((m, i) => {
    // A Fila grava TODA resposta do agente principal como `resposta_json`; o
    // que diz se aquela ida foi pedir subagentes ou entregar o relatório é o
    // envelope. Sem isto, a chamada aparecia com o mesmo rótulo da entrega.
    let tipo = _filaTipoDaMensagem(m);
    // Fallback deixou de ser `assistant`: um tipo novo qualquer aparecia
    // dizendo que era resposta do agente, o que é pior do que não saber.
    const meta = FILA_PAYLOAD_META[tipo] || FILA_PAYLOAD_META.desconhecido;

    if (m.role !== 'assistant' && !abriuEnvio) {
      envio += 1;
      abriuEnvio = true;
      const cab = document.createElement('div');
      cab.className = 'fila-contexto-envio';
      cab.textContent = `${FILA_AGENTE_PRINCIPAL.icone} ${FILA_AGENTE_PRINCIPAL.nome} — envio ${envio}`;
      el.appendChild(cab);
    }
    if (m.role === 'assistant') abriuEnvio = false;

    if (i > 0) {
      const sep = document.createElement('hr');
      sep.className = 'payload-sep';
      el.appendChild(sep);
    }

    const block = document.createElement('div');
    block.className = `payload-block ${meta.cls}`;

    const header = document.createElement('div');
    header.className = 'payload-block-header';
    header.textContent = meta.label;

    // O aviso do contador de rodadas vem colado no fim do bloco de resultado.
    // Ele sai para um bloco próprio, como o Chat faz em
    // `chat_mensagem.py::_build_payload_items` — é fala do programa, não do
    // subagente, e lida junto passava por conclusão de quem pesquisou.
    const aviso = (m.meta && m.meta.aviso) || '';
    let corpo = m.content || '';
    const separar = aviso && corpo.includes(aviso);
    if (separar) corpo = corpo.replace('\n\n' + aviso, '').replace(aviso, '');

    const body = document.createElement('pre');
    body.className = 'payload-block-body';
    body.textContent = corpo;

    block.appendChild(header);
    block.appendChild(body);
    el.appendChild(block);

    if (separar) {
      const av = FILA_PAYLOAD_META.aviso_sistema;
      const blocoAviso = document.createElement('div');
      blocoAviso.className = `payload-block ${av.cls}`;
      const cabAviso = document.createElement('div');
      cabAviso.className = 'payload-block-header';
      cabAviso.textContent = av.label;
      const corpoAviso = document.createElement('pre');
      corpoAviso.className = 'payload-block-body';
      corpoAviso.textContent = aviso;
      blocoAviso.appendChild(cabAviso);
      blocoAviso.appendChild(corpoAviso);
      el.appendChild(blocoAviso);
    }
  });

  _filaAtualizarUsoJanela(mensagens);
}

// A barra do rodapé é da TAREFA selecionada, não da sub-aba aberta. Ela vivia
// pendurada em `_filaRenderContextoTab`, que só roda com a sub-aba Contexto na
// frente: andar entre as tarefas com a sub-aba Fila aberta deixava o número da
// tarefa anterior no rodapé. Este é o caminho que não depende de sub-aba —
// `_filaSelecionarTarefa` chama daqui.
async function _filaAtualizarUsoJanelaDaTarefa() {
  const fill = document.getElementById('fila-usage-fill');
  const text = document.getElementById('fila-usage-text');
  if (!fill || !text) return;

  const id = _filaSelecionadaId;
  const tarefa = _filaTarefas.find(t => t.id === id);
  if (!tarefa) {
    fill.style.width = '0%';
    fill.className = 'context-usage-fill';
    text.textContent = '—';
    return;
  }

  let mensagens = [];
  try {
    mensagens = await window.pywebview.api.carregar_fila_historico(currentProject, id);
  } catch (e) { /* barra fica com o que _filaAtualizarUsoJanela puser */ }

  // Clicar rápido entre tarefas dispara várias leituras; a que volta atrasada
  // não pode sobrescrever o número da tarefa que está selecionada AGORA.
  if (_filaSelecionadaId !== id) return;
  _filaAtualizarUsoJanela(mensagens || []);
}

// Tokens contados pelo backend com tiktoken, nunca por `caracteres / 4` — a
// divisão erra para menos justamente em código, que é o que a Fila mais lê.
async function _filaAtualizarUsoJanela(mensagens) {
  const fill = document.getElementById('fila-usage-fill');
  const text = document.getElementById('fila-usage-text');
  if (!fill || !text) return;
  try {
    const textos = (mensagens || []).map(m => m.content || '');
    const r = await window.pywebview.api.contar_tokens_textos(textos);
    const tokens = (r && r.success) ? r.tokens : 0;
    const fmt = n => n.toLocaleString('pt-BR');
    // Dois números, e não uma porcentagem: é o formato do Chat
    // (`chat-contexto-inicial.js`). A porcentagem sozinha esconde justamente o
    // que decide a pergunta — quanto ainda cabe antes de estourar a janela que
    // você configurou no LM Studio. A barra já dá a proporção.
    const limite = (typeof _contextWindowLimit !== 'undefined') ? _contextWindowLimit : null;
    if (limite) {
      const pct = Math.min(100, (tokens / limite) * 100);
      fill.style.width = pct + '%';
      fill.className = 'context-usage-fill ' + (pct < 60 ? 'ok' : pct < 85 ? 'warn' : 'full');
      text.textContent = `${fmt(tokens)} / ${fmt(limite)} tokens`;
    } else {
      fill.style.width = '0%';
      fill.className = 'context-usage-fill';
      text.textContent = `${fmt(tokens)} tokens`;
    }
  } catch (e) {
    text.textContent = '—';
  }
}
