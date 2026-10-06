// ══════════════════════════════════════════════ TEMPLATE: Aba Aparência
// Markup estático da aba "Aparência" (busca visual). Filtros à esquerda,
// achados à direita — sem sub-abas. Espelha o desenho aprovado em
// "Melhorias a se fazer/preview-aparencia-codigo-e-imagens.html".
//
// "Onde procurar" vem ANTES de "Buscar por" de propósito: ele decide sobre o
// que a busca vai correr (código, imagens ou os dois), e "Buscar por" só decide
// como. Ler de cima para baixo é ler na ordem em que as duas escolhas pesam.
document.getElementById('tab-aparencia').innerHTML = `
  <div class="aparencia-corpo">

    <!-- ── Filtros ── -->
    <div class="aparencia-filtros">

      <div class="aparencia-bloco">
        <div class="aparencia-bloco-titulo">Onde procurar</div>
        <div class="aparencia-seletor" id="aparencia-fonte">
          <button class="aparencia-seletor-botao" data-aparenciafonte="codigo">⌨ Código</button>
          <button class="aparencia-seletor-botao" data-aparenciafonte="imagens">🖼 Imagens</button>
          <button class="aparencia-seletor-botao active" data-aparenciafonte="ambos">◍ Nos dois</button>
        </div>
      </div>

      <div class="aparencia-bloco">
        <div class="aparencia-bloco-titulo">Buscar por</div>
        <div class="aparencia-seletor" id="aparencia-seletor">
          <button class="aparencia-seletor-botao active" data-aparenciamodo="cor">🎨 Cor</button>
          <button class="aparencia-seletor-botao" data-aparenciamodo="texto">🔤 Texto</button>
          <button class="aparencia-seletor-botao" data-aparenciamodo="auditoria">🔍 Auditoria</button>
        </div>
      </div>

      <!-- Cor -->
      <div class="aparencia-bloco aparencia-painel" id="aparencia-painel-cor">
        <div class="aparencia-bloco-titulo">Cor</div>
        <!-- A fileira É a escala de luz visível, do vermelho ao violeta — a mesma
             ordem do trilho do Matiz logo abaixo. Os três neutros ficam numa
             fileira própria: não são posições da escala, e não mudam com ela. -->
        <div class="aparencia-escala" id="aparencia-escala"></div>
        <div class="aparencia-escala aparencia-escala-neutros" id="aparencia-neutros"></div>
        <div class="aparencia-linha" style="margin-top:11px;">
          <span class="aparencia-chip-cor" id="aparencia-chip-cor"></span>
          <input type="text" class="aparencia-campo aparencia-campo-cor" id="aparencia-cor" value="#2ECC71" spellcheck="false" />
        </div>

        <!-- Matiz, saturação e luminância: os três eixos de HSL. O quadrado da
             escala é o atalho grosso; estes são o ajuste fino. -->
        <div class="aparencia-controle" id="aparencia-controle-matiz">
          <label for="aparencia-matiz">Matiz</label>
          <span class="aparencia-trilho">
            <input type="range" id="aparencia-matiz" min="0" max="359" step="1" value="130" />
          </span>
          <span class="aparencia-controle-valor" id="aparencia-matiz-valor">130°</span>
        </div>
        <div class="aparencia-controle" id="aparencia-controle-saturacao">
          <label for="aparencia-saturacao">Saturação</label>
          <span class="aparencia-trilho">
            <input type="range" id="aparencia-saturacao" min="0" max="100" step="1" value="68" />
          </span>
          <span class="aparencia-controle-valor" id="aparencia-saturacao-valor">68%</span>
        </div>
        <div class="aparencia-controle" id="aparencia-controle-luminancia">
          <label for="aparencia-luminancia">Luminância</label>
          <span class="aparencia-trilho">
            <input type="range" id="aparencia-luminancia" min="0" max="100" step="1" value="45" />
          </span>
          <span class="aparencia-controle-valor" id="aparencia-luminancia-valor">45%</span>
        </div>
        <div class="aparencia-tolerancia">
          <label for="aparencia-tolerancia">Tolerância</label>
          <input type="range" id="aparencia-tolerancia" min="0" max="30" value="8" />
          <span class="aparencia-tolerancia-valor" id="aparencia-tolerancia-valor">8%</span>
        </div>
        <!-- Presença mínima NÃO é uma segunda tolerância: a tolerância pergunta
             "é esse verde?" e esta pergunta "esse verde manda na imagem?". Por
             isso são dois controles, e não um. -->
        <div class="aparencia-tolerancia" id="aparencia-bloco-presenca">
          <label for="aparencia-presenca">Presença mínima</label>
          <input type="range" id="aparencia-presenca" min="0" max="90" value="20" />
          <span class="aparencia-tolerancia-valor" id="aparencia-presenca-valor">20%</span>
        </div>
        <div class="aparencia-tolerancia" id="aparencia-bloco-familias">
          <label for="aparencia-familias">Famílias por imagem</label>
          <input type="range" id="aparencia-familias" min="2" max="8" value="3" />
          <span class="aparencia-tolerancia-valor" id="aparencia-familias-valor">3</span>
        </div>
      </div>

      <!-- Texto -->
      <div class="aparencia-bloco aparencia-painel hidden" id="aparencia-painel-texto">
        <div class="aparencia-bloco-titulo">Texto visível</div>
        <input type="text" class="aparencia-campo" id="aparencia-texto" placeholder="Ex: Salvar, Concluído…" spellcheck="false" />
        <label class="aparencia-opcao">
          <input type="checkbox" id="aparencia-ignorar-acentos" checked /> Ignorar acentos e maiúsculas
        </label>
        <label class="aparencia-opcao">
          <input type="checkbox" id="aparencia-incluir-traducoes" checked /> Incluir arquivos de tradução
        </label>
        <!-- Em imagem, texto É o nome do arquivo. Não há OCR aqui. -->
        <label class="aparencia-opcao">
          <input type="checkbox" id="aparencia-nome-de-imagem" checked /> Nas imagens, procurar no nome do arquivo
        </label>
      </div>

      <!-- Auditoria -->
      <div class="aparencia-bloco aparencia-painel hidden" id="aparencia-painel-auditoria">
        <div class="aparencia-bloco-titulo">O que verificar</div>
        <label class="aparencia-opcao">
          <input type="checkbox" id="aparencia-cores-repetidas" checked /> Cores repetidas sem constante
        </label>
        <label class="aparencia-opcao">
          <input type="checkbox" id="aparencia-tons-proximos" checked /> Tons quase idênticos
        </label>
        <label class="aparencia-opcao">
          <input type="checkbox" id="aparencia-textos-duplicados" checked /> Textos duplicados na interface
        </label>
        <label class="aparencia-opcao">
          <input type="checkbox" id="aparencia-icones-iguais" checked /> Ícones quase iguais
        </label>
        <label class="aparencia-opcao">
          <input type="checkbox" id="aparencia-imagens-orfas" checked /> Imagens que ninguém usa
        </label>
      </div>

      <!-- Retraído por padrão: é informação de conferência, não controle de uso
           diário, e a coluna já está cheia. O resumo no título diz o essencial
           sem abrir — quantas pastas, quantas removidas, quantas religadas. -->
      <div class="aparencia-bloco">
        <div class="aparencia-bloco-titulo aparencia-dobra" id="aparencia-escopo-dobra"
             role="button" tabindex="0" aria-expanded="false" aria-controls="aparencia-escopo">
          <span class="aparencia-dobra-seta">▸</span>
          Onde procura
          <span class="aparencia-dobra-resumo" id="aparencia-escopo-resumo"></span>
        </div>
        <div class="aparencia-escopo hidden" id="aparencia-escopo">
          <div class="aparencia-escopo-topo">🔒 Pastas de trabalho do projeto</div>
          <div id="aparencia-escopo-lista"></div>
          <div class="aparencia-escopo-fonte">
            Definido em <b>Projeto → Trabalho</b>. O que está em <b>Projeto → Remover</b> fica de fora —
            <b>clique</b> num item riscado para religá-lo <b>só nesta sessão</b>.
          </div>
        </div>
      </div>

      <div class="aparencia-bloco">
        <div class="aparencia-indice">
          <span id="aparencia-indice-resumo">Índice ainda não gerado</span>
          <button class="btn btn-muted btn-sm" id="aparencia-btn-revarrer">🔄 Revarrer</button>
        </div>
        <div class="aparencia-aviso hidden" id="aparencia-aviso-pillow"></div>
      </div>

      <button class="btn btn-primary" id="aparencia-btn-buscar" style="width:100%;">🔍 Buscar</button>
    </div>

    <!-- ── Resultados ── -->
    <div class="aparencia-resultados">
      <div class="aparencia-resultados-topo">
        <div class="aparencia-contagem" id="aparencia-contagem">
          <strong>0</strong> achados
        </div>
      </div>
      <div class="aparencia-linguagens" id="aparencia-linguagens"></div>
      <div id="aparencia-lista">
        <div class="aparencia-vazio">Escolha uma cor no espectro ou digite um texto e clique em Buscar.</div>
      </div>
    </div>
  </div>
`;
