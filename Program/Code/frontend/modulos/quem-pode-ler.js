// ═══════════════════════════════ MARCADOR "QUEM PODE LER" — componente ══
// O seletor que abre uma exceção num item de "Remover" ou de "Contexto sem
// leitura": o item continua fora do alcance de todo mundo, MENOS de quem for
// escolhido aqui.
//
// ⚠️ Mora num arquivo só porque tem DOIS donos — a sub-aba Remover
// (`remover.js`) e a sub-aba Contexto sem leitura (`contexto.js`). É a regra
// registrada em `Padrões de interface/Componentes/Interruptor.md`: componente
// com dois donos vira compartilhado, senão as duas cópias divergem em medida e
// em texto sem ninguém perceber.
//
// ⚠️ CUIDADO COM A DUPLA NEGATIVA — é o erro fácil desta tela. A sub-aba se
// chama "Contexto sem leitura" e o campo diz quem **pode** ler; lidos juntos e
// no lugar errado, os dois sentidos se cancelam. O rótulo resolve isso dizendo
// o que o campo é de verdade: uma EXCEÇÃO à remoção, não uma segunda proibição.
// "Mesmo assim, pode ler:" só tem uma leitura possível nas duas sub-abas.
//
// ⚠️ Vocabulário fechado: 🖥️ LM Studio (o modelo local, dentro do programa) e
// 🤖 assistente externo (o de fora — Claude Code, Cursor, Antigravity…).
// **Nunca escrever "Claude Code" na tela** — amarra o programa a um produto.
// Ver `Terminologia e nomenclatura/Vocabulário.md`, entrada "Assistente externo".

// Os valores espelham `QUEM_PODE_LER_VALORES`, em `backend/modulos/ignorados.py`.
// O padrão é `ninguem`, e é ele que reproduz o comportamento de antes de o
// campo existir — item já gravado, sem a chave, cai aqui.
const QUEM_PODE_LER_OPCOES = [
  { valor: 'ninguem',  rotulo: 'Ninguém (padrão)' },
  { valor: 'lmstudio', rotulo: '🖥️ Só o LM Studio' },
  { valor: 'externo',  rotulo: '🤖 Só o assistente externo' },
  { valor: 'ambos',    rotulo: 'Os dois' },
];

const QUEM_PODE_LER_AJUDA = {
  ninguem:  'Nem o chat interno nem o assistente externo enxergam este item.',
  lmstudio: 'O chat interno lê; o assistente externo continua sem enxergar.',
  externo:  'O assistente externo lê; o chat interno continua sem enxergar.',
  ambos:    'Os dois leem. O item sai da lista na prática — só o próprio programa continua sem contá-lo.',
};

// Valor efetivo de um item, tolerando ausência e lixo — mesma regra do
// `pode_ler` do backend. Nada migra o `Workspace.json`: a ausência É o padrão.
function quemPodeLerValor(item) {
  const v = (item && item.quem_pode_ler) || 'ninguem';
  return QUEM_PODE_LER_OPCOES.some(o => o.valor === v) ? v : 'ninguem';
}

// Monta o campo. `aoMudar(novoValor)` é chamado quando o usuário escolhe —
// quem chama é que grava e re-renderiza, porque as duas sub-abas gravam
// listas diferentes.
function montarQuemPodeLer(item, aoMudar) {
  const atual = quemPodeLerValor(item);
  const wrap = document.createElement('label');
  wrap.className = 'quem-pode-ler' + (atual === 'ninguem' ? '' : ' quem-pode-ler--excecao');
  wrap.title = QUEM_PODE_LER_AJUDA[atual];
  const opcoes = QUEM_PODE_LER_OPCOES.map(o =>
    `<option value="${o.valor}"${o.valor === atual ? ' selected' : ''}>${o.rotulo}</option>`).join('');
  wrap.innerHTML = `
    <span class="quem-pode-ler-rotulo">Mesmo assim, pode ler:</span>
    <select class="quem-pode-ler-select">${opcoes}</select>`;
  const select = wrap.querySelector('.quem-pode-ler-select');
  // `stopPropagation` nos dois: a linha inteira é clicável nas duas sub-abas
  // (seleciona o item no Contexto, alterna o escopo no Remover), e sem isto
  // abrir o seletor dispararia a ação da linha junto.
  wrap.addEventListener('click', e => e.stopPropagation());
  select.addEventListener('change', e => {
    e.stopPropagation();
    aoMudar(select.value);
  });
  return wrap;
}
