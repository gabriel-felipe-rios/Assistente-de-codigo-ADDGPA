"""Só monta caminho — nunca abre, lê nem grava arquivo.

⚠️ Tudo a partir de `__file__`: o diretório de trabalho do processo é o do
programa (`Program/Code/backend`), e um caminho relativo gravaria dentro da
pasta dele, sem erro nenhum (`Como criar extensões.md` § 3).
"""

import os
import re

# `backend/` → a raiz da extensão.
MINHA_PASTA = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

PASTA_FILES = os.path.join(MINHA_PASTA, 'files')

# O script que o servidor injeta em cada página servida. Lido a cada pedido,
# para editar o arquivo e recarregar a tela bastar.
PONTE_DA_PAGINA = os.path.join(MINHA_PASTA, 'frontend', 'pagina', 'ct-ponte-da-pagina.js')

# Os caracteres que o Windows não aceita em nome de pasta.
_PROIBIDOS = re.compile(r'[\\/:*?"<>|]')


def _projeto_limpo(projeto):
    return _PROIBIDOS.sub('_', str(projeto or '')) or '_'


def arquivo_estado():
    """`files/estado.json` — o que a aba lembra entre uma visita e outra."""
    return os.path.join(PASTA_FILES, 'estado.json')


def arquivo_posicoes(projeto):
    """`files/{projeto}/posicoes.json` — onde o usuário arrastou cada tela."""
    return os.path.join(PASTA_FILES, _projeto_limpo(projeto), 'posicoes.json')
