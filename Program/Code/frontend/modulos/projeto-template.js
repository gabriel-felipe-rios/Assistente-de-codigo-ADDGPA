// ══════════════════════════════════════════════ TEMPLATE: Aba Projeto
// Markup estático da aba "Projeto" (Trabalho / Preparar projeto / Remover /
// Contexto sem leitura / Resumo indexado / Resumo completo).
// Extraído de index.html para manter o shell abaixo do limite de linhas da AMF.
//
// ⚠️ A ORDEM DOS PAINÉIS TEM DE BATER COM A DOS BOTÕES. `resetToFirstTab`
// (navegacao.js) casa os dois por ÍNDICE no DOM, e não por `data-subtab`:
// mover um botão sem mover o painel acende "Trabalho" mostrando o Resumo.
//
// Trabalho vem primeiro porque a ordem antiga abria num Resumo de um projeto
// que ainda não tinha sido configurado. É só a ordem INICIAL — "Ordem das abas"
// continua deixando o usuário mudar.

// As duas sub-abas de resumo são a MESMA tela, byte a byte — o que muda é só o
// conjunto de dados que as alimenta (ver resumo.js). Por isso o markup delas sai
// de uma função só: duas cópias divergiriam na primeira manutenção.
function _resumoPainel(chave, titulo) {
  return `
  <div class="subtab-content hidden" id="subtab-resumo-${chave}">
    <div class="stats-strip">
      <div class="stat-cell">
        <span class="stat-label">Pastas</span>
        <span class="stat-value" id="stat-folders-${chave}">—</span>
      </div>
      <div class="stat-cell">
        <span class="stat-label">Arquivos</span>
        <span class="stat-value" id="stat-files-${chave}">—</span>
      </div>
      <div class="stat-cell">
        <span class="stat-label">Linhas de código</span>
        <span class="stat-value" id="stat-lines-${chave}">—</span>
      </div>
      <div class="stat-cell stat-cell--grow">
        <span class="stat-label">Linguagens</span>
        <div class="lang-chips" id="stat-langs-${chave}"><span class="stat-vazio">—</span></div>
      </div>
      <!-- Dropdown informativo (ver Padrões de interface → Componentes). A lista
           de extensões é longa demais para a faixa, então fica atrás de um
           clique — mas os números já vêm prontos da mesma varredura. -->
      <div class="stat-cell">
        <div class="ctx-inicial-wrap" id="resumo-ext-wrap-${chave}">
          <button class="btn-ctx-inicial" type="button" id="btn-resumo-ext-${chave}">Extensões &#9662;</button>
          <div class="ctx-inicial-panel ctx-inicial-panel--abaixo ctx-inicial-panel--direita resumo-ext-panel hidden"
               id="resumo-ext-panel-${chave}"></div>
        </div>
      </div>
    </div>

    <div class="resumo-arvore-painel">
      <div class="arvp-barra">
        <span class="arvp-barra-titulo">${titulo}</span>
        <label class="resumo-opcao" for="resumo-colunas-${chave}"
               title="Preenche a largura da tela em vez de uma coluna só">
          <input type="checkbox" id="resumo-colunas-${chave}" checked>
          <span>Colunas</span>
        </label>
        <label class="resumo-profundidade" for="resumo-depth-${chave}">
          <span class="resumo-profundidade-rotulo">Profundidade</span>
          <input type="range" class="resumo-depth-slider" id="resumo-depth-${chave}"
                 min="1" max="4" value="4" disabled>
          <span class="resumo-profundidade-valor" id="resumo-depth-val-${chave}">4</span>
        </label>
        <button class="btn-icon" id="btn-resumo-${chave}-expand-all"   title="Expandir tudo">⊞</button>
        <button class="btn-icon" id="btn-resumo-${chave}-collapse-all" title="Retrair tudo">⊟</button>
      </div>
      <!-- Dois elementos de propósito: quem rola é o de fora, quem se divide em
           colunas é o de dentro. Juntos num elemento só, a altura fixa do
           scroller faria as colunas transbordarem para a direita em vez de o
           conteúdo crescer para baixo. -->
      <div class="resumo-arvore-scroll" id="resumo-arvore-scroll-${chave}">
        <div class="arvore-pastas--colunas" id="resumo-arvore-${chave}"></div>
      </div>
    </div>
  </div>`;
}

// Remover e Contexto sem leitura são o MESMO componente (D46): a Estrutura do
// projeto à esquerda, a lista à direita. O comportamento mora em
// `projeto-caminhos.js`; o que muda de uma lista para a outra, em
// `remover.js` e `contexto.js`. Os ids de «＋ Adicionar ▾» são os de sempre —
// `navegacao.js` os liga.
function _caminhosPainel(chave, titulo, nota, ids) {
  return `
  <div class="subtab-content subtab-content--panels hidden" id="subtab-${chave}">
    <div class="pcam-corpo">
      <div class="pcam-lateral">
        <div class="pcam-lat-cab">
          <span class="pcam-lat-titulo">Estrutura</span>
          <button class="btn-icon" id="btn-pcam-${chave}-expand-all" title="Expandir tudo">⊞</button>
          <button class="btn-icon" id="btn-pcam-${chave}-collapse-all" title="Retrair tudo">⊟</button>
        </div>
        <div class="pcam-arvore" id="pcam-${chave}-estrutura"></div>
      </div>
      <div class="pcam-principal" id="pcam-${chave}-principal">
        <div class="pcam-cab">
          <h3>${titulo}</h3>
          <div class="dropdown-wrap">
            <button class="btn btn-primary btn-sm" id="${ids.toggle}">＋ Adicionar ▾</button>
            <div class="dropdown-menu hidden" id="${ids.menu}">
              <div class="dropdown-opt" id="${ids.pasta}">📁 Pasta</div>
              <div class="dropdown-opt" id="${ids.arquivo}">📄 Arquivo</div>
            </div>
          </div>
        </div>
        <p class="pcam-nota">${nota} O mesmo caminho pode estar nas duas listas.</p>
        <p class="pcam-nota">O campo <b>Mesmo assim, pode ler</b> de cada item abre uma exceção para 🖥️ o LM Studio (o chat interno) ou 🤖 o assistente externo. Por padrão, nenhum dos dois.</p>
        <div class="pcam-soltar" id="pcam-${chave}-soltar">Arraste uma pasta ou um arquivo da Estrutura para cá</div>
        <div class="pcam-legenda">
          <span><i class="pcam-ponto pcam-ponto--arvore"></i>pasta com subpastas</span>
          <span><i class="pcam-ponto pcam-ponto--pasta"></i>só a pasta</span>
          <span><i class="pcam-ponto pcam-ponto--arquivo"></i>arquivo</span>
        </div>
        <div class="pcam-lista" id="pcam-${chave}-lista"></div>
      </div>
    </div>
  </div>`;
}

document.getElementById('tab-projeto').innerHTML = `
  <div class="subtabs-bar" data-taborder-group="projeto_subtabs" data-taborder-label="Sub-abas de Projeto" data-taborder-parent="tab-projeto">
    <button class="subtab-btn active" data-subtab="subtab-trabalho">Trabalho</button>
    <button class="subtab-btn"        data-subtab="subtab-preparar">Preparar projeto</button>
    <button class="subtab-btn"        data-subtab="subtab-remover">Remover</button>
    <button class="subtab-btn"        data-subtab="subtab-contexto">Contexto sem leitura</button>
    <button class="subtab-btn"        data-subtab="subtab-resumo-indexado">Resumo indexado</button>
    <button class="subtab-btn"        data-subtab="subtab-resumo-completo">Resumo completo</button>
  </div>

  <!-- Trabalho -->
  <div class="subtab-content active" id="subtab-trabalho">
    <div class="workspace-section drop-section" id="section-root">
      <div class="workspace-section-header">
        <span>Pasta raiz <span class="section-desc">(pasta mãe do projeto — onde tudo está contido)</span></span>
        <button class="btn btn-primary btn-sm" id="btn-browse-root">Selecionar pasta</button>
      </div>
      <div id="root-folder-display" class="folder-display hidden"></div>
      <div class="drop-hint">Arraste uma pasta aqui</div>
    </div>
    <div class="workspace-section drop-section" id="section-working">
      <div class="workspace-section-header">
        <span>Pastas de trabalho <span class="section-desc">(pastas com o código-fonte do projeto)</span></span>
        <button class="btn btn-primary btn-sm" id="btn-add-working">+ Adicionar pasta</button>
      </div>
      <div id="working-folders-list" class="path-list"></div>
      <div class="drop-hint">Arraste pastas aqui</div>
    </div>
    <div class="workspace-section drop-section" id="section-main-file">
      <div class="workspace-section-header">
        <span>Arquivo principal <span class="section-desc">(arquivo que inicia o programa)</span></span>
        <button class="btn btn-primary btn-sm" id="btn-browse-main-file">Selecionar arquivo</button>
      </div>
      <div id="main-file-display" class="folder-display hidden"></div>
      <button class="btn btn-muted btn-sm main-file-clear hidden" id="btn-clear-main-file">✕ Remover</button>
      <div class="drop-hint">Arraste o arquivo de entrada do programa aqui</div>
    </div>
  </div>

  <!-- Preparar projeto -->
  <!-- Vazio de propósito: quem preenche é o preparar-template.js, logo depois
       deste arquivo no index.html. O painel saiu da aba Arquivos e chegou aqui,
       depois de Trabalho — que é onde a pasta raiz é definida, e sem raiz o
       Preparar não roda. (Sem crase neste comentário: ele mora dentro de um
       template literal, e a crase fecharia a string.) -->
  <div class="subtab-content hidden" id="subtab-preparar"></div>

  <!-- Remover e Contexto sem leitura: o mesmo componente (projeto-caminhos.js). -->
  ${_caminhosPainel('remover', 'Remover',
    'Some do programa inteiro, sem aviso: não é lido, não conta e não é documentado. O Editor continua mostrando.',
    { toggle: 'btn-add-ignore-toggle', menu: 'add-ignore-menu',
      pasta: 'btn-add-ignore', arquivo: 'btn-add-ignore-file' })}
  ${_caminhosPainel('contexto', 'Contexto sem leitura',
    'Não é lido: quem pede o arquivo recebe a <b>descrição</b> que você escreveu. Vale sempre com as subpastas.',
    { toggle: 'btn-add-context-toggle', menu: 'add-context-menu',
      pasta: 'btn-add-context', arquivo: 'btn-add-context-file' })}
  ${_resumoPainel('indexado', 'Estrutura indexada')}
  ${_resumoPainel('completo', 'Estrutura completa')}

`;
