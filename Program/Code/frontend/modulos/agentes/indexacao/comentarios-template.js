// ══════════════════════════════════════════════════ TEMPLATE: Card "Comentários"
// Markup estático do card da rotina Comentários (sub-aba Rotinas).
// Inserido em #agente-grupo-ind — rotinas.js (`_agruparCards`) o realoca para
// o grupo correto (ind/dep) lendo o atributo data-grupo do próprio card.
//
// ⚠️ O rótulo "Comentários" cobre também as docstrings do Python, e isso é
// deliberado: docstring não é comentário, mas o nome preciso não se entende
// sem explicação. Não "conserte" o escopo tirando as docstrings.
document.getElementById('agente-grupo-ind').insertAdjacentHTML('beforeend', `
  <div class="agente-card" data-agente="comentarios" data-tipo="det" data-destino="humano" data-grupo="ind" id="agente-comentarios">
    <button class="agente-card-header agente-card-toggle" id="comentarios-toggle">
      <div class="agente-title-row">
        <span class="agente-icon">💬</span>
        <span class="agente-name">Comentários</span>
        <span class="agente-selos"><span class="agente-selo" title="determinístico — não usa LLM">⚡</span><span class="agente-selo" title="para você ler">👤</span></span>
        <span class="agente-badge agente-badge-idle" id="comentarios-badge">Pronto</span>
        <span class="agente-summary" id="comentarios-summary"></span>
        <span class="agente-dep-chain">| independente</span>
      </div>
      <p class="agente-desc">${explicacaoDoCard('comentarios')}</p>
      <span class="agente-chevron" id="comentarios-chevron">▸</span>
    </button>
    <div class="agente-card-body hidden" id="comentarios-body">
      <div class="agente-actions">
        <button class="btn btn-positive btn-sm" id="btn-run-comentarios" data-trava-ia="rotinas" data-trava-ia-qualquer-dono>▶ Extrair Comentários</button>
      </div>
      <div id="comentarios-progress-area" class="agente-progress-area hidden">
        <span id="comentarios-progress-label" class="agente-progress-label">Lendo os comentários...</span>
      </div>
      <div id="comentarios-result-area" class="agente-result-area hidden">
        <div class="agente-result-summary" id="comentarios-result-summary"></div>
      </div>
    </div>
  </div>
`);
