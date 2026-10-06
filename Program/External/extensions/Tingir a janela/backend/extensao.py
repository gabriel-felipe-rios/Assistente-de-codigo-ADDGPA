"""A porta. Lê payload['acao'] e roteia. Só isso."""

from . import tin_acoes


def executar(payload):
    acao = (payload or {}).get('acao')

    # As preferências (ONDE pintar) não passam mais por aqui: o frontend as
    # pede ao programa (`preferencias_da_extensao`), e quem precisar delas
    # neste lado tem `payload['preferencias']`, já resolvidas.
    if acao == 'cor':
        return tin_acoes.cor(payload)
    if acao == 'cores':
        return tin_acoes.cores(payload)
    if acao == 'gravar_cor':
        return tin_acoes.gravar_cor(payload)

    return {'success': False, 'error': 'ação desconhecida: %r' % acao}
