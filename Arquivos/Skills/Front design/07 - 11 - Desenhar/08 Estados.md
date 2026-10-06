# 08 Estados

## O que é e quando abrir

Ao desenhar qualquer tela com dado, formulário ou ação. **Estado** é tudo o que a tela mostra além de «dados carregados e sucesso»; a interface real passa boa parte do tempo fora desse caminho. Desenhe os estados **junto** com o estado normal, nunca depois.

*Porquê: estado desenhado depois vira remendo — um aviso solto, uma lista em branco.*

## Os estados da tela

| Estado | O que a tela mostra | O que não fazer |
|---|---|---|
| **Primeiro uso** | orienta o primeiro passo em uma frase e um botão | tour longo antes de a pessoa fazer qualquer coisa |
| **Vazio** | convida a agir (→ `07`) | área em branco, «Sem dados» |
| **Filtro ou busca sem resultado** | diz qual filtro está ativo e oferece «Limpar filtros» | repetir a tela de vazio como se nunca houvesse dados |
| **Carregando** | esqueleto com a forma do conteúdo; indicador simples para ação curta; passou de 1 segundo, indicador visível; passou de uns 10, progresso e opção de cancelar | spinner eterno, tela em branco |
| **Parcial** | mostra o que chegou, marca o que falta, oferece tentar de novo | esconder tudo porque uma parte falhou |
| **Erro** | o que houve, como corrigir, botão de tentar de novo; preserva o que a pessoa fez; erro de um bloco não derruba a tela | «Algo deu errado» |
| **Offline** | avisa que está sem conexão e o que continua funcionando; o que foi feito fica na fila | deixar a pessoa clicar sem retorno |
| **Salvando e salvo** | indicador discreto: «Salvando…» e depois «Salvo às 14:32» | modal de «Salvo com sucesso!» |
| **Desabilitado** | explica o porquê | controle apagado sem motivo |
| **Sem permissão** | diz que não há acesso e a quem pedir | sumir em silêncio |
| **Não encontrado** | diz o que não foi achado e para onde ir | página em branco |

## Os estados de cada componente

Normal, hover, foco visível, pressionado, selecionado, desabilitado. A tela mostra **pelo menos** um item em hover ou selecionado, um botão desabilitado e, se houver lista, o que ela mostra vazia. O foco é visível para quem usa teclado.

*Porquê: um componente sem estados parece tela estática e esconde o que ele faz quando a pessoa interage.*

## Resposta rápida

Todo clique tem retorno visível em cerca de **100 ms** — o botão muda, o item aparece, algo responde. Ação reversível é feita na hora e o servidor confirma depois; ação que passa de 1 s mostra indicador.

*Porquê: sem retorno a pessoa clica de novo e duplica a ação.*

## Desfazer em vez de «tem certeza?»

- Ação **reversível** executa na hora e mostra um aviso com **«Desfazer»** por alguns segundos (de 5 a 10).
- Confirmação só para o que **não volta**: exclusão definitiva, envio para fora, perda de alteração. Aí o diálogo **nomeia o que será perdido** e o botão diz a ação («Excluir 3 arquivos»), nunca «Sim/Não».

*Porquê: «tem certeza?» vira clique automático e não protege ninguém; desfazer protege de verdade e não interrompe.*

## Avançado escondido até precisar

A tela abre com o caminho comum; opções raras ficam atrás de «Avançado» ou de um expansor. Nunca esconda o que a tarefa comum precisa.

*Porquê: cada campo a mais é ruído para quem só quer o caminho comum.*

## Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| lista vazia em branco | estado vazio não desenhado | mensagem que convida a agir |
| spinner eterno | sem limite nem cancelar | indicador com tempo e cancelar |
| «Tem certeza?» em toda exclusão | confirmação em ação reversível | desfazer |
| a tela some inteira porque um bloco falhou | erro global em vez de por bloco | erro de um bloco não derruba a tela |
| a pessoa clica duas vezes e cria dois registros | sem retorno em 100 ms | retorno imediato e botão que ignora o segundo clique |
