// ══ DOCUMENTAÇÃO → o visualizador e o "copiar pro chat" ═══════════════════
//
// ⚠️ SÃO QUATRO BOTÕES DE COPIAR, E CADA UM COPIA OUTRA COISA: o caminho do
// CÓDIGO, o caminho do DOCUMENTO, o documento inteiro e o código-fonte por trás
// dele. Unificá-los num só faria o usuário ter de descobrir qual dos quatro ele
// recebeu — e é justamente na hora de colar no chat que isso importa.
//
// ⚠️ O ENVELOPE DE CONTEXTO É COMPARTILHADO (`envelopeDeContexto`, em
// `utils.js`), e não reescrito aqui: é o mesmo formato que o Editor e o Acervo
// usam, e o assistente aprendeu a reconhecê-lo.
//
// ⚠️ `_docOrigemDoDocumento` EXISTE PORQUE O DOCUMENTO NÃO É O CÓDIGO. Cada
// fonte da aba tem uma regra própria para voltar do artefato ao arquivo que o
// gerou, e errar essa volta copia o caminho de um arquivo que não existe.
// ── Viewer ────────────────────────────────────────────────────────────────

// ⚠️ HTML CRU NO DOCUMENTO VIRA TEXTO, NÃO ELEMENTO. Quem escreve estes .md é
// um modelo descrevendo código, e a frase dele cita tag por extenso ("empilha
// um <textarea> transparente sobre um <pre>"). Com o `marked` padrão aquilo
// virava um <textarea> de verdade no meio do Índice de navegação. Instância
// própria, e não `marked.use`, para não mudar o Editor e a aba Arquivos, que
// renderizam .md do usuário — lá o HTML embutido é intencional.
const _docMarked = new marked.Marked({
  renderer: { html: ({ text }) => escapeHtml(text) },
});

// As fontes que mostram «Tokens: N». Comentários e Bibliotecas ficam de fora:
// são listas extraídas do código, não texto que uma IA vai ler inteiro.
const _DOC_FONTES_COM_TOKENS = new Set([
  'documentacao-tecnica', 'resumo-pastas', 'glossario', 'indice-navegacao', 'pipeline',
]);

// Abre um .md de qualquer fonte. `agente` é o nome da pasta em `agentes/` —
// read_agent_file é agnóstico, então não há um caminho de leitura por fonte.
async function abrirDocArtefato(agente, docPath, label) {
  const r = await window.pywebview.api.read_agent_file(currentProject, agente, docPath);
  if (!r.success) { showToast('Erro ao abrir o documento.', true); return; }

  _docMostrarConteudo(agente, docPath, label, r.content);

  // Marca na coluna da esquerda. A árvore de pastas é indexada pelo caminho
  // VIRTUAL, então o real precisa ser traduzido antes: quem chega da busca
  // traz o caminho de disco. Nas árvores de níveis (Pipeline, Glossário,
  // Índice de navegação), o arquivo diz qual item marcar.
  const norm = docPath.replace(/\\/g, '/');
  if (_docArvore) _docArvore.expandirAte(_docVirtualDe.get(norm) || norm);
  if (agente === _docFonte && _DOC_ARVORES[agente]) _docArvMarcarPorArquivo(norm);
}

// Mostra um texto no visualizador. Separada da leitura porque a árvore de
// níveis entrega um PEDAÇO de arquivo (um tópico do Glossário, uma pasta do
// Índice) — e é esse pedaço que o «Tokens: N» conta e o «📋 Documento» copia.
function _docMostrarConteudo(agente, docPath, label, conteudo) {
  // O markdown cru fica guardado: o viewer só mostra o HTML já renderizado por
  // `marked`, e é o texto original que os botões de copiar levam pro chat.
  _docAberto = { fonte: agente, docPath, conteudo };

  document.getElementById('doc-viewer-filename').textContent = label;
  const alvo = document.getElementById('doc-viewer-content');
  alvo.innerHTML = _docMarked.parse(conteudo);
  // No Pipeline, o id citado no texto (A3, B12, C40) vira link para o item.
  if (agente === 'pipeline') _docPipeLigarIds(alvo);
  // Documento novo começa do topo — sem isto, o link de id clicado no fim de
  // um bloco abria a cadeia já rolada lá embaixo.
  alvo.scrollTop = 0;

  _docSyncBotoesCopiar();
  _docShowPanel('viewer');
  _docMostrarTokens();
}

// ── Copiar pro chat ───────────────────────────────────────────────────────

// O documento aberto no viewer agora, com o markdown cru junto.
let _docAberto = null;   // { fonte, docPath, conteudo }

// De qual arquivo (ou pasta) do usuário este documento saiu.
//
// A Documentação técnica espelha a árvore de código 1:1 e só
// acrescenta `.md` ao caminho — tirar a extensão devolve o arquivo de origem
// já com o nome da pasta de trabalho na frente (`Program/Code/...`), que é a
// forma que uma IA rodando na RAIZ do projeto espera. É a mesma convenção que
// `_inspetor_caminho_relativo` usa na aba Inspetor.
//
// O Resumo de pastas aponta pra uma PASTA, e pode trazer ` (parte N)` no nome
// quando a pasta foi resumida em lotes — o sufixo é do lote, não da pasta.
//
// As outras quatro fontes (Glossário, Índice de navegação, Pipeline e
// Bibliotecas) não saem de um arquivo do usuário: não têm origem.
function _docOrigemDoDocumento() {
  if (!_docAberto) return null;
  const caminho = _docTirarMd(_docAberto.docPath.replace(/\\/g, '/'));
  if (_docAberto.fonte === 'documentacao-tecnica') {
    return { tipo: 'arquivo', caminho };
  }
  if (_docAberto.fonte === 'resumo-pastas') {
    return { tipo: 'pasta', caminho: caminho.replace(/ \(parte \d+\)$/, '') };
  }
  return null;
}

// Cascas finas sobre o componente compartilhado (copiar-contexto.js). O corpo
// das duas era a unica implementacao do formato; virou compartilhada quando a
// aba Analise passou a copiar do mesmo jeito. O motivo do envelope esta la.
const _docCopiar = copiarContexto;

// O envelope: uma linha dizendo O QUE é o bloco, e o bloco marcado com o
// caminho. O `--- {nome} ---` é a mesma forma que o projeto já usa em quatro
// lugares para entregar arquivo a um modelo (chat_mensagem.py,
// glossario_indice.py, resumo_pastas.py e ferramentas_subagentes.py), e a linha
// de cabeçalho antes dele é a do relatório do Inspetor.
//
// ⚠️ Sem isso o modelo recebia uma parede de texto sem saber se era o CÓDIGO ou
// a DESCRIÇÃO dele — que é o erro caro aqui: ele responderia sobre o resumo
// achando que estava lendo o arquivo.
// Agora mora em copiar-contexto.js — o mesmo formato serve a aba Analise.
const _docEnvelope = envelopeDeContexto;

// Qual agente escreveu o documento aberto — é o que o cabeçalho precisa dizer,
// porque "documentação" sozinho não distingue a documentação técnica de um resumo de pasta.
function _docNomeDoAgente() {
  const fonte = _DOC_FONTES[_docAberto.fonte];
  return fonte ? fonte.agente : _docAberto.fonte;
}

function _docCopiarCaminho() {
  const origem = _docOrigemDoDocumento();
  if (!origem) return;
  const rotulo = origem.tipo === 'pasta' ? 'Caminho da pasta' : 'Caminho do arquivo';
  _docCopiar(`${rotulo} no projeto: ${origem.caminho}`, 'Caminho copiado.');
}

function _docCopiarCaminhoDocumento() {
  const origem = _docOrigemDoDocumento();
  if (!origem) return;
  const cabecalho = `Documentação gerada pelo agente ${_docNomeDoAgente()} deste projeto. `
    + (origem.tipo === 'pasta'
        ? 'É a descrição da pasta abaixo, escrita por uma IA — não é o código dela.'
        : 'É a descrição do arquivo abaixo, escrita por uma IA — não é o código dele.');
  _docCopiar(_docEnvelope(cabecalho, origem.caminho, _docAberto.conteudo),
             'Caminho e documento copiados.');
}

// O botão das fontes que não saem de arquivo nenhum: leva só o texto, sem
// marcador de caminho. Continua com a linha de cabeçalho — ela é o que diz ao
// modelo o que ele está lendo, e isso não depende de haver caminho.
function _docCopiarDocumento() {
  if (!_docAberto) return;
  _docCopiar(`Documentação gerada pelo agente ${_docNomeDoAgente()} deste projeto.\n\n${_docAberto.conteudo}`,
             'Documento copiado.');
}

async function _docCopiarCodigo() {
  const origem = _docOrigemDoDocumento();
  if (!origem || origem.tipo !== 'arquivo') return;
  const r = await window.pywebview.api.ler_arquivo_de_codigo(currentProject, origem.caminho);
  if (!r.success) { showToast(r.error || 'Erro ao ler o arquivo de código.', true); return; }
  _docCopiar(_docEnvelope('Conteúdo do arquivo de código abaixo, como está no projeto agora.',
                          origem.caminho, r.content),
             'Caminho e código copiados.');
}

// Cada fonte mostra só os botões que fazem sentido nela — os outros nem
// aparecem. A origem do documento já responde isso sozinha:
//
//   arquivo (Documentação técnica)           → Caminho · +documento · +código
//   pasta   (Resumo de pastas)               → Caminho · +documento
//   nenhuma (Glossário, Índice de navegação,
//            Pipeline, Bibliotecas)          → Documento
//
// ⛔ Os que não se aplicam ficam ESCONDIDOS, não desabilitados. Botão apagado
// convida o clique e depois explica que não podia — e aqui não há o que
// explicar: "Caminho + código" no Glossário não é uma indisponibilidade
// temporária, é uma operação que não existe naquela fonte.
function _docSyncBotoesCopiar() {
  const origem = _docOrigemDoDocumento();
  const visiveis = {
    'btn-doc-copiar-caminho':           !!origem,
    'btn-doc-copiar-caminho-documento': !!origem,
    'btn-doc-copiar-caminho-codigo':    !!origem && origem.tipo === 'arquivo',
    'btn-doc-copiar-documento':         !origem,
  };
  for (const [id, mostrar] of Object.entries(visiveis)) {
    document.getElementById(id).classList.toggle('hidden', !mostrar);
  }
  if (origem) {
    const rotulo = origem.tipo === 'pasta' ? 'da pasta' : 'do arquivo';
    document.getElementById('btn-doc-copiar-caminho').title = `Copiar o caminho ${rotulo}: ${origem.caminho}`;
  }
}

// «Tokens: N» do documento aberto — o texto que aparece aqui, o mesmo que
// «📋 Documento» leva, não o arquivo de código por trás dele. Conta no backend
// (tiktoken), nunca `caracteres / 4`. Sem tiktoken a conta é estimativa, e o
// «≈» diz isso.
async function _docMostrarTokens() {
  const el = document.getElementById('doc-viewer-tokens');
  const aberto = _docAberto;
  el.classList.add('hidden');
  if (!aberto || !_DOC_FONTES_COM_TOKENS.has(aberto.fonte)) return;
  const r = await window.pywebview.api.contar_tokens_textos([aberto.conteudo]);
  // Guarda de corrida: outro documento pode ter sido aberto durante a contagem.
  if (_docAberto !== aberto || !r || !r.success) return;
  el.textContent = `Tokens: ${r.exata ? '' : '≈'}${r.tokens.toLocaleString('pt-BR')}`;
  el.title = r.exata ? 'Contado pelo tiktoken' : 'Estimativa — tiktoken não instalado';
  el.classList.remove('hidden');
}

function _docShowPanel(panel) {
  document.getElementById('doc-placeholder').classList.toggle('hidden', panel !== 'default');
  document.getElementById('doc-search-results').classList.toggle('hidden', panel !== 'results');
  document.getElementById('doc-viewer').classList.toggle('hidden', panel !== 'viewer');
}
