// ═══════════════════════ EDITOR: AS AÇÕES DE ARQUIVO DO MENU ══
// O que o menu de contexto faz. Quem monta as listas é `editor-menus.js`; quem
// desenha o menu é o componente `menu-contexto.js`. Aqui mora só o efeito.
//
// ⚠️ COPIAR USA O CAMINHO COM FALLBACK, e não `copiarContexto`. O comentário em
// `utils.js:77` é explícito: `navigator.clipboard` FALHA CALADA em alguns
// contextos do WebView2, principalmente com a janela sem foco — e menu de
// contexto é justamente onde o foco está estranho. `copiarPeloBotao` tem o
// fallback por `<textarea>` + `execCommand`, mas quer um botão para virar "✓";
// como o menu já fechou quando a ação roda, `_edArqCopiar` faz o mesmo caminho
// com um elemento descartável e responde por toast.

// Foca o campo e seleciona só o nome, sem a extensão — é o que todo renomear
// faz, e poupa o gesto mais comum. O `setTimeout` porque o modal acabou de
// entrar no DOM e ainda não recebeu foco.
function _edArqFocar(overlay, nomeAtual) {
  setTimeout(() => {
    const i = overlay.querySelector('[data-f="nome"]');
    if (!i) return;
    i.focus();
    if (!nomeAtual) return;
    const ponto = nomeAtual.lastIndexOf('.');
    i.setSelectionRange(0, ponto > 0 ? ponto : nomeAtual.length);
  }, 60);
}

// A área de transferência interna do Editor — o que o "Copiar" marcou para o
// "Colar". Separada da do sistema de propósito: colar aqui é copiar um ARQUIVO,
// e a do sistema carrega texto. `caminhos` é sempre um array — um item só no
// caso comum, vários quando a seleção múltipla da árvore (Obra 6) está ativa.
let _edAreaDeTransferencia = null;   // { caminhos: [...], recortar }

function _edArqCopiar(texto, mensagem) {
  const aoFalhar = () => {
    const t = document.createElement('textarea');
    t.value = texto;
    t.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(t);
    t.select();
    try { document.execCommand('copy'); } catch (_) { /* nada mais a tentar */ }
    t.remove();
    showToast(mensagem);
  };
  try {
    navigator.clipboard.writeText(texto).then(() => showToast(mensagem)).catch(aoFalhar);
  } catch (_) {
    aoFalhar();
  }
}

// eslint-disable-next-line no-unused-vars
const editorArquivos = {
  get areaDeTransferencia() { return _edAreaDeTransferencia; },

  copiarCaminhoRelativo(caminho) {
    _edArqCopiar(caminho, 'Caminho relativo copiado.');
  },

  async copiarCaminhoAbsoluto(caminho) {
    const r = await window.pywebview.api.editor_caminho_absoluto(currentProject, caminho);
    if (!r.success) { showToast(r.error, true); return; }
    _edArqCopiar(r.caminho, 'Caminho copiado.');
  },

  async copiarCaminhoECodigo(caminho) {
    const r = await window.pywebview.api.editor_ler_arquivo(currentProject, caminho);
    if (!r.success) { showToast(r.error, true); return; }
    if (r.tipo === 'binario') { showToast('Esse arquivo não é texto.', true); return; }
    // O envelope é o formato único do projeto para entregar um arquivo a um
    // LLM — o mesmo que a aba Documentação usa. Ver `copiar-contexto.js`.
    _edArqCopiar(
      envelopeDeContexto('Conteúdo do arquivo de código abaixo, como está no projeto agora.',
                         caminho, r.conteudo),
      'Caminho e código copiados para o chat.');
  },

  // Mesmo padrão de `copiarCaminhoECodigo`, mas com a documentação técnica em
  // vez do conteúdo do arquivo — mesma leitura em cascata que
  // `editorAssistente.verDocumentacao` já usa.
  async copiarCaminhoEDocumentacao(caminho) {
    const d = await window.pywebview.api.editor_documento_do_arquivo(currentProject, caminho);
    if (!d.success) { showToast(d.error, true); return; }
    for (const agente of ['documentacao-tecnica']) {
      const r = await window.pywebview.api.read_agent_file(currentProject, agente, d.chave);
      if (r && r.success && r.content) {
        _edArqCopiar(
          envelopeDeContexto('Documentação técnica do arquivo abaixo, como está no projeto agora.',
                             caminho, r.content),
          'Caminho e documentação copiados para o chat.');
        return;
      }
    }
    showToast('Este arquivo ainda não tem documentação gerada. Rode o agente em Automação → Rotinas.', true);
  },

  // Item de menu de PASTA: lê o(s) `.md` do agente Resumo de pastas — uma
  // pasta grande pode ter sido dividida em "Pasta (parte N).md".
  async copiarCaminhoEResumoDaPasta(caminho) {
    const c = await window.pywebview.api.editor_chaves_do_resumo_da_pasta(currentProject, caminho);
    if (!c.success) { showToast(c.error, true); return; }
    const partes = [];
    for (const chave of c.chaves) {
      const r = await window.pywebview.api.read_agent_file(currentProject, 'resumo-pastas', chave);
      if (r && r.success && r.content) partes.push(r.content);
    }
    if (!partes.length) { showToast('Não deu para ler o resumo desta pasta.', true); return; }
    _edArqCopiar(
      envelopeDeContexto('Resumo da pasta abaixo, como está no projeto agora.',
                         caminho, partes.join('\n\n')),
      'Caminho e resumo da pasta copiados para o chat.');
  },

  // `caminho` aceita um caminho só OU um array (seleção múltipla — Obra 6).
  marcarParaColar(caminho, recortar) {
    const caminhos = Array.isArray(caminho) ? caminho : [caminho];
    _edAreaDeTransferencia = { caminhos, recortar: !!recortar };
    const n = caminhos.length;
    showToast(recortar
      ? (n > 1 ? `${n} recortados. Cole numa pasta.` : 'Recortado. Cole numa pasta.')
      : (n > 1 ? `${n} copiados. Cole numa pasta.` : 'Copiado. Cole numa pasta.'));
  },

  async colar(pastaDestino, aoTerminar) {
    if (!_edAreaDeTransferencia) return;
    const { caminhos, recortar } = _edAreaDeTransferencia;
    let erros = 0;
    for (const caminho of caminhos) {
      // eslint-disable-next-line no-await-in-loop
      const r = await window.pywebview.api.editor_colar(currentProject, caminho, pastaDestino, recortar);
      if (!r.success) { erros++; showToast(r.error, true); }
      // Reação (D46): observador, sem `await` — o programa não espera. Recortar
      // e colar é MUDAR DE LUGAR, e por isso é `arquivo.renomeado`.
      else if (typeof xtEmitir === 'function') {
        xtEmitir(recortar ? 'arquivo.renomeado' : 'arquivo.criado', recortar
          ? { projeto: currentProject, de: caminho, para: r.caminho }
          : { projeto: currentProject, caminho: r.caminho, pasta: false });
      }
    }
    // Recortar consome a marca; copiar não — colar o mesmo arquivo em três
    // pastas seguidas é o uso normal.
    if (recortar) _edAreaDeTransferencia = null;
    const ok = caminhos.length - erros;
    if (ok > 0) {
      showToast(recortar
        ? (ok > 1 ? `${ok} movidos.` : 'Movido.')
        : (ok > 1 ? `${ok} colados.` : 'Colado.'));
    }
    if (aoTerminar) aoTerminar();
  },

  async revelar(caminho) {
    const r = await window.pywebview.api.editor_revelar(currentProject, caminho);
    if (!r.success) showToast(r.error, true);
  },

  async abrirComOProgramaPadrao(caminho) {
    const r = await window.pywebview.api.editor_abrir_com_o_programa_padrao(currentProject, caminho);
    if (!r.success) showToast(r.error, true);
  },

  // ── Criar, renomear, excluir ──

  criar(pastaDestino, ehPasta, aoTerminar) {
    const ov = abrirModalPadrao({
      title: ehPasta ? 'Nova pasta' : 'Novo arquivo',
      bodyHtml: `
        <p class="modal-dica">Dentro de <code>${escapeHtml(pastaDestino || 'pasta raiz')}</code>.</p>
        <label>Nome</label>
        <input type="text" data-f="nome"
               placeholder="${ehPasta ? 'nome-da-pasta' : 'nome-do-arquivo.py'}">`,
      confirmLabel: 'Criar',
      // ⚠️ `showErr` e `return false`, e não um toast: o erro mais comum aqui é
      // nome inválido, e fechar o modal para avisar obrigaria a redigitar tudo.
      // É o contrato do `abrirModalPadrao`.
      onConfirm: async (o, showErr) => {
        const nome = o.querySelector('[data-f="nome"]').value.trim();
        const chamada = ehPasta ? 'editor_criar_pasta' : 'editor_criar_arquivo';
        const r = await window.pywebview.api[chamada](currentProject, pastaDestino, nome);
        if (!r.success) { showErr(r.error); return false; }
        if (typeof xtEmitir === 'function') {
          xtEmitir('arquivo.criado', { projeto: currentProject, caminho: r.caminho, pasta: ehPasta });
        }
        if (aoTerminar) aoTerminar(r.caminho);
        return true;
      },
    });
    _edArqFocar(ov, null);
  },

  // `caminho` aceita um caminho só OU um array (seleção múltipla — Obra 6).
  // Pasta nunca é array — só arquivo participa da seleção múltipla.
  async excluir(caminho, ehPasta, aoTerminar) {
    const lista = Array.isArray(caminho) ? caminho : [caminho];
    const varios = lista.length > 1;
    // ⚠️ Pergunta ao backend ANTES de montar a frase, para TODOS os itens.
    // Unidade de rede e removível não têm Lixeira, e prometer "dá para
    // restaurar" onde não dá é o pior tipo de erro num aviso de exclusão.
    const consultas = await Promise.all(
      lista.map((c) => window.pywebview.api.editor_pode_reciclar(currentProject, c)));
    const todosReciclam = consultas.every((p) => p.success && p.recicla);
    abrirModalPadrao({
      title: varios ? `Excluir ${lista.length} itens?` : (ehPasta ? 'Excluir a pasta?' : 'Excluir o arquivo?'),
      bodyHtml: `
        <p class="modal-dica">${lista.map((c) => `<code>${escapeHtml(c)}</code>`).join('<br>')}</p>
        <p class="modal-body-text">${todosReciclam
          ? 'Vai para a <b>Lixeira do Windows</b> — dá para restaurar por lá.'
          : (varios ? '<b>Ao menos um destes itens está numa unidade sem Lixeira</b> (rede ou disco removível): '
            : '<b>Esta unidade não tem Lixeira</b> (rede ou disco removível): ')
            + 'o Windows vai apagar direto, sem como desfazer.'}</p>`,
      confirmLabel: 'Excluir',
      onConfirm: async (o, showErr) => {
        let erros = 0;
        for (const c of lista) {
          // eslint-disable-next-line no-await-in-loop
          const r = await window.pywebview.api.editor_excluir(currentProject, c);
          if (!r.success) { erros++; showToast(r.error, true); }
          // "Apagado" mesmo quando foi para a Lixeira (D46).
          else if (typeof xtEmitir === 'function') {
            xtEmitir('arquivo.apagado', { projeto: currentProject, caminho: c });
          }
        }
        if (erros === lista.length) { showErr('Nada foi excluído.'); return false; }
        const ok = lista.length - erros;
        showToast(todosReciclam
          ? (ok > 1 ? `${ok} movidos para a Lixeira.` : 'Movido para a Lixeira.')
          : (ok > 1 ? `${ok} excluídos.` : 'Excluído.'));
        if (aoTerminar) aoTerminar();
        return true;
      },
    });
  },
};
