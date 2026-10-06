# Extensão de teste

**O gabarito.** É a extensão mais simples que exercita a camada inteira. Copie
esta pasta e comece daqui.

## O que ela faz

| Peça | Onde | O que exercita |
|---|---|---|
| um `<style>` com `data-xt` | `frontend/index.js` | desligar remove o estilo (parte 2 do contrato) |
| uma tela própria em Configurações › Extensões | `frontend/telas/gabarito.js` (item `tst.gabarito` do manifesto) | tipo 1, o recurso Tela no lugar `configuracoes.subaba` (parte 15) |
| uma ida ao próprio backend | `frontend/telas/gabarito.js` → `frontend/index.js` → `backend/extensao.py` | a ponte `chamar_extensao` (parte 11) |
| estado que sobrevive entre chamadas | `backend/tst_acoes.py` (`_chamadas`) | o módulo fica importado enquanto ligada (parte 10) |
| uma tela de configuração | `config/tela.json` → `payload['preferencias']` em `backend/tst_acoes.py` | o programa desenha, grava e entrega as opções já resolvidas na ponte (partes 11 e 13) |
| uma marca no código do Editor | `frontend/encaixes/decorador.js` | tipo 12, o ponto `editor.decorador` (parte 15) |
| um comando no Ctrl+P, com tecla sugerida | `frontend/encaixes/comandos.js` | tipo 9, o ponto `acesso-rapido.comandos` (parte 15) — e a grade de teclas na página dela |

## O que ela mexe

**Nada fora da própria pasta.** `escreve_fora` está vazio, e é verdade: ela não
grava arquivo nenhum. O `config/preferencias.json` quem grava é o programa.

Na tela ela acrescenta, enquanto ligada:

- um `<style id="tst-estilo" data-xt="…">` no `<head>`;
- a tela **Extensão de teste — o gabarito** (recurso Tela) no lado Extensões de
  Configurações (o rótulo diz "o gabarito" porque o programa já põe uma
  **Extensão de teste** ali do lado, com as opções);
- as opções dela no mesmo lado Extensões (a partir do `config/tela.json`);
- um `<span class="tst-marca">` sobre os primeiros seis caracteres da linha 1
  de qualquer arquivo de texto aberto no Editor.

Desligar tira as quatro coisas, na hora, sem reiniciar o programa.

## Como conferir que o decorador está de pé

1. Ligue em **Configurações › Programa › Extensões**.
2. Abra qualquer arquivo no Editor: os primeiros caracteres da linha 1 ficam com
   fundo roxo.
3. Digite em qualquer lugar do arquivo — a marca **volta** depois da repintura,
   e continua sendo **uma** (`document.querySelectorAll('[data-xt-marca]').length`).
4. Role um arquivo longo até a linha 1 sair e voltar: a marca volta.
5. Desligue: a marca some, o texto da linha 1 continua inteiro e a régua
   continua alinhada.

## O prefixo

`tst`, em tudo: `tst-estilo`, `.tst-marca`, `.tst-linha`, `tstInjetarEstilo`,
`tst_acoes.py`. O frontend do programa não tem escopo de
módulo — sem prefixo, um nome seu sobrescreve o de outro arquivo em silêncio.
