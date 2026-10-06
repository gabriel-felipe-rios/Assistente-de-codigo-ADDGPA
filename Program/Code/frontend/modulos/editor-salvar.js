// ═══════════════════════════ EDITOR: SALVAR E O HISTÓRICO LOCAL ══
// O Ctrl+S, o que acontece quando o disco mudou por baixo, e o painel que
// mostra o que estava no arquivo antes dos saves anteriores.
//
// ⚠️ O CONFLITO NÃO É PARANOIA. Neste programa a Fila, o Chat e as rotinas
// escrevem nos mesmos arquivos do usuário. Abrir `app.js` no Editor, deixar a
// aba aberta, mandar a Fila trabalhar e voltar para dar Ctrl+S sobrescreveria o
// trabalho dela sem uma linha de aviso. Por isso a gravação leva o hash de
// quando o arquivo foi lido, e o backend recusa se o disco divergiu.
//
// O Ctrl+S grava direto, sem criar Versão nos Backups — decisão do usuário. A
// rede é o Histórico local: a cópia do conteúdo ANTERIOR sai antes de o arquivo
// ser tocado, e a poda segue o que estiver em `Editor/Configuração.json`.

/**
 * Põe na TELA o texto que foi de fato para o disco.
 *
 * ⚠️ SEM ISTO, A GUARDIÃ QUE REESCREVE CORROMPE A ABA EM SILÊNCIO. O disco
 * recebe o texto formatado, mas `confirmarGravacao` faz
 * `atual.conteudo = superficie.texto` — o texto da TELA, que ainda é o
 * antigo. A aba fica marcada como limpa mostrando um conteúdo que não é o do
 * arquivo, e o próximo Ctrl+S responde "Nada mudou para salvar". O usuário
 * não teria como perceber até fechar e reabrir.
 *
 * Só roda quando a extensão REALMENTE mudou o texto: `abrir()` reposiciona o
 * cursor, e fazer isso a cada Ctrl+S de quem não usa extensão nenhuma seria
 * cobrar de todo mundo o preço de um recurso que quase ninguém liga.
 *
 * Mesmo caminho de `recarregarDoDisco` — invalidar, abrir, repintar —, e não
 * um atalho: sem `invalidarSuperficie`, voltar a esta aba mostraria o texto
 * velho de novo.
 */
async function _edAdotarTextoDaExtensao(painel, arq, texto) {
  painel.invalidarSuperficie();
  painel.superficie.abrir(texto);
  await painel.pintura.abrir(arq.linguagem);
}

// eslint-disable-next-line no-unused-vars
async function salvarArquivoDoPainel(painel) {
  const arq = painel.atual;
  if (!arq) return;
  if (arq.somenteLeitura) {
    showToast('Este arquivo está aberto só para leitura.', true);
    return;
  }
  if (!arq.sujo) { showToast('Nada mudou para salvar.'); return; }

  let texto = painel.superficie.texto;

  // ── M4 · o barramento de eventos ──
  // ⚠️ ESTE É O ÚNICO LUGAR DO PROGRAMA ONDE UMA EXTENSÃO PODE IMPEDIR UMA
  // AÇÃO DO USUÁRIO. Três coisas o tornam seguro, e nenhuma é dispensável:
  //   - `xtEmitir` não existir (camada não carregada) não pode quebrar o
  //     Ctrl+S — daí o `typeof`;
  //   - a guardiã tem teto de tempo (1,5 s em `extensoes/eventos.js`). Quem
  //     não responde é ignorado, e o arquivo grava;
  //   - guardiã que LANÇA não barra. Barrar por engano é pior que não barrar:
  //     o usuário perderia o que digitou por causa do bug de um terceiro.
  //
  // A guardiã pode devolver outro `texto` — é o que faz "formatar ao salvar".
  // Por isso `texto` é `let`, e por isso o que vai ao disco é o que voltou
  // daqui, e não o que estava na superfície.
  let reescritoPorExtensao = false;
  if (typeof xtEmitir === 'function') {
    const aviso = await xtEmitir('editor.vai_salvar',
      { projeto: currentProject, arquivo: arq.caminho, texto });
    if (aviso.barrado) { showToast(aviso.por ? `${aviso.por}: ${aviso.motivo}` : aviso.motivo, true); return; }
    if (typeof aviso.dado.texto === 'string' && aviso.dado.texto !== texto) {
      texto = aviso.dado.texto;
      reescritoPorExtensao = true;
    }
  }

  const r = await window.pywebview.api.editor_gravar_arquivo(
    currentProject, arq.caminho, texto, arq.hashDisco, arq.fimDeLinha, arq.bom, false);

  if (r.success) {
    // ANTES do `confirmarGravacao`, sempre: é ele que copia a tela para
    // `atual.conteudo`, e a tela precisa já estar com o texto certo.
    if (reescritoPorExtensao) await _edAdotarTextoDaExtensao(painel, arq, texto);
    painel.confirmarGravacao(r.hash);
    painel.faixa();
    showToast('Salvo.');
    // Observador, e depois de tudo: o programa não espera por ele, e ele não
    // tem o que barrar no que já foi gravado.
    if (typeof xtEmitir === 'function') {
      xtEmitir('editor.salvou',
        { projeto: currentProject, arquivo: arq.caminho, texto });
    }
    return;
  }

  if (r.motivo === 'mudou_no_disco') {
    // Não pergunta com um `confirm` de uma linha: a escolha errada aqui apaga
    // o trabalho de outra parte do programa. A faixa fica na tela, com as duas
    // saídas nomeadas pelo que elas fazem, até o usuário decidir.
    painel.faixa(
      'Este arquivo mudou no disco depois que você o abriu — outra parte do programa '
      + '(a Fila, o Chat ou uma rotina) escreveu nele.',
      'erro',
      { rotulo: 'Recarregar do disco', fazer: () => recarregarDoDisco(painel, arq) });
    // O segundo botão entra logo depois, no mesmo elemento da faixa: são duas
    // ações opostas e a faixa só aceita uma no construtor.
    const caixa = painel.elemento.querySelector('.ed-faixa');
    const forcar = document.createElement('button');
    forcar.className = 'btn btn-negative btn-sm';
    forcar.textContent = 'Sobrescrever mesmo assim';
    forcar.addEventListener('click', async () => {
      const f = await window.pywebview.api.editor_gravar_arquivo(
        currentProject, arq.caminho, texto, arq.hashDisco, arq.fimDeLinha, arq.bom, true);
      if (!f.success) { showToast(f.error || 'Não deu para salvar.', true); return; }
      // O mesmo pelo caminho do "Sobrescrever": este botão grava o `texto` do
      // fecho, que também já passou pela guardiã.
      if (reescritoPorExtensao) await _edAdotarTextoDaExtensao(painel, arq, texto);
      painel.confirmarGravacao(f.hash);
      painel.faixa();
      showToast('Salvo por cima da versão do disco.');
    });
    caixa.appendChild(forcar);
    return;
  }
  showToast(r.error || 'Não deu para salvar.', true);
}

async function recarregarDoDisco(painel, arq) {
  const r = await window.pywebview.api.editor_ler_arquivo(currentProject, arq.caminho);
  if (!r.success) { showToast(r.error, true); return; }
  arq.conteudo = r.conteudo;
  arq.hashDisco = r.hash;
  arq.rascunho = undefined;
  arq.sujo = false;
  painel.invalidarSuperficie();
  painel.superficie.abrir(r.conteudo);
  await painel.pintura.abrir(r.linguagem);
  painel.faixa();
  showToast('Recarregado. O que você tinha digitado foi descartado.');
}

// ── Diff visual contra o histórico (Obra 14) ─────────────────────────────────
// LCS ingênuo (programação dinâmica O(linhas × linhas)) — de sobra para
// arquivo de código, que raramente passa de poucos milhares de linhas (o
// próprio editor já tem teto de 3000 linhas para colorir, editor-pintura.js).
// Acima do teto abaixo, cai para "tudo trocado": ainda correto, só sem o
// detalhe linha a linha — nenhuma biblioteca externa de diff.
const _ED_HIST_DIFF_TETO_CELULAS = 4_000_000;

function _edHistDiffLinhas(a, b) {
  const n = a.length;
  const m = b.length;
  if (n * m > _ED_HIST_DIFF_TETO_CELULAS) {
    return [...a.map((texto) => ({ tipo: 'del', texto })), ...b.map((texto) => ({ tipo: 'add', texto }))];
  }
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const resultado = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { resultado.push({ tipo: 'igual', texto: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { resultado.push({ tipo: 'del', texto: a[i] }); i++; }
    else { resultado.push({ tipo: 'add', texto: b[j] }); j++; }
  }
  while (i < n) { resultado.push({ tipo: 'del', texto: a[i] }); i++; }
  while (j < m) { resultado.push({ tipo: 'add', texto: b[j] }); j++; }
  return resultado;
}

// Mostra só o que mudou (mais 2 linhas de contexto de cada lado), não o
// arquivo inteiro igual repetido — um arquivo com uma linha alterada não
// precisa de mil linhas "iguais" na tela.
function _edHistMontarDiffHtml(linhas) {
  const TETO = 600;
  const visivel = [];
  linhas.forEach((l, i) => {
    if (l.tipo !== 'igual') { visivel.push(i); return; }
    const pertoDeMudanca = [-2, -1, 1, 2].some((d) => linhas[i + d] && linhas[i + d].tipo !== 'igual');
    if (pertoDeMudanca) visivel.push(i);
  });
  if (!visivel.length) return '<div class="ed-vazio">Sem diferenças — idêntico ao conteúdo atual na tela.</div>';

  let html = '';
  let ultimo = -2;
  let contador = 0;
  for (const i of visivel) {
    if (contador >= TETO) { html += '<div class="ed-vazio">… diferença grande demais, mostrando só o início.</div>'; break; }
    if (i > ultimo + 1) html += '<div class="ed-hist-diff-salto">⋯</div>';
    const l = linhas[i];
    const marca = l.tipo === 'add' ? '+' : l.tipo === 'del' ? '-' : '';
    html += `<div class="ed-hist-diff-linha ed-hist-diff--${l.tipo}">`
      + `<span class="ed-hist-diff-marca">${marca}</span>`
      + `<span class="ed-hist-diff-texto">${escapeHtml(l.texto) || '&nbsp;'}</span></div>`;
    ultimo = i;
    contador++;
  }
  return html;
}

async function _edHistMostrarDiff(painel, arq, escolhida, container) {
  container.innerHTML = '<div class="ed-vazio">Comparando…</div>';
  const c = await window.pywebview.api.editor_ler_entrada_do_historico(
    currentProject, arq.caminho, escolhida.arquivo);
  if (!c.success) { container.innerHTML = `<div class="ed-vazio">${escapeHtml(c.error)}</div>`; return; }
  const linhas = _edHistDiffLinhas(c.conteudo.split('\n'), painel.superficie.texto.split('\n'));
  container.innerHTML = _edHistMontarDiffHtml(linhas);
}

// ── O painel do Histórico local ──────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
async function abrirHistoricoLocal(painel, corpo) {
  const arq = painel.atual;
  if (!arq) return;
  const r = await window.pywebview.api.editor_listar_historico(currentProject, arq.caminho);
  if (!r.success) { showToast(r.error, true); return; }

  const caixa = document.createElement('div');
  caixa.className = 'ed-hist';
  // A explicação fica NA TELA, e não só no tooltip: "Histórico local" não diz
  // sozinho o que a lista contém nem em que ele difere do Ctrl+Z e das Versões
  // dos Backups — e sem isso a tela é uma lista de datas sem sentido.
  caixa.innerHTML = `
    <div class="ed-toolbar">
      <div class="ed-caminho"><b>Histórico local</b> &nbsp;·&nbsp; ${escapeHtml(arq.caminho)}</div>
      <div class="ed-acoes">
        <button class="btn btn-primary btn-sm" data-h="restaurar" disabled>Carregar no editor</button>
        <button class="btn-icon" data-h="fechar" title="Fechar">✕</button>
      </div>
    </div>
    <div class="ed-hist-ajuda">
      Cada linha é <b>como este arquivo estava antes de um Ctrl+S</b> — o programa guarda
      uma cópia a cada vez que você salva. Escolha uma e clique em
      <b>Carregar no editor</b>: o conteúdo volta para a tela sem gravar nada, e você
      decide se salva. Não confundir com o <b>Ctrl+Z</b> (que desfaz o que você digitou
      agora e some ao fechar o arquivo) nem com as <b>Versões</b> da aba Backups
      (que são o projeto inteiro).
    </div>
    <div class="ed-hist-lista"></div>
    <div class="ed-hist-diff"></div>`;
  const lista = caixa.querySelector('.ed-hist-lista');
  const diffBox = caixa.querySelector('.ed-hist-diff');
  const btnRestaurar = caixa.querySelector('[data-h="restaurar"]');

  if (!r.entradas.length) {
    lista.innerHTML = '<div class="ed-vazio">Nada guardado ainda — a primeira cópia aparece aqui depois do seu primeiro Ctrl+S neste arquivo.</div>';
  } else {
    lista.innerHTML = r.entradas.map((e, i) => `
      <div class="ed-hist-item" data-i="${i}">
        <span class="ed-hist-quando">${escapeHtml(e.quando.replace('T', ' às '))}</span>
        <span class="ed-hist-bytes">${Math.max(1, Math.round(e.bytes / 1024))} KB</span>
      </div>`).join('');
  }

  let escolhida = null;
  lista.querySelectorAll('.ed-hist-item').forEach((el) => {
    el.addEventListener('click', () => {
      lista.querySelectorAll('.ed-hist-item').forEach((x) => x.classList.remove('active'));
      el.classList.add('active');
      escolhida = r.entradas[+el.dataset.i];
      btnRestaurar.disabled = false;
      _edHistMostrarDiff(painel, arq, escolhida, diffBox);
    });
  });

  btnRestaurar.addEventListener('click', async () => {
    if (!escolhida) return;
    const c = await window.pywebview.api.editor_ler_entrada_do_historico(
      currentProject, arq.caminho, escolhida.arquivo);
    if (!c.success) { showToast(c.error, true); return; }
    // Restaurar NÃO grava sozinho: põe o texto no editor e deixa sujo. Assim o
    // Ctrl+S que vier a seguir passa pelo mesmo caminho de sempre — inclusive
    // guardando no histórico o que estava lá agora, que é o que permite
    // desfazer a própria restauração.
    painel.invalidarSuperficie();
    painel.superficie.abrir(c.conteudo);
    await painel.pintura.abrir(arq.linguagem);
    caixa.remove();
    showToast('Versão carregada no editor. Dê Ctrl+S para gravar.');
  });
  caixa.querySelector('[data-h="fechar"]').addEventListener('click', () => caixa.remove());
  corpo.appendChild(caixa);
}
