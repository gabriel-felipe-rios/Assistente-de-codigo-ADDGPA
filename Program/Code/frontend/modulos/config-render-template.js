// ═════════════════════════ TEMPLATE: Configurações → Desempenho dos mapas
// Markup da categoria que regula quanto o desenho dos mapas pode perder de
// qualidade enquanto o usuário arrasta ou amplia.
//
// Injetado por JS, e não escrito no `index.html`, porque o shell já passou das
// 500 linhas da AMF — mesmo motivo dos outros `*-template.js`.
//
// Era uma seção pendurada no fim da rolagem da aba; virou uma categoria do
// trilho (ver `config-categorias.js`). Os ids dos controles não mudaram, então
// `config-render.js` continua valendo como está.
//
// Por que isto é configuração e não um número no código: o ponto certo depende
// do tamanho do projeto e da máquina. Em vez de o usuário pedir ajuste a cada
// tentativa, ele arrasta o slider e acha o dele.
(function () {
  if (typeof registrarCategoriaConfig !== 'function') return;

  registrarCategoriaConfig({
    chave: 'render',
    rotulo: 'Desempenho dos mapas',
    icone: '◧',
    resumo: 'qualidade do desenho, o esboço do Mapa em níveis e os hubs do Impacto',
    conteudo: `
      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Durante o movimento</div>
          <p class="config-cartao-dica">
            Enquanto você arrasta ou amplia um mapa, o desenho pode ser simplificado para o
            movimento continuar liso — e volta ao normal assim que você solta.
            <strong>Marcar mais caixas deixa o gesto mais rápido e mais feio; desmarcar todas
            deixa bonito e lento.</strong>
            Vale para <code>Mapas → Ligações</code> e para <code>Mapas → Pipeline → Mapa em níveis</code>
            — neste, o desenho simplificado é o <strong>esboço</strong>, e só entra com muitos
            cartões na tela (ver o cartão Mapa em níveis, abaixo).
          </p>
        </div>

        <div class="config-grade">
          <div class="config-field-row">
            <label for="cfg-mov-resolucao">Resolução durante o movimento</label>
            <div class="config-slider-row">
              <input type="range" id="cfg-mov-resolucao" min="25" max="100" step="5">
              <span class="config-slider-val" id="cfg-mov-resolucao-val">50%</span>
            </div>
            <p class="config-nota">
              Abaixo de 100% o desenho é pintado menor e ampliado de volta: fica borrado
              durante o gesto. Metade da resolução custa um quarto do trabalho. No Mapa em
              níveis, afastado além de «Simplificar abaixo de», borra ainda mais — até um terço
              deste valor.
            </p>
          </div>

          <!-- ⚠️ O rótulo diz "ESCONDER", e cada item começa com um verbo, de
               propósito. Antes era "O que some durante o movimento" seguido de
               substantivos ("Nomes dos arquivos"), e nessa forma marcar a caixa
               parecia LIGAR o desenho do nome — o contrário do que faz.
               Num painel chamado "Desempenho", a leitura natural de desmarcar é
               "desliguei, logo ficou mais leve", e é o oposto: desmarcado
               significa desenhar tudo durante o gesto, que é o mais pesado que
               existe. Aconteceu de verdade, em 23/08/2026. -->
          <div class="config-field-row">
            <label>Esconder durante o movimento
              <span class="config-check-nota">— cada caixa marcada deixa o gesto mais rápido</span></label>
            <label class="config-check"><input type="checkbox" id="cfg-mov-sem-rotulos">
              Esconder os nomes dos arquivos</label>
            <label class="config-check"><input type="checkbox" id="cfg-mov-sem-setas">
              Esconder as pontas de seta <span class="config-check-nota">— o mais caro de desenhar</span></label>
            <label class="config-check"><input type="checkbox" id="cfg-mov-sem-contorno">
              Esconder o contorno das caixas</label>
            <label class="config-check"><input type="checkbox" id="cfg-mov-sem-ligacoes">
              Esconder as linhas de ligação <span class="config-check-nota">— o maior ganho, e o que mais muda o desenho</span></label>
            <label class="config-check"><input type="checkbox" id="cfg-mov-sem-cor">
              Esconder as cores por linguagem</label>
            <label class="config-check"><input type="checkbox" id="cfg-mov-sem-destaque">
              Esconder o destaque da seleção <span class="config-check-nota">— as ligações acesas e o
              escurecimento do resto somem enquanto arrasta, e voltam ao soltar</span></label>
            <p class="config-nota">
              Com <strong>nenhuma</strong> marcada, o mapa desenha tudo enquanto você arrasta —
              é a opção mais bonita e a <strong>mais lenta</strong>. De fábrica vêm as três
              primeiras marcadas.
            </p>
          </div>
        </div>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Com o mapa parado</div>
          <p class="config-cartao-dica">
            Estes dois valem mesmo sem gesto nenhum: dependem só de quanto o mapa está
            afastado e de quanto se desenha fora da vista.
          </p>
        </div>

        <div class="config-grade">
          <div class="config-field-row">
            <label for="cfg-lod-limite">Simplificar abaixo de</label>
            <div class="config-slider-row">
              <input type="range" id="cfg-lod-limite" min="30" max="100" step="5">
              <span class="config-slider-val" id="cfg-lod-limite-val">65%</span>
            </div>
            <p class="config-nota">
              Afastado além deste ponto, nomes e setas somem mesmo com o mapa parado —
              naquele tamanho eles já estão ilegíveis e só custam desenho. No Mapa em níveis,
              afastado além dele e com muitos cartões na tela, o esboço fica mesmo parado.
            </p>
          </div>

          <div class="config-field-row">
            <label for="cfg-margem">Área desenhada além da tela</label>
            <div class="config-slider-row">
              <input type="range" id="cfg-margem" min="20" max="150" step="10">
              <span class="config-slider-val" id="cfg-margem-val">50%</span>
            </div>
            <p class="config-nota">
              Folga desenhada fora da vista, para arrastar não revelar vazio. Mais folga
              gasta mais; menos folga pisca nas bordas ao arrastar rápido. No Mapa em níveis,
              é quanto além da tela os cartões existem de verdade.
            </p>
          </div>
        </div>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Mapa em níveis</div>
          <p class="config-cartao-dica">
            Nos níveis Arquivos e Funções o mapa tem milhares de cartões, e pintar todos a cada
            quadro era o que travava. Com muitos na tela, o gesto é pintado num
            <strong>esboço</strong> — retângulos, nomes e linhas, borrado conforme as opções
            acima — e o mapa de verdade volta quando você solta.
          </p>
        </div>

        <div class="config-grade">
          <div class="config-field-row">
            <label for="cfg-niveis-cartoes">Usar o esboço a partir de
              <span class="config-unidade">(cartões na tela)</span></label>
            <input type="number" id="cfg-niveis-cartoes" min="0" max="2000" step="10">
            <p class="config-nota">
              Menos aqui = o esboço entra mais cedo (mais liso, mais feio). <strong>0</strong> usa
              o esboço sempre; um número alto quase nunca.
            </p>
          </div>
        </div>
      </div>

      <div class="config-cartao">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Ligações › Impacto</div>
          <p class="config-cartao-dica">
            O Impacto abre com os <strong>hubs</strong> escondidos — os arquivos ligados a
            muitos outros, que viram macarrão. O controle <code>Ocultar hub</code> da tela
            continua mudando isso na hora; aqui fica o valor com que ele abre.
          </p>
        </div>

        <div class="config-grade">
          <div class="config-field-row">
            <label for="cfg-impacto-hub">Esconder, ao abrir, arquivo com mais de
              <span class="config-unidade">(ligações)</span></label>
            <input type="number" id="cfg-impacto-hub" min="5" max="115" step="5">
            <p class="config-nota">
              Menos aqui esconde mais. O arquivo em foco nunca é escondido.
            </p>
          </div>
        </div>
      </div>`,
    acoes: `
      <button class="btn btn-positive" id="btn-save-render">Salvar desempenho</button>`,
  });
})();
