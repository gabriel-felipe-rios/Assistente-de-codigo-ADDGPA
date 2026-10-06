import os
import re

from .constantes import *
from modulos.ignorados import esta_ignorado as _esta_ignorado
from modulos.ignorados import fora_do_programa

EXT_LANG = {
    '.py': 'Python', '.js': 'JavaScript', '.jsx': 'JavaScript',
    '.ts': 'TypeScript', '.tsx': 'TypeScript', '.mts': 'TypeScript', '.cts': 'TypeScript',
    '.cs': 'C#', '.java': 'Java', '.go': 'Go',
    '.rs': 'Rust', '.c': 'C', '.cpp': 'C++', '.cc': 'C++',
    '.h': 'C', '.hpp': 'C++',
}

_PY_IMPORT = re.compile(
    r'^(?:from\s+([\w.]+)\s+import|import\s+([\w.,\s]+))',
    re.MULTILINE
)
_JS_IMPORT = re.compile(
    r"""(?:import\s+(?:.*?\s+from\s+)?|require\s*\(\s*)['"](\.\.?/[^'"]+)['"]"""
)


# Todo token em posicao de chamada: `nome(` ou `nome (`. Compilada uma vez,
# no modulo -- era justamente a recompilacao por nome que fazia o grafo de
# chamadas levar 50 segundos.
_CHAMADAS = re.compile(r'\b([A-Za-z_]\w*)\s*\(')
_IDENTIFICADOR = re.compile(r'^[A-Za-z_]\w*$')


def _criar_esta_ignorado(ignore_list):
    # "Nunca ler" (global) soma ao `Projeto › Remover` — o Grafo de imports é
    # rotina do ciclo e não passa por `rotinas_leitura.py::_caminho_ignorado`.
    def esta_ignorado(path):
        return fora_do_programa(path) or _esta_ignorado(path, ignore_list)
    return esta_ignorado


def _id_pela_raiz(root, fpath, base_alternativa=None):
    """O id de um nó: o caminho relativo à RAIZ do projeto, com barra normal.

    Era relativo à PASTA DE TRABALHO, e isso custava duas coisas. A primeira é
    ambiguidade real: com duas pastas de trabalho que tenham `Code/` dentro, o
    id `Code/backend` passa a significar dois lugares e ninguém avisa — o
    `grafo.json` guarda só `{id, label, language, lines}`, sem a pasta de
    origem, então nem na hora de servir dá para desambiguar. A segunda é que o
    grafo e o pipeline falavam um dialeto (`Code/backend`) e o índice de
    navegação e o resumo de pastas outro (`Program/Code/backend`), para o mesmo
    lugar — e quem lê os quatro é o mesmo subagente.

    `base_alternativa` só entra quando o projeto não tem raiz configurada.
    """
    base = root or base_alternativa
    if not base:
        return os.path.normpath(fpath).replace(os.sep, '/')
    try:
        return os.path.relpath(fpath, base).replace(os.sep, '/')
    except ValueError:
        # Drives diferentes no Windows: sem relativo possível, o absoluto
        # normalizado ainda é um id estável e único.
        return os.path.normpath(fpath).replace(os.sep, '/')


class AnáliseGrafoMixin:

    # ── Grafo de dependências (imports entre arquivos) ────────────────────────
    def analyze_imports(self, project_name):
        workspace = self.load_workspace(project_name)
        if not workspace['success']:
            return {'success': False, 'error': 'Workspace não carregado.', 'nodes': [], 'edges': []}
        config = workspace['config']
        folders = config.get('working_folders', [])
        ignore_list = config.get('ignore_list', [])
        # ⚠️ `raiz_do_projeto`, e não `root`: o `os.walk` logo abaixo já usa
        # `root` para o diretório corrente, e o nome repetido fazia o id sair
        # relativo à pasta que estava sendo varrida — só o nome do arquivo.
        raiz_do_projeto = config.get('root_folder') or ''
        if not folders:
            return {'success': True, 'nodes': [], 'edges': []}

        esta_ignorado = _criar_esta_ignorado(ignore_list)
        context_descs = self._build_context_descs(config.get('context_items', []))

        # Coleta todos os arquivos do projeto: abs_path → metadados
        all_files = {}
        for folder in folders:
            for root, dirs, files in os.walk(folder):
                if esta_ignorado(root):
                    dirs.clear()
                    continue
                dirs[:] = [d for d in dirs if not esta_ignorado(os.path.join(root, d))]
                for fname in sorted(files):
                    fpath = os.path.join(root, fname)
                    ext = os.path.splitext(fname)[1].lower()
                    if ext not in EXT_LANG or esta_ignorado(fpath):
                        continue
                    if self._get_ctx_desc(fpath, context_descs) is not None:
                        continue
                    rel = _id_pela_raiz(raiz_do_projeto, fpath, folder)
                    try:
                        with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                            lines = sum(1 for _ in f)
                    except Exception:
                        lines = 0
                    all_files[fpath] = {
                        'id': rel,
                        'label': fname,
                        'language': EXT_LANG[ext],
                        'lines': lines,
                        '_folder': folder,
                    }

        edges_set = set()

        for fpath, finfo in all_files.items():
            lang = finfo['language']
            try:
                content = open(fpath, 'r', encoding='utf-8', errors='ignore').read(500 * 1024)
            except Exception:
                continue

            dir_of_file = os.path.dirname(fpath)
            folder = finfo['_folder']

            if lang == 'Python':
                for m in _PY_IMPORT.finditer(content):
                    mod = m.group(1) or m.group(2) or ''
                    for part in mod.split(','):
                        part = part.strip().lstrip('.')
                        if not part:
                            continue
                        mod_path = part.replace('.', os.sep)
                        candidates = [
                            os.path.normpath(os.path.join(dir_of_file, mod_path + '.py')),
                            os.path.normpath(os.path.join(dir_of_file, mod_path, '__init__.py')),
                            os.path.normpath(os.path.join(folder, mod_path + '.py')),
                            os.path.normpath(os.path.join(folder, mod_path, '__init__.py')),
                        ]
                        for cand in candidates:
                            if cand in all_files and cand != fpath:
                                edges_set.add((finfo['id'], all_files[cand]['id']))
                                break

            elif lang in ('JavaScript', 'TypeScript'):
                for m in _JS_IMPORT.finditer(content):
                    import_path = m.group(1)
                    base = os.path.normpath(os.path.join(dir_of_file, import_path))
                    candidates = [
                        base,
                        base + '.js', base + '.jsx', base + '.ts', base + '.tsx',
                        base + '.mts', base + '.cts',
                        os.path.join(base, 'index.js'),
                        os.path.join(base, 'index.ts'),
                    ]
                    for cand in candidates:
                        if cand in all_files and cand != fpath:
                            edges_set.add((finfo['id'], all_files[cand]['id']))
                            break

        nodes = [
            {k: v for k, v in info.items() if k != '_folder'}
            for info in all_files.values()
        ]
        edges = [{'source': s, 'target': t, 'label': 'import'} for s, t in edges_set]
        return {'success': True, 'nodes': nodes, 'edges': edges}

    def run_grafo_imports_agent(self, project_name):
        def worker():
            try:
                result = self.analyze_imports(project_name)
                if not result['success']:
                    self.window.evaluate_js(
                        f'grafoImportsAgentProgress({json.dumps({"status": "error", "error": result.get("error", "Erro ao analisar imports."), "project": project_name})})')
                    return

                out_dir = obter_pasta_da_rotina(project_name, 'grafo-imports')
                os.makedirs(out_dir, exist_ok=True)

                with open(os.path.join(out_dir, 'grafo.json'), 'w', encoding='utf-8') as f:
                    json.dump(result, f, ensure_ascii=False, indent=2)

                summary = {
                    'finished_at': datetime.now().isoformat(),
                    'total_files': len(result['nodes']),
                    'total_edges': len(result['edges']),
                }
                with open(os.path.join(out_dir, '_resumo.json'), 'w', encoding='utf-8') as f:
                    json.dump(summary, f, ensure_ascii=False, indent=2)

                self.window.evaluate_js(
                    f'grafoImportsAgentProgress({json.dumps({"status": "done", "total_files": len(result["nodes"]), "total_edges": len(result["edges"]), "project": project_name})})')
            except Exception as e:
                self.window.evaluate_js(
                    f'grafoImportsAgentProgress({json.dumps({"status": "error", "error": str(e), "project": project_name})})')

        # A referência da thread fica registrada: é o que deixa o ciclo
        # saber que esta rotina continua viva (ver processando.py).
        self._proc_iniciar(project_name, 'grafo-imports', worker)
        return {'success': True}

    def get_grafo_imports_status(self, project_name):
        path = obter_pasta_da_rotina(project_name, 'grafo-imports', 'grafo.json')
        if not os.path.isfile(path):
            return {'success': True, 'exists': False}
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return {
                'success': True, 'exists': True,
                'total_files': len(data.get('nodes', [])),
                'total_edges': len(data.get('edges', [])),
            }
        except Exception:
            return {'success': True, 'exists': False}

    # ── Call graph (chamadas entre funções) ───────────────────────────────────
    def build_call_graph(self, project_name, indice=None, fontes=None):
        """O grafo de chamadas do projeto — ou o de uma Versão antiga.

        Sem parâmetro nenhum, é o de sempre: lê o Índice de Símbolos do disco e
        varre as pastas de trabalho de agora.

        Com `indice` e `fontes`, calcula sobre OUTRO momento — é o que o Mapa
        da mudança precisa para desenhar o Pipeline dos dois lados. `indice` é
        o `Índice de Símbolos.json` guardado naquela Versão; `fontes` é um
        iterável de `(caminho relativo, texto do arquivo)` com o código daquela
        Versão, que vem de `arquivos/` e não do disco — o disco já não tem esse
        código. Nada aqui chama o modelo, nos dois modos.
        """
        construido = None
        if indice is not None:
            index = indice
        else:
            # Tenta usar índice existente; constrói se não houver.
            #
            # `build_symbol_index` devolve só o resumo (`success`,
            # `total_files`, `total_symbols`) — ler o índice é outra chamada.
            # Ler o resumo no lugar dele fazia todo projeto novo falhar na
            # primeira vez com "Indexe o projeto primeiro", logo depois de
            # indexar.
            idx = self.get_symbol_index(project_name)
            if not idx['success'] or not idx.get('index'):
                construido = self.build_symbol_index(project_name)
                if construido.get('success'):
                    idx = self.get_symbol_index(project_name)
            index = idx.get('index') if idx.get('success') else None
            # Construiu sem erro e não gravou nada: não havia arquivo nenhum
            # para indexar — é o caso do "nenhum símbolo", logo abaixo.
            if index is None and (construido or {}).get('success'):
                index = {}
        if not isinstance(index, dict):
            return {
                'success': False,
                'error': 'Não foi possível montar o Índice de Símbolos: '
                         + ((construido or {}).get('error') or 'motivo desconhecido'),
                'nodes': [], 'edges': [],
            }
        symbols = index.get('symbols')
        if not symbols:
            return {
                'success': False,
                'error': 'O Índice de Símbolos não achou nenhum símbolo nas pastas de '
                         'trabalho — elas estão vazias, ou a linguagem deste projeto não '
                         'tem gramática no programa.',
                'nodes': [], 'edges': [],
            }

        # ⚠️ A ÂNCORA DOS IDS é escolhida UMA VEZ por chamada e vale para as
        # DUAS pontas — a semeadura pelo Índice de Símbolos e a varredura das
        # pastas. As duas parecem simétricas e não são: a semeadura COPIAVA o
        # campo `relative` do Índice (ancorado na pasta de trabalho) enquanto a
        # varredura CALCULAVA o dela. Misturar as duas faz o MESMO arquivo virar
        # dois nós, com as arestas apontando para o errado.
        #
        # Modo Versão (`fontes`): a âncora continua sendo a pasta de trabalho.
        # Ali o código vem do armazenamento por conteúdo e NÃO existe caminho
        # absoluto — `_bp_fontes` monta os caminhos de propósito para casarem
        # com o `relative` do Índice guardado naquela Versão. É um sistema
        # fechado e coerente, e esse grafo não vira artefato: vai direto para o
        # esqueleto do Mapa da mudança, nunca para o `ler_grafo_imports`.
        #
        # ⚠️ O Índice de Símbolos NÃO é tocado: o `relative` dele continua como
        # está, com os 9 consumidores que tem. Aqui ele deixa de ser a FONTE do
        # id, que passa a sair do `sym['file']` — o mesmo absoluto que o campo
        # `'abs'` do nó já usa.
        config_ao_vivo = None
        if fontes is None:
            config_ao_vivo = self.load_workspace(project_name)['config']
        root_do_projeto = (config_ao_vivo or {}).get('root_folder') or None

        def _id_do_no(fpath, relative_do_indice=None):
            if root_do_projeto and fpath:
                return _id_pela_raiz(root_do_projeto, fpath)
            if relative_do_indice:
                return relative_do_indice.replace('\\', '/')
            return os.path.basename(fpath or '').replace('\\', '/')

        # Mapeia nome de função/método → arquivo relativo
        func_to_rel = {}
        file_nodes = {}
        for sym in symbols:
            if sym['type'] not in ('function', 'method'):
                continue
            rel = _id_do_no(sym.get('file'), sym.get('relative'))
            func_to_rel[sym['name']] = rel
            if rel not in file_nodes:
                file_nodes[rel] = {
                    'id': rel,
                    # O caminho absoluto sai de graca daqui. Sem ele, quem precisa
                    # LER o arquivo (o rastro do agente Pipeline) era obrigado a
                    # varrer as pastas de novo so para reencontrar o mesmo arquivo.
                    'abs': sym['file'],
                    'label': os.path.basename(sym['file']),
                    'language': sym.get('language', ''),
                    'lines': 0,
                }

        if not func_to_rel:
            return {'success': True, 'nodes': [], 'edges': []}

        # Particiona os nomes uma vez: os identificadores comuns saem do
        # tokenizador; o resto (raro) continua pelo caminho antigo.
        simples = {n for n in func_to_rel if _IDENTIFICADOR.match(n)}
        exoticos = [n for n in func_to_rel if n not in simples]

        edges_set = set()

        def garante_no(rel, fname, ext, fpath):
            if rel not in file_nodes:
                file_nodes[rel] = {
                    'id': rel, 'abs': fpath, 'label': fname,
                    'language': EXT_LANG.get(ext, ''), 'lines': 0,
                }

        def processar(source_rel, fname, ext, fpath, content):
                    # Uma passada de regex por arquivo, em vez de uma por funcao.
                    # Antes era `re.search(r'\b' + nome + r'\s*\(')` dentro de um
                    # laco sobre TODAS as funcoes conhecidas: O(arquivos x funcoes),
                    # medido em 50,1s neste projeto (219 arquivos x 1124 nomes =
                    # 246 mil buscas). Pior: 1124 padroes distintos estouram o
                    # `_MAXCACHE` do modulo `re` (512), que e esvaziado inteiro ao
                    # encher -- entao quase toda busca recompilava o padrao.
                    #
                    # Extrair todos os tokens em posicao de chamada de uma vez e
                    # cruzar com os nomes conhecidos da exatamente o mesmo conjunto
                    # de arestas (conferido: 937 = 937), em 0,07s.
                    chamados = set(_CHAMADAS.findall(content))
                    for func_name in chamados & simples:
                        target_rel = func_to_rel[func_name]
                        if target_rel == source_rel:
                            continue
                        edges_set.add((source_rel, target_rel, func_name))
                        garante_no(source_rel, fname, ext, fpath)

                    # Nome que nao e identificador comum (o indice as vezes traz
                    # `Classe.metodo`) nao sai do tokenizador: esses poucos
                    # continuam pelo caminho antigo.
                    for func_name in exoticos:
                        target_rel = func_to_rel[func_name]
                        if target_rel == source_rel:
                            continue
                        if re.search(r'\b' + re.escape(func_name) + r'\s*\(', content):
                            edges_set.add((source_rel, target_rel, func_name))
                            garante_no(source_rel, fname, ext, fpath)

        if fontes is not None:
            # Modo Versao: o codigo daquele momento vem do armazenamento por
            # conteudo, nao do disco -- o disco ja nao tem esse codigo.
            for source_rel, content in fontes:
                fname = source_rel.rsplit('/', 1)[-1]
                ext = os.path.splitext(fname)[1].lower()
                if ext not in EXT_LANG:
                    continue
                processar(source_rel, fname, ext, '', content)
        else:
            config = config_ao_vivo
            esta_ignorado = _criar_esta_ignorado(config.get('ignore_list', []))
            for folder in config.get('working_folders', []):
                for root, dirs, files in os.walk(folder):
                    if esta_ignorado(root):
                        dirs.clear()
                        continue
                    dirs[:] = [d for d in dirs
                               if not esta_ignorado(os.path.join(root, d))]
                    for fname in sorted(files):
                        fpath = os.path.join(root, fname)
                        ext = os.path.splitext(fname)[1].lower()
                        if (ext not in EXT_LANG or esta_ignorado(fpath)
                                or os.path.getsize(fpath) > 500 * 1024):
                            continue
                        source_rel = _id_do_no(fpath)
                        try:
                            content = open(fpath, 'r', encoding='utf-8',
                                           errors='ignore').read()
                        except Exception:
                            continue
                        processar(source_rel, fname, ext, fpath, content)

        nodes = list(file_nodes.values())
        edges = [{'source': s, 'target': t, 'label': fn} for s, t, fn in edges_set]
        return {'success': True, 'nodes': nodes, 'edges': edges}

    # ── Métricas hierárquicas (treemap + sunburst) ────────────────────────────
    def get_file_tree_metrics(self, project_name):
        workspace = self.load_workspace(project_name)
        if not workspace['success']:
            return {'success': False, 'error': 'Workspace não carregado.', 'root': None}
        config = workspace['config']
        folders = config.get('working_folders', [])
        ignore_list = config.get('ignore_list', [])
        if not folders:
            return {'success': True, 'root': None}

        esta_ignorado = _criar_esta_ignorado(ignore_list)

        # ⚠️ REVOGAÇÃO — 21/08/2026. Aqui estava escrito que não havia mais
        # tela para escolher um subconjunto e que os mapas contavam TODAS as
        # linguagens, sempre. Não vale mais, e o aviso antigo não deve voltar:
        # a escolha existe de novo, na aba Configurações → "Extensões e pastas
        # ignoradas", e desta vez o código a lê de verdade (era não ser lida
        # que condenou a tela anterior).
        #
        # O medo do aviso antigo — um mapa que esconde parte do projeto —
        # continua de pé, e a resposta a ele é o padrão de fábrica: tudo
        # marcado. Quem não configurar nada vê o mesmo mapa de sempre.
        # O mapa sai de TODA a lista de código, e não só do `LANG_MAP`: sem isso
        # uma linguagem acrescentada em O que é código ("Astro") somaria linha
        # no Resumo e ficaria fora do mapa. Sem nome conhecido, a extensão.
        from modulos.linguagens import nome_da_linguagem
        from modulos.configuracoes import lista_de_codigo
        ext_lang = {e: (nome_da_linguagem(e) or e.lstrip('.').upper())
                    for e in lista_de_codigo()}

        def build_node(path):
            name = os.path.basename(path) or path
            if os.path.isdir(path):
                children = []
                try:
                    entries = sorted(os.listdir(path), key=str.lower)
                except Exception:
                    entries = []
                for entry in entries:
                    child_path = os.path.join(path, entry)
                    if esta_ignorado(child_path):
                        continue
                    # O nível global: `node_modules` some do mapa em todos os
                    # projetos, sem o usuário ter de removê-lo em cada um.
                    if fora_do_programa(child_path):
                        continue
                    child = build_node(child_path)
                    if child:
                        children.append(child)
                if not children:
                    return None
                total_lines = sum(c['lines'] for c in children)
                total_size = sum(c['size'] for c in children)
                return {
                    'name': name,
                    'path': path,
                    'type': 'folder',
                    'lines': total_lines,
                    'size': total_size,
                    'children': children,
                }
            else:
                ext = os.path.splitext(name)[1].lower()
                if ext not in ext_lang:
                    return None
                try:
                    size = os.path.getsize(path)
                    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                        lines = sum(1 for _ in f)
                except Exception:
                    size = 0
                    lines = 0
                if lines == 0:
                    return None
                return {
                    'name': name,
                    'path': path,
                    'type': 'file',
                    'lines': lines,
                    'size': size,
                    'language': ext_lang[ext],
                }

        if len(folders) == 1:
            root = build_node(folders[0])
            if not root:
                root = {'name': os.path.basename(folders[0]), 'path': folders[0],
                        'type': 'folder', 'lines': 0, 'size': 0, 'children': []}
        else:
            children = []
            for folder in folders:
                if not esta_ignorado(folder):
                    node = build_node(folder)
                    if node:
                        children.append(node)
            root = {
                'name': project_name,
                'path': '',
                'type': 'folder',
                'lines': sum(c['lines'] for c in children),
                'size': sum(c['size'] for c in children),
                'children': children,
            }

        return {'success': True, 'root': root}
