# Notificação — onde este movimento se aplica

Vale para o aviso que **o sistema dá sem o usuário pedir**, ou logo depois de uma
ação, longe do elemento que a originou: salvo com sucesso, falha ao enviar,
conexão perdida, item removido com "desfazer".

## Aplica-se a

- avisos temporários no canto da tela;
- barras de estado fixas no topo;
- confirmação de ação concluída.

## Não se aplica a

- erro dentro de um campo de formulário — isso é **Digitar e validar**;
- modal de confirmação que o usuário abriu — isso é **Abrir painel ou modal**;
- indicador de carregamento, que é estado contínuo e não um aviso.

## Regra que vale para as duas opções

Aviso de **erro nunca some sozinho** — só sai quando o usuário fecha, porque
erro que desaparece é erro que ninguém leu. Aviso de sucesso pode sumir, nunca
antes de 4 segundos. E notificação **nunca** empurra o conteúdo da página: ela
flutua por cima ou tem espaço reservado.
