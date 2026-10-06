/* ══════════════════════════════════════════════════════════
   FILA — sub-aba Log: histórico de agentes e ferramentas.

   É o Log do Chat, com uma diferença de origem: o do Chat é escrito ao vivo,
   evento por evento, e some quando você troca de chat; o daqui é RECONSTRUÍDO
   do que está gravado, porque uma pesquisa da fila roda enquanto você está em
   outra aba — ou em outro dia. Sair da aba e voltar tem de mostrar o que
   aconteceu, não uma tela vazia.

   Duas fontes, e é de propósito: `tarefa.log.eventos` (no estado.json) guarda
   a ordem e os títulos, que a lista lateral já lê a cada polling; o corpo das
   chamadas de ferramenta — parâmetros e resultado, o campo mais gordo do log —
   mora em `Assistente/Fila/Log/{id}.jsonl` e só é lido quando você abre esta aba.
══════════════════════════════════════════════════════════ */

// ── Barra de tokens dos subagentes ───────────────────────────────────────────
// Tokens REAIS (o `usage` da API), somados por subagente dentro DESTA tarefa.
// Zera ao trocar de tarefa, como a do Chat zera ao trocar de chat. O agente
// principal fica de fora, também como no Chat: o custo dele já tem barra
// própria, com limite de janela, no rodapé da área de envio.
let _filaLogTokens = {};

function _filaResetTokens() {
  _filaLogTokens = {};
  _filaRenderLogTokens();
}

function _filaSomarTokens(nome, uso) {
  if (!nome || nome === 'fila' || !uso) return;
  const atual = _filaLogTokens[nome] || { entrada: 0, saida: 0 };
  atual.entrada += uso.entrada || 0;
  atual.saida += uso.saida || 0;
  _filaLogTokens[nome] = atual;
}

// Refaz a soma a partir do que está gravado. É isto que conserta o "nenhum
// subagente rodou ainda" que aparecia depois de sair da aba e voltar: antes a
// barra só conhecia o que tinha chegado ao vivo pela notificação do Python.
function _filaRecontarTokens(tarefa) {
  _filaLogTokens = {};
  const eventos = (tarefa && tarefa.log && tarefa.log.eventos) || [];
  eventos.forEach(ev => {
    if (ev.agente === 'subagente' && ev.evento === 'fim') _filaSomarTokens(ev.nome, ev.uso);
  });
  _filaRenderLogTokens();
}

function _filaRenderLogTokens() {
  const el = document.getElementById('fila-log-tokens');
  if (!el) return;
  const nomes = Object.keys(_filaLogTokens).sort();
  const fmt = n => (n || 0).toLocaleString('pt-BR');

  // Ordem obrigatória, da esquerda para a direita: rótulo → TOTAL → cada um.
  let html = '<span class="chat-log-tokens-rotulo">Tokens dos subagentes</span>';
  if (!nomes.length) {
    _filaTrocarHtml(el, html + '<span class="chat-log-tokens-vazio">nenhum subagente rodou ainda</span>');
    return;
  }
  const totEntrada = nomes.reduce((s, n) => s + _filaLogTokens[n].entrada, 0);
  const totSaida = nomes.reduce((s, n) => s + _filaLogTokens[n].saida, 0);
  html += '<span class="chat-log-tokens-item chat-log-tokens-total">'
        + '<span class="chat-log-tokens-nome">TOTAL</span>'
        + `<span class="chat-log-tokens-in">↑ ${fmt(totEntrada)}</span>`
        + `<span class="chat-log-tokens-out">↓ ${fmt(totSaida)}</span></span>`;
  for (const nome of nomes) {
    const u = _filaLogTokens[nome];
    html += '<span class="chat-log-tokens-item">'
          + `<span class="legend-dot legend-${escapeHtml(nome)}"></span>`
          + `<span class="chat-log-tokens-nome">${escapeHtml(agenteNome(nome))}</span>`
          // Zero de entrada E de saída não é contagem que falhou: é subagente
          // que não fala com o modelo — o Navegador só lê o disco. "↑ 0 ↓ 0" se
          // lia como defeito, e era o comportamento certo.
          + ((u.entrada || u.saida)
              ? `<span class="chat-log-tokens-in">↑ ${fmt(u.entrada)}</span>`
                + `<span class="chat-log-tokens-out">↓ ${fmt(u.saida)}</span>`
              : '<span class="chat-log-tokens-sem-llm">sem LLM</span>')
          + '</span>';
  }
  _filaTrocarHtml(el, html);
}

// Reescrever a barra a cada 4 segundos com o MESMO conteúdo piscava à toa.
function _filaTrocarHtml(el, html) {
  if (el.innerHTML !== html) el.innerHTML = html;
}

// ── Um grupo do log ──────────────────────────────────────────────────────────

function _filaMakeLogBlock(label, content, cls) {
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

function _filaLogHora(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString('pt-BR'); } catch (e) { return iso; }
}

// Quem é o agente deste evento, para efeito de COR. É o `data-agente` que
// `subagentes.css` casa com `--sub-<id>`; sem ele o título sai branco, que era
// exatamente o que acontecia aqui.
function _filaAgenteDoEvento(ev) {
  if (ev.agente === 'subagente') return ev.nome || 'sistema';
  if (ev.agente === 'ferramenta') return ev.subagente || 'sistema';
  if (ev.agente === 'correcao') return ev.alvo || 'sistema';
  return ev.agente || 'sistema';
}

// O rótulo de quem escreveu — emoji + nome bonito, da mesma fonte que a
// conversa e os cards usam. O agente principal e o Verificador não estão em
// AGENTES_DEFINICOES, então vêm das constantes da Fila.
function _filaRotuloAgente(id) {
  if (id === 'fila') return `${FILA_AGENTE_PRINCIPAL.icone} ${FILA_AGENTE_PRINCIPAL.nome}`;
  if (id === FILA_VERIFICADOR.id || id === 'verificador' || id === 'verificador-camada1') {
    return `${FILA_VERIFICADOR.icone} ${FILA_VERIFICADOR.nome}`;
  }
  if (id === 'usuario') return '👤 Você';
  if (id === 'sistema') return '⚠ Aviso do sistema';
  return (typeof agenteRotulo === 'function') ? agenteRotulo(id) : (id || 'agente');
}

function _filaGrupoLog(ev, corpo) {
  const group = document.createElement('div');
  group.className = 'chat-log-group'
    + (ev.agente === 'ferramenta' ? ' chat-log-group-ferramenta' : '');
  group.dataset.agente = _filaAgenteDoEvento(ev);
  const title = document.createElement('div');
  title.className = 'chat-log-group-title';
  title.innerHTML = `<span class="chat-log-group-nome">${escapeHtml(corpo.nome)}</span>`
    + (corpo.status
        ? `<span class="chat-log-group-status ${corpo.statusCls || ''}">${escapeHtml(corpo.status)}</span>`
        : '');
  group.appendChild(title);
  return group;
}

// ── Render ───────────────────────────────────────────────────────────────────

/* O log é INCREMENTAL, como o do Chat. Antes ele era remontado inteiro a cada
   volta do polling (4 em 4 segundos), e isso causava as duas coisas que você
   viu: o card que você tinha aberto retraía sozinho — um `<details>` novo nasce
   fechado —, e a tela piscava, porque entre o `innerHTML = ''` e o `await` do
   disco havia um quadro com a lista vazia.

   Duas marcas no próprio elemento guardam onde a montagem parou:
     `data-tarefa`      — de quem é o que está desenhado ali;
     `data-desenhados`  — quantos eventos já viraram grupo;
     `data-ferramentas` — quantos deles eram de ferramenta, que é o índice do
                          corpo correspondente no .jsonl.
   Ficam no elemento, e não numa variável do módulo, porque quem manda é o que
   está na tela: recarregou a aba, as marcas somem junto com o conteúdo. */

function _filaLogMarcas(el) {
  return {
    tarefa: el.dataset.tarefa || '',
    desenhados: parseInt(el.dataset.desenhados, 10) || 0,
    ferramentas: parseInt(el.dataset.ferramentas, 10) || 0,
  };
}

async function _filaRenderLogTab() {
  const el = document.getElementById('fila-log-content');
  if (!el) return;
  const tarefa = _filaTarefas.find(t => t.id === _filaSelecionadaId);
  if (!tarefa) {
    el.innerHTML = '<p class="chat-log-empty">Selecione uma tarefa para ver o histórico de agentes e ferramentas.</p>';
    el.dataset.tarefa = '';
    el.dataset.desenhados = '0';
    el.dataset.ferramentas = '0';
    _filaResetTokens();
    // Sem tarefa não há o que expandir: os botões somem.
    atualizarBotoesDeDetalhes('fila-log-content', 'fila-log-acoes');
    return;
  }

  _filaRecontarTokens(tarefa);

  const eventos = (tarefa.log && tarefa.log.eventos) || [];
  const marcas = _filaLogMarcas(el);
  const trocouTarefa = marcas.tarefa !== tarefa.id;

  if (!eventos.length) {
    if (trocouTarefa || marcas.desenhados) {
      el.innerHTML = '<p class="chat-log-empty">Nenhuma atividade ainda.</p>';
      el.dataset.tarefa = tarefa.id;
      el.dataset.desenhados = '0';
      el.dataset.ferramentas = '0';
      atualizarBotoesDeDetalhes('fila-log-content', 'fila-log-acoes');
    }
    return;
  }

  // Nada de novo: sair sem tocar no DOM é o ponto todo desta função. É o caso
  // da esmagadora maioria das voltas do polling.
  if (!trocouTarefa && marcas.desenhados >= eventos.length) return;

  const desde = trocouTarefa ? 0 : marcas.desenhados;
  const novos = eventos.slice(desde);

  // O corpo das ferramentas vem do arquivo, na mesma ordem em que os
  // marcadores aparecem em `eventos` — as duas listas são escritas pelo mesmo
  // laço, no mesmo instante. Faltando linha, o marcador ainda rende título e
  // horário; só os blocos ficam de fora. Só vamos ao disco se houver ferramenta
  // nova para desenhar.
  let corpos = [];
  if (novos.some(ev => ev.agente === 'ferramenta')) {
    try {
      corpos = await window.pywebview.api.carregar_fila_log(currentProject, tarefa.id) || [];
    } catch (e) { corpos = []; }
  }
  // ⚠️ REENTRÂNCIA. Tudo daqui para baixo é recalculado a partir das marcas de
  // AGORA, e não das que foram lidas lá em cima. Entre aquele `await` e este
  // ponto, `_filaAnexarLogAoVivo` pode ter rodado: ele é síncrono, desenha o
  // evento que acabou de chegar e avança o MESMO `el.dataset.desenhados`. Com o
  // recorte antigo, esse evento era desenhado de novo — e o Log ganhava grupos
  // duplicados, um por evento que chegasse durante a ida ao disco.
  if (_filaSelecionadaId !== tarefa.id) return;   // e você pode ter trocado de tarefa
  const marcasAgora = _filaLogMarcas(el);
  const trocouAgora = marcasAgora.tarefa !== tarefa.id;
  const desdeAgora = trocouAgora ? 0 : marcasAgora.desenhados;
  if (!trocouAgora && desdeAgora >= eventos.length) return;  // o ao vivo já cobriu tudo
  const paraDesenhar = eventos.slice(desdeAgora);
  let iFerramenta = trocouAgora ? 0 : marcasAgora.ferramentas;

  // Monta fora da tela e encaixa de uma vez: sem quadro intermediário vazio,
  // que era metade do pisca.
  const pedaco = document.createDocumentFragment();
  paraDesenhar.forEach(ev => {
    const corpo = (ev.agente === 'ferramenta') ? (corpos[iFerramenta++] || {}) : null;
    const group = _filaMontarGrupo(ev, corpo);
    if (group) pedaco.appendChild(group);
  });

  if (trocouAgora) {
    el.innerHTML = '';
    el.appendChild(pedaco);
    el.dataset.tarefa = tarefa.id;
    rolarAoFimAgora(el);   // você trocou de tarefa: mostra o fim
  } else {
    const vazio = el.querySelector('.chat-log-empty');
    if (vazio) vazio.remove();
    el.appendChild(pedaco);
    rolarAoFimSePresa(el); // chegou sozinho: só desce se você já estava embaixo
  }
  el.dataset.desenhados = String(eventos.length);
  el.dataset.ferramentas = String(iFerramenta);
  // Os dois botões do rodapé: ligados aqui, e a visibilidade refeita a cada
  // desenho. Mesmo par do Chat, mesmo comportamento — o Log das duas telas é a
  // mesma lista de <details>, e dois desenhos para o mesmo gesto seriam ruído.
  ligarBotoesDeDetalhes('fila-log-content', 'btn-fila-log-expandir', 'btn-fila-log-retrair');
  atualizarBotoesDeDetalhes('fila-log-content', 'fila-log-acoes');
}

// Acrescenta UM grupo no fim, sem redesenhar o resto. O evento que chega ao
// vivo traz o corpo da ferramenta junto, então aqui não há ida ao disco.
//
// As marcas avançam junto: sem isso, a volta seguinte do polling desenharia
// este mesmo evento de novo, porque ele já estaria em `log.eventos`.
function _filaAnexarLogAoVivo(evento) {
  const el = document.getElementById('fila-log-content');
  if (!el) return;
  // Nada desenhado ainda (ou de outra tarefa): deixa o render completo cuidar,
  // senão este evento apareceria sozinho, sem os anteriores.
  if (el.dataset.tarefa !== _filaSelecionadaId) { _filaRenderLogTab(); return; }
  const vazio = el.querySelector('.chat-log-empty');
  if (vazio) vazio.remove();
  const group = _filaMontarGrupo(evento, evento);
  el.dataset.desenhados = String((parseInt(el.dataset.desenhados, 10) || 0) + 1);
  if (evento.agente === 'ferramenta') {
    el.dataset.ferramentas = String((parseInt(el.dataset.ferramentas, 10) || 0) + 1);
  }
  if (!group) return;
  el.appendChild(group);
  rolarAoFimSePresa(el);
  // O primeiro bloco a chegar ao vivo é o que faz os botões do rodapé
  // aparecerem — este caminho não passa por `_filaRenderLogTab`.
  ligarBotoesDeDetalhes('fila-log-content', 'btn-fila-log-expandir', 'btn-fila-log-retrair');
  atualizarBotoesDeDetalhes('fila-log-content', 'fila-log-acoes');
}

// Um evento → um grupo. Mesmos tipos do Log do Chat, na mesma ordem de teste.
// Devolve null para o que não vira grupo — o evento 'uso' do agente principal,
// que só alimenta contador.
function _filaMontarGrupo(ev, payload) {
  const nome = _filaRotuloAgente(_filaAgenteDoEvento(ev));

  // ── O que VOCÊ escreveu ──
  // ⚠️ O Chat sabe desenhar seis tipos de evento; a Fila cobria cinco, e o que
  // faltava era justamente este. A tarefa e cada complemento nunca entravam no
  // Log — dava para ver todas as chamadas de ferramenta de trinta rodadas e não
  // achar a frase que começou tudo. Mesmo desenho do Chat (`addAgentLog`, em
  // `chat-agentes.js`): título e corpo, sem bloco dobrável.
  if (ev.agente === 'usuario') {
    const group = _filaGrupoLog(ev, { nome, status: _filaLogHora(ev.inicio) });
    group.classList.add('chat-log-group-usuario');
    const body = document.createElement('div');
    body.className = 'chat-log-inline-body';
    body.textContent = ev.mensagem || '';
    group.appendChild(body);
    return group;
  }

  // ── Ferramenta chamada por um subagente ──
  // `payload` é o corpo vindo do .jsonl; `ev` já o traz junto quando o evento
  // chegou ao vivo. Um dos dois sempre tem.
  if (ev.agente === 'ferramenta') {
    const corpo = payload || ev;
    const group = _filaGrupoLog(ev, {
      nome: `${nome} — ${ev.nome || ''}`,
      status: `${_filaLogHora(ev.inicio)} → ${_filaLogHora(ev.fim)}`,
    });
    group.appendChild(_filaMakeLogBlock(
      'Parâmetros', JSON.stringify(corpo.parametros || {}, null, 2),
      'chat-log-block-sent'));
    group.appendChild(_filaMakeLogBlock(
      'Resultado', corpo.resultado || '(vazio)', 'chat-log-block-response'));
    return group;
  }

  // ── Subagente: início e fim são dois grupos, como no Chat ──
  if (ev.agente === 'subagente') {
    if (ev.evento === 'inicio') {
      const group = _filaGrupoLog(ev, { nome, status: `iniciado ${_filaLogHora(ev.inicio)}` });
      group.appendChild(_filaMakeLogBlock('Pergunta', ev.pergunta || '(vazia)', 'chat-log-block-user'));
      return group;
    }
    if (ev.evento !== 'fim') return null;
    const group = _filaGrupoLog(ev, {
      nome,
      status: ev.erro ? `Erro: ${ev.erro}` : `concluído ${_filaLogHora(ev.fim)}`,
      statusCls: ev.erro ? 'erro' : '',
    });
    group.appendChild(ev.erro
      ? _filaMakeLogBlock('Erro', ev.erro, 'chat-log-block-error')
      : _filaMakeLogBlock('Resposta final', ev.resposta || '(vazia)', 'chat-log-block-response'));
    return group;
  }

  // ── Correção de formato ──
  if (ev.agente === 'correcao') {
    const group = _filaGrupoLog(ev, {
      nome: `Correção — ${_filaRotuloAgente(ev.alvo || 'fila')}`,
      status: `tentativa ${ev.tentativa || 1}`,
      statusCls: 'erro',
    });
    group.appendChild(_filaMakeLogBlock(
      'Erro detectado', ev.descricao_erro || '(vazio)', 'chat-log-block-error'));
    return group;
  }

  // ── Aviso do sistema: corpo inline, sem retração, como no Chat ──
  if (ev.agente === 'sistema') {
    const group = _filaGrupoLog(ev, { nome: '⚠ Aviso do sistema' });
    const inline = document.createElement('div');
    inline.className = 'chat-log-inline-body';
    inline.textContent = ev.mensagem || '(vazio)';
    group.appendChild(inline);
    return group;
  }

  // ── Agente principal e Verificador ──
  if (ev.evento === 'inicio') {
    return _filaGrupoLog(ev, { nome, status: `iniciado ${_filaLogHora(ev.inicio)}` });
  }
  if (ev.evento === 'fim') {
    const group = _filaGrupoLog(ev, {
      nome,
      status: ev.erro ? 'Erro' : 'concluído',
      statusCls: ev.erro ? 'erro' : '',
    });
    group.appendChild(ev.erro
      ? _filaMakeLogBlock('Erro', ev.erro, 'chat-log-block-error')
      : _filaMakeLogBlock('Resposta final', ev.resposta || '(vazia)', 'chat-log-block-response'));
    return group;
  }
  return null;
}
