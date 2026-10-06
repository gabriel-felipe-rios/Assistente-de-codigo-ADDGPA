function _initCopyPayloadBtn() {
  const btn = document.getElementById('btn-copy-payload');
  if (!btn || btn._wired) return;
  btn._wired = true;
  btn.addEventListener('click', () => {
    const text = (_lastPayloadItems || []).map(item => {
      const typeKey = item.type || item.role;
      // ⚠️ Todo `meta.tipo` novo entra AQUI TAMBÉM. Faltando, o copiador
      // escreve a chave crua em maiúsculas no cabeçalho do bloco — e ninguém
      // percebe até colar o contexto em outro lugar e ler "RESPOSTA_PARADA".
      const labels = { user: 'USUÁRIO', assistant: 'IA', prompt_fixo: 'PROMPT FIXO',
                       mode_prompt: 'PROMPT FIXO', contexto_regras: 'REGRAS DO PROJETO',
                       system: 'SISTEMA', context: 'CONTEXTO',
                       chamada_barrada: 'CHAMADA BARRADA PELO TETO',
                       resposta_parada: 'RESPOSTA QUE VOCÊ PAROU',
                       aviso_parada: 'AVISO DO SISTEMA' };
      const nome = (item.meta && item.meta.nome) || item.nome || item.mode;
      const label = (labels[typeKey] || typeKey).toUpperCase() + (nome ? ` — ${nome}` : '');
      return `${'═'.repeat(60)}\n${label}\n${'═'.repeat(60)}\n${item.content || ''}`;
    }).join('\n\n');
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✅';
      setTimeout(() => { btn.textContent = orig; }, 1200);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      const orig = btn.textContent;
      btn.textContent = '✅';
      setTimeout(() => { btn.textContent = orig; }, 1200);
    });
  });
}

/* ══════════════════════════════════════════════════════════
   A GERAÇÃO DA ABA CONTEXTO

   Um contador que sobe a cada pintura da aba e a cada troca de chat. Quem
   demora para pintar guarda o número de quando começou e desiste se ele mudou.

   ⚠️ A guarda de `currentChatId`, que já existia, NÃO bastava — e o defeito que
   sobrava era o mais comum de todos, porque acontecia SEM trocar de chat.
   `openChat` dispara duas pinturas do mesmo chat: a PREVISÃO (sem `await`, com
   várias idas ao backend pela frente) e o CONTEXTO REAL, que vem do disco por
   `load_chat_extras`. As duas são do mesmo chat, então a guarda antiga deixava
   as duas passarem — e a previsão, mais lenta, chegava por último e escrevia
   por cima do número certo. A barrinha do rodapé ficava com a conta da
   previsão, ou com a do chat anterior.

   A regra é: quem pinta por último ganha, e quem estava no meio do caminho
   desiste. Como `updatePayloadView` sobe a geração, o dado REAL sempre
   atropela uma previsão em voo — que é a ordem certa, porque previsão só existe
   enquanto não há o de verdade.
══════════════════════════════════════════════════════════ */

let _chatCtxGeracao = 0;

// Chamada do Python: exibe contexto completo na aba Contexto com cores por tipo
function updatePayloadView(items, saveLast = true) {
  const el = document.getElementById('chat-payload-content');
  if (!el) return;
  const geracao = ++_chatCtxGeracao;

  const TYPE_META = {
    user:          { label: '👤 Usuário',              cls: 'payload-block-user' },
    assistant:     { label: '🤖 Chat',                  cls: 'payload-block-assistant' },
    mode_prompt:   { label: '📌 Prompt fixo',           cls: 'payload-block-mode' },
    prompt_fixo:   { label: '📌 Prompt fixo',           cls: 'payload-block-mode' },
    system:        { label: '⚙ Sistema',                cls: 'payload-block-mode' },
    system_principal:{ label: '⚙ Prompt do chat + blocos dos subagentes', cls: 'payload-block-mode' },
    context:       { label: '📄 Contexto (docs)',       cls: 'payload-block-context' },
    contexto_regras:{ label: '📐 Regras do projeto',    cls: 'payload-block-agent-injected' },
    agent_injected:{ label: '🔍 Injetado por agente',  cls: 'payload-block-agent-injected' },
    chamada_subagentes:  { label: '🤖 Chamada de subagentes',    cls: 'payload-block-assistant' },
    resultado_subagentes:{ label: '🧩 Resultado de subagentes',  cls: 'payload-block-agent-injected' },
    chamada_invalida:    { label: '⚠ Chamada inválida',          cls: 'payload-block-assistant' },
    correcao:            { label: '⚠ Prompt de correção',        cls: 'payload-block-mode' },
    aviso_sistema:       { label: '⚠ Aviso do sistema',          cls: 'payload-block-aviso' },
    // Fala do programa, como o aviso do Contador — mesma família, mesma cor.
    rastro_leitura:      { label: '📖 Leitura da tarefa',         cls: 'payload-block-aviso' },
    // ⚠️ Sem entrada aqui, o tipo cai no `TYPE_META.context` do fallback e é
    // rotulado "📄 Contexto (docs)" — o que é falso e passa despercebido,
    // porque a aba continua funcionando. Era o que acontecia com
    // `chamada_barrada`, que estava faltando desde que a marca nasceu.
    chamada_barrada:     { label: '⚠ Chamada barrada pelo teto',  cls: 'payload-block-assistant' },
    resposta_parada:     { label: '⏹ Resposta que você parou',    cls: 'payload-block-assistant' },
    aviso_parada:        { label: '⚠ Aviso do sistema',           cls: 'payload-block-aviso' },
  };

  el.innerHTML = '';

  items.forEach((item, i) => {
    if (i > 0) {
      const sep = document.createElement('hr');
      sep.className = 'payload-sep';
      el.appendChild(sep);
    }

    const typeKey = item.type || item.role;
    const meta = TYPE_META[typeKey] || TYPE_META.context;
    // O nome do prompt fixo vem no meta quando o item veio de um envio real, e
    // solto quando veio do preview. `mode` é o campo dos chats antigos.
    const nome = (item.meta && item.meta.nome) || item.nome || item.mode;
    const label = meta.label + (nome ? ` — ${nome}` : '');

    const block = document.createElement('div');
    block.className = `payload-block ${meta.cls}`;

    const header = document.createElement('div');
    header.className = 'payload-block-header';
    header.textContent = label;

    block.appendChild(header);

    const body = document.createElement('pre');
    body.className = 'payload-block-body';
    body.textContent = item.content || '';
    block.appendChild(body);

    el.appendChild(block);
  });

  el.scrollTop = el.scrollHeight;

  updateContextUsage(items, geracao);
  if (saveLast) _lastPayloadItems = items;
}

let _lastPayloadItems = [];

/** A geração de agora — para quem vai demorar e precisa saber se envelheceu. */
function chatCtxGeracaoAtual() { return _chatCtxGeracao; }

/**
 * Invalida o que estiver pintando a aba Contexto agora.
 *
 * Chamada por `openChat` e `newChat`: abrir outro chat torna sem valor qualquer
 * previsão que ainda esteja no ar, e sem isto a do chat ANTERIOR chegaria
 * atrasada e pintaria a aba do chat que você acabou de abrir.
 */
function chatCtxInvalidar() { _chatCtxGeracao += 1; }

// Atualiza o preview da aba Contexto com base no prompt fixo e nos checkboxes.
// Usa _promptFixoSelecionado, definida em chat-prompt-fixo.js.
async function updateContextPreview() {
  // ⚠️ Aqui havia um `return` quando a sub-aba Contexto não estava aberta. Só
  // que a BARRINHA de uso da janela mora no rodapé, visível de qualquer
  // sub-aba: com a Contexto fechada — que é o normal — ela nunca era
  // recalculada, e o número que você via era do envio anterior, ou zero.
  // O painel escondido receber a montagem não custa nada; quem precisa do
  // resultado é a barra.
  const el = document.getElementById('chat-payload-content');
  if (!el) return;

  // ⚠️ Guarda de corrida. Esta função é disparada SEM `await` na troca de chat
  // (`openChat`, `newChat`), e por dentro ela espera o backend várias vezes. O
  // contexto REAL do chat novo é pintado enquanto ela ainda está no ar, e aí a
  // previsão do chat ANTIGO voltava atrasada e escrevia por cima do número
  // certo — a barra do rodapé passava a mostrar o tamanho da conversa errada.
  // O padrão é o de `_filaAtualizarUsoJanelaDaTarefa` (fila-contexto-tab.js) e
  // o de `openChat` (chat-lista.js): captura antes, desiste se mudou.
  //
  // ⚠️ E a guarda de chat sozinha NÃO bastava: as duas pinturas que `openChat`
  // dispara são do MESMO chat, e a previsão — mais lenta — chegava depois do
  // contexto real e o sobrescrevia. É o defeito de "a barrinha às vezes não
  // atualiza". A GERAÇÃO cobre os dois casos; ver o bloco no topo do arquivo.
  const chatDaPrevisao = currentChatId;
  const geracao = chatCtxGeracaoAtual();
  const aindaNoMesmoChat = () =>
    currentChatId === chatDaPrevisao && geracao === chatCtxGeracaoAtual();

  const promptFixo = _promptFixoSelecionado;

  const agentDefs = [
    { id: 'pipeline',             checkEl: 'ctx-pipeline',             label: 'Pipeline' },
    { id: 'indice-navegacao',     checkEl: 'ctx-indice-navegacao',     label: 'Índice' },
    { id: 'resumo-pastas',        checkEl: 'ctx-resumo-pastas',        label: 'Resumo de Pastas' },
    { id: 'documentacao-tecnica', checkEl: 'ctx-documentacao-tecnica', label: 'Doc. Técnica' },
    { id: 'grafo-imports',        checkEl: 'ctx-grafo-imports',        label: 'Grafo de Imports' },
  ];
  const checkedAgents = agentDefs.filter(a => {
    const cb = document.getElementById(a.checkEl);
    return cb && cb.checked;
  });
  const cbRegras = document.getElementById('ctx-regras');
  const regrasMarcadas = cbRegras && cbRegras.checked;

  // Já houve envio de verdade nesta conversa: o payload real vale mais que
  // qualquer previsão, e é o que a aba mostra.
  if (!promptFixo && checkedAgents.length === 0 && !regrasMarcadas
      && _lastPayloadItems.length > 0) {
    updatePayloadView(_lastPayloadItems);
    return;
  }

  el.innerHTML = '<p class="payload-empty">Carregando...</p>';
  const items = [];

  // ⚠️ O SYSTEM PROMPT vem primeiro, e vem SEMPRE. Ele é a única parte do envio
  // que não depende de caixinha nenhuma — e era justamente a que a previsão não
  // contava. Um chat novo mostrava "0 tokens", que é o número mais errado
  // possível: o envio mínimo custa alguns milhares.
  try {
    const subAtivos = typeof getSubagentesAtivos === 'function' ? getSubagentesAtivos() : [];
    const cfg = { ativos: subAtivos,
                  max_rodadas: typeof getMaxRodadasSubagentes === 'function'
                    ? getMaxRodadasSubagentes() : 1 };
    const rs = await window.pywebview.api.prever_system_prompt_chat(currentProject, cfg);
    if (rs && rs.success && rs.system_prompt) {
      items.push({ type: 'system_principal', content: rs.system_prompt });
    }
  } catch (e) {
    // A previsão é informativa: sem o system prompt ela fica incompleta, mas
    // derrubar a aba inteira por causa dela seria pior.
  }
  if (!aindaNoMesmoChat()) return;

  for (const agent of checkedAgents) {
    const r = await window.pywebview.api.list_agent_files(currentProject, agent.id);
    if (!aindaNoMesmoChat()) return;
    let content = '';
    if (!r.success || r.files.length === 0) {
      content = 'Nenhum arquivo gerado ainda.';
    } else {
      const parts = [];
      for (const fname of r.files) {
        const fr = await window.pywebview.api.read_agent_file(currentProject, agent.id, fname);
        parts.push(`--- ${fname} ---\n${fr.success ? fr.content : `[Erro: ${fr.error}]`}`);
      }
      content = parts.join('\n\n');
    }
    items.push({ type: 'context', content: `${agent.label}\n\n${content}` });
  }

  // Regras e prompt fixo vão no FIM, na mesma ordem em que o envio real monta:
  // documentação é prefixo estável, o que varia acompanha a mensagem de agora.
  if (regrasMarcadas) {
    const r = await window.pywebview.api.list_regras(currentProject);
    if (r.success && r.regras.length > 0) {
      // Espelha o envio real, que manda um bloco por ARQUIVO: a regra é um
      // arquivo só, mas a instrução é uma pasta e vai com todos eles.
      const blocos = [];
      for (const item of r.regras) {
        if (item.tipo === 'instrucao') {
          for (const arq of item.arquivos || []) {
            blocos.push(`### ${item.name} / ${arq.name}\n${arq.content}`);
          }
        } else {
          blocos.push(`### ${item.name}\n${item.content}`);
        }
      }
      items.push({ type: 'contexto_regras', content: `Regras e instruções do projeto\n\n${blocos.join('\n\n')}` });
    } else {
      items.push({ type: 'contexto_regras', content: 'Regras e instruções do projeto\n\nNenhuma regra ou instrução criada ainda.' });
    }
  }

  if (promptFixo) {
    const r = await window.pywebview.api.get_prompt_fixo(promptFixo);
    items.push({
      type: 'prompt_fixo', nome: promptFixo,
      content: r.success ? r.content : `[Erro ao carregar o prompt fixo: ${r.error}]`
    });
  }

  // A última e mais importante: é esta chamada que pinta a aba e recalcula a
  // barra de tokens do rodapé. Sem a guarda aqui, todo o resto seria em vão.
  if (!aindaNoMesmoChat()) return;
  updatePayloadView(items, false);
}
