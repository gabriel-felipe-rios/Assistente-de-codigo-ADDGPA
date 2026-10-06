// ═══════════ Configurações → Arquivos que o programa lê → QUEM LÊ O QUÊ ══
// SÓ LEITURA (D38): uma linha por parte do programa que lê arquivo, e o que
// ela obedece. Não grava nada e não tem arquivo — o que se edita mora em
// Exceções (`config-arquivos-lidos-excecoes.js`). «Quem lê o quê, legal, ele
// ficou só informativo agora, tá certo».
//
// ⚠️ A TABELA DIZ O QUE O CÓDIGO FAZ HOJE. Mudou a regra de leitura num destes
// lugares, mude a linha aqui junto — é a única tela que junta todas:
//   · Contagem e mapas → `indexacao.scan_workspace`, `analise_grafo`, `complexidade`
//   · Documentação Técnica → `rotinas_leitura` + `rotinas_config.lista_das_rotinas`
//   · Busca visual → `aparencia.py` (pasta e arquivo de Nunca ler valem; extensão não)
//   · Busca de usos → `indexacao.find_symbol_usages`
//   · Mapa de I/O → `analise.scan_file_io` (só Remover; o conjunto `CODE_EXTS`)
//   · Editor → `editor_arvore._ed_visivel` (mostra tudo, da raiz)
//   · Subagentes e MCP → `ferramentas_subagentes_*` (`_sub_escopo`, `_sub_ignore_checker`)
//   · Ferramenta de extensão → `ferramentas_subagentes_extensao` (o programa não lê nada aqui)
//
// «Contexto sem leitura» não tem liga/desliga geral: o controle é o «Mesmo
// assim, pode ler» de cada item, em Projeto (D45).

const EXT_OBEDECE   = '<span class="ext-selo filtra">obedece</span>';
const EXT_IGNORA    = '<span class="ext-selo tudo">ignora</span>';
const EXT_DESCRICAO = '<span class="ext-selo filtra">lê a descrição</span>';

const _extN = lista => `${lista.length} extensões`;

const EXT_LEITORES = [
  { chave: 'contagem', nome: 'Contagem e mapas',
    onde: 'Projeto › Resumo · Mapas · Análise › Complexidade',
    pasta: 'de trabalho', nunca: EXT_OBEDECE, remover: EXT_OBEDECE,
    contexto: '<span class="ext-selo filtra">indexado: pula</span> <span class="ext-selo tudo">completo: conta</span>',
    le: () => `<span class="ext-selo filtra">lista de código</span> ${_extN(_extListaDeCodigo())}` },
  { chave: 'documentacao_tecnica', nome: 'Documentação Técnica',
    onde: 'Automação',
    pasta: 'de trabalho', nunca: EXT_OBEDECE, remover: EXT_OBEDECE, contexto: EXT_DESCRICAO,
    le: () => `lista de código + exceções · ${_extN(_extListaDaParte('documentacao_tecnica'))}` },
  { chave: 'busca_visual_codigo', nome: 'Busca visual · texto e cor',
    onde: 'Aparência',
    pasta: 'de trabalho', nunca: '<span class="ext-selo tudo">ignora as extensões</span>',
    remover: EXT_OBEDECE, contexto: EXT_IGNORA,
    le: () => `lista da busca visual + exceções · ${_extN(_extListaDaParte('busca_visual_codigo'))}` },
  { chave: 'busca_visual_imagens', nome: 'Busca visual · imagem',
    onde: 'Aparência',
    pasta: 'de trabalho', nunca: '<span class="ext-selo tudo">ignora as extensões</span>',
    remover: EXT_OBEDECE, contexto: EXT_IGNORA,
    le: () => `lista de imagens + exceções · ${_extN(_extListaDaParte('busca_visual_imagens'))}` },
  { chave: 'busca_de_usos', nome: 'Busca de usos',
    onde: 'Análise › Símbolos · <code>me_usam</code>',
    pasta: 'de trabalho', nunca: EXT_OBEDECE, remover: EXT_OBEDECE, contexto: EXT_IGNORA,
    le: () => `lista da busca de usos + exceções · ${_extN(_extListaDaParte('busca_de_usos'))}` },
  { chave: 'mapa_de_io', nome: 'Mapa de I/O',
    onde: 'Análise › Mapa de I/O',
    pasta: 'de trabalho', nunca: EXT_IGNORA, remover: EXT_OBEDECE, contexto: EXT_IGNORA,
    le: 'o conjunto dele: 20 extensões de linguagem, sem <code>.html</code> e <code>.css</code>' },
  { chave: 'editor', nome: 'Editor',
    onde: 'a aba Editor e a busca Por nome / Por conteúdo',
    pasta: '<b>raiz</b>', nunca: EXT_IGNORA, remover: EXT_IGNORA, contexto: EXT_IGNORA,
    le: '<b>tudo de tudo</b>, como o VS Code' },
  { chave: 'subagentes_e_mcp', nome: 'Subagentes e MCP',
    onde: 'Chat · Fila · <code>grep</code> · <code>ler_arquivo</code> · <code>listar_pasta</code>',
    pasta: 'de trabalho', nunca: EXT_IGNORA, remover: EXT_OBEDECE, contexto: EXT_DESCRICAO,
    le: 'tudo, menos binário no <code>grep</code>' },
];

function _extQuemDesenhar() {
  const corpo = document.getElementById('ext-leitores');
  if (!corpo || !_extExcecoes || !_extCodigo) return;
  corpo.innerHTML = EXT_LEITORES.map(l => `
    <tr>
      <td><div class="leitor-nome">${escapeHtml(l.nome)}</div>
          <div class="leitor-onde">${l.onde}</div></td>
      <td>${l.pasta}</td>
      <td>${l.nunca}</td>
      <td>${l.remover}</td>
      <td>${l.contexto}</td>
      <td>${typeof l.le === 'function' ? l.le() : l.le}</td>
    </tr>`).join('');
}
