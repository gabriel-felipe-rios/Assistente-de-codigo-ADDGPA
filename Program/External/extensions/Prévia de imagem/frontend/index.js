// ═════════════════════════ PRÉVIA DE IMAGEM — A CASCA ══
// Todo caminho de imagem escrito no código fica sublinhado. E, no clique
// direito da aba, "Imagens deste arquivo…" abre uma modal com todas elas,
// desenhadas.
//
// ⚠️ POR QUE SÃO DUAS COISAS, E NÃO UMA. O óbvio seria clicar na marca e ver a
// imagem — e isso é IMPOSSÍVEL hoje: o `<pre>` do Editor tem
// `pointer-events: none`, e todo clique e todo `hover` vão para o `<textarea>`
// por cima. A marca não recebe clique, e o `title` dela não aparece no mouse.
// A imagem flutuando sobre o código é outra forma do ponto
// (`editor.sobreposicao`), que ainda não existe.
//
// Então a marca diz ONDE, e a modal MOSTRA. É pouco, é barato, e está escrito
// aqui para a decisão de mantê-la ou esperar a sobreposição ser consciente.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug }
  const SLUG = EU.slug;

  // As mesmas de `_ED_BIN_IMAGENS` (`backend/modulos/editor_binarios.py`) — é
  // esse mesmo conjunto que o visualizador do Editor sabe desenhar.
  const IMG_EXTENSOES = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg', 'avif'];

  // Um caminho é uma sequência sem espaço, sem aspas e sem parêntese, que
  // termina numa dessas extensões.
  //
  // ⚠️ Sem `http` e sem `data:` — a modal resolve o caminho relativo ao arquivo
  // aberto, e nem um nem outro são arquivos do projeto. A classe não tem `:`,
  // então numa URL o casamento começa logo depois dele (`//cdn…/logo.png`) —
  // e é por isso que `imgAchar` descarta o que vem logo depois de `:`.
  //
  // ⚠️ Uma expressão NOVA por chamada, e não uma global com a flag `g`: o
  // `lastIndex` de uma regex global compartilhada é estado, e duas chamadas
  // entrelaçadas (o decorador e o menu da aba) se corromperiam.
  // Quantas imagens a modal desenha, no máximo, se a tela não disser outro.
  // Cada uma é uma ida à ponte que volta com o arquivo inteiro em base64; um
  // `.md` com trezentos caminhos disparava trezentas de uma vez e travava a
  // ponte.
  const IMG_TETO_NA_MODAL = 30;

  // Os padrões de fábrica — os mesmos do `config/tela.json`, de onde o
  // programa lê o que o usuário escolheu (`xtPreferenciasDe`).
  const IMG_PADRAO = { marcar_no_codigo: true, teto_na_modal: IMG_TETO_NA_MODAL, extensoes_extras: '' };

  function imgPrefs() {
    const lidas = (typeof xtPreferenciasDe === 'function' && xtPreferenciasDe(SLUG)) || {};
    return { ...IMG_PADRAO, ...lidas };
  }
  window.imgPrefs = imgPrefs;

  /** A fonte da expressão, com as extensões extras que o usuário acrescentou. */
  function _fonte() {
    const extras = String(imgPrefs().extensoes_extras || '')
      .split(/[,\s;]+/).map(e => e.trim().replace(/^\./, '').toLowerCase())
      .filter(e => /^[a-z0-9]{1,8}$/.test(e));
    const todas = [...new Set([...IMG_EXTENSOES, ...extras])];
    return `[\\w./\\\\@~-]+\\.(?:${todas.join('|')})\\b`;
  }

  window['xtMontar_' + SLUG] = function () {
    _injetarEstilo();
  };

  window['xtDesmontar_' + SLUG] = function () {
    delete window.imgAchar;
    delete window.imgAbrirModal;
    delete window.imgPrefs;
  };

  // O "Salvar" vale NA HORA: as marcas são refeitas com a expressão nova.
  window['xtPreferenciasMudaram_' + SLUG] = function () {
    if (typeof xtPedirDecoracao === 'function') xtPedirDecoracao();
  };

  /** Todos os caminhos de imagem do texto, com linha e coluna. */
  function imgAchar(texto, linhas) {
    const regex = new RegExp(_fonte(), 'gi');

    const inicios = [0];
    for (let i = 0; i < linhas.length - 1; i++) {
      inicios.push(inicios[i] + linhas[i].length + 1);
    }

    const achados = [];
    let achado;
    let linha = 0;
    while ((achado = regex.exec(texto)) !== null) {
      const pos = achado.index;
      if (achado[0].length === 0) { regex.lastIndex++; continue; }
      // A cauda de uma URL (`https://…/logo.png`) ou de um `data:` não é um
      // arquivo do projeto — o LEIA-ME promete não marcá-los.
      if (pos > 0 && texto[pos - 1] === ':') continue;
      if (achado[0].startsWith('//')) continue;
      while (linha + 1 < inicios.length && inicios[linha + 1] <= pos) linha++;
      achados.push({
        caminho: achado[0],
        linha: linha + 1,
        coluna: pos - inicios[linha],
        tamanho: achado[0].length,
      });
    }
    return achados;
  }

  window.imgAchar = imgAchar;

  // ── A modal ─────────────────────────────────────────────────────────────

  /**
   * ⛔ `abrirModalPadrao`, e nunca `alert()`: o nativo é do sistema, sai branco
   * no meio da tela escura e trava a janela.
   */
  function imgAbrirModal(caminhoDoArquivo, achados) {
    if (!achados.length) {
      showToast('Nenhum caminho de imagem neste arquivo.');
      return;
    }
    // Cada caminho uma vez, na ordem em que aparece.
    const todos = [...new Set(achados.map(a => a.caminho))];
    const lido = Number(imgPrefs().teto_na_modal);
    const teto = Math.max(1, Math.min(500, Number.isFinite(lido) && lido > 0 ? lido : IMG_TETO_NA_MODAL));
    const unicos = todos.slice(0, teto);
    const sobraram = todos.length - unicos.length;

    const overlay = abrirModalPadrao({
      title: 'Imagens deste arquivo',
      bodyHtml: `<div class="modal-body-text">Os ${todos.length} caminho(s) de
        imagem escritos em <strong>${escapeHtml(caminhoDoArquivo)}</strong>,
        resolvidos a partir da pasta dele.${sobraram
          ? ` Mostrando os ${unicos.length} primeiros.` : ''}</div>
        <div class="img-lista">${unicos.map((c, i) => `
          <div class="img-item" data-i="${i}">
            <div class="img-quadro"><span class="img-espera">…</span></div>
            <div class="img-info">
              <code class="img-caminho">${escapeHtml(c)}</code>
              <span class="img-dim"></span>
            </div>
            <button type="button" class="btn btn-muted btn-sm img-abrir" data-img-abrir="${i}" disabled
                    title="Abrir no visualizador do Editor">Abrir</button>
          </div>`).join('')}</div>`,
      confirmLabel: 'Fechar',
      semCancelar: true,
      onConfirm: () => true,
    });
    // "Abrir" leva ao visualizador de imagem do próprio Editor — o caminho
    // resolvido fica no `dataset` do botão quando a imagem carrega.
    overlay.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-img-abrir]');
      if (!b || b.disabled || !b.dataset.imgAlvo || typeof _edAbrirArquivo !== 'function') return;
      overlay.remove();
      try { await _edAbrirArquivo(b.dataset.imgAlvo); }
      catch (e) { showToast('Não deu para abrir a imagem.', true); console.error('[img]', e); }
    });

    // Uma ida à ponte por imagem, DEPOIS de a modal estar na tela: a lista
    // aparece na hora, e cada quadro se preenche quando a sua resposta chega.
    // ⚠️ EM SÉRIE, e parando quando a modal fecha: cada resposta traz o
    // arquivo inteiro em base64, e trinta de uma vez disputavam a ponte — e
    // continuavam chegando depois de o usuário ter fechado a caixa.
    (async () => {
      for (let i = 0; i < unicos.length; i++) {
        if (!overlay || !overlay.isConnected) return;
        await _pintarUma(overlay, i, caminhoDoArquivo, unicos[i]);
      }
    })();
  }

  async function _pintarUma(overlay, i, caminhoDoArquivo, relativo) {
    const quadro = overlay.querySelector(`.img-item[data-i="${i}"] .img-quadro`);
    if (!quadro) return;

    // O caminho é relativo à PASTA DO ARQUIVO ABERTO, e não à raiz do projeto:
    // é assim que um `src="./logo.png"` significa alguma coisa. ⚠️ A barra
    // do arquivo aberto também é normalizada — um caminho com `\` fazia a
    // "pasta" ser o caminho inteiro, e toda miniatura dizia "não encontrado".
    const pasta = caminhoDoArquivo.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
    const alvo = _normalizar(pasta, relativo);

    const item = quadro.closest('.img-item');
    const dim = item && item.querySelector('.img-dim');
    const botao = item && item.querySelector('[data-img-abrir]');
    try {
      const r = await window.pywebview.api.editor_prever_binario(currentProject, alvo);
      if (!r || !r.success || r.tipo !== 'imagem') {
        quadro.innerHTML = `<span class="img-falta">${
          escapeHtml((r && r.error) || (r && r.aviso) || 'não encontrado')}</span>`;
        return;
      }
      const img = document.createElement('img');
      img.className = 'img-desenho';
      img.alt = relativo;
      // As dimensões só existem depois de o navegador decodificar a imagem.
      // `r.bytes` é o tamanho real no disco (a prévia pode vir reduzida).
      img.addEventListener('load', () => {
        if (!dim) return;
        const kb = r.bytes ? ` · ${Math.max(1, Math.round(r.bytes / 1024))} KB` : '';
        dim.textContent = `${img.naturalWidth}×${img.naturalHeight}${kb}${r.reduzida ? ' · prévia reduzida' : ''}`;
      });
      img.src = r.data_uri;
      quadro.textContent = '';
      quadro.appendChild(img);
      if (botao) { botao.disabled = false; botao.dataset.imgAlvo = alvo; }
    } catch (e) {
      quadro.innerHTML = '<span class="img-falta">não encontrado</span>';
      console.error('[img]', e);
    }
  }

  /** Junta a pasta com o caminho relativo e resolve `.` e `..`. */
  function _normalizar(pasta, relativo) {
    const bruto = relativo.replace(/\\/g, '/');
    // Caminho a partir da raiz do projeto: a pasta do arquivo não entra.
    const partes = (bruto.startsWith('/') ? bruto : `${pasta}/${bruto}`).split('/');
    const pilha = [];
    for (const parte of partes) {
      if (!parte || parte === '.') continue;
      if (parte === '..') { pilha.pop(); continue; }
      pilha.push(parte);
    }
    return pilha.join('/');
  }

  window.imgAbrirModal = imgAbrirModal;

  function _injetarEstilo() {
    if (document.getElementById('img-estilo')) return;
    const estilo = document.createElement('style');
    estilo.id = 'img-estilo';
    estilo.dataset.xt = SLUG;
    // ⚠️ A regra `.img-marca` é a única que entra no `<pre>`, e ela só
    // sublinha: a marca do decorador não pode mudar largura nem altura.
    estilo.textContent = `
      .img-marca { border-bottom: 1px dotted rgba(var(--teal-rgb), 0.7); }

      .img-lista { display: grid; gap: 10px; margin-top: 12px;
                   max-height: 50vh; overflow-y: auto; }
      .img-item { display: flex; align-items: center; gap: 10px; }
      .img-quadro {
        width: 64px; height: 64px; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        background: var(--surface-dark);
        border: 1px solid rgba(var(--white-rgb), 0.06);
        border-radius: var(--radius);
        overflow: hidden;
      }
      .img-desenho { max-width: 100%; max-height: 100%; display: block; }
      .img-espera, .img-falta { font-size: 11px; color: var(--text-muted); text-align: center; }
      .img-falta { color: var(--amber); padding: 4px; }
      .img-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
      .img-caminho { font-size: 12px; color: var(--text-muted); word-break: break-all; }
      .img-dim { font-size: 11px; color: var(--text-muted); }
      .img-abrir { flex-shrink: 0; }`;
    document.head.appendChild(estilo);
  }
})();
