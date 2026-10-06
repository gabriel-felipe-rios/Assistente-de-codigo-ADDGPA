from .constantes import *


class ContextoMixin:

    # ── Leitura dos templates de prompt das ROTINAS ───────────────────────────
    # `name` é o nome do arquivo em `prompts/Rotinas/`, sem a extensão — o
    # mesmo string que o botão "ver prompt" da tela manda. Os prompts do
    # Assistente (Chat, Fila, Designer, Subagentes) NÃO passam por aqui: eles
    # têm ajudantes próprios em `caminhos.py`.
    def get_prompt_template(self, name):
        path = obter_prompt_de_rotina(f'{name}.txt')
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return {'success': True, 'content': f.read()}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _load_prompt_template(self, name):
        path = obter_prompt_de_rotina(f'{name}.txt')
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return f.read().strip()
        except Exception:
            return ''

    # `build_prompt_context`, `_obter_symbols_list` e `_montar_mapa_simbolos`
    # foram deletados: eram o "Context Builder", uma tela que nunca existiu.
    # As três funções JS que ele chamava (showBuiltContext, contextProgress,
    # contextBuildError) não estão em nenhum arquivo do frontend, e nada
    # chamava build_prompt_context. Com ele saíram os prompts
    # construir-contexto.txt e construir-contexto-schema.json.
