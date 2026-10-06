// ══════════════════════════ EDITOR: AS MÉTRICAS CONFIGURÁVEIS ══
// O ÚNICO arquivo que escreve `--ed-fonte`, `--ed-entrelinha` e `--ed-tab`.
//
// ⚠️ ESCREVE EM `:root`, E NUNCA EM CADA CAMADA. A superfície de edição são três
// elementos (o textarea, o <pre> pintado e a régua) cuja métrica não pode
// divergir — o motivo está em `estilos/editor-superficie.css`, e é medido: um
// pixel de diferença tira o texto lido de baixo do cursor e o erro cresce
// arquivo abaixo. Um `el.style.fontSize = …` por camada seriam três atribuições
// e três lugares para esquecer uma. Com a variável no `:root`, as camadas não
// têm valor próprio: têm a mesma referência, e divergir vira impossível.
//
// `:root` e não `.ed-pilha` também porque a superfície do painel de Histórico
// local é uma quarta instância — no `:root` ela recebe a métrica de graça.
//
// ⚠️ TABULAÇÃO NÃO É SÓ CSS. O `tab-size` desenha o `\t` que já está no arquivo;
// a TECLA Tab insere espaços, e `desindentar()` os remove com uma expressão
// regular. Se só o CSS mudasse, o usuário poria tabulação 2, veria o `\t` com
// duas colunas e continuaria digitando quatro espaços. Os três saem do mesmo
// número, e é `indentacaoDoEditor()` que o entrega.

// Os limites existem porque um `0` num `settings.json` corrompido deixaria o
// editor irrecuperável sem editar JSON à mão.
const _EDM_LIMITES = {
  editor_fonte_px:    { min: 9,   max: 24,  padrao: 12.5 },
  editor_entrelinha:  { min: 1.2, max: 2.2, padrao: 1.65 },
  editor_tabulacao:   { min: 1,   max: 8,   padrao: 4 },
};

function _edmValor(chave) {
  const lim = _EDM_LIMITES[chave];
  const bruto = (typeof appSettings !== 'undefined') ? appSettings[chave] : undefined;
  const n = Number(bruto);
  if (!Number.isFinite(n)) return lim.padrao;
  return Math.min(lim.max, Math.max(lim.min, n));
}

// A string que a tecla Tab insere, e o tamanho dela. Consumida por
// `editor-superficie.js` — que NÃO guarda cópia própria, de propósito.
// eslint-disable-next-line no-unused-vars
function indentacaoDoEditor() {
  const n = Math.round(_edmValor('editor_tabulacao'));
  return { largura: n, texto: ' '.repeat(n) };
}

// eslint-disable-next-line no-unused-vars
function aplicarMetricasDoEditor(superficies) {
  const raiz = document.documentElement.style;
  raiz.setProperty('--ed-fonte', `${_edmValor('editor_fonte_px')}px`);
  raiz.setProperty('--ed-entrelinha', String(_edmValor('editor_entrelinha')));
  raiz.setProperty('--ed-tab', String(Math.round(_edmValor('editor_tabulacao'))));
  // ⚠️ As duas juntas, sempre. `pre-wrap` sem `overflow-wrap: anywhere` faz o
  // textarea e o <pre> quebrarem palavra longa por regras DIFERENTES — um
  // `.min.js` de uma linha só desalinha tudo. Ver editor-superficie.css.
  const quebra = appSettings.editor_quebrar_linha === true;
  raiz.setProperty('--ed-quebra', quebra ? 'pre-wrap' : 'pre');
  raiz.setProperty('--ed-quebra-palavra', quebra ? 'anywhere' : 'normal');

  // ⚠️ O `ResizeObserver` de editor-superficie.js observa `.ed-pilha`, que NÃO
  // muda de tamanho quando só a fonte muda — ele não dispara sozinho aqui. A
  // régua precisa ser repintada (a largura dela depende do corpo da fonte) e a
  // margem recalculada (`caixaPre.left` e o `padding-left` do textarea saem
  // dessa largura). Sem esta chamada explícita, mudar a fonte desalinha na hora.
  (superficies || []).forEach((s) => { if (s) s.pintarRegua(); });
}
