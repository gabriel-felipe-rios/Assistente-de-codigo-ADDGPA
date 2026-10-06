// ══ AUTOMAÇÃO → o que a tela mostra enquanto o ciclo roda ═════════════════
//
// A bolinha de status global, a última execução de cada rotina, a dica de
// dependência, o "pulado e por quê", a decisão do Detector e a contagem.
//
// ⚠️ QUEM VIGIA É O DETECTOR, E O ESTADO DELE NÃO ESTÁ NAS SETTINGS. Ele é a
// thread de pé, e só `get_espera_status` sabe dizer. Enquanto o status global
// lia a chave da Espera, desligar o freio dizia "monitoramento desligado" com
// o programa vigiando o disco normalmente.
//
// ⚠️ ROTINA PULADA PRECISA DIZER QUAL REQUISITO FALTOU. Sem isso ela aparece
// como se nunca tivesse sido considerada, e o usuário vai procurar o defeito
// na rotina errada — a que não rodou, em vez da que não produziu.
//
// ⚠️ A DECISÃO DO DETECTOR É PINTADA NA LINHA DE CADA ROTINA, e não num painel
// separado: o que interessa é "por que ESTA vai rodar", e a resposta só é útil
// ao lado dela.
// ⚠️ Quem vigia é o DETECTOR, e o estado dele não está nas settings: ele é a
// thread de pé, e só `get_espera_status` sabe dizer. Enquanto esta função lia a
// chave da Espera, desligar o freio dizia "monitoramento desligado" com o
// programa vigiando o disco normalmente.
async function _acUpdateGlobalStatus() {
  const anyActive = _acAlgumaLigada();
  _acPintarBase();
  if (!anyActive) { _acSetDot('idle', 'Nenhum agente ativado'); return; }
  let vigiando = false;
  try {
    const r = await window.pywebview.api.get_espera_status(currentProject);
    vigiando = !!(r && r.success && r.vigiando);
  } catch (e) { /* projeto pode ainda não estar carregado */ }
  if (vigiando) _acSetDot('active', 'Detector vigiando');
  else          _acSetDot('idle',   'Rotinas ativadas — vigilância contínua desligada');
}

function _acSetDot(state, text) {
  const dot   = document.getElementById('ac-global-dot');
  const label = document.getElementById('ac-global-label');
  if (dot)   dot.className   = 'ac-dot ac-dot-' + state;
  if (label) label.textContent = text;
}

function _acFormatTs(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function _acLoadLastRuns() {
  try {
    const r = await window.pywebview.api.get_agent_last_runs(currentProject);
    if (!r.success) return;
    document.querySelectorAll('[data-last-run]').forEach(span => {
      span.textContent = 'última: ' + _acFormatTs(r.last_runs[span.dataset.lastRun]);
    });
  } catch (e) { /* aba pode não estar montada */ }
}

// A linha "aguarda: X" embaixo do nome do agente. É onde o motivo do pulo
// aparece, porque é exatamente a frase que ele desmente: o card diz que aguarda
// a Documentação Técnica, e agora diz também que ficou aguardando à toa neste ciclo.
function _acDepHint(agentId) {
  const dot = document.querySelector(`[data-agent-dot="${agentId}"]`);
  const row = dot && dot.closest('.ac-agent-row');
  return row ? row.querySelector('.ac-dep-hint') : null;
}

// ⚠️ A dica é CRIADA quando não existe, e é isto que conserta o pulo silencioso.
// Seis linhas do template não têm `.ac-dep-hint` — Índice de Símbolos,
// Bibliotecas, Comentários, Duplicados, Grafo de Imports e Doc. Técnica não
// dependem de ninguém, então não havia frase "aguarda X" para escrever. O
// `if (!hint) return;` de `_acMarcarPulado` fazia justamente essas seis não
// avisarem nada. Criar a linha na hora resolve as seis de uma vez, e não pede
// que alguém invente uma frase de dependência para quem não tem dependência.
function _acGarantirDepHint(agentId) {
  const existente = _acDepHint(agentId);
  if (existente) return existente;
  const dot = document.querySelector(`[data-agent-dot="${agentId}"]`);
  const info = dot && dot.closest('.ac-agent-row');
  const alvo = info && info.querySelector('.ac-agent-info');
  if (!alvo) return null;
  const span = document.createElement('span');
  span.className = 'ac-dep-hint';
  // Nasce vazia — quem escreve é `_acMarcarPulado`, e `_acLimparPulado` a
  // devolve ao vazio. Span vazio não ocupa altura nenhuma.
  span.dataset.textoOriginal = '';
  alvo.appendChild(span);
  return span;
}

// Duas formas de dizer por que a rotina não rodou:
//   · `requisitoId` — o id de quem ela estava esperando (ou de quem travou o
//     ciclo antes de chegar nela, que é a mesma frase e continua verdadeira);
//   · `motivo` — texto pronto, para o que não é pré-requisito nenhum: sem
//     modelo carregado no LM Studio, Detector desligado no meio do ciclo.
function _acMarcarPulado(agentId, requisitoId, motivo, dispensado) {
  const hint = _acGarantirDepHint(agentId);
  if (!hint) return;
  // Guarda o texto original UMA vez: dois pulos seguidos não podem fazer o
  // aviso virar o "original" e apagar a frase de verdade.
  if (hint.dataset.textoOriginal === undefined) {
    hint.dataset.textoOriginal = hint.textContent;
  }
  // Duas palavras diferentes para duas coisas diferentes — ver o comentário de
  // `_ac_notify_agent_pulado` no backend. "Dispensada" é o ciclo funcionando;
  // "pulada" é trabalho que ficou para a próxima volta.
  hint.textContent = dispensado
    ? `dispensada — ${motivo || 'o Detector não pediu esta rotina'}`
    : (motivo
        ? `pulada — ${motivo}`
        : `pulada — ${AC_NOMES_AGENTES[requisitoId] || requisitoId} não terminou neste ciclo`);
  hint.classList.toggle('ac-dep-hint-dispensado', !!dispensado);
  hint.classList.toggle('ac-dep-hint-pulado', !dispensado);
  hint.classList.remove('ac-dep-hint-erro');
}

// A rotina rodou e caiu (D28 d): o motivo vai na mesma linha do pulo, em
// vermelho. `_acLimparPulado` devolve a frase original quando ela volta a rodar.
function _acMarcarErro(agentId, motivo) {
  const hint = _acGarantirDepHint(agentId);
  if (!hint) return;
  if (hint.dataset.textoOriginal === undefined) {
    hint.dataset.textoOriginal = hint.textContent;
  }
  hint.textContent = `erro — ${motivo}`;
  hint.classList.remove('ac-dep-hint-pulado', 'ac-dep-hint-dispensado');
  hint.classList.add('ac-dep-hint-erro');
}

function _acLimparPulado(agentId) {
  const hint = _acDepHint(agentId);
  if (!hint || hint.dataset.textoOriginal === undefined) return;
  hint.textContent = hint.dataset.textoOriginal;
  hint.classList.remove('ac-dep-hint-pulado', 'ac-dep-hint-dispensado', 'ac-dep-hint-erro');
}

function acionamentosAgentDone(data) {
  // Com mais de um projeto aberto ao mesmo tempo, este evento pode vir de um
  // projeto que não é o exibido agora — o id do agente ('doc-tecnica', 'pipeline'…)
  // é o MESMO em todos os projetos.
  //
  // ⚠️ EVENTO DE OUTRA ABA NÃO É DESCARTADO, e essa foi a mudança. Antes daqui
  // saía um `return` seco, o que impedia pintar na tela errada — mas também
  // jogava a informação fora: ao voltar naquela aba, o que aconteceu enquanto
  // ela estava atrás não existia em lugar nenhum, e o desenho aparecia todo
  // "Parado" com o ciclo ainda rodando. Agora o Visualizar GRAVA no balde
  // daquele projeto (ele pinta só o exibido — ver `_visSetEstado`), e só o que
  // é DOM da tela atual (cards, bolinhas, "última:") fica de fora.
  const doProjetoExibido = !data.project || data.project === currentProject;

  // Pulado não é concluído nem erro: o agente nem chegou a ser chamado porque
  // um pré-requisito dele não terminou. Sai por aqui sem mexer no "última:",
  // que continua valendo do ciclo anterior.
  if (data.pulado_por || data.motivo) {
    // ⚠️ ANTES DAQUI SAÍA UM `return` SECO, e era por isso que a sub-aba
    // Visualizar nunca ficava sabendo: o nó ficava com o selo roxo "Esperando"
    // da rodada anterior, ou voltava a "Parado". Quem olhava o diagrama via um
    // ciclo que "não fez nada" e nenhuma pista do porquê.
    if (typeof visualizarAgenteDispensado === 'function') {
      visualizarAgenteDispensado(data.agent, data.motivo, data.pulado_por,
                                 data.dispensado, data.project);
    }
    if (!doProjetoExibido) return;
    _acRunOnceOcupado(false);
    _acMarcarPulado(data.agent, data.pulado_por, data.motivo, data.dispensado);
    // O card da sub-aba Rotinas também precisa dizer. Sem isto ele ficava com o
    // selo da passada anterior — "Concluído" de ontem sobre um ciclo de hoje em
    // que a rotina nem chegou a ser chamada.
    if (typeof _setSimpleAgentBadge === 'function') {
      _setSimpleAgentBadge(data.agent, data.dispensado ? 'dispensado' : 'pulado');
    }
    return;
  }
  // ⚠️ Com erro, o Visualizar também fica sabendo — e com o MOTIVO (D28 d).
  // Antes o erro ia só para o `console.warn`: o nó ficava no estado anterior e
  // o card em "Esperando", sem pista nenhuma do porquê. Grava no balde mesmo
  // quando o evento é de outra aba, como o caminho de sucesso.
  if (typeof visualizarAgenteConcluido === 'function') {
    if (data.error) {
      visualizarAgenteConcluido(data.agent, true,
                                {falhou: true, motivo: data.error}, data.project);
    } else {
      visualizarAgenteConcluido(data.agent, undefined,
                                data.erros ? {erros: data.erros} : undefined, data.project);
    }
  }
  if (!doProjetoExibido) return;
  _acRunOnceOcupado(false);
  _acLimparPulado(data.agent);
  if (data.error) {
    console.warn('Agente ' + data.agent + ':', data.error);
    _acMarcarErro(data.agent, data.error);
    if (typeof _setSimpleAgentBadge === 'function') {
      const cardId = (typeof _ROTINA_CARD_ID !== 'undefined'
                      && _ROTINA_CARD_ID[data.agent]) || data.agent;
      _setSimpleAgentBadge(cardId, 'error');
      // Depois da chamada, e não antes: `_setSimpleAgentBadge` zera o `title`.
      const badge = document.getElementById(`${cardId}-badge`);
      if (badge && badge.classList.contains('agente-badge-error')) {
        badge.title = data.error;
      }
    }
  } else if (data.erros > 0 && typeof _setSimpleAgentBadge === 'function') {
    // Terminou, mas com erros (D39): o card diz "Concluído com N erros".
    const cardId = (typeof _ROTINA_CARD_ID !== 'undefined'
                    && _ROTINA_CARD_ID[data.agent]) || data.agent;
    _setSimpleAgentBadge(cardId, 'done', data.erros);
  }
  const span = document.querySelector(`[data-last-run="${data.agent}"]`);
  if (span && data.finished_at) span.textContent = 'última: ' + _acFormatTs(data.finished_at);
  _acLoadLastRuns();
}

// Contagem "processado / total" por agente, alimentada pelos próprios eventos
// de progresso de cada agente (documentacaoTecnicaAgentProgress,
// resumoPastasAgentProgress) — funciona tanto quando disparado pela aba Rotinas
// quanto pela aba Acionamentos.
// ── O que o Detector decidiu, na linha de cada rotina ───────────────────────
//
// É o item da Obra 2.4 do briefing: *"6 de 122 marcados — 114 pulados por hash
// igual, 2 por serem só comentário"*. Sem ele a economia é invisível — o ciclo
// termina depressa e não há nada na tela dizendo por quê.
//
// ⚠️ Escreve no MESMO span do contador ao vivo (`data-agent-count`), e não num
// elemento novo, porque os dois respondem a mesma pergunta em momentos
// diferentes: durante a passada, "vai em 12 de 34"; depois dela, "34 de 122
// foram marcados". Dois elementos empilhados diriam a mesma coisa duas vezes.
// Quem estiver rodando manda no span — `_acUpdateAgentCount` sobrescreve isto.
async function _acPintarDecisaoDoDetector() {
  const alvos = document.querySelectorAll('[data-agent-count]');
  if (!alvos.length) return;
  try {
    const r = await window.pywebview.api.get_detector_mudancas(currentProject);
    if (!r || !r.success || !r.existe) return;
    const mot = r.motivos || {};
    const porRotina = r.por_rotina || {};
    // A explicação do que NÃO foi marcado, montada uma vez e igual para todas:
    // o motivo é do arquivo, não da rotina.
    const razoes = [];
    if (mot.hash_igual) razoes.push(`${mot.hash_igual} pulados por hash igual`);
    Object.entries(mot.por_classe || {}).forEach(([classe, n]) => {
      const nome = (typeof DET_NOMES_CLASSES !== 'undefined'
                    && DET_NOMES_CLASSES[classe]) || classe;
      razoes.push(`${n} por ${nome.toLowerCase()}`);
    });
    alvos.forEach(span => {
      const id = span.dataset.agentCount;
      if (span.dataset.aoVivo === '1') return;   // rodando agora: não encoste
      const n = id === 'detector' ? (mot.mudaram || 0) : (porRotina[id] || 0);
      span.textContent = mot.vistos
        ? `${n} de ${mot.vistos} marcados`
        : `${n} marcado${n !== 1 ? 's' : ''}`;
      span.title = razoes.length ? razoes.join(', ') : 'nada mudou nesta passada';
    });
  } catch (e) { /* projeto pode ainda não estar carregado */ }
}

function _acUpdateAgentCount(agentId, processed, total) {
  const span = document.querySelector(`[data-agent-count="${agentId}"]`);
  if (!span) return;
  // A marca de "estou ao vivo" impede que `_acPintarDecisaoDoDetector`, que roda
  // por evento e pode chegar no meio, apague um contador em movimento.
  const vivo = (processed != null && total != null);
  span.dataset.aoVivo = vivo ? '1' : '0';
  span.textContent = vivo ? `${processed} / ${total}` : '';
  if (!vivo) _acPintarDecisaoDoDetector();
}

function acionamentosEsperaStatus(data) {
  // Mesma regra de `acionamentosAgentDone`: com múltiplos projetos abertos,
  // este aviso pode ser de um projeto que não é o exibido agora. O Visualizar
  // grava no balde daquele projeto de qualquer jeito (no fim desta função); o
  // resto daqui é DOM da tela atual e sai fora.
  const doProjetoExibido = !data.project || data.project === currentProject;

  // ⚠️ A BORDA DO CICLO É RESOLVIDA ANTES DO GUARD, e isso é o conserto.
  // Ela é estado DO PROJETO DO EVENTO, não da tela: ficava presa porque o
  // `return` logo abaixo saía antes de chegar no bloco que a apagava. O fim de
  // ciclo de A nunca apagava a marca de A enquanto B estava na frente, e um
  // `idle` de B apagava a marca de um ciclo de A que ainda rodava.
  //
  // 'running' e 'aguardando' são os únicos estados que significam "o ciclo que
  // o botão disparou ainda está de pé"; qualquer outro ('idle'/'watching')
  // marca o fim dele, com ou sem erro no meio.
  const donoDoEvento = data.project || currentProject;
  if (donoDoEvento && data.status !== 'running' && data.status !== 'aguardando') {
    delete _acCiclosRodando[donoDoEvento];
    _acRepintarBordaDoCiclo();
  }

  if (!doProjetoExibido) {
    if (typeof visualizarAgenteRodando === 'function') {
      if (data.status === 'running' && data.agent) {
        visualizarAgenteRodando(data.agent, data.project);
      } else if (data.status === 'idle') {
        visualizarOcioso(data.project);
      }
    }
    return;
  }
  // Bolinha global
  if (data.status === 'running' && data.agent) {
    _acLimparPulado(data.agent);
    _acSetDot('running', 'Executando: ' + (AC_NOMES_AGENTES[data.agent] || data.agent));
  } else if (data.status === 'aguardando') {
    // A Espera: houve mudança, mas o ciclo só é liberado depois do silêncio —
    // é o que evita rodar no meio de uma sessão do Claude Code. Com `motivo`,
    // o que segura não é o silêncio e sim a janela do LM Studio, e a frase
    // precisa dizer qual dos dois é.
    _acSetDot('running', data.motivo
      ? 'Mudança detectada — ' + data.motivo
      : 'Mudança detectada — aguardando o código parar de mudar');
  } else if (data.status === 'watching') {
    _acSetDot('active', 'Detector vigiando');
    _acLoadLastRuns();
  } else {
    // Ocioso não é o mesmo que desligado: sem o Detector de pé as rotinas
    // podem continuar ligadas — é o que sobra depois de um "Fechar" de aba,
    // ou de um ciclo que terminou sem a vigilância de pé. Quem sabe disso é
    // _acUpdateGlobalStatus.
    _acUpdateGlobalStatus();
    _acLoadLastRuns();
  }

  // ⚠️ A limpeza da borda do ciclo saiu daqui e subiu para ANTES do guard de
  // projeto, no começo desta função: aqui embaixo ela era inalcançável para
  // eventos de outro projeto.

  if (typeof _acRefreshEsperaRow === 'function') _acRefreshEsperaRow();

  // Bolinhas por agente
  document.querySelectorAll('[data-agent-dot]').forEach(dot => {
    const agentId = dot.dataset.agentDot;
    if (data.status === 'running' && data.agent === agentId) {
      dot.className = 'ac-dot ac-dot-running';
    } else {
      dot.className = 'ac-dot ac-dot-idle';
    }
  });

  // Espelha o mesmo estado na sub-aba Visualizar.
  if (typeof visualizarAgenteRodando === 'function') {
    if (data.status === 'running' && data.agent) {
      visualizarAgenteRodando(data.agent, data.project);
    } else if (data.status === 'idle') {
      visualizarOcioso(data.project);
    }
  }
}
