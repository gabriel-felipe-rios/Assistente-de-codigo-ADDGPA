/* ══════════════════════════════════════════════════════════
   FILA — a barra lateral: lista de tarefas, criação e seleção.

   É a lista de conversas do Chat (`chat-lista.js`), com uma linha a mais no
   item: o estado da tarefa e as sub-tags. O resto — a classe do item, o "×"
   que só aparece no hover, o texto de lista vazia — é o mesmo.
══════════════════════════════════════════════════════════ */

// "+ Nova tarefa" copia o "+ Novo Chat": cria NA HORA, sem perguntar nada,
// e o cursor cai no campo de baixo. O que a tarefa é você escreve lá, e a
// primeira mensagem vira o texto dela — mesma mecânica do título do chat.
async function _filaNovaTarefa() {
  const r = await window.pywebview.api.enfileirar_tarefa(currentProject, '');
  if (!r.success) { showToast(r.error || 'Falha ao criar a tarefa', true); return; }
  await _filaRefreshEstado();
  if (r.tarefa) _filaSelecionarTarefa(r.tarefa.id);
  const input = document.getElementById('fila-chat-input');
  if (input) input.focus();
}

// Tarefa presa em "Pesquisando": a thread morreu sem passar pelo `except`, e a
// tarefa fica em pesquisa para sempre — o "×" recusa e o "▶ Iniciar tarefas"
// some, porque a tela o esconde enquanto há tarefa em jogo. Isto devolve a
// tarefa para "na fila" SEM APAGAR NADA, e sem iniciar nada: quem manda rodar
// continua sendo o "Iniciar tarefas". Quem separa "presa" de "rodando de
// verdade" é o backend, pelo lock da fila.
async function _filaDevolverParaFila(id) {
  const r = await window.pywebview.api.devolver_tarefa_para_fila(currentProject, id);
  if (!r.success) { showToast(r.error || 'Falha ao devolver para a fila', true); return; }
  await _filaRefreshEstado();
  showToast('Tarefa devolvida para a fila. A pesquisa continua guardada.');
}

// Marca (ou desmarca) uma tarefa terminada para continuar de onde parou.
// ⚠️ NÃO inicia nada: quem dispara continua sendo o "▶ Iniciar tarefas", que
// passa a rodar também o que estiver marcado. Separar marcar de iniciar é o que
// deixa marcar várias e sair de perto — mesma lógica de "+ Nova tarefa".
async function _filaMarcarContinuacao(id, modo) {
  const r = await window.pywebview.api.marcar_tarefa_para_continuar(currentProject, id, modo);
  if (!r.success) { showToast(r.error || 'Falha ao marcar a tarefa', true); return; }
  await _filaRefreshEstado();
  showToast(modo
    ? 'Marcada. Clique em "Iniciar tarefas" para rodar.'
    : 'Marca removida.');
}

/**
 * A confirmação antes de remover uma tarefa. Devolve `true` para seguir.
 *
 * ⚠️ Ela DIZ O QUE SE PERDE em vez de perguntar "tem certeza?": some a tarefa,
 * mas também o histórico da pesquisa, o log de ferramentas e o relatório que
 * ela gerou — e nada disso é óbvio de fora. Mesma regra do modal do Chat.
 *
 * Respeita "Perguntar antes de remover" (Configurações › Encerrar e excluir).
 * Desligada, o clique volta a apagar direto.
 */
function _filaConfirmarRemocao(tarefa) {
  if (appSettings.confirmar_ao_deletar === false) return Promise.resolve(true);
  return new Promise(resolve => {
    let confirmou = false;
    const overlay = abrirModalPadrao({
      title: 'Remover esta tarefa?',
      confirmLabel: 'Remover',
      bodyHtml: `<div class="modal-body-text">Isto apaga <strong>${escapeHtml(_filaTitulo(tarefa))}</strong>:
        a tarefa, o histórico da pesquisa, o log de ferramentas e o relatório que
        ela gerou.<br><br><strong>Não dá pra desfazer.</strong></div>`,
      onConfirm: () => { confirmou = true; },
    });
    // O modal sai do DOM por três caminhos — Confirmar, Cancelar e clique fora —
    // e a promessa precisa ser resolvida nos três, senão um Cancelar deixaria o
    // clique no "×" pendurado para sempre. Mesmo mecanismo do modal do Chat.
    new MutationObserver((_m, obs) => {
      if (!overlay.isConnected) { obs.disconnect(); resolve(confirmou); }
    }).observe(document.body, { childList: true });
  });
}

async function _filaRemoverTarefa(id) {
  const r = await window.pywebview.api.deletar_tarefa_fila(currentProject, id);
  if (!r.success) { showToast(r.error || 'Falha ao remover', true); return; }
  // O backend devolve `aviso` quando a tarefa saiu do estado mas sobrou arquivo
  // em disco — e o comentário dele diz que isso "vale ser dita em vez de
  // engolida". Ninguém lia. A remoção deu certo, então não é erro: é aviso.
  if (r.aviso) showToast(r.aviso);
  if (_filaSelecionadaId === id) _filaSelecionarTarefa(null);
  await _filaRefreshEstado();
}

function _filaTitulo(t) {
  const texto = (t.texto || '').trim();
  return texto || FILA_TITULO_VAZIO;
}

// O que depende do STATUS da tarefa selecionada, e só disso.
//
// ⚠️ Separado de `_filaSelecionarTarefa` de propósito: isto precisa rodar
// também quando a tarefa selecionada MUDA DE ESTADO sozinha (ela começa a
// rodar, ela termina), e aquela função zera o contador de tokens — chamá-la a
// cada notificação apagaria a contagem no meio da pesquisa.
function _filaAtualizarControlesDaTarefa(tarefa) {
  const area = document.getElementById('fila-input-area');

  // A caixa de envio aparece para tarefa recém-criada (ainda sem texto — é
  // justamente ela que mais precisa do campo) e para tarefa que já terminou
  // uma passada. Some enquanto a pesquisa está rodando: complementar no meio
  // não teria para onde ir.
  const semTexto = tarefa && !(tarefa.texto || '').trim();
  const podeEscrever = tarefa && (semTexto || FILA_STATUS_COMPLEMENTAVEL.includes(tarefa.status));
  const linha = area && area.querySelector('.chat-input-row');
  if (linha) linha.classList.toggle('hidden', !podeEscrever);

  // ⚠️ O prompt fixo só entra numa passada que COMEÇA do zero — o backend o
  // aplica dentro de `if not msgs:`. Numa tarefa que já rodou, escolher um era
  // aceito e ignorado em silêncio. Ele fica apagado, com o motivo ao lado, pelo
  // mesmo mecanismo do Chat (`trava-ia.js`): botão apagado sem explicação
  // parece defeito.
  const btnPrompt = document.getElementById('btn-fila-prompt-fixo');
  const motivoPrompt = document.getElementById('fila-prompt-fixo-motivo');
  const primeiraPassada = !!semTexto;
  const travado = !!tarefa && !primeiraPassada;
  if (btnPrompt) {
    btnPrompt.disabled = travado;
    if (typeof travaIAOcupadoLocal === 'function') travaIAOcupadoLocal(btnPrompt, travado);
  }
  if (motivoPrompt) {
    motivoPrompt.textContent = travado
      ? 'O prompt fixo vale só na primeira passada desta tarefa.'
      : '';
    motivoPrompt.classList.toggle('hidden', !travado);
  }
}

function _filaSelecionarTarefa(id) {
  _filaSelecionadaId = id;
  _filaResetTokens();
  const tarefa = _filaTarefas.find(t => t.id === id);
  const area = document.getElementById('fila-input-area');

  // São DUAS visibilidades, e por muito tempo foram uma só. A barra de cima
  // (prompt fixo, dropdown "Chamadas", uso de contexto) é leitura sobre a
  // tarefa selecionada e vale em qualquer situação dela — some junto com o
  // campo de texto, sumia o contador de chamadas justamente quando havia o que
  // contar. Só a linha de escrever obedece ao `podeEscrever`.
  if (area) area.classList.toggle('hidden', !tarefa);

  _filaAtualizarControlesDaTarefa(tarefa);

  _filaRenderLista();
  // O painel "Chamadas" é o único do rodapé que muda com a tarefa, e o único
  // caminho até ele era `_filaRefreshEstado` — que com a fila parada não roda
  // nunca. Era por isso que uma tarefa já concluída ficava em "Nenhuma tarefa
  // selecionada" para sempre, e trocar de tarefa não mexia no número.
  _filaRenderChamadas();
  // A barra de uso da janela também mora no rodapé e também muda com a tarefa.
  // Ela dependia da sub-aba Contexto estar aberta para se atualizar — com a
  // sub-aba Fila na frente, trocar de tarefa deixava o número da anterior.
  _filaAtualizarUsoJanelaDaTarefa();
  _filaRenderAbaAtiva();
  if (typeof xtPintarEncaixeDaFila === 'function') xtPintarEncaixeDaFila();
}

function _filaRenderLista() {
  const list = document.getElementById('fila-lista');
  if (!list) return;

  // A lista é remontada a cada volta do polling, de 4 em 4 segundos. Quase
  // sempre nada mudou, e refazer os cards à toa piscava a barra lateral. Só o
  // que a lista MOSTRA entra na assinatura — título, situação, sub-tags e qual
  // está selecionada.
  // ⚠️ `proxima_continuacao` PRECISA entrar na assinatura. A lista só é
  // remontada quando a assinatura muda, e marcar uma tarefa não mexe em nada
  // mais que a lista mostre — o status continua o mesmo, as sub-tags também.
  // Fora daqui, a marca ficaria certa no disco e nunca apareceria na tela.
  const assinatura = _filaTarefas.map(t => [t.id, _filaTitulo(t), t.status,
    (t.sub_tags || []).join(','), t.proxima_continuacao || ''].join('~')).join('\n')
    + '||' + (_filaSelecionadaId || '');
  if (list.dataset.assinatura === assinatura) return;
  list.dataset.assinatura = assinatura;

  list.innerHTML = '';
  if (!_filaTarefas.length) {
    list.innerHTML = '<div class="chat-list-empty">Nenhuma tarefa na fila.</div>';
    return;
  }

  _filaTarefas.forEach(t => {
    const info = FILA_STATUS_INFO[t.status] || { label: t.status, cls: 'st-neutro' };
    const div = document.createElement('div');
    div.className = 'chat-list-item' + (t.id === _filaSelecionadaId ? ' active' : '');

    // ⚠️ O backend recusa deletar uma tarefa em pesquisa ("não é possível
    // deletar uma tarefa em pesquisa"), mas o "×" continuava clicável: o clique
    // ia até lá e voltava como erro vermelho. Apagado, com o motivo no title,
    // ele diz o que fazer em vez de reclamar depois.
    const emPesquisa = t.status === 'pesquisando';
    // ⚠️ E "Aguardando a vez" é intocável ENQUANTO o ciclo roda, pelo mesmo
    // raciocínio: ela é a próxima a começar, e apagá-la sem querer com a fila
    // quase no fim tira da lista um trabalho que estava prestes a rodar. Parada
    // a fila, apagar continua valendo — o "×" volta sozinho.
    // A fonte de "o ciclo roda" é `_filaRodando`, a MESMA que acende o badge
    // "Rodando N de M": duas respostas para a mesma pergunta divergiriam.
    // ℹ️ Mudar de estado muda a assinatura da lista, então ela é remontada
    // sozinha quando a fila começa e quando termina.
    const esperandoAVezComFilaRodando =
      t.status === 'aguardando_vez' && _filaRodando;
    const travado = emPesquisa || esperandoAVezComFilaRodando;
    const motivoTravado = emPesquisa
      ? 'Não dá para remover uma tarefa em pesquisa. Use "Cancelar", ou "Devolver para a fila" se ela estiver presa.'
      : 'Não dá para remover uma tarefa que está esperando a vez enquanto a fila roda — ela pode começar a qualquer momento. Use "Cancelar".';
    const subtags = (t.sub_tags || []).map(tag =>
      `<span class="fila-subtag">${escapeHtml(FILA_SUBTAG_ROTULO[tag] || tag)}</span>`).join('');

    div.innerHTML = `
      <div class="chat-item-info">
        <div class="chat-item-title">${escapeHtml(_filaTitulo(t))}</div>
        <div class="fila-item-estado">
          <span class="fila-card-dot ${info.cls}"></span>
          <span class="fila-card-status-label ${info.cls}">${info.label}</span>
          ${t.proxima_continuacao ? `<span class="selo-tipo fila-selo-continuar" title="${escapeHtml(FILA_CONTINUAR_ROTULO[t.proxima_continuacao] || '')}">${FILA_CONTINUAR_SELO}</span>` : ''}
        </div>
        ${subtags ? `<div class="fila-item-subtags">${subtags}</div>` : ''}
      </div>
      <button class="btn-delete-chat" ${travado ? 'disabled' : ''} title="${
        travado ? escapeHtml(motivoTravado) : 'Remover tarefa'}">×</button>`;

    // stopPropagation: sem ele o clique no "×" seleciona a tarefa antes de
    // removê-la, e a tela pisca no item que está sumindo.
    div.querySelector('.btn-delete-chat').addEventListener('click', async e => {
      e.stopPropagation();
      // Guarda de tela. O motor recusa os dois casos também, e continua sendo o
      // guarda final: entre pintar a lista e clicar, a fila pode ter começado.
      if (travado) { showToast(motivoTravado, true); return; }
      if (!await _filaConfirmarRemocao(t)) return;
      _filaRemoverTarefa(t.id);
    });
    div.addEventListener('click', () => _filaSelecionarTarefa(t.id));
    list.appendChild(div);
  });
}
