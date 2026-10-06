"""Só monta caminho. Nunca lê, nunca grava."""

import os

# ⚠️ `backend/` → a raiz da extensão. Este é o único caminho escrito à mão, e é
# relativo a ESTE arquivo — nunca ao processo, cujo diretório de trabalho é
# `Program/Code/backend`.
MINHA_PASTA = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

PASTA_FILES = os.path.join(MINHA_PASTA, 'files')

# O que a extensão GEROU (a escolha de cor por projeto) vai em `files/`, e não
# em `config/`: `config/` é do usuário pela tela de Configurações, e o
# "Restaurar padrão" dela apagaria as cores de todos os projetos de uma vez.
CORES_FILE = os.path.join(PASTA_FILES, 'cores.json')


def garantir_pasta():
    # ⚠️ `exist_ok=True` sempre: `files/` não existe numa extensão recém-copiada,
    # e um `open(..., 'w')` numa pasta que não existe estoura com um
    # `FileNotFoundError` que não diz nada sobre a pasta faltando.
    os.makedirs(PASTA_FILES, exist_ok=True)
