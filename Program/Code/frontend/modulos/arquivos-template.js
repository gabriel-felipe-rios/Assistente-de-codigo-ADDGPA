// ══════════════════════════════════════════════ TEMPLATE: Aba Arquivos
// Markup estático da aba "Arquivos" (dentro de um projeto: #tab-arquivos, e
// global na tela de Projetos: #ptab-arquivos). Estrutura idêntica nos dois
// casos — só muda o prefixo dos ids (arq-* / garq-*) — extraído de index.html
// para manter o shell abaixo do limite de linhas da AMF.
//
// `temEstilosECores` e `temComoAdicionar` são as diferenças de estrutura entre
// as duas telas, e as duas apontam para a mesma divisão: a tela de projetos é a
// BIBLIOTECA (onde os itens nascem e morrem), e a de dentro de um projeto só
// ATIVA o que já existe.
//
// "Estilos e cores" é a biblioteca global de aparência, e não faz sentido dentro
// de um projeto — lá o Designer já escolhe estilo e paleta por projeto. "Como
// adicionar" explica como um item ENTRA na biblioteca, e dentro de um projeto
// não se acrescenta nada — só se liga e desliga.
//
// "Instruções base" (o CLAUDE.md / AGENTS.md que o assistente lê primeiro) e
// "Agentes" (os subagentes) aparecem nas DUAS telas: as duas são bibliotecas de
// item como Skills e Comandos, e as duas se ligam dentro de um projeto.
//
// Os dois parâmetros são explícitos, e não deduzidos do prefixo: quem lê a
// chamada vê que a tela de projetos tem duas sub-abas a mais, sem precisar saber
// o que `garq` significa.
// ⚠️ `temAcoesDeAgente` É A TELA GLOBAL, e vem separado das outras duas bandeiras
// mesmo significando a mesma coisa hoje: as três respondem perguntas
// diferentes ("tem a categoria X?", "tem a segunda visão de Agentes?"), e uma
// bandeira só faria a próxima diferença entre as telas virar uma condição
// escondida dentro de outra.
function arquivosSubtabsMarkup(prefix, taborderGroup, taborderLabel, taborderParent,
                               temEstilosECores, temComoAdicionar, temAcoesDeAgente) {
  return `
    <div class="arq-subtabs-bar" data-taborder-group="${taborderGroup}" data-taborder-label="${taborderLabel}" data-taborder-parent="${taborderParent}">
      <button class="${prefix}-subtab-btn active" data-${prefix}subtab="${prefix}-skills">Skills</button>
      <button class="${prefix}-subtab-btn" data-${prefix}subtab="${prefix}-comandos">Comandos</button>
      <button class="${prefix}-subtab-btn" data-${prefix}subtab="${prefix}-mcps">MCPs</button>
      <button class="${prefix}-subtab-btn" data-${prefix}subtab="${prefix}-codigos">Códigos prontos</button>
      <button class="${prefix}-subtab-btn" data-${prefix}subtab="${prefix}-regras-instrucoes">Regras e instruções</button>
      <button class="${prefix}-subtab-btn" data-${prefix}subtab="${prefix}-instrucoes-base">Instruções base</button>
      <button class="${prefix}-subtab-btn" data-${prefix}subtab="${prefix}-agentes">Agentes</button>
      ${temEstilosECores ? `<button class="${prefix}-subtab-btn" data-${prefix}subtab="${prefix}-estilos-e-cores">Estilos e cores</button>` : ''}
      ${temComoAdicionar ? `<button class="${prefix}-subtab-btn" data-${prefix}subtab="${prefix}-como-adicionar">Como adicionar</button>` : ''}
    </div>
    <div class="${prefix}-subtab-content active" id="${prefix}-skills">
      <div id="${prefix}-skills-list" class="arq-item-list"></div>
    </div>
    <div class="${prefix}-subtab-content hidden" id="${prefix}-comandos">
      <div id="${prefix}-comandos-list" class="arq-item-list"></div>
    </div>
    <div class="${prefix}-subtab-content hidden" id="${prefix}-mcps">
      <div id="${prefix}-mcps-list" class="arq-item-list"></div>
    </div>
    <div class="${prefix}-subtab-content hidden" id="${prefix}-codigos">
      <div id="${prefix}-codigos-list" class="arq-item-list"></div>
    </div>
    <div class="${prefix}-subtab-content hidden" id="${prefix}-regras-instrucoes">
      <div id="${prefix}-regras-instrucoes-list" class="arq-item-list"></div>
    </div>
    <div class="${prefix}-subtab-content hidden" id="${prefix}-instrucoes-base">
      <div id="${prefix}-instrucoes-base-list" class="arq-item-list"></div>
    </div>
    <!-- UMA VISAO SO (D16). Ate 2026-09-02 havia aqui um par de arq-inner-tab
         (Agentes / Assistentes externos) e um segundo painel com o formulario
         do assistente. Ele virou uma CATEGORIA DE CONFIGURACOES inteira, e por
         um motivo de forma: assistente externo nao e uma categoria de arquivo,
         e nao cabia numa visao alternativa dentro de uma. A barra de acoes do
         agente continua aqui. -->
    <div class="${prefix}-subtab-content hidden" id="${prefix}-agentes">
      ${temAcoesDeAgente ? `
      <div class="arq-topo" id="${prefix}-agentes-topo">
        <div class="arq-ag-acoes-topo" id="${prefix}-agentes-acoes"></div>
      </div>` : ''}
      <div id="${prefix}-agentes-list" class="arq-item-list"></div>
    </div>
    ${temEstilosECores ? `
    <div class="${prefix}-subtab-content hidden" id="${prefix}-estilos-e-cores">
      <div id="${prefix}-estilos-e-cores-list" class="arq-item-list"></div>
    </div>` : ''}
    ${temComoAdicionar ? `
    <div class="${prefix}-subtab-content hidden" id="${prefix}-como-adicionar">
      <div id="${prefix}-como-adicionar-corpo" class="cad-corpo"></div>
    </div>` : ''}
  `;
}

document.getElementById('ptab-arquivos').innerHTML = arquivosSubtabsMarkup(
  'garq', 'garq_subtabs', 'Sub-abas de Arquivos (tela principal)', 'ptab-arquivos',
  true, true, true
);
document.getElementById('tab-arquivos').innerHTML = arquivosSubtabsMarkup(
  'arq', 'arquivos_subtabs', 'Sub-abas de Arquivos', 'tab-arquivos',
  false, false, false
);
