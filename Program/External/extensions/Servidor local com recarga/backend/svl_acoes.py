"""O que cada ação faz — e o estado do servidor, em memória.

⚠️ O estado mora NESTE MÓDULO (`_atual`), e não em disco: o módulo fica
importado enquanto a extensão está ligada (`Como criar extensões.md` § 10,
"Estado entre chamadas"). Quem garante que o servidor cai ao desligar é o
programa, pelo processo gerenciado `payload['processos']` — nome `'servidor'`.
"""

import os
import threading
from urllib.parse import quote

from . import svl_servidor

_PORTA_PADRAO = 5500
_PROCESSO = 'servidor'

# O que está no ar agora. `porta`/`pasta`/`projeto` valem enquanto o processo
# `'servidor'` roda; `erro` é o da última subida que falhou (porta ocupada…).
_atual = {'porta': None, 'pasta': None, 'projeto': None, 'erro': ''}

# ⚠️ Duas chamadas de `subir` ao mesmo tempo (dois cliques no ▶ Executar) cada
# uma numa thread da ponte: sem a trava, a segunda tentaria prender a porta que
# a primeira acabou de prender e diria "ocupada" contra si mesma.
_trava = threading.Lock()


def _porta(payload):
    prefs = payload.get('preferencias') or {}
    try:
        porta = int(prefs.get('porta') or _PORTA_PADRAO)
    except (TypeError, ValueError):
        porta = _PORTA_PADRAO
    return porta


def _rodando(processos):
    return bool((processos.rodando(_PROCESSO) or {}).get('rodando'))


def _url_base(porta):
    return 'http://127.0.0.1:%d/' % porta


def _url_do_arquivo(caminho, pasta, url_base):
    """`(erro, url)`. O endereço do arquivo do caminho, codificado (espaço,
    acento, `#`) — e não o "primeiro `.html` do Editor" de antes."""
    if not caminho:
        return None, url_base
    try:
        rel = os.path.relpath(os.path.abspath(caminho), pasta)
    except ValueError:
        rel = '..'     # outro disco: fora da pasta, com certeza
    if rel == '..' or rel.startswith('..' + os.sep) or os.path.isabs(rel):
        return ('O arquivo está fora da pasta do projeto — o servidor serve só a '
                'pasta do projeto.'), None
    if caminho.lower().endswith(('.html', '.htm')):
        partes = rel.replace('\\', '/').split('/')
        return None, url_base + '/'.join(quote(p) for p in partes)
    # Outro arquivo (ex.: `main.py`): a raiz — o servidor escolhe o index.html.
    return None, url_base


def subir(payload):
    """Sobe o servidor na pasta do projeto (se já não está no ar ali, na mesma
    porta) e devolve o endereço do arquivo do caminho."""
    processos = payload.get('processos')
    if processos is None:
        return {'success': False, 'error': 'o programa não entregou `processos`.'}
    pasta = payload.get('pasta_projeto')
    if not pasta or not os.path.isdir(pasta):
        return {'success': False,
                'error': 'Este projeto não tem pasta de código — o servidor serve a pasta do projeto.'}
    pasta = os.path.abspath(pasta)
    porta = _porta(payload)
    url_base = _url_base(porta)

    erro, url = _url_do_arquivo(payload.get('caminho') or '', pasta, url_base)
    if erro:
        return {'success': False, 'error': erro}

    with _trava:
        mesmo = (_rodando(processos) and _atual['pasta'] == pasta and _atual['porta'] == porta)
        if not mesmo:
            # ⚠️ PARE ANTES DE CRIAR. Subir de novo sem derrubar o anterior
            # daria "porta ocupada" contra si mesmo.
            r = processos.parar(_PROCESSO)
            if not r.get('success'):
                return {'success': False, 'error': r.get('error') or 'não deu para parar o servidor anterior.'}
            _atual.update(porta=None, pasta=None, projeto=None)
            try:
                srv = svl_servidor.criar(porta, pasta)
            except OSError as e:
                print('[svl] a porta %d esta ocupada: %s' % (porta, e))
                _atual['erro'] = 'A porta %d está ocupada por outro programa.' % porta
                return {'success': False, 'error': _atual['erro']}
            r = processos.ligar(_PROCESSO, lambda parar: svl_servidor.rodar(srv, parar))
            if not r.get('success'):
                srv.server_close()
                _atual['erro'] = r.get('error') or 'não deu para subir o servidor.'
                return {'success': False, 'error': _atual['erro']}
            print('[svl] servindo %s em %s' % (pasta, url_base))
        _atual.update(porta=porta, pasta=pasta, projeto=payload.get('projeto'), erro='')

    return {'success': True, 'url': url, 'url_base': url_base, 'porta': porta, 'pasta': pasta}


def parar(payload):
    """Derruba o servidor. Com `projeto`, só se for o dele que está no ar."""
    processos = payload.get('processos')
    if processos is None:
        return {'success': False, 'error': 'o programa não entregou `processos`.'}
    projeto = payload.get('projeto')
    with _trava:
        if projeto and _atual['projeto'] and projeto != _atual['projeto']:
            return {'success': True}
        r = processos.parar(_PROCESSO)
        _atual.update(porta=None, pasta=None, projeto=None, erro='')
    if not r.get('success'):
        return {'success': False, 'error': r.get('error') or 'não deu para parar o servidor.'}
    return {'success': True}


def estado(payload):
    """O que está no ar — para a linha do Terminal e o Acesso rápido."""
    processos = payload.get('processos')
    rodando = bool(processos is not None and _rodando(processos))
    porta = _atual['porta'] if rodando else None
    return {'success': True, 'estado': {
        'rodando': rodando,
        'porta': porta,
        'url_base': _url_base(porta) if porta else '',
        'projeto': _atual['projeto'] if rodando else None,
        'erro': _atual['erro'],
    }}


def salvou(payload):
    """Um arquivo foi salvo: toca o relógio da recarga."""
    svl_servidor.tocar_versao()
    return {'success': True}
