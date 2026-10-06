from .constantes import *
from modulos.ignorados import esta_ignorado as _esta_ignorado
from modulos.treesitter import EXT_LANG, make_parser, tree_sitter_instalado
from modulos.analise_io import extrair_por_arvore, extrair_por_regex


class AnaliseMixin:

    # ── Tree-sitter: análise semântica ────────────────────────────────────────
    def parse_treesitter(self, project_name):
        if not tree_sitter_instalado():
            return {'success': False, 'error': 'tree-sitter não instalado.', 'files': []}

        workspace = self.load_workspace(project_name)
        if not workspace['success']:
            return {'success': False, 'error': 'Workspace não carregado.', 'files': []}
        config = workspace['config']
        folders = config.get('working_folders', [])
        ignore_list = config.get('ignore_list', [])
        if not folders:
            return {'success': True, 'files': []}

        def esta_ignorado(path):
            return _esta_ignorado(path, ignore_list)

        # `EXT_LANG` e `make_parser` moram em `modulos/treesitter.py`: a rotina
        # Comentários precisa dos mesmos dois, e duas cópias divergem no primeiro
        # dia em que alguém acrescentar uma linguagem só de um lado.

        TYPE_MAP = {
            'Python':     {'class_definition': 'class', 'function_definition': 'function'},
            'JavaScript': {'class_declaration': 'class', 'function_declaration': 'function', 'method_definition': 'method'},
            'TypeScript': {'class_declaration': 'class', 'function_declaration': 'function', 'method_definition': 'method'},
            'C#':         {'class_declaration': 'class', 'method_declaration': 'method', 'interface_declaration': 'interface'},
            'Java':       {'class_declaration': 'class', 'method_declaration': 'method', 'interface_declaration': 'interface'},
            'Go':         {'function_declaration': 'function', 'method_declaration': 'method', 'type_spec': 'type'},
            'Rust':       {'struct_item': 'struct', 'function_item': 'function', 'impl_item': 'impl', 'enum_item': 'enum'},
            'C':          {'function_definition': 'function', 'struct_specifier': 'struct'},
            'C++':        {'class_specifier': 'class', 'function_definition': 'function', 'struct_specifier': 'struct'},
        }

        NAME_TYPES = {'identifier', 'type_identifier', 'name', 'field_identifier'}

        def extract_symbols(root, lang_name):
            wanted = TYPE_MAP.get(lang_name, {})
            symbols = []
            def walk(node):
                if node.type in wanted:
                    for child in node.children:
                        if child.type in NAME_TYPES:
                            try:
                                name = child.text.decode('utf-8', errors='replace')
                                symbols.append({'type': wanted[node.type], 'name': name, 'line': node.start_point[0] + 1})
                            except Exception:
                                pass
                            break
                for child in node.children:
                    walk(child)
            walk(root)
            return symbols

        parser_cache = {}
        result_files = []
        MAX_SIZE = 500 * 1024
        context_descs = self._build_context_descs(config.get('context_items', []))

        for folder in folders:
            if not os.path.isdir(folder): continue
            for root, dirs, files in os.walk(folder):
                if esta_ignorado(root): dirs.clear(); continue
                dirs[:] = [d for d in dirs if not esta_ignorado(os.path.join(root, d))]
                for fname in sorted(files):
                    fpath = os.path.join(root, fname)
                    if esta_ignorado(fpath): continue
                    if self._get_ctx_desc(fpath, context_descs) is not None: continue
                    ext = os.path.splitext(fname)[1].lower()
                    lang = EXT_LANG.get(ext)
                    if not lang: continue
                    try:
                        if os.path.getsize(fpath) > MAX_SIZE: continue
                    except OSError:
                        continue
                    if lang not in parser_cache:
                        parser_cache[lang] = make_parser(lang)
                    parser = parser_cache.get(lang)
                    if not parser: continue
                    try:
                        with open(fpath, 'rb') as f:
                            content = f.read()
                        tree = parser.parse(content)
                        symbols = extract_symbols(tree.root_node, lang)
                        result_files.append({
                            'path': fpath,
                            'relative': os.path.relpath(fpath, folder),
                            'folder': folder,
                            'language': lang,
                            'symbols': symbols,
                        })
                    except Exception:
                        pass

        return {'success': True, 'files': result_files}

    # ── Busca literal no conteúdo dos arquivos do projeto ─────────────────────
    # Serve a barra de busca das três telas de árvore da aba Análise (Mapa de
    # I/O, Relações, Tree-sitter) no modo "Por conteúdo". Devolve só CAMINHOS:
    # quem filtra a árvore é o frontend, que já tem os caminhos desenhados.
    #
    # Os caminhos saem no mesmo formato que as três telas usam como chave —
    # `<último segmento da pasta de trabalho>/<caminho relativo>` (ver
    # `_mioChave` em mapaio.js). Devolver mais do que a árvore mostra é
    # inofensivo: caminho que não existe na árvore não casa com linha nenhuma.
    #
    # ⚠️ NÃO há lista de extensões aqui, e isso é deliberado. O projeto já tem
    # três listas que se parecem e não podem ser unificadas (`CODE_EXTS` em
    # `scan_file_io`, `TEXT_EXTS` em `indexacao.py`, `_COB_EXT_GRAFO` em
    # `cobertura.py`), cada uma respondendo a uma pergunta diferente. A pergunta
    # daqui é a mais simples de todas — "dá para ler isto como texto?" — e ela
    # se responde OLHANDO o arquivo: um byte 0x00 nos primeiros 4 KB significa
    # binário. Uma quarta lista para manter seria só mais uma para esquecer de
    # atualizar.
    def search_code_content(self, project_name, query, max_results=1000):
        """Caminhos dos arquivos de trabalho que contêm `query` (busca literal)."""
        try:
            termo = (query or '').strip()
            if not termo:
                return {'success': True, 'paths': [], 'truncated': False}

            workspace = self.load_workspace(project_name)
            if not workspace['success']:
                return {'success': False, 'error': 'Workspace não carregado.', 'paths': []}
            config = workspace['config']
            folders = config.get('working_folders', [])
            ignore_list = config.get('ignore_list', [])
            if not folders:
                return {'success': True, 'paths': [], 'truncated': False}

            alvo = termo.lower()
            MAX_SIZE = 2 * 1024 * 1024
            paths = []
            truncated = False

            for folder in folders:
                if not os.path.isdir(folder):
                    continue
                raiz = os.path.basename(os.path.normpath(folder))
                for root, dirs, files in os.walk(folder):
                    if _esta_ignorado(root, ignore_list):
                        dirs.clear()
                        continue
                    dirs[:] = [d for d in dirs
                               if not _esta_ignorado(os.path.join(root, d), ignore_list)]
                    for fname in sorted(files):
                        if len(paths) >= max_results:
                            truncated = True
                            break
                        fpath = os.path.join(root, fname)
                        if _esta_ignorado(fpath, ignore_list):
                            continue
                        try:
                            if os.path.getsize(fpath) > MAX_SIZE:
                                continue
                            with open(fpath, 'rb') as f:
                                cabeca = f.read(4096)
                                if 0 in cabeca:   # um byte 0x00 nos primeiros 4 KB = binario
                                    continue
                                conteudo = cabeca + f.read()
                        except Exception:
                            continue
                        texto = conteudo.decode('utf-8', errors='replace')
                        if alvo not in texto.lower():
                            continue
                        rel = os.path.relpath(fpath, folder).replace(os.sep, '/')
                        paths.append(f'{raiz}/{rel}' if raiz else rel)
                    if truncated:
                        break
                if truncated:
                    break

            return {'success': True, 'paths': paths, 'truncated': truncated}
        except Exception as e:
            return {'success': False, 'error': str(e), 'paths': []}

    def get_file_lines(self, path, line, context=5):
        try:
            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                all_lines = f.readlines()
            start = max(0, line - 1 - context)
            end   = min(len(all_lines), line + context)
            return {
                'success': True,
                'lines': [
                    {'n': i + 1, 'text': all_lines[i].rstrip('\n\r'), 'highlight': i + 1 == line}
                    for i in range(start, end)
                ],
                'total': len(all_lines),
            }
        except Exception as e:
            return {'success': False, 'error': str(e), 'lines': []}

    def scan_file_io(self, project_name):
        """As operações de disco de cada arquivo do projeto — o Mapa de I/O.

        Este método é só a VARREDURA: decide quais arquivos entram e qual motor
        lê cada um. Quem olha dentro do arquivo é `modulos/analise_io.py`.

        ⚠️ Duas coisas aqui NÃO são detalhe de implementação — são contrato com
        o usuário, e quebrá-las é regressão silenciosa (nenhum teste cobre):

        1. A varredura parte de `working_folders` e SÓ dela. Nada fora da pasta
           de trabalho entra — nem a raiz do projeto, nem o arquivo principal.
           É por isso que a pasta de trabalho existe.
        2. A lista Remover (`ignore_list`) é respeitada em três pontos: a pasta,
           as subpastas e o arquivo.

        E uma que NÃO existe de propósito: "Contexto sem leitura"
        (`context_items`) não filtra nada aqui. Aquilo diz o que a IA não deve
        ler; o Mapa de I/O é análise do código, não leitura para o modelo.
        `parse_treesitter`, logo acima neste arquivo, TEM esse filtro — não
        copie de lá sem perceber a diferença.
        """
        workspace = self.load_workspace(project_name)
        if not workspace['success']:
            return {'success': False, 'error': 'Workspace não carregado.', 'files': []}
        config = workspace['config']
        folders = config.get('working_folders', [])
        ignore_list = config.get('ignore_list', [])
        if not folders:
            return {'success': True, 'files': [], 'total_files': 0, 'files_with_io': 0}

        def esta_ignorado(path):
            return _esta_ignorado(path, ignore_list)

        # "Isto conta como arquivo de código?" — a pergunta da ESTATÍSTICA.
        # Inclui .rb/.php/.swift porque Ruby, PHP e Swift são código mesmo que
        # o Grafo de Imports não saiba parseá-los; exclui .html/.css porque a
        # fronteira aqui é código × marcação, não texto × binário.
        # ⚠️ NÃO UNIFICAR com `_COB_EXT_GRAFO` (cobertura.py) nem com
        # `TEXT_EXTS` (indexacao.py): a diferença é deliberada. O quadro
        # completo está no comentário de `cobertura.py::_COB_EXT_GRAFO`.
        #
        # ⚠️ E NÃO TROCAR por `EXT_LANG`: são coisas diferentes de propósito.
        # `CODE_EXTS` decide o que ENTRA na varredura; `EXT_LANG` decide COMO o
        # que entrou é lido. `EXT_LANG` tem `.html` e `.css`, que não são código
        # para esta tela; `CODE_EXTS` tem `.rb`/`.php`/`.swift`, que não têm
        # gramática instalada e caem no motor de regex.
        CODE_EXTS = {
            '.py','.pyw','.js','.jsx','.ts','.tsx','.mts','.cts','.cs','.java','.go',
            '.rs','.c','.cpp','.cc','.h','.hpp','.rb','.php','.swift',
        }
        EXT_SKIP = {'.pyc', '.pyo', '.min.js', '.map'}

        parser_cache = {}
        result_files = []
        total_files = 0
        MAX_SIZE = 500 * 1024

        for folder in folders:
            if not os.path.isdir(folder): continue
            for root, dirs, files in os.walk(folder):
                if esta_ignorado(root): dirs.clear(); continue
                dirs[:] = [d for d in dirs if not esta_ignorado(os.path.join(root, d))]
                for fname in sorted(files):
                    fpath = os.path.join(root, fname)
                    if esta_ignorado(fpath): continue
                    ext = os.path.splitext(fname)[1].lower()
                    if ext not in CODE_EXTS or ext in EXT_SKIP: continue
                    try:
                        if os.path.getsize(fpath) > MAX_SIZE: continue
                    except OSError:
                        continue
                    total_files += 1
                    try:
                        with open(fpath, 'rb') as f:
                            bruto = f.read()
                    except Exception:
                        continue

                    # Motor principal: a gramática da linguagem. Cai no regex
                    # quando não há gramática (.rb/.php/.swift), quando o
                    # binding não está instalado nesta máquina, ou quando a
                    # árvore não montou — nunca some com o arquivo.
                    #
                    # ⚠️ `None` é "não consegui ler"; lista vazia é "li e não há
                    # I/O aqui". Só o `None` cai no regex. Tratar os dois igual
                    # faz todo arquivo sem I/O ser reescaneado pelo motor antigo,
                    # que inventa operações a partir de `open(` escrito dentro
                    # de comentário ou docstring.
                    lang = EXT_LANG.get(ext)
                    entries = None
                    if lang:
                        if lang not in parser_cache:
                            parser_cache[lang] = make_parser(lang)
                        parser = parser_cache.get(lang)
                        if parser is not None:
                            entries = extrair_por_arvore(bruto, parser, lang)
                    if entries is None:
                        texto = bruto.decode('utf-8', errors='replace')
                        entries = extrair_por_regex(texto.splitlines())

                    if entries:
                        result_files.append({
                            'path':     fpath,
                            'relative': os.path.relpath(fpath, folder),
                            'folder':   folder,
                            'io_count': len(entries),
                            'entries':  entries,
                        })

        result_files.sort(key=lambda f: f['path'])
        return {
            'success':        True,
            'files':          result_files,
            'total_files':    total_files,
            'files_with_io':  len(result_files),
        }

    def run_diagnostics(self, project_name):
        workspace = self.load_workspace(project_name)
        if not workspace['success']:
            return {'success': False, 'error': 'Workspace não carregado.', 'diagnostics': []}
        config      = workspace['config']
        folders     = config.get('working_folders', [])
        ignore_list = config.get('ignore_list', [])
        if not folders:
            return {'success': True, 'diagnostics': [], 'tool': None}

        def esta_ignorado(path):
            return _esta_ignorado(path, ignore_list)

        py_files = []
        for folder in folders:
            if not os.path.isdir(folder): continue
            for root, dirs, files in os.walk(folder):
                if esta_ignorado(root): dirs.clear(); continue
                dirs[:] = [d for d in dirs if not esta_ignorado(os.path.join(root, d))]
                for fname in sorted(files):
                    fpath = os.path.join(root, fname)
                    if not esta_ignorado(fpath) and fname.endswith('.py'):
                        py_files.append(fpath)

        diagnostics = []
        tool = None

        if py_files:
            try:
                import ast as _ast
                from pyflakes import checker as _checker, messages as _messages
                _ERROR_TYPES = {
                    _messages.UndefinedName, _messages.UndefinedLocal,
                    _messages.ImportShadowedByLoopVar, _messages.LateFutureImport,
                }
                for fpath in py_files:
                    try:
                        with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
                            source = f.read()
                        tree = compile(source, fpath, 'exec', _ast.PyCF_ONLY_AST)
                        w = _checker.Checker(tree, fpath)
                        for msg in w.messages:
                            sev = 'error' if type(msg) in _ERROR_TYPES else 'warning'
                            diagnostics.append({
                                'severity': sev,
                                'message':  msg.message % msg.message_args,
                                'file':     fpath,
                                'line':     msg.lineno,
                                'col':      getattr(msg, 'col', 0) or 0,
                            })
                    except SyntaxError as e:
                        diagnostics.append({
                            'severity': 'error',
                            'message':  f'Erro de sintaxe: {e.msg}',
                            'file':     fpath,
                            'line':     e.lineno or 1,
                            'col':      e.offset or 0,
                        })
                    except Exception:
                        pass
                tool = 'pyflakes'
            except ImportError:
                for fpath in py_files:
                    try:
                        with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
                            source = f.read()
                        compile(source, fpath, 'exec')
                    except SyntaxError as e:
                        diagnostics.append({
                            'severity': 'error',
                            'message':  f'Erro de sintaxe: {e.msg}',
                            'file':     fpath,
                            'line':     e.lineno or 1,
                            'col':      e.offset or 0,
                        })
                tool = 'python-syntax'

        sev_order = {'error': 0, 'warning': 1, 'info': 2}
        diagnostics.sort(key=lambda d: (sev_order.get(d['severity'], 9), d['file'], d['line']))
        return {'success': True, 'diagnostics': diagnostics, 'tool': tool}
