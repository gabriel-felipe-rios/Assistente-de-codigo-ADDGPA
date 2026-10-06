// ══════════════════════════════════ CONFIGURAÇÕES: Acervo
// Os presets de pastas que a aba Acervo (dentro de um projeto) escolhe entre —
// ver a discussão "Nome do programa e os dois servidores MCP" (retomada): um
// preset é uma lista NOMEADA de pastas (título, caminho, editável); o projeto
// guarda só QUAL NOME está ativo (`acervo_preset_ativo`, Workspace.json), não
// uma cópia da lista — trocar um preset aqui já vale para todo projeto que o
// usa. Mesmo desenho de "Preparar projeto" (`inicios_rapidos`): presets
// globais, pílulas para escolher qual editar, o resto do cartão pinta a
// partir da pílula selecionada.
//
// ⚠️ Um projeto NASCE SEM preset escolhido — a aba Acervo dele aparece vazia
// até o usuário ir lá e escolher um (botão 🗂 no cabeçalho da árvore, dentro
// do próprio projeto). Esta tela só edita a LISTA de presets disponíveis, não
// escolhe qual projeto usa qual.
//
// ⚠️ Glifo do trilho monocromático, como as outras doze categorias — ver
// `Componentes/Trilho de categorias.md`. Os já usados: `⌁ ◑ ⇱ ⊘ ▤ ▦ ⚒ ◈ ⇄ ◲
// ▣ ⊞ ◧ ⟳ ◐ ⠿ ◆ ◷`. `◫` (não usado) evoca uma pasta dividida em partes — o
// preset sendo uma coleção de pastas.
//
// O casco é estático; a lista de presets e as pastas de cada um são pintadas
// por `config-acervo.js` a partir do preset selecionado, igual a
// `config-preparar.js`.
(function () {
  if (typeof registrarCategoriaConfig !== 'function') return;

  registrarCategoriaConfig({
    chave: 'acervo',
    rotulo: 'Acervo',
    icone: '◫',
    resumo: 'os presets de pastas que a aba Acervo de um projeto escolhe entre',
    conteudo: `
      <div class="config-cartao" data-config-busca="preset perfil pastas acervo regras instruções decisões">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Presets do Acervo</div>
          <p class="config-cartao-dica">
            Um preset é uma lista nomeada de pastas do projeto — cada pasta vira uma sub-aba
            do Acervo. Dentro de um projeto, a aba Acervo escolhe UM preset para usar; trocar
            de preset ali troca as sub-abas inteiras. Editar um preset aqui já vale para todo
            projeto que o tiver escolhido.
          </p>
        </div>
        <div class="cpr-pills" id="acp-pills"></div>
      </div>

      <div class="cpr-editando">Editando o preset <b id="acp-editando-nome">—</b></div>
      <div class="cpr-pill-acoes" id="acp-pill-acoes">
        <button type="button" class="btn btn-muted btn-sm" id="btn-acp-renomear">Renomear</button>
        <button type="button" class="btn btn-muted btn-sm" id="btn-acp-duplicar">Duplicar</button>
        <button type="button" class="btn btn-muted btn-sm" id="btn-acp-excluir">Excluir</button>
      </div>

      <div class="config-cartao" data-config-busca="pastas do preset título caminho editável">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Pastas deste preset</div>
          <p class="config-cartao-dica">
            Caminho contado a partir da raiz do projeto. <b>Editável</b> abre o editor de
            arquivo livre para criar e salvar direto nela — sem pasta nem preset de conteúdo.
            A pasta <code>Saída das skills/Regras e instruções</code> continua com o formato
            estruturado de sempre (Descrição/Quando se aplica/Regra), mesmo que você mude o
            nome de exibição dela aqui.
          </p>
        </div>
        <div id="acp-pastas-lista"></div>
        <button type="button" class="btn btn-muted btn-sm" id="btn-acp-pasta-add">+ Registrar outra pasta</button>
      </div>`,
    acoes: `
      <button type="button" class="btn btn-positive" id="btn-save-acervo">Salvar presets do Acervo</button>`,
  });
})();
