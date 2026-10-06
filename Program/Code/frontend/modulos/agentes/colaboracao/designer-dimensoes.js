/* ══════════════════════ DESIGNER — as cinco abas de escolha ══ */
//
// Estilos · Cores · Tipografia · Texturas · Animações. Uma função monta as
// cinco: escrever cinco telas quase iguais à mão as faria divergir na primeira
// que ganhasse um controle.
//
// Escolha ÚNICA em Estilos, Cores e Tipografia; MÚLTIPLA em Texturas e
// Animações — e em Animações, uma opção por pasta de evento, porque duas
// animações para o mesmo evento seriam duas ordens contraditórias ao modelo.
//
// As miniaturas reusam o motor de `modulos/estilos-e-cores-miniaturas.js`, o
// mesmo da biblioteca global. A diferença é o prefixo: aqui vai um `<style>` com
// a paleta escolhida, e é por isso que o card de estilo sai TINGIDO com ela.

// Dimensões que precisam ser repintadas quando a aba delas abrir. Repintar é
// caro: destrói e recria os iframes das miniaturas. Só vale a pena quando a
// paleta mudou (a tingidura é outra) ou quando as escolhas vieram de fora.
let _ddSujas = new Set();

function marcarDimensoesSujas(exceto) {
  for (const d of _designOrdem) if (d.campo !== exceto) _ddSujas.add(d.dimensao);
}

function renderDimensaoAtiva() {
  const painel = document.querySelector('#asubtab-designer .designer-tab-content.active .dtab-rolagem[data-dimensao]');
  if (!painel) return;
  const chave = painel.dataset.dimensao;
  // Só repinta se algo mudou desde a última vez — ou se ela ainda está vazia.
  if (_ddSujas.has(chave) || !painel.firstElementChild) renderDimensaoDoDesigner(chave);
}

function renderTodasAsDimensoes() {
  for (const d of _designOrdem) renderDimensaoDoDesigner(d.dimensao);
}

function renderDimensaoDoDesigner(chaveDimensao) {
  const alvo = document.querySelector(`#asubtab-designer .dtab-rolagem[data-dimensao="${chaveDimensao}"]`);
  const dados = (_designDimensoes || {})[chaveDimensao];
  if (!alvo || !dados) return;
  const d = _designOrdem.find(x => x.dimensao === chaveDimensao);
  // A raiz é obrigatória: sem ela esta chamada derrubava o observador das OUTRAS
  // quatro dimensões, e `renderTodasAsDimensoes` (cinco chamadas seguidas) deixava
  // só a última com miniatura. Era o motivo de Estilos e Cores nascerem em branco.
  ecSoltarMiniaturas(alvo);
  alvo.innerHTML = '';
  alvo.appendChild(_ddCabecalho(d, dados));
  if (dados.tem_tag) alvo.appendChild(_ddBarraDeTags(dados));
  alvo.appendChild(dados.por_pasta ? _ddGrupos(d, dados) : _ddLista(d, dados, dados.itens));
  if (typeof ddRestaurarZoom === 'function') ddRestaurarZoom(alvo);
  _ddSujas.delete(chaveDimensao);
}

// A atualização barata: mexe só nas MARCAS de quem mudou — a borda do card, o
// selo "Ativo", o contador do cabeçalho e o rótulo do grupo. Nenhum iframe é
// tocado, e é por isso que escolher uma cor deixou de fazer a tela piscar.
function atualizarMarcasDaDimensao(campo) {
  const d = dimensaoPorCampo(campo);
  const alvo = d && document.querySelector(`#asubtab-designer .dtab-rolagem[data-dimensao="${d.dimensao}"]`);
  if (!alvo) return;

  alvo.querySelectorAll('.dd-card').forEach(card => {
    const escolhido = estaEscolhido(campo, card.dataset.chave);
    card.classList.toggle('escolhido', escolhido);
    const acoes = card.querySelector('.dd-acoes');
    const selo = acoes.querySelector('.dcc-active-badge');
    if (escolhido && !selo) {
      const novo = document.createElement('span');
      novo.className = 'dcc-active-badge';
      novo.textContent = 'Ativo';
      acoes.insertBefore(novo, acoes.firstChild);
    } else if (!escolhido && selo) {
      selo.remove();
    }
  });

  const quantas = d.unica
    ? (escolhasDoDesigner[campo] ? 1 : 0)
    : (escolhasDoDesigner[campo] || []).length;
  const contador = alvo.querySelector('.dd-contador');
  if (contador) contador.textContent = `${quantas} escolhida${quantas === 1 ? '' : 's'}`;
  const limpar = alvo.querySelector('.dd-limpar');
  if (limpar) limpar.disabled = !quantas;

  // Animações: o rótulo de cada pasta diz qual movimento está escolhido nela.
  alvo.querySelectorAll('.dd-grupo').forEach(bloco => {
    const rotulo = bloco.querySelector('.dd-grupo-escolha');
    if (!rotulo) return;
    const escolhida = (escolhasDoDesigner[campo] || [])
      .find(c => c.startsWith(bloco.dataset.pasta + '/'));
    rotulo.textContent = escolhida
      ? escolhida.split('/').pop().replace(/\.html$/i, '')
      : 'sem movimento';
  });
}

function _ddCabecalho(d, dados) {
  const escolhidas = d.unica
    ? (escolhasDoDesigner[d.campo] ? 1 : 0)
    : (escolhasDoDesigner[d.campo] || []).length;
  const cab = document.createElement('div');
  cab.className = 'dd-cabecalho';
  cab.innerHTML = `
    <div class="dd-titulo">${escapeHtml(dados.rotulo)}
      <span class="dd-quantas">${d.unica ? 'escolha uma' : 'escolha quantas quiser'}</span>
    </div>
    <div class="dd-direita">
      <span class="dd-contador">${escolhidas} escolhida${escolhidas === 1 ? '' : 's'}</span>
      <button type="button" class="btn btn-muted btn-sm dd-limpar"${escolhidas ? '' : ' disabled'}>Limpar</button>
    </div>`;
  cab.querySelector('.dd-limpar').addEventListener('click', () => limparDimensao(d.campo));
  // O − / + do zoom, só onde ele existe: controle que não faz nada naquela tela é
  // pior que controle nenhum.
  const zoom = typeof ddControleDeZoom === 'function' ? ddControleDeZoom(dados.dimensao) : null;
  if (zoom) cab.querySelector('.dd-direita').insertBefore(zoom, cab.querySelector('.dd-contador'));
  return cab;
}

// A tag funciona como pasta: escolher uma troca o conteúdo da lista inteira, e
// "todas" é sempre a primeira opção. Só entram as tags usadas nesta dimensão —
// pasta vazia é botão morto. Em Animações a barra não existe: aquela dimensão se
// agrupa por pasta de evento de verdade.
let _ddTagAtiva = {};

function _ddBarraDeTags(dados) {
  const ativa = _ddTagAtiva[dados.dimensao] || '';
  const usadas = dados.tags.filter(t => t === ativa || dados.itens.some(i => i.tags.includes(t)));
  const barra = document.createElement('div');
  barra.className = 'dd-tagbar';
  barra.innerHTML = '<span class="dd-tagbar-rot">Tags:</span>';
  for (const tag of ['', ...usadas]) {
    const n = dados.itens.filter(i => !tag || i.tags.includes(tag)).length;
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'dd-tagpasta' + (tag === ativa ? ' active' : '');
    botao.innerHTML = `${escapeHtml(tag || 'todas')}<span class="dd-tagpasta-cnt">${n}</span>`;
    botao.addEventListener('click', () => {
      _ddTagAtiva[dados.dimensao] = tag;
      renderDimensaoDoDesigner(dados.dimensao);
    });
    barra.appendChild(botao);
  }
  return barra;
}

function _ddLista(d, dados, itens) {
  const ativa = _ddTagAtiva[dados.dimensao] || '';
  const visiveis = dados.tem_tag ? itens.filter(i => !ativa || i.tags.includes(ativa)) : itens;
  const grade = document.createElement('div');
  grade.className = 'dd-grade';
  if (!visiveis.length) {
    grade.innerHTML = `<div class="arq-empty">Nada aqui${ativa ? ` com a tag <code>${escapeHtml(ativa)}</code>` : ''}.</div>`;
    return grade;
  }
  for (const item of visiveis) grade.appendChild(_ddCard(d, dados, item));
  return grade;
}

// Animações: um bloco por pasta de evento, com a primeira linha útil do
// `Explicação.md` à vista — é ela que diz ONDE aquele movimento se aplica.
function _ddGrupos(d, dados) {
  const area = document.createElement('div');
  area.className = 'dd-grupos';
  for (const grupo of dados.grupos) {
    const escolhida = (escolhasDoDesigner[d.campo] || [])
      .find(c => c.startsWith(grupo.pasta + '/'));
    const bloco = document.createElement('div');
    bloco.className = 'dd-grupo';
    bloco.dataset.pasta = grupo.pasta;
    bloco.innerHTML = `
      <div class="dd-grupo-cab">
        <span class="dd-grupo-nome">📁 ${escapeHtml(grupo.pasta)}</span>
        <span class="dd-grupo-escolha">${escolhida ? escapeHtml(escolhida.split('/').pop().replace(/\.html$/i, '')) : 'sem movimento'}</span>
      </div>
      ${grupo.explicacao ? `<div class="dd-grupo-onde">${escapeHtml(ecPrimeiraFrase(grupo.explicacao))}</div>` : ''}`;
    bloco.appendChild(_ddLista(d, dados, grupo.itens));
    area.appendChild(bloco);
  }
  return area;
}

function _ddCard(d, dados, item) {
  const chave = chaveDoItem(item);
  const escolhido = estaEscolhido(d.campo, chave);
  const card = document.createElement('div');
  card.className = 'dd-card' + (escolhido ? ' escolhido' : '');
  card.dataset.chave = chave;
  card.innerHTML = `
    <div class="dd-mini ec-mini ec-mini-${escapeHtml(dados.dimensao)}"></div>
    <div class="dd-rodape">
      <div class="dd-nome">${escapeHtml(item.nome)}</div>
      <div class="dd-acoes"></div>
    </div>
    ${item.descricao ? `<div class="dd-desc">${escapeHtml(item.descricao)}</div>` : ''}
    ${item.tags && item.tags.length ? `<div class="dd-tags">${item.tags.map(t => `<span class="ec-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}`;

  // Tinge a miniatura com a paleta escolhida. Não vale para a própria aba Cores:
  // ali a miniatura É a paleta, e tingi-la com ela mesma não diria nada.
  const paleta = dados.dimensao === 'cores' ? '' : cssDaPaletaEscolhida();
  ecAgendarMiniatura(card.querySelector('.dd-mini'), dados.dimensao, item, paleta);

  const acoes = card.querySelector('.dd-acoes');
  if (escolhido) {
    const selo = document.createElement('span');
    selo.className = 'dcc-active-badge';
    selo.textContent = 'Ativo';
    acoes.appendChild(selo);
  }
  acoes.appendChild(criarBotaoOlho('Ver em tela cheia', () => _ddAbrirPreview(dados, item)));

  card.addEventListener('click', () => {
    // Animações: uma opção por pasta. Escolher outra do mesmo evento troca em
    // vez de somar — duas animações para o mesmo evento seriam duas ordens
    // contraditórias ao modelo.
    if (dados.por_pasta && !estaEscolhido(d.campo, chave)) {
      const pasta = item.pasta + '/';
      escolhasDoDesigner[d.campo] = (escolhasDoDesigner[d.campo] || []).filter(c => !c.startsWith(pasta));
    }
    alternarEscolha(d.campo, chave);
  });
  return card;
}

function _ddAbrirPreview(dados, item) {
  if (dados.dimensao === 'cores') {
    const paleta = dadosDaPaleta(item);
    if (paleta) openStylePreviewModal(montarPreviewPaleta(paleta), item.nome);
    return;
  }
  if (dados.extensao === '.html') {
    openStylePreviewModal(item.conteudo + cssDaPaletaEscolhida(), item.nome);
    return;
  }
  // Tipografia e texturas são JSON: mostrar o arquivo é mais honesto que
  // inventar uma prévia que não é o que vai ao modelo.
  openStylePreviewModal(
    `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
     body{background:#12101E;color:#E8E0F5;font:13px ui-monospace,Consolas,monospace;padding:24px;white-space:pre-wrap}
     </style></head><body>${escapeHtml(item.conteudo)}</body></html>`, item.nome);
}
