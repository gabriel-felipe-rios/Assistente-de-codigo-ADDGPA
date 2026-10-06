// ═══════════════════════════════ TEMPLATE: Configurações — Plugins ══
// Só o markup da categoria. Comportamento (listar, ligar/desligar, os dois
// checkboxes de local) em `config-plugins.js`.
//
// ⚠️ O clique JÁ grava — ver o ⚠️ do `config-plugins.js`. O botão "Salvar
// plugins" existe assim mesmo, como em Notificações, para a barra de ações
// desta categoria ficar igual à das outras: regrava o estado atual e
// confirma em voz alta, e é a segunda chance de quem viu a gravação falhar
// no clique. "Restaurar padrão" volta todo plugin a desligado e com os dois
// checkboxes desmarcados — ver `reset_plugins` em `modulos/plugins.py`.
//
// Precisa rodar DEPOIS de `config-categorias.js` e de `config-template.js`.

(function () {
  if (typeof registrarCategoriaConfig !== 'function') return;

  registrarCategoriaConfig({
    chave: 'plugins',
    // Glifo monocromático, como as outras dez — nunca emoji. `▣` sugere
    // módulo encaixado, sem repetir nenhum dos já usados no trilho.
    icone: '▣',
    rotulo: 'Plugins',
    resumo: 'ligar, desligar e escolher onde cada um aparece',
    conteudo: `
      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Plugins instalados</div>
          <p class="config-cartao-dica">
            Cada pasta em <code>External/plugins/</code> com um <code>plugin.json</code> vira uma linha aqui; pasta sem ele é categoria.
            Ligar acrescenta a sub-aba do plugin onde você marcar; desligar
            remove de todo lugar, sem apagar a pasta. Apagar a pasta some
            com o plugin daqui também, sem erro. Pra organizar em categorias,
            crie uma subpasta e mova o plugin pra dentro dela — a subpasta
            vira uma pasta de navegação na aba Plugins, sem nenhuma
            configuração própria.
          </p>
        </div>
        <div id="plugins-lista" class="plugin-lista"></div>
      </div>`,
    acoes: '<button class="btn btn-positive" id="btn-save-plugins">Salvar plugins</button>',
  });
})();
