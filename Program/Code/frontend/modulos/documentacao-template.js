// ══════════════════════════════════════════════ TEMPLATE: Aba Documentação
// Markup estático da aba "Documentação". Extraído de index.html para manter o
// shell abaixo do limite de linhas da AMF.
document.getElementById('tab-documentacao').innerHTML = `
  <div class="doc-layout">

    <!-- Sub-abas = FONTE. Substituíram o antigo combobox Arquivo/Pasta, que só
         dava conta de duas fontes; as outras cinco existiam no disco e não
         apareciam em lugar nenhum. Os 3 modos de busca continuam ortogonais:
         operam sobre a fonte selecionada aqui.

         data-taborder-group está aqui de propósito, mas NÃO existem painéis
         com estes ids — o corpo (.doc-body) é compartilhado por todas as
         fontes. tab-order.js reordena os botões e depois sai mudo ao não achar
         o painel do primeiro id: é o comportamento desejado neste caso, não um
         bug para consertar. -->
    <div class="doc-subtabs-bar" data-taborder-group="documentacao_subtabs" data-taborder-label="Sub-abas de Documentação" data-taborder-parent="tab-documentacao">
      <button class="doc-subtab-btn active" data-fonte="documentacao-tecnica">Documentação técnica</button>
      <button class="doc-subtab-btn" data-fonte="resumo-pastas">Resumo de pastas</button>
      <button class="doc-subtab-btn" data-fonte="glossario">Glossário</button>
      <button class="doc-subtab-btn" data-fonte="indice-navegacao">Índice de navegação</button>
      <button class="doc-subtab-btn" data-fonte="pipeline">Pipeline</button>
      <button class="doc-subtab-btn" data-fonte="bibliotecas">Bibliotecas</button>
      <button class="doc-subtab-btn" data-fonte="comentarios">Comentários</button>
    </div>

    <!-- Barra de busca — classes do componente compartilhado
         (estilos/busca-arvore.css), o mesmo visual das três telas de árvore da
         aba Análise. Aqui são TRÊS modos; lá, dois (não há embeddings do
         código).
         ⚠️ O id doc-busca-modos não é decorativo: os seletores de
         documentacao.js são escopados por ele. Sem escopo, um
         querySelectorAll('.bsa-modo-btn') alcançaria também os botões das
         barras da aba Análise, que existem no DOM o tempo todo (só ficam
         escondidas). -->
    <div class="bsa-barra">
      <div class="bsa-linha">
        <input type="text" id="doc-search-input" class="bsa-input" placeholder="Buscar arquivo...">
        <button class="btn btn-muted btn-sm" id="btn-doc-search">Buscar</button>
      </div>
      <div class="bsa-modos" id="doc-busca-modos">
        <button class="bsa-modo-btn active" data-mode="nome">Por nome</button>
        <button class="bsa-modo-btn" data-mode="conteudo">Por conteúdo</button>
        <button class="bsa-modo-btn" data-mode="semantica">Semântico</button>
      </div>
    </div>

    <!-- Corpo: árvore + painel direito -->
    <div class="doc-body">

      <!-- Árvore/lista da fonte selecionada -->
      <div class="doc-tree-panel" id="doc-tree-panel">
        <div class="doc-tree-header">
          <span class="doc-tree-title" id="doc-tree-title">Documentação técnica</span>
          <div class="doc-tree-actions">
            <button class="btn-icon" id="btn-doc-expand-all" title="Expandir tudo">⊞</button>
            <button class="btn-icon" id="btn-doc-collapse-all" title="Retrair tudo">⊟</button>
            <button class="btn-icon" id="btn-doc-refresh" title="Recarregar do disco">↻</button>
            <!-- Regerar ≠ recarregar: o ↻ acima relê o que já está gravado, este
                 roda a varredura de novo. Só a fonte Bibliotecas tem botão aqui —
                 as outras seis são geradas pelos seus agentes na aba Automação. -->
            <button class="btn-icon hidden" id="btn-doc-regerar" title="Atualizar a lista (varre o projeto de novo)">⟳</button>
          </div>
        </div>
        <div class="doc-tree" id="doc-tree">
          <div class="doc-empty">Nenhuma documentação técnica encontrada.<br>Execute a rotina Documentação Técnica primeiro.</div>
        </div>
      </div>

      <!-- Painel direito -->
      <div class="doc-right" id="doc-right">

        <!-- Placeholder (estado padrão) -->
        <div class="doc-placeholder" id="doc-placeholder">
          <span>Selecione um arquivo para ver a documentação</span>
        </div>

        <!-- Resultados de busca semântica -->
        <div class="doc-search-results hidden" id="doc-search-results"></div>

        <!-- Viewer do documento -->
        <div class="doc-viewer hidden" id="doc-viewer">
          <div class="doc-viewer-toolbar">
            <div class="doc-viewer-titulo">
              <span class="doc-viewer-tokens hidden" id="doc-viewer-tokens"></span>
              <span class="doc-viewer-filename" id="doc-viewer-filename"></span>
            </div>
            <div class="doc-viewer-actions">
              <!-- Quais destes quatro aparecem depende da fonte aberta — quem
                   decide é _docSyncBotoesCopiar (documentacao.js). Nunca
                   aparecem os quatro ao mesmo tempo. -->
              <button class="btn btn-utility btn-sm hidden" id="btn-doc-copiar-caminho">📋 Caminho</button>
              <button class="btn btn-primary btn-sm hidden" id="btn-doc-copiar-caminho-documento">📋 Caminho + documento</button>
              <button class="btn btn-special btn-sm hidden" id="btn-doc-copiar-caminho-codigo">📋 Caminho + código</button>
              <button class="btn btn-primary btn-sm hidden" id="btn-doc-copiar-documento">📋 Documento</button>
              <button class="btn-icon" id="btn-doc-viewer-close" title="Fechar">✕</button>
            </div>
          </div>
          <div class="doc-viewer-content" id="doc-viewer-content"></div>
        </div>

      </div>
    </div>

  </div>
`;
