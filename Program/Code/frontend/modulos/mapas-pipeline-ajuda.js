// ══════════════════ VISUALIZAR PIPELINE — MODAL "COMO LER" ══
// O botão que faltava. A tela sempre teve seis leituras do mesmo arquivo e
// nenhum lugar dizendo o que cada uma mostra nem por que existem seis — só um
// `title` no botão, que ninguém para em cima para ler.
//
// São duas partes, e a segunda é a que resolve de verdade: os cartões dizem
// PARA QUE serve cada leitura, e o vocabulário desenhado diz o que são as
// peças que aparecem em todas elas. Sem ele, a tarja da esquerda, o tracejado
// laranja, o `×4` e o `+utils.js` são só enfeite para quem chega.
//
// O modal usa o esqueleto do projeto (`.modal-overlay` + `.modal-prompt`), e
// não o `.modal-prompt-content`: aquele é monoespaçado e `pre-wrap`, feito
// para mostrar um prompt, e aqui o conteúdo é uma grade de cartões.

const VP_LEITURAS_AJUDA = [
  { chave: 'raias', rotulo: 'Raias por camada',
    linha: 'Uma faixa horizontal por camada do programa. Cada arquivo aparece <b>uma vez só</b>, na faixa a que pertence, e anda para a direita conforme a profundidade dele no fluxo — quem dispara fica na esquerda. Toda curva laranja tracejada é uma <b>travessia</b> de camada; o selo <code>F3</code> no canto do nó é a fase em que ele entra.',
    quando: 'Use para responder “onde a tela encosta no backend?”' },
  { chave: 'trilho', rotulo: 'Trilho numerado',
    linha: 'A cadeia lida de cima para baixo, agrupada por fase. Cada parada é numerada pela faixa de passos que ela cobre (<code>15–18</code>), com origem, destino, as chamadas e a frase do que acontece.',
    quando: 'Use para conferir na ordem, sem perder nenhum passo.' },
  { chave: 'sequencia', rotulo: 'Sequência',
    linha: 'Cada arquivo vira uma coluna com linha de vida, e o tempo desce. É a única leitura em que a mesma coluna reaparece — é assim que se enxerga o <b>vaivém</b> entre dois arquivos.',
    quando: 'Use quando desconfiar de idas e voltas entre os mesmos dois arquivos.' },
  { chave: 'cadeias', rotulo: 'Cadeias',
    linha: 'As cadeias, uma por linha, como trilhos de estações. Mostra que elas são independentes: nenhuma seta sai de uma linha e entra na de baixo. Cadeia comprida mostra as primeiras estações e guarda o resto atrás de <code>+N arquivos</code>.',
    quando: 'Use para a visão de longe: quantos fluxos existem e onde cada um começa.' },
  { chave: 'fases', rotulo: 'Fases',
    linha: 'Um quadro com uma coluna por fase, com todas as cadeias juntas. A tarja colorida do cartão diz de qual cadeia o passo é — sem ela, a coluna “Fase 2” pareceria um fluxo só.',
    quando: 'Use para ver o que acontece ao mesmo tempo em cadeias diferentes.' },
  { chave: 'markdown', rotulo: 'Markdown',
    linha: 'O <code>pipeline.md</code> como está no disco, com numeração de linha. É a origem de tudo: as outras cinco leituras são desenhos deste mesmo arquivo.',
    quando: 'Use para conferir ou corrigir o texto de origem à mão.' },
];

// Miniaturas: a forma de cada leitura, não um ícone genérico. A ideia é a
// pessoa reconhecer o desenho antes de ler o nome.
const VP_MINIATURAS = {
  raias: `<svg width="56" height="42" aria-hidden="true"><rect x="0" y="2" width="56" height="11" rx="2" fill="rgba(var(--purple-rgb),.2)"/><rect x="0" y="16" width="56" height="11" rx="2" fill="rgba(var(--blue-rgb),.2)"/><rect x="0" y="30" width="56" height="11" rx="2" fill="rgba(var(--green-rgb),.2)"/><rect x="5" y="4" width="15" height="7" rx="2" fill="var(--sky-light)"/><rect x="24" y="18" width="15" height="7" rx="2" fill="var(--sky-light)"/><rect x="36" y="32" width="15" height="7" rx="2" fill="var(--sky-light)"/><path d="M20 7 C29 7 24 21 24 21" stroke="var(--amber)" fill="none" stroke-width="1.4" stroke-dasharray="3 2"/><path d="M39 21 C49 21 44 35 36 35" stroke="var(--amber)" fill="none" stroke-width="1.4" stroke-dasharray="3 2"/></svg>`,
  trilho: `<svg width="56" height="42" aria-hidden="true"><line x1="9" y1="4" x2="9" y2="38" stroke="var(--teal)" stroke-width="2" opacity=".5"/><circle cx="9" cy="9" r="4.5" fill="var(--teal)"/><circle cx="9" cy="21" r="4.5" fill="var(--teal)"/><circle cx="9" cy="33" r="4.5" fill="var(--teal)"/><rect x="19" y="6" width="30" height="6" rx="2" fill="var(--sky-light)"/><rect x="19" y="18" width="24" height="6" rx="2" fill="var(--sky-light)"/><rect x="19" y="30" width="32" height="6" rx="2" fill="var(--sky-light)"/></svg>`,
  sequencia: `<svg width="56" height="42" aria-hidden="true"><line x1="9" y1="2" x2="9" y2="40" stroke="rgba(var(--white-rgb),.25)" stroke-dasharray="3 3"/><line x1="28" y1="2" x2="28" y2="40" stroke="rgba(var(--white-rgb),.25)" stroke-dasharray="3 3"/><line x1="47" y1="2" x2="47" y2="40" stroke="rgba(var(--white-rgb),.25)" stroke-dasharray="3 3"/><path d="M9 12 H25" stroke="var(--blue)" stroke-width="2"/><path d="M25 9 l5 3 -5 3z" fill="var(--blue)"/><path d="M28 24 H44" stroke="var(--amber)" stroke-width="2" stroke-dasharray="4 2"/><path d="M44 21 l5 3 -5 3z" fill="var(--amber)"/><path d="M47 35 H11" stroke="var(--blue)" stroke-width="2"/><path d="M11 32 l-5 3 5 3z" fill="var(--blue)"/></svg>`,
  cadeias: `<svg width="56" height="42" aria-hidden="true"><g><circle cx="7" cy="10" r="5" fill="none" stroke="var(--teal)" stroke-width="1.8" stroke-dasharray="3 2"/><line x1="13" y1="10" x2="21" y2="10" stroke="var(--teal)" stroke-width="1.8"/><circle cx="27" cy="10" r="5" fill="var(--teal)"/><line x1="33" y1="10" x2="41" y2="10" stroke="var(--teal)" stroke-width="1.8"/><circle cx="47" cy="10" r="5" fill="var(--teal)"/></g><g opacity=".75"><circle cx="7" cy="24" r="5" fill="none" stroke="var(--blue)" stroke-width="1.8" stroke-dasharray="3 2"/><line x1="13" y1="24" x2="21" y2="24" stroke="var(--blue)" stroke-width="1.8"/><circle cx="27" cy="24" r="5" fill="var(--blue)"/></g><g opacity=".55"><circle cx="7" cy="37" r="5" fill="none" stroke="var(--purple)" stroke-width="1.8" stroke-dasharray="3 2"/><line x1="13" y1="37" x2="21" y2="37" stroke="var(--purple)" stroke-width="1.8"/><circle cx="27" cy="37" r="5" fill="var(--purple)"/><line x1="33" y1="37" x2="41" y2="37" stroke="var(--purple)" stroke-width="1.8"/><circle cx="47" cy="37" r="5" fill="var(--purple)"/></g></svg>`,
  fases: `<svg width="56" height="42" aria-hidden="true"><rect x="1" y="2" width="16" height="38" rx="3" fill="rgba(var(--black-rgb),.28)"/><rect x="20" y="2" width="16" height="38" rx="3" fill="rgba(var(--black-rgb),.28)"/><rect x="39" y="2" width="16" height="38" rx="3" fill="rgba(var(--black-rgb),.28)"/><rect x="3" y="6" width="12" height="9" rx="2" fill="var(--teal)"/><rect x="3" y="18" width="12" height="9" rx="2" fill="var(--blue)"/><rect x="3" y="30" width="12" height="9" rx="2" fill="var(--rosa)"/><rect x="22" y="6" width="12" height="9" rx="2" fill="var(--purple)"/><rect x="22" y="18" width="12" height="9" rx="2" fill="var(--teal)"/><rect x="41" y="6" width="12" height="9" rx="2" fill="var(--amber)"/></svg>`,
  markdown: `<svg width="56" height="42" aria-hidden="true"><rect x="2" y="3" width="52" height="36" rx="4" fill="none" stroke="rgba(var(--white-rgb),.2)"/><rect x="8" y="9" width="18" height="4" rx="2" fill="var(--blue)"/><rect x="8" y="18" width="38" height="3" rx="1.5" fill="rgba(var(--white-rgb),.3)"/><rect x="8" y="25" width="30" height="3" rx="1.5" fill="rgba(var(--white-rgb),.3)"/><rect x="8" y="32" width="34" height="3" rx="1.5" fill="rgba(var(--white-rgb),.3)"/></svg>`,
};

// O vocabulário. Cada linha mostra a peça DESENHADA do lado do que ela quer
// dizer — explicar "tarja roxa é HTML/CSS" com texto puro obrigaria a pessoa a
// achar a tarja na tela para conferir.
const VP_VOCABULARIO = [
  [`<svg width="56" height="22"><rect x="0" y="4" width="24" height="14" rx="4" fill="var(--surface-dark)" stroke="rgba(var(--green-rgb),.7)"/><rect x="0" y="4" width="4" height="14" rx="2" fill="var(--green)"/><rect x="32" y="4" width="24" height="14" rx="4" fill="var(--surface-dark)" stroke="rgba(var(--blue-rgb),.7)"/><rect x="32" y="4" width="4" height="14" rx="2" fill="var(--blue)"/></svg>`,
   '<b>A tarja do arquivo</b> diz a camada: roxo = HTML/CSS, azul = Frontend JS, verde = Backend Python, cinza = outros.'],
  [`<svg width="56" height="22"><path d="M2 11 H44" stroke="rgba(var(--white-rgb),.4)" stroke-width="2"/><path d="M44 6 l8 5 -8 5z" fill="rgba(var(--white-rgb),.4)"/></svg>`,
   '<b>Linha cheia</b>: o fluxo continua dentro da mesma camada.'],
  [`<svg width="56" height="22"><path d="M2 11 H44" stroke="var(--amber)" stroke-width="2" stroke-dasharray="7 4"/><path d="M44 6 l8 5 -8 5z" fill="var(--amber)"/></svg>`,
   '<b>Laranja tracejado</b>: <b>travessia</b> de camada — é onde a interface fala com o backend, ou o contrário.'],
  [`<svg width="56" height="22"><rect x="15" y="3" width="26" height="17" rx="8" fill="var(--teal)"/><text x="28" y="15" font-size="10" font-weight="700" text-anchor="middle" fill="var(--amber-text)" font-family="Segoe UI">×4</text></svg>`,
   '<b>×N</b>: quantas chamadas usam essa mesma <b>ligação</b>. Desligue “Agrupar repetidos” para ver uma a uma.'],
  [`<svg width="56" height="22"><rect x="3" y="4" width="50" height="15" rx="4" fill="rgba(var(--amber-rgb),.12)"/><text x="28" y="15" font-size="9" text-anchor="middle" fill="var(--yellow-soft)" font-family="Consolas">run_script</text></svg>`,
   '<b>Etiqueta amarela</b>: o “por onde” — o evento, a função ou a chamada que liga um arquivo ao outro.'],
  [`<svg width="56" height="22"><rect x="2" y="4" width="52" height="15" rx="7" fill="rgba(var(--white-rgb),.05)" stroke="rgba(var(--white-rgb),.18)" stroke-dasharray="3 2"/><text x="28" y="15" font-size="9" text-anchor="middle" fill="var(--text-muted)" font-family="Consolas">+utils.js</text></svg>`,
   '<b>Selo <code>+arquivo</code></b>: arquivo que o passo também usa, mas que não é o próximo passo. Quando aparece em <b>todos</b> os passos da cadeia, sobe para o cabeçalho como “selo comum”.'],
  [`<svg width="56" height="22"><circle cx="11" cy="11" r="9" fill="none" stroke="var(--teal)" stroke-width="2" stroke-dasharray="3 2"/><text x="11" y="15" font-size="9" text-anchor="middle" fill="var(--teal)" font-family="Segoe UI">▶</text><circle cx="38" cy="11" r="9" fill="var(--teal)"/><text x="38" y="15" font-size="9" font-weight="700" text-anchor="middle" fill="var(--amber-text)" font-family="Segoe UI">3</text></svg>`,
   '<b>Círculo tracejado ▶</b>: onde a cadeia começa. <b>Círculo cheio</b>: a ordem da parada.'],
  [`<svg width="56" height="22"><rect x="0" y="4" width="16" height="15" rx="3" fill="rgba(var(--white-rgb),.09)"/><text x="8" y="15" font-size="8" text-anchor="middle" fill="var(--text)" font-family="Segoe UI">F1</text><rect x="19" y="4" width="16" height="15" rx="3" fill="rgba(var(--white-rgb),.09)"/><text x="27" y="15" font-size="8" text-anchor="middle" fill="var(--text)" font-family="Segoe UI">F2</text><rect x="38" y="4" width="16" height="15" rx="3" fill="rgba(var(--white-rgb),.09)"/><text x="46" y="15" font-size="8" text-anchor="middle" fill="var(--text)" font-family="Segoe UI">F3</text></svg>`,
   '<b>Fase</b>: a profundidade do fluxo. A fase 1 é o que dispara; a última é o que fecha e devolve para a tela.'],
];

// Montado uma vez só, na abertura: o conteúdo é fixo e remontar a cada clique
// seria trabalho à toa.
let _vpAjudaMontada = false;

function vpMontarAjuda() {
  if (_vpAjudaMontada) return;
  _vpAjudaMontada = true;
  const corpo = document.getElementById('vp-ajuda-corpo');
  if (!corpo) return;
  corpo.innerHTML = `
    <div class="vp-ajuda-grade">${VP_LEITURAS_AJUDA.map(leitura => `
      <div class="vp-ajuda-cartao">
        <div class="vp-ajuda-mini">${VP_MINIATURAS[leitura.chave]}</div>
        <div class="vp-ajuda-texto">
          <h4>${leitura.rotulo}</h4>
          <div class="vp-ajuda-linha">${leitura.linha}</div>
          <div class="vp-ajuda-quando">${leitura.quando}</div>
        </div>
      </div>`).join('')}
    </div>
    <div class="vp-voc">
      <h4>O vocabulário que vale nas seis leituras</h4>
      <div class="vp-voc-grade">${VP_VOCABULARIO.map(([amostra, texto]) => `
        <div class="vp-voc-linha"><span class="vp-voc-amostra">${amostra}</span><span>${texto}</span></div>`).join('')}
      </div>
    </div>`;
}

function vpAbrirAjuda() {
  vpMontarAjuda();
  document.getElementById('modal-vp-ajuda').classList.remove('hidden');
}

function vpFecharAjuda() {
  document.getElementById('modal-vp-ajuda').classList.add('hidden');
}
