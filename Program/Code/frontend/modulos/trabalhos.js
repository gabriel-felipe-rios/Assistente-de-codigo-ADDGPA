// ═══ ABA: TRABALHOS — o despacho das seis sub-abas ═════════════════════════
//
// O backend vive em backend/modulos/trabalhos_estado.py (os cartões),
// trabalhos_config.py (bloqueio, Portão e limites) e trabalhos_verificacao.py
// (a conferência sem IA e o hook de lastro). Aqui só a interface.
//
// ⚠️ ESTA ABA NÃO TOCA O SISTEMA DE AGENTES LOCAIS. Nada aqui lê ou escreve na
// Fila, nos dez subagentes do LM Studio, no `fila-verificador`, no
// `trava_ia.py` ou no `Pendências.json`. É fronteira arquitetural, não
// coincidência: o assistente externo fala com o LLM dele, fora do LM Studio, e
// não disputa a trava de IA do programa.
//
// ⚠️ QUEM CRIA CARTÃO SÃO DOIS, e só dois: o usuário, à mão, e o Orquestrador,
// pelas oito ferramentas de MCP. Não há importação automática de lugar nenhum —
// nem de relatório da Fila, nem de `Briefing.md` de discussão, nem das skills
// de sugestão. Se um dia parecer prático ligar uma dessas fontes, é decisão a
// levar ao usuário, não a tomar aqui.

// De qual projeto é o que está na tela. `null` = nenhum ainda.
let trProjeto = null;

function trDespachar(id) {
  if (id === 'trsub-quadro') trCarregarQuadro();
  if (id === 'trsub-config' && typeof initTrabalhosConfig === 'function') initTrabalhosConfig();
  if (id === 'trsub-oficina' && typeof initOficina === 'function') initOficina();
  if (id === 'trsub-tempo' && typeof initTrabalhosTempo === 'function') initTrabalhosTempo();
  if (id === 'trsub-metricas' && typeof initTrabalhosMetricas === 'function') initTrabalhosMetricas();
  if (id === 'trsub-fluxo' && typeof initTrabalhosFluxo === 'function') initTrabalhosFluxo();
}

// O que na tela é DE UM PROJETO precisa ser esquecido ao trocar de projeto.
// Sem isto, abrir outro projeto deixaria na tela os cartões do anterior — e
// arrastar um deles gravaria no `Estado.json` do projeto errado, em silêncio.
function trLimparEstadoDeProjeto() {
  if (trProjeto === currentProject) return;
  trProjeto = currentProject;
  trAtividades = [];
  trFiltro = null;
  trConfig = null;
  const config = document.getElementById('trsub-config');
  if (config) delete config.dataset.montado;
  // O Fluxo é do projeto: a execução escolhida e o enquadramento não fazem
  // sentido nenhum no Quadro de outro projeto.
  if (typeof flxDados !== 'undefined') {
    flxDados = null; flxNumero = null; flxTransform = null;
  }
  // A Oficina é do projeto: deixar o canvas do anterior na tela faria um
  // arraste gravar no `Layout.json` do projeto errado, em silêncio.
  // Os terminais do projeto anterior morrem junto: o nó deles não existe mais
  // no canvas novo, e um xterm órfão ficaria escrevendo no vazio.
  if (typeof trShDescartarTudo === 'function') trShDescartarTudo();
  if (typeof ofiNos !== 'undefined') {
    ofiNos = []; ofiSelecao = new Set(); ofiZoom = 1; ofiPan = { x: 0, y: 0 };
    ofiMontada = false;
    // As ligações são do projeto como os nós: deixar as do anterior desenharia
    // fios entre ids que não existem mais no canvas novo.
    ofiLigacoes = []; ofiTiposDeLigacao = []; ofiGrupos = [];
  }
}

function initTrabalhosTab() {
  if (!currentProject) return;
  trLimparEstadoDeProjeto();
  const escopo = document.getElementById('tab-trabalhos');
  if (typeof _wireSubtabBar === 'function') _wireSubtabBar(escopo, trDespachar);

  // Despacha a sub-aba já aberta sem simular clique — o mesmo motivo de
  // `_dispatchAutomacao` existir separado do listener.
  const ativa = escopo && escopo.querySelector('.agentes-subtab-btn.active');
  trDespachar(ativa ? ativa.dataset.asubtab : 'trsub-quadro');
}
