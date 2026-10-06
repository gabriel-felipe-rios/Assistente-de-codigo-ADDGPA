// ═══════════════════════ TEMPLATE: Configurações — Launchers ══
// Só o markup da categoria. Comportamento (árvore de pastas, ligar/
// desligar, os dois checkboxes de local, arrastar PASTA para reordenar)
// em `config-atalhos-externos.js`.
//
// ⚠️ Tudo aqui grava na hora — ligar/desligar, os dois checkboxes, e
// também arrastar uma pasta (solta = já gravado). Mesmo assim a categoria
// TEM "Salvar launchers", e o botão nunca tem nada pendente: ele regrava a
// ordem que está na tela e confirma em voz alta. É a regra de 2026-08-26
// (ver "O botão voltou", em `Saída das skills/Padrões de interface/
// Exceções.md`): tirar o botão não comunica "já está salvo", comunica
// "esta tela está incompleta" — o usuário procura o Salvar que não existe
// e fica na dúvida se perdeu a ordem que arrastou. Mesma decisão de Temas
// e Notificações, que também gravam no clique. "Restaurar padrão" volta
// todo atalho a desligado, sem mexer na ordem das pastas — ver
// `reset_atalhos_externos` em `modulos/atalhos_externos.py`.
//
// Precisa rodar DEPOIS de `config-categorias.js` e de `config-template.js`.

(function () {
  if (typeof registrarCategoriaConfig !== 'function') return;

  registrarCategoriaConfig({
    chave: 'atalhos-externos',
    // Glifo monocromático, como as outras — nunca emoji. `⇱` sugere "abrir
    // pra fora", e não colide com nenhum glifo já em uso no trilho
    // (incluindo o `▣` de Plugins).
    icone: '⇱',
    // Rótulo "Launchers": nome escolhido pelo usuário (a primeira versão
    // era "Atalhos de programas externos") — casa com o padrão em inglês
    // das outras pastas de External/ (ai-models, plugins, libraries). O
    // código interno continua em português ("atalho"), só o que aparece
    // na tela mudou.
    rotulo: 'Launchers',
    resumo: 'ligar, desligar e escolher onde cada atalho aparece',
    conteudo: `
      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Atalhos instalados</div>
          <p class="config-cartao-dica">
            Cada arquivo em <code>External/launchers/</code> vira uma linha
            aqui — pode estar solto na raiz ou dentro de uma pasta (e
            subpasta, em qualquer profundidade): a pasta em si é só
            organização, arraste pra reordenar os grupos. Ligar acrescenta
            o atalho onde você marcar; desligar remove de todo lugar, sem
            apagar o arquivo. Um grupo ou subgrupo só aparece no Launcher
            se tiver ao menos um atalho ligado lá dentro.
          </p>
        </div>
        <div id="atalhos-externos-lista" class="plugin-lista"></div>
      </div>`,
    acoes: '<button class="btn btn-positive" id="btn-save-atalhos-externos">Salvar launchers</button>',
  });
})();
