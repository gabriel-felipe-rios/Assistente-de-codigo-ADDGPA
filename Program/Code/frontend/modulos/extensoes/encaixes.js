// ═════════════════════════ EXTENSÕES DO PROGRAMA — M2 E M3, OS ENCAIXES ══
// M1 deu à extensão um lugar SÓ DELA. M2 e M3 são o contrário: ela entra num
// lugar que já existe — desenha no painel do Terminal, acrescenta um item ao
// menu de contexto do Editor, põe um botão no cartão do Quadro.
//
// Do lado da tela, cada ponto é UMA linha de código onde a tela já está
// desenhando:
//
//     xtEncaixe('terminal.painel', container, contexto);        // M2, desenha
//     itens.push(...xtEncaixeItens('editor.menu', contexto));   // M3, comanda
//
// ⚠️ **As duas funções são seguras de chamar sem extensão nenhuma ligada** —
// a primeira não faz nada, a segunda devolve `[]`. É o que permite espalhar
// os pontos pelas telas sem que cada uma precise checar se a camada existe.
//
// ⚠️ **NENHUM ponto entrega o DOM do programa à extensão.** No ponto 'painel',
// o programa cria um `<div>` PRÓPRIO dela dentro do container e entrega esse
// div. Duas razões, e as duas são de manutenção, não de segurança (D18: não
// há sandbox):
//   - **desligar tem o que remover.** O div leva `data-xt="{slug}"`, e é por
//     ele que `descarregar.js` acha o que apagar. Sem o div, o que a extensão
//     desenhou ficaria misturado ao que o programa desenhou, e "desligar"
//     não teria como significar nada.
//   - **o destaque tem onde pegar.** O div leva `data-origem="extensao"`, e
//     é o seletor único de `extensoes-do-programa.css` que o pinta.
//
// ⚠️ **No ponto 'itens' NÃO HÁ `<div>` para marcar**, e é por isso que o item
// sai daqui carimbado com `_xtDe` (o slug de quem o mandou): quem desenha é
// `menu-contexto.js`, e é lá que o `data-origem="extensao"` acaba entrando. Sem
// esse carimbo, o "Destacar extensões" não acendia nada de uma extensão que só
// acrescenta item de menu — que é o caso da maioria delas.
//
// ⚠️ Menu de contexto é ponto 'itens', e nunca 'painel'. Se fosse 'painel', a
// primeira extensão a entrar nele desenharia o menu dela inteiro, com outra
// medida e outra cor — e `menu-contexto.js`, que é componente compartilhado
// justamente para não haver um segundo menu no programa, teria deixado de
// valer para alguma coisa. Em 'itens' a extensão ESTENDE a lista; quem
// desenha continua sendo o componente.

// `{ponto: Map<slug, {fn, caminho, nome}>}` — quem está encaixado onde,
// agora. ⚠️ A ordem de DESENHO não é a de inserção (a de ligar): quem percorre
// passa por `_xtEncaixesNaOrdem`, e duas extensões no mesmo menu aparecem na
// ordem de Programa › Extensões (D42).
const _xtEncaixes = new Map();

// `{slug: [ponto]}` — o índice inverso, que é o que `xtDesregistrarEncaixes`
// precisa. Sem ele, desligar uma extensão obrigaria a varrer todos os pontos.
const _xtEncaixesPorSlug = new Map();

/**
 * O arquivo de encaixe da extensão chama isto, uma vez, quando carrega.
 *
 * Ele não escreve o `slug` nem o `ponto` à mão — os dois vêm do
 * `document.currentScript.dataset`, que o programa preencheu ao injetar a
 * tag. O caminho da extensão muda quando o usuário a move para dentro de uma
 * categoria, e o slug leva um resumo do caminho inteiro.
 */
// eslint-disable-next-line no-unused-vars
function xtRegistrarEncaixe(slug, ponto, fn) {
  if (typeof fn !== 'function') {
    console.error(`[extensoes] o encaixe "${ponto}" de ${slug} não passou uma função.`);
    return;
  }
  if (!_xtEncaixes.has(ponto)) _xtEncaixes.set(ponto, new Map());
  _xtEncaixes.get(ponto).set(slug, fn);

  if (!_xtEncaixesPorSlug.has(slug)) _xtEncaixesPorSlug.set(slug, new Set());
  _xtEncaixesPorSlug.get(slug).add(ponto);
}

/**
 * Tira do registro TODOS os encaixes de uma extensão, e apaga da tela o que
 * ela já tinha desenhado nos pontos 'painel'.
 *
 * Chamada por `descarregar.js`, que a procura por `typeof` — a ordem já
 * estava escrita lá desde a Obra 1, à espera deste arquivo.
 *
 * ⚠️ Tirar do registro não basta: um `<div data-xt>` já desenhado continuaria
 * na tela até a próxima vez que aquele ponto fosse repintado — e o painel do
 * Terminal só repinta quando a aba reabre. O usuário desligaria a extensão e
 * continuaria vendo o painel dela, o que é exatamente a promessa que D13
 * fez ao contrário.
 */
// eslint-disable-next-line no-unused-vars
function xtDesregistrarEncaixes(slug) {
  const pontos = _xtEncaixesPorSlug.get(slug);
  if (pontos) {
    for (const ponto of pontos) {
      const noPonto = _xtEncaixes.get(ponto);
      if (noPonto) noPonto.delete(slug);
    }
    _xtEncaixesPorSlug.delete(slug);
  }
  document.querySelectorAll(`[data-xt-encaixe][data-xt="${slug}"]`)
          .forEach(el => el.remove());
}

/**
 * Quem está encaixado num ponto, agora, como `[[slug, fn], …]` na ordem da
 * lista. `[]` quando não há ninguém — e é essa a saída barata de quem chama
 * a cada pintura.
 *
 * ⚠️ Existe para o DESENHADOR do `editor.decorador` (`extensoes/decorador.js`),
 * que precisa chamar uma extensão de cada vez: `xtEncaixeItens` soma as listas
 * e perde de qual slug veio cada item, e ali o slug é justamente o que vai no
 * `data-xt` de cada marca — sem ele, desligar uma extensão não teria como
 * saber quais `<span>` desembrulhar. Ninguém mais precisa disto: quem quer a
 * lista somada usa `xtEncaixeItens`, que já protege cada extensão com
 * `try/catch`.
 */
// eslint-disable-next-line no-unused-vars
function xtEncaixadosNoPonto(ponto) {
  const noPonto = _xtEncaixes.get(ponto);
  return noPonto ? _xtEncaixesNaOrdem(noPonto) : [];
}

/**
 * As entradas de um registro (`Map<slug, …>`) NA ORDEM DA LISTA de Programa ›
 * Extensões, e não na ordem em que ligaram (D42 "Ordem") — uma extensão
 * religada iria para o fim do `Map`.
 *
 * ⚠️ Nome próprio deste arquivo: o frontend não tem escopo de módulo, e um
 * helper de mesmo nome em `eventos.js` ou `consulta.js` sobrescreveria este em silêncio (ver o aviso
 * de `_xtComTetoGuardia` em `eventos.js`).
 */
function _xtEncaixesNaOrdem(mapa) {
  const entradas = [...mapa];
  if (entradas.length < 2 || typeof xtLigadas !== 'function') return entradas;
  const posicao = new Map(xtLigadas().map((e, i) => [e.slug, i]));
  const de = (slug) => (posicao.has(slug) ? posicao.get(slug) : Number.MAX_SAFE_INTEGER);
  return entradas.sort((a, b) => de(a[0]) - de(b[0]));
}


// ── M2 · A extensão DESENHA num ponto ───────────────────────────────────

function _xtCaixaDoEncaixe(container, ponto, slug) {
  // Uma caixa por (ponto, extensão), reaproveitada entre repinturas do mesmo
  // container. Recriá-la a cada chamada faria o que a extensão desenhou
  // piscar, e perderia o estado interno dela (um campo meio preenchido, uma
  // seção aberta) toda vez que a tela ao redor se atualizasse.
  const existente = container.querySelector(
    `:scope > [data-xt-encaixe="${ponto}"][data-xt="${slug}"]`);
  if (existente) return existente;

  const caixa = document.createElement('div');
  caixa.className = 'xt-encaixe';
  caixa.dataset.xtEncaixe = ponto;
  caixa.dataset.xt = slug;
  // Quem põe a marca de origem é o PROGRAMA, nunca a extensão — senão a
  // extensão que esquecesse de pô-la ficaria invisível ao "Destacar
  // extensões", e o destaque deixaria de responder à pergunta que existe para
  // responder ("o que aqui não é do programa?").
  caixa.dataset.origem = 'extensao';
  container.appendChild(caixa);
  return caixa;
}

/**
 * Chama todas as extensões encaixadas num ponto de desenho.
 *
 * `container` é o elemento do PROGRAMA que abriga o ponto; cada extensão
 * recebe um `<div>` próprio dentro dele, nunca o container.
 *
 * Não devolve nada, não espera nada e nunca lança: uma extensão que explode
 * ao desenhar não pode impedir a tela do programa de terminar de pintar, nem
 * a próxima extensão de desenhar. Mesma regra de `_iniciar_plugins_ativos`.
 */
// eslint-disable-next-line no-unused-vars
function xtEncaixe(ponto, container, contexto) {
  const noPonto = _xtEncaixes.get(ponto);
  if (!noPonto || !noPonto.size || !container) return;

  for (const [slug, fn] of _xtEncaixesNaOrdem(noPonto)) {
    try {
      fn(_xtCaixaDoEncaixe(container, ponto, slug), contexto);
    } catch (e) {
      console.error(`[extensoes] o encaixe "${ponto}" de ${slug} falhou:`, e);
    }
  }
}

// ── M3 · A extensão COMANDA num ponto ───────────────────────────────────

/**
 * Pergunta a cada extensão encaixada num ponto de ação que itens ela quer
 * acrescentar, e devolve a lista somada. `[]` quando não há nenhuma — é o
 * caso normal, e por isso o `...` de quem chama é sempre seguro.
 *
 * Cada item tem a forma que `menu-contexto.js` já entende: `{rotulo, icone,
 * atalho, perigo, ativo, motivo, fazer}`. O programa não inventa forma nova —
 * a extensão entra na mesma lista dos itens nativos, e é isso que faz o menu
 * dela ter exatamente a cara do resto.
 *
 * ⚠️ **O item sai daqui com `_xtDe` — o slug de quem o mandou.** É o que o
 * "Destacar extensões" precisa para pintar um ITEM DE MENU: no ponto 'painel'
 * o destaque pega no `<div>` que o programa criou, mas em 'itens' não há
 * `<div>` nenhum — a extensão devolve dados, e quem desenha é o componente.
 * Sem esta marca, ligar o destaque não acendia nada de uma extensão que só
 * acrescenta item de menu, que é o caso da maioria delas.
 *
 * Vai numa CÓPIA do item, e não no objeto que a extensão devolveu: ela pode
 * estar reaproveitando o mesmo objeto entre chamadas, e sujá-lo seria mexer no
 * estado dela.
 *
 * ⚠️ Uma extensão que devolve lixo é IGNORADA em silêncio no item, mas o
 * erro vai ao console com o nome dela. O que não pode acontecer é o menu de
 * contexto do programa não abrir porque uma extensão devolveu `undefined`.
 */
// eslint-disable-next-line no-unused-vars
function xtEncaixeItens(ponto, contexto) {
  const noPonto = _xtEncaixes.get(ponto);
  if (!noPonto || !noPonto.size) return [];

  const somados = [];
  for (const [slug, fn] of _xtEncaixesNaOrdem(noPonto)) {
    let itens;
    try {
      itens = fn(contexto);
    } catch (e) {
      console.error(`[extensoes] o encaixe "${ponto}" de ${slug} falhou:`, e);
      continue;
    }
    if (!Array.isArray(itens)) {
      if (itens !== undefined && itens !== null) {
        console.error(`[extensoes] o encaixe "${ponto}" de ${slug} devolveu `
                      + `${typeof itens} em vez de uma lista de itens.`);
      }
      continue;
    }
    for (const item of itens) {
      if (!item || typeof item !== 'object') {
        console.error(`[extensoes] "${ponto}" de ${slug}: item que não é objeto, ignorado.`);
        continue;
      }
      // `{separador: true}` e `{grupo: 'Título'}` são as duas linhas sem
      // `rotulo` que `menu-contexto.js` entende. Uma extensão com seis itens
      // precisa poder separá-los como o menu nativo separa os dele.
      if (item.separador || typeof item.grupo === 'string') {
        somados.push({ ...item, _xtDe: slug });
        continue;
      }
      if (item.rotulo) somados.push({ ...item, _xtDe: slug });
      else console.error(`[extensoes] "${ponto}" de ${slug}: item sem \`rotulo\`, ignorado.`);
    }
  }
  return somados;
}

// ── A carga dos arquivos de encaixe ─────────────────────────────────────

/**
 * Injeta os arquivos que o manifesto declarou em `encaixes`, um `<script>`
 * por encaixe, depois de o `xtMontar` da extensão ter rodado.
 *
 * ⚠️ **Depois do `xtMontar`, e não antes.** O arquivo de encaixe pode
 * depender do que o `index.js` preparou — o estado em memória, o `<style>`
 * injetado. Carregá-lo antes seria uma ordem que o contrato não promete.
 *
 * O `ponto` vai no `dataset` da tag — é o que faz o arquivo do encaixe não
 * precisar repetir, dentro dele, o nome que já está no manifesto. O injetor
 * é o de `carga.js`, o mesmo dos eventos e das consultas.
 */
// eslint-disable-next-line no-unused-vars
async function xtCarregarEncaixes(folha) {
  for (const encaixe of (folha.encaixes || [])) {
    await xtInjetarArquivoDaExtensao(folha, encaixe.arquivo, { ponto: encaixe.ponto }, 'o encaixe');
  }
}

/**
 * Repinta os pontos 'painel' que estão montados na tela.
 *
 * ⚠️ Só os 'painel'. Os pontos 'itens' não têm o que repintar — eles são
 * consultados no instante em que o menu abre, e o próximo clique direito já
 * traz a extensão nova.
 */
// eslint-disable-next-line no-unused-vars
function xtRepintarPontosAbertos() {
  if (typeof xtPintarEncaixeDoTerminal === 'function') xtPintarEncaixeDoTerminal();
  if (typeof trPintarQuadro === 'function' && document.getElementById('tr-board')) {
    trPintarQuadro();
  }
  // O `editor.decorador` não é 'painel', mas repinta pelo mesmo motivo: ligar
  // uma decoradora com o arquivo já aberto tem de decorar AGORA, sem o usuário
  // trocar de aba para forçar uma pintura. É a mesma promessa que a linha
  // acima cumpre para o painel do Terminal.
  if (typeof xtPedirDecoracao === 'function') xtPedirDecoracao();
  // Os painéis da fase 11. O Quadro (`quadro.painel`) já entrou acima, junto
  // com `trPintarQuadro`. Cada um só se o template dele já está no DOM — as
  // funções de pintar são seguras sem ele, mas não há por que chamá-las.
  // O Editor zera a memória do "último arquivo pintado" antes, senão o
  // `editor.painel` de quem acabou de ligar só apareceria ao trocar de arquivo.
  if (typeof _edRepintarEncaixes === 'function') _edRepintarEncaixes();
  if (typeof xtPintarEncaixeDoChat === 'function' && document.getElementById('chat-encaixe')) {
    xtPintarEncaixeDoChat();
  }
  if (typeof xtPintarEncaixeDaFila === 'function' && document.getElementById('fila-encaixe')) {
    xtPintarEncaixeDaFila();
  }
  if (typeof xtPintarEncaixeDaOficina === 'function' && document.getElementById('ofi-encaixe')) {
    xtPintarEncaixeDaOficina();
  }
  // O recurso Tela: cria o botão que ficou pendente (barra que ainda não
  // existia) e redesenha a tela visível.
  if (typeof xtRepintarTelasAbertas === 'function') xtRepintarTelasAbertas();
}
