// ═════════════════════ VISUALIZAR PIPELINE — LEITURA "RAIAS POR CAMADA" ══
// Uma faixa horizontal por camada do programa, colunas por fase, cada arquivo
// desenhado UMA vez e as ligações como curvas entre eles.
//
// Antes esta leitura era uma lista de linhas sob os títulos FRONTEND JS e
// BACKEND PYTHON, com o nome do arquivo repetido em toda linha, e a travessia
// era o texto "12 travessia(s) de camada" no topo. Ou seja: a única leitura
// cujo assunto é justamente a troca de camada não mostrava nenhuma troca de
// camada. Agora a travessia é a curva laranja tracejada que se vê descer de
// uma faixa para a outra.
//
// ⚠️ A coluna é a PROFUNDIDADE no fluxo, não o arquivo e não a fase.
//
//   • Um arquivo por coluna: a cadeia C9 do projeto de teste tem 66 arquivos,
//     o que dava catorze mil pixels de largura.
//   • Uma fase por coluna: parece a escolha óbvia, porque a fase já é a ordem
//     topológica que o backend calcula — mas ela é do PASSO, não do arquivo, e
//     um arquivo é desenhado uma vez só. Numa cadeia em que quase todo arquivo
//     estreia na fase 1, tudo empilha numa coluna e o desenho vira uma lista
//     com espaguete do lado. Sob recorte de uma fase só, colapsa sempre.
//   • Profundidade: 0 para quem não recebe ninguém, e um a mais que o mais
//     fundo dos que o chamam. As arestas de volta (o `.js` que responde ao
//     `.py` que ele mesmo chamou) não contam para a profundidade — elas são
//     justamente o que a curva de retorno mostra.
//
// Na prática isso dá 5 colunas para a C9 inteira e 2 a 4 para as outras, com
// altura menor do que a versão por fase. A fase não se perde: vira um selo no
// canto do nó.

const VP_RAIA_LARGURA_NO = 170;
const VP_RAIA_ALTURA_NO = 34;
const VP_RAIA_VAO_VERTICAL = 12;
const VP_RAIA_VAO_HORIZONTAL = 88;
const VP_RAIA_COLUNA_ROTULOS = 128;
const VP_RAIA_FOLGA_FAIXA = 20;

// `classeDoPasso` é o gancho de comparação: recebe a ligação (ou o arquivo) e
// devolve a classe extra que o desenho deve carregar — `bm-criado`,
// `bm-removido`, `bm-igual`. Nasce vazio, então o Visualizar pipeline não muda
// em nada; quem o usa é o Mapa da mudança da aba Backups, que desenha dois
// pipelines lado a lado e precisa colorir passo a passo.
function vpRaias(foco, classeDoPasso = () => '') {
  const passos = foco.passos;

  const arquivos = vpArquivosDosPassos(passos);
  if (!arquivos.length) return '<p class="vp-vazio">Esta cadeia não tem passos.</p>';
  const ordem = new Map(arquivos.map((a, i) => [a, i]));

  // A fase em que o arquivo aparece pela primeira vez — vira selo no nó.
  const faseDoArquivo = new Map();
  passos.forEach(passo => {
    [passo.origem, passo.destino].forEach(arquivo => {
      if (!faseDoArquivo.has(arquivo)) faseDoArquivo.set(arquivo, passo.fase);
    });
  });

  // Profundidade. Percorrer na ordem de aparição é o que dispensa detectar
  // ciclo: quando chega a vez de um arquivo, todos os que o chamam ANTES dele
  // já têm profundidade final, e os que o chamam DEPOIS são aresta de volta —
  // que não deve empurrar ninguém para a direita.
  const profundidade = new Map(arquivos.map(a => [a, 0]));
  arquivos.forEach(arquivo => {
    passos.forEach(passo => {
      if (passo.destino !== arquivo || passo.origem === arquivo) return;
      if (ordem.get(passo.origem) >= ordem.get(arquivo)) return;
      profundidade.set(arquivo,
        Math.max(profundidade.get(arquivo), profundidade.get(passo.origem) + 1));
    });
  });
  const colunas = Math.max(...profundidade.values()) + 1;

  const camadasUsadas = VP_CAMADAS.filter(camada =>
    arquivos.some(a => vpCamadaDoArquivo(a) === camada.chave));

  // Célula = cruzamento de uma coluna com uma camada. Os arquivos dela empilham.
  const celulas = new Map();
  arquivos.forEach(arquivo => {
    const chave = profundidade.get(arquivo) + '|' + vpCamadaDoArquivo(arquivo);
    if (!celulas.has(chave)) celulas.set(chave, []);
    celulas.get(chave).push(arquivo);
  });

  // Altura de cada faixa = a célula mais cheia dela.
  const alturaDaFaixa = new Map();
  const topoDaFaixa = new Map();
  let topo = VP_RAIA_FOLGA_FAIXA;
  camadasUsadas.forEach(camada => {
    let maior = 1;
    for (let c = 0; c < colunas; c++) maior = Math.max(maior, (celulas.get(c + '|' + camada.chave) || []).length);
    const altura = maior * (VP_RAIA_ALTURA_NO + VP_RAIA_VAO_VERTICAL) + VP_RAIA_FOLGA_FAIXA;
    alturaDaFaixa.set(camada.chave, altura);
    topoDaFaixa.set(camada.chave, topo);
    topo += altura;
  });

  const posicao = new Map();
  celulas.forEach((lista, chave) => {
    const [coluna, camada] = chave.split('|');
    const x = VP_RAIA_COLUNA_ROTULOS + Number(coluna) * (VP_RAIA_LARGURA_NO + VP_RAIA_VAO_HORIZONTAL);
    lista.forEach((arquivo, i) => {
      posicao.set(arquivo, {
        x,
        y: topoDaFaixa.get(camada) + VP_RAIA_FOLGA_FAIXA / 2
           + i * (VP_RAIA_ALTURA_NO + VP_RAIA_VAO_VERTICAL),
      });
    });
  });

  const largura = VP_RAIA_COLUNA_ROTULOS + colunas * (VP_RAIA_LARGURA_NO + VP_RAIA_VAO_HORIZONTAL) + 20;
  const altura = topo + VP_RAIA_FOLGA_FAIXA;

  let svg = `<svg width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}"
    xmlns="http://www.w3.org/2000/svg">`;

  // As faixas, atrás de tudo.
  camadasUsadas.forEach((camada, i) => {
    const y = topoDaFaixa.get(camada.chave), h = alturaDaFaixa.get(camada.chave);
    svg += `<rect x="0" y="${y}" width="${largura}" height="${h}" fill="rgba(${camada.cor},${i % 2 ? 0.05 : 0.09})"/>
      <line class="vp-raia-divisa" x1="0" y1="${y}" x2="${largura}" y2="${y}"/>
      <rect x="10" y="${y + 14}" width="4" height="22" rx="2" fill="rgb(${camada.cor})"/>
      <text class="vp-raia-rotulo" x="22" y="${y + 30}" fill="rgb(${camada.cor})">${camada.titulo.toUpperCase()}</text>`;
  });

  // As ligações. Vêm antes dos nós para passarem por baixo deles.
  foco.ligacoes.forEach((ligacao, indice) => {
    const de = posicao.get(ligacao.origem), para = posicao.get(ligacao.destino);
    if (!de || !para) return;
    svg += vpRaiaAresta(de, para, ligacao, indice, classeDoPasso(ligacao));
  });

  // Os nós. O selo de fase fica no canto: a coluna passou a ser profundidade,
  // e sem ele a fase — que é como a trilha recorta a cadeia — sumiria daqui.
  posicao.forEach((ponto, arquivo) => {
    const camada = VP_CAMADAS.find(c => c.chave === vpCamadaDoArquivo(arquivo));
    const nome = vpNomeBase(arquivo);
    const texto = nome.length > 21 ? nome.slice(0, 20) + '…' : nome;
    const fase = faseDoArquivo.get(arquivo);
    svg += `<g class="${classeDoPasso({ origem: arquivo, destino: arquivo, arquivo })}" data-arquivo="${escapeHtml(arquivo)}"><title>${escapeHtml(arquivo)} · entra na fase ${fase}</title>
      <rect class="vp-no-caixa" x="${ponto.x}" y="${ponto.y}"
        width="${VP_RAIA_LARGURA_NO}" height="${VP_RAIA_ALTURA_NO}" rx="7"
        stroke="rgba(${camada.cor},0.7)"/>
      <rect x="${ponto.x}" y="${ponto.y}" width="4" height="${VP_RAIA_ALTURA_NO}" rx="2" fill="rgb(${camada.cor})"/>
      <text class="vp-no-texto ${camada.classe}" x="${ponto.x + 13}" y="${ponto.y + 21}">${escapeHtml(texto)}</text>
      <text class="vp-no-fase" x="${ponto.x + VP_RAIA_LARGURA_NO - 8}" y="${ponto.y + 21}">F${fase}</text></g>`;
  });

  return svg + '</svg>';
}

// Três roteamentos, porque as ligações não vão só para a direita:
//   • para a frente  — a curva normal, borda direita → borda esquerda;
//   • dentro da mesma fase — laço curto pela direita, que volta para a borda
//     direita do destino sem invadir a coluna seguinte;
//   • para trás — laço por baixo, que acontece quando o fluxo devolve para uma
//     fase anterior.
// O desvio por índice (`indice % 3`) evita que ligações entre as mesmas duas
// colunas fiquem exatamente uma em cima da outra.
function vpRaiaAresta(de, para, ligacao, indice, extra = '') {
  const meioY = VP_RAIA_ALTURA_NO / 2;
  const y1 = de.y + meioY, y2 = para.y + meioY;
  const desvio = (indice % 3) * 14;
  const classe = (ligacao.travessia ? 'vp-aresta travessia' : 'vp-aresta') + (extra ? ' ' + extra : '');
  let caminho, pontaX, pontaY, ponta, seloX, seloY;

  if (para.x > de.x) {
    const x1 = de.x + VP_RAIA_LARGURA_NO, x2 = para.x;
    caminho = `M ${x1} ${y1} C ${x1 + 40 + desvio} ${y1}, ${x2 - 40 - desvio} ${y2}, ${x2 - 9} ${y2}`;
    pontaX = x2 - 9; pontaY = y2;
    ponta = `${pontaX} ${pontaY - 5} L ${pontaX + 9} ${pontaY} L ${pontaX} ${pontaY + 5}`;
    seloX = (x1 + x2) / 2; seloY = (y1 + y2) / 2 - 12;
  } else if (para.x === de.x) {
    // Laço curto pela direita, para dois arquivos da mesma fase. O bulbo
    // cresce com o desvio para os laços de uma mesma coluna não empilharem em
    // cima uns dos outros.
    const x = de.x + VP_RAIA_LARGURA_NO, bulbo = 30 + desvio;
    caminho = `M ${x} ${y1} C ${x + bulbo} ${y1}, ${x + bulbo} ${y2}, ${x + 9} ${y2}`;
    pontaX = x + 9; pontaY = y2;
    ponta = `${pontaX} ${pontaY - 5} L ${pontaX - 9} ${pontaY} L ${pontaX} ${pontaY + 5}`;
    // O selo vai na barriga do laço, nunca no meio — ali seria em cima do nó.
    seloX = x + bulbo * 0.75; seloY = (y1 + y2) / 2;
  } else {
    const x1 = de.x, x2 = para.x + VP_RAIA_LARGURA_NO, queda = 44 + desvio;
    caminho = `M ${x1} ${y1 + 8} C ${x1 - 70} ${y1 + queda}, ${x2 + 70} ${y2 + queda}, ${x2 + 9} ${y2 + 8}`;
    pontaX = x2 + 9; pontaY = y2 + 8;
    ponta = `${pontaX} ${pontaY - 5} L ${pontaX - 9} ${pontaY} L ${pontaX} ${pontaY + 5}`;
    seloX = (x1 + x2) / 2; seloY = (y1 + y2) / 2 + queda * 0.7;
  }

  const rotulo = ligacao.vias.length > 1
    ? `<g class="vp-raia-vezes"><rect x="${seloX - 13}" y="${seloY - 9}" width="26" height="17" rx="8"/>
       <text x="${seloX}" y="${seloY + 3.5}">×${ligacao.vias.length}</text></g>`
    : '';

  return `<g><title>${escapeHtml(vpNomeBase(ligacao.origem))} → ${escapeHtml(vpNomeBase(ligacao.destino))}
${escapeHtml(ligacao.vias.join(', '))}</title>
    <path class="${classe}" d="${caminho}" fill="none"/>
    <path class="${classe} ponta" d="M ${ponta} Z"/></g>${rotulo}`;
}
