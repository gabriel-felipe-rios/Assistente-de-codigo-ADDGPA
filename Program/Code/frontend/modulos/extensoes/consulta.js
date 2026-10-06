// ═════════════════════════ EXTENSÕES DO PROGRAMA — M5, A CONSULTA ══
// O sexto e último mecanismo, e o inverso do M4: lá o programa **avisa** e a
// extensão reage; aqui o programa **pergunta** e precisa da resposta.
//
//     const respostas = await xtConsultar('editor.autocomplete', pergunta);
//
// ⚠️ **ESTE É O CAMINHO QUENTE DA CAMADA INTEIRA.** A consulta 27 responde a
// cada tecla digitada no Editor. Tudo aqui é desenhado em torno de um número:
// o intervalo entre duas teclas de quem digita rápido. Três regras saem disso,
// e nenhuma é ajuste fino — cada uma existe para impedir um jeito conhecido de
// engasgar a digitação.

// ── Regra 1 · NENHUMA IDA AO PYTHON POR TECLA ───────────────────────────
// Os símbolos do projeto são carregados UMA vez e ficam aqui. A extensão
// filtra em memória. Uma variante "me dá os símbolos que começam com X" seria
// mais elegante e destruiria o recurso: a ponte `pywebview` custa milissegundos
// que o teclado não tem para dar.
let _xtSimbolos = [];
let _xtSimbolosDoProjeto = null;   // de qual projeto o cache é
let _xtSimbolosCarregando = null;  // a promessa em curso, para não pedir duas vezes

// ── Regra 2 · DEBOUNCE ──
// 80 ms: acima do intervalo de quem digita rápido (~50 ms) e abaixo do que o
// olho percebe como atraso (~100 ms). Quem digita uma palavra inteira dispara
// UMA consulta, no fim, e não uma por letra.
const XT_DEBOUNCE_MS = 80;

// ── Regra 3 · TETO, como a Guardiã do M4 ──
// Uma consulta que não responde não pode segurar o popup para sempre. Passado
// o teto, a resposta simplesmente não aparece — e não aparecer é
// infinitamente melhor que travar a tecla.
//
// ⚠️ O TETO É POR CONSULTA (fase 12), e vem do catálogo do backend
// (`consulta.py`, `teto_ms`) junto de cada consulta da folha — nunca copiado
// para cá. Este número é só o de quem não disse o próprio: o do autocomplete,
// que roda a cada tecla. Formatar um arquivo inteiro com 150 ms seria sempre
// descartado.
const XT_TETO_CONSULTA_MS = 150;

// `{nome: Map<slug, fn>}` — quem responde o quê.
const _xtConsultas = new Map();
// `{slug: Set<nome>}` — o índice inverso, para a baixa não varrer tudo.
const _xtConsultasPorSlug = new Map();
// `{`${slug}|${nome}`: [linguagens]}` e `{nome: teto_ms}` — o que o manifesto
// disse de cada consulta, guardado por `xtCarregarConsultas` ANTES de o
// arquivo rodar. A extensão não os repete ao registrar.
const _xtConsultasLinguagens = new Map();
const _xtTetosConsulta = new Map();

/** Esta extensão responde esta consulta PARA esta linguagem? Sem linguagem
 *  (o autocomplete não pergunta por uma), responde. */
function _xtRespondeLinguagem(slug, nome, linguagem) {
  if (!linguagem) return true;
  const langs = _xtConsultasLinguagens.get(`${slug}|${nome}`) || ['*'];
  return langs.includes('*') || langs.includes(linguagem);
}

/** O arquivo de consulta da extensão chama isto quando carrega. */
// eslint-disable-next-line no-unused-vars
function xtRegistrarConsulta(slug, nome, fn) {
  if (typeof fn !== 'function') {
    console.error(`[extensoes] a consulta "${nome}" de ${slug} não passou uma função.`);
    return;
  }
  if (!_xtConsultas.has(nome)) _xtConsultas.set(nome, new Map());
  _xtConsultas.get(nome).set(slug, fn);

  if (!_xtConsultasPorSlug.has(slug)) _xtConsultasPorSlug.set(slug, new Set());
  _xtConsultasPorSlug.get(slug).add(nome);
}

/**
 * Tira do registro todas as consultas de uma extensão desligada.
 *
 * Chamada por `descarregar.js` — que a procura por `typeof`, como faz com os
 * encaixes e os assinantes desde a Obra 1.
 */
// eslint-disable-next-line no-unused-vars
function xtDesregistrarConsultas(slug) {
  const nomes = _xtConsultasPorSlug.get(slug);
  if (!nomes) return;
  for (const nome of nomes) {
    const na = _xtConsultas.get(nome);
    if (na) na.delete(slug);
    _xtConsultasLinguagens.delete(`${slug}|${nome}`);
  }
  _xtConsultasPorSlug.delete(slug);
}

/**
 * Alguém responde esta consulta agora?
 *
 * ⚠️ **É a pergunta mais importante deste arquivo, e ela é síncrona de
 * propósito.** O Editor a faz a cada tecla ANTES de qualquer outra coisa: sem
 * extensão de tipo 27 ligada, ele não agenda debounce, não lê o cursor, não
 * carrega símbolo nenhum. Um `Map.size` é o custo total do autocomplete para
 * quem nunca instalou uma extensão — que é a esmagadora maioria.
 */
// eslint-disable-next-line no-unused-vars
function xtAlguemResponde(nome) {
  const na = _xtConsultas.get(nome);
  return !!(na && na.size);
}

/** Alguém responde esta consulta para ESTA linguagem? — o `ativo` do comando
 *  "Formatar o arquivo" pergunta isto. Mais caro que `xtAlguemResponde`
 *  (percorre quem responde), e por isso nunca vai para o caminho quente. */
// eslint-disable-next-line no-unused-vars
function xtAlguemRespondeEm(nome, linguagem) {
  const na = _xtConsultas.get(nome);
  if (!na || !na.size) return false;
  for (const slug of na.keys()) if (_xtRespondeLinguagem(slug, nome, linguagem)) return true;
  return false;
}

/**
 * Os símbolos do projeto, carregados uma vez e guardados.
 *
 * Trocar de projeto invalida o cache — e é por isso que o projeto faz parte da
 * chave. Sem isso, abrir outro projeto ofereceria as sugestões do anterior, um
 * defeito que ninguém liga à causa.
 */
// eslint-disable-next-line no-unused-vars
async function xtSimbolos(projeto) {
  if (_xtSimbolosDoProjeto === projeto) return _xtSimbolos;
  // Duas teclas seguidas antes de a primeira carga voltar pedem a MESMA
  // promessa, e não duas cargas do índice inteiro.
  if (_xtSimbolosCarregando && _xtSimbolosCarregando.projeto === projeto) {
    return _xtSimbolosCarregando.promessa;
  }

  // A geração de agora. Se `xtEsquecerSimbolos` rodar enquanto esta carga
  // está em voo (o usuário trocou de projeto), a resposta que voltar é de um
  // projeto que já não está aberto — e não pode virar cache nem derrubar o
  // dedupe da carga do projeto novo.
  const minhaGeracao = _xtSimbolosGeracao;
  const promessa = (async () => {
    let simbolos = [];
    try {
      const r = await window.pywebview.api.simbolos_para_autocomplete(projeto);
      simbolos = (r && r.success) ? (r.simbolos || []) : [];
      if (r && r.truncado) {
        console.warn('[extensoes] o índice de símbolos foi truncado para o '
                     + 'autocomplete — o projeto tem mais nomes que o teto.');
      }
    } catch (e) {
      // Sem índice o autocomplete some, e o Editor continua. Um projeto que
      // nunca teve a aba Análise aberta cai exatamente aqui, e isso é o
      // estado normal dele, não uma falha.
      console.error('[extensoes] falha ao carregar os símbolos:', e);
    }
    if (minhaGeracao !== _xtSimbolosGeracao) return simbolos;
    _xtSimbolos = simbolos;
    _xtSimbolosDoProjeto = projeto;
    _xtSimbolosCarregando = null;
    return _xtSimbolos;
  })();

  _xtSimbolosCarregando = { projeto, promessa };
  return promessa;
}

// Cresce a cada `xtEsquecerSimbolos` — ver `xtSimbolos`.
let _xtSimbolosGeracao = 0;

/** Esquece o cache — chamado quando o projeto troca. */
// eslint-disable-next-line no-unused-vars
function xtEsquecerSimbolos() {
  _xtSimbolosGeracao += 1;
  _xtSimbolos = [];
  _xtSimbolosDoProjeto = null;
  _xtSimbolosCarregando = null;
}

// ⚠️ `_xtComTetoConsulta`, e NÃO `_xtComTeto`: `eventos.js` tinha uma função
// com esse nome, e esta — carregada uma linha depois no `index.html` — a
// sobrescrevia em silêncio. A guardiã do Ctrl+S passava a rodar com 150 ms
// em vez de 1,5 s. Ver o aviso em `eventos.js::_xtComTetoGuardia`.
function _xtComTetoConsulta(fn, pergunta, slug, nome) {
  const teto = _xtTetosConsulta.get(nome) || XT_TETO_CONSULTA_MS;
  let relogio;
  const estouro = new Promise((resolve) => {
    relogio = setTimeout(() => {
      console.error(`[extensoes] a consulta "${nome}" de ${slug} não respondeu em `
                    + `${teto} ms — ignorada.`);
      resolve(null);
    }, teto);
  });
  return Promise.race([Promise.resolve().then(() => fn(pergunta)), estouro])
    .finally(() => clearTimeout(relogio));
}

/**
 * O programa pergunta. Devolve a lista somada das respostas.
 *
 * ⚠️ **Em PARALELO, e não em série como as guardiãs do M4.** Lá a ordem
 * importava porque cada guardiã via o dado que a anterior devolveu; aqui as
 * respostas são independentes e somadas, então esperar uma para começar a
 * outra só somaria os tetos. Com `Promise.all`, três extensões custam o tempo
 * da mais lenta, não o das três.
 *
 * Nunca lança e nunca deixa uma extensão derrubar as outras.
 */
/**
 * As entradas de um registro (`Map<slug, …>`) NA ORDEM DA LISTA de Programa ›
 * Extensões, e não na ordem em que ligaram (D42 "Ordem") — uma extensão
 * religada iria para o fim do `Map`.
 *
 * ⚠️ Nome próprio deste arquivo: o frontend não tem escopo de módulo, e um
 * helper de mesmo nome em `encaixes.js` ou `eventos.js` sobrescreveria este em silêncio (ver o aviso
 * de `_xtComTetoGuardia` em `eventos.js`).
 */
function _xtConsultasNaOrdem(mapa) {
  const entradas = [...mapa];
  if (entradas.length < 2 || typeof xtLigadas !== 'function') return entradas;
  const posicao = new Map(xtLigadas().map((e, i) => [e.slug, i]));
  const de = (slug) => (posicao.has(slug) ? posicao.get(slug) : Number.MAX_SAFE_INTEGER);
  return entradas.sort((a, b) => de(a[0]) - de(b[0]));
}

// `linguagem` (fase 12): pergunta só a quem declarou a linguagem do arquivo
// (ou `*`). Sem ela — o autocomplete — pergunta a todos, como sempre.
// eslint-disable-next-line no-unused-vars
async function xtConsultar(nome, pergunta, linguagem) {
  const na = _xtConsultas.get(nome);
  if (!na || !na.size) return [];

  const quem = _xtConsultasNaOrdem(na).filter(([slug]) => _xtRespondeLinguagem(slug, nome, linguagem));
  const respostas = await Promise.all(quem.map(async ([slug, fn]) => {
    try {
      return await _xtComTetoConsulta(fn, pergunta, slug, nome);
    } catch (e) {
      console.error(`[extensoes] a consulta "${nome}" de ${slug} falhou:`, e);
      return null;
    }
  }));

  const somadas = [];
  for (const r of respostas) {
    if (!Array.isArray(r)) continue;
    for (const item of r) {
      if (item && typeof item === 'object' && item.texto) somadas.push(item);
    }
  }
  return somadas;
}

/**
 * A pergunta de RESPOSTA ÚNICA (fase 12, D42) — a formatação: duas extensões
 * formatando o mesmo arquivo não se somam, uma vence.
 *
 * Pergunta às que respondem `nome` para `linguagem`, EM SÉRIE e na ordem da
 * lista de Programa › Extensões, e devolve a PRIMEIRA resposta que não for
 * `null`/`undefined` — ou `null`. É a escolha única enquanto o usuário não tem
 * onde escolher: vale a que vem antes na lista (o aviso de disputa da
 * descoberta diz isso às duas).
 *
 * Em série, e não em paralelo como `xtConsultar`: a segunda só é perguntada
 * se a primeira disse "não sei formatar este" — e formatar custa caro.
 *
 * Nunca lança: a extensão que falha ou estoura o teto é pulada, com o erro no
 * console.
 */
// eslint-disable-next-line no-unused-vars
async function xtConsultarUma(nome, pergunta, linguagem) {
  const na = _xtConsultas.get(nome);
  if (!na || !na.size) return null;
  for (const [slug, fn] of _xtConsultasNaOrdem(na)) {
    if (!_xtRespondeLinguagem(slug, nome, linguagem)) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await _xtComTetoConsulta(fn, pergunta, slug, nome);
      if (r !== null && r !== undefined) return r;
    } catch (e) {
      console.error(`[extensoes] a consulta "${nome}" de ${slug} falhou:`, e);
    }
  }
  return null;
}

// ── A carga dos arquivos de consulta ────────────────────────────────────

/** Carrega as consultas declaradas por UMA extensão que acabou de ligar. O
 *  injetor é o de `carga.js`, o mesmo dos encaixes e dos eventos. */
// eslint-disable-next-line no-unused-vars
async function xtCarregarConsultas(folha) {
  for (const consulta of (folha.consultas || [])) {
    // ANTES de injetar: o arquivo registra a função ao rodar, e o registro já
    // precisa saber para que linguagens ela responde e quanto esperá-la.
    const linguagens = consulta.linguagens && consulta.linguagens.length ? consulta.linguagens : ['*'];
    _xtConsultasLinguagens.set(`${folha.slug}|${consulta.nome}`, linguagens);
    if (consulta.teto_ms) _xtTetosConsulta.set(consulta.nome, consulta.teto_ms);
    await xtInjetarArquivoDaExtensao(folha, consulta.arquivo,
      { consulta: consulta.nome, linguagens: linguagens.join(',') }, 'a consulta');
  }
}

/** Esta extensão responde alguma consulta? — para `descarregar.js` saber se
 *  precisa fechar o popup do autocomplete ao desligá-la. */
// eslint-disable-next-line no-unused-vars
function xtSlugResponde(slug) {
  return _xtConsultasPorSlug.has(slug);
}

// ── O debounce do caminho quente ────────────────────────────────────────

// `{nome: {relogio, pedido}}` — POR CONSULTA, e não um relógio só. Com um
// relógio global, a segunda consulta que entrar no catálogo cancelaria o
// debounce da primeira sem aviso nenhum. `pedido` cresce a cada chamada: a
// resposta que voltar com um número velho é DESCARTADA — sem isto, uma
// consulta lenta disparada há três teclas chegaria depois da rápida e
// sobrescreveria o popup com sugestões do prefixo antigo.
const _xtPausas = new Map();

function _xtPausaDe(nome) {
  if (!_xtPausas.has(nome)) _xtPausas.set(nome, { relogio: null, pedido: 0 });
  return _xtPausas.get(nome);
}

/**
 * Pergunta depois da pausa, e só entrega se ninguém digitou nada no meio.
 *
 * `aoResponder` recebe a lista somada. Não é chamada quando o pedido ficou
 * obsoleto — é o que garante que o popup mostre sempre o prefixo que está na
 * tela AGORA, e não o de duas teclas atrás.
 */
// eslint-disable-next-line no-unused-vars
function xtConsultarComPausa(nome, montarPergunta, aoResponder) {
  const pausa = _xtPausaDe(nome);
  clearTimeout(pausa.relogio);
  const meu = ++pausa.pedido;
  pausa.relogio = setTimeout(async () => {
    const pergunta = await montarPergunta();
    // O prefixo pode ter deixado de existir enquanto os símbolos carregavam
    // (a primeira consulta de um projeto espera o índice inteiro).
    if (meu !== pausa.pedido || !pergunta) return;
    const respostas = await xtConsultar(nome, pergunta, pergunta.linguagem);
    if (meu !== pausa.pedido) return;
    aoResponder(respostas);
  }, XT_DEBOUNCE_MS);
}

/** Cancela o que estiver agendado — o Editor chama ao fechar o popup. Sem
 *  `nome`, cancela todas. */
// eslint-disable-next-line no-unused-vars
function xtCancelarConsulta(nome) {
  const alvos = nome ? [nome] : [..._xtPausas.keys()];
  for (const n of alvos) {
    const pausa = _xtPausas.get(n);
    if (!pausa) continue;
    clearTimeout(pausa.relogio);
    pausa.pedido += 1;
  }
}
