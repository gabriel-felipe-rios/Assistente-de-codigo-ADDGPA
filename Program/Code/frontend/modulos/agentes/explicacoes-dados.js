// ═══════════════════════════════════════ AGENTES: O QUE CADA ROTINA É ══
// O que cada rotina é, num lugar só: a tabela de Automação › Explicações e a
// frase de cada card de Automação › Rotinas saem daqui (D29 — "um lugar só
// para manter").
//
// ⚠️ Mudar um texto aqui muda os dois lugares, e é de propósito. Antes a frase
// do card e a explicação da Referência eram escritas duas vezes, e as duas
// cópias divergiam na primeira rotina que mudava de comportamento.
//
// O Visualizar também lê daqui: os grupos (`grupo`), a ordem dos cards dentro
// de cada grupo (a ordem deste arquivo) e o selo de etapas (`etapas`).
//
// Carregado antes dos templates de card e de `referencia-template.js` — os
// dois chamam `explicacaoDoCard` / leem as constantes na hora em que montam.

// Os cinco grupos, na ordem do Visualizar e da tabela de Explicações.
const EXPLICACOES_GRUPOS = [
  { id: 'base',  titulo: 'A base' },
  { id: 'freio', titulo: 'O freio e a vez' },
  { id: 't1',    titulo: 'T1 · rápido, sem IA' },
  { id: 't2',    titulo: 'T2 · com IA, para o assistente' },
  { id: 't3',    titulo: 'T3 · com IA, lento, para você ler' },
];

// `comoRoda` é uma lista porque a Documentação Técnica tem dois jeitos: direto
// no arquivo que cabe, partes + costura no que não cabe.
//   tipo ∈ 'sem-ia' · 'embedding-local' · 'direto' · 'partes-costura'
// `etapas` = número de prompts: 1 roda de uma vez; 2 em partes, e depois a
// costura (D23, D32 — por isso não há um segundo selo).
const EXPLICACOES_ROTINAS = {
  'detector': {
    grupo: 'base', icone: '🛰️', nome: 'Detector',
    oQueFaz: 'Vê o que mudou em cada arquivo e decide quais rotinas isso merece acordar.',
    comoRoda: [{ tipo: 'sem-ia', nota: 'com embedding local só para texto que não é código' }],
    le: 'o disco · Hashes', quandoRefaz: 'a cada mudança', etapas: 1,
  },
  'hashes': {
    grupo: 'base', icone: '#️⃣', nome: 'Hashes',
    oQueFaz: 'Guarda uma impressão de cada arquivo. É o que deixa as outras pularem o que não mudou.',
    comoRoda: [{ tipo: 'sem-ia' }],
    le: 'o disco', quandoRefaz: 'só os arquivos que mudaram', etapas: 1,
  },
  'sincronia': {
    grupo: 'base', icone: '↔️', nome: 'Sincronia',
    oQueFaz: 'Arquivo movido, renomeado ou apagado: move, renomeia ou apaga as saídas dele, sem refazer nada com o modelo.',
    comoRoda: [{ tipo: 'sem-ia' }],
    le: 'Detector', quandoRefaz: 'só o que mudou de lugar', etapas: 1,
  },
  'espera': {
    grupo: 'freio', icone: '⏱️', nome: 'Espera',
    oQueFaz: 'Segura cada grupo até o disco ficar N segundos sem mudança nova. Um cronômetro por grupo.',
    comoRoda: [{ tipo: 'sem-ia' }],
    le: 'Detector', quandoRefaz: '—', etapas: 1,
  },
  'revezamento': {
    grupo: 'freio', icone: '🚦', nome: 'Revezamento',
    oQueFaz: 'O modelo atende um de cada vez: enquanto Chat, Fila ou outro projeto o usa, este espera a vez.',
    comoRoda: [{ tipo: 'sem-ia' }],
    le: '—', quandoRefaz: '—', etapas: 1,
  },
  'indice-simbolos': {
    grupo: 't1', icone: '🏷️', nome: 'Índice de Símbolos',
    oQueFaz: 'Nome, tipo e linha de toda função, classe e variável do projeto. Várias rotinas partem dele.',
    comoRoda: [{ tipo: 'sem-ia' }],
    le: 'o código', quandoRefaz: 'só os arquivos que mudaram', etapas: 1,
  },
  'identificadores': {
    grupo: 't1', icone: '🔤', nome: 'Índice de Identificadores',
    oQueFaz: 'Todo nome que vive em dois ou mais arquivos: acha a ligação que o import não mostra.',
    comoRoda: [{ tipo: 'sem-ia' }],
    le: 'Índice de Símbolos · código', quandoRefaz: 'tudo, a cada volta', etapas: 1,
  },
  'duplicados': {
    grupo: 't1', icone: '👯', nome: 'Duplicados',
    oQueFaz: 'Funções repetidas, inclusive a copiada e depois editada.',
    comoRoda: [{ tipo: 'sem-ia' }],
    le: 'Índice de Símbolos', quandoRefaz: 'só os arquivos que mudaram', etapas: 1,
  },
  'grafo-imports': {
    grupo: 't1', icone: '🔗', nome: 'Grafo de Imports',
    oQueFaz: 'Quem importa quem.',
    comoRoda: [{ tipo: 'sem-ia' }],
    le: 'o código', quandoRefaz: 'tudo, a cada volta', etapas: 1,
  },
  'bibliotecas': {
    grupo: 't1', icone: '📚', nome: 'Bibliotecas',
    oQueFaz: 'O que o projeto usa de fora, separando terceiros de biblioteca padrão.',
    comoRoda: [{ tipo: 'sem-ia' }],
    le: 'o código', quandoRefaz: 'lê só os arquivos que mudaram; a lista sai inteira', etapas: 1,
  },
  'comentarios': {
    grupo: 't1', icone: '💬', nome: 'Comentários',
    oQueFaz: 'A prosa que você escreveu no código: comentários e docstrings.',
    comoRoda: [{ tipo: 'sem-ia' }],
    le: 'o código', quandoRefaz: 'só os arquivos que mudaram', etapas: 1,
  },
  'doc-tecnica': {
    grupo: 't2', icone: '🗂️', nome: 'Documentação Técnica',
    oQueFaz: 'Por arquivo: a síntese (o que ele é e por quê), as atribuições, os metadados, os termos do projeto que aparecem nele e uma frase por símbolo, com a linha.',
    comoRoda: [{ tipo: 'direto', nota: '1 chamada por arquivo que mudou, com o arquivo inteiro' },
               { tipo: 'partes-costura', nota: 'só no arquivo que não cabe' }],
    le: 'código · Símbolos · Identificadores',
    quandoRefaz: 'síntese, atribuições e termos: a cada mudança · frase: só o símbolo que mudou',
    etapas: 2,
  },
  'indice-navegacao': {
    grupo: 't2', icone: '🗺️', nome: 'Índice de Navegação',
    oQueFaz: 'Uma linha por arquivo: recolhe a frase que a Documentação Técnica já escreveu.',
    comoRoda: [{ tipo: 'sem-ia' }],
    le: 'Documentação Técnica', quandoRefaz: 'tudo, a cada volta', etapas: 1,
  },
  'glossario': {
    grupo: 't2', icone: '📖', nome: 'Glossário',
    oQueFaz: 'Os termos próprios do projeto e o que cada um quer dizer aqui.',
    comoRoda: [{ tipo: 'direto', nota: '1 chamada por termo novo ou cujas evidências mudaram, várias ao mesmo tempo' }],
    le: 'Documentação Técnica', quandoRefaz: 'só o termo que mudou', etapas: 1,
  },
  'pipeline': {
    grupo: 't2', icone: '🔀', nome: 'Pipeline',
    oQueFaz: 'Narra o fluxo de execução em quatro níveis: áreas, blocos, cadeias e passos. Os agrupamentos e a ordem vêm do código; o modelo só escreve os nomes, os resumos e as frases.',
    comoRoda: [{ tipo: 'direto', nota: '1 chamada por cadeia com passo novo ou alterado; depois 1 por bloco e 1 por área que a régua mandar refazer, várias ao mesmo tempo' }],
    le: 'Índice de Símbolos · código', quandoRefaz: 'só os passos cujos arquivos mudaram (mover sem mudar não conta); cadeia, bloco e área pela régua de Configurações', etapas: 1,
  },
  'resumo-pastas': {
    grupo: 't3', icone: '📂', nome: 'Resumo de Pastas',
    oQueFaz: 'O papel de cada pasta, para você saber o que tem dentro sem abrir.',
    comoRoda: [{ tipo: 'partes-costura', nota: '1 chamada por pasta que cabe; a que não cabe vira partes e uma chamada final costura' }],
    le: 'Documentação Técnica', quandoRefaz: 'só a pasta que mudou o bastante', etapas: 2,
  },
  'embedding': {
    grupo: 't3', icone: '🔍', nome: 'Embedding Semântico',
    oQueFaz: 'Transforma os textos em números para a busca por sentido.',
    comoRoda: [{ tipo: 'embedding-local', nota: '1 por pedaço de texto que mudou' }],
    le: 'Doc. Técnica · Resumo de Pastas', quandoRefaz: 'só o pedaço que mudou', etapas: 1,
  },
};

// O rótulo de cada tipo de «Como roda», o mesmo nas duas telas.
const EXPLICACOES_TIPOS = {
  'sem-ia':          'Sem IA',
  'embedding-local': 'Embedding local',
  'direto':          'Direto',
  'partes-costura':  'Partes + costura',
};

// A frase do card de Automação › Rotinas: a coluna «O que faz» e o link que
// abre a sub-aba Explicações (o clique é delegado em `execucao/rotinas.js`).
function explicacaoDoCard(id) {
  const r = EXPLICACOES_ROTINAS[id];
  const frase = r ? r.oQueFaz : '';
  return `${frase} <a href="#" class="agente-desc-link" data-ir-explicacoes>Detalhes em Explicações.</a>`;
}
