// ════════════════════════════ EDITOR: A ÁRVORE PREGUIÇOSA ══
// ⚠️ NÃO usa o componente compartilhado `arvore-pastas.js`, e isso é
// deliberado. Ele recebe a lista PLANA de todos os caminhos de uma vez e monta
// a árvore inteira no DOM — perfeito para as cinco telas que leem uma pasta de
// saída que o próprio programa gerou (centenas de `.md`), e impossível aqui: a
// pasta raiz do usuário tem `node_modules`, e "todos os caminhos de uma vez"
// vira dezenas de milhares de nós numa tacada. Esta pede UM nível por vez ao
// backend, ao expandir, como o VS Code faz.
//
// O que é reusado do componente: as CLASSES (`.arvp-linha`, `.arvp-seta`,
// `.arvp-icone`, `.arvp-nome`, `.arvp-contagem`) e o `pintarIcone` de
// `icones.js`. As árvores continuam idênticas na tela; só o carregamento é
// outro.
//
// As bolinhas de contagem chegam DEPOIS, numa segunda chamada — a árvore
// aparece no primeiro `await` e as bolinhas caem em cima. O motivo está em
// `backend/modulos/editor_arvore.py`.

// eslint-disable-next-line no-unused-vars
function criarArvoreDoEditor(opcoes) {
  const cfg = Object.assign({
    container: null,
    aoAbrirArquivo: null,   // (caminho) => void
    aoPedirCartao: null,    // (caminho, elementoDaBolinha) => void
    aoMenu: null,           // (evento, alvo) => void — alvo: {tipo, caminho}
    aoRenomear: null,       // (caminhoNovo, caminhoAntigo) => void
  }, opcoes || {});

  const abertas = new Set();          // caminhos das pastas expandidas
  const contagens = new Map();        // caminho → {arquivos, parcial}
  let selecionados = new Set();       // caminhos de ARQUIVO selecionados (Shift/Ctrl)
  let ultimoClicado = null;           // âncora do Shift — o último clique sem modificador
  const pastasSujas = new Map();      // caminho da pasta → quantos arquivos ali dentro (recursivo) têm alteração não salva

  function proj() { return typeof currentProject !== 'undefined' ? currentProject : null; }

  // ── Uma linha ──
  function linhaPasta(no, nivel) {
    const wrapper = document.createElement('div');
    const linha = document.createElement('div');
    linha.className = 'arvp-linha';
    linha.style.paddingLeft = `${6 + nivel * 14}px`;
    linha.dataset.caminho = no.caminho;

    const seta = document.createElement('span');
    seta.className = 'arvp-seta';
    const icone = document.createElement('span');
    icone.className = 'arvp-icone';
    const nome = document.createElement('span');
    nome.className = 'arvp-nome';
    nome.textContent = no.nome;
    nome.title = no.caminho;

    linha.append(seta, icone, nome);

    const contagem = document.createElement('span');
    contagem.className = 'arvp-contagem';
    contagem.textContent = '·';       // reserva o espaço até o número chegar
    linha.appendChild(contagem);
    // A pasta pode já ter sido marcada suja ANTES desta linha existir (ex.:
    // reabrir uma pasta que já estava fechada) — pinta direto, sem esperar o
    // próximo `aoMudarEstado`.
    const jaSuja = pastasSujas.get(no.caminho);
    if (jaSuja) _arvPintarBadgeDeSuja(no.caminho, jaSuja);

    const info = document.createElement('span');
    info.className = 'ed-info';
    info.textContent = 'ⓘ';
    info.title = 'Informações desta pasta';
    info.addEventListener('click', (e) => {
      // Sem isto, clicar na bolinha também expandiria a pasta — dois efeitos
      // num clique, e o cartão abriria já com a árvore mexendo embaixo dele.
      e.stopPropagation();
      if (cfg.aoPedirCartao) cfg.aoPedirCartao(no.caminho, info);
    });
    linha.appendChild(info);

    const filhos = document.createElement('div');

    function pintar() {
      const aberta = abertas.has(no.caminho);
      seta.textContent = no.vazia ? '' : (aberta ? '▾' : '▸');
      pintarIcone(icone, no.nome, true, aberta ? '📂' : '📁');
      filhos.classList.toggle('hidden', !aberta);
    }

    linha.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (cfg.aoMenu) cfg.aoMenu(e, { tipo: 'pasta', caminho: no.caminho });
    });

    linha.addEventListener('click', async () => {
      if (no.vazia) return;
      if (abertas.has(no.caminho)) {
        abertas.delete(no.caminho);
        pintar();
        return;
      }
      abertas.add(no.caminho);
      pintar();
      // Só busca do disco na primeira abertura; retrair e reabrir reusa o DOM.
      if (!filhos.dataset.carregado) {
        filhos.dataset.carregado = '1';
        await preencher(filhos, no.caminho, nivel + 1);
      }
    });

    wrapper.append(linha, filhos);
    pintar();
    return wrapper;
  }

  function linhaArquivo(arq, nivel) {
    const linha = document.createElement('div');
    linha.className = 'arvp-linha' + (arq.editavel ? '' : ' ed-linha-inativa');
    // +14 alinha o arquivo com o NOME da pasta, já que ele não tem seta.
    linha.style.paddingLeft = `${6 + nivel * 14 + 14}px`;
    linha.dataset.caminho = arq.caminho;
    if (selecionados.has(arq.caminho)) linha.classList.add('arvp-ativo');

    const icone = document.createElement('span');
    icone.className = 'arvp-icone';
    pintarIcone(icone, arq.nome, false, '📄');

    const nome = document.createElement('span');
    nome.className = 'arvp-nome';
    nome.textContent = arq.nome;
    nome.title = arq.caminho;

    linha.append(icone, nome);

    linha.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Botão direito preserva a seleção múltipla quando o item clicado já
      // faz parte dela; só troca a seleção quando cai FORA (regra do VS
      // Code) — sem isto, botão direito num item de uma seleção de vários
      // colapsaria tudo para um item só antes do menu abrir.
      if (!selecionados.has(arq.caminho)) selecionar(arq.caminho);
      const grupo = [...selecionados];
      if (cfg.aoMenu) cfg.aoMenu(e, { tipo: 'arquivo', caminho: arq.caminho, selecionados: grupo });
    });

    // Início do arraste (7.1 — mover dentro da árvore). Só o botão esquerdo, e
    // só vira arraste de verdade depois do limiar de 5px em `_arvMoverArrasto`
    // — sem isso o clique normal de abrir o arquivo pararia de funcionar.
    linha.addEventListener('pointerdown', (e) => _arvIniciarArrasto(e, arq.caminho));

    if (!arq.editavel && !arq.visualizavel) {
      // O arquivo continua na árvore, acinzentado: sumir seria pior — o
      // usuário procuraria um arquivo que sabe que existe. `visualizavel`
      // salva a imagem grande: ela passa do teto de EDIÇÃO e mesmo assim
      // abre, porque ver não é editar.
      linha.title = 'Grande demais para abrir no editor.';
    } else {
      linha.addEventListener('click', (e) => {
        selecionarComClique(arq.caminho, e);
        // Ctrl/Shift é gesto de SELECIONAR, não de abrir — como no VS Code.
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey && cfg.aoAbrirArquivo) cfg.aoAbrirArquivo(arq.caminho);
      });
    }
    return linha;
  }

  // ── Preencher um nível ──
  async function preencher(alvo, caminho, nivel) {
    const r = await window.pywebview.api.editor_listar_pasta(proj(), caminho, true);
    if (!r.success) {
      alvo.innerHTML = `<div class="ed-vazio">${escapeHtml(r.error || 'Erro ao ler a pasta.')}</div>`;
      return;
    }
    const frag = document.createDocumentFragment();
    r.pastas.forEach((p) => frag.appendChild(linhaPasta(p, nivel)));
    r.arquivos.forEach((a) => frag.appendChild(linhaArquivo(a, nivel)));
    alvo.appendChild(frag);
    if (!r.pastas.length && !r.arquivos.length) {
      alvo.innerHTML = '<div class="ed-vazio">Pasta vazia.</div>';
      return;
    }
    // As bolinhas do nível inteiro numa chamada só, e sem `await`: a árvore já
    // está na tela, e os números caem em cima quando chegarem.
    if (r.pastas.length) pedirContagens(r.pastas.map((p) => p.caminho));
  }

  async function pedirContagens(caminhos) {
    const faltam = caminhos.filter((c) => !contagens.has(c));
    faltam.forEach((c) => contagens.set(c, null));   // marca "pedido" — evita pedir duas vezes
    const pedir = faltam.length ? faltam : caminhos;
    const r = await window.pywebview.api.editor_contar_pastas(proj(), pedir, true);
    if (!r || !r.success) return;
    Object.entries(r.contagens).forEach(([caminho, dados]) => {
      contagens.set(caminho, dados);
      pintarContagem(caminho, dados);
    });
  }

  function pintarContagem(caminho, dados) {
    // O selo está mostrando a contagem de arquivos NÃO SALVOS agora — não
    // sobrescreve. `dados` já ficou em cache (`contagens`, no chamador) e
    // volta pro selo assim que a pasta zerar (`_arvPintarBadgeDeSuja`).
    if (pastasSujas.get(caminho)) return;
    const linha = cfg.container.querySelector(`.arvp-linha[data-caminho="${CSS.escape(caminho)}"]`);
    const selo = linha && linha.querySelector('.arvp-contagem');
    if (!selo) return;
    if (dados.parcial) {
      // `20k+` e não `20000`: um número aproximado seria mentira, um número
      // com `+` é o fato. O `title` explica. Ver editor_arvore.py.
      const mil = Math.floor(dados.arquivos / 1000);
      selo.textContent = mil >= 1 ? `${mil}k+` : `${dados.arquivos}+`;
      selo.classList.add('ed-parcial');
      selo.title = `Mais de ${dados.arquivos} arquivos — a varredura parou no tempo limite. Use ↻ para tentar de novo.`;
    } else {
      selo.textContent = dados.arquivos;
      selo.classList.remove('ed-parcial');
      selo.title = `${dados.arquivos} arquivo(s) aqui dentro, contando as subpastas.`;
    }
  }

  // ── Indicador de pasta com alteração pendente (Obra 8) ──
  // Reaproveita o mesmo selo `.arvp-contagem` que já mostra a contagem de
  // itens da pasta — só troca a cor/número enquanto houver arquivo sujo ali
  // dentro; `pintarContagem` (acima) fica de fora enquanto isso durar.
  function _arvPintarBadgeDeSuja(caminho, n) {
    const linha = cfg.container.querySelector(`.arvp-linha[data-caminho="${CSS.escape(caminho)}"]`);
    const selo = linha && linha.querySelector('.arvp-contagem');
    if (!selo) return;
    if (n > 0) {
      selo.textContent = n;
      selo.classList.add('arvp-contagem--suja');
      selo.classList.remove('ed-parcial');
      selo.title = `${n} arquivo(s) aqui dentro com alteração não salva.`;
      return;
    }
    selo.classList.remove('arvp-contagem--suja');
    const dados = contagens.get(caminho);
    if (dados) pintarContagem(caminho, dados);
    else { selo.textContent = '·'; selo.title = ''; }
  }

  // `caminhosSujos`: TODOS os caminhos de arquivo com alteração não salva
  // agora, nos dois painéis juntos — quem chama (editor.js) é quem enxerga
  // os dois; esta árvore só sabe da própria estrutura de pastas.
  function atualizarPastasSujas(caminhosSujos) {
    const nova = new Map();
    caminhosSujos.forEach((caminhoArq) => {
      const partes = caminhoArq.split('/');
      partes.pop();
      let acumulado = '';
      partes.forEach((parte) => {
        acumulado = acumulado ? `${acumulado}/${parte}` : parte;
        nova.set(acumulado, (nova.get(acumulado) || 0) + 1);
      });
    });
    const todasAsPastas = new Set([...pastasSujas.keys(), ...nova.keys()]);
    todasAsPastas.forEach((caminho) => {
      if (pastasSujas.get(caminho) === nova.get(caminho)) return;
      _arvPintarBadgeDeSuja(caminho, nova.get(caminho) || 0);
    });
    pastasSujas.clear();
    nova.forEach((v, k) => pastasSujas.set(k, v));
  }

  function pintarSelecao() {
    cfg.container.querySelectorAll('.arvp-ativo').forEach((e) => e.classList.remove('arvp-ativo'));
    selecionados.forEach((caminho) => {
      const linha = cfg.container.querySelector(`.arvp-linha[data-caminho="${CSS.escape(caminho)}"]`);
      if (linha) linha.classList.add('arvp-ativo');
    });
  }

  // Ordem visual das linhas de ARQUIVO na árvore — só o que está expandido
  // agora entra na conta, exatamente como o Shift do VS Code se comporta.
  function ordemVisualDeArquivos() {
    return [...cfg.container.querySelectorAll('.arvp-linha[data-caminho]')]
      .filter((l) => !l.querySelector('.arvp-seta'))   // pasta tem seta; arquivo não
      .map((l) => l.dataset.caminho);
  }

  // Seleção de UM item, sem olhar modificador — usada pelo resto do programa
  // (revelar um resultado de busca, restaurar depois de recarregar). Nunca é
  // o caminho de um clique do usuário; esse passa por `selecionarComClique`.
  function selecionar(caminho) {
    selecionados = new Set(caminho ? [caminho] : []);
    ultimoClicado = caminho || null;
    pintarSelecao();
  }

  // O clique de verdade na árvore, com o Shift/Ctrl do evento. Só arquivo
  // participa da seleção múltipla — pasta continua com clique simples
  // (expandir/retrair) e botão direito de item único.
  function selecionarComClique(caminho, evento) {
    const ctrl = evento && (evento.ctrlKey || evento.metaKey);
    const shift = evento && evento.shiftKey;

    if (shift && ultimoClicado) {
      const ordem = ordemVisualDeArquivos();
      const i1 = ordem.indexOf(ultimoClicado);
      const i2 = ordem.indexOf(caminho);
      if (i1 >= 0 && i2 >= 0) {
        const [ini, fim] = i1 < i2 ? [i1, i2] : [i2, i1];
        selecionados = new Set(ordem.slice(ini, fim + 1));
      } else {
        selecionados = new Set([caminho]);
        ultimoClicado = caminho;
      }
    } else if (ctrl) {
      selecionados = new Set(selecionados);
      if (selecionados.has(caminho)) selecionados.delete(caminho);
      else selecionados.add(caminho);
      ultimoClicado = caminho;
    } else {
      selecionados = new Set([caminho]);
      ultimoClicado = caminho;
    }
    pintarSelecao();
  }

  // ── Renomear inline: o nome vira um campo editável direto na linha ──
  // Troca `.arvp-nome` por um `.arvp-rename-input` (classe do preview,
  // `preview-aba-editor.html`), com o nome sem a extensão pré-selecionado —
  // mesma lógica de seleção que o antigo modal de renomear já fazia.
  function renomearInline(caminho) {
    const linha = cfg.container.querySelector(`.arvp-linha[data-caminho="${CSS.escape(caminho)}"]`);
    const nomeSpan = linha && linha.querySelector('.arvp-nome');
    if (!nomeSpan || linha.querySelector('.arvp-rename-input')) return;
    const nomeAtual = caminho.split('/').pop();

    const input = document.createElement('input');
    input.className = 'arvp-rename-input';
    input.value = nomeAtual;
    input.spellcheck = false;
    nomeSpan.replaceWith(input);
    input.focus();
    const ponto = nomeAtual.lastIndexOf('.');
    input.setSelectionRange(0, ponto > 0 ? ponto : nomeAtual.length);

    let terminado = false;
    function voltarAoSpan() { if (input.isConnected) input.replaceWith(nomeSpan); }

    async function confirmar() {
      if (terminado) return;
      terminado = true;
      const novoNome = input.value.trim();
      if (!novoNome || novoNome === nomeAtual) { voltarAoSpan(); return; }
      const r = await window.pywebview.api.editor_renomear(proj(), caminho, novoNome);
      if (!r.success) {
        showToast(r.error, true);
        voltarAoSpan();
        return;
      }
      // Reação (D46): ANTES de `aoRenomear`, que recarrega a árvore. Observador,
      // sem `await`.
      if (typeof xtEmitir === 'function') {
        xtEmitir('arquivo.renomeado', { projeto: proj(), de: caminho, para: r.caminho });
      }
      // Sem restaurar o span aqui: quem chama `aoRenomear` recarrega a árvore
      // inteira, e o DOM desta linha some junto.
      if (cfg.aoRenomear) cfg.aoRenomear(r.caminho, caminho);
    }
    function cancelar() { terminado = true; voltarAoSpan(); }

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelar(); }
    });
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('blur', () => confirmar());
  }

  // F2 renomeia o item selecionado. Vai pelo registro central
  // (`modulos/teclas.js`) e não por um `keydown` próprio: as três guardas que
  // estavam escritas aqui — aba visível, foco fora de campo de texto, nenhum
  // modal aberto — moram lá agora, e a de campo de texto de lá é mais completa
  // do que a daqui era (esta olhava `document.activeElement` e só cobria
  // INPUT/TEXTAREA; a de lá cobre também SELECT e `isContentEditable`, que é o
  // que protege o próprio `.arvp-rename-input` já em edição).
  registrarTecla({
    id: 'editor.renomear', rotulo: 'Renomear o item selecionado',
    grupo: 'Editor', onde: 'tab-editor', padrao: 'F2', icone: '✎',
    ativo: () => selecionados.size === 1,
    motivo: 'selecione um item na árvore',
    fazer: () => renomearInline([...selecionados][0]),
  });

  // ── Arrastar e soltar (Obra 7) ──
  // 7.1: mover dentro da árvore — PONTEIRO, não HTML5 drag (mesmo padrão de
  // `editor-arrasto.js`, e pelo mesmo motivo: `explorer.py::_start_drag_monitor`
  // e `drag-drop.js` já ocupam o caminho de arraste HTML5).
  // 7.2: copiar de fora do programa — esse SIM é HTML5 `drop` de verdade, e
  // `drag-drop.js` já resolve a detecção; só reaproveita.

  let arrasto = null;   // { caminhos, x0, y0, arrastando, fantasma, alvo }

  function _arvLimparAlvo() {
    cfg.container.querySelectorAll('.arvp-linha--alvo-solto')
      .forEach((el) => el.classList.remove('arvp-linha--alvo-solto'));
  }

  // Pasta (ou fundo vazio = raiz) sob o ponteiro; null se for cima de um
  // arquivo — soltar em arquivo não tem sentido.
  function _arvAlvoDeSolturaEm(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el || !cfg.container.contains(el)) return null;
    const linha = el.closest('.arvp-linha[data-caminho]');
    if (!linha) return { caminho: '', el: null };
    if (linha.querySelector('.arvp-seta')) return { caminho: linha.dataset.caminho, el: linha };
    return null;
  }

  function _arvIniciarArrasto(e, caminho) {
    if (e.button !== 0) return;
    // Arrastar um item de uma seleção múltipla move o GRUPO inteiro; arrastar
    // um item fora da seleção atual arrasta só ele (a seleção nem muda —
    // decidir isso é gesto de clique, não de arraste).
    const grupo = (selecionados.has(caminho) && selecionados.size > 1) ? [...selecionados] : [caminho];
    arrasto = { caminhos: grupo, x0: e.clientX, y0: e.clientY, arrastando: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* segue sem captura */ }
  }

  function _arvMoverArrasto(e) {
    if (!arrasto) return;
    if (!arrasto.arrastando) {
      if (Math.abs(e.clientX - arrasto.x0) < 5 && Math.abs(e.clientY - arrasto.y0) < 5) return;
      arrasto.arrastando = true;
      document.body.classList.add('ed-arrastando');
      const f = document.createElement('div');
      f.className = 'ed-arr-fantasma';
      f.textContent = arrasto.caminhos.length > 1
        ? `${arrasto.caminhos.length} itens` : arrasto.caminhos[0].split('/').pop();
      document.body.appendChild(f);
      arrasto.fantasma = f;
    }
    arrasto.fantasma.style.left = `${e.clientX + 12}px`;
    arrasto.fantasma.style.top = `${e.clientY + 12}px`;
    _arvLimparAlvo();
    arrasto.alvo = _arvAlvoDeSolturaEm(e.clientX, e.clientY);
    if (arrasto.alvo && arrasto.alvo.el) arrasto.alvo.el.classList.add('arvp-linha--alvo-solto');
  }

  function _arvLimparArrasto() {
    if (!arrasto) return;
    if (arrasto.fantasma) arrasto.fantasma.remove();
    document.body.classList.remove('ed-arrastando');
    _arvLimparAlvo();
    arrasto = null;
  }

  async function _arvSoltarArrasto(e) {
    if (!arrasto) return;
    const { caminhos, arrastando, alvo } = arrasto;
    try { e.target.releasePointerCapture(e.pointerId); } catch (_) { /* já solto */ }
    _arvLimparArrasto();
    if (!arrastando || !alvo) return;

    let algumMoveu = false;
    for (const caminho of caminhos) {
      const pai = caminho.includes('/') ? caminho.slice(0, caminho.lastIndexOf('/')) : '';
      if (pai === alvo.caminho) continue;   // já está lá — soltar na própria pasta não faz nada
      // eslint-disable-next-line no-await-in-loop
      const r = await window.pywebview.api.editor_colar(proj(), caminho, alvo.caminho, true);
      if (r.success) {
        algumMoveu = true;
        if (typeof xtEmitir === 'function') {
          xtEmitir('arquivo.renomeado', { projeto: proj(), de: caminho, para: r.caminho });
        }
      } else showToast(r.error, true);
    }
    if (algumMoveu) await recarregar();
  }

  cfg.container.addEventListener('pointermove', _arvMoverArrasto);
  cfg.container.addEventListener('pointerup', _arvSoltarArrasto);
  cfg.container.addEventListener('pointercancel', _arvLimparArrasto);
  // O Chromium tentaria iniciar arraste nativo por cima do nosso — e aí o
  // monitor global de `explorer.py` acordaria sem necessidade.
  cfg.container.addEventListener('dragstart', (e) => e.preventDefault());

  // 7.2 — copiar arquivo/pasta de FORA do programa, soltando na árvore.
  // `setupDropZoneMulti` (drag-drop.js) já resolve os caminhos reais de
  // qualquer jeito que o WebView2 entregar; aqui só falta chamar o endpoint
  // que COPIA (nunca move) para dentro do projeto.
  cfg.container.classList.add('drop-section');
  setupDropZoneMulti(cfg.container, async (itens) => {
    let algumCopiou = false;
    for (const item of itens) {
      // eslint-disable-next-line no-await-in-loop
      const r = await window.pywebview.api.editor_importar_arquivo_externo(proj(), item.path, '');
      if (r.success) {
        algumCopiou = true;
        if (typeof xtEmitir === 'function') {
          xtEmitir('arquivo.criado', { projeto: proj(), caminho: r.caminho,
            pasta: typeof item.isDirectory === 'boolean' ? item.isDirectory : null });
        }
      } else showToast(r.error, true);
    }
    if (algumCopiou) {
      showToast(itens.length > 1 ? `${itens.length} copiados para o projeto.` : 'Copiado para o projeto.');
      await recarregar();
    }
  });

  // O vazio abaixo da última linha também responde ao botão direito — é o
  // gesto de "criar aqui" que todo explorador de arquivos tem. As linhas param
  // a propagação, então o que chega aqui é só o fundo.
  cfg.container.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (cfg.aoMenu) cfg.aoMenu(e, { tipo: 'raiz', caminho: '' });
  });

  async function redesenhar() {
    cfg.container.innerHTML = '<div class="ed-vazio">Carregando…</div>';
    const raiz = document.createElement('div');
    await preencher(raiz, '', 0);
    cfg.container.innerHTML = '';
    cfg.container.appendChild(raiz);
    pintarSelecao();
  }

  async function recarregar() {
    contagens.clear();
    await window.pywebview.api.editor_esquecer_contagens(proj(), null);
    abertas.clear();
    await redesenhar();
  }

  return {
    redesenhar,
    selecionar,
    renomearInline,
    atualizarPastasSujas,

    // Trocar de PROJETO. A árvore é uma instância só, criada uma vez e nunca
    // destruída — mas nada do que ela lembra vale no projeto seguinte: pastas
    // abertas, seleção, âncora do Shift, contagens e pastas sujas são todas
    // indexadas por CAMINHO, e o mesmo caminho em outro projeto é outro
    // arquivo. Sem isto, entrar no projeto B mostrava a seleção e as contagens
    // do A por cima da árvore certa.
    esquecerEstado() {
      abertas.clear();
      contagens.clear();
      pastasSujas.clear();
      selecionados = new Set();
      ultimoClicado = null;
    },

    // Abre a árvore até um arquivo e o seleciona — usado pelo clique num
    // resultado de busca, que dá o caminho sem passar pela navegação.
    async revelar(caminho) {
      const partes = caminho.split('/');
      partes.pop();
      let acumulado = '';
      for (const parte of partes) {
        acumulado = acumulado ? `${acumulado}/${parte}` : parte;
        const linha = cfg.container.querySelector(`.arvp-linha[data-caminho="${CSS.escape(acumulado)}"]`);
        if (linha && !abertas.has(acumulado)) linha.click();
        // Espera o nível carregar antes de procurar o próximo: sem isto o
        // `querySelector` da volta seguinte procura num DOM que ainda não tem
        // a linha.
        await new Promise((r) => setTimeout(r, 60));
      }
      selecionar(caminho);
      const linha = cfg.container.querySelector(`.arvp-linha[data-caminho="${CSS.escape(caminho)}"]`);
      if (linha) linha.scrollIntoView({ block: 'nearest' });
    },

    recarregar,

    // Expande a árvore até uma PASTA (não um arquivo) e rola até ela — usado
    // pelo clique num segmento das migalhas de pão (Obra 9). Mesma mecânica
    // de `revelar`, mas expande a própria pasta clicada também (pra mostrar o
    // que tem dentro), e não seleciona nada.
    async revelarPasta(caminho) {
      if (!caminho) { cfg.container.scrollTo({ top: 0 }); return; }
      const partes = caminho.split('/');
      let acumulado = '';
      for (const parte of partes) {
        acumulado = acumulado ? `${acumulado}/${parte}` : parte;
        const linha = cfg.container.querySelector(`.arvp-linha[data-caminho="${CSS.escape(acumulado)}"]`);
        if (linha && !abertas.has(acumulado)) linha.click();
        await new Promise((r) => setTimeout(r, 60));
      }
      const linha = cfg.container.querySelector(`.arvp-linha[data-caminho="${CSS.escape(caminho)}"]`);
      if (linha) linha.scrollIntoView({ block: 'nearest' });
    },

    // ⚠️ NÃO existe mais um `filtrarPorNome` que esconde linhas da árvore. Ele
    // existiu e foi retirado em 30/08/2026: numa árvore preguiçosa o filtro só
    // alcança o que já foi expandido, então abrir uma pasta com o filtro ligado
    // escondia os arquivos dela e a árvore respondia "Pasta vazia" com o
    // conteúdo lá dentro. Os três modos de busca agora vão ao disco e devolvem
    // caminho — ver `acesso-rapido-modos.js`.
    //
    // ⚠️ E não existe mais um interruptor de "esconder o que o programa ignora".
    // Ele existiu por um dia e o usuário mandou tirar, com a razão certa: esta
    // aba é para ele VER o projeto dele, então esconder arquivo aqui não é
    // opção — é defeito. A árvore mostra tudo, sempre, e as chamadas ao backend
    // passam `mostrar_ignorados=true` fixo.
    get mostrarIgnorados() { return true; },
  };
}
