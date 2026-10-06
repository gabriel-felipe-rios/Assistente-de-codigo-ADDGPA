// ══════════════════════════════════════════════ ABA: CONFIGURAÇÕES — ORDEM DAS ABAS ══
//
// Grupos de abas reordenáveis são descobertos em tempo real no DOM: qualquer
// barra de abas marcada com [data-taborder-group] no HTML vira uma seção nesta
// tela automaticamente — não é preciso editar este arquivo para isso.
//
// Convenção (ver Program/Code/frontend/index.html):
//   <div class="tabs-bar" data-taborder-group="chave_unica"
//        data-taborder-label="Título mostrado na tela"
//        data-taborder-parent="id-do-painel-pai">   (opcional — só p/ sub-abas)
//     <button data-algumAtributo="id-do-painel">Rótulo</button>
//     ...
//   </div>
// O atributo "de navegação" de cada botão (data-tab, data-dtab, data-vptab...)
// é detectado automaticamente: é o único data-* do botão que não começa com
// "taborder". Seu valor deve ser o id do painel de conteúdo correspondente.

let _tabOrder = {};

function _isNavDataKey(key) {
  return !key.startsWith('taborder');
}

function _navAttrOfBar(bar) {
  const btn = [...bar.children].find(el => el.tagName === 'BUTTON' && Object.keys(el.dataset).some(_isNavDataKey));
  return btn ? Object.keys(btn.dataset).find(_isNavDataKey) : null;
}

function _discoverTabOrderGroups() {
  return [...document.querySelectorAll('[data-taborder-group]')].map(bar => {
    const key = bar.dataset.taborderGroup;
    return {
      key,
      label: bar.dataset.taborderLabel || key,
      dica: bar.dataset.taborderDica || '',
      parentTabId: bar.dataset.taborderParent || null,
      // Prefixo do id do painel, quando o valor de navegação do botão não é
      // o id em si (é o caso do trilho de Configurações: `data-categoria`
      // vale "modelo", e o painel é `#config-secao-modelo`).
      painelPrefixo: bar.dataset.taborderPainel || '',
      bar,
      navAttr: _navAttrOfBar(bar),
      rowId: `order-${key}`,
      expandId: `expand-${key}`,
    };
  });
}

function _makePill(id, label) {
  // `label` já vem tratado por `_fillRow`.
  const pill = document.createElement('div');
  pill.className = 'taborder-pill';
  pill.dataset.id = id;
  pill.innerHTML = `<span class="taborder-handle">⠿</span>${label}`;
  return pill;
}

function _fillRow(row, group) {
  if (!group.navAttr) return;
  [...group.bar.children].forEach(btn => {
    if (btn.tagName !== 'BUTTON') return;
    const id = btn.dataset[group.navAttr];
    if (!id) return;
    // `data-taborder-rotulo` ganha do `textContent` quando existe: o botão
    // pode ter ícone dentro, e a pílula sairia "◆Modelo e contexto".
    row.appendChild(_makePill(id, btn.dataset.taborderRotulo || btn.textContent.trim()));
  });
}

function _findPill(built, id) {
  for (const info of built.values()) {
    const pill = info.rowEl.querySelector(`[data-id="${id}"]`);
    if (pill) return pill;
  }
  return null;
}

// Cada grupo descoberto vira um cartão com superfície própria. Antes eram
// títulos em caixa alta soltos sobre o fundo da tela, um logo abaixo do outro:
// não dava para ver onde um grupo acabava e o seguinte começava.
function _buildRootSection(root, group, built) {
  const section = document.createElement('div');
  section.className = 'config-cartao';

  const head = document.createElement('div');
  head.className = 'config-cartao-cabecalho';
  const title = document.createElement('div');
  title.className = 'config-cartao-titulo';
  title.textContent = group.label;
  head.appendChild(title);
  if (group.dica) {
    const dica = document.createElement('p');
    dica.className = 'config-cartao-dica';
    dica.textContent = group.dica;
    head.appendChild(dica);
  }

  const row = document.createElement('div');
  row.className = 'taborder-row';
  row.id = group.rowId;
  _fillRow(row, group);
  section.appendChild(head);
  section.appendChild(row);
  root.appendChild(section);
  built.set(group.key, { rowEl: row });
}

function _buildNestedRow(group, parentPill, built) {
  if (!parentPill.querySelector(`.taborder-expand-btn[data-expand="${group.expandId}"]`)) {
    const expandBtn = document.createElement('button');
    expandBtn.className = 'taborder-expand-btn';
    expandBtn.dataset.expand = group.expandId;
    expandBtn.title = 'Ver sub-abas';
    expandBtn.textContent = '▾';
    parentPill.appendChild(expandBtn);
  }
  const section = parentPill.closest('.config-cartao');
  if (!section) return;
  const area = document.createElement('div');
  area.className = 'taborder-subtab-area hidden';
  area.id = group.expandId;
  const label = document.createElement('div');
  label.className = 'taborder-subtab-label';
  label.textContent = group.label;
  const row = document.createElement('div');
  row.className = 'taborder-row';
  row.id = group.rowId;
  _fillRow(row, group);
  area.appendChild(label);
  area.appendChild(row);
  section.appendChild(area);
  built.set(group.key, { rowEl: row });
}

function _buildTabOrderUI() {
  const root = document.getElementById('taborder-root');
  if (!root) return;
  root.innerHTML = '';
  // Barra que nasceu depois do boot: fotografada aqui, antes que um Salvar
  // desta tela a reordene — senão o restaurar a "voltaria" à ordem do usuário.
  _fotografarOrdemDeFabrica();

  const groups = _discoverTabOrderGroups();
  const built = new Map(); // key -> { rowEl }

  for (const g of groups.filter(g => !g.parentTabId)) _buildRootSection(root, g, built);

  // Resolve grupos aninhados em qualquer profundidade: repete até estabilizar
  // (o pai de um grupo pode ser um pill que só existe depois de outro grupo aninhado ser montado).
  let remaining = groups.filter(g => g.parentTabId);
  let progressed = true;
  while (remaining.length && progressed) {
    progressed = false;
    remaining = remaining.filter(g => {
      const parentPill = _findPill(built, g.parentTabId);
      if (!parentPill) return true;
      _buildNestedRow(g, parentPill, built);
      progressed = true;
      return false;
    });
  }
  // Pai nunca encontrado (grupo órfão) — mostra mesmo assim como seção de topo,
  // em vez de sumir silenciosamente.
  for (const g of remaining) _buildRootSection(root, g, built);

  for (const info of built.values()) _initTabOrderDnd(info.rowEl);
}

// A ordem em que o HTML declarou cada barra, tirada ANTES de aplicar a
// ordem salva — depois dela o DOM já foi reordenado e a de fábrica se perde.
// É o que deixa "Restaurar padrão" valer sem reiniciar.
let _tabOrderDeFabrica = {};

function _fotografarOrdemDeFabrica() {
  for (const g of _discoverTabOrderGroups()) {
    if (!g.navAttr || _tabOrderDeFabrica[g.key]) continue;
    _tabOrderDeFabrica[g.key] = [...g.bar.children]
      .filter(el => el.tagName === 'BUTTON' && el.dataset[g.navAttr])
      .map(el => el.dataset[g.navAttr]);
  }
}

/** "Restaurar padrão" da Ordem das abas, na hora: reaplica a foto de fábrica
 *  em cada barra e remonta as pílulas desta tela. */
function aplicarOrdemDeFabrica() {
  _fotografarOrdemDeFabrica();          // grupos que nasceram depois do boot
  _tabOrder = {};
  for (const [key, ids] of Object.entries(_tabOrderDeFabrica)) {
    if (ids.length) _applyGroupOrderToDom(key, ids);
  }
  _buildTabOrderUI();                   // as pílulas da própria tela voltam também
}

async function loadAndApplyTabOrder() {
  _fotografarOrdemDeFabrica();          // ANTES de aplicar a salva
  const r = await window.pywebview.api.load_tab_order();
  if (r.success && r.order && Object.keys(r.order).length) {
    _tabOrder = r.order;
    for (const key of Object.keys(_tabOrder)) {
      const ids = _tabOrder[key];
      if (ids && ids.length) _applyGroupOrderToDom(key, ids);
    }
  }
}

// Completa a ordem salva com os ids que existem no DOM e não estão nela, cada um
// na POSIÇÃO EM QUE FOI DECLARADO.
//
// Sem isto, uma sub-aba nova pula para a frente em quem já arrastou as abas
// alguma vez: o laço abaixo faz `appendChild` só dos ids do array salvo, então
// todos os antigos vão para o fim e o botão que ninguém salvou sobra em primeiro
// lugar. O defeito parece aleatório porque depende de um arquivo de configuração
// que a maioria não tem — quem nunca mexeu na ordem não vê nada.
//
// Genérica de propósito: vale para qualquer barra que ganhe um botão depois de o
// usuário já ter salvo uma ordem.
function _completarOrdemSalva(bar, navAttr, ids) {
  const noDom = [...bar.children]
    .filter(el => el.tagName === 'BUTTON' && el.dataset[navAttr])
    .map(el => el.dataset[navAttr]);
  // Um id salvo que sumiu do DOM (categoria removida) também não pode ficar.
  const completa = ids.filter(id => noDom.includes(id));
  // O ÍNDICE de declaração, não o vizinho de declaração: uma aba declarada por
  // último nasce por último, mesmo que o usuário tenha arrastado para a frente
  // aquela que vinha antes dela no código.
  noDom.forEach((id, i) => {
    if (completa.includes(id)) return;
    completa.splice(Math.min(i, completa.length), 0, id);
  });
  return completa;
}

function _applyGroupOrderToDom(key, ids) {
  const bar = document.querySelector(`[data-taborder-group="${key}"]`);
  if (!bar) return;
  const prefixo = bar.dataset.taborderPainel || '';
  const painel = id => document.getElementById(prefixo + id);
  const navAttr = _navAttrOfBar(bar);
  if (navAttr) {
    ids = _completarOrdemSalva(bar, navAttr, ids);
    if (!ids.length) return;
    ids.forEach(id => {
      const btn = [...bar.children].find(el => el.tagName === 'BUTTON' && el.dataset[navAttr] === id);
      if (btn) bar.appendChild(btn);
    });
  }
  const firstEl = painel(ids[0]);
  if (!firstEl) return;
  const parent = firstEl.parentElement;
  const elements = ids.map(painel).filter(el => el && el.parentElement === parent);
  if (!elements.length) return;
  // Ancora a reordenação no irmão que já vem logo depois do grupo, em vez de
  // usar appendChild (que jogaria o grupo pro fim do pai e deslocaria irmãos
  // "de fora" do grupo, como aconteceu com #chat-input-area no chat).
  const children = [...parent.children];
  const lastIndex = Math.max(...elements.map(el => children.indexOf(el)));
  const anchor = children[lastIndex + 1] || null;
  elements.forEach(el => parent.insertBefore(el, anchor));
}

function initConfigTab() {
  _buildTabOrderUI();

  // Delegado na raiz, e não botão a botão: a lista é remontada a cada
  // abertura da aba, e um listener por botão morria com a pílula antiga.
  const raiz = document.getElementById('taborder-root');
  if (raiz && !raiz._wiredExpand) {
    raiz._wiredExpand = true;
    raiz.addEventListener('click', e => {
      const btn = e.target.closest('.taborder-expand-btn');
      if (!btn) return;
      e.stopPropagation();
      const area = document.getElementById(btn.dataset.expand);
      if (!area) return;
      const estaAberto = !area.classList.contains('hidden');
      area.classList.toggle('hidden', estaAberto);
      btn.classList.toggle('open', !estaAberto);
      btn.textContent = estaAberto ? '▾' : '▴';
    });
  }

  const btnSave = document.getElementById('btn-save-tab-order');
  if (btnSave && !btnSave._wired) { btnSave._wired = true; btnSave.addEventListener('click', saveTabOrder); }

  // Os limites de tamanho por agente (caracteres) viraram um orçamento único
  // por tokens — ver frontend/modulos/limites.js.
  if (typeof initLimitesConfig === 'function') initLimitesConfig();
  if (typeof initFerramentasConfig === 'function') initFerramentasConfig();
  if (typeof initMcpConfig === 'function') initMcpConfig();
  if (typeof initConfigMcps === 'function') initConfigMcps();
  if (typeof initConfigRender === 'function') initConfigRender();
  if (typeof initConfigTema === 'function') initConfigTema();
  if (typeof initConfigExtensoes === 'function') initConfigExtensoes();
  if (typeof initConfigPreparar === 'function') initConfigPreparar();
  if (typeof initConfigAcervo === 'function') initConfigAcervo();
  if (typeof initConfigArquivos === 'function') initConfigArquivos();
  if (typeof initConfigBiblioteca === 'function') initConfigBiblioteca();
  if (typeof initConfigNotificacoes === 'function') initConfigNotificacoes();
  if (typeof initConfigAcessoRapido === 'function') initConfigAcessoRapido();
  if (typeof initConfigTeclado === 'function') initConfigTeclado();
  if (typeof initConfigEditor === 'function') initConfigEditor();
  if (typeof initConfigPlugins === 'function') initConfigPlugins();
  if (typeof initConfigAtalhosExternos === 'function') initConfigAtalhosExternos();
  if (typeof initConfigXtprog === 'function') initConfigXtprog();

  // Por último: só aqui todas as categorias já se registraram no trilho.
  if (typeof initConfigBusca === 'function') initConfigBusca();
  if (typeof initConfigCategorias === 'function') initConfigCategorias();
}

// Reordenação via mousedown/mousemove/mouseup em vez da API nativa de HTML5
// drag-and-drop: no WebView2 (motor usado pelo pywebview no Windows), dragstart/
// dragover não disparam de forma confiável (bug conhecido, sem correção da MS),
// então a API nativa não pode ser usada aqui.
// Quantos pixels o ponteiro tem de andar antes de aquilo virar um arraste. Sem
// isto, um clique com a mão tremida já reordena as abas — e o usuário não vê
// que reordenou, porque a pílula volta para debaixo do cursor.
const TABORDER_LIMIAR_ARRASTE = 4;

// Reparte as pílulas nas FILEIRAS que elas ocupam na tela. A `.taborder-row` é
// `flex-wrap: wrap`: com muitas abas ela quebra em duas ou três fileiras, e
// duas pílulas com o mesmo `x` podem estar em fileiras diferentes.
//
// A tolerância é metade da altura da pílula: todas têm a mesma altura, mas o
// arredondamento do layout varia em fração de pixel.
function _taborderFileiras(rowEl, dragEl) {
  const fileiras = [];
  for (const pill of rowEl.children) {
    if (pill === dragEl || !pill.classList.contains('taborder-pill')) continue;
    const box = pill.getBoundingClientRect();
    const fileira = fileiras.find(f => Math.abs(f.top - box.top) <= box.height / 2);
    if (fileira) {
      fileira.itens.push({ pill, box });
      if (box.bottom > fileira.bottom) fileira.bottom = box.bottom;
    } else {
      fileiras.push({ top: box.top, bottom: box.bottom, itens: [{ pill, box }] });
    }
  }
  return fileiras;
}

// Devolve a pílula ANTES da qual a arrastada deve entrar, ou `null` para o fim
// de tudo.
//
// ⚠️ Precisa do `y`, e não só do `x`. A versão antiga comparava apenas a
// horizontal: com a fileira quebrada em duas, uma pílula da fileira de baixo
// competia com uma da de cima pelo mesmo `x`, e o alvo pulava entre as duas a
// cada pixel — era isso que fazia o arraste "bugar" ao subir, e que tornava
// quase impossível largar na primeira ou na última posição.
function _pillAfterElement(rowEl, dragEl, x, y) {
  const fileiras = _taborderFileiras(rowEl, dragEl);
  if (!fileiras.length) return null;

  // A fileira sob o cursor. Acima da primeira ou abaixo da última, a mais
  // próxima — assim arrastar para fora do cartão ainda tem um alvo óbvio.
  let alvo = fileiras.find(f => y >= f.top && y <= f.bottom);
  if (!alvo) {
    alvo = fileiras.reduce((a, f) => (
      Math.abs(y - (f.top + f.bottom) / 2) < Math.abs(y - (a.top + a.bottom) / 2) ? f : a
    ));
  }

  // Dentro da fileira, a primeira pílula cujo meio está à direita do cursor.
  // As `itens` já estão da esquerda para a direita: vêm da ordem do DOM, que numa
  // linha flexiva sem `order` é a ordem visual.
  for (const { pill, box } of alvo.itens) {
    if (x < box.left + box.width / 2) return pill;
  }

  // Passou de todas as desta fileira: entra antes da primeira da fileira
  // seguinte (que é o fim visual desta), ou no fim de tudo se esta era a
  // última.
  const seguinte = fileiras[fileiras.indexOf(alvo) + 1];
  return seguinte ? seguinte.itens[0].pill : null;
}

function _initTabOrderDnd(rowEl) {
  rowEl.querySelectorAll('.taborder-pill').forEach(pill => {
    pill.addEventListener('mousedown', function(e) {
      if (e.button !== 0 || e.target.closest('.taborder-expand-btn')) return;
      e.preventDefault();
      const dragEl = this;
      const partiuDe = { x: e.clientX, y: e.clientY };
      let arrastando = false;

      function onMouseMove(e2) {
        if (!arrastando) {
          const andou = Math.abs(e2.clientX - partiuDe.x) + Math.abs(e2.clientY - partiuDe.y);
          if (andou < TABORDER_LIMIAR_ARRASTE) return;
          arrastando = true;
          dragEl.classList.add('dragging');
        }
        const after = _pillAfterElement(rowEl, dragEl, e2.clientX, e2.clientY);
        // ⚠️ Só mexe no DOM se o lugar mudou de verdade. Reinserir a pílula onde
        // ela já está refaz o layout de toda a fileira; como ela continua no
        // fluxo, isso reposiciona as vizinhas debaixo do cursor e o alvo do
        // próximo `mousemove` sai diferente — o tremido do arraste.
        if (after === dragEl.nextElementSibling) return;
        if (after == null) rowEl.appendChild(dragEl);
        else rowEl.insertBefore(dragEl, after);
      }
      function onMouseUp() {
        dragEl.classList.remove('dragging');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}

// ⚠️ FUNDE COM O QUE JÁ ESTÁ SALVO — não sobrescreve o arquivo inteiro. Este
// laço só enxerga os grupos que estão MONTADOS na tela agora, e a tela de Ordem
// das abas monta um grupo por barra existente no DOM. Uma barra que ainda não
// nasceu (uma aba que só é injetada ao abrir a área dela) simplesmente não tem
// linha aqui — e a versão anterior gravava o objeto cru, apagando a ordem dela
// do `ordem-das-abas.json` sem ninguém pedir.
//
// Não causava dano visível porque `_completarOrdemSalva` reinsere o que sumiu,
// mas o arquivo deixava de ser o registro do que o usuário escolheu — e o
// próximo a ler aquele JSON acreditaria nele.
async function saveTabOrder() {
  const order = Object.assign({}, _tabOrder);
  document.querySelectorAll('#taborder-root .taborder-row').forEach(rowEl => {
    const key = rowEl.id.replace(/^order-/, '');
    order[key] = [...rowEl.querySelectorAll('.taborder-pill')].map(p => p.dataset.id);
  });
  const r = await window.pywebview.api.save_tab_order(order);
  if (r.success) {
    _tabOrder = order;
    for (const key of Object.keys(order)) _applyGroupOrderToDom(key, order[key]);
    showToast('Ordem salva e aplicada!');
  } else {
    showToast('Erro ao salvar ordem.', true);
  }
}

