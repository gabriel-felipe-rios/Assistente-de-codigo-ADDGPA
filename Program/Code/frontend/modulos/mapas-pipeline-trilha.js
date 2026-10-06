// ═══════════════════════ VISUALIZAR PIPELINE — TRILHA DE CADEIAS ══
// A coluna da esquerda: lista as cadeias e diz o tamanho de cada uma.
//
// Ela existe porque as leituras desenhavam as cadeias TODAS de uma vez. No
// projeto de teste isso é 199 passos numa rolagem só, e a cadeia C9 sozinha
// tem 143 deles — a tela virava parede de texto antes de dizer qualquer coisa.
// Agora o palco desenha uma cadeia por vez e a trilha é quem escolhe.
//
// De quebra ela resolve outra coisa: a premissa antiga era que as cores de
// cadeia "só aparecem juntas na leitura Fases, que tem legenda". Com a trilha
// à vista o tempo todo, as nove aparecem juntas sempre — e a trilha É a
// legenda, com o número escrito no pino.
//
// O par de referência é a aba Documentação (lista de itens à esquerda,
// conteúdo à direita), não o trilho de Configurações: aqui se escolhe um item
// de DADO, não uma área do programa.

// Acima disto a cadeia abre em fases. Não é enfeite: a C9 tem 66 arquivos, e
// mesmo sozinha no palco ela não cabe em nenhuma das leituras. Abaixo do
// limiar, oferecer fases seria fatiar o que já cabia inteiro.
const VP_LIMIAR_PASSOS = 40;
const VP_LIMIAR_ARQUIVOS = 25;

function vpCadeiaEhGrande(cadeia) {
  return cadeia.passos.length > VP_LIMIAR_PASSOS
      || vpArquivosDosPassos(cadeia.passos).length > VP_LIMIAR_ARQUIVOS;
}

function vpCadeiaSelecionada() {
  if (!_vpDados || !_vpDados.cadeias.length) return null;
  return _vpDados.cadeias.find(c => c.n === _vpCadeia) || _vpDados.cadeias[0];
}

// Os passos que o palco deve desenhar: a cadeia inteira, ou só uma fase dela
// quando o usuário recortou pela trilha.
function vpPassosEmFoco(cadeia) {
  if (!_vpFase) return cadeia.passos;
  return cadeia.passos.filter(p => p.fase === _vpFase);
}

function vpDesenharTrilha() {
  const trilha = document.getElementById('vp-trilha');
  if (!trilha || !_vpDados) return;

  const cadeias = _vpDados.cadeias || [];
  const filtra = VP_LEITURAS_TODAS.has(_vpLeitura);   // Cadeias e Fases: a trilha filtra
  const metricas = vpMetricas(cadeias);

  // "Todas" só existe nas duas leituras que sabem desenhar mais de uma cadeia
  // ao mesmo tempo. Nas outras seria um botão que não faz nada.
  const todas = filtra ? `
    <button class="vp-trilha-item ${_vpCadeia === 0 ? 'ativo' : ''}" data-cadeia="0">
      <div class="vp-trilha-l1"><span class="vp-trilha-nome">Todas as cadeias</span></div>
      <div class="vp-trilha-l2">${metricas.passos} passos · ${metricas.ligacoes} ligações</div>
    </button>` : '';

  trilha.innerHTML = '<div class="vp-trilha-titulo">Cadeias</div>' + todas + cadeias.map(cadeia => {
    const selecionada = cadeia.n === _vpCadeia;
    const fases = vpFasesDosPassos(cadeia.passos);
    const emoji = vpEmojiDaCadeia(cadeia);
    const doModelo = vpNomeDoModelo(cadeia);

    // Sub-itens de fase: só na cadeia grande E só quando ela é a selecionada.
    // Mostrar as fases de todas as nove seria trocar uma lista longa por outra.
    const sub = (!filtra && selecionada && vpCadeiaEhGrande(cadeia)) ? `
      <div class="vp-trilha-sub">
        <button class="vp-trilha-fase ${_vpFase === 0 ? 'ativo' : ''}" data-fase="0">Tudo</button>
        ${fases.map(f => `<button class="vp-trilha-fase ${_vpFase === f ? 'ativo' : ''}"
          data-fase="${f}" title="${cadeia.passos.filter(p => p.fase === f).length} passos">F${f}</button>`).join('')}
      </div>` : '';

    return `
      <button class="vp-trilha-item vp-cadeia-${(cadeia.n - 1) % 9} ${selecionada ? 'ativo' : ''}"
              data-cadeia="${cadeia.n}" title="${escapeHtml(cadeia.cabeca || cadeia.nome)}">
        <div class="vp-trilha-l1">
          <span class="vp-pino">C${cadeia.n}</span>
          <span class="vp-trilha-nome">${emoji ? emoji + ' ' : ''}${escapeHtml(vpRotuloDaCadeia(cadeia))}</span>
        </div>
        <div class="vp-trilha-l2">
          ${cadeia.passos.length} passos ·
          <span class="vp-conta-travessias">${vpContarTravessias(cadeia.passos)} trav.</span>
          ${doModelo ? ' · ' + escapeHtml(doModelo) : ''}
        </div>
        <div class="vp-trilha-fases">${[1, 2, 3, 4, 5]
          .map(f => `<span class="${fases.includes(f) ? 'on' : ''}"></span>`).join('')}</div>
      </button>${sub}`;
  }).join('');
}

// Delegação num listener só: a trilha é remontada a cada desenho, e ligar
// botão por botão empilharia listeners a cada troca de leitura.
function vpLigarTrilha() {
  const trilha = document.getElementById('vp-trilha');
  if (!trilha) return;
  trilha.addEventListener('click', evento => {
    const fase = evento.target.closest('.vp-trilha-fase');
    if (fase) { _vpFase = Number(fase.dataset.fase); vpDesenhar(); return; }
    const item = evento.target.closest('.vp-trilha-item');
    if (!item) return;
    const numero = Number(item.dataset.cadeia);
    // Trocar de cadeia zera o recorte de fase: a fase 3 de uma cadeia não tem
    // relação nenhuma com a fase 3 da outra.
    if (numero !== _vpCadeia) _vpFase = 0;
    _vpCadeia = numero;
    vpDesenhar();
  });
}
