// ═══════════════════════════════════════════════ ROTINA: REVEZAMENTO ══
// A vez na janela do LM Studio. Não roda sob demanda — não é "processado", é
// um estado que já existe: a `TRAVA_IA` do backend
// (`backend/modulos/agentes/trava_ia.py`), que é global de propósito porque a
// janela do modelo é uma só para o programa inteiro.
//
// Este card só torna esse estado visível: a janela está livre, ou está com
// alguém — e, quando está, com QUEM. Não tem liga/desliga em lugar nenhum, e
// isso é a razão de ele existir separado da Espera (ver o template ao lado).
//
// Come do MESMO `get_espera_status` que a Espera, porque os dois estados saem
// da mesma passagem pelo backend e pedir duas vezes seria duas idas à ponte
// para a mesma resposta. Quem reparte é `_acRefreshEsperaRow`, em
// acionamentos.js.

async function initRevezamentoCard() {
  _initSimpleAgentCard('revezamento');
  await _refreshRevezamentoStatus();
}

async function _refreshRevezamentoStatus(status) {
  const r = status || await window.pywebview.api.get_espera_status(currentProject);
  if (!r.success) return;

  const dono = r.bloqueado_por_projeto;
  const deOutraAba = dono && dono !== currentProject;

  // Três estados, três selos. `esperando` (roxo) é a fila de sempre; a espera
  // por OUTRA ABA usa o selo `bloqueado` — índigo —, que é a mesma cor da
  // caixa dele na sub-aba Visualizar e da bolinha na tira de abas.
  _setSimpleAgentBadge('revezamento',
    !r.aguardando_trava ? 'idle' : deOutraAba ? 'bloqueado' : 'esperando');
  const badge = document.getElementById('revezamento-badge');
  if (badge) {
    badge.textContent = !r.aguardando_trava ? 'Livre'
                      : deOutraAba ? 'Outro projeto' : 'Na fila';
  }

  const sum = document.getElementById('revezamento-summary');
  if (sum) {
    sum.textContent = deOutraAba ? `aguardando "${dono}"`
                    : r.aguardando_trava ? r.aguardando_trava
                    : 'janela livre';
  }

  const area = document.getElementById('revezamento-result-summary');
  if (!area) return;
  // Três causas, e elas não se misturam. A de outra aba vem primeiro porque é
  // a única em que não há nada de errado com ESTE projeto — e é justamente a
  // que, sem uma frase própria, se lia como "o programa travou".
  if (deOutraAba) {
    area.textContent = `A janela do LM Studio está com o projeto "${dono}" — `
      + `${r.aguardando_trava}. O ciclo deste projeto está na fila e começa `
      + 'sozinho quando aquele terminar; não é preciso vir aqui religar nada.';
  } else if (r.aguardando_trava) {
    area.textContent = `Outra tarefa deste projeto está usando o modelo: `
      + `${r.aguardando_trava}. Assim que ela terminar, a vez passa para o ciclo.`;
  } else {
    area.textContent = 'A janela do LM Studio está livre para este projeto. '
      + 'Quando duas abas de projeto pedem o modelo ao mesmo tempo, é aqui que '
      + 'a segunda espera.';
  }
}

// Chamado pelos eventos que já existem de Acionamentos, para refletir sem
// precisar reabrir a aba. Aceita o status já consultado, para não pedir a
// mesma coisa duas vezes ao backend — mesmo contrato de `esperaAtualizarEstado`.
function revezamentoAtualizarEstado(status) {
  if (document.getElementById('agente-revezamento')) _refreshRevezamentoStatus(status);
}
