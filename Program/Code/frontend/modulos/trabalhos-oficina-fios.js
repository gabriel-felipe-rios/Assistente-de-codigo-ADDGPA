// ═══ TRABALHOS → Oficina: OS FIOS ═════════════════════════════════════════
//
// A geometria das ligações: onde cada fio nasce, onde encosta, para que lado a
// seta aponta, e o SVG que sai disso.
//
// ⚠️ AS LIGAÇÕES NÃO SÃO DESENHO — o aviso está por extenso no cabeçalho de
// `trabalhos-oficina.js`. Uma linha entre dois nós muda o que acontece com os
// processos deles, e o efeito mora em `backend/modulos/trabalhos_conexoes.py`.
// Este arquivo é SÓ a representação: quem mexer aqui não está mexendo em
// comportamento nenhum, e quem precisar mudar comportamento não acha aqui.
//
// ⚠️ O TRAÇO NÃO ESCALA COM O ZOOM (regra do projeto). O
// `vector-effect: non-scaling-stroke` não resolve, porque quem amplia é uma CSS
// transform num ancestral HTML, não o SVG — a saída é a mesma do `--bm-k` do
// mapa de Backups: o zoom vira variável CSS e a espessura se divide por ela.

// ── Os fios ─────────────────────────────────────────────────────────────────
//
// ⚠️ A CAIXA DE CADA NÓ É MEDIDA NO DOM, e não calculada a partir de uma
// largura fixa por tipo. Um terminal tem 300 px de largura no CSS, mas a
// ALTURA depende do nome e do cabeçalho, e uma nota depende do texto dentro
// dela. Número cravado aqui ficaria certo até a primeira mudança de CSS, e a
// linha passaria a sair do meio do ar.
//
// `offsetLeft`/`offsetWidth` são medidas de LAYOUT, anteriores à CSS transform
// do zoom — então são exatamente as coordenadas do mundo, sem dividir por nada.

function ofiCaixasDosNos() {
  // Uma passada só de LEITURA, antes de qualquer escrita: intercalar as duas
  // força um recálculo de layout por nó, e num arraste isso é a cada quadro.
  const caixas = {};
  document.querySelectorAll('#ofi-nos .ofi-no').forEach(el => {
    caixas[el.dataset.id] = {
      x: el.offsetLeft, y: el.offsetTop,
      w: el.offsetWidth, h: el.offsetHeight,
    };
  });
  return caixas;
}

function ofiCentro(c) {
  return { x: c.x + c.w / 2, y: c.y + c.h / 2 };
}

// ⚠️ O FIO ENCOSTA NUMA DAS QUATRO BOLINHAS, e não num ponto qualquer da
// borda. As alças de ligar (cima, direita, baixo, esquerda) são o único lugar
// de onde se PODE puxar um fio; terminar a linha num ponto que não é nenhuma
// delas faz a ponta parecer presa no vazio — a bolinha num lugar e o fio
// chegando a dois centímetros dela, que foi o que o usuário viu.
//
// ⚠️ E ELA TROCA DE LADO SOZINHA quando os nós se mexem. Levando o cartão da
// direita para a esquerda do outro, o fio passa a sair pela bolinha da
// esquerda — senão ele daria a volta por fora ou atravessaria o próprio
// cartão. Quem decide é a distância RELATIVA à metade de cada lado: um cartão
// largo e baixo escolhe direita/esquerda em quase toda situação, e é isso
// mesmo que se quer de um terminal deitado.
function ofiNaBorda(caixa, alvo) {
  const c = ofiCentro(caixa);
  const dx = alvo.x - c.x, dy = alvo.y - c.y;
  if (!dx && !dy) return c;
  // Normalizado pela metade de cada lado: sem isso um cartão de 400×200
  // escolheria "em cima" por um desnível que, em proporção, é menor que o
  // deslocamento horizontal.
  const rx = Math.abs(dx) / (caixa.w / 2 || 1);
  const ry = Math.abs(dy) / (caixa.h / 2 || 1);
  if (rx >= ry) return { x: dx > 0 ? caixa.x + caixa.w : caixa.x, y: c.y };
  return { x: c.x, y: dy > 0 ? caixa.y + caixa.h : caixa.y };
}

// A seta é geometria, e por isso o tamanho entra dividido pelo zoom aqui e não
// como `stroke-width` no CSS. A cor acompanha a da linha: uma seta cinza no fim
// de um fio azul lê como dois desenhos, e não como um.
// ⚠️ A SETA SIGNIFICA "VOCÊ PODE TRABALHAR COM ESTE", E O QUE ISSO QUER DIZER
// DEPENDE DO ESTADO DO VIZINHO — por isso ela precisa PARECER diferente nos
// dois casos. O mesmo desenho com dois comportamentos e nenhuma pista é uma
// armadilha: o usuário liga dois nós, vê a seta, e conclui que os dois se
// falam — mas se o vizinho estiver fechado ele não entra no `Equipe.md`, e o
// agente do outro lado não sabe que ele existe.
//
//   dois terminais ABERTOS → seta acesa: eles se endereçam pelo nome da sessão
//   qualquer um FECHADO    → seta dormindo: o produto ainda oferece o fechado
//                            como ajudante interno, mas não como sessão viva
//
// ⚠️ A LIGAÇÃO DE DEPENDÊNCIA FICA DE FORA. Ela é ordem de lançamento, do lado
// do programa, e não conversa entre agentes — ela não muda de sentido com o
// terminal aberto ou fechado, e apagá-la quando o vizinho está parado diria
// exatamente o contrário do que ela faz (esperar quem ainda não rodou).
function ofiFioDormindo(l) {
  if (l.tipo === 'dependencia') return false;
  const aberto = id => {
    const n = ofiNos.find(x => x.id === id);
    return !!(n && n.tipo === 'terminal' && n.aberto);
  };
  return !(aberto(l.de) && aberto(l.para));
}

function ofiPontaDeSeta(ponta, vindoDe, k, tipo, dormindo) {
  const ang = Math.atan2(ponta.y - vindoDe.y, ponta.x - vindoDe.x);
  const t = OFI_SETA / k;
  const abertura = 0.42;
  const p = (giro) => `${ponta.x - t * Math.cos(ang + giro)},${ponta.y - t * Math.sin(ang + giro)}`;
  return `<polygon class="ofi-fio-seta ofi-seta-${escapeHtml(tipo)}${
                     dormindo ? ' ofi-fio-dormindo' : ''}"
                   points="${ponta.x},${ponta.y} ${p(abertura)} ${p(-abertura)}"/>`;
}

function ofiTipoDeLigacao(id) {
  return ofiTiposDeLigacao.find(t => t.id === id) || null;
}

function ofiNomeDoNo(id) {
  const no = ofiNos.find(n => n.id === id);
  return no ? no.nome : id;
}

function ofiDesenharFios() {
  const svg = document.getElementById('ofi-fios');
  if (!svg) return;
  const caixas = ofiCaixasDosNos();
  // O zoom entra no traço aqui e não no CSS porque a ponta de seta é geometria,
  // não borda: ela precisa do número, não de um `stroke-width`.
  const k = ofiZoom;
  const pecas = [];

  // ⚠️ DOIS FIOS ENTRE O MESMO PAR PRECISAM DE FOLGA, e não é enfeite: uma
  // dependência (ordem) e um canal (dado) entre os mesmos dois nós é a
  // combinação mais útil das quatro, e é aceita de propósito. Desenhadas na
  // mesma reta, a mais grossa cobre a outra por inteiro — o usuário vê uma
  // ligação onde existem duas, e conclui que a que ele criou não foi criada.
  const paralelos = {};
  ofiLigacoes.forEach(l => {
    if (!ofiTipoDeLigacao(l.tipo)) return;
    const par = [l.de, l.para].sort().join('|');
    (paralelos[par] = paralelos[par] || []).push(l.id);
  });

  ofiLigacoes.forEach(l => {
    const tipo = ofiTipoDeLigacao(l.tipo);
    if (!tipo) return;
    const ca = caixas[l.de], cb = caixas[l.para];
    if (!ca || !cb) return;
    let a = ofiNaBorda(ca, ofiCentro(cb));
    let b = ofiNaBorda(cb, ofiCentro(ca));

    const irmaos = paralelos[[l.de, l.para].sort().join('|')] || [l.id];
    if (irmaos.length > 1) {
      // Deslocamento perpendicular à reta, centrado: com dois fios, um sobe 7 px
      // e o outro desce 7 px; com três, o do meio fica no lugar.
      const passo = (irmaos.indexOf(l.id) - (irmaos.length - 1) / 2) * 14;
      const comp = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / comp * passo, ny = (b.x - a.x) / comp * passo;
      a = { x: a.x + nx, y: a.y + ny };
      b = { x: b.x + nx, y: b.y + ny };
    }
    const dormindo = ofiFioDormindo(l);
    // A pista visual sozinha diz QUE é diferente; o título diz POR QUE. Sem
    // ele o usuário veria a seta apagada e procuraria o defeito no desenho.
    const titulo = `${tipo.rotulo}: ${ofiNomeDoNo(l.de)} ${tipo.seta.includes('↔') ? '↔' : '→'} ${ofiNomeDoNo(l.para)} — ${tipo.descricao}`
      + (dormindo ? '\n\n(apagada: os dois terminais precisam estar ABERTOS para um '
                  + 'endereçar o outro pelo nome. Fechado, o assistente ainda o oferece '
                  + 'como ajudante interno.)' : '');
    // ⚠️ A PEGA INVISÍVEL VEM PRIMEIRO, e o fio visível por cima dela. São o
    // mesmo segmento; a de baixo tem 14 px de traço transparente só para
    // receber o clique, porque um fio de 1,6 px é fino demais para acertar com
    // o mouse. Ela existia no CSS (`.ofi-fio-pega`) e não era emitida por
    // ninguém — e sem o `data-lig` daqui `ofiLigacaoSel` nunca era escrito, que
    // é por que "clicar na seta e apagar" não funcionava de jeito nenhum.
    pecas.push(`<line class="ofi-fio-pega" data-lig="${escapeHtml(l.id)}"
                      x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
                      ><title>${escapeHtml(titulo)}</title></line>`);
    pecas.push(`<line class="ofi-fio ofi-fio-${escapeHtml(l.tipo)}${
                        ofiLigacaoSel === l.id ? ' ofi-fio-sel' : ''}${
                        dormindo ? ' ofi-fio-dormindo' : ''}"
                      x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
                      ><title>${escapeHtml(titulo)}</title></line>`);
    pecas.push(ofiPontaDeSeta(b, a, k, l.tipo, dormindo));
    // Seta dupla: a ida e volta é a única em que os dois lados escrevem.
    if (tipo.duplo) pecas.push(ofiPontaDeSeta(a, b, k, l.tipo, dormindo));
  });

  svg.innerHTML = pecas.join('');
  ofiLigarFios();
}

// ⚠️ DENTRO DE `ofiDesenharFios`, E NÃO EM `ofiLigarEventos`. Os fios são
// refeitos por `innerHTML` a cada arraste de nó (via `ofiPedirFios`, até 60
// vezes por segundo), e `innerHTML` apaga todo ouvinte. Ligar uma vez só, na
// montagem, daria um fio clicável até o primeiro nó ser movido.
function ofiLigarFios() {
  document.querySelectorAll('#ofi-fios [data-lig]').forEach(pega => {
    pega.addEventListener('mousedown', e => {
      // Sem isto o mesmo `mousedown` começa o retângulo de seleção do canvas,
      // e o `soltar` dele limpa a seleção que este clique acabou de fazer.
      e.stopPropagation();
      e.preventDefault();
      ofiLigacaoSel = pega.dataset.lig;
      ofiSelecao.clear();     // fio, nó e grupo não ficam selecionados juntos
      ofiGrupoSel = null;
      ofiDesenhar();
    });
  });
}

// Durante um arraste os nós mudam de lugar por `style`, e o que é DERIVADO da
// posição deles tem de ir junto — no máximo uma vez por quadro, senão o gesto
// trava.
//
// ⚠️ A CAIXA DO GRUPO ENTRA AQUI, e não só os fios. Ela é o retângulo que
// envolve os membros, recalculado a cada desenho — e `ofiDesenhar` só roda
// quando o botão é SOLTO. O resultado era o grupo ficar parado enquanto os nós
// dele se moviam por baixo, e saltar para o lugar certo no fim: arrastando o
// grupo pelo rótulo, parecia que os terminais iam e a moldura não.
//
// `ofiCaixasDosNos` lê `offsetLeft`/`offsetTop`, que já refletem o `style`
// escrito no quadro anterior — então a mesma leitura serve aos dois.
function ofiPedirFios() {
  if (ofiFiosPedidos) return;
  ofiFiosPedidos = requestAnimationFrame(() => {
    ofiFiosPedidos = null;
    ofiDesenharFios();
    ofiDesenharGrupos(ofiCaixasDosNos());
  });
}
