/* ══════════════════════════════════════════════════════════
   FILA — um agente principal que pesquisa com horizonte longo.

   É o Chat com outro horizonte de tempo: o modelo escolhe quem chamar, chama
   os mesmos dez subagentes, e no fim escreve um relatório. Ninguém está
   esperando, então o teto de rodadas é 30 e não há limite de tempo.

   A tela também é a do Chat — mesmas classes, mesma estrutura, mesmos
   comportamentos. Sub-abas: Fila | Contexto | Subagentes | Log, a primeira
   com o nome do agente principal. Cada uma tem seu arquivo; aqui fica o
   estado global, a inicialização e o polling.
══════════════════════════════════════════════════════════ */

let _filaInitialized = false;
let _filaTarefas = [];
let _filaRodando = false;
let _filaSelecionadaId = null;
let _filaPollTimer = null;

// Os sete estados. Os dois neutros se distinguem pela FORMA, não por cor: o
// programa tem cinco cores de status e inventar uma sexta faria "na fila" e
// "aguardando a vez" parecerem coisas de naturezas diferentes, que não são.
const FILA_STATUS_INFO = {
  na_fila:             { label: 'Na fila',             cls: 'st-neutro st-vazado' },
  aguardando_vez:      { label: 'Aguardando a vez',    cls: 'st-neutro' },
  pesquisando:         { label: 'Pesquisando',         cls: 'st-azul' },
  precisa_de_voce:     { label: 'Precisa de você',     cls: 'st-alerta' },
  pronto:              { label: 'Pronto',              cls: 'st-verde' },
  pronto_com_ressalva: { label: 'Pronto com ressalva', cls: 'st-alerta' },
  falhou:              { label: 'Falhou',              cls: 'st-vermelho' },
};

// O rótulo de cada sub-tag. Só três estados carregam alguma:
// `precisa_de_voce` e `falhou` levam uma; `pronto_com_ressalva` pode levar
// várias ao mesmo tempo — um relatório pode ter mais de um defeito.
const FILA_SUBTAG_ROTULO = {
  tarefa_vaga: 'Tarefa vaga',
  falta_decisao: 'Falta uma decisão sua',
  arquivo_inexistente: 'Arquivo inexistente',
  trecho_nao_encontrado: 'Trecho não encontrado',
  contraria_decisao: 'Contraria uma decisão',
  sem_lastro: 'Sem lastro',
  pesquisa_incompleta: 'Pesquisa incompleta',
  subagente_indisponivel: 'Subagente indisponível',
  lm_studio_offline: 'LM Studio fora do ar',
  modelo_sem_resposta: 'Modelo não respondeu',
  formato_invalido: 'Resposta fora do formato',
  erro_inesperado: 'Erro inesperado',
};

const FILA_STATUS_COMPLEMENTAVEL = ['precisa_de_voce', 'pronto', 'pronto_com_ressalva', 'falhou'];
const FILA_STATUS_COM_RELATORIO = ['pronto', 'pronto_com_ressalva'];

// Os três desfechos em que dá para continuar de onde parou: formato inválido e
// teto de rodadas (os dois caem em `falhou`) e relatório entregue.
// ⚠️ `precisa_de_voce` fica FORA de propósito: lá a tarefa parou para PERGUNTAR,
// e continuar sem responder é o que não faz sentido. Ali você escreve.
const FILA_STATUS_CONTINUAVEL = ['pronto', 'pronto_com_ressalva', 'falhou'];

// Os dois modos de continuar. O id é o que vai gravado na tarefa
// (`proxima_continuacao`); o rótulo é o que você lê no botão.
const FILA_CONTINUAR_ROTULO = {
  ate_o_teto: 'Continuar até o teto',
  teto_cheio: 'Continuar com o teto cheio',
};
// O selo no card. Curto de propósito: ele divide a linha com o estado.
const FILA_CONTINUAR_SELO = 'Vai continuar';

// Título de uma tarefa que ainda não tem texto — o "Novo chat" da Fila.
const FILA_TITULO_VAZIO = 'Nova tarefa';

// O agente principal e o Verificador, que não vêm de AGENTES_DEFINICOES.
const FILA_AGENTE_PRINCIPAL = { id: 'fila', nome: 'Fila', icone: '💬' };
const FILA_VERIFICADOR = { id: 'fila-verificador', nome: 'Verificador', icone: '✅' };

async function initFilaTab() {
  xtPintarEncaixeDaFila();
  if (_filaInitialized) { _filaRefreshEstado(); return; }
  _filaInitialized = true;

  _filaMostrarModelo();
  document.getElementById('btn-fila-refresh-model')
    .addEventListener('click', _filaAtualizarModelo);

  // As duas sub-abas novas são do módulo compartilhado com o Chat. O prefixo
  // 'fila' escopa os ids; o escopo 'fila' é o que traz o Verificador.
  if (typeof wireSubagentesConfigGlobal === 'function') {
    wireSubagentesConfigGlobal('fila');
    wireSubagentesFerramentas('fila', 'fila');
  }

  // As queries são escopadas ao container da Fila. É por isso também que as
  // sub-abas daqui NÃO usam as classes `.chat-subtab-*`: `navegacao.js` fia as
  // do Chat com um querySelectorAll global, e a Fila entraria na conta dele.
  const escopo = document.getElementById('asubtab-fila');
  escopo.querySelectorAll('.fila-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      escopo.querySelectorAll('.fila-tab-btn').forEach(b => b.classList.remove('active'));
      escopo.querySelectorAll('.fila-tab-content').forEach(c => {
        c.classList.remove('active'); c.classList.add('hidden');
      });
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.ftab);
      if (target) { target.classList.remove('hidden'); target.classList.add('active'); }
      _filaRenderAbaAtiva();
    });
  });

  document.getElementById('btn-fila-nova').addEventListener('click', _filaNovaTarefa);
  document.getElementById('btn-fila-iniciar').addEventListener('click', _filaIniciar);
  document.getElementById('btn-fila-cancelar').addEventListener('click', _filaCancelar);
  document.getElementById('btn-fila-chat-enviar').addEventListener('click', _filaEnviarMensagem);
  document.getElementById('fila-chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _filaEnviarMensagem(); }
  });

  _filaInitSubagentesConfig();
  _filaInitChamadasPanel();
  _initFilaPromptFixoPanel();

  await _filaRefreshEstado();
  await _filaRefreshFrescor();
}

// Ponto de encaixe `fila.painel` (fase 11): repintado ao abrir a Fila e ao
// trocar a tarefa selecionada (`_filaSelecionarTarefa`, fila-lista.js).
function xtPintarEncaixeDaFila() {
  const alvo = document.getElementById('fila-encaixe');
  if (!alvo || typeof xtEncaixe !== 'function') return;
  xtEncaixe('fila.painel', alvo, {
    projeto: (typeof currentProject !== 'undefined' && currentProject) || null,
    tarefa: (typeof _filaSelecionadaId !== 'undefined' && _filaSelecionadaId) || null,
  });
}

// O modelo é o mesmo do Chat: um só para o programa inteiro, o primeiro que o
// LM Studio devolve. `loadModels()` já busca e grava o `activeModel` global e a
// janela de contexto — aqui só ESPELHAMOS o valor, sem ir à rede.
//
// ⚠️ Espelhar, e não buscar, é o que faz esta tela abrir na hora. Antes a
// abertura da Fila esperava um `loadModels()` próprio (duas requisições ao LM
// Studio: a lista de modelos e a janela de contexto) ANTES de chegar em
// `_filaRefreshEstado`, que é quem pinta a lista de tarefas. A lista, que só
// depende de um JSON no disco, ficava esperando a rede — e com o LM Studio
// lento ou fora do ar, esperava até o timeout.
function _filaMostrarModelo() {
  const el = document.getElementById('fila-model-name');
  if (!el) return;
  el.textContent = activeModel || 'LM Studio offline';
  el.classList.toggle('model-offline', !activeModel);
}

// Só o botão ⟳ refaz a requisição — é para isso que ele existe.
async function _filaAtualizarModelo() {
  try {
    await loadModels();
  } catch (e) { /* o indicador abaixo já mostra o resultado */ }
  _filaMostrarModelo();
}

function _filaRenderAbaAtiva() {
  const ativo = document.querySelector('#asubtab-fila .fila-tab-btn.active');
  if (!ativo) return;
  const ftab = ativo.dataset.ftab;
  if (ftab === 'ftab-fila') _filaRenderChatTab();
  if (ftab === 'ftab-contexto') _filaRenderContextoTab();
  if (ftab === 'ftab-subagentes') _filaRenderSubagentesTab();
  // Gerada do backend na hora de abrir: depende de configuração que pode ter
  // mudado no meio da sessão. E pede o escopo 'fila' — a tabela NÃO é a mesma
  // do Chat, porque a Fila tem o Verificador.
  if (ftab === 'ftab-ferramentas' && typeof renderSubagentesFerramentas === 'function') {
    renderSubagentesFerramentas('fila', 'fila');
  }
  if (ftab === 'ftab-log') _filaRenderLogTab();
}

// ── Estado / polling ─────────────────────────────────────────────────────────

async function _filaRefreshEstado() {
  if (!currentProject) return;
  const r = await window.pywebview.api.load_fila_estado(currentProject);
  if (!r.success) return;
  _filaTarefas = r.tarefas || [];
  _filaRodando = _filaTarefas.some(t => t.status === 'pesquisando');
  // ⚠️ O polling volta a rodar sempre que há tarefa em pesquisa — inclusive ao
  // REENTRAR na aba. Ele só era ligado pelo clique em "Iniciar tarefas": saindo
  // da aba e voltando com a Fila em andamento, o timer não subia de novo, e o
  // cronômetro "Rodando há" ficava congelado entre um evento e outro. Quem o
  // desliga continua sendo o próprio timer, quando a fila para.
  if (_filaRodando) _filaStartPoll();
  _filaRenderLista();
  _filaAtualizarBotoes();
  // Fora das sub-abas: o dropdown "Chamadas" mora na área de envio e fica
  // visível em qualquer uma delas.
  _filaRenderChamadas();
  _filaRenderAbaAtiva();
}

async function _filaRefreshFrescor() {
  if (!currentProject) return;
  const r = await window.pywebview.api.load_fila_frescor(currentProject);
  const el = document.getElementById('fila-frescor-aviso');
  if (r.success && r.defasado && r.aviso) {
    el.textContent = '⚠ ' + r.aviso;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

function _filaAtualizarBotoes() {
  const btnIniciar = document.getElementById('btn-fila-iniciar');
  const btnCancelar = document.getElementById('btn-fila-cancelar');
  const badge = document.getElementById('fila-status-badge');

  const emJogo = _filaTarefas.filter(
    t => t.status === 'pesquisando' || t.status === 'aguardando_vez').length;
  const naFila = _filaTarefas.filter(
    t => t.status === 'na_fila' && (t.texto || '').trim()).length;

  if (_filaRodando) {
    btnIniciar.classList.add('hidden');
    btnCancelar.classList.remove('hidden');
    const aguardando = _filaTarefas.filter(t => t.status === 'aguardando_vez').length;
    badge.textContent = `Rodando ${emJogo - aguardando} de ${emJogo}`;
    badge.className = 'fila-status-badge st-azul';
  } else {
    btnIniciar.classList.remove('hidden');
    btnCancelar.classList.add('hidden');
    badge.textContent = naFila > 0 ? `${naFila} na fila` : '';
    badge.className = 'fila-status-badge st-neutro';
  }
  badge.classList.toggle('hidden', !badge.textContent);
  // Quem manda no botão é a trava de cinco pontas, não só o estado da Fila: o
  // Chat e as Rotinas também ocupam a janela do LM Studio.
  if (typeof atualizarTravaIA === 'function') atualizarTravaIA();
}

async function _filaIniciar() {
  if (!activeModel) {
    showToast('Nenhum modelo disponível. Verifique se o LM Studio está rodando.', true);
    return;
  }
  // A trava de cinco pontas conferida no clique. O backend recusa de novo do
  // lado dele (é ele o guarda final), mas aqui o motivo aparece antes, sem
  // esperar a volta do poll de 4 s.
  if (typeof travaIALiberado === 'function' && !await travaIALiberado('fila')) return;
  const r = await window.pywebview.api.iniciar_fila(
    currentProject, activeModel, _filaSubagentesConfig());
  if (!r.success) {
    showToast(r.error || 'Falha ao iniciar a fila', true);
    // Recusa da trava de cinco pontas: a tela mostra o motivo ao lado do botão.
    if (r.trava && typeof atualizarTravaIA === 'function') atualizarTravaIA();
    return;
  }
  if (!r.tarefas_iniciadas) {
    showToast('Nenhuma tarefa para iniciar. Escreva o que você quer no campo abaixo.');
  }
  _filaRodando = true;
  if (typeof atualizarTravaIA === 'function') atualizarTravaIA();
  await _filaRefreshEstado();
  _filaStartPoll();
}

async function _filaCancelar() {
  await window.pywebview.api.cancelar_fila(currentProject);
  // O texto antigo ("para após a tarefa atual terminar") descrevia o
  // comportamento antigo, em que o Cancelar só impedia a PRÓXIMA tarefa. Hoje
  // ele para também a que está rodando, no fim da rodada — nunca no meio de uma
  // chamada, porque o trabalho da rodada já foi pago.
  showToast('A fila para no fim da rodada atual. Nada é perdido: '
            + '"Iniciar tarefas" continua de onde parou.');
  await _filaRefreshEstado();
}

function _filaStartPoll() {
  if (_filaPollTimer) return;
  _filaPollTimer = setInterval(async () => {
    await _filaRefreshEstado();
    if (!_filaRodando) { clearInterval(_filaPollTimer); _filaPollTimer = null; }
  }, 4000);
}

// Trocar de projeto zera a Fila inteira. Sem isto, a lista do projeto anterior
// continuava em memória e a primeira notificação do projeto novo apenas se
// somava a ela. O timer também morre: ele consulta `currentProject`, e ficaria
// perguntando pelo projeto novo enquanto pinta a lista do velho.
function _filaLimparEstado() {
  _filaTarefas = [];
  _filaRodando = false;
  _filaSelecionadaId = null;
  if (_filaPollTimer) { clearInterval(_filaPollTimer); _filaPollTimer = null; }
  // As três sub-telas da Fila também guardam estado por tarefa, e ficavam de
  // fora: com abas de projeto, a contagem de tokens do Log, o prompt fixo
  // escolhido e os sinais por tarefa atravessavam a troca de projeto — todos
  // chaveados por ID de tarefa, que não é único entre projetos.
  if (typeof _filaLogTokens !== 'undefined') _filaLogTokens = {};
  if (typeof _filaPromptFixoSelecionado !== 'undefined') _filaPromptFixoSelecionado = '';
  if (typeof _filaSinaisPorTarefa !== 'undefined') {
    Object.keys(_filaSinaisPorTarefa).forEach(k => { delete _filaSinaisPorTarefa[k]; });
  }
}

// ── Callbacks vindos do backend (evaluate_js) ────────────────────────────────

// ⚠️ `projeto` chega do backend e é obrigatório de fato, ainda que a assinatura
// aceite `undefined`: sem ele, a tarefa do projeto A caía na lista do projeto B
// pelo `push` do `else` lá embaixo — e `_filaRodando` virava verdadeiro em B,
// escondendo o "Iniciar tarefas" de lá. Empurrão de outro projeto é descartado
// sem tocar em nada.
function filaTarefaAtualizada(tarefa, projeto) {
  if (projeto && projeto !== currentProject) return;
  const i = _filaTarefas.findIndex(t => t.id === tarefa.id);
  if (i >= 0) _filaTarefas[i] = tarefa; else _filaTarefas.push(tarefa);
  _filaRodando = _filaTarefas.some(t => t.status === 'pesquisando');
  _filaRenderLista();
  _filaAtualizarBotoes();
  if (!_filaRodando && _filaPollTimer) { clearInterval(_filaPollTimer); _filaPollTimer = null; }
  if (_filaSelecionadaId === tarefa.id) {
    // ⚠️ `podeEscrever` só era recalculado em `_filaSelecionarTarefa`, ou
    // seja, no CLIQUE. A tarefa selecionada começar a rodar não passa por lá: a
    // linha de escrever continuava na tela durante a pesquisa, e o que você
    // digitasse não tinha para onde ir.
    // Chamar `_filaSelecionarTarefa` aqui resolveria e quebraria outra coisa —
    // ela zera o contador de tokens, e a contagem sumiria a cada notificação.
    _filaAtualizarControlesDaTarefa(tarefa);
    // A tarefa que chegou traz o log inteiro, que é de onde sai a contagem de
    // chamadas. Sem isto o número só andava na volta do polling, 4 segundos
    // depois — e parava de andar de vez quando a fila terminava.
    _filaRenderChamadas();
    _filaRenderAbaAtiva();
  }
}

// Evento chegando do Python enquanto a pesquisa roda. Aqui NÃO se redesenha o
// Log inteiro: são centenas de eventos por tarefa, e cada redesenho releria o
// arquivo de log do disco. O grupo novo é acrescentado no fim, como o Chat faz
// ao vivo; a reconstrução completa fica para quando você entra na aba.
function filaLogAtualizado(tarefaId, evento) {
  if (_filaSelecionadaId !== tarefaId || !evento) return;
  if (evento.agente === 'subagente' && evento.evento === 'fim') {
    _filaSomarTokens(evento.nome, evento.uso);
    _filaRenderLogTokens();
  }
  const naAbaLog = !!document.querySelector('#asubtab-fila .fila-tab-btn.active[data-ftab="ftab-log"]');
  if (naAbaLog) _filaAnexarLogAoVivo(evento);
  else _filaRenderAbaAtiva();
}
