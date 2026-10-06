// ═════════════════════ ERRO NA PRÓPRIA LINHA — A CASCA ══
// A linha com erro de sintaxe fica rosada por inteiro. O sublinhado ondulado
// do programa marca o TRECHO; isto marca a LINHA, que é o que se enxerga sem
// procurar.
//
// ⚠️ ELA SE SOBREPÕE AO LINT DO PROGRAMA, de propósito, e é pouco. A fonte é a
// mesma (`editor_erros_de_sintaxe`, o Tree-sitter), e na forma A do ponto
// `editor.decorador` a única coisa que uma extensão pode mudar é a APARÊNCIA do
// trecho — o `title` da marca nunca aparece no mouse, porque o `<pre>` tem
// `pointer-events: none`. A mensagem AO LADO da linha, que é o que faz o
// "Error Lens" do VS Code valer a pena, é a forma B (`editor.margem`), que
// ainda não existe. Está escrito aqui para a decisão de mantê-la ou adiá-la ser
// consciente.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug }
  const SLUG = EU.slug;

  // O que o gancho lê. Global prefixada porque o encaixe vive noutro arquivo.
  //
  // ⚠️ O GANCHO NUNCA VAI AO PYTHON. Ele roda depois de cada pintura — a cada
  // 120 ms de digitação — e tem 150 ms de teto; a ponte não cabe nisso. Quem
  // vai ao Python é o laço abaixo, FORA do gancho, e o gancho responde do que
  // já está aqui.
  window.erlCache = { caminho: null, texto: null, erros: [] };

  let relogio = null;
  let pedindo = false;
  // O contexto que chegou ENQUANTO um pedido estava em voo — ver
  // `erlTalvezPedir`.
  let pendente = null;
  // ⚠️ A FLAG DE MONTADA. A resposta do Tree-sitter chega depois de um
  // `await`, e o usuário pode ter desligado a extensão nesse meio-tempo. Sem
  // a flag, a continuação recriava `window.erlCache` que o `xtDesmontar`
  // acabara de apagar.
  let montada = false;

  // O mesmo debounce do lint do programa (`editor-lint.js`), e pelo mesmo
  // motivo: cada pedido é um reparse do arquivo inteiro pelo Tree-sitter.
  const ERL_ESPERA_MS = 400;

  // Os padrões de fábrica — os mesmos do `config/tela.json`, de onde o
  // programa lê o que o usuário escolheu (`xtPreferenciasDe`).
  const ERL_PADRAO = { cor: 'red', intensidade: 10 };
  const ERL_CORES = ['red', 'amber', 'purple', 'blue', 'teal', 'green'];

  function _prefs() {
    const lidas = (typeof xtPreferenciasDe === 'function' && xtPreferenciasDe(SLUG)) || {};
    return { ...ERL_PADRAO, ...lidas };
  }

  window['xtMontar_' + SLUG] = function () {
    montada = true;
    _injetarEstilo();
  };

  window['xtDesmontar_' + SLUG] = function () {
    montada = false;
    clearTimeout(relogio);
    pendente = null;
    delete window.erlCache;
    delete window.erlTalvezPedir;
    delete window.erlAbrirModal;
    delete window['xtPreferenciasMudaram_' + SLUG];
    // O `<style>` sai pelo `data-xt`; as marcas o programa desembrulha.
  };

  /**
   * A lista dos erros do arquivo, com "ir para a linha".
   *
   * ⚠️ É AQUI que a mensagem do erro aparece — na marca ela nunca aparece,
   * porque o `<pre>` tem `pointer-events: none` e o `title` não sobe ao
   * mouse. A modal é o que a forma A do decorador permite; a mensagem ao lado
   * da linha é a forma B, que ainda não existe.
   */
  function erlAbrirModal(caminho) {
    const cache = window.erlCache || {};
    const erros = (cache.caminho === caminho) ? (cache.erros || []) : [];
    if (!erros.length) { showToast('Nenhum erro de sintaxe neste arquivo.'); return; }

    const itens = erros.slice(0, 200).map((e) => {
      const linha = Number(e.linha) || 0;
      const detalhe = String(e.mensagem || e.tipo || e.trecho || '').split('\n')[0].trim().slice(0, 140);
      return `<div class="erl-item">
        <button type="button" class="btn btn-muted btn-sm" data-erl-ir="${linha}">linha ${linha}</button>
        <code class="erl-trecho">${escapeHtml(detalhe) || '—'}</code>
      </div>`;
    }).join('');

    // ⛔ `abrirModalPadrao`, nunca `alert()`: o nativo é do sistema e trava a
    // janela.
    const overlay = abrirModalPadrao({
      title: `Erros de sintaxe — ${erros.length}`,
      bodyHtml: `<div class="modal-body-text">Em <strong>${escapeHtml(caminho)}</strong>,
        pelo Tree-sitter do programa.${erros.length > 200 ? ' Mostrando os 200 primeiros.' : ''}</div>
        <div class="erl-lista">${itens}</div>`,
      confirmLabel: 'Fechar',
      semCancelar: true,
      onConfirm: () => true,
    });
    overlay.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-erl-ir]');
      if (!b) return;
      const alvo = (typeof edArquivoAberto === 'function') ? edArquivoAberto(caminho) : null;
      overlay.remove();
      if (alvo) await alvo.irParaLinha(Number(b.dataset.erlIr));
    });
  }

  window.erlAbrirModal = erlAbrirModal;

  // O "Salvar" da tela de configuração vale NA HORA: a cor e a intensidade
  // moram no `<style>`, e ele é reescrito aqui.
  window['xtPreferenciasMudaram_' + SLUG] = function () {
    if (montada) _injetarEstilo();
  };

  /**
   * Chamada de DENTRO do gancho, mas nunca espera: se o arquivo ou o texto
   * mudaram desde a última resposta, agenda uma ida ao Python e volta na hora.
   *
   * ⚠️ É este o desenho que a parte 15 do contrato descreve para quem depende
   * de uma fonte cara. A resposta chega depois e chama `xtPedirDecoracao()`,
   * que refaz a decoração sem esperar a próxima tecla.
   *
   * ⚠️ Um contexto que chega com um pedido EM VOO não é descartado: fica em
   * `pendente`, e é pedido assim que a resposta anterior voltar. Descartá-lo
   * deixava a marca presa numa versão velha do texto até a próxima pintura —
   * que, num arquivo parado depois de uma colagem grande, pode não vir.
   */
  function erlTalvezPedir(contexto) {
    const cache = window.erlCache;
    if (!cache || !montada) return;
    if (cache.caminho === contexto.caminho && cache.texto === contexto.texto) return;
    if (pedindo) { pendente = contexto; return; }

    clearTimeout(relogio);
    relogio = setTimeout(async () => {
      pedindo = true;
      pendente = null;
      const caminho = contexto.caminho;
      const texto = contexto.texto;
      let erros = [];
      try {
        const r = await window.pywebview.api.editor_erros_de_sintaxe(
          contexto.projeto, caminho, texto);
        erros = (r && r.success && Array.isArray(r.erros)) ? r.erros : [];
      } catch (e) {
        // Linguagem sem parser, projeto sem nada — o caso normal é lista
        // vazia, e não erro. Guarda vazio para não repetir o pedido em laço.
        console.error('[erl]', e);
      }
      pedindo = false;
      if (!montada) return;
      window.erlCache = { caminho, texto, erros };
      if (typeof xtPedirDecoracao === 'function') xtPedirDecoracao();
      // O texto mudou de novo enquanto o Tree-sitter respondia: pede o novo.
      if (pendente) { const proximo = pendente; pendente = null; erlTalvezPedir(proximo); }
    }, ERL_ESPERA_MS);
  }

  window.erlTalvezPedir = erlTalvezPedir;

  function _injetarEstilo() {
    // Religar não duplica; o "Salvar" reescreve o mesmo `<style>`.
    let estilo = document.getElementById('erl-estilo');
    if (!estilo) {
      estilo = document.createElement('style');
      estilo.id = 'erl-estilo';
      estilo.dataset.xt = SLUG;
      document.head.appendChild(estilo);
    }
    const prefs = _prefs();
    const cor = ERL_CORES.includes(prefs.cor) ? prefs.cor : ERL_PADRAO.cor;
    const lida = Number(prefs.intensidade);
    const intensidade = Math.max(4, Math.min(40, Number.isFinite(lida) ? lida : ERL_PADRAO.intensidade));
    // ⚠️ SÓ FUNDO. Nada de `padding`, `border` lateral ou `font-*`: o `<pre>` é
    // o espelho caractere a caractere do `<textarea>`, e qualquer um dos três
    // desalinharia o cursor a partir dali.
    //
    // Fraco por padrão (10%): o sublinhado ondulado vermelho do lint do
    // programa continua por cima, e ele é quem aponta o trecho exato. A cor é
    // um TOKEN do tema, nunca hexadecimal.
    estilo.textContent = `
      .erl-linha { background: rgba(var(--${cor}-rgb), ${(intensidade / 100).toFixed(2)}); }
      /* A modal da lista de erros — fora do <pre>, então pode ter medida. */
      .erl-lista { display: grid; gap: 6px; margin-top: 12px; max-height: 50vh; overflow-y: auto; }
      .erl-item { display: flex; align-items: center; gap: 10px; }
      .erl-trecho { font-size: 12px; color: var(--text-muted); word-break: break-all; }`;
  }
})();
