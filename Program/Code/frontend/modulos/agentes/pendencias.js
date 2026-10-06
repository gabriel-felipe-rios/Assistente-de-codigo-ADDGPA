// ── Automação → Pendências: o que as rotinas estão processando agora ─────────
// Poll de `get_processando` a cada 2 s enquanto a sub-aba está aberta. NÃO há
// push do backend: o comentário antigo prometia um `pendenciasAtualizar` que
// nunca existiu do lado do Python — a decisão está escrita em processando.py
// ("um `evaluate_js` por arquivo somaria peso ao fluxo já pesado").
//
// Duas qualidades de linha, e a diferença importa:
//   · rotina que processa arquivo a arquivo manda `conta: true` e a contagem;
//   · o resto entra pelo aviso de 'running' do ciclo, com `conta: false`, e
//     mostra `—` em vez de um `0/0` que parece progresso travado.
//
// Desde 22/08/2026 QUALQUER rotina aparece aqui, inclusive as disparadas pelo
// botão "▶ Executar" do próprio card: o registro passou a ser feito em
// `_proc_iniciar`, o gargalo por onde as doze sobem a thread. Antes só o ciclo
// registrava, e uma rotina rodando sozinha não existia para esta aba.

// ⚠️ O POLL DE 2 s DESTA TELA FOI REMOVIDO (23/08/2026), e não é perda de
// funcionalidade: quem bate no backend agora é o poll único de
// `abas-processando.js`. Ele precisa rodar sempre — é o que acende a bolinha da
// aba Automação mesmo com o usuário em outra aba — e ENTREGA o resultado para cá
// quando esta sub-aba está na frente. Eram duas perguntas idênticas ao backend a
// cada 2 s; virou uma.

function initPendenciasTab() {
  pendRefresh();   // a abertura não espera a próxima passada do poll das abas
}

// Visível de verdade = a aba de cima E a sub-aba. Lido pelo poll único de
// `abas-processando.js`, que decide se vale a pena entregar dados para cá.
function _pendSubAbaVisivel() {
  const pane = document.getElementById('asubtab-pendencias');
  const aba  = document.getElementById('tab-agentes');
  return !!(pane && pane.classList.contains('active') &&
            aba  && aba.classList.contains('active'));
}

// `jaObtido`: ver `_rotinasEstadoVivo`, em execucao/rotinas.js. Quem alimenta
// esta tela a cada 2 s é o poll único de `abas-processando.js`; a chamada
// própria aqui só serve à abertura da sub-aba, que não espera a próxima passada.
async function pendRefresh(jaObtido) {
  try {
    const r = jaObtido || await window.pywebview.api.get_processando(currentProject);
    if (r && r.success) pendRender(r.processando || []);
  } catch (e) { /* silencioso */ }
}

function pendRender(estado) {
  const list = document.getElementById('pend-list');
  if (!list) return;

  if (!estado || estado.length === 0) {
    list.innerHTML = '<p class="agente-viewer-empty">Nenhuma rotina processando no momento.</p>';
    return;
  }

  const conta = a => a.conta !== false && (a.total || 0) > 0;

  // Faixa de números no topo. Quem não sabe contar entra como 1 — está
  // rodando, e some do resumo seria pior que contá-la por baixo.
  let emProc = 0, aguardando = 0;
  estado.forEach(a => {
    if (!conta(a)) { emProc += 1; return; }
    emProc += (a.em_progresso && a.em_progresso.length) ? a.em_progresso.length : (a.atual ? 1 : 0);
    aguardando += a.restantes || 0;
  });
  const resumo = `
    <div class="pend-resumo">
      <div class="pend-metrica pend-metrica-proc">
        <span class="pend-metrica-num">${emProc}</span>
        <span class="pend-metrica-rot">Em processamento</span>
      </div>
      <div class="pend-metrica pend-metrica-aguard">
        <span class="pend-metrica-num">${aguardando}</span>
        <span class="pend-metrica-rot">Aguardando</span>
      </div>
      <div class="pend-metrica">
        <span class="pend-metrica-num">${estado.length}</span>
        <span class="pend-metrica-rot">Rotina${estado.length !== 1 ? 's' : ''} rodando</span>
      </div>
    </div>`;

  const cards = estado.map(a => {
    // ⚠️ O DENOMINADOR É `a_processar`, não `total`. `total` é quantos arquivos
    // EXISTEM; `a_processar` é quantos vão mesmo ser trabalhados — a diferença
    // são os pulados por hash igual, que costumam ser a maioria. Com `total`,
    // esta tela dizia "faltam 255" com 34 faltando de verdade.
    //
    // `|| a.total` é o degrau para rotina que ainda não separa as duas contas:
    // ela mantém o comportamento antigo em vez de mostrar zero.
    const alvo  = a.a_processar || a.total || 0;
    const proc  = a.processados || 0;
    const reaproveitados = a.reaproveitados || 0;
    const pct   = conta(a) && alvo > 0 ? Math.round((proc / alvo) * 100) : 0;
    // O reaproveitado aparece à parte, e só quando existe: é a resposta para
    // "ué, não eram 368 arquivos?" sem inflar o número do que falta.
    const cache = reaproveitados
      ? ` · <span class="pend-idle" title="pulados por estarem inalterados desde a última passada">${reaproveitados} reaproveitado${reaproveitados !== 1 ? 's' : ''}</span>`
      : '';
    const contagem = conta(a)
      ? `${proc}/${alvo} · faltam ${a.restantes || 0}${cache}`
      : '<span class="pend-idle" title="esta rotina não processa arquivo a arquivo">—</span>';
    const atual = a.atual
      ? `processando <code>${escapeHtml(a.atual)}</code>`
      : '<span class="pend-idle">em execução…</span>';
    // Sem contagem não há barra: uma barra a 0% mente sobre estar parada.
    const barra = conta(a) ? `<div class="pend-bar"><i style="width:${pct}%"></i></div>` : '';
    // A classe é o que pinta a faixa lateral: teal para quem conta arquivo,
    // neutra para quem só está de pé. É a mesma distinção do travessão, dita
    // de um jeito que se lê sem parar em cada linha.
    return `
      <div class="pend-item${conta(a) ? '' : ' pend-sem-conta'}">
        <div class="pend-item-head">
          <span class="pend-agente">${escapeHtml(a.agente || 'Rotina')}</span>
          <span class="pend-count">${contagem}</span>
        </div>
        <div class="pend-atual">${atual}</div>
        ${barra}
      </div>`;
  }).join('');

  list.innerHTML = resumo + cards;
}
