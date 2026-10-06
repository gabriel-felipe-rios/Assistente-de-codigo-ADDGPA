// ═══ BACKUPS → Mapa da mudança → o diff no clique ══════════════════════════
//
// Clicar num arquivo do **Treemap** ou do **Sunburst** abre a diferença daquele
// arquivo num modal rolável. Antes, só a Árvore abria o diff (`bmAbrirTrecho`),
// e as duas leituras que mais dão vontade de clicar — porque cada arquivo é um
// bloco colorido do tamanho dele — não respondiam a nada.
//
// ⚠️ **LIGAÇÕES E PIPELINE NÃO ENTRAM AQUI**, por decisão do usuário. Lá o que
// está desenhado não é um arquivo com um antes e um depois: são ligações entre
// arquivos e passos de um fluxo. Abrir um diff a partir de uma seta seria
// responder outra pergunta.
//
// ⚠️ **ARQUIVO SEM ALTERAÇÃO NÃO ABRE NADA.** Um modal vazio dizendo "nenhuma
// diferença" é pior que o clique não fazer nada: ele pede duas ações (abrir e
// fechar) para entregar zero informação. O cinza já disse que não mudou.
//
// ⚠️ **NÃO EXISTE "↩ Voltar só este arquivo" AQUI.** Ele existiu na Árvore e
// foi RETIRADO por decisão do usuário: sobrescrever um arquivo do disco a um
// clique, dentro de uma tela cuja função é *olhar*, é perigoso demais para o
// pouco que economiza. A reversão mora na sub-aba Versões. Não recriar.

let bmModalDiffInjetado = false;

// ── O molde ─────────────────────────────────────────────────────────────────

// Injetado em `document.body`, e não no HTML fixo: é o padrão dos três modais
// de Backups (`bkInjetarModais`), e um overlay que nasce dentro da aba herdaria
// o `overflow` e o empilhamento dela.
//
// O molde visual é o do `#modal-prompt-view` — `.modal-prompt` já é o modal de
// corpo monoespaçado com `max-height: 80vh` e rolagem por dentro, que é
// exatamente a rolagem pedida.
function bmInjetarModalDiff() {
  if (bmModalDiffInjetado) return;
  bmModalDiffInjetado = true;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="modal-overlay hidden" id="bm-modal-diff">
      <div class="modal modal-prompt">
        <div class="modal-prompt-header">
          <h3 id="bm-modal-diff-titulo">Diferença</h3>
          <button class="btn-icon" id="bm-modal-diff-fechar" title="Fechar (Esc)">✕</button>
        </div>
        <div class="bm-modal-diff-corpo" id="bm-modal-diff-corpo"></div>
      </div>
    </div>`;
  document.body.appendChild(wrap.firstElementChild);

  document.getElementById('bm-modal-diff-fechar')
    .addEventListener('click', bmFecharModalDiff);

  // Clicar no fundo fecha; clicar DENTRO do modal não. Sem o teste de alvo, um
  // clique que começa numa linha do diff e termina fora (seleção de texto)
  // fecharia a janela no meio da leitura.
  document.getElementById('bm-modal-diff').addEventListener('click', ev => {
    if (ev.target.id === 'bm-modal-diff') bmFecharModalDiff();
  });

  // ⚠️ O Esc é ligado UMA VEZ, no `document`, e com guarda de visibilidade. O
  // único Esc global que o programa tinha (`designer.js`) dispara sempre, esteja
  // o modal aberto ou não — o que só não quebra nada porque o fechamento dele é
  // idempotente. Copiar isso empilharia dois modais brigando pela mesma tecla.
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape') return;
    const overlay = document.getElementById('bm-modal-diff');
    if (!overlay || overlay.classList.contains('hidden')) return;
    ev.stopPropagation();
    bmFecharModalDiff();
  });
}

function bmFecharModalDiff() {
  const overlay = document.getElementById('bm-modal-diff');
  if (overlay) overlay.classList.add('hidden');
}

// ── Abrir ───────────────────────────────────────────────────────────────────

async function bmAbrirModalDiff(caminho, metade, situacao) {
  if (!caminho || situacao === 'igual') return;
  bmInjetarModalDiff();
  const overlay = document.getElementById('bm-modal-diff');
  const corpo = document.getElementById('bm-modal-diff-corpo');
  document.getElementById('bm-modal-diff-titulo').textContent = caminho;
  corpo.innerHTML = '<div class="bk-carregando">Lendo…</div>';
  overlay.classList.remove('hidden');

  try {
    const r = await window.pywebview.api.diff_do_arquivo(
      currentProject, bmDe, bmAte, caminho, metade);
    if (!r.success) throw new Error(r.error);
    // Uma resposta que chega depois de o usuário ter fechado não deve reabrir
    // nem repintar nada.
    if (overlay.classList.contains('hidden')) return;
    corpo.innerHTML = bmMarcacaoDoDiff(r);
  } catch (e) {
    corpo.innerHTML = `<div class="bk-warn">${escapeHtml(String(e))}</div>`;
  }
}

// ── O corpo do diff, compartilhado com a Árvore ─────────────────────────────

// ⚠️ UMA FUNÇÃO SÓ para os dois lugares que mostram diff. Ela nasceu duplicada
// dentro de `bmAbrirTrecho`; com o modal seriam duas cópias da mesma marcação,
// e a primeira classe nova entraria só numa delas.
function bmMarcacaoDoDiff(r) {
  // Mudou de lugar e não de conteúdo: não há diff, e um `<pre>` vazio seria
  // lido como "não mudou nada" — que é justamente a leitura errada.
  if (r.par && (r.situacao === 'movido' || r.situacao === 'renomeado')) {
    return `<div class="bm-fora-nota" style="padding:8px 10px">${
      escapeHtml(r.motivo || '')}</div>`;
  }
  // Binário: dizer POR QUÊ. Ver `backups_diff.comparavel`.
  if (r.binario) {
    return `<div class="bm-fora-nota" style="padding:8px 10px">${
      escapeHtml(r.motivo || '')}</div>`;
  }
  if (!r.trecho || !r.trecho.length) {
    return '<div class="bm-fora-nota" style="padding:8px 10px">'
         + 'Nenhuma diferença de conteúdo entre as duas Versões.</div>';
  }
  // ⚠️ AS LINHAS SE JUNTAM SEM `\n`. Cada `.bm-diff-l` já é uma linha por si, e
  // o `<pre>` está em `white-space: pre` — o `\n` que havia entre elas somava
  // uma linha em branco a cada linha do diff, e o trecho saía com espaço duplo.
  return `<pre class="bm-diff">${
    bmNumerarDiff(r.trecho).map(bmLinhaDoDiff).join('')}</pre>`;
}

// ── A numeração ─────────────────────────────────────────────────────────────

// `@@ -a,b +c,d @@` — os números de partida de cada lado.
//
// ⚠️ A CONTAGEM É OPCIONAL. Quando ela vale 1, o `difflib` escreve `@@ -5 +5,3 @@`
// e não `@@ -5,1 +5,3 @@`. Sem o grupo opcional o cabeçalho não casa, a
// numeração para de avançar no meio do arquivo e todos os números depois dele
// ficam errados — sem nada na tela denunciando.
const BM_SALTO = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

// A lista crua do back-end vira uma lista de `{tipo, texto, antes, agora}`.
//
// ⚠️ O CABEÇALHO `--- antes` / `+++ agora` SAI AQUI, e não só por ser feio: ele
// era pintado ERRADO. `--- antes` começa com `-`, casava com a regra de remoção
// e saía em vermelho como se fosse uma linha apagada do arquivo. O nome do
// arquivo já está no título do modal e na barra do trecho da Árvore — nada se
// perde ao tirá-lo.
function bmNumerarDiff(trecho) {
  const linhas = [];
  let antes = 0, agora = 0;
  (trecho || []).forEach(texto => {
    if (texto.startsWith('--- ') || texto.startsWith('+++ ')) return;

    const salto = BM_SALTO.exec(texto);
    if (salto) {
      antes = Number(salto[1]);
      agora = Number(salto[2]);
      // O `@@` cru não vira texto: vira uma faixa de separação entre hunks. O
      // que ele dizia — de que linha o pedaço começa — passa a estar escrito
      // nos números da linha seguinte, que é onde se procura por isso.
      linhas.push({ tipo: 'salto' });
      return;
    }
    if (texto.startsWith('+')) {
      linhas.push({ tipo: 'mais', texto: texto.slice(1), agora: agora++ });
    } else if (texto.startsWith('-')) {
      linhas.push({ tipo: 'menos', texto: texto.slice(1), antes: antes++ });
    } else if (texto.startsWith(' ')) {
      linhas.push({ tipo: '', texto: texto.slice(1), antes: antes++, agora: agora++ });
    } else {
      // Qualquer linha que não seja `+`, `-` ou contexto — recado do próprio
      // `difflib`, não conteúdo do arquivo — e por isso NÃO recebe número.
      // (Era aqui que caía o aviso de "diff truncado em 400 linhas", tirado a
      // pedido do usuário: o trecho agora vem inteiro.)
      linhas.push({ tipo: 'nota', texto });
    }
  });
  return linhas;
}

// ⚠️ OS DOIS NÚMEROS E O TEXTO SÃO O MESMO ELEMENTO. O gutter do Visualizar
// pipeline (`vp-md-gutter`) é uma coluna separada, unida por flex — ali funciona
// porque a rolagem é do pai. Aqui `.bm-diff` tem `overflow-x` próprio, e duas
// colunas paralelas se desalinhariam na primeira linha longa. Uma grade por
// linha não tem como desalinhar, e o `position: sticky` dos números os mantém
// parados enquanto o código rola para o lado — que é o que o GitHub faz.
function bmLinhaDoDiff(l) {
  if (l.tipo === 'salto') return '<span class="bm-diff-l salto"></span>';
  const num = (v) => `<span class="bm-diff-num">${v === undefined ? '' : v}</span>`;
  return `<span class="bm-diff-l ${l.tipo}">${num(l.antes)}${num(l.agora)}` +
         `<span class="bm-diff-txt">${escapeHtml(l.texto)}</span></span>`;
}

// ── O clique, separado do arrasto ───────────────────────────────────────────

// ⚠️ O ZOOM DO d3 FAZ PAN COM O BOTÃO ESQUERDO. Sem separar clique de arrasto,
// todo gesto de mover o desenho terminaria abrindo o modal do bloco onde o dedo
// soltou — e mover o desenho é o gesto mais frequente das duas leituras.
//
// A separação é por DISTÂNCIA, não por tempo: quem arrasta devagar continua
// arrastando, e quem clica e segura um instante continua clicando.
const BM_TOLERANCIA_DE_CLIQUE = 4;

// Delegação numa área que SOBREVIVE ao redesenho (`#bm-area` só troca de
// `innerHTML`), com marca para não empilhar um listener por desenho — a mesma
// guarda do bloco agregado do Treemap.
function bmLigarCliqueDeArquivo(area, seletor, marca) {
  if (area.dataset[marca]) return;
  area.dataset[marca] = '1';

  let partida = null;
  area.addEventListener('pointerdown', ev => {
    partida = { x: ev.clientX, y: ev.clientY };
  });
  area.addEventListener('pointerup', ev => {
    if (!partida) return;
    const arrastou = Math.abs(ev.clientX - partida.x) > BM_TOLERANCIA_DE_CLIQUE ||
                     Math.abs(ev.clientY - partida.y) > BM_TOLERANCIA_DE_CLIQUE;
    partida = null;
    if (arrastou) return;
    const alvo = ev.target.closest(seletor);
    if (!alvo || !alvo.dataset.caminho) return;
    bmAbrirModalDiff(alvo.dataset.caminho, alvo.dataset.metade,
                     alvo.dataset.situacao);
  });
}
