"""O que cada ação faz."""

from . import tin_dados

# ⚠️ AS SEIS CORES SÃO NOMES DE TOKEN, e são as mesmas do "Destacar extensões"
# do programa (`XT_DESTAQUE_CORES`). O valor real sai do tema em execução, via
# `rgba(var(--{cor}-rgb), α)`, e por isso fica certo nos cinco temas, inclusive
# no claro. Uma sétima cor não teria token e sairia em branco.
#
# A lista está aqui TAMBÉM (o frontend tem a dele) porque este é o lado que
# grava: uma cor inventada gravada no disco voltaria como uma variável CSS que
# não existe, e o sintoma seria uma borda invisível.
TIN_CORES = ('purple', 'blue', 'green', 'amber', 'red', 'teal')


def cor(payload):
    projeto = payload.get('projeto')
    if not projeto:
        return {'success': True, 'cor': ''}
    return {'success': True, 'cor': tin_dados.ler_cores().get(projeto, '')}


def cores(payload):
    """TODAS as cores gravadas, `{projeto: cor}` — para a tira de abas de
    projeto pintar cada aba com a cor do projeto dela, numa ida só."""
    return {'success': True, 'cores': tin_dados.ler_cores()}


def gravar_cor(payload):
    projeto = payload.get('projeto')
    if not projeto:
        return {'success': False, 'error': 'nenhum projeto aberto.'}

    escolhida = (payload.get('cor') or '').strip()
    if escolhida and escolhida not in TIN_CORES:
        return {'success': False,
                'error': 'cor desconhecida: %r. As que existem são: %s.'
                         % (escolhida, ', '.join(TIN_CORES))}

    cores = tin_dados.ler_cores()
    if escolhida:
        cores[projeto] = escolhida
    else:
        # "Sem cor" TIRA a entrada em vez de gravar vazio: o arquivo fica com o
        # que o usuário escolheu de fato, e não com um histórico de escolhas
        # desfeitas.
        cores.pop(projeto, None)

    try:
        tin_dados.gravar_cores(cores)
    except OSError as e:
        return {'success': False, 'error': 'não deu para gravar: %s' % e}

    return {'success': True, 'cor': escolhida}
