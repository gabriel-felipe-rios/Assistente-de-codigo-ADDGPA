# Trabalhos

Servidor MCP que expõe ao **assistente externo** — Claude Code, Cursor, Antigravity —
as ações do Quadro de atividades: criar, mover de coluna, marcar tarefas, anotar
e chamar o usuário quando algo foge do combinado. É o orquestrador de um
terminal falando com o mesmo Quadro que aparece na aba Trabalhos do app.

> **Status:** implementado e funcionando. O servidor é `Program/Code/server/trabalhos/servidor.py` (stdio, Python puro).
> Ativar pela aba **Arquivos → MCPs** grava o `.mcp.json` na raiz do projeto; as ferramentas aparecem quando
> você abre uma sessão **nova** do Claude Code na pasta do projeto (reabrir a mesma sessão não reconecta).
>
> Este é um dos dois servidores MCP do programa — o outro é o **Assistente**
> (`Arquivos/MCPs/Assistente/`), que expõe as consultas de código/navegação. Os
> dois ligam e desligam independente um do outro: um projeto que só usa o
> Quadro não precisa confiar as 19 ferramentas de leitura de código junto.

---

## Por que existe

Um terminal do Claude Code trabalhando numa atividade precisa registrar o que
está fazendo no mesmo Quadro que o usuário vê na aba Trabalhos — criar a
atividade, mover de coluna, marcar tarefas, e parar para chamar o usuário
quando bate um bloqueio. Sem isso, o estado do Quadro e o que o terminal está
fazendo de fato divergem, e alguém precisa ficar copiando manualmente.

---

## Ferramentas

8 ferramentas, todas de **escrita** no `Estado.json` da aba Trabalhos do
projeto com que o servidor subiu (`--project`) — nenhuma aceita caminho vindo
do modelo, e nenhuma alcança o Quadro de outro projeto.

⚠️ **A lista viva está na aba Arquivos → MCPs do programa**, na sub-aba
*Explicação* do item "Trabalhos": o que cada ferramenta faz, quando usar e
quando NÃO usar. Ela é gerada do próprio catálogo
(`Program/Code/backend/modulos/catalogo_mcp.py`), então nunca envelhece.

Só o ORQUESTRADOR recebe estas ferramentas — um Subagente não mexe no Quadro
diretamente, quem escreve por ele é quem o coordena.

---

## O que ele não faz

- Não lê nem varre código (isso é o servidor Assistente)
- Não roda comando nenhum
- Não chama LLM
- Não aceita caminho de arquivo do usuário como parâmetro — tudo que escreve
  fica dentro de `Trabalhos/`, derivado do nome do projeto

---

## Como ligar e desligar

Pela aba **Arquivos → MCPs**, igual a qualquer outro item:

- Na tela de Projetos: liga globalmente
- Dentro de um projeto: ativa para aquele projeto específico

Independente do servidor Assistente — um pode estar ligado sem o outro.
