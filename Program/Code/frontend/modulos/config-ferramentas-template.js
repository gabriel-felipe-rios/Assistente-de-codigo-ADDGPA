// ══════════════ TEMPLATE: Configurações — Ferramentas dos subagentes ══
// Os limites de cada ferramenta que os subagentes usam. Eram dezoito números
// escritos à mão no Python, invisíveis: `500 * 1024` no grep, `200` no trecho
// da busca semântica, `20000` no ler_doc_tecnica, `512` no indexador de
// embeddings. Nenhum tinha tela, e três nunca tiveram.
//
// ⚠️ A REGRA DA UNIDADE. Cada campo mostra a unidade dele, e a unidade não é
// escolha de gosto:
//
//   **KB** para o limite que protege A MÁQUINA — o que decide se vale a pena
//   abrir o arquivo. Não dá para converter em token: contar token exige ter
//   aberto o arquivo, que é exatamente o que se quer evitar.
//
//   **token** para o limite que protege A JANELA DE CONTEXTO — o que recorta o
//   que vai ao modelo. Caractere não diz quanto de janela custa.
//
//   **caractere** só onde o corte é de APRESENTAÇÃO — a linha do grep, que é
//   amostra para o modelo se localizar. A tela mostra o pior caso em tokens ao
//   lado, para o número não parecer barato do que é.
//
// Precisa rodar DEPOIS de `config-categorias.js` e de `config-template.js`.

// Os campos, na ordem em que aparecem. `chave` é a chave em `settings.json` e
// o padrão de fábrica vem do backend — `PADROES_DAS_FERRAMENTAS` —, nunca
// digitado aqui: duas listas de padrão divergem no primeiro dia.
const CONFIG_FERRAMENTAS_GRUPOS = [
  {
    titulo: 'Quantos subagentes, e por quanto tempo',
    dica: 'Estes valores valem para o programa inteiro — Chat, Fila e Rotinas.',
    campos: [
      // O teto é 4 porque `subagentes.py` faz `min(paralelo, MAX_PARALELO)` com
      // MAX_PARALELO = 4: escolher 5, 6, 7 ou 8 aqui não fazia nada e não
      // avisava. A tela foi alinhada ao código, e não o contrário.
      { chave: 'max_paralelo_subagentes', min: 1, max: 4,
        rotulo: 'Subagentes rodando ao mesmo tempo',
        ajuda: 'O portão de contexto ainda serializa por tokens acima disto — a janela do LM Studio é uma só.' },
      { chave: 'max_rodadas_ferramentas', min: 1, max: 9,
        rotulo: 'Rodadas de ferramentas por subagente',
        ajuda: 'Quantas vezes um subagente pode parar para usar ferramenta antes de ter que responder. Não vale para o Verificador da Fila, que tem o campo abaixo.' },
      { chave: 'max_rodadas_ferramentas_verificador', min: 1, max: 9,
        rotulo: 'Rodadas de ferramentas — só do <strong>Verificador da Fila</strong>',
        ajuda: 'O Verificador é o único subagente que existe só na Fila, então é o único que pode ter teto próprio sem desalinhar Chat e Fila. Ele precisa de mais que os outros: para dar um item por conferido, tem que ter feito o grep daquele identificador — uma busca por item, no pior caso.' },
      { chave: 'max_ferramentas_rodada', min: 1, max: 9,
        rotulo: 'Ferramentas por rodada',
        ajuda: 'Junto com o campo acima, define o teto de leituras por chamada: ferramentas por rodada × rodadas.' },
      { chave: 'max_tentativas_correcao', min: 0, max: 5,
        rotulo: 'Tentativas de correção de formato',
        ajuda: 'Quantas vezes o programa pede ao modelo que conserte o formato antes de desistir. ⚠️ É o único campo desta tela que custa uma CHAMADA a mais ao LM Studio por tentativa.' },
    ],
  },
  {
    titulo: 'Quanto de janela cada ferramenta pode gastar',
    dica: 'Em <strong>tokens</strong>: estes limites recortam o que vai ao modelo, e janela se mede em token — 400 linhas de CSS e 400 de Python denso não custam a mesma coisa.',
    campos: [
      { chave: 'teto_ler_arquivo_tokens', min: 500, max: 100000, step: 500,
        unidade: 'tokens',
        rotulo: 'Teto de leitura — vale para toda ferramenta que lê',
        ajuda: '⚠️ Um campo para todas: vale para toda ferramenta de subagente que lê um arquivo, inclusive as que uma extensão acrescenta. Todo subagente usa o mesmo modelo, então todos nascem com este teto. Fusível, não política: 99% dos arquivos deste projeto cabem em 15.000.' },
      { chave: 'teto_parte_tokens', min: 500, max: 50000, step: 500,
        unidade: 'tokens',
        rotulo: 'Teto de uma parte — vale também para <code>ler_doc_tecnica</code> e <code>ler_resumo_pastas</code>',
        ajuda: 'Acima disto, um artefato com fronteira natural passa a ser servido em partes com nome. A Documentação técnica e o Resumo de pastas, lidos por seção, enchem a resposta até aqui e terminam dizendo o que ficou de fora, com o pedido pronto para o resto.' },
      { chave: 'busca_semantica_excerpt_tokens', min: 10, max: 2000, step: 10,
        unidade: 'tokens',
        rotulo: 'Trecho mostrado por resultado da busca semântica',
        ajuda: 'Era 200 caracteres, pelo mesmo motivo.' },
      { chave: 'teto_resposta_subagente_tokens', min: 200, max: 15000, step: 100,
        unidade: 'tokens',
        rotulo: 'Teto da resposta que o subagente devolve',
        ajuda: 'O que este teto protege é a janela de quem RECEBE a resposta — o agente principal. Estava nas abas Chat e Fila, uma cópia em cada, guardado só no navegador.' },
      { chave: 'embedding_truncar_tokens', min: 64, max: 8192, step: 64,
        unidade: 'tokens',
        rotulo: 'Truncagem do indexador de embeddings',
        ajuda: 'Quanto de cada trecho o modelo de embedding chega a ver ao indexar. Nunca teve tela.' },
    ],
  },
  {
    titulo: 'Quanto de máquina a busca pode gastar',
    dica: 'Em <strong>KB</strong>: esta decisão é tomada <em>antes</em> de abrir o arquivo. Contar token exigiria ter aberto — que é exatamente o que este limite existe para evitar.',
    campos: [
      { chave: 'grep_max_kb', min: 1, max: 20000, step: 50,
        unidade: 'KB',
        rotulo: 'O <code>grep</code> não abre arquivo maior que',
        ajuda: 'O aviso que o subagente recebe ("N arquivo(s) ignorado(s) por ultrapassarem X KB") usa este número. Antes ele estava digitado à mão na mensagem, e mudar o limite fazia a frase mentir.' },
      { chave: 'grep_corte_linha_chars', min: 20, max: 1000, step: 10,
        unidade: 'caracteres',
        rotulo: 'Quanto de cada linha casada o <code>grep</code> mostra',
        ajuda: 'O único campo em caractere desta tela, e de propósito: é corte de apresentação — amostra para o modelo se localizar —, não orçamento de janela.',
        piorCasoTokens: true },
    ],
  },
  {
    titulo: 'Quantos itens cada ferramenta devolve',
    dica: 'Contagens simples — quantas linhas, quantos arquivos, quantos termos.',
    campos: [
      { chave: 'grep_max_ocorrencias', min: 1, max: 500,
        rotulo: 'Ocorrências na amostra do <code>grep</code>',
        ajuda: 'A varredura conta TUDO e trunca só a amostra — o total sempre aparece.' },
      { chave: 'grep_max_arquivos', min: 1, max: 200,
        rotulo: 'Arquivos no resumo do <code>grep</code>' },
      { chave: 'busca_semantica_top_k', min: 1, max: 50,
        rotulo: 'Resultados da busca semântica' },
      { chave: 'relacoes_max_itens', min: 1, max: 500,
        rotulo: 'Itens de <code>ver_relacoes</code>' },
      { chave: 'listar_pasta_primeiro_nivel', min: 1, max: 200,
        rotulo: 'Subpastas listadas por pasta de trabalho',
        ajuda: 'É orientação, não catálogo: o suficiente para o modelo saber por onde entrar.' },
    ],
  },
];

(function () {
  const grupos = CONFIG_FERRAMENTAS_GRUPOS.map(g => {
    const campos = g.campos.map(c => `
          <div class="config-field-row">
            <label for="cferr-${c.chave}">${c.rotulo}${c.unidade ? ` <span class="config-unidade">(${c.unidade})</span>` : ''}</label>
            <input type="number" id="cferr-${c.chave}"
                   min="${c.min}" max="${c.max}" step="${c.step || 1}" />
            ${c.piorCasoTokens ? `<p class="config-nota" id="cferr-${c.chave}-pior"></p>` : ''}
            ${c.ajuda ? `<p class="config-nota">${c.ajuda}</p>` : ''}
          </div>`).join('');
    return `
      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">${g.titulo}</div>
          <p class="config-cartao-dica">${g.dica}</p>
        </div>
        <div class="config-grade">${campos}</div>
      </div>`;
  }).join('');

  registrarCategoriaConfig({
    chave: 'ferramentas',
    rotulo: 'Ferramentas dos subagentes',
    icone: '⚒',
    resumo: 'os tetos de cada ferramenta',
    conteudo: grupos,
    acoes: '<button class="btn btn-positive" id="btn-save-ferramentas">Salvar ferramentas</button>',
  });
})();
