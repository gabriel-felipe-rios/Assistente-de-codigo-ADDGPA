// ══════════════════════════════════════════════ TEMPLATE: Aba Mapas
// Markup estático da aba "Mapas" (Matriz de Dependências, Hotspots, Dispersão,
// Proporção, Painel, Treemap, Sunburst, Ligações). Extraído de index.html para
// manter o
// shell abaixo do limite de linhas da AMF. Não usa mais Cytoscape — todo
// gráfico força-dirigido saiu; os formatos agora achatam a informação
// (matriz, barra, dispersão, rosca, medidor).
document.getElementById('tab-mapas').innerHTML = `
  <div class="subtabs-bar" data-taborder-group="mapas_subtabs" data-taborder-label="Sub-abas de Mapas" data-taborder-parent="tab-mapas">
    <button class="mapas-tab-btn active" data-mapa="mapa-pipeline">Pipeline</button>
    <button class="mapas-tab-btn"        data-mapa="mapa-matriz">Matriz de Dependências</button>
    <button class="mapas-tab-btn"        data-mapa="mapa-matriz-io">Matriz de I/O</button>
    <button class="mapas-tab-btn"        data-mapa="mapa-hotspots">Hotspots</button>
    <button class="mapas-tab-btn"        data-mapa="mapa-dispersao">Dispersão</button>
    <button class="mapas-tab-btn"        data-mapa="mapa-proporcao">Proporção</button>
    <button class="mapas-tab-btn"        data-mapa="mapa-painel">Painel</button>
    <button class="mapas-tab-btn"        data-mapa="mapa-treemap">Treemap</button>
    <button class="mapas-tab-btn"        data-mapa="mapa-sunburst">Sunburst</button>
    <button class="mapas-tab-btn"        data-mapa="mapa-ligacoes">Ligações</button>
  </div>

  <!-- Painel de controles — zoom da Matriz (reaproveitado do antigo DSM) -->
  <div id="dsm-controls" class="mapas-controls-panel" style="display:none">
    <div class="mapas-ctrl-row">
      <label class="mapas-ctrl-label">Zoom</label>
      <input type="range" id="ctrl-dsm-zoom" min="0.3" max="3" step="0.05" value="1">
      <span class="mapas-ctrl-val" id="ctrl-dsm-zoom-val">1×</span>
    </div>
  </div>

  <!-- Pipeline — a antiga Assistente › Visualizar pipeline. Só desenha o que
       a rotina Pipeline gravou; o conteúdo (sub-abas Leituras e Mapa em
       níveis) vem de mapas-pipeline-template.js, que carrega depois deste. -->
  <div class="mapas-tab-content active" id="mapa-pipeline"></div>

  <!-- Matriz de Dependências (ex-DSM) -->
  <div class="mapas-tab-content hidden" id="mapa-matriz">
    <div class="mapa-header">
      <div class="mapa-header-left">
        <span class="mapa-title">Matriz de Dependências</span>
        <span class="mapa-desc">Linha importa coluna — clique num nome para destacar e ver o caminho completo</span>
        <span class="mapa-caminho" id="matriz-caminho"></span>
      </div>
      <div class="mapa-header-right">
        <label class="toggle-pill" id="matriz-semdeps" title="Traz de volta as linhas e colunas em branco — quem só é importado, e quem só importa">
          <div class="toggle-track"><div class="toggle-knob"></div></div>
          <span class="toggle-label">Mostrar sem dependências</span>
        </label>
        <div class="mapa-toggle" id="matriz-modo-toggle">
          <button class="mapa-toggle-btn active" data-modo="arquivo">Por arquivo</button>
          <button class="mapa-toggle-btn"        data-modo="pasta">Por pasta</button>
        </div>
        <span class="mapa-stat" id="matriz-stat"></span>
        <button class="btn btn-primary btn-sm" id="btn-analyze-matriz">▶ Analisar</button>
      </div>
    </div>
    <div class="mapa-container mapa-container--dsm" id="dsm-outer">
      <div id="dsm-pan-wrap">
        <div id="dsm-container">
          <div class="mapa-placeholder">Clique em <strong>Analisar</strong> para gerar a matriz.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Matriz de I/O — irmã da Matriz de Dependências, com um eixo diferente.
       Lá as duas pontas são a mesma lista de arquivos ("linha importa coluna").
       Aqui a linha é o código e a coluna é a OPERAÇÃO, porque o alvo no disco
       não existe no código-fonte: é montado em execução, a partir das pastas
       que o usuário configura. Ver a discussão em
       Saída dos comandos/Discussões/Base de dados do Mapa de IO/ .
       (Sem crase neste comentário: o markup inteiro é um template literal.) -->
  <div class="mapas-tab-content hidden" id="mapa-matriz-io">
    <div class="mapa-header">
      <div class="mapa-header-left">
        <span class="mapa-title">Matriz de I/O</span>
        <span class="mapa-desc">Linha executa, coluna é a operação — clique em ▸ para abrir a pasta, ou numa célula para ver as operações</span>
        <span class="mapa-caminho" id="mio-matriz-caminho"></span>
      </div>
      <div class="mapa-header-right">
        <!-- Toggle segmentado com 2 opções — o caso padrão do componente.
             O que ele troca é o quanto o EIXO DAS COLUNAS abre: as 5 famílias,
             ou os 10 tipos que o Mapa de I/O já usa. -->
        <div class="mapa-toggle" id="mio-matriz-modo-toggle">
          <button class="mapa-toggle-btn active" data-modo="resumida">Resumida</button>
          <button class="mapa-toggle-btn"        data-modo="detalhada">Detalhada</button>
        </div>
        <span class="mapa-stat" id="mio-matriz-stat"></span>
        <button class="btn-icon" id="btn-mio-matriz-expandir" title="Abrir todas as pastas">⊞</button>
        <button class="btn-icon" id="btn-mio-matriz-retrair" title="Fechar todas as pastas">⊟</button>
        <button class="btn btn-primary btn-sm" id="btn-analyze-matriz-io">▶ Analisar</button>
      </div>
    </div>
    <div class="mapa-container mapa-container--scroll">
      <div class="mio-matriz-mesa">
        <div id="mio-matriz-grade">
          <div class="mapa-placeholder">Carregando…</div>
        </div>
        <div class="mio-matriz-painel" id="mio-matriz-painel">
          <div class="mio-matriz-painel-vazio">Clique numa célula para ver as operações.</div>
        </div>
      </div>
    </div>
    <div class="mio-matriz-legenda" id="mio-matriz-legenda"></div>
  </div>

  <!-- Hotspots -->
  <div class="mapas-tab-content hidden" id="mapa-hotspots">
    <div class="mapa-header">
      <div class="mapa-header-left">
        <span class="mapa-title">Hotspots</span>
        <span class="mapa-desc">Ranking dos arquivos/funções que mais chamam atenção</span>
      </div>
      <div class="mapa-header-right">
        <div class="mapa-toggle" id="hotspots-modo-toggle">
          <button class="mapa-toggle-btn active" data-modo="linhas">Mais linhas de código</button>
          <button class="mapa-toggle-btn" data-modo="chamadas">Mais chamados</button>
        </div>
        <!-- Quantos entram no ranking. Barra separada da de cima porque são duas
             perguntas: aquela escolhe o critério, esta o tamanho da lista. -->
        <div class="mapa-toggle" id="hotspots-topo-toggle">
          <button class="mapa-toggle-btn"        data-topo="5">5</button>
          <button class="mapa-toggle-btn active" data-topo="15">15</button>
          <button class="mapa-toggle-btn"        data-topo="30">30</button>
          <button class="mapa-toggle-btn"        data-topo="50">50</button>
        </div>
        <span class="mapa-stat" id="hotspots-stat"></span>
        <button class="btn btn-utility btn-sm" id="btn-hotspots-copiar-todos">📋 Copiar todos</button>
      </div>
    </div>
    <div class="mapa-container mapa-container--scroll" id="hotspots-container">
      <div class="mapa-placeholder">Carregando ranking…</div>
    </div>
  </div>

  <!-- Dispersão -->
  <div class="mapas-tab-content hidden" id="mapa-dispersao">
    <div class="mapa-header">
      <div class="mapa-header-left">
        <span class="mapa-title">Dispersão</span>
        <span class="mapa-desc">Cada ponto é um arquivo — cruza duas métricas de uma vez</span>
      </div>
      <div class="mapa-header-right">
        <div class="mapa-toggle" id="dispersao-modo-toggle">
          <button class="mapa-toggle-btn active" data-modo="dependencias">Linhas × Dependências</button>
          <button class="mapa-toggle-btn"        data-modo="dependentes">Linhas × Chamado por</button>
        </div>
        <span class="mapa-stat" id="dispersao-stat"></span>
      </div>
    </div>
    <div class="mapa-container mapa-container--scroll" id="dispersao-container">
      <div class="mapa-placeholder">Carregando dispersão…</div>
    </div>
  </div>

  <!-- Proporção -->
  <div class="mapas-tab-content hidden" id="mapa-proporcao">
    <div class="mapa-header">
      <div class="mapa-header-left">
        <span class="mapa-title">Proporção</span>
        <span class="mapa-desc">Percentual de linhas de código por linguagem no projeto inteiro</span>
      </div>
      <div class="mapa-header-right">
        <span class="mapa-stat" id="proporcao-stat"></span>
      </div>
    </div>
    <div class="mapa-container mapa-container--scroll" id="proporcao-container">
      <div class="mapa-placeholder">Carregando proporção…</div>
    </div>
  </div>

  <!-- Painel -->
  <div class="mapas-tab-content hidden" id="mapa-painel">
    <div class="mapa-header">
      <div class="mapa-header-left">
        <span class="mapa-title">Painel</span>
        <span class="mapa-desc">Medidores de saúde geral do projeto — não é sobre um arquivo específico</span>
      </div>
      <div class="mapa-header-right">
        <span class="mapa-stat" id="painel-stat"></span>
      </div>
    </div>
    <div class="mapa-container mapa-container--scroll" id="painel-container">
      <div class="mapa-placeholder">Carregando painel…</div>
    </div>
  </div>

  <!-- Treemap -->
  <div class="mapas-tab-content hidden" id="mapa-treemap">
    <div class="mapa-header">
      <div class="mapa-header-left">
        <span class="mapa-title">Treemap de Arquivos</span>
        <span class="mapa-desc">Tamanho proporcional às linhas de código</span>
      </div>
      <div class="mapa-header-right">
        <div class="mapa-toggle" id="treemap-cor-toggle">
          <button class="mapa-toggle-btn active" data-cor="linguagem">Linguagem</button>
          <button class="mapa-toggle-btn" data-cor="complexidade" title="Complexidade ciclomática — verde (simples) → vermelho (muitos caminhos)">Complexidade</button>
        </div>
        <span class="mapa-stat" id="treemap-stat"></span>
        <button class="btn btn-utility btn-sm" id="btn-treemap-enquadrar" title="Volta ao desenho inteiro — o mesmo que clicar com a rodinha">⤢ Enquadrar</button>
        <button class="btn btn-primary btn-sm" id="btn-analyze-treemap">▶ Analisar</button>
      </div>
    </div>
    <div class="mapa-container" id="treemap-container">
      <div class="mapa-placeholder">Clique em <strong>Analisar</strong> para gerar o treemap.</div>
    </div>
  </div>

  <!-- Sunburst -->
  <div class="mapas-tab-content hidden" id="mapa-sunburst">
    <div class="mapa-header">
      <div class="mapa-header-left">
        <span class="mapa-title">Sunburst — Hierarquia de Pastas</span>
        <span class="mapa-desc">Cada anel é um nível de pasta — arco proporcional às linhas de código</span>
        <!-- O arco sob o cursor. Já foi uma etiqueta flutuante no miolo da
             rosca, mas ela é ancorada na tela e o desenho se move com o
             zoom/pan: bastava ampliar para o texto cair em cima dos arcos. -->
        <span class="mapa-desc sunburst-hover" id="sunburst-hover"></span>
      </div>
      <div class="mapa-header-right">
        <span class="mapa-stat" id="sunburst-stat"></span>
        <button class="btn btn-primary btn-sm" id="btn-analyze-sunburst">▶ Analisar</button>
      </div>
    </div>
    <div class="mapa-container" id="sunburst-container">
      <div class="mapa-placeholder">Clique em <strong>Analisar</strong> para gerar o sunburst.</div>
    </div>
  </div>

  <!-- Ligações — quem chama quem, navegável. Duas leituras, Pastas e Impacto, com
       a posição decidida por regra: não há física, não há força-dirigido, não há
       nada que negocie posição (foi exatamente isso que virou bola de neve e saiu
       daqui). Foco local, Arquitetura, Camadas, Ciclos e Caminho saíram da tela em
       2026-09 (D62: o resto ficava muito confuso); os motores de três deles
       continuam, porque o Mapa da mudança da aba Backups os usa. -->
  <div class="mapas-tab-content hidden" id="mapa-ligacoes">
    <div class="mapa-header">
      <div class="mapa-header-left">
        <span class="mapa-title">Ligações</span>
        <span class="mapa-desc">Quem chama quem — clique num arquivo para ver o impacto dele</span>
        <span class="mapa-caminho" id="ligacoes-caminho"></span>
      </div>
      <!-- A estatística fica ABAIXO dos controles, não entre eles: ela varia de
           ~45 a ~85 caracteres conforme o modo, e no meio da linha fazia o
           botão Analisar mudar de lugar a cada troca de modo. -->
      <div class="mapa-header-right mapa-header-right--coluna">
        <div class="mapa-header-controles">
          <div class="mapa-toggle" id="ligacoes-modo-toggle">
            <button class="mapa-toggle-btn active" data-modo="pastas">Pastas</button>
            <button class="mapa-toggle-btn"        data-modo="impacto">Impacto</button>
          </div>
          <!-- A busca é da vista Pastas: some no Impacto, onde quem escolhe o
               arquivo é o Foco do painel de controles. -->
          <input type="search" class="bsa-input ligacoes-busca" id="ligacoes-busca"
                 placeholder="Buscar arquivo ou função…"
                 title="Mostra só as pastas com um arquivo cujo caminho — ou um nome que ele define — contém o texto">
          <button class="btn btn-muted btn-sm" id="btn-analyze-ligacoes"
                  title="A sub-aba já analisa ao abrir; isto lê o projeto de novo, para pegar o que mudou desde então">↻ Reanalisar</button>
        </div>
        <span class="mapa-stat" id="ligacoes-stat"></span>
      </div>
    </div>
    <div class="mapa-container" id="ligacoes-container">
      <div class="mapa-loading">Analisando…</div>
    </div>
    <!-- O que está sendo escondido, dito na cara: esconder em silêncio é o
         defeito que esta obra veio consertar, não repetir. -->
    <div class="ligacoes-aviso" id="ligacoes-aviso" style="display:none"></div>
  </div>

  <!-- Controles de Ligações — fora das sub-abas, como o painel da Matriz.
       Só aparece depois que o dado chega: antes disso não há o que filtrar. -->
  <div id="ligacoes-controls" class="mapas-controls-panel" style="display:none">
    <div class="mapas-ctrl-row">
      <label class="mapas-ctrl-label">Fonte</label>
      <select class="mapas-ctrl-select" id="ctrl-lig-fonte">
        <option value="identificadores">Índice de Identificadores</option>
        <option value="imports">Imports</option>
        <option value="chamadas">Call graph</option>
      </select>
    </div>
    <div class="mapas-ctrl-row" data-lig-so="impacto">
      <label class="mapas-ctrl-label">Foco</label>
      <select class="mapas-ctrl-select" id="ctrl-lig-foco"></select>
    </div>
    <div class="mapas-ctrl-row" data-lig-so="impacto">
      <label class="mapas-ctrl-label">Profundidade</label>
      <input type="range" id="ctrl-lig-prof" min="1" max="4" step="1" value="2">
      <span class="mapas-ctrl-val" id="ctrl-lig-prof-val">2</span>
    </div>
    <div class="mapas-ctrl-row">
      <label class="mapas-ctrl-label" title="Esconde aresta sustentada por poucos nomes">Peso mín.</label>
      <input type="range" id="ctrl-lig-peso" min="1" max="10" step="1" value="1">
      <span class="mapas-ctrl-val" id="ctrl-lig-peso-val">1</span>
    </div>
    <div class="mapas-ctrl-row">
      <label class="mapas-ctrl-label" title="Esconde arquivo com mais ligações que o teto — é o que resolve utils.js e afins. O Impacto abre com ele ligado (Configurações › Desempenho dos mapas)">Ocultar hub</label>
      <input type="range" id="ctrl-lig-hub" min="5" max="120" step="5" value="120">
      <span class="mapas-ctrl-val" id="ctrl-lig-hub-val">off</span>
    </div>
    <div class="mapas-ctrl-row">
      <button class="mapas-ctrl-btn" id="btn-lig-centralizar">Centralizar</button>
    </div>
  </div>
`;
