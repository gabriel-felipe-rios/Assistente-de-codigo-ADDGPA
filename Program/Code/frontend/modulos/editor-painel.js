// ══════════════════════════════ EDITOR: UM PAINEL DE EDIÇÃO ══
// A aba tem DOIS painéis iguais (a tela dividida), e este arquivo é um deles.
// Cada painel tem a sua tira de arquivos abertos, a sua barra de ações, a sua
// superfície e o seu Ctrl+F — tudo independente do outro lado.
//
// ⚠️ CADA ARQUIVO ABERTO GUARDA O SEU PRÓPRIO TEXTO, e o do painel que não está
// à vista fica em `arq.conteudo`. Trocar de aba de arquivo é `superficie.abrir()`
// com o texto guardado, e é exatamente aí que a pilha de desfazer nativa daquele
// textarea é zerada — o preço de usar a pilha do navegador em vez de escrever
// um motor próprio. É o mesmo comportamento de um editor que descarrega o
// buffer, e o Histórico local (editor_historico.py) é a rede para o que
// interessa de verdade: o que estava no disco antes do último save.
//
// Um arquivo aberto:
//   { caminho, conteudo, hashDisco, fimDeLinha, bom, linguagem,
//     somenteLeitura, sujo }

/**
 * Pergunta antes de descartar a edição que ainda não foi para o disco.
 * Devolve `true` se pode fechar.
 *
 * ⚠️ ERA `confirm()` NATIVO, e é por isso que a caixa saía branca no meio de uma
 * tela escura: o `confirm` do WebView2 é do sistema, não do programa, e nenhum
 * token de tema o alcança. O construtor único do projeto é `abrirModalPadrao`
 * — ⛔ não escrever `.modal-overlay` à mão (Padrões de interface › Estrutura das
 * telas › Modal padrão).
 *
 * Respeita "Perguntar antes de fechar arquivo não salvo" (Configurações ›
 * Encerrar e excluir). Desligada, o clique volta a fechar direto.
 */
function _edConfirmarDescartar(arq) {
  if (typeof appSettings === 'object' && appSettings
      && appSettings.confirmar_ao_fechar_arquivo_nao_salvo === false) {
    return Promise.resolve(true);
  }
  const nome = arq.caminho.split('/').pop();
  return perguntarNaModal({
    title: 'Fechar sem salvar?',
    confirmLabel: 'Fechar sem salvar',
    // Diz O QUE SE PERDE, e não "tem certeza?" — regra do Modal padrão.
    bodyHtml: `<div class="modal-body-text">As mudanças de
      <strong>${escapeHtml(nome)}</strong> ainda não foram para o disco, e
      fechar a aba as descarta.<br><br><strong>Não dá pra desfazer.</strong>
      </div>`,
  });
}

// eslint-disable-next-line no-unused-vars
function criarPainelDoEditor(elemento, ganchos) {
  const cb = Object.assign({ aoFocar: null, aoMudarEstado: null, aoMenuDaAba: null, aoBreadcrumb: null,
                            aoIrParaDefinicao: null },
                          ganchos || {});

  elemento.innerHTML = `
    <div class="ed-files-bar"></div>
    <div class="ed-breadcrumb hidden"></div>
    <div class="ed-toolbar hidden">
      <div class="ed-caminho"></div>
      <div class="ed-acoes">
        <button class="btn-icon" data-acao="desfazer" title="Desfazer (Ctrl+Z)">↶</button>
        <button class="btn-icon" data-acao="refazer"  title="Refazer (Ctrl+Shift+Z)">↷</button>
        <button class="btn-icon" data-acao="localizar" title="Buscar no arquivo (Ctrl+F)">🔍</button>
        <button class="btn-icon" data-acao="historico" title="Histórico local deste arquivo">🕓</button>
        <button class="btn btn-positive btn-sm" data-acao="salvar">Salvar</button>
      </div>
    </div>
    <div class="ed-faixa hidden"></div>
    <div class="ed-corpo" style="flex:1; display:flex; min-height:0; position:relative;">
      <div class="ed-placeholder">
        <span>Escolha um arquivo na árvore à esquerda.</span>
      </div>
      <!-- Buscar (e, expandido, substituir) DENTRO DESTE ARQUIVO — igual ao
           Ctrl+F/Ctrl+H do VS Code num painel só. Busca e substituir no
           PROJETO inteiro é outra coisa (Ctrl+Shift+F, sem botão na barra —
           ver editor-buscar-substituir.js). -->
      <div class="ed-find hidden">
        <div class="ed-find-linha ed-find-linha--busca">
          <button class="ed-find-expandir" data-acao="expandir" title="Mostrar substituir (Tab)">▸</button>
          <input type="text" data-f="buscar" spellcheck="false" placeholder="Buscar…">
          <button class="ed-find-toggle" data-acao="caixa" title="Diferenciar maiúsculas/minúsculas">Aa</button>
          <span class="ed-find-contador"></span>
          <button class="ed-find-btn" data-acao="anterior" title="Anterior (Shift+Enter)">↑</button>
          <button class="ed-find-btn" data-acao="proxima"  title="Próxima (Enter)">↓</button>
          <button class="ed-find-btn" data-acao="fechar"   title="Fechar (Esc)">×</button>
        </div>
        <div class="ed-find-linha ed-find-linha--substituir hidden">
          <span class="ed-find-espaco"></span>
          <input type="text" data-f="substituir" spellcheck="false" placeholder="Substituir…">
          <button class="btn btn-muted btn-sm" data-acao="substituir-um" title="Substituir esta ocorrência (Enter)">Substituir</button>
          <button class="btn btn-muted btn-sm" data-acao="substituir-todas">Todas</button>
        </div>
      </div>
    </div>`;

  const barraArquivos = elemento.querySelector('.ed-files-bar');
  const breadcrumb    = elemento.querySelector('.ed-breadcrumb');
  const barraAcoes    = elemento.querySelector('.ed-toolbar');
  const faixa         = elemento.querySelector('.ed-faixa');
  const corpo         = elemento.querySelector('.ed-corpo');
  const placeholder   = elemento.querySelector('.ed-placeholder');
  const barraFind     = elemento.querySelector('.ed-find');

  const superficie = criarSuperficie(corpo);
  // Irmão da superfície, não um modo dela: a superfície continua viva por
  // baixo, com o texto e a pilha de desfazer do arquivo anterior intactos.
  const visualizador = criarVisualizador(corpo);
  const pintura    = criarPintura(superficie);
  const localizador = criarLocalizador(superficie, barraFind);
  const lint = criarLint(superficie);
  // ⚠️ O DECORADOR DAS EXTENSÕES VEM POR ÚLTIMO, depois do lint. Os dois cortam
  // os mesmos nós de texto, e quem corta primeiro fica por fora: com a ordem
  // invertida, o `lint-err` aninharia DENTRO da marca da extensão e o
  // sublinhado ondulado herdaria a cor dela.
  pintura.aoRepintarFazer(() => { localizador.reaplicar(); lint.reaplicar(); _edDecorar(); });
  superficie.pilha.classList.add('hidden');

  const abertos = [];      // os arquivos abertos NESTE painel
  let atual = null;
  // Qual arquivo de texto está CARREGADO na superfície agora. Não é o mesmo que
  // `atual`: abrir uma imagem troca o `atual` e deixa a superfície como estava.
  // É o que permite não recarregar ao voltar — ver `mostrar()`.
  let naSuperficie = null;

  // ── O ponto de encaixe `editor.decorador` (extensões, tipo 12) ──
  // Quem desenha é `extensoes/decorador.js`; daqui sai só o CONTEXTO e as duas
  // chamadas nos ganchos que o lint já usava. Ver o cabeçalho daquele arquivo
  // para o porquê de a extensão devolver uma lista de marcas em vez de receber
  // o `<pre>`.

  /**
   * O que a extensão vê. `null` quando não há arquivo de TEXTO na superfície —
   * aba vazia, ou uma imagem na frente (o `<pre>` continua com o texto do
   * arquivo anterior, e decorá-lo marcaria o que ninguém está vendo).
   *
   * ⚠️ A fonte é `naSuperficie`, e não `atual`: é `naSuperficie` que diz qual
   * arquivo está DENTRO do `<pre>`, que é onde as marcas entram.
   */
  function _edContextoDecorador() {
    if (!naSuperficie || naSuperficie.tipo === 'binario') return null;
    const texto = superficie.texto;
    return {
      projeto: typeof currentProject === 'undefined' ? null : currentProject,
      caminho: naSuperficie.caminho,
      linguagem: pintura.linguagem,
      texto,
      // Calculado UMA vez pelo programa, e não uma vez por extensão: quem
      // trabalha linha a linha (uma cor por coluna num CSV) faria este split
      // a cada pintura.
      linhas: texto.split('\n'),
      visivel: superficie.janelaVisivel(),
    };
  }

  // ⚠️ `xtAlguemDecora()` ANTES de montar o contexto. Sem decoradora ligada, o
  // custo do mecanismo inteiro tem de ser um `Map.size` — montar o contexto
  // significa copiar o arquivo e fatiá-lo em linhas, a cada 120ms de digitação,
  // para ninguém.
  function _edDecorar() {
    if (typeof xtDecorar !== 'function' || typeof xtAlguemDecora !== 'function') return;
    if (!xtAlguemDecora()) return;
    const contexto = _edContextoDecorador();
    if (contexto) xtDecorar(superficie, contexto);
  }

  // Os dois painéis do Editor nascem com a aba e nunca são destruídos
  // (`editor.js`), então este registro não tem baixa. Ele é o que permite a
  // `xtPedirDecoracao` e a `descarregar.js` alcançarem as superfícies sem
  // conhecer o Editor.
  if (typeof xtDecoradorRegistrarSuperficie === 'function') {
    xtDecoradorRegistrarSuperficie(superficie, _edContextoDecorador);
  }

  // ── Estado do arquivo em foco ──
  function marcarSujo() {
    if (!atual || atual.somenteLeitura) return;
    const sujo = superficie.texto !== atual.conteudo;
    if (sujo === atual.sujo) return;
    atual.sujo = sujo;
    pintarBarraArquivos();
    if (cb.aoMudarEstado) cb.aoMudarEstado(api);
  }

  // ⚠️ A barra NUNCA some, nem com zero arquivos abertos. Ela já foi condicional
  // (`abertos.length < 2`) e o efeito era o pior possível: abrir o segundo
  // arquivo fazia uma faixa de 30px nascer e empurrar o código inteiro para
  // baixo, e a tela parecia mudar de tema no meio do trabalho. O CSS garante a
  // altura igual vazia e cheia — ver `.ed-files-bar:empty` em editor.css.
  function pintarBarraArquivos() {
    barraArquivos.innerHTML = abertos.map((a, i) => `
      <div class="ed-file-tab ${a === atual ? 'active' : ''}" data-i="${i}">
        ${a.fixado ? `<span class="ed-pin" data-pin="${i}" title="Desfixar aba">📌</span>` : ''}
        ${a.sujo ? '<span class="ed-sujo" title="Não salvo"></span>' : ''}
        <span>${escapeHtml(a.caminho.split('/').pop())}</span>
        <span class="ed-file-x" data-fechar="${i}" title="Fechar">×</span>
      </div>`).join('');
    barraArquivos.querySelectorAll('.ed-file-tab').forEach((el) => {
      el.addEventListener('click', (e) => {
        const pin = e.target.closest('[data-pin]');
        if (pin) { e.stopPropagation(); abertos[+pin.dataset.pin].fixado = !abertos[+pin.dataset.pin].fixado; pintarBarraArquivos(); return; }
        const fechar = e.target.dataset.fechar;
        if (fechar !== undefined) { e.stopPropagation(); api.fechar(abertos[+fechar]); return; }
        mostrar(abertos[+el.dataset.i]);
      });
      // Clique do meio fecha, como em qualquer navegador. `auxclick` e não
      // `mousedown`: no `mousedown` o Chromium ainda pode iniciar o auto-scroll
      // antes de a aba sumir, e sobra o ícone de rolagem preso na tela.
      el.addEventListener('auxclick', (e) => {
        if (e.button !== 1) return;
        e.preventDefault();
        api.fechar(abertos[+el.dataset.i]);
      });
      // Sem isto o Chromium abre o auto-scroll no clique do meio sobre a aba.
      el.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (cb.aoMenuDaAba) cb.aoMenuDaAba(e, abertos[+el.dataset.i], api);
      });
    });
  }

  // Migalhas de pão: caminho do arquivo ativo, em segmentos clicáveis. Cada
  // segmento (menos o arquivo em si) chama `aoBreadcrumb` com o caminho da
  // pasta — quem decide o que fazer com isso é `editor.js` (revelar na árvore).
  function pintarBreadcrumb() {
    const ligado = typeof appSettings === 'undefined' || appSettings.editor_breadcrumb !== false;
    breadcrumb.classList.toggle('hidden', !atual || !ligado);
    if (!atual || !ligado) { breadcrumb.innerHTML = ''; return; }
    const partes = atual.caminho.split('/');
    const arquivo = partes.pop();
    let acumulado = '';
    const segmentos = partes.map((p) => {
      acumulado = acumulado ? `${acumulado}/${p}` : p;
      return `<span class="ed-breadcrumb-seg" data-pasta="${escapeHtml(acumulado)}">${escapeHtml(p)}</span>`
        + '<span class="sep">›</span>';
    }).join('');
    breadcrumb.innerHTML = `${segmentos}<b>${escapeHtml(arquivo)}</b>`;
    breadcrumb.querySelectorAll('.ed-breadcrumb-seg').forEach((el) => {
      el.addEventListener('click', () => { if (cb.aoBreadcrumb) cb.aoBreadcrumb(el.dataset.pasta); });
    });
  }

  function pintarBarraAcoes() {
    pintarBreadcrumb();
    barraAcoes.classList.toggle('hidden', !atual);
    // Binário esconde a superfície e mostra o visualizador; quem cuida disso é
    // `mostrar()`. Aqui só o caso "nenhum arquivo aberto".
    superficie.pilha.classList.toggle('hidden', !atual || atual.tipo === 'binario');
    placeholder.classList.toggle('hidden', !!atual);
    if (!atual) { faixa.classList.add('hidden'); superficie.mostrarMinimapa(false); return; }
    // Repete o nome + caminho que a migalha de pão (Obra 9) já mostra logo
    // acima — redundante quando as duas estão ligadas, então é configurável.
    const mostrarCaminho = typeof appSettings === 'undefined' || appSettings.editor_caminho_barra !== false;
    const elCaminho = barraAcoes.querySelector('.ed-caminho');
    elCaminho.classList.toggle('hidden', !mostrarCaminho);
    if (mostrarCaminho) {
      elCaminho.innerHTML = `<b>${escapeHtml(atual.caminho.split('/').pop())}</b> &nbsp;·&nbsp; ${escapeHtml(atual.caminho)}`;
    }
    barraAcoes.querySelector('[data-acao="salvar"]').disabled = atual.somenteLeitura;
    sincronizarBotoes();
    // Num binário, os botões de texto não têm o que fazer — desabilitados, e
    // não escondidos: sumir mudaria a largura da barra a cada troca de aba.
    if (atual.tipo === 'binario') {
      ['desfazer', 'refazer', 'localizar', 'historico'].forEach((acao) => {
        const el = barraAcoes.querySelector(`[data-acao="${acao}"]`);
        if (el) el.disabled = true;
      });
    } else {
      ['desfazer', 'refazer', 'localizar', 'historico'].forEach((acao) => {
        const el = barraAcoes.querySelector(`[data-acao="${acao}"]`);
        if (el) el.disabled = false;
      });
    }
    pintarFaixa();
    const ligado = typeof appSettings === 'undefined' || appSettings.editor_minimapa !== false;
    superficie.mostrarMinimapa(ligado && atual.tipo !== 'binario');
  }

  // A faixa diz o que impede a edição normal, e some quando não há nada a
  // dizer. Uma faixa por vez: a mais grave manda.
  function pintarFaixa(mensagem, tipo, acao) {
    if (mensagem) {
      faixa.className = `ed-faixa ${tipo === 'erro' ? 'ed-faixa--erro' : ''}`;
      faixa.innerHTML = `<span class="ed-faixa-texto">${escapeHtml(mensagem)}</span>`;
      if (acao) {
        const b = document.createElement('button');
        b.className = 'btn btn-muted btn-sm';
        b.textContent = acao.rotulo;
        b.addEventListener('click', acao.fazer);
        faixa.appendChild(b);
      }
      return;
    }
    if (atual && atual.somenteLeitura) {
      faixa.className = 'ed-faixa';
      faixa.innerHTML = `<span class="ed-faixa-texto">${escapeHtml(atual.aviso || 'Somente leitura.')}</span>`;
      return;
    }
    if (atual && pintura.grande && !pintura.colorindo) {
      faixa.className = 'ed-faixa';
      faixa.innerHTML = '<span class="ed-faixa-texto">Arquivo grande — cor desligada para o editor não travar.</span>';
      const b = document.createElement('button');
      b.className = 'btn btn-muted btn-sm';
      b.textContent = 'Colorir mesmo assim';
      b.addEventListener('click', async () => { await pintura.forcar(); pintarFaixa(); });
      faixa.appendChild(b);
      return;
    }
    faixa.classList.add('hidden');
    faixa.className = 'ed-faixa hidden';
  }

  async function mostrar(arq) {
    if (!arq) return;
    // Guarda o texto do que estava aberto antes de trocar — senão a edição
    // não salva do arquivo anterior some ao voltar para ele. Só se o anterior
    // era texto: um binário não tem superfície para ler.
    if (atual && atual !== arq && atual.tipo !== 'binario') atual.rascunho = superficie.texto;
    atual = arq;

    if (arq.tipo === 'binario') {
      // ⚠️ NÃO toca em `superficie.abrir()`. O textarea continua com o texto do
      // último arquivo de código, e a pilha de desfazer dele junto — é o que
      // faz abrir um PNG e voltar para o `.py` devolver o Ctrl+Z de onde
      // estava. Só escondemos a superfície.
      superficie.pilha.classList.add('hidden');
      localizador.fechar();
      await visualizador.mostrar(arq.caminho);
    } else {
      visualizador.esconder();
      // ⚠️ SÓ RECARREGA SE FOR OUTRO ARQUIVO. `superficie.abrir()` atribui a
      // `ta.value`, e isso destrói a pilha de desfazer nativa — é a única
      // atribuição permitida, e ela custa o Ctrl+Z daquele arquivo. Sem esta
      // guarda, espiar uma imagem e voltar para o `.py` zerava o desfazer de
      // um arquivo que nunca saiu da superfície. De quebra, a rolagem fica
      // onde estava em vez de voltar ao topo.
      if (naSuperficie !== arq) {
        superficie.abrir(arq.rascunho !== undefined ? arq.rascunho : arq.conteudo);
        naSuperficie = arq;
        await pintura.abrir(arq.linguagem);
        await lint.abrir(arq.caminho);
      }
      superficie.somenteLeitura(arq.somenteLeitura);
    }
    _edAplicarZoom();
    pintarBarraArquivos();
    pintarBarraAcoes();
    if (cb.aoMudarEstado) cb.aoMudarEstado(api);
  }

  // ── Zoom por aba (Obra 9) ──
  // `--ed-fonte` normalmente só existe no `:root` (editor-metricas.js). Aqui é
  // sobreposta INLINE em `.ed-pilha` — CSS custom property cascateia pros
  // descendentes (`.ed-pre-inner`, `.ed-ta`, `.ed-gutter-inner`), e só nesta
  // instância; as outras abas e o outro painel continuam com o token global.
  function _edZoomBasePx() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ed-fonte')) || 12.5;
  }

  function _edAplicarZoom() {
    const pct = (atual && atual.zoomPct) || 100;
    if (pct === 100) superficie.pilha.style.removeProperty('--ed-fonte');
    else superficie.pilha.style.setProperty('--ed-fonte', `${(_edZoomBasePx() * pct / 100).toFixed(2)}px`);
    superficie.pintarRegua();
  }

  function _edMudarZoom(delta) {
    if (!atual || atual.tipo === 'binario') return;
    atual.zoomPct = Math.min(300, Math.max(40, Math.round((atual.zoomPct || 100) + delta)));
    _edAplicarZoom();
    if (cb.aoMudarEstado) cb.aoMudarEstado(api);
  }

  function _edResetarZoom() {
    if (!atual || !atual.zoomPct || atual.zoomPct === 100) return;
    atual.zoomPct = 100;
    _edAplicarZoom();
    if (cb.aoMudarEstado) cb.aoMudarEstado(api);
  }

  // Ctrl+scroll dentro do código — não precisa estar sobre a régua nem a
  // superfície especificamente, o `.ed-corpo` inteiro responde.
  corpo.addEventListener('wheel', (e) => {
    if (!e.ctrlKey || !atual || atual.tipo === 'binario') return;
    e.preventDefault();
    _edMudarZoom(e.deltaY < 0 ? 10 : -10);
  }, { passive: false });

  superficie.ligar({
    aoMudar: () => {
      pintura.aoDigitar();
      if (atual) lint.aoDigitar(atual.caminho);
      marcarSujo();
      if (cb.aoMudarEstado) cb.aoMudarEstado(api);
    },
    aoSalvar: () => api.salvar(),
    arquivoAtual: () => (atual ? atual.caminho : ''),
    aoBuscar: () => localizador.alternar(),
    // A janela de cor promoveu ou rebaixou um bloco (rolagem): o conteúdo dele
    // foi refeito e as marcas do Ctrl+F e do lint que estavam dentro sumiram —
    // o mesmo que acontece numa repintura, e a mesma resposta.
    aoJanela: () => { localizador.reaplicar(); lint.reaplicar(); _edDecorar(); },
  });
  superficie.ta.addEventListener('focus', () => { if (cb.aoFocar) cb.aoFocar(api); });
  superficie.ta.addEventListener('keyup', () => { if (cb.aoMudarEstado) cb.aoMudarEstado(api); });
  superficie.ta.addEventListener('click', async (e) => {
    if (cb.aoMudarEstado) cb.aoMudarEstado(api);
    // Ctrl+clique num nome pula pra onde ele foi declarado (Obra 11) — mesmo
    // índice que "Quem usa este arquivo" já usa, então herda a mesma limitação
    // (só nome usado em MAIS DE UM arquivo entra no índice).
    if (!e.ctrlKey && !e.metaKey) return;
    if (!atual || atual.tipo === 'binario') return;
    const re = /[A-Za-z_][A-Za-z0-9_]*/g;
    const pos = superficie.ta.selectionStart;
    let nome = null;
    let m;
    while ((m = re.exec(superficie.ta.value))) {
      if (m.index <= pos && pos <= m.index + m[0].length) { nome = m[0]; break; }
      if (m.index > pos) break;
    }
    if (!nome) return;
    const r = await window.pywebview.api.get_definicao_do_identificador(currentProject, nome);
    if (!r.success) { showToast(r.error, true); return; }
    if (cb.aoIrParaDefinicao) cb.aoIrParaDefinicao(r.arquivo, r.linha);
  });
  elemento.addEventListener('mousedown', () => { if (cb.aoFocar) cb.aoFocar(api); });

  // ── Soltar arquivo de fora do programa DIRETO no editor (Obra 7.2) ──
  // Só visualiza — nada é copiado pro projeto até o usuário decidir salvar
  // (e o botão Salvar fica desativado por `somenteLeitura`, então nem isso
  // acontece sozinho). Diferente de soltar na árvore: aqui não precisa do
  // `drag-drop.js` nem do backend — o conteúdo já vem no próprio `File`.
  corpo.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.some((t) => t.toLowerCase() === 'files')) return;
    e.preventDefault();
  });
  corpo.addEventListener('drop', async (e) => {
    if (!e.dataTransfer.types.some((t) => t.toLowerCase() === 'files')) return;
    e.preventDefault();
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    const conteudo = await file.text();
    const arq = {
      caminho: file.name, tipo: 'texto', conteudo, hashDisco: null,
      fimDeLinha: 'lf', bom: false, linguagem: 'none', somenteLeitura: true,
      aviso: 'Visualização de um arquivo solto de fora do projeto — nada foi copiado.',
      sujo: false,
    };
    abertos.push(arq);
    await mostrar(arq);
    if (cb.aoFocar) cb.aoFocar(api);
  });

  barraAcoes.addEventListener('click', (e) => {
    const acao = e.target.dataset.acao;
    if (!acao) return;
    if (acao === 'desfazer')  { superficie.focar(); document.execCommand('undo'); }
    if (acao === 'refazer')   { superficie.focar(); document.execCommand('redo'); }
    if (acao === 'localizar') localizador.alternar();
    if (acao === 'salvar')    api.salvar();
    if (acao === 'historico') abrirHistoricoLocal(api, corpo);
  });

  // Quais botões da barra aparecem — Configurações → Editor. Desligar um botão
  // NÃO desliga a função: o atalho continua valendo, e é isso que o rodapé da
  // aba mostra. Por isso é só `hidden`, e nada mais.
  function sincronizarBotoes() {
    const mapa = {
      salvar:    'editor_botao_salvar',
      desfazer:  'editor_botao_desfazer',
      refazer:   'editor_botao_desfazer',
      localizar: 'editor_botao_buscar',
      historico: 'editor_botao_historico',
    };
    Object.entries(mapa).forEach(([acao, chave]) => {
      const el = barraAcoes.querySelector(`[data-acao="${acao}"]`);
      if (el) el.classList.toggle('hidden', appSettings[chave] === false);
    });
  }

  const api = {
    elemento, superficie, pintura, localizador, visualizador, sincronizarBotoes,
    // Reavalia minimapa/migalhas de pão/lint contra `appSettings` sem trocar
    // de arquivo — chamado depois de salvar Configurações → Editor de código.
    atualizarAjudasVisuais() {
      pintarBarraAcoes();
      if (atual && atual.tipo !== 'binario') lint.abrir(atual.caminho);
    },

    async abrir(caminho) {
      const jaAberto = abertos.find((a) => a.caminho === caminho);
      if (jaAberto) { await mostrar(jaAberto); superficie.focar(); return true; }

      const r = await window.pywebview.api.editor_ler_arquivo(currentProject, caminho);
      if (!r.success) { showToast(r.error || 'Não deu para abrir o arquivo.', true); return false; }
      const arq = {
        caminho, tipo: r.tipo || 'texto',
        conteudo: r.conteudo, hashDisco: r.hash,
        fimDeLinha: r.fim_de_linha, bom: r.bom, linguagem: r.linguagem,
        somenteLeitura: !!r.somente_leitura, aviso: r.aviso, sujo: false,
      };
      abertos.push(arq);
      await mostrar(arq);
      superficie.focar();
      return true;
    },

    // ⚠️ ASSÍNCRONA, e devolve se FECHOU. Era síncrona, com o `confirm()` nativo
    // do WebView2 — a caixa branca de texto preto no meio da tela escura, sem
    // nada do tema do programa. O modal padrão é assíncrono, e é isso que
    // obriga esta função a ser: quem espera pelo resultado é
    // `fecharOutras`/`fecharADireita`, que precisam perguntar UMA DE CADA VEZ.
    async fechar(arq) {
      if (!arq) return false;
      if (arq.sujo && !(await _edConfirmarDescartar(arq))) return false;
      const i = abertos.indexOf(arq);
      abertos.splice(i, 1);
      if (naSuperficie === arq) naSuperficie = null;
      if (atual === arq) {
        atual = null;
        const proximo = abertos[Math.min(i, abertos.length - 1)];
        if (proximo) { mostrar(proximo); return true; }
        superficie.abrir('');
        pintarBarraArquivos();
        pintarBarraAcoes();
        if (cb.aoMudarEstado) cb.aoMudarEstado(api);
      } else {
        pintarBarraArquivos();
      }
      return true;
    },

    salvar() { return salvarArquivoDoPainel(api); },

    // Mesma alternância do 📌 na aba — exposta pro menu de contexto da aba
    // também poder fixar/desfixar (o ícone sozinho, quase invisível até o
    // hover, era fácil de errar o clique nele).
    alternarFixado(arq) { arq.fixado = !arq.fixado; pintarBarraArquivos(); },

    // Para o menu da aba. `fecharOutras`/`fecharADireita` passam por `fechar`,
    // que é quem pergunta antes de descartar mudança não salva.
    // Aba fixada nunca fecha por aqui — só o × dela mesma, de propósito.
    //
    // ⚠️ `for...of` COM `await`, e não `forEach`. Com o `confirm()` nativo o
    // laço era síncrono e as caixas saíam empilhadas, uma por arquivo sujo; com
    // o modal padrão, um `forEach` abriria todos os modais de uma vez, um por
    // cima do outro, e o usuário responderia sem saber de qual arquivo é qual.
    async fecharOutras(arq) {
      for (const a of abertos.slice().filter((x) => x !== arq && !x.fixado)) await api.fechar(a);
    },
    async fecharADireita(arq) {
      const i = abertos.indexOf(arq);
      for (const a of abertos.slice(i + 1)) await api.fechar(a);
    },

    // ── Mover uma aba entre painéis (editor-arrasto.js) ──
    // ⚠️ A operação é MOVER, nunca copiar. É isso que preserva a proibição de o
    // mesmo arquivo estar aberto nos dois lados: dois buffers do mesmo arquivo
    // divergem, e o segundo Ctrl+S apaga o primeiro em silêncio.

    // Tira do painel SEM perguntar e SEM ler o disco, devolvendo o objeto com o
    // buffer vivo. Reler descartaria a edição não salva — o mesmo defeito que
    // `rascunho` conserta na troca de abas.
    desanexar(arq) {
      const i = abertos.indexOf(arq);
      if (i < 0) return null;
      // Se era o que está na superfície, o texto de agora é o que vale.
      if (naSuperficie === arq) { arq.rascunho = superficie.texto; naSuperficie = null; }
      abertos.splice(i, 1);
      if (atual === arq) {
        atual = null;
        const proximo = abertos[Math.min(i, abertos.length - 1)];
        if (proximo) mostrar(proximo);
        else { superficie.abrir(''); visualizador.esconder();
               pintarBarraArquivos(); pintarBarraAcoes(); }
      } else {
        pintarBarraArquivos();
      }
      if (cb.aoMudarEstado) cb.aoMudarEstado(api);
      return arq;
    },

    // Recebe um arquivo JÁ CARREGADO, sem tocar no disco.
    adotar(arq, indice) {
      const i = (indice === undefined || indice === null) ? abertos.length : indice;
      abertos.splice(Math.max(0, Math.min(i, abertos.length)), 0, arq);
      mostrar(arq);
    },

    // ── Troca de PROJETO (editor.js) ──
    // ⚠️ NÃO É `fechar`, E NÃO PODE SER. Fechar pergunta sobre alteração não
    // salva e depois descarta; trocar de projeto não é o usuário abrindo mão do
    // que digitou — é a mesma aba passando a mostrar outro lugar. Estes dois
    // tiram e repõem a lista VIVA (com `rascunho`), sem tocar no disco, para o
    // Editor guardar um conjunto de abertos por projeto.
    //
    // O que se perde na volta é a pilha de desfazer nativa: repor passa por
    // `mostrar()` → `superficie.abrir()`, que atribui a `ta.value`. O texto,
    // esse, volta inteiro — inclusive o que não tinha sido salvo.
    esvaziarParaTroca() {
      if (atual && atual.tipo !== 'binario') atual.rascunho = superficie.texto;
      const lista = abertos.slice();
      abertos.length = 0;
      atual = null;
      naSuperficie = null;
      superficie.abrir('');
      visualizador.esconder();
      localizador.fechar();
      pintarBarraArquivos();
      pintarBarraAcoes();
      if (cb.aoMudarEstado) cb.aoMudarEstado(api);
      return lista;
    },

    // Repõe o que `esvaziarParaTroca` devolveu. `caminhoAtual` diz qual deles
    // volta para a frente: sem isso, voltar a um projeto cairia sempre no
    // primeiro arquivo da tira, e não naquele em que se estava.
    async repovoarDaTroca(lista, caminhoAtual) {
      (lista || []).forEach((a) => abertos.push(a));
      const alvo = abertos.find((a) => a.caminho === caminhoAtual) || abertos[0];
      if (alvo) { await mostrar(alvo); return; }
      pintarBarraArquivos();
      pintarBarraAcoes();
      if (cb.aoMudarEstado) cb.aoMudarEstado(api);
    },

    // Em que posição da barra de abas o ponteiro está — para o cursor de
    // inserção do arraste.
    indiceNoPonto(x) {
      const tabs = [...barraArquivos.querySelectorAll('.ed-file-tab')];
      for (let i = 0; i < tabs.length; i++) {
        const r = tabs[i].getBoundingClientRect();
        if (x < r.left + r.width / 2) return i;
      }
      return tabs.length;
    },

    barraDeAbas: barraArquivos,

    // Quem troca o conteúdo por fora (recarregar do disco, restaurar do
    // histórico) chama isto: sem invalidar, a próxima volta a este arquivo
    // acharia que a superfície já está certa e mostraria o texto velho.
    invalidarSuperficie() { naSuperficie = null; },

    // Refaz a coloração do que está na superfície — só a COR, não o texto.
    // Quem chama é `edRepintarPaineis` (editor.js), quando a extensão de
    // gramáticas (tipo 11) liga ou desliga.
    //
    // ⚠️ Não passa por `mostrar()` nem por `superficie.abrir()`: os dois
    // atribuem a `ta.value` e isso destruiria a pilha de desfazer nativa
    // daquele arquivo. `pintura.abrir()` só refaz o `<pre>`.
    async recolorir() {
      if (!naSuperficie) return;
      await pintura.abrir(naSuperficie.linguagem);
      pintarBarraAcoes();
    },

    // Renomear: se o arquivo estava aberto NESTE painel, atualiza caminho e
    // linguagem no lugar — sem isso a aba fica com o nome/cor antigos até
    // fechar e reabrir. Chamado nos dois painéis sem checar qual tem o
    // arquivo: o outro simplesmente não acha nada e não faz nada.
    async atualizarCaminhoRenomeado(caminhoAntigo, caminhoNovo) {
      const arq = abertos.find((a) => a.caminho === caminhoAntigo);
      if (!arq) return;
      arq.caminho = caminhoNovo;
      if (arq.tipo !== 'binario') {
        const r = await window.pywebview.api.editor_ler_arquivo(currentProject, caminhoNovo);
        if (r.success) {
          arq.linguagem = r.linguagem;
          if (arq === atual) await pintura.abrir(arq.linguagem);
        }
      }
      pintarBarraArquivos();
      if (arq === atual) pintarBarraAcoes();
    },

    // Depois de gravar: o disco passa a ser o que está na tela.
    confirmarGravacao(hash) {
      atual.conteudo = superficie.texto;
      atual.rascunho = undefined;
      atual.hashDisco = hash;
      atual.sujo = false;
      pintarBarraArquivos();
      if (cb.aoMudarEstado) cb.aoMudarEstado(api);
    },

    // Recarrega do disco uma aba já aberta — usado depois de "Substituir
    // todas" (Obra 13) gravar por fora do painel. Só se estiver LIMPA: se tem
    // edição não salva, quem chama já pulou este arquivo na gravação, e
    // recarregar aqui destruiria a edição em andamento por cima do nada.
    async recarregarSeAberto(caminho) {
      const arq = abertos.find((a) => a.caminho === caminho);
      if (!arq || arq.sujo || arq.tipo === 'binario') return;
      const r = await window.pywebview.api.editor_ler_arquivo(currentProject, caminho);
      if (!r.success) return;
      arq.conteudo = r.conteudo;
      arq.hashDisco = r.hash;
      arq.rascunho = undefined;
      if (naSuperficie === arq) naSuperficie = null;
      if (atual === arq) await mostrar(arq);
    },

    faixa: pintarFaixa,
    mudarZoom: _edMudarZoom,
    resetarZoom: _edResetarZoom,
    zoomPct() { return (atual && atual.zoomPct) || 100; },
    irParaLinha(n) { superficie.irParaLinha(n); },
    temArquivo(caminho) { return abertos.some((a) => a.caminho === caminho); },
    get atual() { return atual; },
    get abertos() { return abertos; },
    get vazio() { return abertos.length === 0; },
    focar() { superficie.focar(); },
  };
  return api;
}
