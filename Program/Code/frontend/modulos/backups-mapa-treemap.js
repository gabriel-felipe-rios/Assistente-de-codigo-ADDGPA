// ═══ BACKUPS → Mapa da mudança → Treemap ═══════════════════════════════════
//
// Um bloco por arquivo: **tamanho = a grandeza escolhida**, **cor = o que
// aconteceu**. Dois lados, esquerda = antes, direita = agora.
//
// ⚠️ OS DOIS LADOS USAM A MESMA ESCALA. O back-end manda `total_maximo`, e os
// dois desenhos são dimensionados pelo maior. Se cada lado se normalizasse
// sozinho, um projeto que dobrou de tamanho desenharia idêntico dos dois lados
// e a comparação não diria nada.
//
// ⚠️ O ALTERNADOR **Linhas / Em disco** existe por causa de um caso real: o
// `index.db` do Embedding Semântico tem 9,6 MB de binário e, medido em
// "linhas", virava um quadrado que engolia o desenho inteiro. Binário não tem
// linhas — o back-end sempre o mede em bytes, independente do alternador.
//
// ⚠️ TODO QUADRADO VISÍVEL TEM NOME. Quem não cabe num nome sai da cena e volta
// dentro de um bloco só, `+N arquivos pequenos`, que se abre no clique. Um
// bloco de quatro pixels não tem como carregar um nome, e deixá-lo mudo no
// meio do desenho foi a queixa: "um monte de quadradinho aqui que não tem nome".
// A outra metade da resposta está no zoom — ver a contra-escala em
// `backups-mapa-zoom.js`.
//
// Arquivo que existe de um lado e não do outro deixa **moldura tracejada**
// (`.bm-ausente`) guardando o lugar — sem ela os dois desenhos se reorganizam
// inteiros e o olho perde a referência de onde a coisa estava.

// O menor retângulo que ainda carrega um nome de arquivo em 11 px.
const BM_TM_MIN_W = 38;
const BM_TM_MIN_H = 13;

// O bloco agregado está aberto? É estado de tela, não de dado: trocar de
// assunto, de unidade ou de formato fecha (ver `bmPainel`).
let bmTreemapAberto = false;

async function bmDesenharTreemap(area) {
  const r = await window.pywebview.api.mapa_treemap(
    currentProject, bmDe, bmAte, bmMetadeEfetiva(), bmUnidade);
  if (!r.success) throw new Error(r.error);
  // O teto de área chega com o desenho, e a legenda o escreve por extenso.
  bmGuardarTeto(r.teto_por_cento);

  const metades = bmMetadesAMostrar(r.metades);
  bmEstatistica(metades.map(m =>
    `${bmNomeDaMetade(m)}: ${bmResumoEmTexto(r.metades[m].resumo)}`).join(' · '));

  area.innerHTML = `
    ${bmTreemapAberto ? `
      <div class="bm-migalha"><button class="bm-voltar" id="bm-tm-voltar">←</button>
        Só os arquivos pequenos — os que não cabiam um nome no desenho cheio.</div>` : ''}
    <div class="bm-quadrantes${metades.length > 1 ? ' bm-quadrantes--dois' : ''}">
      ${metades.map(m => `
        <div class="bm-quadrante" data-metade="${m}">
          ${metades.length > 1 ? `<div class="bm-quadrante-h">${bmNomeDaMetade(m)}</div>` : ''}
          ${bmPar(
            `<svg class="bm-svg" data-lado="antes" data-metade="${m}"><g class="bm-camada"></g></svg>`,
            `<svg class="bm-svg" data-lado="agora" data-metade="${m}"><g class="bm-camada"></g></svg>`,
            bmRotuloDoLado('antes'), bmRotuloDoLado('agora'))}
        </div>`).join('')}
    </div>`;

  bmAvisos(area, metades.map(m => r.metades[m].resumo));

  const pares = [];
  metades.forEach(m => {
    const dados = r.metades[m];
    const molde = area.querySelector(`svg[data-metade="${m}"]`);
    const pequenos = bmPequenosDosDoisLados(dados, molde);
    const cena = { antes: bmEmCena(dados.antes, pequenos),
                   agora: bmEmCena(dados.agora, pequenos) };
    // Com o bloco aberto, a escala comum é a do RECORTE: usar o total do
    // desenho cheio faria os arquivos pequenos aparecerem tão pequenos quanto
    // eram lá dentro, e abrir não teria servido para nada.
    const totalMaximo = bmTreemapAberto
      ? Math.max(bmSoma(cena.antes), bmSoma(cena.agora), 1)
      : dados.total_maximo;
    ['antes', 'agora'].forEach(lado => {
      const svg = area.querySelector(`svg[data-lado="${lado}"][data-metade="${m}"]`);
      const camada = svg.querySelector('.bm-camada');
      bmMontarTreemap(svg, camada, cena[lado], totalMaximo, m);
      pares.push({ svg, camada });
    });
  });
  // O terceiro argumento é o que reacerta os rótulos, e ele roda no FIM do
  // gesto — nunca por quadro. O Treemap não usa mais `bmPodarRotulos`: os
  // rótulos dele são `<text>`, e a conta de caber é aritmética.
  bmLigarZoom(pares, null,
              k => pares.forEach(({ camada }) => bmTreemapRotulos(camada, k)));
  bmLigarAberturaDoAgregado(area);
  // Clicar num bloco abre a diferença daquele arquivo. O bloco agregado não tem
  // `data-caminho` (ele não é um arquivo, é uma porta) e o cinza é barrado pelo
  // `data-situacao` — clicar em algo sem alteração não apresenta nada.
  bmLigarCliqueDeArquivo(area, '.bm-bloco', 'tmDiffLigado');
  // O tamanho do SVG é congelado no desenho; sem isto, esticar a janela deixa
  // o desenho pequeno num painel grande — foi parte do "não ocupa a tela".
  //
  // ⚠️ `bmLigarResize()` na mão: quem ligava o listener de janela era
  // `bmPodarRotulos`, e o Treemap deixou de chamá-lo. Sem esta linha, abrir o
  // programa direto no Treemap deixaria o redesenho no `resize` desligado.
  bmRedesenharNoResize = () => bmDesenhar();
  bmLigarResize();
}

// ── Quem é pequeno demais para ter nome ─────────────────────────────────────

// ⚠️ A DECISÃO É TOMADA UMA VEZ, SOBRE OS DOIS LADOS. Um arquivo só é agregado
// se for pequeno **nos dois**. Se cada painel decidisse sozinho, o mesmo
// arquivo apareceria à esquerda e sumiria à direita, e a comparação — que é a
// razão de a tela existir — passaria a mentir.
function bmPequenosDosDoisLados(dados, molde) {
  const largura = (molde && molde.clientWidth) || 480;
  const altura = (molde && molde.clientHeight) || 420;
  const medir = blocos => {
    const folhas = bmFolhasDoTreemap(blocos, largura,
                                     bmAlturaUtil(blocos, dados.total_maximo, altura));
    return new Map(folhas.map(f => [f.data.caminho,
                                    { w: f.x1 - f.x0, h: f.y1 - f.y0 }]));
  };
  const a = medir(dados.antes), b = medir(dados.agora);
  // Ausente de um lado conta como pequeno: o que decide é o lado em que ele
  // existe. Se fosse o contrário, todo arquivo criado seria agregado.
  const cabe = (m, caminho) => {
    const c = m.get(caminho);
    return !!c && c.w >= BM_TM_MIN_W && c.h >= BM_TM_MIN_H;
  };
  const pequenos = new Set();
  new Set([...a.keys(), ...b.keys()]).forEach(caminho => {
    if (!cabe(a, caminho) && !cabe(b, caminho)) pequenos.add(caminho);
  });
  return pequenos;
}

// A lista que vai para a cena: ou o desenho cheio com os menores dobrados num
// bloco só, ou — com o bloco aberto — apenas esses menores.
function bmEmCena(blocos, pequenos) {
  if (bmTreemapAberto) return blocos.filter(b => pequenos.has(b.caminho));

  const grandes = blocos.filter(b => !pequenos.has(b.caminho));
  const menores = blocos.filter(b => pequenos.has(b.caminho));
  // Dobrar um arquivo só não resolve nada: ele continuaria sem nome, agora com
  // um rótulo pior. A partir de dois, o bloco agregado ganha.
  if (menores.length < 2) return blocos;
  return grandes.concat([{
    caminho: '', nome: `+${menores.length} arquivos pequenos`,
    valor: menores.reduce((s, b) => s + b.valor, 0),
    mais: menores.reduce((s, b) => s + b.mais, 0),
    menos: menores.reduce((s, b) => s + b.menos, 0),
    situacao: menores.some(b => b.situacao !== 'igual') ? 'alterado' : 'igual',
    quantos: menores.length, agregado: true, binario: false, ausente: false,
  }]);
}

function bmLigarAberturaDoAgregado(area) {
  // Um listener na área inteira, com delegação: o conteúdo é remontado a cada
  // desenho, e ligar bloco por bloco empilharia listeners a cada troca.
  //
  // ⚠️ `#bm-area` SOBREVIVE ao redesenho — só o `innerHTML` dele é trocado. Sem
  // a marca, cada desenho penduraria mais um listener no mesmo elemento, e
  // depois de dez trocas de formato um clique abriria o bloco dez vezes.
  if (area.dataset.tmLigado) return;
  area.dataset.tmLigado = '1';
  area.addEventListener('click', ev => {
    if (ev.target.closest('#bm-tm-voltar')) { bmTreemapAberto = false; bmDesenhar(); return; }
    if (ev.target.closest('.bm-bloco.agregado')) { bmTreemapAberto = true; bmDesenhar(); }
  });
}

// ── O desenho ───────────────────────────────────────────────────────────────

function bmSoma(blocos) {
  return blocos.reduce((s, b) => s + b.valor, 0);
}

function bmAlturaUtil(blocos, totalMaximo, altura) {
  // A escala comum: a área desenhada é proporcional ao total DESTE lado sobre
  // o maior dos dois. O lado menor ocupa menos tela, que é exatamente a
  // informação que se quer ver.
  const total = blocos.reduce((s, b) => s + b.valor, 0) || 1;
  return Math.max(24, altura * (total / (totalMaximo || 1)));
}

function bmFolhasDoTreemap(blocos, largura, alturaUtil) {
  if (!blocos.length) return [];
  const raiz = { name: 'raiz', children: blocos.map(b => ({ ...b, value: Math.max(b.valor, 0.5) })) };
  const no = d3.hierarchy(raiz).sum(d => d.value || 0)
    .sort((a, b) => (b.value || 0) - (a.value || 0));
  // `paddingInner` de meio pixel: o traço de separação já é o `stroke` da cor
  // do fundo. Um vão de 1 px em cima dele é borda sobre borda, e num bloco
  // pequeno sobrava borda e nenhum miolo — foi a queixa "parece que só a borda
  // está sendo pintada".
  d3.treemap().size([largura, alturaUtil]).paddingInner(0.5)(no);
  return no.leaves();
}

function bmMontarTreemap(svg, camada, blocos, totalMaximo, metade) {
  const largura = svg.clientWidth || 480;
  const altura = svg.clientHeight || 420;
  svg.setAttribute('viewBox', `0 0 ${largura} ${altura}`);

  if (!blocos.length) {
    camada.innerHTML = `<text x="${largura / 2}" y="${altura / 2}" class="bm-svg-vazio"
      text-anchor="middle">nada deste lado</text>`;
    return;
  }

  const folhas = bmFolhasDoTreemap(blocos, largura,
                                   bmAlturaUtil(blocos, totalMaximo, altura));

  camada.innerHTML = folhas.map(folha => {
    const d = folha.data;
    const w = Math.max(0, folha.x1 - folha.x0);
    const h = Math.max(0, folha.y1 - folha.y0);
    const classe = [d.agregado ? 'agregado bm-igual'
                  : d.ausente ? 'bm-ausente' : bmClasseDaSituacao(d.situacao),
                    d.limitado ? 'limitado' : ''].join(' ');
    const dica = d.agregado
      ? `${d.quantos} arquivos pequenos demais para caber um nome\n(clique para abrir)`
      // Movido/renomeado não leva `+0 / −0`: o conteúdo é idêntico, e a conta
      // zerada só faz procurar a mudança na linha errada. O par ocupa o lugar.
      : `${escapeHtml(d.caminho)}\n${d.situacao}${
          d.par ? ` ${bmSetaDoPar(d)} ${escapeHtml(d.par)}`
                : d.binario ? ' · binário' : ` · +${d.mais} / −${d.menos}`}${
          d.limitado ? '\n(limitado no desenho — o tamanho real é maior)' : ''}${
          d.situacao === 'igual' ? '' : '\n(clique para ver a diferença)'}`;
    // Os `data-*` são o que o clique lê. Vão no `<g>`, e não no `<rect>`,
    // porque o alvo do clique pode ser o `<text>` do rótulo.
    const dados = d.agregado ? '' :
      ` data-caminho="${escapeHtml(d.caminho)}" data-metade="${escapeHtml(metade)}"` +
      ` data-situacao="${escapeHtml(d.situacao)}"`;
    // ⚠️ `<text>`, E NÃO `<foreignObject>`. Cada `foreignObject` abre um
    // documento HTML dentro do SVG; com centenas de blocos em dois painéis são
    // milhares deles, e o motor refazia o layout de todos a cada quadro do
    // gesto. Era o travamento do Treemap.
    return `
      <g transform="translate(${folha.x0},${folha.y0})" class="bm-bloco ${classe}"${dados}>
        <title>${dica}</title>
        <rect width="${w}" height="${h}" rx="2"></rect>
        <text class="bm-tm-rot" data-w="${w.toFixed(1)}" data-h="${h.toFixed(1)}"
              data-nome="${escapeHtml(d.nome)}">${escapeHtml(d.nome)}</text>
      </g>`;
  }).join('');
  bmTreemapRotulos(camada, 1);
}

// A largura média de um caractere a 11 px na fonte da interface. É estimativa,
// e de propósito.
const BM_TM_LARGURA_CHAR = 6.4;

// Acerta os rótulos para uma escala.
//
// ⚠️ A CONTA É ARITMÉTICA, NÃO MEDIÇÃO. Perguntar ao navegador quanto mede
// cada texto força o recálculo do layout, e um recálculo por rótulo por quadro
// é o que travava o gesto. Aqui só se ESCREVE — nenhuma leitura de geometria,
// nenhum reflow. A estimativa erra para mais de vez em quando; o custo disso é
// um nome a menos na tela, e o custo do contrário era a tela inteira travando.
//
// A fonte fica do mesmo tamanho NA TELA em qualquer escala (`11 / k`), e é por
// isso que ampliar revela nome: o bloco cresce e o texto não.
function bmTreemapRotulos(raiz, k) {
  const escala = Math.min(4, Math.max(1, k || 1));
  raiz.querySelectorAll('text.bm-tm-rot').forEach(t => {
    const w = parseFloat(t.dataset.w), h = parseFloat(t.dataset.h);
    const nome = t.dataset.nome || '';
    // Tudo em pixels DE TELA: o bloco mede `w * escala`, e o texto continua em
    // 11 px porque é contra-escalado.
    const cabe = (h * escala >= 15) &&
                 (nome.length * BM_TM_LARGURA_CHAR + 8 <= w * escala);
    t.style.display = cabe ? '' : 'none';
    if (!cabe) return;
    t.setAttribute('font-size', (11 / escala).toFixed(2));
    t.setAttribute('x', (4 / escala).toFixed(2));
    t.setAttribute('y', (12 / escala).toFixed(2));
  });
}
