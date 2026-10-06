"""Os nomes de arquivo e os números fixos do arranjo da Oficina.

Arquivo próprio porque `trabalhos_layout.py` passou a COMPOR três mixins
irmãos, e eles precisam destes valores — importá-los de lá fecharia um ciclo.
Mesma solução de `execucao_constantes.py` e `trabalhos_shell_constantes.py`.

⚠️ `ANDAR_PADRAO` EXISTE PORQUE O ARQUIVO JÁ NASCE COM A FORMA FINAL. Andares de
verdade são obra posterior; até lá o `Layout.json` guarda uma LISTA de andares
com um só dentro, para a obra acrescentar em vez de migrar. Um arquivo com um
andar solto teria de ser convertido depois, e conversão de arquivo do usuário é
o tipo de coisa que se paga uma vez e se lamenta para sempre.

⚠️ O ESCALONAMENTO DO NASCIMENTO (`NASCIMENTO_PASSO`) NÃO É ENFEITE: abrir três
nós seguidos sem ele empilha os três no mesmo pixel, e o usuário vê um só.
"""

import os
import uuid

from .caminhos import obter_pasta_de_trabalhos
from .catalogo_trabalhos import (
    CORES_DOS_SUBAGENTES,
    IDS_DOS_PAPEIS,
    IDS_DOS_TIPOS_DE_LIGACAO,
    IDS_DOS_TIPOS_DE_NO,
    PAPEIS_DE_TERMINAL,
    TIPOS_DE_LIGACAO,
    TIPO_APOSENTADO,
)
from .trabalhos_estado import (
    gravar_json_atomico,
    travar_entre_processos,
)

PASTA_DA_OFICINA = 'Oficina'
ARQUIVO_DE_LAYOUT = 'Layout.json'

# O andar único da Fase 2. Andares de verdade são Fase 5; até lá o arquivo já
# nasce com a forma final (uma LISTA de andares), para a Fase 5 acrescentar em
# vez de migrar.
ANDAR_PADRAO = 'andar-1'

# Onde um nó novo nasce quando ninguém disse onde. Escalonado para que abrir
# três seguidos não empilhe os três no mesmo pixel.
NASCIMENTO_X, NASCIMENTO_Y, NASCIMENTO_PASSO = 40, 40, 34

