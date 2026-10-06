// ══════════════════════════════ ACESSO RÁPIDO: OS CINCO MODOS ══
// A pergunta deste arquivo: **o que cada modo procura, e como cada resultado
// vira uma linha.** Quem desenha a barra, abre, fecha e navega é
// `acesso-rapido.js` — a casca. Os dois se separam porque são duas perguntas,
// e juntos passariam do teto de 500 linhas da AMF.
//
// Todo modo devolve a MESMA forma, e é isso que deixa a casca desenhar sem
// saber de que modo veio a linha:
//
//   { itens: [ … ], vazio: 'texto quando não há nada' }
//
// e todo item é:
//
//   { nome, caminho, trecho, score, tecla, motivo, executar, recente }
//
// - `nome`     o que aparece em negrito
// - `caminho`  a linha cinza ao lado (caminho de arquivo, ou a aba de origem)
// - `trecho`   segunda linha, quando há
// - `score`    a porcentagem do modo Semântico, ou `null`
// - `icone`    um glifo à esquerda, quando o comando declarou um
// - `tecla`    o texto da tecla, à direita — vem do registro (`teclas.js`)
// - `teclaVazia` verdadeiro quando o comando não tem tecla nenhuma: a coluna da
//   direita diz "sem tecla" em vez de ficar em branco, que se confunde com uma
//   linha que simplesmente não tem coluna de tecla (arquivo, aba)
// - `motivo`   por que está indisponível; com motivo, a linha fica cinza
// - `executar` o que o clique (ou o Enter) faz
// - `recente`  como este item é gravado em "Usados recentemente", ou `null`
//
// ⚠️ OS TRÊS MODOS DE ARQUIVO VÃO AO DISCO E DEVOLVEM UMA LISTA. Nenhum filtra
// a árvore no lugar — a árvore do Editor é preguiçosa, e um filtro só
// alcançaria o que já tinha sido expandido.
//
// ⚠️ O modo Semântico não busca no código: busca no que o agente de
// Documentação Técnica escreveu sobre cada arquivo, e devolve o arquivo. Do
// resultado semântico ao arquivo de código quem resolve é o backend
// (`editor_resolver_documento`) — a chave da Documentação Técnica leva o nome
// da pasta de trabalho na frente, e a árvore do Editor é relativa à raiz.
//
// ⚠️ NADA DE CASAMENTO APROXIMADO. Os três modos de arquivo casam no backend e
// os dois de memória casam por substring; aproximar só um lado daria duas
// regras de busca dentro da mesma caixa.

// ── Quem é o dono da árvore do Editor ────────────────────────────────────────
//
// ⚠️ A barra NÃO guarda mais a árvore num closure de criação, como fazia
// da fábrica antiga. Aquilo era o que a prendia à aba Editor: a instância só
// nascia depois de a aba ter sido montada, e antes disso a barra não existia.
// Agora o Editor SE REGISTRA aqui quando monta, e a barra funciona com os dois
// ausentes.
let _acrArvore = null;
let _acrAbrirArquivo = null;

// eslint-disable-next-line no-unused-vars
function acessoRapidoUsarArvore(arvore, aoAbrirArquivo) {
  _acrArvore = arvore;
  _acrAbrirArquivo = aoAbrirArquivo;
}

// Revela na árvore E abre — as duas coisas, sempre, nesta ordem.
//
// ⚠️ AS DUAS, E NÃO SÓ UMA. Antes a busca só selecionava, e a árvore ficava
// escondida atrás da lista de resultados: o usuário tinha de fechar a busca
// para ver o que tinha clicado. O Ctrl+P do VS Code faz as duas no mesmo
// clique.
//
// ⚠️ Sem o Editor montado, MONTA O EDITOR. É o que o usuário quis dizer ao
// clicar num arquivo, e é o que mantém a promessa de "revela E abre" em
// qualquer aba. Não confundir com "sem projeto aberto", que é outra coisa: lá
// os três modos de arquivo nem aparecem.
//
// ⚠️ `revelar` expande pasta a pasta e espera 60 ms por nível — daí o `await`.
// Numa árvore funda é meio segundo em que a barra já fechou; a ordem das duas
// chamadas não se inverte por causa disso.
async function acessoRapidoAbrirArquivo(caminho) {
  if (!_acrArvore || !_acrAbrirArquivo) {
    const botao = document.querySelector('.tab-btn[data-tab="tab-editor"]');
    if (!botao) { showToast('A aba Editor não está disponível neste projeto.', true); return; }
    // `.click()` e não trocar classes na mão: é o mesmo caminho do usuário, e é
    // ele que roda o `initEditorTab()` — que, ao montar, chama
    // `acessoRapidoUsarArvore` e preenche os dois de cima.
    botao.click();
  }
  if (_acrArvore) await _acrArvore.revelar(caminho);
  if (_acrAbrirArquivo) await _acrAbrirArquivo(caminho);
}

// ── Os cinco modos ───────────────────────────────────────────────────────────
//
// A ordem aqui é só a ordem de declaração; quem manda na ordem da fila de
// botões é `settings.acesso_rapido_modos`, que o usuário arruma na tela.
//
// `precisaDeProjeto` é o que faz o modo sumir da fila quando não há projeto
// aberto — em vez de aparecer e devolver lista vazia.
//
// `listaSemTermo` distingue os dois tipos de modo, e não é detalhe: os de
// memória (Comando e Ir para aba) já têm a lista inteira na mão e a mostram
// ANTES da primeira letra — abrir o modo Comando e ver a caixa vazia é não
// descobrir que o programa tem comandos. Os três de arquivo precisam de um termo
// para ter o que perguntar ao disco, e sem ele não mostram nada.
const ACESSO_RAPIDO_MODOS = [
  {
    chave: 'comando', rotulo: 'Comando', precisaDeProjeto: false,
    listaSemTermo: true, titulo: 'Comandos do programa',
    dica: 'O que você quer fazer…',
    buscar: async (termo) => _acrModoComando(termo),
    // ⚠️ `listar` é a MESMA resposta, sem `async`. Os dois modos de memória já
    // têm a lista na mão, e a barra a desenha antes da primeira letra — um
    // `await` ali faria a caixa piscar vazia por um quadro.
    listar: (termo) => _acrModoComando(termo),
  },
  {
    chave: 'aba', rotulo: 'Ir para aba', precisaDeProjeto: false,
    listaSemTermo: true, titulo: 'Abas do programa',
    dica: 'Nome da aba…',
    buscar: async (termo) => _acrModoAba(termo),
    listar: (termo) => _acrModoAba(termo),
  },
  {
    chave: 'nome', rotulo: 'Por nome', precisaDeProjeto: true,
    dica: 'Nome do arquivo…',
    buscar: async (termo) => _acrModoArquivo('editor_buscar_nome', termo,
                                             'Nenhum arquivo com esse nome.'),
  },
  {
    chave: 'conteudo', rotulo: 'Por conteúdo', precisaDeProjeto: true,
    dica: 'Texto a procurar dentro dos arquivos…',
    buscar: async (termo) => _acrModoArquivo('editor_buscar_conteudo', termo,
                                             'Nenhum arquivo contém esse texto.'),
  },
  {
    chave: 'semantico', rotulo: 'Semântico', precisaDeProjeto: true,
    dica: 'Descreva o que o arquivo faz…',
    buscar: async (termo) => _acrModoSemantico(termo),
  },
];

function acessoRapidoModo(chave) {
  return ACESSO_RAPIDO_MODOS.find((m) => m.chave === chave) || null;
}

// ── Modo Comando ─────────────────────────────────────────────────────────────
//
// Não tem catálogo próprio: lista o que o registro de teclas conhece. Toda
// tecla registrada já é um comando — tem `id`, `rotulo`, `grupo`, `ativo`,
// `motivo` e `fazer` —, e comando sem tecla nenhuma é caso legítimo: aparece
// com a direita vazia.
//
// ⚠️ O item indisponível NÃO some: fica cinza, com o motivo. Sumir com ele
// deixaria o usuário procurando um comando que existe.
function _acrModoComando(termo) {
  // ⚠️ Pergunta ao ponto ANTES de listar. Os comandos de extensão entram no
  // mesmo registro dos do programa — é o que os faz aparecer também na tela de
  // Teclado e poder receber uma tecla —, e entram DEPOIS deles, porque a ordem
  // do registro é a ordem de inserção — por isso os de extensão passam por
  // `xtComandosNaOrdemDaLista`: religada, ela voltaria no fim.
  if (typeof xtRegistrarComandosAgora === 'function') xtRegistrarComandosAgora();
  const alvo = termo.trim().toLowerCase();
  const todos = obterTeclas();
  const itens = (typeof xtComandosNaOrdemDaLista === 'function' ? xtComandosNaOrdemDaLista(todos) : todos)
    .filter((c) => {
      if (!alvo) return true;
      return (c.grupo + ' ' + c.rotulo).toLowerCase().includes(alvo);
    })
    .map((c) => {
      const indisponivel = c.ativo && !c.ativo();
      // O grupo na frente é o "Python: Run file" do VS Code. Para o comando de
      // extensão o grupo é o NOME dela, e o interruptor "Comando de extensão
      // leva o nome dela na frente" (Configurações › Acesso rápido) decide se
      // ele aparece — a cor do destaque continua dizendo de onde veio.
      const comPrefixo = c.grupo && (!c.slug || _acrConfig().prefixoExtensao);
      return {
        nome: comPrefixo ? `${c.grupo}: ${c.rotulo}` : c.rotulo,
        caminho: '', trecho: '', score: null,
        // ⚠️ QUEM MARCA A ORIGEM É O PROGRAMA, nunca a extensão: se dependesse
        // dela, a que esquecesse ficaria invisível ao "Destacar extensões" — e
        // o destaque deixaria de responder a pergunta que existe para
        // responder, "o que aqui não é do programa?".
        slug: c.slug,
        icone: c.icone,
        tecla: c.tecla || 'sem tecla', teclaVazia: !c.tecla,
        motivo: indisponivel ? c.motivo : '',
        executar: indisponivel ? null : () => c.fazer(),
        recente: { modo: 'comando', chave: c.id, nome: c.rotulo },
      };
    });
  return { itens, vazio: 'Nenhum comando com esse nome.' };
}

// Reexecutar um comando vindo de "Usados recentemente": o `id` foi gravado, e
// o `fazer` é resolvido agora — a extensão que o registrou pode ter sido
// desligada desde então.
function _acrExecutarComando(id) {
  const comando = obterTeclas().find((c) => c.id === id);
  if (!comando) { showToast('Esse comando não existe mais.', true); return; }
  if (comando.ativo && !comando.ativo()) { showToast(comando.motivo || 'Indisponível agora.', true); return; }
  comando.fazer();
}

// ── Modo "Ir para aba" ───────────────────────────────────────────────────────
//
// Também sem catálogo próprio: as abas do programa JÁ SÃO uma lista, marcada no
// DOM com `[data-taborder-group]` — é a mesma marcação que a tela "Ordem das
// abas" descobre (`tab-order.js`). Escrever aqui uma segunda lista de abas
// seria a lista que diverge da primeira no dia em que alguém acrescentar uma
// aba.
//
// ⚠️ O atributo de navegação de cada botão varia (`data-tab`, `data-asubtab`,
// `data-categoria`…) e é descoberto do mesmo jeito que lá: é o único `data-*`
// do botão que não começa com `taborder`.
//
// ⚠️ `data-taborder-rotulo` GANHA do `textContent` quando existe. O botão de
// uma categoria de Configurações tem o glifo dentro, e o `textContent` sairia
// "◆Modelo e contexto".
//
// Cada aba sai com três coisas além do rótulo, e as três são o que "ir até
// ela" precisa saber (ver `_acrIrParaAba`):
//
// - `painelId`  o id do PAINEL que o botão abre — é o valor de navegação com
//               o prefixo `data-taborder-painel` na frente, quando a barra
//               declara um (o trilho de Configurações: `data-categoria`
//               vale "modelo", e o painel é `config-secao-modelo`). É por
//               ele que uma sub-aba acha a aba de cima: o `paiId` de uma
//               barra é o `painelId` de algum botão de outra;
// - `paiId`     o painel de cima, ou '' para uma aba de primeiro nível;
// - `telaId`    em que TELA a barra mora — `projects-screen` (Projetos,
//               Arquivos, Configurações) ou `project-screen` (dentro de um
//               projeto). As duas nunca estão visíveis ao mesmo tempo;
// - `barra`     a chave da barra (`data-taborder-group`), por onde o botão é
//               reencontrado na hora do clique;
// - `slug`      só nas páginas de extensão: é o que faz a linha levar
//               `data-origem="extensao"` e acender no "Destacar extensões".
//
// ⚠️ AS PÁGINAS DE EXTENSÃO NÃO SÃO FILHAS DIRETAS DA BARRA. Os botões do lado
// Extensões do trilho de Configurações moram em `#config-trilho-extensoes`, de
// propósito — é o que os deixa fora de "Ordem das abas" (Padrões de interface
// › Trilho de categorias). Por isso `[...barra.children]` não os via, e "Ir
// para aba" não levava a página de extensão nenhuma (06/09/2026). Eles entram
// por `_acrBotoesDaBarra`, sob o grupo "Configurações › Extensões".
function _acrBotoesDaBarra(barra) {
  const diretos = [...barra.children].filter((el) => el.tagName === 'BUTTON');
  const deExtensao = [...barra.querySelectorAll('.config-trilho-extensoes > button')];
  return { diretos, deExtensao };
}

function _acrAbasDoPrograma() {
  const abas = [];
  document.querySelectorAll('[data-taborder-group]').forEach((barra) => {
    const grupo = barra.dataset.taborderLabel || barra.dataset.taborderGroup;
    const chaveDaBarra = barra.dataset.taborderGroup;
    const paiId = barra.dataset.taborderParent || '';
    const prefixo = barra.dataset.taborderPainel || '';
    const tela = barra.closest('.screen');
    const telaId = tela ? tela.id : '';
    const { diretos, deExtensao } = _acrBotoesDaBarra(barra);
    const botaoModelo = diretos.find((el) =>
      Object.keys(el.dataset).some((k) => !k.startsWith('taborder')));
    if (!botaoModelo) return;
    const atributo = Object.keys(botaoModelo.dataset).find((k) => !k.startsWith('taborder'));
    const empurrar = (botao, extras) => {
      if (!botao.dataset[atributo]) return;
      // Aba escondida não entra: o botão de Plugins e o de Launchers só
      // aparecem quando há algo marcado para dentro do projeto.
      if (botao.classList.contains('hidden')) return;
      abas.push(Object.assign({
        id: botao.dataset[atributo],
        painelId: prefixo + botao.dataset[atributo],
        rotulo: (botao.dataset.taborderRotulo || botao.textContent).trim(),
        grupo, paiId, telaId, barra: chaveDaBarra, slug: '',
      }, extras || {}));
    };
    diretos.forEach((botao) => empurrar(botao, null));
    deExtensao.forEach((botao) => empurrar(botao, {
      grupo: `${grupo} › Extensões`,
      // A chave da categoria é `xt-{slug}` para a página que o programa
      // desenha; a que a extensão registra sozinha tem a chave que ela quis.
      // Nos dois casos a linha é de extensão, e é isso que o slug diz aqui.
      slug: String(botao.dataset[atributo]).replace(/^xt-/, ''),
      // O prefixo da linha, quando o interruptor de aba está ligado: o lado
      // do trilho, e não "Configurações" — é ele que diz o que a linha é.
      prefixoDoPai: 'Extensões',
    }));
  });
  return abas;
}

// O botão de uma aba, achado NA HORA do clique e não guardado na lista: várias
// barras são remontadas por `innerHTML` (o Acervo, as categorias de extensão),
// e uma referência guardada apontaria para um botão que já saiu do DOM.
function _acrBotaoDaAba(aba) {
  for (const barra of document.querySelectorAll('[data-taborder-group]')) {
    if (barra.dataset.taborderGroup !== aba.barra) continue;
    const { diretos, deExtensao } = _acrBotoesDaBarra(barra);
    const botao = [...diretos, ...deExtensao].find((b) =>
      Object.keys(b.dataset).some((k) => !k.startsWith('taborder') && b.dataset[k] === aba.id));
    if (botao) return botao;
  }
  return null;
}

// Uma aba está fora de alcance quando a tela dela não é a que está aberta e
// não há como chegar lá: as abas de DENTRO do projeto, sem projeto aberto.
// (O contrário — uma aba da tela Projetos com um projeto aberto — tem
// caminho: `goBackToProjects`, que é o "← Projetos".)
function _acrMotivoDaAba(aba) {
  if (aba.telaId === 'project-screen' && !currentProject) return _ACR_SEM_PROJETO_ABA;
  return '';
}
const _ACR_SEM_PROJETO_ABA = 'nenhum projeto aberto';

/**
 * Leva a tela até uma aba — de qualquer nível, em qualquer das duas telas.
 *
 * ⚠️ ISTO ERA O DEFEITO "clico para ir e ele não vai" (06/09/2026), e eram
 * três casos, não um:
 *
 * 1. **A aba de cima era procurada só entre as `.tab-btn`**, as abas
 *    principais de dentro do projeto. Uma categoria de Configurações tem
 *    como pai `ptab-configs`, que é um `.main-tab-btn[data-ptab]` da tela
 *    Projetos; a sub-aba de Preparar projeto tem como pai `subtab-preparar`,
 *    que é ele mesmo uma sub-aba. Nos dois casos o pai não era achado, o
 *    botão de baixo era clicado com o painel dele escondido, e nada mudava
 *    na tela. Agora o pai é achado pelo `painelId` de qualquer barra, e a
 *    subida é RECURSIVA — o nível não importa.
 * 2. **As duas telas.** Dentro de um projeto, clicar em "Configurações"
 *    trocava a aba da tela Projetos — que não estava visível. Ir a uma aba
 *    da outra tela passa primeiro por `goBackToProjects`, que é o mesmo
 *    caminho do "← Projetos" (com a pergunta de "tem coisa rodando", se as
 *    Configurações pedirem — e se o usuário desistir, a ida para).
 * 3. **Sem projeto aberto, as abas de dentro do projeto** apareciam e não
 *    iam a lugar nenhum. Agora ficam cinza, com o motivo — a mesma regra do
 *    modo Comando: sumir com elas esconderia que existem.
 *
 * ⚠️ `async`, e quem precisa que a tela JÁ esteja lá espera por ela
 * (`acessoRapidoIrParaPainel` devolve esta promessa). A subida recursiva
 * cede o fio entre um nível e outro, então "cliquei e o elemento ainda não
 * existe" é a leitura errada de quem não esperou.
 */
async function _acrIrParaAba(aba) {
  const motivo = _acrMotivoDaAba(aba);
  if (motivo) { showToast(`Essa aba não está disponível: ${motivo}.`, true); return false; }

  // A tela certa, primeiro. `currentProject` continua preenchido se o
  // usuário respondeu "não" à pergunta de saída — e aí a ida para aqui.
  if (aba.telaId === 'projects-screen' && currentProject) {
    if (typeof goBackToProjects !== 'function') return false;
    await goBackToProjects();
    if (currentProject) return false;
  }

  // A aba de cima, depois — e a de cima dela, até o primeiro nível. A barra
  // de dentro só responde a clique quando o painel dela é o que está na tela.
  if (aba.paiId) {
    const pai = _acrAbasDoPrograma().find((a) => a.painelId === aba.paiId);
    if (pai && !await _acrIrParaAba(pai)) return false;
  }

  const botao = _acrBotaoDaAba(aba);
  if (!botao) { showToast('Essa aba não está disponível agora.', true); return false; }
  if (!botao.classList.contains('active')) botao.click();
  return true;
}

// O "Trabalhos: Oficina" — a aba de cima na frente da sub-aba, como o VS Code
// escreve "View: Toggle…". Segue o interruptor "Ir para aba mostra a aba de
// cima na frente" (Configurações › Acesso rápido); aba de primeiro nível não
// tem o que pôr na frente. A página de extensão põe "Extensões", o lado do
// trilho, e não "Configurações".
function _acrNomeDaAba(a, abas) {
  if (!_acrConfig().prefixoAba) return a.rotulo;
  const pai = a.paiId ? abas.find((x) => x.painelId === a.paiId) : null;
  const prefixo = a.prefixoDoPai || (pai && pai.rotulo);
  return prefixo ? `${prefixo}: ${a.rotulo}` : a.rotulo;
}

function _acrModoAba(termo) {
  const alvo = termo.trim().toLowerCase();
  const abas = _acrAbasDoPrograma();
  const itens = abas
    .map((a) => Object.assign({ nomeNaBarra: _acrNomeDaAba(a, abas) }, a))
    .filter((a) => !alvo || (a.grupo + ' ' + a.nomeNaBarra).toLowerCase().includes(alvo))
    .map((a) => {
      const motivo = _acrMotivoDaAba(a);
      return {
        nome: a.nomeNaBarra, caminho: a.grupo, trecho: '', score: null,
        tecla: '', motivo,
        // ⚠️ QUEM MARCA A ORIGEM É O PROGRAMA: a página de extensão vira uma
        // linha com `data-origem="extensao"`, pelo mesmo caminho do comando.
        slug: a.slug || '',
        executar: motivo ? null : () => _acrIrParaAba(a),
        recente: { modo: 'aba', chave: a.id, nome: a.rotulo },
      };
    });
  return { itens, vazio: 'Nenhuma aba com esse nome.' };
}

// ── Os três modos de arquivo ─────────────────────────────────────────────────

function _acrLinhaDeArquivo(caminho, extras) {
  return Object.assign({
    nome: caminho.split('/').pop(), caminho, trecho: '', score: null,
    tecla: '', motivo: '',
    executar: () => acessoRapidoAbrirArquivo(caminho),
    recente: { modo: 'arquivo', chave: caminho, nome: caminho.split('/').pop() },
  }, extras || {});
}

// ⚠️ `mostrarIgnorados` vai `true` fixo, e é de propósito. Ele vinha de
// `cfg.arvore.mostrarIgnorados`, um getter que já devolvia `true` fixo desde
// que o interruptor que o alimentava foi removido. Com a barra desacoplada, não
// há por que inventar um caminho para um interruptor que não existe.
async function _acrModoArquivo(chamada, termo, vazio) {
  const r = await window.pywebview.api[chamada](currentProject, termo, true);
  if (!r.success) return { itens: [], vazio: r.error || 'Erro na busca.' };
  return { itens: r.caminhos.map((c) => _acrLinhaDeArquivo(c)), vazio };
}

async function _acrModoSemantico(termo) {
  const r = await window.pywebview.api.search_embeddings(currentProject, termo, 'documentacao-tecnica');
  if (!r.success) return { itens: [], vazio: r.error || 'Erro na busca semântica.' };
  if (r.message) return { itens: [], vazio: r.message };
  const itens = (r.results || []).map((res) => {
    const doc = (res.doc_path || '').replace(/\\/g, '/');
    return {
      nome: doc.split('/').pop().replace(/\.md$/i, ''),
      caminho: doc, trecho: res.excerpt,
      score: res.score != null ? Math.round(res.score * 100) : null,
      tecla: '', motivo: '',
      // ⚠️ O resultado semântico NÃO vem com caminho de código: vem com `doc`,
      // e o caminho sai de `editor_resolver_documento`. É por isso que abrir um
      // resultado destes é assíncrono e tem um passo a mais. Não simplificar.
      executar: () => _acrAbrirDocumento(doc),
      recente: null,
    };
  });
  // ⚠️ Esta mensagem ENSINA algo que o usuário não teria como adivinhar: o modo
  // depende de a Documentação Técnica já ter sido gerada. Não trocar por um
  // "nada encontrado" genérico.
  return { itens, vazio: 'Nada parecido na Documentação Técnica. Ela já foi gerada para este projeto?' };
}

async function _acrAbrirDocumento(doc) {
  const r = await window.pywebview.api.editor_resolver_documento(currentProject, doc);
  if (!r.success) { showToast(r.error, true); return; }
  await acessoRapidoAbrirArquivo(r.caminho);
}

// ── Executar um item de "Usados recentemente" ────────────────────────────────
// Levar a tela até um painel pelo id dele — a aba, ou a sub-aba com a aba de
// cima junto. É o que os comandos do catálogo usam para agir numa aba que ainda
// não foi aberta: o `fazer` leva o usuário até lá e só então age, que é o que
// ele quis dizer ao digitar o nome do comando.
//
// ⚠️ Devolve uma PROMESSA, e quem age no painel logo depois espera por ela:
// a ida a uma sub-aba passa pela aba de cima primeiro, e cede o fio entre um
// nível e outro (ver `_acrIrParaAba`).
// eslint-disable-next-line no-unused-vars
async function acessoRapidoIrParaPainel(painelId) {
  const aba = _acrAbasDoPrograma().find((a) => a.id === painelId || a.painelId === painelId);
  if (!aba) return false;
  return _acrIrParaAba(aba);
}

// eslint-disable-next-line no-unused-vars
function acessoRapidoExecutarRecente(recente) {
  if (recente.modo === 'comando') return _acrExecutarComando(recente.chave);
  if (recente.modo === 'aba') {
    const aba = _acrAbasDoPrograma().find((a) => a.id === recente.chave);
    if (!aba) { showToast('Essa aba não está disponível agora.', true); return; }
    return _acrIrParaAba(aba);
  }
  return acessoRapidoAbrirArquivo(recente.chave);
}
