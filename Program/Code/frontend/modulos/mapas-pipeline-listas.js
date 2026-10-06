// ═══════════ VISUALIZAR PIPELINE — LEITURAS DE LISTA E DE CARTÃO ══
// As três que não são desenho vetorial: Trilho numerado, Cadeias e Fases.
// Ficam juntas porque compartilham as mesmas peças (`vpNo`, `vpChipsDeVia`,
// `vpFaixaDeOrdem`) e porque separá-las em três arquivos de sessenta linhas
// seria dividir por dividir.

// ══════════════════════════════════════════ 2. Trilho numerado ══
// A cadeia lida de cima para baixo, agrupada por fase. A bolha traz a FAIXA de
// passos que a ligação cobre (`15–18`), não um número solto: agrupado, um item
// da lista vale por vários passos do arquivo, e esconder isso faria a
// numeração parecer furada.
function vpTrilho(foco) {
  const fases = vpFasesDosPassos(foco.passos);
  return fases.map(fase => {
    const doFase = foco.ligacoes.filter(l => l.fase === fase);
    if (!doFase.length) return '';
    const passos = doFase.reduce((soma, l) => soma + l.vias.length, 0);
    return `
      <div class="vp-faixa">
        <div class="vp-faixa-cab">
          <span class="vp-faixa-pilula">Fase ${fase}</span>
          <span class="vp-faixa-linha"></span>
          <span class="vp-faixa-qtd">${passos} passos em ${doFase.length} ligações</span>
        </div>
        <div class="vp-linha-tempo">${doFase.map(ligacao => `
          <div class="vp-parada">
            <span class="vp-parada-bolha">${vpFaixaDeOrdem(ligacao)}</span>
            <div class="vp-parada-l1">
              ${vpNo(ligacao.origem)}
              <span class="vp-seta ${ligacao.travessia ? 'travessia' : ''}">${ligacao.travessia ? '⇢' : '→'}</span>
              ${vpNo(ligacao.destino)}
              ${ligacao.vias.length > 1 ? `<span class="vp-vezes">×${ligacao.vias.length}</span>` : ''}
              ${ligacao.travessia ? '<span class="vp-tag travessia">troca de camada</span>' : ''}
            </div>
            <div class="vp-parada-l2">
              ${vpChipsDeVia(ligacao.vias, 5)}
              <span class="vp-frase">${escapeHtml(ligacao.passos[0].frase)}</span>
              ${vpChipsDeSelo(ligacao, foco.comuns)}
            </div>
          </div>`).join('')}
        </div>
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════ 4. Cadeias ══
// Um trilho horizontal por cadeia, uma embaixo da outra: é a leitura que
// mostra que elas são independentes — nenhuma seta sai de uma faixa e entra na
// de baixo. Cada arquivo aparece UMA vez, como estação numerada; o vagão
// antigo trazia origem e destino juntos, então o mesmo nome saía duas vezes
// por passo e a linha quebrava no meio de um caminho.
const VP_ESTACOES_VISIVEIS = 9;

function vpCadeias(focos) {
  return `<div class="vp-visao-geral">${focos.map(foco => {
    const cadeia = foco.cadeia;
    const estacoes = vpArquivosDosPassos(foco.passos);
    const aberta = _vpExpandidas.has(cadeia.n);
    const limite = aberta ? estacoes.length : VP_ESTACOES_VISIVEIS;
    const mostradas = estacoes.slice(0, limite);

    let trilho = '';
    mostradas.forEach((arquivo, i) => {
      if (i > 0) {
        const chegando = foco.ligacoes.filter(l => l.destino === arquivo);
        const chamadas = chegando.reduce((soma, l) => soma + l.vias.length, 0);
        const travessia = chegando.some(l => l.travessia);
        trilho += `
          <div class="vp-elo">
            <span class="vp-elo-n">${chamadas > 1 ? '×' + chamadas : ''}</span>
            <span class="vp-elo-linha ${travessia ? 'travessia' : ''}"></span>
          </div>`;
      }
      trilho += `
        <div class="vp-estacao" data-arquivo="${escapeHtml(arquivo)}" title="${escapeHtml(arquivo)}">
          <span class="vp-estacao-bolha ${i === 0 ? 'inicio' : ''}">${i === 0 ? '▶' : i}</span>
          <span class="vp-estacao-nome ${vpClasseDeCamada(arquivo)}">${escapeHtml(vpNomeBase(arquivo))}</span>
        </div>`;
    });
    if (estacoes.length > limite) {
      trilho += `<button class="vp-mais" data-expandir="${cadeia.n}">+${estacoes.length - limite} arquivos</button>`;
    } else if (aberta) {
      trilho += `<button class="vp-mais" data-expandir="${cadeia.n}">Recolher</button>`;
    }

    const emoji = vpEmojiDaCadeia(cadeia);
    return `
      <div class="vp-vg-linha vp-cadeia-${(cadeia.n - 1) % 9}">
        <div class="vp-vg-cab">
          <div class="vp-vg-nome">
            <span class="vp-pino">C${cadeia.n}</span>${emoji ? emoji + ' ' : ''}${escapeHtml(vpRotuloDaCadeia(cadeia))}
          </div>
          <div class="vp-vg-meta" title="${escapeHtml(cadeia.cabeca)}">${escapeHtml(cadeia.cabeca || '—')}</div>
          <div class="vp-vg-nums">
            ${foco.passos.length} passos · ${foco.ligacoes.length} ligações ·
            <span class="vp-conta-travessias">${vpContarTravessias(foco.passos)} travessias</span> ·
            ${estacoes.length} arquivos
          </div>
        </div>
        <div class="vp-trilho-h">${trilho}</div>
      </div>`;
  }).join('')}</div>`;
}

// ══════════════════════════════════════════ 5. Fases ══
// Um quadro com uma coluna por fase e TODAS as cadeias juntas. A tarja
// colorida do cartão diz de qual cadeia o passo é — sem ela, a coluna "Fase 2"
// pareceria um fluxo só. A legenda em cima é clicável e vira filtro.
// `classeDoPasso` é o gancho de comparação: recebe a ligação (ou o arquivo) e
// devolve a classe extra que o desenho deve carregar — `bm-criado`,
// `bm-removido`, `bm-igual`. Nasce vazio, então o Visualizar pipeline não muda
// em nada; quem o usa é o Mapa da mudança da aba Backups, que desenha dois
// pipelines lado a lado e precisa colorir passo a passo.
// `todasCadeias` e `destacada` também nascem com o valor global de hoje: a
// legenda de cadeias e o esmaecimento só fazem sentido dentro da sub-aba, e o
// Mapa da mudança passa uma lista própria.
function vpFases(focos, classeDoPasso = () => '',
                 todasCadeias = (typeof _vpDados !== 'undefined' && _vpDados ? _vpDados.cadeias : []),
                 destacada = (typeof _vpCadeia !== 'undefined' ? _vpCadeia : null)) {
  const todos = focos.flatMap(foco =>
    foco.ligacoes.map(ligacao => ({ ligacao, cadeia: foco.cadeia, comuns: foco.comuns })));
  const fases = [...new Set(todos.map(i => i.ligacao.fase))].sort((a, b) => a - b);

  const legenda = (todasCadeias || []).map(cadeia => `
    <button class="vp-legenda-item vp-cadeia-${(cadeia.n - 1) % 9} ${destacada && destacada !== cadeia.n ? 'apagada' : ''}"
            data-legenda="${cadeia.n}" title="${escapeHtml(cadeia.cabeca || cadeia.nome)}">
      <span class="vp-pino">C${cadeia.n}</span>${escapeHtml(vpRotuloDaCadeia(cadeia))}
    </button>`).join('');

  const quadro = fases.map(fase => {
    const itens = todos.filter(i => i.ligacao.fase === fase);
    const passos = itens.reduce((soma, i) => soma + i.ligacao.vias.length, 0);
    return `
      <div class="vp-coluna">
        <div class="vp-coluna-cab">
          <span class="vp-coluna-titulo">Fase ${fase}</span>
          <span class="vp-coluna-qtd">${passos} passos</span>
        </div>
        <div class="vp-coluna-corpo">${itens.map(({ ligacao, cadeia, comuns }) => `
          <div class="vp-cartao vp-cadeia-${(cadeia.n - 1) % 9} ${classeDoPasso(ligacao)}">
            <div class="vp-cartao-topo">
              <span class="vp-cartao-n">C${cadeia.n}·${vpFaixaDeOrdem(ligacao)}</span>
              ${ligacao.vias.length > 1 ? `<span class="vp-vezes">×${ligacao.vias.length}</span>` : ''}
              ${ligacao.travessia ? '<span class="vp-tag travessia">travessia</span>' : ''}
            </div>
            <div class="vp-cartao-fluxo">
              <span class="vp-cartao-arq ${vpClasseDeCamada(ligacao.origem)}"
                    data-arquivo="${escapeHtml(ligacao.origem)}">${escapeHtml(vpNomeBase(ligacao.origem))}</span>
              <span class="vp-cartao-meio">
                <span class="vp-seta ${ligacao.travessia ? 'travessia' : ''}">↓</span></span>
              <span class="vp-cartao-arq ${vpClasseDeCamada(ligacao.destino)}"
                    data-arquivo="${escapeHtml(ligacao.destino)}">${escapeHtml(vpNomeBase(ligacao.destino))}</span>
            </div>
            ${vpChipsDeVia(ligacao.vias, 2)}
            <div class="vp-frase" style="margin-top:6px">${escapeHtml(ligacao.passos[0].frase)}</div>
            ${vpChipsDeSelo(ligacao, comuns)}
          </div>`).join('')}
        </div>
      </div>`;
  }).join('');

  return `<div class="vp-legenda">${legenda}</div><div class="vp-quadro">${quadro}</div>`;
}
