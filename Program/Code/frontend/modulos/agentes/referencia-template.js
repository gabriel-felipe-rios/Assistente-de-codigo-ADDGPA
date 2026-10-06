// ═══ SUB-ABA: Automação › Explicações (id interno `asubtab-referencia`, mantido pela ordem salva das abas) ══
// Markup da última sub-aba de Automação. A lógica mora em `referencia.js` —
// mesmo par de Erros e Pendências.
//
// ⚠️ O id e os nomes dos arquivos continuam "referencia" de propósito: a ordem
// das sub-abas que o usuário salvou (`Internal/config/ordem-das-abas.json`)
// guarda o id, e trocá-lo mandaria a sub-aba para o fim. Muda o que se vê.
//
// Esta tela é SÓ LEITURA, e é de propósito: ela responde o que as outras
// sub-abas não respondem — o que cada rotina é, como ela fala com o modelo e
// qual é a REGRA que decide quando ela roda.
//
// ⚠️ As duas tabelas são montadas em JS, nunca digitadas aqui. A de "O que cada
// rotina faz" sai de `explicacoes-dados.js` (o mesmo lugar da frase de cada
// card de Rotinas); a do Detector sai do backend (`get_tabela_do_detector`) e
// reflete até os interruptores de Configurações › Rotinas da Automação.
//
// ⚠️ AVISO: este arquivo inteiro é um template literal. Uma crase perdida, ainda
// que dentro de um comentário de HTML, fecha a string e derruba o programa.
//
// ⚠️ `.agentes-subtab-content` é overflow:hidden e não rola sozinho — daí o
// wrapper `.agentes-layout`, como a sub-aba Erros faz.
document.getElementById('asubtab-referencia').innerHTML = `
  <div class="agentes-layout">
    <div class="exp-layout">
      <div class="exp-cab">
        <h2>Explicações</h2>
        <p>O que cada rotina faz, como ela fala com o modelo, e que modificação
           manda atualizar o quê. Os grupos são os mesmos da sub-aba
           Visualizar.</p>
      </div>

      <section class="exp-secao">
        <h3>Como cada rotina roda</h3>
        <div class="exp-modos">
          <div class="exp-modo"><span class="exp-tipo exp-tipo-sem-ia">${EXPLICACOES_TIPOS['sem-ia']}</span>
            <span>o programa faz sozinho, com regras e o <em>parser</em> do código.
                  Segundos, e sempre dá o mesmo resultado.</span></div>
          <div class="exp-modo"><span class="exp-tipo exp-tipo-embedding-local">${EXPLICACOES_TIPOS['embedding-local']}</span>
            <span>um modelo pequeno que roda dentro do programa e transforma texto
                  em números para a busca por sentido. Não usa o LM Studio.</span></div>
          <div class="exp-modo"><span class="exp-tipo exp-tipo-direto">${EXPLICACOES_TIPOS['direto']}</span>
            <span>uma pergunta ao modelo, uma resposta, e acabou. Uma chamada por
                  arquivo, por termo ou para o projeto inteiro.</span></div>
          <div class="exp-modo"><span class="exp-tipo exp-tipo-partes-costura">${EXPLICACOES_TIPOS['partes-costura']}</span>
            <span>a entrada não cabe numa chamada: vira partes, cada parte é uma
                  chamada, e uma chamada final junta as partes num texto só.
                  Quando cabe, é uma chamada só, sem costura.</span></div>
          <div class="exp-modo"><span><span class="vis-etapas">1</span> <span class="vis-etapas">2</span></span>
            <span>o <strong>selo</strong> no canto de cada card da sub-aba
                  Visualizar: <strong>1</strong> roda de uma vez;
                  <strong>2</strong> pode rodar em partes e depois costurar.</span></div>
        </div>
      </section>

      <section class="exp-secao">
        <h3>O que cada rotina faz</h3>
        <div class="exp-tabela-wrap">
          <table class="exp-tab" id="exp-tabela">
            <thead><tr><th>Rotina</th><th>O que faz</th><th>Como roda</th><th>Lê</th><th>Quando refaz</th></tr></thead>
            <tbody id="exp-tabela-corpo"></tbody>
          </table>
        </div>
      </section>

      <section class="exp-secao">
        <h3>Como funciona a costura</h3>
        <p class="exp-p">Uma chamada ao modelo tem um tamanho máximo de entrada.
           Uma pasta com 200 arquivos não cabe numa só. O exemplo abaixo é a pasta
           <code>agentes</code>, grande demais para uma chamada.</p>
        <div class="exp-fluxo">
          <div class="exp-passo"><span class="exp-passo-num">1</span><span>A pasta tem 200 arquivos — não cabe numa chamada.</span></div>
          <div class="exp-seta">→</div>
          <div class="exp-passo"><span class="exp-passo-num">2</span><span>O programa divide em <strong>3 partes</strong> que cabem.</span></div>
          <div class="exp-seta">→</div>
          <div class="exp-passo"><span class="exp-passo-num">3</span><span><strong>3 chamadas</strong>, uma por parte: cada uma escreve o papel da sua parte.</span></div>
          <div class="exp-seta">→</div>
          <div class="exp-passo exp-passo-costura"><span class="exp-passo-num">4</span><span><strong>A costura</strong>: uma chamada curta lê só os três papéis e escreve <strong>um</strong> papel da pasta.</span></div>
          <div class="exp-seta">→</div>
          <div class="exp-passo exp-passo-fim"><span class="exp-passo-num">✓</span><span>Um resumo só: <code>agentes.md</code>.</span></div>
        </div>
        <p class="exp-p"><strong>Antes de tudo, o orçamento.</strong> O programa mede
           primeiro quanto a entrada ocupa. Se cabe numa chamada, não há partes nem
           costura: 200 arquivos de uma palavra cada são uma chamada só.</p>
        <p class="exp-p"><strong>Dividir tem limite.</strong> A divisão vale só até
           «O máximo aceito, mesmo dividindo», em Configurações › Rotinas da Automação:
           tamanho, linhas e tokens do arquivo na Documentação Técnica; arquivos e
           tokens da pasta no Resumo de Pastas. Passou dele — ou com «Dividir e
           costurar» desligado —, o que não cabe fica em «Arquivos muito grandes».</p>
        <p class="exp-p"><strong>O pior caso: costura em rodadas.</strong> Se nem os
           papéis das partes couberem numa costura, a costura também é feita em
           grupos, e os grupos são costurados de novo, até sobrar um texto só.
           Quase nunca acontece.</p>
        <div class="exp-fluxo">
          <div class="exp-passo"><span class="exp-passo-num">12</span><span>12 partes: os 12 papéis não cabem numa costura.</span></div>
          <div class="exp-seta">→</div>
          <div class="exp-passo exp-passo-costura"><span class="exp-passo-num">3</span><span>3 costuras, de 4 papéis cada.</span></div>
          <div class="exp-seta">→</div>
          <div class="exp-passo exp-passo-costura"><span class="exp-passo-num">1</span><span>1 costura final junta as 3.</span></div>
          <div class="exp-seta">→</div>
          <div class="exp-passo exp-passo-fim"><span class="exp-passo-num">✓</span><span><code>agentes.md</code></span></div>
        </div>
        <p class="exp-p exp-mudo">O tamanho de cada parte é o teto de entrada, em
           Configurações › Modelo e contexto (a conta aparece em Configurações ›
           Rotinas da Automação › «Partes e costura»).</p>
      </section>

      <section class="exp-secao">
        <h3>Que modificação manda atualizar o quê</h3>
        <p class="exp-p">Quem decide é o <strong>Detector</strong>. Ele olha o que
           mudou em cada arquivo, encaixa a mudança numa classe e só acorda as
           rotinas que aquela classe merece. Sem mudança nenhuma não há ciclo, e
           nada roda. Havendo, as rotinas sem IA rodam todas, sobre a lista do que
           mudou: pular uma pouparia segundos e deixaria o índice dela velho. Só as
           com IA passam por esta tabela.</p>
        <div class="ref-tabela-wrap">
          <table class="ref-tabela" id="ref-tabela">
            <thead id="ref-tabela-cab"></thead>
            <tbody id="ref-tabela-corpo"></tbody>
          </table>
        </div>
        <p class="exp-p exp-mudo ref-legenda" id="ref-legenda"></p>
      </section>
    </div>
  </div>
`;
