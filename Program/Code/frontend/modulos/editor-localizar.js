// ═══════════════════════════ EDITOR: BUSCAR E SUBSTITUIR NO ARQUIVO (Ctrl+F) ══
// Molde emprestado de `terminal.js::_termRealcarBusca` — a mesma técnica, pelo
// mesmo motivo escrito lá: o realce é feito nos NÓS DE TEXTO já renderizados,
// nunca na string de HTML. Mexer no HTML cortaria as tags que o Prism acabou
// de criar, e o código apareceria com `<span class="tok` no meio.
//
// Duas coisas que o terminal não precisa e o editor sim:
//
//   · AS MARCAS MORREM A CADA REPINTURA. O <pre> é reconstruído em toda tecla
//     digitada NO CÓDIGO, então `editor-pintura.js` chama `reaplicar()` no fim
//     de cada pintura. Sem isso, o realce some assim que se digita uma letra.
//   · NAVEGAR ↑↓ NÃO PODE USAR `scrollIntoView`. O <pre> tem `overflow:
//     hidden` e é escravo do scroll do textarea; rolar o <pre> direto o
//     dessincroniza na hora. Lê-se `offsetTop` da marca e escreve-se no
//     `scrollTop` do textarea, deixando o ouvinte de rolagem arrastar o <pre>.
//
// ⚠️ DIGITAR NO CAMPO DE BUSCA NÃO CHAMA `pintura.repintar()`. Essa era a
// versão original — e ela reconstrói o `<pre>` inteiro via `Prism.highlight()`
// a cada tecla no campo, um recolorir do ARQUIVO INTEIRO só pra marcar uma
// busca. Em arquivo grande isso pisca a tela inteira a cada tecla — medido e
// reportado pelo usuário em 31/08/2026. `_limparMarcas()` abaixo desfaz só as
// marcas antigas (funde os nós de texto de volta), sem tocar na cor — muito
// mais barato, e sem o pisca-pisca.

// eslint-disable-next-line no-unused-vars
function criarLocalizador(superficie, barra) {
  const linhaBusca      = barra.querySelector('.ed-find-linha--busca');
  const campo           = linhaBusca.querySelector('[data-f="buscar"]');
  const contador        = barra.querySelector('.ed-find-contador');
  const btnExpandir     = barra.querySelector('[data-acao="expandir"]');
  const btnCaixa        = barra.querySelector('[data-acao="caixa"]');
  const linhaSubstituir = barra.querySelector('.ed-find-linha--substituir');
  const campoSubstituir = linhaSubstituir.querySelector('[data-f="substituir"]');

  let termo = '';
  let atual = 0;
  let aberta = false;
  let expandida = false;
  let comCaixa = false;   // diferenciar maiúsculas/minúsculas

  function _escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Desfaz as marcas de uma busca anterior sem tocar na cor: troca cada
  // `<mark>` pelo próprio texto e funde os nós de texto vizinhos de volta.
  // É o que substitui o `Prism.highlight()` inteiro que a versão antiga
  // chamava só pra "limpar" — ver o aviso no topo do arquivo.
  function _limparMarcas() {
    const marcas = superficie.pre.querySelectorAll('.ed-achado');
    if (!marcas.length) return;
    marcas.forEach((m) => { m.replaceWith(document.createTextNode(m.textContent)); });
    superficie.pre.normalize();
  }

  function contarEMarcar() {
    _limparMarcas();
    const alvo = termo.trim();
    if (!alvo) { escrever(0); return 0; }
    const comparar = (s) => (comCaixa ? s : s.toLowerCase());
    const buscado = comparar(alvo);
    const caminhante = document.createTreeWalker(superficie.pre, NodeFilter.SHOW_TEXT);
    const nos = [];
    while (caminhante.nextNode()) nos.push(caminhante.currentNode);

    let total = 0;
    nos.forEach((no) => {
      const texto = no.nodeValue;
      if (!comparar(texto).includes(buscado)) return;
      const comparado = comparar(texto);
      const frag = document.createDocumentFragment();
      let i = 0;
      for (;;) {
        const p = comparado.indexOf(buscado, i);
        if (p === -1) break;
        if (p > i) frag.appendChild(document.createTextNode(texto.slice(i, p)));
        const marca = document.createElement('mark');
        marca.className = 'ed-achado';
        marca.textContent = texto.slice(p, p + alvo.length);
        frag.appendChild(marca);
        total++;
        i = p + alvo.length;
      }
      if (i < texto.length) frag.appendChild(document.createTextNode(texto.slice(i)));
      no.parentNode.replaceChild(frag, no);
    });

    if (total && atual >= total) atual = total - 1;
    const marcas = superficie.pre.querySelectorAll('.ed-achado');
    if (marcas[atual]) marcas[atual].classList.add('ed-achado-atual');
    escrever(total);
    return total;
  }

  function escrever(total) {
    if (!termo.trim()) { contador.textContent = ''; return; }
    contador.textContent = total ? `${atual + 1} de ${total}` : 'nenhum';
  }

  function irPara(marca) {
    if (!marca) return;
    // `offsetTop` é relativo ao <pre>, que tem a mesma métrica do textarea —
    // é isso que faz o número servir para os dois. O `- 60` deixa a ocorrência
    // um pouco abaixo do topo em vez de colada nele.
    superficie.rolarPara(Math.max(0, marca.offsetTop - 60));
  }

  function pular(delta) {
    const marcas = superficie.pre.querySelectorAll('.ed-achado');
    if (!marcas.length) return;
    atual = (atual + delta + marcas.length) % marcas.length;
    marcas.forEach((m) => m.classList.remove('ed-achado-atual'));
    marcas[atual].classList.add('ed-achado-atual');
    escrever(marcas.length);
    irPara(marcas[atual]);
  }

  // ── Posições no TEXTO CRU (não no DOM) — é isso que a substituição usa.
  // As marcas do DOM servem só pra mostrar; a fonte da verdade pra escrever
  // é sempre `ta.value`. ──
  function _posicoes() {
    const alvo = termo.trim();
    if (!alvo) return [];
    const texto = superficie.ta.value;
    const comparar = (s) => (comCaixa ? s : s.toLowerCase());
    const comparado = comparar(texto);
    const buscado = comparar(alvo);
    const pos = [];
    let i = 0;
    for (;;) {
      const p = comparado.indexOf(buscado, i);
      if (p === -1) break;
      pos.push({ inicio: p, fim: p + alvo.length });
      i = p + alvo.length;
    }
    return pos;
  }

  function substituirUma() {
    const posicoes = _posicoes();
    if (!posicoes.length) return;
    const alvo = posicoes[Math.min(atual, posicoes.length - 1)];
    superficie.ta.focus();
    superficie.ta.setSelectionRange(alvo.inicio, alvo.fim);
    // `execCommand`, nunca `ta.value =` — é a única forma de escrever no
    // textarea sem zerar a pilha de desfazer nativa. Mesma regra de
    // `desindentar()` em editor-superficie.js.
    document.execCommand('insertText', false, campoSubstituir.value);
    contarEMarcar();
  }

  function substituirTodas() {
    const posicoes = _posicoes();
    if (!posicoes.length) return;
    const total = posicoes.length;
    const flags = comCaixa ? 'g' : 'gi';
    const regex = new RegExp(_escapeRegExp(termo.trim()), flags);
    const novo = superficie.ta.value.replace(regex, () => campoSubstituir.value);
    superficie.ta.focus();
    // UMA seleção (o arquivo inteiro) + UM `insertText` = UM passo de
    // desfazer: Ctrl+Z desfaz "substituir todas" de uma vez, não N vezes.
    superficie.ta.setSelectionRange(0, superficie.ta.value.length);
    document.execCommand('insertText', false, novo);
    atual = 0;
    contarEMarcar();
    showToast(`${total} substituição${total === 1 ? '' : 'ões'} feita${total === 1 ? '' : 's'}.`);
  }

  function alternarExpandir(forcar) {
    expandida = forcar !== undefined ? forcar : !expandida;
    linhaSubstituir.classList.toggle('hidden', !expandida);
    btnExpandir.textContent = expandida ? '▾' : '▸';
    btnExpandir.title = expandida ? 'Esconder substituir' : 'Mostrar substituir';
  }

  campo.addEventListener('input', () => {
    termo = campo.value;
    atual = 0;
    contarEMarcar();
  });
  campo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); pular(e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); api.fechar(); }
    else if (e.key === 'Tab' && !e.shiftKey && !expandida) {
      // Atalho do VS Code: Tab no campo de busca também abre o substituir.
      e.preventDefault();
      alternarExpandir(true);
      campoSubstituir.focus();
    }
  });
  campoSubstituir.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); substituirUma(); }
    else if (e.key === 'Escape') { e.preventDefault(); api.fechar(); }
  });
  btnExpandir.addEventListener('click', () => alternarExpandir());
  btnCaixa.addEventListener('click', () => {
    comCaixa = !comCaixa;
    btnCaixa.classList.toggle('active', comCaixa);
    if (termo.trim()) contarEMarcar();
  });
  barra.querySelector('[data-acao="anterior"]').addEventListener('click', () => pular(-1));
  barra.querySelector('[data-acao="proxima"]').addEventListener('click', () => pular(1));
  barra.querySelector('[data-acao="fechar"]').addEventListener('click', () => api.fechar());
  barra.querySelector('[data-acao="substituir-um"]').addEventListener('click', substituirUma);
  barra.querySelector('[data-acao="substituir-todas"]').addEventListener('click', substituirTodas);

  const api = {
    abrir() {
      aberta = true;
      barra.classList.remove('hidden');
      campo.focus();
      campo.select();
    },
    fechar() {
      aberta = false;
      barra.classList.add('hidden');
      termo = '';
      atual = 0;
      contador.textContent = '';
      _limparMarcas();
      superficie.focar();
    },
    alternar() { if (aberta) api.fechar(); else api.abrir(); },
    // Chamado no fim de cada pintura DO CÓDIGO — é o que faz o realce
    // sobreviver à digitação real (não à digitação no campo de busca, que já
    // chama `contarEMarcar` direto). Sem termo, não faz nada e sai barato.
    reaplicar() { if (aberta && termo.trim()) contarEMarcar(); },
    get aberta() { return aberta; },
  };
  return api;
}
