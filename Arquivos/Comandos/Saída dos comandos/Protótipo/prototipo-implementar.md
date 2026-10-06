---
description: Levar para o programa original as alterações feitas num PROTÓTIPO. Confere pela impressão digital que o original não mudou desde a cópia (se mudou, para), mostra o plano arquivo por arquivo e espera o ok, aplica só a diferença de cada arquivo (nunca sobrescreve o original inteiro), cria no lugar certo os arquivos novos, e nunca leva stub nem arranque. No fim, marca o protótipo como implementado e guarda a pasta.
argument-hint: (opcional) o nome da pasta do protótipo; sem argumento, lista os protótipos em trabalho e pergunta qual
---

# /prototipo-implementar — Levar o protótipo para o programa

> **A família Protótipo tem três comandos, e cada um funciona sozinho:**
>
> | Comando | Quando |
> |---|---|
> | `/prototipo-novo` | quer mexer numa parte do programa sem tocar no original; cria a pasta e a cópia mínima |
> | `/prototipo-retomar` | janela nova ou `/clear` no meio do trabalho; volta ao protótipo pelo nome da pasta |
> | `/prototipo-implementar` | o protótipo ficou como deve; leva as alterações para o original |

O usuário trabalhou isolado no protótipo, viu funcionando e ficou como ele queria. Agora as alterações vão para o programa. **Este é o único comando da família que escreve no original** — e escreve só as alterações.

Não há briefing nem discussão a reler: **o código da cópia é a especificação.** O que mudou está em «Mudanças» do `Objetivo.md`; para onde cada arquivo volta está na tabela do `Origem.md`.

> **Regras absolutas:**
> - **Só a diferença.** Cada arquivo do original recebe as alterações feitas na cópia, por edição pontual. **Nunca se substitui o arquivo original inteiro pela cópia** — mesmo que pareça equivalente: é assim que se apaga, sem ver, o que só existia no original.
> - **Stub e arranque nunca vão.** O stub é fingido; o arranque só serve ao protótipo. Levar qualquer um dos dois quebra o programa.
> - **Nunca mover nem renomear original.** Nem para «organizar» durante a volta.
> - **Fotografia que não bate, para.** Se o original mudou desde a cópia, nada se aplica nesse arquivo até o usuário dizer como seguir.
> - **Nada se aplica antes do ok ao plano.**

Este comando é **genérico** — roda em qualquer projeto. Se o projeto tiver arquitetura registrada (arquivo de instruções da raiz, bases de decisões, servidor MCP), use-a para decidir onde mora arquivo novo e para conferir quem usa o que foi mudado; se não tiver, siga sem — e nunca reclame da ausência.

## Passo 1 — Achar o protótipo

Procure por `Saída dos comandos/Protótipos/*/Objetivo.md` na raiz do projeto.

- **Com o nome da pasta como argumento:** vá direto para ela (aceite nome aproximado se só uma pasta bater).
- **Sem argumento:** liste os protótipos com a linha `Status:` e a `Parte do programa:` do cabeçalho de cada `Objetivo.md`, e **pergunte qual — mesmo quando só há um**.
- **Nenhum:** diga isso e aponte o `/prototipo-novo`. Fim.

Recuse, dizendo o motivo e o caminho:

| Situação | Por quê | Aponte |
|---|---|---|
| `Status:` `implementado em …` | já está no programa; aplicar de novo duplicaria | — |
| `Origem.md` com `Cópia: ainda não feita` | não há o que levar: a montagem não terminou | `/prototipo-retomar {Assunto}` |
| «Mudanças» vazio (`nenhuma ainda`) | nada foi alterado na cópia | `/prototipo-retomar {Assunto}` |

Leia inteiros o **`Origem.md`** e o **`Objetivo.md`**.

## Passo 2 — Conferir a fotografia

Recalcule o SHA-256 de cada original com `Volta? sim` e compare com a tabela do `Origem.md`.

| Resultado | O que fazer |
|---|---|
| todos batem | siga |
| algum não bate | **pare.** Liste os arquivos e diga que o original foi editado enquanto o protótipo estava aberto. Mostre, para cada um, o que mudou no original desde a cópia. **Não aplique nada** — nem nos arquivos que batem — até o usuário dizer como seguir |
| o original sumiu ou mudou de lugar | **pare** nesse arquivo e pergunte para onde ele vai |

Por que parar tudo, e não só no arquivo que não bate: uma feature costuma atravessar vários arquivos. Aplicar metade deixa o programa num estado que não é nem o antigo nem o novo.

## Passo 3 — Conferir a tabela contra a pasta

Antes do plano, confira que `Código/` e a tabela do `Origem.md` batem:

- arquivo em `Código/` **sem linha na tabela**: foi criado na cópia e não registrado — trate como `novo` e diga isso;
- linha na tabela **sem arquivo em `Código/`**: foi apagado na cópia — pergunte se a intenção é apagar também no original (nunca apague sem o sim dele).

## Passo 4 — Montar o plano e esperar o ok

Para cada linha da tabela:

| `Volta?` | O que o plano mostra |
|---|---|
| `sim` | a **diferença** entre a cópia e o original, arquivo por arquivo — o que entra, o que sai, o que muda. Arquivo sem diferença aparece como «sem alteração» e não é tocado |
| `novo` | o **caminho onde vai ser criado** no original — o correspondente ao caminho em `Código/`. Se o projeto tiver arquitetura registrada e ela disser que aquele tipo de arquivo mora noutro lugar, mostre as duas opções e recomende a da arquitetura |
| `stub — não volta` · `arranque — não volta` · `não volta — só apoio` | listados juntos, como «não vai» |

**Confira os efeitos fora do protótipo.** Se uma alteração muda a assinatura de uma função, o nome de um ID, uma rota ou qualquer coisa que outros arquivos do programa usem — arquivos que **não** foram copiados —, esses arquivos vão quebrar quando a mudança chegar. Liste-os no plano, com o que precisaria mudar em cada um. Eles só são tocados se o usuário aprovar, e cada um entra no relatório final.

Mostre também, em uma linha cada, as entradas de «Mudanças» do `Objetivo.md` — é o que o usuário reconhece como «o que eu fiz».

**Não aplique nada antes do «ok».** Se ele quiser deixar algum arquivo de fora, tire do plano e mostre de novo.

## Passo 5 — Aplicar

Na ordem do plano:

- **`sim`:** aplique no original só as alterações, por edição pontual — trecho por trecho, usando o texto do original como âncora. **Nunca** copie o arquivo da cópia por cima do original.
- **`novo`:** crie no caminho aprovado, com o conteúdo da cópia.
- **Arquivos de fora aprovados no plano:** faça o ajuste mínimo descrito no plano.
- **Stub, arranque e só-apoio:** nunca.
- **Nunca mova nem renomeie original.**

Se um trecho do original não bater com o que o plano esperava (o texto de âncora não foi achado), **pare nesse arquivo e pergunte** — não adivinhe.

## Passo 6 — Verificar

Depois de aplicar:

1. **Confira cada arquivo `sim`:** o conteúdo da parte alterada no original tem de ficar igual ao da cópia — a não ser pelo que dependia de stub (import de configuração real no lugar do fingido, por exemplo).
2. **Rode o programa de verdade**, se for possível, e abra a parte: ela tem de ter a mesma função que tinha no protótipo. Se não der para você rodar, peça ao usuário para abrir e contar o que viu.
3. Se algo não funcionar no programa e funcionava no protótipo, a diferença costuma estar num stub que escondia uma dependência real. Corrija no original só o necessário para a mudança funcionar, e diga o que corrigiu.

## Passo 7 — Fechar

1. No `Objetivo.md`, o `Status:` vira **`implementado em {data}`**, e a `Última atualização:` vira a data de hoje.
2. No fim do `Objetivo.md`, acrescente uma seção curta:

   ```markdown
   ## Implementação
   {data} · aplicados: {n} arquivos · criados: {n} · fora do protótipo ajustados: {n}
   - `{arquivo}` — {aplicado | criado | ajustado fora do protótipo}
   ```

3. A pasta do protótipo **fica guardada** — não se apaga. Ela é o registro do que foi feito e de onde veio.
4. Diga ao usuário:
   - o que foi aplicado, arquivo por arquivo;
   - o que não foi, e por quê (stubs, arranque, algo que ele tirou do plano);
   - o que foi ajustado fora do protótipo;
   - o resultado da verificação;
   - que **o original está liberado para edição**.
