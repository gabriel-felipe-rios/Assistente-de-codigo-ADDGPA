"""Todo erro gravado por qualquer rotina, num lugar só (aba Automação → Erros).

Cada rotina guarda os erros dela no próprio `_resumo.json`, e cada uma os mostra
dentro do próprio card. Faltava a pergunta óbvia — *"o que deu errado na última
geração, no geral?"* —, e a sub-aba que tinha o nome certo para respondê-la
mostrava outra coisa: `get_arquivos_grandes`, uma varredura de arquivos que não
cabem no orçamento de contexto. Um arquivo que falhou ao gerar não aparecia ali,
e o botão "Verificar" refazia a medição de tamanho sem nunca abrir um
`_resumo.json`.

As duas coisas continuam existindo, agora lado a lado e com nome cada uma:
**o que falhou** (isto aqui) e **o que não cabe** (`arquivos_grandes.py`).

⚠️ Formatos diferentes, de propósito unificados aqui e não lá:
  · Doc. Técnica e Resumo de Pastas gravam `errors` com
    `{file, path, reason}` — o formato que `utils.js::renderAgenteIssueList` lê;
  · o Glossário grava `erros` (sem o `s` do inglês) com `{termo, reason}`;
  · o Pipeline não gravava lista nenhuma.
Reescrever o disco de todo mundo obrigaria a migrar arquivo já gerado; ler os
dois nomes aqui custa três linhas e não quebra nada que já existe.
"""

import os
import json

from ..caminhos import IDS_DAS_ROTINAS, PASTAS_DAS_ROTINAS, obter_pasta_da_rotina


class ErrosDasRotinasMixin:

    def _erros_de_uma_rotina(self, project_name, agent_id):
        """A lista de erros da última passada desta rotina, já normalizada."""
        try:
            caminho = obter_pasta_da_rotina(project_name, agent_id, '_resumo.json')
            if not os.path.isfile(caminho):
                return [], None
            with open(caminho, 'r', encoding='utf-8') as f:
                resumo = json.load(f)
        except Exception:
            return [], None

        rotulo = PASTAS_DAS_ROTINAS.get(agent_id, agent_id)
        itens = []
        for bruto in (resumo.get('errors') or []) + (resumo.get('erros') or []):
            if not isinstance(bruto, dict):
                continue
            itens.append({
                'rotina': rotulo,
                'rotina_id': agent_id,
                # `termo` é do Glossário: para ele o "arquivo" é o termo.
                'file': bruto.get('file') or bruto.get('termo') or '',
                'path': bruto.get('path') or '',
                'reason': bruto.get('reason') or '',
            })

        # Falha que derrubou a rotina inteira antes de ela listar arquivo nenhum.
        # `resumo_de_rotina.py` já grava isso dentro de `errors`; este ramo pega
        # o Resumo de Pastas, que tem `error` solto desde antes.
        motivo = resumo.get('error')
        if motivo and not itens:
            itens.append({'rotina': rotulo, 'rotina_id': agent_id,
                          'file': '(a rotina não chegou a rodar)', 'path': '',
                          'reason': str(motivo)})
        return itens, resumo.get('finished_at')

    def get_erros_das_rotinas(self, project_name):
        """Os erros de TODAS as rotinas, na ordem em que elas rodam.

        `IDS_DAS_ROTINAS` e não `PASTAS_DAS_ROTINAS.items()`: o segundo tem
        `doc-tecnica` e `documentacao-tecnica` apontando para a mesma pasta, e
        iterar por ele contaria a Documentação Técnica duas vezes.
        """
        try:
            erros, por_rotina = [], []
            for agent_id in IDS_DAS_ROTINAS:
                itens, quando = self._erros_de_uma_rotina(project_name, agent_id)
                if itens:
                    erros.extend(itens)
                    por_rotina.append({
                        'rotina': PASTAS_DAS_ROTINAS.get(agent_id, agent_id),
                        'rotina_id': agent_id,
                        'quantos': len(itens),
                        'finished_at': quando,
                    })
            return {'success': True, 'erros': erros, 'por_rotina': por_rotina}
        except Exception as e:
            return {'success': False, 'error': str(e)}
