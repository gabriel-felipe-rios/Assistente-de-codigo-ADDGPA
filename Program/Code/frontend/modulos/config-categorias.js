// ═══════════════════════════ ABA: CONFIGURAÇÕES — CATEGORIAS ══
// Registro das categorias do trilho da esquerda.
//
// Antes, cada área de configuração se pendurava direto no fim da página
// (`#ptab-configs .screen-body`), separada da anterior por um <hr>. Quem
// abria a aba via uma página só, e o que não coubesse na primeira tela
// simplesmente não existia até alguém rolar.
//
// Agora cada área se registra como uma categoria e recebe três lugares:
//   1. um botão no trilho,
//   2. uma seção no painel rolável (só a da categoria aberta fica visível),
//   3. um grupo de botões na barra de ações do rodapé.
//
// O contrato é o mesmo dos `*-template.js`: quem registra continua sendo o
// próprio módulo da área, então acrescentar uma configuração nova não exige
// editar este arquivo — basta chamar `registrarCategoriaConfig`.
//
// Este arquivo precisa ser carregado ANTES de `config-template.js` e dos
// demais templates de configuração (ver ordem dos <script> no index.html).

// Categoria aberta quando a aba é montada: a primeira registrada.
let _categoriaConfigAberta = null;

// ── O nível de cima do trilho: Programa | Extensões ──────────────────────
// O trilho ganhou dois LADOS. "Programa" são as categorias do próprio
// programa (as de sempre); "Extensões" tem as que vieram de extensão ligada —
// a que o programa desenha a partir do `config/tela.json` dela, e também
// qualquer uma que a própria extensão registre com `deExtensao: true`.
// Nenhuma categoria de extensão aparece do lado Programa (ver o desvio de
// `lado` dentro de `registrarCategoriaConfig`).
//
// ⚠️ Trocar de lado esconde os BOTÕES do outro lado, e só isso. As SEÇÕES do
// painel continuam todas no DOM, escondidas por categoria como sempre —
// é o que mantém a busca inteira (`config-busca.js` varre o DOM sem abrir
// nada) e o que faz `_configIrPara` funcionar entre lados sem saber que
// lados existem: ele só chama `abrirCategoriaConfig`, que troca sozinho.
let _configLadoAberto = 'programa';

// A última categoria aberta de CADA lado. Voltar para o lado Programa depois
// de configurar uma extensão tem de cair onde o usuário estava, e não sempre
// na primeira categoria da lista.
const _configCategoriaPorLado = { programa: null, extensoes: null };

/** O container do trilho onde os botões de um lado moram. */
function _configTrilhoDoLado(lado) {
  return lado === 'extensoes'
    ? document.getElementById('config-trilho-extensoes')
    : document.getElementById('config-trilho');
}

/** O lado a que uma categoria pertence — 'programa' quando ela não existe. */
function _configLadoDaCategoria(chave) {
  const btn = document.querySelector(
    `#config-trilho .config-trilho-btn[data-categoria="${chave}"]`);
  return (btn && btn.dataset.lado) || 'programa';
}

/**
 * Registra uma categoria da aba Configurações.
 *
 * @param {string} chave     Identificador sem acento, usado nos ids/data-*.
 * @param {string} rotulo    Nome mostrado no trilho e no cabeçalho da seção.
 * @param {string} icone     Um caractere, à esquerda do rótulo no trilho.
 * @param {string} resumo    Linha curta ao lado do título da seção.
 * @param {string} conteudo  HTML dos cartões da seção.
 * @param {string} acoes     HTML dos botões que vão para a barra do rodapé.
 * @param {boolean} padrao   Injeta o "Restaurar padrão" antes dos `acoes`.
 * @param {string} lado      'programa' (o padrão, e as 19 de hoje) ou
 *                           'extensoes' (uma por extensão ligada).
 * @param {boolean} deExtensao  A categoria veio de uma extensão — e por isso
 *                           cai no lado Extensões, mande o `lado` o que mandar.
 *
 * ⚠️ A seção NÃO recebe `data-origem="extensao"` (mudado em 06/09/2026). Até
 * então `deExtensao` também carimbava a seção inteira, e o "Destacar
 * extensões" pintava a página toda de cada extensão em Configurações ›
 * Extensões — uma página que o PROGRAMA desenha, num lado do trilho que já
 * diz, pelo nome, que tudo ali veio de extensão. O destaque existe para
 * responder "o que aqui não é do programa?" no meio de uma tela do programa;
 * ali a pergunta já está respondida, e a moldura só sujava. O que uma
 * extensão desenha por conta própria dentro da categoria dela (um encaixe,
 * um item) continua marcado por quem o entrega.
 */
function registrarCategoriaConfig({ chave, rotulo, icone, resumo = '', conteudo,
                                   acoes = '', padrao = true, lado = 'programa',
                                   deExtensao = false }) {
  // ⚠️ QUEM VEM DE EXTENSÃO CAI NO LADO EXTENSÕES, mesmo pedindo 'programa'.
  // O `lado` da chamada não é confiável aqui: uma extensão de terceiro escolhe
  // o que quiser, e o gabarito — que todo mundo copia — pedia 'programa'. O
  // resultado era uma categoria "Extensão de teste" no meio das dezenove do
  // PROGRAMA, indistinguível delas no trilho, e o usuário abrindo Configurações
  // › Programa achava configuração que não é do programa.
  //
  // O lado Extensões existe justamente para isto, e ganhar a decisão aqui —
  // e não no arquivo de cada extensão — é o que faz a regra valer para a
  // próxima extensão que alguém escrever copiando o gabarito.
  //
  // De quebra, isto também tira essas categorias de "Ordem das abas": só os
  // filhos DIRETOS do <nav> entram na reordenação, e uma categoria que some
  // quando a extensão é desligada não tem o que fazer numa lista de ordem.
  if (deExtensao) lado = 'extensoes';

  const trilho  = _configTrilhoDoLado(lado);
  const rolagem = document.getElementById('config-rolagem');
  const barra   = document.getElementById('config-barra-acoes');
  // ⚠️ FALHA SILENCIOSA VIRA RASTRO. Sair daqui sem dizer nada é o que faz uma
  // categoria simplesmente não existir na tela — nem no trilho, nem em "Ordem
  // das abas" — sem erro nenhum para procurar. A causa é sempre a mesma: a tag
  // <script> desta categoria veio ANTES de `config-template.js`, que é quem
  // cria a casca.
  if (!trilho || !rolagem || !barra) {
    console.error('[config] a categoria "%s" não foi registrada: a casca de '
                  + 'Configurações ainda não existe. Mova o <script> dela para '
                  + 'DEPOIS de config-template.js no index.html.', chave);
    return;
  }

  // `data-taborder-rotulo`: o `textContent` do botão inclui o ícone, e a
  // pílula de "Ordem das abas" sairia como "◆Modelo e contexto".
  trilho.insertAdjacentHTML('beforeend', `
    <button class="config-trilho-btn" data-categoria="${chave}" data-lado="${lado}"
            data-taborder-rotulo="${rotulo}">
      <span class="config-trilho-icone">${icone}</span>${rotulo}
    </button>`);

  // O `id` existe para "Ordem das abas" poder MOVER a seção junto do botão.
  // Sem ele `_applyGroupOrderToDom` reordenava os botões e saía calado ao não
  // achar o painel — os dois ficavam em ordens diferentes.
  rolagem.insertAdjacentHTML('beforeend', `
    <section class="config-secao hidden" id="config-secao-${chave}" data-categoria="${chave}">
      <div class="config-secao-cabecalho">
        <h2>${rotulo}</h2>
        ${resumo ? `<span>${resumo}</span>` : ''}
      </div>
      ${conteudo}
    </section>`);

  // O "Restaurar padrão" é INJETADO, e não copiado em cada categoria. Ele
  // existia em três das oito, com três implementações diferentes; assim as
  // nove ficam iguais por construção, e a próxima categoria nasce com ele.
  // Reset primeiro, Salvar depois — o `.config-acoes` alinha à direita.
  const botaoPadrao = padrao
    ? `<button class="btn btn-muted" id="btn-reset-${chave}">Restaurar padrão</button>`
    : '';
  if (botaoPadrao || acoes) {
    barra.insertAdjacentHTML('beforeend',
      `<div class="config-acoes hidden" data-categoria="${chave}">${botaoPadrao}${acoes}</div>`);
  }

  if (!_categoriaConfigAberta && lado === 'programa') _categoriaConfigAberta = chave;
  if (!_configCategoriaPorLado[lado]) _configCategoriaPorLado[lado] = chave;
}

/**
 * Tira uma categoria do trilho, do painel e da barra de ações.
 *
 * Existe por causa das extensões: uma categoria do lado Extensões nasce
 * quando a extensão é LIGADA e precisa sumir quando ela é desligada, na mesma
 * hora e sem reiniciar (D13). Nenhuma categoria do programa se desregistra.
 */
function desregistrarCategoriaConfig(chave) {
  const eraAberta = _categoriaConfigAberta === chave;
  const lado = _configLadoDaCategoria(chave);

  document.querySelectorAll(
    `#config-trilho .config-trilho-btn[data-categoria="${chave}"]`).forEach(el => el.remove());
  const secao = document.getElementById(`config-secao-${chave}`);
  if (secao) secao.remove();
  document.querySelectorAll(
    `#config-barra-acoes .config-acoes[data-categoria="${chave}"]`).forEach(el => el.remove());

  if (_configCategoriaPorLado[lado] === chave) _configCategoriaPorLado[lado] = null;
  // Sem isto o painel fica em branco: a categoria aberta acabou de sair do
  // DOM, e nada mais mandaria abrir outra.
  if (eraAberta) _configAbrirPrimeiraDoLado(_configLadoAberto);
}

/** Abre a primeira categoria disponível de um lado — nada, se não houver. */
function _configAbrirPrimeiraDoLado(lado) {
  const container = _configTrilhoDoLado(lado);
  const alvo = _configCategoriaPorLado[lado]
    && container && container.querySelector(
      `.config-trilho-btn[data-categoria="${_configCategoriaPorLado[lado]}"]`);
  const btn = alvo || (container && container.querySelector('.config-trilho-btn'));
  if (btn) abrirCategoriaConfig(btn.dataset.categoria);
}

/**
 * Troca o lado do trilho. Só os BOTÕES trocam de visibilidade — as seções do
 * painel continuam no DOM, escondidas por categoria como sempre.
 */
function trocarLadoConfig(lado) {
  _configLadoAberto = lado === 'extensoes' ? 'extensoes' : 'programa';

  document.querySelectorAll('#config-lados .mapa-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lado === _configLadoAberto);
  });
  // Os botões do lado Programa são filhos DIRETOS do <nav> (é o que faz
  // "Ordem das abas" continuar enxergando só eles); os do lado Extensões
  // moram num container próprio, e por isso ficam de fora da reordenação.
  document.querySelectorAll('#config-trilho > .config-trilho-btn').forEach(btn => {
    btn.classList.toggle('hidden', _configLadoAberto !== 'programa');
  });
  const caixaExt = document.getElementById('config-trilho-extensoes');
  if (caixaExt) caixaExt.classList.toggle('hidden', _configLadoAberto !== 'extensoes');

  const vazio = document.getElementById('config-lado-extensoes-vazio');
  if (vazio) {
    const temAlguma = !!(caixaExt && caixaExt.querySelector('.config-trilho-btn'));
    vazio.classList.toggle('hidden', _configLadoAberto !== 'extensoes' || temAlguma);
  }
}

/** Mostra uma categoria e esconde as outras — trilho, seção e barra juntos. */
function abrirCategoriaConfig(chave) {
  // A troca de lado vem ANTES de tudo, e é o que faz a busca atravessar os
  // dois lados sem saber que eles existem: `_configIrPara` chama esta função
  // com a chave achada, e o trilho se ajusta sozinho.
  const lado = _configLadoDaCategoria(chave);
  if (lado !== _configLadoAberto) trocarLadoConfig(lado);
  _configCategoriaPorLado[lado] = chave;

  document.querySelectorAll('#config-trilho .config-trilho-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.categoria === chave);
  });
  document.querySelectorAll('#config-rolagem .config-secao').forEach(secao => {
    secao.classList.toggle('hidden', secao.dataset.categoria !== chave);
  });
  document.querySelectorAll('#config-barra-acoes .config-acoes').forEach(grupo => {
    grupo.classList.toggle('hidden', grupo.dataset.categoria !== chave);
  });
  const rolagem = document.getElementById('config-rolagem');
  if (rolagem) rolagem.scrollTop = 0;
  _categoriaConfigAberta = chave;
}

// Um clique, um caminho. As três categorias com estado próprio continuam
// tendo o método delas no backend — não dá para "restaurar" uma lista de
// extensões escrevendo números —, mas o BOTÃO é o mesmo, e a tela repinta
// sempre com o que foi de fato gravado, nunca com o que deveria ter sido.
const _CONFIG_RESTAURADORES = {
  // Arquivos que o programa lê: as TRÊS vistas que gravam voltam à fábrica (o
  // botão é da categoria — decisão do usuário em 23/09/2026). "Aparência: onde
  // procurar" não tem mais entrada: virou duas partes das Exceções.
  extensoes: async () => {
    const r = await window.pywebview.api.reset_arquivos_lidos();
    if (r && r.success && typeof _extAdotarConfig === 'function') _extAdotarConfig(r);
    return r;
  },
  ordem: async () => {
    const r = await window.pywebview.api.save_tab_order({});
    if (r && r.success && typeof aplicarOrdemDeFabrica === 'function') aplicarOrdemDeFabrica();
    return r;
  },
  // Padrão de fábrica dos plugins: todos desligados, os dois checkboxes de
  // local desmarcados — ver `reset_plugins` em `modulos/plugins.py`.
  plugins: async () => {
    const r = await window.pywebview.api.reset_plugins();
    if (r && r.success) {
      pluginsArvore = r.arvore;
      if (typeof _pintarListaPlugins === 'function') _pintarListaPlugins();
      if (typeof atualizarAbasDePlugins === 'function') atualizarAbasDePlugins();
    }
    return r;
  },
  // Launchers: o backend já tinha `reset_atalhos_externos`; sem esta entrada o
  // botão caía em `restaurar_padroes`, que respondia "categoria sem padrão de
  // fábrica". Repinta a lista E as duas abas "Launchers", como `_salvarAtalhoExterno`.
  'atalhos-externos': async () => {
    const r = await window.pywebview.api.reset_atalhos_externos();
    if (r && r.success) {
      atalhosExternosArvore = r.arvore;
      if (typeof _pintarListaAtalhosExternos === 'function') _pintarListaAtalhosExternos();
      if (typeof atualizarAbasDeAtalhosExternos === 'function') atualizarAbasDeAtalhosExternos();
    }
    return r;
  },
  // Extensões do programa: toda extensão volta a desligada e o destaque
  // apaga. ⚠️ NENHUM ARQUIVO É APAGADO (D22) — nem a pasta da extensão, nem
  // o `files/` que ela gerou. Restaurar o padrão devolve o ESTADO à fábrica;
  // o que a extensão produziu continua sendo do usuário.
  xtprog: async () => {
    const r = await window.pywebview.api.reset_extensoes_programa();
    if (r && r.success && typeof xtAdotarArvore === 'function') await xtAdotarArvore(r);
    return r;
  },
};

// Prefixo das categorias do lado Extensões (`xt-{slug}`). Uma delas não tem
// restaurador próprio na tabela acima porque não existe UMA: cada extensão
// ligada com `config/tela.json` cria a sua, e o "Restaurar padrão" delas
// regrava os `padrao` do `tela.json` daquela extensão.
const CONFIG_PREFIXO_EXTENSAO = 'xt-';

// Quem repinta cada categoria depois de restaurar. Uma TABELA, e não um `if`
// por categoria — a lista cresce, e a categoria esquecida no `if` fica com a
// tela mostrando o número velho enquanto o disco já tem o novo.
//
// Fora daqui de propósito: `extensoes` repinta dentro do próprio
// restaurador (é lá que a lista devolvida chega); `modelo`, `tempos`, `rotinas`
// e `confirmacoes` vivem em `limites.js` e passam pelo `initLimitesConfig`, que
// roda para todas; `ordem` repinta dentro do próprio restaurador (`aplicarOrdemDeFabrica`).
const _CONFIG_REPINTORES = {
  // Esquece o cache da tabela de Chat/Fila › Ferramentas: ela reabre com os
  // tetos de fábrica.
  ferramentas:  async () => {
    if (typeof esquecerCatalogoDeFerramentas === 'function') esquecerCatalogoDeFerramentas();
    await initFerramentasConfig();
  },
  mcp:          () => initMcpConfig(),
  // ⚠️ `mcp` e `mcps` são categorias diferentes: limites dos dois do
  // programa × destino da pasta dos de terceiro. O 's' não é erro de digitação.
  mcps:         () => initConfigMcps(),
  tema:         () => initConfigTema(),
  render:       () => initConfigRender(),
  preparar:     () => initConfigPreparar(),
  acervo:       () => initConfigAcervo(),
  arquivos:     () => initConfigArquivos(),
  // `biblioteca` é Configurações › Arquivos; `arquivos` é Assistentes externos.
  biblioteca:   () => initConfigBiblioteca(),
  notificacoes: () => initConfigNotificacoes(),
  'acesso-rapido': () => initConfigAcessoRapido(),
  teclado:      () => initConfigTeclado(),
  // Repinta os campos E empurra a métrica para a aba Editor, se ela estiver
  // montada — sem isso, restaurar o padrão devolveria os números na tela e
  // deixaria o editor com a fonte antiga.
  editor:       () => { initConfigEditor(); aplicarConfiguracaoDoEditor(); },
};

/** O nome da categoria como o trilho o mostra, para a frase da confirmação. */
function _configRotuloDaCategoria(chave) {
  const btn = document.querySelector(
    `#config-trilho .config-trilho-btn[data-categoria="${chave}"]`);
  // `data-taborder-rotulo` existe justamente porque o `textContent` do botão
  // inclui o ícone — "◆Modelo e contexto".
  return (btn && btn.dataset.taborderRotulo) || 'esta categoria';
}

/**
 * Repinta um pedaço da tela sem deixar a falha dele derrubar o resto.
 *
 * ⚠️ Cada passo é ISOLADO, e isso é a correção de um defeito real: os passos
 * eram chamadas em sequência no mesmo `async`, então uma exceção no
 * `initLimitesConfig` — que roda para TODAS as categorias — pulava em silêncio
 * a repintura da categoria E o toast do fim. O disco já tinha o valor novo, a
 * tela continuava com o velho, e não sobrava nem mensagem de erro: o usuário
 * concluía que o botão não tinha feito nada, e só via a mudança ao reabrir o
 * programa.
 */
async function _configRepintar(qual, fn) {
  if (!fn) return;
  try {
    await fn();
  } catch (e) {
    console.error(`[config] falha ao repintar "${qual}" depois de restaurar:`, e);
  }
}

async function _configRestaurarPadrao(chave) {
  // ⚠️ A CONFIRMAÇÃO NÃO É OPCIONAL, e não passa pelo "Perguntar antes de
  // remover" da categoria Confirmações: aquele campo governa o que apaga
  // conteúdo do usuário (chat, tarefa, relatório). Este botão apaga OUTRA
  // coisa — números afinados à mão —, e apaga do mesmo jeito: `restaurar_padroes`
  // grava no disco na hora, sem passar pelo "Salvar" que está do lado dele e
  // sem desfazer. Um clique sem pergunta já custou vinte valores calibrados.
  abrirModalPadrao({
    title: 'Restaurar padrão',
    bodyHtml:
      `<p>Isto devolve <strong>${_configRotuloDaCategoria(chave)}</strong> ao estado de
        fábrica. Tudo o que você ajustou nesta categoria é substituído.</p>
       <p>⚠️ A gravação é <strong>imediata</strong>: não espera o “Salvar”, e não
        tem desfazer.</p>`,
    confirmLabel: 'Restaurar padrão',
    onConfirm: async (_overlay, showErr) => {
      const erro = await _configAplicarPadrao(chave);
      if (erro) { showErr('Não deu para restaurar: ' + erro); return false; }
    },
  });
}

/** Restaura de fato e repinta. Devolve a mensagem de erro, ou nada se deu certo. */
async function _configAplicarPadrao(chave) {
  // A categoria de UMA extensão não está na tabela: ela nasce e morre com a
  // extensão, e o padrão dela sai do `tela.json` daquela pasta.
  if (chave.startsWith(CONFIG_PREFIXO_EXTENSAO) && typeof xtRestaurarPreferencias === 'function') {
    const r = await xtRestaurarPreferencias(chave);
    if (!r || !r.success) return (r && r.error) || 'erro desconhecido';
    showToast('Padrão restaurado.');
    return;
  }

  const proprio = _CONFIG_RESTAURADORES[chave];
  const r = proprio
    ? await proprio()
    : await window.pywebview.api.restaurar_padroes(chave);
  if (!r || !r.success) return (r && r.error) || 'erro desconhecido';

  // Repinta a partir do que voltou — nunca do que "deveria" ter sido gravado.
  if (r.settings) appSettings = Object.assign({}, appSettings, r.settings);
  await _configRepintar('limites',
                        typeof initLimitesConfig === 'function' ? initLimitesConfig : null);
  await _configRepintar(chave, _CONFIG_REPINTORES[chave]);
  showToast('Padrão restaurado.');
}

/** Liga os botões do trilho e abre a categoria corrente. */
function initConfigCategorias() {
  const trilho = document.getElementById('config-trilho');
  if (!trilho) return;

  // Delegado na barra, e não botão a botão: as categorias se registram em
  // momentos diferentes, e um listener por botão perderia as que chegam
  // depois — a mesma razão do clique do trilho, logo abaixo.
  const barra = document.getElementById('config-barra-acoes');
  if (barra && !barra._wiredReset) {
    barra._wiredReset = true;
    barra.addEventListener('click', e => {
      const btn = e.target.closest('[id^="btn-reset-"]');
      if (btn) _configRestaurarPadrao(btn.id.replace('btn-reset-', ''));
    });
  }

  if (!trilho._wired) {
    trilho._wired = true;
    trilho.addEventListener('click', e => {
      // O nível de cima primeiro: os dois são cliques dentro do mesmo <nav>,
      // e um botão de lado não é uma categoria.
      const btnLado = e.target.closest('#config-lados .mapa-toggle-btn');
      if (btnLado) {
        trocarLadoConfig(btnLado.dataset.lado);
        _configAbrirPrimeiraDoLado(_configLadoAberto);
        return;
      }
      const btn = e.target.closest('.config-trilho-btn');
      if (btn) abrirCategoriaConfig(btn.dataset.categoria);
    });
  }

  trocarLadoConfig(_configLadoAberto);
  if (_categoriaConfigAberta) abrirCategoriaConfig(_categoriaConfigAberta);
}
