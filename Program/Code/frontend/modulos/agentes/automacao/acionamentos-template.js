// ══════════════════════════════════════════════ TEMPLATE: Sub-aba Acionamentos
// Markup estático da sub-aba "Acionamentos" (Agentes). Extraído de index.html
// para manter o shell abaixo do limite de linhas da AMF.
document.getElementById('asubtab-acionamentos').innerHTML = `
<div class="ac-layout">

  <!-- Faixa de retomada. Aparece só quando o ciclo anterior não chegou ao
       fim. O registro existia em Pendências.json desde sempre e nunca era
       lido por ninguém: o programa sabia o que tinha ficado devendo e não
       tinha como contar. É BOTÃO, e não retomada automática — nada que
       chame o LM Studio recomeça sozinho. -->
  <div class="ac-retomar hidden" id="ac-retomar">
    <span class="ac-retomar-ic" aria-hidden="true">⏸</span>
    <span class="ac-retomar-texto" id="ac-retomar-texto"></span>
    <button class="btn btn-special btn-sm" id="btn-ac-retomar" data-trava-ia="rotinas" type="button" title="roda de novo só as rotinas que ficaram devendo, com os mesmos arquivos daquele ciclo">Retomar o que faltou</button>
    <button class="btn btn-muted btn-sm" id="btn-ac-retomar-dispensar" type="button" title="esconde a faixa; o registro continua no disco">Dispensar</button>
  </div>

  <!-- Status global -->
  <div class="ac-global-status">
    <span class="ac-dot ac-dot-idle" id="ac-global-dot"></span>
    <span class="ac-global-label" id="ac-global-label">Nenhum agente ativado</span>
    <!-- Mesma legenda da sub-aba Visualizar, para as bolinhas desta aba
         não ficarem sem explicação. -->
    <span class="ac-legenda"><span class="ac-dot ac-dot-idle"></span> parado</span>
    <span class="ac-legenda"><span class="ac-dot ac-dot-running"></span> processando</span>
    <span class="ac-legenda"><span class="ac-dot ac-dot-active"></span> concluído</span>
    <div class="ac-botoes">
      <button class="btn btn-negative btn-sm ac-botao-perigo" id="btn-ac-limpar" type="button" title="escolha quais rotinas apagar — uma, algumas ou todas.&#10;NÃO desliga os acionamentos: o que estiver ligado regenera em seguida.">🗑️ Limpar dados gerados</button>
      <button class="btn btn-muted btn-sm" id="btn-ac-desativar-tudo" type="button" title="desliga todos os acionamentos e para o Detector">Desativar tudo</button>
      <button class="btn btn-primary btn-sm" id="btn-ac-ativar-principal" data-trava-ia="rotinas" type="button" title="O mesmo que Ativar tudo, MENOS três rotinas: Resumo de Pastas, Comentários e Duplicados.&#10;Liga o resto, gera agora o que falta e sobe o Detector para vigiar daqui em diante.">⚡ Ativar o principal</button>
      <button class="btn btn-positive btn-sm" id="btn-ac-ativar-tudo" data-trava-ia="rotinas" type="button" title="Liga TODAS as rotinas, gera agora o que falta e sobe o Detector para vigiar daqui em diante.">Ativar tudo</button>
      <!-- ⚠️ Eram CINCO botões até 28/08/2026: os dois de partida, "⚡ Início
           rápido" e "🚀 Iniciar", saíram. Eles existiam só porque "Ativar tudo"
           ligava e ficava esperando uma próxima mudança que, num projeto já
           gerado, nunca vinha — alguém tinha que dar a partida. Desde que
           "Ativar tudo" passou a gerar o que falta na hora, os dois viraram um
           caminho a mais para o mesmo lugar. ⛔ NÃO devolvê-los: o que ficou
           no lugar deles é o "Ativar o principal", que é um RECORTE do "Ativar
           tudo" (mesmo comportamento, quatro rotinas a menos), e não um modo
           de partida à parte. Ver _AC_FORA_DO_PRINCIPAL, em
           acionamentos_config.py. (Sem crases — ver o aviso mais abaixo.)
           Um motivo para os botões acima e para os ⟳ de cada rotina: o
           que trava todos eles é sempre a mesma coisa — outra ponta usando a
           janela do LM Studio. Ver modulos/trava-ia.js. -->
      <span class="trava-motivo hidden" data-trava-ia-motivo="rotinas"></span>
    </div>
    <!-- A legenda em prosa que ficava aqui saiu: ela repetia, palavra por
         palavra, o atributo title dos três botões logo acima — e o title
         aparece com o mouse em cima, no botão que a pessoa está pensando em
         clicar. Duas cópias do mesmo texto, uma delas ocupando a faixa inteira
         de forma permanente. Se um dia o comportamento dos botões mudar, o
         texto a corrigir é o title.
         ⚠️ Sem crases neste comentário: ele está dentro de um template
         literal, e uma crase aqui fecha a string (já quebrou duas vezes). -->
  </div>

  <!-- A BASE. Detector, Hashes e Sincronia não são etapas que se escolhem:
       são a fundação do ciclo, e rodam sempre que qualquer rotina abaixo
       estiver ligada. Nenhuma tem interruptor — o selo diz "Sempre".
       ⚠️ Sem crases neste comentário: ele está dentro de um template literal.
       Os selos "Sempre" NÃO têm data-agent, e é isso que impede
       _acWireToggles de tratá-los como interruptor. Quem os identifica é
       data-agent-fixo. -->
  <div class="ac-section ac-section-base">
    <div class="ac-section-title">A base — não se escolhem · ligar qualquer rotina abaixo acende as três primeiras</div>

    <div class="ac-agent-row" id="ac-detector-row">
      <span class="ac-run-once-vazio" aria-hidden="true"></span>
      <button class="ac-toggle fixo" data-agent-fixo="detector" type="button" disabled title="não se liga nem se desliga: roda sempre que houver alguma rotina ligada">Sempre</button>
      <span class="ac-dot ac-dot-idle" data-agent-dot="detector" id="ac-detector-dot"></span>
      <div class="ac-agent-info">
        <div class="ac-agent-name-row">
          <span class="ac-agent-icon">🛰️</span>
          <span class="ac-agent-name">Detector</span>
          <span class="ac-selo" title="determinístico — não usa LLM">⚡</span>
          <span class="ac-last-run" data-last-run="detector">&mdash;</span>
          <span class="ac-agent-count" data-agent-count="detector"></span>
        </div>
        <span class="ac-dep-hint">vê o que mudou e decide quais rotinas isso merece — é ele que dispara o ciclo. Quem o sobe é <strong>Ativar tudo</strong> ou <strong>Ativar o principal</strong></span>
      </div>
    </div>

    <div class="ac-agent-row">
      <button class="ac-run-once" data-trava-ia="rotinas" data-run-agent="hashes" title="Atualizar agora">&#8635;</button>
      <button class="ac-toggle fixo" data-agent-fixo="hashes" type="button" disabled title="não se liga nem se desliga: roda sempre que houver alguma rotina ligada">Sempre</button>
      <span class="ac-dot ac-dot-idle" data-agent-dot="hashes"></span>
      <div class="ac-agent-info">
        <div class="ac-agent-name-row">
          <span class="ac-agent-icon">#️⃣</span>
          <span class="ac-agent-name">Hashes</span>
          <span class="ac-selo" title="determinístico — não usa LLM">⚡</span>
          <span class="ac-last-run" data-last-run="hashes">&mdash;</span>
        </div>
        <span class="ac-dep-hint">guarda o hash do conteúdo de cada arquivo — é a memória que sobrevive ao programa fechar, e o que permite pular o que não mudou</span>
      </div>
    </div>

    <div class="ac-agent-row">
      <button class="ac-run-once" data-trava-ia="rotinas" data-run-agent="sincronia" title="Atualizar agora">&#8635;</button>
      <button class="ac-toggle fixo" data-agent-fixo="sincronia" type="button" disabled title="não se liga nem se desliga: roda sempre que houver alguma rotina ligada">Sempre</button>
      <span class="ac-dot ac-dot-idle" data-agent-dot="sincronia"></span>
      <div class="ac-agent-info">
        <div class="ac-agent-name-row">
          <span class="ac-agent-icon">↔️</span>
          <span class="ac-agent-name">Sincronia</span>
          <span class="ac-selo" title="determinístico — não usa LLM">⚡</span>
          <span class="ac-last-run" data-last-run="sincronia">&mdash;</span>
        </div>
        <span class="ac-dep-hint">arquivo movido ou renomeado → move as saídas junto, sem chamar o modelo; arquivo apagado → apaga o que derivava dele e marca a pasta para refazer o resumo</span>
      </div>
    </div>

    <!-- O REVEZAMENTO fecha a base, e não a abre: as três de cima RODAM (nesta
         ordem), ele não roda nada. O que ele faz é decidir QUANDO qualquer uma
         delas pode começar, porque a janela do LM Studio é uma só.
         Sem &#8635;: não há o que "atualizar agora" num portão. -->
    <div class="ac-agent-row" id="ac-revezamento-row">
      <span class="ac-run-once-vazio" aria-hidden="true"></span>
      <button class="ac-toggle fixo" data-agent-fixo="revezamento" type="button" disabled title="não se liga nem se desliga: a janela do LM Studio é uma só, e desligar seria mandar duas gerações para ela ao mesmo tempo">Sempre</button>
      <span class="ac-dot ac-dot-idle" id="ac-revezamento-dot"></span>
      <div class="ac-agent-info">
        <div class="ac-agent-name-row">
          <span class="ac-agent-icon">🚦</span>
          <span class="ac-agent-name">Revezamento</span>
          <span class="ac-selo" title="determinístico — não usa LLM">⚡</span>
          <span class="ac-last-run" id="ac-revezamento-estado">&mdash;</span>
        </div>
        <span class="ac-dep-hint">a janela do LM Studio é uma só: enquanto o Chat, a Fila, o Designer ou <strong>outra aba de projeto</strong> estiverem usando o modelo, o ciclo espera a vez aqui — e começa sozinho quando ela chegar</span>
      </div>
    </div>
  </div>

  <!-- O FREIO. A Espera não dispara nada — quem dispara é o Detector. Ela só
       segura N segundos sem mudança nova e libera. Esta, sim, com interruptor. -->
  <div class="ac-section">
    <div class="ac-section-title">O freio — segura o ciclo enquanto o código ainda está mudando</div>
    <div class="ac-agent-row" id="ac-espera-row">
      <span class="ac-run-once-vazio" aria-hidden="true"></span>
      <button class="ac-toggle" data-agent="espera" data-trigger="on" id="ac-espera-status">Desativado</button>
      <span class="ac-dot ac-dot-idle" id="ac-espera-dot"></span>
      <div class="ac-agent-info">
        <div class="ac-agent-name-row">
          <span class="ac-agent-icon">⏱️</span>
          <span class="ac-agent-name">Espera</span>
          <span class="ac-selo" title="determinístico — não usa LLM">⚡</span>
          <span class="ac-last-run" id="ac-espera-debounce">&mdash;</span>
        </div>
        <span class="ac-dep-hint">o Detector avisa que algo mudou e a Espera segura N segundos <em>sem nenhuma mudança nova</em> antes de liberar cada grupo — é o que evita rodar no meio de uma sessão do Claude Code. Desligada, libera na hora</span>
      </div>
    </div>
  </div>

  <!-- Agentes independentes -->
  <div class="ac-section">
    <div class="ac-section-title">Agentes independentes — disparam na mudança de arquivo</div>

    <div class="ac-agent-row">
      <button class="ac-run-once" data-trava-ia="rotinas" data-run-agent="indice-simbolos" title="Atualizar agora">&#8635;</button>
      <button class="ac-toggle" data-agent="indice-simbolos" data-trigger="file_change">Desativado</button>
      <span class="ac-dot ac-dot-idle" data-agent-dot="indice-simbolos"></span>
      <div class="ac-agent-info">
        <div class="ac-agent-name-row">
          <span class="ac-agent-icon">🏷️</span>
          <span class="ac-agent-name">Índice de Símbolos</span>
          <span class="ac-selo" title="determinístico — não usa LLM">⚡</span>
          <span class="ac-last-run" data-last-run="indice-simbolos">&mdash;</span>
        </div>
      </div>
    </div>

    <div class="ac-agent-row">
      <button class="ac-run-once" data-trava-ia="rotinas" data-run-agent="identificadores" title="Atualizar agora">&#8635;</button>
      <button class="ac-toggle" data-agent="identificadores" data-trigger="file_change">Desativado</button>
      <span class="ac-dot ac-dot-idle" data-agent-dot="identificadores"></span>
      <div class="ac-agent-info">
        <div class="ac-agent-name-row">
          <span class="ac-agent-icon">🔤</span>
          <span class="ac-agent-name">Índice de Identificadores</span>
          <span class="ac-selo" title="determinístico — não usa LLM">⚡</span>
          <span class="ac-last-run" data-last-run="identificadores">&mdash;</span>
        </div>
        <span class="ac-dep-hint">enxerga o acoplamento que o grafo de imports não vê (função global JS, ponte Python↔JS, ID de HTML, classe CSS)</span>
      </div>
    </div>

    <div class="ac-agent-row">
      <button class="ac-run-once" data-trava-ia="rotinas" data-run-agent="grafo-imports" title="Atualizar agora">&#8635;</button>
      <button class="ac-toggle" data-agent="grafo-imports" data-trigger="file_change">Desativado</button>
      <span class="ac-dot ac-dot-idle" data-agent-dot="grafo-imports"></span>
      <div class="ac-agent-info">
        <div class="ac-agent-name-row">
          <span class="ac-agent-icon">🔗</span>
          <span class="ac-agent-name">Grafo de Imports</span>
          <span class="ac-selo" title="determinístico — não usa LLM">⚡</span>
          <span class="ac-last-run" data-last-run="grafo-imports">&mdash;</span>
        </div>
      </div>
    </div>

    <div class="ac-agent-row">
      <button class="ac-run-once" data-trava-ia="rotinas" data-run-agent="bibliotecas" title="Atualizar agora">&#8635;</button>
      <button class="ac-toggle" data-agent="bibliotecas" data-trigger="file_change">Desativado</button>
      <span class="ac-dot ac-dot-idle" data-agent-dot="bibliotecas"></span>
      <div class="ac-agent-info">
        <div class="ac-agent-name-row">
          <span class="ac-agent-icon">📚</span>
          <span class="ac-agent-name">Bibliotecas</span>
          <span class="ac-selo" title="determinístico — não usa LLM">⚡</span>
          <span class="ac-last-run" data-last-run="bibliotecas">&mdash;</span>
        </div>
      </div>
    </div>

    <div class="ac-agent-row">
      <button class="ac-run-once" data-trava-ia="rotinas" data-run-agent="comentarios" title="Atualizar agora">&#8635;</button>
      <button class="ac-toggle" data-agent="comentarios" data-trigger="file_change">Desativado</button>
      <span class="ac-dot ac-dot-idle" data-agent-dot="comentarios"></span>
      <div class="ac-agent-info">
        <div class="ac-agent-name-row">
          <span class="ac-agent-icon">💬</span>
          <span class="ac-agent-name">Comentários</span>
          <span class="ac-selo" title="determinístico — não usa LLM">⚡</span>
          <span class="ac-last-run" data-last-run="comentarios">&mdash;</span>
        </div>
      </div>
    </div>

    <div class="ac-agent-row">
      <button class="ac-run-once" data-trava-ia="rotinas" data-run-agent="duplicados" title="Atualizar agora">&#8635;</button>
      <button class="ac-toggle" data-agent="duplicados" data-trigger="file_change">Desativado</button>
      <span class="ac-dot ac-dot-idle" data-agent-dot="duplicados"></span>
      <div class="ac-agent-info">
        <div class="ac-agent-name-row">
          <span class="ac-agent-icon">👯</span>
          <span class="ac-agent-name">Duplicados</span>
          <span class="ac-selo" title="determinístico — não usa LLM">⚡</span>
          <span class="ac-last-run" data-last-run="duplicados">&mdash;</span>
        </div>
      </div>
    </div>

    <div class="ac-agent-row">
      <button class="ac-run-once" data-trava-ia="rotinas" data-run-agent="doc-tecnica" title="Atualizar agora">&#8635;</button>
      <button class="ac-toggle" data-agent="doc-tecnica" data-trigger="file_change">Desativado</button>
      <span class="ac-dot ac-dot-idle" data-agent-dot="doc-tecnica"></span>
      <div class="ac-agent-info">
        <div class="ac-agent-name-row">
          <span class="ac-agent-icon">🗂️</span>
          <span class="ac-agent-name">Documentação Técnica</span>
          <span class="ac-agent-count" data-agent-count="doc-tecnica"></span>
          <span class="ac-last-run" data-last-run="doc-tecnica">&mdash;</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Agentes dependentes -->
  <div class="ac-section">
    <div class="ac-section-title">Agentes dependentes — encadeiam após pré-requisitos</div>

    <div class="ac-agent-row">
      <button class="ac-run-once" data-trava-ia="rotinas" data-run-agent="resumo-pastas" title="Atualizar agora">&#8635;</button>
      <button class="ac-toggle" data-agent="resumo-pastas" data-trigger="chain">Desativado</button>
      <span class="ac-dot ac-dot-idle" data-agent-dot="resumo-pastas"></span>
      <div class="ac-agent-info">
        <div class="ac-agent-name-row">
          <span class="ac-agent-icon">📂</span>
          <span class="ac-agent-name">Resumo de Pastas</span>
          <span class="ac-agent-count" data-agent-count="resumo-pastas"></span>
          <span class="ac-last-run" data-last-run="resumo-pastas">&mdash;</span>
        </div>
        <span class="ac-dep-hint">aguarda: Documentação Técnica</span>
      </div>
    </div>

    <div class="ac-agent-row">
      <button class="ac-run-once" data-trava-ia="rotinas" data-run-agent="indice-navegacao" title="Atualizar agora">&#8635;</button>
      <button class="ac-toggle" data-agent="indice-navegacao" data-trigger="chain">Desativado</button>
      <span class="ac-dot ac-dot-idle" data-agent-dot="indice-navegacao"></span>
      <div class="ac-agent-info">
        <div class="ac-agent-name-row">
          <span class="ac-agent-icon">🗺️</span>
          <span class="ac-agent-name">Índice de Navegação</span>
          <span class="ac-selo" title="determinístico — não usa LLM">⚡</span>
          <span class="ac-last-run" data-last-run="indice-navegacao">&mdash;</span>
        </div>
        <span class="ac-dep-hint">aguarda: Documentação Técnica</span>
      </div>
    </div>

    <div class="ac-agent-row">
      <button class="ac-run-once" data-trava-ia="rotinas" data-run-agent="glossario" title="Atualizar agora">&#8635;</button>
      <button class="ac-toggle" data-agent="glossario" data-trigger="chain">Desativado</button>
      <span class="ac-dot ac-dot-idle" data-agent-dot="glossario"></span>
      <div class="ac-agent-info">
        <div class="ac-agent-name-row">
          <span class="ac-agent-icon">📖</span>
          <span class="ac-agent-name">Glossário</span>
          <span class="ac-selo" title="escrito por LLM">🧠</span>
          <span class="ac-last-run" data-last-run="glossario">&mdash;</span>
        </div>
        <span class="ac-dep-hint">aguarda: Documentação Técnica</span>
      </div>
    </div>

    <div class="ac-agent-row">
      <button class="ac-run-once" data-trava-ia="rotinas" data-run-agent="pipeline" title="Atualizar agora">&#8635;</button>
      <button class="ac-toggle" data-agent="pipeline" data-trigger="chain">Desativado</button>
      <span class="ac-dot ac-dot-idle" data-agent-dot="pipeline"></span>
      <div class="ac-agent-info">
        <div class="ac-agent-name-row">
          <span class="ac-agent-icon">🔀</span>
          <span class="ac-agent-name">Pipeline</span>
          <span class="ac-selo" title="determinístico — não usa LLM">⚡</span>
          <span class="ac-selo" title="escrito por LLM">🧠</span>
          <span class="ac-last-run" data-last-run="pipeline">&mdash;</span>
        </div>
        <span class="ac-dep-hint">aguarda: Grafo de Imports</span>
      </div>
    </div>

    <div class="ac-agent-row">
      <button class="ac-run-once" data-trava-ia="rotinas" data-run-agent="embedding" title="Atualizar agora">&#8635;</button>
      <button class="ac-toggle" data-agent="embedding" data-trigger="chain">Desativado</button>
      <span class="ac-dot ac-dot-idle" data-agent-dot="embedding"></span>
      <div class="ac-agent-info">
        <div class="ac-agent-name-row">
          <span class="ac-agent-icon">🔍</span>
          <span class="ac-agent-name">Embedding Semântico</span>
          <span class="ac-last-run" data-last-run="embedding">&mdash;</span>
        </div>
        <span class="ac-dep-hint">aguarda: Documentação Técnica e Resumo de Pastas (só os que estiverem ligados)</span>
      </div>
    </div>
  </div>

</div><!-- /ac-layout -->
`;
