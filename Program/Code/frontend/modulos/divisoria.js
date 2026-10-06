// ══════════════════════════════════ COMPONENTE: DIVISÓRIA ══
// Arrastar a barra entre dois painéis para repartir o espaço. Nasceu na aba
// Editor e já nasce compartilhada — é a primeira do programa, e a próxima tela
// que precisar de painéis redimensionáveis não deve escrever a segunda.
//
// ⚠️ `setPointerCapture`, e NÃO `mousemove` no `document`. Os dois funcionam
// enquanto o ponteiro está sobre área vazia; a diferença aparece ao arrastar
// por cima de um painel que rola (a árvore, o código): sem a captura, o
// elemento de baixo rouba os eventos e o arraste morre no meio. A captura
// também dá o `pointerup` de graça mesmo se o ponteiro sair da janela — sem
// ela, soltar o botão fora do programa deixa a divisória grudada no cursor.
//
// O componente NÃO decide larguras: ele mede, aplica e avisa. Quem persiste é
// quem chamou — na aba Editor, `editor.js`, em localStorage.

// eslint-disable-next-line no-unused-vars
function ligarDivisoria(opcoes) {
  const cfg = Object.assign({
    divisoria: null,   // o elemento .divisoria
    painel:    null,   // o painel que TEM a largura fixa (o outro é flex: 1)
    lado:      'esquerda', // de que lado do divisor o painel está
    minimo:    180,
    // Sobra mínima para o painel do outro lado. Sem isto, arrastar até o fim
    // esmaga o painel flexível a zero e o conteúdo dele some sem aviso.
    minimoDoOutro: 240,
    aoSoltar:  null,   // (larguraFinal) => void — grava
  }, opcoes || {});

  const { divisoria, painel } = cfg;
  if (!divisoria || !painel) return null;

  let arrastando = false;
  let xInicial = 0;
  let larguraInicial = 0;

  divisoria.addEventListener('pointerdown', (e) => {
    // Só o botão principal. Sem isto, o botão do meio inicia um arraste que
    // nunca recebe o `pointerup` correspondente.
    if (e.button !== 0) return;
    arrastando = true;
    xInicial = e.clientX;
    larguraInicial = painel.getBoundingClientRect().width;
    // `setPointerCapture` lança quando o ponteiro não está mais ativo (o dedo
    // que já saiu da tela, um evento sintético). Sem o try, a exceção aborta o
    // resto do handler: o arraste começa sem as classes de estado, e o cursor
    // de redimensionar fica preso na janela inteira até um reload. A captura é
    // uma melhoria do arraste, não um pré-requisito dele.
    try { divisoria.setPointerCapture(e.pointerId); } catch (_) { /* segue sem captura */ }
    divisoria.classList.add('divisoria--arrastando');
    document.body.classList.add('divisoria-arrastando');
    e.preventDefault();
  });

  divisoria.addEventListener('pointermove', (e) => {
    if (!arrastando) return;
    const delta = cfg.lado === 'esquerda' ? (e.clientX - xInicial) : (xInicial - e.clientX);
    // O teto sai da largura do PAI, medida a cada movimento e não uma vez no
    // começo: redimensionar a janela durante o arraste é raro, mas o custo de
    // medir é um `getBoundingClientRect` e o custo de não medir é uma
    // divisória que passa da borda.
    const teto = painel.parentElement.getBoundingClientRect().width - cfg.minimoDoOutro;
    const nova = Math.max(cfg.minimo, Math.min(teto, larguraInicial + delta));
    painel.style.width = `${nova}px`;
  });

  const soltar = (e) => {
    if (!arrastando) return;
    arrastando = false;
    try { divisoria.releasePointerCapture(e.pointerId); } catch (_) { /* já solto */ }
    divisoria.classList.remove('divisoria--arrastando');
    document.body.classList.remove('divisoria-arrastando');
    if (cfg.aoSoltar) cfg.aoSoltar(Math.round(painel.getBoundingClientRect().width));
  };
  divisoria.addEventListener('pointerup', soltar);
  // `pointercancel` acontece quando o sistema toma o ponteiro (gesto do
  // touchpad, troca de janela). Sem tratar, a classe do body fica presa e a
  // janela inteira continua com cursor de redimensionar.
  divisoria.addEventListener('pointercancel', soltar);

  // Duplo clique devolve a largura padrão — o gesto que todo editor tem, e o
  // conserto para quem arrastou longe demais e não sabe voltar.
  divisoria.addEventListener('dblclick', () => {
    painel.style.width = '';
    if (cfg.aoSoltar) cfg.aoSoltar(null);
  });

  return {
    aplicar(largura) {
      painel.style.width = largura ? `${largura}px` : '';
    },
    // Retrair não é largura 0: é o painel fora do fluxo, e a divisória junto.
    // O motivo está em divisoria.css.
    retrair(sim) {
      painel.classList.toggle('divisoria-retraido', !!sim);
      divisoria.classList.toggle('divisoria--inerte', !!sim);
    },
  };
}
