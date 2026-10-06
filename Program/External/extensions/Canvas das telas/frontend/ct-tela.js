// ═══════════════════════════════════ CANVAS DAS TELAS — O HTML ══
// Só devolve texto HTML. NÃO liga evento: quem liga é `ct-eventos.js`, depois
// de o HTML estar no DOM.
//
// ⚠️ Tudo o que vem do projeto (nome de arquivo, texto de botão) passa por
// `escapeHtml`.

(function () {
  const esc = t => escapeHtml(String(t == null ? '' : t));
  // As oito cores das setas (D15), só tokens.
  const CT_CORES = ['--blue-rgb', '--green-rgb', '--amber-rgb', '--purple-rgb', '--teal-rgb', '--red-rgb', '--yellow-rgb', '--white-rgb'];

  function item(t, filho) {
    const rotulo = t.tipo === 'pagina' ? t.arquivo : t.nome;
    const texto = t.tipo === 'pagina' ? t.arquivo : `${t.arquivo} ${t.nome}`;
    return `<button class="ct-item${filho ? ' filho' : ''}" data-foco="${esc(t.id)}" data-texto="${esc(texto)}">` +
      `<span class="ct-item-icone">${filho ? '▸' : '▭'}</span>${esc(rotulo)}</button>`;
  }

  // Cada página seguida das abas e modais dela, recuados. Um filho cuja
  // página não está no mesmo grupo sai no lugar dele, recuado do mesmo jeito.
  function grupo(telas) {
    const paginas = new Set(telas.filter(t => t.tipo === 'pagina').map(t => t.id));
    let html = '';
    telas.forEach(t => {
      if (t.tipo === 'pagina') {
        html += item(t, false);
        telas.filter(f => f.pai === t.id).forEach(f => { html += item(f, true); });
      } else if (!paginas.has(t.pai)) {
        html += item(t, true);
      }
    });
    return html;
  }

  window.ctHtmlLista = function (leitura) {
    if (!leitura) return '';
    if (leitura.aviso) return `<p class="config-nota">${esc(leitura.aviso)}</p>`;
    const telas = leitura.telas || [];
    const alcancadas = telas.filter(t => t.alcancada);
    const soltas = telas.filter(t => !t.alcancada);
    const stat = `${telas.length} telas · ${(leitura.ligacoes || []).length} ligações · lido às ${leitura.lido_em || ''}`;
    return `<div class="ct-comeca"><div class="ct-lista-titulo" style="padding:0">Começa em</div>` +
      `<span class="ct-comeca-arq">${esc(leitura.comeca)} · ${esc(leitura.comeca_motivo)}</span></div>` +
      `<span class="mapa-stat" id="ct-stat">${esc(stat)}</span>` +
      `<div class="ct-lista-cab"><div class="ct-lista-titulo">Telas</div>` +
      `<button class="mapa-toggle-btn ct-recolher" id="ct-recolher-lista" title="Recolher a lista">‹</button></div>` +
      `<input type="search" class="config-busca" id="ct-busca" placeholder="Buscar tela..." autocomplete="off" spellcheck="false">` +
      grupo(alcancadas) +
      (soltas.length ? `<div class="ct-grupo">Nenhum botão leva até aqui</div>` + grupo(soltas) : '');
  };

  // A aba inteira: o topo numa linha só (D42, D37), o ⚙ com os tamanhos (D13)
  // e o "Não guardar" (D45), a lista e o canvas. Os `ct-slot-*` vazios são o
  // lugar dos controles das ligações (fase 03).
  window.ctHtmlAba = function () {
    const e = window.ctEstado;
    const tam = (k, rot) => `<button class="mapa-toggle-btn${e.tamanho === k ? ' active' : ''}" data-tam="${k}">${rot}</button>`;
    const linhaTam = (k, rot) => `<div class="ct-tam-linha"><span>${rot}</span><input data-tam="${k}" data-eixo="0">` +
      `<span class="ct-tam-x">×</span><input data-tam="${k}" data-eixo="1"></div>`;
    const on = e.naoGuardar ? ' on' : '';
    const pill = (dado, liga, rot) => `<label class="toggle-pill" data-opcao="${dado}"><div class="toggle-track${liga ? ' on' : ''}"><div class="toggle-knob"></div></div>` +
      `<span class="toggle-label${liga ? ' on' : ''}">${rot}</span></label>`;
    const origem = (k, rot) => `<button class="mapa-toggle-btn${e.origemSetas === k ? ' active' : ''}" data-origem="${k}">${rot}</button>`;
    const bol = (k, rot) => `<option value="${k}"${e.bolinha === k ? ' selected' : ''}>${rot}</option>`;
    const modo = (k, rot) => `<button class="mapa-toggle-btn${e.modoSetas === k ? ' active' : ''}" data-modo="${k}">${rot}</button>`;
    const cor = `rgb(var(${e.cor}))`;
    const cores = CT_CORES.map(c => `<button class="ct-cor${c === e.cor ? ' ativa' : ''}" data-cor="${c}" style="background:rgb(var(${c}))"></button>`).join('');
    return `<div class="mapa-header" id="ct-cabecalho">
      <div class="mapa-header-left"><span class="mapa-title">Telas</span></div>
      <div class="ct-linha-unica">
        <div class="mapa-toggle" id="ct-setas-modo">${modo('escolhida', 'Setas da tela escolhida')}${modo('todas', 'Todas as setas')}</div>
        <div class="mapa-toggle" id="ct-setas-origem" title="De onde cada seta sai">${origem('elemento', 'Por elemento')}${origem('tela', 'Por arquivo')}</div>
        <span class="ct-rotulo-peq">Opacidade</span>
        <input type="range" class="ct-opacidade" id="ct-opacidade" min="0" max="100" value="${e.opacidade}">
        <span class="ct-op-val" id="ct-op-val">${e.opacidade}%</span>
        <div class="ct-ancora">
          <button class="ct-cor-bolinha" id="ct-cor-bolinha" title="Cor das setas" style="background:${cor}"></button>
          <div class="ct-pop hidden" id="ct-pop-cor">
            <div class="ct-pop-titulo">Cor das setas</div>
            <div class="ct-cores" id="ct-cores">${cores}</div>
          </div>
        </div>
        <div class="mapa-toggle" id="ct-tamanho">${tam('celular', 'Celular')}${tam('tablet', 'Tablet')}${tam('computador', 'Computador')}</div>
        <div class="ct-ancora">
          <button class="mapa-toggle-btn" id="ct-tam-config" title="Tamanhos">⚙</button>
          <div class="ct-pop hidden" id="ct-pop-tam">
            <div class="ct-pop-titulo">Tamanho de cada tela</div>
            ${linhaTam('celular', 'Celular')}${linhaTam('tablet', 'Tablet')}${linhaTam('computador', 'Computador')}
            <div><button class="btn btn-muted btn-xs" id="ct-tam-padrao">Voltar ao padrão</button></div>
            <hr>
            <div class="ct-pop-titulo">Opacidade das ligações</div>
            <div class="ct-op-linha">${pill('ganho', e.ganhoLigado, 'Mais forte fora das telas')}<input type="number" id="ct-ganho" min="0" max="100" value="${e.ganho}"><span class="ct-tam-x">%</span></div>
            <label class="ct-bolinha-linha">Bolinha no elemento
              <select id="ct-bolinha">${bol('vazada', 'Vazada')}${bol('cheia', 'Cheia')}${bol('x', '✕')}${bol('nenhuma', 'Nenhuma')}</select></label>
            <div class="ct-op-linha">${pill('reducao', e.reducaoLigada, 'Mais fraca na bolinha')}<input type="number" id="ct-reducao" min="0" max="100" value="${e.reducao}"><span class="ct-tam-x">%</span></div>
            <hr>
            <div class="ct-pop-titulo">Interação</div>
            <label class="toggle-pill" data-liga="temporario"><div class="toggle-track${on}"><div class="toggle-knob"></div></div><span class="toggle-label${on}">Não guardar o que eu fizer nas telas</span></label>
          </div>
        </div>
        <div class="ct-zoom-grupo">
          <button class="mapa-toggle-btn" id="ct-menos">−</button>
          <span class="ct-zoom-val" id="ct-zoom">${Math.round(e.escala * 100)}%</span>
          <button class="mapa-toggle-btn" id="ct-mais">+</button>
        </div>
        <button class="mapa-toggle-btn" id="ct-enquadrar">⤢ Ver tudo</button>
        <button class="mapa-toggle-btn" id="ct-arrumar">↺ Arrumar</button>
        <button class="btn btn-primary btn-sm" id="ct-ler">⟳ Ler de novo</button>
        <button class="mapa-toggle-btn ct-recolher" id="ct-recolher-topo" title="Recolher os controles">⌃</button>
      </div>
    </div>
    <div class="ct-corpo">
      <nav class="ct-lista" id="ct-lista">carregando…</nav>
      <div class="ct-canvas" id="ct-canvas" style="--ct-seta-cor:${cor}">
        <button class="mapa-toggle-btn ct-flutua ct-flutua-esq hidden" id="ct-abrir-lista" title="Mostrar a lista de telas">›  Telas</button>
        <button class="mapa-toggle-btn ct-flutua ct-flutua-dir hidden" id="ct-abrir-topo" title="Mostrar os controles">⌄</button>
        <div class="ct-mundo" id="ct-mundo"></div>
      </div>
    </div>`;
  };
})();
