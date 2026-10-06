"""Os números e os textos fixos do terminal da Oficina.

Arquivo próprio porque `trabalhos_shell.py` passou a COMPOR quatro mixins
irmãos, e cada um deles precisa de alguma constante daqui — importá-las de lá
fecharia um ciclo. Mesma solução de `execucao_constantes.py` e
`ferramentas_subagentes_constantes.py`.

⚠️ NENHUM DESTES NÚMEROS É CHUTE, e cada comentário abaixo diz de onde ele saiu.
Os dois que mais custaram:

    · `INTERVALO_DE_AGRUPAMENTO` é 50 ms e não 20 porque `evaluate_js` do
      pywebview é SÍNCRONO — a 20 ms, com vários terminais falando ao mesmo
      tempo, a ponte satura e a interface engasga.
    · `ORCAMENTO_DE_GRACA_AO_FECHAR` é 6 s porque um terminal com Claude Code
      sai sozinho em 0,80 s (medido). Encurtar traz de volta a sessão órfã; se
      um dia os segundos incomodarem, o caminho é fechar EM PARALELO.

⚠️ `_ShellDeCano` E `_ShellPty` NÃO SÃO REEXPORTADOS por `import *` (começam com
`_`). Quem os usa é `_sh_abrir_processo`, em `trabalhos_shell.py`, e é lá que
eles são importados pelo nome — de propósito: esse é o ÚNICO ponto do programa
que sabe COMO o shell nasce.
"""

import base64
import json
import os
import re
import threading
import time
import unicodedata

from .trabalhos_shell_processo import (
    SHELL_PADRAO,
    PRAZO_DE_GRACA,
    _ShellDeCano,
    _ShellPty,
    tem_pseudoterminal,
)

# Agrupamento da saída antes de atravessar a ponte. 20 ms, e não os 120 ms de
# quando isto era um log: num terminal vivo, 120 ms é latência que o dedo sente
# entre a tecla e o eco.
# ⚠️ 50 ms, e não 20. `evaluate_js` do pywebview é SÍNCRONO: a thread leitora
# para e espera o WebView responder. A 20 ms, com vários terminais falando ao
# mesmo tempo, isso satura a ponte e a interface engasga. 50 ms ainda é
# imperceptível ao dedo e dá um quinto do tráfego.
INTERVALO_DE_AGRUPAMENTO = 0.05
TETO_DO_LOTE = 64 * 1024

# Teto do que se guarda por terminal, para reidratar a tela ao voltar para a
# sub-aba. Em BYTES, porque é isso que o xterm.js consome.
TETO_DE_BYTES = 512 * 1024

# O tamanho com que um terminal nasce, até a tela medir o dela e mandar o
# tamanho de verdade por `redimensionar_shell`.
COLUNAS_PADRAO, LINHAS_PADRAO = 120, 30

# ⚠️ O CAMINHO DA TELA VIVE NUMA CONSTANTE porque ele já mudou duas vezes, e
# das duas as mensagens de erro ficaram apontando para uma tela que não existia
# mais. Era "Trabalhos → Configurações › Agentes", depois "Configurações >
# Trabalhos"; hoje o assistente externo se configura na aba Arquivos.
ONDE_SE_CONFIGURA = 'Arquivos › Agentes › Assistentes externos'

# Quanto o programa inteiro pode gastar pedindo saída com graça enquanto fecha.
# Ver `fechar_todos_os_shells`, que o reparte entre os terminais que restam.
#
# ⚠️ O NÚMERO SAI DA MEDIÇÃO, e não de um chute. Um terminal com Claude Code
# rodando sai sozinho em **0,80 s** (medido: duplo Ctrl+C, 0,6 s de pausa,
# `exit`), então quatro terminais custam ~3,2 s no pior caso — e cada um que sai
# rápido devolve o resto ao orçamento dos seguintes. 6 s dá folga para o dobro
# disso antes de alguém ser morto sem cerimônia.
#
# Se um dia esses segundos incomodarem no fechamento, o caminho é fechar os
# terminais EM PARALELO (o custo é de espera, não de CPU), e não encurtar o
# prazo — encurtar traz de volta exatamente o defeito da sessão órfã.
ORCAMENTO_DE_GRACA_AO_FECHAR = 6.0
