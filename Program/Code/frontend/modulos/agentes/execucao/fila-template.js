// ══════════════════════════════════════════════ TEMPLATE: Sub-aba Fila
// Markup estático da sub-aba "Fila" (Assistente).
//
// Esta tela É a do Chat. Não "parecida com": a estrutura é a mesma de
// `modulos/chat-template.js`, elemento por elemento, com as mesmas classes.
// São a mesma coisa com horizontes de tempo diferentes, e duas telas para a
// mesma ideia obrigavam a reaprender a segunda.
//
// ⚠ A ÚNICA exceção são as classes de sub-aba: `.fila-tabs-bar`,
// `.fila-tab-btn` e `.fila-tab-content` em vez das `.chat-subtab-*`. Não é
// capricho — `navegacao.js` fia as sub-abas do Chat com um
// `document.querySelectorAll('.chat-subtab-content')` GLOBAL, sem escopo; se a
// Fila usasse a classe do Chat, clicar numa sub-aba de lá apagaria os painéis
// daqui. O estilo é compartilhado mesmo assim: as três entram como seletor
// adicional nas próprias regras do Chat, em `estilos/chat.css`.
//
// A primeira sub-aba leva o nome do agente principal ("Fila"), como no Chat.
document.getElementById('asubtab-fila').innerHTML = `
  <div class="chat-layout">

    <aside class="chat-sidebar">
      <div class="chat-sidebar-header">
        <div class="chat-model-row">
          <span id="fila-model-name" class="model-indicator">Carregando...</span>
          <button class="btn-refresh-model" id="btn-fila-refresh-model" title="Atualizar modelo">⟳</button>
        </div>
        <!-- Dois botões, e não um: "+ Nova tarefa" SÓ escreve; quem põe as
             tarefas para rodar é o de baixo. Separar os dois é o que permite
             montar a fila inteira antes de sair de perto. -->
        <button class="btn btn-positive btn-sm btn-full" id="btn-fila-nova">+ Nova tarefa</button>
        <button class="btn btn-primary btn-sm btn-full" id="btn-fila-iniciar" data-trava-ia="fila">&#9654; Iniciar tarefas</button>
        <!-- O motivo ao lado do botão desabilitado: sem ele, parece defeito. -->
        <span class="trava-motivo hidden" data-trava-ia-motivo="fila"></span>
        <button class="btn btn-muted btn-sm btn-full hidden" id="btn-fila-cancelar">Cancelar</button>
        <span id="fila-status-badge" class="fila-status-badge hidden"></span>
      </div>
      <div id="fila-lista" class="chat-list"></div>
    </aside>

    <div class="chat-main">
      <div class="fila-tabs-bar" data-taborder-group="fila_subtabs" data-taborder-label="Sub-abas da Fila" data-taborder-parent="asubtab-fila">
        <button class="fila-tab-btn active" data-ftab="ftab-fila">Fila</button>
        <button class="fila-tab-btn" data-ftab="ftab-contexto">Contexto</button>
        <button class="fila-tab-btn" data-ftab="ftab-subagentes">Subagentes</button>
        <button class="fila-tab-btn" data-ftab="ftab-config">Configuração</button>
        <button class="fila-tab-btn" data-ftab="ftab-ferramentas">Ferramentas</button>
        <button class="fila-tab-btn" data-ftab="ftab-log">Log</button>
      </div>

      <!-- Sub-aba: Fila (a pesquisa como conversa) -->
      <div id="ftab-fila" class="fila-tab-content active">
        <div id="fila-frescor-aviso" class="fila-frescor-aviso hidden"></div>
        <div id="fila-empty" class="chat-empty">
          <p>Nenhuma tarefa selecionada.</p>
          <p>Crie uma nova tarefa para começar.</p>
        </div>
        <!-- Ponto de encaixe \`fila.painel\` (fase 11): acima das mensagens.
             Id próprio da Fila — nunca o do Chat. -->
        <div id="fila-encaixe" class="xt-ponto"></div>
        <div id="fila-chat-messages" class="chat-messages hidden"></div>
      </div>

      <!-- Sub-aba: Contexto -->
      <div id="ftab-contexto" class="fila-tab-content hidden">
        <div id="fila-contexto-content" class="chat-payload-content">
          <p class="payload-empty">Nenhum envio ainda. Inicie a tarefa para ver o contexto completo.</p>
        </div>
        <div class="chat-payload-legend">
          <span class="legend-dot legend-user"></span><span>Tarefa</span>
          <span class="legend-dot legend-assistant"></span><span>Fila</span>
          <span class="legend-dot legend-mode"></span><span>Prompt fixo</span>
          <span class="legend-dot legend-agent-injected"></span><span>Resultado de subagentes</span>
          <span class="legend-dot legend-sistema"></span><span>Aviso do sistema</span>
        </div>
      </div>

      <!-- Sub-aba: Subagentes — só os cards. A barra de parâmetros saiu daqui
           para a sub-aba Configuração. -->
      <div id="ftab-subagentes" class="fila-tab-content hidden">
        <div class="chat-agentes-bulk-row">
          <button class="btn btn-muted" id="btn-fila-agentes-ativar-todos">Ativar todos</button>
          <button class="btn btn-muted" id="btn-fila-agentes-desativar-todos">Desativar todos</button>
        </div>
        <div id="fila-agentes-list" class="chat-agentes-list"></div>
      </div>

      <!-- Sub-aba: Configuração -->
      <div id="ftab-config" class="fila-tab-content hidden">
        <div class="subagentes-config-grupo">
          <h4 class="subagentes-config-titulo">Quanto tempo a tarefa pode durar</h4>
          <div class="subagentes-config-row">
            <div class="subagentes-config-linha">
              <label for="fila-max-rodadas">Máximo de rodadas de chamadas de subagentes por tarefa</label>
              <input type="number" id="fila-max-rodadas" min="1" max="99" step="1" value="30" />
            </div>
            <div class="subagentes-config-linha">
              <label for="fila-devolucoes">Devoluções do Verificador antes de entregar assim mesmo</label>
              <input type="number" id="fila-devolucoes" min="1" max="9" step="1" value="3" />
            </div>
            <div class="subagentes-config-linha">
              <label for="fila-max-voltas">Máximo de voltas ao modelo por tarefa (cinto de segurança)</label>
              <input type="number" id="fila-max-voltas" min="10" max="999" step="1" value="120" />
            </div>
          </div>
          <p class="subagentes-config-nota">Estes três são gravados junto da tarefa, quando ela entra em jogo — mudar aqui não muda a regra de uma tarefa que já está esperando a vez.</p>
          <p class="subagentes-config-nota">A volta ao modelo conta toda ida ao LM Studio, inclusive as que não gastam rodada de subagentes. Não é tempo: uma tarefa que demora três horas e faz 40 voltas passa.</p>
        </div>
        <div id="fila-config-global"></div>
      </div>

      <!-- Sub-aba: Ferramentas (só leitura). NÃO é cópia da do Chat: a Fila tem
           o Verificador, que o Chat não tem. -->
      <div id="ftab-ferramentas" class="fila-tab-content hidden"></div>

      <!-- Sub-aba: Log.
           A ordem vertical aqui é a mesma do Log do Chat, e é ela que gruda a
           barra de tokens e a legenda no rodapé: um conteúdo com flex:1 em
           cima, e os dois com flex-shrink:0 embaixo. Fora do painel, como
           estavam antes, as duas subiam junto com o conteúdo. -->
      <div id="ftab-log" class="fila-tab-content hidden">
        <div id="fila-log-content" class="chat-log-content">
          <p class="chat-log-empty">Nenhuma atividade ainda.</p>
        </div>
        <!-- Mesmo rodapé do Chat, com os ids próprios da Fila. Ver o comentário
             em chat-template.js. -->
        <div class="chat-log-rodape">
          <div class="chat-log-acoes hidden" id="fila-log-acoes">
            <button class="btn-icon" id="btn-fila-log-expandir" title="Expandir tudo">&#8862;</button>
            <button class="btn-icon" id="btn-fila-log-retrair" title="Retrair tudo">&#8863;</button>
          </div>
          <div class="chat-log-tokens" id="fila-log-tokens">
            <span class="chat-log-tokens-rotulo">Tokens dos subagentes</span>
            <span class="chat-log-tokens-vazio">nenhum subagente rodou ainda</span>
          </div>
        </div>
        <div class="chat-payload-legend">
          <span class="legend-dot legend-user"></span><span>Você</span>
          <span class="legend-dot legend-fila"></span><span>Fila</span>
          <span class="legend-dot legend-buscador"></span><span>Buscador</span>
          <span class="legend-dot legend-navegador"></span><span>Navegador</span>
          <span class="legend-dot legend-leitor"></span><span>Leitor</span>
          <span class="legend-dot legend-arquiteto"></span><span>Arquiteto</span>
          <span class="legend-dot legend-analista"></span><span>Analista</span>
          <span class="legend-dot legend-semantico"></span><span>Semântico</span>
          <span class="legend-extensoes" id="fila-legenda-extensoes"></span>
          <span class="legend-dot legend-fila-verificador"></span><span>Verificador</span>
          <span class="legend-dot legend-sistema"></span><span>Aviso do sistema</span>
        </div>
      </div>

      <!-- Área de envio — irmã dos painéis, como no Chat.
           Sem o seletor de contexto inicial: ele é do Chat, e a função que o
           monta tem os ids dele gravados dentro. O prompt fixo a Fila tem,
           mas com ids próprios e uma lista de opções própria: as do Chat são
           feitas para conversa curta. -->
      <div id="fila-input-area" class="chat-input-area hidden">
        <div class="chat-toolbar">
          <!-- Prompt fixo da Fila. Mesmas CLASSES do Chat (o estilo já existe
               em chat.css e é genérico), ids DIFERENTES: chat-prompt-fixo.js
               procura os dele por id, e dois painéis com o mesmo id brigariam.
               Só três opções: os prompts fixos do Chat não entram aqui.
               ⚠ Nada de crase neste comentário: o arquivo inteiro é um
               template literal, e uma crase aqui fecha a string no meio. -->
          <div class="ctx-inicial-wrap" id="fila-prompt-fixo-wrap">
            <button class="btn-ctx-inicial" id="btn-fila-prompt-fixo" type="button">Nenhum &#9662;</button>
            <!-- O motivo NÃO mora aqui dentro. Ele está no FIM desta toolbar —
                 ver o span lá embaixo, e o porquê escrito junto dele. -->
            <div class="ctx-inicial-panel prompt-fixo-panel hidden" id="fila-prompt-fixo-panel">
              <button class="prompt-fixo-option ativo" data-prompt-fixo="">Nenhum</button>
              <button class="prompt-fixo-option" data-prompt-fixo="seguranca">Segurança</button>
              <button class="prompt-fixo-option" data-prompt-fixo="melhorias">Melhorias</button>
            </div>
          </div>
          <!-- No lugar onde o Chat tem "Contexto inicial": um
               dropdown SEM escolha, só para consultar. A contagem de chamadas
               morava nos cards da sub-aba Subagentes, e ali ela misturava o que
               você AJUSTA com o que ACONTECEU — aqueles cards são configuração.
               Aqui ela fica ao lado do campo de escrever, que é de onde você
               olha enquanto a pesquisa corre. -->
          <div class="ctx-inicial-wrap" id="fila-chamadas-wrap">
            <button class="btn-ctx-inicial" id="btn-fila-chamadas" type="button">Chamadas &#9662;</button>
            <div class="ctx-inicial-panel fila-chamadas-panel hidden" id="fila-chamadas-panel">
              <div class="fila-chamadas-rodada" id="fila-chamadas-rodada">&#8212;</div>
              <table class="ctx-inicial-table">
                <thead><tr><th>Subagente</th><th>Chamadas</th></tr></thead>
                <tbody id="fila-chamadas-corpo"></tbody>
              </table>
            </div>
          </div>
          <!-- Sem o total à esquerda: no Chat aquele espaço é do "Contexto
               inicial", que a Fila não tem. A contagem da conversa já está no
               número da direita, no mesmo formato do Chat. -->
          <div class="context-usage" title="Uso da janela de contexto do modelo">
            <div class="context-usage-bar"><div class="context-usage-fill" id="fila-usage-fill"></div></div>
            <span class="context-usage-text" id="fila-usage-text">&#8212;</span>
          </div>
          <!-- O motivo do prompt fixo apagado. Ele mora AQUI, no fim da toolbar,
               e não dentro do #fila-prompt-fixo-wrap, que é onde ele nasceu: a
               classe é display:block, então lá dentro a frase "O prompt fixo vale
               só na primeira passada desta tarefa" fazia o wrap virar duas linhas
               e assumir a largura dela — empurrando o "Chamadas" para longe do
               "Nenhum". No fim da toolbar ela não empurra nada: a toolbar é
               flex-wrap, e a frase cai sozinha na linha de baixo quando não cabe.
               É o mesmo remédio do Chat, que põe o motivo no .chat-send-group.
               ⛔ Não resolver isto mexendo em .trava-motivo: aquela classe é de
               SEIS telas (Chat, Fila x2, Designer, Acionamentos, Backup). -->
          <span class="trava-motivo hidden" id="fila-prompt-fixo-motivo"></span>
        </div>
        <div class="chat-input-row">
          <textarea id="fila-chat-input" class="chat-textarea" placeholder="Descreva a tarefa... (Enter envia, Shift+Enter nova linha)" rows="3"></textarea>
          <div class="chat-send-group">
            <button class="btn btn-primary" id="btn-fila-chat-enviar">Enviar</button>
          </div>
        </div>
      </div>
    </div>

  </div>
`;

// As duas sub-abas novas vêm do módulo compartilhado com o Chat.
if (typeof subagentesConfigMarkup === 'function') {
  document.getElementById('fila-config-global').innerHTML = subagentesConfigMarkup('fila');
  document.getElementById('ftab-ferramentas').innerHTML = subagentesFerramentasMarkup('fila');
}
