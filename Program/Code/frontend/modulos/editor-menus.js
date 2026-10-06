// ═══════════════════ EDITOR: O QUE O BOTÃO DIREITO OFERECE ══
// Monta a LISTA de itens para cada alvo. Não desenha nada (isso é
// `menu-contexto.js`) e não faz nada (isso é `editor-arquivos.js`).
//
// ⚠️ O QUE NÃO SE APLICA AO ALVO NÃO ENTRA NA LISTA. Item cinza permanente não
// ensina nada e ainda faz o menu parecer maior do que é. `ativo: false` fica
// para o que se aplica mas não agora — e nesse caso `motivo` é obrigatório,
// senão o cinza é só um mistério.
//
// ⚠️ "Excluir" NÃO existe no menu da ABA de arquivo, só no da árvore. Na aba, o
// item ficaria a um pixel do × de fechar, e os dois gestos são parecidos demais
// para ficarem vizinhos quando um deles apaga do disco. Excluir mora onde o
// gesto é deliberado.

// As ações do Assistente. Iguais para arquivo e para aba, então saem de uma
// função só — duas cópias divergiriam na primeira mudança. `grupo` (Obra 6 —
// seleção múltipla), quando vem com mais de um caminho, faz as duas ações de
// contexto/lista remover valerem para o lote inteiro.
function _edMenuAssistente(caminho, grupo) {
  return [
    { separador: true },
    { grupo: 'Assistente' },
    {
      // Primeiro item de propósito: só o caminho, sem código/documentação
      // junto — o que sobra quando não é a IA que vai ler, é a pessoa.
      rotulo: 'Copiar caminho', icone: '⧉',
      fazer: () => editorArquivos.copiarCaminhoAbsoluto(caminho),
    },
    {
      rotulo: 'Copiar caminho + código para o chat', icone: '📋',
      fazer: () => editorArquivos.copiarCaminhoECodigo(caminho),
    },
    {
      rotulo: 'Copiar caminho + documentação técnica para o chat', icone: '📘',
      fazer: () => editorArquivos.copiarCaminhoEDocumentacao(caminho),
    },
    {
      rotulo: 'Quem usa este arquivo', icone: '🔗',
      fazer: () => editorAssistente.quemUsa(caminho),
    },
    {
      rotulo: 'Ver a documentação dele', icone: '📄',
      fazer: () => editorAssistente.verDocumentacao(caminho),
    },
    {
      // O rótulo fica fixo — quem decide se é adicionar ou remover, de
      // verdade, é o popup de confirmação (D9/D16): um item só, que checa o
      // estado ao abrir em vez de o menu adivinhar de antemão.
      rotulo: 'Adicionar ao contexto sem leitura', icone: '📎',
      fazer: () => editorAssistente.adicionarAoContexto(caminho, grupo),
    },
    {
      rotulo: 'Adicionar à lista remover', icone: '🚫',
      fazer: () => editorAssistente.alternarNaListaRemover(caminho, false, grupo),
    },
  ];
}

function _edMenuCaminhos(caminho) {
  return [
    { rotulo: 'Copiar caminho', atalho: textoDaTecla('editor.copiar-caminho'), icone: '⧉',
      fazer: () => editorArquivos.copiarCaminhoAbsoluto(caminho) },
    { rotulo: 'Copiar caminho relativo', icone: '⧉',
      fazer: () => editorArquivos.copiarCaminhoRelativo(caminho) },
  ];
}

// `ganchos` = { aoAbrir, aoAbrirAoLado, aoRecarregar, temNoOutroPainel }
// eslint-disable-next-line no-unused-vars
const editorMenus = {

  // `selecionados` (Obra 6): caminhos de arquivo selecionados no momento do
  // clique — inclui o próprio `caminho`. Ações de item único (Abrir, Abrir ao
  // lado, Renomear, Revelar) continuam operando só no arquivo clicado; as de
  // grupo (Copiar, Recortar, Excluir, contexto/lista remover) valem para todos.
  arquivo(caminho, ganchos, selecionados) {
    const grupo = (selecionados && selecionados.length > 1) ? selecionados : [caminho];
    const varios = grupo.length > 1;
    const noOutro = ganchos.temNoOutroPainel && ganchos.temNoOutroPainel(caminho);
    return [
      { rotulo: 'Abrir', icone: '↵', fazer: () => ganchos.aoAbrir(caminho) },
      {
        rotulo: 'Abrir ao lado', icone: '⫿',
        // Se aplica a qualquer arquivo, e não agora a este: por isso cinza com
        // motivo, e não ausente. O mesmo arquivo nos dois lados é proibido —
        // ver o aviso no topo de `editor.js`.
        ativo: !noOutro,
        motivo: noOutro ? 'Este arquivo já está aberto no outro painel.' : '',
        fazer: () => ganchos.aoAbrirAoLado(caminho),
      },
      { separador: true },
      { rotulo: varios ? `Copiar (${grupo.length})` : 'Copiar', icone: '⧉',
        fazer: () => editorArquivos.marcarParaColar(grupo, false) },
      { rotulo: varios ? `Recortar (${grupo.length})` : 'Recortar', icone: '✂',
        fazer: () => editorArquivos.marcarParaColar(grupo, true) },
      ...(_edMenuCaminhos(caminho)),
      { separador: true },
      { rotulo: 'Renomear', atalho: textoDaTecla('editor.renomear'), icone: '✎',
        fazer: () => ganchos.aoRenomearInline(caminho) },
      // ⚠️ SEM `atalho`, e de propósito. Este item anunciava `Del`, e não existe
      // handler de `Delete` na árvore do Editor — o rótulo prometia uma tecla
      // que nunca existiu. O `Delete` do programa é o da Oficina, que apaga nó e
      // ligação. Decidido em 05/09/2026: tira-se o rótulo em vez de criar a
      // tecla, porque `Delete` aqui seria tecla de GESTO (depende do que está
      // selecionado), não apareceria na tela de Teclado, e apagar arquivo sem
      // confirmação num painel que também tem campo de texto é justamente o que
      // ficou de fora. `menu-contexto.js` desenha célula vazia sem `atalho`.
      { rotulo: varios ? `Excluir (${grupo.length})` : 'Excluir', icone: '🗑',
        fazer: () => editorArquivos.excluir(grupo, false, ganchos.aoRecarregar) },
      { separador: true },
      { rotulo: 'Revelar no Explorador', icone: '⊞',
        fazer: () => editorArquivos.revelar(caminho) },
      { rotulo: 'Abrir no programa padrão', icone: '↗',
        fazer: () => editorArquivos.abrirComOProgramaPadrao(caminho) },
      ..._edMenuAssistente(caminho, grupo),
    ];
  },

  pasta(caminho, ganchos) {
    const copiado = editorArquivos.areaDeTransferencia;
    return [
      { rotulo: 'Novo arquivo', icone: '＋',
        fazer: () => editorArquivos.criar(caminho, false, ganchos.aoRecarregar) },
      { rotulo: 'Nova pasta', icone: '📁',
        fazer: () => editorArquivos.criar(caminho, true, ganchos.aoRecarregar) },
      { separador: true },
      { rotulo: 'Copiar', icone: '⧉', fazer: () => editorArquivos.marcarParaColar(caminho, false) },
      { rotulo: 'Recortar', icone: '✂', fazer: () => editorArquivos.marcarParaColar(caminho, true) },
      // "Colar" só existe quando há o que colar. Um item permanentemente
      // cinza aqui seria mobília.
      ...(copiado ? [{
        rotulo: copiado.caminhos.length > 1
          ? `Colar ${copiado.caminhos.length} itens` : `Colar "${copiado.caminhos[0].split('/').pop()}"`,
        icone: '📌',
        fazer: () => editorArquivos.colar(caminho, ganchos.aoRecarregar),
      }] : []),
      ...(_edMenuCaminhos(caminho)),
      { separador: true },
      { rotulo: 'Renomear', atalho: textoDaTecla('editor.renomear'), icone: '✎',
        fazer: () => ganchos.aoRenomearInline(caminho) },
      // Sem `atalho` pelo mesmo motivo do "Excluir" do menu de arquivo, acima.
      { rotulo: 'Excluir', icone: '🗑',
        fazer: () => editorArquivos.excluir(caminho, true, ganchos.aoRecarregar) },
      { separador: true },
      { rotulo: 'Revelar no Explorador', icone: '⊞',
        fazer: () => editorArquivos.revelar(caminho) },
      { separador: true },
      { grupo: 'Assistente' },
      {
        rotulo: 'Copiar caminho', icone: '⧉',
        fazer: () => editorArquivos.copiarCaminhoAbsoluto(caminho),
      },
      {
        rotulo: 'Ver o resumo da pasta', icone: '📖',
        fazer: () => editorAssistente.verResumoDaPasta(caminho),
      },
      {
        rotulo: 'Copiar caminho + resumo da pasta para o chat', icone: '📦',
        fazer: () => editorArquivos.copiarCaminhoEResumoDaPasta(caminho),
      },
      {
        rotulo: 'Adicionar ao contexto sem leitura', icone: '📎',
        fazer: () => editorAssistente.adicionarAoContexto(caminho),
      },
      {
        rotulo: 'Adicionar à lista remover', icone: '🚫',
        fazer: () => editorAssistente.alternarNaListaRemover(caminho, true),
      },
    ];
    // ⚠️ Sem "Abrir ao lado" e sem "código para o chat": os dois precisam de
    // um ARQUIVO. O "Resumo da pasta" acima já cobre o que pasta tem de
    // equivalente.
  },

  // O clique com o botão direito no vazio da árvore = a pasta raiz.
  raiz(ganchos) {
    const copiado = editorArquivos.areaDeTransferencia;
    return [
      { rotulo: 'Novo arquivo na raiz', icone: '＋',
        fazer: () => editorArquivos.criar('', false, ganchos.aoRecarregar) },
      { rotulo: 'Nova pasta na raiz', icone: '📁',
        fazer: () => editorArquivos.criar('', true, ganchos.aoRecarregar) },
      ...(copiado ? [{
        rotulo: copiado.caminhos.length > 1
          ? `Colar ${copiado.caminhos.length} itens` : `Colar "${copiado.caminhos[0].split('/').pop()}"`,
        icone: '📌',
        fazer: () => editorArquivos.colar('', ganchos.aoRecarregar),
      }] : []),
      { separador: true },
      { rotulo: 'Recarregar a árvore', atalho: textoDaTecla('editor.recarregar-arvore'), icone: '↻',
        fazer: () => ganchos.aoRecarregar() },
      { rotulo: 'Revelar a raiz no Explorador', icone: '⊞',
        fazer: () => editorArquivos.revelar('') },
    ];
    // ⚠️ Nunca renomear nem excluir a raiz — o backend também recusa, mas o
    // item não deve nem existir: oferecer e recusar é pior que não oferecer.
  },

  // `fixado`: estado ATUAL da aba, pro rótulo virar "Desfixar" quando já
  // estiver fixada — o mesmo item alterna, como o 📌 na própria aba já faz.
  abaDeArquivo(caminho, ganchos, fixado) {
    return [
      { rotulo: fixado ? 'Desfixar' : 'Fixar', icone: '📌',
        fazer: () => ganchos.aoFixar(caminho) },
      { rotulo: 'Fechar', atalho: textoDaTecla('editor.fechar-aba'), icone: '✕',
        fazer: () => ganchos.aoFechar(caminho) },
      { rotulo: 'Fechar as outras', icone: '✕',
        fazer: () => ganchos.aoFecharOutras(caminho) },
      { rotulo: 'Fechar as à direita', icone: '✕',
        fazer: () => ganchos.aoFecharADireita(caminho) },
      { separador: true },
      ...(_edMenuCaminhos(caminho)),
      { rotulo: 'Revelar no Explorador', icone: '⊞',
        fazer: () => editorArquivos.revelar(caminho) },
      ..._edMenuAssistente(caminho),
    ];
  },
};
