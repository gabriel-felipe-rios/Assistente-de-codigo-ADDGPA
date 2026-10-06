# Glossário no código

Um termo que o **Vocabulário do projeto** já decidiu aparece **sublinhado**
pontilhado. Um sinônimo que ele **proibiu** aparece **riscado** em vermelho.

## De onde vem o vocabulário

De `Saída das skills/Terminologia e nomenclatura/Vocabulário.md`, **do projeto
aberto** — não do programa. A extensão sobe até três níveis a partir da pasta
de código procurando por ele: num projeto cuja pasta de código é `MeuApp/src`,
a base costuma morar em `MeuApp/`.

⚠️ **Nem todo projeto tem um, e isso é o normal.** Sem Vocabulário, a extensão
fica quieta — não marca nada e não avisa nada.

## O que ela lê de lá

| Vira | De onde |
|---|---|
| termo (sublinhado) | o título de cada `### Entrada` |
| termo (sublinhado) | o que está entre crases na linha `Nome canônico:` |
| proibido (riscado) | o que está entre crases na linha `Nunca usar:` |

⚠️ **Só a primeira oração dessas linhas.** O que vem depois de um travessão, de
um `;` ou de um ponto final é prosa, e a prosa cita termos que não são o
assunto da linha. Um exemplo real deste projeto:

> Nunca usar: `os.path.join(PROJECTS_DIR, ...)` montado à mão — era assim em 75
> pontos e é o que a existência de `caminhos.py` proíbe.

Sem esse corte, `caminhos.py` — que é justamente o jeito certo — apareceria
riscado no código inteiro.

## Duas limitações que valem saber

⚠️ **Palavra inteira não dobra acento.** A extensão casa a palavra sozinha
(usando `\p{L}` e `\p{N}`, e não o `\b`, que em português casaria no meio de
`subfunção`). Mas ela **não** dobra grafia: `funcao` não acha `função`. Quem
quer as duas registra as duas no Vocabulário.

⚠️ **Vale em todo arquivo de texto**, não só em código — comentário, `.md` e
`.txt` usam o vocabulário do projeto tanto quanto o código.

## Como ela é barata

O Vocabulário é lido **uma vez**, quando o projeto abre, e vira duas expressões
regulares em memória. O gancho do decorador — que roda depois de cada pintura,
a cada 120 ms de digitação, com 150 ms de teto — só executa essas duas
expressões. **Nenhuma ida ao Python por tecla.**

Teto de 400 marcas por lista: a partir daí ninguém lê mais nada mesmo.

## O recorte da versão 1

| Faz | Não faz |
|---|---|
| sublinha o termo canônico | sugerir a troca |
| risca o sinônimo proibido | renomear |
| lê o título e as duas linhas | ler a explicação da entrada |

## Opções

Em **Configurações › Extensões › Glossário no código**: ligar e desligar o
sublinhado dos termos e o risco dos proibidos separadamente, ignorar
maiúsculas (desligado por padrão: `Fila` e `fila` são coisas diferentes no
Vocabulário), e o teto de marcas por lista. Valem na hora, ao salvar.

## A lista, com o que deveria ser

Clique direito na aba do arquivo → **Vocabulário neste arquivo…**. Lista os
sinônimos proibidos encontrados, quantas vezes, e **o nome que o Vocabulário
manda usar** no lugar (o `Nome canônico` da mesma entrada), mais os termos
encontrados — cada um com "ir para a linha". É onde a sugestão aparece: a
marca só risca.

## No Acesso rápido

**Vocabulário neste arquivo…** — o mesmo item do menu da aba, para o arquivo
na frente do Editor. Cinza sem Vocabulário no projeto.

## O que ela mexe

**Nada.** Ela **lê** um arquivo do projeto (`Vocabulário.md`) pelo backend
dela; não grava nada, em lugar nenhum. `escreve_fora` está vazio e é verdade.

## O prefixo

`glo`: `.glo-termo`, `.glo-proibido`, `glo-estilo`, `gloCarregar`, `gloRegex`,
`glo_acoes.py`.
