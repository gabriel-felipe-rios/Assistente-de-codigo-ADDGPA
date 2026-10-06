// ═══════════════════════════ EDITOR: A DICA AO PASSAR O MOUSE ══
// O balão que aparece quando o mouse PARA sobre uma palavra do código. Nasceu
// com a fase 12 de "Configurações, extensões lidas e Como adicionar" —
// Recursos do Editor › dica ao passar o mouse (D38). Irmão de
// `editor-autocomplete.js`, e pela mesma divisão:
//
// ⚠️ **O BALÃO É PEÇA DO PROGRAMA; O TEXTO É DA EXTENSÃO.** A extensão responde
// a consulta `editor.dica` com `[{ texto }]` e para por aí. Duas extensões
// respondendo a mesma palavra dividem o MESMO balão (as respostas se somam).
//
// ⚠️ **SEM EXTENSÃO DE DICA LIGADA, ESTE ARQUIVO NÃO FAZ NADA.** O `mousemove`
// dispara dezenas de vezes por segundo, e a primeira linha de `edDicaAoMover`
// é `xtAlguemResponde(...)` — um `Map.size`. É esse o custo total da dica para
// quem nunca ligou uma extensão. A conta de (linha, coluna) só vem DEPOIS da
// pausa, e nunca há ida ao backend.
//
// ⚠️ **O MOUSE ESTÁ SOBRE O `<textarea>`, E ELE NÃO DIZ EM QUE CARACTERE.** O
// `<pre>` pintado, que tem o texto em nós de verdade, é `pointer-events: none`
// (é o textarea que recebe o clique). Depois da pausa, por um instante e sem
// repintar nada, os dois trocam: o textarea deixa de receber o ponteiro, o
// `<pre>` passa a receber, e `document.caretRangeFromPoint` diz em que nó de
// texto e em que posição o mouse está. Vale com e sem quebra de linha — é o
// mesmo texto, caractere a caractere alinhado (a regra "Marca de decorador
// nunca muda métrica" é o que garante isso).
//
// ⚠️ **NÃO usa `.dropdown-menu`**, pelo mesmo motivo do autocomplete: o
// ouvinte global de `app.js` esconde todo `.dropdown-menu` a cada clique. E o
// balão é `pointer-events: none` — nunca está no caminho do clique, então não
// há "clique fora" a conferir: qualquer `mousedown` no Editor o fecha.
//
// Não confundir com o `titulo` da **marca** do decorador (que continua sem
// aparecer no mouse) nem com a "dica" de `config-cartao-dica`.

const ED_DICA_CONSULTA = 'editor.dica';
// Quanto o mouse precisa ficar parado. Menos que isto e o balão pisca a cada
// palavra que o mouse atravessa a caminho de outro lugar.
const ED_DICA_PAUSA_MS = 400;

let _edDicaCaixa = null;    // o balão na tela, ou null
let _edDicaRelogio = null;  // a pausa em curso
let _edDicaAlvo = null;     // { ta, retangulo } da palavra perguntada
let _edDicaPedido = 0;      // cresce a cada fechar: resposta velha é descartada
// Os `<textarea>` em que os ouvintes de fechar já foram pendurados — a
// superfície é criada por painel, e o Editor tem dois.
const _edDicaLigadas = new WeakSet();

/** Fecha o balão e esquece o que estava em curso. Chamado pela superfície no
 *  `mouseleave`, por `descarregar.js` ao desligar quem respondia, e aqui. */
// eslint-disable-next-line no-unused-vars
function edDicaFechar() {
  clearTimeout(_edDicaRelogio);
  _edDicaRelogio = null;
  _edDicaPedido += 1;
  _edDicaAlvo = null;
  if (_edDicaCaixa) { _edDicaCaixa.remove(); _edDicaCaixa = null; }
  if (typeof xtCancelarConsulta === 'function') xtCancelarConsulta(ED_DICA_CONSULTA);
}

function _edDicaDentro(r, x, y) {
  return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

// Digitar, rolar, clicar ou sair do campo fecham o balão: a palavra que ele
// explica pode ter mudado de lugar ou deixado de existir.
function _edDicaLigar(ta) {
  if (_edDicaLigadas.has(ta)) return;
  _edDicaLigadas.add(ta);
  ['keydown', 'scroll', 'mousedown', 'blur'].forEach((ev) => ta.addEventListener(ev, edDicaFechar));
}

// O `Esc` com o foco em outro lugar (o mouse parado sobre o código, o cursor
// no achador) também fecha. Não consome a tecla: quem mais a usa continua.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (_edDicaCaixa || _edDicaRelogio)) edDicaFechar();
});

/**
 * Chamado pelo `mousemove` do `<textarea>`.
 *
 * ⚠️ **A PRIMEIRA LINHA É A QUE IMPORTA** — ver o cabeçalho.
 */
// eslint-disable-next-line no-unused-vars
function edDicaAoMover(ta, e, projeto, arquivo) {
  if (typeof xtAlguemResponde !== 'function' || !xtAlguemResponde(ED_DICA_CONSULTA)) return;
  // Ainda sobre a palavra perguntada: o balão (ou a pergunta) fica.
  if (_edDicaAlvo && _edDicaAlvo.ta === ta && _edDicaDentro(_edDicaAlvo.retangulo, e.clientX, e.clientY)) return;
  if (_edDicaAlvo || _edDicaCaixa) edDicaFechar();
  _edDicaLigar(ta);
  clearTimeout(_edDicaRelogio);
  const x = e.clientX;
  const y = e.clientY;
  _edDicaRelogio = setTimeout(() => {
    _edDicaRelogio = null;
    _edDicaPerguntar(ta, x, y, projeto, arquivo);
  }, ED_DICA_PAUSA_MS);
}

/**
 * `{ pos, caixa }` — a posição, no texto do `<textarea>`, do caractere sob
 * (x, y), e o retângulo dele na tela — ou `null`.
 *
 * `caretRangeFromPoint` sobre o `<pre>` (ver o cabeçalho) e depois a soma do
 * comprimento dos nós de texto anteriores. O `<pre>` tem o mesmo texto do
 * textarea (mais um `\n` no fim), bloco a bloco.
 */
function _edDicaPosicaoSob(ta, x, y) {
  const pilha = ta.parentElement;
  const caixaPre = pilha && pilha.querySelector('.ed-pre');
  const pre = pilha && pilha.querySelector('.ed-pre-inner');
  if (!caixaPre || !pre || typeof document.caretRangeFromPoint !== 'function') return null;

  const antesTa = ta.style.pointerEvents;
  const antesPre = caixaPre.style.pointerEvents;
  let faixa = null;
  try {
    ta.style.pointerEvents = 'none';
    caixaPre.style.pointerEvents = 'auto';
    faixa = document.caretRangeFromPoint(x, y);
  } finally {
    ta.style.pointerEvents = antesTa;
    caixaPre.style.pointerEvents = antesPre;
  }
  if (!faixa) return null;
  const no = faixa.startContainer;
  if (!no || no.nodeType !== Node.TEXT_NODE || !pre.contains(no)) return null;

  // O caret fica ENTRE dois caracteres: o mouse pode estar sobre o da direita
  // (`offset`) ou o da esquerda (`offset - 1`). Vale o que contém o ponto.
  const caixaDe = (o) => {
    if (o < 0 || o >= no.length) return null;
    const r = document.createRange();
    r.setStart(no, o);
    r.setEnd(no, o + 1);
    const c = r.getBoundingClientRect();
    return _edDicaDentro(c, x, y) ? c : null;
  };
  let local = faixa.startOffset;
  let caixa = caixaDe(local);
  if (!caixa) {
    caixa = caixaDe(local - 1);
    if (!caixa) return null;
    local -= 1;
  }

  let antes = 0;
  const andador = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
  for (let n = andador.nextNode(); n; n = andador.nextNode()) {
    if (n === no) return { pos: antes + local, caixa };
    antes += n.length;
  }
  return null;
}

function _edDicaPerguntar(ta, x, y, projeto, arquivo) {
  if (!ta.isConnected) return;
  const aberto = typeof edArquivoAberto === 'function' ? edArquivoAberto(arquivo) : null;
  if (!aberto || aberto.binario) return;
  const linguagem = aberto.linguagem;
  // Ninguém responde para ESTA linguagem: nem mede.
  if (typeof xtAlguemRespondeEm === 'function' && !xtAlguemRespondeEm(ED_DICA_CONSULTA, linguagem)) return;

  const sob = _edDicaPosicaoSob(ta, x, y);
  const texto = ta.value;
  // A mesma palavra do autocomplete (`ED_AC_PALAVRA`, em editor-autocomplete.js).
  const ehPalavra = (c) => !!c && ED_AC_PALAVRA.test(c);
  if (!sob || !ehPalavra(texto[sob.pos])) return;
  const { pos, caixa } = sob;
  let inicio = pos;
  while (inicio > 0 && ehPalavra(texto[inicio - 1])) inicio -= 1;
  let fim = pos + 1;
  while (fim < texto.length && ehPalavra(texto[fim])) fim += 1;

  const antes = texto.slice(0, pos);
  const linha = antes.split('\n').length;
  const coluna = pos - (antes.lastIndexOf('\n') + 1) + 1;

  // O retângulo da palavra, a partir do caractere sob o mouse — a fonte do
  // Editor é monoespaçada. É o que mantém o balão aberto enquanto o mouse anda
  // DENTRO da palavra.
  const larg = caixa.width;
  const retangulo = { left: caixa.left - (pos - inicio) * larg, right: caixa.right + (fim - pos - 1) * larg,
                      top: caixa.top, bottom: caixa.bottom };
  _edDicaAlvo = { ta, retangulo };
  const meu = ++_edDicaPedido;

  xtConsultarComPausa(ED_DICA_CONSULTA, () => (meu === _edDicaPedido
    ? { projeto, arquivo, linguagem, linha, coluna, palavra: texto.slice(inicio, fim), texto }
    : null), (respostas) => {
    if (meu !== _edDicaPedido || !respostas.length || !ta.isConnected) return;
    _edDicaDesenhar(respostas, retangulo);
  });
}

function _edDicaDesenhar(respostas, palavra) {
  if (!_edDicaCaixa) {
    _edDicaCaixa = document.createElement('div');
    _edDicaCaixa.className = 'ed-dica';
    // Todo o texto veio de uma consulta `editor.dica`: a caixa inteira é de
    // extensão, para o "Destacar extensões" (D2) pegar.
    _edDicaCaixa.dataset.origem = 'extensao';
    document.body.appendChild(_edDicaCaixa);
  }
  _edDicaCaixa.innerHTML = respostas
    .map(r => `<div class="ed-dica-linha">${escapeHtml(String(r.texto))}</div>`).join('');

  const margem = 8;
  const larg = _edDicaCaixa.offsetWidth;
  const alt = _edDicaCaixa.offsetHeight;
  let esq = palavra.left;
  let topo = palavra.bottom + 4;
  if (esq + larg > window.innerWidth - margem) esq = Math.max(margem, window.innerWidth - larg - margem);
  // Sem espaço embaixo, sobe — nunca cobre a palavra que ele explica.
  if (topo + alt > window.innerHeight - margem) topo = Math.max(margem, palavra.top - alt - 4);
  _edDicaCaixa.style.left = `${esq}px`;
  _edDicaCaixa.style.top = `${topo}px`;
}
