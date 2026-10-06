// ══════════════════════════════════════════ RESUMO: PAINEL DE EXTENSÕES ══
// Separado de `resumo.js` por causa do limite de linhas da arquitetura modular,
// e o corte caiu bem: é a única parte daquela tela que não tem nada a ver com a
// árvore nem com a faixa de números — é um painel à parte, que só lê o estado.
//
// Lê `_resumoEstado` (declarado em resumo.js, que carrega antes) e é chamado por
// `loadSummary()`.

// ── Painel de extensões ─────────────────────────────────────────────────────
// Dropdown informativo (ver Padrões de interface → Componentes): a lista é longa
// demais para a faixa, então fica atrás de um clique. Os números, porém, já vêm
// prontos da mesma varredura — somar num dict durante o walk não custa I/O
// nenhum, e uma segunda varredura só para isto custaria o disco inteiro de novo.
//
// A lista respeita a variante: no Resumo indexado ela conta só o que sobrou
// depois de Remover e Contexto sem leitura.
function _resumoPintarExtensoes(chave) {
  const painel = document.getElementById(`resumo-ext-panel-${chave}`);
  const exts = _resumoEstado[chave].extensoes;
  if (!painel) return;

  if (!exts.length) {
    painel.innerHTML = '<div class="resumo-ext-total">Nenhum arquivo.</div>';
    return;
  }

  const total = exts.reduce((soma, [, n]) => soma + n, 0);
  const linhas = exts.map(([ext, n]) => `
    <tr>
      <td class="resumo-ext-nome">${escapeHtml(ext)}</td>
      <td class="ctx-stat">${n.toLocaleString('pt-BR')}</td>
    </tr>`).join('');

  painel.innerHTML = `
    <div class="resumo-ext-total">
      <b>${exts.length}</b> tipos de extensão · <b>${total.toLocaleString('pt-BR')}</b> arquivos
    </div>
    <table class="ctx-inicial-table">
      <thead><tr><th>Extensão</th><th>Arquivos</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>`;
}

function _resumoLigarExtensoes(chave) {
  const btn = document.getElementById(`btn-resumo-ext-${chave}`);
  const painel = document.getElementById(`resumo-ext-panel-${chave}`);
  if (!btn || !painel || btn._resumoWired) return;
  btn._resumoWired = true;

  btn.addEventListener('click', (e) => {
    // Sem isto, o próprio clique que abre o painel chega no listener de
    // "clicou fora" e o fecha na mesma hora.
    e.stopPropagation();
    const abrindo = painel.classList.contains('hidden');
    if (abrindo) _resumoPintarExtensoes(chave);
    painel.classList.toggle('hidden', !abrindo);
  });

  document.addEventListener('click', (e) => {
    if (!painel.contains(e.target) && e.target !== btn) {
      painel.classList.add('hidden');
    }
  });
}
