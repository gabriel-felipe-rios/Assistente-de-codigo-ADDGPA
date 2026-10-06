// ═══ ABA: TRABALHOS — a casca com as seis sub-abas ═════════════════════════
//
// O corpo inteiro é injetado por JS, como o de Backups: seis painéis inline no
// index.html engordariam o arquivo mais longo do frontend sem ganho nenhum.
//
// ⚠️ AS CLASSES SÃO `.agentes-subtab-*`, E NÃO `.subtab-btn`/`.sub-panel`.
// As duas convenções existem no projeto, e a antiga é a errada para uma aba
// nova: a fiação dela é GLOBAL (`document.querySelectorAll`), então uma
// segunda aba usando as mesmas classes trocaria de painel nas duas ao mesmo
// tempo. `_wireSubtabBar(escopo, dispatch)` — a mesma que Assistente,
// Automação e Backups usam — escapa disso porque parte do container da aba.
//
// ⚠️ SÃO SEIS, NESTA ORDEM, e não é ordem alfabética nem cronológica: é a
// ordem em que o trabalho acontece. Quadro (o que fazer) → Linha do tempo (o
// que aconteceu) → Fluxo (em que ordem) → Oficina (onde se faz) → Métricas (o
// que custou) → Configuração (o que não pode). **Não existe sub-aba
// "Terminais"**: a Oficina herdou a função dela, como canvas livre.
//
// Os `data-taborder-*` da barra não são decoração: a tela "Ordem das abas"
// descobre as barras sozinha por eles, e sem os três atributos esta barra
// simplesmente não apareceria lá para ser reordenada.

document.getElementById('tab-trabalhos').innerHTML = `
  <div class="agentes-subtabs-bar" data-taborder-group="trabalhos_subtabs"
       data-taborder-label="Sub-abas de Trabalhos" data-taborder-parent="tab-trabalhos">
    <button class="agentes-subtab-btn active" data-asubtab="trsub-quadro">Quadro</button>
    <button class="agentes-subtab-btn" data-asubtab="trsub-tempo">Linha do tempo</button>
    <button class="agentes-subtab-btn" data-asubtab="trsub-fluxo">Fluxo</button>
    <button class="agentes-subtab-btn" data-asubtab="trsub-oficina">Oficina</button>
    <button class="agentes-subtab-btn" data-asubtab="trsub-metricas">Métricas</button>
    <button class="agentes-subtab-btn" data-asubtab="trsub-config">Configuração</button>
  </div>

  <div id="trsub-quadro" class="agentes-subtab-content active"></div>
  <div id="trsub-tempo" class="agentes-subtab-content hidden"></div>
  <div id="trsub-fluxo" class="agentes-subtab-content hidden"></div>
  <div id="trsub-oficina" class="agentes-subtab-content hidden"></div>
  <div id="trsub-metricas" class="agentes-subtab-content hidden"></div>
  <div id="trsub-config" class="agentes-subtab-content hidden"></div>
`;
