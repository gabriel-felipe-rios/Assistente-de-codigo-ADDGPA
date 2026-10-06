"""Só monta caminho. Nunca lê, nunca grava."""

import os

# ⚠️ A partir de `__file__`: o diretório de trabalho do processo é
# `Program/Code/backend`, e não a pasta desta extensão.
MINHA_PASTA = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

PASTA_FILES = os.path.join(MINHA_PASTA, 'files')


def arquivo_de_trecho(extensao):
    """`files/trecho{.ext}` — e cria a pasta se não existir.

    ⚠️ A EXTENSÃO DO ARQUIVO ORIGINAL VAI JUNTO. `_term_resolver_comando`
    (`backend/modulos/terminal.py`) descobre o interpretador pela associação do
    Windows à extensão, e não tem fallback — por desenho. Um `trecho.tmp` seria
    recusado com "o Windows não tem programa associado", e o usuário procuraria
    o defeito no código dele.
    """
    os.makedirs(PASTA_FILES, exist_ok=True)
    return os.path.join(PASTA_FILES, 'trecho%s' % (extensao or ''))
