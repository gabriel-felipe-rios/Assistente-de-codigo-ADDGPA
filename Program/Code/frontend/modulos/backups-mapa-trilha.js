// ═══ BACKUPS → Mapa da mudança → Pipeline: a trilha de cadeias ═════════════
//
// A coluna da esquerda que escolhe QUAL cadeia está em cena. Raias e Sequência
// desenham uma cadeia por vez — no Visualizar pipeline é assim, e é assim por
// um motivo medido: a cadeia C9 do projeto de teste tem 143 passos e 66
// arquivos. Empilhar as nove uma embaixo da outra, nos DOIS painéis, dá uma
// parede de desenho antes de dizer qualquer coisa.
//
// ⚠️ POR QUE NÃO REAPROVEITAR `vpDesenharTrilha`. Ela escreve direto em
// `#vp-trilha` e lê quatro globais da sub-aba (`_vpDados`, `_vpCadeia`,
// `_vpLeitura`, `_vpFase`) — é singleton, como o `_ligDesenhar` que o briefing
// já recusou pelo mesmo motivo. E há uma razão de conteúdo, não só de forma:
// aqui a lista é a **união das cadeias das duas Versões**, com marca no que
// existe de um lado só. A trilha do original não tem como expressar isso,
// porque lá só existe uma Versão.
//
// O que é reaproveitado: as classes `.vp-trilha-*` (a aparência é a mesma, e
// deve continuar sendo) e as funções puras de `mapas-pipeline-dados.js`.

// Qual cadeia está em cena. `0` = a primeira disponível. O mesmo estado serve
// de filtro para a legenda da leitura Fases — são a mesma pergunta.
let bmCadeiaEmFoco = 0;

// As leituras que desenham UMA cadeia. Tabela e Fita são do fluxo inteiro, e
// Fases mostra todas as cadeias de propósito: a trilha ali seria um segundo
// jeito de fazer o que a legenda já faz.
const BM_LEITURAS_COM_TRILHA = ['raias', 'sequencia'];

function bmTemTrilha() {
  return bmFormato === 'pipeline' &&
         BM_LEITURAS_COM_TRILHA.includes(bmVariante.pipeline);
}

// ── A união das duas Versões ────────────────────────────────────────────────

function bmCadeiasDaUniao(r) {
  const mapa = new Map();
  ['antes', 'agora'].forEach(lado => {
    ((r[lado] && r[lado].cadeias) || []).forEach(c => {
      const item = mapa.get(c.n) || { n: c.n, antes: null, agora: null };
      item[lado] = c;
      mapa.set(c.n, item);
    });
  });
  return [...mapa.values()].sort((a, b) => a.n - b.n);
}

// A cadeia em cena, ou a primeira que existir. Se a escolhida sumiu — porque
// a Versão mudou —, cair na primeira é melhor do que desenhar o vazio.
function bmCadeiaEscolhida(uniao) {
  return uniao.find(c => c.n === bmCadeiaEmFoco) || uniao[0] || null;
}

// ── O desenho da trilha ─────────────────────────────────────────────────────

function bmDesenharTrilha(r) {
  const trilha = document.getElementById('bm-trilha');
  if (!trilha) return;
  const uniao = bmCadeiasDaUniao(r);
  const escolhida = bmCadeiaEscolhida(uniao);

  trilha.innerHTML = '<div class="vp-trilha-titulo">Cadeias</div>' + uniao.map(item => {
    // A cadeia é descrita pelo lado "agora" quando ele a tem: é o estado mais
    // recente. Só quando ela sumiu é que o "antes" fala por ela.
    const cadeia = item.agora || item.antes;
    const soUmLado = !item.antes || !item.agora;
    const passos = (item.agora || item.antes).passos || [];
    const fases = vpFasesDosPassos(passos);
    const emoji = vpEmojiDaCadeia(cadeia);
    const selecionada = escolhida && item.n === escolhida.n;

    return `
      <button class="vp-trilha-item vp-cadeia-${(item.n - 1) % 9}
                     ${selecionada ? 'ativo' : ''} ${soUmLado ? 'so-um-lado' : ''}"
              data-cadeia="${item.n}" title="${escapeHtml(cadeia.cabeca || cadeia.nome)}">
        <div class="vp-trilha-l1">
          <span class="vp-pino">C${item.n}</span>
          <span class="vp-trilha-nome">${emoji ? emoji + ' ' : ''}${escapeHtml(vpRotuloDaCadeia(cadeia))}</span>
        </div>
        <div class="vp-trilha-l2">
          ${bmContagemDosDoisLados(item)} ·
          <span class="vp-conta-travessias">${vpContarTravessias(passos)} trav.</span>
          ${soUmLado ? `<span class="bm-trilha-so">só ${item.agora ? 'em agora' : 'em antes'}</span>` : ''}
        </div>
        <div class="vp-trilha-fases">${[1, 2, 3, 4, 5]
          .map(f => `<span class="${fases.includes(f) ? 'on' : ''}"></span>`).join('')}</div>
      </button>`;
  }).join('');
}

// Os dois números lado a lado, e não a soma: "12 → 15 passos" diz que a cadeia
// cresceu. Um total só não diria nada — que é a razão da tela inteira existir.
function bmContagemDosDoisLados(item) {
  const a = item.antes ? item.antes.passos.length : 0;
  const b = item.agora ? item.agora.passos.length : 0;
  if (a === b) return `${b} passos`;
  return `${a} → ${b} passos`;
}

// Delegação num listener só, ligado uma vez: `#bm-trilha` sobrevive ao
// redesenho, e ligar botão por botão empilharia listeners a cada troca.
function bmLigarTrilha() {
  const trilha = document.getElementById('bm-trilha');
  if (!trilha || trilha.dataset.ligada) return;
  trilha.dataset.ligada = '1';
  trilha.addEventListener('click', ev => {
    const item = ev.target.closest('.vp-trilha-item');
    if (!item) return;
    bmCadeiaEmFoco = Number(item.dataset.cadeia);
    bmDesenhar();
  });
}
