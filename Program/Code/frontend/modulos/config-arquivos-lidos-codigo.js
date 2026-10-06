// ═══════════ Configurações → Arquivos que o programa lê → O QUE É CÓDIGO ══
// A lista de código, por linguagem (D13): cada linguagem com o nome e TODAS as
// extensões dela, os formatos especiais e as extensões soltas. Grava
// `arquivos-que-o-programa-le-o-que-e-codigo.json`, que dá para editar à mão.
//
// «Consigo adicionar uma linguagem e a primeira extensão dela, e depois posso
// entrar nela e adicionar mais extensão.» — é por isso que a linguagem nasce
// com UMA extensão obrigatória, e o grupo aberto traz o campo "＋ extensão".
//
// Caixa desmarcada = a extensão continua na lista, mas vai para `desmarcadas`
// e não conta agora. O estado (`_extCodigo`) mora na casca.

function _extCodigoLigar() {
  _extLigarCampo('ext-add-linguagem-ext', document.getElementById('btn-ext-add-linguagem'),
                 _extAdicionarLinguagem);
  _extLigarCampo('ext-add-linguagem-nome', null, _extAdicionarLinguagem);
  _extLigarCampo('ext-add-formato', document.getElementById('btn-ext-add-formato'),
                 _extAdicionarFormato);
  _extLigarCampo('ext-add-solta', document.getElementById('btn-ext-add-solta'),
                 _extAdicionarSolta);
}

function _extCodigoDesenhar() {
  if (!_extCodigo) return;
  _extDesenharLinguagens();
  _extDesenharFormatos();
  _extDesenharSoltas();
}

function _extMarcadaNoCodigo(ext) {
  return !_extCodigo.desmarcadas.includes(ext);
}

function _extMarcarNoCodigo(ext, marcada) {
  const lista = _extCodigo.desmarcadas;
  const i = lista.indexOf(ext);
  if (marcada && i !== -1) lista.splice(i, 1);
  if (!marcada && i === -1) lista.push(ext);
  _extMarcarSuja('codigo');
}

// Onde uma extensão já está, dito como a tela diz — ou null. Uma extensão mora
// num lugar só: aparecer em dois faria a resposta depender da ordem de leitura.
function _extOndeEsta(ext) {
  for (const l of _extCodigo.linguagens) {
    if (l.extensoes.includes(ext)) return `na linguagem ${l.nome}`;
  }
  if (_extCodigo.formatos_especiais.includes(ext)) return 'em Formatos especiais';
  if (_extCodigo.extensoes_soltas.includes(ext)) return 'em Extensões soltas';
  return null;
}

// Devolve a extensão normalizada, ou '' (com a notificação já dada) se ela não
// pode entrar.
function _extExtensaoNova(bruto) {
  const ext = _extNormalizarExt(bruto);
  if (!ext || ext === '.') {
    showToast('Escreva a extensão — ex.: .astro', true);
    return '';
  }
  const onde = _extOndeEsta(ext);
  if (onde) {
    showToast(`${ext} já está ${onde}.`, true);
    return '';
  }
  return ext;
}

function _extDesenharLinguagens() {
  const grupos = _extCodigo.linguagens.map(l => ({
    chave: l.nome.toLowerCase(), rotulo: l.nome, exts: l.extensoes,
  }));
  _extPintarGrupos(document.getElementById('ext-grupos-linguagens'), grupos,
    _extMarcadaNoCodigo, _extMarcarNoCodigo, {
      prefixo: 'ling:',
      // Dentro de cada linguagem aberta, o campo para acrescentar mais uma.
      extra: (corpo, grupo) => {
        const linha = document.createElement('div');
        linha.className = 'ext-linha-add ext-linha-add--grupo';
        linha.innerHTML = `<input class="ext-input ext-input--pequena" placeholder="${escapeHtml(grupo.exts[0] || '.ext')}">`
          + `<button class="btn btn-primary btn-xs" type="button">＋ extensão</button>`;
        const campo = linha.querySelector('input');
        const acrescentar = () => {
          const ext = _extExtensaoNova(campo.value);
          if (!ext) return;
          const linguagem = _extCodigo.linguagens.find(l => l.nome.toLowerCase() === grupo.chave);
          if (!linguagem) return;
          linguagem.extensoes.push(ext);
          _extMarcarSuja('codigo');
          _extDesenharLinguagens();
        };
        linha.querySelector('button').addEventListener('click', acrescentar);
        campo.addEventListener('keydown', e => { if (e.key === 'Enter') acrescentar(); });
        corpo.appendChild(linha);
      },
    });
}

function _extAdicionarLinguagem() {
  const campoNome = document.getElementById('ext-add-linguagem-nome');
  const campoExt = document.getElementById('ext-add-linguagem-ext');
  if (!campoNome || !campoExt) return;
  const nome = campoNome.value.trim();
  if (!nome) {
    showToast('Escreva o nome da linguagem — ex.: Astro', true);
    return;
  }
  const existente = _extCodigo.linguagens.find(l => l.nome.toLowerCase() === nome.toLowerCase());
  if (existente) {
    showToast(`Já existe a linguagem ${existente.nome}. Abra ela para acrescentar extensão.`, true);
    return;
  }
  const ext = _extExtensaoNova(campoExt.value);
  if (!ext) return;
  _extCodigo.linguagens.push({ nome, extensoes: [ext] });
  // Nasce aberta: o próximo passo natural é acrescentar mais extensão a ela.
  _extGruposAbertos.add('ling:' + nome.toLowerCase());
  campoNome.value = '';
  campoExt.value = '';
  _extMarcarSuja('codigo');
  _extDesenharLinguagens();
}

// Formatos especiais: uma caixa por formato, em fileira — oito caixas cabem
// numa linha e não pedem grupo.
function _extDesenharFormatos() {
  const alvo = document.getElementById('ext-formatos');
  if (!alvo) return;
  alvo.innerHTML = '';
  for (const ext of _extCodigo.formatos_especiais) {
    const rotulo = document.createElement('label');
    rotulo.className = 'ext-variacao';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = _extMarcadaNoCodigo(ext);
    cb.addEventListener('change', () => _extMarcarNoCodigo(ext, cb.checked));
    const texto = document.createElement('span');
    texto.textContent = ext;
    rotulo.appendChild(cb);
    rotulo.appendChild(texto);
    alvo.appendChild(rotulo);
  }
}

function _extAdicionarFormato() {
  const campo = document.getElementById('ext-add-formato');
  if (!campo) return;
  const ext = _extExtensaoNova(campo.value);
  if (!ext) return;
  _extCodigo.formatos_especiais.push(ext);
  campo.value = '';
  _extMarcarSuja('codigo');
  _extDesenharFormatos();
}

function _extDesenharSoltas() {
  const alvo = document.getElementById('ext-chips-soltas');
  if (!alvo) return;
  alvo.innerHTML = '';
  for (const ext of _extCodigo.extensoes_soltas) {
    alvo.appendChild(_extChip(ext, false, () => {
      _extCodigo.extensoes_soltas = _extCodigo.extensoes_soltas.filter(e => e !== ext);
      _extCodigo.desmarcadas = _extCodigo.desmarcadas.filter(e => e !== ext);
      _extMarcarSuja('codigo');
      _extDesenharSoltas();
    }));
  }
  if (!_extCodigo.extensoes_soltas.length) {
    const vazio = document.createElement('span');
    vazio.className = 'config-nota';
    vazio.textContent = 'Nenhuma — tudo que conta como código está numa linguagem ou nos formatos.';
    alvo.appendChild(vazio);
  }
}

function _extAdicionarSolta() {
  const campo = document.getElementById('ext-add-solta');
  if (!campo) return;
  const ext = _extExtensaoNova(campo.value);
  if (!ext) return;
  _extCodigo.extensoes_soltas.push(ext);
  campo.value = '';
  _extMarcarSuja('codigo');
  _extDesenharSoltas();
}
