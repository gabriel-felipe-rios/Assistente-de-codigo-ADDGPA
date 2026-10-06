// ═══ BACKUPS → sub-aba Mapa da mudança — a casca ═══════════════════════════
//
// Cinco formatos, oito desenhos: Árvore · Treemap · Sunburst · Ligações (3
// variantes) · Pipeline (5 variantes). Os dados vêm prontos do back-end
// (`backups_mapa*.py`) e NENHUM deles chama o modelo.
//
// ⚠️ A REGRA DO EIXO: o par esquerda/direita é **sempre ANTES → AGORA**. O
// seletor de metade escolhe o *assunto* (Código · Documentação · Os dois),
// nunca o lado. Duas exceções, ambas de propósito:
//   · a **Árvore** não tem dois lados — ela já é o diff;
//   · o **Pipeline · Fita** empilha as duas execuções na vertical, porque o
//     fluxo dele corre na horizontal e não sobra eixo para o par.
//
// ⚠️ NENHUM RÓTULO É CORTADO COM RETICÊNCIAS. Nome pela metade ocupa espaço,
// chama atenção e não informa. Quem some é o rótulo inteiro, e só depois de o
// navegador medir — ver `bmPodarRotulos`.

let bmDe = null;
let bmAte = 'atual';
let bmFormato = 'arvore';
let bmMetade = 'codigo';
let bmUnidade = 'linhas';
let bmVariante = { ligacoes: 'lado-a-lado', pipeline: 'fases' };
let bmModoDaMatriz = 'arquivo';
let bmLayoutDeLigacoes = 'camadas';
let bmVersoes = [];

const BM_FORMATOS = [
  { id: 'arvore', rotulo: 'Árvore' },
  { id: 'treemap', rotulo: 'Treemap' },
  { id: 'sunburst', rotulo: 'Sunburst' },
  { id: 'ligacoes', rotulo: 'Ligações' },
  { id: 'pipeline', rotulo: 'Pipeline' },
];

const BM_VARIANTES = {
  ligacoes: [
    { id: 'lado-a-lado', rotulo: 'Lado a lado' },
    { id: 'matriz', rotulo: 'Matriz' },
    { id: 'por-arquivo', rotulo: 'Por arquivo' },
  ],
  pipeline: [
    { id: 'fases', rotulo: 'Fases' },
    { id: 'raias', rotulo: 'Raias' },
    { id: 'sequencia', rotulo: 'Sequência' },
    { id: 'tabela', rotulo: 'Tabela' },
    { id: 'fita', rotulo: 'Fita' },
  ],
};

// Quatro layouts do motor das Ligações (`mapas-ligacoes-modos.js`). Eles são
// geometria pura, então entram aqui sem nenhuma adaptação. ⚠️ Desde 2026-09 a
// tela Mapas › Ligações mostra só Pastas e Impacto (D62): Camadas, Arquitetura
// e Foco local vivem SÓ aqui, e é por isso que o motor deles não saiu.
//
// ⚠️ TRÊS FORAM OFERECIDOS E RECUSADOS, e não devem voltar:
//   · **Ciclos** — não desenhava nada. Não era defeito: o grafo de imports deste
//     projeto não tem ciclo nenhum, e o layout diz isso por escrito. Um botão
//     que quase sempre responde "nada aqui" não paga o lugar que ocupa.
//   · **Caminho** — exige escolher origem E destino; dois seletores a mais num
//     painel que já tem quatro linhas.
//   · **Impacto** — a pergunta dele ("quem quebra se este arquivo mudar") não
//     se lê no nome, e num mapa comparativo ela compete com o Foco local.
//
// **Foco local** ficou, e depende de um arquivo escolhido. A escolha é UMA SÓ,
// valendo nos dois painéis: um seletor por lado transformaria a comparação de
// duas Versões numa comparação de duas perguntas diferentes.
const BM_LAYOUTS = [
  { id: 'camadas', rotulo: 'Camadas' },
  { id: 'arquitetura', rotulo: 'Arquitetura' },
  { id: 'pastas', rotulo: 'Pastas' },
  { id: 'foco', rotulo: 'Foco local', dica: 'A vizinhança de um arquivo, até a profundidade escolhida' },
];

// Formatos que medem tamanho — são os que ganham o alternador Linhas / Bytes.
const BM_COM_UNIDADE = ['treemap', 'sunburst'];

// Ligações e Pipeline não têm metade "documentação": o grafo e o fluxo são
// sempre do código. Escolher *Documentação* neles cai em *Código*.
const BM_SO_CODIGO = ['ligacoes', 'pipeline'];

// ── Montagem ────────────────────────────────────────────────────────────────

async function initBackupsMapa() {
  const painel = document.getElementById('bksub-mapa');
  if (!painel || !currentProject) return;
  if (!painel.dataset.montado) {
    painel.dataset.montado = '1';
    painel.innerHTML = bmMarcacao();
    bmLigarControles();
  }
  await bmCarregarVersoes();
  // Sem `await`: montar a lista dos arquivos grandes custa uma varredura do
  // disco com md5 de cada arquivo. Ela chega depois e preenche a nota no lugar
  // que o desenho já reservou — esperar por ela seria meio segundo de tela
  // branca a cada entrada na sub-aba.
  bmCarregarGrandes();
  bmDesenhar();
}

function bmMarcacao() {
  return `
    <div class="mapa-header">
      <div class="mapa-header-left">
        <div class="mapa-title">Mapa da mudança</div>
        <div class="mapa-desc">O que mudou entre duas Versões — sempre da esquerda (antes) para a direita (agora).</div>
        <span class="mapa-caminho" id="bm-caminho"></span>
      </div>
      <div class="mapa-header-right mapa-header-right--coluna">
        <div class="mapa-header-controles">
          <select class="bm-select" id="bm-de"></select>
          <span class="bm-seta">→</span>
          <select class="bm-select" id="bm-ate"></select>
          <div class="mapa-toggle" id="bm-formatos">
            ${BM_FORMATOS.map(f => `
              <button class="mapa-toggle-btn${f.id === 'arvore' ? ' active' : ''}"
                      data-formato="${f.id}">${f.rotulo}</button>`).join('')}
          </div>
        </div>
        <span class="mapa-stat" id="bm-stat"></span>
      </div>
    </div>

    <div class="bm-legenda" id="bm-legenda"></div>

    <div class="bm-palco" id="bm-palco">
      <div class="vp-trilha bm-trilha hidden" id="bm-trilha"></div>
      <div class="bm-area" id="bm-area"></div>
      <div class="mapas-controls-panel bm-painel" id="bm-painel"></div>
    </div>`;
}

function bmLigarControles() {
  document.getElementById('bm-formatos').addEventListener('click', ev => {
    const btn = ev.target.closest('.mapa-toggle-btn');
    if (!btn) return;
    bmFormato = btn.dataset.formato;
    bmTreemapAberto = false;
    document.querySelectorAll('#bm-formatos .mapa-toggle-btn')
      .forEach(b => b.classList.toggle('active', b === btn));
    bmDesenhar();
  });
  document.getElementById('bm-de').addEventListener('change', ev => {
    bmDe = ev.target.value; bmTreemapAberto = false; bmDesenhar();
  });
  document.getElementById('bm-ate').addEventListener('change', ev => {
    bmAte = ev.target.value; bmTreemapAberto = false; bmDesenhar();
  });
  bmLigarTrilha();
}

async function bmCarregarVersoes() {
  const r = await window.pywebview.api.listar_versoes(currentProject);
  bmVersoes = (r && r.success) ? r.versoes : [];
  const opcao = v => `<option value="${v.id}">${bkFormatarData(v.criada_em, v.id)}` +
                     `${v.anotacao ? ' — ' + escapeHtml(v.anotacao) : ''}</option>`;
  const de = document.getElementById('bm-de');
  const ate = document.getElementById('bm-ate');
  de.innerHTML = bmVersoes.map(opcao).join('');
  ate.innerHTML = '<option value="atual">estado atual</option>' +
                  bmVersoes.map(opcao).join('');
  if (!bmDe || !bmVersoes.some(v => v.id === bmDe)) {
    bmDe = bmVersoes.length ? bmVersoes[0].id : null;
  }
  de.value = bmDe || '';
  ate.value = bmAte;
}

function bmAbrirVersao(versaoId) {
  // O botão 🗺 do cartão clica na sub-aba e chama esta função no mesmo quadro.
  // `initBackupsMapa` é assíncrono, então o painel pode ainda não existir —
  // ajustar `bmDe` e sair basta: quem está montando desenha com o valor certo.
  bmDe = versaoId;
  const de = document.getElementById('bm-de');
  if (!de) return;
  de.value = versaoId;
  bmDesenhar();
}

// ── O painel do canto e a legenda ───────────────────────────────
//
// `bmPainel`, `bmLegenda` e as duas frases que elas escrevem moram em
// `backups-mapa-painel.js`. Saíram daqui pela AMF: com os seletores das
// leituras de Ligações que dependem de um arquivo, este arquivo passaria de
// 500 linhas. A divisão também é conceitual — lá mora o que se ESCOLHE e o que
// se EXPLICA; aqui, o que se desenha.

// ── Desenhar ────────────────────────────────────────────────────────────────

function bmMetadeEfetiva() {
  return BM_SO_CODIGO.includes(bmFormato) ? 'codigo' : bmMetade;
}

async function bmDesenhar() {
  const area = document.getElementById('bm-area');
  if (!area) return;
  bmPainel();
  bmLegenda();
  // A trilha só existe onde ela escolhe alguma coisa: Raias e Sequência
  // desenham UMA cadeia por vez, como no Visualizar pipeline. Nas outras seria
  // uma coluna ocupando 224 px sem responder a nada.
  document.getElementById('bm-trilha').classList.toggle('hidden', !bmTemTrilha());

  if (!bmDe) {
    area.innerHTML = '<div class="bm-vazio">Faça pelo menos uma cópia para poder comparar.</div>';
    document.getElementById('bm-stat').textContent = '';
    return;
  }
  area.innerHTML = '<div class="bk-carregando">Montando o desenho…</div>';
  document.getElementById('bm-caminho').textContent = '';
  // O motor de zoom pertence ao desenho que está em cena. Trocar de formato
  // sem soltar o anterior deixaria os botões de escala falando com um DOM que
  // já não existe.
  bmZoomAtivo = null;
  bmSoltarPanAnterior();

  try {
    if (bmFormato === 'arvore') await bmDesenharArvore(area);
    else if (bmFormato === 'treemap') await bmDesenharTreemap(area);
    else if (bmFormato === 'sunburst') await bmDesenharSunburst(area);
    else if (bmFormato === 'ligacoes') await bmDesenharLigacoes(area);
    else if (bmFormato === 'pipeline') await bmDesenharPipeline(area);
  } catch (e) {
    console.error(e);
    area.innerHTML = `<div class="bk-warn">${escapeHtml(String(e))}</div>`;
  }
}

function bmEstatistica(texto) {
  // A dica de zoom saiu daqui e foi para a legenda, junto do resto do que
  // precisa ser explicado — a stat estava virando um parágrafo.
  document.getElementById('bm-stat').textContent = texto;
}

function bmResumoEmTexto(r) {
  if (!r) return '';
  const bin = r.binarios ? ` · ${r.binarios} binários (comparados pelo hash)` : '';
  return `${r.arquivos} arquivos · ${r.pastas} pastas · +${r.mais} / −${r.menos}${bin}`;
}

// Cabeçalho do desenho: a faixa de "nada mudou" e a nota do que ficou de fora.
// As duas existem pelo mesmo motivo — silêncio aqui é lido como defeito.
function bmAvisos(area, resumos) {
  const nadaMudou = resumos.every(r => r && r.arquivos === 0);
  let html = '';
  if (nadaMudou) {
    html += `<div class="bm-nada-mudou">✓ Nada mudou entre estas duas Versões —
      os dois lados são idênticos, e por isso está tudo na cor de “sem alteração”.</div>`;
  }
  // A nota dos arquivos grandes é preenchida à parte, por `bmNotaDeGrandes`:
  // ela não depende da metade em cena, e o lugar dela na tela precisa existir
  // antes de a lista chegar.
  html += '<div class="bm-fora-nota" id="bm-nota-grandes"></div>';
  area.insertAdjacentHTML('afterbegin', html);
  bmNotaDeGrandes();
}

// ── Os arquivos grandes, e em qual metade eles estão ───────────────────────
//
// ⚠️ A NOTA VALE PARA AS DUAS METADES, SEMPRE. Ela saía dos dados da metade
// em cena, e por isso desaparecia junto com o arquivo: no projeto de teste os
// dois arquivos acima do limiar estão os dois em Documentação, então quem
// olhava Código não via arquivo grande nem a nota dizendo que existia um. Mexer
// no teto não mudava nada, e a regra parecia quebrada quando estava certa — só
// muda no lugar em que o arquivo está.
let bmGrandes = null;

async function bmCarregarGrandes() {
  // Fora do caminho do desenho, de propósito: montar a lista custa uma
  // varredura do disco com md5 de cada arquivo. Ela chega depois e preenche a
  // nota no lugar que já estava reservado.
  try {
    const r = await window.pywebview.api.listar_arquivos_grandes(currentProject);
    bmGrandes = (r && r.success) ? r : null;
  } catch (e) {
    bmGrandes = null;
  }
  bmNotaDeGrandes();
}

function bmNotaDeGrandes() {
  const alvo = document.getElementById('bm-nota-grandes');
  if (!alvo) return;
  if (!bmGrandes || !bmGrandes.grandes.length) { alvo.innerHTML = ''; return; }

  const fora = bmGrandes.modo === 'fora';
  const nomes = bmGrandes.grandes.slice(0, 6).map(g =>
    `<b>${escapeHtml(g.caminho.split('/').pop())}</b> (${bmEmMB(g.bytes)} · ${
      bmNomeDaMetade(g.metade)})`).join(' · ');
  alvo.innerHTML = `
    ${bmGrandes.grandes.length} arquivo(s) acima de ${bmGrandes.limiar_mb} MB
    ${fora ? '<b>ficam fora do desenho</b>' : '<b>entram com o teto de área</b>'},
    pela sua escolha em Configuração → Arquivos grandes no Mapa: ${nomes}${
      bmGrandes.grandes.length > 6 ? ' …' : ''}.
    <b>A cópia guardou todos eles</b> — isto é só representação.`;
}

function bmEmMB(bytes) {
  return (bytes / 1048576).toFixed(1).replace('.', ',') + ' MB';
}


// ── Peças compartilhadas pelos desenhos ─────────────────────────────────────

function bmClasseDaSituacao(situacao) {
  return 'bm-' + (situacao || 'igual');
}

// De onde veio, ou para onde foi. Um arquivo movido aparece dos DOIS lados —
// no `antes` com o caminho velho, no `agora` com o novo —, e a seta é o que
// diz qual das duas pontas está sendo olhada. Sem ela o rótulo "movido
// caminho/velho.py" não deixa claro se aquele é o começo ou o fim do trajeto.
// ⚠️ Lê `par_lado`, e NÃO o `lado` do bloco. Eles quase sempre coincidem, mas
// não são a mesma coisa: `lado` é o painel em que o bloco está desenhado, e
// `par_lado` é a ponta do trajeto que aquele caminho é. A Árvore, que não tem
// dois painéis, só tem o segundo — e ela também precisa da seta.
function bmSetaDoPar(dado) {
  return (dado.par_lado || dado.lado) === 'antes' ? '→' : '←';
}

// A palavra da TELA para uma situação. O código diz `removido` e `igual`; o
// usuário lê "deletado" e "sem alteração" — é o que está na legenda, e é o que
// ficou registrado no Vocabulário.
//
// ⚠️ Existe porque a coluna *Situação* da Tabela do Pipeline imprimia a chave
// crua: a legenda dizia "deletado" e a linha logo abaixo dela dizia "removido",
// duas palavras para a mesma coisa a três centímetros uma da outra.
const BM_PALAVRAS = {
  removido: 'deletado',
  igual: 'sem alteração',
  alterado: 'mudou de ordem',   // no Pipeline, âmbar é ordem, não conteúdo
};

function bmPalavraDaSituacao(situacao) {
  return BM_PALAVRAS[situacao] || situacao;
}

function bmPar(esquerda, direita, rotuloEsq, rotuloDir, classeViewport = '') {
  // A ordem aqui é a regra do eixo em código: antes à esquerda, agora à
  // direita, sempre, em todos os formatos que têm dois lados.
  return `
    <div class="bm-par">
      <div class="bm-lado">
        <div class="bm-lado-h">${escapeHtml(rotuloEsq)} <span class="bm-lado-marca">antes</span></div>
        <div class="bm-viewport ${classeViewport}">${esquerda}</div>
      </div>
      <div class="bm-lado">
        <div class="bm-lado-h">${escapeHtml(rotuloDir)} <span class="bm-lado-marca">agora</span></div>
        <div class="bm-viewport ${classeViewport}">${direita}</div>
      </div>
    </div>`;
}

function bmRotuloDoLado(qual) {
  if (qual === 'antes') {
    const v = bmVersoes.find(x => x.id === bmDe);
    return v ? bkFormatarData(v.criada_em, v.id) : bmDe || '';
  }
  if (bmAte === 'atual') return 'Estado atual';
  const v = bmVersoes.find(x => x.id === bmAte);
  return v ? bkFormatarData(v.criada_em, v.id) : bmAte;
}

function bmMetadesAMostrar(dados) {
  // "Os dois" vira quatro quadrantes: duas metades, dois lados cada.
  return Object.keys(dados || {});
}

function bmNomeDaMetade(m) {
  return m === 'codigo' ? 'Código' : 'Documentação';
}
