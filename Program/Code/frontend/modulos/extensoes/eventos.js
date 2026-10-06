// ═════════════════════════ EXTENSÕES DO PROGRAMA — M4, O BARRAMENTO ══
// Este é o mecanismo genuinamente NOVO da camada. Até aqui, toda conversa
// entre o programa e o que se pluga nele era **sob demanda**: o usuário
// clica, a tela pergunta, a extensão responde. O programa nunca tomava a
// iniciativa — nem com plugin (que só é chamado quando a aba dele abre), nem
// com os encaixes da Obra 2 (que só rodam quando a tela desenha).
//
// Aqui o programa **avisa**: "vou salvar", "abri um projeto". E a extensão
// pode reagir — ou **barrar**.
//
// ── Os dois papéis, e a diferença que importa ───────────────────────────
//
//   OBSERVADOR (tipo 16) roda DEPOIS da ação e o programa NÃO ESPERA por ele.
//     Ele não pode atrasar nada e não pode impedir nada. Se explodir, vira
//     `console.error` com o nome da extensão e a vida segue.
//
//   GUARDIÃ (tipo 17) roda ANTES da ação, o programa ESPERA — e ela pode
//     devolver `{barrar: true, motivo}` para a ação não acontecer.
//
// ⚠️ **A Guardiã tem teto de tempo, e o teto é a peça mais importante deste
// arquivo.** Uma extensão que trava — um `await` que nunca resolve, uma
// chamada ao backend que não volta — travaria o Ctrl+S do usuário para
// sempre, sem mensagem nenhuma, e sem que ele tivesse como ligar uma coisa à
// outra. Passado o teto, o programa segue como se ela tivesse dito "pode".
//
// Isto é uma escolha, e ela tem um preço: uma Guardiã lenta é ignorada em
// vez de respeitada. O preço do contrário é pior — o programa deixaria de
// salvar arquivo porque uma extensão de terceiro tem um bug.

// 1,5 s. Tempo de sobra para formatar um arquivo em memória (que é o caso de
// uso real, E6 "formatar ao salvar"), e curto o bastante para o usuário não
// pensar que o Ctrl+S falhou.
const XT_TETO_GUARDIA_MS = 1500;

// `{nome: Map<slug, {fn, guardia}>}`. ⚠️ A ordem de EXECUÇÃO é a da lista de
// Programa › Extensões (D42), e não a de assinatura: quem percorre passa por
// `_xtAssinantesNaOrdem`. Reações "antes" rodam em fila nessa ordem.
const _xtAssinantes = new Map();
// `{slug: Set<nome>}` — o índice inverso, para o desligar não varrer tudo.
const _xtAssinaturasPorSlug = new Map();

/**
 * O arquivo de evento da extensão chama isto quando carrega.
 *
 * `guardia` decide o papel — e é o manifesto que o define, não este arquivo:
 * quem lê o `extensao.json` precisa conseguir ver que a extensão pode barrar
 * o salvamento sem abrir o JavaScript dela.
 */
// eslint-disable-next-line no-unused-vars
function xtAssinar(slug, nome, fn, guardia) {
  if (typeof fn !== 'function') {
    console.error(`[extensoes] a assinatura de "${nome}" em ${slug} não passou uma função.`);
    return;
  }
  if (!_xtAssinantes.has(nome)) _xtAssinantes.set(nome, new Map());
  _xtAssinantes.get(nome).set(slug, { fn, guardia: !!guardia });

  if (!_xtAssinaturasPorSlug.has(slug)) _xtAssinaturasPorSlug.set(slug, new Set());
  _xtAssinaturasPorSlug.get(slug).add(nome);
}

/**
 * Tira do barramento todas as assinaturas de uma extensão desligada.
 *
 * Chamada por `descarregar.js`, que a procura por `typeof` — a ordem já
 * estava escrita lá desde a Obra 1, à espera deste arquivo.
 *
 * ⚠️ Uma Guardiã que continuasse assinada depois de desligada seria o pior
 * defeito possível desta camada: o usuário desligaria a extensão justamente
 * porque ela está barrando o salvamento dele, e continuaria barrado.
 */
// eslint-disable-next-line no-unused-vars
function xtDesregistrarAssinantes(slug) {
  const nomes = _xtAssinaturasPorSlug.get(slug);
  if (!nomes) return;
  for (const nome of nomes) {
    const noEvento = _xtAssinantes.get(nome);
    if (noEvento) noEvento.delete(slug);
  }
  _xtAssinaturasPorSlug.delete(slug);
}

/**
 * As entradas de um registro (`Map<slug, …>`) NA ORDEM DA LISTA de Programa ›
 * Extensões, e não na ordem em que ligaram (D42 "Ordem") — uma extensão
 * religada iria para o fim do `Map`.
 *
 * ⚠️ Nome próprio deste arquivo: o frontend não tem escopo de módulo, e um
 * helper de mesmo nome em `encaixes.js` ou `consulta.js` sobrescreveria este em silêncio (ver o aviso
 * de `_xtComTetoGuardia` em `eventos.js`).
 */
function _xtAssinantesNaOrdem(mapa) {
  const entradas = [...mapa];
  if (entradas.length < 2 || typeof xtLigadas !== 'function') return entradas;
  const posicao = new Map(xtLigadas().map((e, i) => [e.slug, i]));
  const de = (slug) => (posicao.has(slug) ? posicao.get(slug) : Number.MAX_SAFE_INTEGER);
  return entradas.sort((a, b) => de(a[0]) - de(b[0]));
}

/**
 * O NOME da extensão (o do manifesto, o da lista), pelo slug — para dizer
 * QUEM barrou. ⚠️ Não é `_xtNomeDaExtensao` (de `acesso-rapido-extensao.js`):
 * um nome por arquivo, sempre.
 */
function _xtNomeDoAssinante(slug) {
  const folha = (typeof xtLigadas === 'function') ? xtLigadas().find((f) => f.slug === slug) : null;
  return (folha && folha.nome) || slug;
}

/**
 * Corre a função da Guardiã contra o cronômetro.
 *
 * ⚠️ `Promise.race` não CANCELA a perdedora — a Guardiã lenta continua
 * rodando depois do teto, e o que ela devolver será ignorado. É o
 * comportamento certo: cancelar de verdade não existe em JavaScript, e a
 * alternativa (esperar) é justamente o que este teto existe para impedir.
 */
// ⚠️ O NOME É `_xtComTetoGuardia`, E NÃO `_xtComTeto`. O frontend não tem
// escopo de módulo: `consulta.js` tinha uma função com o mesmo nome, carregada
// uma linha depois desta no `index.html`, e ela SOBRESCREVIA esta em silêncio.
// A guardiã rodava com o teto da consulta — 150 ms em vez de 1,5 s — e uma
// formatação de arquivo grande era descartada com a mensagem "a consulta …
// não respondeu". Tudo o que o cabeçalho deste arquivo diz sobre 1,5 s estava
// escrito e não executava. Um nome por arquivo, sempre.
function _xtComTetoGuardia(fn, dado, slug, nome) {
  let relogio;
  const estouro = new Promise((resolve) => {
    relogio = setTimeout(() => {
      // No console, com o nome da extensão: o usuário não vê nada (a ação
      // aconteceu normalmente), mas quem está escrevendo a extensão precisa
      // desta linha para entender por que a guarda dele não fez efeito.
      console.error(`[extensoes] a guardiã de "${nome}" em ${slug} não respondeu em `
                    + `${XT_TETO_GUARDIA_MS} ms — o programa seguiu sem ela.`);
      resolve(null);
    }, XT_TETO_GUARDIA_MS);
  });
  return Promise.race([Promise.resolve().then(() => fn(dado)), estouro])
    .finally(() => clearTimeout(relogio));
}

/**
 * O programa avisa. Devolve `{barrado, motivo, por, dado}` — `por` é o nome
 * da extensão que barrou.
 *
 * Quem emite ANTES da ação usa o retorno:
 *
 *     const r = await xtEmitir('editor.vai_salvar', { projeto, arquivo, texto });
 *     if (r.barrado) { showToast(`${r.por}: ${r.motivo}`, true); return; }
 *     const texto = r.dado.texto;   // uma guardiã pode ter reescrito
 *
 * Quem emite DEPOIS da ação ignora o retorno — não há o que barrar no que já
 * aconteceu.
 *
 * ⚠️ **As Guardiãs rodam em série, e o `dado` passa de uma para a outra.** É
 * o que faz duas extensões de formatação conviverem: a segunda formata o que
 * a primeira devolveu, em vez de as duas brigarem pelo texto original. A
 * primeira que barra encerra — as seguintes não chegam a rodar, porque a
 * ação já não vai acontecer.
 *
 * ⚠️ **Os Observadores são disparados e ESQUECIDOS** — sem `await`. É a
 * diferença de papel, e ela é literal: se este `for` esperasse por eles, um
 * observador lento atrasaria o Ctrl+S exatamente como uma guardiã, e o tipo
 * 16 teria deixado de se distinguir do 17.
 */
// eslint-disable-next-line no-unused-vars
async function xtEmitir(nome, dado) {
  const noEvento = _xtAssinantes.get(nome);
  if (!noEvento || !noEvento.size) return { barrado: false, motivo: '', dado };

  let atual = dado;

  for (const [slug, { fn, guardia }] of _xtAssinantesNaOrdem(noEvento)) {
    if (!guardia) continue;
    let resposta;
    try {
      resposta = await _xtComTetoGuardia(fn, atual, slug, nome);
    } catch (e) {
      // Guardiã que explode NÃO barra. Barrar por engano é pior que não
      // barrar: o usuário perderia o que digitou por causa de um bug de
      // terceiro, e sem uma pista do motivo.
      console.error(`[extensoes] a guardiã de "${nome}" em ${slug} falhou:`, e);
      continue;
    }
    if (!resposta || typeof resposta !== 'object') continue;
    if (resposta.barrar) {
      // D42: a primeira que barra encerra, e diz QUEM foi — pelo nome da
      // extensão, e não pelo slug. Quem mostra escreve «${r.por}: ${r.motivo}».
      return {
        barrado: true,
        motivo: String(resposta.motivo || 'impediu esta ação.'),
        por: _xtNomeDoAssinante(slug),
        dado: atual,
      };
    }
    // Uma guardiã pode REESCREVER o dado — é assim que "formatar ao salvar"
    // funciona: ela devolve `{dado: {…, texto: formatado}}` e o programa
    // grava o que voltou.
    if (resposta.dado && typeof resposta.dado === 'object') atual = resposta.dado;
  }

  for (const [slug, { fn, guardia }] of _xtAssinantesNaOrdem(noEvento)) {
    if (guardia) continue;
    try {
      // `Promise.resolve` para o observador assíncrono que rejeita cair no
      // `catch` daqui, e não virar um "unhandled rejection" que ninguém liga
      // a extensão nenhuma.
      Promise.resolve()
        .then(() => fn(atual))
        .catch(e => console.error(`[extensoes] o observador de "${nome}" em ${slug} falhou:`, e));
    } catch (e) {
      console.error(`[extensoes] o observador de "${nome}" em ${slug} falhou:`, e);
    }
  }

  return { barrado: false, motivo: '', dado: atual };
}

// ── A carga dos arquivos de evento ──────────────────────────────────────

/**
 * Carrega as assinaturas declaradas por UMA extensão que acabou de ligar.
 *
 * O papel viaja no `dataset` como texto (`guardia: '1'` ou `'0'`) porque
 * `dataset` só guarda texto. Quem lê do outro lado compara com `'1'`, e não
 * confia na conversão implícita — a string `'false'` é verdadeira em
 * JavaScript, e uma guardiã criada por engano a partir de um observador é o
 * defeito mais caro daqui.
 *
 * ⚠️ Uma assinatura do lado BACKEND não tem arquivo para injetar: quem a
 * recebe é o `ao_evento` do Python. Ela é pulada aqui.
 */
// eslint-disable-next-line no-unused-vars
async function xtCarregarEventos(folha) {
  for (const assinatura of (folha.eventos || [])) {
    if (assinatura.lado === 'backend' || !assinatura.arquivo) continue;
    await xtInjetarArquivoDaExtensao(folha, assinatura.arquivo,
      { evento: assinatura.nome, guardia: assinatura.guardia ? '1' : '0' }, 'o evento');
  }
}
