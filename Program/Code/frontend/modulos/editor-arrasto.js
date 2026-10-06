// ═══════════════════ EDITOR: ARRASTAR A ABA PARA DIVIDIR ══
// Segurar uma aba de arquivo e soltar na metade esquerda ou direita divide a
// tela com aquele arquivo daquele lado. Soltar no meio move sem dividir; soltar
// na barra de abas reordena.
//
// ⚠️ PONTEIRO, E NÃO ARRASTE HTML5. Três motivos, e o primeiro é decisivo:
//
//   1. `explorer.py::_start_drag_monitor` faz *polling global* do botão do
//      mouse e, 300 ms depois de ele descer, pergunta ao Shell do Windows o que
//      está sendo arrastado — é o mecanismo de arrastar arquivo DE FORA para
//      dentro do programa. Um arraste HTML5 aqui dentro é exatamente esse
//      gesto, e `drag-drop.js` ainda ocupa `drop`/`dragover` no documento.
//      Ponteiro não entra nesse caminho.
//   2. `divisoria.js` já provou o molde neste projeto: `setPointerCapture` em
//      `try/catch`, `pointercancel` tratado, classe no `body`.
//   3. O arraste HTML5 não dá controle da imagem arrastada nem coordenada
//      confiável em todos os caminhos do WebView2.
//
// ⚠️ LIMIAR DE 5px antes de virar arraste. Sem ele, o clique de trocar de
// arquivo, o clique do meio que fecha e o × deixam de funcionar — todos são
// pointerdown seguido de pointerup no mesmo lugar.
//
// ⚠️ MOVER, NUNCA COPIAR. É o que preserva a proibição de o mesmo arquivo estar
// aberto nos dois lados (ver o topo de `editor.js`). O objeto do arquivo viaja
// inteiro, com o buffer não salvo junto.

const _EDARR_LIMIAR = 5;

// eslint-disable-next-line no-unused-vars
function ligarArrastoDeAbas(cfg) {
  // cfg = { area, paineis, aoMover(arq, painelDestino, indice),
  //         aoDividir(arq, lado) }
  let estado = null;   // { arq, origem, x0, y0, arrastando, fantasma, overlay }

  function limpar() {
    if (!estado) return;
    if (estado.fantasma) estado.fantasma.remove();
    if (estado.overlay) estado.overlay.remove();
    document.body.classList.remove('ed-arrastando');
    estado = null;
  }

  function overlayDaZona(zona) {
    const area = cfg.area.getBoundingClientRect();
    const el = estado.overlay;
    if (!zona || zona.tipo === 'nada') { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    if (zona.tipo === 'barra') {
      // Cursor de inserção fino, entre as abas.
      const r = zona.retangulo;
      el.className = 'ed-arr-overlay ed-arr-overlay--insercao';
      el.style.cssText = `left:${r.left}px;top:${r.top}px;width:2px;height:${r.height}px`;
      return;
    }
    el.className = 'ed-arr-overlay';
    const meio = zona.tipo === 'mover';
    const metade = area.width / 2;
    el.style.cssText = `left:${zona.lado === 'direita' && !meio ? area.left + metade : area.left}px;`
      + `top:${area.top}px;width:${meio ? area.width : metade}px;height:${area.height}px`;
  }

  // Onde o ponteiro está agora, em termos de "o que acontece se soltar aqui".
  function zonaEm(x, y) {
    for (const p of cfg.paineis()) {
      const barra = p.barraDeAbas.getBoundingClientRect();
      if (x >= barra.left && x <= barra.right && y >= barra.top && y <= barra.bottom) {
        const i = p.indiceNoPonto(x);
        const tabs = [...p.barraDeAbas.querySelectorAll('.ed-file-tab')];
        const ref = tabs[i];
        const left = ref ? ref.getBoundingClientRect().left
          : (tabs.length ? tabs[tabs.length - 1].getBoundingClientRect().right : barra.left + 6);
        return { tipo: 'barra', painel: p, indice: i,
                 retangulo: { left, top: barra.top, height: barra.height } };
      }
    }
    const area = cfg.area.getBoundingClientRect();
    if (x < area.left || x > area.right || y < area.top || y > area.bottom) {
      return { tipo: 'nada' };
    }
    const rel = (x - area.left) / area.width;
    // Terços laterais dividem; os 40% do meio movem para aquele painel.
    if (rel < 0.3) return { tipo: 'dividir', lado: 'esquerda' };
    if (rel > 0.7) return { tipo: 'dividir', lado: 'direita' };
    const alvo = cfg.paineis().find((p) => {
      const r = p.elemento.getBoundingClientRect();
      return x >= r.left && x <= r.right;
    });
    return { tipo: 'mover', painel: alvo || cfg.paineis()[0] };
  }

  function aoMover(e) {
    if (!estado) return;
    if (!estado.arrastando) {
      if (Math.abs(e.clientX - estado.x0) < _EDARR_LIMIAR
          && Math.abs(e.clientY - estado.y0) < _EDARR_LIMIAR) return;
      estado.arrastando = true;
      document.body.classList.add('ed-arrastando');
      const f = document.createElement('div');
      f.className = 'ed-arr-fantasma';
      f.textContent = estado.arq.caminho.split('/').pop();
      document.body.appendChild(f);
      estado.fantasma = f;
      const o = document.createElement('div');
      o.className = 'ed-arr-overlay hidden';
      document.body.appendChild(o);
      estado.overlay = o;
    }
    estado.fantasma.style.left = `${e.clientX + 12}px`;
    estado.fantasma.style.top = `${e.clientY + 12}px`;
    estado.zona = zonaEm(e.clientX, e.clientY);
    overlayDaZona(estado.zona);
  }

  function aoSoltar(e) {
    if (!estado) return;
    const { arq, origem, arrastando, zona } = estado;
    try { e.target.releasePointerCapture(e.pointerId); } catch (_) { /* já solto */ }
    limpar();
    if (!arrastando || !zona || zona.tipo === 'nada') return;

    if (zona.tipo === 'barra') {
      if (zona.painel === origem) {
        // Reordenar dentro do mesmo painel.
        origem.desanexar(arq);
        origem.adotar(arq, zona.indice);
      } else {
        cfg.aoMover(arq, origem, zona.painel, zona.indice);
      }
      return;
    }
    if (zona.tipo === 'mover') {
      if (zona.painel === origem) return;   // já está lá
      cfg.aoMover(arq, origem, zona.painel, null);
      return;
    }
    cfg.aoDividir(arq, origem, zona.lado);
  }

  // Delegação na área: as abas são recriadas a cada `pintarBarraArquivos`, e um
  // listener por aba morreria junto com ela.
  cfg.area.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const aba = e.target.closest('.ed-file-tab');
    if (!aba || e.target.classList.contains('ed-file-x')) return;
    const painel = cfg.paineis().find((p) => p.elemento.contains(aba));
    if (!painel) return;
    const arq = painel.abertos[+aba.dataset.i];
    if (!arq) return;
    estado = { arq, origem: painel, x0: e.clientX, y0: e.clientY, arrastando: false };
    try { aba.setPointerCapture(e.pointerId); } catch (_) { /* segue sem captura */ }
  });
  cfg.area.addEventListener('pointermove', aoMover);
  cfg.area.addEventListener('pointerup', aoSoltar);
  // Sem isto, um gesto cancelado pelo sistema deixa o fantasma preso na tela.
  cfg.area.addEventListener('pointercancel', () => limpar());

  // O Chromium inicia o arraste nativo por cima do nosso se o alvo for
  // arrastável por padrão — e aí o monitor do `explorer.py` acorda.
  cfg.area.addEventListener('dragstart', (e) => e.preventDefault());
}
