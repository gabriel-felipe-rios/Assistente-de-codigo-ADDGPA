// ═════════════════════════ EXTENSÕES DO PROGRAMA — A PÁGINA DE UMA EXTENSÃO ══
// O PROGRAMA desenha a página de cada extensão, ligada ou não, do lado
// Extensões do trilho de Configurações. A extensão não escreve HTML nenhum. A página tem
// quatro partes, de cima para baixo, e as três primeiras saem do MANIFESTO:
//
//   1. **Sobre** — nome, versão, ícone e o `descricao` do `extensao.json`
//      (ou o primeiro parágrafo do `LEIA-ME.md`, que o backend usa de reserva);
//   2. **O que ela acrescenta** — os tipos por nome, onde se encaixa, o que
//      observa ou pode barrar, o que responde, o dado que entrega, se roda
//      sozinha, se escreve fora da pasta — cada linha escrita por extenso a
//      partir dos catálogos do backend (`list_telas_de_extensoes` manda o
//      `catalogo` junto), e nunca de uma lista copiada para cá;
//   3. **Comandos no Acesso rápido** — para quem declara o ponto
//      `acesso-rapido.comandos`: a MESMA grade de Configurações › Teclado,
//      filtrada pelos comandos dela, com a tecla editável ali mesmo. Uma
//      configuração só, mostrada em três lugares (Teclado, Acesso rápido e
//      aqui) — escrever a segunda grade seria fazer a tecla que a tela mostra
//      deixar de ser a tecla que dispara;
//   4. **As opções** — os cartões do `config/tela.json`, para quem tem, com
//      as classes que já existem (`.config-cartao`, `.config-grade`,
//      `.config-field-row`, `.config-check`).
//
// A parte 2 mora em `extensoes/tela-acrescenta.js` e a 4 em
// `extensoes/tela-opcoes.js` (fase 13, pelo teto de 500 linhas); este
// arquivo tem a 1 e a 3, o registro, e o salvar e restaurar. Entre a 2 e a
// 3, para quem traz subagente, entram «Subagentes e o que cada um lê» e
// «Limites» (só leitura) — `extensoes/tela-subagentes.js` (fase 07, D50, D53).
//
// É isso que faz vinte extensões diferentes terem exatamente a cara das vinte
// categorias do programa — e o que impede a vigésima primeira de inventar um
// campo com outra medida e outra cor.
//
// ⚠️ **TODA extensão tem página, ligada ou não** (D47, 23/09/2026; até
// 06/09/2026 só quem tinha `config/tela.json` aparecia, e até 23/09/2026 só as
// ligadas). Uma extensão de dado puro (ícones, gramáticas) não tem opção
// nenhuma e precisa do mesmo jeito de um lugar que diga o que ela é — e a
// desligada também: o que ela É não muda por estar parada, e é aqui que o
// usuário lê o que ganharia ao ligá-la. A desligada abre com a faixa âmbar
// "Desligada." e o botão para o interruptor, e fica sem a grade de comandos
// (os comandos só existem com ela carregada). Sem `tela.json` a página não
// tem a parte 4, nem "Salvar", nem "Restaurar padrão": um botão que não grava
// nada seria o "Salvar decorativo" que Padrões de interface › Exceções proíbe.
//
// ⚠️ **A página NÃO leva `data-origem="extensao"`** — o lado Extensões do
// trilho já diz de onde ela veio, e o "Destacar extensões" existe para o que
// uma extensão põe NO MEIO de uma tela do programa (ver `destaque.js`).
//
// ⚠️ **O interruptor de ligar/desligar NÃO mora aqui** (D12). Ele é só em
// Configurações › Programa › Extensões. Dois lugares para o mesmo estado é um
// lugar para ele ficar errado — a página tem um botão que LEVA até lá. Vale
// para a desligada também: a faixa dela LEVA ao interruptor, não o traz.

// Glifo das categorias do lado Extensões. Monocromático, nunca emoji (Padrões
// de interface › Trilho de categorias), e fora dos que o lado Programa já
// usa. Todas as extensões dividem o mesmo: elas são a MESMA espécie de coisa,
// e um glifo diferente por extensão sugeriria uma diferença que não existe.
const XT_ICONE_CATEGORIA = '◇';

// `{slug}` das telas que já viraram categoria. É contra este conjunto que a
// lista nova é comparada — sem ele, religar uma extensão registraria a
// categoria dela duas vezes.
const _xtTelasRegistradas = new Set();

// `{slug: JSON do que está pintado}` — a foto do disco que o corpo de cada
// categoria mostra agora. É o que decide se `xtSincronizarTelas` repinta ou
// não; ver o aviso lá.
const _xtTelasPintadas = new Map();

function _xtFotoDaTela(tela) {
  // A `folha` entra na foto: editar o `extensao.json` com o programa aberto
  // (uma `descricao` nova, um encaixe a mais) tem de repintar a página.
  // O `ligado` entra explícito (a `folha` já muda com ele): se um dia a `folha`
  // sair da foto, ligar/desligar continua repintando a página aberta.
  // Os limites gerais entram também: são do catálogo, e não da tela, e
  // mudam quando o usuário salva Programa › Ferramentas dos subagentes (D53).
  return JSON.stringify([tela.tela, tela.preferencias, tela.padroes, tela.erro,
                         tela.nome, tela.tem_tela, tela.folha, tela.ligado,
                         _xtCatalogoDaPagina.limites_dos_subagentes || []]);
}

// O catálogo que veio com a última lista: o `onde` de cada ponto, o `quando`
// de cada evento e consulta, e o nome de cada tipo. Vazio até a ponte
// responder — e aí a página escreve só o nome cru, que é feio mas visível.
let _xtCatalogoDaPagina = { tipos: {}, recursos: {}, pontos: {}, eventos: {}, consultas: {},
                            alvos_de_prompt: {}, limites_dos_subagentes: [] };

function _xtChaveDaCategoria(slug) {
  return `xt-${slug}`;
}

// ── A página: as partes 1 e 3 (a 2 é `tela-acrescenta.js`) ──────────────

/** A faixa da extensão desligada (D47) — Faixa de aviso com ação, âmbar: é um
 *  estado que continua verdadeiro enquanto dura, não um erro. O botão é o
 *  MESMO de `.xt-sobre-acoes` (o clique é delegado no corpo). A faixa diz o
 *  estado; um manifesto quebrado continua dizendo o porquê na ficha. */
function _xtFaixaDesligadaHtml(tela) {
  if (tela.ligado !== false) return '';
  return `
      <div class="xt-faixa-desligada" role="status">
        <span class="xt-faixa-desligada-ic" aria-hidden="true">⚠</span>
        <span class="xt-faixa-desligada-texto"><strong>Desligada.</strong>
          O que ela acrescenta só vale com ela ligada.</span>
        <button type="button" class="btn btn-muted btn-xs" data-xt-ir="xtprog">
          Ligar ou desligar: Programa › Extensões</button>
      </div>`;
}

/** 1 · Sobre: ícone, nome, versão, descrição e a pasta. */
function _xtSobreHtml(tela) {
  const f = tela.folha || {};
  const icone = f.tem_icone
    ? `<img class="xt-sobre-icone" src="${xtBaseUrl(tela.caminho)}/icone.svg" alt="" />`
    // Sem `icone.svg`, o mesmo glifo que a categoria tem no trilho — e não um
    // quadrado vazio.
    : `<span class="xt-sobre-icone xt-sobre-glifo">${XT_ICONE_CATEGORIA}</span>`;
  const versao = f.versao ? `<span class="xt-sobre-versao">v${escapeHtml(String(f.versao))}</span>` : '';
  // A descrição vem do manifesto, ou do LEIA-ME (o backend já escolheu). Sem
  // nenhum dos dois, a página DIZ o que falta em vez de deixar um vazio que
  // parece defeito da tela.
  const descricao = f.descricao
    ? escapeHtml(String(f.descricao))
    : `<span class="xt-sobre-sem">Esta extensão não se descreveu. Um campo
        <code>descricao</code> no <code>extensao.json</code>, ou um parágrafo
        depois do título do <code>LEIA-ME.md</code>, aparece aqui.</span>`;
  return `
    <div class="config-cartao">${_xtFaixaDesligadaHtml(tela)}
      <div class="xt-sobre-cabeca">
        ${icone}
        <div class="xt-sobre-texto">
          <div class="xt-sobre-nome">${escapeHtml(String(tela.nome || ''))}${versao}</div>
          <p class="xt-sobre-descricao">${descricao}</p>
        </div>
      </div>
      <div class="xt-sobre-acoes">
        <span class="config-nota">Pasta <code>External/extensions/${escapeHtml(tela.caminho)}/</code></span>
        <button type="button" class="btn btn-muted btn-xs" data-xt-ir="xtprog"
                title="Ligar e desligar é só lá — dois lugares para o mesmo interruptor é um lugar para ele ficar errado">
          Ligar ou desligar: Programa › Extensões</button>
      </div>
    </div>`;
}

/**
 * 3 · Os comandos que ela pôs na barra de Acesso rápido — só para quem
 * declarou o ponto. A grade é a de `config-teclado.js`, pintada depois, por
 * `_xtPintarComandos`: os comandos entram no registro quando os encaixes da
 * extensão carregam, o que acontece DEPOIS de esta página ser registrada
 * (ver a ordem em `xtAdotarArvore`).
 */
function _xtComandosHtml(tela) {
  const f = tela.folha || {};
  if (!(f.encaixes || []).some((e) => e.ponto === 'acesso-rapido.comandos')) return '';
  // Desligada: os comandos só entram no registro quando a extensão carrega, e
  // a grade sairia vazia com um "Nenhum comando agora" que mente o porquê.
  if (tela.ligado === false) return '';
  return `
    <div class="config-cartao">
      <div class="config-cartao-cabecalho">
        <div class="config-cartao-titulo">Comandos no Acesso rápido</div>
        <p class="config-cartao-dica">
          Aparecem no <b>Ctrl+P</b>, modo Comando, sob o nome desta extensão. A
          tecla de cada um se muda aqui mesmo — é a mesma grade de
          Configurações › Programa › Teclado, e desligar a extensão não apaga a
          tecla que você escolheu.
        </p>
      </div>
      <div class="tecla-grade xt-tela-comandos" data-xt-slug="${escapeHtml(tela.slug)}">
        <div class="tecla-cab">Comando</div>
        <div class="tecla-cab">Onde vale</div>
        <div class="tecla-cab">Tecla</div>
        <div class="tecla-cab"></div>
      </div>
      <p class="config-nota xt-tela-comandos-vazio hidden">Nenhum comando agora — a
        extensão só oferece os dela em certas situações (um projeto aberto, um
        arquivo no Editor).</p>
    </div>`;
}

/** Pinta a grade de comandos de UMA página, do registro de teclas. */
function _xtPintarComandos(slug) {
  const grade = document.querySelector(`.xt-tela-comandos[data-xt-slug="${slug}"]`);
  if (!grade || typeof pintarGradeDeTeclas !== 'function') return;
  if (typeof xtRegistrarComandosAgora === 'function') xtRegistrarComandosAgora();
  const ids = obterTeclas().filter((c) => c.slug === slug).map((c) => c.id);
  pintarGradeDeTeclas(grade, ids);
  if (typeof ligarGradeDeTeclas === 'function') ligarGradeDeTeclas(grade);
  const vazio = grade.parentElement.querySelector('.xt-tela-comandos-vazio');
  if (vazio) vazio.classList.toggle('hidden', ids.length > 0);
}

/**
 * Repinta a grade de comandos de TODAS as páginas na tela. Chamada quando os
 * comandos mudam de fato: depois da carga de uma extensão (`xtAdotarArvore`)
 * e quando uma tecla é trocada na grade de Teclado (`repintarGradesDeTeclas`).
 */
// eslint-disable-next-line no-unused-vars
function xtRepintarComandosDasTelas() {
  document.querySelectorAll('.xt-tela-comandos[data-xt-slug]').forEach((grade) => {
    _xtPintarComandos(grade.dataset.xtSlug);
  });
}

/** O corpo da seção de UMA extensão: as quatro partes, nesta ordem. */
function _xtCorpoDaTelaHtml(tela) {
  // «Subagentes e o que cada um lê» e «Limites» (fase 07) só aparecem para
  // quem traz subagente — ver `extensoes/tela-subagentes.js`.
  return _xtSobreHtml(tela) + _xtAcrescentaHtml(tela)
    + _xtSubagentesHtml(tela) + _xtLimitesHtml(tela)
    + _xtComandosHtml(tela) + _xtOpcoesHtml(tela);
}

// ── Registro e baixa ────────────────────────────────────────────────────

/** O subtítulo da seção — diz o estado (D47). */
function _xtResumoDaTela(tela) {
  const base = tela.tem_tela ? 'o que ela faz, e as opções dela' : 'o que ela faz';
  return tela.ligado === false ? `desligada — ${base}` : base;
}

function _xtRegistrarTela(tela) {
  const chave = _xtChaveDaCategoria(tela.slug);
  registrarCategoriaConfig({
    chave,
    // O `nome` vem do `extensao.json` de terceiro e entra num `<h2>` e num
    // atributo — escapado aqui, porque `registrarCategoriaConfig` aceita HTML
    // no rótulo de propósito (as categorias do programa usam `<code>`).
    rotulo: escapeHtml(String(tela.nome || '')),
    icone: XT_ICONE_CATEGORIA,
    resumo: _xtResumoDaTela(tela),
    lado: 'extensoes',
    // `deExtensao` é o que a põe do lado Extensões, mande o `lado` o que
    // mandar — e só isso: a seção não é marcada para o destaque (ver o topo).
    deExtensao: true,
    conteudo: `<div class="xt-tela-corpo" id="xt-tela-corpo-${tela.slug}"
                    data-xt-slug="${escapeHtml(tela.slug)}"
                    data-xt-caminho="${escapeHtml(tela.caminho)}">
                 ${_xtCorpoDaTelaHtml(tela)}
               </div>`,
    // Sem `tela.json` não há o que salvar nem o que restaurar — e um botão
    // que não grava nada é o "Salvar decorativo" que as Exceções proíbem.
    padrao: !!tela.tem_tela,
    acoes: tela.tem_tela
      ? `<button class="btn btn-positive" id="btn-save-${chave}">Salvar</button>` : '',
  });
  _xtTelasRegistradas.add(tela.slug);
  _xtTelasPintadas.set(tela.slug, _xtFotoDaTela(tela));

  // O botão "ir para" da página (Programa › Extensões). Delegado no corpo,
  // que sobrevive às repinturas por `innerHTML`; um listener no botão
  // morreria na primeira.
  const corpo = document.getElementById(`xt-tela-corpo-${tela.slug}`);
  if (corpo && !corpo._wiredIr) {
    corpo._wiredIr = true;
    corpo.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-xt-ir]');
      if (btn && typeof abrirCategoriaConfig === 'function') abrirCategoriaConfig(btn.dataset.xtIr);
    });
  }
  _xtPintarComandos(tela.slug);
}

/** Tira a categoria de uma extensão que SUMIU do disco (apagada, ou movida —
 *  o slug muda com o caminho). Desligar não tira mais (D47). */
function xtDesregistrarTela(slug) {
  if (!_xtTelasRegistradas.has(slug)) return;
  desregistrarCategoriaConfig(_xtChaveDaCategoria(slug));
  _xtTelasRegistradas.delete(slug);
  _xtTelasPintadas.delete(slug);
}

/** Repinta o corpo de UMA categoria a partir do que o disco devolveu. */
function _xtRepintarCorpo(tela) {
  const corpo = document.getElementById(`xt-tela-corpo-${tela.slug}`);
  if (corpo) corpo.innerHTML = _xtCorpoDaTelaHtml(tela);
  // O `resumo` só é lido no registro: ligar/desligar com a página já
  // registrada troca o subtítulo aqui — re-registrar piscaria a seção.
  const sub = document.querySelector(
    `#config-secao-${_xtChaveDaCategoria(tela.slug)} > .config-secao-cabecalho > span`);
  if (sub) sub.textContent = _xtResumoDaTela(tela);
  _xtTelasPintadas.set(tela.slug, _xtFotoDaTela(tela));
  _xtPintarComandos(tela.slug);
}

/**
 * Põe o lado Extensões em dia: registra a categoria de quem apareceu, tira a
 * de quem sumiu do disco, e repinta quem já estava lá — SE mudou (inclusive
 * ligar↔desligar, que agora só repinta: a página fica — D47).
 *
 * Repintar em vez de re-registrar é deliberado: re-registrar recriaria o
 * botão do trilho e a seção, e a categoria que o usuário está olhando
 * piscaria e voltaria ao topo da rolagem a cada gravação.
 *
 * ⚠️ E repintar SÓ quando o disco mudou também é deliberado. Isto roda em
 * toda adoção de árvore — ligar qualquer extensão, salvar a ordem, restaurar
 * padrão, reabrir a categoria. Reescrever o `innerHTML` a cada uma delas
 * apagava o que o usuário estava DIGITANDO no painel de uma extensão: ele
 * mudava um número, clicava numa bolinha de cor do destaque, e o número
 * voltava ao valor do disco sem aviso. Se a foto do disco é a mesma que está
 * pintada, o que está na tela é mais novo que ela, e fica.
 */
async function xtSincronizarTelas() {
  try {
    const r = await window.pywebview.api.list_telas_de_extensoes();
    xtTelas = (r && r.success) ? (r.telas || []) : [];
    if (r && r.success && r.catalogo) _xtCatalogoDaPagina = r.catalogo;
  } catch (e) {
    console.error('[extensoes] falha ao listar as telas:', e);
    xtTelas = [];
  }

  const vivas = new Set(xtTelas.map(t => t.slug));
  for (const slug of [..._xtTelasRegistradas]) {
    if (!vivas.has(slug)) xtDesregistrarTela(slug);
  }

  for (const tela of xtTelas) {
    if (!_xtTelasRegistradas.has(tela.slug)) {
      _xtRegistrarTela(tela);
    } else if (_xtTelasPintadas.get(tela.slug) !== _xtFotoDaTela(tela)) {
      _xtRepintarCorpo(tela);
    }
  }

  // O trilho pode ter ficado vazio (a última extensão sumiu do disco) ou
  // ganhado a primeira entrada — quem diz isso na tela é a troca de lado.
  if (typeof trocarLadoConfig === 'function' && typeof _configLadoAberto === 'string') {
    trocarLadoConfig(_configLadoAberto);
  }
}

// ── Salvar e restaurar ──────────────────────────────────────────────────

function _xtTelaDoSlug(slug) {
  return xtTelas.find(t => t.slug === slug) || null;
}

/**
 * As opções de UMA extensão, resolvidas, do que está em memória — SÍNCRONA.
 *
 * É o que uma extensão lê de dentro de um gancho de decorador, de uma guardiã
 * ou de um item de menu, onde não cabe uma ida à ponte: `xtTelas` já tem as
 * preferências de toda extensão com `config/tela.json`, resolvidas
 * por cima dos `padrao`, e é atualizado a cada "Salvar" e "Restaurar padrão".
 *
 * Devolve `null` quando a extensão não tem `tela.json` — ou quando ainda não
 * entrou em `xtTelas` (a lista é sincronizada ANTES da carga do frontend, ver
 * `xtAdotarArvore`, então no `xtMontar` ela já está lá; `null` aqui é o caso
 * da extensão sem tela). Quem lê mescla com os próprios padrões:
 *
 *     const prefs = { ...PADRAO, ...(xtPreferenciasDe(EU.slug) || {}) };
 *
 * ⚠️ Toda extensão está em `xtTelas` — ligada desde 06/09/2026, desligada
 * desde 23/09/2026 (D47) —, e é o `tem_tela` que continua dizendo se há
 * opções. Código novo que precise só das ligadas filtra por `t.ligado`: a
 * lista não é mais "as ligadas".
 */
// eslint-disable-next-line no-unused-vars
function xtPreferenciasDe(slug) {
  const tela = _xtTelaDoSlug(slug);
  return (tela && tela.tem_tela) ? { ...(tela.preferencias || {}) } : null;
}

/**
 * Avisa a extensão de que as opções dela mudaram — o gancho OPCIONAL
 * `window.xtPreferenciasMudaram_{slug}(preferencias)`, no molde de
 * `xtMontar`/`xtDesmontar`.
 *
 * É o que faz "Salvar" valer NA HORA: sem ele, uma extensão que leu as
 * opções no `xtMontar` (a cor de uma marca, o `<style>` já injetado) só veria
 * o valor novo ao religar — e o `tela.json` de "Tingir a janela" tinha uma
 * nota dizendo exatamente isso ao usuário. Protegido: uma extensão que
 * explode no gancho não impede o "Salvar" de terminar.
 */
function _xtAvisarPreferencias(slug) {
  const gancho = window[`xtPreferenciasMudaram_${slug}`];
  if (typeof gancho !== 'function') return;
  try {
    const r = gancho(xtPreferenciasDe(slug) || {});
    if (r && typeof r.catch === 'function') {
      r.catch(e => console.error(`[extensoes] xtPreferenciasMudaram_${slug} falhou:`, e));
    }
  } catch (e) {
    console.error(`[extensoes] xtPreferenciasMudaram_${slug} falhou:`, e);
  }
}

/** Lê os campos da seção de uma extensão, com o tipo que cada um declarou. */
function _xtColetarValores(slug) {
  const corpo = document.getElementById(`xt-tela-corpo-${slug}`);
  if (!corpo) return null;
  const valores = {};
  corpo.querySelectorAll('[data-xt-campo]').forEach(linha => {
    const chave = linha.dataset.xtCampo;
    const entrada = linha.querySelector('input, select');
    if (!entrada) return;
    const tipo = linha.dataset.xtTipo;
    if (tipo === 'interruptor' || tipo === 'caixa') valores[chave] = entrada.checked;
    // `valueAsNumber` devolve NaN no campo vazio, e NaN vira `null` no JSON —
    // que é exatamente o que "o usuário apagou o número" quer dizer.
    else if (tipo === 'numero') {
      valores[chave] = Number.isNaN(entrada.valueAsNumber) ? null : entrada.valueAsNumber;
    } else valores[chave] = entrada.value;
  });
  return valores;
}

async function _xtGravarPreferencias(slug, valores) {
  const tela = _xtTelaDoSlug(slug);
  if (!tela) return { success: false, error: 'extensão não está mais na lista' };
  try {
    const r = await window.pywebview.api.save_preferencias_extensao(tela.caminho, valores);
    if (!r || !r.success) return r || { success: false, error: 'erro desconhecido' };
    // Repinta a partir do que voltou do disco, nunca do que foi mandado —
    // mesma regra do "Restaurar padrão" das outras categorias. E repinta
    // SEMPRE, mesmo que a foto seja igual: o usuário acabou de mandar gravar,
    // e a tela tem de mostrar o que ficou — inclusive uma chave que o
    // backend filtrou por não estar no `tela.json`.
    xtTelas = r.telas || [];
    const atual = _xtTelaDoSlug(slug);
    if (atual) _xtRepintarCorpo(atual);
    _xtAvisarPreferencias(slug);
    // Uma extensão de dado puro (a Ícones de arquivo) não tem `frontend/` para
    // o gancho acima: quem reaplica a escolha do pacote é o programa, e as
    // listas abertas trocam de ícone na hora (`repintarIconesNaTela`). Barato
    // — troca duas variáveis —, e por isso roda para o Salvar de qualquer uma.
    if (typeof xtAplicarIconesEscolhidos === 'function') xtAplicarIconesEscolhidos();
    return { success: true };
  } catch (e) {
    console.error('[extensoes] falha ao gravar as preferências:', e);
    return { success: false, error: String(e) };
  }
}

/** O "Salvar" da barra de ações da categoria de uma extensão. */
async function xtSalvarPreferencias(chave) {
  const slug = chave.slice(_xtChaveDaCategoria('').length);
  const valores = _xtColetarValores(slug);
  if (!valores) return;
  const r = await _xtGravarPreferencias(slug, valores);
  if (r.success) showToast('Opções salvas!');
  else showToast(r.error || 'Não foi possível salvar.', true);
}

/**
 * O "Restaurar padrão" da categoria de uma extensão: grava os `padrao` que o
 * próprio `tela.json` declarou.
 *
 * ⚠️ Isto não apaga o `files/` da extensão nem toca na pasta dela (D22) — só
 * devolve as OPÇÕES ao que a extensão diz ser o padrão.
 */
async function xtRestaurarPreferencias(chave) {
  const slug = chave.slice(_xtChaveDaCategoria('').length);
  const tela = _xtTelaDoSlug(slug);
  if (!tela) return { success: false, error: 'extensão não está mais na lista' };
  return _xtGravarPreferencias(slug, { ...(tela.padroes || {}) });
}
