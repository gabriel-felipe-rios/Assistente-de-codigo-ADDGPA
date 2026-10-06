// ═══ TRABALHOS → Oficina: OS POPOVERS E OS MODAIS ═════════════════════════
//
// O mecanismo de caixinha ancorada, e os três lugares que o usam: a paleta de
// cor, o popover de criar terminal e o modal de fluxos salvos.
//
// ⚠️ UM MECANISMO, NÃO TRÊS. A paleta de cor, a escolha do tipo de ligação e a
// lista de agentes ao criar um terminal são a MESMA coisa: uma caixinha ancorada
// no elemento clicado, que some ao clicar fora. Três implementações divergiriam
// na primeira mudança — e abrir a paleta com o seletor de ligação aberto
// deixaria os dois empilhados na tela. É por isso que os três moram juntos, e
// que `ofiPopoverAberto` é UMA variável, não uma por popover.
//
// ⚠️ OS FLUXOS SALVOS SÃO GLOBAIS, e a tela precisa dizer isso o tempo todo: o
// que se guarda não pertence ao projeto aberto, e quem salvar um arranjo aqui
// vai encontrá-lo em qualquer outro projeto.
//
// ⚠️ O POPOVER DE TERMINAL MEXE EM DISCO ANTES DE CRIAR O NÓ. Escolher um agente
// COPIA o `.md` dele para `.claude/agents/` do projeto — não é mais um prompt
// colado na linha de comando. É só assim que o campo `tools` do arquivo LIMITA
// as ferramentas de verdade; colado num prompt, aquele campo é texto morto.

// ── Fluxos salvos ───────────────────────────────────────────────────────────
//
// ⚠️ SÃO GLOBAIS, e a tela precisa dizer isso o tempo todo: o que se guarda
// aqui aparece em TODOS os projetos, e o que se apaga aqui some de todos.
//
// ⚠️ NÃO CONFUNDIR COM O LANÇAMENTO RÁPIDO de Configuração › Agentes. Aquele
// guarda só papéis ("um Orquestrador e dois Subagentes") e serve para começar;
// este guarda o arranjo inteiro — nós, ligações e grupos — e serve para repetir
// uma montagem que deu certo. Os dois existem, e a tela diz a diferença.

async function ofiModalDeFluxosSalvos() {
  const r = await window.pywebview.api.carregar_fluxos_salvos(currentProject);
  if (!r.success) { showToast(r.error, true); return; }

  const lista = r.fluxos.length ? r.fluxos.map(f => `
    <li class="ofi-fluxo-l">
      <div>
        <b>${escapeHtml(f.nome)}</b>
        <span class="ofi-fluxo-n">${f.nos} nó(s) · ${f.ligacoes} ligação(ões) · ${f.grupos} grupo(s)</span>
        ${f.descricao ? `<span class="ofi-fluxo-d">${escapeHtml(f.descricao)}</span>` : ''}
      </div>
      <div class="ofi-fluxo-b">
        <button class="btn btn-muted btn-xs" data-aplicar="${escapeHtml(f.nome)}">Aplicar</button>
        <button class="btn btn-negative btn-xs" data-apagar="${escapeHtml(f.nome)}">Excluir</button>
      </div>
    </li>`).join('')
    : '<li class="ofi-fluxo-vazio">Nenhum arranjo guardado ainda.</li>';

  const overlay = abrirModalPadrao({
    title: 'Fluxos salvos',
    confirmLabel: 'Fechar',
    semCancelar: true,
    bodyHtml: `
      <div class="modal-body-text">
        Um fluxo salvo guarda a <strong>forma</strong> do canvas — quantos nós, de que
        tipo, ligados e agrupados como. Ele vale em <strong>todos os projetos</strong>.
      </div>
      <ul class="ofi-fluxos">${lista}</ul>
      <label>Guardar o arranjo que está no canvas agora</label>
      <input type="text" id="ofi-fluxo-nome" placeholder="Nome do arranjo">
      <input type="text" id="ofi-fluxo-desc" placeholder="Para que ele serve (opcional)">
      <button type="button" class="btn btn-muted btn-sm" id="ofi-fluxo-salvar">💾 Guardar este arranjo</button>
      <div class="modal-dica">
        Posição absoluta, papel e cartão de origem <b>não</b> vão junto: aplicado noutro
        projeto, o arranjo nasce num espaço livre e todos os nós nascem soltos.
        Isto é diferente do <b>Lançamento rápido</b> (Configuração › Agentes), que guarda
        só a combinação de papéis.
      </div>`,
    onConfirm: () => {},
  });

  overlay.querySelectorAll('[data-aplicar]').forEach(b => b.addEventListener('click', async () => {
    const res = await window.pywebview.api.aplicar_fluxo_salvo(currentProject, b.dataset.aplicar);
    if (!res.success) { showToast(res.error, true); return; }
    overlay.remove();
    showToast(`Arranjo aplicado: ${res.nos} nó(s), ${res.ligacoes} ligação(ões), ${res.grupos} grupo(s).`);
    ofiCarregar();
  }));

  // Excluir apaga dado do usuário, e some de TODOS os projetos — a confirmação
  // precisa dizer as duas coisas. Modal sobre modal é normal no projeto.
  overlay.querySelectorAll('[data-apagar]').forEach(b => b.addEventListener('click', () => {
    const nome = b.dataset.apagar;
    abrirModalPadrao({
      title: 'Excluir este fluxo salvo?',
      confirmLabel: 'Excluir',
      bodyHtml: `
        <div class="modal-body-text">
          <strong>${escapeHtml(nome)}</strong> sai da lista de <strong>todos os projetos</strong>,
          não só deste. O canvas que está aberto não é tocado.
        </div>`,
      onConfirm: async (ov, showErr) => {
        const res = await window.pywebview.api.excluir_fluxo_salvo(nome);
        if (!res.success) { showErr(res.error); return false; }
        overlay.remove();
        ofiModalDeFluxosSalvos();
      },
    });
  }));

  overlay.querySelector('#ofi-fluxo-salvar').addEventListener('click', async () => {
    const nome = overlay.querySelector('#ofi-fluxo-nome').value.trim();
    const desc = overlay.querySelector('#ofi-fluxo-desc').value.trim();
    const erro = overlay.querySelector('.modal-error');
    let res = await window.pywebview.api.salvar_fluxo_da_oficina(currentProject, nome, desc, false);
    // Nome repetido não é erro: é uma pergunta. O backend devolve `existe` em
    // vez de gravar por cima calado — sobrescrever um arranjo sem avisar é
    // apagar trabalho do usuário.
    if (!res.success && res.existe) {
      // ⚠️ Era `confirm()` nativo. O modal padrão empilha por cima deste popover
      // sem problema — `.modal-overlay` é `position: fixed` e cada chamada cria
      // o seu, então o de baixo continua onde estava.
      const ok = await perguntarNaModal({
        title: 'Substituir o fluxo salvo?',
        confirmLabel: 'Substituir',
        bodyHtml: `<div class="modal-body-text">Já existe um fluxo salvo chamado
          <strong>${escapeHtml(nome)}</strong>. Gravar por cima descarta o
          arranjo que estava guardado nele.<br><br>
          <strong>Não dá pra desfazer.</strong></div>`,
      });
      if (!ok) return;
      res = await window.pywebview.api.salvar_fluxo_da_oficina(currentProject, nome, desc, true);
    }
    if (!res.success) {
      erro.textContent = res.error;
      erro.classList.remove('hidden');
      return;
    }
    overlay.remove();
    showToast(`Arranjo guardado como "${nome}".`);
  });
}

// ═══ O MECANISMO DE POPOVER ═══════════════════════════════════════════════
//
// ⚠️ UM MECANISMO, NÃO DOIS. A paleta de cor, a escolha do tipo de ligação e a
// lista de agentes ao criar um terminal são a MESMA coisa: uma caixinha ancorada
// no elemento que foi clicado, que some ao clicar fora. Três implementações
// disso divergiriam na primeira mudança — e abrir a paleta com o seletor de
// ligação aberto deixaria os dois empilhados na tela.
//
// ⚠️ REESCRITO NA RECUPERAÇÃO. O corpo original não sobreviveu; o contrato foi
// deduzido de quem chama (`ofiAbrirPopover(ancora, html)` devolve o elemento, e
// `ofiFecharPopover()` fecha o que estiver aberto) e das classes que o CSS já
// define (`.ofi-popover`, `.ofi-popover-t`, `.ofi-popover-sub`,
// `.ofi-popover-nota`, `.ofi-lig-ops`, `.ofi-lig-op`, `.ofi-chips`, `.ofi-chip`).

let ofiPopoverAberto = null;

function ofiFecharPopover() {
  if (!ofiPopoverAberto) return;
  if (ofiPopoverAberto.parentNode) ofiPopoverAberto.parentNode.removeChild(ofiPopoverAberto);
  ofiPopoverAberto = null;
  document.removeEventListener('mousedown', ofiCliqueForaDoPopover, true);
}

function ofiCliqueForaDoPopover(e) {
  if (ofiPopoverAberto && !ofiPopoverAberto.contains(e.target)) ofiFecharPopover();
}

function ofiAbrirPopover(ancora, html) {
  ofiFecharPopover();
  const pop = document.createElement('div');
  pop.className = 'ofi-popover';
  pop.innerHTML = html;
  document.body.appendChild(pop);

  // ⚠️ ANCORADO EM COORDENADA DE TELA, e por isso `getBoundingClientRect` aqui
  // está CERTO — ao contrário do que vale para medir o terminal. O popover mora
  // no `body`, fora do `transform: scale()` do canvas: ele precisa saber onde a
  // âncora aparece para o olho, não onde ela está no mundo.
  const r = ancora.getBoundingClientRect();
  const larg = pop.offsetWidth, alt = pop.offsetHeight;
  let x = r.left;
  let y = r.bottom + 6;
  // Não deixar sair da janela: uma caixinha metade fora da tela é uma caixinha
  // que o usuário não consegue usar.
  if (x + larg > window.innerWidth - 8) x = Math.max(8, window.innerWidth - larg - 8);
  if (y + alt > window.innerHeight - 8) y = Math.max(8, r.top - alt - 6);
  pop.style.left = Math.round(x) + 'px';
  pop.style.top = Math.round(y) + 'px';

  ofiPopoverAberto = pop;
  // `true` (captura): o clique tem de fechar ANTES de qualquer handler do
  // canvas rodar, senão fechar a paleta também limpa a seleção.
  setTimeout(() => document.addEventListener('mousedown', ofiCliqueForaDoPopover, true), 0);
  return pop;
}

// ── A paleta de cor ─────────────────────────────────────────────────────────
//
// As cores rápidas são TOKENS do tema, e não literais — é o que faz o nó
// acompanhar a troca de tema. Roxo fica de fora: é a cor do Orquestrador, e
// deixar um nó solto pintar-se de roxo desfaria a leitura "de longe, aquele
// ali é o Orquestrador".
const OFI_CORES_RAPIDAS = [
  { token: '--blue', nome: 'azul' },
  { token: '--sky', nome: 'azul claro' },
  { token: '--teal', nome: 'verde-água' },
  { token: '--green', nome: 'verde' },
  { token: '--amber', nome: 'âmbar' },
  { token: '--red', nome: 'vermelho' },
  { token: '--rosa-light', nome: 'rosa' },
  { token: '--gray', nome: 'cinza' },
];

// ⚠️ NÃO DÁ PARA LER O TOKEN COM `getPropertyValue`: uma custom property devolve
// o TEXTO declarado, e os tokens deste projeto são `rgb(var(--x-rgb))`, que é
// texto sem cor nenhuma dentro. O jeito de resolver é PINTAR.
function ofiHexDaCor(no) {
  const cor = no && no.cor;
  if (!cor) return null;
  if (cor.startsWith('#')) return cor;
  const sonda = document.createElement('span');
  sonda.style.cssText = `display:none; color: var(${cor})`;
  document.body.appendChild(sonda);
  const calculado = getComputedStyle(sonda).color;
  sonda.remove();
  const m = calculado.match(/(\d+)\D+(\d+)\D+(\d+)/);
  if (!m) return null;
  return '#' + [1, 2, 3].map(i => (+m[i]).toString(16).padStart(2, '0')).join('');
}

// ⚠️ MESMO DESENHO DA COR DE GRUPO/TAG em Gerenciar projetos: uma linha de
// atalhos com as cores do tema, mais o seletor nativo (`<input type="color">`)
// que dá acesso a QUALQUER cor. Digitar o nome da cor, que era o que estava
// aqui, não é escolher cor — é adivinhar o vocabulário de quem escreveu a tela.
//
// `alvo` é `'no'` (o padrão) ou `'grupo'`. É a mesma paleta e o mesmo gesto para
// os dois, e é por isso que eles compartilham a função.
//
// ⚠️ REESCRITO NA RECUPERAÇÃO.
function ofiAbrirPaleta(ancora, ids, alvo) {
  if (!ids || !ids.length) return;
  const ehGrupo = alvo === 'grupo';
  const primeiro = ehGrupo
    ? (ofiGrupos.find(g => g.id === ids[0]) || {})
    : (ofiNos.find(n => n.id === ids[0]) || {});
  // ⚠️ `.ofi-cor-rapida` E `.ofi-cor-livre` SÃO AS CLASSES QUE O CSS POSICIONA
  // (`trabalhos.css`). Uma versão usou `.ofi-cor-op` e `.ofi-paleta-livre`, que
  // não existem em folha nenhuma: os oito botões viraram quadradinhos sem cor,
  // sem tamanho e sem forma. Classe inventada não dá erro — dá tela feia.
  const rapidas = OFI_CORES_RAPIDAS.map(c => `
    <button type="button" class="ofi-cor-rapida" data-cor="${c.token}"
            style="background:var(${c.token})" title="${c.nome}"></button>`).join('');

  const pop = ofiAbrirPopover(ancora, `
    <div class="ofi-popover-t">${ids.length === 1 ? 'Cor' : `Cor de ${ids.length}`}</div>
    <div class="ofi-paleta">${rapidas}</div>
    <div class="ofi-popover-sub">Qualquer outra</div>
    <div class="ofi-cor-livre">
      <input type="color" class="gg-cor-input" id="ofi-cor-livre"
             value="${escapeHtml(ofiHexDaCor(primeiro) || '#7aa2f7')}" title="Qualquer cor">
      <span>escolha livre</span>
      <button type="button" class="btn btn-muted btn-xs" id="ofi-cor-limpar">Sem cor</button>
    </div>`);

  const pintar = async (cor) => {
    for (const id of ids) {
      const r = ehGrupo
        ? await window.pywebview.api.editar_grupo(currentProject, id, { cor })
        : await window.pywebview.api.editar_no(currentProject, id, { cor });
      if (!r.success) { showToast(r.error, true); break; }
    }
    ofiFecharPopover();
    ofiCarregar();
  };

  pop.querySelectorAll('[data-cor]').forEach(b =>
    b.addEventListener('click', () => pintar(b.dataset.cor)));
  // `change`, e não `input`: o seletor nativo dispara `input` a cada movimento
  // do mouse dentro dele, e isso seria uma gravação por pixel percorrido.
  pop.querySelector('#ofi-cor-livre').addEventListener('change', e => pintar(e.target.value));
  pop.querySelector('#ofi-cor-limpar').addEventListener('click', () => pintar(''));
}

function ofiColorirSelecionados(el) {
  const alvo = el && el.tagName ? el : document.getElementById('ofi-ctx-colorir');
  // A paleta é a MESMA do nó, e o terceiro argumento é o que diz por qual porta
  // gravar. Um segundo seletor de cor no programa seria um a mais.
  if (ofiGrupoSel) return ofiAbrirPaleta(alvo, [ofiGrupoSel], 'grupo');
  ofiAbrirPaleta(alvo, [...ofiSelecao]);
}

// ── O popover de criar terminal ─────────────────────────────────────────────
//
// ⚠️ OS AGENTES VÊM DA BIBLIOTECA, e não mais de uma lista cadastrada em
// Configurações. A troca não é de fonte de dados — é de MECANISMO:
//
//   Antes: o "modo" era um papel + um prompt fixo, e escolher um fazia o
//   programa DIGITAR `--append-system-prompt "<prompt>"` na abertura.
//
//   Agora: o agente é um `.md` com frontmatter, e escolher um COPIA esse
//   arquivo para `.claude/agents/` do projeto. Quem lê passa a ser o próprio
//   Claude Code — e é só assim que o campo `tools` do arquivo LIMITA as
//   ferramentas de verdade. Colado num prompt, aquele campo é texto morto.
//
// É por isso que este botão agora mexe em disco antes de criar o nó.
async function ofiPopoverDeTerminal(ancora) {
  // ⚠️ `assistentes_externos`, E NÃO `carregar_agentes`. Aquele devolvia a
  // lista CRUA de cadastros de lançamento, que podia não ter nada a ver com os
  // presets de arquivos — e foi assim que um cartão em branco chamado
  // "Produto" virou a única opção da tela, enquanto "Claude Code" existia do
  // outro lado. Este devolve a lista única, casada por nome.
  const r = await window.pywebview.api.assistentes_externos();
  if (!r.success) { showToast(r.error, true); return; }
  const produtos = r.itens || [];
  const ativo = produtos.find(p => p.nome === r.ativo) || produtos.find(p => p.comando);

  const ra = await window.pywebview.api.agentes_para_o_terminal(currentProject);
  if (!ra.success) { showToast(ra.error, true); return; }
  const agentes = ra.itens || [];

  const linhaAgente = (i, a) => {
    // ⚠️ 🤖 E COR NEUTRA, e não o avatar de papel que estava aqui. Um agente
    // da biblioteca NÃO TEM papel — papel era do modo antigo, e `criar_no`
    // recusa papel fora de `IDS_DOS_PAPEIS`.
    const herda = !String(a.ferramentas || '').trim();
    // Agente de EXTENSÃO (recurso Agente, fase 12): "de extensão" na linha e
    // `data-origem` para o "Destacar extensões" (D2) pegar.
    const deExtensao = !!a.de_extensao;
    return `
      <button type="button" class="ofi-lig-op" data-modo="${i}"${deExtensao ? ' data-origem="extensao"' : ''}>
        <span class="ofi-avatar ofi-avatar-vazio">🤖</span>
        <span class="ofi-lig-op-txt">
          <b>${escapeHtml(a.rotulo)}${a.ja_no_projeto ? '' : ' <i>↓ vai copiar</i>'}</b>
          ${deExtensao ? `<small>de extensão · ${escapeHtml(a.extensao || '')}</small>` : ''}
          <small>${escapeHtml(a.description || a.grupo || '')}</small>
          <small class="${herda ? 'ofi-ag-herda' : ''}">🛠 ${
            escapeHtml(herda ? 'herda todas as ferramentas' : a.ferramentas)}</small>
        </span>
      </button>`;
  };

  const pop = ofiAbrirPopover(ancora, `
    <div class="ofi-popover-t">Abrir um terminal</div>
    <div class="ofi-lig-ops">
      <button type="button" class="ofi-lig-op" data-modo="-1">
        <span class="ofi-avatar ofi-avatar-vazio">❯</span>
        <span class="ofi-lig-op-txt">
          <b>Só o terminal</b>
          <small>abre na pasta raiz, sem digitar nada dentro</small>
        </span>
      </button>
      ${agentes.map((a, i) => linhaAgente(i, a)).join('')}
    </div>
    ${produtos.length ? `
      <div class="ofi-popover-sub">Com qual assistente externo</div>
      <div class="ofi-chips" id="ofi-novo-produto">
        ${produtos.map(p => `
          <button type="button" class="ofi-chip${p === ativo ? ' on' : ''}"
                  data-produto="${escapeHtml(p.nome)}"
                  title="${p.comando ? escapeHtml(p.comando)
                                     : 'sem comando de lançamento — abre um terminal limpo'}">
            ${escapeHtml(p.nome)}${p.comando ? '' : ' <span class="axt-incompleto">falta o comando</span>'}
          </button>`).join('')}
      </div>` : ''}
    <div class="ofi-popover-nota" id="ofi-novo-recado"></div>`);

  // ⚠️ OS CHIPS APARECEM COM UM ASSISTENTE SÓ. A condição era `> 1`, e o
  // primeiro da lista era escolhido em silêncio: com um único cadastro
  // incompleto, o usuário era obrigado a usá-lo sem nunca vê-lo, e só descobria
  // o problema DEPOIS, dentro do terminal já aberto. Ver o que vai ser usado é
  // metade do aviso.
  //
  // O escolhido é estado do popover, e não leitura do DOM na hora de criar: o
  // chip marcado e esta variável mudam sempre juntos.
  let produto = (ativo || produtos[0] || {}).nome || null;

  // O recado embaixo muda com o chip — porque a pergunta que ele responde
  // ("isto vai funcionar?") depende de qual está escolhido.
  const recado = pop.querySelector('#ofi-novo-recado');
  const pintarRecado = () => {
    const p = produtos.find(x => x.nome === produto);
    if (!produtos.length) {
      recado.innerHTML = 'Nenhum assistente externo cadastrado. O terminal abre limpo — '
        + 'cadastre um em <b>Arquivos › Agentes › Assistentes externos</b>.';
    } else if (p && !p.comando) {
      recado.innerHTML = `<span class="axt-incompleto">falta o comando</span> `
        + `<b>${escapeHtml(p.nome)}</b> não tem comando de lançamento, então o terminal `
        + 'abre limpo e o agente não é acionado. Preencha em '
        + '<b>Arquivos › Agentes › Assistentes externos</b>.';
    } else if (p && !p.destino) {
      recado.innerHTML = `<b>${escapeHtml(p.nome)}</b> não tem pasta de agentes `
        + 'configurada, então o <code>.md</code> não é copiado para o projeto. O terminal '
        + 'abre normalmente, mas sem o agente.';
    } else if (agentes.length) {
      recado.innerHTML = 'Escolher um agente copia o arquivo dele para <code>'
        + escapeHtml((p && p.destino) || '.claude/agents/')
        + '</code> deste projeto — é assim que o limite de ferramentas dele passa a valer.';
    } else {
      recado.textContent = 'Nenhum agente na biblioteca ainda. Crie um em Arquivos › Agentes.';
    }
  };
  pintarRecado();
  pop.querySelectorAll('[data-produto]').forEach(chip => {
    chip.addEventListener('click', () => {
      produto = chip.dataset.produto;
      pop.querySelectorAll('[data-produto]').forEach(c => c.classList.remove('on'));
      chip.classList.add('on');
      pintarRecado();
    });
  });

  pop.querySelectorAll('[data-modo]').forEach(botao => {
    botao.addEventListener('click', async () => {
      const i = +botao.dataset.modo;
      const agente = i >= 0 ? agentes[i] : null;
      ofiFecharPopover();

      if (!agente) { await ofiCriar('terminal', {}); return; }

      // ⚠️ COPIAR ANTES DE CRIAR, E NÃO CRIAR SE A CÓPIA FALHAR. `activate_item`
      // recusa por motivos legítimos — projeto sem pasta raiz, preset inválido,
      // dois agentes que virariam o mesmo arquivo no destino. Criar o nó mesmo
      // assim entregaria um cartão dizendo "Sub-agente" cujo `.md` não está em
      // `.claude/agents/` — exatamente o "orquestrador que é só um cmd.exe"
      // contra o qual `trabalhos_shell.py` avisa.
      // ⚠️ ISTO COPIA E NADA NUNCA REMOVE — E FICA ASSIM, DE PROPÓSITO.
      //
      // Foi de onde saiu o `subagente` sem número que apareceu a mais na lista
      // do usuário: escolher um agente aqui copia o `.md` para
      // `.claude/agents/` do projeto, e excluir o nó não desfaz a cópia.
      //
      // A limpeza automática foi considerada e recusada. O `.md` é por PAPEL,
      // e os nós que o usam são vários: apagar o arquivo ao excluir um nó
      // tiraria o agente debaixo de todos os outros que ainda o usam — e o
      // sintoma seria o pior tipo, um terminal que já estava aberto perdendo o
      // papel no meio do trabalho, sem erro nenhum. Contar quem ainda usa
      // significaria varrer o canvas a cada exclusão para decidir apagar um
      // arquivo, o que é muita máquina para desfazer uma cópia barata.
      //
      // O caminho de remover existe e é o certo: `deactivate_item`, na aba
      // Arquivos, onde o usuário vê a lista inteira e decide olhando.
      if (!agente.ja_no_projeto) {
        // O agente de extensão não tem item na biblioteca: a cópia é outra porta
        // (`activate_agente_de_extensao`), com o mesmo destino do preset.
        const rc = agente.de_extensao
          ? await window.pywebview.api.activate_agente_de_extensao(
            currentProject, agente.caminho_extensao, agente.name)
          : await window.pywebview.api.activate_item(currentProject, 'agentes', agente.name);
        if (!rc || !rc.success) {
          showToast((rc && rc.error) || 'Não deu para copiar o agente para o projeto.', true);
          return;
        }
        // Ligar aqui ACENDE o interruptor daquele agente na aba Arquivos deste
        // projeto — e isso é correto: há uma verdade só sobre o que está ligado.
        // Mas tem de ser dito, senão o usuário encontra a mudança sozinho depois.
        if (agente.de_extensao) {
          showToast(`"${agente.rotulo}" copiado para a pasta de agentes do projeto.`);
        } else {
          showToast(`"${agente.rotulo}" copiado para .claude/agents/ e ligado na aba Arquivos.`);
          if (typeof initArquivosTab === 'function') initArquivosTab();
        }
      }

      // ⚠️ `papel` VAI NULO de propósito. Papel era do modo antigo, e `criar_no`
      // recusa um que não esteja em `IDS_DOS_PAPEIS`. Duas consequências, as
      // duas desejadas: o nó nasce sem a cor de papel, e o caminho de execução
      // do Quadro para de injetar o prompt do papel — porque o papel agora está
      // no `.md` que o Claude Code lê.
      await ofiCriar('terminal',
        { nome: agente.rotulo, papel: null, produto, modo: agente.name });
    });
  });
}
