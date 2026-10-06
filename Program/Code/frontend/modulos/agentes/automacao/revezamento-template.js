// ══════════════════════════════════════════ TEMPLATE: Card "Revezamento"
// Markup estático do card do Revezamento (sub-aba Rotinas). Inserido em
// #agente-grupo-ind — rotinas.js (`_agruparCards`) o realoca para o grupo
// correto lendo o atributo data-grupo do próprio card. Aqui, `base`.
//
// ⚠️ Ele NÃO é a Espera, e este texto é o lugar onde a diferença fica clara.
// Os dois seguram o ciclo, e por motivos que não têm nada em comum:
//
//   · a Espera segura enquanto o CÓDIGO ainda está mudando — e tem chave;
//   · o Revezamento segura enquanto a JANELA DO LM STUDIO está ocupada — e
//     não tem chave nenhuma, porque não há o que escolher: a janela é uma só.
//
// Até 28/08/2026 as duas coisas moravam no card da Espera. O defeito disso era
// concreto: desligar o freio — que é o gesto de quem quer que o ciclo comece
// logo — apagava junto a única frase que explicava "a janela está com a outra
// aba de projeto". Ficava tudo parado e sem nada na tela dizendo por quê.
//
// ⚠️ Sem botão "Executar", e sem ▶: não há o que rodar num portão.
document.getElementById('agente-grupo-ind').insertAdjacentHTML('beforeend', `
  <div class="agente-card" data-agente="revezamento" data-tipo="det" data-destino="interno" data-grupo="base" id="agente-revezamento">
    <button class="agente-card-header agente-card-toggle" id="revezamento-toggle">
      <div class="agente-title-row">
        <span class="agente-icon">🚦</span>
        <span class="agente-name">Revezamento</span>
        <span class="agente-selos"><span class="agente-selo" title="determinístico — não usa LLM">⚡</span><span class="agente-selo" title="encanamento — consumido pelo próprio programa">⚙️</span></span>
        <span class="agente-badge agente-badge-idle" id="revezamento-badge">Livre</span>
        <span class="agente-summary" id="revezamento-summary"></span>
        <span class="agente-dep-chain">| a vez na janela</span>
      </div>
      <p class="agente-desc">${explicacaoDoCard('revezamento')}</p>
      <span class="agente-chevron" id="revezamento-chevron">▸</span>
    </button>
    <div class="agente-card-body hidden" id="revezamento-body">
      <div class="agente-tabs">
        <button class="agente-tab active" id="revezamento-tab-processar" data-tab="processar">Estado</button>
      </div>
      <div class="agente-tab-content" id="revezamento-pane-processar">
        <div class="agente-result-area" id="revezamento-result-area">
          <div class="agente-result-summary" id="revezamento-result-summary"></div>
        </div>
        <p class="agente-desc" style="margin-top:10px">
          Enfileirar, nunca descartar: ligar a automação num segundo projeto com
          o primeiro rodando não perde o ciclo do segundo — ele fica aqui
          esperando e parte sozinho quando o primeiro terminar. Fechar a aba de
          um projeto desiste da vez dele e passa a bola para o próximo.
        </p>
      </div>
    </div>
  </div>
`);
