// ══════════════════════════════════ ABA: CONFIGURAÇÕES — LIMITES DE CONTEXTO ══
// Substitui os antigos limites por agente em caracteres (o do Espelho, retirado
// em 2026-09, e o da doc técnica) por um orçamento único em tokens, calculado por arquivo. Ver
// backend/modulos/tokens.py::calcular_orcamento e configuracoes.py::load_limites.

// ⚠️ `janela_contexto` NÃO está aqui, e isso é o ponto.
//
// O campo virou somente-leitura: quem o escreve agora é o LM Studio, por
// `get_context_window()`. A chave continua sendo o que o backend inteiro lê —
// mudou QUEM a escreve, não quem a usa. Deixá-la nesta lista faria o "Salvar
// limites" regravar por cima do valor consultado, que é justamente o defeito
// que a mudança conserta.
const LIMITES_CAMPOS = [
  ['input-teto-entrada',    'teto_entrada_pct'],
  ['input-teto-saida',      'teto_saida_pct'],
  ['input-margem-pct',      'margem_pct'],
  ['input-debounce-t1-segundos', 'debounce_t1_segundos'],
  ['input-debounce-t2-segundos', 'debounce_t2_segundos'],
  ['input-debounce-t3-segundos', 'debounce_t3_segundos'],
  ['input-timeout-agente-minutos', 'timeout_agente_minutos'],
  // Da categoria "Rotinas da Automacao" — ver `config-rotinas-template.js`.
  // Mesma gravacao das outras duas: um `Salvar` por categoria, um patch so.
  ['input-paralelas-rotinas', 'paralelas_rotinas'],
  // As réguas de similaridade e o tamanho do pedaço (Etapa 3) — números, então
  // entram aqui mesmo; os dois interruptores é que precisaram de lista própria.
  ['input-doc-tecnica-similaridade', 'doc_tecnica_similaridade_pct'],
  ['input-resumo-pastas-similaridade', 'resumo_pastas_similaridade_pct'],
  ['input-pedaco-tokens', 'pedaco_tokens'],
  // "A régua do Pipeline" (Pipeline em níveis, fase 03) — inteiros, então
  // entram aqui mesmo, como as réguas de similaridade.
  ['input-pipeline-cadeia-refazer', 'pipeline_cadeia_refazer_pct'],
  ['input-pipeline-bloco-refazer', 'pipeline_bloco_refazer_pct'],
  ['input-pipeline-area-refazer', 'pipeline_area_refazer_pct'],
  ['input-pipeline-cadeia-niveis', 'pipeline_cadeia_niveis'],
  // "Tamanho das respostas" (D19). O fator, que tem vírgula, mora em
  // `LIMITES_CAMPOS_DECIMAIS`, logo abaixo.
  ['input-teto-proporcional-base', 'teto_proporcional_base'],
  ['input-limite-sintese-chars', 'limite_sintese_chars'],
  ['input-limite-texto-chars', 'limite_texto_chars'],
  ['input-limite-atribuicoes', 'limite_atribuicoes'],
  ['input-limite-tags', 'limite_tags'],
  ['input-limite-termos-por-arquivo', 'limite_termos_por_arquivo'],
  // "Partes e costura": a resposta estimada do Resumo de Pastas (D30, D36).
  ['input-resumo-pastas-tokens-por-arquivo', 'resumo_pastas_tokens_por_arquivo'],
  ['input-resumo-pastas-margem-estimativa', 'resumo_pastas_margem_estimativa_pct'],
  ['input-resumo-pastas-max-arquivos-por-parte', 'resumo_pastas_max_arquivos_por_parte'],
  // "Partes e costura", um cartão por rotina (D21, D28): o «% da janela» de
  // cada uma e «O máximo aceito, mesmo dividindo» (D15, D29).
  ['input-doc-tecnica-teto-entrada', 'doc_tecnica_teto_entrada_pct'],
  ['input-doc-tecnica-max-kb', 'doc_tecnica_max_kb'],
  ['input-doc-tecnica-max-linhas', 'doc_tecnica_max_linhas'],
  ['input-doc-tecnica-max-tokens', 'doc_tecnica_max_tokens'],
  ['input-resumo-pastas-teto-entrada', 'resumo_pastas_teto_entrada_pct'],
  ['input-resumo-pastas-max-arquivos', 'resumo_pastas_max_arquivos'],
  ['input-resumo-pastas-max-tokens', 'resumo_pastas_max_tokens'],
  // "Quem entra no Glossário" (D29). A porcentagem, que tem vírgula, mora em
  // `LIMITES_CAMPOS_DECIMAIS`; o modo, que é texto, em `LIMITES_CAMPOS_ESCOLHA`.
  ['input-glossario-minimo-piso', 'glossario_minimo_piso'],
  ['input-glossario-minimo-fixo', 'glossario_minimo_fixo'],
];

// ⚠️ LISTA SEPARADA, E NÃO É ORGANIZAÇÃO: `saveLimites` percorre a lista acima
// com `parseInt`, e `parseInt` de um `<input type="checkbox">` é `NaN`. Um
// checkbox lá dentro cairia no `showToast('Preencha todos os campos…')` e
// travaria o botão Salvar da CATEGORIA INTEIRA — inclusive o campo numérico que
// estava certo.
//
// Do outro lado, `save_limites` (`configuracoes.py`) tem o ramo irmão deste:
// sem ele, `max(1, int(False))` gravaria 1 e o interruptor desligado voltaria
// ligado sozinho.
const LIMITES_CAMPOS_BOOLEANOS = [
  ['input-ignorar-so-espaco',     'ignorar_so_espaco'],
  ['input-ignorar-so-comentario', 'ignorar_so_comentario'],
  // "Partes e costura" (D9, D26, D30) e a ficha do Resumo (D20, D25).
  ['input-doc-tecnica-dividir',             'doc_tecnica_dividir'],
  ['input-resumo-pastas-dividir',           'resumo_pastas_dividir'],
  ['input-resumo-pastas-ficha-atribuicoes', 'resumo_pastas_ficha_atribuicoes'],
  ['input-resumo-pastas-ficha-simbolos',    'resumo_pastas_ficha_simbolos'],
  ['input-resumo-pastas-ficha-frases',      'resumo_pastas_ficha_frases'],
  ['input-resumo-pastas-ficha-usa',         'resumo_pastas_ficha_usa'],
];

// ⚠️ LISTA SEPARADA PELO MESMO MOTIVO: o `parseInt` de `saveLimites` faria do
// 0,5 um 0 — e o `!valor` travaria o Salvar da categoria. Aqui é `parseFloat`.
// Do outro lado, `_LIMITES_DECIMAIS` (`configuracoes_modelo.py`) é o ramo irmão.
const LIMITES_CAMPOS_DECIMAIS = [
  ['input-teto-proporcional-fator', 'teto_proporcional_fator'],
  ['input-glossario-minimo-pct', 'glossario_minimo_pct'],
];

// ⚠️ LISTA SEPARADA PELO MESMO MOTIVO: o modo do mínimo do Glossário é TEXTO
// (`proporcional` · `fixo`), dois rádios com um `name` só — nem `parseInt`
// nem o `.checked` de um id servem. Cada item: o `name` dos rádios e a chave.
// Do outro lado, `_LIMITES_ESCOLHAS` (`configuracoes_modelo.py`) é o ramo irmão.
const LIMITES_CAMPOS_ESCOLHA = [
  ['glossario-minimo-modo', 'glossario_minimo_modo'],
];

async function initLimitesConfig() {
  const r = await window.pywebview.api.load_limites();
  if (r.success) {
    LIMITES_CAMPOS.forEach(([id, chave]) => {
      const input = document.getElementById(id);
      if (input) input.value = r.limites[chave];
    });
    LIMITES_CAMPOS_BOOLEANOS.forEach(([id, chave]) => {
      const caixa = document.getElementById(id);
      if (caixa) caixa.checked = !!r.limites[chave];
    });
    LIMITES_CAMPOS_DECIMAIS.forEach(([id, chave]) => {
      const input = document.getElementById(id);
      if (input) input.value = r.limites[chave];
    });
    LIMITES_CAMPOS_ESCOLHA.forEach(([nome, chave]) => {
      const marcado = document.querySelector(`input[name="${nome}"][value="${r.limites[chave]}"]`);
      if (marcado) marcado.checked = true;
    });
    // A janela entra pela porta de leitura, com o valor salvo de reserva.
    await _renderJanelaDeContexto(r.limites.janela_contexto);
    _renderContaDaEntrada();
    ['input-teto-entrada', 'input-teto-saida', 'input-margem-pct'].forEach(id => {
      const campo = document.getElementById(id);
      if (campo && !campo._wiredConta) {
        campo._wiredConta = true;
        campo.addEventListener('input', _renderContaDaEntrada);
      }
    });
    // Os exemplos de Rotinas da Automação. Os campos de % da janela já chegam
    // aqui por `_renderContaDaEntrada`, que chama os dois.
    [['input-teto-proporcional-base', _renderTetoProporcional],
     ['input-teto-proporcional-fator', _renderTetoProporcional],
     ['input-paralelas-rotinas', _renderPartesECostura],
     ['input-doc-tecnica-teto-entrada', _renderPartesECostura],
     ['input-resumo-pastas-teto-entrada', _renderPartesECostura],
     ['input-resumo-pastas-tokens-por-arquivo', _renderEstimativaDoResumo],
     ['input-resumo-pastas-margem-estimativa', _renderEstimativaDoResumo],
     ['input-resumo-pastas-max-arquivos-por-parte', _renderEstimativaDoResumo],
     ['input-glossario-minimo-proporcional', _renderMinimoDoGlossario],
     ['input-glossario-minimo-modo-fixo', _renderMinimoDoGlossario],
     ['input-glossario-minimo-pct', _renderMinimoDoGlossario],
     ['input-glossario-minimo-piso', _renderMinimoDoGlossario],
     ['input-glossario-minimo-fixo', _renderMinimoDoGlossario]].forEach(([id, render]) => {
      const campo = document.getElementById(id);
      if (campo && !campo._wiredConta) {
        campo._wiredConta = true;
        campo.addEventListener('input', render);
      }
    });
    _renderTetoProporcional();
    _renderPartesECostura();
    _renderEstimativaDoResumo();
    // O exemplo do Glossário usa o projeto exibido: pergunta uma vez.
    await _carregarArquivosDocumentados();
    _renderMinimoDoGlossario();
  }

  await _initLmStudioUrl();
  await _initModeloEGeracao();
  await _initTempoMaximoDoSubagente();
  await _initPoliticaDeSaida();
  await _initEncerrarEExcluir();

  // Três botões, uma gravação só: os campos foram repartidos entre as
  // categorias "Modelo e contexto", "Tempos e ciclos" e "Rotinas da Automação",
  // mas continuam sendo salvos juntos — `saveLimites` lê todos os inputs, e
  // todos existem no DOM mesmo quando a categoria deles está recolhida.
  ['btn-save-limites', 'btn-save-tempos', 'btn-save-rotinas'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn && !btn._wired) {
      btn._wired = true;
      btn.addEventListener('click', saveLimites);
    }
  });

  _renderOrcamentoPreview();
}

async function saveLimites() {
  const patch = {};
  for (const [id, chave] of LIMITES_CAMPOS) {
    const input = document.getElementById(id);
    if (!input) continue;
    const valor = parseInt(input.value, 10);
    if (!valor && valor !== 0) {
      showToast('Preencha todos os campos com números válidos.', true);
      return;
    }
    patch[chave] = valor;
  }
  for (const [id, chave] of LIMITES_CAMPOS_BOOLEANOS) {
    const caixa = document.getElementById(id);
    if (caixa) patch[chave] = caixa.checked;
  }
  for (const [id, chave] of LIMITES_CAMPOS_DECIMAIS) {
    const input = document.getElementById(id);
    if (!input) continue;
    const valor = parseFloat(input.value);
    if (!(valor > 0)) {
      showToast('Preencha todos os campos com números válidos.', true);
      return;
    }
    patch[chave] = valor;
  }
  for (const [nome, chave] of LIMITES_CAMPOS_ESCOLHA) {
    const marcado = document.querySelector(`input[name="${nome}"]:checked`);
    if (marcado) patch[chave] = marcado.value;
  }
  const r = await window.pywebview.api.save_limites(patch);
  if (r.success) {
    showToast('Limites salvos!');
    _renderOrcamentoPreview();
    // Os cartões de Rotinas da Automação dependem destes números — a
    // estimativa do Resumo de Pastas, do teto de saída.
    _renderTetoProporcional();
    _renderPartesECostura();
    _renderEstimativaDoResumo();
  } else {
    showToast('Erro ao salvar limites.', true);
  }
}

// Prévia com um exemplo fixo — não depende de projeto aberto, então funciona
// mesmo na tela inicial de Projetos. Mostra a mesma conta de trás para frente
// que o agente de Documentação Técnica faz por arquivo.
const _LIMITES_PROMPT_EXEMPLO = 'x'.repeat(1800);     // ~ prompt fixo típico
const _LIMITES_ESQUELETO_EXEMPLO = 'y'.repeat(9000);  // ~ esqueleto de um arquivo médio

async function _renderOrcamentoPreview() {
  const body = document.getElementById('limites-preview-body');
  if (!body) return;
  const r = await window.pywebview.api.preview_orcamento(_LIMITES_PROMPT_EXEMPLO, _LIMITES_ESQUELETO_EXEMPLO);
  if (!r.success) { body.textContent = ''; return; }
  const o = r.orcamento;
  body.innerHTML =
    `janela do modelo &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${o.janela.toLocaleString('pt-BR')}<br>` +
    `− prompt fixo (medido) &nbsp;&nbsp;−${o.prompt.toLocaleString('pt-BR')}<br>` +
    `− esqueleto (medido) &nbsp;&nbsp;&nbsp;&nbsp;−${o.esqueleto.toLocaleString('pt-BR')}<br>` +
    `− teto de saída &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;−${o.saida.toLocaleString('pt-BR')}<br>` +
    `− margem de segurança &nbsp;−${o.margem.toLocaleString('pt-BR')}<br>` +
    `<span class="limites-preview-total">= ${o.sobra_tokens.toLocaleString('pt-BR')} tokens ≈ ${o.sobra_chars.toLocaleString('pt-BR')} caracteres para o código</span>` +
    (o.exata ? '' : '<div class="limites-preview-aviso">tiktoken não encontrado — usando estimativa (±10%)</div>');
}


// ── A janela de contexto: quem escreve é o LM Studio ────────────────────────
// O campo era digitado à mão, e um número digitado errado não dá erro nenhum —
// só faz o programa achar que cabe mais (ou menos) do que cabe, e a conta de
// orçamento sair torta em silêncio. Agora ele é consultado: `get_context_window`
// pergunta ao LM Studio qual o modelo carregado e quanto ele tem de janela.
//
// O valor salvo em `limites.json` continua existindo e continua sendo o que o
// backend inteiro lê — ele passou a ser a RESERVA, para quando o LM Studio
// estiver fora do ar. É o mesmo arranjo que o Designer já usava.
async function _renderJanelaDeContexto(reserva) {
  const input = document.getElementById('input-janela-contexto');
  const nota = document.getElementById('janela-contexto-origem');
  if (!input) return;

  let r = null;
  try { r = await window.pywebview.api.get_context_window(); } catch (e) { r = null; }

  if (r && r.success && r.context_length) {
    input.value = r.context_length;
    if (nota) {
      nota.innerHTML = `Lido do LM Studio — modelo <code>${r.model || '?'}</code>. ` +
        `Troque de modelo lá e este número muda sozinho.`;
      nota.classList.remove('config-nota-alerta');
    }
    // Grava a reserva quando ela está diferente do que o LM Studio informou:
    // é o que faz o número certo sobreviver ao LM Studio sair do ar.
    if (parseInt(reserva, 10) !== r.context_length) {
      try { await window.pywebview.api.save_limites({ janela_contexto: r.context_length }); }
      catch (e) { /* a tela continua certa mesmo se a gravação falhar */ }
    }
    _renderContaDaEntrada();
    return;
  }

  input.value = reserva;
  if (nota) {
    nota.innerHTML = `LM Studio não respondeu — usando o último valor conhecido ` +
      `(<strong>${Number(reserva).toLocaleString('pt-BR')}</strong> tokens). ` +
      `Abra o LM Studio e recarregue esta aba para consultar de novo.`;
    nota.classList.add('config-nota-alerta');
  }
  _renderContaDaEntrada();
}

// Os tetos são % da janela (D27): ao lado de cada campo, quanto ele dá em
// tokens com a janela de agora — a mesma conta de `load_limites`, arredondada
// para baixo. E a conta de folga, com a margem entrando nela.
function _tetosEmTokens() {
  const valor = id => parseInt((document.getElementById(id) || {}).value, 10) || 0;
  const janela = valor('input-janela-contexto');
  return {
    janela,
    entrada: Math.floor(janela * valor('input-teto-entrada') / 100),
    saida: Math.floor(janela * valor('input-teto-saida') / 100),
    margem: Math.floor(janela * valor('input-margem-pct') / 100),
  };
}

function _renderContaDaEntrada() {
  const { janela, entrada, saida, margem } = _tetosEmTokens();
  const n = v => Number(v).toLocaleString('pt-BR');
  [['teto-entrada-tokens', entrada], ['teto-saida-tokens', saida], ['margem-tokens', margem]]
    .forEach(([id, tokens]) => {
      const alvo = document.getElementById(id);
      if (alvo) alvo.textContent = `= ${n(tokens)} tokens`;
    });
  // Os dois cartões de Rotinas da Automação dependem destes números.
  _renderTetoProporcional();
  _renderPartesECostura();

  const nota = document.getElementById('teto-entrada-conta');
  if (!nota) return;
  const sobra = janela - entrada - saida - margem;
  nota.innerHTML = sobra >= 0
    ? `${n(janela)} de janela − ${n(entrada)} de entrada − ${n(saida)} de saída − ` +
      `${n(margem)} de margem = <strong>${n(sobra)} tokens</strong> de folga.`
    : `<strong>Não cabe:</strong> ${n(entrada)} de entrada + ${n(saida)} de saída + ` +
      `${n(margem)} de margem passam ${n(-sobra)} tokens da janela de ${n(janela)}.`;
  nota.classList.toggle('config-nota-alerta', sobra < 0);
}

// ── Os dois campos que vieram do modal da engrenagem ────────────────────────
// Moram em `settings.json`, e NÃO em `limites.json`: `save_limites` faz
// `max(1, int(valor))`, que transforma a URL em erro e o booleano em 1. Por
// isso eles têm gravação própria, por `save_settings_parcial`.
async function _initLmStudioUrl() {
  const input = document.getElementById('input-lm-url');
  if (!input) return;
  input.placeholder = ENDERECO_PADRAO_DO_LM_STUDIO;
  input.value = appSettings.lm_studio_url || ENDERECO_PADRAO_DO_LM_STUDIO;
  if (input._wired) return;
  input._wired = true;
  input.addEventListener('change', async () => {
    const url = input.value.trim() || ENDERECO_PADRAO_DO_LM_STUDIO;
    input.value = url;
    await _salvarSettingsDaAba({ lm_studio_url: url });
    // Trocar o endereço muda de que servidor a janela vem.
    const r = await window.pywebview.api.load_limites();
    if (r.success) await _renderJanelaDeContexto(r.limites.janela_contexto);
  });
}

async function _initTempoMaximoDoSubagente() {
  const caixa = document.getElementById('input-subagente-timeout-enabled');
  const min = document.getElementById('input-subagente-timeout-min');
  if (!caixa || !min) return;
  caixa.checked = !!appSettings.subagente_timeout_enabled;
  min.value = appSettings.subagente_timeout_min || 5;
  [caixa, min].forEach(el => {
    if (el._wired) return;
    el._wired = true;
    el.addEventListener('change', () => _salvarSettingsDaAba({
      subagente_timeout_enabled: caixa.checked,
      subagente_timeout_min: Math.max(1, Math.min(parseInt(min.value, 10) || 5, 120)),
    }));
  });
}

// Grava um patch e atualiza o `appSettings` em memória JUNTO. As duas coisas,
// sempre — foi a segunda que faltou em `subagentes-config-tab.js` e fazia uma
// mudança ser revertida em silêncio pela tela seguinte que gravasse.
async function _salvarSettingsDaAba(patch) {
  const r = await window.pywebview.api.save_settings_parcial(patch);
  if (r && r.success) {
    appSettings = Object.assign({}, appSettings, patch);
    showToast('Configuração salva!');
  } else {
    showToast('Erro ao salvar.', true);
  }
}


// ── Os dois interruptores da política de saída ──────────────────────────────
// "Formato garantido" e "Resgate da resposta" — e só esses dois, por decisão
// registrada. Não existe um terceiro de "retentar": uma retentativa é uma
// chamada a mais ao modelo, e isso está descartado desde a primeira rodada da
// discussão que originou esta obra.
//
// Moram em `settings.json`, e NÃO em `limites.json`: `save_limites` faz
// `max(1, int(valor))`, que transformaria `false` em `1` — o interruptor
// desligado voltaria ligado sozinho no próximo carregamento.
const POLITICA_DE_SAIDA_CAMPOS = [
  ['input-formato-garantido', 'formato_garantido'],
  ['input-resgate-resposta',  'resgate_da_resposta'],
];

async function _initPoliticaDeSaida() {
  for (const [id, chave] of POLITICA_DE_SAIDA_CAMPOS) {
    const caixa = document.getElementById(id);
    if (!caixa) continue;
    // Ligados de fábrica: chave ausente conta como ligada, não como desligada.
    caixa.checked = appSettings[chave] !== false;
    if (caixa._wired) continue;
    caixa._wired = true;
    caixa.addEventListener('change', () => _salvarSettingsDaAba({ [chave]: caixa.checked }));
  }
}


// ── "Encerrar e excluir": as confirmações ──────────────────────────────
// O markup está em `config-confirmacoes-template.js`; o comportamento mora
// AQUI, junto dos outros campos de `settings.json`, e não num
// `config-confirmacoes.js` próprio: a mecânica é a mesma de
// `_initPoliticaDeSaida` logo acima.
//
// ⚠️ Diferente de tudo que está acima nesta seção, estes NÃO gravam no
// clique: eles esperam o "Salvar confirmações". É a razão de o terceiro ser uma
// caixa nativa e não um Interruptor — o Interruptor promete efeito imediato.
//
// ⚠️ Nunca em `limites.json`: `save_limites` faz `max(1, int(valor))`, que
// transformaria `false` em `1` e a string `'nunca'` em erro.

/** Pinta o segmento marcado de UM dos toggles de três valores. */
function _pintarQuandoPerguntar(grupoId, valor) {
  const grupo = document.getElementById(grupoId);
  if (!grupo) return;
  grupo.querySelectorAll('.mapa-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.quando === valor);
  });
}

/** O segmento marcado agora, com o padrão de fábrica de reserva. */
function _quandoPerguntarEscolhido(grupoId, padrao) {
  const ativo = document.querySelector(`#${grupoId} .mapa-toggle-btn.active`);
  return (ativo && ativo.dataset.quando) || padrao;
}

// Os toggles de três valores desta categoria, cada um com a chave que grava e o
// padrão de reserva. ⚠️ Uma lista só, e não blocos parecidos: eles nasceram
// iguais e a fiação de cada um tem quatro passos (pintar, delegar o clique, ler
// na hora de salvar, restaurar). Duplicá-la é o jeito clássico de consertar um
// e esquecer o outro — o terceiro entrou aqui como UMA linha, e foi só isso.
//
// ⚠️ O padrão vem numa FUNÇÃO, e não solto. Esta lista é avaliada quando o
// arquivo carrega, e as constantes moram noutro `<script>` (`constantes.js`):
// ler o valor aqui amarraria este arquivo à ordem das tags no `index.html`, que
// é a armadilha que o projeto já registrou uma vez. Dentro da função, a leitura
// acontece no clique.
const CONFIRMACOES_DE_SAIDA = [
  ['cfg-confirmar-ao-fechar',          'confirmar_ao_fechar',
   () => CONFIRMAR_AO_FECHAR_PADRAO],
  ['cfg-confirmar-ao-sair-do-projeto', 'confirmar_ao_sair_do_projeto',
   () => CONFIRMAR_AO_SAIR_DO_PROJETO_PADRAO],
  ['cfg-confirmar-ao-fechar-o-projeto', 'confirmar_ao_fechar_o_projeto',
   () => CONFIRMAR_AO_FECHAR_O_PROJETO_PADRAO],
];

async function _initEncerrarEExcluir() {
  const caixa = document.getElementById('cfg-confirmar-ao-deletar');
  const caixaArq = document.getElementById('cfg-confirmar-ao-fechar-arquivo-nao-salvo');
  if (!caixa || !document.getElementById('cfg-confirmar-ao-fechar')) return;

  CONFIRMACOES_DE_SAIDA.forEach(([grupoId, chave, padrao]) => {
    const grupo = document.getElementById(grupoId);
    if (!grupo) return;
    _pintarQuandoPerguntar(grupoId, appSettings[chave] || padrao());
    // Clique delegado UMA vez no container, e não botão a botão:
    // `initLimitesConfig` roda de novo a cada "Restaurar padrão", e um listener
    // por botão se acumularia a cada volta. Mesmo motivo do delegado das
    // Notificações.
    if (grupo._wired) return;
    grupo._wired = true;
    grupo.addEventListener('click', e => {
      const btn = e.target.closest('.mapa-toggle-btn');
      if (btn && !btn.disabled) _pintarQuandoPerguntar(grupoId, btn.dataset.quando);
    });
  });

  // Nasce ligada: chave ausente conta como ligada, como nos dois de cima.
  caixa.checked = appSettings.confirmar_ao_deletar !== false;
  if (caixaArq) {
    caixaArq.checked = appSettings.confirmar_ao_fechar_arquivo_nao_salvo !== false;
  }

  const salvar = document.getElementById('btn-save-confirmacoes');
  if (salvar && !salvar._wired) {
    salvar._wired = true;
    salvar.addEventListener('click', () => {
      const valores = { confirmar_ao_deletar: caixa.checked };
      if (caixaArq) valores.confirmar_ao_fechar_arquivo_nao_salvo = caixaArq.checked;
      CONFIRMACOES_DE_SAIDA.forEach(([grupoId, chave, padrao]) => {
        valores[chave] = _quandoPerguntarEscolhido(grupoId, padrao());
      });
      _salvarSettingsDaAba(valores);
    });
  }
}
