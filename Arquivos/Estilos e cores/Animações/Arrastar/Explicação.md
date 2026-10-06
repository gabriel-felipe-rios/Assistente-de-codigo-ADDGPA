# Arrastar — onde este movimento se aplica

Vale para o que o usuário **pega e leva**: card entre colunas de um quadro, item
reordenado numa lista, arquivo solto numa área, divisória de painel puxada.

## Aplica-se a

- reordenar listas e mover cards entre colunas;
- redimensionar painéis pela divisória;
- soltar arquivo numa área de destino.

## Não se aplica a

- rolagem da página ou de um painel;
- deslizar de painel na troca de aba — isso é **Trocar de aba**;
- gaveta que entra pela borda sozinha — isso é **Abrir painel ou modal**.

## Regra que vale para as três opções

Enquanto algo está sendo arrastado, o **destino** precisa se anunciar: um vão
aberto, uma borda acesa, uma sombra no lugar de chegada. Arrastar sem destino
visível é a forma mais fácil de o usuário soltar no lugar errado. O elemento
arrastado **nunca** fica invisível — ele segue o cursor, com opacidade no
mínimo 0.8.
