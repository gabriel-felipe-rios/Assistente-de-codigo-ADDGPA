// ═══ TRABALHOS → Oficina: OS GRUPOS ═══════════════════════════════════════
//
// A caixa com rótulo em volta de alguns nós: como ela é desenhada, como ela é
// renomeada, e a FILIAÇÃO — quem está dentro de quem.
//
// ⚠️ AGRUPAR NÃO AFETA EXECUÇÃO NENHUMA. Um grupo não cria ligação, não cria
// dependência e não faz um nó esperar pelo outro. Grupo e ligação são conceitos
// independentes, e um nó pode estar num grupo sem ligação nenhuma com os
// vizinhos. Quem misturar os dois estará desfazendo a decisão que os separou.
//
// ⚠️ A CAIXA É DERIVADA, e não guardada: ela é o retângulo que envolve os nós
// membros, recalculado a cada desenho. É por isso que a filiação vem junto
// neste arquivo e não no de arraste — mover um nó muda de que grupo ele é, e as
// duas contas leem a mesma geometria. Separá-las daria duas verdades sobre onde
// a caixa está.
//
// ⚠️ ARRASTAR E ESTICAR A CAIXA ficaram em `trabalhos-oficina-arraste.js`,
// junto do arraste de nó: lá a pergunta é *o que um gesto do mouse faz*, e ela
// é a mesma para os dois. Aqui a pergunta é *que forma o grupo tem*.

// ── As caixas de grupo ──────────────────────────────────────────────────────
//
// ⚠️ A CAIXA É DERIVADA, e não guardada: ela é o retângulo que envolve os nós
// do grupo, recalculado a cada desenho. Guardar largura e altura no
// `Layout.json` daria uma caixa que não acompanha o nó arrastado para fora
// dela — e o desacordo entre o desenho e o dado só apareceria depois.

const OFI_FOLGA_DO_GRUPO = 16;
// ⚠️ TEM DE BATER COM A ALTURA REAL DE `.ofi-grupo-cab` no CSS. É por esta
// medida que a caixa do grupo sobe para abrir espaço à faixa do nome; se ela
// ficar menor que a faixa, o nome cobre o topo dos nós de dentro.
// 12,5px de letra + 2×7px de recheio ≈ 29.
const OFI_ALTURA_DO_ROTULO = 29;

// Espelha `LADO_MINIMO_DO_GRUPO` do backend. Uma caixa menor que isto não dá
// para pegar de novo — as alças das quatro bordas se encostariam.
const OFI_LADO_MINIMO_DO_GRUPO = 80;

// A faixa de pixels, em cada borda, que responde ao arraste de redimensionar.
// ⚠️ ELA CRESCE PARA DENTRO, e não para fora: para fora ela cobriria o vizinho
// de quem a caixa está encostada, e o usuário pegaria a moldura errada.
const OFI_ALCA_DO_GRUPO = 10;

// Grupos que já tiveram a caixa gravada nesta sessão. ⚠️ SEM ISTO A MIGRAÇÃO
// VIRA UM LAÇO: gravar chama `ofiCarregar`, que redesenha, que migraria de novo.
const ofiGruposMigrados = new Set();

// A caixa de um grupo. O dado gravado VENCE — desde 2026-09-03 ele tem posição
// e tamanho próprios, e é isso que se redimensiona.
//
// ⚠️ O CAMINHO DE BAIXO É MIGRAÇÃO, e não o normal. Grupo criado antes daquela
// data não tem caixa nenhuma: ali ela ainda é a união dos membros mais a folga,
// exatamente como era, e `ofiMigrarGrupo` grava o resultado para que a próxima
// leitura já caia no caminho de cima. Quem apagar isto quebra os grupos antigos
// do usuário, e o sintoma é a caixa sumir do canvas.
function ofiCaixaDoGrupo(g, caixas) {
  if (Number.isFinite(g.largura) && Number.isFinite(g.altura)) {
    return {x: g.x || 0, y: g.y || 0, w: g.largura, h: g.altura};
  }
  return ofiMolduraEmVolta(ofiCaixasParaAbracar(g.nos, caixas));
}

// As caixas que uma moldura precisa abraçar para não cortar nada: a de cada nó
// e a do CARTÃO DE ANOTAÇÕES pendurado nele.
//
// ⚠️ O CARTÃO NÃO É `.ofi-no` — de propósito, ver `ofiNoDeAnotacoes` —, então
// `ofiCaixasDosNos` não o enxerga. Sem esta passada a caixa fecha em cima do
// terminal e deixa a anotação pendurada do lado de fora, que foi relato do
// usuário: *"a nota que fica ali pra baixo meio que ficou de fora"*.
//
// ⚠️ E ELA NÃO ENTRA EM `caixas`. Aquele mapa é de onde os fios saem: inflar a
// caixa de um nó com o cartão dele faria a seta começar no vazio, longe da
// borda do terminal.
function ofiCaixasParaAbracar(ids, caixas) {
  const saida = [];
  (ids || []).forEach(i => {
    if (caixas[i]) saida.push(caixas[i]);
    const el = document.querySelector(`#ofi-nos .ofi-anotno[data-anot-de="${i}"]`);
    if (el) saida.push({x: el.offsetLeft, y: el.offsetTop,
                        w: el.offsetWidth, h: el.offsetHeight});
  });
  return saida;
}

// A moldura que abraça uma lista de caixas, com a folga de sempre e o espaço da
// faixa do rótulo em cima.
function ofiMolduraEmVolta(membros) {
  if (!membros.length) return null;
  const x = Math.min(...membros.map(c => c.x)) - OFI_FOLGA_DO_GRUPO;
  const y = Math.min(...membros.map(c => c.y)) - OFI_FOLGA_DO_GRUPO - OFI_ALTURA_DO_ROTULO;
  const x2 = Math.max(...membros.map(c => c.x + c.w)) + OFI_FOLGA_DO_GRUPO;
  const y2 = Math.max(...membros.map(c => c.y + c.h)) + OFI_FOLGA_DO_GRUPO;
  return {x, y, w: x2 - x, h: y2 - y};
}

async function ofiMigrarGrupo(g, caixa) {
  if (ofiGruposMigrados.has(g.id)) return;
  ofiGruposMigrados.add(g.id);
  g.x = caixa.x; g.y = caixa.y; g.largura = caixa.w; g.altura = caixa.h;
  await window.pywebview.api.editar_grupo(currentProject, g.id,
    {x: caixa.x, y: caixa.y, largura: caixa.w, altura: caixa.h});
}

// A que grupo um nó pertence, pela POSIÇÃO dele — o modelo novo, pedido com o
// nome de "igual ao Obsidian". Solto dentro da caixa, entra; tirado, sai.
//
// ⚠️ QUEM DECIDE É O CENTRO DO NÓ, e não a sobreposição. Com sobreposição, um
// cartão que encosta a quina numa caixa já seria dela, e o usuário não teria
// como prever a partir de que pixel isso vira verdade. O centro é uma coisa só
// e ele consegue mirar.
//
// ⚠️ EMPATE VAI PARA A MENOR CAIXA. Com um grupo desenhado dentro de outro, a
// de fora contém tudo o que a de dentro contém: pela ordem da lista, o nó cairia
// no grupo grande e a caixa pequena ficaria eternamente vazia por baixo dele.
function ofiGrupoDaCaixa(caixaDoNo, caixasDosGrupos) {
  const cx = caixaDoNo.x + caixaDoNo.w / 2;
  const cy = caixaDoNo.y + caixaDoNo.h / 2;
  let escolhido = null, menor = Infinity;
  for (const id in caixasDosGrupos) {
    const c = caixasDosGrupos[id];
    if (cx < c.x || cx > c.x + c.w || cy < c.y || cy > c.y + c.h) continue;
    const area = c.w * c.h;
    if (area < menor) { menor = area; escolhido = id; }
  }
  return escolhido;
}

// As caixas dos grupos como estão GRAVADAS — sem passar pelo DOM. É o que
// permite decidir a filiação no meio de um arraste, quadro a quadro, sem
// forçar um recálculo de layout por grupo.
function ofiCaixasDosGrupos() {
  const saida = {};
  ofiGrupos.forEach(g => {
    if (Number.isFinite(g.largura) && Number.isFinite(g.altura)) {
      saida[g.id] = {x: g.x || 0, y: g.y || 0, w: g.largura, h: g.altura};
    }
  });
  return saida;
}

// As oito alças de redimensionar. Quatro bordas — que foi o pedido — e os
// quatro cantos, que ninguém pede e todo mundo tenta usar.
function ofiAlcasDoGrupo(id) {
  return ['n', 's', 'o', 'l', 'no', 'ne', 'so', 'se'].map(lado =>
    `<span class="ofi-grupo-alca ofi-grupo-alca-${lado}"
           data-alca-grupo="${escapeHtml(id)}" data-lado="${lado}"></span>`
  ).join('');
}

function ofiDesenharGrupos(caixas) {
  const camada = document.getElementById('ofi-grupos');
  if (!camada) return;
  const pecas = ofiGrupos.map(g => {
    // ⚠️ A CAIXA NÃO DEPENDE MAIS DE TER MEMBRO. Até 2026-09-03 um grupo com
    // menos de dois nós não desenhava nada, porque a moldura era a união deles.
    // Agora ela é o dado: uma caixa vazia é uma que o usuário desenhou e ainda
    // vai encher, e não desenhá-la seria fazer o trabalho dele sumir da tela.
    const caixa = ofiCaixaDoGrupo(g, caixas);
    if (!caixa) return '';
    if (!Number.isFinite(g.largura)) ofiMigrarGrupo(g, caixa);
    const x = caixa.x, y = caixa.y, x2 = caixa.x + caixa.w, y2 = caixa.y + caixa.h;
    // Só o RÓTULO e as ALÇAS recebem o ponteiro. A área da caixa fica
    // transparente ao clique porque ela cobre os nós: capturá-lo ali impediria
    // selecionar por arraste dentro do grupo e clicar na tela de um terminal
    // agrupado.
    //
    // ⚠️ O PONTO DE COR É IRMÃO DO RÓTULO, e não filho dele. O motivo original
    // era o rótulo virar editável no duplo clique — e um botão dentro de uma
    // área editável é apagado pela primeira tecla. Hoje quem edita é um campo
    // flutuante (`ofiRenomearGrupo`), mas a separação fica: um botão dentro do
    // alvo de arraste também rouba o gesto de arrastar o grupo.
    const cor = ofiCorCss(g.cor);
    const moldura = g.cor ? `border-color:${cor};` : '';
    const sel = ofiGrupoSel === g.id ? ' selecionado' : '';
    return `
      <div class="ofi-grupo${sel}" data-grupo-caixa="${escapeHtml(g.id)}"
           style="left:${x}px; top:${y}px; width:${x2 - x}px; height:${y2 - y}px; ${moldura}">
        ${ofiAlcasDoGrupo(g.id)}
        <div class="ofi-grupo-cab">
          <span class="ofi-ponto-cor ofi-grupo-cor" style="background:${cor}"
                data-cor-de-grupo="${escapeHtml(g.id)}"
                title="Clique para trocar a cor do grupo"></span>
          <button class="ofi-grupo-x" data-desagrupar="${escapeHtml(g.id)}"
                  title="Desfazer a caixa — os nós ficam onde estão">✕</button>
          <div class="ofi-grupo-rot" data-grupo="${escapeHtml(g.id)}"
               ${g.cor ? `style="color:${cor}"` : ''}
               title="Arraste para mover o grupo e tudo o que ele abraça; clique duplo para renomear">
            ${escapeHtml(g.rotulo || 'Grupo')}
          </div>
        </div>
      </div>`;
  });
  camada.innerHTML = pecas.join('');
  ofiLigarGrupos();
}

function ofiLigarGrupos() {
  // O ponto de cor do grupo abre a MESMA paleta do nó — é o mesmo gesto, e um
  // segundo seletor de cor no programa é um a mais.
  document.querySelectorAll('#ofi-grupos [data-cor-de-grupo]').forEach(ponto => {
    ponto.addEventListener('mousedown', e => e.stopPropagation());
    ponto.addEventListener('click', e => {
      e.stopPropagation();
      ofiAbrirPaleta(ponto, [ponto.dataset.corDeGrupo], 'grupo');
    });
  });

  document.querySelectorAll('#ofi-grupos [data-grupo]').forEach(rot => {
    rot.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      // ⚠️ O SEGUNDO CLIQUE NÃO COMEÇA ARRASTE NENHUM — é o que faz renomear
      // funcionar. O primeiro clique chamava `ofiDesenhar`, que refaz a camada
      // de grupos por `innerHTML`: o `dblclick` nunca chegava a disparar,
      // porque o elemento em que ele terminaria já tinha sido substituído.
      if (e.detail > 1) { e.stopPropagation(); return; }
      e.preventDefault();
      // ⚠️ `stopPropagation` É O QUE FAZ O ARRASTE DO GRUPO FUNCIONAR. Sem ele o
      // mesmo mousedown sobe até o canvas e começa TAMBÉM um retângulo de
      // seleção — que a cada movimento refaz a seleção pelo que o retângulo
      // toca, brigando com o arraste que acabou de começar. O sintoma é o
      // grupo "não arrastar", e a causa não aparece em lugar nenhum.
      e.stopPropagation();
      const grupo = ofiGrupos.find(g => g.id === rot.dataset.grupo);
      if (!grupo) return;
      // Selecionar acontece no MOUSEDOWN, e não no clique: é o mesmo desenho do
      // nó, e é o que faz a barra contextual aparecer tanto no clique seco
      // quanto no começo de um arraste.
      ofiGrupoSel = grupo.id;
      ofiSelecao.clear();
      ofiLigacaoSel = null;
      ofiDesenhar();
      // ⚠️ PEGAR O RÓTULO É PEGAR A CAIXA, e não mais os membros. Até
      // 2026-09-03 este gesto trocava a seleção pelos membros e caía no arraste
      // de vários nós — o que bastava enquanto a moldura era derivada deles.
      // Agora ela tem posição própria: movida por aquele caminho, a caixa
      // ficaria parada enquanto os cartões andavam por baixo.
      ofiIniciarArrasteDeGrupo(e, grupo);
    });
    // Dois cliques no rótulo renomeiam — ver `ofiRenomearGrupo`, logo abaixo,
    // para o porquê de o campo não ser o próprio rótulo.
    rot.addEventListener('dblclick', e => {
      e.stopPropagation();
      ofiRenomearGrupo(rot);
    });
  });

  // ⚠️ ESTE BOTÃO É A ÚNICA SAÍDA DE UM GRUPO VAZIO. Desde que a caixa virou o
  // dado, ela sobrevive sem membros — e "Desagrupar" da barra contextual só
  // aparece quando há nó SELECIONADO, que num grupo vazio não existe. Sem o ✕,
  // uma caixa esvaziada ficaria no canvas para sempre.
  document.querySelectorAll('#ofi-grupos [data-desagrupar]').forEach(btn => {
    btn.addEventListener('mousedown', e => e.stopPropagation());
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const r = await window.pywebview.api.desagrupar(currentProject,
                                                      [btn.dataset.desagrupar]);
      if (!r.success) { showToast(r.error, true); return; }
      showToast('Grupo desfeito.');
      ofiCarregar();
    });
  });

  document.querySelectorAll('#ofi-grupos [data-alca-grupo]').forEach(alca => {
    alca.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      // Mesmo motivo do rótulo: sem parar aqui, o mesmo mousedown sobe até o
      // canvas e começa também um retângulo de seleção, que briga com o arraste.
      e.stopPropagation();
      const grupo = ofiGrupos.find(g => g.id === alca.dataset.alcaGrupo);
      if (!grupo) return;
      ofiIniciarRedimensionarGrupo(e, grupo, alca.dataset.lado);
    });
  });
}

// ⚠️ O NOME DO GRUPO SE EDITA FORA DO MUNDO, e não no próprio rótulo. Três
// motivos, e cada um sozinho já bastaria:
//
//   1. TAMANHO. O rótulo tem 10,5px e vive dentro do `.ofi-mundo`, que leva
//      `transform: scale()`. Em 0,4× a letra vira 4px — ilegível para digitar,
//      e o cursor de texto do motor fica na mesma escala.
//   2. LARGURA. Ele é `flex: 1` numa faixa cuja largura é DERIVADA dos nós do
//      grupo, com `overflow: hidden` e `text-overflow: clip`. Num grupo estreito
//      o campo tem centímetros, e o que passa disso é cortado sem rolagem.
//   3. VIDA CURTA. A camada `#ofi-grupos` é refeita por `innerHTML` a cada
//      quadro de arraste (`ofiPedirFios`) e a cada `ofiDesenhar`. O campo era
//      destruído no meio da digitação, e o texto ia junto.
//
// O popover já resolve os três: ele mora no `body`, fora do `scale()`, ancorado
// por coordenada de TELA — está escrito assim no ⚠️ de `ofiAbrirPopover`. É o
// padrão do projeto para interface que precisa de tamanho real sobre o canvas,
// e é o mesmo que a paleta de cores usa.
function ofiRenomearGrupo(rot) {
  const grupo = ofiGrupos.find(g => g.id === rot.dataset.grupo);
  if (!grupo) return;
  const antes = grupo.rotulo || '';

  const pop = ofiAbrirPopover(rot, `
    <div class="ofi-popover-t">Nome do grupo</div>
    <input type="text" class="ofi-campo" id="ofi-grupo-nome"
           value="${escapeHtml(antes)}" maxlength="80" spellcheck="false">
    <div class="ofi-popover-nota">Enter grava, Esc cancela.</div>`);

  const campo = pop.querySelector('#ofi-grupo-nome');
  campo.focus();
  campo.select();

  let fechando = false;
  const gravar = async () => {
    if (fechando) return;
    fechando = true;
    const agora = campo.value.trim();
    ofiFecharPopover();
    if (!agora || agora === antes) return;
    const r = await window.pywebview.api.renomear_grupo(currentProject, grupo.id, agora);
    if (!r.success) { showToast(r.error, true); return; }
    ofiCarregar();
  };

  // ⚠️ `stopPropagation` no teclado: sem ele o Delete e o Ctrl+Z da Oficina
  // agem sobre a seleção enquanto se digita o nome.
  campo.addEventListener('keydown', ev => {
    ev.stopPropagation();
    if (ev.key === 'Enter') { ev.preventDefault(); gravar(); }
    if (ev.key === 'Escape') { ev.preventDefault(); fechando = true; ofiFecharPopover(); }
  });
  // Clicar fora fecha o popover (`ofiCliqueForaDoPopover`) — e fechar sem
  // passar por aqui descarta, que é o mesmo que Esc. Gravar em silêncio o que
  // ficou meio digitado seria pior que perder o gesto.
}

// ── A filiação por geometria ────────────────────────────────────────────────
//
// ⚠️ ELA É RECALCULADA NO FIM DE TODO GESTO QUE MEXE EM POSIÇÃO, e não só ao
// agrupar: é isso que faz "soltou dentro, entrou; tirou pra fora, saiu". Quem
// acrescentar um caminho novo de mover nó ou caixa e esquecer de chamá-la vai
// ver o nó desenhado dentro de uma moldura de que ele não é — e nada vai
// reclamar, porque as duas verdades passam a discordar em silêncio.
//
// Devolve `{ id do nó: id do grupo ou null }` SÓ do que mudou. Mandar o canvas
// inteiro a cada arraste faria a transação reescrever todo nó por um gesto que
// tocou em um.
function ofiFiliacaoNova(idsTocados, deslocamento) {
  const dx = (deslocamento && deslocamento.dx) || 0;
  const dy = (deslocamento && deslocamento.dy) || 0;
  const caixasDeNo = ofiCaixasDosNos();
  const caixasDeGrupo = ofiCaixasDosGrupos();
  const mudou = {};
  (idsTocados || []).forEach(id => {
    const no = ofiNos.find(n => n.id === id);
    const medida = caixasDeNo[id];
    if (!no || !medida) return;
    // A caixa de ONDE O NÓ VAI PARAR, e não de onde ele está: no fim de um
    // arraste o DOM ainda tem a posição antiga do modelo, e é o deslocamento
    // que diz para onde ele foi.
    const alvo = {x: no.x + dx, y: no.y + dy, w: medida.w, h: medida.h};
    const novo = ofiGrupoDaCaixa(alvo, caixasDeGrupo);
    if ((no.grupo || null) !== (novo || null)) mudou[id] = novo;
  });
  return Object.keys(mudou).length ? mudou : null;
}

// Todo nó cuja filiação é este grupo. Fonte: a lista gravada, que
// `_trab_refiliar` mantém de acordo com a geometria a cada gesto.
function ofiMembrosDoGrupo(id) {
  return ofiNos.filter(n => n.grupo === id).map(n => n.id);
}
