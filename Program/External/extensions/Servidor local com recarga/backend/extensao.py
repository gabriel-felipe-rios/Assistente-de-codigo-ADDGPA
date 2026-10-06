"""A porta. Lê payload['acao'] e roteia. Só isso.

O servidor é um PROCESSO GERENCIADO pedido ao programa
(`payload['processos']`): `subir` o liga no ▶ Executar, e o programa o
derruba ao desligar a extensão ou fechar a janela. O servidor em si mora em
`svl_servidor.py`; o estado dele, em memória, em `svl_acoes.py`.
"""

from . import svl_acoes


def executar(payload):
    acao = (payload or {}).get('acao')

    if acao == 'subir':
        return svl_acoes.subir(payload)
    if acao == 'parar':
        return svl_acoes.parar(payload)
    if acao == 'estado':
        return svl_acoes.estado(payload)
    if acao == 'salvou':
        return svl_acoes.salvou(payload)

    return {'success': False, 'error': 'ação desconhecida: %r' % acao}
