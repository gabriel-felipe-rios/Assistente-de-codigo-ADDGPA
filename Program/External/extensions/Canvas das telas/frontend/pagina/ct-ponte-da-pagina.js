// ═══════════════════════════════════ CANVAS DAS TELAS — A PONTE DA PÁGINA ══
// Roda DENTRO DA PÁGINA DO USUÁRIO, no iframe de cada tela — nunca no
// programa. Quem a põe lá é o servidor das telas (`backend/ct_servidor.py`),
// na cópia servida; o arquivo em disco não muda.
//
// ⚠️ Por isso não usa `xtMontar` nem `data-xt`: aqui não existe programa.
//
// Por que existe (F30): o navegador isola o canvas de uma página de outro
// endereço — ele não enxerga o que está dentro do iframe. A saída é este
// script conversar com o canvas por mensagens. Toda mensagem, nos dois
// sentidos, é um objeto com `ct: 1` e `tipo`, e só leva posições e chaves.
//
// Recebe: `ola` · `acender` · `limpar`.   Manda: `posicoes` · `navegar` · `esc` · `limpo`.

(function () {
  if (window.__ctPonte) return;
  window.__ctPonte = true;

  var tela = null;
  var origens = [];          // os descritores que o canvas mandou no `ola`
  var interceptar = true;    // desligada só durante o clique do `abrir` (D27)
  var agendado = null;
  var ESPERA_MS = 40;        // no máximo um `posicoes` a cada 40 ms

  function enviar(msg) {
    msg.ct = 1;
    try { window.parent.postMessage(msg, '*'); } catch (e) { /* sem canvas */ }
  }

  // Com `id`, o `id` basta; sem, o elemento de índice `ordem` entre os da
  // mesma tag com o mesmo `atributo` = `valor`.
  function achar(d) {
    if (!d) return null;
    if (d.id) return document.getElementById(d.id);
    if (!d.atributo) return null;
    var n = 0, lista = document.querySelectorAll(d.tag);
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].getAttribute(d.atributo) === d.valor) {
        if (n === d.ordem) return lista[i];
        n++;
      }
    }
    return null;
  }

  function mandarPosicoes() {
    agendado = null;
    if (tela === null) return;
    var itens = [];
    origens.forEach(function (d) {
      var el = achar(d);
      if (!el) return;
      var r = el.getBoundingClientRect();
      itens.push({ chave: d.chave, x: r.left, y: r.top, w: r.width, h: r.height });
    });
    enviar({ tipo: 'posicoes', tela: tela, itens: itens,
             largura: window.innerWidth, altura: window.innerHeight });
  }

  // ⚠️ `setTimeout`, e não `requestAnimationFrame`: o painel embutido não roda
  // quadros de animação com regularidade.
  function agendar() {
    if (agendado !== null) return;
    agendado = setTimeout(mandarPosicoes, ESPERA_MS);
  }

  function acender(chave, cor, ms) {
    var d = origens.filter(function (o) { return o.chave === chave; })[0];
    var el = achar(d);
    if (!el) return;
    var antes = { outline: el.style.outline, offset: el.style.outlineOffset };
    el.style.outline = '4px solid ' + cor;
    el.style.outlineOffset = '2px';
    setTimeout(function () {
      el.style.outline = antes.outline;
      el.style.outlineOffset = antes.offset;
    }, ms || 0);
  }

  function limpar() {
    try { localStorage.clear(); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    try {
      document.cookie.split(';').forEach(function (c) {
        var nome = c.split('=')[0].trim();
        if (nome) document.cookie = nome + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      });
    } catch (e) {}
    var fim = function () { enviar({ tipo: 'limpo', tela: tela }); };
    try {
      if (window.indexedDB && indexedDB.databases) {
        indexedDB.databases().then(function (bancos) {
          bancos.forEach(function (b) { if (b.name) indexedDB.deleteDatabase(b.name); });
          fim();
        }, fim);
        return;
      }
    } catch (e) {}
    fim();
  }

  window.addEventListener('message', function (e) {
    if (e.source !== window.parent) return;
    var m = e.data;
    if (!m || m.ct !== 1) return;
    if (m.tipo === 'ola') {
      tela = m.tela;
      origens = m.origens || [];
      if (m.abrir) {
        var alvo = achar(m.abrir);
        if (alvo) {
          interceptar = false;
          try { alvo.click(); } finally { interceptar = true; }
        }
      }
      mandarPosicoes();
    } else if (m.tipo === 'acender') {
      acender(m.chave, m.cor, m.ms);
    } else if (m.tipo === 'limpar') {
      limpar();
    }
  });

  // O clique numa origem NÃO troca a tela dentro do iframe: quem troca é o
  // canvas (D6). Clique em qualquer outra coisa funciona normal.
  window.addEventListener('click', function (e) {
    if (!interceptar || tela === null || !origens.length) return;
    var mapa = [];
    origens.forEach(function (d) {
      var el = achar(d);
      if (el) mapa.push([el, d.chave]);
    });
    // Do alvo para cima: o primeiro que é origem é o mais de dentro.
    for (var n = e.target; n && n !== document; n = n.parentNode) {
      for (var i = 0; i < mapa.length; i++) {
        if (mapa[i][0] === n) {
          e.preventDefault();
          e.stopImmediatePropagation();
          enviar({ tipo: 'navegar', tela: tela, chave: mapa[i][1] });
          return;
        }
      }
    }
  }, true);

  // O canvas não recebe teclas de dentro do iframe (D40).
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') enviar({ tipo: 'esc', tela: tela });
  }, true);

  window.addEventListener('scroll', agendar, { capture: true, passive: true });
  window.addEventListener('resize', agendar);
  new MutationObserver(agendar).observe(document.documentElement,
    { subtree: true, childList: true, attributes: true });
})();
