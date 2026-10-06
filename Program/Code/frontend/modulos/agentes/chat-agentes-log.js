// ══ CHAT → Agentes: o log de atividade e a barra de tokens ════════════════
//
// O que os subagentes fizeram nesta conversa, e quanto custou.
//
// ⚠️ A BARRA DE TOKENS SOMA ENTRADA E SAÍDA SEPARADAS, e por subagente. Um
// total único esconde justamente o que interessa: um subagente que lê muito e
// responde pouco custa diferente de um que faz o contrário, e é isso que diz se
// o teto de leitura está apertado ou folgado.
//
// ⚠️ O NOME DE EXIBIÇÃO SAI DE `AGENTES_DEFINICOES`, na casca — nunca escrito à
// mão aqui. Dois lugares nomeando o mesmo agente divergem na primeira vez que
// um deles é renomeado, e o log passa a falar de um agente que a tela não tem.
// ── Log de atividade dos agentes ─────────────────────────────────────────────

function clearAgentLog() {
  const el = document.getElementById('chat-log-content');
  if (!el) return;
  el.innerHTML = '<p class="chat-log-empty">Nenhuma atividade ainda.</p>';
  // Log vazio: os dois botões de expandir/retrair somem, porque não há o que
  // expandir. Voltam na primeira entrada com bloco (ver `addAgentLog`).
  atualizarBotoesDeDetalhes('chat-log-content', 'chat-log-acoes');
  // Trocou de chat: a rolagem volta a acompanhar. Sem isto, quem tivesse
  // subido para ler no chat anterior herdava um log parado no topo.
  rolarAoFimAgora(el);
  _logTokens = {};
  _renderLogTokens();
}

// ── Barra de tokens dos subagentes ───────────────────────────────────────────
// Tokens REAIS (o `usage` da API), acumulados por subagente ao longo do chat.
// Sem barra de progresso de propósito: não há teto a preencher — cada janela de
// subagente é descartada ao fim da chamada. O chat fica de fora: a barra dele é
// outra coisa, com limite de janela.

let _logTokens = {};   // nome → {entrada, saida}

function _somarLogTokens(nome, uso) {
  if (!nome || !uso) return;
  const atual = _logTokens[nome] || { entrada: 0, saida: 0 };
  atual.entrada += uso.entrada || 0;
  atual.saida   += uso.saida   || 0;
  _logTokens[nome] = atual;
}

function _renderLogTokens() {
  const el = document.getElementById('chat-log-tokens');
  if (!el) return;
  const nomes = Object.keys(_logTokens).sort();
  const fmt = n => (n || 0).toLocaleString('pt-BR');

  // Ordem obrigatória, da esquerda para a direita: rótulo → TOTAL → cada um.
  // O total vem logo depois do rótulo porque é o número que se lê primeiro.
  let html = '<span class="chat-log-tokens-rotulo">Tokens dos subagentes</span>';
  if (!nomes.length) {
    el.innerHTML = html + '<span class="chat-log-tokens-vazio">nenhum subagente rodou ainda</span>';
    return;
  }
  const totEntrada = nomes.reduce((s, n) => s + _logTokens[n].entrada, 0);
  const totSaida   = nomes.reduce((s, n) => s + _logTokens[n].saida, 0);
  html += '<span class="chat-log-tokens-item chat-log-tokens-total">'
        + '<span class="chat-log-tokens-nome">TOTAL</span>'
        + `<span class="chat-log-tokens-in">↑ ${fmt(totEntrada)}</span>`
        + `<span class="chat-log-tokens-out">↓ ${fmt(totSaida)}</span></span>`;
  for (const nome of nomes) {
    const u = _logTokens[nome];
    html += '<span class="chat-log-tokens-item">'
          + `<span class="legend-dot legend-${escapeHtml(nome)}"></span>`
          // Nome sem emoji aqui: a bolinha ao lado já identifica quem é, e a
          // barra é densa — emoji e bolinha juntos disputariam o mesmo papel.
          + `<span class="chat-log-tokens-nome">${escapeHtml(agenteNome(nome))}</span>`
          + `<span class="chat-log-tokens-in">↑ ${fmt(u.entrada)}</span>`
          + `<span class="chat-log-tokens-out">↓ ${fmt(u.saida)}</span></span>`;
  }
  el.innerHTML = html;
}

function _makeLogBlock(label, content, cls) {
  const wrap = document.createElement('details');
  wrap.className = `chat-log-block ${cls || ''}`;
  const sum = document.createElement('summary');
  sum.className = 'chat-log-block-header';
  sum.textContent = label;
  const pre = document.createElement('pre');
  pre.className = 'chat-log-block-body';
  pre.textContent = content || '(vazio)';
  wrap.appendChild(sum);
  wrap.appendChild(pre);
  return wrap;
}

// ── Nome de exibição de um agente ────────────────────────────────────────────
// Uma fonte só. O `id` é minúsculo e sem acento porque é chave de arquivo e de
// protocolo com o backend; o que a pessoa lê é o `nome` da definição, com
// acento e maiúscula, e o `icone` que a acompanha. Antes havia três respostas
// diferentes para "como se chama o semantico" — a definição dizia
// "Semântico", o Log dizia "Semantico" e a conversa dizia "semantico".
function _agenteDef(id) {
  if (!id || typeof AGENTES_DEFINICOES === 'undefined') return null;
  return AGENTES_DEFINICOES.find(a => a.id === id) || null;
}

// Só o nome, sem emoji. Para agente que não está na lista (subagente só da
// Fila, prompt fixo novo), capitaliza o id — que era o comportamento antigo.
function agenteNome(id) {
  const def = _agenteDef(id);
  if (def) return def.nome;
  if (!id) return '';
  return id.charAt(0).toUpperCase() + id.slice(1);
}

// Emoji + nome. É o rótulo que aparece na conversa, no Log e nos cards.
function agenteRotulo(id) {
  const def = _agenteDef(id);
  const nome = agenteNome(id);
  return (def && def.icone) ? `${def.icone} ${nome}` : nome;
}

// Mesma coisa, mas a partir do objeto de definição em vez do id. A aba
// Subagentes da Fila monta cards que NÃO estão em AGENTES_DEFINICOES (o agente
// principal, o Contador, o Verificador), então ali o id não acha nada.
function agenteRotuloDoCard(agente) {
  if (!agente) return '';
  return agente.icone ? `${agente.icone} ${agente.nome}` : agente.nome;
}

function _logHora(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString('pt-BR'); } catch { return iso; }
}

function addAgentLog(entry) {
  const el = document.getElementById('chat-log-content');
  if (!el) return;

  const empty = el.querySelector('.chat-log-empty');
  if (empty) empty.remove();

  // Os botões do rodapé nascem escondidos e aparecem quando há bloco. Ligar e
  // atualizar aqui cobre os dois caminhos por onde o Log enche: o streaming ao
  // vivo e a restauração de um chat antigo (`load_chat_extras` → `addAgentLog`).
  ligarBotoesDeDetalhes('chat-log-content', 'btn-chat-log-expandir', 'btn-chat-log-retrair');
  setTimeout(() => atualizarBotoesDeDetalhes('chat-log-content', 'chat-log-acoes'), 0);

  // ── Tipo: usuário ──────────────────────────────────────────────────────────
  if (entry.agente === 'usuario') {
    const group = document.createElement('div');
    group.className = 'chat-log-group chat-log-group-usuario';
    group.dataset.agente = 'usuario';
    const title = document.createElement('div');
    title.className = 'chat-log-group-title';
    title.innerHTML = `<span class="chat-log-group-nome">👤 Usuário</span>`;
    const body = document.createElement('div');
    body.className = 'chat-log-inline-body';
    body.textContent = entry.mensagem || '';
    group.appendChild(title);
    group.appendChild(body);
    el.appendChild(group);
    rolarAoFimSePresa(el);
    return;
  }

  // ── Tipo: chat (resposta do modelo principal) ──────────────────────────────
  if (entry.agente === 'chat') {
    const group = document.createElement('div');
    group.className = 'chat-log-group';
    group.dataset.agente = 'chat';
    const title = document.createElement('div');
    title.className = 'chat-log-group-title';
    title.innerHTML = `<span class="chat-log-group-nome">💬 Chat</span>`;
    group.appendChild(title);
    group.appendChild(_makeLogBlock('Resposta', entry.resposta_bruta || '(vazio)', 'chat-log-block-response'));
    el.appendChild(group);
    rolarAoFimSePresa(el);
    return;
  }

  // ── Tipo: subagente (início/fim de execução) ───────────────────────────────
  if (entry.agente === 'subagente') {
    if (entry.evento === 'inicio') {
      const group = document.createElement('div');
      group.className = 'chat-log-group';
      group.dataset.agente = entry.nome;
      group.innerHTML = `<div class="chat-log-group-title">
        <span class="chat-log-group-nome">${escapeHtml(agenteRotulo(entry.nome))}</span>
        <span class="chat-log-group-status">iniciado ${escapeHtml(_logHora(entry.inicio))}</span>
      </div>`;
      group.appendChild(_makeLogBlock('Pergunta', entry.pergunta || '(vazia)', 'chat-log-block-user'));
      el.appendChild(group);
    } else {
      const group = document.createElement('div');
      group.className = 'chat-log-group';
      group.dataset.agente = entry.nome;
      const statusCls = entry.erro ? 'erro' : '';
      const statusTxt = entry.erro ? `Erro: ${entry.erro}` : `concluído ${_logHora(entry.fim)}`;
      group.innerHTML = `<div class="chat-log-group-title">
        <span class="chat-log-group-nome">${escapeHtml(agenteRotulo(entry.nome))}</span>
        <span class="chat-log-group-status ${statusCls}">${escapeHtml(statusTxt)}</span>
      </div>`;
      if (entry.contexto && entry.contexto.length) {
        const ctxTexto = entry.contexto
          .map(m => `═══ ${m.role.toUpperCase()} ═══\n${m.content}`).join('\n\n');
        group.appendChild(_makeLogBlock('Contexto completo', ctxTexto, 'chat-log-block-sent'));
      }
      if (entry.erro) {
        group.appendChild(_makeLogBlock('Erro', entry.erro, 'chat-log-block-error'));
      } else {
        group.appendChild(_makeLogBlock('Resposta final', entry.resposta || '(vazia)', 'chat-log-block-response'));
      }
      el.appendChild(group);
      // O `uso` vem no evento 'fim' — inclusive quando deu erro, porque as
      // chamadas que aconteceram antes do erro custaram tokens do mesmo jeito.
      _somarLogTokens(entry.nome, entry.uso);
      _renderLogTokens();
    }
    rolarAoFimSePresa(el);
    return;
  }

  // ── Tipo: ferramenta (chamada por um subagente) ────────────────────────────
  if (entry.agente === 'ferramenta') {
    const group = document.createElement('div');
    group.className = 'chat-log-group chat-log-group-ferramenta';
    group.dataset.agente = entry.subagente || 'ferramenta';
    group.innerHTML = `<div class="chat-log-group-title">
      <span class="chat-log-group-nome">${escapeHtml(agenteRotulo(entry.subagente))} — ${escapeHtml(entry.nome)}</span>
      <span class="chat-log-group-status">${escapeHtml(_logHora(entry.inicio))} → ${escapeHtml(_logHora(entry.fim))}</span>
    </div>`;
    group.appendChild(_makeLogBlock('Parâmetros', JSON.stringify(entry.parametros || {}, null, 2), 'chat-log-block-sent'));
    group.appendChild(_makeLogBlock('Resultado', entry.resultado || '(vazio)', 'chat-log-block-response'));
    el.appendChild(group);
    rolarAoFimSePresa(el);
    return;
  }

  // ── Tipo: correção de formato ──────────────────────────────────────────────
  if (entry.agente === 'sistema') {
    const group = document.createElement('div');
    group.className = 'chat-log-group';
    group.dataset.agente = 'sistema';
    group.innerHTML = `<div class="chat-log-group-title">
      <span class="chat-log-group-nome">⚠ Aviso do sistema</span>
    </div>`;
    const body = document.createElement('div');
    body.className = 'chat-log-inline-body';
    body.textContent = entry.mensagem || '';
    group.appendChild(body);
    el.appendChild(group);
    rolarAoFimSePresa(el);
    return;
  }

  if (entry.agente === 'correcao') {
    const group = document.createElement('div');
    group.className = 'chat-log-group';
    group.dataset.agente = entry.alvo === 'chat' ? 'chat' : (entry.alvo || 'sistema');
    group.innerHTML = `<div class="chat-log-group-title">
      <span class="chat-log-group-nome">Correção — ${escapeHtml(agenteRotulo(entry.alvo || 'chat'))}</span>
      <span class="chat-log-group-status erro">tentativa ${entry.tentativa || 1}</span>
    </div>`;
    group.appendChild(_makeLogBlock('Erro detectado', entry.descricao_erro || '', 'chat-log-block-error'));
    el.appendChild(group);
    rolarAoFimSePresa(el);
    return;
  }

  // ── Tipo: prompts fixos e futuros agentes ──────────────────────────────────
  // O mapa de nomes que morava aqui saiu: os três prompts fixos já estão em
  // AGENTES_DEFINICOES, e `agenteRotulo` os alcança de lá.
  const nomes = entry.nomes || [];
  const ehConhecido = !!_agenteDef(entry.agente);

  const group = document.createElement('div');
  group.className = 'chat-log-group';
  // Agente desconhecido cai em 'sistema' — antes caía no 'interceptador', que
  // hoje nem existe mais, e herdava a cor de um agente aposentado.
  group.dataset.agente = ehConhecido ? entry.agente : 'sistema';

  const title = document.createElement('div');
  title.className = 'chat-log-group-title';
  title.innerHTML = `<span class="chat-log-group-nome">${escapeHtml(agenteRotulo(entry.agente))}</span>${entry.erro ? ' <span class="chat-log-group-status erro">Erro</span>' : ''}`;
  group.appendChild(title);

  if (entry.mensagem_usuario) {
    group.appendChild(_makeLogBlock('Mensagem do usuário', entry.mensagem_usuario, 'chat-log-block-user'));
  }
  if (entry.prompt_enviado) {
    group.appendChild(_makeLogBlock('Enviado ao agente', entry.prompt_enviado, 'chat-log-block-sent'));
  }
  if (entry.erro) {
    group.appendChild(_makeLogBlock('Erro', entry.erro, 'chat-log-block-error'));
  } else {
    group.appendChild(_makeLogBlock('Resposta do agente', entry.resposta_bruta || '(vazio)', 'chat-log-block-response'));
  }

  el.appendChild(group);
  rolarAoFimSePresa(el);
}
