// ══════════════════════════════ ABA: APARÊNCIA — O SELETOR DE COR ══
// Uma fileira de matizes na ordem do espectro, os três neutros embaixo, e três
// controles: MATIZ, SATURAÇÃO e LUMINÂNCIA.
//
// O que havia antes eram três fileiras de quadradinhos sem rótulo — 42 no total.
// A primeira era o matiz, a segunda mudava sozinha quando a primeira era clicada
// (e nada dizia isso), e a terceira era só de cinzas. Escolher um verde escuro
// exigia clicar no verde, notar a fileira do meio mudar, e só então achar o tom.
//
// Agora a fileira é a ESCALA (vermelho → violeta, a mesma ordem do trilho do
// Matiz), e as variações que ela não mostra viram os três controles. O quadrado
// é o atalho grosso; os controles são o ajuste fino. Os dois fazem a mesma
// coisa, em granularidades diferentes.
//
// ⚠️ Os três controles são de HSL — é o espaço em que se DESENHA uma cor. Não
// confundir com a régua de `aparencia_cor.py`, que é CIELAB e serve para
// COMPARAR duas cores. São perguntas diferentes: "que cor eu quero?" e "essas
// duas são a mesma?".

const APARENCIA_PASSOS_ESCALA = 20;
// ⚠️ A volta INTEIRA, e não os 300° do espectro visível. O corte em 300 deixava
// o trecho magenta de fora, e é lá que mora a família ROSA (`#EC4899` está em
// 330°): colar um rosa no campo grudava o controle em 300° e a cor mostrada
// deixava de ser a pedida. O passo é 360/20, então o último quadrado é 342° e
// nenhum repete o vermelho de 0°.
const APARENCIA_MATIZ_MAXIMO = 360;
const APARENCIA_SATURACAO_PADRAO = 68;
const APARENCIA_LUMINANCIA_PADRAO = 50;

// Preto, cinza e branco não têm matiz nem saturação — só luminância. Ficam numa
// fileira própria porque não são posições da escala, e não mudam com ela.
const APARENCIA_NEUTROS = [
  { nome: 'Preto', luminancia: 10 },
  { nome: 'Cinza', luminancia: 55 },
  { nome: 'Branco', luminancia: 96 },
];

let _aparenciaMatiz = 130;
let _aparenciaSaturacao = APARENCIA_SATURACAO_PADRAO;
let _aparenciaLuminancia = 45;
let _aparenciaNeutro = false;

// ── Conversões ──────────────────────────────────────────────────────────────
function aparenciaHslParaHex(matiz, saturacao, luminancia) {
  const s = saturacao / 100;
  const l = luminancia / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((matiz / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (matiz < 60)       [r, g, b] = [c, x, 0];
  else if (matiz < 120) [r, g, b] = [x, c, 0];
  else if (matiz < 180) [r, g, b] = [0, c, x];
  else if (matiz < 240) [r, g, b] = [0, x, c];
  else if (matiz < 300) [r, g, b] = [x, 0, c];
  else                  [r, g, b] = [c, 0, x];
  const doisDigitos = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return ('#' + doisDigitos(r) + doisDigitos(g) + doisDigitos(b)).toUpperCase();
}

function aparenciaHexParaHsl(hex) {
  const casou = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(hex || '').trim());
  if (!casou) return null;
  let bruto = casou[1];
  if (bruto.length === 3) bruto = bruto.split('').map(c => c + c).join('');
  const r = parseInt(bruto.slice(0, 2), 16) / 255;
  const g = parseInt(bruto.slice(2, 4), 16) / 255;
  const b = parseInt(bruto.slice(4, 6), 16) / 255;
  const maior = Math.max(r, g, b), menor = Math.min(r, g, b);
  const l = (maior + menor) / 2;
  let h = 0, s = 0;
  if (maior !== menor) {
    const d = maior - menor;
    s = d / (1 - Math.abs(2 * l - 1));
    if (maior === r)      h = 60 * (((g - b) / d) % 6);
    else if (maior === g) h = 60 * ((b - r) / d + 2);
    else                  h = 60 * ((r - g) / d + 4);
  }
  return { matiz: (h + 360) % 360, saturacao: s * 100, luminancia: l * 100 };
}

function aparenciaCorEscolhida() {
  return _aparenciaNeutro
    ? aparenciaHslParaHex(0, 0, _aparenciaLuminancia)
    : aparenciaHslParaHex(_aparenciaMatiz, _aparenciaSaturacao, _aparenciaLuminancia);
}

// ── Montagem ────────────────────────────────────────────────────────────────
function aparenciaMontarSeletorDeCor() {
  const escala = document.getElementById('aparencia-escala');
  escala.innerHTML = '';
  for (let passo = 0; passo < APARENCIA_PASSOS_ESCALA; passo++) {
    const matiz = passo * APARENCIA_MATIZ_MAXIMO / APARENCIA_PASSOS_ESCALA;
    const amostra = document.createElement('span');
    amostra.className = 'aparencia-amostra';
    amostra.style.background = aparenciaHslParaHex(
      matiz, APARENCIA_SATURACAO_PADRAO, APARENCIA_LUMINANCIA_PADRAO);
    amostra.dataset.matiz = String(matiz);
    amostra.title = Math.round(matiz) + '°';
    amostra.addEventListener('click', () => aparenciaEscolherMatiz(matiz));
    escala.appendChild(amostra);
  }

  const neutros = document.getElementById('aparencia-neutros');
  neutros.innerHTML = '<span class="aparencia-neutros-rotulo">neutros</span>';
  APARENCIA_NEUTROS.forEach(neutro => {
    const amostra = document.createElement('span');
    amostra.className = 'aparencia-amostra';
    amostra.style.background = aparenciaHslParaHex(0, 0, neutro.luminancia);
    amostra.dataset.neutro = String(neutro.luminancia);
    amostra.title = neutro.nome;
    amostra.addEventListener('click', () => aparenciaEscolherNeutro(neutro.luminancia));
    neutros.appendChild(amostra);
  });

  ['matiz', 'saturacao', 'luminancia'].forEach(qual => {
    const campo = document.getElementById('aparencia-' + qual);
    campo.addEventListener('input', () => {
      if (qual === 'matiz') _aparenciaMatiz = parseFloat(campo.value);
      else if (qual === 'saturacao') _aparenciaSaturacao = parseFloat(campo.value);
      else _aparenciaLuminancia = parseFloat(campo.value);
      // Mexer no matiz ou na saturação tira do modo neutro: os dois só fazem
      // sentido numa cor que tem matiz.
      if (qual !== 'luminancia') _aparenciaNeutro = false;
      aparenciaPintarSeletor();
      aparenciaEscreverCampoDeCor();
    });
    campo.addEventListener('change', () => aparenciaBuscar());
  });

  aparenciaSincronizarComCampo();
  aparenciaPintarSeletor();
}

function aparenciaEscolherMatiz(matiz) {
  _aparenciaMatiz = matiz;
  _aparenciaNeutro = false;
  // Vindo da escala, saturação e luminância voltam ao ponto de partida da
  // fileira: o quadrado clicado é exatamente a cor que se vê nele.
  _aparenciaSaturacao = APARENCIA_SATURACAO_PADRAO;
  _aparenciaLuminancia = APARENCIA_LUMINANCIA_PADRAO;
  aparenciaAplicarSeletor();
}

function aparenciaEscolherNeutro(luminancia) {
  _aparenciaNeutro = true;
  _aparenciaSaturacao = 0;
  _aparenciaLuminancia = luminancia;
  aparenciaAplicarSeletor();
}

function aparenciaAplicarSeletor() {
  aparenciaPintarSeletor();
  aparenciaEscreverCampoDeCor();
  aparenciaLimparFiltros();
  aparenciaBuscar();
}

function aparenciaEscreverCampoDeCor() {
  document.getElementById('aparencia-cor').value = aparenciaCorEscolhida();
}

// Lê o campo hexadecimal de volta para os três controles. É o que faz colar uma
// cor no campo mover os sliders, em vez de deixá-los mentindo.
function aparenciaSincronizarComCampo() {
  const escrito = document.getElementById('aparencia-cor').value;
  const hsl = aparenciaHexParaHsl(escrito);
  if (!hsl) return;
  _aparenciaSaturacao = Math.round(hsl.saturacao);
  _aparenciaLuminancia = Math.round(hsl.luminancia);
  _aparenciaNeutro = _aparenciaSaturacao < 4;
  if (!_aparenciaNeutro) {
    _aparenciaMatiz = Math.round(hsl.matiz) % APARENCIA_MATIZ_MAXIMO;
  }
  // O chip mostra o que foi ESCRITO, e não o que os controles reconstroem: eles
  // guardam inteiros, e a volta pelo arredondamento erra um ou dois pontos por
  // canal. A busca usa o campo, então o chip tem de concordar com ele.
  aparenciaPintarSeletor(escrito.trim().toUpperCase());
}

// ── Pintura ─────────────────────────────────────────────────────────────────
function aparenciaTrilhoDeMatiz(saturacao, luminancia) {
  const paradas = [];
  for (let p = 0; p <= 12; p++) {
    paradas.push(aparenciaHslParaHex(p * 360 / 12, saturacao, luminancia));
  }
  return 'linear-gradient(to right,' + paradas.join(',') + ')';
}

function aparenciaPintarSeletor(corExata) {
  const cor = aparenciaCorEscolhida();
  document.getElementById('aparencia-chip-cor').style.background = corExata || cor;
  const matiz = _aparenciaMatiz;
  const sat = _aparenciaNeutro ? APARENCIA_SATURACAO_PADRAO : _aparenciaSaturacao;
  const lum = _aparenciaLuminancia;

  // Os trilhos são pintados NO estado em vigor: dá para ver onde se vai chegar
  // antes de arrastar, em vez de arrastar às cegas e conferir depois.
  aparenciaAjustarControle('matiz', matiz, Math.round(matiz) + '°',
    aparenciaTrilhoDeMatiz(sat, lum), cor, _aparenciaNeutro);
  aparenciaAjustarControle('saturacao', _aparenciaSaturacao, Math.round(_aparenciaSaturacao) + '%',
    'linear-gradient(to right,' + aparenciaHslParaHex(matiz, 0, lum) + ','
      + aparenciaHslParaHex(matiz, 100, lum) + ')', cor, _aparenciaNeutro);
  aparenciaAjustarControle('luminancia', _aparenciaLuminancia, Math.round(_aparenciaLuminancia) + '%',
    'linear-gradient(to right,' + aparenciaHslParaHex(matiz, sat, 0) + ','
      + aparenciaHslParaHex(matiz, sat, 50) + ',' + aparenciaHslParaHex(matiz, sat, 100) + ')',
    cor, false);

  // A amostra marcada é a da escala mais próxima do matiz em vigor — arrastar o
  // controle acende o quadrado vizinho, e a fileira nunca desmente o slider.
  const passo = APARENCIA_MATIZ_MAXIMO / APARENCIA_PASSOS_ESCALA;
  // O arredondamento dá a volta: 350° fica mais perto do quadrado de 0° que do
  // de 342°, e é o de 0° que deve acender.
  const perto = _aparenciaNeutro
    ? -1 : (Math.round(matiz / passo) * passo) % APARENCIA_MATIZ_MAXIMO;
  document.querySelectorAll('#aparencia-escala .aparencia-amostra').forEach(amostra => {
    amostra.classList.toggle('active',
      !_aparenciaNeutro && Math.abs(parseFloat(amostra.dataset.matiz) - perto) < 0.01);
  });
  document.querySelectorAll('#aparencia-neutros .aparencia-amostra').forEach(amostra => {
    amostra.classList.toggle('active',
      _aparenciaNeutro && Math.abs(parseFloat(amostra.dataset.neutro) - _aparenciaLuminancia) < 0.01);
  });
}

function aparenciaAjustarControle(qual, valor, rotulo, trilho, cor, desligado) {
  const campo = document.getElementById('aparencia-' + qual);
  const caixa = document.getElementById('aparencia-controle-' + qual);
  campo.value = valor;
  document.getElementById('aparencia-' + qual + '-valor').textContent = desligado ? '—' : rotulo;
  caixa.classList.toggle('desligado', !!desligado);
  campo.disabled = !!desligado;
  // O trilho vive num elemento próprio porque `input[type=range]` não aceita
  // gradiente no fundo de forma portátil entre os motores.
  caixa.querySelector('.aparencia-trilho').style.background =
    desligado ? 'rgba(255,255,255,0.10)' : trilho;
  campo.style.setProperty('--pino', cor);
}
