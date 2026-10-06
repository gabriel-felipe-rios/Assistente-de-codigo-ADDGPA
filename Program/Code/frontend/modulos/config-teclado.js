// ═══════════════════════════════════════ Configurações → Teclado ══
// A tecla de cada comando do programa. Markup em `config-teclado-template.js`;
// o registro que alimenta esta tela em `modulos/teclas.js`.
//
// ⚠️ ESTE ARQUIVO É A CASA DA GRADE, e não só desta categoria. As três funções
// públicas abaixo — `pintarGradeDeTeclas`, `ligarGradeDeTeclas` e
// `teclasEmConflito` — são usadas TAMBÉM pela categoria "Acesso rápido", que
// mostra as duas teclas da barra na mesma grade. É uma configuração só, exibida
// em dois lugares: escrever a segunda grade seria fazer a tecla que a tela
// mostra deixar de ser a tecla que dispara.
//
// A ordem das tags `<script>` não importa para isso: quem chama é o `init` de
// cada categoria, e nessa hora os dois arquivos já carregaram.
//
// ⚠️ NÃO SE CHAMA "ATALHOS". `atalho` já é o termo interno dos Launchers
// (`atalhos_externos.py`), e a decisão está registrada no Vocabulário. Aqui a
// combinação é uma TECLA.
//
// ── O que grava quando ──────────────────────────────────────────────────────
//
// Todo controle desta tela é gesto direto — capturar uma combinação, clicar no
// ↺ —, então **tudo grava na hora**. O botão "Salvar" existe do mesmo jeito:
// regrava o estado atual e confirma em voz alta, porque *"nenhuma categoria
// fica sem Salvar"* e uma barra de ações diferente das outras vinte faz o
// usuário procurar o botão que não há.

function initConfigTeclado() {
  const grade = document.getElementById('teclado-grade');
  if (grade) {
    pintarGradeDeTeclas(grade, null);
    ligarGradeDeTeclas(grade);
  }
  const btn = document.getElementById('btn-save-teclado');
  if (btn && !btn._wired) {
    btn._wired = true;
    btn.addEventListener('click', salvarConfigTecladoPeloBotao);
  }
}

// Regrava o que já está gravado e confirma. Ver o ⚠️ do cabeçalho.
async function salvarConfigTecladoPeloBotao() {
  if (await gravarTeclasTrocadas(appSettings.teclas || {})) showToast('Teclado salvo!');
}

// ── A grade ─────────────────────────────────────────────────────────────────

/**
 * Desenha a grade dentro de `container`.
 *
 * `filtro` é a lista de `id` a mostrar, ou `null` para mostrar tudo. É o que
 * deixa a categoria "Acesso rápido" mostrar só as duas teclas da barra sem uma
 * segunda implementação.
 *
 * ⚠️ AS LINHAS SAEM DO REGISTRO, e nunca de uma lista escrita à mão: comando
 * novo registrado em qualquer lugar do programa aparece aqui sozinho, que é o
 * ponto inteiro de haver um registro.
 */
function pintarGradeDeTeclas(container, filtro) {
  // Os comandos de extensão entram no registro por este pedido — sem ele a
  // grade só os mostrava depois de a barra de Acesso rápido ter aberto uma vez.
  if (typeof xtRegistrarComandosAgora === 'function') xtRegistrarComandosAgora();
  const comandos = obterTeclas().filter((c) => !filtro || filtro.includes(c.id));
  const conflitos = teclasEmConflito(obterTeclas());

  // Sem o agrupamento por "onde vale", quarenta linhas seguidas não dizem que
  // `Ctrl+F` é uma tecla DO EDITOR e não do programa — que é justamente o
  // mal-entendido que esta coluna existe para desfazer.
  let ondeAtual = null;
  const linhas = comandos.map((c) => {
    const onde = _tecOndeVale(c.onde);
    // Com filtro (a grade curta do Acesso rápido) não há título de grupo: duas
    // linhas não formam grupo nenhum.
    const titulo = (!filtro && onde !== ondeAtual)
      ? `<div class="grupo-tit">${escapeHtml(onde)}</div>` : '';
    ondeAtual = onde;
    return `${titulo}
      <div class="tecla-lin" data-tecla="${escapeHtml(c.id)}">
        <div class="tecla-cel">${escapeHtml(c.rotulo)}${
          conflitos.has(c.id) ? '<span class="selo-conflito">mesma tecla</span>' : ''}</div>
        <div class="tecla-cel onde">${escapeHtml(onde)}</div>
        <div class="tecla-cel">
          <button type="button" class="tecla-campo${c.tecla ? '' : ' vazio'}"
                  data-acao="capturar">${escapeHtml(c.tecla || 'sem tecla')}</button>
        </div>
        <div class="tecla-cel">
          <button type="button" class="tecla-reset" data-acao="restaurar"
                  title="Devolver a tecla de fábrica">↺</button>
        </div>
      </div>`;
  }).join('');

  // O cabeçalho de coluna fica; o resto é repintado.
  [...container.querySelectorAll('.tecla-lin, .grupo-tit')].forEach((el) => el.remove());
  container.insertAdjacentHTML('beforeend', linhas);
}

/** Repinta TODAS as grades que estiverem na tela. Ver o ⚠️ de `teclasEmConflito`. */
function repintarGradesDeTeclas() {
  const inteira = document.getElementById('teclado-grade');
  if (inteira) pintarGradeDeTeclas(inteira, null);
  const curta = document.getElementById('acr-grade-teclas');
  if (curta && typeof ACR_CFG_TECLAS !== 'undefined') pintarGradeDeTeclas(curta, ACR_CFG_TECLAS);
  // E a grade da página de cada extensão (Configurações › Extensões), que é
  // a terceira vista da mesma configuração.
  if (typeof xtRepintarComandosDasTelas === 'function') xtRepintarComandosDasTelas();
}

// Onde o alcance de um comando é escrito por extenso, para a coluna "Onde vale".
// O rótulo sai do DOM — as abas já são a lista, e escrever aqui a segunda lista
// de nomes de aba a faria divergir na primeira aba renomeada.
function _tecOndeVale(onde) {
  if (!onde || onde === 'global') return 'Em qualquer aba';
  const btn = document.querySelector(`[data-taborder-group] [data-tab="${onde}"],`
                                   + ` [data-taborder-group] [data-asubtab="${onde}"]`);
  return btn ? (btn.dataset.taborderRotulo || btn.textContent).trim() : onde;
}

// Cliques delegados no container: a grade é repintada a cada gravação, e um
// listener por linha morreria na primeira repintura.
function ligarGradeDeTeclas(container) {
  if (container._wired) return;
  container._wired = true;
  container.addEventListener('click', (ev) => {
    const linha = ev.target.closest('.tecla-lin');
    const acao = ev.target.closest('[data-acao]');
    if (!linha || !acao) return;
    if (acao.dataset.acao === 'restaurar') return restaurarTeclaDeFabrica(linha.dataset.tecla);
    capturarTecla(acao, linha.dataset.tecla);
  });
}

// ── O selo "mesma tecla" ────────────────────────────────────────────────────
//
// Acende quando dois comandos têm a MESMA tecla E os alcances se CRUZAM:
//
// | Situação                                            | Selo? |
// |-----------------------------------------------------|-------|
// | dois comandos do Editor com a mesma tecla            | sim   |
// | um "em qualquer aba" e um do Editor                  | sim   |
// | um do Editor e um da Oficina                         | não   |
//
// ⚠️ Sem a regra do cruzamento o selo acenderia em toda linha, e um aviso que
// aparece sempre deixa de ser aviso.
//
// ⚠️ AVISA E DEIXA GRAVAR — nunca recusa, nunca rouba a tecla do outro. Dois
// comandos podem legitimamente dividir a mesma tecla vivendo em abas
// diferentes: recusar impediria um caso válido, e roubar mexeria numa
// configuração que o usuário não pediu para mexer.
//
// ⚠️ É PROPRIEDADE DA TABELA INTEIRA, não da linha: trocar a tecla de A pode
// acender o selo em B e apagar em C, então recalcula-se tudo a cada gravação.
//
// ⚠️ O exemplo clássico desta regra — "Ctrl+F no Editor e Ctrl+F na
// Documentação" — NÃO EXISTE no código: o único `Ctrl+F` de `document` do
// programa é o do Editor. O par real de alcances diferentes é Editor × Oficina.
function teclasEmConflito(comandos) {
  const conflitados = new Set();
  const comTecla = comandos.filter((c) => c.tecla);
  comTecla.forEach((a, i) => {
    comTecla.slice(i + 1).forEach((b) => {
      if (a.tecla !== b.tecla) return;
      if (!_tecAlcancesSeCruzam(a.onde, b.onde)) return;
      conflitados.add(a.id);
      conflitados.add(b.id);
    });
  });
  return conflitados;
}

function _tecAlcancesSeCruzam(a, b) {
  if (a === 'global' || b === 'global') return true;
  return a === b;
}

// ── Capturar uma combinação ─────────────────────────────────────────────────
//
// Clicar no campo e apertar a combinação. Grava NA HORA — é gesto direto, não
// digitação.
//
// ⚠️ `pausarTeclas(true)` enquanto captura, e `false` ao sair por qualquer
// caminho. Sem isso, apertar `Ctrl+S` para gravá-lo salvaria um arquivo no mesmo
// toque: o campo é um `<button>`, e a guarda de campo de texto do registro não o
// cobre.
//
// ⚠️ A combinação sai de `teclaDoEvento(e)`, do registro, e não de uma leitura
// própria de `e.key`. Se cada tela normalizar do seu jeito, a tecla gravada não
// casa com a tecla que dispara, e o sintoma é "gravei e não funcionou".
function capturarTecla(campo, id) {
  if (campo.dataset.capturando) return;
  campo.dataset.capturando = '1';
  campo.classList.add('capturando');
  const antes = campo.textContent;
  campo.textContent = 'aperte a combinação…';
  campo.focus();
  pausarTeclas(true);

  function sair() {
    pausarTeclas(false);
    delete campo.dataset.capturando;
    campo.classList.remove('capturando');
    document.removeEventListener('keydown', aoTeclar, true);
    campo.removeEventListener('blur', aoPerderFoco);
  }
  function aoPerderFoco() { campo.textContent = antes; sair(); }
  async function aoTeclar(e) {
    e.preventDefault();
    e.stopPropagation();
    // `Escape` desiste sem trocar nada: é a saída de emergência, e não uma
    // tecla que se possa escolher — ela nem aparece nesta tela.
    if (e.key === 'Escape') { campo.textContent = antes; sair(); return; }
    const tecla = teclaDoEvento(e);
    // Só o modificador apertado ainda não é combinação: continua esperando.
    if (!tecla) return;
    sair();
    const trocadas = Object.assign({}, appSettings.teclas || {});
    trocadas[id] = tecla;
    await gravarTeclasTrocadas(trocadas);
  }
  // Em CAPTURA (`true`): o campo tem de ver a tecla antes de qualquer outro
  // ouvinte da página, inclusive os que dão `stopPropagation`.
  document.addEventListener('keydown', aoTeclar, true);
  campo.addEventListener('blur', aoPerderFoco);
}

// O ↺ de uma linha devolve SÓ aquela: a tecla volta ao padrão SAINDO do objeto,
// e não sendo gravada com o valor de fábrica. Ver o ⚠️ de `gravarTeclasTrocadas`.
async function restaurarTeclaDeFabrica(id) {
  const trocadas = Object.assign({}, appSettings.teclas || {});
  delete trocadas[id];
  await gravarTeclasTrocadas(trocadas);
}

/**
 * Grava o objeto de teclas trocadas e repinta as grades que estiverem na tela.
 *
 * ⚠️ `settings.teclas` guarda SÓ o que o usuário trocou, e nasce `{}`. Gravar a
 * tabela inteira congelaria o padrão: mudar uma tecla de fábrica numa versão
 * futura não chegaria a quem já abriu esta tela uma vez.
 *
 * ⚠️ O objeto vai INTEIRO: `save_settings_parcial` faz merge raso, então um
 * `{ teclas: { uma } }` apagaria todas as outras trocadas.
 *
 * ⚠️ `save_settings_parcial`, NUNCA `save_settings` — o segundo grava o JSON
 * inteiro a partir do que recebeu e apaga as chaves de todas as outras telas.
 */
async function gravarTeclasTrocadas(trocadas) {
  const r = await window.pywebview.api.save_settings_parcial({ teclas: trocadas });
  if (!r || !r.success) { showToast('Não foi possível gravar a tecla.', true); return false; }
  // ⚠️ Reatribuir o global é parte da gravação: o registro lê `appSettings.teclas`
  // a cada `keydown`. Sem isto a tela grava certo e a tecla nova só passa a
  // valer quando o programa reabrir.
  appSettings = Object.assign({}, appSettings, { teclas: trocadas });
  repintarGradesDeTeclas();
  return true;
}
