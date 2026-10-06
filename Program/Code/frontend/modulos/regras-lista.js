// ══ ACERVO → a árvore de uma fonte, e o menu do botão direito ══════════════
//
// ⚠️ ERAM DUAS GRAMÁTICAS, E AGORA É UMA SÓ. Até 04/09/2026,
// `Saída das skills/Regras e instruções` tinha tela própria aqui — lista plana
// de itens com tipo, barra Todos/Regras/Instruções e editor com formulário — e
// era a única sub-aba do Acervo diferente de todas as outras. Nas palavras do
// usuário: *"era só pra aparecer do mesmo jeito que aparecem os outros aqui"*.
// Toda pasta do preset agora é árvore; o que muda entre elas é só poder ou não
// escrever.
//
// ⚠️ O BACKEND ESTRUTURADO NÃO FOI TOCADO. `list_regras`, `save_regra` e
// `deletar_regra` continuam existindo e funcionando: quem os usa é o CHAT
// (`chat-payload.js`), que monta o payload a partir das pastas de item (uma
// por regra ou instrução, com o nome do item). Foi só esta TELA que parou de
// ter duas gramáticas — e a consequência a saber é que um arquivo criado aqui
// SOLTO na raiz da base (fora de uma pasta de item) aparece na árvore mas
// **não entra no payload do chat**.
//
// ⚠️ CRIAR/RENOMEAR/EXCLUIR SÃO DO MENU DO BOTÃO DIREITO, e o alvo é sempre a
// linha em que se clicou. Antes havia um ＋ no cabeçalho que criava sempre na
// raiz e não sabia criar pasta: num painel com dez pastas, ele era um chute
// sobre onde a coisa ia nascer. Aqui só se MONTA a lista de itens — quem
// desenha o menu é `menu-contexto.js`, e quem grava é `regras-acervo.js`.

// ── Árvore (qualquer pasta que não seja "Regras e instruções") ─────────────
//
// Apesar do nome, esta função NÃO montava árvore nenhuma: era um `forEach` que
// criava um item por arquivo com o CAMINHO INTEIRO como rótulo. Num painel de
// 240px, com ellipsis no fim, o nome do arquivo era justamente a parte que
// sumia. O backend (`regras.py::listar_arvore_decisoes`) já devolve caminhos
// relativos completos com `/` normalizado — exatamente o que o componente
// consome, então a conversão foi trocar o forEach por uma chamada.
function _regrasRenderArvoreLeitura(arquivos, pastas) {
  document.getElementById('regras-search-results').classList.add('hidden');
  if (!arquivos.length && !(pastas || []).length) regrasCloseEditor();

  const fonte = _regrasFonteAtual();
  const editavel = !!(fonte && fonte.editavel);

  _regrasArvore = criarArvorePastas({
    container: document.getElementById('regras-tree'),
    caminhos: arquivos,
    // As pastas VAZIAS viajam separadas dos arquivos porque o componente monta
    // a hierarquia a partir de caminhos de arquivo. Sem isto, a pasta que o
    // menu acabou de criar não apareceria — e o usuário criaria de novo.
    pastas: pastas || [],
    aoSelecionar: caminho => regrasAbrirLeitura(caminho),
    // Numa fonte de leitura não há menu nenhum: oferecer "Criar" para depois
    // recusar na gravação é pior do que não oferecer.
    itensMenuPasta: editavel ? _regrasMenuDaPasta : null,
    itensMenuArquivo: editavel ? _regrasMenuDoArquivo : null,
    itensMenuRaiz: editavel ? (() => _regrasMenuDaPasta('')) : null,
    vazio: 'Nenhum arquivo nesta pasta ainda.',
  });
  ligarBotoesArvore(() => _regrasArvore, {
    expandir: 'btn-regras-expand-all',
    retrair: 'btn-regras-collapse-all',
    // Sem `atualizar`: o ↻ saiu da barra e a árvore se atualiza sozinha
    // (`regras.js::_regrasVigiarDisco`).
  });
}

// ── Os dois menus ──────────────────────────────────────────────────────────
//
// Só montam a lista. `abrirMenuDeContexto` desenha, e `regras-acervo.js` grava.
// Três papéis separados é o que permite o menu ser o mesmo da aba Editor.

// `pasta` vazia = a raiz da sub-aba (clique direito no vazio do painel).
function _regrasMenuDaPasta(pasta) {
  const onde = pasta || 'a raiz desta sub-aba';
  const itens = [
    { rotulo: 'Criar pasta aqui', icone: '📁',
      fazer: () => _regrasPerguntarNome('pasta', pasta) },
    { rotulo: 'Criar arquivo aqui', icone: '📄',
      fazer: () => _regrasPerguntarNome('arquivo', pasta) },
  ];
  // A raiz da sub-aba é a pasta registrada no preset: ela não se renomeia nem
  // se apaga por aqui — some a sub-aba inteira junto, e quem a tira é
  // Configurações → Acervo. Sem esta guarda o menu prometeria o que o backend
  // recusa na sequência.
  if (pasta) {
    itens.push({ separador: true });
    itens.push({ rotulo: 'Renomear', icone: '✎',
                 fazer: () => _regrasPerguntarRenome(pasta, 'pasta') });
    itens.push({ rotulo: 'Excluir pasta', perigo: true,
                 fazer: () => _regrasConfirmarExcluirPasta(pasta) });
  }
  itens.push({ separador: true });
  itens.push({ rotulo: onde === pasta ? pasta : onde, ativo: false,
               motivo: 'É onde a criação vai acontecer.' });
  return itens;
}

function _regrasMenuDoArquivo(caminho) {
  return [
    { rotulo: 'Renomear', icone: '✎',
      fazer: () => _regrasPerguntarRenome(caminho, 'arquivo') },
    { separador: true },
    { rotulo: 'Excluir arquivo', perigo: true,
      fazer: () => _regrasConfirmarExcluirArquivo(caminho) },
  ];
}

function _regrasJuntar(pasta, nome) {
  return pasta ? `${pasta}/${nome}` : nome;
}

// O nome não pode ter barra: o destino já foi escolhido pelo clique, e aceitar
// subcaminho daria dois jeitos de dizer a mesma coisa — um deles discordando do
// que o menu prometeu.
const _REGRAS_NOME_INVALIDO = /[\\/:*?"<>|]/;

function _regrasPerguntarNome(oQue, pasta) {
  const fonte = _regrasFonteAtual();
  if (!fonte) return;
  const ehPasta = oQue === 'pasta';
  abrirModalPadrao({
    title: ehPasta ? 'Criar pasta' : 'Criar arquivo',
    confirmLabel: 'Criar',
    bodyHtml: `
      <label>Nome</label>
      <input type="text" data-f="nome" placeholder="${ehPasta ? 'ex.: Componentes' : 'ex.: Botões.md'}">
      <div class="modal-dica">Vai ser criado em <code>${escapeHtml(pasta || fonte.caminho)}</code>.</div>`,
    onConfirm: async (ov, showErr) => {
      const nome = ov.querySelector('[data-f="nome"]').value.trim();
      if (!nome) { showErr('Informe um nome.'); return false; }
      if (_REGRAS_NOME_INVALIDO.test(nome)) { showErr('Nome contém caracteres inválidos.'); return false; }
      const caminho = _regrasJuntar(pasta, nome);

      if (ehPasta) {
        const r = await window.pywebview.api.criar_pasta_acervo(
          currentProject, fonte.caminho, caminho);
        if (!r || !r.success) { showErr((r && r.error) || 'Erro ao criar a pasta.'); return false; }
        _regrasEsquecerCarimbo();
        await loadRegrasTree();
        // `expandirAte` sobre um filho fictício abre a pasta recém-criada, em
        // vez de deixá-la fechada e sem sinal de que apareceu.
        if (_regrasArvore) _regrasArvore.expandirAte(caminho + '/.');
        showToast('Pasta criada.');
        return true;
      }

      // Arquivo: não grava nada ainda. Abre o editor vazio com o nome já
      // definido, e quem grava é o Salvar — mesmo caminho de sempre.
      regrasAbrirArquivoNovo(caminho);
      return true;
    },
  });
}

// Renomear vale para arquivo e para pasta: o backend usa `os.rename` nos dois,
// e o que muda aqui é só a palavra na tela e o que fazer depois.
function _regrasPerguntarRenome(caminho, oQue) {
  const fonte = _regrasFonteAtual();
  if (!fonte) return;
  const atual = caminho.split('/').pop();
  abrirModalPadrao({
    title: `Renomear ${oQue}`,
    confirmLabel: 'Renomear',
    bodyHtml: `
      <label>Novo nome</label>
      <input type="text" data-f="nome" value="${escapeHtml(atual)}">
      <div class="modal-dica">Só o nome muda — ${escapeHtml(oQue)} continua onde está.</div>`,
    onConfirm: async (ov, showErr) => {
      const novo = ov.querySelector('[data-f="nome"]').value.trim();
      if (!novo) { showErr('Informe um nome.'); return false; }
      if (novo === atual) return true;
      if (_REGRAS_NOME_INVALIDO.test(novo)) { showErr('Nome contém caracteres inválidos.'); return false; }
      const r = await window.pywebview.api.renomear_no_acervo(
        currentProject, fonte.caminho, caminho, novo);
      if (!r || !r.success) { showErr((r && r.error) || 'Erro ao renomear.'); return false; }
      // ⚠️ O EDITOR TEM DE ANDAR JUNTO quando o arquivo aberto foi o renomeado.
      // Sem isto, o próximo Salvar gravaria no caminho velho e ressuscitaria o
      // arquivo com o nome antigo, ao lado do novo.
      if (_regraArquivoAcervo && _regraArquivoAcervo.caminho === caminho) {
        _regraArquivoAcervo = { caminho: r.caminho, novo: false };
        _regrasTituloFixo(r.caminho);
      }
      _regrasEsquecerCarimbo();
      await loadRegrasTree();
      if (_regrasArvore) _regrasArvore.expandirAte(r.caminho);
      showToast('Renomeado.');
      return true;
    },
  });
}

// ⚠️ O NÚMERO DE ARQUIVOS VAI NA PERGUNTA. "Apagar a pasta" e "apagar a pasta
// com 40 arquivos dentro" são decisões diferentes, e só a segunda é honesta —
// o Acervo não tem lixeira.
async function _regrasConfirmarExcluirPasta(pasta) {
  const fonte = _regrasFonteAtual();
  if (!fonte) return;
  let n = 0;
  try {
    const c = await window.pywebview.api.contar_na_pasta_acervo(
      currentProject, fonte.caminho, pasta);
    n = (c && c.arquivos) || 0;
  } catch (e) { n = 0; }
  const quantos = n === 0 ? 'Ela está vazia.'
    : `Vão junto <strong>${n} arquivo${n === 1 ? '' : 's'}</strong>.`;
  abrirModalPadrao({
    title: `Excluir "${pasta}"?`,
    confirmLabel: 'Excluir',
    bodyHtml: `<div class="modal-dica">${quantos} O Acervo não tem lixeira — isto não se desfaz.</div>`,
    onConfirm: async (ov, showErr) => {
      const r = await window.pywebview.api.deletar_pasta_acervo(
        currentProject, fonte.caminho, pasta);
      if (!r || !r.success) { showErr((r && r.error) || 'Erro ao excluir.'); return false; }
      // O editor pode estar mostrando um arquivo que morava lá dentro.
      if (_regraArquivoAcervo && (_regraArquivoAcervo.caminho || '').startsWith(pasta + '/')) {
        regrasCloseEditor();
      }
      _regrasEsquecerCarimbo();
      await loadRegrasTree();
      return true;
    },
  });
}

function _regrasConfirmarExcluirArquivo(caminho) {
  const fonte = _regrasFonteAtual();
  if (!fonte) return;
  abrirModalPadrao({
    title: `Excluir "${caminho}"?`,
    confirmLabel: 'Excluir',
    bodyHtml: '<div class="modal-dica">O arquivo sai da pasta registrada — o Acervo não tem lixeira.</div>',
    onConfirm: async (ov, showErr) => {
      const r = await window.pywebview.api.deletar_arquivo_livre_acervo(
        currentProject, fonte.caminho, caminho);
      if (!r || !r.success) { showErr((r && r.error) || 'Erro ao excluir.'); return false; }
      if (_regraArquivoAcervo && _regraArquivoAcervo.caminho === caminho) regrasCloseEditor();
      _regrasEsquecerCarimbo();
      await loadRegrasTree();
      return true;
    },
  });
}

async function regrasAbrirLeitura(caminho) {
  const fonte = _regrasFonteAtual();
  if (!fonte) return;
  const r = await window.pywebview.api.ler_arquivo_decisoes(currentProject, fonte.caminho, caminho);
  if (!r || !r.success) { showToast((r && r.error) || 'Erro ao ler o arquivo.', true); return; }

  _regraAtiva = null;
  _regraArquivoAcervo = { caminho, novo: false };
  // A seleção fica a cargo da árvore — marcar a linha, não redesenhar.
  if (_regrasArvore) _regrasArvore.selecionar(caminho);

  _regrasAbrirPainelEditor();
  _regrasTituloFixo(caminho);
  document.getElementById('regras-editor-selo').innerHTML =
    fonte.editavel ? '' : '<span class="selo-tipo selo-leitura">LEITURA</span>';
  document.getElementById('regras-campos-livre').classList.remove('hidden');
  document.getElementById('regras-label-livre').textContent = fonte.editavel ? 'Conteúdo' : 'Conteúdo (somente leitura)';
  const ta = document.getElementById('regras-editor-livre');
  ta.value = r.content || '';
  ta.readOnly = !fonte.editavel;

  _regrasHeaderAcoes(fonte.editavel, fonte.editavel);
  _regrasSaveHandler = fonte.editavel ? salvarArquivoAcervo : null;
  _regrasDeleteHandler = fonte.editavel ? deletarArquivoAcervo : null;
}

// Abre o editor vazio para um arquivo que ainda não existe no disco. O nome vem
// pronto do modal do menu, e por isso o título é FIXO — antes era um campo
// editável, e o nome só era lido no Salvar: não havia como aquele campo
// conversar com a pasta em que o usuário tinha clicado.
function regrasAbrirArquivoNovo(caminho) {
  _regraAtiva = null;
  _regraArquivoAcervo = { caminho, novo: true };
  if (_regrasArvore) _regrasArvore.selecionar(null);

  _regrasAbrirPainelEditor();
  _regrasTituloFixo(caminho);
  document.getElementById('regras-editor-selo').innerHTML = '';
  document.getElementById('regras-campos-livre').classList.remove('hidden');
  document.getElementById('regras-label-livre').textContent = 'Conteúdo';
  const ta = document.getElementById('regras-editor-livre');
  ta.value = '';
  ta.readOnly = false;
  ta.focus();

  _regrasHeaderAcoes(true, false);
  _regrasSaveHandler = salvarArquivoAcervo;
  _regrasDeleteHandler = null;
}
