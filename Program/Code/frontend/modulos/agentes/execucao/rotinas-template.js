// ══════════════════════════════════════════════════ TEMPLATE: Sub-aba Rotinas
// Casca da sub-aba "Rotinas": filtros + containers de grupo. A casca da sub-aba
// "Visualizar" morava aqui também e saiu para
// `agentes/automacao/visualizar-template.js`, ao lado do JS que a preenche —
// era a única sub-aba de Automação com o markup numa pasta e o comportamento em
// outra. Os cards de cada agente são injetados separadamente por
// arquivos `*-template.js` ao lado do respectivo módulo de comportamento —
// eles vão parar no lugar certo porque `_agruparCards()` (rotinas.js) já
// localiza cada card pelo atributo `data-agente` e o move para o grupo
// correto, não importa onde ele foi inserido no DOM.
document.getElementById('asubtab-rotinas').innerHTML = `
<div class="agentes-layout">

  <!-- Duas dimensões independentes: COMO o artefato é produzido (Tipo) e QUEM
       o consome (Destino). O destino já foi só "para a máquina"; virou quatro
       porque "máquina" escondia consumidores com necessidades opostas — o que
       não cabe na janela do LM Studio é trivial para um assistente externo, e
       o inverso vale para custo por token. Os data-valor são chaves lidas
       por rotinas.js, não rótulos: mudar o texto do botão é seguro, mudar o
       data-valor obriga a reclassificar os 11 cards. -->
  <div class="agente-filtros">
    <span class="agente-filtros-lbl">Tipo</span>
    <button class="agente-chip on" data-filtro="tipo" data-valor="det" title="não usa modelo de linguagem">⚡ Determinístico</button>
    <button class="agente-chip on" data-filtro="tipo" data-valor="llm" title="escrito por modelo de linguagem">🧠 LLM</button>
    <span class="agente-filtros-sep"></span>
    <span class="agente-filtros-lbl">Destino</span>
    <button class="agente-chip on" data-filtro="destino" data-valor="humano" title="documento para você ler">👤 Humano</button>
    <button class="agente-chip on" data-filtro="destino" data-valor="lmstudio" title="insumo para o modelo local, dentro do programa">🖥️ LM Studio</button>
    <button class="agente-chip on" data-filtro="destino" data-valor="externo" title="insumo para o assistente de código que você usa por fora — Claude Code, Cursor, Antigravity…">🤖 Assistente externo</button>
    <button class="agente-chip on" data-filtro="destino" data-valor="interno" title="encanamento: nem você nem nenhuma IA lê isso — serve para o próprio programa funcionar">⚙️ O próprio programa</button>
    <span class="agente-filtros-sep"></span>
    <button class="agente-chip" id="btn-recolher-agentes">Recolher todos</button>
  </div>

  <!-- Legenda dos selos. Os cards têm seis estados e nenhum deles se explicava
       em lugar nenhum: "Pronto" e "Esperando" são a diferença entre uma rotina
       que ninguém pediu e uma que vai rodar daqui a pouco, e essa diferença é
       invisível sem legenda. Mesma construção da legenda de Acionamentos e da
       de Visualizar — as três barras de estado do programa se leem igual.
       Os selos aqui usam as MESMAS classes dos cards, e não cópias: mudar a
       cor de um estado muda a legenda junto, sem ninguém precisar lembrar. -->
  <div class="agente-legenda-bar">
    <span class="agente-legenda-lbl">Selo</span>
    <span class="agente-legenda"><span class="agente-badge agente-badge-idle">Pronto</span> não está na fila</span>
    <span class="agente-legenda"><span class="agente-badge agente-badge-esperando">Esperando</span> na fila do ciclo</span>
    <span class="agente-legenda"><span class="agente-badge agente-badge-bloqueado">Outro projeto</span> a janela do LM Studio está com outra aba <span class="agente-legenda-nota">(só no Revezamento)</span></span>
    <span class="agente-legenda"><span class="agente-badge agente-badge-running">Executando...</span> rodando agora</span>
    <span class="agente-legenda"><span class="agente-badge agente-badge-dispensado">Dispensada</span> o Detector não pediu <span class="agente-legenda-nota">(não é erro — é o ciclo poupando LLM)</span></span>
    <span class="agente-legenda"><span class="agente-badge agente-badge-done">Concluído</span> terminou inteiro <span class="agente-legenda-nota">(na Espera: <em>Ativada</em>)</span></span>
    <span class="agente-legenda"><span class="agente-badge agente-badge-parcial">Concluído com N erros</span> faltou pedaço</span>
    <span class="agente-legenda"><span class="agente-badge agente-badge-error">Erro</span> não terminou</span>
  </div>

  <!-- Os cards são distribuídos entre estes QUATRO grupos por rotinas.js,
       conforme o data-grupo de cada um. Assim a ordem visual não depende
       de onde o card foi inserido no DOM pelo respectivo template.

       ⚠️ OS TÍTULOS SÃO OS MESMOS DA SUB-ABA ACIONAMENTOS, palavra por palavra.
       As duas telas mostram as mesmas quinze rotinas e respondem perguntas
       diferentes sobre elas — lá "esta roda sozinha?", aqui "o que ela gerou?".
       Com agrupamentos diferentes, a mesma rotina aparecia em vizinhanças
       diferentes nas duas, e a pessoa tinha que reconstruir o mapa duas vezes.
       Antes desta padronização, a base e o freio ficavam dissolvidos dentro de
       "Independentes", que é justamente o que eles não são: não se escolhe. -->
  <div class="agente-sec-title" id="agente-sec-base">A base — não se escolhem · ligar qualquer rotina abaixo acende as três primeiras</div>
  <div id="agente-grupo-base"></div>
  <div class="agente-sec-title" id="agente-sec-freio">O freio — segura o ciclo enquanto o código ainda está mudando</div>
  <div id="agente-grupo-freio"></div>
  <div class="agente-sec-title" id="agente-sec-ind">Agentes independentes — disparam na mudança de arquivo</div>
  <div id="agente-grupo-ind"></div>
  <div class="agente-sec-title" id="agente-sec-dep">Agentes dependentes — encadeiam após pré-requisitos</div>
  <div id="agente-grupo-dep"></div>

</div>
`;
