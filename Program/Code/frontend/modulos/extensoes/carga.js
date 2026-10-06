// ═════════════════════════ EXTENSÕES DO PROGRAMA — CARGA DO FRONTEND ══
// Injeta o `frontend/index.js` de cada extensão ligada e chama o `montar`
// dela.
//
// ⚠️ **UM <script> POR EXTENSÃO, e todos vivos ao mesmo tempo.** O sistema de
// Plugins faz o contrário: tem um `<script id="plugin-script-ativo">` só, e
// remove o anterior antes de carregar o próximo, porque só um plugin está na
// tela por vez. Aqui várias extensões rodam juntas — uma decorando o editor,
// outra no menu de contexto, outra no fundo —, então cada uma tem o próprio
// `<script id="xt-script-{slug}">` e o próprio `window.xtMontar_{slug}`.
//
// ⚠️ `window.montarPlugin` e o id `plugin-script-ativo` são do sistema de
// Plugins e não se reusam aqui: são únicos, e colidiriam.
//
// O `?t=` no fim da URL existe pelo mesmo motivo de sempre: ligar → editar o
// arquivo → desligar → ligar tem de trazer o código NOVO, e o WebView2 guarda
// o antigo em cache se a URL for a mesma.

// `{slug: caminho}` do que está montado na tela AGORA. É a lista contra a
// qual a árvore nova é comparada — sem ela não dá para saber o que ligou e o
// que desligou entre duas respostas do backend.
const _xtMontadas = new Map();

// `{slug: [textos]}` — os AVISOS que só a tela consegue ver (D42 "Estilo" e
// "Global no navegador"): seletor de CSS que não começa pelo prefixo, global
// com nome de fora. Aviso, não erro — nada é desligado; `config-xtprog.js`
// pinta em âmbar ao lado dos erros do manifesto. Refeito a cada carga.
const _xtAvisosDeTela = new Map();

function _xtIdDoScript(slug) {
  return `xt-script-${slug}`;
}

/**
 * Injeta um <script> e resolve quando ele terminar de rodar (ou falhar).
 *
 * ⚠️ O `caminho` e o `slug` vão no `dataset` da própria tag, e é assim que a
 * extensão descobre quem ela é: `document.currentScript.dataset`. Nem um nem
 * outro pode ser escrito à mão dentro do `index.js` — o usuário move a pasta
 * para dentro de uma categoria e o caminho muda; o slug ele nem tem como
 * calcular, porque leva um resumo do caminho inteiro.
 */
function _xtInjetarScript(id, src, folha) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.id = id;
    el.dataset.caminho = folha.caminho;
    el.dataset.slug = folha.slug;
    el.src = src;
    el.onload = () => resolve();
    // Um 404 (a pasta foi movida entre a listagem e o clique) chega aqui, e
    // não no `try` de quem chamou: erro de carregamento de <script> não é
    // exceção, é evento.
    el.onerror = () => reject(new Error(`não deu para carregar ${src}`));
    document.head.appendChild(el);
  });
}

/**
 * Injeta UM arquivo `.js` de dentro da pasta de uma extensão — um encaixe,
 * uma assinatura de evento, uma consulta — e resolve quando ele rodou.
 *
 * ⚠️ Resolve `false`, e não rejeita, quando não carrega: um arquivo que
 * falha é um pedaço da extensão que não funciona, e não a extensão inteira.
 * Os outros arquivos dela continuam.
 *
 * ⚠️ Cada tag leva `data-xt="{slug}"`, e é só por isso que `descarregar.js`
 * a remove: o seletor de baixa é `style|link|script[data-xt="{slug}"]`. Uma
 * tag sem o atributo ficaria no `<head>` para sempre, e religar a extensão
 * carregaria o arquivo pela segunda vez — com o registro dobrado, e o item
 * de menu aparecendo duas vezes.
 *
 * `extras` vai para o `dataset` da tag: é como o arquivo descobre em que
 * `ponto`, `evento` ou `consulta` está, sem repetir dentro dele o nome que já
 * está no manifesto — dois lugares para o mesmo texto é um lugar para ele
 * ficar diferente. Até 05/09/2026 este injetor existia três vezes, uma por
 * mecanismo, com um `dataset` a mais cada.
 */
function xtInjetarArquivoDaExtensao(folha, arquivo, extras, rotulo) {
  return new Promise((resolve) => {
    const el = document.createElement('script');
    el.dataset.xt = folha.slug;
    el.dataset.caminho = folha.caminho;
    el.dataset.slug = folha.slug;
    Object.assign(el.dataset, extras || {});
    el.src = `${xtBaseUrl(folha.caminho)}/${xtCodificarCaminho(arquivo)}?t=${Date.now()}`;
    el.onload = () => resolve(true);
    el.onerror = () => {
      console.error(`[extensoes] "${folha.nome}": não deu para carregar ${rotulo} "${arquivo}".`);
      el.remove();
      resolve(false);
    };
    document.head.appendChild(el);
  });
}

/**
 * Carrega e monta UMA extensão. Silencioso para quem não tem frontend — uma
 * extensão pode ser só backend, ou só dado (M6).
 */
async function xtCarregarFrontend(folha) {
  // ⚠️ O GUARDA É `_xtMontadas`, E NÃO A TAG <script> NO DOM. Uma extensão
  // pode ser SÓ encaixe ou SÓ evento, sem `frontend/index.js` nenhum — e o
  // guarda antigo (`if (!folha.tem_frontend) return`) a descartava na primeira
  // linha: ela ligava, aparecia ligada na lista, e não fazia nada. Nem era
  // registrada, então desligar também não tinha o que limpar.
  if (_xtMontadas.has(folha.slug)) return;

  const temEncaixes = !!(folha.encaixes && folha.encaixes.length);
  const temEventos = !!(folha.eventos && folha.eventos.length);
  const temConsultas = !!(folha.consultas && folha.consultas.length);
  const temTelas = !!(folha.telas && folha.telas.length);
  // Extensão que não tem nada de frontend é o caso normal de M6 (só dado) —
  // não é erro, e não há o que registrar.
  if (!folha.tem_frontend && !temEncaixes && !temEventos && !temConsultas && !temTelas) return;

  // ⚠️ REGISTRA ANTES DE CARREGAR QUALQUER COISA, e isso é a correção de um
  // defeito real. A partir da primeira injeção há tag no DOM; qualquer saída
  // sem registrar a abandona ali para sempre, e o guarda lá em cima faria a
  // extensão nunca mais ser recarregada. O sintoma é o pior possível:
  // consertar o erro e religar não adianta nada, e nada explica por quê.
  _xtMontadas.set(folha.slug, folha.caminho);

  // D42 "Global no navegador": o retrato de `window` ANTES de qualquer
  // arquivo dela rodar — o que aparecer depois é dela.
  _xtAvisosDeTela.delete(folha.slug);
  const globaisAntes = new Set(Object.keys(window));

  if (folha.tem_frontend) await _xtCarregarIndex(folha);

  // ⚠️ ENCAIXES E EVENTOS RODAM MESMO QUE O `index.js` TENHA FALHADO, e é de
  // propósito: eles são arquivos independentes, e um `xtMontar` esquecido não
  // é razão para a extensão também perder o item de menu que ela declarou.
  // Por isso `_xtCarregarIndex` engole os próprios erros em vez de lançar.
  if (temEncaixes && typeof xtCarregarEncaixes === 'function') {
    try {
      await xtCarregarEncaixes(folha);
    } catch (e) {
      console.error(`[extensoes] "${folha.nome}" falhou ao carregar os encaixes:`, e);
    }
    // ⚠️ OS COMANDOS ENTRAM NO REGISTRO DE TECLAS AGORA, e não só quando a
    // barra abrir: a tecla sugerida por uma extensão tem de disparar assim
    // que ela liga. Até 06/09/2026 o `Ctrl+Alt+T` do gabarito não fazia nada
    // até o usuário abrir o Ctrl+P uma vez.
    if (typeof xtRegistrarComandosAgora === 'function') xtRegistrarComandosAgora();
  }

  if (temEventos && typeof xtCarregarEventos === 'function') {
    try {
      await xtCarregarEventos(folha);
    } catch (e) {
      console.error(`[extensoes] "${folha.nome}" falhou ao carregar os eventos:`, e);
    }
  }

  // M5 — as consultas, pela mesma razão e no mesmo lugar.
  if (temConsultas && typeof xtCarregarConsultas === 'function') {
    try {
      await xtCarregarConsultas(folha);
    } catch (e) {
      console.error(`[extensoes] "${folha.nome}" falhou ao carregar as consultas:`, e);
    }
  }

  // O recurso Tela (fase 11) — aba nova e sub-aba. Mesma razão dos blocos de
  // cima: roda mesmo que o `index.js` tenha falhado.
  if (temTelas && typeof xtCarregarTelas === 'function') {
    try {
      await xtCarregarTelas(folha);
    } catch (e) {
      console.error(`[extensoes] "${folha.nome}" falhou ao carregar as telas:`, e);
    }
  }

  try {
    _xtConferirGlobais(folha, globaisAntes);
    _xtConferirEstilo(folha);
  } catch (e) {
    console.error(`[extensoes] "${folha.nome}": falha ao conferir estilo e globais:`, e);
  }
}

function _xtAvisarNaTela(slug, texto) {
  if (!_xtAvisosDeTela.has(slug)) _xtAvisosDeTela.set(slug, []);
  _xtAvisosDeTela.get(slug).push(texto);
}

/**
 * D42 "Global no navegador": o nome de toda global que a extensão criou
 * começa pelo prefixo dela. Valem (resposta do usuário ao "Pergunte antes" 1
 * da fase 10): `window.xt…_{prefixo}` (a regra aprovada), `window.xt…_{slug}`
 * (o contrato de montar: `xtMontar_{slug}`, `xtDesmontar_{slug}`,
 * `xtPreferenciasMudaram_{slug}`) e `window.{prefixo}…` (`erlCache`,
 * `svlPrefs`, `ERL_…` — é o que as treze que vêm com o programa usam). Outro
 * nome vira AVISO na lista.
 *
 * ⚠️ Só vale para o manifesto NOVO, e só vê o que a extensão criou na carga
 * SÍNCRONA: uma global criada depois de um `await` (dentro do `_montar()`, num
 * evento) escapa. `let`/`const` de nível zero não viram propriedade de
 * `window` e também não aparecem — mas continuam no espaço de nomes comum.
 */
function _xtConferirGlobais(folha, antes) {
  const pfx = folha.formato === 'novo' ? folha.prefixo : '';
  if (!pfx) return;
  const PFX = pfx.toUpperCase();
  const vale = (k) => k.startsWith(pfx) || k.startsWith(PFX)
    || (k.startsWith('xt') && (k.endsWith(`_${folha.slug}`) || k.endsWith(`_${pfx}`)));
  const fora = Object.keys(window).filter(k => !antes.has(k) && !vale(k));
  if (!fora.length) return;
  const mostrar = fora.slice(0, 5).map(k => `window.${k}`).join(', ');
  const resto = fora.length > 5 ? ` e mais ${fora.length - 5}` : '';
  _xtAvisarNaTela(folha.slug,
    `aviso: ${fora.length === 1 ? 'a global' : 'as globais'} ${mostrar}${resto} não `
    + `${fora.length === 1 ? 'começa' : 'começam'} pelo prefixo "${pfx}" — pode sobrescrever `
    + 'em silêncio uma função do programa ou de outra extensão.');
}

/**
 * D42 "Estilo": todo seletor de CSS da extensão começa pelo prefixo dela
 * (`.erl-…`, `#erl-…`, `[data-erl…`). O que não começar vira AVISO na lista.
 *
 * ⚠️ Só vale para o manifesto NOVO (o antigo não tem `prefixo`), e só vê o
 * `<style>`/`<link>` que existe AGORA, logo depois da carga — um estilo que a
 * extensão cria depois (num evento, num `await`) escapa. `link` de outra
 * origem lança ao ler `cssRules`: é pulado.
 */
function _xtConferirEstilo(folha) {
  const pfx = folha.formato === 'novo' ? folha.prefixo : '';
  if (!pfx) return;
  const aceitos = [`.${pfx}-`, `#${pfx}-`, `[data-${pfx}`];
  const fora = [];
  const varrer = (regras) => {
    for (const regra of regras) {
      if (regra.cssRules && !regra.selectorText) { varrer(regra.cssRules); continue; }
      if (!regra.selectorText) continue;       // @font-face, @keyframes…
      regra.selectorText.split(',').map(s => s.trim()).forEach((s) => {
        if (s && !aceitos.some(a => s.startsWith(a)) && !fora.includes(s)) fora.push(s);
      });
    }
  };
  document.querySelectorAll(`style[data-xt="${folha.slug}"], link[data-xt="${folha.slug}"]`)
    .forEach((el) => {
      try {
        if (el.sheet) varrer(el.sheet.cssRules);
      } catch (e) { /* folha de outra origem: não dá para ler */ }
    });
  if (!fora.length) return;
  const mostrar = fora.slice(0, 5).map(s => `"${s}"`).join(', ');
  const resto = fora.length > 5 ? ` e mais ${fora.length - 5}` : '';
  _xtAvisarNaTela(folha.slug,
    `aviso: ${fora.length === 1 ? 'o seletor' : 'os seletores'} de CSS ${mostrar}${resto} `
    + `não ${fora.length === 1 ? 'começa' : 'começam'} pelo prefixo "${pfx}" — `
    + 'pode colidir com o estilo do programa ou de outra extensão.');
}

/**
 * O `frontend/index.js`: injeta e chama o `xtMontar` dela.
 *
 * Nunca lança — quem chama precisa seguir para os encaixes e os eventos de
 * qualquer jeito.
 */
async function _xtCarregarIndex(folha) {
  const id = _xtIdDoScript(folha.slug);
  // ⚠️ Uma tag com este id que ainda esteja no <head> é SOBRA, e não sinal
  // de "já carregado": o guarda de carga é `_xtMontadas`, e quem chegou aqui
  // não está nele. Sair calado deixava a extensão registrada, sem `xtMontar`
  // rodar — ligada na lista, e sem fazer nada. A sobra sai e o arquivo entra
  // de novo, com `?t=` novo.
  const sobra = document.getElementById(id);
  if (sobra) sobra.remove();

  try {
    await _xtInjetarScript(
      id, `${xtBaseUrl(folha.caminho)}/frontend/index.js?t=${Date.now()}`, folha);
  } catch (e) {
    // A tag já foi para o `<head>` antes de o erro chegar (`onerror` é evento,
    // não exceção) — tirá-la aqui é o que permite tentar de novo depois.
    const orfa = document.getElementById(id);
    if (orfa) orfa.remove();
    console.error(`[extensoes] "${folha.nome}": ${e.message}`);
    return;
  }

  // O `index.js` define `window.xtMontar_{slug}` de forma SÍNCRONA — é o que
  // o contrato exige, e é por isso que dá para chamá-la logo depois do
  // onload sem esperar por nada. O trabalho demorado dela vai dentro de um
  // `_montar()` assíncrono que ela mesma dispara.
  const montar = window[`xtMontar_${folha.slug}`];
  if (typeof montar !== 'function') {
    console.error(`[extensoes] "${folha.nome}": o frontend/index.js não definiu `
                  + `window.xtMontar_${folha.slug}.`);
    return;
  }
  try {
    await montar();
  } catch (e) {
    // Montou pela metade — e continua registrada, para o desligar ter o que
    // limpar. Largá-la aqui abandonaria o `<style>` que ela já injetou.
    console.error(`[extensoes] "${folha.nome}" falhou ao montar:`, e);
  }
}

/**
 * Põe a tela em dia com a árvore: monta o que ligou, desmonta o que desligou.
 *
 * Desmonta PRIMEIRO — ver o aviso em `xtAdotarArvore`.
 */
async function xtSincronizarCarga() {
  const ligadas = xtLigadas();
  const slugsLigados = new Set(ligadas.map(e => e.slug));

  for (const slug of [..._xtMontadas.keys()]) {
    if (slugsLigados.has(slug)) continue;
    await xtDescarregarFrontend(slug);
  }

  for (const folha of ligadas) {
    await xtCarregarFrontend(folha);
  }

  // ⚠️ UMA REPINTURA NO FIM, e não uma por extensão. Os pontos que já estão
  // na tela precisam se atualizar para quem ligou uma extensão com o Quadro
  // aberto vê-la aparecer sem trocar de aba (D13). Mas repintar dentro do
  // laço faria o Quadro inteiro ser redesenhado N vezes ao ligar N extensões
  // — e o Quadro redesenha todos os cartões e religa o arraste de cada um.
  if (typeof xtRepintarPontosAbertos === 'function') xtRepintarPontosAbertos();
}
