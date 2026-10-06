// ══ CONFIGURAÇÕES → Preparar projeto: a lista de presets ═══════════════════
//
// Criar, renomear, duplicar, excluir — e o Salvar que leva tudo ao disco.
//
// ⚠️ O RENOMEAR AQUI É SÓ EM MEMÓRIA. Ele monta o par `{nome antigo: nome
// novo}` e entrega ao Salvar; quem encosta no disco é o backend, e ele faz a
// CASCATA — o nome de um assistente está gravado em três lugares fora da lista
// (o início rápido, o `Workspace.json` de cada projeto e o `produto` de cada nó
// da Oficina). Renomear aqui e gravar só a lista deixaria os três apontando
// para o vazio, sem erro nenhum.
//
// ⚠️ NOME DUPLICADO É BARRADO NO SALVAR, e não na digitação: o casamento entre
// as listas é por NOME, e dois presets homônimos fariam a escolha de um projeto
// virar sorteio.
function _cprAdicionarPasta(lista) {
  const preset = _cprPreset();
  const input = document.getElementById('cpr-add-' + lista);
  if (!preset || !input) return;
  const caminho = _cprLimpar(input.value).trim();
  if (!caminho) return;
  const chave = lista === 'raiz' ? 'pastas_raiz' : 'pastas_trabalho';
  preset[chave] = preset[chave] || [];
  if (preset[chave].some(i => (i.caminho || '').trim() === caminho)) {
    showToast('Essa pasta já está na lista.', true);
    return;
  }
  preset[chave].push({ caminho, remover: false, contexto: false, descricao: '' });
  input.value = '';
  _cprPintar();
}

function _cprNomeLivre(base) {
  let nome = base, n = 2;
  while (_cprPresets.some(p => p.nome === nome)) nome = `${base} ${n++}`;
  return nome;
}

function _cprNovo() {
  const nome = _cprNomeLivre('Novo início rápido');
  // As SEIS listas nascem VAZIAS: um início rápido novo não copia nada até o
  // usuário marcar. E precisam nascer presentes, mesmo vazias — `itens` ausente
  // é o sinal de "molde velho" que faz o backend preencher com tudo que está
  // marcado Do programa (`_inicio_rapido_normalizar` em arquivos.py).
  const itens = {};
  _cprTipos.forEach(({ kind }) => { itens[kind] = []; });
  _cprPresets.push({
    nome,
    assistente: (_cprAssistentes[0] || {}).nome || '',
    itens,
    pastas_raiz: [], pasta_trabalho: '', pastas_trabalho: [],
  });
  _cprSelecionado = nome;
  _cprPintar();
}

// Renomear é INLINE, e não num diálogo: o `window.prompt` nativo não é
// confiável dentro do WebView2, e este projeto não tem um modal de entrada de
// texto reaproveitável — todos os modais são markup escrito à mão no index.html.
function _cprRenomear() {
  const preset = _cprPreset();
  const linha = document.getElementById('cpr-editando-nome');
  if (!preset || !linha || linha.tagName === 'INPUT') return;

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'cpr-editando-nome';
  input.className = 'cpr-nome-input';
  input.value = preset.nome;
  linha.replaceWith(input);
  input.focus();
  input.select();

  // ⚠️ IDEMPOTENTE: o Enter grava direto e o `blur` dispara logo depois. Sem a
  // trava a gravação roda duas vezes, e a segunda vê o nome já trocado.
  let fechado = false;
  const confirmar = () => {
    if (fechado) return;
    fechado = true;
    const nome = _cprLimpar(input.value).trim();
    if (nome && nome !== preset.nome) {
      if (_cprPresets.some(p => p.nome === nome)) {
        showToast('Já existe um início rápido com esse nome.', true);
      } else {
        if (_cprPadrao === preset.nome) _cprPadrao = nome;
        preset.nome = nome;
        _cprSelecionado = nome;
      }
    }
    _cprPintar();
  };
  input.addEventListener('blur', confirmar);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
    if (e.key === 'Escape') { fechado = true; _cprPintar(); }
  });
}

function _cprDuplicar() {
  const preset = _cprPreset();
  if (!preset) return;
  const copia = JSON.parse(JSON.stringify(preset));
  copia.nome = _cprNomeLivre(preset.nome + ' (cópia)');
  _cprPresets.push(copia);
  _cprSelecionado = copia.nome;
  _cprPintar();
}

// Excluir PERGUNTA antes. Era o único dos quatro botões da fileira que agia no
// primeiro clique, e é o único que destrói trabalho.
//
// ⚠️ Reusa `abrirModalPadrao`, de `modal-padrao.js` — o único construtor de
// modal genérico do programa. ℹ️ Nada aqui depende da ordem dos <script>: a
// chamada é de dentro de uma função, e o global já existe quando ela roda.
function _cprExcluir() {
  const preset = _cprPreset();
  if (!preset) return;
  // ⚠️ DÁ PARA EXCLUIR TODOS, e de propósito. Havia aqui uma trava no último —
  // e ela era a mesma confusão de "lista vazia é escolha, não é falta de
  // configuração" que já custou caro nos assistentes de lançamento: quem apaga
  // o último quer a lista vazia, e o caminho de volta é "Restaurar padrão".
  // Sem nenhum início rápido, o botão Preparar avisa; ele não é obrigatório
  // para o projeto funcionar.
  const ultimo = _cprPresets.length === 1;
  const nome = preset.nome;
  // ⚠️ DIZ QUANTOS. Convenção *"Toda lixeira confirma antes"*: quando a remoção
  // atinge outras coisas além do alvo, o modal diz quantas. Aqui o que se perde
  // é a seleção de itens — e ela é a única coisa que o início rápido guarda que
  // não está em mais nenhum lugar.
  const marcados = Object.values(preset.itens || {})
    .reduce((n, lista) => n + (Array.isArray(lista) ? lista.length : 0), 0);
  const pastas = (preset.pastas_raiz || []).length + (preset.pastas_trabalho || []).length;
  const partes = [];
  if (marcados) partes.push(`<strong>${marcados}</strong> item(ns) marcado(s)`);
  if (pastas) partes.push(`<strong>${pastas}</strong> pasta(s)`);
  const perda = partes.length ? ` Junto vão ${partes.join(' e ')}.` : '';

  abrirModalPadrao({
    title: `Excluir o início rápido "${nome}"?`,
    confirmLabel: 'Excluir',
    bodyHtml: `<div class="modal-body-text">Isto remove <strong>${escapeHtml(nome)}</strong> da lista.${perda} Não dá pra desfazer.${
      ultimo ? ' <br><br>É o <strong>último</strong>: a lista fica vazia, e o botão <strong>Preparar este projeto</strong> passa a avisar que não há molde. "Restaurar padrão" traz os de fábrica de volta.' : ''
    }<br><br>A exclusão só vale depois de <strong>Salvar início rápido</strong> — até lá, sair da categoria sem salvar o traz de volta.</div>`,
    onConfirm: () => {
      _cprPresets = _cprPresets.filter(p => p.nome !== nome);
      if (_cprPadrao === nome) _cprPadrao = (_cprPresets[0] || {}).nome || null;
      _cprSelecionado = (_cprPresets[0] || {}).nome || null;
      _cprPintar();
      showToast(`Início rápido "${nome}" removido — salve para confirmar.`);
    },
  });
}

async function salvarConfigPreparar() {
  const r = await window.pywebview.api.save_inicios_rapidos(_cprPresets, _cprPadrao);
  if (!r || !r.success) {
    showToast('Não deu para salvar: ' + ((r && r.error) || 'erro desconhecido'), true);
    return;
  }
  const preset = _cprPreset();
  const erros = preset ? _cprValidar(preset) : [];
  showToast(erros.length
    ? 'Salvo, mas o início rápido está indisponível até os avisos sumirem.'
    : 'Início rápido salvo!');
  _cprPintarErros();
}
