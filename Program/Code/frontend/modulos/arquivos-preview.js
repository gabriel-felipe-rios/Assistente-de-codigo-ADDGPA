// ══════════════════════════════ ABA ARQUIVOS — Preview / expandir item ══
// Clicar num item expande (acordeão): itens comuns mostram a lista de arquivos
// e o conteúdo inline ao clicar; o MCP do programa mostra duas abas —
// Explicação (tabela das ferramentas) e Ativar/desativar (toggles por função).

function _isMcpPrograma(kind, item) {
  return _arqEhMcpDoPrograma(kind, item);
}

async function arqToggleExpand(card, kind, item, isProjeto) {
  const panel = card.querySelector('.import-expand');
  const caret = card.querySelector('.import-caret');
  if (!panel.classList.contains('hidden')) {
    panel.classList.add('hidden');
    panel.innerHTML = '';
    caret.classList.remove('open');
    return;
  }
  caret.classList.add('open');
  panel.classList.remove('hidden');
  panel.innerHTML = '<div class="arq-expand-loading">Carregando…</div>';
  // ⚠️ AGENTE ABRE O EDITOR, e não a lista de arquivos. É o mesmo gesto e o
  // mesmo painel — editar é INLINE no cartão, como os Padrões de interface deste
  // projeto mandam para lista de item configurável. Só na biblioteca global:
  // dentro de um projeto a aba liga e desliga, e editar de lá faria a mesma
  // biblioteca ser escrita de dois lugares.
  if (arqEhEditorDeAgente(kind, isProjeto)) {
    await arqEditorDeAgente(panel, item);
  } else if (_isMcpPrograma(kind, item)) {
    await _arqRenderMcp(panel, isProjeto, (item.name || '').toLowerCase());
  } else if (kind.key === 'mcps') {
    // MCP de TERCEIRO: a tela sai do `mcp.json` DELE, e não do catálogo do
    // programa. Os dois do programa nunca chegam aqui — o `else if` de cima
    // os pegou, e é assim que fica claro que os dois caminhos são separados.
    await _arqRenderMcpTerceiro(panel, kind, item, isProjeto);
  } else {
    await _arqRenderFileList(panel, kind, item);
  }
}

// ── Itens comuns: lista de arquivos com conteúdo inline (acordeão) ──────────
async function _arqRenderFileList(panel, kind, item) {
  const r = await window.pywebview.api.list_item_files(kind.key, item.name);
  if (!r.success) { panel.innerHTML = `<div class="arq-expand-empty">${escapeHtml(r.error || 'Erro.')}</div>`; return; }
  if (!r.files.length) { panel.innerHTML = '<div class="arq-expand-empty">Sem arquivos neste item.</div>'; return; }
  panel.innerHTML = '<div class="arq-file-list"></div>';
  const list = panel.querySelector('.arq-file-list');
  r.files.forEach(f => {
    const wrap = document.createElement('div');
    wrap.className = 'arq-file-item';
    wrap.innerHTML = `
      <div class="arq-file">
        <span class="arq-file-caret">▸</span>
        <span class="arq-file-ic">📄</span>
        <span class="arq-file-name">${escapeHtml(f)}</span>
      </div>
      <div class="arq-file-content hidden"></div>`;
    const head = wrap.querySelector('.arq-file');
    const content = wrap.querySelector('.arq-file-content');
    const fcaret = wrap.querySelector('.arq-file-caret');
    head.addEventListener('click', async () => {
      if (!content.classList.contains('hidden')) {
        content.classList.add('hidden'); content.innerHTML = ''; fcaret.classList.remove('open');
        return;
      }
      fcaret.classList.add('open');
      content.classList.remove('hidden');
      content.innerHTML = '<div class="arq-expand-loading">Carregando…</div>';
      const c = await window.pywebview.api.read_item_file(kind.key, item.name, f);
      if (!c.success) { content.innerHTML = `<div class="arq-expand-empty">${escapeHtml(c.error || 'Erro.')}</div>`; return; }
      content.innerHTML = f.toLowerCase().endsWith('.md')
        ? `<div class="arq-file-body md-body">${marked.parse(c.content)}</div>`
        : `<pre class="arq-file-body">${escapeHtml(c.content)}</pre>`;
    });
    list.appendChild(wrap);
  });
}

// ── MCP do programa: duas abas (Explicação / Ativar-desativar) ──────────────
// `servidor` ('assistente' ou 'trabalhos') filtra a tabela e os toggles para
// só as ferramentas DESTE item — sem isso os dois itens mostrariam as mesmas
// 27 ferramentas juntas, em vez de 19 num e 8 no outro (D18 do briefing).
async function _arqRenderMcp(panel, isProjeto, servidor) {
  panel.innerHTML = `
    <div class="arq-mcp-tabs">
      <button type="button" class="arq-mcp-tab active" data-mtab="explica">Explicação</button>
      <button type="button" class="arq-mcp-tab" data-mtab="toggles">Ativar / desativar</button>
    </div>
    <div class="arq-mcp-pane" data-mpane="explica"></div>
    <div class="arq-mcp-pane hidden" data-mpane="toggles"></div>`;
  // O catálogo vem do backend (`catalogo_ferramentas_mcp`), nunca de uma cópia
  // aqui: acrescentar uma ferramenta ao `catalogo_mcp.py` tem que bastar para
  // ela aparecer nas duas abas, e era esta cópia que produzia a linha errada.
  const cat = await window.pywebview.api.catalogo_ferramentas_mcp(servidor);
  const ferramentas = (cat && cat.success) ? cat.ferramentas : [];
  const familias = (cat && cat.success) ? cat.familias : {};
  _arqFillExplica(panel.querySelector('[data-mpane="explica"]'), ferramentas, familias);
  await _arqFillToggles(panel.querySelector('[data-mpane="toggles"]'), isProjeto, ferramentas);
  panel.querySelectorAll('.arq-mcp-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.arq-mcp-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const t = btn.dataset.mtab;
      panel.querySelectorAll('.arq-mcp-pane').forEach(p => p.classList.toggle('hidden', p.dataset.mpane !== t));
    });
  });
}

function _arqFillExplica(pane, ferramentas, familias) {
  const linhas = ferramentas.map(fn => `
    <tr>
      <td class="mcp-td-cmd"><span class="arq-fn-dot ${fn.layer}"></span>${fn.name}</td>
      <td>${escapeHtml(fn.retorna)}</td>
      <td>${escapeHtml(fn.usar)}</td>
      <td>${escapeHtml(fn.base)}</td>
      <td>${escapeHtml(fn.nao)}</td>
    </tr>`).join('');
  // A legenda também sai do catálogo: uma família nova aparece aqui sozinha,
  // em vez de ficar como bolinha sem nome porque ninguém lembrou da legenda.
  const legenda = Object.keys(familias).map(id =>
    `<span><span class="arq-fn-dot ${id}"></span>${escapeHtml(familias[id])}</span>`).join('');
  pane.innerHTML = `
    <div class="arq-mcp-legend">
      ${legenda}
      <span class="arq-mcp-legend-note">Este MCP serve o <b>assistente externo</b> (não o chat interno do app).</span>
    </div>
    <div class="arq-mcp-table-wrap">
      <table class="arq-mcp-table">
        <thead><tr><th>Comando</th><th>Retorna</th><th>Quando o assistente usa</th><th>Base</th><th>Quando NÃO usar</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>`;
}

async function _arqFillToggles(pane, isProjeto, ferramentas) {
  if (!isProjeto) {
    pane.innerHTML = '<div class="arq-expand-empty">Abra dentro de um projeto para ligar/desligar cada função.</div>';
    return;
  }
  const r = await window.pywebview.api.get_mcp_functions(currentProject);
  const state = (r && r.success) ? r.functions : {};
  pane.innerHTML = '<div class="arq-mcp-fns"></div>';
  const wrap = pane.querySelector('.arq-mcp-fns');
  ferramentas.forEach(fn => {
    const on = state[fn.name] !== false;
    const row = document.createElement('div');
    row.className = 'arq-mcp-fn';
    row.innerHTML = `
      <span class="arq-fn-dot ${fn.layer}"></span>
      <span class="arq-fn-main">
        <span class="arq-fn-name">${fn.name}</span>
        <span class="arq-fn-desc">${escapeHtml(fn.retorna)}</span>
      </span>
      <label class="toggle-pill">
        <div class="toggle-track${on ? ' on' : ''}"><div class="toggle-knob"></div></div>
        <span class="toggle-label${on ? ' on' : ''}">${on ? 'Ativo' : 'Inativo'}</span>
      </label>`;
    const track = row.querySelector('.toggle-track');
    const label = row.querySelector('.toggle-label');
    row.querySelector('.toggle-pill').addEventListener('click', async (e) => {
      e.stopPropagation();
      const next = !track.classList.contains('on');
      const rr = await window.pywebview.api.set_mcp_function(currentProject, fn.name, next);
      if (!rr || !rr.success) { showToast((rr && rr.error) || 'Erro ao alternar.', true); return; }
      track.classList.toggle('on', next);
      label.classList.toggle('on', next);
      label.textContent = next ? 'Ativo' : 'Inativo';
    });
    wrap.appendChild(row);
  });
}


// ── MCP de terceiro: a tela é GERADA A PARTIR DO MANIFESTO ─────────────────
//
// ⚠️ **A tela de configuração é OPCIONAL, e ausência é o normal.** A maioria
// dos MCPs de internet só liga e desliga: um item sem o bloco `configuracao`
// no `mcp.json` mostra a ficha e a lista de arquivos, sem erro e sem uma
// palavra sugerindo que falta alguma coisa.
//
// ⚠️ **AS CAIXINHAS DE FERRAMENTA SÓ APARECEM SE O SERVIDOR SOUBER RECEBER A
// LISTA.** Um servidor que declara as ferramentas mas não declara como recebe
// as ligadas mostra a lista SEM as caixinhas — e isso é a resposta certa, não
// uma limitação a contornar. O `--enabled` é invenção deste programa, não do
// protocolo MCP: mandá-lo a um servidor de fora mata o processo no argumento
// desconhecido, e o sintoma é um MCP que some da sessão sem erro nenhum.
async function _arqRenderMcpTerceiro(panel, kind, item, isProjeto) {
  const m = await window.pywebview.api.mcp_manifesto(item.name);
  if (!m || !m.success) {
    // Pasta sem `mcp.json` não é acidente de leitura: é uma pasta que ainda
    // não é um MCP. A mensagem do backend já diz isso e aponta o "Como
    // adicionar" — repetir aqui uma frase genérica esconderia a explicação.
    panel.innerHTML = `<div class="arq-expand-empty">${escapeHtml((m && m.error) || 'Erro.')}</div>`;
    return;
  }

  const TIPOS = {
    local:   'Local — o código do servidor está nesta pasta e vai junto na cópia.',
    comando: 'Comando — a pasta só tem o manifesto; o servidor é baixado na hora pelo comando declarado.',
    remoto:  'Remoto — nenhum código local: o assistente fala com um endereço.',
  };

  const ficha = `
    <div class="arq-mcp-legend">
      <span><b>Tipo:</b> ${escapeHtml(TIPOS[m.tipo] || m.tipo || '—')}</span>
      <span><b>Chave no registro:</b> <code>${escapeHtml(m.chave || '')}</code></span>
      <span class="arq-mcp-legend-note">Ligar <b>copia esta pasta</b> para dentro do projeto e escreve o apontador. Desligar tira o apontador <b>e apaga a cópia</b>.</span>
    </div>`;

  panel.innerHTML = `
    <div class="arq-mcp-tabs">
      <button type="button" class="arq-mcp-tab active" data-mtab="explica">Explicação</button>
      ${m.tem_configuracao ? '<button type="button" class="arq-mcp-tab" data-mtab="config">Configuração</button>' : ''}
      <button type="button" class="arq-mcp-tab" data-mtab="arquivos">Arquivos</button>
    </div>
    <div class="arq-mcp-pane" data-mpane="explica">${ficha}</div>
    ${m.tem_configuracao ? '<div class="arq-mcp-pane hidden" data-mpane="config"></div>' : ''}
    <div class="arq-mcp-pane hidden" data-mpane="arquivos"></div>`;

  if (m.tem_configuracao) {
    await _arqMcpTerceiroConfig(panel.querySelector('[data-mpane="config"]'),
                                item, m, isProjeto);
  }
  await _arqRenderFileList(panel.querySelector('[data-mpane="arquivos"]'), kind, item);

  panel.querySelectorAll('.arq-mcp-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.arq-mcp-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const t = btn.dataset.mtab;
      panel.querySelectorAll('.arq-mcp-pane').forEach(p => p.classList.toggle('hidden', p.dataset.mpane !== t));
    });
  });
}

// A aba Configuração: os campos declarados no manifesto e as ferramentas.
// ⚠️ Tudo aqui é POR PROJETO — no projeto B você marca uns, no projeto C
// outros. É a mesma escolha que `mcp_functions` já fazia para os dois do
// programa, e pelo mesmo motivo. Fora de um projeto não há onde gravar.
async function _arqMcpTerceiroConfig(pane, item, m, isProjeto) {
  if (!isProjeto) {
    pane.innerHTML = '<div class="arq-expand-empty">Abra dentro de um projeto para configurar este MCP.</div>';
    return;
  }
  const atual = await window.pywebview.api.get_mcp_terceiro_config(currentProject, item.name);
  const valores = (atual && atual.success) ? atual.valores : {};
  const ligadas = (atual && atual.success) ? atual.ferramentas : {};

  pane.innerHTML = '<div class="arq-mcp-fns"></div>';
  const wrap = pane.querySelector('.arq-mcp-fns');

  (m.campos || []).forEach(campo => wrap.appendChild(
    _arqMcpCampo(item, campo, valores[campo.chave])));

  if ((m.ferramentas || []).length) {
    const cab = document.createElement('div');
    cab.className = 'arq-mcp-legend';
    cab.innerHTML = m.pode_marcar_ferramentas
      ? `<span>As ${m.ferramentas.length} ferramentas deste servidor. Desmarcar uma a tira da próxima sessão do assistente.</span>`
      : '<span class="arq-mcp-legend-note">Este servidor declara as ferramentas, mas <b>não declara como recebe a lista das ligadas</b> — então elas só podem ser vistas, não marcadas. Ligar e desligar aqui não teria para onde ir: o servidor não saberia o que fazer com a lista.</span>';
    wrap.appendChild(cab);
  }

  (m.ferramentas || []).forEach(fn => {
    const on = ligadas[fn.nome] !== false;
    const row = document.createElement('div');
    row.className = 'arq-mcp-fn';
    row.innerHTML = `
      <span class="arq-fn-main">
        <span class="arq-fn-name">${escapeHtml(fn.nome)}</span>
        <span class="arq-fn-desc">${escapeHtml(fn.descricao || '')}</span>
      </span>
      ${m.pode_marcar_ferramentas ? `
      <label class="toggle-pill">
        <div class="toggle-track${on ? ' on' : ''}"><div class="toggle-knob"></div></div>
        <span class="toggle-label${on ? ' on' : ''}">${on ? 'Ativo' : 'Inativo'}</span>
      </label>` : ''}`;
    const pill = row.querySelector('.toggle-pill');
    if (pill) {
      const track = row.querySelector('.toggle-track');
      const label = row.querySelector('.toggle-label');
      pill.addEventListener('click', async (e) => {
        e.stopPropagation();
        const next = !track.classList.contains('on');
        const rr = await window.pywebview.api.set_mcp_terceiro_ferramenta(
          currentProject, item.name, fn.nome, next);
        if (!rr || !rr.success) { showToast((rr && rr.error) || 'Erro ao alternar.', true); return; }
        track.classList.toggle('on', next);
        label.classList.toggle('on', next);
        label.textContent = next ? 'Ativo' : 'Inativo';
      });
    }
    wrap.appendChild(row);
  });
}

// Um campo declarado no manifesto. Os cinco tipos saem do mesmo mecanismo —
// não há `if` por nome de MCP em lugar nenhum, e é isso que faz o próximo MCP
// declarar um campo e ele aparecer sozinho.
function _arqMcpCampo(item, campo, valor) {
  const div = document.createElement('div');
  div.className = 'config-field-row';
  const id = `arq-mcp-campo-${_arqMcpIdSeguro(item.name)}-${_arqMcpIdSeguro(campo.chave)}`;
  const opcoes = campo.opcoes || [];
  let controle = '';

  if (campo.tipo === 'marcar') {
    controle = `<label class="arq-mcp-check"><input type="checkbox" id="${id}" ${valor ? 'checked' : ''}/> ${escapeHtml(campo.rotulo)}</label>`;
  } else if (campo.tipo === 'escolher') {
    controle = `<select id="${id}">${opcoes.map(o =>
      `<option value="${escapeHtml(o)}" ${String(valor) === String(o) ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}</select>`;
  } else if (campo.tipo === 'varios') {
    const marcados = new Set((valor || []).map(String));
    // Lista VAZIA não é o mesmo que "todos": para o campo que diz quais
    // projetos podem ser consultados, nada marcado significa nada liberado —
    // e é o padrão certo, porque liberar tudo por omissão daria ao assistente
    // externo acesso a projetos que o usuário nunca pensou em abrir.
    controle = opcoes.length
      ? `<div class="arq-mcp-varios" id="${id}">${opcoes.map(o =>
          `<label class="arq-mcp-check"><input type="checkbox" data-valor="${escapeHtml(o)}" ${marcados.has(String(o)) ? 'checked' : ''}/> ${escapeHtml(o)}</label>`).join('')}</div>`
      : '<p class="config-nota">Nada para escolher aqui ainda.</p>';
  } else {
    const bruto = valor == null ? (campo.padrao == null ? '' : campo.padrao) : valor;
    controle = `<input type="${campo.tipo === 'numero' ? 'number' : 'text'}" id="${id}" value="${escapeHtml(String(bruto))}" spellcheck="false" />`;
  }

  div.innerHTML = `
    ${campo.tipo === 'marcar' ? '' : `<label for="${id}">${escapeHtml(campo.rotulo)}</label>`}
    ${controle}
    ${campo.ajuda ? `<p class="config-nota">${escapeHtml(campo.ajuda)}</p>` : ''}`;

  const gravar = async (v) => {
    const r = await window.pywebview.api.set_mcp_terceiro_config(
      currentProject, item.name, campo.chave, v);
    if (!r || !r.success) showToast((r && r.error) || 'Erro ao gravar.', true);
  };

  if (campo.tipo === 'varios') {
    div.querySelectorAll('.arq-mcp-varios input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        const marcados = Array.from(
          div.querySelectorAll('.arq-mcp-varios input[type="checkbox"]'))
          .filter(x => x.checked).map(x => x.dataset.valor);
        gravar(marcados);
      });
    });
  } else {
    const el = div.querySelector('input, select');
    if (el) {
      // `change`, e não `input`: gravar a cada tecla reescreveria o arquivo de
      // registro do projeto a cada letra digitada.
      el.addEventListener('change', () => {
        if (campo.tipo === 'marcar') return gravar(el.checked);
        if (campo.tipo === 'numero') return gravar(el.value === '' ? '' : Number(el.value));
        gravar(el.value);
      });
    }
  }
  return div;
}

// O nome do item é um CAMINHO ("Grupo/Item") e a chave do campo é texto livre:
// os dois entram num `id` de HTML, então tudo que não é letra, número ou hífen
// vira hífen. Sem isto um item dentro de grupo geraria um id com barra, e o
// seletor não o acharia.
function _arqMcpIdSeguro(texto) {
  return String(texto || '').replace(/[^A-Za-z0-9_-]+/g, '-');
}
