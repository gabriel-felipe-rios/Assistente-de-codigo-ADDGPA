// ═══════════════════════════════════ Navegação — Launchers ══
// As duas abas "Launchers" (tela principal e dentro do projeto) — um
// trilho de pastas (ver trilho-de-pastas.js) à esquerda, com a árvore de
// pastas/subpastas de External/launchers/, e a grade/lista de atalhos da
// pasta escolhida à direita. A árvore chega podada para mostrar só o que
// está ligado e marcado pra aquele local (grupo/subgrupo some inteiro se
// não sobrar nenhum atalho ligado lá dentro, em qualquer profundidade).
// Sem sub-abas: ao contrário de Plugins, um atalho não tem tela própria nem
// código pra carregar — é só um arquivo que o Windows abre.
//
// Cada painel tem uma barra de busca (filtra por nome de atalho, em
// QUALQUER pasta — digitar ignora a pasta escolhida no trilho, porque quem
// está buscando não sabe de antemão onde o atalho está) e um alternador de
// duas visualizações: "lista" (uma linha por atalho, ícone pequeno — o
// PADRÃO) e "grade" (ícone grande, um bloco por atalho). O estado de busca,
// visualização e pasta escolhida fica preso no próprio elemento do painel
// (não em variável global), porque a aba da tela principal e a de dentro do
// projeto são painéis independentes — mexer numa não deveria mexer na outra.
//
// O estado da árvore (`atalhosExternosArvore`) é populado por
// `config-atalhos-externos.js`, carregado antes deste arquivo — ver a
// ordem dos <script> no index.html.

/** Poda a árvore pra só o que está ligado E marcado pro `local` pedido
 * ('tela_principal' ou 'dentro_do_projeto') — recursivo: uma pasta some
 * inteira se nenhum descendente (item ou subpasta) sobreviver. Nunca muda
 * `no` original — sempre devolve um nó novo, ou `null`. */
function _atalhosExternosPodarPorLocal(no, local) {
  const itens = no.itens.filter(p => p.ligado && p[local]);
  const pastas = no.pastas.map(p => _atalhosExternosPodarPorLocal(p, local)).filter(Boolean);
  if (!itens.length && !pastas.length) return null;
  return { ...no, itens, pastas };
}

function _atalhosExternosItemHtml(p) {
  return `
    <button class="atalho-externo-item" data-atalho="${escapeHtml(p.caminho)}" title="${escapeHtml(p.nome)}">
      <img class="atalho-externo-icone" src="${p.icone || ICONE_ATALHO_PLACEHOLDER}" alt="" />
      <span class="atalho-externo-nome">${escapeHtml(p.nome)}</span>
    </button>`;
}

/** Repinta só os ITENS (não o trilho nem a barra de busca/visualização) —
 * usa a seleção do trilho (`painel._trilhoSelecao`) e, se houver termo de
 * busca, ignora a seleção e procura em QUALQUER pasta ("Todos" implícito).
 * Nunca refaz a barra de cima nem o trilho, senão o campo de busca perde o
 * foco e o cursor a cada letra digitada. */
function _atalhosExternosRepintarItens(painel) {
  const itensWrap = painel.querySelector('.atalho-externo-arvore');
  if (!itensWrap) return;
  const termo = (painel._atalhosBusca || '').trim().toLowerCase();

  const lista = termo
    ? trilhoPastasItensVisiveis(painel._atalhosArvore, 'itens', 'todos')
        .filter(p => p.nome.toLowerCase().includes(termo))
    : trilhoPastasItensVisiveis(painel._atalhosArvore, 'itens', painel._trilhoSelecao || 'todos');

  if (!lista.length) {
    itensWrap.innerHTML = termo
      ? `<p class="plugins-vazio">Nenhum atalho com "${escapeHtml(painel._atalhosBusca)}".</p>`
      : '<p class="plugins-vazio">Nenhum atalho nesta pasta.</p>';
    return;
  }
  const itensClasse = painel._atalhosVisualizacao === 'lista'
    ? 'atalho-externo-itens atalho-externo-itens-lista'
    : 'atalho-externo-itens';
  itensWrap.innerHTML = `<div class="${itensClasse}">${lista.map(_atalhosExternosItemHtml).join('')}</div>`;
}

/** Repinta o trilho a partir da árvore atual do painel — chamada quando a
 * árvore muda de verdade (ligar/desligar atalho, mudar local, reordenar),
 * nunca a cada tecla de busca. Se a pasta selecionada sumiu da árvore nova
 * (ficou sem nenhum atalho ligado lá dentro), volta pra "Todos". */
function _atalhosExternosRepintarTrilho(painel) {
  const trilhoEl = painel.querySelector('.trilho-pastas');
  if (!trilhoEl) return;
  trilhoEl.innerHTML = trilhoPastasHtml(painel._atalhosArvore);

  const sel = painel._trilhoSelecao;
  const aindaExiste = sel === 'todos' || sel === 'nenhuma'
    || !!trilhoEl.querySelector(`[data-trilho-pasta="${CSS.escape(sel.caminho)}"]`);
  if (!aindaExiste) painel._trilhoSelecao = 'todos';

  trilhoPastasMarcarAtiva(trilhoEl, painel._trilhoSelecao);
}

/** Monta a barra de busca + alternador de visualização + trilho UMA vez por
 * painel — chamada só quando o painel ainda não tem essa estrutura, pra não
 * perder o que o usuário já digitou/escolheu ao repintar depois de ligar/
 * desligar outro atalho. "Lista" vem primeiro (esquerda) e é o padrão;
 * "Grade" vem depois (direita). */
function _atalhosExternosMontarChrome(painel) {
  painel.innerHTML = `
    <div class="trilho-pastas-corpo">
      <div class="trilho-pastas"></div>
      <div class="trilho-pastas-conteudo">
        <div class="atalho-externo-barra">
          <label class="atalho-externo-busca">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7.8 7.8 L11 11" stroke="currentColor" stroke-width="1.4"/></svg>
            <input type="text" placeholder="Buscar atalho..." autocomplete="off" spellcheck="false" />
          </label>
          <div class="atalho-externo-vis">
            <button class="atalho-externo-vis-btn" data-vis="lista" title="Visualização em lista">☰</button>
            <button class="atalho-externo-vis-btn" data-vis="grade" title="Visualização em grade">▦</button>
          </div>
        </div>
        <div class="atalho-externo-arvore"></div>
      </div>
    </div>`;

  painel._atalhosBusca = '';
  painel._atalhosVisualizacao = 'lista';
  painel._trilhoSelecao = 'todos';

  const campoBusca = painel.querySelector('.atalho-externo-busca input');
  campoBusca.addEventListener('input', () => {
    painel._atalhosBusca = campoBusca.value;
    _atalhosExternosRepintarItens(painel);
  });

  painel.querySelectorAll('.atalho-externo-vis-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.vis === painel._atalhosVisualizacao);
    btn.addEventListener('click', () => {
      painel._atalhosVisualizacao = btn.dataset.vis;
      painel.querySelectorAll('.atalho-externo-vis-btn')
        .forEach(b => b.classList.toggle('active', b === btn));
      _atalhosExternosRepintarItens(painel);
    });
  });

  painel.querySelector('.trilho-pastas').addEventListener('click', (ev) => {
    const trilhoEl = ev.currentTarget;
    const selecao = trilhoPastasSelecaoDoClique(ev.target, trilhoEl);
    if (!selecao) return;
    painel._trilhoSelecao = selecao;
    trilhoPastasMarcarAtiva(trilhoEl, selecao);
    _atalhosExternosRepintarItens(painel);
  });

  // Delegado no painel inteiro (sobrevive a `_atalhosExternosRepintarItens`
  // recriando os itens) — mesma ideia de `config-plugins.js`.
  painel.addEventListener('click', (ev) => {
    const item = ev.target.closest('.atalho-externo-item');
    if (!item) return;
    _abrirAtalhoExternoClicado(item.dataset.atalho);
  });
}

/** Executa o atalho clicado — o mesmo efeito de dar duplo clique nele no
 * Explorador. Não há painel pra "carregar": a árvore já está pronta, o
 * clique só dispara `os.startfile` no backend. */
async function _abrirAtalhoExternoClicado(caminho) {
  try {
    const r = await window.pywebview.api.abrir_atalho_externo(caminho);
    if (!r || !r.success) showToast((r && r.error) || 'Não foi possível abrir.', true);
  } catch (e) {
    showToast('Não foi possível abrir.', true);
    console.error('[atalhos-externos]', e);
  }
}

function _montarAbaDeAtalhosExternos(btn, painel, arvorePodada) {
  if (!btn || !painel) return;
  const estavaAtiva = btn.classList.contains('active');
  const vazia = !arvorePodada;
  btn.classList.toggle('hidden', vazia);

  // A aba estava aberta e ficou sem atalho nenhum: não dá pra deixar uma
  // aba ativa e invisível — volta pra primeira aba da mesma barra.
  if (estavaAtiva && vazia) {
    const primeira = btn.parentElement && btn.parentElement.querySelector(
      btn.classList.contains('main-tab-btn') ? '.main-tab-btn' : '.tab-btn');
    if (primeira && primeira !== btn) primeira.click();
  }

  if (vazia) {
    painel.innerHTML = '<p class="plugins-vazio">Nenhum atalho marcado para aparecer aqui — ver Configurações › Launchers.</p>';
    painel._chromeAtalhos = false;
    return;
  }

  if (!painel._chromeAtalhos) {
    painel._chromeAtalhos = true;
    _atalhosExternosMontarChrome(painel);
  }
  painel._atalhosArvore = arvorePodada;
  _atalhosExternosRepintarTrilho(painel);
  _atalhosExternosRepintarItens(painel);
}

/** Repinta as duas abas "Launchers" a partir de `atalhosExternosArvore`.
 * Chamada por `config-atalhos-externos.js` toda vez que a árvore muda
 * (ligar/desligar, marcar um dos dois checkboxes, reordenar pasta) e uma
 * vez no boot, via `carregarAtalhosExternos()`. */
function atualizarAbasDeAtalhosExternos() {
  const principais = _atalhosExternosPodarPorLocal(atalhosExternosArvore, 'tela_principal');
  const doProjeto  = _atalhosExternosPodarPorLocal(atalhosExternosArvore, 'dentro_do_projeto');

  _montarAbaDeAtalhosExternos(
    document.getElementById('main-tab-atalhos-externos'), document.getElementById('ptab-atalhos-externos'),
    principais);
  _montarAbaDeAtalhosExternos(
    document.getElementById('main-tab-atalhos-externos-projeto'), document.getElementById('tab-atalhos-externos'),
    doProjeto);
}
