// ══════════════════════════════════════════════ TEMPLATE: Card "Embedding Semântico"
// Markup estático do card do agente Embedding Semântico (sub-aba Rotinas).
// Inserido em #agente-grupo-ind — rotinas.js (`_agruparCards`) o realoca para
// o grupo correto (ind/dep) lendo o atributo data-grupo do próprio card.
document.getElementById('agente-grupo-ind').insertAdjacentHTML('beforeend', `
  <div class="agente-card" data-agente="embedding" data-tipo="det" data-destino="interno" data-grupo="dep" id="agente-embedding">
    <button class="agente-card-header agente-card-toggle" id="embedding-toggle">
      <div class="agente-title-row">
        <span class="agente-icon">🔍</span>
        <span class="agente-name">Embedding Semântico</span>
        <span class="agente-selos"><span class="agente-selo" title="determinístico — modelo ONNX local, não usa o LM Studio">⚡</span><span class="agente-selo" title="encanamento — alimenta a busca semântica da aba Documentação">⚙️</span></span>
        <span class="agente-badge agente-badge-idle" id="embedding-badge">Pronto</span>
        <span class="agente-summary" id="embedding-summary"></span>
        <span class="agente-dep-chain">| Doc Técnica · Resumo →</span>
      </div>
      <p class="agente-desc">${explicacaoDoCard('embedding')}</p>
      <span class="agente-chevron" id="embedding-chevron">▸</span>
    </button>
    <div class="agente-card-body hidden" id="embedding-body">
      <div class="agente-preview">
        <span id="embedding-preview-label" class="agente-preview-count"></span>
      </div>
      <div class="agente-actions">
        <button class="btn btn-positive btn-sm" id="btn-run-embedding" data-trava-ia="rotinas" data-trava-ia-qualquer-dono>▶ Processar</button>
      </div>
      <!-- Mesmo bloco de progresso da Documentacao Tecnica, com o prefixo
           trocado. O CSS de agentes-base.css e todo por classe, e
           _pintarProgressoDuplo (rotinas-comum.js) e agnostica ao prefixo — nada disto precisou nascer.
           AVISO: sem crase aqui dentro. Este arquivo inteiro e um template
           literal, e uma crase perdida num comentario fecha a string. -->
      <div id="embedding-progress-area" class="agente-progress-area hidden">
        <div class="agente-progress-header">
          <span id="embedding-progress-label" class="agente-progress-label">Iniciando...</span>
          <span id="embedding-progress-count" class="agente-progress-count"></span>
        </div>
        <div class="agente-progress-bar-track">
          <div class="agente-progress-bar-fill" id="embedding-progress-bar" style="width:0%"></div>
        </div>
        <div class="agente-progress-reaproveitado hidden" id="embedding-reaproveitado-row">
          <span class="agente-progress-rot">Reaproveitado</span>
          <div class="agente-progress-bar-track">
            <div class="agente-progress-bar-fill agente-progress-bar-cache" id="embedding-reaproveitado-bar" style="width:0%"></div>
          </div>
          <span class="agente-progress-count" id="embedding-reaproveitado-count"></span>
        </div>
        <div id="embedding-current-file" class="agente-current-file"></div>
      </div>
      <div id="embedding-result-area" class="agente-result-area hidden">
        <div class="agente-result-summary" id="embedding-result-summary"></div>
      </div>
    </div>
  </div>
`);
