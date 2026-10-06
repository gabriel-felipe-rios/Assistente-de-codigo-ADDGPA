// ══════════════════════════════════════ TEMPLATE: Projeto › Preparar projeto
// Markup estático da sub-aba "Preparar projeto". Ela morava na aba Arquivos e
// veio para cá: sem pasta raiz o Preparar não roda, e a pasta raiz é definida
// na sub-aba Trabalho, logo ao lado.
//
// O casco é estático; os SEIS cartões são pintados por `preparar.js` a partir
// da prévia que o backend devolve — o que cada preset copia muda de preset para
// preset, e um cartão fixo por tipo voltaria a cravar o formato do Claude Code.
//
// A tela era título + parágrafo de abertura + tarja amarela "Copia, nunca move" +
// parágrafo de fecho, tudo antes e depois dos cartões. Saiu: o título repetia o
// rótulo da sub-aba e o resto virou UMA linha de rodapé. Os cartões já dizem o
// que vai acontecer, item por item — explicar de novo em prosa só empurrava o
// botão para longe. A nota "definido em Configurações › Preparar projeto" também
// saiu, e o botão passou a ficar colado no seletor, e não na outra ponta da barra.
//
// ⚠️ Os emojis dos cartões (📄 ⌨️ 🔌 📕 📘 📂) FICAM. A regra do glifo
// monocromático vale para o TRILHO DE CATEGORIAS de Configurações, que é onde
// ela está escrita, e não foi estendida até aqui (D33). Só o 🚀 saiu — do
// rótulo da sub-aba.
(function () {
  const alvo = document.getElementById('subtab-preparar');
  if (!alvo) return;

  // ⚠️ FAMÍLIA DE CLASSES PRÓPRIA (`prep-tab-*`), E ISSO NÃO É ESTÉTICA.
  // O handler de `.subtab-btn` em `navegacao.js` limpa `.active` de TODOS os
  // `.subtab-btn` e esconde TODOS os `.subtab-content` do documento. Uma barra
  // aninhada aqui dentro que reusasse essas classes esconderia, ao primeiro
  // clique, o próprio `#subtab-preparar` que a contém — a aba sumiria sozinha.
  // É a mesma razão pela qual Análise, Mapas e Inspetor têm as delas.
  //
  // ⚠️ "ASSISTENTE EXTERNO" VEM PRIMEIRO, e a ordem é a do gesto: primeiro se
  // decide para onde as coisas vão neste projeto, e só depois se escolhe se
  // importa alguma da biblioteca. Começar pelo import obrigaria a voltar — o
  // destino que ele usa é o da OUTRA aba.
  //
  // ⚠️ A ORDEM DOS PAINÉIS TEM DE BATER COM A DOS BOTÕES. `_resetSubAbas` (em
  // `navegacao.js`) devolve a barra ao primeiro item por ÍNDICE no DOM, e não
  // por `data-prep`: inverter só os botões faria a aba "Assistente externo" acender
  // e o painel do "Início rápido" aparecer.
  //
  // ⚠️ AS DUAS SUB-ABAS CONTINUAM SEPARADAS, e na mesma ordem (D8). "Assistente
  // externo" (era "Para onde vai" até 2026-09-22) é o do projeto, e é ele que governa
  // `activate_item` / `deactivate_item` da aba Arquivos; "Início rápido" é o
  // molde que o botão Preparar aplica. Juntá-las tiraria do usuário a única
  // maneira de trocar o destino sem preparar o projeto de novo.
  //
  // ⚠️ A palavra "Preset" saiu das duas em 2026-09-02. Os objetos se chamam
  // ASSISTENTE EXTERNO e INÍCIO RÁPIDO, aqui e no `Vocabulário.md`.
  //
  // ⚠️ `_resetSubAbas` volta ao primeiro item POR ÍNDICE NO DOM: inverter só os
  // botões faria uma aba acender e o painel da outra aparecer.
  alvo.innerHTML = `
    <div class="prep-tabs-bar"
         data-taborder-group="preparar_subtabs"
         data-taborder-label="Sub-abas de Preparar projeto"
         data-taborder-parent="subtab-preparar">
      <button class="prep-tab-btn active" data-prep="prep-assistente-externo">Assistente externo</button>
      <button class="prep-tab-btn" data-prep="prep-inicio-rapido">Início rápido</button>
    </div>

    <div class="prep-tab-content active" id="prep-assistente-externo">
      <p class="arq-preparar-rodape">
        Este é o destino de cada categoria da biblioteca quando você liga um item
        na aba <b>Arquivos</b> — e também o que o Preparar usa. Escolher aqui vale
        para este projeto.
      </p>
      <div id="prep-preset-arquivos"></div>
      <div class="arq-preparar-grupos" id="prep-destinos"></div>
    </div>

    <div class="prep-tab-content hidden" id="prep-inicio-rapido">
    <div class="arq-preparar">

      <div class="arq-preparar-barra">
        <label for="preparar-preset">Início rápido</label>
        <select class="arq-preparar-select" id="preparar-preset"></select>
        <button type="button" class="btn btn-special" id="btn-preparar-projeto">Preparar este projeto</button>
        <div class="arq-preparar-destino" id="preparar-destino"></div>
      </div>

      <div class="arq-preparar-aviso hidden" id="preparar-aviso-preset"></div>
      <div class="arq-preparar-aviso hidden" id="preparar-aviso-teto"></div>

      <div class="arq-preparar-grupos" id="preparar-grupos"></div>

      <p class="arq-preparar-rodape">Copia, nunca move nem sobrescreve — os originais ficam na biblioteca de Arquivos. Depois de preparar, rode cada skill no assistente externo (ex.: <code>/padroes-de-interface</code>).</p>
      <div class="arq-preparar-result" id="preparar-result"></div>
    </div>
    </div>
`;
})();
