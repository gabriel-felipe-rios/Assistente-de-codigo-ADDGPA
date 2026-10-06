---
description: CONSTRUIR o que já foi decidido numa discussão fechada — executa UMA FASE POR VEZ a partir do Obra.md e da pasta Briefing/, continuando sozinho da primeira fase que falta (fase pronta não se refaz), marcando cada mudança no momento em que a faz, sem rediscutir nada. Exige que a discussão tenha Obra.md; se não tiver, aponta o /discutir-ideia-gerar-briefing ou o /discutir-ideia-retomar. Use numa janela nova ou depois de /clear.
argument-hint: (opcional — o nome da pasta da discussão, e opcionalmente o número da fase; sem argumento, ele lista as que têm briefing e pergunta qual)
---

# /discutir-ideia-implementar — Construir o que já foi decidido, uma fase por vez

> **A família Discutir ideia tem cinco comandos, e cada um funciona sozinho:**
>
> | Comando | Quando |
> |---|---|
> | `/discutir-ideia-nova` | a ideia ainda não tem forma; começa a discussão |
> | `/discutir-ideia-retomar` | janela nova ou `/clear` no meio da discussão; continua decidindo |
> | `/discutir-ideia-gerar-briefing` | a discussão está «pronta para briefing»; numa janela limpa, lê a discussão inteira e escreve `Briefing/` e `Obra.md` |
> | `/discutir-ideia-melhorar-briefing` | opcional; numa janela limpa, completa o briefing até dizer «nada a acrescentar» |
> | `/discutir-ideia-implementar` | existe `Obra.md`; constrói uma fase por vez, continuando sozinho da primeira que falta |

Uma discussão fechada deixou no disco o `Obra.md` — o placar da obra — e a pasta `Briefing/`: as proibições e a obra fatiada em fases, cada uma um briefing inteiro. **Este comando executa essas fases.**

Na mesma janela, logo depois de o briefing ser gerado, você não precisa dele: basta falar. Ele existe para o dia seguinte — ou para depois de um `/clear` no meio da obra — quando o contexto se perdeu. **O usuário não precisa dizer em que fase parou:** o `Obra.md` diz.

> **Regra absoluta 1: este comando não discute.**
> Ele não reabre decisão, não propõe alternativa melhor, não "aproveita para" arrumar outra coisa. **O briefing é final: siga-o, sem perguntar se é para seguir.** A única razão para parar é o código não bater com a fase — trecho não encontrado, fato que mudou (Passo 3).
>
> **Regra absoluta 2: este comando NUNCA abre o `Discussão.md`, nada da pasta `Discussão/`, nem `Pauta.html`, `Resumo.html` ou `Consulta.html`.**
> A discussão guarda o registro completo, **inclusive o que foi descartado** e recomendações antigas que foram substituídas. Lê-la aqui é a forma mais fácil de reimplementar algo que foi deliberadamente jogado fora. Se faltar informação para executar, **volte ao usuário, não ao registro**.
>
> A contrapartida das duas: **você pode escrever código aqui.** É o único dos cinco comandos que pode. Por isso a disciplina precisa vir da sua parte, não da falta de ferramenta.

## Os arquivos, e o que este comando enxerga deles

```
Saída dos comandos/Discussões/{Assunto}/
├── Obra.md           1º: a fase da vez (a primeira ⬜), o que já foi feito, o que ficou para trás
├── Discussão.md      ⛔ NUNCA ABRIR — só para carimbar o Status no fim
├── Discussão/        ⛔ NUNCA ABRIR
├── Pauta.html · Resumo.html · Consulta.html     não abre
└── Briefing/
    ├── 00 · Leia antes.md   2º: como a obra anda e as proibições
    └── NN · {Fase}.md       3º: SÓ a fase da vez
```

## Passo 1 — Achar a obra

Procure por `Saída dos comandos/Discussões/*/Obra.md` na raiz do projeto.

- **Com o nome da pasta como argumento:** vá direto, sem perguntar nada. A fase da vez é a primeira ⬜ do `Obra.md` (ou a 🟡). Se a pasta não tiver `Obra.md`, diga isso e pare — **não improvise fases a partir da discussão**.
- **Sem argumento, nenhum `Obra.md`:** diga que **nenhum briefing foi gerado e não dá para implementar**. Se houver discussão com `Status:` «pronta para briefing», aponte o `/discutir-ideia-gerar-briefing`; se «em discussão», o `/discutir-ideia-retomar`. **Fim — não implemente nada.**
- **Sem argumento, um ou mais `Obra.md`:** monte a tabela e **pergunte qual implementar — mesmo quando só há um**.

| Discussão | Progresso | Estado | Última fase carimbada |
|---|---|---|---|
| {nome da subpasta} | fase {n} de {N} | pronta / em obra / **implementada** | {data} |

Se o usuário passou também um número de fase, é essa a fase da vez — mas **confira no `Obra.md`** se as anteriores estão ✅. Se não estiverem, avise antes de seguir: a fase pode depender delas.

## Passo 2 — Ler o `Obra.md`, o leia-antes, e SÓ a fase da vez

Nesta ordem:

1. **`Obra.md`** (na raiz da discussão) — a fase da vez é a **primeira ⬜** (ou a 🟡, continuando pelos `- [ ]` desmarcados). **Fase ✅ está pronta: não se relê, não se refaz, não se pergunta ao usuário.**
2. **`Briefing/00 · Leia antes.md`** — inteiro. **O quadro ⛔ PROIBIDO é a parte mais importante da pasta.** Cada linha é uma decisão deliberada; "consertar" qualquer uma delas desfaz o trabalho da discussão inteira. Leia antes de tudo e **releia antes de qualquer mudança que não esteja escrita na fase**.
3. **`Briefing/NN · {Fase}.md`** — **só a fase da vez.** Não leia as outras.

**O `Obra.md` é derivado das fases.** Antes de confiar nele, compare: o estado de cada fase bate com o carimbo `Implementado em:` e com os checkboxes do arquivo da fase? Se não bater, **refaça o `Obra.md` a partir das fases** e diga isso ao usuário — o arquivo da fase é a verdade; o `Obra.md` é o resumo.

## Passo 3 — Reconferir os fatos no código ANTES de tocar em nada — e registrar

**Este passo não se pula, mesmo que a fase pareça clara e recente.**

Entre gerar o briefing e implementar podem ter passado dias — e mais ainda entre uma fase e a seguinte. O usuário mexe no código entre as sessões. Para cada fato de que a fase depende — um arquivo existir, uma função se chamar assim, um trecho estar naquele formato — **abra e confira**, e **registre na tabela `Arquivos conferidos` do `Obra.md`**: `arquivo · data · bate com a fase?`. Se a janela morrer depois disso, a próxima sessão sabe o que já foi conferido.

- **Número de linha da fase é datado.** Use o trecho citado como **texto de busca**, nunca o número.
- **Não encontrou o trecho?** Pare e pergunte. Não adivinhe qual linha "provavelmente" era, e não edite por aproximação.
- **Achou o fato desatualizado?** Diga ao usuário o que mudou e o que isso implica, **antes** de seguir, e anote em `O que ficou para trás`. Se a obra mudar de tamanho ou de forma por causa disso, a decisão é dele: pergunte o que fazer.

Este passo existe porque erro de fato velho é **invisível**: nada dá mensagem de erro quando se implementa a coisa certa no lugar errado, ou quando se constrói algo que já estava pronto.

## Passo 4 — Executar UMA fase, marcando conforme faz

1. **Marque a fase como `🟡 implementando`** no `Obra.md`, antes de começar. Se a sessão morrer no meio, é isso que conta a história.
2. **Execute a fase** na ordem em que ela apresenta as mudanças. **Marque cada `- [ ]` → `- [x]` no momento em que termina aquela mudança** — não no fim da fase. Uma sessão que cair no meio deixa exatamente o registro de onde parou.
3. **Rode a verificação da fase.** Ela está no fim do arquivo da fase e é própria da fatia. Se algum item não passar, conserte antes de dizer que acabou.
4. **Carimbe a data** no `Implementado em:` do arquivo da fase.
5. **Atualize o `Obra.md`:** a fase vira `✅ implementado`, o progresso avança, o ponteiro passa para a próxima. Se algo ficou para trás — item pulado, verificação que falhou, fato desatualizado —, escreva no bloco **`O que ficou para trás`**. Se não ficou nada, o bloco não aparece.
6. **Relate o que foi feito** — e, com a mesma clareza, **o que não foi**. Obra parcial relatada como completa é o pior resultado possível deste comando.
7. **Pare e pergunte se continua para a próxima fase.** Não emende.

> **Por que uma fase por vez:** se a obra foi fatiada, é porque ela não cabia numa janela de contexto, ou porque uma parte precisava estar pronta antes da outra. Emendar as fases anula o motivo de ter fatiado — e a fase seguinte passa a ser executada por um contexto já cheio do que aconteceu na anterior.

**Os três estados do `Obra.md`**, e só estes: `⬜ falta` · `🟡 implementando` · `✅ implementado`. Os cinco símbolos da discussão (✅🔴🟡🧊❌) **não valem aqui** — obra pendente não é decisão pendente.

## Passo 5 — Ao terminar a última fase

Quando todas as fases estiverem `✅`:

1. Confira o bloco **`O que ficou para trás`** do `Obra.md`. Se ele tiver alguma coisa, **releia com o usuário** antes de declarar a obra completa.
2. **Atualize o `Status:` do cabeçalho do `Discussão.md`** para `implementada em {data}`. É a única linha que este comando toca nele — **não leia o resto, não mexa em mais nada**.

## Sem `Obra.md`, não há o que implementar

Se a discussão ainda está em conversa, o comando é `/discutir-ideia-retomar`; se está «pronta para briefing», é `/discutir-ideia-gerar-briefing`. O teste é simples: **existe `Obra.md` na pasta da discussão?** Se não existe, não há o que implementar.

---

**Discussão a implementar:** $ARGUMENTS
