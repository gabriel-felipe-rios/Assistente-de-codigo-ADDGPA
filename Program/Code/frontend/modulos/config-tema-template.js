// ═══════════════════════════════════ TEMPLATE: Configurações → Temas ══
// Markup da categoria que escolhe o conjunto de cores da interface.
//
// Injetado por JS, e não escrito no `index.html`, porque o shell já passou das
// 500 linhas da AMF — mesmo motivo dos outros `*-template.js`.
//
// ⛔ Registrar aqui NÃO exige tocar em `config-categorias.js`: ele foi feito
// exatamente para isso. Quem acrescenta categoria chama `registrarCategoriaConfig`
// e pronto; a posição no trilho é a ordem de carga do <script> no index.html.
//
// ⚠️ "Tema" aqui é o conjunto de cores do PRÓPRIO VibeCoding. Não confundir com
// o "Estilo" e a "Paleta" do Designer, que são assets do projeto do usuário —
// aquilo descreve a interface que ele está construindo, isto descreve a
// interface em que ele constrói. Ver a base de terminologia do projeto.
(function () {
  if (typeof registrarCategoriaConfig !== 'function') return;

  // A ordem aqui é a ordem dos cartões na tela: do padrão para os alternativos.
  const TEMAS = [
    { chave: 'ardosia', rotulo: 'Ardósia',
      dica: 'Azul-ardósia. O tema com que o programa sempre foi.',
      amostra: ['#2C3E50', '#34495E', '#3498DB', '#2ECC71'] },
    { chave: 'carvao',  rotulo: 'Carvão',
      dica: 'Mais escuro e neutro, sem o azul do fundo. Para trabalhar à noite.',
      amostra: ['#17191C', '#212429', '#4DABEB', '#3ED680'] },
    { chave: 'papel',   rotulo: 'Papel',
      dica: 'Claro, com fundo de papel levemente quente em vez de branco puro.',
      amostra: ['#F2EFE9', '#FBFAF7', '#156EA7', '#16854A'] },
    { chave: 'dracula', rotulo: 'Drácula',
      dica: 'O mais escuro dos cinco, puxando para o roxo em vez de neutro.',
      amostra: ['#282A36', '#343746', '#BD93F9', '#50FA7B'] },
    { chave: 'obsidiana', rotulo: 'Obsidiana',
      dica: 'Quase o Carvão: mesmas cores, fundo quase preto puxado para o roxo.',
      amostra: ['#14121B', '#1E1A26', '#4DABEB', '#3ED680'] },
  ];

  // As amostras são os únicos hexadecimais escritos à mão no frontend fora das
  // três exceções conhecidas, e são legítimas: cada cartão mostra as cores de um
  // tema que NÃO está aplicado, então não dá para lê-las do `:root` — o `:root`
  // só conhece o tema atual. São um retrato do arquivo, não uma cor de interface.
  const cartao = (t) => `
      <label class="config-tema-cartao" for="cfg-tema-${t.chave}">
        <input type="radio" name="cfg-tema" id="cfg-tema-${t.chave}" value="${t.chave}">
        <span class="config-tema-info">
          <span class="config-tema-nome">${t.rotulo}</span>
          <span class="config-tema-dica">${t.dica}</span>
        </span>
        <span class="config-tema-amostra" aria-hidden="true">
          ${t.amostra.map(c => `<span style="background:${c}"></span>`).join('')}
        </span>
      </label>`;

  registrarCategoriaConfig({
    chave: 'tema',
    rotulo: 'Temas',
    icone: '◐',
    resumo: 'as cores da interface do programa',
    conteudo: `
      <div class="config-cartao" data-config-busca="tema cor cores aparencia claro escuro">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Tema da interface</div>
          <p class="config-cartao-dica">
            Vale para o programa inteiro e troca na hora, sem reabrir. A escolha fica
            gravada e volta do jeito que você deixou na próxima vez que abrir.
          </p>
        </div>

        <div class="config-tema-lista">
          ${TEMAS.map(cartao).join('')}
        </div>

        <p class="config-nota">
          O terminal embutido continua escuro nos três temas, de propósito: ele reproduz a
          saída do programa que você executou, com as cores que esse programa emite — e
          elas foram escolhidas para fundo escuro. As cores do Designer também não mudam:
          aquilo é a paleta do <em>seu</em> projeto, não a do VibeCoding.
        </p>
      </div>`,
    acoes: '<button class="btn btn-positive" id="btn-save-tema">Salvar tema</button>',
  });
})();
