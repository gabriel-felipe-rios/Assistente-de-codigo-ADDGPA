// ═══════════════════════════════════ Configurações → Notificações ══
// Onde a notificação aparece, que tamanho tem e o que avisa.
// Markup em `config-notificacoes-template.js`; o filtro e a pintura em
// `notificacoes.js`, que é quem o resto do programa consulta.
//
// As três chaves moram no `settings.json` (global), e não no workspace do
// projeto: são sobre como o usuário quer VER o programa, não sobre um projeto
// — mesmo critério de `tema`.
//
// ⚠️ Grava NO CLIQUE, e não no botão. Posição e tamanho não se julgam por um
// controle marcado: só se julgam vendo a notificação no lugar novo, e por isso o
// clique aplica, grava e mostra uma prévia na mesma hora. Não há nada digitado
// para se perder, e desfazer é um clique no quadrado anterior.
//
// O botão "Salvar notificações" existe assim mesmo, como em Temas, para a barra
// de ações desta categoria ficar igual à das outras — uma barra só com
// "Restaurar padrão" fazia o usuário procurar o Salvar que não havia. Ele nunca
// tem nada pendente: regrava o estado atual e confirma em voz alta, e é a
// segunda chance de quem viu a gravação falhar no clique.

const NOTIFICACAO_PREVIA_TEXTO = 'Assim ficam as notificações.';

function initConfigNotificacoes() {
  _notifPintarPosicao();
  _notifPintarTamanho();
  _notifPintarOrigens();

  // Cliques delegados nos containers, e não controle a controle: são 9 células
  // e 15 grupos de três: um listener por elemento seria 54 listeners para
  // religar toda vez que a tela repintasse. Mesmo motivo do trilho.
  const grade = document.getElementById('notif-grade-posicao');
  if (grade && !grade._wired) {
    grade._wired = true;
    grade.addEventListener('click', async (ev) => {
      const celula = ev.target.closest('.notif-grade-celula');
      if (!celula) return;
      await salvarConfigNotificacoes({ notificacoes_posicao: celula.dataset.posicao });
      _notifPintarPosicao();
      _notifMostrarPrevia();
    });
  }

  const tamanho = document.getElementById('notif-tamanho');
  if (tamanho && !tamanho._wired) {
    tamanho._wired = true;
    tamanho.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('.mapa-toggle-btn');
      if (!btn) return;
      await salvarConfigNotificacoes({ notificacoes_tamanho: btn.dataset.tamanho });
      _notifPintarTamanho();
      _notifMostrarPrevia();
    });
  }

  const origens = document.getElementById('notif-origens');
  if (origens && !origens._wired) {
    origens._wired = true;
    origens.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('.mapa-toggle-btn');
      if (!btn) return;
      const grupo = btn.closest('.notif-origem-estados');
      if (!grupo) return;
      // Manda o dicionário INTEIRO, com a origem trocada: `save_settings_parcial`
      // faz merge raso, então um dicionário com uma chave só apagaria as outras
      // catorze.
      const atual = Object.assign({}, _notifOrigensAtuais());
      atual[grupo.dataset.origem] = btn.dataset.estado;
      await salvarConfigNotificacoes({ notificacoes_origens: atual });
      _notifPintarOrigens();
      // Sem prévia aqui de propósito: mudar um estado não muda nada de visual,
      // e uma notificação por clique em quinze linhas vira metralhadora.
    });
  }

  const btnSalvar = document.getElementById('btn-save-notificacoes');
  if (btnSalvar && !btnSalvar._wired) {
    btnSalvar._wired = true;
    btnSalvar.addEventListener('click', salvarConfigNotificacoesPeloBotao);
  }
}

// Regrava as três preferências de uma vez e confirma. Ver o ⚠️ do cabeçalho.
async function salvarConfigNotificacoesPeloBotao() {
  const ok = await salvarConfigNotificacoes({
    notificacoes_posicao: appSettings.notificacoes_posicao || NOTIFICACAO_POSICAO_PADRAO,
    notificacoes_tamanho: appSettings.notificacoes_tamanho || NOTIFICACAO_TAMANHO_PADRAO,
    notificacoes_origens: _notifOrigensAtuais(),
  });
  // ⚠️ Direto, sem o filtro: com "Configurações → Nada" a confirmação do próprio
  // botão de salvar se calaria, e o clique não daria sinal nenhum de vida.
  if (ok) pintarNotificacao('Notificações salvas!', false);
}

/** Grava e atualiza o `appSettings` em memória. */
async function salvarConfigNotificacoes(patch) {
  const r = await window.pywebview.api.save_settings_parcial(patch);
  if (!r || !r.success) {
    // ⚠️ Pinta direto, sem passar pelo filtro: com "Configurações → Nada" este
    // aviso de falha se calaria a si mesmo, e o usuário acharia que gravou.
    pintarNotificacao('Não foi possível gravar a preferência de notificações.', true);
    return false;
  }
  // ⚠️ Reatribuir o global é parte da gravação, não detalhe: `showToast` é
  // síncrono e lê daqui — sem isto, a próxima tela a gravar mandaria de volta
  // o valor velho e desfaria a mudança em silêncio.
  appSettings = Object.assign({}, appSettings, patch);
  return true;
}

// ── Pintura ────────────────────────────────────────────────────────────────

function _notifOrigensAtuais() {
  return (appSettings && appSettings.notificacoes_origens) || {};
}

function _notifPintarPosicao() {
  const atual = (appSettings && appSettings.notificacoes_posicao)
             || NOTIFICACAO_POSICAO_PADRAO;
  document.querySelectorAll('#notif-grade-posicao .notif-grade-celula').forEach((c) => {
    const aceso = c.dataset.posicao === atual;
    c.classList.toggle('active', aceso);
    c.setAttribute('aria-checked', aceso ? 'true' : 'false');
  });
}

function _notifPintarTamanho() {
  const atual = (appSettings && appSettings.notificacoes_tamanho)
             || NOTIFICACAO_TAMANHO_PADRAO;
  document.querySelectorAll('#notif-tamanho .mapa-toggle-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.tamanho === atual);
  });
}

function _notifPintarOrigens() {
  const origens = _notifOrigensAtuais();
  document.querySelectorAll('#notif-origens .notif-origem-estados').forEach((grupo) => {
    // Origem ausente vale "tudo": o merge do `load_settings` é raso, então um
    // `settings.json` gravado antes desta origem existir vem sem ela.
    const estado = origens[grupo.dataset.origem] || 'tudo';
    grupo.querySelectorAll('.mapa-toggle-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.estado === estado);
    });
  });
}

// A prévia é uma notificação DE VERDADE, e não uma miniatura desenhada: uma
// miniatura mentiria justamente sobre o que o usuário está tentando ver — a
// distância da borda e a legibilidade da letra no tamanho real.
function _notifMostrarPrevia() {
  pintarNotificacao(NOTIFICACAO_PREVIA_TEXTO, false);
}
