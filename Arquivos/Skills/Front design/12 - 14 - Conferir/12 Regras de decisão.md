# 12 Regras de decisão

## O que é e quando abrir

Quando duas regras apontam para lados opostos, ou na dúvida entre duas soluções. A parte mais importante deste arquivo é a **ordem de prioridade**.

## A ordem de prioridade

Do mais forte ao mais fraco. Quando duas regras brigam, vence a de número menor.

1. **O que o usuário disse** — vence tudo, inclusive esta lista. *Porquê: ele é quem sabe o que quer; a skill só preenche o silêncio.*
2. **Poder usar** — contraste, alvo de clique ou toque, foco visível, texto que não estoura nem é cortado havendo espaço livre, e **nunca perder o que a pessoa fez**. *Porquê: tela bonita que não dá para usar não serve a ninguém.*
3. **A tarefa** — a estrutura reflete o que a pessoa faz; a tela deixa claro onde ela está, o que vê, o que pode fazer e o que aconteceu depois da ação; o controle fica junto do objeto que afeta. *Porquê: é para isso que a tela existe.*
4. **Consistência** dentro do produto — o mesmo problema se resolve do mesmo jeito; blocos do mesmo papel têm o mesmo tamanho; abas irmãs têm a mesma estrutura. *Porquê: o que a pessoa aprendeu numa tela vale nas outras.*
5. **Aproveitar o espaço e a densidade** — a largura que sobra mostra mais conteúdo; para adensar, corta-se espaço e decoração.
6. **Acabamento visual.**

**Desempate no mesmo nível:** vence a regra que evita o erro mais caro de desfazer.

## Conflitos comuns e quem vence

| Regra A × Regra B | Vence | Por quê |
|---|---|---|
| densidade × alvo de clique | **alvo** (2 > 5) | um alvo pequeno gera erro em toda interação; um espaço a mais custa só espaço |
| consistência × tarefa | **tarefa** (3 > 4) | uma tela de comparação pode fugir do padrão se comparar exige |
| Estilo pedido pelo usuário × conteúdo que não cabe | **usuário** | a IA compensa dentro do Estilo e conta na linha final |
| economizar um clique × não perder dado | **não perder dado** | um clique a menos não paga uma hora de trabalho perdida |
| padrão conhecido × solução original | **padrão conhecido**, quando reduz esforço | a pessoa já sabe usar |
| pedido do usuário que derruba o contraste | **usuário** | a IA faz o que puder pelos papéis (→ `11`) e avisa |
| hierarquia forte × tela poluída | **menos elementos** | mais elementos diluem qualquer hierarquia |
| aproveitar a largura × alvo de clique ou fonte no mínimo | **alvo e fonte** (2 > 5) | espaço que sobra vira conteúdo, nunca controle ou texto inflado |
| aproveitar a largura × texto de leitura de 60 a 80 caracteres | **a leitura** | esticar o texto cansa; o resto da largura vira índice ou painel |
| controle junto do objeto × economizar altura | **junto do objeto** (3 > 5), e vai ao lado se falta altura | longe do objeto a pessoa não o vê |

## As regras

Cada uma com o porquê.

1. **A estrutura reflete a tarefa, não a estética.** *Porquê: layout bonito para a tarefa errada obriga a contorná-lo.*
2. **Não crie navegação nova quando a existente comporta o conteúdo.** *Porquê: cada navegação extra é mais um lugar em que a pessoa pode se perder.*
3. **Não use modal para fluxo complexo.** *Porquê: modal não guarda passo, voltar nem estado.*
4. **Não use abas no lugar de uma hierarquia de navegação.** *Porquê: abas são um nível só; vinte abas não são estrutura, são fila.*
5. **Não use cards quando a tabela comunica melhor a relação entre os dados.** *Porquê: comparar em card obriga o olho a saltar de caixa em caixa.*
6. **Gráfico responde uma pergunta; nunca decora.** *Porquê: gráfico sem pergunta é ruído com aparência de análise.*
7. **Se duas informações precisam ser comparadas ao mesmo tempo, nenhuma fica escondida atrás de navegação.** *Porquê: ninguém compara o que não consegue ver junto.*
8. **Quanto mais frequente a ação, menor o custo de chegar nela.** *Porquê: um clique a mais, repetido cem vezes por dia, é o que enjoa.*
9. **O que pertence ao mesmo grupo parece do mesmo grupo.** *Porquê: proximidade e alinhamento dizem o que está junto antes de qualquer texto.*
10. **A interface responde sempre: onde estou, o que vejo, o que posso fazer, o que aconteceu depois que fiz algo.** *Porquê: quem não sabe uma dessas quatro coisas para de confiar na tela.*
11. **Padrão conhecido vale mais que invenção quando reduz esforço.** *Porquê: o que a pessoa já sabe usar não precisa ser reaprendido.*
12. **Uma ação primária por região.** *Porquê: várias primárias competem e nenhuma se destaca.*
13. **Estados são desenho, não acidente** (→ `08`). *Porquê: a tela real vive fora do caminho feliz.*
14. **Cada elemento diz algo ou some** (→ `09`). *Porquê: o que não informa compete com o que informa.*
15. **A quantidade de informação define a densidade, não o gosto.** *Porquê: densidade pelo gosto muda de tela para tela e cansa.*
16. **Espaço que sobra serve à tarefa; não fica vazio** (→ `09`). *Porquê: bloco em branco ao lado do trabalho é área desperdiçada.*
17. **O controle fica junto do objeto que ele afeta** (→ `07`). *Porquê: longe do objeto, a pessoa não o vê.*
18. **Blocos do mesmo papel têm o mesmo tamanho** (→ `09`). *Porquê: tamanho desigual entre iguais parece erro.*

## Desfazer × confirmar

- **Reversível** → executa na hora e oferece «Desfazer».
- **Irreversível** → confirma, nomeando o que se perde (→ `08`).
- Nunca um «tem certeza?» genérico.
- *Porquê: confirmação em tudo vira clique automático; desfazer protege sem interromper.*
- Na dúvida se a ação volta, trate como irreversível.

## Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| a IA aplica «consistência» e esconde a comparação em abas | priorizou 4 sobre 3 | a tarefa vence |
| a IA respeita «densidade» e reduz o botão a 20 px | priorizou 5 sobre 2 | o alvo vence |
| a IA troca o Estilo que o usuário pediu porque «o conteúdo pede outro» | ignorou a prioridade 1 | o usuário vence; compense dentro do Estilo e conte |
| a IA economiza a confirmação de uma exclusão definitiva | tratou irreversível como reversível | irreversível confirma, nomeando o que se perde |
| a IA deixa metade da tela vazia ao lado da prévia | leu «contenção» como «deixe espaço» | a largura que sobra mostra mais conteúdo (regra 16) |
| a IA infla botões e fonte para preencher a largura | aplicou «aproveitar o espaço» acima do alvo e da fonte | o alvo e a fonte vencem (2 > 5) |
