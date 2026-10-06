// ═══════════════════════════════ COMPONENTE: COPIAR CONTEXTO PARA O CHAT ══
//
// O formato em que este app entrega qualquer pedaço do projeto a um modelo de
// linguagem. Nasceu dentro da aba Documentação (`_docEnvelope` / `_docCopiar`);
// virou compartilhado quando a aba Análise passou a copiar do mesmo jeito.
//
// O ENVELOPE é o ponto todo: uma linha de cabeçalho dizendo O QUE é o bloco, e
// o bloco marcado com `--- {caminho} ---`.
//
// ⚠️ Sem o cabeçalho, o modelo recebe uma parede de texto sem saber se está
// lendo o CÓDIGO ou a DESCRIÇÃO dele — e responde sobre a coisa errada com toda
// a confiança. Foi o erro que criou este formato; não o simplifique de volta.
//
// O `--- {nome} ---` não é invenção daqui: é a mesma marcação que o backend já
// usa em quatro lugares para entregar arquivo a um modelo (chat_mensagem.py,
// glossario_indice.py, resumo_pastas.py e ferramentas_subagentes.py).

function envelopeDeContexto(cabecalho, caminho, corpo) {
  return `${cabecalho}\n\n--- ${caminho} ---\n${corpo}`;
}

// Copiar + avisar. O toast é obrigatório: a área de transferência não dá
// nenhum sinal visível de que recebeu algo, e sem o aviso o usuário clica duas
// vezes achando que falhou.
// ⚠️ `navigator.clipboard` falha calada no WebView2 (janela sem foco) — o plano B
// é o mesmo de `copiarPeloBotao` (utils.js).
async function copiarContexto(texto, mensagem) {
  try {
    await navigator.clipboard.writeText(texto);
    showToast(mensagem);
    return;
  } catch (e) { /* cai no plano B — ver copiarPeloBotao em utils.js */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = texto;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (!ok) throw new Error('execCommand recusou');
    showToast(mensagem);
  } catch (e) {
    showToast('Não foi possível copiar — selecione o texto manualmente.', true);
  }
}
