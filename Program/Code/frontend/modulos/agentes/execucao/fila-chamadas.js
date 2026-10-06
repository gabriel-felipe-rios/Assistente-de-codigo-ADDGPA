/* ══════════════════════════════════════════════════════════
   FILA — dropdown "Chamadas": o que já aconteceu nesta tarefa.

   Fica na área de envio, no lugar onde o Chat tem "Nenhum" e "Contexto
   inicial", e segue o mesmo padrão (`.ctx-inicial-wrap` + `.btn-ctx-inicial` +
   `.ctx-inicial-panel`, `chat.css`), abrindo para cima.

   É INFORMATIVO: abre, mostra e fecha. Não escolhe nada — quem liga e desliga
   subagente é a sub-aba Subagentes, e quem ajusta o teto de rodadas também.

   Por que não ficou nos cards: os cards de Subagentes são CONFIGURAÇÃO, e
   pendurar "rodada 12 de 30" num deles misturava o que você ajusta com o que
   aconteceu. Além disso deixava o card da Fila mais alto que o mesmo card no
   Chat, que não tem contador nenhum.
══════════════════════════════════════════════════════════ */

// Quantas vezes cada agente foi chamado nesta tarefa. Sai do log, que é onde o
// fato está — um contador guardado à parte divergiria do que aconteceu.
function _filaContagemChamadas(tarefa) {
  const contagem = {};
  const eventos = (tarefa && tarefa.log && tarefa.log.eventos) || [];
  eventos.forEach(ev => {
    if (ev.evento !== 'fim') return;
    // Para subagente, quem conta é o `nome` — o campo `agente` diz só a
    // categoria ('subagente'), igual para os dez.
    const id = (ev.agente === 'subagente') ? ev.nome : ev.agente;
    if (!id) return;
    contagem[id] = (contagem[id] || 0) + 1;
  });
  return contagem;
}

// O rótulo com emoji, da mesma fonte da conversa, do Log e dos cards. O agente
// principal e o Verificador não estão em AGENTES_DEFINICOES.
function _filaRotuloChamada(id) {
  if (id === FILA_AGENTE_PRINCIPAL.id) {
    return `${FILA_AGENTE_PRINCIPAL.icone} ${FILA_AGENTE_PRINCIPAL.nome}`;
  }
  if (id === FILA_VERIFICADOR.id || id === 'verificador' || id === 'verificador-camada1') {
    return `${FILA_VERIFICADOR.icone} ${FILA_VERIFICADOR.nome}`;
  }
  return (typeof agenteRotulo === 'function') ? agenteRotulo(id) : id;
}

// Quanto tempo a tarefa ficou rodando. Enquanto roda é o relógio correndo (o
// polling redesenha de 4 em 4 segundos); depois de terminar é o tempo final,
// congelado. Sai de `iniciado_em` e `concluido_em`, que a tarefa já guarda —
// não há cronômetro próprio, que perderia a conta ao fechar o programa.
function _filaDuracao(tarefa) {
  if (!tarefa || !tarefa.iniciado_em) return null;
  const inicio = new Date(tarefa.iniciado_em);
  // ⚠️ Numa tarefa que está PESQUISANDO, `concluido_em` é da passada anterior —
  // ele não é zerado na reexecução. `iniciado_em` é de agora, a diferença dava
  // negativa, e o `Math.max(0, ...)` a transformava em "Levou 0 s" numa tarefa
  // que estava rodando na sua frente. Rodando é sempre relógio correndo.
  const rodando = tarefa.status === 'pesquisando' || !tarefa.concluido_em;
  const fim = rodando ? new Date() : new Date(tarefa.concluido_em);
  const seg = Math.max(0, Math.floor((fim - inicio) / 1000));
  if (isNaN(seg)) return null;
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const sg = seg % 60;
  const partes = [];
  if (h) partes.push(`${h} h`);
  if (h || m) partes.push(`${m} min`);
  partes.push(`${sg} s`);
  return { texto: partes.join(' '), correndo: rodando };
}

function _filaRenderChamadas() {
  const rodadaEl = document.getElementById('fila-chamadas-rodada');
  const corpo = document.getElementById('fila-chamadas-corpo');
  const btn = document.getElementById('btn-fila-chamadas');
  if (!rodadaEl || !corpo || !btn) return;

  const tarefa = _filaTarefas.find(t => t.id === _filaSelecionadaId);
  if (!tarefa) {
    btn.textContent = 'Chamadas ▾';
    rodadaEl.textContent = 'Nenhuma tarefa selecionada.';
    corpo.innerHTML = '';
    return;
  }

  // Três métricas, no mesmo formato "quanto de quanto": as duas primeiras são
  // orçamentos que a tarefa gasta; a terceira é só parâmetro seu.
  //
  // ⚠ Os dois campos são procurados pela CHAVE, nunca pela posição em
  // FILA_CONFIG_CAMPOS. Aqui já esteve `FILA_CONFIG_CAMPOS[2]`, de quando o
  // array tinha três itens; o do meio (o teto de tokens da resposta do
  // subagente) mudou-se para Configurações e o índice 2 virou `undefined`.
  // `_filaConfigValor(undefined)` estourava, e o erro derrubava
  // `_filaSelecionarTarefa` no meio — ANTES de `_filaRenderAbaAtiva`. Era por
  // isso que clicar noutra tarefa não trocava o que a sub-aba Fila mostrava, e
  // só trocar de sub-aba (que chama o render direto) consertava.
  // ⚠️ O teto vem da TAREFA, e só cai na configuração atual quando a tarefa é
  // antiga e não tem o carimbo. Ler o `localStorage` aqui fazia a tela discordar
  // do backend, que roda pelo número gravado na tarefa: baixe o teto de 30 para
  // 5 e uma tarefa já em jogo passava a exibir "Rodada 12 de 5".
  // `_filaMaxRodadasDaTarefa` já existia — era usada na conversa e não aqui.
  const maxRodadas = _filaMaxRodadasDaTarefa(tarefa);
  const maxDevolucoes = tarefa.devolucoes_permitidas
    || _filaConfigValorPorChave('devolucoes');
  const dur = _filaDuracao(tarefa);
  rodadaEl.innerHTML =
      `<span class="fila-chamadas-metrica">Rodada `
    + `<b>${tarefa.rodadas_usadas || 0}</b> de ${maxRodadas}</span>`
    + `<span class="fila-chamadas-metrica">Devoluções `
    + `<b>${tarefa.devolucoes || 0}</b> de ${maxDevolucoes}</span>`
    + (dur
        ? `<span class="fila-chamadas-metrica${dur.correndo ? ' correndo' : ''}">`
          + `${dur.correndo ? 'Rodando há' : 'Levou'} <b>${escapeHtml(dur.texto)}</b></span>`
        : '');

  const contagem = _filaContagemChamadas(tarefa);
  // O agente principal fica de fora da tabela: ele não é "chamado", ele é
  // quem chama. O número de idas dele ao modelo é a rodada, que já está acima.
  const ids = Object.keys(contagem)
    .filter(id => id !== FILA_AGENTE_PRINCIPAL.id && contagem[id] > 0)
    .sort((a, b) => contagem[b] - contagem[a] || a.localeCompare(b));

  const total = ids.reduce((s, id) => s + contagem[id], 0);
  btn.textContent = total ? `Chamadas: ${total} ▾` : 'Chamadas ▾';

  if (!ids.length) {
    // Quem não rodou não aparece: a lista completa dos que existem é a sub-aba
    // Subagentes, e repeti-la aqui com uma coluna de zeros só faria ruído.
    corpo.innerHTML = '<tr><td colspan="2" class="fila-chamadas-vazio">'
      + 'Nenhum subagente chamado ainda.</td></tr>';
    return;
  }

  corpo.innerHTML = ids.map(id =>
    '<tr>'
    + `<td><span class="legend-dot legend-${escapeHtml(id)}"></span>`
    + `${escapeHtml(_filaRotuloChamada(id))}</td>`
    + `<td class="ctx-stat">${contagem[id].toLocaleString('pt-BR')}</td>`
    + '</tr>').join('');
}

// Abrir e fechar, igual ao "Contexto inicial" do Chat
// (`chat-contexto-inicial.js::_initCtxInicialPanel`).
function _filaInitChamadasPanel() {
  const btn = document.getElementById('btn-fila-chamadas');
  const panel = document.getElementById('fila-chamadas-panel');
  if (!btn || !panel || btn._wired) return;
  btn._wired = true;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!panel.classList.contains('hidden') && !panel.contains(e.target) && e.target !== btn) {
      panel.classList.add('hidden');
    }
  });
}
