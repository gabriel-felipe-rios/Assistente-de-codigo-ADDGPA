// ══════════════════════════════════════════════════════════════ TERMINAL ══
// Seleciona um script, executa de verdade, mostra stdout/stderr **ao vivo** nas
// 3 sub-abas (Tudo/Saída/Erros) e monta o prompt de "explicar erro" —
// determinístico, sem chamar LLM. Backend: backend/modulos/terminal.py.
//
// Não é um terminal: é um executor de script. A saída chega em pedaços
// (`status: 'chunk'`) por canal, e o canal é o que decide a cor base e a
// sub-aba — as cores ANSI do próprio programa pintam por cima.

let _termScriptPath = null;
let _termOrigemManual = false;     // true quando o usuário escolheu via "Selecionar script"
let _termUltimoResultado = null;   // { comando, exit_code } — uma só, sem histórico
let _termSubAba = 'tudo';

// Saída acumulada, por canal. `_termResto*` guarda a linha ainda sem `\n` —
// sem isso, a última linha de cada chunk piscaria só no chunk seguinte.
let _termLinhasOut = [];
let _termLinhasErr = [];
let _termRestoOut = '';
let _termRestoErr = '';
let _termDescartadas = 0;          // linhas cortadas pelo teto de buffer
let _termRenderAgendado = false;

let _termRodando = false;          // decide se o botão é Executar ou Parar
let _termPerguntando = false;      // G3: o aviso `terminal.vai_rodar` está no ar

// Busca na saída
let _termBusca = '';
let _termAchadoAtual = 0;

// Log grande demais trava a aba. O teto é por canal, e o corte é **anunciado**
// na tela — corte silencioso faz o usuário achar que viu o log inteiro.
const TERM_MAX_LINHAS = 5000;

// De qual projeto é o que está na tela do Terminal. `null` = nenhum ainda.
let _termProjeto = null;

// Tudo o que esta aba guarda é DE UM PROJETO: o caminho do script, a saída
// acumulada, o último resultado, a busca. Nada disso tinha noção de projeto, e
// com abas trocar de projeto deixava na tela a saída do outro — e, pior,
// `_termOrigemManual` continuava `true`, o que impedia `initTerminalTab` de
// pegar o `main_file` do projeto novo. Um script de outro projeto ficava
// carregado no botão Executar.
//
// ⚠️ `_termRodando` NÃO é zerado às cegas: o processo de cada projeto é
// separado no backend (`self._term_procs[project_name]`), e quem responde por
// ele é `terminalOutput`. Aqui a tela volta para "Executar" porque a saída que
// ela mostrava não é mais a desta aba; se houver processo vivo no projeto novo,
// o próximo chunk dele reacende o botão.
function terminalLimparEstadoDeProjeto() {
  if (_termProjeto === currentProject) return;
  _termProjeto = currentProject;
  _termScriptPath = null;
  _termOrigemManual = false;
  _termUltimoResultado = null;
  _termLinhasOut = [];
  _termLinhasErr = [];
  _termRestoOut = '';
  _termRestoErr = '';
  _termDescartadas = 0;
  _termBusca = '';
  _termAchadoAtual = 0;
  _termRodando = false;
  const busca = document.getElementById('term-busca');
  if (busca) busca.value = '';
  const saida = document.getElementById('terminal-output');
  if (saida) saida.innerHTML = '';
}

// Os pontos das extensões e o aviso antes do ▶ Executar moram em
// `terminal-extensoes.js` (`xtPintarEncaixeDoTerminal`, `_termPerguntarAsExtensoes`).

function initTerminalTab() {
  terminalLimparEstadoDeProjeto();
  xtPintarEncaixeDoTerminal();
  const btnBrowse = document.getElementById('btn-browse-script');
  const btnRun = document.getElementById('btn-run-script');
  const btnCopyAll = document.getElementById('btn-copy-all');
  const btnExplain = document.getElementById('btn-explain-error');
  const btnCopy = document.getElementById('btn-copy-explain');
  const busca = document.getElementById('term-busca');
  const buscaPrev = document.getElementById('term-busca-prev');
  const buscaNext = document.getElementById('term-busca-next');

  // Sem seleção manual nesta sessão, usa o "arquivo principal" já configurado
  // na aba Projeto → Trabalho — evita ter que clicar em "Selecionar script"
  // toda vez para o caso comum de sempre rodar o mesmo arquivo.
  if (!_termOrigemManual && workspaceConfig && workspaceConfig.main_file) {
    _termScriptPath = workspaceConfig.main_file;
    _atualizarCaminhoTerminal();
  }

  if (btnBrowse && !btnBrowse._wired) {
    btnBrowse._wired = true;
    btnBrowse.addEventListener('click', browseScript);
  }
  // Um botão só: Executar vira Parar enquanto roda, e volta a Executar no fim.
  if (btnRun && !btnRun._wired) {
    btnRun._wired = true;
    btnRun.addEventListener('click', () => (_termRodando ? stopScript() : runScript()));
  }
  if (btnCopyAll && !btnCopyAll._wired) {
    btnCopyAll._wired = true;
    btnCopyAll.addEventListener('click', copiarSaidaTerminal);
  }
  if (btnExplain && !btnExplain._wired) {
    btnExplain._wired = true;
    btnExplain.addEventListener('click', alternarExplicacao);
  }
  if (btnCopy && !btnCopy._wired) {
    btnCopy._wired = true;
    btnCopy.addEventListener('click', () => {
      const pre = document.getElementById('terminal-explain-prompt');
      navigator.clipboard.writeText(pre.textContent);
      showToast('Prompt copiado!');
    });
  }
  if (busca && !busca._wired) {
    busca._wired = true;
    busca.addEventListener('input', () => {
      _termBusca = busca.value;
      _termAchadoAtual = 0;
      _renderTerminalOutput();
    });
    busca.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      _termPularOcorrencia(e.shiftKey ? -1 : 1);
    });
  }
  if (buscaPrev && !buscaPrev._wired) {
    buscaPrev._wired = true;
    buscaPrev.addEventListener('click', () => _termPularOcorrencia(-1));
  }
  if (buscaNext && !buscaNext._wired) {
    buscaNext._wired = true;
    buscaNext.addEventListener('click', () => _termPularOcorrencia(1));
  }

  document.querySelectorAll('[data-termsst]').forEach(btn => {
    if (btn._wired) return;
    btn._wired = true;
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-termsst]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _termSubAba = btn.dataset.termsst;
      _termAchadoAtual = 0;
      _renderTerminalOutput();
    });
  });
}

async function browseScript() {
  const r = await window.pywebview.api.browse_script();
  if (!r.success || !r.path) return;
  _termScriptPath = r.path;
  _termOrigemManual = true;
  _atualizarCaminhoTerminal();
}

// Reflete o caminho ativo e sua origem (arquivo principal do projeto vs.
// selecionado manualmente nesta sessão da aba).
function _atualizarCaminhoTerminal() {
  const input = document.getElementById('terminal-path');
  const origem = document.getElementById('terminal-path-origem');
  input.value = _termScriptPath || '';
  if (!_termRodando) document.getElementById('btn-run-script').disabled = !_termScriptPath;
  // O contexto dos pontos promete o caminho ATUAL — antes do `return` abaixo.
  xtPintarEncaixeDoTerminal();
  if (!origem) return;
  if (!_termScriptPath) {
    origem.textContent = '';
  } else if (_termOrigemManual) {
    origem.textContent = 'selecionado manualmente';
  } else {
    origem.textContent = 'arquivo principal do projeto';
  }
}

async function runScript() {
  if (!_termScriptPath || _termRodando || _termPerguntando) return;
  // G3 · As extensões ouvem antes (até 1,5 s por guardiã) e podem barrar ou
  // tomar a execução. A trava impede dois cliques de emitir dois avisos.
  const projeto = currentProject, caminho = _termScriptPath;
  _termPerguntando = true;
  let destino;
  try {
    destino = await _termPerguntarAsExtensoes(projeto, caminho, _termOrigemManual ? 'manual' : 'principal');
  } finally { _termPerguntando = false; }
  // Depois do await: o usuário pode ter trocado de projeto ou de script.
  if (projeto !== currentProject || caminho !== _termScriptPath) return;
  if (destino !== 'rodar') return;
  _termAtualizarBotaoExecutar(true);
  document.getElementById('btn-copy-all').disabled = true;
  document.getElementById('terminal-error-panel').classList.add('hidden');
  document.getElementById('terminal-explain-area').classList.add('hidden');
  document.getElementById('terminal-exit-badge').classList.add('hidden');
  _termRotuloExplicar(false);

  _termLinhasOut = [];
  _termLinhasErr = [];
  _termRestoOut = '';
  _termRestoErr = '';
  _termDescartadas = 0;
  _termAchadoAtual = 0;
  _termUltimoResultado = null;

  document.getElementById('terminal-output').innerHTML =
    '<span class="terminal-placeholder">Executando...</span>';
  await window.pywebview.api.run_script(currentProject, _termScriptPath);
}

async function stopScript() {
  if (!_termRodando) return;
  const btn = document.getElementById('btn-run-script');
  btn.disabled = true;          // some clique duplo não manda dois taskkill
  await window.pywebview.api.stop_script(currentProject);
}

// O mesmo botão faz as duas coisas: enquanto roda ele é o Parar. Dois botões
// lado a lado deixavam um dos dois sempre morto, e o alvo do clique mudava de
// lugar conforme o estado.
function _termAtualizarBotaoExecutar(rodando) {
  _termRodando = rodando;
  const btn = document.getElementById('btn-run-script');
  if (!btn) return;
  btn.textContent = rodando ? '■ Parar' : '▶ Executar';
  btn.className = 'btn btn-sm ' + (rodando ? 'btn-negative' : 'btn-positive');
  btn.disabled = rodando ? false : !_termScriptPath;
}

function terminalOutput(data) {
  // Com mais de um projeto aberto ao mesmo tempo, o Python pode notificar o
  // Terminal de um projeto que não é o exibido agora — a saída daquele script
  // continua sendo salva/processada normalmente no backend, só não pinta na
  // tela errada. Quem reabrir aquela aba mais tarde não tem replay (é streaming
  // ao vivo, não fica gravado), então o único efeito é perder o acompanhamento
  // — igual ao "Sair do projeto" já aceito em outros lugares do app.
  if (data.project && data.project !== currentProject) return;

  if (data.status === 'error') {
    _termFimDaExecucao();
    document.getElementById('terminal-output').innerHTML =
      `<span class="terminal-placeholder">Erro ao executar: ${escapeHtml(data.error)}</span>`;
    return;
  }

  if (data.status === 'chunk') {
    _termAcumular(data.canal, data.texto || '');
    document.getElementById('btn-copy-all').disabled = false;
    _agendarRenderTerminal();
    return;
  }

  if (data.status !== 'done') return;

  _termFimDaExecucao();
  _termUltimoResultado = { comando: data.comando, exit_code: data.exit_code };
  _renderTerminalOutput();

  // O gatilho é o exit code, não o stderr sozinho — muito programa escreve
  // aviso no stderr sem ter dado erro de fato.
  const badge = document.getElementById('terminal-exit-badge');
  badge.classList.remove('hidden');
  if (data.exit_code === 0) {
    badge.textContent = 'exit code 0';
    badge.className = 'terminal-exit-badge ok';
    document.getElementById('terminal-error-panel').classList.add('hidden');
  } else {
    badge.textContent = `exit code ${data.exit_code} — é este o gatilho`;
    badge.className = 'terminal-exit-badge bad';
    document.getElementById('terminal-error-panel').classList.remove('hidden');
    document.getElementById('terminal-error-type').textContent =
      _termLinhasDoCanal('err').length
        ? `Falhou (exit ${data.exit_code})`
        : `Falhou (exit ${data.exit_code}) — sem nada no stderr`;
    document.getElementById('terminal-explain-area').classList.add('hidden');
    _termRotuloExplicar(false);
  }
}

function _termFimDaExecucao() {
  _termAtualizarBotaoExecutar(false);
  document.getElementById('btn-copy-all').disabled = !_termTemSaida();
}

function _termTemSaida() {
  return !!(_termLinhasOut.length || _termLinhasErr.length || _termRestoOut || _termRestoErr);
}

// ── Acúmulo da saída ao vivo ───────────────────────────────────────────────

function _termAcumular(canal, texto) {
  const err = canal === 'err';
  const partes = ((err ? _termRestoErr : _termRestoOut) + texto).split('\n');
  const resto = partes.pop();
  const lista = err ? _termLinhasErr : _termLinhasOut;
  partes.forEach(l => lista.push(l.replace(/\r$/, '')));

  if (lista.length > TERM_MAX_LINHAS) {
    _termDescartadas += lista.length - TERM_MAX_LINHAS;
    lista.splice(0, lista.length - TERM_MAX_LINHAS);
  }
  if (err) _termRestoErr = resto; else _termRestoOut = resto;
}

// Um render por quadro: com saída rápida, renderizar por chunk gastaria o
// quadro inteiro redesenhando texto que já vai ser substituído.
function _agendarRenderTerminal() {
  if (_termRenderAgendado) return;
  _termRenderAgendado = true;
  requestAnimationFrame(() => {
    _termRenderAgendado = false;
    _renderTerminalOutput();
  });
}

function _termLinhasDoCanal(canal) {
  const lista = canal === 'err' ? _termLinhasErr : _termLinhasOut;
  const resto = canal === 'err' ? _termRestoErr : _termRestoOut;
  return resto ? lista.concat([resto]) : lista.slice();
}

// Texto puro da sub-aba ativa — é o que "Copiar tudo" copia e o que a busca vê.
function _termTextoDaSubAba(sub) {
  const linhas = [];
  if (sub !== 'erros') {
    if (_termUltimoResultado && _termUltimoResultado.comando) {
      linhas.push('> ' + _termUltimoResultado.comando);
    }
    linhas.push(..._termLinhasDoCanal('out'));
  }
  if (sub !== 'saida') linhas.push(..._termLinhasDoCanal('err'));
  return linhas.join('\n');
}

// ── Render ─────────────────────────────────────────────────────────────────

function _renderTerminalOutput() {
  const el = document.getElementById('terminal-output');
  if (!_termTemSaida() && !_termUltimoResultado) {
    el.innerHTML = '<span class="terminal-placeholder">Nenhum script executado ainda.</span>';
    _termAtualizarContadorBusca(0);
    return;
  }

  // Instância nova a cada render: o AnsiUp guarda a cor corrente entre
  // chamadas, e reaproveitá-la faria a primeira linha herdar a cor da última.
  const ansi = _termNovoAnsi();
  const pinta = l => (ansi ? ansi.ansi_to_html(l) : escapeHtml(l));

  const linhas = [];
  if (_termDescartadas) {
    linhas.push(`<span class="terminal-cortado">[… ${_termDescartadas} linhas anteriores descartadas]</span>`);
  }
  if (_termSubAba !== 'erros') {
    if (_termUltimoResultado && _termUltimoResultado.comando) {
      linhas.push(`<span class="cmd">&gt; ${escapeHtml(_termUltimoResultado.comando)}</span>`);
    }
    _termLinhasDoCanal('out').forEach(l => { if (l) linhas.push(`<span class="out">${pinta(l)}</span>`); });
  }
  if (_termSubAba !== 'saida') {
    _termLinhasDoCanal('err').forEach(l => { if (l) linhas.push(`<span class="err">${pinta(l)}</span>`); });
  }

  // Enquanto roda, acompanha o fim da saída — mas só se o usuário já estava lá:
  // rolar para cima é justamente o gesto de quem quer ler o que passou.
  const noFim = el.scrollHeight - el.scrollTop - el.clientHeight < 40;

  el.innerHTML = linhas.length
    ? linhas.join('<br>')
    : `<span class="terminal-placeholder">${_termTextoDeVazio()}</span>`;

  _termRealcarBusca(el);
  if (noFim) el.scrollTop = el.scrollHeight;
}

// Sub-aba vazia é ambígua: pode ser "não achei" ou "não veio nada". Um programa
// pode falhar sem escrever uma linha no stderr (`sys.exit(1)`, janela fechada,
// erro só no stdout), e nesse caso "(vazio)" parece defeito da aba.
function _termTextoDeVazio() {
  const r = _termUltimoResultado;
  if (_termSubAba === 'erros' && r && r.exit_code !== 0 && !_termLinhasDoCanal('err').length) {
    return `O programa terminou com exit ${r.exit_code} sem escrever nada no stderr — `
         + 'a pista, se houver, está na sub-aba Saída.';
  }
  if (_termSubAba === 'erros') return '(nenhum erro na saída de erro)';
  return '(vazio)';
}

function _termNovoAnsi() {
  if (typeof AnsiUp === 'undefined') return null;
  const a = new AnsiUp();
  a.use_classes = true;   // classes, não cor fixa — o app troca de tema em execução
  a.escape_html = true;   // saída de script não pode chegar como HTML na tela
  return a;
}

// ── Busca ──────────────────────────────────────────────────────────────────

// O realce é feito nos **nós de texto** já renderizados: mexer na string de HTML
// cortaria as tags que o AnsiUp acabou de criar.
function _termRealcarBusca(el) {
  const alvo = _termBusca.trim();
  if (!alvo) { _termAtualizarContadorBusca(0); return; }

  const alvoLower = alvo.toLowerCase();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const textos = [];
  while (walker.nextNode()) textos.push(walker.currentNode);

  let total = 0;
  textos.forEach(no => {
    const texto = no.nodeValue;
    if (!texto.toLowerCase().includes(alvoLower)) return;
    const frag = document.createDocumentFragment();
    let i = 0;
    for (;;) {
      const p = texto.toLowerCase().indexOf(alvoLower, i);
      if (p === -1) break;
      if (p > i) frag.appendChild(document.createTextNode(texto.slice(i, p)));
      const mark = document.createElement('mark');
      mark.className = 'term-achado';
      mark.textContent = texto.slice(p, p + alvo.length);
      frag.appendChild(mark);
      total++;
      i = p + alvo.length;
    }
    if (i < texto.length) frag.appendChild(document.createTextNode(texto.slice(i)));
    no.parentNode.replaceChild(frag, no);
  });

  if (total && _termAchadoAtual >= total) _termAchadoAtual = total - 1;
  const achados = el.querySelectorAll('.term-achado');
  if (achados[_termAchadoAtual]) achados[_termAchadoAtual].classList.add('atual');
  _termAtualizarContadorBusca(total);
}

function _termAtualizarContadorBusca(total) {
  const c = document.getElementById('term-busca-contador');
  if (!c) return;
  if (!_termBusca.trim()) { c.textContent = ''; return; }
  c.textContent = total ? `${_termAchadoAtual + 1}/${total}` : '0/0';
}

function _termPularOcorrencia(delta) {
  const el = document.getElementById('terminal-output');
  const total = el.querySelectorAll('.term-achado').length;
  if (!total) return;
  _termAchadoAtual = (_termAchadoAtual + delta + total) % total;
  _renderTerminalOutput();
  const atual = el.querySelector('.term-achado.atual');
  if (atual) atual.scrollIntoView({ block: 'nearest' });
}

// ── Copiar tudo ────────────────────────────────────────────────────────────

// Copia a sub-aba **ativa**: quem está em "Erros" quer o erro, não o log inteiro.
function copiarSaidaTerminal() {
  const texto = _termTextoDaSubAba(_termSubAba);
  if (!texto) return;
  navigator.clipboard.writeText(texto);
  showToast('Copiado!');
}

// ── Explicar erro (sem LLM — montagem de prompt determinística) ────────────

// Abre e fecha. Antes só abria: quem clicasse para dar uma olhada ficava com o
// prompt aberto pelo resto da execução, empurrando a saída para cima.
function alternarExplicacao() {
  const area = document.getElementById('terminal-explain-area');
  if (area.classList.contains('hidden')) return explainError();
  area.classList.add('hidden');
  _termRotuloExplicar(false);
}

function _termRotuloExplicar(aberto) {
  const btn = document.getElementById('btn-explain-error');
  if (btn) btn.textContent = aberto ? '🔎 Ocultar explicação' : '🔎 Explicar este erro';
}

async function explainError() {
  if (!_termUltimoResultado) return;
  const { comando, exit_code } = _termUltimoResultado;
  const stdout = _termLinhasDoCanal('out').join('\n');
  const stderr = _termLinhasDoCanal('err').join('\n');
  const r = await window.pywebview.api.explain_error(currentProject, comando, stdout, stderr, exit_code);
  const area = document.getElementById('terminal-explain-area');
  const pre = document.getElementById('terminal-explain-prompt');
  if (!r.success) {
    showToast('Não foi possível montar a explicação.', true);
    return;
  }
  pre.textContent = r.prompt;
  area.classList.remove('hidden');
  _termRotuloExplicar(true);
}
