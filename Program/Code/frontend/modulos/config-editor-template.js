// ══════════════════════════════ Configurações → Editor (markup) ══
// Os cartões da categoria "Editor". Segue o molde de `config-render-template.js`:
// só markup, `registrarCategoriaConfig` no topo, zero lógica — quem lê e grava
// é `config-editor.js`.
//
// ⚠️ O botão "Restaurar padrão" NÃO está escrito aqui, e não deve estar:
// `registrarCategoriaConfig` o injeta sozinha (`padrao: true` é o default). O
// `acoes` leva só o Salvar.
//
// ⚠️ A posição desta categoria no trilho é a posição da tag <script> em
// index.html, não uma propriedade daqui.
(function () {
  if (typeof registrarCategoriaConfig !== 'function') return;
  registrarCategoriaConfig({
    chave: 'editor',
    rotulo: 'Editor de código',
    // Glifo monocromático, nunca emoji — e nenhum dos treze já em uso.
    icone: '▤',
    resumo: 'a aba Editor: botões, texto e histórico',
    conteudo: `
      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Botões da barra do arquivo</div>
          <p class="config-cartao-dica">
            Quais botões aparecem ao lado do nome do arquivo aberto. Desligar um
            botão não desliga a função: os atalhos de teclado continuam valendo,
            e são eles que o rodapé do Editor mostra.
          </p>
        </div>
        <div class="config-field-row">
          <label class="config-check"><input type="checkbox" id="cfg-editor-botao-salvar">
            Salvar <span class="config-unidade">(Ctrl+S)</span></label>
        </div>
        <div class="config-field-row">
          <label class="config-check"><input type="checkbox" id="cfg-editor-botao-desfazer">
            Desfazer e refazer <span class="config-unidade">(Ctrl+Z e Ctrl+Shift+Z)</span></label>
        </div>
        <div class="config-field-row">
          <label class="config-check"><input type="checkbox" id="cfg-editor-botao-buscar">
            Buscar no arquivo <span class="config-unidade">(Ctrl+F)</span></label>
        </div>
        <div class="config-field-row">
          <label class="config-check"><input type="checkbox" id="cfg-editor-botao-historico">
            Histórico local</label>
          <p class="config-nota">Sem atalho de teclado — desligado, o painel do
            histórico deixa de ter por onde abrir.</p>
        </div>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Texto do código</div>
          <p class="config-cartao-dica">
            Vale para os dois painéis do Editor e para a pré-visualização do
            Histórico local, sempre juntos.
          </p>
        </div>
        <div class="config-grade">
          <div class="config-field-row">
            <label for="cfg-editor-fonte">Tamanho da fonte
              <span class="config-unidade">px</span></label>
            <input type="number" id="cfg-editor-fonte" min="9" max="24" step="0.5">
          </div>
          <div class="config-field-row">
            <label for="cfg-editor-entrelinha">Altura da linha
              <span class="config-unidade">× a fonte</span></label>
            <input type="number" id="cfg-editor-entrelinha" min="1.2" max="2.2" step="0.05">
          </div>
          <div class="config-field-row">
            <label for="cfg-editor-tabulacao">Tabulação
              <span class="config-unidade">espaços</span></label>
            <input type="number" id="cfg-editor-tabulacao" min="1" max="8" step="1">
            <p class="config-nota">Vale para os dois lados: quanto a tecla Tab
              insere, e a largura com que um Tab já existente no arquivo é
              desenhado.</p>
          </div>
        </div>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Colorização</div>
          <p class="config-cartao-dica">
            O código é colorido por linguagem. Em arquivo muito grande a
            coloração é desligada sozinha para o editor não travar — quem
            desenha é um analisador por expressão regular, e ele relê o arquivo
            inteiro a cada pausa na digitação.
          </p>
        </div>
        <div class="config-field-row">
          <label for="cfg-editor-teto-cor">Desligar a cor acima de
            <span class="config-unidade">linhas</span></label>
          <input type="number" id="cfg-editor-teto-cor" min="200" max="50000" step="100">
          <p class="config-nota">Mesmo desligada, um botão na faixa do arquivo
            permite colorir assim mesmo.</p>
        </div>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Histórico local</div>
          <p class="config-cartao-dica">
            A cada Ctrl+S o Editor guarda uma cópia de como o arquivo estava
            <em>antes</em>. Não é backup e não é o Ctrl+Z: as Versões da aba
            Backups são o projeto inteiro, e o Ctrl+Z é a digitação da sessão.
            As cópias ficam em <code>Editor/Histórico local/</code>, dentro dos
            dados de cada projeto.
          </p>
        </div>
        <div class="config-field-row">
          <label class="config-check"><input type="checkbox" id="cfg-editor-hist-ligado">
            Guardar o histórico local</label>
        </div>
        <div class="config-field-row">
          <label class="config-check"><input type="checkbox" id="cfg-editor-hist-so-se-mudou">
            Só guardar se o conteúdo mudou</label>
          <p class="config-nota">Desligado, um Ctrl+S por hábito cria uma cópia
            idêntica à anterior e empurra as boas para fora do teto.</p>
        </div>
        <div class="config-field-row">
          <label class="config-check"><input type="checkbox" id="cfg-editor-hist-diff">
            Mostrar diff visual ao comparar versões</label>
        </div>
        <div class="config-grade">
          <div class="config-field-row">
            <label for="cfg-editor-hist-entradas">Cópias por arquivo</label>
            <input type="number" id="cfg-editor-hist-entradas" min="1" max="200" step="1">
          </div>
          <div class="config-field-row">
            <label for="cfg-editor-hist-dias">Prazo
              <span class="config-unidade">dias</span></label>
            <input type="number" id="cfg-editor-hist-dias" min="0" max="3650" step="1">
            <p class="config-nota">0 = sem prazo.</p>
          </div>
          <div class="config-field-row">
            <label for="cfg-editor-hist-mb">Espaço máximo
              <span class="config-unidade">MB</span></label>
            <input type="number" id="cfg-editor-hist-mb" min="0" max="10000" step="10">
            <p class="config-nota">0 = sem teto.</p>
          </div>
        </div>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Ajudas visuais no código</div>
          <p class="config-cartao-dica">
            Elementos que ocupam espaço de tela ou custam processamento. Desligar
            um não desliga a função por trás — só some o elemento visual.
          </p>
        </div>
        <div class="config-field-row">
          <label class="config-check"><input type="checkbox" id="cfg-editor-minimapa">
            Minimapa</label>
        </div>
        <div class="config-field-row">
          <label class="config-check"><input type="checkbox" id="cfg-editor-breadcrumb">
            Migalhas de pão <span class="config-unidade">(caminho acima das abas)</span></label>
        </div>
        <div class="config-field-row">
          <label class="config-check"><input type="checkbox" id="cfg-editor-caminho-barra">
            Nome e caminho na barra do arquivo</label>
          <p class="config-nota">Repete o que as migalhas de pão já mostram — desligue se as
            duas juntas parecerem redundantes.</p>
        </div>
        <div class="config-field-row">
          <label class="config-check"><input type="checkbox" id="cfg-editor-lint">
            Sinalizar erro de sintaxe na linha</label>
        </div>
      </div>`,
    acoes: '<button class="btn btn-positive" id="btn-save-editor">Salvar o Editor</button>',
  });
})();
