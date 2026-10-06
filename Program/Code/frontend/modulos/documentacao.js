// ══════════════════════════════════════════════════════ ABA: DOCUMENTAÇÃO ══
//
// ── Este arquivo era 652 linhas, e virou quatro ───────────────────────────
//
// Pelo teto de 500 da AMF. Cada um responde uma pergunta:
//
//   documentacao.js          as fontes, a árvore de pastas e o regerar
//   documentacao-viewer.js   ver um artefato, e copiar pro chat
//   documentacao-busca.js    as três buscas, e a ligação da tela
//   documentacao-arvores.js  as árvores de níveis: Pipeline, Glossário e
//                            Índice de navegação
//
// São scripts clássicos, não módulos: as funções e os `let` do topo continuam
// globais, e o `index.html` carrega os quatro na ordem acima.
//
// ⚠️ `_DOC_FONTES` FICA AQUI, e é a única lista de fontes da aba. Os outros dois
// perguntam a ela — uma segunda lista divergiria na primeira fonte nova.

let _docArvore = null;   // instância de arvore-pastas.js (fontes com render 'arvore')
// caminho real no disco → caminho como a árvore o indexa. Só o Resumo de pastas
// difere dos dois (ver _docMapaVirtualParaReal); nas outras fontes é identidade.
let _docVirtualDe = new Map();
let _docSearchType = 'nome';   // 'nome' | 'conteudo' | 'semantica'
let _docFonte = 'documentacao-tecnica';     // chave de _DOC_FONTES
let _docBound = false;

// As fontes que a aba sabe mostrar. `id` é também o nome da pasta em
// `agentes/`, o que deixa list_agent_files e read_agent_file servirem todas
// sem nenhum endpoint específico por fonte.
//
// `render` decide a forma da coluna esquerda:
//   'arvore'  — hierarquia espelhando a árvore do código (arvore-pastas.js)
//   'niveis'  — a fonte é UM documento, mostrado em pedaços: cada linha abre
//               um pedaço dele (Pipeline por nível, Glossário por tópico,
//               Índice por pasta). Ver documentacao-arvores.js.
//
// O 'unico' (lista plana de um item, que abria sozinho) saiu em 2026-09,
// quando as três fontes que o usavam viraram 'niveis'.
//
// O Resumo de pastas já foi 'lista' (uma linha por pasta, com o caminho inteiro
// no rótulo). Não dava: num painel de 240px, `Program/Code/backend/modulos/...`
// era cortado exatamente na parte que distingue uma pasta da outra, e 40 pastas
// viravam 40 linhas iguais. Ele grava `resumo-pastas/Program/Code/backend.md`,
// que é hierárquico no disco — a lista plana é que estava desfazendo isso.
//
// `semantica` diz se existe índice de embeddings para a fonte. Só três têm
// (ver backend/modulos/agentes/embedding.py) — nas outras o botão fica
// desabilitado em vez de devolver erro depois do clique.
//
// `painelLargo` alarga a coluna da árvore. Não basta olhar o `render`: a
// Bibliotecas também é 'arvore', mas seus nós são nomes de biblioteca soltos,
// sem pasta nem subpasta — ela cabe na largura padrão. Quem precisa da coluna
// larga são as quatro fontes que espelham a hierarquia do código.
const _DOC_FONTES = {
  'resumo-pastas':       { titulo: 'Resumo de pastas',      render: 'arvore', semantica: true,  painelLargo: true, agente: 'Resumo de Pastas' },
  'documentacao-tecnica':{ titulo: 'Documentação técnica',  render: 'arvore', semantica: true,  painelLargo: true, agente: 'Documentação Técnica' },
  'glossario':           { titulo: 'Glossário',             render: 'niveis', semantica: false, agente: 'Glossário' },
  'indice-navegacao':    { titulo: 'Índice de navegação',   render: 'niveis', semantica: false, painelLargo: true, agente: 'Índice de Navegação' },
  'pipeline':            { titulo: 'Pipeline',              render: 'niveis', semantica: false, painelLargo: true, agente: 'Pipeline' },
  'bibliotecas':         { titulo: 'Bibliotecas',           render: 'arvore', semantica: false, agente: 'Bibliotecas' },
  'comentarios':         { titulo: 'Comentários',           render: 'arvore', semantica: false, painelLargo: true, agente: 'Comentários' },
};

// As fontes que a própria aba sabe gerar. As outras seis dependem de um agente
// rodado na aba Automação; estas duas são determinísticas e rodam em segundos,
// então a aba as produz sozinhas na primeira abertura em vez de mostrar
// "execute o agente primeiro".
//
// ⚠️ Era uma string só enquanto só a Bibliotecas se auto-gerava. Virou conjunto
// com a chegada dos Comentários — e cada fonte precisa do SEU par de método e
// callback: com um par compartilhado, o fim de uma recarregaria a árvore da
// outra, que está na tela.
const _DOC_FONTES_AUTOGERA = new Set(['bibliotecas', 'comentarios']);

const _DOC_AUTOGERA = {
  'bibliotecas': {
    run:    'run_bibliotecas_agent',
    espera: 'Lendo os imports das pastas de trabalho.',
    erro:   'Erro ao gerar a lista de bibliotecas.',
  },
  'comentarios': {
    run:    'run_comentarios_agent',
    espera: 'Lendo os comentários das pastas de trabalho.',
    erro:   'Erro ao gerar a lista de comentários.',
  },
};

function _docFonteAtual() { return _DOC_FONTES[_docFonte] || _DOC_FONTES['documentacao-tecnica']; }

const _DOC_PLACEHOLDERS = {
  nome:      'Buscar por nome...',
  conteudo:  'Buscar no conteúdo...',
  semantica: 'Buscar por conceito...',
};

async function initDocumentacao() {
  if (!_docBound) {
    _docBound = true;
    bindDocumentacao();
  }
  await loadDocTree();
}

// ── Árvore ────────────────────────────────────────────────────────────────

async function loadDocTree(jaGerou = false) {
  const fonte = _docFonteAtual();
  const container = document.getElementById('doc-tree');
  const titulo = document.getElementById('doc-tree-title');
  if (titulo) titulo.textContent = fonte.titulo;
  document.getElementById('doc-tree-panel')
    ?.classList.toggle('doc-tree-panel--largo', !!fonte.painelLargo);

  container.innerHTML = '<div class="doc-empty">Carregando...</div>';

  // Pipeline, Glossário e Índice de navegação leem UM arquivo e montam a
  // árvore deles (documentacao-arvores.js). Não passam por list_agent_files:
  // o Pipeline se lê pelo `_niveis.json`, que começa com `_` e nem viria.
  if (fonte.render === 'niveis') {
    await _docArvCarregar();
    return;
  }

  // As fontes de árvore de pastas: list_agent_files é agnóstico de agente e
  // devolve os caminhos relativos já filtrados (arquivos começando com `_`
  // são internos e não vêm).
  const r = await window.pywebview.api.list_agent_files(currentProject, _docFonte);
  if (!r.success) {
    container.innerHTML = `<div class="doc-empty">Erro ao carregar ${escapeHtml(fonte.titulo)}.</div>`;
    return;
  }
  const files = (r.files || []).filter(f => f.endsWith('.md'));

  if (!files.length) {
    // Bibliotecas e Comentários se geram sozinhas na primeira abertura.
    // `jaGerou` corta o laço se a varredura não produzir arquivo (projeto sem
    // pasta de trabalho, por exemplo) — sem isso, um erro no backend viraria
    // recursão infinita.
    if (_DOC_FONTES_AUTOGERA.has(_docFonte) && !jaGerou) {
      await _docRegerar(true);
      return;
    }
    container.innerHTML = `<div class="doc-empty">Nada aqui ainda.<br>Execute o agente ${escapeHtml(fonte.agente)} primeiro.</div>`;
    _docShowPanel('default');
    return;
  }

  // Daqui para baixo toda fonte é 'arvore' — as 'niveis' saíram lá em cima.
  _docRenderTree(files);
}

// ── Regerar (as fontes de _DOC_FONTES_AUTOGERA) ───────────────────────────
// O agente é assíncrono: run_*_agent devolve na hora e o fim chega pelo callback
// da fonte, empurrado pelo backend. Por isso a recarga da árvore mora lá
// embaixo, no callback, e não aqui.

// Um id por rodada em voo, e não um booleano: as duas fontes podem estar
// gerando ao mesmo tempo (a Automação dispara as duas no mesmo ciclo), e um
// booleano faria a segunda desistir achando que a rodada era dela.
const _docRegerando = new Set();

async function _docRegerar(primeiraVez = false, fonteId = _docFonte) {
  const cfg = _DOC_AUTOGERA[fonteId];
  if (!cfg || _docRegerando.has(fonteId)) return;
  _docRegerando.add(fonteId);

  // Só escreve na árvore se a fonte pedida for a que está na tela.
  const container = fonteId === _docFonte ? document.getElementById('doc-tree') : null;
  if (container) {
    container.innerHTML = `<div class="doc-empty">${
      primeiraVez ? 'Gerando a lista pela primeira vez...' : 'Atualizando...'
    }<br>${escapeHtml(cfg.espera)}</div>`;
  }

  try {
    const r = await window.pywebview.api[cfg.run](currentProject);
    if (!r || !r.success) throw new Error((r && r.error) || 'falha ao iniciar');
  } catch (e) {
    _docRegerando.delete(fonteId);
    if (container) container.innerHTML = '<div class="doc-empty">Erro ao gerar a lista.</div>';
    showToast(cfg.erro, true);
  }
}

// O corpo comum dos callbacks. Pode chegar com a aba fechada (o agente também
// roda pelos Acionamentos e pelo card da aba Automação), daí as guardas.
function _docAutogeraProgresso(fonteId, data) {
  if (!data || data.status === 'running') return;
  _docRegerando.delete(fonteId);
  const cfg = _DOC_AUTOGERA[fonteId];

  if (data.status === 'error') {
    const container = document.getElementById('doc-tree');
    if (container && _docFonte === fonteId) {
      container.innerHTML = '<div class="doc-empty">Erro ao gerar a lista.</div>';
    }
    showToast(cfg.erro, true);
    return;
  }
  // `true` = não tente gerar de novo se ainda vier vazio.
  if (_docFonte === fonteId && document.getElementById('doc-tree')) {
    loadDocTree(true);
  }
}

// Globais — o backend chama estes dois nomes por evaluate_js.
//
// ⚠️ São o ÚNICO ponto de entrada de cada rotina, e moram aqui porque a aba
// Documentação funciona mesmo sem os cards da Automação carregados. Os cards
// registram `bibliotecasCardProgress`/`comentariosCardProgress`, chamados
// daqui — declarar `bibliotecasAgentProgress` também no card sobrescreveria
// esta, porque scripts clássicos compartilham o escopo global e este arquivo
// carrega depois.
function bibliotecasAgentProgress(data) {
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (data.project && data.project !== currentProject) return;
  _docAutogeraProgresso('bibliotecas', data);
  if (typeof bibliotecasCardProgress === 'function') bibliotecasCardProgress(data);
}

function comentariosAgentProgress(data) {
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (data.project && data.project !== currentProject) return;
  _docAutogeraProgresso('comentarios', data);
  if (typeof comentariosCardProgress === 'function') comentariosCardProgress(data);
}

// A árvore desta aba é o componente compartilhado (arvore-pastas.js) — foi
// daqui que ele saiu, e agora Mapa de I/O, Tree-sitter, Relações e Decisões
// apontam para o mesmo código.
function _docRenderTree(files) {
  const real = _docMapaVirtualParaReal(files);
  _docArvore = criarArvorePastas({
    container: document.getElementById('doc-tree'),
    caminhos: [...real.keys()],
    rotuloArquivo: (caminho, nome) => _docSepararContagem(_docTirarMd(nome)).rotulo,
    seloArquivo: caminho => _docSepararContagem(
      _docTirarMd(caminho.split('/').pop())).contagem,
    aoSelecionar: caminho => abrirDocArtefato(
      _docFonte, real.get(caminho) || caminho,
      _docSepararContagem(_docTirarMd(caminho.split('/').pop())).rotulo),
    vazio: 'Nada aqui ainda.',
  });
}

// No Resumo de pastas o `.md` de uma pasta mora AO LADO dela, não dentro:
// `Code/backend.md` é irmão da pasta `Code/backend/`. Numa árvore isso é ruim de
// ler — as pastas vêm antes dos arquivos, então o resumo de `backend` acaba lá
// embaixo, depois de todas as pastas irmãs, longe da pasta que ele resume.
//
// Aqui o caminho é reescrito para DENTRO da própria pasta
// (`Code/backend/backend.md`), e o mapa devolve o caminho real de volta na hora
// de abrir o arquivo — quem lê do disco continua recebendo o caminho de verdade.
// As outras fontes têm um `.md` por arquivo e passam por aqui sem mudança.
function _docMapaVirtualParaReal(files) {
  const mapa = new Map();
  _docVirtualDe = new Map();
  for (const rel of files) {
    let virtual = rel;
    if (_docFonte === 'resumo-pastas') {
      const nome = rel.split('/').pop();
      // `modulos (parte 2).md` resume a pasta `modulos`, não uma pasta chamada
      // `modulos (parte 2)` — o sufixo de lote não entra no caminho.
      const pasta = _docTirarMd(rel).replace(/ \(parte \d+\)$/, '');
      virtual = `${pasta}/${nome}`;
    }
    // Duas fontes nunca produzem o mesmo caminho, mas se produzissem o
    // primeiro venceria em silêncio — melhor deixar o real explícito.
    if (!mapa.has(virtual)) mapa.set(virtual, rel);
    _docVirtualDe.set(rel.replace(/\\/g, '/'), virtual);
  }
  return mapa;
}

function _docTirarMd(nome) {
  return nome.endsWith('.md') ? nome.slice(0, -3) : nome;
}

// Um ` (N)` no fim do nome vira contagem discreta à direita, em vez de fazer
// parte do rótulo. Quem usa isso é a fonte Bibliotecas, que precisa mostrar em
// quantos arquivos cada biblioteca é importada: o renderizador da árvore é
// compartilhado pelas sete fontes e não recebe metadado por fora, então a
// contagem viaja no próprio nome do arquivo.
// As outras fontes não têm esse padrão no nome e passam por aqui intactas.
const _DOC_RX_CONTAGEM = /^(.*?)\s\((\d+)\)$/;

function _docSepararContagem(nome) {
  const m = _DOC_RX_CONTAGEM.exec(nome);
  return m ? { rotulo: m[1], contagem: m[2] } : { rotulo: nome, contagem: null };
}

// Os nomes ficam: `acesso-rapido-comandos.js` os chama («Expandir/Retrair a
// árvore da Documentação»). A árvore de níveis tem o ⊞/⊟ dela.
function docExpandAll() {
  if (_docFonteAtual().render === 'niveis') { _docArvExpandirTudo(); return; }
  if (_docArvore) _docArvore.expandirTudo();
}

function docCollapseAll() {
  if (_docFonteAtual().render === 'niveis') { _docArvRetrairTudo(); return; }
  if (_docArvore) _docArvore.retrairTudo();
}

