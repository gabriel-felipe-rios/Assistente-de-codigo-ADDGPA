// ══════════════════════ CSV COLORIDO POR COLUNA — A CASCA ══
// Abriu um `.csv`: cada coluna numa cor. A vírgula deixa de ser uma parede de
// texto e vira uma tabela que se lê de relance.
//
// Esta casca só injeta o `<style>` das seis classes. Quem decide o que marcar é
// `frontend/encaixes/decorador.js`.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug }
  const SLUG = EU.slug;

  window['xtMontar_' + SLUG] = function () {
    _injetarEstilo();
  };

  window['xtDesmontar_' + SLUG] = function () {
    // O `<style>` o programa remove pelo `data-xt`, e as marcas ele desembrulha
    // sozinho (`descarregar.js` chama `xtDesdecorarTudo` antes de tirar o
    // encaixe do registro). Não sobra nada nosso.
  };

  function _injetarEstilo() {
    // ⚠️ Religar não pode duplicar.
    if (document.getElementById('csv-estilo')) return;
    const estilo = document.createElement('style');
    estilo.id = 'csv-estilo';
    // ⚠️ É por `data-xt`, e só por ele, que o programa remove este `<style>`.
    estilo.dataset.xt = SLUG;
    // ⚠️ AS SEIS CORES SÃO TOKENS DO TEMA, nunca hexadecimal — as mesmas seis
    // do "Destacar extensões" do programa. O valor real sai do tema em
    // execução, e fica legível nos cinco, inclusive no claro.
    //
    // ⚠️ SÓ `color`. A marca do decorador não pode mudar largura nem altura: o
    // `<pre>` é o espelho caractere a caractere do `<textarea>`, e um `padding`
    // ou um `font-weight` diferente desalinharia o cursor do texto.
    estilo.textContent = `
      .csv-c0 { color: var(--purple); }
      .csv-c1 { color: var(--blue); }
      .csv-c2 { color: var(--green); }
      .csv-c3 { color: var(--amber); }
      .csv-c4 { color: var(--red); }
      .csv-c5 { color: var(--teal); }
      /* O cabeçalho: um pontilhado embaixo. border-bottom não muda métrica. */
      .csv-cab { border-bottom: 1px dotted currentColor; }`;
    document.head.appendChild(estilo);
  }
})();
