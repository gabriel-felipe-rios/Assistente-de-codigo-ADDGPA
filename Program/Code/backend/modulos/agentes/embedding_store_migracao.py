"""Trazer para o banco os embeddings da era dos `.json` soltos.

Antes de existir o `index.db`, cada documento virava um `.json` numa árvore de
pastas, e toda busca fazia `os.walk` lendo todos eles. Esta é a ponte de mão
única entre aquele formato e este — roda uma vez por projeto, não faz nada
depois, e é chamada na entrada de quem lê o índice.

Vive em arquivo próprio porque responde uma pergunta que não é a das outras
duas metades: não é "onde os vetores ficam" nem "como o corpo de uma função é
guardado", é **"como trazer o que ficou para trás"**. Separada quando
`embedding_store.py` passou das 500 linhas do teto da AMF.
"""

import json
import os

from ..caminhos import obter_pasta_da_rotina
from .embedding_store import _connect


def migrate_json_tree(project_name):
    """Se ainda existir a árvore antiga `embedding/{tipo}/*.json`, importa cada
    arquivo para o banco (sem re-embutir) e remove a árvore. Roda uma vez."""
    import json
    import shutil

    base = obter_pasta_da_rotina(project_name, 'embedding')
    if not os.path.isdir(base):
        return 0
    # `espelho` fica: é o nome do tipo nos bancos gravados antes de 2026-09.
    tipos = ('espelho', 'documentacao-tecnica', 'resumo-pastas')
    migrados = 0
    for tipo in tipos:
        tdir = os.path.join(base, tipo)
        if not os.path.isdir(tdir):
            continue
        for root, dirs, files in os.walk(tdir):
            for fname in files:
                if not fname.endswith('.json'):
                    continue
                fpath = os.path.join(root, fname)
                try:
                    with open(fpath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    vec = data.get('vector')
                    if not vec:
                        continue
                    src = data.get('source_file') or os.path.relpath(fpath, tdir).replace('\\', '/')
                    upsert(project_name, tipo, src, data.get('md_hash', ''),
                           data.get('excerpt', ''), vec)
                    migrados += 1
                except Exception:
                    pass
        # Remove a árvore antiga do tipo (o banco agora é a fonte).
        try:
            shutil.rmtree(tdir)
        except Exception:
            pass
    return migrados
