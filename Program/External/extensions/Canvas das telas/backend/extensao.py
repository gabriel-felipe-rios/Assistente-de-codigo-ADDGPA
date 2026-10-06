"""A porta do backend. Lê payload['acao'] e roteia. Só isso."""

from . import ct_acoes

_ACOES = {
    'ler': ct_acoes.ler,
    'subir': ct_acoes.subir,
    'parar': ct_acoes.parar,
    'estado_ler': ct_acoes.estado_ler,
    'estado_gravar': ct_acoes.estado_gravar,
    'posicoes_ler': ct_acoes.posicoes_ler,
    'posicoes_gravar': ct_acoes.posicoes_gravar,
}


def executar(payload):
    acao = (payload or {}).get('acao')
    funcao = _ACOES.get(acao)
    if funcao is None:
        return {'success': False, 'error': 'ação desconhecida: %r' % acao}
    return funcao(payload)
