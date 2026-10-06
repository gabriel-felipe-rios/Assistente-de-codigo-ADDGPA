// ══════════════════════════════════ TEMPLATE: Mapas › Pipeline › Mapa em níveis
// Markup estático da sub-aba "Mapa em níveis". Todo id leva o prefixo `mn-`:
// o programa inteiro divide um documento só, e ids como `status`, `painel` ou
// `busca` já existiriam em outra tela.
//
// O palco (#mn-palco) é posicionado abaixo do topo por `mnPosicionarPalco`,
// porque a altura da barra muda quando ela quebra linha.

document.getElementById('vp-sub-niveis').innerHTML = `
  <div id="mn-raiz">
    <div id="mn-topo">
      <div class="vp-cabecalho">
        <div class="vp-cabecalho-texto">
          <div class="vp-titulo">Mapa em níveis</div>
          <div class="vp-titulo-sub" id="mn-titulo-sub"></div>
        </div>
        <div class="vp-metricas" id="mn-metricas"></div>
      </div>

      <div class="vp-barra">
        <div class="mapa-toggle mn-niveis" id="mn-niveis"></div>
        <span class="vp-barra-sep"></span>
        <label class="toggle-pill" id="mn-tg-zoom"
               title="Ligado: a rodinha, passando do limite escolhido em ⚙ Ajustes, troca o nível sozinha e abre o cartão que está sob o mouse. Desligado: a rodinha só aproxima.">
          <div class="toggle-track on"><div class="toggle-knob"></div></div>
          <span class="toggle-label on">Zoom troca o nível</span>
        </label>
        <label class="toggle-pill" id="mn-tg-hubs"
               title="Liga as cadeias que usam os mesmos arquivos de apoio (hubs específicos). Desligado, elas só aparecem ao selecionar ou passar o mouse numa cadeia.">
          <div class="toggle-track"><div class="toggle-knob"></div></div>
          <span class="toggle-label">Hubs em comum</span>
        </label>
        <label class="mn-busca">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7.8 7.8 L11 11" stroke="currentColor" stroke-width="1.4"/></svg>
          <input id="mn-busca" placeholder="Achar e abrir… (Enter)">
        </label>
        <span class="mn-espaco"></span>
        <button class="btn btn-xs btn-muted" id="mn-btn-enquadrar" title="Enquadra tudo o que está aberto">⤢ Enquadrar</button>
        <button class="btn btn-xs btn-muted" id="mn-btn-recolher" title="Fecha tudo o que foi aberto à mão e volta ao nível 1">⊟ Recolher tudo</button>
        <button class="btn btn-xs btn-muted" id="mn-btn-ajustes" title="Zoom que troca de nível, animação, espaçamento, minimapa e nomes no minimapa">⚙ Ajustes</button>
      </div>
      <p class="mn-status" id="mn-status"></p>
    </div>

    <div id="mn-palco">
      <div id="mn-viewport">
        <div id="mn-camera">
          <div id="mn-mundo">
            <div id="mn-camada-caixas"></div>
            <svg id="mn-setas" xmlns="http://www.w3.org/2000/svg" width="1" height="1">
              <defs>
                <marker id="mn-m-chamada" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#e74c3c"/></marker>
                <marker id="mn-m-ponte" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#38bdf8"/></marker>
                <marker id="mn-m-area" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="rgb(155,89,182)"/></marker>
                <marker id="mn-m-bloco" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--teal)"/></marker>
              </defs>
              <g id="mn-g-area"></g><g id="mn-g-bloco"></g><g id="mn-g-hub"></g><g id="mn-g-chamada"></g><g id="mn-g-rotulos"></g>
            </svg>
            <div id="mn-camada-cartoes"></div>
            <div id="mn-camada-fantasmas"></div>
          </div>
        </div>
        <!-- O esboço: o mapa pintado leve, na frente do DOM, durante o gesto e
             quando afastado com muitos cartões (mapas-pipeline-niveis-esboco.js). -->
        <canvas id="mn-esboco"></canvas>
        <div id="mn-fantasma-cena"></div>
      </div>
      <div id="mn-coluna">
        <div id="mn-minimapa" class="mn-flutuante"><div class="mn-mm-tit"><span title="Clique ou arraste para ir; rodinha para dar zoom">Minimapa</span><span id="mn-mm-zoom"></span></div><canvas id="mn-mm" width="320" height="200"></canvas></div>
        <div id="mn-regua" class="mn-flutuante"></div>
      </div>
      <div id="mn-migalhas" class="mn-flutuante"></div>
      <aside id="mn-painel"><button class="mn-fechar" id="mn-btn-fechar" title="fechar (Esc)">×</button><div id="mn-painel-conteudo"></div></aside>
      <div id="mn-vazio" class="hidden"></div>
    </div>
    <div id="mn-medidor"></div>
  </div>
`;

// O popover de ajustes vai no <body>: ele é posicionado pelas coordenadas da
// janela (embaixo do botão ⚙), e dentro do palco ficaria cortado pelo overflow.
document.body.insertAdjacentHTML('beforeend', '<div id="mn-ajustes"></div>');
