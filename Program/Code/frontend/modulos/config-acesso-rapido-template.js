// ═══════════════════════════════ Configurações → Acesso rápido (markup) ══
// Só o markup da categoria. Comportamento em `config-acesso-rapido.js`.
//
// A posição da tag <script> deste arquivo no index.html é a posição da
// categoria no trilho da esquerda — não há lista de categorias em lugar
// nenhum. Ver `config-categorias.js`.
//
// ⚠️ A ORDEM DOS QUATRO CARTÕES É DECISÃO FECHADA: os dois primeiros são sobre
// a CAIXA (como ela abre, onde, de que tamanho), os dois últimos sobre o
// CONTEÚDO dela.

(function () {
  if (typeof registrarCategoriaConfig !== 'function') return;

  // ⚠️ Os nove quadrados e os três tamanhos saem das MESMAS tabelas que as
  // Notificações usam (`modulos/notificacoes.js`) — a barra e a notificação
  // fazem a mesma pergunta duas vezes no programa, e escrever as nove células à
  // mão aqui criaria a segunda lista para divergir da primeira.
  //
  // ⚠️ O que NÃO se copia junto é o VALOR de fábrica: o da barra é
  // `superior-centro`, e o das notificações é `inferior-direita`. A barra sempre
  // abriu no topo ao centro, e mudar isso trocaria o hábito de quem já a usa.
  const grade = NOTIFICACAO_POSICOES.map((p) => `
        <button type="button" class="notif-grade-celula" data-posicao="${p.chave}"
                role="radio" aria-checked="false" title="${p.rotulo}"
                aria-label="${p.rotulo}"><span></span></button>`).join('');

  const tamanhos = NOTIFICACAO_TAMANHOS.map((t) => `
          <button type="button" class="mapa-toggle-btn" data-tamanho="${t.chave}">${t.rotulo}</button>`).join('');

  registrarCategoriaConfig({
    chave: 'acesso-rapido',
    rotulo: 'Acesso rápido',
    // Lupa monocromática. ⚠️ Glifo, nunca emoji: o glifo do trilho acende e
    // apaga junto com os vizinhos, e emoji não obedece a `color` — ficaria
    // aceso sozinho. É o mesmo `⌕` do botão da árvore do Editor, de propósito:
    // quem vir os dois reconhece que são a mesma coisa.
    icone: '⌕',
    resumo: 'a barra que abre por cima da tela e acha qualquer coisa',
    conteudo: `
      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Como ela abre</div>
          <p class="config-cartao-dica">Clique na tecla para trocá-la, e aperte a
             combinação nova. O ↺ devolve a de fábrica.</p>
        </div>
        <!-- ⚠️ ESTA GRADE É A MESMA DA CATEGORIA "TECLADO", e é de propósito:
             são as duas teclas da barra, lidas do MESMO registro
             (\`modulos/teclas.js\`). É uma configuração só, mostrada em dois
             lugares — não há dois jeitos de mudar a mesma coisa. -->
        <div class="tecla-grade" id="acr-grade-teclas">
          <div class="tecla-cab">Comando</div>
          <div class="tecla-cab">Onde vale</div>
          <div class="tecla-cab">Tecla</div>
          <div class="tecla-cab"></div>
        </div>
        <div class="config-field-row">
          <label class="plugin-check">
            <input type="checkbox" id="acr-esconder-modos" />
            Esconder o modo que não tem o que responder na aba atual
          </label>
        </div>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Onde e de que tamanho ela abre</div>
          <p class="config-cartao-dica">Clique no lugar da tela onde a barra deve
             nascer. O quadrado do meio é o centro da tela.</p>
        </div>
        <div class="notif-grade" id="acr-grade-posicao"
             role="radiogroup" aria-label="Posição na tela">${grade}
        </div>
        <div class="config-field-row">
          <div class="mapa-toggle" id="acr-tamanho">${tamanhos}
          </div>
        </div>
        <p class="acr-medidas" id="acr-medidas"></p>
        <!-- A prévia desenha a barra no lugar escolhido, no tamanho escolhido.
             Não é a barra de verdade: abrir a barra por cima da tela de
             Configurações taparia justamente os controles que se está mexendo. -->
        <div class="acr-previa" id="acr-previa" aria-hidden="true"><span></span></div>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Modos do programa</div>
          <p class="config-cartao-dica">Arraste para mudar a ordem dos botões
             dentro da barra. O primeiro ligado é o modo em que ela abre.</p>
        </div>
        <div class="plugin-lista acr-modos-lista" id="acr-modos"></div>
        <div class="config-field-row">
          <label for="acr-resultados">Resultados por modo</label>
          <input type="number" id="acr-resultados" min="1" max="200" step="1" />
          <span class="config-unidade">linhas</span>
        </div>
        <p class="config-nota">Este campo grava no botão “Salvar”, e não a cada
           tecla digitada — os outros controles desta tela gravam no clique.</p>
      </div>

      <!-- Como o VS Code escreve "Python: Run file": o dono na frente do
           item. Três caixas, cada uma um interruptor, para o usuário desligar
           o que não gostar (pedido em 06/09/2026). Gravam no clique, como a
           "Esconder o modo…" — escolha visível e reversível num clique. -->
      <div class="config-cartao"
           data-config-busca="prefixo nome da extensão aba na frente título menu de contexto">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">De quem é cada item</div>
          <p class="config-cartao-dica">O dono na frente do nome, como o VS Code
             faz. A cor do "Destacar extensões" continua valendo com tudo isto
             desligado.</p>
        </div>
        <div class="config-field-row">
          <label class="plugin-check">
            <input type="checkbox" id="acr-prefixo-extensao" />
            Comando de extensão leva o nome dela na frente — “Tingir a janela: Tingir a janela…”
          </label>
        </div>
        <div class="config-field-row">
          <label class="plugin-check">
            <input type="checkbox" id="acr-prefixo-aba" />
            “Ir para aba” mostra a aba de cima na frente — “Trabalhos: Oficina”
          </label>
        </div>
        <div class="config-field-row">
          <label class="plugin-check">
            <input type="checkbox" id="acr-titulo-menu" />
            No menu de contexto, um título com o nome da extensão acima dos itens dela
          </label>
        </div>
      </div>

      <!-- ⚠️ NASCE VAZIO E CONTINUA VAZIO. O mecanismo de modo vindo de extensão
           não existe ainda, e o cartão está aqui para a capacidade não ficar
           invisível para quem for escrever uma extensão. Ele NÃO nomeia encaixe
           nenhum de propósito: nomear um que não existe faz quem ler tentar
           declará-lo e falhar sem entender por quê.
           E NÃO leva data-origem="extensao" (tirado em 06/09/2026): o cartão é
           do programa, e o "Destacar extensões" pintava um pedaço do programa
           como se tivesse vindo de extensão. Quando um modo de extensão
           existir, é o ITEM dele que o programa marca — nunca a caixa. -->
      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Modos vindos de extensão</div>
        </div>
        <p class="plugins-vazio">Nenhuma extensão ligada trouxe modo de busca.</p>
      </div>`,
    // ⚠️ O "Salvar" NÃO é decorativo, e não é só o campo numérico: ele regrava o
    // estado inteiro e confirma em voz alta. Quem mexeu em seis controles não
    // tem, sem ele, nenhum sinal de que algo foi para o disco.
    //
    // ⚠️ E ele EXISTE, ponto. Nenhuma categoria fica sem "Salvar" — é exceção
    // registrada em `Padrões de interface/Exceções.md`, e os Launchers acabaram
    // de ser corrigidos por terem nascido sem ele, "visivelmente diferentes das
    // vizinhas".
    //
    // ⚠️ O "Restaurar padrão" NÃO se escreve aqui: `padrao: true` (o valor
    // padrão de `registrarCategoriaConfig`) o injeta sozinho. Escrevê-lo à mão
    // dá dois botões iguais.
    acoes: '<button class="btn btn-positive" id="btn-save-acesso-rapido">Salvar</button>',
  });
})();
