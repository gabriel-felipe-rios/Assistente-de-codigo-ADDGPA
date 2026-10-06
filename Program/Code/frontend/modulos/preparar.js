// ══════════════════════════════════════════ Projeto › Preparar projeto
// Pré-visualização e execução do Preparar. O painel mostra, antes de qualquer
// escrita, exatamente o que vai acontecer — e é o MESMO plano que a execução
// segue: os dois saem de `preparar_projeto_preview` / `preparar_projeto`, que
// compartilham `_preparar_plano_de_pastas` no backend.

// Emoji por tipo. FICAM aqui de propósito (D33) — ver o cabeçalho de
// `preparar-template.js`.
const PREPARAR_ICONES = {
  'skills': '📄',
  'comandos': '⌨️',
  'mcps': '🔌',
  'regras-instrucoes': '📕',
};

let _prepararPresets = [];

// Carrega os presets no seletor e pinta a prévia. Chamado ao entrar no projeto.
// ⚠️ DUAS LEITURAS DO MESMO JSON, DE PROPÓSITO. `enterProject` dispara
// `initArquivosTab()` e `initPrepararTab()` SEM `await` — a ordem entre as duas
// não é garantida. Se este painel dependesse do `_arqPreset` que a aba Arquivos
// carrega, ele pintaria vazio metade das vezes, e o defeito seria intermitente.
// O arquivo é pequeno; a corrida some.
async function prepPintarDestinos() {
  const casa = document.getElementById('prep-destinos');
  if (!casa) return;
  const cfg = await window.pywebview.api.load_assistentes_config(currentProject);
  if (!cfg || !cfg.success) return;
  // `_arqPreset` é de `arquivos.js`, e `_arqFraseDeDestino` lê dele. Reaproveitar
  // a função é o que garante que as frases daqui e as das sete categorias digam
  // exatamente a mesma coisa — duas redações divergiriam na primeira mudança.
  if (typeof _arqPreset !== 'undefined') _arqPreset = cfg;
  if (typeof _arqPintarBarraDePreset === 'function') _arqPintarBarraDePreset();

  const linhas = (typeof ARQ_KINDS !== 'undefined' ? ARQ_KINDS : [])
    .filter(k => !k.proprio)
    .map(k => {
      const frase = (typeof _arqFraseDeDestino === 'function')
        ? _arqFraseDeDestino(k.key) : null;
      return `<div class="prep-destino-linha">
                <span class="prep-destino-icone">${k.icon}</span>
                <span class="prep-destino-nome">${escapeHtml(k.label)}</span>
                <span class="prep-destino-frase">${frase || '—'}</span>
              </div>`;
    }).join('');
  casa.innerHTML = linhas || '<div class="arq-expand-empty">Nada a mostrar.</div>';
}

async function initPrepararTab() {
  if (!document.getElementById('subtab-preparar')) return;
  prepPintarDestinos();

  const cfg = await window.pywebview.api.load_inicio_rapido_config(currentProject);
  const sel = document.getElementById('preparar-preset');
  if (!cfg || !cfg.success || !sel) return;

  // Preset inválido não vira opção: melhor não poder escolher do que falhar no
  // meio da execução, com metade das pastas já criadas.
  _prepararPresets = (cfg.presets || []).filter(p => !(cfg.erros[p.nome] || []).length);
  const invalidos = (cfg.presets || []).length - _prepararPresets.length;

  sel.innerHTML = _prepararPresets.map(p =>
    `<option value="${escapeHtml(p.nome)}">${escapeHtml(p.nome)}</option>`).join('');
  if (_prepararPresets.some(p => p.nome === cfg.escolhido)) sel.value = cfg.escolhido;

  const avisoPreset = document.getElementById('preparar-aviso-preset');
  if (avisoPreset) {
    avisoPreset.classList.toggle('hidden', !invalidos);
    avisoPreset.innerHTML = invalidos
      ? `⚠️ ${invalidos} início${invalidos > 1 ? 's rápidos estão indisponíveis' : ' rápido está indisponível'} por ter campo inválido. Conserte em <b>Configurações › Preparar projeto</b>.`
      : '';
  }

  if (!sel._wired) {
    sel._wired = true;
    sel.addEventListener('change', async () => {
      await window.pywebview.api.set_inicio_rapido_do_projeto(currentProject, sel.value);
      prepararRenderPreview();
    });
  }
  const btn = document.getElementById('btn-preparar-projeto');
  if (btn && !btn._wired) {
    btn._wired = true;
    btn.addEventListener('click', prepararProjeto);
  }

  prepararRenderPreview();
}

// Só lê — não altera nada.
async function prepararRenderPreview() {
  const grupos = document.getElementById('preparar-grupos');
  if (!grupos) return;
  const sel = document.getElementById('preparar-preset');
  const r = await window.pywebview.api.preparar_projeto_preview(currentProject, sel ? sel.value : null);

  const destino = document.getElementById('preparar-destino');
  if (destino) {
    destino.innerHTML = (r && r.success && r.root_ok)
      ? `📁 Destino: <code>${escapeHtml(r.root_folder)}</code>`
      : `<span class="arq-preparar-destino-erro">⚠️ Sem pasta raiz definida — configure a pasta raiz do projeto na sub-aba Trabalho antes de preparar.</span>`;
  }

  const avisoTeto = document.getElementById('preparar-aviso-teto');
  if (avisoTeto) {
    const texto = (r && r.aviso_teto) || '';
    avisoTeto.classList.toggle('hidden', !texto);
    avisoTeto.innerHTML = texto ? `⚠️ ${escapeHtml(texto)}` : '';
  }

  if (!r || !r.success) {
    grupos.innerHTML = `<div class="arq-expand-empty">${escapeHtml((r && r.error) || 'Erro.')}</div>`;
    return;
  }

  // ⚠️ `instrucoes-base` NÃO vira cartão aqui: o cartão 📘 logo abaixo já é
  // ela (o arquivo da raiz, com o nome do assistente). Os dois juntos diziam a
  // mesma coisa duas vezes — e a execução também a pula no passo 1.
  const cartoes = (r.grupos || []).filter(g => g.kind !== 'instrucoes-base').map(g => _prepararCartao(
    PREPARAR_ICONES[g.kind] || '📄',
    g.rotulo,
    `${g.itens.length} ${g.itens.length === 1 ? 'item' : 'itens'}`,
    `→ <code>${escapeHtml(g.destino)}</code>`,
    // O backend já não devolve grupo vazio: tipo sem nenhum item marcado no
    // preset é PULADO, igual a destino em branco. A linha continua aqui como
    // rede de segurança, e o texto diz onde se marca.
    g.itens.length
      ? g.itens.map(n => _prepararLinhaDeItem(escapeHtml(n), (g.ja_esta || {})[n])).join('')
      : `<li class="arq-preparar-item-vazio">Nenhum item marcado neste início rápido — marque em Configurações › Preparar projeto.</li>`
  ));

  // O arquivo de instrução base da raiz. O NOME vem do ASSISTENTE
  // (`arquivo_de_entrada`) e o TEXTO vem do ITEM DA BIBLIOTECA que o início
  // rápido marcou — desde 2026-09-02 nenhum dos dois é campo de preset.
  //
  // ⚠️ Três estados, e o vazio é o que se esquece: início rápido sem item de
  // Instruções base marcado não escreve arquivo nenhum, pela mesma regra de
  // campo vazio dos destinos. Sem este caso o cartão prometeria um arquivo que
  // não vem. As duas chaves derivadas (`arquivo_regras_vazio` e
  // `arquivo_regras_existe`) são produzidas pela prévia no backend — mudar o
  // nome delas lá deixa estes três estados mudos aqui.
  cartoes.push(_prepararCartao(
    '📘', escapeHtml(r.arquivo_regras),
    r.arquivo_regras_vazio ? 'sem conteúdo'
      : (r.arquivo_regras_existe ? 'já existe' : 'será criado'),
    `→ <code>${escapeHtml(r.arquivo_regras)}</code> na raiz`,
    r.arquivo_regras_vazio
      ? `<li class="arq-preparar-item-vazio">Nenhum item de <b>Instruções base</b> marcado neste início rápido — nada será escrito. Marque um em Configurações › Preparar projeto.</li>`
      : (r.arquivo_regras_existe
        ? _prepararLinhaDeItem(`${escapeHtml(r.arquivo_regras)} — já existe neste projeto, será mantido como está`, true)
        : _prepararLinhaDeItem(`${escapeHtml(r.arquivo_regras)} — será criado agora`, false))
  ));

  const pastas = r.pastas || [];
  cartoes.push(_prepararCartao(
    '📂', 'Pastas a criar', String(pastas.length),
    '→ na raiz e na pasta de trabalho, conforme o início rápido',
    pastas.length
      ? pastas.map(_prepararLinhaDePasta).join('')
      : `<li class="arq-preparar-item-vazio">Este início rápido não cria nenhuma pasta.</li>`
  ));

  // A legenda das duas cores. Só quando há raiz: sem ela o backend não confere
  // nada, e a tela não tem o que pintar.
  const legenda = r.root_ok
    ? `<div class="arq-preparar-legenda">
         <span class="arq-preparar-item-tem">já está no projeto</span>
         <span class="arq-preparar-item-falta">falta — o Preparar copia</span>
       </div>`
    : '';
  grupos.innerHTML = legenda + cartoes.join('');
}

// Uma linha de item, pintada pelo que o backend conferiu no disco (`ja_esta`):
// verde já chegou, vermelho falta. `undefined`/`null` é "não deu para saber"
// (sem raiz, item ilegível) — fica na cor neutra, e não finge nenhuma das duas.
function _prepararLinhaDeItem(html, jaEsta) {
  const cls = jaEsta === true ? 'arq-preparar-item-tem'
    : (jaEsta === false ? 'arq-preparar-item-falta' : '');
  return `<li${cls ? ` class="${cls}"` : ''}>${html}</li>`;
}

function _prepararCartao(icone, nome, contagem, destino, itensHtml) {
  return `
    <div class="arq-preparar-grupo">
      <div class="arq-preparar-grupo-head">
        <span class="arq-preparar-grupo-icon">${icone}</span>
        <span class="arq-preparar-grupo-nome">${nome}</span>
        <span class="arq-preparar-grupo-cnt">${escapeHtml(contagem)}</span>
      </div>
      <div class="arq-preparar-grupo-dest">${destino}</div>
      <ul class="arq-preparar-lista">${itensHtml}</ul>
    </div>`;
}

// Uma linha do cartão "Pastas a criar": onde nasce, se já existe, e em quais
// das duas listas do projeto ela já entra no mesmo clique que a cria.
function _prepararLinhaDePasta(p) {
  const marcas = [];
  if (p.remover) marcas.push('<span class="arq-preparar-marca-remover">→ Remover</span>');
  if (p.contexto) marcas.push('<span class="arq-preparar-marca-contexto">+ Contexto sem leitura</span>');
  const selo = marcas.length ? ' &nbsp;' + marcas.join(' ') : '';
  const trabalho = p.pasta_de_trabalho
    ? ' <span class="arq-preparar-nota-inline">(criada e registrada como pasta de trabalho)</span>'
    : '';
  if (p.existe) {
    return _prepararLinhaDeItem(`<b>${p.destino}</b> · ${escapeHtml(p.rel)} — já existe${selo}`, true);
  }
  return _prepararLinhaDeItem(`<b>${p.destino}</b> · ${escapeHtml(p.rel)}${trabalho}${selo}`, false);
}

async function prepararProjeto() {
  const out = document.getElementById('preparar-result');
  const btn = document.getElementById('btn-preparar-projeto');
  const sel = document.getElementById('preparar-preset');
  if (btn) btn.disabled = true;
  if (out) out.innerHTML = '<div class="arq-expand-loading">Preparando…</div>';

  const r = await window.pywebview.api.preparar_projeto(currentProject, sel ? sel.value : null);
  if (btn) btn.disabled = false;
  if (!r || !r.success) {
    if (out) out.innerHTML = `<div class="arq-expand-empty">${escapeHtml((r && r.error) || 'Erro.')}</div>`;
    return;
  }

  const linhas = (r.grupos || []).map(g => {
    const partes = [];
    if (g.copiados.length) partes.push(`${g.copiados.length} copiado(s)`);
    if (g.ja_existiam.length) partes.push(`${g.ja_existiam.length} já existia(m) — não sobrescrito(s)`);
    return `✅ ${g.rotulo}: ${partes.length ? partes.join(', ') : '(nada marcado como do programa)'}`;
  });
  if (r.arquivo_regras) linhas.push(`✅ ${r.arquivo_regras.nome}: ${r.arquivo_regras.acao}`);

  const criadas = (r.pastas || []).filter(p => p.criada).length;
  const existiam = (r.pastas || []).length - criadas;
  linhas.push(`✅ Pastas: ${criadas} criada(s)` + (existiam ? `, ${existiam} já existia(m)` : ''));
  if ((r.marcas || []).length) {
    const rem = r.marcas.filter(m => m.marca === 'remover').length;
    const ctx = r.marcas.filter(m => m.marca === 'contexto').length;
    linhas.push(`✅ Marcadas: ${rem} em Remover, ${ctx} em Contexto sem leitura`);
  }
  if ((r.erros || []).length) linhas.push(`⚠️ ${r.erros.join('; ')}`);

  if (out) {
    out.innerHTML = '<div class="arq-preparar-done">'
      + linhas.map(l => `<div>${escapeHtml(l)}</div>`).join('') + '</div>';
  }
  showToast('Projeto preparado.');

  // As duas sub-abas vizinhas acabaram de receber itens, e a aba Arquivos
  // acabou de ganhar itens ativados: recarregar as três, senão a tela mente.
  await loadWorkspace();   // ja repinta Remover, Contexto e o resumo
  prepararRenderPreview();
  initArquivosTab();

  // 🔴 D10 — O ASSISTENTE DO INÍCIO RÁPIDO ACABOU DE VIRAR O DO PROJETO, no
  // `Workspace.json`. O seletor da sub-aba "Assistente externo" tem de acompanhar NA
  // HORA: sem isto ele continua mostrando o assistente anterior, e o próximo
  // "ligar" da aba Arquivos copia para a pasta do assistente errado — sem erro
  // nenhum, e sem nada na tela discordando.
  if (typeof prepPintarDestinos === 'function') await prepPintarDestinos();
  if (r.assistente) showToast(`Assistente do projeto: ${r.assistente}.`);
}
