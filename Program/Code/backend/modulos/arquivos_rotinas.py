"""Os arquivos que uma ROTINA gerou — listar, medir e ler.

⚠️ ROTINA, NÃO AGENTE DA BIBLIOTECA. O parâmetro destes métodos se chama
`agent` por história (é o nome que o frontend manda), mas o que eles leem é a
pasta de uma rotina do projeto, resolvida por `obter_pasta_da_rotina`
(`caminhos.py`) — nada a ver com `arquivos_agentes.py`, que edita o `.md` de um
subagente na biblioteca. Os dois arquivos nunca se tocam, e o nome parecido é a
única coisa que têm em comum.

Fica junto da família `arquivos*` porque a aba Rotinas, a aba Documentação e o
contexto inicial do chat leem tudo por aqui — é a mesma ponte de "ler arquivo
gerado" que o resto do módulo oferece para a biblioteca.

⚠️ A CONTAGEM É POR TIKTOKEN (`modulos/tokens.py`), NUNCA POR `chars // 4` NEM
POR `palavras * 1,3`. Este número é o que o usuário lê antes de marcar o
checkbox do contexto inicial, e uma estimativa por divisão erra para menos em
código — justamente onde caber ou não na janela decide o envio. Já houve três
fórmulas diferentes no programa ao mesmo tempo, e `get_agent_files_stats` nasceu
para acabar com a terceira, que vivia no frontend.
"""

from .constantes import *


class ArquivosRotinasMixin:

    @staticmethod
    def _is_agent_content_file(fname, na_raiz=True):
        """Arquivos de conteúdo dos agentes: .md, e .json do grafo — nunca os
        internos (_resumo, _auto...), que moram na RAIZ da pasta da rotina.

        ⚠️ O `_` só esconde na raiz (D33): mais fundo, `__init__.py.md` é a
        Documentação Técnica de um `__init__.py`, conteúdo como qualquer outro.
        `na_raiz` é `root == base` do `os.walk` de quem chama."""
        if fname.startswith('_') and na_raiz:
            return False
        return fname.endswith('.md') or fname.endswith('.json')

    def _arquivos_do_contexto(self, base, agent):
        """Os arquivos que o contexto inicial do Chat leva de uma rotina.

        O Pipeline em níveis grava centenas de `.md` (áreas, blocos, cadeias):
        do Pipeline vai só a Visão geral, `pipeline.md` — o mesmo que o MCP
        entrega sem `parte` —, e a caixinha do contexto mede só ela. As outras
        rotinas levam tudo o que geraram, como sempre.
        """
        if agent == 'pipeline':
            visao_geral = os.path.join(base, 'pipeline.md')
            return [visao_geral] if os.path.isfile(visao_geral) else []
        caminhos = []
        for root, dirs, fnames in os.walk(base):
            dirs.sort()
            for fname in sorted(fnames):
                if self._is_agent_content_file(fname, root == base):
                    caminhos.append(os.path.join(root, fname))
        return caminhos

    def list_agent_files(self, project_name, agent):
        try:
            base = obter_pasta_da_rotina(project_name, agent)
        except RotinaDesconhecida as erro:
            return {'success': False, 'error': str(erro)}
        if not os.path.isdir(base):
            return {'success': True, 'files': []}
        results = []
        for root, dirs, fnames in os.walk(base):
            dirs.sort()
            for fname in sorted(fnames):
                if not self._is_agent_content_file(fname, root == base): continue
                fpath = os.path.join(root, fname)
                rel = os.path.relpath(fpath, base).replace('\\', '/')
                results.append(rel)
        return {'success': True, 'files': results}

    def get_agent_abs_paths(self, project_name, agent):
        try:
            base = obter_pasta_da_rotina(project_name, agent)
        except RotinaDesconhecida as erro:
            return {'success': False, 'error': str(erro)}
        if not os.path.isdir(base):
            return {'success': True, 'paths': []}
        return {'success': True, 'paths': self._arquivos_do_contexto(base, agent)}

    def estimate_agent_tokens(self, project_name, agent):
        stats = self.get_agent_stats(project_name, agent)
        return {'success': stats['success'], 'tokens': stats.get('tokens', 0)}

    def get_agent_files_stats(self, project_name, agent):
        """Tokens e linhas de CADA arquivo gerado por um agente.

        Existe para a aba Rotinas parar de estimar token no frontend (era
        `palavras * 1,3`, uma terceira fórmula diferente das outras duas) e de
        buscar os arquivos um a um pela API — agora é uma chamada só, e o
        número sai do mesmo tiktoken de `get_agent_stats`.
        """
        from modulos.tokens import contar_tokens
        try:
            base = obter_pasta_da_rotina(project_name, agent)
        except RotinaDesconhecida as erro:
            return {'success': False, 'error': str(erro)}
        if not os.path.isdir(base):
            return {'success': True, 'files': [], 'tokens': 0, 'lines': 0}
        arquivos = []
        total_tokens = 0
        total_lines = 0
        for root, dirs, fnames in os.walk(base):
            dirs.sort()
            for fname in sorted(fnames):
                if not self._is_agent_content_file(fname, root == base):
                    continue
                fpath = os.path.join(root, fname)
                rel = os.path.relpath(fpath, base).replace('\\', '/')
                try:
                    with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
                        content = f.read()
                except Exception:
                    continue
                tokens = contar_tokens(content)
                linhas = content.count('\n') + (1 if content and not content.endswith('\n') else 0)
                arquivos.append({'file': rel, 'tokens': tokens, 'lines': linhas})
                total_tokens += tokens
                total_lines += linhas
        return {'success': True, 'files': arquivos,
                'tokens': total_tokens, 'lines': total_lines}

    def get_agent_stats(self, project_name, agent):
        """Tokens, linhas e quantidade de arquivos gerados por um agente.

        Conta pelo tiktoken (`modulos/tokens.py`), não por `chars // 4`: este
        número é o que o usuário lê antes de marcar o checkbox no contexto
        inicial do chat, e uma estimativa por divisão errava para menos em
        código — justamente onde caber ou não na janela decide o envio.
        """
        from modulos.tokens import contar_tokens
        try:
            base = obter_pasta_da_rotina(project_name, agent)
        except RotinaDesconhecida as erro:
            return {'success': False, 'error': str(erro)}
        if not os.path.isdir(base):
            return {'success': True, 'tokens': 0, 'lines': 0, 'files': 0}
        total_tokens = 0
        total_lines = 0
        total_files = 0
        for caminho in self._arquivos_do_contexto(base, agent):
            try:
                with open(caminho, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
                total_tokens += contar_tokens(content)
                total_lines += content.count('\n') + (1 if content and not content.endswith('\n') else 0)
                total_files += 1
            except Exception:
                pass
        return {'success': True, 'tokens': total_tokens, 'lines': total_lines, 'files': total_files}

    def read_agent_file(self, project_name, agent, filename):
        # Contenção de caminho: `filename` vem do frontend e um '..' escaparia
        # da pasta do agente — e a aba Documentação lê TODAS as suas fontes por
        # esta função, não só os resumos de pasta.
        #
        # O `agent` não precisa mais de contenção própria: ele passa pelo mapa
        # de `caminhos.py`, então string arbitrária não vira caminho nenhum —
        # vira `RotinaDesconhecida`.
        try:
            base = obter_pasta_da_rotina(project_name, agent)
        except RotinaDesconhecida as erro:
            return {'success': False, 'error': str(erro)}
        path = os.path.normpath(os.path.join(base, filename))
        if not path.startswith(os.path.normpath(base) + os.sep):
            return {'success': False, 'error': 'Caminho inválido.'}
        if not os.path.isfile(path):
            return {'success': False, 'error': 'Arquivo não encontrado.'}
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        return {'success': True, 'content': content}
