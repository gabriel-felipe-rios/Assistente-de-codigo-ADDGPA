"""Complexidade ciclomática por arquivo (via tree-sitter).

Conta os "pontos de decisão" na árvore sintática — if/elif, for, while, case,
catch/except, ternário e operadores booleanos (&&, ||, and, or) — e devolve
`1 + total` por arquivo. Determinístico, sem LLM. Usado pelo toggle "por
complexidade" do Treemap (Mapas). Green→vermelho: quanto maior, mais caminhos.

Métrica clássica de McCabe: mede quantos caminhos independentes o código tem.
(Uma futura "complexidade cognitiva" penalizaria aninhamento — aqui não.)
"""

import os
from modulos.ignorados import esta_ignorado as _esta_ignorado
from modulos.treesitter import make_parser

_PARSER_CACHE = {}

# Só linguagens que o tree-sitter parseia aqui. CSS/HTML/JSON/MD não têm fluxo
# de controle, então ficam sem complexidade (cinza no treemap).
_EXT_LANG = {
    '.py': 'Python', '.pyw': 'Python',
    '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
    '.ts': 'TypeScript', '.tsx': 'TypeScript', '.mts': 'TypeScript', '.cts': 'TypeScript',
    '.cs': 'C#', '.java': 'Java', '.go': 'Go', '.rs': 'Rust',
    '.c': 'C', '.h': 'C', '.cc': 'C++', '.cpp': 'C++', '.cxx': 'C++', '.hpp': 'C++',
}

# Tipos de nó (tree-sitter) que somam +1 — abrangente entre linguagens.
_DECISION_TYPES = {
    'if_statement', 'elif_clause', 'else_if_clause',
    'for_statement', 'for_in_statement', 'foreach_statement', 'enhanced_for_statement',
    'while_statement', 'do_statement',
    'case_statement', 'switch_case', 'case_clause', 'when_entry', 'match_arm',
    'catch_clause', 'except_clause',
    'conditional_expression', 'ternary_expression',
    'boolean_operator',  # Python: `a and b`
    'list_comprehension', 'set_comprehension', 'dictionary_comprehension', 'generator_expression',
}
# Operadores booleanos como tokens (C-family / JS): nós anônimos '&&' e '||'.
_BOOL_TOKENS = {'&&', '||'}

_MAX_SIZE = 500 * 1024


def _make_parser(lang):
    if lang in _PARSER_CACHE:
        return _PARSER_CACHE[lang]
    # A fonte única (`treesitter.make_parser`). Ela sabe HTML/CSS também, mas
    # daqui nunca se pede: `_EXT_LANG` acima não tem nenhuma das duas.
    p = make_parser(lang)
    _PARSER_CACHE[lang] = p
    return p


def _contar_decisoes(root):
    total = 0
    stack = [root]
    while stack:
        n = stack.pop()
        t = n.type
        if t in _DECISION_TYPES or t in _BOOL_TOKENS:
            total += 1
        stack.extend(n.children)
    return total


class ComplexidadeMixin:

    def get_complexidade(self, project_name):
        """{abs_path: complexidade} + max, respeitando ignore_list e as
        extensões ativas na config de linguagens."""
        try:
            workspace = self.load_workspace(project_name)
            if not workspace.get('success'):
                return {'success': False, 'error': 'Workspace não carregado.'}
            config = workspace['config']
            folders = config.get('working_folders', []) or []
            ignore_list = config.get('ignore_list', []) or []
            if not folders:
                return {'success': True, 'por_arquivo': {}, 'max': 1}

            # `_EXT_LANG` diz o que o tree-sitter SABE parsear; a seleção
            # efetiva diz o que o usuário mandou contar. O treemap usa a
            # intersecção: só linguagem que dá para medir E está marcada. O que
            # sair fica cinza, como já ficava CSS/HTML/JSON/MD.
            #
            # ⚠️ A lista continua sendo dela, e não vira uma lista compartilhada
            # com o Resumo, os Mapas ou a busca de usos: cada uma responde uma
            # pergunta diferente. Ver o "NÃO UNIFICAR" em cobertura.py.
            from modulos.linguagens import conta_como_codigo
            from modulos.ignorados import fora_do_programa
            ext_lang = {e: l for e, l in _EXT_LANG.items() if conta_como_codigo(e)}

            def esta_ignorado(path):
                return _esta_ignorado(path, ignore_list)

            por_arquivo = {}
            maxv = 1
            for folder in folders:
                if not os.path.isdir(folder):
                    continue
                for root, dirs, files in os.walk(folder):
                    if esta_ignorado(root):
                        dirs.clear()
                        continue
                    dirs[:] = [d for d in dirs
                               if not esta_ignorado(os.path.join(root, d))
                               and not fora_do_programa(os.path.join(root, d))]
                    for fname in files:
                        fpath = os.path.join(root, fname)
                        if esta_ignorado(fpath) or fora_do_programa(fpath):
                            continue
                        ext = os.path.splitext(fname)[1].lower()
                        if ext not in ext_lang:
                            continue
                        try:
                            if os.path.getsize(fpath) > _MAX_SIZE:
                                continue
                            parser = _make_parser(ext_lang[ext])
                            if parser is None:
                                continue
                            with open(fpath, 'rb') as f:
                                data = f.read()
                            tree = parser.parse(data)
                            c = 1 + _contar_decisoes(tree.root_node)
                            por_arquivo[fpath] = c
                            if c > maxv:
                                maxv = c
                        except Exception:
                            continue

            return {'success': True, 'por_arquivo': por_arquivo, 'max': maxv}
        except Exception as e:
            return {'success': False, 'error': str(e)}
