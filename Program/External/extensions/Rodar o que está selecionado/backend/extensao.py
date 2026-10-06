"""A porta. Lê payload['acao'] e roteia. Só isso."""

from . import rod_acoes


def executar(payload):
    acao = (payload or {}).get('acao')

    if acao == 'gravar_trecho':
        return rod_acoes.gravar_trecho(payload)
    if acao == 'caminho_absoluto':
        return rod_acoes.caminho_absoluto_do_arquivo(payload)

    return {'success': False, 'error': 'ação desconhecida: %r' % acao}
