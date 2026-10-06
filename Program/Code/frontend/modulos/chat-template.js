// ══════════════════════════════════════════════ TEMPLATE: Aba Chat
// Markup estático da aba "Chat". Extraído de index.html para manter o shell
// abaixo do limite de linhas da AMF.
document.getElementById('tab-chat').innerHTML = `
  <div class="chat-layout">

    <aside class="chat-sidebar">
      <div class="chat-sidebar-header">
        <div class="chat-model-row">
          <span id="model-name" class="model-indicator">Carregando...</span>
          <button class="btn-refresh-model" id="btn-refresh-model" title="Atualizar modelo">⟳</button>
        </div>
        <button class="btn btn-positive btn-sm btn-full" id="btn-new-chat">+ Novo Chat</button>
      </div>
      <div id="chat-list" class="chat-list"></div>
    </aside>

    <div class="chat-main">
      <!-- Sub-abas: Chat / Contexto / Subagentes / Configuração / Ferramentas / Log.
           Sem emoji no rótulo: a barra de sub-abas do projeto é só texto. -->
      <div class="chat-subtabs-bar" data-taborder-group="chat_subtabs" data-taborder-label="Sub-abas de Chat" data-taborder-parent="tab-chat">
        <button class="chat-subtab-btn active" data-chatsubtab="chat-view-panel">Chat</button>
        <button class="chat-subtab-btn" data-chatsubtab="chat-payload-panel">Contexto</button>
        <button class="chat-subtab-btn" data-chatsubtab="chat-agentes-panel">Subagentes</button>
        <button class="chat-subtab-btn" data-chatsubtab="chat-config-panel">Configuração</button>
        <button class="chat-subtab-btn" data-chatsubtab="chat-ferramentas-panel">Ferramentas</button>
        <button class="chat-subtab-btn" data-chatsubtab="chat-log-panel">Log</button>
      </div>

      <!-- Sub-aba: Conversa -->
      <div id="chat-view-panel" class="chat-subtab-content active">
        <div id="chat-empty" class="chat-empty">
          <p>Nenhum chat selecionado.</p>
          <p>Crie um novo chat para começar.</p>
        </div>
        <!-- Ponto de encaixe \`chat.painel\` (fase 11): acima das mensagens,
             com ou sem chat aberto. Vazio, não ocupa pixel. -->
        <div id="chat-encaixe" class="xt-ponto"></div>
        <div id="chat-messages" class="chat-messages hidden"></div>
      </div>

      <!-- Sub-aba: Contexto -->
      <div id="chat-payload-panel" class="chat-subtab-content hidden">
        <div id="chat-payload-content" class="chat-payload-content">
          <p class="payload-empty">Nenhum envio ainda. Envie uma mensagem para ver o contexto completo.</p>
        </div>
        <div class="chat-payload-legend">
          <span class="legend-dot legend-user"></span><span>Usuário</span>
          <span class="legend-dot legend-assistant"></span><span>Chat</span>
          <span class="legend-dot legend-mode"></span><span>Prompt fixo</span>
          <span class="legend-dot legend-context"></span><span>Contexto (docs)</span>
          <span class="legend-dot legend-agent-injected"></span><span>Injetado por agente</span>
          <span class="legend-dot legend-sistema"></span><span>Aviso do sistema</span>
        </div>
      </div>

      <!-- Sub-aba: Subagentes — só os cards. A barra de parâmetros saiu daqui
           para a sub-aba Configuração; era ela que ficava presa no topo. -->
      <div id="chat-agentes-panel" class="chat-subtab-content hidden">
        <div class="chat-agentes-bulk-row">
          <button class="btn btn-muted" id="btn-agentes-ativar-todos">Ativar todos</button>
          <button class="btn btn-muted" id="btn-agentes-desativar-todos">Desativar todos</button>
        </div>
        <div id="chat-agentes-list" class="chat-agentes-list"></div>
      </div>

      <!-- Sub-aba: Configuração -->
      <div id="chat-config-panel" class="chat-subtab-content hidden">
        <div class="subagentes-config-grupo">
          <h4 class="subagentes-config-titulo">Quanto tempo a resposta pode durar</h4>
          <div class="subagentes-config-row">
            <div class="subagentes-config-linha">
              <label for="subagentes-max-rodadas">Máximo de rodadas de chamadas de subagentes por mensagem</label>
              <input type="number" id="subagentes-max-rodadas" min="1" max="9" step="1" value="2" />
            </div>
          </div>
          <p class="subagentes-config-nota">Este valor vale para esta conversa.</p>
        </div>
        <div id="chat-config-global"></div>
      </div>

      <!-- Sub-aba: Ferramentas (só leitura) -->
      <div id="chat-ferramentas-panel" class="chat-subtab-content hidden"></div>

      <!-- Sub-aba: Log -->
      <div id="chat-log-panel" class="chat-subtab-content hidden">
        <div id="chat-log-content" class="chat-log-content">
          <p class="chat-log-empty">Nenhuma atividade ainda.</p>
        </div>
        <!-- Barra de tokens dos subagentes — separada da legenda de propósito:
             a de baixo já tem 16 itens e não cabe mais nada. Ordem fixa:
             rótulo → TOTAL → um par ↑/↓ por subagente que rodou.
             O chat NÃO entra: ele tem barra própria, com teto de janela. -->
        <!-- O rodapé do Log: os dois botões de expandir/retrair à ESQUERDA da
             barra de tokens, na mesma linha. Escritos aqui no template, e não
             injetados por JS: o rodapé é markup fixo, e injetar exigiria um
             ponto de entrada só para isto.
             ⚠ Nasce com flex-shrink: 0 (em chat.css), ou o conteúdo do log
             esmaga a linha inteira quando a conversa cresce.
             ⚠ Nada de crase neste comentário: o arquivo inteiro é um template
             literal, e uma crase aqui fecha a string no meio. -->
        <div class="chat-log-rodape">
          <div class="chat-log-acoes hidden" id="chat-log-acoes">
            <button class="btn-icon" id="btn-chat-log-expandir" title="Expandir tudo">&#8862;</button>
            <button class="btn-icon" id="btn-chat-log-retrair" title="Retrair tudo">&#8863;</button>
          </div>
          <div class="chat-log-tokens" id="chat-log-tokens">
            <span class="chat-log-tokens-rotulo">Tokens dos subagentes</span>
            <span class="chat-log-tokens-vazio">nenhum subagente rodou ainda</span>
          </div>
        </div>
        <div class="chat-payload-legend">
          <span class="legend-dot legend-user"></span><span>Usuário</span>
          <span class="legend-dot legend-assistant"></span><span>Chat</span>
          <span class="legend-dot legend-buscador"></span><span>Buscador</span>
          <span class="legend-dot legend-navegador"></span><span>Navegador</span>
          <span class="legend-dot legend-leitor"></span><span>Leitor</span>
          <span class="legend-dot legend-arquiteto"></span><span>Arquiteto</span>
          <span class="legend-dot legend-analista"></span><span>Analista</span>
          <span class="legend-dot legend-semantico"></span><span>Semântico</span>
          <span class="legend-extensoes" id="chat-legenda-extensoes"></span>
          <span class="legend-dot legend-estruturar"></span><span>Estruturar</span>
          <span class="legend-dot legend-estruturar-e-quebrar-tarefa"></span><span>Estruturar e quebrar tarefa</span>
          <span class="legend-dot legend-revisar"></span><span>Revisar</span>
          <span class="legend-dot legend-sistema"></span><span>Aviso do sistema</span>
        </div>
      </div>

      <!-- Área de input (sempre visível quando chat ativo) -->
      <div id="chat-input-area" class="chat-input-area hidden">
        <div class="chat-toolbar">
          <div class="ctx-inicial-wrap" id="prompt-fixo-wrap">
            <button class="btn-ctx-inicial" id="btn-prompt-fixo">Nenhum ▾</button>
            <div class="ctx-inicial-panel prompt-fixo-panel hidden" id="prompt-fixo-panel">
              <button class="prompt-fixo-option ativo" data-prompt-fixo="">Nenhum</button>
              <button class="prompt-fixo-option" data-prompt-fixo="estruturar">Estruturar</button>
              <button class="prompt-fixo-option" data-prompt-fixo="estruturar-e-quebrar-tarefa">Estruturar e quebrar tarefa</button>
              <button class="prompt-fixo-option" data-prompt-fixo="revisar">Revisar</button>
            </div>
          </div>
          <div class="ctx-inicial-wrap" id="ctx-inicial-wrap">
            <button class="btn-ctx-inicial" id="btn-ctx-inicial">Contexto inicial ▾</button>
            <div class="ctx-inicial-panel hidden" id="ctx-inicial-panel">
              <table class="ctx-inicial-table">
                <thead>
                  <tr><th></th><th>Tokens</th><th>Linhas</th><th>Arquivos</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><label class="chat-context-checkbox"><input type="checkbox" id="ctx-pipeline" value="pipeline"><span>Pipeline</span></label></td>
                    <td class="ctx-stat" id="ctx-pipeline-tokens">—</td>
                    <td class="ctx-stat" id="ctx-pipeline-linhas">—</td>
                    <td class="ctx-stat" id="ctx-pipeline-arquivos">—</td>
                  </tr>
                  <tr>
                    <td><label class="chat-context-checkbox"><input type="checkbox" id="ctx-indice-navegacao" value="indice-navegacao"><span>Índice</span></label></td>
                    <td class="ctx-stat" id="ctx-indice-navegacao-tokens">—</td>
                    <td class="ctx-stat" id="ctx-indice-navegacao-linhas">—</td>
                    <td class="ctx-stat" id="ctx-indice-navegacao-arquivos">—</td>
                  </tr>
                  <tr>
                    <td><label class="chat-context-checkbox"><input type="checkbox" id="ctx-resumo-pastas" value="resumo-pastas"><span>Resumo de Pastas</span></label></td>
                    <td class="ctx-stat" id="ctx-resumo-pastas-tokens">—</td>
                    <td class="ctx-stat" id="ctx-resumo-pastas-linhas">—</td>
                    <td class="ctx-stat" id="ctx-resumo-pastas-arquivos">—</td>
                  </tr>
                  <tr>
                    <td><label class="chat-context-checkbox"><input type="checkbox" id="ctx-documentacao-tecnica" value="documentacao-tecnica"><span>Doc. Técnica</span></label></td>
                    <td class="ctx-stat" id="ctx-documentacao-tecnica-tokens">—</td>
                    <td class="ctx-stat" id="ctx-documentacao-tecnica-linhas">—</td>
                    <td class="ctx-stat" id="ctx-documentacao-tecnica-arquivos">—</td>
                  </tr>
                  <tr>
                    <td><label class="chat-context-checkbox"><input type="checkbox" id="ctx-grafo-imports" value="grafo-imports"><span>Grafo de Imports</span></label></td>
                    <td class="ctx-stat" id="ctx-grafo-imports-tokens">—</td>
                    <td class="ctx-stat" id="ctx-grafo-imports-linhas">—</td>
                    <td class="ctx-stat" id="ctx-grafo-imports-arquivos">—</td>
                  </tr>
                  <!-- Manda o CONTEÚDO inteiro da base de Regras e instruções. É o
                       caminho que não depende de subagente nem de extensão. Os
                       números ao lado são a proteção — você vê o peso antes de
                       marcar. A linha "Convenções" saiu: era campo visual sem
                       lógica nenhuma. -->
                  <tr>
                    <td><label class="chat-context-checkbox"><input type="checkbox" id="ctx-regras" value="regras"><span>Regras e instruções</span></label></td>
                    <td class="ctx-stat" id="ctx-regras-tokens">—</td>
                    <td class="ctx-stat" id="ctx-regras-linhas">—</td>
                    <td class="ctx-stat" id="ctx-regras-arquivos">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <span class="ctx-tokens-total" id="ctx-tokens-total" title="Contexto inicial total">—</span>
          <button class="btn-copy-payload" id="btn-copy-payload" title="Copiar contexto inicial">📋</button>
          <div class="context-usage" title="Uso da janela de contexto do modelo">
            <div class="context-usage-bar"><div class="context-usage-fill" id="context-usage-fill"></div></div>
            <span class="context-usage-text" id="context-usage-text">—</span>
          </div>
        </div>
        <div class="chat-input-row">
          <textarea id="chat-input" class="chat-textarea" placeholder="Digite sua mensagem... (Enter envia, Shift+Enter nova linha)" rows="3"></textarea>
          <div class="chat-send-group">
            <button class="btn btn-primary" id="btn-send-chat" data-trava-ia="chat">Enviar</button>
            <!-- O motivo escrito ao lado do botão desabilitado: sem ele, o
                 botão apagado parece defeito do programa. -->
            <span class="trava-motivo hidden" data-trava-ia-motivo="chat"></span>
          </div>
        </div>
      </div>
    </div>

  </div>
`;

// As duas sub-abas novas são montadas por `agentes/subagentes-config-tab.js`,
// que é compartilhado com a Fila — o markup delas é o mesmo nas duas telas.
if (typeof subagentesConfigMarkup === 'function') {
  document.getElementById('chat-config-global').innerHTML = subagentesConfigMarkup('chat');
  document.getElementById('chat-ferramentas-panel').innerHTML = subagentesFerramentasMarkup('chat');
}
