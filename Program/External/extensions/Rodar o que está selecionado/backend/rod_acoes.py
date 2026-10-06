"""O que cada ação faz."""

import os
import textwrap

from . import rod_caminhos


def _raiz(payload):
    """A pasta de código do projeto aberto.

    ⚠️ Vem de `payload['pasta_projeto']`, que o PROGRAMA acrescenta porque o
    payload trouxe `projeto`. Não se monta este caminho à mão.
    """
    raiz = payload.get('pasta_projeto')
    if not raiz or not os.path.isdir(raiz):
        return None
    return raiz


def caminho_absoluto_do_arquivo(payload):
    raiz = _raiz(payload)
    if not raiz:
        return {'success': False, 'error': 'este projeto não tem pasta de código.'}

    relativo = (payload.get('arquivo') or '').strip()
    if not relativo:
        return {'success': False, 'error': 'nenhum arquivo.'}

    absoluto = os.path.abspath(os.path.join(raiz, relativo.replace('/', os.sep)))
    # A pasta do projeto é a fronteira: um `..` no caminho apontaria para fora
    # dela, e "rodar" qualquer arquivo do disco não é o que este item promete.
    # ⚠️ `commonpath` LANÇA `ValueError` quando os dois caminhos estão em
    # unidades diferentes (`C:` e `D:`) — que é exatamente "fora da pasta".
    try:
        dentro = os.path.commonpath([os.path.abspath(raiz), absoluto]) == os.path.abspath(raiz)
    except ValueError:
        dentro = False
    if not dentro:
        return {'success': False, 'error': 'esse caminho sai da pasta do projeto.'}
    if not os.path.isfile(absoluto):
        return {'success': False, 'error': 'o arquivo "%s" não existe.' % relativo}

    return {'success': True, 'caminho_absoluto': absoluto}


def gravar_trecho(payload):
    texto = payload.get('texto')
    if not texto:
        return {'success': False, 'error': 'nenhum trecho selecionado.'}

    relativo = (payload.get('arquivo') or '').strip()
    extensao = os.path.splitext(relativo)[1].lower()
    if not extensao:
        return {'success': False, 'error':
                'o arquivo não tem extensão, e sem ela o Windows não sabe com '
                'que programa rodar o trecho.'}

    # As opções vêm do PROGRAMA, já resolvidas com os `padrao` do
    # `config/tela.json` — `payload['preferencias']`. Um trecho copiado de
    # dentro de uma função vem recuado, e em Python isso é `IndentationError`:
    # `dedent` tira o recuo comum a todas as linhas, e só ele.
    prefs = payload.get('preferencias') or {}
    if prefs.get('desindentar', True):
        texto = textwrap.dedent(texto)

    destino = rod_caminhos.arquivo_de_trecho(extensao)
    try:
        # ⚠️ `newline=''` para não converter as quebras de linha: o trecho vai
        # ser executado, e um interpretador sensível a `\r\n` (ou a falta dele)
        # falharia por uma razão que ninguém acharia.
        with open(destino, 'w', encoding='utf-8', newline='') as f:
            f.write(texto)
    except OSError as e:
        return {'success': False, 'error': 'não deu para gravar o trecho: %s' % e}

    print('[rod] trecho gravado em', destino)
    return {'success': True, 'caminho_absoluto': destino}
