# Tingir a janela

Uma cor por projeto, em volta da janela. Serve para saber de relance em qual
projeto você está — sobretudo com duas janelas do programa lado a lado.

Inspirada no comando *Peacock* do VS Code. É uma versão própria, não um porte.

## Não é um tema, e não substitui o tema

O tema escolhido continua valendo inteiro. A cor entra **por cima**, num
elemento próprio pendurado no `<body>`, com `pointer-events: none` — nenhum
botão da janela deixa de responder por causa dela.

## Como se usa

| Passo | Onde |
|---|---|
| escolher a cor deste projeto | clique direito no vazio da raiz da árvore (Editor, ou qualquer árvore compartilhada) › **Tingir a janela…** |
| escolher **onde** a cor aparece | Configurações › Extensões › Tingir a janela |

A cor volta sozinha toda vez que você abre o projeto, e sai quando você volta
para a lista de projetos.

## As seis cores

`purple` · `blue` · `green` · `amber` · `red` · `teal` — as mesmas seis do
"Destacar extensões" do programa, e pelo mesmo motivo: são **nomes de token**,
não hexadecimais. O valor real sai do tema em execução, então a borda fica
certa nos cinco temas, inclusive no claro, e muda de tom sozinha quando você
troca de tema.

⚠️ Não há uma sétima. Uma cor fora dessa lista não tem token e sairia invisível.

## As três formas de pintar

| Opção | O que faz |
|---|---|
| **borda** (padrão) | uma borda da espessura escolhida em volta da janela inteira |
| **faixa** | só a linha do topo |
| **tinta** | tinge o fundo da barra do topo |

⚠️ **"Tinta" tinge só a barra do topo**, e não o programa inteiro. As seis
cores têm significado de estado no programa (azul = acontecendo agora, verde =
terminou, âmbar = faltou pedaço, vermelho = erro); tingir a raiz mudaria o que
você lê em todas as outras abas.

A mudança de "onde pintar" vale **na hora**, ao salvar: o programa avisa a
extensão (`xtPreferenciasMudaram_`) e a moldura é refeita.

## As abas dos projetos abertos

Com a opção "Tingir também a aba de cada projeto aberto" (ligada por padrão),
cada aba da tira do topo ganha um traço embaixo com a cor do projeto dela. A
moldura mostra o projeto de agora; as abas mostram todos os abertos.

## No Acesso rápido

**Tingir a janela…** abre a mesma modal dos dois menus, sem precisar achar a
raiz da árvore. Cinza sem projeto aberto.

## O que ela mexe

**Nada fora da própria pasta.** `escreve_fora` está vazio.

A cor de cada projeto fica em `files/cores.json`, aqui dentro — e não no
`Workspace.json` do projeto, que exigiria `escreve_fora` e passaria por um
`save_workspace` com dezenas de outros chamadores.

Na tela ela acrescenta, enquanto ligada: um `<div class="tin-moldura">` no
`<body>`, dois `<style>` no `<head>`, um item nos dois menus de contexto de
raiz, e as opções dela em Configurações. Desligar tira tudo na hora, e
`files/cores.json` fica intacto.

## O prefixo

`tin`: `.tin-moldura`, `.tin-opcoes`, `.tin-bola`, `tin-estilo`,
`tinAplicar`, `tinTirar`, `tinAbrirModal`, `tin_acoes.py`.
