// ══════════════════════════════════════════════ TEMPLATE: Aba Análise
// Markup estático da aba "Análise" (Tree-sitter, LSP, Índice de Símbolos,
// Mapa de I/O, Relações). Extraído de index.html para manter o shell abaixo
// do limite de linhas da AMF.
document.getElementById('tab-analise').innerHTML = `
  <div class="subtabs-bar" data-taborder-group="analise_subtabs" data-taborder-label="Sub-abas de Análise" data-taborder-parent="tab-analise">
    <button class="analise-tab-btn active" data-analise="analise-estrutura">Tree-sitter</button>
    <button class="analise-tab-btn"        data-analise="analise-lsp">LSP</button>
    <button class="analise-tab-btn"        data-analise="analise-ast">Índice de Símbolos</button>
    <button class="analise-tab-btn"        data-analise="analise-mio">Mapa de I/O</button>
    <button class="analise-tab-btn"        data-analise="analise-relacoes">Relações</button>
    <button class="analise-tab-btn"        data-analise="analise-duplicados">Duplicados</button>
  </div>

  <!-- Tree-sitter -->
  <div class="analise-tab-content analise-tab-content--arvore active" id="analise-estrutura">

    <!-- Barra de busca (componente busca-arvore.js/.css — o mesmo visual da
         aba Documentação). Dois modos aqui, não três: a busca semântica
         depende de índice de embeddings, que só as fontes de Documentação
         têm. -->
    <div class="bsa-barra">
      <div class="bsa-linha">
        <input type="text" id="ts-busca-input" class="bsa-input" placeholder="Buscar arquivo...">
        <button class="btn btn-muted btn-sm" id="btn-ts-busca">Buscar</button>
      </div>
      <div class="bsa-modos" id="ts-busca-modos">
        <button class="bsa-modo-btn active" data-mode="nome">Por nome</button>
        <button class="bsa-modo-btn" data-mode="conteudo">Por conteúdo</button>
      </div>
      <div class="bsa-aviso" id="ts-busca-aviso"></div>
    </div>
    <div id="estrutura-placeholder" class="placeholder-text">
      Configure as pastas na aba <strong>Trabalho</strong> para ver a estrutura do projeto.
    </div>
    <div id="estrutura-content" class="hidden ts-layout">

      <!-- Painel 1: árvore de arquivos (componente arvore-pastas.js) -->
      <div class="ts-file-panel">
        <div class="arvp-barra">
          <span class="arvp-barra-titulo">Arquivos</span>
          <button class="btn-icon" id="btn-ts-expand-all" title="Expandir tudo">⊞</button>
          <button class="btn-icon" id="btn-ts-collapse-all" title="Retrair tudo">⊟</button>
          <button class="btn-icon" id="btn-ts-refresh" title="Analisar de novo">↻</button>
        </div>
        <div id="ts-file-list" class="ts-file-list"></div>
      </div>

      <!-- Painel 2: símbolos do arquivo selecionado -->
      <div class="ts-sym-panel">
        <div id="ts-detail-empty" class="ts-detail-empty">
          Selecione um arquivo para ver os símbolos.
        </div>
        <div id="ts-detail-content" class="ts-detail-content hidden">
          <div class="ts-detail-header">
            <span id="ts-detail-filename" class="ts-detail-filename"></span>
            <span id="ts-detail-lang" class="ts-lang-badge"></span>
          </div>
          <div class="ts-filter-bar" id="ts-filter-bar">
            <button class="ts-filter-btn active" data-filter="">Todos</button>
            <button class="ts-filter-btn" data-filter="class">🟦 Classe</button>
            <button class="ts-filter-btn" data-filter="function">⚡ Função</button>
            <button class="ts-filter-btn" data-filter="method">🔧 Método</button>
            <button class="ts-filter-btn" data-filter="interface">📋 Interface</button>
            <button class="ts-filter-btn" data-filter="struct">🧱 Struct</button>
            <button class="ts-filter-btn" data-filter="impl">⚙️ Impl</button>
            <button class="ts-filter-btn" data-filter="enum">🔢 Enum</button>
            <button class="ts-filter-btn" data-filter="type">🏷️ Tipo</button>
          </div>
          <div id="ts-symbol-list" class="ts-symbol-list"></div>
        </div>
      </div>

      <!-- Painel 3: trecho de código do símbolo clicado -->
      <div class="ts-code-panel">
        <div id="ts-code-empty" class="ts-detail-empty">
          Clique em um símbolo para ver o código.
        </div>
        <div id="ts-code-content" class="ts-code-content hidden">
          <div class="ts-code-header">
            <span id="ts-code-sym-name" class="ts-code-sym-name"></span>
            <span id="ts-code-location" class="ts-line-num"></span>
            <button class="btn-copy-code" id="btn-copy-ts" title="Copiar trecho">⎘</button>
          </div>
          <div id="ts-code-lines" class="ts-code-lines"></div>
        </div>
      </div>

    </div>
  </div>

  <!-- LSP -->
  <div class="analise-tab-content hidden" id="analise-lsp">
    <div id="lsp-placeholder" class="placeholder-text">
      Configure as pastas na aba <strong>Trabalho</strong> para analisar o projeto.
    </div>
    <div id="lsp-content" class="hidden lsp-layout">

      <!-- Painel esquerdo: lista de diagnósticos -->
      <div class="lsp-diag-panel">
        <div class="lsp-diag-header">
          <span class="lsp-diag-title">Diagnósticos</span>
          <button class="btn btn-primary btn-sm" id="btn-run-lsp">▶ Analisar</button>
        </div>
        <div id="lsp-summary" class="lsp-summary hidden"></div>
        <div id="lsp-diag-list" class="lsp-diag-list">
          <div class="tree-loading" style="padding:16px 14px">Clique em <strong>Analisar</strong> para verificar o projeto.</div>
        </div>
      </div>

      <!-- Painel direito: detalhe do diagnóstico selecionado -->
      <div class="lsp-detail-panel">
        <div id="lsp-detail-empty" class="ts-detail-empty">Selecione um diagnóstico para ver os detalhes.</div>
        <div id="lsp-detail-content" class="lsp-detail-content hidden">
          <div class="lsp-det-header">
            <span id="lsp-det-badge" class="lsp-det-badge"></span>
            <span id="lsp-det-msg" class="lsp-det-msg"></span>
          </div>
          <div class="lsp-det-meta">
            <span id="lsp-det-file" class="lsp-det-file"></span>
            <span id="lsp-det-line" class="ts-line-num"></span>
          </div>
          <div id="lsp-det-code" class="ts-code-lines lsp-det-code"></div>
        </div>
      </div>

    </div>
  </div>

  <!-- Índice de Símbolos -->
  <div class="analise-tab-content hidden" id="analise-ast">
    <div id="si-placeholder" class="placeholder-text">
      Configure as pastas na aba <strong>Trabalho</strong> para indexar o projeto.
    </div>
    <div id="si-content" class="hidden si-layout">

      <!-- Painel esquerdo: lista de símbolos -->
      <div class="si-list-panel">
        <div class="si-list-header">
          <div class="si-search-row">
            <input type="text" id="si-search" class="si-search" placeholder="Buscar símbolo...">
            <button class="btn btn-primary btn-sm" id="btn-build-index">⚡ Indexar</button>
          </div>
          <div class="si-status" id="si-status"></div>
          <div class="si-filter-bar" id="si-filter-bar">
            <button class="si-filter-btn active" data-sifilter="">Todos</button>
            <button class="si-filter-btn" data-sifilter="class">🟦 Classe</button>
            <button class="si-filter-btn" data-sifilter="function">⚡ Função</button>
            <button class="si-filter-btn" data-sifilter="method">🔧 Método</button>
            <button class="si-filter-btn" data-sifilter="interface">📋 Interface</button>
            <button class="si-filter-btn" data-sifilter="struct">🧱 Struct</button>
            <button class="si-filter-btn" data-sifilter="impl">⚙️ Impl</button>
            <button class="si-filter-btn" data-sifilter="enum">🔢 Enum</button>
          </div>
        </div>
        <div id="si-symbol-list" class="si-symbol-list"></div>
      </div>

      <!-- Painel direito: detalhes do símbolo selecionado -->
      <div class="si-detail-panel">
        <div id="si-detail-empty" class="ts-detail-empty">Selecione um símbolo para ver os detalhes.</div>
        <div id="si-detail-content" class="hidden si-detail-content">
          <div class="si-def-section">
            <div class="si-section-title">Definição <button class="btn-copy-code" id="btn-copy-si" title="Copiar trecho">⎘</button></div>
            <div id="si-def-info" class="si-def-info"></div>
            <div id="si-def-code" class="ts-code-lines si-def-code"></div>
          </div>
          <div class="si-usages-section">
            <div class="si-section-title">Usos <span id="si-usage-count" class="ts-folder-count"></span></div>
            <div id="si-usage-loading" class="tree-loading hidden">Buscando usos...</div>
            <div id="si-usage-list" class="si-usage-list"></div>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- Mapa de I/O -->
  <div class="analise-tab-content analise-tab-content--arvore hidden" id="analise-mio">

    <!-- Barra de busca (componente busca-arvore.js/.css — o mesmo visual da
         aba Documentação). Dois modos aqui, não três: a busca semântica
         depende de índice de embeddings, que só as fontes de Documentação
         têm. -->
    <div class="bsa-barra">
      <div class="bsa-linha">
        <input type="text" id="mio-busca-input" class="bsa-input" placeholder="Buscar arquivo...">
        <button class="btn btn-muted btn-sm" id="btn-mio-busca">Buscar</button>
      </div>
      <div class="bsa-modos" id="mio-busca-modos">
        <button class="bsa-modo-btn active" data-mode="nome">Por nome</button>
        <button class="bsa-modo-btn" data-mode="conteudo">Por conteúdo</button>
      </div>
      <div class="bsa-aviso" id="mio-busca-aviso"></div>
    </div>
    <div id="mio-placeholder" class="placeholder-text">
      Configure as pastas na aba <strong>Trabalho</strong> para usar o Mapa de I/O.
    </div>
    <div id="mio-content" class="hidden lsp-layout">

      <!-- Painel esquerdo: árvore dos arquivos com I/O (arvore-pastas.js) -->
      <div class="lsp-diag-panel">
        <div class="arvp-barra">
          <span class="arvp-barra-titulo">Arquivos com I/O</span>
          <button class="btn-icon" id="btn-mio-expand-all" title="Expandir tudo">⊞</button>
          <button class="btn-icon" id="btn-mio-collapse-all" title="Retrair tudo">⊟</button>
          <button class="btn-icon" id="btn-mio-refresh" title="Analisar de novo">↻</button>
        </div>
        <div id="mio-file-list" class="ts-file-list">
          <div class="tree-loading" style="padding:16px 14px">Carregando...</div>
        </div>
      </div>

      <!-- Painel central: operações do arquivo selecionado -->
      <div class="ts-sym-panel">
        <div id="mio-detail-empty" class="ts-detail-empty">Selecione um arquivo para ver as operações.</div>
        <div id="mio-detail-content" class="ts-detail-content hidden">
          <!-- Barra de copiar. Mesma forma da .doc-viewer-toolbar da aba
               Documentacao: nome do arquivo a esquerda, botoes a direita, e quem
               cede espaco e o nome.
               "Caminho + trecho" nasce escondido porque depende de uma operacao
               clicada; aparece em mioShowCode e some em mioResetCode. Escondido,
               nunca desabilitado - e a mesma regra da Documentacao. -->
          <div class="ts-detail-header">
            <span id="mio-detail-filename" class="ts-detail-filename"></span>
            <div class="ts-detail-actions">
              <button class="btn btn-utility btn-sm" id="btn-mio-copiar-caminho">📋 Caminho</button>
              <button class="btn btn-primary btn-sm hidden" id="btn-mio-copiar-trecho">📋 Caminho + trecho</button>
              <button class="btn btn-special btn-sm" id="btn-mio-copiar-codigo">📋 Caminho + código</button>
            </div>
          </div>
          <div class="ts-filter-bar">
            <button class="mio-filter-btn active" data-miofilter="">Todos</button>
            <button class="mio-filter-btn" data-miofilter="read_file">📄 Lê arquivo</button>
            <button class="mio-filter-btn" data-miofilter="write_file">💾 Escreve arquivo</button>
            <button class="mio-filter-btn" data-miofilter="read_dir">📂 Lê pasta</button>
            <button class="mio-filter-btn" data-miofilter="create_dir">🗂️ Cria pasta</button>
            <button class="mio-filter-btn" data-miofilter="delete_file">🗑️ Deleta arquivo</button>
            <button class="mio-filter-btn" data-miofilter="delete_dir">🗑️ Deleta pasta</button>
            <button class="mio-filter-btn" data-miofilter="delete">🗑️ Deleta</button>
            <button class="mio-filter-btn" data-miofilter="check_file">🔍 Verifica arquivo</button>
            <button class="mio-filter-btn" data-miofilter="check_dir">🔍 Verifica pasta</button>
            <button class="mio-filter-btn" data-miofilter="check_path">🔍 Verifica caminho</button>
          </div>
          <div id="mio-entry-list" class="mio-entry-list"></div>
        </div>
      </div>

      <!-- Painel direito: trecho de código da operação clicada -->
      <div class="ts-code-panel">
        <div id="mio-code-empty" class="ts-detail-empty">Clique em uma operação para ver o código.</div>
        <div id="mio-code-content" class="ts-code-content hidden">
          <div class="ts-code-header">
            <span id="mio-code-sym-name" class="ts-code-sym-name"></span>
            <span id="mio-code-location" class="ts-line-num"></span>
            <!-- ⛔ O btn-copy-mio (⎘ "Copiar trecho") saiu daqui. Ele copiava o
                 texto cru, sem caminho e sem cabecalho — o defeito que originou a
                 mudanca. Quem faz esse trabalho agora e o "Caminho + trecho" da
                 barra do painel do meio, que sai embrulhado no envelope.
                 O Tree-sitter e o Indice de Simbolos MANTEM o deles: ficaram fora
                 do escopo por decisao do usuario. -->
          </div>
          <div id="mio-code-lines" class="ts-code-lines"></div>
        </div>
      </div>

    </div>
  </div>

  <!-- Relações -->
  <div class="analise-tab-content analise-tab-content--arvore hidden" id="analise-relacoes">

    <!-- Barra de busca (componente busca-arvore.js/.css — o mesmo visual da
         aba Documentação). Dois modos aqui, não três: a busca semântica
         depende de índice de embeddings, que só as fontes de Documentação
         têm. -->
    <div class="bsa-barra">
      <div class="bsa-linha">
        <input type="text" id="rel-busca-input" class="bsa-input" placeholder="Buscar arquivo...">
        <button class="btn btn-muted btn-sm" id="btn-rel-busca">Buscar</button>
      </div>
      <div class="bsa-modos" id="rel-busca-modos">
        <button class="bsa-modo-btn active" data-mode="nome">Por nome</button>
        <button class="bsa-modo-btn" data-mode="conteudo">Por conteúdo</button>
      </div>
      <div class="bsa-aviso" id="rel-busca-aviso"></div>
    </div>
    <div id="relacoes-placeholder" class="placeholder-text">
      Rode o agente <strong>Índice de Identificadores</strong> na aba Agentes → Rotinas
      para usar esta tela.
    </div>
    <div id="relacoes-content" class="hidden rel-layout">

      <!-- Painel esquerdo: árvore dos arquivos indexados (arvore-pastas.js) -->
      <div class="ts-file-panel">
        <div class="arvp-barra">
          <span class="arvp-barra-titulo">Arquivos indexados</span>
          <button class="btn-icon" id="btn-rel-expand-all" title="Expandir tudo">⊞</button>
          <button class="btn-icon" id="btn-rel-collapse-all" title="Retrair tudo">⊟</button>
          <button class="btn-icon" id="btn-rel-refresh" title="Recarregar a lista">↻</button>
        </div>
        <div id="relacoes-file-list" class="ts-file-list"></div>
      </div>

      <!-- Painel direito: eu uso / me usam / cascata -->
      <div class="rel-detail-panel">
        <div id="relacoes-detail-empty" class="ts-detail-empty">Selecione um arquivo para ver as relações.</div>
        <div id="relacoes-detail-content" class="hidden">
          <!-- Sem "Caminho + codigo": esta tela nao tem painel de codigo. E a
               mesma logica pela qual o Resumo de pastas nao tem esse botao na
               aba Documentacao - nao ha codigo ali para copiar. -->
          <div class="ts-detail-header">
            <span id="relacoes-detail-filename" class="ts-detail-filename"></span>
            <div class="ts-detail-actions">
              <button class="btn btn-utility btn-sm" id="btn-rel-copiar-caminho">📋 Caminho</button>
              <button class="btn btn-primary btn-sm" id="btn-rel-copiar-relatorio">📋 Caminho + relatório</button>
            </div>
          </div>
          <div class="rel-grid">
            <div class="rel-box">
              <h4>Eu uso</h4>
              <ul id="relacoes-uso-list"></ul>
            </div>
            <div class="rel-box">
              <h4>Me usam</h4>
              <ul id="relacoes-usado-por-list"></ul>
            </div>
            <div class="rel-box wide">
              <h4>Cascata — indiretos (os diretos acima não repetem)</h4>
              <div id="relacoes-cascata"></div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- Duplicados -->
  <div class="analise-tab-content hidden" id="analise-duplicados">
    <div class="dup-layout">
      <div class="dup-header">
        <div class="dup-header-info">
          <span class="dup-title">Código duplicado</span>
          <span class="dup-sub">Funções com corpo parecido, candidatas a unificar. Compara a estrutura do código, sem IA — pega o clone copiado, o renomeado e o copiado-e-editado. Quem gera é a rotina <b>Duplicados</b>, em Automação › Rotinas.</span>
        </div>
        <div class="dup-controls">
          <label class="dup-thresh">
            Similaridade mínima
            <select id="dup-threshold">
              <option value="0.95">95%</option>
              <option value="0.90">90%</option>
              <option value="0.85" selected>85%</option>
              <option value="0.80">80%</option>
              <option value="0.75">75%</option>
            </select>
          </label>
          <button class="btn btn-primary btn-sm" id="btn-run-duplicados">▶ Comparar</button>
        </div>
      </div>
      <div id="dup-status" class="dup-status"></div>
      <div id="dup-list" class="dup-list">
        <div class="tree-loading" style="padding:16px 14px">
          Clique em <strong>Comparar</strong> para ver os pares duplicados do último índice.
        </div>
      </div>
    </div>
  </div>
`;
