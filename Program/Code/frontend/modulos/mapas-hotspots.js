// Hotspots — ranking em gráfico de barras horizontais. Dois recortes trocáveis
// por toggle: "Mais linhas de código" (tamanho do arquivo) e "Mais chamados"
// (fan-in — quantos arquivos importam aquele). O recorte "Mais tempo sem mexer"
// saiu do toggle: dependia de data de modificação, que o backend não expõe, e
// um botão permanentemente desabilitado só parece quebrado.
// Usa _buscarMetricas, _achatarArvore, _buscarDeps e _calcularAcoplamento (mapas.js).

let _hotspotsModo = 'linhas';   // 'linhas' | 'chamadas'
let _hotspotsAtuais = [];       // [{caminho, valor}] da última renderização — usado pelo "copiar todos"
// Quantos entram no ranking. Dois toggles separados no cabeçalho, de propósito:
// um escolhe o CRITÉRIO (linhas ou chamadas), o outro a QUANTIDADE. Juntar os
// dois num controle só daria oito opções para responder duas perguntas.
let _hotspotsTopo = 15;         // 5 | 15 | 30 | 50

// Mesma linha para um item e para a lista inteira: "caminho — N linhas/chamadas".
// O rótulo troca com o modo porque `valor` não é sempre linhas de código.
function _hotspotsLinhaTexto(a) {
  const unidade = _hotspotsModo === 'chamadas' ? 'chamadas' : 'linhas';
  return `${a.caminho} — ${a.valor.toLocaleString()} ${unidade}`;
}

function _hotspotsCopiarUm(a) {
  copiarContexto(_hotspotsLinhaTexto(a), 'Caminho copiado.');
}

function _hotspotsCopiarTodos() {
  if (!_hotspotsAtuais.length) return;
  copiarContexto(_hotspotsAtuais.map(_hotspotsLinhaTexto).join('\n'), 'Lista copiada.');
}

async function renderHotspots() {
  const container = document.getElementById('hotspots-container');
  container.innerHTML = '<div class="mapa-loading">Analisando…</div>';

  let arquivos, rotuloStat, vazio;
  try {
    if (_hotspotsModo === 'chamadas') {
      // Fan-in vem do grafo de imports, não das métricas de arquivo: é o mesmo
      // número que a Dispersão mostra no eixo "Chamado por".
      const dados = await _buscarDeps();
      const acoplamento = _calcularAcoplamento(dados);
      arquivos = dados.nodes
        .map(n => ({ caminho: n.id, valor: acoplamento[n.id] ? acoplamento[n.id].dependentes : 0 }))
        .filter(a => a.valor > 0);
      rotuloStat = 'por arquivos que o chamam';
      vazio = 'Nenhum arquivo é importado por outro.';
    } else {
      const raiz = await _buscarMetricas();
      arquivos = _achatarArvore(raiz)
        .map(a => ({ caminho: a.caminho, valor: a.linhas }))
        .filter(a => a.valor > 0);
      rotuloStat = 'por linhas de código';
      vazio = 'Nenhum arquivo com linhas de código.';
    }
  } catch (err) {
    container.innerHTML = `<div class="mapa-placeholder"><strong>Erro:</strong> ${err.message}</div>`;
    return;
  }

  arquivos.sort((a, b) => b.valor - a.valor);
  arquivos = arquivos.slice(0, _hotspotsTopo);
  _hotspotsAtuais = arquivos;

  if (!arquivos.length) {
    container.innerHTML = `<div class="mapa-placeholder">${vazio}</div>`;
    document.getElementById('hotspots-stat').textContent = '';
    return;
  }

  const maximo = arquivos[0].valor;
  container.innerHTML = '';
  const grafico = document.createElement('div');
  grafico.className = 'bar-chart';

  arquivos.forEach(a => {
    const linha = document.createElement('div');
    linha.className = 'bar-row';

    const rotulo = document.createElement('span');
    rotulo.className = 'bar-label';
    rotulo.textContent = a.caminho;
    rotulo.title = a.caminho;

    const trilho = document.createElement('div');
    trilho.className = 'bar-track';
    const preenchimento = document.createElement('div');
    preenchimento.className = 'bar-fill bar-fill--azul';
    preenchimento.style.width = `${Math.max(2, (a.valor / maximo) * 100)}%`;
    trilho.appendChild(preenchimento);

    const valor = document.createElement('span');
    valor.className = 'bar-count';
    valor.textContent = a.valor.toLocaleString();

    const botaoCopiar = document.createElement('button');
    botaoCopiar.className = 'bar-copy';
    botaoCopiar.title = 'Copiar caminho e ' + (_hotspotsModo === 'chamadas' ? 'chamadas' : 'linhas');
    botaoCopiar.textContent = '📋';
    botaoCopiar.addEventListener('click', () => _hotspotsCopiarUm(a));

    linha.append(rotulo, trilho, valor, botaoCopiar);
    grafico.appendChild(linha);
  });

  container.appendChild(grafico);
  document.getElementById('hotspots-stat').textContent =
    `Top ${arquivos.length} ${rotuloStat}`;

  const btnTodos = document.getElementById('btn-hotspots-copiar-todos');
  if (btnTodos && !btnTodos._hotspotsWired) {
    btnTodos._hotspotsWired = true;
    btnTodos.addEventListener('click', _hotspotsCopiarTodos);
  }
}
