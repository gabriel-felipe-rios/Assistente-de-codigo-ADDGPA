"""A porta do backend. Lê payload['acao'] e roteia. Só isso.

⚠️ O nome do arquivo e o nome da função são fixos: o programa importa
`backend/extensao.py` como PACOTE e procura `executar(payload)`. Se a função
tiver outro nome, ou estiver dentro de uma classe, a ponte devolve
`backend/extensao.py não define executar().`
"""

# ⚠️ `from . import irmao`, e nunca `import irmao`: o segundo procura no
# `sys.path`, que não inclui a pasta desta extensão. A pasta `backend/` é
# pacote por construção — não precisa de `__init__.py`.
from . import tst_acoes


def executar(payload):
    acao = (payload or {}).get('acao')

    if acao == 'ola':
        return tst_acoes.ola(payload)

    return {'success': False, 'error': 'ação desconhecida: %r' % acao}
