// ══════════════════════════════════════════════ TEMPLATE: Card "Índice de Navegação"
// Markup estático do card do agente Índice de Navegação (sub-aba Rotinas).
// Inserido em #agente-grupo-ind — rotinas.js (`_agruparCards`) o realoca para
// o grupo correto (ind/dep) lendo o atributo data-grupo do próprio card.
document.getElementById('agente-grupo-ind').insertAdjacentHTML('beforeend', `
  <div class="agente-card" data-agente="indice-navegacao" data-tipo="det" data-destino="humano lmstudio externo" data-grupo="dep" id="agente-indice-navegacao">
    <button class="agente-card-header agente-card-toggle" id="indice-navegacao-toggle">
      <div class="agente-title-row">
        <span class="agente-icon">🗺️</span>
        <span class="agente-name">Índice de Navegação</span>
        <span class="agente-selos"><span class="agente-selo" title="determinístico — não usa LLM">⚡</span><span class="agente-selo" title="para você ler">👤</span><span class="agente-selo" title="insumo para o LM Studio">🖥️</span><span class="agente-selo" title="insumo para o assistente externo — Claude Code, Cursor, Antigravity…">🤖</span></span>
        <span class="agente-badge agente-badge-idle" id="indice-navegacao-badge">Pronto</span>
        <span class="agente-summary" id="indice-navegacao-summary"></span>
        <span class="agente-dep-chain">| Doc Técnica →</span>
      </div>
      <p class="agente-desc">${explicacaoDoCard('indice-navegacao')}</p>
      <span class="agente-chevron" id="indice-navegacao-chevron">▸</span>
    </button>
    <div class="agente-card-body hidden" id="indice-navegacao-body">
      <div class="agente-tabs">
        <button class="agente-tab active" id="indice-navegacao-tab-processar" data-tab="processar">Processar</button>
        <button class="agente-tab" id="indice-navegacao-tab-visualizar" data-tab="visualizar">Visualizar</button>
      </div>
      <div class="agente-tab-content" id="indice-navegacao-pane-processar">
        <div class="agente-actions">
          <button class="btn btn-positive btn-sm" id="btn-run-indice-navegacao" data-trava-ia="rotinas" data-trava-ia-qualquer-dono>▶ Executar</button>
        </div>
        <div id="indice-navegacao-progress-area" class="agente-progress-area hidden">
          <span id="indice-navegacao-progress-label" class="agente-progress-label">Montando índice...</span>
        </div>
        <div id="indice-navegacao-result-area" class="agente-result-area hidden">
          <div class="agente-result-summary" id="indice-navegacao-result-summary"></div>
        </div>
      </div>
      <div class="agente-tab-content hidden" id="indice-navegacao-pane-visualizar">
        <div class="agente-viewer-list" id="indice-navegacao-viewer-list">
          <p class="agente-viewer-empty">Nenhum arquivo gerado ainda.</p>
        </div>
        <div class="agente-viewer-content hidden" id="indice-navegacao-viewer-content">
          <div class="agente-viewer-content-header">
            <span id="indice-navegacao-viewer-filename"></span>
            <button class="agente-viewer-close" id="indice-navegacao-viewer-close">✕</button>
          </div>
          <pre class="agente-viewer-pre" id="indice-navegacao-viewer-pre"></pre>
        </div>
      </div>
    </div>
  </div>
`);
