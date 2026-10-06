// ═══════════════ TEMPLATE: Configurações — Rotinas da Automação ══
// Markup da categoria. Quem lê e grava os campos daqui é `limites.js`, junto
// de "Modelo e contexto" e "Tempos e ciclos": um `Salvar` por categoria, uma
// gravação só. As notas de exemplo («o que estes números dão») moram em
// `config-rotinas.js` (desde 2026-09, D29 e D36).
//
// Por que uma categoria PRÓPRIA, e não um cartão em "Modelo e contexto":
// "Modelo e contexto" é o orçamento de tokens por chamada, e vale para o
// programa inteiro — Chat, Fila, Designer e rotinas. O que entra aqui é sobre
// como as ROTINAS de Automação se comportam, e a lista tende a crescer. Misturar
// os dois faria a categoria geral virar o depósito do que não tem casa.
//
// Os campos são de `limites.json` (números inteiros), então quem grava é o
// `saveLimites` de `limites.js`, junto de "Modelo e contexto" e "Tempos e
// ciclos". Um `Salvar` por categoria, uma gravação só — o trilho mantém as
// seções fechadas no DOM justamente para isso funcionar.

// Cada campo: id do input, chave em `limites.json`, rótulo e ajuda. A lista é
// lida só por este arquivo, para montar o markup; os ids, por `limites.js`.
// Os três campos da régua de similaridade (Etapa 3). Ficam numa lista própria
// porque moram num cartão diferente do `paralelas_rotinas` — mesma categoria,
// outra pergunta.
const CONFIG_REGUAS_CAMPOS = [
  {
    chave: 'doc_tecnica_similaridade_pct',
    id: 'input-doc-tecnica-similaridade',
    rotulo: 'Documentação Técnica: regerar abaixo de',
    sufixo: '% de similaridade',
    min: 1,
    max: 100,
    ajuda: 'Vale só para o que <strong>não é código</strong> — prompt, <code>.md</code>, '
         + '<code>.txt</code>. Código decide pela tabela do Detector, não por porcentagem: '
         + 'ela mede bytes, não sentido, e dez palavras trocadas podem ser menos de 0,5% '
         + 'de um arquivo e derrubar a documentação inteira.',
  },
  {
    chave: 'resumo_pastas_similaridade_pct',
    id: 'input-resumo-pastas-similaridade',
    rotulo: 'Resumo de Pastas: regerar abaixo de',
    sufixo: '% de similaridade',
    min: 1,
    max: 100,
    ajuda: 'A similaridade da pasta é a <strong>média ponderada pelo tamanho</strong> dos '
         + 'documentação técnica dela. Dez arquivos iguais e um alterado dá 90%; se o alterado for o '
         + 'maior de dois, dá 9%. É o que impede uma pasta inteira de ser refeita porque '
         + 'um arquivo entre cem ganhou duas linhas.',
  },
  {
    chave: 'pedaco_tokens',
    id: 'input-pedaco-tokens',
    rotulo: 'Tamanho do pedaço',
    sufixo: 'tokens',
    min: 64,
    max: 8192,
    ajuda: 'De que tamanho o texto é cortado <em>antes</em> de ir ao modelo de embedding. '
         + 'A atenção é O(n²): dobrar isto custa quatro vezes mais. '
         + '⚠️ Não é o mesmo que <strong>Ferramentas dos subagentes → truncar tokens</strong>, '
         + 'que é quanto o modelo chega a ver de um texto que já chegou nele.',
  },
];

// Os quatro campos de "A régua do Pipeline" (Pipeline em níveis, fase 03).
// Lista própria pelo mesmo motivo das réguas acima: moram num cartão
// diferente. Rótulos, sufixos e padrões são os da prévia aprovada; quem
// carrega e grava é `limites.js` (LIMITES_CAMPOS).
const CONFIG_PIPELINE_CAMPOS = [
  { chave: 'pipeline_cadeia_refazer_pct', id: 'input-pipeline-cadeia-refazer',
    rotulo: 'Refazer o resumo da cadeia a partir de', sufixo: '% dos passos com frase nova',
    min: 1, max: 100 },
  { chave: 'pipeline_bloco_refazer_pct', id: 'input-pipeline-bloco-refazer',
    rotulo: 'Refazer o bloco a partir de', sufixo: '% das cadeias com resumo novo',
    min: 1, max: 100 },
  { chave: 'pipeline_area_refazer_pct', id: 'input-pipeline-area-refazer',
    rotulo: 'Refazer a área a partir de', sufixo: '% dos blocos com resumo novo',
    min: 1, max: 100 },
  { chave: 'pipeline_cadeia_niveis', id: 'input-pipeline-cadeia-niveis',
    rotulo: 'A cadeia segue as chamadas até', sufixo: 'níveis a partir do começo',
    min: 1, max: 20 },
];

const CONFIG_ROTINAS_CAMPOS = [
  {
    chave: 'paralelas_rotinas',
    id: 'input-paralelas-rotinas',
    rotulo: 'Arquivos processados ao mesmo tempo',
    min: PARALELISMO_MINIMO,
    max: PARALELISMO_MAXIMO,
    ajuda: 'Vale para todas as rotinas que usam o modelo: Documentação Técnica, Resumo de Pastas, '
         + 'Glossário e Pipeline. '
         + 'Cada linha de paralelismo é uma <strong>requisição simultânea ao LM Studio</strong>: '
         + 'passar do que a máquina aguenta faz as respostas degradarem em vez de acelerarem.',
  },
];

(function () {
  const linha = c => `
          <div class="config-field-row">
            <label for="${c.id}">${c.rotulo}</label>
            <input type="number" id="${c.id}" min="${c.min}" max="${c.max}" step="1" />
            ${c.sufixo ? `<span class="config-sufixo">${c.sufixo}</span>` : ''}
            ${c.ajuda ? `<p class="config-nota">${c.ajuda}</p>` : ''}
          </div>`;
  const reguas = CONFIG_REGUAS_CAMPOS.map(linha).join('');
  const reguaDoPipeline = CONFIG_PIPELINE_CAMPOS.map(linha).join('');
  const campos = CONFIG_ROTINAS_CAMPOS.map(c => `
          <div class="config-field-row">
            <label for="${c.id}">${c.rotulo}</label>
            <input type="number" id="${c.id}" min="${c.min}" max="${c.max}" step="1" />
            ${c.ajuda ? `<p class="config-nota">${c.ajuda}</p>` : ''}
          </div>`).join('');

  registrarCategoriaConfig({
    chave: 'rotinas',
    rotulo: 'Rotinas da Automação',
    icone: '⟳',
    resumo: 'como as rotinas se comportam ao gerar',
    conteudo: `
      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Quantas ao mesmo tempo</div>
          <p class="config-cartao-dica">
            Era um campo <strong>dentro de cada card</strong> da sub-aba Rotinas, gravado por
            projeto. Nunca foi uma escolha por projeto — é sobre quantas requisições a sua
            máquina e o LM Studio aguentam de uma vez. E era lido de dois jeitos que não
            conversavam: o botão do card lia a caixinha da tela, o ciclo de Acionamentos lia
            o arquivo do projeto.
          </p>
        </div>
        <div class="config-grade">${campos}</div>
      </div>


      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Quando vale a pena regenerar</div>
          <p class="config-cartao-dica">
            Quem decide é o <strong>Detector</strong>: ele olha o que mudou em cada
            arquivo e só acorda as rotinas que aquilo merece. Estes dois campos
            afinam a decisão nos dois casos em que ela é discutível.
          </p>
        </div>
        <div class="config-grade">
          <div class="config-field-row">
            <label class="config-check">
              <input type="checkbox" id="input-ignorar-so-espaco" />
              <strong>Ignorar mudança só de espaço/indentação</strong>
            </label>
            <p class="config-nota">
              Reindentar um arquivo não muda o que a documentação diz sobre ele.
              Ligado, mexer só em espaço em branco não acorda rotina nenhuma.
            </p>
          </div>
          <div class="config-field-row">
            <label class="config-check">
              <input type="checkbox" id="input-ignorar-so-comentario" />
              <strong>Ignorar mudança só de comentário</strong>
            </label>
            <p class="config-nota">
              <strong>Nasce desligado de propósito.</strong> A Síntese da
              Documentação Técnica vem da docstring — mexer num comentário muda de
              verdade o que ela deveria dizer. Ligue para economizar essa chamada.
            </p>
          </div>
        </div>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Tamanho das respostas</div>
          <p class="config-cartao-dica">
            Três travas para o modelo que entra em repetição e não para de escrever.
            Nenhuma molda a resposta de um arquivo normal: elas só cortam cedo o que já
            saiu do controle.
          </p>
        </div>
        <p class="config-cartao-dica"><strong>1 · Teto de saída proporcional ao arquivo</strong></p>
        <div class="config-grade">
          <div class="config-field-row">
            <label for="input-teto-proporcional-base">Base (tokens)</label>
            <input type="number" id="input-teto-proporcional-base" min="100" step="100" />
          </div>
          <div class="config-field-row">
            <label for="input-teto-proporcional-fator">Mais, por token do arquivo</label>
            <input type="number" id="input-teto-proporcional-fator" min="0.05" step="0.05" />
          </div>
        </div>
        <div class="config-nota" id="teto-proporcional-exemplo"></div>
        <p class="config-cartao-dica"><strong>2 · Tamanho máximo de cada texto</strong></p>
        <div class="config-grade">
          <div class="config-field-row">
            <label for="input-limite-sintese-chars">Síntese (caracteres)</label>
            <input type="number" id="input-limite-sintese-chars" min="1" step="50" />
          </div>
          <div class="config-field-row">
            <label for="input-limite-texto-chars">Cada atribuição, frase ou termo (caracteres)</label>
            <input type="number" id="input-limite-texto-chars" min="1" step="50" />
          </div>
        </div>
        <p class="config-cartao-dica"><strong>3 · Teto de itens · só a rede de segurança</strong></p>
        <div class="config-grade">
          <div class="config-field-row">
            <label for="input-limite-atribuicoes">Atribuições</label>
            <input type="number" id="input-limite-atribuicoes" min="1" step="1" />
          </div>
          <div class="config-field-row">
            <label for="input-limite-tags">Tags</label>
            <input type="number" id="input-limite-tags" min="1" step="1" />
          </div>
          <div class="config-field-row">
            <label for="input-limite-termos-por-arquivo">Termos por arquivo</label>
            <input type="number" id="input-limite-termos-por-arquivo" min="1" step="1" />
          </div>
        </div>
        <p class="config-nota">
          Bem acima do que um arquivo normal pede: não moldam a resposta, só impedem uma
          lista sem fim.
        </p>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Partes e costura · Documentação Técnica</div>
          <p class="config-cartao-dica">Lê <strong>um arquivo de código</strong> por vez.</p>
        </div>
        <p class="config-cartao-dica"><strong>1 · Quanto cabe numa chamada</strong></p>
        <div class="config-grade">
          <div class="config-field-row">
            <label for="input-doc-tecnica-teto-entrada">Arquivo inteiro numa chamada até</label>
            <input type="number" id="input-doc-tecnica-teto-entrada" min="1" max="100" step="5" />
            <span class="config-sufixo">% da janela</span>
            <p class="config-nota">= <span id="doc-tecnica-entrada-tokens"></span> com a janela atual. Até aqui o arquivo vai inteiro.</p>
          </div>
        </div>
        <p class="config-nota config-nota-passagem">↓ não coube? vira partes deste mesmo tamanho, cortadas onde começa uma função, e uma chamada final costura</p>
        <p class="config-cartao-dica"><strong>2 · Dividir ou deixar de fora</strong></p>
        <div class="config-field-row">
          <label class="config-check">
            <input type="checkbox" id="input-doc-tecnica-dividir" />
            <strong>Dividir e costurar o arquivo que não cabe numa chamada</strong>
          </label>
          <p class="config-nota">Desligado, o arquivo que não cabe fica de fora e vai para «Arquivos muito grandes».</p>
        </div>
        <p class="config-nota config-nota-passagem">↓ mesmo dividindo, há um máximo</p>
        <p class="config-cartao-dica"><strong>3 · O máximo aceito, mesmo dividindo</strong></p>
        <div class="config-grade">
          <div class="config-field-row">
            <label for="input-doc-tecnica-max-kb">Tamanho do arquivo até</label>
            <input type="number" id="input-doc-tecnica-max-kb" min="1" step="64" />
            <span class="config-sufixo">KB</span>
          </div>
          <div class="config-field-row">
            <label for="input-doc-tecnica-max-linhas">Linhas até</label>
            <input type="number" id="input-doc-tecnica-max-linhas" min="1" step="500" />
            <span class="config-sufixo">linhas</span>
          </div>
          <div class="config-field-row">
            <label for="input-doc-tecnica-max-tokens">Tokens até</label>
            <input type="number" id="input-doc-tecnica-max-tokens" min="1" step="10000" />
            <span class="config-sufixo">tokens</span>
          </div>
        </div>
        <p class="config-nota">Medidos do mais barato ao mais caro (disco → linhas → tokens). Passou de qualquer um, o arquivo não é dividido e fica em «Arquivos muito grandes».</p>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Partes e costura · Resumo de Pastas</div>
          <p class="config-cartao-dica">Lê <strong>a ficha de cada arquivo direto na pasta</strong> (subpasta não conta: ela tem o próprio resumo).</p>
        </div>
        <p class="config-cartao-dica"><strong>1 · O que ele lê de cada arquivo</strong></p>
        <div class="config-grade">
          <div class="config-field-row">
            <label class="config-check">
              <input type="checkbox" checked disabled />
              <strong>Síntese</strong> <span class="config-sufixo">sempre</span>
            </label>
            <p class="config-nota">Não desliga: sem ela a pasta não tem o que resumir. Alimenta o papel da pasta.</p>
          </div>
          <div class="config-field-row">
            <label class="config-check">
              <input type="checkbox" id="input-resumo-pastas-ficha-atribuicoes" />
              <strong>Atribuições</strong>
            </label>
            <p class="config-nota">Alimenta a responsabilidade de cada arquivo.</p>
          </div>
          <div class="config-field-row">
            <label class="config-check">
              <input type="checkbox" id="input-resumo-pastas-ficha-simbolos" />
              <strong>Símbolos — nome, tipo e linha</strong>
            </label>
            <p class="config-nota">Alimenta «Símbolos» do resumo. Desmarcado, essa seção sai vazia.</p>
          </div>
          <div class="config-field-row">
            <label class="config-check">
              <input type="checkbox" id="input-resumo-pastas-ficha-frases" />
              <strong>Símbolos — a frase de cada um</strong>
            </label>
            <p class="config-nota">Dá a descrição de cada símbolo. Só vale com o de cima marcado.</p>
          </div>
          <div class="config-field-row">
            <label class="config-check">
              <input type="checkbox" id="input-resumo-pastas-ficha-usa" />
              <strong>Usa — as conexões</strong>
            </label>
            <p class="config-nota">Alimenta «Conexões internas» e «externas». Desmarcado, as duas saem vazias.</p>
          </div>
        </div>
        <p class="config-nota config-nota-passagem">↓ com o que está marcado acima, somam-se as fichas da pasta</p>
        <p class="config-cartao-dica"><strong>2 · Quanto cabe numa chamada</strong></p>
        <div class="config-grade">
          <div class="config-field-row">
            <label for="input-resumo-pastas-teto-entrada">Fichas da pasta numa chamada até</label>
            <input type="number" id="input-resumo-pastas-teto-entrada" min="1" max="100" step="5" />
            <span class="config-sufixo">% da janela</span>
            <p class="config-nota">= <span id="resumo-pastas-entrada-tokens"></span> com a janela atual. Até aqui a pasta vai inteira.</p>
          </div>
          <div class="config-field-row">
            <label for="input-resumo-pastas-tokens-por-arquivo">Resposta estimada por arquivo da pasta</label>
            <input type="number" id="input-resumo-pastas-tokens-por-arquivo" min="1" step="10" />
            <span class="config-sufixo">tokens</span>
          </div>
          <div class="config-field-row">
            <label for="input-resumo-pastas-margem-estimativa">Margem da estimativa</label>
            <input type="number" id="input-resumo-pastas-margem-estimativa" min="1" step="5" />
            <span class="config-sufixo">%</span>
          </div>
        </div>
        <p class="config-nota" id="partes-estimativa"></p>
        <p class="config-nota config-nota-passagem">↓ não coube? vira partes, e uma chamada final costura</p>
        <p class="config-cartao-dica"><strong>3 · Como a pasta é dividida</strong></p>
        <div class="config-grade">
          <div class="config-field-row">
            <label for="input-resumo-pastas-max-arquivos-por-parte">Máximo de arquivos por parte</label>
            <input type="number" id="input-resumo-pastas-max-arquivos-por-parte" min="1" step="5" />
            <span class="config-sufixo">arquivos</span>
          </div>
        </div>
        <div class="config-field-row">
          <label class="config-check">
            <input type="checkbox" id="input-resumo-pastas-dividir" />
            <strong>Dividir e costurar a pasta que não cabe numa chamada</strong>
          </label>
          <p class="config-nota">Desligado, a pasta que não cabe numa chamada fica de fora e vai para «Arquivos muito grandes» — igual à Documentação Técnica.</p>
        </div>
        <p class="config-nota config-nota-passagem">↓ mesmo dividindo, há um máximo</p>
        <p class="config-cartao-dica"><strong>4 · O máximo aceito, mesmo dividindo</strong></p>
        <div class="config-grade">
          <div class="config-field-row">
            <label for="input-resumo-pastas-max-arquivos">Arquivos direto na pasta até</label>
            <input type="number" id="input-resumo-pastas-max-arquivos" min="1" step="50" />
            <span class="config-sufixo">arquivos</span>
          </div>
          <div class="config-field-row">
            <label for="input-resumo-pastas-max-tokens">Fichas da pasta, somadas, até</label>
            <input type="number" id="input-resumo-pastas-max-tokens" min="1" step="10000" />
            <span class="config-sufixo">tokens</span>
          </div>
        </div>
        <p class="config-nota">Contar os arquivos não lê nada; somar as fichas conta os tokens, com o que estiver marcado no item 1. Passou de qualquer um, a pasta não é resumida e aparece em «Arquivos muito grandes», com o motivo.</p>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">A régua do que não é código</div>
          <p class="config-cartao-dica">
            Código decide pelo <strong>quê</strong> mudou — a tabela do Detector.
            O que não é código decide pelo <strong>quanto</strong>, por similaridade
            de sentido: o texto é fatiado por fronteira natural (cabeçalho, símbolo,
            bloco) e cada fatia é comparada com a de quando a saída foi gerada.
          </p>
        </div>
        <div class="config-grade">${reguas}</div>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">A régua do Pipeline</div>
          <p class="config-cartao-dica">Quando uma frase de passo muda, o resumo da cadeia, o do bloco e o da área só são refeitos se a mudança passar destes limites. A visão geral é montada sem o modelo.</p>
        </div>
        <div class="config-grade">${reguaDoPipeline}</div>
        <p class="config-nota">Passo ou cadeia que entrou ou saiu refaz sempre. A cadeia também para ao chegar noutro começo (clique, ponte, abertura…), qualquer que seja o nível.</p>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Quem entra no Glossário</div>
          <p class="config-cartao-dica">
            Um termo entra quando aparece em arquivos diferentes, ignorando maiúscula,
            minúscula e acento.
          </p>
        </div>
        <div class="config-grade">
          <div class="config-field-row">
            <label class="config-check">
              <input type="radio" name="glossario-minimo-modo" id="input-glossario-minimo-proporcional" value="proporcional" />
              <strong>Proporcional ao tamanho do projeto</strong>
            </label>
            <label class="config-check">
              <input type="radio" name="glossario-minimo-modo" id="input-glossario-minimo-modo-fixo" value="fixo" />
              <strong>Número fixo de arquivos</strong>
            </label>
          </div>
        </div>
        <div class="config-grade" id="glossario-linha-proporcional">
          <div class="config-field-row">
            <label for="input-glossario-minimo-pct">Porcentagem dos arquivos documentados</label>
            <input type="number" id="input-glossario-minimo-pct" min="0.5" step="0.5" />
            <span class="config-sufixo">%</span>
          </div>
          <div class="config-field-row">
            <label for="input-glossario-minimo-piso">Nunca menos que</label>
            <input type="number" id="input-glossario-minimo-piso" min="2" step="1" />
            <span class="config-sufixo">arquivos</span>
          </div>
        </div>
        <div class="config-grade" id="glossario-linha-fixo">
          <div class="config-field-row">
            <label for="input-glossario-minimo-fixo">Mínimo de arquivos</label>
            <input type="number" id="input-glossario-minimo-fixo" min="2" step="1" />
            <span class="config-sufixo">arquivos</span>
          </div>
        </div>
        <div class="config-nota" id="glossario-minimo-exemplo"></div>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Qual modelo as rotinas usam</div>
          <p class="config-cartao-dica">
            <strong>O modelo é um só para o programa inteiro, e se escolhe em Modelo e contexto ›
            Modelo e geração.</strong> Com a caixa «Usar as configurações deste programa»
            desmarcada, as rotinas usam o modelo que estiver carregado no LM Studio — o mesmo
            que o Chat, a Fila e o Designer usam.
            Cada card tinha o próprio seletor de modelo, e isso deixava o botão "▶ Executar"
            rodar com um modelo diferente do que o ciclo de Acionamentos usava, sobre a mesma
            documentação.
          </p>
        </div>
      </div>`,
    acoes: '<button class="btn btn-positive" id="btn-save-rotinas">Salvar rotinas</button>',
  });
})();
