# A API do programa

Este arquivo é o complemento de `Como criar plugins.md` — **leia aquele
primeiro**. Ele explica, em detalhe, como o frontend do seu plugin fala com o
backend do programa: o mecanismo por baixo do capô, o que já chega pronto sem
você pedir nada, quais métodos de leitura existem de verdade, como testar uma
chamada na prática, e como reconhecer com segurança o que mais dá para
consultar.

> **Não há API "para plugin".** É a mesma `window.pywebview.api` que a tela de
> Projetos, o Chat, a Fila, o Editor e todo o resto do programa usa — incluindo
> os métodos que gravam arquivo, mudam configuração ou apagam projeto inteiro.
> Nada filtra isso para você. A regra "um plugin só lê" é **disciplina sua**,
> não uma parede que o programa ergueu, e esta página é o mapa de onde ela
> passa.

---

## Sumário

| Parte | O que tem |
|---|---|
| [1 · Por baixo do capô](#1--por-baixo-do-capô-o-que-é-windowpywebviewapi) | o que é `js_api`, e as três consequências para quem escreve plugin |
| [2 · Anatomia de uma chamada](#2--anatomia-de-uma-chamada) | passo a passo, o que atravessa e o que não atravessa |
| [3 · Erros: dois caminhos diferentes](#3--erros-dois-caminhos-diferentes) | ⚠️ o traceback chega num caso e **se perde** no outro |
| [4 · O que já chega pronto](#4--o-que-já-chega-pronto-sem-você-chamar-nada) | o payload enriquecido e o `contexto` |
| [5 · Os métodos de leitura](#5--os-métodos-de-leitura-que-valem-a-pena-conhecer) | as tabelas, por assunto, com o formato de retorno exato |
| [6 · `browse_path`](#6--browse_pathfolder--o-único-que-foge-do-padrão-e-pode) | o diálogo nativo, e a exceção estreita que ele abre |
| [7 · Como reconhecer o que é seguro](#7--como-reconhecer-se-um-método-é-seguro-para-o-seu-plugin-chamar) | os prefixos, as convenções finas, e os contra-exemplos reais |
| [8 · Não existe push](#8--não-existe-push-para-plugin) | como o programa fala com a tela, e por que você não entra nisso |
| [9 · A outra metade da API](#9--a-outra-metade-da-api-o-que-já-está-na-página) | funções, globais e bibliotecas que não passam pela ponte |
| [10 · Testando uma chamada](#10--testando-uma-chamada-sem-escrever-plugin-nenhum) | no console do DevTools, antes de escrever código |
| [11 · Sintomas e causas](#11--quando-não-funciona-sintoma--causa) | a tabela |

---

## 1 · Por baixo do capô: o que é `window.pywebview.api`

O programa é feito com [pywebview](https://pywebview.flowrl.com/): a janela que
você vê é um navegador embutido (WebView2, no Windows), e quem desenha o
HTML/CSS/JS é o mesmíssimo motor de renderização do Chrome/Edge — é por isso que
o programa parece um site, mas roda como app de desktop, sem servidor.

A ponte entre esse navegador embutido e o processo Python que roda por trás se
chama **`js_api`**. No arranque do programa (`Assistente de código
vibe-coding.pyw`), acontece isto:

```python
api = Api()                      # uma instância só, viva o programa inteiro
window = webview.create_window(
    ...,
    js_api=api,                  # é ISSO que vira window.pywebview.api no JS
)
```

`Api` (em `Program/Code/backend/api.py`) não é uma classe pequena. Ela junta,
por herança múltipla, **104 classes `Mixin`** escritas uma por linha no topo do
arquivo — e **26 dessas 104 herdam de outras**, o que dá **170 mixins efetivos**
e **449 métodos públicos**, espalhados por 228 arquivos em
`Program/Code/backend/modulos/`.

O pywebview varre essa instância **inteira**, recursivamente, junta todo método
público de todas elas (nenhuma fica de fora, nenhuma tem namespace próprio) e
monta, do lado do JavaScript, um objeto **plano** com todos eles — é por isso
que `window.pywebview.api.list_projects()` e
`window.pywebview.api.chamar_plugin()` convivem no mesmo objeto, apesar de virem
de arquivos completamente diferentes do backend.

> Curiosidade que mostra o tamanho da varredura: existe uma linha em
> `Assistente de código vibe-coding.pyw` marcando `window._serializable = False`
> só para o pywebview **não** tentar varrer os atributos internos da própria
> janela (que teria caído num objeto .NET recursivo e travado o boot). Ou seja:
> por padrão, ele tenta varrer *tudo* que for atributo público do objeto passado
> como `js_api`.

Três consequências práticas, para quem escreve um plugin:

1. **Não existe uma API "para plugin"**, menor ou mais segura. A regra é sua,
   não do programa.
2. **O nome do método é quase tudo que você tem** para adivinhar o que ele faz
   antes de olhar o código — não há categoria, tag nem anotação separando
   leitura de escrita. A [parte 7](#7--como-reconhecer-se-um-método-é-seguro-para-o-seu-plugin-chamar)
   dá o critério, e os contra-exemplos.
3. Como é **uma instância única e viva o processo inteiro**, um método que lê e
   outro que escreve podem compartilhar estado em memória (um cache, uma trava,
   uma fila). Isso não é problema seu — só explica por que nunca vale a pena
   tentar ler o código-fonte de um método e prever o resultado sem rodá-lo: o
   estado pode não estar só no que o método lê do disco.

⚠️ **Nem toda classe de um arquivo entra na `Api`.** Alguns arquivos definem
duas classes — a de trabalho e o mixin. `modulos/agentes/trava_ia.py` tem
`TravaIA` **e** `TravaIAMixin`; `parada_do_projeto.py` tem `ParadaDoProjeto`
**e** `ParadaDoProjetoMixin`. Só o `*Mixin` entra. Na prática: **`estado()`,
`ocupar()`, `parar()`, `retomar()`, `parado()` NÃO existem** em
`window.pywebview.api` — os expostos são `estado_trava_ia()`,
`projeto_parar()`, `projeto_retomar()`, `projeto_parado()`. Um método que você
viu no `.py` pode simplesmente não estar na ponte; confirme com
`Object.keys(window.pywebview.api)`.

---

## 2 · Anatomia de uma chamada

```js
const resposta = await window.pywebview.api.load_workspace('Meu Projeto');
```

O que acontece, passo a passo:

1. O JS empacota `'Meu Projeto'` e serializa a chamada; o pywebview manda isso
   para o processo Python, pelo canal interno da WebView2 — **não é HTTP, não
   tem porta, não aparece na aba Rede do DevTools**.
2. O Python abre uma **thread nova, só para essa chamada**, e roda
   `api.load_workspace('Meu Projeto')` nela — **não** é a thread da interface.
   Isso quer dizer que uma chamada demorada não congela a janela, e que duas
   chamadas ao mesmo tempo (a sua e a de outra parte do programa, ou duas do seu
   próprio plugin) rodam em paralelo de verdade quando o trabalho é de I/O.
   Python ainda tem o GIL, então trabalho de CPU pura serializa entre threads,
   mas ler disco não.
3. O que o método `return`a é serializado de volta para JSON: `dict` vira
   objeto, `list` vira array, `None` vira `null`, `True`/`False` viram
   `true`/`false`. Tipos sem equivalente direto em JSON (`set`, `datetime`, um
   objeto Python qualquer) **não** atravessam — se um método devolver algo
   assim, o plugin recebe erro ou `null`, então isso é sinal de método pensado
   só para consumo interno do programa, não para você.
4. A `Promise` do `await` resolve com esse valor já convertido.

Sempre `await` — mesmo quando parece que devolveria na hora, é sempre
assíncrono, porque atravessa esse canal entre processo e janela. E, depois de
todo `await`, valem as duas guardas da parte 8 de `Como criar plugins.md`: o
painel pode ter morrido, e uma resposta mais nova pode ter chegado antes.

### ⚠️ Nome de método errado nunca dá erro — trava para sempre

Quando o nome do método não existe (erro de digitação, método que você lembrou
errado, método que na verdade não está na ponte), o Python só grava um log
(`Function %s() does not exist`) e **não chama nenhum retorno** — nem sucesso,
nem erro. Do lado do JS, a `Promise` daquele `await` **nunca resolve e nunca
rejeita**: ela fica pendurada para sempre, em silêncio, sem lançar exceção
nenhuma que o seu `catch` consiga pegar.

Na prática, se o seu plugin travar numa tela de "Carregando…" sem erro nenhum no
console, o primeiro suspeito é um nome de método digitado errado — confira
contra `Object.keys(window.pywebview.api)` (ver a
[parte 10](#10--testando-uma-chamada-sem-escrever-plugin-nenhum)) antes de
procurar em outro lugar.

### Convenção de retorno — é do programa, não do pywebview

A maioria dos métodos segue este formato, por convenção, não por obrigação
técnica do framework:

```js
{ success: true,  ...outros campos... }
{ success: false, error: 'mensagem explicando o que deu errado' }
```

Mas **nem todo método segue isso**, e há dois desvios que quebram código:

**a) Nem todo retorno tem envelope.** Alguns devolvem o valor puro:

| Método | Devolve |
|---|---|
| `list_projects()` | `['Projeto A', 'Projeto B']` — array cru |
| `load_chat_extras(projeto, chat_id)` | o dicionário de extras, cru |
| `carregar_fila_historico(...)` · `carregar_fila_log(...)` | array (vazio se não houver) |
| `carregar_prompt_fixo(nome)` | a string, ou `None` |
| `montar_indice_regras(projeto)` | a string markdown (`''` se vazio) |
| `projeto_parado(projeto)` | booleano |
| `estado_trava_ia()` | o dicionário de estado |
| `resumo_para_copiar(projeto)` | `{started: true, trava: …}` — **sem `success`** |

**b) `success: false` não implica payload vazio.** Vários métodos devolvem dado
utilizável junto com a falha:

| Método | O que vem junto do `success: false` |
|---|---|
| `load_workspace(projeto)` | **`config` preenchido com o padrão** |
| `list_models()` | `models: []` |
| `list_extensoes_programa()` | `arvore` vazia, mas bem formada |

Um `if (!r.success) return null;` cego joga fora um padrão perfeitamente
utilizável. **Sempre confira o formato do método específico antes de usar.**

---

## 3 · Erros: dois caminhos diferentes

Esta é a distinção que mais custa tempo de depuração, e ela não é óbvia: o erro
de um método **do programa** e o erro **do seu próprio backend** chegam de
formas completamente diferentes.

### 3.1 · Erro dentro de um método da `Api`

Todo método do programa que pode falhar de um jeito **esperado** (arquivo não
existe, JSON corrompido, nome inválido) captura a própria exceção e devolve
`{'success': False, 'error': str(e)}` — nunca deixa a exceção subir. Esse
caminho não vira erro de JS nenhum: é um retorno normal com `success: false`.

Já se a exceção **escapar** do método — um bug real do programa, ou um argumento
seu com o tipo errado — o **pywebview** (não o programa) pega essa exceção e
manda para o JS um `Error` de verdade, com três campos preenchidos:

| Campo do `Error` | Vem de |
|---|---|
| `error.message` | `str(exceção)` |
| `error.name` | o nome da classe da exceção (`KeyError`, `TypeError`, …) |
| `error.stack` | o **traceback completo do Python**, como texto |

Ou seja: **o traceback do Python chega inteiro no seu `catch`**, dentro de
`error.stack`. Vale a pena logar `error.stack`, não só `error.message`: é a
diferença entre "deu erro" e saber exatamente qual linha do `.py` estourou.

```js
async function carregarWorkspace(projeto) {
  try {
    const r = await window.pywebview.api.load_workspace(projeto);
    if (!r.success) {
      console.error('[meu plugin] load_workspace falhou:', r.error);
      return r.config || null;      // o padrão ainda serve
    }
    return r.config;
  } catch (e) {
    // e.stack tem o traceback do Python inteiro — não só e.message.
    console.error('[meu plugin] chamada quebrou:', e.message, '\n', e.stack);
    return null;
  }
}
```

### 3.2 · ⚠️ Erro dentro do SEU backend — o traceback se perde

**Isto NÃO vale para `chamar_plugin`.** O programa embrulha o seu `executar()`
num `try/except` próprio e devolve:

```js
{ success: false, error: 'Erro dentro do plugin: <str(e)>' }
```

Repare no que sumiu: **não é um `Error` de JS**, não há `error.stack`, não há
`error.name`, e **o traceback do Python não atravessa**. O seu `catch` nunca é
acionado, e você fica com uma linha de texto — quase sempre inútil, do tipo
`Erro dentro do plugin: 'linhas'`.

Há mais três mensagens que vêm por esse mesmo caminho, e reconhecê-las poupa
tempo:

| `error` recebido | O que aconteceu |
|---|---|
| `Falha ao carregar o plugin: …` | o `backend/plugin.py` estourou **ao ser importado** — erro de sintaxe, ou código de nível de módulo que quebrou |
| `Plugin sem backend/plugin.py.` | o arquivo não existe, ou não está em `backend/` |
| `backend/plugin.py não define executar().` | a função tem outro nome, ou está dentro de uma classe |
| `Erro dentro do plugin: …` | o seu `executar()` deixou uma exceção subir |

**A providência**, do lado do seu backend, é imprimir o traceback você mesmo —
ele vai para o terminal de onde o programa foi lançado, o único lugar onde ele
aparece inteiro:

```python
import traceback

def executar(payload):
    try:
        ...
    except Exception as e:
        traceback.print_exc()                                   # terminal
        return {'success': False, 'error': '%s: %s' % (type(e).__name__, e)}
```

### 3.3 · Sempre `try`/`catch`, dos dois lados

Nunca deixe um `await window.pywebview.api.algumaCoisa()` solto no meio do seu
código sem rede de segurança. Sem `catch`, uma exceção que escapou vira uma
exceção não tratada também no seu JS, e derruba a tela inteira do plugin, não só
aquela chamada.

---

## 4 · O que já chega pronto, sem você chamar nada

Antes de sair chamando a API para montar contexto, veja se o programa já não
resolveu isso para você — **isso evita uma chamada extra e evita reimplementar
lógica que já existe.** Dois canais:

### `chamar_plugin(caminho, payload)`

`caminho` é o caminho relativo do seu plugin dentro de `External/plugins/` (é só
o nome da pasta, a menos que o usuário tenha organizado o plugin dentro de uma
categoria — nesse caso é `"Subpasta/Nome do plugin"`; derive de
`document.currentScript.src`, nunca escreva fixo).

Quando você manda `payload['projeto']` preenchido, o `payload` que chega no seu
`backend/plugin.py::executar()` vem com três chaves a mais, já resolvidas:

| Chave | O que é | Se não houver |
|---|---|---|
| `pasta_projeto` | o `root_folder` daquele projeto | **a chave existe, com valor `None`** |
| `grafo_imports` | o `grafo.json` **inteiro e cru** do Grafo de Imports | **a chave fica ausente** |
| `pipeline` | o retorno inteiro de `get_visualizar_pipeline_result` (com `success: true` dentro) | **a chave fica ausente** |

⚠️ A assimetria é de propósito e muda o seu `if`: para `pasta_projeto`, teste o
**valor**; para os outros dois, teste a **presença** (`'grafo_imports' in
payload`).

⚠️ **Sem `payload['projeto']`, nenhuma das três é acrescentada.** Na sub-aba
"Tela principal", mande o projeto que o usuário escolheu no seu seletor.

Isso poupa você de chamar `load_workspace` + ler o `grafo.json` +
`get_visualizar_pipeline_result` na mão, um por um.

⚠️ E lembre que `pasta_projeto` é o `root_folder`, **não o escopo do projeto** —
ver `Como criar plugins.md` › parte 12.

### `contexto`

O segundo argumento de `window.montarPlugin(container, contexto)` já traz
`contexto.projeto`, sem precisar perguntar nada. É a única chave que existe.

### Quando recorrer à API mesmo assim

Só para o que **não** vem por esses dois canais — por exemplo, quando você
precisa do workspace de um projeto **diferente** do que está aberto, quando o
plugin está na "Tela principal" e ainda não tem projeto escolhido, ou quando
você quer algo que não seja workspace/grafo/pipeline.

---

## 5 · Os métodos de leitura que valem a pena conhecer

Todos abaixo foram conferidos no código. **"sem envelope"** quer dizer que o
retorno é o valor cru, sem `{success: …}` por fora.

### 5.1 · Projetos

| Método | Retorno | Para que serve |
|---|---|---|
| `list_projects()` | **sem envelope** — array de nomes, ordenado sem diferenciar maiúscula | o seletor de projeto na "Tela principal". ⚠️ Ele também faz `os.makedirs` da pasta de projetos — ver a [parte 7](#7--como-reconhecer-se-um-método-é-seguro-para-o-seu-plugin-chamar) |
| `carregar_todas_descricoes()` | `{success, descricoes: {projeto: texto}}` | mostrar a descrição junto do nome no seletor |
| `carregar_descricao_do_projeto(nome)` | `{success, descricao}` (string vazia se não houver) | a mesma coisa, para um só |
| `carregar_taxonomia_de_projetos()` | `{success, ...}` — grupos, subgrupos, tags e a atribuição por projeto, **achatados no topo** (não há chave `dados`) | agrupar e colorir projetos como o programa faz |
| `projeto_parado(nome)` | **sem envelope** — booleano | saber se o projeto está em pausa |

### 5.2 · Workspace, arquivos e código

| Método | Retorno | Para que serve |
|---|---|---|
| `load_workspace(projeto)` | `{success: true, config: {...}}`; em erro, `{success: false, error, config: <padrão>}` | **o escopo de verdade do projeto**: `root_folder`, `working_folders`, `ignore_list`, `context_items`, `main_file`, `acervo_preset_ativo`, e ainda `activated`, `inicio_rapido`, `assistente_externo` |
| `get_folder_tree(caminho, max_depth=2)` | `{success, tree}` | a árvore de uma pasta qualquer do disco |
| `check_is_dir(caminho)` | valor simples | validar um caminho antes de usar |
| `ler_arquivo_de_codigo(projeto, caminho_relativo)` | `{success, content}` | ler um arquivo do projeto sem montar caminho absoluto |
| `editor_listar_pasta(projeto, caminho_relativo='', mostrar_ignorados=True)` | com envelope | navegar a árvore **com as regras de ignorados do programa já aplicadas** |
| `editor_ler_arquivo(projeto, caminho_relativo)` | com envelope | ler texto com detecção de codificação e de binário |
| `editor_caminho_absoluto(projeto, caminho_relativo)` | com envelope | traduzir relativo → absoluto |
| `editor_buscar_nome(...)` · `editor_buscar_conteudo(...)` | com envelope | busca por nome e por conteúdo, respeitando ignorados |
| `search_code_content(projeto, query, max_results=1000)` | com envelope | um grep no código do projeto |
| `get_file_lines(caminho, linha, context=5)` | com envelope | o trecho ao redor de uma linha |

⚠️ **Duas migrações silenciosas em `load_workspace`**, feitas na leitura e só em
memória (não gravam): `ignore_list` de strings antigas vira objetos
`{path, type, recursive}`, e `'MCP do Vibe-Coding'` vira `'Assistente'` na lista
de MCPs. O objeto que você recebe pode não ser idêntico ao arquivo em disco.

### 5.3 · Chats e conversas

| Método | Retorno | Para que serve |
|---|---|---|
| `list_chats(projeto)` | `{success: true, chats: [{id, title, created_at}]}`, mais novo primeiro | listar as conversas |
| `load_chat(projeto, chat_id)` | `{success: true, messages: [...], title}` | ler uma conversa inteira |
| `load_chat_extras(projeto, chat_id)` | **sem envelope** — o dicionário cru | config de subagentes e limites daquele chat |
| `get_prompt_fixo(nome, tela)` | `{success, content, prompt}` (os dois campos com o mesmo texto) | ler um prompt fixo |
| `carregar_prompt_fixo(nome, tela)` | **sem envelope** — string ou `None` | o mesmo, cru |

⛔ **`list_models()` faz chamada de rede** ao LM Studio (com timeout de 2 s).
Tem nome de leitura, mas não é leitura de disco — evite num plugin.

### 5.4 · Regras e Acervo

| Método | Retorno | Para que serve |
|---|---|---|
| `list_regras(projeto)` | `{success: true, regras: [...], pasta_existe: bool}` | as regras e instruções do projeto |
| `get_regras_stats(projeto)` | `{success, tokens, lines, files}` | o peso do acervo de regras |
| `get_regras_abs_paths(projeto)` | `{success, paths: [...]}` | os caminhos absolutos |
| `search_regras_content(projeto, query, max_results=20)` | `{success, results: [...]}` | buscar dentro das regras |
| `montar_indice_regras(projeto)` | **sem envelope** — string markdown | o índice pronto, **sem gravar** |
| `load_acervo_config(projeto=None, incluir_extensoes=True)` | com envelope | os presets do Acervo e o ativo do projeto |
| `listar_arvore_decisoes(projeto, pasta)` · `ler_arquivo_decisoes(...)` · `buscar_conteudo_acervo(...)` · `contar_na_pasta_acervo(...)` | com envelope | navegar, ler, buscar e contar no Acervo |
| `carimbo_do_acervo(projeto, pasta)` | com envelope | **a leitura barata para polling** — muda quando algo mudou |

### 5.5 · Fila e tarefas

| Método | Retorno | Para que serve |
|---|---|---|
| `load_fila_relatorio(projeto, tarefa_id)` | `{success: true, markdown}` | o relatório final de uma tarefa |
| `load_fila_frescor(projeto)` | `{success, defasado: bool, aviso}` | avisar que os índices estão velhos |
| `carregar_fila_historico(projeto, tarefa_id)` | **sem envelope** — array | o histórico do agente principal |
| `carregar_fila_log(projeto, tarefa_id)` | **sem envelope** — array | o log de chamadas de ferramenta |

⛔ **`load_fila_estado(projeto)` NÃO é leitura pura.** Apesar do `load_`, ele
chama a recuperação de tarefas órfãs e **grava**. O comentário no código diz
que ele é "o único chamador que tem direito de gravar". Um plugin não deve
chamá-lo.

### 5.6 · Rotinas e automação

| Método | Retorno | Para que serve |
|---|---|---|
| `get_acionamentos(projeto)` | `{success, settings: {...}}` | quais rotinas estão ligadas, e com que gatilho |
| `get_espera_status(projeto)` | `{success, ativo, vigiando, espera_ligada, algum_agente_ligado, debounces, debounce_segundos, aguardando_trava, bloqueado_por_projeto}` | **por que** a automação está (ou não) rodando |
| `get_agent_last_runs(projeto)` | `{success, last_runs: {...}, desfechos: {...}}` | quando cada rotina terminou, e como |
| `get_processando(projeto)` | `{success, processando, esperando, bloqueado_por_projeto}` | o que roda agora e o que vem a seguir |
| `get_rotinas_pendencias(projeto)` | `{success, pendencias, tem_pendencia, pendentes, quantos, parou_em, motivo, iniciado_em, finalizado_em}` | o que sobrou do último ciclo |
| `get_historico_da_automacao(projeto, limite=30)` | com envelope | o histórico de execuções |
| `get_erros_das_rotinas(projeto)` | `{success, erros: [...], por_rotina: {...}}` | os erros, agrupados |
| `get_cobertura_agentes(projeto)` | `{success, medidores: [...]}` | quanto do projeto cada rotina cobre |
| `load_rotinas_config(projeto)` | `{success, config: {agent_id: {...}}}` | a config por rotina, já mesclada com os padrões |
| `obter_catalogo_de_extensoes()` | `{success, grupos, extensoes}` | o cardápio de extensões de arquivo — **constante, não lê disco** |
| `get_dependencias_acionamentos()` | com envelope | o grafo de dependências entre rotinas |
| `get_paralelismo_real(projeto=None)` | com envelope | quantas rotinas rodam em paralelo |
| `estado_trava_ia()` | **sem envelope** — dicionário | se o modelo local está ocupado |

### 5.7 · Grafo, identificadores e símbolos

| Método | Retorno | Para que serve |
|---|---|---|
| `get_grafo_imports_status(projeto)` | existe → `{success: true, exists: true, total_files, total_edges}`; **não existe → `{success: true, exists: false}`, sem os dois totais** | saber SE o Grafo já rodou, sem carregar o `grafo.json` |
| `get_ligacoes(projeto)` | `{success: true, nos: [...], arestas: [...]}` — o peso da aresta é quantos nomes distintos a sustentam | o grafo de quem-usa-quem |
| `get_relacoes(projeto, arquivo)` | `{success: true, arquivo, usa: [{arquivo, via}], usado_por: [...]}` | os dois lados de um arquivo |
| `get_cascata(projeto, arquivo, max_nivel=3)` | com envelope | o impacto transitivo |
| `get_definicao_do_identificador(projeto, nome)` | `{success: true, arquivo, linha}` | "onde está" |
| `get_identificadores_status(projeto)` | `{success, existe, gerado_em, total_nomes, total_ocorrencias}` | se o índice existe |
| `list_arquivos_indexados(projeto)` | `{success, arquivos: [...]}` | o universo do índice |
| `get_symbol_index(projeto)` | `{success: true, index: {...}}` ou `index: null` | o índice de símbolos inteiro |
| `find_symbol_usages(projeto, nome)` | com envelope | os usos de um símbolo |
| `simbolos_para_autocomplete(projeto)` | `{success, simbolos: [...], truncado: bool}` | a lista leve e truncável |
| `get_hashes_status(projeto)` | `{success, existe, gerado_em, total}` | o baseline de hashes |
| `get_arquivos_mudados(projeto)` | `{success, baseline: bool, mudados: [...], removidos: [...], total}` | o que mudou desde a última indexação |
| `get_file_tree_metrics(projeto)` | com envelope | métricas por arquivo e por pasta |
| `analyze_imports(projeto)` | `{success, nodes: [{id, label, language, lines}], edges: [{source, target, label}]}` — **só lê**: varre o disco; quem grava o `grafo.json` é `run_grafo_imports_agent`, outro método | o grafo de imports por arquivo (Matriz de Dependências) |
| `scan_file_io(projeto)` | `{success, files: [{path, relative, folder, io_count, entries}], total_files, files_with_io}` — **só lê**; ⚠️ `path` e `folder` são absolutos | as operações de disco por arquivo (Matriz de I/O) |
| `get_mapa_niveis_result(projeto)` | `{success: true, …}` ou `{success: false, sem_pipeline: true, error}` — só lê o `_niveis.json` | o Mapa em níveis (Pipeline) |
| `load_render_mapas()` | `{success, render: {…}}` — só lê o JSON de Desempenho dos mapas | as configurações de Configurações › Desempenho dos mapas |

⚠️ **JSON corrompido também devolve `exists: false`**, nunca `success: false`.
"Não existe" e "existe mas está quebrado" chegam iguais.

⛔ **`verificar_hashes(projeto, processar=False)` não é leitura**: mesmo com
`False` ele abre thread e empurra resultado pela tela; com `True`, dispara o
ciclo inteiro de rotinas.

### 5.8 · Pipeline

| Método | Retorno |
|---|---|
| `get_visualizar_pipeline_status(projeto)` | `{success: true, pipeline_exists: bool}` — **é este que você chama quando só quer saber se já rodou** |
| `get_visualizar_pipeline_result(projeto)` | o resultado inteiro (abaixo), montado do `_niveis.json` da rotina Pipeline, ou `{success: false, error: 'O Pipeline ainda não foi gerado neste projeto. Rode a rotina Pipeline em Automação › Rotinas.'}` |

```js
{
  success: true,
  markdown: '…todas as cadeias com as linhas de passo, no formato do pipeline.md de antes…',
  cabecalho: '…',
  passos: 42,                       // número
  avisos: ['…'],
  cadeias: [
    { n: 1, nome: '…', cabeca: '…', tipo: '…',
      passos: [
        { ordem: 1, fase: '…', origem: '…', destino: '…',
          via: '…', frase: '…', selos: ['…'] }
      ] }
  ]
}
```

É exatamente isto que o programa injeta em `payload['pipeline']` quando você
manda `projeto` em `chamar_plugin`.

### 5.9 · Documentação gerada

| Método | Retorno |
|---|---|
| `list_agent_files(projeto, 'documentacao-tecnica')` · `read_agent_file(projeto, 'documentacao-tecnica', caminho_relativo)` | com envelope — a Documentação Técnica de cada arquivo: síntese, atribuições, metadados, termos e símbolos |
| `search_doc_content(projeto, query, escopo='documentacao-tecnica', max_results=20)` | `{success: true, results: [...]}` |
| `get_resumo_pastas_status(projeto)` | `{success: true, exists: bool, errors: [...]}` |
| `get_documentacao_tecnica_status(projeto)` | com envelope |
| `preview_documentacao_tecnica_agent(projeto, extensions=None)` | com envelope — calcula sem executar; o progresso da rotina chega à tela do programa pelo evento `documentacaoTecnicaAgentProgress` |
| `get_glossario_status` · `get_indice_navegacao_status` · `get_bibliotecas_status` · `get_comentarios_status` · `get_duplicados_status` · `get_sincronia_status` · `get_pipeline_status` | com envelope — todos `(projeto)` |
| `get_duplicados(projeto, threshold=0.85, max_pares=200)` | com envelope |

⛔ **`search_embeddings(...)` gera o embedding da pergunta** — é rede e custo,
não leitura. Não chame de um plugin.

### 5.10 · Plugins, Launchers e Extensões

| Método | Retorno |
|---|---|
| `list_plugins()` | `{success: true, arvore: {nome, caminho, pastas: [árvore…], plugins: [{caminho, nome, ligado, tela_principal, dentro_do_projeto, tipo}]}}` — recursivo, uma pasta por categoria |
| `list_atalhos_externos()` | a mesma forma de árvore, com a chave de folhas `itens` |
| `list_telas_de_extensoes()` | `{success: true, telas: [...], catalogo: {...}}` |
| `list_dados_de_extensoes(tipo=None)` | `{success: true, dados: [{caminho, slug, nome, tipo, assunto, arquivo, url, base_url, dados, erro}]}` — temas, ícones, gramáticas e presets que extensões trazem |
| `list_encaixes_programa()` | `{success: true, pontos: [...]}` — os pontos de encaixe da interface e quem os ocupa |
| `list_eventos_programa()` | `{success: true, eventos: [{nome, lado, guardia_cabe, quando, dado, nota, assinantes}]}` — **o catálogo de eventos do programa** |
| `list_consultas_programa()` | `{success: true, consultas: [...]}` |
| `preferencias_da_extensao(caminho)` | `{success: true, preferencias: {...}}` |

⚠️ **`list_extensoes_programa()` tem efeito colateral**: toda listagem
**reconcilia** o backend com a árvore, descarregando extensões que ficaram
ligadas sem estar. Tem nome de leitura, mas mexe no estado do programa. Se você
só quer saber quais existem, prefira não chamá-la de um plugin.

⚠️ **Nenhum dos métodos de plugin serve para o seu plugin se autoconfigurar.**
`save_plugins_order`, `save_config_plugin` e `reset_plugins` existem, mas são da
tela Configurações › Plugins e mexem no estado de **todos** os plugins. ⛔ Não
chame.

⚠️ **Não existe** "recarregar plugin", "ler a minha config" nem "abrir a minha
pasta" na API. A sua configuração é um arquivo em `config/`, dentro da sua
pasta, lido pelo seu próprio backend.

### 5.11 · Configurações, biblioteca e estatísticas

| Método | Retorno | Para que serve |
|---|---|---|
| `load_settings()` | `{success: true, settings: {...}}` — **sempre `success: true`**, cai no padrão em qualquer erro | as configurações do programa |
| `get_context_window()` · `load_limites()` · `load_doc_tecnica_limite()` | com envelope | os limites de token |
| `contar_tokens_textos(textos)` · `preview_orcamento(prompt, esqueleto)` | com envelope | contagem **local**, sem rede |
| `load_tab_order()` · `load_render_mapas()` | com envelope | preferências de interface |
| `obter_catalogo_de_linguagens()` · `load_extensoes()` · `load_extensoes_aparencia()` | com envelope | linguagens e extensões de arquivo ativas |
| `padroes_das_ferramentas()` · `padroes_do_mcp()` · `catalogo_ferramentas_mcp(servidor=None)` · `get_mcp_functions(projeto)` | com envelope | catálogos e o estado dos MCPs |
| `get_complexidade(projeto)` | `{success, por_arquivo: {caminho_absoluto: n}, max}` | o índice de complexidade por arquivo |
| `get_arquivos_grandes(projeto)` | `{success, arquivos: [...], limite}` | o que passou do teto de linhas |
| `listar_versoes(projeto)` · `onde_as_versoes_ficam(projeto)` | com envelope | os backups/versões |
| `listar_como_adicionar()` · `list_arquivos(kind)` · `list_item_files(kind, item)` · `read_item_file(kind, item, arquivo)` | com envelope | a biblioteca de `Arquivos/` |
| `list_agent_files(projeto, agente)` · `get_agent_stats(projeto, agente)` · `get_agent_files_stats(...)` · `estimate_agent_tokens(...)` · `read_agent_file(...)` | com envelope | o que cada rotina lê, e quanto pesa |
| `carregar_agentes(projeto=None)` · `assistentes_externos()` · `grupos_de_agente()` · `ferramentas_de_agente(assistente=None)` · `ler_agente(item)` | com envelope | os agentes e assistentes registrados |
| `carregar_trabalhos(projeto)` · `carregar_oficina(projeto)` · `carimbo_das_anotacoes(projeto)` · `listar_fluxos_de_execucao(projeto)` · `carregar_fluxos_salvos(projeto=None)` | com envelope | o Quadro e a Oficina |

---

## 6 · `browse_path('folder')` — o único que foge do padrão, e pode

| Método | Argumentos | Retorno | Para que serve |
|---|---|---|---|
| `browse_path(mode)` | `'folder'` (pasta) ou `'file'` (arquivo) | `{success: true, path: 'C:\\…'}`, ou `{success: false, path: null}` se o usuário cancelar | perguntar ao usuário ONDE, com o diálogo nativo do sistema |

O nome não começa com `list_`/`load_`/`get_`/`obter_`, e pela tabela de prefixos
ele cairia em "verbo de ação — não pode". Ele passa porque o corpo dele faz
exatamente uma coisa: abre o diálogo e devolve a string do caminho escolhido.
**Não grava nada.** É o teste que esta página manda aplicar quando o nome está
fora do padrão: abra o `.py` e leia o corpo.

⚠️ Isto **não** é licença para gravar onde quiser. O caminho que volta daqui só
vale para o arquivo que o usuário acabou de pedir, no formato que ele escolheu,
com o nome que a tela mostrou — e nada mais: cache, log e configuração continuam
morando em `files/` e `config/`, dentro da sua pasta. O precedente está
registrado em `Saída das skills/Arquitetura modular/Exceções.md` ("Um plugin
pode gravar o arquivo que o usuário mandou gravar"), com as quatro condições que
o `Relatório do Projeto` verifica antes de escrever: destino veio do diálogo, um
arquivo só, nunca sobrescrever calado, e diálogo cancelado não grava nada.

O programa **não tem** um "salvar como" (`webview.SAVE_DIALOG` não é usado em
lugar nenhum), então escolher a pasta e montar o nome do arquivo você mesmo é o
caminho mais próximo disso que existe hoje.

---

## 7 · Como reconhecer se um método é seguro para o seu plugin chamar

O programa não numera "isto é leitura, isto é escrita" em lugar nenhum — mas o
**nome** do método segue uma convenção usada em todo lugar.

### A tabela de prefixos

| Prefixo | Categoria | Um plugin pode chamar? |
|---|---|---|
| `list_`, `load_`, `get_`, `obter_`, `ler_`, `carregar_`, `listar_` | leitura | **sim**, com as ressalvas abaixo |
| `montar_`, `prever_`, `preview_`, `contar_`, `validar_`, `estimate_` | cálculo puro, sem gravar | **sim**, com uma exceção |
| `save_`, `create_`, `delete_`, `deletar_`, `reset_`, `set_`, `update_`, `mover_`, `renomear_`, `salvar_`, `criar_`, `apagar_`, `gravar_`, `importar_`, `definir_` | escrita | **não** |
| `run_*_agent`, `rodar_*_pelo_card`, `build_*`, `executar_*`, `iniciar_`, `cancelar_`, `enfileirar_`, `abrir_`, `fechar_` | dispara trabalho dentro do programa | **não** |
| `chamar_plugin` | o seu próprio canal | **sim** — mas só para o SEU plugin |
| `chamar_extensao` | o canal das extensões | **não** |

### As convenções finas, que o nome sozinho não entrega

Três pares que o projeto usa de propósito, e vale conhecer:

| Par | A diferença |
|---|---|
| `obter_` × `carregar_`/`load_` | **`obter_` não lê disco**: é constante em memória. `carregar_`/`load_` abre arquivo. Está escrito no próprio código: *"`obter`, e não `carregar`: não lê disco nenhum, é constante de módulo"* |
| `montar_` × `gerar_`/`salvar_` | **`montar_` devolve o texto**; `gerar_`/`salvar_` grava. `montar_indice_regras` é seguro; `gerar_indice_regras` grava o arquivo |
| `preview_`/`prever_` × o método sem prefixo | **calcula sem executar** — `preview_documentacao_tecnica_agent`, `preview_sincronia`, `preparar_projeto_preview` |

### ⚠️ Contra-exemplos reais: nome de leitura que ESCREVE

Isto não é raro no programa: é uma família inteira. **Nunca confie só no
prefixo.**

| Método | O que ele faz além de ler |
|---|---|
| `list_projects()` | **cria a pasta de projetos** se não existir (`os.makedirs`) |
| `list_arquivos(kind)` · `carregar_estilos_e_cores(chave)` | idem, criam a pasta base |
| **`load_fila_estado(projeto)`** | recupera tarefas órfãs e **persiste** |
| **`list_extensoes_programa()`** | **descarrega extensões** que ficaram ligadas sem estar |
| **`get_dropped_paths(nomes)`** | **bloqueia até 1,5 s** e **consome** o buffer: chamar duas vezes não devolve a mesma coisa |
| `get_explorer_selection()` | dispara **PowerShell** a cada chamada |
| `list_models()` | abre cliente HTTP para o LM Studio |
| `search_embeddings(...)` | gera embedding da pergunta: rede e custo |
| `preview_embedding_agent(...)` | apesar do `preview_`, **roda os índices** de forma síncrona |
| `verificar_hashes(projeto, processar)` | abre thread; com `processar=True`, dispara o ciclo inteiro |
| `detectar_sincronia(...)` | é o motor do Detector, não uma consulta |
| `resumo_para_copiar(projeto)` | **não devolve o resumo**: abre thread e empurra o resultado pela tela. Retorna `{started: true, trava: …}`, sem `success` |

### Contra-exemplos ao contrário: nome de ação que só LÊ

| Método | Por que é seguro |
|---|---|
| `browse_path(mode)` | só abre o diálogo e devolve a string (ver a [parte 6](#6--browse_pathfolder--o-único-que-foge-do-padrão-e-pode)) |
| `montar_regra_markdown(...)` · `montar_resumo_markdown(...)` | **funções puras** — montam string, não tocam em disco |
| `montar_indice_regras(projeto)` | só lê e devolve a string |
| `montar_blocos_do_designer` · `montar_system_prompt_do_designer` · `montar_pedido_do_designer` · `montar_system_prompt_chat` · `montar_blocos_subagentes` · `prever_system_prompt_chat` | montagem de texto |
| `aparencia_montar_relatorio_ia` · `inspetor_montar_relatorio_ia` · `inspetor_montar_relatorio_gravacao` | montam texto para colar numa IA externa; **não chamam modelo nem gravam** |
| `contar_tokens_textos` · `contar_uso_do_assistente` · `contar_na_pasta_acervo` | contagem pura |
| `validar_assistente` · `validar_inicio_rapido` | só validam |
| `padroes_das_ferramentas` · `padroes_do_mcp` · `naturezas_da_reversao` · `catalogo_ferramentas` · `catalogo_ferramentas_mcp` · `obter_catalogo_de_extensoes` | catálogos constantes |
| `carimbo_do_acervo` · `carimbo_das_anotacoes` · `resumo_das_ligacoes_dos_nos` | leituras baratas, feitas para polling |
| `mapa_arvore` · `mapa_treemap` · `mapa_sunburst` · `mapa_ligacoes` · `mapa_pipeline` · `diff_do_arquivo` | leitura + cálculo, sem escrita |

### Na dúvida, abra o método

O indício do nome é forte, não é garantia. São 449 métodos públicos em 228
arquivos, e nem todos seguem o padrão à risca.

- Cada `Mixin` mora em `Program/Code/backend/modulos/` (ou nas subpastas, como
  `modulos/agentes/`), num arquivo `.py` comum, sem ofuscação nenhuma.
- Se o corpo só faz `open(..., 'r')`, `json.load`, monta um dicionário e
  devolve — é leitura, seguro.
- Se ele faz `open(..., 'w')`, `os.remove`, `shutil.rmtree`, `os.rename`,
  `os.makedirs`, `json.dump`, `threading.Thread`, `subprocess`, ou chama outro
  método `save_*`/`_gravar_*`/`_salvar_*` — **não chame**.
- Se ele chama `self.window.evaluate_js(...)`, ele fala com a tela do programa,
  e o retorno dele quase nunca é o que você quer.

Se o MCP `assistente` estiver disponível na sua sessão, `onde_esta` acha o
método pelo nome (arquivo + linha) e `doc_tecnica` mostra a assinatura e a
descrição de todos os símbolos de um arquivo sem precisar abri-lo inteiro. Sem o
MCP, a leitura direta funciona igual — só um pouco mais manual.

---

## 8 · Não existe push para plugin

O programa **empurra** informação para a própria tela: de dentro de threads de
trabalho, o Python chama `self.window.evaluate_js('nomeDaFuncao(payload)')`, e
uma função global de JavaScript pinta o progresso. São umas quarenta funções
assim — `terminalOutput`, `documentacaoTecnicaAgentProgress`, `acionamentosEsperaStatus`,
`bkAoResumoPronto`, `atualizarTravaIA`, e uma por rotina.

**O seu plugin não entra nisso**, e não deve tentar:

- O `plugin_boot.py` **não recebe a janela**. Não há como empurrar nada de lá.
- O frontend do plugin roda no mesmo escopo global, então *tecnicamente*
  conseguiria embrulhar uma dessas funções — mas os nomes são fixos e já
  pertencem à interface: sobrescrever **quebra a tela do programa**.
- E não há gancho de descarregar: um handler que você deixar no `window` fica lá
  até o programa fechar, mesmo depois de o plugin ser desligado.

O mesmo vale para o **barramento de eventos das extensões**
(`editor.vai_salvar`, `projeto.abriu`, …): a assinatura vem do `extensao.json`,
e plugin não tem manifesto. A função global de assinar existe e não valida quem
chama — mas quem desregistra assinantes só o faz para extensões. Uma assinatura
feita por um plugin ficaria fantasma até o programa fechar e, se registrada como
guardiã, **poderia barrar o salvamento do Editor sem aparecer em lugar nenhum**.
⛔ Não faça.

O que você **pode e deve** é **ler** o catálogo: `list_eventos_programa()`
devolve todos os eventos que existem, com quem os assina.

### O padrão certo: polling com carimbo

É o que o próprio programa faz nas telas que vigiam disco: um `setInterval` que
pergunta por algo **barato** e só recarrega o pesado quando o barato mudou.

```js
let ultimoCarimbo = null;
const timer = setInterval(async () => {
  if (!container.isConnected) { container[ESTADO].destroy(); return; }
  const r = await window.pywebview.api.carimbo_do_acervo(projeto, 'Regras');
  if (!montada) return;
  if (r.success && r.carimbo !== ultimoCarimbo) {
    ultimoCarimbo = r.carimbo;
    await recarregarDeVerdade();
  }
}, 5000);
```

Intervalos que o programa usa como referência: 2 s para o estado da automação,
alguns segundos para os carimbos de disco. Não desça abaixo disso, e **sempre**
limpe o intervalo — ver a parte 8 de `Como criar plugins.md`.

---

## 9 · A outra metade da API: o que já está na página

Nem tudo que o programa oferece passa pela ponte. O seu `frontend/index.js` é um
script clássico no **mesmo documento**, então ele herda um punhado de funções,
globais e bibliotecas que já estão carregadas — `showToast`,
`abrirModalPadrao`, `escapeHtml`, `renderMarkdown`, `currentProject`,
`appSettings`, `workspaceConfig`, e as bibliotecas `d3`, `marked`, `AnsiUp`,
`Prism` e `Terminal` (xterm).

Isso está catalogado na parte 9 de `Como criar plugins.md`, junto com as classes
de CSS e os tokens de cor dos cinco temas. **Olhe lá antes de reescrever algo
que já existe** — e antes de escrever um hexadecimal.

---

## 10 · Testando uma chamada, sem escrever plugin nenhum

Antes de colocar uma chamada nova dentro do seu `frontend/index.js`, dá para
testar direto no console do DevTools da própria janela do programa. Lance o
programa com a porta de depuração aberta e abra o endereço no Edge:

```
WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333
```

```js
// Lista todo método que existe hoje na ponte — útil para navegar sem abrir
// arquivo nenhum, e para conferir que o nome que você digitou existe mesmo.
Object.keys(window.pywebview.api).sort()

// Filtra por assunto.
Object.keys(window.pywebview.api).filter(n => n.includes('pipeline'))

// Testa a chamada de verdade, com o projeto que estiver aberto no momento.
await window.pywebview.api.list_projects()
await window.pywebview.api.load_workspace('Nome Exato Do Projeto')
```

`Object.keys` é rápido para **descobrir que o método existe**, mas nunca é
suficiente para decidir se é seguro chamar — para isso, sempre abra o `.py`.

---

## 11 · Quando não funciona: sintoma → causa

| Sintoma | Causa quase certa |
|---|---|
| **A tela fica em "Carregando…" para sempre, sem erro** | nome de método errado. A `Promise` não resolve nem rejeita — confira com `Object.keys` |
| **`r.success` é `undefined`** | esse método não usa envelope. `list_projects` e companhia devolvem o valor cru |
| **`r.config` era o que eu queria, mas eu devolvi `null`** | `load_workspace` devolve `config` preenchido **mesmo com `success: false`** |
| **`total_files` chegou `undefined`** | `get_grafo_imports_status` só traz os totais quando `exists: true` |
| **`Erro dentro do plugin: …` e nenhum traceback** | é o caminho do `chamar_plugin`: o traceback não atravessa. Ponha `traceback.print_exc()` no seu `except` e olhe o **terminal** |
| **`Falha ao carregar o plugin: …`** | o seu `backend/plugin.py` estourou **ao importar**, não ao executar |
| **`ação desconhecida: None`** | você esqueceu de mandar `acao` no payload |
| **O método existe no `.py` mas não na ponte** | ele está numa classe que não é `*Mixin` (ver `TravaIA`, `ParadaDoProjeto`) |
| **O retorno veio `null` sem motivo** | o método devolveu algo que não atravessa JSON (`set`, `datetime`, objeto) — é método interno do programa |
| **`payload['grafo_imports']` não chegou** | aquele projeto nunca rodou o Grafo. A chave fica **ausente**, não `None` |
| **`payload['pasta_projeto']` veio `None`** | a leitura do workspace falhou. A chave existe; o valor é que é nulo |
| **Nenhuma das três chaves chegou** | você não mandou `payload['projeto']` |
| **Chamei duas vezes e vieram coisas diferentes** | é um dos métodos com efeito colateral (`get_dropped_paths` consome o buffer) |
| **O programa ficou lento depois que instalei o plugin** | polling curto demais, ou um método caro (`get_ligacoes`, `get_symbol_index`) chamado a cada tique |
| **A resposta antiga pintou por cima da nova** | falta a guarda de corrida com contador de pedido |
| **Uma tela do programa parou de responder** | você embrulhou uma função global que o `evaluate_js` chama |

---

## O que NÃO fazer

- ⛔ Não chame um método fora dos prefixos de leitura sem antes ler o corpo dele
  e confirmar que não grava nada.
- ⛔ Não presuma que um método devolve `{success: …}`, nem que `success: false`
  significa payload vazio.
- ⛔ Não deixe uma chamada de API solta sem `try`/`catch`.
- ⛔ Não guarde o resultado de uma chamada fora da própria pasta do seu plugin —
  cache e preferências vão em `files/` e `config/`.
- ⛔ Não chame `chamar_plugin` de **outro** plugin, nem `chamar_extensao`. Se
  dois plugins precisam do mesmo dado, cada um lê a própria fonte — ou lê o
  `files/` do outro, quando aquele plugin publicou um contrato.
- ⛔ Não chame `save_config_plugin`, `save_plugins_order` nem `reset_plugins`: o
  seu plugin não se configura sozinho.
- ⛔ Não embrulhe nem redefina função global do programa para interceptar o
  `evaluate_js`.
- ⛔ Não chame `list_models`, `search_embeddings` nem nenhum outro método que vá
  à rede ou ao modelo.
- ⛔ Não deixe `debug=True` ligado em `Assistente de código vibe-coding.pyw`
  depois de testar — é do programa inteiro, não do seu plugin.

## Onde mais olhar

| Arquivo | O que tem |
|---|---|
| `Como criar plugins.md` | o contrato do plugin — **leia antes deste** |
| `Como usar o Plugin base.md` | o dado que o Plugin base publica, se você precisar dele |
| `../Extensões/Como criar extensões.md` | para quando um plugin não basta |
| `Program/Code/backend/api.py` | a lista dos 104 mixins, e onde cada um mora |
| `Program/Code/backend/modulos/` | os métodos, um `.py` por assunto, sem ofuscação |
