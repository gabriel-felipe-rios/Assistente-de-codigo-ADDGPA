// ══════════════════════════════════════════════ TEMPLATE: Aba Editor
// Markup estático da aba "Editor". Extraído de index.html pelo mesmo motivo dos
// outros `*-template.js`: manter o shell abaixo do teto de 500 linhas da AMF.
//
// Os dois painéis do lado direito são iguais e nascem vazios — quem monta a
// superfície de edição dentro deles é `editor.js`, porque ela é três camadas
// com métricas casadas e sai de `criarSuperficie()`, não de HTML escrito à mão.
document.getElementById('tab-editor').innerHTML = `
  <div class="ed-layout">

    <div class="ed-body">

      <!-- ── Árvore da pasta raiz ── -->
      <div class="ed-arvore-painel" id="ed-arvore-painel">
        <div class="ed-arvore-header">
          <span class="ed-arvore-titulo">Pasta raiz</span>
          <div class="ed-arvore-acoes">
            <!-- Acesso rápido (Ctrl+P) — um botão que abre a barra flutuante,
                 em vez de uma barra permanente comendo espaço vertical da
                 árvore o tempo todo. A barra deixou de ser desta aba: ela é
                 global (\`modulos/acesso-rapido.js\`), e este botão só a
                 alterna. O botão continua sendo do Editor.
                 ⚠️ GLIFO, não emoji: é o mesmo \`⌕\` da categoria "Acesso
                 rápido" em Configurações, para quem vir os dois reconhecer que
                 são a mesma coisa — e porque emoji não obedece a \`color\`,
                 ficando aceso ao lado de vizinhos apagados. -->
            <button class="btn-icon" id="ed-btn-busca-rapida" title="Acesso rápido (Ctrl+P)">⌕</button>
            <button class="btn-icon" id="ed-btn-recarregar" title="Recarregar do disco e recontar">↻</button>
            <button class="btn-icon" id="ed-btn-retrair" title="Esconder a árvore e dar toda a largura ao código">⟨</button>
          </div>
        </div>
        <div class="ed-arvore" id="ed-arvore">
          <div class="ed-vazio">Carregando…</div>
        </div>
      </div>

      <div class="divisoria" id="ed-divisoria-arvore"></div>

      <!-- ── Os dois painéis de edição ──
           Nascem com a área em modo simples (\`--simples\`): o painel B só
           aparece quando o usuário divide a tela. -->
      <div class="ed-area ed-area--simples" id="ed-area">
        <div class="ed-painel ed-ativo" id="ed-painel-a" data-lado="a"></div>
        <div class="divisoria divisoria--inerte" id="ed-divisoria-paineis"></div>
        <div class="ed-painel divisoria-retraido" id="ed-painel-b" data-lado="b"></div>
      </div>

    </div>

    <!-- Rodapé: o estado do arquivo em foco, e os quatro atalhos escritos.
         Os atalhos ficam à vista de propósito — são novidade nesta aba, e o
         programa não tinha nenhum atalho de teclado antes dela. -->
    <!-- Ponto de encaixe \`editor.painel\` (fase 11): um bloco de extensão
         abaixo dos painéis de código. Vazio, não ocupa pixel. -->
    <div id="ed-encaixe" class="xt-ponto"></div>
    <div class="ed-status">
      <span id="ed-status-pos">—</span>
      <span id="ed-status-lang">—</span>
      <span id="ed-status-enc">—</span>
      <span id="ed-status-eol">—</span>
      <span id="ed-status-zoom"></span>
      <!-- Ponto \`editor.rodape\`: um texto curto de extensão, em linha. -->
      <span id="ed-status-xt" class="xt-ponto xt-ponto--linha"></span>
      <div class="ed-status-dir">
        <span><kbd>Ctrl</kbd>+<kbd>P</kbd> Abrir arquivo</span>
        <span><kbd>Ctrl</kbd>+<kbd>S</kbd> Salvar</span>
        <span><kbd>Ctrl</kbd>+<kbd>Z</kbd> Desfazer</span>
        <span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> Refazer</span>
        <span><kbd>Ctrl</kbd>+<kbd>F</kbd> Buscar</span>
      </div>
    </div>

  </div>
`;
