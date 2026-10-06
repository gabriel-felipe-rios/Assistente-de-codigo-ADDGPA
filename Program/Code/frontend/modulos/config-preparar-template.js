// ══════════════════════════════════ CONFIGURAÇÕES: Preparar projeto
// O molde que todo projeto novo recebe. Existe porque os destinos do Preparar
// estavam cravados no código, todos no formato do Claude Code — quem usa Cursor
// ou Codex tinha de arrumar tudo na mão depois de cada projeto.
//
// ⚠️ Glifo monocromático, e não emoji: as outras onze categorias usam
// `◑ ▦ ⚒ ◈ ⇄ ◧ ⟳ ◐ ⠿ ◆ ◷`, todos herdando a cor do texto do trilho. Um emoji
// colorido aqui quebraria a fileira inteira — ver `Componentes/Trilho de
// categorias.md`. `⊞` diz o que a categoria é: um molde, uma grade a preencher.
// (Os emojis dos CARTÕES do painel Preparar são outra história, e ficam: a
// regra é do trilho, e não foi estendida até lá — D33.)
//
// O casco é estático; as listas e os campos são pintados por `config-preparar.js`
// a partir do preset selecionado — trocar de preset repinta tudo abaixo das
// pílulas, e um markup fixo por preset não teria como.
//
// ⚠️ NÃO HÁ MAIS CARTÃO DE DESTINO AQUI, e nem o texto do CLAUDE.md. Os dois
// saíram em 2026-09-02. O destino é do ASSISTENTE EXTERNO (Configurações ›
// Assistentes externos), e o texto virou um ITEM DA BIBLIOTECA, em
// `Arquivos/Instruções base/`. O início rápido responde só duas perguntas:
// QUAIS itens vão, e QUE PASTAS nascem junto.
//
// ⚠️ O que ficou no lugar deles é um ESPELHO SÓ-LEITURA dos destinos que vêm do
// assistente escolhido. Ele existe para a pergunta "para onde isso vai?" ter
// resposta na tela onde ela nasce — mas editá-lo aqui recriaria a segunda
// verdade que a fusão desfez, e por isso ele não é editável.
//
// ⚠️ "O que este preset copia da biblioteca" tem DOIS níveis de aba, e não uma
// lista corrida de caixas. Eram quatro caixas (um tipo cada); com a escolha item
// por item viraram quatro listas empilhadas, e uma lista corrida cresce com a
// biblioteca até o cartão não caber na tela. As abas dão altura constante.
//
//   nível 1 — a CATEGORIA. São SEIS desde 2026-09-02: Skills · Comandos ·
//             Servidores MCP · Regras e instruções · Instruções base ·
//             Agentes. Classe `.cpr-bib-aba`, própria, e não reusa
//             `.subtab-btn`: aquela é navegação de segundo nível registrada em
//             `tab-order.js` por `data-taborder-group`, e esta seleciona
//             CONTEÚDO dentro de um cartão — ver `Componentes/Barra de
//             sub-abas.md`, "Sub-aba sem painel próprio". O desenho (sublinhado
//             teal, 13px/500) é o mesmo de propósito.
//   nível 2 — a ORIGEM (Favoritos · Gerais, mais Do programa só em Servidores
//             MCP). Aqui é reuso de verdade:
//             `.arq-inner-tabs` / `.arq-inner-tab` (`arquivos.css`), o MESMO
//             componente e os MESMOS rótulos da aba Arquivos. É a mesma
//             separação, e ver dois desenhos diferentes para ela custaria mais
//             que a classe compartilhada.
//
// ⚠️ "Marcar todos" e "Limpar" ficam na fileira do nível 2, e agem **só sobre a
// origem aberta**. É onde o usuário os pediu, e é a única leitura possível de um
// botão que mora ao lado de "Favoritos / Gerais".
//
// ⚠️ "Do programa" é uma TERCEIRA sub-aba, e só em `mcps`: os dois servidores do
// programa (Assistente e Trabalhos) não são favoritos nem gerais — é fato do
// item, não escolha do usuário. Igualzinho à aba Arquivos, de propósito.
//
// ⚠️ A fileira de origem só aparece em QUATRO das seis (D11):
// `instrucoes-base` e `agentes` entraram na seleção sem entrar na marca de
// origem. Quem diz isso é o campo `tem_origem` que o backend manda junto — não
// há `if` por nome de categoria em lugar nenhum desta tela.
//
// ⚠️ `instrucoes-base` é de ESCOLHA ÚNICA (radio), e também não por um `if`: o
// backend manda `escolha_unica` na mesma lista. O motivo é físico — o destino
// dela é a raiz do projeto, e dois itens marcados copiariam para o mesmo
// caminho, o segundo por cima do primeiro, sem aviso nenhum.
(function () {
  if (typeof registrarCategoriaConfig !== 'function') return;

  registrarCategoriaConfig({
    chave: 'preparar',
    rotulo: 'Preparar projeto',
    icone: '⊞',
    resumo: 'o molde que todo projeto novo recebe',
    conteudo: `
      <div class="config-cartao" data-config-busca="início rápido molde duplicar renomear">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Inícios rápidos</div>
          <p class="config-cartao-dica">
            Um início rápido é o molde que um projeto novo recebe de uma vez: quais itens da
            biblioteca vão e quais pastas nascem junto. Escolha um para editar abaixo.
          </p>
        </div>
        <div class="cpr-pills" id="cpr-pills"></div>
        <div class="cpr-pill-acoes">
          <button type="button" class="btn btn-muted btn-sm" id="btn-cpr-renomear">Renomear</button>
          <button type="button" class="btn btn-muted btn-sm" id="btn-cpr-duplicar">Duplicar</button>
          <button type="button" class="btn btn-muted btn-sm" id="btn-cpr-excluir">Excluir</button>
        </div>
        <p class="config-nota config-nota-alerta hidden" id="cpr-erros"></p>
      </div>

      <div class="cpr-editando">Editando o início rápido <b id="cpr-editando-nome">—</b></div>

      <div class="config-cartao" data-config-busca="assistente externo destino para onde vai">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Assistente externo</div>
          <p class="config-cartao-dica">
            Qual assistente este início rápido prepara. É dele que vem <b>para onde</b> cada
            categoria é copiada e <b>com que nome</b> o arquivo de instrução base chega.
            Ao preparar, ele também passa a ser o assistente do projeto.
          </p>
        </div>
        <div class="cpr-campo-solto">
          <select id="cpr-assistente"></select>
        </div>
        <div class="cfa-grade" id="cpr-espelho"></div>
        <p class="config-nota">
          Só leitura. Para mudar um destino, é em
          <b>Configurações › Assistentes externos</b> — aqui ele apareceria como uma segunda
          resposta para a mesma pergunta.
        </p>
      </div>

      <div class="config-cartao" data-config-busca="copiar skills comandos mcp regras biblioteca itens do programa geral">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">O que este início rápido copia da biblioteca</div>
          <p class="config-cartao-dica">
            Item por item, em seis abas. Aba <b>sem nada marcado</b> é uma categoria que o
            Preparar pula inteira — como um destino em branco no assistente.
          </p>
        </div>
        <div class="cpr-bib-abas" id="cpr-bib-abas"></div>
        <div id="cpr-bib-busca"></div>
        <div class="cpr-bib-barra" id="cpr-bib-barra"></div>
        <div class="cpr-bib" id="cpr-bib"></div>
        <p class="config-nota">
          <b>Favoritos</b>, <b>Gerais</b> e — só em Servidores MCP — <b>Do programa</b> são
          as mesmas listas da aba Arquivos, e este início rápido pode marcar de todas: a marca
          diz o que o chat interno consulta, não o que ele leva. As duas últimas categorias —
          <b>Instruções base</b> e <b>Agentes</b> — não têm essa marca, e por isso não têm a
          fileira; elas mostram as pastas da biblioteca como grupos, e em Instruções base só dá
          para escolher <b>uma</b>.
          <b>Códigos prontos</b> fica de fora: o Preparar não copia essa categoria.
        </p>
      </div>

      <div class="config-cartao" data-config-busca="pasta raiz remover contexto sem leitura">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Pastas criadas na pasta raiz</div>
          <p class="config-cartao-dica">
            Caminhos contados a partir da raiz. Marque <b>Remover</b> na pasta que a IA não deve
            ler, e <b>Contexto sem leitura</b> na que ela deve conhecer sem abrir — essa exige
            uma descrição.
          </p>
        </div>
        <div class="cpr-pastas" id="cpr-pastas-raiz"></div>
        <div class="cpr-add">
          <input type="text" id="cpr-add-raiz" placeholder="nova pasta/subpasta">
          <button type="button" class="btn btn-primary btn-sm" data-cpr-add="raiz">Adicionar</button>
        </div>
      </div>

      <div class="config-cartao" data-config-busca="pasta de trabalho">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Pasta de trabalho criada automaticamente</div>
          <p class="config-cartao-dica">
            O Preparar cria esta pasta dentro da raiz e já a registra em <b>Projeto → Trabalho</b>.
            Em branco, nenhuma pasta de trabalho é criada.
          </p>
        </div>
        <div class="cpr-campo-solto">
          <input type="text" id="cpr-pasta-trabalho" data-cpr-campo="pasta_trabalho">
        </div>
      </div>

      <div class="config-cartao" data-config-busca="pasta de trabalho subpasta remover contexto">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Pastas criadas dentro da pasta de trabalho</div>
          <p class="config-cartao-dica">
            Caminhos contados a partir de <code id="cpr-base-trabalho">a pasta de trabalho acima</code>.
            Mesmas duas marcas.
          </p>
        </div>
        <div class="cpr-pastas" id="cpr-pastas-trabalho"></div>
        <div class="cpr-add">
          <input type="text" id="cpr-add-trabalho" placeholder="nova pasta/subpasta">
          <button type="button" class="btn btn-primary btn-sm" data-cpr-add="trabalho">Adicionar</button>
        </div>
        <p class="config-nota">
          Preparar nunca sobrescreve: pasta que já existir é deixada como está.
        </p>
      </div>`,
    acoes: `
      <button type="button" class="btn btn-positive" id="btn-save-preparar">Salvar início rápido</button>`,
  });
})();
