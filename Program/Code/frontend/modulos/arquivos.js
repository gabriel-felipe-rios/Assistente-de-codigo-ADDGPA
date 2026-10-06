// ══════════════════════════════════════════════════════ ABA: ARQUIVOS ══
//
// ── Este arquivo era 588 linhas, e virou dois ─────────────────────────────
//
// Pelo teto de 500 da AMF:
//
//   arquivos.js         a biblioteca DENTRO de um projeto (ligar/desligar)
//   arquivos-global.js  a mesma biblioteca na tela Projetos (sem ligar)
//
// São scripts clássicos, não módulos: as funções e os `const` do topo continuam
// globais, e o `index.html` carrega os dois na ordem acima.
//
// ⚠️ OS DOIS CARDS SÃO DOIS DE PROPÓSITO. O do projeto liga e desliga; o global
// não tem onde ligar. Unificá-los faria o card global crescer um botão que não
// tem destino.

// `origem`: a categoria tem o par Do programa / Geral — é o que faz aparecer o
// botão de alternar no cartão e o que o Preparar lê para saber o que copiar.
// `split`: a lista se parte em duas sub-listas. Os dois andavam juntos até
// "Regras e instruções" ganhar origem (D16) sem ganhar a partição: ela já se
// divide por TIPO (regra/instrução), e duas barras na mesma lista brigariam.
const ARQ_KINDS = [
  { key: 'skills',         listId: 'arq-skills-list',         icon: '📄', label: 'skill',         emptyPath: 'Arquivos/Skills/',         origem: true, split: true },
  { key: 'comandos',       listId: 'arq-comandos-list',       icon: '⌨️', label: 'comando',       emptyPath: 'Arquivos/Comandos/',       origem: true, split: true },
  { key: 'mcps',           listId: 'arq-mcps-list',           icon: '🔌', label: 'MCP',           emptyPath: 'Arquivos/MCPs/',           origem: true, split: true },
  { key: 'codigos',           listId: 'arq-codigos-list',           icon: '💻', label: 'código pronto',      emptyPath: 'Arquivos/Códigos prontos/' },
  // Regra e instrução são a mesma categoria, com a mesma tela das outras
  // (Favoritos / Gerais, o mesmo cartão). Até 2026-09-21 havia aqui um filtro
  // Todos/Regras/Instruções e um selo de tipo no cartão; saíram a pedido do
  // usuário — o tipo é a forma da pasta, e quem liga o item não navega por ele.
  { key: 'regras-instrucoes', listId: 'arq-regras-instrucoes-list', icon: '📌', label: 'regra ou instrução', emptyPath: 'Arquivos/Regras e instruções/', origem: true, split: true },
  { key: 'instrucoes-base',   listId: 'arq-instrucoes-base-list',   icon: '📘', label: 'instrução base',    emptyPath: 'Arquivos/Instruções base/' },
  { key: 'agentes',           listId: 'arq-agentes-list',           icon: '🤖', label: 'agente',            emptyPath: 'Arquivos/Agentes/' },
];

// Os dois MCPs que o programa traz prontos — só a categoria `mcps` tem itens
// aqui. Não são favoritáveis, deletáveis nem configuráveis pela estrela: é
// fato do item, não escolha do usuário (ver `Saída dos comandos/Discussões/
// Nome do programa e os dois servidores MCP/Briefing.md`, D7/D13).
const ARQ_MCPS_DO_PROGRAMA = ['assistente', 'trabalhos'];
function _arqEhMcpDoPrograma(kind, item) {
  return kind.key === 'mcps' && ARQ_MCPS_DO_PROGRAMA.includes((item.name || '').toLowerCase());
}

async function initArquivosTab() {
  const ws = await window.pywebview.api.load_workspace(currentProject);
  const activated = ws.success ? (ws.config.activated || {}) : {};

  // O preset é lido ANTES das listas porque cada categoria mostra o destino
  // dele no cabeçalho: o usuário precisa ver para onde o item vai antes de
  // clicar em ligar, e não depois, no toast.
  const cfg = await window.pywebview.api.load_assistentes_config(currentProject);
  _arqPreset = (cfg && cfg.success) ? cfg : null;
  _arqPintarBarraDePreset();

  // Projeto importado com skill/comando já copiado na mão, sem nunca ter
  // passado pelo "ligar" do programa: sem isto, `activated` vem vazio e o
  // card mostra Inativo com o arquivo presente no disco («tá tudo inativo
  // sendo que tá ligado»). Confere o disco do mesmo jeito que a prévia do
  // Preparar projeto (`_preparar_item_ja_esta`).
  const noDisco = await window.pywebview.api.listar_ativos_no_disco(currentProject);
  const ativosNoDisco = (noDisco && noDisco.success) ? (noDisco.ativos || {}) : {};

  for (const kind of ARQ_KINDS) {
    const r = await window.pywebview.api.list_arquivos(kind.key);
    const ligados = new Set(activated[kind.key] || []);
    const doDisco = ativosNoDisco[kind.key] || {};
    for (const nome of Object.keys(doDisco)) {
      if (doDisco[nome]) ligados.add(nome);
    }
    renderArquivosCategory(kind, r.success ? r.items : [], [...ligados]);
  }
  await _arqPintarOrfaos();
}

// Entradas "ligado" cujo item sumiu da biblioteca (apagado ou renomeado). A
// lista não as mostra — só existe "Ativo" em item que existe — então sem esta
// linha o registro velho fica invisível até uma pasta com o mesmo caminho
// renascer e acordar como "ligada". O botão limpa SÓ o que a linha lista, e só
// no clique: limpar sozinho apagaria o "ligado" de uma pasta renomeada por
// engano antes de o usuário desfazer o rename.
async function _arqPintarOrfaos() {
  const r = await window.pywebview.api.listar_ativados_orfaos(currentProject);
  if (!r || !r.success) return;
  for (const kind of ARQ_KINDS) {
    const container = document.getElementById(kind.listId);
    if (!container) continue;
    container.querySelectorAll('.arq-orfaos').forEach(el => el.remove());
    const sobra = (r.orfaos || {})[kind.key] || [];
    if (!sobra.length) continue;
    const linha = document.createElement('div');
    linha.className = 'arq-orfaos';
    linha.innerHTML = `${sobra.length} ligado${sobra.length !== 1 ? 's' : ''} sem item na biblioteca`
      + `<button type="button" class="arq-mini-btn arq-orfaos-btn" title="${escapeHtml(sobra.join('\n'))}">limpar</button>`;
    linha.querySelector('.arq-orfaos-btn').addEventListener('click', async () => {
      const l = await window.pywebview.api.limpar_ativados_orfaos(currentProject, kind.key);
      if (!l || !l.success) { showToast((l && l.error) || 'Erro ao limpar.', true); return; }
      linha.remove();
      showToast(`${l.removidos.length} registro${l.removidos.length !== 1 ? 's' : ''} sem item removido${l.removidos.length !== 1 ? 's' : ''}.`);
    });
    // Abaixo da frase de destino, quando ela existe; senão no topo.
    const destino = container.querySelector('.arq-destino');
    if (destino) destino.after(linha); else container.insertBefore(linha, container.firstChild);
  }
}

// A configuração de presets da aba Arquivos, como o backend a devolveu. Fica em
// módulo porque as sete categorias a consultam ao pintar o destino, e pedi-la
// sete vezes seria sete idas ao disco para a mesma resposta.
let _arqPreset = null;

// O que "ligar" faz nas categorias que NÃO passam pelo preset. Elas têm destino
// próprio e deliberado, e antes ficavam sem frase nenhuma — o que fazia parecer
// que o programa não sabia para onde mandá-las. A frase começa igual em todas
// ("Ligar ...") para as sete sub-abas se lerem do mesmo jeito.
const ARQ_DESTINO_FIXO = {
  'regras-instrucoes': 'Ligar copia para a pasta de decisões do projeto — a mesma que a aba Decisões edita.',
  'codigos': 'Ligar só marca o item como disponível. Quem copia é o botão <b>copiar pro projeto</b> de cada um.',
};

/** A frase de destino desta categoria, em HTML — `null` só se nem o preset nem
 *  a tabela fixa souberem dizer nada. */
function _arqFraseDeDestino(kind) {
  if (ARQ_DESTINO_FIXO[kind]) return ARQ_DESTINO_FIXO[kind];
  if (!_arqPreset) return null;
  const cat = (_arqPreset.categorias || []).find(c => c.kind === kind);
  if (!cat) return null;
  const preset = (_arqPreset.presets || []).find(p => p.nome === _arqPreset.escolhido);
  if (!preset) return null;
  const conf = (preset.categorias || {})[kind] || {};
  const destino = (conf.destino || '').trim();

  if (cat.so_destino) {
    return destino
      ? `Ligar registra o servidor em <code>${escapeHtml(destino)}</code>.`
      : `O preset <b>${escapeHtml(preset.nome)}</b> não registra MCP por arquivo — este assistente guarda em outro formato.`;
  }
  // `raiz_quando_vazio`: em Instruções base o campo vazio quer dizer A RAIZ, e
  // não "não copia" — por isso a frase não pode ser a mesma das outras.
  if (!destino) {
    return cat.raiz_quando_vazio
      ? 'Ligar copia para a <b>raiz do projeto</b> — arquivos soltos.'
      : `O preset <b>${escapeHtml(preset.nome)}</b> não copia esta categoria — ligar só marca o item.`;
  }
  return `Ligar copia para <code>${escapeHtml(destino)}</code> — ${
    conf.formato === 'pasta' ? 'uma pasta por item' : 'arquivos soltos'}.`;
}

// A barra com o preset em uso. Um <select>, e não só um rótulo: o projeto pode
// usar um assistente diferente do padrão do programa, e trocar aqui é onde a
// pergunta nasce — na hora de ligar o item, não em Configurações.
// ⚠️ A BARRA MORA EM PROJETO › PREPARAR PROJETO, e não mais no topo da aba
// Arquivos. Motivo, nas palavras do usuário: *"tem várias configurações pra mesma
// coisa"* — havia um seletor de preset no Preparar e outro aqui, os dois por
// projeto, os dois feitos uma vez só. Juntar os dois num lugar é o que faz esse
// gesto ser único.
//
// ⚠️ MAS `_arqPreset` CONTINUA SENDO CARREGADO NA ABA ARQUIVOS. Ele não
// alimenta só esta barra: alimenta `_arqFraseDeDestino`, que escreve "Ligar
// copia para …" no topo das SETE categorias. Mover a leitura junto com a barra
// apagaria as sete frases — é a coisa mais fácil de errar nesta mudança.
function _arqPintarBarraDePreset() {
  // O destino é o painel do Preparar. Enquanto ele não existir (a aba Arquivos
  // pode pintar primeiro — `enterProject` dispara as duas sem `await`), esta
  // função sai quieta: `initPrepararTab` pinta de novo quando chegar a vez dela.
  const casa = document.getElementById('prep-preset-arquivos');
  if (!casa || !_arqPreset) return;
  let barra = casa.querySelector('.arq-preset-barra');
  if (!barra) {
    barra = document.createElement('div');
    barra.className = 'arq-preset-barra';
    casa.appendChild(barra);
  }
  const presets = _arqPreset.presets || [];
  barra.innerHTML = `
    <span class="arq-preset-rotulo">Assistente externo</span>
    <select class="arq-preset-select">
      ${presets.map(p => `<option value="${escapeHtml(p.nome)}"${
        p.nome === _arqPreset.escolhido ? ' selected' : ''}>${escapeHtml(p.nome)}</option>`).join('')}
    </select>
    <span class="arq-preset-dica">é ele que diz para onde cada categoria vai, e como chega</span>`;
  // ⚠️ O `<select>` é declarado em `preparar-template.js` (#prep-preset-arquivos)
  // e preenchido AQUI — módulos diferentes, sem uma referência ligando os dois.
  // Renomear o id de lá deixa esta barra sem casa, e sem erro nenhum.
  // ⚠️ TROCAR AQUI REPINTA A ABA ARQUIVOS, e esse acoplamento entre duas abas
  // nasceu quando a barra mudou de casa. É necessário: as sete frases de destino
  // de lá dependem do preset escolhido aqui, e deixá-las velhas faria a tela
  // prometer um destino que o próximo "ligar" não cumpriria.
  barra.querySelector('.arq-preset-select').addEventListener('change', async (ev) => {
    await window.pywebview.api.escolher_assistente_do_projeto(currentProject, ev.target.value);
    initArquivosTab();
    if (typeof prepPintarDestinos === 'function') prepPintarDestinos();
  });
}

function renderArquivosCategory(kind, items, activatedList) {
  const container = document.getElementById(kind.listId);
  if (!container) return;
  _arqRenderList(container, kind, items, (item) => _arqCardProjeto(kind, item, activatedList));

  const frase = _arqFraseDeDestino(kind.key);
  if (!frase) return;
  const linha = document.createElement('div');
  linha.className = 'arq-destino';
  // ⚠️ DIZER ONDE SE MUDA, e não só qual é. O seletor de preset saiu daqui para
  // Projeto › Preparar projeto; sem esta pista, o usuário lê "Ligar copia para
  // `.claude/agents/`" e não tem onde trocar — uma frase que informa e não deixa
  // agir é pior que nenhuma.
  linha.innerHTML = frase
    + ' <span class="arq-destino-onde">Projeto › Preparar projeto › Assistente externo</span>';
  container.insertBefore(linha, container.firstChild);
}

// Card por-projeto (com toggle de ativação).
function _arqCardProjeto(kind, item, activatedList) {
  const isOn = activatedList.includes(item.name);
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
        </div>
      </div>
      <div class="import-actions">
        ${kind.key === 'codigos' ? `<button type="button" class="btn btn-utility btn-sm arq-copy-btn">📋 copiar pro projeto</button>` : ''}
        ${_arqEhMcpDoPrograma(kind, item) ? `<button type="button" class="arq-mini-btn arq-fixo-btn" disabled title="Servidor do programa — não é favoritável, deletável nem configurável pela estrela.">🔒 do programa</button>` : ''}
        <label class="toggle-pill">
          <div class="toggle-track${isOn ? ' on' : ''}">
            <div class="toggle-knob"></div>
          </div>
          <span class="toggle-label${isOn ? ' on' : ''}">${isOn ? 'Ativo' : 'Inativo'}</span>
        </label>
      </div>
    </div>
    <div class="import-expand hidden"></div>`;

  card.querySelector('.import-left').addEventListener('click', () => arqToggleExpand(card, kind, item, true));

  const copyBtn = card.querySelector('.arq-copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      copyBtn.disabled = true;
      const r = await window.pywebview.api.copy_codigo_pronto_to_project(currentProject, item.name);
      copyBtn.disabled = false;
      if (!r.success) { showToast(r.error || 'Erro ao copiar.', true); return; }
      const old = copyBtn.textContent;
      copyBtn.textContent = `✓ ${r.count} arquivo${r.count !== 1 ? 's' : ''}`;
      setTimeout(() => { copyBtn.textContent = old; }, 1600);
      showToast(`Copiado para Saída dos comandos/Códigos prontos/${item.name}/.`);
    });
  }

  const track = card.querySelector('.toggle-track');
  const label = card.querySelector('.toggle-label');
  card.querySelector('.toggle-pill').addEventListener('click', async () => {
    const nowOn = track.classList.contains('on');
    if (!nowOn) {
      const r = await window.pywebview.api.activate_item(currentProject, kind.key, item.name);
      if (!r.success) { showToast(r.error || 'Erro ao ativar.', true); return; }
      track.classList.add('on');
      label.classList.add('on');
      label.textContent = 'Ativo';
      showToast(r.message || `"${item.rotulo || item.name}" ativado.`);
    } else {
      const apagar = () => {
        track.classList.remove('on');
        label.classList.remove('on');
        label.textContent = 'Inativo';
        showToast(`"${item.rotulo || item.name}" desativado.`);
      };
      const r = await window.pywebview.api.deactivate_item(currentProject, kind.key, item.name);
      // ⚠️ `precisa_confirmar` só chega de UMA categoria: os MCPs de terceiro,
      // que são os únicos cujo desligar APAGA a cópia dentro do projeto. As
      // outras seis nunca devolvem esse campo, então o caminho delas continua
      // exatamente como era — o `r` nem chega a ser lido.
      //
      // ⚠️ E a pergunta só aparece quando a cópia FOI EDITADA. Perguntar sempre
      // viraria ruído que o usuário aprende a confirmar sem ler, e aí o aviso
      // deixaria de proteger o único caso em que ele importa.
      if (r && r.precisa_confirmar) {
        abrirModalPadrao({
          title: 'Esta cópia foi editada',
          bodyHtml:
            `<p>A pasta <code>${escapeHtml(r.pasta || '')}</code> dentro do projeto está
              <strong>diferente</strong> do molde da biblioteca — alguém a editou.</p>
             <p>Desligar um MCP <strong>apaga</strong> essa pasta, e as mudanças somem.
              Copie o que interessa antes, ou confirme para apagar mesmo assim.</p>`,
          confirmLabel: 'Desligar e apagar',
          onConfirm: async (_overlay, showErr) => {
            const rr = await window.pywebview.api.deactivate_item(
              currentProject, kind.key, item.name, true);
            if (!rr || !rr.success) { showErr((rr && rr.error) || 'Erro ao desligar.'); return false; }
            apagar();
          },
        });
        return;
      }
      if (r && r.success === false) { showToast(r.error || 'Erro ao desligar.', true); return; }
      apagar();
    }
  });
  return card;
}

// ══════════════════════════════════════════════ Grupos (pastas da biblioteca) ══
//
// Um item da biblioteca é identificado pelo CAMINHO relativo à categoria
// ("Arquitetura modular/Arquitetura modular - Desktop"), não pelo nome: dois
// itens de mesmo nome em grupos diferentes são itens diferentes. `item.name` é
// o caminho — é ele que vai para o backend —, `item.rotulo` é a última parte,
// que o cartão mostra, e `item.grupo` é o resto.
//
// A árvore é montada AQUI, a partir da lista achatada, e não pedida pronta ao
// backend: `trilho-de-pastas.js` já sabe desenhar e filtrar qualquer árvore
// `{ nome, caminho, pastas, itens }`, e é o mesmo componente que Launchers e
// Plugins usam. Um segundo formato de resposta só para esta tela seria uma
// segunda coisa para manter em pé.
function _arqArvoreDeGrupos(items) {
  const raiz = { nome: '', caminho: '', pastas: [], itens: [] };
  for (const item of items) {
    let no = raiz;
    const partes = (item.grupo || '') ? item.grupo.split('/') : [];
    let caminho = '';
    for (const parte of partes) {
      caminho = caminho ? `${caminho}/${parte}` : parte;
      let filho = no.pastas.find(p => p.caminho === caminho);
      if (!filho) {
        filho = { nome: parte, caminho, pastas: [], itens: [] };
        no.pastas.push(filho);
      }
      no = filho;
    }
    no.itens.push(item);
  }
  return raiz;
}

// Envolve a lista de uma categoria num trilho de pastas + painel. O trilho é
// montado SEMPRE — mesmo sem grupo nenhum, e mesmo com a categoria vazia.
//
// Chegou a ser condicional ("só quando tem pasta"), e estava errado: as sete
// categorias ficavam com desenhos diferentes conforme o que havia dentro delas,
// e a que ainda não tinha pasta parecia não ter o recurso. Sempre montado, o
// lugar de cada coisa é o mesmo em toda sub-aba, e criar a primeira pasta não
// reorganiza a tela debaixo de quem está olhando.
// ⚠️ `cabecalho` É UM ELEMENTO JÁ EXISTENTE, e não um HTML a montar. Ele é
// reinserido no topo do painel a cada pintura — e `insertBefore` de um nó que
// já está no documento o MOVE em vez de clonar, então os ouvintes dele
// sobrevivem. É isso que permite a barra de visões de Agentes viver ao lado dos
// cartões (como a "Do programa / Gerais" de Comandos) sem ser recriada, sem
// perder o clique e sem esquecer qual visão estava aberta.
//
// ⚠️ QUEM RECEBE O PAINEL NÃO PODE ZERÁ-LO. `pintar` já o esvazia; um segundo
// `innerHTML = ''` dentro de `desenhar` levaria o cabeçalho junto.
function _arqComTrilho(container, items, desenhar, cabecalho) {
  const arvore = _arqArvoreDeGrupos(items);
  const layout = document.createElement('div');
  layout.className = 'arq-com-trilho';
  const trilho = document.createElement('div');
  trilho.className = 'trilho-pastas';
  trilho.innerHTML = trilhoPastasHtml(arvore);
  const painel = document.createElement('div');
  painel.className = 'arq-trilho-painel';
  layout.append(trilho, painel);
  container.appendChild(layout);

  let selecao = 'todos';
  const pintar = () => {
    trilhoPastasMarcarAtiva(trilho, selecao);
    painel.innerHTML = '';
    if (cabecalho) painel.appendChild(cabecalho);
    desenhar(painel, trilhoPastasItensVisiveis(arvore, 'itens', selecao));
  };
  trilho.addEventListener('click', (ev) => {
    const nova = trilhoPastasSelecaoDoClique(ev.target, trilho);
    if (!nova) return;
    selecao = nova;
    pintar();
  });
  pintar();
}

// Renderiza a lista de uma categoria. Se `kind.split`, separa em sub-abas
// internas "Do programa / Gerais" por `item.origem`; senão, lista única.
function _arqRenderList(container, kind, items, buildCard, cabecalho) {
  container.innerHTML = '';

  _arqComTrilho(container, items, (alvo, visiveis) =>
    _arqRenderSemTrilho(alvo, kind, visiveis, buildCard, items.length === 0), cabecalho);
}

// `categoriaVazia` separa "esta pasta não tem nada" de "esta categoria inteira
// está vazia" — só a segunda merece a dica de onde criar a primeira pasta.
//
// ⚠️ As pílulas ("Favoritos / Gerais") são montadas MESMO
// com zero item, e isso é pedido: uma sub-aba vazia que não mostra a divisão
// parece uma sub-aba que não TEM divisão, e a tela muda de forma no dia em que
// o primeiro item chega. Com elas sempre de pé, o "0" já conta a história.
function _arqRenderSemTrilho(container, kind, items, buildCard, categoriaVazia) {
  // ⚠️ A dica é acrescentada NO FIM, depois das pílulas — nunca antes. Acima
  // delas ela empurrava a divisão "Do programa / Gerais" para baixo e a linha
  // de sub-abas trocava de lugar conforme a categoria tivesse conteúdo ou não.
  const dica = categoriaVazia ? document.createElement('div') : null;
  if (dica) {
    dica.className = 'arq-empty';
    dica.innerHTML = `
      Nenhuma pasta encontrada em <code>${escapeHtml(kind.emptyPath)}</code>.<br>
      Crie uma subpasta lá — cada subpasta vira um ${escapeHtml(kind.label)}.`;
  }
  const comDica = () => { if (dica) container.appendChild(dica); };

  if (!kind.split) {
    items.forEach(item => container.appendChild(buildCard(item)));
    comDica();
    return;
  }

  // ⚠️ Só `mcps` tem os dois itens fixos do programa — eles saem de
  // "Favoritos"/"Gerais" (mesmo tendo `origem: 'programa'`, que aqui só
  // decide o accordion de Explicação/Ativar) e viram uma terceira sub-aba
  // própria, "Do programa" (D13 do briefing).
  const fixos = kind.key === 'mcps' ? items.filter(i => _arqEhMcpDoPrograma(kind, i)) : [];
  const resto = kind.key === 'mcps' ? items.filter(i => !_arqEhMcpDoPrograma(kind, i)) : items;
  const prog = resto.filter(i => i.origem === 'programa');
  const geral = resto.filter(i => i.origem !== 'programa');

  const bar = document.createElement('div');
  bar.className = 'arq-inner-tabs';
  bar.innerHTML = `
    <button type="button" class="arq-inner-tab active" data-seg="prog">Favoritos <span class="arq-inner-cnt">${prog.length}</span></button>
    <button type="button" class="arq-inner-tab" data-seg="geral">Gerais <span class="arq-inner-cnt">${geral.length}</span></button>`
    + (kind.key === 'mcps' ? `<button type="button" class="arq-inner-tab" data-seg="fixos">Do programa <span class="arq-inner-cnt">${fixos.length}</span></button>` : '');

  const segProg = _arqSegment('prog', prog, buildCard, false);
  const segGeral = _arqSegment('geral', geral, buildCard, true);
  const segFixos = kind.key === 'mcps' ? _arqSegment('fixos', fixos, buildCard, true) : null;

  bar.querySelectorAll('.arq-inner-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.arq-inner-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const seg = btn.dataset.seg;
      segProg.classList.toggle('hidden', seg !== 'prog');
      segGeral.classList.toggle('hidden', seg !== 'geral');
      if (segFixos) segFixos.classList.toggle('hidden', seg !== 'fixos');
    });
  });

  container.append(bar, segProg, segGeral);
  if (segFixos) container.appendChild(segFixos);
  comDica();
}

function _arqSegment(seg, items, buildCard, hidden) {
  const div = document.createElement('div');
  div.className = 'arq-inner-seg' + (hidden ? ' hidden' : '');
  div.dataset.seg = seg;
  if (items.length === 0) {
    div.innerHTML = `<div class="arq-inner-empty">Nenhum item aqui ainda.</div>`;
  } else {
    items.forEach(item => div.appendChild(buildCard(item)));
  }
  return div;
}
