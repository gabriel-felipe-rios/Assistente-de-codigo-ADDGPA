import os

def raiz_program():
    """Encontra a pasta Program, subindo até encontrar plugins/External."""
    caminho = os.path.abspath(__file__)

    while caminho != os.path.dirname(caminho):
        caminho = os.path.dirname(caminho)

        pai = os.path.dirname(caminho)
        if os.path.basename(caminho) == 'plugins' and os.path.basename(pai) == 'External':
            return os.path.dirname(pai)

    raise RuntimeError('plugin fora de Program/External/plugins/')


def pasta_frontend():
    return os.path.join(raiz_program(), 'Code', 'frontend')


def pasta_modulos():
    return os.path.join(pasta_frontend(), 'modulos')


def arquivo_d3():
    return os.path.join(raiz_program(), 'External', 'libraries', 'd3.min.js')


def arquivo_marked():
    return os.path.join(raiz_program(), 'External', 'libraries', 'marked.min.js')


def pasta_temas():
    return os.path.join(pasta_frontend(), 'estilos', 'tema')


def pasta_exportado():
    return os.path.join(os.path.dirname(__file__), 'exportado')
