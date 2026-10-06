// ══════════════════════ TEMPLATE: Sub-aba Automação › Histórico ══
// Markup da sétima sub-aba de Automação. A lógica mora em historico.js —
// mesmo par de Erros, Pendências e Explicações.
//
// A pergunta que ela responde é a do TEMPO, e nenhuma das outras seis responde:
// Acionamentos diz o que está ligado, Rotinas o que foi gerado, Visualizar o que
// rodou na última passada, Pendências o que ficou faltando, Erros o que quebrou
// e Explicações a regra. Aqui: *o que aconteceu, na ordem em que aconteceu?*
//
// ⚠️ O motivo de existir: os selos de "dispensada" e "pulada" são pintados por
// evaluate_js e MORREM NA TROCA DE SUB-ABA. Ao voltar, o card relê o
// _resumo.json e mostra "Concluído" de ontem sobre um ciclo de hoje em que a
// rotina nem foi chamada. Este painel lê do disco, e por isso continua ali.
//
// ⚠️ Forma: componente Trilha de itens (Padrões de interface › Componentes) —
// coleção de dados à esquerda, detalhe à direita. É o terceiro uso registrado,
// depois de Documentação e Visualizar pipeline.
//
// ⚠️ AVISO: este arquivo inteiro é um template literal. Uma crase perdida, ainda
// que dentro de um comentário de HTML, fecha a string e derruba o programa.
//
// ⚠️ .agentes-subtab-content é overflow:hidden e não rola sozinho — daí o
// wrapper .agentes-layout, como Erros e Explicações fazem.
document.getElementById('asubtab-historico').innerHTML = `
<div class="agentes-layout hist-layout">
  <div class="hist-header">
    <div class="hist-header-info">
      <span class="hist-title">Histórico</span>
      <span class="hist-sub">
        O que cada ciclo fez, na ordem — quais rotinas rodaram, quais foram
        dispensadas e quais arquivos passaram por cada uma.
      </span>
    </div>
    <div class="hist-header-acoes">
      <div class="mapa-toggle" id="hist-filtro">
        <button class="mapa-toggle-btn active" data-filtro="tudo">Tudo</button>
        <button class="mapa-toggle-btn" data-filtro="parado">Só o que não rodou</button>
        <button class="mapa-toggle-btn" data-filtro="erro">Só erros</button>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-run-historico">↻ Verificar</button>
      <button class="btn btn-negative btn-sm" id="btn-limpar-historico">Limpar</button>
    </div>
  </div>

  <div class="hist-corpo">
    <div class="hist-trilha" id="hist-trilha">
      <div class="hist-trilha-titulo">Ciclos</div>
    </div>
    <div class="hist-detalhe" id="hist-detalhe">
      <p class="agente-viewer-empty">Carregando...</p>
    </div>
  </div>
</div>
`;
