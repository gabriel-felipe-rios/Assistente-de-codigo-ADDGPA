import os
import json
import uuid

from .constantes import CONFIGS_DIR, PROJETOS_GRUPOS_FILE

# Formato do arquivo:
#   { "grupos": [{id, nome, cor, subgrupos: [{id, nome}]}],
#     "tags":   [{id, nome, cor}],
#     "atribuicoes": { "<nome-da-pasta>": {grupo_id, subgrupo_id, tags: [id,...]} } }
#
# Chave de grupo/tag é o ID (não o nome) — só assim renomear um grupo não
# exige reescrever a atribuição de cada projeto que aponta pra ele. Chave de
# `atribuicoes` é o nome da pasta do projeto — mesma identidade que
# `list_projects()` usa —, e por isso precisa ser mantida em dia por
# `rename_project`/`deletar_projeto` (ver `_renomear_projeto_na_taxonomia`/
# `_remover_projeto_da_taxonomia`, chamadas de `projetos.py`).

_PADRAO = {'grupos': [], 'tags': [], 'atribuicoes': {}}


def _ler_taxonomia_projetos():
    if not os.path.exists(PROJETOS_GRUPOS_FILE):
        return dict(_PADRAO)
    try:
        with open(PROJETOS_GRUPOS_FILE, 'r', encoding='utf-8') as f:
            dados = json.load(f)
    except (json.JSONDecodeError, OSError):
        return dict(_PADRAO)
    if not isinstance(dados, dict):
        return dict(_PADRAO)
    dados.setdefault('grupos', [])
    dados.setdefault('tags', [])
    dados.setdefault('atribuicoes', {})
    return dados


def _gravar_taxonomia_projetos(dados):
    os.makedirs(CONFIGS_DIR, exist_ok=True)
    with open(PROJETOS_GRUPOS_FILE, 'w', encoding='utf-8') as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)


def _novo_id(prefixo):
    return '%s_%s' % (prefixo, uuid.uuid4().hex[:8])


class ProjetosGruposMixin:

    def carregar_taxonomia_de_projetos(self):
        dados = _ler_taxonomia_projetos()
        return {'success': True, **dados}

    # ── Grupos ───────────────────────────────────────────────────────────────
    def criar_grupo_de_projetos(self, nome, cor):
        try:
            dados = _ler_taxonomia_projetos()
            dados['grupos'].append({
                'id': _novo_id('g'), 'nome': (nome or '').strip() or 'Grupo',
                'cor': cor, 'subgrupos': [],
            })
            _gravar_taxonomia_projetos(dados)
            return self.carregar_taxonomia_de_projetos()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def renomear_grupo_de_projetos(self, grupo_id, nome):
        try:
            dados = _ler_taxonomia_projetos()
            grupo = next((g for g in dados['grupos'] if g['id'] == grupo_id), None)
            if not grupo:
                return {'success': False, 'error': 'Grupo não encontrado.'}
            grupo['nome'] = (nome or '').strip() or grupo['nome']
            _gravar_taxonomia_projetos(dados)
            return self.carregar_taxonomia_de_projetos()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def definir_cor_do_grupo_de_projetos(self, grupo_id, cor):
        try:
            dados = _ler_taxonomia_projetos()
            grupo = next((g for g in dados['grupos'] if g['id'] == grupo_id), None)
            if not grupo:
                return {'success': False, 'error': 'Grupo não encontrado.'}
            grupo['cor'] = cor
            _gravar_taxonomia_projetos(dados)
            return self.carregar_taxonomia_de_projetos()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def deletar_grupo_de_projetos(self, grupo_id):
        try:
            dados = _ler_taxonomia_projetos()
            dados['grupos'] = [g for g in dados['grupos'] if g['id'] != grupo_id]
            # Projeto que apontava pra este grupo cai em "Sem grupo" — nunca
            # fica com um grupo_id órfão apontando pra nada.
            for atrib in dados['atribuicoes'].values():
                if atrib.get('grupo_id') == grupo_id:
                    atrib['grupo_id'] = None
                    atrib['subgrupo_id'] = None
            _gravar_taxonomia_projetos(dados)
            return self.carregar_taxonomia_de_projetos()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Subgrupos ────────────────────────────────────────────────────────────
    # Subgrupo tem cor própria, independente da do grupo — o quadro tinge a
    # coluna com a cor do grupo e a seção do subgrupo com a cor dele, nunca o
    # cartão do projeto (decisão do usuário: o cartão fica na cor normal).
    def criar_subgrupo_de_projetos(self, grupo_id, nome, cor):
        try:
            dados = _ler_taxonomia_projetos()
            grupo = next((g for g in dados['grupos'] if g['id'] == grupo_id), None)
            if not grupo:
                return {'success': False, 'error': 'Grupo não encontrado.'}
            grupo['subgrupos'].append({'id': _novo_id('sg'), 'nome': (nome or '').strip() or 'Subgrupo', 'cor': cor})
            _gravar_taxonomia_projetos(dados)
            return self.carregar_taxonomia_de_projetos()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def definir_cor_do_subgrupo_de_projetos(self, grupo_id, subgrupo_id, cor):
        try:
            dados = _ler_taxonomia_projetos()
            grupo = next((g for g in dados['grupos'] if g['id'] == grupo_id), None)
            if not grupo:
                return {'success': False, 'error': 'Grupo não encontrado.'}
            sub = next((s for s in grupo['subgrupos'] if s['id'] == subgrupo_id), None)
            if not sub:
                return {'success': False, 'error': 'Subgrupo não encontrado.'}
            sub['cor'] = cor
            _gravar_taxonomia_projetos(dados)
            return self.carregar_taxonomia_de_projetos()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def renomear_subgrupo_de_projetos(self, grupo_id, subgrupo_id, nome):
        try:
            dados = _ler_taxonomia_projetos()
            grupo = next((g for g in dados['grupos'] if g['id'] == grupo_id), None)
            if not grupo:
                return {'success': False, 'error': 'Grupo não encontrado.'}
            sub = next((s for s in grupo['subgrupos'] if s['id'] == subgrupo_id), None)
            if not sub:
                return {'success': False, 'error': 'Subgrupo não encontrado.'}
            sub['nome'] = (nome or '').strip() or sub['nome']
            _gravar_taxonomia_projetos(dados)
            return self.carregar_taxonomia_de_projetos()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def deletar_subgrupo_de_projetos(self, grupo_id, subgrupo_id):
        try:
            dados = _ler_taxonomia_projetos()
            grupo = next((g for g in dados['grupos'] if g['id'] == grupo_id), None)
            if not grupo:
                return {'success': False, 'error': 'Grupo não encontrado.'}
            grupo['subgrupos'] = [s for s in grupo['subgrupos'] if s['id'] != subgrupo_id]
            for atrib in dados['atribuicoes'].values():
                if atrib.get('subgrupo_id') == subgrupo_id:
                    atrib['subgrupo_id'] = None
            _gravar_taxonomia_projetos(dados)
            return self.carregar_taxonomia_de_projetos()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Tags ─────────────────────────────────────────────────────────────────
    def criar_tag_de_projetos(self, nome, cor):
        try:
            dados = _ler_taxonomia_projetos()
            dados['tags'].append({'id': _novo_id('t'), 'nome': (nome or '').strip() or 'Tag', 'cor': cor})
            _gravar_taxonomia_projetos(dados)
            return self.carregar_taxonomia_de_projetos()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def renomear_tag_de_projetos(self, tag_id, nome):
        try:
            dados = _ler_taxonomia_projetos()
            tag = next((t for t in dados['tags'] if t['id'] == tag_id), None)
            if not tag:
                return {'success': False, 'error': 'Tag não encontrada.'}
            tag['nome'] = (nome or '').strip() or tag['nome']
            _gravar_taxonomia_projetos(dados)
            return self.carregar_taxonomia_de_projetos()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def definir_cor_da_tag_de_projetos(self, tag_id, cor):
        try:
            dados = _ler_taxonomia_projetos()
            tag = next((t for t in dados['tags'] if t['id'] == tag_id), None)
            if not tag:
                return {'success': False, 'error': 'Tag não encontrada.'}
            tag['cor'] = cor
            _gravar_taxonomia_projetos(dados)
            return self.carregar_taxonomia_de_projetos()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def deletar_tag_de_projetos(self, tag_id):
        try:
            dados = _ler_taxonomia_projetos()
            dados['tags'] = [t for t in dados['tags'] if t['id'] != tag_id]
            for atrib in dados['atribuicoes'].values():
                if tag_id in (atrib.get('tags') or []):
                    atrib['tags'] = [t for t in atrib['tags'] if t != tag_id]
            _gravar_taxonomia_projetos(dados)
            return self.carregar_taxonomia_de_projetos()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Atribuição por projeto ───────────────────────────────────────────────
    def definir_grupo_do_projeto(self, nome_projeto, grupo_id, subgrupo_id):
        try:
            dados = _ler_taxonomia_projetos()
            atrib = dados['atribuicoes'].setdefault(nome_projeto, {'grupo_id': None, 'subgrupo_id': None, 'tags': []})
            atrib['grupo_id'] = grupo_id
            atrib['subgrupo_id'] = subgrupo_id if grupo_id else None
            _gravar_taxonomia_projetos(dados)
            return self.carregar_taxonomia_de_projetos()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def definir_tags_do_projeto(self, nome_projeto, tag_ids):
        try:
            dados = _ler_taxonomia_projetos()
            atrib = dados['atribuicoes'].setdefault(nome_projeto, {'grupo_id': None, 'subgrupo_id': None, 'tags': []})
            atrib['tags'] = list(tag_ids or [])
            _gravar_taxonomia_projetos(dados)
            return self.carregar_taxonomia_de_projetos()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Sincronia com rename/delete de projeto (chamado por projetos.py) ─────
    def _renomear_projeto_na_taxonomia(self, old_name, new_name):
        try:
            dados = _ler_taxonomia_projetos()
            if old_name in dados['atribuicoes']:
                dados['atribuicoes'][new_name] = dados['atribuicoes'].pop(old_name)
                _gravar_taxonomia_projetos(dados)
        except Exception:
            pass

    def _remover_projeto_da_taxonomia(self, nome):
        try:
            dados = _ler_taxonomia_projetos()
            if nome in dados['atribuicoes']:
                del dados['atribuicoes'][nome]
                _gravar_taxonomia_projetos(dados)
        except Exception:
            pass
