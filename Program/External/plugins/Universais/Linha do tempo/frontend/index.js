// ═══════════════════════ Plugin: Linha do tempo ══
// Script clássico — sem import/export. Ponto de entrada: `window.montarPlugin`
// (ver Program/Code/prompts/Como adicionar/Plugins/Contrato/Como criar plugins.md).
//
// ── Por que este plugin tem mais de um arquivo de frontend ─────────────────
// O programa injeta SÓ `frontend/index.js` e cobra `window.montarPlugin` logo
// depois do onload. Mas a AMF deste projeto tem teto obrigatório de 500 linhas
// por arquivo. A saída, registrada em "Arquitetura modular › Convenções" e já
// usada por "Animação do código": este arquivo define `montarPlugin` de forma
// SÍNCRONA (o que o programa exige) e a montagem em si é assíncrona — carrega
// os módulos irmãos `ltempo-*.js`, que se registram em `window.__ltempo`.
//
// ── O que este plugin faz ─────────────────────────────────────────────────
// Mostra o que foi criado, editado, apagado e movido em cada DIA de um
// projeto. Ele não coleta nada: lê o histórico que o **Plugin base** publica
// em `files/{projeto}/dias/`, direto do disco (contrato público, ver
// `Como usar o Plugin base.md`).
//
// ⚠️ Não confundir com "Animação do código", que também tem eixo de tempo mas
// varre o escopo AO VIVO e ordena por data de criação — é reconstrução a
// partir do presente, e arquivo apagado semana passada não existe para ele.
// Aqui é registro do que aconteceu, gravado no dia em que aconteceu.

(function () {
  // O caminho deste plugin (pra chamar_plugin) sai do próprio
  // document.currentScript.src — nunca escrito à mão: o usuário pode mover a
  // pasta dele pra dentro de uma categoria a qualquer momento.
  const CAMINHO_PLUGIN = document.currentScript
    ? decodeURIComponent(document.currentScript.src
        .replace(/^.*\/External\/plugins\//, '')
        .replace(/\/frontend\/index\.js(?:\?.*)?$/, ''))
    : 'Linha do tempo';
  const BASE = document.currentScript ? new URL('.', document.currentScript.src).href : '';
  const MODULOS = ['ltempo-estilo', 'ltempo-dados', 'ltempo-barra',
                   'ltempo-painel', 'ltempo-editor', 'ltempo-feed', 'ltempo-faixa'];

  let carregando = null;
  let estado = null;
  let raizGuardada = null;
  let desligar = [];          // o que precisa ser desfeito ao remontar

  function _carregarModulos() {
    if (carregando) return carregando;
    // Reinjeta a cada carga: sem isso, editar um módulo não tem efeito até
    // reiniciar o programa.
    document.querySelectorAll('script[data-ltempo-mod]').forEach(s => s.remove());
    const t = Date.now();
    carregando = Promise.all(MODULOS.map(nome => new Promise((ok, falhou) => {
      const s = document.createElement('script');
      s.dataset.ltempoMod = nome;
      s.src = BASE + nome + '.js?t=' + t;
      s.onload = ok;
      s.onerror = () => falhou(new Error('não achou ' + nome + '.js'));
      document.head.appendChild(s);
    })));
    return carregando;
  }

  window.montarPlugin = function (container, contexto) {
    container.innerHTML = '<p class="plugins-vazio">Carregando…</p>';
    _carregarModulos().then(async () => {
      window.__ltempo.estilo.injetar();
      estado = {
        projeto: (contexto && contexto.projeto) || null,
        dias: 30, modo: 'editor', filtro: '', tipos: [], profundidade: 'auto',
        janela: null, carregandoJanela: false,
        selecao: null, eventos: null, carregandoEventos: false,
        cursor: null,
        // ⚠️ Guarda de corrida: trocar de projeto ou de janela depressa pode
        // fazer a resposta antiga chegar depois da nova e pintar o dado
        // errado. Cada pedido leva um número; resposta velha é descartada.
        //
        // São DOIS contadores, de propósito. Com um só, clicar num bloco
        // cancelaria um carregamento de janela ainda em voo — e a tela ficaria
        // presa no "Carregando…" para sempre, porque a resposta da janela
        // chegaria e seria descartada.
        pedidoJanela: 0, pedidoEventos: 0,
      };
      container.innerHTML = '';
      const raiz = document.createElement('div');
      raiz.className = 'ltempo-raiz';
      container.appendChild(raiz);
      raizGuardada = raiz;
      if (estado.projeto) _carregarJanela(raiz);
      else await _montarSeletorDeProjeto(raiz);
    }).catch(e => {
      carregando = null;   // libera pra tentar de novo
      container.innerHTML = '<p class="plugins-vazio">Não foi possível carregar os módulos '
        + 'deste plugin (' + String(e && e.message || e) + ').</p>';
    });
  };

  async function _montarSeletorDeProjeto(raiz) {
    let projetos = [];
    try { projetos = await window.pywebview.api.list_projects(); } catch (e) { projetos = []; }
    if (!projetos || !projetos.length) {
      raiz.innerHTML = '<p class="plugins-vazio">Nenhum projeto cadastrado ainda.</p>';
      return;
    }
    estado.projeto = projetos[0];
    estado.projetos = projetos;
    _carregarJanela(raiz);
  }

  // ── Carregar a janela e pintar ──────────────────────────────────────────

  async function _carregarJanela(raiz) {
    const meu = ++estado.pedidoJanela;
    // Uma janela nova invalida qualquer lista de eventos em voo: ela vem de um
    // bloco que pode nem existir mais depois do recarregamento.
    estado.pedidoEventos++;
    estado.carregandoJanela = true;
    _pintar(raiz);
    const resp = await window.__ltempo.dados.chamar(CAMINHO_PLUGIN, 'carregar_janela', {
      // ⛔ A chave é `alvo`, NUNCA `projeto`: `chamar_plugin` reage a `projeto`
      // abrindo o grafo.json inteiro e parseando o pipeline.md em toda chamada,
      // e nada disso é usado aqui.
      alvo: estado.projeto, dias: estado.dias, filtro: estado.filtro,
      tipos: estado.tipos, profundidade: estado.profundidade,
    });
    if (meu !== estado.pedidoJanela) return;    // chegou tarde
    estado.carregandoJanela = false;
    estado.janela = resp.success ? resp : null;
    estado.erro = resp.success ? null : (resp.error || 'Falhou');
    estado.selecao = null;
    estado.eventos = null;
    if (resp.success) estado.cursor = resp.hoje;
    _pintar(raiz);
  }

  async function _carregarEventos(raiz, selecao) {
    const meu = ++estado.pedidoEventos;
    estado.selecao = selecao;
    estado.eventos = null;
    estado.carregandoEventos = true;
    _pintar(raiz);
    const comum = {
      alvo: estado.projeto, filtro: estado.filtro, tipos: estado.tipos,
      profundidade_efetiva: estado.janela ? estado.janela.profundidade : 'auto',
    };
    const resp = selecao.tipo === 'bloco'
      ? await window.__ltempo.dados.chamar(CAMINHO_PLUGIN, 'carregar_bloco',
          Object.assign({ pasta: selecao.pasta, ini: selecao.ini, fim: selecao.fim }, comum))
      : await window.__ltempo.dados.chamar(CAMINHO_PLUGIN, 'carregar_dia',
          Object.assign({ dia: selecao.dia }, comum));
    if (meu !== estado.pedidoEventos) return;
    estado.carregandoEventos = false;
    estado.eventos = resp.success ? (resp.eventos || []) : [];
    _pintar(raiz);
  }

  function _limparTela() {
    // Listener de document e ResizeObserver não somem sozinhos ao repintar —
    // e um arraste de agulha órfão continuaria respondendo ao mouse.
    desligar.forEach(f => { try { f(); } catch (e) { /* ignora */ } });
    desligar = [];
  }

  function _pintar(raiz) {
    _limparTela();
    const L = window.__ltempo;
    const cabecalho = L.barra.html(estado);

    if (estado.carregandoJanela && !estado.janela) {
      raiz.innerHTML = cabecalho + '<p class="ltempo-msg">Carregando…</p>';
      L.barra.ligar(raiz, estado, acoes, desligar);
      return;
    }
    if (estado.erro === 'sem_dado') {
      raiz.innerHTML = cabecalho + L.barra.htmlSemDado(estado);
      L.barra.ligar(raiz, estado, acoes, desligar);
      return;
    }
    if (estado.erro) {
      raiz.innerHTML = cabecalho + '<p class="ltempo-msg">' + L.dados.escapar(estado.erro) + '</p>';
      L.barra.ligar(raiz, estado, acoes, desligar);
      return;
    }

    const modo = { editor: L.editor, feed: L.feed, faixa: L.faixa }[estado.modo] || L.editor;
    raiz.innerHTML = cabecalho + '<div class="ltempo-palco">' + modo.html(estado) + '</div>';
    L.barra.ligar(raiz, estado, acoes, desligar);
    modo.ligar(raiz, estado, acoes, desligar);
  }

  // ── O que os módulos podem pedir de volta ───────────────────────────────

  const acoes = {
    recarregar() { _carregarJanela(_raizAtual()); },
    repintar() { _pintar(_raizAtual()); },
    selecionar(selecao) { _carregarEventos(_raizAtual(), selecao); },
    trocarProjeto(nome) {
      estado.projeto = nome;
      _carregarJanela(_raizAtual());
    },
  };

  // ⚠️ A raiz é GUARDADA, não procurada com querySelector no document. O
  // usuário pode marcar o mesmo plugin em "Tela principal" e "Dentro do
  // projeto" (Configurações › Plugins), e aí existem duas raízes na página —
  // um querySelector global pegaria a primeira, que pode ser a errada.
  function _raizAtual() {
    return raizGuardada;
  }
})();
