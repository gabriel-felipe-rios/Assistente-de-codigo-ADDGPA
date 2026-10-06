# 09 Hierarquia, espaço, densidade e legibilidade

## O que é e quando abrir

Em toda tela. Aqui não há regra estética arbitrária: as regras raciocinam («mais espaço entre grupos diferentes, menos dentro do mesmo grupo»).

## Hierarquia

- Por **tamanho e peso juntos**.
- Um foco por região.
- Título, subtítulo e corpo distintos.
- O secundário usa o papel de cor «texto secundário» — o papel, nunca uma cor escolhida (→ `11`).

*Porquê: se tudo grita, nada é lido.*

## Espaço e alinhamento

- Escala em múltiplos de **4 px**: 4, 8, 12, 16, 24, 32, 48, 64.
- Entre grupos diferentes o espaço é pelo menos o **dobro** do espaço dentro do grupo. *Porquê: é o espaço que diz à pessoa o que pertence a quê.*
- Texto à esquerda; **números à direita**, com o mesmo número de casas.
- Bordas alinhadas numa grade — nada «quase alinhado». *Porquê: o quase alinhado parece erro mesmo quando ninguém sabe apontar onde.*

## Ocupar o espaço e manter os irmãos iguais

Números desta seção são **sinais para olhar**, não limites: quem os aplica às cegas erra as telas em que o caso é outro.

**Largura que sobra**

- **Vazio grande e sem função ao lado de conteúdo é falha.** Em ferramenta, a largura que sobra serve para **mostrar mais coisas ao mesmo tempo** — prévia maior, painéis e colunas lado a lado — e não para esticar os mesmos elementos. *Porquê: a tela real é larga (referência: Full HD, → `10`), e um bloco em branco ao lado do trabalho é área que poderia estar servindo à tarefa.*
- «Mais coisas» é o que a tarefa usa **junto**; não empilhe tudo de uma vez só porque cabe.
- **Vazio só quando deliberado:** margem proporcional, respiro entre grupos, coluna de leitura contida em 60–80 caracteres. Texto de leitura não se estica para preencher.
- **Nunca cresça fonte, controle ou alvo de clique para preencher espaço**: as faixas deste arquivo valem em qualquer largura. *Porquê: controle inflado parece descuido, e o preenchimento útil é conteúdo.*
- **Prévia ao vivo:** os controles ficam numa coluna mais estreita e a prévia na área maior (uns ⅓ para controles e ⅔ para a prévia, como orientação).

**Altura**

- Em ferramenta, a tela de trabalho **cabe na altura da janela** (em Full HD sobram uns 950 px úteis depois da barra do navegador ou do título): cabeçalho fixo, e só as regiões internas — lista, painel, conteúdo — rolam por dentro. A página inteira só rola em formulário longo e linear ou em leitura. *Porquê: a pilha vertical de blocos empurra a ação principal para fora da tela, e a pessoa rola para achar o que a largura sobrando poderia mostrar.*
- Se os blocos empilhados estouram a altura, ponha-os **lado a lado** antes de aceitar a rolagem da página.

**Irmãos do mesmo papel**

- Blocos que cumprem o mesmo papel — colunas paralelas, uma prévia e a faixa ligada a ela, cards da mesma linha — têm a **mesma largura** (ou uma proporção declarada) e a **mesma altura por linha**. O tamanho vem da grade, não do conteúdo de cada bloco. *Porquê: tamanho desigual entre iguais lê-se como erro, mesmo quando ninguém sabe apontar onde.* Exceção: o papel realmente difere (prévia principal e auxiliar) e a diferença é proposital.
- **Controles na mesma linha** (botão, campo, seleção) têm a mesma altura.
- Todo espaçamento vem da escala; **valor solto (13, 15, 22 px) é sinal de erro**, e os intervalos entre irmãos são iguais.
- **Abas irmãs** do mesmo produto, com telas do mesmo tipo, mantêm a mesma estrutura: mesma coluna de controles, prévia no mesmo lugar, ação na mesma posição. *Porquê: cada aba com um layout próprio obriga a pessoa a reaprender a tela.*

**Campos e listas de seleção**

- A largura do campo é **proporcional ao conteúdo esperado** e alinhada à grade; não se estica só para preencher.
- Campo ou seleção com texto cortado e espaço livre ao lado: **alargue antes de cortar**. Se ainda assim cortar, o texto completo fica alcançável (→ «Conteúdo que não quebra a tela»).

## Contraste e tamanhos

- Texto normal com contraste mínimo **4,5 : 1**; texto grande, ícones e bordas de controle **3 : 1**.
- Foco sempre visível.
- Texto sobre imagem só com fundo que garanta o contraste.
- Item desabilitado ainda legível.

| Camada | Corpo | Alvo | Observação |
|---|---|---|---|
| **Computador** | a partir de 14 px; nada abaixo de 12 px (12 só para texto auxiliar) | **32×32 px** | — |
| **Celular** | 16 px, entrelinha 1,5 | **44×44 pt** | → `10` |

Entrelinha de texto corrido entre 1,4 e 1,6; linha de leitura entre 60 e 80 caracteres.

*Porquê: abaixo desses tamanhos a pessoa erra o clique ou aperta os olhos, e o erro não aparece em quem projetou a tela.*

## Densidade em três níveis

| Nível | Espaço entre itens | Espaço interno do contêiner | Altura de linha ou controle | Onde vive |
|---|---|---|---|---|
| **Denso** | 4–8 px | 8–12 px | 28–32 px | tabela, editor, ferramenta com painéis, dashboard cheio |
| **Equilibrado** | 8–16 px | 12–20 px | 36–40 px | cadastro, dashboard, chat |
| **Espaçoso** | 16–32 px | 24–48 px | 48–56 px | site, documentação, celular, primeiro uso |

Regras:

- **Uma densidade por tela.** *Porquê: misturar cansa — o olho recalibra a cada bloco.*
- Escolha pelo tipo de produto (→ `02`) e pela camada (→ `10`).
- Para adensar, corte espaço e decoração — **nunca** o alvo de clique nem a fonte abaixo do mínimo.
- A faixa é orientação dentro da escala de 4 px, não um número a aplicar às cegas.

## Conteúdo que não quebra a tela

- **Nome comprido:** corta com reticências e mostra inteiro no hover e no foco, ou quebra em duas linhas. Decida por região, mas **nunca** estoura nem empurra o layout. Se há espaço livre ao lado, **alargue antes de cortar** (→ «Ocupar o espaço»).
- Chips e tags **quebram de linha** e, passando de um limite, viram «+3».
- Campo sem valor mostra «—».
- Números grandes formatados e com unidade; datas no formato local.
- **Teste** com nome de 60 caracteres, com uma palavra só, vazio e com muita coisa.
- **O significado nunca vai só na cor:** acompanhe de ícone, texto ou forma. *Porquê: quem tem daltonismo, ou usa a tela sob sol forte, não distingue duas cores próximas — e o significado some.*
- **Animação** de interface é curta (de 150 a 250 ms), **interrompível** (o clique no meio da animação responde) e respeita a preferência do sistema de reduzir movimento.

## A estrutura visual é informação

Borda, número, divisor e rótulo **só existem se dizem algo**:

- sem borda em volta do que o espaço já agrupa;
- sem divisor entre itens que o espaço já separa;
- **numerar só o que tem sequência** (passos, ranking);
- rótulo só quando o conteúdo não se explica;
- sem sombra e canto arredondado em tudo.

*Porquê: elemento sem função compete com o dado.*

## Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| tudo do mesmo tamanho e peso | hierarquia esquecida | tamanho + peso |
| nome de 60 caracteres empurra o botão para fora | sem truncar | corte com reticências e completo no hover |
| status só em verde e vermelho | significado só por cor | ícone + texto |
| tudo separado por linha e caixa | borda como hábito | o espaço agrupa; borda só quando diz algo |
| texto de 11 px na tabela para «caber mais» | adensou cortando a fonte | corte espaço e decoração, não a fonte |
| coluna vazia ao lado da prévia, com o resto apertado à esquerda | a largura que sobrou não foi usada | aumente a prévia ou ponha painéis lado a lado |
| a faixa embaixo da prévia é mais larga que ela | tamanho veio do conteúdo | blocos do mesmo papel, mesma largura |
| a página rola porque as prévias empilham | pilha vertical em ferramenta | lado a lado; a tela de trabalho cabe na janela |
| seleção com texto cortado e espaço livre ao lado | largura fixa pequena | alargue antes de cortar |
| cada aba do produto com um layout diferente | tela do mesmo tipo desenhada do zero | mesma estrutura entre abas irmãs |
| botão e campo da mesma linha com alturas diferentes | tamanho vindo do padrão de cada controle | mesma altura |
