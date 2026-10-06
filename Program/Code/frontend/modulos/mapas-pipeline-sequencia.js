// ═══════════════════════ VISUALIZAR PIPELINE — LEITURA "SEQUÊNCIA" ══
// Cada arquivo é uma coluna com linha de vida, e o tempo desce. É a única
// leitura em que a mesma coluna reaparece — é assim que se enxerga o vaivém
// entre dois arquivos, que nenhuma das outras cinco mostra.
//
// A versão anterior era uma TABELA de caracteres: `●` na origem, `─` no meio,
// `▶` no destino, com o nome do arquivo girado 90° no cabeçalho e a frase
// numa última coluna que, com muitos arquivos, ficava fora da tela. Nada
// disso sobrou: a seta é desenhada, o "por onde" fica em cima dela e a frase
// embaixo — as duas dentro da largura da própria seta, então não há mais como
// o texto escapar para a direita.

const VP_SEQ_LARGURA_COLUNA = 176;

// `classeDoPasso` é o gancho de comparação: recebe a ligação (ou o arquivo) e
// devolve a classe extra que o desenho deve carregar — `bm-criado`,
// `bm-removido`, `bm-igual`. Nasce vazio, então o Visualizar pipeline não muda
// em nada; quem o usa é o Mapa da mudança da aba Backups, que desenha dois
// pipelines lado a lado e precisa colorir passo a passo.
function vpSequencia(foco, classeDoPasso = () => '') {
  const arquivos = vpArquivosDosPassos(foco.passos);
  if (!arquivos.length) return '<p class="vp-vazio">Esta cadeia não tem passos.</p>';
  const coluna = new Map(arquivos.map((a, i) => [a, i]));
  const largura = arquivos.length * VP_SEQ_LARGURA_COLUNA;
  const centro = i => i * VP_SEQ_LARGURA_COLUNA + VP_SEQ_LARGURA_COLUNA / 2;

  const cabecalho = arquivos.map(arquivo => `
    <div class="vp-seq-coluna">
      <span class="vp-seq-arquivo ${vpClasseDeCamada(arquivo)}" data-arquivo="${escapeHtml(arquivo)}"
            title="${escapeHtml(arquivo)}">${escapeHtml(vpNomeBase(arquivo))}</span>
    </div>`).join('');

  const vidas = arquivos.map((_, i) =>
    `<div class="vp-seq-vida" style="left:${centro(i)}px"></div>`).join('');

  const linhas = foco.ligacoes.map(ligacao => {
    const extra = classeDoPasso(ligacao);
    const de = coluna.get(ligacao.origem), para = coluna.get(ligacao.destino);
    const esquerda = Math.min(centro(de), centro(para));
    const comprimento = Math.abs(centro(para) - centro(de));
    const sentido = para > de ? 'para-direita' : 'para-esquerda';
    const rotulo = ligacao.vias[0] + (ligacao.vias.length > 1 ? ` ×${ligacao.vias.length}` : '');
    // Uma ligação de um arquivo para ele mesmo teria comprimento zero e
    // sumiria; damos a ela uma largura mínima para a seta continuar visível.
    const largo = Math.max(comprimento, 40);
    return `
      <div class="vp-seq-linha ${extra}" title="${escapeHtml(ligacao.origem)} → ${escapeHtml(ligacao.destino)}">
        <span class="vp-seq-n">${vpFaixaDeOrdem(ligacao)}</span>
        <span class="vp-seq-rotulo" style="left:${esquerda}px;width:${largo}px">${escapeHtml(rotulo)}</span>
        <span class="vp-seq-seta ${sentido} ${ligacao.travessia ? 'travessia' : ''}"
              style="left:${esquerda}px;width:${largo}px"></span>
        <span class="vp-seq-frase" style="left:${esquerda}px;width:${largo}px"
              >${escapeHtml(ligacao.passos[0].frase)}</span>
      </div>`;
  }).join('');

  return `
    <div class="vp-seq"><div class="vp-seq-tabela">
      <div class="vp-seq-cab">${cabecalho}</div>
      <div class="vp-seq-corpo" style="min-width:${largura}px">
        <div class="vp-seq-vidas">${vidas}</div>${linhas}
      </div>
    </div></div>`;
}
