// ═══════════ Configurações → Arquivos que o programa lê → EXCEÇÕES ══
// Cada parte do programa que lê de um jeito próprio PARTE de uma lista e guarda
// só a diferença (D39, D48): o que o usuário acrescentou fica em cima, em
// verde; o que retirou, embaixo, em vermelho. Grava
// `arquivos-que-o-programa-le-excecoes.json`.
//
// «posso ter coisa que eu queira colocar, posso ter coisa que eu queira
// retirar… tem que ter uma separação clara» — por isso os dois lados têm cor,
// rótulo e bloco próprios, e nunca se misturam numa lista só.
//
// De onde cada parte parte:
//   · Documentação Técnica → a lista de código, do RASCUNHO de O que é código:
//     desmarcar uma linguagem ali muda o que ela documenta, e a tela mostra já;
//   · Busca visual · texto e cor / · imagem → as listas de fábrica da Aparência;
//   · Busca de usos → o conjunto dela (as linguagens que o índice de símbolos
//     entende, mais .html e .css) — não a lista de código, de propósito: ver o
//     "NÃO UNIFICAR" em `agentes/cobertura.py`.
// As três últimas bases vêm do backend (`bases`, em `load_arquivos_lidos`).
// A conta é a mesma de `configuracoes_extensoes_excecoes.aplicar_excecao`.
//
// O estado (`_extExcecoes`, `_extBases`) mora na casca, `config-extensoes.js`.

const EXT_PARTES = [
  { chave: 'documentacao_tecnica', titulo: 'Documentação Técnica',
    dica: 'Quais arquivos a Documentação Técnica documenta.',
    base: 'a lista de código', exemplo: 'Extensão — ex.: .env' },
  { chave: 'busca_visual_codigo', titulo: 'Busca visual · texto e cor',
    dica: 'Aparência › busca por cor e por texto. Lê também as extensões que estão em <b>Nunca ler</b>.',
    base: 'a lista da busca visual', exemplo: 'Extensão — ex.: .vue' },
  { chave: 'busca_visual_imagens', titulo: 'Busca visual · imagem',
    dica: 'Aparência › busca por imagem. Lê também as extensões que estão em <b>Nunca ler</b>. '
      + '<code>.png</code>, <code>.jpg</code>, <code>.jpeg</code>, <code>.ico</code> e <code>.webp</code> '
      + 'dependem da biblioteca <b>Pillow</b>; sem ela, só o <code>.svg</code> é lido.',
    base: 'a lista de imagens', exemplo: 'Extensão — ex.: .gif' },
  { chave: 'busca_de_usos', titulo: 'Busca de usos',
    dica: 'Análise › Símbolos e <code>me_usam</code>.',
    base: 'a lista da busca de usos', exemplo: 'Extensão — ex.: .svg' },
];

// As duas buscas visuais não leem a mesma extensão: ler um arquivo como texto
// E como imagem devolveria o mesmo achado duas vezes, com respostas que se
// contradizem (no backend, `_normalizar_extensoes_aparencia`).
const EXT_PARTE_VIZINHA = {
  busca_visual_codigo: 'busca_visual_imagens',
  busca_visual_imagens: 'busca_visual_codigo',
};

// A lista de onde a parte parte, hoje.
function _extBaseDaParte(chave) {
  if (chave === 'documentacao_tecnica') return _extListaDeCodigo();
  return (_extBases && _extBases[chave]) || [];
}

// O que a parte lê: a base menos o retirado, mais o acrescentado.
function _extListaDaParte(chave) {
  const exc = _extExcecoes[chave];
  const fora = new Set(exc.retirar);
  const saida = _extBaseDaParte(chave).filter(e => !fora.has(e));
  for (const e of exc.acrescentar) if (!saida.includes(e)) saida.push(e);
  return saida;
}

function _extExcecoesDesenhar() {
  const alvo = document.getElementById('ext-excecoes');
  if (!alvo || !_extExcecoes) return;
  alvo.innerHTML = '';
  for (const parte of EXT_PARTES) alvo.appendChild(_extCartaoDaParte(parte));
}

function _extCartaoDaParte(parte) {
  const cartao = document.createElement('div');
  cartao.className = 'config-cartao';
  cartao.dataset.configBusca = `extensao extensoes excecoes acrescentar retirar ${parte.titulo}`;
  const base = _extBaseDaParte(parte.chave);
  // A lista de código tem dezenas de extensões: vira um chip com a contagem.
  const chipsDaBase = parte.chave === 'documentacao_tecnica'
    ? `<span class="ext-chip padrao">${base.length} extensões</span>`
    : base.map(e => `<span class="ext-chip padrao">${escapeHtml(e)}</span>`).join('');
  cartao.innerHTML = `
    <div class="config-cartao-cabecalho">
      <div class="config-cartao-titulo">${parte.titulo}</div>
      <p class="config-cartao-dica">${parte.dica}</p>
    </div>
    <div class="exc-base"><span class="rot">Parte de</span><b>${parte.base}</b>${chipsDaBase}</div>
    <div class="exc-botoes">
      <input class="ext-input" placeholder="${parte.exemplo}">
      <button class="btn-exc mais" type="button" data-exc-lado="acrescentar">＋ Acrescentar</button>
      <button class="btn-exc menos" type="button" data-exc-lado="retirar">− Retirar</button>
    </div>
    <div class="exc-bloco mais"><span class="tit">＋ Acrescentadas · passam a ser lidas</span></div>
    <div class="exc-bloco menos"><span class="tit">− Retiradas · deixam de ser lidas</span></div>`;
  const exc = _extExcecoes[parte.chave];
  _extPintarLado(cartao.querySelector('.exc-bloco.mais'), exc, 'acrescentar');
  _extPintarLado(cartao.querySelector('.exc-bloco.menos'), exc, 'retirar');
  const campo = cartao.querySelector('input');
  cartao.querySelectorAll('[data-exc-lado]').forEach(botao => {
    botao.addEventListener('click', () => _extExcecaoNova(parte, botao.dataset.excLado, campo.value));
  });
  // Enter acrescenta: é o gesto mais comum; retirar pede o clique explícito.
  campo.addEventListener('keydown', e => {
    if (e.key === 'Enter') _extExcecaoNova(parte, 'acrescentar', campo.value);
  });
  return cartao;
}

function _extPintarLado(bloco, exc, lado) {
  const lista = exc[lado];
  if (!lista.length) {
    bloco.insertAdjacentHTML('beforeend',
      `<span class="vazio">${lado === 'acrescentar' ? 'nada acrescentado' : 'nada retirado'}</span>`);
    return;
  }
  const chips = document.createElement('div');
  chips.className = 'ext-chips';
  for (const ext of lista) {
    const chip = document.createElement('span');
    chip.className = 'ext-chip ' + (lado === 'acrescentar' ? 'mais' : 'menos');
    chip.innerHTML = lado === 'acrescentar'
      ? `+ ${escapeHtml(ext)}<span class="x" title="Desfazer a exceção">✕</span>`
      : `− <span class="nome">${escapeHtml(ext)}</span><span class="x" title="Desfazer a exceção">✕</span>`;
    chip.querySelector('.x').addEventListener('click', () => {
      exc[lado] = exc[lado].filter(e => e !== ext);
      _extExcecoesMudou();
    });
    chips.appendChild(chip);
  }
  bloco.appendChild(chips);
}

// Acrescentar o que estava retirado desfaz a retirada; retirar o que estava
// acrescentado desfaz o acréscimo. Acrescentar o que a base já tem, ou
// retirar o que ela não tem, não faz nada — e a notificação diz por quê.
function _extExcecaoNova(parte, lado, bruto) {
  const ext = _extNormalizarExt(bruto);
  if (!ext || ext === '.') { showToast('Escreva a extensão — ex.: .vue', true); return; }
  const exc = _extExcecoes[parte.chave];
  const naBase = _extBaseDaParte(parte.chave).includes(ext);
  if (lado === 'acrescentar') {
    if (exc.retirar.includes(ext)) exc.retirar = exc.retirar.filter(e => e !== ext);
    else if (naBase) { showToast(`${ext} já é lida — está em ${parte.base}.`); return; }
    else if (!exc.acrescentar.includes(ext)) exc.acrescentar.push(ext);
    const vizinha = EXT_PARTE_VIZINHA[parte.chave];
    if (vizinha && _extListaDaParte(vizinha).includes(ext)) {
      const outra = _extExcecoes[vizinha];
      outra.acrescentar = outra.acrescentar.filter(e => e !== ext);
      if (_extBaseDaParte(vizinha).includes(ext) && !outra.retirar.includes(ext)) outra.retirar.push(ext);
      showToast(`${ext} saiu da outra busca visual.`);
    }
  } else {
    if (exc.acrescentar.includes(ext)) exc.acrescentar = exc.acrescentar.filter(e => e !== ext);
    else if (!naBase) { showToast(`${ext} não é lida — não está em ${parte.base}.`); return; }
    else if (!exc.retirar.includes(ext)) exc.retirar.push(ext);
  }
  _extExcecoesMudou();
}

function _extExcecoesMudou() {
  _extMarcarSuja('excecoes');
  _extExcecoesDesenhar();
}
