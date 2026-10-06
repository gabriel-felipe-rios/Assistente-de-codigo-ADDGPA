// ══ TRABALHOS → terminal: o tema e o TAMANHO em células ═══════════════════
//
// Tudo que responde "quantas colunas e quantas linhas cabem aqui" — e o tema,
// que sai do CSS em vez de ser escrito aqui.
//
// ⚠️ A CONTA É POR `clientWidth`, NUNCA POR `getBoundingClientRect()`. O
// `addon-fit` do xterm usa o segundo, que já vem MULTIPLICADO pelo zoom do
// canvas da Oficina (que vai a 6×) — com ele, um terminal ampliado se acha
// gigante e pede 500 colunas ao shell. `clientWidth` é layout e ignora o
// transform do ancestral. É por isso que o addon não é usado.
//
// ⚠️ A LARGURA COM QUE UM TERMINAL NASCE VEM DE 80 COLUNAS DA FONTE REAL, e não
// de um número escolhido a olho: é a medida do próprio glifo, sondada uma vez e
// publicada para o CSS.
//
// ⚠️ O TEMA É LIDO DO CSS (`trShCor`), com reserva. Cores literais aqui fariam
// o terminal ser o único pedaço da tela que não troca junto com o tema.
// ── O tema, lido do CSS ─────────────────────────────────────────────────────
//
// ⚠️ NÃO DÁ PARA LER O TOKEN COM `getPropertyValue`: uma custom property devolve
// o TEXTO declarado, e os tokens deste projeto são `rgb(var(--x-rgb))`, que é
// texto sem cor nenhuma dentro. O jeito de resolver é PINTAR — a mesma lição
// que `ofiHexDaCor` já registrou no arquivo vizinho.
function trShCor(token, reserva) {
  try {
    const sonda = document.createElement('span');
    sonda.style.cssText = 'display:none; color: var(' + token + ')';
    document.body.appendChild(sonda);
    const cor = getComputedStyle(sonda).color;
    sonda.remove();
    return cor && cor.startsWith('rgb') ? cor : reserva;
  } catch (e) { return reserva; }
}

function trShTema() {
  return {
    background: trShCor('--surface-dark', '#1b232e'),
    foreground: trShCor('--text', '#e6e6e6'),
    cursor: trShCor('--text', '#e6e6e6'),
    selectionBackground: 'rgba(122, 162, 247, .35)',
  };
}

// ── O tamanho, em células ───────────────────────────────────────────────────
//
// ⚠️ NUNCA USE `fit()` NEM `getBoundingClientRect()` AQUI. Os dois devolvem
// pixels DE TELA, já multiplicados pelo `scale(k)` do `.ofi-mundo`: em zoom
// 0,4× o terminal se acharia com 40% das colunas, e um gesto de zoom — que não
// deveria mexer em nada — reformataria a saída do programa lá dentro.
//
// `clientWidth`/`clientHeight` são medidas de LAYOUT e ignoram o `transform` do
// ancestral. É delas que a conta parte, e é essa a prova de que ela está certa:
// dar zoom não muda o resultado.

// ⚠️ QUEM SABE O TAMANHO DA CÉLULA É O XTERM, E NÃO UMA CONTA NOSSA. A sonda
// abaixo continua aqui como reserva, mas ela ERRA A ALTURA — e o erro tinha
// consequência visível. Medido nesta pasta, Consolas 12px com `line-height` 1,25:
//
//   sonda (12 × 1,25)        → 15 px  →  28 linhas numa caixa de 420 px
//   xterm (altura real)      → 17 px  →  24 linhas na mesma caixa
//
// O xterm NÃO multiplica o corpo da fonte: ele mede a caixa real do glifo (14 px
// aqui, e não 12) e só então aplica o `lineHeight`. A conta ingênua dava quatro
// linhas a mais, e essas quatro linhas iam para o PTY: o programa lá dentro
// desenhava achando ter 28, e as últimas quatro caíam FORA da área visível. O
// sintoma era o Claude Code sem a caixa de digitar e sem a barra de status —
// exatamente as linhas que ele ancora no rodapé.
//
// ⚠️ E ISTO SOBREVIVE AO ZOOM DO CANVAS, que é a única razão de a sonda existir.
// Medido com um ancestral em `scale(0.4)`: `getBoundingClientRect()` devolveu
// 360 onde havia 900 (contaminado), enquanto `clientWidth` e o
// `dimensions.css.cell` do xterm devolveram os dois o valor de layout, intactos.

let trShCelula = null;

function trShSondarCelula() {
  if (trShCelula) return trShCelula;
  const s = document.createElement('span');
  s.style.cssText = 'position:absolute; visibility:hidden; white-space:pre;'
    + 'font-family:' + TR_SH_FONTE + '; font-size:' + TR_SH_CORPO + 'px;'
    + 'line-height:' + TR_SH_ALTURA;
  s.textContent = 'W'.repeat(100);
  // ⚠️ NO `body`, e não dentro do canvas: uma sonda pendurada no `.ofi-mundo`
  // seria medida já com o zoom aplicado, que é justamente o que se evita.
  document.body.appendChild(s);
  const r = s.getBoundingClientRect();
  trShCelula = { w: r.width / 100, h: r.height };
  s.remove();
  return trShCelula;
}

// ── A largura com que um terminal NASCE ─────────────────────────────────────
//
// ⚠️ 80 COLUNAS É A MEDIDA QUE TODO PROGRAMA DE TERMINAL ASSUME, e os 380px que
// estavam cravados no CSS não chegavam perto — davam umas 44. Abaixo de 80 a
// linha quebra no lugar errado, e foi o que o usuário sentiu como *"muito
// pequenininho, principalmente na horizontal"*.
//
// ⚠️ E O NÚMERO NÃO É CRAVADO: ele é DERIVADO da fonte real, pela mesma sonda
// que o dimensionamento já usa. Um `width: 700px` escrito à mão erraria em
// qualquer máquina cuja Consolas medisse diferente — e erraria em silêncio,
// que é o pior jeito de errar tamanho de terminal.
//
// ⚠️ O TAMANHO É SÓ CSS. O nó não guarda largura nem altura (`criar_no` grava
// `x`, `y` e mais onze campos, e nenhum deles é medida), então o lugar de
// mexer nisto é uma variável de CSS — não o backend. Quem esticar a pega do
// canto grava `largura`/`altura` no nó e passa a mandar mais que esta conta.
//
// A soma tem três parcelas além das colunas, e nenhuma é opcional:
//   · a CALHA da barra de rolagem — `.xterm-viewport` é `overflow-y: scroll`,
//     então o motor a reserva SEMPRE, mesmo sem histórico (é a mesma parcela
//     que `trShDimensionar` desconta na conta inversa);
//   · a moldura do host, `inset: 6px 4px 4px 8px` → 12px na horizontal;
//   · a borda de 1px de cada lado do cartão.
const TR_SH_COLUNAS_MINIMAS = 80;
const TR_SH_MOLDURA_H = 8 + 4 + 2;      // inset esquerdo + direito + as bordas

let trShCalha = null;

function trShMedirCalha() {
  if (trShCalha !== null) return trShCalha;
  const fora = document.createElement('div');
  fora.style.cssText = 'position:absolute; visibility:hidden; width:100px;'
    + 'height:100px; overflow-y:scroll;';
  document.body.appendChild(fora);
  trShCalha = fora.offsetWidth - fora.clientWidth;
  fora.remove();
  return trShCalha;
}

// Publica a largura como variável de CSS, que `.ofi-shell` consome com os
// 380px antigos de reserva. Memorizada: roda a cada redesenho e a conta não
// muda enquanto a fonte não mudar.
let trShLarguraPublicada = false;

function trShPublicarLarguraPadrao() {
  if (trShLarguraPublicada) return;
  try {
    const c = trShSondarCelula();
    if (!c || !c.w) return;
    const px = Math.ceil(TR_SH_COLUNAS_MINIMAS * c.w + trShMedirCalha() + TR_SH_MOLDURA_H);
    document.documentElement.style.setProperty('--ofi-shell-w', px + 'px');
    trShLarguraPublicada = true;
  } catch (e) { /* sem a sonda, o CSS fica com os 380px de reserva */ }
}

// A entranha `_core._renderService` é privada do xterm, e por isso vem dentro de
// um `try` com a sonda atrás: se um dia ela mudar de nome, o terminal volta a
// errar quatro linhas — que é ruim — em vez de parar de dimensionar — que é pior.
// A biblioteca está vendorizada e presa na 6.0.0, então isso só muda quando
// alguém trocar o arquivo de propósito.
function trShMedirCelula(term) {
  try {
    const c = term._core._renderService.dimensions.css.cell;
    if (c && c.width > 0 && c.height > 0) return { w: c.width, h: c.height };
  } catch (e) { /* sem a entranha: cai na sonda */ }
  return trShSondarCelula();
}

// ⚠️ O TETO NÃO É PARANOIA — é a cicatriz de um defeito real. Numa versão o nó
// não tinha altura definida: ela vinha do conteúdo, o conteúdo era o terminal, e
// esta função media essa altura para decidir quantas linhas o terminal teria.
// Cada redesenho pedia mais linhas que o próprio terminal acabara de criar, e o
// cartão crescia para baixo até travar o programa.
//
// A correção de verdade está no CSS (o host é `position: absolute`, e por isso
// não tem como empurrar o cartão). Este teto é o cinto de segurança: se algum
// dia o laço voltar por outro caminho, ele para num tamanho absurdo em vez de
// levar a interface junto.
const TR_SH_MAX_COLS = 500;
const TR_SH_MAX_ROWS = 200;

// ⚠️ ASSÍNCRONA, e quem precisa da ordem deve esperar por ela. Devolve depois
// de o BACKEND ter confirmado o tamanho — é o que permite abrir o processo e
// reidratar a tela sabendo que os dois lados já concordam sobre a largura.
async function trShDimensionar(id) {
  const t = trShTerms[id];
  if (!t || !t.host.isConnected || !t.host.clientWidth) return;   // destacado
  const c = trShMedirCelula(t.term);
  if (!c.w || !c.h) return;
  // ⚠️ A CALHA DA BARRA DE ROLAGEM SAI DA CONTA. `.xterm-viewport` é
  // `overflow-y: scroll` (não `auto`), então o motor reserva a calha SEMPRE,
  // mesmo sem histórico para rolar. Dividir a largura inteira punha uma ou duas
  // colunas de cada linha debaixo da barra — texto que "some" na borda direita.
  // O `FitAddon` oficial do xterm desconta isto pelo mesmo motivo.
  const vis = t.host.querySelector('.xterm-viewport');
  const calha = vis ? Math.max(0, vis.offsetWidth - vis.clientWidth) : 0;
  const util = Math.max(1, t.host.clientWidth - calha);
  const cols = Math.min(TR_SH_MAX_COLS, Math.max(2, Math.floor(util / c.w)));
  const rows = Math.min(TR_SH_MAX_ROWS, Math.max(1, Math.floor(t.host.clientHeight / c.h)));
  // ⚠️ A COMPARAÇÃO É COM O QUE O BACKEND SABE, e não com o que o xterm tem.
  // O xterm nasce 80x24 e o backend nasce 120x30: se a conta desse justo 80x24,
  // o antigo `cols === t.term.cols` cortava a chamada e o PTY ficava em 120
  // colunas para sempre. Como o ConPTY posiciona o cursor por COLUNA ABSOLUTA,
  // uma discordância de largura não quebra a linha no lugar errado — ela
  // escreve o texto na coluna errada, e a tela sai com buracos no meio.
  if (t.avisado && cols === t.avisado.cols && rows === t.avisado.rows) return;
  if (cols !== t.term.cols || rows !== t.term.rows) {
    // ⚠️ O CURSOR NÃO ACOMPANHA O REFLOW SOZINHO. Medido no xterm.js 6.0.0
    // desta pasta, com o prompt real de 111 caracteres: ao mudar de largura ele
    // reacomoda o TEXTO e a LINHA do cursor, mas mantém a COLUNA que o cursor
    // tinha na largura antiga. De 100 para 40 colunas, o texto vai certo para
    // três linhas e o cursor fica na coluna 11 de uma linha que tem 31 — no
    // meio de uma palavra, exatamente onde o usuário o via.
    //
    // O que se preserva é o DESLOCAMENTO dentro da linha lógica. Medindo antes
    // e recolocando depois, ele volta ao fim do texto em todas as larguras.
    const desloc = trShDeslocamentoDoCursor(t.term);
    t.term.resize(cols, rows);
    trShRecolocarCursor(t.term, desloc);
  }

  // ⚠️ `avisado` SÓ DEPOIS DA CONFIRMAÇÃO, e é uma correção de defeito real.
  // Ele era gravado ANTES da chamada, que ia sem `await` e sem `catch`. Num
  // arraste da pega são dezenas de chamadas por segundo na ponte; bastava UMA
  // falhar — ou a última chegar fora de ordem — para o backend ficar com a
  // largura antiga. E aí a guarda logo acima, que compara com `avisado`,
  // impedia qualquer nova tentativa com aquele mesmo tamanho: a divergência
  // congelava para sempre, e o sintoma era "redimensionei e bugou tudo".
  //
  // Deixando `avisado` intacto na falha, a próxima medida — do observador de
  // tamanho, do redesenho, do que for — tenta de novo sozinha.
  //
  // ⚠️ E A ÚLTIMA MEDIDA VENCE, mesmo que a resposta dela volte primeiro. O
  // observador de tamanho dispara por quadro: durante um arraste há várias
  // chamadas em voo ao mesmo tempo, e a ponte não promete a ordem de volta. Sem
  // o bilhete, uma resposta atrasada gravaria em `avisado` uma largura que o
  // backend já substituiu — e a guarda acima passaria a barrar a medida certa.
  const bilhete = (t.seq = (t.seq || 0) + 1);
  try {
    await window.pywebview.api.redimensionar_shell(currentProject, id, cols, rows);
    if (trShTerms[id] === t && t.seq === bilhete) t.avisado = { cols, rows };
  } catch (e) {
    console.warn('[oficina] o backend não confirmou o tamanho do terminal', id, e);
  }

  // ⚠️ NÃO SE REFAZ A TELA AO REDIMENSIONAR, e esta linha de comentário é o
  // resultado de duas tentativas erradas.
  //
  // A primeira reproduzia o log inteiro depois do arraste. Parecia certo: o
  // ConPTY, medido com um script à parte, NÃO manda um único byte quando o
  // tamanho muda — ele despeja a tela uma vez, no primeiro resize depois de
  // abrir, e nunca mais. Sem bytes novos, refazer do log era o único jeito de
  // recalcular a posição do cursor.
  //
  // O que essa conta esquecia é QUEM está rodando dentro. Um programa de tela
  // cheia (o assistente externo é um) repinta sozinho quando o pseudoterminal
  // muda de tamanho — é para isso que ele recebe o novo tamanho. Reproduzir o
  // log por cima desse repinte apagava o desenho que o programa acabara de
  // fazer, e o sintoma era texto sumindo conforme o cartão era esticado.
  //
  // Então: redimensiona o xterm, avisa o pseudoterminal, e para por aí. Quem
  // repinta é quem está rodando; num `cmd.exe` parado no prompt, o reflow do
  // próprio xterm dá conta de uma linha.
  //
  // A reidratação continua existindo — para trocar de sub-aba e para a
  // primeira montagem (`trShReidratar`), onde não há nada na tela para apagar.
}

// ⚠️ ABRIR O PROCESSO DEPOIS DE MEDIR A TELA, e esta é a correção do defeito
// mais caro que o terminal teve.
//
// `abrir_shell` sem tamanho faz o pseudoterminal nascer com o padrão do backend
// (120×30). O `cmd.exe` sobe e imprime o prompt NESSA GRADE — e só depois o
// cartão, de 380 px, mede as suas ~44 colunas. Como o ConPTY posiciona o cursor
// por COLUNA ABSOLUTA, um caminho de 108 caracteres calculado em 44 colunas cai
// na linha 3, coluna 21: era exatamente ali que o bloco do cursor aparecia, e
// exatamente ali que o que o usuário digitava era escrito — por cima do próprio
// caminho.
//
// Aqui a ordem é a inversa: o nó já foi desenhado, o xterm já mediu o cartão, o
// backend já sabe a largura, e só então o processo nasce. O prompt sai certo na
// primeira impressão, sem nada para corrigir depois.
//
// A espera é por QUADRO, e não por tempo: `clientWidth` só existe depois de o
// motor ter feito o layout do nó recém-inserido. O teto de tentativas existe
// para o caso de a sub-aba não estar visível — ali a largura é 0 para sempre, e
// insistir seria travar a criação do nó.
async function trShAbrirQuandoMedido(id, tentativas = 12) {
  const quadro = () => new Promise(r => requestAnimationFrame(r));
  for (let i = 0; i < tentativas; i++) {
    const t = trShTerms[id];
    if (t && t.host.isConnected && t.host.clientWidth) break;
    await quadro();
  }
  await trShDimensionar(id);
  const medido = (trShTerms[id] || {}).avisado || {};
  return window.pywebview.api.abrir_shell(
    currentProject, id, medido.cols || null, medido.rows || null);
}
