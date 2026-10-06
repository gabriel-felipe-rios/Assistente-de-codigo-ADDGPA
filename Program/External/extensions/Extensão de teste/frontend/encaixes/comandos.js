// ═══════════════ EXTENSÃO DE TESTE — O ENCAIXE `acesso-rapido.comandos` ══
// O exemplo mínimo do ponto: um comando só, que faz uma coisa visível, para dar
// para conferir a olho que ele aparece na barra, que a tecla sugerida vale, que
// desligar o tira e que religar o traz de volta com a tecla do usuário.
//
// O contrato deste ponto está na parte 15 de `Como criar extensões.md`.

(function () {
  // ⚠️ NUNCA escreva o slug nem o ponto à mão — os dois vêm do dataset da tag
  // <script> que o programa injetou, a partir do seu manifesto.
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  // O `contexto` deste ponto é `{ projeto, aba, arquivo }`. Este exemplo não
  // precisa dele, mas ele está aqui para o próximo que copiar esta pasta ver
  // onde ele chega.
  xtRegistrarEncaixe(EU.slug, EU.ponto, (contexto) => ([
    {
      // ⚠️ O `id` é a chave da tecla, e precisa ser ESTÁVEL entre uma versão e
      // outra desta extensão: é por ele que a tecla escolhida pelo usuário volta
      // a valer quando ela religa. O programa prefixa com o slug, então dois
      // comandos chamados `dizer-ola` em extensões diferentes não colidem.
      id: 'dizer-ola',
      // ⚠️ GLIFO, nunca emoji: a linha da barra muda de cor ao ser selecionada
      // com as setas, e emoji não obedece a `color`.
      icone: '◧',
      rotulo: 'Dizer olá',
      // ⚠️ Neste ponto — e SÓ neste — `atalho` é a tecla SUGERIDA, e o programa
      // a registra de verdade se ela estiver livre. Nos pontos de menu o mesmo
      // campo é só o texto à direita. Ver "A tecla sugerida — as três regras".
      atalho: 'Ctrl+Alt+T',
      // Não se marca o item como sendo seu: o programa põe `data-origem` e
      // `data-xt` sozinho, e é assim que o "Destacar extensões" acende o seu.
      fazer: () => showToast('Olá do gabarito.'),
      // ⚠️ O contexto chega aqui, e não é usado de propósito neste exemplo:
      // `contexto.projeto` é o projeto aberto, `contexto.arquivo` o arquivo em
      // foco no Editor.
    },
  ]));
})();
