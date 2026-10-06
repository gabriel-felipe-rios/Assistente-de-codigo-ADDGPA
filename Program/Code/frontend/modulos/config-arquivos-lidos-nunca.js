// ═══════════ Configurações → Arquivos que o programa lê → NUNCA LER ══
// O que o programa nem enxerga, em todos os projetos: pasta por nome, arquivo
// por nome, extensão. Grava `arquivos-que-o-programa-le-nunca-ler.json` — o
// mesmo arquivo que os quatro plugins universais leem pelo caminho.
//
// O estado (`_extNunca`) mora na casca, `config-extensoes.js`.

// As seis variações de escrita, na ordem em que aparecem na tela.
//
// ⚠️ NÃO é combinatório: cada caixa gera UMA entrada a partir do termo digitado.
// MAIÚSCULAS + `.` gera `README.MD` e `.readme.md`, nunca `.README.MD`. Foi
// decidido assim porque o combinatório de seis caixas são 63 entradas, e a
// lista deixaria de ser legível na primeira vez que alguém marcasse tudo.
const EXT_VARIACOES = [
  { chave: 'maiusculas', rotulo: 'MAIÚSCULAS',         gerar: t => t.toUpperCase() },
  { chave: 'minusculas', rotulo: 'minúsculas',         gerar: t => t.toLowerCase() },
  { chave: 'primeira',   rotulo: 'Primeira maiúscula', gerar: t => _extPrimeiraMaiuscula(t) },
  { chave: 'camelo',     rotulo: 'Camelo',             gerar: t => _extCamelo(t) },
  { chave: 'ponto',      rotulo: 'com <code>.</code> na frente', gerar: t => '.' + t },
  { chave: 'underline',  rotulo: 'com <code>_</code> na frente', gerar: t => '_' + t },
];

// As listas que ganham variações — só nome de pasta e nome de arquivo.
// Extensão não entra: ali não há maiúscula significativa e o ponto faz parte
// dela, então "variação" não significaria nada.
const EXT_LISTAS_COM_VARIACAO = ['pastas_ignoradas', 'arquivos_ignorados'];
const EXT_LISTAS_NUNCA = ['pastas_ignoradas', 'arquivos_ignorados', 'extensoes_ignoradas'];

function _extPrimeiraMaiuscula(termo) {
  if (!termo) return termo;
  return termo.charAt(0).toUpperCase() + termo.slice(1).toLowerCase();
}

// Cada palavra com inicial maiúscula e os separadores removidos:
// `node_modules` → `NodeModules`. Para um nome de uma palavra só o resultado
// coincide com "Primeira maiúscula", e a duplicata é descartada na hora de
// acrescentar — as duas caixas marcadas juntas geram uma entrada, não duas.
function _extCamelo(termo) {
  return (termo || '')
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('');
}

function _extNuncaLigar() {
  EXT_LISTAS_NUNCA.forEach(lista => {
    const botao = document.querySelector(`[data-ext-add="${lista}"]`);
    _extLigarCampo('ext-add-' + lista, botao, () => _extAcrescentar(lista));
  });
  // "Variações ▸" mostra e esconde as seis caixas. Ficam escondidas de
  // partida: a maior parte dos acréscimos é um nome só.
  document.querySelectorAll('[data-ext-ver-variacoes]').forEach(botao => {
    if (botao._wired) return;
    botao._wired = true;
    botao.addEventListener('click', () => {
      const caixa = document.querySelector(`[data-variacoes="${botao.dataset.extVerVariacoes}"]`);
      if (!caixa) return;
      const abrir = caixa.classList.contains('hidden');
      caixa.classList.toggle('hidden', !abrir);
      botao.textContent = abrir ? 'Variações ▾' : 'Variações ▸';
    });
  });
  _extDesenharVariacoes();
}

function _extNuncaDesenhar() {
  if (!_extNunca) return;
  EXT_LISTAS_NUNCA.forEach(_extDesenharChips);
}

function _extDesenharVariacoes() {
  document.querySelectorAll('[data-variacoes]').forEach(caixa => {
    const lista = caixa.dataset.variacoes;
    if (!EXT_LISTAS_COM_VARIACAO.includes(lista) || caixa._desenhada) return;
    caixa._desenhada = true;
    caixa.innerHTML = `<span class="rot">Junto</span>`
      + EXT_VARIACOES.map(v => `
          <label class="ext-variacao">
            <input type="checkbox" data-variacao="${v.chave}"><span>${v.rotulo}</span>
          </label>`).join('')
      + `<button class="btn-variacao-tudo" type="button">Tudo</button>`;

    const botao = caixa.querySelector('.btn-variacao-tudo');
    botao.addEventListener('click', () => {
      const caixas = [...caixa.querySelectorAll('input')];
      const marcar = !caixas.every(c => c.checked);
      caixas.forEach(c => { c.checked = marcar; });
    });
  });
}

function _extDesenharChips(lista) {
  const alvo = document.getElementById('ext-chips-' + lista);
  if (!alvo) return;
  const deFabrica = (_extPadrao && _extPadrao.nunca_ler[lista]) || [];
  alvo.innerHTML = '';
  for (const item of _extNunca[lista]) {
    alvo.appendChild(_extChip(item, deFabrica.includes(item), () => {
      _extNunca[lista] = _extNunca[lista].filter(i => i !== item);
      _extMarcarSuja('nunca');
      _extDesenharChips(lista);
    }));
  }
}

// Extensão ganha o ponto e perde a caixa; nome de pasta e de arquivo entram
// como foram escritos — a comparação é sensível a maiúsculas de propósito.
function _extNormalizarNunca(lista, termo) {
  return lista === 'extensoes_ignoradas' ? _extNormalizarExt(termo) : termo;
}

function _extAcrescentar(lista) {
  const campo = document.getElementById('ext-add-' + lista);
  if (!campo) return;
  const termo = campo.value.trim();
  if (!termo) return;

  const entradas = [_extNormalizarNunca(lista, termo)];
  const caixa = document.querySelector(`[data-variacoes="${lista}"]`);
  if (caixa) {
    for (const variacao of EXT_VARIACOES) {
      const cb = caixa.querySelector(`[data-variacao="${variacao.chave}"]`);
      if (!cb || !cb.checked) continue;
      // Cada variação sai SEMPRE do termo digitado, nunca de outra variação —
      // é isto que impede o combinatório.
      const gerada = _extNormalizarNunca(lista, variacao.gerar(termo));
      if (gerada && !entradas.includes(gerada)) entradas.push(gerada);
    }
    // As caixas voltam a ficar desmarcadas: elas valem para este acréscimo, e
    // não são uma preferência que fica ligada.
    caixa.querySelectorAll('input').forEach(c => { c.checked = false; });
  }

  for (const entrada of entradas) {
    if (!_extNunca[lista].includes(entrada)) _extNunca[lista].push(entrada);
  }
  campo.value = '';
  _extMarcarSuja('nunca');
  _extDesenharChips(lista);
}
