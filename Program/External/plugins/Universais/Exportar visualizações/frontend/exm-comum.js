(function() {
  window.__exm = window.__exm || {};

  function escapar(texto) {
    if (typeof window.escapeHtml === 'function') {
      return window.escapeHtml(texto);
    }
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(texto).replace(/[&<>"']/g, c => map[c]);
  }

  function chave(texto) {
    let s = String(texto || '');
    s = s.toLowerCase();
    s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return s;
  }

  function nomeDoTema() {
    const link = document.getElementById('tema-css');
    if (!link || !link.href) return '';
    let url = link.href;
    let match = url.match(/\/([^\/?\#]+\.css)(?:\?|$|#)/);
    return match ? match[1] : '';
  }

  function mapaPorId(catalogo, id) {
    for (const mapa of catalogo.mapas || []) {
      if (mapa.id === id) return mapa;
    }
    return null;
  }

  window.__exm.comum = { escapar, chave, nomeDoTema, mapaPorId };
})();
