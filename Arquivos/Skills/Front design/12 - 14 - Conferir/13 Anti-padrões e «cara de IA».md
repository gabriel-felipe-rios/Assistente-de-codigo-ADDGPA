# 13 Anti-padrões e «cara de IA»

## O que é e quando abrir

Ao terminar a tela, antes do checklist (→ `14`), para cortar o que denuncia tela gerada por hábito. Cada linha diz o que não fazer, o porquê em uma linha e o que fazer no lugar.

## Cara de IA

Os vícios que denunciam tela gerada.

| Não faça | Por quê | Faça assim |
|---|---|---|
| grade de **cards iguais** para tudo (kit de SaaS) | esconde a diferença entre itens | tabela quando o dado se compara, lista quando é só título |
| **rótulo pequeno em caixa alta** acima de todo título | enfeite repetido que não informa | tire; rótulo só quando o conteúdo não se explica |
| **gradiente decorativo** de fundo ou de botão | decora sem dizer nada e reduz o contraste | superfície plana |
| **«→»** em todo botão | seta por hábito perde o sentido | seta só onde indica direção real |
| **ícone dentro de círculo colorido** em cada card | ornamento que compete com o dado | ícone só se ajuda a reconhecer, sem moldura |
| **emoji** em título de seção | infantiliza e não informa | título em texto |
| **sombra e canto bem arredondado** em tudo | tudo parece flutuar e nada se destaca | sombra só onde algo realmente sobe (menu, diálogo) |
| métricas inventadas com variação «+12%» só para enfeitar | número falso confunde | métrica real, com rótulo e período, ou nenhuma |
| textos de encher linguiça («Bem-vindo de volta!», «Transforme seu fluxo de trabalho») | ocupam o lugar do que a pessoa veio ver | vá direto ao conteúdo |
| **tudo centralizado**, inclusive onde se lê em coluna (também vale para o título e o texto de apoio) | texto centralizado cansa, desalinha e dificulta achar o começo da linha | alinhe à esquerda o que se lê |
| bloco de três «vantagens» com ícone em ferramenta que ninguém precisa que se venda | é peça de site dentro de uma ferramenta | remova |
| dado de exemplo redondo demais (1234, «João da Silva» em toda linha) | esconde os casos reais de largura e formato | dado plausível e variado |
| crachás (badges) em todo canto | perdem o poder de chamar atenção | só onde o estado importa |
| ilustração enorme no estado vazio | empurra a ação para baixo | frase curta e o botão que cria (→ `07`) |
| barra de progresso decorativa | mente sobre um progresso que não existe | só para progresso real (→ `08`) |

## Anti-padrões de estrutura

| Não faça | Por quê | Faça assim |
|---|---|---|
| sidebar dentro de sidebar dentro de sidebar | cada nível é outra navegação para aprender | trilho + painel, dois níveis no máximo (→ `04`) |
| excesso de abas | destrói a memória espacial | Abas verticais (→ `02`) |
| modal sobre modal | a pessoa perde qual decisão está tomando | página, gaveta ou Assistente em passos (→ `07`) |
| card dentro de card sem necessidade | moldura sobre moldura sem hierarquia real | um nível de contêiner |
| várias ações primárias competindo | ninguém sabe o que é o principal | uma primária por região (→ `07`) |
| dashboard com gráficos sem função | decoração com jeito de análise | só o que responde uma pergunta (→ `03`) |
| informação importante só em tooltip | não existe no toque e passa despercebida | traga para a tela (→ `03`) |
| tabela de 20 colunas sem hierarquia | tudo com o mesmo peso | coluna principal, 5–8 visíveis (→ `05`) |
| ícones sem significado claro | a pessoa adivinha | rótulo, ou ícone universal com rótulo acessível |
| coluna ou faixa vazia ao lado do conteúdo | a largura que sobrou não foi usada | mostre mais: prévia maior, painéis lado a lado (→ `09`) |
| blocos do mesmo papel de tamanhos diferentes | tamanho veio do conteúdo | mesma largura e altura por linha (→ `09`) |
| botão de ação numa linha própria, longe do objeto | controle solto | encostado no objeto, ou ao lado se falta altura (→ `07`) |
| a mesma prévia repetida por variação | cópia em vez de seletor | uma prévia + seletor; lado a lado só para comparar |
| as mesmas ações repetidas em toda linha da lista | ação de item copiada por item | ações no cabeçalho do detalhe (→ `07`) |
| ferramenta que rola a página inteira por pilha vertical de blocos | altura não orçada | cabe na janela; rolam só as regiões internas (→ `09`) |

## Decoração que compete com o dado

- Excesso de borda, de sombra e de cor.
- Ornamento perto de número ou tabela.
- Fundo com padrão atrás de texto.
- Animação em elementos que a pessoa não usa.

**Regra:** se tirar o elemento não muda o que a pessoa entende, tire (→ `09`).

## Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| a IA repete a mesma grade de cards em todas as telas | estrutura escolhida pelo hábito | refaça pelo `02` |
| título com rótulo em caixa alta por cima | enfeite | some |
| botão «Continuar →» em toda tela | seta por hábito | só onde a seta indica direção real |
