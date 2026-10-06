// ══════ TINGIR A JANELA — observador de `projeto.abriu` ══
// Entrou num projeto: a cor dele volta sozinha.
//
// ⚠️ OBSERVADOR, nunca guardiã. Ele reage DEPOIS da ação e não segura ninguém:
// uma extensão de enfeite que pudesse atrasar a abertura de um projeto seria
// exatamente o tipo de coisa que o mecanismo de guardiã existe para evitar.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, evento, guardia }

  xtAssinar(EU.slug, EU.evento, (dado) => {
    // A casca pode já ter sido desmontada — o programa tira as assinaturas
    // do registro antes do `xtDesmontar`, mas um aviso em voo ainda chega.
    if (typeof window.tinAplicar !== 'function') return;
    window.tinAplicar(dado && dado.projeto);
  }, EU.guardia === '1');
})();
