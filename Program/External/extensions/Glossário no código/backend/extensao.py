"""A porta. Lê payload['acao'] e roteia. Só isso."""

from . import glo_acoes


def executar(payload):
    acao = (payload or {}).get('acao')

    if acao == 'vocabulario':
        return glo_acoes.vocabulario(payload)

    return {'success': False, 'error': 'ação desconhecida: %r' % acao}
