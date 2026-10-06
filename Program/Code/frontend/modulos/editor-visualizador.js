// ═══════════════════════ EDITOR: VER O QUE NÃO É TEXTO ══
// Imagem em tamanho real, e um cartão para o binário que não é imagem.
//
// ⚠️ É UM IRMÃO DA SUPERFÍCIE, NÃO UM MODO DELA. `criarSuperficie` continua
// existindo e viva por baixo — só escondida. Fazer a superfície "virar"
// visualizador exigiria mexer no `value` do textarea, e isso destrói a pilha de
// desfazer nativa do arquivo de texto que estava aberto ali (o aviso está no
// topo de `editor-superficie.js`). Abrir um PNG e voltar para o `.py` tem que
// devolver o Ctrl+S e o Ctrl+Z de onde estavam.
//
// ⚠️ Por `file://` não existe `<img src="file:///…">` — o WebView2 recusa. A
// imagem chega como data-URI base64 de `editor_prever_binario`. É o mesmo
// caminho que a aba Aparência usa para as miniaturas dela.

function _edVisTamanho(bytes) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

// eslint-disable-next-line no-unused-vars
function criarVisualizador(hospedeiro) {
  const el = document.createElement('div');
  el.className = 'ed-visualizador hidden';
  hospedeiro.appendChild(el);

  return {
    elemento: el,
    esconder() { el.classList.add('hidden'); el.innerHTML = ''; },

    async mostrar(caminho) {
      el.classList.remove('hidden');
      el.innerHTML = '<div class="ed-vis-vazio">Carregando…</div>';
      const r = await window.pywebview.api.editor_prever_binario(currentProject, caminho);
      if (!r.success) {
        el.innerHTML = `<div class="ed-vis-vazio">${escapeHtml(r.error || 'Não deu para abrir.')}</div>`;
        return;
      }
      const nome = caminho.split('/').pop();

      if (r.tipo === 'imagem') {
        el.innerHTML = `
          <div class="ed-vis-imagem-caixa">
            <img class="ed-vis-imagem" alt="${escapeHtml(nome)}" src="${r.data_uri}">
          </div>
          <div class="ed-vis-rodape">
            <span>${escapeHtml(nome)}</span>
            <span class="ed-vis-medidas"></span>
            <span>${_edVisTamanho(r.bytes)}</span>
            ${r.reduzida ? '<span class="ed-vis-aviso">reduzida para caber</span>' : ''}
          </div>`;
        // As medidas só existem depois de a imagem decodificar; `naturalWidth`
        // antes disso é 0.
        const img = el.querySelector('.ed-vis-imagem');
        img.addEventListener('load', () => {
          const m = el.querySelector('.ed-vis-medidas');
          if (m) m.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
        });
        return;
      }

      // Binário que não é imagem. Cartão com o que dá para fazer — nunca um
      // painel em branco, que parece defeito.
      el.innerHTML = `
        <div class="ed-vis-cartao">
          <div class="ed-vis-icone">📦</div>
          <div class="ed-vis-nome">${escapeHtml(nome)}</div>
          <div class="ed-vis-meta">${escapeHtml(r.extensao || '')} · ${_edVisTamanho(r.bytes)}</div>
          <p class="ed-vis-texto">${escapeHtml(r.aviso || 'Este tipo de arquivo não abre no editor.')}</p>
          <div class="ed-vis-acoes">
            <button class="btn btn-muted btn-sm" data-vis="abrir">Abrir no programa padrão</button>
            <button class="btn btn-muted btn-sm" data-vis="revelar">Revelar no Explorador</button>
          </div>
        </div>`;
      el.querySelector('[data-vis="abrir"]').addEventListener('click', async () => {
        const x = await window.pywebview.api.editor_abrir_com_o_programa_padrao(currentProject, caminho);
        if (!x.success) showToast(x.error, true);
      });
      el.querySelector('[data-vis="revelar"]').addEventListener('click', async () => {
        const x = await window.pywebview.api.editor_revelar(currentProject, caminho);
        if (!x.success) showToast(x.error, true);
      });
    },
  };
}
