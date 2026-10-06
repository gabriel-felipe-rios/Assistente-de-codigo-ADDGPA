// ═══ TRABALHOS → sub-aba Quadro ════════════════════════════════════════════
//
// Seis colunas fixas, cartões agrupados por pasta dentro de cada uma, e o
// arraste que move um cartão de coluna.
//
// ⚠️ O ARRASTE É `mousedown`/`mousemove`/`mouseup`, e NÃO a API HTML5 de drag.
// Não é preferência de estilo: a API HTML5 não funciona no WebView2, que é o
// motor desta janela. O molde é `tab-order.js` — limiar de 4 px antes de
// considerar arraste, listeners no `document` (e não no elemento, que some do
// fluxo), e mexer no DOM só quando o alvo muda de verdade.
//
// ⚠️ AS COLUNAS E AS TAGS NÃO SÃO DECLARADAS AQUI. Vêm do backend, que as lê
// de `catalogo_trabalhos.py` — a mesma lista que o system prompt do agente
// anuncia e que as ferramentas de MCP validam. Uma cópia neste arquivo seria a
// segunda, e a segunda é a que ninguém relê quando a primeira muda.

let trAtividades = [];
let trColunas = [];
let trFiltro = null;          // {tipo, valor} — o filtro da barra lateral
let trArrastando = null;
let trAtividadeAberta = null; // o cartão com o briefing expandido
let trEditandoId = null;      // o cartão que o modal está editando (null = criando)

const TRABALHOS_LIMIAR_ARRASTE = 4;

// ── Carregar ────────────────────────────────────────────────────────────────

async function trCarregarQuadro() {
  const painel = document.getElementById('trsub-quadro');
  if (!painel || !currentProject) return;
  if (!painel.dataset.montado) {
    painel.dataset.montado = '1';
    painel.innerHTML = trMarcacao();
    trLigarEventos();
  }
  try {
    // As colunas vêm junto da configuração, que é quem carrega o catálogo.
    if (!trColunas.length) {
      const c = await window.pywebview.api.carregar_config_dos_trabalhos(currentProject);
      if (c.success) trColunas = c.catalogo.colunas;
    }
    const r = await window.pywebview.api.carregar_trabalhos(currentProject);
    if (!r.success) { showToast(r.error, true); return; }
    trAtividades = r.atividades || [];
    trPintarQuadro();
    trPintarLateral();
  } catch (e) {
    showToast(String(e), true);
  }
}

function trMarcacao() {
  return `
    <div class="tr-layout">
      <aside class="tr-lado">
        <div class="tr-lado-topo">
          <button class="btn btn-positive btn-sm btn-full" id="tr-btn-nova">＋ Nova atividade</button>
        </div>
        <div class="tr-lado-lista" id="tr-lado-lista"></div>
        <div class="tr-lado-pe" id="tr-lado-pe"></div>
      </aside>

      <div class="tr-principal">
        <div class="tr-cabecalho">
          <div>
            <h2>Quadro</h2>
            <div class="tr-sub" id="tr-sub">—</div>
          </div>
          <button class="btn btn-muted btn-sm" id="tr-btn-pasta">Abrir a pasta</button>
        </div>
        <div id="tr-encaixe" class="xt-ponto"></div>
        <div class="tr-board" id="tr-board"></div>
      </div>
    </div>

    <div class="tr-modal hidden" id="tr-modal">
      <div class="tr-modal-caixa">
        <div class="tr-modal-h" id="tr-modal-h">Nova atividade</div>
        <label class="tr-campo">Nome
          <input type="text" id="tr-f-titulo" placeholder="o que precisa ser feito">
        </label>
        <label class="tr-campo">Pasta <span class="tr-dica">agrupa o cartão dentro da coluna</span>
          <input type="text" id="tr-f-pasta" placeholder="ex. backend">
        </label>
        <label class="tr-campo">Resumo curto <span class="tr-dica">sempre visível no cartão</span>
          <input type="text" id="tr-f-resumo" placeholder="uma linha">
        </label>
        <label class="tr-campo">Briefing <span class="tr-dica">opcional — aparece só sob demanda</span>
          <textarea id="tr-f-briefing" rows="7" placeholder="o detalhamento completo"></textarea>
        </label>
        <div class="tr-modal-pe">
          <button class="btn btn-muted btn-sm" id="tr-btn-cancelar">Cancelar</button>
          <button class="btn btn-positive btn-sm" id="tr-btn-salvar">Salvar</button>
        </div>
      </div>
    </div>`;
}

// ── Desenho ─────────────────────────────────────────────────────────────────

function trVisiveis() {
  if (!trFiltro) return trAtividades;
  const { tipo, valor } = trFiltro;
  return trAtividades.filter(a => {
    if (tipo === 'pasta') return (a.pasta || '(sem pasta)') === valor;
    if (tipo === 'autoria') return a.autoria === valor;
    if (tipo === 'tag') return (a.tags || []).includes(valor);
    return true;
  });
}

function trPintarQuadro() {
  const board = document.getElementById('tr-board');
  const sub = document.getElementById('tr-sub');
  if (!board) return;
  const visiveis = trVisiveis();
  if (sub) {
    sub.innerHTML = `${trAtividades.length} atividade(s) · gravado em `
      + `<span class="tr-mono">Trabalhos/</span> na pasta do projeto`;
  }
  board.innerHTML = trColunas.map(col => {
    const desta = visiveis.filter(a => a.coluna === col.id);
    return `
      <div class="tr-col" data-coluna="${col.id}">
        <div class="tr-col-h">
          <span class="tr-col-t"><i class="tr-st tr-st-${col.cor}"></i>${escapeHtml(col.rotulo)}</span>
          <span class="tr-col-n">${desta.length}</span>
        </div>
        <div class="tr-col-corpo">${trGrupos(desta)}</div>
      </div>`;
  }).join('');
  trLigarArraste();
  // Ponto `quadro.painel` (fase 11), acima das colunas. `xtRepintarPontosAbertos`
  // já chama esta função com o Quadro aberto — o ponto entra junto.
  if (typeof xtEncaixe === 'function') {
    xtEncaixe('quadro.painel', document.getElementById('tr-encaixe'),
      { projeto: (typeof currentProject !== 'undefined' && currentProject) || null });
  }
  trPintarEncaixesDosCartoes();
}

// M2 · um ponto por cartão, no rodapé, ao lado de "editar" e "excluir".
//
// ⚠️ DEPOIS do `innerHTML`, e nunca dentro de `trCartao`. O cartão é montado
// como TEXTO, e uma extensão só sabe desenhar em elemento — além de precisar
// pendurar o próprio ouvinte de clique, que um texto não guarda. Por isso o
// ponto é uma segunda passada sobre o que já está na tela.
function trPintarEncaixesDosCartoes() {
  if (typeof xtEncaixe !== 'function') return;
  document.querySelectorAll('#tr-board .tr-cartao').forEach(cartao => {
    const acoes = cartao.querySelector('.tr-cartao-acoes');
    const a = trAtividades.find(x => x.id === cartao.dataset.id);
    if (!acoes || !a) return;
    xtEncaixe('trabalhos.quadro.cartao', acoes, {
      id: a.id, titulo: a.titulo, coluna: a.coluna,
      tags: [...(a.tags || [])], pasta: a.pasta || '',
    });
  });
}

// Agrupamento por pasta dentro da coluna. Uma coluna em que todo cartão está
// na mesma pasta (ou em nenhuma) não desenha grupo nenhum: a caixa com um
// rótulo só é ruído, não organização.
function trGrupos(atividades) {
  const pastas = [...new Set(atividades.map(a => a.pasta || ''))];
  if (pastas.length <= 1) return atividades.map(trCartao).join('');
  return pastas.map(pasta => {
    const desta = atividades.filter(a => (a.pasta || '') === pasta);
    const rotulo = pasta ? `📁 ${escapeHtml(pasta)}` : 'sem pasta';
    return `
      <div class="tr-grupo">
        <div class="tr-grupo-h">${rotulo}</div>
        ${desta.map(trCartao).join('')}
      </div>`;
  }).join('');
}

function trCartao(a) {
  const tags = (a.tags || []).map(t =>
    `<span class="tr-tag tr-tag-${escapeHtml(t)}">${escapeHtml(trRotuloDaTag(t, a))}</span>`).join('');
  const tarefas = (a.tarefas || []);
  const feitas = tarefas.filter(t => t.estado === 'feita').length;
  const aberta = trAtividadeAberta === a.id;
  return `
    <div class="tr-cartao" data-id="${escapeHtml(a.id)}" data-coluna="${escapeHtml(a.coluna)}">
      <div class="tr-cartao-t">${escapeHtml(a.titulo)}</div>
      ${tags ? `<div class="tr-cartao-meta">${tags}</div>` : ''}
      ${a.resumo ? `<div class="tr-cartao-resumo">${escapeHtml(a.resumo)}</div>` : ''}
      ${a.motivo_do_portao ? `<div class="tr-portao">⏸ ${escapeHtml(a.motivo_do_portao)}</div>` : ''}
      ${tarefas.length ? `
        <div class="tr-tarefas">
          <div class="tr-tarefas-h">tarefas do cartão — definidas pelo Orquestrador · ${feitas}/${tarefas.length}</div>
          ${tarefas.map(t => `
            <div class="tr-tarefa tr-tarefa-${escapeHtml(t.estado)}"><i></i>${escapeHtml(t.texto)}</div>
          `).join('')}
        </div>` : ''}
      ${a.briefing ? `
        <div class="tr-briefing-link" data-briefing="${escapeHtml(a.id)}">
          ${aberta ? 'esconder o briefing ↑' : 'ver briefing completo →'}
        </div>
        ${aberta ? `<div class="tr-briefing">${escapeHtml(a.briefing)}</div>` : ''}` : ''}
      <div class="tr-cartao-pe">
        <span>${escapeHtml(trRotuloDaAutoria(a.autoria))}</span>
        <span class="tr-cartao-acoes">
          <button type="button" class="tr-acao" data-editar-cartao="${escapeHtml(a.id)}"
                  title="Editar esta atividade">editar</button>
          <button type="button" class="tr-acao tr-acao-perigo" data-excluir-cartao="${escapeHtml(a.id)}"
                  title="Excluir esta atividade">excluir</button>
        </span>
        <span class="tr-id">#${escapeHtml(a.id)}</span>
      </div>
    </div>`;
}

function trRotuloDaTag(tag, a) {
  if (tag === 'arquivos') return `${(a.arquivos || []).length} arquivo(s)`;
  if (tag === 'dependencia') return `depende de ${(a.depende_de || []).join(', ')}`;
  if (tag === 'briefing') return 'Briefing';
  return tag;
}

function trRotuloDaAutoria(autoria) {
  return autoria === 'orquestrador' ? 'escrita pelo assistente' : 'escrita por você';
}

function trPintarLateral() {
  const lista = document.getElementById('tr-lado-lista');
  const pe = document.getElementById('tr-lado-pe');
  if (!lista) return;

  const contar = fn => {
    const mapa = {};
    trAtividades.forEach(a => {
      const chaves = fn(a);
      (Array.isArray(chaves) ? chaves : [chaves]).forEach(k => {
        if (k) mapa[k] = (mapa[k] || 0) + 1;
      });
    });
    return mapa;
  };

  // ⚠️ `rotular` existe porque o VALOR do filtro e o TEXTO na tela nem sempre
  // são a mesma coisa: a autoria é filtrada por `voce`/`orquestrador`, que é o
  // que está gravado no cartão, mas mostrada como "escrita por você". Casar
  // pelo texto quebraria no dia em que o rótulo mudasse.
  const secao = (titulo, tipo, mapa, rotular = k => k) => {
    const itens = Object.keys(mapa).sort().map(k => {
      const on = trFiltro && trFiltro.tipo === tipo && trFiltro.valor === k;
      return `<div class="tr-lado-item ${on ? 'on' : ''}" data-tipo="${tipo}" data-valor="${escapeHtml(k)}">
                ${escapeHtml(rotular(k))} <span class="tr-lado-n">${mapa[k]}</span>
              </div>`;
    }).join('');
    return itens ? `<div class="tr-lado-sec">${titulo}</div>${itens}` : '';
  };

  const todos = !trFiltro ? 'on' : '';
  lista.innerHTML = `
    <div class="tr-lado-item ${todos}" data-tipo="" data-valor="">
      Todas as atividades <span class="tr-lado-n">${trAtividades.length}</span>
    </div>
    ${secao('Pasta', 'pasta', contar(a => a.pasta || '(sem pasta)'))}
    ${secao('Quem escreveu', 'autoria', contar(a => a.autoria), trRotuloDaAutoria)}
    ${secao('Tipo', 'tag', contar(a => (a.tags || []).filter(t =>
        ['obra', 'pesquisar', 'teste', 'conferencia'].includes(t))))}`;

  if (pe) {
    const parados = trAtividades.filter(a => a.coluna === 'precisa-de-voce').length;
    pe.innerHTML = parados
      ? `<b class="tr-alerta">${parados}</b> parou para te perguntar`
      : 'nenhuma parada esperando você';
  }
}

// ── Eventos ─────────────────────────────────────────────────────────────────

function trLigarEventos() {
  const painel = document.getElementById('trsub-quadro');
  if (!painel) return;

  document.getElementById('tr-btn-nova').addEventListener('click', () => trAbrirModal());
  document.getElementById('tr-btn-cancelar').addEventListener('click', trFecharModal);
  document.getElementById('tr-btn-salvar').addEventListener('click', trSalvarModal);
  document.getElementById('tr-btn-pasta').addEventListener('click', () =>
    window.pywebview.api.abrir_pasta_dos_trabalhos(currentProject));

  document.getElementById('tr-lado-lista').addEventListener('click', e => {
    const item = e.target.closest('.tr-lado-item');
    if (!item) return;
    trFiltro = item.dataset.tipo ? { tipo: item.dataset.tipo, valor: item.dataset.valor } : null;
    trPintarQuadro();
    trPintarLateral();
  });

  document.getElementById('tr-board').addEventListener('click', e => {
    const editar = e.target.closest('[data-editar-cartao]');
    if (editar) {
      const a = trAtividades.find(x => x.id === editar.dataset.editarCartao);
      if (a) trAbrirModal(a);
      return;
    }
    const excluir = e.target.closest('[data-excluir-cartao]');
    if (excluir) { trExcluirCartao(excluir.dataset.excluirCartao); return; }
    const link = e.target.closest('[data-briefing]');
    if (!link) return;
    const id = link.dataset.briefing;
    trAtividadeAberta = trAtividadeAberta === id ? null : id;
    trPintarQuadro();
  });
}

// Sem `atividade` cria; com ela edita. Os quatro campos do modal são
// exatamente os quatro que `editar_atividade` aceita no backend — é isso que
// permite editar sem construir uma segunda tela.
function trAbrirModal(atividade) {
  document.getElementById('tr-modal').classList.remove('hidden');
  trEditandoId = atividade ? atividade.id : null;
  const valores = {
    'tr-f-titulo': atividade ? (atividade.titulo || '') : '',
    'tr-f-pasta': atividade ? (atividade.pasta || '') : '',
    'tr-f-resumo': atividade ? (atividade.resumo || '') : '',
    'tr-f-briefing': atividade ? (atividade.briefing || '') : '',
  };
  Object.keys(valores).forEach(id => { document.getElementById(id).value = valores[id]; });
  document.getElementById('tr-modal-h').textContent =
    atividade ? `Editar ${atividade.id}` : 'Nova atividade';
  document.getElementById('tr-f-titulo').focus();
}

function trFecharModal() {
  document.getElementById('tr-modal').classList.add('hidden');
  // ⚠️ Sem esta linha o modal "gruda": o próximo ＋ Nova atividade editaria o
  // cartão anterior em vez de criar um novo, e nada na tela avisaria.
  trEditandoId = null;
}

async function trSalvarModal() {
  const titulo = document.getElementById('tr-f-titulo').value.trim();
  if (!titulo) { showToast('A atividade precisa de um nome.', true); return; }
  const pasta = document.getElementById('tr-f-pasta').value.trim();
  const resumo = document.getElementById('tr-f-resumo').value.trim();
  const briefing = document.getElementById('tr-f-briefing').value.trim();

  if (trEditandoId) {
    const id = trEditandoId;
    const r = await window.pywebview.api.editar_atividade(
      currentProject, id, { titulo, pasta, resumo, briefing });
    if (!r.success) { showToast(r.error, true); return; }
    trFecharModal();
    showToast(`Atividade ${id} atualizada.`);
    trCarregarQuadro();
    return;
  }

  const r = await window.pywebview.api.criar_atividade(
    currentProject, titulo, pasta, resumo, briefing);
  if (!r.success) { showToast(r.error, true); return; }
  trFecharModal();
  // Nasce sempre em "Na fila" — a coluna não é escolha de quem cria.
  showToast(`Atividade ${r.atividade.id} criada em "Na fila".`);
  trCarregarQuadro();
}

// -- Excluir -----------------------------------------------------------------

// Quem para de depender deste cartão se ele sumir. `excluir_atividade` tira o
// id de `depende_de` das outras — mexe em cartões que o usuário não está
// olhando, e é a consequência menos óbvia da exclusão. Está tudo carregado em
// `trAtividades`, então não custa uma chamada ao backend.
function trDependentesDe(id) {
  return trAtividades.filter(a => (a.depende_de || []).includes(id));
}

/**
 * A confirmação antes de excluir um cartão. Devolve `true` para seguir.
 *
 * ⚠️ Ela DIZ O QUE SE PERDE em vez de perguntar "tem certeza?": some o cartão,
 * o resumo, o briefing e as tarefas que o Orquestrador escreveu — e, quando é o
 * caso, outras atividades param de depender desta. Mesma regra da fila e do
 * Chat.
 *
 * Respeita "Perguntar antes de remover" (Configurações › Encerrar e excluir).
 * Desligada, o clique volta a apagar direto.
 */
function trConfirmarExclusao(a) {
  if (appSettings.confirmar_ao_deletar === false) return Promise.resolve(true);
  const tarefas = (a.tarefas || []).length;
  const dependentes = trDependentesDe(a.id);
  const perde = 'o cartão, o resumo, o briefing'
    + (tarefas ? ` e as ${tarefas} tarefa(s) escritas pelo Orquestrador` : '');
  const cascata = dependentes.length
    ? `<br><br>${dependentes.length} atividade(s) dependia(m) desta `
      + `(${escapeHtml(dependentes.map(d => d.id).join(', '))}) e vão parar de depender.`
    : '';
  return new Promise(resolve => {
    let confirmou = false;
    const overlay = abrirModalPadrao({
      title: 'Excluir esta atividade?',
      confirmLabel: 'Excluir',
      bodyHtml: `<div class="modal-body-text">Isto apaga
        <strong>${escapeHtml(a.titulo)}</strong> (${escapeHtml(a.id)}): ${perde}.${cascata}
        <br><br><strong>Não dá pra desfazer.</strong></div>`,
      onConfirm: () => { confirmou = true; },
    });
    // O modal sai do DOM por três caminhos — Confirmar, Cancelar e clique fora —
    // e a promessa precisa ser resolvida nos três, senão um Cancelar deixaria o
    // clique pendurado para sempre. Mesmo mecanismo da fila.
    new MutationObserver((_m, obs) => {
      if (!overlay.isConnected) { obs.disconnect(); resolve(confirmou); }
    }).observe(document.body, { childList: true });
  });
}

async function trExcluirCartao(id) {
  const a = trAtividades.find(x => x.id === id);
  if (!a) return;
  if (!await trConfirmarExclusao(a)) return;
  const r = await window.pywebview.api.excluir_atividade(currentProject, id);
  if (!r.success) { showToast(r.error, true); return; }
  // O briefing aberto pode ser justamente o do cartão que sumiu: o id ficaria
  // pendurado apontando para nada.
  if (trAtividadeAberta === id) trAtividadeAberta = null;
  showToast(`Atividade ${id} excluída.`);
  trCarregarQuadro();
}

// ── O arraste ───────────────────────────────────────────────────────────────

function trLigarArraste() {
  document.querySelectorAll('#tr-board .tr-cartao').forEach(cartao => {
    cartao.addEventListener('mousedown', function (e) {
      // Botão esquerdo só, e não em cima do link de briefing nem dos botões de
      // editar e excluir: clicar neles é agir, não arrastar.
      if (e.button !== 0 || e.target.closest(
        // `.xt-encaixe` entrou na lista com a Obra 2: um botão que uma
        // extensão pôs no rodapé não pode virar arraste do cartão — o clique
        // dela nunca chegaria, e o cartão sairia voando da coluna.
        '[data-briefing], [data-editar-cartao], [data-excluir-cartao], .xt-encaixe')) return;
      e.preventDefault();
      const alvo = this;
      const partiuDe = { x: e.clientX, y: e.clientY };
      const colunaOriginal = alvo.dataset.coluna;
      let arrastando = false;

      function onMouseMove(e2) {
        if (!arrastando) {
          const andou = Math.abs(e2.clientX - partiuDe.x) + Math.abs(e2.clientY - partiuDe.y);
          if (andou < TRABALHOS_LIMIAR_ARRASTE) return;
          arrastando = true;
          alvo.classList.add('arrastando');
        }
        const sob = document.elementFromPoint(e2.clientX, e2.clientY);
        const coluna = sob && sob.closest('.tr-col');
        document.querySelectorAll('#tr-board .tr-col').forEach(c => c.classList.remove('alvo'));
        if (coluna && coluna.dataset.coluna !== colunaOriginal) coluna.classList.add('alvo');
      }

      async function onMouseUp(e2) {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        alvo.classList.remove('arrastando');
        document.querySelectorAll('#tr-board .tr-col').forEach(c => c.classList.remove('alvo'));
        if (!arrastando) return;
        const sob = document.elementFromPoint(e2.clientX, e2.clientY);
        const coluna = sob && sob.closest('.tr-col');
        if (!coluna || coluna.dataset.coluna === colunaOriginal) return;
        // ⚠️ O DOM não se mexe aqui, e isso é de propósito: quem manda no
        // Quadro é o `Estado.json`, que outro processo também escreve. Mover o
        // cartão na tela antes da confirmação mostraria como certo um estado
        // que a gravação ainda pode recusar.
        const r = await window.pywebview.api.mover_atividade(
          currentProject, alvo.dataset.id, coluna.dataset.coluna);
        if (!r.success) { showToast(r.error, true); return; }
        trCarregarQuadro();
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}
