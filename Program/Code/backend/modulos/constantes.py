import os
import re
import json
import shutil
import threading
import uuid
import time
import ctypes
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

import webview

# `PROJECTS_DIR` e os ajudantes de caminho de dados do usuário moram em
# `caminhos.py`, não aqui: este arquivo guarda valores fixos do PROGRAMA (onde
# ficam os .json de configuração, o regex de nome inválido), e o layout dos
# dados do usuário é outra responsabilidade. O reexport é o que mantém
# `from .constantes import *` funcionando em todo o backend sem nenhuma
# alteração — e é a razão de `caminhos.py` ser o dono de `PROJECTS_DIR`, e não
# o contrário: na outra ordem os dois módulos se importariam em círculo.
from .caminhos import *

# Pelo mesmo motivo, e com a mesma mecânica: os PADRÕES DE FÁBRICA (o endereço
# do LM Studio, o paralelismo, o teto da saída) são "qual valor", não "onde
# fica", e moram no irmão especializado. Reexportados aqui para que ninguém
# precise saber que a divisão existe.
from .padroes_de_fabrica import *

# E, pela terceira vez, a mesma mecânica: o CATÁLOGO DAS FERRAMENTAS DO MCP é
# "quais são elas", nem onde ficam nem que valor assumem. Mora no irmão
# especializado e é reexportado aqui — `arquivos.py` monta o `--enabled` do
# `.mcp.json` a partir dele, e o servidor MCP o importa direto, sem passar por
# esta porta (ver o aviso no cabeçalho de `catalogo_mcp.py`).
from .catalogo_mcp import *

ARQUIVOS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'Arquivos')
)
# `BACKUPS_DIR` saiu daqui e foi para `caminhos.py`, junto de `PROJECTS_DIR` e
# dos ajudantes `obter_*` das Versões: quem decide ONDE as coisas ficam é aquele
# módulo. O `from .caminhos import *` lá em cima já o traz de volta para cá, e
# os 45 arquivos que fazem `from .constantes import *` não notam diferença.
# Toda configuração escolhida pelo usuário mora aqui, num lugar só. Antes os
# .json ficavam em `Code/constants/`, mas `Code/` é código do programa: uma
# atualização que substituísse a pasta apagaria a configuração de quem usa.
CONFIGS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..', '..', 'Internal', 'config')
)
# ⚠️ DESDE 23/09/2026 CADA CATEGORIA DE CONFIGURAÇÕES TEM O PRÓPRIO JSON, e o
# mapa chave → arquivo mora em `configuracoes_arquivos.py`. `settings.json` e
# `limites.json` continuam aqui só como RESERVA DE LEITURA: guardam o valor de
# quem ainda não gravou nada depois da divisão, e perdem as chaves na primeira
# gravação.
SETTINGS_FILE = os.path.join(CONFIGS_DIR, 'settings.json')
# Os inícios rápidos de Configurações › Preparar projeto (`inicios_rapidos` e
# `inicio_rapido_padrao`) moram num arquivo À PARTE: é o pedaço que o usuário
# edita à mão e leva de um lugar para outro. O arquivo mudou de nome com a
# divisão por categoria; o antigo fica como reserva e é renomeado no boot
# (`migrar_nomes_de_config`).
INICIOS_RAPIDOS_FILE = os.path.join(CONFIGS_DIR, 'preparar-projeto.json')
INICIOS_RAPIDOS_FILE_ANTIGO = os.path.join(CONFIGS_DIR, 'inicios-rapidos.json')
CODE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..')
)
TAB_ORDER_FILE = os.path.join(CONFIGS_DIR, 'ordem-das-abas.json')
TAB_ORDER_FILE_ANTIGO = os.path.join(CONFIGS_DIR, 'tab-order.json')
DOC_TECNICA_LIMITE_FILE = os.path.join(CONFIGS_DIR, 'doc-tecnica-limite.json')
LIMITES_FILE = os.path.join(CONFIGS_DIR, 'limites.json')
RENDER_MAPAS_FILE = os.path.join(CONFIGS_DIR, 'desempenho-dos-mapas.json')
RENDER_MAPAS_FILE_ANTIGO = os.path.join(CONFIGS_DIR, 'render-mapas.json')
# Grupos/subgrupos/tags de projeto (cor + hierarquia) e a atribuição de cada
# projeto a eles — chave por ID, não por nome, pra sobreviver a renomear
# grupo/tag. A descrição livre de cada projeto mora num arquivo À PARTE
# (`PROJETOS_DESCRICOES_FILE`) porque muda com frequência bem diferente: um
# texto edita a toda hora, a taxonomia quase nunca — gravar os dois juntos
# faria toda descrição reescrever a lista inteira de grupos/tags.
PROJETOS_GRUPOS_FILE = os.path.join(CONFIGS_DIR, 'projetos-grupos.json')
PROJETOS_DESCRICOES_FILE = os.path.join(CONFIGS_DIR, 'projetos-descricoes.json')
# Configurações › "Arquivos que o programa lê" — GLOBAL, vale para todos os
# projetos. Um arquivo por vista que grava (D12), para dar para editar à mão:
#   · Nunca ler        → o que o programa nem enxerga (pasta, arquivo, extensão)
#   · O que é código   → linguagens com as extensões delas, formatos, soltas
#   · Exceções         → o que cada parte que lê de outro jeito acrescenta e
#                        retira da lista de onde ela parte
# A quarta vista, Quem lê o quê, é só leitura e não tem arquivo.
# Quem lê e grava os três é `configuracoes_extensoes.py`.
NUNCA_LER_FILE = os.path.join(CONFIGS_DIR, 'arquivos-que-o-programa-le-nunca-ler.json')
O_QUE_E_CODIGO_FILE = os.path.join(CONFIGS_DIR, 'arquivos-que-o-programa-le-o-que-e-codigo.json')
EXCECOES_FILE = os.path.join(CONFIGS_DIR, 'arquivos-que-o-programa-le-excecoes.json')
# ⚠️ Até a fase 06 da obra «Qualidade da documentação» (2026-09) a terceira
# vista era Quem lê o quê, com listas próprias, neste arquivo. Hoje ele só é
# lido como reserva de Exceções (que entende a forma antiga) e, no boot, é
# migrado e guardado com o nome de baixo — nunca apagado.
QUEM_LE_O_QUE_FILE = os.path.join(CONFIGS_DIR, 'arquivos-que-o-programa-le-quem-le-o-que.json')
QUEM_LE_O_QUE_GUARDADO_FILE = os.path.join(CONFIGS_DIR, 'arquivos-que-o-programa-le-quem-le-o-que-antigo.json')
# ⚠️ Até 23/09/2026 as três vistas moravam num arquivo só, com este nome. Hoje
# `extensoes.json` é o estado da categoria Extensões (as extensões do
# PROGRAMA) — este caminho é lido só pela migração, e só se o conteúdo tiver a
# forma antiga. Depois de migrado, o antigo fica guardado com o nome abaixo.
EXTENSOES_IGNORADOS_ANTIGO_FILE = os.path.join(CONFIGS_DIR, 'extensoes.json')
EXTENSOES_IGNORADOS_GUARDADO_FILE = os.path.join(CONFIGS_DIR, 'extensoes-antigo-ignorados.json')
# O antigo "Aparência: onde procurar", que virou duas partes das Exceções.
APARENCIA_ANTIGO_FILE = os.path.join(CONFIGS_DIR, 'aparencia.json')
APARENCIA_GUARDADO_FILE = os.path.join(CONFIGS_DIR, 'aparencia-antigo.json')
# ⚠️ `MAPA_ICONES_FILE` SAIU em 04/09/2026. O mapa de icones morava em
# `assets/icons/mapa.json`, dentro do programa; ele foi movido para a extensao
# **Icones de arquivo** (`External/extensions/`, tipo 24) e nao ha mais caminho
# fixo para ele — a pasta de cada pacote sai do manifesto da extensao ligada.
# `PROMPTS_DIR` saiu daqui e foi para `caminhos.py`, junto de `PROJECTS_DIR` e
# `BACKUPS_DIR`: onde uma coisa FICA é responsabilidade daquele módulo, e a
# pasta dos prompts tem agora uma árvore por dentro (Rotinas/, Assistente/) que
# precisa dos ajudantes que moram lá. O `from .caminhos import *` lá em cima já
# o traz de volta para cá, então nenhum `from .constantes import *` mudou.
INVALID_CHARS = re.compile(r'[\\/:*?"<>|]')

# Sentinel de `mudados_pre` em
# `executar_agente_documentacao_tecnica`: "ninguém calculou antes, calcule
# você mesmo comparando com a linha de base salva" (o comportamento de
# sempre). Um chamador que JÁ sabe o que mudou — `_ac_run_cycle`, que teria
# que perguntar DEPOIS do Hashes regravar a própria linha de base, quando a
# resposta já seria sempre "nada mudou" — passa o conjunto (ou `None` na
# primeira leva, sem baseline) explicitamente e pula esse cálculo.
MUDADOS_AUTO = '__calcular_automaticamente__'


def _validate_name(name):
    if not name:
        return 'Nome não pode ser vazio.'
    if INVALID_CHARS.search(name):
        return 'Nome contém caracteres inválidos.'
    return None
