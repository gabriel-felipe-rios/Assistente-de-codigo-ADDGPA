// ── Análise → Duplicados ─────────────────────────────────────────────────────
// Lista os pares de funções mais parecidas. Backend: get_duplicados.
//
// ⚠️ Esta tela SÓ LÊ. Ela chamava `run_duplicados_agent` antes de cada leitura,
// e por isso abrir a aba custava a rodada inteira — que na época levava
// minutos. Quem atualiza o índice é o ciclo de Acionamentos, ou o botão do card
// na sub-aba Rotinas, como acontece com todas as outras rotinas.

let _dupBound = false;
// De que projeto é a lista que está na tela. Ver `initDuplicadosTab`.
let _dupProjeto = null;

function initDuplicadosTab() {
  if (!_dupBound) {
    _dupBound = true;
    const btn = document.getElementById('btn-run-duplicados');
    if (btn) btn.addEventListener('click', runDuplicados);
  }
  // ⚠️ A LISTA NÃO ATRAVESSA A TROCA DE PROJETO. Esta tela só desenha quando o
  // usuário clica em "Comparar", então nada a repintava ao entrar noutro
  // projeto: os pares do projeto anterior ficavam ali, com os caminhos dele,
  // como se fossem deste. Só se apaga — comparar de novo é o gesto do usuário,
  // e ele custa caro para acontecer sozinho.
  if (_dupProjeto === currentProject) return;
  _dupProjeto = currentProject;
  const lista = document.getElementById('dup-list');
  const status = document.getElementById('dup-status');
  // De volta ao convite que o template desenha (`analise-template.js`), e não
  // ao vazio: uma área em branco não diz que ainda falta clicar em Comparar.
  if (lista) {
    lista.innerHTML = '<div class="tree-loading" style="padding:16px 14px">'
      + 'Clique em <strong>Comparar</strong> para ver os pares duplicados do último índice.</div>';
  }
  if (status) status.textContent = '';
}

async function runDuplicados() {
  const btn    = document.getElementById('btn-run-duplicados');
  const status = document.getElementById('dup-status');
  const list   = document.getElementById('dup-list');
  const thr    = parseFloat(document.getElementById('dup-threshold').value) || 0.85;

  btn.disabled = true; btn.textContent = '⏳ Comparando...';
  status.textContent = '';
  list.innerHTML = '<div class="tree-loading" style="padding:16px 14px">Comparando as funções já indexadas...</div>';

  try {
    const r = await window.pywebview.api.get_duplicados(currentProject, thr);
    if (!r.success) {
      list.innerHTML = `<div class="tree-error" style="padding:12px 14px">${escapeHtml(r.error || 'Falha ao comparar.')}</div>`;
      return;
    }
    dupRender(r);
  } catch (e) {
    list.innerHTML = `<div class="tree-error" style="padding:12px 14px">${escapeHtml(String(e))}</div>`;
  } finally {
    btn.disabled = false; btn.textContent = '▶ Comparar';
  }
}

function dupRender(r) {
  const status = document.getElementById('dup-status');
  const list   = document.getElementById('dup-list');
  const pares  = r.pares || [];

  status.textContent = `${r.total_simbolos || 0} funções indexadas · ${pares.length} par(es) acima de ${Math.round((r.threshold || 0) * 100)}%`;

  if (pares.length === 0) {
    // O "ou rode a rotina" não é enfeite: com o índice vazio (projeto novo, ou
    // rotina desligada) o resultado é o mesmo zero de "não há duplicado
    // nenhum", e sem esta frase os dois casos ficam indistinguíveis.
    const vazio = !r.total_simbolos
      ? 'Nenhuma função indexada ainda. Rode a rotina <b>Duplicados</b> na aba Automação › Rotinas.'
      : 'Nenhum par acima do limiar. Tente uma similaridade menor.';
    list.innerHTML = `<div class="tree-loading" style="padding:16px 14px">${vazio}</div>`;
    return;
  }

  list.innerHTML = pares.map(p => {
    const pct = Math.round(p.score * 100);
    return `
      <div class="dup-group">
        <div class="dup-simi">${pct}% igual</div>
        <div class="dup-side">${dupSideHtml(p.a)}</div>
        <div class="dup-vs">≈</div>
        <div class="dup-side">${dupSideHtml(p.b)}</div>
      </div>`;
  }).join('');
}

function dupSideHtml(m) {
  const tipo = m.tipo ? `<span class="dup-tipo">${escapeHtml(m.tipo)}</span> ` : '';
  const loc  = `${escapeHtml(m.file || '')}:${m.line || '?'}`;
  const exc  = m.excerpt ? `<pre class="dup-excerpt">${escapeHtml(m.excerpt)}</pre>` : '';
  return `<div class="dup-name">${tipo}<code>${escapeHtml(m.nome || '(anônimo)')}</code></div>
          <div class="dup-loc">${loc}</div>${exc}`;
}
