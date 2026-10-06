"""Servidor MCP Assistente — stdio, Python puro (sem SDK).

As 19 ferramentas de código/navegação. O Claude Code lança este processo (via
`.mcp.json` no root do projeto) e conversa por JSON-RPC em stdin/stdout. As
ferramentas read-only reaproveitam os métodos da classe `Api` do app, que são
puros (não precisam da janela do pywebview).

Uso: python servidor.py --project "<nome do projeto no app>" [--enabled a,b,c]
"""
import sys
import os
import json
import argparse

# Program/Dependencies (AMF § 9.6) antes de QUALQUER import do backend —
# `import ferramentas` em main() já puxa `modulos.catalogo_mcp`.
_DEPENDENCIAS = os.path.normpath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'Dependencies'))
if _DEPENDENCIAS not in sys.path:
    sys.path.insert(0, _DEPENDENCIAS)

PROTOCOL_VERSION = '2024-11-05'


def _here():
    return os.path.dirname(os.path.abspath(__file__))


def _bootstrap_api():
    backend = os.path.normpath(os.path.join(_here(), '..', '..', 'backend'))
    # Mesmo destino de cache do lançador (`.pyw`): este servidor é um processo
    # próprio, lançado pelo assistente externo, e o prefixo de lá não o alcança.
    # Antes do `from api import Api`, senão o backend inteiro nasce em `__pycache__`.
    sys.pycache_prefix = os.path.normpath(os.path.join(backend, '..', '..', 'Internal', 'cache', 'pycache'))
    if backend not in sys.path:
        sys.path.insert(0, backend)
    from api import Api
    # G11 — o MCP não liga extensão (ver api.py)
    return Api(ligar_extensoes=False)


def main():
    # O Claude Code lança este processo com o stdout no code page do console
    # (cp1252 no Windows), que não tem caracteres como "≤". Forçar UTF-8 aqui é
    # o que impede o servidor de travar no tools/list. Sem isso, o handshake
    # funciona mas a listagem de ferramentas mata o processo.
    for _stream in (sys.stdout, sys.stdin):
        try:
            _stream.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass

    ap = argparse.ArgumentParser()
    ap.add_argument('--project', required=True, help='nome do projeto no app (pasta em Projetos/)')
    ap.add_argument('--enabled', default='', help='lista de ferramentas separadas por vírgula; vazio = todas')
    args = ap.parse_args()

    # ferramentas.py e carimbo_frescor.py estão na mesma pasta deste script.
    if _here() not in sys.path:
        sys.path.insert(0, _here())
    import ferramentas as F
    import carimbo_frescor

    api = _bootstrap_api()
    project = args.project
    enabled = {t.strip() for t in args.enabled.split(',') if t.strip()} or None
    tools = [t for t in F.TOOLS if (enabled is None or t['name'] in enabled)]
    tools_by_name = {t['name']: t for t in tools}

    def send(obj):
        sys.stdout.write(json.dumps(obj, ensure_ascii=False) + '\n')
        sys.stdout.flush()

    for raw in sys.stdin:
        line = raw.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except Exception:
            continue
        mid = msg.get('id')
        method = msg.get('method')

        if method == 'initialize':
            send({'jsonrpc': '2.0', 'id': mid, 'result': {
                'protocolVersion': PROTOCOL_VERSION,
                'capabilities': {'tools': {}},
                'serverInfo': {'name': 'assistente', 'version': '0.1.0'},
            }})
        elif method in ('notifications/initialized', 'initialized'):
            pass  # notificação — sem resposta
        elif method == 'ping':
            send({'jsonrpc': '2.0', 'id': mid, 'result': {}})
        elif method == 'tools/list':
            send({'jsonrpc': '2.0', 'id': mid, 'result': {'tools': [
                {'name': t['name'], 'description': t['description'], 'inputSchema': t['schema']}
                for t in tools
            ]}})
        elif method == 'tools/call':
            params = msg.get('params', {}) or {}
            name = params.get('name')
            call_args = params.get('arguments', {}) or {}
            t = tools_by_name.get(name)
            if not t:
                send({'jsonrpc': '2.0', 'id': mid,
                      'error': {'code': -32602, 'message': f'Ferramenta desconhecida: {name}'}})
                continue
            try:
                text = t['fn'](api, project, call_args)
                # O carimbo de frescor: uma linha avisando que o artefato pode
                # estar velho. Só as ferramentas com `fonte: 'artefato'` o
                # recebem, e só quando há o que avisar — ver carimbo_frescor.py.
                text = carimbo_frescor.aplicar(
                    api, project, text, t.get('fonte') == 'artefato')
            except Exception as e:
                text = f'Erro na ferramenta {name}: {e}'
            send({'jsonrpc': '2.0', 'id': mid, 'result': {
                'content': [{'type': 'text', 'text': text or '(vazio)'}]
            }})
        elif mid is not None:
            send({'jsonrpc': '2.0', 'id': mid,
                  'error': {'code': -32601, 'message': f'Método não suportado: {method}'}})


if __name__ == '__main__':
    main()
