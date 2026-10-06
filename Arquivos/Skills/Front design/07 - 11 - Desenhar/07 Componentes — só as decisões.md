# 07 Componentes — só as decisões

## O que é e quando abrir

Ao usar botão, formulário, diálogo, gaveta, filtro ou barra de ferramentas. Este arquivo trata de **quando** usar cada um e **o que ele diz** — não de como desenhá-lo. Tabelas e listas já têm arquivo (→ `05`) e não se repetem aqui.

## Botões

- **Uma ação primária por região.** *Porquê: várias primárias competem e a pessoa não sabe qual é a principal.*
- A secundária tem peso menor que a primária.
- **Ação destrutiva** usa o papel de cor negativa, fica separada das ações seguras e **nunca é a primária por padrão**. *Porquê: um Enter distraído não pode apagar nada.*
- Botão só de ícone apenas quando o ícone é universal (fechar, buscar); sempre com rótulo acessível e tooltip.
- Mais de 3 ações: as principais ficam visíveis e o resto vai para um menu «Mais».
- **Desabilitado explica o porquê** (texto perto, ou tooltip que também abre por teclado) e não some. *Porquê: botão apagado sem motivo parece defeito.*
- Durante a ação, o próprio botão mostra progresso e ignora o segundo clique. *Porquê: sem isso o clique duplo cria dois pedidos.*
- **A ação fica junto do objeto que ela afeta:** o botão de uma prévia, imagem ou item fica no mesmo contêiner e encostado nele — abaixo, alinhado à largura dele; ao lado; ou sobre ele, no canto. Escolha pela sobra: sobra largura e falta altura → ao lado. Nunca numa linha própria solta, longe. *Porquê: longe do objeto, a pessoa não vê o controle, e a linha extra rouba altura da prévia.*
- **Controle igual repetido por item vira um só**, ligado ao item ativo (uma prévia + um botão, não uma prévia com botão para cada variação).
- **Ações do item selecionado** ficam no cabeçalho do detalhe; na linha da lista fica no máximo um atalho discreto. Até 2 ações: botões ou ícones discretos; 3 ou mais: menu «Mais». Se a ação só aparece no hover, aparece **também no foco e na seleção**. *Porquê: repetir «Renomear» e «Excluir» em toda linha polui a lista, e o que só existe no hover some para quem usa teclado ou toque.*

## Formulários

- **Rótulo sempre visível.** O placeholder não substitui o rótulo: some ao digitar. *Porquê: quem volta ao campo preenchido não sabe mais o que ele pedia.*
- **Erro junto do campo**, dizendo o que houve e como corrigir.
- **Validar ao sair do campo** — nem a cada tecla (grita antes da hora), nem só ao enviar (descobre tudo tarde).
- Obrigatório **ou** opcional marcado — um dos dois, sem misturar. *Porquê: marcar os dois obriga a pessoa a decodificar a regra.*
- Uma coluna por padrão; campos relacionados agrupados.
- O tipo certo de campo: data, número, seleção, alternância.
- Valor padrão sensato.
- Ao enviar com erro, o foco vai ao primeiro campo com problema.
- **Nunca apague o que a pessoa digitou** por causa de um erro. *Porquê: refazer um formulário longo é o motivo número um de abandono.*

## Diálogos e gavetas

- **Modal** só para uma decisão curta que precisa bloquear a tela.
- **Fluxo complexo nunca em modal**: use página, gaveta ou Assistente em passos (→ `06`).
- **Nunca modal sobre modal.** *Porquê: a pessoa perde a noção de qual decisão está tomando e o Esc fica ambíguo.*
- **Gaveta lateral** para ver ou editar detalhe sem perder o contexto da lista.
- Ao abrir, o foco entra no diálogo e fica preso nele; Esc fecha; ao fechar, o foco volta ao gatilho.
- O título diz o assunto («Editar cliente», não «Atenção»).
- Fechar com alteração não salva é um dos poucos casos legítimos de confirmação (→ `08`).

## Filtros

- Ficam visíveis acima do resultado.
- O que está ativo aparece (chips com ×). *Porquê: filtro invisível explica «cadê meus itens?».*
- Contagem de resultados.
- Botão «Limpar filtros».
- A busca é separada dos filtros.
- Filtros combinam com «e» por padrão.

## Barras de ferramentas

- Agrupadas por assunto.
- Ações frequentes visíveis, raras em menu.
- **Uma só** ação destacada.
- Ícones com rótulo acessível.
- A barra contextual muda com a seleção.

## As frases da interface

Só **frases**: nomes e termos ficam fora deste arquivo.

| Regra | Bom | Ruim |
|---|---|---|
| **O botão diz o que vai acontecer** | «Salvar alterações», «Excluir 3 arquivos» | «OK», «Enviar», «Sim» |
| **O erro diz o que houve e como corrigir** | «A data precisa ser depois de hoje. Escolha outra.» | «Valor inválido» |
| **A tela vazia convida a agir** | «Nenhum projeto ainda. Crie o primeiro.» + o botão que cria | «Sem dados» |
| **Sucesso curto e no passado** | «Alterações salvas» | «A operação foi concluída com sucesso!» |
| **Sem culpar quem usa** | «Não encontramos esse arquivo» | «Você digitou errado» |

Frase curta, na ordem em que a pessoa lê. *Porquê: a interface é lida de relance; quem precisa reler já errou o clique.*

## Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| botão «OK» num diálogo de exclusão | frase sem ação | o botão nomeia a ação |
| erro genérico «Algo deu errado» | causa não dita | diga o que houve e como corrigir |
| o formulário zera ao errar | estado descartado | preserve o digitado |
| duas ações primárias lado a lado | ninguém escolheu a principal | uma primária por região |
| «Reproduzir» numa linha própria abaixo da prévia, distante dela | controle solto do objeto | encostado no objeto, ou ao lado se falta altura |
| «Renomear» e «Excluir» repetidos em toda linha da lista | ação de item copiada por item | ações no cabeçalho do detalhe; atalho discreto na linha |
| modal com cinco passos dentro | fluxo complexo em modal | Assistente em passos ou página |
