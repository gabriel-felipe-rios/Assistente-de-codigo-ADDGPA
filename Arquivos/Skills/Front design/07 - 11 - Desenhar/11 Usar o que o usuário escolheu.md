# 11 Usar o que o usuário escolheu

## O que é e quando abrir

Ao aplicar aparência. O usuário escolhe cinco coisas: o **Estilo** (esqueleto de layout), as **Cores**, a **Tipografia**, as **Texturas e materiais** e as **Animações**. Elas podem chegar como nomes, arquivo, prompt colado ou lista de cores.

**O que veio vence** e a skill aplica **como veio**: não troca, não «melhora» e não completa com gosto próprio.

*Porquê: a aparência é dele. Uma tela «melhorada» por conta própria desfaz a escolha que ele fez de propósito.*

## Papéis de cor

| Papel | Para que serve |
|---|---|
| **Fundo** | o plano de trás de tudo |
| **Superfície** | painéis, cards |
| **Superfície em hover ou selecionada** | o item sob o cursor ou escolhido |
| **Superfície escura** | trilhos, barras |
| **Texto** | o corpo do que se lê |
| **Texto secundário** | rótulos, apoio, data, legenda |
| **Primária** | ação principal, seleção, foco |
| **Positiva** | sucesso, confirmar |
| **Negativa** | erro, ação destrutiva |
| **Especial** | destaque raro |
| **Utilitária** | ação secundária, neutros, borda de botão secundário |

Regras:

- Cada cor tem um papel e **não empresta o papel a outra**: a negativa nunca vira enfeite.
- Se a paleta traz o **uso** de cada cor, o uso dela vence.
- Escreva as cores como **variáveis com o nome do papel** (`--primaria`, `--texto-secundario`), não com o nome da cor.

*Porquê: a mesma tela precisa funcionar com qualquer paleta; trocar a paleta tem de ser trocar as variáveis, sem tocar no resto.*

## Sem paleta

A skill **não inventa cor**. Sem paleta dada, declare os papéis acima em variáveis com **escala neutra, sem matiz**, respeitando o contraste do `09`, e diga na linha final que a paleta é neutra por falta de paleta.

Como positiva e negativa ficam ambas neutras, o significado de sucesso e erro vai **também** em ícone e texto (→ `09`).

*Porquê: qualquer cor inventada é uma decisão de aparência que não é da skill — e o usuário passa a desfazê-la em toda tela.*

## Paleta que falha em contraste

A paleta do usuário vence: mantenha as cores. Escolha **qual papel usar em cada lugar** para passar no contraste — texto no papel certo sobre o fundo certo. Se mesmo assim algum par não passar, entregue e conte na linha final.

*Porquê: mexer na cor para «consertar» é trocar a escolha dele; escolher o papel certo respeita a paleta e ainda resolve a maior parte dos casos.*

## Tipografia

- Use a família e a escala escolhidas.
- Hierarquia por tamanho e peso (→ `09`).
- Sem tipografia escolhida, a fonte do sistema.
- No máximo duas famílias.
- Monoespaçada só para código e números que precisam alinhar.

## Texturas e materiais

- Aplique só onde a textura diz que vale.
- Ela fica **sob** o conteúdo e nunca reduz a legibilidade.
- Sem textura escolhida, superfícies planas.

## Animações

Cada animação escolhida diz **onde** o movimento vale: abrir painel ou modal, arrastar, digitar e validar, notificação, passar o mouse, trocar de aba.

- Use **só nesses pontos**.
- Curta e interrompível (→ `09`).
- Sem animação escolhida, só a mudança imediata de estado (hover, foco).

## Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| a IA escolhe uma cor «que combina» | inventou cor | variáveis por papel, escala neutra |
| a cor negativa usada como destaque bonito | papel emprestado | só para erro e ação destrutiva |
| animação em toda transição | ignorou onde ela vale | só nos pontos escolhidos |
| cores escritas direto nos componentes | sem variável por papel | variável com o nome do papel |
| a paleta do usuário «corrigida» para passar no contraste | trocou a escolha dele | mantenha as cores; mude o papel usado |
