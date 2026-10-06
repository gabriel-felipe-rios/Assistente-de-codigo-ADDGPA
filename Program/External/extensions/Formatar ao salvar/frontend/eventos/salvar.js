// ══════════ FORMATAR AO SALVAR — a guardiã de `editor.vai_salvar` ══
// Roda ANTES de o Editor gravar, e devolve o texto formatado. O programa grava
// o que voltou daqui e adota o texto na tela (`_edAdotarTextoDaExtensao`, em
// `editor-salvar.js`), então esta extensão não precisa tocar no Editor.
//
// ⚠️ ELA NÃO BARRA NADA, NUNCA. `barrar` existe no mecanismo, mas um formatador
// que impedisse o Ctrl+S seria a pior extensão possível: o usuário perderia o
// que digitou por causa de um arquivo torto. Arquivo que não dá para formatar
// passa intocado.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, evento, guardia }

  // Extensão de arquivo → como formatar. Fora desta tabela, o arquivo passa.
  //
  // ⚠️ Python está FORA da versão 1, de propósito: formatar Python exige
  // `black` ou `autopep8` instalados no Python do programa, que não está
  // garantido, e a ida ao backend disputaria os 1,5 s da guardiã.
  const FMT_POR_EXTENSAO = {
    js: 'js', mjs: 'js', cjs: 'js', jsx: 'js', ts: 'js', json: 'json',
    css: 'css', scss: 'css', less: 'css',
    html: 'html', htm: 'html',
  };

  function fmtExtensaoDe(caminho) {
    const nome = String(caminho || '').split(/[\\/]/).pop();
    const ponto = nome.lastIndexOf('.');
    return ponto > 0 ? nome.slice(ponto + 1).toLowerCase() : '';
  }

  /**
   * O texto formatado, ou `null` quando não há o que fazer.
   *
   * Devolver `null` é o caso normal — arquivo de outro tipo, biblioteca
   * ausente, arquivo grande demais, texto que já está formatado.
   */
  /**
   * A limpeza que vale para QUALQUER arquivo de texto, sem biblioteca: tirar
   * o espaço no fim das linhas e garantir a quebra de linha final. É o que
   * faz a extensão servir num `.py`, num `.md` ou num `.txt`, e não só nas
   * quatro famílias que têm formatador.
   *
   * ⚠️ Markdown NÃO perde o espaço no fim: dois espaços antes da quebra são
   * "quebra de linha forçada" na sintaxe dele, e tirá-los mudaria o texto.
   */
  function fmtLimpar(texto, ext, prefs) {
    let saida = texto;
    const markdown = ext === 'md' || ext === 'markdown';
    if (prefs.tirar_espacos_no_fim !== false && !markdown) saida = saida.replace(/[ \t]+$/gm, '');
    if (prefs.nova_linha_final !== false && saida.length && !saida.endsWith('\n')) saida += '\n';
    return saida;
  }

  function fmtFormatar(caminho, texto) {
    const prefs = window.fmtPrefs || {};
    const ext = fmtExtensaoDe(caminho);
    const familia = FMT_POR_EXTENSAO[ext];

    // ⚠️ O TETO DE TAMANHO é o que impede a guardiã de estourar os 1,5 s. Um
    // `.js` de 2 MB levaria segundos e o programa gravaria sem formatar de
    // qualquer jeito — só que depois de ter feito o usuário esperar.
    const tetoKb = Number(prefs.teto_kb) || 200;
    if (texto.length > tetoKb * 1024) return null;

    // ⚠️ `Number.isFinite`, e não `Number(x) || 2`: o `||` engole o ZERO. O
    // `tela.json` permite `min: 0`, e quem escolhia "0 espaços" recebia 2
    // sem aviso.
    const recuoLido = Number(prefs.recuo);
    const recuo = Math.max(0, Math.min(8, Number.isFinite(recuoLido) ? recuoLido : 2));

    let saida = texto;
    if (familia && prefs[familia] !== false) {
      if (familia === 'json') {
        // Sem biblioteca nenhuma: `JSON.parse` + `stringify` é o formatador
        // canônico de JSON. ⚠️ Um `.json` inválido faz o `parse` LANÇAR — e a
        // guardiã que lança não barra, o programa grava o arquivo como está.
        // É o comportamento certo, e o console fica com o erro.
        saida = JSON.stringify(JSON.parse(texto), null, recuo);
      } else {
        const funcao = { js: window.js_beautify, css: window.css_beautify,
                         html: window.html_beautify }[familia];
        if (typeof funcao === 'function') {           // biblioteca presente
          saida = funcao(texto, {
            indent_size: recuo,
            indent_with_tabs: false,
            end_with_newline: true,
            preserve_newlines: true,
            max_preserve_newlines: 2,
          });
        }
      }
    }
    // A limpeza vem por cima do formatador — ou sozinha, para os arquivos
    // sem formatador. `null` quando nada mudou, que é o caso normal.
    saida = fmtLimpar(saida, ext, prefs);
    return saida === texto ? null : saida;
  }

  window.fmtFormatar = fmtFormatar;
  // A família do arquivo (`'js'`, `'json'`, `'css'`, `'html'`) ou `''` — a
  // consulta `editor.formatar` (`frontend/consultas/formatar.js`) só responde
  // quando há FORMATADOR para o arquivo. A limpeza de "qualquer texto" (espaço
  // no fim, quebra final) é do Ctrl+S, e fica só nesta guardiã.
  window.fmtFamiliaDe = (caminho) => FMT_POR_EXTENSAO[fmtExtensaoDe(caminho)] || '';

  xtAssinar(EU.slug, EU.evento, (dado) => {
    // A casca ainda não terminou de ler as preferências e carregar a
    // biblioteca: deixar passar é melhor que formatar com o padrão errado.
    if (!window.fmtPronta) return null;

    const limpo = fmtFormatar(dado.arquivo, dado.texto);
    if (limpo === null || limpo === dado.texto) return null;

    // ── reescrever ── o que vai ao disco é o que devolvemos aqui, e não o que
    // está na tela. O programa adota os dois.
    return { dado: { ...dado, texto: limpo } };

  // ⚠️ `=== '1'`, e NUNCA o valor cru: `dataset` só guarda texto, e a string
  // 'false' é verdadeira em JavaScript. Um observador virando guardiã por
  // engano é o defeito mais caro deste mecanismo.
  }, EU.guardia === '1');
})();
