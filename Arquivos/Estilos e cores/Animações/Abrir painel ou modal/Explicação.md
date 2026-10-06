# Abrir painel ou modal — onde este movimento se aplica

Vale para tudo o que **aparece por cima** do que já estava na tela e some depois:
modal, gaveta lateral, painel flutuante, menu suspenso, popover, barra de comando.

## Aplica-se a

- diálogos de confirmação e formulários em modal;
- gavetas que entram pela borda;
- menus suspensos e seletores.

## Não se aplica a

- troca de aba ou de página — isso é **Trocar de aba**;
- avisos que aparecem sozinhos, sem o usuário pedir — isso é **Notificação**;
- expandir uma seção que já estava na página (acordeão), que muda altura no fluxo
  e não sobrepõe nada.

## Regra que vale para as três opções

O véu de fundo entra **sempre junto** com o painel, na mesma duração, e nunca
depois. O fechamento usa a mesma curva do abrir, com duração igual ou menor —
fechar devagar irrita. E **nada de fundo animado**: o conteúdo por baixo fica
parado, sem desfoque que entra ou sai.
