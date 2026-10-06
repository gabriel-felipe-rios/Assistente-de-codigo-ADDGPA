// ══════════════════════════════════════════════════════ ABA: ACIONAMENTOS ══
//
// ── Este arquivo era 880 linhas, e virou quatro ───────────────────────────
//
// Pelo teto de 500 da AMF. Cada um responde uma pergunta:
//
//   acionamentos.js          o estado, a montagem e os botões
//   acionamentos-limpar.js   apagar dados gerados
//   acionamentos-estado.js   os interruptores e a faixa de retomada
//   acionamentos-status.js   o que a tela mostra enquanto o ciclo roda
//
// ⚠️ SÃO SCRIPTS CLÁSSICOS, NÃO MÓDULOS: as funções e os `let` do topo
// continuam globais, e uma função de um arquivo chama a de outro exatamente
// como chamava antes. O `index.html` carrega os quatro na ordem acima.
//
// ⚠️ O ESTADO MORA TODO AQUI — `_acSettings`, `_acCiclosRodando`,
// `AC_NOMES_AGENTES` e os irmãos. Os outros três leem e escrevem neles.

let _acSettings   = {};

// Quais projetos já tiveram os acionamentos zerados NESTA abertura do programa.
//
// ⚠️ Era `_acLastProject` (o último projeto visto), e com abas de projeto isso
// virou um defeito grave: `_acLastProject !== currentProject` é verdade toda
// vez que se TROCA de aba, então voltar para uma aba que já estava aberta
// disparava `restore_acionamentos_espera` e DESLIGAVA a automação daquele
// projeto no meio do ciclo dele. A→B→A matava o ciclo de A.
//
// A razão de segurança do reset continua inteira (ver a docstring de
// `restore_acionamentos_espera`, em acionamentos_config.py): nada que chama
// LLM pode religar sozinho quando o programa abre. O que muda é só a pergunta
// — de "mudou de projeto?" para "este projeto já foi ABERTO nesta sessão?".
// Fechar a aba pelo × tira o nome daqui (ver `fecharAbaDeProjeto`), porque
// reabrir um projeto fechado é uma abertura de verdade e deve zerar de novo.
const _acJaZerados = new Set();

// O ciclo disparado por um botão de ligar ('Ativar o principal' ou 'Ativar
// tudo') pode levar minutos (arquivo grande de verdade demora). Enquanto ele está
// rodando, o botão fica com uma borda pulsando, pra quem deixou a aba aberta
// continuar sabendo que está nesse modo — sem precisar ficar olhando o texto
// de status. Guarda o ID do botão que deu a partida, e não um booleano: são
// dois botões diferentes, e o pulso tem que sair de onde entrou.
//
// ⚠️ `projeto → id do botão`, e antes era um id solto. Os dois ids são únicos
// no DOM, que é um só: clicar "Ativar tudo" no projeto A e trocar para B
// mostrava o botão de B pulsando por um ciclo que não é dele. E a limpeza
// estava quebrada nas DUAS direções — o fim de ciclo de A nunca apagava a
// marca enquanto B estava na tela (o guard de projeto de
// `acionamentosEsperaStatus` retorna antes de chegar lá), e um `idle` de B
// apagava a marca de um ciclo de A que ainda estava rodando.
const _acCiclosRodando = {};

const _AC_BOTOES_DE_CICLO = ['btn-ac-ativar-tudo', 'btn-ac-ativar-principal'];

// Repinta a borda a partir do mapa. É ela que faz a marca seguir a aba de
// projeto, em vez de ficar presa no DOM.
function _acRepintarBordaDoCiclo() {
  _AC_BOTOES_DE_CICLO.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle('ac-ciclo-rodando', _acCiclosRodando[currentProject] === id);
  });
}

// Fechar a aba joga fora a marca daquele projeto, como todo o resto que é
// lembrado por nome (ver `fecharAbaDeProjeto`, projetos-abertos.js).
function acionamentosEsquecerProjeto(nome) {
  delete _acCiclosRodando[nome];
}

// Id da rotina → nome que o usuário lê. Fica no módulo, e não dentro de uma
// função, porque duas coisas precisam dele: o texto da bolinha global e o aviso
// de "pulado por causa de X" no card. Uma tabela de nomes só, num lugar só.
const AC_NOMES_AGENTES = {
  'detector':         'Detector',
  'espera':           'Espera',
  'revezamento':      'Revezamento',
  'hashes':           'Hashes',
  'sincronia':        'Sincronia',
  'identificadores':  'Índice de Identificadores',
  'grafo-imports':    'Grafo de Imports',
  'doc-tecnica':      'Doc. Técnica',
  'resumo-pastas':    'Resumo de Pastas',
  'indice-navegacao': 'Índice de Navegação',
  'bibliotecas':      'Bibliotecas',
  'comentarios':      'Comentários',
  'indice-simbolos':  'Índice de Símbolos',
  'duplicados':       'Duplicados',
  'glossario':        'Glossário',
  'pipeline':         'Pipeline',
  'embedding':        'Embedding Semântico',
};

async function initAcionamentosTab() {
  // O nome vem ANTES do `await`: trocar de aba de projeto no meio de uma
  // chamada em voo fazia a resposta do projeto antigo pintar na tela do novo.
  // Mesmo padrão de `_abasConferirAutomacao` (abas-processando.js).
  const proj = currentProject;
  const r = await window.pywebview.api.get_acionamentos(proj);
  if (proj !== currentProject) return;
  if (r.success) _acSettings = r.settings;
  _acCarregarPendencias();
  // A decisao da ultima passada, ao abrir a sub-aba: sem isto ela so apareceria
  // depois do proximo ciclo, e quem abre a tela para entender o que acabou de
  // acontecer nao veria nada.
  _acPintarDecisaoDoDetector();

  // Os wires são idempotentes por conta própria (`btn._acWired`, `_acWired` em
  // cada um deles), então não dependem mais da condição do reset — eram duas
  // coisas diferentes penduradas na mesma pergunta.
  _acWireToggles();
  _acWireRunOnce();
  _acWireBotoesGlobais();

  // Zera os acionamentos na ABERTURA do projeto — o programa reabrindo do zero
  // ou este projeto entrando na tira de abas pela primeira vez. Nada que chama
  // LLM ou mexe em arquivo pode religar sozinho; a settings devolvida aqui já
  // vem toda 'off', e é ela (não a de `get_acionamentos` acima, que pode estar
  // desatualizada) que a tela usa para desenhar os toggles.
  //
  // ⚠️ NÃO roda ao trocar de aba de projeto. Ver `_acJaZerados`, lá em cima.
  if (!_acJaZerados.has(proj)) {
    _acJaZerados.add(proj);
    const rReset = await window.pywebview.api.restore_acionamentos_espera(proj);
    // O `await` acima deixa a janela aberta para uma troca de aba no meio.
    // Sem esta reconferência, a settings zerada de um projeto pintaria os
    // toggles do outro.
    if (proj !== currentProject) return;
    if (rReset.success) _acSettings = rReset.settings;
  }

  _acRenderToggles();
  _acUpdateGlobalStatus();
  _acLoadLastRuns();
  _acRefreshEsperaRow();
  // A borda pulsando segue a aba: quem disparou um ciclo neste projeto a
  // reencontra ao voltar, e quem não disparou não a vê.
  _acRepintarBordaDoCiclo();
}

// O toggle da Espera é renderizado por _acRenderToggles como qualquer outro
// (data-agent="espera"); aqui só se atualiza o que depende do estado real da
// thread — bolinha, tempos e os espelhos em Rotinas e Visualizar.
//
// A BASE anda junto: quem diz se o Detector está de pé é `vigiando`, e não a
// chave da Espera. Desligar o freio não desliga a vigilância.
async function _acRefreshEsperaRow() {
  const proj = currentProject;
  const r = await window.pywebview.api.get_espera_status(proj);
  // Trocar de aba no meio da chamada faria o estado da Espera de um projeto
  // pintar a linha do outro.
  if (proj !== currentProject) return;
  if (!r.success) return;
  const dot = document.getElementById('ac-espera-dot');
  if (dot) dot.className = 'ac-dot ' + (r.ativo ? 'ac-dot-active' : 'ac-dot-idle');
  // Os três tempos (T1/T2/T3), na ordem em que disparam.
  const d = r.debounces || {};
  const trio = `${d.t1 ?? r.debounce_segundos}s / ${d.t2 ?? '—'}s / ${d.t3 ?? '—'}s`;
  const deb = document.getElementById('ac-espera-debounce');
  if (deb) {
    deb.textContent = r.espera_ligada ? `${trio} de silêncio` : 'libera na hora';
  }
  const detDot = document.getElementById('ac-detector-dot');
  if (detDot) {
    detDot.className = 'ac-dot ' + (r.vigiando ? 'ac-dot-active' : 'ac-dot-idle');
  }
  _acPintarRevezamento(r, proj);
  if (typeof esperaAtualizarEstado === 'function') esperaAtualizarEstado(r);
  if (typeof revezamentoAtualizarEstado === 'function') revezamentoAtualizarEstado(r);
  if (typeof visualizarEsperaEstado === 'function') {
    visualizarEsperaEstado(r.ativo,
                           r.espera_ligada ? `Escutando · ${trio}` : 'Sem freio',
                           r.vigiando, proj);
  }
  if (typeof visualizarRevezamentoEstado === 'function') {
    visualizarRevezamentoEstado(r.aguardando_trava, r.bloqueado_por_projeto, proj);
  }
  // A espera de cada grupo, na Situação do Visualizar.
  if (typeof _visResumoGrupos === 'function') _visResumoGrupos(r, proj);
}

// A linha do Revezamento, na seção "A base".
//
// ⚠️ SAIU DE DENTRO DA ESPERA em 28/08/2026, e não foi arrumação: `aguardando_trava`
// nunca foi assunto do freio. Enquanto os dois moravam na mesma linha, DESLIGAR
// a Espera — que tem chave, e é o gesto natural de quem quer que o ciclo comece
// logo — apagava junto a única frase que dizia "a janela do LM Studio está com
// outro projeto". O usuário ficava sem nada na tela explicando por que não
// acontecia nada. O Revezamento não tem chave, então essa frase não some mais.
function _acPintarRevezamento(r, proj) {
  const dot = document.getElementById('ac-revezamento-dot');
  const est = document.getElementById('ac-revezamento-estado');
  const deOutraAba = r.bloqueado_por_projeto && r.bloqueado_por_projeto !== proj;
  if (dot) {
    // Índigo (`ac-dot-bloqueado`) é ESPERANDO OUTRA ABA; o azul de sempre é
    // esperando outra tarefa daqui mesmo. Duas causas, duas cores — é a mesma
    // distinção que a sub-aba Visualizar faz na caixa dele.
    dot.className = 'ac-dot ' + (!r.aguardando_trava ? 'ac-dot-idle'
                              : deOutraAba ? 'ac-dot-bloqueado' : 'ac-dot-running');
  }
  if (est) {
    est.textContent = !r.aguardando_trava ? 'janela livre'
                    : deOutraAba ? `aguardando "${r.bloqueado_por_projeto}"`
                    : r.aguardando_trava;
    est.title = est.textContent;
  }
  // A bolinha global continua dizendo o motivo do "parado": sem esta frase,
  // esperar a vez era indistinguível de não ter acontecido nada.
  if (r.aguardando_trava) {
    _acSetDot('running', 'Mudança detectada — ' + r.aguardando_trava);
  }
}

function _acWireToggles() {
  document.querySelectorAll('.ac-toggle[data-agent]').forEach(btn => {
    if (btn._acWired) return;
    btn._acWired = true;
    btn.addEventListener('click', async () => {
      const agentId  = btn.dataset.agent;
      const trigger  = btn.dataset.trigger;
      const estaAtivo = btn.classList.contains('active');
      const newVal   = estaAtivo ? 'off' : trigger;
      _acSettings[agentId] = newVal;
      btn.classList.toggle('active', !estaAtivo);
      btn.textContent = estaAtivo ? 'Desativado' : 'Ativado';
      await window.pywebview.api.set_acionamento(currentProject, agentId, newVal);
      _acRepintarLigacao(agentId, newVal);
    });
  });
}

// D2: ligar uma rotina — pelo toggle daqui ou pelo ▶ Executar da sub-aba
// Rotinas — repinta a tela toda, como os botões globais: o toggle, a base
// (Detector, Hashes, Sincronia acendem com qualquer rotina — D3) e o
// Visualizar. O toggle individual repintava só o próprio botão, e a base
// parecia não ter reagido.
function _acRepintarLigacao(agentId, valor) {
  _acRenderToggles();
  _acUpdateGlobalStatus();
  _acRefreshEsperaRow();
  const balde = (typeof _visBalde === 'function') ? _visBalde() : null;
  if (balde && balde.dados) {
    balde.dados.settings = { ...(balde.dados.settings || {}), [agentId]: valor };
    if (typeof _visMarcarDesligados === 'function') _visMarcarDesligados();
    if (typeof _visResumoLigados === 'function') _visResumoLigados();
  }
}

// D2: mandar executar uma rotina é ATIVÁ-LA — «se eu coloquei ele pra
// rodar, meio que eu ativei ele». Chamado pelo ▶ Executar dos cards da
// sub-aba Rotinas (`rotinaCliqueLiberado`, rotinas-cards.js), com o id do
// acionamento. Já ativada, não mexe. A base (Detector, Hashes, Sincronia)
// não tem toggle e não passa por aqui (D3).
async function acionamentosAtivarRotina(agentId) {
  const proj = currentProject;
  const btn = document.querySelector(`.ac-toggle[data-agent="${agentId}"]`);
  if (!btn || !proj) return;
  // ⚠️ A ABERTURA ZERA OS ACIONAMENTOS (ver `initAcionamentosTab`, e
  // `_acJaZerados`). Se a sub-aba Acionamentos ainda não abriu neste
  // projeto, o zero vem AGORA — senão ele viria depois e apagaria o que o
  // ▶ acabou de ligar.
  if (!_acJaZerados.has(proj)) {
    _acJaZerados.add(proj);
    await window.pywebview.api.restore_acionamentos_espera(proj);
    if (proj !== currentProject) return;
  }
  // Lido na hora: `_acSettings` pode ser de outro projeto, se a sub-aba
  // Acionamentos foi aberta por último lá.
  const r = await window.pywebview.api.get_acionamentos(proj);
  if (proj !== currentProject || !r.success) return;
  _acSettings = r.settings;
  if ((_acSettings[agentId] || 'off') !== 'off') return;
  const valor = btn.dataset.trigger;
  _acSettings[agentId] = valor;
  await window.pywebview.api.set_acionamento(proj, agentId, valor);
  if (proj !== currentProject) return;
  _acRepintarLigacao(agentId, valor);
}

function _acWireRunOnce() {
  document.querySelectorAll('.ac-run-once[data-run-agent]').forEach(btn => {
    if (btn._acWired) return;
    btn._acWired = true;
    btn.addEventListener('click', async () => {
      const agentId = btn.dataset.runAgent;
      // A trava de cinco pontas: rodar uma rotina agora é chamar o LM Studio,
      // e não pode acontecer com o Chat, a Fila ou o Designer usando a janela.
      // Conferida no clique porque o poll só repinta de 4 em 4 segundos.
      if (typeof travaIALiberado === 'function' && !await travaIALiberado('rotinas')) return;
      _acRunOnceOcupado(true);
      const r = await window.pywebview.api.run_agent_once(currentProject, agentId);
      if (!r.success) {
        console.warn('run_agent_once:', r.error);
        _acRunOnceOcupado(false);
        showToast(r.error || 'Não deu para rodar agora.', true);
        if (r.trava && typeof aplicarTravaIA === 'function') aplicarTravaIA(r.trava);
      }
    });
  });
}

// Os botões do topo mexem em vários toggles de uma vez. Só mudam de qual
// método do backend chamam — o resto (re-render a partir das settings que
// voltam) é idêntico, então vive num lugar só.
//
//   Ativar o principal → o mesmo que Ativar tudo, MENOS Resumo de Pastas,
//                        Comentários e Duplicados.
//   Ativar tudo        → liga todas as rotinas, gera o que falta agora e sobe
//                        o Detector para vigiar daqui em diante.
//   Desativar tudo     → zera tudo e para o Detector.
//
// ⚠️ Os DOIS de ligar sobem o Detector e rodam um ciclo — a diferença entre
// eles é só QUANTAS rotinas ficam ligadas. Eram quatro até 28/08/2026, com
// dois modos de partida ('Início rápido' e 'Iniciar') que geravam sem vigiar;
// ver o comentário no `acionamentos-template.js` para o porquê da saída.
// Os ⟳ apagam em bloco enquanto uma rotina roda — é uma janela do LM Studio
// só, e não adianta enfileirar treze cliques. `travaIAOcupadoLocal` e não
// `disabled` direto: a marca é o que impede a pulsação de 4 s de reabri-los,
// já que dali a trava está com as próprias Rotinas e "não bloqueia" Rotinas.
function _acRunOnceOcupado(ocupado) {
  document.querySelectorAll('.ac-run-once[data-run-agent]').forEach(b => {
    if (typeof travaIAOcupadoLocal === 'function') travaIAOcupadoLocal(b, ocupado);
    else b.disabled = ocupado;
  });
}

function _acWireBotoesGlobais() {
  // ⚠️ `marcaRodando` nos DOIS de ligar, e não só num: a borda pulsando é o
  // único sinal de "o ciclo que você pediu começou" que esta faixa tem. Ela
  // ficava nos dois botões de partida que saíram, e o 'Ativar tudo' nunca a
  // recebeu — só que ele também roda um ciclo desde que deixou de apenas
  // ligar. Sem isto aqui, nenhum botão da faixa pulsaria mais.
  _acWireBotaoGlobal('btn-ac-ativar-principal', 'set_acionamentos_principais', { marcaRodando: true });
  _acWireBotaoGlobal('btn-ac-ativar-tudo',      'set_acionamentos_todos',      { marcaRodando: true });
  _acWireBotaoGlobal('btn-ac-desativar-tudo',   'set_acionamentos_nenhum');
  _acWireLimparDados();
}

function _acWireBotaoGlobal(btnId, apiMethod, opts) {
  const btn = document.getElementById(btnId);
  if (!btn || btn._acWired) return;
  btn._acWired = true;
  btn.addEventListener('click', async () => {
    // A trava de cinco pontas, conferida no clique: estes botões mandam gerar
    // agora, e um ciclo não pode começar com o Chat, a Fila ou o Designer
    // usando a janela do LM Studio.
    if (typeof travaIALiberado === 'function' && !await travaIALiberado('rotinas')) return;
    if (typeof travaIAOcupadoLocal === 'function') travaIAOcupadoLocal(btn, true);
    else btn.disabled = true;
    // Aviso de pulo é sobre O CICLO, não sobre o agente: um ciclo novo começa
    // com a tela limpa, senão o "pulado" da rodada passada fica valendo em
    // cima de uma rodada que ainda nem chegou naquele agente.
    document.querySelectorAll('.ac-dep-hint-pulado').forEach(hint => {
      hint.textContent = hint.dataset.textoOriginal;
      hint.classList.remove('ac-dep-hint-pulado');
    });
    // O projeto do CLIQUE, capturado antes do `await`: a marca da borda
    // pertence a ele, mesmo que o usuário troque de aba enquanto a chamada
    // está em voo.
    const proj = currentProject;
    try {
      const r = await window.pywebview.api[apiMethod](proj);
      if (r.success) {
        if (proj === currentProject) {
          _acSettings = r.settings;
          _acRenderToggles();
          _acUpdateGlobalStatus();
          _acRefreshEsperaRow();
        }
        // `aviso` = o ciclo não começou AGORA: está na fila, atrás de outro
        // projeto ou de outra ponta da IA, e começa sozinho quando a vez
        // chegar (ver `_ac_run_cycle_now` — ele enfileira, não recusa mais).
        //
        // ⚠️ NÃO É ERRO, e por isso o toast não é vermelho. Ele era, e a
        // mensagem antiga ('já existe um ciclo de rotinas rodando') somada à
        // cor de erro dizia "não vai acontecer" — quando na verdade vai.
        //
        // A borda pulsando ENTRA IGUAL: o botão disparou um ciclo, e ele vai
        // acontecer. Deixá-la de fora era o certo enquanto o ciclo era
        // recusado, e virou mentira quando ele passou a ser enfileirado — o
        // usuário não teria nada na tela ligando o clique ao ciclo que
        // apareceria depois.
        if (r.aviso) showToast(r.aviso);
        if (opts && opts.marcaRodando) {
          _acCiclosRodando[proj] = btnId;
          _acRepintarBordaDoCiclo();
        }
      } else {
        showToast('Não deu para aplicar: ' + (r.error || 'erro desconhecido'), true);
      }
    } finally {
      // Solta a marca local; quem decide se o botão fica aceso é a trava —
      // `disabled = false` direto reabria por cima dela.
      if (typeof travaIAOcupadoLocal === 'function') travaIAOcupadoLocal(btn, false);
      else btn.disabled = false;
      if (typeof atualizarTravaIA === 'function') atualizarTravaIA();
    }
  });
}

