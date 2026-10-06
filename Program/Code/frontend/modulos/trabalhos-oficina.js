// ═══ TRABALHOS → sub-aba Oficina ═══════════════════════════════════════════
//
// O canvas livre onde os terminais moram. Substituiu o que seria uma sub-aba
// "Terminais" com grade fixa.
//
// ⚠️ SEM GRADE E SEM TETO, e as duas coisas são decisão, não descuido. A grade
// de quadrantes existia e foi descartada: com 3 ou 4 terminais a fonte ficava
// ilegível, e é o zoom que resolve isso, não uma divisão fixa da tela. O teto
// de quantidade também caiu — o custo real de cada terminal é o freio, não uma
// regra do programa.
//
// ⚠️ O FUNDO QUADRICULADO É DECORATIVO. Ele sinaliza "aqui a posição é livre";
// não existe encaixe, não existe alinhamento automático, e um nó pode ficar
// entre duas linhas. Quem implementar snap depois estará desfazendo isto.
//
// ⚠️ NÃO EXISTE NÓ DE NAVEGADOR na barra de ferramentas, e a ausência é
// deliberada — não foi pedido com convicção, e fica fora até fazer falta.
//
// ⚠️ AS LIGAÇÕES NÃO SÃO DESENHO. Uma linha entre dois nós muda o que acontece
// com os processos deles — segura um disparo, passa um arquivo, reinicia o
// outro lado. O efeito mora em `backend/modulos/trabalhos_conexoes.py`; aqui é
// só a representação dele. Quem acrescentar um quinto tipo que só desenha
// estará desfazendo a decisão que criou os quatro.
//
// ⚠️ O TRAÇO NÃO ESCALA COM O ZOOM, e é regra do projeto: num desenho que
// amplia, o traço de 1 px vira 10 px no zoom 10× e a linha engole o que ela
// deveria só apontar. O `vector-effect: non-scaling-stroke` que resolve isso em
// SVG NÃO vale aqui, porque quem amplia é uma CSS transform num ancestral HTML
// (`.ofi-mundo`), e não o SVG. A saída é a mesma do `--bm-k` do mapa de
// Backups: o zoom vira variável CSS e a espessura se divide por ela.
//
// ⚠️ AGRUPAR NÃO AFETA EXECUÇÃO NENHUMA. Um grupo é uma caixa com rótulo em
// volta de alguns nós — não cria ligação, não cria dependência, não faz um nó
// esperar pelo outro. Grupo e ligação são conceitos independentes, e um nó pode
// estar num grupo sem ter ligação nenhuma com os vizinhos dele.
//
// ── Este arquivo era 3.061 linhas, e virou nove ─────────────────────────────
//
// Pelo teto de 500 da AMF, que é obrigatório. O corte segue a regra que já
// dividiu os Backups, o Inspetor e o `arquivos.py`: **cada arquivo responde uma
// pergunta diferente**, e não "um pedaço de cima, um pedaço de baixo".
//
//   trabalhos-oficina.js            o estado, a montagem e o desenho geral
//   trabalhos-oficina-nos.js        que forma cada nó tem (e as anotações)
//   trabalhos-oficina-fios.js       a geometria das ligações
//   trabalhos-oficina-grupos.js     a caixa de grupo e a filiação
//   trabalhos-oficina-palco.js      o gesto que começa no fundo: zoom, pan, seleção
//   trabalhos-oficina-arraste.js    o gesto que começa em cima: mover e esticar
//   trabalhos-oficina-acoes.js      mexer no CONJUNTO: criar, ligar, agrupar, excluir
//   trabalhos-oficina-edicao.js     mexer no CONTEÚDO de um: renomear, nota, pega
//   trabalhos-oficina-popovers.js   a caixinha ancorada, e os três que a usam
//
// ⚠️ SÃO SCRIPTS CLÁSSICOS, NÃO MÓDULOS, e é isso que faz a divisão ser barata:
// as funções e os `let` do topo continuam sendo globais compartilhados, e uma
// função de um arquivo chama a de outro exatamente como chamava antes. Não há
// `import`, não há `export`, e não pode haver — o `index.html` carrega os nove
// com `<script src>`, na ordem em que estão listados acima.
//
// ⚠️ O ESTADO MORA TODO AQUI, e é de propósito. `ofiNos`, `ofiSelecao`,
// `ofiZoom`, `ofiPan` e as constantes `OFI_*` ficam neste arquivo; os outros
// oito leem e escrevem neles. Um `let` migrado para o arquivo que mais o usa
// viraria a segunda pergunta "onde é que se declara isso mesmo?" — e a resposta
// hoje é uma só.

let ofiNos = [];
let ofiGrupos = [];
let ofiLigacoes = [];
// O catálogo dos tipos chega do backend a cada carga. NUNCA é escrito aqui:
// uma segunda lista no JS é como as duas divergem sem ninguém notar.
let ofiTiposDeLigacao = [];
let ofiSelecao = new Set();
let ofiZoom = 1;
let ofiPan = { x: 0, y: 0 };
// ⚠️ ELA VALE PARA O VIGIA, e não para o arraste em si — quem move o nó usa
// estado local, em closure. Esta aqui existe só para o temporizador das
// anotações saber que NÃO pode redesenhar agora: `ofiCarregar` no meio de um
// arraste refaz o `innerHTML` e o nó pula da mão do usuário.
let ofiArraste = null;
let ofiRetangulo = null;
let ofiMontada = false;
// O quadro pedido durante um arraste, para não redesenhar os fios duas vezes
// no mesmo quadro de animação.
let ofiFiosPedidos = null;
// Qual anotação está escolhida na combo box de cada nó: `{ id do nó: nome do
// arquivo }`. ⚠️ VARIÁVEL DE MÓDULO, e não campo do nó: o nó é estado de
// DISCO, e escolher qual anotação olhar não é coisa que se grave. Mesmo desenho
// de `trAtividadeAberta`, no Quadro.
let ofiAnotacaoEscolhida = {};

// O último carimbo das anotações que a tela viu, já em texto para comparar de
// uma vez. Nasce em `ofiCarregar`, da MESMA resposta que pintou o canvas.
let ofiCarimboDasAnotacoes = null;
let ofiVigiaDasAnotacoes = null;

// ⚠️ A FAIXA É LARGA DE PROPÓSITO. Começou em 0,35–2×, e isso dá pouco
// menos de três passos para cada lado: quem tem oito terminais espalhados não
// consegue afastar o bastante para ver todos, e quem quer ler o log de um não
// consegue chegar perto o bastante. 0,15–4× cobre as duas pontas.
const OFI_ZOOM_MIN = 0.15;
const OFI_ZOOM_MAX = 4;
// ⚠️ O PASSO É UM FATOR, E NÃO UMA SOMA — pelo mesmo motivo que o tamanho da
// letra do nó de texto. Somar 0,1 vale 6,7% quando se está em 1,5× e vale 66%
// quando se está em 0,15×: perto, o zoom mal se mexia; longe, ele pulava. Um
// fator rende igual em toda a faixa.
const OFI_ZOOM_PASSO = 1.18;
const OFI_LIMIAR_ARRASTE = 4;

// ⚠️ AS TRÊS DECLARAÇÕES ABAIXO FALTAVAM, e a falta NÃO dava erro de sintaxe.
// Ler uma variável não declarada lança `ReferenceError` em tempo de EXECUÇÃO:
// o arquivo carrega inteiro, e o gesto que passa por ali simplesmente não
// acontece — sem console, sem aviso. Foi assim que o Delete parou de apagar
// (`ofiLigacaoSel`, lido dentro do ouvinte de teclado) e que arrastar a pega de
// um nó de TEXTO parou de mudar a letra (`ofiFonteDe` estourava nos dois tetos).
//
// Quem mexer aqui: `node globais.js <arquivo>` acha esse tipo de buraco. O
// `node --check` NÃO acha — a sintaxe está perfeita nos três casos.

// O espaço está apertado? É o que troca o arraste no vazio de "selecionar" para
// "arrastar o canvas".
let ofiEspacoApertado = false;

// O fio selecionado, quando há um. É estado separado de `ofiSelecao` porque
// Delete num fio apaga a LIGAÇÃO, e num nó apaga o nÓ — duas perguntas
// diferentes na mesma tecla.
let ofiLigacaoSel = null;

// A TERCEIRA seleção do canvas, ao lado de `ofiSelecao` (nós) e `ofiLigacaoSel`
// (fio). ⚠️ AS TRÊS NUNCA COEXISTEM: escolher uma limpa as outras duas, senão a
// barra contextual teria de decidir sobre quem age e o Delete apagaria a coisa
// errada. O grupo entrou nesta lista quando a caixa virou o dado — antes ela
// era só um contorno derivado, e não havia o que selecionar.
let ofiGrupoSel = null;

// Os limites do corpo da letra de um nó de texto, em px. Abaixo do mínimo o
// texto deixa de ser legível no zoom de longe; acima do máximo um nó só cobre
// o canvas inteiro e não dá mais para achar a pega para diminuir de volta.
const OFI_FONTE_MIN = 10;
// 240, e não 96: o pedido foi poder crescer mais. O teto existe só para o nó
// não virar uma letra do tamanho do canvas, em que a pega para diminuir de
// volta fica fora da tela.
const OFI_FONTE_MAX = 240;
// Tamanho da ponta de seta, em pixels DE TELA. Como o traço, ela se divide
// pelo zoom para não crescer junto com o desenho.
//
// ⚠️ 14, E NÃO 9. Com 9 a ponta era um cisco: numa tela cheia de fios não dava
// para dizer de longe para que lado a seta apontava, que é a única informação
// que ela existe para dar. Foi relato do usuário — "a cabecinha dela tá muito
// pequena". Encolher isto de volta desfaz a leitura do sentido.
const OFI_SETA = 14;

// ── Montagem ────────────────────────────────────────────────────────────────

async function initOficina() {
  const painel = document.getElementById('trsub-oficina');
  if (!painel || !currentProject) return;
  if (!ofiMontada) {
    ofiMontada = true;
    painel.innerHTML = ofiMarcacao();
    ofiLigarEventos();
    // ⚠️ DENTRO DA GUARDA DE MONTAGEM, e não fora. `initOficina` roda a CADA
    // entrada na sub-aba; um `setInterval` criado fora daqui daria um
    // temporizador por visita, todos vivos ao mesmo tempo e nenhum com dono.
    ofiVigiarAnotacoes();
  }
  xtPintarEncaixeDaOficina();
  await ofiCarregar();
}

// Ponto de encaixe `oficina.painel` (fase 11). O `top` acompanha a barra: ela
// quebra linha quando a janela estreita, e o ponto não pode ficar por baixo.
function xtPintarEncaixeDaOficina() {
  const alvo = document.getElementById('ofi-encaixe');
  if (!alvo || typeof xtEncaixe !== 'function') return;
  xtEncaixe('oficina.painel', alvo,
    { projeto: (typeof currentProject !== 'undefined' && currentProject) || null });
  const barra = alvo.parentElement && alvo.parentElement.querySelector(':scope > .ofi-barra');
  if (barra && barra.offsetHeight) alvo.style.top = `${barra.offsetTop + barra.offsetHeight + 8}px`;
}

// ── O vigia das anotações ───────────────────────────────────────
//
// O agente grava a anotação e ninguém avisa a tela — nenhuma tela de Trabalhos
// recarrega sozinha. Sem isto, o nó de anotações só aparece quando o usuário
// mexe em alguma coisa, e ele não tem como saber que precisa mexer.
//
// ⚠️ O QUE ELE PEDE É O CARIMBO, e não o canvas: `carimbo_das_anotacoes` conta
// arquivo e olha data, sem abrir nenhum. `ofiCarregar` só acontece quando o
// carimbo MUDA — senão isto seria um laço de leitura rodando a vida toda.
const OFI_INTERVALO_DO_VIGIA = 4000;

function ofiVigiarAnotacoes() {
  if (ofiVigiaDasAnotacoes) return;
  ofiVigiaDasAnotacoes = setInterval(ofiVerificarAnotacoes, OFI_INTERVALO_DO_VIGIA);
}

async function ofiVerificarAnotacoes() {
  // ⚠️ AS QUATRO GUARDAS, E NENHUMA É OPCIONAL.

  // 1. Só com a Oficina à vista. A classe é `active`, em inglês — mesmo teste
  //    de `ofiLigarTeclado`. Um vigia que sobrevive à troca de aba fica pedindo
  //    carimbo para sempre, num projeto que o usuário nem está olhando.
  const painel = document.getElementById('trsub-oficina');
  if (!painel || !painel.classList.contains('active')) return;
  if (!currentProject) return;

  // 2. Nunca durante um arraste: `ofiCarregar` redesenha, e redesenhar no meio
  //    do gesto faz o nó pular da mão.
  if (ofiArraste) return;

  // 3. Nunca com algo em edição. É A PIOR FALHA POSSÍVEL DESTA OBRA: o redesenho
  //    troca o `innerHTML` dos nós e levaria junto o `<textarea>` da nota com o
  //    que o usuário está digitando dentro, ou o nome que ele está renomeando no
  //    lugar. Não há variável de módulo para isso — a marca é o próprio DOM.
  if (document.querySelector('#ofi-nos textarea, #ofi-nos .ofi-editando')) return;

  let r;
  try {
    r = await window.pywebview.api.carimbo_das_anotacoes(currentProject);
  } catch (e) {
    // Um vigia que grita não é um conforto. Se a ponte falhou, o próximo tique
    // tenta de novo, e o usuário continua com a tela que já tinha.
    return;
  }
  if (!r || !r.success) return;
  const agora = JSON.stringify(r.carimbo || {});
  if (agora === ofiCarimboDasAnotacoes) return;
  // 4. O intervalo é de SEGUNDOS, lá em cima: o agente escreve e o usuário não
  //    está cronometrando. `ofiCarregar` guarda o carimbo novo por dentro.
  ofiCarregar();
}

function ofiMarcacao() {
  return `
    <div class="ofi-cabecalho">
      <div>
        <h2>Oficina</h2>
        <div class="tr-sub">Terminais de verdade, num canvas livre — o papel só é fixo quando o nó nasce de um cartão do Quadro</div>
      </div>
      <div class="tr-cab-botoes">
        <button class="btn btn-negative btn-sm" id="ofi-parar-tudo"
                title="Para todos os processos e reabre os papéis travados">Parar tudo</button>
      </div>
    </div>

    <div class="ofi-faixa">
      <b>Papel só é fixo quando o terminal nasce de um cartão do Quadro.</b>
      Nós que você adiciona por aqui não têm papel nenhum — nome e cor são seus, e mudam quando quiser.
    </div>

    <div class="ofi-palco" id="ofi-palco">
      <div class="ofi-barra" data-taborder-group="oficina_barra"
           data-taborder-label="Barra da Oficina" data-taborder-parent="ofi-palco">
        <button class="btn btn-primary btn-xs" id="ofi-novo-terminal">＋ Terminal</button>
        <button class="btn btn-muted btn-xs" id="ofi-nova-nota">＋ Nota</button>
        <button class="btn btn-muted btn-xs" id="ofi-novo-texto">＋ Texto</button>
        <span class="ofi-sep"></span>
        <button class="btn btn-muted btn-xs" id="ofi-zoom-menos" title="Diminuir">−</button>
        <span class="ofi-zoom-n" id="ofi-zoom-n">100%</span>
        <button class="btn btn-muted btn-xs" id="ofi-zoom-mais" title="Aumentar">+</button>
        <button class="btn btn-muted btn-xs" id="ofi-enquadrar"
                title="Faz tudo caber na tela (ou clique com o botão do meio)">⤢ Enquadrar</button>
        <span class="ofi-sep"></span>
        <button class="btn btn-muted btn-xs" id="ofi-fluxos"
                title="Guardar este arranjo, ou aplicar um já guardado">💾 Fluxos salvos</button>
        <button class="btn btn-muted btn-xs" id="ofi-bloqueios" title="Ver a lista de bloqueio">🔒 Bloqueios</button>
      </div>

      <!-- Ponto de encaixe \`oficina.painel\` (fase 11): flutua logo abaixo da
           barra, FORA do \`.ofi-mundo\` (não dá zoom nem pan) e fora do
           \`.ofi-canvas\` (o arraste do palco não o captura). -->
      <div id="ofi-encaixe" class="xt-ponto"></div>

      <div class="ofi-barra-ctx hidden" id="ofi-barra-ctx">
        <span id="ofi-ctx-quantos"></span>
        <button class="btn btn-muted btn-xs" id="ofi-ctx-editar">Editar</button>
        <button class="btn btn-muted btn-xs" id="ofi-ctx-colorir">🎨 Colorir</button>
        <button class="btn btn-muted btn-xs" id="ofi-ctx-agrupar">▣ Agrupar</button>
        <button class="btn btn-muted btn-xs" id="ofi-ctx-desagrupar">Desagrupar</button>
        <button class="btn btn-muted btn-xs" id="ofi-ctx-conectar">🔗 Conectar</button>
        <button class="btn btn-muted btn-xs" id="ofi-ctx-desconectar">Desconectar</button>
        <button class="btn btn-muted btn-xs" id="ofi-ctx-duplicar">⧉ Duplicar</button>
        <button class="btn btn-negative btn-xs" id="ofi-ctx-excluir">Excluir</button>
      </div>

      <div class="ofi-canvas" id="ofi-canvas">
        <div class="ofi-mundo" id="ofi-mundo">
          <!-- Os fios vêm ANTES dos nós no DOM porque, na mesma pilha, quem vem
               depois pinta por cima: a linha passa por baixo do terminal, e não
               atravessando o log dele. -->
          <!-- A ordem das três camadas É a ordem de empilhamento: grupo por
               baixo de tudo (ele é a caixa DESENHADA EM VOLTA dos nós), o fio no
               meio, e o nó por cima — a linha passa por baixo do terminal, e não
               atravessando a tela dele. -->
          <div class="ofi-grupos" id="ofi-grupos"></div>
          <svg class="ofi-fios" id="ofi-fios"></svg>
          <div class="ofi-nos" id="ofi-nos"></div>
        </div>
        <div class="ofi-retangulo hidden" id="ofi-retangulo"></div>
      </div>
    </div>`;
}

// ── Carregar e desenhar ─────────────────────────────────────────────────────

async function ofiCarregar() {
  const r = await window.pywebview.api.carregar_oficina(currentProject);
  if (!r.success) { showToast(r.error, true); return; }
  ofiNos = r.nos || [];
  ofiLigacoes = r.ligacoes || [];
  // ⚠️ SEM ESTA LINHA NENHUM GRUPO APARECE, e não há erro em lugar nenhum. O
  // backend grava certo e `carregar_oficina` DEVOLVE `grupos`; era o frontend
  // que jogava a lista fora. `ofiGrupos` nascia `[]` e morria `[]`, então
  // `ofiDesenharGrupos` mapeava sobre vazio e escrevia `innerHTML = ''`. O
  // usuário via o aviso de "Agrupado" e nenhuma caixa no canvas.
  ofiGrupos = r.grupos || [];
  ofiTiposDeLigacao = r.tipos_de_ligacao || [];
  // O carimbo vem desta mesma resposta, e não de uma chamada própria: assim o
  // que o vigia guarda como "já vi isto" descreve exatamente o que foi pintado.
  ofiCarimboDasAnotacoes = JSON.stringify(r.carimbo || {});
  // Seleção de nó que não existe mais (excluído por outra via) não sobrevive.
  ofiSelecao = new Set([...ofiSelecao].filter(id => ofiNos.some(n => n.id === id)));
  ofiDesenhar();
}

function ofiDesenhar() {
  const mundo = document.getElementById('ofi-mundo');
  if (!mundo) return;
  ofiAplicarTransformacao();
  // ⚠️ OS NÓS DE ANOTAÇÕES VÊM DEPOIS, E FORA DE `ofiNos`. Eles são derivados
  // da pasta do agente, não do `Layout.json` — ver o comentado de
  // `ofiNoDeAnotacoes`. Entram na mesma camada porque pendem de um nó e andam
  // com ele; entrar em `ofiNos` os tornaria arrastáveis e excluiveis.
  document.getElementById('ofi-nos').innerHTML =
    ofiNos.map(ofiDesenharNo).join('') + ofiNos.map(ofiNoDeAnotacoes).join('');
  document.getElementById('ofi-zoom-n').textContent = Math.round(ofiZoom * 100) + '%';
  ofiAtualizarBarraContextual();

  // ⚠️ O `innerHTML` ACIMA APAGA TODO OUVINTE DOS NÓS, e por isso cada
  // religação tem de estar AQUI, e não em `ofiLigarEventos`. Aquele roda uma vez
  // só, na montagem; este roda a cada redesenho — e são onze os lugares que
  // redesenham. Uma fiação esquecida aqui não dá erro: o gesto simplesmente
  // deixa de existir, e o defeito parece "o programa não faz mais isso".
  //
  // Foi exatamente o que aconteceu: sem `ofiLigarPegas` nesta lista, o canto de
  // redimensionar virou desenho; sem `ofiLigarEdicao`, o duplo clique parou de
  // editar; sem `ofiLigarAlcas`, as bolinhas de ligar não puxavam fio; e sem
  // `ofiLigarShells`, o terminal desenhava a moldura e nunca montava o xterm.
  ofiLigarNos();
  ofiLigarPegas();
  ofiLigarAlcas();
  ofiLigarEdicao();
  ofiLigarPontosDeCor();
  ofiLigarAnotacoes();

  const caixas = ofiCaixasDosNos();
  ofiDesenharFios(caixas);
  // ⚠️ SEM `ofiLigarGrupos()` AQUI. `ofiDesenharGrupos` já o chama no fim dele
  // — é ele quem sabe quando a camada foi refeita, e o `ofiPedirFios` do
  // arraste chama só o desenhar. Ligando também daqui, cada rótulo ficava com
  // DOIS `mousedown` e dois `dblclick`: o arraste do grupo começava duas vezes,
  // e `stopPropagation` não ajuda contra o segundo ouvinte do mesmo elemento.
  ofiDesenharGrupos(caixas);

  // O terminal é do arquivo vizinho, e é ele quem devolve o `host` do xterm
  // para dentro do encaixe vazio que `ofiDesenharNo` acabou de emitir.
  if (typeof ofiLigarShells === 'function') ofiLigarShells();
}
