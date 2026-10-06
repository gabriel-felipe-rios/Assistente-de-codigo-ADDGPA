// ═══════════════════════════════ Configurações → Launchers (comportamento) ══
// Mostra a árvore de External/launchers/ (arquivos soltos na raiz e dentro
// de pastas/subpastas, em qualquer profundidade) com um Interruptor
// (ligado/desligado) e os dois checkboxes de local por ARQUIVO — pasta e
// subpasta não têm configuração própria, são só organização visual. Cada
// linha de arquivo mostra o ícone real do Windows, extraído no backend.
//
// A ORDEM é só das PASTAS (grupo/subgrupo), arrastáveis entre si dentro do
// mesmo nível — arquivo fica sempre em ordem alfabética, sem drag próprio
// (decisão: controlar a ordem dos grupos já resolve, sem precisar de um
// drag-and-drop aninhado por item). Arrastar uma pasta grava IMEDIATAMENTE
// ao soltar.
//
// ⚠️ O "Salvar launchers" existe MESMO ASSIM, e nunca tem nada pendente:
// regrava a ordem que está na tela (todos os níveis de uma vez) e confirma
// em voz alta. Nenhuma categoria de Configurações fica sem "Salvar"
// (decisão de 2026-08-26, a mesma de Temas e Notificações) — e ele é a
// segunda chance de quem viu a gravação falhar ao soltar a pasta.
//
// O estado vivo (a última árvore lida do backend) mora em
// `atalhosExternosArvore` — `atalhos-externos-navegacao.js` usa esse
// mesmo global pra montar as duas abas. Este arquivo é quem primeiro
// popula esse estado; qualquer mudança aqui chama
// `atualizarAbasDeAtalhosExternos()` (definida lá) para as duas abas
// repintarem.

let atalhosExternosArvore = { nome: '', caminho: '', pastas: [], itens: [] };

// Glifo neutro de arquivo, como fallback quando o backend não conseguiu
// extrair o ícone real (arquivo sem ícone recuperável, ou já apagado) —
// nunca deixa a linha sem imagem nenhuma.
const ICONE_ATALHO_PLACEHOLDER =
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#7d84a8" stroke-width="1.5"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/></svg>');

async function initConfigAtalhosExternos() {
  await carregarAtalhosExternos();

  // Relê a pasta toda vez que a categoria é ABERTA de novo (não só no
  // boot) — sem isso, um arquivo (ou pasta) arrastado pra
  // External/launchers/ depois do programa já ter iniciado só aparecia
  // reabrindo o programa inteiro, porque `initConfigAtalhosExternos` só
  // roda uma vez, no boot de todas as categorias. O clique no botão do
  // trilho é o único lugar em que "abrir esta categoria" é observável.
  const trilhoBtn = document.querySelector(
    '#config-trilho .config-trilho-btn[data-categoria="atalhos-externos"]');
  if (trilhoBtn && !trilhoBtn._wiredRecarga) {
    trilhoBtn._wiredRecarga = true;
    trilhoBtn.addEventListener('click', carregarAtalhosExternos);
  }

  const btnSalvar = document.getElementById('btn-save-atalhos-externos');
  if (btnSalvar && !btnSalvar._wired) {
    btnSalvar._wired = true;
    btnSalvar.addEventListener('click', salvarOrdemAtalhosExternos);
  }

  const lista = document.getElementById('atalhos-externos-lista');
  if (!lista) return;

  // Delegado no container: a árvore é remontada toda vez que o estado
  // muda, e um listener por linha morreria junto da linha antiga.
  if (!lista._wired) {
    lista._wired = true;
    lista.addEventListener('click', async (ev) => {
      const caminho = ev.target.closest('.plugin-item')?.dataset.atalho;
      if (!caminho) return;

      const togglePill = ev.target.closest('.toggle-pill');
      const check = ev.target.closest('.plugin-check input');

      if (togglePill) {
        const track = togglePill.querySelector('.toggle-track');
        const ligado = !track.classList.contains('on');
        await _salvarAtalhoExterno(caminho, { ligado });
      } else if (check) {
        // O clique no <input> já mudou `checked` sozinho — lê o valor novo.
        const campo = check.dataset.campo;
        await _salvarAtalhoExterno(caminho, { [campo]: check.checked });
      }
    });
  }
}

/** Busca a árvore no backend, guarda em `atalhosExternosArvore` e repinta. */
async function carregarAtalhosExternos() {
  try {
    const r = await window.pywebview.api.list_atalhos_externos();
    atalhosExternosArvore = (r && r.success) ? r.arvore : { nome: '', caminho: '', pastas: [], itens: [] };
  } catch (e) {
    console.error('[atalhos-externos] falha ao listar:', e);
    atalhosExternosArvore = { nome: '', caminho: '', pastas: [], itens: [] };
  }
  _pintarListaAtalhosExternos();
  if (typeof atualizarAbasDeAtalhosExternos === 'function') atualizarAbasDeAtalhosExternos();
  return atalhosExternosArvore;
}

async function _salvarAtalhoExterno(caminho, patch) {
  try {
    const r = await window.pywebview.api.save_config_atalho_externo(caminho, patch);
    if (!r || !r.success) {
      showToast((r && r.error) || 'Não foi possível gravar o atalho.', true);
      return;
    }
    atalhosExternosArvore = r.arvore;
  } catch (e) {
    showToast('Não foi possível gravar o atalho.', true);
    console.error('[atalhos-externos] falha ao gravar:', e);
    return;
  }
  _pintarListaAtalhosExternos();
  if (typeof atualizarAbasDeAtalhosExternos === 'function') atualizarAbasDeAtalhosExternos();
}

async function _salvarOrdemDePastas(caminhoPai, ordem) {
  try {
    const r = await window.pywebview.api.save_atalhos_externos_pasta_order(caminhoPai, ordem);
    if (!r || !r.success) {
      showToast((r && r.error) || 'Não foi possível salvar a ordem.', true);
      _pintarListaAtalhosExternos(); // desfaz visualmente o arraste
      return;
    }
    atalhosExternosArvore = r.arvore;
  } catch (e) {
    showToast('Não foi possível salvar a ordem.', true);
    console.error('[atalhos-externos] falha ao salvar ordem:', e);
    _pintarListaAtalhosExternos();
    return;
  }
  _pintarListaAtalhosExternos();
  if (typeof atualizarAbasDeAtalhosExternos === 'function') atualizarAbasDeAtalhosExternos();
}

/** Lê a ordem das PASTAS que está no DOM agora — um
 * `{caminho_da_pasta_pai: [nomes]}` com TODOS os níveis presentes na
 * árvore, mesmo formato de `launchers-ordem.json`. Só nível de
 * pasta entra: arquivo não tem ordem manual nesta categoria. */
function _coletarOrdemAtalhosExternos(elArvore) {
  const ordemPorPasta = {};
  elArvore.querySelectorAll('.atalho-externo-pastas-nivel[data-caminho-pai]').forEach(nivel => {
    ordemPorPasta[nivel.dataset.caminhoPai] =
      [...nivel.children].map(el => el.dataset.pasta);
  });
  return ordemPorPasta;
}

/** O "Salvar launchers". Regrava a ordem inteira de uma vez — arrastar já
 * gravou nível a nível, então normalmente não há nada pendente; o botão
 * existe para a barra desta categoria não ficar diferente das vizinhas, e
 * para dar uma segunda chance a quem viu a gravação falhar ao soltar. */
async function salvarOrdemAtalhosExternos() {
  const lista = document.getElementById('atalhos-externos-lista');
  const ordemPorPasta = lista ? _coletarOrdemAtalhosExternos(lista) : {};
  try {
    const r = await window.pywebview.api.save_atalhos_externos_order(ordemPorPasta);
    if (!r || !r.success) {
      showToast((r && r.error) || 'Não foi possível salvar a ordem.', true);
      return;
    }
    atalhosExternosArvore = r.arvore;
  } catch (e) {
    showToast('Não foi possível salvar a ordem.', true);
    console.error('[atalhos-externos] falha ao salvar ordem:', e);
    return;
  }
  _pintarListaAtalhosExternos();
  if (typeof atualizarAbasDeAtalhosExternos === 'function') atualizarAbasDeAtalhosExternos();
  showToast('Launchers salvos!');
}

function _atalhoExternoLinhaHtml(item) {
  return `
    <div class="plugin-item" data-atalho="${escapeHtml(item.caminho)}">
      <img class="atalho-externo-icone" src="${item.icone || ICONE_ATALHO_PLACEHOLDER}"
           alt="" onerror="this.onerror=null;this.src='${ICONE_ATALHO_PLACEHOLDER}';" />
      <div class="plugin-info">
        <div class="plugin-nome">${escapeHtml(item.nome)}</div>
      </div>
      <div class="plugin-onde">
        <label class="plugin-check">
          <input type="checkbox" data-campo="tela_principal" ${item.tela_principal ? 'checked' : ''} />
          Tela principal
        </label>
        <label class="plugin-check">
          <input type="checkbox" data-campo="dentro_do_projeto" ${item.dentro_do_projeto ? 'checked' : ''} />
          Dentro do projeto
        </label>
      </div>
      <label class="toggle-pill">
        <div class="toggle-track${item.ligado ? ' on' : ''}"><div class="toggle-knob"></div></div>
        <span class="toggle-label${item.ligado ? ' on' : ''}">${item.ligado ? 'Ligado' : 'Desligado'}</span>
      </label>
    </div>`;
}

/** Uma pasta (grupo/subgrupo): título com alça de arrastar, e o corpo —
 * recursivo, as subpastas dela primeiro (na ordem salva), os arquivos
 * dela depois, sempre alfabético. Pasta não tem interruptor nem
 * checkboxes: é pura organização. */
function _atalhoExternoPastaHtml(pasta) {
  return `
    <div class="atalho-externo-pasta-config" data-pasta="${escapeHtml(pasta.nome)}">
      <div class="atalho-externo-pasta-titulo">
        <span class="atalho-externo-pasta-handle" title="Arrastar para reordenar">⠿</span>
        <span class="atalho-externo-pasta-nome">${escapeHtml(pasta.nome)}</span>
      </div>
      <div class="atalho-externo-pasta-corpo">${_atalhoExternoCorpoHtml(pasta)}</div>
    </div>`;
}

/** O conteúdo de UM nível: bloco das subpastas (se houver) + linhas dos
 * arquivos. Chamada tanto para a raiz quanto, recursivamente, para cada
 * pasta — é por isso que a árvore não tem limite de profundidade fixo. */
function _atalhoExternoCorpoHtml(no) {
  const pastasHtml = no.pastas.length
    ? `<div class="atalho-externo-pastas-nivel" data-caminho-pai="${escapeHtml(no.caminho)}">${
        no.pastas.map(_atalhoExternoPastaHtml).join('')}</div>`
    : '';
  const itensHtml = no.itens.map(_atalhoExternoLinhaHtml).join('');
  return pastasHtml + itensHtml;
}

function _pintarListaAtalhosExternos() {
  const lista = document.getElementById('atalhos-externos-lista');
  if (!lista) return;

  if (!atalhosExternosArvore.pastas.length && !atalhosExternosArvore.itens.length) {
    lista.innerHTML = `<p class="plugins-vazio">Nenhum atalho em <code>External/launchers/</code> ainda.
      Arraste um arquivo (.exe, .bat, .lnk, ou qualquer outro) pra lá — direto na pasta, ou dentro de uma subpasta pra organizar em grupos.</p>`;
    return;
  }

  lista.innerHTML = _atalhoExternoCorpoHtml(atalhosExternosArvore);
  _initAtalhosExternosPastasDnd(lista);
}

// Reordenação via mousedown/mousemove/mouseup, não a API nativa de HTML5
// drag-and-drop — mesmo motivo de `tab-order.js`: dragstart/dragover não
// disparam de forma confiável no WebView2. Só PASTAS arrastam, e só entre
// si, dentro do MESMO `.atalho-externo-pastas-nivel` (mesma pasta-mãe) —
// nunca cruzando para dentro/fora de uma subpasta.
const ATALHO_EXTERNO_DND_LIMIAR = 4;

function _atalhoExternoPastaAfter(nivel, dragEl, y) {
  const irmas = [...nivel.children].filter(el => el !== dragEl);
  for (const el of irmas) {
    const box = el.getBoundingClientRect();
    if (y < box.top + box.height / 2) return el;
  }
  return null;
}

function _initAtalhosExternosPastasDnd(raiz) {
  raiz.querySelectorAll('.atalho-externo-pastas-nivel').forEach(nivel => {
    [...nivel.children].forEach(pastaEl => {
      const handle = pastaEl.querySelector(':scope > .atalho-externo-pasta-titulo > .atalho-externo-pasta-handle');
      if (!handle) return;
      handle.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        const dragEl = pastaEl;
        const partiuDe = { x: e.clientX, y: e.clientY };
        let arrastando = false;

        function onMouseMove(e2) {
          if (!arrastando) {
            const andou = Math.abs(e2.clientX - partiuDe.x) + Math.abs(e2.clientY - partiuDe.y);
            if (andou < ATALHO_EXTERNO_DND_LIMIAR) return;
            arrastando = true;
            dragEl.classList.add('dragging');
          }
          const after = _atalhoExternoPastaAfter(nivel, dragEl, e2.clientY);
          if (after === dragEl.nextElementSibling) return;
          if (after == null) nivel.appendChild(dragEl);
          else nivel.insertBefore(dragEl, after);
        }
        function onMouseUp() {
          dragEl.classList.remove('dragging');
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          if (!arrastando) return;
          const ordem = [...nivel.children].map(el => el.dataset.pasta);
          _salvarOrdemDePastas(nivel.dataset.caminhoPai, ordem);
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });
  });
}
