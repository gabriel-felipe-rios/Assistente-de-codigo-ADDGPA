# Como criar MCP local (código na pasta)

> **Este arquivo é o contrato do tipo `local`** — o MCP cujo servidor mora
> dentro da própria pasta do item e vai junto quando você o liga num projeto.
>
> Os outros dois tipos têm arquivo próprio, ao lado deste:
> **Como criar MCP local (roda um comando).md** — a pasta só tem o manifesto e o
> servidor é baixado na hora pelo `npx`/`docker`;
> **Como criar MCP remoto (só endereço).md** — não há código local nenhum.
>
> Não há sandbox: um MCP ligado roda com os seus privilégios e pode fazer o que
> você pode. A contenção é esta página.

## As duas coisas que mudam tudo, e que não valem para as outras categorias

> ### 1 · Ligar **copia**, desligar **apaga**
>
> Skill, comando e agente também são copiados; mas a cópia de uma **regra** ou
> de uma **instrução base** fica no projeto para sempre, porque você a edita.
> A de um MCP **não fica**: desligar remove o apontador **e apaga a pasta
> copiada**. É a única categoria assim.
>
> O freio: se a cópia estiver **diferente** do molde da biblioteca, o programa
> pergunta antes de apagar. Se você quer editar um MCP, edite o **molde**, em
> `Arquivos/MCPs/`, e religue.

> ### 2 · A tela de configuração é **opcional**
>
> Um `mcp.json` com os quatro campos obrigatórios e mais nada é um MCP
> completo. Ele liga, desliga e funciona. O bloco `configuracao` existe para
> quem precisa dele — a maioria dos MCPs de internet não precisa.

---

## Sumário

| Parte | O que tem |
|---|---|
| [1 · O que é um MCP local](#1--o-que-é-um-mcp-local) | e quando o tipo certo é outro |
| [2 · A pasta](#2--a-pasta) | o que precisa estar lá dentro |
| [3 · O manifesto](#3--o-manifesto-mcpjson) | campo a campo |
| [4 · `${PASTA}`](#4--pasta-e-por-que-caminho-de-máquina-quebra) | e por que caminho de máquina quebra |
| [5 · Senha](#5--senha-nunca-vai-no-molde) | nunca vai no molde |
| [6 · A chave](#6--a-chave-o-nome-em-minúsculas-com-hífen) | o nome em minúsculas, com hífen |
| [7 · O bloco de configuração](#7--o-bloco-de-configuração-opcional) | opcional |
| [8 · Marcar ferramenta](#8--marcar-ferramenta-a-armadilha-nº-1-desta-categoria) | a armadilha nº 1 |
| [9 · O servidor](#9--o-servidor-em-si) | o que ele precisa fazer |
| [10 · Sintomas e causas](#10--quando-não-funciona-sintoma--causa) | quando não funciona |
| [11 · Antes de dar por pronto](#11--antes-de-dar-por-pronto) | a lista de conferência |

---

## 1 · O que é um MCP local

Um servidor MCP cujo **código está na pasta do item**. Quando você liga, a pasta
inteira é copiada para dentro do projeto e o apontador registrado aponta para
essa cópia.

O exemplo pronto é o **Outros projetos**, em `Arquivos/MCPs/Outros projetos/`:
Python puro, sem SDK, sem dependência nenhuma além da biblioteca padrão.

### Quando o tipo certo é outro

| Se… | O tipo é |
|---|---|
| o código do servidor está na sua pasta | **`local`** — este arquivo |
| a pasta só tem o manifesto e o servidor vem do `npx`/`uvx`/`docker` | `comando` |
| não há código local: você fala com um endereço HTTP | `remoto` |

⚠️ **A diferença entre `local` e `comando` é quem tem o código, e ela só existe
para VALIDAR.** No registro os dois viram exatamente a mesma coisa. Declarar
`local` faz o programa conferir que o arquivo apontado existe na pasta; declarar
`comando` faz ele conferir que o executável existe no PATH. Trocar um pelo outro
não quebra nada hoje — troca só qual erro você recebe quando algo falta.

---

## 2 · A pasta

Uma pasta em `Arquivos/MCPs/` **é um MCP se tiver `mcp.json` na raiz**. Sem esse
arquivo ela aparece na lista mas recusa a ligar, dizendo isso.

É a mesma regra do `extensao.json` das extensões e do `plugin.json` dos
plugins — não uma terceira invenção.

```
Arquivos/MCPs/{Nome do seu MCP}/
├── mcp.json          ← obrigatório, na raiz
├── Descrição.md      ← o que a biblioteca mostra no cartão
└── servidor.py       ← e o que mais o seu servidor precisar
```

O nome da pasta é o nome do item, e ele vai **por extenso** para o destino:
`Outros projetos` continua `Outros projetos` dentro do projeto, com espaço e
maiúscula. (Skill e comando viram slug porque o assistente os descobre por nome
de pasta; um MCP não é descoberto — o apontador guarda o caminho.)

⚠️ **`__pycache__`, `.git`, `node_modules` e `.venv` não vão junto na cópia.**
Não conte com eles do outro lado.

---

## 3 · O manifesto `mcp.json`

### Os campos comuns aos três tipos

| Campo | Obrigatório | O que é |
|---|---|---|
| `nome` | sim | precisa **bater com o nome da pasta**, letra por letra |
| `versao` | sim | texto livre |
| `descricao` | sim | uma frase, mostrada na biblioteca |
| `tipo` | sim | `local`, `comando` ou `remoto` — e só esses três |

### Os campos do tipo `local`

| Campo | Obrigatório | O que é |
|---|---|---|
| `comando` | sim | o executável que lança o servidor (`python`, `node`…) |
| `args` | sim | a linha de comando. **Pelo menos um item precisa ter `${PASTA}`** |
| `env` | não | variáveis de ambiente do processo |
| `pasta_do_programa` | não | deixe `""`; quem preenche é o programa (ver adiante) |

⚠️ **Nunca escreva `command`, `url` ou `type` no manifesto.** O formato do
registro é **derivado do `tipo`** — o programa monta `{command, args, env}`
sozinho. Um manifesto que diz `remoto` e escreve `command` não teria como ser
recusado com sentido, e por isso esses nomes simplesmente não existem aqui.

### Exemplo completo, mínimo

```json
{
  "nome": "Meu MCP",
  "versao": "1",
  "descricao": "Uma frase dizendo o que ele responde.",
  "tipo": "local",
  "comando": "python",
  "args": ["${PASTA}/servidor.py"],
  "env": {},
  "pasta_do_programa": ""
}
```

### `pasta_do_programa` — o campo que o PROGRAMA preenche

Nasce `""` no molde e recebe, **na cópia**, o caminho da instalação do Assistente
de Código. É por ele que um servidor autocontido acha os dados que o programa
gerou.

⚠️ **Não preencha à mão.** O molde vai para o Git, e um caminho de máquina
escrito nele quebra na primeira vez que a pasta do programa muda de lugar — e há
**duas pastas deste programa hoje**, uma com "- backup" no nome.

⚠️ Se você mover a pasta do programa depois de ligar, o servidor tem de dizer
isso na resposta ("o programa não está mais em X; desligue e religue este MCP").
Sem essa frase o sintoma é "as ferramentas responderam vazio", e a investigação
leva meia hora.

---

## 4 · `${PASTA}`, e por que caminho de máquina quebra

`${PASTA}` vira o **caminho absoluto da cópia dentro do projeto** — nunca o do
molde.

```json
"args": ["${PASTA}/servidor.py", "--config", "${PASTA}/config.json"]
```

Ele existe porque **o manifesto não pode ter caminho de máquina escrito dentro**.
Duas razões, e a segunda é a que morde:

1. o destino da cópia é configurável (Configurações → Servidores MCP), então nem
   o programa sabe o caminho antes de copiar;
2. **há duas pastas deste programa hoje**, e o molde precisa sobreviver às duas.

Um caminho cravado funciona na sua máquina, hoje, e quebra em silêncio no dia em
que qualquer uma das duas coisas mudar — o servidor simplesmente não sobe, e o
MCP some da sessão sem erro nenhum.

---

## 5 · Senha nunca vai no molde

⛔ **O molde nunca guarda senha nem token.** Escreva `${NOME_DA_VARIAVEL}`, e o
programa resolve pela variável de ambiente de mesmo nome na hora de gravar o
registro.

```json
"env": { "MINHA_CHAVE": "${MINHA_CHAVE_DA_API}" }
```

O motivo é concreto: **o molde é copiado para dentro de todo projeto onde você
ligar, e projeto vai para o Git**. Um token escrito no manifesto vaza para todos
eles de uma vez.

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
servidor que falha na sessão seguinte com uma mensagem que não menciona variável
nenhuma.

---

## 6 · A chave: o nome em minúsculas, com hífen

A chave gravada no arquivo de registro é o nome do item **em minúsculas, com
espaço virando hífen e acento caindo**:

| Nome da pasta | Chave |
|---|---|
| `Outros projetos` | `outros-projetos` |
| `Consulta à API` | `consulta-a-api` |

**É essa chave que aparece no endereço da ferramenta** para o assistente externo:

```
mcp__outros-projetos__ler_arquivo
```

⚠️ Consequência: **renomear a pasta depois muda o endereço de todas as
ferramentas**, e todo prompt que citava o endereço antigo para de funcionar.
Escolha o nome antes de escrever prompt que dependa dele.

---

## 7 · O bloco de configuração (opcional)

**Ausência é o normal.** Sem este bloco, o item liga e desliga, e a aba Arquivos
mostra a ficha dele e os arquivos da pasta. Isso não é um item incompleto — é o
caso da maioria dos MCPs.

Com ele, você ganha uma aba **Configuração** dentro do cartão, **por projeto**.

```json
"configuracao": {
  "lista_de_ligadas": { "como": "argumento", "nome": "--enabled" },
  "ferramentas": [
    { "nome": "buscar", "descricao": "o que ela faz, em uma linha" }
  ],
  "campos": [
    {
      "chave": "profundidade",
      "tipo": "numero",
      "argumento": "--profundidade",
      "rotulo": "Quantos níveis descer",
      "ajuda": "Texto pequeno abaixo do campo.",
      "padrao": 3
    }
  ]
}
```

### Os cinco tipos de campo

| `tipo` | A tela desenha | O servidor recebe |
|---|---|---|
| `texto` | uma caixa de texto | `--chave valor` |
| `numero` | uma caixa numérica | `--chave 3` |
| `marcar` | uma caixinha | `--chave true` ou `--chave false` |
| `escolher` | uma lista de escolha única | `--chave opcao` |
| `varios` | várias caixinhas | `--chave a,b,c` |

`opcoes` é a lista escrita à mão. `opcoes_de` pede ao **programa** que preencha:
hoje há um valor, `"projetos"`, que traz os projetos cadastrados no app.

⚠️ **Sem `argumento`, o valor vira `--{chave}`.** E um campo cujo valor o seu
servidor não sabe receber é um campo que grava e não chega a lugar nenhum.

⚠️ **A escolha é por projeto.** No projeto B você marca umas coisas, no C outras.
Mudar um campo **reescreve o apontador na hora**, se o MCP já estiver ligado ali.

---

## 8 · Marcar ferramenta: a armadilha nº 1 desta categoria

Declarar `ferramentas` faz a tela **listar** as ferramentas.
Declarar `lista_de_ligadas` faz a tela **marcar e desmarcar** cada uma.

**São duas coisas, e a segunda não é automática.**

```json
"lista_de_ligadas": { "como": "argumento", "nome": "--enabled" }
```

⚠️ **Um servidor que declara `ferramentas` e não declara `lista_de_ligadas`
mostra a lista SEM as caixinhas — e isso é o certo, não uma limitação a
contornar.** O `--enabled` é invenção **deste programa**, não do protocolo MCP:
um servidor de fora que o receba morre no argumento desconhecido, e o sintoma é
um MCP que conecta e some da sessão, sem erro.

Só declare `lista_de_ligadas` se o **seu** servidor souber ler aquele argumento.

⚠️ **Todas marcadas manda a lista VAZIA.** O programa só passa o argumento quando
alguma foi desmarcada, e ausência quer dizer "todas". É isso que faz uma
ferramenta nova aparecer sozinha, em vez de sumir por não estar numa lista velha.

---

## 9 · O servidor em si

Um servidor MCP stdio: lê JSON-RPC de `stdin`, uma mensagem por linha, e responde
por `stdout`. Precisa tratar `initialize`, `notifications/initialized`, `ping`,
`tools/list` e `tools/call`.

O exemplo completo, em Python puro e sem SDK, é
`Arquivos/MCPs/Outros projetos/servidor.py`.

Três coisas são obrigatórias e fáceis de esquecer:

### ⚠️ 1 · `reconfigure(encoding='utf-8')` — o defeito mais difícil de diagnosticar

```python
for fluxo in (sys.stdout, sys.stdin):
    try:
        fluxo.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
```

O Claude Code lança o processo com o stdout no **code page do console** (cp1252
no Windows), que não tem `≤`, `→` nem `⚠️`. Sem essas linhas, **o handshake
funciona e o `tools/list` mata o processo** — o servidor conecta e some, sem
mensagem em lugar nenhum.

### ⚠️ 2 · Erro de ferramenta volta como TEXTO

```python
try:
    texto = handler(args)
except Exception as e:
    texto = 'Erro na ferramenta %s: %s' % (nome, e)
```

Uma exceção que escapa do laço derruba o servidor inteiro por causa de um nome de
arquivo digitado errado.

### ⚠️ 3 · `protocolVersion` no `initialize`

```python
{'protocolVersion': '2024-11-05',
 'capabilities': {'tools': {}},
 'serverInfo': {'name': 'meu-mcp', 'version': '1.0.0'}}
```

### E uma que não é obrigatória, mas evita meia hora de investigação

**A descrição de cada ferramenta é o que o modelo lê para decidir se chama.** Se
o seu MCP tem uma ferramenta com o mesmo nome de outra já ligada, é a **descrição
que desempata** — o nome não. Comece a descrição dizendo *sobre o quê* ela
responde.

---

## 10 · Quando não funciona: sintoma → causa

| Sintoma | Causa provável |
|---|---|
| O item aparece na lista mas recusa a ligar | falta o `mcp.json` na raiz, ou ele não é JSON válido |
| "está sem o campo obrigatório X" | é literal: o campo X falta |
| "o campo nome diz A, mas a pasta se chama B" | renomeie um dos dois |
| "aponta para X, que não existe dentro da pasta" | o `args` aponta para arquivo que não está na pasta do item |
| Ligou, mas as ferramentas não aparecem | é preciso abrir uma sessão **nova** do assistente; reabrir a mesma não reconecta |
| Conecta e some no `tools/list` | falta o `reconfigure(encoding='utf-8')` |
| As ferramentas somem quando você desmarca uma | você declarou `lista_de_ligadas` e o servidor não entende o argumento |
| Funciona numa máquina e não na outra | caminho de máquina escrito no manifesto, em vez de `${PASTA}` |
| "pede variáveis de ambiente que esta máquina não tem" | crie a variável e **reabra o programa** |
| Tudo responde vazio | o `pasta_do_programa` aponta para uma pasta que não existe mais: desligue e religue |

---

## 11 · Antes de dar por pronto

- [ ] `mcp.json` na raiz, com `nome` batendo com o nome da pasta
- [ ] `Descrição.md` na raiz, dizendo o que ele faz e o que ele **não** faz
- [ ] Nenhum caminho de máquina no manifesto — só `${PASTA}`
- [ ] Nenhuma senha no manifesto — só `${NOME_DA_VARIAVEL}`
- [ ] `pasta_do_programa` deixado como `""`
- [ ] O `reconfigure(encoding='utf-8')` está no servidor
- [ ] `tools/list` responde com o processo vivo, e as descrições têm acento
- [ ] Nenhuma exceção escapa do laço principal
- [ ] `lista_de_ligadas` só declarado se o servidor entender o argumento
- [ ] Ligar num projeto de teste copia a pasta e escreve a entrada
- [ ] Ligar **preserva** as entradas dos outros MCPs no mesmo arquivo
- [ ] Desligar remove a entrada e apaga a cópia
- [ ] As ferramentas aparecem numa sessão **nova** do assistente
