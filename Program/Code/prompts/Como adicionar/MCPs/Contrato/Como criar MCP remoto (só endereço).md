# Como criar MCP remoto (só endereço)

> **Este arquivo é o contrato do tipo `remoto`** — o MCP que **não roda processo
> nenhum na sua máquina**. O assistente externo fala direto com um endereço HTTP,
> e o servidor está no computador de outra pessoa.
>
> Os outros dois têm arquivo próprio, ao lado deste:
> **Como criar MCP local (código na pasta).md** — o servidor é seu e mora na pasta;
> **Como criar MCP local (roda um comando).md** — o servidor é baixado na hora.

## ⚠️ Leia isto antes do resto

Um MCP remoto é o único dos três em que **os dados saem da sua máquina**. Tudo
que o assistente mandar numa chamada — trecho de código, nome de arquivo,
pergunta — viaja para um servidor que não é seu.

Duas consequências práticas:

- **anote na `Descrição.md` de quem é aquele endereço** e o que ele recebe. Daqui
  a três meses você não vai lembrar, e um endereço solto num manifesto não conta
  essa história;
- **use `https`.** Um endereço `http` manda o cabeçalho de autenticação em texto
  aberto pela rede.

Nada aqui bloqueia um endereço: a contenção é esta página.

---

## As duas coisas que mudam tudo, e que não valem para as outras categorias

> ### 1 · Ligar **copia**, desligar **apaga**
>
> Mesmo aqui, onde a pasta é só manifesto e descrição. Ligar copia a pasta para
> dentro do projeto e escreve o apontador; desligar remove o apontador **e apaga
> a pasta copiada**. É a única categoria assim — a cópia de uma **regra** ou de
> uma **instrução base** fica no projeto para sempre, porque você a edita.
>
> O freio: se a cópia estiver **diferente** do molde, o programa pergunta antes
> de apagar.

> ### 2 · A tela de configuração é **opcional**
>
> Um `mcp.json` com os campos obrigatórios e mais nada é um MCP completo. E aqui
> o bloco `configuracao` serve para menos ainda que nos outros dois: um servidor
> remoto **não recebe linha de comando**. Ver a
> [parte 6](#6--configuração-e-marcar-ferramenta-aqui-quase-não-existe).

---

## Sumário

| Parte | O que tem |
|---|---|
| [1 · O que é o tipo `remoto`](#1--o-que-é-o-tipo-remoto) | e quando o tipo certo é outro |
| [2 · O manifesto](#2--o-manifesto-mcpjson) | campo a campo |
| [3 · Senha](#3--senha-a-regra-mais-dura-dos-três-tipos) | a regra mais dura dos três tipos |
| [4 · `${PASTA}`](#4--pasta-aqui-quase-não-serve) | aqui quase não serve |
| [5 · A chave](#5--a-chave-o-nome-em-minúsculas-com-hífen) | o nome em minúsculas, com hífen |
| [6 · Configuração](#6--configuração-e-marcar-ferramenta-aqui-quase-não-existe) | e marcar ferramenta |
| [7 · Sintomas e causas](#7--quando-não-funciona-sintoma--causa) | quando não funciona |
| [8 · Antes de dar por pronto](#8--antes-de-dar-por-pronto) | a lista de conferência |

---

## 1 · O que é o tipo `remoto`

Um MCP cuja pasta na biblioteca guarda **só a embalagem**:

```
Arquivos/MCPs/{Nome do seu MCP}/
├── mcp.json          ← obrigatório, na raiz
└── Descrição.md      ← de quem é o endereço, o que ele recebe, o que devolve
```

Não há processo, não há `comando`, não há `args`. O que o programa grava no
registro é um endereço e, se houver, cabeçalhos.

### Quando o tipo certo é outro

| Se… | O tipo é |
|---|---|
| não há processo local: só um endereço HTTP | **`remoto`** — este arquivo |
| o código do servidor está na sua pasta | `local` |
| o servidor é baixado na hora pelo `npx`/`uvx`/`docker` | `comando` |

⚠️ Muitos MCPs de internet oferecem **as duas formas** — um pacote `npx` e um
endereço hospedado. São itens diferentes aqui: um `comando` e um `remoto`. Não
misture os dois campos num manifesto só; o `tipo` decide o formato inteiro.

---

## 2 · O manifesto `mcp.json`

### Os campos comuns aos três tipos

| Campo | Obrigatório | O que é |
|---|---|---|
| `nome` | sim | precisa **bater com o nome da pasta**, letra por letra |
| `versao` | sim | texto livre |
| `descricao` | sim | uma frase, mostrada na biblioteca |
| `tipo` | sim | `local`, `comando` ou `remoto` — e só esses três |

### Os campos do tipo `remoto`

| Campo | Obrigatório | O que é |
|---|---|---|
| `transporte` | sim | `http` ou `sse` — e só esses dois |
| `url` | sim | o endereço. Use `https` |
| `headers` | não | cabeçalhos enviados a cada chamada |

### Exemplo completo

```json
{
  "nome": "Serviço remoto",
  "versao": "1",
  "descricao": "Consulta o catálogo da empresa. Os dados saem desta máquina.",
  "tipo": "remoto",
  "transporte": "http",
  "url": "https://mcp.exemplo.com/v1",
  "headers": { "Authorization": "Bearer ${MEU_TOKEN_DO_SERVICO}" }
}
```

⚠️ **Nunca escreva `command`, `args`, `type` ou `env` no manifesto.** O formato
do registro é **derivado do `tipo`**: o programa monta `{type, url, headers}`
sozinho. Escrever `type` à mão criaria um segundo formato para ele ter de
entender — e um manifesto que diz `remoto` e escreve `command` não teria como ser
recusado com sentido.

⚠️ **`transporte` não é `type`.** O nome do campo aqui é `transporte`; `type` é o
nome que ele ganha **no registro**, e quem o escreve é o programa.

---

## 3 · Senha: a regra mais dura dos três tipos

⛔ **O programa RECUSA um manifesto remoto com senha escrita por extenso.** Não é
um aviso: ele não liga.

A checagem é pelo **nome do cabeçalho** — `Authorization`, `X-Api-Key`,
`Proxy-Token`, qualquer um que contenha `authorization`, `api-key`, `apikey`,
`token`, `secret`, `password`, `senha` ou `bearer`. Se o valor tiver qualquer
coisa que não venha de um `${...}` (fora do prefixo `Bearer`/`Basic`/`Token`),
ele é recusado.

| Valor | Aceito? |
|---|---|
| `"Bearer ${MEU_TOKEN}"` | ✅ |
| `"${MEU_TOKEN}"` | ✅ |
| `"Bearer sk-abc123"` | ❌ recusado |
| `"sk-abc123"` | ❌ recusado |

⚠️ **A checagem é pelo NOME do cabeçalho, e não por o valor parecer uma senha.**
Um token é uma sequência de caracteres como qualquer outra, e nenhuma heurística
sobre o valor distingue um segredo de um id público. Consequência: um cabeçalho
com nome incomum **passa** com valor literal — e a responsabilidade de não pôr
senha nele é sua.

O motivo da dureza é concreto: **o molde é copiado para dentro de todo projeto
onde você ligar, e projeto vai para o Git.** Um token escrito no manifesto vaza
para todos eles de uma vez, e um endereço remoto é justamente o caso em que o
token vale alguma coisa para quem o encontrar.

### Como criar a variável no Windows

1. Menu Iniciar → digite `variáveis de ambiente` → **Editar as variáveis de
   ambiente do seu usuário**;
2. em **Variáveis de usuário**, clique em **Novo…**;
3. **Nome da variável**: exatamente o que está entre `${` e `}` no manifesto;
4. **Valor**: o token;
5. **OK** nas duas janelas.

⚠️ **Feche e reabra o Assistente de Código depois.** Um processo já em execução
não enxerga variável criada depois dele.

Se a variável não existir na hora de ligar, o programa **recusa** e diz o nome de
todas as que faltam. Ele não grava o `${...}` cru no registro: isso daria um
servidor que responde 401 na sessão seguinte, com uma mensagem que não menciona
variável nenhuma.

### ⚠️ O valor resolvido FICA no arquivo de registro

O `${...}` protege o **molde**, que é o que você versiona. O arquivo de registro
do projeto (`.mcp.json` ou equivalente) recebe o token **já resolvido** — ele
precisa, para o assistente conseguir autenticar. Ponha esse arquivo no
`.gitignore` do projeto.

---

## 4 · `${PASTA}` aqui quase não serve

`${PASTA}` vira o caminho absoluto da cópia dentro do projeto, e é resolvido
também na `url` e nos `headers`. Só que **um servidor remoto não tem como usar um
caminho da sua máquina** — ele está em outro computador.

Se você se pegou querendo `${PASTA}` num manifesto remoto, provavelmente o tipo
certo é outro.

⚠️ **E não escreva caminho de máquina no lugar dele**, pelo mesmo motivo dos
outros dois tipos: **há duas pastas deste programa hoje**, uma com "- backup" no
nome, e o molde precisa sobreviver às duas.

---

## 5 · A chave: o nome em minúsculas, com hífen

A chave gravada no arquivo de registro é o nome do item **em minúsculas, com
espaço virando hífen e acento caindo**:

| Nome da pasta | Chave |
|---|---|
| `Serviço remoto` | `servico-remoto` |
| `Catálogo da Empresa` | `catalogo-da-empresa` |

**É essa chave que aparece no endereço da ferramenta** para o assistente externo
(`mcp__servico-remoto__buscar`).

⚠️ Renomear a pasta depois muda o endereço de todas as ferramentas, e todo prompt
que citava o antigo para de funcionar.

---

## 6 · Configuração e marcar ferramenta: aqui quase não existe

O bloco `configuracao` é opcional em qualquer tipo, e neste ele serve para menos:

⚠️ **Um servidor remoto NÃO RECEBE ARGUMENTO DE LINHA DE COMANDO.** Não há
processo local para receber. Por isso o programa **não acrescenta** os
`--argumento` dos campos nem o `--enabled` das ferramentas num item remoto — eles
seriam gravados num lugar que ninguém lê.

O que ainda faz sentido declarar:

- **`ferramentas`**, só para a tela **listar** o que aquele endereço expõe. É
  documentação sua, para você lembrar o que ligou;
- **nada mais**. `campos` e `lista_de_ligadas` num item remoto gravam a escolha e
  não chegam a lugar nenhum.

Se o serviço remoto tem opções, elas vão na `url` (como parâmetros) ou nos
`headers` — e aí são fixas no manifesto, não escolhidas por projeto.

---

## 7 · Quando não funciona: sintoma → causa

| Sintoma | Causa provável |
|---|---|
| "tem o valor escrito por extenso" | senha literal num cabeçalho: troque por `${NOME_DA_VARIAVEL}` |
| "está sem o campo url" | é literal: o campo falta, ou está vazio |
| "o campo transporte diz X" | só `http` e `sse` são aceitos |
| "está sem o campo obrigatório tipo" | falta `"tipo": "remoto"` |
| "o campo nome diz A, mas a pasta se chama B" | renomeie um dos dois |
| "pede variáveis de ambiente que esta máquina não tem" | crie a variável e **reabra o programa** |
| Ligou, mas as ferramentas não aparecem | é preciso abrir uma sessão **nova** do assistente |
| O assistente reclama de autenticação (401/403) | a variável existe mas o valor está errado, ou o token expirou |
| Marcou/desmarcou ferramenta e nada mudou | é o esperado: item remoto não recebe a lista (parte 6) |
| Funciona num dia e não no outro | é um serviço de terceiro — pode estar fora do ar |

---

## 8 · Antes de dar por pronto

- [ ] `mcp.json` na raiz, com `nome` batendo com o nome da pasta
- [ ] `Descrição.md` dizendo **de quem é o endereço** e o que sai desta máquina
- [ ] A `url` é `https`
- [ ] Nenhuma senha no manifesto — só `${NOME_DA_VARIAVEL}`
- [ ] O arquivo de registro do projeto está no `.gitignore` dele
- [ ] Nenhum `command`, `args`, `env` ou `type` escrito no manifesto
- [ ] Nem `campos` nem `lista_de_ligadas` declarados (não chegam ao servidor)
- [ ] Ligar num projeto de teste escreve a entrada e **preserva** as dos outros MCPs
- [ ] Desligar remove a entrada e apaga a cópia
- [ ] As ferramentas aparecem numa sessão **nova** do assistente
