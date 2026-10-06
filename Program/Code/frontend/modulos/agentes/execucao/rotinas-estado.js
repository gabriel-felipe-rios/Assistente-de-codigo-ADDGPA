// ══ AUTOMAÇÃO → Rotinas: o estado AO VIVO, por cima do disco ══════════════
//
// ⚠️ OS `init*Card` REPINTAM A PARTIR DO DISCO, E O DISCO NÃO SABE DE CICLO EM
// VOO. É essa a razão de este arquivo existir: uma segunda camada, aplicada
// depois, que diz quem está rodando AGORA. Sem ela, abrir a sub-aba no meio de
// um ciclo mostra todas as rotinas paradas.
//
// ⚠️ O SELO DE QUEM ESTÁ RODANDO NÃO PODE SER APAGADO pela repintura — daí
// `_rotinasSelosTravados` (ids de CARD, não de rotina). Uma repintura que
// limpasse tudo faria a rotina em execução piscar para "parada" a cada
// atualização.
//
// ⚠️ O PARALELISMO MOSTRADO É O REAL, não o configurado. O número da tela é um
// teto; o real depende do que já está rodando e da trava. Mostrar o configurado
// faria a tela prometer uma capacidade que não existe naquele instante.
// ── O estado ao vivo, por cima do disco ─────────────────────────────────────
// Os `init*Card` repintam a partir do DISCO, e o disco não sabe de ciclo em
// andamento: era assim que uma rotina em plena execução aparecia como "Pronto"
// só porque o usuário trocou de sub-aba. Quem está rodando (ou na fila) tem a
// última palavra sobre o próprio selo.

// Quem estava rodando ou esperando na última passada. É a memória que permite
// saber QUEM acabou de terminar — e reler o disco só desse.
let _rotinasVivos = new Set();

// ⚠️ O TRAVAMENTO DO SELO — o que faz a regra acima valer DE FATO.
//
// Até 22/08/2026 ela era só o comentário: `_syncRotinasCards` dispara treze
// `init*Card()` SEM `await` e só depois pergunta quem está rodando. As quinze
// idas ao backend voltam fora de ordem, e quem chega por último pinta. Quando o
// último era o disco — e o disco não sabe de ciclo em andamento — o selo de uma
// rotina em plena execução virava "Concluído", e dois segundos depois o poll o
// devolvia para "Executando...". Era a oscilação que o usuário via ao voltar da
// sub-aba Visualizar.
//
// O caso mais visível era o Embedding: é o único card cujo CLIQUE relê o disco
// (`_embLoadPreview`), e ele o faz depois de três chamadas em sequência — lento,
// logo quase sempre o último a aterrissar.
//
// Pôr `await` nos treze inits NÃO resolveria: só trocaria a corrida por
// lentidão, e não diria nada sobre o poll, que continua chegando a cada 2 s
// depois de qualquer repintura. A ordem de chegada tem que deixar de importar.
//
// Enquanto uma rotina está viva (rodando ou na fila), o selo dela pertence ao
// estado vivo e recusa repintura vinda do disco, venha ela de onde vier.
let _rotinasSelosTravados = new Set();   // ids de CARD, não de rotina
let _rotinasPintandoVivo = false;

// `jaObtido` é o resultado de `get_processando` que o poll das abas
// (`abas-processando.js`) acabou de buscar. Sem ele a função vai buscar sozinha
// — é o caso de quando a sub-aba abre e não quer esperar os 2 s da próxima
// passada.
async function _rotinasEstadoVivo(jaObtido) {
  let r = jaObtido;
  if (!r) {
    try {
      r = await window.pywebview.api.get_processando(currentProject);
    } catch (e) {
      return; // projeto pode ainda não estar carregado
    }
  }
  if (!r || !r.success) return;

  const rodando  = (r.processando || []).map(a => a.id);
  const esperando = (r.esperando || []).map(a => a.id);
  const vivos = new Set([...rodando, ...esperando]);

  // Quem saiu do ar desde a última passada terminou (ou foi pulado): o selo
  // dele agora está no disco, e só ele precisa ser relido.
  _rotinasVivos.forEach(id => {
    if (vivos.has(id)) return;
    const repinta = _ROTINA_INIT[id];
    if (repinta) { try { repinta(); } catch (e) { /* card pode não estar montado */ } }
  });
  _rotinasVivos = vivos;

  // A trava vem DEPOIS da repintura acima, e é de propósito: quem acabou de
  // sair de `vivos` já não está travado, então o disco pode voltar a mandar
  // nele — que é justamente o certo, porque agora o disco é a verdade.
  _rotinasSelosTravados = new Set([...vivos].map(id => _ROTINA_CARD_ID[id] || id));

  _rotinasPintandoVivo = true;
  try {
    esperando.forEach(id => _setSimpleAgentBadge(_ROTINA_CARD_ID[id] || id, 'esperando'));
    rodando.forEach(id => {
      _setSimpleAgentBadge(_ROTINA_CARD_ID[id] || id, 'running');
    });
  } finally {
    // `finally` e não uma linha depois: se uma pintura estourar, a flag ficaria
    // ligada para sempre e o travamento pararia de valer para todo mundo.
    _rotinasPintandoVivo = false;
  }
}

// Poll de 2 s enquanto a sub-aba está aberta — a mesma cadência de Pendências.
// Antes o único momento de re-sincronizar era ABRIR a sub-aba: com ela na
// frente, uma rotina começava e terminava sem o selo mudar uma única vez, e a
// única saída era trocar de sub-aba e voltar.
// Visível de verdade = a aba de cima E a sub-aba, as duas na frente.
//
// ⚠️ As DUAS alturas, e não só a sub-aba: sair de Automação para outra aba de
// cima NÃO tira o `active` de `asubtab-rotinas`, que é gerenciado só dentro da
// barra de sub-abas de Automação. Com a guarda antiga, esta tela se achava
// visível para sempre e repintava selos de cards que ninguém estava vendo.
function _rotinasSubAbaVisivel() {
  const pane = document.getElementById('asubtab-rotinas');
  const aba  = document.getElementById('tab-agentes');
  return !!(pane && pane.classList.contains('active') &&
            aba  && aba.classList.contains('active'));
}

// ⚠️ O POLL DE 2 s DESTA TELA FOI REMOVIDO (23/08/2026), e não é perda de
// funcionalidade: quem bate no backend agora é o poll único de
// `abas-processando.js`. Ele precisa rodar sempre — é o que acende a bolinha da
// aba Automação mesmo com o usuário em outra aba — e ENTREGA o resultado para cá
// quando esta sub-aba está na frente. Eram duas perguntas idênticas ao backend a
// cada 2 s; virou uma.

// ── O paralelismo real ──────────────────────────────────────────────────────
//
// O número de Configurações abre N vagas, mas quem decide quantas passam de
// fato é o `PortaoDeContexto` (`modulos/tokens.py`), que conta TOKENS: se cada
// lote ocupa mais de 1/N da janela do LM Studio, só um passa por vez. A tela
// dizia "3 em paralelo" e o usuário via um arquivo de cada vez — o número
// parecia mentira, e não era: era outra pergunta.
async function _rotinasPintarParalelismo() {
  const alvos = document.querySelectorAll('[data-paralelo-nota]');
  if (!alvos.length) return;
  try {
    const r = await window.pywebview.api.get_paralelismo_real(currentProject);
    if (!r || !r.success) return;
    alvos.forEach(el => {
      el.textContent = `Em paralelo: ${r.configurados} configurado`
        + `${r.configurados !== 1 ? 's' : ''} · ${r.cabendo} cabendo na janela agora`;
      el.title = r.explicacao || '';
    });
  } catch (e) { /* projeto pode ainda não estar carregado */ }
}

// Seis estados. Os dois últimos foram os que faltaram, e cada um cobria um
// buraco diferente:
//
//  · **parcial** — uma rotina que terminou com arquivos por gerar ficava
//    VERDE, igual a uma que gerou tudo. O Espelho (retirado em 2026-09) fechou 327 de 332 com 4
//    erros e o card disse "Concluído": a pergunta "gerou tudo mesmo?" não
//    tinha resposta em lugar nenhum da tela.
//  · **esperando** — uma rotina na fila do ciclo, aguardando a vez ou o
//    pré-requisito dela, aparecia como **Pronto** — a mesma palavra de uma
//    rotina que ninguém pediu para rodar. Num ciclo de quatro horas não havia
//    como distinguir "vai rodar" de "não vai rodar". Quem sabe disso é o
//    backend (`_proc_fila_esperando`), não a tela.
//
// `erros` só é lido no estado 'done': com erro, o selo vira âmbar e diz
// quantos, levando à aba Erros do próprio card.
function _setSimpleAgentBadge(agId, status, erros) {
  // ⚠️ Rotina viva manda no próprio selo (ver `_rotinasSelosTravados`). Esta
  // linha é o que impede a repintura vinda do disco — de um `init*Card` que
  // demorou a voltar, do clique num card, de `_embLoadPreview` — de sobrescrever
  // um "Executando..." ou "Esperando" que está correto.
  if (!_rotinasPintandoVivo && _rotinasSelosTravados.has(agId)) return;
  const badge = document.getElementById(`${agId}-badge`);
  if (!badge) return;
  const n = erros || 0;
  if (status === 'done' && n > 0) {
    badge.textContent = `Concluído com ${n} erro${n !== 1 ? 's' : ''}`;
    badge.className   = 'agente-badge agente-badge-parcial';
    badge.title       = 'terminou, mas nem tudo saiu — veja a aba Erros deste card';
    return;
  }
  // ⚠️ `dispensado` e `pulado` são estados DIFERENTES, e não sinônimos.
  // Dispensada = o Detector olhou e não achou nada que pedisse esta rotina; é o
  // desfecho normal de um ciclo sobre projeto em dia, e por isso é cinza-azulado
  // e não âmbar. Pulada = um pré-requisito não terminou, então ficou trabalho
  // para a próxima volta — esse merece âmbar.
  // ⚠️ `bloqueado` também não é sinônimo de `esperando`, e a diferença é DE
  // QUEM se espera. `esperando` é a fila do ciclo DESTE projeto; `bloqueado` é
  // a janela do LM Studio na mão de OUTRA ABA DE PROJETO — e não há nada a
  // fazer nesta tela sobre isso, que é justamente o que a cor própria diz. Hoje
  // só o card do Revezamento o usa.
  const labels = {
    idle: 'Pronto', esperando: 'Esperando', running: 'Executando...',
    done: 'Concluído', error: 'Erro',
    dispensado: 'Dispensada', pulado: 'Pulada', bloqueado: 'Outro projeto',
  };
  const classes = {
    idle: 'agente-badge-idle', esperando: 'agente-badge-esperando',
    running: 'agente-badge-running', done: 'agente-badge-done',
    error: 'agente-badge-error',
    dispensado: 'agente-badge-dispensado', pulado: 'agente-badge-parcial',
    bloqueado: 'agente-badge-bloqueado',
  };
  const dicas = {
    dispensado: 'o Detector não viu nada que pedisse esta rotina neste ciclo',
    pulado: 'um pré-requisito não terminou — fica para a próxima volta',
  };
  if (dicas[status]) badge.title = dicas[status];
  badge.textContent = labels[status] || status;
  badge.className   = 'agente-badge ' + (classes[status] || 'agente-badge-idle');
  badge.title       = status === 'esperando'
    ? 'está na fila deste ciclo — vai rodar quando chegar a vez dela'
    : status === 'bloqueado'
    ? 'outra aba de projeto está usando a janela do LM Studio'
    : '';
}

async function _loadSimpleAgentViewer(agId) {
  const listEl = document.getElementById(`${agId}-viewer-list`);
  // Tokens e linhas vêm do backend, contados por tiktoken. Antes eram
  // estimados aqui (`palavras * 1,3`) e cada arquivo era lido numa chamada
  // separada da API — uma terceira fórmula de token e N chamadas por abertura.
  const r = await window.pywebview.api.get_agent_files_stats(currentProject, agId);
  if (!r.success || r.files.length === 0) {
    listEl.innerHTML = '<p class="agente-viewer-empty">Nenhum arquivo gerado ainda.</p>';
    _updateAgentSummary(agId, 0, 0, 0);
    return;
  }

  const table = document.createElement('table');
  table.className = 'agente-viewer-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const th1 = document.createElement('th'); th1.textContent = 'Tokens';
  const th2 = document.createElement('th'); th2.textContent = 'Linhas';
  const th3 = document.createElement('th'); th3.textContent = 'Arquivo';
  headerRow.appendChild(th1);
  headerRow.appendChild(th2);
  headerRow.appendChild(th3);
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const info of r.files) {
    const fname = info.file;
    const row = document.createElement('tr');
    const td1 = document.createElement('td'); td1.textContent = `${info.tokens}`;
    const td2 = document.createElement('td'); td2.textContent = `${info.lines}`;
    const td3 = document.createElement('td'); td3.textContent = fname;
    row.appendChild(td1);
    row.appendChild(td2);
    row.appendChild(td3);

    // O conteúdo só é lido quando o usuário clica — abrir a aba não precisa
    // mais carregar todos os arquivos do agente na memória.
    row.addEventListener('click', async () => {
      document.querySelectorAll(`#agente-${agId} .agente-viewer-table tbody tr`).forEach(r => r.classList.remove('active'));
      row.classList.add('active');
      const contentEl = document.getElementById(`${agId}-viewer-content`);
      const fnameEl   = document.getElementById(`${agId}-viewer-filename`);
      const preEl     = document.getElementById(`${agId}-viewer-pre`);
      const fr = await window.pywebview.api.read_agent_file(currentProject, agId, fname);
      fnameEl.textContent = fname;
      preEl.textContent = fr.success ? (fr.content || '') : ('Erro ao ler: ' + (fr.error || ''));
      contentEl.classList.remove('hidden');
      preEl.scrollTop = 0;
    });

    tbody.appendChild(row);
  }
  table.appendChild(tbody);

  listEl.innerHTML = '';
  listEl.appendChild(table);

  _updateAgentSummary(agId, r.tokens, r.lines, r.files.length);
}

function _updateAgentSummary(agId, tokens, lines, files) {
  const summaryEl = document.getElementById(`${agId}-summary`);
  if (!summaryEl) return;
  if (tokens === 0 && lines === 0 && files === 0) {
    summaryEl.textContent = '';
  } else {
    summaryEl.textContent = `${tokens} tokens · ${lines} linhas · ${files} arquivo${files !== 1 ? 's' : ''}`;
  }
}

// O selo de um card cujo status só sabe dizer "existe" ou "não existe" —
// Glossário, Pipeline, Resumo de Pastas. Eles agora devolvem `errors` junto,
// e sem isso o Glossário aparecia como **Pronto** depois de quebrar: sem
// arquivo gerado, `exists` era falso, e falso virava "nunca rodou".
function _selarPeloStatus(agId, r) {
  const erros = (r && r.errors) ? r.errors.length : 0;
  const existe = !!(r && r.success && r.exists);
  if (erros && !existe) { _setSimpleAgentBadge(agId, 'error'); return; }
  if (existe) { _setSimpleAgentBadge(agId, 'done', erros); return; }
  _setSimpleAgentBadge(agId, 'idle');
}
