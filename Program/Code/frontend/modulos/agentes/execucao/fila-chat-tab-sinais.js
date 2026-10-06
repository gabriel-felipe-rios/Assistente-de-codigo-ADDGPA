// ══ FILA → os sinais ao vivo da pesquisa ══════════════════════════════════
//
// O que a tela mostra ENQUANTO a tarefa roda: a tira "pensando", as rodinhas
// dos subagentes, os avisos e as faixas.
//
// ⚠️ OS SINAIS SÃO GUARDADOS POR TAREFA (`_filaSinaisPorTarefa`), e não pintados
// direto. Uma pesquisa roda por horas e o usuário troca de tarefa no meio; sem a
// lista, voltar para a tarefa mostra uma conversa sem nada do que aconteceu —
// o backend só grava o histórico quando a rodada termina.
//
// ⚠️ A TIRA "PENSANDO" SAI QUANDO AS RODINHAS ENTRAM (`_FILA_PENSANDO_APOS`),
// mesma tabela do Chat e pelo mesmo motivo: as rodinhas já dizem que há trabalho
// em curso, e as duas juntas viram ruído.

/* ══════════════════════════════════════════════════════════
   OS SINAIS AO VIVO DA FILA

   A Fila roda O MESMO `_executar_chamadas_subagentes` do Chat — e rodava sem as
   duas linhas que o cercam lá. Durante uma rodada de subagentes, que numa
   pesquisa longa leva minutos, a tela não dizia absolutamente nada: a conversa
   só mudava quando o histórico ia para o disco, no fim da rodada.

   ⚠️ TUDO passa por este despachante, e nada toca o DOM direto. O motivo está
   escrito em `chat-mensagens.js`, sobre o despachante de lá: "era exatamente
   isso que fazia a resposta de um chat aparecer dentro de outro". Aqui o risco
   é o mesmo e tem um agravante — a Fila roda em thread no backend, e o empurrão
   pode chegar de uma tarefa de OUTRO projeto. Por isso a conferência dupla
   (projeto e tarefa) antes de qualquer pintura.

   ⛔ O texto do agente principal NÃO é transmitido ao vivo. Isso é mudança de
   arquitetura e ficou fora de propósito.
══════════════════════════════════════════════════════════ */

// Depois de cada sinal, o programa continua "pensando"? Mesma tabela do Chat
// (`_STREAM_PENSANDO_APOS`), pelos mesmos motivos: as rodinhas dos subagentes já
// dizem que há trabalho em curso, então a tira sai quando elas entram.
const _FILA_PENSANDO_APOS = {
  preparando: true,    // falando com o modelo, e nada na tela ainda
  'sub-inicio': false, // as rodinhas já dizem o que falta
  'sub-fim': true,     // resultados na mão, a Fila volta a pensar
  aviso: true,         // errou o formato: vai tentar de novo
  faixa: false,        // acabou o teto — não há mais o que esperar
  fim: false,
};

let _filaPensandoAoVivo = false;

// ── Os sinais guardados, por tarefa ─────────────────────────────────────────
// ⚠️ Sem isto, sair da tarefa e voltar no meio de uma pesquisa longa fazia os
// cartões dos subagentes SUMIREM — e eram duas causas somadas: o sinal era
// DESCARTADO quando a tarefa não era a selecionada, e ao voltar o DOM era
// limpo e remontado a partir do disco, que só é escrito no fim da rodada.
// Guardar cada sinal e repintá-lo ao voltar resolve as duas de uma vez. É o
// mesmo mecanismo que o Chat já usa (`_streamEventos`, chat-mensagens.js) e
// pelo mesmo motivo escrito lá: não há de onde recarregar o que já chegou.
//
// A lista de uma tarefa morre quando ela termina — daí em diante o histórico em
// disco tem tudo, e repintar duplicaria.
const _filaSinaisPorTarefa = {};

function _filaEsquecerSinais(tarefaId) {
  if (tarefaId) delete _filaSinaisPorTarefa[tarefaId];
}

// Chamado pelo backend (`_fila_notify_sinal`). Assinatura com o projeto e a
// tarefa na frente: são as duas perguntas que precisam ser feitas ANTES de
// pintar qualquer coisa.
function filaSinalAoVivo(projeto, tarefaId, ev) {
  if (projeto && projeto !== currentProject) return;
  if (!tarefaId) return;
  ev = ev || {};
  // ⚠️ GUARDA PRIMEIRO, e para qualquer tarefa — inclusive a que não está
  // selecionada e a que está com o painel escondido. Era exatamente aqui que o
  // sinal se perdia: quem sai da tarefa perde tudo o que aconteceu enquanto
  // esteve fora, e ao voltar não há de onde recuperar.
  if (ev.t === 'fim') {
    _filaEsquecerSinais(tarefaId);
  } else {
    (_filaSinaisPorTarefa[tarefaId] || (_filaSinaisPorTarefa[tarefaId] = [])).push(ev);
  }
  if (tarefaId !== _filaSelecionadaId) return;
  const msgs = document.getElementById('fila-chat-messages');
  if (!msgs || msgs.classList.contains('hidden')) return;
  _filaSinalAplicar(msgs, ev);
}

// Repinta, na ordem, tudo o que chegou desta tarefa desde a última gravação.
//
// ⚠️ Só depois do `msgs.innerHTML = ''`, e DENTRO do ramo de redesenho — nunca
// antes do `return` de assinatura igual. Antes dele, o poll de 4 s passaria por
// aqui a cada volta: a conversa se duplicaria e todo `<details>` aberto
// fecharia, que é exatamente o conserto da fase anterior sendo desfeito.
function _filaRepintarSinais(msgs, tarefaId) {
  const guardados = _filaSinaisPorTarefa[tarefaId];
  if (!guardados || !guardados.length) return;
  _filaPensandoAoVivo = false;
  guardados.forEach(ev => _filaSinalAplicar(msgs, ev));
}

function _filaSinalAplicar(msgs, ev) {
  // A tira sai do fim ANTES de a conversa crescer, e volta depois: ela é sempre
  // o último elemento, senão ficaria pendurada no meio do histórico.
  _filaPensandoRemover(msgs);

  if (ev.t === 'preparando')        _filaPintarPreparando(msgs);
  else if (ev.t === 'sub-inicio')   _filaPintarChamadas(msgs, ev.chamadas);
  else if (ev.t === 'sub-fim')      _filaPintarResultados(msgs, ev.resultados);
  else if (ev.t === 'aviso')        _filaPintarAviso(msgs, ev.texto);
  else if (ev.t === 'faixa')        _filaPintarFaixa(msgs, ev.texto);
  else if (ev.t === 'fim')          _filaLimparPreparando(msgs);

  const apos = _FILA_PENSANDO_APOS[ev.t];
  if (apos !== undefined) _filaPensandoAoVivo = apos;
  if (_filaPensandoAoVivo) _filaPensandoPor(msgs);
}

// A tira "está pensando…". Mesma classe do Chat — é a mesma coisa, dita pelo
// mesmo programa; duas aparências para o mesmo estado seria ruído.
function _filaPensandoRemover(msgs) {
  const tira = msgs.querySelector('.chat-pensando');
  if (tira) tira.remove();
}

function _filaPensandoPor(msgs) {
  const tira = document.createElement('div');
  tira.className = 'chat-pensando';
  tira.innerHTML = '<span class="subagent-spinner"></span>'
    + `<span><strong>${escapeHtml(FILA_AGENTE_PRINCIPAL.nome)}</strong> está pensando…</span>`;
  msgs.appendChild(tira);
  rolarAoFimSePresa(msgs);
}

// "⏳ Preparando chamada de subagentes…" — o intervalo em que a Fila está
// falando com o modelo e ainda não sabe o que ele vai pedir.
function _filaPintarPreparando(msgs) {
  _filaLimparPreparando(msgs);
  const el = document.createElement('em');
  el.className = 'subagent-thinking fila-preparando';
  el.textContent = '⏳ Preparando chamada de subagentes…';
  msgs.appendChild(el);
  rolarAoFimSePresa(msgs);
}

function _filaLimparPreparando(msgs) {
  msgs.querySelectorAll('.fila-preparando').forEach(el => el.remove());
}

// Os cartões girando. Viram o resultado NO LUGAR (`replaceWith`), como no Chat:
// a fileira não se move, o que muda é o conteúdo dela.
function _filaPintarChamadas(msgs, chamadas) {
  _filaLimparPreparando(msgs);
  const round = document.createElement('div');
  round.className = 'subagent-round subagent-round-running';
  round.dataset.rodada = String(msgs.querySelectorAll('.subagent-round').length + 1);
  (chamadas || []).forEach(c => {
    const notice = document.createElement('div');
    notice.className = 'subagent-notice running';
    notice.innerHTML = '<span class="subagent-spinner"></span> '
      + `<strong>${escapeHtml(agenteRotulo(c.subagente))}</strong>: `
      + escapeHtml((c.pergunta || '').slice(0, 90));
    round.appendChild(notice);
  });
  msgs.appendChild(round);
  rolarAoFimSePresa(msgs);
}

function _filaPintarResultados(msgs, resultados) {
  const running = msgs.querySelector('.subagent-round-running');
  const n = (running && running.dataset.rodada)
    ? parseInt(running.dataset.rodada, 10)
    : msgs.querySelectorAll('.subagent-round').length + 1;
  const lista = resultados || [];
  const tarefa = _filaTarefas.find(t => t.id === _filaSelecionadaId);
  const round = _makeSubagentRound(
    lista, rotuloDaRodada(n, lista.length, _filaMaxRodadasDaTarefa(tarefa)));
  round.dataset.rodada = String(n);
  if (running) running.replaceWith(round);
  else msgs.appendChild(round);
  rolarAoFimSePresa(msgs);
}

// O modelo errou o formato. Isso só aparecia no Log, e o Log é outra aba: da
// conversa, o que se via era a Fila parada por um tempo sem explicação.
function _filaPintarAviso(msgs, texto) {
  _filaLimparPreparando(msgs);
  const nota = document.createElement('div');
  nota.className = 'chat-nota-programa';
  nota.textContent = texto || 'O modelo respondeu fora do formato. Pedindo de novo…';
  msgs.appendChild(nota);
  rolarAoFimSePresa(msgs);
}

// A faixa do teto de rodadas. ⛔ SEM BOTÃO, ao contrário da do Chat: aqui não há
// o que retomar — quem decide continuar é você, pelos botões de continuar, e
// só depois que a tarefa termina. Segue o componente "Faixa de aviso com ação",
// na variante sem ação.
function _filaPintarFaixa(msgs, texto) {
  _filaLimparPreparando(msgs);
  const nota = document.createElement('div');
  nota.className = 'chat-nota-programa';
  nota.textContent = texto || 'O teto de rodadas acabou.';
  msgs.appendChild(nota);
  rolarAoFimSePresa(msgs);
}

