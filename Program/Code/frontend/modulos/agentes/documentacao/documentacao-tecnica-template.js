// ══════════════════════════════════════════════ TEMPLATE: Card "Documentação Técnica"
// Markup estático do card do agente Documentação Técnica (sub-aba Rotinas).
// Inserido em #agente-grupo-ind — rotinas.js (`_agruparCards`) o realoca para
// o grupo correto (ind/dep) lendo o atributo data-grupo do próprio card.
document.getElementById('agente-grupo-ind').insertAdjacentHTML('beforeend', `
  <div class="agente-card" data-agente="documentacao-tecnica" data-tipo="det llm" data-destino="lmstudio externo" data-grupo="ind" id="agente-documentacao-tecnica">
    <button class="agente-card-header agente-card-toggle" id="documentacao-tecnica-toggle">
      <div class="agente-title-row">
        <span class="agente-icon">🗂️</span>
        <span class="agente-name">Documentação Técnica</span>
        <span class="agente-selos"><span class="agente-selo" title="determinístico — não usa LLM">⚡</span><span class="agente-selo" title="escrito por LLM">🧠</span><span class="agente-selo" title="insumo para o LM Studio">🖥️</span><span class="agente-selo" title="insumo para o assistente externo — Claude Code, Cursor, Antigravity…">🤖</span></span>
        <span class="agente-badge agente-badge-idle" id="documentacao-tecnica-badge">Pronto</span>
        <span class="agente-summary" id="documentacao-tecnica-summary"></span>
        <span class="agente-dep-chain">| independente</span>
      </div>
      <p class="agente-desc">${explicacaoDoCard('doc-tecnica')}</p>
      <span class="agente-chevron" id="documentacao-tecnica-chevron">▸</span>
    </button>
    <div class="agente-card-body hidden" id="documentacao-tecnica-body">
      <div class="agente-tabs">
        <button class="agente-tab active" id="documentacao-tecnica-tab-processar" data-tab="processar">Processar</button>
        <button class="agente-tab" id="documentacao-tecnica-tab-visualizar" data-tab="visualizar">Visualizar</button>
        <button class="agente-tab" id="documentacao-tecnica-tab-grandes" data-tab="grandes">Arquivos muito grandes</button>
        <button class="agente-tab" id="documentacao-tecnica-tab-inalterados" data-tab="inalterados">Inalterados</button>
        <button class="agente-tab" id="documentacao-tecnica-tab-erros" data-tab="erros">Erros</button>
      </div>

      <!-- Aba: Processar -->
      <div class="agente-tab-content" id="documentacao-tecnica-pane-processar">
        <div class="agente-preview" id="documentacao-tecnica-preview">
          <button class="agente-preview-toggle" id="documentacao-tecnica-preview-toggle">
            <span id="documentacao-tecnica-preview-label">Verificando...</span>
            <span class="agente-preview-arrow" id="documentacao-tecnica-preview-arrow">▸</span>
          </button>
          <div id="documentacao-tecnica-preview-body" class="agente-preview-body hidden">
            <label class="agente-preview-filter">
              <input type="checkbox" id="documentacao-tecnica-show-ignored"> Mostrar ignorados
            </label>
            <div id="documentacao-tecnica-tree" class="agente-preview-tree"></div>
          </div>
        </div>
        <!-- A lista é uma só, global, e se muda em Configurações (sem crases:
             isto está dentro de um template literal). Ver _rotinaLePintar. -->
        <div class="rotina-le" id="documentacao-tecnica-rotina-le">
          Lê <b data-rotina-le-n>…</b> — a lista de Configurações › Arquivos que o programa lê, em todos os projetos
          <button class="btn btn-muted btn-xs" type="button" data-rotina-le-ir>Configurações › Arquivos que o programa lê</button>
        </div>
        <div class="agente-actions">
          <button class="btn btn-positive btn-sm" id="btn-run-documentacao-tecnica" data-trava-ia="rotinas" data-trava-ia-qualquer-dono>▶ Executar</button>
          <!-- O paralelismo REAL, ao lado do botão. Sem crases aqui: isto
               está dentro de um template literal. Ver
               _rotinasPintarParalelismo em execucao/rotinas.js. -->
          <span class="agente-progress-label" data-paralelo-nota></span>
          <button class="btn btn-muted btn-sm" id="btn-prompt-documentacao-tecnica">Ver prompt</button>
        </div>
        <div id="documentacao-tecnica-progress-area" class="agente-progress-area hidden">
          <div class="agente-progress-header">
            <span id="documentacao-tecnica-progress-label" class="agente-progress-label">Iniciando...</span>
            <span id="documentacao-tecnica-progress-count" class="agente-progress-count"></span>
          </div>
          <div class="agente-progress-bar-track">
            <div class="agente-progress-bar-fill" id="documentacao-tecnica-progress-bar" style="width:0%"></div>
          </div>
          <div class="agente-progress-reaproveitado hidden" id="documentacao-tecnica-reaproveitado-row">
            <span class="agente-progress-rot">Reaproveitado</span>
            <div class="agente-progress-bar-track">
              <div class="agente-progress-bar-fill agente-progress-bar-cache" id="documentacao-tecnica-reaproveitado-bar" style="width:0%"></div>
            </div>
            <span class="agente-progress-count" id="documentacao-tecnica-reaproveitado-count"></span>
          </div>
          <div id="documentacao-tecnica-current-file" class="agente-current-file em-linhas"></div>
        </div>
      </div>

      <!-- Aba: Visualizar -->
      <div class="agente-tab-content hidden" id="documentacao-tecnica-pane-visualizar">
        <div class="agente-viewer-list" id="documentacao-tecnica-viewer-list">
          <p class="agente-viewer-empty">Nenhum arquivo gerado ainda.</p>
        </div>
        <div class="agente-viewer-content hidden" id="documentacao-tecnica-viewer-content">
          <div class="agente-viewer-content-header">
            <span id="documentacao-tecnica-viewer-filename"></span>
            <button class="agente-viewer-close" id="documentacao-tecnica-viewer-close">✕</button>
          </div>
          <pre class="agente-viewer-pre" id="documentacao-tecnica-viewer-pre"></pre>
        </div>
      </div>

      <!-- Aba: Arquivos muito grandes -->
      <div class="agente-tab-content hidden" id="documentacao-tecnica-pane-grandes">
        <div id="documentacao-tecnica-grandes-list" class="agente-issue-list"></div>
      </div>

      <!-- Aba: Inalterados — pulados porque o hash não mudou. Não são erro
           nem arquivo grande; ficavam misturados com os grandes. -->
      <div class="agente-tab-content hidden" id="documentacao-tecnica-pane-inalterados">
        <div id="documentacao-tecnica-inalterados-list" class="agente-issue-list"></div>
      </div>

      <!-- Aba: Erros -->
      <div class="agente-tab-content hidden" id="documentacao-tecnica-pane-erros">
        <div id="documentacao-tecnica-error-list" class="agente-issue-list"></div>
      </div>
    </div>
  </div>
`);
