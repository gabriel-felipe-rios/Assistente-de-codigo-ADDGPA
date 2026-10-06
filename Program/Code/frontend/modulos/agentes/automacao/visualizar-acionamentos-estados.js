// ══ AUTOMAÇÃO → Visualizar: os sete estados de um agente no desenho ═══════
//
// ⚠️ SÃO SETE, E CADA UM DIZ UMA COISA DIFERENTE: `run` (rodando agora),
// `esperando` (na vez de outro), `bloqueado` (requisito não cumprido), `done`,
// `parcial`, `erro`, `dispensado`. Fundir `bloqueado` com `esperando` — que é a
// tentação — apaga justamente a informação útil: um está parado por ordem de
// execução, o outro por falta de insumo, e a ação do usuário é diferente.
//
// ⚠️ O ESTADO É POR PROJETO. Com vários abertos, cada um tem o próprio balde
// (`_visBalde`, na casca) — um estado global faria o desenho de um projeto
// piscar com o que está acontecendo no outro.
//
// ⚠️ `visualizarResetar` NÃO É "LIMPAR A TELA": é voltar ao retrato de repouso.
// Ele repõe os desfechos conhecidos, senão um ciclo terminado apareceria como
// se nunca tivesse rodado.
// ── Estados ────────────────────────────────────────────────────────────────

// Os oito estados que uma caixa pode ter. Lista única: `_visPintar` limpa por
// ela antes de aplicar o novo, e esquecer um nome aqui deixaria duas classes
// somadas na mesma caixa (a antiga nunca sairia).
const VIS_ESTADOS = ['run', 'esperando', 'bloqueado', 'done', 'parcial', 'erro', 'dispensado'];

// ⚠️ `projeto` é o DONO do estado, e não necessariamente o projeto na tela.
// Um evento de uma aba que não está na frente grava aqui e não pinta nada; é
// justamente o que faz voltar naquela aba mostrar o que aconteceu. Sem
// argumento, é o projeto exibido — que é o caso de toda chamada interna.
function _visSetEstado(agentId, estado, texto, dica, projeto) {
  const p = projeto || currentProject;
  const balde = _visBalde(p);
  if (!balde) return;
  balde.estados[agentId] = { estado, texto, dica };
  if (p === currentProject) _visPintar(agentId);
}

function _visPintar(agentId) {
  const balde = _visBalde();
  const e = balde && balde.estados[agentId];
  if (!e) return;
  document.querySelectorAll(`#vis-desenho .vis-no[data-agente="${agentId}"]`).forEach(no => {
    no.classList.remove(...VIS_ESTADOS);
    const dot = no.querySelector('.vis-dot');
    dot.classList.remove(...VIS_ESTADOS);
    if (e.estado) {
      no.classList.add(e.estado);
      dot.classList.add(e.estado);
    }
    no.querySelector('.vis-no-badge').textContent = e.texto;
    if (e.dica) no.title = e.dica;
  });
}

// Acende as setas que saem deste agente — é o que mostra qual etapa acionou qual.
function _visIluminar(agentId) {
  document.querySelectorAll(`#vis-desenho .vis-liga[data-de="${agentId}"]`).forEach(liga => {
    if (liga.classList.contains('off')) return;
    liga.classList.add('lit');
    liga.setAttribute('marker-end', 'url(#vis-pt-lit)');
  });
}

function _visDispararBola(agentId) {
  _visIluminar(agentId);
  document.querySelectorAll(`#vis-desenho .vis-bola[data-de="${agentId}"] animateMotion`)
    .forEach(mov => { try { mov.beginElement(); } catch (e) { /* sem SMIL */ } });
}

function visualizarAgenteRodando(agentId, projeto) {
  _visSetEstado(agentId, 'run', 'Processando', undefined, projeto);
}

// D7, D12: a fase de quem está em andamento, em linhas pequenas embaixo do
// nome do card — `[{texto, tentativa}]`, montadas por
// `_linhasDaFaseNoVisualizar` (rotinas-comum.js). Azul é andamento; âmbar
// (`tentativa`) é retentativa. Lista vazia apaga.
//
// ⚠️ NÃO MEXE NO ESTADO NEM NO SELO. Quem diz «Processando» ou «Concluído»
// continua sendo `_visSetEstado`; a fase é uma camada à parte, guardada no
// balde do projeto para redesenhar não apagá-la.
function visualizarAgenteFase(agentId, linhas, projeto) {
  const p = projeto || currentProject;
  const balde = _visBalde(p);
  if (!balde) return;
  balde.fases = balde.fases || {};
  balde.fases[agentId] = linhas || [];
  if (p === currentProject) _visPintarFase(agentId);
}

function _visPintarFase(agentId) {
  const balde = _visBalde();
  const linhas = (balde && balde.fases && balde.fases[agentId]) || [];
  document.querySelectorAll(`#vis-desenho .vis-no[data-agente="${agentId}"] .vis-no-txt`)
    .forEach(txt => {
      txt.querySelectorAll('.vis-no-fase').forEach(el => el.remove());
      linhas.forEach(l => {
        const el = document.createElement('span');
        el.className = 'vis-no-fase' + (l.tentativa ? ' tentativa' : '');
        el.textContent = l.texto;
        txt.appendChild(el);
      });
    });
}

// "Concluído" é um estado que persiste — não um flash — igual a legenda da aba
// Acionamentos promete. Só sai daí quando o mesmo agente volta a rodar ou quando
// o usuário limpa os dados gerados.
// `desfecho` = `{erros, falhou}`, quando se sabe. Sem ele o selo continua
// sendo o "Concluído" verde de sempre — é o caminho do evento ao vivo, que
// chega antes de o `_resumo.json` existir.
// ⚠️ NÃO É "Parado" NEM "Erro", e é por isso que ele precisou de estado próprio.
//
// A rotina não rodou, mas nada deu errado — na maior parte das vezes é o ciclo
// funcionando: o Detector olhou o que mudou e concluiu que aquela rotina não
// tinha o que fazer. Sem um estado para isso, o nó ficava com o selo roxo
// "Esperando" da rodada anterior (ou voltava a "Parado" no `visualizarOcioso`),
// e quem olhava o diagrama não tinha como saber se o programa pulou de
// propósito ou se alguma coisa travou.
//
// Duas causas, dois textos — ver `_ac_notify_agent_pulado` no backend:
//   · dispensada — o Detector não pediu. Desfecho normal.
//   · pulada     — um pré-requisito não terminou; fica para a próxima volta.
//
// ⚠️ NÃO entra no `acionou` do balde e NÃO dispara a bolinha: a animação conta uma
// passagem de trabalho pelo desenho, e aqui não passou trabalho nenhum.
function visualizarAgenteDispensado(agentId, motivo, requisitoId, dispensado, projeto) {
  const dica = dispensado
    ? (motivo || 'o Detector não pediu esta rotina')
    : (motivo || `${(typeof AC_NOMES_AGENTES !== 'undefined'
                     && AC_NOMES_AGENTES[requisitoId]) || requisitoId} `
                 + 'não terminou neste ciclo');
  _visSetEstado(agentId, 'dispensado', dispensado ? 'Dispensada' : 'Pulada', dica, projeto);
}

function visualizarAgenteConcluido(agentId, semAnimacao, desfecho, projeto) {
  const p = projeto || currentProject;
  const erros = (desfecho && desfecho.erros) || 0;
  if (desfecho && desfecho.falhou) {
    // O motivo vem do evento de fim (`acionamentosAgentDone`); do disco
    // (`_visReporDesfechos`) ele não vem, e cai no texto de sempre.
    _visSetEstado(agentId, 'erro', 'Erro',
                  (desfecho.motivo || 'terminou sem gerar nada — veja a sub-aba Erros'), p);
  } else if (erros) {
    _visSetEstado(agentId, 'parcial', `${erros} erro${erros !== 1 ? 's' : ''}`,
                  'terminou, mas nem tudo saiu — veja a sub-aba Erros', p);
  } else {
    _visSetEstado(agentId, 'done', 'Concluído', undefined, p);
  }
  const balde = _visBalde(p);
  if (balde) balde.acionou.add(agentId);
  // A seta acesa e a bolinha correndo são DOM: só para o projeto na tela. O
  // `acionou` acima é que guarda a informação para quando a aba voltar — e
  // `_visDesenhar` reacende as setas por ele.
  if (p !== currentProject) return;
  if (semAnimacao) _visIluminar(agentId); else _visDispararBola(agentId);
}

// A Espera não "processa e conclui" como as outras — ela segura. Usa o estado
// `run` (azul pulsando) como "segurando". Se a chave dela está desligada, quem
// diz isso é o contorno tracejado, como em qualquer outra caixa; o selo
// continua sendo o estado.
// O selo é de uma palavra só, como o de todos os outros — os três tempos que
// vêm no `texto` iriam para muito além da largura da caixa. Eles ficam na
// dica, ao passar o mouse.
// ⚠️ "Sem freio" só vale com o Detector DE PÉ. Sem vigilância nenhuma, dizer
// "sem freio" sugere que o programa está disparando ciclo atrás de ciclo,
// quando ele não está fazendo nada — e é esse o estado normal de um projeto
// recém-aberto, porque a abertura zera todos os acionamentos.
//
// ⚠️ ELA NÃO SABE MAIS DA TRAVA DO LM STUDIO, e essa é a mudança de 28/08/2026.
// A Espera acumulava duas funções que não têm nada a ver uma com a outra —
// segurar enquanto o código muda (a dela) e segurar enquanto a janela do LM
// Studio está ocupada (a do Revezamento). Isso quebrava justamente onde mais
// importava: a Espera TEM CHAVE, e desligá-la com dois projetos abertos
// escondia o "esperando outro projeto" junto — o usuário ficava sem nenhuma
// pista de por que nada estava acontecendo. Quem responde por aquilo agora é
// `visualizarRevezamentoEstado`, logo abaixo, numa caixa que não se desliga.
function visualizarEsperaEstado(ativo, texto, vigiando, projeto) {
  const p = projeto || currentProject;
  const dados    = (_visBalde(p) || {}).dados;
  const settings = (dados && dados.settings) || {};
  const semFreio = !settings.espera || settings.espera === 'off';
  // O selo do card. A Situação não repete a palavra: a espera virou uma linha
  // por grupo (`_visResumoGrupos`), com a contagem de cada um.
  const palavra = ativo ? 'Segurando' : (vigiando && semFreio ? 'Sem freio' : 'Parada');
  _visSetEstado('espera', ativo ? 'run' : null, palavra, `Espera — ${texto}`, p);
}

// O REVEZAMENTO: a janela do LM Studio é uma só, e quem chega depois espera.
//
// `travada` é a frase pronta do backend ("esperando o Chat responder"), e
// `bloqueadoPor` é o projeto que está com a janela na mão, quando se sabe.
//
// Três leituras, e elas não se misturam:
//   · nada             → `Livre`, sem cor. Ninguém está segurando nada.
//   · travada, aqui    → `Na fila` (roxo). É outra tarefa DESTE projeto — o
//                        Chat, a Fila, o Designer. Fila de sempre.
//   · travada, lá      → `Outro projeto` (índigo). É outra ABA de projeto.
//
// ⚠️ O SELO É CURTO e o nome do projeto NÃO entra nele. A caixa do nó tem
// largura fixa (`.vis-no`, no CSS) e o selo é `nowrap` + `margin-left: auto`:
// `Aguardando "<projeto>"` saía para fora do cartão, por cima do desenho. O
// nome fica na dica e na faixa de resumo, que é onde ele cabe.
function visualizarRevezamentoEstado(travada, bloqueadoPor, projeto) {
  const p = projeto || currentProject;
  if (!travada) {
    _visSetEstado('revezamento', null, 'Livre',
                  'Revezamento — a janela do LM Studio está livre para este projeto', p);
    if (p === currentProject) _visResumoVez('Livre');
    return;
  }
  // De OUTRA aba de projeto tem estado e cor próprios ('bloqueado', índigo);
  // travada por outra tarefa desta mesma aba continua sendo a fila de sempre.
  const deOutraAba = bloqueadoPor && bloqueadoPor !== p;
  if (deOutraAba) {
    _visSetEstado('revezamento', 'bloqueado', 'Outro projeto',
                  `Revezamento — ${travada} (projeto "${bloqueadoPor}")`, p);
    if (p === currentProject) _visResumoVez(`Aguardando "${bloqueadoPor}"`, true);
    return;
  }
  _visSetEstado('revezamento', 'esperando', 'Na fila', `Revezamento — ${travada}`, p);
  if (p === currentProject) _visResumoVez('Na fila');
}

function visualizarOcioso(projeto) {
  const p = projeto || currentProject;
  const balde = _visBalde(p);
  if (!balde) return;
  Object.keys(balde.estados).forEach(id => {
    // A Espera e o Revezamento não entram: quem manda no estado dos dois são
    // `visualizarEsperaEstado` e `visualizarRevezamentoEstado`, chamados logo a
    // seguir pelo mesmo evento.
    if (id === 'espera' || id === 'revezamento') return;
    // 'parcial' e 'erro' persistem como o 'done': são o desfecho da última
    // passada, e ficar 'Parado' apagaria a única pista na tela.
    // 'dispensado' persiste como os desfechos: ele É o desfecho daquela
    // passada — a rotina foi olhada e dispensada. Voltar para "Parado" apagaria
    // a única pista de que o ciclo passou por ela.
    // 'bloqueado' NÃO persiste: ele diz "a janela está ocupada por outra aba
    // AGORA", e um ciclo ocioso já respondeu essa pergunta.
    if (!['done', 'parcial', 'erro', 'dispensado'].includes(balde.estados[id].estado)) {
      _visSetEstado(id, null, 'Parado', undefined, p);
    }
  });
}

// Chamado depois de "Limpar dados gerados" e a cada `enterProject`: ao
// contrário de visualizarOcioso, aqui os "Concluído" também precisam voltar —
// o que eles mostravam não existe mais.
//
// ⚠️ ZERA UM PROJETO SÓ. Sem `projeto`, é o exibido. Antes ele zerava os
// globais do módulo, e como `enterProject` o chama a cada troca de aba, entrar
// num projeto apagava o desenho do OUTRO, que podia estar no meio do ciclo.
function visualizarResetar(projeto) {
  const p = projeto || currentProject;
  const balde = _visBalde(p);
  if (!balde) return;
  Object.keys(balde.estados).forEach(id => {
    if (id === 'espera' || id === 'revezamento') return;
    _visSetEstado(id, null, 'Parado', undefined, p);
  });
  balde.acionou.clear();
  // `vivos` também é estado ao vivo acumulado (ver `_visEstadoVivo`) — sem
  // zerar aqui, uma rotina viva no momento do reset nunca dispararia
  // `_visReporDesfechos()` quando de fato terminar (a comparação "alguém saiu
  // do ar" compara contra o que sobrou aqui).
  balde.vivos.clear();
  // D7: a fase é estado ao vivo — o que ela mostrava não está mais rodando.
  const comFase = Object.keys(balde.fases || {});
  balde.fases = {};
  if (p !== currentProject) return;
  comFase.forEach(id => _visPintarFase(id));
  document.querySelectorAll('#vis-desenho .vis-liga.lit').forEach(liga => {
    liga.classList.remove('lit');
    liga.setAttribute('marker-end', 'url(#vis-pt)');
  });
  _visResumoRodada(null);
}

