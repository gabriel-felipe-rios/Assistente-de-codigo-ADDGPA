// ═══ ABA: BACKUPS — a casca com as três sub-abas ═══════════════════════════
//
// O markup desta aba morava inline no index.html — era a única aba de conteúdo
// sem template. Saiu de lá porque agora são três painéis, e três painéis
// inline no index engordam um arquivo que já é o mais longo do frontend.
//
// ⚠️ O id `tab-git` é HERDADO e não se renomeia: ele aparece em `navegacao.js`,
// na ordem das abas e na configuração salva do usuário. O rótulo da aba é
// **Backups**, e a palavra "commit" não aparece em lugar nenhum desta tela.
//
// O padrão de sub-aba é o mesmo do Assistente e da Automação:
// `.agentes-subtabs-bar` + `_wireSubtabBar(escopo, dispatch)`, com o escopo
// preso a `#tab-git`. A barra genérica `.subtab-btn` NÃO serve aqui: a fiação
// dela é global (`document.querySelectorAll`), e uma segunda aba usando as
// mesmas classes trocaria de painel nas duas ao mesmo tempo.

document.getElementById('tab-git').innerHTML = `
  <div class="agentes-subtabs-bar" data-taborder-group="backups_subtabs"
       data-taborder-label="Sub-abas de Backups" data-taborder-parent="tab-git">
    <button class="agentes-subtab-btn active" data-asubtab="bksub-versoes">Versões</button>
    <button class="agentes-subtab-btn" data-asubtab="bksub-mapa">Mapa da mudança</button>
    <button class="agentes-subtab-btn" data-asubtab="bksub-config">Configuração</button>
  </div>

  <div id="bksub-versoes" class="agentes-subtab-content active">
    <div class="screen-body">
      <div class="bk-header">
        <div class="bk-sec-h">Cópias salvas <span class="bk-count" id="bk-count">0</span></div>
        <button class="btn btn-positive btn-sm" id="bk-btn-create">📸 Fazer cópia</button>
        <span class="bk-status" id="bk-status"></span>
      </div>
      <div class="bk-list" id="bk-list"></div>
      <div class="bk-empty hidden" id="bk-empty">
        Nenhuma Versão ainda. Clique em “Fazer cópia” para criar a primeira.
      </div>
    </div>
  </div>

  <div id="bksub-mapa" class="agentes-subtab-content hidden"></div>
  <div id="bksub-config" class="agentes-subtab-content hidden"></div>
`;
