// ══════ SERVIDOR LOCAL COM RECARGA — guardiã de `terminal.vai_rodar` ══
// Com "rodar como" Servidor local, ela ASSUME o ▶ Executar: o Terminal não
// roda nada, e o servidor sobe na pasta do projeto e abre o arquivo do caminho
// no navegador. Com Terminal, devolve `null` e o Terminal segue normal.
//
// Sem isto, um `.html` ia para o Chrome em `file:///` pela associação do
// Windows — a página em branco.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, evento, guardia }

  xtAssinar(EU.slug, EU.evento, (dado) => {
    if (typeof window.svlChamar !== 'function') return null;                        // casca desmontada
    if (!dado || (window.svlRodarComo || {})[dado.projeto] !== 'servidor') return null;   // Terminal: segue normal
    // ⚠️ NÃO espera a subida: a guardiã tem 1,5 s de teto, e estourar o teto
    // faria o Terminal rodar o .html pelo Windows (a página em branco de novo).
    _subirEAbrir(dado.projeto, dado.caminho);
    return { dado: { ...dado, assumido_por: 'Servidor local com recarga', selo: 'servindo' } };
  }, EU.guardia === '1');

  async function _subirEAbrir(projeto, caminho) {
    const r = await window.svlChamar('subir', { projeto, caminho });
    if (typeof window.svlLerEstado !== 'function') return;          // desligada no meio
    await window.svlLerEstado();
    if (typeof window.svlAbrir !== 'function') return;
    if (r && r.success && r.url) {
      window.svlUltimaUrl = r.url;
      window.svlAbrir(r.url);
    } else if (r && r.error && typeof showToast === 'function') {
      // A porta ocupada fica também na linha (`svlEstado.erro`); o erro que
      // não é de porta (arquivo fora da pasta, projeto sem pasta) só tem o toast.
      showToast(r.error, true);
    }
    if (typeof xtPintarEncaixeDoTerminal === 'function') xtPintarEncaixeDoTerminal();
  }
})();
