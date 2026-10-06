// ═══ ARQUIVOS → o editor de um AGENTE ═════════════════════════════════════
//
// O único item da biblioteca que se escreve PELA TELA, e a exceção é
// deliberada. O comentário ⛔ de `renderGlobalArquivosCategory` conta que os
// botões "⚙ formatar" e "＋ criar" saíram de propósito: desde que qualquer
// pasta com arquivo solto dentro já é um item, criar pela tela virou o caminho
// longo para o que arrastar uma pasta faz num segundo.
//
// ⚠️ COM AGENTE ISSO NÃO VALE, E É POR ISSO QUE O BOTÃO VOLTOU AQUI. Arrastar
// uma pasta não escreve frontmatter. Um agente é um `.md` cujo cabeçalho decide
// COISAS: a `description` é o que faz o assistente acioná-lo sozinho, e o
// `tools` é a permissão dele. Errar uma vírgula ali não dá erro — dá um agente
// que nunca é chamado, ou um que pode tudo. Nenhuma dessas duas falhas aparece
// na tela, e é exatamente por isso que a tela precisa escrever o arquivo.
//
// ⚠️ SÓ NA BIBLIOTECA GLOBAL, nunca na aba do projeto. Lá dentro de um projeto
// a aba Arquivos liga e desliga o que a biblioteca tem — editar por lá faria a
// mesma biblioteca ser escrita de dois lugares, e um deles com o projeto no
// meio sugerindo que a edição é "daquele projeto". Ela nunca é.
//
// ⚠️ O EDITOR MORA NO PAINEL QUE JÁ EXISTE. `.import-expand` é o mesmo lugar
// onde a lista de arquivos do item aparece; o clique no cartão é o mesmo gesto.
// É o que os Padrões de interface deste projeto mandam para lista de item
// configurável: editar é INLINE no cartão, e nunca um modal que tranca a tela.

// O cartão que está sendo criado agora (ainda não existe em disco). Um por vez.
let arqAgenteNovo = null;

function arqEhEditorDeAgente(kind, isProjeto) {
  return kind && kind.key === 'agentes' && !isProjeto;
}

// ── O formulário ────────────────────────────────────────────────────────────

async function arqEditorDeAgente(panel, item) {
  const novo = !item || !item.name;
  const dados = novo
    ? { grupo: '', rotulo: '', description: '', tools: '', model: 'inherit',
        corpo: '', outros_campos: {} }
    : await window.pywebview.api.ler_agente(item.name);

  if (!novo && !dados.success) {
    panel.innerHTML = `<div class="arq-expand-empty">${escapeHtml(dados.error || 'Erro.')}</div>`;
    return;
  }

  const gr = await window.pywebview.api.grupos_de_agente();
  const existentes = (gr && gr.existentes) || [];

  panel.innerHTML = `
    <div class="arq-ag-editor" data-item-original="${escapeHtml(novo ? '' : item.name)}">
      <div class="ag-campo">
        <label>Subpasta — opcional</label>
        <input type="text" class="arq-ag-grupo-campo" list="arq-ag-grupos-conhecidos"
               placeholder="deixe em branco para guardar solto em Agentes/"
               ${novo ? '' : 'disabled'}>
        <datalist id="arq-ag-grupos-conhecidos">
          ${existentes.map(a => `<option value="${escapeHtml(a)}"></option>`).join('')}
        </datalist>
        <div class="arq-ag-dica">É só uma gaveta para organizar a biblioteca. Quem decide
          para onde o arquivo vai ao ligar num projeto é o preset daquele projeto — não
          esta pasta.</div>
      </div>

      <div class="ag-campo">
        <label>Nome</label>
        <input type="text" class="arq-ag-nome" placeholder="Revisor de segurança"
               ${novo ? '' : 'disabled'}>
        ${novo ? '' : `<div class="arq-ag-dica">O nome não muda depois de criado: ele está
          gravado na lista de ativados de cada projeto que ligou este agente.</div>`}
      </div>

      <div class="ag-campo">
        <label>Descrição — é ela que faz o assistente acionar este agente sozinho</label>
        <textarea class="arq-ag-descricao" rows="3"
          placeholder="Use quando… — diga em que situação este agente deve entrar."></textarea>
      </div>

      <div class="ag-campo">
        <label>Ferramentas</label>
        <div class="arq-ag-ferramentas"></div>
      </div>

      <div class="ag-campo">
        <label>Modelo</label>
        <select class="arq-ag-modelo">
          <option value="inherit">O mesmo da sessão (inherit)</option>
          <option value="haiku">haiku</option>
          <option value="sonnet">sonnet</option>
          <option value="opus">opus</option>
          <option value="">não dizer nada</option>
        </select>
      </div>

      <div class="ag-campo">
        <label>O que ele deve fazer — vai inteiro para dentro do arquivo</label>
        <textarea class="arq-ag-corpo" rows="10"
          placeholder="Você é…&#10;&#10;## O que você faz&#10;…"></textarea>
      </div>

      <div class="arq-ag-acoes">
        <button type="button" class="btn btn-primary btn-xs arq-ag-salvar">Salvar agente</button>
        ${novo ? '<button type="button" class="btn btn-muted btn-xs arq-ag-cancelar">Cancelar</button>' : ''}
        <span class="arq-ag-recado"></span>
      </div>
    </div>`;

  const raiz = panel.querySelector('.arq-ag-editor');
  const campoGrupo = raiz.querySelector('.arq-ag-grupo-campo');
  const nome = raiz.querySelector('.arq-ag-nome');

  // ⚠️ VAZIO É UM VALOR LEGÍTIMO — quer dizer "solto na raiz de Agentes", que é
  // como o Claude Code guarda os dele. Por isso é um campo de texto com
  // sugestões (`datalist`), e não um `<select>`: um seletor obrigaria a
  // escolher uma gaveta que na maioria das vezes não deveria existir.
  if (!novo) {
    campoGrupo.value = dados.grupo || '';
    nome.value = dados.rotulo || '';
  }
  raiz.querySelector('.arq-ag-descricao').value = dados.description || '';
  raiz.querySelector('.arq-ag-corpo').value = dados.corpo || '';
  const modelo = raiz.querySelector('.arq-ag-modelo');
  if (![...modelo.options].some(o => o.value === (dados.model || ''))) {
    modelo.insertAdjacentHTML('beforeend',
      `<option value="${escapeHtml(dados.model)}">${escapeHtml(dados.model)}</option>`);
  }
  modelo.value = dados.model || '';

  raiz._outros = dados.outros_campos || {};

  // ⚠️ SEM ASSISTENTE PARA CONSULTAR. A lista de caixas dependia da pasta do
  // assistente, e a pasta deixou de existir — a subpasta de hoje é só uma
  // gaveta, e "Backend" não é um produto com lista de ferramentas própria.
  // Passar `null` devolve o catálogo padrão, que é o do Claude Code.
  await arqPintarFerramentas(raiz, null, dados.tools || '');

  raiz.querySelector('.arq-ag-salvar').addEventListener('click', () => arqSalvarAgente(raiz));
  const cancelar = raiz.querySelector('.arq-ag-cancelar');
  if (cancelar) cancelar.addEventListener('click', () => { arqAgenteNovo = null; initGlobalArquivosTab(); });
  if (novo) nome.focus();
}

// ── As caixas de ferramenta ─────────────────────────────────────────────────
//
// ⚠️ CAIXAS **E** CAMPO LIVRE, e os dois são obrigatórios. Só texto livre
// transforma um erro de digitação em permissão errada silenciosa; só caixas
// envelhece no dia em que o produto ganhar uma ferramenta, e não cobre
// `mcp__servidor__nome`, que é conjunto aberto. O porquê de cada metade está em
// `catalogo_ferramentas_de_agente.py`.

async function arqPintarFerramentas(raiz, assistente, valorAtual) {
  const caixa = raiz.querySelector('.arq-ag-ferramentas');
  const r = await window.pywebview.api.ferramentas_de_agente(assistente);
  const escolhidas = String(valorAtual || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const conhecidas = new Set();
  (r.grupos || []).forEach(g => g.itens.forEach(i => conhecidas.add(i.id)));
  const sobrando = escolhidas.filter(x => !conhecidas.has(x));

  // ⚠️ UM PAR POR GRUPO, e não um par só para os dois. Os grupos são de
  // naturezas diferentes — "Do assistente" são as embutidas, escritas à mão;
  // "Deste programa (MCP)" são derivadas do catálogo em execução — e um par
  // único obrigaria a desmarcar 14 caixas para limitar o agente às do MCP.
  //
  // Modelo visual: os dois botões da fileira de `config-preparar.js`
  // (`btn btn-muted btn-sm`), que são o único par desse tipo no programa.
  const grupos = (r.grupos || []).filter(g => g.itens.length).map((g, gi) => {
    const marcadas = g.itens.filter(i => escolhidas.includes(i.id)).length;
    return `
    <div class="arq-ag-grupo" data-ag-grupo="${gi}">
      <div class="arq-ag-grupo-h">
        <div class="arq-ag-grupo-t">${escapeHtml(g.titulo)}
          <span class="arq-ag-cnt${marcadas ? ' on' : ''}">${marcadas}/${g.itens.length}</span>
        </div>
        <div class="arq-ag-grupo-acoes">
          <button type="button" class="btn btn-muted btn-sm" data-ag-todas="${gi}">Marcar todas</button>
          <button type="button" class="btn btn-muted btn-sm" data-ag-limpar="${gi}">Limpar</button>
        </div>
      </div>
      <div class="arq-ag-caixas">
        ${g.itens.map(i => `
          <label class="arq-ag-caixa" title="${escapeHtml(i.rotulo || '')}">
            <input type="checkbox" value="${escapeHtml(i.id)}"
                   ${escolhidas.includes(i.id) ? 'checked' : ''}>
            <span>${escapeHtml(i.id)}</span>
          </label>`).join('')}
      </div>
    </div>`;
  }).join('');

  caixa.innerHTML = `
    ${r.declarada ? '' : `<div class="arq-ag-aviso">Não temos a lista de ferramentas
      deste assistente — ela é de um produto de fora, e inventá-la faria você marcar
      caixas que não limitam nada. Escreva os nomes à mão abaixo.</div>`}
    ${grupos}
    <div class="arq-ag-grupo">
      <div class="arq-ag-grupo-t">Outras, escritas à mão — uma por vírgula</div>
      <input type="text" class="arq-ag-outras" value="${escapeHtml(sobrando.join(', '))}"
             placeholder="mcp__outro-servidor__ferramenta">
    </div>
    <div class="arq-ag-herda"></div>`;

  const atualizar = () => { arqAtualizarAvisoDeHerdar(raiz); arqPintarContagensDeGrupo(raiz); };
  caixa.querySelectorAll('input').forEach(i => {
    i.addEventListener('change', atualizar);
    i.addEventListener('input', atualizar);
  });

  // Delegado na caixa: os grupos são remontados a cada abertura do editor, e um
  // ouvinte por botão morreria junto com o `innerHTML`.
  caixa.addEventListener('click', e => {
    const todas = e.target.closest('[data-ag-todas]');
    const limpar = e.target.closest('[data-ag-limpar]');
    if (!todas && !limpar) return;
    const gi = (todas || limpar).dataset.agTodas || (limpar || {}).dataset.agLimpar;
    const grupo = caixa.querySelector(`[data-ag-grupo="${gi}"]`);
    if (!grupo) return;
    grupo.querySelectorAll('.arq-ag-caixa input').forEach(i => { i.checked = !!todas; });
    atualizar();
  });

  atualizar();
}

// A contagem de cada grupo, refeita a cada mudança. ⚠️ Só o número muda — as
// caixas NÃO são redesenhadas, senão o clique perderia o foco da que acabou de
// ser marcada.
function arqPintarContagensDeGrupo(raiz) {
  raiz.querySelectorAll('[data-ag-grupo]').forEach(grupo => {
    const caixas = [...grupo.querySelectorAll('.arq-ag-caixa input')];
    const n = caixas.filter(i => i.checked).length;
    const cnt = grupo.querySelector('.arq-ag-cnt');
    if (!cnt) return;
    cnt.textContent = `${n}/${caixas.length}`;
    cnt.classList.toggle('on', n > 0);
  });
}

function arqFerramentasEscolhidas(raiz) {
  const marcadas = [...raiz.querySelectorAll('.arq-ag-caixa input:checked')].map(i => i.value);
  const livres = (raiz.querySelector('.arq-ag-outras') || {}).value || '';
  const extras = livres.split(',').map(s => s.trim()).filter(Boolean);
  return [...new Set([...marcadas, ...extras])].join(', ');
}

// ⚠️ O AVISO É A METADE QUE IMPORTA DESTE CAMPO. Nenhuma caixa marcada NÃO
// significa "nenhuma ferramenta" — significa que a chave `tools` não vai para o
// arquivo, e quem omite `tools` HERDA TODAS. Deixar o campo vazio sem dizer isso
// seria a tela insinuando um agente inofensivo onde há um com acesso total.
// As palavras são as mesmas do cartão (`arqFerramentasDoAgente`), de propósito.
function arqAtualizarAvisoDeHerdar(raiz) {
  const alvo = raiz.querySelector('.arq-ag-herda');
  if (!alvo) return;
  const vazio = !arqFerramentasEscolhidas(raiz);
  alvo.className = 'arq-ag-herda' + (vazio ? ' arq-ag-herda-on' : '');
  alvo.textContent = vazio
    ? '🛠 Nada marcado: este agente herda TODAS as ferramentas da sessão.'
    : '🛠 Este agente fica limitado ao que está marcado.';
}

// ── Gravar ──────────────────────────────────────────────────────────────────

async function arqSalvarAgente(raiz) {
  const recado = raiz.querySelector('.arq-ag-recado');
  const original = raiz.dataset.itemOriginal || null;
  // ⚠️ TUDO LIDO DA TELA, nunca do que veio do disco — é a regra registrada nos
  // Padrões de interface depois de um defeito real em Configurações: gravar a
  // partir do objeto carregado descartava em silêncio o que estava digitado.
  const dados = {
    grupo: raiz.querySelector('.arq-ag-grupo-campo').value,
    nome: raiz.querySelector('.arq-ag-nome').value,
    description: raiz.querySelector('.arq-ag-descricao').value,
    tools: arqFerramentasEscolhidas(raiz),
    model: raiz.querySelector('.arq-ag-modelo').value,
    corpo: raiz.querySelector('.arq-ag-corpo').value,
    outros_campos: raiz._outros || {},
  };

  recado.textContent = 'Gravando…';
  recado.className = 'arq-ag-recado';
  const r = await window.pywebview.api.salvar_agente(dados, original);
  if (!r || !r.success) {
    recado.textContent = (r && r.error) || 'Não deu para gravar.';
    recado.className = 'arq-ag-recado arq-ag-recado-erro';
    return;
  }
  arqAgenteNovo = null;
  showToast(original ? 'Agente salvo.' : `Agente "${dados.nome}" criado.`);
  // Repinta a biblioteca (global), que é de onde o editor foi aberto. A tela do
  // projeto se atualiza sozinha na próxima vez que for aberta.
  initGlobalArquivosTab();
}

// ── Criar ───────────────────────────────────────────────────────────────────

// ⚠️ `garq-`, E NÃO `arq-`. O editor de agente só existe na tela GLOBAL de
// Arquivos — a de dentro do projeto apenas liga e desliga o que a biblioteca
// tem. Mirando no id da tela do projeto, o clique caía no `return` da linha
// seguinte quando aquela tela não estava montada, e nascia na aba errada
// quando estava.
function arqNovoAgente() {
  const container = document.getElementById('garq-agentes-list');
  if (!container || document.querySelector('.arq-ag-editor[data-item-original=""]')) return;

  // O cartão nasce ABERTO — um item novo que aparece fechado parece não ter
  // acontecido. Também é o que os Padrões de interface mandam.
  const card = document.createElement('div');
  card.className = 'import-card arq-ag-card-novo';
  card.innerHTML = `
    <div class="import-row">
      <div class="import-left">
        <span class="import-caret open">▸</span>
        <span class="import-icon">🤖</span>
        <div class="import-body"><div class="import-name">Agente novo</div></div>
      </div>
    </div>
    <div class="import-expand"></div>`;
  container.insertBefore(card, container.firstChild);
  arqAgenteNovo = card;
  arqEditorDeAgente(card.querySelector('.import-expand'), null);
}
