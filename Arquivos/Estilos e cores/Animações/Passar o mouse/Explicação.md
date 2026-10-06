# Passar o mouse — onde este movimento se aplica

Vale para o **estado de hover** de qualquer elemento clicável: botão, item de
lista, linha de tabela, card, aba, link.

## Aplica-se a

- tudo o que responde a clique e precisa avisar que responde.

## Não se aplica a

- o estado **ativo/selecionado**, que é permanente e não é animação;
- o estado de **foco por teclado**, que precisa de contorno visível e imediato,
  sem esperar transição;
- texto e ícones que não são clicáveis — hover em coisa inerte mente ao usuário.

## Regra que vale para as três opções

O hover **nunca** muda o tamanho da caixa do elemento: nada de crescer largura,
altura, padding ou borda de 1 px para 2 px, porque isso empurra os vizinhos e a
lista inteira treme. Cresça com `transform`, não com `width`/`padding`.
E o hover **nunca** substitui o foco por teclado.
