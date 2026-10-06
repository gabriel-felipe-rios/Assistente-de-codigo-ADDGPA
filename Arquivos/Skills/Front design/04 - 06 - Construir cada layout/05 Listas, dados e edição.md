# 05 Listas, dados e edição

Os sete Estilos de coleção, dado e edição: Lista e detalhe, Painel dividido, Editor com inspetor, Tabela densa, Dashboard em grade, Quadro kanban e Linha do tempo. Cada um tem os mesmos quatro subtítulos: *Quando usar*, *Regiões*, *Como se constrói*, *Cuidados*.

## Lista e detalhe

**Quando usar.** Coleção de coisas em que cada uma tem detalhe (ou edição) e a relação lista → detalhe é o centro da tarefa.

**Regiões.** Busca → lista → detalhe.

**Como se constrói.**
- Busca no topo da lista.
- Item selecionado marcado por forma.
- **Selecionar atualiza o detalhe sem trocar de página.** *Porquê: trocar de página perde a posição na lista e transforma cada consulta em ida e volta.*
- Sem seleção, o detalhe convida a escolher um item («Selecione um cliente para ver o histórico»).
- ↑ ↓ percorrem a lista.
- Cada item mostra 2–3 dados que o distinguem, em altura constante.
- Lista longa rola sozinha, sem levar o detalhe junto.
- As ações do item selecionado ficam no cabeçalho do detalhe; na linha, no máximo um atalho discreto (→ `07`). *Porquê: as mesmas ações repetidas em toda linha poluem a lista.*

**Cuidados.** No Celular são **duas telas empilhadas** (lista, depois detalhe com «Voltar»); no tablet, lado a lado.

## Painel dividido

**Quando usar.** Comparar ou trabalhar dois conteúdos lado a lado.

**Regiões.** Duas colunas com divisória arrastável.

**Como se constrói.**
- Divisória arrastável por mouse **e** por teclado (setas). *Porquê: arrastar só com mouse exclui quem navega por teclado.*
- Largura mínima em cada lado.
- Em janela larga, o lado de trabalho (prévia, editor) leva a maior parte; o lado dos controles é a coluna mais estreita (→ `09`).
- Duplo clique na divisória restaura a proporção.
- Nenhum dos dois lados fica escondido atrás de navegação quando a tarefa é compará-los.

**Cuidados.** Em largura estreita, empilha ou vira abas.

## Editor com inspetor

**Quando usar.** Um objeto (documento, imagem, componente) com propriedades editáveis.

**Regiões.** Trilho de ferramentas → área de trabalho → propriedades.

**Como se constrói.**
- As propriedades **mudam conforme a seleção**; nada selecionado mostra as do documento. *Porquê: um inspetor fixo mostra campos que não valem para o que está selecionado.*
- Mudança de propriedade aparece na hora, na área de trabalho.
- A área de trabalho fica com a maior parte da largura; o inspetor é a coluna estreita, e a largura que sobra vai para a área de trabalho, não para um bloco vazio.
- Grupos recolhíveis.
- Desfazer e refazer sempre à mão.
- Ferramentas com atalho de teclado.
- Controles compactos (densidade densa → `09`).

**Cuidados.** Não esconda o inspetor atrás de um clique: a edição é o centro da tela.

## Tabela densa

**Quando usar.** Comparar muitos registros. **Não** use para poucos itens sem comparação (→ lista, `03`).

**Regiões.** Filtros → linhas finas com seleção múltipla → barra de ações do lote.

**Como se constrói.**
- **Primeira coluna congelada.** *Porquê: ao rolar para a direita a linha perde a identidade.*
- Cabeçalho fixo ao rolar.
- Uma coluna principal que identifica a linha.
- 5–8 colunas visíveis; as outras por escolha da pessoa.
- Colunas redimensionáveis.
- Linhas expansíveis para o detalhe.
- Ações por linha discretas: aparecem no hover **e** no foco, e ficam acessíveis por teclado.
- Ordenar clicando no cabeçalho, com seta de direção.
- Números alinhados à direita. *Porquê: só assim as casas decimais alinham e a comparação é visual.*
- Filtros visíveis, com botão **«Limpar filtros»** e contagem de resultados.
- Seleção múltipla com a barra de ações do lote surgindo ao selecionar.
- Paginação ou rolagem contínua conforme o volume.
- Estados vazio, carregando e «filtro sem resultado» tratados (→ `08`).

**Cuidados.** No Celular vira lista de cards ou mantém rolagem horizontal com a primeira coluna fixa.

## Dashboard em grade

**Quando usar.** Acompanhar vários indicadores.

**Regiões.** Barra superior → linha de métricas → grade de cards.

**Como se constrói.**
- **Cabe numa tela de notebook**, com o resumo no topo e o detalhe por aprofundamento. Se saturar, divida em vistas (abas). *Porquê: dashboard que rola vira relatório, e o comparar-de-relance some.*
- Cada card responde **uma pergunta** e tem título e período.
- Período e filtros globais **uma vez só**, no topo.
- Cada card tem os próprios estados: falha de um não derruba os outros. *Porquê: uma consulta lenta não pode apagar a tela inteira.*
- A definição de cada métrica a um clique.
- Alturas iguais por linha da grade.
- Clicar num card leva ao detalhe (gaveta ou tela) sem perder o filtro.

**Cuidados.** Card sem pergunta é decoração (→ `03`, `13`).

## Quadro kanban

**Quando usar.** Itens que passam por estados bem definidos e mudam de estado com frequência.

**Regiões.** Filtros → colunas com cards arrastáveis, com rolagem horizontal.

**Como se constrói.**
- Cada coluna é um estado, com a contagem no título («Em revisão · 7»).
- O card mostra título e 2–3 atributos.
- Arrastar entre colunas **e** uma alternativa sem arrastar: menu «Mover para…» ou teclado. *Porquê: arrastar exige mouse e precisão; sem alternativa, o quadro é inacessível no toque e no teclado.*
- Coluna vazia mostra a área de soltar.
- Cada coluna rola verticalmente sozinha.
- Criar item direto na coluna.
- Clique abre o detalhe em gaveta.

**Cuidados.** Se o item não muda de estado com frequência, uma Tabela densa com coluna de estado serve melhor.

## Linha do tempo

**Quando usar.** Eventos ao longo do tempo que se leem em ordem.

**Regiões.** Fio vertical central, eventos por data.

**Como se constrói.**
- Agrupar por dia ou mês, com o rótulo da data visível.
- O mais recente primeiro, salvo pedido em contrário.
- Cada evento com hora, título e um resumo; evento longo expande.
- Carrega mais ao chegar ao fim, **dizendo que carregou**. *Porquê: lista que cresce sozinha sem aviso desorienta quem estava lendo.*

**Cuidados.** No Celular o fio vai para a esquerda e tudo numa coluna.

## Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| o detalhe abre em outra página e a lista perde a posição | Lista e detalhe tratada como duas páginas | atualize o detalhe no lugar |
| tabela sem «Limpar filtros» | pessoa presa num resultado vazio | botão e contagem de resultados |
| kanban só arrasta com mouse | sem alternativa | «Mover para…» e teclado |
| dashboard que rola por três telas | tudo no mesmo nível | resumo no topo, detalhe por aprofundamento |
| ao rolar a tabela para a direita as linhas ficam sem nome | primeira coluna não congelada | congele a coluna principal |
| falha numa consulta apaga o dashboard inteiro | estado só global | cada card com os seus estados |
