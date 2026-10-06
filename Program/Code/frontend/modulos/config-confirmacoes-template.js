// ═══════════════════════ Configurações → Encerrar e excluir (markup) ══
// Só o markup da categoria. Comportamento em `limites.js`, junto dos outros
// campos que moram no `settings.json` — não há arquivo de comportamento
// próprio, e é de propósito: `_initEncerrarEExcluir` cabe ao lado de
// `_initPoliticaDeSaida`, que faz exatamente a mesma coisa.
//
// ⚠️ A posição da tag <script> deste arquivo no index.html é a posição da
// categoria no trilho da esquerda — não há lista de categorias em lugar
// nenhum. Ver `config-categorias.js`. Esta fica logo abaixo de "Notificações".
//
// ⚠️ A chave da categoria é `confirmacoes` e o rótulo é "Encerrar e excluir":
// o rótulo diz ao usuário QUANDO ele encontra estas opções, e a chave diz ao
// código O QUE elas são. Os dois já divergem em outras categorias
// (`render` → "Desempenho dos mapas", `ordem` → "Ordem das abas").

(function () {
  if (typeof registrarCategoriaConfig !== 'function') return;

  // Os três valores saem de `constantes.js`, que é o gêmeo do
  // `padroes_de_fabrica.py`. Escrevê-los à mão aqui criaria uma terceira lista.
  //
  // ⚠️ Os TRÊS toggles desta categoria são montados pela MESMA função, e não
  // copiados: as opções são as mesmas três, e um dia em que alguém acrescente
  // uma quarta ela precisa aparecer nos três — um markup duplicado deixaria
  // parte da tela para trás sem dar erro nenhum. O terceiro cartão (fechar o
  // projeto) nasceu em 28/08/2026 e não custou uma linha de markup nova.
  const QUANDO_PERGUNTAR = [
    [QUANDO_PERGUNTAR_NUNCA,   'Nunca'],
    [QUANDO_PERGUNTAR_RODANDO, 'Só quando tem coisa rodando'],
    [QUANDO_PERGUNTAR_SEMPRE,  'Sempre'],
  ];
  const toggle = (id, rotuloAcessivel) => `
        <div class="config-field-row">
          <div class="mapa-toggle" id="${id}"
               role="radiogroup" aria-label="${rotuloAcessivel}">${
    QUANDO_PERGUNTAR.map(([chave, rotulo]) => `
            <button type="button" class="mapa-toggle-btn" data-quando="${chave}">${rotulo}</button>`
    ).join('')}
          </div>
        </div>`;

  registrarCategoriaConfig({
    chave: 'confirmacoes',
    rotulo: 'Encerrar e excluir',
    // Círculo cortado: "isto vai embora". Glifo monocromático, nunca emoji —
    // emoji não obedece a `color` e ficaria aceso com os vizinhos apagados.
    // Nenhuma das outras doze categorias usa o ⊘.
    icone: '⊘',
    resumo: 'quando o programa pergunta antes de perder trabalho',
    conteudo: `
      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Perguntar antes de fechar o programa</div>
          <p class="config-cartao-dica">Fechar a janela encerra tudo na hora — inclusive
             uma pesquisa da Fila que esteja no meio.</p>
        </div>
${toggle('cfg-confirmar-ao-fechar', 'Quando perguntar antes de fechar')}
        <p class="config-nota">“Só quando tem coisa rodando” pergunta apenas quando o
           Chat, a Fila, as Rotinas, o Designer ou o backup estão trabalhando — e a
           pergunta diz qual deles é.</p>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Perguntar antes de sair do projeto</div>
          <p class="config-cartao-dica">O “← Projetos” leva você para fora da tela onde
             a pesquisa aparece. Nada é interrompido — mas dá para sair sem perceber que
             tinha coisa rodando.</p>
        </div>
${toggle('cfg-confirmar-ao-sair-do-projeto', 'Quando perguntar antes de sair do projeto')}
        <p class="config-nota">É só aviso: “Sim” sai, “Não” fica, e a tarefa continua
           rodando nos dois casos. Voltar ao projeto reencontra a pesquisa no meio.</p>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Perguntar antes de fechar o projeto</div>
          <p class="config-cartao-dica">O × na aba de um projeto aberto. Diferente do
             “← Projetos”: aqui a vigilância daquele projeto <strong>para</strong>, e o
             que ele estiver usando da IA é cortado.</p>
        </div>
${toggle('cfg-confirmar-ao-fechar-o-projeto', 'Quando perguntar antes de fechar o projeto')}
        <p class="config-nota">“Só quando tem coisa rodando” olha <strong>só este
           projeto</strong> — fechar uma aba parada nunca pergunta por causa de outra
           aba ocupada.</p>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Perguntar antes de remover</div>
        </div>
        <div class="config-field-row">
          <label class="config-check">
            <input type="checkbox" id="cfg-confirmar-ao-deletar" />
            Confirmar antes de remover um chat ou uma tarefa
          </label>
        </div>
        <p class="config-nota">A confirmação diz o que exatamente se perde — a conversa,
           o Log, o Contexto, o histórico da pesquisa, o relatório. Nada disso tem
           desfazer.</p>
        <p class="config-nota">Não vale para o “Restaurar padrão” das outras categorias:
           aquilo devolve valores de configuração, e é outra coisa. Ele tem a
           confirmação própria dele, que pergunta sempre e não se desliga aqui —
           restaurar grava na hora, sem passar pelo “Salvar” e sem desfazer.</p>
      </div>

      <div class="config-cartao" data-config-busca="editor arquivo não salvo fechar aba mudanças perder">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Perguntar antes de fechar arquivo não salvo</div>
        </div>
        <div class="config-field-row">
          <label class="config-check">
            <input type="checkbox" id="cfg-confirmar-ao-fechar-arquivo-nao-salvo" />
            Confirmar antes de fechar uma aba do Editor com mudanças não salvas
          </label>
        </div>
        <p class="config-nota">Vale para o × da aba, o clique do meio e o
           “Fechar outras”/“Fechar à direita” do menu da aba. Desligada, o
           Editor fecha na hora e a edição que não foi para o disco se perde.</p>
      </div>`,
    // ⚠️ Salvar de verdade, e não gravação no clique como em "Notificações":
    // é por isso que o "Perguntar antes de remover" é uma caixa nativa e não um
    // Interruptor — o Interruptor promete efeito imediato, e usá-lo atrás de um
    // Salvar seria mentir sobre o que o clique faz.
    acoes: '<button class="btn btn-positive" id="btn-save-confirmacoes">Salvar confirmações</button>',
  });
})();
