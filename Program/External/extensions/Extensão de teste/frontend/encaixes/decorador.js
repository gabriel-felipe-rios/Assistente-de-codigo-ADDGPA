// ═══════════════════ EXTENSÃO DE TESTE — O ENCAIXE `editor.decorador` ══
// O exemplo mínimo do ponto: uma marca fixa, sempre no mesmo lugar, para dar
// para conferir a olho que decorar, repintar, rolar, desligar e religar fazem
// o que prometem.
//
// O contrato deste ponto está na parte 15 de `Como criar extensões.md`.

(function () {
  // ⚠️ NUNCA escreva o slug nem o ponto à mão — os dois vêm do dataset da tag
  // <script> que o programa injetou, a partir do seu manifesto.
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  xtRegistrarEncaixe(EU.slug, EU.ponto, (contexto) => {
    // Devolver [] é o NORMAL, não uma falha.
    const primeira = contexto.linhas[0];
    if (!primeira) return [];

    return [{
      linha: 1,        // 1-indexado
      coluna: 0,       // 0-indexado, dentro da linha
      // Marca que passa do fim da linha é cortada pelo programa, então não há
      // conta a fazer aqui: seis caracteres, ou o que houver.
      tamanho: 6,
      // ⚠️ A classe TEM de começar pelo prefixo da extensão. O CSS dela está no
      // `<style data-xt>` que o `index.js` injeta.
      classe: 'tst-marca',
      // ⚠️ O `<pre>` tem `pointer-events: none`: este título NUNCA aparece no
      // mouse. Fica só para o DevTools.
      titulo: `Extensão de teste — ${contexto.caminho}`,
    }];
  });
})();
