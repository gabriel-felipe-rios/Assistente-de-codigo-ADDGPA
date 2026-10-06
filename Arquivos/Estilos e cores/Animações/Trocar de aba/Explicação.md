# Trocar de aba — onde este movimento se aplica

Vale **só** para a troca do painel inteiro quando o usuário escolhe outra aba,
sub-aba ou item de navegação lateral: o conteúdo velho sai, o novo entra.

## Aplica-se a

- abas do topo e sub-abas;
- itens de menu lateral que trocam a área principal;
- passos de um assistente (a mesma troca, em ordem).

## Não se aplica a

- abrir modal, painel flutuante ou menu suspenso — isso é **Abrir painel ou modal**;
- item de lista que só fica selecionado sem trocar a área;
- qualquer elemento *dentro* do painel: quem anima é o painel, uma vez, e nada mais.

## Regra que vale para as três opções

A barra de abas **nunca** se move, some ou pisca — só o indicador da aba ativa
muda de posição. Trocar de aba não pode empurrar o layout: a área do painel
mantém a mesma caixa antes e depois.
