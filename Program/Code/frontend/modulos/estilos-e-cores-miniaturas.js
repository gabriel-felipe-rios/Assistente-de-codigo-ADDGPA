// ═══════════════════════════ ESTILOS E CORES: miniaturas por demanda ══
//
// Cartão de texto não serve para escolher aparência: "Sépia de leitura — paleta
// clara e quente" não diz se a cor serve. Cada dimensão ganha a sua miniatura —
// wireframe para estilo, faixa de cores para paleta, amostra do material para
// textura, espécime para tipografia, o movimento rodando para animação.
//
// ⚠️ POR DEMANDA, sempre. Montar os 18 iframes de estilo mais os 20 de animação
// de uma vez congela a janela ao abrir a aba. O iframe só nasce quando o card
// entra na viewport, e o conteúdo já veio na listagem — nenhuma ida extra à
// ponte pywebview.

// ⚠️ O observador é UM SÓ e vive para sempre. Ele já foi destruído e recriado a
// cada remontagem de lista, e isso quebrou o Designer: `renderTodasAsDimensoes`
// monta as cinco dimensões em sequência, cada uma derrubando o observador da
// anterior — só a última saía com observador vivo, e Estilos e Cores ficavam em
// branco para sempre, sem nenhum erro no console.
const _ecObservadorDeMiniaturas = new IntersectionObserver((entradas, observador) => {
  for (const entrada of entradas) {
    if (!entrada.isIntersecting) continue;
    observador.unobserve(entrada.target);
    ecPintarMiniatura(entrada.target);
  }
}, { rootMargin: '200px' });

// A lista é remontada a cada troca de pílula e a cada ação. Sem soltar, o
// observador continua segurando elementos que saíram do DOM.
//
// A `raiz` delimita a limpeza: solta SÓ as caixas daquela lista, e deixa intactas
// as das outras telas montadas ao mesmo tempo — no Designer as cinco dimensões
// convivem, e as quatro que não estão sendo remontadas continuam esperando a vez
// de aparecer. Sem raiz vale o documento inteiro.
//
// ⚠️ NÃO é `disconnect()`. O observador é único e permanente: quem só quis limpar a
// própria lista não pode desligar o de todo mundo.
function ecSoltarMiniaturas(raiz) {
  (raiz || document).querySelectorAll('.ec-mini')
    .forEach(caixa => _ecObservadorDeMiniaturas.unobserve(caixa));
}

// `paletaCss` é um `<style>` com a paleta escolhida, e é o que faz a miniatura do
// Designer sair TINGIDA em vez de ignorar a cor. Na biblioteca global ele não é
// passado, e a miniatura sai com a paleta de reserva do próprio arquivo.
//
// ⚠️ Ele entra DEPOIS do conteúdo, nunca antes. O arquivo do item traz o próprio
// `:root` de reserva, e as duas regras têm a mesma especificidade — quem vem por
// último vence. Injetado antes, o `:root` do arquivo ganhava e a paleta escolhida
// nunca valia: era por isso que tudo saía roxo, inclusive com "Terminal fósforo"
// escolhido.
function ecAgendarMiniatura(caixa, dimensao, item, paletaCss) {
  caixa._ecDimensao = dimensao;
  caixa._ecItem = item;
  caixa._ecPaleta = paletaCss || '';
  _ecObservadorDeMiniaturas.observe(caixa);
}

function ecPintarMiniatura(caixa) {
  const dimensao = caixa._ecDimensao;
  const item = caixa._ecItem;
  if (!dimensao || !item) return;
  try {
    if (dimensao === 'estilos' || dimensao === 'animacoes') ecMiniaturaEmQuadro(caixa, item);
    else if (dimensao === 'cores') ecMiniaturaDePaleta(caixa, item);
    else if (dimensao === 'texturas') ecMiniaturaDeTextura(caixa, item);
    else if (dimensao === 'tipografia') ecMiniaturaDeTipografia(caixa, item);
  } catch (e) {
    caixa.classList.add('ec-mini-falhou');
    caixa.textContent = 'sem prévia';
  }
}

// O HTML do item renderizado de verdade, encolhido. `srcdoc` por propriedade e
// não por atributo: o conteúdo tem aspas dos dois tipos e escapá-lo à mão é o
// caminho mais curto para uma miniatura em branco.
function ecMiniaturaEmQuadro(caixa, item) {
  const quadro = document.createElement('iframe');
  quadro.className = 'ec-mini-quadro';
  quadro.setAttribute('scrolling', 'no');
  quadro.setAttribute('tabindex', '-1');
  quadro.setAttribute('aria-hidden', 'true');
  quadro.srcdoc = (item.conteudo || '') + (caixa._ecPaleta || '');
  caixa.innerHTML = '';
  caixa.appendChild(quadro);
}

function ecMiniaturaDePaleta(caixa, item) {
  const dados = JSON.parse(item.conteudo);
  const cores = Object.values(dados.cores || {})
    .filter(c => c && c.hex)
    .map(c => c.hex);
  caixa.innerHTML = '';
  const faixa = document.createElement('div');
  faixa.className = 'ec-mini-faixa';
  for (const hex of cores) {
    const risco = document.createElement('i');
    // Cor de dado, não de identidade visual: o valor vem do arquivo que o
    // usuário está escolhendo, então não há token para ele (mesma exceção já
    // registrada para o espectro da aba Aparência).
    risco.style.background = hex;
    faixa.appendChild(risco);
  }
  caixa.appendChild(faixa);
}

function ecMiniaturaDeTextura(caixa, item) {
  const dados = JSON.parse(item.conteudo);
  caixa.innerHTML = '';
  const amostra = document.createElement('div');
  amostra.className = 'ec-mini-material';
  // O `css` do item são declarações prontas; aplicá-las é justamente o que faz o
  // material aparecer em vez de virar mais um retângulo cinza.
  amostra.style.cssText = dados.css || '';
  caixa.appendChild(amostra);
}

function ecMiniaturaDeTipografia(caixa, item) {
  const dados = JSON.parse(item.conteudo);
  const tipografia = dados.tipografia || {};
  const familias = tipografia.familias || {};
  const pesos = tipografia.pesos || {};
  caixa.innerHTML = '';
  const especime = document.createElement('div');
  especime.className = 'ec-mini-especime';
  especime.textContent = 'Aa';
  if (familias.titulo) especime.style.fontFamily = familias.titulo;
  if (pesos.titulo) especime.style.fontWeight = pesos.titulo;
  caixa.appendChild(especime);
}
