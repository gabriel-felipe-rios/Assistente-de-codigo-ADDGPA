/* ══════════════════ DESIGNER — os chips da barra de modo ══ */
//
// A linha que resume, acima da conversa, TUDO o que vai junto no pedido: um chip
// por dimensão, mais o da variação-base quando há uma.
//
// Arquivo próprio porque `designer-styles.js` cruzou as 300 linhas da AMF, e o
// corte coerente é aqui: os chips são TELA, e o resto daquele arquivo é ESTADO
// (as escolhas, a gravação por sessão, a paleta que tinge as miniaturas). Quem
// mexe no desenho da barra não precisa ler a persistência, e vice-versa.
//
// O chip é só leitura de `escolhasDoDesigner` mais um ✕ que limpa a dimensão —
// nenhuma decisão de estado mora aqui.

function updateDesignChips() {
  const caixa = document.getElementById('designer-chips');
  if (caixa) {
    caixa.innerHTML = '';
    for (const d of _designOrdem) caixa.appendChild(_chipDaDimensao(d));
  }
  // Chip da variação-base: some quando não há seleção, para não ficar um "—"
  // pendurado na barra na primeira rodada, que não tem de onde partir.
  const chipBase = document.getElementById('dchip-base');
  if (chipBase) {
    const sel = (typeof selectedDesignVariation !== 'undefined') ? selectedDesignVariation : null;
    chipBase.classList.toggle('hidden', !sel);
    if (sel) {
      document.getElementById('dchip-base-val').textContent =
        `Rodada ${(sel.rodada ?? 0) + 1} · Variação ${(sel.variacao ?? 0) + 1}`;
    }
  }
}

function _chipDaDimensao(d) {
  const escolhidas = d.unica
    ? (escolhasDoDesigner[d.campo] ? [escolhasDoDesigner[d.campo]] : [])
    : (escolhasDoDesigner[d.campo] || []);
  const itens = escolhidas.map(c => itemPelaChave(d.dimensao, c)).filter(Boolean);

  const chip = document.createElement('div');
  chip.className = 'designer-chip' + (itens.length ? '' : ' vazio');
  chip.innerHTML = `
    <span class="dchip-label">${escapeHtml(d.rotulo)}:</span>
    <span class="dchip-value">${itens.length ? escapeHtml(itens.map(i => i.nome).join(', ')) : 'Nenhum'}</span>
    <span class="dchip-swatches"></span>
    <span class="dchip-clear${itens.length ? '' : ' hidden'}" title="Remover ${escapeHtml(d.rotulo.toLowerCase())}">✕</span>`;

  // A paleta INTEIRA, na mesma ordem da faixa do card: com um recorte das
  // primeiras cores o chip mostrava só os tons de fundo e texto, e não batia com
  // a faixa colorida do card selecionado.
  if (d.campo === 'cor' && itens[0]) {
    const alvo = chip.querySelector('.dchip-swatches');
    for (const hex of hexesDaPaleta(itens[0])) {
      const ponto = document.createElement('span');
      ponto.className = 'dchip-swatch';
      ponto.style.background = hex;
      alvo.appendChild(ponto);
    }
  }
  chip.querySelector('.dchip-clear').addEventListener('click', () => limparDimensao(d.campo));
  return chip;
}
