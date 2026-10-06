// ══════════════════════════════════════════════ TEMPLATE: Aba Inspetor
// Markup estático da aba "Inspetor". Extraído de index.html para manter o
// shell abaixo do limite de linhas da AMF.
//
// Duas sub-abas, e cada uma é uma ESTEIRA que termina em "Copiar para a IA":
// Candidatos e "Enviar para IA" deixaram de ser sub-abas próprias e viraram o
// fim da esteira de Capturar, na mesma tela. Trocar de aba três vezes para
// mandar um elemento para a IA era o custo que esta reforma removeu.
//
// O "▶ Executar programa" fica ACIMA da barra de sub-abas: o programa-alvo é
// da aba inteira (o Capturar inspeciona ele, a Gravação grava ele), não de uma
// esteira só — e antes existiam dois botões com ids diferentes chamando a
// mesma função.
document.getElementById('tab-inspetor').innerHTML = `
  <div class="insp-topo">
    <button class="btn btn-utility" id="insp-executar" title="Abre o programa pelo arquivo principal da aba Projeto — e define o alvo da gravação">▶ Executar programa</button>
    <span class="insp-alvo" id="insp-alvo"></span>
  </div>

  <div class="insp-tabs-bar" data-taborder-group="inspetor_subtabs" data-taborder-label="Sub-abas de Inspetor" data-taborder-parent="tab-inspetor">
    <button class="insp-tab-btn active" data-insp="insp-capturar">Capturar</button>
    <button class="insp-tab-btn"        data-insp="insp-gravacao">Gravação</button>
  </div>

  <!-- Capturar: capturar → (restringir) → instrução → copiar -->
  <div class="insp-tab-content active" id="insp-capturar">
    <div class="insp-action-row">
      <div class="insp-toggle-row">
        <button class="insp-toggle active" data-inspmodo="controle" title="Captura o elemento sob o cursor: nome, tipo, texto e caminho na árvore de UI">Controle específico</button>
        <button class="insp-toggle"        data-inspmodo="janela" title="Captura a janela inteira daquele ponto: título, classe e processo">Janela inteira</button>
      </div>
      <button class="btn btn-primary" id="insp-btn-ativar">Ativar modo inspetor</button>
    </div>

    <div class="insp-empty" id="insp-capturar-empty">Nenhuma captura ainda. Ative o modo inspetor e clique em um elemento de qualquer programa aberto no Windows.</div>

    <div class="insp-props-panel hidden" id="insp-props-panel">
      <h3>Relatório capturado — semântico (UI Automation)</h3>
      <div id="insp-props-uia"></div>
      <h3 style="margin-top:16px;">Relatório capturado — sistema (Win32)</h3>
      <div id="insp-props-win32"></div>
      <div class="insp-prop-source">Semântico alimenta a busca por nome/texto no código; sistema ajuda a identificar de qual app veio.</div>
    </div>

    <!-- Fim da esteira: restringir a um trecho é OPCIONAL. Sem escolher nada,
         o relatório sai com os candidatos em uma linha cada; escolhendo um, ele
         sai com o trecho de código, o CSS e as referências. -->
    <div class="insp-restringir hidden" id="insp-restringir">
      <button class="insp-expand-toggle insp-restringir-btn" id="insp-restringir-btn">
        <span id="insp-restringir-rotulo">▸ Restringir a um trecho</span>
        <span class="insp-corte" id="insp-corte"></span>
      </button>
      <div class="insp-restringir-corpo hidden" id="insp-candidatos-list"></div>
    </div>

    <div class="insp-envio hidden" id="insp-envio">
      <div class="insp-envio-nota" id="insp-envio-nota"></div>
      <textarea class="insp-instrucao" id="insp-instrucao" placeholder="Opcional — descreva o que você quer mudar nesse elemento"></textarea>
      <div class="insp-send-actions">
        <button class="btn btn-primary" id="insp-btn-copiar">📋 Copiar para a IA</button>
      </div>
    </div>
  </div>

  <!-- Gravação: iniciar → parar → resolver → copiar -->
  <div class="insp-tab-content hidden" id="insp-gravacao">
    <div class="insp-action-row">
      <div class="insp-opcoes-row">
        <label class="insp-opcao" title="Grava também duplo clique, botão direito, botão do meio e rolagem. Desmarcado, só clique esquerdo vira passo."><input type="checkbox" id="insp-grav-mouse-completo"> Mouse completo</label>
        <label class="insp-opcao" title="Grava as teclas como passos. Registra a ação e o elemento em foco — nunca o que foi digitado."><input type="checkbox" id="insp-grav-teclado"> Teclado</label>
      </div>
      <div class="insp-toggle-row">
        <button class="btn btn-positive" id="insp-grav-iniciar">● Iniciar gravação</button>
        <button class="btn btn-negative" id="insp-grav-parar" disabled>■ Parar</button>
        <button class="btn btn-special" id="insp-grav-resolver" disabled>Resolver a teia</button>
      </div>
    </div>
    <div class="insp-grav-status" id="insp-grav-status"></div>

    <div class="insp-note insp-grav-dica hidden" id="insp-grav-dica">
      Gravando… interaja normalmente com o app. Só o programa-alvo é gravado — clique em outro
      programa não vira passo. Pra parar, volte pra cá (dica: <b>Alt+Tab</b>) e clique <b>Parar</b>.
    </div>

    <div class="insp-empty" id="insp-grav-empty">Nenhum passo ainda. Clique em “Iniciar gravação” e use seu app.</div>
    <div id="insp-grav-lista"></div>

    <div class="insp-send-summary hidden" id="insp-grav-envio">
      <h4>Instrução pro fluxo inteiro (opcional)</h4>
      <div class="insp-corte" id="insp-grav-corte"></div>
      <textarea class="insp-instrucao" id="insp-grav-instrucao" placeholder="Opcional — o que você quer que a IA faça com essa lógica/esse fluxo"></textarea>
      <div class="insp-send-actions">
        <button class="btn btn-primary" id="insp-grav-copiar">📋 Copiar para a IA</button>
      </div>
    </div>
  </div>
`;
