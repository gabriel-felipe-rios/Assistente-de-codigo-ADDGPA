// ══════════════════════════════════════════════════════ TELA: PROJETO ══
//
// ── Este arquivo era 571 linhas, e virou dois ─────────────────────────────
//
// Pelo teto de 500 da AMF:
//
//   navegacao.js        entrar e sair de um projeto, e ligar a tela
//   navegacao-abas.js   as sub-abas lembradas por projeto
//
// São scripts clássicos, não módulos: as funções e os `let` do topo continuam
// globais, e o `index.html` carrega os dois na ordem acima.
function bindProjectScreen() {
  document.getElementById('btn-back').addEventListener('click', goBackToProjects);

  // Abas principais
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => { c.classList.remove('active'); c.classList.add('hidden'); });
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      target.classList.remove('hidden');
      target.classList.add('active');
      // Lembra qual aba principal ficou ativa NESTE projeto — é o que permite
      // `enterProject` restaurá-la ao voltar pra esta aba de projeto, em vez
      // de sempre cair em "Projeto" (ver `_projAbaAtiva`, mais abaixo).
      if (currentProject) _projAbaAtiva[currentProject] = btn.dataset.tab;
      // Reação (D46): observador, sem `await`. Sai também na restauração da aba
      // ao entrar no projeto (`enterProject` clica aqui) — a tela mudou de verdade.
      if (typeof xtEmitir === 'function') {
        xtEmitir('aba.abriu', { projeto: currentProject || null, aba: btn.dataset.tab, barra: 'main_tabs' });
      }
      // `tab-assistente` cobre o que era `tab-chat` — o Chat virou sub-aba
      // dela, e initAssistenteTab() despacha o init da sub-aba aberta.
      if (btn.dataset.tab === 'tab-assistente') initAssistenteTab();
      if (btn.dataset.tab === 'tab-regras') initRegrasTab();
      if (btn.dataset.tab === 'tab-documentacao') initDocumentacao();
      if (btn.dataset.tab === 'tab-editor' && typeof initEditorTab === 'function') initEditorTab();
      if (btn.dataset.tab === 'tab-agentes') initAgentesTab();
      if (btn.dataset.tab === 'tab-mapas') initMapasTab();
      if (btn.dataset.tab === 'tab-terminal' && typeof initTerminalTab === 'function') initTerminalTab();
      if (btn.dataset.tab === 'tab-inspetor' && typeof initInspetorTab === 'function') initInspetorTab();
      if (btn.dataset.tab === 'tab-aparencia' && typeof initAparenciaTab === 'function') initAparenciaTab();
      if (btn.dataset.tab === 'tab-git' && typeof initBackupsTab === 'function') initBackupsTab();
      if (btn.dataset.tab === 'tab-trabalhos' && typeof initTrabalhosTab === 'function') initTrabalhosTab();
      if (btn.dataset.tab === 'tab-plugins' && typeof initProjectPluginsTab === 'function') initProjectPluginsTab();
    });
  });

  // Sub-abas (aba Projeto)
  document.querySelectorAll('.subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.subtab-content').forEach(c => { c.classList.remove('active'); c.classList.add('hidden'); });
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.subtab);
      target.classList.remove('hidden');
      target.classList.add('active');
    });
  });

  // Sub-abas internas de Projeto › Preparar projeto
  document.querySelectorAll('.prep-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.prep-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.prep-tab-content').forEach(c => { c.classList.remove('active'); c.classList.add('hidden'); });
      btn.classList.add('active');
      const alvo = document.getElementById(btn.dataset.prep);
      if (!alvo) return;
      alvo.classList.remove('hidden');
      alvo.classList.add('active');
    });
  });

  // Sub-abas internas da aba Análise
  document.querySelectorAll('.analise-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.analise-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.analise-tab-content').forEach(c => { c.classList.remove('active'); c.classList.add('hidden'); });
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.analise);
      target.classList.remove('hidden');
      target.classList.add('active');
      if (btn.dataset.analise === 'analise-relacoes' && typeof initRelacoesTab === 'function') {
        initRelacoesTab();
      }
      if (btn.dataset.analise === 'analise-duplicados' && typeof initDuplicadosTab === 'function') {
        initDuplicadosTab();
      }
    });
  });

  // Sub-abas da aba Arquivos
  document.querySelectorAll('.arq-subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.arq-subtab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.arq-subtab-content').forEach(c => { c.classList.remove('active'); c.classList.add('hidden'); });
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.arqsubtab);
      target.classList.remove('hidden');
      target.classList.add('active');
    });
  });

  // Filtros Tree-sitter
  document.querySelectorAll('.ts-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => tsSetFilter(btn.dataset.filter));
  });

  // Índice de Símbolos
  document.getElementById('btn-build-index').addEventListener('click', siBuildIndex);
  document.getElementById('si-search').addEventListener('input', e => siSearch(e.target.value));
  document.querySelectorAll('.si-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => siSetFilter(btn.dataset.sifilter));
  });

  // Mapa de I/O
  document.querySelectorAll('.mio-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => mioSetFilter(btn.dataset.miofilter));
  });

  // Botões de copiar trecho de código.
  // ⚠️ Sobraram DOIS. O do Mapa de I/O saiu: aquela tela agora tem a barra de
  // copiar do painel do meio, que embrulha o trecho no envelope (mapaio.js).
  // Estes dois continuam no formato antigo — Tree-sitter e Índice de Símbolos
  // ficaram fora da mudança por decisão do usuário, e é o que mantém
  // `copyCodeLines` (utils.js) justificada.
  document.getElementById('btn-copy-ts').addEventListener('click', () => copyCodeLines('ts-code-lines', 'btn-copy-ts'));
  document.getElementById('btn-copy-si').addEventListener('click', () => copyCodeLines('si-def-code',   'btn-copy-si'));

  // LSP
  document.getElementById('btn-run-lsp').addEventListener('click', runLsp);
  document.getElementById('documentacao-tecnica-preview-toggle').addEventListener('click', () => {
    const body = document.getElementById('documentacao-tecnica-preview-body');
    const arrow = document.getElementById('documentacao-tecnica-preview-arrow');
    const estaAberto = !body.classList.contains('hidden');
    body.classList.toggle('hidden', estaAberto);
    arrow.textContent = estaAberto ? '▸' : '▾';
  });
  document.getElementById('documentacao-tecnica-show-ignored').addEventListener('change', () => {
    if (_docTecnicaPreviewData) renderDocTecnicaTree(_docTecnicaPreviewData);
  });
  document.getElementById('btn-close-prompt-modal').addEventListener('click', closePromptModal);
  document.getElementById('modal-prompt-view').addEventListener('click', e => {
    if (e.target === e.currentTarget) closePromptModal();
  });

  // Botões workspace
  document.getElementById('btn-browse-root').addEventListener('click', browseAndSetRoot);
  document.getElementById('btn-add-working').addEventListener('click', browseAndAddWorking);
  document.getElementById('btn-browse-main-file').addEventListener('click', browseAndSetMainFile);
  document.getElementById('btn-clear-main-file').addEventListener('click', clearMainFile);

  // Dropdowns de adicionar (Remover e Contexto)
  setupDropdown('btn-add-ignore-toggle', 'add-ignore-menu');
  setupDropdown('btn-add-context-toggle', 'add-context-menu');
  document.getElementById('btn-add-ignore').addEventListener('click', browseAndAddIgnoreFolder);
  document.getElementById('btn-add-ignore-file').addEventListener('click', browseAndAddIgnoreFile);
  document.getElementById('btn-add-context').addEventListener('click', browseAndAddContextFolder);
  document.getElementById('btn-add-context-file').addEventListener('click', browseAndAddContextFile);

  // Botões chat
  document.getElementById('btn-new-chat').addEventListener('click', newChat);
  document.getElementById('btn-send-chat').addEventListener('click', sendChatMessage);
  document.getElementById('btn-refresh-model').addEventListener('click', loadModels);
  // Modo e checkboxes de contexto
  // Prompt fixo: o preview é atualizado por _setPromptFixo (chat-prompt-fixo.js)
  // A lista canônica é a de chat-prompt-fixo.js — duas cópias já divergiram uma vez
  // (o ctx-grafo-imports existia lá e faltava aqui, então marcar a caixa não
  // recalculava os tokens).
  _CTX_CHECKBOX_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updateContextPreview);
  });

  // Sub-abas do chat (Conversa / Contexto)
  document.querySelectorAll('.chat-subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chat-subtab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.chat-subtab-content').forEach(c => { c.classList.remove('active'); c.classList.add('hidden'); });
      btn.classList.add('active');
      document.getElementById(btn.dataset.chatsubtab).classList.remove('hidden');
      document.getElementById(btn.dataset.chatsubtab).classList.add('active');
      if (btn.dataset.chatsubtab === 'chat-payload-panel') updateContextPreview();
      // A tabela de ferramentas é gerada do backend na hora de abrir a aba, e
      // não na carga da página: ela depende de configuração que pode ter
      // mudado no meio da sessão.
      if (btn.dataset.chatsubtab === 'chat-ferramentas-panel'
          && typeof renderSubagentesFerramentas === 'function') {
        renderSubagentesFerramentas('chat', 'chat');
      }
    });
  });

  if (typeof wireSubagentesConfigGlobal === 'function') {
    wireSubagentesConfigGlobal('chat');
    wireSubagentesFerramentas('chat', 'chat');
  }
  if (typeof atualizarTravaIA === 'function') atualizarTravaIA();

  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
  });

  // Drop zones
  setupDropZone(document.getElementById('section-root'), async (path) => {
    workspaceConfig.root_folder = path;
    await saveWorkspace();
    renderWorkspace();
    showToast('Pasta raiz definida.');
  });

  setupDropZone(document.getElementById('section-working'), async (path) => {
    if (!workspaceConfig.working_folders.includes(path)) {
      workspaceConfig.working_folders.push(path);
      await saveWorkspace();
      renderWorkspace();
      showToast('Pasta de trabalho adicionada.');
    }
  });

  setupDropZone(document.getElementById('section-main-file'), async (path) => {
    workspaceConfig.main_file = path;
    await saveWorkspace();
    renderMainFile();
    showToast('Arquivo principal definido.');
  });

  // As zonas de soltar de Remover e Contexto sem leitura moram no componente
  // delas (`projeto-caminhos.js`, `_pcamLigar`): arrastar da Estrutura e
  // arrastar do Explorer caem no mesmo painel.
}

async function enterProject(name) {
  // ⚠️ REENTRAR NO MESMO PROJETO NÃO É TROCAR DE PROJETO. Sair para a tela de
  // Projetos e voltar chamava esta função como se fosse um projeto novo, e o
  // `encerrarStreamDoChat()` logo abaixo jogava fora o DONO e a LISTA DE
  // EVENTOS da resposta que estava chegando. Duas coisas quebravam de uma vez:
  //
  //   1. a resposta em curso não voltava à tela (o replay não tinha mais o que
  //      remontar — o backend só grava o chat quando a resposta TERMINA);
  //   2. sem dono carimbado, cada pedaço que chegava depois era pintado no chat
  //      que estivesse aberto — a resposta de um chat aparecia dentro de outro.
  //
  // O worker do Python nunca soube de nada disso: ele continuou respondendo o
  // tempo todo, e continuou mandando os pedaços para uma tela que tinha
  // esquecido de quem eram.
  // ⚠️ A condição pede as DUAS coisas — mesmo projeto E resposta viva. Só
  // "mesmo projeto" bastaria para o defeito, mas jogaria fora de graça a rede
  // de segurança do `setChatInputEnabled(true)`: sem nada em curso, reentrar
  // continua devolvendo a tela ao estado limpo, como sempre fez.
  const preservarStream = !!name && name === currentProject && !!_streamChatId;
  // Guarda a navegação do projeto que está SAINDO, antes de `currentProject`
  // trocar. O listener de clique já mantém isto em dia, mas ele só dispara em
  // clique: a primeira troca de aba depois de um `showScreen` programático não
  // teria passado por ele.
  _abasLembrarDoProjeto();
  // M4 · observador. Trocar de projeto com outro aberto é FECHAR o que sai e
  // ABRIR o que entra, e as extensões precisam dos dois avisos: quem aloca
  // por projeto no `abriu` e libera no `fechou` (a moldura de "Tingir a
  // janela", o servidor de "Servidor local com recarga") recebia N `abriu`
  // para um `fechou` só — o do "← Projetos". ANTES de `currentProject`
  // trocar, senão o aviso sairia sem dizer qual projeto fechou.
  const projetoAnterior = currentProject;
  const trocou = name !== projetoAnterior;
  if (trocou && projetoAnterior && typeof xtEmitir === 'function') {
    xtEmitir('projeto.fechou', { projeto: projetoAnterior });
  }
  currentProject = name;
  // Depois de `currentProject` trocar, para a extensão que for ler o projeto
  // já achar o novo — e nunca antes, que entregaria a ela o projeto que está
  // saindo. E só quando trocou de verdade: reentrar no mesmo projeto (o
  // caminho de `preservarStream`) não é abrir de novo.
  if (trocou && name && typeof xtEmitir === 'function') xtEmitir('projeto.abriu', { projeto: name });
  // M5 · o cache de símbolos do autocomplete é POR PROJETO. Sem esta linha,
  // abrir outro projeto ofereceria as sugestões do anterior — um defeito que
  // ninguém liga à causa.
  if (typeof xtEsquecerSimbolos === 'function') xtEsquecerSimbolos();
  currentChatId  = null;
  currentDesignChatId = null; // Reset também do design
  // A Fila também zera. Ela era a única das três que sobrevivia à troca de
  // projeto: a lista do projeto anterior continuava em memória, e com ela o
  // `_filaRodando` — que escondia o "Iniciar tarefas" do projeto novo por
  // causa de uma tarefa que nem é dele.
  _filaLimparEstado();
  if (!preservarStream) {
    isStreaming = false;
    // ⚠️ `isStreaming = false` sozinho não bastava: o `disabled` no DOM só sai
    // por `setChatInputEnabled(true)`. Trocando de projeto durante o streaming, a
    // caixa de texto do projeto NOVO ficava morta até a resposta do anterior
    // terminar — e o dono do stream continuava carimbado no chat antigo.
    encerrarStreamDoChat();
    setChatInputEnabled(true);
    // ⚠️ Destravar as caixinhas entra AQUI DENTRO, junto do resto do reset.
    // `_unlockContextCheckboxes` não só as reabilita: ele escreve
    // `_chatHasHistory = false`. Com uma resposta em curso, elas estão travadas
    // porque o envio as travou — e destravá-las de fora faria o contexto
    // inicial daquela conversa ser mandado de novo, duplicado e sem aviso, na
    // mensagem seguinte.
    _unlockContextCheckboxes();
  }
  workspaceConfig = { root_folder: null, working_folders: [], ignore_list: [], context_items: [], main_file: null };

  // Abas de projetos abertos: entrar num projeto que ainda não estava na lista
  // abre uma aba nova; entrar num que já estava só troca qual fica `.active`.
  const jaEstavaAberto = openProjects.includes(name);
  if (!jaEstavaAberto) openProjects.push(name);
  if (typeof renderOpenProjectTabs === 'function') renderOpenProjectTabs();

  // Um projeto sendo aberto PELA PRIMEIRA VEZ cai na primeira de tudo. Para
  // quem já estava aberto, este reset é só o ponto de partida — a navegação
  // salva é reposta logo abaixo, por cima.
  // ⚠️ DAQUI ATÉ O `finally` A MEMÓRIA DE ABAS FICA TRANCADA. Tudo o que
  // acontece no meio é o programa repondo a tela, com o DOM a meio caminho
  // entre o projeto que saiu e o que entrou — e o listener de clique não pode
  // confundir isso com o usuário navegando. Ver `_abasRestaurando`.
  _abasRestaurando = true;
  try {
    _resetSubAbas();
    // Reentrar num projeto JÁ aberto restaura a aba principal em que ele estava
    // (`_projAbaAtiva`, app.js) em vez de sempre cair em "Projeto" — sem isto,
    // simplesmente trocar de aba de projeto (não abrir um novo) resetava a
    // navegação toda vez, o que incomoda muito mais agora que trocar de aba é
    // um gesto comum. Um projeto sendo aberto PELA PRIMEIRA VEZ continua caindo
    // na primeira aba, como sempre.
    const abaSalva = jaEstavaAberto && _projAbaAtiva[name];
    const btnSalvo = abaSalva && document.querySelector(`.tab-btn[data-tab="${abaSalva}"]`);
    if (btnSalvo) {
      // `.click()` e não só trocar classes: é o mesmo caminho do usuário
      // clicando, então os `init*Tab()` de cada aba rodam de novo — sem isso a
      // aba restaurada apareceria com o conteúdo de antes de o projeto ter sido
      // recarregado.
      btnSalvo.click();
      // E as SUB-abas dela. Vem DEPOIS do clique de cima: as barras de dentro
      // só existem para ser clicadas quando o painel delas é o que está na
      // tela, e é o `init` da aba principal que monta as que nascem em tempo
      // de execução.
      if (jaEstavaAberto) _abasRestaurarDoProjeto(name, document.getElementById(abaSalva));
    } else {
      _resetTabPrincipal();
    }
  } finally {
    // No `finally`: um erro em qualquer `init*Tab()` deixaria a memória de
    // abas trancada para o resto da sessão, e a partir daí nenhuma navegação
    // do usuário seria gravada.
    _abasRestaurando = false;
  }
  // ⚠️ AQUI HAVIA UM `visualizarResetar()`, E ELE SAIU DE PROPÓSITO.
  //
  // Ele existia porque o Visualizar (Automação) guardava o estado ao vivo em
  // globais de módulo sem noção de projeto: sem zerar, o primeiro repaint ao
  // entrar num projeto usava o estado do projeto ANTERIOR. Agora o estado é
  // por projeto (`_visPorProjeto`, em visualizar-acionamentos.js), então não
  // há mais o que vazar de um para o outro — e continuar zerando faria o
  // oposto do que se quer: apagaria o que aquele projeto acumulou enquanto a
  // aba dele estava atrás, que é exatamente a informação que a mudança para
  // baldes por projeto existe para preservar.
  //
  // `visualizarResetar` continua viva e continua sendo chamada pelo botão
  // "Limpar dados gerados", que é o gesto que de fato apaga o que foi gerado.
  // Quem repinta o desenho ao entrar num projeto é `_visCarregar` →
  // `_visDesenhar`, pelo dispatch da sub-aba (ver `initAgentesTab`).

  showScreen('project-screen'); // mostra imediatamente, sem esperar LM Studio

  loadWorkspace(); // sem await — popula workspace em background
  initChat();      // sem await — carrega modelos e chats em background
  // A Fila entra aqui pelo mesmo motivo que o Chat: ela era a única sub-aba de
  // Assistente que só começava a carregar no clique, e por isso abria vazia por
  // um instante enquanto o Chat já abria pronto. É uma leitura de JSON no disco.
  initFilaTab();   // sem await — carrega as tarefas da fila em background
  updateContextTokenBadges(); // sem await — conta tokens dos agentes de contexto
  initArquivosTab(); // sem await — carrega aba Arquivos em background
  // O Preparar saiu da aba Arquivos e virou sub-aba de Projeto: a prévia dele
  // era disparada pelo `initArquivosTab`, e agora se carrega sozinha.
  initPrepararTab(); // sem await — carrega presets e prévia em background
  loadDesignSessions(); // sem await — carrega sessões de design em background
  // A bolinha de "tem coisa rodando" nas abas Automação e Assistente. Começa
  // aqui porque só faz sentido dentro de um projeto, e é aqui que `isStreaming`
  // já é zerado — os dois sinais nascem juntos. Ver `abas-processando.js`.
  iniciarSinalDasAbas();
}

// Aba PRINCIPAL só (Projeto/Assistente/Automação/…) — separada de
// `_resetSubAbas` porque `enterProject` às vezes restaura a principal salva
// em vez de resetá-la, mas as sub-abas aninhadas sempre voltam pra primeira.
function _resetTabPrincipal() {
  document.querySelectorAll('.tab-btn').forEach((b, i)       => b.classList.toggle('active', i === 0));
  document.querySelectorAll('.tab-content').forEach((c, i)   => { c.classList.toggle('active', i === 0); c.classList.toggle('hidden', i !== 0); });
}

function _resetSubAbas() {
  document.querySelectorAll('.subtab-btn').forEach((b, i)    => b.classList.toggle('active', i === 0));
  document.querySelectorAll('.subtab-content').forEach((c, i) => { c.classList.toggle('active', i === 0); c.classList.toggle('hidden', i !== 0); });
  document.querySelectorAll('.analise-tab-btn').forEach((b, i)     => b.classList.toggle('active', i === 0));
  document.querySelectorAll('.analise-tab-content').forEach((c, i) => { c.classList.toggle('active', i === 0); c.classList.toggle('hidden', i !== 0); });
  document.querySelectorAll('.mapas-tab-btn').forEach((b, i)       => b.classList.toggle('active', i === 0));
  document.querySelectorAll('.mapas-tab-content').forEach((c, i)   => { c.classList.toggle('active', i === 0); c.classList.toggle('hidden', i !== 0); });
  document.querySelectorAll('.insp-tab-btn').forEach((b, i)        => b.classList.toggle('active', i === 0));
  document.querySelectorAll('.insp-tab-content').forEach((c, i)    => { c.classList.toggle('active', i === 0); c.classList.toggle('hidden', i !== 0); });
  document.querySelectorAll('.prep-tab-btn').forEach((b, i)        => b.classList.toggle('active', i === 0));
  document.querySelectorAll('.prep-tab-content').forEach((c, i)    => { c.classList.toggle('active', i === 0); c.classList.toggle('hidden', i !== 0); });
}

function resetToFirstTab() {
  _resetTabPrincipal();
  _resetSubAbas();
}
