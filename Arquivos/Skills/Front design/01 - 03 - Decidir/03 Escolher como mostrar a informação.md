# 03 Escolher como mostrar a informação

## O que é e quando abrir

Quando a tela tem dado a exibir e você precisa escolher a forma dele. Regra-mãe: **a forma nasce da pergunta que a pessoa quer responder**, não do que «fica bonito».

*Porquê: forma escolhida pela aparência esconde a resposta — a pessoa olha um gráfico bonito e ainda não sabe se o número subiu.*

## Pergunta → forma

| A pessoa quer saber… | Forma | Detalhe |
|---|---|---|
| «quanto temos?» | **métrica** | um número grande, rótulo, comparação com o período anterior |
| «como se distribui?» | **gráfico de barras** | partes de um todo só em pizza se forem 5 ou menos |
| «como evoluiu no tempo?» | **gráfico de linha** | eixo do tempo na horizontal, unidade legível |
| «qual item tem qual valor?» | **tabela** | ordenável; coluna principal à esquerda |
| «em que estado está cada item?» | **Quadro kanban** | uma coluna por estado, contagem no título |
| «o que aconteceu e quando?» | **Linha do tempo** | agrupada por dia, o mais recente primeiro |
| «que relação de hierarquia existe?» | **árvore** | recolhível; mostra o caminho até o item |
| «preciso editar muitas células rápido» | **planilha** | edição no lugar, teclado para navegar |
| «quero achar e abrir um item» | **lista com busca** | 2–3 dados por item, altura constante |
| «o que acontece em cada dia?» | **calendário** | mês e semana; dia com evento marcado por forma |
| «comparar A com B» | **tabela** com colunas lado a lado, ou dois gráficos na mesma escala, lado a lado | mesma escala, senão a comparação mente |

## Card, tabela ou lista

- **Tabela** quando a relação entre os dados é o ponto — comparar, ordenar, filtrar. *Porquê: em card, os olhos precisam saltar de caixa em caixa para comparar o mesmo campo.*
- **Card** só quando cada item é heterogêneo ou tem parte visual (imagem, miniatura) e não será comparado linha a linha. *Porquê: card dá identidade a cada item, e comparar exige o contrário.*
- **Lista** quando o item se resume a um título e um ou dois dados. *Porquê: é a forma mais barata de escanear; card ou tabela aqui só põe moldura.*
- **Nunca card dentro de card** sem necessidade. *Porquê: cada moldura extra come espaço e cria uma hierarquia que o conteúdo não tem.*

## Gráfico e métrica

- Gráfico só existe se **responde uma pergunta**. Sem pergunta, é enfeite.
- O título diz a conclusão ou o assunto («Pedidos por semana, últimas 12»), nunca «Gráfico 1».
- Eixos e unidades legíveis; nunca depender só de cor para distinguir séries (→ `09`).
- Métrica sempre com **rótulo e período**: «Receita · março: R$ 48.200».
- Um dashboard cabe numa tela e detalha por aprofundamento (→ `05`).

*Porquê: número sem rótulo e período não é informação, é um enigma.*

## Onde a informação importante mora

- **Visível na tela.** Nunca só em tooltip: tooltip é reforço, não o único lugar.
- Estado e erro ficam **junto do objeto** a que pertencem, não num aviso distante.

*Porquê: tooltip não existe no toque, exige hover e passa despercebido; erro longe do campo obriga a pessoa a procurar.*

## Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| gráfico decorativo, sem pergunta por trás | forma escolhida por estética | gráfico só com pergunta |
| tabela com 20 colunas sem hierarquia | tudo tratado como igualmente importante | coluna principal, 5–8 colunas visíveis e o resto por escolha da pessoa |
| pizza com 9 fatias | forma errada para a pergunta | barras |
| a única explicação do número está num tooltip | informação importante escondida | traga para a tela |
| dois gráficos lado a lado com escalas diferentes | comparação sem mesma régua | mesma escala, ou não compare |
