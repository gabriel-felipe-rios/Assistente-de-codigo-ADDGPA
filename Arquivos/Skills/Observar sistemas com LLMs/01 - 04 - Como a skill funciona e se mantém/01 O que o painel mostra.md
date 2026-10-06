# 01 O que o painel mostra

*Abra este arquivo para saber o que o painel mostra — e para conferir, no fim da instalação, se o que apareceu é o que devia aparecer.*

## Visão geral

- Três abas: **Pipeline** (como o sistema funciona), **Logs** (o que aconteceu) e **Legenda** (tabela dos tipos).
- Barra do topo: nome do projeto, caminho do rastro, consumo (tokens no rastro, execuções, erros), o botão **Atualizar** (relê o desenho e o rastro) e o interruptor **Ao vivo**.
- Tudo é só de leitura: o painel nunca escreve no projeto.

## Pipeline

- **Trilho da esquerda, com dois níveis de filtro:** «Todos os fluxos» → um **tipo** (tiro único, cadeia, ciclo, agente) → um **fluxo**. Clicar filtra de verdade: só o que foi clicado fica no desenho.
- **Desenho no meio:** cada fluxo numa caixa; os pontos são cartões ligados por setas.
  - seta cheia: o de frente só começa quando o de trás termina;
  - tracejada âmbar: a volta do laço;
  - tracejada rosa: dispara outro fluxo.
  - **Zoom pela roda do mouse e arrastar para mover**; botões −, +, Ajustar; a legenda resumida fica numa barra que se pode ocultar.
- **Cartão do ponto:** mostra **duas linhas ao mesmo tempo** — tokens (`in X · out Y`, ou «sem modelo»; «sem rastro ainda» num ponto de modelo que nunca rodou) e o arquivo com a linha. Selos: «espera evento», «na fila», «envia».
- **Ficha à direita**, que muda conforme o que está selecionado:
  1. visão geral;
  2. **tipo** (mini-desenho);
  3. **fluxo:** começa quando, termina em, liga com, arquivo, última execução com tokens de entrada e saída, tokens e contagens, barras por ponto, a declaração JSON;
  4. **ponto**, com as abas **Ficha** (espera, recebe de, envia para, arquivo com botão Copiar, última vez, declaração JSON do ponto), **Prompt** (o último texto realmente enviado; sem `OBSERVAR_TEXTO=1` mostra um aviso) e **Tokens e contagens**.
- Cada dado da ficha traz uma **etiqueta de origem**: código, rastro ou assistente (arquivo 02).

## Logs

- Subabas **Execuções** e **Erros e avisos** (esta agrupa por causa).
- Ao escolher uma execução: resumo em português, quem a disparou, seis indicadores (duração, chamadas, voltas, tokens de entrada, tokens de saída, maior uso da janela — este só aparece se o projeto informou o tamanho da janela do modelo em `JANELA_TOKENS` do `Observar.pyw`), a **trilha** de passos e duas vistas:
  - **Linha do tempo:** tokens por chamada e grupos numerados das voltas;
  - **Desenho da execução:** o mesmo mapa, apagando o que não rodou e mostrando `×N` onde repetiu.
- Ao clicar numa chamada: a frase «Em português» e as abas **Enviado**, **Resposta**, **Tokens e contagens**, **Ficha**. A fonte dos tokens (`servidor` ou `local`) aparece na aba de tokens.
- A causa de um erro fica numa faixa vermelha com o arquivo; uma barreira que segurou aparece em âmbar como aviso («barrou»); uma execução que bateu o teto de voltas também ganha faixa âmbar.
- A execução ainda em andamento ganha um pontinho verde piscando na lista.

## Legenda

Tabelas dos tipos de ponto (o que é · num sistema com API de LLM · num sistema próprio ou local · como aparece nos Logs), dos tipos de fluxo, das setas e selos e de onde vem cada informação.

## Ao vivo

Ligado, o painel lê o rastro a cada segundo e **faz piscar em verde** o ponto (e o fluxo, e o item do trilho) que está rodando agora. «Rodando agora» é um ponto que começou e ainda não terminou (arquivo 02).

## Princípios

- **Pouca informação por padrão:** o cartão resume; o resto aparece ao clicar.
- **Nunca esconde o que não reconhece:** um ponto ou fluxo visto só no rastro entra no desenho como «outro» (fluxo sem descrição aparece com o aviso «falta a descrição»).
- **Só de leitura.**
