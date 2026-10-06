// ══════════════════════════════════════════════════════════════ UTILITÁRIOS ══

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// A porta única das notificações. Continua com o mesmo nome e a mesma
// assinatura de sempre: as ~170 chamadas espalhadas pelo programa não mudaram
// uma linha.
//
// ⚠️ A ORIGEM NÃO É PASSADA por elas — é descoberta pelo arquivo que chamou,
// lendo o stack. Ver `notificacoes.js`. Os helpers genéricos DESTE arquivo,
// chamados de várias abas, também não precisam passar nada: `utils.js` está na
// lista de ignorados de lá, então a varredura desce até o chamador de verdade.
// O terceiro parâmetro é a saída para o caso raro em que nem isso resolve.
//
// O `typeof` no filtro não é cerimônia: sem `notificacoes.js` carregado, a
// notificação não pode sumir POR CAUSA do filtro — só deixa de ser filtrada.
function showToast(msg, isError = false, origem = null) {
  // ⚠️ MENSAGEM VAZIA NÃO VIRA CAIXA. O padrão `showToast(r.error, true)` está
  // espalhado pelo programa, e um backend que devolve `success: false` sem
  // preencher `error` — ou um `r` que voltou `undefined` da ponte — desenhava
  // um retângulo em branco que aparecia e sumia sozinho, sem uma palavra
  // dentro. Uma notificação sem texto não informa nada e assusta.
  if (msg === null || msg === undefined || !String(msg).trim()) {
    console.warn('[notificação] pedida sem texto — ignorada', { isError, origem });
    return;
  }
  if (typeof notificacaoPermitida === 'function') {
    const de = origem || (typeof descobrirOrigemDaNotificacao === 'function'
                          ? descobrirOrigemDaNotificacao()
                          : null);
    if (!notificacaoPermitida(de, isError)) return;
  }
  pintarNotificacao(msg, isError);
}

function setError(elId, msg) {
  const el = document.getElementById(elId);
  if (msg) { el.textContent = msg; el.classList.remove('hidden'); }
  else el.classList.add('hidden');
}

// ══════════════════════════════════════════════════════ MARKDOWN SIMPLES ══
function renderMarkdown(text) {
  if (!text) return '';

  const codeBlocks = [];
  let processed = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
    return `\x00CODEBLOCK${codeBlocks.length - 1}\x00`;
  });

  processed = escapeHtml(processed);
  processed = processed.replace(/`([^`]+)`/g,         '<code>$1</code>');
  processed = processed.replace(/\*\*([^*]+)\*\*/g,   '<strong>$1</strong>');
  processed = processed.replace(/\*([^*\n]+)\*/g,     '<em>$1</em>');
  processed = processed.replace(/\n/g,                '<br>');
  processed = processed.replace(/\x00CODEBLOCK(\d+)\x00/g, (_, i) => codeBlocks[+i]);

  return processed;
}

// ── Copiar, com o aviso DENTRO do próprio botão ─────────────────────────────
// A área de transferência não dá nenhum sinal de que recebeu algo: sem
// resposta visível, a pessoa clica de novo achando que falhou. Há dois jeitos
// no projeto, e ⚠️ quem escolhe entre eles é o FORMATO do botão, não o gosto de
// quem escreve — a regra saiu do que já existia, e está registrada em Padrões
// de interface › Componentes › Botões:
//
//   botão SÓ-ÍCONE  → `copiarPeloBotao` (aqui). O ✓ entra no corpo do botão,
//     porque não há mais nada ali para responder. É o caso de um por balão de
//     conversa: um toast por clique viraria fila de avisos empilhados, e o
//     aviso deixaria de dizer QUAL deles copiou.
//   botão COM RÓTULO → `copiarContexto` (copiar-contexto.js). Toast. Trocar
//     "📋 Copiar" por um "✓" encolheria o botão no meio da linha — o defeito
//     que o botão Enviar do Chat já teve uma vez.
//
// O nome segue `rodar_*_pelo_card` do backend: "pelo botão" é quem dá o
// retorno, não o que é copiado.
//
// ⚠️ `navigator.clipboard` FALHA calada em alguns contextos do WebView2 (janela
// sem foco, principalmente). O `execCommand` de reserva é feio e está morrendo,
// mas é o que faz o botão funcionar quando o caminho novo não funciona — o
// `btn-copy-payload` já dependia dele, e a lição vem de lá.
function copiarPeloBotao(botao, texto, rotuloOriginal) {
  if (!botao || !texto) return;
  const antes = rotuloOriginal !== undefined ? rotuloOriginal : botao.textContent;
  const ok = () => {
    botao.textContent = '✓';
    botao.classList.add('copied');
    setTimeout(() => { botao.textContent = antes; botao.classList.remove('copied'); }, 1400);
  };
  const naMao = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      ok();
    } catch (e) {
      showToast('Não foi possível copiar — selecione o texto manualmente.', true);
    }
  };
  try {
    navigator.clipboard.writeText(texto).then(ok).catch(naMao);
  } catch (e) { naMao(); }
}

function copyCodeLines(linesElId, btnId) {
  const el  = document.getElementById(linesElId);
  const btn = document.getElementById(btnId);
  if (!el || !btn) return;
  const text = [...el.querySelectorAll('.ts-code-text')].map(s => s.textContent).join('\n');
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✓';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = '⎘'; btn.classList.remove('copied'); }, 1500);
  });
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ══════════════════════════════════════════ LISTAS DE PENDÊNCIA DOS AGENTES ══
// Um só renderizador para "Arquivos muito grandes", "Inalterados" e "Erros" —
// as três listas têm a mesma forma {file, path, reason} e o mesmo botão de
// abrir. Cada entrada é identificada pelo caminho, nunca pelo nome do arquivo:
// sete __init__.py no mesmo painel eram indistinguíveis.
function renderAgenteIssueList(elId, itens, vazioMsg) {
  const el = document.getElementById(elId);
  if (!el) return;
  itens = itens || [];
  if (!itens.length) {
    el.innerHTML = `<p class="agente-viewer-empty">${escapeHtml(vazioMsg)}</p>`;
    return;
  }
  el.innerHTML = itens.map(it => {
    const alvo = it.path || it.file || '';
    return '<div class="agente-issue-item">'
      + '<div class="agente-issue-texto">'
      + `<span class="agente-issue-file" title="${escapeHtml(alvo)}">${escapeHtml(it.file || '')}</span>`
      + `<span class="agente-issue-reason">${escapeHtml(it.reason || '')}</span>`
      + '</div>'
      + '<button class="btn btn-muted btn-sm agente-issue-abrir" type="button"'
      + ` data-abrir="${escapeHtml(alvo)}" title="Abrir no editor">Abrir</button>`
      + '</div>';
  }).join('');
  el.querySelectorAll('.agente-issue-abrir').forEach(btn => {
    btn.addEventListener('click', async () => {
      const r = await window.pywebview.api.aparencia_abrir_no_arquivo(
        currentProject, btn.dataset.abrir, 1);
      if (!r || !r.success) showToast((r && r.error) || 'Não foi possível abrir.', true);
    });
  });
}

// ═══════════════════════════════════════════ ROLAGEM QUE NÃO ATRAPALHA ══
// Descer até o fim SÓ quando o leitor já estava no fim.
//
// O padrão nasceu na conversa do Chat, onde o streaming descia sozinho e
// arrastava de volta quem tinha subido para reler. Vale igual para qualquer
// lista que cresce sozinha — o Log, a conversa da Fila, o contexto —, e é
// por isso que mora aqui em vez de estar copiado em cada uma.
//
// A marca fica no próprio elemento, não numa variável do módulo: há várias
// listas vivas ao mesmo tempo na tela, e cada uma tem a sua posição.
const ROLAGEM_MARGEM_FIM = 60;   // "no fim" na prática não é o pixel exato

function _rolagemNoFim(el) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < ROLAGEM_MARGEM_FIM;
}

function ligarRolagemAoFim(el) {
  if (!el || el._rolagemLigada) return;
  el._rolagemLigada = true;
  el._rolagemPresa = true;   // nasce acompanhando
  el.addEventListener('scroll', () => { el._rolagemPresa = _rolagemNoFim(el); },
                      { passive: true });
}

// Para conteúdo que chegou sozinho (log ao vivo, streaming, polling).
function rolarAoFimSePresa(el) {
  if (!el) return;
  ligarRolagemAoFim(el);
  if (el._rolagemPresa) el.scrollTop = el.scrollHeight;
}

// Para quando foi VOCÊ que agiu — mandou a mensagem, trocou de tarefa, abriu
// a aba. Aí a intenção é ver o que acabou de chegar, e a rolagem volta a
// acompanhar mesmo que estivesse solta.
function rolarAoFimAgora(el) {
  if (!el) return;
  ligarRolagemAoFim(el);
  el._rolagemPresa = true;
  el.scrollTop = el.scrollHeight;
}

// ── Expandir tudo / Retrair tudo, numa lista de <details> ───────────────────
// Serve o rodapé do Log do Chat e o da Fila. Os dois painéis são LISTA DE
// <details>, e não árvore de pastas: `ligarBotoesArvore` (arvore-pastas.js) não
// serve aqui — ele mexe num estado próprio da árvore, e o que existe no Log é o
// atributo `.open` de cada bloco. Nenhum outro lugar do programa mexia nele.
//
// "Tudo é tudo": todos os <details> do painel, sem distinção de nível. Um bloco
// de subagente pode ter outro dentro, e abrir só o de fora deixaria o gesto pela
// metade — quem clica em "Expandir tudo" quer ler a coisa inteira.
//
// ⚠️ O estado NÃO é guardado, e é de propósito: trocar de chat ou de tarefa
// volta tudo fechado. Um log de doze rodadas reaberto todo expandido é a parede
// de texto que o colapso existe para evitar, e ninguém pediu para lembrar disso
// entre conversas. Registrado aqui para não virar relatório de defeito depois.
function ligarBotoesDeDetalhes(painelId, idExpandir, idRetrair) {
  const painel = document.getElementById(painelId);
  const abrir  = document.getElementById(idExpandir);
  const fechar = document.getElementById(idRetrair);
  if (!painel || !abrir || !fechar) return;
  const todos = (aberto) => painel.querySelectorAll('details')
    .forEach(d => { d.open = aberto; });
  if (!abrir._wired)  { abrir._wired  = true; abrir.addEventListener('click',  () => todos(true)); }
  if (!fechar._wired) { fechar._wired = true; fechar.addEventListener('click', () => todos(false)); }
}

// Os dois botões só existem quando há o que expandir. Num log vazio eles seriam
// dois controles que não fazem nada — e o rodapé do Log já é estreito.
function atualizarBotoesDeDetalhes(painelId, barraId) {
  const painel = document.getElementById(painelId);
  const barra  = document.getElementById(barraId);
  if (!painel || !barra) return;
  barra.classList.toggle('hidden', !painel.querySelector('details'));
}
