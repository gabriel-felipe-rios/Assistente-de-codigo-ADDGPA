# Digitar e validar — onde este movimento se aplica

Vale para o que acontece **dentro de um campo de formulário**: ganhar foco,
receber texto, passar ou não na validação.

## Aplica-se a

- campos de texto, número, data, senha;
- seletores e áreas de texto;
- a mensagem de erro que nasce colada no campo.

## Não se aplica a

- o botão de enviar, que é hover/clique comum;
- o aviso de "salvo com sucesso" que aparece longe do campo — isso é **Notificação**;
- validação do formulário inteiro: mesmo aí, quem se mexe é cada campo, um a um.

## Regra que vale para as três opções

A validação **nunca** empurra o layout: o espaço da mensagem de erro é reservado
antes, mesmo vazio, senão o formulário salta a cada tecla. E cor **nunca** é o
único sinal de erro — sempre acompanhada de texto, por quem não distingue as
duas cores.
