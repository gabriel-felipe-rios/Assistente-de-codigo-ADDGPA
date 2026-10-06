// ═══════════════════════════════════ CANVAS DAS TELAS — A PONTE COM AS PÁGINAS ══
// O canvas não enxerga dentro do iframe de outro endereço (F30): tudo o que
// acontece nas telas chega por mensagem, vindo de
// `frontend/pagina/ct-ponte-da-pagina.js`, que o servidor injeta na cópia
// servida de cada página. Toda mensagem é `{ct: 1, tipo, …}`.

(function () {
  const ACENDER_MS = 1800;
  const LIMPAR_TETO_MS = 2000;
  const montada = () => typeof window.ctMontada === 'function' && window.ctMontada();
  const janelas = new Map();     // contentWindow → id da tela
  const iframes = new Map();     // id da tela → iframe

  function origemDoServidor() {
    const s = window.ctEstado.servidor;
    if (!s || !s.url_base) return null;
    try { return new URL(s.url_base).origin; } catch (e) { return null; }
  }

  function telaDe(id) {
    const l = window.ctEstado.leitura;
    return ((l && l.telas) || []).find(t => t.id === id) || null;
  }

  // Os elementos de origem das ligações que SAEM desta tela, sem repetir.
  function origensDe(id) {
    const l = window.ctEstado.leitura;
    const vistas = new Set(), saida = [];
    ((l && l.ligacoes) || []).forEach(lig => {
      if (lig.de !== id || vistas.has(lig.origem.chave)) return;
      vistas.add(lig.origem.chave);
      saida.push(lig.origem);
    });
    return saida;
  }

  function corDasSetas() {
    const c = window.ctEstado.container && window.ctEstado.container.querySelector('#ct-canvas');
    return (c && getComputedStyle(c).getPropertyValue('--ct-seta-cor').trim()) || 'currentColor';
  }

  function mandar(id, msg) {
    const f = iframes.get(id), origem = origemDoServidor();
    if (!f || !f.contentWindow || !origem) return;
    msg.ct = 1;
    try { f.contentWindow.postMessage(msg, origem); } catch (e) { /* a página ainda não é do servidor */ }
  }

  window.ctPonteRegistrar = function (id, iframe) {
    iframes.set(id, iframe);
    if (iframe.contentWindow) janelas.set(iframe.contentWindow, id);
    iframe.addEventListener('load', () => {
      if (!montada() || iframes.get(id) !== iframe) return;
      if (!iframe.src || iframe.src === 'about:blank') return;
      janelas.set(iframe.contentWindow, id);
      const t = telaDe(id);
      // Aba e modal: a página aperta o abridor sozinha, uma vez (D27).
      mandar(id, { tipo: 'ola', tela: id, origens: origensDe(id),
                   abrir: t && t.tipo !== 'pagina' ? t.abridor : null, cor: corDasSetas() });
    });
  };

  window.ctAcender = function (tela, chave, cor) {
    mandar(tela, { tipo: 'acender', chave, cor: cor || corDasSetas(), ms: ACENDER_MS });
  };

  // Apaga o armazenamento do navegador e os cookies do endereço das telas
  // (D45): uma página escondida do próprio servidor faz a limpeza.
  window.ctLimparArmazenamento = function () {
    return new Promise(resolve => {
      const e = window.ctEstado, s = e.servidor;
      if (!s || !e.container) { resolve(); return; }
      const f = document.createElement('iframe');
      f.className = 'hidden';
      let feito = false;
      const fim = () => {
        if (feito) return;
        feito = true;
        clearTimeout(teto);
        f.remove();
        resolve();
      };
      const teto = setTimeout(fim, LIMPAR_TETO_MS);
      f.addEventListener('load', fim);
      f.src = s.url_base + '__ct/limpar';
      e.container.appendChild(f);
    });
  };

  function aoMensagem(ev) {
    const m = ev.data;
    if (!m || m.ct !== 1) return;
    if (!montada() || ev.origin !== origemDoServidor()) return;
    const id = janelas.get(ev.source);
    if (!id || !iframes.get(id) || iframes.get(id).contentWindow !== ev.source) return;
    const e = window.ctEstado;
    if (m.tipo === 'posicoes') {
      e.posicoesDe[id] = m;
      if (typeof window.ctAoMudarPosicoes === 'function') window.ctAoMudarPosicoes(id);
    } else if (m.tipo === 'navegar') {
      const lig = ((e.leitura && e.leitura.ligacoes) || []).find(l => l.de === id && l.origem.chave === m.chave);
      if (lig && typeof window.ctNavegar === 'function') window.ctNavegar(lig);
    } else if (m.tipo === 'esc') {
      if (typeof window.ctSair === 'function') window.ctSair();
    }
  }
  window.addEventListener('message', aoMensagem);
  window.ctEstado.ouvintes.push([window, 'message', aoMensagem]);
})();
