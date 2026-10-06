/* ══════════════════ DESIGNER — zoom da grade em Estilos e Animações ══ */
//
// Nas duas dimensões que renderizam HTML de verdade a miniatura é pequena demais
// para julgar sem abrir o olhinho de cada card — e em Animações isso é pior,
// porque o movimento só se lê enquanto ele roda. Os dois botões do cabeçalho
// ampliam a grade inteira, no lugar.
//
// Cores, Tipografia e Texturas ficam de fora de propósito: elas já se leem no
// tamanho normal.
//
// ⚠️ POR BOTÃO, não pela roda do mouse. A primeira versão tomava a roda para o
// zoom, e isso rouba a única forma de rolar uma lista de 18 cards — o gesto mais
// usado da tela passa a fazer outra coisa. A roda rola, e só rola.

const DD_DIMENSOES_COM_ZOOM = new Set(['estilos', 'animacoes']);
const DD_ZOOM_MIN = 0.6;
const DD_ZOOM_MAX = 3;
const DD_ZOOM_PASSO = 0.2;
// A escala de partida da miniatura no Designer — a mesma que
// `agentes-colaboracao-designer-abas.css` declara em `.dd-mini`.
const DD_ESCALA_BASE = 0.34;

// O nível é lembrado por dimensão enquanto o app está aberto: ir a Cores e voltar
// não pode desfazer o zoom que a pessoa acabou de ajustar.
const _ddZoomPorDimensao = {};

function _ddPainel(dimensao) {
  return document.querySelector(`#asubtab-designer .dtab-rolagem[data-dimensao="${dimensao}"]`);
}

// ⚠️ As duas variáveis são gravadas em NÚMERO já calculado, e não como `calc()`
// dentro do CSS: `--mini-escala` entra num `calc(100% / var(--mini-escala))`, e
// dividir por uma expressão em vez de por um número puro é terreno movediço em
// CSS. A conta é uma multiplicação — fazê-la aqui custa nada e não depende do
// motor.
function _ddAplicarZoom(dimensao, valor) {
  // ⚠️ Arredonda ANTES de comparar com os extremos. Somar 0,2 seis vezes chega a
  // 0.6000000000000001, e `z <= 0.6` dá falso — o botão nunca desabilitava no piso,
  // e o nível mostrado ficava um centavo fora do que a conta dizia.
  const bruto = Math.round(valor * 100) / 100;
  const z = Math.min(DD_ZOOM_MAX, Math.max(DD_ZOOM_MIN, bruto));
  _ddZoomPorDimensao[dimensao] = z;
  const painel = _ddPainel(dimensao);
  if (painel) {
    painel.style.setProperty('--dd-zoom', z.toFixed(4));
    painel.style.setProperty('--dd-escala-mini', (DD_ESCALA_BASE * z).toFixed(4));
    const rotulo = painel.querySelector('.dd-zoom-nivel');
    if (rotulo) rotulo.textContent = Math.round(z * 100) + '%';
    painel.querySelectorAll('.dd-zoom-btn').forEach(b => {
      b.disabled = Number(b.dataset.passo) > 0 ? z >= DD_ZOOM_MAX : z <= DD_ZOOM_MIN;
    });
  }
  return z;
}

// O controle do cabeçalho: − · o nível · +. O nível é clicável e volta a 100% —
// um terceiro botão só para isso ocuparia espaço dizendo o que o número já diz.
function ddControleDeZoom(dimensao) {
  if (!DD_DIMENSOES_COM_ZOOM.has(dimensao)) return null;
  const caixa = document.createElement('div');
  caixa.className = 'dd-zoom';
  caixa.innerHTML = `
    <button type="button" class="dd-zoom-btn" data-passo="-1" title="Diminuir os cards">−</button>
    <button type="button" class="dd-zoom-nivel" title="Voltar ao tamanho normal">100%</button>
    <button type="button" class="dd-zoom-btn" data-passo="1" title="Aumentar os cards">+</button>`;
  caixa.querySelectorAll('.dd-zoom-btn').forEach(botao => {
    botao.addEventListener('click', () => _ddAplicarZoom(
      dimensao, (_ddZoomPorDimensao[dimensao] || 1) + DD_ZOOM_PASSO * Number(botao.dataset.passo)));
  });
  caixa.querySelector('.dd-zoom-nivel').addEventListener('click', () => _ddAplicarZoom(dimensao, 1));
  return caixa;
}

// Recoloca o zoom guardado num painel recém-montado, e acerta o rótulo e os
// botões desabilitados nos extremos. Chamada ao fim de cada montagem.
function ddRestaurarZoom(painel) {
  const dimensao = painel && painel.dataset && painel.dataset.dimensao;
  if (dimensao && DD_DIMENSOES_COM_ZOOM.has(dimensao)) {
    _ddAplicarZoom(dimensao, _ddZoomPorDimensao[dimensao] || 1);
  }
}
