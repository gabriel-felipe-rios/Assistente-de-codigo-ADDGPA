from .constantes import *
from modulos.ignorados import esta_ignorado as _esta_ignorado
from modulos.ignorados import fora_do_programa as _fora_do_programa


class IndexacaoMixin:

    # ── Bibliotecas de terceiros / minificadas ─────────────────────────────────
    # Arquivos como `cytoscape.min.js`, `d3.min.js`, `marked.min.js` não são
    # código do usuário: são bundles minificados, com centenas de símbolos de
    # 1–2 caracteres ("a", "$d", "_i"). Indexá-los polui o índice (viram ruído
    # na aba Análise) e, principalmente, quebra a busca de candidatos do
    # Inspetor — um símbolo chamado "a" "casa" com qualquer termo que contenha
    # a letra "a". Regra por nome (`*.min.js` / `*.min.css`), que é a convenção
    # universal pra artefatos minificados, sem depender de heurística frágil.
    def _e_arquivo_minificado(self, fname):
        nome = fname.lower()
        return nome.endswith('.min.js') or nome.endswith('.min.css')

    # ── Indexação do workspace ─────────────────────────────────────────────────

    # Teto por arquivo na contagem de linhas. Sem ele o "Resumo completo" abre
    # bundles de `node_modules` e dumps de dados inteiros só para contar `\n` —
    # e a varredura passa de segundos para minutos. 2 MB de texto já é muito mais
    # do que qualquer arquivo de código que valha a pena contar.
    _RESUMO_MAX_BYTES_LINHAS = 2 * 1024 * 1024

    def _resumo_vazio(self):
        return {'folders': 0, 'files': 0, 'lines': 0, 'languages': [],
                'extensions': [], 'paths': [], 'dirs': []}

    # Uma varredura, dois resultados — é o que alimenta as sub-abas
    # "Resumo indexado" e "Resumo completo" da aba Projeto:
    #
    #   completo → tudo que está dentro das pastas de trabalho;
    #   indexado → o completo menos Remover (`ignore_list`) e menos
    #              Contexto sem leitura (`context_items`).
    #
    # ⚠️ Sem poda de `dirs[:]` pela `ignore_list`: o walk precisa descer em tudo
    # para o conjunto completo existir. A exclusão do indexado é um teste por
    # caminho, não uma poda — podar ali faria o completo virar cópia do indexado.
    #
    # A ÚNICA poda que existe é a das pastas globalmente ignoradas
    # (`fora_do_programa`), e ela é legítima justamente por não pertencer a
    # nenhuma das duas variantes: `node_modules` não sai do "completo" porque
    # foi removido do projeto, e sim porque não é projeto.
    def scan_workspace(self, project_name):
        workspace = self.load_workspace(project_name)
        if not workspace['success']:
            return {'success': False, 'indexado': self._resumo_vazio(),
                    'completo': self._resumo_vazio()}
        config = workspace['config']
        folders = config.get('working_folders', [])
        ignore_list = config.get('ignore_list', [])
        context_items = config.get('context_items', [])
        if not folders:
            return {'success': True, 'indexado': self._resumo_vazio(),
                    'completo': self._resumo_vazio()}

        from modulos.ignorados import (esta_ignorado, esta_em_contexto,
                                       fora_do_programa)

        def fora_do_indexado(path):
            return (esta_ignorado(path, ignore_list)
                    or esta_em_contexto(path, context_items))

        # ⚠️ Os dois "fora" são de níveis diferentes e não se substituem:
        #   fora_do_indexado → deste projeto, pela tela Projeto. Só tira do
        #                      "Resumo indexado"; o "completo" continua vendo.
        #   fora_do_programa → de todos os projetos, pela aba Configurações.
        #                      Tira dos DOIS: é "como se não existisse".
        #
        # A seleção efetiva substituiu `todas_extensoes()`: desde 21/08/2026 o
        # usuário pode escolher o subconjunto, e o padrão de fábrica é todas —
        # quem não configurar nada vê exatamente o mesmo número de antes.
        # `nome_da_linguagem`, e não `LANG_MAP.get`: uma linguagem acrescentada
        # em O que é código ("Astro") tem de virar pílula aqui também.
        from modulos.linguagens import nome_da_linguagem, e_linguagem, conta_como_codigo

        # Cada variante acumula no mesmo formato; `fechar` transforma no dict
        # que o frontend recebe.
        #   dirs → caminhos de TODAS as pastas, inclusive as que não têm arquivo
        #          nenhum dentro. É o que faz a pasta vazia contar e aparecer na
        #          árvore: montada só a partir de `paths`, ela nunca existiria.
        #   exts → contagem por extensão, para o painel "Extensões". Sai da mesma
        #          varredura porque somar num dict aqui não custa I/O nenhum — o
        #          painel é sob demanda por ser lista longa demais para a faixa,
        #          não por ser caro de calcular.
        def _novo():
            return {'files': 0, 'lines': 0, 'langs': {}, 'exts': {},
                    'paths': [], 'dirs': []}
        acc = {'indexado': _novo(), 'completo': _novo()}

        def contar_linhas(fpath):
            try:
                if os.path.getsize(fpath) > self._RESUMO_MAX_BYTES_LINHAS:
                    return 0
                with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                    return sum(1 for _ in f)
            except Exception:
                return 0

        for folder in folders:
            if not os.path.isdir(folder):
                continue
            # A raiz do caminho relativo é o último segmento da pasta de
            # trabalho configurada — a convenção que o componente de árvore
            # (arvore-pastas.js) espera quando há mais de uma pasta.
            base = os.path.basename(folder.rstrip(os.sep)) or folder
            for root, dirs, files in os.walk(folder):
                # As pastas são registradas a partir de `dirs`, e não de `root`,
                # de propósito: assim a pasta que não tem nada dentro também
                # entra — `os.walk` visita a pasta vazia como `root`, mas sem
                # este laço ela só apareceria se tivesse arquivo ou subpasta.
                # Aqui a poda É legítima, ao contrário do aviso lá em cima:
                # o que cai em `fora_do_programa` não pertence a nenhuma das
                # duas variantes, então descer nele seria só custo de I/O.
                dirs[:] = [d for d in dirs
                           if not fora_do_programa(os.path.join(root, d))]

                for dname in dirs:
                    dpath = os.path.join(root, dname)
                    drel = os.path.relpath(dpath, folder).replace('\\', '/')
                    drel = f'{base}/{drel}'
                    acc['completo']['dirs'].append(drel)
                    if not fora_do_indexado(dpath):
                        acc['indexado']['dirs'].append(drel)

                for fname in files:
                    fpath = os.path.join(root, fname)
                    # Fora do programa é fora de tudo: nem `paths`, nem `exts`,
                    # nem a contagem de arquivos. Por isso o `continue` vem
                    # antes de qualquer acumulação, e não dentro do laço de
                    # `alvos` — ali ele só tiraria do indexado.
                    if fora_do_programa(fpath):
                        continue
                    rel = os.path.relpath(fpath, folder).replace('\\', '/')
                    rel = f'{base}/{rel}'
                    ext = os.path.splitext(fname)[1].lower()
                    lang = nome_da_linguagem(ext)
                    linhas = contar_linhas(fpath) if conta_como_codigo(ext) else 0

                    alvos = ['completo']
                    if not fora_do_indexado(fpath):
                        alvos.append('indexado')
                    for alvo in alvos:
                        a = acc[alvo]
                        # ⚠️ SEM filtro de extensão, e é decisão do usuário:
                        # um `.png` que sobreviveu às listas de ignorados CONTA
                        # como arquivo. Só as LINHAS dependem da seleção — o
                        # número "Arquivos" responde "quantos arquivos há", não
                        # "quanto disto é código".
                        a['files'] += 1
                        a['lines'] += linhas
                        a['paths'].append(rel)
                        # Arquivo sem extensão (`Makefile`, `.gitkeep`) entra no
                        # painel de extensões como "(sem extensão)", em vez de
                        # sumir da conta — o painel promete "todas".
                        chave_ext = ext or '(sem extensão)'
                        a['exts'][chave_ext] = a['exts'].get(chave_ext, 0) + 1
                        # As pílulas da faixa mostram só LINGUAGEM. Dado e texto
                        # (`.json`, `.md`, `.txt`, `.xml`, `.yml`, `.toml`,
                        # `.ini`) ficam de fora — quem quiser vê-los abre o
                        # painel de extensões, que não filtra nada.
                        if lang and e_linguagem(ext):
                            a['langs'][lang] = a['langs'].get(lang, 0) + 1

        def fechar(a):
            return {
                # A pasta de trabalho em si não entra na conta: ela não é uma
                # pasta "dentro do projeto", é o continente dele.
                'folders': len(a['dirs']),
                'files': a['files'],
                'lines': a['lines'],
                'languages': sorted(a['langs'].items(), key=lambda x: -x[1])[:5],
                'extensions': sorted(a['exts'].items(), key=lambda x: (-x[1], x[0])),
                'paths': a['paths'],
                'dirs': a['dirs'],
            }

        return {'success': True,
                'indexado': fechar(acc['indexado']),
                'completo': fechar(acc['completo'])}

    # ── Índice de Símbolos ────────────────────────────────────────────────────
    # Quais arquivos entram no índice, e com que linguagem.
    # CSS e HTML têm símbolo como qualquer outra linguagem — só muda o que
    # conta como símbolo (seletor e elemento identificável). Sem eles, metade
    # do projeto fica invisível para a documentação.
    _IDX_EXT_LANG = {
        '.py': 'Python', '.pyw': 'Python',
        '.js': 'JavaScript', '.jsx': 'JavaScript',
        '.ts': 'TypeScript', '.tsx': 'TypeScript', '.mts': 'TypeScript', '.cts': 'TypeScript',
        '.cs': 'C#', '.java': 'Java', '.go': 'Go',
        '.rs': 'Rust', '.c': 'C', '.cpp': 'C++', '.cc': 'C++',
        '.h': 'C', '.hpp': 'C++',
        '.css': 'CSS', '.html': 'HTML', '.htm': 'HTML',
    }
    _IDX_MAX_SIZE = 500 * 1024

    # As duas peças abaixo existem porque a rotina Índice de Símbolos
    # (`agentes/indexacao/indice_simbolos.py`) refaz UM arquivo por vez: duas
    # cópias do parse divergiriam no primeiro ajuste. `build_symbol_index` é só
    # as duas juntas sobre o projeto inteiro.
    def _idx_arquivos_elegiveis(self, project_name):
        """Gera `(fpath, folder, lang)` de cada arquivo que entra no índice."""
        workspace = self.load_workspace(project_name)
        if not workspace['success']:
            return
        config = workspace['config']
        folders = config.get('working_folders', [])
        ignore_list = config.get('ignore_list', [])

        def esta_ignorado(path):
            return _esta_ignorado(path, ignore_list)

        context_descs = self._build_context_descs(config.get('context_items', []))
        for folder in folders:
            if not os.path.isdir(folder): continue
            for root, dirs, files in os.walk(folder):
                if esta_ignorado(root): dirs.clear(); continue
                dirs[:] = [d for d in dirs if not esta_ignorado(os.path.join(root, d))]
                for fname in sorted(files):
                    fpath = os.path.join(root, fname)
                    if esta_ignorado(fpath): continue
                    if self._e_arquivo_minificado(fname): continue
                    if self._get_ctx_desc(fpath, context_descs) is not None: continue
                    ext = os.path.splitext(fname)[1].lower()
                    lang = self._IDX_EXT_LANG.get(ext)
                    if not lang: continue
                    try:
                        if os.path.getsize(fpath) > self._IDX_MAX_SIZE: continue
                    except OSError:
                        continue
                    yield fpath, folder, lang

    def _idx_simbolos_do_arquivo(self, fpath, folder, lang, parser_cache):
        """Os símbolos de um arquivo, no formato do índice — ou `None` se ele
        não pôde ser lido (sem gramática, erro de leitura ou de parse)."""
        # O parser vem da fonte única (`treesitter.make_parser`: o pacote em
        # `Program/Dependencies/`, ou a gramática solta do sistema).
        from .treesitter import make_parser
        if lang not in parser_cache:
            parser_cache[lang] = make_parser(lang)
        parser = parser_cache.get(lang)
        if not parser:
            return None
        try:
            with open(fpath, 'rb') as f:
                content = f.read()
            tree = parser.parse(content)
            syms = _idx_extrair_simbolos(tree.root_node, lang)
        except Exception:
            return None
        return [{
            'name': sym['name'],
            'type': sym['type'],
            'file': fpath,
            'relative': os.path.relpath(fpath, folder),
            'folder': folder,
            'line': sym['line'],
            'language': lang,
        } for sym in syms]

    def build_symbol_index(self, project_name):
        try:
            from tree_sitter import Language, Parser
        except ImportError:
            return {'success': False, 'error': 'tree-sitter não instalado.'}

        workspace = self.load_workspace(project_name)
        if not workspace['success']:
            return {'success': False, 'error': 'Workspace não carregado.'}
        if not workspace['config'].get('working_folders', []):
            return {'success': True, 'total_files': 0, 'total_symbols': 0}

        parser_cache = {}
        all_symbols = []
        total_files = 0
        for fpath, folder, lang in self._idx_arquivos_elegiveis(project_name):
            syms = self._idx_simbolos_do_arquivo(fpath, folder, lang, parser_cache)
            if syms is None:
                continue
            total_files += 1
            all_symbols.extend(syms)

        all_symbols.sort(key=lambda s: s['name'].lower())
        index_data = {
            'built_at': datetime.now().isoformat(),
            'total_files': total_files,
            'total_symbols': len(all_symbols),
            'symbols': all_symbols,
        }
        index_path = obter_arquivo_de_indice_de_simbolos(project_name)
        os.makedirs(os.path.dirname(index_path), exist_ok=True)
        with open(index_path, 'w', encoding='utf-8') as f:
            json.dump(index_data, f, ensure_ascii=False)

        return {'success': True, 'total_files': total_files, 'total_symbols': len(all_symbols)}

    def get_symbol_index(self, project_name):
        index_path = obter_arquivo_de_indice_de_simbolos(project_name)
        if not os.path.exists(index_path):
            return {'success': True, 'index': None}
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return {'success': True, 'index': data}
        except Exception as e:
            return {'success': False, 'error': str(e), 'index': None}

    def find_symbol_usages(self, project_name, symbol_name):
        import re as _re
        workspace = self.load_workspace(project_name)
        if not workspace['success']:
            return {'success': False, 'usages': []}
        config = workspace['config']
        folders = config.get('working_folders', [])
        ignore_list = config.get('ignore_list', [])

        def esta_ignorado(path):
            return _esta_ignorado(path, ignore_list)

        # "Onde um símbolo pode APARECER?" — a parte Busca de usos de
        # Configurações › Arquivos que o programa lê › Exceções: o conjunto dela
        # (`EXTENSOES_DA_BUSCA_DE_USOS`, que era este `TEXT_EXTS` escrito aqui)
        # com o que o usuário acrescentou e retirou. Inclui .html e .css porque
        # um nome de classe ou de id é citado na marcação e no estilo; exclui
        # .rb/.php/.swift porque o índice de símbolos não os extrai. Acrescentar
        # é o furo para "o símbolo aparece num `.svg` com id citado no JS".
        # ⚠️ NÃO UNIFICAR com `CODE_EXTS` (analise.py) nem `_COB_EXT_GRAFO`
        # (cobertura.py). Ver o comentário em cobertura.py::_COB_EXT_GRAFO.
        from modulos.configuracoes_extensoes_excecoes import (
            EXTENSOES_DA_BUSCA_DE_USOS, lista_da_parte)
        try:
            TEXT_EXTS = set(lista_da_parte('busca_de_usos'))
        except Exception:
            TEXT_EXTS = set(EXTENSOES_DA_BUSCA_DE_USOS)
        pattern = _re.compile(r'\b' + _re.escape(symbol_name) + r'\b')
        usages = []
        MAX_SIZE = 500 * 1024

        for folder in folders:
            if not os.path.isdir(folder): continue
            for root, dirs, files in os.walk(folder):
                # Os dois níveis, como no Resumo: `esta_ignorado` é a tela
                # Projeto; `_fora_do_programa` é a aba Configurações, e vale em
                # todos os projetos. Uso de símbolo dentro de `node_modules`
                # não é uso do código do usuário.
                if esta_ignorado(root) or _fora_do_programa(root):
                    dirs.clear(); continue
                dirs[:] = [d for d in dirs
                           if not esta_ignorado(os.path.join(root, d))
                           and not _fora_do_programa(os.path.join(root, d))]
                for fname in sorted(files):
                    fpath = os.path.join(root, fname)
                    if esta_ignorado(fpath): continue
                    if _fora_do_programa(fpath): continue
                    if self._e_arquivo_minificado(fname): continue
                    ext = os.path.splitext(fname)[1].lower()
                    if ext not in TEXT_EXTS: continue
                    try:
                        if os.path.getsize(fpath) > MAX_SIZE: continue
                        with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                            for lineno, line in enumerate(f, 1):
                                if pattern.search(line):
                                    usages.append({
                                        'file': fpath,
                                        'relative': os.path.relpath(fpath, folder),
                                        'line': lineno,
                                        'snippet': line.strip()[:120],
                                    })
                    except Exception:
                        pass

        return {'success': True, 'usages': usages}


# ── O que conta como símbolo, por linguagem ──────────────────────────────────
# Funções de módulo, e não fechamentos dentro de `build_symbol_index`: a rotina
# Índice de Símbolos lê um arquivo por vez e usa as mesmas. A regra "este nó é
# símbolo, e com que nome" das linguagens de código mora em
# `treesitter.simbolo_do_no`, a mesma dos dois consumidores do Detector.

def _idx_txt(node):
    try:
        return node.text.decode('utf-8', errors='replace').strip()
    except Exception:
        return ''


def _idx_extrair_css(root):
    """Símbolo do CSS é o seletor da regra."""
    symbols = []
    def walk(node):
        if node.type == 'rule_set':
            for child in node.children:
                if child.type == 'selectors':
                    sel = ' '.join(_idx_txt(child).split())
                    if sel:
                        symbols.append({'type': 'seletor', 'name': sel[:120],
                                        'line': node.start_point[0] + 1})
                    break
        elif node.type == 'media_statement':
            query = ''
            for child in node.children:
                if child.type in ('feature_query', 'binary_query', 'parenthesized_query'):
                    query = ' '.join(_idx_txt(child).split())
                    break
            symbols.append({'type': 'media', 'name': ('@media ' + query).strip()[:120],
                            'line': node.start_point[0] + 1})
        for child in node.children:
            walk(child)
    walk(root)
    return symbols


def _idx_extrair_html(root):
    """Símbolo do HTML é o elemento identificável — id ou data-*.

    Elemento sem identificador não vira símbolo: seria ruído, e não é
    endereçável a partir do JS de qualquer forma.
    """
    symbols = []
    def walk(node):
        if node.type == 'element':
            start = next((c for c in node.children if c.type == 'start_tag'), None)
            if start is not None:
                tag = ''
                ident = None
                for child in start.children:
                    if child.type == 'tag_name' and not tag:
                        tag = _idx_txt(child)
                    elif child.type == 'attribute':
                        bruto = _idx_txt(child)
                        if '=' not in bruto:
                            continue
                        chave, valor = bruto.split('=', 1)
                        chave = chave.strip().lower()
                        valor = valor.strip().strip('"\'')
                        if chave == 'id':
                            ident = '#' + valor
                            break
                        if chave.startswith('data-') and ident is None:
                            ident = '[%s="%s"]' % (chave, valor)
                if ident:
                    symbols.append({'type': 'elemento',
                                    'name': ('%s %s' % (tag, ident)).strip()[:120],
                                    'line': node.start_point[0] + 1})
        for child in node.children:
            walk(child)
    walk(root)
    return symbols


def _idx_extrair_simbolos(root, lang_name):
    if lang_name == 'CSS':
        return _idx_extrair_css(root)
    if lang_name == 'HTML':
        return _idx_extrair_html(root)
    from .treesitter import simbolo_do_no
    symbols = []
    def walk(node):
        try:
            achado = simbolo_do_no(node, lang_name)
        except Exception:
            achado = None
        if achado is not None:
            tipo, name = achado
            symbols.append({'type': tipo, 'name': name, 'line': node.start_point[0] + 1})
        for child in node.children:
            walk(child)
    walk(root)
    return symbols
