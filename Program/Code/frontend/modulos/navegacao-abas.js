// ══ NAVEGAÇÃO → as sub-abas lembradas por projeto ═════════════════════════
//
// ⚠️ LEMBRAR É POR PROJETO, e não global. Com vários projetos abertos, cada um
// volta para onde estava — um estado global faria trocar de projeto levar o
// usuário para a aba do outro.
//
// ⚠️ `_ABAS_FORA_DO_PROJETO` LISTA O QUE NÃO SE LEMBRA. São as abas da tela
// Projetos: guardá-las junto faria entrar num projeto e cair numa aba que só
// existe fora dele.
//
// ⚠️ `_abasRestaurando` EXISTE PARA A RESTAURAÇÃO NÃO SE GRAVAR. Sem a guarda,
// o clique programático que restaura a aba dispara o gravador, e o que se
// lembra passa a ser o resultado da própria restauração.

// ── Sub-abas lembradas por projeto ──────────────────────────────────────────
//
// O DOM é um só, e a marca `.active` de uma sub-aba não pertence a projeto
// nenhum: abrir Assistente › Designer no projeto B fazia o projeto A voltar no
// Designer também. `_resetSubAbas` não resolve — ele nem cobre todas as
// famílias de barra, e forçar tudo para a primeira jogaria fora a navegação do
// projeto em vez de guardá-la.
//
// A chave de cada barra é o `data-taborder-group`, e o "valor de navegação" do
// botão é o único `data-*` dele que não começa com `taborder`. As duas
// convenções são as mesmas que `tab-order.js` já usa para descobrir as barras
// sozinho — uma barra nova entra aqui sem ninguém editar este arquivo.

// A barra da TELA DE PROJETOS não é de projeto nenhum. Lembrá-la por projeto
// faria a grade inicial pular de aba conforme o último projeto aberto.
const _ABAS_FORA_DO_PROJETO = new Set([
  'project_screen_tabs',   // a grade inicial
  'garq_subtabs',          // Arquivos da TELA DE PROJETOS (arquivos-template.js)
  'config_categorias',     // o trilho de Configurações (config-template.js)
]);

// ⚠️ TRAVA DE REENTRÂNCIA, E ELA É O CONSERTO DE UM BUG REAL.
//
// `_abasLembrarDoProjeto` é chamada por um listener de clique no documento, e
// a restauração de abas CLICA em botões. Sem esta trava, a restauração
// alimentava o próprio listener:
//
//   1. `enterProject` troca `currentProject` para o projeto NOVO;
//   2. faz `btnSalvo.click()` para repor a aba principal — e esse botão está
//      dentro da barra `main_tabs`, então o listener dispara;
//   3. o listener grava, no mapa do projeto NOVO, o `.active` que está no DOM
//      naquele instante — que ainda é o do projeto ANTIGO;
//   4. a restauração logo abaixo lê esse mapa já corrompido, encontra o valor
//      que já está na tela e não clica em nada.
//
// Era exatamente o sintoma: a aba principal obedecia (ela é lida para
// `abaSalva` ANTES do clique) e a sub-aba ficava a do outro projeto.
//
// O mesmo valia dentro do laço de restauração: cada `btn.click()` de uma barra
// rasa corrompia a entrada das barras mais fundas antes de o laço chegar nelas.
let _abasRestaurando = false;

function _abasValorDeNavegacao(btn) {
  const chave = Object.keys(btn.dataset).find(k => !k.startsWith('taborder'));
  return chave ? btn.dataset[chave] : null;
}

// Guarda, para o projeto exibido, qual botão está ativo em cada barra.
function _abasLembrarDoProjeto() {
  // Enquanto a tela está sendo REPOSTA, os cliques são do programa e não do
  // usuário — e o DOM ainda está a meio caminho entre um projeto e outro.
  // Gravar aqui é gravar lixo. Ver `_abasRestaurando`, lá em cima.
  if (_abasRestaurando) return;
  if (!currentProject) return;
  const mapa = _projAbasAtivas[currentProject] || (_projAbasAtivas[currentProject] = {});
  document.querySelectorAll('[data-taborder-group]').forEach(bar => {
    if (_ABAS_FORA_DO_PROJETO.has(bar.dataset.taborderGroup)) return;
    const ativo = bar.querySelector('button.active');
    if (!ativo) return;
    const valor = _abasValorDeNavegacao(ativo);
    if (valor) mapa[bar.dataset.taborderGroup] = valor;
  });
}

// Toda troca de aba, de qualquer barra, atualiza a memória. Um listener só no
// documento, e não um em cada barra: as barras são fiadas em oito arquivos
// diferentes, e pendurar isto em cada uma seria oito lugares para esquecer.
//
// ⚠️ Na BOLHA, de propósito: assim ele roda DEPOIS do handler do próprio botão,
// que é quem move a marca `.active`. Na captura, leria o estado velho.
document.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const bar = btn.closest('[data-taborder-group]');
  if (bar) _abasLembrarDoProjeto();
});

function _abasProfundidade(el) {
  let n = 0;
  for (let p = el.parentElement; p; p = p.parentElement) n++;
  return n;
}

// Repõe as sub-abas salvas de `nome` que vivem DENTRO do painel da aba
// principal restaurada.
//
// ⚠️ Só as de dentro dele, e por economia: clicar nas barras das outras abas
// principais dispararia o `init` delas (Mapas, Inspetor, Aparência…) para
// painéis que ninguém está vendo. Quando o usuário for até lá, a barra ainda
// estará como ele deixou — o `.active` não é limpo ao sair —, e se não estiver,
// o init daquela aba cuida disso.
//
// ⚠️ CLICA, não troca classes na mão: cada família de barra esconde o painel de
// um jeito (umas só com `.active`, outras somando `.hidden`), e várias rodam um
// `init` lazy no clique. Reproduzir isso aqui seria uma segunda cópia da regra
// de navegação de oito telas.
function _abasRestaurarDoProjeto(nome, painel) {
  const mapa = _projAbasAtivas[nome];
  if (!mapa || !painel) return;
  const barras = [...painel.querySelectorAll('[data-taborder-group]')]
    // Da mais rasa para a mais funda: uma barra de terceiro nível pode estar
    // dentro do painel que a de segundo nível acabou de abrir.
    .sort((a, b) => _abasProfundidade(a) - _abasProfundidade(b));
  barras.forEach(bar => {
    const alvo = mapa[bar.dataset.taborderGroup];
    if (!alvo) return;
    const btn = [...bar.children].find(
      el => el.tagName === 'BUTTON' && _abasValorDeNavegacao(el) === alvo);
    if (btn && !btn.classList.contains('active')) btn.click();
  });
}

async function goBackToProjects() {
  // O aviso de "tem coisa rodando", quando as Configurações pedem. Ele fica
  // aqui, e não no botão: o gesto de sair do projeto passa por esta função, e
  // pendurá-lo no clique deixaria de fora qualquer outro caminho que a chame.
  //
  // ⚠️ É AVISO, não trava. Sair não interrompe a pesquisa — ela continua
  // rodando, e voltar ao projeto a reencontra no meio. Ver
  // `deve_confirmar_saida_do_projeto` (configuracoes.py) e o ⛔ de
  // `confirmarSaidaDoProjeto` (encerramento.js).
  //
  // ⚠️ Uma falha aqui NÃO pode prender ninguém dentro do projeto: se a pergunta
  // não conseguir ser feita, a saída acontece. É a mesma regra do handler de
  // fechamento — nada que só informa tem o direito de bloquear.
  //
  // ⚠️ Isto NÃO fecha nenhuma aba de projeto aberta. "← Projetos" só troca qual
  // tela aparece — os projetos continuam abertos na tira de abas, e cada um
  // continua com seu ciclo/chat rodando em segundo plano do jeito que já
  // fazia. Fechar uma aba de verdade é outro gesto — o × dela, ver
  // `modulos/projetos-abertos.js`.
  if (currentProject) {
    try {
      const d = await window.pywebview.api.deve_confirmar_saida_do_projeto();
      if (d && d.perguntar && !await confirmarSaidaDoProjeto(d.motivo)) return;
    } catch (e) { /* sem pergunta, sai */ }
  }
  // M4 · observador. ANTES de zerar, senão o aviso sairia sem dizer qual
  // projeto fechou — que é a única informação que ele carrega.
  if (currentProject && typeof xtEmitir === 'function') {
    xtEmitir('projeto.fechou', { projeto: currentProject });
  }
  currentProject = null;
  currentChatId  = null;
  // Para o poll do PROJETO ATUAL e apaga as duas marcas das abas internas
  // (Automação/Assistente) — fora de um projeto não há ciclo nem chat exibido.
  // O poll por-aba-de-projeto-aberta (bolinha na tira de cima) é outro, e
  // continua rodando independente da tela mostrada — ver projetos-abertos.js.
  pararSinalDasAbas();
  if (typeof renderOpenProjectTabs === 'function') renderOpenProjectTabs();
  showScreen('projects-screen');
  // ⚠️ "← Projetos" tem que voltar pra ABA "Projetos" — não só pra TELA de
  // Projetos. Sem isto, quem clicava o botão estando na sub-aba Plugins (fora
  // de um projeto) via a tela não mudar nada: já estava na tela de Projetos,
  // só que numa sub-aba diferente. `project_screen_tabs` é a única barra que
  // fica de fora da memória de navegação por projeto (ver
  // `_ABAS_FORA_DO_PROJETO`, acima) — de propósito, mas isso não significa que
  // o botão de voltar deva ignorá-la.
  const btnAbaProjetos = document.querySelector('.main-tab-btn[data-ptab="ptab-projetos"]');
  if (btnAbaProjetos && !btnAbaProjetos.classList.contains('active')) btnAbaProjetos.click();
  loadProjects();
}
