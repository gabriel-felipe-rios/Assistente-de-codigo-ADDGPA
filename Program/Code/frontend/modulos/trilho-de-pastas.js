// ═══════════════════════════════════════════════ Trilho de pastas ══
// Variante do Trilho de categorias (Padrões de interface/Componentes/Trilho
// de categorias.md) com aninhamento: em vez de uma lista achatada de
// categorias, mostra uma árvore de pastas/subpastas — "Todos" e "Nenhuma
// subpasta" fixos no topo, depois cada pasta com as subpastas dela
// indentadas logo abaixo, SEMPRE expandidas (nunca um acordeão: com poucos
// níveis, esconder a subpasta só custa um clique a mais pra achar o que já
// se sabe que existe).
//
// Consumido por Launchers (atalhos-externos-navegacao.js) e Plugins
// (plugins-navegacao.js): as duas telas navegam por pasta do mesmo jeito —
// só o que aparece no conteúdo ao lado é diferente (grade de atalho, pílula
// de plugin). A árvore de entrada é genérica: qualquer nó
// `{ nome, caminho, pastas, <chaveItens> }` — Launchers usa `itens`, Plugins
// usa `plugins`; quem chama passa o nome do campo em `chaveItens`.
//
// Uma SELEÇÃO é um destes três formatos:
//   'todos'                — tudo, de qualquer pasta, a raiz inteira
//   'nenhuma'               — só os itens soltos na raiz (sem pasta nenhuma)
//   { caminho: 'Jogos' }    — uma pasta específica, com tudo que tem dentro
//                             dela (recursivo) — clicar numa pasta-mãe soma
//                             com toda subpasta dela; clicar numa subpasta
//                             mostra só o que está direto ali.

function trilhoPastasSelecaoIgual(a, b) {
  if (a === 'todos' || a === 'nenhuma' || !a) return a === b;
  if (!b || b === 'todos' || b === 'nenhuma') return false;
  return a.caminho === b.caminho;
}

/** Lê a seleção representada pelo elemento clicado (o próprio `.trilho-
 * pastas-item` ou um descendente dele) — `null` se o clique não foi em
 * nenhum item do trilho. */
function trilhoPastasSelecaoDoClique(alvoDoEvento, container) {
  const el = alvoDoEvento && alvoDoEvento.closest
    ? alvoDoEvento.closest('.trilho-pastas-item')
    : null;
  if (!el || (container && !container.contains(el))) return null;
  if (el.dataset.trilhoEspecial) return el.dataset.trilhoEspecial;
  if (el.dataset.trilhoPasta !== undefined) return { caminho: el.dataset.trilhoPasta };
  return null;
}

/** Acha o nó da árvore cujo `caminho` bate — `null` se não existir (pasta
 * apagada por fora enquanto a seleção antiga ainda estava de pé). */
function _trilhoPastasAcharNo(no, caminho) {
  if (no.caminho === caminho) return no;
  for (const pasta of (no.pastas || [])) {
    const achado = _trilhoPastasAcharNo(pasta, caminho);
    if (achado) return achado;
  }
  return null;
}

function _trilhoPastasAchatarTudo(no, chaveItens) {
  const proprios = no[chaveItens] || [];
  const dasFilhas = (no.pastas || []).flatMap(p => _trilhoPastasAchatarTudo(p, chaveItens));
  return [...proprios, ...dasFilhas];
}

/** Os itens visíveis para a seleção atual — pura, não toca o DOM. */
function trilhoPastasItensVisiveis(no, chaveItens, selecao) {
  if (selecao === 'todos') return _trilhoPastasAchatarTudo(no, chaveItens);
  if (selecao === 'nenhuma') return no[chaveItens] || [];
  const alvo = selecao ? _trilhoPastasAcharNo(no, selecao.caminho) : null;
  return alvo ? _trilhoPastasAchatarTudo(alvo, chaveItens) : [];
}

function _trilhoPastasNoHtml(no, nivel) {
  const subHtml = (no.pastas || []).map(p => _trilhoPastasNoHtml(p, nivel + 1)).join('');
  return `
    <button class="trilho-pastas-item" style="--nivel:${nivel}"
            data-trilho-pasta="${escapeHtml(no.caminho)}" title="${escapeHtml(no.nome)}">
      ${nivel > 0 ? '<span class="trilho-pastas-galho">└</span> ' : ''}${escapeHtml(no.nome)}
    </button>${subHtml}`;
}

/** Monta o HTML do trilho inteiro, pronto pra ir dentro de um
 * `.trilho-pastas`. `no` é a RAIZ da árvore (o próprio nó devolvido pelo
 * backend, com `pastas` de primeiro nível). */
function trilhoPastasHtml(no) {
  const pastasHtml = (no.pastas || []).map(p => _trilhoPastasNoHtml(p, 0)).join('');
  return `
    <button class="trilho-pastas-item" data-trilho-especial="todos">Todos</button>
    <button class="trilho-pastas-item" data-trilho-especial="nenhuma">Nenhuma subpasta</button>
    ${pastasHtml ? '<div class="trilho-pastas-separador"></div>' + pastasHtml : ''}`;
}

/** Marca `.ativa` no item que representa `selecao`, tira dos outros — nunca
 * redesenha o trilho (o trilho só muda de verdade quando a árvore muda). */
function trilhoPastasMarcarAtiva(container, selecao) {
  container.querySelectorAll('.trilho-pastas-item').forEach(el => {
    const dessaLinha = el.dataset.trilhoEspecial || { caminho: el.dataset.trilhoPasta };
    el.classList.toggle('ativa', trilhoPastasSelecaoIgual(dessaLinha, selecao));
  });
}
