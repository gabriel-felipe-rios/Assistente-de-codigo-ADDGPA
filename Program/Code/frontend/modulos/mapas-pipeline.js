// ══════════════════════════════════ MAPA: Pipeline › Leituras ══
// A casca: estado, carga, cabeçalho, avisos e os controles da barra. Cada
// leitura mora no seu próprio arquivo (`-raias.js`, `-sequencia.js`,
// `-listas.js`, `-markdown.js`); as peças que as seis dividem estão em
// `-pecas.js`; a classificação de camada e o agrupamento, em `-dados.js`; e a
// trilha lateral, em `-trilha.js`.
//
// Seis leituras do MESMO `pipeline.md`, todas montadas pelo programa em HTML.
// Esta tela NÃO chama o modelo em nenhum controle: ela lê o arquivo do disco e
// desenha. Ela nunca teve agente próprio — o ⟳ Gerar daqui era um segundo
// gatilho para o agente Pipeline, que já tem o card dele em Automação › Rotinas.
// Dois botões para a mesma coisa, e o daqui ficava na barra de uma tela que o
// resto é só leitura. Saiu; o de Automação é o único caminho.
//
// O que ficou é a ESCUTA: `vpOnPipelineProgress` continua ligada, para que
// rodar o agente lá em Automação com esta tela aberta atualize o desenho
// sozinho quando terminar.
//
// Antes desta obra a tela pedia ao modelo um diagrama Mermaid do arquivo que
// já estava pronto, e o Mermaid vinha de CDN: o programa precisava de internet
// para abrir. As duas coisas saíram.

let _vpInited = false;
let _vpDados = null;          // resultado de get_visualizar_pipeline_result
let _vpLeitura = 'raias';
let _vpCadeia = 1;            // 0 = todas (só nas leituras que sabem desenhar todas)
let _vpFase = 0;              // 0 = a cadeia inteira; >0 = recorte de fase
let _vpAgrupar = true;
let _vpFiltro = '';
let _vpZoom = 1;
const _vpExpandidas = new Set();   // cadeias com o "+N arquivos" aberto

// Raias, Trilho e Sequência desenham UMA cadeia; Cadeias e Fases sabem
// desenhar todas de uma vez e usam a trilha como filtro.
const VP_LEITURAS_UMA = new Set(['raias', 'trilho', 'sequencia']);
const VP_LEITURAS_TODAS = new Set(['cadeias', 'fases']);
// Zoom só onde fica grande de verdade. Trilho é uma lista — quem lê lista,
// rola; controle de zoom numa tela que já cabe é botão morto.
const VP_COM_ZOOM = new Set(['raias', 'sequencia', 'cadeias', 'fases']);

// Chamado por `_abrirMapa` (mapas.js) toda vez que o mapa Pipeline fica à
// vista — inclusive ao voltar de outra aba de projeto. Era
// `initVisualizarPipelineTab`, chamado pelo Assistente.
function renderPipeline() {
  if (!_vpInited) {
    _vpInited = true;
    document.getElementById('btn-vp-recarregar').addEventListener('click', () => vpCarregar(true));
    document.getElementById('btn-vp-avisos').addEventListener('click', () =>
      document.getElementById('vp-avisos').classList.toggle('hidden'));
    document.getElementById('btn-vp-ajuda').addEventListener('click', vpAbrirAjuda);
    document.getElementById('btn-vp-ajuda-fechar').addEventListener('click', vpFecharAjuda);
    document.getElementById('modal-vp-ajuda').addEventListener('click', evento => {
      if (evento.target.id === 'modal-vp-ajuda') vpFecharAjuda();
    });
    document.getElementById('btn-vp-copiar').addEventListener('click', vpCopiarMarkdown);
    document.getElementById('vp-busca').addEventListener('input', function () {
      _vpFiltro = this.value; vpAplicarFiltro();
    });
    document.getElementById('vp-agrupar').addEventListener('click', vpAlternarAgrupamento);

    // O mesmo helper que os Mapas usam. Antes esta tela reimplementava o laço
    // à mão, e as duas cópias já tinham divergido no tratamento de `disabled`.
    _wireToggle('vp-leitura-toggle', 'leitura', leitura => {
      _vpLeitura = leitura;
      // "Todas" só faz sentido nas duas leituras que sabem desenhar todas;
      // ao sair delas, cai na primeira cadeia em vez de ficar sem nenhuma.
      if (VP_LEITURAS_TODAS.has(leitura)) _vpCadeia = 0;
      else if (!_vpCadeia) _vpCadeia = 1;
      vpDesenhar();
    });

    vpLigarTrilha();
    vpLigarPalco();
    vpInitZoom();
    vpLigarSubabas();
  }
  vpCarregar(false);
  // Voltou à vista com o Mapa em níveis na frente (outra aba, outro
  // projeto): ele confere o projeto e relê se precisar.
  if (document.getElementById('vp-sub-niveis').classList.contains('active')) mnAbrir();
}

// Leituras · Mapa em níveis. O mapa só monta na primeira vez que é aberto: ele
// mede texto e enquadra pela largura do palco, e escondido o palco não tem
// largura nenhuma.
function vpLigarSubabas() {
  const botoes = document.querySelectorAll('#vp-subabas [data-vpsub]');
  botoes.forEach(b => b.addEventListener('click', () => {
    botoes.forEach(x => {
      x.classList.toggle('active', x === b);
      document.getElementById(x.dataset.vpsub).classList.toggle('active', x === b);
    });
    if (b.dataset.vpsub === 'vp-sub-niveis') mnAbrir();
  }));
}

// ── Dados ────────────────────────────────────────────────────────────────────

async function vpCarregar(avisar) {
  const status = await window.pywebview.api.get_visualizar_pipeline_status(currentProject);

  if (!status.pipeline_exists) {
    _vpDados = null;
    // O texto tem de dizer PARA ONDE ir: sem botão nesta tela, "gere o pipeline"
    // sozinho deixaria o usuário procurando um controle que não existe aqui.
    document.getElementById('vp-titulo').textContent =
      'Nenhum pipeline.md ainda. Rode o agente Pipeline em Automação › Rotinas.';
    document.getElementById('vp-titulo-sub').textContent = '';
    document.getElementById('vp-metricas').innerHTML = '';
    document.getElementById('vp-trilha').innerHTML = '';
    document.getElementById('vp-area').innerHTML = '';
    vpAvisos([]);
    return;
  }

  const r = await window.pywebview.api.get_visualizar_pipeline_result(currentProject);
  if (!r.success) { document.getElementById('vp-titulo').textContent = r.error; return; }
  _vpDados = r;
  if (!_vpDados.cadeias.some(c => c.n === _vpCadeia)) _vpCadeia = VP_LEITURAS_TODAS.has(_vpLeitura) ? 0 : 1;
  vpCabecalho();
  vpMontarMarkdown();
  vpAvisos(r.avisos || []);
  vpDesenhar();
  if (avisar) vpStatus('Recarregado do disco — nenhuma chamada ao modelo.');
}

// Chamado por pipelineAgentProgress (modulos/agentes/indexacao/pipeline.js): o
// agente é um só, e as duas telas que o mostram ouvem o mesmo progresso. Aqui
// isso virou escuta pura — o disparo mora só no card de Automação › Rotinas —,
// e é o que faz esta tela se redesenhar sozinha quando o agente termina lá.
function vpOnPipelineProgress(data) {
  if (data.status === 'running') { if (data.etapa) vpStatus(data.etapa); return; }
  if (data.status !== 'done' && data.status !== 'error') return;
  vpStatus(data.status === 'done'
    ? `Pipeline gerado — ${data.passos} passos em ${data.cadeias} cadeias.`
    : 'Erro: ' + data.error);
  if (data.status === 'done') { vpCarregar(false); mnRecarregarSeAberto(); }
}

function vpStatus(texto) {
  const el = document.getElementById('vp-status');
  if (el) el.textContent = texto;
}

// ── Cabeçalho e avisos ─────────────────────────────────────────────

function vpCabecalho() {
  const m = vpMetricas(_vpDados.cadeias || []);
  // Do `cabecalho` que o backend manda ("199 passos · 9 cadeias · gerado em
  // …") só se aproveita a data: os outros números estão na faixa, e um deles
  // — ligações — o arquivo não traz.
  const quando = (_vpDados.cabecalho || '').split('gerado em')[1];
  document.getElementById('vp-titulo').innerHTML =
    `Pipeline de <b>${escapeHtml(currentProject)}</b>`;
  document.getElementById('vp-titulo-sub').innerHTML =
    (quando ? 'gerado em' + escapeHtml(quando) + ' · ' : '') +
    '<span class="vp-sem-modelo">lido do disco, sem chamada ao modelo</span>';
  document.getElementById('vp-metricas').innerHTML = `
    <div class="vp-metrica vp-m-cadeias" title="Fluxos independentes: nenhum passo de uma cadeia entra em outra"><b>${m.cadeias}</b><span>cadeias</span></div>
    <div class="vp-metrica vp-m-passos" title="Cada chamada individual encontrada no código"><b>${m.passos}</b><span>passos</span></div>
    <div class="vp-metrica vp-m-ligacoes" title="Pares origem→destino distintos, depois de agrupar os repetidos"><b>${m.ligacoes}</b><span>ligações</span></div>
    <div class="vp-metrica vp-m-travessias" title="Passos em que o fluxo muda de camada (ex.: Frontend JS → Backend Python)"><b>${m.travessias}</b><span>travessias</span></div>
    <div class="vp-metrica vp-m-fases" title="Profundidade do fluxo: a fase 1 é o que dispara, a última é o que fecha"><b>${m.fases}</b><span>fases</span></div>`;
}

// O que o agente cortou fica atrás de um botão. Junto vai a conta do próprio
// agrupamento: sem ela, quem vê "×4" não tem como saber quantos passos a tela
// deixou de mostrar nem como trazê-los de volta.
function vpAvisos(lista) {
  const painel = document.getElementById('vp-avisos');
  const botao = document.getElementById('btn-vp-avisos');
  if (!painel || !botao) return;
  const m = _vpDados ? vpMetricas(_vpDados.cadeias || []) : { passos: 0, ligacoes: 0 };
  const juntados = m.passos - m.ligacoes;
  const todos = [...lista];
  if (_vpAgrupar && juntados > 0) {
    todos.unshift(`${juntados} passos repetiam o par origem→destino de um passo já listado: `
      + `as ${m.passos} chamadas viram ${m.ligacoes} ligações. `
      + `Desligue "Agrupar repetidos" para ver um a um.`);
  }
  botao.style.display = todos.length ? '' : 'none';
  botao.textContent = `⚠ Avisos (${todos.length})`;
  painel.classList.add('hidden');
  painel.innerHTML = todos.map(a =>
    `<div class="vp-aviso-item"><b>⚠️</b><span>${escapeHtml(a)}</span></div>`).join('');
}


// ── Desenho ──────────────────────────────────────────────────────────────────

function vpDesenhar() {
  const area = document.getElementById('vp-area');
  if (!area || !_vpDados) return;

  const soMarkdown = _vpLeitura === 'markdown';
  document.getElementById('vp-md').classList.toggle('hidden', !soMarkdown);
  document.getElementById('vp-palco').classList.toggle('hidden', soMarkdown);
  document.getElementById('vp-zoom').style.visibility = VP_COM_ZOOM.has(_vpLeitura) ? '' : 'hidden';
  if (soMarkdown) return;

  const cadeias = _vpDados.cadeias || [];
  if (!cadeias.length) {
    document.getElementById('vp-trilha').innerHTML = '';
    area.innerHTML = '<p class="vp-vazio">O pipeline.md não tem nenhuma cadeia.</p>';
    return;
  }

  if (VP_LEITURAS_UMA.has(_vpLeitura) && !_vpCadeia) _vpCadeia = cadeias[0].n;
  vpDesenharTrilha();

  if (VP_LEITURAS_TODAS.has(_vpLeitura)) {
    const emCena = _vpCadeia ? cadeias.filter(c => c.n === _vpCadeia) : cadeias;
    const focos = emCena.map(c => vpMontarFoco(c, c.passos));
    area.className = _vpCadeia ? 'vp-cadeia-' + ((_vpCadeia - 1) % 9) : '';
    area.innerHTML = _vpLeitura === 'cadeias' ? vpCadeias(focos) : vpFases(focos);
  } else {
    const cadeia = vpCadeiaSelecionada();
    const foco = vpMontarFoco(cadeia, vpPassosEmFoco(cadeia));
    area.className = 'vp-cadeia-' + ((cadeia.n - 1) % 9);
    area.innerHTML = vpTituloDoDesenho(foco) + (
      _vpLeitura === 'raias' ? `<div class="vp-raias">${vpRaias(foco)}</div>`
      : _vpLeitura === 'trilho' ? vpTrilho(foco)
      : vpSequencia(foco));
  }

  vpAplicarZoom();
  vpAplicarFiltro();
}

// Um listener só no palco, com delegação: o conteúdo é remontado a cada
// desenho, e ligar botão por botão empilharia listeners a cada troca.
function vpLigarPalco() {
  document.getElementById('vp-area').addEventListener('click', evento => {
    const mais = evento.target.closest('[data-expandir]');
    if (mais) {
      const n = Number(mais.dataset.expandir);
      if (_vpExpandidas.has(n)) _vpExpandidas.delete(n); else _vpExpandidas.add(n);
      vpDesenhar();
      return;
    }
    // A legenda da leitura Fases é filtro: clicar isola a cadeia, clicar de
    // novo volta para todas.
    const legenda = evento.target.closest('[data-legenda]');
    if (legenda) {
      const n = Number(legenda.dataset.legenda);
      _vpCadeia = (_vpCadeia === n) ? 0 : n;
      vpDesenhar();
    }
  });
}

function vpAlternarAgrupamento() {
  _vpAgrupar = !_vpAgrupar;
  const pilula = document.getElementById('vp-agrupar');
  pilula.querySelector('.toggle-track').classList.toggle('on', _vpAgrupar);
  pilula.querySelector('.toggle-label').classList.toggle('on', _vpAgrupar);
  if (_vpDados) vpAvisos(_vpDados.avisos || []);
  vpDesenhar();
}

// Acende o que casa e apaga o resto, em vez de esconder: escondendo o nó, as
// setas que chegam nele apontariam para o vazio e o desenho mudaria de forma.
function vpAplicarFiltro() {
  const alvo = _vpFiltro.trim().toLowerCase();
  document.querySelectorAll('#vp-area [data-arquivo]').forEach(el => {
    el.classList.remove('vp-apagado', 'vp-aceso');
    if (!alvo) return;
    const casa = el.getAttribute('data-arquivo').toLowerCase().includes(alvo);
    el.classList.add(casa ? 'vp-aceso' : 'vp-apagado');
  });
}

// ── Zoom ─────────────────────────────────────────────────────────────────────
// Escala o conteúdo a partir do canto superior esquerdo, dentro de um viewport
// que rola. Sem pan: as leituras são listas e desenhos que se leem rolando, e
// arrastar competindo com a rolagem pela mesma superfície é o que impedia o
// scroll antes. `transform: scale`, nunca `style.zoom` — o `zoom` do CSS refaz
// o layout e rearredonda cada caixa (ver mapas.js).

function vpInitZoom() {
  document.getElementById('btn-vp-zoom-menos').addEventListener('click', () => vpZoomPasso(-1));
  document.getElementById('btn-vp-zoom-mais').addEventListener('click', () => vpZoomPasso(1));
  document.getElementById('vp-viewport').addEventListener('wheel', evento => {
    // Roda sozinha rola a lista; com Ctrl, amplia — e só onde há zoom.
    if (!evento.ctrlKey || !VP_COM_ZOOM.has(_vpLeitura)) return;
    evento.preventDefault();
    vpZoomPasso(evento.deltaY < 0 ? 1 : -1);
  }, { passive: false });
}

function vpZoomPasso(direcao) {
  _vpZoom = Math.min(2, Math.max(0.4, +(_vpZoom + direcao * 0.1).toFixed(2)));
  vpAplicarZoom();
}

function vpAplicarZoom() {
  const area = document.getElementById('vp-area');
  if (!area) return;
  const escala = VP_COM_ZOOM.has(_vpLeitura) ? _vpZoom : 1;
  area.style.transform = escala === 1 ? '' : `scale(${escala})`;
  // Sem isto o conteúdo escalado ultrapassa a largura e o viewport não sabe
  // que precisa rolar mais: a caixa do elemento não cresce com o transform.
  area.style.width = escala === 1 ? '' : `${100 / escala}%`;
  const valor = document.getElementById('vp-zoom-val');
  if (valor) valor.textContent = Math.round(_vpZoom * 100) + '%';
}
