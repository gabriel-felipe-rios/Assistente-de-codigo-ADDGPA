// ═══════════════════════ GLOSSÁRIO NO CÓDIGO — A CASCA ══
// Um termo que o Vocabulário do projeto já decidiu aparece sublinhado. Um
// sinônimo que ele proibiu aparece riscado.
//
// A fonte é `Saída das skills/Terminologia e nomenclatura/Vocabulário.md`, do
// PROJETO ABERTO — não do programa. Nem todo projeto tem um, e isso é o
// normal: sem Vocabulário, a extensão fica quieta.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug }
  const SLUG = EU.slug;
  const CAMINHO = EU.caminho;

  // O que o gancho lê: duas expressões regulares já compiladas, e nada mais.
  //
  // ⚠️ O GANCHO NUNCA VAI AO PYTHON. Ele roda depois de cada pintura e tem
  // 150 ms de teto. O Vocabulário é lido UMA vez, quando o projeto abre.
  window.gloRegex = { termos: null, proibidos: null, projeto: null };

  // ⚠️ A FLAG DE MONTADA: a resposta da ponte chega depois de um `await`, e
  // o usuário pode ter desligado a extensão no meio. Sem a flag, a
  // continuação recriava `window.gloRegex` que o `xtDesmontar` apagou.
  let montada = false;

  window['xtMontar_' + SLUG] = function () {
    montada = true;
    _injetarEstilo();
    // Ligar com um projeto já aberto tem de carregar agora: o evento
    // `projeto.abriu` já passou.
    if (typeof currentProject !== 'undefined' && currentProject) gloCarregar(currentProject);
  };

  window['xtDesmontar_' + SLUG] = function () {
    montada = false;
    delete window.gloRegex;
    delete window.gloCarregar;
    delete window.gloPrefs;
    delete window.gloAbrirModal;
    delete window['xtPreferenciasMudaram_' + SLUG];
  };

  // Os padrões de fábrica — os mesmos do `config/tela.json`, de onde o
  // programa lê o que o usuário escolheu (`xtPreferenciasDe`).
  const GLO_PADRAO = { marcar_termos: true, riscar_proibidos: true, ignorar_maiusculas: false, teto: 400 };

  function gloPrefs() {
    const lidas = (typeof xtPreferenciasDe === 'function' && xtPreferenciasDe(SLUG)) || {};
    return { ...GLO_PADRAO, ...lidas };
  }
  window.gloPrefs = gloPrefs;

  // O "Salvar" vale NA HORA. "Ignorar maiúsculas" muda a expressão, então
  // ela é remontada; o resto o encaixe lê a cada pintura.
  window['xtPreferenciasMudaram_' + SLUG] = function () {
    if (!montada) return;
    if (typeof currentProject !== 'undefined' && currentProject) gloCarregar(currentProject);
    else if (typeof xtPedirDecoracao === 'function') xtPedirDecoracao();
  };

  /**
   * Monta UMA expressão regular para a lista inteira.
   *
   * ⚠️ `\b` NÃO SERVE AQUI. O `\b` do JavaScript conhece `[A-Za-z0-9_]` e mais
   * nada: `\bfunção\b` casaria no meio de `subfunção`, porque `ç` já é
   * fronteira para ele. A alternativa que funciona é olhar o caractere de
   * antes e o de depois com `\p{L}` e `\p{N}` e a flag `u`, que o WebView2
   * aceita.
   *
   * ⚠️ E ela NÃO DOBRA GRAFIA: `funcao` não acha `função`. Quem quer as duas
   * registra as duas no Vocabulário.
   */
  function _regexDaLista(palavras) {
    const limpas = [...new Set(palavras)].filter(Boolean);
    if (!limpas.length) return null;
    // Mais longas primeiro: senão `projeto` casaria dentro de `projeto_nome` e
    // a alternância pararia ali.
    limpas.sort((a, b) => b.length - a.length);
    const escapadas = limpas.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    // `i` só quando o usuário pediu: por padrão "Fila" e "fila" são coisas
    // diferentes, que é como o Vocabulário distingue a entidade da prosa.
    const flags = gloPrefs().ignorar_maiusculas ? 'giu' : 'gu';
    try {
      return new RegExp(
        `(?<![\\p{L}\\p{N}_])(?:${escapadas.join('|')})(?![\\p{L}\\p{N}_])`, flags);
    } catch (e) {
      // `lookbehind` ou `\p{…}` indisponíveis: a extensão fica quieta em vez de
      // explodir a cada pintura.
      console.error('[glo] o navegador não aceitou a expressão:', e);
      return null;
    }
  }

  async function gloCarregar(projeto) {
    if (!montada) return;
    window.gloRegex = { termos: null, proibidos: null, projeto };
    if (!projeto) return;
    try {
      const r = await window.pywebview.api.chamar_extensao(CAMINHO, {
        acao: 'vocabulario', projeto,
      });
      // ⚠️ A resposta pode ser de um projeto que já não é o aberto: duas
      // trocas rápidas de projeto disparam duas cargas, e a ÚLTIMA a
      // responder venceria — mesmo sendo a do projeto antigo. Só vale se o
      // `projeto` ainda for o que está em `gloRegex`, e se ainda está montada.
      if (!montada || !window.gloRegex || window.gloRegex.projeto !== projeto) return;
      if (!r || !r.success) return;
      window.gloRegex = {
        projeto,
        termos: _regexDaLista(r.termos || []),
        proibidos: _regexDaLista(r.proibidos || []),
        // Para a modal: o que cada proibido deveria ser.
        sugestoes: r.sugestoes || {},
      };
      // O arquivo aberto tem de ganhar os sublinhados agora, sem esperar a
      // próxima tecla.
      if (typeof xtPedirDecoracao === 'function') xtPedirDecoracao();
    } catch (e) {
      console.error('[glo] a ponte falhou:', e);
    }
  }

  window.gloCarregar = gloCarregar;

  /**
   * "Vocabulário neste arquivo…": o que está riscado e o que deveria ser, e
   * os termos encontrados — com "ir para a linha". É onde a sugestão
   * aparece: a marca só risca, porque o `<pre>` não mostra `title` no mouse.
   */
  function gloAbrirModal(caminho) {
    const fonte = window.gloRegex;
    const alvo = (typeof edArquivoAberto === 'function') ? edArquivoAberto(caminho) : null;
    if (!fonte || (!fonte.termos && !fonte.proibidos)) { showToast('Este projeto não tem Vocabulário.'); return; }
    if (!alvo) { showToast('Abra o arquivo no Editor primeiro.'); return; }
    const texto = alvo.texto;

    // Conta as ocorrências por palavra casada, e guarda a linha da primeira.
    const contar = (regex) => {
      const por = new Map();
      if (!regex) return por;
      regex.lastIndex = 0;
      let m;
      let linha = 1;
      let pos = 0;
      while ((m = regex.exec(texto)) !== null) {
        if (m[0].length === 0) { regex.lastIndex++; continue; }
        while (pos < m.index) { if (texto[pos] === '\n') linha++; pos++; }
        const chave = m[0];
        const e = por.get(chave) || { vezes: 0, linha };
        e.vezes++;
        por.set(chave, e);
        if (por.size > 500) break;
      }
      return por;
    };
    const proibidos = contar(fonte.proibidos);
    const termos = contar(fonte.termos);
    if (!proibidos.size && !termos.size) { showToast('Nenhum termo do Vocabulário neste arquivo.'); return; }

    const linhaDe = (palavra, e, sugestao) => `
      <div class="glo-item">
        <button type="button" class="btn btn-muted btn-sm" data-glo-ir="${e.linha}">linha ${e.linha}</button>
        <code>${escapeHtml(palavra)}</code>
        <span class="glo-vezes">${e.vezes}×</span>
        ${sugestao ? `<span class="glo-use">→ use <code>${escapeHtml(sugestao)}</code></span>` : ''}
      </div>`;
    const ordenar = (por) => [...por.entries()].sort((a, b) => b[1].vezes - a[1].vezes);
    const blocoProibidos = proibidos.size ? `
      <div class="glo-titulo">Sinônimos proibidos (${proibidos.size})</div>
      ${ordenar(proibidos).slice(0, 60).map(([p, e]) => linhaDe(p, e, (fonte.sugestoes || {})[p])).join('')}` : '';
    const blocoTermos = termos.size ? `
      <div class="glo-titulo">Termos do Vocabulário (${termos.size})</div>
      ${ordenar(termos).slice(0, 60).map(([t, e]) => linhaDe(t, e, '')).join('')}` : '';

    const overlay = abrirModalPadrao({
      title: 'Vocabulário neste arquivo',
      bodyHtml: `<div class="modal-body-text">Em <strong>${escapeHtml(caminho)}</strong>,
        contra o Vocabulário de <strong>${escapeHtml(fonte.projeto || '')}</strong>.</div>
        <div class="glo-lista">${blocoProibidos}${blocoTermos}</div>`,
      confirmLabel: 'Fechar',
      semCancelar: true,
      onConfirm: () => true,
    });
    overlay.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-glo-ir]');
      if (!b) return;
      overlay.remove();
      await alvo.irParaLinha(Number(b.dataset.gloIr));
    });
  }

  window.gloAbrirModal = gloAbrirModal;

  function _injetarEstilo() {
    if (document.getElementById('glo-estilo')) return;
    const estilo = document.createElement('style');
    estilo.id = 'glo-estilo';
    estilo.dataset.xt = SLUG;
    // ⚠️ `text-decoration` e `border-bottom`, que não mudam métrica. Nada de
    // `padding`, `font-weight` ou `border` lateral: o `<pre>` é o espelho do
    // `<textarea>` caractere a caractere.
    estilo.textContent = `
      .glo-termo { border-bottom: 1px dotted rgba(var(--teal-rgb), 0.7); }
      .glo-proibido {
        text-decoration: line-through;
        text-decoration-color: rgba(var(--red-rgb), 0.8);
      }
      /* A modal — fora do <pre>, então pode ter medida. */
      .glo-lista { display: grid; gap: 6px; margin-top: 12px; max-height: 50vh; overflow-y: auto; }
      .glo-titulo { font-size: 12px; color: var(--text-muted); margin-top: 8px; text-transform: uppercase; letter-spacing: .04em; }
      .glo-item { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .glo-vezes { font-size: 12px; color: var(--text-muted); }
      .glo-use { font-size: 12px; color: var(--amber); }`;
    document.head.appendChild(estilo);
  }
})();
