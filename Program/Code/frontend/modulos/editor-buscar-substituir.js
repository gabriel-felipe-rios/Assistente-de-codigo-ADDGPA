// ═══════════════ EDITOR: BUSCAR E SUBSTITUIR NO PROJETO INTEIRO (Obra 13) ══
// Ctrl+Shift+F — DIFERENTE do Ctrl+F (`.ed-find`, busca só dentro do arquivo
// aberto). Este painel busca no PROJETO inteiro, reaproveitando o mesmo
// endpoint "Por conteúdo" que a árvore já usa (`editor_buscar_conteudo`) só
// pra listar os arquivos com ocorrência — e depois lê cada um
// (`editor_ler_arquivo`, já usado em vários lugares) pra contar as ocorrências
// e montar o preview.
//
// ⚠️ "Substituir todas" grava DIRETO no disco pelo `editor_gravar_arquivo` que
// já existe — sem endpoint novo de gravação em lote. Um arquivo por vez, cada
// um com o hash que acabou de ser lido (a mesma proteção contra escrita
// concorrente que o Ctrl+S já usa).
//
// ⚠️ ARQUIVO ABERTO COM EDIÇÃO NÃO SALVA é PULADO, não sobrescrito — gravar por
// cima destruiria a edição em andamento sem aviso. `cfg.temAbertoSujo` decide.

// eslint-disable-next-line no-unused-vars
function criarBuscarSubstituir(cfg) {
  const opcoes = Object.assign({
    temAbertoSujo: null,     // (caminho) => bool
    aoArquivoGravado: null,  // (caminho) => void — recarrega a aba se estiver aberta e limpa
  }, cfg || {});

  let overlayEl = null;
  let resultado = [];   // [{caminho, conteudo, ocorrencias:[{linha,contexto}], hash, fimDeLinha, bom}]

  function fechar() {
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  }

  function _ocorrenciasDoTexto(texto, termo) {
    const linhas = texto.split('\n');
    const ocs = [];
    linhas.forEach((linha, i) => {
      let pos = 0;
      for (;;) {
        const p = linha.indexOf(termo, pos);
        if (p === -1) break;
        ocs.push({ linha: i + 1, contexto: linha.trim().slice(0, 140) });
        pos = p + termo.length;
      }
    });
    return ocs;
  }

  async function buscar(termo) {
    const r = await window.pywebview.api.editor_buscar_conteudo(currentProject, termo, true);
    if (!r || !r.success) { showToast((r && r.error) || 'Erro na busca.', true); return []; }
    const arquivos = [];
    for (const caminho of r.caminhos) {
      // eslint-disable-next-line no-await-in-loop
      const lido = await window.pywebview.api.editor_ler_arquivo(currentProject, caminho);
      if (!lido.success || lido.tipo === 'binario') continue;
      // A busca por conteúdo é sem maiúsculas/minúsculas (ver editor.py); a
      // contagem de ocorrências aqui é EXATA (respeitando caixa) — é o que vai
      // ser substituído de verdade, e prometer o número errado é pior que
      // buscar de novo.
      const ocorrencias = _ocorrenciasDoTexto(lido.conteudo, termo);
      if (ocorrencias.length) {
        arquivos.push({
          caminho, conteudo: lido.conteudo, ocorrencias,
          hash: lido.hash, fimDeLinha: lido.fim_de_linha, bom: lido.bom,
        });
      }
    }
    return arquivos;
  }

  function totalDeOcorrencias() {
    return resultado.reduce((soma, a) => soma + a.ocorrencias.length, 0);
  }

  function pintarLista(corpo, termo) {
    if (!resultado.length) {
      corpo.innerHTML = `<div class="ed-vazio">${termo ? 'Nada encontrado com essa grafia exata.' : 'Digite algo em "Buscar".'}</div>`;
      return;
    }
    corpo.innerHTML = resultado.map((a) => `
      <div class="rp-res">
        <b>${escapeHtml(a.caminho)}</b> — ${a.ocorrencias.length} ocorrência(s)
        ${a.ocorrencias.slice(0, 3).map((o) =>
          `<div>${o.linha}: ${escapeHtml(o.contexto)}</div>`).join('')}
        ${a.ocorrencias.length > 3 ? `<div>… mais ${a.ocorrencias.length - 3}.</div>` : ''}
      </div>`).join('');
  }

  async function substituirTodas(termo, substituto) {
    const pulados = resultado.filter((a) => opcoes.temAbertoSujo && opcoes.temAbertoSujo(a.caminho));
    const alvo = resultado.filter((a) => !pulados.includes(a));
    if (pulados.length) {
      showToast(`${pulados.length} arquivo(s) pulado(s) — têm edição não salva aberta no Editor.`, true);
    }
    let ok = 0;
    let falhas = 0;
    for (const a of alvo) {
      const novo = a.conteudo.split(termo).join(substituto);
      // eslint-disable-next-line no-await-in-loop
      const r = await window.pywebview.api.editor_gravar_arquivo(
        currentProject, a.caminho, novo, a.hash, a.fimDeLinha, a.bom);
      if (r.success) { ok++; if (opcoes.aoArquivoGravado) opcoes.aoArquivoGravado(a.caminho); }
      else falhas++;
    }
    showToast(`Substituído em ${ok} arquivo(s)${falhas ? ` — ${falhas} falharam` : ''}.`, falhas > 0);
  }

  // ⚠️ SEM `.modal-overlay` DE PROPÓSITO. A primeira versão deste painel usava
  // o mesmo fundo escuro/centralizado dos modais de confirmação — o usuário
  // testou e achou pesado demais para uma busca, pedindo o mesmo estilo
  // flutuante do "Buscar no arquivo" (`.ed-find`, ancorado no canto do
  // código). Este painel é maior que aquele (tem campo de substituir e uma
  // lista de resultados), mas segue a mesma ideia: flutua por cima, não
  // bloqueia o resto da tela, fecha no Esc ou clicando fora.
  function abrir() {
    if (overlayEl) { overlayEl.querySelector('[data-f="buscar"]').focus(); return; }
    overlayEl = document.createElement('div');
    overlayEl.className = 'ed-replace-painel';
    overlayEl.innerHTML = `
      <div class="rp-header">Buscar e substituir no projeto
        <button type="button" class="rp-fechar" data-acao="fechar" title="Fechar (Esc)">×</button>
      </div>
      <div class="rp-campos">
        <div class="rp-campo"><label>Buscar</label><input type="text" data-f="buscar" spellcheck="false"></div>
        <div class="rp-campo"><label>Substituir</label><input type="text" data-f="substituir" spellcheck="false"></div>
      </div>
      <div class="rp-lista"><div class="ed-vazio">Digite algo em "Buscar".</div></div>
      <div class="rp-rodape">
        <button type="button" class="btn btn-primary btn-sm" data-acao="substituir" disabled>Substituir todas</button>
      </div>`;
    document.body.appendChild(overlayEl);

    const campoBuscar = overlayEl.querySelector('[data-f="buscar"]');
    const campoSubst  = overlayEl.querySelector('[data-f="substituir"]');
    const corpo = overlayEl.querySelector('.rp-lista');
    const btnSubstituir = overlayEl.querySelector('[data-acao="substituir"]');

    let relogio = null;
    async function refazerBusca() {
      const termo = campoBuscar.value;
      if (!termo.trim()) { resultado = []; pintarLista(corpo, ''); btnSubstituir.disabled = true; return; }
      corpo.innerHTML = '<div class="ed-vazio">Buscando…</div>';
      resultado = await buscar(termo);
      pintarLista(corpo, termo);
      btnSubstituir.disabled = !resultado.length;
    }
    campoBuscar.addEventListener('input', () => { clearTimeout(relogio); relogio = setTimeout(refazerBusca, 350); });
    campoSubst.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnSubstituir.click(); });

    overlayEl.querySelector('[data-acao="fechar"]').addEventListener('click', fechar);

    btnSubstituir.addEventListener('click', () => {
      if (!resultado.length) return;
      const termo = campoBuscar.value;
      const substituto = campoSubst.value;
      const n = totalDeOcorrencias();
      abrirModalPadrao({
        title: `Substituir ${n} ocorrência(s) em ${resultado.length} arquivo(s)?`,
        bodyHtml: `<p class="modal-dica">"<code>${escapeHtml(termo)}</code>" vira "<code>${escapeHtml(substituto)}</code>".
          Grava direto nos arquivos — sem desfazer pelo Editor (o Histórico local de cada
          arquivo guarda a versão anterior, se estiver ligado).</p>`,
        confirmLabel: 'Substituir',
        onConfirm: async () => { await substituirTodas(termo, substituto); fechar(); },
      });
    });

    campoBuscar.focus();
  }

  // Esc fecha, e clicar fora também — registrados uma vez no carregamento do
  // script (não a cada `abrir()`), senão empilharia um ouvinte por abertura.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlayEl) fechar();
  });
  document.addEventListener('click', (e) => {
    if (!overlayEl || overlayEl.contains(e.target)) return;
    // O botão que abre o painel também é um clique "fora" dele — sem esta
    // checagem, clicar no botão de novo abriria e fecharia no mesmo gesto.
    if (e.target.closest('[data-acao="buscar-substituir"]')) return;
    fechar();
  });

  return {
    abrir,
    fechar,
    alternar() { if (overlayEl) fechar(); else abrir(); },
  };
}
