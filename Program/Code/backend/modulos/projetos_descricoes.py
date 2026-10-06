import os
import json

from .constantes import CONFIGS_DIR, PROJETOS_DESCRICOES_FILE

# Arquivo à parte de `projetos-grupos.json` de propósito — ver o comentário
# em `constantes.py` junto de `PROJETOS_DESCRICOES_FILE`: descrição edita a
# toda hora, taxonomia quase nunca.
#
# Formato: { "<nome-da-pasta>": "texto livre" }


def _ler_descricoes_projetos():
    if not os.path.exists(PROJETOS_DESCRICOES_FILE):
        return {}
    try:
        with open(PROJETOS_DESCRICOES_FILE, 'r', encoding='utf-8') as f:
            dados = json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}
    return dados if isinstance(dados, dict) else {}


def _gravar_descricoes_projetos(dados):
    os.makedirs(CONFIGS_DIR, exist_ok=True)
    with open(PROJETOS_DESCRICOES_FILE, 'w', encoding='utf-8') as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)


class ProjetosDescricoesMixin:

    def carregar_descricao_do_projeto(self, nome_projeto):
        return {'success': True, 'descricao': _ler_descricoes_projetos().get(nome_projeto, '')}

    def carregar_todas_descricoes(self):
        """Busca em lote — usada pela busca do quadro Kanban para filtrar por
        descrição sem uma chamada por projeto (evita N chamadas pywebview)."""
        return {'success': True, 'descricoes': _ler_descricoes_projetos()}

    def salvar_descricao_do_projeto(self, nome_projeto, texto):
        try:
            dados = _ler_descricoes_projetos()
            texto = (texto or '').strip()
            if texto:
                dados[nome_projeto] = texto
            else:
                dados.pop(nome_projeto, None)
            _gravar_descricoes_projetos(dados)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Sincronia com rename/delete de projeto (chamado por projetos.py) ─────
    def _renomear_descricao_projeto(self, old_name, new_name):
        try:
            dados = _ler_descricoes_projetos()
            if old_name in dados:
                dados[new_name] = dados.pop(old_name)
                _gravar_descricoes_projetos(dados)
        except Exception:
            pass

    def _remover_descricao_projeto(self, nome):
        try:
            dados = _ler_descricoes_projetos()
            if nome in dados:
                del dados[nome]
                _gravar_descricoes_projetos(dados)
        except Exception:
            pass
