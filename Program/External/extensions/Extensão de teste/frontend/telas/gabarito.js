// ═══════════════════════════════════ EXTENSÃO DE TESTE — A TELA ══
// O recurso Tela: a sub-aba "Extensão de teste — o gabarito" no lado Extensões
// de Configurações (`"lugar": "configuracoes.subaba"` no manifesto). Até a
// fase 11 esta categoria era registrada à mão, por `registrarCategoriaConfig`
// no `index.js`; agora quem cria o botão e o painel é o programa, e esta
// extensão só desenha dentro.
//
// ⚠️ O programa chama a função na PRIMEIRA vez que a tela aparece (e de novo
// se o projeto mudar) — não ao ligar. É por isso que a pergunta ao backend
// saiu do `xtMontar` e veio para cá: o `#tst-resposta` só existe depois do
// desenho.

(function () {
  // ⚠️ NUNCA escreva o slug nem o id da tela à mão: os dois vêm do dataset
  // da tag <script> que o programa injetou a partir do manifesto.
  const EU = document.currentScript.dataset;   // { caminho, slug, tela, lugar }

  xtRegistrarTela(EU.slug, EU.tela, (container) => {
    container.innerHTML = `
      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">A ponte</div>
          <p class="config-cartao-dica">O que o backend desta extensão respondeu.</p>
        </div>
        <p class="tst-linha" id="tst-resposta">perguntando…</p>
      </div>
      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">O decorador</div>
          <p class="config-cartao-dica">
            Com esta extensão ligada, os primeiros caracteres da linha 1 de
            qualquer arquivo aberto no Editor ficam com fundo roxo. Desligue e
            a marca some — sem tirar uma letra do código.</p>
        </div>
      </div>`;
    // ⚠️ `typeof` antes de chamar a global da casca: a extensão pode ter sido
    // desligada entre o registro e o desenho, e o `xtDesmontar` apaga a global
    // (Regras e instruções › "Depois de um await, confira se ainda está montada").
    if (typeof window.tstPerguntarAoBackend === 'function') window.tstPerguntarAoBackend();
  });
})();
