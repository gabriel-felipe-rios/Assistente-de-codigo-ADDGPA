# 06 Escrever as descrições

*Abra este arquivo no passo 4 da instalação: é o único trabalho de escrita que sobra para você, e tem de ser mínimo.*

## O trabalho, no mínimo

**Uma frase por fluxo e uma por ponto.** Nada de posição, layout, ligação, prompt ou tokens: o painel calcula tudo isso. Não desenhe o fluxo.

## Passo a passo

1. Liste os prováveis começos de fluxo:
   ```
   python Workshop/observar/analisador.py --candidatos
   ```
   Cada linha é `caminho:linha  nome_da_funcao  (motivo)`.
2. Escolha os que são de fato fluxos do sistema. O usuário quer os que envolvem LLM e o que os cerca; ignore funções soltas que só chamam o modelo dentro de outro fluxo.
3. Para cada um, copie `exemplo-de-descricao.json` para `Workshop/observar/descricoes/<fluxo>.json` e preencha `fluxo`, `entrada`, `descricao` e `pontos`.
4. Rode `python Workshop/observar/analisador.py --json` e olhe o resultado. **Só se a leitura errar** (tipo do ponto, tipo do fluxo, teto, ponto que não devia existir), acrescente em `correcoes`.

## O formato

| Chave | Obrigatória? | O que é | Exemplo |
|---|---|---|---|
| `fluxo` | sim | id do fluxo: só `a-z`, `0-9` e `_`; é o mesmo id que vai nas marcas (arquivo 07) | `"classificar_documento"` |
| `entrada` | sim | onde o fluxo começa: `caminho/relativo/ao/projeto.py:LINHA` (a linha cai dentro da função, ou é a linha do `def`) **ou** `caminho.py::nome_da_funcao` | `"Program/Code/backend/detector.py:27"` |
| `descricao` | recomendada | uma frase sobre o fluxo | `"Um prompt classifica o contrato que acabou de chegar."` |
| `pontos` | recomendada | `{id_do_ponto: uma frase}` | `{"classificar": "Pergunta ao modelo de que tipo é o contrato."}` |
| `correcoes` | não (use `{}`) | só o que a leitura errou | ver abaixo |

**`correcoes` — campos de um ponto** (qualquer subconjunto), com o id do ponto como chave:

| Campo | O que faz |
|---|---|
| `tipo` | força o tipo (um dos nove ids do arquivo 03) |
| `nome` | o nome que aparece na tela |
| `espera` | o que o ponto espera (texto) |
| `ignorar` | `true` remove o ponto do desenho e religa o de antes com o de depois |

**A chave reservada `"_fluxo"`** corrige o fluxo inteiro: `nome`, `tipo` (`tiro`, `cadeia`, `ciclo` ou `agente`), `teto` (número de voltas) e `gat` (`"evento"`, `"agenda"` ou `"usuário"`).

```json
"correcoes": {
  "_fluxo": {"nome": "Chat com o usuário", "tipo": "agente", "teto": 8, "gat": "usuário"},
  "confianca_minima": {"tipo": "barreira", "nome": "Confiança mínima", "espera": "confiança do modelo"}
}
```

## Como escolher o `id` do fluxo

Minúsculas, `_`, sem acento, curto e descritivo: `classificar_documento`, não `Fluxo 1`. É o mesmo id que vai em cada marca do arquivo 07.

## Como achar os ids dos pontos

Rode `--json` uma vez e leia o `id` de cada item de `nos`: são nomes de função (ou o `ponto=` da marca).

## Boas e más descrições

| Boa (5–10 palavras) | Má | Por que |
|---|---|---|
| «Pergunta ao modelo de que tipo é o contrato.» | «Classificar» | repete o nome |
| «Só deixa seguir com confiança de 0,70.» | «Esta função recebe a confiança, compara com a constante CONFIANCA_MINIMA e devolve um booleano…» | explica código; parágrafo |
| «Guarda o parecer em arquivo.» | «Grava.» | não diz o quê |

## Exemplo completo — três fluxos, um de cada tipo

**Tiro único** (`Workshop/observar/descricoes/resumir_ata.json`):
```json
{
  "fluxo": "resumir_ata",
  "entrada": "app/atas.py:12",
  "descricao": "Um prompt resume a ata que acabou de ser enviada.",
  "pontos": {
    "ata_enviada": "Acorda quando uma ata nova é enviada.",
    "resumir": "Pede ao modelo um resumo de cinco linhas.",
    "salvar_resumo": "Guarda o resumo junto da ata."
  },
  "correcoes": {}
}
```

**Ciclo** (`Workshop/observar/descricoes/redigir_parecer.json`):
```json
{
  "fluxo": "redigir_parecer",
  "entrada": "app/parecer.py::iniciar_parecer",
  "descricao": "Redige um parecer e o confere, até aprovar ou bater o teto.",
  "pontos": {
    "escrever": "O modelo escreve o parecer.",
    "conferir": "Outro pedido confere se citou a cláusula.",
    "chamar_revisor": "Passa para uma pessoa quando as voltas acabam."
  },
  "correcoes": {"_fluxo": {"nome": "Redigir parecer"}}
}
```

**Agente** (`Workshop/observar/descricoes/chat_com_o_usuario.json`):
```json
{
  "fluxo": "chat_com_o_usuario",
  "entrada": "app/chat.py:30",
  "descricao": "Conversa com o usuário; o modelo decide quando buscar.",
  "pontos": {
    "mensagem_do_usuario": "Acorda quando o usuário escreve.",
    "agente_principal": "O modelo decide o próximo passo.",
    "buscar_documento": "Procura um trecho nos documentos.",
    "ler_pagina": "Lê uma página inteira de um documento."
  },
  "correcoes": {"_fluxo": {"gat": "usuário"}}
}
```
