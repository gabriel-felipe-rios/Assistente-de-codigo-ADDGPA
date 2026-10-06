"""O único arquivo que abre arquivo.

Grava só em `files/` desta extensão. Do projeto do usuário, só LÊ
(`ler_texto`) — a extensão nunca escreve lá (P5).
"""

import json
import os


def ler_json(caminho, padrao):
    """O JSON do caminho, ou `padrao` se o arquivo não existe (o caso normal
    de quem ainda não gravou nada) ou está quebrado."""
    try:
        with open(caminho, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return padrao
    except (ValueError, OSError) as e:
        print('[ct] não deu para ler %s: %s' % (caminho, e))
        return padrao


def gravar_json(caminho, dado):
    """Grava num `.tmp` e troca de uma vez: uma queda no meio não deixa o
    arquivo pela metade."""
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    tmp = caminho + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(dado, f, ensure_ascii=False, indent=2)
    os.replace(tmp, caminho)


def ler_texto(caminho):
    """O texto de um arquivo do site. `utf-8` primeiro; se não for, `latin-1`,
    que nunca falha. Só leitura."""
    with open(caminho, 'rb') as f:
        cru = f.read()
    try:
        return cru.decode('utf-8-sig')
    except UnicodeDecodeError:
        return cru.decode('latin-1')
