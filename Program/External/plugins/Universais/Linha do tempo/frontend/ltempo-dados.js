// ═══════════════════ Linha do tempo — o dado, sem nenhum DOM ══
// Módulo irmão de index.js. Registra em `window.__ltempo.dados`.
//
// Este é o único arquivo do plugin que não toca no DOM: só a ponte com o
// backend, datas e formatação. É de propósito — é o que dá para conferir a
// olho sem abrir a tela.

(function () {
  window.__ltempo = window.__ltempo || {};

  const TIPOS = ['criado', 'editado', 'apagado', 'movido'];
  const DOW = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
               'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  async function chamar(caminhoPlugin, acao, extra) {
    try {
      return await window.pywebview.api.chamar_plugin(
        caminhoPlugin, Object.assign({ acao }, extra));
    } catch (e) {
      return { success: false, error: String(e && e.message || e) };
    }
  }

  // ── Datas ───────────────────────────────────────────────────────────────
  // ⚠️ `new Date('2026-08-30')` é interpretado como UTC e, em fuso negativo,
  // volta um dia. Todo dia deste plugin vira Date com 'T00:00:00' colado, que
  // força hora local. E nunca `toISOString()` para voltar a AAAA-MM-DD — ele
  // reintroduz o mesmo deslocamento na volta.

  function paraData(dia) {
    return new Date(String(dia) + 'T00:00:00');
  }

  function paraDia(data) {
    return data.getFullYear() + '-' +
      String(data.getMonth() + 1).padStart(2, '0') + '-' +
      String(data.getDate()).padStart(2, '0');
  }

  function somarDias(dia, n) {
    const d = paraData(dia);
    d.setDate(d.getDate() + n);
    return paraDia(d);
  }

  function distanciaEmDias(de, ate) {
    return Math.round((paraData(ate) - paraData(de)) / 86400000);
  }

  function diaDaSemana(dia) {
    return DOW[paraData(dia).getDay()];
  }

  function fimDeSemana(dia) {
    const d = paraData(dia).getDay();
    return d === 0 || d === 6;
  }

  function diaCurto(dia) {
    const d = paraData(dia);
    return d.getDate() + ' de ' + MES[d.getMonth()];
  }

  function ehPrimeiroDoMes(dia) {
    return paraData(dia).getDate() === 1;
  }

  function rotuloDeMes(dia) {
    const d = paraData(dia);
    return MES[d.getMonth()] + ' ' + d.getFullYear();
  }

  // ── Números e texto ─────────────────────────────────────────────────────

  function numero(n) {
    return (n === null || n === undefined) ? '—' : Number(n).toLocaleString('pt-BR');
  }

  function idade(iso) {
    if (!iso) return '';
    const quando = new Date(iso);
    if (isNaN(quando)) return '';
    const min = Math.round((Date.now() - quando.getTime()) / 60000);
    if (min < 1) return 'agora mesmo';
    if (min < 60) return 'há ' + min + ' min';
    const h = Math.floor(min / 60);
    if (h < 24) return 'há ' + h + 'h';
    return 'há ' + Math.floor(h / 24) + ' dias';
  }

  function escapar(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function nomeCurto(caminho) {
    const partes = String(caminho || '').split('/');
    return partes[partes.length - 1] || String(caminho || '');
  }

  // ── Eventos ─────────────────────────────────────────────────────────────

  function caminhoDoEvento(ev) {
    if (!ev) return '';
    if (ev.tipo === 'movido') return ev.para || '';
    return ev.caminho || '';
  }

  function rotuloDoEvento(ev) {
    if (ev.tipo === 'movido') {
      return escapar(ev.de) + ' <span class="ltempo-fraco">→</span> ' + escapar(ev.para);
    }
    return escapar(ev.caminho);
  }

  // O saldo de linhas de UM evento, já em HTML.
  // ⚠️ Três ausências diferentes, e a tela não pode confundi-las:
  //   binário         → a pergunta não faz sentido  → "—"
  //   linhas ausentes → não sei (arquivo ilegível)  → "?"
  //   delta zero      → mexeu sem mudar o tamanho   → vazio
  function medidaDoEvento(ev) {
    if (ev.binario) return '<span class="ltempo-fraco" title="arquivo binário">—</span>';
    if (ev.tipo === 'movido') return '';
    if (ev.tipo === 'criado') {
      return typeof ev.linhas === 'number'
        ? '<span class="ltempo-ganhas">+' + numero(ev.linhas) + '</span>'
        : '<span class="ltempo-fraco" title="não foi possível contar">?</span>';
    }
    if (ev.tipo === 'apagado') {
      return typeof ev.linhas_antes === 'number'
        ? '<span class="ltempo-perdidas">−' + numero(ev.linhas_antes) + '</span>'
        : '<span class="ltempo-fraco" title="não foi possível contar">?</span>';
    }
    if (ev.tipo === 'editado') {
      if (typeof ev.linhas !== 'number' || typeof ev.linhas_antes !== 'number') {
        return '<span class="ltempo-fraco" title="não foi possível contar">?</span>';
      }
      const delta = ev.linhas - ev.linhas_antes;
      if (delta === 0) return '';
      return delta > 0
        ? '<span class="ltempo-ganhas">+' + numero(delta) + '</span>'
        : '<span class="ltempo-perdidas">−' + numero(-delta) + '</span>';
    }
    return '';
  }

  // `origem: "captura"` quer dizer que o carimbo do arquivo foi recusado (fora
  // da janela entre duas capturas — restauração de backup, unzip, sync) e a
  // data é a da captura que percebeu. Esconder isso faria a tela afirmar uma
  // data que ela não sabe.
  function marcaDeOrigem(ev) {
    if (ev.origem !== 'captura') return '';
    return '<span class="ltempo-fraco" title="O carimbo do arquivo não foi aceito; '
      + 'esta é a data da captura que percebeu">· visto na captura</span>';
  }

  window.__ltempo.dados = {
    TIPOS, chamar,
    paraData, paraDia, somarDias, distanciaEmDias, diaDaSemana, fimDeSemana,
    diaCurto, ehPrimeiroDoMes, rotuloDeMes,
    numero, idade, escapar, nomeCurto,
    caminhoDoEvento, rotuloDoEvento, medidaDoEvento, marcaDeOrigem,
  };
})();
