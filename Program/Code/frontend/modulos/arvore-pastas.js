// ═════════════════════════════════════════════ COMPONENTE: ÁRVORE DE PASTAS ══
//
// UMA árvore para as cinco telas que precisam de uma: Documentação, Mapa de
// I/O, Tree-sitter, Relações e Decisões. Antes eram cinco implementações
// independentes — mapaio.js e treesitter.js eram cópia byte-a-byte um do
// outro, relacoes.js admitia por escrito ser a terceira cópia, e "Decisões"
// nem tentava: era uma lista plana com o caminho inteiro no rótulo, num painel
// de 240px, onde o nome do arquivo era justamente a parte que sumia.
//
// Nas palavras do usuário: *"não precisa ficar querendo a mesma função para
// todas, porque daí se tiver algum problema vai ter em todas — eu arrumo em um
// e arrumo em todas"*. O risco de as cinco telas mudarem na mesma leva foi
// aceito explicitamente.
//
// A entrada é sempre uma LISTA PLANA de caminhos relativos separados por `/`.
// Quem tem só o basename precisa passar a mandar o caminho — é o que a Obra 18
// consertou no Mapa de I/O e no Tree-sitter, que jogavam o `relative` fora.
//
// Três coisas que as cópias antigas erravam e que aqui são garantidas:
//  1. o estado de expandido/recolhido SOBREVIVE a um re-render (relacoes.js
//     recriava a árvore a cada clique e perdia tudo);
//  2. a indentação é uma só regra, por nível (as cópias misturavam padding no
//     container com padding na linha, e somavam sem querer);
//  3. expandir tudo / retrair tudo / atualizar existem em todas.

// O tipo do `dataTransfer` quando uma linha é arrastada para fora da árvore
// (opção `arrastavel`). Próprio, e não `text/plain`, para a zona de soltar
// saber que veio da árvore e não do Explorer do Windows.
const ARVP_TIPO_ARRASTO = 'application/x-arvp-caminho';

function criarArvorePastas(opcoes) {
  const cfg = Object.assign({
    container: null,        // elemento onde desenhar
    caminhos: [],           // ['pasta/sub/arquivo.js', ...]
    // Pastas que devem existir na árvore mesmo sem nenhum arquivo em `caminhos`
    // apontando para dentro delas: ['pasta/sub', ...]. Existe para quem corta a
    // lista por profundidade (as telas de Resumo) — sem isto, uma pasta que só
    // contém subpastas some da árvore quando o corte tira os arquivos de baixo,
    // e o nível mais raso do slider aparecia vazio.
    pastas: [],
    aoSelecionar: null,     // (caminho) => void
    // Menu do botão direito. OPT-IN de propósito: sem eles, o clique direito
    // não faz nada, como sempre foi nas outras seis telas que usam esta
    // árvore. Cada um recebe o caminho do alvo e devolve a lista de itens no
    // formato de `abrirMenuDeContexto` (`menu-contexto.js`) — a árvore não
    // sabe o que são os itens, só onde o usuário clicou.
    itensMenuPasta: null,   // (caminho) => [itens] | null
    itensMenuArquivo: null, // (caminho) => [itens] | null
    // Clique direito no VAZIO do container, para agir sobre a raiz — sem ele,
    // uma árvore vazia não teria como oferecer "criar" coisa nenhuma.
    itensMenuRaiz: null,    // () => [itens] | null
    rotuloArquivo: null,    // (caminho, nome) => string
    seloArquivo: null,      // (caminho) => string|null  — badge à direita
    contarArquivos: true,   // badge com o total de arquivos em cada pasta
    expandido: true,        // estado inicial das pastas
    // Cada linha (pasta e arquivo) pode ser arrastada para fora da árvore,
    // levando `{caminho, pasta}` em `ARVP_TIPO_ARRASTO`. OPT-IN: só a
    // Estrutura de Projeto › Remover e Contexto sem leitura precisa.
    arrastavel: false,
    vazio: 'Nada para mostrar.',
    aoAtualizar: null,      // callback do botão ↻ (se a tela tiver um)
  }, opcoes || {});

  // caminho da pasta → aberta? Vive FORA do render, e é o que faz o estado
  // sobreviver a `redesenhar()`.
  const aberturas = new Map();
  let selecionado = null;

  // ⚠️ `preventDefault()` SEMPRE que houver menu nosso, senão o WebView2 mostra
  // o menu dele por cima — é a mesma ressalva registrada em `menu-contexto.js`.
  // E `stopPropagation`, para o clique direito numa linha não disparar também
  // o menu da raiz, que é ouvinte do container.
  function _ligarMenu(el, montar, caminho) {
    if (!montar) return;
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      const itens = montar(caminho);
      // Chama mesmo com a lista vazia: uma extensão pode ser a ÚNICA a ter
      // item para aquele alvo, e a guarda antiga a teria calado.
      abrirMenuDeContexto({
        x: e.clientX, y: e.clientY, itens,
        ponto: 'arvore.menu', contexto: { caminho },
      });
    });
  }

  function _ligarArrasto(el, caminho, ehPasta) {
    if (!cfg.arrastavel) return;
    el.draggable = true;
    el.addEventListener('dragstart', e => {
      e.dataTransfer.setData(ARVP_TIPO_ARRASTO, JSON.stringify({ caminho, pasta: ehPasta }));
      e.dataTransfer.effectAllowed = 'copy';
    });
  }

  function _no(nome) {
    return { nome, pastas: new Map(), arquivos: [] };
  }

  function _montar(caminhos) {
    const raiz = _no('');
    for (const bruto of caminhos || []) {
      const caminho = String(bruto).replace(/\\/g, '/');
      const partes = caminho.split('/').filter(Boolean);
      if (!partes.length) continue;
      let no = raiz;
      let prefixo = '';
      for (let i = 0; i < partes.length - 1; i++) {
        prefixo = prefixo ? `${prefixo}/${partes[i]}` : partes[i];
        if (!no.pastas.has(partes[i])) no.pastas.set(partes[i], _no(partes[i]));
        no = no.pastas.get(partes[i]);
        no.caminho = prefixo;
      }
      no.arquivos.push({ caminho, nome: partes[partes.length - 1] });
    }
    // Pastas declaradas à parte: aqui TODOS os segmentos são pasta — não há
    // arquivo no fim, que é justamente a diferença para o laço acima.
    for (const bruto of cfg.pastas || []) {
      const partes = String(bruto).replace(/\\/g, '/').split('/').filter(Boolean);
      let no = raiz;
      let prefixo = '';
      for (const parte of partes) {
        prefixo = prefixo ? `${prefixo}/${parte}` : parte;
        if (!no.pastas.has(parte)) no.pastas.set(parte, _no(parte));
        no = no.pastas.get(parte);
        no.caminho = prefixo;
      }
    }
    return raiz;
  }

  function _contar(no) {
    let total = no.arquivos.length;
    for (const filho of no.pastas.values()) total += _contar(filho);
    return total;
  }

  function _estaAberta(caminho) {
    if (!aberturas.has(caminho)) aberturas.set(caminho, cfg.expandido);
    return aberturas.get(caminho);
  }

  function _linhaPasta(no, nivel) {
    const wrapper = document.createElement('div');
    wrapper.className = 'arvp-pasta';
    wrapper.dataset.caminho = no.caminho;

    const linha = document.createElement('div');
    linha.className = 'arvp-linha arvp-linha-pasta';
    // Indentação numa regra só, na própria linha. As cópias antigas somavam
    // padding do container com padding da linha e desalinhavam os níveis.
    linha.style.paddingLeft = `${6 + nivel * 14}px`;

    const seta = document.createElement('span');
    seta.className = 'arvp-seta';
    const icone = document.createElement('span');
    icone.className = 'arvp-icone';
    const nome = document.createElement('span');
    nome.className = 'arvp-nome';
    nome.textContent = no.nome;
    nome.title = no.caminho || no.nome;

    linha.appendChild(seta);
    linha.appendChild(icone);
    linha.appendChild(nome);

    if (cfg.contarArquivos) {
      const contagem = document.createElement('span');
      contagem.className = 'arvp-contagem';
      contagem.textContent = _contar(no);
      linha.appendChild(contagem);
    }

    const filhos = document.createElement('div');
    filhos.className = 'arvp-filhos';

    const pintar = () => {
      const aberta = _estaAberta(no.caminho);
      seta.textContent = aberta ? '▾' : '▸';
      // Repintado a cada abre/fecha porque vive dentro do `pintar()`. Sai
      // barato (o <img> ja esta em cache) e e preciso: com os icones
      // desligados o emoji de reserva muda com o estado, o SVG nao.
      pintarIcone(icone, no.nome, true, aberta ? '📂' : '📁');
      filhos.classList.toggle('hidden', !aberta);
    };

    linha.addEventListener('click', () => {
      aberturas.set(no.caminho, !_estaAberta(no.caminho));
      pintar();
    });

    _ligarMenu(linha, cfg.itensMenuPasta, no.caminho);
    _ligarArrasto(linha, no.caminho, true);

    wrapper.appendChild(linha);
    _preencher(filhos, no, nivel + 1);
    wrapper.appendChild(filhos);
    pintar();
    return wrapper;
  }

  function _linhaArquivo(arquivo, nivel) {
    const linha = document.createElement('div');
    linha.className = 'arvp-linha arvp-linha-arquivo';
    if (arquivo.caminho === selecionado) linha.classList.add('arvp-ativo');
    linha.dataset.caminho = arquivo.caminho;
    // +14 alinha o arquivo com o nome da pasta, já que ele não tem seta.
    linha.style.paddingLeft = `${6 + nivel * 14 + 14}px`;

    const icone = document.createElement('span');
    icone.className = 'arvp-icone';
    pintarIcone(icone, arquivo.nome, false, '📄');

    const nome = document.createElement('span');
    nome.className = 'arvp-nome';
    nome.textContent = cfg.rotuloArquivo
      ? cfg.rotuloArquivo(arquivo.caminho, arquivo.nome)
      : arquivo.nome;
    // O caminho completo no title: o nome sozinho não distingue sete
    // __init__.py, e o painel é estreito demais para mostrar o resto.
    nome.title = arquivo.caminho;

    linha.appendChild(icone);
    linha.appendChild(nome);

    const selo = cfg.seloArquivo ? cfg.seloArquivo(arquivo.caminho) : null;
    if (selo !== null && selo !== undefined && selo !== '') {
      const badge = document.createElement('span');
      badge.className = 'arvp-selo';
      badge.textContent = selo;
      linha.appendChild(badge);
    }

    linha.addEventListener('click', () => {
      selecionar(arquivo.caminho);
      if (cfg.aoSelecionar) cfg.aoSelecionar(arquivo.caminho);
    });
    // ⚠️ O clique direito SELECIONA antes de abrir o menu. Sem isso, "Renomear"
    // e "Excluir" agiriam sobre uma linha que não está marcada em lugar nenhum,
    // e o usuário não teria como conferir em qual arquivo o menu vai mexer.
    if (cfg.itensMenuArquivo) {
      linha.addEventListener('contextmenu', () => selecionar(arquivo.caminho));
    }
    _ligarMenu(linha, cfg.itensMenuArquivo, arquivo.caminho);
    _ligarArrasto(linha, arquivo.caminho, false);
    return linha;
  }

  function _preencher(alvo, no, nivel) {
    // Pastas antes de arquivos, cada grupo em ordem alfabética — a mesma
    // convenção que o backend usa para montar a árvore da documentação técnica.
    const nomes = [...no.pastas.keys()].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()));
    for (const nome of nomes) alvo.appendChild(_linhaPasta(no.pastas.get(nome), nivel));

    const arquivos = no.arquivos.slice().sort((a, b) =>
      a.nome.toLowerCase().localeCompare(b.nome.toLowerCase()));
    for (const arquivo of arquivos) alvo.appendChild(_linhaArquivo(arquivo, nivel));
  }

  // ── API pública ───────────────────────────────────────────────────────────

  function redesenhar(caminhos, pastas) {
    if (caminhos !== undefined) cfg.caminhos = caminhos;
    if (pastas !== undefined) cfg.pastas = pastas;
    const el = cfg.container;
    if (!el) return;
    el.innerHTML = '';
    el.classList.add('arvore-pastas');
    if (!(cfg.caminhos || []).length && !(cfg.pastas || []).length) {
      el.innerHTML = `<p class="arvp-vazio">${escapeHtml(cfg.vazio)}</p>`;
      return;
    }
    _preencher(el, _montar(cfg.caminhos), 0);
    // ⚠️ LIGADO NO CONTAINER, e uma vez só (`_arvpMenuRaiz`): `redesenhar` roda a
    // cada carga, e um ouvinte por redesenho empilha até o menu abrir dez vezes.
    // O clique direito numa LINHA não chega aqui, porque `_ligarMenu` corta a
    // propagação — então este ouvinte é, na prática, "cliquei no vazio".
    if (cfg.itensMenuRaiz && !el._arvpMenuRaiz) {
      el._arvpMenuRaiz = true;
      el.addEventListener('contextmenu', e => {
        e.preventDefault();
        const itens = cfg.itensMenuRaiz();
        abrirMenuDeContexto({
          x: e.clientX, y: e.clientY, itens,
          ponto: 'arvore.menu', contexto: { caminho: '' },
        });
      });
    }
  }

  function expandirTudo() {
    for (const chave of aberturas.keys()) aberturas.set(chave, true);
    cfg.expandido = true;
    redesenhar();
  }

  function retrairTudo() {
    for (const chave of aberturas.keys()) aberturas.set(chave, false);
    cfg.expandido = false;
    redesenhar();
  }

  function selecionar(caminho) {
    selecionado = caminho;
    // Marca a linha no DOM em vez de redesenhar tudo: redesenhar a cada clique
    // era justamente o que fazia a árvore de Relações perder o que estava aberto.
    const el = cfg.container;
    if (!el) return;
    el.querySelectorAll('.arvp-linha-arquivo').forEach(l =>
      l.classList.toggle('arvp-ativo', l.dataset.caminho === caminho));
  }

  function expandirAte(caminho) {
    const partes = String(caminho || '').replace(/\\/g, '/').split('/');
    let prefixo = '';
    for (let i = 0; i < partes.length - 1; i++) {
      prefixo = prefixo ? `${prefixo}/${partes[i]}` : partes[i];
      aberturas.set(prefixo, true);
    }
    redesenhar();
    selecionar(caminho);
  }

  redesenhar();
  return { redesenhar, expandirTudo, retrairTudo, selecionar, expandirAte,
           get selecionado() { return selecionado; } };
}

// Liga os três botões padrão (⊞ expandir, ⊟ retrair, ↻ atualizar) a uma
// instância. Cada tela passa os ids dos botões que ela tem no template.
function ligarBotoesArvore(arvore, ids) {
  const wire = (id, fn) => {
    const btn = id && document.getElementById(id);
    if (!btn || btn._arvpWired) return;
    btn._arvpWired = true;
    btn.addEventListener('click', fn);
  };
  wire(ids.expandir, () => arvore().expandirTudo());
  wire(ids.retrair,  () => arvore().retrairTudo());
  wire(ids.atualizar, () => { if (ids.aoAtualizar) ids.aoAtualizar(); });
}

// Esconde/mostra linhas da árvore SEM redesenhar — é isso que preserva o
// estado de expandido enquanto se digita na busca. `aceita` é `null` (mostra
// tudo) ou uma função `(caminho) => bool`.
//
// A pasta é regida pelos filhos: some quando nenhum arquivo dela sobrou
// visível, e volta sozinha quando a busca é limpa. Sem isso, filtrar deixava
// uma coluna de pastas vazias.
//
// A lista plana da Documentação (`.doc-file`), que esta função também
// cobria, saiu em 2026-09: as fontes dela viraram a árvore de níveis
// (documentacao-arvores.js), que filtra os próprios itens.
function filtrarArvorePorCaminho(container, aceita) {
  if (!container) return;
  const arquivos = container.querySelectorAll('.arvp-linha-arquivo');
  const pastas   = container.querySelectorAll('.arvp-pasta');

  if (!aceita) {
    arquivos.forEach(el => { el.style.display = ''; });
    pastas.forEach(el => { el.style.display = ''; });
    return;
  }

  arquivos.forEach(el => {
    const caminho = el.dataset.caminho || el.dataset.label || el.textContent || '';
    el.style.display = aceita(caminho) ? '' : 'none';
  });
  pastas.forEach(pasta => {
    const temVisivel = [...pasta.querySelectorAll('.arvp-linha-arquivo')]
      .some(f => f.style.display !== 'none');
    pasta.style.display = temVisivel ? '' : 'none';
  });
}
