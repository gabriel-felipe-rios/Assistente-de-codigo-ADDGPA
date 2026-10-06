// ══ FILA → os blocos de ação no fim da conversa ═══════════════════════════
//
// "Continuar", "Destravar" e o relatório — mais o envio de um complemento.
//
// ⚠️ CONTINUAR NÃO É REENVIAR. A tarefa guarda quantas rodadas já gastou, e
// continuar parte do pedido de correção que ficou gravado no histórico. É por
// isso que o botão precisa do estado da tarefa, e não só do id.
//
// ⚠️ O COMPLEMENTO APARECE NA CONVERSA ANTES DE A PESQUISA RECOMEÇAR, porque
// quem o grava é o backend no momento do Enviar. O núcleo NÃO o acrescenta de
// novo — repeti-lo mandaria a mesma frase duas vezes.

// Os dois modos de continuar uma tarefa que já terminou uma passada. Não são
// duas ações diferentes lado a lado — são as DUAS OPÇÕES de uma escolha só, e
// por isso dividem a mesma classe de botão: o que as separa é o rótulo e qual
// delas está marcada. Clicar na que já está marcada desmarca.
//
// ⚠️ Clicar NÃO inicia, e a linha de texto abaixo dos botões diz isso. Sem ela o
// botão promete uma coisa e faz outra.
function _filaBlocoContinuar(tarefa) {
  const wrap = document.createElement('div');
  wrap.className = 'fila-relatorio-wrap fila-continuar-wrap';

  const linha = document.createElement('div');
  linha.className = 'fila-continuar-botoes';
  Object.keys(FILA_CONTINUAR_ROTULO).forEach(modo => {
    const marcado = tarefa.proxima_continuacao === modo;
    const btn = document.createElement('button');
    btn.className = 'btn-fila-mini' + (marcado ? ' btn-fila-mini-marcado' : '');
    btn.textContent = (marcado ? '✓ ' : '') + FILA_CONTINUAR_ROTULO[modo];
    btn.title = modo === 'teto_cheio'
      ? 'Zera as rodadas, as devoluções e as voltas: o orçamento inteiro de novo.'
      : 'Usa o que sobrou do orçamento. Fez 20 de 30 rodadas, ganha mais 10.';
    // Clicar no que já está marcado desmarca — é o jeito de desfazer sem
    // precisar de um terceiro botão só para isso.
    btn.addEventListener('click', () =>
      _filaMarcarContinuacao(tarefa.id, marcado ? null : modo));
    linha.appendChild(btn);
  });
  wrap.appendChild(linha);

  const nota = document.createElement('div');
  nota.className = 'fila-continuar-nota';
  nota.textContent = tarefa.proxima_continuacao
    ? 'Marcada. Ela roda no próximo "▶ Iniciar tarefas".'
    : 'Marcar não inicia nada — quem roda é o "▶ Iniciar tarefas".';
  wrap.appendChild(nota);
  return wrap;
}

// Só aparece em "Pesquisando", e não promete nada: o backend recusa se houver
// worker vivo. Reusa `.btn-fila-mini`, a mesma variante do "Ver relatório" —
// `.btn` sozinho não define fundo nenhum.
function _filaBlocoDestravar(tarefa) {
  const wrap = document.createElement('div');
  wrap.className = 'fila-relatorio-wrap';
  const btn = document.createElement('button');
  btn.className = 'btn-fila-mini';
  btn.textContent = 'Devolver para a fila';
  btn.title = 'Use se a tarefa ficou presa em "Pesquisando" sem nada acontecer. '
            + 'Nada é apagado, e nada recomeça sozinho.';
  btn.addEventListener('click', () => _filaDevolverParaFila(tarefa.id));
  wrap.appendChild(btn);
  return wrap;
}

function _filaBlocoRelatorio(tarefa) {
  const wrap = document.createElement('div');
  wrap.className = 'fila-relatorio-wrap';
  const alvo = document.createElement('div');
  alvo.className = 'fila-card-relatorio hidden';

  // O markdown CRU, guardado na primeira leitura. Os dois botões precisam dele
  // por motivos diferentes — um o desenha, o outro o copia —, e uma ida ao
  // disco por clique seria pagar duas vezes pela mesma coisa.
  //
  // ⚠️ O que se copia é o markdown, e NÃO o que está desenhado no painel:
  // arrastar o mouse pelo relatório aberto traz os títulos sem os `#` e as
  // listas sem os traços, e relatório é feito para ser colado em outro lugar.
  let markdown = null;
  // ⚠️ O motivo da falha é guardado junto. Ele já era mostrado no painel antes
  // desta obra, e deixá-lo cair no chão trocaria "arquivo não encontrado" por um
  // "falha ao carregar" que não ajuda ninguém.
  let erroDaLeitura = '';
  async function carregar() {
    if (markdown !== null) return markdown;
    const r = await window.pywebview.api.load_fila_relatorio(currentProject, tarefa.id);
    if (!r.success) { erroDaLeitura = r.error || 'falha ao carregar'; return null; }
    markdown = r.markdown || '';
    return markdown;
  }

  const btn = document.createElement('button');
  btn.className = 'btn-fila-mini';
  btn.textContent = 'Ver relatório ▾';
  btn.addEventListener('click', async () => {
    const abrindo = alvo.classList.contains('hidden');
    alvo.classList.toggle('hidden');
    if (abrindo && !alvo.dataset.loaded) {
      const md = await carregar();
      if (md !== null) {
        alvo.innerHTML = `<div class="fila-relatorio-md">${renderMarkdown(md)}</div>`;
        alvo.dataset.loaded = '1';
      } else {
        alvo.innerHTML = `<div class="fila-card-aviso st-vermelho">${escapeHtml(erroDaLeitura)}</div>`;
      }
    }
  });

  // Copiar SEM precisar abrir: o relatório é longo, e quem vai colá-lo noutro
  // lugar não tem por que lê-lo aqui primeiro.
  const copiar = document.createElement('button');
  copiar.className = 'btn-fila-mini';
  // 📋, e não ⎘: o glifo de copiar deste projeto é o emoji — seis botões contra
  // três. Ver Padrões de interface › Componentes › Botões.
  copiar.textContent = '📋 Copiar';
  copiar.title = 'Copia o relatório em markdown, do jeito que ele está no disco.';
  copiar.addEventListener('click', async () => {
    const md = await carregar();
    // ⚠️ `=== null` e não `!md`: relatório vazio é sucesso, e o `!md` o
    // acusaria de falha de leitura — um erro que só apareceria no dia em que
    // uma tarefa entregasse um relatório em branco.
    if (md === null) { showToast(erroDaLeitura, true); return; }
    // ⚠️ TOAST, e não o ✓ dentro do botão. A regra do projeto é pelo FORMATO do
    // botão: só-ícone responde no corpo (não há onde mais), com rótulo responde
    // por toast. O gêmeo mais próximo é o "⎘ Copiar" do Visualizar pipeline,
    // que também copia um markdown inteiro e também usa toast.
    //
    // ℹ️ E isso resolve de graça o salto de largura: trocar "📋 Copiar" por um
    // "✓" encolheria o botão no meio da linha, que é o defeito que o botão
    // Enviar do Chat já teve uma vez.
    copiarContexto(md, 'Relatório copiado.');
  });

  wrap.appendChild(btn);
  wrap.appendChild(copiar);
  wrap.appendChild(alvo);
  return wrap;
}

// O que você digita no campo de baixo. Na tarefa recém-criada, esta mensagem
// não complementa nada: ela É a tarefa. O backend decide qual dos dois casos
// é, e devolve `primeira` para a tela saber o que dizer.
async function _filaEnviarMensagem() {
  const input = document.getElementById('fila-chat-input');
  const texto = input.value.trim();
  if (!texto || !_filaSelecionadaId) return;
  const r = await window.pywebview.api.complementar_tarefa_fila(
    currentProject, _filaSelecionadaId, texto, _filaPromptFixoSelecionado || null);
  if (!r.success) { showToast(r.error || 'Falha ao gravar', true); return; }
  input.value = '';
  // O reset é do BOTÃO, não da tarefa: o que volta para "Nenhum" é o seletor,
  // para a próxima tarefa não herdar a escolha sem querer. O prompt fixo continua
  // valendo para todas as rodadas da tarefa em que foi aplicado.
  _filaSetPromptFixo('');
  showToast(r.primeira
    ? 'Tarefa escrita. Clique em "Iniciar tarefas" para começar a pesquisa.'
    : 'Complemento registrado. Clique em "Iniciar tarefas" para reprocessar.');
  await _filaRefreshEstado();
}
