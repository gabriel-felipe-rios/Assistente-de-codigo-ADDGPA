// ══════════════════════════════════════════ ROTINAS: O QUE É COMUM ══
// Funções que os cards de rotina da Documentação usam em comum. Moravam em
// `espelho.js` e `espelho-desenho.js`, que saíram (D33).
//
// São scripts clássicos, não módulos: as funções continuam globais, e o
// `index.html` carrega este arquivo antes de `documentacao-tecnica.js` e de
// `embedding.js`, que as usam.

// A linha "Lê N extensões" do cartão da Documentação Técnica: pinta o número
// e liga o botão que leva a Configurações. Recebe o prefixo do cartão.
function _rotinaLePintar(prefixo, n) {
  const linha = document.getElementById(prefixo + '-rotina-le');
  if (!linha) return;
  const alvo = linha.querySelector('[data-rotina-le-n]');
  if (alvo) alvo.textContent = n === 1 ? '1 extensão' : `${n} extensões`;
  const ir = linha.querySelector('[data-rotina-le-ir]');
  if (ir && !ir._wired) {
    ir._wired = true;
    ir.addEventListener('click', _rotinaLeIrParaConfiguracoes);
  }
}

// Configurações mora na tela Projetos: a ida passa por `goBackToProjects`
// (dentro de `acessoRapidoIrParaPainel`), que pode perguntar "tem coisa
// rodando" — se o usuário desistir, a ida para aqui.
async function _rotinaLeIrParaConfiguracoes() {
  const foi = await acessoRapidoIrParaPainel('ptab-configs');
  if (!foi) return;
  abrirCategoriaConfig('extensoes');
  extMostrarVista('excecoes');
}

document.addEventListener('DOMContentLoaded', () => {
  ['pipeline', 'indice-navegacao', 'resumo-pastas'].forEach(ag => {
    const cb = document.getElementById(`${ag}-viewer-close`);
    if (cb) cb.addEventListener('click', () => {
      document.getElementById(`${ag}-viewer-content`).classList.add('hidden');
      document.querySelectorAll(`#agente-${ag} .agente-viewer-table tbody tr`).forEach(r => r.classList.remove('active'));
    });
  });
});

// O rótulo do preview era uma PREVISÃO congelada: dizia "332 arquivos para
// processar" e continuava dizendo isso a passada inteira, sem nunca informar
// quantos já tinham saído. Quem abre esse painel no meio de uma geração de
// horas está perguntando exatamente isso.
//
// Enquanto roda, ele mostra o andamento; ao terminar, `carregar*Preview()`
// devolve a previsão — que aí já é a previsão nova, do que ficou faltando.
function _rotulaAndamento(labelId, processed, total) {
  const label = document.getElementById(labelId);
  if (!label || !total) return;
  label.textContent = `${processed} de ${total} processado${processed !== 1 ? 's' : ''}`;
}

// ── As duas barras ──────────────────────────────────────────────────────────
// Compartilhada pela Documentação Técnica e pelo Embedding, como
// `_rotulaAndamento` — as telas têm o mesmo markup de progresso e o mesmo defeito.
//
// ⚠️ O QUE ESTA FUNÇÃO CONSERTA. A barra usava `total`, que é quantos arquivos
// EXISTEM. Mas a maioria costuma ser pulada por hash igual, e o contador subia
// para o pulado também: o número andava aos saltos (113 → 121 num piscar) e a
// tela prometia um trabalho muito maior do que o real — "faltam 255" com 34
// faltando.
//
// Agora são duas contas separadas, vindas separadas do backend:
//   · a barra de cima conta o trabalho DE VERDADE, sobre `a_processar`;
//   · a de baixo mostra o que veio do cache, e só aparece se houver algum.
//
// `a_processar` pode chegar `null`: a rotina emite o primeiro progresso ANTES
// de saber o denominador, porque descobri-lo pode varrer o disco inteiro e ele
// não vai deixar a tela muda enquanto isso. Nesse instante a barra fica quieta,
// em vez de mostrar um número errado.
function _pintarProgressoDuplo(pref, data) {
  const aProcessar    = data.a_processar;
  const processados   = data.processed || 0;
  const reaproveitados = data.reaproveitados || 0;
  // Quantos o cache vai poupar no total. Sem ele, a barra de baixo encheria de
  // 0 a 100% ao longo da passada em vez de mostrar de cara o que já estava
  // pronto — e a pergunta que ela responde é "quanto eu não preciso refazer?".
  const reaproveitaveis = (data.reaproveitaveis != null)
    ? data.reaproveitaveis
    : reaproveitados;

  const barra = document.getElementById(`${pref}-progress-bar`);
  const conta = document.getElementById(`${pref}-progress-count`);

  if (aProcessar == null) {
    // Zera a barra junto: sem isto, uma SEGUNDA execução começaria exibindo a
    // barra cheia da execução anterior enquanto o label diz "Iniciando...".
    if (barra) barra.style.width = '0%';
    if (conta) conta.textContent = '';
    const linhaCache = document.getElementById(`${pref}-reaproveitado-row`);
    if (linhaCache) linhaCache.classList.add('hidden');
    return null;   // ainda não dá para dizer nada honesto
  }

  const pct = aProcessar > 0 ? Math.round((processados / aProcessar) * 100) : 100;
  if (barra) barra.style.width = pct + '%';
  if (conta) conta.textContent = `${processados} / ${aProcessar}`;

  const linha = document.getElementById(`${pref}-reaproveitado-row`);
  if (linha) {
    // Projeto rodando do zero não tem nada reaproveitado: a linha some e a tela
    // fica idêntica à de antes desta mudança.
    linha.classList.toggle('hidden', !reaproveitaveis);
    if (reaproveitaveis) {
      const rb = document.getElementById(`${pref}-reaproveitado-bar`);
      const rc = document.getElementById(`${pref}-reaproveitado-count`);
      const rpct = Math.round((reaproveitados / reaproveitaveis) * 100);
      if (rb) rb.style.width = rpct + '%';
      if (rc) rc.textContent = `${reaproveitados} / ${reaproveitaveis}`;
    }
  }
  return aProcessar;
}

function renderPreviewNode(node, folder, depth) {
  const container = document.createElement('div');
  container.className = 'preview-tree-level';
  if (depth > 0) container.style.paddingLeft = '14px';

  for (const item of (node._files || [])) {
    const estaIgnorado = item._show === 'ignored';
    const el = document.createElement('div');
    const stateClass = estaIgnorado ? 'ignored' : (item.processed ? 'done' : 'unprocessed');
    el.className = 'preview-file-row preview-file preview-file-' + stateClass;
    el.title = item.path;

    if (!estaIgnorado && (item.tokens != null || item.lines != null)) {
      const tokSpan = document.createElement('span');
      tokSpan.className = 'pf-tokens';
      tokSpan.textContent = item.tokens >= 1000 ? (item.tokens / 1000).toFixed(1) + 'k' : String(item.tokens);

      const lineSpan = document.createElement('span');
      lineSpan.className = 'pf-lines';
      lineSpan.textContent = item.lines >= 1000 ? (item.lines / 1000).toFixed(1) + 'k' : String(item.lines);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'pf-name';
      nameSpan.textContent = '· ' + (item._name || item.path);

      el.appendChild(tokSpan);
      el.appendChild(lineSpan);
      el.appendChild(nameSpan);
    } else {
      el.textContent = (estaIgnorado ? '○ ' : '· ') + (item._name || item.path);
    }

    container.appendChild(el);
  }

  for (const [key, sub] of Object.entries(node)) {
    if (key === '_files') continue;
    const dirEl = document.createElement('div');
    dirEl.className = 'preview-subdir';
    const dirName = document.createElement('div');
    dirName.className = 'preview-subdir-name';
    dirName.textContent = '📁 ' + key;
    dirEl.appendChild(dirName);
    dirEl.appendChild(renderPreviewNode(sub, folder, depth + 1));
    container.appendChild(dirEl);
  }

  return container;
}

// ── A fase de cada item em andamento (D7) ────────────────────────────────
//
// `fases` vem no evento de progresso da Documentação Técnica e do Resumo de
// Pastas: `{item: {texto, tentativa, espera}}`. Item sem fase roda numa
// chamada só e aparece só com o nome. Azul é andamento; âmbar é tentativa.

/** Uma linha por item, para o card da sub-aba Rotinas:
 *  «Code/prompts · tentativa 2 de 3 · de novo em 8 s». */
function _linhasEmAndamento(lista, fases) {
  return (lista || []).map(item => {
    const f = (fases || {})[item];
    if (!f || !f.texto) return `<span>${escapeHtml(item)}</span>`;
    const texto = f.texto + (f.espera ? ` · de novo em ${f.espera} s` : '');
    const classe = f.tentativa ? 'agente-fase-tentativa' : 'agente-fase';
    return `<span>${escapeHtml(item)} <span class="${classe}">· ${escapeHtml(texto)}</span></span>`;
  }).join('');
}

/** As linhas pequenas embaixo do nome do card no Visualizar (D12): a
 *  primeira com a conta e a fase do primeiro item que tiver fase
 *  («41 de 118 · parte 2 de 3»), a segunda com a do próximo
 *  («tentativa 2 de 3 · 8 s»). Sem conta ainda, nenhuma linha. */
function _linhasDaFaseNoVisualizar(feitos, total, lista, fases) {
  if (feitos == null || total == null) return [];
  const comFase = (lista || []).filter(i => fases && fases[i] && fases[i].texto);
  const curto = f => f.texto + (f.espera ? ` · ${f.espera} s` : '');
  const primeira = comFase.length ? fases[comFase[0]] : null;
  const linhas = [{
    texto: `${feitos} de ${total}` + (primeira ? ` · ${curto(primeira)}` : ''),
    tentativa: !!(primeira && primeira.tentativa),
  }];
  if (comFase.length > 1) {
    const segunda = fases[comFase[1]];
    linhas.push({ texto: curto(segunda), tentativa: !!segunda.tentativa });
  }
  return linhas;
}
