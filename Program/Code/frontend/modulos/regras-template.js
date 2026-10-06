// ══════════════════════════════════════════════ TEMPLATE: Aba Acervo
// Markup estático da aba "Acervo" (id `tab-regras`, preservado: o rótulo
// mudou, o id não — 30+ referências dependem dele, e há precedente em
// tab-agentes/"Automação" e tab-git/"Backups"). Extraído de index.html para
// manter o shell abaixo do limite de linhas da AMF.
//
// As sub-abas de fonte NÃO são mais um número fixo (eram 3): vêm do preset do
// Acervo escolhido para este projeto (globais, definidos em Configurações →
// Acervo; o projeto só guarda qual NOME está ativo). O `<div>` abaixo nasce
// vazio — `regras.js::_regrasRenderSubtabsBar` desenha um `<button
// data-regrasfonte="...">` por pasta do preset ativo, na ordem em que estão.
//
// O preset se escolhe no `<select>` da primeira fileira. Era um botão-ícone
// `🗂` que abria um modal de rádios, e ele tinha dois problemas: `.btn-icon`
// pinta o estado por `color`, e emoji não obedece a `color` (Padrões de
// interface › Convenções), então o hover dele estava morto ao lado do ＋ ⊞ ⊟ ↻;
// e nenhuma outra tela do programa escolhe preset assim.
document.getElementById('tab-regras').innerHTML = `
  <div class="regras-layout">

    <!-- Qual preset este projeto usa. É um select na fileira, e não um
         botão-ícone com modal: é o mesmo gesto de .arq-preset-select
         (assistente externo) e .arq-preparar-select (início rápido), e três
         telas perguntando a mesma coisa com caras diferentes é a forma mais
         barata de fazer o usuário achar que são coisas diferentes.
         ⚠️ O select nasce vazio — quem o preenche é
         regras.js::_regrasPintarPresetSelect, a partir de load_acervo_config.
         Criar/editar/remover preset continua sendo em Configurações →
         Acervo; aqui só se ESCOLHE.
         ⚠️ SEM CRASE NESTE COMENTÁRIO: ele mora DENTRO de um template
         literal, e uma crase aqui fecha a string no meio do HTML. -->
    <div class="regras-preset-barra">
      <span class="regras-preset-rotulo">Preset do Acervo</span>
      <select class="regras-preset-select" id="regras-preset-select"></select>
      <span class="regras-preset-dica">cada pasta do preset vira uma sub-aba aqui</span>
    </div>

    <!-- Sub-abas de fonte — desenhadas por regras.js a partir do preset ativo -->
    <div class="doc-subtabs-bar" id="regras-subtabs-bar" data-taborder-group="regras_subtabs" data-taborder-label="Sub-abas do Acervo" data-taborder-parent="tab-regras"></div>

    <!-- Barra de caminho: onde a coisa mora e quem alcança -->
    <div class="regras-caminho" id="regras-caminho"></div>

    <!-- Toolbar topo — igual à de sempre: busca e Por nome/Por conteúdo,
         sem nenhum elemento novo. A lista de sub-abas acima é a única coisa
         que virou dinâmica nesta aba. -->
    <div class="regras-toolbar">
      <div class="regras-search-row">
        <input type="text" id="regras-search-input" class="regras-search-input" placeholder="Buscar...">
        <button class="btn btn-muted btn-sm" id="btn-regras-search">Buscar</button>
      </div>
      <div class="regras-toolbar-actions">
        <div class="regras-mode-toggle">
          <button class="regras-mode-btn active" data-mode="nome">Por nome</button>
          <button class="regras-mode-btn" data-mode="conteudo">Por conteúdo</button>
        </div>
      </div>
    </div>

    <!-- Corpo: árvore + editor -->
    <div class="regras-body">

      <!-- Painel esquerdo: árvore -->
      <div class="regras-tree-panel">
        <div class="regras-tree-header">
          <span class="regras-tree-title" id="regras-tree-title">Regras e instruções</span>
          <div class="regras-tree-header-botoes">
            <!-- O ＋ ("Nova regra, instrução ou arquivo") FOI EMBORA em
                 04/09/2026. Ele criava sempre na raiz da sub-aba e não sabia
                 criar pasta nenhuma; num painel com dez pastas, clicar nele era
                 um chute sobre onde a coisa ia nascer. Criar, renomear e
                 excluir passaram para o MENU DO BOTAO DIREITO, na propria linha
                 da arvore — o alvo passou a ser aquilo em que se clicou.
                 Quem monta os itens e regras-lista.js; o menu em si e o
                 componente compartilhado menu-contexto.js. No vazio do painel,
                 o mesmo clique direito age sobre a raiz da sub-aba. -->
            <!-- Expandir/retrair valem em QUALQUER pasta do preset que tenha
                 subpastas, editavel ou nao; o backend diz se ha estrutura
                 (campo tem_subpastas).
                 O terceiro botao (recarregar do disco) FOI EMBORA: a arvore se
                 atualiza sozinha por carimbo (regras.js::_regrasVigiarDisco).
                 Era o unico dos tres que pedia ao usuario um trabalho que o
                 programa sabe fazer. O componente de arvore documenta os tres
                 como obrigatorios; esta tela e a excecao registrada. -->
            <div class="regras-tree-actions hidden" id="regras-arvore-actions">
              <button class="btn-icon" id="btn-regras-expand-all" title="Expandir tudo">⊞</button>
              <button class="btn-icon" id="btn-regras-collapse-all" title="Retrair tudo">⊟</button>
            </div>
          </div>
        </div>
        <div class="regras-tree" id="regras-tree">
          <div class="regras-empty">Nenhum arquivo nesta pasta ainda.</div>
        </div>
      </div>

      <!-- Painel direito: editor -->
      <div class="regras-editor-panel" id="regras-editor-panel">

        <!-- Placeholder -->
        <div class="regras-placeholder" id="regras-placeholder">
          <span>Selecione um item para ver ou editar</span>
        </div>

        <!-- Editor -->
        <div class="regras-editor hidden" id="regras-editor">
          <div class="regras-editor-header">
            <span class="regras-editor-title" id="regras-editor-title"></span>
            <span id="regras-editor-selo"></span>
            <!-- Salvar deixou de ser o 💾 fixo do cabeçalho da árvore — cada
                 item aberto (regra estruturada, arquivo de instrução, arquivo
                 livre do Acervo) salva por aqui, de dentro do próprio editor.
                 Some inteiro quando o item é de leitura. -->
            <div class="regras-editor-header-acoes hidden" id="regras-editor-header-acoes">
              <button class="btn-icon" id="btn-regras-salvar" title="Salvar">💾</button>
              <button class="btn-icon hidden" id="btn-regras-deletar-item" title="Remover arquivo">✕</button>
            </div>
          </div>

          <!-- O UNICO modo de edicao, desde 04/09/2026. Existiam dois: este e
               um formulario de tres secoes (Descricao / Quando se aplica /
               Regra) com abas de arquivo, so para "Regras e instrucoes".
               Aquela sub-aba virou pasta comum e o formulario saiu junto —
               texto cru, para qualquer pasta do preset, editavel ou nao. -->
          <div class="regras-field regras-field-grow hidden" id="regras-campos-livre">
            <label class="regras-field-label" id="regras-label-livre">Conteúdo</label>
            <textarea class="regras-textarea" id="regras-editor-livre" placeholder="Markdown livre..."></textarea>
          </div>
        </div>

        <!-- Resultados de busca por conteúdo -->
        <div class="regras-search-results hidden" id="regras-search-results"></div>

      </div>
    </div>
  </div>
`;
