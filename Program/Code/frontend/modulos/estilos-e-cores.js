// ═══════════════════════ ABA ARQUIVOS · categoria ESTILOS E CORES ══
//
// A 6ª categoria, só na biblioteca global (tela de Projetos). Dentro de um
// projeto ela não existe: lá quem escolhe estilo e paleta é o Designer.
//
// Cinco dimensões na ORDEM CANÔNICA — Estilos · Cores · Tipografia · Texturas e
// materiais · Animações —, que vem do backend em vez de ser repetida aqui: duas
// cópias divergiriam na primeira vez que uma delas mudasse de rótulo. As quatro
// primeiras se organizam por TAG; Animações, por PASTA de evento, e sem tag.

let ecDimensoes = [];        // a tabela, como o backend a declara
let ecDimensaoAtiva = '';    // chave da pílula aberta
let ecCache = {};            // chave -> resposta inteira da listagem
let ecTagAtiva = {};         // chave -> tag do filtro ('' = todas)

function ecDimensao(chave) {
  return ecDimensoes.find(d => d.chave === chave) || null;
}

async function initEstilosECoresCategoria() {
  const caixa = document.getElementById('garq-estilos-e-cores-list');
  if (!caixa) return;
  if (!ecDimensoes.length) {
    const r = await window.pywebview.api.carregar_dimensoes_de_estilos_e_cores();
    ecDimensoes = (r && r.success) ? r.dimensoes : [];
    if (!ecDimensaoAtiva && ecDimensoes.length) ecDimensaoAtiva = ecDimensoes[0].chave;
  }
  await ecAbrirDimensao(ecDimensaoAtiva, true);
}

// Uma chamada por dimensão, e ela já traz nome + conteúdo + tags de TODOS os
// itens. É o que evita as 70+ idas e voltas pela ponte que congelavam a janela
// quando o conteúdo era buscado item a item.
async function ecAbrirDimensao(chave, recarregar) {
  ecDimensaoAtiva = chave;
  if (recarregar || !ecCache[chave]) {
    const r = await window.pywebview.api.carregar_estilos_e_cores(chave);
    if (!r || !r.success) { showToast((r && r.error) || 'Erro ao ler a biblioteca.', true); return; }
    ecCache[chave] = r;
  }
  ecRenderizar();
}

function ecRenderizar() {
  const caixa = document.getElementById('garq-estilos-e-cores-list');
  const dados = ecCache[ecDimensaoAtiva];
  if (!caixa || !dados) return;
  ecSoltarMiniaturas(caixa);
  caixa.innerHTML = '';
  caixa.appendChild(ecBarraDeDimensoes());
  if (dados.tem_tag) caixa.appendChild(ecBarraDeTags(dados));
  caixa.appendChild(dados.por_pasta ? ecGrupos(dados) : ecLista(dados));
}

// Reusa `.arq-inner-tabs` e `.arq-topo` — as mesmas pílulas e a mesma linha de
// topo das outras cinco categorias. É a mesma natureza de escolha, e dois
// desenhos para ela fariam parecer coisas diferentes.
function ecBarraDeDimensoes() {
  const topo = document.createElement('div');
  topo.className = 'arq-topo';
  const pilulas = document.createElement('div');
  pilulas.className = 'arq-inner-tabs';
  for (const d of ecDimensoes) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'arq-inner-tab' + (d.chave === ecDimensaoAtiva ? ' active' : '');
    // Sem contador aqui de propósito: só a dimensão aberta foi lida do disco, e
    // um número que aparece na pílula depois que você a visita parece defeito.
    // A contagem que interessa — quantos itens cada tag tem — está na barra
    // abaixo, e essa é sempre exata.
    botao.textContent = d.rotulo;
    botao.addEventListener('click', () => ecAbrirDimensao(d.chave));
    pilulas.appendChild(botao);
  }
  topo.appendChild(pilulas);
  topo.appendChild(ecBarraDeAcoes());
  return topo;
}

function ecBarraDeAcoes() {
  const dados = ecCache[ecDimensaoAtiva];
  const singular = dados ? dados.singular : 'item';
  const acoes = document.createElement('div');
  acoes.className = 'ec-acoes';
  acoes.innerHTML = `
    <button type="button" class="btn btn-muted btn-sm ec-formatar" title="Configurar um arquivo que você jogou na pasta na mão">⚙ formatar</button>
    <button type="button" class="btn btn-special btn-sm ec-criar">＋ criar ${escapeHtml(singular)}</button>
    ${dados && dados.tem_tag ? '<button type="button" class="btn btn-muted btn-sm ec-gerenciar-tags">◈ gerenciar tags</button>' : ''}`;
  acoes.querySelector('.ec-formatar').addEventListener('click', ecFormatarItem);
  acoes.querySelector('.ec-criar').addEventListener('click', ecCriarItem);
  const tags = acoes.querySelector('.ec-gerenciar-tags');
  if (tags) tags.addEventListener('click', ecAbrirGerenciadorDeTags);
  return acoes;
}

// A tag funciona como pasta: escolher uma troca o conteúdo da lista inteira.
// "todas" é sempre a primeira opção e nunca some — sem ela não há como voltar.
function ecBarraDeTags(dados) {
  const barra = document.createElement('div');
  barra.className = 'ec-tagbar';
  const ativa = ecTagAtiva[dados.dimensao] || '';
  const contar = tag => dados.itens.filter(i => !tag || i.tags.includes(tag)).length;

  const rotulo = document.createElement('span');
  rotulo.className = 'ec-tagbar-rot';
  rotulo.textContent = 'Tags:';
  barra.appendChild(rotulo);

  // Só as tags que existem NESTA dimensão. A tag é um bloco próprio no
  // `tags.json` para poder existir sem item nenhum, mas aqui ela é PASTA — e
  // pasta vazia é botão morto: clicar mostra lista em branco e não explica por
  // quê. A lista completa está no gerenciador de tags, que é onde ela pertence.
  // A tag ativa nunca some, senão não haveria como voltar para "todas".
  const usadas = dados.tags.filter(t => t === ativa || dados.itens.some(i => i.tags.includes(t)));

  for (const tag of ['', ...usadas]) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'ec-tagpasta' + (tag === ativa ? ' active' : '');
    botao.innerHTML = escapeHtml(tag || 'todas') + `<span class="ec-tagpasta-cnt">${contar(tag)}</span>`;
    botao.addEventListener('click', () => { ecTagAtiva[dados.dimensao] = tag; ecRenderizar(); });
    barra.appendChild(botao);
  }
  return barra;
}

function ecLista(dados) {
  const lista = document.createElement('div');
  lista.className = 'ec-lista';
  const ativa = ecTagAtiva[dados.dimensao] || '';
  const itens = dados.itens.filter(i => !ativa || i.tags.includes(ativa));
  if (!itens.length) {
    lista.appendChild(ecVazio(dados, ativa));
    return lista;
  }
  for (const item of itens) lista.appendChild(ecCard(dados, item));
  return lista;
}

// Animações: um bloco por pasta de evento, com o `Explicação.md` à vista. É ele
// que diz ONDE aquele movimento se aplica — sem isso o modelo pega a animação de
// troca de aba e espalha pela interface inteira.
function ecGrupos(dados) {
  const area = document.createElement('div');
  area.className = 'ec-lista';
  if (!dados.grupos.length) { area.appendChild(ecVazio(dados, '')); return area; }
  for (const grupo of dados.grupos) {
    const bloco = document.createElement('div');
    bloco.className = 'ec-grupo';
    bloco.innerHTML = `
      <div class="ec-grupo-cab">
        <span class="ec-grupo-nome">📁 ${escapeHtml(grupo.pasta)}</span>
        <span class="ec-grupo-cnt">${grupo.itens.length} ${grupo.itens.length === 1 ? 'animação' : 'animações'}</span>
      </div>
      ${grupo.explicacao ? `<div class="ec-grupo-onde">${escapeHtml(ecPrimeiraFrase(grupo.explicacao))}</div>` : ''}`;
    const itens = document.createElement('div');
    itens.className = 'ec-grupo-itens';
    for (const item of grupo.itens) itens.appendChild(ecCard(dados, item));
    bloco.appendChild(itens);
    area.appendChild(bloco);
  }
  return area;
}

// O `Explicação.md` abre com título e a linha que importa vem logo abaixo dele.
// A marcação de ênfase sai: o texto entra como conteúdo de um `<div>`, e `**por
// cima**` apareceria com os asteriscos à vista.
function ecPrimeiraFrase(texto) {
  for (const linha of texto.split('\n')) {
    const limpa = linha.trim();
    if (limpa && !limpa.startsWith('#')) {
      return limpa.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1');
    }
  }
  return '';
}

function ecCard(dados, item) {
  const card = document.createElement('div');
  card.className = 'import-card ec-card';
  card.innerHTML = `
    <div class="import-row">
      <div class="import-left">
        <div class="ec-mini ec-mini-${escapeHtml(dados.dimensao)}"></div>
        <div class="import-body">
          <div class="import-name">${escapeHtml(item.nome)}
            <span class="ec-tags">${item.tags.map(t => `<span class="ec-tag">${escapeHtml(t)}</span>`).join('')}</span>
          </div>
          ${item.descricao ? `<div class="import-desc">${escapeHtml(item.descricao)}</div>` : ''}
        </div>
      </div>
      <div class="import-actions">
        ${dados.tem_tag ? '<button type="button" class="arq-mini-btn ec-editar-tags">◈ tags</button>' : ''}
        <button type="button" class="arq-mini-btn arq-del-btn" title="Remover da biblioteca">✕ remover</button>
      </div>
    </div>`;
  ecAgendarMiniatura(card.querySelector('.ec-mini'), dados.dimensao, item);
  const tags = card.querySelector('.ec-editar-tags');
  if (tags) tags.addEventListener('click', () => ecEditarTagsDoItem(dados, item));
  card.querySelector('.arq-del-btn').addEventListener('click', () => ecRemoverItem(dados, item));
  return card;
}

function ecVazio(dados, tagAtiva) {
  const vazio = document.createElement('div');
  vazio.className = 'arq-empty';
  vazio.innerHTML = tagAtiva
    ? `Nenhum item com a tag <code>${escapeHtml(tagAtiva)}</code> nesta dimensão.`
    : `Nada em <code>Arquivos/Estilos e cores/${escapeHtml(dados.rotulo)}/</code>.<br>
       Cada <strong>arquivo</strong> ali vira um item — aqui não são pastas.`;
  return vazio;
}

// ── Ações ────────────────────────────────────────────────────────────────────

function ecCampoDePasta(dados) {
  if (!dados.por_pasta) return '';
  const pastas = dados.grupos.map(g =>
    `<option value="${escapeHtml(g.pasta)}">${escapeHtml(g.pasta)}</option>`).join('');
  return `<label>Pasta de evento</label><select class="modal-select" data-f="pasta">${pastas}</select>`;
}

function ecCriarItem() {
  const dados = ecCache[ecDimensaoAtiva];
  if (!dados) return;
  abrirModalPadrao({
    title: `Criar ${dados.singular}`,
    confirmLabel: 'Criar',
    bodyHtml: `
      ${ecCampoDePasta(dados)}
      <label>Nome</label>
      <input type="text" data-f="nome" placeholder="nome do ${escapeHtml(dados.singular)}">
      <label>Descrição</label>
      <input type="text" data-f="descricao" placeholder="uma linha do que é">
      <div class="modal-body-text">Vira o arquivo <code>${escapeHtml(dados.rotulo)}/&lt;nome&gt;${escapeHtml(dados.extensao)}</code>, já no molde da dimensão.</div>`,
    onConfirm: async (ov, showErr) => {
      const nome = ov.querySelector('[data-f="nome"]').value.trim();
      const descricao = ov.querySelector('[data-f="descricao"]').value.trim();
      const campoPasta = ov.querySelector('[data-f="pasta"]');
      const r = await window.pywebview.api.criar_item_de_estilos_e_cores(
        dados.dimensao, nome, descricao, campoPasta ? campoPasta.value : '');
      if (!r || !r.success) { showErr((r && r.error) || 'Erro ao criar.'); return false; }
      showToast(`"${nome}" criado.`);
      ecAbrirDimensao(dados.dimensao, true);
      return true;
    },
  });
}

// "Formatar" aqui é adotar um arquivo que você largou na pasta na mão: põe nele
// os campos que a biblioteca lê, sem sobrescrever o que já estava preenchido.
function ecFormatarItem() {
  const dados = ecCache[ecDimensaoAtiva];
  if (!dados) return;
  const todos = dados.por_pasta
    ? dados.grupos.flatMap(g => g.itens)
    : dados.itens;
  if (!todos.length) {
    showToast(`Nenhum arquivo em ${dados.rotulo} para formatar.`, true);
    return;
  }
  const opcoes = todos.map(i =>
    `<option value="${escapeHtml(i.caminho)}">${escapeHtml(i.pasta ? i.pasta + ' / ' + i.nome : i.nome)}</option>`).join('');
  abrirModalPadrao({
    title: `Formatar ${dados.singular}`,
    confirmLabel: 'Formatar',
    bodyHtml: `
      <label>Arquivo existente</label>
      <select class="modal-select" data-f="caminho">${opcoes}</select>
      <label>Descrição</label>
      <input type="text" data-f="descricao" placeholder="uma linha do que é">`,
    onConfirm: async (ov, showErr) => {
      const caminho = ov.querySelector('[data-f="caminho"]').value;
      const escolhido = todos.find(i => i.caminho === caminho);
      const r = await window.pywebview.api.formatar_item_de_estilos_e_cores(
        dados.dimensao, escolhido.arquivo,
        ov.querySelector('[data-f="descricao"]').value.trim(), escolhido.pasta || '');
      if (!r || !r.success) { showErr((r && r.error) || 'Erro ao formatar.'); return false; }
      showToast(`"${escolhido.nome}" formatado.`);
      ecAbrirDimensao(dados.dimensao, true);
      return true;
    },
  });
}

function ecRemoverItem(dados, item) {
  abrirModalPadrao({
    title: `Remover ${dados.singular}?`,
    confirmLabel: 'Remover',
    bodyHtml: `<div class="modal-body-text">Isto apaga o arquivo <code>${escapeHtml(item.caminho)}</code> da biblioteca. Não dá pra desfazer.</div>`,
    onConfirm: async (ov, showErr) => {
      const r = await window.pywebview.api.deletar_item_de_estilos_e_cores(
        dados.dimensao, item.arquivo, item.pasta || '');
      if (!r || !r.success) { showErr((r && r.error) || 'Erro ao remover.'); return false; }
      showToast(`"${item.nome}" removido.`);
      ecAbrirDimensao(dados.dimensao, true);
      return true;
    },
  });
}
