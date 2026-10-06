---
name: regras-e-instrucoes
description: Guarda como este projeto se faz — regras curtas que valem sempre e receitas (instruções) de como construir o que se repete — em "Saída das skills/Regras e instruções/". Use SEMPRE antes de escrever ou alterar código: leia o índice, todas as regras, e a receita que bater com a tarefa, e construa a partir dela. Use também depois de construir algo que pode se repetir, para registrar a receita, e quando o usuário disser "sempre faça X", "nunca faça Y", "daqui pra frente é assim". Esta skill não pede confirmação para gravar: grava e avisa.
---

# Regras e instruções — como este projeto se faz

Esta skill existe para resolver um problema específico: a segunda aba de chat com subagente sai diferente da primeira, porque a IA não lembra como fez a primeira — e refaz do zero o que era só copiar e trocar nome e prompt. As outras bases dizem **onde** um arquivo fica, **como** a tela parece e **como** as coisas se chamam; esta diz **como se faz aqui**. E ela só serve se for lida antes de construir e escrita sem cerimônia depois.

`Saída das skills/` é uma pasta comum, compartilhada com outras bases — se já existir, não recrie; apenas crie `Regras e instruções/` dentro dela.

## A forma da base

```
Saída das skills/Regras e instruções/
├── Índice.md                             ← gerado a cada escrita, nunca editado à mão
├── {Nome da regra}/                      ← REGRA: a pasta tem UM arquivo
│   └── {Nome da regra}.md                ← Descrição · Quando se aplica · Regra
└── {Nome da instrução}/                  ← INSTRUÇÃO (receita): o principal mais o apoio
    ├── {Nome da instrução}.md            ← Descrição · Quando se aplica · O que cobre · Arquivos
    ├── Como aplicar.md                   ← de onde copiar · o que trocar · onde registrar · como conferir
    └── Exceções.md                       ← só se houver
```

**O principal tem o nome da pasta.** **O tipo é a forma:** pasta com um arquivo só é regra; pasta com o principal mais apoio é instrução. Não há subpastas por tipo — é o índice que separa os dois para quem lê.

> Projetos criados antes desta versão da skill têm as subpastas `Regras/` e `Instruções/`, e a instrução usa `Resumo.md` como principal. Até serem migrados, **escreva no formato que a pasta já usa** — não misture os dois.

### Regra × instrução — o critério

| | Regra | Instrução (receita) |
|---|---|---|
| Responde a | "o que eu **nunca/sempre** quero" | "**como** se faz isso aqui" |
| Vale quando | o tempo todo | só quando se está fazendo *aquilo* |
| Tamanho | curta — cabe em cinco linhas | longa — passo a passo, de onde copiar, o que trocar |
| No disco | uma pasta com um arquivo | uma pasta com o principal e `Como aplicar.md` |

Não é estética, é **economia de contexto**: o que é curto e vale sempre cabe em toda tarefa; o que é longo e vale às vezes entra só quando a tarefa pede.

## Fase 1 — Consulta (antes de escrever ou alterar código)

1. Leia `Saída das skills/Regras e instruções/Índice.md`. Se não existir, a base não existe ainda: crie a pasta com um `Índice.md` vazio (só o título e as duas listas vazias) e siga.
2. Leia **todas** as regras — são curtas, e valem sempre.
3. Procure no índice a instrução cujo *Quando se aplica* bate com a tarefa. Se houver, abra o principal dela e o `Como aplicar.md`, e **construa a partir da receita**: copie de onde ela manda, troque o que ela manda, registre onde ela manda, confira como ela manda. **Não invente o que já tem receita** — a segunda aba sai da primeira.
4. Se a tarefa conflitar com uma regra, avise o usuário antes de implementar, em vez de silenciosamente desobedecer.

## Fase 2 — Registro (depois de construir; automático)

Registre o que é **relevante para continuar o desenvolvimento** — não o que foi feito, não o que se aprendeu. **Escreva sem pedir confirmação e avise em uma linha** ("registrei a receita *Aba de chat com subagente*"). Se saiu errado, o usuário diz "tira" e você apaga — a gravação é barata, a cerimônia não.

**Quando escrever uma receita (instrução):** o que foi construído **pode se repetir** —
- é o **segundo do mesmo tipo** (segunda aba, segunda rotina, segundo plugin, segundo comando de menu); na primeira, registre se o usuário disser que vai haver mais;
- tem um jeito **não óbvio** de fazer (precisa registrar em três lugares; depende de uma ordem; tem um detalhe que só quem fez sabe);
- o usuário disse "vai ter mais dessas".

**Quando escrever uma regra:** o usuário disse "sempre", "nunca", "daqui pra frente"; ou corrigiu a mesma coisa pela segunda vez.

**Como escrever:** antes de gravar, veja no índice se já existe item parecido — refine em vez de duplicar. Sugira **um** nome (o usuário pode trocar). Grave. Regenere o `Índice.md` inteiro. Avise.

## Modo explícito — quando o usuário pede para registrar

"Registra isso", "sempre confirme antes de deletar", "anota como se faz um modal aqui": é a Fase 2 disparada pela fala. Mesmo comportamento: decida se é regra ou receita, diga qual, grave, regenere o índice, avise. **Não existe modo varredura:** a skill não sai procurando o que deveria registrar; ela registra o que a tarefa produziu ou o que o usuário disse.

## O que entra na base, em que tamanho

**O filtro.** Entra só o que muda uma decisão futura de construção: uma proibição ou obrigação que vale sempre; uma receita de algo que se repete. Não entra: a história de como se decidiu (mora na discussão de origem, citada), nota de implementação avulsa, trecho de código solto, o relato do que a sessão fez.

**O teto.** A regra cabe em cinco linhas — título · Descrição (uma frase) · Quando se aplica (uma frase) · Regra (uma a três frases) · Origem (data e discussão, quando houver). O principal da receita tem o mesmo teto; o passo a passo mora em `Como aplicar.md`, que é longo por natureza — mas é receita, não diário.

## Formato de uma regra — `{Nome}/{Nome}.md`

Três seções fixas, nesta ordem, sem inventar campo:

```markdown
# Confirmar antes de deletar

## Descrição
Nada é apagado sem uma pergunta antes.

## Quando se aplica
Sempre que a tarefa envolver remover arquivo, registro ou pasta.

## Regra
Antes de qualquer remoção, mostre o que será apagado e espere confirmação explícita.
Vale para arquivos no disco, registros no banco, branches e pastas de build. Não vale para temporários da própria execução.
Origem: 2026-08-05 · discussão "Limpeza de backups"
```

`## Quando se aplica` é **uma frase, não um parágrafo** — é ela que vai para o `Índice.md`.

## Formato de uma receita — `{Nome}/{Nome}.md` + `Como aplicar.md`

O principal:

```markdown
# Aba de chat com subagente

## Descrição
Uma aba que conversa com um subagente próprio, com prompt e nome próprios — o mesmo esqueleto para todas.

## Quando se aplica
Ao criar qualquer aba nova de chat com subagente, ou ao mexer numa existente.

## O que esta receita cobre
- os arquivos que compõem a aba e de qual aba copiar
- o que trocar (nome, id, prompt) e o que nunca trocar
- onde registrar a aba nova (menu, lista de abas, índice de prompts)

## Arquivos
- `Como aplicar.md` — o passo a passo
```

O `Como aplicar.md` é markdown livre com `# Título` na primeira linha, e quatro partes, sempre: **de onde copiar** (arquivos, com caminho), **o que trocar** (nome, ids, prompt — e o que não trocar), **onde registrar** (menus, listas, índices, testes), **como conferir** que ficou igual à original. `Exceções.md` só se houver caso em que a receita não vale.

## O `Índice.md` — regenerado inteiro a cada gravação

```markdown
# Regras e instruções deste projeto

> Gerado automaticamente. Não edite à mão — a skill regenera este arquivo a cada gravação.

## Regras
Valem sempre. São curtas: leia todas antes de escrever código.

- **Confirmar antes de deletar** — Sempre que a tarefa envolver remover arquivo, registro ou pasta.

## Instruções
Valem na hora certa. Leia o principal primeiro; abra `Como aplicar.md` quando for construir.

- **Aba de chat com subagente** — Ao criar qualquer aba nova de chat com subagente, ou ao mexer numa existente.
  · `Aba de chat com subagente.md` · `Como aplicar.md`
```

A frase de cada linha é a seção `## Quando se aplica` do principal. **Índice errado é pior que índice nenhum**, porque quem lê confia nele e não abre o arquivo certo — por isso ele é regravado inteiro, nunca editado em pedaços.

## Convenção de nomenclatura (da própria base)

- Pasta principal: `Regras e instruções` (só o "R" maiúsculo).
- Pasta de cada item: o nome do item em linguagem natural, com maiúscula inicial, acento e espaço (`Confirmar antes de deletar/`). O principal tem exatamente o mesmo nome, com `.md`.
- `Índice.md`, `Como aplicar.md`, `Exceções.md`: fixos.

## Ao terminar uma gravação

Diga, em uma linha: **o que foi gravado, de que tipo, e em qual pasta.** Se o usuário quiser levar essa decisão para outros projetos, ele copia a pasta do item para `Arquivos/Regras e instruções/` da biblioteca do Assistente — é cópia manual, dele.
