---
description: GERAR o briefing de uma discussão que ficou «pronta para briefing» — numa janela limpa, lê a discussão inteira (o Discussão.md como índice e todos os arquivos da pasta Discussão/) e escreve a pasta Briefing/ e o Obra.md, com a obra cortada em poucas fases, cada uma completa por si só. Não discute, não decide e não escreve código. Recusa se ainda houver ponto em aberto.
argument-hint: (opcional — o nome da pasta da discussão; sem argumento, lista as que estão prontas para briefing e pergunta qual)
---

# /discutir-ideia-gerar-briefing — Transformar a discussão em ordem de serviço

> **A família Discutir ideia tem cinco comandos, e cada um funciona sozinho:**
>
> | Comando | Quando |
> |---|---|
> | `/discutir-ideia-nova` | a ideia ainda não tem forma; começa a discussão |
> | `/discutir-ideia-retomar` | janela nova ou `/clear` no meio da discussão; continua decidindo |
> | `/discutir-ideia-gerar-briefing` | a discussão está «pronta para briefing»; numa janela limpa, lê a discussão inteira e escreve `Briefing/` e `Obra.md` |
> | `/discutir-ideia-melhorar-briefing` | opcional; numa janela limpa, completa o briefing até dizer «nada a acrescentar» |
> | `/discutir-ideia-implementar` | existe `Obra.md`; constrói uma fase por vez, continuando sozinho da primeira que falta |

Uma discussão «pronta para briefing» tem tudo decidido, mas espalhado: rodadas, fatos, decisões com o motivo, proibições. **Este comando transforma isso em ordem de serviço** — a pasta `Briefing/`, fatiada em fases, e o `Obra.md`, o placar da obra.

**Ele roda numa janela limpa** — depois de `/clear` ou numa janela nova. É isso que faz o briefing sair completo: ele lê a discussão do disco com o contexto vazio, em vez de resumir de memória no fim de uma conversa longa, com a janela cheia. Briefing escrito assim saía pequeno, e o usuário tinha de mandar "aumentar o briefing" duas, três vezes.

> **O briefing é final.** Quem implementa não lê a discussão — nunca. Tudo o que ele precisa tem de estar no briefing: o quê, onde, o trecho exato, o que fica no lugar, por quê, e o sentido de cada termo próprio do usuário. **Nada pendente:** nenhum «revisar depois», «verificar», «a confirmar». Pendência no briefing faz o implementador parar e perguntar se é para seguir — é exatamente o que o briefing existe para evitar.
>
> **Regra absoluta: não se escreve código, não se discute, não se decide.** Este comando só transforma decisões já tomadas em ordem de serviço. Se faltar uma decisão, ela não é tomada aqui.

## Passo 1 — Achar a discussão

Procure por `Saída dos comandos/Discussões/*/Discussão.md` na raiz do projeto e leia **só a linha `Status:`** de cada um.

- **Com o nome da pasta como argumento:** vá direto para ela.
- **Sem argumento, nenhuma com `Status:` «pronta para briefing»:** diga isso. Se houver alguma «em discussão», aponte o `/discutir-ideia-retomar`. Fim.
- **Sem argumento, uma ou mais prontas:** mostre a lista e **pergunte qual — mesmo quando só há uma**.

**Se a escolhida já tiver `Obra.md`, não sobrescreva.** Diga que o briefing já existe e aponte o `/discutir-ideia-melhorar-briefing` (para completar) ou o `/discutir-ideia-implementar` (para construir).

## Passo 2 — Conferir que a discussão fechou mesmo

Leia `Discussão/4 · Em aberto.md`. Se houver qualquer item 🟡 ou 🔴 fora de um `<details>`: **recuse**. Liste os itens no chat e mande para o `/discutir-ideia-retomar`, dizendo o motivo: pendência que entra no briefing faz o implementador parar e perguntar — e o briefing é final.

Itens 🧊 congelado e ❌ cancelado não são pendência.

## Passo 3 — Ler a discussão inteira

Nesta ordem:

| Ordem | Arquivo | Para quê |
|---|---|---|
| 1 | `Discussão.md` | o índice: onde está cada coisa |
| 2 | `Discussão/3 · Decidido.md` | o que construir, com o motivo |
| 3 | `Discussão/5 · Proibido.md` | o quadro ⛔ |
| 4 | `Discussão/2 · Terreno/` — todas as rodadas e `Arquivos que seriam mexidos.md` | os fatos: o arquivo e o trecho de cada coisa |
| 5 | `Discussão/1 · O que eu quero/` — todas as rodadas | as palavras do usuário: o sentido dos termos e o que ele espera ver |
| 6 | `Discussão/6 · Não entendi.md` | o que precisa ser dito com mais clareza na fase |

- **Nada dentro de um `<details>` é decisão ativa.** É material recolhido.
- **Item ❌ vai só para o quadro ⛔**, nunca para uma fase.
- **Número de linha citado na discussão é datado.** Ao escrever a fase, **abra o arquivo do projeto e copie o trecho de hoje** — não o trecho da discussão.
- **Não abra os HTML** (`Pauta`, `Resumo`, `Consulta`, explicações): tudo o que importa está nos `.md`.

## Passo 4 — Cortar as fases

**Poucas fases.** Cada fase custa ao usuário um `/clear` e um «continua». Por isso a obra só se divide quando **não dá** para fazer tudo de uma vez.

Uma fase **se verifica sozinha** — ao fim dela o programa continua funcionando e dá para testar — **e cabe numa janela de contexto com folga**.

**Fase nova só por um destes dois motivos:**

1. **Dependência real** — uma coisa precisa estar pronta para a outra poder ser feita.
2. **Volume** — tudo junto não caberia numa janela.

**Mudanças pequenas e independentes vão juntas, na mesma fase**, por mais numerosas que sejam.

| Caso | Fases |
|---|---|
| trocar uma palavra em 7 arquivos que não se tocam | 1 |
| reformular um arquivo grande + criar outro que depende dele | 2 |
| 15 assuntos grandes, alguns dependentes | quantas a dependência e o volume pedirem — e não uma por assunto |

O que **não** é critério:

| Critério | Por que não |
|---|---|
| por arquivo ou área tocada | uma fase pode deixar o programa quebrado no meio |
| por assunto da discussão | a ordem de execução raramente é a ordem em que se discutiu |
| por quantidade de mudanças | sete coisas pequenas são uma fase |

**Toda fase, a partir da 02, traz no topo a linha «Separada da anterior porque:»** com o motivo concreto — «depende de a 01 ter criado X» ou «01 + 02 juntas não cabem numa janela». **Se não der para escrever o motivo, as duas viram uma.** É essa linha que impede a regra de poucas fases de depender de boa vontade.

Discussão pequena tem uma fase só — e ainda assim tem `Obra.md` e `00 · Leia antes.md`.

## Passo 5 — Escrever o `Obra.md`

Na **raiz da discussão**, ao lado do `Discussão.md` — não dentro de `Briefing/`. É o placar da obra, e o usuário o abre com um clique.

```markdown
# Obra — {Assunto}

> **Como continuar:** a fase da vez é a **primeira ⬜** da tabela abaixo (ou a 🟡, se uma ficou pela metade — continue pelos `- [ ]` desmarcados dela).
> **Fase ✅ está pronta: não se refaz.** Leia `Briefing/00 · Leia antes.md` e depois **só** o arquivo da fase da vez.
> Marque cada `- [ ]` no arquivo da fase no momento em que termina a mudança; ao fim da fase, atualize esta tabela.
> Este arquivo é derivado dos carimbos e checkboxes das fases: se discordar delas, refaça-o a partir delas — e diga isso.

Estados: `⬜ falta` · `🟡 implementando` · `✅ implementado`.

| Fase | Estado | Depende de | Carimbo |
|---|---|---|---|
| 01 · {Fase} | ⬜ falta | — | — |
| 02 · {Fase} | ⬜ falta | 01 | — |

`Progresso: fase 0 de {M} · Próximo: 01 · {Fase}`

## Arquivos conferidos
| Arquivo | Conferido em | Bate com a fase? |
|---|---|---|

## O que ficou para trás
{só aparece quando houver algo: verificação que falhou, fato que mudou no código}
```

O «Como continuar» não é enfeite: quem abre o briefing sem o comando precisa saber, pelo próprio arquivo, que fase pronta não se refaz e que não se pergunta ao usuário em que fase está.

## Passo 6 — Escrever `Briefing/00 · Leia antes.md`

Vem antes de qualquer fase.

```markdown
# Leia antes — {Assunto}

## Como a obra anda — leia isto primeiro
- A fase da vez está no `Obra.md`, na raiz desta discussão: é a primeira ⬜ (ou a 🟡 — aí continue pelos `- [ ]` desmarcados).
- Fase ✅ está pronta: não se refaz, não se reconfere, não se pergunta ao usuário.
- Marque cada `- [ ]` → `- [x]` no momento em que termina aquela mudança, não no fim da fase.
- Uma fase por vez. Terminou, relate o que foi feito e o que não foi, e pare.
- Este briefing é final: siga-o sem perguntar se é para seguir. Só pare se o arquivo não bater com a fase (trecho não encontrado) — aí pergunte.
- Nunca abra `Discussão.md`, a pasta `Discussão/` nem os HTML. Tudo o que você precisa está nesta pasta.

## ⛔ PROIBIDO
{Tabela "Não faça" | "Por quê" | "Origem", com TUDO do `5 · Proibido.md` e os itens ❌ do
`3 · Decidido.md`. Vem logo depois do "Como a obra anda": com várias fases, uma proibição
escrita dentro da fase 01 é uma proibição que ninguém lê na fase 04.}

## ⚠️ Como ler as referências das fases
{Números de linha são datados: nunca editar por número, usar o trecho como busca, e se
não achar, PARAR E PERGUNTAR.}

## A ordem das fases
{Cada fase, o que ela entrega, de qual outra depende e por que ficou separada da anterior.}

## Os arquivos
{Tabela com todos os arquivos a mexer — criados, alterados, deletados —, vinda de
`2 · Terreno/Arquivos que seriam mexidos.md`, conferida no projeto.}
```

## Passo 7 — Escrever as fases `Briefing/NN · {Fase}.md`

Cada uma é um briefing inteiro.

```markdown
# {NN} · {Fase}

> **Implementado em:** ___ · **Depende de:** {fases} · **Separada da anterior porque:** {motivo — a partir da 02}

## O que esta fase entrega
{Uma frase. Ao fim dela o programa continua funcionando e dá para testar.}

## Mudanças
- [ ] **{arquivo}** — {o que muda, em uma frase}   (D3, D7)
      procurar: «{o trecho exato a buscar, copiado do arquivo HOJE}»
      fica:     «{o que fica no lugar, escrito por extenso}»
      por quê:  {uma linha}
- [ ] …

## Verificação desta fase
- [ ] {o que precisa estar verdadeiro quando ela terminar}
```

- **Cada mudança é um checkbox** — o implementador marca no momento em que termina cada uma. Se a janela morrer no meio, é isso que diz onde parou.
- **Cada mudança cita a D de origem.**
- **`procurar:` é o trecho de hoje**, aberto no arquivo do projeto. **`fica:` é por extenso** — «ajustar», «melhorar», «adaptar» não são instrução.
- **Termo próprio do usuário** usado numa mudança é explicado na própria fase, com as palavras dele.
- A fase é **grande e mastigada**: repete o que precisa. **Nunca manda abrir a discussão** e **nunca contém pendência**.

## Passo 8 — Rastreabilidade: endereço **e** conteúdo

Percorra `3 · Decidido.md`, D por D. Cada D ✅ tem de estar numa fase **ou** no quadro ⛔ (❌ só no ⛔). E o endereço não basta: a mudança que cita a D tem de levar **o que ela decide** — quem lê só a fase tem de conseguir executar sem a discussão. Uma D resumida em meia linha passa num teste de endereço e deixa o briefing pequeno.

**D sem endereço, ou com endereço mas sem conteúdo: o fechamento não termina.**

## Passo 9 — Carimbar e apontar o caminho

No `Discussão.md`: o `Status:` vira `fechada — obra em \`Obra.md\`` e a linha `Placar:` **sai** — nunca há dois placares vivos (o da discussão e o do `Obra.md`), porque é assim que um deles fica velho sem ninguém notar. Na linha «Quer implementar?» do cabeçalho, aponte o `Obra.md`.

Depois diga ao usuário, com todas as letras:

- o briefing está pronto, com {M} fases, e por que cada separação existe;
- **se quiser uma segunda passada:** `/clear` e `/discutir-ideia-melhorar-briefing {nome da pasta}`;
- **para construir:** `/clear` e `/discutir-ideia-implementar {nome da pasta}` — que continua sozinho da primeira fase que falta.

---

**Discussão a transformar em briefing:** $ARGUMENTS
