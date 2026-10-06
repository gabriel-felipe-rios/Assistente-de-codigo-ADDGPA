// ═══════════════════════════════════ Configurações → Plugins (comportamento) ══
// Mostra a árvore de External/plugins/ (plugins soltos na raiz e dentro de
// subpastas/categorias, em qualquer profundidade) com um Interruptor
// (ligado/desligado), os dois checkboxes de local (D2.1 da discussão
// "Sistema de plugins") e uma alça de arrastar — tanto pra reordenar
// categorias entre si quanto pra reordenar plugins entre si, sempre dentro
// do MESMO nível (nunca cruzando pra dentro/fora de uma subpasta). Uma
// categoria é só organização: nunca liga/desliga, nunca tem os checkboxes —
// mesma regra de Launchers.
//
// O estado vivo (a última árvore lida do backend) mora em `pluginsArvore` —
// `plugins-navegacao.js` usa esse mesmo global pra montar o trilho de
// pastas e as sub-abas "Plugins" (tela principal e dentro do projeto). Este
// arquivo é quem primeiro popula esse estado; qualquer mudança aqui chama
// `atualizarAbasDePlugins()` (definida lá) pras duas abas repintarem.
//
// Ligar/desligar e os dois checkboxes gravam no clique — sem barra de
// Salvar, mesma regra do Interruptor. A ORDEM é diferente: arrastar só
// reorganiza o DOM (como em "Ordem das abas"); só o botão "Salvar" grava e
// aplica de verdade — arrastar sem salvar e trocar de aba não deveria
// persistir nada. Ao contrário de Launchers (que grava a ordem de pasta a
// cada solta), aqui um "Salvar" só grava TODOS os níveis de uma vez —
// convenção já existente desta categoria, mantida.

let pluginsArvore = { nome: '', caminho: '', pastas: [], plugins: [] };

async function initConfigPlugins() {
  await carregarPlugins();

  // Relê a pasta toda vez que a categoria é ABERTA de novo (não só no
  // boot) — mesma razão de `initConfigAtalhosExternos`: um plugin (ou
  // subpasta) criado depois do programa já ter iniciado só apareceria
  // reabrindo o programa inteiro, senão.
  const trilhoBtn = document.querySelector(
    '#config-trilho .config-trilho-btn[data-categoria="plugins"]');
  if (trilhoBtn && !trilhoBtn._wiredRecarga) {
    trilhoBtn._wiredRecarga = true;
    trilhoBtn.addEventListener('click', carregarPlugins);
  }

  const btnSalvar = document.getElementById('btn-save-plugins');
  if (btnSalvar && !btnSalvar._wired) {
    btnSalvar._wired = true;
    btnSalvar.addEventListener('click', salvarOrdemPlugins);
  }

  const lista = document.getElementById('plugins-lista');
  if (!lista) return;

  // Delegado no container: a árvore é remontada toda vez que o estado
  // muda, e um listener por linha morreria junto da linha antiga.
  if (!lista._wired) {
    lista._wired = true;
    lista.addEventListener('click', async (ev) => {
      const caminho = ev.target.closest('.plugin-item')?.dataset.plugin;
      if (!caminho) return;

      const togglePill = ev.target.closest('.toggle-pill');
      const check = ev.target.closest('.plugin-check input');

      if (togglePill) {
        // Manifesto com erro: o interruptor fica visível, mas não liga — o
        // backend recusaria de qualquer jeito (`save_config_plugin`).
        if (togglePill.classList.contains('desabilitado')) return;
        const track = togglePill.querySelector('.toggle-track');
        const ligado = !track.classList.contains('on');
        await _salvarPlugin(caminho, { ligado });
      } else if (check) {
        // O clique no <input> já mudou `checked` sozinho — lê o valor novo.
        const campo = check.dataset.campo;
        await _salvarPlugin(caminho, { [campo]: check.checked });
      }
    });
  }
}

/** Lê a ordem atual do DOM (o usuário já pode ter arrastado categorias e/ou
 * plugins) e grava — um `{caminho_da_pasta_pai: [nomes]}` por nível, pra
 * TODOS os níveis presentes na árvore de uma vez (mesmo formato de
 * `launchers-ordem.json`, só que salvo tudo junto em vez de a cada
 * solta). */
function _coletarOrdemPlugins(elArvore) {
  const ordemPorPasta = {};
  const acumular = (caminhoPai, nomes) => {
    ordemPorPasta[caminhoPai] = [...(ordemPorPasta[caminhoPai] || []), ...nomes];
  };
  elArvore.querySelectorAll('.plugins-pastas-nivel[data-caminho-pai]').forEach(nivel => {
    acumular(nivel.dataset.caminhoPai, [...nivel.children].map(el => el.dataset.pasta));
  });
  elArvore.querySelectorAll('.plugins-itens-nivel[data-caminho-pai]').forEach(nivel => {
    acumular(nivel.dataset.caminhoPai, [...nivel.children].map(el => el.dataset.pluginNome));
  });
  return ordemPorPasta;
}

async function salvarOrdemPlugins() {
  const lista = document.getElementById('plugins-lista');
  const ordemPorPasta = lista ? _coletarOrdemPlugins(lista) : {};
  try {
    const r = await window.pywebview.api.save_plugins_order(ordemPorPasta);
    if (!r || !r.success) {
      showToast((r && r.error) || 'Não foi possível salvar a ordem.', true);
      return;
    }
    pluginsArvore = r.arvore;
  } catch (e) {
    showToast('Não foi possível salvar a ordem.', true);
    console.error('[plugins] falha ao salvar ordem:', e);
    return;
  }
  _pintarListaPlugins();
  if (typeof atualizarAbasDePlugins === 'function') atualizarAbasDePlugins();
  showToast('Plugins salvos!');
}

/** Busca a árvore no backend, guarda em `pluginsArvore` e repinta. */
async function carregarPlugins() {
  try {
    const r = await window.pywebview.api.list_plugins();
    pluginsArvore = (r && r.success) ? r.arvore : { nome: '', caminho: '', pastas: [], plugins: [] };
  } catch (e) {
    console.error('[plugins] falha ao listar:', e);
    pluginsArvore = { nome: '', caminho: '', pastas: [], plugins: [] };
  }
  _pintarListaPlugins();
  if (typeof atualizarAbasDePlugins === 'function') atualizarAbasDePlugins();
  return pluginsArvore;
}

async function _salvarPlugin(caminho, patch) {
  try {
    const r = await window.pywebview.api.save_config_plugin(caminho, patch);
    if (!r || !r.success) {
      showToast((r && r.error) || 'Não foi possível gravar o plugin.', true);
      return;
    }
    pluginsArvore = r.arvore;
  } catch (e) {
    showToast('Não foi possível gravar o plugin.', true);
    console.error('[plugins] falha ao gravar:', e);
    return;
  }
  _pintarListaPlugins();
  if (typeof atualizarAbasDePlugins === 'function') atualizarAbasDePlugins();
}

function _pluginLinhaHtml(p) {
  return `
    <div class="plugin-item" data-plugin="${escapeHtml(p.caminho)}" data-plugin-nome="${escapeHtml(p.nome)}">
      <span class="plugin-handle" title="Arrastar para reordenar">⠿</span>
      <div class="plugin-info">
        <div class="plugin-nome">${escapeHtml(p.titulo || p.nome)}</div>
        ${p.descricao ? `<div class="plugin-descricao">${escapeHtml(p.descricao)}</div>` : ''}
        ${p.tipo ? `<div class="plugin-tipo">${escapeHtml(p.tipo)}</div>` : ''}
        ${p.ok === false ? `<div class="plugin-erro">${(p.erros || []).map(escapeHtml).join('<br>')}</div>` : ''}
      </div>
      <div class="plugin-onde">
        <label class="plugin-check">
          <input type="checkbox" data-campo="tela_principal" ${p.tela_principal ? 'checked' : ''} />
          Tela principal
        </label>
        <label class="plugin-check">
          <input type="checkbox" data-campo="dentro_do_projeto" ${p.dentro_do_projeto ? 'checked' : ''} />
          Dentro do projeto
        </label>
      </div>
      <label class="toggle-pill${p.ok === false ? ' desabilitado' : ''}"${p.ok === false ? ' aria-disabled="true" title="o plugin.json tem erro — corrija para ligar"' : ''}>
        <div class="toggle-track${p.ligado ? ' on' : ''}"><div class="toggle-knob"></div></div>
        <span class="toggle-label${p.ligado ? ' on' : ''}">${p.ligado ? 'Ligado' : 'Desligado'}</span>
      </label>
    </div>`;
}

/** Uma categoria (subpasta pura, nunca liga/desliga): título com alça de
 * arrastar, e o corpo — recursivo, mesma ideia de `_atalhoExternoPastaHtml`
 * (config-atalhos-externos.js). */
function _pluginPastaHtml(pasta) {
  return `
    <div class="plugins-pasta-config" data-pasta="${escapeHtml(pasta.nome)}">
      <div class="plugins-pasta-titulo">
        <span class="plugins-pasta-handle" title="Arrastar para reordenar">⠿</span>
        <span class="plugins-pasta-nome">${escapeHtml(pasta.nome)}</span>
      </div>
      <div class="plugins-pasta-corpo">${_pluginCorpoHtml(pasta)}</div>
    </div>`;
}

/** O conteúdo de UM nível: bloco das categorias (se houver) + linhas dos
 * plugins (se houver) — cada bloco no seu próprio `data-caminho-pai`, pra
 * `_coletarOrdemPlugins` separar o que é arraste de categoria do que é
 * arraste de plugin. Chamada tanto pra raiz quanto, recursivamente, pra
 * cada categoria — é por isso que a árvore não tem limite de profundidade
 * fixo. */
function _pluginCorpoHtml(no) {
  const pastasHtml = no.pastas.length
    ? `<div class="plugins-pastas-nivel" data-caminho-pai="${escapeHtml(no.caminho)}">${
        no.pastas.map(_pluginPastaHtml).join('')}</div>`
    : '';
  const pluginsHtml = no.plugins.length
    ? `<div class="plugins-itens-nivel" data-caminho-pai="${escapeHtml(no.caminho)}">${
        no.plugins.map(_pluginLinhaHtml).join('')}</div>`
    : '';
  return pastasHtml + pluginsHtml;
}

function _pintarListaPlugins() {
  const lista = document.getElementById('plugins-lista');
  if (!lista) return;

  if (!pluginsArvore.pastas.length && !pluginsArvore.plugins.length) {
    lista.innerHTML = `<p class="plugins-vazio">Nenhum plugin em <code>External/plugins/</code> ainda.
      Veja <b>Arquivos › Como adicionar › Plugins</b> para criar o primeiro.</p>`;
    return;
  }

  lista.innerHTML = _pluginCorpoHtml(pluginsArvore);
  _initPluginsPastasDnd(lista);
  _initPluginsItensDnd(lista);
}

// Reordenação via mousedown/mousemove/mouseup, não a API nativa de HTML5
// drag-and-drop — dragstart/dragover não disparam de forma confiável no
// WebView2, mesmo motivo de "Ordem das abas" e de Launchers. Um único
// mecanismo genérico serve os dois casos (categoria entre categorias,
// plugin entre plugins): cada um só arrasta dentro do PRÓPRIO
// `containerClasse`, nunca cruzando pra outro nível.
const PLUGINS_DND_LIMIAR = 4;

function _pluginsIrmaoDepoisDoY(nivel, dragEl, y) {
  const irmaos = [...nivel.children].filter(el => el !== dragEl);
  for (const el of irmaos) {
    const box = el.getBoundingClientRect();
    if (y < box.top + box.height / 2) return el;
  }
  return null;
}

function _pluginsWireDnd(raiz, containerClasse, handleSeletor) {
  raiz.querySelectorAll(containerClasse).forEach(nivel => {
    [...nivel.children].forEach(itemEl => {
      const handle = itemEl.querySelector(handleSeletor);
      if (!handle) return;
      handle.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        const dragEl = itemEl;
        const partiuDe = { x: e.clientX, y: e.clientY };
        let arrastando = false;

        function onMouseMove(e2) {
          if (!arrastando) {
            const andou = Math.abs(e2.clientX - partiuDe.x) + Math.abs(e2.clientY - partiuDe.y);
            if (andou < PLUGINS_DND_LIMIAR) return;
            arrastando = true;
            dragEl.classList.add('dragging');
          }
          const after = _pluginsIrmaoDepoisDoY(nivel, dragEl, e2.clientY);
          if (after === dragEl.nextElementSibling) return;
          if (after == null) nivel.appendChild(dragEl);
          else nivel.insertBefore(dragEl, after);
        }
        function onMouseUp() {
          dragEl.classList.remove('dragging');
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });
  });
}

function _initPluginsPastasDnd(raiz) {
  _pluginsWireDnd(raiz, '.plugins-pastas-nivel', ':scope > .plugins-pasta-titulo > .plugins-pasta-handle');
}

function _initPluginsItensDnd(raiz) {
  _pluginsWireDnd(raiz, '.plugins-itens-nivel', ':scope > .plugin-handle');
}
