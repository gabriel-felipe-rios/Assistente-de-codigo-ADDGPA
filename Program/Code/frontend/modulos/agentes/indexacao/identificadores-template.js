// ══════════════════════════════════════════════ TEMPLATE: Card "Índice de Identificadores"
// Markup estático do card do agente Índice de Identificadores (sub-aba
// Rotinas). Inserido em #agente-grupo-ind — rotinas.js (`_agruparCards`) o
// realoca para o grupo correto (ind/dep) lendo o atributo data-grupo do
// próprio card.
document.getElementById('agente-grupo-ind').insertAdjacentHTML('beforeend', `
  <div class="agente-card" data-agente="identificadores" data-tipo="det" data-destino="humano externo" data-grupo="ind" id="agente-identificadores">
    <button class="agente-card-header agente-card-toggle" id="identificadores-toggle">
      <div class="agente-title-row">
        <span class="agente-icon">🔤</span>
        <span class="agente-name">Índice de Identificadores</span>
        <span class="agente-selos"><span class="agente-selo" title="determinístico — não usa LLM">⚡</span><span class="agente-selo" title="para você ler">👤</span><span class="agente-selo" title="insumo para o assistente externo — Claude Code, Cursor, Antigravity…">🤖</span></span>
        <span class="agente-badge agente-badge-idle" id="identificadores-badge">Pronto</span>
        <span class="agente-summary" id="identificadores-summary"></span>
        <span class="agente-dep-chain">| independente</span>
      </div>
      <p class="agente-desc">${explicacaoDoCard('identificadores')}</p>
      <span class="agente-chevron" id="identificadores-chevron">▸</span>
    </button>
    <div class="agente-card-body hidden" id="identificadores-body">
      <div class="agente-tabs">
        <button class="agente-tab active" id="identificadores-tab-processar" data-tab="processar">Processar</button>
      </div>
      <div class="agente-tab-content" id="identificadores-pane-processar">
        <div class="agente-actions">
          <button class="btn btn-positive btn-sm" id="btn-run-identificadores" data-trava-ia="rotinas" data-trava-ia-qualquer-dono>▶ Executar</button>
        </div>
        <div id="identificadores-progress-area" class="agente-progress-area hidden">
          <span id="identificadores-progress-label" class="agente-progress-label">Indexando identificadores...</span>
        </div>
        <div id="identificadores-result-area" class="agente-result-area hidden">
          <div class="agente-result-summary" id="identificadores-result-summary"></div>
        </div>
      </div>
    </div>
  </div>
`);
