"""O que o programa acrescenta ao payload de um recurso plugável quando ele
diz em qual projeto está trabalhando.

Um plugin e uma extensão do programa recebem `{'projeto': 'Meu projeto'}` e
precisam, quase sempre, das mesmas três coisas: onde fica a pasta do código,
o grafo de imports se já tiver sido rodado, e o resultado de "Visualizar
pipeline" se já existir. Nenhum dos dois tem como descobrir isso sozinho sem
conhecer a estrutura interna do programa — que é exatamente o que a fronteira
de um recurso plugável existe para esconder.

Esta função morava dentro de `chamar_plugin`. Saiu de lá em 04/09/2026,
quando `chamar_extensao` precisou do mesmo trecho: era ele ou a terceira
cópia.
"""

import os
import json

from .caminhos import obter_pasta_da_rotina


def enriquecer(api, payload):
    """Devolve uma CÓPIA do payload com `pasta_projeto`, `grafo_imports` e
    `pipeline` acrescentados, quando houver.

    `api` é a instância da `Api` — as três leituras já são métodos dela, e
    reimplementá-las aqui duplicaria o parser do `pipeline.md`.

    Cada leitura falha em silêncio de propósito: um projeto que nunca rodou o
    Grafo de Imports simplesmente não recebe a chave. Fazer disto um erro
    obrigaria todo plugin a tratar o caso normal como exceção.
    """
    payload = dict(payload or {})
    projeto = payload.get('projeto')
    if not projeto:
        return payload

    try:
        # `load_workspace` devolve {'success': ..., 'config': {...}} — o
        # `root_folder` mora DENTRO de `config`, não no nível de cima.
        workspace = api.load_workspace(projeto)
        payload['pasta_projeto'] = (workspace.get('config') or {}).get('root_folder')
    except Exception:
        payload['pasta_projeto'] = None

    try:
        caminho_grafo = obter_pasta_da_rotina(projeto, 'grafo-imports', 'grafo.json')
        if os.path.isfile(caminho_grafo):
            with open(caminho_grafo, 'r', encoding='utf-8') as f:
                payload['grafo_imports'] = json.load(f)
    except Exception:
        pass

    try:
        # Leitura pura, já exposta pela própria Api — não reimplementa o
        # parser do pipeline.md. Devolve success=False sem lançar quando o
        # projeto nunca rodou o agente Pipeline.
        resultado_pipeline = api.get_visualizar_pipeline_result(projeto)
        if resultado_pipeline.get('success'):
            payload['pipeline'] = resultado_pipeline
    except Exception:
        pass

    return payload
