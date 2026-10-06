// ══════════════════════════════════ CONFIGURAÇÕES: Preparar projeto (lógica)
// Carregar, editar e salvar os inícios rápidos.
//
// A edição é toda em memória (`_cprPresets`), e só o botão Salvar escreve — o
// mesmo desenho de "Desempenho dos mapas": trocar de pílula não pode gravar meio
// início rápido, e o usuário fica a meio de digitar um caminho o tempo todo.
//
// ⚠️ ISTO ERA "os presets do Preparar", e respondia TRÊS perguntas: para onde as
// coisas vão, quais itens vão, e qual o texto do CLAUDE.md. Desde 2026-09-02
// responde só a do meio. O "para onde" é do ASSISTENTE EXTERNO, e o texto virou
// um item da biblioteca — o início rápido só APONTA para os dois.

// ⚠️ Gêmeo de `_PRESET_CHARS_PROIBIDOS` em `backend/modulos/arquivos.py`. `/` e
// `\` ficam de fora de propósito: aqui eles são separador, não conteúdo. Quem
// GARANTE é o backend; esta lista só evita que o caractere entre no campo.
//
// ── Este arquivo era 942 linhas, e virou quatro ────────────────────────────
//
// Pelo teto de 500 da AMF. Cada um responde uma pergunta:
//
//   config-preparar.js             o estado, a montagem e a pintura geral
//   config-preparar-biblioteca.js  o que o preset copia, a árvore e a busca
//   config-preparar-eventos.js     a validação e a ligação dos campos
//   config-preparar-presets.js     criar, renomear, duplicar, excluir, salvar
//
// ⚠️ SÃO SCRIPTS CLÁSSICOS, NÃO MÓDULOS: as funções e os `let` do topo
// continuam globais, e uma função de um arquivo chama a de outro exatamente
// como chamava antes. O `index.html` carrega os quatro na ordem acima.
//
// ⚠️ O ESTADO MORA TODO AQUI. `_cprPresets`, `_cprSelecionado`, `_cprBiblioteca`
// e as constantes `CPR_*` ficam neste arquivo; os outros três leem e escrevem
// neles. Um `let` migrado para o arquivo que mais o usa viraria a pergunta
// "onde é que se declara isso mesmo?" — e a resposta hoje é uma só.
const CPR_CHARS_PROIBIDOS = ':*?"<>|';

let _cprPresets = [];
let _cprPadrao = null;
let _cprSelecionado = null;
// As SEIS categorias, vindas do backend: `{kind, rotulo, escolha_unica,
// tem_origem}`. Não são escritas aqui de propósito — duas listas de categoria
// divergem na primeira mudança, e as duas exceções (a marca de origem em só
// quatro, a escolha única em uma) viram `if` por nome de categoria no dia em
// que a tela decidir sozinha.
let _cprTipos = [];
// Os assistentes, para o seletor e para o espelho só-leitura dos destinos.
let _cprAssistentes = [];
// A biblioteca inteira, por categoria: `{kind: [{name, rotulo, grupo, origem}]}`.
// Vem junto do `load_inicio_rapido_config` e NÃO é do início rápido — é a lista
// de tudo que existe para marcar. Fica fora de `_cprPresets` de propósito:
// salvar o início rápido não pode gravar a biblioteca de volta.
let _cprBiblioteca = {};
let _cprTipoAberto = null;
// Qual sub-aba de origem está aberta: `'programa'`, `'geral'` ou `'fixos'`.
// Sobrevive à troca de categoria de propósito — quem está montando a partir dos
// itens gerais não quer voltar para "Favoritos" a cada aba. ⚠️ `'fixos'` só
// existe em `mcps`; ao sair dessa categoria a escolha volta para `'programa'`,
// senão a lista abriria vazia numa aba que nem está desenhada.
let _cprOrigemAberta = 'programa';

// Os dois MCPs que o programa traz prontos. ⚠️ Eles têm `origem: 'programa'` no
// metadado, mas NÃO são "Favoritos": na aba Arquivos eles saem das duas listas
// e viram uma terceira sub-aba própria, "Do programa" (D13). Aqui é a MESMA
// divisão, pelo mesmo motivo — duas telas que mostram a mesma biblioteca com
// abas diferentes é o usuário procurando um item onde ele não está.
// `ARQ_MCPS_DO_PROGRAMA` vem de `arquivos.js`, e é de lá de propósito: duas
// listas do mesmo par divergem na primeira mudança.
function _cprEhFixo(kind, item) {
  return kind === 'mcps'
    && typeof ARQ_MCPS_DO_PROGRAMA !== 'undefined'
    && ARQ_MCPS_DO_PROGRAMA.includes((item.name || '').toLowerCase());
}

// O rótulo de cada origem, na ordem em que as sub-abas aparecem.
const CPR_ORIGENS = { programa: 'Favoritos', geral: 'Gerais', fixos: 'Do programa' };
// Grupos retraídos, por `"kind/grupo"`. ⚠️ Vive FORA da pintura, e é isso que
// faz a dobra sobreviver ao redesenho — e à busca, que não redesenha.
const _cprGruposFechados = new Set();
// O texto da busca da categoria aberta. Zerado ao trocar de categoria.
let _cprBusca = '';

// ── A categoria de um item, sem acento ──────────────────────────────────────
// ⚠️ SÓ AQUI. A busca do cartão ignora acento porque quem digita "padroes"
// procurando "Padrões de interface" está certo, e uma lista que não acha o que
// está à vista parece quebrada. O `grep` do MCP continua NÃO dobrando acento —
// lá o acento é o dado, e dobrá-lo daria resultado que o usuário não pediu.
function _cprSemAcento(texto) {
  return (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

async function initConfigPreparar() {
  if (!document.getElementById('cpr-pills')) return;
  const r = await window.pywebview.api.load_inicio_rapido_config();
  if (!r || !r.success) return;
  _cprPresets = r.presets || [];
  _cprPadrao = r.padrao;
  _cprBiblioteca = r.biblioteca || {};
  _cprTipos = r.categorias || [];
  _cprAssistentes = r.assistentes || [];
  if (!_cprTipos.some(t => t.kind === _cprTipoAberto)) {
    _cprTipoAberto = (_cprTipos[0] || {}).kind || null;
  }
  // Depois de "Restaurar padrao" o início rápido selecionado pode não existir mais.
  if (!_cprPresets.some(p => p.nome === _cprSelecionado)) {
    _cprSelecionado = (_cprPresets[0] || {}).nome || null;
  }
  _cprLigarEventos();
  _cprPintar();
}

function _cprPreset() {
  return _cprPresets.find(p => p.nome === _cprSelecionado) || null;
}

function _cprTipo(kind) {
  return _cprTipos.find(t => t.kind === kind) || { kind, rotulo: kind, escolha_unica: false, tem_origem: true };
}

// ── Pintura ─────────────────────────────────────────────────────────────────
function _cprPintar() {
  const pills = document.getElementById('cpr-pills');
  if (pills) {
    pills.innerHTML = _cprPresets.map(p => `
      <button type="button" class="cpr-pill${p.nome === _cprSelecionado ? ' sel' : ''}"
              data-cpr-preset="${escapeHtml(p.nome)}">${escapeHtml(p.nome)}</button>`).join('')
      + `<button type="button" class="cpr-pill cpr-pill-novo" id="btn-cpr-novo">+ Novo início rápido</button>`;
  }

  const preset = _cprPreset();
  const nomeEl = document.getElementById('cpr-editando-nome');
  if (nomeEl) {
    // Pode ter virado <input> pelo Renomear: devolve o <b> antes de escrever.
    if (nomeEl.tagName === 'INPUT') {
      const b = document.createElement('b');
      b.id = 'cpr-editando-nome';
      nomeEl.replaceWith(b);
    }
    document.getElementById('cpr-editando-nome').textContent = preset ? preset.nome : '—';
  }
  if (!preset) {
    // Lista vazia é um estado legítimo (dá para excluir todos). Limpar o que
    // ficou na tela é obrigatório: sem isto os cartões abaixo continuariam
    // mostrando o último início rápido, que já não existe.
    ['cpr-espelho', 'cpr-bib', 'cpr-bib-abas', 'cpr-bib-barra', 'cpr-bib-busca']
      .forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    _cprPintarPastas('raiz', []);
    _cprPintarPastas('trabalho', []);
    _cprPintarErros();
    return;
  }

  document.querySelectorAll('[data-cpr-campo]').forEach(el => {
    el.value = preset[el.dataset.cprCampo] || '';
  });
  _cprPintarAssistente();
  _cprPintarBiblioteca();

  const base = document.getElementById('cpr-base-trabalho');
  if (base) base.textContent = (preset.pasta_trabalho || '').trim() || 'a pasta de trabalho acima';

  _cprPintarPastas('raiz', preset.pastas_raiz || []);
  _cprPintarPastas('trabalho', preset.pastas_trabalho || []);
  _cprPintarErros();
}

// ── O assistente, e o espelho só-leitura dos destinos dele ──────────────────
function _cprPintarAssistente() {
  const preset = _cprPreset();
  const sel = document.getElementById('cpr-assistente');
  const espelho = document.getElementById('cpr-espelho');
  if (!preset || !sel) return;

  const nomes = _cprAssistentes.map(a => a.nome);
  // ⚠️ Nome que não existe mais cai no primeiro, e o seletor MOSTRA a queda em
  // vez de ficar em branco: "Restaurar padrão" devolve inícios rápidos
  // apontando para nomes de fábrica, que o usuário pode ter renomeado.
  const escolhido = nomes.includes(preset.assistente) ? preset.assistente : (nomes[0] || '');
  if (escolhido !== preset.assistente) preset.assistente = escolhido;
  sel.innerHTML = _cprAssistentes.map(a =>
    `<option value="${escapeHtml(a.nome)}"${a.nome === escolhido ? ' selected' : ''}>${escapeHtml(a.nome)}</option>`
  ).join('') || '<option value="">Nenhum assistente cadastrado</option>';

  if (!espelho) return;
  const assistente = _cprAssistentes.find(a => a.nome === escolhido);
  if (!assistente) { espelho.innerHTML = ''; return; }
  // ⛔ A MESMA estrutura da grade de Assistentes externos (`.cfa-linha`), e por
  // isso sem uma linha de CSS nova. Só que com `<span>` no lugar do `<input>`:
  // editar aqui recriaria a segunda verdade que a fusão de 2026-09-02 desfez.
  espelho.innerHTML = _cprTipos.filter(t => t.kind !== 'regras-instrucoes').map(t => {
    const cat = (assistente.categorias || {})[t.kind] || {};
    const destino = (cat.destino || '').trim();
    const entrada = (cat.arquivo_de_entrada || '').trim();
    const texto = destino
      ? escapeHtml(destino)
      : (t.kind === 'instrucoes-base'
          ? '<i>a raiz do projeto</i>'
          : '<i>este assistente não usa esta categoria</i>');
    return `
      <div class="cfa-linha">
        <div class="cfa-linha-nome">${escapeHtml(t.rotulo)}</div>
        <div class="cfa-linha-campos cfa-linha-campos-simples">
          <label class="cfa-campo-largo">
            <span>Destino${entrada ? ' · arquivo de entrada' : ''}</span>
            <span class="cpr-espelho-valor">${texto}${entrada ? ' · <b>' + escapeHtml(entrada) + '</b>' : ''}</span>
          </label>
        </div>
      </div>`;
  }).join('');
}

