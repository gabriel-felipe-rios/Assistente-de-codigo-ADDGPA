// ══ TELA PROJETOS → aba Arquivos (a biblioteca GLOBAL) ════════════════════
//
// A mesma biblioteca, vista de fora de qualquer projeto.
//
// ⚠️ AQUI NÃO EXISTE "LIGAR". Ligar um item é copiá-lo para dentro de um
// projeto, e nesta tela não há projeto — o card global mostra o que existe e
// deixa editar, e nada mais. É essa a diferença com `_arqCardProjeto`, na
// casca, e é por isso que os dois cards são dois.
//
// ⚠️ `GARQ_KINDS` NÃO É `ARQ_KINDS`. A tela global mostra categorias que a do
// projeto não mostra (e vice-versa); igualar as duas listas faria aparecer aqui
// uma categoria cujo card sabe ligar — sem ter onde.

// ══════════════════════════════════════════════════════ TELA: PROJETOS — ABA ARQUIVOS (global) ══
const GARQ_KINDS = [
  { key: 'skills',         listId: 'garq-skills-list',         icon: '📄', label: 'skill',         emptyPath: 'Arquivos/Skills/',         origem: true, split: true },
  { key: 'comandos',       listId: 'garq-comandos-list',       icon: '⌨️', label: 'comando',       emptyPath: 'Arquivos/Comandos/',       origem: true, split: true },
  { key: 'mcps',           listId: 'garq-mcps-list',           icon: '🔌', label: 'MCP',           emptyPath: 'Arquivos/MCPs/',           origem: true, split: true },
  { key: 'codigos',           listId: 'garq-codigos-list',           icon: '💻', label: 'código pronto',      emptyPath: 'Arquivos/Códigos prontos/' },
  { key: 'regras-instrucoes', listId: 'garq-regras-instrucoes-list', icon: '📌', label: 'regra ou instrução', emptyPath: 'Arquivos/Regras e instruções/', origem: true, split: true },
  { key: 'instrucoes-base',   listId: 'garq-instrucoes-base-list',   icon: '📘', label: 'instrução base',    emptyPath: 'Arquivos/Instruções base/' },
  { key: 'agentes',           listId: 'garq-agentes-list',           icon: '🤖', label: 'agente',            emptyPath: 'Arquivos/Agentes/' },
  // `proprio`: a categoria tem caminho de listagem e CRUD próprios, e o laço
  // abaixo só a delega. Os itens dela são ARQUIVOS soltos, e `list_arquivos` só
  // enxerga pasta. Está só aqui, e não em ARQ_KINDS: é a biblioteca global de
  // aparência, e dentro de um projeto quem escolhe estilo e paleta é o Designer.
  { key: 'estilos-e-cores', listId: 'garq-estilos-e-cores-list', icon: '🎨', label: 'item de aparência', emptyPath: 'Arquivos/Estilos e cores/', proprio: true },
];

async function initGlobalArquivosTab() {
  // A sub-aba "Como adicionar" não é uma categoria: não tem item, e por isso
  // fica FORA do laço abaixo. Ela relê `prompts/Como adicionar/` a cada
  // abertura — editar um prompt lá vale sem reiniciar — e só redesenha quando o
  // texto mudou; esta função roda a cada clique na aba.
  if (typeof cadMontarPainel === 'function') cadMontarPainel();

  for (const kind of GARQ_KINDS) {
    if (kind.proprio) { if (typeof initEstilosECoresCategoria === 'function') initEstilosECoresCategoria(); continue; }
    const r = await window.pywebview.api.list_arquivos(kind.key);
    renderGlobalArquivosCategory(kind, r.success ? r.items : []);
  }
}

// ⛔ Aqui vivia `_garqLigarVisoesDeAgente`, o alternador entre a lista de
// agentes e o formulário do assistente externo. Ele saiu em 2026-09-02, com o
// formulário: o assistente externo virou uma categoria de Configurações, e a
// sub-aba Agentes voltou a ter UMA visão só (D16).
//
// ⚠️ Ele chamava `initArquivosAssistentes` atrás de um `typeof`, e é por isso
// que nada quebrava visivelmente quando metade da tela sumia — o recurso
// simplesmente desaparecia. Se aparecer outra referência àquele nome, é resto.

function renderGlobalArquivosCategory(kind, items) {
  const container = document.getElementById(kind.listId);
  if (!container) return;
  // ⚠️ A BARRA DE AGENTES VAI DENTRO DO PAINEL, à direita do trilho — é onde as
  // pílulas de todas as outras categorias nascem (`_arqRenderSemTrilho` recebe
  // o painel, não o container). Fora dele ela virava uma faixa da largura
  // inteira ACIMA do trilho, deixando um retângulo vazio ao lado — e a sub-aba
  // Agentes era a única com essa silhueta.
  //
  // O elemento é o do template, estável: `_arqComTrilho` o MOVE para dentro do
  // painel a cada pintura, e por isso os ouvintes e a visão escolhida
  // atravessam as repinturas. Ver o ⚠️ de `_arqComTrilho`.
  //
  // ⚠️ A guarda `naLista` que existia aqui saiu junto com a segunda visão: não
  // há mais para onde a lista se esconder, então a barra é sempre a da vez.
  const topo = kind.key === 'agentes'
    ? document.getElementById('garq-agentes-topo') : null;
  _arqRenderList(container, kind, items, (item) => _arqCardGlobal(kind, item), topo);

  // ⛔ Aqui existiam os botões "⚙ formatar" e "＋ criar". Saíram de propósito:
  // desde que uma pasta com qualquer arquivo solto dentro já é um item, criar
  // pela tela virou o caminho longo para o que arrastar a pasta faz num
  // segundo. Quem precisa do formato certo pega o prompt pronto na sub-aba
  // "Como adicionar" e manda a IA gerar. Os dois que ficaram — remover e a
  // estrelinha — são os que a tela faz melhor que o explorador de arquivos.
  //
  // ⚠️ AGENTE É A ÚNICA EXCEÇÃO, e o motivo é exatamente o argumento acima
  // virado do avesso: arrastar uma pasta NÃO escreve frontmatter. Num agente o
  // cabeçalho é que decide as coisas — a `description` faz o assistente
  // acioná-lo sozinho, e o `tools` é a permissão dele. Errar ali não dá erro:
  // dá um agente que nunca é chamado, ou um que pode tudo. Aqui a tela faz
  // melhor que o explorador de arquivos, que é o critério da regra de cima.
  //
  // ⚠️ O BOTÃO VAI NA LINHA DAS PÍLULAS, à direita delas — e não numa faixa
  // própria acima da lista. Toda categoria de Arquivos tem a mesma silhueta: a
  // barra de filtro em cima, e a lista logo abaixo. Uma faixa extra só aqui
  // empurrava a lista de Agentes para baixo e fazia esta sub-aba parecer de
  // outro programa.
  //
  // ⚠️ E O DESTINO É LIMPO ANTES, e não acrescentado. Esta função roda a cada
  // clique na aba (`projetos.js`) e depois de cada operação de CRUD
  // (`arquivos-crud.js`); sem a limpeza, um botão novo se empilhava por vez —
  // era o "aparece duas vezes" relatado.
  if (kind.key === 'agentes') {
    const acoes = document.getElementById('garq-agentes-acoes');
    if (acoes) {
      acoes.innerHTML = '';
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'btn btn-muted btn-sm arq-ag-novo';
      botao.textContent = '＋ Novo agente';
      botao.addEventListener('click', arqNovoAgente);
      acoes.appendChild(botao);
    }
  }
}

// ⚠️ "SEM `tools`" NÃO É "SEM FERRAMENTA" — É O CONTRÁRIO, E O RÓTULO PRECISA
// DIZER ISSO COM PALAVRA. No Claude Code, um agente que OMITE `tools` no
// frontmatter herda TODAS as ferramentas da sessão. Um campo vazio na tela
// insinuaria um agente inofensivo onde há um agente com acesso total — o erro
// de leitura mais caro que esta lista pode induzir.
//
// Só a categoria Agentes tem esta linha: `ferramentas` só vem preenchido para
// ela (ver `list_arquivos`, ramo `kind == 'agentes'`), e o `undefined` das
// outras devolve string vazia — é o que as deixa intocadas.
function arqFerramentasDoAgente(item) {
  if (item.ferramentas === undefined) return '';
  const herda = !String(item.ferramentas).trim();
  const texto = herda ? 'herda todas as ferramentas' : item.ferramentas;
  const extra = herda ? ' arq-ferramentas-todas' : '';
  return '<div class="import-desc arq-ferramentas' + extra + '">\u{1F6E0} '
       + escapeHtml(texto) + '</div>';
}

function _arqCardGlobal(kind, item) {
  const isProg = item.origem === 'programa';
  const card = document.createElement('div');
  card.className = 'import-card';
  card.innerHTML = `
    <div class="import-row">
      <div class="import-left">
        <span class="import-caret">▸</span>
        <span class="import-icon">${kind.icon}</span>
        <div class="import-body">
          <div class="import-name">${escapeHtml(item.rotulo || item.name)}</div>
          ${item.description ? `<div class="import-desc">${escapeHtml(item.description)}</div>` : ''}
          ${arqFerramentasDoAgente(item)}
        </div>
      </div>
      <div class="import-actions">
        <span class="badge-file-count">${item.file_count} arquivo${item.file_count !== 1 ? 's' : ''}</span>
        ${kind.key === 'agentes' ? '<button type="button" class="arq-mini-btn arq-ag-editar-btn" title="Editar este agente">✎ editar</button>' : ''}
        ${_arqEhMcpDoPrograma(kind, item) ? `
          <button type="button" class="arq-mini-btn arq-fixo-btn" disabled title="Servidor do programa — não é favoritável, deletável nem configurável pela estrela.">🔒 do programa</button>
        ` : `
          ${kind.origem ? `<button type="button" class="arq-mini-btn arq-origem-btn" title="Alternar Favoritos / Gerais">${isProg ? '★ favorito' : '☆ geral'}</button>` : ''}
          <button type="button" class="arq-mini-btn arq-del-btn" title="Remover da biblioteca">✕ remover</button>
        `}
      </div>
    </div>
    <div class="import-expand hidden"></div>`;
  card.querySelector('.import-left').addEventListener('click', () => arqToggleExpand(card, kind, item, false));
  const editar = card.querySelector('.arq-ag-editar-btn');
  // O botão é um atalho para o MESMO gesto do clique no cartão — não abre outro
  // caminho. Existe porque "clique no cartão para editar" não se descobre olhando.
  if (editar) editar.addEventListener('click', e => {
    e.stopPropagation();
    if (card.querySelector('.import-expand').classList.contains('hidden')) {
      arqToggleExpand(card, kind, item, false);
    }
  });
  const delBtn = card.querySelector('.arq-del-btn');
  if (delBtn) delBtn.addEventListener('click', () => arqDelete(kind.key, item.name, kind.label));
  const origemBtn = card.querySelector('.arq-origem-btn');
  if (origemBtn) origemBtn.addEventListener('click', () => arqToggleOrigem(kind.key, item.name, item.origem));
  return card;
}
