// ═══════════════════════════════════════════════ MODAL "GERENCIAR PROJETOS" ══
// Taxonomia de grupos/subgrupos/tags — construído com `abrirModalPadrao`
// (regra do projeto: modal novo nunca é `.modal-overlay` escrito à mão).
//
// Cada ação (renomear, trocar cor, criar, apagar) já grava no backend na
// hora — o botão "Salvar" do rodapé só fecha e manda o quadro repintar; não
// existe estado "não salvo" para descartar, mesmo padrão de
// `estilos-e-cores-tags.js` (o "Fechar" de lá também não desfaz nada). Cada
// mutação reconstrói o corpo do modal inteiro a partir da taxonomia
// recarregada — mais simples e mais robusto que remendar o DOM ação por ação.

// Pedido do usuário: as 8 cores originais (tons puros/de app, tipo
// `--blue`/`--red` do tema) ficavam "com a saturação muito alta" quando
// usadas como tingimento de coluna/subgrupo — aqui embaixo, cada uma é uma
// versão dessaturada da mesma família de cor. Conjunto: azul, amarelo,
// laranja, verde, vermelho, preto (neutro escuro) e branco (neutro claro).
const PALETA_CORES_PROJETOS = [
  '#6C93B8', // azul
  '#D8BE6B', // amarelo
  '#C98F5E', // laranja
  '#7FA98C', // verde
  '#B8695F', // vermelho
  '#3A3F44', // preto (neutro escuro)
  '#DEE2E6', // branco (neutro claro)
];

function abrirModalGerenciarProjetos() {
  _renderGerenciarProjetos();
}

async function _renderGerenciarProjetos() {
  const tax = await taxCarregar(true);
  const existente = document.querySelector('.gp-overlay');
  if (existente) existente.remove();

  const overlay = abrirModalPadrao({
    title: 'Gerenciar Projetos',
    bodyHtml: _gpMarkup(tax),
    confirmLabel: 'Salvar',
    onConfirm: async () => { if (typeof loadProjects === 'function') await loadProjects(); },
  });
  overlay.classList.add('gp-overlay');
  overlay.querySelector('.modal').classList.add('modal-wide');
  _ligarGerenciarProjetos(overlay);
}

// Linha de atalhos de cor — some cliques rápidos além do seletor nativo
// (`<input type="color">`), que é quem dá acesso a QUALQUER cor, não só às
// oito daqui. `sufixo` distingue o `data-*` de quem lê o clique (grupo vs tag).
function _gpPaletaRapida(id, sufixo) {
  return PALETA_CORES_PROJETOS.map(c =>
    `<button type="button" class="gp-cor-rapida-${sufixo}" data-${sufixo}-id="${escapeHtml(id)}" data-cor="${c}" style="background:${c}" title="${c}"></button>`
  ).join('');
}

function _gpMarkup(tax) {
  const gruposHtml = tax.grupos.map(g => `
    <div class="gg-grupo-linha" data-grupo-id="${escapeHtml(g.id)}">
      <div class="gg-grupo-cabecalho">
        <input type="color" class="gg-cor-input gp-cor-grupo-input" data-grupo-id="${escapeHtml(g.id)}"
          value="${escapeHtml(g.cor || '#4a5568')}" title="Cor do grupo" />
        <input type="text" class="gp-nome-grupo" data-grupo-id="${escapeHtml(g.id)}" value="${escapeHtml(g.nome)}" />
        <button type="button" class="gg-icon-btn gp-del-grupo" data-grupo-id="${escapeHtml(g.id)}" title="Apagar grupo">✕</button>
      </div>
      <div class="gg-paleta-rapida">${_gpPaletaRapida(g.id, 'grupo')}</div>
      <!-- Subgrupo é uma linha de verdade, do mesmo formato da linha de grupo
           (cor + nome EDITÁVEL + apagar) — era um chip pequeno, sem campo de
           nome (só dava pra apagar e recriar pra "renomear"), e lia como uma
           tag solta em vez de uma sub-linha do grupo. Fica logo abaixo do
           grupo dela, sempre — nunca misturado com o de outro grupo. -->
      <div class="gg-subgrupos-lista">
        ${(g.subgrupos || []).map(s => `
          <div class="gg-subgrupo-linha" data-grupo-id="${escapeHtml(g.id)}" data-subgrupo-id="${escapeHtml(s.id)}">
            <input type="color" class="gg-cor-input gg-cor-input-sm gp-cor-subgrupo-input"
              data-grupo-id="${escapeHtml(g.id)}" data-subgrupo-id="${escapeHtml(s.id)}"
              value="${escapeHtml(s.cor || '#607D8B')}" title="Cor do subgrupo" />
            <input type="text" class="gp-nome-subgrupo" data-grupo-id="${escapeHtml(g.id)}" data-subgrupo-id="${escapeHtml(s.id)}"
              value="${escapeHtml(s.nome)}" />
            <button type="button" class="gg-icon-btn gp-del-subgrupo" data-grupo-id="${escapeHtml(g.id)}" data-subgrupo-id="${escapeHtml(s.id)}" title="Apagar subgrupo">✕</button>
          </div>`).join('')}
        <span class="gp-add-subgrupo-slot" data-grupo-id="${escapeHtml(g.id)}">
          <button type="button" class="gg-add-subgrupo-btn2 gp-add-subgrupo-btn" data-grupo-id="${escapeHtml(g.id)}">+ subgrupo</button>
        </span>
      </div>
    </div>`).join('');

  const tagsHtml = tax.tags.map(t => `
    <div class="gg-tag-card gp-tag-view" data-tag-id="${escapeHtml(t.id)}">
      <span class="gg-cor-dot" style="width:16px;height:16px;background:${escapeHtml(t.cor)}"></span>
      <span class="gg-tag-nome">${escapeHtml(t.nome)}</span>
    </div>
    <div class="gg-tag-editor hidden" data-tag-id="${escapeHtml(t.id)}">
      <input type="color" class="gg-cor-input gp-cor-tag-input" data-tag-id="${escapeHtml(t.id)}"
        value="${escapeHtml(t.cor)}" title="Cor da tag" />
      <input type="text" class="gp-nome-tag" value="${escapeHtml(t.nome)}" />
      <div class="gg-paleta-rapida">${_gpPaletaRapida(t.id, 'tag')}</div>
      <button type="button" class="gg-icon-btn gp-confirmar-tag" data-tag-id="${escapeHtml(t.id)}">✓</button>
      <button type="button" class="gg-icon-btn gp-del-tag" data-tag-id="${escapeHtml(t.id)}" title="Apagar tag">🗑</button>
    </div>`).join('');

  return `
    <div class="gg-corpo">
      <div>
        <div class="gg-secao-titulo">Grupos</div>
        <div class="gp-lista-grupos">${gruposHtml}</div>
        <span class="gp-add-grupo-slot"><button type="button" class="gg-add-grupo" id="gp-add-grupo-btn">+ Novo grupo</button></span>
      </div>
      <div>
        <div class="gg-secao-titulo">Tags <span class="gg-dica">clique numa tag para editar</span></div>
        <div class="gg-tags-lista">${tagsHtml}
          <span class="gp-add-tag-slot"><button type="button" class="gg-add-subgrupo-chip" id="gp-add-tag-btn">+ nova tag</button></span>
        </div>
      </div>
    </div>`;
}

// Um botão "+ X" vira um input inline + ✓/✕ ao clicar — mesmo gesto em três
// lugares (novo grupo, novo subgrupo, criação de tag), então é uma função só.
//
// ⚠️ O ✕ de CANCELAR não existia — desistir de criar só dava fechando o
// modal inteiro (Cancelar) e abrindo de novo, porque o slot ficava preso no
// estado de input. Cancelar aqui só chama `_renderGerenciarProjetos()`: como
// nada foi gravado ainda, reconstruir a partir da taxonomia já devolve o
// botão "+ X" ao normal — mais simples que guardar o HTML original à parte.
function _gpVirarInputInline(slot, placeholder, aoConfirmar) {
  slot.innerHTML = `
    <input type="text" class="gp-input-inline" placeholder="${escapeHtml(placeholder)}" />
    <button type="button" class="gg-icon-btn gp-confirmar-inline" title="Confirmar">✓</button>
    <button type="button" class="gg-icon-btn gp-cancelar-inline" title="Cancelar">✕</button>`;
  const input = slot.querySelector('input');
  const confirmar = () => { if (input.value.trim()) aoConfirmar(input.value.trim()); };
  slot.querySelector('.gp-confirmar-inline').addEventListener('click', confirmar);
  slot.querySelector('.gp-cancelar-inline').addEventListener('click', () => _renderGerenciarProjetos());
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmar();
    if (e.key === 'Escape') _renderGerenciarProjetos();
  });
  input.focus();
}

function _ligarGerenciarProjetos(overlay) {
  // Grupo: cor pelo seletor nativo (qualquer cor, não só as 8 pré-definidas)
  overlay.querySelectorAll('.gp-cor-grupo-input').forEach(inp => {
    inp.addEventListener('change', async () => {
      taxAtualizarCache(await window.pywebview.api.definir_cor_do_grupo_de_projetos(inp.dataset.grupoId, inp.value));
      _renderGerenciarProjetos();
    });
  });
  // Grupo: cor por atalho rápido (uma das 8 pré-definidas, um clique só)
  overlay.querySelectorAll('.gp-cor-rapida-grupo').forEach(sw => {
    sw.addEventListener('click', async () => {
      taxAtualizarCache(await window.pywebview.api.definir_cor_do_grupo_de_projetos(sw.dataset.grupoId, sw.dataset.cor));
      _renderGerenciarProjetos();
    });
  });
  // Grupo: renomear (commit no blur, sem re-render a cada tecla)
  overlay.querySelectorAll('.gp-nome-grupo').forEach(input => {
    input.addEventListener('blur', async () => {
      taxAtualizarCache(await window.pywebview.api.renomear_grupo_de_projetos(input.dataset.grupoId, input.value));
    });
  });
  // Grupo: apagar
  overlay.querySelectorAll('.gp-del-grupo').forEach(btn => {
    btn.addEventListener('click', () => {
      abrirModalPadrao({
        title: 'Apagar grupo',
        bodyHtml: '<p class="modal-body-text">Os projetos deste grupo caem em "Sem grupo". Os subgrupos dele somem junto. Esta ação não pode ser desfeita.</p>',
        confirmLabel: 'Apagar',
        onConfirm: async () => {
          taxAtualizarCache(await window.pywebview.api.deletar_grupo_de_projetos(btn.dataset.grupoId));
          _renderGerenciarProjetos();
        },
      });
    });
  });
  // Novo grupo
  overlay.querySelector('#gp-add-grupo-btn').addEventListener('click', e => {
    _gpVirarInputInline(e.target.closest('.gp-add-grupo-slot'), 'Nome do grupo', async nome => {
      taxAtualizarCache(await window.pywebview.api.criar_grupo_de_projetos(nome, PALETA_CORES_PROJETOS[0]));
      _renderGerenciarProjetos();
    });
  });
  // Subgrupo: apagar
  overlay.querySelectorAll('.gp-del-subgrupo').forEach(btn => {
    btn.addEventListener('click', async () => {
      taxAtualizarCache(await window.pywebview.api.deletar_subgrupo_de_projetos(btn.dataset.grupoId, btn.dataset.subgrupoId));
      _renderGerenciarProjetos();
    });
  });
  // Subgrupo: renomear (commit no blur, sem re-render a cada tecla) — antes
  // não existia isso: só dava apagar e criar de novo pra trocar o nome.
  overlay.querySelectorAll('.gp-nome-subgrupo').forEach(input => {
    input.addEventListener('blur', async () => {
      taxAtualizarCache(await window.pywebview.api.renomear_subgrupo_de_projetos(
        input.dataset.grupoId, input.dataset.subgrupoId, input.value));
    });
  });
  // Subgrupo: cor própria (independente da cor do grupo)
  overlay.querySelectorAll('.gp-cor-subgrupo-input').forEach(inp => {
    inp.addEventListener('change', async () => {
      taxAtualizarCache(await window.pywebview.api.definir_cor_do_subgrupo_de_projetos(
        inp.dataset.grupoId, inp.dataset.subgrupoId, inp.value));
      _renderGerenciarProjetos();
    });
  });
  // Novo subgrupo — nasce com a próxima cor da paleta (não a mesma do grupo,
  // pra já sair visualmente distinguível dele).
  overlay.querySelectorAll('.gp-add-subgrupo-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const grupoId = btn.dataset.grupoId;
      const grupo = taxGrupo(grupoId);
      const proximaCor = PALETA_CORES_PROJETOS[((grupo && grupo.subgrupos.length) || 0) % PALETA_CORES_PROJETOS.length];
      _gpVirarInputInline(e.target.closest('.gp-add-subgrupo-slot'), 'Nome do subgrupo', async nome => {
        taxAtualizarCache(await window.pywebview.api.criar_subgrupo_de_projetos(grupoId, nome, proximaCor));
        _renderGerenciarProjetos();
      });
    });
  });
  // Tag: clicar no cartão troca pra edição inline
  overlay.querySelectorAll('.gp-tag-view').forEach(view => {
    view.addEventListener('click', () => {
      view.classList.add('hidden');
      overlay.querySelector(`.gg-tag-editor[data-tag-id="${view.dataset.tagId}"]`).classList.remove('hidden');
    });
  });
  // Tag: atalho rápido só ESCREVE no seletor nativo — o ✓ é quem grava os
  // dois campos juntos (nome + cor), lendo o valor que estiver ali na hora.
  overlay.querySelectorAll('.gp-cor-rapida-tag').forEach(sw => {
    sw.addEventListener('click', () => {
      sw.closest('.gg-tag-editor').querySelector('.gp-cor-tag-input').value = sw.dataset.cor;
    });
  });
  overlay.querySelectorAll('.gp-confirmar-tag').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tagId = btn.dataset.tagId;
      const editor = overlay.querySelector(`.gg-tag-editor[data-tag-id="${tagId}"]`);
      const nome = editor.querySelector('.gp-nome-tag').value;
      const cor = editor.querySelector('.gp-cor-tag-input').value;
      taxAtualizarCache(await window.pywebview.api.renomear_tag_de_projetos(tagId, nome));
      taxAtualizarCache(await window.pywebview.api.definir_cor_da_tag_de_projetos(tagId, cor));
      _renderGerenciarProjetos();
    });
  });
  overlay.querySelectorAll('.gp-del-tag').forEach(btn => {
    btn.addEventListener('click', async () => {
      taxAtualizarCache(await window.pywebview.api.deletar_tag_de_projetos(btn.dataset.tagId));
      _renderGerenciarProjetos();
    });
  });
  // Nova tag
  overlay.querySelector('#gp-add-tag-btn').addEventListener('click', e => {
    _gpVirarInputInline(e.target.closest('.gp-add-tag-slot'), 'Nome da tag', async nome => {
      taxAtualizarCache(await window.pywebview.api.criar_tag_de_projetos(nome, PALETA_CORES_PROJETOS[0]));
      _renderGerenciarProjetos();
    });
  });
}
