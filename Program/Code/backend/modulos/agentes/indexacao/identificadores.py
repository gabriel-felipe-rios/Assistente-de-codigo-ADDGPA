import re as _re

from ...constantes import *
from ..resumo_de_rotina import gravar_resumo_de_falha


class IdentificadoresMixin:
    """Índice de identificadores — o acoplamento que o grafo de imports não vê.

    Neste tipo de aplicativo a ligação real entre arquivos quase nunca é um
    import. O frontend não tem nenhum: os módulos JS são carregados por
    `<script src>` e conversam por funções globais. Renomear qualquer uma dessas
    pontes não gera erro — o Python continua rodando e o JS simplesmente não faz
    nada.

    A tabela é simples: todo nome que aparece em mais de um arquivo, com onde
    aparece e se ali ele é definido ou usado. Isso cobre função global JS,
    `window.pywebview.api.X` ↔ `def X`, `evaluate_js('nomeJS')` ↔ `function
    nomeJS`, ID de HTML lido no JS e chave de dicionário lida pelo nome.

    Filtro contra falso positivo: só entram nomes que o tree-sitter já
    reconheceu como símbolo **definido** em algum lugar do projeto. Isso corta
    `data`, `item`, `path` por interseção com uma lista que já existe — não por
    heurística de adivinhação.

    Tudo determinístico. Nenhuma chamada de LLM.
    """

    # Nomes curtos demais viram ruído mesmo estando no índice de símbolos.
    _ID_MIN_LEN = 3

    # Extensões varridas em busca de usos. Mais ampla que a do índice de
    # símbolos de propósito: o objetivo é achar o uso em HTML e CSS também.
    _ID_EXTS = {
        '.py', '.pyw', '.js', '.jsx', '.ts', '.tsx', '.mts', '.cts', '.cs', '.java', '.go',
        '.rs', '.c', '.cpp', '.cc', '.h', '.hpp', '.html', '.css', '.json',
    }

    _ID_MAX_SIZE = 500 * 1024

    # Identificadores comuns de código.
    _ID_TOKEN = _re.compile(r'[A-Za-z_][A-Za-z0-9_]*')
    # Identificadores com hífen — classes e IDs de CSS/HTML (`btn-primary`).
    # Sem isso, a ponte HTML↔CSS↔JS (a mais frágil do app) ficaria invisível.
    _ID_TOKEN_HIFEN = _re.compile(r'[A-Za-z_][A-Za-z0-9_-]*[A-Za-z0-9_]')

    @staticmethod
    def _id_nomes_casaveis(sym):
        """Nomes de busca derivados de um símbolo do índice.

        Símbolo de código casa consigo mesmo. Seletor CSS (`.btn, #send`) e
        elemento HTML (`button #send`) viram os identificadores nus que
        realmente aparecem escritos nos outros arquivos.
        """
        nome = (sym.get('name') or '').strip()
        tipo = sym.get('type') or ''
        if tipo not in ('seletor', 'media', 'elemento'):
            return [nome]

        nomes = []
        for bruto in _re.findall(r'[.#][A-Za-z_][A-Za-z0-9_-]*', nome):
            nomes.append(bruto[1:])
        for chave, valor in _re.findall(r'\[([a-z-]+)="([^"]*)"\]', nome):
            if valor:
                nomes.append(valor)
        return nomes

    # ── Caminhos ──────────────────────────────────────────────────────────────

    def _id_dir(self, project_name):
        return obter_pasta_da_rotina(project_name, 'identificadores')

    def _id_path(self, project_name):
        return os.path.join(self._id_dir(project_name), 'identificadores.json')

    def _id_load(self, project_name):
        try:
            path = self._id_path(project_name)
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                if isinstance(data.get('nomes'), dict):
                    return data
        except Exception:
            pass
        return {'gerado_em': None, 'nomes': {}}

    def _id_notify(self, project_name, payload):
        # `project` no payload: o front ignora o evento quando este projeto
        # não é o exibido no momento (várias abas de projeto abertas).
        payload = {**payload, 'project': project_name}
        try:
            self.window.evaluate_js('identificadoresAgentProgress(%s)' % json.dumps(payload))
        except Exception:
            pass

    # ── Construção do índice ──────────────────────────────────────────────────

    def _id_arquivos_do_projeto(self, project_name):
        """[(caminho_abs, caminho_rel_com_raiz)] das pastas de trabalho."""
        workspace = self.load_workspace(project_name)
        if not workspace.get('success'):
            return None
        config = workspace['config']
        ignore_list = config.get('ignore_list', [])
        context_descs = self._build_context_descs(config.get('context_items', []))

        arquivos = []
        for folder in config.get('working_folders', []):
            if not os.path.isdir(folder):
                continue
            raiz = os.path.basename(folder.rstrip(os.sep)) or folder
            for root, dirs, files in os.walk(folder):
                if self._caminho_ignorado(root, ignore_list):
                    dirs.clear()
                    continue
                dirs[:] = [d for d in dirs
                           if not self._caminho_ignorado(os.path.join(root, d), ignore_list)]
                for fname in sorted(files):
                    fpath = os.path.join(root, fname)
                    if self._caminho_ignorado(fpath, ignore_list):
                        continue
                    if os.path.splitext(fname)[1].lower() not in self._ID_EXTS:
                        continue
                    if self._get_ctx_desc(fpath, context_descs) is not None:
                        continue
                    rel = os.path.relpath(fpath, folder).replace('\\', '/')
                    arquivos.append((fpath, f'{raiz}/{rel}'))
        return arquivos

    def build_identificadores(self, project_name):
        """Constrói a tabela nome → ocorrências. Devolve o dict salvo."""
        # 1. Os nomes candidatos vêm do índice de símbolos — é o filtro.
        idx = self.get_symbol_index(project_name)
        if not idx.get('success') or not idx.get('index'):
            self.build_symbol_index(project_name)
            idx = self.get_symbol_index(project_name)
        simbolos = (idx.get('index') or {}).get('symbols', [])

        candidatos = {}
        for sym in simbolos:
            for nome in self._id_nomes_casaveis(sym):
                if len(nome) < self._ID_MIN_LEN:
                    continue
                candidatos.setdefault(nome, []).append(sym)
        if not candidatos:
            # Zero nomes é um resultado, não uma queda: grava os dois arquivos
            # mesmo assim. Sem o `_resumo.json` o ciclo lia a thread morta como
            # «sem sinal de vida»; sem o `identificadores.json` zerado, o MCP e
            # a aba Relações seguiam lendo a tabela de um ciclo anterior.
            data = {
                'gerado_em': datetime.now().isoformat(),
                'total_nomes': 0,
                'total_ocorrencias': 0,
                'arquivos_escaneados': [],
                'nomes': {},
            }
            self._id_gravar(project_name, data,
                            motivo='nenhum nome candidato — o índice de símbolos '
                                   'não reconheceu nenhum símbolo neste projeto')
            return data

        # Onde cada nome é definido (arquivo absoluto → linha).
        definicoes = {}
        for nome, syms in candidatos.items():
            definicoes[nome] = {s['file']: s['line'] for s in syms}

        arquivos = self._id_arquivos_do_projeto(project_name)
        if arquivos is None:
            return None

        # 2. Uma varredura só: para cada linha, quais candidatos aparecem.
        #    Um regex por nome sobre todos os arquivos seria O(nomes × linhas);
        #    tokenizar a linha uma vez e consultar o dict é O(linhas).
        ocorrencias = {}
        lidos = []

        for fpath, rel in arquivos:
            try:
                if os.path.getsize(fpath) > self._ID_MAX_SIZE:
                    continue
                with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                    for lineno, linha in enumerate(f, 1):
                        tokens = set(self._ID_TOKEN.findall(linha))
                        tokens.update(self._ID_TOKEN_HIFEN.findall(linha))
                        for token in tokens:
                            if token not in candidatos:
                                continue
                            linha_def = definicoes[token].get(fpath)
                            tipo = 'definicao' if linha_def == lineno else 'uso'
                            ocorrencias.setdefault(token, []).append({
                                'arquivo': rel,
                                'abs': fpath,
                                'linha': lineno,
                                'tipo': tipo,
                            })
                lidos.append(rel)
            except Exception:
                continue

        # 3. Só interessa nome que vive em mais de um arquivo — é isso que
        #    representa uma aresta entre arquivos.
        nomes = {}
        for nome, ocs in ocorrencias.items():
            if len({o['arquivo'] for o in ocs}) > 1:
                nomes[nome] = ocs

        data = {
            'gerado_em': datetime.now().isoformat(),
            'total_nomes': len(nomes),
            'total_ocorrencias': sum(len(v) for v in nomes.values()),
            # Quem o agente LEU, não quem sobrou no índice. O passo 3 acima só
            # guarda nome que vive em mais de um arquivo, então um arquivo
            # isolado — `__init__.py` vazio, `schema.json` que ninguém importa —
            # é lido e some. Medir cobertura pelo índice fazia esse arquivo
            # parecer eternamente pendente, e o medidor nunca fechava 100%.
            'arquivos_escaneados': sorted(lidos),
            'nomes': nomes,
        }

        self._id_gravar(project_name, data)
        return data

    def _id_gravar(self, project_name, data, motivo=None):
        """Grava `identificadores.json` e o `_resumo.json` — os dois caminhos
        de `build_identificadores` (com nomes e sem nenhum) passam por aqui."""
        os.makedirs(self._id_dir(project_name), exist_ok=True)
        with open(self._id_path(project_name), 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
        resumo = {'finished_at': data['gerado_em'], 'nomes': data['total_nomes']}
        if motivo:
            resumo['motivo'] = motivo
        with open(os.path.join(self._id_dir(project_name), '_resumo.json'), 'w', encoding='utf-8') as f:
            json.dump(resumo, f, ensure_ascii=False, indent=2)

    def run_identificadores_agent(self, project_name):
        def worker():
            try:
                self._id_notify(project_name, {'status': 'running'})
                data = self.build_identificadores(project_name)
                if data is None:
                    raise ValueError('Workspace não carregado.')
                self._id_notify(project_name, {'status': 'done',
                                 'nomes': data.get('total_nomes', 0),
                                 'ocorrencias': data.get('total_ocorrencias', 0)})
            except Exception as e:
                # Exceção sem resumo = «sem sinal de vida» para o ciclo inteiro.
                gravar_resumo_de_falha(project_name, 'identificadores', str(e), nomes=0)
                self._id_notify(project_name, {'status': 'error', 'error': str(e)})

        # A referência da thread fica registrada: é o que deixa o ciclo
        # saber que esta rotina continua viva (ver processando.py).
        self._proc_iniciar(project_name, 'identificadores', worker)
        return {'success': True}

    def get_identificadores_status(self, project_name):
        data = self._id_load(project_name)
        return {
            'success': True,
            'existe': bool(data['nomes']),
            'gerado_em': data.get('gerado_em'),
            'total_nomes': data.get('total_nomes', len(data['nomes'])),
            'total_ocorrencias': data.get('total_ocorrencias', 0),
        }

    # ── Relações e cascata (consumidos pela aba Análise → Relações) ───────────

    # Nome definido em mais arquivos do que isto não liga ninguém a ninguém —
    # é um nome local genérico. `worker`, `esta_ignorado` e `handler` aparecem como
    # `def` em vários módulos independentes; tratá-los como aresta ligaria todo
    # arquivo a todo arquivo e afogaria as ligações reais.
    _ID_MAX_DEFINIDORES = 2

    def _id_arestas(self, project_name):
        """{arquivo: {alvo: [motivos]}} — quem usa quem, e por qual nome.

        Uma aresta A → B existe quando A **usa** um nome que B **define**.
        """
        data = self._id_load(project_name)
        usa = {}
        for nome, ocs in data['nomes'].items():
            definidores = {o['arquivo'] for o in ocs if o['tipo'] == 'definicao'}
            if not definidores or len(definidores) > self._ID_MAX_DEFINIDORES:
                continue
            usuarios = {o['arquivo'] for o in ocs if o['tipo'] == 'uso'}
            for origem in usuarios:
                for destino in definidores:
                    if origem == destino:
                        continue
                    usa.setdefault(origem, {}).setdefault(destino, [])
                    if nome not in usa[origem][destino]:
                        usa[origem][destino].append(nome)
        return usa

    def get_relacoes(self, project_name, arquivo):
        """Quem esse arquivo usa e quem usa ele — os dois lados da mesma pergunta."""
        usa_map = self._id_arestas(project_name)

        usa = [{'arquivo': destino, 'via': motivos[:6]}
               for destino, motivos in sorted(usa_map.get(arquivo, {}).items())]

        usado_por = []
        for origem, destinos in sorted(usa_map.items()):
            if arquivo in destinos:
                usado_por.append({'arquivo': origem, 'via': destinos[arquivo][:6]})

        return {'success': True, 'arquivo': arquivo, 'usa': usa, 'usado_por': usado_por}

    def get_definicao_do_identificador(self, project_name, nome_simbolo):
        """Onde um identificador foi DEFINIDO — o "Ctrl+clique vai para
        definição" do Editor (Obra 11).

        ⚠️ MESMA LIMITAÇÃO de `_id_arestas`/`get_relacoes`: `data['nomes']` só
        guarda identificador que aparece em MAIS DE UM ARQUIVO (ver
        `build_identificadores`, passo 3). Um símbolo usado só dentro do
        próprio arquivo onde foi definido não entra no índice, e este método
        não acha a definição — é uma limitação da FONTE: o índice existe para
        relação ENTRE arquivos, não como um índice geral de símbolos.
        """
        data = self._id_load(project_name)
        ocs = (data['nomes'] if data else {}).get(nome_simbolo, [])
        definicoes = [o for o in ocs if o['tipo'] == 'definicao']
        if not definicoes:
            return {'success': False, 'error': 'Definição não encontrada no índice de identificadores.'}
        d = definicoes[0]
        return {'success': True, 'arquivo': d['arquivo'], 'linha': d['linha']}

    def get_cascata(self, project_name, arquivo, max_nivel=3):
        """Quem quebra indiretamente, por nível.

        Segue as setas de 'quem me usa'. Quem já apareceu num nível anterior não
        repete — em projeto grande o fechamento transitivo tende a "o projeto
        inteiro" e aí a informação vira inútil.
        """
        usa_map = self._id_arestas(project_name)

        usado_por = {}
        for origem, destinos in usa_map.items():
            for destino, motivos in destinos.items():
                usado_por.setdefault(destino, {})[origem] = motivos

        vistos = {arquivo}
        diretos = set(usado_por.get(arquivo, {}))
        vistos |= diretos

        niveis = []
        fronteira = diretos
        nivel = 2
        while fronteira and nivel <= max_nivel:
            proxima = set()
            itens = []
            for atual in sorted(fronteira):
                for candidato, motivos in sorted(usado_por.get(atual, {}).items()):
                    if candidato in vistos:
                        continue
                    proxima.add(candidato)
                    itens.append({'arquivo': candidato, 'via': motivos[:4],
                                  'atraves_de': atual})
            if itens:
                vistos |= proxima
                niveis.append({'nivel': nivel, 'itens': itens})
            fronteira = proxima
            nivel += 1

        # O que sobrou além do teto: conta, não lista.
        restantes = set()
        fronteira_extra = fronteira
        while fronteira_extra:
            proxima = set()
            for atual in fronteira_extra:
                for candidato in usado_por.get(atual, {}):
                    if candidato not in vistos and candidato not in restantes:
                        restantes.add(candidato)
                        proxima.add(candidato)
            fronteira_extra = proxima

        return {
            'success': True,
            'arquivo': arquivo,
            'niveis': niveis,
            'restantes': len(restantes),
        }

    def get_ligacoes(self, project_name):
        """Grafo inteiro de ligações — nós, arestas e o peso de cada uma.

        Peso = quantos nomes distintos sustentam a aresta. É o que alimenta o
        filtro "Peso mínimo" da tela. Sai tudo de uma vez porque a tela de
        Ligações filtra no navegador: pedir de novo a cada arrasto do slider
        seria uma ida e volta por pixel.
        """
        data = self._id_load(project_name)
        if not data['nomes']:
            return {'success': False,
                    'error': 'Índice de Identificadores vazio. Rode-o primeiro na aba Análise.',
                    'nos': [], 'arestas': []}

        arquivos = set()
        for ocs in data['nomes'].values():
            for o in ocs:
                arquivos.add(o['arquivo'])

        nos = []
        for rel in sorted(arquivos):
            pasta = rel.rsplit('/', 1)[0] if '/' in rel else ''
            nos.append({
                'arquivo': rel,
                'pasta': pasta,
                'linguagem': os.path.splitext(rel)[1].lower().lstrip('.'),
            })

        usa_map = self._id_arestas(project_name)
        arestas = []
        for origem in sorted(usa_map):
            for destino, motivos in sorted(usa_map[origem].items()):
                arestas.append({'origem': origem, 'destino': destino,
                                'via': sorted(motivos), 'peso': len(motivos)})

        return {'success': True, 'nos': nos, 'arestas': arestas}

    def list_arquivos_indexados(self, project_name):
        """Arquivos que aparecem no índice — alimenta a lista da aba Relações."""
        data = self._id_load(project_name)
        arquivos = set()
        for ocs in data['nomes'].values():
            for o in ocs:
                arquivos.add(o['arquivo'])
        return {'success': True, 'arquivos': sorted(arquivos)}
