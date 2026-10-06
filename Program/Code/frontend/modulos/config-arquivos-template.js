// ══════════════════════════════════ CONFIGURAÇÕES: Assistentes externos
// Um assistente externo é o programa que roda o código por fora deste aqui —
// Claude Code, Cursor, Codex/Antigravity, OpenCode, Gemini CLI. Esta categoria
// responde as três perguntas sobre ele de uma vez: COMO É LANÇADO no terminal,
// PARA ONDE cada categoria da biblioteca vai dentro do projeto, e COMO ela
// chega lá.
//
// ⚠️ ISTO ERA A CATEGORIA "Arquivos", e ela respondia só as duas últimas. A
// primeira morava em Arquivos › Agentes › Assistentes externos, e o "para onde
// vai" tinha um segundo dono em Configurações › Preparar projeto. Eram três
// listas casadas pelo campo `nome`, por string, sem verificação nenhuma — e foi
// esse casamento que perdeu o OpenCode sozinho do disco do usuário. Fundidas em
// 2026-09-02.
//
// 🔴 A `chave` CONTINUA `'arquivos'`, mesmo o rótulo tendo mudado. Ela casa com
// `_CONFIG_REPINTORES.arquivos` (config-categorias.js), com
// `_PADROES_POR_CATEGORIA['arquivos']` (configuracoes.py) e com o
// `data-categoria` do trilho. Três lugares, um nome, ZERO verificação: trocar a
// chave aqui apaga a categoria da tela sem um erro sequer.
//
// ⚠️ Glifo monocromático, e não emoji: as outras categorias usam
// `◑ ▦ ⚒ ◈ ⇄ ◧ ⟳ ◐ ⠿ ◆ ◷ ⊞`, todos herdando a cor do texto do trilho. Um emoji
// colorido aqui quebraria a fileira — ver `Componentes/Trilho de categorias.md`.
// `⌁` diz o que a categoria é: o programa externo que é acionado.
//
// O casco é estático; a grade de destinos e os campos de lançamento são
// pintados por `config-arquivos.js` a partir do assistente selecionado.
(function () {
  if (typeof registrarCategoriaConfig !== 'function') return;

  registrarCategoriaConfig({
    chave: 'arquivos',
    rotulo: 'Assistentes externos',
    icone: '⌁',
    resumo: 'como cada assistente é lançado, e para onde os arquivos dele vão',
    conteudo: `
      <div class="config-cartao" data-config-busca="assistente externo claude cursor codex opencode gemini duplicar renomear excluir padrão">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Assistentes</div>
          <p class="config-cartao-dica">
            Cada assistente é um programa de código que roda por fora deste. Escolha um
            para editar abaixo. O marcado como <b>padrão</b> é o que um projeto novo recebe
            e o que a barra de cota e a execução de agente usam.
          </p>
        </div>
        <div class="cpr-pills" id="cfa-pills"></div>
        <div class="cpr-pill-acoes">
          <button type="button" class="btn btn-muted btn-sm" id="btn-cfa-renomear">Renomear</button>
          <button type="button" class="btn btn-muted btn-sm" id="btn-cfa-duplicar">Duplicar</button>
          <button type="button" class="btn btn-muted btn-sm" id="btn-cfa-padrao">Definir como padrão</button>
          <button type="button" class="btn btn-muted btn-sm" id="btn-cfa-excluir">Excluir</button>
        </div>
        <p class="config-nota config-nota-alerta hidden" id="cfa-erros"></p>
      </div>

      <div class="cpr-editando">Editando o assistente <b id="cfa-editando-nome">—</b></div>

      <div class="config-cartao" data-config-busca="comando argumentos flag nome prompt cota terminal lançamento">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Lançamento</div>
          <p class="config-cartao-dica">
            Como este assistente é aberto num terminal da Oficina, como um agente é
            executado nele e como a barra de cota pergunta quanto já foi usado.
            <b>Comando em branco</b> é rascunho: o assistente continua valendo para a cópia
            de arquivos, mas o terminal dele abre limpo.
          </p>
        </div>
        <div class="cfa-grade" id="cfa-lancamento"></div>
      </div>

      <div class="config-cartao" data-config-busca="destino formato skill comando mcp instruções base agentes pasta solto">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Destinos</div>
          <p class="config-cartao-dica">
            Caminhos contados a partir da pasta raiz do projeto. <b>Destino em branco</b> quer
            dizer que este assistente não usa a categoria — ligar um item dela simplesmente
            não copia nada. A exceção é <b>Instruções base</b>: em branco ali quer dizer
            <b>a própria raiz</b>, porque é onde o arquivo de instruções mora em todos os
            assistentes — o campo diz isso no lugar do texto.
          </p>
        </div>
        <div class="cfa-grade" id="cfa-grade"></div>
        <p class="config-nota">
          <b>Arquivo de entrada</b> preenchido = o arquivo principal do item chega
          <b>renomeado</b> para esse nome, porque é ele que o assistente procura —
          uma skill do Claude Code é uma <b>pasta por item</b> com um
          <code>SKILL.md</code> dentro, e o nome que ela tinha na biblioteca não serve.
          Em branco, cada arquivo chega com o nome que já tem (é o caso dos comandos).
          A sua biblioteca não é tocada: a renomeação acontece só no destino.
        </p>
        <p class="config-nota">
          Em <b>Instruções base</b>, o que muda de assistente para assistente é o
          <b>arquivo de entrada</b> — <code>CLAUDE.md</code>, <code>AGENTS.md</code>. O
          <b>texto</b> dele não se escreve aqui: ele é um item da biblioteca, em
          <b>Arquivos › Instruções base</b>, e o início rápido escolhe qual vai.
        </p>
        <p class="config-nota">
          O agrupamento em pastas da biblioteca não vai junto: um item dentro de
          <code>Skills/Front design/</code> chega no destino direto, sem a pasta do grupo —
          nenhum assistente descobre skill dentro de uma pasta de categoria.
        </p>
      </div>

      <div class="config-cartao" data-config-busca="normalizar nome slug SKILL.md frontmatter">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">O que o programa arruma sozinho na cópia</div>
          <p class="config-cartao-dica">
            Nada disto toca a sua biblioteca: em <code>Arquivos/</code> os nomes ficam com
            acento, espaço e maiúscula, do jeito que você lê melhor.
          </p>
        </div>
        <ul class="cfa-normalizacao">
          <li><b>O nome da pasta</b> vira minúsculas com hífen —
              <code>Arquitetura modular - Desktop</code> chega como
              <code>arquitetura-modular-desktop</code>.</li>
          <li><b>O arquivo principal</b> é renomeado para o "arquivo de entrada" da categoria,
              quando ela tiver um.</li>
          <li><b>O cabeçalho</b> recebe <code>name</code> igual ao nome da pasta gerada, e um
              <code>description</code> se estiver faltando — sem ele o assistente nunca aciona
              a skill sozinho.</li>
        </ul>
      </div>`,
    acoes: `
      <button type="button" class="btn btn-positive" id="btn-save-arquivos">Salvar assistente</button>`,
  });
})();
