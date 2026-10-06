// ═══════════════════════════════════ ACESSO RÁPIDO — A BARRA ══
// A pergunta deste arquivo: **como a barra abre, fecha, navega e desenha.** O
// que cada modo procura é a pergunta do irmão, `acesso-rapido-modos.js`.
//
// Ela nasceu como a abertura rápida da aba Editor, e é a mesma caixa — o
// desenho não mudou para quem já usava o Ctrl+P. O que mudou é de quem ela é.
//
// ⚠️ ISTO NÃO FOI UM RENOME. A fábrica antiga guardava a árvore e o "abrir
// arquivo" num closure de CRIAÇÃO, e era instanciada num lugar só, dentro do
// bloco guardado por `_edLigado` em `editor.js`: a barra só existia depois de a
// aba Editor ter sido montada, e uma barra assim não é global. Agora o módulo
// se auto-instancia no carregamento, e o Editor SE REGISTRA nele
// (`acessoRapidoUsarArvore`) quando monta.
//
// ⚠️ NOME. É "Acesso rápido", nunca "Busca rápida": a barra também EXECUTA, e
// "busca" promete metade. E a combinação de teclas se chama TECLA no código,
// nunca "atalho" — `atalho` já é o termo interno dos Launchers.
//
// ⚠️ CLASSE PRÓPRIA (`.acr`), E NUNCA `.dropdown-menu`. Há um ouvinte global em
// `app.js` que esconde TODO `.dropdown-menu` a cada clique no documento: a
// barra sumiria antes de o clique no resultado ser processado.
//
// ⚠️ NADA DE MARKUP NOVO NO `index.html`. A barra se monta por JS, como sempre
// fez — o que entra lá são as tags `<script>`, e só.

// O modo em que ela está. Sobrevive entre aberturas de propósito: o `Ctrl+P`
// abre no último modo usado.
let _acrModo = null;
let _acrOverlay = null;
let _acrRelogio = null;
// A TELA (`.screen.active`) em que a barra abriu — ver o observador no fim.
let _acrTelaAoAbrir = '';
// A busca em voo, para uma resposta atrasada não escrever por cima de uma mais
// nova. Sem isto, trocar de modo depressa deixa a lista do modo velho na tela.
let _acrBuscaEmVoo = 0;

// ── O que a configuração manda ───────────────────────────────────────────────
//
// ⚠️ Lido de `appSettings`, o global carregado no boot — nunca de
// `window.pywebview.api.*`, que é assíncrono e atravessa a ponte Python↔WebView.
// Cada leitura cai no padrão de fábrica de `constantes.js`, que é o gêmeo de
// `padroes_de_fabrica.py`.
function _acrConfig() {
  const s = (typeof appSettings !== 'undefined' && appSettings) || {};
  return {
    modos: s.acesso_rapido_modos ?? ACESSO_RAPIDO_MODOS_PADRAO,
    posicao: s.acesso_rapido_posicao ?? ACESSO_RAPIDO_POSICAO_PADRAO,
    tamanho: s.acesso_rapido_tamanho ?? ACESSO_RAPIDO_TAMANHO_PADRAO,
    resultados: s.acesso_rapido_resultados ?? ACESSO_RAPIDO_RESULTADOS_PADRAO,
    esconderModos: s.acesso_rapido_esconder_modos ?? ACESSO_RAPIDO_ESCONDER_MODOS_PADRAO,
    recentes: s.acesso_rapido_recentes ?? ACESSO_RAPIDO_RECENTES_PADRAO,
    prefixoExtensao: s.acesso_rapido_prefixo_extensao ?? ACESSO_RAPIDO_PREFIXO_EXTENSAO_PADRAO,
    prefixoAba: s.acesso_rapido_prefixo_aba ?? ACESSO_RAPIDO_PREFIXO_ABA_PADRAO,
  };
}

// Os modos que aparecem na fila de botões: os ligados, na ordem do usuário, e
// sem os que não teriam o que responder.
//
// ⚠️ "Sem projeto aberto os três modos de arquivo somem" é diferente de "sem
// Editor montado": lá a barra monta o Editor e abre o arquivo; aqui o modo nem
// aparece, em vez de aparecer e devolver lista vazia.
function _acrModosVisiveis() {
  const cfg = _acrConfig();
  return cfg.modos
    .filter((m) => m.ligado)
    .map((m) => acessoRapidoModo(m.chave))
    .filter((m) => !!m)
    .filter((m) => !(cfg.esconderModos && m.precisaDeProjeto && !currentProject));
}

// ── Abrir e fechar ───────────────────────────────────────────────────────────

function acessoRapidoFechar() {
  // ⚠️ `clearTimeout` AQUI, e não só no `input`. Sem ele o debounce continuava
  // correndo depois de a barra sumir, e 250 ms depois chamava `buscar` num
  // overlay que já não existia — `TypeError` no console, e o usuário só via a
  // barra fechar. É a regra registrada: depois de um `await` (ou de um timer),
  // confira se ainda está montada.
  clearTimeout(_acrRelogio);
  _acrRelogio = null;
  _acrBuscaEmVoo++;
  if (_acrOverlay) { _acrOverlay.remove(); _acrOverlay = null; }
}

function acessoRapidoAbrir(chaveDoModo) {
  // ⚠️ Um modal é uma pergunta bloqueante: a barra não abre por cima dele. O
  // `:not(.hidden)` não é zelo — o `index.html` traz uma dúzia de
  // `.modal-overlay hidden` montados de fábrica, e sem ele a guarda valeria
  // sempre, com ou sem modal aberto.
  if (document.querySelector('.modal-overlay:not(.hidden)')) return;

  const visiveis = _acrModosVisiveis();
  if (!visiveis.length) return;
  // O modo pedido, ou o último usado, ou o primeiro ligado.
  const querido = chaveDoModo || _acrModo;
  _acrModo = (visiveis.some((m) => m.chave === querido) ? querido : visiveis[0].chave);

  if (_acrOverlay) { _acrDesenharCasca(visiveis); _acrCampo().focus(); return; }

  _acrTelaAoAbrir = _acrTelaAtiva();
  _acrOverlay = document.createElement('div');
  document.body.appendChild(_acrOverlay);
  _acrDesenharCasca(visiveis);
  _acrCampo().focus();
  _acrPintarVazio();
}

// O que a barra mostra ANTES da primeira letra: os usados recentemente, e —
// quando o modo é de memória — a lista inteira dele, num grupo com título.
//
// ⚠️ Sem a segunda metade, abrir o modo Comando mostrava uma caixa vazia, e uma
// caixa vazia é indistinguível de "este modo não achou nada". O usuário que
// abriu a barra para descobrir o que o programa faz não descobria.
function _acrPintarVazio() {
  const modo = acessoRapidoModo(_acrModo);
  const grupos = _acrRecentes();
  if (modo && modo.listaSemTermo) {
    const resposta = modo.listar('');
    grupos.push(Object.assign({ titulo: modo.titulo }, resposta));
  }
  _acrPintar(grupos);
}

// eslint-disable-next-line no-unused-vars
function acessoRapidoAlternar() {
  if (_acrOverlay) acessoRapidoFechar();
  else acessoRapidoAbrir();
}

function _acrCampo() { return _acrOverlay.querySelector('.acr-input'); }
function _acrLista() { return _acrOverlay.querySelector('.acr-lista'); }

// ── A casca ──────────────────────────────────────────────────────────────────

function _acrDesenharCasca(visiveis) {
  const cfg = _acrConfig();
  const modo = acessoRapidoModo(_acrModo);
  const valorAtual = _acrOverlay.querySelector('.acr-input')
    ? _acrCampo().value : '';

  // ⚠️ A posição e o tamanho são CLASSES, não estilo inline: as medidas moram
  // no CSS, e trocar a escolha em Configurações é trocar duas classes.
  _acrOverlay.className = `acr acr--${cfg.tamanho} acr--${cfg.posicao}`;
  _acrOverlay.innerHTML = `
    <input type="text" class="acr-input" placeholder="${escapeHtml(modo.dica)}" spellcheck="false">
    <div class="acr-modos">
      ${visiveis.map((m) => `<button class="acr-modo-btn${m.chave === _acrModo ? ' active' : ''}"
        data-modo="${m.chave}">${escapeHtml(m.rotulo)}</button>`).join('')}
    </div>
    <div class="acr-lista"></div>
    <div class="acr-rodape">
      <span><kbd>↑↓</kbd>navegar</span><span><kbd>Enter</kbd>executar</span>
      <span><kbd>Tab</kbd>trocar de modo</span><span><kbd>Esc</kbd>fechar</span>
    </div>`;

  const campo = _acrCampo();
  campo.value = valorAtual;

  _acrOverlay.querySelectorAll('.acr-modo-btn').forEach((btn) => {
    btn.addEventListener('click', () => _acrTrocarModo(btn.dataset.modo));
  });
  campo.addEventListener('input', () => {
    clearTimeout(_acrRelogio);
    if (!campo.value.trim()) { _acrPintarVazio(); return; }
    _acrRelogio = setTimeout(() => _acrBuscar(campo.value), 250);
  });
  campo.addEventListener('keydown', _acrTeclaNoCampo);
}

// Trocar de modo busca DE NOVO na hora: o usuário já digitou, ele só mudou de
// pergunta — esperar os 250 ms de novo seria esperar duas vezes pela mesma
// digitação.
//
// ⚠️ E CANCELA O DEBOUNCE PENDENTE. Sem o `clearTimeout`, digitar e trocar de
// modo dentro da mesma janela de 250 ms disparava DUAS buscas — a imediata, do
// modo novo, e a atrasada, do modo velho —, as duas escrevendo na mesma lista:
// quem chegasse por último vencia, e podia ser a do modo errado.
function _acrTrocarModo(chave) {
  clearTimeout(_acrRelogio);
  _acrModo = chave;
  _acrDesenharCasca(_acrModosVisiveis());
  const campo = _acrCampo();
  campo.focus();
  if (campo.value.trim()) _acrBuscar(campo.value);
  else _acrPintarVazio();
}

function _acrTeclaNoCampo(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); _acrMoverSelecao(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); _acrMoverSelecao(-1); }
  else if (e.key === 'Enter') {
    e.preventDefault();
    const sel = _acrOverlay.querySelector('.acr-item.sel');
    if (sel) sel.click();
  } else if (e.key === 'Tab') {
    e.preventDefault();
    const visiveis = _acrModosVisiveis();
    const i = visiveis.findIndex((m) => m.chave === _acrModo);
    _acrTrocarModo(visiveis[(i + (e.shiftKey ? -1 : 1) + visiveis.length) % visiveis.length].chave);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    acessoRapidoFechar();
  }
}

// ── Buscar ───────────────────────────────────────────────────────────────────

async function _acrBuscar(termo) {
  // ⚠️ A GUARDA NO TOPO, e não só depois dos `await`. A função desreferenciava
  // o overlay na primeira linha, sem proteção: se o debounce disparasse depois
  // de a barra fechar, era `TypeError: Cannot read properties of null`.
  if (!_acrOverlay) return;
  const modo = acessoRapidoModo(_acrModo);
  if (!modo) return;
  if (!termo.trim()) { _acrPintarVazio(); return; }

  _acrLista().innerHTML = '<div class="acr-vazio">Buscando…</div>';
  const meuTurno = ++_acrBuscaEmVoo;
  let resposta;
  try {
    resposta = await modo.buscar(termo);
  } catch (erro) {
    resposta = { itens: [], vazio: 'Erro na busca: ' + (erro && erro.message ? erro.message : erro) };
  }
  // Fechada durante o `await`, ou já há uma busca mais nova a caminho.
  if (!_acrOverlay || meuTurno !== _acrBuscaEmVoo) return;

  const teto = _acrConfig().resultados;
  _acrPintar([{ itens: resposta.itens.slice(0, teto), vazio: resposta.vazio }]);
}

// ── Desenhar a lista ─────────────────────────────────────────────────────────
//
// Recebe grupos: `[{ titulo, itens, vazio }]`. Um grupo sem título não mostra
// cabeçalho — é o caso do resultado de uma busca.
function _acrPintar(grupos) {
  if (!_acrOverlay) return;
  const lista = _acrLista();
  const comItens = grupos.filter((g) => g.itens.length);
  if (!comItens.length) {
    const vazio = grupos.map((g) => g.vazio).filter(Boolean)[0] || '';
    lista.innerHTML = vazio ? `<div class="acr-vazio">${escapeHtml(vazio)}</div>` : '';
    return;
  }

  const todos = [];
  lista.innerHTML = comItens.map((grupo) => {
    const cabeca = grupo.titulo ? `<div class="acr-grupo">${escapeHtml(grupo.titulo)}</div>` : '';
    return cabeca + grupo.itens.map((item) => {
      const i = todos.push(item) - 1;
      return `
      <div class="acr-item${i === 0 ? ' sel' : ''}${item.motivo ? ' acr-item--inativo' : ''}"
           data-i="${i}"${item.slug ? ` data-origem="extensao" data-xt="${escapeHtml(item.slug)}"` : ''}>
        ${item.icone ? `<span class="acr-icone">${escapeHtml(item.icone)}</span>` : ''}
        ${item.score != null ? `<span class="acr-score">${item.score}%</span>` : ''}
        <b>${escapeHtml(item.nome)}</b>
        ${item.caminho ? `<span class="acr-caminho">${escapeHtml(item.caminho)}</span>` : ''}
        ${item.motivo ? `<span class="acr-motivo">${escapeHtml(item.motivo)}</span>` : ''}
        ${item.tecla ? `<span class="acr-tecla${item.teclaVazia ? ' acr-tecla--vazia' : ''}">${escapeHtml(item.tecla)}</span>` : ''}
        ${item.trecho ? `<span class="acr-trecho">${escapeHtml(item.trecho)}</span>` : ''}
      </div>`;
    }).join('');
  }).join('');

  lista.querySelectorAll('.acr-item').forEach((el) => {
    const item = todos[+el.dataset.i];
    el.addEventListener('click', () => _acrEscolher(item));
    // Mouse e teclado disputam a mesma classe `sel`; passar o mouse move a
    // seleção para onde ele está, senão o Enter abriria outra linha.
    el.addEventListener('mouseenter', () => {
      lista.querySelectorAll('.acr-item').forEach((x) => x.classList.remove('sel'));
      el.classList.add('sel');
    });
  });
}

// Descer do último volta ao primeiro — `% itens.length`. E o `scrollIntoView`
// é `block: 'nearest'`, não o padrão: com o padrão a lista salta a cada seta.
function _acrMoverSelecao(delta) {
  const itens = [..._acrOverlay.querySelectorAll('.acr-item')];
  if (!itens.length) return;
  const atual = itens.findIndex((el) => el.classList.contains('sel'));
  const proximo = ((atual === -1 ? 0 : atual) + delta + itens.length) % itens.length;
  itens.forEach((el) => el.classList.remove('sel'));
  itens[proximo].classList.add('sel');
  itens[proximo].scrollIntoView({ block: 'nearest' });
}

async function _acrEscolher(item) {
  // Item indisponível não faz nada — o motivo já está escrito na linha.
  if (!item.executar) return;
  const recente = item.recente;
  acessoRapidoFechar();
  if (recente) _acrGravarRecente(recente);
  await item.executar();
}

// ── "Usados recentemente" ────────────────────────────────────────────────────
//
// O grupo que aparece antes de a primeira letra ser digitada. Guardado no
// `settings.json`, e não em `localStorage`, porque é escolha do usuário que
// vale entre sessões e entra no "Restaurar padrão" da categoria.
const ACESSO_RAPIDO_TETO_DE_RECENTES = 8;

function _acrRecentes() {
  const recentes = _acrConfig().recentes;
  const itens = recentes.slice(0, ACESSO_RAPIDO_TETO_DE_RECENTES).map((r) => ({
    nome: r.nome, caminho: r.modo === 'arquivo' ? r.chave : '', trecho: '', score: null,
    tecla: r.modo === 'comando' ? textoDaTecla(r.chave) : '', motivo: '',
    executar: () => acessoRapidoExecutarRecente(r),
    recente: r,
  }));
  return [{ titulo: 'Usados recentemente', itens, vazio: '' }];
}

// ⚠️ `save_settings_parcial`, NUNCA `save_settings`: o segundo grava o JSON
// inteiro a partir do que recebeu, e chamá-lo com uma chave apagaria todas as
// outras. O sintoma é chave que "some sozinha" do disco, sem erro nenhum.
function _acrGravarRecente(recente) {
  const antes = _acrConfig().recentes
    .filter((r) => !(r.modo === recente.modo && r.chave === recente.chave));
  const depois = [recente, ...antes].slice(0, ACESSO_RAPIDO_TETO_DE_RECENTES);
  if (typeof appSettings !== 'undefined') appSettings.acesso_rapido_recentes = depois;
  if (window.pywebview && window.pywebview.api) {
    window.pywebview.api.save_settings_parcial({ acesso_rapido_recentes: depois });
  }
}

// ── As duas teclas que a abrem ───────────────────────────────────────────────
//
// ⚠️ `onde: 'global'` — sem guarda de painel nenhuma. É o que a promoção
// significa: a barra abre em qualquer aba, e também na tela inicial, inclusive
// numa sessão em que a aba Editor nunca foi aberta.
//
// ⚠️ `emCampo: true` — e valem também com o cursor DENTRO de um campo de texto:
// o código do Editor é um `<textarea>`, e é de lá que o usuário mais chama a
// barra. Sem isto o Ctrl+P só funcionava depois de clicar fora do arquivo
// (defeito real, 06/09/2026). Ver a guarda de campo em `teclas.js`.
registrarTecla({
  id: 'acesso-rapido.abrir', rotulo: 'Abrir o Acesso rápido',
  grupo: 'Acesso rápido', onde: 'global', padrao: 'Ctrl+P', icone: '⌕',
  emCampo: true,
  fazer: () => acessoRapidoAlternar(),
});
registrarTecla({
  id: 'acesso-rapido.comando', rotulo: 'Abrir o Acesso rápido no modo Comando',
  grupo: 'Acesso rápido', onde: 'global', padrao: 'Ctrl+Shift+P', icone: '⌘',
  emCampo: true,
  fazer: () => acessoRapidoAbrir('comando'),
});

// ── Os dois fechadores ───────────────────────────────────────────────────────
//
// Registrados UMA vez, no carregamento — não a cada abertura.
//
// ⚠️ O `Esc` daqui NÃO passa pelo registro de teclas, e é decisão: `Esc` é
// tecla de texto, não é configurável, e não aparece na tela de Teclado. O
// rodapé da barra é o único lugar em que ele se anuncia.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && _acrOverlay) acessoRapidoFechar();
});

// ⚠️ A exceção do clique-fora: clicar no próprio botão que abre a barra não
// fecha. Sem isso, clicar nele com a barra aberta fecharia e reabriria no mesmo
// gesto, e o botão pareceria não funcionar.
//
// ⚠️ `composedPath()`, e NUNCA `_acrOverlay.contains(e.target)`. O clique num
// botão de modo ("Ir para aba") chega primeiro ao botão, que troca de modo e
// REDESENHA a casca por `innerHTML` — e quando o mesmo clique borbulha até
// aqui, o `e.target` é o botão VELHO, já fora do DOM: `contains` dizia
// "clique de fora", e a barra fechava no mesmo gesto em que trocava de modo
// (defeito real, 06/09/2026). O `composedPath` é a lista calculada no
// disparo, antes de qualquer redesenho, e é ela que diz por onde o clique
// passou. Ver a regra "Clique-fora confere composedPath, não contains".
document.addEventListener('click', (e) => {
  if (!_acrOverlay) return;
  const caminho = typeof e.composedPath === 'function' ? e.composedPath() : [];
  if (caminho.includes(_acrOverlay)) return;
  if (caminho.some((el) => el && el.id === 'ed-btn-busca-rapida')) return;
  acessoRapidoFechar();
});

// ⚠️ A BARRA FECHA QUANDO UM MODAL ABRE. A guarda do `acessoRapidoAbrir`
// resolve o caso de a barra tentar abrir por cima de um modal; falta o
// contrário — o modal que abre DEPOIS, com a barra já na tela. Como o
// `z-index` da barra (430) é acima do modal (100), sem isto ela ficaria por
// cima de uma pergunta bloqueante, que é exatamente o que a guarda existe para
// impedir.
//
// Um `MutationObserver` de classe em `.modal-overlay` é o caminho mais barato:
// não há evento de "modal abriu" no projeto, e pendurar um em `abrirModalPadrao`
// não pegaria os modais que não passam por ele.
//
// ⚠️ E A BARRA FECHA QUANDO A TELA TROCA — pelo mesmo observador, e não pelo
// clique-fora. O `×` da aba de projeto (`projetos-abertos.js`) chama
// `stopPropagation` para o clique não cair também no botão da aba, e com isso
// o clique nunca chegava ao ouvinte de `document` que fecha a barra: o usuário
// fechava o projeto com o Ctrl+P aberto e a barra ficava na tela, por cima da
// lista de projetos, com os modos de arquivo de um projeto que já não existia
// (defeito real, 06/09/2026). Uma barra `position: fixed` no `<body>`
// sobrevive a `showScreen` sozinha; a troca de tela é que tem de fechá-la —
// e a troca se vê na classe `active` de `.screen`, que este observador já
// escuta. Vale para o `×`, para o "← Projetos", para `enterProject` vindo de
// qualquer lugar, e para o gesto que ainda não existe.
function _acrTelaAtiva() {
  const tela = document.querySelector('.screen.active');
  return tela ? tela.id : '';
}
new MutationObserver(() => {
  if (!_acrOverlay) return;
  if (document.querySelector('.modal-overlay:not(.hidden)')) { acessoRapidoFechar(); return; }
  if (_acrTelaAtiva() !== _acrTelaAoAbrir) acessoRapidoFechar();
}).observe(document.documentElement, {
  subtree: true, attributes: true, attributeFilter: ['class'],
});
