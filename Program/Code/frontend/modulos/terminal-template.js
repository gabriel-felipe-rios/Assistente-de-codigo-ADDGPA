// ══════════════════════════════════════════════ TEMPLATE: Aba Terminal
// Markup estático da aba "Terminal". Extraído de index.html para manter o
// shell abaixo do limite de linhas da AMF.
document.getElementById('tab-terminal').innerHTML = `
  <div class="terminal-layout">
    <div class="terminal-toolbar">
      <input type="text" id="terminal-path" class="terminal-path-input" placeholder="Nenhum script selecionado..." readonly />
      <span id="terminal-path-origem" class="terminal-path-origem"></span>
      <button class="btn btn-primary btn-sm" id="btn-browse-script">Selecionar script</button>
      <!-- M2 · o ponto "terminal.barra". Vazio e sem largura enquanto nenhuma
           extensão desenhar nele (:empty em extensoes-do-programa.css). -->
      <div id="terminal-encaixe-barra" class="xt-ponto-barra"></div>
      <button class="btn btn-positive btn-sm" id="btn-run-script" disabled>▶ Executar</button>
      <button class="btn btn-muted btn-sm" id="btn-copy-all" disabled>📋 Copiar tudo</button>
      <span id="terminal-exit-badge" class="terminal-exit-badge hidden"></span>
    </div>

    <!-- M2 · o ponto de encaixe "terminal.painel". Fica VAZIO e sem altura
         enquanto nenhuma extensão desenhar nele (a regra :empty em
         extensoes-do-programa.css), então a aba de quem não usa extensão
         nenhuma continua exatamente como era. -->
    <div id="terminal-encaixe" class="xt-ponto"></div>

    <div class="terminal-sst-linha">
      <div class="sst-bar">
        <button class="sst active" id="term-sst-tudo" data-termsst="tudo">Tudo</button>
        <button class="sst" id="term-sst-saida" data-termsst="saida">Saída</button>
        <button class="sst" id="term-sst-erros" data-termsst="erros">Erros</button>
      </div>
      <div class="terminal-busca-box">
        <input type="text" id="term-busca" class="terminal-busca-input" placeholder="buscar na saída..." />
        <button class="btn btn-muted btn-sm" id="term-busca-prev" title="Ocorrência anterior (Shift+Enter)">∧</button>
        <button class="btn btn-muted btn-sm" id="term-busca-next" title="Próxima ocorrência (Enter)">∨</button>
        <span id="term-busca-contador" class="terminal-busca-contador"></span>
      </div>
    </div>

    <div id="terminal-output" class="terminal-output">
      <span class="terminal-placeholder">Nenhum script executado ainda.</span>
    </div>

    <div id="terminal-error-panel" class="terminal-error-panel hidden">
      <div class="terminal-error-header">
        <span id="terminal-error-type" class="error-badge"></span>
        <button class="btn btn-utility btn-sm" id="btn-explain-error">🔎 Explicar este erro</button>
      </div>
      <div id="terminal-explain-area" class="terminal-explain-area hidden">
        <pre id="terminal-explain-prompt" class="terminal-explain-prompt"></pre>
        <button class="btn btn-muted btn-sm" id="btn-copy-explain">📋 Copiar prompt</button>
      </div>
    </div>
  </div>
`;
