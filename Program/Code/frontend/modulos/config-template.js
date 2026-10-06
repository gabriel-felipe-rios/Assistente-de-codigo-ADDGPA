// ═══════════════════════════ TEMPLATE: Configurações — casca e categorias base
// Monta a casca da aba (trilho + painel rolável + barra de ações) e registra as
// três primeiras categorias: Ordem das abas, Modelo e contexto, Tempos e ciclos.
//
// Injetado por JS, e não escrito no `index.html`, porque o shell já passou das
// 500 linhas da AMF — mesmo motivo dos outros `*-template.js`.
//
// Precisa rodar DEPOIS de `config-categorias.js` (que define
// `registrarCategoriaConfig`) e ANTES dos templates das demais categorias
// (`config-render-template.js`, `config-tema-template.js`), que se penduram
// na casca criada aqui.
(function () {
  const aba = document.getElementById('ptab-configs');
  if (!aba) return;

  aba.insertAdjacentHTML('beforeend', `
    <div class="config-shell">
      <!-- O trilho É um grupo reordenável, como qualquer barra de abas do
           programa. Sem estes atributos ele não aparecia em "Ordem das
           abas", e o pill "Configurações" nunca ganhava o ▾ para expandir.
           O data-taborder-painel diz onde estão os painéis: o valor de
           data-categoria é uma chave curta ("modelo"), não um id de elemento,
           então tab-order.js precisa do prefixo para achá-los. -->
      <nav class="config-trilho" id="config-trilho"
           data-taborder-group="config_categorias"
           data-taborder-label="Categorias de Configurações"
           data-taborder-parent="ptab-configs"
           data-taborder-painel="config-secao-">
        <div class="config-trilho-titulo">Configurações</div>
        <input type="search" id="config-busca" class="config-busca"
               placeholder="Buscar configuração..." autocomplete="off" spellcheck="false" />
        <div id="config-busca-achados" class="config-busca-achados hidden"></div>

        <!-- O nível de cima do trilho: as categorias DO PROGRAMA de um lado,
             uma entrada por extensão ligada com tela do outro. Toggle
             segmentado (Padrões de interface › Componentes), e não dois
             botões soltos: são exatamente duas posições e a troca é imediata.

             ⚠️ DENTRO DE UM div, E NUNCA COMO FILHO DIRETO DO nav.
             tab-order.js descobre o atributo de navegação de uma barra
             olhando o PRIMEIRO botão filho dela (_navAttrOfBar); um
             button com data-lado solto aqui faria "Ordem das abas" reordenar
             as categorias por data-lado — duas pílulas no lugar de dezenove,
             e sem erro nenhum no console.

             (Sem crases neste comentário de propósito: ele mora DENTRO de um
             template literal, e uma crase aqui o fecharia no meio.) -->
        <div class="mapa-toggle config-lados" id="config-lados">
          <button class="mapa-toggle-btn active" data-lado="programa">Programa</button>
          <button class="mapa-toggle-btn" data-lado="extensoes">Extensões</button>
        </div>

        <!-- Os botões do lado Extensões moram AQUI, e não soltos no nav,
             pelo mesmo motivo: assim "Ordem das abas" continua enxergando só
             as categorias do programa, e uma extensão ligada não aparece numa
             lista de reordenação de onde ela some ao ser desligada.
             config-categorias.js os insere; extensoes/tela.js os cria. -->
        <div id="config-trilho-extensoes" class="config-trilho-extensoes hidden"></div>
        <p id="config-lado-extensoes-vazio" class="config-trilho-vazio hidden">
          Nenhuma extensão ligada trouxe tela de configuração.
        </p>
      </nav>
      <div class="config-painel">
        <div class="config-rolagem" id="config-rolagem"></div>
        <div class="config-barra-acoes" id="config-barra-acoes"></div>
      </div>
    </div>
  `);

  // ── Ordem das abas ──
  // Os cartões desta seção não estão escritos aqui: `tab-order.js` os gera a
  // partir de todo elemento com [data-taborder-group] no HTML, e continua
  // fazendo isso — o que muda é que cada grupo descoberto vira um cartão.
  registrarCategoriaConfig({
    chave: 'ordem',
    rotulo: 'Ordem das abas',
    icone: '⠿',
    resumo: 'arraste as pílulas para reordenar',
    conteudo: '<div id="taborder-root"></div>',
    acoes: '<button class="btn btn-positive" id="btn-save-tab-order">Salvar ordem</button>',
  });

  // ── Modelo e contexto ──
  registrarCategoriaConfig({
    chave: 'modelo',
    rotulo: 'Modelo e contexto',
    icone: '◆',
    resumo: 'orçamento de tokens por arquivo',
    conteudo: `
      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Onde o LM Studio escuta</div>
          <p class="config-cartao-dica">
            Veio do modal da engrenagem, que deixou de existir: era a única
            configuração do programa que morava fora desta aba.
          </p>
        </div>
        <div class="config-grade">
          <div class="config-field-row">
            <label for="input-lm-url">URL do LM Studio</label>
            <input type="text" id="input-lm-url" autocomplete="off" spellcheck="false" />
          </div>
        </div>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Modelo e geração</div>
          <p class="config-cartao-dica">
            Quem manda: o programa ou o LM Studio. <strong>Desligado</strong>, o programa
            usa o modelo que estiver carregado no LM Studio, com as configurações de lá,
            e ignora tudo o que está neste cartão.
          </p>
        </div>
        <label class="config-check"><input type="checkbox" id="input-usar-config-programa"> <strong>Usar as configurações deste programa</strong></label>
        <div id="cfg-modelo-dependente">
          <div class="config-field-row">
            <label for="select-modelo-escolhido">Modelo</label>
            <div class="cpr-campo-solto">
              <select id="select-modelo-escolhido">
                <option value="">(qualquer um carregado no LM Studio)</option>
              </select>
            </div>
            <div><button class="btn btn-muted btn-sm" id="btn-detectar-modelos" type="button">⟳ Detectar modelos</button></div>
            <p class="config-nota" id="modelos-detectados"></p>
          </div>

          <p class="config-cartao-dica"><strong>Pensamento — onde o modelo pensa antes de responder</strong></p>
          <p class="config-nota">
            Pensar costuma melhorar a resposta e custa tempo: o raciocínio gasta o mesmo
            teto de saída. Enquanto o modelo pensa, o formato garantido não vale; o
            resgate da resposta cuida do que vier sujo.
          </p>
          <div class="config-grade">
            <label class="config-check"><input type="checkbox" id="input-pensamento-rotinas"> Rotinas da Automação</label>
            <label class="config-check"><input type="checkbox" id="input-pensamento-chat"> Chat</label>
            <label class="config-check"><input type="checkbox" id="input-pensamento-fila"> Fila</label>
            <label class="config-check"><input type="checkbox" id="input-pensamento-subagentes"> Subagentes</label>
            <label class="config-check"><input type="checkbox" id="input-pensamento-designer"> Designer</label>
          </div>

          <details>
            <summary>Ajustes de geração — temperatura e afins</summary>
            <p class="config-nota">Vazio = vale o valor do LM Studio. Só entra na chamada o que estiver preenchido.</p>
            <div class="config-grade">
              <div class="config-field-row">
                <label for="input-geracao-temperatura">Temperatura</label>
                <input type="number" id="input-geracao-temperatura" step="0.1" placeholder="do LM Studio" />
              </div>
              <div class="config-field-row">
                <label for="input-geracao-top-p">Top P</label>
                <input type="number" id="input-geracao-top-p" step="0.05" placeholder="do LM Studio" />
              </div>
              <div class="config-field-row">
                <label for="input-geracao-top-k">Top K</label>
                <input type="number" id="input-geracao-top-k" step="1" placeholder="do LM Studio" />
              </div>
              <div class="config-field-row">
                <label for="input-geracao-min-p">Min P</label>
                <input type="number" id="input-geracao-min-p" step="0.01" placeholder="do LM Studio" />
              </div>
              <div class="config-field-row">
                <label for="input-geracao-repeat-penalty">Penalidade de repetição</label>
                <input type="number" id="input-geracao-repeat-penalty" step="0.05" placeholder="do LM Studio" />
              </div>
            </div>
          </details>
        </div>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Janela do modelo</div>
          <p class="config-cartao-dica">
            O limite de conteúdo enviado ao LM Studio não é um número fixo por agente —
            é calculado por arquivo, a partir destes campos.
            <code>index.html</code> tem 107 mil caracteres mas só 26 mil tokens; medir
            em tokens é o que evita descartar arquivo grande à toa.
            Os tetos são uma <strong>porcentagem da janela</strong>, que é lida do LM Studio:
            trocou de modelo ou de máquina, eles acompanham sozinhos. Ao lado, quanto cada
            um dá com a janela de agora.
          </p>
        </div>
        <div class="config-grade">
          <div class="config-field-row">
            <label for="input-janela-contexto">Janela de contexto do modelo (tokens)</label>
            <input type="number" id="input-janela-contexto" readonly disabled />
            <p class="config-nota" id="janela-contexto-origem">Consultando o LM Studio…</p>
          </div>
          <div class="config-field-row">
            <label for="input-teto-entrada">Teto de entrada por chamada (% da janela)</label>
            <input type="number" id="input-teto-entrada" min="5" max="90" step="1" />
            <span class="config-sufixo" id="teto-entrada-tokens"></span>
            <p class="config-nota" id="teto-entrada-conta"></p>
          </div>
          <div class="config-field-row">
            <label for="input-teto-saida">Teto de saída por chamada (% da janela)</label>
            <input type="number" id="input-teto-saida" min="1" max="60" step="1" />
            <span class="config-sufixo" id="teto-saida-tokens"></span>
            <p class="config-nota">
              Vira o <code>max_tokens</code> da chamada. Resposta que bate neste teto
              é <strong>recusada</strong> e vai para a aba Erros da rotina — o arquivo
              anterior fica intacto.
            </p>
          </div>
          <div class="config-field-row">
            <label for="input-margem-pct">Margem de segurança (% da janela)</label>
            <input type="number" id="input-margem-pct" min="0" max="90" step="5" />
            <span class="config-sufixo" id="margem-tokens"></span>
            <p class="config-nota">Folga reservada sobre a conta final.</p>
          </div>
        </div>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Política de saída</div>
          <p class="config-cartao-dica">
            Os dois interruptores que decidem o que o programa exige do modelo e o
            que ele faz quando a resposta vem torta. <strong>Ligados de fábrica</strong> —
            são eles que consertam os arquivos estragados.
          </p>
        </div>
        <div class="config-grade">
          <div class="config-field-row">
            <label class="config-check">
              <input type="checkbox" id="input-formato-garantido" />
              <strong>Formato garantido</strong>
            </label>
            <p class="config-nota">
              Manda o esquema JSON junto do prompt, e o LM Studio <em>obriga</em> o
              modelo a responder naquele formato. Sem ele, o programa aceita o que
              vier e tenta interpretar.
              <br><strong>Afeta:</strong> as rotinas de documentação —
              Documentação Técnica, Resumo de Pastas, Glossário e Pipeline — e o
              agente principal da <strong>Fila</strong>.
              <br><strong>Não afeta:</strong> Chat, Subagentes e Designer. Ali
              a prosa livre é o produto, e o Designer devolve HTML, que não cabe
              em esquema JSON. A Fila entrou porque a resposta dela sempre foi um
              JSON de envelope — não havia prosa livre a proteger.
            </p>
          </div>
          <div class="config-field-row">
            <label class="config-check">
              <input type="checkbox" id="input-resgate-resposta" />
              <strong>Resgate da resposta</strong>
            </label>
            <p class="config-nota">
              Quando a resposta vem com o raciocínio em volta, ou começa no meio
              porque o modelo rascunhou o formato antes, o programa recorta e fica
              com a <em>última</em> versão — que é sempre a boa. Desligado, resposta
              suja vira erro na aba Erros em vez de o programa adivinhar.
              <br><strong>Afeta:</strong> as seis rotinas <em>e também</em> o Chat,
              a Fila e os subagentes — alcance maior que o do Formato garantido.
              <br><strong>Não afeta:</strong> o Designer.
            </p>
          </div>
        </div>
        <p class="config-nota">
          ⚠️ <strong>Não existe "retentar".</strong> Uma resposta que não serve nunca
          vira uma segunda chamada ao modelo — ela vira erro na tela, e o arquivo
          anterior fica intacto. Retentar custaria uma chamada a mais, e isso está
          descartado por decisão de projeto.
        </p>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Onde cada limite vale</div>
          <p class="config-cartao-dica">
            Só leitura. Antes não havia como saber que o teto de saída não alcança
            o Chat, a Fila nem os subagentes — e quem aumentava o campo esperando
            respostas mais longas no Chat não via mudança nenhuma.
          </p>
        </div>
        <div class="config-tabela-wrap">
          <table class="config-tabela">
            <thead>
              <tr><th>Limite</th><th>Rotinas</th><th>Chat</th><th>Fila</th><th>Subagentes</th><th>Designer</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Janela de contexto</td>
                <td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td>
              </tr>
              <tr>
                <td>Teto de <strong>saída</strong></td>
                <td>✓</td><td>—</td><td>—</td><td>—</td><td>✓</td>
              </tr>
              <tr>
                <td>Teto de <strong>entrada</strong></td>
                <td>✓</td><td>✓</td><td>✓</td><td>—</td><td>—</td>
              </tr>
              <tr>
                <td>Margem de segurança</td>
                <td>✓</td><td>—</td><td>—</td><td>—</td><td>—</td>
              </tr>
              <tr>
                <td>Teto da resposta do subagente</td>
                <td>—</td><td>—</td><td>—</td><td>✓</td><td>—</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="config-nota">
          O teto da resposta do subagente e os limites de cada ferramenta moram na
          categoria <strong>Ferramentas dos subagentes</strong>.
        </p>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Prévia da conta</div>
          <p class="config-cartao-dica">
            A mesma conta que os agentes fazem por arquivo, com os valores acima.
            Não depende de projeto aberto.
          </p>
        </div>
        <div class="limites-preview" id="limites-preview">
          <div class="limites-preview-title">Prévia da conta (arquivo de exemplo)</div>
          <div class="limites-preview-body" id="limites-preview-body"></div>
        </div>
      </div>`,
    acoes: '<button class="btn btn-positive" id="btn-save-limites">Salvar limites</button>',
  });

  // ── Tempos e ciclos ──
  // Três delays em vez de um: cada grupo de agentes tem urgência e custo
  // diferentes. O cronômetro de cada grupo reinicia a cada escrita, como
  // sempre — o propósito do debounce não mudou.
  registrarCategoriaConfig({
    chave: 'tempos',
    rotulo: 'Tempos e ciclos',
    icone: '◷',
    resumo: 'quanto o programa espera antes de disparar os agentes',
    conteudo: `
      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Debounce por grupo</div>
          <p class="config-cartao-dica">
            Cada grupo de agentes tem urgência e custo diferentes. O cronômetro de
            cada grupo reinicia a cada escrita no projeto.
          </p>
        </div>
        <div class="config-grade">
          <div class="config-field-row">
            <label for="input-debounce-t1-segundos">T1 — determinísticos, sem LLM (segundos)</label>
            <input type="number" id="input-debounce-t1-segundos" min="1" max="600" step="1" />
            <p class="config-nota">Hashes, Índice de Símbolos, Grafo, Identificadores, Bibliotecas, Comentários, Duplicados</p>
          </div>
          <div class="config-field-row">
            <label for="input-debounce-t2-segundos">T2 — para agente externo ler (segundos)</label>
            <input type="number" id="input-debounce-t2-segundos" min="1" max="600" step="1" />
            <p class="config-nota">Doc. Técnica, Índice de navegação, Glossário, Pipeline</p>
          </div>
          <div class="config-field-row">
            <label for="input-debounce-t3-segundos">T3 — para você ler (segundos)</label>
            <input type="number" id="input-debounce-t3-segundos" min="1" max="600" step="1" />
            <p class="config-nota">Resumo de pastas, Embedding Semântico</p>
          </div>
        </div>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Limite do ciclo</div>
          <p class="config-cartao-dica">
            Conta inatividade, não duração: enquanto o agente estiver processando,
            a espera se renova sozinha. Uma Documentação Técnica de horas roda até o fim. Passado
            este tempo <em>sem nada acontecer</em>, o agente é dado como travado e o
            ciclo é interrompido ali — o que faltou fica registrado em Pendências.
          </p>
        </div>
        <div class="config-grade">
          <div class="config-field-row">
            <label for="input-timeout-agente-minutos">Desistir de esperar uma rotina parada (minutos)</label>
            <input type="number" id="input-timeout-agente-minutos" min="1" max="240" step="1" />
          </div>
        </div>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Tempo máximo de um subagente</div>
          <p class="config-cartao-dica">
            ⚠️ <strong>Não é o mesmo relógio do campo acima.</strong> Aquele conta
            <em>inatividade</em> e se renova enquanto houver sinal de vida; este conta
            a <em>duração total</em> e <em>interrompe</em> o subagente quando estoura,
            mesmo que ele esteja trabalhando. Veio do modal da engrenagem.
          </p>
        </div>
        <div class="config-grade">
          <div class="config-field-row">
            <label class="config-check">
              <input type="checkbox" id="input-subagente-timeout-enabled" />
              Interromper um subagente que passe do tempo
            </label>
          </div>
          <div class="config-field-row">
            <label for="input-subagente-timeout-min">Tempo máximo de um subagente (minutos)</label>
            <input type="number" id="input-subagente-timeout-min" min="1" max="120" step="1" />
          </div>
        </div>
      </div>`,
    acoes: '<button class="btn btn-positive" id="btn-save-tempos">Salvar tempos</button>',
  });
})();
