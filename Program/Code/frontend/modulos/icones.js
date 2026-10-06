// ══════════════════════════════════════════════════════════════════ ÍCONES ══
// Único lugar do projeto que sabe transformar um nome de arquivo ou de pasta no
// caminho de um SVG. Quem desenha lista (`arvore-pastas.js`, `contexto.js`,
// `remover.js`) chama daqui e não monta caminho por conta própria.
//
// ⚠️ O PROGRAMA NÃO TEM MAIS PACOTE DE ÍCONES PRÓPRIO. Até 04/09/2026 o
// Material Icon Theme morava em `Code/assets/icons/`; ele foi movido para a
// extensão **Ícones de arquivo** (`External/extensions/`, tipo 24), e o que o
// programa faz hoje é só consumir o pacote que a extensão ligada entregou.
// Sem extensão de ícones, o programa mostra emoji.
//
// ⚠️ ESTE ARQUIVO É O DONO DA ESCOLHA DO PACOTE desde a fase 13 (23/09/2026).
// A categoria "Ícones de arquivos e pastas" saiu de Configurações › Programa
// (`config-icones*.js` foram apagados) e a escolha passou a ser o campo
// "Pacote em uso" da página da extensão Ícones de arquivo (D10), gravado em
// `config/preferencias.json` DENTRO da pasta dela (P6). A caixa "Usar ícones
// coloridos" sumiu: "Nenhum (emoji)" é o jeito de voltar ao emoji sem
// desligar a extensão. Ver `_iconesPacoteEscolhido`, logo abaixo, para a
// reserva de quem nunca gravou na página (D20).
//
// Um pacote é uma pasta com `mapa.json` e duas subpastas, `arquivos/` e
// `pastas/`, com os SVGs.
//
// Três coisas aqui não são escolha de estilo, e mexer nelas quebra a tela:
//
// 1. O `mapa.json` NÃO é lido por `fetch()`. O programa roda por `file://`, e
//    ali a origem é opaca: a chamada é bloqueada pelo navegador. Quem lê é o
//    backend da camada de extensões, e o mapa chega junto com a lista de
//    extensões ligadas (`carregarExtensoesDoPrograma`, no `init()`).
// 2. O SVG entra por `<img src>`, e por isso o CSS não alcança o interior dele
//    — nada de `fill` ou `filter`. Os ícones já são coloridos por dentro, e é
//    assim que foi decidido.
// 3. Todo ícone tem `onerror` voltando ao emoji. É a rede contra uma linha
//    errada no `mapa.json`: ícone que falta vira emoji, nunca imagem quebrada.

// ⚠️ A pasta ATUAL dos SVGs. `null` significa "nenhum pacote ligado", e aí
// `iconePara` nem chega a montar caminho — o mapa também é `null`.
//
// Um `let` e não um `const` porque escolher um pacote no "Pacote em uso"
// troca DUAS coisas ao mesmo tempo: o mapa (o global `mapaIcones`) e a
// pasta de onde os desenhos saem (esta variável). A troca acontece num lugar
// só, `xtAplicarIconesEscolhidos`, mais abaixo. A estrutura dentro da
// pasta é sempre a mesma, o que mantém `iconePara` sem saber de onde o pacote
// veio.
let iconesBase = null;

// ── A escolha do pacote ─────────────────────────────────────────────────

// O aviso de quando o pacote gravado não está entre os ligados.
const ICONES_AVISO_SUMIU = 'O pacote escolhido veio de uma extensão que não está ligada — '
  + 'o programa está usando os emojis.';

/** A pasta que contém o `mapa.json` de um pacote — é lá que `arquivos/` e
 *  `pastas/` moram. */
function _iconesPastaDoPacote(dado) {
  const barra = dado.url.lastIndexOf('/');
  return barra > 0 ? dado.url.slice(0, barra) : dado.base_url;
}

/** A reserva do D20: o que o usuário escolheu na categoria antiga, que
 *  continua em `appSettings` (`icones-de-arquivos-e-pastas.json`). Quem tinha
 *  desmarcado "Usar ícones coloridos" continua vendo emoji. */
function _iconesPacoteReserva() {
  if (appSettings.icones_customizados === false) return '';
  return appSettings.pacote_de_icones || '';
}

/**
 * O pacote em uso: o caminho relativo da extensão, ou `''` (Nenhum — emoji).
 *
 * 1. o que o usuário GRAVOU na página da extensão que declara o campo com
 *    `opcoes_de: 'visual.icones'` — lido do gravado CRU
 *    (`preferencias_gravadas`), porque o resolvido já tem o `padrao` por cima
 *    e esconderia a diferença entre "nunca escolheu" e "escolheu Nenhum";
 * 2. a reserva, quando não há nada gravado — ou quando o gravado é `null`,
 *    que é o que "Restaurar padrão" grava (`padrao: null` no `tela.json`):
 *    `null` gravado vale o mesmo que nunca ter escolhido.
 *
 * A extensão é achada pelo campo, NUNCA por slug fixo: o slug muda quando ela
 * é arrastada para uma categoria.
 */
function _iconesPacoteEscolhido() {
  const achado = (typeof xtCampoComOpcoesDe === 'function') ? xtCampoComOpcoesDe('visual.icones') : null;
  const gravado = achado && achado.tela.preferencias_gravadas;
  if (gravado && gravado[achado.chave] != null) return String(gravado[achado.chave]);
  return _iconesPacoteReserva();
}

/**
 * Aplica o pacote escolhido, se a extensão dele estiver ligada.
 *
 * Chamada de `xtSincronizarDados`, ou seja, a cada ligar/desligar (desligar a
 * extensão do pacote em uso devolve os emojis na hora), e do "Salvar" da
 * página de qualquer extensão (`tela.js::_xtGravarPreferencias`). As listas
 * já na tela trocam de ícone no lugar (`repintarIconesNaTela`).
 */
function xtAplicarIconesEscolhidos() {
  const escolhido = _iconesPacoteEscolhido();
  const dado = (escolhido && typeof xtDadoEscolhido === 'function')
    ? xtDadoEscolhido('24', escolhido) : null;

  if (dado && dado.dados) {
    mapaIcones = dado.dados;
    iconesBase = _iconesPastaDoPacote(dado);
  } else {
    // Sem pacote escolhido, ou com a extensão dele desligada/apagada: emoji.
    // `iconePara` devolve `null` com o mapa vazio, e quem desenha a linha cai
    // no emoji de reserva que já passava como argumento.
    mapaIcones = null;
    iconesBase = null;
  }
  repintarIconesNaTela();
}

/** Os pacotes disponíveis: "nenhum" primeiro, depois um por extensão ligada. */
function _iconesPacotes() {
  const deExtensao = (typeof xtDadosDoTipo === 'function') ? xtDadosDoTipo('24') : [];
  return [
    // ⚠️ "Nenhum" NÃO é um pacote de emojis: é a ausência de pacote. O emoji é
    // o que `iconePara` devolve quando não há mapa, e sempre foi.
    { valor: '', rotulo: 'Nenhum (emoji)' },
    ...deExtensao.map(d => ({ valor: d.caminho, rotulo: d.nome })),
  ];
}

/**
 * As opções do campo `opcoes_de: 'visual.icones'` (`extensoes/tela-opcoes.js`):
 * `{opcoes, selecionado, aviso}`. `selecionado` é o valor EFETIVO — com nada
 * gravado, a reserva —, casado com a opção pelo caminho ou pelo nome da pasta
 * (`xtDadoEscolhido`), senão a página diria "Ícones de arquivo" enquanto o
 * programa mostra emoji.
 */
// eslint-disable-next-line no-unused-vars
function iconesOpcoesDoCampo(valor) {
  const efetivo = (valor == null) ? _iconesPacoteReserva() : String(valor);
  const dado = (efetivo && typeof xtDadoEscolhido === 'function')
    ? xtDadoEscolhido('24', efetivo) : null;
  return {
    opcoes: _iconesPacotes(),
    selecionado: dado ? dado.caminho : '',
    aviso: (efetivo && !dado) ? ICONES_AVISO_SUMIU : '',
  };
}

// ── O desenho ───────────────────────────────────────────────────────────

/** Devolve o caminho do SVG, ou `null` quando a lista deve usar o emoji.
 *  `null` sai em dois casos: não há pacote de ícones em uso (Nenhum, ou a
 *  extensão dele desligada), ou o mapa do pacote está torto. Nos dois, quem
 *  chama volta ao emoji de sempre. */
function iconePara(nome, ehPasta) {
  const mapa = (typeof mapaIcones === 'object' && mapaIcones) || null;
  if (!mapa || !mapa.padrao || !iconesBase) return null;

  const limpo = String(nome || '').trim();
  let tabela, padrao, subpasta, chave;

  if (ehPasta) {
    // Pasta: a chave é o nome inteiro. Não há regra de nome composto.
    tabela = mapa.pastas || {};
    padrao = mapa.padrao.pasta;
    subpasta = 'pastas';
    chave = limpo.toLowerCase();
  } else {
    // Arquivo: a chave é só o que vem depois do ÚLTIMO ponto. Extensão
    // composta não existe aqui — `algo.test.js` usa o ícone de `.js`.
    tabela = mapa.extensoes || {};
    padrao = mapa.padrao.arquivo;
    subpasta = 'arquivos';
    // Ponto na primeira posição é `.gitignore`: nome oculto, não extensão.
    const ponto = limpo.lastIndexOf('.');
    chave = ponto > 0 ? limpo.slice(ponto + 1).toLowerCase() : '';
  }

  const alvo = tabela[chave] || padrao;
  if (!alvo) return null;
  return `${iconesBase}/${subpasta}/${encodeURIComponent(alvo)}.svg`;
}

/** Pinta o ícone dentro de um `<span>` já existente. Para quem monta a linha
 *  com `createElement` — a maioria dos casos. */
function pintarIcone(span, nome, ehPasta, emojiReserva) {
  if (!span) return;
  // A marca de DE QUE NOME é este ícone — é por ela que `repintarIconesNaTela`
  // acha e repinta o span depois, sem redesenhar a lista.
  span.dataset.iconeNome = nome ?? '';
  span.dataset.iconePasta = ehPasta ? '1' : '';
  span.dataset.iconeEmoji = emojiReserva;
  const caminho = iconePara(nome, ehPasta);
  if (!caminho) {
    span.textContent = emojiReserva;
    return;
  }
  span.textContent = '';
  const img = document.createElement('img');
  img.className = 'icone-svg';
  img.alt = '';
  // O `onerror` precisa estar registrado ANTES do `src`: com o arquivo em
  // cache o erro dispara na hora, e um listener posto depois já perdeu o evento.
  img.onerror = () => { span.textContent = emojiReserva; };
  img.src = caminho;
  span.appendChild(img);
}

/** A mesma coisa, devolvendo texto HTML em vez de elemento. Só para os dois
 *  pontos que montam a linha inteira por `innerHTML` (`contexto.js` e
 *  `remover.js`), onde não há elemento para receber `pintarIcone`.
 *  Aqui o `onerror` vai inline no atributo — fora dele o fallback se perderia.
 *
 *  Sai embrulhado num `span.icone-slot` com a mesma marca de `pintarIcone`,
 *  para `repintarIconesNaTela` também achar estes. O `onerror` troca só o
 *  `<img>`: o emoji fica dentro do slot, e o slot continua achável. */
function iconeHTML(nome, ehPasta, emojiReserva) {
  const caminho = iconePara(nome, ehPasta);
  const miolo = caminho
    ? `<img class="icone-svg" alt="" src="${escapeHtml(caminho)}"`
      + ` data-emoji="${escapeHtml(emojiReserva)}"`
      + ` onerror="this.outerHTML=this.dataset.emoji">`
    : emojiReserva;
  return `<span class="icone-slot" data-icone-nome="${escapeHtml(nome ?? '')}"`
       + ` data-icone-pasta="${ehPasta ? '1' : ''}"`
       + ` data-icone-emoji="${escapeHtml(emojiReserva)}">${miolo}</span>`;
}

/** Repinta, no lugar, todo ícone que está na tela — sem redesenhar as
 *  listas, então rolagem e pastas abertas ficam como estão. Chamada por
 *  `xtAplicarIconesEscolhidos`, o ponto único que troca o pacote — é o que
 *  faz o "Salvar" do "Pacote em uso" valer na hora, sem "troque de aba". */
function repintarIconesNaTela() {
  document.querySelectorAll('[data-icone-nome]').forEach(el =>
    pintarIcone(el, el.dataset.iconeNome, el.dataset.iconePasta === '1', el.dataset.iconeEmoji));
}
