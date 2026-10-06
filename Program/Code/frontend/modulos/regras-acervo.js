// ══ ACERVO → arquivo livre, preset e busca ════════════════════════════════
//
// Gravar e apagar um arquivo solto de qualquer pasta editável do preset, a
// escolha do preset do Acervo (que é POR PROJETO), e as duas buscas.
//
// ⚠️ O PRESET DO ACERVO É POR PROJETO, e é ele que define QUAIS sub-abas
// existem. Não são três pastas fixas: um projeto pode ter outras. Cravar a
// lista no código é o que esta tela deixou de fazer.
//
// ⚠️ SÃO DUAS BUSCAS, E ELAS RESPONDEM COISAS DIFERENTES. `regrasFilterByName`
// filtra o que já está na tela, sem ir ao disco; `regrasSearch` pergunta ao
// backend pelo CONTEÚDO. Unificá-las faria a primeira ficar lenta ou a segunda
// ficar cega.
// ── Escrita — arquivo livre do Acervo (qualquer pasta editável ≠ especial) ──

async function salvarArquivoAcervo() {
  const fonte = _regrasFonteAtual();
  if (!fonte || !_regraArquivoAcervo) return;
  const conteudo = document.getElementById('regras-editor-livre').value;

  // O nome vem PRONTO do modal do menu (com a pasta de destino já embutida), e
  // não mais do título do editor virado campo. A validação de caracteres mora
  // lá, na hora de digitar — aqui a barra é legítima: ela é o separador do
  // subcaminho, e recusá-la impediria salvar qualquer arquivo em subpasta.
  const nomeArquivo = _regraArquivoAcervo.caminho;
  if (!nomeArquivo) { showToast('Informe um nome de arquivo.', true); return; }

  const r = await window.pywebview.api.salvar_arquivo_livre_acervo(currentProject, fonte.caminho, nomeArquivo, conteudo);
  if (!r || !r.success) { showToast((r && r.error) || 'Erro ao salvar.', true); return; }
  showToast('Salvo.');
  _regraArquivoAcervo = { caminho: nomeArquivo, novo: false };
  _regrasTituloFixo(nomeArquivo);
  _regrasHeaderAcoes(true, true);
  // Acabamos de mudar o disco nós mesmos: sem esquecer o carimbo, o vigia
  // acordaria em seguida para recarregar de novo o que já está na tela.
  _regrasEsquecerCarimbo();
  await loadRegrasTree();
  // `expandirAte` em vez de `selecionar`: um arquivo salvo dentro de uma
  // subpasta fechada seria marcado numa linha que ninguém consegue ver.
  if (_regrasArvore) _regrasArvore.expandirAte(nomeArquivo);
}

// O ✕ do cabeçalho do editor e o "Excluir arquivo" do menu do botão direito
// fazem a MESMA coisa, e por isso são um código só: duas confirmações com
// textos que envelhecem separados é como um dos dois acaba mentindo.
function deletarArquivoAcervo() {
  if (!_regraArquivoAcervo || _regraArquivoAcervo.novo) return;
  _regrasConfirmarExcluirArquivo(_regraArquivoAcervo.caminho);
}

// ── Escolher o preset do Acervo (por projeto) ───────────────────────
//
// ⚠️ SÓ ESCOLHE, NÃO EDITA. Editar/criar/duplicar/remover um preset é em
// Configurações → Acervo (`config-acervo.js`) — presets são GLOBAIS
// (settings.json), e valem para qualquer projeto que os escolher. Isto aqui só
// grava, no Workspace.json DESTE projeto, qual preset (por nome) ele usa —
// mesmo raciocínio de "Trabalhos → Configuração" ser sub-aba de `tab-trabalhos`,
// e não uma categoria de Configurações, apesar de também guardar ajuste por
// projeto: o contexto do projeto já existe aqui.
//
// Era um botão-ícone 🗂 que abria um modal de rádios com um "Usar este preset"
// para confirmar. Virou o `<select>` da primeira fileira, que grava no `change`
// — como `.arq-preset-select` (assistente externo) e `.arq-preparar-select`
// (início rápido) já faziam. Trocar de preset não destrói nada: o modal de
// confirmação cobrava um clique a mais por um gesto reversível.
async function regrasTrocarPreset(nome) {
  if (!currentProject) return;
  const escolha = nome || null;
  // Erro do Python chega como promessa rejeitada, não como `{success:false}`.
  let r;
  try {
    r = await window.pywebview.api.set_acervo_preset_do_projeto(currentProject, escolha);
  } catch (e) {
    r = { success: false, error: String((e && e.message) || e) };
  }
  if (!r || !r.success) {
    showToast((r && r.error) || 'Não deu para trocar de preset.', true);
    await _regrasCarregarFontes();   // devolve o `<select>` ao que está no disco
    return;
  }

  // ⚠️ A CÓPIA EM MEMÓRIA DO WORKSPACE PRECISA ANDAR JUNTO. O backend acabou de
  // gravar `acervo_preset_ativo` direto no Workspace.json, mas `workspaceConfig`
  // (frontend/modulos/workspace.js) é a foto de quando o projeto abriu — e as 27
  // chamadas de `saveWorkspace()` mandam essa foto de volta. `save_workspace`
  // mescla, então uma chave ausente na foto sobrevive; uma chave PRESENTE e
  // velha, não — e trocar para "Nenhum" seria desfeito pela próxima gravação.
  if (typeof workspaceConfig === 'object' && workspaceConfig) {
    workspaceConfig.acervo_preset_ativo = escolha;
  }

  _regrasEsquecerCarimbo();
  await _regrasCarregarFontes();
  loadRegrasTree();
}

// ── Busca ──────────────────────────────────────────────────────────────────

function regrasFilterByName(query) {
  const q = (query || '').toLowerCase();
  // Uma gramática só: toda sub-aba é árvore. Esconde o arquivo que não casa
  // e, junto, a pasta que ficou sem nenhum visível — senão sobram pastas
  // vazias. Sem redesenhar, para não perder o que estava aberto.
  document.querySelectorAll('#regras-tree .arvp-linha-arquivo').forEach(el => {
    const nome = (el.dataset.caminho || '').toLowerCase();
    el.style.display = (!q || nome.includes(q)) ? '' : 'none';
  });
  document.querySelectorAll('#regras-tree .arvp-pasta').forEach(pasta => {
    const visivel = [...pasta.querySelectorAll('.arvp-linha-arquivo')]
      .some(a => a.style.display !== 'none');
    pasta.style.display = (!q || visivel) ? '' : 'none';
  });
}

async function regrasSearch() {
  const query = document.getElementById('regras-search-input').value.trim();
  if (!query) { loadRegrasTree(); return; }

  if (_regrasMode === 'nome') { regrasFilterByName(query); return; }
  const fonte = _regrasFonteAtual();
  if (!fonte) return;

  // ⚠️ VALE EM QUALQUER SUB-ABA desde 04/09/2026. Antes esta busca chamava
  // `search_regras_content`, que é da gramática estruturada (itens com tipo) e
  // só sabia responder sobre "Regras e instruções" — nas outras sub-abas o
  // botão Buscar respondia com uma recusa. `buscar_conteudo_acervo` devolve
  // CAMINHO DE ARQUIVO, que é o que a árvore sabe abrir.
  const r = await window.pywebview.api.buscar_conteudo_acervo(
    currentProject, fonte.caminho, query);
  if (!r || !r.success) { showToast((r && r.error) || 'Erro ao buscar.', true); return; }

  const resultsEl = document.getElementById('regras-search-results');
  document.getElementById('regras-tree').innerHTML = '';
  document.getElementById('regras-editor').classList.add('hidden');
  document.getElementById('regras-placeholder').classList.add('hidden');
  resultsEl.classList.remove('hidden');

  if (!r.results.length) {
    resultsEl.innerHTML = '<div class="regras-empty">Nenhum resultado encontrado.</div>';
    return;
  }

  resultsEl.innerHTML = r.results.map(item => `
    <div class="regras-result-item" data-caminho="${escapeHtml(item.caminho)}">
      <div class="regras-result-name">${escapeHtml(item.caminho)}</div>
      <div class="regras-result-snippet">${escapeHtml(item.snippet)}</div>
    </div>`).join('');

  resultsEl.querySelectorAll('.regras-result-item').forEach(el => {
    el.addEventListener('click', async () => {
      const caminho = el.dataset.caminho;
      document.getElementById('regras-search-input').value = '';
      await loadRegrasTree();
      // `expandirAte` abre as pastas do caminho antes de marcar: o resultado
      // pode estar três níveis abaixo, e marcar sem abrir não mostra nada.
      if (_regrasArvore) _regrasArvore.expandirAte(caminho);
      regrasAbrirLeitura(caminho);
    });
  });
}
