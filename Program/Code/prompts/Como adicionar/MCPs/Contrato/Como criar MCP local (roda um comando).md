# Como criar MCP local (roda um comando)

> **Este arquivo é o contrato do tipo `comando`** — o MCP cuja pasta **não tem
> servidor nenhum**: só o manifesto e a descrição. O servidor é um pacote de
> internet, baixado e executado na hora pelo `npx`, `uvx`, `bunx` ou `docker`.
>
> É o tipo da esmagadora maioria dos MCPs prontos que você acha por aí.
>
> Os outros dois têm arquivo próprio, ao lado deste:
> **Como criar MCP local (código na pasta).md** — o servidor é seu e mora na pasta;
> **Como criar MCP remoto (só endereço).md** — não há processo local nenhum.

## Comece por aqui

Um MCP de internet costuma vir documentado assim:

```json
{ "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/caminho"]
    } } }
```

Trazer isso para cá é **traduzir**, não copiar. O `mcp.json` daqui **não tem**
`command` nem `args` no formato de destino: ele declara o `tipo`, e o programa
**deriva** o formato do registro. Fica assim:

```json
{
  "nome": "Filesystem",
  "versao": "1",
  "descricao": "Lê e escreve arquivos numa pasta que você escolhe.",
  "tipo": "comando",
  "comando": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "${PASTA}"],
  "env": {},
  "pasta_do_programa": ""
}
```

---

## As duas coisas que mudam tudo, e que não valem para as outras categorias

> ### 1 · Ligar **copia**, desligar **apaga**
>
> Mesmo aqui, onde a pasta é quase vazia. Ligar copia o manifesto e a descrição
> para dentro do projeto; desligar remove o apontador **e apaga a pasta
> copiada**. É a única categoria assim — a cópia de uma **regra** ou de uma
> **instrução base** fica no projeto para sempre, porque você a edita.
>
> O freio: se a cópia estiver **diferente** do molde, o programa pergunta antes
> de apagar.

> ### 2 · A tela de configuração é **opcional**
>
> Um `mcp.json` com os campos obrigatórios e mais nada é um MCP completo. O
> bloco `configuracao` existe para quem precisa dele — e um MCP de internet
> quase nunca precisa, pelo motivo da [parte 6](#6--marcar-ferramenta-quase-sempre-não-dá-e-está-certo).

---

## Sumário

| Parte | O que tem |
|---|---|
| [1 · O que é o tipo `comando`](#1--o-que-é-o-tipo-comando) | e quando o tipo certo é outro |
| [2 · O manifesto](#2--o-manifesto-mcpjson) | campo a campo |
| [3 · A prova do PATH](#3--a-prova-do-path) | o erro que diz o que instalar |
| [4 · `${PASTA}`](#4--pasta-quando-o-código-não-é-seu) | quando o código não é seu |
| [5 · Senha](#5--senha-nunca-vai-no-molde) | nunca vai no molde |
| [6 · Marcar ferramenta](#6--marcar-ferramenta-quase-sempre-não-dá-e-está-certo) | quase sempre não dá |
| [7 · A chave](#7--a-chave-o-nome-em-minúsculas-com-hífen) | o nome em minúsculas, com hífen |
| [8 · Sintomas e causas](#8--quando-não-funciona-sintoma--causa) | quando não funciona |
| [9 · Antes de dar por pronto](#9--antes-de-dar-por-pronto) | a lista de conferência |

---

## 1 · O que é o tipo `comando`

Um MCP cuja pasta na biblioteca é **só a embalagem**:

```
Arquivos/MCPs/{Nome do seu MCP}/
├── mcp.json          ← obrigatório, na raiz
└── Descrição.md      ← o que a biblioteca mostra, e é aqui que você anota
                         de onde ele veio e o que ele faz com os seus dados
```

O servidor de verdade é baixado na hora pelo executável que você declarar.

### Quando o tipo certo é outro

| Se… | O tipo é |
|---|---|
| a pasta só tem manifesto e descrição; o servidor vem do `npx`/`uvx`/`docker` | **`comando`** — este arquivo |
| o código do servidor está na sua pasta | `local` |
| não há processo local: você fala com um endereço HTTP | `remoto` |

⚠️ **A diferença entre `comando` e `local` é quem tem o código, e ela só existe
para VALIDAR.** No registro os dois viram exatamente a mesma coisa
(`{command, args, env}`). Declarar `comando` faz o programa conferir que o
executável está no **PATH**; declarar `local` faz ele conferir que o arquivo
apontado existe **dentro da pasta**. Trocar um pelo outro troca só qual erro você
recebe quando algo falta.

### ⚠️ Um MCP de internet é código de terceiro rodando com os seus privilégios

Não há sandbox. Antes de ligar um pacote que você não escreveu, saiba de quem ele
é e o que ele lê. Anote isso na `Descrição.md` — daqui a três meses você não vai
lembrar.

---

## 2 · O manifesto `mcp.json`

### Os campos comuns aos três tipos

| Campo | Obrigatório | O que é |
|---|---|---|
| `nome` | sim | precisa **bater com o nome da pasta**, letra por letra |
| `versao` | sim | texto livre — use a versão do pacote que você fixou |
| `descricao` | sim | uma frase, mostrada na biblioteca |
| `tipo` | sim | `local`, `comando` ou `remoto` — e só esses três |

### Os campos do tipo `comando`

| Campo | Obrigatório | O que é |
|---|---|---|
| `comando` | sim | o executável: `npx`, `uvx`, `bunx`, `docker`, `node`… |
| `args` | não | os argumentos, na ordem |
| `env` | não | variáveis de ambiente do processo |
| `pasta_do_programa` | não | deixe `""`; quem preenche é o programa |

⚠️ **Nunca escreva `command`, `url` ou `type` no manifesto.** Esses são os nomes
do formato **de destino**, e quem os escreve é o programa, a partir do `tipo`.

### ⚠️ Fixe a versão do pacote

```json
"args": ["-y", "@modelcontextprotocol/server-filesystem@2025.8.21", "${PASTA}"]
```

Sem a versão, `npx -y` baixa a mais nova a cada sessão. O MCP muda de
comportamento sozinho, num dia em que você não mexeu em nada — e o `tools/list`
pode até mudar de tamanho.

---

## 3 · A prova do PATH

Ao ligar, o programa confere que o `comando` **existe no PATH desta máquina**. Se
não existir, ele recusa **antes de copiar qualquer coisa** e diz o que instalar:

| Comando | O que o erro manda instalar |
|---|---|
| `npx`, `npm`, `node` | Node.js |
| `bunx` | Bun |
| `uvx`, `uv` | uv (`pip install uv`) |
| `docker` | Docker Desktop |
| `python`, `py` | Python, no PATH |
| `deno` | Deno |
| qualquer outro | "instale o programa que fornece esse comando, ou escreva o caminho completo dele no manifesto" |

⚠️ **Instalou e continua dando erro? Feche e reabra o Assistente de Código.** Um
processo já em execução não enxerga mudança de PATH feita depois dele.

⚠️ **Caminho completo funciona, mas amarra o manifesto à máquina.** Se você
escrever `"comando": "C:\\Program Files\\nodejs\\npx.cmd"`, o item para de
funcionar em qualquer outra máquina — e o molde vai para o Git junto com o
projeto. Prefira consertar o PATH.

---

## 4 · `${PASTA}` quando o código não é seu

`${PASTA}` vira o **caminho absoluto da cópia dentro do projeto**. Aqui ele
raramente aponta para um arquivo (não há nenhum), e serve para outra coisa: dizer
ao servidor de terceiro **em que pasta ele pode trabalhar**.

```json
"args": ["-y", "@modelcontextprotocol/server-filesystem", "${PASTA}"]
```

⚠️ **Não escreva caminho de máquina no lugar dele.** O destino da cópia é
configurável (Configurações → Servidores MCP), e **há duas pastas deste programa
hoje**, uma com "- backup" no nome. Um caminho cravado funciona na sua máquina,
hoje, e quebra em silêncio quando qualquer uma das duas coisas mudar.

Se o servidor de terceiro precisa apontar para uma pasta **fora** do MCP — a raiz
do seu projeto, por exemplo —, isso não sai de `${PASTA}`: declare um campo de
configuração do tipo `texto` (parte 7 do arquivo do tipo `local`) e deixe o
usuário preencher por projeto.

---

## 5 · Senha nunca vai no molde

⛔ **O molde nunca guarda senha nem token.** Escreva `${NOME_DA_VARIAVEL}`, e o
programa resolve pela variável de ambiente de mesmo nome na hora de gravar o
registro.

```json
"env": { "GITHUB_TOKEN": "${MEU_TOKEN_DO_GITHUB}" }
```

Este é o tipo em que a regra mais morde: um MCP de internet quase sempre pede
chave de API, e a documentação dele normalmente mostra a chave escrita por
extenso no exemplo. **Não copie assim.** O molde é copiado para dentro de todo
projeto onde você ligar, e projeto vai para o Git — um token escrito no manifesto
vaza para todos eles de uma vez.

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
todas as que faltam. Ele não grava o `${...}` cru: isso daria um servidor que
falha na sessão seguinte com uma mensagem que não menciona variável nenhuma.

---

## 6 · Marcar ferramenta: quase sempre não dá, e está certo

Você pode declarar as ferramentas de um MCP de terceiro no bloco `configuracao`,
e a tela as **lista**. Mas ela só desenha as **caixinhas** de marcar se você
também declarar como o servidor recebe a lista das ligadas:

```json
"lista_de_ligadas": { "como": "argumento", "nome": "--enabled" }
```

⚠️ **Num MCP de internet, quase nunca declare isso.** O `--enabled` é invenção
**deste programa**, não do protocolo MCP. Um servidor de terceiro que o receba
morre no argumento desconhecido — e o sintoma é um MCP que conecta e **some da
sessão**, sem erro em lugar nenhum, exatamente depois de você desmarcar a
primeira ferramenta.

Declarar só `ferramentas`, sem `lista_de_ligadas`, é o caminho certo: a tela
mostra o que aquele servidor expõe, sem prometer um controle que não existe.

Se o pacote tiver um argumento **próprio** para isso (alguns têm, com outro
nome), aí sim: ponha o nome dele em `"nome"`.

---

## 7 · A chave: o nome em minúsculas, com hífen

A chave gravada no arquivo de registro é o nome do item **em minúsculas, com
espaço virando hífen e acento caindo**:

| Nome da pasta | Chave |
|---|---|
| `Filesystem` | `filesystem` |
| `Busca na Web` | `busca-na-web` |

**É essa chave que aparece no endereço da ferramenta** para o assistente externo
(`mcp__filesystem__read_file`), e ela **não precisa** ser igual ao nome que a
documentação do pacote usa — o endereço é seu.

⚠️ Renomear a pasta depois muda o endereço de todas as ferramentas, e todo prompt
que citava o antigo para de funcionar.

---

## 8 · Quando não funciona: sintoma → causa

| Sintoma | Causa provável |
|---|---|
| "não está no PATH desta máquina" | instale o que o erro mandou, e **reabra o programa** |
| Instalou, reabriu, e continua | o instalador não mexeu no PATH do usuário; confira num terminal novo |
| O item aparece na lista mas recusa a ligar | falta o `mcp.json` na raiz, ou ele não é JSON válido |
| "está sem o campo obrigatório X" | é literal: o campo X falta |
| "o campo nome diz A, mas a pasta se chama B" | renomeie um dos dois |
| Ligou, mas as ferramentas não aparecem | é preciso abrir uma sessão **nova** do assistente |
| Funcionava, e um dia mudou sozinho | `npx -y` sem versão fixada baixou uma versão nova |
| As ferramentas somem quando você desmarca uma | você declarou `lista_de_ligadas` num servidor que não entende o argumento |
| "pede variáveis de ambiente que esta máquina não tem" | crie a variável e **reabra o programa** |
| A primeira chamada demora muito | é o download do pacote; ele fica em cache depois |

---

## 9 · Antes de dar por pronto

- [ ] `mcp.json` na raiz, com `nome` batendo com o nome da pasta
- [ ] `Descrição.md` dizendo **de quem é o pacote** e o que ele acessa
- [ ] A versão do pacote está **fixada** no `args`
- [ ] Nenhum caminho de máquina no manifesto — nem no `comando`
- [ ] Nenhuma senha no manifesto — só `${NOME_DA_VARIAVEL}`
- [ ] `pasta_do_programa` deixado como `""`
- [ ] `lista_de_ligadas` **não** declarado (a menos que o pacote tenha esse argumento)
- [ ] Ligar num projeto de teste escreve a entrada e **preserva** as dos outros MCPs
- [ ] Desligar remove a entrada e apaga a cópia
- [ ] As ferramentas aparecem numa sessão **nova** do assistente
