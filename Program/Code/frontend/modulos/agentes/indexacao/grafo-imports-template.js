// ══════════════════════════════════════════════ TEMPLATE: Card "Grafo de Imports"
// Markup estático do card do agente Grafo de Imports (sub-aba Rotinas).
// Inserido em #agente-grupo-ind — rotinas.js (`_agruparCards`) o realoca para
// o grupo correto (ind/dep) lendo o atributo data-grupo do próprio card.
document.getElementById('agente-grupo-ind').insertAdjacentHTML('beforeend', `
  <div class="agente-card" data-agente="grafo-imports" data-tipo="det" data-destino="interno" data-grupo="ind" id="agente-grafo-imports">
    <button class="agente-card-header agente-card-toggle" id="grafo-imports-toggle">
      <div class="agente-title-row">
        <span class="agente-icon">🔗</span>
        <span class="agente-name">Grafo de Imports</span>
        <span class="agente-selos"><span class="agente-selo" title="determinístico — não usa LLM">⚡</span><span class="agente-selo" title="encanamento — consumido pelo próprio programa">⚙️</span></span>
        <span class="agente-badge agente-badge-idle" id="grafo-imports-badge">Pronto</span>
        <span class="agente-summary" id="grafo-imports-summary"></span>
        <span class="agente-dep-chain">| independente</span>
      </div>
      <p class="agente-desc">${explicacaoDoCard('grafo-imports')}</p>
      <span class="agente-chevron" id="grafo-imports-chevron">▸</span>
    </button>
    <div class="agente-card-body hidden" id="grafo-imports-body">
      <div class="agente-actions">
        <button class="btn btn-positive btn-sm" id="btn-run-grafo-imports" data-trava-ia="rotinas" data-trava-ia-qualquer-dono>▶ Gerar Grafo</button>
      </div>
      <div id="grafo-imports-progress-area" class="agente-progress-area hidden">
        <span id="grafo-imports-progress-label" class="agente-progress-label">Analisando imports...</span>
      </div>
      <div id="grafo-imports-result-area" class="agente-result-area hidden">
        <div class="agente-result-summary" id="grafo-imports-result-summary"></div>
      </div>
    </div>
  </div>
`);
