// ══════════════════════════════════════════════ TEMPLATE: Sub-aba Pendências
// Mostra, ao vivo, o que cada rotina está processando e quantos arquivos faltam.
// Lógica em `pendencias.js` — poll de `get_processando` a cada 2 s, sem push.
//
// O cabeçalho segue a mesma estrutura de Erros (info à esquerda, filete
// embaixo), e a faixa de números segue a de Visualizar. As três sub-abas de
// Automação são lidas em sequência — quando cada uma inventa o próprio
// cabeçalho, trocar de sub-aba parece trocar de programa.
document.getElementById('asubtab-pendencias').innerHTML = `
<div class="agentes-layout pend-layout">
  <div class="pend-header">
    <div class="pend-header-info">
      <span class="pend-title">Arquivos em processamento</span>
      <span class="pend-sub">O que as rotinas estão processando agora, ao vivo. Atualiza sozinho a cada 2 segundos.</span>
    </div>
  </div>
  <div id="pend-list" class="pend-list">
    <p class="agente-viewer-empty">Nenhuma rotina processando no momento.</p>
  </div>
</div>
`;
