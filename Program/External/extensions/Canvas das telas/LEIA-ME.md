# Canvas das telas

Uma aba Telas: cada tela do site viva num canvas, e a ligação do elemento que leva até ela.

## O que ela acrescenta

- **A aba Telas**, a última da barra de dentro do projeto. Cada tela do site —
  cada página `.html`, cada aba interna de uma página e cada janela que abre por
  cima (modal) — aparece como um retângulo com a página viva dentro, e do
  elemento que leva a outra tela sai uma ligação até ela.
- **Um servidor próprio**, na porta 5600 (troca-se em Configurações ›
  Extensões › Canvas das telas). Ele só existe enquanto a aba Telas está aberta,
  escuta só em `127.0.0.1`, e entrega o site com um script injetado **na cópia**
  que serve — o arquivo em disco nunca muda.
- **Reações** ao que o programa faz (abrir a aba, fechar o projeto, salvar),
  para subir e derrubar o servidor e redesenhar as ligações.

## O que ela lê

- Páginas: HTML (`.html`, `.htm`).
- Ligações: JavaScript (`.js` e o que está dentro do HTML).
- Aparência: CSS (`.css`).
- Outras linguagens: ainda não — só site nesta versão.

Só vira ligação o que o código diz **com todas as letras** (um `href`, um
`location.href = 'x.html'`, um `showModal()` de um `id` escrito por inteiro).
Destino montado por variável ou concatenação fica sem ligação — de propósito.

## O que ela NÃO faz

- **Não escreve no projeto.** Posições e opções moram na pasta desta extensão.
- **Não roda o backend do site.** Pedido a um caminho que não existe em disco,
  e todo `POST`/`PUT`/`PATCH`/`DELETE`, responde 503; nada é gravado.
- **Não depende de outra extensão.** Nem do "Servidor local com recarga": o
  servidor é dela.
- Não mexe em Inspetor › Gravação nem em Mapas › Ligações.

## Onde ela grava

Só em `files/`, dentro desta pasta: `files/estado.json` e
`files/{projeto}/posicoes.json`. Desligar não apaga nada; apagar é apagar a
pasta.
