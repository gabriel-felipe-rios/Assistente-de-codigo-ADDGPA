// ══════════════════════════════════════════════════ TEMPLATE: Card "Duplicados"
// Markup estático do card da rotina Duplicados (sub-aba Rotinas).
// Inserido em #agente-grupo-ind — rotinas.js (`_agruparCards`) o realoca para
// o grupo correto (ind/dep) lendo o atributo data-grupo do próprio card.
//
// ⚠️ `data-destino` é uma LISTA separada por espaço, e aqui ela tem DOIS
// valores de propósito: o Duplicados serve o 👤 humano (a aba Análise) E o
// 🤖 assistente externo (a ferramenta `duplicados` do MCP). Deixar só um dos
// dois o faria sumir da tela quando o usuário filtrasse pelo outro.
//
// ⚠️ Ele NÃO usa LLM. Até 22/08/2026 vetorizava o corpo de cada função com o
// modelo de embedding e levava minutos; hoje é comparação determinística
// (hash + impressões digitais) e leva segundos. O selo ⚡ diz isso.
document.getElementById('agente-grupo-ind').insertAdjacentHTML('beforeend', `
  <div class="agente-card" data-agente="duplicados" data-tipo="det" data-destino="humano externo" data-grupo="ind" id="agente-duplicados">
    <button class="agente-card-header agente-card-toggle" id="duplicados-toggle">
      <div class="agente-title-row">
        <span class="agente-icon">👯</span>
        <span class="agente-name">Duplicados</span>
        <span class="agente-selos"><span class="agente-selo" title="determinístico — não usa LLM">⚡</span><span class="agente-selo" title="para você ler">👤</span><span class="agente-selo" title="insumo para o assistente de código que você usa por fora">🤖</span></span>
        <span class="agente-badge agente-badge-idle" id="duplicados-badge">Pronto</span>
        <span class="agente-summary" id="duplicados-summary"></span>
        <span class="agente-dep-chain">| independente</span>
      </div>
      <p class="agente-desc">${explicacaoDoCard('duplicados')}</p>
      <span class="agente-chevron" id="duplicados-chevron">▸</span>
    </button>
    <div class="agente-card-body hidden" id="duplicados-body">
      <div class="agente-actions">
        <button class="btn btn-positive btn-sm" id="btn-run-duplicados-rotina" data-trava-ia="rotinas" data-trava-ia-qualquer-dono>▶ Procurar duplicados</button>
      </div>
      <div id="duplicados-progress-area" class="agente-progress-area hidden">
        <span id="duplicados-progress-label" class="agente-progress-label">Comparando as funções...</span>
      </div>
      <div id="duplicados-result-area" class="agente-result-area hidden">
        <div class="agente-result-summary" id="duplicados-result-summary"></div>
      </div>
    </div>
  </div>
`);
