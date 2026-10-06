// ══════════════════════════════════════════════════ ABA: EDITOR ══
// A casca: liga a árvore, os dois painéis e as duas divisórias.
//
// ⚠️ AS TECLAS DA ABA SAÍRAM DAQUI, e não sobrou `keydown` nenhum. Esta aba
// inaugurou o atalho de teclado global no programa — antes dela não havia
// `keydown` de janela nenhum —, e por isso o ouvinte dela nasceu aqui, guardado
// à mão. Hoje as nove teclas estão em `editor-teclas.js`, no registro central
// (`modulos/teclas.js`), que escreve as guardas uma vez só para o programa
// inteiro. Sem `preventDefault` — que o registro dá —, o WebView2 abre a busca
// DELE no Ctrl+F e o diálogo "Salvar como" no Ctrl+S, por cima do programa.
//
// ⚠️ A ABERTURA RÁPIDA TAMBÉM SAIU. O Ctrl+P era desta aba, e a caixa dele só
// existia depois de a aba ter sido montada. Ela virou a barra de Acesso rápido
// (`modulos/acesso-rapido.js`), que abre em qualquer aba e desde o boot. O que
// esta casca faz agora é emprestar a árvore e o "abrir arquivo" a ela, por
// `acessoRapidoUsarArvore`.
//
// ⚠️ O MESMO ARQUIVO NÃO ABRE NOS DOIS LADOS, e é decisão, não limitação. Dois
// textareas sobre o mesmo arquivo são dois buffers que divergem, e o segundo
// Ctrl+S apagaria o primeiro em silêncio. Um buffer compartilhado com duas
// vistas exigiria abandonar a pilha de desfazer nativa (duas caixas, uma
// história) e escrever um motor de undo próprio — que é a fronteira entre
// "mini editor" e "editor". Clicar num arquivo já aberto do outro lado apenas
// foca aquele lado.

let _edLigado = false;
let _edArvore = null;
let _edBuscarSubstituir = null;
let _edPaineis = { a: null, b: null };
let _edAtivo = null;
let _edDivArvore = null;
let _edDivPaineis = null;
let _edProjeto = null;

// Nome do projeto → `{ a: {lista, atual}, b: {lista, atual} }` com os arquivos
// que estavam abertos em cada painel. Ver `_edTrocarDeProjeto`, logo abaixo, e
// `edEsquecerProjeto`, que é quem dá baixa aqui.
const _edAbertosPorProjeto = {};

function _edChaveDoLayout() { return `editor.paineis.${currentProject}`; }

function _edLerLayout() {
  try { return JSON.parse(localStorage.getItem(_edChaveDoLayout())) || {}; } catch (_) { return {}; }
}

function _edGravarLayout(mudanca) {
  try {
    localStorage.setItem(_edChaveDoLayout(),
      JSON.stringify(Object.assign(_edLerLayout(), mudanca)));
  } catch (_) { /* localStorage cheio ou bloqueado: o layout volta ao padrão */ }
}

// ── O rodapé de status, alimentado pelo painel ativo ──
function _edPintarStatus(painel) {
  if (painel && painel !== _edAtivo) return;
  const arq = painel && painel.atual;
  const pos = document.getElementById('ed-status-pos');
  const zoom = document.getElementById('ed-status-zoom');
  if (!arq) {
    pos.textContent = '—';
    ['lang', 'enc', 'eol'].forEach((k) => { document.getElementById(`ed-status-${k}`).textContent = '—'; });
    zoom.textContent = '';
    _edPintarEncaixes(null, null);   // os pontos de extensão (editor-extensoes.js)
    return;
  }
  // ⚠️ Binário não tem linha, coluna, codificação nem fim de linha. Ler
  // `arq.fimDeLinha.toUpperCase()` num PNG estourava aqui e derrubava a
  // abertura inteira — o arquivo abria e a tela ficava pela metade.
  if (arq.tipo === 'binario') {
    pos.textContent = arq.caminho.split('.').pop().toUpperCase();
    document.getElementById('ed-status-lang').textContent = 'binário';
    document.getElementById('ed-status-enc').textContent = '—';
    document.getElementById('ed-status-eol').textContent = '—';
    zoom.textContent = '';
    _edPintarEncaixes(arq, null);
    return;
  }
  const p = painel.superficie.posicaoDoCursor();
  pos.textContent = `Ln ${p.linha}, Col ${p.coluna}${arq.sujo ? ' · não salvo' : ''}`;
  document.getElementById('ed-status-lang').textContent = arq.linguagem === 'none' ? 'texto' : arq.linguagem;
  document.getElementById('ed-status-enc').textContent = arq.bom ? 'UTF-8 (BOM)' : 'UTF-8';
  document.getElementById('ed-status-eol').textContent = (arq.fimDeLinha || 'lf').toUpperCase();
  zoom.textContent = `🔍 ${painel.zoomPct()}%`;
  _edPintarEncaixes(arq, p);
}

// Indicador de pasta com alteração pendente (Obra 8) — só este arquivo sabe
// dos DOIS painéis; a árvore só sabe da própria estrutura. Barato de sobra
// pra rodar a cada `aoMudarEstado` (poucos arquivos abertos, no máximo).
function _edAtualizarPastasSujas() {
  if (!_edArvore) return;
  const sujos = [];
  [_edPaineis.a, _edPaineis.b].forEach((p) => {
    p.abertos.forEach((a) => { if (a.sujo) sujos.push(a.caminho); });
  });
  _edArvore.atualizarPastasSujas(sujos);
}

function _edFocarPainel(painel) {
  if (_edAtivo === painel) return;
  _edAtivo = painel;
  _edPaineis.a.elemento.classList.toggle('ed-ativo', painel === _edPaineis.a);
  _edPaineis.b.elemento.classList.toggle('ed-ativo', painel === _edPaineis.b);
  _edPintarStatus(painel);
}

// ── Abrir um arquivo: no painel ativo, ou focando quem já o tem ──
async function _edAbrirArquivo(caminho) {
  const outro = _edAtivo === _edPaineis.a ? _edPaineis.b : _edPaineis.a;
  if (outro.temArquivo(caminho) && !outro.elemento.classList.contains('divisoria-retraido')) {
    _edFocarPainel(outro);
    await outro.abrir(caminho);
    return;
  }
  await _edAtivo.abrir(caminho);
}

// ── Tela dividida ──
function _edDividir(ligar) {
  const area = document.getElementById('ed-area');
  const b = _edPaineis.b.elemento;
  b.classList.toggle('divisoria-retraido', !ligar);
  _edDivPaineis.classList.toggle('divisoria--inerte', !ligar);
  area.classList.toggle('ed-area--simples', !ligar);
  // A largura inline some ao juntar: guardada, ela voltaria na próxima divisão
  // ignorando o tamanho da janela de agora.
  if (!ligar) b.style.width = '';
  else b.style.width = `${_edLerLayout().larguraB || Math.round(area.getBoundingClientRect().width / 2)}px`;
  _edGravarLayout({ dividido: !!ligar });
  if (!ligar && _edAtivo === _edPaineis.b) _edFocarPainel(_edPaineis.a);
}

// ── Retrair a árvore ──
function _edRetrairArvore(retrair) {
  _edDivArvore.retrair(retrair);
  const btn = document.getElementById('ed-btn-retrair');
  btn.textContent = retrair ? '⟩' : '⟨';
  btn.title = retrair ? 'Mostrar o painel da árvore' : 'Retrair este painel';
  // O botão sai junto com o painel; sem um segundo lugar para clicar, retrair
  // seria só de ida. Ele reaparece na barra de ações do painel ativo.
  document.getElementById('ed-btn-mostrar-arvore').classList.toggle('hidden', !retrair);
  _edGravarLayout({ arvoreRetraida: !!retrair });
}

/**
 * Passa os painéis e a árvore do projeto que sai para o que entra.
 *
 * ⚠️ O DEFEITO QUE ISTO CONSERTA NÃO ERA COSMÉTICO. Os dois painéis nascem uma
 * vez e nunca são destruídos, e a lista de abertos deles não tinha noção
 * nenhuma de projeto: trocar de projeto deixava na tira o arquivo do projeto
 * ANTERIOR, aberto e editável. E como salvar grava em
 * `editor_gravar_arquivo(currentProject, arq.caminho)` — o projeto de agora com
 * o caminho relativo de antes —, um Ctrl+S ali escrevia o conteúdo do projeto A
 * dentro do projeto B, em silêncio e sem nada na tela dizendo isso.
 *
 * O que estava aberto não se perde: fica guardado por nome de projeto e volta
 * inteiro (inclusive o que não tinha sido salvo) ao reentrar. Quem apaga isso é
 * fechar a aba do projeto — `edEsquecerProjeto`.
 *
 * Devolve uma promessa, mas ninguém precisa esperá-la: tudo o que decide o
 * layout acontece na parte SÍNCRONA daqui, e o resto é só repor arquivo na
 * tela. Ver o `_edMovendo` abaixo.
 */
function _edTrocarDeProjeto(projetoQueSai) {
  // ⚠️ SEGURA O REENQUADRAMENTO DO COMEÇO AO FIM. Esvaziar os painéis avisa
  // `aoMudarEstado` com a tira vazia, e `_edReenquadrar` juntaria a tela —
  // gravando `dividido: false` na chave do projeto que está ENTRANDO, porque
  // `_edChaveDoLayout()` já lê o `currentProject` novo. Quem manda no layout
  // daqui em diante é o `_edDividir` do fim de `initEditorTab`.
  _edMovendo = true;
  const atualA = _edPaineis.a.atual && _edPaineis.a.atual.caminho;
  const atualB = _edPaineis.b.atual && _edPaineis.b.atual.caminho;
  const listaA = _edPaineis.a.esvaziarParaTroca();
  const listaB = _edPaineis.b.esvaziarParaTroca();
  if (projetoQueSai) {
    _edAbertosPorProjeto[projetoQueSai] = {
      a: { lista: listaA, atual: atualA },
      b: { lista: listaB, atual: atualB },
    };
  }
  // Os resultados do Buscar e substituir são caminhos do projeto que saiu, e o
  // botão "Substituir todas" grava neles pelo `currentProject` de agora — o
  // mesmo defeito do Ctrl+S, por outra porta.
  if (_edBuscarSubstituir) _edBuscarSubstituir.fechar();
  _edArvore.esquecerEstado();

  const guardado = _edAbertosPorProjeto[currentProject];
  if (!guardado) { _edMovendo = false; return Promise.resolve(); }
  return _edPaineis.a.repovoarDaTroca(guardado.a.lista, guardado.a.atual)
    .then(() => _edPaineis.b.repovoarDaTroca(guardado.b.lista, guardado.b.atual))
    .then(() => { _edMovendo = false; _edReenquadrar(); _edPintarStatus(_edAtivo); },
          () => { _edMovendo = false; });
}

/**
 * Fechar a aba de um projeto (`projetos-abertos.js`) apaga o que ele tinha
 * aberto no Editor — senão reabri-lo depois ressuscitaria os buffers de uma
 * sessão que o usuário já encerrou.
 *
 * ⚠️ E ESVAZIA OS PAINÉIS quando é o projeto que está NA TELA. Sem isso, os
 * arquivos dele ainda estariam nos painéis na hora da troca seguinte, e
 * `_edTrocarDeProjeto` os guardaria de volta sob o nome que acabamos de apagar.
 */
// eslint-disable-next-line no-unused-vars
function edEsquecerProjeto(nome) {
  delete _edAbertosPorProjeto[nome];
  if (!_edLigado || _edProjeto !== nome) return;
  _edMovendo = true;
  try {
    _edPaineis.a.esvaziarParaTroca();
    _edPaineis.b.esvaziarParaTroca();
  } finally { _edMovendo = false; }
  _edArvore.esquecerEstado();
  // Zerado, e não deixado com o nome fechado: a próxima entrada tem de contar
  // como troca de projeto de qualquer jeito.
  _edProjeto = null;
}

function initEditorTab() {
  // Trocar de projeto refaz tudo: a árvore, os arquivos abertos e o layout são
  // todos por projeto. Sem esta comparação, abrir a aba no projeto B mostraria
  // a árvore do projeto A.
  if (_edLigado && _edProjeto === currentProject) { _edAtivo.focar(); return; }
  const primeiraVez = !_edLigado;
  const projetoAnterior = _edProjeto;
  _edProjeto = currentProject;

  if (primeiraVez) {
    // O botão que devolve a árvore retraída, fora do painel que some — por
    // isso vai em `.ed-body` (irmão de `#ed-arvore-painel`), não dentro dele.
    const barra = document.querySelector('#tab-editor .ed-body');
    barra.insertAdjacentHTML('afterbegin',
      '<button class="btn-icon hidden" id="ed-btn-mostrar-arvore" title="Mostrar o painel da árvore">⟩</button>');

    const ganchosDoPainel = {
      aoFocar: _edFocarPainel,
      aoMenuDaAba: _edMenuDaAba,
      // O reenquadramento vem junto do estado: fechar o último arquivo de um
      // lado tem que juntar a tela, e `aoMudarEstado` é o único aviso que o
      // painel dá de que a lista de abertos mudou.
      aoMudarEstado: (p) => { _edPintarStatus(p); _edReenquadrar(); _edAtualizarPastasSujas(); },
      // Migalhas de pão: clicar num segmento de pasta abre a árvore até lá.
      // Se ela estiver retraída, mostra primeiro — clicar e nada acontecer
      // seria pior que não ter o clique.
      aoBreadcrumb: (caminhoPasta) => {
        _edRetrairArvore(false);
        if (_edArvore) _edArvore.revelarPasta(caminhoPasta);
      },
      // Ctrl+clique (Obra 11) — abre pelo caminho central que a árvore e a
      // busca já usam (`_edAbrirArquivo`), que resolve sozinho "focar quem já
      // tem o arquivo, ou abrir no painel ativo". Só DEPOIS disso `_edAtivo`
      // é garantidamente o painel certo — daí a rolagem até a linha.
      aoIrParaDefinicao: async (caminho, linha) => {
        await _edAbrirArquivo(caminho);
        if (_edAtivo && _edAtivo.atual && _edAtivo.atual.caminho === caminho) _edAtivo.irParaLinha(linha);
      },
    };
    _edPaineis.a = criarPainelDoEditor(document.getElementById('ed-painel-a'), ganchosDoPainel);
    _edPaineis.b = criarPainelDoEditor(document.getElementById('ed-painel-b'), ganchosDoPainel);
    _edAtivo = _edPaineis.a;

    // Buscar e substituir no projeto (Obra 13) — um painel só pra aba
    // inteira, não por lado da tela dividida.
    _edBuscarSubstituir = criarBuscarSubstituir({
      temAbertoSujo: (caminho) => {
        const a = _edPaineis.a.abertos.find((x) => x.caminho === caminho);
        const b = _edPaineis.b.abertos.find((x) => x.caminho === caminho);
        return !!((a && a.sujo) || (b && b.sujo));
      },
      aoArquivoGravado: (caminho) => {
        _edPaineis.a.recarregarSeAberto(caminho);
        _edPaineis.b.recarregarSeAberto(caminho);
      },
    });

    _edDivArvore = ligarDivisoria({
      divisoria: document.getElementById('ed-divisoria-arvore'),
      painel: document.getElementById('ed-arvore-painel'),
      lado: 'esquerda', minimo: 180, minimoDoOutro: 320,
      aoSoltar: (largura) => _edGravarLayout({ larguraArvore: largura }),
    });
    _edDivPaineis = document.getElementById('ed-divisoria-paineis');
    ligarDivisoria({
      divisoria: _edDivPaineis,
      painel: document.getElementById('ed-painel-b'),
      lado: 'direita', minimo: 240, minimoDoOutro: 240,
      aoSoltar: (largura) => _edGravarLayout({ larguraB: largura }),
    });

    _edArvore = criarArvoreDoEditor({
      container: document.getElementById('ed-arvore'),
      aoAbrirArquivo: _edAbrirArquivo,
      aoPedirCartao: (caminho, bolinha) =>
        abrirCartaoDaPasta(caminho, bolinha, _edArvore.mostrarIgnorados),
      aoMenu: _edMenuDaArvore,
      aoRenomear: (caminhoNovo, caminhoAntigo) => _edRecarregarArvore(caminhoNovo, caminhoAntigo),
    });

    // A barra de Acesso rápido não é mais desta aba: ela existe desde o boot,
    // em qualquer aba. O que o Editor faz é SE REGISTRAR nela, emprestando a
    // árvore e o "abrir arquivo" — antes esses dois eram closure da criação, e
    // era isso que prendia a barra aqui dentro.
    acessoRapidoUsarArvore(_edArvore, _edAbrirArquivo);

    document.getElementById('ed-btn-recarregar')
      .addEventListener('click', () => _edArvore.recarregar());
    document.getElementById('ed-btn-retrair')
      .addEventListener('click', () => _edRetrairArvore(true));
    document.getElementById('ed-btn-mostrar-arvore')
      .addEventListener('click', () => _edRetrairArvore(false));
    document.getElementById('ed-btn-busca-rapida')
      .addEventListener('click', () => acessoRapidoAlternar());

    ligarArrastoDeAbas({
      area: document.getElementById('ed-area'),
      paineis: () => [_edPaineis.a, _edPaineis.b],
      aoMover: _edMoverAba,
      aoDividir: _edDividirArrastando,
    });

    _edRegistrarTeclas();
    _edLigado = true;
  }

  // ⚠️ É AQUI QUE "por projeto" VIRA VERDADE. O comentário no alto desta função
  // sempre disse que trocar de projeto refazia a árvore e os arquivos abertos,
  // mas só a árvore se refazia: a lista de abertos dos painéis atravessava a
  // troca. Sem `await` de propósito — ver `_edTrocarDeProjeto`.
  if (!primeiraVez) _edTrocarDeProjeto(projetoAnterior);

  // A configuração da categoria Editor: métrica do texto e quais botões
  // aparecem. Aqui e não no `primeiraVez`, porque ela pode ter mudado enquanto
  // a aba estava fechada.
  aplicarMetricasDoEditorAgora();

  // Layout gravado, por projeto.
  const layout = _edLerLayout();
  if (layout.larguraArvore) _edDivArvore.aplicar(layout.larguraArvore);
  _edRetrairArvore(!!layout.arvoreRetraida);
  _edDividir(!!layout.dividido);

  _edArvore.redesenhar();
  _edPintarStatus(_edAtivo);
  _edAtualizarPastasSujas();
}

// Reaplica a configuração nos dois painéis. Global porque `config-editor.js`
// chama depois de salvar e depois de restaurar o padrão — e ele não conhece o
// estado interno desta aba.
// eslint-disable-next-line no-unused-vars
/**
 * Refaz a COLORAÇÃO dos dois painéis, sem recarregar o texto.
 *
 * Chamada de `xtAplicarGramaticasEscolhidas` (`editor-pintura.js`) quando a
 * extensão de gramáticas liga ou desliga: sem ela, o arquivo que já está
 * aberto só ganharia (ou perderia) cor na próxima tecla.
 *
 * ⚠️ `pintura.abrir()` NÃO toca em `ta.value` — a pilha de desfazer daquele
 * arquivo sobrevive. Ver o aviso no topo de `editor-superficie.js`.
 */
// eslint-disable-next-line no-unused-vars
function edRepintarPaineis() {
  if (!_edLigado) return;
  [_edPaineis.a, _edPaineis.b].forEach((p) => {
    if (p && typeof p.recolorir === 'function') p.recolorir();
  });
}

function aplicarMetricasDoEditorAgora() {
  if (!_edLigado) return;
  aplicarMetricasDoEditor([_edPaineis.a.superficie, _edPaineis.b.superficie]);
  _edPaineis.a.sincronizarBotoes();
  _edPaineis.b.sincronizarBotoes();
  _edPaineis.a.atualizarAjudasVisuais();
  _edPaineis.b.atualizarAjudasVisuais();
}

// ── Mover abas entre painéis, e o reenquadramento ──

// ⚠️ SEGURA O REENQUADRAMENTO DURANTE UM MOVIMENTO. Mover uma aba é
// `desanexar` seguido de `adotar`, e o `desanexar` avisa a mudança de estado no
// instante em que o destino ainda está vazio — o reenquadramento acordava aí e
// juntava a tela antes de o arquivo chegar, desfazendo a divisão que o próprio
// gesto tinha acabado de pedir. Medido em 30/08/2026: arrastar para dividir
// terminava com um painel só.
let _edMovendo = false;

function _edComMovimento(fazer) {
  _edMovendo = true;
  try { fazer(); } finally { _edMovendo = false; }
  _edReenquadrar();
}

function _edMoverAba(arq, origem, destino, indice) {
  if (destino === origem) return;
  _edComMovimento(() => {
    // O mesmo arquivo nos dois lados é proibido. Como a operação é MOVER, isso
    // só aconteceria se a invariante já estivesse quebrada — mas a guarda é
    // determinística: foca o que já está lá e fecha o da origem.
    if (destino.temArquivo(arq.caminho)) {
      origem.desanexar(arq);
      destino.abrir(arq.caminho);
    } else {
      origem.desanexar(arq);
      destino.adotar(arq, indice);
    }
    _edFocarPainel(destino);
  });
}

function _edDividirArrastando(arq, origem, lado) {
  // Arrastar o ÚNICO arquivo de um painel para dividir não faz sentido: o
  // resultado seria um painel vazio e um com o mesmo arquivo de antes.
  if (origem.abertos.length < 2) return;
  const destino = lado === 'esquerda' ? _edPaineis.a : _edPaineis.b;
  if (destino === origem) return;
  _edComMovimento(() => {
    _edDividir(true);
    origem.desanexar(arq);
    destino.adotar(arq, null);
    _edFocarPainel(destino);
  });
}

// Roda depois de TODO fechar e de TODO mover. Sem ele sobram os dois estados
// sem sentido: um painel vazio ao lado de um cheio, e — pior — o painel da
// ESQUERDA vazio com o código à direita, onde o botão de juntar levaria na
// direção errada.
function _edReenquadrar() {
  if (_edMovendo) return;
  const { a, b } = _edPaineis;
  const dividido = !document.getElementById('ed-area').classList.contains('ed-area--simples');
  if (!dividido) return;
  if (b.vazio) { _edDividir(false); _edFocarPainel(a); return; }
  if (a.vazio) {
    // A adota tudo de B, na ordem, e a tela volta a um painel só. Sob a guarda
    // também: `desanexar`/`adotar` reentrariam aqui a cada arquivo.
    _edMovendo = true;
    try {
      b.abertos.slice().forEach((arq) => a.adotar(b.desanexar(arq), null));
    } finally { _edMovendo = false; }
    _edDividir(false);
    _edFocarPainel(a);
  }
}

// ── Os menus de contexto ──
// Aqui mora só a AMARRAÇÃO: quem monta as listas é `editor-menus.js`, quem
// desenha é `menu-contexto.js`, quem executa é `editor-arquivos.js`.

// Recarrega a árvore depois de uma operação de disco. Como ela é preguiçosa,
// não dá para "atualizar só aquela linha": o nó pode ter mudado de lugar, de
// nome ou sumido, e os ancestrais têm contagem nova.
//
// `caminhoNovo`/`caminhoAntigo` só vêm preenchidos depois de um rename — os
// outros chamadores (excluir, criar, colar) passam sem argumento, e o passo
// de atualizar os painéis não roda. Chama nos DOIS painéis sem checar qual
// tem a aba aberta: o arquivo só pode estar num painel por vez (nunca nos
// dois), então só um dos dois acha alguma coisa — o outro não faz nada.
function _edRecarregarArvore(caminhoNovo, caminhoAntigo) {
  if (_edArvore) _edArvore.recarregar();
  if (caminhoAntigo) {
    _edPaineis.a.atualizarCaminhoRenomeado(caminhoAntigo, caminhoNovo);
    _edPaineis.b.atualizarCaminhoRenomeado(caminhoAntigo, caminhoNovo);
  }
}

function _edMenuDaArvore(evento, alvo) {
  const ganchos = {
    aoAbrir: _edAbrirArquivo,
    aoAbrirAoLado: async (caminho) => {
      _edDividir(true);
      const destino = _edAtivo === _edPaineis.a ? _edPaineis.b : _edPaineis.a;
      _edFocarPainel(destino);
      await destino.abrir(caminho);
    },
    aoRecarregar: _edRecarregarArvore,
    aoRenomearInline: (caminho) => _edArvore.renomearInline(caminho),
    temNoOutroPainel: (caminho) =>
      _edPaineis.a.temArquivo(caminho) || _edPaineis.b.temArquivo(caminho),
  };
  const itens = alvo.tipo === 'arquivo' ? editorMenus.arquivo(alvo.caminho, ganchos, alvo.selecionados)
    : alvo.tipo === 'pasta' ? editorMenus.pasta(alvo.caminho, ganchos)
    : editorMenus.raiz(ganchos);
  abrirMenuDeContexto({
    x: evento.clientX, y: evento.clientY, itens,
    ponto: 'editor.menu',
    contexto: { tipo: alvo.tipo, caminho: alvo.caminho || '',
                selecionados: alvo.selecionados || [] },
  });
}

function _edMenuDaAba(evento, arq, painel) {
  if (!arq) return;
  abrirMenuDeContexto({
    x: evento.clientX, y: evento.clientY,
    itens: editorMenus.abaDeArquivo(arq.caminho, {
      aoFechar: () => painel.fechar(arq),
      aoFecharOutras: () => painel.fecharOutras(arq),
      aoFecharADireita: () => painel.fecharADireita(arq),
      aoFixar: () => painel.alternarFixado(arq),
    }, arq.fixado),
    ponto: 'editor.aba.menu',
    contexto: { caminho: arq.caminho, fixado: !!arq.fixado },
  });
}
