// ═══════════════════════════════════ CANVAS DAS TELAS — OS EVENTOS ══
// O ciclo da aba e do servidor das telas: desenhar, subir, ler, montar; e o
// servidor que sobe ao abrir a aba e cai ao sair dela (D44). Todo ouvinte de
// tela é delegado no container, que sobrevive a cada remontagem.

(function () {
  const montada = () => typeof window.ctMontada === 'function' && window.ctMontada();
  const sem = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const ligados = new WeakSet();
  // O valor de navegação da aba desta extensão — `telas.js` do programa o
  // monta assim a partir do `id` do manifesto.
  const ABA_TELAS = 'xt-tela-' + 'ct.telas'.replace(/\./g, '-');
  // Sair e voltar em fila: um vai-e-volta rápido não pode cruzar o `parar`
  // de um com o `subir` do outro.
  let fila = Promise.resolve();
  const naFila = fn => (fila = fila.then(fn, fn));

  // A busca: por nome de arquivo e de aba, sem acento e sem caixa. O título
  // de grupo que ficar sem item visível também some.
  function filtrar(lista, texto) {
    const q = sem(texto.trim());
    lista.querySelectorAll('[data-foco]').forEach(b =>
      b.classList.toggle('hidden', !!q && !sem(b.dataset.texto).includes(q)));
    lista.querySelectorAll('.ct-grupo').forEach(g => {
      let n = g.nextElementSibling, algum = false;
      while (n && !n.classList.contains('ct-grupo')) {
        if (n.dataset.foco && !n.classList.contains('hidden')) algum = true;
        n = n.nextElementSibling;
      }
      g.classList.toggle('hidden', !algum);
    });
  }

  function ligar(container) {
    if (ligados.has(container)) return;
    ligados.add(container);
    container.addEventListener('input', e => {
      if (e.target.id !== 'ct-busca') return;
      window.ctEstado.filtro = e.target.value;
      const lista = container.querySelector('#ct-lista');
      if (lista) filtrar(lista, e.target.value);
    });
    window.ctEstado.ligadores.forEach(f => f(container));
  }

  function noCanvas(container, html) {
    const c = container.querySelector('#ct-canvas');
    if (c) c.innerHTML = html;
  }

  window.ctIniciar = async function (container, ctx) {
    const projeto = (ctx && ctx.projeto) || null;
    const e = window.ctEstado;
    e.container = container;
    e.projeto = projeto;
    e.leitura = null;
    e.filtro = '';
    e.desenhada = false;
    e.lida = false;
    e.dentro = null;
    e.posicoesDe = {};
    // Cada desenho é uma rodada: um desenho novo (voltar à aba depois de um
    // aviso, ⟳ Ler de novo) aposenta o que ainda estava esperando a ponte.
    const rodada = e.rodada = (e.rodada || 0) + 1;
    const vivo = () => montada() && window.ctEstado === e && e.projeto === projeto
      && e.container === container && e.rodada === rodada;

    container.innerHTML = '<div class="ct-corpo"><nav class="ct-lista">carregando…</nav></div>';
    // O estado gravado (os tamanhos do ⚙ e o "Não guardar") entra antes de
    // pintar, para o topo já nascer com ele.
    const est = await window.ctChamar('estado_ler');
    if (!vivo()) return;
    const g = (est && est.estado) || {};
    if (g.tamanhos && typeof g.tamanhos === 'object') {
      Object.keys(e.TAMANHOS_PADRAO).forEach(k => {
        const v = g.tamanhos[k];
        if (Array.isArray(v) && v.length === 2 && v.every(n => Number.isFinite(n))) e.tamanhos[k] = [v[0], v[1]];
      });
    }
    if (typeof g.nao_guardar === 'boolean') e.naoGuardar = g.nao_guardar;
    if (g.modo_setas === 'escolhida' || g.modo_setas === 'todas') e.modoSetas = g.modo_setas;
    if (typeof g.cor === 'string' && /^--[a-z]+-rgb$/.test(g.cor)) e.cor = g.cor;
    if (typeof g.ganho_ligado === 'boolean') e.ganhoLigado = g.ganho_ligado;
    if (g.origem_setas === 'elemento' || g.origem_setas === 'tela') e.origemSetas = g.origem_setas;
    if (['vazada', 'cheia', 'x', 'nenhuma'].includes(g.bolinha)) e.bolinha = g.bolinha;
    if (typeof g.reducao_ligada === 'boolean') e.reducaoLigada = g.reducao_ligada;
    ['opacidade', 'ganho', 'reducao'].forEach(k => {
      if (Number.isFinite(g[k])) e[k] = Math.min(100, Math.max(0, g[k]));
    });

    container.innerHTML = window.ctHtmlAba();
    ligar(container);
    const lista = container.querySelector('#ct-lista');
    if (!projeto) { lista.textContent = 'Abra um projeto para ver as telas dele.'; return; }

    e.erro = '';
    const s = await window.ctChamar('subir', { projeto });
    if (!vivo()) return;
    if (!s) {
      lista.textContent = '';
      noCanvas(container, `<p class="config-erro">${escapeHtml(e.erro || 'Não deu para subir o servidor das telas.')}</p>`);
      return;
    }
    e.servidor = s;

    const r = await window.ctLer(projeto);
    if (!vivo()) return;
    if (!r) { lista.textContent = 'Não deu para ler as telas deste projeto.'; return; }
    e.leitura = r;
    e.lida = true;
    lista.innerHTML = window.ctHtmlLista(r);
    if (r.aviso || !(r.telas || []).length) {
      noCanvas(container, `<p class="config-nota">${escapeHtml(r.aviso || 'Nenhuma tela encontrada.')}</p>`);
      return;
    }

    const pos = await window.ctChamar('posicoes_ler', { projeto });
    if (!vivo()) return;
    e.posicoesGravadas = (pos && pos.posicoes) || {};
    const lembrar = ((typeof xtPreferenciasDe === 'function' && xtPreferenciasDe(window.ctSlug)) || {}).lembrar_posicoes !== false;
    const guardadas = lembrar && e.posicoesGravadas[e.tamanho];
    e.posicoes = {};
    window.ctArrumar();
    if (guardadas) Object.keys(guardadas).forEach(id => { if (e.posicoes[id]) e.posicoes[id] = guardadas[id]; });

    e.escolhida = r.telas[0].id;
    window.ctMontarQuadros();
    window.ctSelecionar(e.escolhida);
    window.ctVerTudo();
    e.desenhada = true;
  };

  window.ctAoMudarDeAba = function (aba) {
    if (aba !== ABA_TELAS) { window.ctAoSair(); return; }
    const e = window.ctEstado;
    const aberto = (typeof currentProject !== 'undefined' && currentProject) || null;
    // A aba parou num aviso (ex.: aberta antes de o arquivo principal ser
    // marcado): o programa só a redesenha quando o projeto muda, então é
    // aqui que ela tenta de novo — senão ficaria no aviso para sempre.
    if (!e.desenhada && e.container && e.projeto && e.projeto === aberto) {
      window.ctIniciar(e.container, { projeto: e.projeto });
      return;
    }
    window.ctAoVoltar();
  };

  // Voltou à aba: sobe o servidor e recarrega cada tela no endereço dela.
  window.ctAoVoltar = async function () {
    return naFila(async () => {
      const e = window.ctEstado;
      const aberto = (typeof currentProject !== 'undefined' && currentProject) || null;
      if (!montada() || !e.desenhada || e.servidor || e.projeto !== aberto) return;
      const s = await window.ctChamar('subir', { projeto: e.projeto });
      if (!montada() || !s) return;
      e.servidor = s;
      // Salvou enquanto a aba estava fechada: relê agora (fase 03, F22).
      if (e.precisaLer) {
        e.precisaLer = false;
        await e.lerDeNovo();
        return;
      }
      window.ctMontarQuadros();
      window.ctAplicar();
    });
  };

  // Saiu da aba: com "Não guardar" ligado, apaga o que o site guardou no
  // navegador (D45); depois esvazia as telas e derruba o servidor. Nada vai
  // para os arquivos do projeto.
  window.ctAoSair = function () {
    return naFila(async () => {
      const e = window.ctEstado;
      if (!e.servidor) return;
      if (e.naoGuardar) await window.ctLimparArmazenamento();
      if (e.container) e.container.querySelectorAll('.ct-quadro iframe').forEach(f => { f.src = 'about:blank'; });
      e.dentro = null;
      await window.ctChamar('parar');
      e.servidor = null;
    });
  };

  // Chamado pelo `xtDesmontar`: o programa já derruba o servidor pelo
  // processo gerenciado; aqui só se pede, sem esperar, e se tiram os ouvintes.
  window.ctEncerrar = function () {
    const e = window.ctEstado;
    if (e.servidor) {
      try { window.pywebview.api.chamar_extensao(window.ctCaminho, { acao: 'parar' }); } catch (err) { /* nada */ }
      e.servidor = null;
    }
    e.ouvintes.forEach(([alvo, tipo, fn, op]) => alvo.removeEventListener(tipo, fn, op));
    e.ouvintes = [];
  };

  // "Redesenhar a cada Ctrl+S" (D2, F22): com a aba aberta, relê na hora;
  // fora dela, só marca — nada trabalha enquanto ninguém olha.
  window.ctAoSalvar = function (dado) {
    const e = window.ctEstado;
    const prefs = (typeof xtPreferenciasDe === 'function' && xtPreferenciasDe(window.ctSlug)) || {};
    if (prefs.redesenhar_ao_salvar === false || !dado || dado.projeto !== e.projeto) return;
    if (!/\.(html?|js|css)$/i.test(String(dado.arquivo || ''))) return;
    if (!e.desenhada) return;
    if (e.servidor) naFila(() => e.lerDeNovo());
    else e.precisaLer = true;
  };
})();
