// Dispersão — scatter onde cada ponto é um arquivo, cruzando linhas de código
// (eixo vertical) com uma métrica de acoplamento (eixo horizontal, trocável).
// Marcador uniforme + nome do arquivo; ⚠ marca o caso fora da curva. Busca por
// nome apaga (deixa translúcido) o que não bate, para não virar "gasoso".
// Usa _buscarDeps e _calcularAcoplamento (mapas.js).

let _dispersaoModo = 'dependencias';   // 'dependencias' (fan-out) | 'dependentes' (fan-in)

async function renderDispersao() {
  const container = document.getElementById('dispersao-container');
  container.innerHTML = '<div class="mapa-loading">Analisando…</div>';

  let dados;
  try {
    dados = await _buscarDeps();
  } catch (err) {
    container.innerHTML = `<div class="mapa-placeholder"><strong>Erro:</strong> ${err.message}</div>`;
    return;
  }

  const acoplamento = _calcularAcoplamento(dados);
  const pontos = dados.nodes
    .filter(n => (n.lines || 0) > 0)
    .map(n => ({
      caminho: n.id,
      linhas: n.lines || 0,
      metrica: acoplamento[n.id] ? acoplamento[n.id][_dispersaoModo] : 0,
    }));

  if (!pontos.length) {
    container.innerHTML = '<div class="mapa-placeholder">Nenhum arquivo com dependências para plotar.</div>';
    return;
  }

  const linhasMax = Math.max(...pontos.map(p => p.linhas));
  const metricaMax = Math.max(1, ...pontos.map(p => p.metrica));
  const eixoX = _dispersaoModo === 'dependencias'
    ? 'Dependências (fan-out) →'
    : 'Chamado por (fan-in) →';

  container.innerHTML = `
    <div class="scatter-search">
      <input type="text" id="dispersao-busca" placeholder="Buscar arquivo… (apaga o resto)">
    </div>
    <div class="scatter-row">
      <div class="scatter-axis-y">Linhas de código ↑</div>
      <div class="scatter-main">
        <div class="scatter-plot" id="dispersao-plot"></div>
        <div class="scatter-axis-x">${eixoX}</div>
      </div>
    </div>`;

  // Posição horizontal por ranking (fila), não pelo valor absoluto: como poucos
  // arquivos concentram quase todas as dependências, uma escala linear amontoaria
  // todo o resto na esquerda. Ordenar por métrica e espalhar por índice distribui
  // os pontos por toda a largura, mantendo a ordem (esquerda = menos, direita = mais).
  const ordenados = [...pontos].sort((a, b) => a.metrica - b.metrica);
  const total = ordenados.length;

  const plot = document.getElementById('dispersao-plot');
  ordenados.forEach((p, i) => {
    // Ponto-fora-da-curva: muitas linhas E muito acoplado ao mesmo tempo
    const foraCurva = p.linhas > 0.7 * linhasMax && p.metrica > 0.7 * metricaMax;
    const nome = p.caminho.split('/').pop();
    const el = document.createElement('div');
    el.className = 'scatter-point' + (foraCurva ? ' scatter-point--alerta' : '');
    el.dataset.file = p.caminho.toLowerCase();
    el.style.left = `${5 + 90 * (total === 1 ? 0.5 : i / (total - 1))}%`;
    el.style.top  = `${5 + 85 * (1 - p.linhas / linhasMax)}%`;
    el.innerHTML = `<span>${nome}${foraCurva ? ' ⚠' : ''}</span>`;
    el.title = `${p.caminho}\n${p.linhas} linhas · ${p.metrica} ${_dispersaoModo === 'dependencias' ? 'dependências' : 'dependentes'}`;
    plot.appendChild(el);
  });

  document.getElementById('dispersao-busca').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    plot.querySelectorAll('.scatter-point').forEach(pt => {
      const bate = !q || pt.dataset.file.includes(q);
      pt.classList.toggle('scatter-point--dim', !bate);
    });
  });

  // Passar o mouse faz o mesmo que a busca: apaga os outros e traz o nome do
  // ponto para a frente. Num aglomerado, é a única forma de ler um nome sem
  // saber de antemão o que procurar — e digitar para descobrir o que está ali
  // é justamente o que não dá para fazer.
  //
  // ⚠️ Classe própria (`--dim-hover`), e não a `--dim` da busca: as duas coisas
  // convivem, e reaproveitar a mesma classe faria sair do ponto limpar o filtro
  // que o usuário digitou.
  //
  // ⚠️ Um par de listeners delegado no plot, nunca um por ponto — aqui são
  // centenas de pontos.
  const todosPontos = plot.querySelectorAll('.scatter-point');
  plot.addEventListener('mouseover', e => {
    const alvo = e.target.closest('.scatter-point');
    if (!alvo) return;
    todosPontos.forEach(pt => {
      pt.classList.toggle('scatter-point--foco', pt === alvo);
      pt.classList.toggle('scatter-point--dim-hover', pt !== alvo);
    });
  });
  plot.addEventListener('mouseout', e => {
    const alvo = e.target.closest('.scatter-point');
    // Sair para dentro do próprio ponto (do marcador para o rótulo) não é sair.
    if (!alvo || (e.relatedTarget && alvo.contains(e.relatedTarget))) return;
    todosPontos.forEach(pt => {
      pt.classList.remove('scatter-point--foco', 'scatter-point--dim-hover');
    });
  });

  document.getElementById('dispersao-stat').textContent = `${pontos.length} arquivos`;
}
