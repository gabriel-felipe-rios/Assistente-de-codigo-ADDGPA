// ══════════════════════ ACESSO RÁPIDO: O CATÁLOGO DE COMANDOS ══
// A pergunta deste arquivo: **que ações do programa entram na barra sem ter
// tecla nenhuma.**
//
// ⚠️ O MODO COMANDO NÃO TEM CATÁLOGO PRÓPRIO. Ele lista o que o registro
// (`teclas.js`) conhece — e toda tecla registrada já é um comando, com `id`,
// `rotulo`, `grupo`, `ativo`, `motivo` e `fazer`. Este arquivo existe para o
// OUTRO lado: as ações que o programa tem e que nunca tiveram tecla. Elas nascem
// aqui, com `padrao: null`.
//
// ⚠️ Comando sem tecla é legítimo, e é o caso comum. Ele aparece na barra com
// "sem tecla" à direita e, na tela de Teclado, com o campo vazio — pronto para o
// usuário preencher se quiser.
//
// ⚠️ NADA QUE JÁ TEM TECLA SE DECLARA DE NOVO AQUI. As nove do Editor
// (`editor-teclas.js`), o `F2` da árvore, o `Ctrl+Z` da Oficina e as duas da
// própria barra já estão no registro, e a barra já as lista. Registrar o mesmo
// `id` duas vezes sobrescreve o primeiro EM SILÊNCIO.
//
// ⚠️ AS ABAS NÃO ENTRAM AQUI. "Ir para aba" é um modo próprio da barra, e ele se
// monta varrendo o DOM — as abas já são uma lista. Pôr as dezessete aqui seria
// manter a segunda lista das mesmas abas, e ela divergiria na primeira aba nova.
//
// ── O critério de quem entra ────────────────────────────────────────────────
//
// Entra o que o usuário faz por um caminho de dois ou três cliques e faria mais
// rápido digitando o nome. NÃO entra o que só faz sentido com uma seleção na mão
// (isso é gesto), nem o que exige preencher um formulário antes — nesse caso o
// comando é "abrir o formulário", e é assim que os de abrir modal estão escritos
// aqui.
//
// ⚠️ E a lista começa PEQUENA de propósito. Vinte comandos bem escolhidos são
// melhores que oitenta gerados varrendo botões: a barra é uma lista que o
// usuário lê, e uma lista que não cabe na tela deixa de ser mais rápida que o
// menu que ela veio substituir.
//
// ── O glifo ─────────────────────────────────────────────────────────────────
//
// ⚠️ GLIFO, NUNCA EMOJI. A convenção registrada é condicional — "botão cuja cor
// muda com o estado leva glifo" —, e o teste é "essa cor muda sozinha quando eu
// passo o mouse ou seleciono?". Na barra a resposta é SIM: a linha selecionada
// muda de cor ao navegar com as setas, e emoji não obedece a `color`, então
// ficaria aceso enquanto os vizinhos apagam.
//
// ⚠️ `editor-menus.js` NÃO SERVE DE MODELO. Ele tem 17 emojis entre os 40
// ícones, e não é defeito: o menu de contexto pinta o FUNDO no hover, não a cor
// do texto, que é a saída alternativa que a própria convenção prevê. É uma tela
// com regra diferente da barra — copiar o ícone de um item de menu para cá traz
// o emoji junto, e aí quebra.

// ── Os dois casos de borda, e como este arquivo os resolve ──────────────────
//
// **Comando cujo `fazer` depende de uma aba que não está aberta.** A saída certa
// é quase sempre a segunda das duas que a obra previu: o `fazer` ABRE A ABA e só
// então age. É o que o usuário quis dizer ao digitar o nome do comando — mandá-lo
// abrir a aba primeiro, para depois digitar o comando de novo, é devolver o
// trabalho que a barra existe para poupar.
//
// `acessoRapidoIrParaPainel` (em `acesso-rapido-modos.js`) leva a tela até o
// painel pelo id, abrindo a aba de cima quando o painel é uma sub-aba. É o mesmo
// caminho do clique do usuário, então o `init` daquela aba roda igual.
//
// ⚠️ O `init` de uma aba monta o DOM dela de forma síncrona, mas os dados vêm
// por `await`. Por isso um comando que precisa de um elemento CONFERE se ele
// chegou, e avisa em vez de estourar — `document.getElementById(...).value` sem
// guarda é o defeito clássico daqui.
//
// ⚠️ `await` na ida: `acessoRapidoIrParaPainel` sobe pela aba de cima antes de
// clicar na sub-aba, e cede o fio entre um nível e outro. Sem esperar, a
// conferência abaixo rodaria com a sub-aba ainda fechada.
async function _acrAgirNaAba(painelId, elementoNecessario, nomeDaAba, acao) {
  await acessoRapidoIrParaPainel(painelId);
  if (elementoNecessario && !document.getElementById(elementoNecessario)) {
    showToast(`Abra a aba ${nomeDaAba} uma vez antes deste comando.`, true);
    return;
  }
  acao();
}

// **Um projeto tem de estar aberto?** Quase todo comando de dentro do projeto
// precisa, e o motivo é sempre o mesmo texto — daí as duas funções abaixo, em
// vez de repetir a frase vinte vezes.
const _acrComProjeto = () => !!currentProject;
const _acrSemProjeto = () => !currentProject;
const _ACR_SEM_PROJETO = 'nenhum projeto aberto';
const _ACR_DENTRO_DO_PROJETO = 'você está dentro de um projeto';

// ── O catálogo ──────────────────────────────────────────────────────────────
//
// ⚠️ `fazer: () => f()` e NÃO `fazer: f`. A segunda forma resolve o nome na hora
// em que esta tag carrega; a primeira, na hora do clique. Como este arquivo
// carrega antes de vários dos módulos que ele chama, a segunda forma não daria
// erro no carregamento — daria erro no clique, meses depois.
[
  // ── A tela de projetos ──
  // Os três só valem FORA de um projeto: são a tela inicial. Dentro de um
  // projeto eles ficam cinza, com o motivo, em vez de sumir — quem procurou
  // "novo projeto" quer saber que o comando existe e por que não dá agora.
  {
    id: 'projetos.novo', rotulo: 'Criar um projeto novo', grupo: 'Projetos',
    icone: '＋', ativo: _acrSemProjeto, motivo: _ACR_DENTRO_DO_PROJETO,
    fazer: () => openNewProjectModal(),
  },
  {
    id: 'projetos.gerenciar', rotulo: 'Gerenciar grupos e tags', grupo: 'Projetos',
    icone: '☰', ativo: _acrSemProjeto, motivo: _ACR_DENTRO_DO_PROJETO,
    fazer: () => abrirModalGerenciarProjetos(),
  },
  {
    id: 'projetos.recarregar', rotulo: 'Recarregar a lista de projetos', grupo: 'Projetos',
    icone: '↻', ativo: _acrSemProjeto, motivo: _ACR_DENTRO_DO_PROJETO,
    fazer: () => loadProjects(),
  },

  // ── Versões (a aba de backup) ──
  {
    id: 'backups.copiar', rotulo: 'Fazer uma cópia do projeto', grupo: 'Versões',
    icone: '⧉', ativo: _acrComProjeto, motivo: _ACR_SEM_PROJETO,
    // Abre a aba e o modal — o comando é "abrir o formulário", porque a cópia
    // pede uma nota e uma conferência do que mudou antes de existir.
    fazer: () => _acrAgirNaAba('bksub-versoes', 'bk-modal-create', 'Versões',
                               () => bkAbrirModalDeCopia()),
  },
  {
    id: 'backups.recarregar', rotulo: 'Recarregar a lista de versões', grupo: 'Versões',
    icone: '↻', ativo: _acrComProjeto, motivo: _ACR_SEM_PROJETO,
    fazer: () => _acrAgirNaAba('bksub-versoes', '', 'Versões', () => bkCarregarLista()),
  },

  // ── Trabalhos ──
  {
    id: 'trabalhos.nova-atividade', rotulo: 'Criar uma atividade', grupo: 'Trabalhos',
    icone: '＋', ativo: _acrComProjeto, motivo: _ACR_SEM_PROJETO,
    // ⚠️ `tr-modal` só existe depois de `trCarregarQuadro` ter montado o painel,
    // e é ela que o `init` da sub-aba chama. O `_acrAgirNaAba` confere.
    fazer: () => _acrAgirNaAba('trsub-quadro', 'tr-modal', 'Trabalhos',
                               () => trAbrirModal()),
  },
  {
    id: 'trabalhos.recarregar-quadro', rotulo: 'Recarregar o Quadro', grupo: 'Trabalhos',
    icone: '↻', ativo: _acrComProjeto, motivo: _ACR_SEM_PROJETO,
    fazer: () => _acrAgirNaAba('trsub-quadro', '', 'Trabalhos', () => trCarregarQuadro()),
  },
  {
    id: 'oficina.fluxos-salvos', rotulo: 'Abrir os fluxos salvos', grupo: 'Trabalhos › Oficina',
    icone: '⌸', ativo: _acrComProjeto, motivo: _ACR_SEM_PROJETO,
    fazer: () => _acrAgirNaAba('trsub-oficina', '', 'Oficina', () => ofiModalDeFluxosSalvos()),
  },
  {
    id: 'oficina.enquadrar', rotulo: 'Enquadrar tudo no canvas', grupo: 'Trabalhos › Oficina',
    icone: '⤢', ativo: _acrComProjeto, motivo: _ACR_SEM_PROJETO,
    fazer: () => _acrAgirNaAba('trsub-oficina', 'ofi-canvas', 'Oficina', () => ofiEnquadrar()),
  },

  // ── Fila ──
  {
    id: 'fila.nova-tarefa', rotulo: 'Criar uma tarefa na Fila', grupo: 'Fila',
    icone: '＋', ativo: _acrComProjeto, motivo: _ACR_SEM_PROJETO,
    fazer: () => _acrAgirNaAba('asubtab-fila', '', 'Fila', () => _filaNovaTarefa()),
  },
  {
    id: 'fila.cancelar', rotulo: 'Cancelar a Fila no fim da rodada', grupo: 'Fila',
    icone: '⏹', ativo: _acrComProjeto, motivo: _ACR_SEM_PROJETO,
    fazer: () => _acrAgirNaAba('asubtab-fila', '', 'Fila', () => _filaCancelar()),
  },

  // ── Terminal ──
  {
    id: 'terminal.escolher-script', rotulo: 'Escolher o script do Terminal', grupo: 'Terminal',
    icone: '⌸', ativo: _acrComProjeto, motivo: _ACR_SEM_PROJETO,
    fazer: () => _acrAgirNaAba('tab-terminal', 'terminal-path', 'Terminal', () => browseScript()),
  },
  {
    id: 'terminal.parar', rotulo: 'Parar o que está rodando no Terminal', grupo: 'Terminal',
    icone: '⏹', ativo: _acrComProjeto, motivo: _ACR_SEM_PROJETO,
    fazer: () => _acrAgirNaAba('tab-terminal', 'terminal-path', 'Terminal', () => stopScript()),
  },
  {
    id: 'terminal.copiar-saida', rotulo: 'Copiar a saída do Terminal', grupo: 'Terminal',
    icone: '⧉', ativo: _acrComProjeto, motivo: _ACR_SEM_PROJETO,
    fazer: () => _acrAgirNaAba('tab-terminal', 'terminal-path', 'Terminal',
                               () => copiarSaidaTerminal()),
  },

  // ── Documentação ──
  {
    id: 'documentacao.expandir', rotulo: 'Expandir a árvore inteira', grupo: 'Documentação',
    icone: '⌄', ativo: _acrComProjeto, motivo: _ACR_SEM_PROJETO,
    fazer: () => _acrAgirNaAba('tab-documentacao', 'doc-tree', 'Documentação',
                               () => docExpandAll()),
  },
  {
    id: 'documentacao.recolher', rotulo: 'Recolher a árvore inteira', grupo: 'Documentação',
    icone: '⌃', ativo: _acrComProjeto, motivo: _ACR_SEM_PROJETO,
    fazer: () => _acrAgirNaAba('tab-documentacao', 'doc-tree', 'Documentação',
                               () => docCollapseAll()),
  },

  // ── Aparência ──
  {
    id: 'aparencia.limpar-filtros', rotulo: 'Limpar os filtros da busca', grupo: 'Aparência',
    icone: '⌫', ativo: _acrComProjeto, motivo: _ACR_SEM_PROJETO,
    fazer: () => _acrAgirNaAba('tab-aparencia', 'aparencia-cor', 'Aparência',
                               () => aparenciaLimparFiltros()),
  },

  // ── Designer ──
  {
    id: 'designer.nova-sessao', rotulo: 'Começar uma sessão nova', grupo: 'Designer',
    icone: '＋', ativo: _acrComProjeto, motivo: _ACR_SEM_PROJETO,
    fazer: () => _acrAgirNaAba('asubtab-designer', 'design-messages', 'Designer',
                               () => createDesignChat()),
  },

  // ── Inspetor ──
  {
    id: 'inspetor.executar-programa', rotulo: 'Executar o programa observado', grupo: 'Inspetor',
    icone: '▷', ativo: _acrComProjeto, motivo: _ACR_SEM_PROJETO,
    fazer: () => _acrAgirNaAba('tab-inspetor', 'insp-executar', 'Inspetor',
                               () => inspExecutarPrograma()),
  },
].forEach((comando) => registrarTecla(Object.assign({ onde: 'global', padrao: null }, comando)));
