// ══════════════════════════ ABAS DE PROJETOS ABERTOS AO MESMO TEMPO ══
// A tira de abas no topbar compartilhado (index.html, fora das duas `.screen`)
// — uma por projeto em `openProjects` (app.js). Continua visível tanto na
// grade de Projetos quanto dentro de um projeto aberto, porque é a mesma
// pergunta em duas telas: "quais projetos estão abertos agora, e qual deles
// estou vendo".
//
// ⚠️ Trocar de aba NÃO duplica estado: chama `enterProject(nome)`, o mesmo
// caminho de sempre (recarrega workspace/chat/fila do disco — é leitura
// local, é rápido). O que este arquivo acrescenta é só a lista de quem está
// aberto e o × de fechar; a tela de um projeto continua sendo uma instância
// só, reaproveitada a cada troca.
//
// Precisa rodar depois de `navegacao.js` (usa `enterProject`/`goBackToProjects`
// e os globais `currentProject`/`openProjects`) e depois de `encerramento.js`
// (usa `confirmarFecharAbaDeProjeto`).

// Nome do projeto → `''` | `'processando'` | `'bloqueado'`. Vive solto daqui, e
// não dentro de `openProjects`, porque é só cache de exibição — refeito a cada
// volta do poll, nunca a fonte da verdade (essa é o backend).
//
// ⚠️ São TRÊS estados, e não dois. A tira dizia só "tem coisa rodando aqui", e
// com duas abas ligadas ao mesmo tempo isso apagava metade da história: o
// projeto que está na fila da janela do LM Studio ficava igualzinho ao projeto
// que não tem nada ligado. Agora ele tem a marca própria — a mesma cor e o
// mesmo nome do estado `bloqueado` da sub-aba Visualizar, porque é o mesmo
// fato visto de outro lugar.
let _projAbertosRodando = {};

function renderOpenProjectTabs() {
  const bar = document.getElementById('open-projects-bar');
  if (!bar) return;
  bar.innerHTML = openProjects.map(nome => {
    const marca = _projAbertosRodando[nome] || '';
    // O title diz o estado por extenso: a bolinha sozinha não ensina o que a
    // cor dela quer dizer, e esta tira não tem legenda ao lado (a do
    // Visualizar tem).
    const dica = marca === 'processando' ? `${nome} — rodando agora`
               : marca === 'bloqueado'   ? `${nome} — esperando outro projeto liberar a IA`
               : nome;
    return `
    <button type="button" class="open-project-tab${nome === currentProject ? ' active' : ''}${marca ? ' ' + marca : ''}"
            data-projeto="${escapeHtml(nome)}" title="${escapeHtml(dica)}">
      <span class="open-project-tab-nome">${escapeHtml(nome)}</span>
      <span class="open-project-tab-fechar" data-fechar="${escapeHtml(nome)}" title="Fechar ${escapeHtml(nome)}">&times;</span>
    </button>`;
  }).join('');

  bar.querySelectorAll('.open-project-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const nome = btn.dataset.projeto;
      if (nome !== currentProject) enterProject(nome);
    });
  });
  bar.querySelectorAll('.open-project-tab-fechar').forEach(x => {
    x.addEventListener('click', (e) => {
      e.stopPropagation();  // não deixa o clique cair também no botão da aba
      fecharAbaDeProjeto(x.dataset.fechar);
    });
  });
}

// ── Fechar uma aba ───────────────────────────────────────────────────────────
/**
 * O × de uma aba. Pergunta quando AQUELE projeto especificamente está ocupado
 * (`fechar_projeto`, configuracoes.py); confirmado — ou se não havia nada
 * rodando —, fecha de verdade: para a vigilância do Detector daquele projeto e
 * pede corte imediato ao que estiver usando a IA nele. Ver
 * `executar_fechar_projeto` para o porquê de nunca matar thread nenhuma.
 */
async function fecharAbaDeProjeto(nome) {
  let resp;
  try {
    resp = await window.pywebview.api.fechar_projeto(nome);
  } catch (e) {
    resp = { success: true, perguntar: false };
  }
  if (resp && resp.perguntar) {
    const ok = await confirmarFecharAbaDeProjeto(nome, resp.motivo);
    if (!ok) return;
  }
  try {
    await window.pywebview.api.executar_fechar_projeto(nome);
  } catch (e) {
    // Uma falha aqui não pode prender a aba aberta para sempre — a tela fecha
    // de qualquer jeito, e o pior caso é a vigilância daquele projeto continuar
    // de pé por engano (o mesmo estado de hoje, antes desta função existir).
  }
  delete _projAbertosRodando[nome];
  openProjects = openProjects.filter(p => p !== nome);
  // Fechar a aba é o fim do projeto NESTA sessão de tela. Tudo que era
  // lembrado por nome de projeto sai junto — senão reabrir o mesmo projeto
  // depois ressuscita a aba em que ele estava (`_projAbaAtiva`) e deixa de
  // zerar os acionamentos (`_acJaZerados`), que é justamente o que a abertura
  // de um projeto tem que fazer. Ver `initAcionamentosTab`.
  delete _projAbaAtiva[nome];
  delete _projAbasAtivas[nome];
  if (typeof _acJaZerados !== 'undefined') _acJaZerados.delete(nome);
  if (typeof acionamentosEsquecerProjeto === 'function') acionamentosEsquecerProjeto(nome);
  if (typeof visualizarEsquecerProjeto === 'function') visualizarEsquecerProjeto(nome);
  // O Editor guarda os arquivos abertos por projeto para devolvê-los ao
  // reentrar; fechar a aba é justamente dizer que essa sessão acabou.
  if (typeof edEsquecerProjeto === 'function') edEsquecerProjeto(nome);

  if (currentProject === nome) {
    if (openProjects.length) {
      enterProject(openProjects[openProjects.length - 1]);
    } else {
      // M4 · observador. ANTES de zerar — ver a mesma emissão em
      // `navegacao-abas.js`.
      if (currentProject && typeof xtEmitir === 'function') {
        xtEmitir('projeto.fechou', { projeto: currentProject });
      }
      currentProject = null;
      currentChatId  = null;
      pararSinalDasAbas();
      showScreen('projects-screen');
      loadProjects();
    }
  }
  renderOpenProjectTabs();
}

// ── A bolinha de "rodando" de cada aba aberta ───────────────────────────────
// Não é o mesmo poll de `abas-processando.js` — aquele é da aba FEATURE
// (Automação/Assistente) dentro do projeto EXIBIDO agora; este é por PROJETO
// ABERTO, exibido ou não, e por isso pergunta ao backend um de cada vez.
async function _projAbertosConferir() {
  if (!openProjects.length) return;
  for (const nome of [...openProjects]) {
    try {
      const r = await window.pywebview.api.get_processando(nome);
      const vivos = (r && r.success)
        ? (r.processando || []).length + (r.esperando || []).length : 0;
      // A TRAVA_IA também conta: Fila/Designer/Backup rodam em thread sem
      // aparecer em `get_processando` (isso é só das rotinas de Automação) —
      // é a mesma composição que `abas-processando.js` já faz para a bolinha
      // do Assistente, generalizada aqui para qualquer projeto aberto.
      const travaAqui = _travaIAUltimo && _travaIAUltimo.projeto === nome;
      // Quem está segurando a janela do LM Studio, quando não é este projeto.
      // Vem de `get_processando` de propósito — ver a docstring dela.
      const preso = r && r.bloqueado_por_projeto && r.bloqueado_por_projeto !== nome;
      // ⚠️ A ORDEM IMPORTA: "rodando" ganha de "esperando". Um projeto pode ter
      // uma rotina viva E outra na fila da trava ao mesmo tempo, e nesse caso o
      // que interessa dizer é que ele está trabalhando.
      _projAbertosRodando[nome] = (vivos > 0 || travaAqui) ? 'processando'
                                : preso                    ? 'bloqueado'
                                : '';
    } catch (e) {
      // Projeto pode estar no meio de fechar — a próxima passada corrige.
    }
  }
  renderOpenProjectTabs();
}

setInterval(() => {
  if (window.pywebview && window.pywebview.api) _projAbertosConferir();
}, 3000);
