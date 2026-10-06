"""O `_resumo.json` de uma rotina que FALHOU antes de produzir qualquer coisa.

O caminho feliz cada rotina escreve sozinha, com os campos dela. Este módulo
cuida só do caminho triste, e existe porque ele estava faltando em quatro das
seis: Espelho (retirado em 2026-09), Documentação Técnica, Glossário e Pipeline
saíam por `return` nos erros iniciais (Workspace não carregado, nenhuma pasta
de trabalho, exceção no meio) **sem gravar nada**. O Resumo de Pastas já fazia
certo, gravando em todos os caminhos — é o molde daqui.

Não gravar não é detalhe de arrumação. O ciclo de acionamentos usa o
`finished_at` do `_resumo.json` como "esta rotina terminou"; sem arquivo, ele
ficava esperando uma rotina que já tinha morrido, e a diferença entre "falhou
por isto" e silêncio absoluto era justamente o que o usuário não conseguia ver.

⚠️ Módulo de FUNÇÃO, não mixin: quem chama são rotinas de três pastas
diferentes, e um mixin novo só para isto obrigaria a mexer em `api.py` e na
cadeia de herança para ganhar nada.
"""

import os
import json
from datetime import datetime

from ..caminhos import obter_pasta_da_rotina


def gravar_resumo_de_falha(project_name, agent_id, motivo, **extras):
    """Grava um `_resumo.json` dizendo que esta passada não produziu nada.

    Devolve `True` se conseguiu gravar. Falha de escrita é engolida de
    propósito: quem chama já está tratando um erro, e estourar aqui trocaria a
    mensagem verdadeira por uma sobre não conseguir gravar o aviso.

    O `finished_at` vai preenchido **de propósito**, e não é mentira: a passada
    terminou mesmo — sem sucesso. É o que faz o ciclo parar de esperar por ela e
    seguir dizendo o que houve, em vez de gastar o prazo inteiro em silêncio.
    """
    try:
        pasta = obter_pasta_da_rotina(project_name, agent_id)
        os.makedirs(pasta, exist_ok=True)
        dados = {
            'finished_at': datetime.now().isoformat(),
            'total': 0,
            'processed': 0,
            'error': motivo,
            # Uma linha na aba Erros, no mesmo formato das outras — senão a
            # falha existe no arquivo e não aparece em tela nenhuma.
            'errors': [{'file': '(a rotina não chegou a rodar)', 'path': '',
                        'reason': motivo}],
        }
        dados.update(extras)
        with open(os.path.join(pasta, '_resumo.json'), 'w', encoding='utf-8') as f:
            json.dump(dados, f, ensure_ascii=False, indent=2)
        return True
    except Exception:
        return False
