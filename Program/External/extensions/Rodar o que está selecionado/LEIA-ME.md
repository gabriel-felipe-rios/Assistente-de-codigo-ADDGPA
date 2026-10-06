# Rodar o que está selecionado

Marque um trecho no Editor, clique direito **na aba do arquivo**, "Rodar o
trecho". A saída aparece na aba Terminal.

## Os itens que ela acrescenta

| Onde | Item |
|---|---|
| clique direito na **aba** do arquivo aberto | **Rodar o trecho** · **Rodar este arquivo** |
| clique direito num **arquivo da árvore** do Editor | **Rodar este arquivo** |

Sem seleção, "Rodar o trecho" aparece cinza, com o motivo.

## Por que a saída vai para a aba Terminal

Reusar o `run_script` do programa dá de graça três coisas que um painel novo
teria de reconstruir: a saída **ao vivo**, o botão **Parar** e o **"Explicar
este erro"**. E um painel novo dentro do Editor não é ponto de encaixe — é
funcionalidade do programa, que é outra conversa.

## O interpretador vem do Windows

O programa descobre com o que rodar pela **associação do Windows** à extensão
do arquivo — o mesmo que o duplo-clique faria. Não há chute: um `.xyz` sem
associação mostra "O Windows não tem programa associado…", e isso é de
propósito (adivinhar o interpretador escondia o problema).

É por isso que o trecho é gravado como `files/trecho.py`, `files/trecho.js` —
com a **extensão do arquivo original**. Um `trecho.tmp` não teria programa
associado.

## O recorte da versão 1

| Faz | Não faz |
|---|---|
| roda o arquivo inteiro | passar argumentos |
| roda só o trecho marcado | ler da entrada padrão (stdin) |
| grava o trecho com a extensão certa | "rodar a linha onde está o cursor" |
| desindenta o trecho (opção, ligada por padrão) | |

⚠️ **Python: o trecho é desindentado antes de rodar** (`textwrap.dedent` no
backend, opção "Desindentar o trecho"). Tira só o recuo comum a todas as
linhas — um trecho copiado de dentro de uma função passa a rodar. Desligue a
opção para rodar exatamente o que está marcado.

## Opções

Em **Configurações › Extensões › Rodar o que está selecionado**: trocar (ou
não) para a aba Terminal ao rodar, e desindentar o trecho antes de rodar
(ligado por padrão — é o que faz um trecho copiado de dentro de uma função
rodar em Python). Valem na hora, ao salvar.

## Sem seleção: a linha do cursor

Sem nada marcado, o item vira **Rodar a linha do cursor** — o gesto de quem
testa uma expressão. A seleção vem pela porta que o Editor empresta às
extensões (`edArquivoAberto`), e não cutucando o painel.

## No Acesso rápido

Os dois itens também estão no **Ctrl+P**, modo Comando, sob o nome da extensão
— e com tecla, que o menu não dá: **Rodar o trecho, ou a linha do cursor**
(`Ctrl+Enter`) e **Rodar o arquivo aberto** (`Ctrl+Alt+Enter`). As duas valem
com o cursor dentro do código e só com a aba Editor na tela. A tecla se muda
na página da extensão, em Configurações › Extensões.

## O que ela mexe

**Nada fora da própria pasta.** `escreve_fora` está vazio.

Ela grava **um** arquivo, `files/trecho{.ext}`, sobrescrito a cada execução.
Desligar a extensão **não** o apaga — desligar nunca apaga dado.

## O prefixo

`rod`: `rodRodarTrecho`, `rodRodarArquivo`, `rodTextoSelecionado`,
`rodIrParaOTerminal`, `rod_acoes.py`, `rod_caminhos.py`.
