# Ícones de arquivo

O **Material Icon Theme** — os ícones coloridos que a árvore do Editor, o
Acervo e as outras listas do programa mostram no lugar dos emojis.

Extensão de **dado puro**: não tem `frontend/`, não tem `backend/`, não roda
código nenhum. Só o manifesto e os desenhos.

## O que ela traz

| Arquivo | O que é |
|---|---|
| `mapa.json` | extensão de arquivo → ícone, e nome de pasta → ícone |
| `arquivos/` · `pastas/` | os SVGs |
| `_origem-material-icons.json` | a procedência: de onde cada desenho veio |
| `LICENSE-material-icon-theme.txt` | a licença (MIT) |

## De onde veio

[Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme),
de Philipp Kief — licença MIT, no arquivo `LICENSE-material-icon-theme.txt`.

Até 04/09/2026 estes arquivos moravam em `Program/Code/assets/icons/`, dentro
do programa. Foram movidos para cá: agora o pacote embutido **é** uma extensão,
como qualquer outro, e desligá-la devolve os emojis na hora.

## O que ela mexe

**Nada.** `escreve_fora` está vazio e é verdade — ela não grava arquivo nenhum
fora da pasta e não tem código para rodar (o `config/preferencias.json` é o
programa que grava, aqui dentro).

Na tela ela aparece como uma opção do campo **Pacote em uso**, em
Configurações › lado Extensões › Ícones de arquivo › **Pacote em uso**.
Escolhê-la troca duas coisas juntas: o mapa (`mapaIcones`) e a pasta de onde
os SVGs saem (`iconesBase`). A escolha fica em `config/preferencias.json`,
dentro desta pasta; "Nenhum (emoji)" devolve os emojis sem desligá-la.

## Se os ícones sumirem

| Sintoma | Causa |
|---|---|
| tudo virou emoji | ou a extensão está desligada, ou o Pacote em uso está em "Nenhum (emoji)" — são duas perguntas diferentes |
| um ícone só virou emoji | o nome no `mapa.json` não bate com o do SVG. Ícone que falta cai no emoji, de propósito, e por isso não dá erro |
