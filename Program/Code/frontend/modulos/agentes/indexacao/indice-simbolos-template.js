// ═══════════════════════════════════════════ TEMPLATE: Card "Índice de Símbolos"
// Markup estático do card da rotina Índice de Símbolos (sub-aba Rotinas).
// Inserido em #agente-grupo-ind — rotinas.js (`_agruparCards`) o realoca para
// o grupo correto (ind/dep) lendo o atributo data-grupo do próprio card.
document.getElementById('agente-grupo-ind').insertAdjacentHTML('beforeend', `
  <div class="agente-card" data-agente="indice-simbolos" data-tipo="det" data-grupo="ind" id="agente-indice-simbolos">
    <button class="agente-card-header agente-card-toggle" id="indice-simbolos-toggle">
      <div class="agente-title-row">
        <span class="agente-icon">🏷️</span>
        <span class="agente-name">Índice de Símbolos</span>
        <span class="agente-selos"><span class="agente-selo" title="determinístico — não usa LLM">⚡</span></span>
        <span class="agente-badge agente-badge-idle" id="indice-simbolos-badge">Pronto</span>
        <span class="agente-summary" id="indice-simbolos-summary"></span>
        <span class="agente-dep-chain">| independente</span>
      </div>
      <p class="agente-desc">${explicacaoDoCard('indice-simbolos')}</p>
      <span class="agente-chevron" id="indice-simbolos-chevron">▸</span>
    </button>
    <div class="agente-card-body hidden" id="indice-simbolos-body">
      <div class="agente-actions">
        <button class="btn btn-positive btn-sm" id="btn-run-indice-simbolos" data-trava-ia="rotinas" data-trava-ia-qualquer-dono>▶ Atualizar índice</button>
      </div>
      <div id="indice-simbolos-progress-area" class="agente-progress-area hidden">
        <span id="indice-simbolos-progress-label" class="agente-progress-label">Lendo os símbolos...</span>
      </div>
      <div id="indice-simbolos-result-area" class="agente-result-area hidden">
        <div class="agente-result-summary" id="indice-simbolos-result-summary"></div>
      </div>
    </div>
  </div>
`);
