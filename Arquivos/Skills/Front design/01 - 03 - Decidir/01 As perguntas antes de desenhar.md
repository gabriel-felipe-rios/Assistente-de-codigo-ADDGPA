# 01 As perguntas antes de desenhar

## O que é e quando abrir

Sempre, antes de qualquer tela nova. Você se faz as perguntas **internamente**; o plano que sai delas é seu — nunca é mostrado para aprovação nem vira pedido de confirmação. Se o usuário perguntar «como vai ficar?», aí sim descreva.

*Porquê: quem pede uma tela quer a tela. Devolver perguntas ou um plano para «ok» transfere para ele o trabalho de decidir — justamente o que esta skill existe para tirar dele.*

## Os oito eixos

| Eixo | O que você descobre | Como isso muda a tela |
|---|---|---|
| **Tipo de produto** | qual dos sete tipos é (→ `02`) | define o Estilo de partida e a densidade |
| **Tarefa principal** | o que a pessoa vem fazer aqui | a estrutura reflete isso, não a estética |
| **Volume de informação** | poucos itens ou milhares | poucos → lista; muitos → tabela, busca, paginação |
| **Relação entre as coisas** | é uma coleção com detalhe? hierarquia? estados de fluxo? | coleção com detalhe → Lista e detalhe; hierarquia → árvore; estados → Quadro kanban |
| **Frequência de navegação** | quantas vezes por sessão a pessoa troca de área | quanto mais frequente, mais barato o acesso: à vista, um clique |
| **Necessidade de comparar** | ela precisa ver dois itens ou valores ao mesmo tempo? | comparar pede ver os dois juntos: Tabela densa, Painel dividido |
| **Edição simultânea** | ela altera vários itens de uma vez? | pede seleção múltipla e ações em lote |
| **Trabalho espacial** | ela arrasta, posiciona, dá zoom? | Canvas infinito ou Editor com inspetor |

## Quando falta informação

| Faltou… | Você faz |
|---|---|
| plataforma | Computador |
| ferramenta ou site | ferramenta |
| tipo de produto | ferramenta com painéis (→ `02`) |
| volume de dados | assume volume médio e desenha também o estado vazio e o estado com muito dado (→ `08`) |
| densidade | a do tipo de produto (→ `09`) |
| paleta | papéis de cor em escala neutra (→ `11`) |
| nomes e textos | escreve textos plausíveis do assunto, com nomes, valores e datas reais de mentira (frases → `07`) |
| qual Estilo | o que o `02` indicar |

Em todos os casos: siga o padrão e **registre na linha final** (→ `front-design.md` §6). **Nunca devolva lista de perguntas.**

*Porquê: o usuário já disse o que quis dizer. O que ficou de fora é justamente o que ele espera que o padrão resolva — e ele corrige pela linha final se discordar.*

## O plano é interno

Antes de construir, resolva na cabeça:

1. plataforma e natureza (ferramenta ou site);
2. o Estilo principal;
3. como cada informação aparece;
4. os estados a desenhar.

Depois construa. Não escreva «Plano:» para o usuário aprovar e não termine com «posso prosseguir?».

## Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| a IA devolve cinco perguntas antes de começar | tratou o pedido curto como incompleto | decida pelo padrão e conte na linha final |
| a IA escreve um plano e espera «ok» | confundiu planejar com pedir aprovação | o plano é interno |
| tela genérica de «painel com cards» para tudo | pulou o eixo *tarefa principal* | responda os oito eixos antes de abrir o `02` |
| tela sem estado vazio, com 40 registros de teste | assumiu o volume sem pensar no zero | volume assumido é médio, e o estado vazio também se desenha |
