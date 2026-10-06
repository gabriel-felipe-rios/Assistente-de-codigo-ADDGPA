// ══════════════════════════════════════════════ TEMPLATE: Card "Resumo de Pastas"
// Markup estático do card do agente Resumo de Pastas (sub-aba Rotinas).
// Inserido em #agente-grupo-ind — rotinas.js (`_agruparCards`) o realoca para
// o grupo correto (ind/dep) lendo o atributo data-grupo do próprio card.
document.getElementById('agente-grupo-ind').insertAdjacentHTML('beforeend', `
  <div class="agente-card" data-agente="resumo-pastas" data-tipo="llm" data-destino="humano lmstudio" data-grupo="dep" id="agente-resumo-pastas">
    <button class="agente-card-header agente-card-toggle" id="resumo-pastas-toggle">
      <div class="agente-title-row">
        <span class="agente-icon">📂</span>
        <span class="agente-name">Resumo de Pastas</span>
        <span class="agente-selos"><span class="agente-selo" title="escrito por LLM">🧠</span><span class="agente-selo" title="para você ler">👤</span><span class="agente-selo" title="insumo para o LM Studio">🖥️</span></span>
        <span class="agente-badge agente-badge-idle" id="resumo-pastas-badge">Pronto</span>
        <span class="agente-summary" id="resumo-pastas-summary"></span>
        <span class="agente-dep-chain">| Documentação Técnica →</span>
      </div>
      <p class="agente-desc">${explicacaoDoCard('resumo-pastas')}</p>
      <span class="agente-chevron" id="resumo-pastas-chevron">▸</span>
    </button>
    <div class="agente-card-body hidden" id="resumo-pastas-body">
      <div class="agente-tabs">
        <button class="agente-tab active" id="resumo-pastas-tab-processar" data-tab="processar">Processar</button>
        <button class="agente-tab" id="resumo-pastas-tab-visualizar" data-tab="visualizar">Visualizar</button>
        <button class="agente-tab" id="resumo-pastas-tab-grandes" data-tab="grandes">Arquivos muito grandes</button>
        <button class="agente-tab" id="resumo-pastas-tab-bloqueadas" data-tab="bloqueadas">Aguardando documentação técnica</button>
        <button class="agente-tab" id="resumo-pastas-tab-erros" data-tab="erros">Erros</button>
      </div>

      <!-- Aba: Processar -->
      <div class="agente-tab-content" id="resumo-pastas-pane-processar">
        <div class="agente-actions">
          <button class="btn btn-positive btn-sm" id="btn-run-resumo-pastas" data-trava-ia="rotinas" data-trava-ia-qualquer-dono>▶ Executar</button>
          <!-- O paralelismo REAL, ao lado do botão. Sem crases aqui: isto
               está dentro de um template literal. Ver
               _rotinasPintarParalelismo em execucao/rotinas.js. -->
          <span class="agente-progress-label" data-paralelo-nota></span>
          <button class="btn btn-muted btn-sm" id="btn-prompt-resumo-pastas">Ver prompt</button>
        </div>
        <div id="resumo-pastas-progress-area" class="agente-progress-area hidden">
          <div class="agente-progress-header">
            <span id="resumo-pastas-progress-label" class="agente-progress-label">Iniciando...</span>
            <span id="resumo-pastas-progress-count" class="agente-progress-count"></span>
          </div>
          <div class="agente-progress-bar-track">
            <div class="agente-progress-bar-fill" id="resumo-pastas-progress-bar" style="width:0%"></div>
          </div>
          <div id="resumo-pastas-current-folder" class="agente-current-file em-linhas"></div>
        </div>
        <div id="resumo-pastas-result-area" class="agente-result-area hidden">
          <div class="agente-result-summary" id="resumo-pastas-result-summary"></div>
        </div>
      </div>

      <!-- Aba: Visualizar -->
      <div class="agente-tab-content hidden" id="resumo-pastas-pane-visualizar">
        <div class="agente-viewer-list" id="resumo-pastas-viewer-list">
          <p class="agente-viewer-empty">Nenhum arquivo gerado ainda.</p>
        </div>
        <div class="agente-viewer-content hidden" id="resumo-pastas-viewer-content">
          <div class="agente-viewer-content-header">
            <span id="resumo-pastas-viewer-filename"></span>
            <button class="agente-viewer-close" id="resumo-pastas-viewer-close">✕</button>
          </div>
          <pre class="agente-viewer-pre" id="resumo-pastas-viewer-pre"></pre>
        </div>
      </div>

      <!-- Aba: Arquivos muito grandes -->
      <div class="agente-tab-content hidden" id="resumo-pastas-pane-grandes">
        <div id="resumo-pastas-grandes-list" class="agente-issue-list"></div>
      </div>

      <!-- Aba: Aguardando documentação técnica — pastas que NÃO foram
           resumidas porque algum arquivo elegível ainda não tem documentação
           técnica. Mostra o arquivo culpado e o motivo; é isso que destrava a pasta. -->
      <div class="agente-tab-content hidden" id="resumo-pastas-pane-bloqueadas">
        <p class="agente-desc" style="margin-bottom:8px">
          Estas pastas não geram resumo enquanto todos os arquivos delas não
          tiverem documentação técnica — um resumo feito pela metade ficaria
          congelado assim. Rode a Documentação Técnica nestes arquivos e o
          Resumo destrava sozinho.
        </p>
        <div id="resumo-pastas-bloqueadas-list" class="agente-issue-list"></div>
      </div>

      <!-- Aba: Erros -->
      <div class="agente-tab-content hidden" id="resumo-pastas-pane-erros">
        <div id="resumo-pastas-error-list" class="agente-issue-list"></div>
      </div>
    </div>
  </div>
`);
