# Prévia de imagem

Todo caminho de imagem escrito no código fica **sublinhado**. E o clique
direito na aba abre **"Imagens deste arquivo…"**, com todas elas desenhadas.

## ⚠️ Por que são duas coisas, e não uma

O óbvio seria **clicar na marca e ver a imagem**. Isso é **impossível hoje**: o
`<pre>` do Editor tem `pointer-events: none`, e todo clique e todo `hover` vão
para o `<textarea>` que fica por cima. A marca não recebe clique, e o `title`
dela não aparece no mouse.

A imagem flutuando sobre o código é outra forma do ponto
(`editor.sobreposicao`), que ainda não existe.

Então a marca diz **onde**, e a modal **mostra**. É pouco, é barato, e está
escrito aqui para a escolha entre mantê-la assim ou esperar a sobreposição ser
consciente.

## O que ela reconhece

Qualquer sequência sem espaço que termine em `.png` `.jpg` `.jpeg` `.gif`
`.webp` `.bmp` `.ico` `.svg` `.avif` — as mesmas que o visualizador do Editor
sabe desenhar.

⚠️ **A marca não confere se o arquivo existe.** Isso seria uma ida ao disco por
caminho, dentro de um gancho que tem 150 ms e roda a cada 120 ms de digitação.
Quem confere é a modal, que roda uma vez, quando você pede — e diz "não
encontrado" no lugar da miniatura.

## O recorte da versão 1

| Faz | Não faz |
|---|---|
| sublinha o caminho | mostrar ao passar o mouse |
| lista e desenha na modal | URL `http` |
| resolve `.` e `..` a partir da pasta do arquivo | `data:` embutido |

## Opções

Em **Configurações › Extensões › Prévia de imagem**: o sublinhado no Editor pode
ser desligado (a modal continua no menu da aba), o teto de imagens que a modal
desenha, e extensões extras além das nove que o Editor sabe desenhar. Valem na
hora, ao salvar.

## A modal

Cada imagem mostra as dimensões e o tamanho em disco quando carrega, e tem um
botão **Abrir** que a leva ao visualizador de imagem do próprio Editor.

## No Acesso rápido

**Imagens deste arquivo…** — o mesmo item do menu da aba, para o arquivo na
frente do Editor.

## O que ela mexe

**Nada.** Sem backend, sem `files/`, sem `config/`. Ela **lê** as imagens do
projeto por `editor_prever_binario`, que é o mesmo método que o Editor já usa
para abrir um `.png`.

## O prefixo

`img`: `.img-marca`, `.img-lista`, `.img-quadro`, `.img-desenho`, `img-estilo`,
`imgAchar`, `imgAbrirModal`, `imgRegex`.
