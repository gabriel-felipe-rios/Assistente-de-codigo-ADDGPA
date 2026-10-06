// ══════════════════════════════ Configurações → Arquivos (markup) ══
// Como o programa reconhece o PRINCIPAL de uma skill — o `.md` que vira
// `SKILL.md` na cópia para o projeto. Era regra fixa no código (pelo
// `description:` do cabeçalho) e virou escolha do usuário em 2026-09-21:
// "depende da pessoa que for mexer". Comportamento em `config-biblioteca.js`.
//
// ⚠️ SÓ DE SKILLS, de propósito. As outras categorias têm forma fixa (comando é
// arquivo solto, regra tem o nome da pasta, agente e instrução base são o
// próprio arquivo) — uma pílula para elas seria campo que não faz nada. Decisão
// da discussão "Pendências da reforma dos comandos e skills" (D4, P2).
//
// 🔴 A `chave` É `biblioteca`, e o rótulo é "Arquivos". Não é descuido:
// `arquivos` é a chave de "Assistentes externos" (que ERA "Arquivos" até
// 2026-09-02) em `_CONFIG_REPINTORES`, em `_PADROES_POR_CATEGORIA` e no
// trilho — três lugares, zero verificação. Reaproveitá-la apagaria aquela
// categoria sem um erro sequer.
//
// ⚠️ A posição da tag <script> deste arquivo no index.html é a posição da
// categoria no trilho: logo abaixo de "Assistentes externos", que é a vizinha
// de assunto (ela diz PARA ONDE a biblioteca vai; esta diz COMO se lê).
//
// Glifo monocromático, nunca emoji, como as outras: `▥` — uma pasta com
// divisões, o que a biblioteca é.
(function () {
  if (typeof registrarCategoriaConfig !== 'function') return;

  // Os valores espelham `PADROES_DA_BIBLIOTECA` em `padroes_de_fabrica.py`.
  // Uma opção nova entra aqui E lá — a tela não inventa valor.
  const opcao = (nome, valor, titulo, desc, extra = '') => `
        <label class="config-opcao">
          <input type="radio" name="${nome}" value="${valor}" />
          <span class="config-opcao-marca"></span>
          <span class="config-opcao-corpo">
            <span class="config-opcao-titulo">${titulo}</span>
            <span class="config-opcao-desc">${desc}</span>${extra}
          </span>
        </label>`;

  registrarCategoriaConfig({
    chave: 'biblioteca',
    rotulo: 'Arquivos',
    icone: '▥',
    resumo: 'como o programa reconhece os itens da biblioteca',
    conteudo: `
      <div class="config-cartao" data-config-busca="skill principal SKILL.md description nome da pasta arquivo fixo biblioteca">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Qual arquivo é o principal da skill</div>
          <p class="config-cartao-dica">Uma skill é uma pasta com vários <code>.md</code>. O
             principal é o que vira <code>SKILL.md</code> na cópia para o projeto; os outros
             vão junto como apoio, com o nome que têm.</p>
        </div>
        <div class="config-opcoes" id="cfb-principal">
${opcao('cfb-principal', 'nome-da-pasta',
        'O <code>.md</code> com o mesmo nome da pasta <span class="config-opcao-padrao">padrão</span>',
        'A regra fica visível na árvore. Acento, maiúscula e hífen no lugar de espaço não contam. Os outros arquivos podem ter cabeçalho.',
        `<span class="config-opcao-arvore">Padrões de interface/
├── <b>padroes-de-interface.md</b>
└── configuracao-inicial.md</span>`)}
${opcao('cfb-principal', 'nome-fixo',
        'Um arquivo com nome fixo',
        'O mesmo nome em toda skill, seja qual for a pasta.',
        `<span class="config-opcao-campo"><label for="cfb-nome-fixo">Nome do arquivo</label>
              <input type="text" id="cfb-nome-fixo" spellcheck="false" autocomplete="off" /></span>
            <span class="config-opcao-arvore">Padrões de interface/
├── <b>SKILL.md</b>
└── configuracao-inicial.md</span>`)}
${opcao('cfb-principal', 'description',
        'O que tem <code>description:</code> no cabeçalho',
        'Só um arquivo da pasta pode ter o campo. Se dois tiverem, empata.',
        `<span class="config-opcao-arvore">Padrões de interface/
├── <b>padroes-de-interface.md</b>   ← description: …
└── configuracao-inicial.md</span>`)}
        </div>
        <p class="config-nota">Pasta com um <code>.md</code> só: é ele, em qualquer regra.</p>
      </div>

      <div class="config-cartao" data-config-busca="empate recusar avisar primeiro ordem alfabética">
        <div class="config-cartao-cabecalho">
          <div class="config-cartao-titulo">Quando nenhum arquivo bate — ou mais de um</div>
          <p class="config-cartao-dica">O que a cópia faz com uma pasta que a regra não resolve.</p>
        </div>
        <div class="config-opcoes" id="cfb-empate">
${opcao('cfb-empate', 'recusar',
        'Não copiar e avisar <span class="config-opcao-padrao">padrão</span>',
        'O item fica desligado e a aba Arquivos diz qual pasta precisa de ajuste.')}
${opcao('cfb-empate', 'primeiro',
        'Usar o primeiro em ordem alfabética',
        'Copia sempre. O principal pode ser o arquivo errado.')}
        </div>
      </div>`,
    acoes: '<button class="btn btn-positive" id="btn-save-biblioteca">Salvar</button>',
  });
})();
