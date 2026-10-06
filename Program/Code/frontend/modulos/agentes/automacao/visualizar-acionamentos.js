// ═══════════════════════════════════════ AGENTES: VISUALIZAR ACIONAMENTOS ══
//
// ── Este arquivo era 604 linhas, e virou três ─────────────────────────────
//
// Pelo teto de 500 da AMF. Cada um responde uma pergunta:
//
//   visualizar-acionamentos.js             a cadeia, o desenho e a chave
//   visualizar-acionamentos-estados.js     os sete estados de um agente
//   visualizar-acionamentos-sincronia.js   reconciliar com o que está rodando
//
// São scripts clássicos, não módulos: as funções e os `let` do topo continuam
// globais, e o `index.html` carrega os três na ordem acima.
//
// ⚠️ O ESTADO É POR PROJETO (`_visPorProjeto`/`_visBalde`), e o balde mora aqui.
// Só recurso visual: mostra qual rotina está rodando e para quem ela passa a
// bola. Não configura nada — para ligar e desligar, a sub-aba Acionamentos.
//
// Onde cada caixa fica é assunto de `visualizar-acionamentos-desenho.js`; aqui
// se sabe o que está acontecendo com cada uma.
//
// A tela é alimentada pelos mesmos eventos que já existem:
//   acionamentosEsperaStatus({status, agent})  → quem está rodando agora
//   acionamentosAgentDone({agent, finished_at}) → quem acabou
//
// O estado vive em `_visPorProjeto`, e não no DOM. É o que permite três coisas
// que antes não funcionavam: um evento que chega com a sub-aba fechada não se
// perde, redesenhar (ao filtrar) não apaga o que já se sabia, e — com abas de
// projeto — o que aconteceu numa aba que não estava na frente continua lá
// quando o usuário volta nela.
//
// ⚠️ POR PROJETO, E ISSO NÃO É DETALHE. Antes eram quatro globais soltos
// (`_visEstados`, `_visAcionou`, `_visVivos`, `_visDados`) sem nenhuma noção de
// projeto. Com dois projetos abertos, o id da rotina ('doc-tecnica', 'pipeline'…) é
// o MESMO nos dois, então o ciclo de um pintava o desenho do outro; e
// `visualizarResetar()`, chamado a cada `enterProject`, zerava o desenho do
// projeto que estava rodando. Era o "a representação de um está sendo montada
// em cima da outra" e o "voltei no que estava gerando e estava tudo parado".

let _visCadeia    = null;    // get_dependencias_acionamentos — igual em todo projeto
let _visSoLigados = false;
let _visChipWired = false;

// projeto → { estados, acionou, vivos, dados }
//   estados — agentId → { estado, texto, dica }
//   acionou — quem já passou a bola neste ciclo
//   vivos   — quem está rodando/esperando agora (ver `_visEstadoVivo`)
//   dados   — { ordem, requisitos, settings }; `settings` é por projeto
const _visPorProjeto = {};

function _visBalde(projeto) {
  const p = projeto || currentProject;
  if (!p) return null;
  if (!_visPorProjeto[p]) {
    _visPorProjeto[p] = { estados: {}, acionou: new Set(), vivos: new Set(), dados: null, fases: {} };
  }
  return _visPorProjeto[p];
}

// Fechar a aba de um projeto joga fora o que se sabia dele. Chamado por
// `fecharAbaDeProjeto` (projetos-abertos.js) — sem isto o mapa cresceria para
// sempre e reabrir o projeto traria de volta o desenho de uma sessão anterior.
function visualizarEsquecerProjeto(nome) {
  delete _visPorProjeto[nome];
}

// Chamado toda vez que a sub-aba abre — e não só na primeira. Antes havia uma
// trava de "já montei" que pulava a sincronização, e por isso ligar uma rotina
// em Acionamentos e voltar para cá não tirava o apagado dela.
async function initVisualizarAcionamentosTab() {
  _visWireChip();
  await _visCarregar();
}

async function _visCarregar() {
  // O nome vem ANTES de qualquer `await`, e é reconferido depois de cada um:
  // trocar de aba de projeto no meio de uma chamada em voo fazia a resposta do
  // projeto antigo desenhar em cima da tela do novo. Mesmo padrão de
  // `_abasConferirAutomacao` (abas-processando.js).
  const proj = currentProject;
  let buscado;
  try {
    if (!_visCadeia) {
      const g = await window.pywebview.api.get_dependencias_acionamentos();
      if (!g || !g.success) return;
      _visCadeia = g;
    }
    // ⚠️ AS QUATRO DE UMA VEZ. Eram quatro idas SEQUENCIAIS à ponte
    // (acionamentos → espera → processando → últimas rodadas), uma esperando a
    // anterior por nada: nenhuma delas depende do resultado das outras. Somadas
    // davam o atraso visível ao trocar de aba de projeto com esta sub-aba
    // aberta — a tela ficava com o desenho do projeto anterior nesse meio-tempo.
    //
    // O que DEPENDE de ordem é a PINTURA, não a busca, e ela continua igual:
    // `_visSincronizar` aplica o estado vivo antes dos desfechos do disco. Ver
    // o aviso lá dentro.
    const [r, espera, processando, desfechos] = await Promise.all([
      window.pywebview.api.get_acionamentos(proj),
      window.pywebview.api.get_espera_status(proj),
      window.pywebview.api.get_processando(proj),
      window.pywebview.api.get_agent_last_runs(proj),
    ]);
    if (proj !== currentProject) return;
    const balde = _visBalde(proj);
    if (!balde) return;
    balde.dados = {
      ordem:      _visCadeia.ordem,
      requisitos: _visCadeia.requisitos,
      settings:   (r && r.success && r.settings) ? r.settings : {},
      // Os segundos de silêncio de cada grupo, no rótulo da caixa dele.
      debounces:    (espera && espera.success && espera.debounces) || {},
      esperaLigada: espera && espera.success ? espera.espera_ligada : undefined,
    };
    buscado = { espera, processando, desfechos };
  } catch (e) { return; /* projeto ainda não carregado */ }

  _visDesenhar();
  await _visSincronizar(buscado);
}

// Redesenha do zero e repõe por cima tudo que já se sabia. É o caminho tanto da
// abertura da sub-aba quanto do filtro "Só os ligados".
//
// ⚠️ Desenha SEMPRE o projeto exibido. Os outros projetos abertos continuam
// acumulando estado no balde deles, sem tocar no DOM — é o que faz voltar numa
// aba mostrar o que aconteceu enquanto ela estava atrás.
function _visDesenhar() {
  const balde = _visBalde();
  if (!balde || !balde.dados) return;
  // A montagem já mede e desenha as setas (e reacende as que estavam acesas).
  _visMontarDesenho(balde.dados, _visSoLigados);
  _visMarcarDesligados();
  balde.acionou.forEach(id => _visIluminar(id));
  Object.keys(balde.estados).forEach(id => _visPintar(id));
  // D7: a fase de quem está rodando volta junto — redesenhar não a apaga.
  Object.keys(balde.fases || {}).forEach(id => _visPintarFase(id));
  _visResumoLigados();
  // A espera de cada grupo, na Situação — com o que já se sabe; o
  // `get_espera_status` fresco chega logo depois, por `_visSincronizar`.
  if (balde.espera) _visResumoGrupos(balde.espera);
}

function _visWireChip() {
  if (_visChipWired) return;
  const chip = document.getElementById('vis-chip-ligados');
  if (!chip) return;
  _visChipWired = true;
  chip.addEventListener('click', () => {
    _visSoLigados = !_visSoLigados;
    chip.classList.toggle('ativo', _visSoLigados);
    _visDesenhar();
  });
}

// ── A chave: ligada ou desligada ───────────────────────────────────────────
//
// São DOIS eixos independentes, e a tela mostra os dois ao mesmo tempo:
//
//   · a CHAVE   — vai rodar? → contorno sólido ou tracejado
//   · o ESTADO  — o que aconteceu na última passagem? → ponto e selo
//
// Uma rotina desligada que já rodou continua verde e "Concluído": o que ela
// gerou está lá, ela só não vai rodar de novo. Espremer as duas coisas num selo
// só escondia metade da informação.
//
// Sem transparência em nenhum dos dois. O apagado antigo (`opacity: 0.42`)
// escondia doze das catorze caixas no estado normal — como o backend zera os
// acionamentos a cada abertura de projeto, era esse o estado normal — e passava
// por "faltam agentes aqui".
function _visMarcarDesligados() {
  const dados    = (_visBalde() || {}).dados;
  const settings = (dados && dados.settings) || {};
  const ordem    = (dados && dados.ordem) || [];
  const ligada   = id => !!settings[id] && settings[id] !== 'off';

  // A BASE — Detector, Hashes e Sincronia — não tem chave na sub-aba
  // Acionamentos: as três rodam sempre que houver ALGUMA rotina ligada, e é
  // isso que o contorno delas mostra. Antes o Hashes era isentado da regra e
  // aparecia sólido com tudo desligado em volta, o que lia como contradição;
  // agora as três seguem a mesma regra, que é a verdadeira.
  const algumaLigada = ordem.some(id => !VIS_BASE.includes(id) && ligada(id));
  // ⚠️ O REVEZAMENTO NUNCA É TRACEJADO, e não é exceção gratuita: o tracejado
  // significa "esta chave está desligada, ela não vai rodar", e ele não tem
  // chave nenhuma — a janela do LM Studio é uma só, e não há o que escolher.
  // Ele também não segue a base: a base é tracejada quando nada está ligado
  // (porque aí ela de fato não roda), enquanto o Revezamento continua valendo
  // mesmo com todas as rotinas desligadas — o Chat e a Fila usam a mesma janela.
  const off = id => (id === 'revezamento' ? false
                   : VIS_BASE.includes(id) ? !algumaLigada : !ligada(id));

  document.querySelectorAll('#vis-desenho .vis-no').forEach(no => {
    no.classList.toggle('off', off(no.dataset.agente));
  });
  // A seta é apagada quando o que ela alimenta está desligado. O destino pode
  // ser um card, uma subcaixa (apagada só se TODOS os cards dela estão) ou uma
  // caixa de grupo — esta nunca: o grupo não tem chave.
  const destinoOff = para => {
    const el = document.getElementById('vis-x-' + para);
    if (!el) return false;
    if (el.classList.contains('vis-no')) return off(para);
    if (el.classList.contains('vis-sub')) {
      const cards = [...el.querySelectorAll('.vis-no')];
      return cards.length > 0 && cards.every(c => off(c.dataset.agente));
    }
    return false;
  };
  document.querySelectorAll('#vis-desenho .vis-liga').forEach(liga => {
    const apagada = destinoOff(liga.dataset.para);
    liga.classList.toggle('off', apagada);
    if (apagada) liga.setAttribute('marker-end', 'url(#vis-pt-off)');
  });
}

