import re
import os
import sys

# Para imports de módulos irmãos
_pasta_plugin = os.path.dirname(__file__)
if _pasta_plugin not in sys.path:
    sys.path.insert(0, _pasta_plugin)

import exm_catalogo
import exm_caminhos


def css_do_programa(tema):
    """Lê style.css, expande @import recursivamente e acrescenta o arquivo de tema."""
    style_css = os.path.join(exm_caminhos.pasta_frontend(), 'style.css')

    # Valida o tema
    if tema:
        if not re.match(r'^tema-[A-Za-z0-9_-]+\.css$', tema):
            tema = None
        else:
            tema_path = os.path.join(exm_caminhos.pasta_temas(), tema)
            if not os.path.isfile(tema_path):
                tema = None

    if not tema:
        tema = 'tema-ardosia.css'

    tema_path = os.path.join(exm_caminhos.pasta_temas(), tema)

    def expandir_imports(caminho, visitados=None):
        if visitados is None:
            visitados = set()

        if caminho in visitados:
            return ''

        visitados.add(caminho)

        with open(caminho, 'r', encoding='utf-8') as f:
            conteudo = f.read()

        pasta = os.path.dirname(caminho)

        def substituir(match):
            import_path = match.group(1)
            caminho_absoluto = os.path.join(pasta, import_path)

            if os.path.isfile(caminho_absoluto):
                return expandir_imports(caminho_absoluto, visitados)
            return match.group(0)

        conteudo = re.sub(r"^@import\s+['\"]([^'\"]+)['\"]\s*;", substituir, conteudo, flags=re.MULTILINE)
        return conteudo

    css = expandir_imports(style_css)

    with open(tema_path, 'r', encoding='utf-8') as f:
        css += '\n' + f.read()

    return css


def modulos_na_ordem():
    """Lê index.html e extrai os 27 módulos na ordem em que aparecem."""
    index_html = os.path.join(exm_caminhos.pasta_frontend(), 'index.html')

    with open(index_html, 'r', encoding='utf-8') as f:
        conteudo = f.read()

    # Encontra todos os `<script src="modulos/NOME.js"></script>`
    matches = re.findall(r'<script\s+src="modulos/([^"]+)\.js"\s*>', conteudo)

    # Filtra pelos que estão em MODULOS
    modulos_set = set(exm_catalogo.MODULOS)
    modulos_carregados = []

    for nome in matches:
        if nome in modulos_set:
            modulos_carregados.append(nome)

    # Verifica que todos os 27 estão presentes
    if len(modulos_carregados) != len(exm_catalogo.MODULOS):
        faltantes = modulos_set - set(modulos_carregados)
        for faltante in sorted(faltantes):
            raise RuntimeError(f'Módulo do Mapas não encontrado no index.html: {faltante} — o programa mudou depois que este plugin foi escrito.')

    # Lê o conteúdo de cada módulo
    modulos_pasta = exm_caminhos.pasta_modulos()
    resultado = []

    for nome in modulos_carregados:
        caminho = os.path.join(modulos_pasta, f'{nome}.js')
        with open(caminho, 'r', encoding='utf-8') as f:
            conteudo = f.read()
        resultado.append((nome, conteudo))

    return resultado


def d3():
    """Devolve o texto de d3.min.js."""
    with open(exm_caminhos.arquivo_d3(), 'r', encoding='utf-8') as f:
        return f.read()


def ler_estaticos():
    """Devolve o texto dos arquivos estáticos."""
    pasta = exm_caminhos.pasta_exportado()

    arquivos = {
        'exportado-antes.js': 'exportado-antes.js',
        'exportado-depois.js': 'exportado-depois.js',
        'exportado.css': 'exportado.css',
        'exportado-indice.html': 'exportado-indice.html',
    }

    resultado = {}

    for chave, nome_arquivo in arquivos.items():
        caminho = os.path.join(pasta, nome_arquivo)
        with open(caminho, 'r', encoding='utf-8') as f:
            resultado[chave] = f.read()

    return resultado


# Os módulos do programa que desenham o Resumo completo e a Documentação, além dos que já vão
# em MODULOS. A árvore e os ícones servem aos dois.
MODULOS_ARVORE = ('arvore-pastas', 'icones')
MODULOS_RESUMO = ('resumo', 'resumo-extensoes')


def ler_modulos(nomes):
    """Lê do programa os módulos pedidos, na ordem dada: [(nome, texto)]."""
    pasta = exm_caminhos.pasta_modulos()
    resultado = []
    for nome in nomes:
        with open(os.path.join(pasta, f'{nome}.js'), 'r', encoding='utf-8') as f:
            resultado.append((nome, f.read()))
    return resultado


# Os módulos da aba Documentação, na ordem do index.html. O copiar-contexto vem
# antes porque o documentacao-viewer o lê já no carregamento (`const _docCopiar`).
MODULOS_DOC = ('copiar-contexto', 'documentacao-template', 'documentacao',
               'documentacao-viewer', 'documentacao-busca', 'documentacao-arvores')


def marked():
    """Devolve o texto de marked.min.js — o documentacao-viewer cria o renderizador já no carregamento."""
    with open(exm_caminhos.arquivo_marked(), 'r', encoding='utf-8') as f:
        return f.read()


def painel_do_resumo():
    """Devolve o texto da função _resumoPainel de projeto-template.js — o painel
    do Resumo é o do programa, não uma cópia."""
    caminho = os.path.join(exm_caminhos.pasta_modulos(), 'projeto-template.js')
    with open(caminho, 'r', encoding='utf-8') as f:
        conteudo = f.read()
    achou = re.search(r'function _resumoPainel\(.*?\n}\n', conteudo, flags=re.DOTALL)
    if not achou:
        raise RuntimeError('Função _resumoPainel não encontrada em projeto-template.js — o programa mudou depois que este plugin foi escrito.')
    return achou.group(0)
