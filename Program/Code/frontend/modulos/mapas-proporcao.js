// Proporção — rosca (donut) com o percentual de linhas de código por linguagem
// no projeto inteiro. Reaproveita _langColor (mapas.js) como fonte de cor das
// linguagens, a mesma do Treemap/Sunburst.
// Usa _buscarMetricas e _achatarArvore (mapas.js).

async function renderProporcao() {
  const container = document.getElementById('proporcao-container');
  container.innerHTML = '<div class="mapa-loading">Analisando…</div>';

  let raiz;
  try {
    raiz = await _buscarMetricas();
  } catch (err) {
    container.innerHTML = `<div class="mapa-placeholder"><strong>Erro:</strong> ${err.message}</div>`;
    return;
  }

  const porLinguagem = {};
  let total = 0;
  _achatarArvore(raiz).forEach(a => {
    if (a.linhas <= 0) return;
    porLinguagem[a.linguagem] = (porLinguagem[a.linguagem] || 0) + a.linhas;
    total += a.linhas;
  });

  const lista = Object.entries(porLinguagem)
    .map(([linguagem, linhas]) => ({ linguagem, linhas, pct: (linhas / total) * 100 }))
    .sort((a, b) => b.linhas - a.linhas);

  if (!lista.length) {
    container.innerHTML = '<div class="mapa-placeholder">Nenhuma linha de código encontrada.</div>';
    return;
  }

  // Monta os segmentos do conic-gradient
  let acumulado = 0;
  const segmentos = lista.map(item => {
    const inicio = acumulado;
    acumulado += item.pct;
    return `${_langColor(item.linguagem)} ${inicio.toFixed(2)}% ${acumulado.toFixed(2)}%`;
  }).join(', ');

  const legenda = lista.map(item => `
    <div class="donut-legend-item">
      <span class="donut-dot" style="background:${_langColor(item.linguagem)}"></span>
      ${item.linguagem} — ${item.pct.toFixed(1)}%
    </div>`).join('');

  const principal = lista[0];
  container.innerHTML = `
    <div class="donut-wrap">
      <div class="donut" style="background: conic-gradient(${segmentos});">
        <div class="donut-center">
          <b>${principal.pct.toFixed(0)}%</b>
          <span>${principal.linguagem}</span>
        </div>
      </div>
      <div class="donut-legend">${legenda}</div>
    </div>`;

  document.getElementById('proporcao-stat').textContent = `${total.toLocaleString()} linhas`;
}
