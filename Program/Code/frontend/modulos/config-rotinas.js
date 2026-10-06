// ═══════════════ Configurações — Rotinas da Automação: os exemplos ══
// A pergunta deste arquivo: «o que estes números dão, na prática?». Cada
// função reescreve a nota de exemplo de um cartão de Rotinas da Automação a
// partir dos campos da tela, com a MESMA conta do backend.
//
// O markup mora em `config-rotinas-template.js`. Quem carrega e grava os
// campos continua sendo `limites.js` (`initLimitesConfig`, `saveLimites`):
// um `Salvar` por categoria, um patch só, junto de "Modelo e contexto" e
// "Tempos e ciclos". As funções daqui são chamadas de lá.
//
// Saiu de `limites.js` em 2026-09: com o cartão do Glossário (D29) e a
// estimativa do Resumo de Pastas (D36) ele passaria das 500 linhas da AMF.
// Aquele arquivo carrega e grava; este mostra a conta.

// "Tamanho das respostas" (D19): o teto de uma chamada é o menor entre o teto de
// saída e `base + fator × tamanho do arquivo` — a mesma conta de
// `llm_estruturado.py::teto_de_saida_da_chamada`. Três arquivos de exemplo.
const _TETO_PROPORCIONAL_EXEMPLOS = [
  ['arquivo de 82 linhas', 1000],
  ['cobertura.py, 187 linhas', 2000],
  ['arquivo de 2 700 linhas', 34000],
];

function _renderTetoProporcional() {
  const alvo = document.getElementById('teto-proporcional-exemplo');
  if (!alvo) return;
  const base = parseInt((document.getElementById('input-teto-proporcional-base') || {}).value, 10) || 0;
  const fator = parseFloat((document.getElementById('input-teto-proporcional-fator') || {}).value) || 0;
  const { saida } = _tetosEmTokens();
  const n = v => Number(v).toLocaleString('pt-BR');
  const linhas = _TETO_PROPORCIONAL_EXEMPLOS.map(([nome, tokens]) => {
    const proporcional = Math.floor(base + fator * tokens);
    const teto = Math.max(1, Math.min(saida, proporcional));
    return `<strong>${nome}</strong> (~${n(tokens)} tokens): teto desta chamada ` +
      `<strong>${n(teto)}</strong>${proporcional >= saida ? ' · bateu no teto de saída' : ''}`;
  });
  linhas.push(`= o menor entre o teto de saída (${n(saida)}) e base + fator × tamanho do arquivo`);
  alvo.innerHTML = linhas.join('<br>');
}

// "Partes e costura" (D21, D28): cada cartão tem o próprio «% da janela», e
// a nota ao lado diz quanto ele dá em tokens com a janela de agora — a
// mesma conta de `load_limites`, arredondada para baixo. É também o
// tamanho de cada parte. O paralelo NÃO divide a janela em fatias iguais:
// o `PortaoDeContexto` reparte pelo tamanho de cada chamada.
function _renderPartesECostura() {
  const { janela } = _tetosEmTokens();
  const n = v => Number(v).toLocaleString('pt-BR');
  [['input-doc-tecnica-teto-entrada', 'doc-tecnica-entrada-tokens'],
   ['input-resumo-pastas-teto-entrada', 'resumo-pastas-entrada-tokens']].forEach(([campo, nota]) => {
    const alvo = document.getElementById(nota);
    if (!alvo) return;
    const pct = parseInt((document.getElementById(campo) || {}).value, 10) || 0;
    alvo.textContent = `${n(Math.floor(janela * pct / 100))} tokens`;
  });
}

// "Partes e costura" › a resposta estimada do Resumo de Pastas (D30, D36). A
// mesma conta de `resumo_pastas_estado.py::_rp_resposta_por_arquivo` e
// `_rp_arquivos_por_parte`. O exemplo é a maior pasta deste projeto em
// 2026-09: `frontend/modulos`, 206 arquivos.
const _ESTIMATIVA_DO_RESUMO_ARQUIVOS = 206;

function _renderEstimativaDoResumo() {
  const alvo = document.getElementById('partes-estimativa');
  if (!alvo) return;
  const valor = id => parseInt((document.getElementById(id) || {}).value, 10) || 0;
  const porArquivo = Math.max(1, Math.ceil(valor('input-resumo-pastas-tokens-por-arquivo')
    * (100 + valor('input-resumo-pastas-margem-estimativa')) / 100));
  const { saida } = _tetosEmTokens();
  const n = v => Number(v).toLocaleString('pt-BR');
  const arquivos = _ESTIMATIVA_DO_RESUMO_ARQUIVOS;
  const estimada = arquivos * porArquivo;
  const maximo = Math.max(1, valor('input-resumo-pastas-max-arquivos-por-parte') || arquivos);
  const cabemPorParte = Math.max(1, Math.min(Math.floor(saida / porArquivo), maximo));
  const partes = (estimada <= saida && arquivos <= maximo) ? 1 : Math.ceil(arquivos / cabemPorParte);
  alvo.innerHTML = 'Se a resposta estimada passar do teto de saída, ou a pasta tiver mais arquivos ' +
    'que o máximo por parte, ela já vira partes na primeira tentativa. ' +
    `Pasta de ${arquivos} arquivos: ~${n(Math.round(estimada / 100) * 100)} ` +
    `tokens estimados · teto ${n(saida)} → ${partes > 1 ? `${partes} partes` : 'uma chamada só'}.`;
}

// "Quem entra no Glossário" (D29): a mesma conta de
// `glossario_indice.py::_gl_minimo_de_arquivos`. Com um projeto exibido, o
// exemplo usa os arquivos documentados dele; sem, um projeto de 795 (este,
// em 2026-09). O número do projeto fica no `data-arquivos` da nota.
const _GLOSSARIO_EXEMPLO_ARQUIVOS = 795;

async function _carregarArquivosDocumentados() {
  const alvo = document.getElementById('glossario-minimo-exemplo');
  if (!alvo) return;
  alvo.dataset.arquivos = '';
  if (typeof currentProject === 'undefined' || !currentProject) return;
  try {
    const r = await window.pywebview.api.contar_arquivos_documentados(currentProject);
    if (r && r.success && r.arquivos) alvo.dataset.arquivos = String(r.arquivos);
  } catch (e) { /* o exemplo cai no projeto de 795 arquivos */ }
}

/** O modo marcado agora: `proporcional` ou `fixo`. */
function _modoDoMinimoDoGlossario() {
  const marcado = document.querySelector('input[name="glossario-minimo-modo"]:checked');
  return marcado ? marcado.value : 'proporcional';
}

/** Mostra só os campos do modo marcado e reescreve o exemplo do mínimo. */
function _renderMinimoDoGlossario() {
  const fixo = _modoDoMinimoDoGlossario() === 'fixo';
  const linhaProporcional = document.getElementById('glossario-linha-proporcional');
  const linhaFixo = document.getElementById('glossario-linha-fixo');
  if (linhaProporcional) linhaProporcional.style.display = fixo ? 'none' : '';
  if (linhaFixo) linhaFixo.style.display = fixo ? '' : 'none';
  const alvo = document.getElementById('glossario-minimo-exemplo');
  if (!alvo) return;
  const doProjeto = parseInt(alvo.dataset.arquivos, 10) || 0;
  const arquivos = doProjeto || _GLOSSARIO_EXEMPLO_ARQUIVOS;
  const valor = id => parseFloat((document.getElementById(id) || {}).value) || 0;
  const minimo = fixo
    ? valor('input-glossario-minimo-fixo')
    : Math.max(valor('input-glossario-minimo-piso'),
               Math.ceil(arquivos * valor('input-glossario-minimo-pct') / 100));
  alvo.innerHTML = `${doProjeto ? 'Neste projeto' : 'Exemplo'}: ` +
    `<strong>${arquivos} arquivos documentados</strong> → um termo precisa aparecer em ` +
    `<strong>${minimo} arquivos</strong> diferentes.`;
}
