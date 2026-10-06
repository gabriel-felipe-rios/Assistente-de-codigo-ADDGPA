// ══════════════════════════════════════════════ TEMPLATE: Card "Espera"
// Markup estático do card da Espera (sub-aba Rotinas). Inserido em
// #agente-grupo-ind — rotinas.js (`_agruparCards`) o realoca para o grupo
// correto (ind/dep) lendo o atributo data-grupo do próprio card.
//
// ⚠️ Ela NÃO é o gatilho, e o texto desta tela é o lugar onde isso fica claro:
// quem vê o que mudou é o Detector. A Espera só segura.
document.getElementById('agente-grupo-ind').insertAdjacentHTML('beforeend', `
  <div class="agente-card" data-agente="espera" data-tipo="det" data-destino="interno" data-grupo="freio" id="agente-espera">
    <button class="agente-card-header agente-card-toggle" id="espera-toggle">
      <div class="agente-title-row">
        <span class="agente-icon">⏱️</span>
        <span class="agente-name">Espera</span>
        <span class="agente-selos"><span class="agente-selo" title="determinístico — não usa LLM">⚡</span><span class="agente-selo" title="encanamento — consumido pelo próprio programa">⚙️</span></span>
        <span class="agente-badge agente-badge-idle" id="espera-badge">Desativada</span>
        <span class="agente-summary" id="espera-summary"></span>
        <span class="agente-dep-chain">| o freio</span>
      </div>
      <p class="agente-desc">${explicacaoDoCard('espera')}</p>
      <span class="agente-chevron" id="espera-chevron">▸</span>
    </button>
    <div class="agente-card-body hidden" id="espera-body">
      <div class="agente-tabs">
        <button class="agente-tab active" id="espera-tab-processar" data-tab="processar">Estado</button>
      </div>
      <div class="agente-tab-content" id="espera-pane-processar">
        <div class="agente-result-area" id="espera-result-area">
          <div class="agente-result-summary" id="espera-result-summary"></div>
        </div>
        <p class="agente-desc" style="margin-top:10px">
          Não roda sob demanda — não há botão "Executar". São três tempos de
          silêncio (T1, T2 e T3, do mais barato ao mais caro), configurados na
          tela de Projetos, aba Configurações → Contexto e limites. O
          interruptor fica na sub-aba Acionamentos, na seção "O freio".
        </p>
        <div class="agente-actions">
          <button class="btn btn-muted btn-sm" id="btn-espera-ir-acionamentos" type="button">Ver em Acionamentos →</button>
        </div>
      </div>
    </div>
  </div>
`);
