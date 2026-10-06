// ══════════════════════════════════════════════ TEMPLATE: Card "Pipeline"
// Markup estático do card do agente Pipeline (sub-aba Rotinas). Inserido em
// #agente-grupo-ind — rotinas.js (`_agruparCards`) o realoca para o grupo
// correto (ind/dep) lendo o atributo data-grupo do próprio card.
document.getElementById('agente-grupo-ind').insertAdjacentHTML('beforeend', `
  <div class="agente-card" data-agente="pipeline" data-tipo="det llm" data-destino="humano lmstudio" data-grupo="dep" id="agente-pipeline">
    <button class="agente-card-header agente-card-toggle" id="pipeline-toggle">
      <div class="agente-title-row">
        <span class="agente-icon">🔀</span>
        <span class="agente-name">Pipeline</span>
        <span class="agente-selos"><span class="agente-selo" title="determinístico — não usa LLM">⚡</span><span class="agente-selo" title="escrito por LLM">🧠</span><span class="agente-selo" title="para você ler">👤</span><span class="agente-selo" title="insumo para o LM Studio">🖥️</span></span>
        <span class="agente-badge agente-badge-idle" id="pipeline-badge">Pronto</span>
        <span class="agente-summary" id="pipeline-summary"></span>
        <span class="agente-dep-chain">| Grafo →</span>
      </div>
      <p class="agente-desc">${explicacaoDoCard('pipeline')}</p>
      <span class="agente-chevron" id="pipeline-chevron">▸</span>
    </button>
    <div class="agente-card-body hidden" id="pipeline-body">
      <div class="agente-tabs">
        <button class="agente-tab active" id="pipeline-tab-processar" data-tab="processar">Processar</button>
        <button class="agente-tab" id="pipeline-tab-visualizar" data-tab="visualizar">Visualizar</button>
      </div>
      <div class="agente-tab-content" id="pipeline-pane-processar">
        <div class="agente-actions">
          <button class="btn btn-positive btn-sm" id="btn-run-pipeline" data-trava-ia="rotinas" data-trava-ia-qualquer-dono>▶ Executar</button>
          <button class="btn btn-muted btn-sm" id="btn-prompt-pipeline">Ver prompt</button>
        </div>
        <div id="pipeline-progress-area" class="agente-progress-area hidden">
          <span id="pipeline-progress-label" class="agente-progress-label">Gerando pipeline...</span>
        </div>
        <div id="pipeline-result-area" class="agente-result-area hidden">
          <div class="agente-result-summary" id="pipeline-result-summary"></div>
        </div>
      </div>
      <div class="agente-tab-content hidden" id="pipeline-pane-visualizar">
        <div class="agente-viewer-list" id="pipeline-viewer-list">
          <p class="agente-viewer-empty">Nenhum arquivo gerado ainda.</p>
        </div>
        <div class="agente-viewer-content hidden" id="pipeline-viewer-content">
          <div class="agente-viewer-content-header">
            <span id="pipeline-viewer-filename"></span>
            <button class="agente-viewer-close" id="pipeline-viewer-close">✕</button>
          </div>
          <pre class="agente-viewer-pre" id="pipeline-viewer-pre"></pre>
        </div>
      </div>
    </div>
  </div>
`);
