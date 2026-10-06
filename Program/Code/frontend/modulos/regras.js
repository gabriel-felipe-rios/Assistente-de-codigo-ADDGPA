// ══════════════════════════════════════════════════════════════ ABA: ACERVO
//
// ── Este arquivo era 774 linhas, e virou quatro ───────────────────────────
//
// Pelo teto de 500 da AMF. Cada um responde uma pergunta:
//
//   regras.js          o estado, as sub-abas do preset e a carga
//   regras-lista.js    a árvore de uma fonte, e o menu do botão direito
//   regras-editor.js   o painel do editor: abrir, cabeçalho, fechar
//   regras-acervo.js   gravar/renomear/apagar, preset e busca
//
// ⚠️ SÃO SCRIPTS CLÁSSICOS, NÃO MÓDULOS: as funções e os `let` do topo
// continuam globais. O `index.html` carrega os quatro na ordem acima.
//
// Sub-abas sobre as pastas de conhecimento do PROJETO: vêm do PRESET escolhido
// para ele (seletor "Preset do Acervo", na primeira fileira). Presets são
// definidos em Configurações → Acervo (globais, `settings.json`); o projeto só
// guarda qual NOME está ativo. Uma pasta do preset = uma sub-aba.
//
// ⚠️ TODAS AS SUB-ABAS SÃO IGUAIS desde 04/09/2026, e essa é a mudança mais
// fácil de desfazer sem querer. `Saída das skills/Regras e instruções` era a
// ÚNICA com gramática própria aqui — lista plana de itens com tipo, barra
// Todos/Regras/Instruções, editor com formulário — e o usuário pediu o oposto:
// *"era só pra aparecer do mesmo jeito que aparecem os outros aqui"*. Toda
// pasta do preset é árvore de arquivo; o que muda entre elas é só poder ou não
// escrever. `_REGRAS_CAMINHO_ESPECIAL` e `_regrasEhPastaEspecial` saíram junto,
// porque ninguém mais tinha o que perguntar a eles.
//
// ⚠️ O BACKEND ESTRUTURADO CONTINUA DE PÉ: `save_regra`/`list_regras` seguem
// existindo em `regras_indice.py`, e quem os usa é o CHAT (`chat-payload.js`).
// Foi só esta TELA que parou de ter duas gramáticas.

function _regrasNormalizarCaminho(caminho) {
  return (caminho || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

// O texto de "quem alcança" é só cosmético (a barra de caminho), e não faz
// parte do que um preset guarda — por isso fica como uma tabela local, com um
// texto genérico para qualquer pasta que um preset registrar.
const _REGRAS_ALCANCE_CONHECIDO = {
  'Saída das skills/Regras e instruções': 'Lida pelo chat e pelo assistente externo — os dois abrem o mesmo arquivo.',
  'Saída das skills': 'Lida pelo assistente externo — e pelas extensões que declaram lê-la.',
  'Saída dos comandos': 'O que os comandos produziram. Nenhum assistente lê sozinho.',
};
function _regrasAlcanceDe(caminho) {
  return _REGRAS_ALCANCE_CONHECIDO[_regrasNormalizarCaminho(caminho)] || 'Pasta registrada por você no Acervo.';
}

let _regrasFontesList = [];  // [{ titulo, editavel, caminho, alcance }]
let _regrasFonte = null;     // caminho (normalizado) da sub-aba ativa
let _regraAtiva = null;      // { tipo, name, arquivo } — item estruturado/instrução aberto
let _regraArquivoAcervo = null; // { caminho, novo } — arquivo livre (leitura ou editável) aberto
let _regrasSaveHandler = null;
let _regrasDeleteHandler = null;
let _regrasMode = 'nome';    // modo de busca atual
let _regrasArvore = null;    // instância de arvore-pastas.js (fontes de árvore)

function _regrasFonteAtual() {
  return _regrasFontesList.find(f => f.caminho === _regrasFonte) || null;
}

async function initRegrasTab() {
  _wireUmaVez('btn-regras-salvar', el => el.addEventListener('click', () => { if (_regrasSaveHandler) _regrasSaveHandler(); }));
  _wireUmaVez('btn-regras-deletar-item', el => el.addEventListener('click', () => { if (_regrasDeleteHandler) _regrasDeleteHandler(); }));
  _wireUmaVez('regras-preset-select', el => el.addEventListener('change', ev => regrasTrocarPreset(ev.target.value)));
  _wireUmaVez('btn-regras-search', el => el.addEventListener('click', () => regrasSearch()));

  _wireUmaVez('regras-search-input', el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') regrasSearch(); });
    el.addEventListener('input', () => {
      if (_regrasMode === 'nome') regrasFilterByName(el.value);
    });
  });

  document.querySelectorAll('.regras-mode-btn').forEach(btn => {
    if (btn._wired) return;
    btn._wired = true;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.regras-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _regrasMode = btn.dataset.mode;
      if (!document.getElementById('regras-search-input').value.trim()) loadRegrasTree();
    });
  });

  _regrasWireSubtabsBar();

  await _regrasCarregarFontes();
  loadRegrasTree();
}

function _wireUmaVez(id, wire) {
  const el = document.getElementById(id);
  if (el && !el._wired) { el._wired = true; wire(el); }
}

// ── Sub-abas dinâmicas ───────────────────────────────────────────────────────

// Delegado na barra, e não botão a botão: os botões são recriados a cada
// `_regrasRenderSubtabsBar` (a lista de pastas muda em runtime, quando se troca
// de preset no `<select>` da fileira de cima), e um listener por botão morreria
// junto do innerHTML.
function _regrasWireSubtabsBar() {
  const bar = document.getElementById('regras-subtabs-bar');
  if (!bar || bar._wired) return;
  bar._wired = true;
  bar.addEventListener('click', e => {
    const btn = e.target.closest('[data-regrasfonte]');
    if (!btn || btn.dataset.regrasfonte === _regrasFonte) return;
    _regrasFonte = btn.dataset.regrasfonte;
    _regrasEsquecerCarimbo();
    _regrasRenderSubtabsBar();
    _regraAtiva = null;
    document.getElementById('regras-search-input').value = '';
    regrasCloseEditor();
    loadRegrasTree();
  });
}

function _regrasRenderSubtabsBar() {
  const bar = document.getElementById('regras-subtabs-bar');
  if (!bar) return;
  bar.innerHTML = _regrasFontesList.map(f => `
    <button class="doc-subtab-btn${f.caminho === _regrasFonte ? ' active' : ''}"
            data-regrasfonte="${escapeHtml(f.caminho)}">${escapeHtml(f.titulo)}</button>`).join('');
}

// Desenha o `<select>` da fileira de cima: "Nenhum" mais um `<option>` por
// preset, com a contagem de pastas no rótulo — é o que diz, antes de escolher,
// que o preset tem conteúdo. `value=""` é o Nenhum, e é por isso que
// `regrasTrocarPreset` traduz string vazia para `null`.
function _regrasPintarPresetSelect(presets, escolhido) {
  const sel = document.getElementById('regras-preset-select');
  if (!sel) return;
  const opcoes = [`<option value=""${!escolhido ? ' selected' : ''}>Nenhum</option>`];
  (presets || []).forEach(p => {
    const n = (p.pastas || []).length;
    opcoes.push(`<option value="${escapeHtml(p.nome)}"${p.nome === escolhido ? ' selected' : ''}>${
      escapeHtml(p.nome)} (${n} pasta${n === 1 ? '' : 's'})</option>`);
  });
  sel.innerHTML = opcoes.join('');
}

// Busca os presets do Acervo e QUAL está ativo neste projeto TODA VEZ que a
// aba abre (e depois de trocar de preset) — não fica pendurado no
// `workspaceConfig` global carregado em paralelo por `loadWorkspace()`
// (navegacao.js chama sem await), que criaria uma corrida entre "clicou na
// aba Acervo" e "o Workspace.json já chegou".
//
// As pastas em si vêm do PRESET (settings.json, global) — não do projeto —,
// resolvidas pelo backend em `load_acervo_config`. O projeto só sabe QUAL
// NOME está ativo; sem preset escolhido, `_regrasFontesList` fica vazia.
let _regrasPresetAtivo = null;
async function _regrasCarregarFontes() {
  if (!currentProject) {
    _regrasFontesList = []; _regrasFonte = null; _regrasPresetAtivo = null;
    _regrasPintarPresetSelect([], null);
    return;
  }
  const r = await window.pywebview.api.load_acervo_config(currentProject);
  const escolhido = (r && r.success) ? r.escolhido : null;
  const presets = (r && r.success) ? (r.presets || []) : [];
  _regrasPresetAtivo = escolhido;
  // O `<select>` é repintado aqui, e não só no boot: um preset criado,
  // renomeado ou excluído em Configurações → Acervo tem de aparecer na lista
  // sem exigir que o programa reinicie.
  _regrasPintarPresetSelect(presets, escolhido);
  const preset = presets.find(p => p.nome === escolhido);
  const pastas = preset ? (preset.pastas || []) : [];
  _regrasFontesList = pastas.map(p => {
    const caminho = _regrasNormalizarCaminho(p.caminho);
    return {
      titulo: p.titulo || caminho,
      editavel: !!p.editavel,
      caminho,
      alcance: _regrasAlcanceDe(caminho),
    };
  });
  if (!_regrasFontesList.some(f => f.caminho === _regrasFonte)) {
    _regrasFonte = (_regrasFontesList[0] || {}).caminho || null;
  }
  _regrasRenderSubtabsBar();
}

// ── Carga ──────────────────────────────────────────────────────────────────

async function loadRegrasTree() {
  if (!currentProject) return;
  const fonte = _regrasFonteAtual();
  if (!fonte) {
    document.getElementById('regras-arvore-actions').classList.add('hidden');
    document.getElementById('regras-tree-title').textContent = 'Acervo';
    document.getElementById('regras-caminho').innerHTML = '';
    _regrasMostrarAviso(_regrasPresetAtivo
      ? 'O preset escolhido não tem pastas. Registre uma em Configurações → Acervo, ou troque de preset aqui em cima.'
      : 'Nenhum preset escolhido — escolha um no seletor aqui em cima.');
    return;
  }
  _regrasSyncCabecalhoBasico(fonte);

  const r = await window.pywebview.api.listar_arvore_decisoes(currentProject, fonte.caminho);
  if (r && !r.success) { _regrasMostrarAviso(r.error); return; }
  if (r && r.pasta_existe === false) { _regrasAvisarPastaAusente(fonte); return; }
  document.getElementById('regras-arvore-actions').classList.toggle('hidden', !(r && r.tem_subpastas));
  _regrasRenderArvoreLeitura((r && r.arquivos) || [], (r && r.pastas) || []);
  _regrasVigiarDisco();
}

function _regrasSyncCabecalhoBasico(fonte) {
  document.getElementById('regras-tree-title').textContent = fonte.titulo;
  // Nada mais no cabeçalho depende de `editavel`: o ＋ saiu, e quem decide se
  // dá para criar/renomear/excluir é o MENU do botão direito, montado em
  // `regras-lista.js` — ele simplesmente não existe numa fonte de leitura.
  // A barra de caminho é o que torna visível a mudança conceitual: a base
  // deixou de morar dentro do Assistente e passou a morar no seu projeto.
  document.getElementById('regras-caminho').innerHTML =
    `<code>${escapeHtml(fonte.caminho)}</code><span class="regras-caminho-alcance">${escapeHtml(fonte.alcance)}</span>`;
}

// ⚠️ "A pasta não existe" NÃO PODE SAIR COMO "está vazia". A primeira pasta do
// preset de fábrica é `Saída das skills/Regras e instruções`, e um projeto que
// não a tenha abria o Acervo já nessa sub-aba, lendo "Nenhuma regra ou instrução
// criada ainda" — que é a mesma frase de uma pasta existente e vazia. Quem
// acabou de escolher um preset lê isso como "escolher não funcionou".
// A pasta NÃO é criada aqui: o preset diz onde a coisa mora, não manda criá-la.
function _regrasAvisarPastaAusente(fonte) {
  document.getElementById('regras-arvore-actions').classList.add('hidden');
  _regrasMostrarAviso(`A pasta "${fonte.caminho}" não existe neste projeto. `
    + 'Crie-a, ou troque o caminho dela em Configurações → Acervo.');
}

function _regrasMostrarAviso(msg) {
  document.getElementById('regras-tree').innerHTML =
    `<div class="regras-empty">${escapeHtml(msg || 'Nada para mostrar.')}</div>`;
  regrasCloseEditor();
}


// ── O vigia do disco — o que substituiu o botão ↻ ─────────────────────────
//
// O ↻ "Recarregar do disco" saiu da barra: ele pedia ao usuário um trabalho que
// o programa sabe fazer. No lugar, a tela pergunta de tempos em tempos um
// CARIMBO barato (`carimbo_do_acervo`: `os.walk` + `st_mtime` + tamanho, nenhum
// arquivo aberto) e só recarrega quando ele muda. Mesmo desenho de
// `trabalhos-oficina.js::ofiVerificarAnotacoes`.
//
// ⚠️ Aqui o disco muda POR FORA DO PROGRAMA o tempo todo — as pastas do preset
// são as bases de decisão, escritas pelas skills e pelo assistente externo
// enquanto a aba está aberta. É a única das sete árvores em que o conteúdo
// envelhece sozinho na tela, e é por isso que a exceção vale só para ela.
//
// ⚠️ UM ÚNICO INTERVALO, GLOBAL, E ELE NUNCA É RECRIADO. `loadRegrasTree` roda a
// cada troca de sub-aba, de preset e a cada gravação — criar um `setInterval`
// ali dentro empilharia um vigia por carga, e em dez minutos de uso a tela
// estaria varrendo o disco dezenas de vezes por ciclo. A guarda `_regrasVigia`
// é o que impede isso.
const _REGRAS_INTERVALO_DO_VIGIA = 4000;
let _regrasVigia = null;
let _regrasCarimbo = null;

function _regrasVigiarDisco() {
  if (_regrasVigia) return;
  _regrasVigia = setInterval(_regrasConferirCarimbo, _REGRAS_INTERVALO_DO_VIGIA);
}

// Trocar de sub-aba, de preset ou gravar algo nós mesmos invalida o carimbo
// anotado: ele é de OUTRO estado, e compará-lo com o de agora acusaria mudança
// que não houve — ou, pior, esconderia uma que houve.
function _regrasEsquecerCarimbo() { _regrasCarimbo = null; }

async function _regrasConferirCarimbo() {
  // Aba fechada, projeto trocado ou sub-aba nenhuma: não há o que conferir, e
  // varrer o disco por uma tela que ninguém está vendo é desperdício puro.
  const aba = document.getElementById('tab-regras');
  if (!aba || aba.classList.contains('hidden')) return;
  if (!currentProject) return;
  const fonte = _regrasFonteAtual();
  if (!fonte) return;

  // ⚠️ NÃO RECARREGAR POR CIMA DE QUEM ESTÁ ESCREVENDO. Recarregar a árvore não
  // apaga o editor, mas trocar a árvore embaixo de quem digita rouba o foco e
  // desmarca a linha aberta. Enquanto o cursor estiver num campo desta aba, o
  // vigia espera — o próximo tique pega a mudança do mesmo jeito.
  const foco = document.activeElement;
  if (foco && aba.contains(foco) && /^(INPUT|TEXTAREA)$/.test(foco.tagName)) return;

  let r;
  try {
    r = await window.pywebview.api.carimbo_do_acervo(currentProject, fonte.caminho);
  } catch (e) { return; }
  if (!r || !r.success) return;

  // A primeira leitura só ANOTA. Sem isto, o primeiro tique depois de abrir a
  // aba recarregaria a árvore sempre, sem nada ter mudado.
  if (_regrasCarimbo === null) { _regrasCarimbo = r.carimbo; return; }
  if (r.carimbo === _regrasCarimbo) return;
  _regrasCarimbo = r.carimbo;

  // O que estava aberto volta marcado: `loadRegrasTree` recria a instância da
  // árvore, e com ela some a linha selecionada.
  const abertoAntes = _regraArquivoAcervo && _regraArquivoAcervo.caminho;
  await loadRegrasTree();
  if (_regrasArvore && abertoAntes) _regrasArvore.expandirAte(abertoAntes);
}
