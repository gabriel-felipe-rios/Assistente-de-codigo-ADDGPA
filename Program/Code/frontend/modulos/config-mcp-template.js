// ══════════════════════════ TEMPLATE: Configurações — Servidor MCP ══
// Os limites do servidor MCP — o que o 🤖 assistente externo recebe quando
// chama uma ferramenta do Vibe-Coding. Eram onze números cravados dentro do
// `server/ferramentas_mcp.py`, sem tela nenhuma.
//
// ⚠️ **Só limites moram aqui.** Ligar e desligar cada ferramenta continua em
// Arquivos → MCPs, e não é descuido: o toggle é POR PROJETO (vai para o
// `Workspace.json` daquele projeto e vira o `--enabled` do `.mcp.json` dele),
// enquanto estes limites são do PROGRAMA e valem em todos. Juntar as duas
// coisas numa tela só faria o usuário desligar uma ferramenta achando que
// desligou em todo lugar.
//
// ⚠️ A REGRA DA UNIDADE, a mesma de `config-ferramentas-template.js`:
//
//   **token** para o que protege A JANELA DE CONTEXTO de quem pergunta — o que
//   recorta o texto que vai ao modelo. Caractere não diz quanto de janela
//   custa: 120 caracteres de código denso e 120 de prosa não custam o mesmo.
//
//   **caractere** só onde o corte é de APRESENTAÇÃO, não de orçamento. Há **um**
//   caso assim nesta tela, e um só: o corte de cada linha do `grep`, que é
//   amostra para o assistente se localizar, não texto que ele precise ler
//   inteiro. O corte do glossário já esteve em caractere e estava ERRADO, porque
//   o que ele recorta é o que entra na janela.
//
//   **contagem de itens** é o terceiro caso, que não existe na tela dos
//   subagentes: níveis, candidatos, pares, símbolos. A unidade é o próprio item.
//
// Precisa rodar DEPOIS de `config-categorias.js` e de `config-template.js`.

// `chave` é a chave em `settings.json`. O padrão de fábrica vem do backend
// (`PADROES_DO_MCP`), nunca digitado aqui — duas listas de padrão divergem no
// primeiro dia em que alguém mexe numa delas.
const CONFIG_MCP_GRUPOS = [
  {
    titulo: 'Quanto texto cabe numa resposta',
    dica: 'Em token, porque é a janela de contexto do assistente externo que estes números protegem. Quando um corte acontece, a resposta sempre diz quanto ficou de fora.',
    campos: [
      { chave: 'mcp_teto_ler_arquivo_tokens', min: 1000, max: 200000, unidade: 'tokens',
        rotulo: 'Teto do <code>ler_arquivo</code>',
        ajuda: '⚠️ Até 22/08/2026 o MCP não tinha teto próprio: usava o da categoria <b>Ferramentas dos subagentes</b>, que foi dimensionado para a janela do LM Studio local. O assistente externo tem uma janela muito maior e vinha recebendo arquivo cortado sem motivo.' },
      { chave: 'mcp_teto_parte_tokens', min: 1000, max: 200000, unidade: 'tokens',
        rotulo: 'Teto de uma parte (<code>pipeline</code>, <code>grafo_imports</code>, <code>resumo_pastas</code>, <code>indice_navegacao</code>, <code>doc_tecnica</code>)',
        ajuda: 'Estes quatro artefatos são servidos em partes. Abaixo deste teto o artefato vai inteiro; acima, vem o índice das partes para o assistente pedir uma por vez. Pondo <b>16000</b> aqui, o índice de navegação (15.497 tokens) volta a caber inteiro numa chamada só — e o <code>pipeline</code> (19.369) continua vindo em partes. O <code>doc_tecnica</code> e o <code>resumo_pastas</code>, lidos por seção, enchem a resposta até este teto e terminam dizendo o que ficou de fora.' },
      { chave: 'mcp_glossario_tokens', min: 200, max: 50000, unidade: 'tokens',
        rotulo: 'Corte do <code>glossario</code>',
        ajuda: 'Vale para o glossário inteiro e para o bloco de um termo.' },
      { chave: 'mcp_busca_semantica_excerpt_tokens', min: 10, max: 500, unidade: 'tokens',
        rotulo: 'Trecho de cada candidato da <code>busca_semantica</code>',
        ajuda: 'É a amostra que deixa o assistente decidir qual candidato vale abrir. Gêmeo do mesmo campo na categoria Ferramentas dos subagentes.' },
    ],
  },
  {
    titulo: 'Quantos itens cada ferramenta lista',
    dica: 'A unidade aqui é o próprio item — não é token nem caractere. Em todas, o total encontrado aparece na resposta mesmo quando a lista é cortada.',
    campos: [
      { chave: 'mcp_cascata_nivel', min: 1, max: 9, unidade: 'níveis',
        rotulo: 'Profundidade da cascata de <code>relacoes_uso</code>',
        ajuda: 'Quantos saltos de dependência a cascata percorre a partir do arquivo. Mais fundo acha mais coisa que quebra, e devolve mais texto.' },
      { chave: 'mcp_onde_esta_max_simbolos', min: 1, max: 300, unidade: 'símbolos',
        rotulo: 'Símbolos que <code>onde_esta</code> lista',
        ajuda: 'Os de nome exato primeiro, depois os parciais.' },
      { chave: 'mcp_busca_semantica_candidatos', min: 1, max: 50, unidade: 'candidatos',
        rotulo: 'Candidatos da <code>busca_semantica</code>',
        ajuda: 'A busca semântica é um achador, não a resposta final — o assistente ainda abre os candidatos para conferir.' },
      { chave: 'mcp_duplicados_max_pares', min: 1, max: 500, unidade: 'pares',
        rotulo: 'Pares que <code>duplicados</code> lista',
        ajuda: 'Os mais parecidos primeiro.' },
      { chave: 'mcp_arquivos_grandes_max', min: 1, max: 300, unidade: 'arquivos',
        rotulo: 'Arquivos que <code>arquivos_grandes</code> lista',
        ajuda: 'Do maior para o menor.' },
      { chave: 'mcp_io_max_arquivos', min: 1, max: 200, unidade: 'arquivos',
        rotulo: 'Arquivos que <code>io</code> lista' },
      { chave: 'mcp_io_max_operacoes', min: 1, max: 500, unidade: 'operações',
        rotulo: 'Operações de disco por arquivo, no <code>io</code>',
        ajuda: 'O <code>io</code> corta em dois eixos: quantos arquivos, e quantas operações dentro de cada um.' },
      { chave: 'mcp_grep_max_ocorrencias', min: 1, max: 1000, unidade: 'ocorrências',
        rotulo: 'Ocorrências que o <code>grep</code> lista',
        ajuda: '⚠️ Mesma história do teto do <code>ler_arquivo</code>: este limite vinha da categoria <b>Ferramentas dos subagentes</b> (50), dimensionada para a janela do LM Studio local, e o assistente externo recebia amostra apertada sem motivo nenhum. É quantas linhas a amostra mostra; quanto de cada linha aparece é o cartão de baixo.' },
      { chave: 'mcp_grep_max_arquivos', min: 1, max: 300, unidade: 'arquivos',
        rotulo: 'Arquivos que o <code>grep</code> lista',
        ajuda: 'A lista de quem tem mais ocorrências, que vem antes da amostra. Vinha dos <b>Ferramentas dos subagentes</b> (20), pelo mesmo motivo do campo acima.' },
      { chave: 'mcp_listar_pasta_max_itens', min: 1, max: 1000, unidade: 'itens',
        rotulo: 'Itens que o <code>listar_pasta</code> lista',
        ajuda: 'Pastas e arquivos de uma listagem comum. Vinha dos <b>Ferramentas dos subagentes</b> (100), também dimensionado para a janela do LM Studio local.' },
      { chave: 'mcp_listar_pasta_primeiro_nivel', min: 1, max: 300, unidade: 'itens',
        rotulo: 'Itens da raiz, no <code>listar_pasta</code>',
        ajuda: 'Corta só a listagem da RAIZ — que no MCP são as pastas de trabalho do projeto, quase sempre poucas. Praticamente nunca bate: existe por simetria com o campo acima.' },
    ],
  },
  {
    // ⚠️ O TERCEIRO CARTÃO EXISTE PORQUE A UNIDADE É OUTRA, e não por gosto de
    // organização. Pôr este campo no primeiro cartão faria a dica dele ("Em
    // token, porque é a janela de contexto…") mentir; pôr no segundo faria a
    // dica de lá ("A unidade aqui é o próprio item — não é token nem caractere")
    // mentir. Dica de cartão que não vale para todos os campos dele é defeito.
    titulo: 'Quanto de cada linha aparece',
    dica: 'A unidade aqui é o caractere — e é o único caso da tela. Caractere só vale onde o corte é de apresentação, nunca de orçamento: a linha casada do grep é amostra para o assistente se localizar, não texto que ele precise ler inteiro.',
    campos: [
      { chave: 'mcp_grep_corte_linha_chars', min: 20, max: 1000, unidade: 'caracteres',
        rotulo: 'Corte de cada linha do <code>grep</code>',
        ajuda: 'Vale para cada linha da amostra, não para a resposta inteira — quantas linhas aparecem é o campo <b>Ocorrências que o <code>grep</code> lista</b>. Vinha da categoria <b>Ferramentas dos subagentes</b> (120), dimensionada para a janela do LM Studio local.' },
    ],
  },
];

(function () {
  const grupos = CONFIG_MCP_GRUPOS.map(g => {
    const campos = g.campos.map(c => `
          <div class="config-field-row">
            <label for="cmcp-${c.chave}">${c.rotulo}${c.unidade ? ` <span class="config-unidade">(${c.unidade})</span>` : ''}</label>
            <input type="number" id="cmcp-${c.chave}"
                   min="${c.min}" max="${c.max}" step="1" />
            ${c.ajuda ? `<p class="config-nota">${c.ajuda}</p>` : ''}
          </div>`).join('');
    return `
      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">${g.titulo}</div>
          <p class="config-cartao-dica">${g.dica}</p>
        </div>
        <div class="config-grade">${campos}</div>
      </div>`;
  }).join('');

  // ⚠️ O AVISO NÃO É OPCIONAL, mas diz o contrário do que dizia até 23/09/2026:
  // os limites são relidos a cada chamada (`_mcp_limite`); só os toggles
  // (`--enabled`, em Arquivos → MCPs) esperam a próxima sessão.
  const aviso = `
      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Os limites valem na hora</div>
          <p class="config-cartao-dica">O assistente relê estes números a cada ferramenta que chama — o que você salvar aqui vale já na próxima chamada, sem reabrir a sessão. Ligar ou desligar uma ferramenta (em Arquivos › MCPs) é que vale na próxima sessão do assistente externo.</p>
        </div>
      </div>`;

  // Um cabeçalho por servidor (ver `Program/Code/server/`). Os três cartões de
  // limite acima só valem para o Assistente — as 19 ferramentas de leitura,
  // que são as únicas que devolvem texto ao assistente externo. O Trabalhos
  // (as 8 do Quadro) não tem nada para limitar aqui: ver o cartão fixo abaixo.
  const cabAssistente = `
      <div class="srv-cab">
        <span class="srv-nome">Servidor Assistente</span>
        <span class="srv-chave">assistente</span>
        <span class="srv-linha"></span>
        <span class="badge-file-count">19 ferramentas</span>
      </div>`;

  const cabTrabalhos = `
      <div class="srv-cab">
        <span class="srv-nome">Servidor Trabalhos</span>
        <span class="srv-chave">trabalhos</span>
        <span class="srv-linha"></span>
        <span class="badge-file-count">8 ferramentas</span>
      </div>
      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Este servidor não tem limites para ajustar</div>
          <p class="config-cartao-dica">As oito ações do Quadro escrevem no <code>Estado.json</code> — elas não devolvem texto ao assistente, então não há teto de token nem de item a definir. O que se configura do lado de Trabalhos são os <b>bloqueios de comando</b>, os <b>gatilhos</b> e os <b>limites</b>, e eles moram em <b>Trabalhos → Configuração</b>, por projeto.</p>
        </div>
      </div>`;

  registrarCategoriaConfig({
    chave: 'mcp',
    // ⚠️ Glifo monocromático, e não emoji: as outras dez categorias usam
    // `◑ ▦ ⚒ ◈ ◧ ⟳ ◐ ⠿ ◆ ◷`, todos herdando a cor do texto do trilho. Um emoji
    // colorido aqui quebrava a fileira inteira. `⇄` diz o que este servidor é:
    // troca com um programa de fora. Ver `Componentes/Trilho de categorias.md`.
    icone: '⇄',
    rotulo: 'Servidores MCP do programa',
    resumo: 'quanto cada ferramenta devolve ao assistente externo',
    conteudo: cabAssistente + grupos + cabTrabalhos + aviso,
    acoes: '<button class="btn btn-positive" id="btn-save-mcp">Salvar servidores MCP</button>',
  });
})();
