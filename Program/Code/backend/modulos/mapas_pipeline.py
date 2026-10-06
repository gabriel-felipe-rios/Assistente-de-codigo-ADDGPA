import re as _re

from .constantes import *


class VisualizarPipelineMixin:
    """A tela `Assistente → Visualizar pipeline` — as 6 leituras do Pipeline.

    Esta tela NÃO chama o modelo. Ela lê o `_niveis.json` que a rotina
    Pipeline grava em `Automação/Rotinas/Pipeline/` e devolve as cadeias em
    forma de dado para o frontend desenhar. As 6 leituras (Raias, Trilho,
    Sequência, Fases, Cadeias, Markdown) são seis desenhos do MESMO dado:
    trocar de leitura custa zero chamada e zero token.

    Desde o Pipeline em níveis (fase 03), o `pipeline.md` é só a Visão geral.
    O retorno daqui continua EXATAMENTE o de antes — mesmas chaves, mesmos
    tipos, e o `markdown` no formato antigo (cabeçalho + todas as cadeias com
    as linhas de passo), montado por `_pl_md_legado` —, e é também o que o
    programa injeta em `payload['pipeline']` para os plugins.

    Antes da primeira obra desta tela ela gastava uma chamada de LLM só para
    redesenhar em Mermaid o que já estava escrito — e o Mermaid vinha de um
    `import` de CDN, o que obrigava o programa a ter internet para abrir.
    """

    # `> ⚠️ **101 hubs fora do fluxo** (viram selo ...): `a.js`, ...`
    _VP_AVISO = _re.compile(r'^>\s*⚠️\s*(.+?)\s*$')

    def _vp_pipeline_path(self, project_name):
        return obter_pasta_da_rotina(project_name, 'pipeline', '_niveis.json')

    def get_visualizar_pipeline_status(self, project_name):
        return {'success': True,
                'pipeline_exists': os.path.isfile(self._vp_pipeline_path(project_name))}

    def get_visualizar_pipeline_result(self, project_name):
        """As cadeias do `_niveis.json` como estrutura E como texto.

        O texto (`markdown`) e as `avisos`/`cabecalho` saem do mesmo montador
        que a rotina usa para escrever a linha do passo (`pipeline_gravacao.py`):
        os dois lados no mesmo lugar, para um não mudar sem o outro.
        """
        path = self._vp_pipeline_path(project_name)
        if not os.path.isfile(path):
            return {'success': False,
                    'error': 'O Pipeline ainda não foi gerado neste projeto. '
                             'Rode a rotina Pipeline em Automação › Rotinas.'}
        try:
            with open(path, 'r', encoding='utf-8') as f:
                niveis = json.load(f)
            texto = self._pl_md_legado(niveis)
        except Exception as e:
            return {'success': False, 'error': str(e)}

        cadeias = []
        for c in niveis.get('cadeias') or []:
            cadeias.append({
                'n': int(str(c['id'])[1:]),
                'nome': self._pl_rotulo_da_cadeia(c),
                'cabeca': c.get('cabeca') or '',
                'tipo': c.get('tipo') or '',
                'passos': [{'ordem': int(p['ordem']), 'fase': int(p['fase']),
                            'origem': p['origem'], 'destino': p['destino'], 'via': p['via'],
                            'frase': (p.get('frase') or '').strip() or '(sem descrição)',
                            'selos': list(p.get('selos') or [])}
                           for p in c.get('passos') or []],
            })

        avisos, cabecalho = [], ''
        for linha in texto.splitlines():
            m = self._VP_AVISO.match(linha)
            if m:
                avisos.append(_re.sub(r'\*\*|`', '', m.group(1)))
            elif linha.startswith('_') and 'passos ·' in linha and not cabecalho:
                cabecalho = linha.strip('_')

        return {'success': True, 'markdown': texto, 'cadeias': cadeias,
                'avisos': avisos, 'cabecalho': cabecalho,
                'passos': sum(len(c['passos']) for c in cadeias)}
