// ══════════════════════════════════════════════ TEMPLATE: Sub-aba Erros
// Duas perguntas diferentes, cada uma na sua superfície e com nome próprio:
//   1. o que FALHOU na última geração (vem dos `_resumo.json` das rotinas);
//   2. o que NÃO CABE no orçamento de contexto (varredura de tamanho).
//
// Até 21/08/2026 esta sub-aba se chamava "Erros" e mostrava só a segunda: um
// arquivo que falhou ao gerar ficava preso dentro do card da própria rotina, e
// o botão "Verificar" refazia a medição de tamanho sem nunca abrir um
// `_resumo.json`. Lógica em `erros.js`.
//
// As duas seções eram títulos soltos sobre o mesmo fundo, e a segunda lista se
// lia como continuação da primeira. Agora cada uma é um cartão — mesma leitura
// dos cartões de Configurações.
document.getElementById('asubtab-erros').innerHTML = `
<div class="agentes-layout erros-layout">
  <div class="erros-header">
    <div class="erros-header-info">
      <span class="erros-title">Erros</span>
      <span class="erros-sub">O que falhou na última geração e o que não cabe no orçamento de contexto.</span>
    </div>
    <button class="btn btn-primary btn-sm" id="btn-run-erros">↻ Verificar</button>
  </div>

  <div class="erros-secao">
    <div class="erros-secao-cabecalho">
      <div class="erros-secao-titulo">O que falhou na última geração</div>
      <div class="erros-secao-sub">Cada rotina grava aqui o que não conseguiu gerar. O arquivo anterior de cada um continua intacto — e o que falhou volta a ser tentado na próxima passada.</div>
    </div>
    <div id="erros-rotinas" class="erros-list">
      <p class="agente-viewer-empty">Verificando...</p>
    </div>
  </div>

  <div class="erros-secao">
    <div class="erros-secao-cabecalho">
      <div class="erros-secao-titulo">Arquivos grandes demais</div>
      <div class="erros-secao-sub">Não cabem no orçamento de contexto — as rotinas pulam estes. Refatore-os em módulos menores.</div>
      <div id="erros-status" class="erros-status"></div>
    </div>
    <div id="erros-list" class="erros-list">
      <p class="agente-viewer-empty">Verificando...</p>
    </div>
  </div>
</div>
`;
