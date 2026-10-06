// ══════════════════════════════════ CONFIGURAÇÕES: Acervo (lógica)
// Carregar, editar e salvar os presets de pastas do Acervo. Mesmo desenho de
// `config-preparar.js`: edição toda em memória (`_acpPresets`), só o botão
// Salvar escreve.
//
// ⚠️ `.regras-pasta-linha` (em `estilos/regras.css`) é usada SÓ AQUI. O
// comentário antigo dizia que a aba Acervo também a usava, no seletor de
// preset — não usa: lá o preset se escolhe num `<select>`, e a aba nunca edita
// a lista de pastas. O CSS ficou naquele arquivo por causa do prefixo do nome.

let _acpPresets = [];
let _acpSelecionado = null;
// A função que fecha o Renomear em curso, ou `null` quando não há nenhum aberto.
// Existe porque quem confirma o rename deixou de ser só o `blur` do campo — ver
// o ⚠️ do `mousedown` das pílulas, em `_acpLigarEventos`.
let _acpRenomeando = null;

// ⚠️ AS DUAS LEITURAS PEDEM `incluir_extensoes = false`, e isso não é
// detalhe: esta tela EDITA a lista de presets e a regrava INTEIRA em
// `save_acervo_presets`. Um preset trazido por extensão que aparecesse aqui
// seria copiado para dentro do `settings.json` no primeiro "Salvar", e
// continuaria lá depois de a extensão ser desligada ou apagada.
//
// Quem enxerga os das extensões é a ABA Acervo (`regras.js`), que só lê.
async function initConfigAcervo() {
  if (!document.getElementById('acp-pills')) return;
  // ⚠️ `try` E NÃO SÓ `if (!r.success)`. Um erro do lado Python não volta como
  // `{success:false}` — a ponte do pywebview REJEITA a promessa, e o `await`
  // estoura aqui. Sem o `catch`, a função morre no meio, calada: foi assim que
  // um `NameError` em `regras_acervo.py` deixou esta categoria inteira sem
  // eventos ligados, sem nada gravar e sem uma mensagem sequer na tela.
  let r;
  try {
    r = await window.pywebview.api.load_acervo_config(null, false);
  } catch (e) {
    r = { success: false, error: String((e && e.message) || e) };
  }

  // ⚠️ OS EVENTOS SE LIGAM ANTES DA CONFERÊNCIA, E NÃO DEPOIS. Enquanto o
  // `return` da falha vinha primeiro, uma leitura que desse errado deixava a
  // categoria INTEIRA sem um botão ligado — e sem dizer nada na tela: o
  // usuário clicava em "+ Novo preset", em "Renomear", no Salvar, e nada
  // acontecia, sem erro nenhum para procurar.
  _acpLigarEventos();

  if (!r || !r.success) {
    _acpPresets = [];
    _acpSelecionado = null;
    _acpPintar();
    _acpAvisar('Não deu para ler os presets do Acervo: ' + ((r && r.error) || 'erro desconhecido'));
    showToast('Não deu para ler os presets do Acervo.', true);
    return;
  }

  _acpPresets = r.presets || [];
  // Depois de "Restaurar padrão" o preset selecionado pode não existir mais.
  if (!_acpPresets.some(p => p.nome === _acpSelecionado)) {
    _acpSelecionado = (_acpPresets[0] || {}).nome || null;
  }
  _acpPintar();
  _acpAvisar('');
}

/** A faixa de erro da categoria. Texto vazio some com ela. */
function _acpAvisar(msg) {
  const lista = document.getElementById('acp-pastas-lista');
  if (!lista) return;
  let faixa = document.getElementById('acp-aviso');
  if (!msg) { if (faixa) faixa.remove(); return; }
  if (!faixa) {
    faixa = document.createElement('div');
    faixa.id = 'acp-aviso';
    faixa.className = 'config-erro';
    lista.parentNode.insertBefore(faixa, lista);
  }
  faixa.textContent = msg;
}

function _acpPreset() {
  return _acpPresets.find(p => p.nome === _acpSelecionado) || null;
}

function _acpNomeLivre(base) {
  let nome = base, n = 1;
  while (_acpPresets.some(p => p.nome === nome)) { n += 1; nome = `${base} ${n}`; }
  return nome;
}

// ── Pintura ─────────────────────────────────────────────────────────────────
function _acpPintar() {
  const pills = document.getElementById('acp-pills');
  if (pills) {
    pills.innerHTML = _acpPresets.map(p => `
      <button type="button" class="cpr-pill${p.nome === _acpSelecionado ? ' sel' : ''}"
              data-acp-preset="${escapeHtml(p.nome)}">${escapeHtml(p.nome)}</button>`).join('')
      + `<button type="button" class="cpr-pill cpr-pill-novo" id="btn-acp-novo">+ Novo preset</button>`;
  }

  const preset = _acpPreset();
  const nomeEl = document.getElementById('acp-editando-nome');
  if (nomeEl) {
    // Pode ter virado <input> pelo Renomear: devolve o <b> antes de escrever.
    if (nomeEl.tagName === 'INPUT') {
      const b = document.createElement('b');
      b.id = 'acp-editando-nome';
      nomeEl.replaceWith(b);
    }
    document.getElementById('acp-editando-nome').textContent = preset ? preset.nome : '—';
  }

  const acoes = document.getElementById('acp-pill-acoes');
  if (acoes) acoes.classList.toggle('hidden', !preset);

  _acpPintarPastas(preset ? preset.pastas || [] : []);
}

function _acpPintarPastas(pastas) {
  const lista = document.getElementById('acp-pastas-lista');
  if (!lista) return;
  lista.innerHTML = pastas.map((p, i) => `
    <div class="regras-pasta-linha" data-i="${i}">
      <input type="text" class="regras-pasta-campo" data-campo="titulo" data-i="${i}" value="${escapeHtml(p.titulo || '')}" placeholder="Nome de exibição">
      <input type="text" class="regras-pasta-campo" data-campo="caminho" data-i="${i}" value="${escapeHtml(p.caminho || '')}" placeholder="Caminho a partir da raiz do projeto">
      <label class="regras-pasta-editavel"><input type="checkbox" data-campo="editavel" data-i="${i}"${p.editavel ? ' checked' : ''}> Editável</label>
      <button type="button" class="btn-icon regras-pasta-remover" data-i="${i}" title="Remover pasta">✕</button>
    </div>`).join('');
}

// ── Eventos ──────────────────────────────────────────────────────────────────
function _acpLigarEventos() {
  const secao = document.getElementById('config-secao-acervo');
  if (!secao || secao._wired) return;
  secao._wired = true;

  // ⚠️ A PÍLULA RESPONDE NO `mousedown`, NUNCA NO `click`. Com um Renomear
  // aberto, o `blur` do campo dispara ANTES do `click`, chama `confirmar()` e
  // repinta as pílulas — o `mouseup` então cai num elemento que já saiu do DOM,
  // o `click` nunca nasce, e o clique do usuário some. É a mesma armadilha
  // registrada em Padrões de interface › Componentes › Seletor de projeto.
  secao.addEventListener('mousedown', e => {
    const pill = e.target.closest('[data-acp-preset]');
    if (!pill) return;
    const nome = pill.dataset.acpPreset;   // lido AGORA: o repintar troca o DOM
    // `preventDefault` tira o `blur` de cena — é o que impede o repintar no meio
    // do clique. Em troca, o Renomear aberto precisa ser confirmado aqui, à mão.
    e.preventDefault();
    if (_acpRenomeando) _acpRenomeando();
    // Se o clique foi na pílula que acabou de ser renomeada, o nome antigo já
    // não existe — nesse caso vale o que o próprio Renomear selecionou.
    if (_acpPresets.some(p => p.nome === nome)) _acpSelecionado = nome;
    _acpPintar();
  });

  secao.addEventListener('click', e => {
    if (e.target.closest('[data-acp-preset]')) return;   // já tratado no mousedown
    if (e.target.closest('#btn-acp-novo')) return _acpNovo();
    if (e.target.closest('#btn-acp-renomear')) return _acpRenomear();
    if (e.target.closest('#btn-acp-duplicar')) return _acpDuplicar();
    if (e.target.closest('#btn-acp-excluir')) return _acpExcluir();
    if (e.target.closest('#btn-acp-pasta-add')) return _acpAdicionarPasta();

    const rm = e.target.closest('.regras-pasta-remover');
    if (rm) {
      const preset = _acpPreset();
      if (!preset) return;
      (preset.pastas || []).splice(Number(rm.dataset.i), 1);
      _acpPintarPastas(preset.pastas || []);
    }
  });

  secao.addEventListener('input', e => {
    const preset = _acpPreset();
    if (!preset || !e.target.dataset.campo || e.target.dataset.campo === 'editavel') return;
    const i = Number(e.target.dataset.i);
    preset.pastas = preset.pastas || [];
    preset.pastas[i] = preset.pastas[i] || {};
    preset.pastas[i][e.target.dataset.campo] = e.target.value;
  });

  secao.addEventListener('change', e => {
    const preset = _acpPreset();
    if (!preset || e.target.dataset.campo !== 'editavel') return;
    const i = Number(e.target.dataset.i);
    preset.pastas = preset.pastas || [];
    preset.pastas[i] = preset.pastas[i] || {};
    preset.pastas[i].editavel = e.target.checked;
  });

  const btn = document.getElementById('btn-save-acervo');
  if (btn && !btn._wired) { btn._wired = true; btn.addEventListener('click', salvarConfigAcervo); }
}

function _acpAdicionarPasta() {
  const preset = _acpPreset();
  if (!preset) return;
  preset.pastas = preset.pastas || [];
  preset.pastas.push({ titulo: '', caminho: '', editavel: true });
  _acpPintarPastas(preset.pastas);
}

function _acpNovo() {
  const nome = _acpNomeLivre('Novo preset');
  _acpPresets.push({ nome, pastas: [] });
  _acpSelecionado = nome;
  _acpPintar();
}

// Renomear é INLINE, e não num diálogo — mesmo motivo de `_cprRenomear` em
// config-preparar.js: o `window.prompt` nativo não é confiável no WebView2.
function _acpRenomear() {
  const preset = _acpPreset();
  const linha = document.getElementById('acp-editando-nome');
  if (!preset || !linha || linha.tagName === 'INPUT') return;

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'acp-editando-nome';
  input.className = 'cpr-nome-input';
  input.value = preset.nome;
  linha.replaceWith(input);
  input.focus();
  input.select();

  let fechado = false;
  const confirmar = () => {
    if (fechado) return;
    fechado = true;
    _acpRenomeando = null;
    const nome = input.value.trim();
    if (nome && nome !== preset.nome) {
      if (_acpPresets.some(p => p.nome === nome)) {
        showToast('Já existe um preset do Acervo com esse nome.', true);
      } else {
        preset.nome = nome;
        _acpSelecionado = nome;
      }
    }
    _acpPintar();
  };
  _acpRenomeando = confirmar;
  input.addEventListener('blur', confirmar);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
    if (e.key === 'Escape') { fechado = true; _acpRenomeando = null; _acpPintar(); }
  });
}

function _acpDuplicar() {
  const preset = _acpPreset();
  if (!preset) return;
  const copia = JSON.parse(JSON.stringify(preset));
  copia.nome = _acpNomeLivre(preset.nome + ' (cópia)');
  _acpPresets.push(copia);
  _acpSelecionado = copia.nome;
  _acpPintar();
}

// Excluir PERGUNTA antes — é o único dos botões que destrói trabalho. Reusa
// `abrirModalPadrao`, o único construtor de modal genérico do programa.
function _acpExcluir() {
  const preset = _acpPreset();
  if (!preset) return;
  const nome = preset.nome;
  const pastas = (preset.pastas || []).length;

  abrirModalPadrao({
    title: `Excluir o preset "${nome}"?`,
    confirmLabel: 'Excluir',
    bodyHtml: `<div class="modal-body-text">Isto remove <strong>${escapeHtml(nome)}</strong> da lista${
      pastas ? `, junto com <strong>${pastas}</strong> pasta(s) registrada(s) nele` : ''
    }. Não dá pra desfazer.<br><br>Projeto que tiver este preset escolhido na aba Acervo passa a
      não ter preset nenhum (a aba fica vazia até escolher outro) — isso não é desfeito por este
      botão.<br><br>A exclusão só vale depois de <strong>Salvar presets do Acervo</strong> — até
      lá, sair da categoria sem salvar o traz de volta.</div>`,
    onConfirm: () => {
      _acpPresets = _acpPresets.filter(p => p.nome !== nome);
      _acpSelecionado = (_acpPresets[0] || {}).nome || null;
      _acpPintar();
      showToast(`Preset "${nome}" removido — salve para confirmar.`);
    },
  });
}

async function salvarConfigAcervo() {
  // ⚠️ PASTA SEM CAMINHO SUMIA EM SILÊNCIO. `save_acervo_presets` descarta na
  // normalização toda pasta com o caminho vazio — o Salvar dava o toast de
  // sucesso, e a linha desaparecia na repintura seguinte, sem nada dizer que
  // ela tinha sido jogada fora. Agora o Salvar para e mostra qual é.
  const semCaminho = [];
  _acpPresets.forEach(p => (p.pastas || []).forEach((pasta, i) => {
    if (!(pasta.caminho || '').trim()) semCaminho.push(`${p.nome} → linha ${i + 1}`);
  }));
  if (semCaminho.length) {
    _acpAvisar('Não dá para salvar com pasta sem caminho — preencha ou remova: '
               + semCaminho.join('; ') + '.');
    showToast('Há pasta sem caminho.', true);
    return;
  }

  // Mesmo ⚠️ do `initConfigAcervo`: o erro do Python chega como rejeição, e um
  // Salvar que estoura sem `catch` não dá notificação nenhuma — que foi
  // exatamente como este defeito se apresentou ao usuário.
  let r;
  try {
    r = await window.pywebview.api.save_acervo_presets(_acpPresets);
  } catch (e) {
    r = { success: false, error: String((e && e.message) || e) };
  }
  if (!r || !r.success) {
    _acpAvisar((r && r.error) || 'erro desconhecido');
    showToast('Não deu para salvar: ' + ((r && r.error) || 'erro desconhecido'), true);
    return;
  }

  // ⚠️ RELÊ O DISCO EM VEZ DE CONFIAR NO QUE MANDOU. `save_acervo_presets`
  // normaliza as barras do caminho e deriva o título de quem estava sem — nada
  // disso voltava para a tela, que passava a mostrar algo diferente do que
  // estava gravado. É o mesmo contrato de `restaurar_padroes`, que devolve o
  // estado final de propósito: repintar com o que foi de fato gravado, nunca
  // com o que deveria ter sido.
  const rr = await window.pywebview.api.load_acervo_config(null, false);
  if (rr && rr.success) {
    _acpPresets = rr.presets || [];
    if (!_acpPresets.some(p => p.nome === _acpSelecionado)) {
      _acpSelecionado = (_acpPresets[0] || {}).nome || null;
    }
    _acpPintar();
  }
  _acpAvisar('');
  showToast('Presets do Acervo salvos!');
}
