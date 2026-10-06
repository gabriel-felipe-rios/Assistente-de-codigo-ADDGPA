// ═══════════════════ Configurações → Arquivos que o programa lê — a CASCA ══
// O estado das vistas, a troca de vista, o Salvar e os ajudantes que elas
// usam. Cada vista desenha num arquivo próprio:
//
// | Arquivo | A pergunta |
// |---|---|
// | `config-extensoes.js` (este) | estado, vista aberta, Salvar, Restaurar, ajudantes |
// | `config-arquivos-lidos-nunca.js` | o que o programa nem enxerga |
// | `config-arquivos-lidos-codigo.js` | o que conta como código, por linguagem |
// | `config-arquivos-lidos-excecoes.js` | o que cada parte acrescenta e retira da lista de onde parte |
// | `config-arquivos-lidos-quem.js` | quem lê o quê — só leitura, não grava |
//
// ⚠️ Nada é salvo em disco enquanto o usuário não clica em Salvar. Marcar uma
// caixa muda só o rascunho em memória — aqui um clique errado mexeria nos
// números de TODOS os projetos. O Salvar grava SÓ as vistas que mudaram, uma
// por arquivo, e repinta com o que o backend devolveu.
//
// ⚠️ O prefixo `_ext*` é desta tela. As extensões do PROGRAMA usam `xt*`
// (aviso em `backend/modulos/extensoes/constantes.py`): um `_extAlgo` lá
// sobrescreveria um daqui em silêncio.

// O rascunho de cada vista que grava, e o de fábrica (tracejado = veio de fábrica).
let _extNunca = null;
let _extCodigo = null;
let _extExcecoes = null;
// As bases das Exceções que o backend sabe (as duas buscas visuais e a de
// usos) — a da Documentação Técnica sai do rascunho de O que é código.
let _extBases = null;
let _extPadrao = null;
// Vistas com mudança ainda não salva ('nunca' | 'codigo' | 'excecoes').
const _extSujas = new Set();
let _extVistaAberta = 'nunca';
// Quais grupos de O que é código estão abertos — repintar não pode fechar o
// que o usuário acabou de abrir.
const _extGruposAbertos = new Set();

// As quatro vistas da tela, na ordem da barra (D38).
const EXT_VISTAS_DA_TELA = ['nunca', 'codigo', 'excecoes', 'quem'];
// As que gravam → o nome delas no backend e no arquivo. Quem lê o quê não grava.
const EXT_VISTAS = { nunca: 'nunca_ler', codigo: 'o_que_e_codigo', excecoes: 'excecoes' };

async function initConfigExtensoes() {
  const r = await window.pywebview.api.load_arquivos_lidos();
  if (!r || !r.success) {
    showToast('Erro ao ler os arquivos que o programa lê.', true);
    return;
  }
  _extAdotarEstado(r);

  const vistas = document.getElementById('ext-vistas');
  if (vistas && !vistas._wired) {
    vistas._wired = true;
    vistas.addEventListener('click', e => {
      const botao = e.target.closest('[data-ext-vista]');
      if (botao) extMostrarVista(botao.dataset.extVista);
    });
  }
  _extNuncaLigar();
  _extCodigoLigar();

  const salvar = document.getElementById('btn-save-extensoes');
  if (salvar && !salvar._wired) {
    salvar._wired = true;
    salvar.addEventListener('click', salvarConfigExtensoes);
  }
  _extDesenharTudo();
  extMostrarVista(_extVistaAberta);
}

// Pública: o botão dos cartões de rotina ("Configurações › Arquivos que o
// programa lê", rotinas-comum.js) chama isto para abrir direto em Exceções.
function extMostrarVista(vista) {
  if (!EXT_VISTAS_DA_TELA.includes(vista)) return;
  _extVistaAberta = vista;
  document.querySelectorAll('#ext-vistas [data-ext-vista]').forEach(b => {
    b.classList.toggle('active', b.dataset.extVista === vista);
  });
  EXT_VISTAS_DA_TELA.forEach(v => {
    const painel = document.getElementById('ext-vista-' + v);
    if (painel) painel.classList.toggle('hidden', v !== vista);
  });
}

function _extAdotarEstado(r) {
  _extNunca = r.nunca_ler;
  _extCodigo = r.o_que_e_codigo;
  _extExcecoes = r.excecoes;
  _extBases = r.bases;
  _extPadrao = r.padrao;
  _extSujas.clear();
}

function _extDesenharTudo() {
  _extNuncaDesenhar();
  _extCodigoDesenhar();
  _extExcecoesDesenhar();
  _extQuemDesenhar();
}

function _extMarcarSuja(vista) {
  _extSujas.add(vista);
  // A base da Documentação Técnica é a lista de código, e a tabela de Quem
  // lê o quê conta as duas: mudar uma repinta as outras.
  if (vista === 'codigo') _extExcecoesDesenhar();
  if (vista === 'codigo' || vista === 'excecoes') _extQuemDesenhar();
}

// ── Salvar / restaurar ─────────────────────────────────────────────────────

async function salvarConfigExtensoes() {
  // Sem nada pendente, regrava as três que gravam e confirma — nenhuma categoria tem um
  // "Salvar" que não faz nada (Padrões de interface › Exceções).
  const vistas = _extSujas.size ? [..._extSujas] : Object.keys(EXT_VISTAS);
  const rascunho = { nunca: _extNunca, codigo: _extCodigo, excecoes: _extExcecoes };
  for (const vista of vistas) {
    const r = await window.pywebview.api.save_arquivos_lidos(EXT_VISTAS[vista], rascunho[vista]);
    if (!r || !r.success) {
      showToast('Erro ao salvar os arquivos que o programa lê.', true);
      return;
    }
    // O backend devolve o estado final já normalizado — é ele que a tela pinta.
    if (vista === 'nunca') _extNunca = r.dados;
    if (vista === 'codigo') _extCodigo = r.dados;
    if (vista === 'excecoes') _extExcecoes = r.dados;
    _extSujas.delete(vista);
  }
  _extDesenharTudo();
  showToast('Arquivos que o programa lê salvos!');
}

// Ponto de entrada do "Restaurar padrão" central (`config-categorias.js`): o
// backend devolve as três vistas de fábrica, e a tela pinta só o que voltou.
function _extAdotarConfig(r) {
  if (!r || !r.nunca_ler) return;
  _extAdotarEstado(r);
  _extDesenharTudo();
}

// ── Ajudantes das três vistas ──────────────────────────────────────────────

// Extensão ganha o ponto e perde a caixa; lixo vira ''.
function _extNormalizarExt(termo) {
  const t = String(termo || '').trim().toLowerCase();
  if (!t) return '';
  return t.startsWith('.') ? t : '.' + t;
}

// A lista de código: linguagens + formatos + soltas − desmarcadas. Calculada
// aqui do rascunho, para a tela refletir o que ainda não foi salvo.
function _extListaDeCodigo() {
  if (!_extCodigo) return [];
  const fora = new Set(_extCodigo.desmarcadas);
  return [
    ..._extCodigo.linguagens.flatMap(l => l.extensoes),
    ..._extCodigo.formatos_especiais,
    ..._extCodigo.extensoes_soltas,
  ].filter(e => !fora.has(e));
}

// Um chip com ×. Tracejado = veio de fábrica.
function _extChip(texto, dePadrao, aoTirar, titulo) {
  const chip = document.createElement('span');
  chip.className = 'ext-chip' + (dePadrao ? ' padrao' : '');
  chip.appendChild(document.createTextNode(texto));
  if (aoTirar) {
    const x = document.createElement('span');
    x.className = 'x';
    x.textContent = '×';
    x.title = titulo || 'Tirar da lista';
    x.addEventListener('click', aoTirar);
    chip.appendChild(x);
  }
  return chip;
}

// Campo + botão: Enter faz o mesmo que o botão — quem está digitando uma lista
// de nomes não quer tirar a mão do teclado a cada item.
function _extLigarCampo(idCampo, botao, acao) {
  const campo = document.getElementById(idCampo);
  if (botao && !botao._wired) {
    botao._wired = true;
    botao.addEventListener('click', acao);
  }
  if (campo && !campo._wired) {
    campo._wired = true;
    campo.addEventListener('keydown', e => { if (e.key === 'Enter') acao(); });
  }
}

// Grupos expansíveis com caixa tri-estado — a mesma mecânica que a antiga aba
// Configurar do Espelho tinha (saiu em 23/09/2026). `grupos` = [{chave, rotulo,
// exts}]; `marcada(ext)` e `aoMarcar(ext, bool)` ligam ao rascunho; `extra`
// recebe o corpo aberto do grupo para acrescentar o que for dele (o campo
// "＋ extensão" das linguagens). `somenteLeitura` desliga as caixas.
function _extPintarGrupos(container, grupos, marcada, aoMarcar, opcoes = {}) {
  if (!container) return;
  container.innerHTML = '';
  for (const grupo of grupos) {
    const chaveAberto = (opcoes.prefixo || '') + grupo.chave;
    const contar = () => grupo.exts.filter(marcada).length;

    const wrap = document.createElement('div');
    wrap.className = 'rc-config-group';
    const header = document.createElement('div');
    header.className = 'rc-config-group-header';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.disabled = !!opcoes.somenteLeitura;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'agente-preview-toggle';
    toggle.innerHTML = `<span>${escapeHtml(grupo.rotulo)}</span>`
      + `<span class="rc-grupo-cont"></span>`
      + `<span class="agente-preview-arrow">▸</span>`;
    const cont = toggle.querySelector('.rc-grupo-cont');
    const repintarCabeca = () => {
      const n = contar();
      cb.checked = grupo.exts.length > 0 && n === grupo.exts.length;
      cb.indeterminate = n > 0 && n < grupo.exts.length;
      cont.textContent = `${n}/${grupo.exts.length}`;
    };
    header.appendChild(cb);
    header.appendChild(toggle);
    wrap.appendChild(header);

    const body = document.createElement('div');
    body.className = 'agente-preview-body' + (_extGruposAbertos.has(chaveAberto) ? '' : ' hidden');
    for (const ext of grupo.exts) {
      const row = document.createElement('label');
      row.className = 'rc-config-ext-row';
      const extCb = document.createElement('input');
      extCb.type = 'checkbox';
      extCb.checked = marcada(ext);
      extCb.disabled = !!opcoes.somenteLeitura;
      extCb.addEventListener('change', () => {
        aoMarcar(ext, extCb.checked);
        repintarCabeca();
      });
      row.appendChild(extCb);
      row.appendChild(document.createTextNode(' ' + ext));
      body.appendChild(row);
    }
    if (opcoes.extra) opcoes.extra(body, grupo);
    wrap.appendChild(body);
    toggle.querySelector('.agente-preview-arrow').textContent =
      _extGruposAbertos.has(chaveAberto) ? '▾' : '▸';

    toggle.addEventListener('click', () => {
      const aberto = !body.classList.contains('hidden');
      body.classList.toggle('hidden', aberto);
      toggle.querySelector('.agente-preview-arrow').textContent = aberto ? '▸' : '▾';
      if (aberto) _extGruposAbertos.delete(chaveAberto);
      else _extGruposAbertos.add(chaveAberto);
    });
    cb.addEventListener('change', () => {
      grupo.exts.forEach(e => aoMarcar(e, cb.checked));
      body.querySelectorAll('.rc-config-ext-row input').forEach(i => { i.checked = cb.checked; });
      repintarCabeca();
    });
    repintarCabeca();
    container.appendChild(wrap);
  }
}
