// ═══════════════════════════════════ Configurações → Acesso rápido ══
// Como a barra abre, onde, de que tamanho, e com que modos. Markup em
// `config-acesso-rapido-template.js`; a barra em si em `modulos/acesso-rapido.js`.
//
// As seis chaves moram no `settings.json` global, e não no workspace do
// projeto: são sobre como o usuário quer VER o programa, não sobre um projeto —
// mesmo critério de `tema` e das notificações.
//
// ── O que grava quando, e por quê ───────────────────────────────────────────
//
// A regra registrada é uma só: *"escolha visível e reversível num clique aplica
// na hora; quem tem campo de texto ou número só grava no botão"*.
//
// | Controle                        | Grava           |
// |---------------------------------|-----------------|
// | a tecla capturada na grade      | na hora (gesto) |
// | a caixa "Esconder o modo…"      | na hora         |
// | a grade 3×3 de posição          | na hora         |
// | o toggle de tamanho             | na hora         |
// | o Interruptor de cada modo      | na hora         |
// | a ORDEM dos modos (arraste)     | na solta        |
// | "Resultados por modo" (número)  | só no botão     |
//
// ⚠️ O botão "Salvar" REGRAVA O ESTADO INTEIRO e confirma em voz alta. Ele não
// existe só pelo campo numérico: sem ele, quem mexeu em seis controles não tem
// sinal nenhum de que algo foi para o disco. É o padrão de Notificações.
//
// ⚠️ O "Restaurar padrão" não se escreve: `registrarCategoriaConfig` o injeta, o
// clique já é delegado em `#config-barra-acoes`, e a repintura vem da tabela
// `_CONFIG_REPINTORES` (`config-categorias.js`).

function initConfigAcessoRapido() {
  _acrCfgPintarTeclas();
  _acrCfgPintarPosicao();
  _acrCfgPintarTamanho();
  _acrCfgPintarModos();
  _acrCfgPintarNumeros();

  // ⚠️ Cliques DELEGADOS no container, e não controle a controle: a grade de
  // teclas e a lista de modos são repintadas, e um listener por linha morre na
  // primeira repintura. A guarda `_wired` é o que impede o listener de ser
  // acrescentado de novo a cada abertura da aba.
  const grade = document.getElementById('acr-grade-teclas');
  if (grade && typeof ligarGradeDeTeclas === 'function') ligarGradeDeTeclas(grade);
  _acrCfgLigar('acr-grade-posicao', 'click', _acrCfgCliqueNaPosicao);
  _acrCfgLigar('acr-tamanho', 'click', _acrCfgCliqueNoTamanho);
  _acrCfgLigar('acr-modos', 'click', _acrCfgCliqueNosModos);
  _acrCfgLigar('acr-esconder-modos', 'change', _acrCfgTrocouEsconder);
  // As três caixas de "De quem é cada item" — cada uma grava a própria chave
  // no clique. Ver `_ACR_CFG_PREFIXOS`.
  Object.keys(_ACR_CFG_PREFIXOS).forEach((id) => {
    _acrCfgLigar(id, 'change', (ev) => salvarConfigAcessoRapido({ [_ACR_CFG_PREFIXOS[id]]: !!ev.target.checked }));
  });
  _acrCfgLigar('btn-save-acesso-rapido', 'click', salvarConfigAcessoRapidoPeloBotao);
}

// A caixa → a chave do `settings.json`. As três são do mesmo assunto ("de
// quem é cada item"), e uma tabela evita três funções iguais.
const _ACR_CFG_PREFIXOS = {
  'acr-prefixo-extensao': 'acesso_rapido_prefixo_extensao',
  'acr-prefixo-aba': 'acesso_rapido_prefixo_aba',
  'acr-titulo-menu': 'menu_contexto_titulo_extensao',
};
const _ACR_CFG_PREFIXOS_PADRAO = {
  acesso_rapido_prefixo_extensao: () => ACESSO_RAPIDO_PREFIXO_EXTENSAO_PADRAO,
  acesso_rapido_prefixo_aba: () => ACESSO_RAPIDO_PREFIXO_ABA_PADRAO,
  menu_contexto_titulo_extensao: () => MENU_CONTEXTO_TITULO_EXTENSAO_PADRAO,
};

function _acrCfgLigar(id, evento, acao) {
  const el = document.getElementById(id);
  if (!el || el._wired) return;
  el._wired = true;
  el.addEventListener(evento, acao);
}

// ── Gravar ──────────────────────────────────────────────────────────────────

/** Grava e atualiza o `appSettings` em memória. */
async function salvarConfigAcessoRapido(patch) {
  // ⚠️ `save_settings_parcial`, NUNCA `save_settings`: o segundo grava o JSON
  // inteiro a partir do que recebeu, e chamá-lo com uma chave apagaria todas as
  // outras. O sintoma é chave que "some sozinha" do disco, sem erro nenhum.
  const r = await window.pywebview.api.save_settings_parcial(patch);
  if (!r || !r.success) { showToast('Não foi possível gravar.', true); return false; }
  // ⚠️ Reatribuir o global é parte da gravação, não detalhe: a barra consulta
  // `appSettings.acesso_rapido_*` na hora de abrir. Sem isto a tela grava certo
  // e o programa continua se comportando pelo valor antigo até reabrir.
  appSettings = Object.assign({}, appSettings, patch);
  return true;
}

// Regrava o estado inteiro e confirma. É aqui — e só aqui — que o campo
// numérico vai para o disco.
async function salvarConfigAcessoRapidoPeloBotao() {
  const campo = document.getElementById('acr-resultados');
  // ⚠️ `?? PADRAO`, e não `|| PADRAO`: um campo vazio não pode virar `NaN`, que
  // o backend gravaria como `null` sem estourar nada — e apareceria um "Salvo!".
  const lido = campo ? parseInt(campo.value, 10) : NaN;
  const resultados = Number.isFinite(lido) && lido > 0
    ? lido : (appSettings.acesso_rapido_resultados ?? ACESSO_RAPIDO_RESULTADOS_PADRAO);

  const ok = await salvarConfigAcessoRapido({
    acesso_rapido_modos: _acrCfgModosAtuais(),
    acesso_rapido_posicao: appSettings.acesso_rapido_posicao ?? ACESSO_RAPIDO_POSICAO_PADRAO,
    acesso_rapido_tamanho: appSettings.acesso_rapido_tamanho ?? ACESSO_RAPIDO_TAMANHO_PADRAO,
    acesso_rapido_esconder_modos:
      appSettings.acesso_rapido_esconder_modos ?? ACESSO_RAPIDO_ESCONDER_MODOS_PADRAO,
    acesso_rapido_resultados: resultados,
    ...Object.fromEntries(Object.entries(_ACR_CFG_PREFIXOS_PADRAO)
      .map(([chave, padrao]) => [chave, appSettings[chave] ?? padrao()])),
  });
  if (ok) { _acrCfgPintarNumeros(); showToast('Acesso rápido salvo!'); }
}

// ── Cartão 1 · as duas teclas ───────────────────────────────────────────────
//
// ⚠️ A GRADE NÃO SE DESENHA MAIS AQUI. Ela morava neste arquivo porque esta
// categoria veio antes da "Teclado"; agora a Teclado existe, e a grade — a
// pintura, a captura, o ↺ e o selo — mora em `config-teclado.js`, que é a casa
// dela. Esta tela mostra a MESMA grade, filtrada nas duas teclas da barra.
//
// É uma configuração só, exibida em dois lugares. Escrever a segunda grade
// seria fazer a tecla que a tela mostra deixar de ser a tecla que dispara.
//
// ⚠️ Sem `_` no nome: `config-teclado.js` lê esta lista para saber o que
// repintar na grade curta quando uma tecla muda na grade inteira.
const ACR_CFG_TECLAS = ['acesso-rapido.abrir', 'acesso-rapido.comando'];

function _acrCfgPintarTeclas() {
  const grade = document.getElementById('acr-grade-teclas');
  if (grade && typeof pintarGradeDeTeclas === 'function') {
    pintarGradeDeTeclas(grade, ACR_CFG_TECLAS);
  }
}

async function _acrCfgTrocouEsconder(ev) {
  await salvarConfigAcessoRapido({ acesso_rapido_esconder_modos: !!ev.target.checked });
}

// ── Cartão 2 · onde e de que tamanho ────────────────────────────────────────

async function _acrCfgCliqueNaPosicao(ev) {
  const celula = ev.target.closest('.notif-grade-celula');
  if (!celula) return;
  await salvarConfigAcessoRapido({ acesso_rapido_posicao: celula.dataset.posicao });
  _acrCfgPintarPosicao();
}

async function _acrCfgCliqueNoTamanho(ev) {
  const btn = ev.target.closest('.mapa-toggle-btn');
  if (!btn) return;
  await salvarConfigAcessoRapido({ acesso_rapido_tamanho: btn.dataset.tamanho });
  _acrCfgPintarTamanho();
}

function _acrCfgPintarPosicao() {
  const atual = appSettings.acesso_rapido_posicao ?? ACESSO_RAPIDO_POSICAO_PADRAO;
  document.querySelectorAll('#acr-grade-posicao .notif-grade-celula').forEach((c) => {
    const aceso = c.dataset.posicao === atual;
    c.classList.toggle('active', aceso);
    c.setAttribute('aria-checked', aceso ? 'true' : 'false');
  });
  _acrCfgPintarPrevia();
}

// As medidas de cada tamanho, para a legenda e para a prévia. Gêmeas das
// classes `.acr--pequena/media/grande` de `estilos/acesso-rapido.css`: os
// números aparecem nos dois lugares porque um é o desenho e o outro é a frase
// que o explica.
const _ACR_CFG_MEDIDAS = {
  pequena: { largura: 420, altura: 40 },
  media:   { largura: 520, altura: 60 },
  grande:  { largura: 720, altura: 75 },
};

function _acrCfgPintarTamanho() {
  const atual = appSettings.acesso_rapido_tamanho ?? ACESSO_RAPIDO_TAMANHO_PADRAO;
  document.querySelectorAll('#acr-tamanho .mapa-toggle-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.tamanho === atual);
  });
  const medidas = _ACR_CFG_MEDIDAS[atual] || _ACR_CFG_MEDIDAS.media;
  const legenda = document.getElementById('acr-medidas');
  if (legenda) {
    legenda.textContent = `${medidas.largura}px de largura, no máximo `
                        + `${medidas.altura}% da altura da janela.`;
  }
  _acrCfgPintarPrevia();
}

// A prévia é um retângulo no lugar escolhido, dentro de uma moldura que
// representa a janela. Não é a barra de verdade de propósito: abri-la por cima
// desta tela taparia justamente os controles que se está mexendo.
function _acrCfgPintarPrevia() {
  const previa = document.getElementById('acr-previa');
  if (!previa) return;
  const posicao = appSettings.acesso_rapido_posicao ?? ACESSO_RAPIDO_POSICAO_PADRAO;
  const tamanho = appSettings.acesso_rapido_tamanho ?? ACESSO_RAPIDO_TAMANHO_PADRAO;
  previa.className = `acr-previa acr-previa--${posicao} acr-previa--${tamanho}`;
}

// ── Cartão 3 · os cinco modos ───────────────────────────────────────────────
//
// O subtítulo de cada modo é o que ele responde, em uma linha. Sem ele, cinco
// nomes seguidos não dizem qual é a diferença entre "Por conteúdo" e
// "Semântico" — que é justamente a escolha que o usuário faz aqui.
const _ACR_CFG_DESCRICOES = {
  comando:   'as ações do programa, buscáveis pelo nome',
  aba:       'as abas do projeto e as sub-abas delas',
  nome:      'arquivo do projeto pelo nome',
  conteudo:  'texto literal dentro dos arquivos',
  semantico: 'descreva o que o arquivo faz — lê a Documentação Técnica',
};

// A lista como está no settings, completada com o que faltar: um `settings.json`
// gravado antes de um modo existir vem sem ele, e o modo novo não pode sumir da
// tela por causa disso.
function _acrCfgModosDoSettings() {
  const gravados = appSettings.acesso_rapido_modos ?? ACESSO_RAPIDO_MODOS_PADRAO;
  const lista = gravados.filter((m) => ACESSO_RAPIDO_MODOS.some((d) => d.chave === m.chave));
  ACESSO_RAPIDO_MODOS.forEach((d) => {
    if (!lista.some((m) => m.chave === d.chave)) lista.push({ chave: d.chave, ligado: true });
  });
  return lista;
}

function _acrCfgPintarModos() {
  const lista = document.getElementById('acr-modos');
  if (!lista) return;
  lista.innerHTML = _acrCfgModosDoSettings().map((m) => {
    const def = ACESSO_RAPIDO_MODOS.find((d) => d.chave === m.chave);
    const on = !!m.ligado;
    // ⚠️ O Interruptor é `<label class="toggle-pill">` com a classe `.on` posta
    // pelo JS — nunca um `<input type="checkbox">` cru. É regra registrada.
    return `
      <div class="plugin-item" data-modo="${escapeHtml(m.chave)}">
        <span class="plugin-handle" title="Arrastar para reordenar">⠿</span>
        <div class="plugin-info">
          <div class="plugin-nome">${escapeHtml(def.rotulo)}</div>
          <div class="plugin-tipo">${escapeHtml(_ACR_CFG_DESCRICOES[m.chave] || '')}</div>
        </div>
        <label class="toggle-pill">
          <div class="toggle-track${on ? ' on' : ''}"><div class="toggle-knob"></div></div>
          <span class="toggle-label${on ? ' on' : ''}">${on ? 'Ligado' : 'Desligado'}</span>
        </label>
      </div>`;
  }).join('');
  _acrCfgLigarArraste(lista);
}

/** A ordem e o ligado/desligado como estão NO DOM agora. */
function _acrCfgModosAtuais() {
  const lista = document.getElementById('acr-modos');
  if (!lista) return _acrCfgModosDoSettings();
  return [...lista.querySelectorAll('.plugin-item')].map((el) => ({
    chave: el.dataset.modo,
    ligado: !!el.querySelector('.toggle-track.on'),
  }));
}

async function _acrCfgCliqueNosModos(ev) {
  const pill = ev.target.closest('.toggle-pill');
  if (!pill) return;
  const track = pill.querySelector('.toggle-track');
  const label = pill.querySelector('.toggle-label');
  const ligado = !track.classList.contains('on');
  track.classList.toggle('on', ligado);
  label.classList.toggle('on', ligado);
  label.textContent = ligado ? 'Ligado' : 'Desligado';
  await salvarConfigAcessoRapido({ acesso_rapido_modos: _acrCfgModosAtuais() });
}

// ⛔ O ARRASTE NÃO PODE SER HTML5. `dragstart`/`dragover` não disparam de forma
// confiável no WebView2 — bug conhecido da Microsoft, sem correção —, e por isso
// todo arraste deste projeto é `mousedown` no punho → `mousemove` no `document`
// → `mouseup`.
//
// Quem faz isso é `_pluginsWireDnd` (`config-plugins.js`), reusado inteiro: ele
// já traz as duas defesas obrigatórias, e as duas existem por defeito medido —
// o limiar de 4 px antes de começar (senão um clique com a mão trêmida reordena
// sem o usuário ver) e o "não mexer no DOM se o lugar não mudou" (senão o
// layout se refaz debaixo do cursor e o gesto treme).
//
// ⚠️ O que ele NÃO faz é avisar quando o arraste acaba: Plugins grava no botão.
// Aqui a ordem grava NA SOLTA, como nos Launchers, e é por isso que a gravação
// entra por um `mouseup` do documento — e só quando a ordem mudou de fato, para
// um clique qualquer na lista não virar uma gravação.
let _acrCfgOrdemAoLigar = null;

function _acrCfgLigarArraste(lista) {
  if (typeof _pluginsWireDnd !== 'function') return;
  _pluginsWireDnd(lista.parentElement, '.acr-modos-lista', ':scope > .plugin-handle');
  if (lista._wiredDnd) return;
  lista._wiredDnd = true;
  document.addEventListener('mouseup', async () => {
    if (!document.getElementById('acr-modos')) return;
    const agora = JSON.stringify(_acrCfgModosAtuais().map((m) => m.chave));
    if (agora === _acrCfgOrdemAoLigar) return;
    _acrCfgOrdemAoLigar = agora;
    await salvarConfigAcessoRapido({ acesso_rapido_modos: _acrCfgModosAtuais() });
  });
  _acrCfgOrdemAoLigar = JSON.stringify(_acrCfgModosAtuais().map((m) => m.chave));
}

// ── O campo numérico ────────────────────────────────────────────────────────
//
// ⚠️ O `max` NÃO pode ser menor que o padrão de fábrica: a tela grampearia o
// próprio padrão para baixo, e o usuário veria um número que nunca escolheu.
// O de fábrica é 20; o `max` do markup é 200.
function _acrCfgPintarNumeros() {
  const campo = document.getElementById('acr-resultados');
  if (campo) {
    campo.value = appSettings.acesso_rapido_resultados ?? ACESSO_RAPIDO_RESULTADOS_PADRAO;
  }
  const esconder = document.getElementById('acr-esconder-modos');
  if (esconder) {
    esconder.checked = appSettings.acesso_rapido_esconder_modos
                    ?? ACESSO_RAPIDO_ESCONDER_MODOS_PADRAO;
  }
  Object.entries(_ACR_CFG_PREFIXOS).forEach(([id, chave]) => {
    const caixa = document.getElementById(id);
    if (caixa) caixa.checked = !!(appSettings[chave] ?? _ACR_CFG_PREFIXOS_PADRAO[chave]());
  });
}
