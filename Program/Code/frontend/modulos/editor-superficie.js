// ══════════════════════════ EDITOR: A SUPERFÍCIE DE EDIÇÃO ══
// As três camadas empilhadas: um <textarea> transparente por cima de um <pre>
// pintado, mais a régua de números. Quem digita é o textarea; quem se lê é o
// <pre>. As métricas que mantêm um exatamente sob o outro moram em
// `estilos/editor-superficie.css` — o porquê está escrito lá.
//
// ⚠️ A REGRA QUE DECIDE SE O CTRL+Z FUNCIONA: nunca atribuir a `ta.value`
// depois que o arquivo abriu. Qualquer atribuição à `value` de um textarea
// DESTRÓI a pilha de desfazer nativa do navegador inteira — e é justamente
// essa pilha que dá Ctrl+Z e Ctrl+Shift+Z de graça, por arquivo aberto,
// sobrevivendo ao salvar e morrendo ao fechar, que é o comportamento do VS
// Code. Toda inserção por programa (Tab, Shift+Tab) passa por
// `document.execCommand('insertText', …)`, que entra NA pilha em vez de
// apagá-la. `execCommand` está formalmente obsoleto e funciona no WebView2;
// não existe substituto que preserve o histórico nativo, e a alternativa seria
// escrever um motor de desfazer próprio.

// ⚠️ NÃO existe mais uma constante de tabulação aqui. O número sai de
// `indentacaoDoEditor()` (editor-metricas.js), que é o MESMO que alimenta o
// `--ed-tab` do CSS. Duas fontes davam tabulação 2 na tela e 4 no teclado.

// eslint-disable-next-line no-unused-vars
function criarSuperficie(hospedeiro) {
  const pilha = document.createElement('div');
  pilha.className = 'ed-pilha';
  // Cada camada espelho é uma CAIXA que recorta com um FILHO que carrega o
  // texto. O filho é quem se move, por `transform`. O porquê está em
  // `editor-superficie.css`, no aviso sobre não usar `scrollTop`.
  // ⚠️ `aria-hidden` NAS DUAS CAMADAS ESPELHO (e no minimapa, abaixo), e não é
  // detalhe: o WebView2 mantém uma árvore de acessibilidade da página e a
  // reconstrói a cada mudança no DOM. Com os milhares de <span> do Prism
  // dentro dela, cada tecla custava ~20ms só de acessibilidade — medido no
  // `index.html` deste programa em 04/09/2026. O que se lê por leitor de tela é
  // o textarea, que continua acessível; o <pre> e a régua são decoração.
  pilha.innerHTML = `
    <div class="ed-gutter" aria-hidden="true"><div class="ed-gutter-inner"></div></div>
    <pre class="ed-pre" aria-hidden="true"><code class="ed-pre-inner"></code></pre>
    <textarea class="ed-ta" spellcheck="false" autocomplete="off"
              autocorrect="off" autocapitalize="off" wrap="off"></textarea>`;
  hospedeiro.appendChild(pilha);

  const caixaRegua = pilha.querySelector('.ed-gutter');
  const caixaPre   = pilha.querySelector('.ed-pre');
  const gutter = pilha.querySelector('.ed-gutter-inner');
  const pre    = pilha.querySelector('.ed-pre-inner');
  const ta     = pilha.querySelector('.ed-ta');

  const chamadas = { aoMudar: null, aoSalvar: null, aoBuscar: null, aoJanela: null,
                     // M5 · qual arquivo está aberto — a consulta de
                     // autocomplete o leva na pergunta. A superfície não sabe
                     // disso sozinha; quem sabe é o painel.
                     arquivoAtual: null };

  // ── Minimapa (Obra 10) ── Sibling de `.ed-pilha` dentro de `.ed-corpo`
  // (que é `display:flex`), de propósito: não entra dentro de `.ed-pilha`,
  // que é território exclusivo do trio textarea/pre/régua com métrica travada
  // (ver o aviso no topo deste arquivo). O minimapa é só uma cópia visual —
  // zero risco pro alinhamento cursor↔texto.
  const minimapa = document.createElement('div');
  minimapa.className = 'ed-minimapa hidden';
  const minimapaInner = document.createElement('div');
  minimapaInner.className = 'ed-pre-inner ed-minimapa-inner';
  const minimapaViewport = document.createElement('div');
  minimapaViewport.className = 'ed-minimapa-viewport';
  minimapa.append(minimapaInner, minimapaViewport);
  minimapa.setAttribute('aria-hidden', 'true');
  hospedeiro.appendChild(minimapa);

  // ⚠️ AS MEDIDAS DO MINIMAPA FICAM GUARDADAS, E NÃO SÃO LIDAS NA ROLAGEM.
  // `ta.scrollHeight` e `minimapaInner.scrollHeight` são leituras que FORÇAM
  // LAYOUT: pedir o número obriga o navegador a remedir a árvore inteira antes
  // de responder, e o clone do minimapa é uma cópia do arquivo todo. Pedi-las
  // a cada tique de rolagem era o que fazia a rolagem parar de responder num
  // arquivo grande — 8.000 <span> remedidos por tique, medido no `index.html`
  // do próprio programa (905 linhas). Elas só mudam quando o CONTEÚDO ou a
  // CAIXA mudam, e é só nesses dois momentos que `_edMmMedir` roda.
  let _edMmEscala = 1;
  let _edMmAlturaClone = 1;     // altura do clone em tamanho real, antes da escala
  let _edMmAlturaTa = 1;        // altura total do texto dentro do textarea
  let _edMmAlturaVisivel = 1;   // altura da parte visível do textarea

  // ⚠️ MEDIDA DE CAIXA VAZIA NÃO SERVE, E É PIOR QUE MEDIDA NENHUMA. O
  // `ResizeObserver` abaixo dispara também quando a pilha está oculta (é
  // `pintarBarraAcoes` quem põe e tira o `hidden`) e quando a aba não está à
  // vista: aí tudo mede zero, os `|| 1` viram 1, e a escala sai 0,3 em vez de
  // 0,03 — o minimapa aparece gigante e o retângulo do viewport vai parar no
  // lugar errado. Sem tamanho, as medidas anteriores ficam como estão e o clone
  // é marcado para ser refeito quando a caixa voltar a existir.
  function _edMmTemTamanho() {
    return minimapa.clientHeight > 0 && minimapaInner.scrollHeight > 0;
  }

  function _edMmMedir() {
    if (!_edMmTemTamanho()) { _edMmSujo = true; return false; }
    _edMmAlturaTa = ta.scrollHeight || 1;
    _edMmAlturaVisivel = ta.clientHeight || 1;
    _edMmAlturaClone = minimapaInner.scrollHeight || 1;
    return true;
  }

  // Encolhe o clone até ele caber inteiro na caixa, e refaz as medidas. É o
  // único lugar que lê `scrollHeight` do minimapa.
  // Refaz medida e escala; se o clone está sujo, é ele que precisa voltar.
  // ⚠️ Função local, e não `api.remedirMinimapa()`: o `ResizeObserver` abaixo é
  // criado ANTES de `const api`, e alcançá-lo de lá dava "Cannot access 'api'
  // before initialization" na primeira entrega do observador.
  function _edMmRemedir() {
    if (minimapa.classList.contains('hidden')) return;
    if (_edMmSujo) {
      if (!_edMmPendente) _edMmPendente = requestAnimationFrame(_edMmClonarAgora);
      return;
    }
    _edMmEscalar();
  }

  // ⚠️ NÃO PÕE `scale(1)` PARA MEDIR. `scrollHeight` e `clientHeight` são
  // medidas de LAYOUT, e transformação não entra no layout: o clone encolhido
  // devolve a mesma altura que devolveria em tamanho real. A versão anterior
  // trocava a escala para 1, media e voltava — duas escritas de estilo a mais
  // por chamada, e a chamada acontecia A CADA TECLA.
  function _edMmEscalar() {
    if (!_edMmMedir()) return;
    _edMmEscala = Math.min(0.3, minimapa.clientHeight / _edMmAlturaClone);
    minimapaInner.style.transform = `scale(${_edMmEscala})`;
    _edMmAtualizarViewport();
  }

  function _edMmAtualizarViewport() {
    const alturaEscalada = _edMmAlturaClone * _edMmEscala;
    const topoPx = (ta.scrollTop / _edMmAlturaTa) * alturaEscalada;
    const alturaPx = (_edMmAlturaVisivel / _edMmAlturaTa) * alturaEscalada;
    minimapaViewport.style.top = `${topoPx}px`;
    minimapaViewport.style.height = `${Math.max(4, alturaPx)}px`;
  }

  function _edMmScrollPara(clientY) {
    const r = minimapa.getBoundingClientRect();
    const fracao = ((clientY - r.top) / _edMmEscala) / _edMmAlturaClone;
    ta.scrollTop = Math.min(1, Math.max(0, fracao)) * (_edMmAlturaTa - _edMmAlturaVisivel);
    ta.dispatchEvent(new Event('scroll'));
  }

  let _edMmArrastando = false;
  minimapa.addEventListener('pointerdown', (e) => {
    _edMmArrastando = true;
    try { minimapa.setPointerCapture(e.pointerId); } catch (_) { /* segue sem captura */ }
    _edMmScrollPara(e.clientY);
  });
  minimapa.addEventListener('pointermove', (e) => { if (_edMmArrastando) _edMmScrollPara(e.clientY); });
  minimapa.addEventListener('pointerup', () => { _edMmArrastando = false; });

  // ── Sincronia de rolagem ──
  // Quem rola é o textarea; as outras duas são arrastadas atrás dele. A régua
  // segue só o eixo vertical porque não rola na horizontal — é por isso que
  // ela nunca sai de lugar quando o código é largo.
  // Rolar move o cursor de lugar na tela, e o popup ficaria pendurado onde o
  // texto não está mais. Fechar é mais honesto (e mais barato) que reposicionar.
  ta.addEventListener('blur', () => {
    if (typeof edAutocompleteFechar === 'function') edAutocompleteFechar();
  });

  ta.addEventListener('scroll', () => {
    // `translate` negativo, não `scrollTop`: o deslocamento pedido é sempre o
    // aplicado, sem o teto de `scrollHeight - clientHeight` que fazia as
    // camadas espelho travarem 6px antes do fim do arquivo.
    pre.style.transform = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`;
    gutter.style.transform = `translateY(${-ta.scrollTop}px)`;
    _edMmAtualizarViewport();
    // A vista andou: o que chegou perto dela ganha cor no próximo quadro.
    _edSupJanelaAgendar();
  });

  // Duas medidas que não cabem no CSS porque dependem do conteúdo.
  //
  // 1. A régua ocupa a esquerda, e a largura dela muda com o número de dígitos
  //    (linha 9 → linha 10000).
  //
  // 2. A caixa do <pre> começa onde a régua termina, e o textarea reserva a
  //    mesma faixa como preenchimento à esquerda — é o que põe a coluna 1 das
  //    duas camadas no mesmo x.
  function ajustarMargem() {
    // Em modo fantasma a caixa da régua recebe a largura do <pre>, então medi-la
    // devolveria a largura errada — reusa-se a última medida feita como texto
    // simples. Fora do modo fantasma a caixa é absoluta com só `left`
    // declarado, e a largura dela é a do conteúdo (shrink-to-fit).
    const largura = gutter.classList.contains('ed-gutter--fantasma')
      ? _edSupLarguraDaRegua
      : Math.ceil(caixaRegua.getBoundingClientRect().width);
    if (!largura) return;
    _edSupLarguraDaRegua = largura;
    caixaRegua.style.width = `${largura}px`;
    caixaPre.style.left = `${largura}px`;
    ta.style.paddingLeft = `${largura + 14}px`;
    // A barra de rolagem vertical do textarea é permanente (`overflow-y:
    // scroll`), então esta medida é constante — e é ela que recua as camadas
    // espelho para elas quebrarem na MESMA coluna que o textarea.
    document.documentElement.style.setProperty(
      '--ed-barra', `${ta.offsetWidth - ta.clientWidth}px`);
  }
  let _edSupLarguraDaRegua = 0;

  function quebrando() {
    return getComputedStyle(pre).whiteSpace === 'pre-wrap';
  }

  // Quantas linhas a régua está mostrando agora, ou -1 quando ela é o espelho
  // fantasma (que não pode ser reaproveitado). Ver o guarda em `pintarRegua`.
  let _edSupLinhasDaRegua = -1;

  function pintarRegua() {
    const linhas = ta.value.split('\n');
    if (!quebrando()) {
      // ⚠️ FORA DO MODO QUEBRA A RÉGUA SÓ DEPENDE DA CONTAGEM DE LINHAS —
      // digitar dentro de uma linha não muda um número sequer. Sem este
      // guarda, abrir um arquivo repintava a régua três a quatro vezes (a
      // superfície, a pintura, o zoom e o ResizeObserver, cada um pedindo a
      // sua) e cada tecla pedia mais uma. A margem continua sendo
      // recalculada: ela depende do corpo da fonte, que o zoom muda sem
      // mexer nas linhas.
      if (linhas.length === _edSupLinhasDaRegua) { ajustarMargem(); return; }
      _edSupLinhasDaRegua = linhas.length;
      // Sem quebra, linha lógica = linha visual: um nó de texto só resolve, e o
      // alinhamento sai de graça. Um <span> por linha é o que o plugin
      // `line-numbers` do Prism faz — 5000 elementos à toa, e ele ainda mexe no
      // padding do `pre`, que é o que não pode.
      gutter.classList.remove('ed-gutter--fantasma');
      gutter.style.width = '';
      gutter.textContent = linhas.map((_, i) => i + 1).join('\n');
      ajustarMargem();
      return;
    }
    // O espelho fantasma depende da LARGURA e do texto de cada linha, e não
    // só da contagem: nunca é reaproveitado, e a próxima régua simples
    // também precisa ser refeita do zero.
    _edSupLinhasDaRegua = -1;
    // ⚠️ COM QUEBRA, A RÉGUA VIRA UM ESPELHO FANTASMA. Cada linha lógica vira um
    // bloco com o TEXTO dela em transparente, na mesma largura e métrica do
    // <pre>: a altura do bloco passa a ser a altura real daquela linha na tela,
    // por construção, sem medir nada. O número vai por cima, absoluto.
    //
    // Sem isto a régua MENTE: ela é um bloco de texto ("1\n2\n3"), e uma linha
    // que ocupa três linhas visuais empurra todos os números abaixo dela.
    // Mede a régua como texto simples ANTES de virar fantasma: em modo fantasma
    // a caixa tem a largura do <pre>, então ela deixa de poder ser medida — e
    // na primeira pintura não haveria medida anterior nenhuma para reusar.
    gutter.classList.remove('ed-gutter--fantasma');
    gutter.style.width = '';
    gutter.textContent = linhas.map((_, i) => i + 1).join('\n');
    ajustarMargem();

    gutter.classList.add('ed-gutter--fantasma');
    // ⚠️ LARGURA E PREENCHIMENTO COPIADOS DO <pre> EM TEMPO DE EXECUÇÃO, e não
    // declarados no CSS. É a largura de CONTEÚDO que decide onde o texto quebra,
    // e ela é `largura da caixa - padding`: deixar o padding no CSS significa
    // manter dois números iguais em dois arquivos, que é exatamente o que o
    // seletor único de métricas existe para impedir. Com 20px de diferença o
    // fantasma quebrava a linha minificada num ponto diferente do <pre>, e todos
    // os números abaixo dela desciam — e pior, às vezes NÃO desciam, porque o
    // arredondamento salvava por acaso. Copiado, não pode divergir.
    const estiloDoPre = getComputedStyle(pre);
    gutter.style.width = `${pre.clientWidth}px`;
    gutter.style.paddingLeft = estiloDoPre.paddingLeft;
    gutter.style.paddingRight = estiloDoPre.paddingRight;
    // O número ocupa a faixa visível da régua, terminando 10px antes da borda.
    const larguraDoNumero = Math.max(20, _edSupLarguraDaRegua - 10);
    gutter.innerHTML = linhas.map((linha, i) =>
      `<div class="ed-gutter-linha"><i style="width:${larguraDoNumero}px">${i + 1}</i>`
      + `${escapeHtml(linha) || '&nbsp;'}</div>`).join('');
    ajustarMargem();
  }

  function desindentar() {
    // Tira até uma indentação do começo da linha do cursor: seleciona o pedaço
    // e manda `insertText` vazio — de novo, para não sair da pilha de desfazer.
    // A largura sai da configuração, a mesma da tecla Tab e a mesma do `--ed-tab`.
    const largura = indentacaoDoEditor().largura;
    const pos = ta.selectionStart;
    const inicio = ta.value.lastIndexOf('\n', pos - 1) + 1;
    const cabeca = ta.value.slice(inicio, inicio + largura);
    const quantos = cabeca.length - cabeca.replace(new RegExp(`^ {1,${largura}}`), '').length;
    if (!quantos) return;
    ta.setSelectionRange(inicio, inicio + quantos);
    document.execCommand('insertText', false, '');
    ta.setSelectionRange(Math.max(inicio, pos - quantos), Math.max(inicio, pos - quantos));
  }

  // O teclado que só faz sentido com o cursor dentro do texto. Ctrl+F e Ctrl+S
  // também são tratados no `keydown` da aba (editor.js), para funcionarem com
  // o foco na árvore; aqui eles chegam primeiro e param a propagação.
  ta.addEventListener('keydown', (e) => {
    // ⚠️ M5 · O AUTOCOMPLETE VÊ A TECLA PRIMEIRO, e só enquanto o popup está
    // ABERTO. Fechado, `edAutocompleteTecla` devolve false na primeira linha e
    // nada aqui muda — inclusive o Tab, que continua indentando, e o Enter,
    // que continua quebrando linha. Um autocomplete que come o Enter é a
    // reclamação clássica de editor, e é por isso que a guarda é o popup
    // estar aberto, e não haver extensão ligada.
    if (typeof edAutocompleteTecla === 'function' && edAutocompleteTecla(e)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) desindentar();
      else document.execCommand('insertText', false, indentacaoDoEditor().texto);
      return;
    }
    const atalho = e.ctrlKey || e.metaKey;
    if (atalho && e.key.toLowerCase() === 's') {
      e.preventDefault();
      // ⚠️ `stopPropagation` É OBRIGATÓRIO AQUI, apesar do comentário acima já
      // prometer isso. Sem ele, o MESMO Ctrl+S borbulha até o `keydown` de
      // `document` (editor.js) e chama `salvar()` DE NOVO — mascarado pela
      // guarda "nada mudou" de `salvarArquivoDoPainel`, então o Ctrl+S parecia
      // funcionar. O Ctrl+F abaixo não tinha essa sorte: `localizador.alternar()`
      // não é idempotente, e o segundo disparo fechava o achador no mesmo golpe
      // que o primeiro abria — Ctrl+F "não fazia nada". Medido em 31/08/2026.
      e.stopPropagation();
      if (chamadas.aoSalvar) chamadas.aoSalvar();
    } else if (atalho && e.key.toLowerCase() === 'f' && !e.shiftKey) {
      // Ctrl+Shift+F é "buscar e substituir no PROJETO" (Obra 13) — sem o
      // guarda de Shift aqui, este handler disputaria o Ctrl+Shift+F com o
      // `keydown` de `document` (editor.js), que é quem trata esse combo.
      e.preventDefault();
      e.stopPropagation();
      if (chamadas.aoBuscar) chamadas.aoBuscar();
    }
  });

  ta.addEventListener('input', () => {
    if (chamadas.aoMudar) chamadas.aoMudar();
    // M5 · sai num `Map.size` quando não há extensão de tipo 27 ligada — ver
    // o cabeçalho de `editor-autocomplete.js`.
    if (typeof edAutocompleteAoDigitar === 'function') {
      edAutocompleteAoDigitar(ta, typeof currentProject !== 'undefined' ? currentProject : '',
                              chamadas.arquivoAtual ? chamadas.arquivoAtual() : '');
    }
  });
  // A dica ao passar o mouse (fase 12) — sai num `Map.size` sem extensão de dica
  // ligada; ver o cabeçalho de `editor-dica.js`.
  ta.addEventListener('mousemove', (e) => {
    if (typeof edDicaAoMover === 'function') edDicaAoMover(ta, e, typeof currentProject !== 'undefined' ? currentProject : '', chamadas.arquivoAtual ? chamadas.arquivoAtual() : '');
  });
  ta.addEventListener('mouseleave', () => { if (typeof edDicaFechar === 'function') edDicaFechar(); });

  // Redimensionar a janela ou arrastar a divisória muda a caixa, e a régua pode
  // precisar de outra largura.
  //
  // ⚠️ EM MODO QUEBRA ISTO REPINTA A RÉGUA INTEIRA, e não é exagero: o espelho
  // fantasma quebra na largura do <pre>, então mudar essa largura muda quantas
  // linhas visuais cada linha lógica ocupa. E há um caso pior que o
  // redimensionar: `superficie.abrir()` roda ANTES de `pintarBarraAcoes()`
  // tirar o `hidden` da pilha, então na primeira pintura o <pre> mede ZERO e o
  // fantasma nasce com 0px de largura — cada caractere numa linha visual, uma
  // régua de 127.000px. É esta chamada que conserta, quando a pilha aparece.
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      if (quebrando()) pintarRegua();
      else ajustarMargem();
      // A caixa mudou de tamanho: a escala do minimapa e as medidas que a
      // rolagem usa saem de validade junto.
      _edMmRemedir();
      _edSupJanelaAgendar();
    }).observe(pilha);
  }

  // ══ A JANELA — só o que está perto da vista ganha cor ══
  //
  // ⚠️ O ARQUIVO INTEIRO FICA NO <pre>, MAS SÓ UMA JANELA DELE TEM <span>. Cada
  // bloco de ~50 linhas que `editor-pintura.js` entrega vira um filho do <pre>,
  // e um filho está em um de dois estados: COLORIDO (o HTML do Prism, dezenas
  // de <span>) ou CRU (um nó de texto só, com o mesmo texto). Os dois têm a
  // MESMA altura — mesma fonte, mesma entrelinha, mesmas quebras — então trocar
  // um pelo outro não move nada, e o alinhamento com o textarea não depende de
  // conta nenhuma.
  //
  // Colorido fica só o que está a até uma altura de vista da parte visível;
  // o que se afasta mais de três alturas volta a cru. O resto do arquivo é
  // texto simples: barato de medir, barato de pintar, e sem nada para a árvore
  // de acessibilidade mastigar.
  //
  // Por que isto existe: com todos os blocos coloridos, o `index.html` deste
  // programa punha 7.700 <span> no <pre> — e o WebView2 refazia layout, pintura
  // e acessibilidade dos 7.700 a cada tecla, ~200ms por tecla, medido em
  // 04/09/2026. O JavaScript era a menor parte da conta; a maior era o
  // navegador. Com a janela, o número de <span> passa a depender do tamanho da
  // tela, não do tamanho do arquivo.
  //
  // ⚠️ O TEXTO NUNCA SAI DO DOM, e isto é o que mantém tudo o mais funcionando
  // sem saber da janela: `espelharMudanca` caminha pelo texto do <pre>, o
  // Ctrl+F (`editor-localizar.js`) marca nós de texto, o sublinhado de erro
  // (`editor-lint.js`) conta linhas pelo texto. Bloco cru é texto do mesmo
  // jeito. O único aviso que eles precisam é `aoJanela`: promover ou rebaixar
  // um bloco refaz o conteúdo dele, e as marcas que estavam dentro somem —
  // `editor-painel.js` responde reaplicando as duas.
  //
  // ⚠️ CADA BLOCO É UM ELEMENTO PRÓPRIO, E É ISSO QUE MANTÉM OS ÍNDICES VÁLIDOS.
  // O Ctrl+F e o lint enfiam nós DENTRO de um bloco, e um deles ainda chama
  // `pre.normalize()`: a quantidade de filhos do <pre> não muda, e a comparação
  // por índice continua de pé. Pelo mesmo motivo a comparação é contra
  // `_edSupBlocos` (o que a pintura mandou), nunca contra o DOM.
  //
  // Um descritor de bloco é `{ html, cru }`. Com `html` nulo o bloco não tem
  // cor para receber (arquivo grande sem cor) e fica cru sempre.

  // O texto que o <pre> está espelhando agora, com a quebra de linha final. É a
  // base de comparação de `espelharMudanca` — sem ele não há como saber o que
  // mudou desde a última vez.
  let _edSupEspelhado = '';

  // ⚠️ ESPELHA SÓ O TRECHO EDITADO, E É POR ISSO QUE A COR PARA DE PISCAR.
  // `espelharCru()` troca o <pre> inteiro por um nó de texto: o arquivo todo
  // perde a cor a cada tecla e só recupera na repintura seguinte. Digitar um
  // ponto muda um punhado de caracteres dentro de UM nó de texto — mexer só
  // nele deixa o resto do arquivo colorido, intacto, e custa uma atribuição.
  //
  // A cor DAQUELE token fica velha até a repintura (120ms depois): o caractere
  // recém-digitado herda a cor do trecho onde caiu. É o comportamento de
  // qualquer editor com colorização adiada, e é incomparavelmente menos visível
  // que o arquivo inteiro perder a cor.
  //
  // Devolve `false` quando não dá para resolver dentro de um nó só — colar,
  // apagar uma seleção grande, desfazer. Aí quem chamou cai no espelho
  // completo, que é sempre correto.
  function espelharMudanca() {
    const novo = ta.value + '\n';
    const velho = _edSupEspelhado;
    if (novo === velho) return true;
    // ⚠️ A COMPARAÇÃO SÓ VALE SE O <pre> AINDA FOR O QUE ACHAMOS QUE ELE É. Se
    // alguém mais mexeu no texto dele, os deslocamentos calculados aqui apontam
    // para o lugar errado — e o estrago seria texto errado na tela, o único
    // erro que esta camada não pode cometer. Na dúvida, `false`.
    if (!velho || pre.textContent.length !== velho.length) return false;
    const limite = Math.min(novo.length, velho.length);
    let ini = 0;
    while (ini < limite && novo.charCodeAt(ini) === velho.charCodeAt(ini)) ini++;
    let cauda = 0;
    while (cauda < limite - ini
        && novo.charCodeAt(novo.length - 1 - cauda) === velho.charCodeAt(velho.length - 1 - cauda)) cauda++;
    const fimVelho = velho.length - cauda;
    const fimNovo = novo.length - cauda;

    // Acha o nó de texto que contém o trecho [ini, fimVelho). Caminha-se pelo
    // TEXTO e não pelos filhos: o <pre> tem nós que a pintura não pôs — as
    // marcas do Ctrl+F e o sublinhado de erro — e os <span> de bloco, que põem
    // tudo um nível mais fundo.
    const caminhante = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
    let pos = 0;
    let no = caminhante.nextNode();
    while (no && pos + no.nodeValue.length < ini) { pos += no.nodeValue.length; no = caminhante.nextNode(); }
    if (!no) return false;
    // O trecho tem de caber neste nó: atravessando a fronteira, os <span> do
    // meio teriam de sair, e o espelho completo sai mais barato que acertar
    // isso na mão.
    if (pos + no.nodeValue.length < fimVelho) return false;
    no.nodeValue = no.nodeValue.slice(0, ini - pos)
                 + novo.slice(ini, fimNovo)
                 + no.nodeValue.slice(fimVelho - pos);
    _edSupEspelhado = novo;
    // Sem blocos (arquivo grande, sem cor) o minimapa é uma cópia do texto, e
    // ela acabou de ficar velha. A repintura que vem atrás refaz.
    if (!_edSupDescritores.length) _edMmSujo = true;
    return true;
  }

  let _edSupBlocos = [];        // a chave de cada bloco que está na tela, em ordem
  let _edSupDescritores = [];   // os blocos como a pintura entregou: { html, cru }
  let _edSupLinhas = -1;        // quantas linhas o texto tinha na última pintura
  let _edSupJanelaPendente = 0;

  // Em alturas de vista: até onde se colore, e a partir de onde se descolore.
  // A folga entre os dois é o que impede um bloco na fronteira de ficar
  // trocando de estado a cada tique de rolagem.
  const _EDSUP_MARGEM_VISTAS = 1;
  const _EDSUP_LIMITE_VISTAS = 3;

  function _edSupChave(d) {
    return d.html === null ? 'C' + d.cru : 'H' + d.html;
  }

  function _edSupPreencher(el, d, colorido) {
    if (colorido && d.html !== null) { el.innerHTML = d.html; el._colorido = true; }
    else { el.textContent = d.cru; el._colorido = false; }
  }

  // Bloco novo nasce cru: se estiver perto da vista, `_edSupJanela` o colore
  // no mesmo passo, antes de o quadro ser pintado — ninguém vê o cru.
  function _edSupNovoBloco(d) {
    const el = document.createElement('span');
    el.className = 'ed-bl';
    _edSupPreencher(el, d, false);
    return el;
  }

  // Promove o que chegou perto da vista e rebaixa o que se afastou. Duas
  // passadas de propósito — primeiro TODAS as leituras de `offsetTop`, depois
  // TODAS as escritas: leitura e escrita intercaladas forçariam um layout por
  // bloco. Devolve se algum bloco mudou de estado.
  function _edSupJanela() {
    _edSupJanelaPendente = 0;
    const filhos = pre.childNodes;
    if (!filhos.length || filhos.length !== _edSupDescritores.length) return false;
    const vista = ta.clientHeight || 0;
    // Pilha escondida (aba fechada, arquivo binário na frente) mede zero: sem
    // vista não há perto nem longe, e o estado dos blocos fica como está até a
    // caixa voltar — o `ResizeObserver` chama de novo nessa hora.
    if (!vista) return false;
    const topo = ta.scrollTop;
    const perto0 = topo - vista * _EDSUP_MARGEM_VISTAS;
    const perto1 = topo + vista * (1 + _EDSUP_MARGEM_VISTAS);
    const longe0 = topo - vista * _EDSUP_LIMITE_VISTAS;
    const longe1 = topo + vista * (1 + _EDSUP_LIMITE_VISTAS);
    const promover = [];
    const rebaixar = [];
    for (let i = 0; i < filhos.length; i++) {
      const el = filhos[i];
      const t = el.offsetTop;
      const b = t + el.offsetHeight;
      if (b > perto0 && t < perto1) { if (!el._colorido && _edSupDescritores[i].html !== null) promover.push(i); }
      else if ((b < longe0 || t > longe1) && el._colorido) rebaixar.push(i);
    }
    promover.forEach((i) => _edSupPreencher(filhos[i], _edSupDescritores[i], true));
    rebaixar.forEach((i) => _edSupPreencher(filhos[i], _edSupDescritores[i], false));
    const mudou = promover.length + rebaixar.length > 0;
    if (mudou && chamadas.aoJanela) chamadas.aoJanela();
    return mudou;
  }

  // Uma por quadro, no máximo: a rolagem dispara dezenas de eventos por segundo.
  function _edSupJanelaAgendar() {
    if (_edSupJanelaPendente || !_edSupDescritores.length) return;
    _edSupJanelaPendente = requestAnimationFrame(_edSupJanela);
  }

  function _edSupContarLinhas() {
    const texto = ta.value;
    let n = 1;
    for (let q = texto.indexOf('\n'); q >= 0; q = texto.indexOf('\n', q + 1)) n++;
    return n;
  }

  // ── Minimapa ──
  // O clone é montado dos DESCRITORES, não do <pre>: o <pre> só tem cor perto da
  // vista, e o minimapa precisa do arquivo inteiro colorido. Cada bloco do clone
  // é também um elemento próprio (`.ed-bl`, layout independente), então trocar
  // um bloco lá não remede os outros.
  function _edMmNovoBloco(d) {
    const el = document.createElement('span');
    el.className = 'ed-bl';
    if (d.html === null) el.textContent = d.cru;
    else el.innerHTML = d.html;
    return el;
  }

  // Clonagem completa para o minimapa — abertura de arquivo, ligar o minimapa,
  // ou quando ele saiu de sincronia. Uma por quadro, no máximo: a abertura de um
  // arquivo pedia esta clonagem DUAS vezes (uma pela pintura, outra por
  // `mostrarMinimapa`), e o `requestAnimationFrame` funde as duas sem que nenhum
  // chamador precise saber da outra.
  let _edMmPendente = 0;
  // O minimapa está fora de sincronia e precisa de clonagem completa. Nasce
  // ligado (não há clone nenhum ainda) e só desliga quando uma clonagem ou um
  // espelhamento incremental termina.
  let _edMmSujo = true;

  function _edMmClonarAgora() {
    _edMmPendente = 0;
    if (minimapa.classList.contains('hidden')) return;
    if (_edSupDescritores.length) {
      const frag = document.createDocumentFragment();
      _edSupDescritores.forEach((d) => frag.appendChild(_edMmNovoBloco(d)));
      minimapaInner.textContent = '';
      minimapaInner.appendChild(frag);
    } else {
      // Sem blocos (arquivo sem cor), o minimapa é o texto cru mesmo.
      minimapaInner.textContent = pre.textContent;
    }
    _edMmSujo = false;
    _edMmEscalar();
  }

  // Espelha no minimapa a MESMA faixa de blocos que acabou de mudar no <pre>.
  // Só serve enquanto os dois têm a mesma quantidade de filhos — fora disso o
  // clone completo é o único jeito de voltar a bater.
  //
  // ⚠️ SÓ REMEDE QUANDO A ALTURA PODE TER MUDADO. Sem quebra de linha a altura
  // do clone é a contagem de linhas vezes a entrelinha: digitar dentro de uma
  // linha não muda nada, e a medida (que força layout) era o item mais caro de
  // cada tecla. Com quebra, qualquer caractere pode virar linha visual nova, e
  // aí mede-se sempre.
  function _edMmEspelharTroca(d, alturaMudou) {
    // Escondido não se espelha: o clone fica velho e a marca de sujo garante
    // que ele seja refeito inteiro quando o minimapa voltar a aparecer.
    if (minimapa.classList.contains('hidden')) { _edMmSujo = true; return; }
    if (_edMmPendente) { _edMmSujo = true; return; }
    if (_edMmSujo || minimapaInner.childNodes.length !== d.filhosAntes) {
      _edMmSujo = true;
      _edMmPendente = requestAnimationFrame(_edMmClonarAgora);
      return;
    }
    const velhos = Array.prototype.slice.call(minimapaInner.childNodes);
    const ancora = velhos[d.fimVelho] || null;
    for (let i = d.ini; i < d.fimVelho; i++) minimapaInner.removeChild(velhos[i]);
    const frag = document.createDocumentFragment();
    for (let i = d.ini; i < d.fimNovo; i++) frag.appendChild(_edMmNovoBloco(_edSupDescritores[i]));
    minimapaInner.insertBefore(frag, ancora);
    _edMmSujo = false;
    if (alturaMudou) _edMmEscalar();
  }

  // A faixa de linhas que está COLORIDA agora, 1-indexado e inclusivo. É o que
  // o ponto `editor.decorador` entrega em `contexto.visivel`: uma extensão com
  // muitas marcas (uma cor por coluna num CSV de 3.000 linhas) devolve só as
  // dessa faixa, e o teto de 150ms deixa de ser problema.
  //
  // ⚠️ Sem blocos, o arquivo inteiro é um nó de texto cru e não há faixa
  // nenhuma: devolve o arquivo todo. É o caso do arquivo grande sem cor e o da
  // linguagem sem gramática — nos dois, marcar tudo é o certo.
  function janelaVisivel() {
    const total = ta.value.split('\n').length || 1;
    const filhos = pre.childNodes;
    if (!_edSupDescritores.length || filhos.length !== _edSupDescritores.length) {
      return { de: 1, ate: total };
    }
    let linha = 1;
    let de = 0;
    let ate = 0;
    for (let i = 0; i < _edSupDescritores.length; i++) {
      const cru = _edSupDescritores[i].cru || '';
      let quebras = 0;
      for (let q = cru.indexOf('\n'); q >= 0; q = cru.indexOf('\n', q + 1)) quebras++;
      // Bloco fechado numa quebra consome exatamente `quebras` linhas; o último
      // pode não terminar em quebra e aí consome uma a mais. Mesma conta de
      // `_edPinFatiar`, do outro lado.
      const consome = cru.endsWith('\n') ? quebras : quebras + 1;
      if (filhos[i]._colorido) {
        if (!de) de = linha;
        ate = linha + Math.max(0, consome - 1);
      }
      linha += consome;
    }
    return de ? { de, ate: Math.min(ate, total) } : { de: 1, ate: 0 };
  }

  const api = {
    pilha, pre, ta, gutter,

    janelaVisivel,

    // ⚠️ O ÚNICO lugar que atribui a `ta.value`, e só na abertura do arquivo:
    // é aqui que a pilha de desfazer daquele arquivo nasce zerada, que é o
    // certo — desfazer não pode atravessar de um arquivo para o outro.
    abrir(texto) {
      // ⚠️ `wrap` só se troca na ABERTURA. Mudá-lo com o arquivo aberto faz o
      // Chromium recriar o editor interno do textarea, e a pilha de desfazer
      // nativa vai junto — o preço que este editor não pode pagar. Por isso a
      // configuração de quebra vale a partir do próximo arquivo aberto.
      ta.wrap = getComputedStyle(pre).whiteSpace === 'pre-wrap' ? 'soft' : 'off';
      ta.value = texto;
      // ⚠️ O CURSOR VAI PARA O COMEÇO, E NÃO É COSMÉTICO. Atribuir a `value`
      // deixa o cursor no FIM do texto (comportamento do Chromium), e o
      // `ta.scrollTop = 0` logo abaixo não segura: quem abre o arquivo chama
      // `superficie.focar()` DEPOIS (editor-painel.js), e `focus()` rola o cursor
      // para dentro da vista — ou seja, para o fim do arquivo. O usuário via todo
      // arquivo abrir na última linha, e num arquivo de 900 linhas isso ainda
      // obrigava o navegador a resolver a rolagem do documento inteiro na
      // abertura. Relatado em 04/09/2026.
      ta.setSelectionRange(0, 0);
      // O <pre> ainda mostra o arquivo anterior: até `espelharCru` ou
      // `pintarBlocos` passarem por aqui, não há base de comparação válida.
      _edSupEspelhado = '';
      _edSupDescritores = [];
      _edSupLinhas = -1;
      ta.scrollTop = 0;
      ta.scrollLeft = 0;
      pintarRegua();
      // O texto é outro: o clone e as medidas guardadas não valem mais.
      _edMmSujo = true;
      _edMmMedir();
      _edMmAtualizarViewport();
    },

    // Cópia do `<pre>` já colorido, escalada para caber inteira no minimapa —
    // é o que faz o retângulo do viewport (abaixo) se mover em proporção real
    // ao arquivo, não só à parte visível. Agendada para o próximo quadro: ver
    // `_edMmClonarAgora`, que explica por que uma só por quadro basta.
    atualizarMinimapa() {
      if (minimapa.classList.contains('hidden') || _edMmPendente || !_edMmSujo) return;
      _edMmPendente = requestAnimationFrame(_edMmClonarAgora);
    },

    // A porta ÚNICA da pintura colorida. `editor-pintura.js` entrega os blocos
    // prontos e aqui entra na tela só o que mudou, no <pre> e no minimapa.
    // Ver `_edSupBlocos`, acima, para o porquê de cada decisão.
    pintarBlocos(descritores) {
      _edSupEspelhado = ta.value + '\n';
      // Ressincroniza quando o <pre> não é mais o que esta função deixou lá:
      // `espelharCru()` o reduz a um nó de texto só, e o primeiro arquivo de
      // uma sessão chega aqui com ele vazio.
      if (pre.childNodes.length !== _edSupBlocos.length) {
        pre.textContent = '';
        _edSupBlocos = [];
      }
      const chaves = descritores.map(_edSupChave);
      const velhas = _edSupBlocos;
      const limite = Math.min(velhas.length, chaves.length);
      let ini = 0;
      while (ini < limite && velhas[ini] === chaves[ini]) ini++;
      let fim = 0;
      while (fim < limite - ini && velhas[velhas.length - 1 - fim] === chaves[chaves.length - 1 - fim]) fim++;
      const fimVelho = velhas.length - fim;
      const fimNovo = chaves.length - fim;
      _edSupDescritores = descritores;
      const linhas = _edSupContarLinhas();
      const alturaMudou = linhas !== _edSupLinhas || quebrando();
      _edSupLinhas = linhas;
      if (ini === fimVelho && ini === fimNovo) { _edSupJanela(); return; }

      const filhosAntes = pre.childNodes.length;
      const filhos = Array.prototype.slice.call(pre.childNodes);
      // O primeiro bloco do sufixo preservado continua no lugar: serve de âncora
      // depois das remoções.
      const ancora = filhos[fimVelho] || null;
      for (let i = ini; i < fimVelho; i++) pre.removeChild(filhos[i]);
      const frag = document.createDocumentFragment();
      for (let i = ini; i < fimNovo; i++) frag.appendChild(_edSupNovoBloco(descritores[i]));
      pre.insertBefore(frag, ancora);
      _edSupBlocos = chaves;
      // Colore o que está perto da vista AGORA, no mesmo passo — o bloco que
      // acabou de ser trocado está quase sempre nela.
      _edSupJanela();
      _edMmEspelharTroca({ ini, fimVelho, fimNovo, filhosAntes }, alturaMudou);
    },

    mostrarMinimapa(sim) {
      minimapa.classList.toggle('hidden', !sim);
      // `--ed-minimapa-largura` em `.ed-corpo` (o `hospedeiro`) — é o que
      // `.ed-find` (editor.css) lê pra recuar e nunca desenhar por cima do
      // minimapa. 90px tem que bater com o `width` de `.ed-minimapa` lá.
      hospedeiro.style.setProperty('--ed-minimapa-largura', sim ? '90px' : '0px');
      if (sim) this.atualizarMinimapa();
    },

    // Só as medidas, sem clonar nada — para quem mudou a CAIXA e não o texto.
    // A exceção é o clone estar marcado como sujo: aí a caixa acabou de voltar a
    // ter tamanho (a aba reapareceu, a pilha saiu do `hidden`) e o que falta é a
    // clonagem que não deu para fazer enquanto não havia onde desenhar.
    remedirMinimapa: _edMmRemedir,

    get texto() { return ta.value; },

    focar() { ta.focus(); },

    // O `pre` recebe o texto CRU, síncrono, a cada tecla — a cor vem depois,
    // com atraso. É a inversão que importa: o que o usuário lê é o `pre`, então
    // um `pre` atrasado não seria "cor atrasada", seria TEXTO ERRADO na tela.
    // Ver `editor-pintura.js`.
    espelharCru() {
      _edSupEspelhado = ta.value + '\n';
      // O <pre> deixa de ser a lista de blocos, e a chave de comparação cai
      // junto: senão a próxima pintura casaria índices com o que não existe.
      _edSupBlocos = [];
      _edSupDescritores = [];
      _edMmSujo = true;
      // O \n extra no fim: o <pre> não reserva altura para a última quebra e o
      // textarea reserva. Sem ele, a última linha fica um pouco acima do cursor.
      pre.textContent = ta.value + '\n';
    },

    espelharMudanca,
    pintarRegua,
    ajustarMargem,

    // Rolar é sempre pelo textarea: mexer no `scrollTop` do `pre` o
    // dessincroniza na hora, porque ele é escravo e não avisa ninguém.
    rolarPara(topo) {
      ta.scrollTop = topo;
      // O evento `scroll` só dispara se o valor mudou de fato; chamar o
      // espelhamento à mão cobre o caso em que já se estava naquele ponto.
      ta.dispatchEvent(new Event('scroll'));
    },

    // Vai para uma linha específica (1-based) — "Ctrl+clique vai para
    // definição" (Editor, Obra 11). Rola deixando a linha perto do topo, não
    // colada nele, pra dar contexto do que vem antes.
    irParaLinha(n) {
      const linhas = ta.value.split('\n');
      let pos = 0;
      for (let i = 0; i < Math.min(n - 1, linhas.length); i++) pos += linhas[i].length + 1;
      ta.focus();
      ta.setSelectionRange(pos, pos);
      const alturaPorLinha = (ta.scrollHeight || 0) / (linhas.length || 1);
      ta.scrollTop = Math.max(0, alturaPorLinha * (n - 1) - ta.clientHeight / 3);
      ta.dispatchEvent(new Event('scroll'));
    },

    posicaoDoCursor() {
      const ate = ta.value.slice(0, ta.selectionStart);
      const linhas = ate.split('\n');
      return { linha: linhas.length, coluna: linhas[linhas.length - 1].length + 1 };
    },

    ligar(callbacks) { Object.assign(chamadas, callbacks || {}); },

    somenteLeitura(sim) { ta.readOnly = !!sim; },
  };

  return api;
}
