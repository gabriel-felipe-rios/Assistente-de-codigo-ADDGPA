---
description: MELHORAR um briefing já gerado, antes de implementar — opcional. Numa janela limpa, relê a discussão inteira e o briefing, e completa cada fase com o que alguém sem a conversa não saberia (o quê, onde, o trecho, o que fica, por quê, o sentido dos termos). Não cria decisão e não escreve código. Termina dizendo o que acrescentou — ou «nada a acrescentar», que é quando parar de rodá-lo.
argument-hint: (opcional — o nome da pasta da discussão; sem argumento, lista as que têm briefing e pergunta qual)
---

# /discutir-ideia-melhorar-briefing — Completar o briefing antes da obra

> **A família Discutir ideia tem cinco comandos, e cada um funciona sozinho:**
>
> | Comando | Quando |
> |---|---|
> | `/discutir-ideia-nova` | a ideia ainda não tem forma; começa a discussão |
> | `/discutir-ideia-retomar` | janela nova ou `/clear` no meio da discussão; continua decidindo |
> | `/discutir-ideia-gerar-briefing` | a discussão está «pronta para briefing»; numa janela limpa, lê a discussão inteira e escreve `Briefing/` e `Obra.md` |
> | `/discutir-ideia-melhorar-briefing` | opcional; numa janela limpa, completa o briefing até dizer «nada a acrescentar» |
> | `/discutir-ideia-implementar` | existe `Obra.md`; constrói uma fase por vez, continuando sozinho da primeira que falta |

**Este comando é opcional.** Ele existe porque o usuário mandava "aumentar o briefing" uma, duas, três vezes antes de implementar. Aqui isso tem forma: uma passada de conferência, **numa janela limpa**, que relê a discussão inteira e o briefing e completa o que faltou — até dizer **«nada a acrescentar»**.

O teste de cada fase é um só: **alguém que nunca viu a conversa consegue executá-la sem perguntar nada?**

> **Regra absoluta: não se escreve código, e não se decide nada.** Este comando completa o que **já foi decidido**. Se achar um buraco que pede decisão, **não o põe no briefing**: lista no chat e aponta o `/discutir-ideia-retomar`. O briefing é final — pendência nele faz o implementador parar.

## Passo 1 — Achar a discussão

Procure por `Saída dos comandos/Discussões/*/Obra.md` na raiz do projeto.

- **Com o nome da pasta como argumento:** vá direto para ela.
- **Nenhum `Obra.md`:** diga que não há briefing gerado e aponte o `/discutir-ideia-gerar-briefing`. Fim.
- **Sem argumento, um ou mais:** mostre a lista, com o progresso de cada `Obra.md`, e **pergunte qual — mesmo quando só há um**.

Se a obra já começou (há fase ✅ ou 🟡), avise: só as fases ⬜ serão mexidas.

## Passo 2 — Ler tudo

A discussão inteira, na mesma ordem do gerar-briefing, e depois o briefing:

| Ordem | Arquivo | Para quê |
|---|---|---|
| 1 | `Discussão.md` | o índice |
| 2 | `Discussão/3 · Decidido.md` | o que construir, com o motivo |
| 3 | `Discussão/5 · Proibido.md` | o que o ⛔ tem de ter |
| 4 | `Discussão/2 · Terreno/` — todas as rodadas e `Arquivos que seriam mexidos.md` | os fatos |
| 5 | `Discussão/1 · O que eu quero/` — todas as rodadas | o sentido dos termos do usuário |
| 6 | `Discussão/6 · Não entendi.md` | o que precisa de mais clareza |
| 7 | `Obra.md`, `Briefing/00 · Leia antes.md` e todas as fases | o que está escrito hoje |

Nada dentro de `<details>` é decisão ativa. Não abra os HTML.

## Passo 3 — Conferir e completar

**Só nas fases ⬜.** Fase 🟡 ou ✅ já está em obra: não se toca.

| Confere | Se faltar |
|---|---|
| toda D ✅ tem fase ou ⛔, **com o conteúdo** da decisão — não só o número | acrescenta na fase certa |
| cada mudança tem arquivo, `procurar:` com o trecho exato **de hoje**, `fica:` por extenso, `por quê:` e a D de origem | abre o arquivo do projeto e completa |
| todo termo próprio do usuário usado numa fase está explicado nela | explica, com as palavras dele |
| nenhuma pendência — «revisar depois», «verificar», «a confirmar» | resolve pelo que está decidido; se não estiver decidido, é buraco (Passo 4) |
| toda fase da 02 em diante tem «Separada da anterior porque:» com motivo real — dependência ou volume | sem motivo, junta as duas fases e ajusta o `Obra.md` |
| o ⛔ do `00 · Leia antes.md` tem todo o `5 · Proibido.md` e os ❌ | acrescenta |
| o `Obra.md` e o `00 · Leia antes.md` dizem como continuar: primeira ⬜, fase ✅ não se refaz | acrescenta |
| nenhuma fase manda abrir a discussão | troca a remissão pelo conteúdo |

Número de linha é datado: confira cada `procurar:` no arquivo do projeto, e troque o trecho se ele mudou.

## Passo 4 — Buraco que pede decisão

Não entra no briefing. Liste no chat — o que falta, em qual fase, e por que não dá para resolver pelo que está decidido —, diga que a decisão é do usuário e aponte o `/discutir-ideia-retomar`. Depois de decidido lá, este comando pode rodar de novo.

## Passo 5 — Relatório

Diga, por fase, o que acrescentou. Ou, com todas as letras: **«nada a acrescentar: o briefing está completo»** — é o sinal de parar de rodar este comando.

Feche apontando o caminho: `/clear` e `/discutir-ideia-implementar {nome da pasta}`.

## O que este comando nunca toca

O `Discussão.md` e a pasta `Discussão/` — ele os lê, não os muda. As fases 🟡 e ✅. E o código do projeto.

---

**Briefing a melhorar:** $ARGUMENTS
