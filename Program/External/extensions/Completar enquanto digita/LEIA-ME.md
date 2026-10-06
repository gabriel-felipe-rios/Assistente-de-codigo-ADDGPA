# Completar enquanto digita

Digitou duas letras, aparece a lista de nomes do projeto que começam por elas.

## O que ela faz

Responde a consulta `editor.autocomplete` (tipo 27) com os nomes do **Índice de
Símbolos** do projeto — funções, classes, constantes — filtrados pelo que já
está escrito.

O popup, a navegação por teclado, o corte em 12 sugestões, o prefixo mínimo de
2 letras e a pausa de 80 ms são todos do programa. Esta extensão só decide
**quais** nomes entram.

## O recorte da versão 1

| Faz | Não faz |
|---|---|
| filtra por prefixo, sem diferenciar maiúsculas | busca aproximada (*fuzzy*) |
| ordena o nome mais curto primeiro | ordenar por frequência de uso |
| mostra `tipo · arquivo` na coluna da direita | trechos prontos (*snippets*) |
| corta em 40 candidatos | completar caminho de arquivo |

## Opções

Em **Configurações › Extensões › Completar enquanto digita**:

| Opção | O que faz |
|---|---|
| Nomes do projeto inteiro | os símbolos do Índice de Símbolos (aba Análise) |
| Palavras que já estão no arquivo aberto | funciona em qualquer linguagem, sem índice nenhum — é a rede de quem nunca abriu a aba Análise |
| Mostrar primeiro o que é do arquivo aberto | os símbolos definidos no arquivo em edição sobem um degrau |
| Ignorar maiúsculas e minúsculas | desligado, `ab` não sugere `Abrir` |
| Quantas sugestões entregar | o programa continua mostrando as 12 melhores; isto é quantas ele recebe para escolher |

As opções valem na hora, ao salvar.

## Casar pelo meio do nome

A partir de 3 letras, `hist` sugere `abrirHistoricoLocal`, porque um pedaço
do nome (dividido em `_` e em mudança de caixa) começa assim. Fica abaixo de
quem casa pelo começo, e é opção ("Casar também pelo meio do nome").

## O que ela mexe

**Nada.** Um arquivo de 50 linhas, sem backend, sem estilo, sem estado.
Desligar a tira do registro na hora e fecha o popup, se estiver aberto.

## Se nada aparecer

| Sintoma | Causa |
|---|---|
| nunca aparece nada, em nenhum projeto | a extensão está desligada, ou você digitou menos de 2 letras |
| nada aparece **neste** projeto | ele nunca teve o Índice de Símbolos construído. Abra a aba Análise. É o estado normal, e por isso a extensão fica quieta em vez de avisar |
| aparece pouco num projeto grande | só nomes usados entram no índice, e o teto do programa é de 20.000 símbolos |
