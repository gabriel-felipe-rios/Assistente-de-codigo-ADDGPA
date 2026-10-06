// ══ AUTOMAÇÃO → Limpar dados gerados ══════════════════════════════════════
//
// A lista do que dá para apagar, a seleção e a confirmação.
//
// ⚠️ SÓ ENTRA AQUI O QUE O PROGRAMA CONSEGUE REFAZER. Tudo nesta lista é
// artefato de rotina — índice, documentação, embedding — e apagar
// qualquer um deles significa "rode de novo", nunca "perdeu". Nada do usuário
// é oferecido nesta tela, e nada que o usuário escreveu pode ser acrescentado
// a ela.
//
// ⚠️ A CONTAGEM É REPINTADA A CADA MARCAÇÃO, e o botão só liga com algo
// marcado: uma lixeira que aceita clique com zero selecionado ensina o usuário
// a clicar sem olhar.
// ── Limpar dados gerados ────────────────────────────────────────────────────
// Botão destrutivo — passa por um modal antes de chamar a API, diferente dos
// outros da faixa. Mesmo padrão do modal de deletar projeto (modal-delete/
// modais.js), só que específico da aba Acionamentos.
//
// ⚠️ Ele apaga SÓ O QUE FOI MARCADO. Apagava tudo, sempre, e ainda desligava
// todos os acionamentos no fim — e era esse desligar que deixava o usuário com
// a documentação apagada e nada regenerando. Hoje o backend não mexe em
// acionamento nenhum e dispara um ciclo se houver rotina ligada; ver
// `limpar_dados_agentes`.

/**
 * As rotinas apagáveis, agrupadas — LIDAS DA PRÓPRIA SUB-ABA.
 *
 * ⚠️ Não existe lista de rotinas em lugar nenhum do frontend, e este modal não
 * ia ser o primeiro a inventar uma: a sub-aba Acionamentos já desenha as quinze,
 * com ícone, nome e grupo, e ela é o único lugar que precisa ser mexido quando
 * nasce a décima sexta. Ler dali é o mesmo remédio que `_AC_DEFAULTS` tomou no
 * Python ao deixar de ser literal.
 *
 * A `espera` fica de fora sozinha, sem regra especial: ela é o FREIO, não uma
 * rotina, e por isso não tem pasta de saída para apagar. O `.ac-section` dela
 * simplesmente não sobra nenhum item e some da lista.
 */
function _acRotinasParaLimpar() {
  const grupos = [];
  document.querySelectorAll('#asubtab-acionamentos .ac-section').forEach(secao => {
    const cabecalho = secao.querySelector('.ac-section-title');
    // Só a parte antes do travessão: os títulos da sub-aba explicam o grupo em
    // prosa ("A base — sempre ligadas · ligar qualquer rotina..."), e aqui
    // sobra espaço para o nome, não para a explicação.
    const titulo = ((cabecalho && cabecalho.textContent) || '').split('\u2014')[0].trim();
    const itens = [];
    secao.querySelectorAll('.ac-agent-row').forEach(linha => {
      const toggle = linha.querySelector('.ac-toggle');
      const id = toggle && (toggle.dataset.agent || toggle.dataset.agentFixo);
      if (!id || id === 'espera') return;
      const nome  = linha.querySelector('.ac-agent-name');
      const icone = linha.querySelector('.ac-agent-icon');
      itens.push({ id,
                   nome:  (nome && nome.textContent) || id,
                   icone: (icone && icone.textContent) || '' });
    });
    if (itens.length) grupos.push({ titulo, itens });
  });
  return grupos;
}

/** Redesenha a lista do modal, com tudo marcado. */
function _acLimparRenderLista() {
  const lista = document.getElementById('ac-limpar-lista');
  if (!lista) return;
  lista.innerHTML = _acRotinasParaLimpar().map(grupo =>
    '<div class="limpar-grupo">' + escapeHtml(grupo.titulo) + '</div>' +
    grupo.itens.map(item =>
      '<label class="limpar-item">' +
        '<input type="checkbox" data-limpar-id="' + escapeHtml(item.id) + '" checked />' +
        '<span class="limpar-item-icone" aria-hidden="true">' + escapeHtml(item.icone) + '</span>' +
        '<span>' + escapeHtml(item.nome) + '</span>' +
      '</label>').join('')
  ).join('');
  _acLimparAtualizarContagem();
}

/** Os ids marcados agora. */
function _acLimparMarcados() {
  return [...document.querySelectorAll('#ac-limpar-lista input[data-limpar-id]:checked')]
    .map(c => c.dataset.limparId);
}

// A contagem e o botão de confirmar andam juntos: "Limpar dados" com zero
// marcados era um clique que não fazia nada e não dizia por quê.
function _acLimparAtualizarContagem() {
  const marcados = _acLimparMarcados().length;
  const total = document.querySelectorAll('#ac-limpar-lista input[data-limpar-id]').length;
  const contagem = document.getElementById('ac-limpar-contagem');
  if (contagem) contagem.textContent = marcados + ' de ' + total + ' marcadas';
  const confirmar = document.getElementById('btn-ac-limpar-confirmar');
  if (confirmar) confirmar.disabled = marcados === 0;
}

function _acLimparMarcarTodas(marcar) {
  document.querySelectorAll('#ac-limpar-lista input[data-limpar-id]')
    .forEach(c => { c.checked = marcar; });
  _acLimparAtualizarContagem();
}

function _acWireLimparDados() {
  const btn = document.getElementById('btn-ac-limpar');
  const modal = document.getElementById('modal-ac-limpar');
  const btnCancelar = document.getElementById('btn-ac-limpar-cancelar');
  const btnConfirmar = document.getElementById('btn-ac-limpar-confirmar');
  if (!btn || !modal || !btnCancelar || !btnConfirmar || btn._acWired) return;
  btn._acWired = true;

  // Redesenhada A CADA abertura, e não uma vez na fiação: a sub-aba de onde a
  // lista sai é um template injetado, e amarrar a leitura à ordem das tags do
  // index.html é a armadilha que este projeto já registrou. Abrir de novo
  // também devolve tudo marcado, que é o estado de partida certo.
  btn.addEventListener('click', () => {
    _acLimparRenderLista();
    modal.classList.remove('hidden');
  });
  btnCancelar.addEventListener('click', () => modal.classList.add('hidden'));
  document.getElementById('btn-ac-limpar-marcar-tudo')
    .addEventListener('click', () => _acLimparMarcarTodas(true));
  document.getElementById('btn-ac-limpar-desmarcar')
    .addEventListener('click', () => _acLimparMarcarTodas(false));
  // Delegado no container: a lista é refeita a cada abertura, e um listener
  // por caixa se acumularia a cada volta.
  document.getElementById('ac-limpar-lista')
    .addEventListener('change', _acLimparAtualizarContagem);

  btnConfirmar.addEventListener('click', async () => {
    const ids = _acLimparMarcados();
    if (!ids.length) return;
    btnConfirmar.disabled = true;
    try {
      const r = await window.pywebview.api.limpar_dados_agentes(currentProject, ids);
      if (r.success) {
        _acSettings = r.settings;
        _acRenderToggles();
        _acUpdateGlobalStatus();
        _acRefreshEsperaRow();
        _acLoadLastRuns();
        document.querySelectorAll('[data-agent-count]').forEach(s => s.textContent = '');
        if (typeof visualizarResetar === 'function') visualizarResetar();
        // Cards da sub-aba Rotinas ficavam "Concluído" até reiniciar o app.
        if (typeof _resetAgentesBadgesAposLimpar === 'function') _resetAgentesBadgesAposLimpar();
        // `aviso` = havia rotina ligada, o backend tentou gerar de novo e o
        // ciclo NÃO começou. Os dados foram apagados de qualquer jeito, então
        // é aviso e não erro — mas calar seria deixar o usuário esperando por
        // uma regeneração que não vem.
        if (r.aviso) showToast(r.aviso, true);
      } else {
        console.warn('limpar_dados_agentes:', r.error);
        showToast(r.error, true);
      }
    } finally {
      btnConfirmar.disabled = false;
      modal.classList.add('hidden');
    }
  });
}
