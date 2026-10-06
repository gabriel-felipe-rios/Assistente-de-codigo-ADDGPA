// ── Subagentes de extensão — os cards do grupo "De extensões" ────────────────
//
// Pergunta que este arquivo responde: "que subagentes as extensões ligadas
// acrescentam ao Chat e à Fila agora, e com que cara?". A resposta sai da
// árvore de extensões que a tela já tem (`xtLigadas()`, estado.js) — os itens
// `{"recurso": "agente", "forma": "subagente"}` e `{"recurso": "ferramenta"}`
// já vêm conferidos pelo backend (`validacao_agente.py`,
// `validacao_ferramenta.py`).
//
// ⚠️ ESTE ARQUIVO MEXE EM `AGENTES_DEFINICOES` (chat-agentes.js), e é o único
// que mexe: tira os cards do grupo 'extensoes' e põe os de agora. É assim que
// o nome de exibição continua tendo UMA fonte — o Log e a conversa acham o
// "Conferente" pelo mesmo `agenteRotulo` dos outros — e que a Fila, que lê
// AGENTES_DEFINICOES, ganha o grupo dela sem cópia.
//
// Desde a fase 07 (D51, D52, D55) ele também:
//   · pinta a COR de cada subagente de extensão (legenda, título do grupo no
//     Log) num `<style id="sub-ext-cores">` do programa — o id deles tem ponto
//     e o programa não os conhece pelo nome, então não há regra fixa em
//     `subagentes.css`; a cor é um token `--sub-cor-*` do tema;
//   · põe as bolinhas deles na legenda do Chat e da Fila;
//   · empresta a FONTE de uma ferramenta de extensão ao card do subagente do
//     programa que a recebe (`SUBAGENTES_FONTES_DE_EXTENSOES`);
//   · migra o liga/desliga salvo com um id ANTIGO (`antes` no manifesto) para
//     o id novo — no `localStorage` do Chat e da Fila aqui, e no
//     `subagentes.json` de cada chat em `setChatSubagentesOverride`.
//
// ⚠️ Quem chama é `xtAdotarArvore` (estado.js), a cada vez que a lista de
// extensões muda — ligar e desligar vale sem reiniciar. O backend confere de
// novo a cada envio (`com_subagentes_de_extensoes`): um card velho na tela
// nunca faz rodar o subagente de uma extensão desligada.

// `{id antigo: id novo}` dos subagentes de extensão ligados que declaram
// `antes`. Refeito a cada sincronização.
let _subExtRenomes = {};

// A última foto pintada — sem mudança, sem repintar (`xtAdotarArvore` roda a
// cada gravação da lista).
let _subExtAssinatura = '';

// `{id de subagente do programa: [fontes]}` — o que uma extensão ligada
// empresta ao card de um subagente do programa junto da ferramenta (o `fonte`
// do item `ferramenta`). Lido por `_agenteFontesDe` (agentes-fontes.js).
const SUBAGENTES_FONTES_DE_EXTENSOES = {};

/** A cor de um subagente como valor de CSS. O do programa tem o token com o
 *  id dele (`--sub-{id}`); o de extensão, o `--sub-cor-*` que escolheu, ou o
 *  `--purple` de "acréscimo". */
function agenteCorVar(id) {
  const def = (typeof AGENTES_DEFINICOES !== 'undefined')
    ? AGENTES_DEFINICOES.find(a => a.id === id) : null;
  if (def && def.grupo === 'extensoes') {
    return def.cor ? `var(--sub-cor-${def.cor})` : 'var(--purple)';
  }
  return `var(--sub-${id})`;
}

/** Passa, no objeto `estado` (`{id: ligado}`), o valor de cada id antigo para
 *  o id novo, e apaga o antigo. Devolve `true` se mudou algo. */
function subagentesMigrarEstado(estado) {
  if (!estado || typeof estado !== 'object') return false;
  let mudou = false;
  Object.entries(_subExtRenomes).forEach(([antigo, novo]) => {
    if (!(antigo in estado)) return;
    if (!(novo in estado)) estado[novo] = estado[antigo];
    delete estado[antigo];
    mudou = true;
  });
  return mudou;
}

function _subExtMigrarGuardado(chave) {
  let estado;
  try { estado = JSON.parse(localStorage.getItem(chave) || '{}'); } catch (e) { return; }
  if (subagentesMigrarEstado(estado)) localStorage.setItem(chave, JSON.stringify(estado));
}

function _subExtPintarCores(novos) {
  let estilo = document.getElementById('sub-ext-cores');
  if (!estilo) {
    estilo = document.createElement('style');
    estilo.id = 'sub-ext-cores';
    document.head.appendChild(estilo);
  }
  estilo.textContent = novos.map(a => {
    const cor = a.cor ? `var(--sub-cor-${a.cor})` : 'var(--purple)';
    return `.legend-${CSS.escape(a.id)} { background: ${cor}; }\n`
         + `.chat-log-group[data-agente="${a.id}"] .chat-log-group-nome { color: ${cor}; }`;
  }).join('\n');
}

function _subExtPintarLegendas(novos) {
  ['chat-legenda-extensoes', 'fila-legenda-extensoes'].forEach(idEl => {
    const el = document.getElementById(idEl);
    if (!el) return;
    el.innerHTML = novos.map(a =>
      `<span class="legend-dot legend-${escapeHtml(a.id)}"></span><span>${escapeHtml(a.nome)}</span>`
    ).join('');
  });
}

function subagentesDeExtensoesSincronizar() {
  if (typeof AGENTES_DEFINICOES === 'undefined' || typeof xtLigadas !== 'function') return;
  const novos = [];
  const renomes = {};
  const emprestadas = {};
  xtLigadas().forEach(folha => {
    ((folha && folha.acrescenta) || []).forEach(item => {
      if (item.recurso === 'ferramenta') {
        if (!item.fonte) return;
        (item.subagentes_do_programa || []).forEach(id => {
          emprestadas[id] = emprestadas[id] || [];
          if (!emprestadas[id].includes(item.fonte)) emprestadas[id].push(item.fonte);
        });
        return;
      }
      if (item.recurso !== 'agente' || item.forma !== 'subagente') return;
      (item.antes || []).forEach(antigo => { renomes[antigo] = item.id; });
      novos.push({
        id: item.id,
        icone: item.icone,
        nome: item.nome,
        descricao: `${item.descricao} (extensão «${folha.nome}»)`,
        grupo: 'extensoes',
        fontes: item.fontes || [],
        seloFonte: item.selo_fonte || '',
        cor: item.cor || '',
      });
    });
  });

  // A migração roda SEMPRE (mesmo sem mudança na lista): o liga/desliga
  // antigo pode ter sido gravado por uma aba que ainda não sabia do id novo.
  _subExtRenomes = renomes;
  if (typeof AGENTES_ESTADO_KEY !== 'undefined') _subExtMigrarGuardado(AGENTES_ESTADO_KEY);
  if (typeof FILA_AGENTES_ESTADO_KEY !== 'undefined') _subExtMigrarGuardado(FILA_AGENTES_ESTADO_KEY);

  const assinatura = JSON.stringify([novos, emprestadas]);
  if (assinatura === _subExtAssinatura) return;
  _subExtAssinatura = assinatura;

  Object.keys(SUBAGENTES_FONTES_DE_EXTENSOES).forEach(k => { delete SUBAGENTES_FONTES_DE_EXTENSOES[k]; });
  Object.assign(SUBAGENTES_FONTES_DE_EXTENSOES, emprestadas);
  _subExtPintarCores(novos);
  _subExtPintarLegendas(novos);

  for (let i = AGENTES_DEFINICOES.length - 1; i >= 0; i--) {
    if (AGENTES_DEFINICOES[i].grupo === 'extensoes') AGENTES_DEFINICOES.splice(i, 1);
  }
  AGENTES_DEFINICOES.push(...novos);

  // A tabela da sub-aba Ferramentas também lista os de extensão (backend,
  // `catalogo_ferramentas`); o cache dela seguraria a lista velha.
  if (typeof esquecerCatalogoDeFerramentas === 'function') esquecerCatalogoDeFerramentas();
  if (typeof renderChatAgentes === 'function') renderChatAgentes();
  // A aba da Fila só repinta quando a assinatura DELA muda (ids e
  // liga/desliga) — uma fonte emprestada ao Verificador não muda nenhum dos
  // dois. Zerar a assinatura força a repintura.
  const listaFila = document.getElementById('fila-agentes-list');
  if (listaFila) listaFila.dataset.assinatura = '';
  if (typeof _filaRenderSubagentesTab === 'function') _filaRenderSubagentesTab();
}
