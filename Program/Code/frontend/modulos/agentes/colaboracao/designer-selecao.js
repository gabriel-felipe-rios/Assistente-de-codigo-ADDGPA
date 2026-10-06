/* ═══════════════════════════════ DESIGNER — a aba Seleção ══ */
//
// O resumo do que vai junto no pedido: **uma linha por dimensão escolhida**, com
// o nome do que foi escolhido — e só isso. Dimensão vazia não ocupa linha: uma
// lista de "nada escolhido" não informa, só empurra a prévia para baixo.
//
// Clicar numa escolha abre o campo de COMENTÁRIO dela. O comentário viaja junto
// no prompt e vence a regra padrão do bloco daquela dimensão — "essa textura eu
// quero que seja aplicada só no botão principal". Opcional de verdade: sem
// clique não aparece campo nenhum, e mandar sem comentário é o caminho normal.

function renderSelecaoDesign() {
  const corpo = document.getElementById('dsel-corpo');
  if (!corpo || !_designOrdem.length) return;
  corpo.innerHTML = '';

  const comEscolha = _designOrdem.filter(d => _dselEscolhas(d).length);
  if (!comEscolha.length) {
    corpo.innerHTML = `<div class="arq-empty">
      Nada escolhido ainda. Abra <strong>Estilos</strong>, <strong>Cores</strong>,
      <strong>Tipografia</strong>, <strong>Texturas</strong> ou <strong>Animações</strong>
      e escolha o que vai junto no pedido.</div>`;
  } else {
    const lista = document.createElement('div');
    lista.className = 'dsel-lista';
    for (const d of comEscolha) lista.appendChild(_dselLinha(d));
    corpo.appendChild(lista);
  }

  corpo.appendChild(_dselPrevia());
  corpo.appendChild(_dselAcoes());
}

function _dselEscolhas(d) {
  const chaves = d.unica
    ? (escolhasDoDesigner[d.campo] ? [escolhasDoDesigner[d.campo]] : [])
    : (escolhasDoDesigner[d.campo] || []);
  return chaves.map(c => itemPelaChave(d.dimensao, c)).filter(Boolean);
}

function _dselLinha(d) {
  const linha = document.createElement('div');
  linha.className = 'dsel-linha';
  linha.innerHTML = `<span class="dsel-dim">${escapeHtml(d.rotulo)}</span>`;
  const escolhas = document.createElement('div');
  escolhas.className = 'dsel-escolhas';
  for (const item of _dselEscolhas(d)) escolhas.appendChild(_dselEscolha(item));
  linha.appendChild(escolhas);
  return linha;
}

// Uma escolha: o nome, e o comentário que abre ao clicar. O nome aparece UMA vez
// — antes ele saía na linha da dimensão e de novo no item logo abaixo.
function _dselEscolha(item) {
  const comentario = (escolhasDoDesigner.comentarios || {})[item.caminho] || '';
  const bloco = document.createElement('div');
  bloco.className = 'dsel-escolha' + (comentario ? ' comentada' : '');
  bloco.innerHTML = `
    <button type="button" class="dsel-nome" title="Clique para comentar este item">
      ${escapeHtml(item.nome)}${comentario ? '<span class="dsel-marca">✎</span>' : ''}
    </button>
    <div class="dsel-coment hidden">
      <textarea rows="2" placeholder="Ex.: aplicar só no botão principal, não no fundo">${escapeHtml(comentario)}</textarea>
    </div>`;

  const caixa = bloco.querySelector('.dsel-coment');
  const campo = bloco.querySelector('textarea');
  bloco.querySelector('.dsel-nome').addEventListener('click', () => {
    caixa.classList.toggle('hidden');
    if (!caixa.classList.contains('hidden')) campo.focus();
  });
  // ⚠️ A sessão é anotada na MONTAGEM, e não lida no `blur`. A tela é remontada a
  // cada troca de sessão, então este campo pertence à sessão que estava aberta
  // quando ele nasceu — e o `blur` costuma disparar justamente porque o usuário
  // clicou noutra, com `currentDesignChatId` já mudado. Anotar aqui não depende de
  // evento nenhum ter chegado.
  const sessaoDoCampo = currentDesignChatId;
  // Grava ao sair do campo, não a cada tecla: uma gravação por caractere
  // atravessaria a ponte pywebview dezenas de vezes por frase.
  campo.addEventListener('blur', () => {
    const texto = campo.value.trim();
    if (texto) escolhasDoDesigner.comentarios[item.caminho] = texto;
    else delete escolhasDoDesigner.comentarios[item.caminho];
    bloco.classList.toggle('comentada', !!texto);
    salvarEscolhasDaSessao(sessaoDoCampo || currentDesignChatId);
    if (typeof marcarContextoDesatualizado === 'function') marcarContextoDesatualizado();
  });
  return bloco;
}

// A combinação junta: o estilo escolhido, tingido com a paleta escolhida. É a
// única prévia que mostra as duas decisões ao mesmo tempo, que é justamente o
// que nenhuma das abas de dimensão consegue mostrar sozinha.
function _dselPrevia() {
  const caixa = document.createElement('div');
  caixa.className = 'dsel-previa';
  const estilo = escolhasDoDesigner.estilo ? itemPelaChave('estilos', escolhasDoDesigner.estilo) : null;
  caixa.innerHTML = '<div class="dsel-previa-rot">Como a combinação fica junta</div>';
  if (!estilo) {
    caixa.innerHTML += '<div class="arq-empty">Escolha um estilo para ver a prévia.</div>';
    return caixa;
  }
  const moldura = document.createElement('div');
  moldura.className = 'dsel-previa-moldura';
  const quadro = document.createElement('iframe');
  quadro.className = 'dsel-previa-quadro';
  quadro.setAttribute('scrolling', 'no');
  quadro.setAttribute('tabindex', '-1');
  // A paleta DEPOIS do conteúdo: o arquivo traz o próprio `:root`, e quem vem
  // por último vence. Injetada antes, ela nunca valia e a prévia saía sempre na
  // cor de reserva.
  quadro.srcdoc = estilo.conteudo + cssDaPaletaEscolhida();
  moldura.appendChild(quadro);
  caixa.appendChild(moldura);
  return caixa;
}

// UM botão só. "Enviar ao Designer", "Salvar como padrão do projeto" e "Usar o
// padrão do projeto" saíram em 2026-08-25 a pedido do usuário: a fileira de abas
// já leva de volta ao chat, e um padrão por projeto competia com a escolha por
// sessão sem ganho nenhum.
function _dselAcoes() {
  const acoes = document.createElement('div');
  acoes.className = 'dsel-acoes';
  acoes.innerHTML = `
    <button type="button" class="btn btn-muted btn-sm dsel-copiar">📋 Copiar prompt</button>
    <span class="dsel-nota">As escolhas valem só para esta sessão, e são gravadas a cada clique.</span>`;
  acoes.querySelector('.dsel-copiar').addEventListener('click', copiarPedidoDoDesigner);
  return acoes;
}

// Copia o pedido INTEIRO — system e usuário — do jeito que ele iria ao LM Studio,
// para o mesmo pedido poder ser testado noutro modelo. O arquivo da sessão é JSON
// com o HTML das variações dentro: dá para abrir, mas não para ler nem para colar.
//
// ⚠️ Quem monta é o BACKEND, pelo mesmo caminho da geração. Montar aqui daria dois
// textos, e eles divergiriam na primeira mudança de bloco.
async function copiarPedidoDoDesigner() {
  if (!currentProject || !currentDesignChatId) {
    showToast('Abra uma sessão antes de copiar o prompt.', true);
    return;
  }
  // Comentário ainda sendo digitado grava no `blur`: sem este empurrão o texto do
  // campo com foco não entraria no que está sendo copiado.
  await _dselGravarOQueEstaSendoDigitado();

  const entrada = document.getElementById('design-input');
  const pedido = entrada ? entrada.value.trim() : '';
  const base = (typeof selectedDesignVariation !== 'undefined' && selectedDesignVariation)
    ? selectedDesignVariation.html : '';

  let r;
  try {
    r = await window.pywebview.api.montar_pedido_do_designer(
      currentProject, currentDesignChatId, pedido, base);
  } catch (e) { r = null; }
  if (!r || !r.success) {
    showToast('Não foi possível montar o prompt' + (r && r.error ? ': ' + r.error : '.'), true);
    return;
  }
  // Sem pedido escrito o texto sai só com o system: dizer isso evita colar noutro
  // modelo um prompt sem a pergunta e achar que o programa manda assim.
  await copiarContexto(r.texto, pedido
    ? 'Prompt copiado — system e pedido, como iria ao modelo.'
    : 'Prompt copiado. O pedido está vazio: escreva na aba Designer para incluí-lo.');
}

// Tira o foco do campo em edição e deixa o `blur` gravar antes de seguir.
function _dselGravarOQueEstaSendoDigitado() {
  const ativo = document.activeElement;
  if (ativo && ativo.tagName === 'TEXTAREA' && ativo.closest('.dsel-coment')) ativo.blur();
  return new Promise(r => setTimeout(r, 0));
}
