// ══════════════════════════════ EDITOR: A COLORAÇÃO ══
// O MOTOR do Prism, carregado de `Program/External/libraries/prism-master/`.
// As GRAMÁTICAS vêm de fora, da extensão "Cor do código" (tipo 11) — ver
// `xtAplicarGramaticasEscolhidas`, mais abaixo.
//
// ⚠️ TRÊS ARMADILHAS DO PRISM QUE FALHAM EM SILÊNCIO. Nenhuma dá erro; todas
// resultam em "o código aparece sem cor" e mais nada, e o programa roda com
// `debug=False` (sem console). Estão as três resolvidas, e ficam anotadas para
// não voltarem:
//
//   1. `use_minified` vem `true` de fábrica no autoloader, e a extensão de
//      gramáticas tem 297 arquivos `.js` e ZERO `.min.js`. Sem desligar, toda
//      linguagem dá 404. Desligado em index.html, junto das tags <script>.
//   2. `prism-core.js` pinta sozinho no DOMContentLoaded. A tag leva
//      `data-manual` — sem isso ele passaria por HTML da página que não é
//      código nenhum.
//   3. Carregar uma gramática é ASSÍNCRONO. Chamar `Prism.highlight()` logo
//      depois de abrir um `.py` roda com `Prism.languages.python` indefinido e
//      devolve o texto cru, calado. Por isso tudo aqui passa por
//      `_edGarantirLinguagem`, que espera o autoloader.
//
// ⚠️ Os plugins `line-numbers` e `match-braces` NÃO são usados, e não é
// esquecimento. O primeiro acrescenta preenchimento ao próprio <pre> e cria um
// <span> por linha: as duas coisas quebram o alinhamento com o textarea (ver
// `editor-superficie.css`), e a régua própria custa um nó de texto. O segundo
// depende de eventos de mouse sobre o <pre>, que tem `pointer-events: none` —
// nunca dispararia.

// Acima disto a cor sai automaticamente. Prism é um tokenizador por expressão
// regular: num arquivo de 150 KB cada passada custa centenas de milissegundos,
// e isso a cada 120ms de digitação deixa o editor impraticável. O arquivo abre
// e edita normalmente — só monocromático, com um botão para forçar.
// Padrão de reserva — o de verdade é `editor_teto_linhas_cor`
// (Configurações › Editor de código), lido a cada pintura para valer sem reiniciar.
const _EDPIN_MAX_LINHAS_PADRAO = 3000;
const _EDPIN_MAX_BYTES  = 150 * 1024;

function _edPinTetoLinhas() {
  const bruto = (typeof appSettings !== 'undefined') ? appSettings.editor_teto_linhas_cor : undefined;
  const n = Number(bruto);
  if (!Number.isFinite(n)) return _EDPIN_MAX_LINHAS_PADRAO;
  return Math.min(50000, Math.max(200, n));   // a mesma faixa de config-editor.js
}

// ⚠️ A PINTURA É POR BLOCOS, E NUNCA DO ARQUIVO INTEIRO. Até 04/09/2026 cada
// repintura fazia `pre.innerHTML = Prism.highlight(arquivo inteiro)`, e o preço
// aparecia em dois lugares: `aoDigitar` primeiro chamava `espelharCru()` — que
// deixa o arquivo todo sem cor até a repintura — e a repintura depois recriava
// cada <span> do Prism. No `index.html` deste programa são 7.700. Digitar um
// ponto reconstruía 7.700 nós duas vezes, e o usuário descreveu certo: "ele
// renderiza tudo que tá pra cima e tudo que tá pra baixo, não tá de maneira
// procedural".
//
// Três peças resolvem, e nenhuma inventa cor nova:
//
//   · `espelharMudanca()` (editor-superficie.js) corrige na hora só o nó de
//     texto que a tecla mexeu — o resto do arquivo continua como estava.
//   · `_edPinFatiar` corta o arquivo em blocos de ~50 linhas e devolve o HTML
//     de cada um.
//   · `superficie.pintarBlocos()` troca só os blocos cuja string mudou, e
//     COLORE SÓ OS BLOCOS PERTO DA JANELA VISÍVEL. Os outros ficam na tela
//     como texto cru — um nó de texto por bloco — e ganham cor quando a
//     rolagem chega perto deles. Ver "A JANELA" em editor-superficie.js.
//
// ⚠️ O CORTE ACONTECE ENTRE TOKENS DE TOPO, NUNCA DENTRO DE UM, e é isso que
// garante que fatiar não muda cor nenhuma. `Prism.highlight` é literalmente
// `Token.stringify(util.encode(tokenize(…)))`; percorrer o array de topo e
// chamar `stringify` entrada por entrada, concatenando, dá saída idêntica —
// `stringify` de um array é só concatenação (prism-core.js:843). Um comentário
// ou string de várias linhas é UM token, e cai inteiro num bloco só.
//
// ⚠️ E o corte tem de ser decidido pelo CONTEÚDO da entrada, não por contagem
// de linha absoluta: cortar em "a cada 50 linhas do arquivo" faria uma quebra
// de linha inserida no bloco 3 empurrar a fronteira de TODOS os blocos abaixo,
// e a repintura trocaria o arquivo inteiro de novo — exatamente o defeito que
// isto existe para consertar. Por isso o corte só fecha num pedaço que termina
// em quebra de linha: o bloco onde se digitou muda, os outros continuam byte a
// byte iguais.
const _EDPIN_LINHAS_POR_BLOCO = 50;

// Espera entre a última tecla e a repintura colorida.
const _EDPIN_ESPERA_MS = 120;

// Fatia o texto já tokenizado em blocos `{ html, cru }`. `cru` é o mesmo trecho
// sem cor nenhuma, usado enquanto o bloco está longe da janela visível.
//
// Contar quebras de linha no HTML gerado funciona porque tag de HTML nunca
// tem quebra de linha dentro — toda quebra que aparece ali é do código.
function _edPinFatiar(texto, linguagem) {
  const entradas = Prism.util.encode(Prism.tokenize(texto, Prism.languages[linguagem]));
  const linhas = texto.split('\n');
  const blocos = [];
  let html = '';
  let quebras = 0;
  let primeiraLinha = 0;
  for (let k = 0; k < entradas.length; k++) {
    const pedaco = Prism.Token.stringify(entradas[k], linguagem);
    html += pedaco;
    for (let q = pedaco.indexOf('\n'); q >= 0; q = pedaco.indexOf('\n', q + 1)) quebras++;
    const ultimo = k === entradas.length - 1;
    const fecha = quebras >= _EDPIN_LINHAS_POR_BLOCO && pedaco.endsWith('\n');
    if (!fecha && !ultimo) continue;
    // Bloco fechado numa quebra de linha consome exatamente `quebras` linhas; o
    // último pega o resto, que pode não terminar em quebra.
    const cru = ultimo && !pedaco.endsWith('\n')
      ? linhas.slice(primeiraLinha).join('\n')
      : linhas.slice(primeiraLinha, primeiraLinha + quebras).join('\n') + '\n';
    blocos.push({ html, cru });
    primeiraLinha += quebras;
    html = '';
    quebras = 0;
  }
  return blocos;
}

const _edPinCarregadas = new Set();
// Toda linguagem que já foi PEDIDA ao autoloader alguma vez nesta sessão. Só
// serve para uma coisa — ver `_edPinEsquecerCarregadas`.
const _edPinPedidas = new Set();
// As que precisam ser recarregadas à força na próxima vez.
let _edPinRecarregar = new Set();

function _edPinDisponivel() {
  return typeof Prism !== 'undefined' && Prism.languages;
}

// ══ O PACOTE DE GRAMÁTICAS (M6, tipo 11) ══
//
// ⚠️ AS GRAMÁTICAS NÃO MORAM MAIS NO PROGRAMA. Em 04/09/2026 os 297
// `components/prism-*.js` (1,5 MB) saíram de `External/libraries/prism-master/`
// e viraram a extensão **Cor do código**. O que ficou é o MOTOR
// (`prism-core.js`, 37 KB) e o autoloader — e ficou de propósito: sem o motor,
// desligar a extensão deixaria o Editor cego, e `_edPinFatiar` (a máquina de
// desempenho desta aba, logo acima) deixaria de existir junto. **Sai a
// gramática, nunca o motor.**
//
// O mecanismo já era de carregar de fora: o autoloader guarda a pasta em
// `Prism.plugins.autoloader.languages_path`. Ligar a extensão é apontar essa
// variável para a pasta dela; desligar é esvaziá-la e esquecer o que já
// carregou.

// O que o motor traz de fábrica: `plain`, `plaintext`, `text`, `txt`, mais as
// funções utilitárias (`extend`, `insertBefore`, `DFS`). Fotografado AGORA,
// antes de qualquer extensão ligar — é o que a limpeza abaixo preserva.
const _EDPIN_DO_MOTOR = _edPinDisponivel() ? new Set(Object.keys(Prism.languages)) : new Set();

/**
 * Aplica o pacote de gramáticas das extensões ligadas — ou nenhum.
 *
 * Chamada de `xtSincronizarDados`, ou seja, a cada ligar/desligar.
 */
// eslint-disable-next-line no-unused-vars
function xtAplicarGramaticasEscolhidas() {
  if (!_edPinDisponivel()) return;
  const autoloader = Prism.plugins && Prism.plugins.autoloader;
  if (!autoloader) return;

  // ⚠️ Versão 1: a PRIMEIRA ligada vale. Somar duas pastas exigiria um
  // autoloader próprio, e duas extensões de gramática ao mesmo tempo é um caso
  // que ainda não existe.
  const pacotes = (typeof xtDadosDoTipo === 'function') ? xtDadosDoTipo('11') : [];
  const pacote = pacotes[0] || null;
  const alvo = pacote ? `${pacote.url.replace(/\/?$/, '')}/` : '';
  if (autoloader.languages_path === alvo) return;

  autoloader.languages_path = alvo;

  // ⚠️ ESQUECER O QUE JÁ ESTÁ EM MEMÓRIA, senão "desligar" não tem efeito
  // visível: a gramática já carregada continuaria colorindo até o programa
  // reabrir. Preserva o que veio do motor e as funções utilitárias.
  for (const chave of Object.keys(Prism.languages)) {
    if (_EDPIN_DO_MOTOR.has(chave)) continue;
    if (typeof Prism.languages[chave] === 'function') continue;
    delete Prism.languages[chave];
  }
  _edPinEsquecerCarregadas();
  // Sem isto, o arquivo aberto só ganharia (ou perderia) cor na próxima tecla.
  if (typeof edRepintarPaineis === 'function') edRepintarPaineis();
}

function _edPinEsquecerCarregadas() {
  _edPinCarregadas.clear();
  // ⚠️ O AUTOLOADER GUARDA O FRACASSO e nunca tenta de novo — `lang_data[lang]
  // .error`, num fechamento que ninguém alcança de fora. A única porta é o
  // sufixo `!`, que força recarregar. Sem isto, quem abrisse um `.py` com a
  // extensão desligada (404 silencioso) e depois a ligasse continuaria sem cor
  // até reabrir o programa.
  _edPinRecarregar = new Set(_edPinPedidas);
}

// Promessa que resolve quando a gramática está de pé — ou quando desistimos.
function _edGarantirLinguagem(linguagem) {
  return new Promise((resolve) => {
    if (!_edPinDisponivel() || !linguagem || linguagem === 'none') return resolve(false);
    const forcar = _edPinRecarregar.delete(linguagem);
    if (!forcar) {
      if (Prism.languages[linguagem]) { _edPinCarregadas.add(linguagem); return resolve(true); }
      if (_edPinCarregadas.has(linguagem)) return resolve(!!Prism.languages[linguagem]);
    }
    const autoloader = Prism.plugins && Prism.plugins.autoloader;
    if (!autoloader) return resolve(false);
    // Sem pacote de gramáticas ligado não há para onde apontar: pedir daria um
    // 404 silencioso a cada arquivo aberto, e o resultado (sem cor) é o mesmo.
    if (!autoloader.languages_path) return resolve(false);
    // A marca entra ANTES do pedido: sem ela, abrir cinco `.py` seguidos
    // dispararia cinco carregamentos da mesma gramática.
    _edPinCarregadas.add(linguagem);
    _edPinPedidas.add(linguagem);
    autoloader.loadLanguages([linguagem + (forcar ? '!' : '')],
      () => resolve(!!Prism.languages[linguagem]),
      () => resolve(false));
  });
}

// eslint-disable-next-line no-unused-vars
function criarPintura(superficie) {
  let linguagem = 'none';
  let forcado = false;      // o usuário clicou "Colorir mesmo assim"
  let relogio = null;
  let aoRepintar = null;    // o Ctrl+F reaplica as marcas depois de cada pintura
  let blocos = [];          // [{ html, cru }] — o arquivo fatiado

  function grande() {
    const texto = superficie.texto;
    return texto.length > _EDPIN_MAX_BYTES
        || texto.split('\n').length > _edPinTetoLinhas();
  }

  function pintavel() {
    return _edPinDisponivel() && linguagem !== 'none' && (!grande() || forcado);
  }

  // Manda para a tela o arquivo fatiado. Quem decide o que entra de fato — e
  // quais blocos ganham cor agora — é `pintarBlocos`, que troca só o que mudou
  // e colore só o que está perto da janela.
  function entregar() {
    superficie.pintarBlocos(blocos);
    if (aoRepintar) aoRepintar();
  }

  function pintarAgora() {
    if (!pintavel() || !Prism.languages[linguagem]) {
      // Sem cor, o `pre` fica com o texto cru — que `espelharCru` já pôs lá.
      blocos = [];
      superficie.atualizarMinimapa();
      if (aoRepintar) aoRepintar();
      return;
    }
    blocos = _edPinFatiar(superficie.texto + '\n', linguagem);
    entregar();
  }

  return {
    // Quando o texto muda. Dois caminhos — ver o topo do arquivo.
    aoDigitar() {
      superficie.pintarRegua();
      // ⚠️ `espelharMudanca` PRIMEIRO, `espelharCru` só se ela não der conta.
      // As duas põem o texto exato na tela no mesmo instante; a diferença é
      // que a primeira mexe num nó de texto e a segunda joga fora os milhares
      // de <span> do Prism. Ver o aviso no topo deste arquivo.
      if (!superficie.espelharMudanca()) superficie.espelharCru();
      clearTimeout(relogio);
      relogio = setTimeout(pintarAgora, _EDPIN_ESPERA_MS);
    },

    async abrir(novaLinguagem) {
      linguagem = novaLinguagem || 'none';
      forcado = false;
      clearTimeout(relogio);
      blocos = [];
      // O arquivo INTEIRO entra na tela já aqui, cru — um nó de texto, barato.
      // A cor chega logo abaixo, e só nos blocos perto da janela: é isso que
      // faz um arquivo de 900 linhas abrir no mesmo tempo que um de 50.
      superficie.espelharCru();
      superficie.pintarRegua();
      // Espera a gramática antes de pintar — a armadilha 3 do cabeçalho.
      if (pintavel()) await _edGarantirLinguagem(linguagem);
      pintarAgora();
    },

    async forcar() {
      forcado = true;
      await _edGarantirLinguagem(linguagem);
      pintarAgora();
    },

    repintar: pintarAgora,
    aoRepintarFazer(fn) { aoRepintar = fn; },
    get grande() { return grande(); },
    get colorindo() { return pintavel(); },
    get linguagem() { return linguagem; },
  };
}
