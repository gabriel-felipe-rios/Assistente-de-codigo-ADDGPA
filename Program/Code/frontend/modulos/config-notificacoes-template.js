// ═══════════════════════════════ Configurações → Notificações (markup) ══
// Só o markup da categoria. Comportamento em `config-notificacoes.js`.
//
// A posição da tag <script> deste arquivo no index.html é a posição da
// categoria no trilho da esquerda — não há lista de categorias em lugar
// nenhum. Ver `config-categorias.js`.

(function () {
  if (typeof registrarCategoriaConfig !== 'function') return;

  // Os nove quadrados saem da mesma tabela que o `pintarNotificacao` usa para
  // montar a classe CSS. Escrever as nove células à mão criaria uma segunda
  // lista para divergir da primeira no dia em que uma posição mudasse de nome.
  const grade = NOTIFICACAO_POSICOES.map((p) => `
        <button type="button" class="notif-grade-celula" data-posicao="${p.chave}"
                role="radio" aria-checked="false" title="${p.rotulo}"
                aria-label="${p.rotulo}"><span></span></button>`).join('');

  const tamanhos = NOTIFICACAO_TAMANHOS.map((t) => `
          <button type="button" class="mapa-toggle-btn" data-tamanho="${t.chave}">${t.rotulo}</button>`).join('');

  // As quinze origens, quebradas pelos subtítulos de `tela`. Sem eles, quinze
  // linhas seguidas viram uma parede em que não se acha nada.
  let telaAtual = null;
  const origens = NOTIFICACAO_ORIGENS.map((o) => {
    const cabecalho = o.tela === telaAtual ? '' :
      `\n        <div class="notif-origem-grupo">${o.tela}</div>`;
    telaAtual = o.tela;
    return `${cabecalho}
        <div class="notif-origem-linha">
          <span class="notif-origem-rotulo">${o.rotulo}</span>
          <div class="mapa-toggle notif-origem-estados" data-origem="${o.chave}"
               role="radiogroup" aria-label="Notificações de ${o.rotulo}">
            <button type="button" class="mapa-toggle-btn" data-estado="tudo">Tudo</button>
            <button type="button" class="mapa-toggle-btn" data-estado="erros">Só erros</button>
            <button type="button" class="mapa-toggle-btn" data-estado="nada">Nada</button>
          </div>
        </div>`;
  }).join('');

  registrarCategoriaConfig({
    chave: 'notificacoes',
    rotulo: 'Notificações',
    // Quadrado com o quadrante inferior direito cheio: desenha a própria
    // posição padrão. Glifo monocromático, nunca emoji — emoji não obedece a
    // `color` e ficaria aceso com os vizinhos apagados.
    icone: '◲',
    resumo: 'onde as mensagens aparecem e o que avisa',
    conteudo: `
      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Onde aparecem</div>
          <p class="config-cartao-dica">Clique no lugar da tela onde a notificação
             deve nascer. O quadrado do meio é o centro da tela.</p>
        </div>
        <div class="notif-grade" id="notif-grade-posicao"
             role="radiogroup" aria-label="Posição na tela">${grade}
        </div>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Tamanho</div>
          <p class="config-cartao-dica">Vale para a letra e para a folga em volta dela.</p>
        </div>
        <div class="config-field-row">
          <div class="mapa-toggle" id="notif-tamanho">${tamanhos}
          </div>
        </div>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">O que avisa</div>
          <p class="config-cartao-dica">Cada parte do programa avisa por conta
             própria. Aqui você escolhe quais delas continuam falando.</p>
        </div>
        <div class="notif-origens" id="notif-origens">${origens}
        </div>
        <p class="config-nota">“Só erros” cala as confirmações — “Salvo!”,
           “Copiado!” — e mantém as falhas. “Nada” cala tudo daquela parte,
           inclusive as falhas.</p>
      </div>`,
    // ⚠️ O clique JÁ grava — ver o ⚠️ do `config-notificacoes.js`. O botão
    // existe para esta barra ficar igual à das outras categorias.
    acoes: '<button class="btn btn-positive" id="btn-save-notificacoes">Salvar notificações</button>',
  });
})();
