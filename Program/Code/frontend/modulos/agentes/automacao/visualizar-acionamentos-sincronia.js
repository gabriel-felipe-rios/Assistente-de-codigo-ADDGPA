// ══ AUTOMAÇÃO → Visualizar: sincronizar com o que está acontecendo ════════
//
// A carga do estado ao abrir a sub-aba, a reposição dos desfechos e a faixa de
// resumo.
//
// ⚠️ O DESENHO NÃO É A VERDADE — o disco e o ciclo em voo são. Este arquivo
// existe para reconciliar os dois toda vez que a sub-aba aparece: sem ele,
// abrir Visualizar no meio de um ciclo mostra tudo parado, e abrir depois de um
// ciclo mostra tudo como se nunca tivesse rodado.
//
// ⚠️ SÓ SINCRONIZA COM A SUB-ABA VISÍVEL (`_visSubAbaVisivel`). Repintar um
// desenho escondido gasta travessia da ponte a cada evento, por projeto aberto.
// ── Sincronização com o projeto ────────────────────────────────────────────

// `jaBuscado` = `{espera, processando, desfechos}`, quando quem chamou já
// trouxe as três respostas. É o que permite buscar tudo de uma vez em vez de
// uma atrás da outra — ver `_visCarregar`.
async function _visSincronizar(jaBuscado) {
  const proj = currentProject;
  try {
    const w = (jaBuscado && jaBuscado.espera)
      || await window.pywebview.api.get_espera_status(proj);
    if (proj !== currentProject) return;
    if (w && w.success) {
      const d = w.debounces || {};
      const trio = `${d.t1 ?? w.debounce_segundos}s / ${d.t2 ?? '—'}s / ${d.t3 ?? '—'}s`;
      visualizarEsperaEstado(w.ativo, w.ativo ? `Escutando · ${trio}` : 'Parado',
                             w.vigiando, proj);
      visualizarRevezamentoEstado(w.aguardando_trava, w.bloqueado_por_projeto, proj);
      _visResumoGrupos(w, proj);
    }
  } catch (e) { /* projeto ainda não carregado */ }

  // ⚠️ A ORDEM É OBRIGATÓRIA, E É O CONSERTO DE UM BUG REAL.
  //
  // Quem está rodando AGORA vem primeiro. O disco só sabe da última vez que a
  // rotina TERMINOU, e repô-lo por cima pintava "Concluído" sobre uma rotina em
  // plena execução: era o "38 de 39" numa tela e "Concluído" na outra, sobre a
  // mesma rotina, no mesmo instante.
  //
  // Inverter a ordem sozinho não bastava — `_visReporDesfechos` percorre TODOS
  // os `last_runs`, então a segunda chamada voltaria a pintar por cima. Por
  // isso ela agora consulta o `vivos` do balde e pula quem está vivo.
  // ⚠️ A ordem de APLICAR continua exatamente esta. O que ficou em paralelo é
  // só a BUSCA (ver `_visCarregar`): as quatro respostas são independentes
  // entre si, mas a pintura não é.
  await _visEstadoVivo(jaBuscado && jaBuscado.processando);
  await _visReporDesfechos(jaBuscado && jaBuscado.desfechos);
}

async function _visReporDesfechos(jaObtido) {
  const proj = currentProject;
  try {
    const lr = jaObtido || await window.pywebview.api.get_agent_last_runs(proj);
    if (proj !== currentProject) return;
    if (!lr || !lr.success) return;
    const balde = _visBalde(proj);
    if (!balde) return;
    let ultima = null;
    // Repõe o "Concluído" de TODO agente que já rodou, ligado ou não: o
    // estado é um eixo à parte da chave, e "desligada, mas o que ela gerou
    // está lá" é uma leitura legítima — foi o caso do Hashes que expôs isso.
    const desfechos = lr.desfechos || {};
    // A Situação lê daqui o «Concluído às» de cada grupo.
    balde.lastRuns = lr.last_runs || {};
    balde.desfechos = desfechos;
    Object.entries(lr.last_runs || {}).forEach(([agentId, quando]) => {
      if (!quando) return;
      if (!ultima || quando > ultima) ultima = quando;
      // ⚠️ Rotina viva manda no próprio selo. O disco carrega o desfecho da
      // passada ANTERIOR, e pintá-lo por cima de quem está trabalhando agora é
      // dizer "Concluído" sobre uma barra que está em 38 de 39.
      if (balde.vivos.has(agentId)) return;
      visualizarAgenteConcluido(agentId, /* semAnimacao */ true, desfechos[agentId], proj);
    });
    _visResumoRodada(ultima);
  } catch (e) { /* projeto ainda não carregado */ }
}

// ── O que está acontecendo AGORA ───────────────────────────────────────────
// Esta sub-aba só sabia de estado por dois caminhos, e os dois eram eventos:
// `acionamentosEsperaStatus` e `acionamentosAgentDone`. Quem abrisse a aba no
// meio de uma execução não recebia evento nenhum — eles já tinham passado — e
// via o desfecho da rodada ANTERIOR como se fosse o estado atual.

// `jaObtido`: ver `_rotinasEstadoVivo`, em execucao/rotinas.js.
async function _visEstadoVivo(jaObtido) {
  const proj = currentProject;
  let r = jaObtido;
  if (!r) {
    try {
      r = await window.pywebview.api.get_processando(proj);
    } catch (e) {
      return; // projeto ainda não carregado
    }
    if (proj !== currentProject) return;
  }
  if (!r || !r.success) return;
  const balde = _visBalde(proj);
  if (!balde) return;

  const rodando   = (r.processando || []).map(a => a.id);
  const esperando = (r.esperando || []).map(a => a.id);
  const vivos = new Set([...rodando, ...esperando]);

  // Alguém saiu do ar desde a última passada: o desfecho dele acabou de ser
  // gravado, e é do disco que ele tem de vir — deixar como estava manteria
  // "Processando" para sempre numa rotina que já terminou.
  const saiu = [...balde.vivos].some(id => !vivos.has(id));
  balde.vivos = vivos;
  // A linha «Rodando» de cada grupo diz a rotina da vez e o «x de y» dela.
  balde.processando = r.processando || [];
  balde.esperandoIds = esperando;
  if (proj === currentProject) _visPintarGrupos();
  if (saiu) await _visReporDesfechos();

  esperando.forEach(id => _visSetEstado(id, 'esperando', 'Esperando',
                                        'na fila deste ciclo — ainda não chegou a vez dela',
                                        proj));
  // ⚠️ O MESMO PAR das duas telas: `processados` de `a_processar`, e nunca de
  // `total`. `total` é quantos arquivos EXISTEM, e a maioria costuma ser pulada
  // por hash igual — era daí que saíam os dois números diferentes para a mesma
  // rotina, um em Rotinas e outro aqui.
  (r.processando || []).forEach(a => {
    const alvo = a.a_processar != null ? a.a_processar : a.total;
    const dica = a.conta && alvo
      ? `${a.processados} de ${alvo}` + (a.atual ? ` · ${a.atual}` : '')
      : 'rodando agora';
    _visSetEstado(a.id, 'run',
                  a.conta && alvo ? `${a.processados} de ${alvo}` : 'Processando',
                  dica, proj);
  });
}

// O que o poll único entrega a esta sub-aba a cada 2 s: o estado vivo e, junto,
// a espera de cada grupo. ⚠️ A espera PRECISA vir por aqui: o evento de mudança
// (`aguardando`) e o de fim de ciclo saem do backend ANTES de o laço da Espera
// gravar o estado novo do grupo, e a tela ficava em "Parado" durante toda a
// contagem.
async function _visPollDaSubAba(r) {
  await _visEstadoVivo(r);
  const proj = currentProject;
  try {
    const w = await window.pywebview.api.get_espera_status(proj);
    if (proj === currentProject) _visResumoGrupos(w, proj);
  } catch (e) { /* projeto ainda não carregado */ }
}

// ⚠️ O POLL DE 2 s DESTA TELA FOI REMOVIDO (23/08/2026), e não é perda de
// funcionalidade: quem bate no backend agora é o poll único de
// `abas-processando.js`. Ele precisa rodar sempre — é o que acende a bolinha da
// aba Automação mesmo com o usuário em outra aba — e ENTREGA o resultado para cá
// quando esta sub-aba está na frente. Eram duas perguntas idênticas ao backend a
// cada 2 s; virou uma.

// Visível de verdade = a aba de cima E a sub-aba. Lido pelo poll único de
// `abas-processando.js`.
function _visSubAbaVisivel() {
  const pane = document.getElementById('asubtab-visualizar');
  const aba  = document.getElementById('tab-agentes');
  return !!(pane && pane.classList.contains('active') &&
            aba  && aba.classList.contains('active'));
}

// ── Faixa de resumo ────────────────────────────────────────────────────────
//
// Existe para responder de cara "quantas de quantas", que era a pergunta por
// trás do "parece que faltam agentes aqui".

// São QUINZE rotinas (`IDS_DAS_ROTINAS`). O `ordem` que o backend manda traz
// as quatorze que a tabela de dependências conhece — o Hashes roda antes de
// todas e fica fora dela, daí o `+ 1`.
//
// A BASE conta como ligada quando há alguma OUTRA ligada, que é precisamente
// quando ela roda. As três não têm chave, e contá-las por `settings` daria
// zero para sempre.
function _visResumoLigados() {
  const el = document.getElementById('vis-num-ligados');
  const dados = (_visBalde() || {}).dados;
  if (!el || !dados) return;
  const ordem    = dados.ordem || [];
  const settings = dados.settings || {};
  const ligada   = id => settings[id] && settings[id] !== 'off';
  const escolhidas = ordem.filter(id => !VIS_BASE.includes(id) && ligada(id)).length;
  const total    = ordem.length + 1;
  el.innerHTML = `${escolhidas ? escolhidas + VIS_BASE.length : 0} <span class="vis-de">de ${total}</span>`;
}

// ── A espera de cada grupo ─────────────────────────────────────────────────
//
// Uma linha por grupo (T1, T2, T3) na Situação: o estado, a contagem regressiva
// até ele começar, a barra e o que o está segurando (D12). O estado vem de
// `get_espera_status().grupos` (o laço da Espera o mantém no backend); a
// contagem regressiva é da tela — um relógio de 1 s que só recalcula a partir
// do `prazo_em`, sem pedir nada ao backend, e que só fica ligado com a sub-aba
// visível.
//
// ⚠️ O RELÓGIO DA TELA NÃO É O DO BACKEND. `prazo_em` é hora do backend; a
// diferença entre os dois (`espera.agora` contra `Date.now()` na chegada) é
// guardada e descontada, senão um relógio adiantado mostraria o grupo "na
// fila" antes da hora.

let _visRelogioGrupos = null;

// `espera` = a resposta de `get_espera_status`. `projeto` é o dono (ver
// `_visSetEstado`): guarda no balde dele e só pinta se for o da tela.
function _visResumoGrupos(espera, projeto) {
  if (!espera || !espera.success || !espera.grupos) return;
  const p = projeto || currentProject;
  const balde = _visBalde(p);
  if (!balde) return;
  balde.espera = espera;
  balde.esperaDiferenca = espera.agora != null ? espera.agora - Date.now() / 1000 : 0;
  if (p !== currentProject) return;
  _visPintarGrupos();
  if (_visSubAbaVisivel()) _visLigarRelogioGrupos();
}

function _visLigarRelogioGrupos() {
  if (_visRelogioGrupos) return;
  _visRelogioGrupos = setInterval(() => {
    if (!_visSubAbaVisivel()) {
      clearInterval(_visRelogioGrupos);
      _visRelogioGrupos = null;
      return;
    }
    _visPintarGrupos();
  }, 1000);
}

// De qual grupo é a rotina. A base (Detector, Hashes, Sincronia) roda dentro
// do ciclo do T1.
function _visGrupoDaRotina(id) {
  const e = typeof EXPLICACOES_ROTINAS !== 'undefined' && EXPLICACOES_ROTINAS[id];
  if (!e) return null;
  return e.grupo === 'base' ? 't1' : e.grupo;
}

// ⚠️ O QUE ESTÁ RODANDO MANDA, NÃO O ESTADO DA ESPERA. O estado dos grupos no
// backend (`grupos` de `get_espera_status`) só é escrito pelo laço da Espera;
// um ciclo de «Ativar tudo», da retomada ou do ▶ roda os três grupos sem passar
// por ele — e a Situação dizia "Parado" no T2 com a Documentação Técnica em
// 11 de 794. Por isso a leitura é, nesta ordem: quem está rodando AGORA
// (`get_processando`), a contagem da Espera, quem está na fila do ciclo, e só
// então o que o laço lembra.
//
// Sem "nada segurando": quando nada segura, a linha só diz o estado.
function _visPintarGrupos() {
  const balde = _visBalde();
  const espera = balde && balde.espera;
  if (!espera || !espera.grupos) return;
  const agora = Date.now() / 1000 + (balde.esperaDiferenca || 0);
  const ordem = espera.grupos_ordem || Object.keys(espera.grupos);
  const mmss = seg => {
    const t = Math.max(0, Math.ceil(seg));
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  };
  const nomeDe = id => (EXPLICACOES_ROTINAS[id] || {}).nome || id;
  const rodando = {}, esperando = {};
  (balde.processando || []).forEach(a => {
    const g = _visGrupoDaRotina(a.id);
    if (g && !rodando[g]) rodando[g] = a;
  });
  (balde.esperandoIds || []).forEach(id => {
    const g = _visGrupoDaRotina(id);
    if (g) (esperando[g] = esperando[g] || []).push(id);
  });
  const grupoRodando = ordem.find(g => rodando[g]
    || (espera.grupos[g] || {}).estado === 'rodando');

  // O último desfecho do grupo, do disco: é o que diz "Concluído às" depois de
  // um ciclo que não passou pela Espera.
  const ultimoDoGrupo = g => {
    let quando = null, erros = false;
    Object.entries(balde.lastRuns || {}).forEach(([id, iso]) => {
      if (!iso || _visGrupoDaRotina(id) !== g) return;
      if (!quando || iso > quando) quando = iso;
      const d = (balde.desfechos || {})[id];
      if (d && (d.falhou || d.erros)) erros = true;
    });
    return { quando, erros };
  };

  ordem.forEach(g => {
    const e = espera.grupos[g] || {};
    const el = sufixo => document.getElementById(`vis-esp-${g}${sufixo}`);
    const est = el('-est'), tempo = el('-tempo'), barra = el('-barra'), motivo = el('-motivo');
    if (!est || !tempo || !barra || !motivo) return;
    let txtEst, txtTempo = '', classe = '', frac = 0, txtMotivo = '';
    const falta = e.estado === 'contando' && e.prazo_em != null ? e.prazo_em - agora : null;

    if (rodando[g]) {
      const a = rodando[g];
      const alvo = a.a_processar != null ? a.a_processar : a.total;
      txtEst = 'Rodando'; txtTempo = '●'; classe = 'run'; frac = 1;
      // O mesmo par das outras telas: `processados` de `a_processar`.
      txtMotivo = a.conta && alvo ? `${nomeDe(a.id)} · ${a.processados} de ${alvo}` : nomeDe(a.id);
    } else if (falta != null && falta > 0) {
      txtEst = 'Começa em'; txtTempo = mmss(falta); classe = 'conta';
      const total = e.espera_total || 0;
      frac = total > 0 ? (total - falta) / total : 0;
      txtMotivo = 'segurando: ' + (e.segurando || 'o disco ainda está mudando');
    } else if (esperando[g] || e.estado === 'na_fila' || falta != null) {
      // Na fila do ciclo: quem segura é o grupo que está rodando, ou a vez do
      // modelo (Chat, Fila, outro projeto).
      txtEst = 'Na fila'; txtTempo = 'na fila'; classe = 'fila'; frac = 1;
      if (grupoRodando && grupoRodando !== g) {
        txtMotivo = `segurando: espera o ${String(grupoRodando).toUpperCase()} terminar`;
      } else if (e.segurando) {
        txtMotivo = 'segurando: ' + e.segurando;
      } else {
        txtMotivo = 'segurando: Revezamento — esperando a vez do modelo';
      }
    } else if (e.estado === 'rodando') {
      txtEst = 'Rodando'; txtTempo = '●'; classe = 'run'; frac = 1;
    } else {
      const u = ultimoDoGrupo(g);
      const quando = (e.estado === 'concluido' && e.concluido_em && (!u.quando || e.concluido_em > u.quando))
        ? e.concluido_em : u.quando;
      if (quando) {
        txtEst = `${u.erros ? 'Terminou com erros' : 'Concluído'} às ${_visQuando(quando)}`;
        txtTempo = u.erros ? '!' : '✓'; classe = u.erros ? 'fila' : 'ok';
        if (u.erros) txtMotivo = 'veja a sub-aba Erros';
      } else {
        txtEst = 'Parado'; txtTempo = '—';
      }
    }

    est.textContent = txtEst;
    tempo.textContent = txtTempo;
    tempo.className = 'vis-esp-tempo' + (classe ? ' ' + classe : '');
    barra.style.width = Math.round(Math.min(1, Math.max(0, frac)) * 100) + '%';
    motivo.textContent = txtMotivo;
    motivo.title = txtMotivo;
    motivo.hidden = !txtMotivo;
  });
}

// A vez na janela do LM Studio. Métrica separada da Espera porque são duas
// perguntas diferentes, e a resposta de uma não diz nada sobre a outra: a
// Espera pode estar "Parada" (nada mudou no disco) com a vez em "Outro
// projeto", e o contrário também.
// `bloqueado` pinta a faixa de índigo, a mesma cor do estado no desenho. Sem
// isto ela ficaria no azul fixo do CSS — e azul, nesta tela, é "processando".
function _visResumoVez(palavra, bloqueado) {
  const el = document.getElementById('vis-num-vez');
  if (!el) return;
  el.textContent = palavra;
  // O texto inteiro na dica: a faixa corta com reticências quando o nome do
  // projeto é longo (ver `.vis-metrica-vez` no CSS), e cortar sem deixar como
  // ler o resto seria esconder justamente o nome que importa.
  el.title = palavra;
  el.classList.toggle('bloqueado', !!bloqueado);
}

function _visResumoRodada(iso) {
  const el = document.getElementById('vis-num-rodada');
  if (!el) return;
  el.textContent = iso ? _visQuando(iso) : '—';
}

// Hora se foi hoje, dia/mês se foi antes — quem olha esta faixa quer saber se o
// ciclo acabou de rodar, não a data exata.
function _visQuando(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const dd = n => String(n).padStart(2, '0');
  if (d.toDateString() === new Date().toDateString()) {
    return `${dd(d.getHours())}:${dd(d.getMinutes())}`;
  }
  return `${dd(d.getDate())}/${dd(d.getMonth() + 1)}`;
}
