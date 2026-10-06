// ═══ BACKUPS → Mapa da mudança → Pipeline (5 leituras) ═════════════════════
//
// 1 · Fases     — colunas por fase, cartão com borda na cor da cadeia
// 2 · Raias     — faixa por camada, coluna = profundidade
// 3 · Sequência — arquivo vira coluna com linha de vida, o tempo desce
// 4 · Tabela    — a ordem de execução vira número, duas colunas
// 5 · Fita      — as duas execuções empilhadas
//
// ⚠️ AS TRÊS PRIMEIRAS SÃO **AS MESMAS FUNÇÕES** do Assistente → Visualizar
// pipeline: `vpFases`, `vpRaias` e `vpSequencia`. Elas não são imitadas aqui —
// são chamadas. O que faltava para isso era um gancho de cor por passo, que
// entrou lá como parâmetro opcional (`classeDoPasso`) com valor padrão vazio:
// a sub-aba do Assistente continua idêntica, e o Mapa da mudança passa a
// pintar cada passo de criado/removido.
//
// Toda a biblioteca de dados também vem de lá (`mapas-pipeline-dados.js`):
// `VP_CAMADAS`, `vpClasseDeCamada`, `vpNomeBase`, `vpMontarFoco`, `vpMetricas`.
// As cópias que este arquivo tinha (`BM_CAMADAS`, `bmNomeDoArquivo`) foram
// apagadas — duas fontes da verdade para a mesma pergunta divergem com o tempo.
//
// ⚠️ RAIAS E SEQUÊNCIA DESENHAM **UMA** CADEIA, escolhida na trilha — como no
// original. Antes elas empilhavam todas, nos dois painéis: a C9 do projeto de
// teste tem 143 passos, e nove cadeias empilhadas em dois painéis é uma parede
// de desenho antes de dizer qualquer coisa. A trilha mora em
// `backups-mapa-trilha.js`, e o porquê de ela não ser a do original está lá.
//
// ⚠️ A **Fita** é a única que quebra a regra do eixo, e de propósito: o fluxo
// dela corre na horizontal, então a comparação só cabe na vertical. Casa de
// largura fixa, e as duas fitas no mesmo bloco de rolagem.
//
// ⚠️ Três leituras foram desenhadas e RECUSADAS: *Trilho pareado*, *Cadeias* e
// *Narrativa*. Não recriar.

async function bmDesenharPipeline(area) {
  const r = await window.pywebview.api.mapa_pipeline(
    currentProject, bmDe, bmAte, bmVariante.pipeline);
  if (!r.success) throw new Error(r.error);

  const indisponivel = [r.antes, r.agora].find(l => !l.disponivel);
  if (indisponivel) {
    area.innerHTML = `<div class="bm-vazio">${escapeHtml(indisponivel.motivo || '')}</div>`;
    document.getElementById('bm-trilha').innerHTML = '';
    bmEstatistica('');
    return;
  }

  bmEstatistica(
    `${r.resumo.criados} passos novos · ${r.resumo.removidos} removidos · ` +
    `${r.resumo.mantidos} mantidos` +
    (r.agora.tem_frases ? '' : ' · sem as frases do pipeline.md'));

  if (bmTemTrilha()) bmDesenharTrilha(r);

  bmRedesenharNoResize = null;
  const v = bmVariante.pipeline;
  if (v === 'raias') return bmPipelineVp(area, r, 'raias');
  if (v === 'sequencia') return bmPipelineVp(area, r, 'sequencia');
  if (v === 'tabela') return bmPipelineTabela(area, r);
  if (v === 'fita') return bmPipelineFita(area, r);
  return bmPipelineVp(area, r, 'fases');
}

// O gancho de cor: a identidade de um passo é a trinca (origem, destino, via),
// e é ela que o back-end marcou como criado/removido/igual.
//
// ⚠️ ELE É CHAMADO PARA DUAS COISAS DIFERENTES. Nas ligações vem um passo, que
// tem situação. Nos NÓS das Raias vem `{origem: arquivo, destino: arquivo,
// arquivo}` — um objeto de mentira, montado só para pedir uma classe, sem
// `situacao` e sem `passos`. Ele caía em `bmClasseDaSituacao(undefined)`, que
// devolve `bm-igual`: **todo nó de raia era sempre cinza**, e a legenda
// prometia verde e vermelho que não existiam em lugar nenhum da tela.
//
// Um arquivo não tem situação própria — ele não é um passo. A dele vem das
// ligações que o tocam: se todas nasceram nesta Versão, ele nasceu junto; se
// todas sumiram, ele sumiu junto; se há de tudo, ele continua lá e o que mudou
// foi em volta. É a mesma conta que o olho faria.
function bmClasseDoPasso(ligacao) {
  if (ligacao && ligacao.arquivo && ligacao.origem === ligacao.destino) {
    return bmClasseDaSituacao(bmSituacaoDoNo.get(ligacao.arquivo));
  }
  const passo = (ligacao.passos && ligacao.passos[0]) || ligacao;
  return bmClasseDaSituacao(passo.situacao);
}

// `arquivo → situacao`, refeito a cada desenho de Raias. Mapa de módulo porque
// `bmClasseDoPasso` é um callback: quem o chama é `vpRaias`, lá dentro do
// Visualizar pipeline, e não há por onde passar contexto.
let bmSituacaoDoNo = new Map();

function bmMapearSituacaoDosNos(foco) {
  bmSituacaoDoNo = new Map();
  const vistos = new Map();
  (foco.ligacoes || []).forEach(l => {
    const passo = (l.passos && l.passos[0]) || l;
    [l.origem, l.destino].forEach(arquivo => {
      if (!arquivo) return;
      if (!vistos.has(arquivo)) vistos.set(arquivo, new Set());
      vistos.get(arquivo).add(passo.situacao || 'igual');
    });
  });
  vistos.forEach((situacoes, arquivo) => {
    bmSituacaoDoNo.set(arquivo,
      situacoes.size === 1 ? [...situacoes][0] : 'igual');
  });
}

function bmFocos(cadeias) {
  // `agrupar = false`: cada ligação carrega UM passo, e o gancho de cor casa
  // um para um. Agrupar juntaria passos de situações diferentes no mesmo
  // cartão, e a cor deixaria de significar alguma coisa.
  return (cadeias || []).map(c => vpMontarFoco(c, c.passos, false));
}

// A faixa de números de um lado — as mesmas cinco métricas e as mesmas classes
// do cabeçalho do Visualizar pipeline. Aqui elas aparecem DUAS vezes, uma por
// Versão: é a leitura mais rápida de "o fluxo cresceu ou encolheu?".
function bmMetricasDoLado(lado) {
  if (typeof vpMetricas !== 'function') return '';
  const m = vpMetricas(lado.cadeias || []);
  const cartao = (classe, valor, rotulo, dica) =>
    `<div class="vp-metrica ${classe}" title="${escapeHtml(dica)}"><b>${valor}</b><span>${rotulo}</span></div>`;
  return `<div class="vp-metricas bm-metricas">
    ${cartao('vp-m-cadeias', m.cadeias, 'cadeias', 'Fluxos independentes: nenhum passo de uma cadeia entra em outra')}
    ${cartao('vp-m-passos', m.passos, 'passos', 'Cada chamada individual encontrada no código')}
    ${cartao('vp-m-ligacoes', m.ligacoes, 'ligações', 'Pares origem→destino distintos, depois de agrupar os repetidos')}
    ${cartao('vp-m-travessias', m.travessias, 'travessias', 'Passos em que o fluxo muda de camada')}
    ${cartao('vp-m-fases', m.fases, 'fases', 'Profundidade do fluxo: a fase 1 é o que dispara, a última é o que fecha')}
  </div>`;
}

// `vpTituloDoDesenho` lê UM global da sub-aba do Assistente: `_vpFase`, o
// recorte de fase, que ela mostra como etiqueta. Aqui não existe recorte de
// fase, e se o usuário tiver deixado um ligado lá, a etiqueta apareceria neste
// desenho dizendo uma coisa que não é verdade. Zerar e devolver é o contrato
// mínimo: nada do outro lado fica alterado depois da chamada.
function bmTituloDaCadeia(foco) {
  const guardado = _vpFase;
  _vpFase = 0;
  try {
    return vpTituloDoDesenho(foco);
  } finally {
    _vpFase = guardado;
  }
}

// ── 1, 2 e 3 · As leituras que vêm do Visualizar pipeline ───────────────────

function bmPipelineVp(area, r, leitura) {
  const uniao = bmCadeiasDaUniao(r);
  // Fases mostra todas as cadeias (a legenda é quem filtra); Raias e Sequência
  // mostram uma, escolhida na trilha. É a divisão do original.
  const escolhida = leitura === 'fases' ? null : bmCadeiaEscolhida(uniao);
  const n = escolhida ? escolhida.n : bmCadeiaEmFoco;
  // A cor da cadeia mora numa classe do CONTAINER (`--vp-cor`), e é dela que
  // saem o pino, a tarja do cartão e a borda da linha do tempo. Sem a classe no
  // viewport, tudo isso cai na cor de reserva e a cadeia perde a identidade.
  const corDoPainel = n ? `vp-cadeia-${(n - 1) % 9}` : '';

  const desenhar = (chave) => {
    const lado = r[chave];
    if (leitura === 'fases') {
      // Com uma cadeia em foco, a leitura Fases isola essa cadeia — e a
      // legenda fica com as outras apagadas. Igual ao original.
      const cadeias = bmCadeiaEmFoco
        ? (lado.cadeias || []).filter(c => c.n === bmCadeiaEmFoco)
        : (lado.cadeias || []);
      const focos = bmFocos(cadeias);
      if (!focos.length) return '<p class="vp-vazio">Sem cadeias deste lado.</p>';
      // `vpFases` já traz a própria legenda e o próprio `.vp-quadro` — embrulhar
      // de novo daria dois quadros aninhados e quebraria a rolagem da coluna.
      return bmMetricasDoLado(lado) +
             vpFases(focos, bmClasseDoPasso, lado.cadeias, bmCadeiaEmFoco || null);
    }

    const cadeia = escolhida && escolhida[chave];
    if (!cadeia) {
      return `<p class="vp-vazio">Esta cadeia não existe nesta Versão.</p>`;
    }
    const foco = vpMontarFoco(cadeia, cadeia.passos, false);
    // Antes de desenhar: é `vpRaias` quem chama `bmClasseDoPasso` para cada nó,
    // e o mapa precisa estar pronto quando isso acontecer.
    bmMapearSituacaoDosNos(foco);
    // O cabeçalho da cadeia é O MESMO do original (`vpTituloDoDesenho`): pino,
    // nome, cabeça e as etiquetas de passos, ligações, arquivos e travessias.
    // A linha solta que estava aqui no lugar dele era metade da informação.
    return bmTituloDaCadeia(foco) + (leitura === 'raias'
      // O `.vp-raias` é o bloco de rolagem horizontal do SVG — o próprio
      // Visualizar pipeline embrulha assim, e sem ele o desenho largo é
      // recortado em vez de rolar.
      ? `<div class="vp-raias">${vpRaias(foco, bmClasseDoPasso)}</div>`
      : vpSequencia(foco, bmClasseDoPasso));
  };

  area.innerHTML = bmPar(desenhar('antes'), desenhar('agora'),
                         bmRotuloDoLado('antes'), bmRotuloDoLado('agora'),
                         `bm-viewport--rola ${corDoPainel}`);
  area.querySelectorAll('.bm-viewport').forEach(vp => {
    const dentro = document.createElement('div');
    dentro.className = 'bm-zoomavel';
    while (vp.firstChild) dentro.appendChild(vp.firstChild);
    vp.appendChild(dentro);
  });
  bmLigarZoomHtml(area);
  bmLigarLegendaDeCadeias(area);
  area.querySelectorAll('.bm-viewport').forEach(bmPodarRotulos);
}

// A legenda de cadeias da leitura Fases É filtro — no original ela é, e aqui a
// dela estava desenhada e morta: clicar não fazia nada. Clicar isola a cadeia
// nos DOIS painéis ao mesmo tempo; clicar de novo volta para todas.
function bmLigarLegendaDeCadeias(area) {
  // `#bm-area` sobrevive ao redesenho — sem a marca, cada desenho penduraria
  // mais um listener no mesmo elemento.
  if (area.dataset.legendaLigada) return;
  area.dataset.legendaLigada = '1';
  area.addEventListener('click', ev => {
    const alvo = ev.target.closest('[data-legenda]');
    if (!alvo) return;
    const n = Number(alvo.dataset.legenda);
    bmCadeiaEmFoco = (bmCadeiaEmFoco === n) ? 0 : n;
    bmDesenhar();
  });
}

// ── 4 · Tabela ──────────────────────────────────────────────────────────────

// Quem de fato saiu do lugar.
//
// ⚠️ A CONTA É DA ORDEM **RELATIVA**, e não do número absoluto. Comparar `n`
// com `n` fazia um passo novo lá no começo empurrar todos os outros: a tabela
// inteira virava "mudou de ordem", e a coluna Situação parava de informar
// qualquer coisa — foi a queixa "é engraçado que ele está falando que um monte
// foi alterado".
//
// O que importa é a posição de cada passo **entre os passos que os dois lados
// têm**. Inserir e remover deixam de contar; o que sobra marcado é o passo que
// realmente trocou de lugar com outro.
function bmOrdemRelativa(a, b) {
  const comuns = [...a.keys()].filter(k => b.has(k));
  const porAntes = comuns.slice().sort((x, y) => a.get(x).n - a.get(y).n);
  const porAgora = comuns.slice().sort((x, y) => b.get(x).n - b.get(y).n);
  const mudaram = new Set();
  porAntes.forEach((k, i) => { if (porAgora[i] !== k) mudaram.add(k); });
  return mudaram;
}

function bmPipelineTabela(area, r) {
  // A ordem de execução vira NÚMERO, nas duas colunas. É a leitura que responde
  // "este passo saiu do lugar?" sem obrigar a seguir uma seta com o dedo.
  const chave = p => `${p.origem}→${p.destino}·${p.via}`;
  const posicao = lado => new Map(lado.passos.map((p, i) => [chave(p), { p, n: i + 1 }]));
  const a = posicao(r.antes), b = posicao(r.agora);
  const todas = [...new Set([...a.keys(), ...b.keys()])];
  const relativa = bmOrdemRelativa(a, b);

  area.innerHTML = `
    <div class="bm-viewport bm-viewport--rola">
      <div class="bm-zoomavel">
        <table class="bm-tabela">
          <thead><tr>
            <th class="bm-tab-n">${escapeHtml(bmRotuloDoLado('antes'))}<br><span class="bm-lado-marca">antes</span></th>
            <th class="bm-tab-n">${escapeHtml(bmRotuloDoLado('agora'))}<br><span class="bm-lado-marca">agora</span></th>
            <th>Passo</th><th>Via</th><th>Situação</th>
          </tr></thead>
          <tbody>
            ${todas.map(k => {
              const ea = a.get(k), eb = b.get(k);
              const p = (eb || ea).p;
              const situacao = !ea ? 'criado' : !eb ? 'removido'
                             : (relativa.has(k) ? 'alterado' : 'igual');
              return `
                <tr class="${bmClasseDaSituacao(situacao)}">
                  <td class="bm-tab-n">${ea ? ea.n : '—'}</td>
                  <td class="bm-tab-n">${eb ? eb.n : '—'}</td>
                  <td class="bm-rot" title="${escapeHtml(p.origem + ' → ' + p.destino)}">
                    <span class="bm-cam ${vpClasseDeCamada(p.origem)}">${escapeHtml(vpNomeBase(p.origem))}</span>
                    → <span class="bm-cam ${vpClasseDeCamada(p.destino)}">${escapeHtml(vpNomeBase(p.destino))}</span></td>
                  <td class="bm-rot">${escapeHtml(p.via)}</td>
                  <td>${bmPalavraDaSituacao(situacao)}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  bmLigarZoomHtml(area);
}

// ── 5 · Fita ────────────────────────────────────────────────────────────────

function bmPipelineFita(area, r) {
  // As duas execuções EMPILHADAS, no mesmo bloco de rolagem. É a única que
  // quebra a regra do eixo, e é de propósito: o fluxo corre na horizontal, e
  // então a comparação tem de acontecer na vertical.
  const fita = (lado, rotulo, marca) => `
    <div class="bm-fita">
      <div class="bm-fita-h">${escapeHtml(rotulo)} <span class="bm-lado-marca">${marca}</span></div>
      <div class="bm-fita-trilho">
        ${lado.passos.map(p => `
          <div class="bm-casa vp-cadeia-${((p.cadeia || 1) - 1) % 9} ${bmClasseDaSituacao(p.situacao)}"
               title="${escapeHtml(p.origem)} → ${escapeHtml(p.destino)} via ${escapeHtml(p.via)}">
            <div class="bm-casa-n">${p.ordem}</div>
            <div class="bm-casa-arq bm-cam ${vpClasseDeCamada(p.origem)} bm-rot">${escapeHtml(vpNomeBase(p.origem))}</div>
            <div class="bm-casa-via bm-rot">${escapeHtml(p.via)}</div>
            <div class="bm-casa-arq bm-cam ${vpClasseDeCamada(p.destino)} bm-rot">${escapeHtml(vpNomeBase(p.destino))}</div>
          </div>`).join('')}
      </div>
    </div>`;

  area.innerHTML = `
    <div class="bm-fitas">
      <div class="bm-zoomavel">
        ${fita(r.antes, bmRotuloDoLado('antes'), 'antes')}
        ${fita(r.agora, bmRotuloDoLado('agora'), 'agora')}
      </div>
      <div class="bm-fita-nota">
        Esta é a única leitura empilhada: o fluxo corre na horizontal, então a
        comparação acontece na vertical. As duas fitas rolam juntas — em dois
        blocos separados elas desalinhariam.
      </div>
    </div>`;
  bmLigarZoomHtml(area);
  bmPodarRotulos(area.querySelector('.bm-fitas'));
}
