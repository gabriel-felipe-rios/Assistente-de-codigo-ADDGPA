// ═══════════════════════ EDITOR: ERRO DE SINTAXE NA LINHA (Obra 12) ══
// Sublinhado ondulado (`.lint-err`) sobre o trecho que o Tree-sitter marcou
// como `ERROR`/`MISSING` — `editor_erros_de_sintaxe` (backend/modulos/editor.py)
// reusa o MESMO `make_parser` que já alimenta a sub-aba Tree-sitter da aba
// Análise. Cobre só erro de SINTAXE, nunca semântica.
//
// ⚠️ MARCA NOS NÓS DE TEXTO JÁ RENDERIZADOS, nunca na string de HTML — o
// mesmo molde de `editor-localizar.js` (Ctrl+F), pelo mesmo motivo: mexer no
// HTML cortaria as tags que o Prism acabou de criar. Por isso os erros somem
// a cada pintura e precisam de `reaplicar()` no fim de cada uma — ver
// `editor-painel.js`, que já faz o mesmo para o localizador.

// eslint-disable-next-line no-unused-vars
function criarLint(superficie) {
  let erros = [];
  let relogio = null;

  function marcarNoPre() {
    if (!erros.length) return;
    erros.forEach((e) => { e._feito = false; });
    const porLinha = new Map();
    erros.forEach((e) => {
      if (!porLinha.has(e.linha)) porLinha.set(e.linha, []);
      porLinha.get(e.linha).push(e);
    });

    const caminhante = document.createTreeWalker(superficie.pre, NodeFilter.SHOW_TEXT);
    const nos = [];
    while (caminhante.nextNode()) nos.push(caminhante.currentNode);

    let linha = 1;
    let coluna = 0;
    nos.forEach((no) => {
      const texto = no.nodeValue;
      if (!texto) return;
      const temNestaLinha = porLinha.has(linha);
      if (!temNestaLinha && !texto.includes('\n')) { coluna += texto.length; return; }

      const frag = document.createDocumentFragment();
      let i = 0;
      let mudou = false;
      while (i < texto.length) {
        const doLista = porLinha.get(linha);
        const erro = doLista && doLista.find((e) => !e._feito && e.coluna >= coluna
          && e.coluna < coluna + (texto.length - i));
        const proximaQuebra = texto.indexOf('\n', i);
        if (erro) {
          mudou = true;
          const inicioLocal = i + (erro.coluna - coluna);
          const limiteDaLinha = proximaQuebra === -1 ? texto.length : proximaQuebra;
          const fimLocal = Math.min(limiteDaLinha,
            inicioLocal + Math.max(1, ((erro.trecho || '').split('\n')[0] || '').length));
          if (inicioLocal > i) frag.appendChild(document.createTextNode(texto.slice(i, inicioLocal)));
          const span = document.createElement('span');
          span.className = 'lint-err';
          span.title = `Erro de sintaxe${erro.trecho ? ` — "${erro.trecho.split('\n')[0].trim()}"` : ''}`;
          span.textContent = texto.slice(inicioLocal, fimLocal);
          frag.appendChild(span);
          erro._feito = true;
          coluna += fimLocal - i;
          i = fimLocal;
          continue;
        }
        if (proximaQuebra === -1) {
          frag.appendChild(document.createTextNode(texto.slice(i)));
          coluna += texto.length - i;
          i = texto.length;
        } else {
          frag.appendChild(document.createTextNode(texto.slice(i, proximaQuebra + 1)));
          linha += 1;
          coluna = 0;
          i = proximaQuebra + 1;
        }
      }
      if (mudou) no.parentNode.replaceChild(frag, no);
    });
  }

  async function pedir(caminho) {
    const ligado = typeof appSettings === 'undefined' || appSettings.editor_lint_sintaxe !== false;
    if (!ligado || !caminho) { erros = []; return; }
    try {
      const r = await window.pywebview.api.editor_erros_de_sintaxe(currentProject, caminho, superficie.texto);
      erros = (r && r.success) ? r.erros : [];
    } catch (_) {
      erros = [];
    }
  }

  return {
    // Debounce próprio — bem mais pesado que a pintura (reparse Tree-sitter
    // do arquivo inteiro a cada chamada), então não compartilha o relógio de
    // `editor-pintura.js`.
    aoDigitar(caminho) {
      clearTimeout(relogio);
      relogio = setTimeout(async () => { await pedir(caminho); marcarNoPre(); }, 400);
    },
    async abrir(caminho) {
      clearTimeout(relogio);
      erros = [];
      await pedir(caminho);
      marcarNoPre();
    },
    // Chamado no fim de CADA pintura (mesmo gancho do Ctrl+F) — sem isto o
    // sublinhado sumiria a cada tecla, já que o `<pre>` é reconstruído.
    reaplicar: marcarNoPre,
    limpar() { erros = []; },
  };
}
