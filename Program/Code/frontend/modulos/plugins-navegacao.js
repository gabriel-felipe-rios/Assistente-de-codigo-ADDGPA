// ═══════════════════════════════════════════════ Navegação — Plugins ══
// As duas abas "Plugins" (tela principal e dentro do projeto) — um trilho
// de pastas (ver trilho-de-pastas.js) à esquerda, com a árvore de
// pastas/subpastas de External/plugins/, e as sub-abas dinâmicas do lado
// direito — uma por plugin da pasta escolhida no trilho (Configurações ›
// Plugins, D2.1 da discussão "Sistema de plugins").
//
// Reusa `.agentes-subtab-btn` / `.agentes-subtab-content` e `_wireSubtabBar`
// (rotinas.js) pras sub-abas de plugin em vez de criar classe nova: são o
// padrão já pensado para mais de uma barra igual na tela ao mesmo tempo, com
// escopo por container — exatamente o caso aqui (a barra da tela principal e
// a de dentro do projeto podem existir juntas no DOM).
//
// O estado dos plugins (`pluginsArvore`, uma ÁRVORE — pasta é organização
// pura, plugin é a folha) é populado por `config-plugins.js`, carregado
// antes deste arquivo — ver a ordem dos <script> no index.html.

/** Poda a árvore pra só o que está ligado E marcado pro `local` pedido
 * ('tela_principal' ou 'dentro_do_projeto') — recursivo, mesma regra de
 * `_atalhosExternosPodarPorLocal` (atalhos-externos-navegacao.js), só que
 * no campo `plugins` em vez de `itens`. Nunca muda `no` original. */
function _pluginsPodarPorLocal(no, local) {
  const plugins = no.plugins.filter(p => p.ligado && p[local]);
  const pastas = no.pastas.map(p => _pluginsPodarPorLocal(p, local)).filter(Boolean);
  if (!plugins.length && !pastas.length) return null;
  return { ...no, plugins, pastas };
}

/** Caminho de plugin -> id de elemento seguro (sem espaço, sem acento, sem
 * barra). Tira as marcas de acento por código (0x0300–0x036F, o bloco
 * Unicode dos diacríticos combinantes) em vez de um intervalo de regex
 * escrito à mão — mais claro de ler do que os próprios caracteres de acento
 * soltos no meio do código-fonte. O caminho inteiro (não só o nome) garante
 * um id único mesmo com dois plugins de mesmo nome em pastas diferentes. */
function _pluginSlug(caminho) {
  const semAcento = caminho.normalize('NFD')
    .split('')
    .filter(ch => { const c = ch.charCodeAt(0); return c < 0x0300 || c > 0x036f; })
    .join('');
  return semAcento
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'plugin';
}

function _pluginsSubtabsHtml(lista, local, prefixo) {
  if (!lista.length) {
    return '<p class="plugins-vazio">Nenhum plugin nesta pasta.</p>';
  }
  const botoes = lista.map((p, i) => `
    <button class="agentes-subtab-btn${i === 0 ? ' active' : ''}" data-asubtab="${prefixo}-${_pluginSlug(p.caminho)}">${escapeHtml(p.nome)}</button>`).join('');
  const paineis = lista.map((p, i) => `
    <div id="${prefixo}-${_pluginSlug(p.caminho)}" class="agentes-subtab-content${i === 0 ? ' active' : ' hidden'}"
         data-plugin="${escapeHtml(p.caminho)}" data-frontend="${escapeHtml(p.frontend || 'frontend/index.js')}" data-local="${local}"></div>`).join('');
  return `<div class="agentes-subtabs-bar">${botoes}</div>${paineis}`;
}

/** Injeta o frontend do plugin como script clássico — o arquivo que o
 * `plugin.json` declara em `frontend` (padrão `frontend/index.js`, vem na
 * folha da árvore) — nunca dois plugins carregados ao mesmo tempo, para
 * `window.montarPlugin` nunca apontar para o script errado. `caminho` pode
 * ter subpasta ("Dev/Meu Plugin") — cada segmento, do `caminho` e do
 * `frontend`, é codificado separadamente, pra não escapar as barras. */
function _carregarScriptPlugin(caminho, frontend = 'frontend/index.js') {
  return new Promise((resolve, reject) => {
    const antigo = document.getElementById('plugin-script-ativo');
    if (antigo) antigo.remove();
    window.montarPlugin = undefined;
    const script = document.createElement('script');
    script.id = 'plugin-script-ativo';
    const caminhoCodificado = caminho.split('/').map(encodeURIComponent).join('/');
    const frontendCodificado = frontend.split('/').map(encodeURIComponent).join('/');
    // `?t=`: o mesmo motivo de `extensoes/carga.js` — o WebView2 guarda o antigo em cache se a URL for a mesma.
    script.src = `../../External/plugins/${caminhoCodificado}/${frontendCodificado}?t=${Date.now()}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`não achou o ${frontend} do plugin "${caminho}"`));
    document.body.appendChild(script);
  });
}

async function _abrirPluginNoPainel(painel) {
  const caminho = painel.dataset.plugin;
  const projeto = painel.dataset.local === 'projeto' ? (currentProject || null) : null;
  painel.dataset.loaded = '1';
  painel.dataset.projetoCarregado = projeto || '';
  painel.innerHTML = '<p class="plugins-vazio">Carregando…</p>';
  try {
    await _carregarScriptPlugin(caminho, painel.dataset.frontend || 'frontend/index.js');
    if (typeof window.montarPlugin !== 'function') {
      painel.innerHTML = `<p class="plugins-vazio">O plugin "${escapeHtml(caminho)}" não define <code>montarPlugin</code> — ver Arquivos › Como adicionar › Plugins.</p>`;
      return;
    }
    painel.innerHTML = '';
    window.montarPlugin(painel, { projeto });
  } catch (e) {
    painel.innerHTML = `<p class="plugins-vazio">Não foi possível carregar o plugin "${escapeHtml(caminho)}".</p>`;
    console.error('[plugins]', e);
  }
}

/** Carrega o painel na primeira vez, e de novo se o projeto mudou desde a
 * última carga (a versão "dentro do projeto" depende de qual está aberto). */
function _dispatchPluginPanel(painel) {
  if (!painel) return;
  const projetoAtual = painel.dataset.local === 'projeto' ? (currentProject || '') : '';
  if (painel.dataset.loaded === '1' && painel.dataset.projetoCarregado === projetoAtual) return;
  _abrirPluginNoPainel(painel);
}

/** Monta o trilho + o container das sub-abas de plugin UMA vez por painel —
 * chamada só quando o painel ainda não tem essa estrutura. */
function _pluginsMontarChrome(painel, local, prefixo) {
  painel.innerHTML = `
    <div class="trilho-pastas-corpo">
      <div class="trilho-pastas"></div>
      <div class="trilho-pastas-conteudo"></div>
    </div>`;
  painel._trilhoSelecao = 'todos';
  painel._pluginsLocal = local;
  painel._pluginsPrefixo = prefixo;

  painel.querySelector('.trilho-pastas').addEventListener('click', (ev) => {
    const trilhoEl = ev.currentTarget;
    const selecao = trilhoPastasSelecaoDoClique(ev.target, trilhoEl);
    if (!selecao) return;
    painel._trilhoSelecao = selecao;
    trilhoPastasMarcarAtiva(trilhoEl, selecao);
    _pluginsRepintarConteudo(painel);
  });
}

/** Repinta o trilho a partir da árvore atual do painel. Se a pasta
 * selecionada sumiu da árvore nova (ficou sem plugin ligado lá dentro),
 * volta pra "Todos" — mesma regra de `atalhos-externos-navegacao.js`. */
function _pluginsRepintarTrilho(painel) {
  const trilhoEl = painel.querySelector('.trilho-pastas');
  if (!trilhoEl) return;
  trilhoEl.innerHTML = trilhoPastasHtml(painel._pluginsArvore);

  const sel = painel._trilhoSelecao;
  const aindaExiste = sel === 'todos' || sel === 'nenhuma'
    || !!trilhoEl.querySelector(`[data-trilho-pasta="${CSS.escape(sel.caminho)}"]`);
  if (!aindaExiste) painel._trilhoSelecao = 'todos';

  trilhoPastasMarcarAtiva(trilhoEl, painel._trilhoSelecao);
}

/** Repinta as sub-abas de plugin da pasta escolhida no trilho — refaz o DOM
 * inteiro dessa metade (não há campo de busca aqui pra perder foco, ao
 * contrário de Launchers) e despacha a primeira automaticamente. */
function _pluginsRepintarConteudo(painel) {
  const conteudo = painel.querySelector('.trilho-pastas-conteudo');
  if (!conteudo) return;
  const lista = trilhoPastasItensVisiveis(painel._pluginsArvore, 'plugins', painel._trilhoSelecao || 'todos');
  conteudo.innerHTML = _pluginsSubtabsHtml(lista, painel._pluginsLocal, painel._pluginsPrefixo);
  _wireSubtabBar(conteudo, id => _dispatchPluginPanel(document.getElementById(id)));
  _dispatchPluginPanel(conteudo.querySelector('.agentes-subtab-content.active'));
}

function _montarAbaDePlugins(btn, painel, arvorePodada, local, prefixo) {
  if (!btn || !painel) return;
  const estavaAtiva = btn.classList.contains('active');
  const vazia = !arvorePodada;
  btn.classList.toggle('hidden', vazia);

  // A aba estava aberta e ficou sem plugin nenhum: não dá pra deixar uma aba
  // ativa e invisível — volta pra primeira aba da mesma barra.
  if (estavaAtiva && vazia) {
    const primeira = btn.parentElement && btn.parentElement.querySelector(
      btn.classList.contains('main-tab-btn') ? '.main-tab-btn' : '.tab-btn');
    if (primeira && primeira !== btn) primeira.click();
  }

  if (vazia) {
    painel.innerHTML = '<p class="plugins-vazio">Nenhum plugin marcado para aparecer aqui — ver Configurações › Plugins.</p>';
    painel._chromePlugins = false;
    return;
  }

  if (!painel._chromePlugins) {
    painel._chromePlugins = true;
    _pluginsMontarChrome(painel, local, prefixo);
  }
  painel._pluginsArvore = arvorePodada;
  _pluginsRepintarTrilho(painel);
  _pluginsRepintarConteudo(painel);
}

/** Repinta as duas abas "Plugins" a partir de `pluginsArvore`. Chamada por
 * `config-plugins.js` toda vez que a árvore muda (ligar/desligar, marcar
 * um dos dois checkboxes) e uma vez no boot, via `carregarPlugins()`. */
function atualizarAbasDePlugins() {
  const principais = _pluginsPodarPorLocal(pluginsArvore, 'tela_principal');
  const doProjeto  = _pluginsPodarPorLocal(pluginsArvore, 'dentro_do_projeto');

  _montarAbaDePlugins(
    document.getElementById('main-tab-plugins'), document.getElementById('ptab-plugins'),
    principais, 'principal', 'plg-principal');
  _montarAbaDePlugins(
    document.getElementById('main-tab-plugins-projeto'), document.getElementById('tab-plugins'),
    doProjeto, 'projeto', 'plg-projeto');
}

/** Chamada ao abrir a aba "Plugins" da tela Projetos (ver projetos.js). */
function initGlobalPluginsTab() {
  _dispatchPluginPanel(document.querySelector('#ptab-plugins .agentes-subtab-content.active'));
}

/** Chamada ao abrir a aba "Plugins" dentro de um projeto (ver navegacao.js). */
function initProjectPluginsTab() {
  _dispatchPluginPanel(document.querySelector('#tab-plugins .agentes-subtab-content.active'));
}
