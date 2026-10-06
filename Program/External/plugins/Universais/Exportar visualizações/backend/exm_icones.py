import base64
import os
import sys
from urllib.parse import unquote

_pasta_plugin = os.path.dirname(__file__)
if _pasta_plugin not in sys.path:
    sys.path.insert(0, _pasta_plugin)

import exm_caminhos

_PREFIXO = '../../External/extensions/'


def _pasta_do_pacote(base):
    """Converte o endereço que o programa usa (relativo ao frontend) na pasta real."""
    if not isinstance(base, str) or not base.startswith(_PREFIXO):
        return None
    raiz = os.path.normpath(os.path.join(exm_caminhos.raiz_program(), 'External', 'extensions'))
    pasta = os.path.normpath(os.path.join(raiz, unquote(base[len(_PREFIXO):])))
    if os.path.commonpath([pasta, raiz]) != raiz:
        return None
    return pasta if os.path.isdir(pasta) else None


def _alvo(mapa, nome, eh_pasta):
    """Mesma regra de icones.js::iconePara. Devolve 'subpasta/alvo' ou None."""
    limpo = str(nome or '').strip()
    padrao = mapa.get('padrao') or {}
    if eh_pasta:
        alvo = (mapa.get('pastas') or {}).get(limpo.lower()) or padrao.get('pasta')
        sub = 'pastas'
    else:
        ponto = limpo.rfind('.')
        chave = limpo[ponto + 1:].lower() if ponto > 0 else ''
        alvo = (mapa.get('extensoes') or {}).get(chave) or padrao.get('arquivo')
        sub = 'arquivos'
    return f'{sub}/{alvo}' if alvo else None


def montar(icones, completo):
    """Embute os SVGs do pacote de ícones em uso, só os que a árvore usa.
    Sem pacote (ou pacote ilegível) devolve None e a árvore fica com emoji."""
    if not isinstance(icones, dict) or not isinstance(completo, dict):
        return None
    mapa = icones.get('mapa')
    pasta = _pasta_do_pacote(icones.get('base'))
    if not isinstance(mapa, dict) or not mapa.get('padrao') or not pasta:
        return None

    arquivos, pastas = set(), set()
    for caminho in completo.get('paths') or []:
        partes = [p for p in str(caminho).replace('\\', '/').split('/') if p]
        if partes:
            arquivos.add(partes[-1])
            pastas.update(partes[:-1])
    for caminho in completo.get('dirs') or []:
        pastas.update(p for p in str(caminho).replace('\\', '/').split('/') if p)

    chaves = {_alvo(mapa, n, False) for n in arquivos} | {_alvo(mapa, n, True) for n in pastas}
    uris = {}
    for chave in chaves:
        if not chave:
            continue
        caminho = os.path.join(pasta, *chave.split('/')) + '.svg'
        try:
            with open(caminho, 'rb') as f:
                dados = base64.b64encode(f.read()).decode('ascii')
        except OSError:
            continue
        uris[chave] = 'data:image/svg+xml;base64,' + dados
    return {'mapa': {'padrao': mapa['padrao'], 'extensoes': mapa.get('extensoes') or {},
                     'pastas': mapa.get('pastas') or {}}, 'uris': uris}
