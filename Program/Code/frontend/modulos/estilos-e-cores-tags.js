// ════════════════════════ ESTILOS E CORES: o CRUD das tags ══
//
// Duas telas: o gerenciador (criar, renomear, remover uma tag) e o editor de
// tags de um item (atribuir e tirar).
//
// ⚠️ Tudo aqui mexe SÓ no `tags.json`. A tag nunca é gravada dentro do arquivo do
// item — nem campo `tags` no JSON da paleta, nem `<meta>` no HTML do estilo. É o
// índice central que responde "quem tem esta tag", e é ele que permite renomear
// uma tag numa edição só em vez de reescrever 47 arquivos.
//
// O conceito chama `tag` no código e "Tags" na tela. Nunca "etiqueta": esse nome
// já é a classe de um achado de texto na aba Aparência, e usar a mesma palavra
// para os dois faria a próxima sessão "corrigir" um deles.

// Quantos itens usam cada tag — o gerenciador precisa disso para avisar o que a
// remoção vai desmarcar.
function ecUsosPorTag(indice) {
  const usos = {};
  for (const tags of Object.values(indice.itens || {})) {
    for (const tag of tags) usos[tag] = (usos[tag] || 0) + 1;
  }
  return usos;
}

async function ecAbrirGerenciadorDeTags() {
  const indice = await window.pywebview.api.carregar_tags_de_estilos_e_cores();
  if (!indice || !indice.success) { showToast('Erro ao ler as tags.', true); return; }
  const usos = ecUsosPorTag(indice);

  const overlay = abrirModalPadrao({
    title: 'Gerenciar tags',
    confirmLabel: 'Fechar',
    bodyHtml: `
      <div class="modal-body-text">A tag mora só no <code>tags.json</code>, nunca dentro do arquivo do item. Renomear aqui vale para todos os itens de uma vez.</div>
      <div class="ec-taglista"></div>
      <label>Nova tag</label>
      <div class="ec-tagnova">
        <input type="text" data-f="nova" placeholder="ex.: denso, leitura, ferramenta">
        <button type="button" class="btn btn-special btn-sm ec-tagnova-btn">Criar</button>
      </div>`,
    onConfirm: async () => true,
  });

  const lista = overlay.querySelector('.ec-taglista');
  const recarregar = async () => {
    const novo = await window.pywebview.api.carregar_tags_de_estilos_e_cores();
    ecPintarListaDeTags(lista, novo, ecUsosPorTag(novo), recarregar);
    // A barra de filtros e os selos dos cards saem do mesmo índice.
    ecAbrirDimensao(ecDimensaoAtiva, true);
  };
  ecPintarListaDeTags(lista, indice, usos, recarregar);

  const campo = overlay.querySelector('[data-f="nova"]');
  const criar = async () => {
    const nome = campo.value.trim();
    if (!nome) return;
    const r = await window.pywebview.api.criar_tag_de_estilos_e_cores(nome);
    if (!r || !r.success) { showToast((r && r.error) || 'Erro ao criar a tag.', true); return; }
    campo.value = '';
    await recarregar();
  };
  overlay.querySelector('.ec-tagnova-btn').addEventListener('click', criar);
  campo.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); criar(); } });
}

function ecPintarListaDeTags(lista, indice, usos, recarregar) {
  lista.innerHTML = '';
  if (!indice.tags.length) {
    lista.innerHTML = '<div class="ec-tagvazio">Nenhuma tag ainda. Quem cria as tags é você.</div>';
    return;
  }
  for (const tag of indice.tags) {
    const linha = document.createElement('div');
    linha.className = 'ec-taglinha';
    linha.innerHTML = `
      <input type="text" class="ec-tagnome" value="${escapeHtml(tag)}">
      <span class="ec-tagusos">${usos[tag] || 0} ${(usos[tag] || 0) === 1 ? 'item' : 'itens'}</span>
      <button type="button" class="arq-mini-btn ec-tagsalvar">renomear</button>
      <button type="button" class="arq-mini-btn arq-del-btn ec-tagremover" title="Remover a tag de todos os itens">✕ remover</button>`;

    linha.querySelector('.ec-tagsalvar').addEventListener('click', async () => {
      const novo = linha.querySelector('.ec-tagnome').value.trim();
      if (!novo || novo === tag) return;
      const r = await window.pywebview.api.renomear_tag_de_estilos_e_cores(tag, novo);
      if (!r || !r.success) { showToast((r && r.error) || 'Erro ao renomear.', true); return; }
      showToast(`Tag renomeada para "${novo}".`);
      await recarregar();
    });

    // Confirma antes de apagar, como todo o resto da biblioteca. Esta era a
    // única lixeira do programa que apagava no clique — e a que mais custa
    // caro, porque uma tag removida leva junto a marcação de todos os itens que
    // a usavam, e não há como saber quais eram depois.
    linha.querySelector('.ec-tagremover').addEventListener('click', () => {
      const quantos = usos[tag] || 0;
      const desmarca = quantos
        ? `Ela sai de <strong>${quantos} ${quantos === 1 ? 'item' : 'itens'}</strong> que a usam hoje — os itens continuam na biblioteca, só perdem esta tag.`
        : 'Nenhum item usa esta tag no momento.';
      abrirModalPadrao({
        title: 'Remover a tag?',
        confirmLabel: 'Remover',
        bodyHtml: `<div class="modal-body-text">Isto apaga a tag <strong>${escapeHtml(tag)}</strong> da biblioteca. ${desmarca} Não dá pra desfazer.</div>`,
        onConfirm: async (ov, showErr) => {
          const r = await window.pywebview.api.deletar_tag_de_estilos_e_cores(tag);
          if (!r || !r.success) { showErr((r && r.error) || 'Erro ao remover.'); return false; }
          showToast(`Tag "${tag}" removida.`);
          await recarregar();
          return true;
        },
      });
    });

    lista.appendChild(linha);
  }
}

// Atribuir e tirar numa operação só: o que estiver marcado ao confirmar passa a
// ser a lista de tags do item.
function ecEditarTagsDoItem(dados, item) {
  const todas = dados.tags.slice();
  const marcadas = new Set(item.tags);
  const caixas = todas.map(tag => `
    <label class="ec-tagopcao">
      <input type="checkbox" value="${escapeHtml(tag)}"${marcadas.has(tag) ? ' checked' : ''}>
      ${escapeHtml(tag)}
    </label>`).join('');

  abrirModalPadrao({
    title: `Tags de "${item.nome}"`,
    confirmLabel: 'Salvar',
    bodyHtml: `
      ${todas.length ? `<div class="ec-tagopcoes">${caixas}</div>`
                     : '<div class="modal-body-text">Nenhuma tag existe ainda. Crie a primeira em "gerenciar tags", ou escreva uma abaixo.</div>'}
      <label>Acrescentar uma tag nova</label>
      <input type="text" data-f="nova" placeholder="ela é criada junto, se ainda não existir">`,
    onConfirm: async (ov, showErr) => {
      const escolhidas = [...ov.querySelectorAll('.ec-tagopcao input:checked')].map(c => c.value);
      const nova = ov.querySelector('[data-f="nova"]').value.trim();
      if (nova && !escolhidas.includes(nova)) escolhidas.push(nova);
      const r = await window.pywebview.api.definir_tags_do_item_de_estilos_e_cores(item.caminho, escolhidas);
      if (!r || !r.success) { showErr((r && r.error) || 'Erro ao salvar as tags.'); return false; }
      ecAbrirDimensao(dados.dimensao, true);
      return true;
    },
  });
}
