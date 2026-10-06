// ══════════════════════════════════════════════════════ ABA: AGENTES ══
//
// ── Este arquivo era 787 linhas, e virou três ─────────────────────────────
//
// Pelo teto de 500 da AMF. Cada um responde uma pergunta:
//
//   rotinas.js          o estado, as sub-abas, a montagem e os filtros
//   rotinas-cards.js    o card de uma rotina, o ▶ e a trava
//   rotinas-estado.js   quem está rodando AGORA, por cima do disco
//
// ⚠️ SÃO SCRIPTS CLÁSSICOS, NÃO MÓDULOS: as funções e os `let` do topo
// continuam globais. O `index.html` carrega os três na ordem acima.

// Liga uma barra de sub-abas do padrão `.agentes-subtab-btn` / `.agentes-subtab-content`.
//
// O ESCOPO É OBRIGATÓRIO. Existem duas barras com essas mesmas classes — a de
// Automação e a de Assistente — e uma query global faria cada uma apagar o
// estado da outra: clicar em "Fila" (Assistente) tiraria o `active` de
// "Acionamentos" (Automação), e você só descobriria ao voltar para Automação e
// encontrá-la em branco. Por isso as duas queries partem do container da aba,
// não do document.
//
// `dispatch` recebe o id do painel alvo e roda o init lazy daquela sub-aba.
function _wireSubtabBar(escopo, dispatch) {
  if (!escopo) return;
  escopo.querySelectorAll('.agentes-subtab-btn').forEach(btn => {
    if (btn._asubtabWired) return;
    btn._asubtabWired = true;
    btn.addEventListener('click', () => {
      escopo.querySelectorAll('.agentes-subtab-btn').forEach(b => b.classList.remove('active'));
      escopo.querySelectorAll('.agentes-subtab-content').forEach(c => {
        c.classList.remove('active'); c.classList.add('hidden');
      });
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.asubtab);
      if (target) { target.classList.remove('hidden'); target.classList.add('active'); }
      dispatch(btn.dataset.asubtab);
    });
  });
}

// Init lazy das sub-abas de Automação. Separado do listener para o
// `initAgentesTab()` poder despachar a sub-aba já aberta sem simular clique.
function _dispatchAutomacao(id) {
  if (id === 'asubtab-rotinas') _syncRotinasCards();
  if (id === 'asubtab-acionamentos') initAcionamentosTab();
  if (id === 'asubtab-visualizar') initVisualizarAcionamentosTab();
  if (id === 'asubtab-erros' && typeof initErrosTab === 'function') initErrosTab();
  if (id === 'asubtab-pendencias' && typeof initPendenciasTab === 'function') initPendenciasTab();
  if (id === 'asubtab-referencia' && typeof initReferenciaTab === 'function') initReferenciaTab();
  if (id === 'asubtab-historico' && typeof initHistoricoTab === 'function') initHistoricoTab();
}

// De qual projeto são as prévias e a seleção de arquivo dos cards. Os dados
// são recarregados logo abaixo, mas entre a troca de aba e a volta das
// chamadas a tela mostrava a ÁRVORE DE ARQUIVOS do projeto anterior — com
// caminhos que nem existem no projeto novo.
let _rotinasProjeto = null;

function _rotinasLimparEstadoDeProjeto() {
  if (_rotinasProjeto === currentProject) return;
  _rotinasProjeto = currentProject;
  if (typeof _docTecnicaPreviewData !== 'undefined') _docTecnicaPreviewData = null;
  // `_rotinasVivos` e `_rotinasSelosTravados` NÃO entram: os dois são
  // recalculados do zero a cada volta de `_rotinasEstadoVivo`, que já pergunta
  // por `currentProject`. Zerá-los aqui só criaria uma janela em que um selo
  // vivo pisca de volta para "Pronto".
}

async function initAgentesTab() {
  _rotinasLimparEstadoDeProjeto();
  // Sub-abas de Automação. Fila, Designer e Visualizar pipeline saíram
  // desta aba e agora moram em Assistente (ver modulos/assistente.js).
  _wireSubtabBar(document.getElementById('tab-agentes'), _dispatchAutomacao);

  // Agrupamento e filtros dos cards não dependem de nenhuma chamada assíncrona
  // (só leem atributos data-* que já estão no HTML) — por isso rodam aqui,
  // antes dos `await` abaixo. Se rodassem só lá embaixo (como antes), abrir a
  // sub-aba rápido logo ao iniciar o app mostrava os cards ainda no lugar
  // errado (todos dentro de "Dependentes") até as chamadas responderem.
  _agruparCards();
  _initFiltrosAgentes();
  _rotinasWireLinkExplicacoes();

  // O `list_models()` que ficava aqui era a parte lenta da abertura desta
  // aba, e servia para preencher cinco `<select>` de modelo que não existem
  // mais: quem escolhe o modelo é o LM Studio, e o backend o resolve.
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
  initIdentificadoresCard();
  initDetectorCard();
  initEsperaCard();
  initRevezamentoCard();
  initIndiceNavegacaoCard();
  initGlossarioCard();

  _automacaoDespacharSubAbaAberta();
}

// O link «Detalhes em Explicações.» de cada card (`explicacaoDoCard`, em
// `explicacoes-dados.js`) abre a sub-aba Explicações — o mesmo que clicar no
// botão dela. Delegado no painel, uma vez só: os cards são remontados.
function _rotinasWireLinkExplicacoes() {
  const painel = document.getElementById('asubtab-rotinas');
  if (!painel || painel._linkExplicacoesWired) return;
  painel._linkExplicacoesWired = true;
  painel.addEventListener('click', e => {
    const link = e.target.closest('[data-ir-explicacoes]');
    if (!link) return;
    e.preventDefault();
    const btn = document.querySelector('#tab-agentes .agentes-subtab-btn[data-asubtab="asubtab-referencia"]');
    if (btn) btn.click();
  });
}

// Recarrega a sub-aba de Automação que está aberta AGORA.
//
// ⚠️ Isto faltava, e era um bug de aba de projeto. `initAgentesTab()` terminava
// sempre em `initAcionamentosTab()` — ou seja, voltar para uma aba de projeto
// com a Automação aberta recarregava só Acionamentos, e Visualizar, Rotinas,
// Erros, Pendências, Histórico e Explicações continuavam mostrando o conteúdo do
// projeto ANTERIOR até o usuário clicar nelas na mão. Era o "tem coisa que não
// recarrega na hora, tenho que sair e entrar".
//
// `initAssistenteTab` (assistente.js) e `initBackupsTab` (backups.js) já faziam
// exatamente isto; a Automação era a única das três que não fazia.
//
// Acionamentos roda SEMPRE, mesmo quando não é a sub-aba visível: é ela que
// carrega `_acSettings` (as chaves), a bolinha global do ciclo e o estado da
// Espera, que as outras sub-abas leem. Quando ela É a visível, roda uma vez só.
function _automacaoDespacharSubAbaAberta() {
  const escopo = document.getElementById('tab-agentes');
  const ativa  = escopo && escopo.querySelector('.agentes-subtab-btn.active');
  const id     = ativa ? ativa.dataset.asubtab : 'asubtab-acionamentos';
  initAcionamentosTab();
  if (id !== 'asubtab-acionamentos') _dispatchAutomacao(id);
}

// ── Agrupamento e filtros ──────────────────────────────────────────────────
// Os cards ficam no index.html na ordem em que foram escritos; aqui eles são
// movidos para o grupo certo (independentes / dependentes). Assim acrescentar
// um card novo não obriga a reposicionar blocos grandes de HTML.

function _agruparCards() {
  const grupos = {
    base:  document.getElementById('agente-grupo-base'),
    freio: document.getElementById('agente-grupo-freio'),
    ind:   document.getElementById('agente-grupo-ind'),
    dep:   document.getElementById('agente-grupo-dep'),
  };
  if (!grupos.ind || !grupos.dep) return;
  // `base` e `freio` são os dois grupos novos (2026-08-26). O `|| grupos.ind`
  // lá embaixo é o degrau: num DOM antigo, sem esses dois containers, os cards
  // caem em Independentes como caíam antes — a tela fica velha, mas não quebra.

  // Ordem desejada dentro de cada grupo — a mesma em que o backend executa
  // (`_AC_REQUISITOS`, em acionamentos_pipeline.py). Um id que falte aqui não
  // some da tela, mas fica fora do reordenamento: como todos os outros são
  // movidos para o fim com `appendChild`, ele acaba sozinho no começo do grupo.
  // Era o que acontecia com a Sincronia.
  // A base abre a lista, na ordem em que roda de verdade: Detector → Hashes →
  // Sincronia. O Revezamento fecha a base — ele não roda, decide QUANDO os
  // outros rodam. A Espera vem logo atrás, porque é o freio entre eles e o resto.
  const ordem = ['detector', 'hashes', 'sincronia', 'revezamento', 'espera',
                 'indice-simbolos', 'identificadores',
                 'grafo-imports',
                 'bibliotecas', 'comentarios', 'duplicados',
                 'documentacao-tecnica', 'resumo-pastas',
                 'indice-navegacao', 'glossario', 'pipeline', 'embedding'];

  ordem.forEach(id => {
    const card = document.querySelector(`.agente-card[data-agente="${id}"]`);
    if (!card) return;
    const destino = grupos[card.dataset.grupo] || grupos.ind;
    if (!destino) return;
    destino.appendChild(card);
  });
}

function _initFiltrosAgentes() {
  document.querySelectorAll('.agente-chip[data-filtro]').forEach(chip => {
    if (chip._filtroWired) return;
    chip._filtroWired = true;
    chip.addEventListener('click', () => {
      chip.classList.toggle('on');
      _aplicarFiltrosAgentes();
    });
  });

  const recolher = document.getElementById('btn-recolher-agentes');
  if (recolher && !recolher._wired) {
    recolher._wired = true;
    recolher.addEventListener('click', () => {
      const algumAberto = !!document.querySelector('.agente-card-body:not(.hidden)');
      document.querySelectorAll('.agente-card-body').forEach(b => b.classList.toggle('hidden', algumAberto));
      document.querySelectorAll('.agente-chevron').forEach(c => c.classList.toggle('open', !algumAberto));
      recolher.textContent = algumAberto ? 'Expandir todos' : 'Recolher todos';
    });
  }
}

function _aplicarFiltrosAgentes() {
  const ligados = filtro => new Set(
    Array.from(document.querySelectorAll(`.agente-chip[data-filtro="${filtro}"].on`))
      .map(c => c.dataset.valor));

  const tipos = ligados('tipo');
  const destinos = ligados('destino');

  // `data-tipo` e `data-destino` são LISTAS separadas por espaço — um agente
  // pode ser determinístico e LLM ao mesmo tempo (o esqueleto é montado pelo
  // programa e só as frases vêm do modelo), e um artefato pode ter mais de um
  // consumidor. Um valor único continua funcionando: vira lista de um item.
  // Isto substituiu o antigo valor sintético 'ambos', que não escalava depois
  // que "para a máquina" se dividiu em LM Studio / assistente externo /
  // o próprio programa.
  const vals = s => (s || '').trim().split(/\s+/).filter(Boolean);
  const casa = (lista, ligados) => lista.some(v => ligados.has(v));

  document.querySelectorAll('.agente-card[data-agente]').forEach(card => {
    const tipoOk = casa(vals(card.dataset.tipo), tipos);
    const destinoOk = casa(vals(card.dataset.destino), destinos);
    card.classList.toggle('agente-oculto', !(tipoOk && destinoOk));
  });

  // Esconde o separador cujo grupo ficou vazio. ⚠️ Os QUATRO precisam estar
  // aqui: um grupo fora desta lista deixa um título órfão pairando sobre nada
  // quando o filtro esvazia o grupo dele.
  [['base', 'agente-sec-base'], ['freio', 'agente-sec-freio'],
   ['ind', 'agente-sec-ind'], ['dep', 'agente-sec-dep']].forEach(([g, secId]) => {
    const grupo = document.getElementById('agente-grupo-' + g);
    const sec = document.getElementById(secId);
    if (!grupo || !sec) return;
    const visiveis = grupo.querySelectorAll('.agente-card:not(.agente-oculto)').length;
    sec.classList.toggle('agente-oculto', visiveis === 0);
  });
}

