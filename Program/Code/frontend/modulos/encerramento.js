// ══════════════════════════════════ ABANDONAR O QUE ESTÁ RODANDO ══
// As perguntas que aparecem quando você deixa para trás trabalho de IA em
// curso. São DUAS, e moram juntas porque são o mesmo gesto visto de duas
// distâncias — fechar o programa e sair do projeto:
//
//   `confirmarEncerramento`     → fechar a janela. O trabalho MORRE.
//   `confirmarSaidaDoProjeto`   → o "← Projetos". O trabalho CONTINUA.
//
// ⚠️ Essa diferença é a coisa mais importante deste arquivo, e é o que os dois
// textos precisam dizer sem rodeio. Um aviso de saída escrito como se matasse a
// pesquisa ensinaria o usuário a temer um botão inofensivo; escrito de leve
// demais no fechamento, deixaria ele perder vinte minutos de trabalho.
//
// Este arquivo existe separado porque o assunto é o CICLO DE VIDA do que está
// rodando, não a tela de ninguém: `app.js` guarda estado global e o `init`, e um
// modal ali dentro seria a primeira coisa a destoar.
//
// ── A pergunta do fechamento ───────────────────────────────────────────────
// Quem decide se ela aparece é o Python, no handler de `window.events.closing`
// (ver `Assistente de código vibe-coding.pyw`).
//
// ⚠️ Esta função é chamada de uma THREAD do Python, e não do handler de
// fechamento. O motivo está escrito lá: `evaluate_js` chamado de dentro do
// handler congela a janela sem saída, porque o handler roda na thread da UI e
// o `evaluate_js` espera essa mesma thread responder.
//
// As saídas são DUAS, e só duas: encerra, ou não encerra. ⛔ Nada de "Parar e
// fechar" — parar o que está rodando é uma decisão à parte, e cada tela tem o
// botão dela para isso.

function confirmarEncerramento(motivo) {
  // O que está rodando, dito por extenso. A frase vem pronta do backend
  // (`TRAVA_IA.estado()['motivo']`: "a Fila está pesquisando", "as Rotinas
  // estão atualizando a documentação") — um "tem certeza?" seco não ajudaria
  // ninguém a decidir, e é justamente a informação que o usuário não tem
  // quando fecha a janela sem querer.
  const oQueRoda = motivo
    ? `<strong>Agora mesmo: ${escapeHtml(motivo)}.</strong><br><br>
       Fechar interrompe isso na hora.`
    : 'Nada está rodando agora.';
  abrirModalPadrao({
    title: 'Encerrar o programa?',
    confirmLabel: 'Encerrar',
    bodyHtml: `<div class="modal-body-text">${oQueRoda}<br><br>
      O que já foi respondido fica guardado; o que estiver pela metade é gravado
      com a marca de interrompido.</div>`,
    onConfirm: async () => {
      // ⚠️ Quem fecha é o Python, e não `window.close()`: é lá que a marca de
      // já-confirmado é ligada. Sem ela, o `window.destroy()` dispara o
      // `closing` DE NOVO e este modal reabre para sempre.
      try {
        await window.pywebview.api.encerrar_programa();
      } catch (e) {
        showToast('Não deu para encerrar o programa.', true);
      }
    },
  });
}

// ── A pergunta de sair do projeto ──────────────────────────────────────────
/**
 * Pergunta antes do "← Projetos", e devolve `true` para sair.
 *
 * ⚠️ Ela devolve uma PROMESSA, e a de cima não. A diferença não é estilo: aqui
 * quem pergunta é a própria tela (`goBackToProjects`), que precisa da resposta
 * para decidir se navega; lá quem pergunta é o Python, que já cancelou o
 * fechamento e reage pelo `onConfirm`.
 *
 * O molde das três saídas do modal — Confirmar, Cancelar e clique fora — é o de
 * `_chatConfirmarRemocao` (chat-lista.js). ⚠️ Resolver só no Confirmar deixaria
 * o clique no "← Projetos" pendurado para sempre depois de um Cancelar: sem
 * erro, sem aviso, e sem sair.
 *
 * ⛔ Isto NÃO impede a saída e NÃO para nada. A tarefa da Fila continua
 * rodando em segundo plano, e voltar ao projeto a reencontra no meio. O usuário
 * pediu "só notificação mesmo" — transformar num impedimento seria inventar uma
 * trava que ninguém pediu, e num lugar em que ela não protege nada.
 */
function confirmarSaidaDoProjeto(motivo) {
  return new Promise(resolve => {
    let confirmou = false;
    const overlay = abrirModalPadrao({
      title: 'Sair do projeto?',
      confirmLabel: 'Sair',
      bodyHtml: `<div class="modal-body-text">
        <strong>Agora mesmo: ${escapeHtml(motivo || 'há trabalho de IA em curso')}.</strong><br><br>
        Sair <strong>não interrompe nada</strong> — o trabalho continua, e voltar ao
        projeto reencontra ele no meio. O que você perde é a tela onde ele aparece.</div>`,
      onConfirm: () => { confirmou = true; },
    });
    new MutationObserver((_m, obs) => {
      if (!overlay.isConnected) { obs.disconnect(); resolve(confirmou); }
    }).observe(document.body, { childList: true });
  });
}

// ── A pergunta de FECHAR uma aba de projeto ────────────────────────────────
/**
 * Pergunta antes do × de uma aba de projeto, e devolve `true` para fechar.
 *
 * ⚠️ NÃO é a mesma pergunta de `confirmarSaidaDoProjeto` — é o oposto dela, de
 * propósito. "Sair" (← Projetos) nunca interrompe nada; fechar uma aba é o
 * gesto forte que o usuário pediu: a vigilância do Detector daquele projeto
 * para de vez, e o que estiver rodando é cortado pelo caminho seguro que cada
 * ponta já tem (ver `executar_fechar_projeto`, configuracoes.py). Escrever os
 * dois textos como se fossem a mesma coisa ensinaria o usuário a não confiar
 * em nenhum dos dois botões.
 */
function confirmarFecharAbaDeProjeto(nomeProjeto, motivo) {
  // ⚠️ `motivo` pode vir VAZIO, e aí a frase não pode ser inventada: com
  // "Perguntar antes de fechar o projeto" em “Sempre”, a pergunta aparece com a
  // aba parada. O texto de reserva antigo ("há trabalho de IA em curso") passou
  // a ser uma afirmação falsa nesse caso — e justamente na tela em que o
  // usuário decide se perde trabalho.
  const oQueRoda = motivo
    ? `<strong>Agora mesmo: ${escapeHtml(motivo)}.</strong><br><br>
       Fechar <strong>interrompe isso</strong> \u2014 diferente de "\u2190 Projetos", que s\u00f3
       esconde a tela.`
    : `<strong>Nada est\u00e1 rodando agora.</strong><br><br>
       Fechar para a vigil\u00e2ncia deste projeto \u2014 diferente de "\u2190 Projetos", que s\u00f3
       esconde a tela.`;
  return new Promise(resolve => {
    let confirmou = false;
    const overlay = abrirModalPadrao({
      title: `Fechar "${nomeProjeto}"?`,
      confirmLabel: 'Fechar',
      bodyHtml: `<div class="modal-body-text">
        ${oQueRoda}<br><br>
        As requisições ao LM Studio deste projeto param — e a vez passa para o
        próximo projeto da fila. O corte acontece na próxima fronteira segura
        (entre arquivos, entre rotinas), então nenhum arquivo fica pela metade,
        e o que faltou continua anotado para o "Retomar" quando você reabrir.
        <br><br>
        Uma cópia de <strong>Backup</strong> em andamento termina: ela não
        chama o modelo, e parar no meio deixaria a Versão incompleta.</div>`,
      onConfirm: () => { confirmou = true; },
    });
    new MutationObserver((_m, obs) => {
      if (!overlay.isConnected) { obs.disconnect(); resolve(confirmou); }
    }).observe(document.body, { childList: true });
  });
}
