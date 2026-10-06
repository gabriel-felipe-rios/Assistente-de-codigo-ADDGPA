// ═══════════════════════ Plugin: Plugin base ══
// Script clássico — sem import/export. Ponto de entrada: `window.montarPlugin`
// (ver Program/Code/prompts/Como adicionar/Plugins/Contrato/Como criar plugins.md).
//
// Sub-aba só "Tela principal" (não faz sentido "Dentro do projeto" — este
// plugin mostra todos os projetos ao mesmo tempo, um de cada vez pela combo).
// A captura automática roda em segundo plano (plugin_boot.py); esta tela
// CONSULTA o que já foi capturado, deixa configurar o que capturar, capturar
// na hora (manual, sem mexer no laço periódico) e remover o dado de um
// projeto.
//
// Duas formas de ver o dado do MESMO projeto selecionado (toggle, não
// navegação): "Gráficos" (relatório visual — linhas ao longo do tempo,
// mudanças por dia, tempos) e "Dados" (o valor cru, separado por categoria em
// painéis retráteis — arquivos e mudanças capturam coisas diferentes, não faz
// sentido uma tabela só misturando tudo).
//
// ⚠️ Todo gráfico daqui itera um INTERVALO DE DATAS contíguo, nunca as chaves
// que existem no dado. A versão 1 desenhava `Object.keys(...).slice(-30)` — os
// últimos 30 REGISTROS, não os últimos 30 dias — então uma semana sem abrir o
// programa virava barra colada na seguinte e o eixo X mentia sem avisar.

(function () {
  // O caminho deste plugin (pra chamar_plugin) sai do próprio
  // document.currentScript.src — nunca escrito à mão: o usuário pode mover
  // a pasta dele pra dentro de uma categoria a qualquer momento, e um nome
  // fixo aqui ficaria descasado do que o backend passa a esperar.
  const CAMINHO_PLUGIN = document.currentScript
    ? decodeURIComponent(document.currentScript.src
        .replace(/^.*\/External\/plugins\//, '')
        .replace(/\/frontend\/index\.js(?:\?.*)?$/, ''))
    : 'Plugin base';

  const DIAS_NA_JANELA = 30;

  let config = null;
  let listaProjetos = [];      // nomes de projeto que têm dado capturado
  let listaOrfas = [];         // dado de projeto que não existe mais
  let aba = 'graficos';
  let modoDoGrafico = 'total'; // 'total' | 'novas'
  let projetoSelecionado = null;
  let dadoAtual = null;        // {atual, dias:[{dia, fechamento, ...}]}
  let arquivosCarregados = null;
  let diaAberto = null;        // o dia cujos eventos estão expandidos
  let eventosDoDiaAberto = null;
  let paineisAbertos = new Set();
  let configVisivel = false;
  // ⚠️ Guarda de corrida: trocar a combo depressa (A → B) podia deixar a
  // resposta de A chegar DEPOIS da de B e pintar A com a combo mostrando B.
  // Cada carregamento leva um número; resposta de número velho é descartada.
  let cargaEmVoo = 0;

  window.montarPlugin = function (container, _contexto) {
    _injetarEstilo();
    container.innerHTML = '<p class="plugins-vazio">Carregando…</p>';
    _carregarLista(container);
  };

  async function _chamar(acao, extra) {
    try {
      return await window.pywebview.api.chamar_plugin(CAMINHO_PLUGIN, Object.assign({ acao }, extra));
    } catch (e) {
      return { success: false, error: String(e && e.message || e) };
    }
  }

  function _avisar(texto, ehErro) {
    // A notificação é a porta única do projeto (ver Padrões de interface ›
    // Comportamentos › Notificações). `alert()` trava a janela inteira e não
    // respeita nada do que o usuário configurou em Configurações.
    if (typeof showToast === 'function') showToast(texto, !!ehErro);
  }

  async function _carregarLista(container) {
    const [respListar, respConfig] = await Promise.all([
      _chamar('listar', {}),
      _chamar('carregar_config', {}),
    ]);
    config = respConfig.success ? respConfig.config : { intervalo_minutos: 15, categorias: {} };
    listaProjetos = respListar.success ? (respListar.projetos || []) : [];
    listaOrfas = respListar.success ? (respListar.orfas || []) : [];
    if (projetoSelecionado && listaProjetos.indexOf(projetoSelecionado) === -1) projetoSelecionado = null;
    if (!projetoSelecionado && listaProjetos.length) projetoSelecionado = listaProjetos[0];
    _desenhar(container, respListar.success ? null : respListar.error);
  }

  function _desenhar(container, erroListar) {
    container.innerHTML = `
      <div class="pb-raiz">
        <div class="pb-topo">
          <p class="pb-titulo">Dados compartilhados</p>
          <div class="pb-acoes">
            <button type="button" class="pb-btn-capturar btn btn-primary btn-sm">⟳ Capturar agora</button>
            <button type="button" class="pb-btn-config btn btn-utility btn-sm">⚙ Configurar captura</button>
          </div>
        </div>
        <div class="pb-painel-config ${configVisivel ? '' : 'pb-escondido'}"></div>
        <div class="pb-abas">
          <button type="button" class="pb-aba-btn" data-aba="graficos">Gráficos</button>
          <button type="button" class="pb-aba-btn" data-aba="dados">Dados</button>
        </div>
        <div class="pb-selecao"></div>
        <div class="pb-aba-corpo"></div>
        <div class="pb-orfas"></div>
      </div>`;
    const raiz = container.querySelector('.pb-raiz');
    raiz.querySelector('.pb-btn-config').addEventListener('click', () => _alternarConfig(raiz));
    raiz.querySelector('.pb-btn-capturar').addEventListener('click', () => _capturarAgora(container, raiz));
    raiz.querySelectorAll('.pb-aba-btn').forEach(btn => {
      btn.addEventListener('click', () => { aba = btn.dataset.aba; _renderizarCorpo(raiz); });
    });
    if (configVisivel) _montarConfig(raiz);
    _desenharOrfas(raiz, container);

    if (erroListar) {
      raiz.querySelector('.pb-aba-corpo').innerHTML =
        `<p class="plugins-vazio">Não foi possível ler os dados capturados (${_escapar(erroListar)}).</p>`;
      return;
    }
    if (!listaProjetos.length) {
      raiz.querySelector('.pb-aba-corpo').innerHTML =
        `<p class="plugins-vazio">Nenhum projeto com dado capturado ainda. A captura automática roda em
          segundo plano, ou clique em "Capturar agora" para gerar o primeiro dado já.</p>`;
      return;
    }
    _desenharSelecao(raiz);
    _carregarDadoSelecionado(raiz);
  }

  // ── A combo de projeto + remover, compartilhada pelas duas abas ─────────

  function _desenharSelecao(raiz) {
    raiz.querySelector('.pb-selecao').innerHTML = `
      <label class="pb-selecao-combo">Projeto
        <select class="pb-select-projeto">
          ${listaProjetos.map(p => `<option value="${_escapar(p)}" ${p === projetoSelecionado ? 'selected' : ''}>${_escapar(p)}</option>`).join('')}
        </select>
      </label>
      <button type="button" class="btn btn-negative btn-sm pb-btn-remover-sel">Remover dados deste projeto</button>`;
    raiz.querySelector('.pb-select-projeto').addEventListener('change', (ev) => {
      projetoSelecionado = ev.target.value;
      arquivosCarregados = null;
      diaAberto = null;
      eventosDoDiaAberto = null;
      _carregarDadoSelecionado(raiz);
    });
    raiz.querySelector('.pb-btn-remover-sel').addEventListener('click', () => _confirmarRemocao(raiz));
  }

  async function _carregarDadoSelecionado(raiz) {
    const meuToken = ++cargaEmVoo;
    dadoAtual = null;
    raiz.querySelector('.pb-aba-corpo').innerHTML = '<p class="pb-msg">Carregando…</p>';
    if (!projetoSelecionado) return;
    const alvo = projetoSelecionado;
    const resp = await _chamar('carregar_dados', { projeto: alvo, dias: 400 });
    if (meuToken !== cargaEmVoo) return;   // chegou tarde: outro projeto já foi pedido
    if (!resp.success) {
      raiz.querySelector('.pb-aba-corpo').innerHTML = `<p class="pb-msg">${_escapar(resp.error || 'Não foi possível ler os dados.')}</p>`;
      return;
    }
    dadoAtual = resp.dado;
    _renderizarCorpo(raiz);
  }

  function _renderizarCorpo(raiz) {
    raiz.querySelectorAll('.pb-aba-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.aba === aba));
    const corpo = raiz.querySelector('.pb-aba-corpo');
    if (!dadoAtual) { corpo.innerHTML = '<p class="pb-msg">Carregando…</p>'; return; }
    if (aba === 'dados') _renderDados(raiz, corpo, dadoAtual);
    else _renderGraficos(raiz, corpo, dadoAtual);
  }

  // ── A janela de dias: SEMPRE contígua ───────────────────────────────────

  function _iso(data) {
    return data.getFullYear() + '-' +
      String(data.getMonth() + 1).padStart(2, '0') + '-' +
      String(data.getDate()).padStart(2, '0');
  }

  function _janelaDeDias(quantos) {
    const dias = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    for (let i = quantos - 1; i >= 0; i--) {
      const d = new Date(hoje);
      d.setDate(hoje.getDate() - i);
      dias.push(_iso(d));
    }
    return dias;
  }

  function _porDia(dado) {
    const mapa = {};
    (dado.dias || []).forEach(d => { mapa[d.dia] = d; });
    return mapa;
  }

  // ── Aba "Gráficos": relatório visual do projeto selecionado ─────────────

  function _renderGraficos(raiz, corpo, dado) {
    const atual = dado.atual || {};
    const totais = atual.totais || {};
    corpo.innerHTML = `
      <div class="pb-relatorio">
        <div class="pb-relatorio-stats">
          <span>${_numero(totais.arquivos)} arquivos</span>
          <span>${_numero(totais.linhas)} linhas</span>
          <span>Última captura: ${_dataLegivel(atual.atualizado_em)}</span>
          ${atual.historico_desde ? `<span>Histórico desde ${_escapar(atual.historico_desde)}</span>` : ''}
        </div>
        <div class="pb-relatorio-secao">
          <div class="pb-secao-cab">
            <h4>Linhas de código ao longo do tempo</h4>
            <div class="pb-toggle">
              <button type="button" class="pb-toggle-btn" data-modo="total">Total</button>
              <button type="button" class="pb-toggle-btn" data-modo="novas">Novas</button>
            </div>
          </div>
          <div class="pb-grafico-alvo"></div>
        </div>
        ${_htmlMudancasPorDia(dado)}
        ${_htmlTemposBarras(atual.tempos)}
      </div>`;
    corpo.querySelectorAll('.pb-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.modo === modoDoGrafico);
      btn.addEventListener('click', () => {
        modoDoGrafico = btn.dataset.modo;
        _renderizarCorpo(raiz);
      });
    });
    corpo.querySelector('.pb-grafico-alvo').innerHTML =
      modoDoGrafico === 'novas' ? _htmlGraficoNovas(dado) : _htmlGraficoTotal(dado);
  }

  // "Total" é LINHA com o eixo Y no intervalo min–max da janela, não barra a
  // partir do zero. Um projeto que oscila entre 94.000 e 105.000 linhas
  // desenhado do zero vira um bloco chapado onde nada se distingue — a
  // variação real é 10% da altura. O eixo vem rotulado justamente para deixar
  // claro que não começa no zero.
  function _htmlGraficoTotal(dado) {
    const dias = _janelaDeDias(DIAS_NA_JANELA);
    const mapa = _porDia(dado);
    const valores = dias.map(d => {
      const f = mapa[d] && mapa[d].fechamento;
      return (f && typeof f.linhas === 'number') ? f.linhas : null;
    });
    const conhecidos = valores.filter(v => v !== null);
    if (conhecidos.length < 2) {
      return `<p class="pb-msg">Ainda não há captura suficiente para desenhar um gráfico
        (precisa de pelo menos 2 dias com captura). Dias capturados até agora:
        ${_numero(conhecidos.length)}.</p>`;
    }
    const min = Math.min.apply(null, conhecidos);
    const max = Math.max.apply(null, conhecidos);
    const folga = Math.max(1, (max - min) * 0.08 || max * 0.005);
    const topo = max + folga;
    const base = Math.max(0, min - folga);
    const larguraPasso = 18, altura = 110, margemTopo = 6;
    const largura = dias.length * larguraPasso;
    const y = v => margemTopo + (1 - (v - base) / (topo - base || 1)) * (altura - margemTopo * 2);
    const x = i => i * larguraPasso + larguraPasso / 2;

    // Buraco NÃO é interpolado: dia sem captura não é "a mesma quantidade de
    // linhas de ontem", é "não sei". A linha se parte, e o leitor vê o vão.
    let segmentos = [], atual = [];
    valores.forEach((v, i) => {
      if (v === null) { if (atual.length) segmentos.push(atual); atual = []; return; }
      atual.push(`${x(i)},${y(v).toFixed(1)}`);
    });
    if (atual.length) segmentos.push(atual);

    const linhas = segmentos.filter(s => s.length > 1)
      .map(s => `<polyline class="pb-linha" points="${s.join(' ')}"/>`).join('');
    const pontos = valores.map((v, i) => v === null ? '' :
      `<circle class="pb-ponto" cx="${x(i)}" cy="${y(v).toFixed(1)}" r="2.5">
         <title>${_escapar(dias[i])}: ${_numero(v)} linhas</title></circle>`).join('');
    const semCaptura = valores.filter(v => v === null).length;

    return `
      <div class="pb-grafico-rolagem">
        <svg class="pb-svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}">
          ${linhas}${pontos}
        </svg>
      </div>
      <div class="pb-eixo">
        <span>${_escapar(dias[0])}</span>
        <span class="pb-eixo-escala">eixo de ${_numero(Math.round(base))} a ${_numero(Math.round(topo))} linhas — não começa no zero</span>
        <span>${_escapar(dias[dias.length - 1])}</span>
      </div>
      ${semCaptura ? `<p class="pb-relatorio-legenda">${_numero(semCaptura)} dos ${_numero(dias.length)} dias
        não tiveram captura — a linha se interrompe neles em vez de ligar os pontos.</p>` : ''}`;
  }

  // "Novas" é barra DIVERGENTE, com ganhas e perdidas separadas — nunca um
  // número líquido. O dia em que se reescreve 3.000 linhas tem saldo zero, e
  // um gráfico de saldo o mostraria como um dia sem trabalho nenhum.
  function _htmlGraficoNovas(dado) {
    const dias = _janelaDeDias(DIAS_NA_JANELA);
    const mapa = _porDia(dado);
    const linhas = dias.map(d => {
      const f = mapa[d] && mapa[d].fechamento;
      if (!f) return null;                                  // sem captura ≠ zero
      return { ganhas: f.linhas_ganhas || 0, perdidas: f.linhas_perdidas || 0,
               desconhecidas: f.linhas_desconhecidas || 0 };
    });
    const comDado = linhas.filter(Boolean);
    if (!comDado.length) {
      return '<p class="pb-msg">Nenhum dia com captura na janela de 30 dias.</p>';
    }
    const maior = Math.max(1, ...comDado.map(v => Math.max(v.ganhas, v.perdidas)));
    const larguraPasso = 18, meia = 52, altura = meia * 2 + 6;
    const largura = dias.length * larguraPasso;
    const alturaDe = v => Math.max(v > 0 ? 2 : 0, Math.round((v / maior) * (meia - 6)));

    const barras = linhas.map((v, i) => {
      const cx = i * larguraPasso + larguraPasso / 2;
      const largBarra = larguraPasso - 7;
      if (!v) {
        return `<rect class="pb-sem-captura" x="${cx - largBarra / 2}" y="${meia - 1}"
          width="${largBarra}" height="2"><title>${_escapar(dias[i])}: sem captura</title></rect>`;
      }
      const hg = alturaDe(v.ganhas), hp = alturaDe(v.perdidas);
      const dica = `${dias[i]}: +${_numero(v.ganhas)} / −${_numero(v.perdidas)} linhas` +
        (v.desconhecidas ? ` (${_numero(v.desconhecidas)} não contabilizadas)` : '');
      return `
        <rect class="pb-ganhas" x="${cx - largBarra / 2}" y="${meia - hg}" width="${largBarra}" height="${hg}" rx="1">
          <title>${_escapar(dica)}</title></rect>
        <rect class="pb-perdidas" x="${cx - largBarra / 2}" y="${meia}" width="${largBarra}" height="${hp}" rx="1">
          <title>${_escapar(dica)}</title></rect>`;
    }).join('');

    const totalGanhas = comDado.reduce((s, v) => s + v.ganhas, 0);
    const totalPerdidas = comDado.reduce((s, v) => s + v.perdidas, 0);
    return `
      <div class="pb-grafico-rolagem">
        <svg class="pb-svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}">
          <line class="pb-base" x1="0" y1="${meia}" x2="${largura}" y2="${meia}"/>
          ${barras}
        </svg>
      </div>
      <div class="pb-eixo">
        <span>${_escapar(dias[0])}</span>
        <span class="pb-eixo-escala">
          <b class="pb-cor-ganhas">+${_numero(totalGanhas)}</b> /
          <b class="pb-cor-perdidas">−${_numero(totalPerdidas)}</b> linhas em ${_numero(dias.length)} dias
        </span>
        <span>${_escapar(dias[dias.length - 1])}</span>
      </div>`;
  }

  function _htmlMudancasPorDia(dado) {
    const dias = _janelaDeDias(DIAS_NA_JANELA);
    const mapa = _porDia(dado);
    const contagens = dias.map(d => {
      const f = mapa[d] && mapa[d].fechamento;
      if (!f) return null;
      return (f.arquivos_criados || 0) + (f.arquivos_editados || 0) +
             (f.arquivos_apagados || 0) + (f.arquivos_movidos || 0);
    });
    const comDado = contagens.filter(v => v !== null);
    if (!comDado.length) {
      return '<div class="pb-relatorio-secao"><h4>Mudanças por dia</h4>' +
        '<p class="pb-msg">Sem mudanças registradas para este projeto (categoria desligada, ou ainda sem captura).</p></div>';
    }
    const maior = Math.max(1, ...comDado);
    // Quadrado vazado = dia sem captura. É diferente de um dia capturado com
    // zero mudanças, e a tira antiga não sabia distinguir os dois.
    const quadrados = dias.map((d, i) => {
      if (contagens[i] === null) {
        return `<div class="pb-dia-quad pb-dia-vazio" title="${_escapar(d)}: sem captura"></div>`;
      }
      const intensidade = contagens[i] === 0 ? 0.08 : Math.max(0.2, contagens[i] / maior);
      return `<div class="pb-dia-quad" style="opacity:${intensidade.toFixed(2)}"
        title="${_escapar(d)}: ${_numero(contagens[i])} mudanças"></div>`;
    }).join('');
    const totalMudancas = comDado.reduce((s, v) => s + v, 0);
    return `<div class="pb-relatorio-secao">
      <h4>Mudanças por dia</h4>
      <div class="pb-tira">${quadrados}</div>
      <p class="pb-relatorio-legenda">${_numero(totalMudancas)} mudanças nestes ${_numero(dias.length)} dias
        (arquivos criados, editados, apagados e movidos). Quadrado vazado é dia sem captura.</p>
    </div>`;
  }

  function _htmlTemposBarras(tempos) {
    tempos = tempos || {};
    const linhas = [
      ['Rotinas (Automação)', tempos.rotinas_segundos],
      ['Fila (Assistente)', tempos.fila_segundos],
      ['Chat (aproximado)', tempos.chat_segundos],
    ].filter(([, v]) => v != null);
    if (!linhas.length) {
      return '<div class="pb-relatorio-secao"><h4>Tempo gasto</h4>' +
        '<p class="pb-msg">Nenhuma categoria de tempo está ligada para este projeto.</p></div>';
    }
    const max = Math.max(1, ...linhas.map(([, v]) => v));
    const barras = linhas.map(([rotulo, v]) => `
      <div class="pb-tempo-linha">
        <span class="pb-tempo-rotulo">${_escapar(rotulo)}</span>
        <div class="pb-tempo-trilho"><div class="pb-tempo-preenchido" style="width:${Math.max(2, Math.round((v / max) * 100))}%"></div></div>
        <span class="pb-tempo-valor">${_duracao(v)}</span>
      </div>`).join('');
    return `<div class="pb-relatorio-secao"><h4>Tempo gasto</h4>${barras}
      <p class="pb-relatorio-legenda">Totais acumulados desde a primeira captura, não sessões.</p></div>`;
  }

  // ── Aba "Dados": um painel retrátil por categoria capturada ─────────────

  function _renderDados(raiz, corpo, dado) {
    const paineis = [
      _painelArquivos(),
      _painelMudancas(dado),
      _painelTempo('tempo-rotinas', 'Tempo em rotinas (Automação)', (dado.atual.tempos || {}).rotinas_segundos),
      _painelTempo('tempo-fila', 'Tempo na fila (Assistente)', (dado.atual.tempos || {}).fila_segundos),
      _painelTempo('tempo-chat', 'Tempo no chat (aproximado)', (dado.atual.tempos || {}).chat_segundos),
    ];
    corpo.innerHTML = `<div class="pb-paineis">${paineis.join('')}</div>`;
    corpo.querySelectorAll('.pb-painel-retratil').forEach(painel => {
      if (paineisAbertos.has(painel.dataset.painel)) painel.classList.add('pb-painel-aberto');
    });
    corpo.querySelectorAll('.pb-painel-cab').forEach(cab => {
      cab.addEventListener('click', () => {
        const painel = cab.closest('.pb-painel-retratil');
        const id = painel.dataset.painel;
        painel.classList.toggle('pb-painel-aberto');
        if (painel.classList.contains('pb-painel-aberto')) {
          paineisAbertos.add(id);
          if (id === 'arquivos' && arquivosCarregados === null) _carregarArquivos(raiz);
        } else {
          paineisAbertos.delete(id);
        }
      });
    });
    corpo.querySelectorAll('.pb-linha-dia').forEach(linha => {
      linha.addEventListener('click', () => _alternarDia(raiz, linha.dataset.dia));
    });
  }

  function _painel(id, titulo, resumo, corpoHtml) {
    return `
      <div class="pb-painel-retratil" data-painel="${_escapar(id)}">
        <button type="button" class="pb-painel-cab">
          <span class="pb-painel-seta">▸</span>
          <span class="pb-painel-titulo">${_escapar(titulo)}</span>
          <span class="pb-painel-resumo">${_escapar(resumo)}</span>
        </button>
        <div class="pb-painel-corpo">${corpoHtml}</div>
      </div>`;
  }

  function _painelArquivos() {
    const totais = (dadoAtual.atual || {}).totais || {};
    const resumo = (totais.arquivos != null)
      ? `${_numero(totais.arquivos)} arquivos, ${_numero(totais.linhas)} linhas`
      : 'Categoria desligada, ou sem captura ainda';
    if (arquivosCarregados === null) {
      return _painel('arquivos', 'Arquivos e linhas', resumo,
        '<p class="pb-msg">Abra para carregar a lista.</p>');
    }
    const caminhos = Object.keys(arquivosCarregados).sort();
    const corpo = !caminhos.length ? '<p class="pb-msg">Sem lista de arquivos para mostrar.</p>' : `
      <div class="pb-tabela-scroll">
        <table class="pb-tabela">
          <thead><tr><th>Caminho</th><th>Linhas</th><th>Criado</th><th>Modificado</th></tr></thead>
          <tbody>
            ${caminhos.map(caminho => {
              const info = arquivosCarregados[caminho] || {};
              return `<tr><td class="pb-td-caminho">${_escapar(caminho)}</td>
                <td>${info.binario ? '<span class="pb-fraco">binário</span>' : _numero(info.linhas)}</td>
                <td>${_dataLegivel(info.criado != null ? info.criado * 1000 : null)}</td>
                <td>${_dataLegivel(info.modificado != null ? info.modificado * 1000 : null)}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
    return _painel('arquivos', 'Arquivos e linhas', resumo, corpo);
  }

  async function _carregarArquivos(raiz) {
    const alvo = projetoSelecionado;
    const resp = await _chamar('carregar_arquivos', { projeto: alvo });
    if (alvo !== projetoSelecionado) return;
    arquivosCarregados = resp.success ? (resp.arquivos || {}) : {};
    if (!resp.success) _avisar(resp.error || 'Não foi possível ler a lista de arquivos.', true);
    _renderizarCorpo(raiz);
  }

  function _painelMudancas(dado) {
    const dias = (dado.dias || []).slice().reverse();   // mais recente primeiro
    const comFechamento = dias.filter(d => d.fechamento);
    const resumo = comFechamento.length
      ? `${_numero(comFechamento.length)} dias com captura`
      : 'Categoria desligada, ou sem captura ainda';
    const corpo = !dias.length ? '<p class="pb-msg">Sem dias registrados.</p>' : `
      <div class="pb-tabela-scroll">
        <table class="pb-tabela">
          <thead><tr><th>Dia</th><th>Criados</th><th>Editados</th><th>Apagados</th><th>Movidos</th>
            <th>+ linhas</th><th>− linhas</th><th>Total</th></tr></thead>
          <tbody>
            ${dias.map(d => {
              const f = d.fechamento || {};
              const temEventos = d.quantidade_eventos > 0;
              const aberto = diaAberto === d.dia;
              const detalhe = aberto ? _htmlEventosDoDia() : '';
              return `<tr class="pb-linha-dia ${temEventos ? 'pb-clicavel' : ''} ${aberto ? 'pb-dia-aberto' : ''}" data-dia="${_escapar(d.dia)}">
                  <td>${temEventos ? '<span class="pb-seta-dia">▸</span> ' : ''}${_escapar(d.dia)}${d.primeira_captura ? ' <span class="pb-fraco">(início)</span>' : ''}</td>
                  <td>${_numero(f.arquivos_criados)}</td><td>${_numero(f.arquivos_editados)}</td>
                  <td>${_numero(f.arquivos_apagados)}</td><td>${_numero(f.arquivos_movidos)}</td>
                  <td class="pb-cor-ganhas">${f.linhas_ganhas ? '+' + _numero(f.linhas_ganhas) : '—'}</td>
                  <td class="pb-cor-perdidas">${f.linhas_perdidas ? '−' + _numero(f.linhas_perdidas) : '—'}</td>
                  <td>${d.fechamento ? _numero(f.linhas) : '<span class="pb-fraco">sem captura</span>'}</td>
                </tr>${detalhe}`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <p class="pb-relatorio-legenda">O total de cada dia é o retrato da captura mais recente DAQUELE dia —
        não o estado no fim do dia. Clique num dia para ver o que mudou.</p>`;
    return _painel('mudancas', 'Mudanças por dia', resumo, corpo);
  }

  function _htmlEventosDoDia() {
    if (eventosDoDiaAberto === null) {
      return '<tr class="pb-detalhe"><td colspan="8"><p class="pb-msg">Carregando…</p></td></tr>';
    }
    if (!eventosDoDiaAberto.length) {
      return '<tr class="pb-detalhe"><td colspan="8"><p class="pb-msg">Nenhuma mudança registrada neste dia.</p></td></tr>';
    }
    const rotulo = { criado: 'criado', editado: 'editado', apagado: 'apagado',
                     movido: 'movido', projeto_renomeado: 'projeto renomeado' };
    const itens = eventosDoDiaAberto.map(ev => {
      const alvo = ev.tipo === 'movido' || ev.tipo === 'projeto_renomeado'
        ? `${_escapar(ev.de)} → ${_escapar(ev.para)}` : _escapar(ev.caminho);
      let medida = '';
      if (ev.tipo === 'editado' && typeof ev.linhas === 'number' && typeof ev.linhas_antes === 'number') {
        const delta = ev.linhas - ev.linhas_antes;
        medida = delta >= 0 ? `<span class="pb-cor-ganhas">+${_numero(delta)}</span>`
                            : `<span class="pb-cor-perdidas">−${_numero(-delta)}</span>`;
      } else if (ev.tipo === 'criado' && typeof ev.linhas === 'number') {
        medida = `<span class="pb-cor-ganhas">+${_numero(ev.linhas)}</span>`;
      } else if (ev.tipo === 'apagado' && typeof ev.linhas_antes === 'number') {
        medida = `<span class="pb-cor-perdidas">−${_numero(ev.linhas_antes)}</span>`;
      }
      // `origem: "captura"` quer dizer que a data do arquivo não foi aceita
      // (antiga demais ou no futuro) e o dia é o da captura — o leitor
      // precisa saber que aquela linha é "quando eu vi", não "quando foi".
      const marca = ev.origem === 'captura'
        ? '<span class="pb-fraco" title="O carimbo do arquivo não foi aceito; a data é a da captura que percebeu">· visto na captura</span>' : '';
      return `<li><span class="pb-tag pb-tag-${_escapar(ev.tipo)}">${_escapar(rotulo[ev.tipo] || ev.tipo)}</span>
        <span class="pb-td-caminho">${alvo}</span> ${medida} ${marca}</li>`;
    }).join('');
    return `<tr class="pb-detalhe"><td colspan="8"><ul class="pb-eventos">${itens}</ul></td></tr>`;
  }

  async function _alternarDia(raiz, dia) {
    if (diaAberto === dia) { diaAberto = null; eventosDoDiaAberto = null; _renderizarCorpo(raiz); return; }
    diaAberto = dia;
    eventosDoDiaAberto = null;
    _renderizarCorpo(raiz);
    const alvo = projetoSelecionado;
    const resp = await _chamar('carregar_dia', { projeto: alvo, dia });
    if (alvo !== projetoSelecionado || diaAberto !== dia) return;
    eventosDoDiaAberto = resp.success ? ((resp.dia || {}).eventos || []) : [];
    _renderizarCorpo(raiz);
  }

  function _painelTempo(id, titulo, segundos) {
    const resumo = segundos != null ? _duracao(segundos) : 'Categoria desligada, ou sem captura ainda';
    const corpo = segundos != null
      ? `<p class="pb-msg">${_duracao(segundos)} somados de todos os ciclos capturados até agora. É um total
          acumulado, não uma lista de sessões individuais.</p>`
      : '<p class="pb-msg">Nada capturado para esta categoria.</p>';
    return _painel(id, titulo, resumo, corpo);
  }

  // ── Dado de projeto que não existe mais ─────────────────────────────────

  function _desenharOrfas(raiz, container) {
    const alvo = raiz.querySelector('.pb-orfas');
    if (!listaOrfas.length) { alvo.innerHTML = ''; return; }
    alvo.innerHTML = `
      <div class="pb-orfas-caixa">
        <p class="pb-orfas-titulo">Dados de projetos que não existem mais</p>
        <p class="pb-msg">Projeto renomeado o plugin readota sozinho no ciclo seguinte, pelas pastas
          do projeto (raiz e pastas de trabalho iguais). O que fica aqui é o que não bateu: projeto
          removido, ou raiz movida junto com o nome. O histórico continua — remova se não quiser mais.</p>
        <div class="pb-orfas-lista">
          ${listaOrfas.map(nome => `
            <span class="pb-orfa">
              ${_escapar(nome)}
              <button type="button" class="pb-btn-remover-orfa" data-orfa="${_escapar(nome)}">Remover</button>
            </span>`).join('')}
        </div>
      </div>`;
    alvo.querySelectorAll('.pb-btn-remover-orfa').forEach(btn => {
      btn.addEventListener('click', () => _confirmarRemocao(raiz, btn.dataset.orfa, container));
    });
  }

  // ── Remover dados ────────────────────────────────────────────────────────

  async function _confirmarRemocao(raiz, projetoAlvo, container) {
    const projeto = projetoAlvo || projetoSelecionado;
    if (!projeto) return;
    const raizContainer = container || raiz.parentElement;
    const executar = async () => {
      const resp = await _chamar('deletar', { projeto });
      if (resp.success) {
        listaProjetos = listaProjetos.filter(p => p !== projeto);
        listaOrfas = listaOrfas.filter(p => p !== projeto);
        if (projetoSelecionado === projeto) {
          projetoSelecionado = listaProjetos.length ? listaProjetos[0] : null;
          arquivosCarregados = null;
          diaAberto = null;
        }
      }
      return resp;
    };
    if (typeof abrirModalPadrao !== 'function') {
      if (!confirm(`Remover os dados capturados de "${projeto}"? Não dá pra desfazer.`)) return;
      const resp = await executar();
      if (resp.success) { _avisar('Dados removidos.'); _desenhar(raizContainer, null); }
      else _avisar(resp.error || 'Não foi possível remover.', true);
      return;
    }
    abrirModalPadrao({
      title: 'Remover dados capturados',
      bodyHtml: `<p class="modal-body-text">Isto remove todo o dado capturado de <strong>${_escapar(projeto)}</strong>
        — o retrato atual, a lista de arquivos e o histórico de mudanças de todos os dias. Não dá pra desfazer.</p>`,
      confirmLabel: 'Remover dados',
      onConfirm: async (_overlay, showErr) => {
        const resp = await executar();
        if (!resp.success) { showErr(resp.error || 'Não foi possível remover.'); return false; }
        _avisar('Dados removidos.');
        _desenhar(raizContainer, null);
      },
    });
  }

  // ── Capturar agora ───────────────────────────────────────────────────────

  async function _capturarAgora(container, raiz) {
    const btn = raiz.querySelector('.pb-btn-capturar');
    btn.disabled = true;
    btn.textContent = 'Capturando…';
    try {
      const resp = await _chamar('capturar_agora', {});
      if (!resp.success) {
        _avisar(resp.error || 'Não foi possível capturar agora.', true);
        return;
      }
      const falhas = resp.falhas || [];
      _avisar(falhas.length
        ? `Capturado, mas ${falhas.length} projeto(s) falharam: ${falhas.join(', ')}`
        : `Captura concluída em ${resp.quantos} projeto(s).`, falhas.length > 0);
      arquivosCarregados = null;
      eventosDoDiaAberto = null;
      await _carregarLista(container);
    } finally {
      // ⚠️ `finally`: sem ele, qualquer falha no meio deixava o botão preso em
      // "Capturando…" para sempre, e o usuário só saía disso trocando de aba.
      // O botão pode já ter sido substituído pelo redesenho — daí o re-query.
      const atualBtn = container.querySelector('.pb-btn-capturar');
      if (atualBtn) { atualBtn.disabled = false; atualBtn.textContent = '⟳ Capturar agora'; }
    }
  }

  // ── Painel de configuração ─────────────────────────────────────────────

  const CATEGORIAS = [
    ['arquivos_e_linhas', 'Contagem de arquivos e linhas'],
    ['lista_de_arquivos', 'Lista de arquivos'],
    ['mudancas_por_dia', 'Mudanças por dia'],
    ['tempo_rotinas', 'Tempo em rotinas (Automação)'],
    ['tempo_fila', 'Tempo na fila (Assistente)'],
    ['tempo_chat', 'Tempo no chat (aproximado)'],
  ];

  function _alternarConfig(raiz) {
    const painel = raiz.querySelector('.pb-painel-config');
    configVisivel = painel.classList.contains('pb-escondido');
    painel.classList.toggle('pb-escondido', !configVisivel);
    if (configVisivel) _montarConfig(raiz);
  }

  function _montarConfig(raiz) {
    const painel = raiz.querySelector('.pb-painel-config');
    painel.innerHTML = _htmlConfig();
    painel.querySelector('.pb-btn-salvar-config').addEventListener('click', () => _salvarConfig(painel));
  }

  function _htmlConfig() {
    const categorias = config.categorias || {};
    // ⚠️ O `value` de um <input type="number"> precisa do número CRU. A versão
    // 1 passava por `toLocaleString('pt-BR')`, então um intervalo de 1500
    // virava "1.500", que o campo recusa e renderiza vazio — e o Salvar
    // seguinte mandava NaN. `?? 15` em vez de `|| 15` porque 0 é um valor que
    // o backend precisa ver para poder recusar com uma mensagem.
    const intervalo = (config.intervalo_minutos != null) ? config.intervalo_minutos : 15;
    return `
      <p class="pb-config-nota-topo">A varredura roda sempre — é o que permite saber o que mudou de um dia
        para o outro. As opções abaixo decidem o que fica guardado e o que esta tela mostra.</p>
      <div class="pb-config-grade">
        ${CATEGORIAS.map(([chave, rotulo]) => `
          <label class="pb-config-check">
            <input type="checkbox" data-categoria="${chave}" ${categorias[chave] ? 'checked' : ''}>
            ${_escapar(rotulo)}
          </label>`).join('')}
      </div>
      <label class="pb-config-intervalo">
        Capturar a cada
        <input type="number" min="1" class="pb-input-intervalo" value="${intervalo}">
        minutos
      </label>
      <div class="pb-config-nota"></div>
      <button type="button" class="pb-btn-salvar-config btn btn-positive btn-sm">Salvar configuração</button>`;
  }

  async function _salvarConfig(painel) {
    const categorias = {};
    painel.querySelectorAll('[data-categoria]').forEach(el => { categorias[el.dataset.categoria] = el.checked; });
    const bruto = painel.querySelector('.pb-input-intervalo').value;
    const nota = painel.querySelector('.pb-config-nota');
    if (String(bruto).trim() === '') {
      nota.textContent = 'Informe o intervalo em minutos.';
      nota.classList.add('pb-config-erro');
      return;
    }
    const resp = await _chamar('salvar_config', {
      config: { intervalo_minutos: Number(bruto), categorias },
    });
    if (!resp.success) {
      nota.textContent = resp.error || 'Não foi possível salvar.';
      nota.classList.add('pb-config-erro');
      return;
    }
    config = resp.config;
    nota.classList.remove('pb-config-erro');
    nota.textContent = 'Salvo — vale a partir do próximo ciclo de captura.';
  }

  // ── Utilidades ────────────────────────────────────────────────────────────

  function _numero(n) {
    return (n == null) ? '—' : Number(n).toLocaleString('pt-BR');
  }

  function _dataLegivel(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('pt-BR'); } catch (e) { return String(iso); }
  }

  function _duracao(segundos) {
    const s = Math.max(0, Math.round(segundos || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h) return `${h}h${String(m).padStart(2, '0')}`;
    if (m) return `${m}min`;
    return `${s}s`;
  }

  function _escapar(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function _injetarEstilo() {
    if (document.getElementById('pb-estilo')) return;
    const style = document.createElement('style');
    style.id = 'pb-estilo';
    style.textContent = `
      .pb-raiz { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
      .pb-topo { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      .pb-titulo { font-size: 15px; font-weight: 600; color: var(--text); margin: 0; }
      .pb-acoes { display: flex; gap: 8px; }
      .pb-escondido { display: none !important; }
      .pb-msg { color: var(--text-muted); font-size: 13px; }
      .pb-fraco { color: var(--text-muted); opacity: 0.7; font-size: 11px; }

      .pb-painel-config {
        background: var(--surface-dark); border: 1px solid rgba(var(--white-rgb),0.1);
        border-radius: var(--radius); padding: 14px 16px; display: flex; flex-direction: column; gap: 12px;
      }
      .pb-config-nota-topo { margin: 0; font-size: 11.5px; color: var(--text-muted); line-height: 1.5; }
      .pb-config-grade { display: grid; grid-template-columns: repeat(2, minmax(200px, 1fr)); gap: 8px 18px; }
      .pb-config-check { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-muted); cursor: pointer; }
      .pb-config-check input { accent-color: var(--teal); }
      .pb-config-intervalo { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-muted); }
      .pb-input-intervalo {
        width: 64px; background: var(--surface); border: 1px solid rgba(var(--white-rgb),0.1);
        border-radius: var(--radius); color: var(--text); padding: 4px 8px; font-size: 12.5px;
      }
      .pb-config-nota { font-size: 11.5px; color: var(--text-muted); min-height: 14px; }
      .pb-config-nota.pb-config-erro { color: var(--red); }

      /* Toggle segmentado — mesmo desenho de .mapa-toggle/.anicod-toggle: é o
         mesmo projeto em dois FORMATOS (gráfico × dado cru), não navegação
         entre telas diferentes. Ver Padrões de interface › Componentes ›
         Toggle segmentado. */
      .pb-abas, .pb-toggle { display: flex; gap: 2px; }
      .pb-aba-btn, .pb-toggle-btn {
        background: transparent; border: 1px solid rgba(var(--white-rgb),0.08); color: var(--text-muted);
        font-size: 12.5px; font-weight: 500; padding: 6px 14px; border-radius: 20px; cursor: pointer;
        font-family: inherit;
      }
      .pb-toggle-btn { padding: 3px 12px; font-size: 11.5px; }
      .pb-aba-btn.active, .pb-toggle-btn.active {
        color: var(--teal); border-color: rgba(var(--teal-rgb),0.4); background: rgba(var(--teal-rgb),0.1);
      }

      .pb-selecao { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
      .pb-selecao-combo { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-muted); }
      .pb-selecao-combo select {
        background: var(--surface-dark); border: 1px solid rgba(var(--white-rgb),0.1);
        border-radius: var(--radius); color: var(--text); padding: 6px 10px; font-size: 13px;
      }

      /* ── Aba Gráficos ── */
      .pb-relatorio { display: flex; flex-direction: column; gap: 18px; }
      .pb-relatorio-stats { display: flex; gap: 16px; font-size: 13px; color: var(--text-muted); flex-wrap: wrap; }
      .pb-relatorio-secao h4 { margin: 0; font-size: 12.5px; font-weight: 600; color: var(--text); }
      .pb-secao-cab { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; flex-wrap: wrap; }
      .pb-relatorio-legenda { margin: 6px 0 0; font-size: 10.5px; color: var(--text-muted); opacity: 0.75; line-height: 1.5; }

      /* Conteúdo largo rola na PRÓPRIA caixa, nunca na tela inteira. */
      .pb-grafico-rolagem { overflow-x: auto; padding-bottom: 2px; }
      .pb-svg { display: block; }
      .pb-linha { fill: none; stroke: var(--teal); stroke-width: 1.8; stroke-linejoin: round; stroke-linecap: round; }
      .pb-ponto { fill: var(--teal); }
      .pb-base { stroke: rgba(var(--white-rgb),0.18); stroke-width: 1; }
      .pb-ganhas { fill: var(--green); }
      .pb-perdidas { fill: var(--red); }
      .pb-sem-captura { fill: rgba(var(--white-rgb),0.16); }
      .pb-cor-ganhas { color: var(--green); }
      .pb-cor-perdidas { color: var(--red); }
      .pb-eixo {
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
        font-size: 10.5px; color: var(--text-muted); margin-top: 4px; flex-wrap: wrap;
      }
      .pb-eixo-escala { opacity: 0.8; }

      .pb-tira { display: flex; gap: 3px; flex-wrap: wrap; }
      .pb-dia-quad { width: 14px; height: 14px; border-radius: 3px; background: var(--teal); }
      .pb-dia-vazio {
        background: transparent; border: 1px dashed rgba(var(--white-rgb),0.22); opacity: 1;
      }

      .pb-tempo-linha { display: grid; grid-template-columns: 170px 1fr 60px; align-items: center; gap: 10px; font-size: 12px; margin-bottom: 6px; }
      .pb-tempo-rotulo { color: var(--text-muted); }
      .pb-tempo-trilho { height: 8px; border-radius: 4px; background: rgba(var(--white-rgb),0.08); overflow: hidden; }
      .pb-tempo-preenchido { height: 100%; background: var(--purple); border-radius: 4px; }
      .pb-tempo-valor { text-align: right; color: var(--text); font-variant-numeric: tabular-nums; }

      /* ── Aba Dados: painéis retráteis, um por categoria ── */
      .pb-paineis { display: flex; flex-direction: column; gap: 8px; }
      .pb-painel-retratil { background: var(--surface-dark); border: 1px solid rgba(var(--white-rgb),0.08); border-radius: var(--radius); overflow: hidden; }
      .pb-painel-cab {
        width: 100%; display: flex; align-items: center; gap: 10px; background: transparent; border: none;
        padding: 10px 14px; cursor: pointer; text-align: left; font-family: inherit;
      }
      .pb-painel-seta { color: var(--text-muted); font-size: 10px; transition: transform 160ms ease; flex-shrink: 0; }
      .pb-painel-aberto .pb-painel-seta { transform: rotate(90deg); }
      .pb-painel-titulo { font-size: 13px; font-weight: 600; color: var(--text); flex-shrink: 0; }
      .pb-painel-resumo { font-size: 11.5px; color: var(--text-muted); margin-left: auto; }
      .pb-painel-corpo { display: none; padding: 0 14px 14px; }
      .pb-painel-aberto .pb-painel-corpo { display: block; }

      /* O overflow fica na tabela, nunca na tela inteira — mesma regra do
         Modal de escolha destrutiva (Padrões de interface). */
      .pb-tabela-scroll { max-height: 46vh; overflow: auto; border: 1px solid rgba(var(--white-rgb),0.08); border-radius: var(--radius); }
      .pb-tabela { width: 100%; border-collapse: collapse; font-size: 12px; }
      .pb-tabela th {
        position: sticky; top: 0; background: var(--surface-dark); text-align: left; padding: 8px 10px;
        color: var(--text-muted); font-weight: 600; border-bottom: 1px solid rgba(var(--white-rgb),0.1);
        white-space: nowrap;
      }
      .pb-tabela td { padding: 6px 10px; border-bottom: 1px solid rgba(var(--white-rgb),0.04); color: var(--text); }
      .pb-td-caminho { font-family: 'Cascadia Code','Consolas',monospace; font-size: 11.5px; word-break: break-all; }
      .pb-clicavel { cursor: pointer; }
      .pb-clicavel:hover { background: var(--surface-hover); }
      .pb-seta-dia { color: var(--text-muted); font-size: 9px; display: inline-block; transition: transform 160ms ease; }
      .pb-dia-aberto .pb-seta-dia { transform: rotate(90deg); }
      .pb-detalhe td { background: var(--surface); }
      .pb-eventos { list-style: none; margin: 0; padding: 4px 0; display: flex; flex-direction: column; gap: 4px; }
      .pb-eventos li { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 11.5px; }
      .pb-tag {
        font-size: 10px; padding: 1px 7px; border-radius: 10px; flex-shrink: 0;
        background: rgba(var(--white-rgb),0.08); color: var(--text-muted);
      }
      .pb-tag-criado { background: rgba(var(--green-rgb),0.16); color: var(--green); }
      .pb-tag-apagado { background: rgba(var(--red-rgb),0.16); color: var(--red); }
      .pb-tag-editado { background: rgba(var(--teal-rgb),0.16); color: var(--teal); }
      .pb-tag-movido { background: rgba(var(--purple-rgb),0.16); color: var(--purple); }

      /* ── Órfãs ── */
      .pb-orfas-caixa {
        background: var(--surface-dark); border: 1px solid rgba(var(--white-rgb),0.1);
        border-radius: var(--radius); padding: 12px 16px; display: flex; flex-direction: column; gap: 8px;
      }
      .pb-orfas-titulo { margin: 0; font-size: 12.5px; font-weight: 600; color: var(--text); }
      .pb-orfas-lista { display: flex; gap: 8px; flex-wrap: wrap; }
      .pb-orfa {
        display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text);
        background: var(--surface); border: 1px solid rgba(var(--white-rgb),0.1);
        border-radius: var(--radius); padding: 4px 6px 4px 10px;
      }
      .pb-btn-remover-orfa {
        background: transparent; border: 1px solid rgba(var(--red-rgb),0.4); color: var(--red);
        font-size: 10.5px; padding: 2px 8px; border-radius: var(--radius); cursor: pointer; font-family: inherit;
      }
      .pb-btn-remover-orfa:hover { background: rgba(var(--red-rgb),0.12); }
    `;
    document.head.appendChild(style);
  }
})();
