// ══════════════════════════════════════════════════ TEMPLATE: Card "Detector"
// Markup estático da rotina Detector (sub-aba Rotinas). Inserido em
// #agente-grupo-ind — rotinas.js (`_agruparCards`) o realoca para o grupo
// correto (ind/dep) lendo o atributo data-grupo do próprio card.
//
// ⚠️ Ele é o GATILHO do ciclo, não uma etapa dele — por isso o rodapé do
// título diz "o gatilho do ciclo" onde os outros dizem "independente".
document.getElementById('agente-grupo-ind').insertAdjacentHTML('beforeend', `
  <div class="agente-card" data-agente="detector" data-tipo="det" data-destino="interno" data-grupo="base" id="agente-detector">
    <button class="agente-card-header agente-card-toggle" id="detector-toggle">
      <div class="agente-title-row">
        <span class="agente-icon">🛰️</span>
        <span class="agente-name">Detector</span>
        <span class="agente-selos"><span class="agente-selo" title="determinístico — não usa LLM">⚡</span><span class="agente-selo" title="encanamento — consumido pelo próprio programa">⚙️</span></span>
        <span class="agente-badge agente-badge-idle" id="detector-badge">Pronto</span>
        <span class="agente-summary" id="detector-summary"></span>
        <span class="agente-dep-chain">| o gatilho do ciclo</span>
      </div>
      <p class="agente-desc">${explicacaoDoCard('detector')}</p>
      <span class="agente-chevron" id="detector-chevron">▸</span>
    </button>
    <div class="agente-card-body hidden" id="detector-body">
      <div class="agente-tabs">
        <button class="agente-tab active" id="detector-tab-processar" data-tab="processar">Processar</button>
        <button class="agente-tab" id="detector-tab-visualizar" data-tab="visualizar">Visualizar</button>
      </div>
      <div class="agente-tab-content" id="detector-pane-processar">
        <div class="agente-actions">
          <button class="btn btn-positive btn-sm" id="btn-run-detector" data-trava-ia="rotinas" data-trava-ia-qualquer-dono>▶ Executar</button>
          <span class="agente-progress-label" id="detector-ultima"></span>
        </div>
        <div id="detector-progress-area" class="agente-progress-area hidden">
          <span id="detector-progress-label" class="agente-progress-label">Vendo o que mudou...</span>
        </div>
        <div id="detector-result-area" class="agente-result-area hidden">
          <div class="agente-result-summary" id="detector-result-summary"></div>
          <!-- A tabela da classificação da última passada: quantos arquivos
               caíram em cada classe e o que cada uma acordou. É onde se
               confere se ele está decidindo certo. -->
          <div id="detector-classes"></div>
        </div>
      </div>
      <div class="agente-tab-content hidden" id="detector-pane-visualizar">
        <div class="agente-viewer-list" id="detector-viewer-list">
          <p class="agente-viewer-empty">Nenhum arquivo gerado ainda.</p>
        </div>
        <div class="agente-viewer-content hidden" id="detector-viewer-content">
          <div class="agente-viewer-content-header">
            <span id="detector-viewer-filename"></span>
            <button class="agente-viewer-close" id="detector-viewer-close">✕</button>
          </div>
          <pre class="agente-viewer-pre" id="detector-viewer-pre"></pre>
        </div>
      </div>
    </div>
  </div>
`);
