// ═══════════════════════════ TEMPLATE: Configurações — Servidores MCP ══
// Onde a PASTA de um MCP de terceiro é copiada, dentro do projeto do usuário.
//
// ⚠️ **Esta categoria não é a de cima.** "Servidores MCP do programa"
// (`config-mcp-template.js`, chave `mcp`) são os LIMITES dos dois servidores
// que o programa traz: quanto cada ferramenta devolve ao assistente externo.
// Esta (chave `mcps`) é o que o programa faz ao LIGAR um MCP que veio de fora.
// A diferença de uma letra na chave é deliberada, e as duas têm "Restaurar
// padrão" separado: quem afinou vinte limites não pode perdê-los ao consertar
// um caminho de pasta.
//
// ⚠️ **POR QUE ISTO NÃO MORA NO PRESET DO ASSISTENTE EXTERNO.** O preset guarda
// o que VARIA entre Claude Code, Cursor e Codex. O destino do arquivo de
// REGISTRO varia mesmo (`.mcp.json` × `.cursor/mcp.json`) e continua lá. O
// destino da PASTA não varia: o apontador guarda caminho absoluto, e nenhum
// assistente exige nada sobre onde o servidor fica.
//
// ⚠️ **A grafia `MCPs` é obrigatória** — M, C, P maiúsculos, s minúsculo. É o
// mesmo texto do nome da categoria na biblioteca (`Arquivos/MCPs/`) e da
// sub-aba. Uma terceira grafia aqui faria o usuário procurar a pasta errada.
//
// Precisa rodar DEPOIS de `config-categorias.js` e de `config-template.js`.

(function () {
  if (typeof registrarCategoriaConfig !== 'function') return;

  const conteudo = `
      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Onde a pasta do MCP é copiada</div>
          <p class="config-cartao-dica">Ligar um MCP de terceiro <b>copia a pasta dele</b> para dentro do projeto e escreve um apontador no arquivo de registro do assistente externo. Este campo diz para qual subpasta do projeto a cópia vai — o caminho é relativo à raiz.</p>
        </div>
        <div class="config-grade">
          <div class="config-field-row">
            <label for="cmcps-mcps_destino_da_pasta">Destino da pasta, dentro do projeto</label>
            <input type="text" id="cmcps-mcps_destino_da_pasta" spellcheck="false" />
            <p class="config-nota">Padrão: <code>MCPs</code>. Campo vazio volta ao padrão. Os dois servidores <b>do programa</b> (Assistente e Trabalhos) não são copiados e não passam por aqui — o código deles mora dentro do próprio programa.</p>
          </div>
        </div>
      </div>
      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Desligar um MCP apaga a cópia</div>
          <p class="config-cartao-dica">É o contrário do que vale para regra, instrução e instruções base, cuja cópia fica no projeto porque você a edita. A de um MCP é código gerado — mas, se ela estiver <b>diferente</b> do molde da biblioteca, o programa pergunta antes de apagar.</p>
        </div>
      </div>
      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Vale na próxima vez que você ligar</div>
          <p class="config-cartao-dica">Mudar este caminho <b>não move</b> o que já está instalado: o apontador dos MCPs já ligados continua no lugar antigo, e ele funciona. Para mudá-los de pasta, desligue e ligue de novo.</p>
        </div>
      </div>`;

  registrarCategoriaConfig({
    chave: 'mcps',
    // Glifo monocromático, como as outras — ver `Componentes/Trilho de
    // categorias.md`. `⊞` diz o que esta categoria é: o que se ACRESCENTA de
    // fora, ao lado do `⇄` dos dois que já vêm dentro.
    icone: '⊞',
    rotulo: 'Servidores MCP',
    resumo: 'o que acontece ao ligar um MCP que veio de fora',
    conteudo,
    acoes: '<button class="btn btn-positive" id="btn-save-mcps">Salvar servidores MCP</button>',
  });
})();
