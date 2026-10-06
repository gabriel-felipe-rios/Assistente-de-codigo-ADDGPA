// ══════════════════════════════════════════════════ TEMPLATE: Card "Bibliotecas"
// Markup estático do card da rotina Bibliotecas (sub-aba Rotinas).
// Inserido em #agente-grupo-ind — rotinas.js (`_agruparCards`) o realoca para
// o grupo correto (ind/dep) lendo o atributo data-grupo do próprio card.
//
// ⚠️ Este card não existia. A Bibliotecas é rotina oficial do backend desde
// sempre, tem linha em Acionamentos e posição em Visualizar, mas nunca apareceu
// aqui — o único jeito de dispará-la pela tela era abrir a sub-aba Documentação
// › Bibliotecas e deixar a auto-geração agir. Foi conserto, não recurso novo.
document.getElementById('agente-grupo-ind').insertAdjacentHTML('beforeend', `
  <div class="agente-card" data-agente="bibliotecas" data-tipo="det" data-destino="humano" data-grupo="ind" id="agente-bibliotecas">
    <button class="agente-card-header agente-card-toggle" id="bibliotecas-toggle">
      <div class="agente-title-row">
        <span class="agente-icon">📚</span>
        <span class="agente-name">Bibliotecas</span>
        <span class="agente-selos"><span class="agente-selo" title="determinístico — não usa LLM">⚡</span><span class="agente-selo" title="para você ler">👤</span></span>
        <span class="agente-badge agente-badge-idle" id="bibliotecas-badge">Pronto</span>
        <span class="agente-summary" id="bibliotecas-summary"></span>
        <span class="agente-dep-chain">| independente</span>
      </div>
      <p class="agente-desc">${explicacaoDoCard('bibliotecas')}</p>
      <span class="agente-chevron" id="bibliotecas-chevron">▸</span>
    </button>
    <div class="agente-card-body hidden" id="bibliotecas-body">
      <div class="agente-actions">
        <button class="btn btn-positive btn-sm" id="btn-run-bibliotecas" data-trava-ia="rotinas" data-trava-ia-qualquer-dono>▶ Gerar Lista</button>
      </div>
      <div id="bibliotecas-progress-area" class="agente-progress-area hidden">
        <span id="bibliotecas-progress-label" class="agente-progress-label">Lendo os imports...</span>
      </div>
      <div id="bibliotecas-result-area" class="agente-result-area hidden">
        <div class="agente-result-summary" id="bibliotecas-result-summary"></div>
      </div>
    </div>
  </div>
`);
