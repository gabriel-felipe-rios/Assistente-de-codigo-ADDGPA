// ══════════════════════════════════════ TEMPLATE: Mapas › Pipeline
// Markup estático do mapa "Pipeline" (aba Mapas): as sub-abas "Leituras" e
// "Mapa em níveis", e as 6 leituras dentro da primeira. Até 2026-09 era a
// sub-aba Assistente › Visualizar pipeline; saiu de lá porque só desenha —
// não conversa com modelo nenhum (D57, D58).
//
// As 6 leituras são seis desenhos do MESMO `pipeline.md`, montados pelo
// programa. NENHUM controle desta tela chama o modelo: quem roda o agente
// Pipeline é o card dele na aba Automação › Rotinas, e só. Ver a nota em
// `mapas-pipeline.js`.

// Os pictogramas dos botões de leitura. Ficam aqui, e não no módulo de ajuda,
// porque são markup: o template precisa deles no instante em que carrega, e o
// módulo de comportamento só existe depois.
const VP_PICTOGRAMAS = {
  raias: `<svg width="15" height="12" aria-hidden="true"><rect x="0" y="0" width="15" height="3" rx="1" fill="currentColor" opacity=".5"/><rect x="0" y="4.5" width="15" height="3" rx="1" fill="currentColor" opacity=".85"/><rect x="0" y="9" width="15" height="3" rx="1" fill="currentColor" opacity=".5"/></svg>`,
  trilho: `<svg width="15" height="12" aria-hidden="true"><circle cx="3" cy="2" r="2" fill="currentColor"/><circle cx="3" cy="10" r="2" fill="currentColor"/><line x1="3" y1="2" x2="3" y2="10" stroke="currentColor" stroke-width="1.2"/><rect x="8" y="1" width="7" height="2" rx="1" fill="currentColor" opacity=".7"/><rect x="8" y="9" width="7" height="2" rx="1" fill="currentColor" opacity=".7"/></svg>`,
  sequencia: `<svg width="15" height="12" aria-hidden="true"><line x1="2" y1="0" x2="2" y2="12" stroke="currentColor" stroke-dasharray="2 2"/><line x1="13" y1="0" x2="13" y2="12" stroke="currentColor" stroke-dasharray="2 2"/><path d="M2 4 H11" stroke="currentColor" stroke-width="1.4"/><path d="M11 2 l3 2 -3 2z" fill="currentColor"/><path d="M13 9 H4" stroke="currentColor" stroke-width="1.4"/><path d="M4 7 l-3 2 3 2z" fill="currentColor"/></svg>`,
  cadeias: `<svg width="15" height="12" aria-hidden="true"><circle cx="2.5" cy="2.5" r="2" fill="currentColor"/><line x1="5" y1="2.5" x2="10" y2="2.5" stroke="currentColor" stroke-width="1.3"/><circle cx="12.5" cy="2.5" r="2" fill="currentColor"/><circle cx="2.5" cy="9.5" r="2" fill="currentColor" opacity=".6"/><line x1="5" y1="9.5" x2="10" y2="9.5" stroke="currentColor" stroke-width="1.3" opacity=".6"/><circle cx="12.5" cy="9.5" r="2" fill="currentColor" opacity=".6"/></svg>`,
  fases: `<svg width="15" height="12" aria-hidden="true"><rect x="0" y="0" width="4" height="12" rx="1" fill="currentColor" opacity=".85"/><rect x="5.5" y="0" width="4" height="8" rx="1" fill="currentColor" opacity=".6"/><rect x="11" y="0" width="4" height="10" rx="1" fill="currentColor" opacity=".75"/></svg>`,
  markdown: `<svg width="15" height="12" aria-hidden="true"><rect x="0" y="0" width="15" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M3 9 V4 l2.3 3 L7.6 4 v5" stroke="currentColor" fill="none" stroke-width="1.2"/><path d="M10.6 4 v4 M9.2 6.6 L10.6 8.4 L12 6.6" stroke="currentColor" fill="none" stroke-width="1.2"/></svg>`,
};

// Duas sub-abas: "Leituras" (as 6 de sempre, que só leem) e "Mapa em níveis"
// (o _niveis.json da rotina Pipeline). O markup do mapa vem de
// `mapas-pipeline-niveis-template.js`, dentro de #vp-sub-niveis. O painel
// #mapa-pipeline nasce em `mapas-template.js`, que carrega antes deste.
document.getElementById('mapa-pipeline').innerHTML = `
  <div class="agentes-subtabs-bar" id="vp-subabas" data-taborder-group="pipeline_subtabs"
       data-taborder-label="Sub-abas do Pipeline" data-taborder-parent="mapa-pipeline">
    <button class="agentes-subtab-btn active" data-vpsub="vp-sub-leituras">Leituras</button>
    <button class="agentes-subtab-btn" data-vpsub="vp-sub-niveis">Mapa em níveis</button>
  </div>

  <div class="agentes-subtab-content active" id="vp-sub-leituras">
  <div class="vp-layout">

    <!-- O cabeçalho traz um número que o pipeline.md não tem: LIGAÇÕES. 199
         passos podem ser 118 pares distintos ou 199, e é isso que diz o
         tamanho real do fluxo. Do que o backend manda, aproveita-se a data. -->
    <div class="vp-cabecalho">
      <div class="vp-cabecalho-texto">
        <div class="vp-titulo" id="vp-titulo"></div>
        <div class="vp-titulo-sub" id="vp-titulo-sub"></div>
      </div>
      <div class="vp-metricas" id="vp-metricas"></div>
    </div>

    <!-- Barra só de leitura: ↻ Recarregar relê o pipeline.md do disco e não
         gasta nada. O ⟳ Gerar, que rodava o agente aqui, saiu — quem roda o
         agente Pipeline é o card dele em Automação > Rotinas. -->
    <div class="vp-barra">
      <div class="mapa-toggle vp-leituras" id="vp-leitura-toggle">
        <button class="mapa-toggle-btn active" data-leitura="raias"     title="Uma faixa por camada; o fluxo anda para a direita e a curva laranja é travessia">${VP_PICTOGRAMAS.raias}Raias por camada</button>
        <button class="mapa-toggle-btn"        data-leitura="trilho"    title="Lista vertical, agrupada por fase">${VP_PICTOGRAMAS.trilho}Trilho numerado</button>
        <button class="mapa-toggle-btn"        data-leitura="sequencia" title="Arquivos viram colunas e o tempo desce">${VP_PICTOGRAMAS.sequencia}Sequência</button>
        <button class="mapa-toggle-btn"        data-leitura="cadeias"   title="Um trilho de estações por cadeia">${VP_PICTOGRAMAS.cadeias}Cadeias</button>
        <button class="mapa-toggle-btn"        data-leitura="fases"     title="Colunas tipo quadro; a cor diz de qual cadeia é">${VP_PICTOGRAMAS.fases}Fases</button>
        <button class="mapa-toggle-btn"        data-leitura="markdown"  title="O pipeline.md como está no disco">${VP_PICTOGRAMAS.markdown}Markdown</button>
      </div>

      <span class="vp-barra-sep"></span>

      <!-- Ligado, o par origem→destino repetido vira UMA linha com ×N. É o que
           tira da tela as quatro linhas seguidas que só mudam o nome da
           função. Desligado, volta a ser um passo por linha. -->
      <label class="toggle-pill" id="vp-agrupar"
             title="Junta numa ligação só os passos que repetem o mesmo par origem→destino">
        <div class="toggle-track on"><div class="toggle-knob"></div></div>
        <span class="toggle-label on">Agrupar repetidos</span>
      </label>

      <label class="vp-busca">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7.8 7.8 L11 11" stroke="currentColor" stroke-width="1.4"/></svg>
        <input id="vp-busca" placeholder="Filtrar arquivo…" />
      </label>

      <!-- Zoom só nas leituras que ficam grandes de verdade. Nas outras não há
           o que ampliar, e um controle morto na tela só ocupa espaço. -->
      <div class="vp-zoom" id="vp-zoom">
        <button class="btn btn-muted btn-sm" id="btn-vp-zoom-menos" title="Diminuir">−</button>
        <span class="vp-zoom-val" id="vp-zoom-val">100%</span>
        <button class="btn btn-muted btn-sm" id="btn-vp-zoom-mais" title="Aumentar">+</button>
      </div>

      <span class="vp-barra-espaco"></span>

      <button class="btn btn-muted btn-sm"   id="btn-vp-recarregar" title="Relê o pipeline.md do disco — não chama o modelo">↻ Recarregar</button>
      <!-- O que o agente escondeu fica atrás de um botão: é informação que se
           consulta uma vez, não que precisa ficar ocupando altura o tempo todo. -->
      <button class="btn btn-muted btn-sm"   id="btn-vp-avisos" style="display:none"></button>
      <button class="btn btn-utility btn-sm" id="btn-vp-ajuda" title="O que cada leitura mostra e o que cada peça do desenho quer dizer">? Como ler</button>
    </div>

    <!-- Texto de tamanho variável não fica ENTRE controles: fica embaixo, com
         a altura já reservada, senão os botões dançam a cada mensagem. -->
    <p id="vp-status" class="vp-status"></p>

    <div class="vp-avisos hidden" id="vp-avisos"></div>

    <div class="vp-palco" id="vp-palco">
      <aside class="vp-trilha" id="vp-trilha"></aside>
      <div class="vp-viewport" id="vp-viewport">
        <div id="vp-area"></div>
      </div>
    </div>

    <div class="vp-md hidden" id="vp-md">
      <div class="vp-md-barra">
        <span class="vp-md-caminho" id="vp-md-caminho"></span>
        <span class="vp-md-tamanho" id="vp-md-tamanho"></span>
        <button class="btn btn-muted btn-sm" id="btn-vp-copiar">⎘ Copiar</button>
      </div>
      <div class="vp-md-corpo">
        <div class="vp-md-gutter" id="vp-md-gutter"></div>
        <div class="vp-md-texto" id="vp-md-texto"></div>
      </div>
    </div>

  </div>
  </div>

  <div class="agentes-subtab-content" id="vp-sub-niveis"></div>
`;

// O modal vai no <body>, como os demais do projeto: `.modal-overlay` é
// `position: fixed`, e deixá-lo dentro da sub-aba o faria sumir junto com ela.
document.body.insertAdjacentHTML('beforeend', `
  <div id="modal-vp-ajuda" class="modal-overlay hidden">
    <div class="modal modal-prompt vp-ajuda">
      <div class="modal-prompt-header">
        <h3>Como ler cada leitura</h3>
        <button class="btn btn-muted btn-sm" id="btn-vp-ajuda-fechar">Fechar</button>
      </div>
      <div class="vp-ajuda-corpo" id="vp-ajuda-corpo"></div>
    </div>
  </div>
`);
