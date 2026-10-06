// ═════════ EXTENSÕES DO PROGRAMA — OS SUBAGENTES DELA, NA PÁGINA DA EXTENSÃO ══
// Pergunta que este arquivo responde: "que subagentes esta extensão traz, o
// que cada um lê, com que ferramentas — e com que limites?". Duas partes da
// página (ver o topo de `extensoes/tela.js`), só para quem tem item
// `{"recurso": "agente", "forma": "subagente"}` no manifesto (fase 07):
//
//   · **Subagentes e o que cada um lê** — do manifesto: o `le` (ou as
//     `fontes`), as `ferramentas` e o id pelo qual o Chat e a Fila chamam;
//   · **Limites** — SÓ LEITURA (D53): os cinco limites gerais de
//     Configurações › Programa › Ferramentas dos subagentes, com o valor de
//     agora (`catalogo.limites_dos_subagentes`). A extensão não tem limite
//     próprio: «toda vez que eu acrescentar um subagente, eu já tenho certeza
//     que ele já tá tudo certo».
//
// ⚠️ Nada aqui liga ou desliga: cada subagente liga nas sub-abas Subagentes
// do Chat e da Fila, e a extensão só em Programa › Extensões.

function _xtSubagentesDaFolha(f) {
  return ((f && f.acrescenta) || []).filter(i => i.recurso === 'agente' && i.forma === 'subagente');
}

function _xtRotuloDaFonte(id) {
  return (typeof AGENTES_FONTES !== 'undefined' && AGENTES_FONTES[id]) ? AGENTES_FONTES[id].rotulo : id;
}

/** Subagentes e o que cada um lê — `''` para quem não traz subagente. */
function _xtSubagentesHtml(tela) {
  const subs = _xtSubagentesDaFolha(tela.folha);
  if (!subs.length) return '';
  const codigo = (s) => `<code>${escapeHtml(String(s))}</code>`;
  const itens = subs.map((s) => {
    const le = s.le
      ? `lê ${codigo(s.le)}`
      : `lê: ${escapeHtml((s.fontes || []).map(_xtRotuloDaFonte).join(' · ') || 'nada')}`;
    const ferramentas = (s.ferramentas || []).map(codigo).join(' · ') || '—';
    return `
        <div class="xt-sub-item">
          <b>${escapeHtml((s.icone ? s.icone + ' ' : '') + s.nome)}</b>
          <span>${le}</span>
          <span>ferramentas: ${ferramentas}</span>
          <span class="xt-sub-id">chamado como ${codigo(s.id)}</span>
        </div>`;
  }).join('');
  return `
    <div class="config-cartao">
      <div class="config-cartao-cabecalho">
        <div class="config-cartao-titulo">Subagentes e o que cada um lê
          <span class="ext-selo-cab">do manifesto</span></div>
        <p class="config-cartao-dica">Só leitura: o que cada um lê e as ferramentas
          dele vêm do <code>extensao.json</code>. Cada um liga e desliga nas sub-abas
          Subagentes do Chat e da Fila, no grupo «De extensões». Rodam dentro do Chat
          e da Fila, com a mesma trava da IA dos outros subagentes: não rodam
          enquanto outra parte do programa usa o LM Studio.</p>
      </div>
      <div class="xt-sub">${itens}</div>
    </div>`;
}

/** Limites (só leitura) — `''` para quem não traz subagente. */
function _xtLimitesHtml(tela) {
  if (!_xtSubagentesDaFolha(tela.folha).length) return '';
  const limites = _xtCatalogoDaPagina.limites_dos_subagentes || [];
  const linhas = limites.map((l) => `
        <tr><td><b>${escapeHtml(l.rotulo)}</b></td>
            <td>${escapeHtml(Number(l.valor).toLocaleString('pt-BR')
                             + (l.unidade ? ' ' + l.unidade : ''))}</td></tr>`).join('')
    || '<tr><td colspan="2">Os limites ainda não chegaram — abra a página de novo.</td></tr>';
  return `
    <div class="config-cartao">
      <div class="config-cartao-cabecalho">
        <div class="config-cartao-titulo">Limites <span class="ext-selo-cab">só leitura</span></div>
        <p class="config-cartao-dica">Os mesmos de todos os subagentes: vêm de
          <b>Configurações › Programa › Ferramentas dos subagentes</b>. Todos usam o
          mesmo modelo, então todo subagente que entra já nasce com os limites certos.</p>
      </div>
      <table class="ext-tabela">
        <thead><tr><th>Limite</th><th>Valor de agora</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      <div class="xt-sobre-acoes">
        <button type="button" class="btn btn-muted btn-xs" data-xt-ir="ferramentas">
          Mudar em Programa › Ferramentas dos subagentes</button>
      </div>
    </div>`;
}
