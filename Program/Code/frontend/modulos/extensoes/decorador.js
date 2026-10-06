// ═══════════════ EXTENSÕES DO PROGRAMA — O DESENHADOR DO `editor.decorador` ══
// O ponto `editor.decorador` (tipo 12) deixa uma extensão marcar trechos do
// código pintado do Editor: sublinhar um termo, tingir uma coluna, pintar o
// fundo de uma linha com erro.
//
// ⚠️ A EXTENSÃO NUNCA RECEBE O DOM. Ela devolve uma LISTA de marcas
// (`{linha, coluna, tamanho, classe, titulo}`) e quem desenha é este arquivo.
// É por isso que o ponto é de forma 'itens' e não 'painel': entregar o `<pre>`
// faria a primeira extensão que errasse um `innerHTML` apagar a cor do Editor
// inteiro — e desligar não teria como desfazer nada.
//
// ⚠️ ESTE ARQUIVO É `marcarNoPre` (editor-lint.js) GENERALIZADO. O molde já
// estava escrito ali e em `editor-localizar.js`: caminhar pelos nós de TEXTO
// já renderizados contando `\n`, cortar o nó no ponto certo, não atravessar a
// quebra de linha. As três regras que aquele molde carrega valem aqui iguais:
//
//   1. marcar nos nós de TEXTO, nunca na string de HTML — mexer no HTML corta
//      as tags que o Prism acabou de criar;
//   2. reaplicar depois de CADA pintura E de cada troca da janela de cor (os
//      dois ganchos estão em `editor-painel.js`, ao lado de `lint.reaplicar`);
//   3. bloco cru é texto do mesmo jeito — a janela de cor deixa o que está
//      longe da vista como um nó de texto por bloco, e o caminhante passa por
//      ele sem saber a diferença.
//
// ⚠️ A MARCA NÃO LEVA `data-xt-encaixe`, e isto não é esquecimento.
// `xtDesregistrarEncaixes` apaga com `.remove()` tudo o que casa
// `[data-xt-encaixe][data-xt="{slug}"]` — e um `<span>` de decoração envolve
// TEXTO DO CÓDIGO. Removê-lo apagaria o texto do `<pre>` e desalinharia o
// espelho do textarea. Por isso a baixa daqui é própria: desligar é
// DESEMBRULHAR (`replaceWith(textNode)`), nunca remover. Ver `xtDesdecorar`, e
// a chamada dela em `descarregar.js`.

const XT_PONTO_DECORADOR = 'editor.decorador';

// O mesmo teto da consulta de autocomplete, e pelo mesmo motivo: o gancho roda
// depois de cada pintura, e a pintura roda a cada 120ms de digitação
// (`_EDPIN_ESPERA_MS`). O gancho é SÍNCRONO — a pintura não espera promessa —,
// então o teto é medido com `performance.now()` depois do fato: estourou, a
// resposta daquela extensão é ignorada e a próxima pintura tenta de novo.
const _XT_DEC_TETO_MS = 150;

// A classe da marca tem de começar pelo prefixo da extensão. É o que impede
// duas extensões de brigarem pelo mesmo seletor — o CSS da classe é da
// extensão (num `<style data-xt>` dela), e o programa só põe a classe.
// `classe` pode trazer mais de uma, separadas por espaço (`"csv-col
// csv-par"`) — e CADA uma tem de ter o prefixo; ver `_xtDecClasses`.
const _XT_DEC_PREFIXO = /^[a-z]{2,5}-[a-z0-9_-]+$/i;

/** As classes de uma marca, validadas — `null` se alguma está fora do padrão. */
function _xtDecClasses(bruto) {
  if (typeof bruto !== 'string') return null;
  const classes = bruto.trim().split(/\s+/).filter(Boolean);
  if (!classes.length || !classes.every((c) => _XT_DEC_PREFIXO.test(c))) return null;
  return classes.join(' ');
}

// As superfícies do Editor que aceitam decoração, com o que fazer para montar
// o contexto de cada uma. O Editor tem DOIS painéis (a tela dividida) e os
// dois ficam de pé desde que a aba é montada — `editor.js` os cria uma vez e
// nunca os destrói —, então não há baixa a fazer aqui.
//
// ⚠️ Isto existe porque `descarregar.js` e `xtRepintarPontosAbertos` precisam
// desdecorar e redecorar sem ter em mãos superfície nenhuma. "A superfície
// ativa" não serviria: as duas podem estar mostrando arquivos decorados ao
// mesmo tempo, e a que não está em foco ficaria com a marca de uma extensão
// desligada até a próxima tecla.
const _xtDecSuperficies = [];

// O quadro já agendado por `xtPedirDecoracao`, ou 0.
let _xtDecPedido = 0;

/**
 * O painel do Editor se apresenta aqui, uma vez, quando é criado.
 *
 * `contexto()` devolve `{ projeto, caminho, linguagem, texto, linhas, visivel }`
 * — ou `null` quando não há arquivo de texto na superfície (aba vazia, imagem
 * na frente). Ela é chamada só quando há decoradora ligada.
 */
// eslint-disable-next-line no-unused-vars
function xtDecoradorRegistrarSuperficie(superficie, contexto) {
  if (!superficie || !superficie.pre || typeof contexto !== 'function') return;
  if (_xtDecSuperficies.some((e) => e.superficie === superficie)) return;
  _xtDecSuperficies.push({ superficie, contexto });
}

/**
 * Há alguma extensão encaixada no ponto? A saída barata de quem chama a cada
 * pintura: para quem não tem decoradora ligada, o custo do mecanismo inteiro é
 * este `Map.size` — o mesmo desenho de `xtAlguemResponde` no autocomplete.
 */
// eslint-disable-next-line no-unused-vars
function xtAlguemDecora() {
  return typeof xtEncaixadosNoPonto === 'function'
      && xtEncaixadosNoPonto(XT_PONTO_DECORADOR).length > 0;
}

// ── Validar o que a extensão devolveu ───────────────────────────────────

/**
 * Filtra a lista de UMA extensão. Marca fora do arquivo cai em silêncio (é o
 * estado normal de quem calculou em cima de uma versão anterior do texto);
 * marca malformada ou com classe sem prefixo cai com `console.error`, porque
 * é defeito de quem escreveu.
 */
function _xtDecValidar(slug, itens, contexto) {
  const totalDeLinhas = contexto.linhas.length;
  const boas = [];
  for (const bruto of itens) {
    if (!bruto || typeof bruto !== 'object') {
      console.error(`[extensoes] "${XT_PONTO_DECORADOR}" de ${slug}: marca que não é objeto, ignorada.`);
      continue;
    }
    const linha = Number(bruto.linha);
    const coluna = Number(bruto.coluna);
    const tamanho = Number(bruto.tamanho);
    const classe = _xtDecClasses(bruto.classe);

    if (!classe) {
      console.error(`[extensoes] "${XT_PONTO_DECORADOR}" de ${slug}: a classe `
                    + `${JSON.stringify(bruto.classe)} não começa pelo prefixo da `
                    + 'extensão (2 a 5 letras e um hífen, em cada classe). Marca descartada.');
      continue;
    }
    if (!Number.isInteger(linha) || !Number.isInteger(coluna) || !Number.isInteger(tamanho)) {
      console.error(`[extensoes] "${XT_PONTO_DECORADOR}" de ${slug}: `
                    + '`linha`, `coluna` e `tamanho` precisam ser inteiros. Marca descartada.');
      continue;
    }
    // Daqui para baixo é o silêncio de propósito: a extensão calculou certo
    // sobre um texto que já mudou, e isso acontece o tempo todo.
    if (linha < 1 || linha > totalDeLinhas) continue;
    if (coluna < 0 || tamanho < 1) continue;
    if (coluna >= contexto.linhas[linha - 1].length) continue;

    boas.push({
      linha,
      coluna,
      tamanho,
      classe,
      titulo: typeof bruto.titulo === 'string' ? bruto.titulo : '',
      _feito: false,
    });
  }
  return boas;
}

// ── Desenhar ────────────────────────────────────────────────────────────

/**
 * Envolve, num `<span>`, cada trecho que a lista pediu. Uma passada pelo
 * `<pre>` por extensão — é o que permite duas marcas no mesmo trecho ficarem
 * ANINHADAS na ordem de registro (a segunda passada corta o nó de texto de
 * dentro do `<span>` da primeira), e é o que dá dono ao erro.
 */
function _xtDecMarcarNoPre(pre, slug, marcas) {
  const porLinha = new Map();
  marcas.forEach((m) => {
    if (!porLinha.has(m.linha)) porLinha.set(m.linha, []);
    porLinha.get(m.linha).push(m);
  });
  // Da esquerda para a direita dentro da linha: o caminhante avança e nunca
  // volta, então uma marca na coluna 2 que chegasse depois de uma na coluna 9
  // simplesmente não seria encontrada.
  porLinha.forEach((lista) => lista.sort((a, b) => a.coluna - b.coluna));

  const caminhante = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
  const nos = [];
  while (caminhante.nextNode()) nos.push(caminhante.currentNode);

  let linha = 1;
  let coluna = 0;
  nos.forEach((no) => {
    const texto = no.nodeValue;
    if (!texto) return;
    // Nó inteiro dentro de uma linha sem marca nenhuma: só anda a coluna.
    if (!porLinha.has(linha) && !texto.includes('\n')) { coluna += texto.length; return; }

    const frag = document.createDocumentFragment();
    let i = 0;
    let mudou = false;
    while (i < texto.length) {
      const daLinha = porLinha.get(linha);
      const marca = daLinha && daLinha.find((m) => !m._feito && m.coluna >= coluna
        && m.coluna < coluna + (texto.length - i));
      const proximaQuebra = texto.indexOf('\n', i);
      if (marca) {
        const inicioLocal = i + (marca.coluna - coluna);
        // A marca é cortada na quebra de linha, nunca atravessa — é o mesmo
        // `Math.min` do lint, e o motivo é que "coluna" só faz sentido dentro
        // de uma linha.
        const limiteDaLinha = proximaQuebra === -1 ? texto.length : proximaQuebra;
        const fimLocal = Math.min(limiteDaLinha, inicioLocal + marca.tamanho);
        marca._feito = true;
        if (fimLocal <= inicioLocal) continue;   // não sobrou caractere nenhum
        mudou = true;
        if (inicioLocal > i) frag.appendChild(document.createTextNode(texto.slice(i, inicioLocal)));
        const span = document.createElement('span');
        span.className = marca.classe;
        // `data-xt` diz de quem é a marca (é por ele que desligar a acha) e
        // `data-xt-marca` diz que ela é DECORAÇÃO — e não um `<div>` de
        // encaixe, que seria removido com `.remove()`.
        span.dataset.xt = slug;
        span.dataset.xtMarca = '';
        // ⚠️ O `<pre>` tem `pointer-events: none`: este `title` NUNCA aparece
        // no mouse. Fica gravado porque é barato e útil no DevTools, mas
        // nenhuma extensão pode contar com ele para falar com o usuário.
        if (marca.titulo) span.title = marca.titulo;
        span.textContent = texto.slice(inicioLocal, fimLocal);
        frag.appendChild(span);
        coluna += fimLocal - i;
        i = fimLocal;
        continue;
      }
      if (proximaQuebra === -1) {
        frag.appendChild(document.createTextNode(texto.slice(i)));
        coluna += texto.length - i;
        i = texto.length;
      } else {
        frag.appendChild(document.createTextNode(texto.slice(i, proximaQuebra + 1)));
        linha += 1;
        coluna = 0;
        i = proximaQuebra + 1;
      }
    }
    if (mudou) no.parentNode.replaceChild(frag, no);
  });
}

/**
 * Pergunta a cada decoradora que marcas ela quer, e desenha a lista somada
 * sobre o código já pintado.
 *
 * ⚠️ DESEMBRULHA ANTES DE MARCAR, SEMPRE. Uma repintura troca só os blocos que
 * mudaram; os que sobreviveram ainda carregam as marcas da passada anterior.
 * Sem esta limpeza, cada tecla aninharia um `<span>` novo dentro do anterior —
 * para sempre, e sem nada na tela denunciando.
 */
// eslint-disable-next-line no-unused-vars
function xtDecorar(superficie, contexto) {
  if (!superficie || !superficie.pre || !contexto) return;
  const encaixados = typeof xtEncaixadosNoPonto === 'function'
    ? xtEncaixadosNoPonto(XT_PONTO_DECORADOR) : [];
  // A saída barata: sem decoradora ligada não se toca no `<pre>`.
  if (!encaixados.length) return;

  xtDesdecorar(superficie);

  for (const [slug, fn] of encaixados) {
    let itens;
    const t0 = performance.now();
    try {
      itens = fn(contexto);
    } catch (e) {
      console.error(`[extensoes] o encaixe "${XT_PONTO_DECORADOR}" de ${slug} falhou:`, e);
      continue;
    }
    const gasto = performance.now() - t0;
    if (gasto > _XT_DEC_TETO_MS) {
      console.error(`[extensoes] "${XT_PONTO_DECORADOR}" de ${slug} levou `
                    + `${gasto.toFixed(0)}ms (o teto é ${_XT_DEC_TETO_MS}ms). `
                    + 'As marcas desta pintura foram ignoradas.');
      continue;
    }
    if (!Array.isArray(itens)) {
      if (itens !== undefined && itens !== null) {
        console.error(`[extensoes] o encaixe "${XT_PONTO_DECORADOR}" de ${slug} devolveu `
                      + `${typeof itens} em vez de uma lista de marcas.`);
      }
      continue;
    }
    const marcas = _xtDecValidar(slug, itens, contexto);
    if (marcas.length) _xtDecMarcarNoPre(superficie.pre, slug, marcas);
  }
}

/**
 * Tira as marcas de uma superfície — todas, ou só as de um `slug`.
 *
 * ⚠️ DESEMBRULHA, NUNCA REMOVE. O `<span>` da marca envolve texto do código:
 * um `.remove()` apagaria esse texto do `<pre>`, e o espelho sairia do
 * alinhamento com o textarea — texto errado na tela, o único defeito que esta
 * camada não pode cometer.
 *
 * Marcas aninhadas (duas extensões no mesmo trecho) saem certas: a lista vem
 * em ordem de documento, a de fora é desembrulhada primeiro com o
 * `textContent` que já inclui a de dentro, e a de dentro — já sem pai — vira
 * um `replaceWith` que não faz nada.
 */
// eslint-disable-next-line no-unused-vars
function xtDesdecorar(superficie, slug) {
  const pre = superficie && superficie.pre;
  if (!pre) return;
  const seletor = slug
    ? `span[data-xt-marca][data-xt="${slug}"]`
    : 'span[data-xt-marca]';
  const marcados = pre.querySelectorAll(seletor);
  if (!marcados.length) return;
  marcados.forEach((span) => span.replaceWith(document.createTextNode(span.textContent)));
  // Junta os nós de texto que ficaram vizinhos. Sem isto, `espelharMudanca`
  // continuaria funcionando (ela caminha pelo texto), mas o `<pre>` acumularia
  // um nó por marca desfeita ao longo da sessão.
  pre.normalize();
}

/**
 * Desdecora e redecora todas as superfícies registradas, agora.
 *
 * É o que a extensão chama quando calculou algo FORA do gancho — foi ao Python
 * pedir os erros de sintaxe, as relações de um identificador — e quer a marca
 * na tela sem esperar a próxima tecla. Ver a parte 15 do contrato.
 *
 * Uma por quadro: duas extensões pedindo ao mesmo tempo custam uma passada só.
 */
// eslint-disable-next-line no-unused-vars
function xtPedirDecoracao() {
  if (_xtDecPedido) return;
  _xtDecPedido = requestAnimationFrame(() => {
    _xtDecPedido = 0;
    for (const entrada of _xtDecSuperficies) {
      let contexto = null;
      try {
        contexto = entrada.contexto();
      } catch (e) {
        console.error('[extensoes] não deu para montar o contexto do decorador:', e);
        continue;
      }
      if (contexto) xtDecorar(entrada.superficie, contexto);
      else xtDesdecorar(entrada.superficie);
    }
  });
}

/** A baixa de UMA extensão, chamada por `descarregar.js` antes do registro sair. */
// eslint-disable-next-line no-unused-vars
function xtDesdecorarTudo(slug) {
  for (const entrada of _xtDecSuperficies) xtDesdecorar(entrada.superficie, slug);
}
