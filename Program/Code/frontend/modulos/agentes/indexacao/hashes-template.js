// ══════════════════════════════════════════════ TEMPLATE: Card "Hashes"
// Markup estático do card do agente Hashes (sub-aba Rotinas). Inserido em
// #agente-grupo-ind — rotinas.js (`_agruparCards`) o realoca para o grupo
// correto (ind/dep) lendo o atributo data-grupo do próprio card.
document.getElementById('agente-grupo-ind').insertAdjacentHTML('beforeend', `
  <div class="agente-card" data-agente="hashes" data-tipo="det" data-destino="interno" data-grupo="base" id="agente-hashes">
    <button class="agente-card-header agente-card-toggle" id="hashes-toggle">
      <div class="agente-title-row">
        <span class="agente-icon">#️⃣</span>
        <span class="agente-name">Hashes</span>
        <span class="agente-selos"><span class="agente-selo" title="determinístico — não usa LLM">⚡</span><span class="agente-selo" title="encanamento — consumido pelo próprio programa">⚙️</span></span>
        <span class="agente-badge agente-badge-idle" id="hashes-badge">Pronto</span>
        <span class="agente-summary" id="hashes-summary"></span>
        <span class="agente-dep-chain">| independente</span>
      </div>
      <p class="agente-desc">${explicacaoDoCard('hashes')}</p>
      <span class="agente-chevron" id="hashes-chevron">▸</span>
    </button>
    <div class="agente-card-body hidden" id="hashes-body">
      <div class="agente-tabs">
        <button class="agente-tab active" id="hashes-tab-processar" data-tab="processar">Processar</button>
        <button class="agente-tab" id="hashes-tab-visualizar" data-tab="visualizar">Visualizar</button>
      </div>
      <div class="agente-tab-content" id="hashes-pane-processar">
        <!-- DOIS botões, e não um. O antigo "▶ Executar" mostrava
             "N arquivos mudaram" e regravava a linha de base no mesmo clique,
             apagando a informação que acabava de mostrar: clicar duas vezes
             seguidas dava "N mudaram" e depois "0 mudaram", com o disco
             parado entre os dois cliques. Agora são dois verbos. -->
        <div class="agente-actions">
          <button class="btn btn-muted btn-sm" id="btn-verificar-hashes" title="olha e relata — não regrava a linha de base">Verificar</button>
          <button class="btn btn-positive btn-sm" id="btn-run-hashes" data-trava-ia="rotinas" data-trava-ia-qualquer-dono title="olha, relata e chama o ciclo com os arquivos que achou">Verificar e processar</button>
        </div>
        <div id="hashes-progress-area" class="agente-progress-area hidden">
          <span id="hashes-progress-label" class="agente-progress-label">Calculando hashes...</span>
        </div>
        <div id="hashes-result-area" class="agente-result-area hidden">
          <div class="agente-result-summary" id="hashes-result-summary"></div>
        </div>
      </div>
      <div class="agente-tab-content hidden" id="hashes-pane-visualizar">
        <div class="agente-hash-tree" id="hashes-tree">
          <p class="agente-viewer-empty">Nenhum hash gerado ainda.</p>
        </div>
      </div>
    </div>
  </div>
`);
