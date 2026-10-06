# 04 Como manter a skill atualizada

*Abra este arquivo se você mantém a própria skill (não se está instalando o painel num projeto): como ela se organiza e como mudá-la sem quebrar as cópias já instaladas.*

## A árvore e o papel de cada pasta

| Pasta | Papel |
|---|---|
| `01 - 04 - Como a skill funciona e se mantém/` | explica o painel, a origem dos dados, os tipos e como mantê-la |
| `05 - 08 - Como aplicar no projeto/` | o passo a passo de quem instala |
| `09 - 13 - Arquivos para copiar/` | os cinco arquivos que vão para o projeto (junto com o que o arquivo 05 mandar) — os únicos que saem daqui |

## O contrato entre os arquivos

Cada linha diz o que mudar **junto** quando uma das pontas muda.

| Se mudar… | Mude também |
|---|---|
| o formato do rastro (chaves de cada linha) | `emissor.py` ⇄ `painel.html` (função que monta as execuções) ⇄ arquivo `02` |
| os campos de `/api/pipeline` ou de `/api/rastro` | `analisador.py` ⇄ `Observar.pyw` ⇄ `painel.html` |
| o JSON de descrição | `analisador.py` ⇄ `exemplo-de-descricao.json` ⇄ arquivo `06` |
| o nome ou os parâmetros de um decorador | `emissor.py` ⇄ `analisador.py` (que reconhece as marcas) ⇄ arquivo `07` |
| as assinaturas de tipo | `analisador.py` (listas no topo) ⇄ arquivo `03` |

## Versão

- Cada arquivo de código tem `VERSAO = "1.0"` no bloco `AJUSTES DO PROJETO`. O `painel.html` declara a dele na tag `<meta name="observar-versao" content="1.0">`, dentro do `<head>`, logo abaixo do `<title>`.
- Ao mudar o contrato, suba a versão nos arquivos que mudaram **e** o campo `v` do rastro se o formato quebrar.

## Atualizar um projeto que já tem cópias

1. Compare a `VERSAO` de cada cópia com a da skill.
2. Se for menor, **recopie** o arquivo (a cópia não se remenda).
3. **Reaplique** os valores do bloco `AJUSTES DO PROJETO` que tinham sido adaptados (por isso todo ajuste vive naquele bloco).
4. As descrições e as marcas do projeto **não se tocam**.

## Como estender

| Quer… | Faça |
|---|---|
| reconhecer uma nova chamada de LLM, fila ou barreira | acrescente na lista do topo do `analisador.py` e na tabela do arquivo `03` |
| um novo tipo de ponto | **não crie**: o «outro» existe para isso |
| outra linguagem | fora do escopo da versão atual |

## Checklist de mudança

1. Rodar o teste com um projeto fictício fora da pasta da skill, com três fluxos (tiro único, ciclo, agente): `--json`, `--candidatos`, `--conferir`, o servidor (`Observar.pyw --sem-navegador --porta 8765`) e o painel aberto sem erro de console.
2. Nenhum arquivo do painel com `http://`, `https://`, CDN, `src=`, `<link` ou `@import`.
3. Nenhum `__pycache__` na pasta da skill.
4. Nenhuma menção a outra skill nos textos.
5. Todo nome de arquivo, constante, opção e endpoint citado nos textos existe no código.
