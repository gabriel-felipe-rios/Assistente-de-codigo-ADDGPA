# 07 Colocar as marcas dos Logs

*Abra este arquivo no passo 5 da instalação: como pôr, no código do programa, a pequena modificação que faz os Logs funcionarem.*

## O que é uma marca e o que ela garante

Uma linha acima de uma função que faz o programa gravar uma linha no rastro cada vez que a função roda.

- **Só acrescenta.** Não muda o que a função faz nem o que devolve.
- **Se o emissor falhar, o programa segue:** qualquer erro ao registrar é engolido.
- **Apagar as marcas e o `import` devolve o programa ao que era.**

## As três formas

### `@ponto("<fluxo>", tipo="…")` — ponto sem modelo

Para gatilho, código, ferramenta, barreira, fila, humano, outro.

Antes:
```python
def gravar_parecer(parecer):
    ...
```
Depois (uma linha acima e um `import` no topo do arquivo):
```python
from emissor import ponto

@ponto("parecer_de_clausula")
def gravar_parecer(parecer):
    ...
```
Grava `ponto_inicio` antes de a função rodar e `ponto_fim` depois (duração, estado `ok` ou `erro`). Se a função levantar exceção, o rastro guarda o erro e a **mesma exceção continua subindo**.

Parâmetros: `ponto(fluxo, ponto=None, tipo=None, detalhe=None, contagens=None, encerra=None, barrou=None)`.

### `@modelo("<fluxo>", ponto="…")` — o envelope da chamada ao modelo

Vai na função **mais baixa** que recebe as mensagens e devolve a resposta do modelo (a que chama `client.chat.completions.create(...)` ou equivalente), **sem mexer dentro dela**. `ponto=` diz a qual ponto do desenho essa chamada pertence (o passo do fluxo).

Antes:
```python
def _chamar_modelo(mensagens):
    return cliente.chat.completions.create(model="…", messages=mensagens)
```
Depois:
```python
from emissor import modelo

@modelo("classificar_documento", ponto="classificar")
def _chamar_modelo(mensagens):
    return cliente.chat.completions.create(model="…", messages=mensagens)
```
O que ele extrai sozinho:

| Dado | De onde |
|---|---|
| texto enviado | o argumento chamado `messages`, `mensagens`, `prompt`, `input`, `texto` ou `contents`; se o nome for outro, passe `enviado="nome_do_argumento"` |
| resposta | o retorno (texto, ou os formatos comuns de resposta de API e de servidor local) |
| tokens | o `usage` da resposta → `tokens_fonte: "servidor"`; sem `usage`, o emissor conta localmente e marca `tokens_fonte: "local"` |
| modelo | o `model` da resposta, ou o argumento `model` da função |

Parâmetros: `modelo(fluxo, ponto=None, tipo="llm", enviado=None, detalhe=None, contagens=None)`. Para modelo complementar (embeddings), use `tipo="embedding"`.

### `marcar("<fluxo>", "<ponto>")` — chamada solta

**Uma linha nova**, quando o ponto não é uma função inteira:
```python
from emissor import marcar
...
    marcar("classificar_documento", "gravar_classificacao")
```
Grava início e fim de uma vez. Parâmetros: `marcar(fluxo, ponto, tipo=None, detalhe=None, contagens=None, encerra=None)`.

## Regras

1. O **gatilho** de cada fluxo (a função de `entrada`) leva `tipo="gatilho"`. Sem isso, várias execuções se misturam.
2. O id do ponto é o nome da função (ou o `ponto=`); **tem de bater** com o `id` que aparece em `--json` (arquivo 06).
3. Ponto de barreira: `tipo="barreira"`. O padrão considera «barrou» quando a função devolve `False`; senão passe `barrou=lambda r: …`.
4. Ponto que encerra um ciclo por teto: `encerra="teto"`.
5. Funções `async def` e métodos de classe funcionam do mesmo jeito.
6. **Não marque funções de biblioteca de terceiros nem mexa em código dentro de `venv`.**
7. Marque **todos** os pontos do desenho (o `--conferir` avisa os que faltam) — mas, se o usuário só quiser os Logs de um fluxo, marque só esse.

## O `import`

O `emissor.py` fica em `Program/Code/utils/`. Use o mesmo jeito de import que o resto do projeto já usa para os utilitários dele — por exemplo `from Program.Code.utils.emissor import ponto, modelo, marcar`, ou o caminho relativo equivalente. **Um `import` por arquivo marcado, no topo, junto dos outros.**

## O interruptor do texto

`OBSERVAR_TEXTO=1` no ambiente de quem roda o programa em **desenvolvimento** grava o prompt e a resposta inteiros (aparecem nas abas Enviado e Resposta dos Logs e em Prompt do ponto). Desligado — o padrão —, o rastro guarda tokens, tempos, contagens e erros, **não o texto**.

| Sistema | Como ligar |
|---|---|
| Windows | `set OBSERVAR_TEXTO=1` no terminal, antes de abrir o programa |
| Linux / macOS | `OBSERVAR_TEXTO=1 python …` |

**Não ligue por padrão em versão distribuída.**

## Contagens

O parâmetro `contagens=` (um dicionário fixo, ou uma função `(args, kwargs, resultado) -> dict`) registra coisas como «documentos enviados ao modelo» ou «páginas lidas». É opcional; use só onde o usuário quiser a contagem.

```python
@ponto("resumir_ata", contagens=lambda a, k, r: {"páginas lidas": len(a[0].paginas)})
```

## Como remover tudo

Apague as linhas de decorador e de `marcar`, e os `import`; apague o `rastro.jsonl`. O programa fica idêntico.

## Limites, ditos com honestidade

- Duas execuções do **mesmo** fluxo em paralelo podem se misturar no rastro.
- Funções geradoras (com `yield`) não são suportadas pelos decoradores: use `marcar`.
