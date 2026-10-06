// ═════════════════════════════════ FORMATAR AO SALVAR — A CASCA ══
// Ctrl+S e o arquivo sai formatado. Sem diálogo, sem pergunta.
//
// A guardiã em si está em `frontend/eventos/salvar.js`. O que esta casca faz é
// preparar as duas coisas que a guardiã NÃO pode ir buscar na hora:
//
//   1. as preferências (`config/preferencias.json`), que o PROGRAMA lê e
//      devolve por `preferencias_da_extensao` — esta extensão não tem
//      `backend/` nenhum desde 05/09/2026: o único trabalho dele era reler
//      esse arquivo, e o programa já faz isso para a tela de configuração;
//   2. o `js-beautify`, que é um `<script>` a carregar.
//
// ⚠️ AS DUAS SÃO CARAS E A GUARDIÃ TEM 1,5 s. Ela roda ANTES de o arquivo ir
// para o disco e o programa espera por ela; estourar o teto faz o programa
// gravar sem formatar e avisar no console — o usuário não vê nada. Ir à ponte
// dentro da guardiã disputaria esse orçamento a cada Ctrl+S, por nada: nem a
// preferência nem a biblioteca mudam entre um salvamento e outro.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug }
  const SLUG = EU.slug;
  const CAMINHO = EU.caminho;
  // ⚠️ `xtBaseUrl` do programa, e não um caminho escrito à mão: é ele que
  // sabe codificar o nome da pasta (espaço, acento, `#`).
  const PASTA = xtBaseUrl(CAMINHO);

  // O que a guardiã lê. Global prefixada porque ela vive noutro arquivo, e o
  // `xtDesmontar` daqui precisa alcançá-la para apagar.
  //
  // ⚠️ Estes valores só valem até a ponte responder — a guardiã pode
  // disparar antes disso. Os padrões de verdade estão no `config/tela.json`,
  // e é de lá que o programa os lê; esta cópia anda junto com ele.
  window.fmtPrefs = {
    js: true, css: true, html: true, json: true,
    recuo: 2,
    teto_kb: 200,
    tirar_espacos_no_fim: true,
    nova_linha_final: true,
  };
  window.fmtPronta = false;

  // ⚠️ A FLAG DE MONTADA. `_montar` tem dois `await`, e o usuário pode
  // desligar a extensão no meio deles. Sem a flag, a linha depois do `await`
  // recriava `window.fmtPronta` que o `xtDesmontar` tinha acabado de apagar —
  // e o `<script>` da biblioteca entrava no `<head>` depois de o desmontar
  // já tê-lo procurado. Toda continuação depois de um `await` confere.
  let montada = false;

  // ⚠️ SÍNCRONA. O programa chama isto logo depois de o script carregar.
  window['xtMontar_' + SLUG] = function () {
    montada = true;
    _montar();   // sem await: montar não pode segurar quem chamou
  };

  // O "Salvar" da tela de configuração vale NA HORA: o programa chama isto
  // com as opções novas, e a próxima guardiã já as lê. Antes exigia religar.
  window['xtPreferenciasMudaram_' + SLUG] = function (prefs) {
    if (montada && window.fmtPrefs) window.fmtPrefs = { ...window.fmtPrefs, ...(prefs || {}) };
  };

  window['xtDesmontar_' + SLUG] = function () {
    montada = false;
    delete window['xtPreferenciasMudaram_' + SLUG];
    // O `<script>` da biblioteca é NOSSO — o programa só remove o `index.js`
    // (pelo id) e as tags com `data-xt`. Sem isto, religar carregaria o
    // js-beautify pela segunda vez.
    const lib = document.getElementById('fmt-lib');
    if (lib) lib.remove();
    delete window.fmtPrefs;
    delete window.fmtPronta;
    delete window.fmtFormatar;
    delete window.fmtFamiliaDe;
    // ⚠️ O js-beautify pendura `js_beautify`/`css_beautify`/`html_beautify` no
    // `window`. Remover a tag não desfaz o que ela já executou.
    ['js_beautify', 'css_beautify', 'html_beautify'].forEach((g) => {
      try { delete window[g]; } catch (_) { /* não configurável: paciência */ }
    });
  };

  async function _montar() {
    await _lerPreferencias();
    if (!montada) return;
    await _carregarBiblioteca();
    if (!montada) return;
    window.fmtPronta = true;
  }

  async function _lerPreferencias() {
    try {
      // Do PROGRAMA: ele já resolve `preferencias.json` por cima dos `padrao`
      // do `tela.json`. Uma ida à ponte, no `xtMontar` — nunca na guardiã.
      const r = await window.pywebview.api.preferencias_da_extensao(CAMINHO);
      if (montada && r && r.success && r.preferencias) {
        window.fmtPrefs = { ...window.fmtPrefs, ...r.preferencias };
      }
    } catch (e) {
      // ⚠️ `try` e não só `if (!r.success)`: um erro do lado Python REJEITA a
      // promessa da ponte, e sem o catch esta função morreria calada — e
      // `fmtPronta` nunca viraria true.
      console.error('[fmt] não deu para ler as preferências:', e);
    }
  }

  /**
   * Carrega a cópia própria do js-beautify.
   *
   * ⚠️ CÓPIA PRÓPRIA, em `frontend/lib/`, e nunca de `External/libraries/`:
   * aquela pasta é do programa e o que tem lá muda (Arquitetura modular ›
   * Exceções). O programa é 100% local — nada aqui vai à internet.
   *
   * A biblioteca pode não estar em disco: veja `frontend/lib/LEIA-ME.md`. Nesse
   * caso a extensão continua funcionando, só que **apenas para JSON** — que é
   * o único formatador que não precisa de biblioteca nenhuma.
   */
  function _carregarBiblioteca() {
    return new Promise((resolve) => {
      if (document.getElementById('fmt-lib')) return resolve();
      const el = document.createElement('script');
      el.id = 'fmt-lib';
      // O `?t=` fura o cache do WebView2 — sem ele, editar o arquivo e religar
      // a extensão traria a versão antiga.
      el.src = `${PASTA}/frontend/lib/beautify.js?t=${Date.now()}`;
      el.onload = () => {
        // Desligada enquanto a biblioteca carregava: a tag não pode ficar.
        if (!montada) el.remove();
        resolve();
      };
      el.onerror = () => {
        el.remove();
        console.warn('[fmt] `frontend/lib/beautify.js` não está na pasta — '
                     + 'só JSON será formatado. Ver frontend/lib/LEIA-ME.md.');
        resolve();
      };
      document.head.appendChild(el);
    });
  }
})();
