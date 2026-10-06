# CSV colorido por coluna

Abriu um `.csv` ou um `.tsv`: cada coluna ganha uma cor. A parede de vírgulas
vira uma tabela que se lê de relance.

## Como funciona

É uma **decoradora** (tipo 12): responde ao ponto `editor.decorador` com uma
lista de marcas — trecho, cor — e quem desenha é o programa. Ela nunca toca no
DOM do Editor.

O separador é **detectado** pela primeira linha: `,` `;` tabulação ou `|`, o
que aparecer mais. Um `.csv` gerado no Brasil costuma usar `;`, e perguntar
isso a cada arquivo seria pior que acertar quase sempre.

As cores são as **seis do tema** — as mesmas do "Destacar extensões" —, e
ciclam a partir da sétima coluna.

## O recorte da versão 1

| Faz | Não faz |
|---|---|
| uma cor por coluna, ciclando seis | aspas escapadas (`"a,b"` numa célula) |
| detecta o separador | campo de várias linhas |
| colore só o que está na tela | alinhar as colunas |
| | fixar o cabeçalho |

⚠️ **Linha com número de campos diferente do cabeçalho sai sem cor.** É de
propósito: sem tratar aspas, a alternativa seria colorir errado a partir da
primeira vírgula dentro de uma célula. Monocromático é um aviso honesto.

⚠️ **Só as linhas visíveis.** Um CSV de 3.000 linhas × 12 colunas seriam 36.000
marcas, e o ponto tem teto de 150 ms. A extensão usa `contexto.visivel` — a
faixa de linhas que o Editor está colorindo agora — e é chamada de novo a cada
rolagem.

## Opções

Em **Configurações › Extensões › CSV colorido por coluna**:

| Opção | O que faz |
|---|---|
| Separador de colunas | detectar pela linha do cabeçalho (o padrão), ou fixar `,` `;` tabulação `|` |
| Linha do cabeçalho | é ela que diz quantas colunas a tabela tem — para um arquivo que começa com comentário ou linha em branco |

Valem na hora, ao salvar.

## Aspas e cabeçalho

Um campo entre aspas duplas com o separador dentro (`"São Paulo, SP",12`) é
**um** campo, e não dois — desde 05/09/2026. Campo de várias linhas continua
fora. A linha do cabeçalho ganha um pontilhado embaixo (opção "Pontilhar o
cabeçalho").

## O que ela mexe

**Nada.** Sem backend, sem `files/`, sem `config/`. Um `<style>` no `<head>` e
as marcas no código, que o programa desembrulha ao desligar.

## O prefixo

`csv`: `.csv-c0` a `.csv-c5`, `csv-estilo`.
