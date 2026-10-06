// ══════════════════════════════════════════════ TEMPLATE: Sub-aba Designer
// Markup estático da sub-aba "Designer" (Agentes). Extraído de index.html
// para manter o shell abaixo do limite de linhas da AMF.
//
// ⚠️ As classes da fileira de abas são PRÓPRIAS (`.designer-tabs-bar`,
// `.designer-tab-btn`, `.designer-tab-content`) e não as do Chat. `navegacao.js`
// fia as sub-abas do Chat com um `document.querySelectorAll('.chat-subtab-content')`
// GLOBAL, sem escopo: se o Designer usasse aquelas classes, clicar aqui apagaria
// os painéis do Chat, e um botão sem `data-chatsubtab` faria
// `getElementById(undefined)` estourar. É o mesmo motivo pelo qual a Fila tem
// `.fila-tab-*`. O ESTILO, esse sim, é compartilhado em `chat.css` — regra
// acrescentada, nunca copiada, senão as três telas divergem.
//
// A sidebar é só a lista de sessões: as sub-abas Estilos e Cores que moravam
// nela viraram duas das oito abas da fileira, em 2026-08-25.
document.getElementById('asubtab-designer').innerHTML = `
  <div class="designer-layout">

    <aside class="designer-sidebar">
      <div class="designer-sidebar-action">
        <button class="btn btn-special btn-sm btn-full" id="btn-new-design-chat">+ Nova sessão</button>
      </div>
      <div id="design-chat-list" class="design-chat-list"></div>
    </aside>

    <div class="designer-main">

      <div class="designer-tabs-bar"
           data-taborder-group="designer_subtabs"
           data-taborder-label="Abas do Designer"
           data-taborder-parent="asubtab-designer">
        <button class="designer-tab-btn active" data-dtab="dtab-designer">Designer</button>
        <button class="designer-tab-btn" data-dtab="dtab-contexto">Contexto</button>
        <button class="designer-tab-btn" data-dtab="dtab-selecao">Seleção</button>
        <button class="designer-tab-btn" data-dtab="dtab-estilos">Estilos</button>
        <button class="designer-tab-btn" data-dtab="dtab-cores">Cores</button>
        <button class="designer-tab-btn" data-dtab="dtab-tipografia">Tipografia</button>
        <button class="designer-tab-btn" data-dtab="dtab-texturas">Texturas</button>
        <button class="designer-tab-btn" data-dtab="dtab-animacoes">Animações</button>
      </div>

      <!-- ── Aba 1 · Designer ── -->
      <div class="designer-tab-content active" id="dtab-designer">

        <div class="designer-mode-bar">
          <span class="designer-mode-label">🎨 Designer</span>
          <!-- Os chips são gerados por designer-styles.js: são cinco dimensões,
               e escrever cinco blocos quase iguais aqui dessincronizaria na
               primeira que mudasse de rótulo. -->
          <div class="designer-chips" id="designer-chips"></div>
          <div class="designer-chip hidden" id="dchip-base">
            <span class="dchip-label">Base:</span>
            <span class="dchip-value" id="dchip-base-val">—</span>
            <span class="dchip-clear" id="dchip-base-clear" title="Remover base">✕</span>
          </div>
          <div class="designer-mode-right">
            <label class="dchip-label">Variações:</label>
            <select id="design-variation-count" class="designer-select">
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4" selected>4</option>
            </select>
            <span id="design-model-name" class="designer-model-display">Nenhum modelo</span>
            <button class="btn btn-muted btn-sm" id="btn-refresh-design-model" title="Atualizar modelo">⟳ Atualizar</button>
          </div>
        </div>

        <!-- Barra de rodadas: fica FORA de #design-messages de propósito. Dentro,
             rolaria junto com a conversa e deixaria de servir como barra. -->
        <div id="design-rodadas-bar" class="design-rodadas-bar hidden"></div>

        <div id="design-empty" class="design-empty">
          <p>Nenhuma sessão selecionada.</p>
          <p>Crie uma nova sessão para começar.</p>
        </div>
        <div id="design-messages" class="chat-messages hidden"></div>

        <div id="design-input-area" class="chat-input-area hidden">
          <!-- A mesma barra de janela de contexto que o Chat e a Fila têm acima
               do campo de envio, no mesmo lugar. Os ids são próprios porque as
               três telas podem estar montadas ao mesmo tempo. O detalhamento por
               bloco continua na aba Contexto; aqui é o resumo sempre à vista. -->
          <div class="design-input-tools">
            <div class="context-usage" title="Uso da janela de contexto do modelo">
              <div class="context-usage-bar"><div class="context-usage-fill" id="design-usage-fill"></div></div>
              <span class="context-usage-text" id="design-usage-text">—</span>
            </div>
          </div>
          <div class="chat-input-row">
            <textarea id="design-input" class="chat-textarea" placeholder="Descreva a interface que você quer gerar... (Enter envia, Shift+Enter nova linha)" rows="3"></textarea>
            <div class="chat-send-group">
              <!-- data-trava-ia: o Designer é uma das cinco pontas da trava, e
                   faltava só ele aqui. Sem isto dava para mandar gerar enquanto o
                   Chat, a Fila ou as Rotinas estavam usando a janela do LM Studio. -->
              <button class="btn btn-special" id="btn-send-design" data-trava-ia="designer">Gerar</button>
              <!-- O motivo ao lado do botão desabilitado: sem ele, parece defeito. -->
              <span class="trava-motivo hidden" data-trava-ia-motivo="designer"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Aba 2 · Contexto ── -->
      <div class="designer-tab-content hidden" id="dtab-contexto">
        <div class="dtab-rolagem" id="dctx-corpo"></div>
      </div>

      <!-- ── Aba 3 · Seleção ── -->
      <div class="designer-tab-content hidden" id="dtab-selecao">
        <div class="dtab-rolagem" id="dsel-corpo"></div>
      </div>

      <!-- ── Abas 4 a 8 · uma por dimensão ──
           O corpo de cada uma é montado por designer-dimensoes.js a partir da
           mesma função: cinco telas iguais escritas à mão divergiriam na
           primeira que ganhasse um controle. -->
      <div class="designer-tab-content hidden" id="dtab-estilos">
        <div class="dtab-rolagem" data-dimensao="estilos"></div>
      </div>
      <div class="designer-tab-content hidden" id="dtab-cores">
        <div class="dtab-rolagem" data-dimensao="cores"></div>
      </div>
      <div class="designer-tab-content hidden" id="dtab-tipografia">
        <div class="dtab-rolagem" data-dimensao="tipografia"></div>
      </div>
      <div class="designer-tab-content hidden" id="dtab-texturas">
        <div class="dtab-rolagem" data-dimensao="texturas"></div>
      </div>
      <div class="designer-tab-content hidden" id="dtab-animacoes">
        <div class="dtab-rolagem" data-dimensao="animacoes"></div>
      </div>

    </div>
  </div>
`;
