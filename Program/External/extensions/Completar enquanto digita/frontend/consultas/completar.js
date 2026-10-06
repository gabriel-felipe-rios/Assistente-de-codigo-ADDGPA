// ══════════ COMPLETAR ENQUANTO DIGITA — a consulta `editor.autocomplete` ══
// Os nomes que já existem no projeto, e as palavras que já estão no próprio
// arquivo, oferecidos enquanto se digita.
//
// ⚠️ ESTA EXTENSÃO É UM ARQUIVO SÓ, e isso não é preguiça: o popup, a
// navegação por teclado, o teto de 12 sugestões, o prefixo mínimo de 2, a
// pausa de 80 ms e o descarte da resposta atrasada são todos do PROGRAMA
// (`frontend/modulos/editor-autocomplete.js`). O que falta é decidir QUAIS
// nomes entram — e é só isso que mora aqui.
//
// Sem `frontend/index.js` e sem `xtDesmontar`: a consulta é registrada por
// este próprio arquivo, e `xtDesregistrarConsultas` a tira ao desligar. Não há
// nada a desfazer.
//
// ⚠️ DUAS FONTES, e a segunda é o que faz a extensão funcionar em QUALQUER
// linguagem:
//
//   1. o Índice de Símbolos do projeto (`pergunta.simbolos`) — nomes de
//      função, classe, seletor, vindos de todos os arquivos. Só existe se a
//      aba Análise já construiu o índice; num projeto novo vem VAZIO, e a
//      extensão parecia não funcionar;
//   2. as PALAVRAS DO PRÓPRIO ARQUIVO (`pergunta.texto`) — todo identificador
//      que já está escrito ali, extraído por expressão regular. Não depende de
//      índice, de linguagem nem de gramática: é o que o VS Code chama de
//      "word based suggestions", e é a rede que garante que digitar num
//      arquivo qualquer sempre oferece alguma coisa.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, consulta }

  // Os padrões de fábrica. ⚠️ Os mesmos do `config/tela.json` — é de lá que o
  // programa lê o que o usuário escolheu, e `xtPreferenciasDe` já devolve o
  // valor resolvido. Esta cópia só vale se a tela não existir.
  const CPL_PADRAO = {
    simbolos_do_projeto: true,
    palavras_do_arquivo: true,
    priorizar_arquivo_aberto: true,
    ignorar_maiusculas: true,
    casar_no_meio: true,
    teto: 40,
  };

  // A partir de quantas letras o casamento "no meio" entra. Com duas, `ab`
  // casaria com metade dos nomes de um projeto pelo segundo pedaço.
  const CPL_MINIMO_NO_MEIO = 3;

  /**
   * Os pedaços de um nome: `abrirHistoricoLocal` → `abrir`, `Historico`,
   * `Local`; `obter_pasta_de_dados` → `obter`, `pasta`, `de`, `dados`. É o
   * que faz `hist` sugerir `abrirHistoricoLocal` — o jeito de quem lembra do
   * MEIO do nome e não do começo.
   */
  function _pedacos(nome) {
    return nome.split(/[_$-]+|(?<=[a-z0-9])(?=[A-Z])/).filter(Boolean);
  }

  function _prefs() {
    const lidas = (typeof xtPreferenciasDe === 'function' && xtPreferenciasDe(EU.slug)) || {};
    return { ...CPL_PADRAO, ...lidas };
  }

  // O que conta como palavra. Inclui `_` e `$` (nomes válidos em quase toda
  // linguagem) e letras acentuadas (um `.md` ou um comentário em português
  // também merece completar). Números soltos ficam de fora: `42` não é
  // sugestão para ninguém.
  const CPL_PALAVRA = /[\p{L}_$][\p{L}\p{N}_$]*/gu;
  // Um arquivo maior que isto não é varrido: a extração roda a cada consulta
  // e tem 150 ms; 300 KB de texto é a ordem de grandeza que ainda cabe.
  const CPL_TETO_TEXTO = 300 * 1024;

  // ⚠️ CACHE POR TEXTO. A consulta roda a cada pausa de 80 ms, e extrair as
  // palavras de um arquivo grande custa alguns milissegundos — pagar isso a
  // cada tecla é desnecessário quando o texto não mudou desde a última vez
  // (o caso de quem só andou com o cursor). Comparar dois textos iguais é
  // linear no tamanho, mas é uma comparação de memória, e não uma varredura.
  let _textoVisto = null;
  let _palavrasVistas = [];

  function _palavrasDoArquivo(texto) {
    if (typeof texto !== 'string' || !texto) return [];
    if (texto === _textoVisto) return _palavrasVistas;
    const vistas = new Set();
    if (texto.length <= CPL_TETO_TEXTO) {
      for (const m of texto.matchAll(CPL_PALAVRA)) {
        if (m[0].length >= 3) vistas.add(m[0]);
      }
    }
    _textoVisto = texto;
    _palavrasVistas = [...vistas];
    return _palavrasVistas;
  }

  xtRegistrarConsulta(EU.slug, EU.consulta, (pergunta) => {
    const prefs = _prefs();
    const semCaixa = prefs.ignorar_maiusculas !== false;
    const prefixoCru = pergunta.prefixo || '';
    const prefixo = semCaixa ? prefixoCru.toLowerCase() : prefixoCru;
    if (!prefixo) return [];
    const teto = Math.max(1, Math.min(200, Number(prefs.teto) || CPL_PADRAO.teto));
    const arquivoAberto = String(pergunta.arquivo || '').replace(/\\/g, '/');

    const noMeio = prefs.casar_no_meio !== false && prefixo.length >= CPL_MINIMO_NO_MEIO;
    // Devolve 0 (não casa), 1 (começa pelo prefixo) ou 2 (um pedaço do meio
    // começa pelo prefixo). O 2 vale menos na ordenação.
    const casa = (nome) => {
      const n = semCaixa ? nome.toLowerCase() : nome;
      // A palavra já escrita por inteiro não vira sugestão: aceitá-la não
      // mudaria nada, e ela ocuparia a primeira linha da lista.
      if (n === prefixo) return 0;
      if (n.startsWith(prefixo)) return 1;
      if (!noMeio || !n.includes(prefixo)) return 0;
      return _pedacos(nome).some((p) => (semCaixa ? p.toLowerCase() : p).startsWith(prefixo)) ? 2 : 0;
    };

    const achados = [];
    const jaSugeridos = new Set();

    // ⚠️ `pergunta.simbolos` JÁ ESTÁ EM MEMÓRIA — o programa o carregou uma vez,
    // quando o projeto abriu, justamente para não haver ida ao Python por
    // tecla. ⛔ Nunca chamar `window.pywebview.api` aqui: são 150 ms de teto, e
    // a ponte não cabe neles.
    //
    // Lista vazia é o estado NORMAL de um projeto que nunca teve o Índice de
    // Símbolos construído. Não é falha, e não se avisa nada — a fonte 2 cobre.
    if (prefs.simbolos_do_projeto !== false) {
      for (const s of (pergunta.simbolos || [])) {
        const nome = (s && s.nome) || '';
        const como = casa(nome);
        if (!como) continue;
        jaSugeridos.add(nome);
        const doArquivoAberto = prefs.priorizar_arquivo_aberto !== false && arquivoAberto
          && arquivoAberto.endsWith(String(s.arquivo || '').replace(/\\/g, '/'));
        achados.push({
          texto: nome,                          // o que entra no arquivo
          // A coluna cinza da direita. Um símbolo sem `tipo` ou sem `arquivo`
          // no índice não pode virar "undefined · undefined" na tela.
          detalhe: [s.tipo, s.arquivo].filter(Boolean).join(' · '),
          // Menor nome primeiro. É o desempate mais útil num editor: quem
          // digita `ab` quase sempre quer `abrir`, não
          // `abrirHistoricoLocalDoArquivo`. O que está no arquivo aberto sobe
          // um degrau: é o que a pessoa está mexendo agora. E quem casou só
          // pelo MEIO do nome fica abaixo de todo mundo que casou pelo começo.
          prioridade: (como === 2 ? 250 : (doArquivoAberto ? 2000 : 1000)) - nome.length,
        });
      }
    }

    if (prefs.palavras_do_arquivo !== false) {
      for (const palavra of _palavrasDoArquivo(pergunta.texto)) {
        if (jaSugeridos.has(palavra)) continue;
        const como = casa(palavra);
        if (!como) continue;
        achados.push({
          texto: palavra,
          detalhe: 'neste arquivo',
          // Abaixo dos símbolos do índice, que têm tipo e origem; acima de
          // nada — é a rede de quem não tem índice.
          prioridade: (como === 2 ? 200 : 500) - palavra.length,
        });
      }
    }

    // ⚠️ ORDENA ANTES DE CORTAR. Cortar na ordem em que os símbolos aparecem
    // no índice deixava o melhor candidato de fora: num projeto grande, o
    // nome mais curto podia ser o símbolo 5.000 e nunca entrar nos 40 — e o
    // programa só reordena o que recebe.
    achados.sort((a, b) => b.prioridade - a.prioridade || a.texto.localeCompare(b.texto));
    return achados.slice(0, teto);
  });
})();
