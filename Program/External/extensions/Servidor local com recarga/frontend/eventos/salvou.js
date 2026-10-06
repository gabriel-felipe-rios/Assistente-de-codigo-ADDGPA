// ══════ SERVIDOR LOCAL COM RECARGA — observador de `editor.salvou` ══
// Um arquivo foi gravado: a página recarrega.
//
// ⚠️ `editor.salvou` e não `editor.vai_salvar`: recarregar ANTES de o arquivo
// ir para o disco mostraria a versão velha. E observador, nunca guardiã —
// recarregar uma página não é razão para o Ctrl+S esperar por ninguém.
//
// O caminho: o backend soma um no relógio da recarga (em memória, em
// `svl_servidor.py`), o servidor o devolve em `/__svl/versao`, e o trecho
// injetado na página compara o número uma vez por segundo.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, evento, guardia }

  xtAssinar(EU.slug, EU.evento, () => {
    if (typeof window.svlChamar !== 'function') return;   // casca já desmontada
    window.svlChamar('salvou');
  }, EU.guardia === '1');
})();
