---
description: Gera um HTML fictício com dados falsos para preview visual da interface, fiel à interface real do programa, usando código de cores nas abas/sub-abas (vermelha inerte · âmbar abre os filhos · verde e azul renderizadas inteiras), para validar o layout de novas modificações antes de implementar.
argument-hint: [descreva as modificações que você quer prototipar]
---

# /preview-nova-interface — Preview visual da interface (dados falsos)

Gere um **arquivo HTML fictício**, com **dados totalmente falsos**, para servir de **preview visual** das modificações antes de implementá-las. O objetivo é validar layout, posição e navegação — economizando tempo e tokens.

**O preview tem que parecer o programa de verdade.** Um preview bonito mas diferente da interface real não valida nada: aprova-se um layout que não existe. As etapas 1 e 2 abaixo são o que garante isso e **não são opcionais**.

---

## Etapa 1 — Ler a interface real ANTES de escrever qualquer HTML

**Não escreva uma linha de HTML antes de completar esta etapa.** Não reconstrua a interface de memória, não deduza pelo nome dos arquivos, não invente paleta.

### 1.1 · Achar onde mora a interface

Nesta ordem:

1. Tente `Program/Code/frontend/` — é o padrão da arquitetura AMF, que a maioria dos projetos deste usuário segue.
2. Não achando, descubra onde mora a interface neste projeto (procure por arquivos de tela, estilo e template).
3. **Não achando de jeito nenhum: pare e avise o usuário.** Nunca invente a interface.

A pasta é previsível, mas a estrutura **dentro** dela varia de projeto para projeto — descubra no lugar, não presuma.

### 1.2 · O que ler — em camadas

| Camada | O que ler | Por quê |
|---|---|---|
| **Sempre** | Onde moram as **cores/tokens** (bloco `:root`, arquivo de tema, constantes de cor) e onde mora a **definição da navegação** (as abas/sub-abas e o estilo delas) | É o que faz o preview parecer o programa |
| **Só da tela afetada** | O **estilo** e o **template/markup** da tela que vai mudar | É a única renderizada de verdade |
| **Nunca** | Backend, servidor, prompts, testes, e o estilo/template das telas **não** afetadas | Não influencia o visual e custa caro |

Ler a interface inteira é proibido — é o que estoura o custo sem melhorar o resultado. As telas não afetadas viram só um nome no preview (ver 3.3), então não precisam de leitura nenhuma.

### 1.3 · O que extrair da leitura

- **Paleta real**: fundo geral, fundo de superfície, texto principal, texto secundário, cores de ação. Anote os valores exatos — o preview usa **esses**, não aproximações.
- **Forma e tipografia**: raio de borda, fonte, tamanho base, espaçamentos.
- **Navegação real**: a lista completa das abas, **na ordem exata e com os rótulos exatos** que aparecem na tela. Cuidado com rótulo que não bate com o id interno — vale o que o usuário lê, não o nome da variável.
- **A tela afetada**: quais componentes já existem nela hoje.

---

## Etapa 2 — Fidelidade: o resto do HTML usa a paleta real

Fora do código de cores das abas (etapa 3), **todo o preview usa as cores, o raio, a fonte e os espaçamentos reais que você leu na etapa 1**. Se o programa é escuro, o preview é escuro. Nada de cor inventada, nada de "parecida", nada de tom que não exista no projeto.

---

## Etapa 3 — O código de cores da navegação

### 3.1 · A regra, como árvore de decisão

Para **cada** aba ou sub-aba, de cima para baixo, uma pergunta de cada vez:

1. **Nada muda nela nem em nenhum descendente?** → **VERMELHA.** Inerte.
2. **Ela mesma não muda, mas algum descendente muda?** → **ÂMBAR.** Clicável: abre a barra de filhos — e a mesma regra recomeça nos filhos (o filho que não muda é vermelho; o que muda é verde; o novo é azul).
3. **Ela muda e já existe?** → **VERDE.** Renderizada inteira.
4. **Ela é nova?** → **AZUL.** Renderizada inteira.

### 3.2 · A tabela única — cor, comportamento e elemento HTML

| Cor | Hex | Significado | Clica? | Abre a barra de filhos? | Renderiza o conteúdo? | Elemento HTML obrigatório |
|---|---|---|---|---|---|---|
| Vermelha | `#c0392b` | nada muda nela nem abaixo | **não** | não | não — só o nome, para dar a posição visual | `<span>` com `cursor:default` e `pointer-events:none`. **Nunca `<button>`, nunca handler.** |
| Âmbar | `#f5b342` | ela não muda; um descendente muda | sim | **sim** | não | `<button>` **com** handler que mostra a barra de sub-abas |
| Verde | `#0f9d6e` | existe e muda | sim | se tiver filhos | **sim, inteira** | `<button>` **com** handler que troca a tela |
| Azul | `#3b6ef5` | nova | sim | se tiver filhos | **sim, inteira** | `<button>` **com** handler que troca a tela |

**Duas regras que blindam o preview contra vazamento de cor — as duas valem sempre:**

- **A marcação não sai das abas.** Os quatro hex aparecem **exclusivamente** no texto de nomes de aba/sub-aba. Em nenhum outro lugar do HTML. Todo o resto usa a paleta real do programa.
- **A cor do programa não entra nas abas.** Nome de aba/sub-aba **não herda cor nenhuma da paleta real**: a marcação pinta o **texto** do nome, nunca o fundo do botão — mesmo que no programa real a cor do texto signifique outra coisa.

**Aba/sub-aba atualmente aberta:** como a cor do texto está ocupada pela marcação, o estado "aberta" é indicado por outro canal — fundo sutil e borda em tom neutro (translúcido). Nunca por cor de texto.

**A mecânica não é opcional.** "Vermelha que clica" tem de ser **impossível** (é `<span>` sem eventos); "âmbar que não abre" tem de ser **visível só de ler o HTML** (é `<button>` sem handler). Quem entrega confere isso no código e, depois, clicando (Etapa 5).

### 3.3 · Quanto desenhar da tela verde/azul

**A tela inteira, como ela é hoje, mais a novidade marcada.** Se a mudança é um campo novo no topo de uma aba que já tem árvore, lista e botões, o preview desenha a árvore, a lista e os botões também.

Desenhar só o pedaço novo não valida nada: você não vê se ele cabe, se briga com o que já está lá, se empurra o resto para baixo. O conflito apareceria só na implementação — tarde demais.

### 3.4 · Orientação e projetos sem abas

- As abas do preview espelham a **orientação real** do programa: horizontais ou laterais.
- **Projeto sem navegação por abas:** não há código de cores a aplicar — o preview vira simplesmente a tela reformulada inteira, fiel à etapa 2.

---

## Etapa 4 — O conteúdo do preview

Preencha com **dados fictícios curtos** que representem a funcionalidade: nomes de botão, colunas, campos, itens de lista.

**O preview não tem texto nenhum que não seja da interface.** Nada de legenda, caixa de nota, parágrafo de observação, "por que", balão de ajuda, painel de comentários, marcador numerado ou botão de explicação. Ele é para os olhos; quem sabe o código de cores é o usuário. O que precisa ser dito vai para o chat (Etapa 6).

---

## Etapa 5 — Conferir clicando, antes de entregar

Abra o arquivo gerado no navegador embutido e:

1. Clique **cada** aba e sub-aba âmbar: a barra de filhos tem de aparecer, com os filhos nas cores certas.
2. Clique **cada** aba e sub-aba verde e azul: a tela tem de trocar e mostrar o conteúdo inteiro.
3. Tente clicar uma vermelha: nada pode acontecer.

Se algo falhar, conserte o handler e repita. Este passo existe porque texto de regra não pega handler desligado — só o clique pega.

---

## Etapa 6 — Onde salvar

Pasta de saída: `Saída dos comandos/Melhorias a se fazer/` na **raiz do projeto** (crie as pastas se não existirem).

Nome do arquivo: `preview-<slug-curto>.html`, onde `<slug-curto>` resume a modificação.

**Antes de escrever, liste os NOMES dos arquivos já existentes nessa pasta.** Só os nomes — não abra o conteúdo dos previews antigos, seria token gasto à toa.

Se já existir um arquivo com o mesmo nome: **pare e pergunte** ao usuário se é para substituir (ele está refazendo o mesmo preview) ou criar uma variação (`-v2`). Nunca sobrescreva calado.

O HTML deve ser **autocontido** (CSS e JS inline, sem dependência externa) e legível.

**No chat, ao entregar:** o caminho do arquivo, a oferta de abrir, e — uma linha para cada — as **mudanças sem reflexo visual** (lógica, backend, regra de negócio, estrutura de dados, performance) que fazem parte da modificação e por isso não aparecem no preview. Nunca invente UI para elas; nunca as deixe de fora.

---

## Antes de entregar — confira

1. Li a paleta e a navegação reais? O preview usa os valores exatos que li, não aproximações?
2. A lista de abas está completa, na ordem certa, com os rótulos que aparecem na tela?
3. Os quatro hex aparecem **só** em nome de aba/sub-aba? Nenhum nome de aba herda cor da paleta real? A marcação está no texto, não no fundo?
4. Toda aba vermelha é `<span>` sem eventos? Toda âmbar, verde e azul é `<button>` **com** handler?
5. A tela verde/azul foi desenhada **inteira**, com o que já existe nela hoje?
6. O HTML não tem nenhum texto que não seja da interface — nem legenda?
7. Abri no navegador e cliquei cada aba e sub-aba não vermelha? A vermelha não reagiu?
8. Conferi os nomes na pasta de saída antes de escrever?
9. Listei no chat as mudanças sem reflexo visual?

Ao final, informe o caminho do arquivo gerado e ofereça abrir o preview.

---

**Modificações a prototipar:** $ARGUMENTS
