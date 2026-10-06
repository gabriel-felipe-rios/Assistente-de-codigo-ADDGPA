// ══════════════════════════════════════════════ TEMPLATE: Card "Sincronia"
// Markup estático do card do agente Sincronia (sub-aba Rotinas). Inserido em
// #agente-grupo-ind — rotinas.js (`_agruparCards`) o realoca para o grupo
// correto (ind/dep) lendo o atributo data-grupo do próprio card.
//
// ⛔ A descrição NÃO pode dizer só "limpa órfãos": apagar é a MENOS frequente
// das três operações. O caso comum é mover uma pasta de lugar.
document.getElementById('agente-grupo-ind').insertAdjacentHTML('beforeend', `
  <div class="agente-card" data-agente="sincronia" data-tipo="det" data-destino="interno" data-grupo="base" id="agente-sincronia">
    <button class="agente-card-header agente-card-toggle" id="sincronia-toggle">
      <div class="agente-title-row">
        <span class="agente-icon">↔️</span>
        <span class="agente-name">Sincronia</span>
        <span class="agente-selos"><span class="agente-selo" title="determinístico — não usa LLM">⚡</span><span class="agente-selo" title="encanamento — consumido pelo próprio programa">⚙️</span></span>
        <span class="agente-badge agente-badge-idle" id="sincronia-badge">Pronto</span>
        <span class="agente-summary" id="sincronia-summary"></span>
        <span class="agente-dep-chain">| independente</span>
      </div>
      <p class="agente-desc">${explicacaoDoCard('sincronia')}</p>
      <span class="agente-chevron" id="sincronia-chevron">▸</span>
    </button>
    <div class="agente-card-body hidden" id="sincronia-body">
      <div class="agente-tabs">
        <button class="agente-tab active" id="sincronia-tab-processar" data-tab="processar">Processar</button>
        <button class="agente-tab" id="sincronia-tab-pendentes" data-tab="pendentes">Divergências</button>
      </div>
      <div class="agente-tab-content" id="sincronia-pane-processar">
        <div class="agente-actions">
          <button class="btn btn-positive btn-sm" id="btn-run-sincronia" data-trava-ia="rotinas" data-trava-ia-qualquer-dono>▶ Executar</button>
        </div>
        <div id="sincronia-progress-area" class="agente-progress-area hidden">
          <span id="sincronia-progress-label" class="agente-progress-label">Sincronizando saídas...</span>
        </div>
        <div id="sincronia-result-area" class="agente-result-area hidden">
          <div class="agente-result-summary" id="sincronia-result-summary"></div>
        </div>
      </div>
      <!-- Divergências: o que o Sincronia FARIA agora, sem fazer. -->
      <div class="agente-tab-content hidden" id="sincronia-pane-pendentes">
        <div id="sincronia-pendentes-list" class="agente-issue-list"></div>
      </div>
    </div>
  </div>
`);
