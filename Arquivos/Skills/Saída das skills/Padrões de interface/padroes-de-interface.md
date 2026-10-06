---
name: padroes-de-interface
description: Mantém a consistência visual e comportamental da interface do projeto, consultando e atualizando a base de conhecimento em "Saída das skills/Padrões de interface/" (identidade visual, componentes, estrutura das telas, comportamentos, convenções e exceções). Use SEMPRE antes de criar ou modificar qualquer tela, componente, cor, espaçamento, fonte ou comportamento de UI — mesmo que o usuário não peça explicitamente para "seguir o padrão". Use também sempre que o usuário disser algo do tipo "sempre faça X", "nunca faça Y", "essa tela ficou diferente das outras", ou quando ele pedir para registrar uma convenção, uma exceção, um novo componente ou um novo padrão. Não use para lógica de backend/negócio sem relação com UI.
---

# Padrões de interface

Essa skill existe para resolver um problema específico: você fica repetindo as mesmas correções de UI (cores erradas, abas com fundo diferente, comportamentos inconsistentes) porque a IA não tem memória entre tarefas. Esta skill dá a ela essa memória, organizada em uma base de conhecimento indexada dentro da pasta `Saída das skills/Padrões de interface/` na raiz do repositório.

`Saída das skills/` é uma pasta comum, compartilhada com outras bases — se ela já existir, não recrie; apenas crie `Padrões de interface/` dentro dela.

Ela funciona em **duas fases**: Consulta (antes de mexer em qualquer UI) e Atualização (depois de implementar).

## Estrutura da base de conhecimento

```
Saída das skills/Padrões de interface/
├── Índice geral.md              ← ponto de entrada, leia sempre primeiro
├── Identidade visual.md        ← cores, tipografia, espaçamentos, raios, sombras, ícones, animações (arquivo único)
├── Estrutura das telas/         ← um arquivo .md por tela/skeleton (pasta, cresce com o tempo)
│   └── Índice - Estrutura das telas.md
├── Componentes/                ← um arquivo .md por componente (pasta, cresce com o tempo)
│   └── Índice - Componentes.md
├── Comportamentos/             ← um arquivo .md por comportamento (loading, notificações, erros...) (pasta, cresce com o tempo)
│   └── Índice - Comportamentos.md
├── Convenções.md               ← regras gerais do projeto (arquivo único)
└── Exceções.md                 ← regras que substituem convenções em casos específicos (arquivo único)
(qualquer arquivo único acima de ~20 KB vira pasta com índice — ver "O que entra na base")
```

Se `Saída das skills/Padrões de interface/` não existir ainda no repositório, abra `configuracao-inicial.md` (nesta mesma pasta da skill) e crie os 8 arquivos exatamente como ele descreve; avise o usuário que a estrutura foi criada.

### Por que essa organização
- Tudo que for **pequeno e não cresce** (identidade visual, convenções, exceções) fica em **arquivo único**.
- Tudo que **naturalmente escala** (telas, componentes, comportamentos) vira **pasta**, com seu próprio `Índice - [Nome da pasta].md` interno (ex: `Componentes/Índice - Componentes.md`).
- O `Índice geral.md` da raiz é um mapa de dois níveis: para os arquivos únicos ele aponta direto para o conteúdo; para as pastas ele não lista cada item — só indica que a pasta existe e direciona para o índice interno dela. Isso mantém o índice geral pequeno mesmo quando `Componentes/`, `Comportamentos/` e `Estrutura das telas/` crescerem para dezenas de arquivos.
- Cada índice tem um resumo curto de cada item, para que você leia o mínimo possível e ache a informação certa com precisão — nunca leia a base inteira de uma vez.

## Fase 1 — Consulta (antes de qualquer alteração de UI)

Sempre que for criar ou alterar qualquer tela, componente, cor, espaçamento, fonte ou comportamento:

1. Leia `Saída das skills/Padrões de interface/Índice geral.md`.
2. A partir dos resumos do índice, identifique quais documentos são relevantes para a tarefa (não leia tudo). Se `Convenções.md` ou `Exceções.md` já viraram pasta, leia o índice da pasta e abra só os temas da tarefa.
3. Siga esta ordem de prioridade ao aplicar as regras, porque uma camada mais específica pode sobrepor uma mais geral:
   1. **Exceções.md** — regra específica para esta tela/caso vence qualquer regra geral.
   2. **Convenções.md** — regras gerais do projeto.
   3. **Componentes/** — como o componente específico deve se comportar.
   4. **Estrutura das telas/** — como a tela deve ser organizada (consulte `Estrutura das telas/Índice - Estrutura das telas.md` para achar a tela/skeleton específico).
   5. **Comportamentos/** — loading, notificações, erros, navegação etc.
   6. **Identidade visual.md** — tokens visuais (cores, fontes, espaçamentos) a aplicar por cima de tudo isso.
4. Nunca use cores, fontes, espaçamentos ou raios "hardcoded" direto no código. Sempre use os tokens definidos em `Identidade visual.md` (ex: variável/tema `primary`, `background`, `surface`, `textPrimary` etc.). Se um token necessário não existir, proponha adicioná-lo em vez de inventar um valor novo.
5. Reutilize componentes existentes antes de criar um novo. Uma nova aba/tela deve seguir exatamente o estilo das já existentes (mesmo fundo, mesmas margens, mesmo header, mesmo componente-base) a menos que uma exceção diga o contrário.
6. Se a solicitação do usuário conflitar com uma convenção ou exceção documentada, avise o usuário sobre o conflito antes de implementar, em vez de silenciosamente ignorar a documentação.
7. **Antes de entregar, confira o que escreveu contra o arquivo do componente ou da tela** (tokens, raio, espaçamento, ordem dos botões, comportamento). O desvio que passa aqui é o que o usuário vê depois como "ficou diferente das outras".

## Fase 2 — Atualização (depois de implementar)

Depois de qualquer alteração de UI, registre o que é **relevante para continuar o desenvolvimento** — não o que foi feito, não o que se aprendeu. Duas coisas são obrigatórias, não opcionais: **toda tela nova ganha o arquivo dela em `Estrutura das telas/`** e **todo componente novo ganha o arquivo dele em `Componentes/`**, no mesmo passo em que nascem, mais a entrada no índice da pasta. Sem arquivo, a próxima sessão não tem o que consultar — e é assim que a tela seguinte sai diferente.

Árvore de decisão de onde documentar:

| O que surgiu | Onde registrar |
|---|---|
| Nova cor, fonte, espaçamento, raio, sombra, ícone ou animação | `Identidade visual.md` |
| Novo componente reutilizável | `Componentes/NomeDoComponente.md` (+ entrada no `Componentes/Índice - Componentes.md`) |
| Nova tela ou novo skeleton de tela | `Estrutura das telas/NomeDaTela.md` (+ entrada no `Estrutura das telas/Índice - Estrutura das telas.md`) |
| Novo comportamento reutilizável (loading, notificação, etc.) | `Comportamentos/NomeDoComportamento.md` (+ entrada no `Comportamentos/Índice - Comportamentos.md`) |
| Regra geral válida para o projeto inteiro | `Convenções.md` |
| Regra válida só para um caso/tela específica | `Exceções.md` |

Regras ao atualizar:
- **Nunca duplique conhecimento.** Se já existe `Componentes/Botão.md`, não copie a descrição dele para `Convenções.md`; em vez disso, referencie: "Botões de ação principal seguem o padrão definido em `Componentes/Botão.md`."
- Ao criar ou atualizar um arquivo dentro de `Componentes/`, `Comportamentos/` ou `Estrutura das telas/`, sempre atualize o `Índice - [Nome da pasta].md` daquela pasta também.
- Ao adicionar algo em `Identidade visual.md`, `Convenções.md` ou `Exceções.md`, atualize também o resumo correspondente no `Saída das skills/Padrões de interface/Índice geral.md` se a mudança for significativa (ex: uma seção nova).
- Antes de adicionar uma convenção ou exceção, verifique se ela já existe (mesmo com outras palavras) para não duplicar. Se existir algo parecido, refine o item existente em vez de criar um novo.
- Reorganize e remova duplicatas quando perceber inconsistência, mantendo os arquivos sempre organizados.

## Modo: configurar

A Fase 2 acima é automática — dispara sozinha depois de você implementar algo. Mas o usuário também pode pedir diretamente, em linguagem natural, pra registrar uma convenção ou exceção sem que isso venha de uma implementação recém-feita (ex: "sempre use X", "nunca faça Y", "essa tela é uma exceção porque..."). Quando isso acontecer, execute apenas este modo.

**O que faz:** atualiza `Convenções.md` ou `Exceções.md` em `Saída das skills/Padrões de interface/` com o que o usuário descrever.

**Passos:**

1. Leia o conteúdo atual de `Convenções.md` e `Exceções.md` e mostre um resumo ao usuário.
2. Identifique se o que foi pedido é uma regra geral do projeto (`Convenções.md`) ou um desvio de um caso específico (`Exceções.md`). Se não estiver claro, pergunte.
3. Antes de adicionar, verifique se já existe algo parecido (mesmo com outras palavras); se existir, refine o item existente em vez de duplicar.
4. Aplique a alteração, no formato de cinco linhas, e mostre o resultado.
5. Se a mudança for significativa, atualize também o resumo correspondente em `Índice geral.md`.
6. Pergunte se quer mais alguma alteração. Repita até o usuário confirmar que terminou.

## O que entra na base, em que tamanho, e o que fazer quando ela cresce

**O filtro — o que NÃO entra.** A base guarda só o que muda uma decisão futura de interface: um token, uma regra visual, um comportamento, uma exceção, a estrutura de uma tela ou de um componente. Não entra: a história de como se decidiu (ela mora na discussão de origem, que a base cita), nota de implementação, trecho de código, descrição de tela para fins de documentação, o que "ficou bonito". Registrar é escolher — não é despejar o que a sessão fez.

**O teto — cinco linhas por registro.** Uma convenção ou exceção tem este molde, e o excedente não cabe: vai para a discussão de origem, citada na última linha.

```
## Barra de ação abaixo de caixa com fundo próprio          ← o que é
Regra: a barra fica fora da caixa, alinhada à direita         ← a regra (ou a exceção)
Vale em: toda caixa com fundo próprio (cards, painéis)         ← onde vale
Por quê: dentro da caixa a barra briga com o conteúdo          ← UMA linha
Origem: 2026-08-20 · discussão "Aparência das configurações"   ← onde está o resto
```

Componente e tela (os arquivos de `Componentes/` e `Estrutura das telas/`) podem ser mais longos — são descrição de estrutura, não de história —, mas seguem o filtro: o que é, como se compõe, como se comporta; nunca por que foi decidido nem como foi implementado.

**O transbordo — quando mesmo assim cresce.** Um arquivo único desta base (`Convenções.md`, `Exceções.md`, `Identidade visual.md`) que passar de **~20 KB** vira pasta com o mesmo nome: `Convenções/Índice - Convenções.md` (uma linha por tema: o que cobre · quando abrir) mais um arquivo por tema (`Cores e tokens.md`, `Abas e navegação.md`, `Botões e ações.md`, `Mapas e desenho.md`, …). A partir daí a Fase 1 lê **o índice** e abre **só os temas da tarefa**. Projeto pequeno nunca chega ao transbordo. A regra vale também para bases que cresceram antes desta versão da skill: ao encontrar um arquivo acima do limite, proponha ao usuário reparti-lo — e não faça sem ele.

## Formato dos índices

Cada índice (o `Índice geral.md` e os das pastas `Estrutura das telas/`, `Componentes/` e `Comportamentos/`) segue este formato por item, para permitir busca rápida e precisa:

```markdown
### NomeDoArquivo.md
Resumo: descrição curta de uma linha sobre o que o arquivo define.
Palavras-chave: termos que ajudam a achar esse arquivo mesmo sem a palavra exata.
Quando consultar: em que situação a IA deve abrir este arquivo.
```

## Convenção de nomenclatura

- Pasta principal: `Padrões de interface` (só o "P" de Padrões maiúsculo).
- Arquivos/pastas de primeiro nível: primeira letra maiúscula (`Identidade visual.md`, `Estrutura das telas/`, `Componentes/`, `Comportamentos/`, `Convenções.md`, `Exceções.md`). O resto do nome em minúsculo, com acentuação normal.
- Arquivos dentro de `Componentes/`, `Comportamentos/` e `Estrutura das telas/`: nome descritivo do item, com a primeira letra maiúscula (ex: `Botão primário.md`, `Carregamento.md`, `Dashboard.md`).
