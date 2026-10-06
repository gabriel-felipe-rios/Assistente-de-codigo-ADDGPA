// ═════════════════════ TEMPLATE: Configurações → Arquivos que o programa lê
// Markup da categoria que decide o que o programa nem enxerga, o que ele conta
// como código e o que cada parte dele lê. Quatro vistas; um arquivo JSON por
// vista que grava (D12) — dá para editar cada um à mão:
//
//   Nunca ler       → Internal/config/arquivos-que-o-programa-le-nunca-ler.json
//   O que é código  → …-o-que-e-codigo.json
//   Exceções        → …-excecoes.json (Acrescentar e Retirar por parte, D39)
//   Quem lê o quê   → só leitura, sem arquivo (D38)
//
// Injetado por JS, e não escrito no `index.html`, porque o shell já passou das
// 500 linhas da AMF — mesmo motivo dos outros `*-template.js`.
//
// Por que isto é configuração e não uma decisão fechada no código:
// **"isto é código?" não é decidível pelo programa.** Um `.md` que é prompt de
// agente é código do projeto; um `README.md` não é.
//
// ⚠️ A CHAVE CONTINUA `extensoes`, e só o RÓTULO mudou (era "Extensões e pastas
// ignoradas" até 23/09/2026). A chave casa com `tab-order.json`,
// `_CONFIG_RESTAURADORES`, `btn-reset-extensoes` e `config-secao-extensoes` —
// renomeá-la some com a categoria sem erro nenhum.
//
// ⚠️ "Aparência: onde procurar" deixou de ser categoria: as duas listas dela
// são as linhas "Busca visual" de Quem lê o quê. A tabela de exceções de
// quatro colunas também saiu — cada coluna virou uma linha.
//
// O comportamento mora em `config-extensoes.js` (a casca, com o estado) e em
// `config-arquivos-lidos-nunca.js`, `-codigo.js`, `-excecoes.js` e `-quem.js`
// (uma vista cada).
(function () {
  if (typeof registrarCategoriaConfig !== 'function') return;

  // A linha de pílulas do cabeçalho: onde aquela lista vale.
  const abas = (ligadas) => `
    <div class="ext-abas">
      <span class="rot">Vale em</span>
      ${ligadas.map(a => `<span class="ext-aba">${a}</span>`).join('')}
    </div>`;

  const TODAS_AS_ABAS = ['Projeto › Resumo', 'Mapas', 'Automação', 'Arquivos',
                         'Análise', 'Aparência'];

  const BUSCA = 'extensao extensoes arquivo pasta ignorada ignorar nunca ler linguagem formato codigo quem le';

  const nota = arquivo => `
    <p class="config-nota">Gravado em <code>Internal/config/${arquivo}</code> — dá para editar à mão.</p>`;

  const variacoes = lista => `
    <div class="ext-variacoes hidden" data-variacoes="${lista}"></div>`;

  registrarCategoriaConfig({
    chave: 'extensoes',
    rotulo: 'Arquivos que o programa lê',
    icone: '▦',
    resumo: 'vale para todos os projetos · um arquivo por vista',
    conteudo: `
      <div class="mapa-toggle" id="ext-vistas">
        <button class="mapa-toggle-btn active" data-ext-vista="nunca">Nunca ler</button>
        <button class="mapa-toggle-btn" data-ext-vista="codigo">O que é código</button>
        <button class="mapa-toggle-btn" data-ext-vista="excecoes">Exceções</button>
        <button class="mapa-toggle-btn" data-ext-vista="quem">Quem lê o quê</button>
      </div>

      <!-- ─────────── Nunca ler ─────────── -->
      <div class="ext-vista" id="ext-vista-nunca">
        ${nota('arquivos-que-o-programa-le-nunca-ler.json')}

        <div class="config-cartao" data-config-busca="${BUSCA}">
          <div class="config-cartao-cabecalho">
            <div class="config-cartao-titulo">Pastas · por nome</div>
            <p class="config-cartao-dica">
              Em qualquer profundidade, com tudo que estiver dentro. O que é só de um projeto
              vai em <code>Projeto › Remover</code>.
            </p>
            ${abas(TODAS_AS_ABAS)}
          </div>
          <div class="ext-linha-add">
            <input class="ext-input" id="ext-add-pastas_ignoradas"
                   placeholder="Nome da pasta — ex.: node_modules">
            <button class="btn btn-primary btn-sm" data-ext-add="pastas_ignoradas">Acrescentar</button>
            <button class="btn-variacao-tudo" type="button" data-ext-ver-variacoes="pastas_ignoradas">Variações ▸</button>
          </div>
          ${variacoes('pastas_ignoradas')}
          <div class="ext-chips" id="ext-chips-pastas_ignoradas"></div>
          <p class="config-nota">
            As variações marcadas entram junto ao clicar em Acrescentar, e voltam a ficar
            desmarcadas depois. Tracejado = veio de fábrica.
          </p>
        </div>

        <div class="config-cartao" data-config-busca="${BUSCA}">
          <div class="config-cartao-cabecalho">
            <div class="config-cartao-titulo">Arquivos · por nome</div>
            <p class="config-cartao-dica">O arquivo em si, com ou sem a extensão junto.</p>
            ${abas(TODAS_AS_ABAS)}
          </div>
          <div class="ext-linha-add">
            <input class="ext-input" id="ext-add-arquivos_ignorados"
                   placeholder="Nome do arquivo — ex.: readme.md">
            <button class="btn btn-primary btn-sm" data-ext-add="arquivos_ignorados">Acrescentar</button>
            <button class="btn-variacao-tudo" type="button" data-ext-ver-variacoes="arquivos_ignorados">Variações ▸</button>
          </div>
          ${variacoes('arquivos_ignorados')}
          <div class="ext-chips" id="ext-chips-arquivos_ignorados"></div>
          <p class="config-nota">
            Marcando as três primeiras variações e digitando <code>readme.md</code>, entram de uma
            vez <code>readme.md</code>, <code>README.MD</code>, <code>Readme.md</code>. O que ficar
            desmarcado <b>não</b> é ignorado — dá para deixar uma variação de fora de propósito.
          </p>
        </div>

        <div class="config-cartao" data-config-busca="${BUSCA}">
          <div class="config-cartao-cabecalho">
            <div class="config-cartao-titulo">Extensões</div>
            <p class="config-cartao-dica">
              O arquivo some de <b>todas</b> as telas e de <b>todos</b> os números — não aparece
              nem na árvore, nem na contagem de arquivos, nem na busca. Como se não existisse.
              Só o <b>Editor</b> continua mostrando.
            </p>
            ${abas(TODAS_AS_ABAS)}
          </div>
          <div class="ext-linha-add">
            <input class="ext-input" id="ext-add-extensoes_ignoradas" placeholder="Extensão — ex.: .png">
            <button class="btn btn-primary btn-sm" data-ext-add="extensoes_ignoradas">Acrescentar</button>
          </div>
          <div class="ext-chips" id="ext-chips-extensoes_ignoradas"></div>
          <p class="config-nota">
            Tracejado = veio de fábrica. A busca visual da Aparência <b>ganha</b> desta lista:
            as imagens que ela lê (em <b>Exceções</b>) são lidas mesmo estando aqui.
          </p>
        </div>
      </div>

      <!-- ─────────── O que é código ─────────── -->
      <div class="ext-vista hidden" id="ext-vista-codigo">
        <p class="config-nota">
          Gravado em <code>Internal/config/arquivos-que-o-programa-le-o-que-e-codigo.json</code> —
          cada linguagem com o nome e as extensões dela; dá para editar à mão.
        </p>

        <div class="config-cartao" data-config-busca="${BUSCA}">
          <div class="config-cartao-cabecalho">
            <div class="config-cartao-titulo">Linguagens</div>
            <p class="config-cartao-dica">
              A lista de código. Abra uma linguagem para acrescentar extensão a ela. O que estiver
              <b>desmarcado</b> continua existindo no programa — só não soma linha nem entra nos mapas.
            </p>
          </div>
          <div class="ext-linha-add ext-linha-add--larga">
            <input class="ext-input" id="ext-add-linguagem-nome" placeholder="Nome — ex.: Astro">
            <input class="ext-input ext-input--curta" id="ext-add-linguagem-ext" placeholder="1ª extensão — .astro">
            <button class="btn btn-primary btn-sm" id="btn-ext-add-linguagem">＋ Adicionar linguagem</button>
          </div>
          <div class="rc-config-groups config-ext-grupos" id="ext-grupos-linguagens"></div>
        </div>

        <div class="config-cartao" data-config-busca="${BUSCA}">
          <div class="config-cartao-cabecalho">
            <div class="config-cartao-titulo">Formatos especiais</div>
            <p class="config-cartao-dica">
              Não são linguagem, mas podem ser código do seu projeto — um <code>.md</code> que é
              prompt de agente, por exemplo. Somam linha, mas não entram em "Linguagens" do Resumo.
            </p>
          </div>
          <div class="ext-linha-add ext-linha-add--larga">
            <input class="ext-input" id="ext-add-formato" placeholder="Formato — ex.: .csv">
            <button class="btn btn-primary btn-sm" id="btn-ext-add-formato">＋ Adicionar formato</button>
          </div>
          <div class="ext-chips" id="ext-formatos"></div>
        </div>

        <div class="config-cartao" data-config-busca="${BUSCA}">
          <div class="config-cartao-cabecalho">
            <div class="config-cartao-titulo">Extensões soltas</div>
            <p class="config-cartao-dica">
              Extensão que conta como código mas não é de linguagem nenhuma. Se ela for de uma
              linguagem, acrescente em <b>Linguagens</b>.
            </p>
          </div>
          <div class="ext-linha-add ext-linha-add--larga">
            <input class="ext-input" id="ext-add-solta" placeholder="Extensão — ex.: .tpl">
            <button class="btn btn-primary btn-sm" id="btn-ext-add-solta">＋ Adicionar extensão</button>
          </div>
          <div class="ext-chips" id="ext-chips-soltas"></div>
        </div>

        <div class="config-cartao" data-config-busca="${BUSCA}">
          <div class="config-cartao-cabecalho">
            <div class="config-cartao-titulo">
              O que cada número conta <span class="ext-selo-cab">só leitura</span>
            </div>
            <p class="config-cartao-dica">
              Os quatro números de <code>Projeto › Resumo</code> não usam o mesmo filtro.
            </p>
          </div>
          <table class="ext-tabela">
            <thead><tr>
              <th style="width:30%">Número</th><th style="width:17%">Filtro</th><th>O que entra</th>
            </tr></thead>
            <tbody>
              <tr><td><b>Pastas</b></td>
                  <td><span class="ext-selo tudo">sem filtro</span></td>
                  <td>todas, inclusive as vazias</td></tr>
              <tr><td><b>Arquivos</b></td>
                  <td><span class="ext-selo tudo">sem filtro</span></td>
                  <td>todo arquivo que não está em <b>Nunca ler</b></td></tr>
              <tr><td><b>Linhas de código</b></td>
                  <td><span class="ext-selo filtra">sua lista</span></td>
                  <td>o que estiver marcado em <b>Linguagens</b>, <b>Formatos especiais</b> e <b>Extensões soltas</b></td></tr>
              <tr><td><b>Linguagens</b></td>
                  <td><span class="ext-selo filtra">só linguagem</span></td>
                  <td>exclui os formatos especiais — <code>.md</code> <code>.json</code> <code>.txt</code></td></tr>
              <tr><td><b>Mapas</b> · treemap, sunburst</td>
                  <td><span class="ext-selo filtra">sua lista</span></td>
                  <td>a mesma lista, e o arquivo precisa ter ao menos 1 linha</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ─────────── Exceções ─────────── -->
      <!-- Os cartões (um por parte) são gerados por config-arquivos-lidos-excecoes.js
           a partir de EXT_PARTES: acrescentar uma parte é acrescentar um item lá. -->
      <div class="ext-vista hidden" id="ext-vista-excecoes">
        ${nota('arquivos-que-o-programa-le-excecoes.json')}
        <p class="config-cartao-dica exc-intro">
          Cada parte começa numa lista e você só guarda a diferença: o que
          <b class="exc-cor-mais">acrescentou</b> em cima, o que
          <b class="exc-cor-menos">retirou</b> embaixo. O ✕ desfaz a exceção.
        </p>
        <div class="exc-cartoes" id="ext-excecoes"></div>
      </div>

      <!-- ─────────── Quem lê o quê ─────────── -->
      <div class="ext-vista hidden" id="ext-vista-quem">
        <div class="config-cartao" data-config-busca="${BUSCA} busca visual aparencia documentacao usos editor subagentes mcp remover contexto">
          <div class="config-cartao-cabecalho">
            <div class="config-cartao-titulo">
              Cada parte do programa, e o que ela abre <span class="ext-selo-cab">só leitura</span>
            </div>
            <p class="config-cartao-dica">
              Só o Editor olha a pasta raiz. «Contexto sem leitura» não tem liga/desliga
              geral: cada item tem o seu «Mesmo assim, pode ler», em Projeto. O que uma extensão
              lê fica na página dela, em Configurações › Extensões.
            </p>
          </div>
          <table class="ext-tabela ext-tabela--leitores">
            <thead><tr>
              <th style="width:20%">Quem lê</th><th style="width:12%">Pasta</th>
              <th style="width:11%">Nunca ler</th><th style="width:11%">Remover</th>
              <th style="width:20%">Contexto sem leitura</th><th>O que lê</th>
            </tr></thead>
            <tbody id="ext-leitores"></tbody>
          </table>
        </div>
      </div>`,
    acoes: '<button class="btn btn-positive" id="btn-save-extensoes">Salvar arquivos lidos</button>',
  });
})();
