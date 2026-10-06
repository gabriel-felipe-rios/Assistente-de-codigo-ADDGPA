// ═════════════════════════════════════════ ABA EDITOR: AS TECLAS ══
// As teclas (e os comandos sem tecla) da aba Editor, postos no registro central
// (`modulos/teclas.js`). Só isso — nenhuma delas tem lógica própria: o `fazer`
// de cada uma é a mesma chamada que o botão ou o item de menu correspondente
// já executa.
//
// ⚠️ ARQUIVO IRMÃO, e não mais um bloco dentro de `editor.js`. A casca estava em
// 438 linhas e as teclas a levariam a 525 — acima do teto de 500 da AMF. A
// exceção registrada de `editor-arvore.js` e `editor-painel.js` diz o critério
// com todas as letras: *"o que NÃO é desculpa: crescer o arquivo. Comportamento
// novo que não precise do fechamento vira arquivo irmão que recebe a
// instância"*. É o mesmo caminho de `editor-arrasto.js`, `editor-cores.js` e
// `editor-superficie.js`.
//
// ⚠️ Ele LÊ os globais da casca (`_edAtivo`, `_edArvore`, `_edBuscarSubstituir`)
// e não os declara. São `let` do topo de `editor.js`, e sem ES modules isso os
// torna globais compartilhados — a convenção do projeto para exatamente este
// corte. A tag `<script>` vem antes da de `editor.js` no `index.html`, e quem
// chama `_edRegistrarTeclas()` é `initEditorTab`, já com tudo montado.

// As teclas da aba Editor, no registro central (`modulos/teclas.js`) em vez de
// num `keydown` próprio. Todas com `onde: 'tab-editor'`: o registro já cuida de
// não disparar com a aba fechada, com o foco num campo ou com um modal aberto —
// as três guardas que esta função escrevia à mão.
//
// ⚠️ O `ativo`/`motivo` de cada uma não é enfeite: é o que faz a barra de Acesso
// rápido desenhar o comando CINZA, com o motivo, em vez de sumir com ele.
//
// ⚠️ O `keydown` do `<textarea>` em `editor-superficie.js` NÃO muda. O Ctrl+S e
// o Ctrl+F de lá chegam antes e dão `stopPropagation` de propósito — sem isso o
// Ctrl+S salvava duas vezes e o Ctrl+F abria e fechava o achador no mesmo golpe
// (medido em 31/08/2026). O registro é borbulha, sem `capture`, justamente para
// aquele `stopPropagation` continuar valendo.
function _edRegistrarTeclas() {
  const temArquivo = () => !!(_edAtivo && _edAtivo.atual);

  registrarTecla({
    id: 'editor.salvar', rotulo: 'Salvar o arquivo', grupo: 'Editor',
    onde: 'tab-editor', padrao: 'Ctrl+S', icone: '⌸',
    ativo: temArquivo, motivo: 'nenhum arquivo aberto',
    // O `preventDefault` de antes virou responsabilidade do registro, e vale
    // aqui como valia: sem ele o WebView2 abre "Salvar como" por cima do
    // programa.
    fazer: () => _edAtivo.salvar(),
  });

  // Buscar e substituir no PROJETO (Obra 13) — diferente do Ctrl+F puro, que
  // busca só dentro do arquivo aberto.
  registrarTecla({
    id: 'editor.buscar-e-substituir', rotulo: 'Buscar e substituir no projeto',
    grupo: 'Editor', onde: 'tab-editor', padrao: 'Ctrl+Shift+F', icone: '⇄',
    ativo: () => !!_edBuscarSubstituir, motivo: 'a aba Editor ainda não abriu',
    fazer: () => _edBuscarSubstituir.abrir(),
  });

  registrarTecla({
    id: 'editor.buscar-no-arquivo', rotulo: 'Buscar no arquivo aberto',
    grupo: 'Editor', onde: 'tab-editor', padrao: 'Ctrl+F', icone: '⌕',
    ativo: temArquivo, motivo: 'nenhum arquivo aberto',
    fazer: () => _edAtivo.localizador.alternar(),
  });

  // Zoom por aba (Obra 9) — Ctrl+scroll faz o mesmo, dentro do código.
  registrarTecla({
    id: 'editor.aumentar-zoom', rotulo: 'Aumentar o zoom', grupo: 'Editor',
    onde: 'tab-editor', padrao: 'Ctrl+=', icone: '＋',
    ativo: () => !!_edAtivo, motivo: 'a aba Editor ainda não abriu',
    fazer: () => _edAtivo.mudarZoom(10),
  });
  registrarTecla({
    id: 'editor.diminuir-zoom', rotulo: 'Diminuir o zoom', grupo: 'Editor',
    onde: 'tab-editor', padrao: 'Ctrl+-', icone: '－',
    ativo: () => !!_edAtivo, motivo: 'a aba Editor ainda não abriu',
    fazer: () => _edAtivo.mudarZoom(-10),
  });
  registrarTecla({
    id: 'editor.zoom-normal', rotulo: 'Voltar o zoom ao normal', grupo: 'Editor',
    onde: 'tab-editor', padrao: 'Ctrl+0', icone: '⊙',
    ativo: () => !!_edAtivo, motivo: 'a aba Editor ainda não abriu',
    fazer: () => _edAtivo.resetarZoom(),
  });

  // ── As três que o menu de contexto ANUNCIAVA e não existiam ──
  //
  // `editor-menus.js` escrevia `Ctrl+Alt+C`, `F5` e `Ctrl+W` no campo `atalho`
  // de três itens, e não havia handler nenhum para as três: o menu prometia uma
  // tecla que não fazia nada. O `fazer` de cada uma é a MESMA chamada do item de
  // menu correspondente — nenhuma ação nova entrou por aqui.
  registrarTecla({
    id: 'editor.copiar-caminho', rotulo: 'Copiar o caminho do arquivo',
    grupo: 'Editor', onde: 'tab-editor', padrao: 'Ctrl+Alt+C', icone: '⧉',
    ativo: temArquivo, motivo: 'nenhum arquivo aberto',
    fazer: () => editorArquivos.copiarCaminhoAbsoluto(_edAtivo.atual.caminho),
  });
  registrarTecla({
    id: 'editor.recarregar-arvore', rotulo: 'Recarregar a árvore',
    grupo: 'Editor', onde: 'tab-editor', padrao: 'F5', icone: '↻',
    ativo: () => !!_edArvore, motivo: 'a aba Editor ainda não abriu',
    fazer: () => _edArvore.recarregar(),
  });
  registrarTecla({
    id: 'editor.fechar-aba', rotulo: 'Fechar a aba de arquivo',
    grupo: 'Editor', onde: 'tab-editor', padrao: 'Ctrl+W', icone: '✕',
    ativo: temArquivo, motivo: 'nenhum arquivo aberto',
    fazer: () => _edAtivo.fechar(_edAtivo.atual),
  });

  // Recursos do Editor › formatação (fase 12): quem PERGUNTA é o programa, quem
  // formata é a extensão (consulta `editor.formatar`). SEM tecla padrão — a
  // extensão "Formatar ao salvar" já sugere Ctrl+Alt+F para o comando dela, e
  // o usuário escolhe uma em Configurações › Teclado. Sem extensão que formate
  // a linguagem do arquivo, o comando fica cinza, com o motivo.
  registrarTecla({
    id: 'editor.formatar', rotulo: 'Formatar o arquivo', grupo: 'Editor',
    onde: 'tab-editor', padrao: null, icone: '≡',
    ativo: () => temArquivo() && typeof xtAlguemRespondeEm === 'function'
      && xtAlguemRespondeEm('editor.formatar', _edAtivo.atual.linguagem),
    motivo: 'nenhum arquivo aberto — ou nenhuma extensão ligada formata esta linguagem',
    fazer: () => edFormatarArquivoAberto(),
  });
}
