// ══════════════════════════════════════════════ TEMPLATE: Card "Glossário"
// Markup estático do card do agente Glossário (sub-aba Rotinas). Inserido em
// #agente-grupo-ind — rotinas.js (`_agruparCards`) o realoca para o grupo
// correto (ind/dep) lendo o atributo data-grupo do próprio card.
document.getElementById('agente-grupo-ind').insertAdjacentHTML('beforeend', `
  <div class="agente-card" data-agente="glossario" data-tipo="llm" data-destino="lmstudio externo" data-grupo="dep" id="agente-glossario">
    <button class="agente-card-header agente-card-toggle" id="glossario-toggle">
      <div class="agente-title-row">
        <span class="agente-icon">📖</span>
        <span class="agente-name">Glossário</span>
        <span class="agente-selos"><span class="agente-selo" title="escrito por LLM">🧠</span><span class="agente-selo" title="insumo para o LM Studio">🖥️</span><span class="agente-selo" title="insumo para o assistente externo — Claude Code, Cursor, Antigravity…">🤖</span></span>
        <span class="agente-badge agente-badge-idle" id="glossario-badge">Pronto</span>
        <span class="agente-summary" id="glossario-summary"></span>
        <span class="agente-dep-chain">| Doc Técnica →</span>
      </div>
      <p class="agente-desc">${explicacaoDoCard('glossario')}</p>
      <span class="agente-chevron" id="glossario-chevron">▸</span>
    </button>
    <div class="agente-card-body hidden" id="glossario-body">
      <div class="agente-tabs">
        <button class="agente-tab active" id="glossario-tab-processar" data-tab="processar">Processar</button>
        <button class="agente-tab" id="glossario-tab-visualizar" data-tab="visualizar">Visualizar</button>
      </div>
      <div class="agente-tab-content" id="glossario-pane-processar">
        <div class="agente-actions">
          <button class="btn btn-positive btn-sm" id="btn-run-glossario" data-trava-ia="rotinas" data-trava-ia-qualquer-dono>▶ Executar</button>
          <button class="btn btn-muted btn-sm" id="btn-prompt-glossario">Ver prompt</button>
        </div>
        <div id="glossario-progress-area" class="agente-progress-area hidden">
          <div class="agente-progress-header">
            <span id="glossario-progress-label" class="agente-progress-label">Descobrindo termos...</span>
            <span id="glossario-progress-count" class="agente-progress-count"></span>
          </div>
          <div class="agente-progress-bar-track">
            <div class="agente-progress-bar-fill" id="glossario-progress-bar" style="width:0%"></div>
          </div>
          <div id="glossario-current-term" class="agente-current-file"></div>
        </div>
        <div id="glossario-result-area" class="agente-result-area hidden">
          <div class="agente-result-summary" id="glossario-result-summary"></div>
        </div>
      </div>
      <div class="agente-tab-content hidden" id="glossario-pane-visualizar">
        <div class="agente-viewer-list" id="glossario-viewer-list">
          <p class="agente-viewer-empty">Nenhum arquivo gerado ainda.</p>
        </div>
        <div class="agente-viewer-content hidden" id="glossario-viewer-content">
          <div class="agente-viewer-content-header">
            <span id="glossario-viewer-filename"></span>
            <button class="agente-viewer-close" id="glossario-viewer-close">✕</button>
          </div>
          <pre class="agente-viewer-pre" id="glossario-viewer-pre"></pre>
        </div>
      </div>
    </div>
  </div>
`);
