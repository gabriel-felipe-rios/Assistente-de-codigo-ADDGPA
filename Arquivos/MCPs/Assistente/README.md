# Assistente

Servidor MCP que expõe ao **assistente externo** — Claude Code, Cursor, Antigravity —
as consultas que o Assistente de Código já calcula localmente. O objetivo é
simples: quando ele precisa saber onde algo está ou o que quebra se mexer, ele
**pergunta** em vez de explorar o projeto lendo arquivo por arquivo.

> **Status:** implementado e funcionando. O servidor é `Program/Code/server/assistente/servidor.py` (stdio, Python puro).
> Ativar pela aba **Arquivos → MCPs** grava o `.mcp.json` na raiz do projeto; as ferramentas aparecem quando
> você abre uma sessão **nova** do Claude Code na pasta do projeto (reabrir a mesma sessão não reconecta).
>
> Este é um dos dois servidores MCP do programa — o outro é o **Trabalhos**
> (`Arquivos/MCPs/Trabalhos/`), que expõe o Quadro de atividades. Os dois ligam e
> desligam independente um do outro.

---

## Por que existe

Hoje o fluxo é: o app monta um prompt bem detalhado, você copia, cola no Claude
Code. Funciona — mas se ele tiver uma dúvida no meio do trabalho ("essa função é
chamada de onde mesmo?"), ele volta a explorar o projeto na mão, gastando token
para redescobrir o que o app já tem calculado e guardado.

O MCP fecha esse buraco. O relatório da Fila deixa de ser algo que você
transporta e vira algo que ele consulta.

---

## Ferramentas

19 ferramentas, todas de **leitura** — nada aqui escreve em disco. (A escrita
mora no outro servidor, o Trabalhos, e é limitada ao Quadro de atividades.)

⚠️ **A lista viva está na aba Arquivos → MCPs do programa**, na sub-aba
*Explicação* do item "Assistente": o que cada ferramenta devolve, quando
usar, de onde o dado sai e quando NÃO usar. Ela é gerada do próprio catálogo
(`Program/Code/backend/modulos/catalogo_mcp.py`), então nunca envelhece.

### O que torna `eu_uso`, `me_usam` e `relacoes_uso` diferentes de um grep

Neste tipo de aplicativo, a ligação real entre arquivos quase nunca é um import.
O frontend deste projeto, por exemplo, tem **zero** imports — os módulos JS são
carregados por `<script src>` e conversam por funções globais.

O que essas ferramentas enxergam, e um grafo de imports não:

- função global JS definida num arquivo e chamada em outro
- ponte `window.pywebview.api.X` (JS) ↔ `def X` (Python)
- ponte `evaluate_js('nomeCallback')` (Python) ↔ `function nomeCallback` (JS)
- ID ou classe declarada no HTML e lida no JS
- chave de dicionário escrita no Python e lida pelo nome no JS

Esse último grupo é onde mora o perigo real: renomear qualquer um deles **não
gera erro nenhum**. O Python continua rodando, o JS simplesmente não faz nada, e
a tela fica vazia sem nenhuma pista.

---

## O que ele não faz

- Não escreve nem edita código
- Não roda comando nenhum
- Não chama LLM
- Não decide nada — só devolve o que já está calculado

Toda resposta é derivada de artefatos que o app gerou e guardou em disco. Se um
artefato estiver desatualizado, a resposta reflete isso — por isso o pré-requisito
abaixo.

---

## Pré-requisito

**Só ligar depois que a fundação estiver confiável:** índice de navegação
determinístico, índice de identificadores construído e hashes rodando.

O motivo é direto: MCP é uma interface para os dados, não uma correção deles. Se
os dados estiverem errados, ele apenas entrega o erro mais rápido e com mais
autoridade — o Claude Code vai tratar como verdade algo que o app inventou.

---

## Como ligar e desligar

Pela aba **Arquivos → MCPs**, igual a qualquer outro item:

- Na tela de Projetos: liga globalmente
- Dentro de um projeto: ativa para aquele projeto específico

Vale desligar quando o projeto for pequeno o suficiente para o Claude Code
navegar sozinho sem custo, ou enquanto você estiver mexendo no próprio MCP.

---

## Relação com a Fila

São coisas separadas e não se substituem:

| | Fila | MCP |
|---|---|---|
| Quando roda | assíncrona, enquanto você dorme | síncrono, durante o trabalho |
| O que produz | relatório de viabilidade | resposta a uma pergunta pontual |
| Quem usa | você, para decidir | o Claude Code, para não explorar |

A Fila **não** passa pelo MCP. As duas leem os mesmos artefatos, cada uma para o
seu propósito.
