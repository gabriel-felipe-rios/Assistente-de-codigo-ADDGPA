# Como usar o Plugin base

Este arquivo é para colar numa IA **junto com o pedido de um plugin novo**, e só
quando esse plugin novo precisar de algo que o Plugin base já captura. Se o
plugin que você está pedindo não precisa de nada disso, não mande este arquivo:
ele não é leitura obrigatória para plugin nenhum, é **opcional, por demanda** —
ao contrário de `Como criar plugins.md` e `A API do programa.md`, nesta mesma
pasta, que são leitura obrigatória para **qualquer** plugin, mandado este
arquivo ou não.

> **Este arquivo é um contrato de dado.** O Plugin base declara aqui o formato
> do que ele publica em `files/`, e outros plugins podem ler esses arquivos
> direto do disco. O que está escrito aqui é o que se pode assumir; o que não
> está, não.

---

## Sumário

| Parte | O que tem |
|---|---|
| [1 · O que é o Plugin base](#1--o-que-é-o-plugin-base-em-uma-frase) | e as seis categorias que o usuário liga e desliga |
| [2 · Por que mandar este arquivo](#2--por-que-mandar-este-arquivo-e-não-pedir-pra-ia-calcular-de-novo) | e quando **não** mandar |
| [3 · Onde o dado mora](#3--onde-o-dado-mora) | a pasta, a regra de leitura, e o exemplo em Python |
| [4 · `atual.json`](#4--atualjson--o-retrato-de-agora) | o retrato de agora, campo a campo |
| [5 · `arquivos.json`](#5--arquivosjson--um-registro-por-arquivo) | um registro por arquivo, e a forma do caminho |
| [6 · `dias/{dia}.json`](#6--diasdiajson--o-que-mudou-naquele-dia) | os eventos, o fechamento, e as três armadilhas |
| [7 · Os tempos](#7--tempos-são-somas-acumuladas-não-sessões) | somas acumuladas, não sessões |
| [8 · ⚠️ Categoria desligada](#8--as-pegadinhas-de-categoria-desligada) | **a seção que mais evita conta errada** |
| [9 · O dado pode sumir](#9--o-dado-pode-sumir--e-o-histórico-pode-rejuvenescer) | a tela tem um botão de apagar |
| [10 · Leitura durante a escrita](#10--leitura-durante-a-escrita--por-que-isso-é-seguro) | por que é seguro ler a qualquer momento |
| [11 · O dado é sempre um pouco velho](#11--dado-sempre-pode-estar-desatualizado--e-isso-é-esperado) | e o que a captura periódica **não** consegue ver |
| [12 · Exemplos de uso](#12--exemplos-de-uso) | quatro casos, e o que cada um precisa abrir |
| [13 · Sintomas e causas](#13--quando-a-conta-não-fecha-sintoma--causa) | a tabela |
| [14 · Antes de dar por pronto](#14--antes-de-dar-por-pronto) | a lista de conferência de quem consome |
| [Mandar ou não](#resumo-para-decidir-se-manda-este-arquivo) | a tabela de decisão |

---

## 1 · O que é o Plugin base, em uma frase

Um plugin **automático** (`External/plugins/Plugin base/`, o único do programa
que tem `plugin_boot.py` — roda sozinho em segundo plano, sem clique) que varre
todos os projetos periodicamente e guarda, por projeto, duas coisas de naturezas
diferentes: o **retrato de agora** (quantos arquivos, quantas linhas, quanto
tempo acumulado) e o **histórico do que mudou em cada dia**.

### As seis categorias

O usuário liga e desliga cada uma na tela do próprio plugin:

| Categoria (nome na tela) | O que guarda | Chave interna |
|---|---|---|
| Contagem de arquivos e linhas | `totais.arquivos` / `totais.linhas` — dois números, o projeto inteiro | `arquivos_e_linhas` |
| Lista de arquivos | `arquivos.json` — um registro por arquivo do escopo | `lista_de_arquivos` |
| Mudanças por dia | `dias/{dia}.json` — o que foi criado, editado, apagado e movido | `mudancas_por_dia` |
| Tempo em rotinas (Automação) | `tempos.rotinas_segundos` — soma de todo ciclo completo | `tempo_rotinas` |
| Tempo na fila (Assistente) | `tempos.fila_segundos` — soma de toda tarefa concluída | `tempo_fila` |
| Tempo no chat (aproximado) | `tempos.chat_segundos` — aproximado, ver a [parte 7](#7--tempos-são-somas-acumuladas-não-sessões) | `tempo_chat` |

⚠️ **A varredura roda sempre**, independente de quais categorias estão ligadas —
ela é o que permite comparar uma captura com a anterior e saber o que mudou. As
categorias decidem o que fica **guardado** e o que a tela mostra, nunca se a
captura acontece.

⚠️ **A categoria "Lista de arquivos" é inerte hoje.** Ela aparece na tela e no
arquivo de configuração, mas nada no plugin a consulta: `arquivos.json` é
gravado **incondicionalmente**, porque é ele o baseline de comparação da captura
seguinte. Desmarcar a caixa não muda nada — nem a captura, nem a tela. Para quem
consome, a boa notícia é que **`arquivos.json` sempre existe** quando o projeto
já foi capturado.

O que as outras cinco fazem quando desligadas está na
[parte 8](#8--as-pegadinhas-de-categoria-desligada), e não é o que se espera.

### Como ele roda

| Detalhe | Valor |
|---|---|
| Intervalo padrão entre capturas | **15 minutos** (o usuário muda na tela) |
| Primeira captura depois do boot | **5 segundos** |
| Se o plugin estiver desligado | o laço **continua se reagendando**, mas não captura nada |
| Se `config/configuracao.json` faltar | é criado sozinho, com o padrão de fábrica |
| Gravação | `.tmp` + `os.replace`, com **3 tentativas** em `PermissionError` (típico do Windows) |

---

## 2 · Por que mandar este arquivo, e não pedir pra IA calcular de novo

Se o plugin que você está pedindo precisa de qualquer coisa da tabela acima —
quantos arquivos/linhas um projeto tem, a lista deles, o que mudou em cada dia,
ou quanto tempo foi gasto em rotinas/fila/chat — o Plugin base **já captura
isso**. Pedir pra IA reimplementar essa conta dentro do plugin novo é trabalho
duplicado, e pior que isso: o cálculo do zero não teria **histórico** nenhum. Um
plugin que varre na hora só sabe o estado do instante em que rodou; ele não tem
como saber que um arquivo foi apagado na terça, porque na terça ele não estava
olhando.

Se o plugin novo precisa de outra coisa — que não está na tabela — não mande
este arquivo; ele não ajuda, e só ocupa contexto à toa.

---

## 3 · Onde o dado mora

Por projeto, uma **pasta**:

```
Program/External/plugins/Plugin base/files/{nome-do-projeto}/
  atual.json      ← o retrato de agora (leve, ~600 bytes)
  arquivos.json   ← um registro por arquivo do escopo (o peso: dezenas de KB)
  dias/
    2026-08-30.json
    2026-08-29.json
```

A divisão não é arrumação: é para que cada consumidor abra só o que precisa. Um
selo que mostra "1.234 linhas" lê `atual.json` e nada mais; uma linha do tempo
lê os arquivinhos de `dias/` e nunca toca em `arquivos.json`.

`{nome-do-projeto}` é o nome **literal** da pasta do projeto — o mesmo que
aparece na tela de Projetos. Não é um id, não é normalizado, pode ter espaço e
acento. Um projeto que o Plugin base ainda não capturou **não tem pasta** —
trate a ausência como "sem dado ainda", nunca como erro fatal.

Você também pode encontrar um arquivo `.tmp` ao lado de um dos três: é a
gravação atômica em andamento. **Ignore-o**; ele não é dado.

### ⛔ Leitura direta do disco, nunca `chamar_plugin`

A regra do sistema de plugins proíbe um plugin invocar código de outro. Ler
estes arquivos é a exceção documentada — "Consultar dados que outro plugin já
capturou", em `Como criar plugins.md` — porque o Plugin base declara este
formato como contrato público, aqui e no próprio código.

⚠️ **O `backend/plugin.py` do Plugin base tem, sim, ações de consulta**
(`carregar_dados`, `carregar_arquivos`, `carregar_dia`, além de `listar`,
`carregar_config`, `salvar_config`, `deletar` e `capturar_agora`). Elas existem
para a **tela do próprio plugin**, e não para você. ⛔ Não chame
`chamar_plugin('Plugin base', …)`: se o usuário desligar o Plugin base, a sua
chamada passa a falhar; ler o arquivo continua funcionando. E, entre as oito,
uma **apaga dado** — invocar o backend de outro plugin é exatamente o tipo de
acoplamento que a regra existe para evitar.

⛔ **Só leitura.** Nunca escreva, edite ou apague nada dentro de `Plugin base/`,
mesmo sendo dado. É a mesma regra central de qualquer plugin: cada um só grava
dentro da própria pasta.

### Exemplo de leitura, em Python, de dentro do `backend/plugin.py` de OUTRO plugin

O caminho é montado a partir da posição do próprio arquivo — nunca absoluto,
nunca digitado fixo, e **nunca com um número fixo de `..`**: o seu plugin pode
estar na raiz de `plugins/` ou dentro de uma categoria, e a profundidade muda.
Suba até achar a pasta `plugins`, que é a única constante.

```python
import json
import os


def _pasta_de_plugins():
    p = os.path.dirname(os.path.abspath(__file__))
    while os.path.basename(p) != 'plugins':
        pai = os.path.dirname(p)
        if pai == p:
            raise RuntimeError('não achei a pasta plugins acima de mim')
        p = pai
    return p


def _pasta_do_plugin_base(projeto):
    nome = os.path.basename(str(projeto or '').strip())   # nunca aceite "../"
    return os.path.join(_pasta_de_plugins(), 'Plugin base', 'files', nome)


def _carregar_json(caminho):
    try:
        with open(caminho, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return None      # o caso NORMAL: nunca capturado. Não é erro.
    except (OSError, json.JSONDecodeError) as e:
        print('[meu plugin] não deu para ler', caminho, ':', e)
        return None


def carregar_retrato(projeto):
    return _carregar_json(os.path.join(_pasta_do_plugin_base(projeto), 'atual.json'))


def listar_dias(projeto):
    """Os dias que TÊM registro, em ordem. Só nomes — não abre nada."""
    pasta = os.path.join(_pasta_do_plugin_base(projeto), 'dias')
    try:
        return sorted(n[:-5] for n in os.listdir(pasta) if n.endswith('.json'))
    except OSError:
        return []


def carregar_dia(projeto, dia):
    return _carregar_json(
        os.path.join(_pasta_do_plugin_base(projeto), 'dias', dia + '.json'))
```

⚠️ Repare no `os.path.basename` sobre o nome do projeto: sem ele, um nome com
`..` sairia da pasta. É barato e evita um problema que não se investiga depois.

---

## 4 · `atual.json` — o retrato de agora

```json
{
  "versao": 2,
  "projeto": "Nome do projeto",
  "root_folder": "C:\\caminho\\do\\projeto",
  "working_folders": ["C:\\caminho\\do\\projeto\\Program"],
  "atualizado_em": "2026-08-30T15:26:04",
  "historico_desde": "2026-08-30",
  "totais": { "arquivos": 462, "linhas": 93699 },
  "tempos": {
    "rotinas_segundos": 7428.7,
    "fila_segundos": 5375.3,
    "chat_segundos": 1084.2,
    "chat_aproximado": true
  }
}
```

São **oito chaves, e nada além disso**. Não há dado por linguagem, por extensão,
por tamanho em bytes nem por contagem de funções — se o seu plugin precisa
disso, ele calcula por conta própria.

| Chave | O que é |
|---|---|
| `versao` | inteiro, hoje **`2`**. Se um dia mudar de forma incompatível, o número sobe. Um plugin cuidadoso confere isto **antes** de assumir a forma das outras chaves |
| `projeto` | o mesmo nome usado na pasta — redundante de propósito, para quem recebeu o JSON solto ainda saber de qual projeto é |
| `root_folder` / `working_folders` | o escopo que gerou este dado. Servem para reconhecer que um projeto renomeado é o mesmo de antes |
| `atualizado_em` | ISO 8601, **hora local**, da última captura completa |
| `historico_desde` | o dia da primeira captura deste projeto. **Antes dele não há "zero mudanças", há "nenhuma informação"** — a diferença importa para quem desenha um gráfico |
| `totais` | `{arquivos, linhas}`. ⚠️ Com a categoria desligada, vira **`{}`** — a chave continua existindo (ver a [parte 8](#8--as-pegadinhas-de-categoria-desligada)) |
| `tempos` | três somas acumuladas + a flag `chat_aproximado` |

---

## 5 · `arquivos.json` — um registro por arquivo

```json
{
  "Program/Code/backend/principal.py": {
    "modificado": 1787915426.7,
    "criado": 1787913240.3,
    "linhas": 17
  },
  "Program/Code/assets/logo.png": {
    "modificado": 1787915426.7, "criado": 1787913240.3,
    "linhas": null, "binario": true
  }
}
```

- **`modificado` e `criado`** são **epoch em segundos** (`float`), no fuso
  **local** da máquina que capturou, não UTC. Para virar data legível:
  `datetime.fromtimestamp(v)` em Python, ou `new Date(v * 1000)` em JavaScript
  (repare no `* 1000`: JS espera milissegundos). `criado` vem de `st_ctime`, que
  **no Windows é a data de criação de verdade** — em outros sistemas seria a
  data de mudança do inode.
- **`linhas`** é a contagem de quebras de linha. É `null` em dois casos, e eles
  são diferentes: com `"binario": true`, é um arquivo que não é texto e contar
  linhas dele não significaria nada; **sem** essa flag, o arquivo não pôde ser
  aberto no meio da varredura (apagado entre listar e ler, ou permissão negada).
  Nos dois casos, `null` quer dizer **"não sei" — nunca zero**.
  Um arquivo só é considerado binário quando os primeiros 8 KB **falham** a
  decodificação UTF-8 **e** têm um byte zero. Byte zero sozinho não basta: este
  projeto tem código que usa `'\x00'` como separador de propósito, e uma peneira
  mais frouxa marcaria esses fontes como binários — as linhas deles sumiriam da
  contagem e as edições futuras neles virariam eventos que não somam nada.
- **A chave (o caminho)** vem **filtrada pelo escopo do projeto**: só arquivos
  dentro de `working_folders`, descontando o que o usuário marcou em "Remover" e
  em "Contexto sem leitura" nas Configurações do projeto, e descontando também
  pastas técnicas puras (`.git`, `node_modules`, `__pycache__`, `.venv`, `venv`,
  `dist`, `build`, e **qualquer pasta que comece com `.`**). **Não é** a árvore
  de arquivos inteira do projeto. Se o seu plugin precisa de algo fora disso,
  este dado não serve.
- **A ordem das chaves não é contrato.** É um objeto JSON; se o seu plugin
  precisa de uma ordem, ordene você mesmo depois de ler.

### ⚠️ O prefixo do caminho, e as duas surpresas dele

**O caminho sempre começa pelo nome da pasta de trabalho** (`Program/...`),
mesmo quando o projeto só tem uma. Isso é de propósito: se o prefixo aparecesse
só ao existir uma segunda pasta, acrescentar uma mudaria todas as chaves de uma
vez, e o histórico leria o projeto inteiro como apagado e recriado no mesmo dia.

Duas surpresas para quem faz parsing desse prefixo:

1. **Ele pode ter duas partes.** Se duas `working_folders` terminam no mesmo
   nome (`.../api/src` e `.../web/src`), o prefixo passa a incluir a pasta-mãe:
   `api/src/...` e `web/src/...`.
2. **Ele pode ter um sufixo numérico.** Quando nem a pasta-mãe desambigua, o
   segundo vira `src (2)/...`.

Ou seja: **não presuma que o primeiro segmento do caminho é um identificador
estável de pasta de trabalho**. Se você precisa mapear caminho → pasta de
trabalho, compare com a lista `working_folders` do `atual.json` em vez de
adivinhar pelo prefixo.

---

## 6 · `dias/{dia}.json` — o que mudou naquele dia

É este arquivo que torna possível uma linha do tempo. Ele **só cresce**: um dia
já gravado nunca é reconstruído do zero.

```json
{
  "versao": 2,
  "dia": "2026-08-30",
  "primeira_captura": false,
  "eventos": [
    { "tipo": "criado",  "caminho": "Program/Code/x.py", "linhas": 42,
      "quando": "2026-08-30T09:40:00", "visto_em": "2026-08-30T10:15:00", "origem": "mtime" },
    { "tipo": "editado", "caminho": "Program/Code/y.js", "linhas": 88, "linhas_antes": 61,
      "quando": "2026-08-30T10:12:00", "visto_em": "2026-08-30T10:15:00", "origem": "mtime" },
    { "tipo": "apagado", "caminho": "Program/Code/z.py", "linhas_antes": 30,
      "quando": null, "visto_em": "2026-08-30T10:15:00", "origem": "captura" },
    { "tipo": "movido",  "de": "Program/a/x.py", "para": "Program/b/x.py", "linhas": 42,
      "quando": "2026-08-30T11:03:00", "visto_em": "2026-08-30T11:15:00", "origem": "mtime" }
  ],
  "fechamento": {
    "arquivos": 462, "linhas": 93699,
    "linhas_ganhas": 1240, "linhas_perdidas": 380, "linhas_desconhecidas": 0,
    "arquivos_criados": 3, "arquivos_editados": 27,
    "arquivos_apagados": 1, "arquivos_movidos": 0,
    "capturas": 14,
    "primeira_captura_em": "2026-08-30T08:00:00",
    "ultima_captura_em": "2026-08-30T17:45:00",
    "tempos": { "rotinas_segundos": 7428.7 },
    "tempos_no_dia": { "rotinas_segundos": 320.5 }
  }
}
```

### Os cinco tipos de evento

| `tipo` | Campos próprios | Observação |
|---|---|---|
| `criado` | `caminho`, `linhas` | `quando` vem do `criado` (ctime) do arquivo |
| `editado` | `caminho`, `linhas`, `linhas_antes` | `quando` vem do `modificado` (mtime) |
| `apagado` | `caminho`, `linhas_antes` | `quando` é **sempre `null`** — o arquivo sumiu, não há o que consultar |
| `movido` | `de`, `para`, `linhas` | um `apagado` + um `criado` da mesma captura, com mesmo nome, mesmas linhas e mesmo mtime |
| `projeto_renomeado` | `de`, `para` | a pasta de dados foi readotada depois de o projeto ser renomeado |

São **exatamente esses cinco**. Todo evento tem também `origem` e, quando o
arquivo é binário, `"binario": true`.

⚠️ Repare que `movido` e `projeto_renomeado` **não têm `caminho`** — têm `de` e
`para`. Um `evento['caminho']` cego estoura nesses dois.

### `quando` × `visto_em` × `origem` — o trio que evita conta errada

- **`quando`** é o que o **sistema de arquivos alega**: o carimbo do próprio
  arquivo. Pode ser `null`.
- **`visto_em`** é a **captura que percebeu** a mudança. Sempre presente.
- **`origem`** diz de qual dos dois saiu o dia em que o evento foi arquivado:
  - `"mtime"` — o carimbo do arquivo caiu dentro da janela entre a captura
    anterior e esta, então é confiável e o evento foi para o dia dele. **É isto
    que faz o programa fechado por três dias registrar as mudanças nos dias
    certos, retroativamente.**
  - `"captura"` — o carimbo foi recusado (antigo demais, ou no futuro) e o
    evento foi para o dia da captura. Acontece em restauração de backup,
    `unzip`, `robocopy` e sync, que preservam o mtime original. Sem essa recusa,
    despejar uma pasta antiga no projeto faria nascer um `dias/2019-04-12.json`
    — dia inventado.

Se o seu plugin mostra a data de um evento ao usuário, `origem: "captura"`
merece uma marca discreta: aquela data é "quando eu vi", não "quando foi".

### `fechamento` — e as três armadilhas dele

- ⚠️ **`fechamento` é o retrato da captura mais recente DAQUELE dia**, não o
  estado no fim do dia. Se o programa foi fechado às 18h, é o retrato das 18h. E
  quando um evento antigo é arquivado num dia passado (pela recusa de mtime
  acima), o retrato daquele dia **não** é recalculado — não há como recontar as
  linhas de ontem hoje. Não some deltas de `fechamento` esperando que a conta
  feche; para "quanto mudou no dia", use `linhas_ganhas`/`linhas_perdidas`, que
  são recalculados dos eventos a cada gravação.

- ⚠️ **Um dia tem TRÊS estados, e o discriminante é `fechamento.capturas`** —
  não `fechamento == null`, que na prática nunca chega a ser gravado:

  | Estado | Como reconhecer | O que quer dizer |
  |---|---|---|
  | **sem informação** | o arquivo do dia **não existe** em `dias/` | o programa não rodou naquele dia: "não sei", não "nada aconteceu" |
  | **zero de verdade** | o arquivo existe, `fechamento.capturas >= 1`, `eventos: []` | rodou e nada mudou — aqui um zero é honesto |
  | **parcial** | o arquivo existe, mas **`fechamento.capturas` está ausente** | há eventos, mas `arquivos` e `linhas` daquele dia são desconhecidos |

  O terceiro caso aparece quando um evento é datado **retroativamente** num dia
  que nunca teve captura: o Plugin base cria o arquivo daquele dia e preenche os
  contadores de evento, mas não tem como saber o retrato — não dá para recontar
  as linhas de um dia que já passou. Tratar esse dia como um dia normal faz
  `arquivos` chegar `undefined` na tela.

  Um gráfico honesto desenha **buraco** no primeiro caso — nunca interpola entre
  o dia anterior e o seguinte, e nunca desenha uma coluna zerada.

- ⚠️ **`linhas_ganhas` e `linhas_perdidas` vêm separadas de propósito**, as duas
  positivas. O dia em que alguém reescreve 3.000 linhas tem saldo líquido zero;
  só os dois números separados mostram que houve trabalho. Se o seu plugin quer
  o líquido, subtraia você — o contrário não é possível.

`linhas_desconhecidas` conta os eventos em que não deu para medir a diferença
(um dos lados era `null`). Binário não entra nessa conta: não é ignorância, é um
número que não faria sentido.

`tempos_no_dia` é o quanto foi gasto **naquele dia**, já calculado contra o
último dia com fechamento — use ele em vez de subtrair `tempos` de dias
consecutivos, que quebra em todo dia sem captura. Vem **vazio** na primeira
captura de um projeto, quando não existe dia anterior com que comparar.

---

## 7 · `tempos`: são somas acumuladas, não sessões

`rotinas_segundos`, `fila_segundos` e `chat_segundos` são **totais desde
sempre** (desde a primeira captura que os viu), não uma lista de eventos com
início e fim. Para "quanto rodou hoje", use `tempos_no_dia` do fechamento.

`chat_segundos` sempre vem com `chat_aproximado: true` — é o `created_at` do
chat até a hora de modificação do próprio arquivo de conversa, não a duração
real da conversa (alguém pode ter deixado a janela aberta sem digitar nada).
**Não apresente este número como exato.** Ele também pode **diminuir** se o
usuário apagar uma conversa; um "acumulado" que encolhe é esperado aqui.

⚠️ A flag `chat_aproximado` é gravada **sempre que a categoria está ligada**,
mesmo com `chat_segundos: 0.0`. Ela não é sinal de que há dado de chat.

---

## 8 · As pegadinhas de categoria desligada

O usuário pode desligar cinco das seis categorias, e **nenhuma delas some do
jeito que você esperaria**. Esta é a seção que mais evita conta errada.

| Categoria desligada | O que acontece de verdade |
|---|---|
| **Contagem de arquivos e linhas** | `totais` vira **`{}`** — um dicionário vazio, **não some**. Quem testa `'totais' in dado` acha que tem dado. Teste `dado.get('totais', {}).get('arquivos')` |
| **Contagem de arquivos e linhas** (no fechamento do dia) | `fechamento.arquivos` e `fechamento.linhas` viram **`null` explícito**. Isso é diferente do dia "parcial" (onde `capturas` está ausente): aqui houve captura, só não há contagem |
| **Mudanças por dia** | **nenhum arquivo de dia é escrito**, inclusive o do dia corrente. O buraco em `dias/` fica **indistinguível** de "o programa não rodou naquele dia" |
| **Tempo em rotinas / fila / chat** | o valor **congela**: o último número conhecido é copiado adiante para sempre. Não vira `null`, não some — fica parado. Um consumidor vê um número que parece atual e está velho |
| **Lista de arquivos** | nada. A categoria é inerte; `arquivos.json` é gravado sempre |

O que isso significa para quem consome:

- **Nunca apresente `tempos` como "agora"** sem olhar `atualizado_em`. Se o
  número não muda entre duas capturas e o resto muda, a categoria foi desligada.
- **Nunca conclua "nada aconteceu nesse dia" a partir de um dia faltando.** Pode
  ser o programa fechado, pode ser a categoria desligada. Nos dois casos a
  resposta honesta é "não sei".
- **Sempre trate `null` e `{}` como "não sei"**, nunca como zero.

---

## 9 · O dado pode sumir — e o histórico pode rejuvenescer

A tela do Plugin base tem um botão que **apaga a pasta de dados de um projeto**
(um `rmtree` da pasta inteira, com guarda para não sair de `files/`). O usuário
pode usar isso a qualquer momento, e o efeito para quem consome é:

- um projeto que **tinha** pasta pode voltar a **não ter** — trate isso como
  "sem dado ainda", como qualquer projeto novo;
- `historico_desde` pode **rejuvenescer**: na captura seguinte ele passa a ser
  hoje, e todo o histórico anterior deixou de existir;
- qualquer cache que o seu plugin tenha feito em cima desse dado fica órfão.
  Se o seu plugin guarda algo derivado, guarde junto o `atualizado_em` (ou o
  `historico_desde`) que gerou aquilo, e recalcule quando ele andar para trás.

Existe também um botão **"Capturar agora"** na tela, mas ele é **ação manual do
usuário** — um plugin novo não tem como pedir uma captura sob demanda (pediria
chamar o backend do Plugin base, e isso é proibido).

---

## 10 · Leitura durante a escrita — por que isso é seguro

O Plugin base grava com `.tmp` + `os.replace()` (nunca escreve direto no arquivo
final) exatamente para que outro plugin possa ler a qualquer momento, mesmo
enquanto uma captura está em andamento, sem risco de pegar um JSON pela metade.
O pior caso possível é ler a versão **anterior** à que está sendo gravada agora
— nunca um arquivo corrompido. No Windows, o `replace` ainda tem **três
tentativas** em `PermissionError`, para o caso de um antivírus segurar o arquivo
por um instante.

A gravação também tem uma ordem que importa para quem lê: os arquivos de `dias/`
são gravados **antes** de `atual.json` e `arquivos.json`. Isso quer dizer que,
num instante muito específico, `dias/` pode estar uma geração à frente do
retrato. Não é problema para leitura — é o que garante que uma queda no meio da
captura não perca eventos (a captura seguinte recalcula o mesmo diff, e o dedupe
absorve).

Ainda assim, envolva toda leitura em `try/except`: o arquivo pode não existir
ainda, ou o disco pode falhar por outro motivo. Nunca deixe a exceção subir.

---

## 11 · Dado sempre pode estar desatualizado — e isso é esperado

A captura é **periódica** (intervalo configurável, padrão 15 minutos) e não
reage a evento nenhum — não existe hoje um jeito de um projeto avisar "algo
mudou, capture agora".

Use `atualizado_em` para saber a idade do dado, e se for relevante para a
experiência do seu plugin, mostre isso ao usuário ("dado de há 12 minutos") em
vez de apresentar como se fosse ao vivo.

### O que a captura periódica não consegue ver

Quatro limitações que são da natureza de varrer de tempos em tempos, e que
nenhum ajuste de intervalo resolve. Documente-as na tela do seu plugin em vez de
fingir precisão:

- **Arquivo criado e apagado entre duas capturas é invisível.** Ele nunca
  existiu, do ponto de vista do histórico.
- **`mtime` só guarda a última edição.** Um arquivo editado nos dias 1, 2 e 3,
  com a primeira captura só no dia 4, gera **um** evento, no dia 3. Os dias 1 e
  2 não são "dias sem trabalho" — são dias sem informação.
- **Duas edições no mesmo arquivo entre duas capturas viram uma.** O `linhas_antes`
  é o da captura anterior, não o da edição anterior.
- **Renomear um projeto é readotado sozinho** no ciclo seguinte: a pasta antiga
  em `files/` é reconhecida pelo `root_folder` e pelas `working_folders` (que o
  rename não toca) e renomeada — ou, se o projeto novo já tiver começado um
  histórico próprio, os dois são costurados (eventos deduplicados, contadores
  recalculados, `historico_desde` corrigido). Uma órfã antiga de OUTRO projeto
  em `files/` não atrapalha. O que quebra a readoção é **mover a pasta raiz e
  renomear ao mesmo tempo**, ou **dois projetos novos apontando para a mesma
  raiz**: aí a pasta antiga fica órfã em `files/`, e o plugin a lista na tela
  para o usuário decidir.

⚠️ Consequência da readoção para quem consome: **a pasta `files/{projeto}/` pode
mudar de nome sem aviso**, e um `projeto_renomeado` aparece nos eventos daquele
dia. Se o seu plugin guarda o nome do projeto em algum cache, ele precisa
tolerar isso.

---

## 12 · Exemplos de uso

| O que você quer | O que abrir | O que **não** precisa abrir |
|---|---|---|
| **Um selo no cartão de um projeto** ("1.234 linhas · atualizado há 20 min") | `atual.json` — meio quilobyte | tudo o resto |
| **Um alerta de projeto parado** ("nenhuma atividade há 9 dias") | os **nomes** em `dias/` (`os.listdir`), e o `fechamento` do último | `arquivos.json` |
| **Uma linha do tempo** | um `dias/{dia}.json` por dia do intervalo | `arquivos.json` |
| **Um gráfico de linhas ganhas/perdidas** | só o `fechamento` de cada dia | os `eventos` |
| **Um mapa de arquivos mais antigos** | `arquivos.json` | `dias/` |

⚠️ Para a linha do tempo, **itere um intervalo de datas contíguo** — não os
arquivos que existem. Dia sem arquivo é **buraco**, e o gráfico tem de mostrar
isso, não pular o dia nem desenhar zero.

```python
from datetime import date, timedelta

def dias_do_intervalo(inicio, fim):
    """Todos os dias entre os dois, inclusive — inclusive os que faltam."""
    d = date.fromisoformat(inicio)
    ate = date.fromisoformat(fim)
    while d <= ate:
        yield d.isoformat()
        d += timedelta(days=1)


def estado_do_dia(projeto, dia):
    dado = carregar_dia(projeto, dia)
    if dado is None:
        return 'sem_informacao'                  # buraco no gráfico
    fech = dado.get('fechamento') or {}
    if 'capturas' not in fech:
        return 'parcial'                         # eventos sim, retrato não
    return 'ok'
```

---

## 13 · Quando a conta não fecha: sintoma → causa

| Sintoma | Causa quase certa |
|---|---|
| **`atual.json` não existe** | aquele projeto nunca foi capturado, ou o usuário apagou o dado dele. Não é erro |
| **`totais.arquivos` chegou `undefined`** | a categoria "Contagem de arquivos e linhas" está desligada: `totais` é `{}`, não some |
| **`fechamento.arquivos` é `null`** | a mesma categoria desligada — diferente do dia "parcial" |
| **`fechamento.arquivos` é `undefined`** | dia **parcial**: `capturas` está ausente, porque o dia foi criado retroativamente |
| **A soma dos deltas de `fechamento` não bate** | `fechamento` é o retrato da última captura do dia, não do fim do dia. Use `linhas_ganhas`/`linhas_perdidas` |
| **Um dia aparece com zero e eu sei que trabalhei** | o programa não rodou: dia **ausente** é "não sei". Ou a categoria "Mudanças por dia" está desligada |
| **`dias/` parou de crescer** | a categoria "Mudanças por dia" foi desligada |
| **O tempo acumulado não muda mais** | aquela categoria de tempo foi desligada: o valor **congela**, não zera |
| **O tempo acumulado diminuiu** | esperado no chat: o usuário apagou uma conversa |
| **`evento['caminho']` estourou** | é um `movido` ou um `projeto_renomeado` — eles têm `de` e `para` |
| **`quando` veio `null`** | é um `apagado`. Use `visto_em` |
| **Uma data ficou visivelmente errada** | `origem: "captura"` — o carimbo do arquivo foi recusado. Marque isso na tela |
| **O prefixo do caminho não bate com nenhuma pasta de trabalho** | ele pode ter duas partes (`api/src`) ou sufixo (`src (2)`). Compare com `working_folders` |
| **`linhas` é `null` num arquivo de texto** | não deu para abrir na varredura (apagado no meio, permissão). `null` é "não sei" |
| **Um `.py` foi marcado como binário** | improvável, mas possível: os primeiros 8 KB falharam UTF-8 **e** tinham byte zero |
| **A pasta do projeto em `files/` mudou de nome** | readoção depois de renomear o projeto. Procure `projeto_renomeado` nos eventos |
| **Li um JSON pela metade** | não acontece: a gravação é `.tmp` + `os.replace`. Se aconteceu, você leu o `.tmp` — ignore-o |
| **O dado está 40 minutos velho** | o intervalo é do usuário, e a captura não reage a evento. Mostre a idade |
| **`versao` veio `3`** | o formato mudou de forma incompatível. **Pare e trate como sem dado** — não tente adivinhar |

---

## 14 · Antes de dar por pronto

O plugin que **consome** este dado deve conferir:

- [ ] Confere `versao == 2` antes de assumir a forma das outras chaves.
- [ ] Trata pasta ausente como "sem dado ainda", nunca como erro fatal.
- [ ] Toda leitura está em `try/except`, com `FileNotFoundError` tratado à parte
      (é o caso normal).
- [ ] O caminho do Plugin base é montado subindo até a pasta `plugins`, sem
      número fixo de `..`, e o nome do projeto passa por `os.path.basename`.
- [ ] Nunca chama `chamar_plugin('Plugin base', …)` nem importa código dele.
- [ ] Nunca escreve nada dentro de `Plugin base/`.
- [ ] `totais` ausente **ou `{}`** cai no mesmo caminho de "sem contagem".
- [ ] `null` e `undefined` nunca viram zero na tela.
- [ ] Dia ausente é **buraco** no gráfico, nunca coluna zerada nem interpolação.
- [ ] Dia **parcial** (sem `capturas`) é tratado à parte do dia normal.
- [ ] `linhas_ganhas` e `linhas_perdidas` são mostradas separadas, ou o líquido
      é calculado por você.
- [ ] `evento['caminho']` só é acessado nos tipos que o têm.
- [ ] `origem: "captura"` recebe uma marca discreta na tela.
- [ ] `chat_segundos` nunca é apresentado como exato.
- [ ] A idade do dado (`atualizado_em`) aparece para o usuário quando importa.
- [ ] Nenhuma suposição sobre o prefixo do caminho além de "existe".

---

## Resumo para decidir se manda este arquivo

| Se o plugin novo precisa de… | Mande este arquivo? |
|---|---|
| contagem de arquivos/linhas, lista de arquivos, o que mudou em cada dia, ou tempo em rotinas/fila/chat — mesmo que aproximado, mesmo que com alguns minutos de atraso | **Sim** |
| o mesmo tipo de dado, mas exato ou em tempo real | Não — construa do zero, este arquivo não serve |
| um arquivo que está em "Remover" ou fora de `working_folders` | Não — fora do escopo que o Plugin base captura |
| dado por linguagem, por extensão, em bytes, ou contagem de funções | Não — o Plugin base não guarda isso |
| qualquer outra coisa (sem relação com arquivos, linhas, mudanças ou tempo) | Não |

## Onde mais olhar

| Arquivo | O que tem |
|---|---|
| `Como criar plugins.md` | o contrato do plugin — **leitura obrigatória**, mandado este arquivo ou não |
| `A API do programa.md` | os métodos de `window.pywebview.api` — **leitura obrigatória** |
| `Program/External/plugins/Universais/Linha do tempo/` | o consumidor de referência: lê este dado direto do disco, trata buraco e dia parcial |
| `Program/External/plugins/Plugin base/` | o produtor. Leia, nunca escreva |
