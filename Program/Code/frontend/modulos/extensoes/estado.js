// ═════════════════════════ EXTENSÕES DO PROGRAMA — ESTADO ══
// A última árvore lida do backend, e a função que a ADOTA.
//
// Mesmo papel de `pluginsArvore` para os plugins: um global só, populado por
// `config-xtprog.js` e lido por todo o resto. A diferença é que aqui adotar a
// árvore tem CONSEQUÊNCIA — ligar uma extensão precisa injetar o frontend
// dela, e desligar precisa remover o que ela pôs na tela, tudo sem reiniciar
// o programa (D13). `xtAdotarArvore` é o lugar onde isso acontece, e é por
// ele que TODA resposta do backend passa.
//
// ⚠️ O prefixo é `xt`, nunca `ext`: `_ext*` já é da tela de extensões de
// ARQUIVO (o punhado de globais de `config-extensoes.js` que começa por
// `_ext` seguido de maiúscula). O frontend não tem escopo de módulo, e um
// nome repetido sobrescreveria o antigo em silêncio — aquela tela pararia de
// funcionar sem erro nenhum.

const XT_ARVORE_VAZIA = { nome: '', caminho: '', pastas: [], extensoes: [] };

// Onde `External/extensions/` fica, visto de `Code/frontend/index.html`.
const XT_BASE_URL = '../../External/extensions';

// O estado do "Destacar extensões": se está ligado, com que cor e de que
// jeito, mais as listas de opções que o BACKEND oferece. As listas vêm de lá
// e não são copiadas para cá de propósito — duas listas do mesmo conjunto
// divergem no primeiro dia em que alguém acrescenta uma cor num lado só.
const XT_DESTAQUE_VAZIO = { destacar: false, cor: 'purple', tipo: 'tracejado',
                            cores: [], tipos: [] };

let xtArvore = XT_ARVORE_VAZIA;
let xtDestaque = XT_DESTAQUE_VAZIO;
// O catálogo dos LUGARES do recurso Tela (fase 11) — a barra, as classes e o
// atributo de cada aba que aceita tela de extensão. Vem do backend
// (`encaixes.XT_LUGARES_DE_TELA`) pela mesma razão das cores do destaque, e é
// lido por `extensoes/telas.js`.
let xtLugaresDeTela = [];
// As telas de configuração das extensões ligadas, como o backend as devolve.
let xtTelas = [];

/**
 * Codifica um caminho relativo com `/` de verdade, segmento a segmento.
 *
 * ⚠️ `encodeURIComponent` por segmento, e não `encodeURI` no caminho inteiro.
 * `encodeURI` deixa passar `#` e `?`, que num endereço significam outra coisa
 * e cortariam o caminho ao meio — o backend já escapava os dois
 * (`dados.py::_base_url`, com `quote(…, safe='/')`), e o frontend não: uma
 * extensão chamada "Diff #2" carregava os dados e não carregava o código.
 * O que continua sobrevivendo é a barra, que aqui é separador de verdade.
 */
function xtCodificarCaminho(caminho) {
  return String(caminho || '').split('/').map(encodeURIComponent).join('/');
}

/** A URL da pasta de uma extensão, para injetar script, CSS ou SVG dela. */
function xtBaseUrl(caminho) {
  return `${XT_BASE_URL}/${xtCodificarCaminho(caminho)}`;
}

/**
 * Toda extensão da árvore, em qualquer profundidade, achatada — NA ORDEM DA
 * LISTA de Programa › Extensões (D42 "Ordem"): em cada nível, as subpastas
 * antes das extensões soltas, como `config-xtprog.js::_xtCorpoHtml` desenha.
 * É a ordem de carga, e a ordem em que telas, painéis, comandos e reações de
 * várias extensões aparecem e rodam. O backend confere conflito na mesma
 * ordem (`descoberta.folhas_na_ordem_da_lista`).
 */
function xtTodasAsFolhas(no) {
  const dasFilhas = ((no && no.pastas) || []).flatMap(xtTodasAsFolhas);
  const proprias = (no && no.extensoes) || [];
  return [...dasFilhas, ...proprias];
}

function xtAcharFolha(caminho) {
  return xtTodasAsFolhas(xtArvore).find(e => e.caminho === caminho) || null;
}

/** As extensões ligadas — a lista que decide o que precisa estar montado. */
function xtLigadas() {
  return xtTodasAsFolhas(xtArvore).filter(e => e.ligado);
}

/**
 * A posição de uma extensão na lista (entre as ligadas). Os registros de
 * encaixe, evento e consulta são `Map`s em ordem de INSERÇÃO — uma extensão
 * religada iria para o fim; quem percorre um registro ordena por isto. Slug
 * que não está mais na lista vai para o fim, sem sumir.
 */
// eslint-disable-next-line no-unused-vars
function xtPosicaoNaLista(slug) {
  const i = xtLigadas().findIndex(e => e.slug === slug);
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
}

/**
 * Adota uma resposta do backend e põe a tela em dia com ela.
 *
 * ⚠️ **A ordem aqui é o desligar de trás para frente.** Descarregar vem
 * ANTES de carregar: uma extensão que acabou de ser desligada precisa ter
 * tirado o `<style>`, o `<script>` e a categoria dela antes de a próxima
 * mexer no DOM. Na ordem inversa, ligar e desligar duas extensões na mesma
 * resposta deixaria a segunda desenhando em cima do que a primeira ainda não
 * tinha limpado.
 *
 * Nenhum passo pode derrubar o seguinte: uma extensão quebrada não impede a
 * lista de pintar nem a próxima de ligar — mesma regra de
 * `_iniciar_plugins_ativos`. ⚠️ E cada passo está no próprio `try`, porque
 * a promessa acima não se cumpria sozinha: `xtSincronizarCarga` termina
 * repintando o Quadro, e um Quadro que lançasse deixava os dados, as telas e
 * a lista sem pintar — com a tela dizendo "não foi possível gravar" para uma
 * gravação que já tinha acontecido.
 *
 * Os `avisos` do backend (uma extensão que não parou em 5 s, um manifesto
 * que quebrou com o programa aberto) vão para a tela em `showToast`, e não só
 * para o console: quem desliga uma extensão e ela não para precisa saber
 * disso sem abrir o DevTools.
 */
async function xtAdotarArvore(resposta) {
  if (!resposta || !resposta.success) {
    if (resposta && resposta.error) console.error('[extensoes]', resposta.error);
    return false;
  }
  xtArvore = resposta.arvore || XT_ARVORE_VAZIA;
  xtDestaque = resposta.destaque || XT_DESTAQUE_VAZIO;
  if (Array.isArray(resposta.lugares_de_tela)) xtLugaresDeTela = resposta.lugares_de_tela;
  (resposta.avisos || []).forEach(a => {
    console.warn('[extensoes]', a);
    if (typeof showToast === 'function') showToast(`Extensões: ${a}`, true);
  });

  // ⚠️ AS TELAS VÊM ANTES DA CARGA. `xtSincronizarTelas` é o que põe em
  // `xtTelas` as preferências resolvidas de cada extensão ligada — e é de lá
  // que `xtPreferenciasDe(slug)` responde, de forma síncrona, dentro do
  // `xtMontar` e dos ganchos. Com as telas depois da carga, a primeira
  // pintura de uma decoradora recém-ligada saía com os padrões de fábrica e
  // só a segunda via o que o usuário escolheu. Registrar a categoria antes de
  // o `index.js` entrar não muda nada para ela: são peças independentes.
  const passos = [
    ['aplicar o destaque', () => xtAplicarDestaque()],
    ['sincronizar as telas', () => xtSincronizarTelas()],
    ['sincronizar a carga', () => xtSincronizarCarga()],
    // Os comandos de uma extensão entram no registro de teclas na carga dela
    // — depois de a página ter sido registrada. A grade da página repinta
    // aqui, senão nascia vazia e só enchia na próxima adoção.
    ['repintar os comandos das páginas', () => {
      if (typeof xtRepintarComandosDasTelas === 'function') xtRepintarComandosDasTelas();
    }],
    ['sincronizar os dados', () => xtSincronizarDados()],
    // Os subagentes de extensão nas sub-abas Subagentes do Chat e da Fila.
    ['sincronizar os subagentes', () => {
      if (typeof subagentesDeExtensoesSincronizar === 'function') subagentesDeExtensoesSincronizar();
    }],
    ['pintar a lista', () => { if (typeof _xtPintarLista === 'function') _xtPintarLista(); }],
  ];
  for (const [nome, passo] of passos) {
    try {
      await passo();
    } catch (e) {
      console.error(`[extensoes] falha ao ${nome}:`, e);
    }
  }
  return true;
}
