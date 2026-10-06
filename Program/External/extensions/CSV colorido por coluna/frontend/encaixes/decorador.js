// ══════ CSV COLORIDO POR COLUNA — o encaixe `editor.decorador` ══
// Uma cor por coluna, ciclando as seis. O cabeçalho ganha um pontilhado
// embaixo (opção), e um campo entre aspas com o separador dentro é UM campo.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  const CSV_CORES = 6;
  const CSV_SEPARADORES = [',', ';', '\t', '|'];

  // Os padrões de fábrica — os mesmos do `config/tela.json`, de onde o
  // programa lê o que o usuário escolheu (`xtPreferenciasDe`).
  const CSV_PADRAO = { separador: 'auto', linha_do_cabecalho: 1, destacar_cabecalho: true };

  function _prefs() {
    const lidas = (typeof xtPreferenciasDe === 'function' && xtPreferenciasDe(EU.slug)) || {};
    return { ...CSV_PADRAO, ...lidas };
  }

  /**
   * Os campos de uma linha, como `[{inicio, tamanho}]`, respeitando aspas
   * duplas: `"São Paulo, SP",12` são DOIS campos, e não três. Aspas dobradas
   * (`""`) dentro de um campo entre aspas continuam dentro. Campo de várias
   * linhas fica fora da versão 1 — cada linha é lida sozinha.
   */
  function csvCampos(linha, sep) {
    const campos = [];
    let inicio = 0;
    let dentro = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"') { dentro = !dentro; continue; }
      if (!dentro && c === sep) {
        campos.push({ inicio, tamanho: i - inicio });
        inicio = i + 1;
      }
    }
    campos.push({ inicio, tamanho: linha.length - inicio });
    return campos;
  }

  /**
   * O separador da tabela: o que mais aparece na linha do cabeçalho, fora de
   * aspas.
   *
   * ⚠️ Detectado, e não configurado (a tela permite fixar, para o caso raro).
   * Um `.csv` gerado no Brasil costuma usar `;` (porque a vírgula é o
   * separador decimal), e perguntar isso ao usuário para cada arquivo seria
   * pior que acertar quase sempre.
   */
  function csvSeparador(cabecalho) {
    let melhor = null;
    let mais = 0;
    for (const sep of CSV_SEPARADORES) {
      const quantos = csvCampos(cabecalho, sep).length - 1;
      if (quantos > mais) { mais = quantos; melhor = sep; }
    }
    return melhor;
  }

  xtRegistrarEncaixe(EU.slug, EU.ponto, (contexto) => {
    // ⚠️ `csv` e `tsv` não estão em `_ED_LINGUAGENS` (o mapa do Editor), então
    // chegam aqui como a extensão crua do arquivo. Nenhuma gramática do Prism
    // as cobre — o que significa que o `<pre>` é um nó de texto por bloco, o
    // caso mais simples possível para o caminhante do programa.
    const lingua = String(contexto.linguagem || '').toLowerCase();
    if (lingua !== 'csv' && lingua !== 'tsv') return [];

    const linhas = contexto.linhas;
    if (!linhas.length) return [];

    const prefs = _prefs();
    // A linha do cabeçalho é a que diz quantas colunas a tabela tem. Um
    // arquivo que começa com comentário ou linha em branco aponta outra.
    const lidaCab = Number(prefs.linha_do_cabecalho);
    const linhaCab = Math.max(1, Math.min(linhas.length, Number.isFinite(lidaCab) ? lidaCab : 1));
    const cabecalho = linhas[linhaCab - 1] || '';
    // Separador fixado pelo usuário, ou detectado pela linha do cabeçalho.
    const fixo = prefs.separador === 'tab' ? '\t'
      : CSV_SEPARADORES.includes(prefs.separador) ? prefs.separador : null;
    const sep = fixo || csvSeparador(cabecalho);
    if (!sep) return [];
    const colunasDoCabecalho = csvCampos(cabecalho, sep).length;
    const destacarCab = prefs.destacar_cabecalho !== false;

    // ⚠️ SÓ AS LINHAS DE `contexto.visivel`. Um CSV de 3.000 linhas × 12
    // colunas seriam 36.000 marcas, e o teto de 150ms do ponto não aguenta —
    // nem serviria para nada, porque o que está fora da janela de cor não
    // aparece na tela. Quando a rolagem mudar a faixa, o programa chama de
    // novo. `visivel` pode faltar (um chamador que não a montou): sem ela, o
    // arquivo inteiro.
    const visivel = contexto.visivel || { de: 1, ate: linhas.length };
    const de = Math.max(1, Number(visivel.de) || 1);
    const ate = Math.min(linhas.length, Number(visivel.ate) || linhas.length);

    const marcas = [];
    for (let n = de; n <= ate; n++) {
      const linha = linhas[n - 1];
      if (!linha) continue;
      const campos = csvCampos(linha, sep);
      // ⚠️ Linha com número de campos diferente do cabeçalho sai SEM COR, em
      // vez de sair com as cores deslocadas. Campo de várias linhas está fora
      // da versão 1, e é aqui que isso aparece: a linha fica monocromática,
      // que é um aviso honesto de que a leitura simples não deu conta.
      if (campos.length !== colunasDoCabecalho) continue;

      const ehCabecalho = destacarCab && n === linhaCab;
      for (let i = 0; i < campos.length; i++) {
        const { inicio, tamanho } = campos[i];
        if (tamanho <= 0) continue;
        marcas.push({
          linha: n,
          coluna: inicio,
          tamanho,
          // ⚠️ A classe começa pelo prefixo da extensão — o programa confere,
          // e descarta a marca com `console.error` se não começar. Duas
          // classes no cabeçalho: a cor da coluna e o pontilhado.
          classe: `csv-c${i % CSV_CORES}${ehCabecalho ? ' csv-cab' : ''}`,
        });
      }
    }
    return marcas;
  });
})();
