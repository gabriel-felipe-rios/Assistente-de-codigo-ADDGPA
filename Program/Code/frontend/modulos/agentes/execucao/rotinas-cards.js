// ══ AUTOMAÇÃO → Rotinas: o card de uma rotina e o ▶ dela ══════════════════
//
// ⚠️ O ▶ PASSA PELA TRAVA DE CINCO PONTAS, e isso já não foi verdade. Catorze
// dos quinze ▶ desta sub-aba disparavam POR FORA dela — e o sintoma era duas
// coisas pedindo ao LM Studio ao mesmo tempo, cada uma achando que tinha a vez.
// Um botão novo que chame a API direto reabre exatamente esse buraco.
//
// ⚠️ CARD RECUSADO PRECISA DIZER QUEM ESTÁ COM A VEZ. "Não deu" faz o usuário
// clicar de novo; "o Chat está usando o modelo" faz ele esperar.
//
// ⚠️ `_ROTINA_CARD_ID` TRADUZ id de CARD para id de ROTINA, e existe porque os
// dois divergiram uma vez (`doc-tecnica` × `documentacao-tecnica`). É um mapa
// com uma entrada, e é melhor assim do que renomear algo que está gravado em
// disco.
// `rodando` = há execução em voo AGORA. Quando não há, a área de progresso é
// escondida: ela guarda o resultado da última execução e não se limpa sozinha,
// então um "9 / 40" de meia hora atrás continuava na tela ao reabrir o card,
// como se fosse o estado atual do agente. Quem está rodando de verdade não
// pode ser apagado — daí a guarda em vez de esconder sempre.
// ── O ▶ de um card de rotina e a trava de cinco pontas ──────────────────────
// Catorze dos quinze ▶ da sub-aba Rotinas passavam POR FORA da trava — cinco
// deles chamam o LM Studio, e clicar ▶ no Espelho (retirado em 2026-09) e ▶ na Documentação Técnica
// disparava os dois na mesma janela, que é o cenário exato que a trava existe
// para impedir.
//
// São as três camadas de sempre (ver `trava-ia.js`), e as três precisam da
// variante "QUALQUER DONO BLOQUEIA": estes botões pertencem à ponta `rotinas`,
// que é a MESMA que o ciclo automático toma. Pela regra normal eles ficariam
// acesos durante o próprio ciclo.

/** Pergunta AGORA, no clique. Chamar ANTES de ligar flag ou apagar botão.
 *  `acionamento` = o id da rotina em Acionamentos (`doc-tecnica`,
 *  `glossario`…): liberado o clique, a rotina fica ATIVADA (D2 —
 *  `acionamentosAtivarRotina`). Sem ele (os cards da base: Detector,
 *  Hashes, Sincronia — D3), só pergunta. */
async function rotinaCliqueLiberado(acionamento) {
  if (typeof travaIALiberado === 'function' && !await travaIALiberado('rotinas', true)) {
    return false;
  }
  if (acionamento && typeof acionamentosAtivarRotina === 'function') {
    await acionamentosAtivarRotina(acionamento);
  }
  return true;
}

/**
 * Desfaz na tela o que o clique já tinha ligado, quando o motor recusa.
 *
 * ⚠️ Ler o retorno não era opcional e não era feito: os catorze cards ligavam a
 * flag e o `disabled` ANTES da chamada e descartavam a resposta. Uma recusa
 * deixava o ▶ apagado até sair e voltar da aba — e sem nada dizendo por quê.
 * É o conserto que o Chat já tinha (`chat-envio.js`).
 *
 * Devolve `true` quando houve recusa, para quem chamou poder sair.
 */
function rotinaCardRecusado(agId, r) {
  if (typeof travaIARecusou === 'function' ? !travaIARecusou(r) : (r && r.success)) {
    return false;
  }
  const btn = document.getElementById(`btn-run-${agId}`);
  if (btn) btn.disabled = false;
  const prog = document.getElementById(`${agId}-progress-area`);
  if (prog) prog.classList.add('hidden');
  _setSimpleAgentBadge(agId, 'idle');
  return true;
}

function _initSimpleAgentCard(agId, rodando = false) {
  if (!rodando) {
    const prog = document.getElementById(`${agId}-progress-area`);
    if (prog) prog.classList.add('hidden');
  }
  const toggle = document.getElementById(`${agId}-toggle`);
  const body   = document.getElementById(`${agId}-body`);
  const chev   = document.getElementById(`${agId}-chevron`);
  if (toggle && !toggle._collapseWired) {
    toggle._collapseWired = true;
    toggle.addEventListener('click', () => {
      const layout = document.querySelector('.agentes-layout');
      const st = layout ? layout.scrollTop : 0;
      const open = !body.classList.contains('hidden');
      body.classList.toggle('hidden', open);
      chev.classList.toggle('open', !open);
      requestAnimationFrame(() => { if (layout) layout.scrollTop = st; });
    });
  }
  document.querySelectorAll(`#agente-${agId} .agente-tab`).forEach(tab => {
    if (tab._tabWired) return;
    tab._tabWired = true;
    tab.addEventListener('click', () => {
      document.querySelectorAll(`#agente-${agId} .agente-tab`).forEach(t => t.classList.remove('active'));
      document.querySelectorAll(`#agente-${agId} .agente-tab-content`).forEach(p => p.classList.add('hidden'));
      tab.classList.add('active');
      const pane = document.getElementById(`${agId}-pane-` + tab.dataset.tab);
      if (pane) {
        pane.classList.remove('hidden');
        if (tab.dataset.tab === 'visualizar') _loadSimpleAgentViewer(agId);
      }
    });
  });
}

// Chamado após "limpar dados gerados" (aba Acionamentos): como o backend apaga
// TUDO que os agentes produziram, os badges que estavam "Concluído" precisam
// voltar na hora pra "Pronto" — antes isso só se corrigia reiniciando o app,
// porque o badge só era recalculado no init da aba.
// ⚠️ A LISTA É DERIVADA de `_ROTINA_INIT`, e isso conserta um bug: até
// 22/08/2026 eram onze ids escritos à mão aqui, e faltavam DOIS — `duplicados`
// e `sincronia`. Depois de "Limpar dados gerados", esses dois cards continuavam
// exibindo "Concluído" e a contagem antiga, apontando para arquivos que tinham
// acabado de ser apagados.
//
// Era a terceira lista literal por rotina do frontend a ficar para trás quando
// nasceu uma rotina nova (as outras duas: o markup de `acionamentos-template.js`
// e o `VIS_LAYOUT` do desenho). `_ROTINA_INIT`, logo abaixo, é a lista que já se
// mantém completa porque o poll depende dela — quem esquece uma rotina ali
// percebe no mesmo dia.
//
// Deriva DENTRO da função de propósito: `_ROTINA_INIT` é declarada adiante no
// arquivo, e ler no corpo do módulo cairia na zona morta do `const`. Aqui não
// há risco: quando o usuário clica em "Limpar dados gerados", todo o script já
// carregou há muito tempo.
function _resetAgentesBadgesAposLimpar() {
  const ids = Object.keys(_ROTINA_INIT)
    // `espera` (o freio) e `revezamento` (a vez na janela) não são rotinas e
    // não geram arquivo nenhum — zerar o selo dos dois apagaria um estado que
    // continua valendo depois do "Limpar".
    .filter(id => id !== 'espera' && id !== 'revezamento')
    // O selo é endereçado pelo id do CARD, que difere do id da rotina num caso
    // (`doc-tecnica` → `documentacao-tecnica`).
    .map(id => _ROTINA_CARD_ID[id] || id);
  ids.forEach(id => {
    _setSimpleAgentBadge(id, 'idle');
    const sum = document.getElementById(`${id}-summary`);
    if (sum) sum.textContent = '';
    const resultArea = document.getElementById(`${id}-result-area`);
    if (resultArea) resultArea.classList.add('hidden');
  });
}

// Re-sincroniza os cards da aba Rotinas com o estado em disco toda vez que a
// sub-aba é aberta. Antes, trocar de sub-aba só mostrava/escondia o <div>: um
// "Limpar dados gerados" feito na aba Acionamentos — ou um agente que rodou
// pelo ciclo enquanto você estava em outra sub-aba — deixava os badges
// velhos ("Concluído") até reabrir a aba Agentes inteira. Cada init...Card já
// consulta o get_*_status e repinta o badge conforme o disco, e todos são
// idempotentes (os listeners têm guarda própria), então reusamos eles.
// O id da rotina e o id do card batem em quatorze de quinze. A exceção existe
// porque o card nasceu com o nome por extenso e o id dele é chave pública de
// um monte de `getElementById`.
const _ROTINA_CARD_ID = { 'doc-tecnica': 'documentacao-tecnica' };

// id da rotina → a função que repinta AQUELE card a partir do disco. Serve ao
// poll: quando uma rotina sai do ar (terminou), só ela precisa reler o disco —
// chamar as quinze a cada dois segundos seria dezenas de idas ao backend por
// minuto para repintar cards que ninguém mexeu.
const _ROTINA_INIT = {
  'detector':         () => initDetectorCard(),
  'hashes':           () => initHashesCard(),
  'sincronia':        () => initSincroniaCard(),
  'identificadores':  () => initIdentificadoresCard(),
  'grafo-imports':    () => initGrafoImportsCard(),
  'bibliotecas':      () => initBibliotecasCard(),
  'comentarios':      () => initComentariosCard(),
  'indice-simbolos':  () => initIndiceSimbolosCard(),
  'duplicados':       () => initDuplicadosCard(),
  'doc-tecnica':      () => initDocumentacaoTecnicaCard(),
  'resumo-pastas':    () => initResumoPastasCard(),
  'indice-navegacao': () => initIndiceNavegacaoCard(),
  'glossario':        () => initGlossarioCard(),
  'pipeline':         () => initPipelineCard(),
  'embedding':        () => initEmbeddingCard(),
  'espera':          () => { if (typeof _refreshEsperaStatus === 'function') _refreshEsperaStatus(); },
  'revezamento':     () => { if (typeof _refreshRevezamentoStatus === 'function') _refreshRevezamentoStatus(); },
};

async function _syncRotinasCards() {
  // ⚠️ LIMPA O TRAVAMENTO ANTES DE COMEÇAR.
  //
  // `_rotinasSelosTravados` só é recalculado por `_rotinasEstadoVivo`, que só
  // recebe dados enquanto esta sub-aba está visível. Sair da aba com uma rotina
  // rodando e voltar depois de o ciclo terminar deixaria o travamento preso no
  // estado velho — e os `init*Card()` abaixo teriam a repintura recusada por uma
  // rotina que já não está rodando.
  //
  // Limpar aqui é seguro: o `_rotinasEstadoVivo()` do fim desta função
  // reconstrói o travamento, e ele chega DEPOIS dos inits. Se ele chegar antes
  // de algum init atrasado, o travamento já está de pé e recusa — que é
  // exatamente o comportamento desejado nos dois sentidos.
  _rotinasSelosTravados.clear();
  initResumoPastasCard();
  initGrafoImportsCard();
  initBibliotecasCard();
  initComentariosCard();
  initIndiceSimbolosCard();
  initDuplicadosCard();
  initPipelineCard();
  initDocumentacaoTecnicaCard();
  initEmbeddingCard();
  initHashesCard();
  initSincroniaCard();
  initDetectorCard();
  initIdentificadoresCard();
  initIndiceNavegacaoCard();
  initGlossarioCard();
  _rotinasPintarParalelismo();

  await _rotinasEstadoVivo();
}

