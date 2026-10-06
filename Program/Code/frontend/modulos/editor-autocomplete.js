// ═══════════════════════════ EDITOR: O POPUP DE AUTOCOMPLETE ══
// A lista de sugestões que aparece enquanto se digita. Nasceu com M5 (Obra 4
// de "Extensões do programa", 04/09/2026).
//
// ⚠️ **O POPUP É PEÇA DO PROGRAMA; A SUGESTÃO É DA EXTENSÃO.** A divisão não é
// arbitrária: se cada extensão desenhasse o próprio popup, duas ligadas ao
// mesmo tempo abririam duas caixas sobrepostas, com medidas e cores
// diferentes, e o teclado não saberia qual delas navega. A extensão devolve
// `[{texto, detalhe, prioridade}]` e para por aí.
//
// ⚠️ **SEM EXTENSÃO DE TIPO 27 LIGADA, ESTE ARQUIVO NÃO FAZ NADA** — nem
// agenda debounce, nem lê o cursor, nem carrega símbolo. A primeira linha de
// `_edAcAoDigitar` é `xtAlguemResponde(...)`, um `Map.size`, e é esse o custo
// total do autocomplete para quem nunca instalou uma extensão.
//
// Os **trechos prontos** (Recursos do Editor › trechos, fase 12) entram na
// MESMA lista, com `detalhe: 'trecho · …'`: são dado, não consulta — vêm de
// `extensoes/dados.js` (`xtTrechosDaLinguagem`) e custam um `length` quando
// não há nenhum. Aceitar um trecho insere o `corpo` sem os marcadores (`$1`,
// `${1:texto}`, `$0`) e põe o cursor no primeiro.
//
// ⚠️ **NÃO usa `.dropdown-menu`**, pelo mesmo motivo que `menu-contexto.js`
// registra: o ouvinte global de `app.js` esconde todo `.dropdown-menu` a cada
// clique, e o popup sumiria antes de o clique na sugestão ser processado.

const ED_AC_CONSULTA = 'editor.autocomplete';
// Quantas sugestões cabem. Ninguém lê a trigésima, e uma lista longa demais
// vira uma parede que cobre o código que a pessoa está escrevendo.
const ED_AC_TETO = 12;
// Prefixo mais curto que isto abriria o popup em quase toda tecla, com
// sugestões inúteis — "a" casa com metade do projeto.
const ED_AC_PREFIXO_MINIMO = 2;

let _edAcCaixa = null;      // o elemento na tela, ou null
let _edAcItens = [];        // as sugestões mostradas agora
let _edAcSelecionado = 0;
let _edAcSuperficie = null; // a superfície que abriu o popup

// O que conta como parte de uma palavra. Inclui `_` e `$` porque são nomes
// válidos em quase toda linguagem do programa; NÃO inclui acento, porque o
// índice de símbolos guarda o identificador como ele está no código.
const ED_AC_PALAVRA = /[A-Za-z0-9_$]/;

function _edAcFechar() {
  if (_edAcCaixa) {
    _edAcCaixa.remove();
    _edAcCaixa = null;
  }
  _edAcItens = [];
  _edAcSelecionado = 0;
  _edAcSuperficie = null;
  if (typeof xtCancelarConsulta === 'function') xtCancelarConsulta();
}

/** Há popup aberto? O `keydown` da superfície pergunta antes de tratar setas. */
// eslint-disable-next-line no-unused-vars
function edAutocompleteAberto() { return !!_edAcCaixa; }

/**
 * A palavra que está sendo digitada, imediatamente antes do cursor.
 *
 * Devolve `null` quando não há uma — cursor no meio de espaço, ou logo depois
 * de um símbolo. Nesse caso o popup nem abre: completar o nada ofereceria a
 * lista inteira do projeto.
 */
function _edAcPrefixo(ta) {
  // Seleção viva não é digitação de palavra: o usuário está escolhendo texto,
  // e abrir sugestões por cima disso atrapalha em vez de ajudar.
  if (ta.selectionStart !== ta.selectionEnd) return null;
  const pos = ta.selectionStart;
  let i = pos;
  while (i > 0 && ED_AC_PALAVRA.test(ta.value[i - 1])) i -= 1;
  const prefixo = ta.value.slice(i, pos);
  return prefixo.length >= ED_AC_PREFIXO_MINIMO ? { prefixo, inicio: i } : null;
}

/** Linha e coluna do cursor — o contrato da consulta promete as duas. */
function _edAcLinhaColuna(ta) {
  const ate = ta.value.slice(0, ta.selectionStart).split('\n');
  return { linha: ate.length, coluna: ate[ate.length - 1].length + 1 };
}

function _edAcDesenhar(ta) {
  if (!_edAcCaixa) {
    _edAcCaixa = document.createElement('div');
    _edAcCaixa.className = 'ed-ac';
    // ⚠️ A CAIXA INTEIRA é de extensão, e não cada linha: o programa desenha o
    // popup mas não tem sugestão nenhuma própria — TODA linha aqui veio de uma
    // consulta `editor.autocomplete`. Marcar linha por linha repetiria o
    // destaque doze vezes e diria a mesma coisa.
    _edAcCaixa.dataset.origem = 'extensao';
    // ⚠️ `mousedown` e não `click`, com `preventDefault`: o `click` só chega
    // depois de o textarea perder o foco, e perder o foco já teria fechado o
    // popup. O item nunca seria escolhido com o mouse.
    _edAcCaixa.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const linha = e.target.closest('[data-ac-indice]');
      if (linha) _edAcAceitar(Number(linha.dataset.acIndice));
    });
    document.body.appendChild(_edAcCaixa);
  }

  _edAcCaixa.innerHTML = _edAcItens.map((it, i) => `
    <div class="ed-ac-item${i === _edAcSelecionado ? ' ativo' : ''}" data-ac-indice="${i}">
      <span class="ed-ac-texto">${escapeHtml(String(it.texto))}</span>
      ${it.detalhe ? `<span class="ed-ac-detalhe">${escapeHtml(String(it.detalhe))}</span>` : ''}
    </div>`).join('');

  // Posiciona no cursor. `_edAcMedirCursor` devolve a coordenada em pixels
  // dentro do textarea; some com a posição dele na janela.
  const caixa = ta.getBoundingClientRect();
  const cursor = _edAcMedirCursor(ta);
  const margem = 8;
  let esq = caixa.left + cursor.x;
  let topo = caixa.top + cursor.y + cursor.altura;

  const larg = _edAcCaixa.offsetWidth;
  const alt = _edAcCaixa.offsetHeight;
  if (esq + larg > window.innerWidth - margem) esq = Math.max(margem, window.innerWidth - larg - margem);
  // Sem espaço embaixo, o popup sobe para CIMA da linha — nunca cobre a linha
  // que está sendo escrita, que é justamente a que a pessoa está olhando.
  if (topo + alt > window.innerHeight - margem) topo = Math.max(margem, caixa.top + cursor.y - alt);

  _edAcCaixa.style.left = `${esq}px`;
  _edAcCaixa.style.top = `${topo}px`;

  const ativo = _edAcCaixa.querySelector('.ed-ac-item.ativo');
  // `scrollTop` na mão, e nunca `scrollIntoView`: ele mexe em TODOS os
  // ancestrais roláveis, e aqui isso rolaria o editor inteiro por baixo do
  // popup. Está registrado em Padrões de interface.
  if (ativo) {
    const t = ativo.offsetTop;
    const b = t + ativo.offsetHeight;
    if (t < _edAcCaixa.scrollTop) _edAcCaixa.scrollTop = t;
    else if (b > _edAcCaixa.scrollTop + _edAcCaixa.clientHeight) {
      _edAcCaixa.scrollTop = b - _edAcCaixa.clientHeight;
    }
  }
}

/**
 * Onde o cursor está, em pixels, dentro do textarea.
 *
 * ⚠️ Um `<textarea>` não expõe isso — não há API. O truque é o mesmo que a
 * régua de `editor-superficie.js` usa para medir linha quebrada: um espelho
 * com a MESMA fonte e a MESMA largura, com o texto até o cursor, e mede-se
 * onde o fim dele caiu. Copiar as propriedades de fonte uma a uma não
 * funciona — `getComputedStyle().font` é a única forma de pegar a família
 * resolvida com o fallback aplicado.
 */
function _edAcMedirCursor(ta) {
  const estilo = window.getComputedStyle(ta);
  const espelho = document.createElement('div');
  espelho.className = 'ed-ac-espelho';
  espelho.style.font = estilo.font;
  espelho.style.lineHeight = estilo.lineHeight;
  espelho.style.padding = estilo.padding;
  espelho.style.width = `${ta.clientWidth}px`;
  espelho.style.whiteSpace = estilo.whiteSpace;
  espelho.style.wordBreak = estilo.wordBreak;

  espelho.textContent = ta.value.slice(0, ta.selectionStart);
  const marca = document.createElement('span');
  // Um caractere invisível de largura zero: o `<span>` vazio não teria caixa
  // para medir.
  marca.textContent = '​';
  espelho.appendChild(marca);
  document.body.appendChild(espelho);

  const altura = parseFloat(estilo.lineHeight) || 16;
  const x = marca.offsetLeft - ta.scrollLeft;
  const y = marca.offsetTop - ta.scrollTop;
  espelho.remove();
  return { x, y, altura };
}

/**
 * O `corpo` de um trecho sem os marcadores, e onde o cursor vai: o `$1` (com o
 * texto de `${1:texto}` selecionado), senão o `$0`, senão o fim. As linhas
 * depois da primeira ganham o recuo da linha em que o trecho entrou. `\$` é
 * um cifrão de verdade. Subconjunto do formato de snippets do VS Code — sem
 * marcador aninhado, sem variável.
 */
function _edAcTrechoPronto(corpo, recuo) {
  let texto = '';
  const paradas = {};
  const re = /\\\$|\$\{(\d+)(?::([^}]*))?\}|\$(\d+)/g;
  let i = 0;
  let m;
  while ((m = re.exec(corpo)) !== null) {
    texto += corpo.slice(i, m.index);
    i = re.lastIndex;
    if (m[0] === '\\$') { texto += '$'; continue; }
    const n = m[1] || m[3];
    const marcado = m[2] || '';
    if (!(n in paradas)) paradas[n] = { inicio: texto.length, fim: texto.length + marcado.length };
    texto += marcado;
  }
  texto += corpo.slice(i);
  // O recuo entra DEPOIS de achar as paradas: cada quebra antes delas empurra
  // a posição pelo tamanho do recuo.
  const empurrar = (pos) => pos + recuo.length * (texto.slice(0, pos).split('\n').length - 1);
  const alvo = paradas['1'] || paradas['0'] || { inicio: texto.length, fim: texto.length };
  return {
    texto: recuo ? texto.split('\n').join('\n' + recuo) : texto,
    inicio: empurrar(alvo.inicio),
    fim: empurrar(alvo.fim),
  };
}

function _edAcAceitarTrecho(ta, item, achado) {
  const antes = ta.value.slice(0, achado.inicio);
  const recuo = (antes.slice(antes.lastIndexOf('\n') + 1).match(/^[ \t]*/) || [''])[0];
  const pronto = _edAcTrechoPronto(String(item.trecho), recuo);
  // ⚠️ `execCommand('insertText')`, como a superfície insere o Tab: entra NA
  // pilha de desfazer (um Ctrl+Z tira o trecho inteiro) e dispara o `input`
  // sozinho — a superfície repinta e marca a aba como suja.
  ta.setSelectionRange(achado.inicio, ta.selectionStart);
  if (!document.execCommand('insertText', false, pronto.texto)) {
    ta.setRangeText(pronto.texto, achado.inicio, ta.selectionEnd, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  ta.setSelectionRange(achado.inicio + pronto.inicio, achado.inicio + pronto.fim);
  // O `input` do `insertText` agendou uma consulta nova: o popup não reabre
  // por cima do trecho que acabou de entrar.
  _edAcFechar();
}

function _edAcAceitar(indice) {
  const item = _edAcItens[indice];
  const ta = _edAcSuperficie;
  if (!item || !ta) { _edAcFechar(); return; }

  const achado = _edAcPrefixo(ta);
  if (!achado) { _edAcFechar(); return; }
  if (item.trecho !== undefined) { _edAcAceitarTrecho(ta, item, achado); return; }

  // ⚠️ `setRangeText`, e NUNCA `ta.value = ...`. É a regra que decide se o
  // Ctrl+Z funciona, e está no cabeçalho de `editor-superficie.js`: atribuir a
  // `value` apaga a pilha de desfazer do navegador inteira. Com
  // `setRangeText` a aceitação da sugestão vira um passo desfazível como
  // qualquer digitação.
  ta.setRangeText(String(item.texto), achado.inicio, ta.selectionStart, 'end');
  // O `input` sintético é o que avisa a superfície de que o texto mudou — ela
  // repinta, remarca a aba como suja e atualiza a régua. Sem ele, a sugestão
  // entraria no textarea e o resto do Editor não saberia.
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  _edAcFechar();
}

/**
 * Chamado pelo `input` da superfície, a cada tecla.
 *
 * ⚠️ **A PRIMEIRA LINHA É A QUE IMPORTA.** Sem extensão de tipo 27 ligada, a
 * função sai num `Map.size` — nada de debounce, nada de medir cursor, nada de
 * carregar índice. É o que faz o Editor de quem não usa extensão continuar
 * exatamente como era.
 */
// eslint-disable-next-line no-unused-vars
function edAutocompleteAoDigitar(ta, projeto, arquivo) {
  const consulta = typeof xtAlguemResponde === 'function' && xtAlguemResponde(ED_AC_CONSULTA);
  // Os trechos prontos: um `length` (fase 12).
  const trechos = typeof xtHaTrechos === 'function' && xtHaTrechos();
  if (!consulta && !trechos) {
    if (_edAcCaixa) _edAcFechar();
    return;
  }

  const achado = _edAcPrefixo(ta);
  if (!achado) { _edAcFechar(); return; }

  xtConsultarComPausa(ED_AC_CONSULTA, async () => {
    // Remedido DEPOIS da pausa: entre a tecla e agora o cursor pode ter
    // andado, e perguntar pelo prefixo velho traria sugestões de outra
    // palavra.
    const agora = _edAcPrefixo(ta);
    if (!agora) return null;
    const { linha, coluna } = _edAcLinhaColuna(ta);
    return {
      projeto, arquivo, linha, coluna, prefixo: agora.prefixo,
      // Os símbolos vão JUNTO da pergunta, já carregados. É o que permite a
      // extensão filtrar sem ir ao backend. Só trechos, e ninguém para
      // perguntar: o índice nem é carregado.
      simbolos: consulta ? await xtSimbolos(projeto) : [],
      // E o TEXTO do arquivo, como está agora — uma referência, sem cópia. É
      // o que permite sugerir as palavras que já estão no próprio arquivo,
      // em qualquer linguagem, mesmo num projeto sem Índice de Símbolos.
      texto: ta.value,
    };
  }, (respostasDasExtensoes) => {
    const respostas = respostasDasExtensoes.concat(trechos ? _edAcTrechosPara(ta, arquivo) : []);
    if (!respostas.length) { _edAcFechar(); return; }
    // Prioridade maior primeiro; empate desempata pelo texto, para a ordem
    // não mudar entre duas teclas iguais.
    _edAcItens = respostas
      .sort((a, b) => (b.prioridade || 0) - (a.prioridade || 0)
                      || String(a.texto).localeCompare(String(b.texto)))
      .slice(0, ED_AC_TETO);
    _edAcSelecionado = 0;
    _edAcSuperficie = ta;
    _edAcDesenhar(ta);
  });
}

/** Os trechos da linguagem do arquivo cujo `prefixo` começa pelo que foi
 *  digitado, já no formato de sugestão. Prioridade alta: quem digitou o
 *  começo de um prefixo de trecho quase sempre o quer. */
function _edAcTrechosPara(ta, arquivo) {
  const agora = _edAcPrefixo(ta);
  const aberto = typeof edArquivoAberto === 'function' ? edArquivoAberto(arquivo) : null;
  if (!agora || !aberto || typeof xtTrechosDaLinguagem !== 'function') return [];
  return xtTrechosDaLinguagem(aberto.linguagem)
    .filter(t => t.prefixo.startsWith(agora.prefixo))
    .map(t => ({ texto: t.prefixo, detalhe: `trecho · ${t.descricao || t.extensao}`,
                 prioridade: 1000, trecho: t.corpo }));
}

/**
 * Chamado pelo `keydown` da superfície, ANTES do tratamento normal.
 *
 * Devolve `true` quando consumiu a tecla — e aí quem chamou precisa parar. As
 * setas e o Enter só são roubados **enquanto o popup está aberto**; fechado,
 * esta função devolve `false` na primeira linha e o Editor segue como sempre.
 */
// eslint-disable-next-line no-unused-vars
function edAutocompleteTecla(e) {
  if (!_edAcCaixa) return false;

  if (e.key === 'Escape') { _edAcFechar(); return true; }
  if (e.key === 'ArrowDown') {
    _edAcSelecionado = (_edAcSelecionado + 1) % _edAcItens.length;
    _edAcDesenhar(_edAcSuperficie); return true;
  }
  if (e.key === 'ArrowUp') {
    _edAcSelecionado = (_edAcSelecionado - 1 + _edAcItens.length) % _edAcItens.length;
    _edAcDesenhar(_edAcSuperficie); return true;
  }
  // Enter e Tab aceitam. ⚠️ Enter só é roubado com o popup ABERTO — em
  // qualquer outro momento ele quebra linha, como sempre. Um autocomplete que
  // come o Enter é a reclamação clássica de editor.
  if (e.key === 'Enter' || e.key === 'Tab') {
    _edAcAceitar(_edAcSelecionado); return true;
  }
  return false;
}

/** O Editor chama ao trocar de arquivo, rolar ou perder o foco. */
// eslint-disable-next-line no-unused-vars
function edAutocompleteFechar() { _edAcFechar(); }
