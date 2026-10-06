// ══════ QUEM QUEBRA SE EU RENOMEAR — observador de `editor.vai_salvar` ══
// Salvou depois de renomear uma função que outros arquivos usam: um aviso diz
// quais.
//
// ⚠️ OBSERVADOR, e NUNCA guardiã — o manifesto diz `"guardia": false`, e isso
// é decisão, não descuido. Ela **avisa**, não barra. Renomear é uma coisa
// legítima de fazer, e uma extensão que segurasse o Ctrl+S por causa disso
// seria insuportável no primeiro dia.
//
// ⚠️ Sendo observador, ela roda DEPOIS das guardiãs e o programa não a espera.
// O nome do evento continua sendo `vai_salvar` porque é aí que o texto ANTIGO
// ainda está disponível para comparar — em `editor.salvou` o cache já teria
// sido substituído.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, evento, guardia }

  xtAssinar(EU.slug, EU.evento, (dado) => {
    // A casca pode já ter sido desmontada — um aviso em voo ainda chega.
    if (typeof window.renDefinicoesDoTexto !== 'function' || !window.renDefinicoes) return;
    // O usuário pode ter desligado só o aviso, na tela de configuração.
    const prefs = (typeof window.renPrefs === 'function') ? window.renPrefs() : {};
    if (prefs.avisar_ao_salvar === false) return;
    const cache = window.renCache || {};
    if (!dado || cache.caminho !== dado.arquivo || !cache.usados || !cache.usados.size) return;

    // O que o gancho do decorador viu na última pintura — ou seja, o estado
    // ANTERIOR à edição que está sendo salva.
    const antes = window.renDefinicoes[dado.arquivo] || [];
    if (!antes.length) return;

    const agora = new Set(
      window.renDefinicoesDoTexto(String(dado.texto || '').split('\n')).map(d => d.nome));

    const quebrados = [];
    for (const def of antes) {
      if (agora.has(def.nome)) continue;          // continua definido
      if (!cache.usados.has(def.nome)) continue;  // ninguém a usava
      quebrados.push(def.nome);
    }
    if (!quebrados.length) return;

    // ⛔ `showToast`, e nunca `alert()` — o `alert` do WebView2 é do sistema e
    // trava a janela inteira.
    const nome = quebrados[0];
    const arquivos = (cache.porNome[nome] || []).slice(0, 4).join(', ');
    const eOutros = quebrados.length > 1 ? ` (e mais ${quebrados.length - 1})` : '';
    showToast(`Você renomeou ${nome}${eOutros} — usado por ${arquivos}`, true);

    // Devolver nada é o normal: observador não muda o dado e não barra.
  }, EU.guardia === '1');
})();
