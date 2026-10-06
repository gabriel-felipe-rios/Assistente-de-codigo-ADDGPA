// ═══════ FORMATAR AO SALVAR — a consulta `editor.formatar` ══
// Recursos do Editor › formatação: quando o usuário pede "Formatar o arquivo"
// (comando do PROGRAMA, no Acesso rápido), o programa pergunta às extensões e
// esta responde com o texto formatado. O programa põe o texto na tela como uma
// edição — o Ctrl+Z desfaz — e não grava.
//
// É o MESMO formatador da guardiã (`window.fmtFormatar`, em
// `frontend/eventos/salvar.js`), com as mesmas opções.
//
// ⚠️ SÓ RESPONDE ONDE HÁ FORMATADOR. `fmtFormatar` também faz a limpeza de
// "qualquer texto" (espaço no fim, quebra final), e essa limpeza é do Ctrl+S:
// num `.xml` (que o Editor chama de `markup`, como o HTML) ou com a linguagem
// desligada nas opções, a resposta é `null` — "não sei formatar este" — e o
// programa pergunta à próxima extensão da lista.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, consulta, linguagens }

  xtRegistrarConsulta(EU.slug, EU.consulta, ({ arquivo, texto }) => {
    // A casca ainda carregando (ou já desmontada): "não sei" é melhor que
    // formatar com o padrão errado.
    if (!window.fmtPronta || typeof window.fmtFormatar !== 'function'
        || typeof window.fmtFamiliaDe !== 'function') return null;
    const familia = window.fmtFamiliaDe(arquivo);
    if (!familia || (window.fmtPrefs || {})[familia] === false) return null;
    // Um `.json` inválido faz o `JSON.parse` lançar: o programa pula esta
    // extensão (com o erro no console) e avisa que ninguém formatou.
    const r = window.fmtFormatar(arquivo, texto);
    return (typeof r === 'string' && r !== texto) ? { texto: r } : null;
  });
})();
