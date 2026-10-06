---
description: Cria um PROTÓTIPO — uma cópia mínima e funcional de uma parte do programa em `Saída dos comandos/Protótipos/{Assunto}/`, para trabalhar numa feature sem tocar no código original. Cria a pasta e os arquivos-base (Objetivo.md, Origem.md, Código/) assim que é chamado; depois monta a lista do mínimo, mostra e só copia depois do ok. Só copia — nunca move, renomeia nem edita o original. Para voltar a um protótipo depois de /clear, é o /prototipo-retomar; para levar as alterações ao programa, o /prototipo-implementar.
argument-hint: o que você quer mexer e o que quer fazer (ex.: "a sub-aba Quadro da aba Trabalhos — quero arrastar cartões entre colunas")
---

# /prototipo-novo — Abrir um protótipo de uma parte do programa

> **A família Protótipo tem três comandos, e cada um funciona sozinho:**
>
> | Comando | Quando |
> |---|---|
> | `/prototipo-novo` | quer mexer numa parte do programa sem tocar no original; cria a pasta e a cópia mínima |
> | `/prototipo-retomar` | janela nova ou `/clear` no meio do trabalho; volta ao protótipo pelo nome da pasta |
> | `/prototipo-implementar` | o protótipo ficou como deve; leva as alterações para o original |

O usuário quer acrescentar ou reformular algo numa parte do programa — uma aba, uma sub-aba, uma função, uma rota — **sem trabalhar no código principal**. O motivo é simples: enquanto a mudança não está pronta, o programa em uso tem de continuar funcionando, e mexer direto no original arrisca quebrar o que já funciona no meio do caminho.

Este comando monta, ao lado do programa, um **protótipo**: uma cópia só com o mínimo para aquela parte rodar sozinha. O usuário trabalha ali, vê funcionando, ajusta até ficar certo — e só depois as alterações vão para o original, pelo `/prototipo-implementar`.

**Protótipo aqui não é descartável.** O código dele é código de verdade e volta ao programa. Não é maquete com dados falsos para ver layout (para isso há outros caminhos): é a própria parte, rodando isolada.

> **Regra absoluta: o original não se edita, não se move, não se renomeia — só se copia.**
> Toda escrita deste comando acontece dentro de `Saída dos comandos/Protótipos/{Assunto}/`. Se uma correção parecer exigir mexer no original — um import quebrado, uma configuração, um caminho —, ela é feita **na cópia**: no arquivo copiado, num stub ou no arranque.
>
> É uma regra, não uma trava: **não se cria hook, permissão nem configuração do assistente** para impedir escrita. O usuário decidiu que a regra basta.
>
> **Enquanto o protótipo não for implementado, o original não deve ser editado por ninguém** — nem pelo usuário, nem por outra sessão. É o que garante que levar as alterações depois não apague nada. Diga isso ao usuário no fim.

Este comando é **genérico** — roda em qualquer projeto: programa de desktop, página web, extensão de navegador, servidor, plugin. Nunca assuma que existe mapa do projeto, servidor MCP, git, testes ou qualquer estrutura específica. Se existir, aproveite; se não existir, siga sem — e nunca reclame da ausência.

## A pasta do protótipo

```
Saída dos comandos/Protótipos/{Assunto}/
├── {arranque}      roda o mini programa · nunca volta ao original       · nasce no Passo 5
├── Objetivo.md     o que o usuário quer · índice do código · mudanças   · nasce no Passo 1
├── Origem.md       de onde veio cada arquivo + árvore do mínimo         · nasce no Passo 1
└── Código/         as cópias, nos MESMOS caminhos relativos do original · nasce no Passo 1 (vazia)
```

**Cada item tem um papel e uma regra de ouro. Não misture:**

| Item | Papel | Regra de ouro | Quem lê |
|---|---|---|---|
| `Objetivo.md` | o que se quer, o que existe na cópia e o que já mudou | **sucinto** — sem as falas do usuário, sem conversa | quem retoma, antes de tudo |
| `Origem.md` | o apontador: de onde veio cada arquivo e com que impressão digital | **nunca discute** — só tabela e árvore | o retomar e o implementar |
| `Código/` | as cópias e os stubs | **mesmo caminho relativo do original** | quem trabalha |
| `{arranque}` | abre só essa parte, com a mesma função que ela tem no programa | **nunca volta ao original** | o usuário, para ver |

- `Saída dos comandos/` fica na **raiz do projeto**. Crie as pastas se não existirem.
- `{Assunto}` é o nome em linguagem natural, curto, sem slug nem número (ex.: `Quadro com arrastar/`, `Busca no histórico/`). É por esse nome que o usuário vai chamar o `/prototipo-retomar` e o `/prototipo-implementar` — então que seja fácil de lembrar.
- `{arranque}` tem o nome e a extensão que o tipo de projeto pede (ex.: `rodar.pyw`, `rodar.bat`, `rodar.sh`, `index.html`, `npm-start.cmd`). Fica **na raiz da pasta do protótipo**, nunca dentro de `Código/`.
- **Nada além desses quatro itens.** Sem rodadas, pauta, HTML, briefing, resumo ou registro da conversa: o código da cópia já é a especificação, e o `Objetivo.md` basta para outro assistente se situar.

## Passo 1 — Criar a pasta e os arquivos-base, já

**Assim que o comando é chamado**, antes de explorar qualquer coisa:

1. Tire o `{Assunto}` do argumento. Se o argumento não disser o que mexer, pergunte **só isso** — em uma frase — e siga assim que ele responder.
2. **Verifique se já existe `Saída dos comandos/Protótipos/{Assunto}/`** (ou uma pasta com nome quase igual para o mesmo assunto). Se existir, **não duplique**: diga que o protótipo já existe, mostre a linha `Status:` do `Objetivo.md` dela e aponte o `/prototipo-retomar {Assunto}`. Fim.
3. Crie a pasta com os três itens-base:

**`Objetivo.md`**

```markdown
# {Assunto}

> **Status:** em trabalho
> **Criado em:** {data} · **Última atualização:** {data}
> **Parte do programa:** {a aba, sub-aba, função ou rota — como o usuário disse}
>
> ⚠️ **O original não se edita enquanto este protótipo não for implementado.**
> Só se trabalha em `Código/`, nos stubs e no arranque. Para levar ao programa: `/prototipo-implementar {Assunto}`.
> **Quem chega agora:** leia o `Origem.md` primeiro, depois este arquivo.

## O que eu quero
{duas a cinco linhas, escritas por você, sintetizando o pedido — nunca a fala do usuário colada}

## Como rodar
(definido depois da cópia)

## Índice do código
(preenchido depois da cópia)

## Mudanças
(nenhuma ainda)
```

**`Origem.md`**

```markdown
# Origem — {Assunto}

> **Cópia:** ainda não feita — aguardando o ok da lista do mínimo.
> Este arquivo é só um apontador: de onde veio cada arquivo de `Código/`, e com que
> impressão digital. O `/prototipo-implementar` usa esta tabela para saber para onde
> cada arquivo volta — e para parar se o original mudou desde a cópia.

## Como se monta o mínimo
(preenchido depois da cópia)

## De onde veio cada arquivo
| Original | Cópia | Impressão digital | Volta? |
|---|---|---|---|
```

**`Código/`** — pasta vazia.

**Por que tudo nasce já:** se a janela morrer ou o usuário der `/clear` no meio da montagem, a pasta existe, o `Objetivo.md` diz o que ele queria, e o `Origem.md` diz «cópia ainda não feita» — o `/prototipo-retomar` sabe continuar dali. Sem isso, a montagem se perde e ninguém sabe que houve protótipo.

Diga ao usuário, em uma linha, que a pasta foi criada, e siga.

## Passo 2 — Entender a parte

Chegue informado. Nunca pergunte ao usuário o que dá para descobrir lendo o projeto. Use o que existir, nesta ordem:

1. **O arquivo de instruções da raiz** (`CLAUDE.md`, `AGENTS.md`) e as bases de conhecimento que ele referenciar — é lá que costuma estar como o projeto roda, onde fica cada coisa e o que já foi decidido.
2. **O servidor MCP do projeto**, se houver — ferramentas de localização e de «quem usa quem» respondem em uma chamada o que levaria dezenas de leituras, e costumam enxergar ligações que um `grep` não pega (função global chamada de outro arquivo, ponte entre back e front, ID declarado no HTML e lido no JS).
3. **O código direto**, onde não houver nada disso.

Ache:

- os arquivos **da parte**: a tela, o estilo, o script, o componente;
- **como a parte é aberta hoje** no programa (o ponto de entrada, a rota, o registro da aba);
- **como o programa roda** (o executável, o servidor, o `index.html`, o comando de inicialização) — é daqui que vai sair o arranque.

## Passo 3 — Montar a lista do mínimo

Parta dos arquivos da parte e **siga o fio do que eles usam**, até onde fizer diferença:

- imports e `require`;
- chamadas a função de outro arquivo, mesmo sem import (funções globais);
- rotas ou métodos do backend que o frontend chama;
- IDs e classes declarados num HTML e lidos no JS ou no CSS;
- folhas de estilo, variáveis de tema, fontes e ícones que a parte usa;
- arquivos de dados que a parte lê.

Classifique cada arquivo que o fio tocar:

| Marca | Quando | Na cópia |
|---|---|---|
| `copiar` | necessário para a parte funcionar, e leve | copiado para `Código/`, no mesmo caminho relativo |
| `stub` | necessário, mas pesado, lento, perigoso ou fora do assunto | um substituto fingido mínimo em `Código/`, no mesmo caminho, que responde **só** o que a parte precisa |
| `não precisa` | não é usado pela parte | fica fora |

**O que costuma virar stub:**

| Dependência | Por que stub | O stub faz |
|---|---|---|
| o resto do programa (outras abas, o núcleo inteiro) | não é o assunto e arrastaria meio projeto | expõe só as funções que a parte chama |
| configuração com caminho, chave ou segredo | não se copia segredo; o caminho é da máquina | devolve valores fixos, inofensivos |
| banco de dados, arquivos grandes, dados do usuário | pesado e pessoal | devolve alguns registros de exemplo |
| rede, serviço externo, modelo de IA | lento, pago ou fora do controle | devolve uma resposta fixa |
| backend inteiro, quando a mudança é só visual | a interface basta | responde as chamadas da tela com dados fixos |

**Critério de parada:** o fio para quando o próximo arquivo pode ser trocado por um stub pequeno sem mudar o comportamento da parte. Copiar demais faz o protótipo virar o programa inteiro; copiar de menos faz a parte não ter a mesma função. Na dúvida, **copie o que a mudança vai tocar e faça stub do resto**.

Pode ser só backend, só frontend ou os dois — o que a parte pedir.

**Decida também o arranque:** o que ele precisa fazer para abrir **só** essa parte com a mesma função que ela tem no programa. Exemplos:

| Tipo de projeto | Arranque típico |
|---|---|
| programa de desktop com janela | um script que abre uma janela com só essa tela e liga só o backend dela |
| página ou front web | um `index.html` que carrega os scripts e estilos copiados, ou um servidor local mínimo |
| servidor ou API | um script que sobe só as rotas copiadas, com os stubs no lugar do resto |
| função isolada, biblioteca | um script que chama a função com entradas de exemplo e mostra a saída |

## Passo 4 — Mostrar a lista e esperar o ok

Antes de copiar qualquer coisa, mostre ao usuário, no chat:

1. **A árvore do original**, só com o que o fio tocou, cada arquivo marcado:

   ```
   Program/
   ├── frontend/
   │   ├── trabalhos/
   │   │   ├── quadro.js        copiar
   │   │   ├── quadro.css       copiar
   │   │   └── oficina.js       não precisa
   │   └── comum/api.js         copiar  (o quadro usa)
   └── backend/
       ├── quadro.py            copiar
       └── config.py            stub    (caminhos da máquina)
   ```

2. **A árvore do protótipo** que vai resultar, com o arranque e os stubs marcados.
3. **Uma linha sobre o arranque:** o que ele abre e como se roda.

**Não copie nada antes do «ok».** Se ele pedir para tirar ou pôr um arquivo, trocar um `copiar` por `stub` ou o contrário, refaça a lista e mostre de novo.

## Passo 5 — Copiar e montar

1. **Copie** cada arquivo `copiar` para `Código/`, no mesmo caminho relativo à raiz do projeto. **Cópia — nunca mover, nunca renomear.** Confira depois que o original continua no lugar.
2. **Escreva os stubs** em `Código/`, no caminho do arquivo que substituem, com um comentário no topo dizendo que é stub e o que ele finge.
3. **Escreva o arranque** na raiz da pasta do protótipo. Ele aponta para `Código/` — nunca para o original.
4. **Calcule o SHA-256 de cada original copiado** — é a fotografia. Use o que o sistema tiver (`sha256sum`, `Get-FileHash`, `hashlib` do Python). Arquivo `stub` não tem impressão digital: o original dele não vai ser tocado.

Se um arquivo `copiar` for binário (imagem, fonte, ícone), copie igual e marque `Volta?` como `sim` só se a mudança for alterá-lo; senão, `não volta — só apoio`.

## Passo 6 — Preencher o `Origem.md` e o `Objetivo.md`

### `Origem.md`

- A linha `Cópia:` vira `feita em {data}`.
- **«Como se monta o mínimo»**: as duas árvores do Passo 4, como ficaram depois do ok — o original marcado `copiado` · `stub` · `não precisa`, e o protótipo.
- **«De onde veio cada arquivo»**: uma linha por item de `Código/`, mais o arranque.

| Original | Cópia | Impressão digital | Volta? |
|---|---|---|---|
| `frontend/trabalhos/quadro.js` | `Código/frontend/trabalhos/quadro.js` | `3f9a…` (inteiro) | sim |
| `backend/config.py` | `Código/backend/config.py` | — | stub — não volta |
| — | `rodar.pyw` | — | arranque — não volta |

`Volta?` tem só estes valores: `sim` · `stub — não volta` · `arranque — não volta` · `não volta — só apoio` · `novo` (arquivo criado na cópia durante o trabalho, sem original e sem impressão digital).

Caminhos do `Original` são **relativos à raiz do projeto**; a impressão digital vai **inteira**, nunca abreviada.

### `Objetivo.md`

- **«Como rodar»**: o nome do arranque e o comando exato para rodá-lo.
- **«Índice do código»**: a **árvore de `Código/`**, com **uma mini descrição do que cada arquivo faz** ao lado — uma linha, em português, sobre o papel dele na parte. Stubs marcados `(stub — finge {o quê})`.

  ```
  Código/
  ├── frontend/
  │   ├── trabalhos/
  │   │   ├── quadro.js     desenha as colunas e os cartões; trata o clique e o arrastar
  │   │   └── quadro.css    visual do quadro: colunas, cartões, estados de arrastar
  │   └── comum/api.js      ponte com o backend: as chamadas que o quadro faz
  └── backend/
      ├── quadro.py         lê e grava as atividades e as colunas
      └── config.py         (stub — finge os caminhos do projeto)
  ```

- **«Mudanças»** continua `(nenhuma ainda)`.
- A `Última atualização:` do cabeçalho vira a data de hoje.

## Passo 7 — Rodar

Rode o arranque e confirme que o mini programa **abre com a mesma função** que a parte tem no programa — antes de mudar qualquer coisa. É a linha de base: se já não abre agora, qualquer erro depois fica impossível de separar da feature.

Se não abrir, corrija **na cópia** — um stub a mais, um caminho no arranque, um import que apontava para fora — até abrir. **Nunca no original.** Se precisar de um arquivo que ficou `não precisa`, ele passa a `copiar` (ou `stub`): acrescente na cópia, na tabela do `Origem.md` e no índice do `Objetivo.md`.

Se o projeto não tiver como ser rodado por você (interface gráfica sem acesso, dependência que só existe na máquina do usuário), diga isso e peça para ele rodar o arranque e contar o que viu.

## Passo 8 — Trabalhar

Daqui em diante a conversa é sobre a feature. Os deveres, enquanto durar:

- **Toda edição é em `Código/`, no arranque ou nos stubs.** Nunca no original.
- **Cada mudança vira uma linha em «Mudanças»** do `Objetivo.md`, **no momento em que é feita** — `` `{arquivo}` — {o que mudou, em uma frase} ``. Se a janela morrer no meio, é isso que diz o que já foi feito.
- **Arquivo novo criado na cópia** entra no «Índice do código» (com a mini descrição) e na tabela do `Origem.md` com `Volta? novo`, sem impressão digital, no caminho em `Código/` onde ele moraria no original.
- **Quando o usuário detalhar o que quer**, ajuste «O que eu quero» — sempre sintetizando, nunca colando a fala.
- **Atualize a `Última atualização:`** do `Objetivo.md` a cada resposta em que algo mudou.
- **Nada de rodadas, pauta, HTML ou briefing.** O `Objetivo.md` basta.

## Ao terminar a resposta

Diga ao usuário:

- o nome da pasta e **como rodar** o protótipo;
- que **o original não deve ser editado até implementar**;
- que, depois de um `/clear` ou numa janela nova, ele volta com **`/prototipo-retomar {Assunto}`**;
- que, quando estiver como deve, leva para o programa com **`/prototipo-implementar {Assunto}`**.
