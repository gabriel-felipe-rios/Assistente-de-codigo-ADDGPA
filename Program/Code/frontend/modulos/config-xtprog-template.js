// ═══════════════════ TEMPLATE: Configurações — Extensões do programa ══
// Só o markup da categoria. O comportamento (listar, ligar/desligar,
// arrastar, destacar) está em `config-xtprog.js`.
//
// ⚠️ **A `chave` é `xtprog`, e nunca `extensoes`.** `extensoes` já é a chave
// da categoria "Arquivos que o programa lê" (até 23/09/2026 "Extensões e
// pastas ignoradas") — está literalmente em
// `_CONFIG_RESTAURADORES`, e a chave vira id de DOM
// (`config-secao-{chave}`, `btn-reset-{chave}`, `data-categoria`). As duas
// colidiriam de verdade.
//
// O RÓTULO já repetiu de propósito (D16, "Extensões" × "Extensões e pastas
// ignoradas"): uma é extensão de ARQUIVO (`.py`, `.js`), a outra é tipo
// plugin. Desde 23/09/2026 a de arquivo se chama "Arquivos que o programa lê",
// e o nome não repete mais — mas a CHAVE continua `extensoes`, e o aviso acima
// continua valendo.
//
// Precisa rodar DEPOIS de `config-categorias.js` e de `config-template.js`.
// A posição desta tag no `index.html` É a posição no trilho: logo depois de
// Launchers, para Plugins, Launchers e Extensões ficarem vizinhas.

(function () {
  if (typeof registrarCategoriaConfig !== 'function') return;

  registrarCategoriaConfig({
    chave: 'xtprog',
    // Glifo monocromático, nunca emoji (Padrões de interface › Trilho de
    // categorias). `⊡` — um quadrado com algo encaixado dentro — e nenhum dos
    // já usados no trilho.
    icone: '⊡',
    rotulo: 'Extensões',
    resumo: 'ligar, desligar e ver o que veio de extensão',
    conteudo: `
      <div class="config-cartao"
           data-config-busca="destacar extensões extensao destaque cor formato contorno">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Destacar extensões</div>
          <p class="config-cartao-dica">
            Pinta, em qualquer aba, o que uma extensão pôs no meio de uma tela
            do programa — o painel de um encaixe, um item de menu, um comando
            na barra de Acesso rápido. Serve para saber, olhando, o que é do
            programa e o que foi acrescentado. As páginas do lado Extensões
            deste trilho não são pintadas: o lugar já diz de onde elas vêm.
            Desligado é o normal.
          </p>
        </div>
        <label class="toggle-pill" id="xtprog-destaque" title="Destacar o que veio de extensão">
          <div class="toggle-track"><div class="toggle-knob"></div></div>
          <span class="toggle-label">Destacar extensões</span>
        </label>

        <div class="config-grade">
          <div class="config-field-row">
            <label for="xtprog-destaque-cor">Cor do destaque</label>
            <!-- Amostras, e não uma lista suspensa de nomes de cor: "Âmbar" e
                 "Turquesa" só querem dizer alguma coisa depois de vistas, e o
                 que se está escolhendo aqui É a aparência. Cada bolinha leva o
                 nome no atributo title para quem navega por teclado. (Sem crases
                 neste comentário: ele mora dentro de um template literal.) -->
            <div class="xtprog-cores" id="xtprog-destaque-cor"></div>
          </div>

          <div class="config-field-row">
            <label for="xtprog-destaque-tipo">Formato do destaque</label>
            <select class="xt-campo-select" id="xtprog-destaque-tipo"></select>
            <p class="config-nota">
              Do mais discreto ao mais gritante. Quem está caçando uma extensão
              perdida numa tela cheia quer a barra; quem só quer saber de onde
              veio aquele painel quer o tracejado.
            </p>
          </div>
        </div>

        <!-- A prévia acende SEMPRE, mesmo com o destaque desligado: sem ela,
             escolher cor e formato com o interruptor apagado seria escolher no
             escuro — e ligar só para ver obrigaria a tela inteira a piscar. -->
        <div class="xtprog-previa" id="xtprog-previa">
          É assim que o que veio de extensão vai aparecer.
        </div>
      </div>

      <div class="config-cartao" data-config-busca="extensões do programa instaladas">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Extensões instaladas</div>
          <p class="config-cartao-dica">
            Cada pasta com um <code>extensao.json</code> em
            <code>External/extensions/</code> vira uma linha aqui. Ligar faz a
            extensão funcionar na hora, sem reiniciar; desligar a faz parar, na
            hora, e <strong>não apaga nada</strong> — nem a pasta, nem o que ela
            gerou. Para organizar em categorias, crie uma subpasta e mova a
            extensão para dentro: a subpasta vira só um agrupamento, sem
            configuração própria.
          </p>
        </div>
        <div id="xtprog-lista" class="plugin-lista"></div>
      </div>

      <div class="config-cartao" data-config-busca="pontos de encaixe e eventos disponíveis">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Onde uma extensão pode entrar</div>
          <p class="config-cartao-dica">
            Os lugares do programa que aceitam extensão, e os avisos que ele
            emite. Quem está escrevendo uma extensão consulta esta lista em vez
            de abrir a documentação — e ela sai do próprio catálogo do
            programa, então nunca fica velha.
          </p>
        </div>
        <div id="xtprog-catalogo" class="xtprog-catalogo"></div>
      </div>`,
    // ⚠️ O RÓTULO DIZ O QUE ELE SALVA, e é a única coisa nesta tela que espera
    // um clique para gravar: ligar/desligar, a cor e o formato do destaque já
    // gravam no ato. Um "Salvar" solto aqui sugeria que o resto da tela também
    // estava esperando por ele — e alguém sairia da categoria achando que
    // perdeu o que acabou de ligar.
    acoes: '<button class="btn btn-positive" id="btn-save-xtprog" '
         + 'title="Só a ordem da lista espera este clique. Ligar, desligar e o '
         + 'destaque já gravam sozinhos.">Salvar a ordem da lista</button>',
  });
})();
