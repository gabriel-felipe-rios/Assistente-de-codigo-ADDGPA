// ═════════════════════════ EXTENSÕES DO PROGRAMA — O RECURSO TELA ══
// Uma extensão ganha uma tela SÓ DELA num lugar do programa: uma aba nova na
// barra de dentro do projeto (`aba.nova`), ou uma sub-aba numa aba que já tem
// sub-abas (`projeto.subaba`, `trabalhos.subaba`… e `configuracoes.subaba`, o
// lado Extensões de Configurações). O LUGAR é detalhe do recurso (D38).
//
// O programa cria o BOTÃO e um PAINEL VAZIO; o que vai dentro do painel é da
// extensão (P1). Os dados de cada lugar — em que barra o botão entra, com que
// classe e que atributo, onde os painéis moram — vêm do backend
// (`encaixes.XT_LUGARES_DE_TELA`, recebido em `xtLugaresDeTela`, `estado.js`):
// o catálogo vive só no Python.
//
// O contrato do arquivo da tela (o `arquivo` do item `tela` no manifesto):
//
//     (function () {
//       const EU = document.currentScript.dataset;   // { caminho, slug, tela, lugar }
//       xtRegistrarTela(EU.slug, EU.tela, (container, contexto) => {
//         // contexto = { projeto } — null na tela de Projetos
//         container.innerHTML = '…';
//       });
//     })();
//
// A função é chamada na PRIMEIRA vez que a tela aparece, e DE NOVO quando o
// projeto mudou desde a última vez (a regra de
// `plugins-navegacao.js::_dispatchPluginPanel`). O `container` é o `<div>` do
// programa, com `data-xt="{slug}"` e `data-origem="extensao"`.
//
// ⚠️ O REGISTRO É POR `id` DO ITEM, e não por lugar como o dos encaixes: uma
// extensão pode ter duas sub-abas na mesma aba.
//
// ⚠️ NOMES: o frontend não tem escopo de módulo. `xtTelas` (plural, sem `_`,
// `estado.js`) são as PÁGINAS das extensões em Configurações; `xtDesregistrarTela`
// (singular, `extensoes/tela.js`) tira a página. Aqui tudo leva "Telas"/"Tela"
// com outro verbo, e `_xtTelas` é o registro do recurso Tela.
//
// ⚠️ O VALOR DE NAVEGAÇÃO (`xt-tela-{id com . → -}`) sai do `id` do item, e
// nunca de um contador ou da ordem de carga: a memória de abas por projeto
// (`navegacao-abas.js`) e a "Ordem das abas" guardam esse valor, e religar a
// extensão tem de trazer a MESMA tela para o mesmo lugar. É único porque o
// prefixo do `id` é único entre as extensões ligadas (fase 10).

// `{id: {slug, lugar, rotulo, icone, ordem, fn, desenhada, projetoDesenhado, pendente}}`
const _xtTelas = new Map();

// `{slug: [{id, lugar}]}` — as telas cujo registro já saiu mas cujo DOM ainda
// está na tela, esperando o `xtDesmontar` da extensão rodar. Ver
// `xtDesregistrarTelas`.
const _xtTelasSaindo = new Map();

function _xtNavDaTela(id) {
  return `xt-tela-${String(id).replace(/\./g, '-')}`;
}

function _xtLugarDeTela(lugar) {
  return (typeof xtLugaresDeTela !== 'undefined' && xtLugaresDeTela || [])
    .find(l => l.lugar === lugar) || null;
}

/** O `<div>` onde a extensão desenha — o painel, ou o miolo da categoria. */
function _xtContainerDaTela(id) {
  return document.getElementById(_xtNavDaTela(id));
}

/** Visível de verdade: o painel e todos os pais sem `display: none`. */
function _xtTelaVisivel(id) {
  const c = _xtContainerDaTela(id);
  return !!(c && c.getClientRects().length);
}

/** A posição da tela entre as de extensão: a ordem de Programa › Extensões
 *  (D42), e dentro da mesma extensão a ordem do manifesto. */
function _xtOrdemDaTela(t) {
  const pos = typeof xtPosicaoNaLista === 'function' ? xtPosicaoNaLista(t.slug) : 0;
  return [pos, t.ordem];
}

function _xtTelaAntes(a, b) {
  const [pa, oa] = _xtOrdemDaTela(a);
  const [pb, ob] = _xtOrdemDaTela(b);
  return pa < pb || (pa === pb && oa < ob);
}

/**
 * O arquivo da tela chama isto, uma vez, quando carrega. `slug` e `id` vêm do
 * `document.currentScript.dataset` — nunca escritos à mão.
 */
// eslint-disable-next-line no-unused-vars
function xtRegistrarTela(slug, id, fn) {
  const t = _xtTelas.get(id);
  if (!t || t.slug !== slug) {
    // Desligada entre a injeção e o registro: o programa já a tirou, e o
    // arquivo que terminou de carregar agora não tem onde se pendurar.
    if (typeof _xtMontadas !== 'undefined' && !_xtMontadas.has(slug)) return;
    console.error(`[extensoes] a tela "${id}" de ${slug} não foi declarada no manifesto.`);
    return;
  }
  if (typeof fn !== 'function') {
    console.error(`[extensoes] a tela "${id}" de ${slug} não passou uma função.`);
    return;
  }
  t.fn = fn;
  t.desenhada = false;
  // O usuário pode ter clicado no botão antes de o arquivo terminar de
  // carregar: o botão aparece JÁ, e o desenho chega depois.
  if (_xtTelaVisivel(id)) _xtAbrirTela(id);
}

/** Chama a função da extensão se a tela nunca foi desenhada, ou se o projeto
 *  mudou desde o último desenho. */
function _xtAbrirTela(id) {
  const t = _xtTelas.get(id);
  const container = _xtContainerDaTela(id);
  if (!t || !t.fn || !container) return;
  // Na tela de Projetos não há projeto aberto para a tela — mesmo que haja um
  // na tira de cima: ela não é de projeto nenhum.
  const dentroDoProjeto = !!container.closest('#project-screen');
  const projeto = dentroDoProjeto && typeof currentProject !== 'undefined'
    ? (currentProject || null) : null;
  if (t.desenhada && t.projetoDesenhado === projeto) return;
  t.desenhada = true;
  t.projetoDesenhado = projeto;
  try {
    t.fn(container, { projeto });
  } catch (e) {
    console.error(`[extensoes] a tela "${id}" de ${t.slug} falhou ao desenhar:`, e);
  }
}

/** O clique no botão de uma tela: faz o que o handler da família faz, e desenha. */
function _xtClicarNaTela(id, L, btn) {
  const painel = _xtContainerDaTela(id);
  if (!painel) return;
  // `wire:` é família de `_wireSubtabBar`, que ESCOPA: `.agentes-subtab-btn`
  // serve a quatro barras, e uma query no documento apagaria o estado das
  // outras três (Padrões de interface › Barra de sub-abas). As famílias
  // 'propria' têm classe só delas, e o handler do programa já varre o
  // documento — escopar ou não dá no mesmo.
  const escopo = L.ligacao.startsWith('wire:') ? document.querySelector(L.dentro) : document;
  if (!escopo) return;
  escopo.querySelectorAll(`.${L.botao}`).forEach(b => b.classList.remove('active'));
  escopo.querySelectorAll(`.${L.painel}`).forEach(c => {
    c.classList.remove('active'); c.classList.add('hidden');
  });
  btn.classList.add('active');
  painel.classList.remove('hidden');
  painel.classList.add('active');
  // A mesma linha de `navegacao.js::bindProjectScreen`: é o que faz entrar de
  // novo no projeto voltar para esta aba.
  if (L.lugar === 'aba.nova' && typeof currentProject !== 'undefined' && currentProject
      && typeof _projAbaAtiva !== 'undefined') {
    _projAbaAtiva[currentProject] = btn.dataset.tab;
  }
  // Reação (D46): só a aba nova dispara `aba.abriu` — sub-aba não (proposta da
  // fase 12), igual às do programa.
  if (L.lugar === 'aba.nova' && typeof xtEmitir === 'function') {
    xtEmitir('aba.abriu', { projeto: (typeof currentProject !== 'undefined' && currentProject) || null,
                            aba: btn.dataset.tab, barra: L.barra });
  }
  // ⚠️ SÓ a tela. O `init` lazy da aba do programa (Mapas, Análise…) não é
  // chamado: ele não tem nada a desenhar num painel que não é dele.
  _xtAbrirTela(id);
}

/**
 * Cria o botão e o painel de uma tela no lugar dela. Devolve `false` quando a
 * barra ainda não existe (fica pendente e é tentada de novo depois).
 */
function _xtCriarBotaoEPainel(id) {
  const t = _xtTelas.get(id);
  const L = t && _xtLugarDeTela(t.lugar);
  if (!L) {
    if (t) console.error(`[extensoes] a tela "${id}" pede o lugar "${t.lugar}", que a tela não conhece.`);
    return true;
  }
  const nav = _xtNavDaTela(id);
  if (document.getElementById(nav)) { t.pendente = false; return true; }

  if (L.ligacao === 'categoria') {
    if (typeof registrarCategoriaConfig !== 'function') { t.pendente = true; return false; }
    // ⚠️ Sem `data-origem` aqui, e é a regra de `registrarCategoriaConfig`
    // (06/09/2026): no lado Extensões de Configurações tudo já é de extensão,
    // e a moldura do destaque só sujaria a página. O `data-xt` fica.
    registrarCategoriaConfig({
      chave: nav,
      rotulo: escapeHtml(t.rotulo),
      icone: escapeHtml(t.icone || '◇'),
      conteudo: `<div id="${nav}" class="xt-tela" data-xt="${t.slug}" data-xt-tela="${escapeHtml(id)}"></div>`,
      deExtensao: true, lado: 'extensoes', padrao: false,
    });
    t.pendente = !document.getElementById(nav);
    return !t.pendente;
  }

  const barra = document.querySelector(`[data-taborder-group="${L.barra}"]`);
  const dentro = document.querySelector(L.dentro);
  if (!barra || !dentro) { t.pendente = true; return false; }

  const btn = document.createElement('button');
  btn.className = L.botao;
  // ⚠️ O ATRIBUTO DE NAVEGAÇÃO É O PRIMEIRO `data-*`. `tab-order.js` e
  // `navegacao-abas.js` tomam como "valor de navegação" o primeiro `data-*` do
  // botão que não começa com `taborder` — na ordem dos atributos.
  btn.setAttribute(`data-${L.atributo}`, nav);
  btn.dataset.xt = t.slug;
  btn.dataset.xtTela = id;
  // Quem marca a origem é o PROGRAMA: sem isto, a aba nova ficaria invisível
  // ao "Destacar extensões".
  btn.dataset.origem = 'extensao';
  btn.dataset.taborderRotulo = t.rotulo;
  btn.textContent = t.icone ? `${t.icone} ${t.rotulo}` : t.rotulo;
  if (L.ligacao.startsWith('wire:')) {
    // `_wireSubtabBar` pula botão já marcado: sem a marca, o `init` da aba
    // pendurava o ouvinte dela também, e o `dispatch` do programa seria
    // chamado com o id de uma tela que não é dele.
    btn._asubtabWired = true;
  }
  btn.addEventListener('click', () => _xtClicarNaTela(id, L, btn));

  // A ordem entre as abas de extensão é a de Programa › Extensões, sempre
  // depois das do programa (D42): antes da primeira tela de extensão que vem
  // DEPOIS desta na lista; sem nenhuma, no fim da barra.
  const seguinte = [...barra.querySelectorAll(':scope > button[data-xt-tela]')].find((b) => {
    const outra = _xtTelas.get(b.dataset.xtTela);
    return outra && _xtTelaAntes(t, outra);
  });
  if (seguinte) barra.insertBefore(btn, seguinte);
  else barra.appendChild(btn);

  const painel = document.createElement('div');
  painel.id = nav;
  painel.className = `${L.painel} hidden`;
  painel.dataset.xt = t.slug;
  painel.dataset.xtTela = id;
  painel.dataset.origem = 'extensao';
  // Ao lado dos painéis da família — depois do último que é irmão do primeiro.
  // Os `reset` do programa (`_resetTabPrincipal`, `_resetSubAbas`) casam botão e
  // painel pelo ÍNDICE; no fim, a tela nunca rouba o índice 0.
  const familia = [...dentro.querySelectorAll(`.${L.painel}`)];
  const pai = familia.length ? familia[0].parentElement : dentro;
  const irmaos = [...pai.children].filter(c => c.classList.contains(L.painel));
  if (irmaos.length) irmaos[irmaos.length - 1].after(painel);
  else pai.appendChild(painel);

  t.pendente = false;
  return true;
}

/**
 * Registra e injeta as telas de UMA extensão. Chamada por `carga.js`.
 *
 * O botão aparece JÁ, antes de o arquivo da tela carregar — é o que faz a aba
 * nascer sem esperar a rede.
 */
// eslint-disable-next-line no-unused-vars
async function xtCarregarTelas(folha) {
  const telas = folha.telas || [];
  for (let i = 0; i < telas.length; i++) {
    const item = telas[i];
    // ⚠️ "Depois de um await, confira se ainda está montada" (Regras e
    // instruções): o usuário pode ter desligado a extensão enquanto o arquivo
    // da tela anterior carregava.
    if (typeof _xtMontadas !== 'undefined' && !_xtMontadas.has(folha.slug)) return;
    _xtTelas.set(item.id, {
      slug: folha.slug, lugar: item.lugar, rotulo: item.rotulo, icone: item.icone || '',
      ordem: i, fn: null, desenhada: false, projetoDesenhado: null, pendente: false,
    });
    _xtCriarBotaoEPainel(item.id);
    await xtInjetarArquivoDaExtensao(folha, item.arquivo,
      { tela: item.id, lugar: item.lugar }, 'a tela');
  }
}

/**
 * Tira do REGISTRO as telas de uma extensão — o programa para de chamá-las.
 * O DOM (botão e painel) sai depois, em `xtRemoverTelasDoDom`.
 *
 * ⚠️ DUAS BAIXAS, E A ORDEM É DE PROPÓSITO. O registro sai no bloco de cima de
 * `descarregar.js`, antes do `xtDesmontar` — a regra de lá: o programa para de
 * chamar a extensão ANTES de ela apagar as próprias globais. O DOM sai DEPOIS
 * do `xtDesmontar`: a extensão pode querer desfazer algo que ela pôs dentro do
 * painel dela (um observador, um temporizador preso a um elemento), e
 * precisa do painel ainda de pé para isso.
 */
// eslint-disable-next-line no-unused-vars
function xtDesregistrarTelas(slug) {
  const saindo = [];
  for (const [id, t] of [..._xtTelas]) {
    if (t.slug !== slug) continue;
    saindo.push({ id, lugar: t.lugar });
    _xtTelas.delete(id);
  }
  if (saindo.length) _xtTelasSaindo.set(slug, saindo);
}

/** Se o botão que sai era o ativo, a barra cai no primeiro botão dela — nunca
 *  num painel em branco (a regra de `plugins-navegacao.js::_montarAbaDePlugins`). */
function _xtCairNaPrimeira(barra, L) {
  if (!barra) return;
  const primeiro = [...barra.children].find(el =>
    el.tagName === 'BUTTON' && !el.classList.contains('hidden'));
  if (!primeiro) return;
  primeiro.click();
  if (barra.querySelector(':scope > button.active')) return;
  // Barra cujo ouvinte ainda não foi pendurado (o `init` da aba nunca rodou):
  // o clique não fez nada, e a marca é reposta à mão.
  primeiro.classList.add('active');
  const alvo = document.getElementById(primeiro.getAttribute(`data-${L.atributo}`));
  if (alvo) { alvo.classList.remove('hidden'); alvo.classList.add('active'); }
}

/** Tira da tela o botão e o painel das telas que `xtDesregistrarTelas` tirou
 *  do registro. Chamada por `descarregar.js`, depois do `xtDesmontar`. */
// eslint-disable-next-line no-unused-vars
function xtRemoverTelasDoDom(slug) {
  const saindo = _xtTelasSaindo.get(slug) || [];
  _xtTelasSaindo.delete(slug);
  for (const { id, lugar } of saindo) {
    const L = _xtLugarDeTela(lugar);
    const nav = _xtNavDaTela(id);
    if (L && L.ligacao === 'categoria') {
      if (typeof desregistrarCategoriaConfig === 'function') desregistrarCategoriaConfig(nav);
      continue;
    }
    const btn = document.querySelector(`button[data-xt-tela="${CSS.escape(id)}"]`);
    const painel = document.getElementById(nav);
    const barra = btn && btn.parentElement;
    const eraAtivo = !!(btn && btn.classList.contains('active'));
    if (btn) btn.remove();
    if (painel) painel.remove();
    if (eraAtivo && L) _xtCairNaPrimeira(barra, L);
  }
  // Rede de segurança: sobra com o `data-xt` dela (uma tela que ficou sem
  // registro por um erro no meio) não pode continuar na barra.
  document.querySelectorAll(`button[data-xt-tela][data-xt="${slug}"]`).forEach(el => el.remove());
}

/**
 * Cria o que ficou pendente (a barra ainda não existia) e redesenha as telas
 * VISÍVEIS cujo projeto mudou. Chamada por `xtRepintarPontosAbertos` e depois
 * de todo clique num botão.
 */
function xtRepintarTelasAbertas() {
  for (const [id, t] of _xtTelas) {
    if (t.pendente) _xtCriarBotaoEPainel(id);
    if (_xtTelaVisivel(id)) _xtAbrirTela(id);
  }
}

// Trocar de projeto com a tela de extensão na frente (`enterProject` repõe a
// aba salva CLICANDO nela) tem de redesenhar a tela com o projeto novo. Um
// ouvinte só, no documento, e não um em cada barra — a mesma escolha de
// `navegacao-abas.js`. ⚠️ Em `setTimeout`: vários ouvintes do programa estão
// no documento e foram pendurados DEPOIS deste (o trilho de Configurações, a
// memória de abas); rodando já, este leria o painel antes de ele aparecer.
document.addEventListener('click', (e) => {
  if (!_xtTelas.size) return;
  if (!e.target || typeof e.target.closest !== 'function' || !e.target.closest('button')) return;
  setTimeout(xtRepintarTelasAbertas, 0);
});
