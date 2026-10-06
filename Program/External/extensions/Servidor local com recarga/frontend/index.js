// ═══════════════════ SERVIDOR LOCAL COM RECARGA — A CASCA ══
// Na aba Terminal, o seletor "rodar como" (Terminal | Servidor local). Com
// Servidor local, o ▶ Executar sobe um servidor HTTP na pasta do projeto, abre
// o arquivo do caminho no navegador, na Janela escolhida, e a página recarrega
// a cada Ctrl+S.
//
// ⚠️ O SERVIDOR NÃO ESTÁ AQUI, e não sobe ao montar. Ele mora em
// `backend/svl_servidor.py` e nasce como processo gerenciado do programa, só
// no ▶ Executar (`eventos/vai_rodar.js`). Deste lado ficam: as preferências, o
// estado relido da ponte, a escolha "rodar como" de cada projeto e o abrir no
// navegador (serviço do programa, com tamanho).

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug }
  const SLUG = EU.slug;
  const CAMINHO = EU.caminho;
  // `xtBaseUrl` do programa, e não um caminho escrito à mão: é ele que sabe
  // codificar o nome da pasta (espaço, acento, `#`).
  const PASTA = xtBaseUrl(CAMINHO);

  // As medidas de cada Janela. "Livre" sai das opções.
  const SVL_JANELAS = {
    celular: { largura: 375, altura: 812 },
    tablet: { largura: 768, altura: 1024 },
    computador: { largura: 1280, altura: 800 },
  };

  window.svlCaminho = CAMINHO;
  window.svlSlug = SLUG;
  // ⚠️ Os padrões de verdade estão no `config/tela.json`, e o PROGRAMA os
  // devolve resolvidos por `preferencias_da_extensao`. Esta cópia só vale até
  // a ponte responder.
  window.svlPrefs = { porta: 5500, tamanho: 'computador', largura_livre: 900, altura_livre: 800 };
  window.svlEstado = { rodando: false, porta: null, url_base: '', projeto: null, erro: '' };
  // `{projeto: 'terminal'|'servidor'}` — em memória, por projeto, começando em
  // Terminal (fase 09, Pergunte antes nº 3).
  window.svlRodarComo = {};
  // A Janela escolhida agora, na linha do servidor. `null` = a das opções.
  window.svlJanela = null;
  // O endereço do último arquivo aberto — é o que "📋 Copiar endereço" copia.
  window.svlUltimaUrl = '';

  // ⚠️ A FLAG DE MONTADA. Toda continuação assíncrona a confere: o usuário
  // pode desligar no meio de uma ida à ponte, e sem a flag a linha seguinte
  // recriava a global que o `xtDesmontar` acabara de apagar.
  let montada = false;

  window['xtMontar_' + SLUG] = function () {
    montada = true;
    _injetarEstilo();
    _montar();
  };

  // O "Salvar" da tela de configuração vale NA HORA para a Janela, e a porta
  // no próximo ▶ Executar (o backend a lê a cada subida).
  window['xtPreferenciasMudaram_' + SLUG] = function (prefs) {
    if (!montada) return;
    window.svlPrefs = { ...window.svlPrefs, ...(prefs || {}) };
    if (typeof xtPintarEncaixeDoTerminal === 'function') xtPintarEncaixeDoTerminal();
  };

  window['xtDesmontar_' + SLUG] = function () {
    montada = false;
    delete window['xtPreferenciasMudaram_' + SLUG];
    delete window.svlCaminho;
    delete window.svlSlug;
    delete window.svlPrefs;
    delete window.svlEstado;
    delete window.svlRodarComo;
    delete window.svlJanela;
    delete window.svlUltimaUrl;
    delete window.svlChamar;
    delete window.svlLerEstado;
    delete window.svlAbrir;
    delete window.svlTamanho;
    // O `<div>` do encaixe e o `<style data-xt>` o programa remove sozinho; o
    // servidor, o programa derruba (processo gerenciado).
  };

  async function _montar() {
    try {
      const r = await window.pywebview.api.preferencias_da_extensao(CAMINHO);
      if (montada && r && r.success && r.preferencias) {
        window.svlPrefs = { ...window.svlPrefs, ...r.preferencias };
      }
    } catch (e) {
      console.error('[svl] não deu para ler as preferências:', e);
    }
    if (!montada) return;
    await svlLerEstado();
    if (!montada) return;
    // A barra e a linha podem já estar na tela (a aba Terminal aberta quando a
    // extensão ligou): repinta com o que acabou de chegar.
    if (typeof xtPintarEncaixeDoTerminal === 'function') xtPintarEncaixeDoTerminal();
  }

  // ── A ponte, num lugar só ───────────────────────────────────────────────

  async function svlChamar(acao, extras = {}) {
    try {
      const r = await window.pywebview.api.chamar_extensao(CAMINHO, { acao, ...extras });
      if (!r || !r.success) {
        if (r && r.error) console.error('[svl]', r.error);
        return r && r.error ? { success: false, error: r.error } : null;
      }
      return r;
    } catch (e) {
      // ⚠️ `try` e não só `if (!r.success)`: um erro do lado Python rejeita a
      // promessa da ponte, e sem o catch esta função morreria calada.
      console.error('[svl] a ponte falhou:', e);
      return null;
    }
  }

  /**
   * Relê o estado do servidor. ⚠️ A CADA pintura e depois de toda ação — até
   * 23/09/2026 ele era lido uma vez só, ao montar, e a tela mentia.
   * Devolve true quando o estado mudou.
   */
  async function svlLerEstado() {
    const r = await svlChamar('estado');
    if (!montada || !r || !r.success || !r.estado) return false;
    const novo = { rodando: false, porta: null, url_base: '', projeto: null, erro: '', ...r.estado };
    const mudou = JSON.stringify(novo) !== JSON.stringify(window.svlEstado);
    window.svlEstado = novo;
    return mudou;
  }

  /** A Janela escolhida agora: `{largura, altura}`. */
  function svlTamanho() {
    const prefs = window.svlPrefs || {};
    const janela = window.svlJanela || prefs.tamanho || 'computador';
    if (janela === 'livre') {
      const faixa = (v, min, max, padrao) => Math.max(min, Math.min(max, Number(v) || padrao));
      return {
        largura: faixa(prefs.largura_livre, 240, 3840, 900),
        altura: faixa(prefs.altura_livre, 240, 2160, 800),
      };
    }
    return { ...(SVL_JANELAS[janela] || SVL_JANELAS.computador) };
  }

  /**
   * Abre o endereço no navegador, na Janela escolhida. Pelo serviço do
   * programa (`abrir_endereco_no_navegador`), que sabe pedir tamanho.
   */
  async function svlAbrir(url) {
    if (!url) return;
    const { largura, altura } = svlTamanho();
    let r = null;
    try {
      r = await window.pywebview.api.abrir_endereco_no_navegador(url, largura, altura);
    } catch (e) {
      console.error('[svl] não deu para abrir o navegador:', e);
    }
    if (!montada) return;
    if (!r || !r.success) showToast((r && r.error) || 'Não deu para abrir o navegador.', true);
    else if (r.aviso) showToast(r.aviso);
  }

  window.svlChamar = svlChamar;
  window.svlLerEstado = svlLerEstado;
  window.svlTamanho = svlTamanho;
  window.svlAbrir = svlAbrir;

  function _injetarEstilo() {
    if (document.getElementById('svl-estilo')) return;
    const folha = document.createElement('link');
    folha.rel = 'stylesheet';
    // ⚠️ `data-xt` — é por ele que o programa remove o `<link>` ao desligar.
    folha.dataset.xt = SLUG;
    folha.id = 'svl-estilo';
    // O `?t=` fura o cache do WebView2.
    folha.href = `${PASTA}/frontend/svl-estilo.css?t=${Date.now()}`;
    document.head.appendChild(folha);
  }
})();
