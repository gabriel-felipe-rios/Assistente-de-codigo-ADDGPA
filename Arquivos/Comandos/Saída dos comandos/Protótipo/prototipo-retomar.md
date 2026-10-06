---
description: Voltar a um PROTÓTIPO já aberto com /prototipo-novo, numa janela nova ou depois de /clear. Lista os protótipos com o estado de cada um (montando / em trabalho / implementado) lendo só o cabeçalho, lê o Origem.md e o Objetivo.md do escolhido, confere pela impressão digital que o original não mudou desde a cópia e continua o trabalho de onde parou — inclusive uma montagem que ficou pela metade. Nunca edita o original.
argument-hint: (opcional) o nome da pasta do protótipo; sem argumento, lista os protótipos e pergunta qual
---

# /prototipo-retomar — Voltar a um protótipo aberto

> **A família Protótipo tem três comandos, e cada um funciona sozinho:**
>
> | Comando | Quando |
> |---|---|
> | `/prototipo-novo` | quer mexer numa parte do programa sem tocar no original; cria a pasta e a cópia mínima |
> | `/prototipo-retomar` | janela nova ou `/clear` no meio do trabalho; volta ao protótipo pelo nome da pasta |
> | `/prototipo-implementar` | o protótipo ficou como deve; leva as alterações para o original |

Um protótipo vale enquanto durar a janela de contexto. Fechou a janela ou deu `/clear`, o contexto se perde — mas a pasta continua no disco, com o `Objetivo.md` dizendo o que se quer e o que já mudou, e o `Origem.md` dizendo de onde veio cada arquivo. **Este comando é a ponte de volta.**

Na mesma janela, com o trabalho em andamento, você não precisa dele: basta continuar. Ele existe para o caso em que o assistente não sabe que há protótipo aberto — e em que o usuário também não lembra o nome exato da pasta.

> **Regra absoluta: o original não se edita, não se move, não se renomeia.**
> Toda escrita deste comando acontece dentro de `Saída dos comandos/Protótipos/{Assunto}/`. Se uma correção parecer exigir mexer no original, ela é feita **na cópia**. É uma regra, não uma trava: não se cria hook, permissão nem configuração do assistente.
>
> **Se a intenção for levar as alterações para o programa, este comando é o errado** — é o `/prototipo-implementar`.

Este comando é **genérico** — roda em qualquer projeto. Se o projeto tiver servidor MCP, índices ou bases de conhecimento, aproveite; se não, siga sem — e nunca reclame da ausência.

## Os arquivos que ele lê

```
Saída dos comandos/Protótipos/{Assunto}/
├── {arranque}      ← não abre · só usa para rodar
├── Objetivo.md     ← Passo 1 lê SÓ o cabeçalho · Passo 3 lê inteiro
├── Origem.md       ← Passo 3 lê inteiro, ANTES do Objetivo
└── Código/         ← sob demanda: só o arquivo que a tarefa da vez pedir
```

## Passo 1 — Listar, lendo só o cabeçalho

Procure por `Saída dos comandos/Protótipos/*/Objetivo.md` na raiz do projeto.

- **Nenhum:** diga isso e aponte o `/prototipo-novo`. Fim.
- **Com o nome da pasta como argumento:** vá direto para ela (aceite nome aproximado se só uma pasta bater) e pule para o Passo 3.

Para montar a lista, leia **apenas o cabeçalho** de cada `Objetivo.md` (as linhas `Status:`, `Última atualização:` e `Parte do programa:`) e a linha `Cópia:` do `Origem.md`. Não abra `Código/` para montar a lista.

## Passo 2 — Mostrar a lista com o estado de cada um

| Estado | Como detectar | O que fazer |
|---|---|---|
| **montando** | `Status:` «em trabalho» e `Origem.md` com `Cópia:` «ainda não feita» | este comando — continua a montagem (Passo 4) |
| **em trabalho** | `Status:` «em trabalho» e `Cópia:` «feita em …» | este comando — continua o trabalho |
| **implementado** | `Status:` «implementado em {data}» | nada — já está no programa |

Monte a tabela no chat:

| Protótipo | Parte do programa | Estado | Mudanças | Última atualização |
|---|---|---|---|---|
| {nome da pasta} | {parte} | {estado} | {n linhas em «Mudanças»} | {data} |

Protótipos em trabalho primeiro, implementados por último. **Pergunte qual retomar — mesmo quando só há um.**

Se o escolhido estiver **implementado**, diga que ele já foi levado ao programa e pare: um protótipo implementado não se reabre. Para mexer de novo naquela parte, é um `/prototipo-novo`.

## Passo 3 — Ler o protótipo

Nesta ordem, e só isto:

| Ordem | O quê | Para quê |
|---|---|---|
| 1 | **`Origem.md`** inteiro | de onde veio cada arquivo, o que é stub, o que é arranque, a impressão digital de cada original |
| 2 | **`Objetivo.md`** inteiro | o que o usuário quer, como rodar, o índice do código e as mudanças já feitas |

**Não releia o código inteiro.** O «Índice do código» diz o que cada arquivo faz: abra só o arquivo que a tarefa da vez pedir. É isso que faz o retomar ser barato — a orientação está nos dois arquivos, não no código.

**Confira o índice contra a pasta:** se houver em `Código/` arquivo que não está no índice nem na tabela do `Origem.md` (ou o contrário), corrija os dois arquivos para baterem com a pasta e diga isso ao usuário. Arquivo sem linha na tabela é arquivo que o implementar não saberia para onde levar.

## Passo 4 — Se a montagem ficou pela metade

Se o `Origem.md` diz `Cópia: ainda não feita`, a janela morreu antes da cópia. Continue a montagem do ponto em que ela parou, com os mesmos passos do `/prototipo-novo`:

1. **Monte a lista do mínimo** — parta dos arquivos da parte descrita em `Parte do programa:` e siga o fio do que eles usam; classifique cada um como `copiar`, `stub` ou `não precisa`; decida o arranque.
2. **Mostre as duas árvores** (original marcado · protótipo resultante) e **espere o ok**. Não copie nada antes.
3. **Copie** (nunca mova), escreva os stubs e o arranque, calcule o SHA-256 de cada original copiado.
4. **Preencha** o `Origem.md` (`Cópia: feita em {data}`, as árvores, a tabela) e o `Objetivo.md` («Como rodar», «Índice do código» em árvore com mini descrição por arquivo).
5. **Rode o arranque** e confirme que a parte abre com a mesma função que tem no programa.

Se `Código/` tiver arquivos mas o `Origem.md` ainda disser «ainda não feita», a cópia foi interrompida no meio: confira arquivo por arquivo contra a lista, complete o que falta e só então preencha o `Origem.md`.

## Passo 5 — Conferir a fotografia

Recalcule o SHA-256 de cada original da tabela do `Origem.md` que tem impressão digital, e compare.

| Resultado | O que fazer |
|---|---|
| todos batem | siga |
| algum não bate | avise o usuário, **listando os arquivos**, que o original foi editado enquanto o protótipo estava aberto — e que o `/prototipo-implementar` vai parar nesses arquivos. Continue trabalhando só na cópia. **Não toque no original** e não «atualize» a impressão digital: ela é o registro do momento da cópia |
| o original sumiu ou mudou de lugar | avise o usuário, com o caminho. O protótipo continua funcionando (a cópia é independente), mas esse arquivo não vai ter para onde voltar sem ele decidir |

## Passo 6 — Situar o usuário e continuar

Resuma no chat, em poucas linhas:

- o que é o protótipo (a parte e o «O que eu quero», sintetizado);
- **as últimas mudanças** (as últimas linhas de «Mudanças»);
- como rodar;
- o resultado da fotografia.

Depois, continue pelo que o usuário pedir — ou, se ele não disser nada, pergunte o próximo passo da feature.

## Passo 7 — Continuar trabalhando

Os mesmos deveres de quem abriu o protótipo, escritos aqui por inteiro:

- **Toda edição é em `Código/`, no arranque ou nos stubs.** Nunca no original.
- **Cada mudança vira uma linha em «Mudanças»** do `Objetivo.md`, **no momento em que é feita** — `` `{arquivo}` — {o que mudou, em uma frase} ``.
- **Arquivo novo criado na cópia** entra no «Índice do código» (com a mini descrição do que ele faz) e na tabela do `Origem.md` com `Volta? novo`, sem impressão digital, no caminho em `Código/` onde ele moraria no original.
- **Precisou de um arquivo do original que ficou de fora?** Copie-o agora (nunca mova), com a impressão digital, e acrescente a linha na tabela e no índice.
- **Quando o usuário detalhar o que quer**, ajuste «O que eu quero» — sempre sintetizando, nunca colando a fala dele.
- **Atualize a `Última atualização:`** do `Objetivo.md` a cada resposta em que algo mudou.
- **Nada de rodadas, pauta, HTML ou briefing.** O `Objetivo.md` basta.

Ao fim de cada resposta em que o protótipo parecer pronto, lembre: quando estiver como deve, **`/prototipo-implementar {Assunto}`**.
