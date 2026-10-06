// ═══════════════════════════════════ Configurações → Teclado (markup) ══
// Só o markup da categoria. Comportamento em `config-teclado.js`.
//
// A posição da tag <script> deste arquivo no index.html é a posição da
// categoria no trilho da esquerda — não há lista de categorias em lugar
// nenhum. Ver `config-categorias.js`.
//
// ⚠️ "TECLADO", e não "Atalhos". `atalho` já é o termo interno dos Launchers
// (`atalhos_externos.py`, `AtalhosExternosMixin`), e a decisão está registrada
// no Vocabulário. Duas coisas diferentes com o mesmo nome é o que faz uma busca
// no código devolver a errada.

(function () {
  if (typeof registrarCategoriaConfig !== 'function') return;

  registrarCategoriaConfig({
    chave: 'teclado',
    rotulo: 'Teclado',
    // Seta de Shift, a tecla que mais aparece nas combinações. ⚠️ Glifo, nunca
    // emoji: o glifo do trilho acende e apaga junto com os vizinhos, e emoji não
    // obedece a `color` — ficaria aceso sozinho.
    icone: '⇧',
    resumo: 'a tecla de cada comando do programa',
    conteudo: `
      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Comandos do programa</div>
          <p class="config-cartao-dica">Clique na tecla para trocá-la, e aperte a
             combinação nova. O ↺ devolve a de fábrica — só daquela linha.</p>
        </div>
        <!-- ⚠️ A grade é DESENHADA PELO JS a partir do registro
             (\`modulos/teclas.js\`), e não escrita aqui: comando novo registrado
             em qualquer lugar do programa aparece nesta tela sozinho. Só o
             cabeçalho de coluna é markup.
             ⚠️ A rolagem é do filho, e a casca tem \`min-height: 0\` — sem ele
             quem rola passa a ser a página. -->
        <div class="tecla-rolagem">
          <div class="tecla-grade" id="teclado-grade">
            <div class="tecla-cab">Comando</div>
            <div class="tecla-cab">Onde vale</div>
            <div class="tecla-cab">Tecla</div>
            <div class="tecla-cab"></div>
          </div>
        </div>
        <p class="config-nota">O selo <span class="selo-conflito">mesma tecla</span>
           acende quando dois comandos que valem no mesmo lugar dividem a mesma
           combinação. Ele avisa e deixa gravar: dois comandos de abas diferentes
           podem dividir a mesma tecla sem se atrapalhar.</p>
        <p class="config-nota">Não entram aqui as teclas de texto
           (<b>Esc</b>, <b>Enter</b>, <b>Tab</b>) nem as de gesto
           (<b>Espaço</b> e <b>Delete</b> na Oficina), que dependem de onde o
           ponteiro está.</p>
      </div>

      <!-- ⚠️ NASCE VAZIO NESTA OBRA, mas o encaixe EXISTE — e por isso ele é
           nomeado aqui, ao contrário do cartão de modos da categoria "Acesso
           rápido", onde o mecanismo ainda não existe e nomear um encaixe
           inexistente enganaria quem fosse escrever uma extensão. -->
      <div class="config-cartao" data-origem="extensao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Comandos vindos de extensão</div>
        </div>
        <p class="plugins-vazio">Nenhuma extensão ligada trouxe comando.
           Uma extensão que declare o encaixe <b>acesso-rapido.comandos</b>
           aparece aqui, com o nome dela como título de grupo. A tecla que você
           escolher fica gravada mesmo se a extensão for desligada.</p>
      </div>`,
    // ⚠️ O "Salvar" existe mesmo com tudo gravando no clique: nenhuma categoria
    // fica sem ele, e uma barra de ações diferente das outras vinte faz o
    // usuário procurar o botão que não há. Ele regrava o estado atual e confirma
    // em voz alta. O "Restaurar padrão" NÃO se escreve — `registrarCategoriaConfig`
    // o injeta sozinho.
    acoes: '<button class="btn btn-positive" id="btn-save-teclado">Salvar</button>',
  });
})();
