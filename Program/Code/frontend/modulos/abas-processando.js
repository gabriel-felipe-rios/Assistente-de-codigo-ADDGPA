// ═════════════════════════════════ O sinal de "tem coisa rodando aqui" ══
// Acende uma bolinha azul pulsante no canto da aba de cima enquanto há trabalho
// acontecendo dentro dela. Duas abas têm trabalho que demora: **Automação** (o
// ciclo de rotinas) e **Assistente** (o Chat respondendo, a Fila pesquisando ou
// o Designer desenhando).
//
// O problema que ele resolve: você dispara um ciclo, sai da aba, e não tem como
// saber se ainda está rodando sem voltar lá. Nada se perde ao sair — isso já
// estava certo, o ciclo roda em thread própria no backend — mas a tela não
// contava. Agora conta.
//
// ⚠️ ARQUIVO PRÓPRIO, e não um pedaço de `navegacao.js`: são **vários donos**
// (o chat, a trava de IA e o ciclo de rotinas) alimentando o mesmo componente. Mesma regra que
// pôs `quem-pode-ler.js` num arquivo só dele. Se morasse em `navegacao.js`, o
// chat teria que alcançar lá dentro para acender a marca dele.
//
// ⚠️ **A classe é `.processando`, separada de `.active`, e isso NÃO é gosto.**
// `bindProjectScreen` faz `classList.remove('active')` em todas as abas a cada
// troca, e `resetToFirstTab` repete o gesto. Reaproveitar `active` faria a marca
// sumir no primeiro clique em qualquer aba.
//
// Cor: azul, pela convenção que o programa já fixou (ver `agentes-automacao.css`)
// — **azul pulsando = acontecendo agora**, verde = terminou, roxo = na fila,
// âmbar = terminou faltando pedaço. Uma marca verde aqui diria "terminou", que é
// o contrário do que ela significa.
//
// Precisa rodar depois de `navegacao.js`.

// data-tab de cada aba que pode acender. ⚠️ São ids LEGADOS: a aba que o usuário
// lê como "Automação" continua sendo `tab-agentes` no HTML, porque só o rótulo
// mudou. Trocar por 'tab-automacao' aqui não acende nada e não dá erro nenhum.
const ABA_AUTOMACAO  = 'tab-agentes';
const ABA_ASSISTENTE = 'tab-assistente';

function _abaMarcar(dataTab, ligado, titulo) {
  const btn = document.querySelector(`.tab-btn[data-tab="${dataTab}"]`);
  if (!btn) return;
  btn.classList.toggle('processando', !!ligado);
  // O title é o que explica a bolinha para quem nunca a viu. Sem ele, a marca é
  // um enfeite azul que não diz de quê.
  if (ligado) {
    btn.title = titulo || (dataTab === ABA_ASSISTENTE
      ? 'o assistente está escrevendo a resposta'
      : 'tem rotina rodando ou na fila');
  } else {
    btn.removeAttribute('title');
  }
}

// ── Assistente: DOIS donos, e por isso um estado composto ───────────────────
// Dentro da aba Assistente moram três coisas que chamam o modelo: o **Chat**, a
// **Fila** e o **Designer**. Só o Chat acendia a bolinha, porque só ele tinha um
// sinal de graça na tela (`isStreaming`). As outras duas rodam em thread no
// backend, sem nada no frontend que mude quando começam — e era exatamente aí
// que a marca fazia falta, porque uma pesquisa da Fila ou uma rodada do Designer
// demoram muito mais que uma resposta do Chat.
//
// A resposta não é um poll novo: a `TRAVA_IA` do backend já sabe QUEM está
// usando o modelo, e `atualizarTravaIA` (trava-ia.js) já pergunta
// isso de 4 em 4 segundos para apagar botões. Ela agora entrega o mesmo estado
// aqui — é a mesma regra do `_abasDistribuir` logo abaixo: quem já foi ao
// backend reparte a resposta em vez de cada tela abrir o próprio poll.
//
// Os dois sinais são somados, não substituídos: o do Chat é instantâneo (acende
// no clique de Enviar, antes de a trava sequer ser tomada) e o da trava é o que
// enxerga Fila e Designer. Um sobrescrever o outro apagaria a bolinha do Chat na
// primeira volta do poll.
let _abaChatGerando = false;
let _abaTravaAssistente = null;   // {quem, motivo} quando o dono mora nesta aba

// Os donos da `TRAVA_IA` que ficam DENTRO da aba Assistente. `rotinas` e
// `backup` estão de fora de propósito: rotinas tem a bolinha da Automação, e o
// backup não mora em aba nenhuma que valha acender.
const ABA_ASSISTENTE_DONOS = ['chat', 'fila', 'designer'];

function _abaAplicarAssistente() {
  const ligado = _abaChatGerando || !!_abaTravaAssistente;
  // O motivo vem da trava quando ela sabe de quem é ("a Fila está pesquisando",
  // "o Designer está desenhando") — é o mesmo texto que os botões travados
  // mostram, e a bolinha não pode dizer outra coisa que a tela.
  const titulo = _abaTravaAssistente ? _abaTravaAssistente.motivo : null;
  _abaMarcar(ABA_ASSISTENTE, ligado, titulo);
}

// `isStreaming` já existe como global e é escrito em quatro lugares (envio,
// fim da resposta, aborto, troca de projeto). A marca acende e apaga junto.
function marcarAssistenteGerando(ligado) {
  _abaChatGerando = !!ligado;
  _abaAplicarAssistente();
}

// Chamada por `atualizarTravaIA` com o estado que ela já buscou (ou `null`).
function marcarAssistenteTrava(estado) {
  _abaTravaAssistente =
    (estado && ABA_ASSISTENTE_DONOS.includes(estado.quem)) ? estado : null;
  _abaAplicarAssistente();
}

// ── Automação: precisa perguntar ───────────────────────────────────────────
// ⚠️ Por que um poll NOVO, com três já existindo: os três (`rotinas.js`,
// `pendencias.js`, `visualizar-acionamentos.js`) só rodam com a sub-aba deles na
// frente — ou seja, todos param exatamente na situação em que esta marca é
// necessária, que é o usuário estar em OUTRA aba. E `processando.py` não empurra
// nada para o frontend, por decisão registrada no docstring dele.
//
// `get_processando` lê estado em memória, não varre disco: é barato, e é a mesma
// chamada e a mesma cadência que os outros três já faziam.
let _abasPoll = null;

async function _abasConferirAutomacao() {
  if (!currentProject) { _abaMarcar(ABA_AUTOMACAO, false); return; }
  // Captura ANTES do await: com múltiplos projetos abertos, o usuário pode
  // trocar de aba enquanto esta chamada está em voo (a resposta de uma rotina
  // pesada demora). Sem isto, a resposta do projeto ANTIGO pinta em cima da
  // tela do projeto NOVO — era exatamente o "dados de um projeto misturados
  // no outro" que apareceu em Rotinas e Visualizar.
  const projetoDaPergunta = currentProject;
  let r;
  try {
    r = await window.pywebview.api.get_processando(projetoDaPergunta);
  } catch (e) {
    return;  // projeto pode ainda não estar carregado; a próxima passada tenta
  }
  if (projetoDaPergunta !== currentProject) return;  // trocou de aba durante o await
  if (!r || !r.success) return;
  // Rodando **ou** na fila. A fila conta: uma rotina esperando a vez ainda é
  // trabalho que vai acontecer nesta aba, e apagar a marca entre uma rotina e a
  // seguinte faria a bolinha piscar ao longo do ciclo inteiro.
  const vivos = (r.processando || []).length + (r.esperando || []).length;
  _abaMarcar(ABA_AUTOMACAO, vivos > 0);
  _abasDistribuir(r);
}

// ── A entrega ───────────────────────────────────────────────────────────────
// ⚠️ Três telas de Automação mostram exatamente este mesmo estado, e cada uma
// tinha o PRÓPRIO poll de 2 s perguntando a mesma coisa. Com o poll desta aba
// somando-se a eles, seriam duas perguntas idênticas ao backend a cada 2 s
// sempre que uma dessas sub-abas estivesse aberta.
//
// Então os três polls saíram e a resposta é entregue: já está na mão, é a mesma
// cadência, e é a mesma resposta. Cada tela continua decidindo o que fazer com
// ela — aqui só se decide QUEM recebe.
//
// A checagem de visibilidade é de cada tela (`_rotinasSubAbaVisivel` e as duas
// irmãs), porque cada uma sabe qual é a sub-aba dela. E ela olha as DUAS alturas
// de navegação: a marca `active` de uma sub-aba não é limpa ao sair para outra
// aba de cima, então "minha sub-aba está ativa" não significa "estou visível".
//
// `typeof` em tudo: este arquivo carrega logo depois de `navegacao.js`, antes
// dos módulos das rotinas. Na prática o poll só roda dentro de um projeto, com
// tudo já carregado — mas uma tela que ainda não existe não pode derrubar as
// outras duas.
function _abasDistribuir(r) {
  const entregar = (visivel, consumidor) => {
    try {
      if (typeof visivel === 'function' && visivel() &&
          typeof consumidor === 'function') consumidor(r);
    } catch (e) { /* uma tela que falha não pode calar as outras */ }
  };
  entregar(typeof _rotinasSubAbaVisivel !== 'undefined' ? _rotinasSubAbaVisivel : null,
           typeof _rotinasEstadoVivo    !== 'undefined' ? _rotinasEstadoVivo    : null);
  entregar(typeof _pendSubAbaVisivel    !== 'undefined' ? _pendSubAbaVisivel    : null,
           typeof pendRefresh           !== 'undefined' ? pendRefresh           : null);
  entregar(typeof _visSubAbaVisivel     !== 'undefined' ? _visSubAbaVisivel     : null,
           typeof _visPollDaSubAba      !== 'undefined' ? _visPollDaSubAba      : null);
}

function iniciarSinalDasAbas() {
  pararSinalDasAbas();
  _abasConferirAutomacao();          // não espera os 2 s da primeira passada
  _abasPoll = setInterval(_abasConferirAutomacao, 2000);
}

function pararSinalDasAbas() {
  if (_abasPoll) clearInterval(_abasPoll);
  _abasPoll = null;
  _abaMarcar(ABA_AUTOMACAO, false);
  // Os dois sinais do Assistente zeram juntos — deixar um deles ligado faria a
  // bolinha reacender sozinha na primeira volta do poll do projeto seguinte.
  _abaChatGerando = false;
  _abaTravaAssistente = null;
  _abaMarcar(ABA_ASSISTENTE, false);
}
