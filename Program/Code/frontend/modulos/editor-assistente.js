// ══════════════ EDITOR: O QUE O ASSISTENTE SABE SOBRE ESTE ARQUIVO ══
// O grupo "Assistente" do menu de contexto. Três dos quatro itens só existem
// porque o programa JÁ SABE a resposta — o que falta é o caminho até ela sem
// atravessar duas abas à mão.
//
// ⚠️ Mostra em MODAL, e não navega para a aba de origem. Levar o usuário para a
// aba Análise e selecionar o arquivo lá pareceria mais integrado e custaria
// caro: o Editor passaria a depender do estado interno de outras duas telas
// (qual sub-aba está aberta, qual árvore está montada, se o índice já carregou),
// e cada mudança lá quebraria aqui em silêncio. O modal lê o mesmo dado pela
// mesma rota e não acopla nada.

function _edAssistModal(titulo, corpo) {
  abrirModalPadrao({
    title: titulo,
    bodyHtml: corpo,
    confirmLabel: 'Fechar',
    onConfirm: () => true,
    classe: 'modal-grande',
    // Só leitura — nada aqui pra confirmar OU cancelar. Dois botões
    // perguntando a mesma coisa ("Fechar" e "Cancelar") era o que confundia.
    semCancelar: true,
  });
}

// Cada item de `get_relacoes` é `{arquivo, via}` — `via` são os identificadores
// que ligam os dois. É a parte que responde "por onde", e sem ela a lista é só
// uma lista de caminhos.
function _edAssistLista(titulo, itens, vazio) {
  if (!itens || !itens.length) {
    return `<label>${escapeHtml(titulo)}</label>
            <p class="modal-dica">${escapeHtml(vazio)}</p>`;
  }
  return `<label>${escapeHtml(titulo)} (${itens.length})</label>
    <div class="ed-assist-lista">${itens.map((i) => `
      <div class="ed-assist-item">
        <span class="ed-assist-arq">${escapeHtml(i.arquivo || String(i))}</span>
        ${(i.via && i.via.length)
          ? `<span class="ed-assist-via">${escapeHtml(i.via.slice(0, 4).join(', '))}${i.via.length > 4 ? '…' : ''}</span>`
          : ''}
      </div>`).join('')}</div>`;
}

// A cascata — mesmo dado e o mesmo agrupamento por nível que
// `relacoes.js::_renderCascata` (aba Análise → Relações) já usa. Reaproveitado
// aqui porque o usuário pediu explicitamente a mesma visão, e não só a lista
// plana de "quem usa"/"do que depende".
function _edAssistCascataHtml(cascata) {
  if (!cascata || !cascata.niveis || !cascata.niveis.length) {
    return '<label>Cascata — indiretos</label><p class="modal-dica">Nenhum indireto encontrado.</p>';
  }
  const linhas = cascata.niveis.map((n) => n.itens.map((item) => `
      <div class="ed-assist-item">
        <span class="ed-assist-nivel">nível ${n.nivel}</span>
        <span class="ed-assist-arq">${escapeHtml(item.arquivo)}</span>
        <span class="ed-assist-via">${escapeHtml((item.via || []).slice(0, 4).join(', '))}
          ${item.atraves_de ? ` · via ${escapeHtml(item.atraves_de.split('/').pop())}` : ''}</span>
      </div>`).join('')).join('');
  const restantes = cascata.restantes > 0
    ? `<p class="modal-dica">… e mais ${cascata.restantes} arquivo(s) em nível mais profundo, recolhidos.</p>` : '';
  return `<label>Cascata — indiretos</label><div class="ed-assist-lista">${linhas}</div>${restantes}`;
}

// eslint-disable-next-line no-unused-vars
const editorAssistente = {

  async quemUsa(caminho) {
    const [r, cascata] = await Promise.all([
      window.pywebview.api.get_relacoes(currentProject, caminho),
      window.pywebview.api.get_cascata(currentProject, caminho),
    ]);
    if (!r || !r.success) {
      showToast((r && r.error) || 'O Índice de Identificadores ainda não foi gerado para este projeto.', true);
      return;
    }
    _edAssistModal(`Relações de ${caminho.split('/').pop()}`,
      `<p class="modal-dica"><code>${escapeHtml(caminho)}</code></p>`
      + _edAssistLista('Quem usa este arquivo', r.usado_por,
                       'Ninguém cita nada deste arquivo — mudar a interface dele não quebra nada indexado.')
      + _edAssistLista('Do que ele depende', r.usa,
                       'Ele não cita identificador de nenhum outro arquivo.')
      + _edAssistCascataHtml(cascata && cascata.success ? cascata : null));
  },

  async verDocumentacao(caminho) {
    const d = await window.pywebview.api.editor_documento_do_arquivo(currentProject, caminho);
    if (!d.success) { showToast(d.error, true); return; }
    for (const agente of ['documentacao-tecnica']) {
      const r = await window.pywebview.api.read_agent_file(currentProject, agente, d.chave);
      if (r && r.success && r.content) {
        _edAssistModal(caminho.split('/').pop(),
          `<p class="modal-dica">Documentação técnica
            · <code>${escapeHtml(d.chave)}</code></p>
           <div class="ed-assist-doc">${_docMarked.parse(r.content)}</div>`);
        return;
      }
    }
    showToast('Este arquivo ainda não tem documentação gerada. Rode o agente em Automação → Rotinas.', true);
  },

  // Equivalente de `verDocumentacao`, para PASTA — mesmo agente que
  // `editorArquivos.copiarCaminhoEResumoDaPasta` já lê, só que mostrado no
  // modal em vez de copiado para a área de transferência.
  async verResumoDaPasta(caminho) {
    const c = await window.pywebview.api.editor_chaves_do_resumo_da_pasta(currentProject, caminho);
    if (!c.success) { showToast(c.error, true); return; }
    const partes = [];
    for (const chave of c.chaves) {
      // eslint-disable-next-line no-await-in-loop
      const r = await window.pywebview.api.read_agent_file(currentProject, 'resumo-pastas', chave);
      if (r && r.success && r.content) partes.push(r.content);
    }
    if (!partes.length) { showToast('Não deu para ler o resumo desta pasta.', true); return; }
    _edAssistModal(caminho.split('/').pop() || '(raiz)',
      `<p class="modal-dica">Resumo de pastas · <code>${escapeHtml(caminho || '(raiz)')}</code></p>
       <div class="ed-assist-doc">${_docMarked.parse(partes.join('\n\n'))}</div>`);
  },

  // O rótulo do menu fica fixo — quem decide o sentido (adicionar ou
  // remover) é este popup, checando o estado no instante do clique (D9/D16).
  // `grupo`, quando vem com mais de um item (seleção múltipla — Obra 6), faz
  // a ação valer para todos: se TODOS já estão no contexto, remove todos; senão
  // adiciona os que faltam, com a mesma descrição para o lote.
  async adicionarAoContexto(caminho, grupo) {
    const lista = (grupo && grupo.length > 1) ? grupo : [caminho];
    const varios = lista.length > 1;
    const absolutos = await Promise.all(
      lista.map((c) => window.pywebview.api.editor_caminho_absoluto(currentProject, c)));
    const falha = absolutos.find((a) => !a.success);
    if (falha) { showToast(falha.error, true); return; }
    // `workspaceConfig` é o global que a aba Projeto mantém; `saveWorkspace()`
    // é quem grava. Reusar os dois é o que faz o item aparecer na lista de
    // Contexto sem uma segunda fonte de verdade.
    if (typeof workspaceConfig === 'undefined' || !workspaceConfig) {
      showToast('Abra o projeto antes de acrescentar ao contexto.', true);
      return;
    }
    workspaceConfig.context_items = workspaceConfig.context_items || [];
    const caminhosAbs = absolutos.map((a) => a.caminho);
    const nome = caminho.split('/').pop();
    const rotuloAlvo = varios ? `${lista.length} itens` : `<b>${escapeHtml(nome)}</b><br><code>${escapeHtml(caminho)}</code>`;
    const todosNoContexto = caminhosAbs.every((c) => workspaceConfig.context_items.some((i) => i.path === c));

    if (todosNoContexto) {
      abrirModalPadrao({
        title: varios ? `Remover ${lista.length} itens do contexto sem leitura?` : 'Remover do contexto sem leitura?',
        bodyHtml: `<p class="modal-dica">${rotuloAlvo}</p>`,
        confirmLabel: 'Remover',
        onConfirm: async () => {
          workspaceConfig.context_items = workspaceConfig.context_items.filter(
            (i) => !caminhosAbs.includes(i.path));
          await saveWorkspace();
          if (typeof renderContextList === 'function') renderContextList();
          showToast(varios ? `${lista.length} removidos do contexto sem leitura.` : 'Removido do contexto sem leitura.');
        },
      });
      return;
    }

    abrirModalPadrao({
      title: varios ? `Adicionar ${lista.length} itens ao contexto sem leitura?` : 'Adicionar ao contexto sem leitura?',
      bodyHtml: `
        <p class="modal-dica">${rotuloAlvo}</p>
        <label>Descreva o que ${varios ? 'estes itens representam' : 'este arquivo/pasta representa'} (opcional)</label>
        <textarea class="modal-textarea" data-f="descricao" rows="3"
                  placeholder="Descreva o que este arquivo/pasta representa..."></textarea>`,
      confirmLabel: 'Adicionar',
      onConfirm: async (o) => {
        const descricao = o.querySelector('[data-f="descricao"]').value.trim();
        caminhosAbs.forEach((c) => {
          if (!workspaceConfig.context_items.some((i) => i.path === c)) {
            workspaceConfig.context_items.push({ path: c, description: descricao });
          }
        });
        await saveWorkspace();
        if (typeof renderContextList === 'function') renderContextList();
        showToast(varios ? `${lista.length} acrescentados ao contexto sem leitura.` : 'Acrescentado ao contexto sem leitura.');
      },
    });
  },

  // Mesma estrutura de `adicionarAoContexto`, mexendo em `ignore_list` em vez
  // de `context_items` — formato de item que `remover.js` já usa:
  // `{ path, type: 'file'|'folder', recursive, quem_pode_ler }`. Sem campo de
  // descrição: essa lista nunca teve um, e `quem_pode_ler` fica de fora até o
  // usuário mudar isso na sub-aba Remover (mesmo padrão de
  // `browseAndAddIgnoreFile`, que também não escreve esse campo ao criar).
  async alternarNaListaRemover(caminho, ehPasta, grupo) {
    const lista = (grupo && grupo.length > 1) ? grupo : [caminho];
    const varios = lista.length > 1;
    const absolutos = await Promise.all(
      lista.map((c) => window.pywebview.api.editor_caminho_absoluto(currentProject, c)));
    const falha = absolutos.find((a) => !a.success);
    if (falha) { showToast(falha.error, true); return; }
    if (typeof workspaceConfig === 'undefined' || !workspaceConfig) {
      showToast('Abra o projeto antes de acrescentar à lista remover.', true);
      return;
    }
    workspaceConfig.ignore_list = workspaceConfig.ignore_list || [];
    const caminhosAbs = absolutos.map((a) => a.caminho);
    const nome = caminho.split('/').pop();
    const rotuloAlvo = varios ? `${lista.length} itens` : `<b>${escapeHtml(nome)}</b><br><code>${escapeHtml(caminho)}</code>`;
    const todosNaLista = caminhosAbs.every((c) => workspaceConfig.ignore_list.some((i) => i.path === c));

    const atualizarTelas = () => {
      if (typeof renderIgnoreList === 'function') renderIgnoreList();
      if (typeof loadSummary === 'function') loadSummary();
    };

    if (todosNaLista) {
      abrirModalPadrao({
        title: varios ? `Remover ${lista.length} itens da lista remover?` : 'Remover da lista remover?',
        bodyHtml: `<p class="modal-dica">${rotuloAlvo}</p>`,
        confirmLabel: 'Remover',
        onConfirm: async () => {
          workspaceConfig.ignore_list = workspaceConfig.ignore_list.filter(
            (i) => !caminhosAbs.includes(i.path));
          await saveWorkspace();
          atualizarTelas();
          showToast(varios ? `${lista.length} removidos da lista remover.` : 'Removido da lista remover.');
        },
      });
      return;
    }

    abrirModalPadrao({
      title: varios ? `Adicionar ${lista.length} itens à lista remover?` : 'Adicionar à lista remover?',
      bodyHtml: `<p class="modal-dica">${rotuloAlvo}</p>`,
      confirmLabel: 'Adicionar',
      onConfirm: async () => {
        caminhosAbs.forEach((c) => {
          if (!workspaceConfig.ignore_list.some((i) => i.path === c)) {
            workspaceConfig.ignore_list.push({ path: c, type: ehPasta ? 'folder' : 'file', recursive: false });
          }
        });
        await saveWorkspace();
        atualizarTelas();
        showToast(varios ? `${lista.length} acrescentados à lista remover.` : 'Acrescentado à lista remover.');
      },
    });
  },
};
