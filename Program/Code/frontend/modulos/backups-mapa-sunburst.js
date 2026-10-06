// ═══ BACKUPS → Mapa da mudança → Sunburst ══════════════════════════════════
//
// Anéis: pasta → arquivo. Um sol por lado, esquerda = antes, direita = agora.
//
// ⚠️ O RAIO CRESCE COM A **RAIZ** DO TOTAL, não com o total (`raio_relativo`,
// que vem do back-end). Área é proporcional ao quadrado do raio: crescer o raio
// linearmente faz um projeto 4× maior parecer 16× maior. E há um **piso**, pelo
// motivo oposto: sem ele um lado com 1% do outro vira um ponto ilegível e a
// comparação some junto com o desenho.
//
// O disco usa o painel INTEIRO. Antes ele nascia num quadrado pequeno num
// painel de altura fixa, e o resultado foi a queixa "está numa janelinha
// pequenininha, não toma área suficiente".

async function bmDesenharSunburst(area) {
  const r = await window.pywebview.api.mapa_sunburst(
    currentProject, bmDe, bmAte, bmMetadeEfetiva(), bmUnidade);
  if (!r.success) throw new Error(r.error);
  // O teto de área chega com o desenho, e a legenda o escreve por extenso.
  bmGuardarTeto(r.teto_por_cento);

  const metades = bmMetadesAMostrar(r.metades);

  area.innerHTML = `
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
    ['antes', 'agora'].forEach(lado => {
      const svg = area.querySelector(`svg[data-lado="${lado}"][data-metade="${m}"]`);
      const camada = svg.querySelector('.bm-camada');
      bmMontarSunburst(svg, camada, r.metades[m][lado], m);
      pares.push({ svg, camada });
    });
  });
  bmLigarZoom(pares);
  // Clicar numa fatia de arquivo abre a diferença dele — o mesmo modal do
  // Treemap. Anel de pasta e arquivo sem alteração não abrem nada.
  bmLigarCliqueDeArquivo(area, '.bm-fatia', 'sbDiffLigado');
  bmRedesenharNoResize = () => bmDesenhar();

  // A conta das fatias que não couberam sai DEPOIS do desenho, porque é ele que
  // sabe quantas eram finas demais. Dizer o número é obrigatório: um corte
  // silencioso faz o desenho afirmar que o projeto tem menos arquivos do que
  // tem.
  const escondidas = metades.reduce(
    (soma, m) => soma + (r.metades[m].antes.escondidas || 0)
                      + (r.metades[m].agora.escondidas || 0), 0);
  bmEstatistica(
    metades.map(m => `${bmNomeDaMetade(m)}: ${bmResumoEmTexto(r.metades[m].resumo)}`).join(' · ') +
    (escondidas ? ` · ${escondidas} fatias finas demais para desenhar` : ''));
}

function bmMontarSunburst(svg, camada, dados, metade) {
  const largura = svg.clientWidth || 460;
  const altura = svg.clientHeight || 420;
  svg.setAttribute('viewBox', `0 0 ${largura} ${altura}`);

  // Três camadas, como no Sunburst da aba Mapas: o <svg> capta os eventos, a
  // `.bm-camada` recebe o transform do zoom, e um <g> interno leva a origem
  // para o meio, para os arcos ficarem em polares a partir de (0,0).
  //
  // O `- 10` é a margem que impede a borda externa de encostar no viewport; o
  // raio sai do MENOR dos dois eixos, senão o disco vaza pelo lado curto — que
  // é o que produzia o meio-círculo cortado do teste.
  const raio = (Math.min(largura, altura) / 2 - 10) * (dados.raio_relativo || 1);
  if (!dados.raiz || !dados.raiz.filhos.length || raio <= 0) {
    camada.innerHTML = `<text x="${largura / 2}" y="${altura / 2}" class="bm-svg-vazio"
      text-anchor="middle">nada deste lado</text>`;
    return;
  }

  const no = d3.hierarchy(dados.raiz, d => d.filhos)
    .sum(d => (d.filhos && d.filhos.length) ? 0 : Math.max(d.valor || 0, 0.5))
    .sort((a, b) => (b.value || 0) - (a.value || 0));
  d3.partition().size([2 * Math.PI, raio])(no);

  const arco = d3.arc()
    .startAngle(d => d.x0).endAngle(d => d.x1)
    .innerRadius(d => d.y0).outerRadius(d => Math.max(d.y0, d.y1 - 1));

  // ⚠️ FATIA FINA DEMAIS NÃO ENTRA — é o mesmo corte do Sunburst da aba Mapas
  // (`> 0.001` radiano). Abaixo disso o arco não tem largura para desenhar
  // nada: ele vira um risco de um pixel, e centenas deles viram "um monte de
  // linha na tela", que foi a queixa. Elas também custam caro: são centenas de
  // `<path>` que o motor redesenha a cada quadro do zoom.
  const todas = no.descendants().filter(d => d.depth > 0);
  const visiveis = todas.filter(d => (d.x1 - d.x0) > 0.001);
  dados.escondidas = todas.length - visiveis.length;

  const fatias = visiveis.map(d => {
    const dado = d.data;
    const ehArquivo = !(dado.filhos && dado.filhos.length);
    const classe = ehArquivo
      ? [dado.ausente ? 'bm-ausente' : bmClasseDaSituacao(dado.situacao),
         dado.limitado ? 'limitado' : ''].join(' ')
      : 'bm-pasta';
    // Só ARQUIVO ganha os `data-*` do clique. Um anel de pasta não tem
    // diferença para mostrar — ele é o caminho, não o conteúdo.
    const dados = ehArquivo
      ? ` data-caminho="${escapeHtml(dado.caminho || '')}" data-metade="${escapeHtml(metade)}"`
        + ` data-situacao="${escapeHtml(dado.situacao || '')}"`
      : '';
    return `<path d="${arco(d)}" class="bm-fatia ${classe}"${dados}>
      <title>${escapeHtml(dado.caminho || dado.nome)}${
        ehArquivo && dado.par ? `\n${dado.situacao} ${bmSetaDoPar(dado)} ${escapeHtml(dado.par)}` : ''}${
        ehArquivo && dado.binario ? '\nbinário' : ''}${
        ehArquivo && dado.situacao !== 'igual' ? '\n(clique para ver a diferença)' : ''
      }</title></path>`;
  }).join('');

  camada.innerHTML =
    `<g transform="translate(${largura / 2},${altura / 2})">${fatias}</g>`;
}
