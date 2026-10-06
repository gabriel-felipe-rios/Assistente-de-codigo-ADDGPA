// ════════════════════════ EDITOR: O CARTÃO DA BOLINHA ⓘ ══
// A segunda bolinha da linha de pasta, e o cartão que ela abre: quantos
// arquivos, quantas subpastas, o tamanho e a divisão por extensão com barra de
// proporção.
//
// A bolinha de contagem responde "quanta coisa tem aqui?" de relance; este
// cartão responde "que tipo de coisa?" — e é por isso que são duas e não uma.

let _edCartaoAberto = null;

function _edCartaoFechar() {
  if (_edCartaoAberto) _edCartaoAberto.remove();
  _edCartaoAberto = null;
}

// Fechar ao clicar fora. Registrado uma vez, no carregamento do script, e não a
// cada abertura: um ouvinte por cartão aberto seria um vazamento lento.
document.addEventListener('click', (e) => {
  if (!_edCartaoAberto) return;
  if (_edCartaoAberto.contains(e.target) || e.target.classList.contains('ed-info')) return;
  _edCartaoFechar();
});

function _edCartaoTamanho(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

// eslint-disable-next-line no-unused-vars
async function abrirCartaoDaPasta(caminho, bolinha, mostrarIgnorados) {
  _edCartaoFechar();
  const r = await window.pywebview.api.editor_cartao_da_pasta(
    currentProject, caminho, !!mostrarIgnorados);
  if (!r.success) { showToast(r.error || 'Não deu para ler essa pasta.', true); return; }

  const cartao = document.createElement('div');
  cartao.className = 'ed-cartao';

  // A maior extensão vira 100% da barra; as outras se medem contra ela. É
  // proporção RELATIVA e não percentual do total de propósito: com 40
  // extensões, o percentual real deixaria quase todas as barras invisíveis.
  const maior = r.extensoes.length ? r.extensoes[0][1] : 1;
  const linhas = r.extensoes.slice(0, 8).map(([ext, n, bytes]) => `
    <div class="ed-cartao-linha">
      <span class="ed-cartao-ext" title="${escapeHtml(ext)} — ${_edCartaoTamanho(bytes)}">${escapeHtml(ext)}</span>
      <span class="ed-cartao-barra"><i style="width:${Math.max(3, Math.round(n / maior * 100))}%"></i></span>
      <b>${n}</b>
    </div>`).join('');
  const resto = r.extensoes.length > 8
    ? `<div class="ed-cartao-linha"><span class="ed-cartao-ext">e mais</span>
       <span class="ed-cartao-barra"></span><b>${r.extensoes.length - 8}</b></div>` : '';

  cartao.innerHTML = `
    <div class="ed-cartao-titulo">${escapeHtml(r.nome)}</div>
    <div class="ed-cartao-caminho" title="${escapeHtml(r.caminho)}">${escapeHtml(r.caminho || '(raiz)')}</div>
    <div class="ed-cartao-linha"><span style="flex:1">Arquivos</span><b>${r.arquivos}</b></div>
    <div class="ed-cartao-linha"><span style="flex:1">Subpastas</span><b>${r.subpastas}</b></div>
    <div class="ed-cartao-linha"><span style="flex:1">Tamanho</span><b>${_edCartaoTamanho(r.bytes)}</b></div>
    ${r.extensoes.length ? '<div class="ed-cartao-sep"></div>' + linhas + resto : ''}
    ${r.parcial ? '<div class="ed-cartao-aviso">A varredura parou no tempo limite — os números são o que deu para contar.</div>' : ''}`;

  // Posicionado dentro do painel da árvore, que é `position: relative`: assim
  // o cartão rola junto com a árvore em vez de ficar boiando sobre ela.
  //
  // ⚠️ O CLAMP DA DIREITA NÃO É OPCIONAL. `.ed-arvore` é `overflow: auto` —
  // sem o `Math.min` abaixo, uma pasta perto da borda direita de um painel
  // estreito posicionava o cartão parcialmente fora da área visível, cortando
  // os números do lado direito (Arquivos/Subpastas/Tamanho) sem barra de
  // rolagem óbvia para revelar o resto. Medido e reproduzido em 31/08/2026.
  const LARGURA_CARTAO = 258;
  const painel = bolinha.closest('.ed-arvore');
  const r1 = bolinha.getBoundingClientRect();
  const r2 = painel.getBoundingClientRect();
  const esquerdaMaxima = Math.max(6, painel.clientWidth - LARGURA_CARTAO - 6);
  const esquerda = Math.min(esquerdaMaxima, Math.max(6, r1.left - r2.left - 200));
  cartao.style.left = `${esquerda}px`;
  cartao.style.top = `${r1.bottom - r2.top + painel.scrollTop + 6}px`;
  painel.appendChild(cartao);
  _edCartaoAberto = cartao;
}
