# Servidor local com recarga

Na aba Terminal, escolha rodar como Servidor local: o ▶ Executar sobe um servidor HTTP na pasta do projeto, abre a página no navegador no tamanho escolhido e recarrega a cada Ctrl+S.

## O seletor

Na barra do Terminal, entre **Selecionar script** e **▶ Executar**, fica
**Terminal | Servidor local** — é o "rodar como" de cada projeto.

| Rodar como | O ▶ Executar |
|---|---|
| **Terminal** (o começo) | roda o script no Terminal, como sempre |
| **Servidor local** | sobe o servidor na pasta do projeto e abre **o arquivo do caminho** (o principal, ou o escolhido em Selecionar script) por `http://127.0.0.1:<porta>/…` |

A escolha fica em memória, por projeto, enquanto o programa está aberto.
Num arquivo que não é `.html` (ex.: `main.py`), o Servidor local abre a raiz
`/` — o servidor escolhe o `index.html`.

## A linha do servidor

No painel do Terminal, uma linha: **SERVIDOR LOCAL**, o endereço, a **Janela**
(Celular · 375 × 812, Tablet · 768 × 1024, Computador · 1280 × 800, Livre),
**Abrir no navegador** e **📋 Copiar endereço**. A Janela começa na escolhida
em Configurações e vale no próximo "Abrir".

O navegador abre pelo serviço do programa, que sabe pedir tamanho (numa janela
própria, se o navegador padrão for da família Chromium; senão, no tamanho dele,
com aviso). Não há prévia dentro do programa.

## A recarga

O servidor injeta, antes do `</body>` de todo `.html` que serve, um `<script>`
de oito linhas que consulta `/__svl/versao` a cada segundo e recarrega quando o
número muda. Cada Ctrl+S no Editor muda o número. Você não põe nada na sua
página.

## A porta

Configurável (padrão 5500), e **exclusiva**: o servidor prende a porta só para
si. Se outro programa já a usa, o servidor não sobe e a linha diz qual porta
está ocupada. Trocar a porta vale no próximo ▶ Executar, sem religar nada.

⚠️ **Porta ocupada não vira a porta seguinte.** Adivinhar a próxima esconderia
o problema — é o mesmo argumento do Terminal do programa, que também não
adivinha interpretador.

⚠️ **`127.0.0.1`, nunca `0.0.0.0`.** Este servidor serve a pasta de código do
usuário, e o programa é local por princípio.

## O servidor é um processo gerenciado

Ligar a extensão **não** abre porta nenhuma. O servidor sobe no ▶ Executar, como
processo gerenciado do programa (`payload['processos']`), e cai ao **desligar a
extensão** ou **fechar o programa**. Fechar o projeto também derruba o servidor
dele.

| Peça | Arquivo |
|---|---|
| o servidor, a recarga e a porta exclusiva | `backend/svl_servidor.py` |
| subir, parar, estado, salvou (e o estado em memória) | `backend/svl_acoes.py` |
| o seletor | `frontend/encaixes/barra.js` |
| o ▶ Executar assumido | `frontend/eventos/vai_rodar.js` |
| a linha do servidor | `frontend/encaixes/painel.js` |

## No Acesso rápido

**Abrir a página no navegador** e **Copiar o endereço do servidor** — os dois
botões da linha que se usam sem olhar para ela, com o mesmo endereço. Ficam
cinza, com o motivo, enquanto o servidor não está no ar.

## O que ela mexe

**Nada fora da própria pasta.** `escreve_fora` está vazio, e ela não grava
arquivo nenhum: o estado do servidor vive em memória.

Ela **abre uma porta de rede na máquina**, em `127.0.0.1` — acessível só deste
computador — enquanto o servidor está no ar.

## O prefixo

`svl`: `.svl-linha`, `.svl-como`, `svl-estilo`, `svlChamar`, `svlLerEstado`,
`svlAbrir`, `svlRodarComo`, `svl_acoes.py`, `svl_servidor.py`.

(O prefixo óbvio seria `srv`, e ele já está em uso no programa — `.srv-cab`,
`.srv-nome` em Configurações › MCP.)
