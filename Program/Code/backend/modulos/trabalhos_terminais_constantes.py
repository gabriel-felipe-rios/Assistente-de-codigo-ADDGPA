"""Os dois números do terminal de agente da Oficina.

Arquivo próprio porque `trabalhos_terminais.py` passou a compor três mixins
irmãos, e um deles precisa dos dois — importá-los de lá fecharia um ciclo.

⚠️ SÃO 120 ms AQUI, E 50 ms NO TERMINAL DO SISTEMA
(`trabalhos_shell_constantes.py`). A diferença é real e não deve ser
uniformizada: lá é um terminal VIVO, e 120 ms é latência que o dedo sente entre
a tecla e o eco; aqui o processo nasce, responde e morre, ninguém está
digitando, e agrupar mais economiza travessias da ponte.

⚠️ `TETO_DE_LINHAS` EXISTE PARA A SAÍDA NÃO COMER A MEMÓRIA DO PROGRAMA. Um
agente que entra em laço imprime sem parar, e o que se guarda é para a tela
reidratar — não é log.
"""

import json
import os
import subprocess
import threading
import time

from .catalogo_trabalhos import PAPEIS_DE_TERMINAL

# Mesmo agrupamento de `terminal.py`: uma notificação por linha afogaria a
# ponte num log grande.
INTERVALO_DE_AGRUPAMENTO = 0.12

# Teto de linhas guardadas por terminal. Não é limite de quantos terminais
# existem (isso não tem teto) — é o buffer de UM, para um log infinito não
# comer a memória do programa.
TETO_DE_LINHAS = 4000
